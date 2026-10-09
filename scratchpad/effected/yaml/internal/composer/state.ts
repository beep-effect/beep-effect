// Composer state, shared metadata types, and position/text utilities used
// across the composer seams. Imports nothing from the other composer modules
// so every seam can depend on it without cycles.

import type { YamlMap, YamlNode, YamlSeq } from "../../YamlNode.ts";
import type { CstNode } from "../cst.ts";
import type { RawDiagnostic } from "../diagnostics.ts";
import type { ParseOptionsInput } from "../options.ts";
import type { EscapedComment } from "./comments.ts";
import { dual } from "effect/Function";

// ---------------------------------------------------------------------------
// Line/column computation
// ---------------------------------------------------------------------------

// Single-entry memo keyed on the text reference: composition issues one
// lineCol call per AST node against the same document string, so scanning
// from offset 0 on every call made composition O(nodes × length). The index
// is rebuilt only when a different text arrives.
let lineStartsText: string | undefined;
let lineStartsCache: ReadonlyArray<number> = [];

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
 * Zero-based line and column of `offset`. A byte-order mark at the line start
 * occupies no column, matching the lexer and `columnAt`, so a
 * diagnostic's `character` behind a BOM equals the BOM-less document's.
 */
export function lineCol(text: string, offset: number): { line: number; column: number };
export function lineCol(offset: number): (text: string) => { line: number; column: number };
export function lineCol(...args: [text: string, offset: number] | [offset: number]): { line: number; column: number } | ((text: string) => { line: number; column: number }) {
	return dual<
		(...args: [text: string, offset: number] | [offset: number]) => { line: number; column: number } | ((text: string) => { line: number; column: number }),
		(text: string, offset: number) => { line: number; column: number }
	>(2, function lineCol(text: string, offset: number): { line: number; column: number } {
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
})(...args);
}

/**
 * Returns true if offsetA and offsetB are on the same source line (no newline between them).
 */
export function sameLine(text: string, offsetA: number, offsetB: number): boolean;
export function sameLine(offsetA: number, offsetB: number): (text: string) => boolean;
export function sameLine(...args: [text: string, offsetA: number, offsetB: number] | [offsetA: number, offsetB: number]): boolean | ((text: string) => boolean) {
	return dual<
		(...args: [text: string, offsetA: number, offsetB: number] | [offsetA: number, offsetB: number]) => boolean | ((text: string) => boolean),
		(text: string, offsetA: number, offsetB: number) => boolean
	>(3, function sameLine(text: string, offsetA: number, offsetB: number): boolean {
	const lo = Math.min(offsetA, offsetB);
	const hi = Math.max(offsetA, offsetB);
	for (let i = lo; i < hi && i < text.length; i++) {
		if (text[i] === "\n") return false;
	}
	return true;
})(...args);
}

/** Returns true if there is non-whitespace content before `offset` on the same line. */
export function hasNonWhitespaceBeforeOnLine(text: string, offset: number): boolean;
export function hasNonWhitespaceBeforeOnLine(offset: number): (text: string) => boolean;
export function hasNonWhitespaceBeforeOnLine(...args: [text: string, offset: number] | [offset: number]): boolean | ((text: string) => boolean) {
	return dual<
		(...args: [text: string, offset: number] | [offset: number]) => boolean | ((text: string) => boolean),
		(text: string, offset: number) => boolean
	>(2, function hasNonWhitespaceBeforeOnLine(text: string, offset: number): boolean {
	for (let i = offset - 1; i >= 0; i--) {
		const ch = text[i];
		if (ch === "\n" || ch === "\r") return false;
		if (ch !== " " && ch !== "\t") return true;
	}
	return false; // start of string
})(...args);
}

/**
 * Returns the column of the first non-whitespace character on the line
 * containing the given offset. Used to compute the "effective" indent of a
 * line when properties (tag/anchor) precede the actual content scalar —
 * the indent is the leftmost column on the line, not the scalar's column.
 */
export function lineIndentColumn(text: string, offset: number): number;
export function lineIndentColumn(offset: number): (text: string) => number;
export function lineIndentColumn(...args: [text: string, offset: number] | [offset: number]): number | ((text: string) => number) {
	return dual<
		(...args: [text: string, offset: number] | [offset: number]) => number | ((text: string) => number),
		(text: string, offset: number) => number
	>(2, function lineIndentColumn(text: string, offset: number): number {
	let lineStart = offset;
	while (lineStart > 0 && text[lineStart - 1] !== "\n") lineStart--;
	let i = lineStart;
	while (i < text.length && (text[i] === " " || text[i] === "\t")) i++;
	return i - lineStart;
})(...args);
}

// ---------------------------------------------------------------------------
// Metadata for anchors/tags/comments attached to nodes
// ---------------------------------------------------------------------------

export interface NodeMeta {
	anchor?: string;
	tag?: string;
	comment?: string;
}

export function hasMeta(m: NodeMeta): boolean {
	return m.anchor !== undefined || m.tag !== undefined || m.comment !== undefined;
}

export function clearMeta(m: NodeMeta): void {
	delete m.anchor;
	delete m.tag;
	delete m.comment;
}

/**
 * The comment-fidelity field triple carried by the four public node classes
 * (and `YamlPair`). Conditional-spread helper so AST rebuild sites copy all
 * three without hand-maintaining the list — and never emit an explicit
 * `undefined` into a v4 `optionalKey` field.
 */
export function commentProps(n: { commentBefore?: string; comment?: string; spaceBefore?: boolean }): {
	commentBefore?: string;
	comment?: string;
	spaceBefore?: boolean;
} {
	return {
		...(n.commentBefore !== undefined ? { commentBefore: n.commentBefore } : {}),
		...(n.comment !== undefined ? { comment: n.comment } : {}),
		...(n.spaceBefore !== undefined ? { spaceBefore: n.spaceBefore } : {}),
	};
}

// ---------------------------------------------------------------------------
// Composer state
// ---------------------------------------------------------------------------

/**
 * The flow-composer dispatch injected by `document.ts` when creating state.
 * Block composition recurses into flow composition (a block value can be a
 * flow collection) while flow never recurses back into block; threading the
 * flow composers through state keeps `block.ts` from importing `flow.ts`
 * (which imports the shared pair-building machinery from `block.ts` —
 * `noImportCycles` is error-level).
 */
export interface FlowComposers {
	readonly composeFlowMap: (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number) => YamlMap;
	readonly composeFlowSeq: (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number) => YamlSeq;
}

export interface ComposerState {
	readonly text: string;
	readonly anchors: Map<string, YamlNode>;
	aliasCount: number;
	readonly errors: RawDiagnostic[];
	readonly warnings: RawDiagnostic[];
	readonly options: {
		readonly strict: boolean;
		readonly maxAliasCount: number;
		readonly uniqueKeys: boolean;
	};
	/** Tag handle to prefix map from %TAG directives (e.g. "!!" maps to "tag:yaml.org,2002:") */
	tagMap: Map<string, string>;
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

export function createState(text: string, flow: FlowComposers, options?: ParseOptionsInput): ComposerState;
export function createState(flow: FlowComposers, options?: ParseOptionsInput): (text: string) => ComposerState;
export function createState(...args: [text: string, flow: FlowComposers, options?: ParseOptionsInput | undefined] | [flow: FlowComposers, options?: ParseOptionsInput | undefined]): ComposerState | ((text: string) => ComposerState) {
	return dual<
		(...args: [text: string, flow: FlowComposers, options?: ParseOptionsInput | undefined] | [flow: FlowComposers, options?: ParseOptionsInput | undefined]) => ComposerState | ((text: string) => ComposerState),
		(text: string, flow: FlowComposers, options?: ParseOptionsInput) => ComposerState
	>((args) => typeof args[0] === "string", function createState(text: string, flow: FlowComposers, options?: ParseOptionsInput): ComposerState {
	return {
		text,
		anchors: new Map(),
		aliasCount: 0,
		errors: [],
		warnings: [],
		options: {
			strict: options?.strict ?? true,
			maxAliasCount: options?.maxAliasCount ?? 100,
			uniqueKeys: options?.uniqueKeys ?? true,
		},
		tagMap: new Map(),
		flow,
		depth: 0,
		escapedComments: [],
	};
})(...args);
}

/**
 * Maximum collection-nesting depth the composer will recurse into. The
 * composer (and every downstream tree walker: value extraction, stringify,
 * the visitor) recurses per node, so unbounded nesting is a stack-overflow
 * denial-of-service vector. 256 is far beyond any real document and leaves
 * a wide margin under the observed overflow point (~900 nesting levels with
 * the composer's multi-frame recursion chain per level).
 */
export const MAX_NESTING_DEPTH = 256;

/**
 * Enter one collection-nesting level. Returns `false` — after recording a
 * single fatal `NestingDepthExceeded` diagnostic — when the depth budget is
 * exhausted; the caller must then return a leaf placeholder instead of
 * recursing. Balance every `true` return with {@link exitNesting}.
 */
export function enterNesting(state: ComposerState, cst: CstNode): boolean;
export function enterNesting(cst: CstNode): (state: ComposerState) => boolean;
export function enterNesting(...args: [state: ComposerState, cst: CstNode] | [cst: CstNode]): boolean | ((state: ComposerState) => boolean) {
	return dual<
		(...args: [state: ComposerState, cst: CstNode] | [cst: CstNode]) => boolean | ((state: ComposerState) => boolean),
		(state: ComposerState, cst: CstNode) => boolean
	>(2, function enterNesting(state: ComposerState, cst: CstNode): boolean {
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
})(...args);
}

/** Leave one collection-nesting level. */
export function exitNesting(state: ComposerState): void {
	state.depth--;
}
