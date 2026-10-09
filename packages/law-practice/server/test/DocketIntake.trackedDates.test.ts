/**
 * Docket sheet CSV proofs over an in-memory file system. The sheet text is
 * synthetic: invented dockets, names and dates under the sheet's real header.
 */
import { DocketTrackedDatesCsvOptions, makeDocketTrackedDatesCsvLayer } from "@beep/law-practice-server/DocketIntake";
import { DocketIntakeError, DocketTrackedDates } from "@beep/law-practice-use-cases/DocketIntake";
import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import type { TrackedDate } from "@beep/law-practice-use-cases/DocketIntake";

const SHEET_PATH = "/fixture/docket-sheet.csv";

// A modification time after the in-memory file system's clock, as an edit and a new export give.
const MODIFIED_LATER = 60_000;

const HEADER =
  "Billing File #,File #,Client Name,Title,Tracked Date Name,Date Type,Tracked Date,Matter Status,Country,Application #,Activity Comments,Matter Type,Foreign Agent,Status";

const sheetRow = (fileNumber: string, name: string, dateType: string, date: string): string =>
  `0000.01234,${fileNumber},Fixture Client,"Fixture title, with a comma",${name},${dateType},${date},Open,US,"00/000,001","Said ""see below""\non two lines",Utility,,Active`;

// A byte-order mark and CRLF line ends, as a spreadsheet's "CSV UTF-8" export writes them.
const SHEET = `\uFEFF${A.join(
  [
    HEADER,
    sheetRow("0000.00001US01", "Response", "Due Date", "2030-04-08"),
    sheetRow("0000.00001us01", "Final response", "Final Date", "4/1/2030"),
    sheetRow("0000.00001WO01-CA1", "National stage", "Due", "2030-Apr-20"),
    sheetRow("FA-77 / 0000.00001EP02", "Associate reminder", "Reminder", "5/5/2030"),
    sheetRow("0000.00001US01", "Hearing", "Hearing Date", "2030-06-01"),
    sheetRow("0000.00001US01", "Unclear", "Due Date", "next week"),
    sheetRow("0000.00001US01", "Impossible", "Due Date", "2/30/2030"),
    sheetRow("0000.00001US01", "Unknown month", "Due Date", "2030-Foo-01"),
    sheetRow("0001.00002US01", "Another matter", "Due Date", "2030-03-01"),
  ],
  "\r\n"
)}\r\n`;

const sheetLayer = makeDocketTrackedDatesCsvLayer(DocketTrackedDatesCsvOptions.make({ path: SHEET_PATH })).pipe(
  Layer.provideMerge(MemoryFileSystem.layer)
);

const writeSheet = Effect.fnUntraced(function* (text: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory("/fixture", { recursive: true });
  yield* fs.writeFileString(SHEET_PATH, text);
});

const rowsOf = (rows: ReadonlyArray<TrackedDate>) =>
  A.map(rows, (row) => [row.docket, row.dateType, row.date.toISOString(), row.name]);

const forDockets = (dockets: ReadonlyArray<string>) =>
  Effect.flatMap(Effect.service(DocketTrackedDates), (sheet) => sheet.forDockets(dockets));

const failureOf = Effect.fnUntraced(function* (text: string) {
  yield* writeSheet(text);
  const error = yield* Effect.flip(forDockets(["0000.00001US01"]));
  assertInstanceOf(error, DocketIntakeError);
  return [error.stage, error.cause];
});

describe("@beep/law-practice-server DocketIntake docket sheet", () => {
  it.layer(sheetLayer, { timeout: "5 seconds" })("tracked dates", (it) => {
    it.effect(
      "reads every date form, quoted cells, a national-stage docket and a foreign agent's reference, and skips what is not a date",
      Effect.fnUntraced(function* () {
        yield* writeSheet(SHEET);

        const rows = yield* forDockets([" 0000.00001US01", "0000.00001wo01-ca1", "0000.00001EP02", "fa-77"]);

        expect(rowsOf(rows)).toStrictEqual([
          [" 0000.00001US01", "due-date", "2030-04-08", "Response"],
          [" 0000.00001US01", "final-date", "2030-04-01", "Final response"],
          [" 0000.00001US01", "other", "2030-06-01", "Hearing"],
          ["0000.00001wo01-ca1", "due-date", "2030-04-20", "National stage"],
          ["0000.00001EP02", "reminder", "2030-05-05", "Associate reminder"],
          ["fa-77", "reminder", "2030-05-05", "Associate reminder"],
        ]);
        expect(yield* forDockets(["0002.00003US01"])).toStrictEqual([]);
      })
    );
  });

  it.layer(sheetLayer, { timeout: "5 seconds" })("cache", (it) => {
    it.effect(
      "reads the file again only when its modification time changes",
      Effect.fnUntraced(function* () {
        const original = A.join([HEADER, sheetRow("0000.00001US01", "Response", "Due Date", "2030-04-08")], "\n");
        const edited = A.join([HEADER, sheetRow("0000.00001US01", "Response", "Due Date", "2030-04-02")], "\n");
        yield* writeSheet(original);

        const first = yield* forDockets(["0000.00001US01"]);
        // Same modification time: the cached sheet answers.
        yield* writeSheet(edited);
        const cached = yield* forDockets(["0000.00001US01"]);
        const fs = yield* FileSystem.FileSystem;
        yield* fs.utimes(SHEET_PATH, MODIFIED_LATER, MODIFIED_LATER);
        const reread = yield* forDockets(["0000.00001US01"]);

        expect(A.map([first, cached, reread], (rows) => A.map(rows, (row) => row.date.toISOString()))).toStrictEqual([
          ["2030-04-08"],
          ["2030-04-08"],
          ["2030-04-02"],
        ]);
      })
    );
  });

  it.layer(sheetLayer, { timeout: "5 seconds" })("failures", (it) => {
    it.effect(
      "fails at stage tracked-dates when the file is missing, is not CSV, or lacks a column the cross-check reads",
      Effect.fnUntraced(function* () {
        const missing = yield* Effect.flip(forDockets(["0000.00001US01"]));
        const results = [
          [missing.stage, missing.cause],
          yield* failureOf('File #,Tracked Date Name,Date Type,Tracked Date\n"0000.00001US01,Response'),
          yield* failureOf("File #,Tracked Date Name,Tracked Date\n0000.00001US01,Response,2030-04-08"),
        ];
        const empty = yield* failureOf("");

        expect([...results, empty]).toStrictEqual([
          ["tracked-dates", "docket-sheet-unreadable"],
          ["tracked-dates", "docket-sheet-invalid"],
          ["tracked-dates", "docket-sheet-columns-missing"],
          ["tracked-dates", "docket-sheet-columns-missing"],
        ]);
      })
    );
  });
});
