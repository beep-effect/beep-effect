// Every exported schema generates only values it accepts (schema-first rule SF-7), and the behaviour beside the
// schemas holds on values read off the fixtures.

import {
  columnFromLetters,
  columnLetters,
  XlsxAddress,
  XlsxColumn,
  XlsxRange,
  XlsxRowNumber,
} from "@beep/xlsx/XlsxAddress.schema";
import {
  XlsxCell,
  XlsxDate,
  XlsxErrorCode,
  XlsxFormatKind,
  XlsxNumber,
  XlsxNumberFormat,
  XlsxText,
  XlsxValue,
} from "@beep/xlsx/XlsxCell.schema";
import { XlsxDiagnostic } from "@beep/xlsx/XlsxDiagnostic.schema";
import {
  XlsxCodecOptions,
  XlsxLimits,
  XlsxReadOptions,
  XlsxSheetChoice,
  XlsxWriteOptions,
} from "@beep/xlsx/XlsxOptions.schema";
import { XlsxContainer, XlsxOutline, XlsxRead, XlsxSheetOutline } from "@beep/xlsx/XlsxRead.schema";
import { XlsxCalendar, XlsxDateSystem, XlsxSerial } from "@beep/xlsx/XlsxSerial.schema";
import {
  XlsxDroppedPart,
  XlsxRow,
  XlsxSheetCount,
  XlsxSheetInfo,
  XlsxSheetName,
  XlsxSheetState,
  XlsxWorkbook,
  XlsxWorksheet,
} from "@beep/xlsx/XlsxWorkbook.schema";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const runs = { arbitrary: { runs: 50 } };
const schemas = {
  XlsxColumn,
  XlsxRowNumber,
  XlsxAddress,
  XlsxRange,
  XlsxDateSystem,
  XlsxSerial,
  XlsxCalendar,
  XlsxErrorCode,
  XlsxNumberFormat,
  XlsxFormatKind,
  XlsxValue,
  XlsxCell,
  XlsxSheetState,
  XlsxRow,
  XlsxSheetName,
  XlsxSheetInfo,
  XlsxSheetCount,
  XlsxWorksheet,
  XlsxDroppedPart,
  XlsxWorkbook,
  XlsxSheetChoice,
  XlsxLimits,
  XlsxReadOptions,
  XlsxWriteOptions,
  XlsxCodecOptions,
  XlsxDiagnostic,
  XlsxContainer,
  XlsxRead,
  XlsxSheetOutline,
  XlsxOutline,
};

describe("every schema generates only valid values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema as S.Top)],
      ([value]) => {
        expect(S.is(schema as S.Top)(value)).toBe(true);
      },
      runs
    );
  }
});

describe("addresses", () => {
  it("names columns as Excel does", () => {
    expect([columnLetters(0), columnLetters(25), columnLetters(26), columnLetters(16_383)]).toEqual([
      "A",
      "Z",
      "AA",
      "XFD",
    ]);
    expect(columnFromLetters("xfd")).toEqual(O.some(16_383));
    expect(columnFromLetters("XFE")).toEqual(O.none());
  });
  it.prop("parse after format is the identity", [Arbitrary.schema(XlsxAddress)], ([address]) => {
    expect(XlsxAddress.parse(XlsxAddress.format(address))).toEqual(O.some(address));
  });
  it.prop("a range parses back from its reference", [Arbitrary.schema(XlsxRange)], ([range]) => {
    expect(XlsxRange.parse(XlsxRange.format(range))).toEqual(O.some(XlsxRange.ordered(range)));
  });
  it("orders a range's corners", () => {
    expect(O.map(XlsxRange.parse("C3:A1"), XlsxRange.format)).toEqual(O.some("A1:C3"));
  });
  it("reads absolute references and refuses what is off the sheet", () => {
    expect(O.map(XlsxAddress.parse("$B$7"), XlsxAddress.format)).toEqual(O.some("B7"));
    expect(XlsxAddress.parse("A0")).toEqual(O.none());
    expect(XlsxAddress.parse("A1048577")).toEqual(O.none());
  });
});

const ymd = (serial: number, system: "1900" | "1904") => {
  const c = XlsxCalendar.fromSerial(serial, system);
  return `${c.year}-${c.month}-${c.day}`;
};

describe("serials", () => {
  it("keeps the day that never was in the 1900 system", () => {
    expect(A.map([1, 59, 60, 61, 46_085], (serial) => ymd(serial, "1900"))).toEqual([
      "1900-1-1",
      "1900-2-28",
      "1900-2-29",
      "1900-3-1",
      "2026-3-4",
    ]);
    expect(ymd(0, "1900")).toBe("1900-1-0");
  });
  it("counts from 1 January 1904 in the 1904 system", () => {
    expect(A.map([0, 1, 59, 60, 61, 44_623], (serial) => ymd(serial, "1904"))).toEqual([
      "1904-1-1",
      "1904-1-2",
      "1904-2-29",
      "1904-3-1",
      "1904-3-2",
      "2026-3-4",
    ]);
  });
  it("reads a time of day without losing a second", () => {
    expect(XlsxCalendar.fromSerial(46_085.604_166_666_66, "1900")).toMatchObject({ hour: 14, minute: 30, second: 0 });
  });
  it("has no DateTime for the days no calendar has", () => {
    expect(O.isNone(XlsxCalendar.toDateTime(60, "1900"))).toBe(true);
    expect(O.isNone(XlsxCalendar.toDateTime(0.5, "1900"))).toBe(true);
    expect(O.isSome(XlsxCalendar.toDateTime(61, "1900"))).toBe(true);
  });
  // A workbook stores 15 significant digits, so past serial 99,999 (the year 2173) a time is kept to less than a
  // second; the identity is stated where a whole second survives.
  it.prop(
    "toSerial after fromSerial is the identity on whole seconds",
    [
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 99_999 }))),
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 86_399 }))),
      Arbitrary.schema(XlsxDateSystem),
    ],
    ([day, seconds, system]) => {
      const serial = day + seconds / 86_400;
      expect(XlsxCalendar.toSerial(XlsxCalendar.fromSerial(serial, system), system)).toEqual(O.some(serial));
    },
    { arbitrary: { runs: 500 } }
  );
});

const number = (value: number, code: string) =>
  XlsxCell.make({ column: 0, value: XlsxNumber.make({ value }), format: XlsxNumberFormat.make({ id: 164, code }) });
const date = (serial: number, code: string) =>
  XlsxCell.make({ column: 0, value: XlsxDate.make({ serial }), format: XlsxNumberFormat.make({ id: 164, code }) });

describe("displayed text", () => {
  it("is worked out for the formats of the fixtures", () => {
    expect(XlsxCell.shown(number(12.5, "$#,##0.00"), "1900")).toEqual(O.some("$12.50"));
    expect(XlsxCell.shown(number(123, "00000"), "1900")).toEqual(O.some("00123"));
    expect(XlsxCell.shown(number(0.1 + 0.2, "General"), "1900")).toEqual(O.some("0.3"));
    expect(XlsxCell.shown(date(46_085, "m/d/yyyy"), "1900")).toEqual(O.some("3/4/2026"));
    expect(XlsxCell.shown(date(46_115, "dd/mm/yyyy"), "1900")).toEqual(O.some("03/04/2026"));
    expect(XlsxCell.shown(date(46_085.604_166_666_66, "yyyy-mm-dd hh:mm"), "1900")).toEqual(O.some("2026-03-04 14:30"));
    expect(XlsxCell.shown(date(44_623, "yyyy-mm-dd"), "1904")).toEqual(O.some("2026-03-04"));
  });
  it("is refused for a format that is not rendered, never guessed", () => {
    expect(XlsxCell.shown(number(0.5, "# ?/?"), "1900")).toEqual(O.none());
    expect(XlsxCell.shown(number(1200, "0.00E+00"), "1900")).toEqual(O.none());
    expect(XlsxCell.shown(number(-5, "#,##0 ;(#,##0)"), "1900")).toEqual(O.none());
    expect(XlsxCell.shown(date(1.5, "[h]:mm:ss"), "1900")).toEqual(O.none());
    expect(XlsxCell.shown(XlsxCell.make({ column: 0, value: XlsxText.make({ text: "a" }) }), "1900")).toEqual(O.none());
  });
  it("knows Excel's built-in formats by id", () => {
    expect(O.map(XlsxNumberFormat.builtin(14), (format) => format.code)).toEqual(O.some("m/d/yy"));
    expect(XlsxNumberFormat.builtin(5)).toEqual(O.none());
    expect(XlsxNumberFormat.kind({ code: "00000" })).toMatchObject({ kind: "ZeroPadded", width: 5 });
  });
  it("puts a cell built by hand in the form a file gives back", () => {
    expect(XlsxCell.canonical(date(5, "0.00")).format).toMatchObject({ id: 14, code: "m/d/yy" });
    expect(XlsxCell.canonical(number(5, "yyyy")).value).toMatchObject({ kind: "Date", serial: 5 });
    expect(XlsxCell.canonical(number(-5, "yyyy")).value).toMatchObject({ kind: "Number", value: -5 });
  });
});
