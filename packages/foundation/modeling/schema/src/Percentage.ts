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
 * **Example** (Decode percentage value)
 *
 * ```ts import.meta.vitest name="Decode percentage value"
 * import * as S from "effect/Schema"
 * import { Percentage } from "@beep/schema/Percentage"
 *
 * const value = S.decodeUnknownSync(Percentage)(75.5)
 * value // => 75.5
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
 * @category models
 * @since 0.0.0
 */
export type Percentage = typeof Percentage.Type;

/**
 * Type guard for {@link Percentage}.
 *
 * **Example** (Guard valid and invalid)
 *
 * ```ts import.meta.vitest name="Guard valid and invalid"
 * import { isPercentage } from "@beep/schema/Percentage"
 *
 * isPercentage(50) // => true
 * isPercentage(150) // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isPercentage = Percentage.is;

/**
 * Percentage constant for 0%.
 *
 * **Example** (Zero constant checks)
 *
 * ```ts import.meta.vitest name="Zero constant checks"
 * import { ZERO, isZero, toDecimal } from "@beep/schema/Percentage"
 *
 * isZero(ZERO) // => true
 * toDecimal(ZERO) // => 0
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ZERO: Percentage = Percentage.make(0);
/**
 * Percentage constant for 20%.
 *
 * **Example** (Twenty to decimal)
 *
 * ```ts import.meta.vitest name="Twenty to decimal"
 * import { TWENTY, toDecimal } from "@beep/schema/Percentage"
 *
 * toDecimal(TWENTY) // => 0.2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TWENTY: Percentage = Percentage.make(20);
/**
 * Percentage constant for 50%.
 *
 * **Example** (Format fifty percent)
 *
 * ```ts import.meta.vitest name="Format fifty percent"
 * import { FIFTY, format } from "@beep/schema/Percentage"
 *
 * format(FIFTY, 0) // => "50%"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FIFTY: Percentage = Percentage.make(50);
/**
 * Percentage constant for 100%.
 *
 * **Example** (Full hundred checks)
 *
 * ```ts import.meta.vitest name="Full hundred checks"
 * import { HUNDRED, isFull, toDecimal } from "@beep/schema/Percentage"
 *
 * isFull(HUNDRED) // => true
 * toDecimal(HUNDRED) // => 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HUNDRED: Percentage = Percentage.make(100);

/**
 * Convert a percentage to its decimal representation (0-1 range).
 *
 * **Example** (Convert fifty to decimal)
 *
 * ```ts import.meta.vitest name="Convert fifty to decimal"
 * import { toDecimal, FIFTY } from "@beep/schema/Percentage"
 *
 * toDecimal(FIFTY) // => 0.5
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const toDecimal = (percentage: Percentage): number => percentage / 100;

/**
 * Convert a decimal (0-1 range) to a percentage value.
 *
 * **Example** (Decimal to percentage)
 *
 * ```ts import.meta.vitest name="Decimal to percentage"
 * import { fromDecimal } from "@beep/schema/Percentage"
 *
 * const pct = fromDecimal(0.75)
 * pct // => 75
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const fromDecimal = (decimal: number): Percentage => Percentage.make(decimal * 100);

/**
 * Check if a percentage value is zero.
 *
 * **Example** (Check zero vs fifty)
 *
 * ```ts import.meta.vitest name="Check zero vs fifty"
 * import { isZero, ZERO, FIFTY } from "@beep/schema/Percentage"
 *
 * isZero(ZERO) // => true
 * isZero(FIFTY) // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isZero = (percentage: Percentage): boolean => percentage === 0;

/**
 * Check if a percentage value is 100%.
 *
 * **Example** (Check full vs fifty)
 *
 * ```ts import.meta.vitest name="Check full vs fifty"
 * import { isFull, HUNDRED, FIFTY } from "@beep/schema/Percentage"
 *
 * isFull(HUNDRED) // => true
 * isFull(FIFTY) // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isFull = (percentage: Percentage): boolean => percentage === 100;

/**
 * Get the complement of a percentage (100 - value).
 *
 * **Example** (Complement of twenty)
 *
 * ```ts import.meta.vitest name="Complement of twenty"
 * import { complement, TWENTY } from "@beep/schema/Percentage"
 *
 * const value = complement(TWENTY)
 * value // => 80
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const complement = (percentage: Percentage): Percentage => Percentage.make(100 - percentage);

/**
 * Format a percentage as a display string with configurable decimal places.
 *
 * **Example** (Format with decimals)
 *
 * ```ts import.meta.vitest name="Format with decimals"
 * import { format, FIFTY } from "@beep/schema/Percentage"
 *
 * format(FIFTY, 0) // => "50%"
 * format(FIFTY, 2) // => "50.00%"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const format: {
  (percentage: Percentage): (decimalPlaces?: undefined | number) => string;
  (percentage: Percentage, decimalPlaces?: undefined | number): string;
} = dual(2, (percentage: Percentage, decimalPlaces = 2): string => `${percentage.toFixed(decimalPlaces)}%`);
