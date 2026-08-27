/**
 * Composer state, shared metadata types, and position/text utilities used
 * across the composer seams.
 *
 * Imports nothing from the other composer modules so every seam can depend
 * on it without cycles. Holds the `FlowComposers` dispatch, alias budget
 * (`maxAliasCount` default 100), and nesting-depth budget (256).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { O as OU } from "@beep/utils";
import { MutableHashMap, Schema } from "effect";
import { dual } from "effect/Function";
import type { YamlMap, YamlNode, YamlSeq } from "../../YamlNode.ts";
import type { CstNode } from "../cst.ts";
import type { RawDiagnostic } from "../diagnostics.ts";
import type { ParseOptionsInput } from "../options.ts";
import type { EscapedComment } from "./comments.ts";

const $I = $ScratchpadId.create("yaml/internal/composer/state");

// ---------------------------------------------------------------------------
// Line/column computation
// ---------------------------------------------------------------------------

// Single-entry memo keyed on the text reference: composition issues one
// lineCol call per AST node against the same document string, so scanning
// from offset 0 on every call made composition O(nodes × length). The index
// is rebuilt only when a different text arrives (issue #108).
let lineStartsText: string | undefined;
let lineStartsCache: ReadonlyArray<number> = [];

type LineColumn = { readonly line: number; readonly column: number };

/**
 * Line-start offsets for `text`, memoized by string reference.
 *
 * **Gotchas**
 *
 * The memo is process-global and keyed by reference equality, not contents.
 * Composition is sync today; interleaved composition of two different
 * strings would clobber the index. This is not a pure `text → starts`
 * helper.
 *
 * **Example** (Derive the same source position twice)
 *
 * ```ts
 * import { YamlDiagnostic } from "@beep/scratchpad/yaml"
 *
 * const a = YamlDiagnostic.fromRaw(
 *   { code: "UnexpectedToken", message: "x", offset: 2, length: 1 },
 *   "a: 1\n",
 * )
 * const b = YamlDiagnostic.fromRaw(
 *   { code: "UnexpectedToken", message: "x", offset: 2, length: 1 },
 *   "a: 1\n",
 * )
 * console.log(a.line === b.line && a.character === b.character) // true
 * ```
 *
 * @see {@link lineCol} for the binary search over this index.
 * @internal
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
 * Zero-based line/column of `offset` in `text`.
 *
 * **Gotchas**
 *
 * Uses {@link getLineStarts}, so identity of the string matters. The public
 * facade derives `line`/`character` the same way when materializing
 * {@link YamlDiagnostic}.
 *
 * **Example** (Offset 2 of `a: 1` is column 2)
 *
 * ```ts
 * import { YamlDiagnostic } from "@beep/scratchpad/yaml"
 *
 * const d = YamlDiagnostic.fromRaw(
 *   { code: "UnexpectedToken", message: "colon", offset: 1, length: 1 },
 *   "a: 1",
 * )
 * console.log(d.line) // 0
 * console.log(d.character) // 1
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const lineCol: {
  (text: string, offset: number): LineColumn;
  (offset: number): (text: string) => LineColumn;
} = dual(2, (text: string, offset: number): LineColumn => {
  const starts = getLineStarts(text);
  const pos = Math.min(Math.max(offset, 0), text.length);
  // Binary search for the greatest line start <= pos.
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] as number) <= pos) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return {line: lo, column: pos - (starts[lo] as number)};
});

/**
 * Returns true if offsetA and offsetB are on the same source line (no newline between them).
 *
 * **Example** (A mapping pair sits on one line)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a: 1\n"))) // { a: 1 }
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const sameLine: {
  (offsetA: number, offsetB: number): (text: string) => boolean;
  (text: string, offsetA: number, offsetB: number): boolean;
} = dual(3, (text: string, offsetA: number, offsetB: number): boolean => {
  const lo = Math.min(offsetA, offsetB);
  const hi = Math.max(offsetA, offsetB);
  for (let i = lo; i < hi && i < text.length; i++) {
    if (text[i] === "\n") return false;
  }
  return true;
});

/**
 * Returns true if there is non-whitespace content before `offset` on the same line.
 *
 * **Example** (Inline comment follows content)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a: 1 # note\n"))) // { a: 1 }
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const hasNonWhitespaceBeforeOnLine: {
  (text: string, offset: number): boolean,
  (offset: number): (text: string) => boolean
} = dual(2, (text: string, offset: number): boolean => {
  for (let i = offset - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "\n" || ch === "\r") return false;
    if (ch !== " " && ch !== "\t") return true;
  }
  return false; // start of string
});

/**
 * Returns the column of the first non-whitespace character on the line
 * containing the given offset. Used to compute the "effective" indent of a
 * line when properties (tag/anchor) precede the actual content scalar —
 * the indent is the leftmost column on the line, not the scalar's column.
 *
 * **Example** (Anchored nested mapping still parses)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a:\n  &id b: 1\n"))) // { a: { b: 1 } }
 * ```
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const lineIndentColumn: {
  (text: string, offset: number): number,
  (offset: number): (text: string) => number
} = dual(2, (text: string, offset: number): number => {
  let lineStart = offset;
  while (lineStart > 0 && text[lineStart - 1] !== "\n") lineStart--;
  let i = lineStart;
  while (i < text.length && (text[i] === " " || text[i] === "\t")) i++;
  return i - lineStart;
});

// ---------------------------------------------------------------------------
// Metadata for anchors/tags/comments attached to nodes
// ---------------------------------------------------------------------------

/**
 * Pending anchor/tag/comment metadata applied to the next composed node.
 *
 * **Example** (Guard pending node metadata)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NodeMeta } from "@beep/scratchpad/yaml/internal/composer/state"
 *
 * console.log(S.is(NodeMeta)({ anchor: "item", tag: "!!str" })) // true
 * ```
 *
 * @see {@link hasMeta} for the emptiness predicate.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const NodeMeta = Schema.Struct({
  anchor: Schema.mutableKey(Schema.optionalKey(Schema.String)),
  tag: Schema.mutableKey(Schema.optionalKey(Schema.String)),
  comment: Schema.mutableKey(Schema.optionalKey(Schema.String)),
}).pipe(
  $I.annoteSchema("NodeMeta", {
    description: "Mutable pending anchor, tag and comment metadata applied to the next composed YAML node.",
  }),
);

export type NodeMeta = typeof NodeMeta.Type;

/**
 * True when any of anchor, tag, or comment is present.
 *
 * **Example** (Tagged scalar keeps explicit intent)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a: !!str 1\n"))) // { a: "1" }
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export function hasMeta(m: NodeMeta): boolean {
  return m.anchor !== undefined || m.tag !== undefined || m.comment !== undefined;
}

/**
 * Delete every field on a pending metadata bag so it cannot leak onto the
 * next sibling.
 *
 * **Example** (A later untagged sibling is not stained by a prior tag)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a: !!str 1\nb: 2\n"))) // { a: "1", b: 2 }
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
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
 *
 * **Example** (Trailing comments survive a format pass)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("a: 1 # keep\n").includes("# keep")) // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export function commentProps(n: {
  commentBefore?: string;
  comment?: string;
  spaceBefore?: boolean
}): {
  commentBefore?: string;
  comment?: string;
  spaceBefore?: boolean;
} {
  return {
    ...OU.getSomesStruct({ commentBefore: OU.fromUndefinedOr(n.commentBefore), comment: OU.fromUndefinedOr(n.comment), spaceBefore: OU.fromUndefinedOr(n.spaceBefore) })
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
 *
 * **Gotchas**
 *
 * Dispatch is injected. Do not import `flow.ts` from `block.ts`. Examples
 * construct state with the `FLOW` dispatch object, not a block→flow import.
 *
 * **Details**
 *
 * This deliberately remains an interface: it is an injected dispatch port
 * whose fields are mutually-recursive composer functions, not pure data.
 *
 * @see {@link createState} for where this dispatch is stored.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface FlowComposers {
  readonly composeFlowMap: (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number) => YamlMap;
  readonly composeFlowSeq: (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number) => YamlSeq;
}

/**
 * Mutable per-document composer state: source text, anchors, diagnostics,
 * tag handles, flow dispatch, nesting depth, and escaped comments.
 *
 * **Details**
 *
 * This deliberately remains an interface: it is ephemeral mutable runtime
 * state containing `MutableHashMap`s, mutable counters and the executable
 * `FlowComposers` port. Its pure record members (`RawDiagnostic`,
 * `EscapedComment`, `NodeMeta`, and parse options) are schema-owned at their
 * own boundaries; the state container itself is not a decodable payload.
 *
 * @see {@link createState} for the constructor that applies option defaults.
 * @internal
 * @category type-level
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
 * Construct composer state, applying parse-option defaults.
 *
 * **Details**
 *
 * Defaults: `strict: true`, `maxAliasCount: 100` (DoS guard; counts
 * **defined** alias nodes only), `uniqueKeys: true`.
 *
 * **Gotchas**
 *
 * The `flow` dispatch must be injected by `document.ts`. Do not import
 * `flow.ts` from `block.ts` to fill it.
 *
 * **Example** (Alias budget of 100 is the default DoS guard)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml, YamlParseOptions } from "@beep/scratchpad/yaml"
 *
 * const src = "a: &id 1\nb: *id\n"
 * console.log(Result.isSuccess(Yaml.parseResult(src))) // true
 * const limited = Yaml.parseResult(src, YamlParseOptions.make({ maxAliasCount: 0 }))
 * console.log(Result.isFailure(limited)) // true
 * ```
 *
 * @see {@link makeAlias} for the defined-alias counting rule.
 * @see {@link FlowComposers} for the injected dispatch.
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const createState: {
  (text: string, flow: FlowComposers, options?: ParseOptionsInput): ComposerState,
  (flow: FlowComposers, options?: ParseOptionsInput): (text: string) => ComposerState
} = dual(3, (text: string, flow: FlowComposers, options?: ParseOptionsInput): ComposerState => ({
  text,
  anchors: MutableHashMap.empty(),
  aliasCount: 0,
  errors: [],
  warnings: [],
  options: {
    strict: options?.strict ?? true,
    maxAliasCount: options?.maxAliasCount ?? 100,
    uniqueKeys: options?.uniqueKeys ?? true,
  },
  tagMap: MutableHashMap.empty(),
  flow,
  depth: 0,
  escapedComments: [],
}));

/**
 * Maximum collection-nesting depth the composer will recurse into. The
 * composer (and every downstream tree walker: value extraction, stringify,
 * the visitor) recurses per node, so unbounded nesting is a stack-overflow
 * denial-of-service vector. 256 is far beyond any real document and leaves
 * a wide margin under the observed overflow point (~900 nesting levels with
 * the composer's multi-frame recursion chain per level).
 *
 * **Gotchas**
 *
 * Three failure shapes share this budget: composer records
 * `NestingDepthExceeded` and returns a leaf placeholder; CST parsing caps
 * at `256 + 8` so the composer diagnostic always fires first; stringify
 * throws {@link StringifyDepthExceeded} (typed), not `RangeError`.
 *
 * **Example** (Public stringify maps depth overflow to NestingDepthExceeded)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml, YamlDiagnostic } from "@beep/scratchpad/yaml"
 *
 * let nested: unknown = 0
 * for (let i = 0; i < 257; i++) nested = [nested]
 * const failed = Yaml.stringifyResult(nested)
 * console.log(Result.isFailure(failed)) // true
 * if (Result.isFailure(failed)) {
 *   console.log(failed.failure.diagnostics[0]?.code) // "NestingDepthExceeded"
 * }
 * console.log(YamlDiagnostic.isFatal("NestingDepthExceeded")) // true
 * ```
 *
 * @see {@link enterNesting} for the composer-side budget check.
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const MAX_NESTING_DEPTH = 256;

/**
 * Enter one collection-nesting level. Returns `false` — after recording a
 * single fatal `NestingDepthExceeded` diagnostic — when the depth budget is
 * exhausted; the caller must then return a leaf placeholder instead of
 * recursing. Balance every `true` return with {@link exitNesting}.
 *
 * **Gotchas**
 *
 * After 256 successful entries the next call returns false and the caller
 * must return an empty collection placeholder. The diagnostic is recorded
 * once.
 *
 * **Example** (Deep-but-legal nesting still parses)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Result.isSuccess(Yaml.parseResult("a:\n  b:\n    c: 1\n"))) // true
 * ```
 *
 * @see {@link MAX_NESTING_DEPTH} for the 256 cap.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const enterNesting: {
  (state: ComposerState, cst: CstNode): boolean,
  (cst: CstNode): (state: ComposerState) => boolean
} = dual(2, (state: ComposerState, cst: CstNode): boolean => {
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
});

/**
 * Leave one collection-nesting level.
 *
 * **Example** (Nested mapping then sibling still parses)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a:\n  b: 1\nc: 2\n"))) // { a: { b: 1 }, c: 2 }
 * ```
 *
 * @see {@link enterNesting} for the matching enter call.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export function exitNesting(state: ComposerState): void {
  state.depth--;
}
