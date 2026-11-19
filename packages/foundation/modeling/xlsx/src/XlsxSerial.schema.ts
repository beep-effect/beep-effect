/**
 * Dates as a workbook holds them: a serial number of days in one of two date systems, and the calendar fields a
 * sheet shows for it. A date cell keeps its serial, since a workbook date has no time zone and one serial names a
 * day no calendar has.
 *
 * @packageDocumentation
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
 * @category schemas
 */
export const XlsxDateSystem = LiteralKit(["1900", "1904"]).pipe(
  $I.annoteSchema("XlsxDateSystem", { description: "The day a workbook's date serials count from" })
);

/**
 * Runtime type of {@link XlsxDateSystem}.
 *
 * @category models
 */
export type XlsxDateSystem = typeof XlsxDateSystem.Type;

/**
 * The last moment Excel shows: the end of 31 December 9999.
 *
 * @category constants
 */
export const MAX_SERIAL = 2_958_465.999;

/**
 * A date or time as a count of days, the time of day its fraction.
 *
 * @category schemas
 */
export const XlsxSerial = S.Finite.check(S.isBetween({ minimum: 0, maximum: MAX_SERIAL })).pipe(
  $I.annoteSchema("XlsxSerial", { description: "A date or time as a count of days; the fraction is the time of day" })
);

/**
 * Runtime type of {@link XlsxSerial}.
 *
 * @category models
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
 * import { XlsxCalendar } from "@beep/xlsx/XlsxSerial"
 *
 * XlsxCalendar.fromSerial(60, "1900") // => { year: 1900, month: 2, day: 29, hour: 0, minute: 0, second: 0 }
 * XlsxCalendar.fromSerial(61, "1900").day // => 1
 * ```
 *
 * @category models
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
