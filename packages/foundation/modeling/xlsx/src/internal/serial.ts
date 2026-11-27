import { $XlsxId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { XlsxCalendar, XlsxDateSystem } from "../XlsxSerial.schema.ts";

const $I = $XlsxId.create("internal/serial");

const field = (description: string) => S.Int.pipe(S.annotateKey({ description }));

/** What a serial means on the sheet's calendar, with what rendering needs beside the six calendar fields. */
export class SerialParts extends S.Opaque<SerialParts, { readonly brand: unique symbol }>()(
  S.Struct({
    day: field("The day of the month; 0 only for serial 0 of the 1900 system"),
    days: field("The serial's whole days as written, after a carry from a time that rounds up to midnight"),
    hour: field("The hour, from 0"),
    millisecond: field("The milliseconds past the whole second, the time of day rounded to the nearest one"),
    minute: field("The minute"),
    month: field("The month, from 1"),
    second: field("The whole second"),
    weekday: field(
      "0 for Sunday to 6 for Saturday, as Excel shows it (its 1900 weekdays before March are a day early)"
    ),
    year: field("The year the sheet shows"),
  }).pipe($I.annoteSchema("SerialParts", { description: "A serial's calendar fields, with what rendering needs" }))
) {}

const unixDaysOfProlepticDate = (year: number, month: number, day: number): number => {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
};

const prolepticDateOfUnixDays = (days: number): readonly [year: number, month: number, day: number] => {
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

const EPOCH_1900 = unixDaysOfProlepticDate(1900, 1, 1);

/** The gap between the two date systems, in 1900-system serials. */
export const DAYS_1904 = 1462;

const toStoredDigits = (serial: number): number => Number(serial.toPrecision(15));

const MS_PER_DAY = 86_400_000;

/**
 * The calendar fields of a serial in a date system. `serial` is 0 or more. The time of day is rounded once, to the
 * nearest millisecond, and every reading of a serial (its calendar fields, its `DateTime`, its displayed text) starts
 * from that one value: 15 digits keep at least eight decimals of a day, under a millisecond, through the last serial,
 * so a whole second always survives. A time that rounds to midnight is the next day's 00:00:00.
 *
 * **Details**
 *
 * The arithmetic is ECMA-376 part 1, 18.17.4.1. The 1900 system counts 1 as 1 January 1900 and keeps 29 February
 * 1900, a day that never was, as serial 60, so every later serial is one more than the true day count. The 1904
 * system counts 0 as 1 January 1904 and has no such day. Serial 0 in the 1900 system is shown as "January 0, 1900".
 * Nothing here has a time zone. A serial is first rounded to the 15 significant digits a workbook stores, so
 * 0.6041666666666666 is 14:30 and not 14:29:59, and a seven-digit serial keeps its last second (9999-12-31 23:59:59
 * is stored as 2958465.99998843).
 */
export const partsOf: {
  (system: XlsxDateSystem): (serial: number) => SerialParts;
  (serial: number, system: XlsxDateSystem): SerialParts;
} = dual(2, (serial: number, system: XlsxDateSystem): SerialParts => {
  const value = toStoredDigits(serial);
  const whole = Math.trunc(value);
  const rounded = Math.round((value - whole) * MS_PER_DAY);
  const days = rounded === MS_PER_DAY ? whole + 1 : whole;
  const ms = rounded === MS_PER_DAY ? 0 : rounded;
  const seconds = Math.floor(ms / 1000);
  const millisecond = ms % 1000;
  const second = seconds % 60;
  const minute = Math.floor(seconds / 60) % 60;
  const hour = Math.floor(seconds / 3600);
  const time = { days, hour, minute, second, millisecond };
  const count = system === "1904" ? days + DAYS_1904 : days;
  if (count === 60) return SerialParts.make({ ...time, year: 1900, month: 2, day: 29, weekday: 3 });
  if (count === 0) return SerialParts.make({ ...time, year: 1900, month: 1, day: 0, weekday: 6 });
  const real = count > 60 ? count - 1 : count;
  const [year, month, day] = prolepticDateOfUnixDays(EPOCH_1900 + real - 1);
  const weekday = ((((real % 7) + 7) % 7) + (count < 60 ? 6 : 0)) % 7;
  return SerialParts.make({ ...time, year, month, day, weekday });
});

/**
 * The serial of calendar fields in a date system, when the sheet's calendar has such a day. The time of day is in
 * range already: `XlsxCalendar` holds hours 0 to 23 and minutes and seconds 0 to 59.
 */
export const serialOf: {
  (system: XlsxDateSystem): (parts: XlsxCalendar) => O.Option<number>;
  (parts: XlsxCalendar, system: XlsxDateSystem): O.Option<number>;
} = dual(2, (parts: XlsxCalendar, system: XlsxDateSystem): O.Option<number> => {
  const time = (parts.hour * 3600 + parts.minute * 60 + parts.second) / 86_400;
  return O.flatMap(count1900WithFictitiousDays(parts), (count) => {
    const days = system === "1904" ? count - DAYS_1904 : count;
    return days < 0 ? O.none() : O.some(days + time);
  });
});

const count1900WithFictitiousDays = (parts: XlsxCalendar): O.Option<number> => {
  if (parts.year === 1900 && parts.month === 2 && parts.day === 29) return O.some(60);
  if (parts.year === 1900 && parts.month === 1 && parts.day === 0) return O.some(0);
  return count1900OfRealDay(parts);
};

const count1900OfRealDay = (parts: XlsxCalendar): O.Option<number> => {
  if (parts.day < 1) return O.none();
  const days = unixDaysOfProlepticDate(parts.year, parts.month, parts.day);
  const [year, month, day] = prolepticDateOfUnixDays(days);
  if (year !== parts.year || month !== parts.month || day !== parts.day) return O.none();
  const real = days - EPOCH_1900 + 1;
  return O.some(real >= 60 ? real + 1 : real);
};
