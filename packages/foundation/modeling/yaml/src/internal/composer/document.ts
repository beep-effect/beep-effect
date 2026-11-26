import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { constant, dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YamlAlias, YamlMap, YamlPair, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import { parseCSTAll } from "../cst-parser.ts";
import { RawDiagnostic } from "../diagnostics.ts";
import { RawYamlDocument } from "../raw-document.ts";
import { checkAnchorOnAlias, getAnchorName, makeAlias } from "./anchors.ts";
import { composeBlockMap, composeBlockSeq, composeFlatBlockMap, validatePendingProperty } from "./block.ts";
import { CommentFields, hasBlankLineAbove, hasBlankLineBelow, rawCommentText, withCommentFields } from "./comments.ts";
import { composeFlowMap, composeFlowSeq } from "./flow.ts";
import {
  collectMultilinePlainScalar,
  findNextContentChild,
  getScalarStyle,
  hasBlockMapAfterInList,
  hasValueSepAfter,
  indexOfChild,
  makeScalar,
  plainScalarWithMeta,
} from "./scalars.ts";
import {
  clearMeta,
  collectionProps,
  createState,
  hasMeta,
  NodeMeta,
  recordPendingTag,
  reportUnexpectedContent,
  sameLine,
} from "./state.ts";
import { parseDirective, validateTagHandlesInDocument } from "./tags.ts";
import type { YamlNode } from "../../YamlNode.ts";
import type { CstNode, CstNodeType } from "../cst.ts";
import type { ParseOptionsInput } from "../options.ts";
import type { RawDirective } from "../raw-document.ts";
import type { EscapedComment } from "./comments.ts";
import type { ComposerState, FlowComposers } from "./state.ts";

const FLOW: FlowComposers = { composeFlowMap, composeFlowSeq };

const isYamlAlias = S.is(YamlAlias);
const isYamlMap = S.is(YamlMap);
const isYamlScalar = S.is(YamlScalar);
const isYamlSeq = S.is(YamlSeq);

const isDocStartMarker = (c: CstNode): boolean => c.type === "whitespace" && c.source === "---";

const isDocEndMarker = (c: CstNode): boolean => c.type === "whitespace" && c.source === "...";

const isBlankWhitespace = (c: CstNode): boolean => c.type === "whitespace" && Str.trim(c.source) === "";

const isDirectiveChild = (c: CstNode): boolean => c.type === "directive";

const pushUnexpectedToken = (state: ComposerState, node: CstNode, message: string): void => {
  state.errors.push(
    RawDiagnostic.make({
      code: "UnexpectedToken",
      message,
      offset: node.offset,
      length: node.length,
    })
  );
};

const isSameLineSeqDash = (state: ComposerState, meta: CstNode, c: CstNode): boolean =>
  c.type === "whitespace" && c.source === "-" && sameLine(state.text, meta.offset, c.offset);

const isSkippedAfterProperty = (c: CstNode): boolean =>
  c.type === "whitespace" || (c.type === "block-seq" && c.length === 0);

const validateAnchorTagNotFollowedBySeqDashOnSameLine: {
  (meta: CstNode, children: readonly CstNode[], idx: number, state: ComposerState): void;
  (children: readonly CstNode[], idx: number, state: ComposerState): (meta: CstNode) => void;
} = dual(4, (meta: CstNode, children: readonly CstNode[], idx: number, state: ComposerState): void => {
  for (let j = idx + 1; j < children.length; j++) {
    const c = A.getUnsafe(children, j);
    if (isSameLineSeqDash(state, meta, c)) {
      pushUnexpectedToken(
        state,
        c,
        "Block sequence entry indicator '-' cannot follow an anchor or tag on the same line"
      );
      return;
    }
    if (!isSkippedAfterProperty(c)) return;
  }
});

const reportSameLineAsDocEnd = (state: ComposerState, marker: CstNode, next: CstNode): void => {
  if (sameLine(state.text, marker.offset, next.offset)) {
    pushUnexpectedToken(state, next, "Content on same line as document-end marker");
  }
};

const checkContentAfterDocEnd = (
  state: ComposerState,
  marker: CstNode,
  ...[children, start]: [children: readonly CstNode[], start: number]
): boolean => {
  for (let j = start; j < children.length; j++) {
    const next = A.getUnsafe(children, j);
    if (next.type === "newline" || next.type === "comment") return false;
    if (isBlankWhitespace(next)) continue;
    reportSameLineAsDocEnd(state, marker, next);
    return true;
  }
  return false;
};

const checkNextDocumentAfterDocEnd = (
  state: ComposerState,
  marker: CstNode,
  nextDocChildren: readonly CstNode[]
): void => {
  for (const next of nextDocChildren) {
    if (next.type === "newline") return;
    if (isBlankWhitespace(next)) continue;
    reportSameLineAsDocEnd(state, marker, next);
    return;
  }
};

const checkDocumentEndMarkerSameLine: {
  (state: ComposerState, nextDocChildren?: readonly CstNode[]): (children: readonly CstNode[]) => void;
  (children: readonly CstNode[], state: ComposerState, nextDocChildren?: readonly CstNode[]): void;
} = dual(
  (args) => A.isArray(args[0]),
  (children: readonly CstNode[], state: ComposerState, nextDocChildren?: readonly CstNode[]): void => {
    for (let i = 0; i < children.length; i++) {
      const child = A.getUnsafe(children, i);
      if (!isDocEndMarker(child)) continue;
      const found = checkContentAfterDocEnd(state, child, children, i + 1);
      if (!found && nextDocChildren !== undefined) checkNextDocumentAfterDocEnd(state, child, nextDocChildren);
    }
  }
);

const TRAILING_CONTENT_TYPES: ReadonlyArray<CstNodeType> = [
  "flow-scalar",
  "block-scalar",
  "block-map",
  "block-seq",
  "flow-map",
  "flow-seq",
  "anchor",
  "tag",
  "alias",
];

const MAPPING_KEY_TYPES: ReadonlyArray<CstNodeType> = ["flow-scalar", "block-scalar", "flow-map", "flow-seq"];

const isDocValueBoundary = (c: CstNode): boolean =>
  c.type === "whitespace" && (c.source === "---" || c.source === "..." || c.source === ":");

const isTrailingTrivia = (c: CstNode): boolean => c.type === "newline" || c.type === "comment" || isBlankWhitespace(c);

const findTrailingCandidate = (children: readonly CstNode[], startIdx: number): number => {
  for (let j = startIdx; j < children.length; j++) {
    const next = A.getUnsafe(children, j);
    if (isTrailingTrivia(next)) continue;
    return isDocValueBoundary(next) ? -1 : j;
  }
  return -1;
};

const isSiblingMappingKey = (children: readonly CstNode[], j: number, next: CstNode): boolean => {
  if (!A.contains(MAPPING_KEY_TYPES, next.type)) return false;
  return hasValueSepAfter(children, j + 1) || findNextContentChild(children, j + 1)?.type === "block-map";
};

const checkTrailingContentAfterDocValue: {
  (startIdx: number, state: ComposerState, allowMappingKey?: boolean): (children: readonly CstNode[]) => void;
  (children: readonly CstNode[], startIdx: number, state: ComposerState, allowMappingKey?: boolean): void;
} = dual(
  (args) => A.isArray(args[0]),
  (children: readonly CstNode[], startIdx: number, state: ComposerState, allowMappingKey?: boolean): void => {
    const j = findTrailingCandidate(children, startIdx);
    if (j < 0) return;
    const next = A.getUnsafe(children, j);
    if (allowMappingKey !== false && isSiblingMappingKey(children, j, next)) return;
    if (A.contains(TRAILING_CONTENT_TYPES, next.type)) {
      pushUnexpectedToken(state, next, "Trailing content after document value");
    }
  }
);

const appendCommentLine = (
  block: string | undefined,
  ...[text, source, offset]: [text: string, source: string, offset: number]
): string => {
  if (block === undefined) return text;
  return hasBlankLineAbove(source, offset) ? `${block}\n\n${text}` : `${block}\n${text}`;
};

const unescapedNonPrintableC0 = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;

const reportFirstControlCharacter = (cst: CstNode, state: ComposerState): void => {
  const spanEnd = Math.min(cst.offset + cst.length, state.text.length);
  for (let ci = cst.offset; ci < spanEnd; ci++) {
    const ch = Str.slice(ci, ci + 1)(state.text);
    if (unescapedNonPrintableC0.test(ch)) {
      const cc = O.getOrElse(constant(0))(Str.charCodeAt(0)(ch));
      state.errors.push(
        RawDiagnostic.make({
          code: "UnexpectedCharacter",
          message: `Unescaped control character U+${Str.padStart(4, "0")(Str.toUpperCase(cc.toString(16)))}`,
          offset: ci,
          length: 1,
        })
      );
      return;
    }
  }
};

const makeDocumentWalk = (
  cst: CstNode,
  state: ComposerState
): {
  readonly cst: CstNode;
  readonly state: ComposerState;
  readonly children: ReadonlyArray<CstNode>;
  readonly hasDocStartAnywhere: boolean;
  readonly directives: RawDirective[];
  readonly meta: NodeMeta;
  readonly outerMeta: NodeMeta;
  i: number;
  done: boolean;
  contents: YamlNode | null;
  sawNewlineSinceMeta: boolean;
  sawDocStartMarker: boolean;
  sawDocEndMarker: boolean;
  documentComment: string | undefined;
  afterMarkerComment: string | undefined;
  documentCommentAfter: string | undefined;
  firstCommentAfterOffset: number;
  lastLeadingCommentOffset: number;
  lastAfterMarkerCommentOffset: number;
} => {
  const children = cst.children ?? [];
  return {
    cst,
    state,
    children,
    hasDocStartAnywhere: A.some(children, isDocStartMarker),
    directives: [],
    meta: NodeMeta.make({}),
    outerMeta: NodeMeta.make({}),
    i: 0,
    done: false,
    contents: null,
    sawNewlineSinceMeta: false,
    sawDocStartMarker: false,
    sawDocEndMarker: false,
    documentComment: undefined,
    afterMarkerComment: undefined,
    documentCommentAfter: undefined,
    firstCommentAfterOffset: -1,
    lastLeadingCommentOffset: -1,
    lastAfterMarkerCommentOffset: -1,
  };
};
type DocumentWalk = ReturnType<typeof makeDocumentWalk>;

const validateMetaMerge = (walk: DocumentWalk, child: CstNode): void => {
  const { meta, outerMeta, state } = walk;
  if (meta.anchor !== undefined) validatePendingProperty({ ...child, type: "anchor" }, outerMeta, state);
  if (meta.tag !== undefined) validatePendingProperty({ ...child, type: "tag", ...meta.tagSpan }, outerMeta, state);
};

const copyPendingProperties = (meta: NodeMeta, target: NodeMeta): void => {
  if (meta.tag !== undefined) target.tag = meta.tag;
  if (meta.tagSpan !== undefined) target.tagSpan = meta.tagSpan;
  if (meta.anchor !== undefined) target.anchor = meta.anchor;
};

// decision: properties-split-at-newline
const commitMetaAcrossNewline = (walk: DocumentWalk, child: CstNode): void => {
  if (walk.sawNewlineSinceMeta && hasMeta(walk.meta)) {
    validateMetaMerge(walk, child);
    copyPendingProperties(walk.meta, walk.outerMeta);
    clearMeta(walk.meta);
  }
  walk.sawNewlineSinceMeta = false;
};

const consumeMeta = (walk: DocumentWalk): void => {
  clearMeta(walk.meta);
  clearMeta(walk.outerMeta);
  walk.sawNewlineSinceMeta = false;
};

const combinedMeta = (walk: DocumentWalk): NodeMeta => {
  const combined: NodeMeta = { ...walk.outerMeta };
  copyPendingProperties(walk.meta, combined);
  return combined;
};

const metaIfPresent = (meta: NodeMeta): NodeMeta | undefined => (hasMeta(meta) ? meta : undefined);

// decision: properties-split-at-newline
const splitKeyMeta = (
  walk: DocumentWalk
): { readonly mapMeta: NodeMeta | undefined; readonly keyMeta: NodeMeta | undefined } => {
  const { meta, outerMeta } = walk;
  if (hasMeta(outerMeta)) return { mapMeta: { ...outerMeta }, keyMeta: { ...meta } };
  if (walk.hasDocStartAnywhere && hasMeta(meta)) return { mapMeta: { ...meta }, keyMeta: undefined };
  return { mapMeta: undefined, keyMeta: hasMeta(meta) ? { ...meta } : undefined };
};

const splitFlowMeta = (
  walk: DocumentWalk,
  child: CstNode,
  flowIsKey: boolean
): { readonly flowMeta: NodeMeta | undefined; readonly mapMeta: NodeMeta | undefined } => {
  if (flowIsKey && hasMeta(walk.outerMeta)) return { flowMeta: { ...walk.meta }, mapMeta: { ...walk.outerMeta } };
  validateMetaMerge(walk, child);
  return { flowMeta: metaIfPresent(combinedMeta(walk)), mapMeta: undefined };
};

const composeDirectiveChild = (walk: DocumentWalk, child: CstNode): void => {
  const parsed = parseDirective(child.source);
  if (O.isSome(parsed)) {
    const directive = parsed.value;
    walk.directives.push(directive);
    if (directive.name === "TAG" && directive.parameters.length === 2) {
      MutableHashMap.set(walk.state.tagMap, A.getUnsafe(directive.parameters, 0), A.getUnsafe(directive.parameters, 1));
    }
  }
  walk.i++;
};

const composeNewlineChild = (walk: DocumentWalk): void => {
  if (hasMeta(walk.meta)) walk.sawNewlineSinceMeta = true;
  walk.i++;
};

const composeWhitespaceChild = (walk: DocumentWalk, child: CstNode): void => {
  const src = child.source;
  if (src === "...") walk.sawDocEndMarker = true;
  if (src === "---") walk.sawDocStartMarker = true;
  if (src === "]" || src === "}") {
    walk.state.errors.push(
      RawDiagnostic.make({
        code: "MalformedFlowCollection",
        message: `Unexpected flow indicator '${src}' at document level`,
        offset: child.offset,
        length: child.length,
      })
    );
  }
  walk.i++;
};

// decision: document-comment-scopes
const composeCommentChild = (walk: DocumentWalk, child: CstNode): void => {
  const text = rawCommentText(child.source);
  const source = walk.state.text;
  if (walk.contents !== null || walk.sawDocEndMarker) {
    if (walk.documentCommentAfter === undefined) walk.firstCommentAfterOffset = child.offset;
    walk.documentCommentAfter = appendCommentLine(walk.documentCommentAfter, text, source, child.offset);
  } else if (walk.sawDocStartMarker) {
    walk.afterMarkerComment = appendCommentLine(walk.afterMarkerComment, text, source, child.offset);
    walk.lastAfterMarkerCommentOffset = child.offset;
  } else {
    walk.documentComment = appendCommentLine(walk.documentComment, text, source, child.offset);
    walk.lastLeadingCommentOffset = child.offset;
  }
  walk.i++;
};

const composeErrorChild = (walk: DocumentWalk, child: CstNode): void => {
  reportUnexpectedContent(walk.state, child);
  walk.i++;
};

const composePropertyChild = (walk: DocumentWalk, child: CstNode): void => {
  validateAnchorTagNotFollowedBySeqDashOnSameLine(child, walk.children, walk.i, walk.state);
  commitMetaAcrossNewline(walk, child);
  validatePendingProperty(child, walk.meta, walk.state);
  if (child.type === "anchor") walk.meta.anchor = getAnchorName(child, walk.state.text);
  else recordPendingTag(walk.meta, child, walk.state);
  walk.i++;
};

const reportMappingOnDocStartLine = (walk: DocumentWalk, child: CstNode): void => {
  if (!walk.hasDocStartAnywhere) return;
  const docStartChild = A.findFirst(walk.children, isDocStartMarker);
  if (O.isSome(docStartChild) && sameLine(walk.state.text, docStartChild.value.offset, child.offset)) {
    pushUnexpectedToken(walk.state, child, "Mapping cannot start on document-start (---) line");
  }
};

const composeScalarKeyedBlockMap = (walk: DocumentWalk, child: CstNode, blockMap: CstNode): void => {
  reportMappingOnDocStartLine(walk, child);
  const { mapMeta, keyMeta } = splitKeyMeta(walk);
  const key = makeScalar(child, walk.state, keyMeta);
  consumeMeta(walk);
  walk.contents = composeBlockMap(blockMap, walk.state, key, mapMeta);
  walk.i = indexOfChild(walk.children, blockMap) + 1;
};

const composeScalarKeyedFlatMap = (walk: DocumentWalk, child: CstNode): void => {
  const { mapMeta, keyMeta } = splitKeyMeta(walk);
  const key = makeScalar(child, walk.state, keyMeta);
  consumeMeta(walk);
  walk.contents = composeFlatBlockMap(walk.children, walk.i + 1, walk.cst, walk.state, key, mapMeta);
  walk.done = true;
};

const isTrailingMapping = (children: readonly CstNode[], next: CstNode): boolean => {
  if (next.type === "block-map") return true;
  if (next.type !== "flow-scalar") return false;
  const after = indexOfChild(children, next) + 1;
  return hasValueSepAfter(children, after) || hasBlockMapAfterInList(children, after);
};

const composeRootPlainScalar = (walk: DocumentWalk, child: CstNode): void => {
  const { children, state } = walk;
  const { value, nextIdx, partsCount, endOffset } = collectMultilinePlainScalar(
    children,
    walk.i,
    undefined,
    state.text
  );
  const scalarLength = partsCount > 1 ? endOffset - child.offset : child.length;
  walk.contents = plainScalarWithMeta(value, combinedMeta(walk), state, child.offset, scalarLength);
  consumeMeta(walk);
  if (partsCount > 1) {
    const next = findNextContentChild(children, nextIdx);
    if (next !== null && isTrailingMapping(children, next)) {
      pushUnexpectedToken(state, next, "Trailing content after document value");
    }
  } else {
    checkTrailingContentAfterDocValue(children, nextIdx, state, false);
  }
  walk.i = nextIdx;
};

const composeScalarChild = (walk: DocumentWalk, child: CstNode): void => {
  const nextContent = findNextContentChild(walk.children, walk.i + 1);
  if (nextContent !== null && nextContent.type === "block-map") {
    composeScalarKeyedBlockMap(walk, child, nextContent);
    return;
  }
  if (hasValueSepAfter(walk.children, walk.i + 1)) {
    composeScalarKeyedFlatMap(walk, child);
    return;
  }
  validateMetaMerge(walk, child);
  if (child.type === "flow-scalar" && getScalarStyle(child) === "plain") {
    composeRootPlainScalar(walk, child);
    return;
  }
  walk.contents = makeScalar(child, walk.state, metaIfPresent(combinedMeta(walk)));
  consumeMeta(walk);
  walk.i++;
};

const composeBlockMapChild = (walk: DocumentWalk, child: CstNode): void => {
  validateMetaMerge(walk, child);
  walk.contents = composeBlockMap(child, walk.state, undefined, metaIfPresent(combinedMeta(walk)));
  consumeMeta(walk);
  walk.i++;
};

const composeBlockSeqChild = (walk: DocumentWalk, child: CstNode): void => {
  validateMetaMerge(walk, child);
  const isRootSeq = walk.contents === null;
  walk.contents = composeBlockSeq(child, walk.state, metaIfPresent(combinedMeta(walk)));
  consumeMeta(walk);
  walk.i++;
  if (isRootSeq) checkTrailingContentAfterDocValue(walk.children, walk.i, walk.state, false);
};

const composeFlowCollectionChild =
  (compose: (cst: CstNode, state: ComposerState, meta: NodeMeta | undefined) => YamlNode) =>
  (walk: DocumentWalk, child: CstNode): void => {
    const next = findNextContentChild(walk.children, walk.i + 1);
    const keyedMap = next !== null && next.type === "block-map" ? next : null;
    const { flowMeta, mapMeta } = splitFlowMeta(walk, child, keyedMap !== null);
    const flow = compose(child, walk.state, flowMeta);
    consumeMeta(walk);
    walk.i++;
    if (keyedMap === null) {
      walk.contents = flow;
      checkTrailingContentAfterDocValue(walk.children, walk.i, walk.state);
      return;
    }
    walk.contents = composeBlockMap(keyedMap, walk.state, flow, mapMeta);
    walk.i = indexOfChild(walk.children, keyedMap) + 1;
  };

const DOCUMENT_CHILD_COMPOSERS: {
  readonly [type: string]: ((walk: DocumentWalk, child: CstNode) => void) | undefined;
} = {
  directive: composeDirectiveChild,
  newline: composeNewlineChild,
  whitespace: composeWhitespaceChild,
  comment: composeCommentChild,
  error: composeErrorChild,
  anchor: composePropertyChild,
  tag: composePropertyChild,
  "flow-scalar": composeScalarChild,
  "block-scalar": composeScalarChild,
  "block-map": composeBlockMapChild,
  "block-seq": composeBlockSeqChild,
  "flow-map": composeFlowCollectionChild((cst, state, meta) => composeFlowMap(cst, state, meta)),
  "flow-seq": composeFlowCollectionChild((cst, state, meta) => composeFlowSeq(cst, state, meta)),
};

const composeAliasChild = (walk: DocumentWalk, child: CstNode): void => {
  checkAnchorOnAlias(walk.meta, child, walk.state);
  walk.contents = makeAlias(child, walk.state);
  walk.i++;
};

const hasDocStartTab = (children: readonly CstNode[], text: string): boolean =>
  O.exists(A.findFirst(children, isDocStartMarker), (c) => text[c.offset + c.length] === "\t");

const withBlankLineBelow = (walk: DocumentWalk, comment: string | undefined, lastOffset: number): string | undefined =>
  comment !== undefined && walk.contents !== null && hasBlankLineBelow(walk.state.text, lastOffset)
    ? `${comment}\n`
    : comment;

const isBlockCollection = (node: YamlNode): node is YamlMap | YamlSeq =>
  (isYamlMap(node) || isYamlSeq(node)) && node.style !== "flow";

// decision: document-comment-scopes
const escapeRootTerminalComment = (walk: DocumentWalk): void => {
  const contents = walk.contents;
  if (walk.documentCommentAfter !== undefined || contents === null || contents.comment === undefined) return;
  if (!isBlockCollection(contents)) return;
  walk.documentCommentAfter = contents.comment;
  walk.contents = stripOwnComment(contents);
};

const byEscapedOffset = Order.mapInput(Order.Number, (ec: EscapedComment) => ec.offset);

const takeEscapedComments = (walk: DocumentWalk): void => {
  const { state } = walk;
  const escaped = A.sort(state.escapedComments, byEscapedOffset);
  state.escapedComments.length = 0;
  if (!A.isReadonlyArrayNonEmpty(escaped)) return;
  const block = A.reduce(A.tailNonEmpty(escaped), A.headNonEmpty(escaped).text, (acc, ec) =>
    appendCommentLine(acc, ec.text, state.text, ec.offset)
  );
  const after = walk.documentCommentAfter;
  walk.documentCommentAfter =
    after === undefined ? block : appendCommentLine(block, after, state.text, walk.firstCommentAfterOffset);
};

const placeLeadingHeader = (
  walk: DocumentWalk
): { readonly header: string | undefined; readonly contents: YamlNode | null } => {
  const { documentComment, contents } = walk;
  if (documentComment === undefined) return { header: undefined, contents };
  if (walk.hasDocStartAnywhere || contents === null) return { header: documentComment, contents };
  return { header: undefined, contents: attachHeaderToFirstEntry(contents, documentComment) };
};

const placeAfterMarkerComment = (
  walk: DocumentWalk,
  placed: { readonly header: string | undefined; readonly contents: YamlNode | null }
): { readonly header: string | undefined; readonly contents: YamlNode | null } => {
  const after = walk.afterMarkerComment;
  if (after === undefined) return placed;
  if (placed.contents !== null) {
    return {
      header: placed.header,
      contents: withCommentFields(placed.contents, CommentFields.make({ commentBefore: after })),
    };
  }
  return { header: placed.header === undefined ? after : `${placed.header}\n${after}`, contents: null };
};

const finishDocument = (walk: DocumentWalk): RawYamlDocument => {
  const { children, state } = walk;
  const hasDocEnd = A.some(children, isDocEndMarker);
  const docStartTab = hasDocStartTab(children, state.text);
  walk.documentComment = withBlankLineBelow(walk, walk.documentComment, walk.lastLeadingCommentOffset);
  walk.afterMarkerComment = withBlankLineBelow(walk, walk.afterMarkerComment, walk.lastAfterMarkerCommentOffset);
  takeEscapedComments(walk);
  escapeRootTerminalComment(walk);
  const { header, contents } = placeAfterMarkerComment(walk, placeLeadingHeader(walk));
  validateTagHandlesInDocument(walk.cst, state, "properties");
  return RawYamlDocument.make({
    contents,
    errors: [...state.errors],
    warnings: [...state.warnings],
    directives: walk.directives,
    hasDocumentStart: walk.hasDocStartAnywhere,
    hasDocumentEnd: hasDocEnd,
    hasDocumentStartTab: docStartTab,
    ...O.getSomesStruct({
      commentBefore: O.fromUndefinedOr(header),
      comment: O.fromUndefinedOr(walk.documentCommentAfter),
    }),
  });
};

/**
 * Composes a document CST into YAML nodes, directives, comments, and recovery diagnostics.
 *
 * **Details**
 *
 * The supplied state collects anchors, tag handles, errors, and warnings during
 * the walk. Pass the following document CST when document-end validation must
 * check content across the document boundary.
 *
 * **Example** (Compose a parsed scalar document)
 *
 * ```ts
 * import { composeDocument } from "@beep/yaml/internal/composer/document"
 * import { YamlScalar } from "@beep/yaml/YamlNode"
 * import * as S from "effect/Schema"
 * import { parseCSTAll } from "@beep/yaml/internal/cst-parser"
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 *
 * const text = "hello"
 * const cst = parseCSTAll(text)[0]
 * if (cst === undefined) throw new Error("Expected a document")
 * const state = createState(text, { composeFlowMap, composeFlowSeq })
 * const document = composeDocument(cst, state)
 * console.log(S.is(YamlScalar)(document.contents)) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const composeDocument: {
  (state: ComposerState, hasSubsequentDocuments?: boolean, nextDocCst?: CstNode): (cst: CstNode) => RawYamlDocument;
  (cst: CstNode, state: ComposerState, hasSubsequentDocuments?: boolean, nextDocCst?: CstNode): RawYamlDocument;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (cst: CstNode, state: ComposerState, hasSubsequentDocuments = false, nextDocCst?: CstNode): RawYamlDocument => {
    reportFirstControlCharacter(cst, state);
    const walk = makeDocumentWalk(cst, state);
    while (!walk.done && walk.i < walk.children.length) {
      const child = A.getUnsafe(walk.children, walk.i);
      const compose = DOCUMENT_CHILD_COMPOSERS[child.type] ?? composeAliasChild;
      compose(walk, child);
    }
    validateDirectives(walk.directives, cst, state, hasSubsequentDocuments);
    checkDocumentEndMarkerSameLine(walk.children, state, nextDocCst?.children);
    return finishDocument(walk);
  }
);

const pushInvalidDirective = (state: ComposerState, node: CstNode, message: string): void => {
  state.errors.push(
    RawDiagnostic.make({
      code: "InvalidDirective",
      message,
      offset: node.offset,
      length: node.length,
    })
  );
};

const reportDuplicateYamlDirective = (
  directives: readonly RawDirective[],
  children: readonly CstNode[],
  state: ComposerState
): void => {
  if (A.filter(directives, (d) => d.name === "YAML").length <= 1) return;
  const yamlChildren = A.filter(children, (c) => isDirectiveChild(c) && Str.startsWith("%YAML")(Str.trim(c.source)));
  const second = yamlChildren[1];
  if (second !== undefined) pushInvalidDirective(state, second, "Duplicate %YAML directive");
};

const directiveParameterError = (directiveName: string, params: readonly string[]): string | undefined => {
  if (directiveName === "%TAG")
    return params.length === 2 ? undefined : "%TAG directive requires exactly two parameters";
  if (params.length === 0) return "%YAML directive requires a version parameter";
  if (params.length > 1) return `%YAML directive has extra parameters: ${A.join(params.slice(1), " ")}`;
  return /^\d+\.\d+$/.test(A.getUnsafe(params, 0))
    ? undefined
    : "%YAML version must contain decimal major and minor numbers";
};

const directiveCommentIndex = (directiveName: string, src: string): number =>
  directiveName === "%TAG"
    ? O.getOrElse(constant(-1))(Str.search(/[ \t]#/)(src)) + 1
    : O.getOrElse(constant(-1))(Str.indexOf("#")(src));

const validateDirectiveSyntax = (child: CstNode, state: ComposerState): void => {
  const src = Str.trim(child.source);
  const directiveName = /^\S*/.exec(src)?.[0];
  if (directiveName !== "%YAML" && directiveName !== "%TAG") return;
  const hashIdx = directiveCommentIndex(directiveName, src);
  if (hashIdx > 0 && src[hashIdx - 1] !== " " && src[hashIdx - 1] !== "\t") {
    pushInvalidDirective(state, child, "Comment in directive requires preceding whitespace");
    return;
  }
  const withoutComment = hashIdx > 0 ? Str.trimEnd(Str.slice(0, hashIdx)(src)) : src;
  const params = Str.split(/\s+/)(Str.slice(1)(withoutComment)).slice(1);
  const message = directiveParameterError(directiveName, params);
  if (message !== undefined) pushInvalidDirective(state, child, message);
};

const reportDirectiveWithoutDocStart = (children: readonly CstNode[], state: ComposerState): void => {
  const firstDirective = A.findFirst(children, isDirectiveChild);
  if (O.isSome(firstDirective) && !A.some(children, isDocStartMarker)) {
    pushInvalidDirective(state, firstDirective.value, "Directive must be followed by a document-start marker (---)");
  }
};

const DIRECTIVE_CONTENT_TYPES: ReadonlyArray<CstNodeType> = [
  "flow-scalar",
  "block-scalar",
  "block-map",
  "block-seq",
  "flow-map",
  "flow-seq",
  "alias",
  "anchor",
  "tag",
];

const reportDirectiveInContent = (child: CstNode, state: ComposerState): void => {
  const message = "Directive after content requires a document-end marker (...) first";
  if (isDirectiveChild(child)) pushInvalidDirective(state, child, message);
  if (child.children === undefined) return;
  const nested = findNestedDirective(child);
  if (nested !== null) pushInvalidDirective(state, nested, message);
};

const reportDirectivesAfterContent = (children: readonly CstNode[], state: ComposerState): void => {
  let hasContent = false;
  for (const child of children) {
    if (A.contains(DIRECTIVE_CONTENT_TYPES, child.type)) hasContent = true;
    if (hasContent) reportDirectiveInContent(child, state);
  }
};

const validateDirectives: {
  (cst: CstNode, state: ComposerState, hasSubsequentDocuments?: boolean): (directives: RawDirective[]) => void;
  (directives: RawDirective[], cst: CstNode, state: ComposerState, hasSubsequentDocuments?: boolean): void;
} = dual(
  (args) => A.isArray(args[0]),
  (directives: RawDirective[], cst: CstNode, state: ComposerState, hasSubsequentDocuments?: boolean): void => {
    const children = cst.children ?? [];
    reportDuplicateYamlDirective(directives, children, state);
    for (const child of children) {
      if (isDirectiveChild(child)) validateDirectiveSyntax(child, state);
    }
    reportDirectiveWithoutDocStart(children, state);
    const laterDocumentDisambiguatesDirective = hasSubsequentDocuments === true;
    if (laterDocumentDisambiguatesDirective) reportDirectivesAfterContent(children, state);
  }
);

function findNestedDirective(node: CstNode): CstNode | null {
  if (node.type === "directive") return node;
  if (node.children !== undefined) {
    for (const child of node.children) {
      const found = findNestedDirective(child);
      if (found !== null) return found;
    }
  }
  return null;
}

const endsWithDocEnd = (cst: CstNode): boolean => {
  const children = cst.children ?? [];
  for (let i = children.length - 1; i >= 0; i--) {
    const c = A.getUnsafe(children, i);
    if (c.source === "...") return true;
    if (c.type !== "newline" && c.type !== "whitespace" && c.type !== "comment") return false;
  }
  return false;
};

/**
 * Validates directive placement across a multi-document CST stream.
 *
 * **Details**
 *
 * YAML 1.2 requires that directives appearing between documents must be
 * preceded by a document-end marker (`...`). This function checks each
 * CST document node after the first: if it contains directives, the
 * preceding document must have ended with `...`.
 *
 * **Example** (Report a directive without a preceding end marker)
 *
 * ```ts
 * import { validateCrossDocumentDirectives } from "@beep/yaml/internal/composer/document"
 * import type { CstNode } from "@beep/yaml/internal/cst"
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 *
 * const text = "first\n%YAML 1.2\n---\nsecond\n"
 * const documents: ReadonlyArray<CstNode> = [
 *   { type: "document", source: "first\n", offset: 0, length: 6, children: [] },
 *   {
 *     type: "document", source: text.slice(6), offset: 6, length: text.length - 6,
 *     children: [{ type: "directive", source: "%YAML 1.2", offset: 6, length: 9 }]
 *   }
 * ]
 * const state = createState(text, { composeFlowMap, composeFlowSeq })
 * validateCrossDocumentDirectives(documents, state)
 * console.log(state.errors.some(error => error.code === "InvalidDirective")) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCrossDocumentDirectives: {
  (state: ComposerState): (cstNodes: readonly CstNode[]) => void;
  (cstNodes: readonly CstNode[], state: ComposerState): void;
} = dual(2, (cstNodes: readonly CstNode[], state: ComposerState): void => {
  for (let docIdx = 1; docIdx < cstNodes.length; docIdx++) {
    const firstDirective = A.findFirst(A.getUnsafe(cstNodes, docIdx).children ?? [], isDirectiveChild);
    if (O.isSome(firstDirective) && !endsWithDocEnd(A.getUnsafe(cstNodes, docIdx - 1))) {
      pushInvalidDirective(
        state,
        firstDirective.value,
        "Directive between documents requires a document-end marker (...) after the previous document"
      );
    }
  }
});

const isSourceMultiline: {
  (text: string, offset: number, length: number): boolean;
  (offset: number, length: number): (text: string) => boolean;
} = dual(3, (text: string, offset: number, length: number): boolean => {
  if (length <= 0) return false;
  const end = Math.min(offset + length, text.length);
  for (let i = offset; i < end; i++) {
    const ch = text[i];
    if (ch === "\n" || ch === "\r") return true;
  }
  return false;
});

// decision: source-multiline-post-pass
const decorateSourceMultiline: {
  (node: YamlNode, text: string): YamlNode;
  (node: YamlNode | null, text: string): YamlNode | null;
  (text: string): { (node: YamlNode): YamlNode; (node: YamlNode | null): YamlNode | null };
} = dual(2, (node: YamlNode | null, text: string): YamlNode | null => {
  if (node === null || isYamlAlias(node)) return node;
  if (isYamlScalar(node)) return decorateScalarSourceMultiline(node, text);
  if (isYamlMap(node)) return decorateMapSourceMultiline(node, text);
  return decorateSeqSourceMultiline(node, text);
});

const decorateScalarSourceMultiline = (node: YamlScalar, text: string): YamlNode => {
  if (!isSourceMultiline(text, node.offset, node.length)) return node;
  return YamlScalar.make({
    value: node.value,
    style: node.style,
    ...O.getSomesStruct({
      tag: O.fromUndefinedOr(node.tag),
      anchor: O.fromUndefinedOr(node.anchor),
      commentBefore: O.fromUndefinedOr(node.commentBefore),
      comment: O.fromUndefinedOr(node.comment),
      spaceBefore: O.fromUndefinedOr(node.spaceBefore),
      chomp: O.fromUndefinedOr(node.chomp),
      blockIndent: O.fromUndefinedOr(node.blockIndent),
      raw: O.fromUndefinedOr(node.raw),
    }),

    sourceMultiline: true,
    offset: node.offset,
    length: node.length,
  });
};

const decorateMapSourceMultiline = (node: YamlMap, text: string): YamlNode => {
  const newItems = A.map(node.items, (pair) =>
    YamlPair.make({
      key: decorateSourceMultiline(pair.key, text),
      value: pair.value === null ? null : decorateSourceMultiline(pair.value, text),
    })
  );
  const multiline = isSourceMultiline(text, node.offset, node.length);
  return YamlMap.make({
    items: newItems,
    style: node.style,
    ...collectionProps(node),

    ...(multiline ? { sourceMultiline: true } : {}),
    offset: node.offset,
    length: node.length,
  });
};

const decorateSeqSourceMultiline = (node: YamlSeq, text: string): YamlNode => {
  const newItems = A.map(node.items, decorateSourceMultiline(text));
  const multiline = isSourceMultiline(text, node.offset, node.length);
  return YamlSeq.make({
    items: newItems,
    style: node.style,
    ...collectionProps(node),

    ...(multiline ? { sourceMultiline: true } : {}),
    offset: node.offset,
    length: node.length,
  });
};

const decorateDocumentSourceMultiline: {
  (doc: RawYamlDocument, text: string): RawYamlDocument;
  (text: string): (doc: RawYamlDocument) => RawYamlDocument;
} = dual(2, (doc: RawYamlDocument, text: string): RawYamlDocument => {
  const decorated = decorateSourceMultiline(doc.contents ?? null, text);
  if (decorated === doc.contents) return doc;
  return RawYamlDocument.make({
    contents: decorated,
    errors: doc.errors,
    warnings: doc.warnings,
    directives: doc.directives,
    ...O.getSomesStruct({
      commentBefore: O.fromUndefinedOr(doc.commentBefore),
      comment: O.fromUndefinedOr(doc.comment),
    }),

    hasDocumentStart: doc.hasDocumentStart,
    hasDocumentEnd: doc.hasDocumentEnd,
    hasDocumentStartTab: doc.hasDocumentStartTab,
  });
});

/**
 * Provides the empty document result when parsing finds no document CST.
 *
 * **Example** (Inspect an empty document result)
 *
 * ```ts
 * import { EMPTY_DOCUMENT } from "@beep/yaml/internal/composer/document"
 *
 * console.log(EMPTY_DOCUMENT.contents) // null
 * console.log(EMPTY_DOCUMENT.errors.length) // 0
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const EMPTY_DOCUMENT: RawYamlDocument = RawYamlDocument.make({
  contents: null,
  errors: [],
  warnings: [],
  directives: [],
  hasDocumentStart: false,
  hasDocumentEnd: false,
  hasDocumentStartTab: false,
});

/**
 * Composes the first document of `text` with full error recovery.
 *
 * **Details**
 *
 * There is no fatal-code filtering (the facade applies `isFatalCode` to the
 * returned diagnostics). Cross-document directive-placement errors are
 * validated into the same state and therefore appear in the returned
 * document's `errors`.
 *
 * **Example** (Compose the first value in a stream)
 *
 * ```ts
 * import { composeFirstDocument } from "@beep/yaml/internal/composer/document"
 * import { YamlScalar } from "@beep/yaml/YamlNode"
 * import * as S from "effect/Schema"
 *
 * const document = composeFirstDocument("---\nfirst\n---\nsecond\n")
 * console.log(S.is(YamlScalar)(document.contents)) // true
 * console.log(document.errors.length) // 0
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const composeFirstDocument: {
  (options?: ParseOptionsInput): (text: string) => RawYamlDocument;
  (text: string, options?: ParseOptionsInput): RawYamlDocument;
} = dual(
  (args) => P.isString(args[0]),
  (text: string, options?: ParseOptionsInput): RawYamlDocument => composeFirstDocumentCounted(text, options).document
);

/**
 * Composes the first document and reports the CST-level document count of the whole stream.
 *
 * **Details**
 *
 * Uses the single CST parse that {@link composeFirstDocument} already
 * performs — no second walk, and correct where a regex on `---` is not (a
 * `---` inside a block scalar or quoted string is content, not a document
 * marker). Callers that must refuse multi-document input (the `YamlFormat`
 * single-document contract) read `documentCount` instead of re-parsing.
 *
 * **Example** (Count documents without counting scalar content)
 *
 * ```ts
 * import { composeFirstDocumentCounted } from "@beep/yaml/internal/composer/document"
 *
 * const result = composeFirstDocumentCounted("---\n|\n  ---\n---\nsecond\n")
 * console.log(result.documentCount) // 2
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const composeFirstDocumentCounted: {
  (
    options?: ParseOptionsInput
  ): (text: string) => { readonly document: RawYamlDocument; readonly documentCount: number };
  (text: string, options?: ParseOptionsInput): { readonly document: RawYamlDocument; readonly documentCount: number };
} = dual(
  (args) => P.isString(args[0]),
  (
    text: string,
    options?: ParseOptionsInput
  ): { readonly document: RawYamlDocument; readonly documentCount: number } => {
    const cstNodes = parseCSTAll(text);
    const state = createState(text, FLOW, options);

    validateCrossDocumentDirectives(cstNodes, state);

    const firstOrEmptyDocument = A.getUnsafe(cstNodes, 0);

    const result = composeDocument(firstOrEmptyDocument, state, cstNodes.length > 1, cstNodes[1]);
    const laterHandleErrors: RawDiagnostic[] = [];
    for (let i = 1; i < cstNodes.length; i++) {
      const later = composeDocument(
        A.getUnsafe(cstNodes, i),
        createState(text, FLOW, options),
        i < cstNodes.length - 1,
        cstNodes[i + 1]
      );
      for (const error of later.errors) {
        if (error.code === "UnresolvedTag" && Str.startsWith("Tag handle ")(error.message))
          laterHandleErrors.push(error);
      }
    }
    return {
      document: decorateDocumentSourceMultiline({ ...result, errors: [...result.errors, ...laterHandleErrors] }, text),
      documentCount: cstNodes.length,
    };
  }
);

/**
 * Composes every document of `text` with full error recovery.
 *
 * **Details**
 *
 * There is no fatal-code filtering. Each document is composed with a fresh
 * state; the cross-document directive validation runs in its own state whose
 * errors are returned unfiltered as `streamErrors` (the facade applies its
 * filter).
 *
 * **Example** (Compose all values in a stream)
 *
 * ```ts
 * import { composeAllDocuments } from "@beep/yaml/internal/composer/document"
 *
 * const result = composeAllDocuments("---\nfirst\n---\nsecond\n")
 * console.log(result.documents.length) // 2
 * console.log(result.streamErrors.length) // 0
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const composeAllDocuments: {
  (
    options?: ParseOptionsInput
  ): (text: string) => {
    readonly documents: ReadonlyArray<RawYamlDocument>;
    readonly streamErrors: ReadonlyArray<RawDiagnostic>;
  };
  (
    text: string,
    options?: ParseOptionsInput
  ): { readonly documents: ReadonlyArray<RawYamlDocument>; readonly streamErrors: ReadonlyArray<RawDiagnostic> };
} = dual(
  (args) => P.isString(args[0]),
  (
    text: string,
    options?: ParseOptionsInput
  ): { readonly documents: ReadonlyArray<RawYamlDocument>; readonly streamErrors: ReadonlyArray<RawDiagnostic> } => {
    const cstNodes = parseCSTAll(text);
    const documents: RawYamlDocument[] = [];

    const crossDocState = createState(text, FLOW, options);
    validateCrossDocumentDirectives(cstNodes, crossDocState);

    for (let i = 0; i < cstNodes.length; i++) {
      const cst = A.getUnsafe(cstNodes, i);
      const state = createState(text, FLOW, options);
      const doc = composeDocument(cst, state, i < cstNodes.length - 1, cstNodes[i + 1]);
      documents.push(decorateDocumentSourceMultiline(doc, text));
    }

    return { documents, streamErrors: crossDocState.errors };
  }
);

const attachHeaderToFirstEntry: {
  (contents: YamlNode, header: string): YamlNode;
  (header: string): (contents: YamlNode) => YamlNode;
} = dual(2, (contents: YamlNode, header: string): YamlNode => {
  if (isYamlMap(contents) && contents.items.length > 0) {
    const first = A.getUnsafe(contents.items, 0);
    const items = [...contents.items];
    items[0] = YamlPair.make({
      key: withCommentFields(first.key, CommentFields.make({ commentBefore: header })),
      value: first.value,
    });
    return YamlMap.make({
      items,
      style: contents.style,
      ...collectionProps(contents),
      ...O.getSomesStruct({ sourceMultiline: O.fromUndefinedOr(contents.sourceMultiline) }),

      offset: contents.offset,
      length: contents.length,
    });
  }
  if (isYamlSeq(contents) && contents.items.length > 0) {
    const items = [...contents.items];
    const first = A.getUnsafe(items, 0);
    items[0] = withCommentFields(first, CommentFields.make({ commentBefore: header }));
    return YamlSeq.make({
      items,
      style: contents.style,
      ...collectionProps(contents),
      ...O.getSomesStruct({ sourceMultiline: O.fromUndefinedOr(contents.sourceMultiline) }),

      offset: contents.offset,
      length: contents.length,
    });
  }
  return withCommentFields(contents, CommentFields.make({ commentBefore: header }));
});

function stripOwnComment(node: YamlMap | YamlSeq): YamlNode {
  const shared = {
    style: node.style,
    ...O.getSomesStruct({
      tag: O.fromUndefinedOr(node.tag),
      anchor: O.fromUndefinedOr(node.anchor),
      commentBefore: O.fromUndefinedOr(node.commentBefore),
      spaceBefore: O.fromUndefinedOr(node.spaceBefore),
      sourceMultiline: O.fromUndefinedOr(node.sourceMultiline),
    }),

    offset: node.offset,
    length: node.length,
  };
  return isYamlMap(node)
    ? YamlMap.make({ items: node.items, ...shared })
    : YamlSeq.make({ items: node.items, ...shared });
}
