// Composer state, shared metadata types, and position/text utilities used
// across the composer seams. Imports nothing from the other composer modules
// so every seam can depend on it without cycles.

import type { YamlMap, YamlNode, YamlSeq } from "../../YamlNode.ts";
import type { CstNode } from "../cst.ts";
import type { RawDiagnostic } from "../diagnostics.ts";
import type { ParseOptionsInput } from "../options.ts";
import type { EscapedComment } from "./comments.ts";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { $ScratchpadId } from "@beep/identity/packages";

const $I = $ScratchpadId.create("effected/yaml/internal/composer/state");

// ---------------------------------------------------------------------------
// Line/column computation
// ---------------------------------------------------------------------------

// Single-entry memo keyed on the text reference: composition issues one
// lineCol call per AST node against the same document string, so scanning
// from offset 0 on every call made composition O(nodes × length). The index
// is rebuilt only when a different text arrives.
let lineStartsText: string | undefined;
let lineStartsCache: ReadonlyArray<number> = [];

/**
 * Indexes the source offsets where each line begins for repeated position lookups.
 *
 * **Details**
 *
 * The first line starts at zero; each newline contributes the offset immediately
 * after it, including a trailing empty line. A single-entry cache reuses the
 * index for the same document text.
 *
 * **Example** (Locate line boundaries)
 *
 * ```ts
 * import { getLineStarts } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 *
 * console.log(getLineStarts("a\nb\n").join(",")) // 0,2,4
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function getLineStarts(text: string): ReadonlyArray<number> {
	if (lineStartsText === text) return lineStartsCache;
	const starts = [0];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === "\n") starts.push(i + 1);
	}
	lineStartsText = text;
	lineStartsCache = starts;
	return starts;
}

/**
 * Finds the zero-based line and column of `offset` in the source text.
 *
 * **Details**
 *
 * A byte-order mark at the line start
 * occupies no column, matching the lexer and `columnAt`, so a
 * diagnostic's `character` behind a BOM equals the BOM-less document's.
 * Offsets are clamped to the source bounds before looking up the position.
 *
 * **Example** (Ignore a leading byte-order mark)
 *
 * ```ts
 * import { lineCol } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 *
 * const position = lineCol("\uFEFFabc", 2)
 * console.log(`${position.line}:${position.column}`) // 0:1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function lineCol(...[text, offset]: [text: string, offset: number]): { line: number; column: number } {
	const starts = getLineStarts(text);
	const pos = Math.min(Math.max(offset, 0), text.length);
	// Binary search for the greatest line start <= pos.
	let lo = 0;
	let hi = starts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		const start = starts[mid];
		if (start !== undefined && start <= pos) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}
	const lineStart = starts[lo] ?? 0;
	const bom = text[lineStart] === "\uFEFF" && pos > lineStart ? 1 : 0;
	return { line: lo, column: pos - lineStart - bom };
}

/**
 * Checks whether offsetA and offsetB are on the same source line (no newline between them).
 *
 * **Example** (Compare offsets across a newline)
 *
 * ```ts
 * import { sameLine } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 *
 * console.log(sameLine("ab\ncd", 0, 1)) // true
 * console.log(sameLine("ab\ncd", 0, 3)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export function sameLine(...[text, offsetA, offsetB]: [text: string, offsetA: number, offsetB: number]): boolean {
	const lo = Math.min(offsetA, offsetB);
	const hi = Math.max(offsetA, offsetB);
	for (let i = lo; i < hi && i < text.length; i++) {
		if (text[i] === "\n") return false;
	}
	return true;
}

/**
 * Checks whether there is non-whitespace content before `offset` on the same line.
 *
 * **Details**
 *
 * Spaces and tabs are skipped; a carriage return or newline ends the scan.
 *
 * **Example** (Detect content before a scalar)
 *
 * ```ts
 * import { hasNonWhitespaceBeforeOnLine } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 *
 * console.log(hasNonWhitespaceBeforeOnLine("  key: value", 7)) // true
 * console.log(hasNonWhitespaceBeforeOnLine("  value", 2)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export function hasNonWhitespaceBeforeOnLine(...[text, offset]: [text: string, offset: number]): boolean {
	for (let i = offset - 1; i >= 0; i--) {
		const ch = text[i];
		if (ch === "\n" || ch === "\r") return false;
		if (ch !== " " && ch !== "\t") return true;
	}
	return false; // start of string
}

/**
 * Finds the column of the first non-whitespace character on the line
 * containing the given offset.
 *
 * **Details**
 *
 * Used to compute the "effective" indent of a
 * line when properties (tag/anchor) precede the actual content scalar —
 * the indent is the leftmost column on the line, not the scalar's column.
 *
 * **Example** (Measure indentation before an anchor)
 *
 * ```ts
 * import { lineIndentColumn } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 *
 * console.log(lineIndentColumn("  &name value", 8)) // 2
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function lineIndentColumn(...[text, offset]: [text: string, offset: number]): number {
	let lineStart = offset;
	while (lineStart > 0 && text[lineStart - 1] !== "\n") lineStart--;
	let i = lineStart;
	while (i < text.length && (text[i] === " " || text[i] === "\t")) i++;
	return i - lineStart;
}

// ---------------------------------------------------------------------------
// Metadata for anchors/tags/comments attached to nodes
// ---------------------------------------------------------------------------

/**
 * Describes writable pending anchor, tag, and comment metadata for the next composed node.
 *
 * **Details**
 *
 * Absent metadata keys are omitted rather than assigned undefined.
 *
 * **Example** (Decode pending anchor metadata)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NodeMeta } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 *
 * const meta = S.decodeUnknownSync(NodeMeta)({ anchor: "config" })
 * console.log(meta.anchor) // config
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NodeMeta = S.Struct({
	anchor: S.String.pipe(S.optionalKey, S.mutableKey).annotateKey({ description: "Pending anchor name to attach to the next node." }),
	tag: S.String.pipe(S.optionalKey, S.mutableKey).annotateKey({ description: "Pending explicit tag to attach to the next node." }),
	comment: S.String.pipe(S.optionalKey, S.mutableKey).annotateKey({ description: "Pending comment text to attach to the next node." }),
}).pipe($I.annoteSchema("NodeMeta", { description: "Writable pending composer metadata with absent keys omitted." }));
/**
 * Represents the decoded, writable pending metadata described by {@link NodeMeta}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NodeMeta = typeof NodeMeta.Type;

/**
 * Checks whether an anchor, tag, or comment is waiting to be attached to a node.
 *
 * **Example** (Detect pending metadata)
 *
 * ```ts
 * import { hasMeta } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 *
 * console.log(hasMeta({ anchor: "config" })) // true
 * console.log(hasMeta({})) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export function hasMeta(m: NodeMeta): boolean {
	return m.anchor !== undefined || m.tag !== undefined || m.comment !== undefined;
}

/**
 * Removes pending anchor, tag, and comment keys from the supplied metadata object.
 *
 * **Details**
 *
 * The object is mutated in place so its keys become absent.
 *
 * **Example** (Consume pending metadata)
 *
 * ```ts
 * import { clearMeta, hasMeta } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 * import type { NodeMeta } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 *
 * const meta: NodeMeta = { anchor: "config", comment: "settings" }
 * clearMeta(meta)
 * console.log(hasMeta(meta)) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function clearMeta(m: NodeMeta): void {
	delete m.anchor;
	delete m.tag;
	delete m.comment;
}

/**
 * Copies the comment-fidelity field triple carried by the four public node classes
 * (and `YamlPair`).
 *
 * **Details**
 *
 * Conditional-spread helper so AST rebuild sites copy all
 * three without hand-maintaining the list — and never emit an explicit
 * `undefined` into a v4 `optionalKey` field.
 *
 * **Example** (Copy comments while omitting absent fields)
 *
 * ```ts
 * import { commentProps } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 *
 * const copied = commentProps({ comment: "settings", spaceBefore: false })
 * console.log(copied.comment) // settings
 * console.log(copied.spaceBefore) // false
 * console.log(Object.hasOwn(copied, "commentBefore")) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function commentProps(n: { commentBefore?: string; comment?: string; spaceBefore?: boolean }): {
	commentBefore?: string;
	comment?: string;
	spaceBefore?: boolean;
} {
	return O.getSomesStruct({
		commentBefore: O.fromUndefinedOr(n.commentBefore),
		comment: O.fromUndefinedOr(n.comment),
		spaceBefore: O.fromUndefinedOr(n.spaceBefore),
	});
}

// ---------------------------------------------------------------------------
// Composer state
// ---------------------------------------------------------------------------

/**
 * Provides the flow-composer dispatch injected by `document.ts` when creating state.
 *
 * **Details**
 *
 * Block composition recurses into flow composition (a block value can be a
 * flow collection) while flow never recurses back into block; threading the
 * flow composers through state keeps `block.ts` from importing `flow.ts`
 * (which imports the shared pair-building machinery from `block.ts` —
 * `noImportCycles` is error-level).
 *
 * @category models
 * @since 0.0.0
 */
export interface FlowComposers {
	readonly composeFlowMap: (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number) => YamlMap;
	readonly composeFlowSeq: (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number) => YamlSeq;
}

/**
 * Carries source text, anchors, diagnostics, parsing options, and nesting state
 * shared by composers while building a document.
 *
 * **Details**
 *
 * Flow dispatch connects block composition to flow composition, and escaped
 * comments are retained for the enclosing collection to consume.
 *
 * @category models
 * @since 0.0.0
 */
export interface ComposerState {
	readonly text: string;
	readonly anchors: MutableHashMap.MutableHashMap<string, YamlNode>;
	aliasCount: number;
	readonly errors: RawDiagnostic[];
	readonly warnings: RawDiagnostic[];
	readonly options: {
		readonly strict: boolean;
		readonly maxAliasCount: number;
		readonly uniqueKeys: boolean;
	};
	/** Tag handle to prefix map from %TAG directives (e.g. "!!" maps to "tag:yaml.org,2002:") */
	tagMap: MutableHashMap.MutableHashMap<string, string>;
	/** Flow-composer dispatch — see {@link FlowComposers}. */
	readonly flow: FlowComposers;
	/** Current collection-nesting depth — see {@link enterNesting}. */
	depth: number;
	/**
	 * Comments that outlived a nested collection at a column shallower than
	 * its content — the enclosing composer drains these into its own item
	 * stream right after the nested node lands (see comments.ts
	 * EscapedComment). Cleared at every document boundary.
	 */
	readonly escapedComments: Array<EscapedComment>;
}

/**
 * Initializes per-document composer state with empty anchors, diagnostics, and comment queues.
 *
 * **Details**
 *
 * Strict parsing and unique keys default to true; the alias limit defaults to
 * 100. The supplied flow dispatch is retained, and collection depth starts at zero.
 *
 * **Example** (Inspect default parsing options)
 *
 * ```ts
 * import { createState } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/scratchpad/effected/yaml/internal/composer/flow"
 *
 * const state = createState("", { composeFlowMap, composeFlowSeq })
 * console.log(state.options.maxAliasCount) // 100
 * console.log(state.depth) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function createState(...[text, flow, options]: [text: string, flow: FlowComposers, options?: ParseOptionsInput]): ComposerState {
	return {
		text,
		anchors: MutableHashMap.empty<string, YamlNode>(),
		aliasCount: 0,
		errors: [],
		warnings: [],
		options: {
			strict: options?.strict ?? true,
			maxAliasCount: options?.maxAliasCount ?? 100,
			uniqueKeys: options?.uniqueKeys ?? true,
		},
		tagMap: MutableHashMap.empty<string, string>(),
		flow,
		depth: 0,
		escapedComments: [],
	};
}

/**
 * Limits the maximum collection-nesting depth the composer will recurse into.
 *
 * **Gotchas**
 *
 * The
 * composer (and every downstream tree walker: value extraction, stringify,
 * the visitor) recurses per node, so unbounded nesting is a stack-overflow
 * denial-of-service vector. 256 is far beyond any real document and leaves
 * a wide margin under the observed overflow point (~900 nesting levels with
 * the composer's multi-frame recursion chain per level).
 *
 * **Example** (Inspect the collection depth budget)
 *
 * ```ts
 * import { MAX_NESTING_DEPTH } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 *
 * console.log(MAX_NESTING_DEPTH) // 256
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_NESTING_DEPTH = 256;

/**
 * Enters one collection-nesting level when the depth budget permits recursion.
 *
 * **Gotchas**
 *
 * Returns `false` — after recording a
 * single fatal `NestingDepthExceeded` diagnostic — when the depth budget is
 * exhausted; the caller must then return a leaf placeholder instead of
 * recursing. Balance every `true` return with {@link exitNesting}.
 *
 * **Example** (Reject recursion beyond the depth limit)
 *
 * ```ts
 * import { createState, enterNesting, MAX_NESTING_DEPTH } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/scratchpad/effected/yaml/internal/composer/flow"
 *
 * const state = createState("", { composeFlowMap, composeFlowSeq })
 * state.depth = MAX_NESTING_DEPTH
 * console.log(enterNesting(state, { type: "flow-seq", source: "[]", offset: 0, length: 2 })) // false
 * console.log(state.errors[0]?.code) // NestingDepthExceeded
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function enterNesting(...[state, cst]: [state: ComposerState, cst: CstNode]): boolean {
	if (state.depth >= MAX_NESTING_DEPTH) {
		if (!state.errors.some((e) => e.code === "NestingDepthExceeded")) {
			state.errors.push({
				code: "NestingDepthExceeded",
				message: `Nesting depth exceeded maximum of ${MAX_NESTING_DEPTH}`,
				offset: cst.offset,
				length: 1,
			});
		}
		return false;
	}
	state.depth++;
	return true;
}

/**
 * Leaves one collection-nesting level by decrementing the tracked depth.
 *
 * **Gotchas**
 *
 * Call only to balance a successful {@link enterNesting}; the decrement does
 * not check for an already-zero depth.
 *
 * **Example** (Balance successful collection entry)
 *
 * ```ts
 * import { createState, enterNesting, exitNesting } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/scratchpad/effected/yaml/internal/composer/flow"
 *
 * const state = createState("", { composeFlowMap, composeFlowSeq })
 * if (enterNesting(state, { type: "flow-seq", source: "[]", offset: 0, length: 2 })) {
 *   exitNesting(state)
 * }
 * console.log(state.depth) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function exitNesting(state: ComposerState): void {
	state.depth--;
}
