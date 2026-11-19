// The header view: the first record names the columns, every later record becomes an object of own properties keyed
// by those names. Rows are built with `R.fromEntries` (`Object.fromEntries` defines own data properties), so a
// heading named `__proto__` is data, never a prototype. A short record fills its missing cells with ""; a long
// record's extra cells have no heading and are dropped.
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Tuple from "effect/Tuple";
import { CsvFatal, DuplicateHeader, EmptyHeader } from "../CsvDiagnostic.schema.ts";
import type { CsvHeaderRow, CsvRecord } from "../CsvTable.schema.ts";

/** The fatal finding about one heading, if any: empty, or a repeat of an earlier heading. */
const headingFinding = (header: CsvRecord, name: string, field: number): O.Option<CsvFatal> =>
  name === ""
    ? CsvFatal.makeOption({ finding: EmptyHeader.make({ field }) })
    : O.map(
        O.filter(
          A.findFirstIndex(header, (other) => other === name),
          (firstField) => firstField < field
        ),
        (firstField) => CsvFatal.make({ finding: DuplicateHeader.make({ field, firstField, name }) })
      );

/** The table as objects keyed by its first record, or the fatal findings about the header. */
export const toHeaderRows = (table: {
  readonly records: ReadonlyArray<CsvRecord>;
}): Result.Result<ReadonlyArray<CsvHeaderRow>, A.NonEmptyReadonlyArray<CsvFatal>> =>
  O.match(A.head(table.records), {
    onNone: () => Result.succeed(A.empty()),
    onSome: (header) =>
      A.match(A.getSomes(A.map(header, (name, field) => headingFinding(header, name, field))), {
        onNonEmpty: Result.fail,
        onEmpty: () =>
          Result.succeed(
            A.map(A.drop(table.records, 1), (record) =>
              R.fromEntries(
                A.map(header, (name, index) =>
                  Tuple.make(
                    name,
                    O.getOrElse(A.get(record, index), () => "")
                  )
                )
              )
            )
          ),
      }),
  });
