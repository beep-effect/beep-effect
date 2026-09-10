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
import { Effect } from "effect";
import * as DateTime from "effect/DateTime";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeDateTimeInputDateSync = S.decodeSync(DateTimeInputDate);
const decodeDateTimeInputDateTaggedSync = S.decodeSync(DateTimeInputDate.Tagged);
const decodeDateTimeInputInstantWithZoneSync = S.decodeSync(DateTimeInputInstantWithZone);
const decodeDateTimeInputKindSync = S.decodeSync(DateTimeInputKind);
const decodeDateTimeInputNumberSync = S.decodeSync(DateTimeInputNumber);
const decodeDateTimeInputNumberTaggedSync = S.decodeSync(DateTimeInputNumber.Tagged);
const decodeDateTimeInputStringSync = S.decodeSync(DateTimeInputString);
const decodeDateTimeInputStringTaggedSync = S.decodeSync(DateTimeInputString.Tagged);
const decodeDateTimeUtcFromValidSync = S.decodeSync(DateTimeUtcFromValid);
const decodeUnknownDateInputToDateTimeSync = S.decodeUnknownSync(DateInputToDateTime);

const NativeDate = globalThis.Date;

const iso = "2024-01-01T00:00:00.000Z";
const epochMilliseconds = 1_704_067_200_000;

const decodeInput = S.decodeUnknownSync(DateTimeInput);
const decodeUtc = S.decodeUnknownSync(DateTimeUtcFromValid);
const encodeUtc = S.encodeSync(DateTimeUtcFromValid);

const expectEpochMillis = (actual: DateTime.Utc, expected: number) => {
  expect(DateTime.toEpochMillis(actual)).toBe(expected);
};

describe("DateTimeInputKind", () => {
  it("decodes supported discriminator values", () => {
    expect(decodeDateTimeInputKindSync("Instant")).toBe("Instant");
  });
});

describe("DateTime adapter helpers", () => {
  it("decodes nullable adapter input", () => {
    expect(decodeUnknownDateInputToDateTimeSync(null)).toBeNull();
    expect(decodeUnknownDateInputToDateTimeSync(undefined)).toBeUndefined();
    expect(decodeUnknownDateInputToDateTimeSync(iso)).toBe(iso);
  });

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
  it("decode raw string, number, and Date inputs", () => {
    expect(decodeInput(iso)).toBe(iso);
    expect(decodeInput(epochMilliseconds)).toBe(epochMilliseconds);

    const date = DateTime.toDateUtc(DateTime.makeUnsafe(iso));

    expect(decodeInput(date)).toBe(date);
  });

  it("decode tagged string, number, and Date inputs", () => {
    const stringInput = DateTimeInputString.makeTagged(iso);
    const numberInput = DateTimeInputNumber.makeTagged(epochMilliseconds);
    const dateInput = DateTimeInputDate.makeTagged(DateTime.toDateUtc(DateTime.makeUnsafe(iso)));

    expect(decodeDateTimeInputStringTaggedSync(stringInput)).toEqual(stringInput);
    expect(decodeDateTimeInputNumberTaggedSync(numberInput)).toEqual(numberInput);
    expect(decodeDateTimeInputDateTaggedSync(dateInput)).toEqual(dateInput);
    expect(DateTimeInputString.Tagged.is(stringInput)).toBe(true);
    expect(DateTimeInputNumber.Tagged.is(numberInput)).toBe(true);
    expect(DateTimeInputDate.Tagged.is(dateInput)).toBe(true);
  });

  it("rejects invalid primitive inputs", () => {
    expect(() => decodeDateTimeInputStringSync("not-a-date")).toThrow(
      "Expected a string that can be converted into a DateTime.Utc"
    );
    expect(() => decodeDateTimeInputNumberSync(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => decodeDateTimeInputDateSync(Reflect.construct(NativeDate, ["not-a-date"]) as Date)).toThrow();
  });
});

describe("DateTimeInput tagged object schemas", () => {
  it("decodes Instant and InstantWithZone transport objects", () => {
    expect(decodeInput(DateTimeInputInstant.make({ epochMilliseconds }))).toEqual(
      DateTimeInputInstant.make({ epochMilliseconds })
    );
    expect(
      decodeInput(
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
  });

  it("rejects invalid InstantWithZone time zone identifiers", () => {
    expect(() =>
      decodeDateTimeInputInstantWithZoneSync({
        _tag: "InstantWithZone",
        epochMilliseconds,
        timeZoneId: "Not/AZone",
      })
    ).toThrow("Expected a valid DateTime time zone identifier");
  });

  it("decodes partial Parts transport objects", () => {
    expect(
      decodeInput(
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
  });
});

describe("DateTimeUtcFromValid", () => {
  it("decodes raw DateTime.Input primitives into DateTime.Utc", () => {
    expectEpochMillis(decodeUtc(iso), epochMilliseconds);
    expectEpochMillis(decodeUtc(epochMilliseconds), epochMilliseconds);
    expectEpochMillis(decodeUtc(DateTime.makeUnsafe(iso).pipe(DateTime.toDateUtc)), epochMilliseconds);
  });

  it("decodes tagged primitive inputs into DateTime.Utc", () => {
    expectEpochMillis(decodeUtc(DateTimeInputString.makeTagged(iso)), epochMilliseconds);
    expectEpochMillis(decodeUtc(DateTimeInputNumber.makeTagged(epochMilliseconds)), epochMilliseconds);
    expectEpochMillis(
      decodeUtc(DateTimeInputDate.makeTagged(DateTime.makeUnsafe(iso).pipe(DateTime.toDateUtc))),
      epochMilliseconds
    );
  });

  it("decodes existing DateTime.Utc and DateTime.Zoned values into UTC", () => {
    const utc = DateTime.makeUnsafe(iso);
    const zoned = DateTime.makeZonedUnsafe(iso, { timeZone: "Europe/London" });

    expectEpochMillis(decodeUtc(utc), epochMilliseconds);
    expectEpochMillis(decodeUtc(zoned), epochMilliseconds);
  });

  it("decodes Instant and InstantWithZone into UTC", () => {
    expectEpochMillis(decodeUtc(DateTimeInputInstant.make({ epochMilliseconds })), epochMilliseconds);
    expectEpochMillis(
      decodeUtc(
        DateTimeInputInstantWithZone.make({
          epochMilliseconds,
          timeZoneId: "UTC",
        })
      ),
      epochMilliseconds
    );
  });

  it("decodes partial Parts into UTC", () => {
    const decoded = decodeUtc(
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
  });

  it("encodes DateTime.Utc into canonical tagged ISO string input", () => {
    expect(encodeUtc(DateTime.makeUnsafe(iso))).toEqual(DateTimeInputString.makeTagged(iso));
  });

  it("rejects input that passes the shape schema but cannot become a DateTime.Utc", () => {
    expect(() => decodeUtc(DateTimeInputParts.make({ year: 1e100 }))).toThrow(
      "Expected a valid Effect DateTime.Input value"
    );
  });

  it("schema-derived values satisfy the encode round-trip law", () => {
    const arbitrary = Arbitrary.schema(DateTimeUtcFromValid);
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([utc]) => {
            // Encoding is lossy (canonical tagged ISO string), so assert the robust
            // law encode(decode(encode(x))) deep-equals encode(x) plus the Type-level
            // invariant that every decoded value is a DateTime.Utc preserving the instant.
            const encoded = encodeUtc(utc);
            const roundTripped = decodeDateTimeUtcFromValidSync(encoded);

            expect(DateTime.isDateTime(roundTripped)).toBe(true);
            expect(Equal.equals(encodeUtc(roundTripped), encoded)).toBe(true);
            expect(DateTime.toEpochMillis(roundTripped)).toBe(DateTime.toEpochMillis(utc));

            return true;
          },
          fcRuns(50)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });
});
