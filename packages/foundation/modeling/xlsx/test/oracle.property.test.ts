import { Xlsx } from "@beep/xlsx/Xlsx.codec";
import {
  XlsxBoolean,
  XlsxCell,
  XlsxDate,
  XlsxError,
  XlsxErrorCode,
  XlsxNumber,
  XlsxNumberFormat,
  XlsxText,
} from "@beep/xlsx/XlsxCell.schema";
import { XlsxLimits, XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema";
import { XlsxDateSystem } from "@beep/xlsx/XlsxSerial.schema";
import { XlsxRow, XlsxSheetInfo, XlsxSheetState, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { read, SSF, utils, write } from "xlsx/dist/xlsx.mini.min.js";
import type { CellObject, WorkSheet } from "xlsx/dist/xlsx.mini.min.js";

const runs = { arbitrary: { runs: 100 } };
// decision: sheetjs-is-the-outside-oracle
const formatted = (code: string, value: number, date1904 = false): string | undefined => {
  try {
    return SSF.format(code, value, { date1904 }) as string;
  } catch {
    return undefined;
  }
};

const PrintableWords = S.String.check(S.isPattern(/^[ -~]{0,40}$/));
const Decimal = S.Int.check(S.isBetween({ minimum: -99_999_999, maximum: 99_999_999 }));
const Value = S.Union([
  S.Struct({ kind: S.tag("text"), text: PrintableWords }),
  S.Struct({ kind: S.tag("number"), hundredths: Decimal }),
  S.Struct({ kind: S.tag("boolean"), value: S.Boolean }),
  S.Struct({ kind: S.tag("error"), code: XlsxErrorCode }),
  S.Struct({ kind: S.tag("date"), day: S.Int.check(S.isBetween({ minimum: 1, maximum: 80_000 })) }),
  S.Struct({ kind: S.tag("formula"), hundredths: Decimal }),
  S.Struct({ kind: S.tag("textFormula"), text: PrintableWords }),
]);
const Table = S.Array(S.Array(Value).check(S.isMaxLength(8))).check(S.isMaxLength(12));
const SheetNames = S.NonEmptyArray(S.String.check(S.isPattern(/^[A-Za-z][A-Za-z0-9 ]{0,20}$/))).check(S.isMaxLength(3));
const Book = S.Struct({
  dateSystem: XlsxDateSystem,
  names: SheetNames,
  state: XlsxSheetState,
  table: Table,
});

const named = (book: typeof Book.Type) => A.map(book.names, (name, index) => `${name}${index}`);

const dateFormat = XlsxNumberFormat.make({ id: 164, code: "yyyy-mm-dd" });

const ours = (book: typeof Book.Type): XlsxWorkbook =>
  XlsxWorkbook.canonical(
    XlsxWorkbook.make({
      dateSystem: book.dateSystem,
      sheets: A.map(named(book), (name, index) =>
        XlsxWorksheet.make({
          info: XlsxSheetInfo.make({ name, state: index === 0 ? "visible" : book.state }),
          rows: A.map(book.table, (cells, r) =>
            XlsxRow.make({
              number: r + 1,
              cells: A.map(cells, (cell, column) => {
                switch (cell.kind) {
                  case "text":
                    return XlsxCell.make({ column, value: XlsxText.make({ text: cell.text }) });
                  case "number":
                    return XlsxCell.make({ column, value: XlsxNumber.make({ value: cell.hundredths / 100 }) });
                  case "boolean":
                    return XlsxCell.make({ column, value: XlsxBoolean.make({ value: cell.value }) });
                  case "error":
                    return XlsxCell.make({ column, value: XlsxError.make({ code: cell.code }) });
                  case "date":
                    return XlsxCell.make({ column, value: XlsxDate.make({ serial: cell.day }), format: dateFormat });
                  case "formula":
                    return XlsxCell.make({
                      column,
                      value: XlsxNumber.make({ value: cell.hundredths / 100 }),
                      formula: O.some(`${cell.hundredths}/100`),
                    });
                  case "textFormula":
                    return XlsxCell.make({
                      column,
                      value: XlsxText.make({ text: cell.text }),
                      formula: O.some('TRIM(" x ")'),
                    });
                }
              }),
            })
          ),
        })
      ),
    })
  );

const asSheetJs = (cell: XlsxWorkbook["sheets"][number]["rows"][number]["cells"][number]) => {
  const formula = O.getOrUndefined(cell.formula);
  const value = cell.value;
  switch (value.kind) {
    case "Text":
      return value.text === "" ? undefined : ["s", value.text, formula, undefined];
    case "Number":
      return ["n", value.value, formula, cell.format.code === "General" ? undefined : cell.format.code];
    case "Date":
      return ["n", value.serial, formula, cell.format.code];
    case "Boolean":
      return ["b", value.value, formula, undefined];
    case "Error":
      return ["e", value.code, formula, undefined];
    default:
      return undefined;
  }
};

const errorCodes: { readonly [code: number]: string } = {
  0: "#NULL!",
  7: "#DIV/0!",
  15: "#VALUE!",
  23: "#REF!",
  29: "#NAME?",
  36: "#NUM!",
  42: "#N/A",
  43: "#GETTING_DATA",
};

const errorNumbers: { readonly [code in XlsxErrorCode]: number } = {
  "#NULL!": 0,
  "#DIV/0!": 7,
  "#VALUE!": 15,
  "#REF!": 23,
  "#NAME?": 29,
  "#NUM!": 36,
  "#N/A": 42,
  "#GETTING_DATA": 43,
};

const fromSheetJs = (cell: CellObject | undefined) => {
  if (cell === undefined || cell.t === "z" || (cell.t === "s" && cell.v === "")) return undefined;
  const format = typeof cell.z === "string" && cell.z !== "General" ? cell.z : undefined;
  return [cell.t, cell.t === "e" ? errorCodes[Number(cell.v)] : cell.v, cell.f, cell.t === "n" ? format : undefined];
};

const gridOf = (sheet: WorkSheet | undefined) => {
  const data = (sheet?.["!data"] ?? []) as ReadonlyArray<ReadonlyArray<CellObject | undefined> | null | undefined>;
  const rowsWithHolesAsUndefined = [...data];
  return A.map(rowsWithHolesAsUndefined, (row) =>
    A.filter(A.map([...(row ?? [])], fromSheetJs), (cell) => cell !== undefined)
  );
};

const large = XlsxReadOptions.make({ limits: XlsxLimits.make({}) });

describe("SheetJS reads what the package writes", () => {
  it.effect.prop(
    "to the same values, formulas, formats, sheet names and states",
    [Arbitrary.schema(Book)],
    ([book]) =>
      Effect.gen(function* () {
        const workbook = ours(book);
        const bytes = yield* Xlsx.stringify(workbook);
        const theirs = read(bytes, { type: "array", dense: true, cellFormula: true, cellNF: true, cellStyles: true });
        expect(theirs.SheetNames).toEqual(A.map(workbook.sheets, (sheet) => sheet.info.name));
        expect(theirs.Workbook?.WBProps?.date1904 === true).toBe(book.dateSystem === "1904");
        expect(A.map(theirs.Workbook?.Sheets ?? [], (sheet) => sheet.Hidden ?? 0)).toEqual(
          A.map(workbook.sheets, (sheet) =>
            sheet.info.state === "visible" ? 0 : sheet.info.state === "hidden" ? 1 : 2
          )
        );
        for (const sheet of workbook.sheets) {
          const expected = A.filter(
            A.map(sheet.rows, (row) => A.filter(A.map(row.cells, asSheetJs), (cell) => cell !== undefined)),
            (row) => row.length > 0
          );
          expect(A.filter(gridOf(theirs.Sheets[sheet.info.name]), (row) => row.length > 0)).toEqual(expected);
        }
      }),
    runs
  );
});

describe("the package reads what SheetJS writes", () => {
  it.effect.prop(
    "to the same values, formulas, formats, sheet names and states",
    [Arbitrary.schema(Book)],
    ([book]) =>
      Effect.gen(function* () {
        const theirs = utils.book_new();
        for (const name of named(book)) {
          const rows = A.map(book.table, (cells) =>
            A.map(cells, (cell): CellObject => {
              switch (cell.kind) {
                case "text":
                  return { t: "s", v: cell.text };
                case "number":
                  return { t: "n", v: cell.hundredths / 100 };
                case "boolean":
                  return { t: "b", v: cell.value };
                case "error":
                  return { t: "e", v: errorNumbers[cell.code] };
                case "date":
                  return { t: "n", v: cell.day, z: "yyyy-mm-dd" };
                case "formula":
                  return { t: "n", v: cell.hundredths / 100, f: `${cell.hundredths}/100` };
                case "textFormula":
                  return { t: "s", v: cell.text, f: 'TRIM(" x ")' };
              }
            })
          );
          utils.book_append_sheet(theirs, utils.aoa_to_sheet(rows, { dense: true }), name);
        }
        theirs.Workbook = {
          WBProps: { date1904: book.dateSystem === "1904" },
          Sheets: A.map(book.names, (_, index) => ({
            Hidden: index === 0 || book.state === "visible" ? 0 : book.state === "hidden" ? 1 : 2,
          })),
        };
        const bytes = new Uint8Array(
          write(theirs, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer
        );
        const found = yield* Xlsx.parse(bytes, large);
        expect(S.is(XlsxWorkbook)(found.workbook)).toBe(true);
        expect(found.workbook.dateSystem).toBe(book.dateSystem);
        expect(A.map(found.workbook.sheets, (sheet) => [sheet.info.name, sheet.info.state])).toEqual(
          A.map(named(book), (name, index) => [name, index === 0 ? "visible" : book.state])
        );
        const again = read(bytes, { type: "array", dense: true, cellFormula: true, cellNF: true, cellStyles: true });
        for (const sheet of found.workbook.sheets) {
          const mine = A.filter(
            A.map(sheet.rows, (row) => A.filter(A.map(row.cells, asSheetJs), (cell) => cell !== undefined)),
            (row) => row.length > 0
          );
          expect(mine).toEqual(A.filter(gridOf(again.Sheets[sheet.info.name]), (row) => row.length > 0));
        }
      }),
    runs
  );
});

const number = (value: number, code: string) =>
  XlsxCell.shown({ value: XlsxNumber.make({ value }), format: XlsxNumberFormat.make({ id: 164, code }) }, "1900");

describe("displayed text is what SheetJS displayed", () => {
  const Any = S.Finite.check(S.isBetween({ minimum: -1e15, maximum: 1e15 }));
  it.prop(
    "for the General format, on any number",
    [Arbitrary.schema(Any)],
    ([value]) => {
      expect(O.getOrUndefined(number(value, "General"))).toBe(formatted("General", value));
    },
    { arbitrary: { runs: 2000 } }
  );

  const Cents = S.Int.check(S.isBetween({ minimum: -9_999_999_999, maximum: 9_999_999_999 }));
  const codes = [
    "$#,##0.00",
    '"$"#,##0.00',
    '#,##0.00" kg"',
    "0.00",
    "#,##0.00",
    "0.00%",
    "[$€-407]#,##0.00",
    "$ #,##0.00",
    "#,##0.0000",
    "0.000",
  ];
  it.prop(
    "for plain number patterns, on money-like numbers of two decimals, where no rounding tie can occur",
    [Arbitrary.schema(Cents)],
    ([cents]) => {
      for (const code of codes)
        expect(
          [code, O.getOrUndefined(number(cents / 100, code))],
          'SheetJS rounded some ties down (826.045 as "$826.04") and dropped the minus of a negative rounding to zero'
        ).toEqual([code, formatted(code, cents / 100)]);
    },
    { arbitrary: { runs: 500 } }
  );

  const Whole = S.Int.check(S.isBetween({ minimum: 0, maximum: 9_999_999_999 }));
  it.prop(
    "for zero-padding and whole-number patterns, on whole numbers",
    [Arbitrary.schema(Whole)],
    ([value]) => {
      for (const code of ["00000", "000", "0", "#,##0", "0%"]) {
        expect([code, O.getOrUndefined(number(value, code))]).toEqual([code, formatted(code, value)]);
      }
    },
    { arbitrary: { runs: 500 } }
  );

  const dates = [
    "yyyy-mm-dd",
    "m/d/yy",
    "m/d/yyyy",
    "dd/mm/yyyy",
    "d-mmm-yy",
    "d-mmm",
    "mmm-yy",
    "h:mm AM/PM",
    "h:mm:ss AM/PM",
    "h:mm",
    "h:mm:ss",
    "m/d/yy h:mm",
    "mm:ss",
    "yyyy-mm-dd hh:mm",
    "dddd, mmmm d, yyyy",
    'yyyy-mm-dd"T"hh:mm:ss',
    "[$-409]d-mmm-yyyy;@",
    "hh:mm A/P",
    "mmmmm yy",
    "ddd",
  ];
  it.prop(
    "for date and time formats, in both date systems, at whole seconds that never round up to midnight",
    [
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 99_999 }))),
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 86_399 }))),
      Arbitrary.schema(XlsxDateSystem),
    ],
    ([day, seconds, system]) => {
      const serial = day + seconds / 86_400;
      for (const code of dates) {
        const cell = { value: XlsxDate.make({ serial }), format: XlsxNumberFormat.make({ id: 164, code }) };
        expect(
          [code, O.getOrUndefined(XlsxCell.shown(cell, system))],
          "at midnight SheetJS showed PM and lost the 1904 date system when the day moved on"
        ).toEqual([code, formatted(code, serial, system === "1904")]);
      }
    },
    { arbitrary: { runs: 500 } }
  );

  it("and a format is a date format exactly when SheetJS said so", () => {
    const all = [
      ...codes,
      ...dates,
      "General",
      "@",
      '"day"0',
      "[Red]0",
      "\\d0",
      "0 \\m",
      "#,##0_);(#,##0)",
      "0.00E+00",
      "[h]:mm:ss",
      "mmss.0",
      "[mm]:ss",
      "AM",
      "a",
      "G",
      "Gen",
      "_d0",
      "# ?/?",
      "e",
      "b2yyyy",
    ];
    for (const code of all) expect([code, XlsxNumberFormat.isDate({ code })]).toEqual([code, SSF.is_date(code)]);
  });
});
