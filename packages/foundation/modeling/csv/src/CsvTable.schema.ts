/**
 * The canonical decoded side of every CSV codec: records of cells, each cell exactly as written, and one record with
 * where it was, for streams.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CsvId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CsvIndex, CsvRecordEnd, CsvTextSpan, MAX_TEXT_UNITS } from "./CsvPosition.schema.ts";

const $I = $CsvId.create("CsvTable");

/**
 * The most cells one record may have; it bounds generation and sits above every configurable limit.
 *
 * **Example** (Refuse a record wider than the bound)
 *
 * ```ts import.meta.vitest name="Refuse a record wider than the bound"
 * import { CsvRecord, MAX_FIELDS } from "@beep/csv/CsvTable.schema"
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvRecord)(A.replicate("", MAX_FIELDS)) // => true
 * S.is(CsvRecord)(A.replicate("", MAX_FIELDS + 1)) // => false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_FIELDS = 1_000_000;

/**
 * One cell's text as written in the file, never coerced: what "12" or "03/04/2026" means is the reader's business.
 *
 * **Example** (Keep a cell's text as written)
 *
 * ```ts import.meta.vitest name="Keep a cell's text as written"
 * import { CsvCell } from "@beep/csv/CsvTable.schema"
 * import * as S from "effect/Schema"
 *
 * S.decodeUnknownSync(CsvCell)("03/04/2026") // => "03/04/2026"
 * S.is(CsvCell)(12) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvCell = S.String.check(S.isMaxLength(MAX_TEXT_UNITS)).pipe(
  $I.annoteSchema("CsvCell", { description: "One cell's text, as written, never coerced" })
);

/**
 * A decoded {@link CsvCell}: a string, at most {@link MAX_TEXT_UNITS} UTF-16 units long.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvCell = typeof CsvCell.Type;

/**
 * Whether a cell must be quoted to read back unchanged: it holds the delimiter, a quote, a carriage return or a line
 * feed, or starts with a byte-order mark (which a reader strips at the start of a file).
 *
 * **Example** (Cells that need quotes)
 *
 * ```ts import.meta.vitest name="Cells that need quotes"
 * import { needsQuotes } from "@beep/csv/CsvTable.schema"
 *
 * needsQuotes("Bracket, 40 mm", ",") // => true
 * needsQuotes("Bracket, 40 mm", ";") // => false
 * needsQuotes('12" pipe', ",") // => true
 * needsQuotes("Bolt", ",") // => false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const needsQuotes: {
  (delimiter: string): (cell: CsvCell) => boolean;
  (cell: CsvCell, delimiter: string): boolean;
} = dual(
  2,
  (cell: CsvCell, delimiter: string): boolean =>
    Str.includes(delimiter)(cell) ||
    Str.includes('"')(cell) ||
    Str.includes("\r")(cell) ||
    Str.includes("\n")(cell) ||
    Str.startsWith("\uFEFF")(cell)
);

/**
 * One record's cells, never empty: a blank line reads as one empty cell.
 *
 * **Example** (Refuse a record with no cells)
 *
 * ```ts import.meta.vitest name="Refuse a record with no cells"
 * import { CsvRecord } from "@beep/csv/CsvTable.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvRecord)(["BRK-040", "Bracket"]) // => true
 * S.is(CsvRecord)([""]) // => true
 * S.is(CsvRecord)([]) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvRecord = S.NonEmptyArray(CsvCell.annotateKey({ description: "One cell" }))
  .check(S.isMaxLength(MAX_FIELDS))
  .pipe($I.annoteSchema("CsvRecord", { description: "One record's cells; a blank line is one empty cell" }));

/**
 * A decoded {@link CsvRecord}: a non-empty array of cells.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvRecord = typeof CsvRecord.Type;

/**
 * Whether a record is a blank line's: exactly one empty cell.
 *
 * **Gotchas**
 *
 * A quoted empty cell (`""` on its own line) reads as the same record, so this cannot tell the two apart. Blank-line
 * skipping is decided by the reader, which still sees the quotes, not by this predicate.
 *
 * **Example** (Tell a blank line from a record)
 *
 * ```ts import.meta.vitest name="Tell a blank line from a record"
 * import { isBlankRecord } from "@beep/csv/CsvTable.schema"
 *
 * isBlankRecord([""]) // => true
 * isBlankRecord(["", ""]) // => false
 * isBlankRecord(["BRK-040"]) // => false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isBlankRecord = (record: CsvRecord): boolean => record.length === 1 && record[0] === "";

/**
 * The records of a CSV file in file order: the canonical decoded side of every codec.
 *
 * **Details**
 *
 * `CsvTable.width` is the first record's cell count (`O.none()` for an empty table), and `CsvTable.ragged` lists the
 * 0-based indexes of the records whose width differs from it.
 *
 * **Example** (Measure a table and find its ragged records)
 *
 * ```ts import.meta.vitest name="Measure a table and find its ragged records"
 * import { CsvTable } from "@beep/csv/CsvTable.schema"
 * import * as O from "effect/Option"
 *
 * const table = CsvTable.make({ records: [["SKU", "Name"], ["BRK-040", "Bracket"], ["BLT-010"]] })
 * CsvTable.width(table) // => O.some(2)
 * CsvTable.ragged(table) // => [2]
 * CsvTable.width(CsvTable.make({ records: [] })) // => O.none()
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvTable extends S.Opaque<CsvTable, { readonly brand: unique symbol }>()(
  S.Struct({
    records: S.Array(CsvRecord.annotateKey({ description: "One record" })).pipe(
      S.annotateKey({ description: "The records in file order" })
    ),
  }).pipe($I.annoteSchema("CsvTable", { description: "The canonical decoded side of every CSV codec" }))
) {
  /** Cells in the first record, when there is one. */
  static readonly width = (table: CsvTable): O.Option<number> => O.map(A.head(table.records), A.length);

  /** The 0-based indexes of the records whose width differs from the first record's. */
  static readonly ragged = (table: CsvTable): ReadonlyArray<number> =>
    O.getOrElse(
      O.map(CsvTable.width(table), (width) =>
        A.getSomes(A.map(table.records, (record, index) => (record.length === width ? O.none() : O.some(index))))
      ),
      A.empty
    );
}

/**
 * One row of the header view: the first record's headings as keys, this record's cells as values.
 *
 * **Details**
 *
 * The schema only states the shape, a record of strings to strings; that the keys are the headings, unique and
 * non-empty, is the header view's job when it builds the row.
 *
 * **Example** (Decode a header row)
 *
 * ```ts import.meta.vitest name="Decode a header row"
 * import { CsvHeaderRow } from "@beep/csv/CsvTable.schema"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(CsvHeaderRow)({ SKU: "BRK-040", Name: "Bracket" })
 * row.Name // => "Bracket"
 * S.is(CsvHeaderRow)({ SKU: 40 }) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvHeaderRow = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("CsvHeaderRow", {
    description: "One row of the header view, keyed by the first record's headings",
  })
);

/**
 * A decoded {@link CsvHeaderRow}: cell text keyed by heading.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvHeaderRow = typeof CsvHeaderRow.Type;

/**
 * One record in a stream, with where it was and how it ended, so a consumer can report a position without holding
 * the whole table.
 *
 * **Example** (Describe a streamed record)
 *
 * ```ts import.meta.vitest name="Describe a streamed record"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 * import { CsvRecordSlice } from "@beep/csv/CsvTable.schema"
 *
 * const text = "SKU,Name\r\nBRK-040,Bracket\r\n"
 * const slice = CsvRecordSlice.make({
 *   cells: ["BRK-040", "Bracket"],
 *   record: 1,
 *   span: CsvTextSpan.locate(text, 10, 15),
 *   end: "CRLF",
 * })
 * CsvTextSpan.render(slice.span) // => "2:1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvRecordSlice extends S.Opaque<CsvRecordSlice, { readonly brand: unique symbol }>()(
  S.Struct({
    cells: CsvRecord.pipe(S.annotateKey({ description: "The record's cells" })),
    record: CsvIndex.pipe(S.annotateKey({ description: "0-based record number, blank lines counted" })),
    span: CsvTextSpan.pipe(S.annotateKey({ description: "Where the record is in the decoded text" })),
    end: CsvRecordEnd.pipe(S.annotateKey({ description: "How the record ended" })),
  }).pipe($I.annoteSchema("CsvRecordSlice", { description: "One record in a stream and where it was" }))
) {}
