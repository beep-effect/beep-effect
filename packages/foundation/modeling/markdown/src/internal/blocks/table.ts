// Ported from cmark-gfm@0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
// Copyright (c) 2014, John MacFarlane; Copyright (c) 2015, GitHub, Inc.
// License: BSD-2-Clause
//
// `extensions/table.c` plus the row scanners in `extensions/ext_scanners.re`:
// GFM tables, as three block constructs (`table`, `tableRow`, `tableCell`) and
// two block starts.
//
// Four things about upstream's design drive this port, and none of them is
// obvious from the GFM spec's prose:
//
// 1. **A table is a promoted paragraph.** Upstream never opens a table on the
//    header row — it opens a paragraph, and when the NEXT line scans as a
//    delimiter row it mutates that paragraph node into a table in place
//    (`cmark_node_set_type`). This port does the same through the scanner's
//    `replaceBlock`, which is the same move the setext-heading start makes.
// 2. **The header may be one line of a longer paragraph.** `row_from_string`
//    walks the paragraph's whole accumulated content and, every time it hits a
//    newline that is not the end of that content, throws away the cells it has
//    collected and restarts after it (`row->paragraph_offset`). Whatever lies
//    before the final line is reclaimed as a paragraph and inserted ahead of
//    the table. That is why a table can interrupt a paragraph with no blank
//    line between them.
// 3. **A row is any non-blank line.** The row scanner accepts a line with no
//    pipes at all as a one-cell row, so a table absorbs the plain lines under
//    it (padded out to the header's column count) and only ends on a blank
//    line or on a line some other block start claims first. This is why both
//    table starts sit LAST in the GFM start table: upstream tries every core
//    construct before any extension, so `> quoted` under a table is a
//    blockquote and not a row.
// 4. **Cells are split before inlines are parsed.** `\|` is unescaped into a
//    literal pipe by the splitter itself, so a bare pipe inside a code span
//    still splits cells and an escaped one inside a code span renders as a
//    pipe. The unescape shortens the cell text, so the segment table has to be
//    rebuilt around the dropped backslashes — that is what keeps a cell's
//    source offsets honest (`segments.ts`).
//
// Positions: a cell spans its TRIMMED content, delimiter pipes and surrounding
// whitespace excluded; an empty or autocompleted cell is a zero-width point
// where its content would have begun. A row spans its source line, and the
// table spans from its header row to the end of its last row.

import { $MarkdownId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  BlockConstruct,
  BlockStart,
  containerMaterializer,
  containsNothing,
  inlineHostMaterializer,
  neverContinues,
  RawInlineSegment,
  TableData,
  tableCellChildren,
  tableRowChildren,
} from "../blockTypes.ts";
import { trustedNode } from "../nodes.ts";
import { unitAt } from "../patterns.ts";
import { sliceWithSegments } from "../segments.ts";
import { ESCAPABLE } from "../unescape.ts";
import type { BlockContinueResult, BlockNode, BlockScanner, BlockStartResult } from "../blockTypes.ts";
import type { Table, TableAlign, TableCell, TableRow } from "../nodes.ts";

const $I = $MarkdownId.create("internal/blocks/table");

/**
 * Upstream's `MAX_AUTOCOMPLETED_CELLS`: the ceiling on cells the parser
 * invents to pad short rows, which is what stops a wide header followed by a
 * million one-character lines from allocating unboundedly.
 */
const MAX_AUTOCOMPLETED_CELLS = 0x80000;

const reEscapable = new RegExp(`^${ESCAPABLE}`);

/** re2c's `spacechar` class: the delimiter-row grammar's idea of whitespace. */
const isSpaceChar = (char: string): boolean => char === " " || char === "\t" || char === "\v" || char === "\f";

/**
 * The text a row is scanned out of, with the source provenance of every
 * character in it.
 *
 * **Details**
 *
 * For a delimiter or body row that is one source line; for a header row it is
 * a paragraph's whole accumulated content, which may be several.
 *
 * **Example** (Validate RowSource data)
 *
 * ```ts
 * import { RowSource } from "@beep/markdown/internal/blocks/table";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(RowSource)({ text: "| guide |\n", segments: [] })); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RowSource extends S.Opaque<RowSource, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.pipe(
      $I.annoteKey("RowSource.text", { description: "Newline-terminated row text, as expected by the scanner." })
    ),
    segments: S.Array(RawInlineSegment).pipe(
      $I.annoteKey("RowSource.segments", {
        description: "Source provenance for the surviving characters of the row text.",
      })
    ),
  }).pipe(
    $I.annoteSchema("RowSource", {
      description: "Row text and its source provenance, including paragraph text reclaimed as a header.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RowSource {
  /**
   * The plain row-source record the scanners read: a constructed {@link RowSource} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RowSource.Encoded;
}

/** One cell's span in a {@link RowSource}, before unescaping and trimming.
 *
 * **Example** (Validate RawCell data)
 *
 * ```ts
 * import { RawCell } from "@beep/markdown/internal/blocks/table";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(RawCell)({ start: 0, contentStart: 2, end: 8 })); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RawCell extends S.Opaque<RawCell, { readonly brand: unique symbol }>()(
  S.Struct({
    start: S.Finite.pipe(
      $I.annoteKey("RawCell.start", { description: "Cell start in the row source, just past its opening pipe." })
    ),
    contentStart: S.Finite.pipe(
      $I.annoteKey("RawCell.contentStart", { description: "First content offset after the cell's leading whitespace." })
    ),
    end: S.Finite.pipe($I.annoteKey("RawCell.end", { description: "Exclusive end of the cell in the row source." })),
  }).pipe($I.annoteSchema("RawCell", { description: "A cell's source boundaries before unescaping and trimming." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RawCell {
  /**
   * The plain cell-boundary record the row scanner emits: a constructed {@link RawCell} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RawCell.Encoded;
}

/** A scanned row: its cells, and where in the source its line began.
 *
 * **Example** (Validate ScannedRow data)
 *
 * ```ts
 * import { ScannedRow } from "@beep/markdown/internal/blocks/table";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ScannedRow)({ cells: [], paragraphOffset: 0, complete: true })); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ScannedRow extends S.Opaque<ScannedRow, { readonly brand: unique symbol }>()(
  S.Struct({
    cells: S.Array(RawCell).pipe($I.annoteKey("ScannedRow.cells", { description: "Cell boundaries in source order." })),
    paragraphOffset: S.Finite.pipe(
      $I.annoteKey("ScannedRow.paragraphOffset", {
        description: "Row start within the source; nonzero for a reclaimed paragraph header.",
      })
    ),
    complete: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("ScannedRow.complete", {
        description: "When present, whether the scan consumed the entire row source.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ScannedRow", { description: "Scanned cell boundaries and the row's paragraph-relative start." })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScannedRow {
  /**
   * The plain scanned-row record: a constructed {@link ScannedRow} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ScannedRow.Encoded;
}

// --- upstream's scanners --------------------------------------------------
//
// Every scanner reads one character at a time through `unitAt`, an index read
// that allocates nothing and yields `""` past the end of the text.

/** Skip a run of re2c `spacechar`s starting at `from`; returns the index after it. */
const skipSpaceChars = (text: string, from: number): number => {
  let index = from;
  while (isSpaceChar(unitAt(text, index))) {
    index += 1;
  }
  return index;
};

/** `_scan_table_cell_end`: `[|] spacechar*`, the pipe between two cells. */
const scanCellEnd: {
  (text: string, from: number): number;
  (from: number): (text: string) => number;
} = dual(2, (text: string, from: number): number =>
  unitAt(text, from) === "|" ? skipSpaceChars(text, from + 1) - from : 0
);

/**
 * `_scan_table_cell`: `(escaped_char|[^|\r\n])+`.
 *
 * **Details**
 *
 * A backslash before ASCII punctuation takes the punctuation with it, which is
 * the whole mechanism behind escaped pipes: `\|` is one cell character, a bare
 * `|` ends the cell.
 */
const scanCell: {
  (text: string, from: number): number;
  (from: number): (text: string) => number;
} = dual(2, (text: string, from: number): number => {
  let index = from;
  let char = unitAt(text, index);
  while (char !== "" && char !== "|" && char !== "\r" && char !== "\n") {
    index += char === "\\" && reEscapable.test(unitAt(text, index + 1)) ? 2 : 1;
    char = unitAt(text, index);
  }
  return index - from;
});

/** `_scan_table_row_end`: `spacechar* newline`. */
const scanRowEnd: {
  (text: string, from: number): number;
  (from: number): (text: string) => number;
} = dual(2, (text: string, from: number): number => {
  // scanCell and scanCellEnd already consumed all whitespace before this offset.
  const index = unitAt(text, from) === "\r" ? from + 1 : from;
  return unitAt(text, index) === "\n" ? index + 1 - from : 0;
});

/**
 * One delimiter marker, `spacechar* [:]? [-]+ [:]? spacechar*`, at `from`.
 * Returns the index after it, or `-1` when no dash run is there.
 */
const scanDelimiterMarker = (line: string, from: number): number => {
  let index = skipSpaceChars(line, from);
  if (unitAt(line, index) === ":") {
    index += 1;
  }
  const dashesStart = index;
  while (unitAt(line, index) === "-") {
    index += 1;
  }
  if (index === dashesStart) {
    return -1;
  }
  if (unitAt(line, index) === ":") {
    index += 1;
  }
  return skipSpaceChars(line, index);
};

/**
 * `_scan_table_start`: `[|]? marker ([|] marker)* [|]? spacechar* newline`,
 * where a marker is `spacechar* [:]? [-]+ [:]? spacechar*`.
 *
 * **Details**
 *
 * Hand-rolled rather than a regular expression: the grammar nests two
 * unbounded whitespace runs inside a repetition, which is exactly the shape a
 * backtracking engine goes exponential on, and the pathological corpus feeds
 * this scanner adversarial delimiter rows.
 */
const scanDelimiterRowLine: {
  (line: string, from: number): boolean;
  (from: number): (line: string) => boolean;
} = dual(2, (line: string, from: number): boolean => {
  let index = unitAt(line, from) === "|" ? from + 1 : from;
  for (;;) {
    index = scanDelimiterMarker(line, index);
    if (index === -1) {
      return false;
    }
    if (unitAt(line, index) !== "|") {
      // No pipe left: the row ends here, and only if the line does too.
      return index >= line.length;
    }
    index += 1;
    // A pipe with nothing but whitespace after it is the trailing pipe.
    if (skipSpaceChars(line, index) >= line.length) {
      return true;
    }
  }
});

// --- upstream's `row_from_string` -----------------------------------------

/**
 * Walk a cell's start back over the whitespace the previous pipe consumed, so
 * the cell begins where its column does. Upstream's `internal_offset` is that
 * distance; here the two positions are kept side by side instead.
 */
const cellStart = (text: string, offset: number, paragraphOffset: number): number => {
  let start = offset;
  while (start > paragraphOffset && unitAt(text, start - 1) !== "|") {
    start -= 1;
  }
  return start;
};

/** The mutable state of one `row_from_string` scan (D-42). */
class RowScan {
  cells: RawCell.Encoded[] = [];
  expectMoreCells = true;
  offset: number;
  paragraphOffset = 0;
  readonly text: string;

  constructor(text: string) {
    this.text = text;
    this.offset = scanCellEnd(text, 0);
  }

  /** Scan one cell and the pipe after it; returns whether a pipe followed. */
  scanCellAndPipe(): boolean {
    const cellMatched = scanCell(this.text, this.offset);
    const pipeMatched = scanCellEnd(this.text, this.offset + cellMatched);
    if (cellMatched > 0 || pipeMatched > 0) {
      this.cells.push({
        start: cellStart(this.text, this.offset, this.paragraphOffset),
        contentStart: this.offset,
        end: this.offset + cellMatched,
      });
    }
    this.offset += cellMatched + pipeMatched;
    return pipeMatched > 0;
  }

  /**
   * At a row end: a newline that is not the end of the text means everything
   * up to here is paragraph, and the row starts again after it.
   */
  endRow(): void {
    const rowEnd = scanRowEnd(this.text, this.offset);
    this.offset += rowEnd;
    this.expectMoreCells = rowEnd > 0 && this.offset !== this.text.length;
    if (this.expectMoreCells) {
      this.paragraphOffset = this.offset;
      this.cells = [];
      this.offset += scanCellEnd(this.text, this.offset);
    }
  }
}

/**
 * Scan `source` as one table row, upstream's `row_from_string`.
 *
 * **Details**
 *
 * Records whether the whole text was consumed, alongside the scanned cells.
 * Delimiter rows already satisfy the grammar; other callers validate this
 * result through `rowFromSource`.
 */
const scanRowSource = (source: RowSource.Encoded): ScannedRow.Encoded => {
  const scan = new RowScan(source.text);
  while (scan.offset < scan.text.length && scan.expectMoreCells) {
    if (!scan.scanCellAndPipe()) {
      scan.endRow();
    }
  }
  return { cells: scan.cells, paragraphOffset: scan.paragraphOffset, complete: scan.offset === scan.text.length };
};

const rowFromSource = (source: RowSource.Encoded): ScannedRow.Encoded | undefined => {
  const row = scanRowSource(source);
  return row.complete === true && row.cells.length > 0 ? row : undefined;
};

// --- cell content ---------------------------------------------------------

/** Text and provenance for a run of a {@link RowSource}, escapes dropped.
 *
 * **Example** (Validate CellContent data)
 *
 * ```ts
 * import { CellContent } from "@beep/markdown/internal/blocks/table";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CellContent)({ text: "guide", segments: [] })); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CellContent extends S.Opaque<CellContent, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.pipe(
      $I.annoteKey("CellContent.text", {
        description: "Cell text after dropping backslashes that escape delimiter pipes.",
      })
    ),
    segments: S.Array(RawInlineSegment).pipe(
      $I.annoteKey("CellContent.segments", { description: "Source provenance rebased to the unescaped cell text." })
    ),
  }).pipe(
    $I.annoteSchema("CellContent", {
      description: "Unescaped cell text with provenance for every surviving character.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CellContent {
  /**
   * The plain cell-content record: a constructed {@link CellContent} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CellContent.Encoded;
}

/**
 * The indices of the backslashes `cellContent` drops in `[from, to)`: each
 * one directly before a `|` that is itself inside the range.
 *
 * **Details**
 *
 * Upstream scans left to right and steps over the pipe it just unescaped, so
 * in `\\|` the SECOND backslash is the one that escapes: this is a byte loop,
 * not an understanding of which backslashes are themselves escaped. The
 * lookahead stops at `to`, because past it lies the delimiter pipe that ended
 * the cell and unescaping into it would eat a column boundary.
 */
const escapedPipeBackslashes = (text: string, from: number, to: number): ReadonlyArray<number> => {
  const drops: number[] = [];
  for (let index = from; index < to; index += 1) {
    if (unitAt(text, index) === "\\" && index + 1 < to && unitAt(text, index + 1) === "|") {
      drops.push(index);
      index += 1;
    }
  }
  return drops;
};

/**
 * Re-segments a row source's provenance around dropped characters (D-42
 * accumulator): `keep` copies the retained interval `[cursor, end)` into the
 * output, walking the ordered provenance runs once rather than rescanning
 * every preceding paragraph line per interval.
 */
class SegmentRebuilder {
  content = "";
  readonly segments: RawInlineSegment.Encoded[] = [];
  private index = 0;
  private readonly source: RowSource.Encoded;

  constructor(source: RowSource.Encoded) {
    this.source = source;
  }

  keep(cursor: number, end: number): void {
    const runs = this.source.segments;
    for (let segment = runs[this.index]; segment !== undefined; segment = runs[this.index]) {
      const segmentStart = segment.textOffset;
      const segmentEnd = segmentStart + segment.length;
      if (segmentStart >= end) {
        break;
      }
      this.copyOverlap(segment, cursor, end);
      if (segmentEnd > end) {
        break;
      }
      this.index += 1;
    }
    this.content += Str.slice(cursor, end)(this.source.text);
  }

  private copyOverlap(segment: RawInlineSegment.Encoded, cursor: number, end: number): void {
    const start = Math.max(segment.textOffset, cursor);
    const stop = Math.min(segment.textOffset + segment.length, end);
    if (stop > start) {
      this.segments.push({
        textOffset: this.content.length + start - cursor,
        sourceOffset: segment.sourceOffset + start - segment.textOffset,
        length: stop - start,
      });
    }
  }
}

/**
 * Cut `[from, to)` out of `source`, dropping the backslash of every `\|` in
 * it — upstream's `unescape_pipes` (see {@link escapedPipeBackslashes}).
 */
const cellContent: {
  (source: RowSource.Encoded, from: number, to: number): CellContent.Encoded;
  (from: number, to: number): (source: RowSource.Encoded) => CellContent.Encoded;
} = dual(3, (source: RowSource.Encoded, from: number, to: number): CellContent.Encoded => {
  const drops = escapedPipeBackslashes(source.text, from, to);
  if (drops.length === 0) {
    return { text: Str.slice(from, to)(source.text), segments: sliceWithSegments(source.segments, from, to) };
  }

  const rebuilder = new SegmentRebuilder(source);
  let cursor = from;
  for (const drop of [...drops, to]) {
    if (drop > cursor) {
      rebuilder.keep(cursor, drop);
    }
    cursor = drop + 1;
  }
  return { text: rebuilder.content, segments: rebuilder.segments };
});

/** The absolute source offset of `index` in a row source. */
const offsetAt: {
  (source: RowSource.Encoded, index: number, fallback: number): number;
  (index: number, fallback: number): (source: RowSource.Encoded) => number;
} = dual(3, (source: RowSource.Encoded, index: number, fallback: number): number => {
  for (const segment of source.segments) {
    if (index < segment.textOffset) {
      return segment.sourceOffset;
    }
    if (index <= segment.textOffset + segment.length) {
      return segment.sourceOffset + (index - segment.textOffset);
    }
  }
  const last = source.segments[source.segments.length - 1];
  return last === undefined ? fallback : last.sourceOffset + last.length;
});

// --- alignment ------------------------------------------------------------

/**
 * The alignment each delimiter cell declares: a leading colon means left, a
 * trailing colon right, both center, neither nothing.
 *
 * **Details**
 *
 * Upstream reads the first and last byte of the TRIMMED cell buffer, so the
 * whitespace the scanner allows around a marker never reaches this decision.
 */
const alignmentsOf: {
  (source: RowSource.Encoded, row: ScannedRow.Encoded): ReadonlyArray<TableAlign | null>;
  (row: ScannedRow.Encoded): (source: RowSource.Encoded) => ReadonlyArray<TableAlign | null>;
} = dual(
  2,
  (source: RowSource.Encoded, row: ScannedRow.Encoded): ReadonlyArray<TableAlign | null> =>
    A.map(row.cells, (cell) => {
      const text = Str.trim(Str.slice(cell.contentStart, cell.end)(source.text));
      const left = Str.startsWith(":")(text);
      const right = Str.endsWith(":")(text);
      if (left && right) {
        return "center";
      }
      if (left) {
        return "left";
      }
      if (right) {
        return "right";
      }
      return null;
    })
);

// --- building the block tree ----------------------------------------------

/** The row source for the current line, from `nextNonspace` to its end. */
const lineSource = (scanner: BlockScanner): RowSource.Encoded => {
  const text = Str.slice(scanner.nextNonspace)(scanner.currentLine);
  return {
    // The scanners want a newline terminator; the preprocessor strips it.
    // Appending it back costs one character at the end of the string and
    // keeps every index below it aligned with the source.
    text: `${text}\n`,
    segments: [{ textOffset: 0, sourceOffset: scanner.lineStart + scanner.nextNonspace, length: text.length }],
  };
};

/** The row source for a paragraph's accumulated content. */
const paragraphSource = (block: BlockNode): RowSource.Encoded => ({
  text: block.stringContent,
  segments: block.segments,
});

/**
 * Close `block` at `endOffset`.
 *
 * **Details**
 *
 * `finalizeBlock` is what moves the tip back up to the parent, but it dates
 * the block to the end of the last line the loop finished — which for a row
 * built inside a block start is the line before. The end is corrected here.
 */
const closeAt: {
  (scanner: BlockScanner, block: BlockNode, endOffset: number): void;
  (block: BlockNode, endOffset: number): (scanner: BlockScanner) => void;
} = dual(3, (scanner: BlockScanner, block: BlockNode, endOffset: number): void => {
  scanner.finalizeBlock(block, scanner.lineNumber);
  block.endLine = scanner.lineNumber;
  block.endOffset = endOffset;
});

/**
 * Build one row of `table` from `row`, as a `tableRow` block of `tableCell`
 * children, truncated or padded to the table's column count.
 */
const addRow: {
  (
    scanner: BlockScanner,
    data: TableData,
    source: RowSource.Encoded,
    row: ScannedRow.Encoded,
    rowStartOffset: number,
    rowEndOffset: number
  ): void;
  (
    data: TableData,
    source: RowSource.Encoded,
    row: ScannedRow.Encoded,
    rowStartOffset: number,
    rowEndOffset: number
  ): (scanner: BlockScanner) => void;
} = dual(
  6,
  (
    scanner: BlockScanner,
    data: TableData,
    source: RowSource.Encoded,
    row: ScannedRow.Encoded,
    rowStartOffset: number,
    rowEndOffset: number
  ): void => {
    const rowBlock = scanner.addChild("tableRow", rowStartOffset - scanner.lineStart);
    rowBlock.startOffset = rowStartOffset;

    const used = Math.min(row.cells.length, data.columns);
    for (const cell of A.take(row.cells, used)) {
      const start = offsetAt(source, cell.start, rowStartOffset);
      const cellBlock = scanner.addChild("tableCell", start - scanner.lineStart);
      cellBlock.startOffset = start;
      const content = cellContent(source, cell.contentStart, cell.end);
      cellBlock.stringContent = content.text;
      for (const segment of content.segments) {
        cellBlock.segments.push(segment);
      }
      closeAt(scanner, cellBlock, offsetAt(source, cell.end, start));
    }

    // Upstream's autocompleted cells: a row shorter than the header is padded
    // out with empty ones, each a zero-width point at the row's end.
    for (let index = used; index < data.columns; index += 1) {
      const cellBlock = scanner.addChild("tableCell", rowEndOffset - scanner.lineStart);
      cellBlock.startOffset = rowEndOffset;
      closeAt(scanner, cellBlock, rowEndOffset);
    }

    data.rows += 1;
    data.nonemptyCells += used;
    closeAt(scanner, rowBlock, rowEndOffset);
  }
);

// --- block starts ---------------------------------------------------------

/**
 * The header start: a delimiter row under a paragraph promotes that paragraph
 * into a table.
 *
 * **Details**
 *
 * Upstream's `try_opening_table_header`.
 *
 * **Example** (Identify the table header start)
 *
 * ```ts
 * import { tableHeaderStart } from "@beep/markdown/internal/blocks/table"
 *
 * console.log(tableHeaderStart.name) // tableHeader
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const tableHeaderStart = new BlockStart(
  "tableHeader",
  dual(2, (scanner: BlockScanner, container: BlockNode): BlockStartResult => {
    if (scanner.indented || container.type !== "paragraph" || container.data.tableVisited === true) {
      return 0;
    }
    if (!scanDelimiterRowLine(scanner.currentLine, scanner.nextNonspace)) {
      return 0;
    }

    const delimiterSource = lineSource(scanner);
    // The delimiter grammar guarantees a complete row with at least one cell.
    const delimiterRow = scanRowSource(delimiterSource);

    const headerSource = paragraphSource(container);
    const headerRow = rowFromSource(headerSource);
    if (headerRow === undefined || headerRow.cells.length !== delimiterRow.cells.length) {
      // Upstream's `CMARK_NODE__TABLE_VISITED`: the paragraph has been
      // offered a delimiter row and refused it, and re-offering it on
      // every later line is how a long paragraph becomes quadratic.
      container.data.tableVisited = true;
      return 0;
    }

    scanner.closeUnmatchedBlocks();

    const headerStart = offsetAt(headerSource, headerRow.paragraphOffset, container.startOffset);
    if (headerRow.paragraphOffset > 0) {
      // The lines above the header row were never a table; they go back
      // into the tree as the paragraph they were. Upstream unescapes
      // pipes in them too, so the reclaimed text is byte-identical to
      // what a cell would have held.
      const reclaimed = cellContent(headerSource, 0, headerRow.paragraphOffset);
      const paragraph = scanner.insertBefore(container, "paragraph");
      paragraph.stringContent = reclaimed.text;
      for (const segment of reclaimed.segments) {
        paragraph.segments.push(segment);
      }
      paragraph.endOffset = headerStart;
      paragraph.endLine = Math.max(scanner.lineNumber - 2, paragraph.startLine);
    }

    const table = scanner.replaceBlock(container, "table");
    table.stringContent = "";
    table.segments.length = 0;
    table.startOffset = headerStart;
    table.startLine = Math.max(scanner.lineNumber - 1, 1);
    const data = new TableData(alignmentsOf(delimiterSource, delimiterRow), headerRow.cells.length);
    table.data.tableData = data;

    // The header row belongs to the line ABOVE this one, so its position
    // comes from the paragraph content rather than the scanner's line.
    const headerEnd = offsetAt(headerSource, headerSource.text.length - 1, headerStart);
    addRow(scanner, data, headerSource, headerRow, headerStart, headerEnd);

    scanner.advanceOffset(scanner.currentLine.length - scanner.offset, false);
    return 2;
  })
);

/**
 * The row start: each non-blank line under an open table is a row.
 *
 * **Details**
 *
 * Upstream's `try_opening_table_row`. It sits after every core block start, so
 * a line that opens a blockquote, a list or a fence closes the table instead
 * of becoming a row.
 *
 * **Example** (Identify the table body row start)
 *
 * ```ts
 * import { tableRowStart } from "@beep/markdown/internal/blocks/table"
 *
 * console.log(tableRowStart.name) // tableRow
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const tableRowStart = new BlockStart(
  "tableRow",
  dual(2, (scanner: BlockScanner, container: BlockNode): BlockStartResult => {
    if (scanner.indented || scanner.blank || container.type !== "table") {
      return 0;
    }
    const data = container.data.tableData;
    if (data === undefined) {
      return 0;
    }
    if (data.columns * data.rows - data.nonemptyCells > MAX_AUTOCOMPLETED_CELLS) {
      return 0;
    }

    const source = lineSource(scanner);
    const row = rowFromSource(source);
    if (row === undefined) {
      return 0;
    }

    scanner.closeUnmatchedBlocks();
    const rowStart = scanner.lineStart + scanner.nextNonspace;
    addRow(scanner, data, source, row, rowStart, scanner.lineStart + scanner.currentLine.length);
    scanner.advanceOffset(scanner.currentLine.length - scanner.offset, false);
    return 2;
  })
);

// --- constructs -----------------------------------------------------------

/**
 * Contains table rows and continues for as long as lines scan as rows.
 *
 * **Example** (Check table child acceptance)
 *
 * ```ts
 * import { tableConstruct } from "@beep/markdown/internal/blocks/table"
 *
 * console.log(tableConstruct.canContain("tableRow")) // true
 * console.log(tableConstruct.canContain("paragraph")) // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const tableConstruct = new BlockConstruct("table", false, {
  canContain: (child) => child === "tableRow",
  continue: dual(2, (scanner: BlockScanner, _block: BlockNode): BlockContinueResult => {
    // Upstream's `matches`. A blank line yields no cells and so ends the
    // table, which is the only reason there is no explicit blank check.
    if (scanner.indented) {
      return 1;
    }
    return rowFromSource(lineSource(scanner)) === undefined ? 1 : 0;
  }),
  materialize: containerMaterializer((block, children, context) => {
    const rows = tableRowChildren(children);
    if (rows.length === 0) {
      return undefined;
    }
    return trustedNode<Table>({
      type: "table",
      align: block.data.tableData?.align ?? [],
      children: rows,
      position: context.position(block.startOffset, block.endOffset),
    });
  }),
});

/**
 * Contains table cells and is built and closed on the line it opens.
 *
 * **Example** (Check row child acceptance)
 *
 * ```ts
 * import { tableRowConstruct } from "@beep/markdown/internal/blocks/table"
 *
 * console.log(tableRowConstruct.canContain("tableCell")) // true
 * console.log(tableRowConstruct.canContain("tableRow")) // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const tableRowConstruct = new BlockConstruct("tableRow", false, {
  canContain: (child) => child === "tableCell",
  continue: neverContinues,
  materialize: containerMaterializer((block, children, context) =>
    trustedNode<TableRow>({
      type: "tableRow",
      children: tableCellChildren(children),
      position: context.position(block.startOffset, block.endOffset),
    })
  ),
});

/**
 * Hosts inline content inside the block pass's one non-leaf inline host, a table cell.
 *
 * **Details**
 *
 * Its content is the split, unescaped cell text with the source provenance of
 * every surviving character, so it goes through the same `inlineSlice` seam a
 * paragraph does — and inherits the trim, which is what makes the node's
 * position span the cell's content rather than its padding.
 *
 * **Example** (Check cell block child rejection)
 *
 * ```ts
 * import { tableCellConstruct } from "@beep/markdown/internal/blocks/table"
 *
 * console.log(tableCellConstruct.canContain("paragraph")) // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const tableCellConstruct = new BlockConstruct("tableCell", false, {
  canContain: containsNothing,
  continue: neverContinues,
  materialize: inlineHostMaterializer((_block, inline, context) =>
    trustedNode<TableCell>({
      type: "tableCell",
      children: inline.children,
      position: context.position(inline.startOffset, inline.endOffset),
    })
  ),
});
