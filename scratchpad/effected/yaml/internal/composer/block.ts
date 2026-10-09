import * as A from "effect/Array";
import { dual } from "effect/Function";
import { $ScratchpadId } from "@beep/identity/packages";
// Block-collection composition: block mappings (with the sibling-first-key
// CST shape), block sequences, flat block maps, and the shared pair-building
// machinery (`SemanticItem`, `buildPairs`) that flow composition also uses.
//
// Cross-seam recursion into flow composition goes through `state.flow` (see
// `FlowComposers` in `state.ts`) so this module never imports `flow.ts`.

import { YamlNode } from "../../YamlNode.ts";
import { YamlAlias, YamlMap, YamlPair, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import type { CstNode } from "../cst.ts";
import { checkAnchorOnAlias, getAnchorName, makeAlias, registerAnchor } from "./anchors.ts";
import type { CommentFields, EscapedComment } from "./comments.ts";
import {
	blankAboveIsKeepChompContent,
	columnAt,
	hasBlankLineAbove,
	isAfterIndicatorOnly,
	isOwnLineAt,
	joinComments,
	rawCommentText,
	sameLineSpan,
	withCommentFields,
} from "./comments.ts";
import {
	blockMapStartsWithValueSep,
	classifyPlainNumeric,
	collectMultilineKey,
	collectMultilinePlainScalar,
	findFirstContent,
	findLastContent,
	findNextContentInList,
	findNextSignificantChild,
	findValueSepOffset,
	getScalarStyle,
	hasValueSepAfterInList,
	hasValueSepBetween,
	hasValueSepThroughPlainScalars,
	makeScalar,
	resolveScalar,
	shouldPreserveRaw,
} from "./scalars.ts";
import type { ComposerState, NodeMeta } from "./state.ts";
import {
	enterNesting,
	exitNesting,
	hasMeta,
	hasNonWhitespaceBeforeOnLine,
	lineCol,
	lineIndentColumn,
	sameLine,
} from "./state.ts";
import * as S from "effect/Schema";
import * as O from "@beep/utils/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";

const isYamlAlias = S.is(YamlAlias);
const isYamlScalar = S.is(YamlScalar);

// ---------------------------------------------------------------------------
// Compose block map
// ---------------------------------------------------------------------------

const $I = $ScratchpadId.create("effected/yaml/internal/composer/block");

/**
 * Compose a block map from its CST children, with an optional external first key.
 *
 * CST pattern for `a: 1, b: true`:
 *   `[flow-scalar("a"), block-map(children: [":"," ","1","\\n","b",":"," ","true"])]`
 *
 * The first key is external (sibling before block-map in document/parent).
 * Subsequent keys are inside the block-map children.
 */
export const composeBlockMap: {
	(state: ComposerState, externalFirstKey?: YamlNode, meta?: NodeMeta): (blockMapCst: CstNode) => YamlMap;
	(blockMapCst: CstNode, state: ComposerState, externalFirstKey?: YamlNode, meta?: NodeMeta): YamlMap;
} = dual((args) => P.hasProperty(args[0], "source"), (blockMapCst: CstNode, state: ComposerState, externalFirstKey?: YamlNode, meta?: NodeMeta): YamlMap => {
	// Nesting-depth guard: unbounded recursion is a stack-overflow DoS vector.
	if (!enterNesting(state, blockMapCst)) {
		return YamlMap.make({ items: [], style: "block", offset: blockMapCst.offset, length: blockMapCst.length });
	}
	try {
		return composeBlockMapInner(blockMapCst, state, externalFirstKey, meta);
	} finally {
		exitNesting(state);
	}
});

function composeBlockMapInner(
	blockMapCst: CstNode,
	state: ComposerState,
	externalFirstKey?: YamlNode,
	meta?: NodeMeta,
): YamlMap {
	const children = blockMapCst.children ?? [];
	const pairs: YamlPair[] = [];

	// Phase 1: parse children into a flat stream of semantic items.
	// The key's "effective column" for indentation purposes is the leftmost
	// non-whitespace column on the line containing the key — properties (tags,
	// anchors) before the scalar can shift the actual scalar offset to a
	// larger column, but the property column is what matters for validating
	// continuation-line indentation.
	const extKeyOffset =
		externalFirstKey !== undefined && "offset" in externalFirstKey ? externalFirstKey.offset : undefined;
	const extKeyCol = extKeyOffset !== undefined ? lineIndentColumn(state.text, extKeyOffset) : undefined;
	const items = flattenBlockMapChildren(children, state, extKeyCol, extKeyOffset);

	// If there's an external first key, prepend it
	if (externalFirstKey !== undefined) {
		items.unshift({ kind: "key", node: externalFirstKey });
	}

	// Phase 2: pair up keys and values
	const trailingComment = buildPairs(items, pairs, state.text, state.escapedComments);

	if (state.options.uniqueKeys) checkDuplicateKeys(pairs, state);
	checkMultilineImplicitKeys(pairs, state);

	const offset =
		externalFirstKey !== undefined
			? "offset" in externalFirstKey
				? externalFirstKey.offset
				: blockMapCst.offset
			: blockMapCst.offset;
	const end = trimDisownedTrailingComments(
		state.text,
		offset,
		blockMapCst.offset + blockMapCst.length,
		state.escapedComments,
	);
	const length = end - offset;

	const mapComment =
		meta?.comment !== undefined
			? trailingComment !== undefined
				? `${meta.comment}\n${trailingComment}`
				: meta.comment
			: trailingComment;
	const map = YamlMap.make({
		items: pairs,
		style: "block",
		offset,
		length,
		...O.getSomesStruct({ tag: O.fromUndefinedOr(meta?.tag) }),
		...O.getSomesStruct({ anchor: O.fromUndefinedOr(meta?.anchor) }),
		...O.getSomesStruct({ comment: O.fromUndefinedOr(mapComment) }),
	});

	if (meta?.anchor !== undefined && meta?.anchor !== "") registerAnchor(map, meta.anchor, state, offset);
	return map;
}

/**
 * Narrow a block collection's raw CST span so it stops before any trailing
 * comment line the collection's own comment model has already DISOWNED.
 *
 * The CST length of a block map/seq runs to the end of the last physical line
 * the parser consumed, which includes a floating comment sitting at a column
 * shallower than the collection's content. The comment model deliberately
 * does not give that comment to the collection — `buildPairs` and the block-seq
 * terminal partition push it onto `state.escapedComments`, where the enclosing
 * scope re-attributes it (see `EscapedComment` in `comments.ts`: "it belongs to
 * an outer scope"). The span was the one place that disagreed, reporting an
 * `offset`/`length` whose end lay past a comment the node does not own — so a
 * caller splicing text at the end of the collection inserted AFTER the comment.
 *
 * The disowned set is the input rather than a re-derived column test, so the
 * span and the comment model cannot drift apart: whatever the partition threw
 * out, the span excludes.
 *
 * Blank lines immediately above a trimmed run go with the run, not with the
 * last entry — but only when something was trimmed, so a collection whose span
 * merely ends in blank lines keeps the end it has always reported.
 *
 * Composition is bottom-up, so a nested collection's own span has already been
 * trimmed by the time its parent's items are read.
 */
function trimDisownedTrailingComments(
	text: string,
	offset: number,
	end: number,
	disowned: ReadonlyArray<EscapedComment>,
): number {
	let cut = end;
	for (const ec of disowned) {
		// Only comments disowned by THIS collection: `state.escapedComments` is a
		// shared channel, so an entry outside the span belongs to another node.
		if (ec.offset < offset || ec.offset >= cut) continue;
		const lineStart = text.lastIndexOf("\n", ec.offset - 1) + 1;
		// A collection never shrinks past its own first line.
		if (lineStart <= offset || lineStart >= cut) continue;
		cut = lineStart;
	}
	if (cut === end) return end;
	while (cut > offset && text[cut - 1] === "\n") {
		const prevLineStart = text.lastIndexOf("\n", cut - 2) + 1;
		if (prevLineStart <= offset) break;
		if (text.slice(prevLineStart, cut - 1).trim() !== "") break;
		cut = prevLineStart;
	}
	return cut;
}

export const SemanticItem = S.Union([
	S.Struct({
		kind: S.Literal("key")
			.pipe(S.mutableKey)
			.annotate($I.annote("SemanticItem.Key.kind", { description: "Explicit or external key marker." })),
		node: YamlNode.pipe(S.optionalKey, S.mutableKey).annotate(
			$I.annote("SemanticItem.Key.node", { description: "Optional key node; an explicit-key marker may be empty." }),
		),
	}).annotate($I.annote("SemanticItem.Key", { description: "Explicit or external key." })),
	S.Struct({
		kind: S.Literal("value-sep")
			.pipe(S.mutableKey)
			.annotate($I.annote("SemanticItem.ValueSep.kind", { description: "Mapping value separator." })),
		offset: S.Finite.pipe(S.mutableKey).annotate(
			$I.annote("SemanticItem.ValueSep.offset", { description: "Source offset of the structural colon." }),
		),
	}).annotate($I.annote("SemanticItem.ValueSep", { description: "Mapping value separator." })),
	S.Struct({
		kind: S.Literal("node")
			.pipe(S.mutableKey)
			.annotate($I.annote("SemanticItem.Node.kind", { description: "Composed content node." })),
		node: YamlNode.pipe(S.mutableKey).annotate(
			$I.annote("SemanticItem.Node.node", { description: "Composed YAML node." }),
		),
	}).annotate($I.annote("SemanticItem.Node", { description: "Composed content node." })),
	S.Struct({
		kind: S.Literal("comment")
			.pipe(S.mutableKey)
			.annotate($I.annote("SemanticItem.Comment.kind", { description: "Comment awaiting attribution." })),
		comment: S.String.pipe(S.mutableKey).annotate(
			$I.annote("SemanticItem.Comment.comment", { description: "Raw post-indicator comment text." }),
		),
		offset: S.Finite.pipe(S.mutableKey).annotate(
			$I.annote("SemanticItem.Comment.offset", { description: "Source offset of the comment." }),
		),
	}).annotate($I.annote("SemanticItem.Comment", { description: "Comment awaiting attribution." })),
])
	.pipe(S.toTaggedUnion("kind"))
	.annotate(
		$I.annote("SemanticItem", {
			description: "Composition tokens with kind-specific payloads; explicit keys may be node-less.",
		}),
	);
export type SemanticItem = typeof SemanticItem.Type;

export const flattenBlockMapChildren: {
	(state: ComposerState, externalKeyColumn?: number, externalKeyOffset?: number): (children: readonly CstNode[]) => SemanticItem[];
	(children: readonly CstNode[], state: ComposerState, externalKeyColumn?: number, externalKeyOffset?: number): SemanticItem[];
} = dual((args) => A.isArray(args[0]), (children: readonly CstNode[], state: ComposerState, externalKeyColumn?: number, externalKeyOffset?: number): SemanticItem[] => {
	const items: SemanticItem[] = [];
	let pendingMeta: NodeMeta = {};
	// Outer meta: anchor/tag that came BEFORE a newline in value position. Applies
	// to the surrounding container (e.g. block map) when the inner content has its
	// own metadata. Without this split, two adjacent anchors collapse and the first
	// is lost (test 7BMT, U3XV: `top: &outer\n  &inner key: val`).
	let outerMeta: NodeMeta = {};
	let sawNewlineSincePending = false;
	let afterValueSep = false;
	let lastValueSepOffset = -1;
	let lastKeyColumn = externalKeyColumn ?? -1;
	let lastKeyOffset = externalKeyOffset ?? -1;
	// Whether `lastKeyColumn` originated from an externally-provided first key
	// (i.e., the parser placed the first key as a sibling before the block-map).
	// Only externally-anchored columns are used for indentation validation —
	// internally-tracked columns may include malformed CST artifacts and
	// shouldn't trigger validation errors.
	const hasExternalKeyColumn = externalKeyColumn !== undefined;
	// When `?` explicit-key indicator is seen, the entry indent is the column
	// of `?`, not of the key scalar. Track it so the next key uses the right
	// column for indentation validation. Reset after the key is consumed.
	let pendingExplicitKeyCol = -1;

	// If we have pending meta and a newline has been seen since it was set, the
	// pending meta applies to the surrounding context (outer container) and any
	// new meta encountered belongs to the upcoming inner content.
	function commitOuterIfNewlineSeen(): void {
		if (sawNewlineSincePending && hasMeta(pendingMeta)) {
			// When both slots already carry an anchor or tag — the rare case of
			// three or more consecutive metadata tokens spanning multiple newlines
			// — the spread intentionally favours the most recent (pendingMeta)
			// per a "last wins" rule. registerAnchor surfaces a duplicate-anchor
			// warning if the dropped anchor is reused elsewhere.
			outerMeta = hasMeta(outerMeta) ? { ...outerMeta, ...pendingMeta } : pendingMeta;
			pendingMeta = {};
		}
		sawNewlineSincePending = false;
	}

	function combinedPending(): NodeMeta {
		if (!hasMeta(outerMeta)) return pendingMeta;
		if (!hasMeta(pendingMeta)) return outerMeta;
		return { ...outerMeta, ...pendingMeta };
	}

	// Reset both meta slots and the newline-since-pending flag. Renamed from
	// `clearMeta` to avoid shadowing the module-level `clearMeta(m: NodeMeta)`
	// helper used elsewhere in this file.
	function resetAllMeta(): void {
		pendingMeta = {};
		outerMeta = {};
		sawNewlineSincePending = false;
	}

	function validateKeyColumn(col: number, offset: number, length: number): void {
		if (lastKeyColumn >= 0 && col !== lastKeyColumn) {
			state.errors.push({
				code: "InvalidIndentation",
				message: "Bad indentation in block mapping",
				offset,
				length,
			});
		}
	}

	function pushNode(node: YamlNode, nodeOffset?: number) {
		// Track key column/offset when pushing in key position (before value-sep)
		if (!afterValueSep && nodeOffset !== undefined && nodeOffset >= 0) {
			// If `?` explicit-key indicator preceded this scalar, the entry's
			// indent is the `?` column. Otherwise it's the scalar's column.
			const newCol = pendingExplicitKeyCol >= 0 ? pendingExplicitKeyCol : lineCol(state.text, nodeOffset).column;
			lastKeyColumn = newCol;
			lastKeyOffset = nodeOffset;
		}
		pendingExplicitKeyCol = -1;
		items.push({ kind: "node", node });
		// Re-inject comments that escaped a nested compose (their column was
		// shallower than the nested collection's content) into THIS level's
		// stream — buildPairs re-classifies them, and may escape them further.
		if (state.escapedComments.length > 0) {
			for (const ec of state.escapedComments) {
				items.push({ kind: "comment", comment: ec.text, offset: ec.offset });
			}
			state.escapedComments.length = 0;
		}
		afterValueSep = false;
	}

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child === undefined) continue;

		if (child.type === "error") {
			state.errors.push({
				code: "UnexpectedToken",
				message: `Unexpected content: ${child.source.trim() || "(empty)"}`,
				offset: child.offset,
				length: child.length,
			});
			continue;
		}

		if (child.type === "newline") {
			if (hasMeta(pendingMeta)) sawNewlineSincePending = true;
			continue;
		}
		if (child.type === "whitespace") {
			if (child.source === "?") {
				// Explicit key indicator (YAML §8.2.1). The "?" introduces
				// the key of this mapping entry. The key spans until the
				// matching `:` at the same column as `?`; if no such `:`
				// exists, the rest of the mapping scope is the key.
				const qCol = lineCol(state.text, child.offset).column;
				pendingExplicitKeyCol = qCol;
				afterValueSep = false;
				// Detect inline-implicit-map keys (M2N8/00, M2N8/01): when
				// there's no matching `:` at `qCol` but there IS a `:` at a
				// deeper column, the entire slice forms a compact inline
				// implicit map that IS the explicit key.
				const lookahead = scanExplicitKeyShape(children, i, qCol, state.text);
				if (lookahead.kind === "inline-implicit-map") {
					const sliceChildren = children.slice(i + 1, lookahead.endIdx);
					const innerItems = flattenBlockMapChildren(sliceChildren, state);
					const innerPairs: YamlPair[] = [];
					const innerTrailing = buildPairs(innerItems, innerPairs, state.text);
					const firstC = findFirstContent(sliceChildren);
					const lastC = findLastContent(sliceChildren);
					const innerOffset = firstC !== undefined ? firstC.offset : child.offset;
					const innerEnd = lastC !== undefined ? lastC.offset + lastC.length : child.offset + child.length;
					const innerMap = YamlMap.make({
						items: innerPairs,
						style: "block",
						offset: innerOffset,
						length: innerEnd - innerOffset,
						...O.getSomesStruct({ comment: O.fromUndefinedOr(innerTrailing) }),
					});
					pushNode(innerMap, innerOffset);
					i = lookahead.endIdx - 1; // outer loop will i++ to endIdx (skip the slice)
					continue;
				}
				continue;
			}
			if (child.source === ":") {
				// Y79Y/009: a value-sep `:` on a continuation line followed by a
				// tab and same-line content is invalid — tabs cannot serve as the
				// indent for the upcoming key/value content (YAML 1.2 §6.1).
				validateNoTabAfterContinuationValueSep(child, children, i, state);
				// Flush pending tag/anchor as empty scalar before value-sep.
				// Combine outer+pending so any anchors before a newline are also
				// represented (otherwise outer-context anchors would be lost).
				const flushMeta = combinedPending();
				if (hasMeta(flushMeta)) {
					const value = resolveScalar("", ["plain", flushMeta.tag, state]);
					const scalar = YamlScalar.make({
						value,
						style: "plain",
						offset: child.offset,
						length: 0,
						...O.getSomesStruct({ tag: O.fromUndefinedOr(flushMeta.tag) }),
						...O.getSomesStruct({ anchor: O.fromUndefinedOr(flushMeta.anchor) }),
					});
					if (flushMeta.anchor !== undefined && flushMeta.anchor !== "")
						registerAnchor(scalar, flushMeta.anchor, state, child.offset);
					resetAllMeta();
					pushNode(scalar);
				}
				items.push({ kind: "value-sep", offset: child.offset });
				afterValueSep = true;
				lastValueSepOffset = child.offset;
			}
			// Check for sequence entry on same line as value-sep (5U3A: `key: - a`).
			// Only flag for implicit key mappings (has a key scalar on the same line
			// before ":"), not explicit mappings (? key\n: - value) where this is valid.
			if (
				child.source === "-" &&
				lastValueSepOffset >= 0 &&
				sameLine(state.text, lastValueSepOffset, child.offset) &&
				hasNonWhitespaceBeforeOnLine(state.text, lastValueSepOffset)
			) {
				state.errors.push({
					code: "UnexpectedToken",
					message: "Sequence entry on same line as mapping value indicator",
					offset: child.offset,
					length: child.length,
				});
			} else if (
				// 4HVU: a stray block-seq entry indicator "-" outside any block-seq
				// (e.g. after a sibling block-seq value at a different indent) is
				// malformed. Legitimate "-" indicators are consumed by composeBlockSeq.
				// Allow "-" after a `?` explicit-key indicator (KK5P: `? - a`),
				// detected via either pendingExplicitKeyCol being set OR the
				// preceding non-trivia child being an empty block-seq placeholder
				// or a `?`-marker block-map (KK5P parser shape for `? - a`).
				child.source === "-" &&
				lastValueSepOffset >= 0 &&
				!sameLine(state.text, lastValueSepOffset, child.offset) &&
				pendingExplicitKeyCol < 0 &&
				!precededByExplicitKeyMarker(children, i)
			) {
				state.errors.push({
					code: "InvalidIndentation",
					message: "Block sequence entry indicator outside any sequence",
					offset: child.offset,
					length: child.length,
				});
			}
			continue;
		}
		if (child.type === "comment") {
			items.push({ kind: "comment", comment: rawCommentText(child.source), offset: child.offset });
			continue;
		}
		if (child.type === "anchor") {
			// G9HC, H7J7: anchor/tag in value position on a continuation line
			// (different line from the `:` indicator) must be at a column
			// strictly greater than the parent key's column. Per YAML 1.2 §8.1.2,
			// properties before a block collection must be at indent n+1.
			validatePropertyContinuationColumn(child, state, afterValueSep, lastValueSepOffset, lastKeyColumn);
			// If we already have pending meta and a newline was seen since, the
			// existing pending meta belongs to the outer container (it was on the
			// same line as the value indicator). Move it to outerMeta so the new
			// anchor can attach to the inner content as its own pending meta.
			commitOuterIfNewlineSeen();
			pendingMeta.anchor = getAnchorName(child, state.text);
			continue;
		}
		if (child.type === "tag") {
			validatePropertyContinuationColumn(child, state, afterValueSep, lastValueSepOffset, lastKeyColumn);
			commitOuterIfNewlineSeen();
			pendingMeta.tag = child.source;
			continue;
		}
		if (child.type === "flow-scalar" || child.type === "block-scalar") {
			// Reaching content: if pending meta predates a newline, it belongs to
			// the outer container, not the upcoming inner content.
			commitOuterIfNewlineSeen();
			// 4JVG: a single scalar cannot have two anchor declarations. When
			// outerMeta and pendingMeta both have anchors AND the scalar is
			// neither a key nor produces a nested map (no block-map sibling and
			// no following `:`), both anchors collapse onto the scalar — invalid.
			validateNoDoubleAnchorOnScalar(child, children, i, outerMeta, pendingMeta, state);
			// If this scalar is a key (followed by `:` at this level) and there's
			// pending meta from a previous VALUE position, flush it as a null value.
			// e.g., `a: &anchor\nb:` — the anchor belongs to null, not to `b`.
			// Includes any anchor that was committed to outerMeta across a newline.
			//
			// Restrict to same-line `:` so we don't fire on patterns like
			// `? a\n: &b b\n: *a` where the next `:` belongs to a SUBSEQUENT
			// pair (different line) and `b` is the value of the current pair.
			const valueSepOffset = findValueSepOffset(children, i + 1);
			const sepOnSameLine =
				valueSepOffset >= 0 && lineCol(state.text, child.offset).line === lineCol(state.text, valueSepOffset).line;
			if (afterValueSep && sepOnSameLine) {
				const flushMeta = combinedPending();
				if (hasMeta(flushMeta)) {
					const value = resolveScalar("", ["plain", flushMeta.tag, state]);
					const scalar = YamlScalar.make({
						value,
						style: "plain",
						offset: child.offset,
						length: 0,
						...O.getSomesStruct({ tag: O.fromUndefinedOr(flushMeta.tag) }),
						...O.getSomesStruct({ anchor: O.fromUndefinedOr(flushMeta.anchor) }),
					});
					if (flushMeta.anchor !== undefined && flushMeta.anchor !== "")
						registerAnchor(scalar, flushMeta.anchor, state, child.offset);
					resetAllMeta();
					pushNode(scalar);
				}
			}
			// Detect same-line nested mapping (ZCZ6: `a: b: c: d`, ZL4Z: `a: 'b': c`).
			// If we're in value position and this scalar is followed by ":"
			// on the same line as both the preceding ":" AND the scalar itself,
			// AND the preceding ":" was from an implicit key (has non-whitespace
			// before it on the same line), it's an invalid nested mapping.
			// Skip for explicit mappings (? key\n: value) where `:` starts a value.
			const nextValueSepOffset = findValueSepOffset(children, i + 1);
			if (
				afterValueSep &&
				lastValueSepOffset >= 0 &&
				hasNonWhitespaceBeforeOnLine(state.text, lastValueSepOffset) &&
				child.type === "flow-scalar" &&
				nextValueSepOffset >= 0 &&
				sameLine(state.text, lastValueSepOffset, child.offset) &&
				sameLine(state.text, child.offset, nextValueSepOffset)
			) {
				state.errors.push({
					code: "UnexpectedToken",
					message: "Implicit mapping key on same line as previous value indicator",
					offset: child.offset,
					length: child.length,
				});
			}
			// Check if this scalar is followed by a block-map (scalar is the first
			// key of a nested mapping: the parser puts the first key as a sibling
			// before its block-map child).
			// But NOT if there's a ":" value-sep between the scalar and the
			// block-map — in that case, the scalar is a key at the current level
			// and the block-map is its value (e.g., `mapping:\n  ? sky\n  : blue`).
			const nextContent = findNextContentInList(children, i + 1);
			if (nextContent?.node.type === "block-map" && !hasValueSepBetween(children, i + 1, nextContent.idx)) {
				// The scalar is the first key of the nested mapping. Anchor/tag
				// that came BEFORE a newline (outerMeta) belong to the new map;
				// anchor/tag that came AFTER the newline (pendingMeta), on the
				// same line as the key, belong to the key itself.
				// Validate column consistency: in key position, the scalar must
				// match the established key column for this block mapping.
				// Use `?` column if explicit-key indicator was seen, otherwise scalar.
				// Only validate when externally-anchored (avoids false positives
				// from malformed CSTs).
				if (!afterValueSep && hasExternalKeyColumn) {
					const scalarCol =
						pendingExplicitKeyCol >= 0 ? pendingExplicitKeyCol : lineCol(state.text, child.offset).column;
					validateKeyColumn(scalarCol, child.offset, child.length);
				}
				const keyMeta = hasMeta(pendingMeta) ? pendingMeta : undefined;
				const mapMeta = hasMeta(outerMeta) ? outerMeta : undefined;
				const key = makeScalar(child, state, keyMeta);
				const map = composeBlockMap(nextContent.node, state, key, mapMeta);
				resetAllMeta();
				pushNode(map);
				i = nextContent.idx; // skip to past the block-map
				continue;
			}
			// For explicit keys (? key\n  continuation\n:), use collectMultilineKey
			// which merges plain scalars up to the ":" value-sep (JTV5).
			if (
				!afterValueSep &&
				child.type === "flow-scalar" &&
				getScalarStyle(child) === "plain" &&
				!hasValueSepAfterInList(children, i + 1) &&
				hasValueSepThroughPlainScalars(children, i + 1)
			) {
				// Check that we're preceded by "?" (explicit key context)
				// and that the next continuation scalar is indented beyond the "?" column.
				// `? a\n  true\n:` → merge (true at col 2 > ? at col 0) (JTV5)
				// `? b\nc:\n` → don't merge (c at col 0 = ? at col 0) (7W2P)
				let isExplicitKey = false;
				let explicitKeyCol = -1;
				for (let p = i - 1; p >= 0; p--) {
					const prev = children[p];
					if (prev === undefined) continue;
					if (prev.type === "whitespace" && prev.source === "?") {
						explicitKeyCol = lineCol(state.text, prev.offset).column;
						isExplicitKey = true;
						break;
					}
					if (prev.type === "whitespace" && prev.source.trim() === "") continue;
					if (prev.type === "newline") continue;
					break;
				}
				// Only merge if the next scalar after a newline is indented beyond ?
				if (isExplicitKey) {
					let nextScalarIndented = false;
					let sawNl = false;
					for (let j = i + 1; j < children.length; j++) {
						const c = children[j];
						if (c === undefined) continue;
						if (c.type === "newline") {
							sawNl = true;
							continue;
						}
						if (c.type === "whitespace" && c.source.trim() === "") continue;
						if (sawNl && c.type === "flow-scalar") {
							const cCol = lineCol(state.text, c.offset).column;
							nextScalarIndented = cCol > explicitKeyCol;
						}
						break;
					}
					isExplicitKey = nextScalarIndented;
				}
				if (isExplicitKey) {
					const { value: keyValue, nextIdx: keyNextIdx } = collectMultilineKey(children, i);
					const keyMeta = combinedPending();
					const resolved = resolveScalar(keyValue, ["plain", keyMeta.tag, state]);
					const scalar = YamlScalar.make({
						value: resolved,
						style: "plain",
						offset: child.offset,
						length: child.length,
						...O.getSomesStruct({ tag: O.fromUndefinedOr(keyMeta.tag) }),
						...O.getSomesStruct({ anchor: O.fromUndefinedOr(keyMeta.anchor) }),
					});
					if (keyMeta.anchor !== undefined && keyMeta.anchor !== "")
						registerAnchor(scalar, keyMeta.anchor, state, child.offset);
					resetAllMeta();
					pushNode(scalar, child.offset);
					i = keyNextIdx - 1;
					continue;
				}
			}
			// For plain scalars not followed by ":", try multi-line merging
			if (
				child.type === "flow-scalar" &&
				getScalarStyle(child) === "plain" &&
				!hasValueSepAfterInList(children, i + 1)
			) {
				const isValuePosition = afterValueSep;
				// In key position, a plain scalar without ":" after it is
				// trailing content (236B, 7MNF, 6S55, 9CWY) — unless preceded
				// by a block indicator ("-", "?") which means it's part of an
				// explicit mapping (KK5P, 2XXW).
				if (!isValuePosition) {
					// Check if this scalar is the first non-whitespace on its line
					// by scanning the source text backwards. Mid-line scalars (e.g.,
					// after a tag/comma in FBC9) are not trailing.
					let isLineStart = true;
					for (let k = child.offset - 1; k >= 0; k--) {
						const ch = state.text[k];
						if (ch === "\n") break;
						if (ch === " " || ch === "\t") continue;
						isLineStart = false;
						break;
					}
					if (isLineStart) {
						let precededByIndicator = false;
						for (let p = i - 1; p >= 0; p--) {
							const prev = children[p];
							if (prev === undefined) continue;
							if (prev.type === "whitespace" && (prev.source === "-" || prev.source === "?")) {
								precededByIndicator = true;
								break;
							}
							if (prev.type === "whitespace" && prev.source.trim() === "") continue;
							if (prev.type === "newline") continue;
							break;
						}
						if (!precededByIndicator) {
							state.errors.push({
								code: "UnexpectedToken",
								message: "Trailing content in block mapping",
								offset: child.offset,
								length: child.length,
							});
						}
					}
				}
				// In value position for implicit mappings (key and ":" on the same line),
				// continuation lines must be indented more than the key column.
				// For explicit mappings (? key\n: value), don't constrain.
				const isImplicitMapping =
					isValuePosition &&
					lastKeyColumn >= 0 &&
					lastKeyOffset >= 0 &&
					lastValueSepOffset >= 0 &&
					sameLine(state.text, lastKeyOffset, lastValueSepOffset);
				const minContCol = isImplicitMapping ? lastKeyColumn + 1 : undefined;
				const { value, nextIdx, partsCount, endOffset } = collectMultilinePlainScalar(
					children,
					i,
					minContCol,
					minContCol !== undefined ? state.text : undefined,
				);
				const plainMeta = combinedPending();
				const resolved = resolveScalar(value, ["plain", plainMeta.tag, state]);
				const needsRaw = !P.isString(resolved) && resolved !== undefined && shouldPreserveRaw(value, resolved);
				const scalar = YamlScalar.make({
					value: resolved,
					style: "plain",
					offset: child.offset,
					// Span the whole folded scalar, not just the first fragment,
					// so findAtOffset covers continuation lines and the
					// sourceMultiline decoration pass sees the real extent.
					length: partsCount > 1 ? endOffset - child.offset : child.length,
					...O.getSomesStruct({ tag: O.fromUndefinedOr(plainMeta.tag) }),
					...O.getSomesStruct({ anchor: O.fromUndefinedOr(plainMeta.anchor) }),
					...(needsRaw ? { raw: value } : {}),
				});
				if (plainMeta.anchor !== undefined && plainMeta.anchor !== "")
					registerAnchor(scalar, plainMeta.anchor, state, child.offset);
				resetAllMeta();
				pushNode(scalar, child.offset);
				// After a truly MULTILINE plain scalar in value position (partsCount > 1
				// means multiple source lines were merged), if collectMultilinePlainScalar
				// stopped at a key at the SAME or deeper indent as the value, that's an
				// invalid nested mapping (HU3P). Keys at a lesser indent are sibling pairs
				// at the parent mapping level (valid, e.g. 4CQQ).
				if (isValuePosition && partsCount > 1) {
					const stoppedAtContent = findNextContentInList(children, nextIdx);
					if (stoppedAtContent !== null) {
						const sn = stoppedAtContent.node;
						const valueCol = lineCol(state.text, child.offset).column;
						const nextCol = lineCol(state.text, sn.offset).column;
						// Only flag if the next key is at same or deeper indent
						if (nextCol >= valueCol) {
							const isTrailingMapping =
								// scalar followed by ":"
								(sn.type === "flow-scalar" &&
									getScalarStyle(sn) === "plain" &&
									hasValueSepAfterInList(children, stoppedAtContent.idx + 1)) ||
								// scalar followed by block-map (key before nested mapping)
								(sn.type === "flow-scalar" &&
									getScalarStyle(sn) === "plain" &&
									(() => {
										const after = findNextContentInList(children, stoppedAtContent.idx + 1);
										return after !== null && after.node.type === "block-map";
									})()) ||
								// direct block-map (nested mapping without external key)
								sn.type === "block-map";
							if (isTrailingMapping) {
								state.errors.push({
									code: "UnexpectedToken",
									message: "Mapping key after multiline plain scalar value",
									offset: sn.offset,
									length: sn.length,
								});
							}
						}
					}
				}
				i = nextIdx - 1; // -1 because for-loop increments
				continue;
			}
			// Check for trailing content after quoted scalar in value position
			const style = getScalarStyle(child);
			const isValuePosition = afterValueSep;
			const scalarMeta = combinedPending();
			const scalar = makeScalar(child, state, hasMeta(scalarMeta) ? scalarMeta : undefined);
			resetAllMeta();
			pushNode(scalar, child.offset);

			if (isValuePosition && (style === "single-quoted" || style === "double-quoted")) {
				checkTrailingContentOnSameLine(children, i + 1, child, state);
				// QB6E: multi-line quoted scalar continuation must be indented past
				// the parent key column.
				validateQuotedScalarContinuationIndent(child, state, lastKeyColumn);
			}
			continue;
		}
		if (child.type === "alias") {
			commitOuterIfNewlineSeen();
			// Check if alias is followed by block-map (alias as first key of implicit mapping).
			// This pattern occurs when an alias is the FIRST key of a new block mapping that
			// appears as a sibling CST node (e.g., `*ref: value` where *ref is outside the
			// block-map). The pendingMeta anchor applies to the map, not the alias.
			// Note: `&b *alias : value` does NOT match this — the `:` is inside the same
			// block-map, so findNextContentInList returns the `:` (whitespace), not a block-map.
			// That case correctly falls through to checkAnchorOnAlias below.
			const nextAlias = findNextContentInList(children, i + 1);
			if (nextAlias?.node.type === "block-map") {
				// Like the scalar first-key path, split outer/pending: outer goes
				// to the new map, pending stays attached to the alias key.
				const alias = makeAlias(child, state);
				const aliasMapMeta = hasMeta(outerMeta) ? outerMeta : undefined;
				const map = composeBlockMap(nextAlias.node, state, alias, aliasMapMeta);
				resetAllMeta();
				pushNode(map);
				i = nextAlias.idx;
				continue;
			}
			// Standalone alias — check for invalid anchor on alias
			const aliasMeta = combinedPending();
			checkAnchorOnAlias(aliasMeta, child, state);
			const alias = makeAlias(child, state);
			resetAllMeta();
			pushNode(alias);
			continue;
		}
		if (child.type === "block-map") {
			commitOuterIfNewlineSeen();
			const mapMeta = combinedPending();
			// If the block-map starts with `:` (implicit empty key), the inner
			// pending meta belongs to that empty key, not to the block map.
			// Outer meta (from across a newline) still applies to the map.
			if (hasMeta(pendingMeta) && blockMapStartsWithValueSep(child)) {
				const emptyKey = YamlScalar.make({
					value: null,
					style: "plain",
					offset: child.offset,
					length: 0,
					...O.getSomesStruct({ tag: O.fromUndefinedOr(pendingMeta.tag) }),
					...O.getSomesStruct({ anchor: O.fromUndefinedOr(pendingMeta.anchor) }),
				});
				if (pendingMeta.anchor !== undefined && pendingMeta.anchor !== "")
					registerAnchor(emptyKey, pendingMeta.anchor, state, child.offset);
				const outerOnlyMeta = hasMeta(outerMeta) ? outerMeta : undefined;
				const map = composeBlockMap(child, state, emptyKey, outerOnlyMeta);
				resetAllMeta();
				pushNode(map);
				continue;
			}
			const map = composeBlockMap(child, state, undefined, hasMeta(mapMeta) ? mapMeta : undefined);
			resetAllMeta();
			pushNode(map);
			continue;
		}
		if (child.type === "block-seq") {
			commitOuterIfNewlineSeen();
			const seqMeta = combinedPending();
			// A non-empty block-seq appearing in key position (without `?`
			// explicit-key indicator) means the parser produced a structure
			// where a sequence is being treated as a key — that's invalid in
			// block context. Empty block-seqs are placeholders the parser
			// sometimes emits and should be ignored.
			if (!afterValueSep && pendingExplicitKeyCol < 0 && child.length > 0) {
				state.errors.push({
					code: "InvalidIndentation",
					message: "Sequence in mapping key position",
					offset: child.offset,
					length: child.length,
				});
			}
			const seq = composeBlockSeq(child, state, hasMeta(seqMeta) ? seqMeta : undefined);
			resetAllMeta();
			pushNode(seq);
			continue;
		}
		if (child.type === "flow-map") {
			commitOuterIfNewlineSeen();
			const isValue = afterValueSep;
			const flowMapMeta = combinedPending();
			const map = state.flow.composeFlowMap(
				child,
				state,
				hasMeta(flowMapMeta) ? flowMapMeta : undefined,
				lastKeyColumn,
			);
			resetAllMeta();
			pushNode(map);
			if (isValue) checkTrailingContentOnSameLine(children, i + 1, child, state);
			continue;
		}
		if (child.type === "flow-seq") {
			commitOuterIfNewlineSeen();
			const isValue = afterValueSep;
			const flowSeqMeta = combinedPending();
			const seq = state.flow.composeFlowSeq(
				child,
				state,
				hasMeta(flowSeqMeta) ? flowSeqMeta : undefined,
				lastKeyColumn,
			);
			resetAllMeta();
			pushNode(seq);
			if (isValue) checkTrailingContentOnSameLine(children, i + 1, child, state);
		}
	}
	// Flush trailing pending tag/anchor as empty scalar
	const trailingMeta = combinedPending();
	if (hasMeta(trailingMeta)) {
		const value = resolveScalar("", ["plain", trailingMeta.tag, state]);
		const scalar = YamlScalar.make({
			value,
			style: "plain",
			offset: 0,
			length: 0,
			...O.getSomesStruct({ tag: O.fromUndefinedOr(trailingMeta.tag) }),
			...O.getSomesStruct({ anchor: O.fromUndefinedOr(trailingMeta.anchor) }),
		});
		if (trailingMeta.anchor !== undefined && trailingMeta.anchor !== "")
			registerAnchor(scalar, trailingMeta.anchor, state, 0);
		items.push({ kind: "node", node: scalar });
	}
	return items;
});

/**
 * Build pairs from a semantic item stream.
 * Pattern: node, value-sep, node produces a key:value pair.
 * Pattern: node, value-sep (no node) produces a key:null pair.
 * Pattern: value-sep, node produces a null:value pair.
 *
 * Comment attribution: a comment on the same line as the end of the
 * previous pair attaches to it as the trailing `comment`; an own-line
 * comment attaches FORWARD to the next pair as `commentBefore` (consecutive
 * lines join with `\n`); a blank line before a pair (or before its
 * `commentBefore` block) sets `spaceBefore`. Own-line comments left over
 * after the last pair are returned so the caller can attach them as the
 * containing collection's trailing `comment`.
 */
export const buildPairs: {
	(pairs: YamlPair[], text: string, escaped?: Array<EscapedComment>): (items: SemanticItem[]) => string | undefined;
	(items: SemanticItem[], pairs: YamlPair[], text: string, escaped?: Array<EscapedComment>): string | undefined;
} = dual((args) => A.isArray(args[1]), (items: SemanticItem[], pairs: YamlPair[], text: string, escaped?: Array<EscapedComment>): string | undefined => {
	let i = 0;
	// Forward-attribution state: own-line comment parts and blank-line flag
	// pending for the NEXT pair. Parts keep their offsets so the terminal
	// leftovers can be column-partitioned (kept vs escaped to the outer scope).
	interface PendingComment {
		text: string;
		offset: number;
		blankAbove: boolean;
	}
	let pending: PendingComment[] = [];
	let pendingSpace = false;
	// End offset of the last completed pair's content (-1 before the first),
	// and the content node it belongs to — the anchor for the keep-chomp
	// blank-line gate (a blank inside a `|+` scalar's span is VALUE, not style).
	let lastEnd = -1;
	let lastNode: YamlNode | undefined;
	// Column of this mapping's first key — the yardstick for the terminal
	// column partition. -1 until the first key is seen.
	let contentColumn = -1;

	const nodeEnd = (n: YamlNode): number => n.offset + n.length;

	/**
	 * Rebuild `pair` with `text` appended to the trailing comment of whichever
	 * node owns the pair's last line: the value when present, otherwise the key.
	 */
	const withTrailingComment = (pair: YamlPair, text: string, onKey = false): YamlPair =>
		pair.value !== null && !onKey
			? YamlPair.make({ key: pair.key, value: withCommentFields(pair.value, { comment: text }) })
			: YamlPair.make({ key: withCommentFields(pair.key, { comment: text }), value: pair.value });

	/**
	 * Finish a pair: the pending leading fields go to its KEY node, the entry's
	 * trailing comment to whichever node owns the last line. The one place the
	 * node-level split is applied, so no construction site has to know it.
	 */
	const pushPair = (
		pair: YamlPair,
		leading: CommentFields,
		trailing: string | undefined,
		trailingOnKey = false,
	): YamlPair => {
		const withLeading =
			R.keys<string, unknown>({ ...leading }).length === 0
				? pair
				: YamlPair.make({ key: withCommentFields(pair.key, leading), value: pair.value });
		return trailing === undefined ? withLeading : withTrailingComment(withLeading, trailing, trailingOnKey);
	};

	const noteContentColumn = (offset: number): void => {
		if (contentColumn < 0 && offset >= 0) contentColumn = columnAt(text, offset);
	};

	/** Join pending parts: `\n` between lines, an extra `\n` per embedded blank. */
	const joinPending = (parts: ReadonlyArray<PendingComment>): string | undefined => {
		const [first, ...rest] = parts;
		if (first === undefined) return undefined;
		let out = first.text;
		for (const part of rest) {
			out += part.blankAbove ? `\n\n${part.text}` : `\n${part.text}`;
		}
		return out;
	};

	/** The pending comment fields for the pair being constructed, then reset. */
	const takePendingFields = (anchorOffset: number): CommentFields => {
		let commentBefore = joinPending(pending);
		if (anchorOffset >= 0 && hasBlankLineAbove(text, anchorOffset)) {
			if (commentBefore !== undefined) {
				// A blank line between the comment run and the node embeds as a
				// trailing empty line in the comment string (reference parity).
				commentBefore = `${commentBefore}\n`;
			} else if (!pendingSpace && lastEnd >= 0 && !blankAboveIsKeepChompContent(text, anchorOffset, lastNode)) {
				pendingSpace = true;
			}
		}
		const fields: CommentFields = {
			...O.getSomesStruct({ commentBefore: O.fromUndefinedOr(commentBefore) }),
			...(pendingSpace ? { spaceBefore: true } : {}),
		};
		pending = [];
		pendingSpace = false;
		return fields;
	};

	while (i < items.length) {
		const item = items[i];
		if (item === undefined) {
			i++;
			continue;
		}
		if (item.kind === "comment") {
			const cOff = item.offset ?? -1;
			const cText = item.comment ?? "";
			// Own-line vs trailing is decided purely from the comment's own
			// line (content before it or not) — span-based checks mislead when
			// a preceding block collection's span over-extends.
			// An indicator-only prefix (`? # c`, `- # c`) still means the node is
			// below, so the comment LEADS it rather than trailing the entry
			// before it.
			const ownLine = cOff < 0 ? true : isOwnLineAt(text, cOff) || isAfterIndicatorOnly(text, cOff);
			if (!ownLine && pairs.length > 0) {
				// Trailing: content precedes the comment on its line, so it belongs
				// to the node that owns that line — the value when there is one,
				// otherwise the key (divergence 1 in comments.ts).
				const last = pairs[pairs.length - 1];
				if (last !== undefined) {
					pairs[pairs.length - 1] = withTrailingComment(last, cText);
				}
			} else {
				// Own-line: attribute forward to the next pair. A blank line
				// before the FIRST comment of a run becomes spaceBefore; a
				// blank line WITHIN the run embeds as an empty line in the
				// joined comment string (reference parity).
				const blankAbove =
					cOff >= 0 && hasBlankLineAbove(text, cOff) && !blankAboveIsKeepChompContent(text, cOff, lastNode);
				if (blankAbove && pending.length === 0 && lastEnd >= 0) {
					pendingSpace = true;
				}
				pending.push({ text: cText, offset: cOff, blankAbove: blankAbove && pending.length > 0 });
			}
			i++;
			continue;
		}
		if (item.kind === "value-sep") {
			// value-sep without preceding key: implicit null key
			const valueSepOffset = item.offset ?? 0;
			i++;
			const pendingFields = takePendingFields(valueSepOffset);
			// Peek ahead: if the next non-comment node is followed by a
			// value-sep AND is on a different line, it's a KEY for the next
			// pair, not our value. This prevents greedily consuming
			// `"quoted key":` as the value of a preceding null-key entry
			// (S3PD) while preserving rejection of `a: b: c: d` (ZCZ6).
			// Anchor the synthetic null key at its `:` indicator so diagnostics
			// that point at the key (e.g. DuplicateKey) carry a real position
			// instead of 0:0.
			noteContentColumn(valueSepOffset);
			const valueNode = consumeValueNodeForNullKey(items, i, text, valueSepOffset);
			const nullKey = YamlScalar.make({
				value: null,
				style: "plain",
				offset: valueSepOffset,
				length: 0,
			});
			if (valueNode !== null) {
				pairs.push(pushPair(YamlPair.make({ key: nullKey, value: valueNode.node ?? null }), pendingFields, undefined));
				i = valueNode.nextIdx;
				lastEnd = valueNode.node !== null ? nodeEnd(valueNode.node) : valueSepOffset + 1;
				lastNode = valueNode.node ?? undefined;
			} else {
				pairs.push(pushPair(YamlPair.make({ key: nullKey, value: null }), pendingFields, undefined));
				lastEnd = valueSepOffset + 1;
				lastNode = undefined;
			}
			continue;
		}
		if (item.kind === "node" || item.kind === "key") {
			let keyNode = item.node;
			i++;
			// For explicit key markers (? in flow), consume the next node as the key
			if (item.kind === "key" && keyNode === undefined) {
				while (i < items.length && items[i]?.kind === "comment") i++;
				if (i < items.length && items[i]?.kind === "node") {
					const next = items[i];
					keyNode = next?.kind === "node" ? next.node : undefined;
					i++;
				}
			}
			if (keyNode !== undefined) noteContentColumn(keyNode.offset);
			const pendingFields = takePendingFields(keyNode !== undefined ? keyNode.offset : -1);
			// Comments between key and value-sep (e.g., ? key # comment\n: value)
			// attach to the pair's trailing comment — they have no own construct
			// in the pair model.
			let pairTrailing: string | undefined;
			while (i < items.length && items[i]?.kind === "comment") {
				const commentItem = items[i];
				const c = commentItem?.kind === "comment" ? commentItem.comment : undefined;
				if (c !== undefined) pairTrailing = joinComments(pairTrailing, c);
				i++;
			}
			const keyOrNull = (): YamlNode =>
				keyNode ?? YamlScalar.make({ value: null, style: "plain", offset: 0, length: 0 });
			// Look for value-sep
			if (i < items.length && items[i]?.kind === "value-sep") {
				const separator = items[i];
				const sepOffset =
					separator?.kind === "value-sep" ? separator.offset : keyNode !== undefined ? nodeEnd(keyNode) : 0;
				i++; // skip value-sep
				const valueResult = consumeValueNode(items, i, text, sepOffset);
				if (valueResult !== null) {
					// Comments between the `:` and the value: same-line comments
					// are the pair's trailing comment; own-line comments lead the
					// value node.
					for (const c of valueResult.sameLineComments) pairTrailing = joinComments(pairTrailing, c);
					let valNode = valueResult.node;
					if (valNode !== null && valueResult.leadingComments.length > 0) {
						valNode = withCommentFields(valNode, { commentBefore: valueResult.leadingComments.join("\n") });
					}
					pairs.push(
						pushPair(
							YamlPair.make({ key: keyOrNull(), value: valNode }),
							pendingFields,
							pairTrailing,
							// Decided from the COMPOSED value: when it does not sit on
							// the `:` line, that line belongs to the key — but only in
							// implicit `key: value` form. A complex key renders as
							// `? key` / `: value`, where the `:` line is not the key's
							// line at all, so the comment stays with the value there.
							keyIsSimple(keyNode) && (valNode === null || !sameLineSpan(text, sepOffset, valNode.offset)),
						),
					);
					i = valueResult.nextIdx;
					lastEnd = valNode !== null ? nodeEnd(valNode) : sepOffset + 1;
					lastNode = valNode ?? undefined;
				} else {
					pairs.push(pushPair(YamlPair.make({ key: keyOrNull(), value: null }), pendingFields, pairTrailing));
					lastEnd = sepOffset + 1;
					lastNode = undefined;
				}
			} else {
				// Key with no value
				pairs.push(pushPair(YamlPair.make({ key: keyOrNull(), value: null }), pendingFields, pairTrailing));
				lastEnd = keyNode !== undefined ? nodeEnd(keyNode) : lastEnd;
				if (keyNode !== undefined) lastNode = keyNode;
			}
			continue;
		}
		i++;
	}
	// Own-line comments after the last pair: terminal comments at (or beyond)
	// the mapping's content column become the collection's trailing comment;
	// SHALLOWER ones belong to an outer scope and escape (reference parity —
	// a column-0 `# tail` after a nested block documents the next outer key).
	// A blank line between the last pair and the terminal run embeds as a
	// LEADING empty line in the joined string — the mirror of the
	// trailing-blank embed on a `commentBefore` run.
	if (pending.length === 0) return undefined;
	const withLeadingBlank = (parts: ReadonlyArray<PendingComment>): string | undefined => {
		const joined = joinPending(parts);
		const first = parts[0];
		return joined !== undefined &&
			first !== undefined &&
			lastEnd >= 0 &&
			first.offset >= 0 &&
			hasBlankLineAbove(text, first.offset) &&
			!blankAboveIsKeepChompContent(text, first.offset, lastNode)
			? `\n${joined}`
			: joined;
	};
	if (escaped !== undefined && contentColumn > 0) {
		const kept: PendingComment[] = [];
		for (const part of pending) {
			if (part.offset >= 0 && columnAt(text, part.offset) < contentColumn) {
				escaped.push({ text: part.text, offset: part.offset });
			} else {
				kept.push(part);
			}
		}
		return withLeadingBlank(kept);
	}
	return withLeadingBlank(pending);
});

/**
 * True when a key renders in implicit `key: value` form, so the `:` sits on
 * the key's own line. A multi-line or block-scalar key forces the explicit
 * `? key` / `: value` spelling, where the `:` gets a line of its own.
 */
function keyIsSimple(keyNode: YamlNode | undefined): boolean {
	// An alias key emits in implicit form (`*x : value`), so it owns its line
	// exactly as a plain scalar key does and can carry a trailing comment.
	if (isYamlAlias(keyNode)) return true;
	if (!isYamlScalar(keyNode)) return false;
	if (P.isString(keyNode.value) && keyNode.value.includes("\n")) return false;
	return keyNode.style !== "block-literal" && keyNode.style !== "block-folded";
}

interface ConsumedValue {
	node: YamlNode | null;
	nextIdx: number;
	/** Comments on the value-sep's line, before the value. */
	sameLineComments: string[];
	/** Own-line comments between the value-sep and the value. */
	leadingComments: string[];
}

function consumeValueNode(
	items: SemanticItem[],
	startIdx: number,
	text: string,
	sepOffset: number,
): ConsumedValue | null {
	// Peek past comments to the first node WITHOUT consuming anything: a node
	// on a LATER line than our `:` that is immediately followed by its own
	// value-sep is the next pair's KEY, not this pair's value — the pending
	// pair's value is empty/null (`key:\nother: 1` composed `other` as
	// the value of `key` and then paired the orphaned `:` with an empty key).
	// Same-line nodes stay consumed so `a: b: c: d` keeps its original,
	// error-flagged pairing (ZCZ6). Mirrors consumeValueNodeForNullKey (S3PD).
	// Returning null consumes nothing, so any comments re-enter the main loop
	// and attribute to the surrounding pairs as usual.
	let peek = startIdx;
	while (peek < items.length && items[peek]?.kind === "comment") peek++;
	const candidate = peek < items.length ? items[peek] : undefined;
	if (
		candidate?.kind === "node" &&
		peek + 1 < items.length &&
		items[peek + 1]?.kind === "value-sep" &&
		candidate.node !== undefined &&
		text.slice(sepOffset, candidate.node.offset).includes("\n")
	) {
		return null;
	}
	let i = startIdx;
	const sameLineComments: string[] = [];
	const leadingComments: string[] = [];
	// Index of the first OWN-LINE comment after the `:` — the rewind point when
	// it turns out no value node follows.
	let firstOwnLineIdx = -1;
	while (i < items.length) {
		const item = items[i];
		if (item === undefined) break;
		if (item.kind === "comment") {
			const cText = item.comment ?? "";
			if (item.offset !== undefined && sameLineSpan(text, sepOffset, item.offset)) {
				sameLineComments.push(cText);
			} else {
				if (firstOwnLineIdx < 0) firstOwnLineIdx = i;
				leadingComments.push(cText);
			}
			i++;
			continue;
		}
		if (item.kind === "node") {
			// Whether the value shares the `:` line decides who owns that line's
			// comment slot: the VALUE when it ends there (`a: 1 # t`), the KEY
			// when the value sits below (`a: # kc`). Keeping the two apart is
			// what lets both source shapes round-trip — a key-line comment and a
			// comment on its own line above the value are different bytes and
			// must stay different fields.
			return { node: item.node ?? null, nextIdx: i + 1, sameLineComments, leadingComments };
		}
		break;
	}
	// No value node follows, so these own-line comments never had a value
	// to lead — they belong to the enclosing mapping (its terminal comment run,
	// or the next pair's `commentBefore`). Consuming them here dropped them on
	// the floor, because the caller can only attach `leadingComments` to a value
	// node that exists. Rewind to the first of them and let the caller's own
	// forward-attribution and terminal column partition decide. Same-line
	// comments stay consumed — they are the pair's trailing comment.
	if (firstOwnLineIdx >= 0) {
		return { node: null, nextIdx: firstOwnLineIdx, sameLineComments, leadingComments: [] };
	}
	return i > startIdx ? { node: null, nextIdx: i, sameLineComments, leadingComments } : null;
}

/**
 * Like consumeValueNode but for implicit null-key entries (`: value`).
 * If the next non-comment node is immediately followed by a value-sep
 * AND is on a different line from the null key's `:`, it's actually a
 * KEY for the next pair, not our value — return null so the null key
 * gets a null value. When on the same line (e.g. `a: b: c: d`), consume
 * normally to preserve the original pairing (which may produce duplicate
 * keys that get rejected).
 */
function consumeValueNodeForNullKey(
	items: SemanticItem[],
	startIdx: number,
	text: string,
	valueSepOffset: number,
): { node: YamlNode | null; nextIdx: number } | null {
	let i = startIdx;
	// Index of the first OWN-LINE comment after the `:` — the rewind point when
	// no value node follows (mirrors consumeValueNode, and matters here
	// for the empty-key document `:\n# c\n`).
	let firstOwnLineIdx = -1;
	while (i < items.length) {
		const item = items[i];
		if (item === undefined) break;
		if (item.kind === "comment") {
			if (firstOwnLineIdx < 0 && item.offset !== undefined && !sameLineSpan(text, valueSepOffset, item.offset)) {
				firstOwnLineIdx = i;
			}
			i++;
			continue;
		}
		if (item.kind === "node") {
			if (i + 1 < items.length && items[i + 1]?.kind === "value-sep") {
				// Check if the candidate node is on a different line from the
				// null key's value-sep. Only refuse to consume cross-line nodes.
				const nodeOffset = item.node !== undefined && "offset" in item.node ? item.node.offset : 0;
				const hasNewline = text.slice(valueSepOffset, nodeOffset).includes("\n");
				if (hasNewline) {
					// Cross-line: this node is a key for the next pair, not our value.
					break;
				}
			}
			return { node: item.node ?? null, nextIdx: i + 1 };
		}
		break;
	}
	// No value node followed: leave the own-line comments to the caller's own
	// attribution rather than consuming them into nothing.
	if (firstOwnLineIdx >= 0) return { node: null, nextIdx: firstOwnLineIdx };
	return i > startIdx ? { node: null, nextIdx: i } : null;
}

/**
 * Canonical duplicate-key identity for a scalar key. Two keys collide only if
 * they are the same YAML node: same type *and* value. Resolved JS values alone
 * are ambiguous for numbers — `!!int 1` and `!!float 1.0` both become the JS
 * number `1` yet are distinct keys — so the number branch disambiguates int
 * from float via the source form (or an explicit tag). String/bool/null keys
 * are distinguished by their type prefix, so `1` (int) never collides with
 * `"1"` (string) or `true`.
 */
export const keyIdentity: {
	(text: string): (key: YamlScalar) => string;
	(key: YamlScalar, text: string): string;
} = dual(2, (key: YamlScalar, text: string): string => {
	const v = key.value;
	if (v === null) return "null";
	return Match.value(v).pipe(
		Match.when(P.isBoolean, (value) => `b:${value}`),
		Match.when(P.isString, (value) => `s:${value}`),
		Match.when(P.isBigInt, (value) => `i:${value.toString()}`),
		Match.when(P.isNumber, (value) => {
			const raw = text.slice(key.offset, key.offset + key.length).trim();
			let kind = classifyPlainNumeric(raw);
			if (key.tag !== undefined) {
				if (key.tag.includes("float")) kind = "float";
				else if (key.tag.includes("int")) kind = "int";
			}
			return `${kind === "float" ? "f" : "i"}:${value}`;
		}),
		Match.orElse((value) => `o:${String(value)}`),
	);
});

export const checkDuplicateKeys: {
	(state: ComposerState): (pairs: YamlPair[]) => void;
	(pairs: YamlPair[], state: ComposerState): void;
} = dual(2, (pairs: YamlPair[], state: ComposerState): void => {
	const seen = MutableHashSet.empty<string>();
	for (const pair of pairs) {
		if (isYamlScalar(pair.key)) {
			const id = keyIdentity(pair.key, state.text);
			if (MutableHashSet.has(seen, id)) {
				state.warnings.push({
					code: "DuplicateKey",
					message: `Duplicate key: ${String(pair.key.value)}`,
					offset: pair.key.offset,
					length: pair.key.length,
				});
			}
			MutableHashSet.add(seen, id);
		}
	}
});

/**
 * Inspect the slice of children after a `?` indicator to decide how the
 * explicit key should be composed.
 *
 * - `terminated` — found a matching `:` at `qCol`; the key is the slice
 *   between `?` and that `:`. Existing per-node logic handles this.
 * - `inline-implicit-map` — no matching `:` at `qCol`, but the slice
 *   contains a `:` at a deeper column. The whole slice is a compact
 *   inline implicit-map key (M2N8/00, M2N8/01).
 * - `simple` — no internal `:` at all; the next content node is the
 *   single key (KK5P, M5DY block-seq keys; plain scalar keys).
 */
function scanExplicitKeyShape(
	children: readonly CstNode[],
	qIdx: number,
	qCol: number,
	text: string,
): { kind: "terminated"; matchIdx: number } | { kind: "inline-implicit-map"; endIdx: number } | { kind: "simple" } {
	const qChild = children[qIdx];
	const qLine = qChild !== undefined ? lineCol(text, qChild.offset).line : -1;
	let inlineColonOnQLine = false;
	let endIdx = children.length;
	for (let j = qIdx + 1; j < children.length; j++) {
		const c = children[j];
		if (c === undefined) continue;
		if (c.type === "whitespace" && c.source === ":") {
			const cCol = lineCol(text, c.offset).column;
			if (cCol === qCol) {
				return { kind: "terminated", matchIdx: j };
			}
			// Only count as an inline-implicit-map indicator if it's on the
			// same line as `?`. A `:` on a later line is a sibling pair's
			// implicit-key separator, not part of the explicit key (7W2P,
			// ZWK4).
			const cLine = lineCol(text, c.offset).line;
			if (cLine === qLine) inlineColonOnQLine = true;
		}
		// Stop scanning once we hit a sibling `?` at the same column — a new
		// explicit key starts there.
		if (c.type === "whitespace" && c.source === "?") {
			const cCol = lineCol(text, c.offset).column;
			if (cCol === qCol) {
				endIdx = j;
				break;
			}
		}
	}
	if (inlineColonOnQLine) return { kind: "inline-implicit-map", endIdx };
	return { kind: "simple" };
}

/**
 * Returns true if a value at the given offset was introduced by a `?`
 * explicit-key indicator. Scans backward through whitespace and newlines
 * looking for a `?` at the start of a line (not part of a scalar).
 *
 * Named verbosely to avoid colliding with the local `isExplicitKey`
 * boolean in `flattenBlockMapChildren` (used for multi-line key
 * continuation detection — different concept).
 */
function wasIntroducedByExplicitKeyIndicator(text: string, offset: number): boolean {
	let i = offset - 1;
	while (i >= 0) {
		const ch = text[i];
		if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
			i--;
			continue;
		}
		// Found a non-whitespace char. If it's `?` and either at offset 0
		// or preceded by whitespace/newline, this is the explicit-key
		// indicator.
		if (ch === "?") {
			if (i === 0) return true;
			const prev = text[i - 1];
			return prev === " " || prev === "\t" || prev === "\n" || prev === "\r";
		}
		return false;
	}
	return false;
}

/**
 * Validate that implicit mapping keys do not span multiple lines.
 * YAML 1.2 §7.4.2 requires implicit keys to fit on a single line.
 */
export const checkMultilineImplicitKeys: {
	(state: ComposerState, items?: readonly SemanticItem[]): (pairs: readonly YamlPair[]) => void;
	(pairs: readonly YamlPair[], state: ComposerState, items?: readonly SemanticItem[]): void;
} = dual((args) => A.isArray(args[0]), (pairs: readonly YamlPair[], state: ComposerState, items?: readonly SemanticItem[]): void => {
	// Check quoted scalar keys for newlines — quoted scalars (single/double)
	// have CST spans that include the newline when they span multiple lines.
	// Only check quoted styles; plain scalars in block context have single-line
	// CST spans and explicit keys (?) are allowed to be multiline.
	for (const pair of pairs) {
		const key = pair.key;
		if (key.length === 0) continue; // synthetic null key
		// Quoted scalars: check the source span for newlines.
		if (key._tag === "YamlScalar") {
			const s = key.style;
			if (s !== "single-quoted" && s !== "double-quoted") continue;
			const keySource = state.text.slice(key.offset, key.offset + key.length);
			if (keySource.includes("\n") || keySource.includes("\r")) {
				state.errors.push({
					code: "UnexpectedToken",
					message: "Implicit mapping key must not span multiple lines",
					offset: key.offset,
					length: key.length,
				});
			}
			continue;
		}
		// Flow collections (YamlMap/YamlSeq with style=flow) cannot be used as
		// implicit keys when their source spans multiple lines (C2SP). Skip
		// when the key was introduced by an explicit `?` indicator — explicit
		// keys are allowed to span multiple lines (M5DY).
		if (key._tag === "YamlMap" || key._tag === "YamlSeq") {
			if (key.style !== "flow") continue;
			if (wasIntroducedByExplicitKeyIndicator(state.text, key.offset)) continue;
			const keySource = state.text.slice(key.offset, key.offset + key.length);
			if (keySource.includes("\n") || keySource.includes("\r")) {
				state.errors.push({
					code: "UnexpectedToken",
					message: "Implicit mapping key must not span multiple lines",
					offset: key.offset,
					length: key.length,
				});
			}
		}
	}

	// In flow context, also check if key and value-sep (:) are on different lines
	if (items === undefined) return;
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item === undefined) continue;
		if (item.kind !== "node" && item.kind !== "key") continue;
		const node = item.node;
		if (node?._tag !== "YamlScalar" || node.length === 0) continue;
		// Look ahead for value-sep
		let j = i + 1;
		while (j < items.length && items[j]?.kind === "comment") j++;
		const next = items[j];
		if (next?.kind !== "value-sep" || next.offset === undefined) continue;
		const keyEndLine = lineCol(state.text, node.offset + node.length - 1).line;
		const sepLine = lineCol(state.text, next.offset).line;
		if (keyEndLine !== sepLine) {
			state.errors.push({
				code: "UnexpectedToken",
				message: "Implicit mapping key and value indicator must be on the same line",
				offset: node.offset,
				length: node.length,
			});
		}
	}
});

/**
 * Check for non-trivial CST content on the same line after a completed value node.
 * Used to detect trailing content after quoted scalars and flow collections.
 * Skips if the next non-trivia content is a ":" (value-sep), since that means
 * this node is actually a key, not a value.
 */
export const checkTrailingContentOnSameLine: {
	(startIdx: number, valueNode: CstNode, state: ComposerState): (children: readonly CstNode[]) => void;
	(children: readonly CstNode[], startIdx: number, valueNode: CstNode, state: ComposerState): void;
} = dual(4, (children: readonly CstNode[], startIdx: number, valueNode: CstNode, state: ComposerState): void => {
	const valueEnd = valueNode.offset + valueNode.length;
	for (let j = startIdx; j < children.length; j++) {
		const next = children[j];
		if (next === undefined) continue;
		if (next.type === "newline") break;
		if (next.type === "comment") break; // comments are allowed
		if (next.type === "whitespace") {
			if (next.source === ":") break; // this scalar is a key, not a value
			if (next.source.trim() === "") continue;
		}
		// Non-trivial content — check if on same line
		if (sameLine(state.text, valueEnd - 1, next.offset)) {
			state.errors.push({
				code: "UnexpectedToken",
				message: "Trailing content after value on same line",
				offset: next.offset,
				length: next.length,
			});
		}
		break;
	}
});

/**
 * QB6E: continuation lines of a multi-line quoted scalar in value position
 * must be indented past the parent key column.
 */
function validateQuotedScalarContinuationIndent(scalar: CstNode, state: ComposerState, parentKeyColumn: number): void {
	if (parentKeyColumn < 0) return;
	const text = state.text;
	const start = scalar.offset;
	const end = scalar.offset + scalar.length;
	let i = start;
	let inLineStart = false;
	let lineStart = -1;
	while (i < end && i < text.length) {
		const ch = text[i];
		if (ch === "\n") {
			inLineStart = true;
			lineStart = i + 1;
			i++;
			continue;
		}
		if (inLineStart) {
			if (ch === " " || ch === "\t") {
				i++;
				continue;
			}
			const col = i - lineStart;
			if (col <= parentKeyColumn) {
				state.errors.push({
					code: "InvalidIndentation",
					message: "Multi-line quoted scalar continuation must be indented past the parent key",
					offset: i,
					length: 1,
				});
				return;
			}
			inLineStart = false;
		}
		i++;
	}
}

/**
 * 4JVG: a single scalar cannot have two anchor declarations. When the
 * outer-meta slot and the pending-meta slot both carry an anchor, AND the
 * scalar is being consumed as a plain value (not as a key for a nested
 * block-map, not followed by `:`), both anchors would collapse onto the
 * scalar — that's invalid YAML.
 */
function validateNoDoubleAnchorOnScalar(
	scalar: CstNode,
	children: readonly CstNode[],
	idx: number,
	outerMeta: NodeMeta,
	pendingMeta: NodeMeta,
	state: ComposerState,
): void {
	if (outerMeta.anchor === undefined || pendingMeta.anchor === undefined) return;
	// Skip when the scalar is a key (followed by `:` or by a block-map sibling).
	if (hasValueSepAfterInList(children, idx + 1)) return;
	const nextContent = findNextContentInList(children, idx + 1);
	if (nextContent?.node.type === "block-map" && !hasValueSepBetween(children, idx + 1, nextContent.idx)) {
		return;
	}
	state.errors.push({
		code: "UnexpectedToken",
		message: "Scalar cannot have two anchor declarations",
		offset: scalar.offset,
		length: scalar.length,
	});
}

/**
 * Y79Y/009: when a `:` value-sep is at the start of a line (continuation
 * line, not on the same line as a key) and is immediately followed by a
 * tab and same-line content, the tab is being used as block indentation
 * for the upcoming content — invalid per YAML 1.2 §6.1.
 */
function validateNoTabAfterContinuationValueSep(
	colonChild: CstNode,
	children: readonly CstNode[],
	idx: number,
	state: ComposerState,
): void {
	// Only when `:` is the first non-whitespace on its line — this covers
	// both column 0 (Y79Y/009) and nested mappings where the value indicator
	// sits at the start of a continuation line at any indent.
	const col = lineCol(state.text, colonChild.offset).column;
	if (col !== lineIndentColumn(state.text, colonChild.offset)) return;
	// Find the next non-whitespace child on the same line.
	let sawTab = false;
	for (let j = idx + 1; j < children.length; j++) {
		const c = children[j];
		if (c === undefined) continue;
		if (c.type === "newline") return;
		if (c.type === "whitespace") {
			if (c.source.includes("\t")) sawTab = true;
			continue;
		}
		// Found a non-whitespace child — only flag if a tab was seen between.
		if (sawTab && sameLine(state.text, colonChild.offset, c.offset)) {
			state.errors.push({
				code: "TabIndentation",
				message: "Tab character cannot be used as indentation after a value indicator",
				offset: colonChild.offset,
				length: colonChild.length,
			});
		}
		return;
	}
}

/**
 * Returns true when the upcoming "-" indicator is preceded (after only
 * whitespace/newlines) by either an empty block-seq placeholder or a
 * `?`-only block-map. The parser uses both shapes to mark "explicit key
 * with a sequence as the key" (KK5P fixture).
 */
function precededByExplicitKeyMarker(children: readonly CstNode[], idx: number): boolean {
	for (let j = idx - 1; j >= 0; j--) {
		const c = children[j];
		if (c === undefined) continue;
		if (c.type === "whitespace" || c.type === "newline" || c.type === "comment") continue;
		if (c.type === "block-seq" && c.length === 0) return true;
		if (c.type === "block-map" && c.source.trimEnd() === "?") return true;
		return false;
	}
	return false;
}

/**
 * G9HC, H7J7: anchor/tag in value position on a continuation line (not on
 * the same line as `:`) must be at a column strictly greater than the
 * parent key's column. Per YAML 1.2 §8.1.2, properties before a block
 * collection must be at indent n+1, where n is the parent key column.
 */
function validatePropertyContinuationColumn(
	property: CstNode,
	state: ComposerState,
	afterValueSep: boolean,
	lastValueSepOffset: number,
	parentKeyColumn: number,
): void {
	if (!afterValueSep) return;
	if (parentKeyColumn < 0) return;
	// On the same line as `:` is always OK.
	if (lastValueSepOffset >= 0 && sameLine(state.text, lastValueSepOffset, property.offset)) {
		return;
	}
	const col = lineCol(state.text, property.offset).column;
	if (col <= parentKeyColumn) {
		state.errors.push({
			code: "InvalidIndentation",
			message: "Property (anchor or tag) must be indented past the parent key",
			offset: property.offset,
			length: property.length,
		});
	}
}

// ---------------------------------------------------------------------------
// Compose block seq
// ---------------------------------------------------------------------------

export const composeBlockSeq: {
	(state: ComposerState, meta?: NodeMeta): (cst: CstNode) => YamlSeq;
	(cst: CstNode, state: ComposerState, meta?: NodeMeta): YamlSeq;
} = dual((args) => P.hasProperty(args[0], "source"), (cst: CstNode, state: ComposerState, meta?: NodeMeta): YamlSeq => {
	// Nesting-depth guard: unbounded recursion is a stack-overflow DoS vector.
	if (!enterNesting(state, cst)) {
		return YamlSeq.make({ items: [], style: "block", offset: cst.offset, length: cst.length });
	}
	try {
		return composeBlockSeqInner(cst, state, meta);
	} finally {
		exitNesting(state);
	}
});

function composeBlockSeqInner(cst: CstNode, state: ComposerState, meta?: NodeMeta): YamlSeq {
	const children = cst.children ?? [];
	const rawItems: YamlNode[] = [];
	let pendingMeta: NodeMeta = {};
	let sawEntry = false;
	const seqIndent = lineIndentColumn(state.text, cst.offset);
	// Track whether a newline appeared between the most-recent pending tag/anchor
	// and the upcoming content. When true, the meta belongs to the resulting
	// collection (outer scope), not to the first key/scalar within it. This
	// mirrors the outer/inner meta split in flattenBlockMapChildren.
	let sawNewlineSincePending = false;

	// Comment attribution, mirroring buildPairs: own-line comments
	// attach forward to the next item as `commentBefore`; a comment on the
	// same line as the end of the previous item attaches as its trailing
	// `comment`; a blank line before an item sets `spaceBefore`; terminal
	// leftovers at (or beyond) the sequence's indent become its trailing
	// comment, SHALLOWER ones escape to the outer scope.
	interface PendingSeqComment {
		text: string;
		offset: number;
		blankAbove: boolean;
	}
	let pending: PendingSeqComment[] = [];
	let pendingSpace = false;
	let lastItemEnd = -1;
	// The last pushed item node — the anchor for the keep-chomp blank-line
	// gate (a blank inside a `|+` item's span is VALUE, not style).
	let lastItemNode: YamlNode | undefined;
	const joinPending = (parts: ReadonlyArray<PendingSeqComment>): string | undefined => {
		const [first, ...rest] = parts;
		if (first === undefined) return undefined;
		let out = first.text;
		for (const part of rest) {
			out += part.blankAbove ? `\n\n${part.text}` : `\n${part.text}`;
		}
		return out;
	};
	const acceptOwnLineComment = (cText: string, cOff: number): void => {
		const blankAbove =
			cOff >= 0 && hasBlankLineAbove(state.text, cOff) && !blankAboveIsKeepChompContent(state.text, cOff, lastItemNode);
		if (blankAbove && pending.length === 0 && lastItemEnd >= 0) {
			pendingSpace = true;
		}
		pending.push({ text: cText, offset: cOff, blankAbove: blankAbove && pending.length > 0 });
	};
	const items = {
		get length(): number {
			return rawItems.length;
		},
		push(node: YamlNode): void {
			let commentBefore = joinPending(pending);
			if (node.length > 0 && hasBlankLineAbove(state.text, node.offset)) {
				if (commentBefore !== undefined) {
					commentBefore = `${commentBefore}\n`;
				} else if (
					!pendingSpace &&
					lastItemEnd >= 0 &&
					!blankAboveIsKeepChompContent(state.text, node.offset, lastItemNode)
				) {
					pendingSpace = true;
				}
			}
			let decorated = node;
			if (commentBefore !== undefined || pendingSpace) {
				decorated = withCommentFields(node, {
					...O.getSomesStruct({ commentBefore: O.fromUndefinedOr(commentBefore) }),
					...(pendingSpace ? { spaceBefore: true } : {}),
				});
			}
			pending = [];
			pendingSpace = false;
			rawItems.push(decorated);
			lastItemEnd = node.offset + node.length;
			lastItemNode = node;
			// Re-inject comments escaped by a nested compose — see pushNode.
			if (state.escapedComments.length > 0) {
				for (const ec of state.escapedComments) acceptOwnLineComment(ec.text, ec.offset);
				state.escapedComments.length = 0;
			}
		},
	};

	for (let ci = 0; ci < children.length; ci++) {
		const child = children[ci];
		if (child === undefined) continue;
		if (child.type === "newline") {
			if (hasMeta(pendingMeta)) sawNewlineSincePending = true;
			continue;
		}
		if (child.type === "comment") {
			const cText = rawCommentText(child.source);
			if (rawItems.length > 0 && !isOwnLineAt(state.text, child.offset)) {
				const prev = rawItems[rawItems.length - 1];
				if (prev !== undefined) rawItems[rawItems.length - 1] = withCommentFields(prev, { comment: cText });
			} else {
				acceptOwnLineComment(cText, child.offset);
			}
			continue;
		}
		if (child.type === "whitespace") {
			// "-" is the sequence entry indicator
			if (child.source.trim() === "-") {
				// If we saw a previous entry with no content, push null. Any
				// pending anchor/tag belongs to that empty scalar (e.g. `- &a\n- b`
				// anchors the first entry, not the second).
				if (sawEntry) {
					const emptyScalar = YamlScalar.make({
						value: null,
						style: "plain",
						offset: child.offset,
						length: 0,
						...O.getSomesStruct({ tag: O.fromUndefinedOr(pendingMeta.tag) }),
						...O.getSomesStruct({ anchor: O.fromUndefinedOr(pendingMeta.anchor) }),
					});
					if (pendingMeta.anchor !== undefined && pendingMeta.anchor !== "")
						registerAnchor(emptyScalar, pendingMeta.anchor, state, child.offset);
					pendingMeta = {};
					items.push(emptyScalar);
				}
				sawEntry = true;
			}
			continue;
		}
		if (child.type === "error") {
			state.errors.push({
				code: "UnexpectedToken",
				message: `Unexpected content: ${child.source.trim() || "(empty)"}`,
				offset: child.offset,
				length: child.length,
			});
			continue;
		}
		if (child.type === "anchor") {
			pendingMeta.anchor = getAnchorName(child, state.text);
			continue;
		}
		if (child.type === "tag") {
			pendingMeta.tag = child.source;
			continue;
		}
		if (child.type === "flow-scalar" || child.type === "block-scalar") {
			// Look ahead: if followed by a block-map sibling, this scalar is
			// the first key of an implicit mapping (e.g., "- name: value")
			const nextSig = findNextSignificantChild(children, ci + 1, true);
			const nextSigChild = nextSig !== null ? children[nextSig] : undefined;
			if (nextSig !== null && nextSigChild !== undefined && nextSigChild.type === "block-map") {
				// When pending meta is separated from the implicit-map's first key
				// by a newline, the meta applies to the OUTER collection (the map),
				// not to the inner key. Example: `- !!map\n  key: value` — `!!map`
				// tags the map, while `key` keeps no meta.
				let keyMeta: NodeMeta | undefined = hasMeta(pendingMeta) ? pendingMeta : undefined;
				let mapMeta: NodeMeta | undefined;
				if (sawNewlineSincePending && hasMeta(pendingMeta)) {
					mapMeta = pendingMeta;
					keyMeta = undefined;
				}
				const keyScalar = makeScalar(child, state, keyMeta);
				const map = composeBlockMap(nextSigChild, state, keyScalar, mapMeta);
				pendingMeta = {};
				sawNewlineSincePending = false;
				sawEntry = false;
				items.push(map);
				ci = nextSig;
				continue;
			}
			// Merge consecutive plain scalars in same entry (multi-line plain scalar)
			// Uses collectMultilinePlainScalar to also handle continuation lines
			// where the lexer mis-tokenized content as anchors, tags, block-seq, etc. (AB8U)
			if (child.type === "flow-scalar" && getScalarStyle(child) === "plain") {
				const {
					value: merged,
					nextIdx: mergeEnd,
					partsCount,
					endOffset,
				} = collectMultilinePlainScalar(children, ci, undefined, state.text);
				if (partsCount > 1) {
					const resolved = resolveScalar(merged, ["plain", pendingMeta.tag, state]);
					const scalar = YamlScalar.make({
						value: resolved,
						style: "plain",
						offset: child.offset,
						// Span the whole folded scalar — see the value-position
						// site above.
						length: endOffset - child.offset,
						...O.getSomesStruct({ tag: O.fromUndefinedOr(pendingMeta.tag) }),
						...O.getSomesStruct({ anchor: O.fromUndefinedOr(pendingMeta.anchor) }),
					});
					if (pendingMeta.anchor !== undefined && pendingMeta.anchor !== "")
						registerAnchor(scalar, pendingMeta.anchor, state, child.offset);
					pendingMeta = {};
					sawEntry = false;
					items.push(scalar);
					ci = mergeEnd - 1;
					continue;
				}
			}
			const scalar = makeScalar(child, state, hasMeta(pendingMeta) ? pendingMeta : undefined);
			pendingMeta = {};
			sawNewlineSincePending = false;
			sawEntry = false;
			items.push(scalar);
			continue;
		}
		if (child.type === "alias") {
			checkAnchorOnAlias(pendingMeta, child, state);
			const alias = makeAlias(child, state);
			pendingMeta = {};
			sawNewlineSincePending = false;
			sawEntry = false;
			items.push(alias);
			continue;
		}
		if (child.type === "block-map") {
			// If the block-map starts with `:` (empty first key) and we have a
			// pending anchor/tag, that meta belongs to the empty key (e.g.
			// `- &a : value` → first key is empty with anchor `a`, not the map).
			if (hasMeta(pendingMeta) && blockMapStartsWithValueSep(child)) {
				const emptyKey = YamlScalar.make({
					value: null,
					style: "plain",
					offset: child.offset,
					length: 0,
					...O.getSomesStruct({ tag: O.fromUndefinedOr(pendingMeta.tag) }),
					...O.getSomesStruct({ anchor: O.fromUndefinedOr(pendingMeta.anchor) }),
				});
				if (pendingMeta.anchor !== undefined && pendingMeta.anchor !== "")
					registerAnchor(emptyKey, pendingMeta.anchor, state, child.offset);
				pendingMeta = {};
				sawNewlineSincePending = false;
				const map = composeBlockMap(child, state, emptyKey, undefined);
				sawEntry = false;
				items.push(map);
				continue;
			}
			const map = composeBlockMap(child, state, undefined, hasMeta(pendingMeta) ? pendingMeta : undefined);
			pendingMeta = {};
			sawNewlineSincePending = false;
			sawEntry = false;
			items.push(map);
			continue;
		}
		if (child.type === "block-seq") {
			const seq = composeBlockSeq(child, state, hasMeta(pendingMeta) ? pendingMeta : undefined);
			pendingMeta = {};
			sawNewlineSincePending = false;
			sawEntry = false;
			items.push(seq);
			continue;
		}
		if (child.type === "flow-map") {
			const map = state.flow.composeFlowMap(child, state, hasMeta(pendingMeta) ? pendingMeta : undefined, seqIndent);
			pendingMeta = {};
			sawEntry = false;
			items.push(map);
			// In block-seq, flow collections are always entry values, check for trailing
			checkTrailingContentOnSameLine(children, ci + 1, child, state);
			continue;
		}
		if (child.type === "flow-seq") {
			const seq = state.flow.composeFlowSeq(child, state, hasMeta(pendingMeta) ? pendingMeta : undefined, seqIndent);
			pendingMeta = {};
			sawEntry = false;
			items.push(seq);
			// In block-seq, flow collections are always entry values, check for trailing
			checkTrailingContentOnSameLine(children, ci + 1, child, state);
		}
	}
	// Flush trailing entry with no content as null
	if (sawEntry && !hasMeta(pendingMeta)) {
		items.push(
			YamlScalar.make({
				value: null,
				style: "plain",
				offset: cst.offset + cst.length,
				length: 0,
			}),
		);
	}
	// Flush trailing pending tag/anchor as empty scalar (e.g., - !!str)
	if (hasMeta(pendingMeta)) {
		const value = resolveScalar("", ["plain", pendingMeta.tag, state]);
		const scalar = YamlScalar.make({
			value,
			style: "plain",
			offset: 0,
			length: 0,
			...O.getSomesStruct({ tag: O.fromUndefinedOr(pendingMeta.tag) }),
			...O.getSomesStruct({ anchor: O.fromUndefinedOr(pendingMeta.anchor) }),
		});
		if (pendingMeta.anchor !== undefined && pendingMeta.anchor !== "")
			registerAnchor(scalar, pendingMeta.anchor, state, 0);
		items.push(scalar);
	}

	// Own-line comments after the last item: terminal comments at (or beyond)
	// the sequence's indent become its trailing comment; shallower ones
	// escape to the outer scope (reference parity). A blank line between the
	// last item and the terminal run embeds as a LEADING empty line —
	// mirroring buildPairs.
	const withLeadingBlank = (parts: ReadonlyArray<PendingSeqComment>): string | undefined => {
		const joined = joinPending(parts);
		const first = parts[0];
		return joined !== undefined &&
			first !== undefined &&
			lastItemEnd >= 0 &&
			first.offset >= 0 &&
			hasBlankLineAbove(state.text, first.offset) &&
			!blankAboveIsKeepChompContent(state.text, first.offset, lastItemNode)
			? `\n${joined}`
			: joined;
	};
	let seqTrailing: string | undefined;
	if (pending.length > 0) {
		if (seqIndent > 0) {
			const kept: PendingSeqComment[] = [];
			for (const part of pending) {
				if (part.offset >= 0 && columnAt(state.text, part.offset) < seqIndent) {
					state.escapedComments.push({ text: part.text, offset: part.offset });
				} else {
					kept.push(part);
				}
			}
			seqTrailing = withLeadingBlank(kept);
		} else {
			seqTrailing = withLeadingBlank(pending);
		}
	}
	const seqComment =
		meta?.comment !== undefined
			? seqTrailing !== undefined
				? `${meta.comment}\n${seqTrailing}`
				: meta.comment
			: seqTrailing;
	const seqEnd = trimDisownedTrailingComments(state.text, cst.offset, cst.offset + cst.length, state.escapedComments);
	const seq = YamlSeq.make({
		items: rawItems,
		style: "block",
		offset: cst.offset,
		length: seqEnd - cst.offset,
		...O.getSomesStruct({ tag: O.fromUndefinedOr(meta?.tag) }),
		...O.getSomesStruct({ anchor: O.fromUndefinedOr(meta?.anchor) }),
		...O.getSomesStruct({ comment: O.fromUndefinedOr(seqComment) }),
	});

	if (meta?.anchor !== undefined && meta?.anchor !== "") registerAnchor(seq, meta.anchor, state, cst.offset);
	return seq;
}

// ---------------------------------------------------------------------------
// Flat block map helpers (for document children without block-map wrapper)
// ---------------------------------------------------------------------------

/**
 * Compose a block map from flat document children (no block-map wrapper node).
 * This happens in multi-document scenarios where the parser doesn't create a block-map node.
 */
export const composeFlatBlockMap: {
	(startIdx: number, parentCst: CstNode, state: ComposerState, externalFirstKey: YamlNode, meta?: NodeMeta): (children: readonly CstNode[]) => YamlMap;
	(children: readonly CstNode[], startIdx: number, parentCst: CstNode, state: ComposerState, externalFirstKey: YamlNode, meta?: NodeMeta): YamlMap;
} = dual((args) => A.isArray(args[0]), (children: readonly CstNode[], startIdx: number, parentCst: CstNode, state: ComposerState, externalFirstKey: YamlNode, meta?: NodeMeta): YamlMap => {
	// Collect the remaining children into semantic items
	const remainingChildren = children.slice(startIdx);
	const items = flattenBlockMapChildren(remainingChildren, state);
	items.unshift({ kind: "key", node: externalFirstKey });

	const pairs: YamlPair[] = [];
	const trailingComment = buildPairs(items, pairs, state.text, state.escapedComments);

	if (state.options.uniqueKeys) checkDuplicateKeys(pairs, state);
	checkMultilineImplicitKeys(pairs, state);

	const offset = "offset" in externalFirstKey ? externalFirstKey.offset : parentCst.offset;
	const end = trimDisownedTrailingComments(
		state.text,
		offset,
		parentCst.offset + parentCst.length,
		state.escapedComments,
	);

	const mapComment =
		meta?.comment !== undefined
			? trailingComment !== undefined
				? `${meta.comment}\n${trailingComment}`
				: meta.comment
			: trailingComment;
	const map = YamlMap.make({
		items: pairs,
		style: "block",
		offset,
		length: end - offset,
		...O.getSomesStruct({ tag: O.fromUndefinedOr(meta?.tag) }),
		...O.getSomesStruct({ anchor: O.fromUndefinedOr(meta?.anchor) }),
		...O.getSomesStruct({ comment: O.fromUndefinedOr(mapComment) }),
	});

	if (meta?.anchor !== undefined && meta?.anchor !== "") registerAnchor(map, meta.anchor, state, offset);
	return map;
});
