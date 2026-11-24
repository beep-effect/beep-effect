/**
 * The canonical decoded side of every CSV codec: records of cells, each cell exactly as written, and one record with
 * where it was, for streams.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CsvId } from "@beep/identity/packages";
import * as S from "effect/Schema";
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
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * Result.getOrThrow(S.decodeUnknownResult(CsvCell)("03/04/2026")) // => "03/04/2026"
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
 * The records of a CSV file in file order: the canonical decoded side of every codec.
 *
 * **Details**
 *
 * Every reader returns this model, and every writer takes it; nothing about the dialect is kept. A record is never
 * empty, so a table that is not a list of non-empty records is refused.
 *
 * **Example** (Refuse a table with an empty record)
 *
 * ```ts import.meta.vitest name="Refuse a table with an empty record"
 * import { CsvTable } from "@beep/csv/CsvTable.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvTable)(CsvTable.make({ records: [["SKU", "Name"], [""]] })) // => true
 * S.is(CsvTable)({ records: [["SKU"], []] }) // => false
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
) {}

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
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const row = Result.getOrThrow(S.decodeUnknownResult(CsvHeaderRow)({ SKU: "BRK-040", Name: "Bracket" }))
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
    span: CsvTextSpan,
    end: CsvRecordEnd.pipe(S.annotateKey({ description: "How the record ended" })),
  }).pipe($I.annoteSchema("CsvRecordSlice", { description: "One record in a stream and where it was" }))
) {}
