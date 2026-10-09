// TOML's four date-time types: an offset date-time, a local date-time, a
// local date and a local time. Effect's DateTime module models none of the
// local-only variants (no offset, no time zone), so all four land here as
// Schema.Class value objects with calendar validity, canonical `toString`
// and structural equality.
//
// Leaf module: imports only `effect`. The scanner constructs these, value
// stringify prints them, and the corpus harness compares them.

import * as S from "effect/Schema";

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
const isRealCalendarDate = S.makeFilter(
	({ year, month, day }: { readonly year: number; readonly month: number; readonly day: number }) => {
		const max = daysInMonth(year, month);
		return day <= max || `day ${day} does not exist in ${pad(year, 4)}-${pad(month, 2)} (month has ${max} days)`;
	},
	{ title: "a real calendar date" },
);

const dateFields = {
	year: S.Int.check(S.isBetween({ minimum: 0, maximum: 9999 })),
	month: S.Int.check(S.isBetween({ minimum: 1, maximum: 12 })),
	day: S.Int.check(S.isBetween({ minimum: 1, maximum: 31 })),
};

const timeFields = {
	hour: S.Int.check(S.isBetween({ minimum: 0, maximum: 23 })),
	minute: S.Int.check(S.isBetween({ minimum: 0, maximum: 59 })),
	// 60 tolerates the RFC 3339 leap second; TOML does not itself validate it.
	second: S.Int.check(S.isBetween({ minimum: 0, maximum: 60 })),
	nanosecond: S.Int.check(S.isBetween({ minimum: 0, maximum: 999_999_999 })),
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
 * @public
 */
export class TomlLocalDate extends S.Class<TomlLocalDate>("TomlLocalDate")(
	S.Struct(dateFields).check(isRealCalendarDate),
) {
	override toString(): string {
		return formatDate(this);
	}
}

/**
 * A TOML local time: `hour`:`minute`:`second`[.`nanosecond`] with no date or
 * offset. `second` tolerates the RFC 3339 leap second (0-60).
 *
 * @public
 */
export class TomlLocalTime extends S.Class<TomlLocalTime>("TomlLocalTime")(timeFields) {
	override toString(): string {
		return formatTime(this);
	}
}

/**
 * A TOML local date-time: a {@link TomlLocalDate} and a {@link TomlLocalTime}
 * combined, with no offset.
 *
 * @public
 */
export class TomlLocalDateTime extends S.Class<TomlLocalDateTime>("TomlLocalDateTime")(
	S.Struct({ ...dateFields, ...timeFields }).check(isRealCalendarDate),
) {
	override toString(): string {
		return `${formatDate(this)}T${formatTime(this)}`;
	}
}

/**
 * A TOML offset date-time: a {@link TomlLocalDateTime} plus `offsetMinutes`
 * (-1439-1439). Parsing enforces `hh <= 23` / `mm <= 59` before construction;
 * this class only bounds the combined minute count.
 *
 * @public
 */
export class TomlOffsetDateTime extends S.Class<TomlOffsetDateTime>("TomlOffsetDateTime")(
	S.Struct({
		...dateFields,
		...timeFields,
		offsetMinutes: S.Int.check(S.isBetween({ minimum: -1439, maximum: 1439 })),
	}).check(isRealCalendarDate),
) {
	override toString(): string {
		return `${formatDate(this)}T${formatTime(this)}${formatOffset(this.offsetMinutes)}`;
	}
}
