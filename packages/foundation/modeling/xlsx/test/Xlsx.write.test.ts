import { Xlsx } from "@beep/xlsx/Xlsx.codec";
import { XlsxCell, XlsxError, XlsxErrorCode, XlsxText, XlsxUnreadable, XlsxValue } from "@beep/xlsx/XlsxCell.schema";
import { XlsxWriteOptions } from "@beep/xlsx/XlsxOptions.schema";
import { XlsxRow, XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const stored = XlsxWriteOptions.make({ compression: "store" });

const bookOf = (cells: ReadonlyArray<XlsxCell>): XlsxWorkbook =>
  XlsxWorkbook.make({
    sheets: [
      XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "S" }), rows: [XlsxRow.make({ number: 1, cells })] }),
    ],
  });

const cellsOf = (bytes: Uint8Array): ReadonlyArray<string> =>
  A.map(A.fromIterable(Str.matchAll(/<c [^>]*>.*?<\/c>/g)(new TextDecoder().decode(bytes))), (found) => found[0]);

const errorValuesOf = (bytes: Uint8Array): ReadonlyArray<string> =>
  A.map(
    A.fromIterable(
      Str.matchAll(/<c [^>]*t="e"[^>]*>(?:<f>.*?<\/f>)?<v>(.*?)<\/v><\/c>/g)(new TextDecoder().decode(bytes))
    ),
    (found) => found[1] ?? ""
  );

describe("the writer's sheet part for each kind of value, read off its stored (uncompressed) bytes", () => {
  it.effect("writes a formula's text result as a str cell with its saved value, and other text inline", () =>
    Effect.gen(function* () {
      const bytes = yield* Xlsx.stringify(
        bookOf([
          XlsxCell.make({ column: 0, value: XlsxText.make({ text: " a & b " }), formula: O.some('" a & "&"b "') }),
          XlsxCell.make({ column: 1, value: XlsxText.make({ text: "plain" }) }),
        ]),
        stored
      );
      expect(cellsOf(bytes)).toEqual([
        '<c r="A1" t="str"><f>&quot; a &amp; &quot;&amp;&quot;b &quot;</f><v> a &amp; b </v></c>',
        '<c r="B1" t="inlineStr"><is><t xml:space="preserve">plain</t></is></c>',
      ]);
    })
  );

  it.effect("writes what a file got wrong as the text it wrote, never as an error cell", () =>
    Effect.gen(function* () {
      const workbook = bookOf([
        XlsxCell.make({ column: 0, value: XlsxUnreadable.make({ raw: " not a number " }) }),
        XlsxCell.make({ column: 1, value: XlsxUnreadable.make({ raw: "#N/A" }), formula: O.some("1/0") }),
        XlsxCell.make({ column: 2, value: XlsxError.make({ code: "#DIV/0!" }), formula: O.some("1/0") }),
      ]);
      const bytes = yield* Xlsx.stringify(workbook, stored);
      expect(cellsOf(bytes)).toEqual([
        '<c r="A1" t="inlineStr"><is><t xml:space="preserve"> not a number </t></is></c>',
        '<c r="B1" t="str"><f>1/0</f><v>#N/A</v></c>',
        '<c r="C1" t="e"><f>1/0</f><v>#DIV/0!</v></c>',
      ]);
      const read = yield* Xlsx.parse(bytes);
      expect(read.workbook).toEqual(XlsxWorkbook.canonical(workbook));
      expect(A.map(read.workbook.sheets[0].rows[0]?.cells ?? [], (cell) => cell.value.kind)).toEqual([
        "Text",
        "Text",
        "Error",
      ]);
      expect(read.warnings).toEqual([]);
    })
  );

  const Cell = S.Struct({
    value: XlsxValue,
    formula: S.Option(S.String.check(S.isPattern(/^[A-Z0-9+*/&"()]{1,20}$/))),
  });
  it.effect.prop(
    "writes only error codes in error cells and reads every text back to the character, whatever a cell holds",
    [Arbitrary.schema(S.Array(Cell).check(S.isMaxLength(12)))],
    ([cells]) =>
      Effect.gen(function* () {
        const workbook = bookOf(
          A.map(cells, (cell, column) => XlsxCell.make({ column, value: cell.value, formula: cell.formula }))
        );
        const bytes = yield* Xlsx.stringify(workbook, stored);
        assertTrue(A.every(errorValuesOf(bytes), S.is(XlsxErrorCode)));
        const read = yield* Xlsx.parse(bytes);
        expect(read.workbook).toEqual(XlsxWorkbook.canonical(workbook));
        const kinds = A.map(read.workbook.sheets[0].rows[0]?.cells ?? [], (cell) => cell.value.kind);
        assertTrue(!A.contains(kinds, "Unreadable"));
      }),
    { arbitrary: { runs: 100 } }
  );
});
