// The header view: the first record names the columns, every later record becomes an object of own properties keyed
// by those names. Keys are set with `setOwnProperty`, so a heading named `__proto__` is data, never a prototype.
// A short record fills its missing cells with ""; a long record's extra cells have no heading and are dropped.
import { setOwnProperty } from "@beep/utils/Record";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { CsvFatal, DuplicateHeader, EmptyHeader } from "../CsvDiagnostic.schema.ts";
import type { CsvRecord } from "../CsvTable.schema.ts";

/** One row of the header view. */
export type HeaderRow = { readonly [name: string]: string };

/** The table as objects keyed by its first record, or the fatal findings about the header. */
export const toHeaderRows = (table: {
  readonly records: ReadonlyArray<CsvRecord>;
}): Result.Result<ReadonlyArray<HeaderRow>, ReadonlyArray<CsvFatal>> =>
  O.match(A.head(table.records), {
    onNone: () => Result.succeed([]),
    onSome: (header) => {
      const problems: Array<CsvFatal> = [];
      A.forEach(header, (name, field) => {
        if (name === "") {
          problems.push(CsvFatal.make({ finding: EmptyHeader.make({ field }) }));
          return;
        }
        const firstField = header.indexOf(name);
        if (firstField < field) {
          problems.push(CsvFatal.make({ finding: DuplicateHeader.make({ field, firstField, name }) }));
        }
      });
      if (problems.length > 0) return Result.fail(problems);
      return Result.succeed(
        A.map(A.drop(table.records, 1), (record) => {
          const row: { [name: string]: string } = {};
          A.forEach(header, (name, index) => setOwnProperty(row, name, record[index] ?? ""));
          return row;
        })
      );
    },
  });
