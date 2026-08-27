/**
 * Flow-collection composition: flow mappings, flow sequences, and the
 * flow-children flattening walk.
 *
 * Imports the shared pair-building machinery from `block.ts`; block
 * composition reaches these composers through `state.flow` so the import
 * stays one-directional (flow → block). Exhausted `enterNesting` returns an
 * empty collection placeholder.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { CollectionStyle, ScalarStyle, YamlNode, YamlPair } from "../../YamlNode.ts";
import { YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import type { CstNode } from "../cst.ts";
import { checkAnchorOnAlias, getAnchorName, makeAlias, registerAnchor } from "./anchors.ts";
import type { SemanticItem } from "./block.ts";
import { buildPairs, checkDuplicateKeys, checkMultilineImplicitKeys } from "./block.ts";
import type { CommentFields } from "./comments.ts";
import {
	blankLineAboveStart,
	hasBlankLineAbove,
	isOwnLineAt,
	joinComments,
	rawCommentText,
	withCommentFields,
} from "./comments.ts";
import {
	collectMultilineKey,
	collectMultilinePlainScalar,
	getScalarStyle,
	hasValueSepThroughPlainScalars,
	makeScalar,
	resolveScalar,
} from "./scalars.ts";
import type { ComposerState, NodeMeta } from "./state.ts";
import { enterNesting, exitNesting, hasMeta } from "./state.ts";

/**
 * Validate that flow collection entries are separated by commas.
 *
 * Detects the specific pattern: content, `:`, content, content (no comma).
 * This catches `{foo: 1 bar: 2}` while allowing multiline plain scalars
 * like `{multi\n  line: value}` (consecutive scalars without colon between).
 *
 * State machine: idle → saw-colon → saw-value → error-if-no-comma
 */
function validateFlowSeparators(
	children: readonly CstNode[],
	state: ComposerState,
	openBracket: string,
	closeBracket: string,
): void {
	// Track: after seeing "scalar : scalar", the next scalar without comma is an error
	let colonCount = 0; // number of colons seen since last comma
	let contentAfterColon = 0; // content tokens after the most recent colon

	for (const child of children) {
		if (child.type === "whitespace" && (child.source === openBracket || child.source === closeBracket)) continue;
		if (child.type === "newline") continue;
		if (child.type === "comment") {
			// A comment between content tokens in a flow collection breaks
			// plain scalar continuation — if content follows, it needs a comma.
			if (contentAfterColon > 0) {
				colonCount = 1;
				contentAfterColon = 1;
			}
			continue;
		}
		if (child.type === "whitespace" && child.source.trim() === "") continue;

		if (child.type === "whitespace" && child.source === ",") {
			colonCount = 0;
			contentAfterColon = 0;
			continue;
		}
		if (child.type === "whitespace" && child.source === ":") {
			colonCount++;
			contentAfterColon = 0;
			continue;
		}

		const isContent =
			child.type === "flow-scalar" ||
			child.type === "block-scalar" ||
			child.type === "flow-map" ||
			child.type === "flow-seq" ||
			child.type === "alias";

		if (isContent) {
			contentAfterColon++;
			// Error: we've seen at least one colon, a value after it, and now
			// another content token without a comma. This means something like
			// `key: value nextkey` (missing comma).
			if (colonCount > 0 && contentAfterColon > 1) {
				state.errors.push({
					code: "MalformedFlowCollection",
					message: "Missing comma between flow collection entries",
					offset: child.offset,
					length: child.length,
				});
			}
		}
	}
}

/**
 * 9C9N, VJP3/00: continuation lines of multi-line flow content must be
 * indented past the parent block context. Caller passes the parent block
 * column; for document-root flow content (no parent block) the caller
 * omits it and the check is skipped.
 */
function validateFlowContentIndent(cst: CstNode, state: ComposerState, parentBlockColumn?: number): void {
	if (parentBlockColumn === undefined || parentBlockColumn < 0) return;
	const text = state.text;
	const start = cst.offset;
	const end = cst.offset + cst.length;
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
			// A line holding only the collection's own CLOSING indicators is not
			// content, and the spec puts no indentation floor on a flow closer —
			// `x: {\n  a: 1\n}` is valid, and the reference accepts it (#340).
			// Only real content has to clear the parent block column.
			if (col <= parentBlockColumn && !isClosersOnly(text, i, end)) {
				state.errors.push({
					code: "InvalidIndentation",
					message: "Flow content continuation line must be indented past the parent block",
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
 * True when everything from `start` to the end of that line (bounded by `end`)
 * is flow closing punctuation — `}`, `]`, separating commas and whitespace.
 * Such a line closes the collection rather than carrying content, so the
 * continuation-indent floor does not apply to it.
 */
function isClosersOnly(text: string, start: number, end: number): boolean {
	let sawCloser = false;
	for (let i = start; i < end && i < text.length; i++) {
		const ch = text[i];
		if (ch === "\n") break;
		if (ch === "}" || ch === "]") {
			sawCloser = true;
			continue;
		}
		if (ch === "," || ch === " " || ch === "\t" || ch === "\r") continue;
		return false;
	}
	return sawCloser;
}

// ---------------------------------------------------------------------------
// Compose flow map
// ---------------------------------------------------------------------------

/**
 * Compose a flow mapping (`{a: 1}`) from its CST node.
 *
 * **Gotchas**
 *
 * Do not import this from `block.ts` — block recurses here through
 * {@link FlowComposers}. Exhausted {@link enterNesting} returns an empty
 * map placeholder instead of recursing.
 *
 * **Example** (Flow mapping parses to a plain object)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("{a: 1}\n"))) // { a: 1 }
 * ```
 *
 * @see {@link FlowComposers} for the injected dispatch that avoids a cycle.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export function composeFlowMap(
	cst: CstNode,
	state: ComposerState,
	meta?: NodeMeta,
	parentBlockColumn?: number,
): YamlMap {
	// Nesting-depth guard: unbounded recursion is a stack-overflow DoS vector.
	if (!enterNesting(state, cst)) {
		return new YamlMap({ items: [], style: "flow", offset: cst.offset, length: cst.length });
	}
	try {
		return composeFlowMapInner(cst, state, meta, parentBlockColumn);
	} finally {
		exitNesting(state);
	}
}

function composeFlowMapInner(cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlMap {
	const children = cst.children ?? [];
	const pairs: YamlPair[] = [];

	// Validate bracket balance
	const hasOpen = children.some((c) => c.type === "whitespace" && c.source === "{");
	const hasClose = children.some((c) => c.type === "whitespace" && c.source === "}");
	if (hasOpen && !hasClose) {
		state.errors.push({
			code: "MalformedFlowCollection",
			message: "Unclosed flow mapping (missing `}`)",
			offset: cst.offset,
			length: cst.length,
		});
	}

	// 9C9N, VJP3/00: continuation lines of multi-line flow content must be
	// indented past the parent block context.
	validateFlowContentIndent(cst, state, parentBlockColumn);

	// Validate that flow mapping entries are separated by commas.
	// Between consecutive content tokens (scalars, nested collections),
	// there must be a comma separator unless one is a value indicator (:).
	validateFlowSeparators(children, state, "{", "}");

	// Filter out brackets and blank whitespace, but KEEP commas and newlines
	// so that flattenFlowChildren can respect segment boundaries for multi-line keys.
	const content = children.filter(
		(c) => !(c.type === "whitespace" && (c.source === "{" || c.source === "}" || c.source.trim() === "")),
	);

	const items = flattenFlowChildren(content, state);
	const trailingComment = buildPairs(items, pairs, state.text);

	if (state.options.uniqueKeys) checkDuplicateKeys(pairs, state);

	const mapComment =
		meta?.comment !== undefined
			? trailingComment !== undefined
				? `${meta.comment}\n${trailingComment}`
				: meta.comment
			: trailingComment;
	const map = new YamlMap({
		items: pairs,
		style: "flow" as CollectionStyle,
		offset: cst.offset,
		length: cst.length,
		...(meta?.tag !== undefined ? { tag: meta.tag } : {}),
		...(meta?.anchor !== undefined ? { anchor: meta.anchor } : {}),
		...(mapComment !== undefined ? { comment: mapComment } : {}),
	});

	if (meta?.anchor) registerAnchor(map, meta.anchor, state, cst.offset);
	return map;
}

/**
 * Flatten flow-collection CST children into {@link SemanticItem}s for
 * {@link buildPairs}.
 *
 * **Example** (Comma-separated flow entries)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("{a: 1, b: 2}\n"))) // { a: 1, b: 2 }
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export function flattenFlowChildren(children: readonly CstNode[], state: ComposerState): SemanticItem[] {
	const items: SemanticItem[] = [];
	let pendingMeta: NodeMeta = {};

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (!child) continue;
		if (child.type === "newline") continue;
		if (child.type === "whitespace") {
			// Comma separates flow-map / flow-seq items. If a tag/anchor is
			// pending here (e.g. `foo: !!str, !!str: bar` — the trailing
			// `!!str` belongs to the value of `foo`), flush it as an empty
			// scalar so it doesn't bleed into the next item.
			if (child.source === ",") {
				if (hasMeta(pendingMeta)) {
					const value = resolveScalar("", "plain", pendingMeta.tag, state);
					const scalar = new YamlScalar({
						value,
						style: "plain" as ScalarStyle,
						offset: child.offset,
						length: 0,
						...(pendingMeta.tag !== undefined ? { tag: pendingMeta.tag } : {}),
						...(pendingMeta.anchor !== undefined ? { anchor: pendingMeta.anchor } : {}),
					});
					if (pendingMeta.anchor) registerAnchor(scalar, pendingMeta.anchor, state, child.offset);
					pendingMeta = {};
					items.push({ kind: "node", node: scalar });
				}
				continue;
			}
			if (child.source === ":") {
				// Flush pending tag/anchor as empty scalar before value-sep
				if (hasMeta(pendingMeta)) {
					const value = resolveScalar("", "plain", pendingMeta.tag, state);
					const scalar = new YamlScalar({
						value,
						style: "plain" as ScalarStyle,
						offset: child.offset,
						length: 0,
						...(pendingMeta.tag !== undefined ? { tag: pendingMeta.tag } : {}),
						...(pendingMeta.anchor !== undefined ? { anchor: pendingMeta.anchor } : {}),
					});
					if (pendingMeta.anchor) registerAnchor(scalar, pendingMeta.anchor, state, child.offset);
					pendingMeta = {};
					items.push({ kind: "node", node: scalar });
				}
				items.push({ kind: "value-sep", offset: child.offset });
			}
			if (child.source === "?") {
				// Explicit key indicator in flow context (YAML 1.2 §7.4).
				// The ? marks the next content as an explicit key. If ? is
				// followed by nothing before , or }, it creates a null key.
				// We emit a "key" marker; buildPairs handles the pairing.
				items.push({ kind: "key" });
			}
			continue;
		}
		if (child.type === "comment") {
			items.push({
				kind: "comment",
				comment: rawCommentText(child.source),
				offset: child.offset,
			});
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
			// Check for # without preceding space — YAML 1.2 §6.6 requires
			// whitespace before # for it to be a comment indicator. When # appears
			// as a plain scalar immediately after , or ] or }, it means # wasn't
			// preceded by whitespace.
			if (
				child.type === "flow-scalar" &&
				getScalarStyle(child) === "plain" &&
				child.source.startsWith("#") &&
				child.offset > 0
			) {
				const prev = state.text[child.offset - 1];
				if (prev !== " " && prev !== "\t" && prev !== "\n" && prev !== "\r") {
					state.errors.push({
						code: "UnexpectedToken",
						message: "Comment must be preceded by whitespace",
						offset: child.offset,
						length: child.length,
					});
				}
			}
			// Validate: plain `-` or `?` alone in flow context is invalid.
			// These are block indicators that cannot be plain scalars in flow
			// context unless followed by a non-space safe character (§7.3.3).
			if (
				child.type === "flow-scalar" &&
				getScalarStyle(child) === "plain" &&
				(child.source === "-" || child.source === "?")
			) {
				state.errors.push({
					code: "UnexpectedToken",
					message: `Invalid plain scalar '${child.source}' in flow context`,
					offset: child.offset,
					length: child.length,
				});
			}
			if (child.type === "flow-scalar" && getScalarStyle(child) === "plain") {
				if (hasValueSepThroughPlainScalars(children, i + 1)) {
					// Plain scalar eventually followed by ":" (possibly through
					// continuation plain scalars) — merge as multi-line key
					const { value, nextIdx } = collectMultilineKey(children, i);
					const resolved = resolveScalar(value, "plain", pendingMeta.tag, state);
					const scalar = new YamlScalar({
						value: resolved,
						style: "plain" as ScalarStyle,
						offset: child.offset,
						length: child.length,
						...(pendingMeta.tag !== undefined ? { tag: pendingMeta.tag } : {}),
						...(pendingMeta.anchor !== undefined ? { anchor: pendingMeta.anchor } : {}),
					});
					if (pendingMeta.anchor) registerAnchor(scalar, pendingMeta.anchor, state, child.offset);
					pendingMeta = {};
					items.push({ kind: "node", node: scalar });
					i = nextIdx - 1;
					continue;
				}
				// Not followed by ":" — try multi-line value merging
				const { value, nextIdx, partsCount, endOffset } = collectMultilinePlainScalar(
					children,
					i,
					undefined,
					state.text,
				);
				const resolved = resolveScalar(value, "plain", pendingMeta.tag, state);
				const scalar = new YamlScalar({
					value: resolved,
					style: "plain" as ScalarStyle,
					offset: child.offset,
					// Span the whole folded scalar, not just the first fragment,
					// so findAtOffset covers continuation lines and the
					// sourceMultiline decoration pass sees the real extent.
					length: partsCount > 1 ? endOffset - child.offset : child.length,
					...(pendingMeta.tag !== undefined ? { tag: pendingMeta.tag } : {}),
					...(pendingMeta.anchor !== undefined ? { anchor: pendingMeta.anchor } : {}),
				});
				if (pendingMeta.anchor) registerAnchor(scalar, pendingMeta.anchor, state, child.offset);
				pendingMeta = {};
				items.push({ kind: "node", node: scalar });
				i = nextIdx - 1;
				continue;
			}
			const scalar = makeScalar(child, state, hasMeta(pendingMeta) ? pendingMeta : undefined);
			pendingMeta = {};
			items.push({ kind: "node", node: scalar });
			continue;
		}
		if (child.type === "alias") {
			checkAnchorOnAlias(pendingMeta, child, state);
			const alias = makeAlias(child, state);
			pendingMeta = {};
			items.push({ kind: "node", node: alias });
			continue;
		}
		if (child.type === "flow-map") {
			const map = composeFlowMap(child, state, hasMeta(pendingMeta) ? pendingMeta : undefined);
			pendingMeta = {};
			items.push({ kind: "node", node: map });
			continue;
		}
		if (child.type === "flow-seq") {
			const seq = composeFlowSeq(child, state, hasMeta(pendingMeta) ? pendingMeta : undefined);
			pendingMeta = {};
			items.push({ kind: "node", node: seq });
		}
	}
	// Flush trailing pending tag/anchor as empty scalar (e.g., !!str at end of flow)
	if (hasMeta(pendingMeta)) {
		const value = resolveScalar("", "plain", pendingMeta.tag, state);
		const scalar = new YamlScalar({
			value,
			style: "plain" as ScalarStyle,
			offset: 0,
			length: 0,
			...(pendingMeta.tag !== undefined ? { tag: pendingMeta.tag } : {}),
			...(pendingMeta.anchor !== undefined ? { anchor: pendingMeta.anchor } : {}),
		});
		if (pendingMeta.anchor) registerAnchor(scalar, pendingMeta.anchor, state, 0);
		items.push({ kind: "node", node: scalar });
	}
	return items;
}

// ---------------------------------------------------------------------------
// Compose flow seq
// ---------------------------------------------------------------------------

/**
 * Compose a flow sequence (`[1, 2]`) from its CST node.
 *
 * **Gotchas**
 *
 * Exhausted {@link enterNesting} returns an empty seq placeholder. Import
 * stays flow → block only.
 *
 * **Example** (Flow sequence parses to an array)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("[1, 2]\n"))) // [1, 2]
 * ```
 *
 * @see {@link composeFlowMap} for the mapping counterpart.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export function composeFlowSeq(
	cst: CstNode,
	state: ComposerState,
	meta?: NodeMeta,
	parentBlockColumn?: number,
): YamlSeq {
	// Nesting-depth guard: unbounded recursion is a stack-overflow DoS vector.
	if (!enterNesting(state, cst)) {
		return new YamlSeq({ items: [], style: "flow", offset: cst.offset, length: cst.length });
	}
	try {
		return composeFlowSeqInner(cst, state, meta, parentBlockColumn);
	} finally {
		exitNesting(state);
	}
}

function composeFlowSeqInner(cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlSeq {
	const children = cst.children ?? [];
	const items: YamlNode[] = [];

	// 9C9N, VJP3/00: continuation lines of multi-line flow content must be
	// indented past the parent block context.
	validateFlowContentIndent(cst, state, parentBlockColumn);

	// Validate flow separators (commas between entries)
	validateFlowSeparators(children, state, "[", "]");

	// Validate bracket balance: check that the flow sequence has matching brackets.
	const hasOpen = children.some((c) => c.type === "whitespace" && c.source === "[");
	const hasClose = children.some((c) => c.type === "whitespace" && c.source === "]");
	if (hasOpen && !hasClose) {
		state.errors.push({
			code: "MalformedFlowCollection",
			message: "Unclosed flow sequence (missing `]`)",
			offset: cst.offset,
			length: cst.length,
		});
	}

	// Split children into comma-delimited segments, filtering out brackets.
	// Each segment is processed independently: if it contains a ":" value
	// separator, it's an implicit single-pair mapping (YAML 1.2 §7.4);
	// otherwise each node in the segment is a plain sequence entry.
	const segments: CstNode[][] = [];
	let current: CstNode[] = [];

	let seenContent = false;
	let lastWasComma = false;

	for (const child of children) {
		// Skip brackets
		if (child.type === "whitespace" && (child.source === "[" || child.source === "]")) continue;
		// Split on commas
		if (child.type === "whitespace" && child.source === ",") {
			// Detect leading comma or consecutive commas (empty flow entry)
			const hasContentInSegment = current.some(
				(c) => c.type !== "whitespace" && c.type !== "newline" && c.type !== "comment",
			);
			if (!hasContentInSegment && (lastWasComma || !seenContent)) {
				state.errors.push({
					code: "MalformedFlowCollection",
					message: "Empty entry in flow sequence",
					offset: child.offset,
					length: 1,
				});
			}
			if (current.length > 0) segments.push(current);
			current = [];
			lastWasComma = true;
			continue;
		}
		if (child.type !== "whitespace" && child.type !== "newline" && child.type !== "comment") {
			seenContent = true;
			lastWasComma = false;
		}
		current.push(child);
	}
	if (current.length > 0) segments.push(current);

	// Own-line comments left over after the last item become the sequence's
	// trailing comment (mirroring buildPairs' leftover contract).
	let seqTrailing: string | undefined;
	// Forward-attribution state, hoisted ACROSS comma segments (#127): an
	// own-line comment belongs to the FOLLOWING item even when a comma splits
	// the segment before that item arrives; a same-line comment trails the
	// last pushed item even when the comma sits between them (`a, # c`).
	// Blank lines follow the house encoding (mirroring buildPairs and the
	// block-seq walk): a blank before the FIRST comment of a run — or before
	// a comment-free item — sets `spaceBefore`; a blank WITHIN a run embeds
	// as an empty line in the joined string; a blank BETWEEN the run and its
	// item embeds as a trailing empty line.
	interface PendingFlowComment {
		text: string;
		offset: number;
		blankAbove: boolean;
	}
	let pending: PendingFlowComment[] = [];
	let pendingSpace = false;
	let lastItemEnd = -1;
	let pushedIdx = -1;
	const joinPending = (parts: ReadonlyArray<PendingFlowComment>): string | undefined => {
		if (parts.length === 0) return undefined;
		let out = (parts[0] as PendingFlowComment).text;
		for (let k = 1; k < parts.length; k++) {
			const part = parts[k] as PendingFlowComment;
			out += part.blankAbove ? `\n\n${part.text}` : `\n${part.text}`;
		}
		return out;
	};
	// A blank line counts as a BETWEEN-items blank only when it sits after the
	// previous item's end. Flow items routinely share a line with preceding
	// structure (`? [a, b]` after a blank line), and the purely-local
	// "blank line above" check would otherwise attribute the blank above that
	// SHARED line to a mid-line item — re-emitting it inside the collection
	// and breaking format idempotence.
	const blankIsBetweenItems = (anchorOffset: number): boolean =>
		blankLineAboveStart(state.text, anchorOffset) >= lastItemEnd;
	const acceptOwnLineComment = (cText: string, cOff: number): void => {
		const blankAbove = cOff >= 0 && hasBlankLineAbove(state.text, cOff);
		if (blankAbove && pending.length === 0 && lastItemEnd >= 0 && blankIsBetweenItems(cOff)) {
			pendingSpace = true;
		}
		pending.push({ text: cText, offset: cOff, blankAbove: blankAbove && pending.length > 0 });
	};
	/** The pending comment fields for the item being pushed, then reset. */
	const takePendingFields = (anchorOffset: number): CommentFields => {
		let commentBefore = joinPending(pending);
		if (anchorOffset >= 0 && hasBlankLineAbove(state.text, anchorOffset)) {
			if (commentBefore !== undefined) {
				commentBefore = `${commentBefore}\n`;
			} else if (!pendingSpace && lastItemEnd >= 0 && blankIsBetweenItems(anchorOffset)) {
				pendingSpace = true;
			}
		}
		const fields: CommentFields = {
			...(commentBefore !== undefined ? { commentBefore } : {}),
			...(pendingSpace ? { spaceBefore: true } : {}),
		};
		pending = [];
		pendingSpace = false;
		return fields;
	};
	const hasPendingFields = (fields: CommentFields): boolean =>
		fields.commentBefore !== undefined || fields.spaceBefore === true;

	for (const segment of segments) {
		// Check if this segment contains a value separator (implicit mapping)
		const hasValueSep = segment.some((c) => c.type === "whitespace" && c.source === ":");

		if (hasValueSep) {
			// Process as a single-pair implicit mapping
			// Keep newlines so flattenFlowChildren can merge multi-line plain scalars
			const content = segment.filter((c) => !(c.type === "whitespace" && c.source.trim() === ""));
			const semItems = flattenFlowChildren(content, state);
			const pairs: YamlPair[] = [];
			const segTrailing = buildPairs(semItems, pairs, state.text);
			// Only check multiline keys for implicit mappings (no `?` marker).
			// Explicit keys (with `?`) are allowed to span multiple lines.
			const hasExplicitKey = segment.some((c) => c.type === "whitespace" && c.source === "?");
			if (!hasExplicitKey) {
				checkMultilineImplicitKeys(pairs, state, semItems);
			}
			const firstPair = pairs[0];
			if (firstPair) {
				// Anchor the blank-above check at the segment's first token
				// (comment or key) — the analog of buildPairs anchoring at the
				// key it is about to construct. Comments INSIDE the segment
				// attach to the pair via buildPairs; a blank line ABOVE the
				// segment is this item's spaceBefore.
				const segFirst = content[0];
				const fields = takePendingFields(segFirst !== undefined ? segFirst.offset : -1);
				const map = new YamlMap({
					items: pairs,
					style: "flow" as CollectionStyle,
					offset: firstPair.key.offset,
					length: 0,
					...fields,
					...(segTrailing !== undefined ? { comment: segTrailing } : {}),
				});
				items.push(map);
				pushedIdx = items.length - 1;
				lastItemEnd = map.offset + map.length;
			} else if (segTrailing !== undefined) {
				seqTrailing = joinComments(seqTrailing, segTrailing);
			}
		} else {
			// Process as plain sequence items. Comments before an item in the
			// segment lead it (`commentBefore`); comments after the segment's
			// item trail it (`comment`).
			// Keep newlines so flattenFlowChildren can merge multi-line plain scalars
			const content = segment.filter((c) => !(c.type === "whitespace" && c.source.trim() === ""));
			const semItems = flattenFlowChildren(content, state);
			for (const si of semItems) {
				if (si.kind === "comment") {
					const cText = si.comment ?? "";
					// Own-line vs trailing is decided from the comment's own line
					// (#127): only a comment SHARING a line with content attaches
					// backward as the previous item's trailing comment; an
					// own-line comment attributes FORWARD to the next item.
					const ownLine = si.offset === undefined ? true : isOwnLineAt(state.text, si.offset);
					if (!ownLine && pushedIdx >= 0) {
						const prev = items[pushedIdx];
						if (prev) items[pushedIdx] = withCommentFields(prev, { comment: cText });
					} else {
						acceptOwnLineComment(cText, si.offset ?? -1);
					}
					continue;
				}
				if (si.kind === "node" && si.node) {
					const fields = takePendingFields(si.node.length > 0 ? si.node.offset : -1);
					const node = hasPendingFields(fields) ? withCommentFields(si.node, fields) : si.node;
					items.push(node);
					pushedIdx = items.length - 1;
					lastItemEnd = si.node.offset + si.node.length;
				}
			}
		}
	}
	// Own-line comments with no following item are the sequence's trailing
	// comment (hoisted leftover — mirrors buildPairs' contract). A blank line
	// between the last item and the terminal run embeds as a LEADING empty
	// line in the joined string.
	if (pending.length > 0) {
		const joined = joinPending(pending);
		const first = pending[0];
		const withLead =
			joined !== undefined &&
			first !== undefined &&
			lastItemEnd >= 0 &&
			first.offset >= 0 &&
			hasBlankLineAbove(state.text, first.offset)
				? `\n${joined}`
				: joined;
		if (withLead !== undefined) seqTrailing = joinComments(seqTrailing, withLead);
	}

	const seqComment =
		meta?.comment !== undefined
			? seqTrailing !== undefined
				? `${meta.comment}\n${seqTrailing}`
				: meta.comment
			: seqTrailing;
	const seq = new YamlSeq({
		items,
		style: "flow" as CollectionStyle,
		offset: cst.offset,
		length: cst.length,
		...(meta?.tag !== undefined ? { tag: meta.tag } : {}),
		...(meta?.anchor !== undefined ? { anchor: meta.anchor } : {}),
		...(seqComment !== undefined ? { comment: seqComment } : {}),
	});

	if (meta?.anchor) registerAnchor(seq, meta.anchor, state, cst.offset);
	return seq;
}
