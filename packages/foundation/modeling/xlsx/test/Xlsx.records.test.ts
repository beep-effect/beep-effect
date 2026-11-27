import { Xlsx } from "@beep/xlsx/Xlsx.codec";
import { columnLetters } from "@beep/xlsx/XlsxAddress.schema";
import { XlsxBlank, XlsxNumber, XlsxText } from "@beep/xlsx/XlsxCell.schema";
import {
  XlsxCodecOptions,
  XlsxFirstSheet,
  XlsxLimits,
  XlsxReadOptions,
  XlsxSheetChoice,
} from "@beep/xlsx/XlsxOptions.schema";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { sheet, workbook } from "./support/workbooks.ts";

const records = (read: XlsxReadOptions) =>
  Xlsx.recordsFromBytes({ sheet: "Items", header: "first" }, XlsxCodecOptions.make({ read }));

const summaryThenItems = workbook({
  sheets: [
    { name: "Summary", xml: sheet('<row r="1"><c r="A1" t="inlineStr"><is><t>Total</t></is></c></row>') },
    {
      name: "Items",
      xml: sheet(
        '<row r="1"><c r="A1" t="inlineStr"><is><t>SKU</t></is></c><c r="B1" t="inlineStr"><is><t>Quantity</t></is></c></row>' +
          '<row r="2"><c r="A2" t="inlineStr"><is><t>BRK-040</t></is></c><c r="B2"><v>120</v></c></row>'
      ),
    },
    { name: "Empty", xml: sheet("") },
  ],
});

const item = { SKU: XlsxText.make({ text: "BRK-040" }), Quantity: XlsxNumber.make({ value: 120 }) };

describe("records under a header row", () => {
  it.effect.prop(
    "are read from the sheet the codec names, whichever sheets its read options choose",
    [Arbitrary.schema(XlsxSheetChoice)],
    ([sheets]) =>
      Effect.gen(function* () {
        const bytes = yield* summaryThenItems;
        const found = yield* S.decodeEffect(records(XlsxReadOptions.make({ sheets })))(bytes);
        expect(found).toEqual([item]);
      })
  );

  it.effect("an empty named sheet gives no records, even when the read options choose another sheet", () =>
    Effect.gen(function* () {
      const bytes = yield* summaryThenItems;
      const empty = Xlsx.recordsFromBytes(
        { sheet: "Empty", header: "first" },
        XlsxCodecOptions.make({ read: XlsxReadOptions.make({ sheets: XlsxFirstSheet.make({}) }) })
      );
      const none = yield* S.decodeEffect(empty)(bytes);
      expect(none).toEqual([]);
    })
  );

  it.effect("are refused when they would hold more values than `maxRecordValues`, blanks included", () =>
    Effect.gen(function* () {
      const header = A.join(
        A.map(
          ["A", "B", "C"],
          (heading, i) => `<c r="${columnLetters(i)}1" t="inlineStr"><is><t>${heading}</t></is></c>`
        ),
        ""
      );
      const rows = `<row r="1">${header}</row>${A.join(
        A.map(A.range(2, 6), (r) => `<row r="${r}"/>`),
        ""
      )}`;
      const bytes = yield* workbook({ sheets: [{ name: "Items", xml: sheet(rows) }] });
      const at = (maxRecordValues: number) =>
        records(XlsxReadOptions.make({ limits: XlsxLimits.make({ maxRecordValues }) }));
      const blank = XlsxBlank.make({});
      const fits = yield* S.decodeEffect(at(15))(bytes);
      expect(fits).toEqual(A.map(A.range(2, 6), () => ({ A: blank, B: blank, C: blank })));
      const error = yield* Effect.flip(S.decodeEffect(at(14))(bytes));
      assertTrue(Str.includes("maxRecordValues")(error.message));
    })
  );

  it.effect("a full header over many empty rows, a file of a few kilobytes, is refused under the starting cap", () =>
    Effect.gen(function* () {
      const header = A.join(
        A.map(A.range(0, 16_383), (i) => `<c r="${columnLetters(i)}1"><v>${i}</v></c>`),
        ""
      );
      const bytes = yield* workbook({
        sheets: [{ name: "Items", xml: sheet(`<row r="1">${header}</row>${Str.repeat(1100)("<row/>")}`) }],
      });
      const limits = XlsxLimits.make({ maxInputBytes: ByteSize.mebibytes(64) });
      const error = yield* Effect.flip(S.decodeEffect(records(XlsxReadOptions.make({ limits })))(bytes));
      assertTrue(
        Str.includes("maxRecordValues")(error.message),
        "as records it is a value per heading per row, refused before any record is built"
      );
    })
  );
});
