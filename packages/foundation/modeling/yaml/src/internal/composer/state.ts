import { $YamlId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { RawDiagnostic } from "../diagnostics.ts";
import { EscapedComment } from "./comments.ts";
import type { YamlMap, YamlNode, YamlSeq } from "../../YamlNode.ts";
import type { CstNode } from "../cst.ts";
import type { ParseOptionsInput } from "../options.ts";
import type { CommentFields } from "./comments.ts";

const $I = $YamlId.create("internal/composer/state");

type CommentFieldsView = S.Struct.Type<typeof CommentFields.fields>;

let singleEntryMemoText: string | undefined;
let singleEntryMemoLineStarts: ReadonlyArray<number> = [];

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
 * import { getLineStarts } from "@beep/yaml/internal/composer/state"
 *
 * console.log(getLineStarts("a\nb\n").join(",")) // 0,2,4
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function getLineStarts(text: string): ReadonlyArray<number> {
  if (singleEntryMemoText === text) return singleEntryMemoLineStarts;
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\r") {
      if (text[i + 1] === "\n") i++;
      starts.push(i + 1);
    } else if (text[i] === "\n") starts.push(i + 1);
  }
  singleEntryMemoText = text;
  singleEntryMemoLineStarts = starts;
  return starts;
}

/**
 * A zero-based source position: the line and the column within it.
 *
 * **Example** (Construct a source position)
 *
 * ```ts
 * import { LineColumn } from "@beep/yaml/internal/composer/state"
 *
 * const position = LineColumn.make({ line: 0, column: 1 })
 * console.log(position.column) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LineColumn extends S.Opaque<LineColumn, { readonly brand: unique symbol }>()(
  S.Struct({
    line: S.Finite.pipe($I.annoteKey("LineColumn.line", { description: "Zero-based source line." })),
    column: S.Finite.pipe(
      $I.annoteKey("LineColumn.column", {
        description: "Zero-based column within the line; a line-leading byte-order mark occupies none.",
      })
    ),
  }).pipe($I.annoteSchema("LineColumn", { description: "A zero-based source line and column." }))
) {}

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
 * import { lineCol } from "@beep/yaml/internal/composer/state"
 *
 * const position = lineCol("\uFEFFabc", 2)
 * console.log(`${position.line}:${position.column}`) // 0:1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function lineCol(...[text, offset]: [text: string, offset: number]): LineColumn {
  const starts = getLineStarts(text);
  const pos = Math.min(Math.max(offset, 0), text.length);
  let lastLineStartingAtOrBeforePos = 0;
  let hi = starts.length - 1;
  while (lastLineStartingAtOrBeforePos < hi) {
    const mid = (lastLineStartingAtOrBeforePos + hi + 1) >> 1;
    const start = starts[mid];
    if (start !== undefined && start <= pos) {
      lastLineStartingAtOrBeforePos = mid;
    } else {
      hi = mid - 1;
    }
  }
  const line = lastLineStartingAtOrBeforePos;
  const lineStart = A.getUnsafe(starts, line);
  const bom = text[lineStart] === "\uFEFF" && pos > lineStart ? 1 : 0;
  return LineColumn.make({ line, column: pos - lineStart - bom });
}

/**
 * Checks whether offsetA and offsetB are on the same source line (no newline between them).
 *
 * **Example** (Compare offsets across a newline)
 *
 * ```ts
 * import { sameLine } from "@beep/yaml/internal/composer/state"
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
    if (text[i] === "\n" || text[i] === "\r") return false;
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
 * import { hasNonWhitespaceBeforeOnLine } from "@beep/yaml/internal/composer/state"
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
  return false;
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
 * import { lineIndentColumn } from "@beep/yaml/internal/composer/state"
 *
 * console.log(lineIndentColumn("  &name value", 8)) // 2
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function lineIndentColumn(...[text, offset]: [text: string, offset: number]): number {
  let lineStart = offset;
  while (lineStart > 0 && text[lineStart - 1] !== "\n" && text[lineStart - 1] !== "\r") lineStart--;
  let i = lineStart;
  while (i < text.length && (text[i] === " " || text[i] === "\t")) i++;
  return i - lineStart;
}

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
 * import { NodeMeta } from "@beep/yaml/internal/composer/state"
 *
 * const meta = S.decodeUnknownSync(NodeMeta)({ anchor: "config" })
 * console.log(meta.anchor) // config
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class NodeMeta extends S.Opaque<NodeMeta, { readonly brand: unique symbol }>()(
  S.Struct({
    anchor: S.String.pipe(
      S.optionalKey,
      S.mutableKey,
      $I.annoteKey("NodeMeta.anchor", { description: "Pending anchor name to attach to the next node." })
    ),
    tagSpan: S.Struct({
      offset: S.Finite.pipe($I.annoteKey("TagSpan.offset", { description: "Offset of the explicit tag CST token." })),
      length: S.Finite.pipe($I.annoteKey("TagSpan.length", { description: "Length of the explicit tag CST token." })),
    }).pipe(
      $I.annoteSchema("TagSpan", { description: "Exact source span of a pending explicit tag token." }),
      S.optionalKey,
      S.mutableKey,
      $I.annoteKey("NodeMeta.tagSpan", { description: "Source provenance retained while the tag is pending." })
    ),
    tag: S.String.pipe(
      S.optionalKey,
      S.mutableKey,
      $I.annoteKey("NodeMeta.tag", { description: "Pending explicit tag to attach to the next node." })
    ),
    comment: S.String.pipe(
      S.optionalKey,
      S.mutableKey,
      $I.annoteKey("NodeMeta.comment", { description: "Pending comment text to attach to the next node." })
    ),
  }).pipe($I.annoteSchema("NodeMeta", { description: "Writable pending composer metadata with absent keys omitted." }))
) {}

/**
 * Checks whether an anchor, tag, or comment is waiting to be attached to a node.
 *
 * **Example** (Detect pending metadata)
 *
 * ```ts
 * import { hasMeta } from "@beep/yaml/internal/composer/state"
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
 * import { clearMeta, hasMeta, NodeMeta } from "@beep/yaml/internal/composer/state"
 *
 * const meta = NodeMeta.make({ anchor: "config", comment: "settings" })
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
  delete m.tagSpan;
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
 * import { commentProps } from "@beep/yaml/internal/composer/state"
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
export function commentProps(n: CommentFieldsView): CommentFieldsView {
  return O.getSomesStruct({
    commentBefore: O.fromUndefinedOr(n.commentBefore),
    comment: O.fromUndefinedOr(n.comment),
    spaceBefore: O.fromUndefinedOr(n.spaceBefore),
  });
}

/**
 * Records an `UnexpectedToken` diagnostic for a lexer/parser `error` CST node.
 *
 * **Example** (Report an error node)
 *
 * ```ts
 * import { reportUnexpectedContent, createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 *
 * const state = createState("\t", { composeFlowMap, composeFlowSeq })
 * reportUnexpectedContent(state, { type: "error", source: "\t", offset: 0, length: 1 })
 * console.log(state.errors[0]?.message) // Unexpected content: (empty)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export function reportUnexpectedContent(state: ComposerState, ...[child]: [child: CstNode]): void {
  state.errors.push(
    RawDiagnostic.make({
      code: "UnexpectedToken",
      message: `Unexpected content: ${Str.trim(child.source) || "(empty)"}`,
      offset: child.offset,
      length: child.length,
    })
  );
}

/**
 * Records a `tag` CST node as the pending tag, with its source span, and marks
 * its offset as consumed by a node property.
 *
 * **Example** (Record a pending tag)
 *
 * ```ts
 * import { createState, NodeMeta, recordPendingTag } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 *
 * const state = createState("!!str a", { composeFlowMap, composeFlowSeq })
 * const meta = NodeMeta.make({})
 * recordPendingTag(meta, { type: "tag", source: "!!str", offset: 0, length: 5 }, state)
 * console.log(meta.tag, meta.tagSpan?.length) // !!str 5
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function recordPendingTag(meta: NodeMeta, ...[child, state]: [child: CstNode, state: ComposerState]): void {
  meta.tag = child.source;
  meta.tagSpan = { offset: child.offset, length: child.length };
  MutableHashSet.add(state.tagOffsets, child.offset);
}

type CollectionPropsView = Pick<YamlMap, "tag" | "anchor" | "commentBefore" | "comment" | "spaceBefore">;

/**
 * Copies a collection's tag, anchor and comment-fidelity triple for a
 * rebuild, omitting absent fields.
 *
 * **Details**
 *
 * Conditional-spread helper so collection rebuild sites copy all five
 * without hand-maintaining the list — and never emit an explicit
 * `undefined` into a v4 `optionalKey` field.
 *
 * **Example** (Copy collection properties)
 *
 * ```ts
 * import { collectionProps } from "@beep/yaml/internal/composer/state"
 * import { YamlSeq } from "@beep/yaml/YamlNode"
 *
 * const seq = YamlSeq.make({ items: [], style: "flow", anchor: "list", offset: 0, length: 2 })
 * const copied = collectionProps(seq)
 * console.log(copied.anchor, Object.hasOwn(copied, "tag")) // list false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function collectionProps(n: CollectionPropsView): CollectionPropsView {
  return O.getSomesStruct({
    tag: O.fromUndefinedOr(n.tag),
    anchor: O.fromUndefinedOr(n.anchor),
    commentBefore: O.fromUndefinedOr(n.commentBefore),
    comment: O.fromUndefinedOr(n.comment),
    spaceBefore: O.fromUndefinedOr(n.spaceBefore),
  });
}

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
  readonly composeFlowMap: {
    (state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): (cst: CstNode) => YamlMap;
    (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlMap;
  };
  readonly composeFlowSeq: {
    (state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): (cst: CstNode) => YamlSeq;
    (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlSeq;
  };
}

const AnchorTable = S.declare((u: unknown): u is MutableHashMap.MutableHashMap<string, YamlNode> =>
  MutableHashMap.isMutableHashMap(u)
).pipe($I.annoteSchema("AnchorTable", { description: "Mutable anchor name to node table, held by reference." }));

const TagTable = S.declare((u: unknown): u is MutableHashMap.MutableHashMap<string, string> =>
  MutableHashMap.isMutableHashMap(u)
).pipe($I.annoteSchema("TagTable", { description: "Mutable tag handle to prefix table, held by reference." }));

const OffsetSet = S.declare((u: unknown): u is MutableHashSet.MutableHashSet<number> =>
  MutableHashSet.isMutableHashSet(u)
).pipe($I.annoteSchema("OffsetSet", { description: "Mutable set of consumed source offsets, held by reference." }));

/** A cached run of CST nodes; named so declaration emit need not inline the recursive node type. */
interface CstNodeRun extends ReadonlyArray<CstNode> {}

const CstNodes: S.Codec<CstNodeRun> = S.declare((u: unknown): u is CstNodeRun => A.isArray(u)).pipe(
  $I.annoteSchema("CstNodes", { description: "Cached CST nodes, held by reference." })
);

const FlowDispatch: S.Codec<FlowComposers> = S.declare((u: unknown): u is FlowComposers => P.isObject(u)).pipe(
  $I.annoteSchema("FlowDispatch", { description: "Flow-composer dispatch functions, held by reference." })
);

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
export class ComposerState extends S.Opaque<ComposerState, { readonly brand: unique symbol }>()(
  S.Struct({
    aliasCount: S.Finite.pipe(
      S.mutableKey,
      $I.annoteKey("ComposerState.aliasCount", { description: "Alias nodes composed so far in the document." })
    ),
    anchors: AnchorTable.pipe(
      $I.annoteKey("ComposerState.anchors", { description: "Anchor name to the most recent node it labels." })
    ),
    /** Current collection-nesting depth — see {@link enterNesting}. */
    depth: S.Finite.pipe(
      S.mutableKey,
      $I.annoteKey("ComposerState.depth", { description: "Current collection-nesting depth." })
    ),
    errors: RawDiagnostic.pipe(
      S.Array,
      S.mutable,
      $I.annoteKey("ComposerState.errors", { description: "Error diagnostics recorded while composing." })
    ),
    /**
     * Comments that outlived a nested collection at a column shallower than
     * its content — the enclosing composer drains these into its own item
     * stream right after the nested node lands (see comments.ts
     * EscapedComment). Cleared at every document boundary.
     */
    escapedComments: EscapedComment.pipe(
      S.Array,
      S.mutable,
      $I.annoteKey("ComposerState.escapedComments", {
        description: "Comments escaped from a nested collection, awaiting the enclosing composer.",
      })
    ),
    /** Flow-composer dispatch — see {@link FlowComposers}. */
    flow: FlowDispatch.pipe(
      $I.annoteKey("ComposerState.flow", { description: "Flow-composer dispatch threaded from the document composer." })
    ),
    options: S.Struct({
      strict: S.Boolean.pipe(
        $I.annoteKey("ComposerState.options.strict", { description: "Whether parse errors are failures." })
      ),
      maxAliasCount: S.Finite.pipe(
        $I.annoteKey("ComposerState.options.maxAliasCount", { description: "Alias nodes allowed per document." })
      ),
      uniqueKeys: S.Boolean.pipe(
        $I.annoteKey("ComposerState.options.uniqueKeys", { description: "Whether duplicate keys are errors." })
      ),
    }).pipe($I.annoteKey("ComposerState.options", { description: "Resolved parse options with defaults applied." })),
    /** CST tag provenance cached for standalone resolver calls without pending node metadata. */
    tagCstCache: CstNodes.pipe(
      S.optionalKey,
      S.mutableKey,
      $I.annoteKey("ComposerState.tagCstCache", {
        description: "CST tag provenance cached for standalone resolver calls without pending node metadata.",
      })
    ),
    /** Tag handle to prefix map from %TAG directives (e.g. "!!" maps to "tag:yaml.org,2002:") */
    tagMap: TagTable.pipe(
      S.mutableKey,
      $I.annoteKey("ComposerState.tagMap", { description: "Tag handle to prefix map from %TAG directives." })
    ),
    /** Offsets consumed as node properties rather than folded plain-scalar content. */
    tagOffsets: OffsetSet.pipe(
      $I.annoteKey("ComposerState.tagOffsets", {
        description: "Offsets consumed as node properties rather than folded plain-scalar content.",
      })
    ),
    text: S.String.pipe($I.annoteKey("ComposerState.text", { description: "The document source text." })),
    warnings: RawDiagnostic.pipe(
      S.Array,
      S.mutable,
      $I.annoteKey("ComposerState.warnings", { description: "Warning diagnostics recorded while composing." })
    ),
  }).pipe(
    $I.annoteSchema("ComposerState", {
      description:
        "Per-document composer state: source text, anchors, diagnostics, resolved options, nesting depth and flow dispatch.",
    })
  )
) {}

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
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 *
 * const state = createState("", { composeFlowMap, composeFlowSeq })
 * console.log(state.options.maxAliasCount) // 100
 * console.log(state.depth) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function createState(
  ...[text, flow, options]: [text: string, flow: FlowComposers, options?: ParseOptionsInput]
): ComposerState {
  return ComposerState.make({
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
    tagOffsets: MutableHashSet.empty<number>(),
    flow,
    depth: 0,
    escapedComments: [],
  });
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
 * import { MAX_NESTING_DEPTH } from "@beep/yaml/internal/composer/state"
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
 * import { createState, enterNesting, MAX_NESTING_DEPTH } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
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
    if (!A.some(state.errors, (e) => e.code === "NestingDepthExceeded")) {
      state.errors.push(
        RawDiagnostic.make({
          code: "NestingDepthExceeded",
          message: `Nesting depth exceeded maximum of ${MAX_NESTING_DEPTH}`,
          offset: cst.offset,
          length: 1,
        })
      );
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
 * import { createState, enterNesting, exitNesting } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
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
