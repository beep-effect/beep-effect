// The header view: the first record names the columns, every later record becomes an object of own properties keyed
// by those names. Rows are built with `R.fromEntries` (`Object.fromEntries` defines own data properties), so a
// heading named `__proto__` is data, never a prototype. A short record fills its missing cells with ""; a long
// record's extra cells have no heading and are dropped. The header is checked once, in one pass, and the rows are
// built from the checked header without checking it again, so a stream pays for the check on its first record only.
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Tuple from "effect/Tuple";
import { CsvFatal, DuplicateHeader, EmptyHeader } from "../CsvDiagnostic.schema.ts";
import type { CsvHeaderRow, CsvRecord } from "../CsvTable.schema.ts";

/** Where each heading first appears: built from the last heading back, so the first occurrence is the one kept. */
const firstFields = (header: CsvRecord): HashMap.HashMap<string, number> =>
  HashMap.fromIterable(A.reverse(A.map(header, (name, field) => Tuple.make(name, field))));

/** The fatal finding about one heading, if any: empty, or a repeat of the heading's first occurrence. */
const headingFinding =
  (first: HashMap.HashMap<string, number>) =>
  (name: string, field: number): O.Option<CsvFatal> =>
    name === ""
      ? CsvFatal.makeOption({ finding: EmptyHeader.make({ field }) })
      : O.map(
          O.filter(HashMap.get(first, name), (firstField) => firstField < field),
          (firstField) => CsvFatal.make({ finding: DuplicateHeader.make({ field, firstField, name }) })
        );

/** The header, or every fatal finding about it in heading order. */
export const checkHeader = (header: CsvRecord): Result.Result<CsvRecord, A.NonEmptyReadonlyArray<CsvFatal>> =>
  A.match(A.getSomes(A.map(header, headingFinding(firstFields(header)))), {
    onEmpty: () => Result.succeed(header),
    onNonEmpty: Result.fail,
  });

/** The records as objects keyed by a header that `checkHeader` accepted. */
export const rowsOf: {
  (records: ReadonlyArray<CsvRecord>): (header: CsvRecord) => ReadonlyArray<CsvHeaderRow>;
  (header: CsvRecord, records: ReadonlyArray<CsvRecord>): ReadonlyArray<CsvHeaderRow>;
} = dual(
  2,
  (header: CsvRecord, records: ReadonlyArray<CsvRecord>): ReadonlyArray<CsvHeaderRow> =>
    A.map(records, (record) =>
      R.fromEntries(
        A.map(header, (name, index) =>
          Tuple.make(
            name,
            O.getOrElse(A.get(record, index), () => "")
          )
        )
      )
    )
);

/** The table as objects keyed by its first record, or the fatal findings about the header. */
export const toHeaderRows = (table: {
  readonly records: ReadonlyArray<CsvRecord>;
}): Result.Result<ReadonlyArray<CsvHeaderRow>, A.NonEmptyReadonlyArray<CsvFatal>> =>
  O.match(A.head(table.records), {
    onNone: () => Result.succeed(A.empty()),
    onSome: (header) => Result.map(checkHeader(header), (checked) => rowsOf(checked, A.drop(table.records, 1))),
  });
