/**
 * Document-level composition: the per-CST-document compose walk, directive
 * validation, and the engine entry points the facade drives.
 *
 * This is the only composer module that imports both `block.ts` and
 * `flow.ts`; nothing in the engine imports it back. Fatal-code filtering is
 * the facade's job — these entry points return raw diagnostics unfiltered.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { O as OU } from "@beep/utils";
import * as P from "@beep/utils/Predicate";
import { MutableHashMap } from "effect";
import { dual } from "effect/Function";
import type { YamlNode } from "../../YamlNode.ts";
import {
    YamlAlias,
    YamlMap,
    YamlPair,
    YamlScalar,
    YamlSeq
} from "../../YamlNode.ts";
import { parseCSTAll } from "../cst-parser.ts";
import type { CstNode } from "../cst.ts";
import type { RawDiagnostic } from "../diagnostics.ts";
import type { ParseOptionsInput } from "../options.ts";
import type { RawDirective, RawYamlDocument } from "../raw-document.ts";
import {
    checkAnchorOnAlias,
    getAnchorName,
    makeAlias,
    registerAnchor
} from "./anchors.ts";
import {
    composeBlockMap,
    composeBlockSeq,
    composeFlatBlockMap
} from "./block.ts";
import {
    hasBlankLineAbove,
    hasBlankLineBelow,
    rawCommentText,
    withCommentFields
} from "./comments.ts";
import { composeFlowMap, composeFlowSeq } from "./flow.ts";
import {
    collectMultilinePlainScalar,
    findNextContentChild,
    getScalarStyle,
    hasBlockMapAfterInList,
    hasValueSepAfter,
    indexOfChild,
    makeScalar,
    resolveScalar,
} from "./scalars.ts";
import type { ComposerState, FlowComposers, NodeMeta } from "./state.ts";
import {
    clearMeta,
    commentProps,
    createState,
    hasMeta,
    sameLine
} from "./state.ts";
import { parseDirective, validateTagHandlesInDocument } from "./tags.ts";

/** The flow-composer dispatch wired into every state this module creates. */
const FLOW: FlowComposers = { composeFlowMap, composeFlowSeq };

// ---------------------------------------------------------------------------
// Document-level validation helpers
// ---------------------------------------------------------------------------

/**
 * SY6V: at document level, an anchor or tag must not be followed by a
 * block-sequence entry indicator "-" on the same line. The anchor/tag
 * applies to the next node, but a "-" on the same line means the parser
 * is interpreting it as a sequence start without proper structure.
 */
function validateAnchorTagNotFollowedBySeqDashOnSameLine(
	meta: CstNode,
	children: readonly CstNode[],
	idx: number,
	state: ComposerState,
): void {
	for (let j = idx + 1; j < children.length; j++) {
		const c = children[j];
		if (c === undefined) continue;
		if (c.type === "newline") return; // ok — anchor on its own line
		if (c.type === "whitespace") {
			// Structural indicators ("-", ":", "?", "---", "...") are typed as
			// `whitespace` CST nodes at the document/block level — see also
			// `checkDocumentMarkerSameLine` which tests the same shape for
			// `---`/`...`. We're looking for a "-" on the same line as the meta.
			if (c.source === "-" && sameLine(state.text, meta.offset, c.offset)) {
				state.errors.push({
					code: "UnexpectedToken",
					message: "Block sequence entry indicator '-' cannot follow an anchor or tag on the same line",
					offset: c.offset,
					length: c.length,
				});
				return;
			}
			continue;
		}
		// Empty placeholder block-seq with length 0 — keep scanning past it.
		if (c.type === "block-seq" && c.length === 0) continue;
		return;
	}
}

/**
 * Validate that document markers (--- and ...) are not followed by content
 * on the same line. YAML 1.2 §9.1.4/§9.2 require these markers to be on
 * their own line (followed only by whitespace/comments).
 *
 * Checks within a single document's children AND across document boundaries
 * (e.g. `... invalid` where `...` ends doc 1 and `invalid` starts doc 2).
 */
function checkDocumentMarkerSameLine(
	children: readonly CstNode[],
	state: ComposerState,
	nextDocChildren?: readonly CstNode[],
): void {
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child === undefined) continue;
		// Document markers appear as "whitespace"-typed CST nodes with source "---" or "..."
		if (child.type !== "whitespace") continue;
		const src = child.source;
		// Only check "..." — "---" CAN be followed by content on the same line
		if (src !== "...") continue;

		// Find next non-whitespace, non-newline sibling in same document
		let found = false;
		for (let j = i + 1; j < children.length; j++) {
			const next = children[j];
			if (next === undefined) continue;
			if (next.type === "newline") break;
			if (next.type === "whitespace" && next.source.trim() === "") continue;
			if (next.type === "comment") break; // comments are allowed after ...
			// Non-trivial content found — check if it's on the same line
			if (sameLine(state.text, child.offset, next.offset)) {
				state.errors.push({
					code: "UnexpectedToken",
					message: "Content on same line as document-end marker",
					offset: next.offset,
					length: next.length,
				});
			}
			found = true;
			break;
		}

		// For "..." at end of document, check first content of next document
		if (!found && nextDocChildren !== undefined) {
			for (const next of nextDocChildren) {
				if (next === undefined) continue;
				if (next.type === "newline") break;
				if (next.type === "whitespace" && next.source.trim() === "") continue;
				if (sameLine(state.text, child.offset, next.offset)) {
					state.errors.push({
						code: "UnexpectedToken",
						message: "Content on same line as document-end marker",
						offset: next.offset,
						length: next.length,
					});
				}
				break;
			}
		}
	}
}

/**
 * Check for trailing content after a complete value at document level.
 * After a flow collection or scalar at the top level, only trivia and
 * document markers should follow. Skips if next meaningful content is ":"
 * (the flow collection is being used as a mapping key).
 */
function checkTrailingContentAfterDocValue(
	children: readonly CstNode[],
	startIdx: number,
	state: ComposerState,
	allowMappingKey = true,
): void {
	for (let j = startIdx; j < children.length; j++) {
		const next = children[j];
		if (next === undefined) continue;
		if (next.type === "newline" || next.type === "comment") continue;
		if (next.type === "whitespace") {
			// Document markers (---, ...) are OK
			if (next.source === "---" || next.source === "...") break;
			// ":" means this value is a mapping key — not trailing content
			if (next.source === ":") break;
			if (next.source.trim() === "") continue;
		}
		// Non-trivial content after a complete document value.
		// If allowed, check if this content looks like a mapping key (followed by
		// ":" or a block-map) — it's a sibling mapping pair, not trailing content.
		if (
			allowMappingKey &&
			(next.type === "flow-scalar" ||
				next.type === "block-scalar" ||
				next.type === "flow-map" ||
				next.type === "flow-seq")
		) {
			const afterNode = findNextContentChild(children, j + 1);
			if (hasValueSepAfter(children, j + 1) || (afterNode !== null && afterNode.type === "block-map")) {
				break;
			}
		}
		if (
			next.type === "flow-scalar" ||
			next.type === "block-scalar" ||
			next.type === "block-map" ||
			next.type === "block-seq" ||
			next.type === "flow-map" ||
			next.type === "flow-seq" ||
			next.type === "anchor" ||
			next.type === "tag" ||
			next.type === "alias"
		) {
			state.errors.push({
				code: "UnexpectedToken",
				message: "Trailing content after document value",
				offset: next.offset,
				length: next.length,
			});
		}
		break;
	}
}

// ---------------------------------------------------------------------------
// Compose document
// ---------------------------------------------------------------------------

/**
 * Compose one CST document node into a raw document record.
 *
 * **Example** (Single-document mapping)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a: 1\n"))) // { a: 1 }
 * ```
 *
 * @see {@link composeFirstDocument} for the text-level engine entry.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const composeDocument: {
	(cst: CstNode, state: ComposerState, hasSubsequentDocuments?: boolean, nextDocCst?: CstNode): RawYamlDocument;
	(state: ComposerState, hasSubsequentDocuments?: boolean, nextDocCst?: CstNode): (cst: CstNode) => RawYamlDocument;
} = dual((args) => P.hasProperty(args[0], "type"), (
	cst: CstNode,
	state: ComposerState,
	hasSubsequentDocuments = false,
	nextDocCst?: CstNode,
): RawYamlDocument => {
	// Hardening: unescaped C0 control characters (other than tab/LF/CR) are
	// not c-printable (YAML 1.2 §5.1) and are invalid anywhere in the stream.
	// Escaped forms in double-quoted scalars never appear raw in the source,
	// so scanning the document's raw span is sufficient.
	const spanEnd = Math.min(cst.offset + cst.length, state.text.length);
	for (let ci = cst.offset; ci < spanEnd; ci++) {
		const cc = state.text.charCodeAt(ci);
		if (cc < 0x20 && cc !== 0x09 && cc !== 0x0a && cc !== 0x0d) {
			state.errors.push({
				code: "UnexpectedCharacter",
				message: `Unescaped control character U+${cc.toString(16).toUpperCase().padStart(4, "0")}`,
				offset: ci,
				length: 1,
			});
			break;
		}
	}

	const children = cst.children ?? [];
	const directives: RawDirective[] = [];
	let contents: YamlNode | null = null;
	let documentComment: string | undefined;
	let documentCommentAfter: string | undefined;
	// Offset of the LAST leading-comment line on each side of the `---` marker
	// — used after the loop to embed a blank line separating that side's block
	// from the first content node. One per buffer: the two runs are separate
	// blocks and a shared offset attributes a blank to the wrong one.
	let lastLeadingCommentOffset = -1;
	let lastAfterMarkerCommentOffset = -1;
	// A comment after the `...` marker is the TRAILING block even when the
	// document is empty (`---\n...\n# tail\n` has no contents to flip the
	// header/trailer split below).
	let sawDocEndMarker = false;
	// Whether a `---` marker has been passed, and whether the leading comment
	// run began after it — `hasDocStart` only says a marker exists SOMEWHERE.
	let sawDocStartMarker = false;
	// The leading run, split at the `---` marker: `documentComment` holds what
	// precedes it, `afterMarkerComment` what follows and therefore leads the
	// content node.
	let afterMarkerComment: string | undefined;

	// Whether this document has a `---` marker — used to determine if
	// metadata (tag/anchor) applies to the root mapping or the first key.
	const hasDocStart = children.some((c) => c.type === "whitespace" && c.source === "---");

	let i = 0;
	const meta: NodeMeta = {};
	// Track meta carried across a newline. When the doc-level processor sees
	// `&a !!t1\n&b !!t2 key: ...`, the first meta belongs to the outer container
	// (root map) and the second to the inner first key. Without this split, the
	// later meta would silently overwrite the earlier one.
	const outerMeta: NodeMeta = {};
	let sawNewlineSinceMeta = false;
	const commitMetaAcrossNewline = () => {
		if (sawNewlineSinceMeta && hasMeta(meta)) {
			if (meta.tag !== undefined) outerMeta.tag = meta.tag;
			if (meta.anchor !== undefined) outerMeta.anchor = meta.anchor;
			if (meta.comment !== undefined) outerMeta.comment = meta.comment;
			clearMeta(meta);
		}
		sawNewlineSinceMeta = false;
	};

	while (i < children.length) {
		const child = children[i];
		if (child === undefined) {
			i++;
			continue;
		}

		// Directives
		if (child.type === "directive") {
			const directive = parseDirective(child.source);
			if (directive !== null) {
				directives.push(directive);
				// Populate tag map from %TAG directives
				if (directive.name === "TAG" && directive.parameters.length >= 2) {
					const handle = directive.parameters[0];
					const prefix = directive.parameters[1];
					if (handle !== undefined && handle !== "" && prefix !== undefined && prefix !== "") {
						MutableHashMap.set(state.tagMap, handle, prefix);
					}
				}
			}
			i++;
			continue;
		}

		// Trivia
		if (child.type === "newline" && hasMeta(meta)) {
			sawNewlineSinceMeta = true;
		}
		if (child.type === "whitespace" || child.type === "newline") {
			if (child.type === "whitespace" && child.source === "...") sawDocEndMarker = true;
			if (child.type === "whitespace" && child.source === "---") sawDocStartMarker = true;
			// Detect stray flow-closing brackets at document level
			if (child.type === "whitespace" && (child.source === "]" || child.source === "}")) {
				state.errors.push({
					code: "MalformedFlowCollection",
					message: `Unexpected flow indicator '${child.source}' at document level`,
					offset: child.offset,
					length: child.length,
				});
			}
			i++;
			continue;
		}

		// Comments (before content) — consecutive leading comment lines join
		// with `\n` so a multi-line document header survives intact; a blank
		// line within the run embeds as an empty line (reference parity).
		if (child.type === "comment" && contents === null && !sawDocEndMarker) {
			const text = rawCommentText(child.source);
			// The `---` marker is a boundary, and it partitions the leading run
			// PER COMMENT rather than by where the run started: comments ahead of
			// the marker are the document's header, comments after it lead the
			// content. Deciding once from the first comment merged both sides into
			// one block and re-emitted the whole thing above the marker.
			// Each side tracks its OWN last offset. Sharing one made the blank
			// line below an after-marker comment embed into the PRE-marker
			// block instead, so `# a\n---\n# b\n\nx: 1\n` moved the blank across
			// the marker and never reached a fixed point.
			if (sawDocStartMarker) {
				if (afterMarkerComment !== undefined && hasBlankLineAbove(state.text, child.offset)) {
					afterMarkerComment = `${afterMarkerComment}\n`;
				}
				afterMarkerComment = afterMarkerComment === undefined ? text : `${afterMarkerComment}\n${text}`;
				lastAfterMarkerCommentOffset = child.offset;
			} else {
				if (documentComment !== undefined && hasBlankLineAbove(state.text, child.offset)) {
					documentComment = `${documentComment}\n`;
				}
				documentComment = documentComment === undefined ? text : `${documentComment}\n${text}`;
				lastLeadingCommentOffset = child.offset;
			}
			i++;
			continue;
		}
		// Comments after content (including after a `...` marker) — the
		// document's TRAILING comment block (`commentAfter`), reference parity
		// with the yaml npm package's doc.commentBefore.
		if (child.type === "comment") {
			const text = rawCommentText(child.source);
			if (documentCommentAfter !== undefined && hasBlankLineAbove(state.text, child.offset)) {
				documentCommentAfter = `${documentCommentAfter}\n`;
			}
			documentCommentAfter = documentCommentAfter === undefined ? text : `${documentCommentAfter}\n${text}`;
			i++;
			continue;
		}

		// Error nodes from the lexer/parser (e.g. tab indentation)
		if (child.type === "error") {
			state.errors.push({
				code: "UnexpectedToken",
				message: `Unexpected content: ${child.source.trim() || "(empty)"}`,
				offset: child.offset,
				length: child.length,
			});
			i++;
			continue;
		}

		// Anchor/tag metadata. When a newline preceded the new meta and meta was
		// already set, the existing meta belongs to the outer container.
		if (child.type === "anchor") {
			// SY6V: anchor followed by a block-seq entry indicator "-" on the
			// SAME line is invalid. Anchors must be followed by a node, not a
			// new block-seq indicator on the same line.
			validateAnchorTagNotFollowedBySeqDashOnSameLine(child, children, i, state);
			commitMetaAcrossNewline();
			meta.anchor = getAnchorName(child, state.text);
			i++;
			continue;
		}
		if (child.type === "tag") {
			validateAnchorTagNotFollowedBySeqDashOnSameLine(child, children, i, state);
			commitMetaAcrossNewline();
			meta.tag = child.source;
			i++;
			continue;
		}

		if (child.type === "flow-scalar" || child.type === "block-scalar") {
			// Check if next meaningful child is a block-map (this scalar is a key)
			const nextContent = findNextContentChild(children, i + 1);
			if (nextContent !== null && nextContent.type === "block-map") {
				// A mapping cannot start on the `---` line. The `---` directive end
				// is followed by a single value (or anchor+value), but a mapping
				// pattern (key:) on the same line as `---` is malformed (9KBC, CXX2).
				if (hasDocStart) {
					const docStartChild = children.find((c) => c.type === "whitespace" && c.source === "---");
					if (docStartChild !== undefined && sameLine(state.text, docStartChild.offset, child.offset)) {
						state.errors.push({
							code: "UnexpectedToken",
							message: "Mapping cannot start on document-start (---) line",
							offset: child.offset,
							length: child.length,
						});
					}
				}
				// Resolve which meta attaches to the root map vs. the first key.
				// - If outer meta exists (collected across a newline), it belongs to
				//   the map. The current `meta` belongs to the key.
				// - Otherwise, with `hasDocStart`, the current meta is map-level
				//   (preserves prior behavior — no key-level metadata possible).
				// - Otherwise, the current meta belongs to the key.
				let mapMeta: NodeMeta | undefined;
				let keyMeta: NodeMeta | undefined;
				if (hasMeta(outerMeta)) {
					mapMeta = { ...outerMeta };
					keyMeta = hasMeta(meta) ? { ...meta } : undefined;
				} else if (hasDocStart && hasMeta(meta)) {
					mapMeta = { ...meta };
					keyMeta = undefined;
				} else {
					keyMeta = hasMeta(meta) ? { ...meta } : undefined;
				}
				const key = makeScalar(child, state, keyMeta);
				clearMeta(meta);
				clearMeta(outerMeta);
				sawNewlineSinceMeta = false;
				contents = composeBlockMap(nextContent, state, key, mapMeta);
				i = indexOfChild(children, nextContent) + 1;
				continue;
			}
			// Check if followed by ":" (value-sep) — flat mapping without block-map wrapper
			if (hasValueSepAfter(children, i + 1)) {
				let mapMeta: NodeMeta | undefined;
				let keyMeta: NodeMeta | undefined;
				if (hasMeta(outerMeta)) {
					mapMeta = { ...outerMeta };
					keyMeta = hasMeta(meta) ? { ...meta } : undefined;
				} else if (hasDocStart && hasMeta(meta)) {
					mapMeta = { ...meta };
					keyMeta = undefined;
				} else {
					keyMeta = hasMeta(meta) ? { ...meta } : undefined;
				}
				const key = makeScalar(child, state, keyMeta);
				clearMeta(meta);
				clearMeta(outerMeta);
				sawNewlineSinceMeta = false;
				contents = composeFlatBlockMap(children, i + 1, cst, state, key, mapMeta);
				break; // consumed all remaining children
			}
			// Standalone scalar — try multi-line plain scalar merging
			if (child.type === "flow-scalar" && getScalarStyle(child) === "plain") {
				const { value, nextIdx, partsCount, endOffset } = collectMultilinePlainScalar(
					children,
					i,
					undefined,
					state.text,
				);
				// Combine outer + inner meta — for a scalar root, both apply to it.
				const combined: NodeMeta = { ...outerMeta };
				if (meta.tag !== undefined) combined.tag = meta.tag;
				if (meta.anchor !== undefined) combined.anchor = meta.anchor;
				const resolved = resolveScalar(value, { style: "plain", state, ...OU.getSomesStruct({ tag: OU.fromUndefinedOr(combined.tag) }) });
				// Span the full source range when multi-line plain folding merged
				// multiple children — `endOffset` is the end of the last consumed
				// fragment, including directives and other non-scalar
				// continuations the lexer mis-tokenised on a folded line.
				const scalarLength = partsCount > 1 ? endOffset - child.offset : child.length;
				contents = YamlScalar.make({
					value: resolved,
					style: "plain",
					offset: child.offset,
					length: scalarLength,
					...OU.getSomesStruct({ tag: OU.fromUndefinedOr(combined.tag), anchor: OU.fromUndefinedOr(combined.anchor) })
				});
				if (combined.anchor !== undefined && combined.anchor !== "") registerAnchor(contents, combined.anchor, state, child.offset);
				clearMeta(meta);
				clearMeta(outerMeta);
				sawNewlineSinceMeta = false;
				// If the multiline scalar merged multiple parts and the remaining
				// content forms a mapping, that mapping is trailing garbage (2CMS).
				if (partsCount > 1) {
					const nextContent2 = findNextContentChild(children, nextIdx);
					if (nextContent2 !== null) {
						const isTrailing =
							(nextContent2.type === "flow-scalar" &&
								hasValueSepAfter(children, indexOfChild(children, nextContent2) + 1)) ||
							nextContent2.type === "block-map" ||
							// Also catch: flow-scalar followed by a block-map sibling
							// (the scalar+block-map pattern that forms an implicit mapping).
							// Without this, 2CMS slips through after `hasBlockMapAfterInList`
							// stops the merge before reaching the trailing scalar.
							(nextContent2.type === "flow-scalar" &&
								hasBlockMapAfterInList(children, indexOfChild(children, nextContent2) + 1));
						if (isTrailing) {
							state.errors.push({
								code: "UnexpectedToken",
								message: "Trailing content after document value",
								offset: nextContent2.offset,
								length: nextContent2.length,
							});
						}
					}
				} else {
					// BS4K: a single-line plain scalar followed by another plain
					// scalar (with a comment in between, breaking multi-line merge)
					// is invalid trailing content.
					checkTrailingContentAfterDocValue(children, nextIdx, state, false);
				}
				i = nextIdx;
				continue;
			}
			// Combine outer + inner meta for scalar root.
			const combined: NodeMeta = { ...outerMeta };
			if (meta.tag !== undefined) combined.tag = meta.tag;
			if (meta.anchor !== undefined) combined.anchor = meta.anchor;
			contents = makeScalar(child, state, hasMeta(combined) ? combined : undefined);
			clearMeta(meta);
			clearMeta(outerMeta);
			sawNewlineSinceMeta = false;
			i++;
			continue;
		}

		if (child.type === "block-map") {
			// Outer meta belongs to the map; remaining `meta` would belong to the
			// first key inside, but block-map's own children carry that context.
			const combined: NodeMeta = { ...outerMeta };
			if (meta.tag !== undefined) combined.tag = meta.tag;
			if (meta.anchor !== undefined) combined.anchor = meta.anchor;
			contents = composeBlockMap(child, state, undefined, hasMeta(combined) ? combined : undefined);
			clearMeta(meta);
			clearMeta(outerMeta);
			sawNewlineSinceMeta = false;
			i++;
			continue;
		}

		if (child.type === "block-seq") {
			const isRootSeq = contents === null;
			const combined: NodeMeta = { ...outerMeta };
			if (meta.tag !== undefined) combined.tag = meta.tag;
			if (meta.anchor !== undefined) combined.anchor = meta.anchor;
			contents = composeBlockSeq(child, state, hasMeta(combined) ? combined : undefined);
			clearMeta(meta);
			clearMeta(outerMeta);
			sawNewlineSinceMeta = false;
			i++;
			// Only check for trailing content when the block-seq is the root document
			// value (BD7L, TD5N). When it's a value inside a mapping (57H4), the
			// remaining children are sibling mapping pairs.
			if (isRootSeq) {
				checkTrailingContentAfterDocValue(children, i, state, false);
			}
			continue;
		}

		if (child.type === "flow-map") {
			const nextAfterFlowMap0 = findNextContentChild(children, i + 1);
			const flowIsKey = nextAfterFlowMap0 !== null && nextAfterFlowMap0.type === "block-map";
			let flowMeta: NodeMeta | undefined;
			let mapMeta: NodeMeta | undefined;
			if (flowIsKey && hasMeta(outerMeta)) {
				mapMeta = { ...outerMeta };
				flowMeta = hasMeta(meta) ? { ...meta } : undefined;
			} else {
				const combined: NodeMeta = { ...outerMeta };
				if (meta.tag !== undefined) combined.tag = meta.tag;
				if (meta.anchor !== undefined) combined.anchor = meta.anchor;
				flowMeta = hasMeta(combined) ? combined : undefined;
			}
			const flowMap = composeFlowMap(child, state, flowMeta);
			clearMeta(meta);
			clearMeta(outerMeta);
			sawNewlineSinceMeta = false;
			i++;
			if (flowIsKey && nextAfterFlowMap0 !== null) {
        contents = composeBlockMap(nextAfterFlowMap0, state, flowMap, mapMeta);
				while (i < children.length && children[i] !== nextAfterFlowMap0) i++;
				i++;
			} else {
				contents = flowMap;
				checkTrailingContentAfterDocValue(children, i, state);
			}
			continue;
		}

		if (child.type === "flow-seq") {
			const nextAfterFlowSeq0 = findNextContentChild(children, i + 1);
			const flowIsKey = nextAfterFlowSeq0 !== null && nextAfterFlowSeq0.type === "block-map";
			let flowMeta: NodeMeta | undefined;
			let mapMeta: NodeMeta | undefined;
			if (flowIsKey && hasMeta(outerMeta)) {
				mapMeta = { ...outerMeta };
				flowMeta = hasMeta(meta) ? { ...meta } : undefined;
			} else {
				const combined: NodeMeta = { ...outerMeta };
				if (meta.tag !== undefined) combined.tag = meta.tag;
				if (meta.anchor !== undefined) combined.anchor = meta.anchor;
				flowMeta = hasMeta(combined) ? combined : undefined;
			}
			const flowSeq = composeFlowSeq(child, state, flowMeta);
			clearMeta(meta);
			clearMeta(outerMeta);
			sawNewlineSinceMeta = false;
			i++;
			// Check if flow collection is a mapping key (followed by block-map with ":")
			const nextAfterFlowSeq = findNextContentChild(children, i);
			if (nextAfterFlowSeq !== null && nextAfterFlowSeq.type === "block-map") {
				// Flow seq is a key — compose the block-map with this as the first key
        contents = composeBlockMap(nextAfterFlowSeq, state, flowSeq, mapMeta);
				// Skip past the block-map node
				while (i < children.length && children[i] !== nextAfterFlowSeq) i++;
				i++;
			} else {
				contents = flowSeq;
				checkTrailingContentAfterDocValue(children, i, state);
			}
			continue;
		}

		if (child.type === "alias") {
			checkAnchorOnAlias(meta, child, state);
			contents = makeAlias(child, state);
			i++;
			continue;
		}

		i++;
	}

	// Validate directive rules
	validateDirectives(directives, cst, state, hasSubsequentDocuments);

	// Validate document marker same-line content
	checkDocumentMarkerSameLine(children, state, nextDocCst?.children);

	// Detect whether `...` document end marker was present in the CST
	const hasDocEnd = children.some((c) => c.type === "whitespace" && c.source === "...");

	// Detect whether `---` was followed by a tab (K54U). Scan children for the
	// document-start marker; if the immediately-following character in the
	// source is a tab, set the flag so the stringifier can emit `...` for
	// libyaml-compatible canonical output.
	let hasDocStartTab = false;
	for (let ci = 0; ci < children.length; ci++) {
		const c = children[ci];
		if (c !== undefined && c.type === "whitespace" && c.source === "---") {
			const after = state.text[c.offset + c.length];
			if (after === "\t") hasDocStartTab = true;
			break;
		}
	}

	// A blank line separating the leading header comment block from the first
	// content node embeds as a trailing empty line in the stored comment —
	// the same model the block composer applies to a pair's `commentBefore`
	// run (a `.github/dependabot.yml`-style header roundtrips its blank).
	if (documentComment !== undefined && contents !== null && hasBlankLineBelow(state.text, lastLeadingCommentOffset)) {
		documentComment = `${documentComment}\n`;
	}
	if (
		afterMarkerComment !== undefined &&
		contents !== null &&
		hasBlankLineBelow(state.text, lastAfterMarkerCommentOffset)
	) {
		afterMarkerComment = `${afterMarkerComment}\n`;
	}

	// Escaped comments that reached document scope have no carrier on the
	// document model — drop them and clear the queue so nothing leaks into a
	// following document.
	state.escapedComments.length = 0;

	// The ROOT collection's terminal comment run belongs to the DOCUMENT, not
	// to the collection: the document is that collection's enclosing scope, and
	// the escape rule that hands a shallow terminal comment to the outer scope
	// keeps applying at the top. A NESTED collection's terminal run is
	// unaffected — it still ends on the collection that encloses it.
	if (documentCommentAfter === undefined && contents !== null && contents.comment !== undefined) {
		// BLOCK style only: a flow collection's terminal comment sits INSIDE its
		// brackets, so it has nowhere to escape to and stays on the collection.
		if ((YamlMap.is(contents) || YamlSeq.is(contents)) && contents.style !== "flow") {
			documentCommentAfter = contents.comment;
			contents = stripOwnComment(contents);
		}
	}

	// Where a leading header block lands. A `---` between the comment and the
	// content is a boundary:
	// - ahead of the marker, the comment is the DOCUMENT's `commentBefore`;
	// - after the marker, it leads the ROOT NODE;
	// - with no marker at all it is simply the first thing in the document's
	//   item stream, so it forward-attributes to the first ENTRY exactly as any
	//   other own-line comment would.
	let headerForDocument: string | undefined;
	let decorated = contents;
	// Ahead of the marker: the document's own header.
	if (documentComment !== undefined) {
		if (hasDocStart || contents === null) {
			headerForDocument = documentComment;
		} else {
			// No marker to separate it from the item stream, so it is simply the
			// first own-line comment there and forward-attributes to the first entry.
			decorated = attachHeaderToFirstEntry(contents, documentComment);
		}
	}
	// After the marker: leads the root node.
	if (afterMarkerComment !== undefined && decorated !== null) {
		decorated = withCommentFields(decorated, { commentBefore: afterMarkerComment });
	} else if (afterMarkerComment !== undefined) {
		// No content node for it to lead. It still has to go somewhere, so it
		// joins the document's own header rather than being discarded — with a
		// pre-marker header present, taking only one of the two dropped `# b`
		// from `# a\n---\n# b\n` outright.
		headerForDocument =
			headerForDocument === undefined ? afterMarkerComment : `${headerForDocument}\n${afterMarkerComment}`;
	}

	return {
		contents: decorated,
		errors: [...state.errors],
		warnings: [...state.warnings],
		directives,
		hasDocumentStart: hasDocStart,
		hasDocumentEnd: hasDocEnd,
		hasDocumentStartTab: hasDocStartTab,
		...OU.getSomesStruct({ commentBefore: OU.fromUndefinedOr(headerForDocument), comment: OU.fromUndefinedOr(documentCommentAfter) })
	};
});

// ---------------------------------------------------------------------------
// Directive validation
// ---------------------------------------------------------------------------

/**
 * Validate YAML directive rules within a single document's CST.
 * Pushes errors into state.errors for any violations found.
 */
function validateDirectives(
	directives: RawDirective[],
	cst: CstNode,
	state: ComposerState,
	hasSubsequentDocuments = false,
): void {
	const children = cst.children ?? [];

	// Check for duplicate %YAML directives
	const yamlDirectives = directives.filter((d) => d.name === "YAML");
	if (yamlDirectives.length > 1) {
		// Find the second directive's offset in the CST
		let directiveCount = 0;
		for (const child of children) {
			if (child.type === "directive" && child.source.trim().startsWith("%YAML")) {
				directiveCount++;
				if (directiveCount === 2) {
					state.errors.push({
						code: "InvalidDirective",
						message: "Duplicate %YAML directive",
						offset: child.offset,
						length: child.length,
					});
					break;
				}
			}
		}
	}

	// Validate %YAML directive parameters
	for (const child of children) {
		if (child.type !== "directive") continue;
		const src = child.source.trim();
		if (!src.startsWith("%YAML")) continue;

		// Check for comment without preceding whitespace (e.g., %YAML 1.1#...)
		// The lexer consumes the entire line, so we check the raw source
		const hashIdx = src.indexOf("#");
		if (hashIdx > 0) {
			const before = src[hashIdx - 1];
			if (before !== " " && before !== "\t") {
				state.errors.push({
					code: "InvalidDirective",
					message: "Comment in directive requires preceding whitespace",
					offset: child.offset,
					length: child.length,
				});
				continue;
			}
		}

		// Strip inline comment before checking parameters
		const withoutComment = hashIdx > 0 ? src.slice(0, hashIdx).trimEnd() : src;
		const parts = withoutComment.slice(1).split(/\s+/);
		// parts[0] = "YAML", rest are parameters
		const params = parts.slice(1);
		if (params.length !== 1) {
			state.errors.push({
				code: "InvalidDirective",
				message:
					params.length === 0
						? "%YAML directive requires a version parameter"
						: `%YAML directive has extra parameters: ${params.slice(1).join(" ")}`,
				offset: child.offset,
				length: child.length,
			});
		}
	}

	// Check that directives are followed by a document-start marker (---)
	let hasDirective = false;
	let hasDocumentStart = false;
	for (const child of children) {
		if (child.type === "directive") {
			hasDirective = true;
		}
		// document-start markers are consumed as "whitespace" type with source "---"
		if (child.type === "whitespace" && child.source === "---") {
			hasDocumentStart = true;
		}
	}
	if (hasDirective && !hasDocumentStart) {
		// Find the first directive for error position
		for (const child of children) {
			if (child.type === "directive") {
				state.errors.push({
					code: "InvalidDirective",
					message: "Directive must be followed by a document-start marker (---)",
					offset: child.offset,
					length: child.length,
				});
				break;
			}
		}
	}

	// Check that directives don't appear after content within the same document.
	// Only flag this when there are subsequent documents — otherwise the lexer
	// may have incorrectly tokenized plain scalar content (e.g. "%YAML 1.2" as
	// a continuation line) as a directive token.
	if (hasSubsequentDocuments) {
		let hasContent = false;
		for (const child of children) {
			if (
				child.type === "flow-scalar" ||
				child.type === "block-scalar" ||
				child.type === "block-map" ||
				child.type === "block-seq" ||
				child.type === "flow-map" ||
				child.type === "flow-seq" ||
				child.type === "alias" ||
				child.type === "anchor" ||
				child.type === "tag"
			) {
				hasContent = true;
			}
			if (child.type === "directive" && hasContent) {
				state.errors.push({
					code: "InvalidDirective",
					message: "Directive after content requires a document-end marker (...) first",
					offset: child.offset,
					length: child.length,
				});
			}
			// Recursively check for directives inside content nodes (e.g. block-map)
			if (hasContent && child.children !== undefined) {
				const nested = findNestedDirective(child);
				if (nested !== null) {
					state.errors.push({
						code: "InvalidDirective",
						message: "Directive after content requires a document-end marker (...) first",
						offset: nested.offset,
						length: nested.length,
					});
				}
			}
		}
	}
}

/** Recursively find the first directive node within a CST subtree. */
function findNestedDirective(node: CstNode): CstNode | null {
	if (node.type === "directive") return node;
	if (node.children !== undefined) {
		for (const child of node.children) {
			const found = findNestedDirective(child);
			if (found !== null) return found;
		}
	}
	return null;
}

/**
 * Validate directive placement across a multi-document CST stream.
 *
 * YAML 1.2 requires that directives appearing between documents must be
 * preceded by a document-end marker (`...`). This function checks each
 * CST document node after the first: if it contains directives, the
 * preceding document must have ended with `...`.
 *
 * **Gotchas**
 *
 * `%TAG` handles do not leak across `---`. Subsequent documents that use a
 * named handle without a local `%TAG` get `UnresolvedTag`. Directives
 * between documents also require a preceding `...`.
 *
 * **Example** (Require `...` before an inter-document directive)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * const result = Yaml.parseAllResult(
 *   "a: 1\n---\n%TAG !e! tag:example.com,2000:app/\n---\n!e!foo: 1\n",
 * )
 * if (Result.isFailure(result)) {
 *   console.log(result.failure.diagnostics[0]?.message)
 *   // "Directive between documents requires a document-end marker (...) after the previous document"
 * }
 * ```
 *
 * @see {@link validateTagHandlesInDocument} for the per-document handle check.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const validateCrossDocumentDirectives: {
	(cstNodes: readonly CstNode[], state: ComposerState): void;
	(state: ComposerState): (cstNodes: readonly CstNode[]) => void;
} = dual(2, (cstNodes: readonly CstNode[], state: ComposerState): void => {
	for (let docIdx = 1; docIdx < cstNodes.length; docIdx++) {
		const cst = cstNodes[docIdx];
		if (cst === undefined) continue;
		const children = cst.children ?? [];

		// QLJ7: directives are local to a single document. Subsequent
		// documents do not inherit %TAG handles from earlier documents,
		// so a `!handle!` reference here without a local %TAG is unresolved.
		// Run this for every doc >= 1 — even docs that DO declare directives
		// can reference handles those directives didn't define.
		validateTagHandlesInDocument(cst, state);

		// Check if this document has directives
		const hasDirectives = children.some((c) => c.type === "directive");
		if (!hasDirectives) continue;

		// Check if the previous document ended with "..."
		const prevCst = cstNodes[docIdx - 1];
		if (prevCst === undefined) continue;
		const prevChildren = prevCst.children ?? [];
		let prevEndedWithDocEnd = false;
		for (let i = prevChildren.length - 1; i >= 0; i--) {
			const c = prevChildren[i];
			if (c === undefined) continue;
			// Document-end markers are stored as whitespace type with source "..."
			if (c.source === "...") {
				prevEndedWithDocEnd = true;
				break;
			}
			if (c.type === "newline" || c.type === "whitespace" || c.type === "comment") continue;
			break;
		}

		if (!prevEndedWithDocEnd) {
			// Find the first directive in this document for error positioning
			for (const child of children) {
				if (child.type === "directive") {
					state.errors.push({
						code: "InvalidDirective",
						message: "Directive between documents requires a document-end marker (...) after the previous document",
						offset: child.offset,
						length: child.length,
					});
					break;
				}
			}
		}
	}
});

// ---------------------------------------------------------------------------
// sourceMultiline decoration
// ---------------------------------------------------------------------------

/**
 * Walk the AST and stamp `sourceMultiline: true` on every YamlScalar/Map/Seq
 * whose source span (offset..offset+length in `text`) contains a newline.
 *
 * The composer uses this single post-pass instead of threading the flag
 * through dozens of construction sites. Nodes whose span is single-line are
 * returned unchanged (no copy) to avoid unnecessary allocation.
 */
function isSourceMultiline(text: string, offset: number, length: number): boolean {
	if (length <= 0) return false;
	const end = Math.min(offset + length, text.length);
	for (let i = offset; i < end; i++) {
		const ch = text.charCodeAt(i);
		if (ch === 0x0a /* \n */ || ch === 0x0d /* \r */) return true;
	}
	return false;
}

function decorateSourceMultiline(node: YamlNode | null, text: string): YamlNode | null {
	if (node === null || YamlAlias.is(node)) return node;
	if (YamlScalar.is(node)) {
		if (!isSourceMultiline(text, node.offset, node.length)) return node;
		return YamlScalar.make({
			value: node.value,
			style: node.style,
			...OU.getSomesStruct({ tag: OU.fromUndefinedOr(node.tag), anchor: OU.fromUndefinedOr(node.anchor) }),
			...commentProps(node),
			...OU.getSomesStruct({ chomp: OU.fromUndefinedOr(node.chomp), blockIndent: OU.fromUndefinedOr(node.blockIndent), raw: OU.fromUndefinedOr(node.raw) }),
			sourceMultiline: true,
			offset: node.offset,
			length: node.length,
		});
	}
	if (YamlMap.is(node)) {
		const newItems = node.items.map(
			(pair) =>
				YamlPair.make({
					key: decorateSourceMultiline(pair.key, text) ?? pair.key,
					value: pair.value === null ? null : decorateSourceMultiline(pair.value, text),
				}),
		);
		const multiline = isSourceMultiline(text, node.offset, node.length);
		return YamlMap.make({
			items: newItems,
			style: node.style,
			...OU.getSomesStruct({ tag: OU.fromUndefinedOr(node.tag), anchor: OU.fromUndefinedOr(node.anchor) }),
			...commentProps(node),
			...(multiline ? { sourceMultiline: true } : {}),
			offset: node.offset,
			length: node.length,
		});
	}
	if (YamlSeq.is(node)) {
		const newItems = node.items.map((item) => decorateSourceMultiline(item, text) ?? item);
		const multiline = isSourceMultiline(text, node.offset, node.length);
		return YamlSeq.make({
			items: newItems,
			style: node.style,
			...OU.getSomesStruct({ tag: OU.fromUndefinedOr(node.tag), anchor: OU.fromUndefinedOr(node.anchor) }),
			...commentProps(node),
			...(multiline ? { sourceMultiline: true } : {}),
			offset: node.offset,
			length: node.length,
		});
	}
	return node;
}

function decorateDocumentSourceMultiline(doc: RawYamlDocument, text: string): RawYamlDocument {
	const decorated = decorateSourceMultiline(doc.contents ?? null, text);
	if (decorated === doc.contents) return doc;
	return {
		contents: decorated,
		errors: doc.errors,
		warnings: doc.warnings,
		directives: doc.directives,
		...OU.getSomesStruct({ commentBefore: OU.fromUndefinedOr(doc.commentBefore), comment: OU.fromUndefinedOr(doc.comment) }),
		hasDocumentStart: doc.hasDocumentStart,
		hasDocumentEnd: doc.hasDocumentEnd,
		hasDocumentStartTab: doc.hasDocumentStartTab,
	};
}

// ---------------------------------------------------------------------------
// Engine entry points
// ---------------------------------------------------------------------------

/**
 * Empty recovered document used when the CST stream has no document node.
 *
 * **Example** (Empty input parses as `null`)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse(""))) // null
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const EMPTY_DOCUMENT: RawYamlDocument = {
	contents: null,
	errors: [],
	warnings: [],
	directives: [],
	hasDocumentStart: false,
	hasDocumentEnd: false,
	hasDocumentStartTab: false,
};

/**
 * Compose the first document of `text` with full error recovery — v3
 * `parseDocument` semantics minus the Effect wrapper and minus fatal-code
 * filtering (the facade applies `isFatalCode` to the returned diagnostics).
 * Cross-document directive-placement errors are validated into the same
 * state and therefore appear in the returned document's `errors`.
 *
 * **Gotchas**
 *
 * Calling the engine directly and treating `errors.length > 0` as fatal (or
 * as non-fatal) disagrees with {@link Yaml.parse}. Cross-document directive
 * errors appear on this first document's `errors`.
 *
 * **Example** (First document of a two-document stream)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a: 1\n---\nb: 2\n"))) // { a: 1 }
 * ```
 *
 * @see {@link isFatalCode} for the filter the facade applies.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const composeFirstDocument: {
	(text: string, options?: ParseOptionsInput): RawYamlDocument;
	(options?: ParseOptionsInput): (text: string) => RawYamlDocument;
} = dual((args) => P.isString(args[0]), (text: string, options?: ParseOptionsInput): RawYamlDocument =>
	composeFirstDocumentCounted(text, options).document);

/**
 * {@link composeFirstDocument} plus the CST-level document count of the whole
 * stream, from the single CST parse the compose already performs — no second
 * walk, and correct where a regex on `---` is not (a `---` inside a block
 * scalar or quoted string is content, not a document marker). Callers that
 * must refuse multi-document input (the `YamlFormat` single-document
 * contract) read `documentCount` instead of re-parsing.
 *
 * **Gotchas**
 *
 * Fatal-code filtering is still the facade's job. `documentCount` is CST
 * documents, not a regex over `---`.
 *
 * **Example** (Modify refuses a two-document stream)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * const refused = Effect.runSync(
 *   YamlFormat.modify("a: 1\n---\nb: 2\n", ["a"], 9).pipe(
 *     Effect.match({ onFailure: () => true, onSuccess: () => false }),
 *   ),
 * )
 * console.log(refused) // true
 * ```
 *
 * @see {@link isFatalCode} for the filter the facade applies.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
type CountedDocument = { readonly document: RawYamlDocument; readonly documentCount: number };

export const composeFirstDocumentCounted: {
	(text: string, options?: ParseOptionsInput): CountedDocument;
	(options?: ParseOptionsInput): (text: string) => CountedDocument;
} = dual((args) => P.isString(args[0]), (text: string, options?: ParseOptionsInput): CountedDocument => {
	const cstNodes = parseCSTAll(text);
	const state = createState(text, FLOW, options);

	// Validate cross-document directive placement
	validateCrossDocumentDirectives(cstNodes, state);

	const doc = cstNodes[0];
	if (doc === undefined) {
		return { document: EMPTY_DOCUMENT, documentCount: 0 };
	}

	const result = composeDocument(doc, state, cstNodes.length > 1, cstNodes[1]);
	return { document: decorateDocumentSourceMultiline(result, text), documentCount: cstNodes.length };
});

/**
 * Compose every document of `text` with full error recovery — v3
 * `parseAllDocuments` semantics minus the Effect wrapper and minus
 * fatal-code filtering. Each document is composed with a fresh state; the
 * cross-document directive validation runs in its own state whose errors
 * are returned unfiltered as `streamErrors` (v3 filtered these to
 * `InvalidDirective` before failing — the facade applies that filter).
 *
 * **Gotchas**
 *
 * `streamErrors` are unfiltered. The facade applies {@link isFatalCode}
 * (and historically filtered to `InvalidDirective`).
 *
 * **Example** (Two-document stream)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parseAll("a: 1\n---\nb: 2\n"))) // [{ a: 1 }, { b: 2 }]
 * ```
 *
 * @see {@link isFatalCode} for the filter the facade applies.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
type ComposedDocuments = {
	readonly documents: ReadonlyArray<RawYamlDocument>;
	readonly streamErrors: ReadonlyArray<RawDiagnostic>;
};

export const composeAllDocuments: {
	(text: string, options?: ParseOptionsInput): ComposedDocuments;
	(options?: ParseOptionsInput): (text: string) => ComposedDocuments;
} = dual((args) => P.isString(args[0]), (text: string, options?: ParseOptionsInput): ComposedDocuments => {
	const cstNodes = parseCSTAll(text);
	const documents: RawYamlDocument[] = [];

	// Validate cross-document directive placement in an isolated state.
	const crossDocState = createState(text, FLOW, options);
	validateCrossDocumentDirectives(cstNodes, crossDocState);

	for (let i = 0; i < cstNodes.length; i++) {
		const cst = cstNodes[i];
		if (cst === undefined) continue;
		const state = createState(text, FLOW, options);
		const doc = composeDocument(cst, state, i < cstNodes.length - 1, cstNodes[i + 1]);
		documents.push(decorateDocumentSourceMultiline(doc, text));
	}

	return { documents, streamErrors: crossDocState.errors };
});

/**
 * Attach a marker-less document header to the FIRST entry of the content — the
 * first pair's key for a mapping, the first item for a sequence, the node
 * itself for a scalar. Without a `---` boundary the header is just the first
 * own-line comment in the document's item stream, so it forward-attributes
 * like any other.
 */
function attachHeaderToFirstEntry(contents: YamlNode, header: string): YamlNode {
	if (YamlMap.is(contents) && contents.items.length > 0) {
		const first = contents.items[0] as YamlPair;
		const items = [...contents.items];
		items[0] = YamlPair.make({ key: withCommentFields(first.key, { commentBefore: header }), value: first.value });
		return YamlMap.make({
			items,
			style: contents.style,
			...OU.getSomesStruct({ tag: OU.fromUndefinedOr(contents.tag), anchor: OU.fromUndefinedOr(contents.anchor), commentBefore: OU.fromUndefinedOr(contents.commentBefore), comment: OU.fromUndefinedOr(contents.comment), spaceBefore: OU.fromUndefinedOr(contents.spaceBefore), sourceMultiline: OU.fromUndefinedOr(contents.sourceMultiline) }),
			offset: contents.offset,
			length: contents.length,
		});
	}
	if (YamlSeq.is(contents) && contents.items.length > 0) {
		const items = [...contents.items];
		items[0] = withCommentFields(items[0] as YamlNode, { commentBefore: header });
		return YamlSeq.make({
			items,
			style: contents.style,
			...OU.getSomesStruct({ tag: OU.fromUndefinedOr(contents.tag), anchor: OU.fromUndefinedOr(contents.anchor), commentBefore: OU.fromUndefinedOr(contents.commentBefore), comment: OU.fromUndefinedOr(contents.comment), spaceBefore: OU.fromUndefinedOr(contents.spaceBefore), sourceMultiline: OU.fromUndefinedOr(contents.sourceMultiline) }),
			offset: contents.offset,
			length: contents.length,
		});
	}
	return withCommentFields(contents, { commentBefore: header });
}

/** Rebuild a collection without its own trailing `comment`. */
function stripOwnComment(node: YamlMap | YamlSeq): YamlNode {
	const shared = {
		style: node.style,
		...OU.getSomesStruct({ tag: OU.fromUndefinedOr(node.tag), anchor: OU.fromUndefinedOr(node.anchor), commentBefore: OU.fromUndefinedOr(node.commentBefore), spaceBefore: OU.fromUndefinedOr(node.spaceBefore), sourceMultiline: OU.fromUndefinedOr(node.sourceMultiline) }),
		offset: node.offset,
		length: node.length,
	};
	return YamlMap.is(node)
		? YamlMap.make({ items: node.items, ...shared })
		: YamlSeq.make({ items: node.items, ...shared });
}
