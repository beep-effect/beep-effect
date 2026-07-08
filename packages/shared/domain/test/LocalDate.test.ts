import {
  addDays,
  addMonths,
  addYears,
  daysInMonth,
  diffInDays,
  endOfMonth,
  endOfYear,
  equals,
  fromDate,
  fromDateTime,
  fromString,
  isAfter,
  isBefore,
  isLeapYear,
  isLocalDate,
  LocalDateFromString,
  Model,
  make,
  makeEffect,
  makeOption,
  Order,
  startOfMonth,
  startOfYear,
  today,
  todayEffect,
} from "@beep/shared-domain/values/LocalDate";
import { fcRuns } from "@beep/test-utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Exit } from "effect";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Hash from "effect/Hash";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc, TestClock } from "effect/testing";

const juneFifteenth = () => make({ year: 2024, month: 6, day: 15 });
const ModelArbitrary = S.toArbitrary(Model);

const expectFailure = Effect.fn("expectFailure")(function* <A, E>(effect: Effect.Effect<A, E, never>) {
  const exit = yield* Effect.exit(effect);
  assert.strictEqual(Exit.isFailure(exit), true);
});

describe("LocalDate.Model", () => {
  it("constructs, formats, stringifies, hashes, and compares values", () => {
    const date = make({ year: 99, month: 2, day: 5 });
    const sameDate = make({ year: 99, month: 2, day: 5 });
    const nextDate = make({ year: 99, month: 2, day: 6 });

    expect(date).toBeInstanceOf(Model);
    expect(date.toISOString()).toBe("0099-02-05");
    expect(date.toString()).toBe("0099-02-05");
    expect(Hash.hash(date)).toBe(Hash.string("0099-02-05"));
    expect(Equal.equals(date, sameDate)).toBe(true);
    expect(Equal.equals(date, nextDate)).toBe(false);
  });

  it("converts to DateTime.Utc and JavaScript Date at midnight UTC", () => {
    const date = juneFifteenth();
    const parts = DateTime.toPartsUtc(date.toDateTime());

    expect(parts.year).toBe(2024);
    expect(parts.month).toBe(6);
    expect(parts.day).toBe(15);
    expect(parts.hour).toBe(0);
    expect(parts.minute).toBe(0);
    expect(parts.second).toBe(0);
    expect(date.toDate().toISOString()).toBe("2024-06-15T00:00:00.000Z");
  });

  it.effect(
    "decodes and encodes the schema class",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeUnknownEffect(Model)({ year: 2024, month: 6, day: 15 });
      const encoded = yield* S.encodeEffect(Model)(decoded);

      assert.strictEqual(decoded.toISOString(), "2024-06-15");
      assert.deepEqual(encoded, { year: 2024, month: 6, day: 15 });
    })
  );

  it("round-trips schema-derived values through the class and string codecs", () =>
    fc.assert(
      fc.property(ModelArbitrary, (date) => {
        const encoded = S.encodeSync(Model)(date);
        const decoded = S.decodeUnknownSync(Model)(encoded);
        const encodedString = S.encodeSync(LocalDateFromString)(date);
        const decodedString = S.decodeUnknownSync(LocalDateFromString)(encodedString);

        assert.instanceOf(decoded, Model);
        assert.strictEqual(equals(decoded, date), true);
        assert.strictEqual(encodedString, date.toISOString());
        assert.strictEqual(equals(decodedString, date), true);
      }),
      fcRuns(50)
    ));

  it.effect("rejects impossible calendar dates at the schema boundary", () =>
    expectFailure(S.decodeUnknownEffect(Model)({ year: 2024, month: 2, day: 30 }))
  );
});

describe("constructors", () => {
  it("constructs LocalDate values through unsafe, optional, and effectful helpers", () => {
    const date = make({ year: 2024, month: 6, day: 15 });
    const optionalDate = makeOption({ year: 2024, month: 6, day: 15 });
    const invalidDate = makeOption({ year: 2024, month: 13, day: 15 });
    const impossibleDate = makeOption({ year: 2024, month: 2, day: 30 });

    expect(date.toISOString()).toBe("2024-06-15");
    expect(O.isSome(optionalDate)).toBe(true);
    expect(O.isNone(invalidDate)).toBe(true);
    expect(O.isNone(impossibleDate)).toBe(true);
    expect(() => make({ year: 2024, month: 6, day: 31 })).toThrow();
  });

  it.effect("fails effectful construction when fields are outside schema bounds", () =>
    expectFailure(makeEffect({ year: 2024, month: 13, day: 15 }))
  );

  it.effect("fails effectful construction for impossible calendar dates", () =>
    expectFailure(makeEffect({ year: 2023, month: 2, day: 29 }))
  );

  it("guards LocalDate instances", () => {
    expect(isLocalDate(juneFifteenth())).toBe(true);
    expect(isLocalDate({ year: 2024, month: 6, day: 15 })).toBe(false);
    expect(isLocalDate(null)).toBe(false);
  });

  it.effect(
    "parses ISO date strings and rejects invalid fromString inputs",
    Effect.fnUntraced(function* () {
      const date = yield* fromString("2024-06-15");

      assert.strictEqual(date.toISOString(), "2024-06-15");
      yield* expectFailure(fromString("2024/06/15"));
      yield* expectFailure(fromString("2024-00-15"));
      yield* expectFailure(fromString("2024-13-15"));
      yield* expectFailure(fromString("2024-06-00"));
      yield* expectFailure(fromString("2024-06-31"));
      yield* expectFailure(fromString("0000-01-01"));
    })
  );

  it("constructs from Date and DateTime using UTC calendar fields", () => {
    const dateTime = DateTime.makeUnsafe("2024-06-15T23:59:59.000Z");

    expect(fromDate(dateTime.pipe(DateTime.toDateUtc)).toISOString()).toBe("2024-06-15");
    expect(fromDateTime(dateTime).toISOString()).toBe("2024-06-15");
    expect(isLocalDate(today())).toBe(true);
  });

  it.effect(
    "constructs today's date from TestClock",
    Effect.fnUntraced(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe("2024-06-15T12:00:00.000Z")));
      const today = yield* todayEffect;
      assert.strictEqual(today.toISOString(), "2024-06-15");

      yield* TestClock.adjust(Duration.days(1));
      const tomorrow = yield* todayEffect;
      assert.strictEqual(tomorrow.toISOString(), "2024-06-16");
    })
  );
});

describe("ordering and predicates", () => {
  it("orders by year, month, day, and equality", () => {
    const base = juneFifteenth();
    const nextDay = make({ year: 2024, month: 6, day: 16 });
    const nextMonth = make({ year: 2024, month: 7, day: 1 });
    const nextYear = make({ year: 2025, month: 1, day: 1 });

    expect(Order(base, nextYear)).toBe(-1);
    expect(Order(nextYear, base)).toBe(1);
    expect(Order(base, nextMonth)).toBe(-1);
    expect(Order(nextMonth, base)).toBe(1);
    expect(Order(base, nextDay)).toBe(-1);
    expect(Order(nextDay, base)).toBe(1);
    expect(Order(base, base)).toBe(0);
  });

  it("supports data-first and data-last predicate helpers", () => {
    const base = juneFifteenth();
    const nextDay = make({ year: 2024, month: 6, day: 16 });
    const nextMonth = make({ year: 2024, month: 7, day: 15 });
    const nextYear = make({ year: 2025, month: 6, day: 15 });

    expect(isBefore(base, nextDay)).toBe(true);
    expect(isBefore(nextDay)(base)).toBe(true);
    expect(isBefore(nextDay, base)).toBe(false);
    expect(isBefore(base, base)).toBe(false);
    expect(isAfter(nextDay, base)).toBe(true);
    expect(isAfter(base)(nextDay)).toBe(true);
    expect(isAfter(base, nextDay)).toBe(false);
    expect(isAfter(base, base)).toBe(false);
    expect(equals(base, juneFifteenth())).toBe(true);
    expect(equals(nextDay)(base)).toBe(false);
    expect(equals(base, nextMonth)).toBe(false);
    expect(equals(base, nextYear)).toBe(false);
  });
});

describe("date arithmetic", () => {
  it("adds days, months, and years", () => {
    const date = juneFifteenth();

    expect(addDays(date, 5).toISOString()).toBe("2024-06-20");
    expect(addDays(-5)(date).toISOString()).toBe("2024-06-10");
    expect(addDays(make({ year: 2024, month: 6, day: 30 }), 1).toISOString()).toBe("2024-07-01");
    expect(addMonths(date, 3).toISOString()).toBe("2024-09-15");
    expect(addMonths(3)(make({ year: 2024, month: 11, day: 15 })).toISOString()).toBe("2025-02-15");
    expect(addYears(date, 2).toISOString()).toBe("2026-06-15");
    expect(addYears(1)(date).toISOString()).toBe("2025-06-15");
  });

  it("calculates whole-day differences", () => {
    const left = make({ year: 2024, month: 6, day: 20 });
    const right = juneFifteenth();

    expect(diffInDays(left, right)).toBe(5);
    expect(diffInDays(left)(right)).toBe(-5);
    expect(diffInDays(right, right)).toBe(0);
  });

  it("returns month and year boundaries", () => {
    const date = juneFifteenth();

    expect(startOfMonth(date).toISOString()).toBe("2024-06-01");
    expect(endOfMonth(date).toISOString()).toBe("2024-06-30");
    expect(endOfMonth(make({ year: 2024, month: 2, day: 15 })).toISOString()).toBe("2024-02-29");
    expect(startOfYear(date).toISOString()).toBe("2024-01-01");
    expect(endOfYear(date).toISOString()).toBe("2024-12-31");
  });

  it("handles leap years and month lengths", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(daysInMonth(2024, 1)).toBe(31);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2)(2023)).toBe(28);
    expect(daysInMonth(2024, 4)).toBe(30);
    expect(daysInMonth(2024, 7)).toBe(31);
  });
});

describe("LocalDateFromString", () => {
  const decode = S.decodeUnknownEffect(LocalDateFromString);
  const encode = S.encodeEffect(LocalDateFromString);

  it.effect(
    "decodes and encodes ISO local-date strings",
    Effect.fnUntraced(function* () {
      const date = yield* decode("2024-06-15");
      const encoded = yield* encode(date);
      const padded = yield* encode(make({ year: 99, month: 2, day: 5 }));

      assert.instanceOf(date, Model);
      assert.strictEqual(date.toISOString(), "2024-06-15");
      assert.strictEqual(encoded, "2024-06-15");
      assert.strictEqual(padded, "0099-02-05");
    })
  );

  it.effect(
    "rejects malformed and impossible ISO local-date strings",
    Effect.fnUntraced(function* () {
      yield* expectFailure(decode("2024/06/15"));
      yield* expectFailure(decode("invalid"));
      yield* expectFailure(decode(""));
      yield* expectFailure(decode("0000-01-01"));
      yield* expectFailure(decode("2024-00-15"));
      yield* expectFailure(decode("2024-13-15"));
      yield* expectFailure(decode("2024-06-00"));
      yield* expectFailure(decode("2024-07-32"));
      yield* expectFailure(decode("2024-06-31"));
      yield* expectFailure(decode("2023-02-29"));
      yield* expectFailure(decode("2024-02-30"));
    })
  );

  it.effect(
    "round-trips through structs with encoded date fields",
    Effect.fnUntraced(function* () {
      const Params = S.Struct({
        startDate: LocalDateFromString,
        endDate: LocalDateFromString,
      });

      const decoded = yield* S.decodeUnknownEffect(Params)({
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
      const encoded = yield* S.encodeEffect(Params)(decoded);

      assert.strictEqual(decoded.startDate.toISOString(), "2024-01-01");
      assert.strictEqual(decoded.endDate.toISOString(), "2024-12-31");
      assert.deepEqual(encoded, {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
    })
  );
});
