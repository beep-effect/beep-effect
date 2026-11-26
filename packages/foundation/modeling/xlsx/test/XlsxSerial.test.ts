import { XlsxCalendar } from "@beep/xlsx/XlsxSerial.schema";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as O from "effect/Option";

const calendar = (year: number, month: number, day: number, hour = 0) =>
  XlsxCalendar.make({ year, month, day, hour, minute: 0, second: 0 });

const ymd = (serial: number, system: "1900" | "1904") =>
  O.map(XlsxCalendar.fromSerial(serial, system), (c) => [c.year, c.month, c.day, c.hour] as const);

describe("XlsxCalendar.fromSerial at each edge of its calendar", () => {
  it("reads the 1900 system's fictitious days and the days around them", () => {
    assertSome(ymd(0, "1900"), [1900, 1, 0, 0]);
    assertSome(ymd(1, "1900"), [1900, 1, 1, 0]);
    assertSome(ymd(59, "1900"), [1900, 2, 28, 0]);
    assertSome(ymd(60, "1900"), [1900, 2, 29, 0]);
    assertSome(ymd(61, "1900"), [1900, 3, 1, 0]);
  });
  it("reads days on either side of March, in both systems", () => {
    assertSome(ymd(45_292.5, "1900"), [2024, 1, 1, 12]);
    assertSome(ymd(45_458, "1900"), [2024, 6, 15, 0]);
    assertSome(ymd(0, "1904"), [1904, 1, 1, 0]);
    assertSome(ymd(43_830.75, "1904"), [2024, 1, 1, 18]);
  });
  it("carries a time that rounds up to midnight into the next day", () => {
    assertSome(ymd(0.999_999_999_5, "1900"), [1900, 1, 1, 0]);
    assertSome(ymd(59.999_999_999_5, "1900"), [1900, 2, 29, 0]);
  });
});

describe("XlsxCalendar.toSerial at each edge of its calendar", () => {
  it("gives the 1900 system's fictitious days their serials", () => {
    assertSome(XlsxCalendar.toSerial(calendar(1900, 2, 29), "1900"), 60);
    assertSome(XlsxCalendar.toSerial(calendar(1900, 1, 0), "1900"), 0);
  });
  it("counts the real days on either side of the fictitious one", () => {
    assertSome(XlsxCalendar.toSerial(calendar(1900, 1, 1), "1900"), 1);
    assertSome(XlsxCalendar.toSerial(calendar(1900, 2, 28), "1900"), 59);
    assertSome(XlsxCalendar.toSerial(calendar(1900, 3, 1), "1900"), 61);
    assertSome(XlsxCalendar.toSerial(calendar(2024, 1, 1, 12), "1900"), 45_292.5);
    assertSome(XlsxCalendar.toSerial(calendar(2024, 6, 15), "1900"), 45_458);
  });
  it("starts the 1904 system on 1 January 1904 and has no serial before it", () => {
    assertSome(XlsxCalendar.toSerial(calendar(1904, 1, 1, 12), "1904"), 0.5);
    assertNone(XlsxCalendar.toSerial(calendar(1903, 12, 31), "1904"));
    assertNone(XlsxCalendar.toSerial(calendar(1900, 1, 0), "1904"));
    assertNone(XlsxCalendar.toSerial(calendar(1900, 2, 29), "1904"));
  });
  it("has no serial for a day the calendar does not have", () => {
    assertNone(XlsxCalendar.toSerial(calendar(2024, 3, 0), "1900"));
    assertNone(XlsxCalendar.toSerial(calendar(2023, 2, 29), "1900"));
    assertNone(XlsxCalendar.toSerial(calendar(2024, 4, 31), "1900"));
    assertNone(XlsxCalendar.toSerial(calendar(1900, 2, 30), "1900"));
  });
  it("reads back every serial it gives", () => {
    for (const serial of [0, 1, 59, 60, 61, 45_292.5]) {
      const back = O.flatMap(XlsxCalendar.fromSerial(serial, "1900"), (c) => XlsxCalendar.toSerial(c, "1900"));
      expect(
        O.getOrThrow(back),
        "an edge day the property tests reach only when an arbitrary lands on it converts in both directions"
      ).toBe(serial);
    }
  });
});
