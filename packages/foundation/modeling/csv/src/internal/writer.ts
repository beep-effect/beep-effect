import * as A from "effect/Array";
import * as Str from "effect/String";
import { recordEndText } from "../CsvPosition.schema.ts";
import { applyFormulaGuard, needsQuotes, opensSepLine } from "./rules.ts";
import type { CsvCodecOptions } from "../CsvOptions.schema.ts";
import type { CsvRecord } from "../CsvTable.schema.ts";

type WriteOptions = CsvCodecOptions["write"];

const readsBackAsBlankLine = (record: CsvRecord): boolean => record.length === 1 && record[0] === "";

const quote = (cell: string): string => `"${Str.replaceAll('"', '""')(cell)}"`;

const writeCell = (raw: string, isTableFirstCell: boolean, options: WriteOptions): string => {
  const guarded = applyFormulaGuard(options.formulaGuard, raw);
  return options.quoteStyle === "always" ||
    needsQuotes(guarded, options.delimiter) ||
    (isTableFirstCell && opensSepLine(guarded))
    ? quote(guarded)
    : guarded;
};

const writeRecord = (record: CsvRecord, first: boolean, options: WriteOptions): string =>
  readsBackAsBlankLine(record)
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
