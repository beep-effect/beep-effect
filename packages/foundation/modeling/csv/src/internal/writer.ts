// The canonical writer: minimal (or full) quoting, one terminator, a final terminator and an optional BOM, so that
// reading the text back gives the same table. A record of one empty cell is written `""`, so it does not read back as
// a blank line when blank lines are skipped. Effect's `effect/encoding/Csv` writes by the same quoting rule but only
// as a channel, with no synchronous form, no quote-everything style, no formula guard and no BOM, so the synchronous
// writer stays here and the channels reuse it.
import * as A from "effect/Array";
import * as Str from "effect/String";
import { applyFormulaGuard } from "../CsvOptions.schema.ts";
import { recordEndText } from "../CsvPosition.schema.ts";
import { isBlankRecord, needsQuotes } from "../CsvTable.schema.ts";
import type { CsvCodecOptions } from "../CsvOptions.schema.ts";
import type { CsvRecord } from "../CsvTable.schema.ts";

type WriteOptions = CsvCodecOptions["write"];

const quote = (cell: string): string => `"${Str.replaceAll('"', '""')(cell)}"`;

const writeRecord = (record: CsvRecord, options: WriteOptions): string =>
  isBlankRecord(record)
    ? '""'
    : A.join(
        A.map(record, (raw) => {
          const cell = applyFormulaGuard(options.formulaGuard, raw);
          return options.quoteStyle === "always" || needsQuotes(cell, options.delimiter) ? quote(cell) : cell;
        }),
        options.delimiter
      );

/** The text of a table under the write options. */
export const writeTable = (input: {
  readonly table: { readonly records: ReadonlyArray<CsvRecord> };
  readonly options: WriteOptions;
}): string => {
  const { table, options } = input;
  const terminator = recordEndText(options.terminator);
  const body = A.join(
    A.map(table.records, (record) => writeRecord(record, options)),
    terminator
  );
  const ending = options.finalTerminator && A.isReadonlyArrayNonEmpty(table.records) ? terminator : "";
  return `${options.bom ? "﻿" : ""}${body}${ending}`;
};
