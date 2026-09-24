import { fcRuns } from "@beep/fc-runs";
import {
  applyTimezone,
  createDateTimeWithTimezone,
  createInvalidDateTime,
  DateInputToDateTime,
  DateTimeInput,
  DateTimeInputDate,
  DateTimeInputInstant,
  DateTimeInputInstantWithZone,
  DateTimeInputKind,
  DateTimeInputNumber,
  DateTimeInputParts,
  DateTimeInputString,
  DateTimeUtcFromValid,
} from "@beep/schema/DateTimeUtcFromValid";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as DateTime from "effect/DateTime";
import * as Equal from "effect/Equal";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeDateTimeInputDate = S.decodeUnknownEffect(DateTimeInputDate);
const decodeDateTimeInputDateTagged = S.decodeUnknownEffect(DateTimeInputDate.Tagged);
const decodeDateTimeInputInstantWithZone = S.decodeUnknownEffect(DateTimeInputInstantWithZone);
const decodeDateTimeInputKind = S.decodeUnknownEffect(DateTimeInputKind);
const decodeDateTimeInputNumber = S.decodeUnknownEffect(DateTimeInputNumber);
const decodeDateTimeInputNumberTagged = S.decodeUnknownEffect(DateTimeInputNumber.Tagged);
const decodeDateTimeInputString = S.decodeUnknownEffect(DateTimeInputString);
const decodeDateTimeInputStringTagged = S.decodeUnknownEffect(DateTimeInputString.Tagged);
const decodeDateTimeUtcFromValid = S.decodeUnknownEffect(DateTimeUtcFromValid);
const decodeUnknownDateInputToDateTime = S.decodeUnknownEffect(DateInputToDateTime);

const NativeDate = globalThis.Date;

const iso = "2024-01-01T00:00:00.000Z";
const epochMilliseconds = 1_704_067_200_000;

const decodeInput = S.decodeUnknownEffect(DateTimeInput);
const decodeUtc = S.decodeUnknownEffect(DateTimeUtcFromValid);
const encodeUtc = S.encodeEffect(DateTimeUtcFromValid);

const expectEpochMillis = (actual: DateTime.Utc, expected: number) => {
  expect(DateTime.toEpochMillis(actual)).toBe(expected);
};

describe("DateTimeInputKind", () => {
  it.effect(
    "decodes supported discriminator values",
    Effect.fnUntraced(function* () {
      expect(yield* decodeDateTimeInputKind("Instant")).toBe("Instant");
    })
  );
});

describe("DateTime adapter helpers", () => {
  it.effect(
    "decodes nullable adapter input",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownDateInputToDateTime(null)).toBeNull();
      expect(yield* decodeUnknownDateInputToDateTime(undefined)).toBeUndefined();
      expect(yield* decodeUnknownDateInputToDateTime(iso)).toBe(iso);
    })
  );

  it("creates DateTime values with picker timezone semantics", () => {
    const utc = createDateTimeWithTimezone(iso, "UTC");
    const zoned = createDateTimeWithTimezone(iso, "Europe/London");

    expect(utc).not.toBeNull();
    expect(zoned).not.toBeNull();
    expect(utc !== null && DateTime.isUtc(utc)).toBe(true);
    expect(zoned !== null && DateTime.isZoned(zoned)).toBe(true);
    expect(zoned !== null && DateTime.isZoned(zoned) ? DateTime.zoneToString(zoned.zone) : "").toBe("Europe/London");
  });

  it("returns null for absent input and an invalid DateTime-shaped value for invalid strings", () => {
    const invalid = createDateTimeWithTimezone("not-a-date", "UTC");

    expect(createDateTimeWithTimezone(null, "UTC")).toBeNull();
    expect(createDateTimeWithTimezone(undefined, "UTC")).toBeNull();
    expect(invalid).not.toBeNull();
    expect(invalid !== null && Number.isNaN(invalid.epochMilliseconds)).toBe(true);
    expect(Number.isNaN(createInvalidDateTime().epochMilliseconds)).toBe(true);
  });

  it("applies offset timezone strings through Effect zone parsing", () => {
    const zoned = applyTimezone(DateTime.makeUnsafe(iso), "+03:00");

    expect(DateTime.isZoned(zoned)).toBe(true);
    expect(DateTime.isZoned(zoned) ? DateTime.zoneToString(zoned.zone) : "").toBe("+03:00");
  });
});

describe("DateTimeInput primitive schemas", () => {
  it.effect(
    "decode raw string, number, and Date inputs",
    Effect.fnUntraced(function* () {
      expect(yield* decodeInput(iso)).toBe(iso);
      expect(yield* decodeInput(epochMilliseconds)).toBe(epochMilliseconds);

      const date = DateTime.toDateUtc(DateTime.makeUnsafe(iso));

      expect(yield* decodeInput(date)).toBe(date);
    })
  );

  it.effect(
    "decode tagged string, number, and Date inputs",
    Effect.fnUntraced(function* () {
      const stringInput = DateTimeInputString.makeTagged(iso);
      const numberInput = DateTimeInputNumber.makeTagged(epochMilliseconds);
      const dateInput = DateTimeInputDate.makeTagged(DateTime.toDateUtc(DateTime.makeUnsafe(iso)));

      expect(yield* decodeDateTimeInputStringTagged(stringInput)).toEqual(stringInput);
      expect(yield* decodeDateTimeInputNumberTagged(numberInput)).toEqual(numberInput);
      expect(yield* decodeDateTimeInputDateTagged(dateInput)).toEqual(dateInput);
      expect(DateTimeInputString.Tagged.is(stringInput)).toBe(true);
      expect(DateTimeInputNumber.Tagged.is(numberInput)).toBe(true);
      expect(DateTimeInputDate.Tagged.is(dateInput)).toBe(true);
    })
  );

  it.effect(
    "rejects invalid primitive inputs",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeDateTimeInputString("not-a-date"));
      const isFailure1 = Result.isFailure(failure1);
      assertTrue(isFailure1);
      expect(failure1.failure.message).toContain("Expected a string that can be converted into a DateTime.Utc");
      const isFailure2 = Result.isFailure(yield* Effect.result(decodeDateTimeInputNumber(Number.POSITIVE_INFINITY)));
      assertTrue(isFailure2);
      const isFailure3 = Result.isFailure(
        yield* Effect.result(decodeDateTimeInputDate(Reflect.construct(NativeDate, ["not-a-date"])))
      );
      assertTrue(isFailure3);
    })
  );
});

describe("DateTimeInput tagged object schemas", () => {
  it.effect(
    "decodes Instant and InstantWithZone transport objects",
    Effect.fnUntraced(function* () {
      expect(yield* decodeInput(DateTimeInputInstant.make({ epochMilliseconds }))).toEqual(
        DateTimeInputInstant.make({ epochMilliseconds })
      );
      expect(
        yield* decodeInput(
          DateTimeInputInstantWithZone.make({
            epochMilliseconds,
            timeZoneId: "Europe/London",
          })
        )
      ).toEqual(
        DateTimeInputInstantWithZone.make({
          epochMilliseconds,
          timeZoneId: "Europe/London",
        })
      );
    })
  );

  it.effect(
    "rejects invalid InstantWithZone time zone identifiers",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.result(
        decodeDateTimeInputInstantWithZone({
          _tag: "InstantWithZone",
          epochMilliseconds,
          timeZoneId: "Not/AZone",
        })
      );
      const isFailure4 = Result.isFailure(failure2);
      assertTrue(isFailure4);
      expect(failure2.failure.message).toContain("Expected a valid DateTime time zone identifier");
    })
  );

  it.effect(
    "decodes partial Parts transport objects",
    Effect.fnUntraced(function* () {
      expect(
        yield* decodeInput(
          DateTimeInputParts.make({
            year: 2024,
            month: 1,
            day: 2,
            hour: 3,
            minute: 4,
            second: 5,
            millisecond: 6,
          })
        )
      ).toEqual(
        DateTimeInputParts.make({
          year: 2024,
          month: 1,
          day: 2,
          hour: 3,
          minute: 4,
          second: 5,
          millisecond: 6,
        })
      );
    })
  );
});

describe("DateTimeUtcFromValid", () => {
  it.effect(
    "decodes raw DateTime.Input primitives into DateTime.Utc",
    Effect.fnUntraced(function* () {
      expectEpochMillis(yield* decodeUtc(iso), epochMilliseconds);
      expectEpochMillis(yield* decodeUtc(epochMilliseconds), epochMilliseconds);
      expectEpochMillis(yield* decodeUtc(DateTime.makeUnsafe(iso).pipe(DateTime.toDateUtc)), epochMilliseconds);
    })
  );

  it.effect(
    "decodes tagged primitive inputs into DateTime.Utc",
    Effect.fnUntraced(function* () {
      expectEpochMillis(yield* decodeUtc(DateTimeInputString.makeTagged(iso)), epochMilliseconds);
      expectEpochMillis(yield* decodeUtc(DateTimeInputNumber.makeTagged(epochMilliseconds)), epochMilliseconds);
      expectEpochMillis(
        yield* decodeUtc(DateTimeInputDate.makeTagged(DateTime.makeUnsafe(iso).pipe(DateTime.toDateUtc))),
        epochMilliseconds
      );
    })
  );

  it.effect(
    "decodes existing DateTime.Utc and DateTime.Zoned values into UTC",
    Effect.fnUntraced(function* () {
      const utc = DateTime.makeUnsafe(iso);
      const zoned = DateTime.makeZonedUnsafe(iso, { timeZone: "Europe/London" });

      expectEpochMillis(yield* decodeUtc(utc), epochMilliseconds);
      expectEpochMillis(yield* decodeUtc(zoned), epochMilliseconds);
    })
  );

  it.effect(
    "decodes Instant and InstantWithZone into UTC",
    Effect.fnUntraced(function* () {
      expectEpochMillis(yield* decodeUtc(DateTimeInputInstant.make({ epochMilliseconds })), epochMilliseconds);
      expectEpochMillis(
        yield* decodeUtc(
          DateTimeInputInstantWithZone.make({
            epochMilliseconds,
            timeZoneId: "UTC",
          })
        ),
        epochMilliseconds
      );
    })
  );

  it.effect(
    "decodes partial Parts into UTC",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeUtc(
        DateTimeInputParts.make({
          year: 2024,
          month: 1,
          day: 2,
          hour: 3,
          minute: 4,
          second: 5,
          millisecond: 6,
        })
      );

      expect(DateTime.formatIso(decoded)).toBe("2024-01-02T03:04:05.006Z");
    })
  );

  it.effect(
    "encodes DateTime.Utc into canonical tagged ISO string input",
    Effect.fnUntraced(function* () {
      expect(yield* encodeUtc(DateTime.makeUnsafe(iso))).toEqual(DateTimeInputString.makeTagged(iso));
    })
  );

  it.effect(
    "rejects input that passes the shape schema but cannot become a DateTime.Utc",
    Effect.fnUntraced(function* () {
      const failure3 = yield* Effect.result(decodeUtc(DateTimeInputParts.make({ year: 1e100 })));
      const isFailure5 = Result.isFailure(failure3);
      assertTrue(isFailure5);
      expect(failure3.failure.message).toContain("Expected a valid Effect DateTime.Input value");
    })
  );

  it.effect.prop(
    "schema-derived values satisfy the encode round-trip law",
    [Arbitrary.schema(DateTimeUtcFromValid)],
    Effect.fnUntraced(function* ([utc]) {
      // Encoding is lossy (canonical tagged ISO string), so assert the robust
      // law encode(decode(encode(x))) deep-equals encode(x) plus the Type-level
      // invariant that every decoded value is a DateTime.Utc preserving the instant.
      const encoded = yield* encodeUtc(utc);
      const roundTripped = yield* decodeDateTimeUtcFromValid(encoded);

      expect(DateTime.isDateTime(roundTripped)).toBe(true);
      expect(Equal.equals(yield* encodeUtc(roundTripped), encoded)).toBe(true);
      expect(DateTime.toEpochMillis(roundTripped)).toBe(DateTime.toEpochMillis(utc));

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );
});
