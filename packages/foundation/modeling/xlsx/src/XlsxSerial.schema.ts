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
import { partsOf, serialOf } from "./internal/serial.ts";

const $I = $XlsxId.create("XlsxSerial");

/**
 * Which day a workbook counts from: 1900 (serial 1 is 1 January 1900, and serial 60 is 29 February 1900, a day that
 * never was) or 1904 (serial 0 is 1 January 1904).
 *
 * **Example** (One serial in both systems)
 *
 * ```ts
 * import { XlsxCalendar, XlsxDateSystem } from "@beep/xlsx"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxDateSystem)("1904") // => true
 * XlsxCalendar.fromSerial(1, "1900").year // => 1900
 * XlsxCalendar.fromSerial(1, "1904").year // => 1904
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
 * The last moment Excel shows: the end of 31 December 9999.
 *
 * **Example** (The last day Excel shows)
 *
 * ```ts
 * import { MAX_SERIAL, XlsxCalendar } from "@beep/xlsx"
 *
 * XlsxCalendar.fromSerial(MAX_SERIAL, "1900").year // => 9999
 * XlsxCalendar.fromSerial(MAX_SERIAL, "1900").day // => 31
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_SERIAL = 2_958_465.999;

/**
 * A date or time as a count of days, the time of day its fraction.
 *
 * **Example** (Serials in range)
 *
 * ```ts
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
 * ```ts
 * import { XlsxCalendar } from "@beep/xlsx"
 * import * as O from "effect/Option"
 *
 * const leap = XlsxCalendar.fromSerial(60, "1900")
 * leap.month // => 2
 * leap.day // => 29
 * XlsxCalendar.fromSerial(61, "1900").day // => 1
 * O.isNone(XlsxCalendar.toDateTime(60, "1900")) // => true
 * XlsxCalendar.toSerial({ year: 2024, month: 1, day: 1, hour: 12, minute: 0, second: 0 }, "1900") // => O.some(45292.5)
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
  /** The calendar fields of a serial in a date system. */
  static readonly fromSerial = (serial: XlsxSerial, system: XlsxDateSystem): XlsxCalendar => {
    const parts = partsOf({ serial, date1904: system === "1904" });
    return XlsxCalendar.make({
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    });
  };

  /** The serial of calendar fields in a date system, when the sheet's calendar has that moment. */
  static readonly toSerial = (
    calendar: Pick<XlsxCalendar, "year" | "month" | "day" | "hour" | "minute" | "second">,
    system: XlsxDateSystem
  ): O.Option<XlsxSerial> =>
    O.filter(serialOf({ parts: calendar, date1904: system === "1904" }), (serial) => serial <= MAX_SERIAL);

  /**
   * The moment a serial names, read as UTC, when a real calendar has it: none for serial 60 and for serials below 1
   * in the 1900 system.
   */
  static readonly toDateTime = (serial: XlsxSerial, system: XlsxDateSystem): O.Option<DateTime.Utc> => {
    const parts = partsOf({ serial, date1904: system === "1904" });
    if (parts.day === 0 || (parts.year === 1900 && parts.month === 2 && parts.day === 29)) return O.none();
    return DateTime.make({
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hours: parts.hour,
      minutes: parts.minute,
      seconds: parts.second,
    });
  };
}
