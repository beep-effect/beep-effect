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

import * as Str from "effect/String";
import { Table, type TableAlign, TableCell, TableRow } from "../../MarkdownNode.ts";
import type {
	BlockConstruct,
	BlockNode,
	BlockScanner,
	BlockStart,
	RawInlineSegment,
	TableData,
} from "../blockTypes.ts";
import { tableCellChildren, tableRowChildren } from "../blockTypes.ts";
import { sliceWithSegments } from "../segments.ts";
import { ESCAPABLE } from "../unescape.ts";

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
 * For a delimiter or body row that is one source line; for a header row it is
 * a paragraph's whole accumulated content, which may be several.
 */
interface RowSource {
	/** Always newline-terminated, which is the form upstream's scanners expect. */
	readonly text: string;
	readonly segments: ReadonlyArray<RawInlineSegment>;
}

/** One cell's span in a {@link RowSource}, before unescaping and trimming. */
interface RawCell {
	/** Where the cell's content begins — just past the pipe that opened it. */
	readonly start: number;
	/** Where the scanner found content (`start` plus any leading whitespace). */
	readonly contentStart: number;
	/** One past the cell's last character. */
	readonly end: number;
}

/** A scanned row: its cells, and where in the source its line began. */
interface ScannedRow {
	readonly cells: ReadonlyArray<RawCell>;
	/**
	 * Index into the row source where the row's own line starts. Non-zero only
	 * for a header row reclaimed from a multi-line paragraph.
	 */
	readonly paragraphOffset: number;
}

// --- upstream's scanners --------------------------------------------------

/** `_scan_table_cell_end`: `[|] spacechar*`, the pipe between two cells. */
const scanCellEnd = (text: string, from: number): number => {
	if (text.charAt(from) !== "|") {
		return 0;
	}
	let index = from + 1;
	while (isSpaceChar(text.charAt(index))) {
		index += 1;
	}
	return index - from;
};

/**
 * `_scan_table_cell`: `(escaped_char|[^|\r\n])+`.
 *
 * A backslash before ASCII punctuation takes the punctuation with it, which is
 * the whole mechanism behind escaped pipes: `\|` is one cell character, a bare
 * `|` ends the cell.
 */
const scanCell = (text: string, from: number): number => {
	let index = from;
	while (index < text.length) {
		const char = text.charAt(index);
		if (char === "\\" && reEscapable.test(text.charAt(index + 1))) {
			index += 2;
			continue;
		}
		if (char === "|" || char === "\r" || char === "\n") {
			break;
		}
		index += 1;
	}
	return index - from;
};

/** `_scan_table_row_end`: `spacechar* newline`. */
const scanRowEnd = (text: string, from: number): number => {
	let index = from;
	while (isSpaceChar(text.charAt(index))) {
		index += 1;
	}
	if (text.charAt(index) === "\r") {
		index += 1;
	}
	if (text.charAt(index) !== "\n") {
		return 0;
	}
	return index + 1 - from;
};

/**
 * `_scan_table_start`: `[|]? marker ([|] marker)* [|]? spacechar* newline`,
 * where a marker is `spacechar* [:]? [-]+ [:]? spacechar*`.
 *
 * Hand-rolled rather than a regular expression: the grammar nests two
 * unbounded whitespace runs inside a repetition, which is exactly the shape a
 * backtracking engine goes exponential on, and the pathological corpus feeds
 * this scanner adversarial delimiter rows.
 */
const scanDelimiterRowLine = (line: string, from: number): boolean => {
	let index = from;
	if (line.charAt(index) === "|") {
		index += 1;
	}

	for (;;) {
		while (isSpaceChar(line.charAt(index))) {
			index += 1;
		}
		if (line.charAt(index) === ":") {
			index += 1;
		}
		let dashes = 0;
		while (line.charAt(index) === "-") {
			index += 1;
			dashes += 1;
		}
		if (dashes === 0) {
			return false;
		}
		if (line.charAt(index) === ":") {
			index += 1;
		}
		while (isSpaceChar(line.charAt(index))) {
			index += 1;
		}

		if (line.charAt(index) !== "|") {
			// No pipe left: the row ends here, and only if the line does too.
			return index >= line.length;
		}
		index += 1;

		// A pipe with nothing but whitespace after it is the trailing pipe.
		let lookahead = index;
		while (isSpaceChar(line.charAt(lookahead))) {
			lookahead += 1;
		}
		if (lookahead >= line.length) {
			return true;
		}
	}
};

// --- upstream's `row_from_string` -----------------------------------------

/**
 * Scan `source` as one table row, upstream's `row_from_string`.
 *
 * Returns `undefined` unless the WHOLE text is consumed and at least one cell
 * came out of it — which is what makes a line either a row or not a row, with
 * no partial verdict in between.
 */
const rowFromSource = (source: RowSource): ScannedRow | undefined => {
	const { text } = source;
	const length = text.length;
	let cells: RawCell[] = [];
	let paragraphOffset = 0;
	let expectMoreCells = true;

	let offset = scanCellEnd(text, 0);

	while (offset < length && expectMoreCells) {
		const cellMatched = scanCell(text, offset);
		const pipeMatched = scanCellEnd(text, offset + cellMatched);

		if (cellMatched > 0 || pipeMatched > 0) {
			// Walk the cell's start back over the whitespace the previous pipe
			// consumed, so the cell begins where its column does. Upstream's
			// `internal_offset` is that distance; here the two positions are
			// kept side by side instead.
			let start = offset;
			while (start > paragraphOffset && text.charAt(start - 1) !== "|") {
				start -= 1;
			}
			cells.push({ start, contentStart: offset, end: offset + cellMatched });
		}

		offset += cellMatched + pipeMatched;

		if (pipeMatched > 0) {
			expectMoreCells = true;
			continue;
		}

		const rowEnd = scanRowEnd(text, offset);
		offset += rowEnd;
		if (rowEnd > 0 && offset !== length) {
			// A newline that is not the end of the text: everything up to here
			// is paragraph, and the row starts again after it.
			paragraphOffset = offset;
			cells = [];
			offset += scanCellEnd(text, offset);
			expectMoreCells = true;
		} else {
			expectMoreCells = false;
		}
	}

	if (offset !== length || cells.length === 0) {
		return undefined;
	}
	return { cells, paragraphOffset };
};

// --- cell content ---------------------------------------------------------

/** Text and provenance for a run of a {@link RowSource}, escapes dropped. */
interface CellContent {
	readonly text: string;
	readonly segments: ReadonlyArray<RawInlineSegment>;
}

/**
 * Cut `[from, to)` out of `source`, dropping the backslash of every `\|` in
 * it — upstream's `unescape_pipes`.
 *
 * Upstream scans left to right and steps over the pipe it just unescaped, so
 * in `\\|` the SECOND backslash is the one that escapes: this is a byte loop,
 * not an understanding of which backslashes are themselves escaped. The
 * lookahead stops at `to`, because past it lies the delimiter pipe that ended
 * the cell and unescaping into it would eat a column boundary.
 */
const cellContent = (source: RowSource, from: number, to: number): CellContent => {
	const { text } = source;
	const drops: number[] = [];
	for (let index = from; index < to; index += 1) {
		if (text.charAt(index) === "\\" && index + 1 < to && text.charAt(index + 1) === "|") {
			drops.push(index);
			index += 1;
		}
	}

	if (drops.length === 0) {
		return { text: text.slice(from, to), segments: rebase(sliceWithSegments(source.segments, from, to), 0) };
	}

	let content = "";
	const segments: RawInlineSegment[] = [];
	let cursor = from;
	for (const drop of [...drops, to]) {
		if (drop > cursor) {
			segments.push(...rebase(sliceWithSegments(source.segments, cursor, drop), content.length));
			content += text.slice(cursor, drop);
		}
		cursor = drop + 1;
	}
	return { text: content, segments };
};

/** Shift a segment run's text offsets so it sits at `at` in a longer string. */
const rebase = (segments: ReadonlyArray<RawInlineSegment>, at: number): ReadonlyArray<RawInlineSegment> =>
	at === 0
		? segments
		: segments.map((segment) => ({
				textOffset: segment.textOffset + at,
				sourceOffset: segment.sourceOffset,
				length: segment.length,
			}));

/** The absolute source offset of `index` in a row source. */
const offsetAt = (source: RowSource, index: number, fallback: number): number => {
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
};

// --- alignment ------------------------------------------------------------

/**
 * The alignment each delimiter cell declares: a leading colon means left, a
 * trailing colon right, both center, neither nothing.
 *
 * Upstream reads the first and last byte of the TRIMMED cell buffer, so the
 * whitespace the scanner allows around a marker never reaches this decision.
 */
const alignmentsOf = (source: RowSource, row: ScannedRow): ReadonlyArray<TableAlign | null> =>
	row.cells.map((cell) => {
		const text = source.text.slice(cell.contentStart, cell.end).trim();
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
	});

// --- building the block tree ----------------------------------------------

/** The row source for the current line, from `nextNonspace` to its end. */
const lineSource = (scanner: BlockScanner): RowSource => {
	const text = scanner.currentLine.slice(scanner.nextNonspace);
	return {
		// The scanners want a newline terminator; the preprocessor strips it.
		// Appending it back costs one character at the end of the string and
		// keeps every index below it aligned with the source.
		text: `${text}\n`,
		segments: [{ textOffset: 0, sourceOffset: scanner.lineStart + scanner.nextNonspace, length: text.length }],
	};
};

/** The row source for a paragraph's accumulated content. */
const paragraphSource = (block: BlockNode): RowSource => ({
	text: block.stringContent,
	segments: block.segments,
});

/**
 * Close `block` at `endOffset`.
 *
 * `finalizeBlock` is what moves the tip back up to the parent, but it dates
 * the block to the end of the last line the loop finished — which for a row
 * built inside a block start is the line before. The end is corrected here.
 */
const closeAt = (scanner: BlockScanner, block: BlockNode, endOffset: number): void => {
	scanner.finalizeBlock(block, scanner.lineNumber);
	block.endLine = scanner.lineNumber;
	block.endOffset = endOffset;
};

/**
 * Build one row of `table` from `row`, as a `tableRow` block of `tableCell`
 * children, truncated or padded to the table's column count.
 */
const addRow = (
	scanner: BlockScanner,
	data: TableData,
	source: RowSource,
	row: ScannedRow,
	rowStartOffset: number,
	rowEndOffset: number,
): void => {
	const rowBlock = scanner.addChild("tableRow", rowStartOffset - scanner.lineStart);
	rowBlock.startOffset = rowStartOffset;

	const used = Math.min(row.cells.length, data.columns);
	for (let index = 0; index < used; index += 1) {
		const cell = row.cells[index];
		if (cell === undefined) {
			continue;
		}
		const start = offsetAt(source, cell.start, rowStartOffset);
		const cellBlock = scanner.addChild("tableCell", start - scanner.lineStart);
		cellBlock.startOffset = start;
		const content = cellContent(source, cell.contentStart, cell.end);
		cellBlock.stringContent = content.text;
		cellBlock.segments.push(...content.segments);
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
};

// --- block starts ---------------------------------------------------------

/**
 * The header start: a delimiter row under a paragraph promotes that paragraph
 * into a table.
 *
 * Upstream's `try_opening_table_header`.
 */
export const tableHeaderStart: BlockStart = {
	name: "tableHeader",
	trigger: (scanner, container) => {
		if (scanner.indented || container.type !== "paragraph" || container.data.tableVisited === true) {
			return 0;
		}
		if (!scanDelimiterRowLine(scanner.currentLine, scanner.nextNonspace)) {
			return 0;
		}

		const delimiterSource = lineSource(scanner);
		const delimiterRow = rowFromSource(delimiterSource);
		if (delimiterRow === undefined) {
			return 0;
		}

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
			paragraph.segments.push(...reclaimed.segments);
			paragraph.endOffset = headerStart;
			paragraph.endLine = Math.max(scanner.lineNumber - 2, paragraph.startLine);
		}

		const table = scanner.replaceBlock(container, "table");
		table.stringContent = "";
		table.segments.length = 0;
		table.startOffset = headerStart;
		table.startLine = Math.max(scanner.lineNumber - 1, 1);
		const data: TableData = {
			columns: headerRow.cells.length,
			align: alignmentsOf(delimiterSource, delimiterRow),
			rows: 0,
			nonemptyCells: 0,
		};
		table.data.tableData = data;

		// The header row belongs to the line ABOVE this one, so its position
		// comes from the paragraph content rather than the scanner's line.
		const headerEnd = offsetAt(headerSource, headerSource.text.length - 1, headerStart);
		addRow(scanner, data, headerSource, headerRow, headerStart, headerEnd);

		scanner.advanceOffset(scanner.currentLine.length - scanner.offset, false);
		return 2;
	},
};

/**
 * The row start: any non-blank line under an open table is a row.
 *
 * Upstream's `try_opening_table_row`. It sits after every core block start, so
 * a line that opens a blockquote, a list or a fence closes the table instead
 * of becoming a row.
 */
export const tableRowStart: BlockStart = {
	name: "tableRow",
	trigger: (scanner, container) => {
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
	},
};

// --- constructs -----------------------------------------------------------

/** Table: contains rows, and continues for as long as lines scan as rows. */
export const tableConstruct: BlockConstruct = {
	type: "table",
	acceptsLines: false,
	canContain: (child) => child === "tableRow",
	continue: (scanner) => {
		// Upstream's `matches`. A blank line yields no cells and so ends the
		// table, which is the only reason there is no explicit blank check.
		if (scanner.indented) {
			return 1;
		}
		return rowFromSource(lineSource(scanner)) === undefined ? 1 : 0;
	},
	materialize: (block, children, context) => {
		const rows = tableRowChildren(children);
		if (rows.length === 0) {
			return undefined;
		}
		return Table.make({
			align: block.data.tableData?.align ?? [],
			children: rows,
			position: context.position(block.startOffset, block.endOffset),
		});
	},
};

/** Table row: contains cells, and is built and closed on the line it opens. */
export const tableRowConstruct: BlockConstruct = {
	type: "tableRow",
	acceptsLines: false,
	canContain: (child) => child === "tableCell",
	continue: () => 1,
	materialize: (block, children, context) =>
		TableRow.make({
			children: tableCellChildren(children),
			position: context.position(block.startOffset, block.endOffset),
		}),
};

/**
 * Table cell: the block pass's one non-leaf inline host.
 *
 * Its content is the split, unescaped cell text with the source provenance of
 * every surviving character, so it goes through the same `inlineSlice` seam a
 * paragraph does — and inherits the trim, which is what makes the node's
 * position span the cell's content rather than its padding.
 */
export const tableCellConstruct: BlockConstruct = {
	type: "tableCell",
	acceptsLines: false,
	canContain: () => false,
	continue: () => 1,
	materialize: (block, _children, context) => {
		const inline = context.inlineSlice(block);
		const node = TableCell.make({
			children: inline.children,
			position: context.position(inline.startOffset, inline.endOffset),
		});
		context.registerInline(node, inline);
		return node;
	},
};
