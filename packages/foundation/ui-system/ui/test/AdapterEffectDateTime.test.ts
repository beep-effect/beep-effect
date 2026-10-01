import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { AdapterEffectDateTime } from "@beep/ui/components/effect-date-time-picker";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const adapter = new AdapterEffectDateTime({ locale: "en-US" });

describe("AdapterEffectDateTime", () => {
  it("uses Effect v4 DateTime parts for getters and setters", () => {
    const value = DateTime.makeUnsafe("2024-02-03T04:05:06.007Z");
    const updated = adapter.setMilliseconds(
      adapter.setSeconds(adapter.setMinutes(adapter.setHours(value, 8), 9), 10),
      11
    );

    expect(adapter.getYear(value)).toBe(2024);
    expect(adapter.getMonth(value)).toBe(1);
    expect(adapter.getDate(value)).toBe(3);
    expect(adapter.getHours(value)).toBe(4);
    expect(adapter.getMinutes(value)).toBe(5);
    expect(adapter.getSeconds(value)).toBe(6);
    expect(adapter.getMilliseconds(value)).toBe(7);
    expect(DateTime.formatIso(updated)).toBe("2024-02-03T08:09:10.011Z");
  });

  it("includes the ending year in getYearRange", () => {
    const years = adapter.getYearRange([
      DateTime.makeUnsafe("2020-06-15T00:00:00.000Z"),
      DateTime.makeUnsafe("2022-01-01T00:00:00.000Z"),
    ]);

    expect(A.map(years, adapter.getYear)).toEqual([2020, 2021, 2022]);
  });

  it("creates invalid DateTime-shaped values for MUI validation", () => {
    const invalid = adapter.getInvalidDate();

    pipe(adapter.isValid(invalid), assertFalse);
    pipe(adapter.isValid(undefined), assertFalse);
    pipe(adapter.isValid("" as unknown as DateTime.DateTime), assertFalse);
    pipe(Number.isNaN(invalid.epochMilliseconds), assertTrue);
  });

  it("formats absent picker values as invalid instead of throwing", () => {
    expect(adapter.formatByString(undefined, "P")).toBe("Invalid Date");
    expect(adapter.formatByString("" as unknown as DateTime.DateTime, "P")).toBe("Invalid Date");
  });

  it("round-trips timezone tokens", () => {
    const zoned = adapter.setTimezone(DateTime.makeUnsafe("2024-01-01T00:00:00.000Z"), "Europe/London");

    expect(adapter.getTimezone(DateTime.makeUnsafe("2024-01-01T00:00:00.000Z"))).toBe("UTC");
    expect(adapter.getTimezone(zoned)).toBe("Europe/London");
  });

  it("uses MUI reference-date semantics for undefined adapter dates", () => {
    const referenceDate = adapter.date(undefined, "UTC");

    pipe(DateTime.isDateTime(referenceDate), assertTrue);
    pipe(referenceDate !== null && DateTime.isUtc(referenceDate), assertTrue);
  });

  it("formats clock field section tokens without meridiem leakage", () => {
    const value = DateTime.makeUnsafe("2024-02-03T03:05:09.000Z");
    const afternoon = DateTime.makeUnsafe("2024-02-03T15:30:00.000Z");
    const meridiem = adapter.formatByString(DateTime.makeUnsafe("2024-02-03T03:30:00.000Z"), "aa");

    expect(adapter.formatByString(value, "h")).toBe("3");
    expect(adapter.formatByString(value, "hh")).toBe("03");
    expect(adapter.formatByString(value, "H")).toBe("3");
    expect(adapter.formatByString(value, "HH")).toBe("03");
    expect(adapter.formatByString(value, "m")).toBe("5");
    expect(adapter.formatByString(value, "mm")).toBe("05");
    expect(adapter.formatByString(value, "s")).toBe("9");
    expect(adapter.formatByString(value, "ss")).toBe("09");
    expect(adapter.formatByString(afternoon, "h")).toBe("3");
    expect(adapter.formatByString(afternoon, "hh")).toBe("03");
    expect(meridiem).toMatch(/^(AM|PM)$/u);
    expect(adapter.formatByString(afternoon, "AA")).toBe(Str.toUpperCase(adapter.formatByString(afternoon, "aa")));
  });
  it.prop(
    "preserves UTC instants and timezone tokens across seasonal boundaries",
    [Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1577836800000, maximum: 1924991999999 })))],
    ([epochMilliseconds]) => {
      for (const timezone of ["UTC", "Europe/London", "America/New_York", "Asia/Kolkata", "Australia/Sydney"]) {
        const value = DateTime.makeUnsafe(epochMilliseconds);
        const zoned = adapter.setTimezone(value, timezone);
        expect(zoned.epochMilliseconds).toBe(epochMilliseconds);
        expect(adapter.getTimezone(zoned)).toBe(
          new Intl.DateTimeFormat("en-US", { timeZone: timezone }).resolvedOptions().timeZone
        );
        expect(adapter.setTimezone(zoned, "UTC").epochMilliseconds).toBe(epochMilliseconds);
      }
    },
    { arbitrary: fcRuns(100) }
  );
});
