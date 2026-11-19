// The canonical writer: minimal (or full) quoting, one terminator, a final terminator and an optional BOM, so that
// reading the text back gives the same table. A record of one empty cell is written `""`, so it does not read back as
// a blank line when blank lines are skipped, and a first cell that starts `sep=` is quoted, so a reader honouring
// Excel's `sep=` line does not take it for one. Effect's `effect/encoding/Csv` writes by the same quoting rule but only
// as a channel, with no synchronous form, no quote-everything style, no formula guard and no BOM, so the synchronous
// writer stays here and the channels reuse it.
import * as A from "effect/Array";
import * as Str from "effect/String";
import { recordEndText } from "../CsvPosition.schema.ts";
import { applyFormulaGuard, needsQuotes, opensSepLine } from "./rules.ts";
import type { CsvCodecOptions } from "../CsvOptions.schema.ts";
import type { CsvRecord } from "../CsvTable.schema.ts";

type WriteOptions = CsvCodecOptions["write"];

/** A record a reader would take for a blank line: one empty cell. */
const isOneEmptyCell = (record: CsvRecord): boolean => record.length === 1 && record[0] === "";

const quote = (cell: string): string => `"${Str.replaceAll('"', '""')(cell)}"`;

/** A cell as written: guarded, then quoted when the style, its text or (as the table's first cell) a `sep=` start asks. */
const writeCell = (raw: string, first: boolean, options: WriteOptions): string => {
  const cell = applyFormulaGuard(options.formulaGuard, raw);
  return options.quoteStyle === "always" || needsQuotes(cell, options.delimiter) || (first && opensSepLine(cell))
    ? quote(cell)
    : cell;
};

const writeRecord = (record: CsvRecord, first: boolean, options: WriteOptions): string =>
  isOneEmptyCell(record)
    ? '""'
    : A.join(
        A.map(record, (raw, index) => writeCell(raw, first && index === 0, options)),
        options.delimiter
      );

/**
 * The text of a table under the write options. `opensText` (true unless a channel writes a later batch) says whether
 * the records start the text, so their first cell is the table's.
 */
export const writeTable = (input: {
  readonly table: { readonly records: ReadonlyArray<CsvRecord> };
  readonly options: WriteOptions;
  readonly opensText?: boolean;
}): string => {
  const { table, options, opensText = true } = input;
  const terminator = recordEndText(options.terminator);
  const body = A.join(
    A.map(table.records, (record, index) => writeRecord(record, opensText && index === 0, options)),
    terminator
  );
  const ending = options.finalTerminator && A.isReadonlyArrayNonEmpty(table.records) ? terminator : "";
  return `${options.bom ? "\uFEFF" : ""}${body}${ending}`;
};
