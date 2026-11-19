/**
 * Dates as a workbook holds them: a serial number of days in one of two date systems, and the calendar fields a
 * sheet shows for it. A date cell keeps its serial, since a workbook date has no time zone and one serial names a
 * day no calendar has.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XlsxId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { DAYS_1904, partsOf, serialOf } from "./internal/serial.ts";

const $I = $XlsxId.create("XlsxSerial");

/**
 * Which day a workbook counts from: 1900 (serial 1 is 1 January 1900, and serial 60 is 29 February 1900, a day that
 * never was) or 1904 (serial 0 is 1 January 1904).
 *
 * **Example** (One serial in both systems)
 *
 * ```ts import.meta.vitest name="One serial in both systems"
 * import { XlsxCalendar, XlsxDateSystem } from "@beep/xlsx"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxDateSystem)("1904") // => true
 * O.map(XlsxCalendar.fromSerial(1, "1900"), (calendar) => calendar.year) // => O.some(1900)
 * O.map(XlsxCalendar.fromSerial(1, "1904"), (calendar) => calendar.year) // => O.some(1904)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxDateSystem = LiteralKit(["1900", "1904"]).pipe(
  $I.annoteSchema("XlsxDateSystem", { description: "The day a workbook's date serials count from" })
);

/**
 * The year a workbook's date serials count from, `"1900"` or `"1904"`; the type {@link XlsxDateSystem} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxDateSystem = typeof XlsxDateSystem.Type;

/**
 * The last moment Excel shows in the 1900 system: 23:59:59 on 31 December 9999, as a workbook stores it, to 15
 * significant digits. A 1904 workbook reaches the same moment 1,462 days sooner; {@link maxSerial} gives the bound
 * of either system.
 *
 * **Details**
 *
 * The bound is the last whole second: a fraction of a second later on that day is past it, as Excel's own last
 * date-time, 9999-12-31 23:59:59, is.
 *
 * **Example** (The last moment Excel shows)
 *
 * ```ts import.meta.vitest name="The last moment Excel shows"
 * import { MAX_SERIAL, XlsxCalendar } from "@beep/xlsx"
 * import * as O from "effect/Option"
 *
 * const last = O.getOrThrow(XlsxCalendar.fromSerial(MAX_SERIAL, "1900"))
 * ;[last.year, last.month, last.day, last.hour, last.minute, last.second] // => [9999, 12, 31, 23, 59, 59]
 * O.isNone(XlsxCalendar.fromSerial(MAX_SERIAL, "1904")) // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_SERIAL = 2_958_465.999_988_43;

/**
 * The last serial a date system shows: {@link MAX_SERIAL} in the 1900 system, 1,462 days less in the 1904 system,
 * whose serials count from 1 January 1904.
 *
 * **Example** (The last date of each system)
 *
 * ```ts import.meta.vitest name="The last date of each system"
 * import { maxSerial, MAX_SERIAL } from "@beep/xlsx"
 *
 * maxSerial("1900") === MAX_SERIAL // => true
 * maxSerial("1904") // => 2957003.99998843
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const maxSerial = (system: XlsxDateSystem): number => (system === "1904" ? MAX_SERIAL - DAYS_1904 : MAX_SERIAL);

/**
 * A date or time as a count of days, the time of day its fraction.
 *
 * **Example** (Serials in range)
 *
 * ```ts import.meta.vitest name="Serials in range"
 * import { XlsxSerial } from "@beep/xlsx"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxSerial)(45_292.5) // => true
 * S.is(XlsxSerial)(-1) // => false
 * S.is(XlsxSerial)(3_000_000) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxSerial = S.Finite.check(S.isBetween({ minimum: 0, maximum: MAX_SERIAL })).pipe(
  $I.annoteSchema("XlsxSerial", { description: "A date or time as a count of days; the fraction is the time of day" })
);

/**
 * A date or time as a count of days from the workbook's starting day; the type {@link XlsxSerial} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxSerial = typeof XlsxSerial.Type;

const field = (minimum: number, maximum: number, description: string) =>
  S.Int.check(S.isBetween({ minimum, maximum })).pipe(S.annotateKey({ description }));

/**
 * What a serial means on the sheet's calendar. It is not a `DateTime`: serial 60 in the 1900 system is 29 February
 * 1900 and serial 0 is "January 0", days Excel shows and no calendar has.
 *
 * **Example** (The day that never was)
 *
 * ```ts import.meta.vitest name="The day that never was"
 * import { XlsxCalendar } from "@beep/xlsx"
 * import * as O from "effect/Option"
 *
 * const leap = XlsxCalendar.fromSerial(60, "1900")
 * O.map(leap, (calendar) => [calendar.month, calendar.day]) // => O.some([2, 29])
 * O.map(XlsxCalendar.fromSerial(61, "1900"), (calendar) => calendar.day) // => O.some(1)
 * O.isNone(XlsxCalendar.toDateTime(60, "1900")) // => true
 * const noon = XlsxCalendar.make({ year: 2024, month: 1, day: 1, hour: 12, minute: 0, second: 0 })
 * XlsxCalendar.toSerial(noon, "1900") // => O.some(45292.5)
 * O.isNone(XlsxCalendar.makeOption({ year: 2024, month: 1, day: 1, hour: 25, minute: 0, second: 0 })) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxCalendar extends S.Opaque<XlsxCalendar, { readonly brand: unique symbol }>()(
  S.Struct({
    year: field(1900, 9999, "The year the sheet shows"),
    month: field(1, 12, "The month, from 1"),
    day: field(0, 31, "The day of the month; 0 only for serial 0 of the 1900 system"),
    hour: field(0, 23, "The hour, from 0"),
    minute: field(0, 59, "The minute"),
    second: field(0, 59, "The whole second"),
  }).pipe($I.annoteSchema("XlsxCalendar", { description: "The calendar fields a sheet shows for a serial" }))
) {
  /**
   * The calendar fields of a serial in a date system, when the system shows that serial: none past
   * {@link maxSerial} of the system, which a 1904 serial reaches 1,462 days before a 1900 one.
   */
  static readonly fromSerial = (serial: XlsxSerial, system: XlsxDateSystem): O.Option<XlsxCalendar> => {
    const parts = partsOf(serial, system);
    return XlsxCalendar.makeOption({
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    });
  };

  /** The serial of calendar fields in a date system, when the sheet's calendar has that moment. */
  static readonly toSerial = (calendar: XlsxCalendar, system: XlsxDateSystem): O.Option<XlsxSerial> =>
    O.filter(serialOf(calendar, system), (serial) => serial <= maxSerial(system));

  /**
   * The moment a serial names, read as UTC, when a real calendar has it: none for serial 60 and for serials below 1
   * in the 1900 system, and none past the last serial of the system.
   */
  static readonly toDateTime = (serial: XlsxSerial, system: XlsxDateSystem): O.Option<DateTime.Utc> =>
    O.flatMap(
      O.filter(
        XlsxCalendar.fromSerial(serial, system),
        (parts) => parts.day !== 0 && !(parts.year === 1900 && parts.month === 2 && parts.day === 29)
      ),
      (parts) =>
        DateTime.make({
          year: parts.year,
          month: parts.month,
          day: parts.day,
          hours: parts.hour,
          minutes: parts.minute,
          seconds: parts.second,
        })
    );
}
