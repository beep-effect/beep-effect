/**
 * LocalDate - Date without timezone value object
 *
 * Represents a calendar date (year, month, day) without time or timezone information.
 * Uses Effect's DateTime.Utc internally but only represents the date portion.
 * Encodes to/from ISO 8601 date strings (YYYY-MM-DD format).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import { Str } from "@beep/utils";
import {
  DateTime,
  Duration,
  Effect,
  Equal,
  flow,
  Hash,
  Match,
  Order as Order_,
  pipe,
  SchemaGetter,
  SchemaIssue,
} from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import type * as Ordering from "effect/Ordering";
import type * as AST from "effect/SchemaAST";

const $I = $SchemaId.create("LocalDate");

/**
 * Schema class representing a calendar date without time or timezone.
 *
 * **Details**
 *
 * Stores year (1-9999), month (1-12), and day (1-31) as integers.
 *
 * **Example** (Make and convert LocalDate)
 *
 * ```ts
 * import { LocalDate } from "@beep/schema/LocalDate"
 *
 * const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
 *
 * console.log(date.toISOString()) // "2024-06-15"
 * console.log(date.toDateTime())
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export class LocalDate extends S.Class<LocalDate>($I`LocalDate`)(
  {
    year: S.Int.check(S.makeFilterGroup([S.isGreaterThanOrEqualTo(1), S.isLessThanOrEqualTo(9999)])),
    month: S.Int.check(S.makeFilterGroup([S.isGreaterThanOrEqualTo(1), S.isLessThanOrEqualTo(12)])),
    day: S.Int.check(S.makeFilterGroup([S.isGreaterThanOrEqualTo(1), S.isLessThanOrEqualTo(31)])),
  },
  $I.annote("LocalDate", {
    description: "LocalDate - A S.Class representing a calendar date without time",
    documentation:
      "Stores year, month (1-12), and day (1-31) as numbers.\nEncoded as ISO 8601 date string (YYYY-MM-DD).",
  })
) {
  static readonly is = S.is(LocalDate);
  static readonly decodeEffect: {
    (input: unknown, options?: AST.ParseOptions): Effect.Effect<LocalDate, S.SchemaError>;
    (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<LocalDate, S.SchemaError>;
  } = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(LocalDate));

  /**
   * Format as ISO 8601 date string (YYYY-MM-DD)
   *
   * @returns * @since 0.0.0
   * @category utilities
   */
  toISOString(): string {
    const y = Str.padStart(4, "0")(this.year.toString());
    const m = Str.padStart(2, "0")(this.month.toString());
    const d = Str.padStart(2, "0")(this.day.toString());
    return `${y}-${m}-${d}`;
  }

  /**
   * Convert to string representation
   * @returns * @since 0.0.0
   * @category utilities
   */
  override readonly toString = (): string => this.toISOString();

  /**
   * Value equality for LocalDate instances.
   */
  [Equal.symbol](that: Equal.Equal): boolean {
    return localDateEquals(this, that);
  }

  /**
   * Stable hash based on the ISO date representation.
   */
  [Hash.symbol](): number {
    return localDateHash(this);
  }

  /**
   * Convert to Effect DateTime.Utc at midnight UTC
   * @returns * @since 0.0.0
   * @category utilities
   */
  toDateTime(): DateTime.Utc {
    return localDateToDateTime(this);
  }

  /**
   * Convert to JavaScript Date at midnight UTC
   * @returns * @since 0.0.0
   * @category utilities
   */
  readonly toDate = (): Date => localDateToDate(this);
}

/**
 * Type guard for `LocalDate` instances.
 *
 * **Example** (Check LocalDate type guard)
 *
 * ```ts
 * import { LocalDate, isLocalDate } from "@beep/schema/LocalDate"
 *
 * const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
 * console.log(isLocalDate(date))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isLocalDate = LocalDate.is;

const localDateEquals = (self: LocalDate, that: Equal.Equal): boolean =>
  LocalDate.is(that) && self.year === that.year && self.month === that.month && self.day === that.day;

const localDateHash = (self: LocalDate): number => Hash.string(self.toISOString());

const localDateToDateTime = (self: LocalDate): DateTime.Utc =>
  DateTime.makeUnsafe({
    year: self.year,
    month: self.month,
    day: self.day,
  });

const localDateToDate = (self: LocalDate): Date => DateTime.toDateUtc(localDateToDateTime(self));

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isLeapYearInternal = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const daysInNonFebruaryMonth: (month: number) => number = Match.type<number>().pipe(
  Match.whenOr(4, 6, 9, 11, () => 30),
  Match.orElse(() => 31)
);

const getDaysInMonth = (year: number, month: number): number =>
  month === 2 ? (isLeapYearInternal(year) ? 29 : 28) : daysInNonFebruaryMonth(month);

const isValidCalendarDate = ({ year, month, day }: { year: number; month: number; day: number }): boolean =>
  month >= 1 && month <= 12 && day >= 1 && day <= getDaysInMonth(year, month);

const decodeLocalDateFromString: (
  dateString: string,
  options: AST.ParseOptions
) => Effect.Effect<LocalDate, SchemaIssue.Issue> = Effect.fn("LocalDateFromString.decode")(function* (
  dateString: string,
  _options: AST.ParseOptions
) {
  const match = Str.match(ISO_DATE_PATTERN)(dateString);
  if (O.isNone(match)) {
    return yield* Effect.fail(new SchemaIssue.InvalidValue());
  }
  const [, yearStr, monthStr, dayStr] = match.value;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  if (year < 1 || year > 9999) {
    return yield* Effect.fail(new SchemaIssue.InvalidType(S.String.ast));
  }

  // Validate month range
  if (month < 1 || month > 12) {
    return yield* Effect.fail(new SchemaIssue.InvalidType(S.String.ast));
  }

  // Validate day range for the given month
  const maxDays = daysInMonth(year, month);
  if (day < 1 || day > maxDays) {
    return yield* Effect.fail(new SchemaIssue.InvalidType(S.String.ast));
  }

  return LocalDate.make({
    year,
    month,
    day,
  });
});

const encodeLocalDateFromString = (localDate: {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}) => {
  // Format as ISO 8601 date string (YYYY-MM-DD)
  const y = Str.padStart(4, "0")(String(localDate.year));
  const m = Str.padStart(2, "0")(String(localDate.month));
  const d = Str.padStart(2, "0")(String(localDate.day));
  return `${y}-${m}-${d}`;
};

/**
 * Parse a `YYYY-MM-DD` string into a `LocalDate`, returning an `Effect` that fails for invalid input.
 *
 * **Example** (Parse ISO date string)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { fromString } from "@beep/schema/LocalDate"
 *
 * const program = fromString("2024-06-15")
 * const date = await Effect.runPromise(program)
 * console.log(date.toISOString())
 * ```
 *
 * @effects Parses an ISO local date string and fails with `SchemaError` when the input is not a valid calendar date.
 * @category constructors
 * @since 0.0.0
 */
export const fromString = (dateString: string): Effect.Effect<LocalDate, S.SchemaError> =>
  O.match(Str.match(ISO_DATE_PATTERN)(dateString), {
    onNone: () =>
      Effect.fail(
        new S.SchemaError(
          new SchemaIssue.InvalidValue({ message: "Expected an ISO 8601 local date in YYYY-MM-DD format" })
        )
      ),
    onSome: ([, yearString, monthString, dayString]) => {
      const parts = {
        year: Number.parseInt(yearString, 10),
        month: Number.parseInt(monthString, 10),
        day: Number.parseInt(dayString, 10),
      };

      return isValidCalendarDate(parts)
        ? LocalDate.decodeEffect(parts)
        : Effect.fail(new S.SchemaError(new SchemaIssue.InvalidValue({ message: "Invalid calendar date" })));
    },
  });

/**
 * Create a `LocalDate` from a JavaScript `Date` using its UTC components.
 *
 * **Example** (Create from JavaScript Date)
 *
 * ```ts
 * import { fromDate } from "@beep/schema/LocalDate"
 *
 * const date = fromDate(new Date("2024-06-15T10:30:00Z"))
 * console.log(date.toISOString())
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromDate: (date: Date) => LocalDate = flow(DateTime.fromDateUnsafe, DateTime.toPartsUtc, (parts) =>
  LocalDate.make({
    year: parts.year,
    month: parts.month,
    day: parts.day,
  })
);

/**
 * Get today's date in UTC.
 *
 * **Example** (Get today's UTC date)
 *
 * ```ts
 * import { today } from "@beep/schema/LocalDate"
 *
 * const date = today()
 * console.log(date.year > 0)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const today = (): LocalDate => DateTime.nowUnsafe().pipe(DateTime.toDate, fromDate);

/**
 * Get today's UTC date as an `Effect` using the Clock service, testable with `TestClock`.
 *
 * **Example** (Get today via Effect)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { todayEffect } from "@beep/schema/LocalDate"
 *
 * const date = await Effect.runPromise(todayEffect)
 * console.log(date.year > 0)
 * ```
 *
 * @effects Reads the Effect Clock service and returns the current UTC calendar date.
 * @category constructors
 * @since 0.0.0
 */
export const todayEffect = pipe(
  Effect.clockWith((clock) => clock.currentTimeMillis),
  Effect.map((millis) => DateTime.makeUnsafe(Number(millis)).pipe(DateTime.toDate, fromDate))
);

/**
 * Create a `LocalDate` from a `DateTime` by extracting its UTC date components.
 *
 * **Example** (Create from DateTime)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { fromDateTime } from "@beep/schema/LocalDate"
 *
 * const date = fromDateTime(DateTime.makeUnsafe("2024-06-15T10:30:00Z"))
 * console.log(date.toISOString())
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromDateTime = (dateTime: DateTime.DateTime): LocalDate => {
  const parts = DateTime.toPartsUtc(dateTime);
  return LocalDate.make({
    year: parts.year,
    month: parts.month,
    day: parts.day,
  });
};

/**
 * Chronological `Order` for `LocalDate` values.
 *
 * **Example** (Compare dates chronologically)
 *
 * ```ts
 * import { LocalDate, Order } from "@beep/schema/LocalDate"
 *
 * const earlier = LocalDate.make({ year: 2024, month: 1, day: 1 })
 * const later = LocalDate.make({ year: 2024, month: 1, day: 2 })
 * console.log(Order(earlier, later))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const Order: {
  (that: LocalDate): (self: LocalDate) => Ordering.Ordering;
  (self: LocalDate, that: LocalDate): Ordering.Ordering;
} = dual(
  2,
  Order_.make<LocalDate>((a, b) => {
    if (a.year !== b.year) {
      return a.year < b.year ? -1 : 1;
    }
    if (a.month !== b.month) {
      return a.month < b.month ? -1 : 1;
    }
    if (a.day !== b.day) {
      return a.day < b.day ? -1 : 1;
    }
    return 0;
  })
);

/**
 * Dual predicate returning `true` when `self` is chronologically before `that`.
 *
 * **Example** (Check if date is before)
 *
 * ```ts
 * import { LocalDate, isBefore } from "@beep/schema/LocalDate"
 *
 * const earlier = LocalDate.make({ year: 2024, month: 1, day: 1 })
 * const later = LocalDate.make({ year: 2024, month: 1, day: 2 })
 * console.log(isBefore(earlier, later))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isBefore: {
  (that: LocalDate): (self: LocalDate) => boolean;
  (self: LocalDate, that: LocalDate): boolean;
} = dual(2, (self: LocalDate, that: LocalDate): boolean => Order(self, that) === -1);

/**
 * Dual predicate returning `true` when `self` is chronologically after `that`.
 *
 * **Example** (Check if date is after)
 *
 * ```ts
 * import { LocalDate, isAfter } from "@beep/schema/LocalDate"
 *
 * const earlier = LocalDate.make({ year: 2024, month: 1, day: 1 })
 * const later = LocalDate.make({ year: 2024, month: 1, day: 2 })
 * console.log(isAfter(later, earlier))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isAfter: {
  (that: LocalDate): (self: LocalDate) => boolean;
  (self: LocalDate, that: LocalDate): boolean;
} = dual(2, (self: LocalDate, that: LocalDate): boolean => Order(self, that) === 1);

/**
 * Dual predicate returning `true` when two `LocalDate` values represent the same calendar date.
 *
 * **Example** (Check date equality)
 *
 * ```ts
 * import { LocalDate, equals } from "@beep/schema/LocalDate"
 *
 * const a = LocalDate.make({ year: 2024, month: 6, day: 15 })
 * const b = LocalDate.make({ year: 2024, month: 6, day: 15 })
 * console.log(equals(a, b))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const equals: {
  (that: LocalDate): (self: LocalDate) => boolean;
  (self: LocalDate, that: LocalDate): boolean;
} = dual(2, S.toEquivalence(LocalDate));

/**
 * Add days to a `LocalDate`.
 *
 * **Example** (Add days to date)
 *
 * ```ts
 * import { LocalDate, addDays } from "@beep/schema/LocalDate"
 *
 * const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
 * console.log(addDays(date, 1).toISOString())
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const addDays: {
  (days: number): (self: LocalDate) => LocalDate;
  (self: LocalDate, days: number): LocalDate;
} = dual(
  2,
  (self: LocalDate, days: number): LocalDate =>
    pipe(self.toDate(), DateTime.fromDateUnsafe, DateTime.toUtc, DateTime.add({ days }), DateTime.toDate, fromDate)
);

/**
 * Add months to a `LocalDate`.
 *
 * **Example** (Add months to date)
 *
 * ```ts
 * import { LocalDate, addMonths } from "@beep/schema/LocalDate"
 *
 * const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
 * console.log(addMonths(date, 1).toISOString())
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const addMonths: {
  (months: number): (self: LocalDate) => LocalDate;
  (self: LocalDate, months: number): LocalDate;
} = dual(
  2,
  (self: LocalDate, months: number): LocalDate =>
    pipe(self.toDate(), DateTime.fromDateUnsafe, DateTime.toUtc, DateTime.add({ months }), DateTime.toDate, fromDate)
);

/**
 * Add years to a `LocalDate`.
 *
 * **Example** (Add years to date)
 *
 * ```ts
 * import { LocalDate, addYears } from "@beep/schema/LocalDate"
 *
 * const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
 * console.log(addYears(date, 1).toISOString())
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const addYears: {
  (years: number): (self: LocalDate) => LocalDate;
  (self: LocalDate, years: number): LocalDate;
} = dual(
  2,
  (self: LocalDate, years: number): LocalDate =>
    pipe(self.toDate(), DateTime.fromDateUnsafe, DateTime.toUtc, DateTime.add({ years }), DateTime.toDate, fromDate)
);

/**
 * Get the difference in whole days between two `LocalDate` values.
 *
 * **Example** (Difference in whole days)
 *
 * ```ts
 * import { LocalDate, diffInDays } from "@beep/schema/LocalDate"
 *
 * const earlier = LocalDate.make({ year: 2024, month: 6, day: 15 })
 * const later = LocalDate.make({ year: 2024, month: 6, day: 18 })
 * console.log(diffInDays(later, earlier))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const diffInDays: {
  (that: LocalDate): (self: LocalDate) => number;
  (self: LocalDate, that: LocalDate): number;
} = dual(2, (self: LocalDate, that: LocalDate): number => {
  const msPerDay = Duration.days(1).pipe(Duration.toMillis);
  const dateA = self.toDate();
  const dateB = that.toDate();
  return Math.round((dateA.getTime() - dateB.getTime()) / msPerDay);
});

/**
 * Return the first day of the month for the given `LocalDate`.
 *
 * **Example** (Get first day of month)
 *
 * ```ts
 * import { LocalDate, startOfMonth } from "@beep/schema/LocalDate"
 *
 * const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
 * console.log(startOfMonth(date).toISOString())
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const startOfMonth = (date: LocalDate): LocalDate =>
  LocalDate.make({
    year: date.year,
    month: date.month,
    day: 1,
  });

/**
 * Return the last day of the month for the given `LocalDate`.
 *
 * **Example** (Get last day of month)
 *
 * ```ts
 * import { LocalDate, endOfMonth } from "@beep/schema/LocalDate"
 *
 * const date = LocalDate.make({ year: 2024, month: 2, day: 15 })
 * console.log(endOfMonth(date).toISOString())
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const endOfMonth = (date: LocalDate): LocalDate =>
  LocalDate.make({
    year: date.year,
    month: date.month,
    day: getDaysInMonth(date.year, date.month),
  });

/**
 * Return January 1st for the year of the given `LocalDate`.
 *
 * **Example** (Get first day of year)
 *
 * ```ts
 * import { LocalDate, startOfYear } from "@beep/schema/LocalDate"
 *
 * const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
 * console.log(startOfYear(date).toISOString())
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const startOfYear = (date: LocalDate): LocalDate =>
  LocalDate.make({
    year: date.year,
    month: 1,
    day: 1,
  });

/**
 * Return December 31st for the year of the given `LocalDate`.
 *
 * **Example** (Get last day of year)
 *
 * ```ts
 * import { LocalDate, endOfYear } from "@beep/schema/LocalDate"
 *
 * const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
 * console.log(endOfYear(date).toISOString())
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const endOfYear = (date: LocalDate): LocalDate =>
  LocalDate.make({
    year: date.year,
    month: 12,
    day: 31,
  });

/**
 * Check whether a year is a leap year.
 *
 * **Example** (Check leap year)
 *
 * ```ts
 * import { isLeapYear } from "@beep/schema/LocalDate"
 *
 * console.log(isLeapYear(2024))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isLeapYear = (year: number): boolean => isLeapYearInternal(year);

/**
 * Get the number of days in a given month, accounting for leap years.
 *
 * **Example** (Days in month with leap)
 *
 * ```ts
 * import { daysInMonth } from "@beep/schema/LocalDate"
 *
 * console.log(daysInMonth(2024, 2))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const daysInMonth: {
  (month: number): (year: number) => number;
  (year: number, month: number): number;
} = dual(2, (year: number, month: number): number => getDaysInMonth(year, month));

/**
 * Schema that transforms ISO 8601 date strings (`YYYY-MM-DD`) into `LocalDate` instances.
 *
 * **Details**
 *
 * This schema can be used directly in API URL params, request bodies, and database columns
 * to automatically parse date strings into LocalDate instances.
 *
 * **Example** (Decode and encode date strings)
 *
 * ```ts import.meta.vitest name="Decode and encode date strings"
 * import * as S from "effect/Schema";
 * import { LocalDateFromString } from "@beep/schema/LocalDate";
 *
 * const decodeLocalDate = S.decodeUnknownSync(LocalDateFromString);
 * const encodeLocalDate = S.encodeSync(LocalDateFromString);
 *
 * const date = decodeLocalDate("2024-06-15");
 * const str = encodeLocalDate(date);
 *
 * str // => "2024-06-15"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */

export const LocalDateFromString = S.String.pipe(
  S.decodeTo(LocalDate, {
    decode: SchemaGetter.transformOrFail(decodeLocalDateFromString),
    encode: SchemaGetter.transform(encodeLocalDateFromString),
  }),
  $I.annoteSchema("LocalDateFromString", {
    description: "LocalDateFromString - Schema that transforms ISO date strings (YYYY-MM-DD) to LocalDate",
    documentation:
      "This schema can be used directly in API URL params, request bodies, and database columns\nto automatically parse date strings into LocalDate instances.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Decoded `LocalDate` type extracted from {@link LocalDateFromString}.
 *
 * **Example** (Type decoded LocalDate value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LocalDateFromString } from "@beep/schema/LocalDate"
 *
 * const date: LocalDateFromString = S.decodeUnknownSync(LocalDateFromString)("2024-06-15")
 * console.log(date.year)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LocalDateFromString = typeof LocalDateFromString.Type;

/**
 * Namespace members for {@link LocalDateFromString}.
 *
 * **Example** (Encode LocalDate to string)
 *
 * ```ts import.meta.vitest name="Encode LocalDate to string"
 * import * as S from "effect/Schema"
 * import { LocalDateFromString } from "@beep/schema/LocalDate"
 *
 * const date = S.decodeUnknownSync(LocalDateFromString)("2024-06-15")
 * const encoded: LocalDateFromString.Encoded = S.encodeSync(LocalDateFromString)(date)
 * encoded // => "2024-06-15"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace LocalDateFromString {
  /**
   * Encoded string representation (`YYYY-MM-DD`) of a {@link LocalDateFromString}.
   *
   * @since 0.0.0
   * @category models
   */
  export type Encoded = typeof LocalDateFromString.Encoded;
}
