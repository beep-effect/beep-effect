/**
 * The Markdown node partition: cuts one memory file into its ordered nodes,
 * and checks whether a proposed node replacement leaves every other node's
 * parse unchanged.
 *
 * **Details**
 *
 * The functions are pure: no I/O, no log, no Effect. They implement
 * decisions `granularity-row-and-list-item` and
 * `file-is-an-ordered-node-partition`; the construct mapping, the fallback
 * ladder and the reparse comparison are recorded in decisions
 * `markdown-partition-construct-mapping`, `markdown-partition-total-fallback`
 * and `reparse-check-compares-kind-and-text`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Markdown, MarkdownRange } from "@beep/markdown";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { NodeReplacementOutOfRangeError } from "./MarkdownPartition.errors.ts";
import { MarkdownPartition, PartitionNode, ReparseCheck } from "./MarkdownPartition.models.ts";
import type { List, ListItem, Root, Table } from "@beep/markdown";
import type { NodeReplacement, PartitionFallback } from "./MarkdownPartition.models.ts";
import type { NodeKind } from "./NodeIdentity.models.ts";

type Block = Root["children"][number];

// A content node before gap filling: half-open UTF-16 range [start, end).
interface Span {
  readonly end: number;
  readonly kind: NodeKind;
  readonly start: number;
}

// Source text plus the offset the parser's positions are shifted by (1 when a
// leading byte order mark was stripped before parsing).
interface Source {
  readonly shift: number;
  readonly text: string;
}

const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const BYTE_ORDER_MARK = 0xfeff;

const startOf = (source: Source, node: { readonly position: Block["position"] }): number =>
  node.position.start.offset + source.shift;

const endOf = (source: Source, node: { readonly position: Block["position"] }): number =>
  node.position.end.offset + source.shift;

// UTF-16 code unit at `index`, or -1 past either end of the text.
const codeAt = (text: string, index: number): number => O.getOrElse(Str.charCodeAt(text, index), () => -1);

const isLineTerminator = (code: number): boolean => code === LINE_FEED || code === CARRIAGE_RETURN;

// Pull a node's start back to the start of its line, never past `floor`, so
// the indentation and container prefix of a node's first line ride inside
// the node instead of a gap.
const lineStart = (text: string, offset: number, floor: number): number => {
  let index = offset;
  while (index > floor && !isLineTerminator(codeAt(text, index - 1))) {
    index -= 1;
  }
  return index;
};

// A boundary between the halves of a surrogate pair would make two node texts
// that are not valid UTF-16 on their own.
const splitsSurrogatePair = (text: string, offset: number): boolean => {
  if (offset <= 0 || offset >= text.length) {
    return false;
  }
  const before = codeAt(text, offset - 1);
  const after = codeAt(text, offset);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
};

// The kind a block takes when it is one node: its own construct, or the
// coarse form of a list (`listItem`) or table (`tableRow`).
const coarseKind: (block: Block) => NodeKind = Match.type<Block>().pipe(
  Match.discriminatorsExhaustive("type")({
    frontmatter: () => "frontmatter" as const,
    heading: () => "heading" as const,
    paragraph: () => "paragraph" as const,
    code: () => "codeFence" as const,
    html: () => "html" as const,
    thematicBreak: () => "thematicBreak" as const,
    list: () => "listItem" as const,
    table: () => "tableRow" as const,
    blockquote: () => "paragraph" as const,
    definition: () => "paragraph" as const,
    footnoteDefinition: () => "paragraph" as const,
    mdxjsEsm: () => "paragraph" as const,
    mdxFlowExpression: () => "paragraph" as const,
    mdxJsxFlowElement: () => "paragraph" as const,
  })
);

// Blocks whose children are other blocks; a list item opening with one of
// these is kept whole.
const isContainerType = S.is(S.Literals(["list", "blockquote", "table", "footnoteDefinition", "mdxJsxFlowElement"]));

const isContainer = (block: Block): boolean => isContainerType(block.type);

// The end of a table's delimiter row: the line after the header row, bounded
// by the next row's start or the table's end.
const delimiterRowEnd = (text: string, headerEnd: number, bound: number): number => {
  let index = headerEnd;
  if (index < bound && codeAt(text, index) === CARRIAGE_RETURN) {
    index += 1;
  }
  if (index < bound && codeAt(text, index) === LINE_FEED) {
    index += 1;
  }
  while (index < bound && !isLineTerminator(codeAt(text, index))) {
    index += 1;
  }
  return Math.max(headerEnd, index);
};

const leafSpans = (source: Source, block: Block, floor: number): ReadonlyArray<Span> => [
  { kind: coarseKind(block), start: lineStart(source.text, startOf(source, block), floor), end: endOf(source, block) },
];

// Spans of a run of sibling blocks: each block's floor is the end of the
// spans emitted before it.
const runSpans = (source: Source, blocks: ReadonlyArray<Block>, floor: number): Array<Span> => {
  const spans: Array<Span> = [];
  let current = floor;
  for (const block of blocks) {
    for (const span of blockSpans(source, block, current)) {
      spans.push(span);
      current = Math.max(current, span.end);
    }
  }
  return spans;
};

const listItemSpans = (source: Source, item: ListItem, floor: number): ReadonlyArray<Span> => {
  const start = lineStart(source.text, startOf(source, item), floor);
  const [lead, ...rest] = item.children;
  // An item with at most one child block, or one opening with a container, is
  // one node; otherwise its marker and first block are the item node and each
  // later child block is cut on its own.
  if (lead === undefined || rest.length === 0 || isContainer(lead)) {
    return [{ kind: "listItem", start, end: endOf(source, item) }];
  }
  const leadSpan: Span = { kind: "listItem", start, end: endOf(source, lead) };
  return [leadSpan, ...runSpans(source, rest, leadSpan.end)];
};

const listSpans = (source: Source, list: List, floor: number): ReadonlyArray<Span> => {
  const spans: Array<Span> = [];
  let current = floor;
  for (const item of list.children) {
    for (const span of listItemSpans(source, item, current)) {
      spans.push(span);
      current = Math.max(current, span.end);
    }
  }
  return spans;
};

const tableSpans = (source: Source, table: Table, floor: number): ReadonlyArray<Span> => {
  const [header, ...body] = table.children;
  if (header === undefined) {
    return leafSpans(source, table, floor);
  }
  const bound = body[0] === undefined ? endOf(source, table) : startOf(source, body[0]);
  // The delimiter row rides with the header row: their column counts must
  // agree, so they are one editing unit.
  const headerSpan: Span = {
    kind: "tableRow",
    start: lineStart(source.text, startOf(source, header), floor),
    end: delimiterRowEnd(source.text, endOf(source, header), bound),
  };
  const spans: Array<Span> = [headerSpan];
  let current = headerSpan.end;
  for (const row of body) {
    const span: Span = {
      kind: "tableRow",
      start: lineStart(source.text, startOf(source, row), current),
      end: endOf(source, row),
    };
    spans.push(span);
    current = Math.max(current, span.end);
  }
  return spans;
};

type SpansFrom = (source: Source, floor: number) => ReadonlyArray<Span>;

const spansFor: (block: Block) => SpansFrom = Match.type<Block>().pipe(
  Match.discriminators("type")({
    list:
      (list): SpansFrom =>
      (source, floor) =>
        listSpans(source, list, floor),
    table:
      (table): SpansFrom =>
      (source, floor) =>
        tableSpans(source, table, floor),
  }),
  Match.orElse(
    (block): SpansFrom =>
      (source, floor) =>
        leafSpans(source, block, floor)
  )
);

function blockSpans(source: Source, block: Block, floor: number): ReadonlyArray<Span> {
  return spansFor(block)(source, floor);
}

// Spans are usable when they are non-overlapping, in order, inside
// [low, high] and never split a surrogate pair. Zero-width spans are dropped
// first: they hold no bytes.
const usableSpans = (text: string, spans: ReadonlyArray<Span>, low: number, high: number): boolean => {
  let previous = low;
  for (const span of spans) {
    if (
      span.start < previous ||
      span.end < span.start ||
      span.end > high ||
      splitsSurrogatePair(text, span.start) ||
      splitsSurrogatePair(text, span.end)
    ) {
      return false;
    }
    previous = span.end;
  }
  return true;
};

const nonEmpty = (spans: ReadonlyArray<Span>): ReadonlyArray<Span> => A.filter(spans, (span) => span.end > span.start);

const makeNode = (text: string, kind: NodeKind, start: number, end: number): PartitionNode =>
  PartitionNode.make(
    {
      kind,
      text: Str.slice(start, end)(text),
      range: MarkdownRange.make({ offset: start, length: end - start }, { disableChecks: true }),
    },
    { disableChecks: true }
  );

// Interleave gap nodes between the ordered content spans so the node texts
// cover the file exactly.
const assemble = (text: string, spans: ReadonlyArray<Span>, fallback: PartitionFallback): MarkdownPartition => {
  const nodes: Array<PartitionNode> = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) {
      nodes.push(makeNode(text, "gap", cursor, span.start));
    }
    nodes.push(makeNode(text, span.kind, span.start, span.end));
    cursor = span.end;
  }
  if (cursor < text.length) {
    nodes.push(makeNode(text, "gap", cursor, text.length));
  }
  return MarkdownPartition.make({ nodes, fallback }, { disableChecks: true });
};

const wholeFile = (text: string, fallback: PartitionFallback): MarkdownPartition =>
  assemble(text, [{ kind: "paragraph", start: 0, end: text.length }], fallback);

const partitionParsed = (source: Source, root: Root): MarkdownPartition => {
  const { text } = source;
  const spans: Array<Span> = [];
  let fallback: PartitionFallback = "none";
  let cursor = source.shift;
  for (const block of root.children) {
    const start = startOf(source, block);
    const end = endOf(source, block);
    if (
      start < cursor ||
      end < start ||
      end > text.length ||
      splitsSurrogatePair(text, start) ||
      splitsSurrogatePair(text, end)
    ) {
      return wholeFile(text, "file");
    }
    if (end > start) {
      const regionStart = lineStart(text, start, cursor);
      const inner = nonEmpty(blockSpans(source, block, cursor));
      if (usableSpans(text, inner, regionStart, end)) {
        spans.push(...inner);
      } else {
        spans.push({ kind: coarseKind(block), start: regionStart, end });
        fallback = "block";
      }
      cursor = end;
    }
  }
  return assemble(text, spans, fallback);
};

/**
 * Cuts one memory file into its ordered node partition.
 *
 * **Details**
 *
 * The file is parsed with `@beep/markdown` (GFM, frontmatter capture on).
 * Table rows and list items are nodes; headings, paragraphs and code blocks
 * are single nodes; the bytes between content nodes are `gap` nodes. Every
 * UTF-16 code unit belongs to exactly one node and the node texts
 * concatenate to `text`. Decision `markdown-partition-construct-mapping`
 * records how each other construct maps:
 *
 * - A content node starts at the start of its first line, so its indentation
 *   and container prefix ride inside it; list markers stay inside list-item
 *   nodes (spike S14).
 * - A list item with one child block, or whose first child is a container,
 *   is one node. Otherwise its marker and first block are the item node, and
 *   each later child block (a nested list's items, a continuation paragraph)
 *   is cut on its own.
 * - A table's header row and delimiter row are one `tableRow` node; each body
 *   row is a node.
 * - Frontmatter, thematic breaks and HTML blocks map to their own kinds;
 *   indented code maps to `codeFence`; a block quote, a link reference
 *   definition and a footnote definition are each one `paragraph` node.
 * - A leading byte order mark is stripped before parsing and kept as the
 *   first gap, CRLF and tabs are kept verbatim, and a file without a trailing
 *   line terminator ends on its last content node. An empty file has no
 *   nodes.
 *
 * The partition is total. A top-level block whose child positions overlap,
 * run backwards or leave the block becomes one node (`block`); top-level
 * positions that overlap, run backwards or leave the file make the whole file
 * one node (`file`); and a file the parser rejects is one node (`unparsed`).
 *
 * **Example** (Partition a short memory file)
 *
 * ```ts
 * import { partition } from "@beep/agent-memory-store"
 *
 * const result = partition("# Notes\n\n- one\n- two\n")
 * console.log(result.nodes.map((node) => [node.kind, node.text]))
 * // [["heading","# Notes"],["gap","\n\n"],["listItem","- one"],["gap","\n"],["listItem","- two"],["gap","\n"]]
 * ```
 *
 * @param text - The whole file text.
 * @returns The ordered node partition of the file.
 * @category parsing
 * @since 0.0.0
 */
export const partition = (text: string): MarkdownPartition => {
  if (text.length === 0) {
    return MarkdownPartition.make({ nodes: [], fallback: "none" });
  }
  const shift = codeAt(text, 0) === BYTE_ORDER_MARK ? 1 : 0;
  const source: Source = { text, shift };
  return Result.match(Markdown.parseResult(shift === 0 ? text : Str.slice(shift)(text), { frontmatter: true }), {
    onFailure: () => wholeFile(text, "unparsed"),
    onSuccess: (root) => partitionParsed(source, root),
  });
};

/**
 * Cuts a file into its ordered node partition from a tree already parsed
 * from that exact text.
 *
 * **Details**
 *
 * The tree's positions must index `text` directly (no byte order mark
 * stripped). The construct mapping and the `none`, `block` and `file`
 * fallbacks are those of {@link partition}; a tree whose positions are
 * unusable still yields an exact partition. Use it when a caller already
 * holds the `@beep/markdown` tree of the file and wants to skip a second
 * parse.
 *
 * **Example** (Partition a parsed tree)
 *
 * ```ts
 * import { partitionTree } from "@beep/agent-memory-store"
 * import { Markdown } from "@beep/markdown"
 * import * as Result from "effect/Result"
 *
 * const text = "| a |\n|---|\n| 1 |\n"
 * const result = Result.map(Markdown.parseResult(text), (root) => partitionTree(text, root))
 * console.log(Result.map(result, (value) => value.nodes.length)) // Success(4)
 * ```
 *
 * @param text - The whole file text the tree was parsed from.
 * @param root - The parsed tree of `text`.
 * @returns The ordered node partition of the file.
 * @category parsing
 * @since 0.0.0
 */
export const partitionTree: {
  (root: Root): (text: string) => MarkdownPartition;
  (text: string, root: Root): MarkdownPartition;
} = dual(
  2,
  (text: string, root: Root): MarkdownPartition =>
    Str.isEmpty(text)
      ? MarkdownPartition.make({ nodes: [], fallback: "none" })
      : partitionParsed({ text, shift: 0 }, root)
);

const sameNodeAt = (
  left: ReadonlyArray<PartitionNode>,
  leftIndex: number,
  right: ReadonlyArray<PartitionNode>,
  rightIndex: number
): boolean => {
  const leftNode = left[leftIndex];
  const rightNode = right[rightIndex];
  return (
    leftNode !== undefined &&
    rightNode !== undefined &&
    leftNode.kind === rightNode.kind &&
    leftNode.text === rightNode.text
  );
};

// Length of the longest run 0, 1, ... below `limit` on which `matches` holds.
const matchingRun = (limit: number, matches: (index: number) => boolean): number => {
  let length = 0;
  while (length < limit && matches(length)) {
    length += 1;
  }
  return length;
};

// The indices [from, to), empty when `to <= from`.
const indexRun = (from: number, to: number): ReadonlyArray<number> =>
  to > from ? A.makeBy(to - from, (index) => from + index) : [];

const joinTexts = (nodes: ReadonlyArray<PartitionNode>): string =>
  A.join(
    A.map(nodes, (node) => node.text),
    ""
  );

/**
 * Checks whether replacing a run of nodes leaves every other node's kind and
 * text unchanged when the edited file is partitioned again.
 *
 * **Details**
 *
 * The edited file is the base partition's text with nodes
 * `[replacement.start, replacement.end)` replaced by `replacement.text`. A
 * projector applies a raw-slice replacement only when the check is `stable`:
 * then no byte outside the replaced run changes how it parses (scoreboard
 * design item 5). The result carries the edited partition, so a caller does
 * not partition the edited file twice.
 *
 * **Example** (Detect a replacement that merges two paragraphs)
 *
 * ```ts
 * import { NodeReplacement, checkReplacement, partition } from "@beep/agent-memory-store"
 * import * as Result from "effect/Result"
 *
 * const base = partition("one\n\ntwo\n")
 * // Replacing the blank-line gap with a single newline joins the paragraphs.
 * const check = checkReplacement(base, NodeReplacement.make({ start: 1, end: 2, text: "\n" }))
 * console.log(Result.map(check, (value) => value.disturbed)) // Success([0, 2])
 * ```
 *
 * @param base - The partition of the current file.
 * @param replacement - The node run to replace and its new text.
 * @returns The reparse check, or `NodeReplacementOutOfRangeError` when the
 *   run is outside `base`.
 * @category parsing
 * @since 0.0.0
 */
export const checkReplacement: {
  (
    replacement: NodeReplacement
  ): (base: MarkdownPartition) => Result.Result<ReparseCheck, NodeReplacementOutOfRangeError>;
  (base: MarkdownPartition, replacement: NodeReplacement): Result.Result<ReparseCheck, NodeReplacementOutOfRangeError>;
} = dual(
  2,
  (
    base: MarkdownPartition,
    replacement: NodeReplacement
  ): Result.Result<ReparseCheck, NodeReplacementOutOfRangeError> => {
    const { nodes } = base;
    const count = nodes.length;
    const { start, end } = replacement;
    if (start > end || end > count) {
      return Result.fail(NodeReplacementOutOfRangeError.make({ start, end, nodeCount: count }));
    }
    const edited = partition(`${joinTexts(nodes.slice(0, start))}${replacement.text}${joinTexts(nodes.slice(end))}`);
    const editedNodes = edited.nodes;
    const editedCount = editedNodes.length;
    const prefix = matchingRun(Math.min(start, editedCount), (index) => sameNodeAt(nodes, index, editedNodes, index));
    const suffix = matchingRun(Math.min(count - end, editedCount - prefix), (offset) =>
      sameNodeAt(nodes, count - 1 - offset, editedNodes, editedCount - 1 - offset)
    );
    const disturbed = [...indexRun(prefix, start), ...indexRun(end, count - suffix)];
    return Result.succeed(
      ReparseCheck.make({
        stable: disturbed.length === 0,
        disturbed,
        region: editedNodes.slice(prefix, editedCount - suffix),
        edited,
      })
    );
  }
);
