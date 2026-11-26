import { $YamlId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YamlMap, YamlNode, YamlSeq } from "../../YamlNode.ts";
import { CstNode } from "../cst.ts";
import { RawDiagnostic } from "../diagnostics.ts";
import { checkAnchorOnAlias, getAnchorName, makeAlias, registerMetaAnchor } from "./anchors.ts";
import {
  buildPairs,
  checkDuplicateKeys,
  checkMultilineImplicitKeys,
  commentItem,
  SemanticItem,
  SemanticKey,
  SemanticNode,
  SemanticValueSep,
  validatePendingProperty,
} from "./block.ts";
import {
  blankLineAboveStart,
  CommentFields,
  hasBlankLineAbove,
  isOwnLineAt,
  joinPendingComments,
  leadingCommentFields,
  PendingComment,
  withCommentFields,
} from "./comments.ts";
import {
  collectMultilineKey,
  collectMultilinePlainScalar,
  getScalarStyle,
  hasValueSepThroughPlainScalars,
  makeScalar,
  plainScalarWithMeta,
} from "./scalars.ts";
import { enterNesting, exitNesting, hasMeta, NodeMeta, recordPendingTag, reportUnexpectedContent } from "./state.ts";
import type { YamlPair } from "../../YamlNode.ts";
import type { CstNodeType } from "../cst.ts";
import type { ComposerState } from "./state.ts";

const $I = $YamlId.create("internal/composer/flow");

const isPunctuation = (node: CstNode | undefined, source: string): boolean =>
  node?.type === "whitespace" && node.source === source;

const isBlankWhitespace = (node: CstNode | undefined): boolean =>
  node?.type === "whitespace" && Str.trim(node.source) === "";

const isPlainFlowScalar = (node: CstNode): boolean => node.type === "flow-scalar" && getScalarStyle(node) === "plain";

const isFlowContent = (node: CstNode): boolean =>
  node.type === "flow-scalar" ||
  node.type === "block-scalar" ||
  node.type === "flow-map" ||
  node.type === "flow-seq" ||
  node.type === "alias";

const FlowSeparatorScan = S.Struct({
  index: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("FlowSeparatorScan.index", { description: "Cursor into the flow collection's children." })
  ),
  colonCount: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("FlowSeparatorScan.colonCount", { description: "Colons seen since the last comma." })
  ),
  contentAfterColon: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("FlowSeparatorScan.contentAfterColon", {
      description: "Content tokens seen after the most recent colon.",
    })
  ),
  sawContent: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("FlowSeparatorScan.sawContent", { description: "Whether content followed the last separator." })
  ),
  separatorRequired: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("FlowSeparatorScan.separatorRequired", {
      description: "Whether a comment ended a scalar, so following content needs a comma.",
    })
  ),
  segmentStart: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("FlowSeparatorScan.segmentStart", { description: "Start index of the cached comma segment." })
  ),
  segmentEnd: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("FlowSeparatorScan.segmentEnd", { description: "End index of the cached comma segment." })
  ),
  segment: S.Array(CstNode).pipe(
    S.mutableKey,
    $I.annoteKey("FlowSeparatorScan.segment", { description: "Cached children of the current comma segment." })
  ),
}).pipe(
  $I.annoteSchema("FlowSeparatorScan", {
    description: "Structural state of the flow-separator validation walk, constructed directly.",
  })
);
type FlowSeparatorScan = typeof FlowSeparatorScan.Type;

const reportMissingComma = (state: ComposerState, node: CstNode): void => {
  state.errors.push(
    RawDiagnostic.make({
      code: "MalformedFlowCollection",
      message: "Missing comma between flow collection entries",
      offset: node.offset,
      length: node.length,
    })
  );
};

const isSeparatorNoise = (child: CstNode, openBracket: string, closeBracket: string): boolean =>
  child.type === "newline" ||
  isPunctuation(child, openBracket) ||
  isPunctuation(child, closeBracket) ||
  isBlankWhitespace(child);

const resetSeparatorEntry = (scan: FlowSeparatorScan, colonCount: number): void => {
  scan.colonCount = colonCount;
  scan.contentAfterColon = 0;
  scan.sawContent = false;
  scan.separatorRequired = false;
};

const scanSeparatorPunctuation = (scan: FlowSeparatorScan, child: CstNode, state: ComposerState): void => {
  if (child.source === ",") {
    resetSeparatorEntry(scan, 0);
    return;
  }
  if (child.source !== ":") return;
  if (scan.colonCount > 0) reportMissingComma(state, child);
  resetSeparatorEntry(scan, scan.colonCount + 1);
};

const findSegmentEnd = (children: readonly CstNode[], from: number, closeBracket: string): number => {
  let end = from;
  while (end < children.length) {
    const next = children[end];
    if (isPunctuation(next, ",") || isPunctuation(next, closeBracket)) break;
    end++;
  }
  return end;
};

const ensureSeparatorSegment = (scan: FlowSeparatorScan, children: readonly CstNode[], closeBracket: string): void => {
  if (scan.index < scan.segmentEnd) return;
  const segmentStart = scan.index;
  scan.segmentStart = segmentStart;
  scan.segmentEnd = findSegmentEnd(children, segmentStart + 1, closeBracket);
  scan.segment = A.makeBy(scan.segmentEnd - segmentStart, (offset) => A.getUnsafe(children, segmentStart + offset));
};

const consumeSeparatorPlainRun = (
  scan: FlowSeparatorScan,
  children: readonly CstNode[],
  closeBracket: string,
  state: ComposerState
): boolean => {
  ensureSeparatorSegment(scan, children, closeBracket);
  const cursor = scan.index - scan.segmentStart;
  const isNextKey = hasValueSepThroughPlainScalars(scan.segment, cursor + 1);
  const collected = isNextKey
    ? collectMultilineKey(scan.segment, cursor)
    : collectMultilinePlainScalar(scan.segment, cursor, undefined, state.text);
  scan.index = scan.segmentStart + collected.nextIdx - 1;
  return isNextKey;
};

const scanSeparatorContent = (
  scan: FlowSeparatorScan,
  children: readonly CstNode[],
  child: CstNode,
  closeBracket: string,
  state: ComposerState
): void => {
  const isNextKey = isPlainFlowScalar(child) && consumeSeparatorPlainRun(scan, children, closeBracket, state);
  if (!isNextKey) scan.contentAfterColon++;
  const valueOverflow = scan.colonCount > 0 && scan.contentAfterColon > 1 && !isNextKey;
  if (scan.separatorRequired || valueOverflow) reportMissingComma(state, child);
  scan.separatorRequired = false;
  scan.sawContent = true;
};

const scanSeparatorToken = (
  scan: FlowSeparatorScan,
  children: readonly CstNode[],
  child: CstNode,
  closeBracket: string,
  state: ComposerState
): void => {
  if (child.type === "comment") {
    if (scan.sawContent) scan.separatorRequired = true;
    return;
  }
  if (child.type === "whitespace") {
    scanSeparatorPunctuation(scan, child, state);
    return;
  }
  if (isFlowContent(child)) scanSeparatorContent(scan, children, child, closeBracket, state);
};

const validateFlowSeparators: {
  (children: readonly CstNode[], state: ComposerState, openBracket: string, closeBracket: string): void;
  (state: ComposerState, openBracket: string, closeBracket: string): (children: readonly CstNode[]) => void;
} = dual(4, (children: readonly CstNode[], state: ComposerState, openBracket: string, closeBracket: string): void => {
  const scan: FlowSeparatorScan = {
    index: 0,
    colonCount: 0,
    contentAfterColon: 0,
    sawContent: false,
    separatorRequired: false,
    segmentStart: 0,
    segmentEnd: 0,
    segment: [],
  };
  for (scan.index = 0; scan.index < children.length; scan.index++) {
    const child = children[scan.index];
    if (child === undefined || isSeparatorNoise(child, openBracket, closeBracket)) continue;
    scanSeparatorToken(scan, children, child, closeBracket, state);
  }
});

const isLineBreakChar = (ch: string | undefined): boolean => ch === "\n" || ch === "\r";

const isIndentChar = (ch: string | undefined): boolean => ch === " " || ch === "\t";

const skipLineBreak = (text: string, i: number): number => (text[i] === "\r" && text[i + 1] === "\n" ? i + 2 : i + 1);

const skipIndent = (text: string, from: number, end: number): number => {
  let i = from;
  while (i < end && isIndentChar(text[i])) i++;
  return i;
};

const findLineBreak = (text: string, from: number, end: number): number => {
  let i = from;
  while (i < end && !isLineBreakChar(text[i])) i++;
  return i;
};

const validateFlowContentIndent: {
  (state: ComposerState, parentBlockColumn?: number): (cst: CstNode) => void;
  (cst: CstNode, state: ComposerState, parentBlockColumn?: number): void;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (cst: CstNode, state: ComposerState, parentBlockColumn?: number): void => {
    if (parentBlockColumn === undefined || parentBlockColumn < 0) return;
    const text = state.text;
    const end = Math.min(cst.offset + cst.length, text.length);
    let i = findLineBreak(text, cst.offset, end);
    while (i < end) {
      const lineStart = skipLineBreak(text, i);
      const contentStart = skipIndent(text, lineStart, end);
      if (contentStart >= end) return;
      if (isUnderIndentedFlowLine(text, contentStart, lineStart, parentBlockColumn, end)) {
        state.errors.push(
          RawDiagnostic.make({
            code: "InvalidIndentation",
            message: "Flow content continuation line must be indented past the parent block",
            offset: contentStart,
            length: 1,
          })
        );
        return;
      }
      i = findLineBreak(text, contentStart, end);
    }
  }
);

const isUnderIndentedFlowLine = (
  text: string,
  contentStart: number,
  lineStart: number,
  parentBlockColumn: number,
  end: number
): boolean =>
  !isLineBreakChar(text[contentStart]) &&
  contentStart - lineStart <= parentBlockColumn &&
  !isClosersOnly(text, contentStart, end);

const closerLineCharKind = (ch: string | undefined): "break" | "closer" | "filler" | "content" => {
  if (isLineBreakChar(ch)) return "break";
  if (ch === "}" || ch === "]") return "closer";
  return ch === "," || isIndentChar(ch) ? "filler" : "content";
};

const isClosersOnly: {
  (text: string, start: number, end: number): boolean;
  (start: number, end: number): (text: string) => boolean;
} = dual(3, (text: string, start: number, end: number): boolean => {
  let sawCloser = false;
  const limit = Math.min(end, text.length);
  for (let i = start; i < limit; i++) {
    const kind = closerLineCharKind(text[i]);
    if (kind === "break") break;
    if (kind === "content") return false;
    sawCloser = sawCloser || kind === "closer";
  }
  return sawCloser;
});

/**
 * Composes a flow mapping CST into YAML nodes with metadata and recovery diagnostics.
 *
 * **Details**
 *
 * Collection nesting is bounded; exceeding the limit records a diagnostic
 * and returns an empty flow collection. Supply the parent block column to
 * validate the indentation of continuation lines. Document-root callers
 * omit that column.
 *
 * **Example** (Compose a flow mapping)
 *
 * ```ts
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 * import { parseCSTAll } from "@beep/yaml/internal/cst-parser"
 * import { createState } from "@beep/yaml/internal/composer/state"
 *
 * const text = "{answer: 42}"
 * const cst = parseCSTAll(text)[0]?.children?.find(child => child.type === "flow-map")
 * if (cst === undefined) throw new Error("Expected a flow collection")
 * const state = createState(text, { composeFlowMap, composeFlowSeq })
 * const collection = composeFlowMap(cst, state)
 * console.log(collection.items.length) // 1
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const composeFlowMap: {
  (state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): (cst: CstNode) => YamlMap;
  (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlMap;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlMap => {
    if (!enterNesting(state, cst)) {
      return YamlMap.make({ items: [], style: "flow", offset: cst.offset, length: cst.length });
    }
    try {
      return composeFlowMapInner(cst, state, meta, parentBlockColumn);
    } finally {
      exitNesting(state);
    }
  }
);

const reportUnclosedFlow = (
  cst: CstNode,
  children: readonly CstNode[],
  state: ComposerState,
  brackets: readonly [open: string, close: string],
  message: string
): void => {
  const [openBracket, closeBracket] = brackets;
  const hasOpen = A.some(children, (c) => isPunctuation(c, openBracket));
  if (!hasOpen || A.some(children, (c) => isPunctuation(c, closeBracket))) return;
  state.errors.push(
    RawDiagnostic.make({ code: "MalformedFlowCollection", message, offset: cst.offset, length: cst.length })
  );
};

const mergeMetaComment = (meta: NodeMeta | undefined, trailing: string | undefined): string | undefined => {
  const metaComment = meta?.comment;
  if (metaComment === undefined) return trailing;
  return trailing === undefined ? metaComment : `${metaComment}\n${trailing}`;
};

const flowCollectionProps = (meta: NodeMeta | undefined, comment: string | undefined) =>
  O.getSomesStruct({
    tag: O.fromUndefinedOr(meta?.tag),
    anchor: O.fromUndefinedOr(meta?.anchor),
    comment: O.fromUndefinedOr(comment),
  });

const isFlowMapContent = (c: CstNode | undefined): c is CstNode =>
  P.isNotUndefined(c) && !isPunctuation(c, "{") && !isBlankWhitespace(c);

const composeFlowMapInner: {
  (state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): (cst: CstNode) => YamlMap;
  (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlMap;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlMap => {
    const children = cst.children ?? [];
    const pairs: YamlPair[] = [];

    reportUnclosedFlow(cst, children, state, ["{", "}"], "Unclosed flow mapping (missing `}`)");

    validateFlowContentIndent(cst, state, parentBlockColumn);

    validateFlowSeparators(children, state, "{", "}");

    const contentWithSegmentBoundaries = A.filter(children, isFlowMapContent);

    const items = flattenFlowChildren(contentWithSegmentBoundaries, state);
    const trailingComment = buildPairs(items, pairs, state.text);

    if (state.options.uniqueKeys) checkDuplicateKeys(pairs, state);

    const map = YamlMap.make({
      items: pairs,
      style: "flow",
      offset: cst.offset,
      length: cst.length,
      ...flowCollectionProps(meta, mergeMetaComment(meta, trailingComment)),
    });

    registerMetaAnchor(map, meta, state, cst.offset);
    return map;
  }
);

const FlattenScan = S.Struct({
  items: SemanticItem.pipe(
    S.Array,
    S.mutable,
    $I.annoteKey("FlattenScan.items", { description: "Semantic items emitted so far." })
  ),
  pendingMeta: NodeMeta.pipe(
    S.mutableKey,
    $I.annoteKey("FlattenScan.pendingMeta", { description: "Anchor and tag awaiting the following node." })
  ),
  explicitKeyOffset: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("FlattenScan.explicitKeyOffset", { description: "Offset of the latest explicit-key indicator." })
  ),
  index: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("FlattenScan.index", { description: "Cursor into the flow children being flattened." })
  ),
}).pipe(
  $I.annoteSchema("FlattenScan", {
    description: "Structural state of the flow-children flattening walk, constructed directly.",
  })
);
type FlattenScan = typeof FlattenScan.Type;

const pushFlowNode = (scan: FlattenScan, node: YamlNode): void => {
  scan.pendingMeta = NodeMeta.make({});
  scan.items.push(SemanticNode.make({ kind: "node", node }));
};

const pendingMetaOrUndefined = (scan: FlattenScan): NodeMeta | undefined =>
  hasMeta(scan.pendingMeta) ? scan.pendingMeta : undefined;

const flushPendingFlowMeta = (scan: FlattenScan, state: ComposerState, offset: number): void => {
  if (hasMeta(scan.pendingMeta)) pushFlowNode(scan, plainScalarWithMeta("", scan.pendingMeta, state, offset, 0));
};

const lastNonCommentIndex = (items: readonly SemanticItem[]): number => {
  let keyIndex = items.length - 1;
  while (keyIndex >= 0 && items[keyIndex]?.kind === "comment") keyIndex--;
  return keyIndex;
};

const materializeEmptyExplicitKey = (scan: FlattenScan, state: ComposerState): void => {
  const keyIndex = lastNonCommentIndex(scan.items);
  const last = scan.items[keyIndex];
  if (last?.kind !== "key" || last.node !== undefined) return;
  const scalar = plainScalarWithMeta("", scan.pendingMeta, state, scan.explicitKeyOffset, 0);
  scan.pendingMeta = NodeMeta.make({});
  scan.items[keyIndex] = SemanticKey.make({ kind: "key", node: scalar });
};

const pushExplicitKeyMarker = (scan: FlattenScan, offset: number): void => {
  scan.explicitKeyOffset = offset;
  scan.items.push(SemanticKey.make({ kind: "key" }));
};

const closeEmptyFlowValue = (scan: FlattenScan): void => {
  const index = lastNonCommentIndex(scan.items);
  const last = scan.items[index];
  if (last?.kind === "value-sep") scan.items[index] = SemanticValueSep.make({ ...last, closed: true });
};

const flattenComma = (scan: FlattenScan, child: CstNode, state: ComposerState): void => {
  materializeEmptyExplicitKey(scan, state);
  flushPendingFlowMeta(scan, state, child.offset);
  closeEmptyFlowValue(scan);
};

const flattenValueSep = (scan: FlattenScan, child: CstNode, state: ComposerState): void => {
  if (!hasMeta(scan.pendingMeta)) materializeEmptyExplicitKey(scan, state);
  flushPendingFlowMeta(scan, state, child.offset);
  scan.items.push(SemanticValueSep.make({ kind: "value-sep", offset: child.offset }));
};

const flattenPunctuation = (scan: FlattenScan, child: CstNode, state: ComposerState): void => {
  if (child.source === ",") {
    flattenComma(scan, child, state);
    return;
  }
  if (child.source === ":") {
    flattenValueSep(scan, child, state);
    return;
  }
  if (child.source === "?") pushExplicitKeyMarker(scan, child.offset);
};

const isFlowTrivia = (node: CstNode | undefined): boolean =>
  node?.type === "newline" || node?.type === "comment" || isBlankWhitespace(node);

const isTerminalExplicitKeyScalar = (children: readonly CstNode[], index: number, child: CstNode): boolean => {
  if (child.type !== "flow-scalar" || child.source !== "?") return false;
  let next = index + 1;
  while (isFlowTrivia(children[next])) next++;
  return isPunctuation(children[next], "}");
};

const reportUnspacedCommentIndicator = (child: CstNode, state: ComposerState): void => {
  if (!Str.startsWith("#")(child.source) || child.offset <= 0) return;
  const prev = state.text[child.offset - 1];
  if (prev === " " || prev === "\t" || prev === "\n" || prev === "\r") return;
  state.errors.push(
    RawDiagnostic.make({
      code: "UnexpectedToken",
      message: "Comment must be preceded by whitespace",
      offset: child.offset,
      length: child.length,
    })
  );
};

const reportBareBlockIndicator = (child: CstNode, state: ComposerState): void => {
  if (child.source !== "-" && child.source !== "?") return;
  state.errors.push(
    RawDiagnostic.make({
      code: "UnexpectedToken",
      message: `Invalid plain scalar '${child.source}' in flow context`,
      offset: child.offset,
      length: child.length,
    })
  );
};

const flattenPlainScalar = (
  scan: FlattenScan,
  children: readonly CstNode[],
  child: CstNode,
  state: ComposerState
): void => {
  reportUnspacedCommentIndicator(child, state);
  reportBareBlockIndicator(child, state);
  if (hasValueSepThroughPlainScalars(children, scan.index + 1)) {
    const { value, nextIdx } = collectMultilineKey(children, scan.index);
    pushFlowNode(scan, plainScalarWithMeta(value, scan.pendingMeta, state, child.offset, child.length));
    scan.index = nextIdx - 1;
    return;
  }
  const { value, nextIdx, partsCount, endOffset } = collectMultilinePlainScalar(
    children,
    scan.index,
    undefined,
    state.text
  );
  const wholeFoldedSpanLength = partsCount > 1 ? endOffset - child.offset : child.length;
  pushFlowNode(scan, plainScalarWithMeta(value, scan.pendingMeta, state, child.offset, wholeFoldedSpanLength));
  scan.index = nextIdx - 1;
};

const flattenScalar = (scan: FlattenScan, children: readonly CstNode[], child: CstNode, state: ComposerState): void => {
  if (isTerminalExplicitKeyScalar(children, scan.index, child)) {
    pushExplicitKeyMarker(scan, child.offset);
    return;
  }
  if (isPlainFlowScalar(child)) {
    flattenPlainScalar(scan, children, child, state);
    return;
  }
  pushFlowNode(scan, makeScalar(child, state, pendingMetaOrUndefined(scan)));
};

type FlattenHandler = (scan: FlattenScan, children: readonly CstNode[], child: CstNode, state: ComposerState) => void;

const FLATTEN_HANDLERS: Partial<Record<CstNodeType, FlattenHandler>> = {
  whitespace: (scan, _children, child, state) => flattenPunctuation(scan, child, state),
  comment: (scan, _children, child) => {
    scan.items.push(commentItem(child));
  },
  error: (_scan, _children, child, state) => reportUnexpectedContent(state, child),
  anchor: (scan, _children, child, state) => {
    validatePendingProperty(child, scan.pendingMeta, state);
    scan.pendingMeta.anchor = getAnchorName(child, state.text);
  },
  tag: (scan, _children, child, state) => {
    validatePendingProperty(child, scan.pendingMeta, state);
    recordPendingTag(scan.pendingMeta, child, state);
  },
  "flow-scalar": flattenScalar,
  "block-scalar": flattenScalar,
  alias: (scan, _children, child, state) => {
    checkAnchorOnAlias(scan.pendingMeta, child, state);
    pushFlowNode(scan, makeAlias(child, state));
  },
  "flow-map": (scan, _children, child, state) =>
    pushFlowNode(scan, composeFlowMap(child, state, pendingMetaOrUndefined(scan))),
  "flow-seq": (scan, _children, child, state) =>
    pushFlowNode(scan, composeFlowSeq(child, state, pendingMetaOrUndefined(scan))),
};

/**
 * Transforms flow CST children into semantic nodes, keys, value separators, and comments.
 *
 * **Details**
 *
 * Anchors and tags are carried to the following node. At a comma, pending
 * metadata becomes an empty scalar and a node-less explicit key becomes a
 * null key, keeping each entry's metadata within its own boundary.
 *
 * **Example** (Flatten a mapping entry into semantic items)
 *
 * ```ts
 * import { composeFlowMap, composeFlowSeq, flattenFlowChildren } from "@beep/yaml/internal/composer/flow"
 * import { parseCSTAll } from "@beep/yaml/internal/cst-parser"
 * import { createState } from "@beep/yaml/internal/composer/state"
 *
 * const text = "{answer: 42}"
 * const cst = parseCSTAll(text)[0]?.children?.find(child => child.type === "flow-map")
 * if (cst === undefined) throw new Error("Expected a flow mapping")
 * const state = createState(text, { composeFlowMap, composeFlowSeq })
 * const items = flattenFlowChildren(cst.children ?? [], state)
 * console.log(items.map(item => item.kind).join(",")) // node,value-sep,node
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const flattenFlowChildren: {
  (state: ComposerState): (children: readonly CstNode[]) => SemanticItem[];
  (children: readonly CstNode[], state: ComposerState): SemanticItem[];
} = dual(2, (children: readonly CstNode[], state: ComposerState): SemanticItem[] => {
  const scan: FlattenScan = { items: [], pendingMeta: NodeMeta.make({}), explicitKeyOffset: 0, index: 0 };
  for (scan.index = 0; scan.index < children.length; scan.index++) {
    const child = children[scan.index];
    if (child !== undefined) FLATTEN_HANDLERS[child.type]?.(scan, children, child, state);
  }
  materializeEmptyExplicitKey(scan, state);
  flushPendingFlowMeta(scan, state, 0);
  return scan.items;
});

/**
 * Composes a flow sequence CST into YAML nodes with metadata and recovery diagnostics.
 *
 * **Details**
 *
 * Collection nesting is bounded; exceeding the limit records a diagnostic
 * and returns an empty flow collection. Supply the parent block column to
 * validate the indentation of continuation lines. Document-root callers
 * omit that column.
 *
 * **Example** (Compose a flow sequence)
 *
 * ```ts
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 * import { parseCSTAll } from "@beep/yaml/internal/cst-parser"
 * import { createState } from "@beep/yaml/internal/composer/state"
 *
 * const text = "[1, 2]"
 * const cst = parseCSTAll(text)[0]?.children?.find(child => child.type === "flow-seq")
 * if (cst === undefined) throw new Error("Expected a flow collection")
 * const state = createState(text, { composeFlowMap, composeFlowSeq })
 * const collection = composeFlowSeq(cst, state)
 * console.log(collection.items.length) // 2
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const composeFlowSeq: {
  (state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): (cst: CstNode) => YamlSeq;
  (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlSeq;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlSeq => {
    if (!enterNesting(state, cst)) {
      return YamlSeq.make({ items: [], style: "flow", offset: cst.offset, length: cst.length });
    }
    try {
      return composeFlowSeqInner(cst, state, meta, parentBlockColumn);
    } finally {
      exitNesting(state);
    }
  }
);

const isFlowSeqContent = (c: CstNode): boolean =>
  c.type !== "whitespace" && c.type !== "newline" && c.type !== "comment";

const FlowSeqSegmenter = S.Struct({
  segments: CstNode.pipe(
    S.Array,
    S.mutable,
    S.Array,
    S.mutable,
    $I.annoteKey("FlowSeqSegmenter.segments", { description: "Completed comma-delimited segments." })
  ),
  current: CstNode.pipe(
    S.Array,
    S.mutable,
    S.mutableKey,
    $I.annoteKey("FlowSeqSegmenter.current", { description: "Segment under construction." })
  ),
  seenContent: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("FlowSeqSegmenter.seenContent", { description: "Whether any entry content has been seen." })
  ),
  lastWasComma: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("FlowSeqSegmenter.lastWasComma", { description: "Whether the latest significant token was a comma." })
  ),
}).pipe(
  $I.annoteSchema("FlowSeqSegmenter", {
    description: "Structural state of the flow-sequence comma split, constructed directly.",
  })
);
type FlowSeqSegmenter = typeof FlowSeqSegmenter.Type;

const splitFlowSeqAtComma = (seg: FlowSeqSegmenter, comma: CstNode, state: ComposerState): void => {
  const hasContentInSegment = A.some(seg.current, isFlowSeqContent);
  if (!hasContentInSegment && (seg.lastWasComma || !seg.seenContent)) {
    state.errors.push(
      RawDiagnostic.make({
        code: "MalformedFlowCollection",
        message: "Empty entry in flow sequence",
        offset: comma.offset,
        length: 1,
      })
    );
  }
  if (seg.current.length > 0) seg.segments.push(seg.current);
  seg.current = [];
  seg.lastWasComma = true;
};

const acceptFlowSeqChild = (seg: FlowSeqSegmenter, child: CstNode, state: ComposerState): void => {
  if (isPunctuation(child, "[") || isPunctuation(child, "]")) return;
  if (isPunctuation(child, ",")) {
    splitFlowSeqAtComma(seg, child, state);
    return;
  }
  if (isFlowSeqContent(child)) {
    seg.seenContent = true;
    seg.lastWasComma = false;
  }
  seg.current.push(child);
};

const splitFlowSeqSegments = (children: readonly CstNode[], state: ComposerState): CstNode[][] => {
  const seg: FlowSeqSegmenter = { segments: [], current: [], seenContent: false, lastWasComma: false };
  for (const child of children) acceptFlowSeqChild(seg, child, state);
  if (seg.current.length > 0) seg.segments.push(seg.current);
  return seg.segments;
};

// decision: comments-on-nodes
const FlowSeqAttribution = S.Struct({
  text: S.String.pipe($I.annoteKey("FlowSeqAttribution.text", { description: "Source text of the document." })),
  items: YamlNode.pipe(
    S.Array,
    S.mutable,
    $I.annoteKey("FlowSeqAttribution.items", { description: "Sequence items composed so far." })
  ),
  pending: PendingComment.pipe(
    S.Array,
    S.mutable,
    S.mutableKey,
    $I.annoteKey("FlowSeqAttribution.pending", { description: "Own-line comments awaiting the next item." })
  ),
  pendingSpace: S.mutableKey(S.Boolean).pipe(
    $I.annoteKey("FlowSeqAttribution.pendingSpace", { description: "Whether the next item gets `spaceBefore`." })
  ),
  lastItemEnd: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("FlowSeqAttribution.lastItemEnd", { description: "End offset of the last pushed item, or -1." })
  ),
  pushedIdx: S.mutableKey(S.Finite).pipe(
    $I.annoteKey("FlowSeqAttribution.pushedIdx", { description: "Index of the last pushed item, or -1." })
  ),
}).pipe(
  $I.annoteSchema("FlowSeqAttribution", {
    description: "Comment-attribution state of the flow-sequence walk, constructed directly.",
  })
);
type FlowSeqAttribution = typeof FlowSeqAttribution.Type;

const isBlankBetweenItems = (attr: FlowSeqAttribution, anchorOffset: number): boolean =>
  attr.lastItemEnd >= 0 && blankLineAboveStart(attr.text, anchorOffset) >= attr.lastItemEnd;

const acceptOwnLineComment = (attr: FlowSeqAttribution, cText: string, cOff: number): void => {
  const blankAbove = cOff >= 0 && hasBlankLineAbove(attr.text, cOff);
  const firstOfRun = attr.pending.length === 0;
  if (blankAbove && firstOfRun && isBlankBetweenItems(attr, cOff)) attr.pendingSpace = true;
  attr.pending.push(PendingComment.make({ text: cText, offset: cOff, blankAbove: blankAbove && !firstOfRun }));
};

const takePendingFields = (attr: FlowSeqAttribution, anchorOffset: number): CommentFields => {
  let commentBefore = O.getOrUndefined(joinPendingComments(attr.pending));
  if (anchorOffset >= 0 && hasBlankLineAbove(attr.text, anchorOffset)) {
    if (commentBefore !== undefined) {
      commentBefore = `${commentBefore}\n`;
    } else if (!attr.pendingSpace && isBlankBetweenItems(attr, anchorOffset)) {
      attr.pendingSpace = true;
    }
  }
  const fields = leadingCommentFields(commentBefore, attr.pendingSpace);
  attr.pending = [];
  attr.pendingSpace = false;
  return fields;
};

const hasPendingFields = (fields: CommentFields): boolean =>
  fields.commentBefore !== undefined || fields.spaceBefore === true;

const pushFlowSeqItem = (attr: FlowSeqAttribution, node: YamlNode, end: number): void => {
  attr.items.push(node);
  attr.pushedIdx = attr.items.length - 1;
  attr.lastItemEnd = end;
};

const segmentContentKeepingNewlines = (segment: readonly CstNode[]): CstNode[] =>
  A.filter(segment, (c) => !isBlankWhitespace(c));

const composeImplicitPairSegment = (
  attr: FlowSeqAttribution,
  segment: readonly CstNode[],
  state: ComposerState
): void => {
  const content = segmentContentKeepingNewlines(segment);
  const semItems = flattenFlowChildren(content, state);
  const pairs: YamlPair[] = [];
  const segTrailing = buildPairs(semItems, pairs, state.text);
  const hasExplicitKeyIndicator = A.some(segment, (c) => isPunctuation(c, "?"));
  if (!hasExplicitKeyIndicator) checkMultilineImplicitKeys(pairs, state, semItems);
  const firstPair = pairs[0];
  const segFirst = content[0];
  if (firstPair === undefined || segFirst === undefined) return;
  const fields = takePendingFields(attr, segFirst.offset);
  const map = YamlMap.make({
    items: pairs,
    style: "flow",
    offset: firstPair.key.offset,
    length: 0,
    ...fields,
    ...O.getSomesStruct({ comment: O.fromUndefinedOr(segTrailing) }),
  });
  pushFlowSeqItem(attr, map, map.offset + map.length);
};

const attributeFlowSeqComment = (attr: FlowSeqAttribution, cText: string, offset: number): void => {
  if (isOwnLineAt(attr.text, offset) || attr.pushedIdx < 0) {
    acceptOwnLineComment(attr, cText, offset);
    return;
  }
  const prev = attr.items[attr.pushedIdx];
  if (prev !== undefined) attr.items[attr.pushedIdx] = withCommentFields(prev, CommentFields.make({ comment: cText }));
};

const acceptFlowSeqSemanticItem = (attr: FlowSeqAttribution, si: SemanticItem): void => {
  if (si.kind === "comment") {
    attributeFlowSeqComment(attr, si.comment, si.offset);
    return;
  }
  if (si.kind !== "node") return;
  const fields = takePendingFields(attr, si.node.length > 0 ? si.node.offset : -1);
  const node = hasPendingFields(fields) ? withCommentFields(si.node, fields) : si.node;
  pushFlowSeqItem(attr, node, si.node.offset + si.node.length);
};

const composePlainItemsSegment = (
  attr: FlowSeqAttribution,
  segment: readonly CstNode[],
  state: ComposerState
): void => {
  const semItems = flattenFlowChildren(segmentContentKeepingNewlines(segment), state);
  for (const si of semItems) acceptFlowSeqSemanticItem(attr, si);
};

const flowSeqTrailingComment = (attr: FlowSeqAttribution): string | undefined => {
  const [first, ...rest] = attr.pending;
  if (first === undefined) return undefined;
  const joined =
    first.text +
    pipe(
      rest,
      A.map((part) => (part.blankAbove ? `\n\n${part.text}` : `\n${part.text}`)),
      A.join("")
    );
  const leadBlank = attr.lastItemEnd >= 0 && first.offset >= 0 && hasBlankLineAbove(attr.text, first.offset);
  return leadBlank ? `\n${joined}` : joined;
};

const composeFlowSeqInner: {
  (state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): (cst: CstNode) => YamlSeq;
  (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlSeq;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (cst: CstNode, state: ComposerState, meta?: NodeMeta, parentBlockColumn?: number): YamlSeq => {
    const children = cst.children ?? [];

    validateFlowContentIndent(cst, state, parentBlockColumn);

    validateFlowSeparators(children, state, "[", "]");

    reportUnclosedFlow(cst, children, state, ["[", "]"], "Unclosed flow sequence (missing `]`)");

    const attr: FlowSeqAttribution = {
      text: state.text,
      items: [],
      pending: [],
      pendingSpace: false,
      lastItemEnd: -1,
      pushedIdx: -1,
    };
    for (const segment of splitFlowSeqSegments(children, state)) {
      if (A.some(segment, (c) => isPunctuation(c, ":"))) composeImplicitPairSegment(attr, segment, state);
      else composePlainItemsSegment(attr, segment, state);
    }

    const seq = YamlSeq.make({
      items: attr.items,
      style: "flow",
      offset: cst.offset,
      length: cst.length,
      ...flowCollectionProps(meta, mergeMetaComment(meta, flowSeqTrailingComment(attr))),
    });

    registerMetaAnchor(seq, meta, state, cst.offset);
    return seq;
  }
);
