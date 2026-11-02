// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// Port notes: upstream keeps the block-construct table (`blocks`), the
// block-start array (`blockStarts`) and the parser itself in one file, with
// each construct reaching into parser internals by name. Here the vocabulary
// the two sides share is extracted into this leaf so the registry can import
// the construct modules and the construct modules can import these types
// without closing an import cycle (`noImportCycles` is error-level).
//
// The mutable engine state — `BlockNode`, its `BlockData` bag, the shared
// `ListData` and `TableData` records, the `BlockScanner` surface and the
// construct/start/dialect tables — are concrete internal classes (D-42); the
// immutable records that cross module boundaries are branded `S.Opaque`
// schemas the engine builds as plain encoded values and never `make`s per
// node (D-39). The mutable `BlockNode` is upstream's `Node` during the block
// pass only. It never leaves the engine: `blockParser.ts` materializes the immutable,
// mdast-shaped `MarkdownNode` classes from it once the tree is closed. Two
// fields have no upstream counterpart, both serving the offset delta —
// `startOffset`/`endOffset`, and the `segments` that map accumulated string
// content back to the source it was copied from.

import { $MarkdownId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type {
  BulletChar,
  FenceChar,
  FlowContent,
  Heading,
  HeadingDepth,
  HeadingStyle,
  ListDelimiter,
  ListItem,
  Paragraph,
  PhrasingContent,
  Position,
  Root,
  TableAlign,
  TableCell,
  TableRow,
  ThematicBreakChar,
} from "./nodes.ts";

const $I = $MarkdownId.create("internal/blockTypes");

/**
 * The block constructs the engine knows. Keys of a dialect's construct table.
 *
 * **Details**
 *
 * `definition` has no block start of its own: link reference definitions are
 * split out of a paragraph's content when it closes, and spliced into the
 * tree ahead of what is left of that paragraph.
 *
 * **Example** (Validate BlockType)
 *
 * ```ts
 * import { BlockType } from "@beep/markdown/internal/blockTypes"
 * import * as S from "effect/Schema"
 *
 * S.is(BlockType)("paragraph") // => true
 * S.is(BlockType)("root") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BlockType = LiteralKit([
  "document",
  "blockquote",
  "list",
  "listItem",
  "paragraph",
  "heading",
  "thematicBreak",
  "code",
  "html",
  "definition",
  "footnoteDefinition",
  "table",
  "tableRow",
  "tableCell",
]).pipe($I.annoteSchema("BlockType", { description: "Block construct kinds recognized by the engine." }));

/** The engine kind domain derived from its schema.
 * @category type-level
 * @since 0.0.0
 */
export type BlockType = typeof BlockType.Type;

/**
 * A run of characters copied verbatim from the source into a leaf block's
 * accumulated content.
 *
 * **Details**
 *
 * The block pass strips container prefixes and expands tabs, so a leaf's
 * content is not a contiguous source slice. Each segment pins one run that
 * IS contiguous, which is what lets the inline pass give its nodes
 * absolute source positions instead of guessing. Characters the engine
 * injects — the `\n` between lines, the spaces a partially consumed tab
 * expands to — lie between segments and belong to no source range.
 *
 * **Example** (Validate RawInlineSegment)
 *
 * ```ts
 * import { RawInlineSegment } from "@beep/markdown/internal/blockTypes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RawInlineSegment)({ textOffset: 0, sourceOffset: 12, length: 4 })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawInlineSegment extends S.Opaque<RawInlineSegment, { readonly brand: unique symbol }>()(
  S.Struct({
    textOffset: S.Finite.pipe(
      $I.annoteKey("RawInlineSegment.textOffset", {
        description: "Index into the accumulated block content where this run starts.",
      })
    ),
    sourceOffset: S.Finite.pipe(
      $I.annoteKey("RawInlineSegment.sourceOffset", {
        description: "Absolute source offset of the run's first character.",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("RawInlineSegment.length", { description: "Length of the verbatim source run in characters." })
    ),
  }).pipe(
    $I.annoteSchema("RawInlineSegment", {
      description: "A contiguous source run copied into a leaf block's inline text.",
    })
  )
) {}

/**
 * Companion types for {@link RawInlineSegment}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RawInlineSegment {
  /**
   * The plain segment record the engine builds per copied run: a constructed {@link RawInlineSegment} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RawInlineSegment.Encoded;
}

/**
 * A node that owns parsed phrasing content — the parent side of a
 * {@link RawInlineSlice}.
 *
 * **Details**
 *
 * A GFM table cell is one of these even though it is not a leaf block: cells
 * are the block pass's other inline host, and they go through the same
 * `inlineSlice`/`registerInline` seam every leaf does.
 *
 * @category type-level
 * @since 0.0.0
 */
export type InlineHost = Paragraph | Heading | TableCell;

/**
 * A leaf block's raw inline text, handed to the inline pass.
 *
 * **Details**
 *
 * `parent` is the materialized node the parsed children belong to; `text` is
 * the trimmed content; `startOffset` is where `text` begins in the source,
 * and `segments` maps the rest of it (see {@link RawInlineSegment}).
 *
 * An engine record (D-42), not a schema: `parent` is a node of the tree the
 * facade has not admitted yet, and a schema `make` here would re-walk it —
 * the per-node cost D-39 removes by admitting the finished tree once.
 *
 * **Example** (Read a reported inline slice)
 *
 * ```ts
 * import { parseBlocks } from "@beep/markdown/internal/blockParser"
 *
 * const [slice] = parseBlocks("hello\n").rawInlines
 * console.log(slice?.parent.type, slice?.text) // paragraph hello
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawInlineSlice {
  /** The materialized node that will own the parsed inline children. */
  readonly parent: InlineHost;
  /** Source runs mapping the inline text back to the document. */
  readonly segments: ReadonlyArray<RawInlineSegment.Encoded>;
  /** Absolute source offset where the inline text begins. */
  readonly startOffset: number;
  /** Trimmed inline text prepared by the block pass. */
  readonly text: string;

  constructor(parent: InlineHost, prepared: PreparedInline) {
    this.parent = parent;
    this.text = prepared.text;
    this.startOffset = prepared.startOffset;
    this.segments = prepared.segments;
  }
}

/**
 * A leaf's inline text prepared for materialization, before it has a parent.
 *
 * **Details**
 *
 * An engine record (D-42), not a schema: `children` are inline nodes the
 * facade has not admitted yet (see {@link RawInlineSlice}). Any object with
 * these fields is one, so the inline seam builds it as a literal.
 *
 * **Example** (Prepare an empty inline run)
 *
 * ```ts
 * import type { PreparedInline } from "@beep/markdown/internal/blockTypes"
 *
 * const prepared: PreparedInline = { text: "", startOffset: 0, endOffset: 0, segments: [], children: [] }
 * console.log(prepared.text.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PreparedInline {
  /** The temporary passthrough children (see `rawInline.ts`). */
  readonly children: ReadonlyArray<PhrasingContent>;
  /** Absolute source offset where the inline text ends. */
  readonly endOffset: number;
  /** Source runs mapping the inline text back to the document. */
  readonly segments: ReadonlyArray<RawInlineSegment.Encoded>;
  /** Absolute source offset where the inline text begins. */
  readonly startOffset: number;
  /** Inline text prepared for materialization. */
  readonly text: string;

  constructor(
    text: string,
    startOffset: number,
    endOffset: number,
    segments: ReadonlyArray<RawInlineSegment.Encoded>,
    children: ReadonlyArray<PhrasingContent>
  ) {
    this.text = text;
    this.startOffset = startOffset;
    this.endOffset = endOffset;
    this.segments = segments;
    this.children = children;
  }
}

/**
 * A parsed link reference definition, awaiting materialization.
 *
 * **Example** (Validate DefinitionData)
 *
 * ```ts
 * import { DefinitionData } from "@beep/markdown/internal/blockTypes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DefinitionData)({ key: "ref", identifier: "ref", label: "Ref", url: "/target" })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DefinitionData extends S.Opaque<DefinitionData, { readonly brand: unique symbol }>()(
  S.Struct({
    key: S.String.pipe($I.annoteKey("DefinitionData.key", { description: "The case-folded lookup key." })),
    identifier: S.String.pipe(
      $I.annoteKey("DefinitionData.identifier", {
        description: "mdast's identifier: the normalized label, lowercased.",
      })
    ),
    label: S.String.pipe($I.annoteKey("DefinitionData.label", { description: "mdast's label: the raw label text." })),
    url: S.String.pipe(
      $I.annoteKey("DefinitionData.url", {
        description: "The decoded destination, never percent-encoded (see `references.ts`).",
      })
    ),
    title: S.optionalKey(S.String).pipe(
      $I.annoteKey("DefinitionData.title", {
        description: "The definition's title, absent when no title was provided.",
      })
    ),
  }).pipe(
    $I.annoteSchema("DefinitionData", { description: "A parsed link reference definition awaiting materialization." })
  )
) {}

/**
 * A GFM footnote definition's label, carried on the block.
 *
 * **Details**
 *
 * The fold happens once, at the block start, so the label map the inline pass
 * consults and the node's `identifier` can never disagree.
 *
 * **Example** (Validate FootnoteData)
 *
 * ```ts
 * import { FootnoteData } from "@beep/markdown/internal/blockTypes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(FootnoteData)({ key: "note", identifier: "note", label: "Note" })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FootnoteData extends S.Opaque<FootnoteData, { readonly brand: unique symbol }>()(
  S.Struct({
    key: DefinitionData.fields.key,
    identifier: DefinitionData.fields.identifier,
    label: S.String.pipe(
      $I.annoteKey("FootnoteData.label", { description: "mdast's label: the raw label text, as written." })
    ),
  }).pipe($I.annoteSchema("FootnoteData", { description: "A GFM footnote definition's label carried on the block." }))
) {}

/**
 * The two list kinds a list marker opens.
 *
 * **Example** (Validate a list kind)
 *
 * ```ts
 * import { ListType } from "@beep/markdown/internal/blockTypes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ListType)("ordered")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListType = LiteralKit(["bullet", "ordered"]).pipe(
  $I.annoteSchema("ListType", { description: "The list kinds a bullet or ordered list marker opens." })
);

/**
 * The list kind domain derived from its schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ListType = typeof ListType.Type;

/**
 * A list marker's parsed shape, upstream's `_listData`.
 *
 * **Details**
 *
 * Mutable engine state (D-42): one record is shared by a list and the item
 * whose marker opened it, and the list's finalize writes `tight` back onto it.
 *
 * **Example** (Open an ordered list's marker record)
 *
 * ```ts
 * import { ListData } from "@beep/markdown/internal/blockTypes"
 *
 * const data = new ListData("ordered", 0)
 * data.start = 3
 * console.log(data.type, data.tight, data.start) // ordered true 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ListData {
  declare bulletChar?: BulletChar;
  declare delimiter?: ListDelimiter;
  /** Columns of indentation before the marker. */
  markerOffset: number;
  /** Marker width plus the spaces that follow it. */
  padding: number;
  declare start?: number;
  /** Upstream's `tight`, written by the list's finalize. */
  tight: boolean;
  readonly type: ListType;

  constructor(type: ListType, markerOffset: number) {
    this.type = type;
    this.markerOffset = markerOffset;
    this.padding = 0;
    this.tight = true;
  }
}

/**
 * A GFM table's parsed shape, carried on the table block.
 *
 * **Details**
 *
 * Mutable engine state (D-42): the row construct counts rows and the cells
 * among them that came from real source as the table grows.
 *
 * **Example** (Open a two-column table record)
 *
 * ```ts
 * import { TableData } from "@beep/markdown/internal/blockTypes"
 *
 * const data = new TableData(["left", null], 2)
 * console.log(data.columns, data.rows, data.nonemptyCells) // 2 0 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TableData {
  /** One entry per column, `null` where the delimiter row declared none (mdast's wire shape). */
  readonly align: ReadonlyArray<TableAlign | null>;
  /** The header's column count; every row is truncated or padded to it. */
  readonly columns: number;
  /** Cells added so far that came from real source. */
  nonemptyCells: number;
  /** Rows added so far. */
  rows: number;

  constructor(align: ReadonlyArray<TableAlign | null>, columns: number) {
    this.align = align;
    this.columns = columns;
    this.nonemptyCells = 0;
    this.rows = 0;
  }
}

/**
 * Construct-specific state carried on a {@link BlockNode} during the pass —
 * upstream's `_level`, `_isFenced`, `_listData` and friends, gathered into one
 * bag.
 *
 * **Details**
 *
 * Mutable engine state (D-42). Every field is optional and declared rather
 * than initialized, so an unset field is absent rather than `undefined`
 * (`exactOptionalPropertyTypes` is on).
 *
 * **Example** (Record a heading's depth)
 *
 * ```ts
 * import { BlockData } from "@beep/markdown/internal/blockTypes"
 *
 * const data = new BlockData()
 * data.level = 2
 * console.log(data.level, "lang" in data) // 2 false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlockData {
  /**
   * A GFM task-list item's checkbox state, set by the task-list block start
   * and absent on every item that carried no marker (and under every dialect
   * that has no such start).
   */
  declare checked?: boolean;
  /** A split-out link reference definition (see {@link BlockType}). */
  declare definition?: DefinitionData;
  declare fenceChar?: FenceChar;
  /** Fenced code: set when a closing fence ended the block; absent on an unterminated one. */
  declare fenceClosed?: boolean;
  declare fenceLength?: number;
  declare fenceOffset?: number;
  /** A GFM footnote definition's label, set by the footnote block start. */
  declare footnote?: FootnoteData;
  /** Which spelling produced a heading. */
  declare headingStyle?: HeadingStyle;
  /** HTML block kind, 1 through 7. */
  declare htmlBlockType?: number;
  /** Fenced code: set by the fenced-code start, absent for indented code. */
  declare isFenced?: boolean;
  /** Fenced code info string, split at finalize. */
  declare lang?: string;
  /** Heading depth, set by the ATX and setext starts. */
  declare level?: HeadingDepth;
  /** List and list-item bookkeeping. */
  declare listData?: ListData;
  /** Which character drew a thematic break. */
  declare markerChar?: ThematicBreakChar;
  declare meta?: string;
  /** mdast's `spread`, computed for a list and each of its items at finalize. */
  declare spread?: boolean;
  /** GFM table bookkeeping, set by the table block starts. */
  declare tableData?: TableData;
  /**
   * Set on a paragraph whose delimiter row failed to match its header —
   * cmark-gfm's `CMARK_NODE__TABLE_VISITED`, which stops a paragraph being
   * rescanned for a table once for every line it goes on to absorb.
   */
  declare tableVisited?: boolean;
}

/**
 * A block under construction. Mutable by design — the block pass appends
 * lines and children to it across the line loop — and engine-private.
 *
 * **Details**
 *
 * Mutable engine state (D-42). A new block is open, has no parent or
 * children, and starts with empty content, segments and construct data. Its
 * end position initially equals its start position.
 *
 * **Example** (Open a paragraph block)
 *
 * ```ts
 * import { BlockNode } from "@beep/markdown/internal/blockTypes"
 *
 * const block = new BlockNode("paragraph", 12, 3, 1)
 * console.log(block.open, block.endOffset, block.depth) // true 12 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlockNode {
  readonly children: BlockNode[];
  readonly data: BlockData;
  /**
   * Distance from the document, which is depth 0. Recorded at open time so
   * the nesting guard is a comparison rather than a walk up the parents.
   */
  readonly depth: number;
  endLine: number;
  endOffset: number;
  /** False once the block has been finalized. */
  open: boolean;
  parent: BlockNode | undefined;
  /** Source provenance of `stringContent` (see {@link RawInlineSegment}). */
  readonly segments: RawInlineSegment.Encoded[];
  startLine: number;
  startOffset: number;
  /** Accumulated line content, for constructs whose `acceptsLines` is true. */
  stringContent: string;
  readonly type: BlockType;

  constructor(type: BlockType, startOffset: number, startLine: number, depth: number) {
    this.type = type;
    this.depth = depth;
    this.parent = undefined;
    this.children = [];
    this.open = true;
    this.stringContent = "";
    this.segments = [];
    this.startOffset = startOffset;
    this.endOffset = startOffset;
    this.startLine = startLine;
    this.endLine = startLine;
    this.data = new BlockData();
  }
}

/**
 * A construct's `continue` verdict for the current line.
 *
 * **Details**
 *
 * - `0` — the block continues.
 * - `1` — it does not; close it.
 * - `2` — the line is fully consumed (a fence close); go to the next line.
 *
 * **Example** (Validate BlockContinueResult)
 *
 * ```ts
 * import { BlockContinueResult } from "@beep/markdown/internal/blockTypes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BlockContinueResult)(0)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BlockContinueResult = LiteralKit([0, 1, 2]).pipe(
  $I.annoteSchema("BlockContinueResult", { description: "The numeric verdicts returned by a block continue scanner." })
);

/** The block continue verdict domain derived from its schema.
 * @category type-level
 * @since 0.0.0
 */
export type BlockContinueResult = typeof BlockContinueResult.Type;

/**
 * A block start's verdict.
 *
 * **Details**
 *
 * - `0` — no match.
 * - `1` — a container opened; keep looking for starts inside it.
 * - `2` — a leaf opened; stop looking.
 *
 * **Example** (Validate BlockStartResult)
 *
 * ```ts
 * import { BlockStartResult } from "@beep/markdown/internal/blockTypes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BlockStartResult)(2)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BlockStartResult = LiteralKit([0, 1, 2]).pipe(
  $I.annoteSchema("BlockStartResult", { description: "The numeric verdicts returned by a block start scanner." })
);

/** The block start verdict domain derived from its schema.
 * @category type-level
 * @since 0.0.0
 */
export type BlockStartResult = typeof BlockStartResult.Type;

/**
 * The parser surface a construct may drive: upstream's scanner state and the
 * handful of parser methods its `blockStarts` functions call.
 *
 * **Details**
 *
 * Mutable engine state (D-42): an abstract class the block parser extends,
 * so constructs program against it and never import the parser (which would
 * close an import cycle).
 *
 * @category models
 * @since 0.0.0
 */
export abstract class BlockScanner {
  /** Open a block of `type` as a child of the tip, starting at `offsetInLine`. */
  abstract readonly addChild: {
    (type: BlockType, offsetInLine: number): BlockNode;
    (offsetInLine: number): (type: BlockType) => BlockNode;
  };
  /** Append the rest of the current line to the tip's content. */
  abstract addLine(): void;
  /** Jump the scan position to `nextNonspace`. */
  abstract advanceNextNonspace(): void;
  /** Advance `count` characters, or `count` columns when `columns` is true. */
  abstract readonly advanceOffset: {
    (count: number, columns?: boolean): void;
    (columns?: boolean): (count: number) => void;
  };
  /** Whether every open block matched this line. */
  abstract readonly allClosed: boolean;
  /** Whether the rest of the line is blank. */
  abstract readonly blank: boolean;
  /** Finalize every open block that failed to match this line. */
  abstract closeUnmatchedBlocks(): void;
  /** Tab-expanded column of the scan position. */
  abstract readonly column: number;
  /** The current line, terminator stripped. */
  abstract readonly currentLine: string;
  /** Close `block`, ending it at the end of `lineNumber`. */
  abstract readonly finalizeBlock: {
    (block: BlockNode, lineNumber: number): void;
    (lineNumber: number): (block: BlockNode) => void;
  };
  /**
   * Recompute `nextNonspace`, `nextNonspaceColumn`, `indent`, `indented` and
   * `blank` from the scan position.
   *
   * **Details**
   *
   * Upstream's `S_find_first_nonspace`, which the line loop runs before each
   * pass over the block starts and `add_text_to_container` runs again before
   * it decides what to do with the rest of the line. A construct that
   * consumes characters and then STOPS the start scan has to re-establish it
   * itself, because the loop it exited will not.
   */
  abstract findNextNonspace(): void;
  /** Columns of indentation between the scan position and `nextNonspace`. */
  abstract readonly indent: number;
  /** Whether `indent` reaches the code-indent threshold. */
  abstract readonly indented: boolean;
  /**
   * Open a closed block of `type` as `block`'s immediately preceding sibling,
   * without disturbing the tip.
   *
   * **Details**
   *
   * cmark-gfm's `cmark_node_insert_before` in the table header reclaim: when
   * a paragraph becomes a table, the lines above the header row have to go
   * back into the tree as the paragraph they were.
   */
  abstract readonly insertBefore: {
    (block: BlockNode, type: BlockType): BlockNode;
    (type: BlockType): (block: BlockNode) => BlockNode;
  };
  /** 1-based number of the current line. */
  abstract readonly lineNumber: number;
  /** Absolute source offset of `currentLine[0]`. */
  abstract readonly lineStart: number;
  /** Character index of the next non-whitespace character. */
  abstract readonly nextNonspace: number;
  /** Tab-expanded column of that character. */
  abstract readonly nextNonspaceColumn: number;
  /** Character index into `currentLine` of the scan position. */
  abstract readonly offset: number;
  /**
   * Swap `block` for a fresh block of `type` carrying its position, content
   * and segments, and make it the tip. Upstream's
   * `insertAfter` + `unlink` pair in the setext-heading start.
   */
  abstract readonly replaceBlock: {
    (block: BlockNode, type: BlockType): BlockNode;
    (type: BlockType): (block: BlockNode) => BlockNode;
  };
  /**
   * Override the length the next `finalize` treats the current line as
   * having — upstream's `parser.lastLineLength` write in the closing-fence
   * path, where the block ends mid-line rather than at its end.
   */
  abstract setLastLineLength(length: number): void;
  /**
   * Rewind the scan position, upstream's direct `parser.offset`/
   * `parser.column` assignment in `parseListMarker`. Deliberately does NOT
   * clear the partially-consumed-tab flag: upstream's assignment does not
   * either, and the caller re-establishes it on the next `advanceOffset`.
   */
  abstract readonly setScanPosition: {
    (offset: number, column: number): void;
    (column: number): (offset: number) => void;
  };
  /** The deepest open block. */
  abstract readonly tip: BlockNode;
}

/**
 * What a construct materializes into: flow content, a list item, a table row
 * or cell, or the root.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MaterializedBlock = Root | FlowContent | ListItem | TableRow | TableCell;

/**
 *  Services a construct needs to turn its {@link BlockNode} into a real node.
 *
 * @category models
 * @since 0.0.0
 */
export interface MaterializeContext {
  /** Trim and prepare a leaf's accumulated content for the inline pass. */
  inlineSlice(block: BlockNode): PreparedInline;
  /** Build a {@link Position} from an absolute source range. */
  readonly position: {
    (startOffset: number, endOffset: number): Position;
    (endOffset: number): (startOffset: number) => Position;
  };
  /** Record a leaf's raw inline text against the node that will own it. */
  readonly registerInline: {
    (parent: InlineHost, prepared: PreparedInline): void;
    (prepared: PreparedInline): (parent: InlineHost) => void;
  };
}

/**
 * The behaviour of one block construct: upstream's entry in the `blocks`
 * table, plus the `materialize` step this port adds (upstream renders its own
 * node type, so it has no equivalent).
 *
 * @category models
 * @since 0.0.0
 */
export interface BlockBehaviour {
  /** Whether a block of `child` may be opened inside this one. */
  canContain(child: BlockType): boolean;
  /** Whether this block continues on the scanner's current line. */
  readonly continue: {
    (scanner: BlockScanner, block: BlockNode): BlockContinueResult;
    (block: BlockNode): (scanner: BlockScanner) => BlockContinueResult;
  };
  /** Post-processing when the block closes. */
  readonly finalize?: {
    (scanner: BlockScanner, block: BlockNode): void;
    (block: BlockNode): (scanner: BlockScanner) => void;
  };
  /**
   * Build the immutable node. Returning `undefined` drops the block from the
   * tree (an emptied paragraph, for instance).
   */
  readonly materialize: {
    (
      block: BlockNode,
      children: ReadonlyArray<MaterializedBlock>,
      context: MaterializeContext
    ): MaterializedBlock | undefined;
    (
      children: ReadonlyArray<MaterializedBlock>,
      context: MaterializeContext
    ): (block: BlockNode) => MaterializedBlock | undefined;
  };
}

/**
 * Lift a leaf construct's build step into a {@link BlockBehaviour} `materialize`.
 *
 * **Details**
 *
 * A leaf never has materialized children, so the build step sees only the
 * block and the context; the children argument is accepted and ignored.
 *
 * **Example** (Materialize a leaf without reading its children)
 *
 * ```ts
 * import { leafMaterializer } from "@beep/markdown/internal/blockTypes"
 *
 * const materialize = leafMaterializer(() => undefined)
 * console.log(typeof materialize) // function
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const leafMaterializer = (
  build: (block: BlockNode, context: MaterializeContext) => MaterializedBlock | undefined
): BlockBehaviour["materialize"] =>
  dual(
    3,
    (
      block: BlockNode,
      _children: ReadonlyArray<MaterializedBlock>,
      context: MaterializeContext
    ): MaterializedBlock | undefined => build(block, context)
  );

/**
 * Lift an inline host's build step into a {@link BlockBehaviour} `materialize`.
 *
 * **Details**
 *
 * Prepares the block's inline text, builds the host node from it, and
 * registers the node as the owner of that text — the seam every inline host
 * (paragraph, heading, table cell) goes through. A build step that returns
 * `undefined` drops the block and registers nothing.
 *
 * **Example** (Materialize an inline host)
 *
 * ```ts
 * import { inlineHostMaterializer } from "@beep/markdown/internal/blockTypes"
 *
 * const materialize = inlineHostMaterializer(() => undefined)
 * console.log(typeof materialize) // function
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const inlineHostMaterializer = (
  build: (block: BlockNode, inline: PreparedInline, context: MaterializeContext) => InlineHost | undefined
): BlockBehaviour["materialize"] =>
  leafMaterializer((block, context) => {
    const inline = context.inlineSlice(block);
    const node = build(block, inline, context);
    if (node !== undefined) {
      context.registerInline(node, inline);
    }
    return node;
  });

/**
 * Lift a container construct's build step into a {@link BlockBehaviour} `materialize`.
 *
 * **Example** (Count a container's materialized children)
 *
 * ```ts
 * import { containerMaterializer } from "@beep/markdown/internal/blockTypes"
 *
 * const materialize = containerMaterializer((_block, children) => children[0])
 * console.log(typeof materialize) // function
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const containerMaterializer = (
  build: (
    block: BlockNode,
    children: ReadonlyArray<MaterializedBlock>,
    context: MaterializeContext
  ) => MaterializedBlock | undefined
): BlockBehaviour["materialize"] => dual(3, build);

/**
 * The `continue` of a construct that never spans a second line (a heading, a
 * thematic break, a split-out definition): every line closes it.
 *
 * **Example** (Close a single-line block on the next line)
 *
 * ```ts
 * import { neverContinues } from "@beep/markdown/internal/blockTypes"
 * import { headingConstruct } from "@beep/markdown/internal/blocks/atxHeading"
 *
 * console.log(headingConstruct.continue === neverContinues) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const neverContinues: BlockBehaviour["continue"] = dual(
  2,
  (_scanner: BlockScanner, _block: BlockNode): BlockContinueResult => 1
);

/**
 * The `continue` of a container that every line continues (the document and
 * a list, whose items do the matching): no line closes it.
 *
 * **Example** (Keep a list open)
 *
 * ```ts
 * import { alwaysContinues } from "@beep/markdown/internal/blockTypes"
 * import { listConstruct } from "@beep/markdown/internal/blocks/list"
 *
 * console.log(listConstruct.continue === alwaysContinues) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const alwaysContinues: BlockBehaviour["continue"] = dual(
  2,
  (_scanner: BlockScanner, _block: BlockNode): BlockContinueResult => 0
);

/**
 * The `canContain` of a construct that holds no child blocks.
 *
 * **Example** (Refuse every child)
 *
 * ```ts
 * import { containsNothing } from "@beep/markdown/internal/blockTypes"
 *
 * console.log(containsNothing("paragraph")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const containsNothing = (_child: BlockType): boolean => false;

/**
 * The `canContain` of a flow container (the document, a blockquote, a list
 * item, a footnote definition): any block but a bare list item.
 *
 * **Example** (Admit flow content but not a bare item)
 *
 * ```ts
 * import { containsFlow } from "@beep/markdown/internal/blockTypes"
 *
 * console.log(containsFlow("paragraph"), containsFlow("listItem")) // true false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const containsFlow = (child: BlockType): boolean => child !== "listItem";

/**
 * One block construct: the block type it builds, whether it absorbs line
 * content (upstream's `acceptsLines`), and its {@link BlockBehaviour}.
 *
 * **Details**
 *
 * An engine table entry (D-42), built once per construct module.
 *
 * **Example** (Inspect a construct's line absorption)
 *
 * ```ts
 * import { paragraphConstruct } from "@beep/markdown/internal/blocks/paragraph"
 *
 * console.log(paragraphConstruct.type, paragraphConstruct.acceptsLines) // paragraph true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlockConstruct {
  /** Whether the construct absorbs line content (upstream's `acceptsLines`). */
  readonly acceptsLines: boolean;
  readonly canContain: (child: BlockType) => boolean;
  readonly continue: BlockBehaviour["continue"];
  readonly finalize: BlockBehaviour["finalize"];
  readonly materialize: BlockBehaviour["materialize"];
  readonly type: BlockType;

  constructor(type: BlockType, acceptsLines: boolean, behaviour: BlockBehaviour) {
    this.type = type;
    this.acceptsLines = acceptsLines;
    this.canContain = behaviour.canContain;
    this.continue = behaviour.continue;
    this.finalize = behaviour.finalize;
    this.materialize = behaviour.materialize;
  }
}

/**
 *  Narrow materialized children to the flow content most constructs contain.
 *
 * **Details**
 *
 * Nonmatching nodes are omitted. Matching nodes keep their input order and
 * object identity; the input collection is unchanged.
 *
 * **Example** (Select paragraph content from mixed children)
 *
 * ```ts
 * import { flowChildren } from "@beep/markdown/internal/blockTypes";
 * import { ListItem, Paragraph } from "@beep/markdown/MarkdownNode";
 *
 * const paragraph = Paragraph.make({ children: [] });
 * const item = ListItem.make({ children: [] });
 * const children = flowChildren([item, paragraph]);
 *
 * console.log(children.length, children[0]?.type) // 1 paragraph
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const flowChildren = (children: ReadonlyArray<MaterializedBlock>): ReadonlyArray<FlowContent> =>
  A.filter(
    children,
    (child): child is FlowContent =>
      child.type !== "root" && child.type !== "listItem" && child.type !== "tableRow" && child.type !== "tableCell"
  );

/**
 *  Narrow materialized children to the list items a list contains.
 *
 * **Details**
 *
 * Nonmatching nodes are omitted. Matching nodes keep their input order and
 * object identity; the input collection is unchanged.
 *
 * **Example** (Select list items from mixed children)
 *
 * ```ts
 * import { listItemChildren } from "@beep/markdown/internal/blockTypes";
 * import { ListItem, Paragraph } from "@beep/markdown/MarkdownNode";
 *
 * const paragraph = Paragraph.make({ children: [] });
 * const item = ListItem.make({ children: [] });
 * const children = listItemChildren([paragraph, item]);
 *
 * console.log(children.length, children[0]?.type) // 1 listItem
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const listItemChildren = (children: ReadonlyArray<MaterializedBlock>): ReadonlyArray<ListItem> =>
  A.filter(children, (child): child is ListItem => child.type === "listItem");

/**
 *  Narrow materialized children to the rows a table contains.
 *
 * **Details**
 *
 * Nonmatching nodes are omitted. Matching nodes keep their input order and
 * object identity; the input collection is unchanged.
 *
 * **Example** (Select table rows from mixed children)
 *
 * ```ts
 * import { tableRowChildren } from "@beep/markdown/internal/blockTypes";
 * import { TableCell, TableRow } from "@beep/markdown/MarkdownNode";
 *
 * const cell = TableCell.make({ children: [] });
 * const row = TableRow.make({ children: [cell] });
 * const children = tableRowChildren([cell, row]);
 *
 * console.log(children.length, children[0]?.type) // 1 tableRow
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const tableRowChildren = (children: ReadonlyArray<MaterializedBlock>): ReadonlyArray<TableRow> =>
  A.filter(children, (child): child is TableRow => child.type === "tableRow");

/**
 *  Narrow materialized children to the cells a table row contains.
 *
 * **Details**
 *
 * Nonmatching nodes are omitted. Matching nodes keep their input order and
 * object identity; the input collection is unchanged.
 *
 * **Example** (Select table cells from mixed children)
 *
 * ```ts
 * import { tableCellChildren } from "@beep/markdown/internal/blockTypes";
 * import { TableCell, TableRow } from "@beep/markdown/MarkdownNode";
 *
 * const cell = TableCell.make({ children: [] });
 * const row = TableRow.make({ children: [cell] });
 * const children = tableCellChildren([row, cell]);
 *
 * console.log(children.length, children[0]?.type) // 1 tableCell
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const tableCellChildren = (children: ReadonlyArray<MaterializedBlock>): ReadonlyArray<TableCell> =>
  A.filter(children, (child): child is TableCell => child.type === "tableCell");

/**
 * A block start's trigger: try to open a block at the scanner's position.
 *
 * @category models
 * @since 0.0.0
 */
export interface BlockStartTrigger {
  (scanner: BlockScanner, container: BlockNode): BlockStartResult;
  (container: BlockNode): (scanner: BlockScanner) => BlockStartResult;
}

/**
 * One entry of a dialect's ordered block-start table.
 *
 * **Example** (Inspect a block start's diagnostic name)
 *
 * ```ts
 * import { atxHeadingStart } from "@beep/markdown/internal/blocks/atxHeading"
 *
 * console.log(atxHeadingStart.name) // atxHeading
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlockStart {
  /** Diagnostic name; the table's order is what the algorithm depends on. */
  readonly name: string;
  readonly trigger: BlockStartTrigger;

  constructor(name: string, trigger: BlockStartTrigger) {
    this.name = name;
    this.trigger = trigger;
  }
}

/**
 * The line loop's fast-path escape hatch (see {@link BlockDialect}): whether a
 * dialect construct may start at the scanner's `nextNonspace` even though the
 * CommonMark pre-filter says no block can.
 *
 * @category models
 * @since 0.0.0
 */
export interface MayStartBlock {
  (scanner: BlockScanner, container: BlockNode): boolean;
  (container: BlockNode): (scanner: BlockScanner) => boolean;
}

class MissingBlockConstructError extends S.TaggedError<MissingBlockConstructError, { readonly brand: unique symbol }>(
  $I`MissingBlockConstructError`
)(
  "MissingBlockConstructError",
  {
    message: S.String.pipe(
      $I.annoteKey("MissingBlockConstructError.message", {
        description: "Names the block type the dialect has no construct for.",
      })
    ),
  },
  $I.annoteError<MissingBlockConstructError>("MissingBlockConstructError", {
    description: "A block of a type the dialect registers no construct for was reached.",
  })
) {}

/**
 * A dialect: a construct table plus an ordered block-start table, nothing more.
 *
 * **Details**
 *
 * The construct table is keyed by block type with direct property lookup:
 * the line loop consults it for every open container on every line, so it
 * allocates nothing per lookup.
 *
 * `mayStartBlock` is an escape hatch from the line loop's fast path.
 * commonmark.js skips the whole block-start table when the line cannot begin
 * any CommonMark construct (`reMaybeSpecial`). cmark-gfm has no such filter,
 * so a dialect whose constructs start on other characters — a GFM table row
 * starts on anything at all — says so here, and the loop tries its starts
 * anyway. Absent means the CommonMark filter is the whole truth.
 *
 * **Example** (Look up a dialect's paragraph construct)
 *
 * ```ts
 * import { blockDialect } from "@beep/markdown/internal/blockRegistry"
 *
 * console.log(blockDialect("commonmark").construct("paragraph").acceptsLines) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlockDialect {
  readonly constructs: ReadonlyArray<BlockConstruct>;
  readonly mayStartBlock: MayStartBlock | undefined;
  readonly starts: ReadonlyArray<BlockStart>;
  private readonly table: Partial<Record<BlockType, BlockConstruct>>;

  constructor(
    constructs: ReadonlyArray<BlockConstruct>,
    starts: ReadonlyArray<BlockStart>,
    mayStartBlock?: MayStartBlock
  ) {
    const table: Partial<Record<BlockType, BlockConstruct>> = {};
    for (const construct of constructs) {
      table[construct.type] = construct;
    }
    this.constructs = constructs;
    this.starts = starts;
    this.mayStartBlock = mayStartBlock;
    this.table = table;
  }

  /**
   * The construct registered for `type`.
   *
   * **Gotchas**
   *
   * A type the dialect does not register is a wiring defect, so the lookup
   * throws rather than returning an `Option` the line loop would allocate on
   * every call.
   *
   * **Example** (Look up the document construct)
   *
   * ```ts
   * import { blockDialect } from "@beep/markdown/internal/blockRegistry"
   *
   * console.log(blockDialect("gfm").construct("document").type) // document
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  construct(type: BlockType): BlockConstruct {
    const construct = this.table[type];
    if (construct === undefined) {
      throw MissingBlockConstructError.make({
        message: `block parser: no construct registered for block type ${type}`,
      });
    }
    return construct;
  }
}

/**
 *  Open a fresh {@link BlockNode}.
 *
 * **Details**
 *
 * The new block is open, has no parent or children, and starts with empty
 * content, segments and construct data. Its end position initially equals
 * its start position. Depth defaults to zero; the curried form accepts the
 * source position before the block type.
 *
 * **Example** (Open a paragraph at its source position)
 *
 * ```ts
 * import { makeBlockNode } from "@beep/markdown/internal/blockTypes";
 *
 * const block = makeBlockNode("paragraph", 12, 3, 1);
 *
 * console.log(block.type, block.open, block.startOffset, block.depth) // paragraph true 12 1
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeBlockNode: {
  (type: BlockType, startOffset: number, startLine: number, depth?: number): BlockNode;
  (startOffset: number, startLine: number, depth?: number): (type: BlockType) => BlockNode;
} = dual(
  (args) => P.isString(args[0]),
  (type: BlockType, startOffset: number, startLine: number, depth = 0): BlockNode =>
    new BlockNode(type, startOffset, startLine, depth)
);
