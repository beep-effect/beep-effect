import { Xlsx } from "@beep/xlsx/Xlsx.codec";
import { columnLetters, XlsxRange } from "@beep/xlsx/XlsxAddress.schema";
import { MAX_CELL_CHARS, XlsxCell, XlsxErrorCode, XlsxText, XlsxValue } from "@beep/xlsx/XlsxCell.schema";
import { XlsxFirstSheet, XlsxLimits, XlsxNamedSheets, XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema";
import { XlsxRow, XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema";
import { describe, expect, it } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { archive, partsOf, sheet, sheetWith, strict, strings, styles, workbook } from "./support/workbooks.ts";
import type { XlsxRead } from "@beep/xlsx/XlsxRead.schema";
import type { Recipe } from "./support/workbooks.ts";

const read = (bytes: Uint8Array, options?: XlsxReadOptions) =>
  Xlsx.parse(bytes, options).pipe(
    Effect.tap((found) =>
      Effect.sync(() =>
        expect(
          S.is(XlsxWorkbook)(found.workbook),
          "every workbook read is held to its schema, which lets the reader build cells with disableChecks"
        ).toBe(true)
      )
    )
  );

const readOf = (recipe: Recipe, options?: XlsxReadOptions) =>
  Effect.flatMap(workbook(recipe), (bytes) => read(bytes, options));

const first = (found: XlsxRead): XlsxWorksheet => found.workbook.sheets[0];

const heldOf = XlsxValue.match({
  Text: (value) => `"${value.text}"`,
  Number: (value) => String(value.value),
  Date: (value) => `date ${value.serial}`,
  Boolean: (value) => String(value.value),
  Error: (value) => value.code,
  Unreadable: (value) => `unreadable "${value.raw}"`,
  Blank: () => "blank",
});

const grid = (found: XlsxWorksheet) =>
  A.map(found.rows, (row) => [
    row.number,
    ...A.map(
      row.cells,
      (cell) =>
        `${cell.column}:${heldOf(cell.value)}${O.match(cell.formula, { onNone: () => "", onSome: (f) => ` =${f}` })}`
    ),
  ]);
const findings = (found: XlsxRead) => A.map(found.warnings, (warning) => warning.finding.kind);
const byFirst = Order.mapInput(Order.Number, (pair: readonly [number, number]) => pair[0]);

describe("cells", () => {
  it.effect("reads shared, inline and formula text, joins formatted runs and leaves phonetic ones out", () =>
    Effect.gen(function* () {
      const bytes = yield* workbook({
        sheets: [
          {
            name: "Items",
            xml: sheet(
              '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>inline</t></is></c>' +
                '<c r="C1" t="str"><f>A1&amp;"!"</f><v>shared!</v></c><c r="D1" t="s"><v>1</v></c>' +
                '<c r="E1" t="inlineStr"><is><r><t>rich </t></r><r><rPr><b/></rPr><t>inline</t></r></is></c>' +
                '<c r="F1" t="s"><v>2</v></c></row>'
            ),
          },
        ],
        sharedStrings: strings([
          "<t>shared</t>",
          '<r><t>Tokyo</t></r><r><rPr><b/></rPr><t xml:space="preserve"> bold</t></r><rPh sb="0" eb="2"><t>トウキョウ</t></rPh>',
          "<t>line_x000D_break and _x005F_x0041_</t>",
        ]),
      });
      const found = yield* read(bytes);
      expect(grid(first(found))).toEqual([
        [
          1,
          '0:"shared"',
          '1:"inline"',
          '2:"shared!" =A1&"!"',
          '3:"Tokyo bold"',
          '4:"rich inline"',
          '5:"line\rbreak and _x0041_"',
        ],
      ]);
    })
  );

  it.effect("reads numbers, booleans, errors and dates by their format, in both date systems", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="1"><c r="A1"><v>12.5</v></c><c r="B1" t="n"><v>-3e2</v></c><c r="C1" t="b"><v>1</v></c>' +
        '<c r="D1" t="e"><v>#N/A</v></c><c r="E1" s="1"><v>46085</v></c><c r="F1" s="2"><v>0.75</v></c>' +
        '<c r="G1" s="1"><v>-1</v></c></row>';
      const recipe = { sheets: [{ name: "S", xml: sheet(rows) }], styles: styles(["yyyy-mm-dd", "h:mm"]) };
      const found = yield* readOf(recipe);
      expect(grid(first(found))).toEqual([
        [1, "0:12.5", "1:-300", "2:true", "3:#N/A", "4:date 46085", "5:date 0.75", "6:-1"],
      ]);
      const cells = first(found).rows[0]?.cells ?? [];
      expect(A.map(cells, (cell) => O.getOrUndefined(XlsxCell.shown(cell, found.workbook.dateSystem)))).toEqual([
        "12.5",
        "-300",
        undefined,
        undefined,
        "2026-03-04",
        "18:00",
        undefined,
      ]);
      const later = yield* readOf({ ...recipe, workbookPr: '<workbookPr date1904="1"/>' });
      expect(later.workbook.dateSystem).toBe("1904");
      expect(O.getOrUndefined(XlsxCell.shown(first(later).rows[0]?.cells[4] ?? XlsxCell.blank(0), "1904"))).toBe(
        "2030-03-05"
      );
    })
  );

  it.effect("reports serial 60 of the 1900 system, the day that never was", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="1"><c r="A1" s="1"><v>59</v></c><c r="B1" s="1"><v>60</v></c><c r="C1" s="1"><v>61</v></c></row>';
      const found = yield* readOf({ sheets: [{ name: "S", xml: sheet(rows) }], styles: styles(["yyyy-mm-dd"]) });
      const shown = A.map(first(found).rows[0]?.cells ?? [], (cell) => O.getOrUndefined(XlsxCell.shown(cell, "1900")));
      expect(shown).toEqual(["1900-02-28", "1900-02-29", "1900-03-01"]);
      expect(A.map(found.warnings, (warning) => warning.finding)).toMatchObject([
        { kind: "FictitiousLeapDay", sheet: "S", address: { column: 1, row: 1 } },
      ]);
    })
  );

  it.effect("gives each cell that shares a formula its own text", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="2"><c r="C2"><f t="shared" ref="C2:C4" si="0">A2*$B$1+B2</f><v>1</v></c></row>' +
        '<row r="3"><c r="C3"><f t="shared" si="0"/><v>2</v></c></row>' +
        '<row r="4"><c r="C4"><f t="shared" si="0"/><v>3</v></c><c r="D4"><f t="shared" si="0"/><v>4</v></c></row>';
      const found = yield* readOf({ sheets: [{ name: "S", xml: sheet(rows) }] });
      expect(grid(first(found))).toEqual([
        [2, "2:1 =A2*$B$1+B2"],
        [3, "2:2 =A3*$B$1+B3"],
        [4, "2:3 =A4*$B$1+B4", "3:4 =B4*$B$1+C4"],
      ]);
    })
  );

  it.effect("keeps a formula with no saved result as blank and says so", () =>
    Effect.gen(function* () {
      const found = yield* readOf({
        sheets: [{ name: "S", xml: sheet('<row r="1"><c r="A1"><f>NOW()</f></c><c r="B1" s="0"/></row>') }],
      });
      expect(grid(first(found))).toEqual([[1, "0:blank =NOW()"]]);
      expect(findings(found)).toEqual(["FormulaWithoutResult"]);
    })
  );

  it.effect("reads the rest of a sheet round a cell the file gets wrong, and names the cell", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="1"><c r="A1" t="s"><v>7</v></c><c r="B1"><v>twelve</v></c><c r="C1" t="b"><v>maybe</v></c>' +
        '<c r="D1" t="e"><v>#OOPS</v></c><c r="E1" t="d"><v>not a date</v></c><c r="F1" s="9"><v>1</v></c><c r="G1"><v>2</v></c></row>';
      const found = yield* readOf({ sheets: [{ name: "S", xml: sheet(rows) }], sharedStrings: strings(["<t>a</t>"]) });
      expect(grid(first(found))).toEqual([
        [
          1,
          '0:unreadable "7"',
          '1:unreadable "twelve"',
          '2:unreadable "maybe"',
          '3:unreadable "#OOPS"',
          '4:unreadable "not a date"',
          "5:1",
          "6:2",
        ],
      ]);
      expect(A.map(found.warnings, (warning) => warning.finding)).toMatchObject([
        { kind: "UnreadableCell", reason: "sharedString", address: { column: 0, row: 1 } },
        { kind: "UnreadableCell", reason: "number" },
        { kind: "UnreadableCell", reason: "boolean" },
        { kind: "UnreadableCell", reason: "errorCode" },
        { kind: "UnreadableCell", reason: "date" },
        { kind: "UnknownStyle", style: "9", address: { column: 5, row: 1 } },
      ]);
    })
  );

  it.effect("keeps a shared text index that is not written in decimal digits as unreadable", () =>
    Effect.gen(function* () {
      const written = ["", " ", "0x0", "1e0", "0.0", "+0"];
      const cells = A.join(
        A.map(written, (index, i) => `<c r="${columnLetters(i)}1" t="s"><v>${index}</v></c>`),
        ""
      );
      const rows = `<row r="1">${cells}<c r="G1" t="s"><v>0</v></c><c r="H1" t="s"><v> 1 </v></c></row>`;
      const found = yield* readOf({
        sheets: [{ name: "S", xml: sheet(rows) }],
        sharedStrings: strings(["<t>zero</t>", "<t>one</t>"]),
      });
      expect(
        grid(first(found)),
        "an empty index, or one Number reads as another (0x0, 1e0, a space), names no entry, never the first one"
      ).toEqual([[1, ...A.map(written, (index, i) => `${i}:unreadable "${index}"`), '6:"zero"', '7:"one"']]);
      expect(findings(found)).toEqual(A.map(written, () => "UnreadableCell"));
    })
  );

  const Garbled = S.Union([XlsxErrorCode, S.String.check(S.isPattern(/^[#A-Za-z][A-Za-z !/#?]{0,10}$/))]);
  it.effect.prop(
    "keeps what a number cell wrote that is no number as the text it wrote, error codes included",
    [Arbitrary.schema(Garbled)],
    ([written]) =>
      Effect.gen(function* () {
        const found = yield* readOf({
          sheets: [{ name: "S", xml: sheet(`<row r="1"><c r="A1"><v>${written}</v></c></row>`) }],
        });
        expect(
          grid(first(found)),
          "#N/A in a number cell is the text #N/A, which canonical form and a write give back as that text and no other"
        ).toEqual([[1, `0:unreadable "${written}"`]]);
        expect(findings(found)).toEqual(["UnreadableCell"]);
        const canonical = O.map(O.fromNullishOr(first(found).rows[0]?.cells[0]), (cell) =>
          XlsxCell.canonical(cell, "1900")
        );
        assertSome(
          O.map(canonical, (cell) => cell.value),
          XlsxText.make({ text: written })
        );
      }),
    { arbitrary: { runs: 100 } }
  );

  it.effect("holds a cell's text to the cap on characters once its escapes are read", () =>
    Effect.gen(function* () {
      const returns = Str.repeat(5000)("_x000D_");
      const rows = `<row r="1"><c r="A1" t="inlineStr"><is><t>${returns}</t></is></c><c r="B1" t="s"><v>0</v></c></row>`;
      const recipe: Recipe = {
        sheets: [{ name: "S", xml: sheet(rows) }],
        sharedStrings: strings([`<t>${returns}</t>`]),
      };
      const limits = XlsxLimits.make({ maxCellChars: 5000 });
      const found = yield* readOf(recipe, XlsxReadOptions.make({ limits }));
      const cells = A.map(first(found).rows[0]?.cells ?? [], (cell) => cell.value);
      expect(
        cells,
        "a cell of carriage returns, each written as _x000D_, takes seven times its length and still reads under the cap"
      ).toEqual([XlsxText.make({ text: Str.repeat(5000)("\r") }), XlsxText.make({ text: Str.repeat(5000)("\r") })]);
      const tighter = XlsxReadOptions.make({ limits: XlsxLimits.make({ maxCellChars: 4999 }) });
      const inline = yield* Effect.flip(readOf({ sheets: recipe.sheets }, tighter));
      expect(inline.fatal.finding).toMatchObject({ kind: "LimitExceeded", limit: "cellChars" });
      const shared = yield* Effect.flip(readOf(recipe, tighter));
      expect(shared.fatal.finding).toMatchObject({
        kind: "LimitExceeded",
        limit: "cellChars",
        path: "xl/sharedStrings.xml",
      });
    })
  );

  it.effect.prop(
    "reads back a text cell of carriage returns and underscores written at the cap on characters",
    [S.Array(S.Literals(["\r", "_", "a", "_x0041_"])).check(S.isMinLength(1), S.isMaxLength(8))],
    ([pieces]) =>
      Effect.gen(function* () {
        const text = Str.repeat(Math.floor(MAX_CELL_CHARS / A.join(pieces, "").length))(A.join(pieces, ""));
        const original = XlsxWorkbook.make({
          sheets: [
            XlsxWorksheet.make({
              info: XlsxSheetInfo.make({ name: "S" }),
              rows: [
                XlsxRow.make({ number: 1, cells: [XlsxCell.make({ column: 0, value: XlsxText.make({ text }) })] }),
              ],
            }),
          ],
        });
        const bytes = yield* Xlsx.stringify(original);
        const back = yield* read(bytes);
        expect(first(back).rows[0]?.cells[0]?.value).toEqual(XlsxText.make({ text }));
      }),
    { arbitrary: { runs: 20 } }
  );

  it.effect("keeps an ISO date with an impossible time as unreadable, and reports it", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="1"><c r="A1" t="d"><v>2026-03-04T99:99:99</v></c><c r="B1" t="d"><v>2026-03-04T24:00:00</v></c>' +
        '<c r="C1" t="d"><v>2026-03-04T12:60:00</v></c><c r="D1" t="d"><v>2026-03-04T23:59:59</v></c></row>';
      const found = yield* readOf({ sheets: [{ name: "S", xml: sheet(rows) }] });
      expect(
        grid(first(found)),
        "a time past the calendar is not carried into a later day, and ISO's 24:00:00 is refused the same way"
      ).toEqual([
        [
          1,
          '0:unreadable "2026-03-04T99:99:99"',
          '1:unreadable "2026-03-04T24:00:00"',
          '2:unreadable "2026-03-04T12:60:00"',
          `3:date ${46_085 + 86_399 / 86_400}`,
        ],
      ]);
      expect(A.map(found.warnings, (warning) => warning.finding)).toMatchObject([
        { kind: "UnreadableCell", reason: "date", address: { column: 0, row: 1 } },
        { kind: "UnreadableCell", reason: "date", address: { column: 1, row: 1 } },
        { kind: "UnreadableCell", reason: "date", address: { column: 2, row: 1 } },
      ]);
    })
  );

  it.effect("reads a 1904 date the system shows and refuses a number or ISO date past its last day", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="1"><c r="A1" s="1"><v>2957003</v></c><c r="B1" s="1"><v>2958000</v></c>' +
        '<c r="C1" t="d"><v>9999-12-31</v></c></row>';
      const found = yield* readOf({
        sheets: [{ name: "S", xml: sheet(rows) }],
        styles: styles(["yyyy-mm-dd"]),
        workbookPr: '<workbookPr date1904="1"/>',
      });
      expect(grid(first(found))).toEqual([[1, "0:date 2957003", "1:2958000", "2:date 2957003"]]);
    })
  );

  it.effect("reads ISO dates to the last second of each system, keeps fractions of a second, and refuses day 0", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="1"><c r="A1" t="d"><v>9999-12-31T23:59:59</v></c><c r="B1" t="d"><v>2026-03-04T12:00:00.5</v></c>' +
        '<c r="C1" t="d"><v>1900-01-00</v></c><c r="D1" t="d"><v>9999-12-31T23:59:59.5</v></c></row>';
      const found = yield* readOf({ sheets: [{ name: "S", xml: sheet(rows) }] });
      expect(
        grid(first(found)),
        "23:59:59 on 31 December 9999 is the last moment either system shows; only a serial names day 0"
      ).toEqual([
        [
          1,
          `0:date ${2_958_465 + 86_399 / 86_400}`,
          `1:date ${46_085.5 + 0.5 / 86_400}`,
          '2:unreadable "1900-01-00"',
          '3:unreadable "9999-12-31T23:59:59.5"',
        ],
      ]);
      const later = yield* readOf({
        sheets: [{ name: "S", xml: sheet(rows) }],
        workbookPr: '<workbookPr date1904="1"/>',
      });
      expect(first(later).rows[0]?.cells[0]?.value).toEqual({ kind: "Date", serial: 2_957_003 + 86_399 / 86_400 });
      expect(
        A.map(first(later).rows[0]?.cells ?? [], (cell) => O.getOrUndefined(XlsxCell.shown(cell, "1904")))[0]
      ).toBe("12/31/99");
    })
  );

  it.effect("counts the cells whose format it does not render", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="1"><c r="A1" s="1"><v>0.5</v></c><c r="B1" s="1"><v>0.25</v></c><c r="C1" s="2"><v>1.5</v></c><c r="D1" s="1" t="inlineStr"><is><t>x</t></is></c></row>';
      const found = yield* readOf({
        sheets: [{ name: "S", xml: sheet(rows) }],
        styles: styles(["# ?/?", "[h]:mm:ss"]),
      });
      expect(A.map(found.warnings, (warning) => warning.finding)).toMatchObject([
        { kind: "FormatNotShown", code: "# ?/?", cells: 2 },
        { kind: "FormatNotShown", code: "[h]:mm:ss", cells: 1 },
      ]);
    })
  );
});

describe("layout", () => {
  it.effect("places rows and cells that say nothing of where they are after the one before", () =>
    Effect.gen(function* () {
      const rows =
        '<row><c><v>1</v></c><c><v>2</v></c></row><row r="5"><c r="C5"><v>3</v></c><c><v>4</v></c></row><row><c><v>5</v></c></row>';
      const found = yield* readOf({ sheets: [{ name: "S", xml: sheet(rows) }] });
      expect(grid(first(found))).toEqual([
        [1, "0:1", "1:2"],
        [5, "2:3", "3:4"],
        [6, "0:5"],
      ]);
    })
  );

  it.effect("places a cell or row that names no place after the one written just before it", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="1"><c r="C1"/><c><v>7</v></c></row>' +
        '<row r="2"><c r="E2"><v>1</v></c><c r="B2"><v>2</v></c><c><v>3</v></c></row>' +
        '<row r="9"><c><v>9</v></c></row><row r="4"><c><v>4</v></c></row><row><c><v>5</v></c></row>';
      const found = yield* readOf({ sheets: [{ name: "S", xml: sheet(rows) }] });
      expect(
        grid(first(found)),
        "a blank cell still moves the place on, and a row or cell written out of order is the one before"
      ).toEqual([
        [1, "3:7"],
        [2, "1:2", "2:3", "4:1"],
        [4, "0:4"],
        [5, "0:5"],
        [9, "0:9"],
      ]);
    })
  );

  const Placed = S.Struct({ at: S.Option(S.Int.check(S.isBetween({ minimum: 0, maximum: 30 }))), blank: S.Boolean });
  it.effect.prop(
    "places every cell that names no column after the cell written before it",
    [S.Array(Placed).check(S.isMaxLength(12))],
    ([cells]) =>
      Effect.gen(function* () {
        const xml = A.join(
          A.map(cells, (cell, i) => {
            const at = O.match(cell.at, { onNone: () => "", onSome: (column) => ` r="${columnLetters(column)}1"` });
            return cell.blank ? `<c${at}/>` : `<c${at}><v>${i}</v></c>`;
          }),
          ""
        );
        const found = yield* readOf({ sheets: [{ name: "S", xml: sheet(`<row r="1">${xml}</row>`) }] });
        const kept = MutableHashSet.empty<number>();
        const expected: Array<readonly [number, number]> = [];
        let preceding = -1;
        for (const [i, cell] of cells.entries()) {
          const column = O.getOrElse(cell.at, () => preceding + 1);
          preceding = column;
          if (cell.blank || MutableHashSet.has(kept, column)) continue;
          MutableHashSet.add(kept, column);
          expected.push([column, i]);
        }
        const placed = A.map(A.sort(expected, byFirst), ([column, i]) => `${column}:${i}`);
        expect(
          grid(first(found)),
          "each cell is at the column it names, else one past the cell before; the first value of a column is kept"
        ).toEqual(A.isArrayNonEmpty(placed) ? [[1, ...placed]] : [[1]]);
      }),
    { arbitrary: { runs: 60 } }
  );

  it.effect.prop(
    "numbers every row that names no number after the row written before it",
    [
      S.Int.check(S.isBetween({ minimum: 1, maximum: 40 }))
        .pipe(S.Option, S.Array)
        .check(S.isMaxLength(12)),
    ],
    ([rows]) =>
      Effect.gen(function* () {
        const xml = A.join(
          A.map(rows, (at, i) => {
            const number = O.match(at, { onNone: () => "", onSome: (n) => ` r="${n}"` });
            return `<row${number}><c><v>${i}</v></c></row>`;
          }),
          ""
        );
        const found = yield* readOf({ sheets: [{ name: "S", xml: sheet(xml) }] });
        const kept = MutableHashSet.empty<number>();
        const expected: Array<readonly [number, number]> = [];
        let preceding = 0;
        for (const [i, at] of rows.entries()) {
          const number = O.getOrElse(at, () => preceding + 1);
          preceding = number;
          if (MutableHashSet.has(kept, number)) continue;
          MutableHashSet.add(kept, number);
          expected.push([number, i]);
        }
        expect(
          grid(first(found)),
          "each row is the number it names, else one past the row before; the first row of a number is kept"
        ).toEqual(A.map(A.sort(expected, byFirst), ([number, i]) => [number, `0:${i}`]));
      }),
    { arbitrary: { runs: 60 } }
  );

  it.effect("puts rows and cells written out of order in their place, and says a row came late", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="3"><c r="B3"><v>2</v></c><c r="A3"><v>1</v></c></row><row r="1"><c r="A1"><v>0</v></c></row><row r="3"><c r="A3"><v>9</v></c></row>';
      const found = yield* readOf({ sheets: [{ name: "S", xml: sheet(rows) }] });
      expect(grid(first(found))).toEqual([
        [1, "0:0"],
        [3, "0:1", "1:2"],
      ]);
      expect(findings(found)).toEqual(["RowOutOfOrder", "RowOutOfOrder"]);
    })
  );

  it.effect("reads merged ranges, hidden rows and columns, and the extent a sheet declares", () =>
    Effect.gen(function* () {
      const xml = sheetWith({
        rows: '<row r="1" hidden="1"><c r="A1"><v>1</v></c></row><row r="2"><c r="D2"><v>2</v></c></row>',
        before: '<dimension ref="A1:D2"/><cols><col min="2" max="3" hidden="1"/><col min="5" max="5"/></cols>',
        after: '<mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells>',
      });
      const bytes = yield* workbook({ sheets: [{ name: "S", xml }] });
      const whole = yield* read(bytes);
      const found = first(whole);
      expect(A.map(found.rows, (row) => row.hidden)).toEqual([true, false]);
      expect(found.hiddenColumns).toEqual([1, 2]);
      expect(found.merges).toEqual([{ first: { column: 0, row: 1 }, last: { column: 1, row: 1 } }]);
      expect(O.getOrUndefined(found.info.declared)).toEqual({
        first: { column: 0, row: 1 },
        last: { column: 3, row: 2 },
      });
      const layout = yield* Xlsx.sheetLayout(bytes, "s");
      expect([layout.rows, layout.merges, layout.hiddenColumns]).toEqual([[], found.merges, [1, 2]]);
    })
  );

  it.effect("does not trust a declared extent, and says when it misses the cells", () =>
    Effect.gen(function* () {
      const xml = sheetWith({
        rows: '<row r="1"><c r="A1"><v>1</v></c></row><row r="40"><c r="H40"><v>2</v></c></row>',
        before: '<dimension ref="A1:B2"/>',
      });
      const found = yield* readOf({ sheets: [{ name: "S", xml }] });
      expect(grid(first(found))).toEqual([
        [1, "0:1"],
        [40, "7:2"],
      ]);
      expect(findings(found)).toEqual(["DeclaredExtentWrong"]);
      const finding = found.warnings[0]?.finding;
      assertTrue(finding?.kind === "DeclaredExtentWrong");
      assertSome(O.map(finding.found, XlsxRange.format), "A1:H40");
    })
  );
});

describe("the file's own form", () => {
  it.effect("reads the same whether the shared text comes before the sheets or after them", () =>
    Effect.gen(function* () {
      const recipe = {
        sheets: [
          { name: "S", xml: sheet('<row r="1"><c r="A1" t="s"><v>1</v></c><c r="B1" t="s"><v>0</v></c></row>') },
        ],
        sharedStrings: strings(["<t>zero</t>", "<t>one</t>"]),
      };
      const after = yield* readOf(recipe);
      const before = yield* readOf({ ...recipe, stringsFirst: true });
      expect(grid(first(after))).toEqual([[1, '0:"one"', '1:"zero"']]);
      expect(before.workbook).toEqual(after.workbook);
    })
  );

  it.effect("finds a part its relationship names in another case", () =>
    Effect.gen(function* () {
      const parts = A.map(
        partsOf({ sheets: [{ name: "S", xml: sheet('<row r="1"><c r="A1"><v>7</v></c></row>') }] }),
        ([path, text]): readonly [string, string | Uint8Array] =>
          path === "xl/_rels/workbook.xml.rels" && P.isString(text)
            ? [path, Str.replace("worksheets/sheet1.xml", "WORKSHEETS/SHEET1.XML")(text)]
            : [path, text]
      );
      const bytes = yield* archive(parts);
      const found = yield* read(bytes);
      expect(grid(first(found)), "OPC compares part names without regard to ASCII case").toEqual([[1, "0:7"]]);
    })
  );

  it.effect("reads a workbook whose part names are in another case, the workbook part's included", () =>
    Effect.gen(function* () {
      const parts = partsOf({ sheets: [{ name: "S", xml: sheet('<row r="1"><c r="A1"><v>7</v></c></row>') }] });
      const upper = yield* archive(
        A.map(parts, ([path, text]): readonly [string, string | Uint8Array] => [Str.toUpperCase(path), text])
      );
      expect(Xlsx.container(upper), "the names that say what the file is compare without regard to ASCII case").toBe(
        "workbook"
      );
      const upperRead = yield* read(upper);
      expect(grid(first(upperRead))).toEqual([[1, "0:7"]]);
      const capital = yield* archive(
        A.map(parts, ([path, text]): readonly [string, string | Uint8Array] => [
          path === "xl/workbook.xml" ? "xl/Workbook.xml" : path,
          text,
        ])
      );
      expect(Xlsx.container(capital)).toBe("workbook");
      const capitalRead = yield* read(capital);
      expect(grid(first(capitalRead))).toEqual([[1, "0:7"]]);
      const macros = yield* archive([...parts, ["XL/VBAPROJECT.BIN", new Uint8Array([1, 2, 3])]]);
      expect(Xlsx.container(macros), "macros are found in any case too").toBe("macroWorkbook");
      const found = yield* read(macros);
      expect(found.workbook.dropped).toEqual([{ path: "XL/VBAPROJECT.BIN", kind: "macros" }]);
    })
  );

  it.effect("reads prefixed element names", () =>
    Effect.gen(function* () {
      const xml =
        '<?xml version="1.0"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<x:sheetData><x:row r="1"><x:c r="A1" t="inlineStr"><x:is><x:t>prefixed</x:t></x:is></x:c><x:c r="B1"><x:v>2</x:v></x:c></x:row></x:sheetData></x:worksheet>';
      const found = yield* readOf({ sheets: [{ name: "S", xml }] });
      expect(grid(first(found))).toEqual([[1, '0:"prefixed"', "1:2"]]);
    })
  );

  it.effect("reads a Strict workbook, with its dates written out", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="1"><c r="A1" t="d" s="1"><v>2026-03-04</v></c><c r="B1" t="d"><v>2026-03-04T14:30:00Z</v></c></row>';
      const found = yield* readOf({
        namespace: strict,
        sheets: [{ name: "S", xml: sheetWith({ rows, ns: strict }) }],
        styles: styles(["yyyy-mm-dd"]),
      });
      const cells = first(found).rows[0]?.cells ?? [];
      expect(A.map(cells, (cell) => [cell.value, cell.format.code])).toMatchObject([
        [{ kind: "Date", serial: 46_085 }, "yyyy-mm-dd"],
        [{ kind: "Date" }, "m/d/yy"],
      ]);
      expect(O.getOrUndefined(XlsxCell.shown(cells[1] ?? XlsxCell.blank(0), "1900"))).toBe("3/4/26");
    })
  );

  it.effect("names the parts it read past, and the sheets it was not asked for stay named", () =>
    Effect.gen(function* () {
      const cell = (n: number) => sheet(`<row r="1"><c r="A1"><v>${n}</v></c></row>`);
      const bytes = yield* workbook({
        sheets: [
          { name: "One", xml: cell(1) },
          { name: "Two", xml: cell(2), state: "hidden" },
          { name: "Three", xml: cell(3), state: "veryHidden" },
        ],
        extra: [
          ["xl/theme/theme1.xml", "<a/>"],
          ["docProps/app.xml", "<a/>"],
          ["xl/vbaProject.bin", "x"],
          ["xl/comments1.xml", "<a/>"],
        ],
      });
      expect(Xlsx.container(bytes)).toBe("macroWorkbook");
      const all = yield* read(bytes);
      expect(A.map(all.workbook.dropped, (part) => part.kind)).toEqual(["theme", "properties", "macros", "comments"]);
      expect(A.map(all.workbook.sheets, (s) => [s.info.name, s.info.state, s.rows.length])).toEqual([
        ["One", "visible", 1],
        ["Two", "hidden", 1],
        ["Three", "veryHidden", 1],
      ]);
      const named = yield* read(bytes, XlsxReadOptions.make({ sheets: XlsxNamedSheets.make({ names: ["three"] }) }));
      expect(A.map(named.workbook.sheets, (s) => s.rows.length)).toEqual([0, 0, 1]);
      const one = yield* read(bytes, XlsxReadOptions.make({ sheets: XlsxFirstSheet.make({}) }));
      expect(A.map(one.workbook.sheets, (s) => s.rows.length)).toEqual([1, 0, 0]);
      expect(A.map(XlsxWorkbook.visible(all.workbook), (s) => s.info.name)).toEqual(["One"]);
    })
  );
});

describe("one sheet at a time", () => {
  const rows = A.join(
    A.map(
      A.range(1, 300),
      (n) =>
        `<row r="${n}"><c r="A${n}"><v>${n}</v></c>${n % 3 === 0 ? `<c r="B${n}" t="inlineStr"><is><t></t></is></c>` : ""}</row>`
    ),
    ""
  );
  const recipe = {
    sheets: [
      { name: "Empty", xml: sheet("") },
      { name: "Data", xml: sheet(`${rows}<row r="400"/>`) },
    ],
  };

  it.effect("counts every sheet without keeping it", () =>
    Effect.gen(function* () {
      const bytes = yield* workbook(recipe);
      const counts = yield* Xlsx.sheets(bytes);
      expect(
        A.map(counts, (c) => [c.info.name, c.rows, c.rowsWithValues, c.cellsWithValues, O.getOrUndefined(c.lastRow)])
      ).toEqual([
        ["Empty", 0, 0, 0, undefined],
        ["Data", 301, 300, 300, 300],
      ]);
    })
  );

  it.effect("streams one sheet's rows: on a sheet written in order, the same rows a whole read gives", () =>
    Effect.gen(function* () {
      const bytes = yield* workbook(recipe);
      const streamed = yield* Stream.runCollect(Xlsx.rows(bytes, "data"));
      const whole = yield* read(bytes);
      expect(streamed).toEqual(whole.workbook.sheets[1]?.rows);
      const missing = yield* Xlsx.rows(bytes, "Nope").pipe(Stream.runCollect, Effect.flip);
      expect(missing.fatal.finding).toMatchObject({ kind: "MissingPart" });
    })
  );

  it.effect("streams a row number a sheet repeats each time, where a whole read keeps the first", () =>
    Effect.gen(function* () {
      const rows =
        '<row r="3"><c r="A3"><v>3</v></c></row><row r="1"><c r="A1"><v>1</v></c></row><row r="3"><c r="A3"><v>9</v></c></row>';
      const bytes = yield* workbook({ sheets: [{ name: "S", xml: sheet(rows) }] });
      const streamed = yield* Stream.runCollect(Xlsx.rows(bytes, "S"));
      const whole = yield* read(bytes);
      expect(A.map(streamed, (row) => row.number)).toEqual([3, 1, 3]);
      expect(grid(first(whole))).toEqual([
        [1, "0:1"],
        [3, "0:3"],
      ]);
    })
  );
});

describe("relationships", () => {
  it.effect("resolves absolute and relative targets, with their dot segments", () =>
    Effect.gen(function* () {
      const targets = [
        "/xl/worksheets/sheet1.xml",
        "/xl/./worksheets/sheet1.xml",
        "/xl/worksheets/../worksheets/sheet1.xml",
        "../../../xl/worksheets/sheet1.xml",
        "./worksheets/sheet1.xml",
      ];
      const parts = partsOf({ sheets: [{ name: "S", xml: sheet('<row r="1"><c r="A1"><v>1</v></c></row>') }] });
      const counts = yield* Effect.forEach(
        targets,
        (target) =>
          Effect.flatMap(
            archive(
              A.map(parts, ([path, text]) =>
                path === "xl/_rels/workbook.xml.rels" && P.isString(text)
                  ? ([path, Str.replace('Target="worksheets/sheet1.xml"', `Target="${target}"`)(text)] as const)
                  : ([path, text] as const)
              )
            ),
            (bytes) => Effect.map(read(bytes), (found) => first(found).rows.length)
          ),
        { concurrency: 1 }
      );
      expect(
        counts,
        "a target resolves inside the archive, from its part or the root, and a .. past the root stays at the root"
      ).toEqual([1, 1, 1, 1, 1]);
    })
  );
});

describe("what a file is", () => {
  const bytesOf = (head: ReadonlyArray<number>, text: string, wide = false): Uint8Array => {
    const letters = new TextEncoder().encode(text);
    const body = A.flatMap(A.fromIterable(letters), (unit) => (wide ? [unit, 0] : [unit]));
    return new Uint8Array([...head, ...body]);
  };
  const zip = [0x50, 0x4b, 0x03, 0x04];
  const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

  it("is told from the first bytes and the names inside", () => {
    expect([
      Xlsx.container(bytesOf(zip, "....xl/workbook.xml")),
      Xlsx.container(bytesOf(zip, "xl/workbook.bin")),
      Xlsx.container(bytesOf(zip, "mimetypeapplication/vnd.oasis.opendocument.spreadsheet")),
      Xlsx.container(bytesOf(zip, "word/document.xml")),
      Xlsx.container(bytesOf(zip, "readme.txt")),
      Xlsx.container(bytesOf(ole, "EncryptedPackage", true)),
      Xlsx.container(bytesOf(ole, "Workbook", true)),
      Xlsx.container(bytesOf(ole, "PowerPoint Document", true)),
      Xlsx.container(bytesOf([0x53, 0x4b, 0x55], ",Name")),
    ]).toEqual([
      "workbook",
      "binaryWorkbook",
      "openDocument",
      "word",
      "otherZip",
      "encrypted",
      "legacyXls",
      "otherOle",
      "notAnArchive",
    ]);
  });

  it.effect("refuses every container that is not a workbook, naming what it is", () =>
    Effect.gen(function* () {
      const others = [
        bytesOf(zip, "xl/workbook.bin"),
        bytesOf(zip, "mimetypeapplication/vnd.oasis.opendocument.spreadsheet"),
        bytesOf(zip, "word/document.xml"),
        bytesOf(zip, "readme.txt"),
        bytesOf(ole, "EncryptedPackage", true),
        bytesOf(ole, "Workbook", true),
        bytesOf(ole, "PowerPoint Document", true),
        bytesOf([0x53, 0x4b, 0x55], ",Name"),
      ];
      const refused = yield* Effect.forEach(
        others,
        (bytes) => Effect.map(Effect.flip(Xlsx.parse(bytes)), (error) => error.fatal.finding),
        { concurrency: 1 }
      );
      expect(refused).toEqual(
        A.map(
          ["binaryWorkbook", "openDocument", "word", "otherZip", "encrypted", "legacyXls", "otherOle", "notAnArchive"],
          (container) => ({ kind: "NotAWorkbook", container })
        )
      );
    })
  );

  it.effect("stops at a file that is not a workbook, a workbook with no sheet, and a part that is not there", () =>
    Effect.gen(function* () {
      const kindOf = (bytes: Uint8Array) => Effect.map(Effect.flip(Xlsx.parse(bytes)), (error) => error.fatal.finding);
      const builtKindOf = (recipe: Recipe) => Effect.flatMap(workbook(recipe), kindOf);
      const old = yield* kindOf(bytesOf(ole, "Workbook", true));
      expect(old).toMatchObject({ kind: "NotAWorkbook", container: "legacyXls" });
      const empty = yield* builtKindOf({ sheets: [] });
      expect(empty).toMatchObject({ kind: "NoSheets" });
      const parts = partsOf({ sheets: [{ name: "S", xml: sheet("") }] });
      const without = yield* archive(A.filter(parts, ([path]) => path !== "xl/worksheets/sheet1.xml"));
      const missing = yield* kindOf(without);
      expect(missing).toMatchObject({ kind: "MissingPart", path: "xl/worksheets/sheet1.xml" });
      const twice = yield* builtKindOf({
        sheets: [
          { name: "S", xml: sheet("") },
          { name: "s", xml: sheet("") },
        ],
      });
      expect(twice).toMatchObject({ kind: "DamagedXml", path: "xl/workbook.xml" });
    })
  );
});
