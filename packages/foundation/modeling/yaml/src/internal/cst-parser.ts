import { $YamlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { lexAll } from "./lexer.ts";
import { YamlToken } from "./token.ts";
import type { CstNode, CstNodeType } from "./cst.ts";
import type { YamlTokenKind } from "./token.ts";

const $I = $YamlId.create("internal/cst-parser");
const ParserState = S.Struct({
  tokens: S.Array(S.Struct(YamlToken.fields)).pipe(
    $I.annoteKey("ParserState.tokens", { description: "Dense lexer token stream being consumed." })
  ),
  text: S.String.pipe(
    $I.annoteKey("ParserState.text", { description: "Original YAML source used to preserve exact CST spans." })
  ),
  pos: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("ParserState.pos", { description: "Writable cursor pointing to the next token." })
  ),
  depth: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("ParserState.depth", { description: "Writable collection-nesting depth checked by guardDepth." })
  ),
}).pipe(
  $I.annoteSchema("ParserState", {
    description: "Structural parser state constructed directly without per-step validation.",
  })
);
type ParserState = typeof ParserState.Type;

const MAX_CST_DEPTH = 256 + 8;

function guardDepth(state: ParserState): CstNode | null {
  if (state.depth < MAX_CST_DEPTH) return null;
  const token = advance(state);
  return {
    type: "error",
    source: token.value,
    offset: token.offset,
    length: token.length,
  };
}

function atEnd(state: ParserState): boolean {
  return state.pos >= state.tokens.length;
}

function peek(state: ParserState): YamlToken.Data {
  return A.getUnsafe(state.tokens, state.pos);
}

function advance(state: ParserState): YamlToken.Data {
  const token = peek(state);
  state.pos++;
  return token;
}

function isTrivia(token: YamlToken.Data): boolean {
  return token.kind === "whitespace" || token.kind === "newline" || token.kind === "comment";
}

function isDocumentBoundary(token: YamlToken.Data): boolean {
  return token.kind === "document-start" || token.kind === "document-end";
}

const makeContainerNode: {
  (type: CstNodeType, children: CstNode[], text: string): CstNode;
  (children: CstNode[], text: string): (type: CstNodeType) => CstNode;
} = dual(3, (type: CstNodeType, children: CstNode[], text: string): CstNode => {
  if (children.length === 0) {
    return { type, source: "", offset: 0, length: 0, children };
  }
  const first = A.getUnsafe(children, 0);
  const last = A.getUnsafe(children, children.length - 1);
  const offset = first.offset;
  const end = last.offset + last.length;
  const source = Str.slice(offset, end)(text);
  return { type, source, offset, length: end - offset, children };
});

const makeLeafNode: {
  (type: CstNodeType, token: YamlToken.Data, text: string): CstNode;
  (token: YamlToken.Data, text: string): (type: CstNodeType) => CstNode;
} = dual(
  3,
  (type: CstNodeType, token: YamlToken.Data, text: string): CstNode => ({
    type,
    source: Str.slice(token.offset, token.offset + token.length)(text),
    offset: token.offset,
    length: token.length,
  })
);

function consumeTrivia(state: ParserState): CstNode[] {
  const nodes: CstNode[] = [];
  while (!atEnd(state)) {
    const token = peek(state);
    if (!isTrivia(token)) break;
    advance(state);
    if (token.kind === "comment") {
      nodes.push(makeLeafNode("comment", token, state.text));
    } else if (token.kind === "newline") {
      nodes.push(makeLeafNode("newline", token, state.text));
    } else {
      nodes.push(makeLeafNode("whitespace", token, state.text));
    }
  }
  return nodes;
}

// decision: punctuation-leaves-as-whitespace
const leafNodeTypes: Readonly<Record<YamlTokenKind, CstNodeType>> = {
  whitespace: "whitespace",
  newline: "newline",
  comment: "comment",
  scalar: "flow-scalar",
  anchor: "anchor",
  alias: "alias",
  tag: "tag",
  directive: "directive",
  "flow-separator": "whitespace",
  "block-map-value": "whitespace",
  "block-map-key": "whitespace",
  "block-seq-entry": "whitespace",
  "document-start": "whitespace",
  "document-end": "whitespace",
  "flow-map-start": "whitespace",
  "flow-map-end": "whitespace",
  "flow-seq-start": "whitespace",
  "flow-seq-end": "whitespace",
  "block-map-start": "whitespace",
  "block-seq-start": "whitespace",
  "byte-order-mark": "whitespace",
  error: "error",
};

function consumeLeafToken(state: ParserState): CstNode {
  const token = peek(state);
  advance(state);

  return makeLeafNode(leafNodeTypes[token.kind], token, state.text);
}

function parseFlowMapping(state: ParserState): CstNode {
  return parseFlowCollection(state, "flow-map-end", "flow-map");
}

function parseFlowSequence(state: ParserState): CstNode {
  return parseFlowCollection(state, "flow-seq-end", "flow-seq");
}

// decision: punctuation-leaves-as-whitespace
function parseFlowCollection(
  state: ParserState,
  ...[endKind, type]: [endKind: "flow-map-end" | "flow-seq-end", type: "flow-map" | "flow-seq"]
): CstNode {
  const guarded = guardDepth(state);
  if (guarded !== null) return guarded;
  state.depth++;
  try {
    const children: CstNode[] = [];
    const open = advance(state);
    children.push(makeLeafNode("whitespace", open, state.text));

    while (!atEnd(state)) {
      const token = peek(state);
      if (token.kind === endKind) {
        const close = advance(state);
        children.push(makeLeafNode("whitespace", close, state.text));
        break;
      }
      children.push(parseFlowOrLeaf(state, token.kind));
    }

    return makeContainerNode(type, children, state.text);
  } finally {
    state.depth--;
  }
}

function parseFlowOrLeaf(state: ParserState, ...[kind]: [kind: YamlTokenKind]): CstNode {
  if (kind === "flow-map-start") return parseFlowMapping(state);
  if (kind === "flow-seq-start") return parseFlowSequence(state);
  return consumeLeafToken(state);
}

function parseBlockScalar(state: ParserState): CstNode {
  return makeLeafNode("block-scalar", advance(state), state.text);
}

function isBlockScalarToken(state: ParserState): boolean {
  return isBlockScalarAt(peek(state), state.text);
}

function isBlockScalarAt(token: YamlToken.Data | undefined, text: string): boolean {
  if (token?.kind !== "scalar") return false;
  const ch = text[token.offset];
  return ch === "|" || ch === ">";
}

const contentKinds: HashSet.HashSet<YamlTokenKind> = HashSet.make<ReadonlyArray<YamlTokenKind>>(
  "scalar",
  "anchor",
  "alias",
  "tag"
);

const inlineValueKinds: HashSet.HashSet<YamlTokenKind> = HashSet.union(
  contentKinds,
  HashSet.make<ReadonlyArray<YamlTokenKind>>("whitespace")
);

const blockMapEntryKinds: HashSet.HashSet<YamlTokenKind> = HashSet.union(
  contentKinds,
  HashSet.make<ReadonlyArray<YamlTokenKind>>("block-map-key", "block-map-value")
);

const seqEntryIndentedKinds: HashSet.HashSet<YamlTokenKind> = HashSet.union(
  blockMapEntryKinds,
  HashSet.make<ReadonlyArray<YamlTokenKind>>("block-seq-entry", "block-seq-start")
);

const seqEntryAnyColumnKinds: HashSet.HashSet<YamlTokenKind> = HashSet.make<ReadonlyArray<YamlTokenKind>>(
  "whitespace",
  "newline",
  "comment",
  "block-map-start",
  "flow-map-start",
  "flow-seq-start"
);

const valueSepSkippedTypes: HashSet.HashSet<CstNodeType> = HashSet.make<ReadonlyArray<CstNodeType>>(
  "whitespace",
  "newline",
  "comment",
  "anchor",
  "tag"
);

const flowDepthDeltas: Readonly<Partial<Record<YamlTokenKind, number>>> = {
  "flow-map-start": 1,
  "flow-seq-start": 1,
  "flow-map-end": -1,
  "flow-seq-end": -1,
};

function isValueSepNode(c: CstNode): boolean {
  return c.type === "whitespace" && c.source === ":";
}

function isKeyIndicatorNode(c: CstNode): boolean {
  return c.type === "whitespace" && c.source === "?";
}

// decision: explicit-key-value-forms
function hasOpenExplicitKey(children: readonly CstNode[]): boolean {
  const last = A.findLast(children, (c) => isValueSepNode(c) || isKeyIndicatorNode(c));
  return O.isSome(last) && isKeyIndicatorNode(last.value);
}

// decision: block-collection-scopes
function isDeeperValueMarker(state: ParserState, token: YamlToken.Data, children: readonly CstNode[]): boolean {
  if (token.kind !== "block-map-start" || state.tokens[state.pos + 1]?.kind !== "block-map-value") return false;
  const last = A.findLast(children, (c) => isKeyIndicatorNode(c) || !HashSet.has(valueSepSkippedTypes, c.type));
  return hasOpenExplicitKey(children) && O.isSome(last) && !isKeyIndicatorNode(last.value);
}

// decision: column-decided-block-ends
function lastNonTriviaIsValueSep(children: readonly CstNode[]): boolean {
  const last = A.findLast(children, (c) => isValueSepNode(c) || !HashSet.has(valueSepSkippedTypes, c.type));
  return O.isSome(last) && isValueSepNode(last.value);
}

// decision: block-collection-scopes
function findFirstSeqEntryColumn(state: ParserState): number {
  const entryIndex = state.pos + (peek(state).kind === "block-seq-start" ? 1 : 0);
  return A.getUnsafe(state.tokens, entryIndex).column;
}

// decision: block-collection-scopes
function skipScopeMarker(state: ParserState): undefined {
  advance(state);
  return undefined;
}

function parseBlockNode(state: ParserState, token: YamlToken.Data): CstNode {
  if (token.kind === "block-map-start") return parseBlockMapping(state, token.column);
  if (token.kind === "block-seq-start") return parseBlockSequence(state, token.column);
  return isBlockScalarToken(state) ? parseBlockScalar(state) : parseFlowOrLeaf(state, token.kind);
}

const parseBlockMapping: {
  (state: ParserState, indent: number): CstNode;
  (indent: number): (state: ParserState) => CstNode;
} = dual(2, (state: ParserState, indent: number): CstNode => {
  const guarded = guardDepth(state);
  if (guarded !== null) return guarded;
  state.depth++;
  try {
    return parseBlockMappingInner(state, indent);
  } finally {
    state.depth--;
  }
});

// decision: column-decided-block-ends
function blockMapSeqStops(
  token: YamlToken.Data,
  indent: number,
  children: readonly CstNode[],
  sawExplicitKey: boolean
): boolean {
  if (token.kind === "block-seq-start") {
    return token.column <= indent && children.length > 0 && !lastNonTriviaIsValueSep(children) && !sawExplicitKey;
  }
  if (token.kind !== "block-seq-entry" || token.column > indent) return false;
  return token.column < indent || !lastNonTriviaIsValueSep(children);
}

// decision: column-decided-block-ends
function blockMapStops(
  token: YamlToken.Data,
  indent: number,
  children: readonly CstNode[],
  sawExplicitKey: boolean
): boolean {
  if (isDocumentBoundary(token)) return true;
  if (HashSet.has(blockMapEntryKinds, token.kind)) return token.column < indent && children.length > 0;
  if (token.kind === "block-map-start") return token.column < indent;
  return blockMapSeqStops(token, indent, children, sawExplicitKey);
}

// decision: column-decided-block-ends
function parseCompactSeqValue(state: ParserState, indent: number): CstNode {
  const seqChildren: CstNode[] = [];
  while (!atEnd(state) && peek(state).kind === "block-seq-entry" && peek(state).column === indent) {
    seqChildren.push(...consumeTrivia(state));
    seqChildren.push(consumeLeafToken(state));
    seqChildren.push(...parseSequenceEntryContent(state, indent));
  }
  return makeContainerNode("block-seq", seqChildren, state.text);
}

// decision: block-collection-scopes
// decision: explicit-key-value-forms
function parseBlockMapNode(
  state: ParserState,
  token: YamlToken.Data,
  indent: number,
  sawExplicitKey: boolean
): CstNode | undefined {
  if (token.kind === "block-map-start" && token.column <= indent) return skipScopeMarker(state);
  if (token.kind === "block-seq-start" && sawExplicitKey) {
    return parseBlockSequence(state, findFirstSeqEntryColumn(state));
  }
  if (token.kind !== "block-seq-entry") return parseBlockNode(state, token);
  if (token.column === indent) return parseCompactSeqValue(state, indent);
  return sawExplicitKey ? parseBlockSequence(state, token.column) : consumeLeafToken(state);
}

function startsCompactMappingKey(state: ParserState): boolean {
  if (atEnd(state)) return false;
  const { kind } = peek(state);
  if (kind === "block-map-value") return true;
  const startsNode = HashSet.has(contentKinds, kind) || kind === "flow-map-start" || kind === "flow-seq-start";
  return startsNode && !isBlockScalarToken(state) && hasImplicitMapAhead(state);
}

// decision: explicit-key-value-forms
function parseExplicitKeyIndicator(state: ParserState, indent: number): CstNode[] {
  const nodes = [consumeLeafToken(state)];
  while (!atEnd(state) && peek(state).kind === "whitespace") nodes.push(consumeLeafToken(state));
  return startsCompactMappingKey(state) ? [...nodes, parseImplicitBlockMapping(state, indent)] : nodes;
}

// decision: explicit-key-value-forms
function parseBlockMapToken(
  state: ParserState,
  token: YamlToken.Data,
  indent: number,
  children: CstNode[],
  sawExplicitKey: boolean
): boolean {
  if (isTrivia(token)) {
    children.push(...consumeTrivia(state));
    return sawExplicitKey;
  }
  if (token.kind === "block-map-key") {
    children.push(...parseExplicitKeyIndicator(state, indent));
    return true;
  }
  if (token.kind === "block-map-value") {
    children.push(consumeLeafToken(state));
    children.push(...parseBlockValue(state, indent, sawExplicitKey));
    return false;
  }
  if (isDeeperValueMarker(state, token, children)) {
    skipScopeMarker(state);
    return sawExplicitKey;
  }
  const node = parseBlockMapNode(state, token, indent, sawExplicitKey);
  if (node !== undefined) children.push(node);
  return sawExplicitKey;
}

const parseBlockMappingInner: {
  (state: ParserState, indent: number): CstNode;
  (indent: number): (state: ParserState) => CstNode;
} = dual(2, (state: ParserState, indent: number): CstNode => {
  const children: CstNode[] = [];
  let sawExplicitKey = false;

  advance(state);

  while (!atEnd(state) && !blockMapStops(peek(state), indent, children, sawExplicitKey)) {
    sawExplicitKey = parseBlockMapToken(state, peek(state), indent, children, sawExplicitKey);
  }

  return makeContainerNode("block-map", children, state.text);
});

// decision: explicit-key-value-forms
function parseBlockValueEnd(
  state: ParserState,
  token: YamlToken.Data,
  parentIndent: number,
  explicitKey: boolean
): CstNode | undefined {
  if (token.kind === "flow-map-start" || token.kind === "flow-seq-start") return parseFlowOrLeaf(state, token.kind);
  if (isBlockScalarToken(state)) return parseBlockScalar(state);
  if (!explicitKey) return undefined;
  if (token.kind === "block-seq-start" || token.kind === "block-seq-entry") {
    return parseBlockSequence(state, findFirstSeqEntryColumn(state));
  }
  return token.kind === "scalar" && hasImplicitMapAhead(state)
    ? parseImplicitBlockMapping(state, parentIndent)
    : undefined;
}

// decision: column-decided-block-ends
const parseBlockValue: {
  (parentIndent: number, explicitKey?: boolean): (state: ParserState) => CstNode[];
  (state: ParserState, parentIndent: number, explicitKey?: boolean): CstNode[];
} = dual(
  (args) => P.isObjectKeyword(args[0]),
  (state: ParserState, parentIndent: number, explicitKey?: boolean): CstNode[] => {
    const nodes: CstNode[] = [];
    while (!atEnd(state)) {
      const token = peek(state);
      const end = parseBlockValueEnd(state, token, parentIndent, explicitKey === true);
      if (end !== undefined) {
        nodes.push(end);
        break;
      }
      if (!HashSet.has(inlineValueKinds, token.kind)) break;
      nodes.push(consumeLeafToken(state));
    }
    return nodes;
  }
);

const parseBlockSequence: {
  (state: ParserState, indent: number): CstNode;
  (indent: number): (state: ParserState) => CstNode;
} = dual(2, (state: ParserState, indent: number): CstNode => {
  const guarded = guardDepth(state);
  if (guarded !== null) return guarded;
  state.depth++;
  try {
    return parseBlockSequenceInner(state, indent);
  } finally {
    state.depth--;
  }
});

// decision: block-collection-scopes
// decision: column-decided-block-ends
const parseBlockSequenceInner: {
  (state: ParserState, indent: number): CstNode;
  (indent: number): (state: ParserState) => CstNode;
} = dual(2, (state: ParserState, indent: number): CstNode => {
  const children: CstNode[] = [];

  const startToken = peek(state);
  if (startToken?.kind === "block-seq-start") {
    advance(state);
  }

  while (!atEnd(state)) {
    const token = peek(state);
    if (token.kind === "block-seq-start") {
      advance(state);
      continue;
    }
    if (token.kind !== "block-seq-entry" || token.column !== indent) break;
    children.push(consumeLeafToken(state));
    children.push(...parseSequenceEntryContent(state, indent));
  }

  return makeContainerNode("block-seq", children, state.text);
});

// decision: column-decided-block-ends
function implicitMapVerdict(t: YamlToken.Data, text: string): boolean | undefined {
  if (t.kind === "newline" || isBlockScalarAt(t, text)) return false;
  return t.kind === "block-map-value" ? true : undefined;
}

// decision: column-decided-block-ends
function hasImplicitMapAhead(state: ParserState): boolean {
  let flowDepth = 0;
  for (let i = state.pos; i < state.tokens.length; i++) {
    const t = A.getUnsafe(state.tokens, i);
    const delta = flowDepthDeltas[t.kind] ?? 0;
    flowDepth += delta;
    const verdict = delta === 0 && flowDepth <= 0 ? implicitMapVerdict(t, state.text) : undefined;
    if (verdict !== undefined) return verdict;
  }
  return false;
}

// decision: column-decided-block-ends
function seqEntryContentStops(state: ParserState, token: YamlToken.Data, seqIndent: number): boolean {
  if (isDocumentBoundary(token)) return true;
  if (HashSet.has(seqEntryIndentedKinds, token.kind)) return token.column <= seqIndent && !isBlockScalarToken(state);
  return !HashSet.has(seqEntryAnyColumnKinds, token.kind);
}

// decision: block-collection-scopes
function entryIsImplicitMap(state: ParserState, seqIndent: number): boolean {
  const nextToken = findNextNonTrivia(state);
  const nestedSeqFirst = nextToken?.kind === "block-seq-entry" && nextToken.column > seqIndent;
  return !nestedSeqFirst && nextToken?.kind !== "block-map-start" && hasImplicitMapAhead(state);
}

// decision: block-collection-scopes
const parseSequenceEntryContent: {
  (state: ParserState, seqIndent: number): CstNode[];
  (seqIndent: number): (state: ParserState) => CstNode[];
} = dual(2, (state: ParserState, seqIndent: number): CstNode[] => {
  if (entryIsImplicitMap(state, seqIndent)) return [parseImplicitBlockMapping(state, seqIndent)];

  const nodes: CstNode[] = [];
  while (!atEnd(state) && !seqEntryContentStops(state, peek(state), seqIndent)) {
    const token = peek(state);
    if (isTrivia(token)) nodes.push(...consumeTrivia(state));
    else if (token.kind === "block-seq-entry") nodes.push(parseBlockSequence(state, token.column));
    else nodes.push(parseBlockNode(state, token));
  }
  return nodes;
});

// decision: block-collection-scopes
const parseImplicitBlockMapping: {
  (state: ParserState, seqIndent: number): CstNode;
  (seqIndent: number): (state: ParserState) => CstNode;
} = dual(2, (state: ParserState, seqIndent: number): CstNode => {
  const guarded = guardDepth(state);
  if (guarded !== null) return guarded;
  state.depth++;
  try {
    return parseImplicitBlockMappingInner(state, seqIndent);
  } finally {
    state.depth--;
  }
});

// decision: column-decided-block-ends
function implicitMapStops(
  state: ParserState,
  token: YamlToken.Data,
  seqIndent: number,
  hasChildren: boolean,
  entryIndent: number
): boolean {
  if (isDocumentBoundary(token)) return true;
  if (token.column > seqIndent) return false;
  if (token.kind === "block-seq-entry" || token.kind === "block-map-key") return true;
  if (token.kind === "block-map-value" || token.kind === "block-seq-start") return hasChildren;
  return entryIndent >= 0 && HashSet.has(contentKinds, token.kind) && !isBlockScalarToken(state);
}

// decision: block-collection-scopes
function parseImplicitMapNode(
  state: ParserState,
  token: YamlToken.Data,
  entryIndent: number,
  children: readonly CstNode[]
): CstNode | undefined {
  if (token.kind === "block-map-start" && entryIndent >= 0 && token.column <= entryIndent) {
    return skipScopeMarker(state);
  }
  if (token.kind === "block-seq-entry" && token.column === entryIndent && lastNonTriviaIsValueSep(children)) {
    return parseCompactSeqValue(state, entryIndent);
  }
  return parseBlockNode(state, token);
}

// decision: explicit-key-value-forms
function parseImplicitMapIndicator(
  state: ParserState,
  token: YamlToken.Data,
  seqIndent: number,
  children: CstNode[],
  entryIndent: number
): boolean {
  if (token.kind === "block-map-key") {
    children.push(...parseExplicitKeyIndicator(state, entryIndent));
    return true;
  }
  if (token.kind === "block-map-value") {
    const explicitKey = hasOpenExplicitKey(children);
    children.push(consumeLeafToken(state));
    children.push(...parseBlockValue(state, explicitKey ? entryIndent : seqIndent, explicitKey));
    return true;
  }
  if (!isDeeperValueMarker(state, token, children)) return false;
  skipScopeMarker(state);
  return true;
}

// decision: block-collection-scopes
function parseImplicitMapToken(
  state: ParserState,
  token: YamlToken.Data,
  seqIndent: number,
  children: CstNode[],
  entryIndent: number
): number {
  if (HashSet.has(contentKinds, token.kind) && !isBlockScalarToken(state)) {
    children.push(consumeLeafToken(state));
    return entryIndent < 0 ? token.column : entryIndent;
  }
  if (isTrivia(token)) {
    children.push(...consumeTrivia(state));
    return entryIndent;
  }
  if (parseImplicitMapIndicator(state, token, seqIndent, children, entryIndent)) return entryIndent;
  const node = parseImplicitMapNode(state, token, entryIndent, children);
  if (node !== undefined) children.push(node);
  return entryIndent;
}

const parseImplicitBlockMappingInner: {
  (state: ParserState, seqIndent: number): CstNode;
  (seqIndent: number): (state: ParserState) => CstNode;
} = dual(2, (state: ParserState, seqIndent: number): CstNode => {
  const children: CstNode[] = [];
  let entryIndent = -1;

  while (!atEnd(state) && !implicitMapStops(state, peek(state), seqIndent, children.length > 0, entryIndent)) {
    entryIndent = parseImplicitMapToken(state, peek(state), seqIndent, children, entryIndent);
  }

  return makeContainerNode("block-map", children, state.text);
});

// decision: document-comment-scopes
function isPrologueTrivia(state: ParserState, token: YamlToken.Data): boolean {
  if (!isTrivia(token)) return false;
  if (token.kind !== "comment") return true;
  const nextNonTrivia = findNextNonTrivia(state);
  return nextNonTrivia?.kind === "directive" || nextNonTrivia?.kind === "document-start";
}

function parseDocumentPrologue(state: ParserState, children: CstNode[]): void {
  while (!atEnd(state)) {
    const token = peek(state);
    if (token.kind === "directive" || token.kind === "byte-order-mark") children.push(consumeLeafToken(state));
    else if (isPrologueTrivia(state, token)) children.push(...consumeTrivia(state));
    else break;
  }
  if (!atEnd(state) && peek(state).kind === "document-start") {
    children.push(consumeLeafToken(state));
  }
}

function parseDocumentEnd(state: ParserState, children: CstNode[]): void {
  children.push(consumeLeafToken(state));
  while (!atEnd(state) && isTrivia(peek(state))) {
    children.push(...consumeTrivia(state));
  }
}

function parseDocument(state: ParserState): CstNode {
  const children: CstNode[] = [];
  parseDocumentPrologue(state, children);

  while (!atEnd(state) && peek(state).kind !== "document-start") {
    const token = peek(state);
    if (token.kind === "document-end") {
      parseDocumentEnd(state, children);
      break;
    }
    if (isTrivia(token)) children.push(...consumeTrivia(state));
    else children.push(parseBlockNode(state, token));
  }

  return makeContainerNode("document", children, state.text);
}

function findNextNonTrivia(state: ParserState): YamlToken.Data | undefined {
  for (let i = state.pos; i < state.tokens.length; i++) {
    const t = A.getUnsafe(state.tokens, i);
    if (!isTrivia(t)) return t;
  }
  return undefined;
}

const parseDocuments: {
  (tokens: ReadonlyArray<YamlToken.Data>, text: string): CstNode[];
  (text: string): (tokens: ReadonlyArray<YamlToken.Data>) => CstNode[];
} = dual(2, (tokens: ReadonlyArray<YamlToken.Data>, text: string): CstNode[] => {
  const state: ParserState = { tokens, text, pos: 0, depth: 0 };
  const documents: CstNode[] = [];

  if (atEnd(state)) {
    return [{ type: "document", source: "", offset: 0, length: 0, children: [] }];
  }

  while (!atEnd(state)) {
    const doc = parseDocument(state);

    const docChildren = doc.children ?? [];
    const hasDocStart = A.some(docChildren, (c) => c.type === "whitespace" && c.source === "---");
    const hasContent = A.some(
      docChildren,
      (c) => c.type !== "whitespace" && c.type !== "newline" && c.type !== "comment" && c.type !== "error"
    );
    if (hasDocStart || hasContent || documents.length === 0) {
      documents.push(doc);
    }
  }

  return documents;
});

/**
 * Parses YAML source text and collects all CST document nodes into an array.
 *
 * **Details**
 *
 * Each CST node preserves every character of the original input, including
 * whitespace, comments, and structural indicators. No value interpretation
 * occurs at this stage — `true` is still the string `"true"`.
 *
 * **Example** (Inspect an uninterpreted scalar)
 *
 * ```ts
 * import { parseCSTAll } from "@beep/yaml/internal/cst-parser"
 *
 * const documents = parseCSTAll("true")
 * console.log(documents.length) // 1
 * console.log(documents[0]?.children?.[0]?.type) // flow-scalar
 * console.log(documents[0]?.children?.[0]?.source) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function parseCSTAll(text: string): ReadonlyArray<CstNode> {
  return parseDocuments(lexAll(text), text);
}
