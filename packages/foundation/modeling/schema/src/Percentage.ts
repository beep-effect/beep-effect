/**
 * Percentage - Value object for percentage values (0-100)
 *
 * A branded type representing a valid percentage value constrained to 0-100.
 * Supports decimal values (e.g., 12.5%, 99.99%).
 * Uses Schema.brand for compile-time type safety.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("Percentage");

/**
 * Schema for a valid percentage value between 0 and 100 (inclusive).
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Percentage } from "@beep/schema/Percentage"
 *
 * const value = S.decodeUnknownSync(Percentage)(75.5)
 * console.log(value) // 75.5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Percentage = S.Finite.check(
  S.makeFilterGroup([S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(100)])
).pipe(
  S.brand("Percentage"),
  $I.annoteSchema("Percentage", {
    description:
      "Schema for a valid percentage value.\nMust be a number between 0 and 100 (inclusive).\nSupports decimal values.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * {@inheritDoc Percentage}
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Percentage } from "@beep/schema/Percentage"
 *
 * const discount: Percentage = S.decodeUnknownSync(Percentage)(25)
 * console.log(discount) // 25
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Percentage = typeof Percentage.Type;

/**
 * Type guard for {@link Percentage}.
 *
 * @example
 * ```ts
 * import { isPercentage } from "@beep/schema/Percentage"
 *
 * console.log(isPercentage(50)) // true
 * console.log(isPercentage(150)) // false
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const isPercentage = Percentage.is;

/**
 * Percentage constant for 0%.
 *
 * @example
 * ```ts
 * import { ZERO, isZero, toDecimal } from "@beep/schema/Percentage"
 *
 * console.log(isZero(ZERO)) // true
 * console.log(toDecimal(ZERO)) // 0
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ZERO: Percentage = Percentage.make(0);
/**
 * Percentage constant for 20%.
 *
 * @example
 * ```ts
 * import { TWENTY, toDecimal } from "@beep/schema/Percentage"
 *
 * console.log(toDecimal(TWENTY)) // 0.2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TWENTY: Percentage = Percentage.make(20);
/**
 * Percentage constant for 50%.
 *
 * @example
 * ```ts
 * import { FIFTY, format } from "@beep/schema/Percentage"
 *
 * console.log(format(FIFTY, 0)) // "50%"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FIFTY: Percentage = Percentage.make(50);
/**
 * Percentage constant for 100%.
 *
 * @example
 * ```ts
 * import { HUNDRED, isFull, toDecimal } from "@beep/schema/Percentage"
 *
 * console.log(isFull(HUNDRED)) // true
 * console.log(toDecimal(HUNDRED)) // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HUNDRED: Percentage = Percentage.make(100);

/**
 * Convert a percentage to its decimal representation (0-1 range).
 *
 * @example
 * ```ts
 * import { toDecimal, FIFTY } from "@beep/schema/Percentage"
 *
 * console.log(toDecimal(FIFTY)) // 0.5
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const toDecimal = (percentage: Percentage): number => percentage / 100;

/**
 * Convert a decimal (0-1 range) to a percentage value.
 *
 * @example
 * ```ts
 * import { fromDecimal } from "@beep/schema/Percentage"
 *
 * const pct = fromDecimal(0.75)
 * console.log(pct) // 75
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const fromDecimal = (decimal: number): Percentage => Percentage.make(decimal * 100);

/**
 * Check if a percentage value is zero.
 *
 * @example
 * ```ts
 * import { isZero, ZERO, FIFTY } from "@beep/schema/Percentage"
 *
 * console.log(isZero(ZERO)) // true
 * console.log(isZero(FIFTY)) // false
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const isZero = (percentage: Percentage): boolean => percentage === 0;

/**
 * Check if a percentage value is 100%.
 *
 * @example
 * ```ts
 * import { isFull, HUNDRED, FIFTY } from "@beep/schema/Percentage"
 *
 * console.log(isFull(HUNDRED)) // true
 * console.log(isFull(FIFTY)) // false
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const isFull = (percentage: Percentage): boolean => percentage === 100;

/**
 * Get the complement of a percentage (100 - value).
 *
 * @example
 * ```ts
 * import { complement, TWENTY } from "@beep/schema/Percentage"
 *
 * const value = complement(TWENTY)
 * console.log(value) // 80
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const complement = (percentage: Percentage): Percentage => Percentage.make(100 - percentage);

/**
 * Format a percentage as a display string with configurable decimal places.
 *
 * @example
 * ```ts
 * import { format, FIFTY } from "@beep/schema/Percentage"
 *
 * console.log(format(FIFTY, 0)) // "50%"
 * console.log(format(FIFTY, 2)) // "50.00%"
 * ```
 *
 * @since 0.0.0
 * @category formatting
 */
export const format: {
  (percentage: Percentage): (decimalPlaces?: undefined | number) => string;
  (percentage: Percentage, decimalPlaces?: undefined | number): string;
} = dual(2, (percentage: Percentage, decimalPlaces = 2): string => `${percentage.toFixed(decimalPlaces)}%`);
