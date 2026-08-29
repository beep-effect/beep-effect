/**
 * Numeric predicates and `effect/Number` re-exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Number as N } from "effect";

/**
 * Determines if the given input is a number and is positive (greater than or equal to 0).
 *
 * **Details**
 *
 * This utility function serves as a type guard ensuring the input is a `number`
 * and meets the condition of being at least 0. Useful when validating or filtering
 * data in both functional and effect contexts.
 *
 * **Example** (Filter and type-guard positives)
 *
 * ```ts
 * import { isPositive } from "@beep/utils/Number";
 * import * as A from "effect/Array";
 *
 * const values = [3, -1, 0, 42, -7];
 *
 * // Basic usage: Filter out negative numbers
 * const positives = A.filter(values, isPositive);
 * console.log(positives); // Output: [3, 0, 42]
 *
 * // Type guard usage to refine unknown input types
 * const value: unknown = 5;
 * if (isPositive(value)) {
 *   const doubled = value * 2;
 *   console.log(doubled);
 * }
 * ```
 *
 * @param u - The value to check.
 * @returns True if the value is a number and is positive, false otherwise.
 * @see N.isGreaterThanOrEqualTo for comparison implementation details.
 * @category validation
 * @since 0.0.0
 */
export const isPositive: (u: unknown) => u is number = (u: unknown): u is number =>
  N.isNumber(u) && N.isGreaterThanOrEqualTo(0)(u);

/**
 * Re-export of all helpers from `effect/Number`.
 *
 * **Example** (Import Number helpers)
 *
 * ```ts
 * import * as Num from "@beep/utils/Number"
 *
 * console.log(Num)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "effect/Number";

/**
 * Type guard that checks whether a value is a `number` and an integer.
 *
 * **Example** (Check integer type guard)
 *
 * ```ts
 * import { N } from "@beep/utils"
 *
 * const whole = N.isInteger(42)
 * // true
 *
 * const fractional = N.isInteger(3.14)
 * // false
 *
 * const notNum = N.isInteger("42")
 * // false
 *
 * console.log(whole)
 * console.log(fractional)
 * console.log(notNum)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isInteger: (u: unknown) => u is number = (u: unknown): u is number =>
  N.isNumber(u) && N.remainder(1)(u) === 0;
