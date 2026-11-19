// The round-trip laws, over workbooks the schema generates. They are about values, never bytes, and are stated up
// to `XlsxWorkbook.canonical`, the form a file gives a workbook back in: writing then reading returns the canonical
// workbook, and the canonical form does not move under a second pass.

import { Xlsx } from "@beep/xlsx/Xlsx.codec";
import { XlsxAddress, XlsxRange } from "@beep/xlsx/XlsxAddress.schema";
import {
  XlsxBlank,
  XlsxBoolean,
  XlsxCell,
  XlsxDate,
  XlsxError,
  XlsxNumber,
  XlsxNumberFormat,
  XlsxText,
  XlsxUnreadable,
} from "@beep/xlsx/XlsxCell.schema";
import { XlsxWriteOptions } from "@beep/xlsx/XlsxOptions.schema";
import { XlsxRow, XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type { XlsxRecord } from "@beep/xlsx/Xlsx.codec";

const runs = { arbitrary: { runs: 150 } };
const workbooks = Arbitrary.schema(XlsxWorkbook);

describe("a workbook written and read back", () => {
  it.effect.prop(
    "is its canonical form",
    [workbooks],
    ([workbook]) =>
      Effect.gen(function* () {
        const bytes = yield* Xlsx.stringify(workbook);
        const read = yield* Xlsx.parse(bytes);
        expect(S.is(XlsxWorkbook)(read.workbook)).toBe(true);
        expect(read.workbook).toEqual(XlsxWorkbook.canonical(workbook));
      }),
    runs
  );

  it.effect.prop(
    "is the same stored or deflated",
    [workbooks],
    ([workbook]) =>
      Effect.gen(function* () {
        const stored = yield* Xlsx.stringify(workbook, XlsxWriteOptions.make({ compression: "store" }));
        const read = yield* Xlsx.parse(stored);
        expect(read.workbook).toEqual(XlsxWorkbook.canonical(workbook));
      }),
    { arbitrary: { runs: 50 } }
  );

  // The writer puts rows in rising order, so the stream of each sheet is the rows a whole read keeps.
  it.effect.prop(
    "streams every sheet as the rows a whole read gives",
    [workbooks],
    ([workbook]) =>
      Effect.gen(function* () {
        const bytes = yield* Xlsx.stringify(workbook);
        const read = yield* Xlsx.parse(bytes);
        for (const sheet of read.workbook.sheets) {
          const streamed = yield* Stream.runCollect(Xlsx.rows(bytes, sheet.info.name));
          expect(streamed).toEqual(sheet.rows);
        }
      }),
    { arbitrary: { runs: 50 } }
  );

  it.effect.prop(
    "does not move under a second pass",
    [workbooks],
    ([workbook]) =>
      Effect.gen(function* () {
        const once = yield* Effect.flatMap(Xlsx.stringify(workbook), (bytes) => Xlsx.parse(bytes));
        const twice = yield* Effect.flatMap(Xlsx.stringify(once.workbook), (bytes) => Xlsx.parse(bytes));
        expect(twice.workbook).toEqual(once.workbook);
        expect(XlsxWorkbook.canonical(once.workbook)).toEqual(once.workbook);
      }),
    { arbitrary: { runs: 50 } }
  );

  it.effect("keeps text XML cannot hold as it is, numbers to the last digit, and every kind of value", () =>
    Effect.gen(function* () {
      const texts = [
        "",
        "  two spaces each side  ",
        "line one\r\nline two\rline three\nline four\ttab",
        "_x0041_ is not an A, and _x005F_ is itself",
        "control \u0001\u001f and \ufffe\uffff",
        "lone \ud800 and \udc00 surrogates, paired \ud83d\ude00",
        "<tag attr=\"1\"> & 'quotes' ]]>",
        "#N/A",
      ];
      const numbers = [0, -0, 0.1 + 0.2, 1e21, -1.5e-7, 5e-324, Number.MAX_VALUE, 123_456_789_012_345_680];
      const format = XlsxNumberFormat.make({ id: 7, code: '"a ""quoted"" <code>"0.00\n' });
      const workbook = XlsxWorkbook.make({
        dateSystem: "1904",
        sheets: [
          XlsxWorksheet.make({
            info: XlsxSheetInfo.make({
              name: 'A sheet & <its> "name" that is longer than Excel allows',
              state: "veryHidden",
            }),
            rows: [
              XlsxRow.make({
                number: 3,
                cells: A.map(texts, (text, column) => XlsxCell.make({ column, value: XlsxText.make({ text }) })),
              }),
              XlsxRow.make({
                number: 1,
                hidden: true,
                cells: A.map(numbers, (value, column) =>
                  XlsxCell.make({ column: 20 - column, value: XlsxNumber.make({ value }), format })
                ),
              }),
              XlsxRow.make({
                number: 2,
                cells: [
                  XlsxCell.make({
                    column: 0,
                    value: XlsxBoolean.make({ value: false }),
                    formula: O.some('IF(A1<2,"a&b",\n TRUE)'),
                  }),
                  XlsxCell.make({ column: 1, value: XlsxError.make({ code: "#DIV/0!" }), formula: O.some("") }),
                  XlsxCell.make({ column: 2, value: XlsxBlank.make({}), formula: O.some(" 1+1 ") }),
                  XlsxCell.make({ column: 3, value: XlsxBlank.make({}) }),
                  XlsxCell.make({ column: 4, value: XlsxDate.make({ serial: 60.5 }) }),
                  XlsxCell.make({ column: 5, value: XlsxUnreadable.make({ raw: " not a number " }) }),
                  XlsxCell.make({ column: 6, value: XlsxText.make({ text: "with a formula" }), formula: O.some("A1") }),
                ],
              }),
              XlsxRow.make({ number: 9, cells: [] }),
            ],
            merges: [
              XlsxRange.make({
                first: XlsxAddress.make({ column: 3, row: 4 }),
                last: XlsxAddress.make({ column: 1, row: 2 }),
              }),
            ],
            hiddenColumns: [5, 2],
          }),
          XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "empty" }) }),
        ],
      });
      const bytes = yield* Xlsx.stringify(workbook);
      const read = yield* Xlsx.parse(bytes);
      const canonical = XlsxWorkbook.canonical(workbook);
      expect(read.workbook).toEqual(canonical);
      const first = read.workbook.sheets[0];
      expect(A.map(first.rows, (row) => row.number)).toEqual([1, 2, 3, 9]);
      expect(A.map(first.rows[2]?.cells ?? [], (cell) => (cell.value.kind === "Text" ? cell.value.text : ""))).toEqual(
        texts
      );
      expect(
        A.map(first.rows[0]?.cells ?? [], (cell) => (cell.value.kind === "Number" ? cell.value.value : Number.NaN))
      ).toEqual(A.reverse(numbers));
      expect(first.merges).toEqual([{ first: { column: 1, row: 2 }, last: { column: 3, row: 4 } }]);
      expect(first.hiddenColumns).toEqual([2, 5]);
      expect(A.map(read.warnings, (warning) => warning.finding.kind)).toEqual([
        "FormulaWithoutResult",
        "UnreadableCell",
        "FormatNotShown",
      ]);
    })
  );

  it.prop("has a canonical form that canonical leaves alone", [workbooks], ([workbook]) => {
    const canonical = XlsxWorkbook.canonical(workbook);
    expect(S.is(XlsxWorkbook)(canonical)).toBe(true);
    expect(XlsxWorkbook.canonical(canonical)).toEqual(canonical);
  });
});

describe("the codecs", () => {
  it.effect.prop(
    "bytes to a workbook and back, as one Schema codec",
    [workbooks],
    ([workbook]) =>
      Effect.gen(function* () {
        const codec = Xlsx.XlsxFromBytes;
        const bytes = yield* S.encodeEffect(codec)(workbook);
        const back = yield* S.decodeEffect(codec)(bytes);
        expect(back).toEqual(XlsxWorkbook.canonical(workbook));
      }),
    { arbitrary: { runs: 50 } }
  );

  it.effect("refuses bytes that are no workbook as a schema issue", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(S.decodeEffect(Xlsx.XlsxFromBytes)(new Uint8Array([1, 2, 3])));
      expect(error.message).toContain("not an .xlsx workbook");
    })
  );

  const Item = S.Struct({
    SKU: S.toType(XlsxText),
    Quantity: S.toType(XlsxNumber),
    Active: S.toType(S.Union([XlsxBoolean, XlsxBlank])),
    Counted: S.toType(XlsxDate),
  });

  it.effect("one sheet's rows under its first row's headings, through a row schema", () =>
    Effect.gen(function* () {
      const codec = Xlsx.sheetFromBytes(Item, { sheet: "Items", header: "first" });
      const items = [
        {
          SKU: XlsxText.make({ text: "BRK-040" }),
          Quantity: XlsxNumber.make({ value: 120 }),
          Active: XlsxBoolean.make({ value: true }),
          Counted: XlsxDate.make({ serial: 46_085 }),
        },
        {
          SKU: XlsxText.make({ text: "HB-M8-30" }),
          Quantity: XlsxNumber.make({ value: 1500 }),
          Active: XlsxBlank.make({}),
          Counted: XlsxDate.make({ serial: 46_086.5 }),
        },
      ];
      const bytes = yield* S.encodeEffect(codec)(items);
      const back = yield* S.decodeEffect(codec)(bytes);
      expect(back).toEqual(items);
      const read = yield* Xlsx.parse(bytes);
      expect(A.map(read.workbook.sheets, (sheet) => [sheet.info.name, sheet.rows.length])).toEqual([["Items", 3]]);
    })
  );

  // A record has nowhere to put a cell its header row has no heading for, so such a cell stops the decode rather
  // than vanish: the same rule as a heading that is empty or used twice.
  it.effect("records refuse a cell with a value under a column the header row has no heading for", () =>
    Effect.gen(function* () {
      const header = XlsxRow.make({
        number: 1,
        cells: [
          XlsxCell.make({ column: 0, value: XlsxText.make({ text: "a" }) }),
          XlsxCell.make({ column: 2, value: XlsxText.make({ text: "c" }) }),
        ],
      });
      const line = XlsxRow.make({
        number: 2,
        cells: A.map([0, 1, 2], (column) => XlsxCell.make({ column, value: XlsxNumber.make({ value: column }) })),
      });
      const bytes = yield* Xlsx.stringify(
        XlsxWorkbook.make({
          sheets: [XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "S" }), rows: [header, line] })],
        })
      );
      const error = yield* Effect.flip(S.decodeEffect(Xlsx.recordsFromBytes({ sheet: "S", header: "first" }))(bytes));
      expect(error.message).toContain('the cell in column 2 of row 2 of "S" has no heading');
      const gapOnly = XlsxRow.make({
        number: 2,
        cells: [XlsxCell.make({ column: 0, value: XlsxNumber.make({ value: 1 }) })],
      });
      const fine = yield* Xlsx.stringify(
        XlsxWorkbook.make({
          sheets: [XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "S" }), rows: [header, gapOnly] })],
        })
      );
      const records = yield* S.decodeEffect(Xlsx.recordsFromBytes({ sheet: "S", header: "first" }))(fine);
      expect(records).toEqual([{ a: XlsxNumber.make({ value: 1 }), c: XlsxBlank.make({}) }]);
    })
  );

  it.effect("records keep a heading that would be a property of every object as an own property", () =>
    Effect.gen(function* () {
      const codec = Xlsx.recordsFromBytes({ sheet: "S", header: "first" });
      const record: XlsxRecord = { constructor: XlsxText.make({ text: "a" }), toString: XlsxNumber.make({ value: 1 }) };
      const bytes = yield* S.encodeEffect(codec)([record]);
      const back = yield* S.decodeEffect(codec)(bytes);
      expect(back).toEqual([record]);
    })
  );
});
