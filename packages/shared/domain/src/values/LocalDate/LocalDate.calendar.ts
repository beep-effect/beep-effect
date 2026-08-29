/**
 * Gregorian calendar primitives shared by LocalDate model and behavior code.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity";
import {
  LocalDate as CanonicalLocalDate,
  daysInMonth as canonicalDaysInMonth,
  isLeapYear as canonicalIsLeapYear,
} from "@beep/schema/LocalDate";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $SharedDomainId.create("values/LocalDate/LocalDate.calendar");

/**
 * Raw calendar fields used before LocalDate class construction.
 *
 * **Example** (Make leap day parts)
 *
 * ```ts
 * import { CalendarParts } from "@beep/shared-domain/values/LocalDate/LocalDate.calendar"
 *
 * const parts = CalendarParts.make({ year: 2024, month: 2, day: 29 })
 * console.log(parts.day)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CalendarParts extends S.Class<CalendarParts>($I`CalendarParts`)(
  CanonicalLocalDate.fields,
  $I.annote("CalendarParts", {
    description: "Raw Gregorian calendar fields used before LocalDate class construction.",
  })
) {}

/**
 * Check whether a Gregorian calendar year is a leap year.
 *
 * **Example** (Leap year checks)
 *
 * ```ts
 * import { isGregorianLeapYear } from "@beep/shared-domain/values/LocalDate/LocalDate.calendar"
 *
 * console.log(isGregorianLeapYear(2024)) // true
 * console.log(isGregorianLeapYear(1900)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isGregorianLeapYear = (year: number): boolean => canonicalIsLeapYear(year);

/**
 * Return the number of days in a Gregorian calendar month.
 *
 * **Example** (February day counts)
 *
 * ```ts
 * import { daysInGregorianMonth } from "@beep/shared-domain/values/LocalDate/LocalDate.calendar"
 *
 * console.log(daysInGregorianMonth(2024, 2)) // 29
 * console.log(daysInGregorianMonth(2023, 2)) // 28
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const daysInGregorianMonth: {
  (month: number): (year: number) => number;
  (year: number, month: number): number;
} = dual(2, (year: number, month: number): number => canonicalDaysInMonth(year, month));

/**
 * Check whether raw calendar fields form a real Gregorian local date.
 *
 * **Example** (Validate leap day dates)
 *
 * ```ts
 * import { isValidGregorianDate } from "@beep/shared-domain/values/LocalDate/LocalDate.calendar"
 *
 * console.log(isValidGregorianDate({ year: 2024, month: 2, day: 29 })) // true
 * console.log(isValidGregorianDate({ year: 2023, month: 2, day: 29 })) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isValidGregorianDate = ({ day, month, year }: CalendarParts): boolean =>
  year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInGregorianMonth(year, month);
