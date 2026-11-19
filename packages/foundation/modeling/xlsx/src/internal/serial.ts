// The arithmetic between a date serial and the calendar a sheet shows for it (ECMA-376 part 1, 18.17.4.1).
// The 1900 system counts 1 as 1 January 1900 and keeps 29 February 1900, a day that never was, as serial 60, so
// every later serial is one more than the true day count. The 1904 system counts 0 as 1 January 1904 and has no
// such day. Serial 0 in the 1900 system is shown as "January 0, 1900". Nothing here has a time zone.
import { $XlsxId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $XlsxId.create("internal/serial");

const field = (description: string) => S.Int.pipe(S.annotateKey({ description }));

/** What a serial means on the sheet's calendar, with what rendering needs beside the six calendar fields. */
export class SerialParts extends S.Opaque<SerialParts, { readonly brand: unique symbol }>()(
  S.Struct({
    day: field("The day of the month; 0 only for serial 0 of the 1900 system"),
    days: field("The serial's whole days as written, after a carry from a time that rounds up to midnight"),
    fraction: S.Finite.pipe(S.annotateKey({ description: "The part of a second left over, 0 under a millionth" })),
    hour: field("The hour, from 0"),
    minute: field("The minute"),
    month: field("The month, from 1"),
    second: field("The whole second"),
    weekday: field(
      "0 for Sunday to 6 for Saturday, as Excel shows it (its 1900 weekdays before March are a day early)"
    ),
    year: field("The year the sheet shows"),
  }).pipe($I.annoteSchema("SerialParts", { description: "A serial's calendar fields, with what rendering needs" }))
) {}

/** Days from 1970-01-01 to a civil date (proleptic Gregorian). */
const daysFromCivil = (year: number, month: number, day: number): number => {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
};

/** The civil date a count of days from 1970-01-01 is. */
const civilFromDays = (days: number): readonly [year: number, month: number, day: number] => {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return [month <= 2 ? yoe + era * 400 + 1 : yoe + era * 400, month, day];
};

const EPOCH_1900 = daysFromCivil(1900, 1, 1);

/** The gap between the two date systems, in 1900-system serials. */
export const DAYS_1904 = 1462;

/** A serial cut to the 15 significant digits a workbook stores, so 0.6041666666666666 is 14:30 and not 14:29:59. */
const cut = (serial: number): number => {
  const text = serial.toPrecision(16);
  return Str.includes("e")(text) || !Str.includes(".")(text) ? serial : Number(Str.slice(0, -1)(text));
};

/** The calendar fields of a serial in a date system. `serial` is 0 or more. */
export const partsOf = (input: { readonly serial: number; readonly date1904: boolean }): SerialParts => {
  const { date1904 } = input;
  const value = cut(input.serial);
  let days = Math.trunc(value);
  let seconds = Math.floor(86_400 * (value - days));
  let fraction = 86_400 * (value - days) - seconds;
  if (Math.abs(fraction) < 1e-6) fraction = 0;
  if (fraction > 0.9999) {
    fraction = 0;
    seconds += 1;
    if (seconds === 86_400) {
      seconds = 0;
      days += 1;
    }
  }
  const second = seconds % 60;
  const minute = Math.floor(seconds / 60) % 60;
  const hour = Math.floor(seconds / 3600);
  const time = { days, hour, minute, second, fraction };
  const count = date1904 ? days + DAYS_1904 : days;
  if (count === 60) return SerialParts.make({ ...time, year: 1900, month: 2, day: 29, weekday: 3 });
  if (count === 0) return SerialParts.make({ ...time, year: 1900, month: 1, day: 0, weekday: 6 });
  const real = count > 60 ? count - 1 : count;
  const [year, month, day] = civilFromDays(EPOCH_1900 + real - 1);
  const weekday = ((((real % 7) + 7) % 7) + (count < 60 ? 6 : 0)) % 7;
  return SerialParts.make({ ...time, year, month, day, weekday });
};

/** The serial of calendar fields in a date system, when the sheet's calendar has such a moment. */
export const serialOf = (input: {
  readonly parts: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
  };
  readonly date1904: boolean;
}): O.Option<number> => {
  const { parts, date1904 } = input;
  const time = (parts.hour * 3600 + parts.minute * 60 + parts.second) / 86_400;
  let count: number;
  if (parts.year === 1900 && parts.month === 2 && parts.day === 29) count = 60;
  else if (parts.year === 1900 && parts.month === 1 && parts.day === 0) count = 0;
  else {
    if (parts.day < 1) return O.none();
    const days = daysFromCivil(parts.year, parts.month, parts.day);
    const [year, month, day] = civilFromDays(days);
    if (year !== parts.year || month !== parts.month || day !== parts.day) return O.none();
    const real = days - EPOCH_1900 + 1;
    count = real >= 60 ? real + 1 : real;
  }
  const days = date1904 ? count - DAYS_1904 : count;
  return days < 0 ? O.none() : O.some(days + time);
};
