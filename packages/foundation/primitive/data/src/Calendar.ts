/**
 * Calendar data constants for month and weekday names, numbers, and ISO codes.
 *
 * Provides typed arrays of month names, weekday names, their formalized
 * (capitalized) variants, numeric month values (1-12), and two-digit ISO
 * month codes. Each array is `as const` so members can be used as literal
 * union types.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as internal from "./internal/data/calendar/index.ts";

// -------------------------------------------------------------------------------------
// types
// -------------------------------------------------------------------------------------

/**
 * Union of lowercase English month name strings.
 *
 * **Example** (Assign lowercase month name)
 *
 * ```ts import.meta.vitest name="Assign lowercase month name"
 * import type { MonthName } from "@beep/data/Calendar"
 *
 * const month: MonthName = "january"
 * console.assert(month === "january")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MonthName = (typeof internal.MonthNameValues)[number];

/**
 * Union of capitalized English month name strings.
 *
 * **Example** (Assign capitalized month name)
 *
 * ```ts import.meta.vitest name="Assign capitalized month name"
 * import type { FormalMonthName } from "@beep/data/Calendar"
 *
 * const month: FormalMonthName = "January"
 * console.assert(month === "January")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FormalMonthName = (typeof internal.FormalMonthNameValues)[number];

/**
 * Union of month number literals from 1 through 12.
 *
 * **Example** (Assign month number literals)
 *
 * ```ts import.meta.vitest name="Assign month number literals"
 * import type { MonthNumber } from "@beep/data/Calendar"
 *
 * const jan: MonthNumber = 1
 * const dec: MonthNumber = 12
 * console.assert(jan === 1 && dec === 12)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MonthNumber = (typeof internal.MonthNumberValues)[number];

/**
 * Union of two-digit ISO month code strings from `"01"` through `"12"`.
 *
 * **Example** (Assign ISO month code)
 *
 * ```ts import.meta.vitest name="Assign ISO month code"
 * import type { MonthISO } from "@beep/data/Calendar"
 *
 * const jan: MonthISO = "01"
 * console.assert(jan === "01")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MonthISO = (typeof internal.MonthISOValues)[number];

/**
 * Union of lowercase English weekday name strings.
 *
 * **Example** (Assign lowercase weekday name)
 *
 * ```ts import.meta.vitest name="Assign lowercase weekday name"
 * import type { WeekName } from "@beep/data/Calendar"
 *
 * const day: WeekName = "monday"
 * console.assert(day === "monday")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type WeekName = (typeof internal.Weekday.WeekNameValues)[number];

/**
 * Union of capitalized English weekday name strings.
 *
 * **Example** (Assign capitalized weekday name)
 *
 * ```ts import.meta.vitest name="Assign capitalized weekday name"
 * import type { FormalWeekName } from "@beep/data/Calendar"
 *
 * const day: FormalWeekName = "Monday"
 * console.assert(day === "Monday")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FormalWeekName = (typeof internal.Weekday.FormalWeekNameValues)[number];

// -------------------------------------------------------------------------------------
// constants
// -------------------------------------------------------------------------------------

/**
 * Ordered tuple of all twelve lowercase English month names.
 *
 * **Example** (Read ordered month names)
 *
 * ```ts import.meta.vitest name="Read ordered month names"
 * import { MonthNameValues } from "@beep/data/Calendar"
 *
 * console.assert(MonthNameValues[0] === "january" && MonthNameValues[11] === "december")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MonthNameValues: typeof internal.MonthNameValues = internal.MonthNameValues;

/**
 * Ordered tuple of all twelve capitalized English month names.
 *
 * **Example** (Read formal month names)
 *
 * ```ts import.meta.vitest name="Read formal month names"
 * import { FormalMonthNameValues } from "@beep/data/Calendar"
 *
 * console.assert(FormalMonthNameValues[0] === "January")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FormalMonthNameValues: typeof internal.FormalMonthNameValues = internal.FormalMonthNameValues;

/**
 * Ordered tuple of month numbers from 1 through 12.
 *
 * **Example** (Read ordered month numbers)
 *
 * ```ts import.meta.vitest name="Read ordered month numbers"
 * import { MonthNumberValues } from "@beep/data/Calendar"
 *
 * console.assert(MonthNumberValues[0] === 1 && MonthNumberValues[11] === 12)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MonthNumberValues: typeof internal.MonthNumberValues = internal.MonthNumberValues;

/**
 * Ordered tuple of two-digit ISO month code strings from `"01"` through `"12"`.
 *
 * **Example** (Read ISO month codes)
 *
 * ```ts import.meta.vitest name="Read ISO month codes"
 * import { MonthISOValues } from "@beep/data/Calendar"
 *
 * console.assert(MonthISOValues[0] === "01" && MonthISOValues[11] === "12")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MonthISOValues: typeof internal.MonthISOValues = internal.MonthISOValues;

/**
 * Ordered tuple of all seven lowercase English weekday names, starting with Sunday.
 *
 * **Example** (Read ordered weekday names)
 *
 * ```ts import.meta.vitest name="Read ordered weekday names"
 * import { WeekNameValues } from "@beep/data/Calendar"
 *
 * console.assert(WeekNameValues[0] === "sunday" && WeekNameValues[1] === "monday")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const WeekNameValues: typeof internal.Weekday.WeekNameValues = internal.Weekday.WeekNameValues;

/**
 * Ordered tuple of all seven capitalized English weekday names, starting with Sunday.
 *
 * **Example** (Read formal weekday names)
 *
 * ```ts import.meta.vitest name="Read formal weekday names"
 * import { FormalWeekNameValues } from "@beep/data/Calendar"
 *
 * console.assert(FormalWeekNameValues[0] === "Sunday" && FormalWeekNameValues[1] === "Monday")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FormalWeekNameValues: typeof internal.Weekday.FormalWeekNameValues = internal.Weekday.FormalWeekNameValues;
