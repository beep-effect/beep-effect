/**
 * SAX-style CST visitor for YAML documents.
 *
 * **Details**
 *
 * `cstEvents()` walks YAML source text and yields CstVisitorEvent values in
 * document order. All content is delivered as raw source strings — no type
 * resolution occurs at the CST level. Errors are `CstErrorEvent` records;
 * the generator never throws.
 *
 * Block-map nodes do not include their first key scalar. For `name: John`
 * the document children are `flow-scalar("name")` then `block-map(": John")`.
 * The visitor emits that sibling scalar as `CstKeyEvent`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";
import type { CstNode } from "./cst.ts";
import { parseCSTAll } from "./cst-parser.ts";

const $I = $ScratchpadId.create("yaml/internal/cst-visitor");

// ---------------------------------------------------------------------------
// Internal path type
// ---------------------------------------------------------------------------

const CstPath = Schema.Array(Schema.Union([Schema.String, Schema.Finite])).pipe(
	$I.annoteSchema("CstPath", {
		description: "Path of mapping keys and sequence indices attached to an internal CST visitor event.",
	}),
);

type Path = typeof CstPath.Type;

// ---------------------------------------------------------------------------
// Event records
// ---------------------------------------------------------------------------

/**
 * Emitted when the CST visitor enters a document node.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstDocumentStartEventModel = Schema.TaggedStruct("CstDocumentStartEvent", {
	path: CstPath,
	depth: Schema.Finite,
}).pipe($I.annoteSchema("CstDocumentStartEvent", { description: "CST visitor document-entry event." }));

/**
 * TypeScript representation of cST visitor document-entry event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstDocumentStartEvent = typeof CstDocumentStartEventModel.Type;

/**
 * Emitted when the CST visitor exits a document node.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstDocumentEndEventModel = Schema.TaggedStruct("CstDocumentEndEvent", {
	path: CstPath,
	depth: Schema.Finite,
}).pipe($I.annoteSchema("CstDocumentEndEvent", { description: "CST visitor document-exit event." }));

/**
 * TypeScript representation of cST visitor document-exit event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstDocumentEndEvent = typeof CstDocumentEndEventModel.Type;

/**
 * Emitted when the CST visitor enters a block-map or flow-map node.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstMapStartEventModel = Schema.TaggedStruct("CstMapStartEvent", {
	path: CstPath,
	depth: Schema.Finite,
	source: Schema.String,
}).pipe($I.annoteSchema("CstMapStartEvent", { description: "CST visitor mapping-entry event." }));

/**
 * TypeScript representation of cST visitor mapping-entry event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstMapStartEvent = typeof CstMapStartEventModel.Type;

/**
 * Emitted when the CST visitor exits a block-map or flow-map node.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstMapEndEventModel = Schema.TaggedStruct("CstMapEndEvent", {
	path: CstPath,
	depth: Schema.Finite,
}).pipe($I.annoteSchema("CstMapEndEvent", { description: "CST visitor mapping-exit event." }));

/**
 * TypeScript representation of cST visitor mapping-exit event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstMapEndEvent = typeof CstMapEndEventModel.Type;

/**
 * Emitted when the CST visitor enters a block-seq or flow-seq node.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstSeqStartEventModel = Schema.TaggedStruct("CstSeqStartEvent", {
	path: CstPath,
	depth: Schema.Finite,
	source: Schema.String,
}).pipe($I.annoteSchema("CstSeqStartEvent", { description: "CST visitor sequence-entry event." }));

/**
 * TypeScript representation of cST visitor sequence-entry event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstSeqStartEvent = typeof CstSeqStartEventModel.Type;

/**
 * Emitted when the CST visitor exits a block-seq or flow-seq node.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstSeqEndEventModel = Schema.TaggedStruct("CstSeqEndEvent", {
	path: CstPath,
	depth: Schema.Finite,
}).pipe($I.annoteSchema("CstSeqEndEvent", { description: "CST visitor sequence-exit event." }));

/**
 * TypeScript representation of cST visitor sequence-exit event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstSeqEndEvent = typeof CstSeqEndEventModel.Type;

/**
 * Emitted when the CST visitor encounters a scalar that is a map key.
 *
 * **Gotchas**
 *
 * For `name: John` the first key is a sibling `flow-scalar` before the
 * `block-map`, rewritten here as a `CstKeyEvent` whose `source` is `name`.
 * A walker that looks only at `block-map` children misses that key.
 *
 * @see {@link cstEvents} for the generator that emits this event.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstKeyEventModel = Schema.TaggedStruct("CstKeyEvent", {
	path: CstPath,
	depth: Schema.Finite,
	source: Schema.String,
}).pipe($I.annoteSchema("CstKeyEvent", { description: "CST visitor mapping-key event." }));

/**
 * TypeScript representation of cST visitor mapping-key event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstKeyEvent = typeof CstKeyEventModel.Type;

/**
 * Emitted when the CST visitor encounters a scalar that is a map value.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstValueEventModel = Schema.TaggedStruct("CstValueEvent", {
	path: CstPath,
	depth: Schema.Finite,
	source: Schema.String,
}).pipe($I.annoteSchema("CstValueEvent", { description: "CST visitor mapping-value event." }));

/**
 * TypeScript representation of cST visitor mapping-value event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstValueEvent = typeof CstValueEventModel.Type;

/**
 * Emitted when the CST visitor encounters a standalone scalar (not a map key
 * or value — e.g., a sequence item or bare document scalar).
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstScalarEventModel = Schema.TaggedStruct("CstScalarEvent", {
	path: CstPath,
	depth: Schema.Finite,
	source: Schema.String,
}).pipe($I.annoteSchema("CstScalarEvent", { description: "CST visitor standalone-scalar event." }));

/**
 * TypeScript representation of cST visitor standalone-scalar event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstScalarEvent = typeof CstScalarEventModel.Type;

/**
 * Emitted when the CST visitor encounters an alias reference node (including the leading `*`).
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstAliasEventModel = Schema.TaggedStruct("CstAliasEvent", {
	path: CstPath,
	depth: Schema.Finite,
	source: Schema.String,
}).pipe($I.annoteSchema("CstAliasEvent", { description: "CST visitor alias-reference event." }));

/**
 * TypeScript representation of cST visitor alias-reference event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstAliasEvent = typeof CstAliasEventModel.Type;

/**
 * Emitted when the CST visitor encounters a comment node (including the leading `#`).
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstCommentEventModel = Schema.TaggedStruct("CstCommentEvent", {
	path: CstPath,
	depth: Schema.Finite,
	source: Schema.String,
}).pipe($I.annoteSchema("CstCommentEvent", { description: "CST visitor source-comment event." }));

/**
 * TypeScript representation of cST visitor source-comment event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstCommentEvent = typeof CstCommentEventModel.Type;

/**
 * Emitted when the CST visitor encounters a directive node (e.g., `%YAML 1.2`).
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstDirectiveEventModel = Schema.TaggedStruct("CstDirectiveEvent", {
	path: CstPath,
	depth: Schema.Finite,
	source: Schema.String,
}).pipe($I.annoteSchema("CstDirectiveEvent", { description: "CST visitor YAML-directive event." }));

/**
 * TypeScript representation of cST visitor YAML-directive event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstDirectiveEvent = typeof CstDirectiveEventModel.Type;

/**
 * Emitted when the CST visitor encounters an error node in the CST.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
const CstErrorEventModel = Schema.TaggedStruct("CstErrorEvent", {
	path: CstPath,
	depth: Schema.Finite,
	source: Schema.String,
}).pipe($I.annoteSchema("CstErrorEvent", { description: "CST visitor parse-error event." }));

/**
 * TypeScript representation of cST visitor parse-error event.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstErrorEvent = typeof CstErrorEventModel.Type;

/**
 * A discriminated union of all thirteen SAX-style YAML CST visitor events.
 *
 * **Example** (Guard a visitor event)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CstVisitorEvent } from "@beep/scratchpad/yaml/internal/cst-visitor"
 *
 * console.log(S.is(CstVisitorEvent)({ _tag: "CstDocumentStartEvent", path: [], depth: 0 })) // true
 * ```
 *
 * @see {@link cstEvents} for the generator that yields these events.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const CstVisitorEvent = Schema.Union([
	CstDocumentStartEventModel,
	CstDocumentEndEventModel,
	CstMapStartEventModel,
	CstMapEndEventModel,
	CstSeqStartEventModel,
	CstSeqEndEventModel,
	CstKeyEventModel,
	CstValueEventModel,
	CstScalarEventModel,
	CstAliasEventModel,
	CstCommentEventModel,
	CstDirectiveEventModel,
	CstErrorEventModel,
]).pipe(
	$I.annoteSchema("CstVisitorEvent", {
		description: "Discriminated union of SAX-style events emitted while walking YAML concrete syntax.",
	}),
);

/**
 * TypeScript representation of discriminated union of SAX-style events emitted while walking YAML concrete syntax.
 *
 * @internal
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
 * Both flow and block scalars carry raw source text. The distinction matters
 * for the parser but not for the visitor's key/value classification logic.
 */
function isScalarCstNode(node: CstNode): boolean {
	return node.type === "flow-scalar" || node.type === "block-scalar";
}

/**
 * Test whether a CST node is specifically a block-map.
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
 * Used when the traversal needs to emit MapStart/MapEnd events regardless
 * of the map's block vs flow representation.
 */
function isMapCstNode(node: CstNode): boolean {
	return node.type === "block-map" || node.type === "flow-map";
}

/**
 * Test whether a CST node is any kind of sequence (block-seq or flow-seq).
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
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		if (node === undefined) continue;

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
				// Block-map children: first scalar is the value for the key
				// that appeared as the previous sibling. Subsequent scalars
				// alternate as key, value, key, value...
				yield* walkBlockMapChildren(node.children ?? [], path, depth + 1);
			} else {
				// flow-map: key/value alternation starting with key
				yield* walkFlowMapChildren(node.children ?? [], path, depth + 1);
			}
			yield { _tag: "CstMapEndEvent", path, depth };
			continue;
		}

		if (isSeqCstNode(node)) {
			yield { _tag: "CstSeqStartEvent", path, depth, source: node.source };
			yield* walkSiblings(node.children ?? [], path, depth + 1);
			yield { _tag: "CstSeqEndEvent", path, depth };
		}
	}
}

// ---------------------------------------------------------------------------
// findNextContent — look ahead past trivia to the next content node
// ---------------------------------------------------------------------------

/**
 * Look ahead past trivia and comment nodes to find the next content node.
 *
 * Used by {@link walkSiblings} and {@link walkBlockMapChildren} to detect
 * the "scalar followed by block-map" pattern. Returns `undefined` when no
 * content node exists after `startIdx`, which means the scalar is a
 * standalone value rather than a mapping key.
 */
function findNextContent(nodes: ReadonlyArray<CstNode>, startIdx: number): CstNode | undefined {
	for (let i = startIdx; i < nodes.length; i++) {
		const node = nodes[i];
		if (node !== undefined && !isTriviaCstNode(node) && node.type !== "comment") {
			return node;
		}
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// walkBlockMapChildren — the block-map's own children
// ---------------------------------------------------------------------------

/**
 * Walk children of a `block-map` node.
 *
 * Because the first key is emitted as a sibling before the block-map node,
 * the block-map's children start with the `:` indicator (whitespace) and then
 * the first value. After the first value, scalars alternate as key/value
 * pairs for remaining entries.
 *
 * State machine:
 * - `expectingKey = false` initially (first non-trivia scalar is a value)
 * - After each value scalar or collection value, toggle to expecting a key
 * - After each key scalar, toggle to expecting a value
 *
 * The `expectingKey` flag starts as `false` because the first key has already
 * been consumed by the parent {@link walkSiblings} call and emitted as a
 * CstKeyEvent. Nested block-maps are handled recursively; after a nested
 * map is fully walked, the state resets to expecting a key for the next
 * entry. The look-ahead for "scalar → block-map" applies here too, to
 * detect nested mapping keys within the same block-map.
 */
function* walkBlockMapChildren(
	children: ReadonlyArray<CstNode>,
	path: Path,
	depth: number,
): Generator<CstVisitorEvent> {
	// Start expecting a value, because the key was consumed as a sibling of
	// the block-map node (outside the block-map).
	let expectingKey = false;

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child === undefined) continue;

		// Always emit comments
		if (child.type === "comment") {
			yield { _tag: "CstCommentEvent", path, depth, source: child.source };
			continue;
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
			// Look ahead to detect if this scalar is followed by a block-map
			// (meaning it is a key for a nested mapping).
			const nextContent = findNextContent(children, i + 1);
			if (!expectingKey && nextContent !== undefined && isBlockMapCstNode(nextContent)) {
				// This scalar is a key for a nested block-map that follows.
				// The nested map's first value will be the value for this key.
				yield { _tag: "CstKeyEvent", path, depth, source: child.source };
				// expectingKey stays false because the nested block-map will
				// handle the value; after the nested map we'll be back to
				// expecting a key (reset in the isMapCstNode branch).
				// Actually: expectingKey was false, and this is a key, so after
				// emitting the key event we should remain expecting value (false).
				// The nested block-map will consume the value. Don't toggle here.
			} else if (expectingKey) {
				yield { _tag: "CstKeyEvent", path, depth, source: child.source };
				expectingKey = false;
			} else {
				yield { _tag: "CstValueEvent", path, depth, source: child.source };
				expectingKey = true;
			}
			continue;
		}

		if (isBlockMapCstNode(child)) {
			// Nested block-map: it's the value for the key just emitted.
			yield { _tag: "CstMapStartEvent", path, depth, source: child.source };
			yield* walkBlockMapChildren(child.children ?? [], path, depth + 1);
			yield { _tag: "CstMapEndEvent", path, depth };
			// After a nested block-map value, next scalar is a key
			expectingKey = true;
			continue;
		}

		if (isMapCstNode(child)) {
			// flow-map as value
			yield { _tag: "CstMapStartEvent", path, depth, source: child.source };
			yield* walkFlowMapChildren(child.children ?? [], path, depth + 1);
			yield { _tag: "CstMapEndEvent", path, depth };
			expectingKey = true;
			continue;
		}

		if (isSeqCstNode(child)) {
			yield { _tag: "CstSeqStartEvent", path, depth, source: child.source };
			yield* walkSiblings(child.children ?? [], path, depth + 1);
			yield { _tag: "CstSeqEndEvent", path, depth };
			expectingKey = true;
			continue;
		}

		if (child.type === "alias") {
			yield { _tag: "CstAliasEvent", path, depth, source: child.source };
			// Alias is a value; next scalar is a key
			expectingKey = true;
		}
	}
}

// ---------------------------------------------------------------------------
// walkFlowMapChildren — flow-map children (key/value start with key)
// ---------------------------------------------------------------------------

/**
 * Walk children of a `flow-map` node.
 *
 * Flow maps include all their content (including the opening `{` key scalars,
 * `:` separators, and closing `}`) as children. All structural punctuation
 * is typed as `whitespace`. Scalars alternate key/value starting with key.
 *
 * Unlike block maps, flow maps contain their own keys as children, so
 * `expectingKey` starts as `true`. Structural punctuation (`{`, `}`, `:`,
 * `,`) is classified as `whitespace` by the CST parser and skipped as
 * trivia. Nested collections (maps or sequences) found in the value
 * position reset the state to expecting a key after they are fully walked.
 */
function* walkFlowMapChildren(children: ReadonlyArray<CstNode>, path: Path, depth: number): Generator<CstVisitorEvent> {
	let expectingKey = true;

	for (const child of children) {
		// Always emit comments
		if (child.type === "comment") {
			yield { _tag: "CstCommentEvent", path, depth, source: child.source };
			continue;
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
				expectingKey = false;
			} else {
				yield { _tag: "CstValueEvent", path, depth, source: child.source };
				expectingKey = true;
			}
			continue;
		}

		if (isMapCstNode(child)) {
			yield { _tag: "CstMapStartEvent", path, depth, source: child.source };
			if (child.type === "block-map") {
				yield* walkBlockMapChildren(child.children ?? [], path, depth + 1);
			} else {
				yield* walkFlowMapChildren(child.children ?? [], path, depth + 1);
			}
			yield { _tag: "CstMapEndEvent", path, depth };
			expectingKey = true;
			continue;
		}

		if (isSeqCstNode(child)) {
			yield { _tag: "CstSeqStartEvent", path, depth, source: child.source };
			yield* walkSiblings(child.children ?? [], path, depth + 1);
			yield { _tag: "CstSeqEndEvent", path, depth };
			expectingKey = true;
			continue;
		}

		if (child.type === "alias") {
			yield { _tag: "CstAliasEvent", path, depth, source: child.source };
			expectingKey = true;
		}
	}
}

// ---------------------------------------------------------------------------
// walkDocument — generator that yields all events for a single document node
// ---------------------------------------------------------------------------

/**
 * Generator that yields all CST visitor events for a single document node.
 *
 * Wraps the document's children in CstDocumentStartEvent / CstDocumentEndEvent
 * and delegates child traversal to {@link walkSiblings}. The root path is an
 * empty array, and child depth starts at 1 (the document itself is at depth 0).
 */
function* walkDocument(doc: CstNode): Generator<CstVisitorEvent> {
	const path: Path = [];
	const depth = 0;

	yield { _tag: "CstDocumentStartEvent", path, depth };
	yield* walkSiblings(doc.children ?? [], path, depth + 1);
	yield { _tag: "CstDocumentEndEvent", path, depth };
}

// ---------------------------------------------------------------------------
// cstEvents — engine API
// ---------------------------------------------------------------------------

/**
 * Walk YAML source text at the CST level and yield {@link CstVisitorEvent}
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
 * **Gotchas**
 *
 * For `name: John` the first key is a sibling scalar before the block-map.
 * This generator emits it as {@link CstKeyEvent} (`source` is `name`). A
 * walker that looks only at `block-map` children misses that key.
 *
 * **Example** (Parse a one-pair mapping)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("name: John\n"))) // { name: "John" }
 * ```
 *
 * @see {@link CstKeyEvent} for the sibling-key event this rewrite emits.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export function* cstEvents(text: string): Generator<CstVisitorEvent, void, undefined> {
	for (const doc of parseCSTAll(text)) {
		yield* walkDocument(doc);
	}
}
