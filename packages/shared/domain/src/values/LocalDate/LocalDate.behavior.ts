/**
 * LocalDate value object behavior.
 *
 * Provides pure constructors, predicates, ordering, date arithmetic, and string
 * boundary codecs for {@link Model}. Runtime validation that depends on the
 * relationship between year, month, and day lives here.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity";
import { Str } from "@beep/utils";
import { DateTime, Duration, Effect, Order as Ord, pipe, SchemaGetter, SchemaIssue } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { daysInGregorianMonth, isGregorianLeapYear } from "./LocalDate.calendar.ts";
import * as LocalDate from "./LocalDate.model.ts";
import type * as Ordering from "effect/Ordering";
import type * as AST from "effect/SchemaAST";
import type { CalendarParts } from "./LocalDate.calendar.ts";

const $I = $SharedDomainId.create("values/LocalDate/LocalDate.behavior");

/**
 * Unsafe constructor for a `LocalDate` model.
 *
 * **Example** (Construct LocalDate from fields)
 *
 * ```ts
 * import { make } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = make({ year: 2024, month: 6, day: 15 })
 *
 * console.log(date.toISOString()) // "2024-06-15"
 * ```
 *
 * @param input - Calendar field payload to construct from.
 * @returns Constructed LocalDate model.
 * @category constructors
 * @since 0.0.0
 */
export const make = (input: CalendarParts): LocalDate.Model => LocalDate.Model.make(input);

/**
 * Optional constructor for a `LocalDate` model.
 *
 * **Details**
 *
 * Returns `Option.none()` when the model fields fail schema validation.
 *
 * **Example** (Optional LocalDate construction)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { makeOption } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = makeOption({ year: 2024, month: 6, day: 15 })
 *
 * console.log(O.isSome(date)) // true
 * ```
 *
 * @param input - Calendar field payload to construct from.
 * @returns Optional LocalDate model when the payload is valid.
 * @category constructors
 * @since 0.0.0
 */
export const makeOption = (input: CalendarParts): O.Option<LocalDate.Model> => LocalDate.Model.makeOption(input);

/**
 * Effectful constructor for a `LocalDate` model.
 *
 * **Details**
 *
 * Fails with `Schema.SchemaError` when the model fields fail schema validation.
 *
 * **Example** (Effectful LocalDate construction)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { makeEffect } from "@beep/shared-domain/values/LocalDate"
 *
 * const iso = Effect.runSync(Effect.gen(function* () {
 *   const date = yield* makeEffect({ year: 2024, month: 6, day: 15 })
 *   return date.toISOString()
 * }))
 *
 * console.log(iso) // "2024-06-15"
 * ```
 *
 * @param input - Calendar field payload to construct from.
 * @returns Effect that succeeds with a LocalDate model.
 * @effects Performs pure schema validation; requires no services and fails
 * with `S.SchemaError` instead of throwing when the calendar fields are
 * invalid.
 * @category constructors
 * @since 0.0.0
 */
export const makeEffect = (input: CalendarParts): Effect.Effect<LocalDate.Model, S.SchemaError> =>
  pipe(
    LocalDate.Model.makeEffect(input),
    Effect.mapError((issue) => new S.SchemaError(issue))
  );

/**
 * Type guard for `LocalDate` model instances.
 *
 * **Example** (Guard LocalDate instances)
 *
 * ```ts
 * import { isLocalDate, make } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = make({ year: 2024, month: 6, day: 15 })
 *
 * console.log(isLocalDate(date)) // true
 * ```
 *
 * @param value - Unknown value to test.
 * @returns `true` when the value is a LocalDate model.
 * @category guards
 * @since 0.0.0
 */
export const isLocalDate = LocalDate.Model.is;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const toCalendarParts = ([, yearString, monthString, dayString]: RegExpMatchArray): CalendarParts => ({
  year: globalThis.Number.parseInt(yearString, 10),
  month: globalThis.Number.parseInt(monthString, 10),
  day: globalThis.Number.parseInt(dayString, 10),
});

const decodeLocalDateFromString: (
  dateString: string,
  options: AST.ParseOptions
) => Effect.Effect<LocalDate.Model, SchemaIssue.Issue> = Effect.fn("LocalDateFromString.decode")(function* (
  dateString: string,
  _options: AST.ParseOptions
) {
  const parts = yield* O.match(Str.match(ISO_DATE_PATTERN)(dateString), {
    onNone: () =>
      Effect.fail(
        new SchemaIssue.InvalidValue({
          message: "Expected an ISO 8601 local date in YYYY-MM-DD format",
        })
      ),
    onSome: (match) => Effect.succeed(toCalendarParts(match)),
  });

  if (parts.year < 1) {
    return yield* Effect.fail(new SchemaIssue.InvalidType(S.String.ast));
  }

  if (parts.month < 1 || parts.month > 12) {
    return yield* Effect.fail(new SchemaIssue.InvalidType(S.String.ast));
  }

  if (parts.day < 1 || parts.day > daysInGregorianMonth(parts.year, parts.month)) {
    return yield* Effect.fail(new SchemaIssue.InvalidType(S.String.ast));
  }

  return LocalDate.Model.make(parts);
});

const formatCalendarParts = ({ day, month, year }: CalendarParts): string => {
  const paddedYear = Str.padStart(4, "0")(`${year}`);
  const paddedMonth = Str.padStart(2, "0")(`${month}`);
  const paddedDay = Str.padStart(2, "0")(`${day}`);
  return `${paddedYear}-${paddedMonth}-${paddedDay}`;
};

const encodeLocalDateFromString = (localDate: CalendarParts): string => formatCalendarParts(localDate);
const LocalDateEquivalence = S.toEquivalence(LocalDate.Model);

/**
 * Parse a `YYYY-MM-DD` string into a `LocalDate` model.
 *
 * **Details**
 *
 * The returned effect fails when the input is not an ISO local date or does not
 * represent a real calendar date.
 *
 * **Example** (Parse ISO local date string)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { fromString } from "@beep/shared-domain/values/LocalDate"
 *
 * const month = Effect.runSync(Effect.gen(function* () {
 *   const date = yield* fromString("2024-06-15")
 *   return date.month
 * }))
 *
 * console.log(month) // 6
 * ```
 *
 * @param dateString - ISO local-date text to parse.
 * @returns Effect that succeeds with the parsed LocalDate.
 * @effects Parses and validates in memory; requires no services and fails with
 * `S.SchemaError` for malformed strings or impossible calendar dates.
 * @category constructors
 * @since 0.0.0
 */
export const fromString = (dateString: string): Effect.Effect<LocalDate.Model, S.SchemaError> =>
  S.decodeEffect(LocalDateFromString)(dateString);

/**
 * Create a `LocalDate` from a JavaScript `Date` using UTC calendar components.
 *
 * **Example** (LocalDate from UTC Date)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { fromDate } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = fromDate(DateTime.toDateUtc(DateTime.makeUnsafe("2024-06-15T12:00:00.000Z")))
 *
 * console.log(date.toISOString()) // "2024-06-15"
 * ```
 *
 * @param date - JavaScript Date whose UTC date components should be extracted.
 * @returns LocalDate model for the Date's UTC calendar day.
 * @category constructors
 * @since 0.0.0
 */
export const fromDate = (date: Date): LocalDate.Model => fromDateTime(DateTime.fromDateUnsafe(date));

/**
 * Get today's UTC LocalDate using the live clock.
 *
 * **Example** (Today UTC LocalDate)
 *
 * ```ts
 * import { today } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = today()
 *
 * console.log(date.toISOString())
 * ```
 *
 * @returns LocalDate model for today's UTC calendar day.
 * @category constructors
 * @since 0.0.0
 */
export const today = (): LocalDate.Model => fromDateTime(DateTime.nowUnsafe());

/**
 * Get today's UTC LocalDate using Effect's `Clock` service.
 *
 * **Details**
 *
 * This effect is deterministic under `TestClock`, which makes it the preferred
 * constructor for tested workflows.
 *
 * **Example** (Today via Clock service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { todayEffect } from "@beep/shared-domain/values/LocalDate"
 *
 * const program = Effect.gen(function* () {
 *   const date = yield* todayEffect
 *   return date.toISOString()
 * })
 * ```
 *
 * @returns Effect that reads today's UTC LocalDate from Clock.
 * @category constructors
 * @since 0.0.0
 */
export const todayEffect = pipe(
  Effect.clockWith((clock) => clock.currentTimeMillis),
  Effect.map((millis) => fromDateTime(DateTime.makeUnsafe(millis)))
);

/**
 * Create a `LocalDate` from an Effect `DateTime` using UTC calendar components.
 *
 * **Example** (LocalDate from DateTime UTC)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { fromDateTime } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = fromDateTime(DateTime.makeUnsafe("2024-06-15T12:00:00.000Z"))
 *
 * console.log(date.toISOString()) // "2024-06-15"
 * ```
 *
 * @param dateTime - Effect DateTime whose UTC date components should be extracted.
 * @returns LocalDate model for the DateTime's UTC calendar day.
 * @category constructors
 * @since 0.0.0
 */
export const fromDateTime = (dateTime: DateTime.DateTime): LocalDate.Model => {
  const parts = DateTime.toPartsUtc(dateTime);
  return LocalDate.Model.make({
    year: parts.year,
    month: parts.month,
    day: parts.day,
  });
};

const toOrderTuple = (date: LocalDate.Model): readonly [number, number, number] => [date.year, date.month, date.day];

/**
 * Chronological order for `LocalDate` values.
 *
 * **Example** (Compare chronological order)
 *
 * ```ts
 * import { Order, make } from "@beep/shared-domain/values/LocalDate"
 *
 * const left = make({ year: 2024, month: 6, day: 15 })
 * const right = make({ year: 2024, month: 6, day: 16 })
 *
 * console.log(Order(left, right)) // -1
 * ```
 *
 * @param left - Left LocalDate value.
 * @param right - Right LocalDate value.
 * @returns Negative when left is before right, positive when after, and zero when equal.
 * @category utilities
 * @since 0.0.0
 */
export const Order: {
  (right: LocalDate.Model): (left: LocalDate.Model) => Ordering.Ordering;
  (left: LocalDate.Model, right: LocalDate.Model): Ordering.Ordering;
} = dual(2, Ord.mapInput(Ord.Tuple([Ord.Number, Ord.Number, Ord.Number]), toOrderTuple));

/**
 * Test whether one LocalDate is chronologically before another.
 *
 * **Example** (Check date is before)
 *
 * ```ts
 * import { isBefore, make } from "@beep/shared-domain/values/LocalDate"
 *
 * const left = make({ year: 2024, month: 6, day: 15 })
 * const right = make({ year: 2024, month: 6, day: 16 })
 *
 * console.log(isBefore(left, right)) // true
 * ```
 *
 * @param self - LocalDate value to test.
 * @param that - LocalDate value to compare against.
 * @returns `true` when `self` is before `that`.
 * @category predicates
 * @since 0.0.0
 */
export const isBefore: {
  (that: LocalDate.Model): (self: LocalDate.Model) => boolean;
  (self: LocalDate.Model, that: LocalDate.Model): boolean;
} = dual(2, (self: LocalDate.Model, that: LocalDate.Model): boolean => Order(self, that) === -1);

/**
 * Test whether one LocalDate is chronologically after another.
 *
 * **Example** (Check date is after)
 *
 * ```ts
 * import { isAfter, make } from "@beep/shared-domain/values/LocalDate"
 *
 * const left = make({ year: 2024, month: 6, day: 16 })
 * const right = make({ year: 2024, month: 6, day: 15 })
 *
 * console.log(isAfter(left, right)) // true
 * ```
 *
 * @param self - LocalDate value to test.
 * @param that - LocalDate value to compare against.
 * @returns `true` when `self` is after `that`.
 * @category predicates
 * @since 0.0.0
 */
export const isAfter: {
  (that: LocalDate.Model): (self: LocalDate.Model) => boolean;
  (self: LocalDate.Model, that: LocalDate.Model): boolean;
} = dual(2, (self: LocalDate.Model, that: LocalDate.Model): boolean => Order(self, that) === 1);

/**
 * Test whether two LocalDate values represent the same calendar date.
 *
 * **Example** (Compare equal calendar dates)
 *
 * ```ts
 * import { equals, make } from "@beep/shared-domain/values/LocalDate"
 *
 * const left = make({ year: 2024, month: 6, day: 15 })
 * const right = make({ year: 2024, month: 6, day: 15 })
 *
 * console.log(equals(left, right)) // true
 * ```
 *
 * @param self - LocalDate value to test.
 * @param that - LocalDate value to compare against.
 * @returns `true` when both LocalDate values have the same calendar fields.
 * @category predicates
 * @since 0.0.0
 */
export const equals: {
  (that: LocalDate.Model): (self: LocalDate.Model) => boolean;
  (self: LocalDate.Model, that: LocalDate.Model): boolean;
} = dual(2, LocalDateEquivalence);

/**
 * Add whole days to a LocalDate.
 *
 * **Example** (Add days across month)
 *
 * ```ts
 * import { addDays, make } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = make({ year: 2024, month: 6, day: 30 })
 * const next = addDays(date, 1)
 *
 * console.log(next.toISOString()) // "2024-07-01"
 * ```
 *
 * @param self - LocalDate value to add days to.
 * @param days - Whole days to add.
 * @returns LocalDate shifted by the requested day count.
 * @category combinators
 * @since 0.0.0
 */
export const addDays: {
  (days: number): (self: LocalDate.Model) => LocalDate.Model;
  (self: LocalDate.Model, days: number): LocalDate.Model;
} = dual(
  2,
  (self: LocalDate.Model, days: number): LocalDate.Model =>
    pipe(self.toDateTime(), DateTime.add({ days }), fromDateTime)
);

/**
 * Add whole months to a LocalDate.
 *
 * **Example** (Add months across year)
 *
 * ```ts
 * import { addMonths, make } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = make({ year: 2024, month: 11, day: 15 })
 * const next = addMonths(date, 3)
 *
 * console.log(next.toISOString()) // "2025-02-15"
 * ```
 *
 * @param self - LocalDate value to add months to.
 * @param months - Whole months to add.
 * @returns LocalDate shifted by the requested month count.
 * @category combinators
 * @since 0.0.0
 */
export const addMonths: {
  (months: number): (self: LocalDate.Model) => LocalDate.Model;
  (self: LocalDate.Model, months: number): LocalDate.Model;
} = dual(
  2,
  (self: LocalDate.Model, months: number): LocalDate.Model =>
    pipe(self.toDateTime(), DateTime.add({ months }), fromDateTime)
);

/**
 * Add whole years to a LocalDate.
 *
 * **Example** (Add whole years)
 *
 * ```ts
 * import { addYears, make } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = make({ year: 2024, month: 6, day: 15 })
 * const next = addYears(date, 2)
 *
 * console.log(next.toISOString()) // "2026-06-15"
 * ```
 *
 * @param self - LocalDate value to add years to.
 * @param years - Whole years to add.
 * @returns LocalDate shifted by the requested year count.
 * @category combinators
 * @since 0.0.0
 */
export const addYears: {
  (years: number): (self: LocalDate.Model) => LocalDate.Model;
  (self: LocalDate.Model, years: number): LocalDate.Model;
} = dual(
  2,
  (self: LocalDate.Model, years: number): LocalDate.Model =>
    pipe(self.toDateTime(), DateTime.add({ years }), fromDateTime)
);

/**
 * Get the difference in whole days between two LocalDate values.
 *
 * **Details**
 *
 * The result is positive when `self` is after `that` and negative when `self`
 * is before `that`.
 *
 * **Example** (Day difference between dates)
 *
 * ```ts
 * import { diffInDays, make } from "@beep/shared-domain/values/LocalDate"
 *
 * const left = make({ year: 2024, month: 6, day: 20 })
 * const right = make({ year: 2024, month: 6, day: 15 })
 *
 * console.log(diffInDays(left, right)) // 5
 * ```
 *
 * @param self - LocalDate value used as the minuend.
 * @param that - LocalDate value used as the subtrahend.
 * @returns Whole calendar-day difference between the two values.
 * @category utilities
 * @since 0.0.0
 */
export const diffInDays: {
  (that: LocalDate.Model): (self: LocalDate.Model) => number;
  (self: LocalDate.Model, that: LocalDate.Model): number;
} = dual(2, (self: LocalDate.Model, that: LocalDate.Model): number => {
  const millisPerDay = Duration.toMillis(Duration.days(1));
  return Math.round(
    (DateTime.toEpochMillis(self.toDateTime()) - DateTime.toEpochMillis(that.toDateTime())) / millisPerDay
  );
});

/**
 * Return the first day of the month for the given LocalDate.
 *
 * **Example** (First day of month)
 *
 * ```ts
 * import { make, startOfMonth } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = make({ year: 2024, month: 6, day: 15 })
 *
 * console.log(startOfMonth(date).toISOString()) // "2024-06-01"
 * ```
 *
 * @param date - LocalDate to calculate start of month for.
 * @returns LocalDate representing the first day of the same month.
 * @category utilities
 * @since 0.0.0
 */
export const startOfMonth = (date: LocalDate.Model): LocalDate.Model =>
  LocalDate.Model.make({
    year: date.year,
    month: date.month,
    day: 1,
  });

/**
 * Return the last day of the month for the given LocalDate.
 *
 * **Example** (Last day of leap month)
 *
 * ```ts
 * import { endOfMonth, make } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = make({ year: 2024, month: 2, day: 15 })
 *
 * console.log(endOfMonth(date).toISOString()) // "2024-02-29"
 * ```
 *
 * @param date - LocalDate to calculate end of month for.
 * @returns LocalDate representing the last day of the same month.
 * @category utilities
 * @since 0.0.0
 */
export const endOfMonth = (date: LocalDate.Model): LocalDate.Model =>
  LocalDate.Model.make({
    year: date.year,
    month: date.month,
    day: daysInGregorianMonth(date.year, date.month),
  });

/**
 * Return January 1st for the year of the given LocalDate.
 *
 * **Example** (January first of year)
 *
 * ```ts
 * import { make, startOfYear } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = make({ year: 2024, month: 6, day: 15 })
 *
 * console.log(startOfYear(date).toISOString()) // "2024-01-01"
 * ```
 *
 * @param date - LocalDate to calculate start of year for.
 * @returns LocalDate representing January 1st of the given year.
 * @category utilities
 * @since 0.0.0
 */
export const startOfYear = (date: LocalDate.Model): LocalDate.Model =>
  LocalDate.Model.make({
    year: date.year,
    month: 1,
    day: 1,
  });

/**
 * Return December 31st for the year of the given LocalDate.
 *
 * **Example** (December thirty-first of year)
 *
 * ```ts
 * import { endOfYear, make } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = make({ year: 2024, month: 6, day: 15 })
 *
 * console.log(endOfYear(date).toISOString()) // "2024-12-31"
 * ```
 *
 * @param date - LocalDate to calculate end of year for.
 * @returns LocalDate representing December 31st of the given year.
 * @category utilities
 * @since 0.0.0
 */
export const endOfYear = (date: LocalDate.Model): LocalDate.Model =>
  LocalDate.Model.make({
    year: date.year,
    month: 12,
    day: 31,
  });

/**
 * Check whether a year is a leap year in the Gregorian calendar.
 *
 * **Example** (Gregorian leap year check)
 *
 * ```ts
 * import { isLeapYear } from "@beep/shared-domain/values/LocalDate"
 *
 * console.log(isLeapYear(2024)) // true
 * console.log(isLeapYear(1900)) // false
 * ```
 *
 * @param year - Gregorian calendar year to test.
 * @returns `true` when the year is a Gregorian leap year.
 * @category predicates
 * @since 0.0.0
 */
export const isLeapYear = (year: number): boolean => isGregorianLeapYear(year);

/**
 * Get the number of days in a given month.
 *
 * **Details**
 *
 * Leap years are accounted for when the month is February.
 *
 * **Example** (February days leap years)
 *
 * ```ts
 * import { daysInMonth } from "@beep/shared-domain/values/LocalDate"
 *
 * console.log(daysInMonth(2024, 2)) // 29
 * console.log(daysInMonth(2023, 2)) // 28
 * ```
 *
 * @param year - Gregorian calendar year.
 * @param month - One-based calendar month.
 * @returns Number of days in the given month.
 * @category utilities
 * @since 0.0.0
 */
export const daysInMonth: {
  (month: number): (year: number) => number;
  (year: number, month: number): number;
} = dual(2, (year: number, month: number): number => daysInGregorianMonth(year, month));

/**
 * Schema that transforms ISO 8601 date strings into LocalDate models.
 *
 * **Details**
 *
 * Decodes `YYYY-MM-DD` text to {@link Model} and encodes the model back to the
 * same canonical text format.
 *
 * **Example** (Decode and encode ISO dates)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { LocalDateFromString } from "@beep/shared-domain/values/LocalDate"
 *
 * const program = Effect.gen(function* () {
 *   const decodeLocalDate = S.decodeUnknownEffect(LocalDateFromString)
 *   const encodeLocalDate = S.encodeEffect(LocalDateFromString)
 *
 *   const date = yield* decodeLocalDate("2024-06-15")
 *   const encoded = yield* encodeLocalDate(date)
 *
 *   return encoded
 * })
 * console.log(program)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const LocalDateFromString = S.String.pipe(
  S.decodeTo(LocalDate.Model, {
    decode: SchemaGetter.transformOrFail(decodeLocalDateFromString),
    encode: SchemaGetter.transform(encodeLocalDateFromString),
  }),
  $I.annoteSchema("LocalDateFromString", {
    description: "Schema that transforms ISO 8601 local-date strings into LocalDate models.",
    documentation: "Decodes YYYY-MM-DD text to LocalDate.Model and encodes LocalDate.Model back to YYYY-MM-DD text.",
  })
);

/**
 * Type for {@link LocalDateFromString}.
 *
 * **Example** (Typed LocalDateFromString value)
 *
 * ```ts
 * import { Model, type LocalDateFromString } from "@beep/shared-domain/values/LocalDate"
 *
 * const date: LocalDateFromString = Model.make({ year: 2024, month: 6, day: 15 })
 *
 * console.log(date.toISOString()) // "2024-06-15"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LocalDateFromString = typeof LocalDateFromString.Type;

/**
 * Namespace members for {@link LocalDateFromString}.
 *
 * **Example** (Encoded string type member)
 *
 * ```ts
 * import type { LocalDateFromString } from "@beep/shared-domain/values/LocalDate"
 *
 * const encoded: LocalDateFromString.Encoded = "2024-06-15"
 *
 * console.log(encoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace LocalDateFromString {
  /**
   * Encoded string representation for {@link LocalDateFromString}.
   *
   * **Example** (Encoded ISO date string)
   *
   * ```ts
   * import type { LocalDateFromString } from "@beep/shared-domain/values/LocalDate"
   *
   * const encoded: LocalDateFromString.Encoded = "2024-06-15"
   *
   * console.log(encoded)
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof LocalDateFromString.Encoded;
}
