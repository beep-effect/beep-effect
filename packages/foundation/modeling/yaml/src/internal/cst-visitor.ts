import { $YamlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseCSTAll } from "./cst-parser.ts";
import type { CstNode } from "./cst.ts";

const $I = $YamlId.create("internal/cst-visitor");
const Path = S.Array(S.Union([S.String, S.Finite])).pipe(
  $I.annoteSchema("Path", {
    description: "Ordered mapping names and sequence indices locating a CST event.",
  })
);
type Path = typeof Path.Type;

const eventFields = {
  path: Path.pipe(
    $I.annoteKey("CstVisitorEvent.path", { description: "Location of the event in document traversal." })
  ),
  depth: S.Finite.pipe(
    $I.annoteKey("CstVisitorEvent.depth", { description: "Nesting depth, with the document at zero." })
  ),
};
const sourceEventFields = {
  ...eventFields,
  source: S.String.pipe(
    $I.annoteKey("CstVisitorEvent.source", { description: "Raw source content associated with the event." })
  ),
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
}).pipe(
  $I.annoteSchema("CstVisitorEvent", {
    description: "Thirteen tagged SAX event payloads emitted in raw document order.",
  })
);

const childrenOf = (node: CstNode): ReadonlyArray<CstNode> => O.fromNullishOr(node.children).pipe(O.getOrElse(A.empty));

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

function isTriviaCstNode(node: CstNode): boolean {
  return node.type === "whitespace" || node.type === "newline" || node.type === "anchor" || node.type === "tag";
}

function isScalarCstNode(node: CstNode): boolean {
  return node.type === "flow-scalar" || node.type === "block-scalar";
}

function isBlockMapCstNode(node: CstNode): boolean {
  return node.type === "block-map";
}

function isMapCstNode(node: CstNode): boolean {
  return node.type === "block-map" || node.type === "flow-map";
}

function isSeqCstNode(node: CstNode): boolean {
  return node.type === "block-seq" || node.type === "flow-seq";
}

function hasLineBreak(source: string): boolean {
  return Str.includes("\n")(source) || Str.includes("\r")(source);
}

// decision: punctuation-leaves-as-whitespace
function isIndicatorNode(node: CstNode, indicator: string): boolean {
  return node.type === "whitespace" && node.source === indicator;
}

type LeafEventTag = (CstCommentEvent | CstDirectiveEvent | CstErrorEvent | CstAliasEvent)["_tag"];

const siblingLeafTags: Readonly<Partial<Record<CstNode["type"], LeafEventTag>>> = {
  comment: "CstCommentEvent",
  directive: "CstDirectiveEvent",
  error: "CstErrorEvent",
  alias: "CstAliasEvent",
};

const blockMapLeafTags: Readonly<Partial<Record<CstNode["type"], LeafEventTag>>> = {
  directive: "CstDirectiveEvent",
  error: "CstErrorEvent",
};

function leafEvent(tag: LeafEventTag, node: CstNode, path: Path, depth: number): CstVisitorEvent {
  return { _tag: tag, path, depth, source: node.source };
}

const MapWalkState = S.Struct({
  expectingKey: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("MapWalkState.expectingKey", { description: "Whether the next scalar is a key." })
  ),
  keyHasContent: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("MapWalkState.keyHasContent", { description: "Whether the open key already has content." })
  ),
  crossedNewline: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("MapWalkState.crossedNewline", {
      description: "Whether a physical entry boundary was crossed since the last value indicator.",
    })
  ),
}).pipe(
  $I.annoteSchema("MapWalkState", {
    description: "Writable key/value alternation state of a mapping walk, constructed without per-step validation.",
  })
);
type MapWalkState = typeof MapWalkState.Type;

function openKey(walk: MapWalkState): void {
  walk.expectingKey = true;
  walk.keyHasContent = false;
}

function markKeyContent(walk: MapWalkState): void {
  if (walk.expectingKey) walk.keyHasContent = true;
}

function closeKey(walk: MapWalkState): boolean {
  const emptyKey = walk.expectingKey && !walk.keyHasContent;
  walk.expectingKey = false;
  walk.keyHasContent = false;
  return emptyKey;
}

function scalarRoleEvent(
  isKey: boolean,
  node: CstNode,
  ...[path, depth, walk]: [path: Path, depth: number, walk: MapWalkState]
): CstVisitorEvent {
  if (!isKey) return { _tag: "CstValueEvent", path, depth, source: node.source };
  walk.keyHasContent = true;
  return { _tag: "CstKeyEvent", path, depth, source: node.source };
}

function* walkCollection(node: CstNode, path: Path, depth: number, inFlow: boolean): Generator<CstVisitorEvent> {
  if (!isMapCstNode(node)) {
    yield { _tag: "CstSeqStartEvent", path, depth, source: node.source };
    yield* walkSiblings(childrenOf(node), path, depth + 1);
    yield { _tag: "CstSeqEndEvent", path, depth };
    return;
  }
  yield { _tag: "CstMapStartEvent", path, depth, source: node.source };
  const walkChildren = !inFlow && isBlockMapCstNode(node) ? walkBlockMapChildren : walkFlowMapChildren;
  yield* walkChildren(childrenOf(node), path, depth + 1);
  yield { _tag: "CstMapEndEvent", path, depth };
}

function* walkCollectionOrAlias(node: CstNode, path: Path, depth: number, inFlow: boolean): Generator<CstVisitorEvent> {
  if (isMapCstNode(node) || isSeqCstNode(node)) yield* walkCollection(node, path, depth, inFlow);
  else yield { _tag: "CstAliasEvent", path, depth, source: node.source };
}

// decision: first-key-outside-block-map
function* walkSiblings(nodes: ReadonlyArray<CstNode>, path: Path, depth: number): Generator<CstVisitorEvent> {
  for (const [i, node] of nodes.entries()) {
    if (!isTriviaCstNode(node)) yield* walkSibling(nodes, i, path, depth);
  }
}

// decision: first-key-outside-block-map
function* walkSibling(nodes: ReadonlyArray<CstNode>, i: number, path: Path, depth: number): Generator<CstVisitorEvent> {
  const node = A.getUnsafe(nodes, i);
  const leafTag = siblingLeafTags[node.type];
  if (leafTag !== undefined) {
    yield leafEvent(leafTag, node, path, depth);
    return;
  }
  if (isScalarCstNode(node)) {
    const nextContent = findNextContent(nodes, i + 1);
    const isKey = nextContent !== undefined && isBlockMapCstNode(nextContent);
    yield { _tag: isKey ? "CstKeyEvent" : "CstScalarEvent", path, depth, source: node.source };
    return;
  }
  yield* walkCollection(node, path, depth, false);
}

const findNextContent: {
  (nodes: ReadonlyArray<CstNode>, startIdx: number): CstNode | undefined;
  (startIdx: number): (nodes: ReadonlyArray<CstNode>) => CstNode | undefined;
} = dual(2, (nodes: ReadonlyArray<CstNode>, startIdx: number): CstNode | undefined => {
  for (let i = startIdx; i < nodes.length; i++) {
    const node = A.getUnsafe(nodes, i);
    if (!isTriviaCstNode(node) && node.type !== "comment") {
      return node;
    }
  }
  return undefined;
});

function isLineBreakTrivia(node: CstNode): boolean {
  return isTriviaCstNode(node) && hasLineBreak(node.source);
}

function endsMapContentScan(node: CstNode): boolean {
  if (isLineBreakTrivia(node) || isIndicatorNode(node, ":") || isIndicatorNode(node, "?")) return true;
  return !isTriviaCstNode(node) && node.type !== "comment";
}

// decision: first-key-outside-block-map
const findMapContent: {
  (nodes: ReadonlyArray<CstNode>, startIdx: number): CstNode | undefined;
  (startIdx: number): (nodes: ReadonlyArray<CstNode>) => CstNode | undefined;
} = dual(2, (nodes: ReadonlyArray<CstNode>, startIdx: number): CstNode | undefined => {
  if (startIdx > 0 && hasLineBreak(A.getUnsafe(nodes, startIdx - 1).source)) return undefined;
  for (let i = startIdx; i < nodes.length; i++) {
    const node = A.getUnsafe(nodes, i);
    if (endsMapContentScan(node)) return isLineBreakTrivia(node) ? undefined : node;
  }
  return undefined;
});

// decision: first-key-outside-block-map
function applyBlockMapIndicator(child: CstNode, walk: MapWalkState): boolean {
  if (child.type === "newline") walk.crossedNewline = true;
  if (isIndicatorNode(child, "?")) openKey(walk);
  if (!isIndicatorNode(child, ":")) return false;
  if (walk.crossedNewline && !walk.expectingKey) openKey(walk);
  walk.crossedNewline = false;
  return closeKey(walk);
}

// decision: first-key-outside-block-map
function blockMapScalarEvent(
  children: ReadonlyArray<CstNode>,
  i: number,
  ...[path, depth, walk]: [path: Path, depth: number, walk: MapWalkState]
): CstVisitorEvent {
  const child = A.getUnsafe(children, i);
  const nextContent = findMapContent(children, i + 1);
  if (!walk.expectingKey && nextContent?.source === ":") openKey(walk);
  walk.crossedNewline = false;
  const isKey = walk.expectingKey || (nextContent !== undefined && isBlockMapCstNode(nextContent));
  return scalarRoleEvent(isKey, child, path, depth, walk);
}

function* walkBlockMapChild(
  children: ReadonlyArray<CstNode>,
  i: number,
  ...[path, depth, walk]: [path: Path, depth: number, walk: MapWalkState]
): Generator<CstVisitorEvent> {
  const child = A.getUnsafe(children, i);
  if (child.type === "comment") {
    yield { _tag: "CstCommentEvent", path, depth, source: child.source };
    return;
  }
  if (applyBlockMapIndicator(child, walk)) yield { _tag: "CstKeyEvent", path, depth, source: "" };
  if (isTriviaCstNode(child)) return;
  const leafTag = blockMapLeafTags[child.type];
  if (leafTag !== undefined) {
    yield leafEvent(leafTag, child, path, depth);
    return;
  }
  if (isScalarCstNode(child)) {
    yield blockMapScalarEvent(children, i, path, depth, walk);
    return;
  }
  yield* walkCollectionOrAlias(child, path, depth, false);
  markKeyContent(walk);
}

// decision: first-key-outside-block-map
function* walkBlockMapChildren(
  children: ReadonlyArray<CstNode>,
  path: Path,
  depth: number
): Generator<CstVisitorEvent> {
  const firstKeyExternal = findMapContent(children, 0)?.source === ":";
  const walk: MapWalkState = { expectingKey: !firstKeyExternal, keyHasContent: false, crossedNewline: false };

  for (let i = 0; i < children.length; i++) {
    if (i > 0 && hasLineBreak(A.getUnsafe(children, i - 1).source)) walk.crossedNewline = true;
    yield* walkBlockMapChild(children, i, path, depth, walk);
  }
}

// decision: first-key-outside-block-map
function applyFlowMapIndicator(child: CstNode, walk: MapWalkState): boolean {
  if (isIndicatorNode(child, ",") || isIndicatorNode(child, "?")) openKey(walk);
  return isIndicatorNode(child, ":") && closeKey(walk);
}

// decision: punctuation-leaves-as-whitespace
function* walkFlowMapChild(child: CstNode, path: Path, depth: number, walk: MapWalkState): Generator<CstVisitorEvent> {
  if (child.type === "comment") {
    yield { _tag: "CstCommentEvent", path, depth, source: child.source };
    return;
  }
  if (applyFlowMapIndicator(child, walk)) yield { _tag: "CstKeyEvent", path, depth, source: "" };
  if (isTriviaCstNode(child)) return;
  if (child.type === "error") {
    yield { _tag: "CstErrorEvent", path, depth, source: child.source };
    return;
  }
  if (isScalarCstNode(child)) {
    yield scalarRoleEvent(walk.expectingKey, child, path, depth, walk);
    return;
  }
  yield* walkCollectionOrAlias(child, path, depth, true);
  markKeyContent(walk);
}

// decision: first-key-outside-block-map
function* walkFlowMapChildren(children: ReadonlyArray<CstNode>, path: Path, depth: number): Generator<CstVisitorEvent> {
  const walk: MapWalkState = { expectingKey: true, keyHasContent: false, crossedNewline: false };
  for (const child of children) {
    yield* walkFlowMapChild(child, path, depth, walk);
  }
}

function* walkDocument(doc: CstNode): Generator<CstVisitorEvent> {
  const path: Path = [];
  const depth = 0;

  yield { _tag: "CstDocumentStartEvent", path, depth };
  yield* walkSiblings(childrenOf(doc), path, depth + 1);
  yield { _tag: "CstDocumentEndEvent", path, depth };
}

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
 * import { cstEvents } from "@beep/yaml/internal/cst-visitor"
 *
 * const tags = Array.from(cstEvents("true"), event => event._tag)
 * console.log(tags.join(",")) // CstDocumentStartEvent,CstScalarEvent,CstDocumentEndEvent
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function* cstEvents(text: string): IterableIterator<CstVisitorEvent> {
  for (const doc of parseCSTAll(text)) {
    yield* walkDocument(doc);
  }
}
