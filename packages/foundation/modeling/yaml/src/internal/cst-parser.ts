// YAML 1.2 CST parser — transforms a token stream into a Concrete Syntax Tree.
//
// The CST preserves every character of the original input, including
// whitespace, comments, and structural indicators. No value interpretation
// occurs at this stage.

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

// ---------------------------------------------------------------------------
// Internal parser state
// ---------------------------------------------------------------------------

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

/**
 * Hardening: cap CST nesting so hostile inputs cannot overflow the stack
 * while the tree is being BUILT. Set slightly above the composer's
 * MAX_NESTING_DEPTH (256) so the composer's own guard — which reports the
 * user-facing NestingDepthExceeded diagnostic — always fires first when the
 * capped tree is composed.
 */
const MAX_CST_DEPTH = 256 + 8;

/**
 * When the depth budget is exhausted, consume the current token and return
 * a flat error node instead of recursing. Returns null when within budget.
 */
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

// The lexer produces a dense token array; callers establish an in-bounds position.
function peek(state: ParserState): YamlToken.Data {
  return A.getUnsafe(state.tokens, state.pos);
}

function advance(state: ParserState): YamlToken.Data {
  const token = peek(state);
  state.pos++;
  return token;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if the current token is a trivia token (whitespace, newline, comment). */
function isTrivia(token: YamlToken.Data): boolean {
  return token.kind === "whitespace" || token.kind === "newline" || token.kind === "comment";
}

/** Check if the current token starts a new document boundary. */
function isDocumentBoundary(token: YamlToken.Data): boolean {
  return token.kind === "document-start" || token.kind === "document-end";
}

/** Build a CstNode from collected children, computing source from the text. */
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

/**
 * Create a leaf CstNode from a token, using the raw source text.
 *
 * **Details**
 *
 * We slice from the original text rather than using `token.value` because
 * the lexer decodes certain tokens (e.g. quoted scalars have quotes stripped
 * and escape sequences resolved in `value`), but the CST must preserve
 * the raw source text exactly as written.
 */
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

// ---------------------------------------------------------------------------
// Recursive descent parser
// ---------------------------------------------------------------------------

/**
 * Consume trivia tokens (whitespace, newline, comment) and return them as CST nodes.
 */
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

/** Exhaustive leaf dispatch, preserving each token's raw source span. */
const leafNodeTypes: Readonly<Record<YamlTokenKind, CstNodeType>> = {
  whitespace: "whitespace",
  newline: "newline",
  comment: "comment",
  scalar: "flow-scalar",
  anchor: "anchor",
  alias: "alias",
  tag: "tag",
  directive: "directive",
  // Commas are structural punctuation; typed as "whitespace" since
  // CstNodeType has no dedicated delimiter type. The raw "," is
  // preserved in the node's source field.
  "flow-separator": "whitespace",
  // Structural indicators (":", "?", "-") are typed as "whitespace"
  // when consumed as generic leaf tokens (e.g. inside flow contexts).
  "block-map-value": "whitespace",
  "block-map-key": "whitespace",
  "block-seq-entry": "whitespace",
  // Document markers ("---", "...") consumed as leaf tokens.
  "document-start": "whitespace",
  "document-end": "whitespace",
  // Flow brackets consumed as leaf tokens outside their normal
  // parse path — treat as structural whitespace.
  "flow-map-start": "whitespace",
  "flow-map-end": "whitespace",
  "flow-seq-start": "whitespace",
  "flow-seq-end": "whitespace",
  // Zero-width start markers from the lexer — skip gracefully.
  "block-map-start": "whitespace",
  "block-seq-start": "whitespace",
  // BOM is structural metadata, not visible content. Mapping it to
  // "whitespace" is intentional — it keeps source fidelity without
  // needing a dedicated CstNodeType variant.
  "byte-order-mark": "whitespace",
  error: "error",
};

/**
 * Consume a single trivia-or-content token and return it as a CST node.
 * Used for tokens that don't form higher-level structures.
 */
function consumeLeafToken(state: ParserState): CstNode {
  const token = peek(state);
  advance(state);

  return makeLeafNode(leafNodeTypes[token.kind], token, state.text);
}

/**
 * Parse a flow mapping: `{ ... }`
 */
function parseFlowMapping(state: ParserState): CstNode {
  return parseFlowCollection(state, "flow-map-end", "flow-map");
}

/**
 * Parse a flow sequence: [ ... ]
 */
function parseFlowSequence(state: ParserState): CstNode {
  return parseFlowCollection(state, "flow-seq-end", "flow-seq");
}

/**
 * Parse a flow collection under the nesting-depth guard: its opening bracket,
 * nested collections and leaf tokens up to the closing `endKind` bracket.
 * Brackets are typed as "whitespace" since they are structural punctuation,
 * not scalar content.
 */
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

/** Parse the flow collection the current token opens, or consume the token as a leaf. */
function parseFlowOrLeaf(state: ParserState, ...[kind]: [kind: YamlTokenKind]): CstNode {
  if (kind === "flow-map-start") return parseFlowMapping(state);
  if (kind === "flow-seq-start") return parseFlowSequence(state);
  return consumeLeafToken(state);
}

/**
 * Parse a block scalar token. The lexer already handles the block scalar
 * content (literal `|` or folded `\>`), so we just need to wrap it.
 */
function parseBlockScalar(state: ParserState): CstNode {
  const token = advance(state);
  // The lexer gives us a "scalar" token whose raw span in the original text
  // covers the entire block scalar including the indicator.
  // We use token.offset and token.length to get the raw source.
  const source = Str.slice(token.offset, token.offset + token.length)(state.text);
  return {
    type: "block-scalar",
    source,
    offset: token.offset,
    length: token.length,
  };
}

/**
 * Check if the current position has a block scalar indicator in the original text.
 */
function isBlockScalarToken(state: ParserState): boolean {
  return isBlockScalarAt(peek(state), state.text);
}

/** Whether `token` is a scalar whose source starts with a block scalar indicator. */
function isBlockScalarAt(token: YamlToken.Data | undefined, text: string): boolean {
  if (token?.kind !== "scalar") return false;
  const ch = text[token.offset];
  return ch === "|" || ch === ">";
}

/** Content tokens that may start a key or value: scalars plus node properties and aliases. */
const contentKinds: HashSet.HashSet<YamlTokenKind> = HashSet.make<ReadonlyArray<YamlTokenKind>>(
  "scalar",
  "anchor",
  "alias",
  "tag"
);

/** Tokens a block value line consumes as leaves: inline whitespace and content. */
const inlineValueKinds: HashSet.HashSet<YamlTokenKind> = HashSet.union(
  contentKinds,
  HashSet.make<ReadonlyArray<YamlTokenKind>>("whitespace")
);

/** Block-mapping tokens that belong to an ancestor mapping when they sit left of its indent. */
const blockMapEntryKinds: HashSet.HashSet<YamlTokenKind> = HashSet.union(
  contentKinds,
  HashSet.make<ReadonlyArray<YamlTokenKind>>("block-map-key", "block-map-value")
);

/** Sequence-entry content tokens that belong to a parent scope at or left of the sequence indent. */
const seqEntryIndentedKinds: HashSet.HashSet<YamlTokenKind> = HashSet.union(
  blockMapEntryKinds,
  HashSet.make<ReadonlyArray<YamlTokenKind>>("block-seq-entry", "block-seq-start")
);

/** Other tokens a sequence entry's content admits regardless of column. */
const seqEntryOtherKinds: HashSet.HashSet<YamlTokenKind> = HashSet.make<ReadonlyArray<YamlTokenKind>>(
  "whitespace",
  "newline",
  "comment",
  "block-map-start",
  "flow-map-start",
  "flow-seq-start"
);

/** CST node types skipped when looking back for a dangling `:`: trivia and node properties. */
const valueSepSkippedTypes: HashSet.HashSet<CstNodeType> = HashSet.make<ReadonlyArray<CstNodeType>>(
  "whitespace",
  "newline",
  "comment",
  "anchor",
  "tag"
);

/** Flow-nesting change for each bracket token. */
const flowDepthDeltas: Readonly<Partial<Record<YamlTokenKind, number>>> = {
  "flow-map-start": 1,
  "flow-seq-start": 1,
  "flow-map-end": -1,
  "flow-seq-end": -1,
};

/** A `:` value-separator leaf. */
function isValueSepNode(c: CstNode): boolean {
  return c.type === "whitespace" && c.source === ":";
}

/**
 * Check if the last non-trivia child in a CST node list is a value separator
 * (`:`) with no subsequent value content. This indicates the next block
 * structure should be consumed as the mapping value, not ejected as a sibling.
 * Anchors and tags are metadata that attach to the next value — they don't
 * count as value content for the purpose of this check.
 */
function lastNonTriviaIsValueSep(children: readonly CstNode[]): boolean {
  const last = A.findLast(children, (c) => isValueSepNode(c) || !HashSet.has(valueSepSkippedTypes, c.type));
  return O.isSome(last) && isValueSepNode(last.value);
}

/** The lexer queues each sequence-start marker immediately before its entry. */
function findFirstSeqEntryColumn(state: ParserState): number {
  const entryIndex = state.pos + (peek(state).kind === "block-seq-start" ? 1 : 0);
  return A.getUnsafe(state.tokens, entryIndex).column;
}

/** Consume a zero-width scope marker the lexer re-emitted; it yields no node. */
function skipScopeMarker(state: ParserState): undefined {
  advance(state);
  return undefined;
}

/**
 * Parse the block node the current token starts: a nested block mapping or
 * sequence at the token's column, a block scalar, or a flow collection —
 * anything else is consumed as a leaf.
 */
function parseBlockNode(state: ParserState, token: YamlToken.Data): CstNode {
  if (token.kind === "block-map-start") return parseBlockMapping(state, token.column);
  if (token.kind === "block-seq-start") return parseBlockSequence(state, token.column);
  return isBlockScalarToken(state) ? parseBlockScalar(state) : parseFlowOrLeaf(state, token.kind);
}

/**
 * Parse a block mapping at the given indentation level.
 */
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

/**
 * Whether a sequence token ends a block mapping at `indent`.
 *
 * **Details**
 *
 * A block-seq-start at the same or lower indent stops the mapping — UNLESS
 * the last non-trivia child was a ":" value separator with no value, meaning
 * this sequence is the value of the previous mapping entry. For explicit key
 * mappings, the sequence after ":" is already consumed by parseBlockValue, so
 * this check only applies to sequences appearing on a subsequent line after
 * ":" (not same-line). Also don't stop when we're in the middle of consuming
 * an explicit key (`?` seen, no `:` yet) and the seq IS the explicit key
 * (KK5P, M5DY: `? - a`). The lexer emits block-seq-start at lineIndent which
 * can be at or below the mapping indent in this case.
 *
 * A block-seq-entry at or left of the indent belongs to a parent sequence,
 * except a same-indent entry after a dangling ":", which starts a compact
 * sequence value.
 */
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

/**
 * Whether `token` ends a block mapping at `indent`: a document boundary; a
 * `?`, `:` or content token at a shallower column, which belongs to an
 * ancestor mapping (without this, a nested map swallows the sibling `? key`
 * and mis-nests subsequent entries); a shallower block-map-start; or a
 * sequence token per {@link blockMapSeqStops}.
 */
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

/**
 * Compact block sequence as mapping value: when a seq entry appears at the
 * same indent as the mapping and the last non-trivia was a value separator
 * ":", this sequence is the value of the current key. Build a synthetic
 * block-seq container for these entries.
 */
function parseCompactSeqValue(state: ParserState, indent: number): CstNode {
  const seqChildren: CstNode[] = [];
  while (!atEnd(state) && peek(state).kind === "block-seq-entry" && peek(state).column === indent) {
    seqChildren.push(...consumeTrivia(state));
    seqChildren.push(consumeLeafToken(state));
    // Consume content after the entry dash
    seqChildren.push(...parseSequenceEntryContent(state, indent));
  }
  return makeContainerNode("block-seq", seqChildren, state.text);
}

/**
 * Parse a node inside a block mapping at `indent`; `undefined` when the token
 * is a same-indent block-map-start the lexer re-emitted (consumed silently).
 *
 * **Details**
 *
 * When `?` introduces an explicit key followed by a block-seq on the same
 * line (`? - a`), the lexer emits block-seq-start at lineIndent but the
 * actual entries are at a deeper column. Use the entry column in that case so
 * parseBlockSequence's indent comparisons match (KK5P, M5DY, M2N8 explicit-?
 * compact-key form). For implicit-key value position (`key: - a`), keep
 * token.column to preserve invalid-input rejection (5U3A).
 */
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
  return token.column === indent ? parseCompactSeqValue(state, indent) : consumeLeafToken(state);
}

/**
 * Consume one token of a block mapping at `indent` into `children`,
 * returning whether an explicit key (`?`) is open afterwards. After ":", the
 * value is consumed with the explicit-key context so parseBlockValue knows
 * whether inline sequences are valid.
 */
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
    children.push(consumeLeafToken(state));
    return true;
  }
  if (token.kind === "block-map-value") {
    children.push(consumeLeafToken(state));
    children.push(...parseBlockValue(state, indent, sawExplicitKey));
    return false;
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

  // Consume the block-map-start token
  advance(state);

  while (!atEnd(state) && !blockMapStops(peek(state), indent, children, sawExplicitKey)) {
    sawExplicitKey = parseBlockMapToken(state, peek(state), indent, children, sawExplicitKey);
  }

  return makeContainerNode("block-map", children, state.text);
});

/**
 * The value a mapping value line ends with, when the token starts one: an
 * inline flow collection, a block scalar, or (after an explicit key) a block
 * sequence or compact mapping.
 *
 * **Details**
 *
 * A block sequence starting on the same line as ":" in an explicit mapping
 * (e.g., `? key\n: - one`) is the value; the lexer's block-seq-start column
 * may not match the entry column (it uses lineIndent from the ":"
 * indicator), so the actual entry column is the sequence indent. Inline
 * sequences after implicit keys (e.g., "key: - a") are invalid per YAML 1.2
 * §8.2.1 and are left as leaf tokens for the composer to reject.
 *
 * A compact mapping starting on the same line as ":" in an explicit mapping
 * (YAML 1.2 §8.2.2: l-block-map-explicit-value admits s-l+block-indented,
 * which includes ns-l-compact-mapping) is the value too, e.g.
 * `? key\n: dependencies:\n    x: 1`. For implicit keys (`key: a: 1`) this
 * stays invalid and the tokens are left for the composer to reject (ZCZC
 * preserved).
 */
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

/**
 * Parse the value part after a ":" in a block mapping.
 *
 * **Details**
 *
 * Consumes inline whitespace ONLY — never via consumeTrivia, which would
 * greedily swallow a trailing comment AND the newline after it, blowing past
 * the line boundary. The loop would then keep consuming the next line's
 * tokens as value content with no column check, so a dedented sibling key
 * after `value # comment` was absorbed into the nested mapping (trailing
 * comment on the last key of a nested block mapping swallowed the following
 * dedent). Comments and newlines end the value line.
 */
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

/**
 * Parse a block sequence at the given indentation level.
 */
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

const parseBlockSequenceInner: {
  (state: ParserState, indent: number): CstNode;
  (indent: number): (state: ParserState) => CstNode;
} = dual(2, (state: ParserState, indent: number): CstNode => {
  const children: CstNode[] = [];

  // Consume the block-seq-start token
  const startToken = peek(state);
  if (startToken?.kind === "block-seq-start") {
    advance(state);
  }

  while (!atEnd(state)) {
    const token = peek(state);
    if (token.kind === "block-seq-start") {
      // Entry-content parsing already consumes deeper starts and all trivia.
      // Only a re-emitted parent/sibling scope marker can remain here.
      advance(state);
      continue;
    }
    // Anything but an entry at this indent belongs to the parent
    if (token.kind !== "block-seq-entry" || token.column !== indent) break;
    children.push(consumeLeafToken(state));
    // Parse the entry content
    children.push(...parseSequenceEntryContent(state, indent));
  }

  return makeContainerNode("block-seq", children, state.text);
});

/**
 * Whether a block-flow token settles {@link hasImplicitMapAhead}; `undefined`
 * keeps scanning. A block scalar ends the line like a newline does: its token
 * swallows the line breaks of its body, so a ":" after it sits on a later line.
 * Every token the scan meets before either sits on the entry's own line, so
 * none can be a sibling entry.
 */
function implicitMapVerdict(t: YamlToken.Data, text: string): boolean | undefined {
  if (t.kind === "newline" || isBlockScalarAt(t, text)) return false;
  return t.kind === "block-map-value" ? true : undefined;
}

/**
 * Look ahead (without consuming) to see if a block-map-value token exists
 * before the end of the current line.
 * Document boundaries and sibling sequence entries are line-start tokens, so
 * their preceding newline stops the scan.
 * Flow depth is tracked so a ":" inside `{ }` or `[ ]` is not mistaken for a
 * block mapping value indicator.
 */
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

/**
 * Whether `token` ends a sequence entry's content: a document boundary, an
 * entry/structure/content token at or left of the sequence indent (it
 * belongs to a parent scope, e.g. a sibling key in the parent mapping, or is
 * a re-emitted scope marker for a sibling entry) unless it is a block scalar,
 * or any token the entry content does not admit.
 */
function seqEntryContentStops(state: ParserState, token: YamlToken.Data, seqIndent: number): boolean {
  if (isDocumentBoundary(token)) return true;
  if (HashSet.has(seqEntryIndentedKinds, token.kind)) return token.column <= seqIndent && !isBlockScalarToken(state);
  return !HashSet.has(seqEntryOtherKinds, token.kind);
}

/**
 * Whether a sequence entry's content is an implicit mapping (scalar followed
 * by ":"), to be wrapped up to the next entry / doc boundary into a
 * block-map. If the immediate next non-trivia token is a nested seq entry
 * (deeper indent), it is parsed as a nested sequence first instead. This
 * prevents the implicit mapping check from absorbing nested "- key: value"
 * patterns that belong inside the nested sequence.
 */
function entryIsImplicitMap(state: ParserState, seqIndent: number): boolean {
  const nextToken = findNextNonTrivia(state);
  const nestedSeqFirst = nextToken?.kind === "block-seq-entry" && nextToken.column > seqIndent;
  return !nestedSeqFirst && hasImplicitMapAhead(state);
}

/**
 * Parse the content of a sequence entry (after the `-`). A nested sequence
 * entry (deeper indent) without a prior block-seq-start synthesises a nested
 * sequence parse at that indent level.
 */
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

/**
 * Parse an implicit block mapping (no block-map-start token from the lexer).
 * This occurs inside sequence entries like `- a: 1`.
 */
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

/**
 * Whether `token` ends an implicit mapping inside a sequence entry at
 * `seqIndent`. Only tokens at or left of the parent indent can: the next
 * sequence entry, an explicit-key indicator (`?`, the parent mapping's next
 * entry), a `:` (the parent's next value indicator, e.g. of a following
 * explicit entry) or block-seq-start once this mapping has content, and a
 * non-block-scalar content token once a key has been seen. Document
 * boundaries always end it.
 */
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

/**
 * Parse a structure token inside an implicit mapping. A block-map-start at
 * the same (or shallower) indent as the entries is just the lexer re-emitting
 * a scope marker — it is consumed silently (`undefined`); a deeper one opens
 * a nested sub-mapping. A block-seq-entry at the entries' indent after a
 * dangling ":" starts a compact sequence value (YAML 1.2 l+block-sequence(n-1)
 * for a block mapping value); the lexer emits no block-seq-start for it once
 * an earlier compact sequence opened that indent.
 */
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

/**
 * Consume one token of an implicit mapping into `children`, returning the
 * entry indent afterwards: the column of the first key, which distinguishes
 * a same-level block-map-start (continuation) from a deeper one (nested
 * sub-mapping).
 */
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
  if (token.kind === "block-map-value") {
    children.push(consumeLeafToken(state));
    // After ":", consume the value
    children.push(...parseBlockValue(state, seqIndent));
    return entryIndent;
  }
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

/**
 * Whether trivia before the document start belongs to the prologue: a
 * comment does only when a directive or document-start follows it
 * (directives-adjacent).
 */
function isPrologueTrivia(state: ParserState, token: YamlToken.Data): boolean {
  if (!isTrivia(token)) return false;
  if (token.kind !== "comment") return true;
  const nextNonTrivia = findNextNonTrivia(state);
  return nextNonTrivia?.kind === "directive" || nextNonTrivia?.kind === "document-start";
}

/**
 * Consume leading directives and their trivia, then the document-start marker
 * if present. A byte-order mark opens the document prefix (YAML 1.2 §9.1.1), so
 * the directives and `---` behind it stay in the same document.
 */
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

/** Consume a document-end marker and the trivia trailing it. */
function parseDocumentEnd(state: ParserState, children: CstNode[]): void {
  children.push(consumeLeafToken(state));
  while (!atEnd(state) && isTrivia(peek(state))) {
    children.push(...consumeTrivia(state));
  }
}

/**
 * Parse a single document from the token stream.
 */
function parseDocument(state: ParserState): CstNode {
  const children: CstNode[] = [];
  parseDocumentPrologue(state, children);

  // Parse document content, stopping at the next document boundary
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

/**
 * Find the next non-trivia token without consuming.
 */
function findNextNonTrivia(state: ParserState): YamlToken.Data | undefined {
  for (let i = state.pos; i < state.tokens.length; i++) {
    const t = A.getUnsafe(state.tokens, i);
    if (!isTrivia(t)) return t;
  }
  return undefined;
}

/**
 * Parse all documents from the token stream.
 */
const parseDocuments: {
  (tokens: ReadonlyArray<YamlToken.Data>, text: string): CstNode[];
  (text: string): (tokens: ReadonlyArray<YamlToken.Data>) => CstNode[];
} = dual(2, (tokens: ReadonlyArray<YamlToken.Data>, text: string): CstNode[] => {
  const state: ParserState = { tokens, text, pos: 0, depth: 0 };
  const documents: CstNode[] = [];

  if (atEnd(state)) {
    // Empty input — return a single empty document
    return [{ type: "document", source: "", offset: 0, length: 0, children: [] }];
  }

  while (!atEnd(state)) {
    const doc = parseDocument(state);

    // Skip bare document-end markers that don't contain any content.
    // A document is content-free if it only contains trivia (whitespace,
    // newline, comment) and document-end nodes. Per YAML spec, a standalone
    // `...` without preceding content does not produce a document.
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

// ---------------------------------------------------------------------------
// Engine API
// ---------------------------------------------------------------------------

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
