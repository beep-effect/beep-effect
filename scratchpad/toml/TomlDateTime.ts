/**
 * TOML's four date-time value objects: offset date-time, local date-time,
 * local date, and local time.
 *
 * **Details**
 *
 * Effect's `DateTime` module models none of the local-only variants (no
 * offset, no time zone), so all four land here as `Schema.Class` value
 * objects with Gregorian calendar validity, canonical `toString`, and
 * structural equality. This is a leaf module: it imports only `effect`. The
 * scanner constructs these classes after range-checking so diagnostics carry
 * the token offset; stringify prints `toString()`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";

const $I = $ScratchpadId.create("toml/TomlDateTime");

/** Zero-pad `value` to `width` digits (never truncates a wider value). */
function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** Whether `year` is a Gregorian leap year (div-4, except centuries unless div-400). */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** The number of days in `month` (1-12) of `year`, accounting for leap years. */
function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return MONTH_LENGTHS[month - 1] ?? 31;
}

/** Class-level filter shared by every class carrying a `{ year, month, day }` triple. */
const isRealCalendarDate = Schema.makeFilter(
  ({ year, month, day }: { readonly year: number; readonly month: number; readonly day: number }) => {
    const max = daysInMonth(year, month);
    return day <= max || `day ${day} does not exist in ${pad(year, 4)}-${pad(month, 2)} (month has ${max} days)`;
  },
  { title: "a real calendar date" }
);

const dateFields = {
  year: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 9999 })),
  month: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 12 })),
  day: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 31 })),
};

const timeFields = {
  hour: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 23 })),
  minute: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 59 })),
  // 60 tolerates the RFC 3339 leap second; TOML does not itself validate it.
  second: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 60 })),
  nanosecond: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 999_999_999 })),
};

/** `YYYY-MM-DD`. */
function formatDate(date: { readonly year: number; readonly month: number; readonly day: number }): string {
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/**
 * `HH:MM:SS[.fraction]` — the fractional part is present only when
 * `nanosecond > 0`, trimmed to the shortest exact representation.
 */
function formatTime(time: {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly nanosecond: number;
}): string {
  const base = `${pad(time.hour, 2)}:${pad(time.minute, 2)}:${pad(time.second, 2)}`;
  if (time.nanosecond === 0) {
    return base;
  }
  const fraction = pad(time.nanosecond, 9).replace(/0+$/, "");
  return `${base}.${fraction}`;
}

/** `Z` for a zero offset, else `+hh:mm` / `-hh:mm`. */
function formatOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) {
    return "Z";
  }
  const sign = offsetMinutes < 0 ? "-" : "+";
  const magnitude = Math.abs(offsetMinutes);
  const hh = Math.trunc(magnitude / 60);
  const mm = magnitude % 60;
  return `${sign}${pad(hh, 2)}:${pad(mm, 2)}`;
}

/**
 * A TOML local date: `year`-`month`-`day` with no time-of-day or offset,
 * validated against the real Gregorian calendar.
 *
 * **Example** (Format a calendar date)
 *
 * ```ts
 * import { TomlLocalDate } from "@beep/scratchpad/toml"
 *
 * const date = TomlLocalDate.make({ year: 1979, month: 5, day: 27 })
 * console.log(String(date)) // "1979-05-27"
 * ```
 *
 * @see {@link TomlLocalDateTime} to attach a local time-of-day without an offset.
 * @see {@link TomlDateTimeLiteral} for the CST wrapper that stores one of the four date-time classes.
 * @category models
 * @since 0.0.0
 */
export class TomlLocalDate extends Schema.Class<TomlLocalDate>($I`TomlLocalDate`)(
  Schema.Struct(dateFields).check(isRealCalendarDate),
  $I.annote("TomlLocalDate", {
    description: "A TOML local date with Gregorian calendar validity and no time-of-day or offset.",
  })
) {
  /** @internal */
  override toString(): string {
    return formatDate(this);
  }
}

/**
 * A TOML local time: `hour`:`minute`:`second`[.`nanosecond`] with no date or
 * offset. `second` tolerates the RFC 3339 leap second (0-60).
 *
 * **Gotchas**
 *
 * `second: 60` is admitted because RFC 3339 allows a leap second; TOML itself
 * does not validate leap seconds. `toString` omits a fractional part when
 * `nanosecond === 0` and otherwise trims trailing zeros (`500000000` prints as
 * `.5`).
 *
 * **Example** (Format a leap-second local time)
 *
 * ```ts
 * import { TomlLocalTime } from "@beep/scratchpad/toml"
 *
 * const leap = TomlLocalTime.make({ hour: 23, minute: 59, second: 60, nanosecond: 0 })
 * console.log(String(leap)) // "23:59:60"
 *
 * const fraction = TomlLocalTime.make({ hour: 7, minute: 32, second: 0, nanosecond: 500_000_000 })
 * console.log(String(fraction)) // "07:32:00.5"
 * ```
 *
 * @see {@link TomlLocalDateTime} to combine this time with a local date.
 * @see {@link TomlDateTimeLiteral} for the CST wrapper that stores one of the four date-time classes.
 * @category models
 * @since 0.0.0
 */
export class TomlLocalTime extends Schema.Class<TomlLocalTime>($I`TomlLocalTime`)(
  timeFields,
  $I.annote("TomlLocalTime", {
    description: "A TOML local time with optional nanoseconds and RFC 3339 leap-second tolerance.",
  })
) {
  /** @internal */
  override toString(): string {
    return formatTime(this);
  }
}

/**
 * A TOML local date-time: a {@link TomlLocalDate} and a {@link TomlLocalTime}
 * combined, with no offset.
 *
 * **Gotchas**
 *
 * `toString` uses `T` as the date/time separator and applies the same
 * fractional-second trimming as {@link TomlLocalTime}.
 *
 * **Example** (Format a local date-time)
 *
 * ```ts
 * import { TomlLocalDateTime } from "@beep/scratchpad/toml"
 *
 * const local = TomlLocalDateTime.make({
 *   year: 1979,
 *   month: 5,
 *   day: 27,
 *   hour: 7,
 *   minute: 32,
 *   second: 0,
 *   nanosecond: 0,
 * })
 * console.log(String(local)) // "1979-05-27T07:32:00"
 * ```
 *
 * @see {@link TomlLocalDate} for the date half and {@link TomlLocalTime} for the time half.
 * @see {@link TomlOffsetDateTime} to attach a UTC offset.
 * @see {@link TomlDateTimeLiteral} for the CST wrapper that stores one of the four date-time classes.
 * @category models
 * @since 0.0.0
 */
export class TomlLocalDateTime extends Schema.Class<TomlLocalDateTime>($I`TomlLocalDateTime`)(
  Schema.Struct({ ...dateFields, ...timeFields }).check(isRealCalendarDate),
  $I.annote("TomlLocalDateTime", {
    description: "A TOML local date-time combining a calendar date and a local time with no offset.",
  })
) {
  /** @internal */
  override toString(): string {
    return `${formatDate(this)}T${formatTime(this)}`;
  }
}

/**
 * A TOML offset date-time: a {@link TomlLocalDateTime} plus `offsetMinutes`
 * (-1439-1439). Parsing enforces `hh <= 23` / `mm <= 59` before construction;
 * this class only bounds the combined minute count.
 *
 * **Gotchas**
 *
 * Direct construction accepts `offsetMinutes: 24 * 60 - 1` (1439) even though
 * a parsed `+24:00` would have been rejected as an out-of-range `hh`. A zero
 * offset prints as `Z`, not `+00:00`.
 *
 * **Example** (Format an offset date-time including a leap second)
 *
 * ```ts
 * import { TomlOffsetDateTime } from "@beep/scratchpad/toml"
 *
 * const utc = TomlOffsetDateTime.make({
 *   year: 1979,
 *   month: 5,
 *   day: 27,
 *   hour: 7,
 *   minute: 32,
 *   second: 0,
 *   nanosecond: 0,
 *   offsetMinutes: 0,
 * })
 * console.log(String(utc)) // "1979-05-27T07:32:00Z"
 *
 * const leap = TomlOffsetDateTime.make({
 *   year: 2016,
 *   month: 12,
 *   day: 31,
 *   hour: 23,
 *   minute: 59,
 *   second: 60,
 *   nanosecond: 0,
 *   offsetMinutes: 0,
 * })
 * console.log(String(leap)) // "2016-12-31T23:59:60Z"
 * ```
 *
 * @see {@link TomlLocalDateTime} for the offset-free sibling.
 * @see {@link TomlDateTimeLiteral} for the CST wrapper that stores one of the four date-time classes.
 * @category models
 * @since 0.0.0
 */
export class TomlOffsetDateTime extends Schema.Class<TomlOffsetDateTime>($I`TomlOffsetDateTime`)(
  Schema.Struct({
    ...dateFields,
    ...timeFields,
    offsetMinutes: Schema.Int.check(Schema.isBetween({ minimum: -1439, maximum: 1439 })),
  }).check(isRealCalendarDate),
  $I.annote("TomlOffsetDateTime", {
    description: "A TOML offset date-time storing calendar fields plus a combined UTC offset in minutes.",
  })
) {
  /** @internal */
  override toString(): string {
    return `${formatDate(this)}T${formatTime(this)}${formatOffset(this.offsetMinutes)}`;
  }
}
