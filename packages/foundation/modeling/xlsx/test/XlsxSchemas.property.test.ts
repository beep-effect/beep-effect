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
  XlsxNumber,
  XlsxNumberFormat,
  XlsxText,
  XlsxValue,
} from "@beep/xlsx/XlsxCell.schema";
import { XlsxContainer, XlsxDiagnostic, XlsxKeptList } from "@beep/xlsx/XlsxDiagnostic.schema";
import { XlsxFormatKind } from "@beep/xlsx/XlsxFormatKind.schema";
import {
  XlsxCodecOptions,
  XlsxLimits,
  XlsxReadOptions,
  XlsxSheetChoice,
  XlsxWriteOptions,
} from "@beep/xlsx/XlsxOptions.schema";
import { XlsxOutline, XlsxRead, XlsxSheetOutline } from "@beep/xlsx/XlsxRead.schema";
import { MAX_SERIAL, maxSerial, XlsxCalendar, XlsxDateSystem, XlsxSerial } from "@beep/xlsx/XlsxSerial.schema";
import {
  fitsExcel,
  XlsxDroppedPart,
  XlsxHeading,
  XlsxHiddenColumns,
  XlsxMerges,
  XlsxRecord,
  XlsxRow,
  XlsxSheetCount,
  XlsxSheetInfo,
  XlsxSheetName,
  XlsxSheetState,
  XlsxWorkbook,
  XlsxWorksheet,
} from "@beep/xlsx/XlsxWorkbook.schema";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: { runs: 50 } };
const schemas: Readonly<Record<string, S.Top>> = {
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
  XlsxMerges,
  XlsxHiddenColumns,
  XlsxHeading,
  XlsxRecord,
  XlsxKeptList,
};

describe("every exported schema generates only values it accepts (schema-first rule SF-7)", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema)],
      ([value]) => {
        expect(S.is(schema)(value)).toBe(true);
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
    assertSome(columnFromLetters("xfd"), 16_383);
    assertNone(columnFromLetters("XFE"));
  });
  const sameAddress = S.toEquivalence(S.Option(XlsxAddress));
  const sameRange = S.toEquivalence(S.Option(XlsxRange));
  it.prop("parse after format is the identity", [Arbitrary.schema(XlsxAddress)], ([address]) => {
    assertTrue(
      sameAddress(XlsxAddress.parse(XlsxAddress.format(address)), O.some(address)),
      "a generated value may have a null prototype, so the round trip is compared by the schema's own equivalence"
    );
  });
  it.prop("a range parses back from its reference", [Arbitrary.schema(XlsxRange)], ([range]) => {
    assertTrue(sameRange(XlsxRange.parse(XlsxRange.format(range)), O.some(XlsxRange.ordered(range))));
  });
  it("orders a range's corners", () => {
    assertSome(O.map(XlsxRange.parse("C3:A1"), XlsxRange.format), "A1:C3");
  });
  it("reads absolute references and refuses what is off the sheet", () => {
    assertSome(O.map(XlsxAddress.parse("$B$7"), XlsxAddress.format), "B7");
    assertNone(XlsxAddress.parse("A0"));
    assertNone(XlsxAddress.parse("A1048577"));
  });
});

const ymd = (serial: number, system: "1900" | "1904") =>
  O.map(XlsxCalendar.fromSerial(serial, system), (c) => `${c.year}-${c.month}-${c.day}`);

describe("serials", () => {
  it("keeps the day that never was in the 1900 system", () => {
    expect(A.map([1, 59, 60, 61, 46_085], (serial) => ymd(serial, "1900"))).toEqual(
      A.map(["1900-1-1", "1900-2-28", "1900-2-29", "1900-3-1", "2026-3-4"], O.some)
    );
    assertSome(ymd(0, "1900"), "1900-1-0");
  });
  it("counts from 1 January 1904 in the 1904 system", () => {
    expect(A.map([0, 1, 59, 60, 61, 44_623], (serial) => ymd(serial, "1904"))).toEqual(
      A.map(["1904-1-1", "1904-1-2", "1904-2-29", "1904-3-1", "1904-3-2", "2026-3-4"], O.some)
    );
  });
  it("reads a time of day without losing a second", () => {
    expect(O.getOrThrow(XlsxCalendar.fromSerial(46_085.604_166_666_66, "1900"))).toMatchObject({
      hour: 14,
      minute: 30,
      second: 0,
    });
  });
  it("ends each system on 31 December 9999, the 1904 one 1,462 serials sooner", () => {
    assertSome(ymd(maxSerial("1900"), "1900"), "9999-12-31");
    assertSome(ymd(maxSerial("1904"), "1904"), "9999-12-31");
    assertNone(XlsxCalendar.fromSerial(MAX_SERIAL, "1904"));
    assertNone(XlsxCalendar.toDateTime(MAX_SERIAL, "1904"));
  });
  it("keeps the last second of 31 December 9999 in both systems, and shows nothing past it", () => {
    const last = XlsxCalendar.make({ year: 9999, month: 12, day: 31, hour: 23, minute: 59, second: 59 });
    for (const system of XlsxDateSystem.literals) {
      const serial = O.getOrThrow(XlsxCalendar.toSerial(last, system));
      expect(serial, "the bound is the last whole second of 31 December 9999, stored to 15 digits").toBeLessThanOrEqual(
        maxSerial(system)
      );
      assertSome(XlsxCalendar.fromSerial(serial, system), last);
      assertSome(XlsxCalendar.fromSerial(maxSerial(system), system), last);
      const shown = (at: number) =>
        XlsxCell.shown(
          {
            value: XlsxDate.make({ serial: at }),
            format: XlsxNumberFormat.make({ id: 164, code: "yyyy-mm-dd hh:mm:ss" }),
          },
          system
        );
      assertSome(shown(serial), "9999-12-31 23:59:59");
      assertSome(shown(maxSerial(system)), "9999-12-31 23:59:59");
    }
    const past1904 = maxSerial("1904") + 1;
    expect(
      past1904,
      "the serial schema ends at the 1900 system's last serial, so only a 1904 serial can pass its system's last"
    ).toBeLessThanOrEqual(MAX_SERIAL);
    assertNone(
      XlsxCell.shown(
        {
          value: XlsxDate.make({ serial: past1904 }),
          format: XlsxNumberFormat.make({ id: 164, code: "yyyy-mm-dd hh:mm:ss" }),
        },
        "1904"
      )
    );
    const serialOnceShownAsYear0002 = XlsxDate.make({ serial: 2_958_000 });
    assertNone(
      XlsxCell.shown(
        { value: serialOnceShownAsYear0002, format: XlsxNumberFormat.make({ id: 164, code: "yyyy-mm-dd" }) },
        "1904"
      )
    );
  });
  it.prop(
    "fromSerial gives every serial of a system its day, and toSerial gives the serial back",
    [Arbitrary.schema(XlsxDateSystem), Arbitrary.schema(S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })))],
    ([system, share]) => {
      const serial = share * maxSerial(system);
      const calendar = XlsxCalendar.fromSerial(serial, system);
      assertTrue(
        calendar.pipe(O.isSome),
        "the serial domain is one schema for both systems; within a system's range fromSerial always gives the day"
      );
      const back = O.getOrThrow(O.flatMap(calendar, (found) => XlsxCalendar.toSerial(found, system)));
      expect(Math.abs(back - serial), "back to within a second").toBeLessThan(1 / 86_400);
    },
    { arbitrary: { runs: 500 } }
  );
  it("carries a time that rounds up to midnight into the next day, in both systems", () => {
    expect(
      O.getOrThrow(XlsxCalendar.fromSerial(0.999_999_999_5, "1900")),
      "SheetJS shows 12:00:00 PM for the end of a day and drops the 1904 offset after the carry, so this is not in the oracle test"
    ).toMatchObject({
      year: 1900,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    });
    expect(
      O.getOrThrow(XlsxCalendar.fromSerial(0.999_999_99, "1900")),
      "the time is rounded to the millisecond and only one that rounds to midnight carries; the calendar keeps its whole second"
    ).toMatchObject({
      day: 0,
      hour: 23,
      minute: 59,
      second: 59,
    });
    const shown = (serial: number, code: string, system: "1900" | "1904") =>
      XlsxCell.shown({ value: XlsxDate.make({ serial }), format: XlsxNumberFormat.make({ id: 164, code }) }, system);
    assertSome(shown(46_085.999_999_995, "yyyy-mm-dd hh:mm:ss", "1904"), "2030-03-06 00:00:00");
    assertSome(shown(59.999_999_9, "yyyy-mm-dd hh:mm:ss", "1900"), "1900-02-29 00:00:00");
    assertSome(shown(0.999_999_99, "h:mm:ss AM/PM", "1900"), "12:00:00 AM");
  });
  it("has no DateTime for the days no calendar has", () => {
    assertNone(XlsxCalendar.toDateTime(60, "1900"));
    assertNone(XlsxCalendar.toDateTime(0.5, "1900"));
    assertTrue(XlsxCalendar.toDateTime(61, "1900").pipe(O.isSome));
  });
  it("keeps the time of day in a DateTime, to the millisecond, rather than making every moment midnight", () => {
    const iso = (serial: number, system: XlsxDateSystem) =>
      O.map(XlsxCalendar.toDateTime(serial, system), DateTime.formatIso);
    assertSome(iso(45_292.5, "1900"), "2024-01-01T12:00:00.000Z");
    assertSome(iso(45_292.75, "1900"), "2024-01-01T18:00:00.000Z");
    assertSome(iso(43_830.75, "1904"), "2024-01-01T18:00:00.000Z");
    assertSome(iso(1_938_086.986_574_074, "1900"), "7206-04-18T23:40:40.000Z");
    assertSome(iso(45_292 + 1.5 / 86_400, "1900"), "2024-01-01T00:00:01.500Z");
  });
  const share = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }));
  const secondOfDay = S.Int.check(S.isBetween({ minimum: 0, maximum: 86_399 }));
  const serialOf = (system: XlsxDateSystem, part: number, seconds: number) => {
    const day = Math.min(Math.floor(part * maxSerial(system)), Math.floor(maxSerial(system)));
    return day + seconds / 86_400;
  };
  it.prop(
    "toSerial after fromSerial is the identity on every whole second of every day a system shows",
    [XlsxDateSystem, share, secondOfDay],
    ([system, part, seconds]) => {
      const serial = serialOf(system, part, seconds);
      const fifteenDigitsKeepEightDecimals = O.flatMap(XlsxCalendar.fromSerial(serial, system), (calendar) =>
        XlsxCalendar.toSerial(calendar, system)
      );
      assertSome(fifteenDigitsKeepEightDecimals, serial);
    },
    { arbitrary: { runs: 1000 } }
  );
  it.prop(
    "a whole-second serial's DateTime has the calendar fields fromSerial gives it",
    [XlsxDateSystem, share, secondOfDay],
    ([system, part, seconds]) => {
      const serial = serialOf(system, part, seconds);
      const calendar = O.getOrThrow(XlsxCalendar.fromSerial(serial, system));
      const moment = XlsxCalendar.toDateTime(serial, system);
      if (calendar.day === 0 || (calendar.year === 1900 && calendar.month === 2 && calendar.day === 29)) {
        assertNone(moment);
        return;
      }
      const parts = moment.pipe(O.getOrThrow, DateTime.toPartsUtc);
      expect({ ...parts, weekDay: 0 }).toEqual({
        year: calendar.year,
        month: calendar.month,
        day: calendar.day,
        hour: calendar.hour,
        minute: calendar.minute,
        second: calendar.second,
        millisecond: 0,
        weekDay: 0,
      });
      expect(parts.second + parts.minute * 60 + parts.hour * 3600).toBe(seconds);
    },
    { arbitrary: { runs: 1000 } }
  );
});

const number = (value: number, code: string) =>
  XlsxCell.make({ column: 0, value: XlsxNumber.make({ value }), format: XlsxNumberFormat.make({ id: 164, code }) });
const date = (serial: number, code: string) =>
  XlsxCell.make({ column: 0, value: XlsxDate.make({ serial }), format: XlsxNumberFormat.make({ id: 164, code }) });

describe("displayed text", () => {
  it("is worked out for the formats of the fixtures", () => {
    assertSome(XlsxCell.shown(number(12.5, "$#,##0.00"), "1900"), "$12.50");
    assertSome(XlsxCell.shown(number(123, "00000"), "1900"), "00123");
    assertSome(XlsxCell.shown(number(0.1 + 0.2, "General"), "1900"), "0.3");
    assertSome(XlsxCell.shown(date(46_085, "m/d/yyyy"), "1900"), "3/4/2026");
    assertSome(XlsxCell.shown(date(46_115, "dd/mm/yyyy"), "1900"), "03/04/2026");
    assertSome(XlsxCell.shown(date(46_085.604_166_666_66, "yyyy-mm-dd hh:mm"), "1900"), "2026-03-04 14:30");
    assertSome(XlsxCell.shown(date(44_623, "yyyy-mm-dd"), "1904"), "2026-03-04");
  });
  it("is refused for a format that is not rendered, never guessed", () => {
    assertNone(XlsxCell.shown(number(0.5, "# ?/?"), "1900"));
    assertNone(XlsxCell.shown(number(1200, "0.00E+00"), "1900"));
    assertNone(XlsxCell.shown(number(-5, "#,##0 ;(#,##0)"), "1900"));
    assertNone(XlsxCell.shown(date(1.5, "[h]:mm:ss"), "1900"));
    assertNone(XlsxCell.shown(XlsxCell.make({ column: 0, value: XlsxText.make({ text: "a" }) }), "1900"));
  });
  it("knows Excel's built-in formats by id", () => {
    assertSome(
      O.map(XlsxNumberFormat.builtin(14), (format) => format.code),
      "m/d/yy"
    );
    assertNone(XlsxNumberFormat.builtin(5));
    expect(XlsxNumberFormat.kind({ code: "00000" })).toMatchObject({ kind: "ZeroPadded", width: 5 });
  });
  it("puts a cell built by hand in the form a file gives back", () => {
    expect(XlsxCell.canonical(date(5, "0.00"), "1900").format).toMatchObject({ id: 14, code: "m/d/yy" });
    expect(XlsxCell.canonical(number(5, "yyyy"), "1900").value).toMatchObject({ kind: "Date", serial: 5 });
    expect(XlsxCell.canonical(number(-5, "yyyy"), "1900").value).toMatchObject({ kind: "Number", value: -5 });
    expect(XlsxCell.canonical(date(MAX_SERIAL, "yyyy"), "1904").value).toMatchObject({ kind: "Number" });
    expect(XlsxCell.canonical(number(MAX_SERIAL, "yyyy"), "1904").value).toMatchObject({ kind: "Number" });
    expect(XlsxCell.canonical(number(MAX_SERIAL, "yyyy"), "1900").value).toMatchObject({ kind: "Date" });
  });
  const patterns = A.flatMap(A.range(0, 40), (n) => [
    Str.repeat(n + 1)("0"),
    `0.${Str.repeat(n)("0")}`,
    `#,##0.${Str.repeat(n)("0")}%`,
  ]);
  it.prop(
    "a number is shown only under a format whose kind is rendered",
    [Arbitrary.schema(XlsxNumberFormat), Arbitrary.schema(S.Finite)],
    ([format, value]) => {
      for (const candidate of [format, ...A.map(patterns, (code) => XlsxNumberFormat.make({ id: 164, code }))]) {
        if (O.isSome(XlsxCell.shown({ value: XlsxNumber.make({ value }), format: candidate }, "1900"))) {
          expect(
            XlsxNumberFormat.kind(candidate).kind,
            "a format kind and the displayed text come from one reading of the code"
          ).not.toBe("Other");
        }
      }
    }
  );
  it("calls a pattern past its schema's bounds a format it does not render", () => {
    const wide = XlsxNumberFormat.make({ id: 164, code: `0.${Str.repeat(31)("0")}` });
    expect(XlsxNumberFormat.kind(wide).kind).toBe("Other");
    assertNone(XlsxCell.shown({ value: XlsxNumber.make({ value: 0 }), format: wide }, "1900"));
  });
  const caseMix = S.Array(S.Boolean).check(S.isMinLength(7), S.isMaxLength(7));
  it.prop("calls General in any case General, and never a date", [Arbitrary.schema(caseMix)], ([upper]) => {
    const code = A.join(
      A.map(Str.split("")("general"), (letter, i) => (upper[i] === true ? Str.toUpperCase(letter) : letter)),
      ""
    );
    expect(XlsxNumberFormat.kind({ code }).kind).toBe("General");
    expect(
      XlsxNumberFormat.isDate({ code }),
      "kind and isDate read General in any case alike; SheetJS called general a date for its lowercase g"
    ).toBe(false);
    expect(XlsxNumberFormat.isDate({ code: `${code} "x"` })).toBe(false);
    expect(XlsxCell.canonical(number(42, code), "1900").value).toMatchObject({ kind: "Number", value: 42 });
    assertSome(XlsxCell.shown(number(42, code), "1900"), "42");
  });
  it("calls a lone g an era mark, and so a date", () => {
    expect(XlsxNumberFormat.isDate({ code: "g" })).toBe(true);
    expect(XlsxNumberFormat.isDate({ code: "ggg yyyy" })).toBe(true);
  });
  const Condition = S.Struct({
    operator: S.Literals(["<", ">", "=", "<=", ">=", "<>"]),
    bound: S.Int.check(S.isBetween({ minimum: 0, maximum: 99_999 })),
    second: S.Boolean,
    serial: S.Int.check(S.isBetween({ minimum: 0, maximum: 99_999 })),
  });
  it.prop("shows nothing for a date format with a condition", [Arbitrary.schema(Condition)], ([condition]) => {
    const block = `[${condition.operator}${condition.bound}]`;
    const code = condition.second ? `yyyy-mm-dd;${block}dd/mm/yyyy` : `${block}yyyy-mm-dd;dd/mm/yyyy`;
    assertNone(XlsxCell.shown(date(condition.serial, code), "1900"));
    assertTrue(
      XlsxNumberFormat.isDate({ code }),
      "a condition chooses a section by the serial, which this package does not do, so nothing is shown, not the first section"
    );
  });
  it("shows a date format whose brackets hold no condition", () => {
    assertNone(XlsxCell.shown(date(1, "[>=2]yyyy-mm-dd;dd/mm/yyyy"), "1900"));
    assertSome(XlsxCell.shown(date(1, "[$-409]yyyy-mm-dd;dd/mm/yyyy"), "1900"), "1900-01-01");
    assertSome(XlsxCell.shown(date(1, '"[>=2]"yyyy-mm-dd'), "1900"), "[>=2]1900-01-01");
  });
});

describe("sheet names Excel takes", () => {
  it("refuses each name Excel refuses", () => {
    for (const name of ["Q1/Q2", "a:b", "a\\b", "a?b", "a*b", "a[b", "a]b", "'lead", "trail'", "History", "HISTORY"]) {
      expect([name, fitsExcel(name)]).toEqual([name, false]);
    }
    for (const name of ["Q1 sales", "it's here", "Histories", Str.repeat(31)("x"), "Ünïcödé"]) {
      expect([name, fitsExcel(name)]).toEqual([name, true]);
    }
    expect(fitsExcel(Str.repeat(32)("x"))).toBe(false);
  });
  it.prop("takes a name only when it keeps every rule", [Arbitrary.schema(XlsxSheetName)], ([name]) => {
    const keepsRules =
      name.length <= 31 &&
      A.every(Str.split("")(":\\/?*[]"), (letter) => !Str.includes(letter)(name)) &&
      name[0] !== "'" &&
      name[name.length - 1] !== "'" &&
      Str.toLowerCase(name) !== "history";
    expect(fitsExcel(name)).toBe(keepsRules);
  });
});

describe("uniqueness", () => {
  const cell = (column: number) => XlsxCell.make({ column, value: XlsxNumber.make({ value: column }) });
  const row = (number: number) => XlsxRow.make({ number, cells: [cell(0)] });
  const sheet = (name: string) => XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name }) });
  it.prop("a repeated row number, cell column or sheet name is refused", [Arbitrary.schema(XlsxWorkbook)], ([wb]) => {
    const [first] = wb.sheets;
    expect(S.is(XlsxWorkbook)({ ...wb, sheets: [first, ...wb.sheets] })).toBe(false);
    const upper = { ...first, info: { ...first.info, name: Str.toUpperCase(first.info.name) } };
    expect(S.is(XlsxWorkbook)({ ...wb, sheets: [first, upper] })).toBe(false);
    for (const found of A.take(first.rows, 1)) {
      expect(S.is(XlsxWorksheet)({ ...first, rows: [found, ...first.rows] })).toBe(false);
      for (const kept of A.take(found.cells, 1)) {
        expect(S.is(XlsxRow)({ ...found, cells: [kept, ...found.cells] })).toBe(false);
      }
    }
  });
  it("reads each row's number a bounded number of times to check a sheet", () => {
    let reads = 0;
    const counted = A.map(A.range(1, 2000), (number) => ({
      hidden: false,
      cells: row(number).cells,
      get number() {
        reads += 1;
        return number;
      },
    }));
    expect(
      S.is(XlsxWorksheet)({ ...XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "S" }) }), rows: counted })
    ).toBe(true);
    expect(reads).toBeGreaterThanOrEqual(counted.length);
    expect(
      reads,
      "each key is read once per row and once more by the row schema; comparing every pair would read four million"
    ).toBeLessThanOrEqual(3 * counted.length);
  });
  it("checks a sheet of 20,000 rows, a full row and 1,000 sheets", () => {
    const rows = A.map(A.range(1, 20_000), row);
    expect(S.is(XlsxWorksheet)(XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "S" }), rows }))).toBe(true);
    expect(
      S.is(XlsxWorksheet)({
        ...XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "S" }) }),
        rows: [...rows, row(1)],
      })
    ).toBe(false);
    expect(S.is(XlsxRow)(XlsxRow.make({ number: 1, cells: A.map(A.range(0, 16_383), cell) }))).toBe(true);
    const sheets = A.map(A.range(1, 1000), (n) => sheet(`Sheet ${n}`));
    expect(S.is(XlsxWorkbook)(XlsxWorkbook.make({ sheets: [sheet("Sheet 0"), ...sheets] }))).toBe(true);
    assertNone(XlsxWorkbook.makeOption({ sheets: [sheet("sheet 1"), ...sheets] }));
  });
  it("refuses a range merged twice or a column hidden twice, in a worksheet and an outline alike", () => {
    const range = O.getOrThrow(XlsxRange.parse("A1:B2"));
    const reversed = XlsxRange.make({ first: range.last, last: range.first });
    const base = XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "S" }) });
    expect(S.is(XlsxWorksheet)({ ...base, merges: [range, reversed] })).toBe(false);
    expect(S.is(XlsxWorksheet)({ ...base, hiddenColumns: [3, 3, 1] })).toBe(false);
    const count = XlsxWorksheet.count(base);
    assertTrue(XlsxSheetOutline.makeOption({ count, merges: [], hiddenColumns: [3, 1] }).pipe(O.isSome));
    assertNone(XlsxSheetOutline.makeOption({ count, merges: [], hiddenColumns: [3, 3, 1] }));
    assertNone(XlsxSheetOutline.makeOption({ count, merges: [range, range], hiddenColumns: [] }));
  });
});

const BUILT_IN_RUNS = 100;
const drawn = Ref.makeUnsafe(0);
describe("the seed of a property here, logged with the built-in count of values one property draws", () => {
  it.effect.prop("is the run's", [XlsxNumberFormat], () =>
    Effect.gen(function* () {
      const runs = yield* Ref.updateAndGet(drawn, (count) => count + 1);
      expect(
        runs,
        "the properties pass no seed of their own and coverage once changed with it; the deep sweep keeps properties only"
      ).toBeLessThanOrEqual(BUILT_IN_RUNS);
      if (runs < BUILT_IN_RUNS) return;
      const seed = yield* Config.option(Config.String("BEEP_FC_SEED"));
      const line = `[property-seed] xlsx worker seed ${O.getOrElse(seed, () => "random")}, ${runs} runs without fcRuns`;
      yield* Effect.provideService(Console.log(line), Console.Console, globalThis.console);
    })
  );
});
