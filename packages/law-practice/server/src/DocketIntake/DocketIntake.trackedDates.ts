/**
 * Tracked dates of the attorney's docket sheet, read from its CSV export.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { DocketIntakeError, DocketTrackedDates, TrackedDate } from "@beep/law-practice-use-cases/DocketIntake";
import { parseCsvRows } from "@beep/schema/CsvParser";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import { ParserOptions } from "@beep/schema/ParserOptions";
import { thunkEmptyStr } from "@beep/utils";
import { DateTime, Effect, FileSystem, Layer, Match, pipe, Ref } from "effect";
import * as A from "effect/Array";
import { identity } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { TrackedDateType } from "@beep/law-practice-use-cases/DocketIntake";
import type { LocalDate } from "@beep/schema/LocalDate";

const $I = $LawPracticeServerId.create("DocketIntake/DocketIntake.trackedDates");

/**
 * Where the CSV export of the attorney's docket sheet is.
 *
 * **Example** (Make the CSV options)
 *
 * ```ts
 * import { DocketTrackedDatesCsvOptions } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketTrackedDatesCsvOptions.make({ path: "docket-sheet.csv" }).path);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketTrackedDatesCsvOptions extends S.Class<DocketTrackedDatesCsvOptions>(
  $I`DocketTrackedDatesCsvOptions`
)(
  {
    path: S.NonEmptyString.annotateKey({ description: "Path of the sheet's CSV export (UTF-8, header row)." }),
  },
  $I.annote("DocketTrackedDatesCsvOptions", { description: "Where the CSV export of the docket sheet is." })
) {}

// The sheet's own words for each kind of date, compared without case; anything else is `other`.
const SHEET_DATE_TYPES: Readonly<Record<string, TrackedDateType>> = {
  due: "due-date",
  "due date": "due-date",
  "final date": "final-date",
  reminder: "reminder",
};

const sheetDateType = (text: string): TrackedDateType =>
  O.getOrElse(R.get(SHEET_DATE_TYPES, Str.toLowerCase(Str.trim(text))), (): TrackedDateType => "other");

const MONTH_NUMBERS: Readonly<Record<string, string>> = {
  apr: "04",
  aug: "08",
  dec: "12",
  feb: "02",
  jan: "01",
  jul: "07",
  jun: "06",
  mar: "03",
  may: "05",
  nov: "11",
  oct: "10",
  sep: "09",
};

const twoDigits = Str.padStart(2, "0");

const isSlashDate = S.is(S.String.check(S.isPattern(/^\d{1,2}\/\d{1,2}\/\d{4}$/u)));
const isMonthNameDate = S.is(S.String.check(S.isPattern(/^\d{4}-[a-z]{3}-\d{1,2}$/iu)));

// The ISO form of a tracked date: `4/1/2030` is month, day, year, so rotating the year to the
// front gives the ISO order; in `2030-Apr-01` the month name becomes its number.
const isoFormOf: (text: string) => string = Match.type<string>().pipe(
  Match.when(isSlashDate, (text) => A.join(A.rotate(A.map(Str.split(text, "/"), twoDigits), 1), "-")),
  Match.when(isMonthNameDate, (text) =>
    A.join(
      A.map(Str.split(text, "-"), (part) =>
        twoDigits(O.getOrElse(R.get(MONTH_NUMBERS, Str.toLowerCase(part)), () => part))
      ),
      "-"
    )
  ),
  Match.orElse(identity<string>)
);

const decodeLocalDate = S.decodeUnknownOption(LocalDateFromString);

// `YYYY-MM-DD`, `M/D/YYYY` or `YYYY-Mon-DD`, and a real calendar day; anything else is not a date.
const sheetDate = (text: string): O.Option<LocalDate> => decodeLocalDate(isoFormOf(Str.trim(text)));

const FILE_NUMBER = "File #";
const DATE_NAME = "Tracked Date Name";
const DATE_TYPE = "Date Type";
const TRACKED_DATE = "Tracked Date";
const REQUIRED_COLUMNS: A.NonEmptyReadonlyArray<string> = [FILE_NUMBER, DATE_NAME, DATE_TYPE, TRACKED_DATE];

class DocketSheetRow extends S.Class<DocketSheetRow>($I`DocketSheetRow`)(
  {
    [DATE_NAME]: S.String.annotateKey({ description: "What the date is for." }),
    [DATE_TYPE]: S.String.annotateKey({ description: "Kind of date, in the sheet's words." }),
    [FILE_NUMBER]: S.String.annotateKey({ description: "The docket, or a foreign agent's reference with a `/` tail." }),
    [TRACKED_DATE]: S.String.annotateKey({ description: "The date, as the export writes it." }),
  },
  $I.annote("DocketSheetRow", { description: "The columns of one docket sheet row the cross-check reads." })
) {}

const decodeSheetRows = S.decodeUnknownEffect(S.Array(DocketSheetRow));

// One dated row of the sheet with every docket form it answers to.
type SheetEntry = {
  readonly date: LocalDate;
  readonly dateType: TrackedDateType;
  readonly keys: ReadonlyArray<string>;
  readonly name: string;
};

type ParsedSheet = { readonly entries: ReadonlyArray<SheetEntry>; readonly unparsedDates: number };

const parserOptions = ParserOptions.new({ ignoreEmpty: true });

// A spreadsheet's "CSV UTF-8" export starts with a byte-order mark; most decoders drop it, this makes sure.
const BYTE_ORDER_MARK = /^\uFEFF/u;

// Dockets compare without case or spaces.
const normalizedDocket = (value: string): string => Str.toUpperCase(Str.replaceAll(" ", "")(Str.trim(value)));

// `File #` is the docket, or a foreign agent's reference followed by ` / <our docket>`; either part answers.
const docketKeys = (fileNumber: string): ReadonlyArray<string> =>
  A.dedupe(A.filter(A.map([fileNumber, ...Str.split(fileNumber, "/")], normalizedDocket), Str.isNonEmpty));

const sheetFailure = (cause: string) => () => DocketIntakeError.make({ cause, stage: "tracked-dates" });

const toRecord =
  (header: ReadonlyArray<string>) =>
  (cells: ReadonlyArray<string>): Record<string, string> =>
    R.fromEntries(A.map(header, (name, index) => [name, O.getOrElse(A.get(cells, index), thunkEmptyStr)] as const));

const entryOf = (row: DocketSheetRow): O.Option<SheetEntry> =>
  O.map(sheetDate(row[TRACKED_DATE]), (date) => ({
    date,
    dateType: sheetDateType(row[DATE_TYPE]),
    keys: docketKeys(row[FILE_NUMBER]),
    name: Str.trim(row[DATE_NAME]),
  }));

const parseSheet = Effect.fnUntraced(function* (text: string): Effect.fn.Return<ParsedSheet, DocketIntakeError> {
  const rows = yield* parseCsvRows(Str.replace(BYTE_ORDER_MARK, "")(text), parserOptions).pipe(
    Effect.mapError(sheetFailure("docket-sheet-invalid"))
  );
  const [header, ...data] = A.match(rows, {
    onEmpty: (): A.NonEmptyReadonlyArray<ReadonlyArray<string>> => [[]],
    onNonEmpty: (nonEmpty) => nonEmpty,
  });
  const columns = A.map(header, Str.trim);
  if (!A.every(REQUIRED_COLUMNS, (column) => A.contains(columns, column))) {
    return yield* sheetFailure("docket-sheet-columns-missing")();
  }
  const sheetRows = yield* decodeSheetRows(A.map(data, toRecord(columns))).pipe(
    Effect.mapError(sheetFailure("docket-sheet-invalid"))
  );
  const entries = A.getSomes(A.map(sheetRows, entryOf));
  return { entries, unparsedDates: A.length(sheetRows) - A.length(entries) };
});

type CachedSheet = { readonly modified: O.Option<number>; readonly sheet: ParsedSheet };

const sameModified = O.makeEquivalence(Num.Equivalence);

/**
 * Tracked dates read from the CSV export of the attorney's docket sheet.
 *
 * **Details**
 *
 * The export is UTF-8 with the sheet's header row, comma-separated with RFC
 * 4180 quoting; a byte-order mark is ignored. Only the columns `File #`,
 * `Tracked Date Name`, `Date Type` and `Tracked Date` are read, so the sheet
 * may carry any others. A row answers to its whole `File #` and to each part
 * of a foreign agent's `<reference> / <docket>`, compared without case or
 * spaces. `Tracked Date` may be `YYYY-MM-DD`, `M/D/YYYY` or `YYYY-Mon-DD`;
 * a row whose date is none of these is skipped and counted on the span.
 *
 * The file is read again only when its modification time changes. A missing
 * or unreadable file, a file that is not CSV, or one without the four columns
 * fails at stage `tracked-dates`, which the pipeline turns into a flag. The
 * file is never written.
 *
 * **Example** (Wire the docket sheet export)
 *
 * ```ts
 * import {
 *   DocketTrackedDatesCsvOptions,
 *   makeDocketTrackedDatesCsvLayer
 * } from "@beep/law-practice-server/DocketIntake";
 * import { Layer } from "effect";
 *
 * const sheet = makeDocketTrackedDatesCsvLayer(DocketTrackedDatesCsvOptions.make({ path: "docket-sheet.csv" }));
 * console.log(Layer.isLayer(sheet));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDocketTrackedDatesCsvLayer = (
  options: DocketTrackedDatesCsvOptions
): Layer.Layer<DocketTrackedDates, never, FileSystem.FileSystem> =>
  Layer.effect(
    DocketTrackedDates,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const cache = yield* Ref.make(O.none<CachedSheet>());

      const currentSheet = Effect.fnUntraced(function* (): Effect.fn.Return<ParsedSheet, DocketIntakeError> {
        const info = yield* fs.stat(options.path).pipe(Effect.mapError(sheetFailure("docket-sheet-unreadable")));
        const modified = O.map(info.mtime, (date) => DateTime.fromDateUnsafe(date).epochMilliseconds);
        const cached = O.filter(
          yield* Ref.get(cache),
          (entry) => O.isSome(modified) && sameModified(entry.modified, modified)
        );
        if (O.isSome(cached)) {
          return cached.value.sheet;
        }
        const text = yield* fs
          .readFileString(options.path)
          .pipe(Effect.mapError(sheetFailure("docket-sheet-unreadable")));
        const sheet = yield* parseSheet(text);
        yield* Ref.set(cache, O.some({ modified, sheet }));
        return sheet;
      });

      return DocketTrackedDates.of({
        forDockets: Effect.fn("DocketTrackedDates.forDockets")(function* (dockets) {
          const sheet = yield* currentSheet();
          const found = A.flatMap(dockets, (docket) =>
            pipe(
              A.filter(sheet.entries, (entry) => A.contains(entry.keys, normalizedDocket(docket))),
              A.map((entry) =>
                TrackedDate.make({ date: entry.date, dateType: entry.dateType, docket, name: entry.name })
              )
            )
          );
          yield* Effect.annotateCurrentSpan({
            docket_sheet_rows: A.length(sheet.entries),
            docket_sheet_tracked_matches: A.length(found),
            docket_sheet_unparsed_dates: sheet.unparsedDates,
          });
          return found;
        }),
      });
    })
  );
