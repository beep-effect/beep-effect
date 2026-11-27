import { Xlsx } from "@beep/xlsx/Xlsx.codec";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { sheet, workbook } from "./support/workbooks.ts";

const xmlText = (text: string): string =>
  Str.replaceAll(">", "&gt;")(Str.replaceAll("<", "&lt;")(Str.replaceAll("&", "&amp;")(text)));

const sharedFrom = Effect.fn("sharedFrom")(function* (formula: string, cells: ReadonlyArray<string>) {
  const dependents = A.join(
    A.map(
      cells,
      (cell) => `<row r="${Str.replace(/^[A-Z]+/, "")(cell)}"><c r="${cell}"><f t="shared" si="0"/><v>0</v></c></row>`
    ),
    ""
  );
  const rows = `<row r="2"><c r="C2"><f t="shared" ref="C2:Z99" si="0">${xmlText(formula)}</f><v>0</v></c></row>${dependents}`;
  const bytes = yield* workbook({ sheets: [{ name: "S", xml: sheet(rows) }] });
  const read = yield* Xlsx.parse(bytes);
  return A.flatMap(read.workbook.sheets[0].rows, (row) =>
    A.map(row.cells, (cell) => O.getOrElse(cell.formula, () => ""))
  );
});

const expectShared = (formula: string, cells: ReadonlyArray<string>, expected: ReadonlyArray<string>) =>
  Effect.map(sharedFrom(formula, cells), (found) => {
    expect(found).toEqual(expected);
  });

describe("a shared formula gives each cell the first cell's text, its relative references moved by the distance", () => {
  it.effect("leaves a string constant as it is, doubled quotes included, and moves the references round it", () =>
    Effect.gen(function* () {
      yield* expectShared('A2&"A2"', ["C3"], ['A2&"A2"', 'A3&"A2"']);
      yield* expectShared(
        'A2&"say ""B2"" and C2"&B2',
        ["D3"],
        ['A2&"say ""B2"" and C2"&B2', 'B3&"say ""B2"" and C2"&C3']
      );
    })
  );

  it.effect("leaves a quoted sheet name and a bracketed piece as they are", () =>
    expectShared(
      "'Q1 A1'!B2+[1]Sheet1!B2+Table1[[#This Row],[A1]]",
      ["C3"],
      ["'Q1 A1'!B2+[1]Sheet1!B2+Table1[[#This Row],[A1]]", "'Q1 A1'!B3+[1]Sheet1!B3+Table1[[#This Row],[A1]]"]
    )
  );

  it.effect("moves a whole-column range along the columns and a whole-row range along the rows", () =>
    Effect.gen(function* () {
      yield* expectShared("SUM(A:A)+SUM(2:2)", ["D3"], ["SUM(A:A)+SUM(2:2)", "SUM(B:B)+SUM(3:3)"]);
      yield* expectShared("SUM($A:B)+SUM(2:$5)+$A$1", ["D4"], ["SUM($A:B)+SUM(2:$5)+$A$1", "SUM($A:C)+SUM(4:$5)+$A$1"]);
    })
  );

  it.effect("keeps a reference that would move off the sheet as it is written", () =>
    expectShared(
      "XFD:XFD+$XFD2+1048576:1048576",
      ["D3"],
      ["XFD:XFD+$XFD2+1048576:1048576", "XFD:XFD+$XFD3+1048576:1048576"]
    )
  );

  it.effect("leaves a sheet span such as `JAN:DEC!` and capitals inside a longer name of any case as they are", () =>
    Effect.gen(function* () {
      yield* expectShared("SUM(JAN:DEC!B2)", ["D3"], ["SUM(JAN:DEC!B2)", "SUM(JAN:DEC!C3)"]);
      yield* expectShared("SUM(A:C!B2)+A1!B2", ["D3"], ["SUM(A:C!B2)+A1!B2", "SUM(A:C!C3)+A1!C3"]);
      yield* expectShared(
        "SUM(MyJAN:DEC!B2)+myA1*2+xA:C",
        ["D3"],
        ["SUM(MyJAN:DEC!B2)+myA1*2+xA:C", "SUM(MyJAN:DEC!C3)+myA1*2+xA:C"]
      );
    })
  );

  const SheetName = S.String.check(S.isPattern(/^[A-Za-z]{1,6}$/));
  it.effect.prop(
    "gives every cell the sheet span of a 3D reference unchanged, whatever two sheets it spans, moving only the cell",
    [Arbitrary.schema(SheetName), Arbitrary.schema(SheetName)],
    ([from, to]) => {
      const span = `${from}:${to}!`;
      return expectShared(`SUM(${span}B2)`, ["D3"], [`SUM(${span}B2)`, `SUM(${span}C3)`]);
    },
    { arbitrary: { runs: 100 } }
  );

  const Constant = S.String.check(S.isPattern(/^(?:[A-Z0-9:$! ]|"")*$/), S.isMaxLength(24));
  it.effect.prop(
    "gives every cell the string constants of the first unchanged, whatever they hold, references included",
    [Arbitrary.schema(Constant), Arbitrary.schema(Constant)],
    ([first, second]) =>
      Effect.gen(function* () {
        const formula = `A2&"${first}"&B2:C2&"${second}"`;
        yield* expectShared(formula, ["D3"], [formula, `B3&"${first}"&C3:D3&"${second}"`]);
      }),
    { arbitrary: { runs: 100 } }
  );
});
