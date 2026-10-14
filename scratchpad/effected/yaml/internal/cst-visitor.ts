// SAX-style CST visitor for YAML documents.
//
// `cstEvents()` walks YAML source text and yields CstVisitorEvent values in
// document order. All content is delivered as raw source strings — no type
// resolution occurs at the CST level. CST-level parse errors are surfaced as
// CstErrorEvent records rather than thrown failures.
//
// CST structure notes:
//
// The parser produces a CST where block-map nodes do NOT include their first
// key scalar. Instead, the first key of a block mapping appears as a sibling
// node (at the parent level) immediately before the block-map node that holds
// the `:` indicator and value. This means:
//
// For `name: John`, the document children are:
// - `flow-scalar("name")` — the key (outside the block-map)
// - `block-map(": John")` — children start with whitespace(":") then the value
//
// The visitor detects this "scalar → block-map" sibling pattern and emits the
// scalar as a `CstKeyEvent`. Inside a block-map, the first non-trivia scalar
// is a value when the first key is external. Compact mappings in sequences
// contain their first key; indicators also delimit omitted values.

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

import type { CstNode } from "./cst.ts";
import { parseCSTAll } from "./cst-parser.ts";

// ---------------------------------------------------------------------------
// Internal path type
// ---------------------------------------------------------------------------

const $I = $ScratchpadId.create("effected/yaml/internal/cst-visitor");
const Path = S.Array(S.Union([S.String, S.Finite])).annotate($I.annote("Path", {
	description: "Ordered mapping names and sequence indices locating a CST event.",
}));
type Path = typeof Path.Type;

const eventFields = {
	path: Path.annotateKey({ description: "Location of the event in document traversal." }),
	depth: S.Finite.annotateKey({ description: "Nesting depth, with the document at zero." }),
};
const sourceEventFields = {
	...eventFields,
	source: S.String.annotateKey({ description: "Raw source content associated with the event." }),
};
const CstVisitorEvent = S.TaggedUnion({
	CstDocumentStartEvent: eventFields,
	CstDocumentEndEvent: eventFields,
	CstMapStartEvent: sourceEventFields,
	CstMapEndEvent: eventFields,
	CstSeqStartEvent: sourceEventFields,
	CstSeqEndEvent: eventFields,
	CstKeyEvent: sourceEventFields,
	CstValueEvent: sourceEventFields,
	CstScalarEvent: sourceEventFields,
	CstAliasEvent: sourceEventFields,
	CstCommentEvent: sourceEventFields,
	CstDirectiveEvent: sourceEventFields,
	CstErrorEvent: sourceEventFields,
}).annotate($I.annote("CstVisitorEvent", {
	description: "Thirteen tagged SAX event payloads emitted in raw document order.",
}));

/** Normalize optional CST children without inventing sparse entries. */
const childrenOf = (node: CstNode): ReadonlyArray<CstNode> => O.fromNullishOr(node.children).pipe(O.getOrElse(A.empty));

// ---------------------------------------------------------------------------
// Event records
// ---------------------------------------------------------------------------

/**
 * Emitted when the CST visitor enters a document node.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstDocumentStartEvent = typeof CstVisitorEvent.cases.CstDocumentStartEvent.Type;

/**
 * Emitted when the CST visitor exits a document node.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstDocumentEndEvent = typeof CstVisitorEvent.cases.CstDocumentEndEvent.Type;

/**
 * Emitted when the CST visitor enters a block-map or flow-map node.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstMapStartEvent = typeof CstVisitorEvent.cases.CstMapStartEvent.Type;

/**
 * Emitted when the CST visitor exits a block-map or flow-map node.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstMapEndEvent = typeof CstVisitorEvent.cases.CstMapEndEvent.Type;

/**
 * Emitted when the CST visitor enters a block-seq or flow-seq node.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstSeqStartEvent = typeof CstVisitorEvent.cases.CstSeqStartEvent.Type;

/**
 * Emitted when the CST visitor exits a block-seq or flow-seq node.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstSeqEndEvent = typeof CstVisitorEvent.cases.CstSeqEndEvent.Type;

/**
 * Emitted when the CST visitor encounters a scalar that is a map key.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstKeyEvent = typeof CstVisitorEvent.cases.CstKeyEvent.Type;

/**
 * Emitted when the CST visitor encounters a scalar that is a map value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstValueEvent = typeof CstVisitorEvent.cases.CstValueEvent.Type;

/**
 * Emitted when the CST visitor encounters a standalone scalar (not a map key
 * or value — e.g., a sequence item or bare document scalar).
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstScalarEvent = typeof CstVisitorEvent.cases.CstScalarEvent.Type;

/**
 * Emitted when the CST visitor encounters an alias reference node (including the leading `*`).
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstAliasEvent = typeof CstVisitorEvent.cases.CstAliasEvent.Type;

/**
 * Emitted when the CST visitor encounters a comment node (including the leading `#`).
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstCommentEvent = typeof CstVisitorEvent.cases.CstCommentEvent.Type;

/**
 * Emitted when the CST visitor encounters a directive node (e.g., `%YAML 1.2`).
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstDirectiveEvent = typeof CstVisitorEvent.cases.CstDirectiveEvent.Type;

/**
 * Emitted when the CST visitor encounters an error node in the CST.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstErrorEvent = typeof CstVisitorEvent.cases.CstErrorEvent.Type;

/**
 * A discriminated union of all thirteen SAX-style YAML CST visitor events.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstVisitorEvent = typeof CstVisitorEvent.Type;

// ---------------------------------------------------------------------------
// Node classification helpers
// ---------------------------------------------------------------------------

/**
 * Test whether a CST node is structural trivia (whitespace, newline, anchor, or tag).
 *
 * **Details**
 *
 * Trivia nodes are skipped during traversal — they carry no semantic content
 * and are only meaningful for source fidelity. Anchors and tags are classified
 * as trivia here because they are metadata attached to the following content
 * node rather than standalone events.
 */
function isTriviaCstNode(node: CstNode): boolean {
	return node.type === "whitespace" || node.type === "newline" || node.type === "anchor" || node.type === "tag";
}

/**
 * Test whether a CST node is a scalar (flow-scalar or block-scalar).
 *
 * **Details**
 *
 * Both flow and block scalars carry raw source text. The distinction matters
 * for the parser but not for the visitor's key/value classification logic.
 */
function isScalarCstNode(node: CstNode): boolean {
	return node.type === "flow-scalar" || node.type === "block-scalar";
}

/**
 * Test whether a CST node is specifically a block-map.
 *
 * **Details**
 *
 * Distinguished from {@link isMapCstNode} because the "scalar followed by
 * block-map" sibling pattern only applies to block maps, not flow maps.
 */
function isBlockMapCstNode(node: CstNode): boolean {
	return node.type === "block-map";
}

/**
 * Test whether a CST node is any kind of map (block-map or flow-map).
 *
 * **Details**
 *
 * Used when the traversal needs to emit MapStart/MapEnd events regardless
 * of the map's block vs flow representation.
 */
function isMapCstNode(node: CstNode): boolean {
	return node.type === "block-map" || node.type === "flow-map";
}

/**
 * Test whether a CST node is any kind of sequence (block-seq or flow-seq).
 *
 * **Details**
 *
 * Sequences are walked via {@link walkSiblings} for their children, as
 * sequence entries do not have the key/value alternation of maps.
 */
function isSeqCstNode(node: CstNode): boolean {
	return node.type === "block-seq" || node.type === "flow-seq";
}

// ---------------------------------------------------------------------------
// walkSiblings — walk a flat list of sibling nodes, handling the
// "scalar → block-map" pattern for block mapping key detection
// ---------------------------------------------------------------------------

/**
 * Walk an ordered list of sibling CST nodes, emitting events.
 *
 * **Details**
 *
 * This is the core traversal used for document-level children and for
 * sequence entry content. It detects the "scalar immediately followed by a
 * block-map sibling" pattern and emits the scalar as a {@link CstKeyEvent},
 * then walks the block-map as a continuation of the same mapping pair.
 *
 * All other scalars in this context are emitted as {@link CstScalarEvent}.
 *
 * This function is the entry point for both document-level and sequence-level
 * children. It does not maintain key/value alternation state — that logic
 * lives in {@link walkBlockMapChildren} and {@link walkFlowMapChildren}. The
 * look-ahead via {@link findNextContent} is intentionally limited to one node
 * because the CST guarantees that a block-map immediately follows its key
 * scalar without intervening content nodes.
 */
function* walkSiblings(nodes: ReadonlyArray<CstNode>, path: Path, depth: number): Generator<CstVisitorEvent> {
	for (const [i, node] of nodes.entries()) {
		// Skip trivia
		if (isTriviaCstNode(node)) continue;

		if (node.type === "comment") {
			yield { _tag: "CstCommentEvent", path, depth, source: node.source };
			continue;
		}

		if (node.type === "directive") {
			yield { _tag: "CstDirectiveEvent", path, depth, source: node.source };
			continue;
		}

		if (node.type === "error") {
			yield { _tag: "CstErrorEvent", path, depth, source: node.source };
			continue;
		}

		if (node.type === "alias") {
			yield { _tag: "CstAliasEvent", path, depth, source: node.source };
			continue;
		}

		if (isScalarCstNode(node)) {
			// Look ahead: if the next non-trivia sibling is a block-map, this
			// scalar is the key for that mapping.
			const nextContent = findNextContent(nodes, i + 1);
			if (nextContent !== undefined && isBlockMapCstNode(nextContent)) {
				// Emit the scalar as a key event
				yield { _tag: "CstKeyEvent", path, depth, source: node.source };
				// Skip to the block-map (it will be picked up in the next iteration)
			} else {
				yield { _tag: "CstScalarEvent", path, depth, source: node.source };
			}
			continue;
		}

		if (isMapCstNode(node)) {
			yield { _tag: "CstMapStartEvent", path, depth, source: node.source };
			if (node.type === "block-map") {
				// The walker derives whether the first key was a sibling or is
				// included in this compact mapping's children.
				yield* walkBlockMapChildren(childrenOf(node), path, depth + 1);
			} else {
				// flow-map: key/value alternation starting with key
				yield* walkFlowMapChildren(childrenOf(node), path, depth + 1);
			}
			yield { _tag: "CstMapEndEvent", path, depth };
			continue;
		}

		// Every remaining parser-produced sibling is a sequence.
		yield { _tag: "CstSeqStartEvent", path, depth, source: node.source };
		yield* walkSiblings(childrenOf(node), path, depth + 1);
		yield { _tag: "CstSeqEndEvent", path, depth };
	}
}

// ---------------------------------------------------------------------------
// findNextContent — look ahead past trivia to the next content node
// ---------------------------------------------------------------------------

/**
 * Look ahead past trivia and comment nodes to find the next content node.
 *
 * **Details**
 *
 * Used by {@link walkSiblings} and {@link walkBlockMapChildren} to detect
 * the "scalar followed by block-map" pattern. Returns `undefined` when no
 * content node exists after `startIdx`, which means the scalar is a
 * standalone value rather than a mapping key.
 */
function findNextContent(nodes: ReadonlyArray<CstNode>, startIdx: number): CstNode | undefined {
	for (let i = startIdx; i < nodes.length; i++) {
		const node = A.getUnsafe(nodes, i);
		if (!isTriviaCstNode(node) && node.type !== "comment") {
			return node;
		}
	}
	return undefined;
}

/** Find content or an indicator without crossing a physical entry boundary. */
function findMapContent(nodes: ReadonlyArray<CstNode>, startIdx: number): CstNode | undefined {
	// A scalar or collection can absorb the newline terminating an entry.
	// Include that preceding source span in the same-line lookahead.
	if (startIdx > 0) {
		const source = A.getUnsafe(nodes, startIdx - 1).source;
		if (Str.includes("\n")(source) || Str.includes("\r")(source)) return undefined;
	}
	for (let i = startIdx; i < nodes.length; i++) {
		const node = A.getUnsafe(nodes, i);
		if (isTriviaCstNode(node) && (Str.includes("\n")(node.source) || Str.includes("\r")(node.source))) return undefined;
		if (node.type === "comment") continue;
		if (node.type === "whitespace" && (node.source === ":" || node.source === "?")) return node;
		if (!isTriviaCstNode(node)) return node;
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// walkBlockMapChildren — the block-map's own children
// ---------------------------------------------------------------------------

/**
 * Walk children of a `block-map` node.
 *
 * **Details**
 *
 * A leading ':' means the first key was emitted by the parent as a sibling;
 * compact sequence mappings include that key in their children instead.
 * Mapping indicators and the separator after a scalar identify entry roles,
 * so omitted values do not shift subsequent key/value events. The sibling
 * scalar → block-map pattern still identifies nested mappings.
 */
function* walkBlockMapChildren(
	children: ReadonlyArray<CstNode>,
	path: Path,
	depth: number,
): Generator<CstVisitorEvent> {
	// A leading ':' continues a sibling key. Compact sequence mappings
	// instead contain their first key, so start by expecting that key.
	const firstKeyExternal = findMapContent(children, 0)?.source === ":";
	let expectingKey = !firstKeyExternal;
	let keyHasContent = false;
	let crossedNewline = false;

	for (const [i, child] of children.entries()) {
		// The preceding child may contain the boundary instead of leaving a
		// separate newline sibling, including inside a nested collection.
		if (i > 0) {
			const source = A.getUnsafe(children, i - 1).source;
			crossedNewline ||= Str.includes("\n")(source) || Str.includes("\r")(source);
		}
		// Always emit comments
		if (child.type === "comment") {
			yield { _tag: "CstCommentEvent", path, depth, source: child.source };
			continue;
		}

		// Entry indicators determine state even when the preceding value was omitted.
		if (child.type === "newline") crossedNewline = true;
		if (child.type === "whitespace" && child.source === ":") {
			if (crossedNewline && !expectingKey) {
				expectingKey = true;
				keyHasContent = false;
			}
			if (expectingKey && !keyHasContent) yield { _tag: "CstKeyEvent", path, depth, source: "" };
			expectingKey = false;
			keyHasContent = false;
			crossedNewline = false;
		}
		if (child.type === "whitespace" && child.source === "?") {
			expectingKey = true;
			keyHasContent = false;
		}

		// Skip trivia
		if (isTriviaCstNode(child)) {
			continue;
		}

		if (child.type === "directive") {
			yield { _tag: "CstDirectiveEvent", path, depth, source: child.source };
			continue;
		}

		if (child.type === "error") {
			yield { _tag: "CstErrorEvent", path, depth, source: child.source };
			continue;
		}

		if (isScalarCstNode(child)) {
			const nextContent = findMapContent(children, i + 1);
			// A separator after this scalar identifies the next entry's key even
			// when the previous entry had no value to toggle the state.
			if (!expectingKey && nextContent?.source === ":") {
				expectingKey = true;
				keyHasContent = false;
			}
			crossedNewline = false;
			// Look ahead to detect if this scalar is followed by a block-map
			// (meaning it is a key for a nested mapping).
			if (!expectingKey && nextContent !== undefined && isBlockMapCstNode(nextContent)) {
				// This scalar is a key for a nested block-map that follows.
				// The nested map's first value will be the value for this key.
				yield { _tag: "CstKeyEvent", path, depth, source: child.source };
				keyHasContent = true;
			} else if (expectingKey) {
				yield { _tag: "CstKeyEvent", path, depth, source: child.source };
				keyHasContent = true;
			} else {
				yield { _tag: "CstValueEvent", path, depth, source: child.source };
			}
			continue;
		}

		if (isBlockMapCstNode(child)) {
			// Nested block-map: it's the value for the key just emitted.
			yield { _tag: "CstMapStartEvent", path, depth, source: child.source };
			yield* walkBlockMapChildren(childrenOf(child), path, depth + 1);
			yield { _tag: "CstMapEndEvent", path, depth };
			if (expectingKey) keyHasContent = true;
			continue;
		}

		if (isMapCstNode(child)) {
			// flow-map as value
			yield { _tag: "CstMapStartEvent", path, depth, source: child.source };
			yield* walkFlowMapChildren(childrenOf(child), path, depth + 1);
			yield { _tag: "CstMapEndEvent", path, depth };
			if (expectingKey) keyHasContent = true;
			continue;
		}

		if (isSeqCstNode(child)) {
			yield { _tag: "CstSeqStartEvent", path, depth, source: child.source };
			yield* walkSiblings(childrenOf(child), path, depth + 1);
			yield { _tag: "CstSeqEndEvent", path, depth };
			if (expectingKey) keyHasContent = true;
			continue;
		}

		// Every remaining parser-produced child is an alias value.
		yield { _tag: "CstAliasEvent", path, depth, source: child.source };
		if (expectingKey) keyHasContent = true;
	}
}

// ---------------------------------------------------------------------------
// walkFlowMapChildren — flow-map children (key/value start with key)
// ---------------------------------------------------------------------------

/**
 * Walk children of a `flow-map` node.
 *
 * **Details**
 *
 * Flow maps contain their keys, separators, and delimiters as children.
 * Structural punctuation is typed as `whitespace`; ':' starts a value and
 * ',' starts the next key. Scalar fragments and nested collections retain
 * their role until an indicator changes it, including multiline plain text.
 */
function* walkFlowMapChildren(children: ReadonlyArray<CstNode>, path: Path, depth: number): Generator<CstVisitorEvent> {
	let expectingKey = true;
	let keyHasContent = false;

	for (const child of children) {
		// Always emit comments
		if (child.type === "comment") {
			yield { _tag: "CstCommentEvent", path, depth, source: child.source };
			continue;
		}

		// Separators delimit entries, including entries with omitted values.
		if (child.type === "whitespace" && (child.source === "," || child.source === "?")) {
			expectingKey = true;
			keyHasContent = false;
		}
		if (child.type === "whitespace" && child.source === ":") {
			if (expectingKey && !keyHasContent) yield { _tag: "CstKeyEvent", path, depth, source: "" };
			expectingKey = false;
			keyHasContent = false;
		}

		// Skip trivia (includes structural whitespace like "{", "}", ":", ",")
		if (isTriviaCstNode(child)) {
			continue;
		}

		if (child.type === "error") {
			yield { _tag: "CstErrorEvent", path, depth, source: child.source };
			continue;
		}

		if (isScalarCstNode(child)) {
			if (expectingKey) {
				yield { _tag: "CstKeyEvent", path, depth, source: child.source };
				keyHasContent = true;
			} else {
				yield { _tag: "CstValueEvent", path, depth, source: child.source };
			}
			continue;
		}

		if (isMapCstNode(child)) {
			yield { _tag: "CstMapStartEvent", path, depth, source: child.source };
			yield* walkFlowMapChildren(childrenOf(child), path, depth + 1);
			yield { _tag: "CstMapEndEvent", path, depth };
			if (expectingKey) keyHasContent = true;
			continue;
		}

		if (isSeqCstNode(child)) {
			yield { _tag: "CstSeqStartEvent", path, depth, source: child.source };
			yield* walkSiblings(childrenOf(child), path, depth + 1);
			yield { _tag: "CstSeqEndEvent", path, depth };
			if (expectingKey) keyHasContent = true;
			continue;
		}

		// Flow lexing cannot produce directive or document children.
		// Every remaining child is an alias value.
		yield { _tag: "CstAliasEvent", path, depth, source: child.source };
		if (expectingKey) keyHasContent = true;
	}
}

// ---------------------------------------------------------------------------
// walkDocument — generator that yields all events for a single document node
// ---------------------------------------------------------------------------

/**
 * Generator that yields all CST visitor events for a single document node.
 *
 * **Details**
 *
 * Wraps the document's children in CstDocumentStartEvent / CstDocumentEndEvent
 * and delegates child traversal to {@link walkSiblings}. The root path is an
 * empty array, and child depth starts at 1 (the document itself is at depth 0).
 */
function* walkDocument(doc: CstNode): Generator<CstVisitorEvent> {
	const path: Path = [];
	const depth = 0;

	yield { _tag: "CstDocumentStartEvent", path, depth };
	yield* walkSiblings(childrenOf(doc), path, depth + 1);
	yield { _tag: "CstDocumentEndEvent", path, depth };
}

// ---------------------------------------------------------------------------
// cstEvents — engine API
// ---------------------------------------------------------------------------

/**
 * Walks YAML source text at the CST level and yields {@link CstVisitorEvent}
 * values in document order.
 *
 * **Details**
 *
 * Events are emitted for every CST node encountered during traversal,
 * including `CstDocumentStartEvent`/`CstDocumentEndEvent` pairs, collection
 * open/close events, and leaf-node events for scalars, aliases, comments, and
 * directives.
 *
 * All content is delivered as raw source strings — `true` is still the string
 * `"true"`. CST-level errors are surfaced as {@link CstErrorEvent} records;
 * the generator never throws.
 *
 * **Example** (Observe document boundaries around a scalar)
 *
 * ```ts
 * import { cstEvents } from "@beep/scratchpad/effected/yaml/internal/cst-visitor"
 *
 * const tags = Array.from(cstEvents("true"), event => event._tag)
 * console.log(tags.join(",")) // CstDocumentStartEvent,CstScalarEvent,CstDocumentEndEvent
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function* cstEvents(text: string): Generator<CstVisitorEvent, void, undefined> {
	for (const doc of parseCSTAll(text)) {
		yield* walkDocument(doc);
	}
}
