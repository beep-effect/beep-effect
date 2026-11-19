// The canonical writer: minimal (or full) quoting, one terminator, a final terminator and an optional BOM, so that
// reading the text back gives the same table. A record of one empty cell is written `""`, so it does not read back as
// a blank line when blank lines are skipped.
import * as A from "effect/Array";
import * as Str from "effect/String";
import { applyFormulaGuard, CsvTerminator } from "../CsvOptions.schema.ts";
import type { CsvCodecOptions } from "../CsvOptions.schema.ts";

type WriteOptions = CsvCodecOptions["write"];

import { needsQuotes } from "../CsvTable.schema.ts";
import type { CsvRecord } from "../CsvTable.schema.ts";

const terminatorText = CsvTerminator.match({ CRLF: () => "\r\n", LF: () => "\n" });

const quote = (cell: string): string => `"${Str.replaceAll('"', '""')(cell)}"`;

const writeRecord = (record: CsvRecord, options: WriteOptions): string => {
  if (record.length === 1 && record[0] === "") return '""';
  return A.join(
    A.map(record, (raw) => {
      const cell = applyFormulaGuard(options.formulaGuard, raw);
      return options.quoteStyle === "always" || needsQuotes(cell, options.delimiter) ? quote(cell) : cell;
    }),
    options.delimiter
  );
};

/** The text of a table under the write options. */
export const writeTable = (input: {
  readonly table: { readonly records: ReadonlyArray<CsvRecord> };
  readonly options: WriteOptions;
}): string => {
  const { table, options } = input;
  const terminator = terminatorText(options.terminator);
  const body = A.join(
    A.map(table.records, (record) => writeRecord(record, options)),
    terminator
  );
  const ending = options.finalTerminator && table.records.length > 0 ? terminator : "";
  return `${options.bom ? "﻿" : ""}${body}${ending}`;
};
