import { $YamlId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
// Block-collection composition: block mappings (with the sibling-first-key
// CST shape), block sequences, flat block maps, and the shared pair-building
// machinery (`SemanticItem`, `buildPairs`) that flow composition also uses.
//
// Cross-seam recursion into flow composition goes through `state.flow` (see
// `FlowComposers` in `state.ts`) so this module never imports `flow.ts`.
import { YamlAlias, YamlMap, YamlNode, YamlPair, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import { CstNode } from "../cst.ts";
import { RawDiagnostic } from "../diagnostics.ts";
import { checkAnchorOnAlias, getAnchorName, makeAlias, registerAnchor, registerMetaAnchor } from "./anchors.ts";
import {
  blankAboveIsKeepChompContent,
  CommentFields,
  columnAt,
  EscapedComment,
  hasBlankLineAbove,
  isAfterIndicatorOnly,
  isOwnLineAt,
  joinComments,
  joinPendingComments,
  lastNonBlankBefore,
  leadingCommentFields,
  lineBreakBefore,
  PendingComment,
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
  plainScalarWithMeta,
  resolveScalar,
  scalarWithMeta,
  shouldPreserveRaw,
} from "./scalars.ts";
import {
  enterNesting,
  exitNesting,
  hasMeta,
  hasNonWhitespaceBeforeOnLine,
  lineCol,
  lineIndentColumn,
  NodeMeta,
  recordPendingTag,
  reportUnexpectedContent,
  sameLine,
} from "./state.ts";
import type { CstNodeType } from "../cst.ts";
import type { YamlErrorCode } from "../diagnostics.ts";
import type { ComposerState } from "./state.ts";

const isYamlAlias = S.is(YamlAlias);
const isYamlScalar = S.is(YamlScalar);

// ---------------------------------------------------------------------------
// Compose block map
// ---------------------------------------------------------------------------

const $I = $YamlId.create("internal/composer/block");

/**
 * Records a fatal diagnostic before a second property overwrites its pending slot.
 *
 * **Example** (Reject a second scalar anchor)
 *
 * ```ts
 * import { validatePendingProperty } from "@beep/yaml/internal/composer/block"
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 *
 * const state = createState("&a &b value", { composeFlowMap, composeFlowSeq })
 * validatePendingProperty({ type: "anchor", source: "&b", offset: 3, length: 2 }, { anchor: "a" }, state)
 * console.log(state.errors[0]?.code) // UnexpectedToken
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export function validatePendingProperty(
  ...[child, meta, state]: [child: CstNode, meta: NodeMeta, state: ComposerState]
): void {
  if ((child.type === "anchor" && meta.anchor !== undefined) || (child.type === "tag" && meta.tag !== undefined)) {
    state.errors.push(
      RawDiagnostic.make({
        code: "UnexpectedToken",
        message: `Node cannot have two ${child.type} declarations`,
        offset: child.offset,
        length: child.length,
      })
    );
  }
}

/**
 * Compose a block map from its CST children, with an optional external first key.
 *
 * **Details**
 *
 * CST pattern for `a: 1, b: true`:
 *   `[flow-scalar("a"), block-map(children: [":"," ","1","\\n","b",":"," ","true"])]`
 *
 * The first key is external (sibling before block-map in document/parent).
 * Subsequent keys are inside the block-map children.
 *
 * **Example** (Compose an empty anchored mapping)
 *
 * ```ts
 * import { composeBlockMap } from "@beep/yaml/internal/composer/block"
 * import { createState, NodeMeta } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 * import type { CstNode } from "@beep/yaml/internal/cst"
 *
 * const state = createState("", { composeFlowMap, composeFlowSeq })
 * const source: CstNode = { type: "block-map", source: "", offset: 0, length: 0 }
 * const map = composeBlockMap(source, state, undefined, NodeMeta.make({ anchor: "config" }))
 * console.log(`${map.style}:${map.items.length}:${map.anchor}`) // block:0:config
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const composeBlockMap: {
  (state: ComposerState, externalFirstKey?: YamlNode, meta?: NodeMeta): (blockMapCst: CstNode) => YamlMap;
  (blockMapCst: CstNode, state: ComposerState, externalFirstKey?: YamlNode, meta?: NodeMeta): YamlMap;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (blockMapCst: CstNode, state: ComposerState, externalFirstKey?: YamlNode, meta?: NodeMeta): YamlMap => {
    // Nesting-depth guard: unbounded recursion is a stack-overflow DoS vector.
    if (!enterNesting(state, blockMapCst)) {
      return YamlMap.make({
        items: [],
        style: "block",
        offset: blockMapCst.offset,
        length: blockMapCst.length,
      });
    }
    try {
      return composeBlockMapInner(blockMapCst, state, externalFirstKey, meta);
    } finally {
      exitNesting(state);
    }
  }
);

const composeBlockMapInner: {
  (state: ComposerState, externalFirstKey?: YamlNode, meta?: NodeMeta): (blockMapCst: CstNode) => YamlMap;
  (blockMapCst: CstNode, state: ComposerState, externalFirstKey?: YamlNode, meta?: NodeMeta): YamlMap;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (blockMapCst: CstNode, state: ComposerState, externalFirstKey?: YamlNode, meta?: NodeMeta): YamlMap => {
    const children = blockMapCst.children ?? [];
    const pairs: YamlPair[] = [];

    // Phase 1: parse children into a flat stream of semantic items.
    // The key's "effective column" for indentation purposes is the leftmost
    // non-whitespace column on the line containing the key — properties (tags,
    // anchors) before the scalar can shift the actual scalar offset to a
    // larger column, but the property column is what matters for validating
    // continuation-line indentation.
    const extKeyOffset = externalFirstKey?.offset;
    const extKeyCol = extKeyOffset !== undefined ? lineIndentColumn(state.text, extKeyOffset) : undefined;
    const items = flattenBlockMapChildren(children, state, extKeyCol, extKeyOffset);

    // If there's an external first key, prepend it
    if (externalFirstKey !== undefined) {
      items.unshift(SemanticKey.make({ kind: "key", node: externalFirstKey }));
    }

    // Phase 2: pair up keys and values
    const trailingComment = buildPairs(items, pairs, state.text, state.escapedComments);

    if (state.options.uniqueKeys) checkDuplicateKeys(pairs, state);
    checkMultilineImplicitKeys(pairs, state);

    const offset = externalFirstKey?.offset ?? blockMapCst.offset;
    const end = trimDisownedTrailingComments(
      state.text,
      offset,
      blockMapCst.offset + blockMapCst.length,
      state.escapedComments
    );
    const length = end - offset;

    return finishBlockMap(pairs, trailingComment, meta, state, offset, length);
  }
);

/**
 * Build a composed block mapping: `meta`'s comment joins the trailing
 * comment, `meta`'s tag and anchor attach, and the anchor (when non-empty)
 * registers at `offset`.
 */
function finishBlockMap(
  pairs: Array<YamlPair>,
  ...[trailingComment, meta, state, offset, length]: [
    trailingComment: string | undefined,
    meta: NodeMeta | undefined,
    state: ComposerState,
    offset: number,
    length: number,
  ]
): YamlMap {
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

  registerMetaAnchor(map, meta, state, offset);
  return map;
}

/** Report an implicit mapping key whose source span crosses a line break. */
function reportMultilineImplicitKey(state: ComposerState, key: YamlNode): void {
  const keySource = Str.slice(key.offset, key.offset + key.length)(state.text);
  if (Str.includes("\n")(keySource) || Str.includes("\r")(keySource)) {
    state.errors.push(
      RawDiagnostic.make({
        code: "UnexpectedToken",
        message: "Implicit mapping key must not span multiple lines",
        offset: key.offset,
        length: key.length,
      })
    );
  }
}

/**
 * Narrow a block collection's raw CST span so it stops before any trailing
 * comment line the collection's own comment model has already DISOWNED.
 *
 * **Details**
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
const trimDisownedTrailingComments: {
  (text: string, offset: number, end: number, disowned: ReadonlyArray<EscapedComment>): number;
  (offset: number, end: number, disowned: ReadonlyArray<EscapedComment>): (text: string) => number;
} = dual(4, (text: string, offset: number, end: number, disowned: ReadonlyArray<EscapedComment>): number => {
  const cut = cutBeforeDisownedComments(text, offset, end, disowned);
  return cut === end ? end : absorbBlankLinesAbove(text, offset, cut);
});

/** Start offset of the line containing `offset`. */
const lineStartBefore = (text: string, offset: number): number => lineBreakBefore(text, offset - 1) + 1;

/** The earliest line start of a comment this collection disowned, or `end`. */
const cutBeforeDisownedComments = (
  text: string,
  offset: number,
  end: number,
  disowned: ReadonlyArray<EscapedComment>
): number => {
  let cut = end;
  for (const ec of disowned) {
    // Only comments disowned by THIS collection: `state.escapedComments` is a
    // shared channel, so an entry outside the span belongs to another node.
    if (ec.offset < offset || ec.offset >= cut) continue;
    const lineStart = lineStartBefore(text, ec.offset);
    // A collection never shrinks past its own first line.
    if (lineStart > offset && lineStart < cut) cut = lineStart;
  }
  return cut;
};

/** Start of the blank line ending just before `cut`, or -1 when that line is not blank or not inside the span. */
const blankLineStartBefore = (text: string, offset: number, cut: number): number => {
  const prevEnd = text[cut - 1] === "\n" && text[cut - 2] === "\r" ? cut - 2 : cut - 1;
  // Search only the prefix before `prevEnd`, as `lineBreakBefore` clamps a negative index to 0:
  // with `prevEnd` 0 the empty prefix yields -1, so the line starts at 0, not 1.
  const prevLineStart = lineBreakBefore(Str.slice(0, prevEnd)(text), prevEnd - 1) + 1;
  if (prevLineStart <= offset) return -1;
  return Str.trim(Str.slice(prevLineStart, prevEnd)(text)) === "" ? prevLineStart : -1;
};

/** Moves `cut` back over the blank lines immediately above a trimmed run. */
const absorbBlankLinesAbove = (text: string, offset: number, start: number): number => {
  let cut = start;
  while (cut > offset && (text[cut - 1] === "\n" || text[cut - 1] === "\r")) {
    const prevLineStart = blankLineStartBefore(text, offset, cut);
    if (prevLineStart < 0) break;
    cut = prevLineStart;
  }
  return cut;
};

/**
 * An explicit or external key marker; an empty explicit key omits its node.
 *
 * **Example** (Mark an empty explicit key)
 *
 * ```ts
 * import { SemanticKey } from "@beep/yaml/internal/composer/block"
 *
 * const item = SemanticKey.make({ kind: "key" })
 * console.log(item.kind) // key
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SemanticKey extends S.Opaque<
  SemanticKey,
  {
    readonly brand: unique symbol;
  }
>()(
  S.Struct({
    kind: S.tag("key").pipe(
      S.mutableKey,
      $I.annoteKey("SemanticItem.Key.kind", { description: "Explicit or external key marker." })
    ),
    node: YamlNode.pipe(
      S.optionalKey,
      S.mutableKey,
      $I.annoteKey("SemanticItem.Key.node", { description: "Optional key node; an explicit-key marker may be empty." })
    ),
  }).pipe(
    $I.annoteSchema("SemanticItem.Key", {
      description: "An explicit or external key marker; an empty explicit key omits its node.",
    })
  )
) {}

/**
 * A mapping value separator carrying the source offset of its colon.
 *
 * **Details**
 *
 * `closed` marks a flow separator followed directly by the `,` entry
 * separator (`{a: , b}`): the value is empty, so the next entry's key cannot
 * become it.
 *
 * **Example** (Mark a value separator)
 *
 * ```ts
 * import { SemanticValueSep } from "@beep/yaml/internal/composer/block"
 *
 * const item = SemanticValueSep.make({ kind: "value-sep", offset: 4 })
 * console.log(item.kind) // value-sep
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SemanticValueSep extends S.Opaque<
  SemanticValueSep,
  {
    readonly brand: unique symbol;
  }
>()(
  S.Struct({
    kind: S.tag("value-sep").pipe(
      S.mutableKey,
      $I.annoteKey("SemanticItem.ValueSep.kind", { description: "Mapping value separator." })
    ),
    offset: S.Finite.pipe(
      S.mutableKey,
      $I.annoteKey("SemanticItem.ValueSep.offset", { description: "Source offset of the structural colon." })
    ),
    closed: S.Boolean.pipe(
      S.optionalKey,
      S.mutableKey,
      $I.annoteKey("SemanticItem.ValueSep.closed", {
        description: "Whether a flow entry separator directly follows the colon, so the value is empty.",
      })
    ),
  }).pipe(
    $I.annoteSchema("SemanticItem.ValueSep", {
      description: "A mapping value separator carrying the source offset of its colon.",
    })
  )
) {}

/**
 * A composed content node awaiting pairing.
 *
 * **Example** (Wrap a composed scalar)
 *
 * ```ts
 * import { SemanticNode } from "@beep/yaml/internal/composer/block"
 * import { YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const item = SemanticNode.make({ kind: "node", node: YamlScalar.make({ value: "a", style: "plain", offset: 0, length: 1 }) })
 * console.log(item.kind) // node
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SemanticNode extends S.Opaque<
  SemanticNode,
  {
    readonly brand: unique symbol;
  }
>()(
  S.Struct({
    kind: S.tag("node").pipe(
      S.mutableKey,
      $I.annoteKey("SemanticItem.Node.kind", { description: "Composed content node." })
    ),
    node: YamlNode.pipe(S.mutableKey, $I.annoteKey("SemanticItem.Node.node", { description: "Composed YAML node." })),
  }).pipe($I.annoteSchema("SemanticItem.Node", { description: "A composed content node awaiting pairing." }))
) {}

/**
 * A raw comment awaiting attribution, with its source offset.
 *
 * **Example** (Hold a pending comment)
 *
 * ```ts
 * import { SemanticComment } from "@beep/yaml/internal/composer/block"
 *
 * const item = SemanticComment.make({ kind: "comment", comment: " note", offset: 3 })
 * console.log(item.kind) // comment
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SemanticComment extends S.Opaque<
  SemanticComment,
  {
    readonly brand: unique symbol;
  }
>()(
  S.Struct({
    kind: S.tag("comment").pipe(
      S.mutableKey,
      $I.annoteKey("SemanticItem.Comment.kind", { description: "Comment awaiting attribution." })
    ),
    comment: S.String.pipe(
      S.mutableKey,
      $I.annoteKey("SemanticItem.Comment.comment", { description: "Raw post-indicator comment text." })
    ),
    offset: S.Finite.pipe(
      S.mutableKey,
      $I.annoteKey("SemanticItem.Comment.offset", { description: "Source offset of the comment." })
    ),
  }).pipe(
    $I.annoteSchema("SemanticItem.Comment", {
      description: "A raw comment awaiting attribution, with its source offset.",
    })
  )
) {}

/**
 * The semantic comment item for a `comment` CST node: its raw post-indicator
 * text at the node's offset.
 *
 * **Example** (Wrap a comment node)
 *
 * ```ts
 * import { commentItem } from "@beep/yaml/internal/composer/block"
 *
 * const item = commentItem({ type: "comment", source: "# note", offset: 3, length: 6 })
 * console.log(JSON.stringify(item.comment), item.offset) // " note" 3
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const commentItem = (child: CstNode): SemanticComment =>
  SemanticComment.make({
    kind: "comment",
    comment: rawCommentText(child.source),
    offset: child.offset,
  });

/**
 * Describes the semantic tokens used to pair composed mapping keys and values.
 *
 * **Details**
 *
 * Key markers may omit their node for an empty explicit key. Value separators
 * carry a source offset, content tokens carry a YAML node, and comment tokens
 * carry raw comment text and its source offset.
 *
 * **Example** (Decode a structural value separator)
 *
 * ```ts
 * import { SemanticItem } from "@beep/yaml/internal/composer/block"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(SemanticItem)({ kind: "value-sep", offset: 4 })
 * console.log(item.kind) // value-sep
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SemanticItem = S.Union([SemanticKey, SemanticValueSep, SemanticNode, SemanticComment]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("SemanticItem", {
    description: "Composition tokens with kind-specific payloads; explicit keys may be node-less.",
  })
);

/**
 * Represents a decoded mapping token, including empty explicit keys, value separators, content nodes, and comments.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SemanticItem = typeof SemanticItem.Type;

// ---------------------------------------------------------------------------
// Block-map flattening walk
// ---------------------------------------------------------------------------

/** Records a diagnostic spanning `span` in the state's error channel. */
const reportSpan = (
  state: ComposerState,
  code: YamlErrorCode,
  message: string,
  span: { readonly offset: number; readonly length: number }
): void =>
  void state.errors.push(
    RawDiagnostic.make({
      code,
      message,
      offset: span.offset,
      length: span.length,
    })
  );

/** True for a structural punctuation token carrying exactly `source`. */
const isPunctuationToken = (node: CstNode | undefined, source: string): boolean =>
  node?.type === "whitespace" && node.source === source;

/** True for a whitespace token that carries nothing but blanks. */
const isBlankWhitespaceToken = (node: CstNode | undefined): boolean =>
  node?.type === "whitespace" && Str.trim(node.source) === "";

/** True for a plain-style flow scalar. */
const isPlainFlowScalarNode = (node: CstNode): boolean =>
  node.type === "flow-scalar" && getScalarStyle(node) === "plain";

/** The metadata, or `undefined` when it carries nothing. */
const metaOrUndefined = (meta: NodeMeta): NodeMeta | undefined => (hasMeta(meta) ? meta : undefined);

/**
 * The nearest preceding child that is not a hole, blank whitespace or a
 * newline; `undefined` when the walk runs off the start.
 */
const precedingSignificantChild: {
  (children: readonly CstNode[], index: number): CstNode | undefined;
  (index: number): (children: readonly CstNode[]) => CstNode | undefined;
} = dual(2, (children: readonly CstNode[], index: number): CstNode | undefined => {
  for (let p = index - 1; p >= 0; p--) {
    const prev = children[p];
    if (prev === undefined || prev.type === "newline" || isBlankWhitespaceToken(prev)) continue;
    return prev;
  }
  return undefined;
});

const BlockMapScan = S.Struct({
  children: S.Array(CstNode).pipe(
    $I.annoteKey("BlockMapScan.children", { description: "Block-map CST children being flattened." })
  ),
  items: SemanticItem.pipe(
    S.Array,
    S.mutable,
    $I.annoteKey("BlockMapScan.items", { description: "Semantic items emitted so far." })
  ),
  index: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("BlockMapScan.index", { description: "Cursor into the CST children." })
  ),
  pendingMeta: NodeMeta.pipe(
    S.mutableKey,
    $I.annoteKey("BlockMapScan.pendingMeta", { description: "Anchor and tag awaiting the upcoming content." })
  ),
  outerMeta: NodeMeta.pipe(
    S.mutableKey,
    $I.annoteKey("BlockMapScan.outerMeta", {
      description: "Anchor and tag that came before a newline in value position; they apply to the container.",
    })
  ),
  sawNewlineSincePending: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("BlockMapScan.sawNewlineSincePending", {
      description: "Whether a newline followed the most recent pending property.",
    })
  ),
  afterValueSep: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("BlockMapScan.afterValueSep", { description: "Whether the walk is in value position." })
  ),
  lastValueSepOffset: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("BlockMapScan.lastValueSepOffset", { description: "Offset of the latest `:`, or -1." })
  ),
  lastKeyColumn: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("BlockMapScan.lastKeyColumn", { description: "Entry column of the latest key, or -1." })
  ),
  lastKeyOffset: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("BlockMapScan.lastKeyOffset", { description: "Offset of the latest key, or -1." })
  ),
  hasExternalKeyColumn: S.Boolean.pipe(
    $I.annoteKey("BlockMapScan.hasExternalKeyColumn", {
      description: "Whether the key column came from an externally-provided first key.",
    })
  ),
  pendingExplicitKeyCol: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("BlockMapScan.pendingExplicitKeyCol", {
      description: "Column of a `?` indicator awaiting its key, or -1.",
    })
  ),
}).pipe(
  $I.annoteSchema("BlockMapScan", {
    description: "Structural state of the block-map flattening walk, constructed directly.",
  })
);
type BlockMapScan = typeof BlockMapScan.Type;

/**
 * Data-first detection for the `BlockMapScan` helpers whose trailing
 * parameters are optional: a fixed `dual` arity would curry a call that omits
 * them, so dispatch on the scan itself instead.
 */
const isBlockMapScanFirst = (args: IArguments): boolean => P.hasProperty(args[0], "sawNewlineSincePending");

const makeBlockMapScan: {
  (
    children: readonly CstNode[],
    externalKeyColumn: number | undefined,
    externalKeyOffset: number | undefined
  ): BlockMapScan;
  (
    externalKeyColumn: number | undefined,
    externalKeyOffset: number | undefined
  ): (children: readonly CstNode[]) => BlockMapScan;
} = dual(
  3,
  (
    children: readonly CstNode[],
    externalKeyColumn: number | undefined,
    externalKeyOffset: number | undefined
  ): BlockMapScan => ({
    children,
    items: [],
    index: 0,
    pendingMeta: NodeMeta.make({}),
    // Outer meta: anchor/tag that came BEFORE a newline in value position. Applies
    // to the surrounding container (e.g. block map) when the inner content has its
    // own metadata. Without this split, two adjacent anchors collapse and the first
    // is lost (test 7BMT, U3XV: `top: &outer\n  &inner key: val`).
    outerMeta: NodeMeta.make({}),
    sawNewlineSincePending: false,
    afterValueSep: false,
    lastValueSepOffset: -1,
    lastKeyColumn: externalKeyColumn ?? -1,
    lastKeyOffset: externalKeyOffset ?? -1,
    // Whether `lastKeyColumn` originated from an externally-provided first key
    // (i.e., the parser placed the first key as a sibling before the block-map).
    // Only externally-anchored columns are used for indentation validation —
    // internally-tracked columns may include malformed CST artifacts and
    // shouldn't trigger validation errors.
    hasExternalKeyColumn: externalKeyColumn !== undefined,
    // When `?` explicit-key indicator is seen, the entry indent is the column
    // of `?`, not of the key scalar. Track it so the next key uses the right
    // column for indentation validation. Reset after the key is consumed.
    pendingExplicitKeyCol: -1,
  })
);

/** A further property forces both earlier slots onto the outer node; diagnose the collision first. */
const diagnoseOuterPropertyCollision: {
  (scan: BlockMapScan, nextProperty: CstNode, state: ComposerState): void;
  (nextProperty: CstNode, state: ComposerState): (scan: BlockMapScan) => void;
} = dual(3, (scan: BlockMapScan, nextProperty: CstNode, state: ComposerState): void => {
  if (scan.pendingMeta.anchor !== undefined)
    validatePendingProperty(
      {
        ...nextProperty,
        type: "anchor",
      },
      scan.outerMeta,
      state
    );
  if (scan.pendingMeta.tag !== undefined)
    validatePendingProperty(
      {
        ...nextProperty,
        type: "tag",
        ...scan.pendingMeta.tagSpan,
      },
      scan.outerMeta,
      state
    );
});

/**
 * If we have pending meta and a newline has been seen since it was set, the
 * pending meta applies to the surrounding context (outer container) and any
 * new meta encountered belongs to the upcoming inner content.
 */
const commitOuterIfNewlineSeen: {
  (scan: BlockMapScan, state: ComposerState, nextProperty?: CstNode): void;
  (state: ComposerState, nextProperty?: CstNode): (scan: BlockMapScan) => void;
} = dual(isBlockMapScanFirst, (scan: BlockMapScan, state: ComposerState, nextProperty?: CstNode): void => {
  if (scan.sawNewlineSincePending && hasMeta(scan.pendingMeta)) {
    if (nextProperty !== undefined) diagnoseOuterPropertyCollision(scan, nextProperty, state);
    scan.outerMeta = hasMeta(scan.outerMeta) ? { ...scan.outerMeta, ...scan.pendingMeta } : scan.pendingMeta;
    scan.pendingMeta = NodeMeta.make({});
  }
  scan.sawNewlineSincePending = false;
});

const combinedPending = (scan: BlockMapScan): NodeMeta => {
  if (!hasMeta(scan.outerMeta)) return scan.pendingMeta;
  if (!hasMeta(scan.pendingMeta)) return scan.outerMeta;
  return { ...scan.outerMeta, ...scan.pendingMeta };
};

/** Reset both meta slots and the newline-since-pending flag. */
const resetAllMeta = (scan: BlockMapScan): void => {
  scan.pendingMeta = NodeMeta.make({});
  scan.outerMeta = NodeMeta.make({});
  scan.sawNewlineSincePending = false;
};

/** The entry column of a key at `offset`: the `?` column when one is pending, else the key's own column. */
const entryColumn: {
  (scan: BlockMapScan, text: string, offset: number): number;
  (text: string, offset: number): (scan: BlockMapScan) => number;
} = dual(3, (scan: BlockMapScan, text: string, offset: number): number =>
  scan.pendingExplicitKeyCol >= 0 ? scan.pendingExplicitKeyCol : lineCol(text, offset).column
);

const validateKeyColumn: {
  (scan: BlockMapScan, state: ComposerState, col: number, child: CstNode): void;
  (state: ComposerState, col: number, child: CstNode): (scan: BlockMapScan) => void;
} = dual(4, (scan: BlockMapScan, state: ComposerState, col: number, child: CstNode): void => {
  if (scan.lastKeyColumn >= 0 && col !== scan.lastKeyColumn) {
    reportSpan(state, "InvalidIndentation", "Bad indentation in block mapping", child);
  }
});

/**
 * Re-inject comments that escaped a nested compose (their column was
 * shallower than the nested collection's content) into THIS level's
 * stream — buildPairs re-classifies them, and may escape them further.
 */
const reinjectEscapedComments: {
  (items: SemanticItem[], state: ComposerState): void;
  (state: ComposerState): (items: SemanticItem[]) => void;
} = dual(2, (items: SemanticItem[], state: ComposerState): void => {
  for (const ec of state.escapedComments) {
    items.push(
      SemanticComment.make({
        kind: "comment",
        comment: ec.text,
        offset: ec.offset,
      })
    );
  }
  state.escapedComments.length = 0;
});

const pushBlockMapNode: {
  (scan: BlockMapScan, state: ComposerState, node: YamlNode, nodeOffset?: number): void;
  (state: ComposerState, node: YamlNode, nodeOffset?: number): (scan: BlockMapScan) => void;
} = dual(isBlockMapScanFirst, (scan: BlockMapScan, state: ComposerState, node: YamlNode, nodeOffset?: number): void => {
  // Track key column/offset when pushing in key position (before value-sep).
  // If `?` explicit-key indicator preceded this scalar, the entry's indent is
  // the `?` column. Otherwise it's the scalar's column.
  if (!scan.afterValueSep && nodeOffset !== undefined && nodeOffset >= 0) {
    scan.lastKeyColumn = entryColumn(scan, state.text, nodeOffset);
    scan.lastKeyOffset = nodeOffset;
  }
  scan.pendingExplicitKeyCol = -1;
  scan.items.push(SemanticNode.make({ kind: "node", node }));
  reinjectEscapedComments(scan.items, state);
  scan.afterValueSep = false;
});

/** Pushes `node` after it consumed every pending metadata slot. */
const pushConsumedBlockMapNode: {
  (scan: BlockMapScan, state: ComposerState, node: YamlNode, nodeOffset?: number): void;
  (state: ComposerState, node: YamlNode, nodeOffset?: number): (scan: BlockMapScan) => void;
} = dual(isBlockMapScanFirst, (scan: BlockMapScan, state: ComposerState, node: YamlNode, nodeOffset?: number): void => {
  resetAllMeta(scan);
  pushBlockMapNode(scan, state, node, nodeOffset);
});

/** Flushes combined pending tag/anchor metadata as an empty scalar at `offset`. */
const flushCombinedMetaAsEmpty: {
  (scan: BlockMapScan, state: ComposerState, offset: number): void;
  (state: ComposerState, offset: number): (scan: BlockMapScan) => void;
} = dual(3, (scan: BlockMapScan, state: ComposerState, offset: number): void => {
  const flushMeta = combinedPending(scan);
  if (hasMeta(flushMeta)) {
    pushConsumedBlockMapNode(scan, state, plainScalarWithMeta("", flushMeta, state, offset, 0));
  }
});

/**
 * Detect inline-implicit-map keys (M2N8/00, M2N8/01): the slice after `?`
 * up to `endIdx` forms a compact inline implicit map that IS the explicit key.
 */
const pushInlineImplicitKeyMap: {
  (scan: BlockMapScan, state: ComposerState, endIdx: number): void;
  (state: ComposerState, endIdx: number): (scan: BlockMapScan) => void;
} = dual(3, (scan: BlockMapScan, state: ComposerState, endIdx: number): void => {
  const sliceChildren = scan.children.slice(scan.index + 1, endIdx);
  const innerItems = flattenBlockMapChildren(sliceChildren, state);
  const innerPairs = A.empty<YamlPair>();
  const innerTrailing = buildPairs(innerItems, innerPairs, state.text);
  const firstC = O.getOrThrow(findFirstContent(sliceChildren));
  const lastC = O.getOrThrow(findLastContent(sliceChildren));
  const innerOffset = firstC.offset;
  const innerEnd = lastC.offset + lastC.length;
  const innerMap = YamlMap.make({
    items: innerPairs,
    style: "block",
    offset: innerOffset,
    length: innerEnd - innerOffset,
    ...O.getSomesStruct({ comment: O.fromUndefinedOr(innerTrailing) }),
  });
  pushBlockMapNode(scan, state, innerMap, innerOffset);
  scan.index = endIdx - 1; // the walk will advance to endIdx (skip the slice)
});

/**
 * Explicit key indicator (YAML §8.2.1). The "?" introduces the key of this
 * mapping entry. The key spans until the matching `:` at the same column as
 * `?`; if no such `:` exists, the rest of the mapping scope is the key.
 */
const flattenExplicitKeyIndicator: {
  (scan: BlockMapScan, child: CstNode, state: ComposerState): void;
  (child: CstNode, state: ComposerState): (scan: BlockMapScan) => void;
} = dual(3, (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  const qCol = lineCol(state.text, child.offset).column;
  scan.pendingExplicitKeyCol = qCol;
  scan.afterValueSep = false;
  // When there's no matching `:` at `qCol` but there IS a `:` at a deeper
  // column, the entire slice forms a compact inline implicit map key.
  const lookahead = scanExplicitKeyShape(scan.children, scan.index, qCol, state.text, child.offset);
  if (lookahead.kind === "inline-implicit-map") pushInlineImplicitKeyMap(scan, state, lookahead.endIdx);
});

const flattenBlockValueSep: {
  (scan: BlockMapScan, child: CstNode, state: ComposerState): void;
  (child: CstNode, state: ComposerState): (scan: BlockMapScan) => void;
} = dual(3, (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  // Y79Y/009: a value-sep `:` on a continuation line followed by a
  // tab and same-line content is invalid — tabs cannot serve as the
  // indent for the upcoming key/value content (YAML 1.2 §6.1).
  validateNoTabAfterContinuationValueSep(child, scan.children, scan.index, state);
  // Flush pending tag/anchor as empty scalar before value-sep.
  // Combine outer+pending so any anchors before a newline are also
  // represented (otherwise outer-context anchors would be lost).
  flushCombinedMetaAsEmpty(scan, state, child.offset);
  scan.items.push(
    SemanticValueSep.make({
      kind: "value-sep",
      offset: child.offset,
    })
  );
  scan.afterValueSep = true;
  scan.lastValueSepOffset = child.offset;
});

/**
 * Check for sequence entry on same line as value-sep (5U3A: `key: - a`).
 * Only flag for implicit key mappings (has a key scalar on the same line
 * before ":"), not explicit mappings (`? key\n: - value`) where this is valid.
 *
 * 4HVU: a stray block-seq entry indicator "-" outside any block-seq (e.g.
 * after a sibling block-seq value at a different indent) is malformed.
 * Legitimate "-" indicators are consumed by composeBlockSeq. Allow "-" after
 * a `?` explicit-key indicator (KK5P: `? - a`), detected via either
 * pendingExplicitKeyCol being set OR the preceding non-trivia child being an
 * empty block-seq placeholder or a `?`-marker block-map (KK5P parser shape
 * for `? - a`).
 */
const reportStraySequenceDash: {
  (scan: BlockMapScan, child: CstNode, state: ComposerState): void;
  (child: CstNode, state: ComposerState): (scan: BlockMapScan) => void;
} = dual(3, (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  if (scan.lastValueSepOffset < 0) return;
  const onSepLine = sameLine(state.text, scan.lastValueSepOffset, child.offset);
  if (onSepLine) {
    if (hasNonWhitespaceBeforeOnLine(state.text, scan.lastValueSepOffset)) {
      reportSpan(state, "UnexpectedToken", "Sequence entry on same line as mapping value indicator", child);
    }
    return;
  }
  if (scan.pendingExplicitKeyCol < 0 && !precededByExplicitKeyMarker(scan.children, scan.index)) {
    reportSpan(state, "InvalidIndentation", "Block sequence entry indicator outside any sequence", child);
  }
});

const flattenBlockPunctuation: {
  (scan: BlockMapScan, child: CstNode, state: ComposerState): void;
  (child: CstNode, state: ComposerState): (scan: BlockMapScan) => void;
} = dual(3, (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  if (child.source === "?") {
    flattenExplicitKeyIndicator(scan, child, state);
    return;
  }
  if (child.source === ":") {
    flattenBlockValueSep(scan, child, state);
    return;
  }
  if (child.source === "-") reportStraySequenceDash(scan, child, state);
});

/**
 * G9HC, H7J7: anchor/tag in value position on a continuation line (different
 * line from the `:` indicator) must be at a column strictly greater than the
 * parent key's column. If we already have pending meta and a newline was seen
 * since, the existing pending meta belongs to the outer container (it was on
 * the same line as the value indicator). Move it to outerMeta so the new
 * property can attach to the inner content as its own pending meta.
 */
const acceptBlockMapProperty: {
  (scan: BlockMapScan, child: CstNode, state: ComposerState): void;
  (child: CstNode, state: ComposerState): (scan: BlockMapScan) => void;
} = dual(3, (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  validatePropertyContinuationColumn(child, state, scan.afterValueSep, scan.lastValueSepOffset, scan.lastKeyColumn);
  commitOuterIfNewlineSeen(scan, state, child);
  validatePendingProperty(child, scan.pendingMeta, state);
});

/**
 * If this scalar is a key (followed by `:` on its own line) and there's
 * pending meta from a previous VALUE position, flush it as a null value.
 * e.g., `a: &anchor\nb:` — the anchor belongs to null, not to `b`. Includes
 * any anchor that was committed to outerMeta across a newline.
 *
 * Restrict to same-line `:` so we don't fire on patterns like
 * `? a\n: &b b\n: *a` where the next `:` belongs to a SUBSEQUENT pair
 * (different line) and `b` is the value of the current pair.
 */
const flushValueMetaBeforeKey = (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  if (!scan.afterValueSep) return;
  const valueSepOffset = findValueSepOffset(scan.children, scan.index + 1);
  if (valueSepOffset < 0) return;
  if (lineCol(state.text, child.offset).line === lineCol(state.text, valueSepOffset).line) {
    flushCombinedMetaAsEmpty(scan, state, child.offset);
  }
};

/** True in value position after a `:` that follows an implicit key on its line. */
const isAfterImplicitValueSep = (scan: BlockMapScan, text: string): boolean =>
  scan.afterValueSep && scan.lastValueSepOffset >= 0 && hasNonWhitespaceBeforeOnLine(text, scan.lastValueSepOffset);

/**
 * Detect same-line nested mapping (ZCZ6: `a: b: c: d`, ZL4Z: `a: 'b': c`).
 * If we're in value position and this scalar is followed by ":" on the same
 * line as both the preceding ":" AND the scalar itself, AND the preceding ":"
 * was from an implicit key (has non-whitespace before it on the same line),
 * it's an invalid nested mapping. Skip for explicit mappings (`? key\n: value`)
 * where `:` starts a value.
 */
const reportSameLineNestedKey = (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  if (child.type !== "flow-scalar" || !isAfterImplicitValueSep(scan, state.text)) return;
  const nextValueSepOffset = findValueSepOffset(scan.children, scan.index + 1);
  if (nextValueSepOffset < 0) return;
  if (
    sameLine(state.text, scan.lastValueSepOffset, child.offset) &&
    sameLine(state.text, child.offset, nextValueSepOffset)
  ) {
    reportSpan(state, "UnexpectedToken", "Implicit mapping key on same line as previous value indicator", child);
  }
};

/**
 * Check if this scalar is followed by a block-map (scalar is the first key of
 * a nested mapping: the parser puts the first key as a sibling before its
 * block-map child). But NOT if there's a ":" value-sep between the scalar and
 * the block-map — in that case, the scalar is a key at the current level and
 * the block-map is its value (e.g., `mapping:\n  ? sky\n  : blue`).
 */
const composeNestedMapFromScalarKey = (scan: BlockMapScan, child: CstNode, state: ComposerState): boolean => {
  const nextContent = findNextContentInList(scan.children, scan.index + 1);
  if (nextContent === null || nextContent.node.type !== "block-map") return false;
  if (hasValueSepBetween(scan.children, scan.index + 1, nextContent.idx)) return false;
  // Anchor/tag that came BEFORE a newline (outerMeta) belong to the new map;
  // anchor/tag that came AFTER the newline (pendingMeta), on the same line as
  // the key, belong to the key itself. In key position the scalar must match
  // the established key column (the `?` column when one was seen) — only when
  // externally anchored, which avoids false positives from malformed CSTs.
  if (!scan.afterValueSep && scan.hasExternalKeyColumn) {
    validateKeyColumn(scan, state, entryColumn(scan, state.text, child.offset), child);
  }
  const key = makeScalar(child, state, metaOrUndefined(scan.pendingMeta));
  const map = composeBlockMap(nextContent.node, state, key, metaOrUndefined(scan.outerMeta));
  pushConsumedBlockMapNode(scan, state, map);
  scan.index = nextContent.idx; // skip to past the block-map
  return true;
};

/** True for a hole, a newline or blank whitespace. */
const isLayoutChild = (c: CstNode | undefined): boolean =>
  c === undefined || c.type === "newline" || isBlankWhitespaceToken(c);

/** Index of the first non-layout child at or after `from` (or `children.length`). */
const nextNonLayoutIndex = (children: readonly CstNode[], from: number): number => {
  let j = from;
  while (j < children.length && isLayoutChild(children[j])) j++;
  return j;
};

/** True when a newline token sits in `children[from..to)`. */
const hasNewlineBetween = (children: readonly CstNode[], from: number, to: number): boolean => {
  for (let j = from; j < to; j++) if (children[j]?.type === "newline") return true;
  return false;
};

/** Column of the first scalar on a later line after `index`, or -1 when the next content is not one. */
const nextLineScalarColumn = (children: readonly CstNode[], index: number, text: string): number => {
  const j = nextNonLayoutIndex(children, index + 1);
  const c = children[j];
  if (c?.type !== "flow-scalar" || !hasNewlineBetween(children, index + 1, j)) return -1;
  return lineCol(text, c.offset).column;
};

/**
 * Check that we're preceded by "?" (explicit key context) and that the next
 * continuation scalar is indented beyond the "?" column.
 * `? a\n  true\n:` → merge (`true` at col 2 is right of `?` at col 0) (JTV5)
 * `? b\nc:\n` → don't merge (c at col 0 = ? at col 0) (7W2P)
 */
const isIndentedExplicitKeyContinuation = (children: readonly CstNode[], index: number, text: string): boolean => {
  const prev = precedingSignificantChild(children, index);
  if (prev === undefined || !isPunctuationToken(prev, "?")) return false;
  return nextLineScalarColumn(children, index, text) > lineCol(text, prev.offset).column;
};

/** A plain key-position scalar that reaches `:` only through continuation scalars. */
const isMultilineKeyCandidate = (scan: BlockMapScan, child: CstNode): boolean =>
  !scan.afterValueSep &&
  isPlainFlowScalarNode(child) &&
  !hasValueSepAfterInList(scan.children, scan.index + 1) &&
  hasValueSepThroughPlainScalars(scan.children, scan.index + 1);

/**
 * For explicit keys (`? key\n  continuation\n:`), use collectMultilineKey which
 * merges plain scalars up to the ":" value-sep (JTV5).
 */
const composeExplicitMultilineKey = (scan: BlockMapScan, child: CstNode, state: ComposerState): boolean => {
  if (!isMultilineKeyCandidate(scan, child)) return false;
  if (!isIndentedExplicitKeyContinuation(scan.children, scan.index, state.text)) return false;
  const { value: keyValue, nextIdx: keyNextIdx } = collectMultilineKey(scan.children, scan.index);
  const scalar = plainScalarWithMeta(keyValue, combinedPending(scan), state, child.offset, child.length);
  pushConsumedBlockMapNode(scan, state, scalar, child.offset);
  scan.index = keyNextIdx - 1;
  return true;
};

/**
 * In key position, a plain scalar without ":" after it is trailing content
 * (236B, 7MNF, 6S55, 9CWY) — unless preceded by a block indicator ("-", "?")
 * which means it's part of an explicit mapping (KK5P, 2XXW). Mid-line scalars
 * (e.g., after a tag/comma in FBC9) are not trailing.
 */
const reportTrailingKeyContent = (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  if (hasNonWhitespaceBeforeOnLine(state.text, child.offset)) return;
  const prev = precedingSignificantChild(scan.children, scan.index);
  if (isPunctuationToken(prev, "-") || isPunctuationToken(prev, "?")) return;
  reportSpan(state, "UnexpectedToken", "Trailing content in block mapping", child);
};

/**
 * In value position for implicit mappings (key and ":" on the same line),
 * continuation lines must be indented more than the key column. For explicit
 * mappings (`? key\n: value`), don't constrain.
 */
const implicitValueMinColumn = (scan: BlockMapScan, text: string): number | undefined => {
  const isImplicitMapping =
    scan.afterValueSep &&
    scan.lastKeyColumn >= 0 &&
    scan.lastKeyOffset >= 0 &&
    scan.lastValueSepOffset >= 0 &&
    sameLine(text, scan.lastKeyOffset, scan.lastValueSepOffset);
  return isImplicitMapping ? scan.lastKeyColumn + 1 : undefined;
};

/** The `raw` field to keep when the resolved value would not round-trip its source. */
const preservedRawField = (
  value: string,
  resolved: unknown
): {
  readonly raw?: string;
} => (!P.isString(resolved) && resolved !== undefined && shouldPreserveRaw(value, resolved) ? { raw: value } : {});

const makeMergedPlainScalar = (
  scan: BlockMapScan,
  child: CstNode,
  state: ComposerState,
  collected: {
    readonly value: string;
    readonly partsCount: number;
    readonly endOffset: number;
  }
): YamlScalar => {
  const { value, partsCount, endOffset } = collected;
  const plainMeta = combinedPending(scan);
  const resolved = resolveScalar(value, ["plain", plainMeta.tag, state, plainMeta.tagSpan]);
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
    ...preservedRawField(value, resolved),
  });
  if (plainMeta.anchor !== undefined && plainMeta.anchor !== "")
    registerAnchor(scalar, plainMeta.anchor, state, child.offset);
  return scalar;
};

/** True when the content at `idx` opens a mapping: a plain key before `:` or a block-map, or a block-map itself. */
const opensTrailingMapping = (children: readonly CstNode[], idx: number, node: CstNode): boolean => {
  // direct block-map (nested mapping without external key)
  if (node.type === "block-map") return true;
  if (!isPlainFlowScalarNode(node)) return false;
  // scalar followed by ":"
  if (hasValueSepAfterInList(children, idx + 1)) return true;
  // scalar followed by block-map (key before nested mapping)
  return findNextContentInList(children, idx + 1)?.node.type === "block-map";
};

/**
 * After a truly MULTILINE plain scalar in value position, if
 * collectMultilinePlainScalar stopped at a key at the SAME or deeper indent
 * as the value, that's an invalid nested mapping (HU3P). Keys at a lesser
 * indent are sibling pairs at the parent mapping level (valid, e.g. 4CQQ).
 */
const reportKeyAfterMultilineValue = (
  scan: BlockMapScan,
  child: CstNode,
  state: ComposerState,
  nextIdx: number
): void => {
  const stoppedAtContent = findNextContentInList(scan.children, nextIdx);
  if (stoppedAtContent === null) return;
  const sn = stoppedAtContent.node;
  // Only flag if the next key is at same or deeper indent
  if (lineCol(state.text, sn.offset).column < lineCol(state.text, child.offset).column) return;
  if (opensTrailingMapping(scan.children, stoppedAtContent.idx, sn)) {
    reportSpan(state, "UnexpectedToken", "Mapping key after multiline plain scalar value", sn);
  }
};

/** For plain scalars not followed by ":", try multi-line merging. */
const flattenPlainBlockMapScalar = (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  const isValuePosition = scan.afterValueSep;
  if (!isValuePosition) reportTrailingKeyContent(scan, child, state);
  const minContCol = implicitValueMinColumn(scan, state.text);
  const collected = collectMultilinePlainScalar(
    scan.children,
    scan.index,
    minContCol,
    minContCol !== undefined ? state.text : undefined
  );
  const scalar = makeMergedPlainScalar(scan, child, state, collected);
  pushConsumedBlockMapNode(scan, state, scalar, child.offset);
  // partsCount > 1 means multiple source lines were merged.
  if (isValuePosition && collected.partsCount > 1) reportKeyAfterMultilineValue(scan, child, state, collected.nextIdx);
  scan.index = collected.nextIdx - 1; // -1 because the walk increments
};

/** A non-plain (or key-position) scalar; quoted values get trailing-content and continuation checks. */
const flattenOtherBlockMapScalar = (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  const style = getScalarStyle(child);
  const isValuePosition = scan.afterValueSep;
  const scalar = makeScalar(child, state, metaOrUndefined(combinedPending(scan)));
  pushConsumedBlockMapNode(scan, state, scalar, child.offset);
  // Check for trailing content after quoted scalar in value position
  if (isValuePosition && (style === "single-quoted" || style === "double-quoted")) {
    checkTrailingContentOnSameLine(scan.children, scan.index + 1, child, state);
    // QB6E: multi-line quoted scalar continuation must be indented past
    // the parent key column.
    validateQuotedScalarContinuationIndent(child, state, scan.lastKeyColumn);
  }
};

const flattenBlockMapScalar = (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  // Validate while both slots still exist; committing would hide a
  // duplicate when the final property also ended with a newline.
  validateNoDoubleAnchorOnScalar(child, scan.children, scan.index, scan.outerMeta, scan.pendingMeta, state);
  // Reaching content: if pending meta predates a newline, it belongs to
  // the outer container, not the upcoming inner content.
  commitOuterIfNewlineSeen(scan, state);
  flushValueMetaBeforeKey(scan, child, state);
  reportSameLineNestedKey(scan, child, state);
  if (composeNestedMapFromScalarKey(scan, child, state)) return;
  if (composeExplicitMultilineKey(scan, child, state)) return;
  if (isPlainFlowScalarNode(child) && !hasValueSepAfterInList(scan.children, scan.index + 1)) {
    flattenPlainBlockMapScalar(scan, child, state);
    return;
  }
  flattenOtherBlockMapScalar(scan, child, state);
};

/**
 * Check if alias is followed by block-map (alias as first key of implicit
 * mapping). This pattern occurs when an alias is the FIRST key of a new block
 * mapping that appears as a sibling CST node (e.g., `*ref: value` where *ref
 * is outside the block-map). The pendingMeta anchor applies to the map, not
 * the alias. Note: `&b *alias : value` does NOT match this — the `:` is inside
 * the same block-map, so findNextContentInList returns the `:` (whitespace),
 * not a block-map. That case falls through to checkAnchorOnAlias.
 */
const flattenBlockMapAlias = (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  commitOuterIfNewlineSeen(scan, state);
  const nextAlias = findNextContentInList(scan.children, scan.index + 1);
  if (nextAlias !== null && nextAlias.node.type === "block-map") {
    // Like the scalar first-key path, split outer/pending: outer goes
    // to the new map, pending stays attached to the alias key.
    const alias = makeAlias(child, state);
    const map = composeBlockMap(nextAlias.node, state, alias, metaOrUndefined(scan.outerMeta));
    pushConsumedBlockMapNode(scan, state, map);
    scan.index = nextAlias.idx;
    return;
  }
  // Standalone alias — check for invalid anchor on alias
  checkAnchorOnAlias(combinedPending(scan), child, state);
  pushConsumedBlockMapNode(scan, state, makeAlias(child, state));
};

const flattenNestedBlockMap = (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  commitOuterIfNewlineSeen(scan, state);
  // If the block-map starts with `:` (implicit empty key), the inner
  // pending meta belongs to that empty key, not to the block map.
  // Outer meta (from across a newline) still applies to the map.
  if (hasMeta(scan.pendingMeta) && blockMapStartsWithValueSep(child)) {
    const emptyKey = scalarWithMeta(null, scan.pendingMeta, state, child.offset, 0);
    const map = composeBlockMap(child, state, emptyKey, metaOrUndefined(scan.outerMeta));
    pushConsumedBlockMapNode(scan, state, map);
    return;
  }
  const map = composeBlockMap(child, state, undefined, metaOrUndefined(combinedPending(scan)));
  pushConsumedBlockMapNode(scan, state, map);
};

const flattenNestedBlockSeq = (scan: BlockMapScan, child: CstNode, state: ComposerState): void => {
  commitOuterIfNewlineSeen(scan, state);
  const seqMeta = combinedPending(scan);
  // A non-empty block-seq appearing in key position (without `?`
  // explicit-key indicator) means the parser produced a structure
  // where a sequence is being treated as a key — that's invalid in
  // block context. Empty block-seqs are placeholders the parser
  // sometimes emits and should be ignored.
  if (!scan.afterValueSep && scan.pendingExplicitKeyCol < 0 && child.length > 0) {
    reportSpan(state, "InvalidIndentation", "Sequence in mapping key position", child);
  }
  pushConsumedBlockMapNode(scan, state, composeBlockSeq(child, state, metaOrUndefined(seqMeta)));
};

type ComposeFlowInBlock = (
  child: CstNode,
  state: ComposerState,
  meta: NodeMeta | undefined,
  parentBlockColumn: number
) => YamlNode;

const flattenNestedFlowCollection = (
  scan: BlockMapScan,
  child: CstNode,
  state: ComposerState,
  compose: ComposeFlowInBlock
): void => {
  commitOuterIfNewlineSeen(scan, state);
  const isValue = scan.afterValueSep;
  const node = compose(child, state, metaOrUndefined(combinedPending(scan)), scan.lastKeyColumn);
  pushConsumedBlockMapNode(scan, state, node);
  if (isValue) checkTrailingContentOnSameLine(scan.children, scan.index + 1, child, state);
};

type BlockMapHandler = (scan: BlockMapScan, child: CstNode, state: ComposerState) => void;

/** Per-CST-type handlers of the block-map flattening walk. */
const BLOCK_MAP_HANDLERS: Partial<Record<CstNodeType, BlockMapHandler>> = {
  error: (_scan, child, state) => reportUnexpectedContent(state, child),
  newline: (scan) => {
    if (hasMeta(scan.pendingMeta)) scan.sawNewlineSincePending = true;
  },
  whitespace: flattenBlockPunctuation,
  comment: (scan, child) => {
    scan.items.push(commentItem(child));
  },
  anchor: (scan, child, state) => {
    acceptBlockMapProperty(scan, child, state);
    scan.pendingMeta.anchor = getAnchorName(child, state.text);
  },
  tag: (scan, child, state) => {
    acceptBlockMapProperty(scan, child, state);
    recordPendingTag(scan.pendingMeta, child, state);
  },
  "flow-scalar": flattenBlockMapScalar,
  "block-scalar": flattenBlockMapScalar,
  alias: flattenBlockMapAlias,
  "block-map": flattenNestedBlockMap,
  "block-seq": flattenNestedBlockSeq,
  "flow-map": (scan, child, state) =>
    flattenNestedFlowCollection(scan, child, state, (c, s, m, col) => s.flow.composeFlowMap(c, s, m, col)),
  "flow-seq": (scan, child, state) =>
    flattenNestedFlowCollection(scan, child, state, (c, s, m, col) => s.flow.composeFlowSeq(c, s, m, col)),
};

/**
 * Converts block mapping CST children into semantic tokens for pair construction.
 *
 * **Details**
 *
 * Pending tags and anchors are attached during composition. External key columns
 * and offsets provide the parent context for indentation checks; diagnostics are
 * accumulated in the supplied state.
 *
 * **Example** (Flatten a plain scalar token)
 *
 * ```ts
 * import { flattenBlockMapChildren } from "@beep/yaml/internal/composer/block"
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 * import type { CstNode } from "@beep/yaml/internal/cst"
 *
 * const state = createState("name", { composeFlowMap, composeFlowSeq })
 * const children: CstNode[] = [{ type: "flow-scalar", source: "name", offset: 0, length: 4 }]
 * const items = flattenBlockMapChildren(children, state)
 * console.log(items.map((item) => item.kind).join(",")) // node
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const flattenBlockMapChildren: {
  (
    state: ComposerState,
    externalKeyColumn?: number,
    externalKeyOffset?: number
  ): (children: readonly CstNode[]) => SemanticItem[];
  (
    children: readonly CstNode[],
    state: ComposerState,
    externalKeyColumn?: number,
    externalKeyOffset?: number
  ): SemanticItem[];
} = dual(
  (args) => A.isArray(args[0]),
  (
    children: readonly CstNode[],
    state: ComposerState,
    externalKeyColumn?: number,
    externalKeyOffset?: number
  ): SemanticItem[] => {
    const scan = makeBlockMapScan(children, externalKeyColumn, externalKeyOffset);
    for (scan.index = 0; scan.index < children.length; scan.index++) {
      const child = children[scan.index];
      if (child !== undefined) BLOCK_MAP_HANDLERS[child.type]?.(scan, child, state);
    }
    // Flush trailing pending tag/anchor as empty scalar
    const trailingMeta = combinedPending(scan);
    if (hasMeta(trailingMeta)) {
      const scalar = plainScalarWithMeta("", trailingMeta, state, 0, 0);
      scan.items.push(SemanticNode.make({ kind: "node", node: scalar }));
    }
    return scan.items;
  }
);

// ---------------------------------------------------------------------------
// Pair building
// ---------------------------------------------------------------------------

const PairBuild = S.Struct({
  items: SemanticItem.pipe(
    S.Array,
    S.mutable,
    $I.annoteKey("PairBuild.items", { description: "Semantic item stream being paired." })
  ),
  pairs: YamlPair.pipe(
    S.Array,
    S.mutable,
    $I.annoteKey("PairBuild.pairs", { description: "Caller-owned output pairs." })
  ),
  text: S.String.pipe($I.annoteKey("PairBuild.text", { description: "Source text of the document." })),
  index: S.mutableKey(S.Finite).pipe($I.annoteKey("PairBuild.index", { description: "Cursor into the items." })),
  // Forward-attribution state: own-line comment parts and blank-line flag
  // pending for the NEXT pair. Parts keep their offsets so the terminal
  // leftovers can be column-partitioned (kept vs escaped to the outer scope).
  pending: PendingComment.pipe(
    S.Array,
    S.mutable,
    S.mutableKey,
    $I.annoteKey("PairBuild.pending", { description: "Own-line comments awaiting the next pair." })
  ),
  pendingSpace: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("PairBuild.pendingSpace", { description: "Whether the next pair gets `spaceBefore`." })
  ),
  // End offset of the last completed pair's content (-1 before the first),
  // and the content node it belongs to — the anchor for the keep-chomp
  // blank-line gate (a blank inside a `|+` scalar's span is VALUE, not style).
  lastEnd: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("PairBuild.lastEnd", { description: "End offset of the last pair's content, or -1." })
  ),
  lastNode: YamlNode.pipe(
    S.UndefinedOr,
    S.mutableKey,
    $I.annoteKey("PairBuild.lastNode", { description: "Content node the last pair ended with." })
  ),
  // Column of this mapping's first key — the yardstick for the terminal
  // column partition. -1 until the first key is seen.
  contentColumn: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("PairBuild.contentColumn", { description: "Column of the mapping's first key, or -1." })
  ),
}).pipe(
  $I.annoteSchema("PairBuild", { description: "Structural state of the pair-building walk, constructed directly." })
);
type PairBuild = typeof PairBuild.Type;

const nodeEnd = (n: YamlNode): number => n.offset + n.length;

/** An empty plain null scalar used as a synthetic key. */
const nullScalarAt = (offset: number): YamlScalar =>
  YamlScalar.make({ value: null, style: "plain", offset, length: 0 });

/**
 * Rebuild `pair` with `text` appended to the trailing comment of whichever
 * node owns the pair's last line: the value when present, otherwise the key.
 */
const withTrailingComment = (pair: YamlPair, text: string, onKey: boolean): YamlPair =>
  pair.value !== null && !onKey
    ? YamlPair.make({
        key: pair.key,
        value: withCommentFields(pair.value, CommentFields.make({ comment: text })),
      })
    : YamlPair.make({
        key: withCommentFields(pair.key, CommentFields.make({ comment: text })),
        value: pair.value,
      });

/**
 * Finish a pair: the pending leading fields go to its KEY node, the entry's
 * trailing comment to whichever node owns the last line. The one place the
 * node-level split is applied, so no construction site has to know it.
 */
const finishPair = (
  pair: YamlPair,
  leading: CommentFields,
  trailing: string | undefined,
  trailingOnKey: boolean
): YamlPair => {
  const withLeading =
    R.keys<string, unknown>({ ...leading }).length === 0
      ? pair
      : YamlPair.make({
          key: withCommentFields(pair.key, leading),
          value: pair.value,
        });
  return trailing === undefined ? withLeading : withTrailingComment(withLeading, trailing, trailingOnKey);
};

const noteContentColumn = (build: PairBuild, offset: number): void => {
  if (build.contentColumn < 0 && offset >= 0) build.contentColumn = columnAt(build.text, offset);
};

/** The pending comment fields for the pair being constructed, then reset. */
const takePairPendingFields = (build: PairBuild, anchorOffset: number): CommentFields => {
  let commentBefore = O.getOrUndefined(joinPendingComments(build.pending));
  if (anchorOffset >= 0 && hasBlankLineAbove(build.text, anchorOffset)) {
    if (commentBefore !== undefined) {
      // A blank line between the comment run and the node embeds as a
      // trailing empty line in the comment string (reference parity).
      commentBefore = `${commentBefore}\n`;
    } else if (
      !build.pendingSpace &&
      build.lastEnd >= 0 &&
      !blankAboveIsKeepChompContent(build.text, anchorOffset, build.lastNode)
    ) {
      build.pendingSpace = true;
    }
  }
  const fields = leadingCommentFields(commentBefore, build.pendingSpace);
  build.pending = [];
  build.pendingSpace = false;
  return fields;
};

/**
 * Own-line: attribute forward to the next pair. A blank line before the
 * FIRST comment of a run becomes spaceBefore; a blank line WITHIN the run
 * embeds as an empty line in the joined comment string (reference parity).
 */
const acceptPendingPairComment = (build: PairBuild, cText: string, cOff: number): void => {
  const blankAbove =
    cOff >= 0 && hasBlankLineAbove(build.text, cOff) && !blankAboveIsKeepChompContent(build.text, cOff, build.lastNode);
  const firstOfRun = build.pending.length === 0;
  if (blankAbove && firstOfRun && build.lastEnd >= 0) build.pendingSpace = true;
  build.pending.push(
    PendingComment.make({
      text: cText,
      offset: cOff,
      blankAbove: blankAbove && !firstOfRun,
    })
  );
};

/**
 * Own-line vs trailing is decided purely from the comment's own line (content
 * before it or not) — span-based checks mislead when a preceding block
 * collection's span over-extends. An indicator-only prefix (`? # c`, `- # c`)
 * still means the node is below, so the comment LEADS it rather than
 * trailing the entry before it.
 */
const acceptPairComment = (build: PairBuild, item: SemanticComment): void => {
  const cOff = item.offset;
  const ownLine = cOff < 0 || isOwnLineAt(build.text, cOff) || isAfterIndicatorOnly(build.text, cOff);
  const lastIdx = build.pairs.length - 1;
  const last = build.pairs[lastIdx];
  if (!ownLine && last !== undefined) {
    // Trailing: content precedes the comment on its line, so it belongs
    // to the node that owns that line — the value when there is one,
    // otherwise the key (divergence 1 in comments.ts).
    build.pairs[lastIdx] = withTrailingComment(last, item.comment, false);
  } else {
    acceptPendingPairComment(build, item.comment, cOff);
  }
  build.index++;
};

/** Joins every comment of `comments` onto `initial`, in order. */
const joinCommentRun = (initial: string | undefined, comments: ReadonlyArray<string>): string | undefined => {
  let out = initial;
  for (const comment of comments) out = joinComments(out, comment);
  return out;
};

/** The consumed value node, led by the own-line comments between the separator and it. */
const leadConsumedValue = (consumed: ConsumedValue): YamlNode | null => {
  const valNode = consumed.node;
  if (valNode === null || consumed.leadingComments.length === 0) return valNode;
  return withCommentFields(valNode, CommentFields.make({ commentBefore: A.join(consumed.leadingComments, "\n") }));
};

/** Records where the last pair ended: its value node, or `fallbackEnd` when it has none. */
const recordPairEnd = (build: PairBuild, valNode: YamlNode | null, fallbackEnd: number): void => {
  build.lastEnd = valNode !== null ? nodeEnd(valNode) : fallbackEnd;
  build.lastNode = valNode ?? undefined;
};

/** Pushes a pair whose `:` had no value node after it. */
const pushValuelessPair = (
  build: PairBuild,
  key: YamlNode,
  leading: CommentFields,
  trailing: string | undefined,
  sepOffset: number
): void => {
  build.pairs.push(
    finishPair(
      YamlPair.make({
        key,
        value: null,
      }),
      leading,
      trailing,
      false
    )
  );
  build.lastEnd = sepOffset + 1;
  build.lastNode = undefined;
};

/**
 * Value-sep without preceding key: implicit null key. Peek ahead: if the next
 * non-comment node is followed by a value-sep AND is on a different line,
 * it's a KEY for the next pair, not our value. This prevents greedily
 * consuming `"quoted key":` as the value of a preceding null-key entry (S3PD)
 * while preserving rejection of `a: b: c: d` (ZCZ6). Anchor the synthetic
 * null key at its `:` indicator so diagnostics that point at the key (e.g.
 * DuplicateKey) carry a real position instead of 0:0.
 */
const buildNullKeyPair = (build: PairBuild, separator: SemanticValueSep): void => {
  const valueSepOffset = separator.offset;
  build.index++;
  const pendingFields = takePairPendingFields(build, valueSepOffset);
  noteContentColumn(build, valueSepOffset);
  const valueNode =
    separator.closed === true ? null : consumeValueNodeForNullKey(build.items, build.index, build.text, valueSepOffset);
  const nullKey = nullScalarAt(valueSepOffset);
  if (valueNode === null) {
    pushValuelessPair(build, nullKey, pendingFields, undefined, valueSepOffset);
    return;
  }
  const pairTrailing = joinCommentRun(undefined, valueNode.sameLineComments);
  const valNode = leadConsumedValue(valueNode);
  const onKey = valNode === null || !sameLineSpan(build.text, valueSepOffset, valNode.offset);
  build.pairs.push(
    finishPair(
      YamlPair.make({
        key: nullKey,
        value: valNode,
      }),
      pendingFields,
      pairTrailing,
      onKey
    )
  );
  build.index = valueNode.nextIdx;
  recordPairEnd(build, valNode, valueSepOffset + 1);
};

/** For explicit key markers (? in flow), consume the next node as the key. */
const takeExplicitKeyNode = (build: PairBuild): YamlNode | undefined => {
  while (build.index < build.items.length && build.items[build.index]?.kind === "comment") build.index++;
  const next = build.items[build.index];
  if (next?.kind !== "node") return undefined;
  build.index++;
  return next.node;
};

/**
 * Comments between key and value-sep (e.g., `? key # comment\n: value`) attach
 * to the pair's trailing comment — they have no own construct in the pair model.
 */
const takeKeyComments = (build: PairBuild): string | undefined => {
  let pairTrailing: string | undefined;
  for (let item = build.items[build.index]; item?.kind === "comment"; item = build.items[build.index]) {
    pairTrailing = joinComments(pairTrailing, item.comment);
    build.index++;
  }
  return pairTrailing;
};

/** A keyed entry's `:` and the value node after it. */
const completeKeyedPair = (
  build: PairBuild,
  keyNode: YamlNode | undefined,
  leading: CommentFields,
  keyTrailing: string | undefined,
  separator: SemanticValueSep
): void => {
  const sepOffset = separator.offset;
  const key = keyNode ?? nullScalarAt(0);
  const valueResult =
    separator.closed === true ? null : consumeValueNode(build.items, build.index, build.text, sepOffset);
  if (valueResult === null) {
    pushValuelessPair(build, key, leading, keyTrailing, sepOffset);
    return;
  }
  // Comments between the `:` and the value: same-line comments are the
  // pair's trailing comment; own-line comments lead the value node.
  const pairTrailing = joinCommentRun(keyTrailing, valueResult.sameLineComments);
  const valNode = leadConsumedValue(valueResult);
  // Decided from the COMPOSED value: when it does not sit on the `:` line,
  // that line belongs to the key — but only in implicit `key: value` form. A
  // complex key renders as `? key` / `: value`, where the `:` line is not the
  // key's line at all, so the comment stays with the value there.
  const onKey = keyIsSimple(keyNode) && (valNode === null || !sameLineSpan(build.text, sepOffset, valNode.offset));
  build.pairs.push(
    finishPair(
      YamlPair.make({
        key,
        value: valNode,
      }),
      leading,
      pairTrailing,
      onKey
    )
  );
  build.index = valueResult.nextIdx;
  recordPairEnd(build, valNode, sepOffset + 1);
};

const buildKeyedPair = (build: PairBuild, item: SemanticKey | SemanticNode): void => {
  build.index++;
  const keyNode = item.node ?? takeExplicitKeyNode(build);
  if (keyNode !== undefined) noteContentColumn(build, keyNode.offset);
  const pendingFields = takePairPendingFields(build, keyNode !== undefined ? keyNode.offset : -1);
  const pairTrailing = takeKeyComments(build);
  // Look for value-sep
  const separator = build.items[build.index];
  if (separator?.kind === "value-sep") {
    build.index++; // skip value-sep
    completeKeyedPair(build, keyNode, pendingFields, pairTrailing, separator);
    return;
  }
  // Key with no value
  build.pairs.push(
    finishPair(
      YamlPair.make({
        key: keyNode ?? nullScalarAt(0),
        value: null,
      }),
      pendingFields,
      pairTrailing,
      false
    )
  );
  if (keyNode === undefined) return;
  build.lastEnd = nodeEnd(keyNode);
  build.lastNode = keyNode;
};

const stepPairBuild = (build: PairBuild, item: SemanticItem): void => {
  if (item.kind === "comment") {
    acceptPairComment(build, item);
    return;
  }
  if (item.kind === "value-sep") {
    buildNullKeyPair(build, item);
    return;
  }
  buildKeyedPair(build, item);
};

/** True when a blank line separates the last entry from the terminal comment run starting at `first`. */
const terminalRunHasLeadingBlank = (
  text: string,
  lastEnd: number,
  lastNode: YamlNode | undefined,
  first: PendingComment
): boolean =>
  lastEnd >= 0 &&
  first.offset >= 0 &&
  hasBlankLineAbove(text, first.offset) &&
  !blankAboveIsKeepChompContent(text, first.offset, lastNode);

/**
 * Joins a terminal comment run. A blank line between the last entry and the
 * run embeds as a LEADING empty line in the joined string — the mirror of the
 * trailing-blank embed on a `commentBefore` run.
 */
const joinTerminalRun = (
  text: string,
  lastEnd: number,
  lastNode: YamlNode | undefined,
  parts: ReadonlyArray<PendingComment>
): string | undefined => {
  const joined = O.getOrUndefined(joinPendingComments(parts));
  const first = parts[0];
  if (joined === undefined || first === undefined) return joined;
  return terminalRunHasLeadingBlank(text, lastEnd, lastNode, first) ? `\n${joined}` : joined;
};

/** Moves the parts shallower than `column` into `escaped`, returning the kept ones. */
const partitionEscapedComments = (
  text: string,
  parts: ReadonlyArray<PendingComment>,
  column: number,
  escaped: Array<EscapedComment>
): PendingComment[] => {
  const kept = A.empty<PendingComment>();
  for (const part of parts) {
    if (part.offset >= 0 && columnAt(text, part.offset) < column) {
      escaped.push(
        EscapedComment.make({
          text: part.text,
          offset: part.offset,
        })
      );
    } else {
      kept.push(part);
    }
  }
  return kept;
};

/**
 * Build pairs from a semantic item stream.
 *
 * **Details**
 *
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
 *
 * **Example** (Build a mapping entry with a null value)
 *
 * ```ts
 * import { buildPairs, SemanticNode, SemanticValueSep } from "@beep/yaml/internal/composer/block"
 * import { YamlScalar } from "@beep/yaml/YamlNode"
 * import type { YamlPair } from "@beep/yaml/YamlNode"
 *
 * const key = YamlScalar.make({ value: "name", style: "plain", offset: 0, length: 4 })
 * const pairs: YamlPair[] = []
 * buildPairs([SemanticNode.make({ kind: "node", node: key }), SemanticValueSep.make({ kind: "value-sep", offset: 4 })], pairs, "name:")
 * console.log(pairs[0]?.value === null) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const buildPairs: {
  (pairs: YamlPair[], text: string, escaped?: Array<EscapedComment>): (items: SemanticItem[]) => string | undefined;
  (items: SemanticItem[], pairs: YamlPair[], text: string, escaped?: Array<EscapedComment>): string | undefined;
} = dual(
  (args) => A.isArray(args[1]),
  (items: SemanticItem[], pairs: YamlPair[], text: string, escaped?: Array<EscapedComment>): string | undefined => {
    const build: PairBuild = {
      items,
      pairs,
      text,
      index: 0,
      pending: [],
      pendingSpace: false,
      lastEnd: -1,
      lastNode: undefined,
      contentColumn: -1,
    };
    while (build.index < items.length) {
      const item = items[build.index];
      if (item === undefined) build.index++;
      else stepPairBuild(build, item);
    }
    // Own-line comments after the last pair: terminal comments at (or beyond)
    // the mapping's content column become the collection's trailing comment;
    // SHALLOWER ones belong to an outer scope and escape (reference parity —
    // a column-0 `# tail` after a nested block documents the next outer key).
    if (build.pending.length === 0) return undefined;
    const parts =
      escaped !== undefined && build.contentColumn > 0
        ? partitionEscapedComments(text, build.pending, build.contentColumn, escaped)
        : build.pending;
    return joinTerminalRun(text, build.lastEnd, build.lastNode, parts);
  }
);

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
  if (P.isString(keyNode.value) && Str.includes("\n")(keyNode.value)) return false;
  return keyNode.style !== "block-literal" && keyNode.style !== "block-folded";
}

const ConsumedValue = S.Struct({
  node: YamlNode.pipe(
    S.NullOr,
    S.mutableKey,
    $I.annoteKey("ConsumedValue.node", { description: "Consumed value node, or null for an absent value." })
  ),
  nextIdx: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("ConsumedValue.nextIdx", { description: "Cursor immediately after the consumed value." })
  ),
  sameLineComments: S.String.pipe(
    S.Array,
    S.mutable,
    S.mutableKey,
    $I.annoteKey("ConsumedValue.sameLineComments", {
      description: "Comments on the value separator's line before the value.",
    })
  ),
  leadingComments: S.String.pipe(
    S.Array,
    S.mutable,
    S.mutableKey,
    $I.annoteKey("ConsumedValue.leadingComments", { description: "Own-line comments between the separator and value." })
  ),
}).pipe(
  $I.annoteSchema("ConsumedValue", { description: "Structural value-consumption result with writable comment arrays." })
);
type ConsumedValue = typeof ConsumedValue.Type;

const consumeValueNode: {
  (items: SemanticItem[], startIdx: number, text: string, sepOffset: number): ConsumedValue | null;
  (startIdx: number, text: string, sepOffset: number): (items: SemanticItem[]) => ConsumedValue | null;
} = dual(4, (items: SemanticItem[], startIdx: number, text: string, sepOffset: number): ConsumedValue | null => {
  // Peek past comments to the first node WITHOUT consuming anything: a node
  // on a LATER line than our `:` that is immediately followed by its own
  // value-sep is the next pair's KEY, not this pair's value — the pending
  // pair's value is empty/null (`key:\nother: 1` composed `other` as
  // the value of `key` and then paired the orphaned `:` with an empty key).
  // Same-line nodes stay consumed so `a: b: c: d` keeps its original,
  // error-flagged pairing (ZCZ6). Mirrors consumeValueNodeForNullKey (S3PD).
  // Returning null consumes nothing, so any comments re-enter the main loop
  // and attribute to the surrounding pairs as usual.
  if (startsNextPairKey(items, startIdx, text, sepOffset)) return null;
  const consumed: ConsumedValue = {
    node: null,
    nextIdx: startIdx,
    sameLineComments: [],
    leadingComments: [],
  };
  const firstOwnLineIdx = gatherValueComments(consumed, items, text, sepOffset);
  const item = items[consumed.nextIdx];
  if (item?.kind === "node") {
    // Whether the value shares the `:` line decides who owns that line's
    // comment slot: the VALUE when it ends there (`a: 1 # t`), the KEY
    // when the value sits below (`a: # kc`). Keeping the two apart is
    // what lets both source shapes round-trip — a key-line comment and a
    // comment on its own line above the value are different bytes and
    // must stay different fields.
    consumed.node = item.node;
    consumed.nextIdx++;
    return consumed;
  }
  // No value node follows, so these own-line comments never had a value
  // to lead — they belong to the enclosing mapping (its terminal comment run,
  // or the next pair's `commentBefore`). Consuming them here dropped them on
  // the floor, because the caller can only attach `leadingComments` to a value
  // node that exists. Rewind to the first of them and let the caller's own
  // forward-attribution and terminal column partition decide. Same-line
  // comments stay consumed — they are the pair's trailing comment.
  if (firstOwnLineIdx >= 0) {
    consumed.nextIdx = firstOwnLineIdx;
    consumed.leadingComments = [];
    return consumed;
  }
  return consumed.nextIdx > startIdx ? consumed : null;
});

/** True when the first node after `startIdx` is the next pair's key on a later line. */
const startsNextPairKey = (items: SemanticItem[], startIdx: number, text: string, sepOffset: number): boolean => {
  const peek = nextNonCommentIndex(items, startIdx);
  const candidate = items[peek];
  if (candidate?.kind !== "node" || items[peek + 1]?.kind !== "value-sep") return false;
  return !sameLine(text, sepOffset, candidate.node.offset);
};

/**
 * Collects the comments after the `:` into `consumed`, advancing its cursor
 * past them; returns the index of the first OWN-LINE comment — the rewind
 * point when it turns out no value node follows — or -1.
 */
const gatherValueComments = (
  consumed: ConsumedValue,
  items: SemanticItem[],
  text: string,
  sepOffset: number
): number => {
  let firstOwnLineIdx = -1;
  for (let item = items[consumed.nextIdx]; item?.kind === "comment"; item = items[consumed.nextIdx]) {
    if (sameLineSpan(text, sepOffset, item.offset)) {
      consumed.sameLineComments.push(item.comment);
    } else {
      if (firstOwnLineIdx < 0) firstOwnLineIdx = consumed.nextIdx;
      consumed.leadingComments.push(item.comment);
    }
    consumed.nextIdx++;
  }
  return firstOwnLineIdx;
};

/**
 * Like consumeValueNode but for implicit null-key entries (`: value`).
 * If the next non-comment node is immediately followed by a value-sep
 * AND is on a different line from the null key's `:`, it's actually a
 * KEY for the next pair, not our value — return null so the null key
 * gets a null value. When on the same line (e.g. `a: b: c: d`), consume
 * normally to preserve the original pairing (which may produce duplicate
 * keys that get rejected).
 */
const consumeValueNodeForNullKey: {
  (items: SemanticItem[], startIdx: number, text: string, valueSepOffset: number): ConsumedValue | null;
  (startIdx: number, text: string, valueSepOffset: number): (items: SemanticItem[]) => ConsumedValue | null;
} = dual(4, (items: SemanticItem[], startIdx: number, text: string, valueSepOffset: number): ConsumedValue | null =>
  consumeValueNode(items, startIdx, text, valueSepOffset)
);

/**
 * Canonical duplicate-key identity for a scalar key.
 *
 * **Details**
 *
 * Two keys collide only if
 * they are the same YAML node: same type *and* value. Resolved JS values alone
 * are ambiguous for numbers — `!!int 1` and `!!float 1.0` both become the JS
 * number `1` yet are distinct keys — so the number branch disambiguates int
 * from float via the source form (or an explicit tag). String/bool/null keys
 * are distinguished by their type prefix, so `1` (int) never collides with
 * `"1"` (string) or `true`.
 *
 * **Example** (Distinguish integer and floating keys)
 *
 * ```ts
 * import { keyIdentity } from "@beep/yaml/internal/composer/block"
 * import { YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const integer = YamlScalar.make({ value: 1, style: "plain", offset: 0, length: 1 })
 * const floating = YamlScalar.make({ value: 1, style: "plain", offset: 0, length: 3 })
 * console.log(`${keyIdentity(integer, "1")},${keyIdentity(floating, "1.0")}`) // i:1,f:1
 * ```
 *
 * @category utilities
 * @since 0.0.0
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
      const raw = Str.trim(Str.slice(key.offset, key.offset + key.length)(text));
      const tag = key.tag ?? "";
      const tagKind = Str.includes("float")(tag)
        ? O.some("float" as const)
        : Str.includes("int")(tag)
          ? O.some("int" as const)
          : O.none<"int" | "float">();
      const kind = O.orElse(tagKind, () => classifyPlainNumeric(raw));
      return `${O.contains(kind, "float") ? "f" : "i"}:${value}`;
    }),
    Match.orElse((value) => `o:${String(value)}`)
  );
});

/**
 * Appends duplicate-key warnings for repeated scalar key identities in a mapping.
 *
 * **Details**
 *
 * Collection keys are skipped. Repeated scalar keys are compared using
 * `keyIdentity`, and each repetition contributes a warning at that key's source span.
 *
 * **Example** (Report a repeated string key)
 *
 * ```ts
 * import { checkDuplicateKeys } from "@beep/yaml/internal/composer/block"
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 * import { YamlPair, YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const state = createState("name", { composeFlowMap, composeFlowSeq })
 * const key = YamlScalar.make({ value: "name", style: "plain", offset: 0, length: 4 })
 * const pair = YamlPair.make({ key, value: null })
 * checkDuplicateKeys([pair, pair], state)
 * console.log(state.warnings[0]?.code) // DuplicateKey
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkDuplicateKeys: {
  (state: ComposerState): (pairs: YamlPair[]) => void;
  (pairs: YamlPair[], state: ComposerState): void;
} = dual(2, (pairs: YamlPair[], state: ComposerState): void => {
  const seen = MutableHashSet.empty<string>();
  for (const pair of pairs) {
    if (isYamlScalar(pair.key)) {
      const id = keyIdentity(pair.key, state.text);
      if (MutableHashSet.has(seen, id)) {
        state.warnings.push(
          RawDiagnostic.make({
            code: "DuplicateKey",
            message: `Duplicate key: ${String(pair.key.value)}`,
            offset: pair.key.offset,
            length: pair.key.length,
          })
        );
      }
      MutableHashSet.add(seen, id);
    }
  }
});

/**
 * Inspect the slice of children after a `?` indicator to decide how the
 * explicit key should be composed.
 *
 * **Details**
 *
 * - `terminated` — found a matching `:` at `qCol`; the key is the slice
 *   between `?` and that `:`. Existing per-node logic handles this.
 * - `inline-implicit-map` — no matching `:` at `qCol`, but the slice
 *   contains a `:` at a deeper column. The whole slice is a compact
 *   inline implicit-map key (M2N8/00, M2N8/01).
 * - `simple` — no internal `:` at all; the next content node is the
 *   single key (KK5P, M5DY block-seq keys; plain scalar keys).
 */
const scanExplicitKeyShape: {
  (
    children: readonly CstNode[],
    qIdx: number,
    qCol: number,
    text: string,
    qOffset: number
  ):
    | { kind: "terminated"; matchIdx: number }
    | {
        kind: "inline-implicit-map";
        endIdx: number;
      }
    | { kind: "simple" };
  (
    qIdx: number,
    qCol: number,
    text: string,
    qOffset: number
  ): (children: readonly CstNode[]) =>
    | { kind: "terminated"; matchIdx: number }
    | {
        kind: "inline-implicit-map";
        endIdx: number;
      }
    | { kind: "simple" };
} = dual(
  5,
  (
    children: readonly CstNode[],
    qIdx: number,
    qCol: number,
    text: string,
    qOffset: number
  ):
    | { kind: "terminated"; matchIdx: number }
    | { kind: "inline-implicit-map"; endIdx: number }
    | { kind: "simple" } => {
    const qLine = lineCol(text, qOffset).line;
    let inlineColonOnQLine = false;
    let endIdx = children.length;
    for (let j = qIdx + 1; j < children.length; j++) {
      const kind = classifyExplicitKeyToken(children[j], qCol, qLine, text);
      if (kind === "terminate") return { kind: "terminated", matchIdx: j };
      // Stop scanning once we hit a sibling `?` at the same column — a new
      // explicit key starts there.
      if (kind === "sibling") {
        endIdx = j;
        break;
      }
      inlineColonOnQLine = inlineColonOnQLine || kind === "inline";
    }
    if (inlineColonOnQLine) return { kind: "inline-implicit-map", endIdx };
    return { kind: "simple" };
  }
);

/**
 * Role of one child in the slice after a `?` at `qCol`: a `:` at `qCol`
 * terminates the key; a `:` elsewhere on the `?` line marks an inline
 * implicit map (a `:` on a later line is a sibling pair's implicit-key
 * separator, not part of the explicit key — 7W2P, ZWK4); a `?` at `qCol`
 * starts a sibling explicit key.
 */
const classifyExplicitKeyToken = (
  c: CstNode | undefined,
  qCol: number,
  qLine: number,
  text: string
): "terminate" | "inline" | "sibling" | "none" => {
  if (c?.type !== "whitespace") return "none";
  if (c.source === ":") {
    const { line, column } = lineCol(text, c.offset);
    if (column === qCol) return "terminate";
    return line === qLine ? "inline" : "none";
  }
  return c.source === "?" && lineCol(text, c.offset).column === qCol ? "sibling" : "none";
};

/**
 * Returns true if a value at the given offset was introduced by a `?`
 * explicit-key indicator. Scans backward through whitespace and newlines
 * looking for a `?` at the start of a line (not part of a scalar).
 *
 * **Details**
 *
 * Named verbosely to avoid colliding with the local `isExplicitKey`
 * boolean in `flattenBlockMapChildren` (used for multi-line key
 * continuation detection — different concept).
 */
const wasIntroducedByExplicitKeyIndicator: {
  (text: string, offset: number): boolean;
  (offset: number): (text: string) => boolean;
} = dual(2, (text: string, offset: number): boolean => {
  const i = lastNonBlankBefore(text, offset, true);
  // The nearest non-whitespace char is the explicit-key indicator when it
  // is `?` and either at offset 0 or preceded by whitespace/newline.
  if (i < 0 || text[i] !== "?") return false;
  if (i === 0) return true;
  const prev = text[i - 1];
  return prev === " " || prev === "\t" || prev === "\n" || prev === "\r";
});

/**
 * Validate that implicit mapping keys do not span multiple lines.
 *
 * **Details**
 *
 * YAML 1.2 §7.4.2 requires implicit keys to fit on a single line.
 *
 * **Example** (Reject a multiline quoted key)
 *
 * ```ts
 * import { checkMultilineImplicitKeys } from "@beep/yaml/internal/composer/block"
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 * import { YamlPair, YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const state = createState("'a\nb'", { composeFlowMap, composeFlowSeq })
 * const key = YamlScalar.make({ value: "a b", style: "single-quoted", offset: 0, length: 5 })
 * checkMultilineImplicitKeys([YamlPair.make({ key, value: null })], state)
 * console.log(state.errors[0]?.message) // Implicit mapping key must not span multiple lines
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkMultilineImplicitKeys: {
  (state: ComposerState, items?: readonly SemanticItem[]): (pairs: readonly YamlPair[]) => void;
  (pairs: readonly YamlPair[], state: ComposerState, items?: readonly SemanticItem[]): void;
} = dual(
  (args) => A.isArray(args[0]),
  (pairs: readonly YamlPair[], state: ComposerState, items?: readonly SemanticItem[]): void => {
    // Check quoted scalar keys for newlines — quoted scalars (single/double)
    // have CST spans that include the newline when they span multiple lines.
    // Only check quoted styles; plain scalars in block context have single-line
    // CST spans and explicit keys (?) are allowed to be multiline.
    for (const pair of pairs) checkImplicitKeySpan(pair.key, state);
    // In flow context, also check if key and value-sep (:) are on different lines
    if (items === undefined) return;
    for (let i = 0; i < items.length; i++) checkImplicitKeySeparatorLine(items, i, state);
  }
);

/**
 * Quoted scalars have CST spans that include the newline when they span
 * multiple lines. Flow collections (YamlMap/YamlSeq with style=flow) cannot
 * be used as implicit keys when their source spans multiple lines (C2SP).
 */
const isSpanCheckedKey = (key: YamlNode): boolean => {
  if (key._tag === "YamlScalar") return key.style === "single-quoted" || key.style === "double-quoted";
  return (key._tag === "YamlMap" || key._tag === "YamlSeq") && key.style === "flow";
};

/**
 * Reports an implicit key whose source spans lines. Synthetic null keys and
 * keys introduced by an explicit `?` indicator are skipped — explicit keys
 * are allowed to span multiple lines (M5DY).
 */
const checkImplicitKeySpan = (key: YamlNode, state: ComposerState): void => {
  if (key.length === 0) return; // synthetic null key
  if (wasIntroducedByExplicitKeyIndicator(state.text, key.offset)) return;
  if (isSpanCheckedKey(key)) reportMultilineImplicitKey(state, key);
};

/** The non-empty scalar a key-or-node item carries, if any. */
const scalarKeyCandidate = (item: SemanticItem | undefined): YamlNode | undefined => {
  if (item?.kind !== "node" && item?.kind !== "key") return undefined;
  const node = item.node;
  return node?._tag === "YamlScalar" && node.length > 0 ? node : undefined;
};

/** Index of the first non-comment item at or after `from`. */
const nextNonCommentIndex = (items: readonly SemanticItem[], from: number): number => {
  let j = from;
  while (j < items.length && items[j]?.kind === "comment") j++;
  return j;
};

const checkImplicitKeySeparatorLine = (items: readonly SemanticItem[], i: number, state: ComposerState): void => {
  const node = scalarKeyCandidate(items[i]);
  if (node === undefined) return;
  // Look ahead for value-sep
  const next = items[nextNonCommentIndex(items, i + 1)];
  if (next?.kind !== "value-sep") return;
  const keyEndLine = lineCol(state.text, node.offset + node.length - 1).line;
  if (keyEndLine !== lineCol(state.text, next.offset).line) {
    reportSpan(state, "UnexpectedToken", "Implicit mapping key and value indicator must be on the same line", node);
  }
};

/**
 * Check for non-trivial CST content on the same line after a completed value node.
 *
 * **Details**
 *
 * Used to detect trailing content after quoted scalars and flow collections.
 * Skips if the next non-trivia content is a ":" (value-sep), since that means
 * this node is actually a key, not a value.
 *
 * **Example** (Detect text after a quoted value)
 *
 * ```ts
 * import { checkTrailingContentOnSameLine } from "@beep/yaml/internal/composer/block"
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 * import type { CstNode } from "@beep/yaml/internal/cst"
 *
 * const state = createState("'a' b", { composeFlowMap, composeFlowSeq })
 * const value: CstNode = { type: "flow-scalar", source: "'a'", offset: 0, length: 3 }
 * const next: CstNode = { type: "flow-scalar", source: "b", offset: 4, length: 1 }
 * checkTrailingContentOnSameLine([next], 0, value, state)
 * console.log(state.errors[0]?.message) // Trailing content after value on same line
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkTrailingContentOnSameLine: {
  (startIdx: number, valueNode: CstNode, state: ComposerState): (children: readonly CstNode[]) => void;
  (children: readonly CstNode[], startIdx: number, valueNode: CstNode, state: ComposerState): void;
} = dual(4, (children: readonly CstNode[], startIdx: number, valueNode: CstNode, state: ComposerState): void => {
  const valueEnd = valueNode.offset + valueNode.length;
  for (let j = startIdx; j < children.length; j++) {
    const next = children[j];
    if (next === undefined || isBlankWhitespaceToken(next)) continue;
    if (!endsTrailingContentScan(next) && sameLine(state.text, valueEnd - 1, next.offset)) {
      reportSpan(state, "UnexpectedToken", "Trailing content after value on same line", next);
    }
    return;
  }
});

/** Comments are allowed, and a ":" means the scanned node is a key, not a value. */
const endsTrailingContentScan = (next: CstNode): boolean =>
  next.type === "newline" || next.type === "comment" || isPunctuationToken(next, ":");

/**
 * QB6E: continuation lines of a multi-line quoted scalar in value position
 * must be indented past the parent key column.
 */
const validateQuotedScalarContinuationIndent: {
  (scalar: CstNode, state: ComposerState, parentKeyColumn: number): void;
  (state: ComposerState, parentKeyColumn: number): (scalar: CstNode) => void;
} = dual(3, (scalar: CstNode, state: ComposerState, parentKeyColumn: number): void => {
  if (parentKeyColumn < 0) return;
  const text = state.text;
  const end = Math.min(scalar.offset + scalar.length, text.length);
  let nl = indexOfLineFeed(text, scalar.offset, end);
  while (nl < end) {
    const lineStart = nl + 1;
    const contentStart = skipIndentChars(text, lineStart, end);
    if (contentStart >= end) return;
    if (text[contentStart] !== "\n" && contentStart - lineStart <= parentKeyColumn) {
      reportSpan(
        state,
        "InvalidIndentation",
        "Multi-line quoted scalar continuation must be indented past the parent key",
        {
          offset: contentStart,
          length: 1,
        }
      );
      return;
    }
    nl = indexOfLineFeed(text, contentStart, end);
  }
});

/** Offset of the next `\n` in `[from, end)`, or `end` when none. */
const indexOfLineFeed = (text: string, from: number, end: number): number => {
  let i = from;
  while (i < end && text[i] !== "\n") i++;
  return i;
};

/** First offset at or after `from` (bounded by `end`) that is not a space or tab. */
const skipIndentChars = (text: string, from: number, end: number): number => {
  let i = from;
  while (i < end && (text[i] === " " || text[i] === "\t")) i++;
  return i;
};

/**
 * 4JVG: a single scalar cannot have two anchor declarations. When the
 * outer-meta slot and the pending-meta slot both carry an anchor, AND the
 * scalar is being consumed as a plain value (not as a key for a nested
 * block-map, not followed by `:`), both anchors would collapse onto the
 * scalar — that's invalid YAML.
 */
const validateNoDoubleAnchorOnScalar: {
  (
    scalar: CstNode,
    children: readonly CstNode[],
    idx: number,
    outerMeta: NodeMeta,
    pendingMeta: NodeMeta,
    state: ComposerState
  ): void;
  (
    children: readonly CstNode[],
    idx: number,
    outerMeta: NodeMeta,
    pendingMeta: NodeMeta,
    state: ComposerState
  ): (scalar: CstNode) => void;
} = dual(
  6,
  (
    scalar: CstNode,
    children: readonly CstNode[],
    idx: number,
    outerMeta: NodeMeta,
    pendingMeta: NodeMeta,
    state: ComposerState
  ): void => {
    const duplicateAnchor = outerMeta.anchor !== undefined && pendingMeta.anchor !== undefined;
    const duplicateTag = outerMeta.tag !== undefined && pendingMeta.tag !== undefined;
    if (!duplicateAnchor && !duplicateTag) return;
    // Skip when the scalar is a key (followed by `:` or by a block-map sibling).
    if (hasValueSepAfterInList(children, idx + 1)) return;
    const nextContent = findNextContentInList(children, idx + 1);
    if (nextContent?.node.type === "block-map" && !hasValueSepBetween(children, idx + 1, nextContent.idx)) {
      return;
    }
    state.errors.push(
      RawDiagnostic.make({
        code: "UnexpectedToken",
        message: duplicateAnchor
          ? "Scalar cannot have two anchor declarations"
          : "Scalar cannot have two tag declarations",
        offset: scalar.offset,
        length: scalar.length,
      })
    );
  }
);

/**
 * Y79Y/009: when a `:` value-sep is at the start of a line (continuation
 * line, not on the same line as a key) and is immediately followed by a
 * tab and same-line content, the tab is being used as block indentation
 * for the upcoming content — invalid per YAML 1.2 §6.1.
 */
const validateNoTabAfterContinuationValueSep: {
  (colonChild: CstNode, children: readonly CstNode[], idx: number, state: ComposerState): void;
  (children: readonly CstNode[], idx: number, state: ComposerState): (colonChild: CstNode) => void;
} = dual(4, (colonChild: CstNode, children: readonly CstNode[], idx: number, state: ComposerState): void => {
  // Only when `:` is the first non-whitespace on its line — this covers
  // both column 0 (Y79Y/009) and nested mappings where the value indicator
  // sits at the start of a continuation line at any indent.
  const col = lineCol(state.text, colonChild.offset).column;
  if (col !== lineIndentColumn(state.text, colonChild.offset)) return;
  // Find the next non-whitespace child on the same line; only flag when a
  // tab was seen between.
  let sawTab = false;
  for (let j = idx + 1; j < children.length; j++) {
    const c = children[j];
    if (c === undefined) continue;
    if (c.type !== "whitespace") {
      reportTabBeforeValue(colonChild, c, sawTab, state);
      return;
    }
    sawTab = sawTab || Str.includes("\t")(c.source);
  }
});

const reportTabBeforeValue = (colonChild: CstNode, next: CstNode, sawTab: boolean, state: ComposerState): void => {
  if (next.type === "newline" || !sawTab || !sameLine(state.text, colonChild.offset, next.offset)) return;
  reportSpan(
    state,
    "TabIndentation",
    "Tab character cannot be used as indentation after a value indicator",
    colonChild
  );
};

/**
 * Returns true when the upcoming "-" indicator is preceded (after only
 * whitespace/newlines) by either an empty block-seq placeholder or a
 * `?`-only block-map. The parser uses both shapes to mark "explicit key
 * with a sequence as the key" (KK5P fixture).
 */
const precededByExplicitKeyMarker: {
  (children: readonly CstNode[], idx: number): boolean;
  (idx: number): (children: readonly CstNode[]) => boolean;
} = dual(2, (children: readonly CstNode[], idx: number): boolean => {
  const c = precedingNonTriviaChild(children, idx);
  if (c === undefined) return false;
  return (c.type === "block-seq" && c.length === 0) || (c.type === "block-map" && Str.trimEnd(c.source) === "?");
});

/** The nearest preceding child that is not a hole, whitespace, a newline or a comment. */
const precedingNonTriviaChild = (children: readonly CstNode[], idx: number): CstNode | undefined => {
  for (let j = idx - 1; j >= 0; j--) {
    const c = children[j];
    if (c !== undefined && c.type !== "whitespace" && c.type !== "newline" && c.type !== "comment") return c;
  }
  return undefined;
};

/**
 * G9HC, H7J7: anchor/tag in value position on a continuation line (not on
 * the same line as `:`) must be at a column strictly greater than the
 * parent key's column. Per YAML 1.2 §8.1.2, properties before a block
 * collection must be at indent n+1, where n is the parent key column.
 */
const validatePropertyContinuationColumn: {
  (
    property: CstNode,
    state: ComposerState,
    afterValueSep: boolean,
    lastValueSepOffset: number,
    parentKeyColumn: number
  ): void;
  (
    state: ComposerState,
    afterValueSep: boolean,
    lastValueSepOffset: number,
    parentKeyColumn: number
  ): (property: CstNode) => void;
} = dual(
  5,
  (
    property: CstNode,
    state: ComposerState,
    afterValueSep: boolean,
    lastValueSepOffset: number,
    parentKeyColumn: number
  ): void => {
    if (!afterValueSep) return;
    if (parentKeyColumn < 0) return;
    // On the same line as `:` is always OK.
    if (lastValueSepOffset >= 0 && sameLine(state.text, lastValueSepOffset, property.offset)) {
      return;
    }
    const col = lineCol(state.text, property.offset).column;
    if (col <= parentKeyColumn) {
      state.errors.push(
        RawDiagnostic.make({
          code: "InvalidIndentation",
          message: "Property (anchor or tag) must be indented past the parent key",
          offset: property.offset,
          length: property.length,
        })
      );
    }
  }
);

// ---------------------------------------------------------------------------
// Compose block seq
// ---------------------------------------------------------------------------

/**
 * Composes block sequence entries while retaining metadata, comments, and source spans.
 *
 * **Details**
 *
 * Empty entries become null scalars. Nested collections use the shared composer
 * state, and terminal comments belonging to an enclosing scope are passed back
 * through its escaped-comment queue.
 *
 * **Example** (Compose an empty tagged sequence)
 *
 * ```ts
 * import { composeBlockSeq } from "@beep/yaml/internal/composer/block"
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 * import type { CstNode } from "@beep/yaml/internal/cst"
 *
 * const state = createState("", { composeFlowMap, composeFlowSeq })
 * const source: CstNode = { type: "block-seq", source: "", offset: 0, length: 0 }
 * const seq = composeBlockSeq(source, state, { tag: "!!seq" })
 * console.log(`${seq.style}:${seq.items.length}:${seq.tag}`) // block:0:!!seq
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const composeBlockSeq: {
  (state: ComposerState, meta?: NodeMeta): (cst: CstNode) => YamlSeq;
  (cst: CstNode, state: ComposerState, meta?: NodeMeta): YamlSeq;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (cst: CstNode, state: ComposerState, meta?: NodeMeta): YamlSeq => {
    // Nesting-depth guard: unbounded recursion is a stack-overflow DoS vector.
    if (!enterNesting(state, cst)) {
      return YamlSeq.make({
        items: [],
        style: "block",
        offset: cst.offset,
        length: cst.length,
      });
    }
    try {
      return composeBlockSeqInner(cst, state, meta);
    } finally {
      exitNesting(state);
    }
  }
);

const BlockSeqScan = S.Struct({
  children: S.Array(CstNode).pipe(
    $I.annoteKey("BlockSeqScan.children", { description: "Block-sequence CST children being composed." })
  ),
  index: S.mutableKey(S.Finite).pipe($I.annoteKey("BlockSeqScan.index", { description: "Cursor into the children." })),
  items: YamlNode.pipe(
    S.Array,
    S.mutable,
    $I.annoteKey("BlockSeqScan.items", { description: "Sequence items composed so far." })
  ),
  seqIndent: S.Finite.pipe(
    $I.annoteKey("BlockSeqScan.seqIndent", { description: "Indent column of the sequence's first line." })
  ),
  pendingMeta: NodeMeta.pipe(
    S.mutableKey,
    $I.annoteKey("BlockSeqScan.pendingMeta", { description: "Anchor and tag awaiting the upcoming entry content." })
  ),
  outerMeta: NodeMeta.pipe(
    S.mutableKey,
    $I.annoteKey("BlockSeqScan.outerMeta", { description: "Anchor and tag committed across a newline." })
  ),
  sawEntry: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("BlockSeqScan.sawEntry", { description: "Whether a `-` indicator still awaits its content." })
  ),
  // Track whether a newline appeared between the most-recent pending tag/anchor
  // and the upcoming content. When true, the meta belongs to the resulting
  // collection (outer scope), not to the first key/scalar within it. This
  // mirrors the outer/inner meta split in flattenBlockMapChildren.
  sawNewlineSincePending: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("BlockSeqScan.sawNewlineSincePending", {
      description: "Whether a newline followed the most recent pending property.",
    })
  ),
  // Comment attribution, mirroring buildPairs: own-line comments
  // attach forward to the next item as `commentBefore`; a comment on the
  // same line as the end of the previous item attaches as its trailing
  // `comment`; a blank line before an item sets `spaceBefore`; terminal
  // leftovers at (or beyond) the sequence's indent become its trailing
  // comment, SHALLOWER ones escape to the outer scope.
  pending: PendingComment.pipe(
    S.Array,
    S.mutable,
    S.mutableKey,
    $I.annoteKey("BlockSeqScan.pending", { description: "Own-line comments awaiting the next item." })
  ),
  pendingSpace: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("BlockSeqScan.pendingSpace", { description: "Whether the next item gets `spaceBefore`." })
  ),
  lastItemEnd: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("BlockSeqScan.lastItemEnd", { description: "End offset of the last pushed item, or -1." })
  ),
  // The last pushed item node — the anchor for the keep-chomp blank-line
  // gate (a blank inside a `|+` item's span is VALUE, not style).
  lastItemNode: YamlNode.pipe(
    S.UndefinedOr,
    S.mutableKey,
    $I.annoteKey("BlockSeqScan.lastItemNode", { description: "The last pushed item node." })
  ),
}).pipe(
  $I.annoteSchema("BlockSeqScan", {
    description: "Structural state of the block-sequence composition walk, constructed directly.",
  })
);
type BlockSeqScan = typeof BlockSeqScan.Type;

const acceptSeqOwnLineComment = (scan: BlockSeqScan, text: string, cText: string, cOff: number): void => {
  const blankAbove =
    cOff >= 0 && hasBlankLineAbove(text, cOff) && !blankAboveIsKeepChompContent(text, cOff, scan.lastItemNode);
  const firstOfRun = scan.pending.length === 0;
  if (blankAbove && firstOfRun && scan.lastItemEnd >= 0) scan.pendingSpace = true;
  scan.pending.push(
    PendingComment.make({
      text: cText,
      offset: cOff,
      blankAbove: blankAbove && !firstOfRun,
    })
  );
};

/** The pending own-line comments leading `node`, settling the blank-line flag. */
const takeSeqCommentBefore = (scan: BlockSeqScan, text: string, node: YamlNode): string | undefined => {
  const commentBefore = O.getOrUndefined(joinPendingComments(scan.pending));
  if (node.length === 0 || !hasBlankLineAbove(text, node.offset)) return commentBefore;
  if (commentBefore !== undefined) return `${commentBefore}\n`;
  if (
    !scan.pendingSpace &&
    scan.lastItemEnd >= 0 &&
    !blankAboveIsKeepChompContent(text, node.offset, scan.lastItemNode)
  ) {
    scan.pendingSpace = true;
  }
  return commentBefore;
};

/** Pushes `node` with the pending comment fields, then re-injects escaped comments. */
const pushSeqItem = (scan: BlockSeqScan, state: ComposerState, node: YamlNode): void => {
  const commentBefore = takeSeqCommentBefore(scan, state.text, node);
  const decorated =
    commentBefore !== undefined || scan.pendingSpace
      ? withCommentFields(node, leadingCommentFields(commentBefore, scan.pendingSpace))
      : node;
  scan.pending = [];
  scan.pendingSpace = false;
  scan.items.push(decorated);
  scan.lastItemEnd = node.offset + node.length;
  scan.lastItemNode = node;
  // Re-inject comments escaped by a nested compose — see pushBlockMapNode.
  for (const ec of state.escapedComments) acceptSeqOwnLineComment(scan, state.text, ec.text, ec.offset);
  state.escapedComments.length = 0;
};

/** Pushes an entry value that consumed both metadata slots. */
const pushSeqValue = (scan: BlockSeqScan, state: ComposerState, node: YamlNode): void => {
  scan.pendingMeta = NodeMeta.make({});
  scan.outerMeta = NodeMeta.make({});
  scan.sawEntry = false;
  pushSeqItem(scan, state, node);
};

/** Push a composed item; it has consumed the pending and outer metadata. */
const pushConsumedSeqItem = (scan: BlockSeqScan, state: ComposerState, node: YamlNode): void => {
  scan.sawNewlineSincePending = false;
  pushSeqValue(scan, state, node);
};

/** Folds the outer metadata under the pending metadata. */
const mergeSeqOuterMeta = (scan: BlockSeqScan): void => {
  scan.pendingMeta = { ...scan.outerMeta, ...scan.pendingMeta };
};

/** A property after a newline moves the earlier pending metadata to the outer slot. */
const commitSeqOuterIfNewlineSeen = (scan: BlockSeqScan): void => {
  if (scan.sawNewlineSincePending && hasMeta(scan.pendingMeta)) {
    scan.outerMeta = { ...scan.outerMeta, ...scan.pendingMeta };
    scan.pendingMeta = NodeMeta.make({});
  }
  scan.sawNewlineSincePending = false;
};

const acceptSeqComment = (scan: BlockSeqScan, child: CstNode, state: ComposerState): void => {
  const cText = rawCommentText(child.source);
  if (A.isArrayNonEmpty(scan.items) && !isOwnLineAt(state.text, child.offset)) {
    const prev = A.lastNonEmpty(scan.items);
    scan.items[scan.items.length - 1] = withCommentFields(prev, CommentFields.make({ comment: cText }));
    return;
  }
  acceptSeqOwnLineComment(scan, state.text, cText, child.offset);
};

/**
 * "-" is the sequence entry indicator. If we saw a previous entry with no
 * content, push null. Any pending anchor/tag belongs to that empty scalar
 * (e.g. `- &a\n- b` anchors the first entry, not the second).
 */
const acceptSeqEntryIndicator = (scan: BlockSeqScan, child: CstNode, state: ComposerState): void => {
  if (Str.trim(child.source) !== "-") return;
  if (scan.sawEntry) {
    const emptyScalar = scalarWithMeta(null, scan.pendingMeta, state, child.offset, 0);
    scan.pendingMeta = NodeMeta.make({});
    scan.outerMeta = NodeMeta.make({});
    pushSeqItem(scan, state, emptyScalar);
  }
  scan.sawEntry = true;
};

/**
 * Look ahead: if followed by a block-map sibling, this scalar is the first
 * key of an implicit mapping (e.g., "- name: value"). When pending meta is
 * separated from the implicit-map's first key by a newline, the meta applies
 * to the OUTER collection (the map), not to the inner key. Example:
 * `- !!map\n  key: value` — `!!map` tags the map, while `key` keeps no meta.
 */
const composeSeqImplicitMap = (scan: BlockSeqScan, child: CstNode, state: ComposerState): boolean => {
  const nextSig = findNextSignificantChild(scan.children, scan.index + 1, true);
  const nextSigChild = nextSig !== null ? scan.children[nextSig] : undefined;
  if (nextSig === null || nextSigChild === undefined || nextSigChild.type !== "block-map") return false;
  const detached = scan.sawNewlineSincePending && hasMeta(scan.pendingMeta);
  const keyMeta = detached ? undefined : metaOrUndefined(scan.pendingMeta);
  const mapMeta: NodeMeta | undefined = detached
    ? { ...scan.outerMeta, ...scan.pendingMeta }
    : metaOrUndefined(scan.outerMeta);
  const keyScalar = makeScalar(child, state, keyMeta);
  pushConsumedSeqItem(scan, state, composeBlockMap(nextSigChild, state, keyScalar, mapMeta));
  scan.index = nextSig;
  return true;
};

/**
 * Merge consecutive plain scalars in same entry (multi-line plain scalar).
 * Uses collectMultilinePlainScalar to also handle continuation lines where
 * the lexer mis-tokenized content as anchors, tags, block-seq, etc. (AB8U)
 */
const pushMergedSeqScalar = (scan: BlockSeqScan, child: CstNode, state: ComposerState): boolean => {
  const {
    value: merged,
    nextIdx: mergeEnd,
    partsCount,
    endOffset,
  } = collectMultilinePlainScalar(scan.children, scan.index, undefined, state.text);
  if (partsCount <= 1) return false;
  const meta = scan.pendingMeta;
  const scalar = YamlScalar.make({
    value: resolveScalar(merged, ["plain", meta.tag, state, meta.tagSpan]),
    style: "plain",
    offset: child.offset,
    // Span the whole folded scalar — see the value-position site above.
    length: endOffset - child.offset,
    ...O.getSomesStruct({ tag: O.fromUndefinedOr(meta.tag) }),
    ...O.getSomesStruct({ anchor: O.fromUndefinedOr(meta.anchor) }),
  });
  if (meta.anchor !== undefined && meta.anchor !== "") registerAnchor(scalar, meta.anchor, state, child.offset);
  pushSeqValue(scan, state, scalar);
  scan.index = mergeEnd - 1;
  return true;
};

const composeSeqScalar = (scan: BlockSeqScan, child: CstNode, state: ComposerState): void => {
  if (composeSeqImplicitMap(scan, child, state)) return;
  validateNoDoubleAnchorOnScalar(child, scan.children, scan.index, scan.outerMeta, scan.pendingMeta, state);
  mergeSeqOuterMeta(scan);
  scan.outerMeta = NodeMeta.make({});
  if (isPlainFlowScalarNode(child) && pushMergedSeqScalar(scan, child, state)) return;
  pushConsumedSeqItem(scan, state, makeScalar(child, state, metaOrUndefined(scan.pendingMeta)));
};

/**
 * If the block-map starts with `:` (empty first key) and we have a pending
 * anchor/tag, that meta belongs to the empty key (e.g. `- &a : value` →
 * first key is empty with anchor `a`, not the map).
 */
const composeSeqBlockMap = (scan: BlockSeqScan, child: CstNode, state: ComposerState): void => {
  if (hasMeta(scan.pendingMeta) && blockMapStartsWithValueSep(child)) {
    const emptyKey = scalarWithMeta(null, scan.pendingMeta, state, child.offset, 0);
    pushConsumedSeqItem(scan, state, composeBlockMap(child, state, emptyKey, metaOrUndefined(scan.outerMeta)));
    return;
  }
  mergeSeqOuterMeta(scan);
  pushConsumedSeqItem(scan, state, composeBlockMap(child, state, undefined, metaOrUndefined(scan.pendingMeta)));
};

/** In block-seq, flow collections are always entry values; check for trailing content. */
const composeSeqFlowCollection = (
  scan: BlockSeqScan,
  child: CstNode,
  state: ComposerState,
  compose: ComposeFlowInBlock
): void => {
  mergeSeqOuterMeta(scan);
  pushSeqValue(scan, state, compose(child, state, metaOrUndefined(scan.pendingMeta), scan.seqIndent));
  checkTrailingContentOnSameLine(scan.children, scan.index + 1, child, state);
};

type BlockSeqHandler = (scan: BlockSeqScan, child: CstNode, state: ComposerState) => void;

/** Per-CST-type handlers of the block-sequence walk. */
const BLOCK_SEQ_HANDLERS: Partial<Record<CstNodeType, BlockSeqHandler>> = {
  newline: (scan) => {
    if (hasMeta(scan.pendingMeta)) scan.sawNewlineSincePending = true;
  },
  comment: acceptSeqComment,
  whitespace: acceptSeqEntryIndicator,
  error: (_scan, child, state) => reportUnexpectedContent(state, child),
  anchor: (scan, child, state) => {
    commitSeqOuterIfNewlineSeen(scan);
    validatePendingProperty(child, scan.pendingMeta, state);
    scan.pendingMeta.anchor = getAnchorName(child, state.text);
  },
  tag: (scan, child, state) => {
    commitSeqOuterIfNewlineSeen(scan);
    validatePendingProperty(child, scan.pendingMeta, state);
    recordPendingTag(scan.pendingMeta, child, state);
  },
  "flow-scalar": composeSeqScalar,
  "block-scalar": composeSeqScalar,
  alias: (scan, child, state) => {
    mergeSeqOuterMeta(scan);
    checkAnchorOnAlias(scan.pendingMeta, child, state);
    pushConsumedSeqItem(scan, state, makeAlias(child, state));
  },
  "block-map": composeSeqBlockMap,
  "block-seq": (scan, child, state) => {
    mergeSeqOuterMeta(scan);
    pushConsumedSeqItem(scan, state, composeBlockSeq(child, state, metaOrUndefined(scan.pendingMeta)));
  },
  "flow-map": (scan, child, state) =>
    composeSeqFlowCollection(scan, child, state, (c, s, m, col) => s.flow.composeFlowMap(c, s, m, col)),
  "flow-seq": (scan, child, state) =>
    composeSeqFlowCollection(scan, child, state, (c, s, m, col) => s.flow.composeFlowSeq(c, s, m, col)),
};

/** Flushes an entry left without content as null, and trailing pending metadata as an empty scalar. */
const flushSeqTail = (scan: BlockSeqScan, cst: CstNode, state: ComposerState): void => {
  // Flush trailing entry with no content as null
  if (scan.sawEntry && !hasMeta(scan.pendingMeta)) {
    pushSeqItem(
      scan,
      state,
      YamlScalar.make({
        value: null,
        style: "plain",
        offset: cst.offset + cst.length,
        length: 0,
      })
    );
  }
  // Flush trailing pending tag/anchor as empty scalar (e.g., - !!str)
  if (hasMeta(scan.pendingMeta)) pushSeqItem(scan, state, plainScalarWithMeta("", scan.pendingMeta, state, 0, 0));
};

/**
 * Own-line comments after the last item: terminal comments at (or beyond)
 * the sequence's indent become its trailing comment; shallower ones escape
 * to the outer scope (reference parity). A blank line between the last item
 * and the terminal run embeds as a LEADING empty line — mirroring buildPairs.
 */
const seqTrailingComment = (scan: BlockSeqScan, state: ComposerState): string | undefined => {
  if (scan.pending.length === 0) return undefined;
  const parts =
    scan.seqIndent > 0
      ? partitionEscapedComments(state.text, scan.pending, scan.seqIndent, state.escapedComments)
      : scan.pending;
  return joinTerminalRun(state.text, scan.lastItemEnd, scan.lastItemNode, parts);
};

/** The collection's own comment: the meta comment followed by the trailing leftover run. */
const mergeMetaComment = (meta: NodeMeta | undefined, trailing: string | undefined): string | undefined => {
  const metaComment = meta?.comment;
  if (metaComment === undefined) return trailing;
  return trailing === undefined ? metaComment : `${metaComment}\n${trailing}`;
};

const composeBlockSeqInner: {
  (state: ComposerState, meta?: NodeMeta): (cst: CstNode) => YamlSeq;
  (cst: CstNode, state: ComposerState, meta?: NodeMeta): YamlSeq;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (cst: CstNode, state: ComposerState, meta?: NodeMeta): YamlSeq => {
    const children = cst.children ?? [];
    const scan: BlockSeqScan = {
      children,
      index: 0,
      items: [],
      seqIndent: lineIndentColumn(state.text, cst.offset),
      pendingMeta: NodeMeta.make({}),
      outerMeta: NodeMeta.make({}),
      sawEntry: false,
      sawNewlineSincePending: false,
      pending: [],
      pendingSpace: false,
      lastItemEnd: -1,
      lastItemNode: undefined,
    };
    for (scan.index = 0; scan.index < children.length; scan.index++) {
      const child = children[scan.index];
      if (child !== undefined) BLOCK_SEQ_HANDLERS[child.type]?.(scan, child, state);
    }
    flushSeqTail(scan, cst, state);
    const seqComment = mergeMetaComment(meta, seqTrailingComment(scan, state));
    const seqEnd = trimDisownedTrailingComments(state.text, cst.offset, cst.offset + cst.length, state.escapedComments);
    const seq = YamlSeq.make({
      items: scan.items,
      style: "block",
      offset: cst.offset,
      length: seqEnd - cst.offset,
      ...O.getSomesStruct({ tag: O.fromUndefinedOr(meta?.tag) }),
      ...O.getSomesStruct({ anchor: O.fromUndefinedOr(meta?.anchor) }),
      ...O.getSomesStruct({ comment: O.fromUndefinedOr(seqComment) }),
    });

    registerMetaAnchor(seq, meta, state, cst.offset);
    return seq;
  }
);

// ---------------------------------------------------------------------------
// Flat block map helpers (for document children without block-map wrapper)
// ---------------------------------------------------------------------------

/**
 * Compose a block map from flat document children (no block-map wrapper node).
 *
 * **Details**
 *
 * This happens in multi-document scenarios where the parser doesn't create a block-map node.
 *
 * **Example** (Compose an external key without a wrapper)
 *
 * ```ts
 * import { composeFlatBlockMap } from "@beep/yaml/internal/composer/block"
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 * import type { CstNode } from "@beep/yaml/internal/cst"
 * import { YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const state = createState("name:", { composeFlowMap, composeFlowSeq })
 * const parent: CstNode = { type: "document", source: "name:", offset: 0, length: 5 }
 * const children: CstNode[] = [{ type: "whitespace", source: ":", offset: 4, length: 1 }]
 * const key = YamlScalar.make({ value: "name", style: "plain", offset: 0, length: 4 })
 * const map = composeFlatBlockMap(children, 0, parent, state, key)
 * console.log(`${map.items.length}:${map.length}`) // 1:5
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const composeFlatBlockMap: {
  (
    startIdx: number,
    parentCst: CstNode,
    state: ComposerState,
    externalFirstKey: YamlNode,
    meta?: NodeMeta
  ): (children: readonly CstNode[]) => YamlMap;
  (
    children: readonly CstNode[],
    startIdx: number,
    parentCst: CstNode,
    state: ComposerState,
    externalFirstKey: YamlNode,
    meta?: NodeMeta
  ): YamlMap;
} = dual(
  (args) => A.isArray(args[0]),
  (
    children: readonly CstNode[],
    startIdx: number,
    parentCst: CstNode,
    state: ComposerState,
    externalFirstKey: YamlNode,
    meta?: NodeMeta
  ): YamlMap => {
    // Collect the remaining children into semantic items
    const remainingChildren = children.slice(startIdx);
    const items = flattenBlockMapChildren(remainingChildren, state);
    items.unshift(SemanticKey.make({ kind: "key", node: externalFirstKey }));

    const pairs = A.empty<YamlPair>();
    const trailingComment = buildPairs(items, pairs, state.text, state.escapedComments);

    if (state.options.uniqueKeys) checkDuplicateKeys(pairs, state);
    checkMultilineImplicitKeys(pairs, state);

    const offset = externalFirstKey.offset;
    const end = trimDisownedTrailingComments(
      state.text,
      offset,
      parentCst.offset + parentCst.length,
      state.escapedComments
    );

    return finishBlockMap(pairs, trailingComment, meta, state, offset, end - offset);
  }
);
