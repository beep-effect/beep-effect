/**
 * Numeric predicates and `effect/Number` re-exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { dual } from "effect/Function";
import * as N from "effect/Number";
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
 * @see {@link N.isGreaterThanOrEqualTo} for comparison implementation details.
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
 * import * as N from "@beep/utils/Number"
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

/**
 * A dual assertion that validates a named, programmer-supplied cap.
 *
 * **Example** (Type a cap assertion)
 *
 * ```ts
 * import type { CapAssertion } from "@beep/utils/Number"
 * import { makeCapAssertion } from "@beep/utils/Number"
 *
 * const assertCap: CapAssertion = makeCapAssertion("@beep/example", (message) => new Error(message))
 *
 * console.log(assertCap("maxDepth", 256)) // 256
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CapAssertion = {
  (name: string, value: number): number;
  (value: number): (name: string) => number;
};

/**
 * Builds the internal-cap assertion shared by bounded parsers and matchers.
 *
 * **Details**
 *
 * The returned assertion passes a positive safe integer through unchanged.
 * Any other value throws the error built by `onInvalid`, whose message reads
 * `<owner> internal cap <name> must be a positive integer, received <value>`.
 *
 * **Gotchas**
 *
 * Internal caps come from code, so a NaN, fractional or non-positive cap is a
 * wiring bug: it throws (a defect) and is never coerced or clamped.
 *
 * **Example** (Validate a cap in both call forms)
 *
 * ```ts
 * import { makeCapAssertion } from "@beep/utils/Number"
 *
 * const assertCap = makeCapAssertion("@beep/example", (message) => new Error(message))
 *
 * console.log(assertCap("maxDepth", 256)) // 256
 * console.log(assertCap(64)("maxDepth")) // 64
 * try {
 *   assertCap("maxDepth", 0)
 * } catch (error) {
 *   console.log(String(error)) // Error: @beep/example internal cap maxDepth must be a positive integer, received 0
 * }
 * ```
 *
 * @param owner - Package name rendered at the start of the failure message.
 * @param onInvalid - Builds the thrown error from the rendered message.
 * @returns A dual assertion over `(name, value)`.
 * @category validation
 * @since 0.0.0
 */
export const makeCapAssertion: {
  (onInvalid: (message: string) => Error): (owner: string) => CapAssertion;
  (owner: string, onInvalid: (message: string) => Error): CapAssertion;
} = dual(
  2,
  (owner: string, onInvalid: (message: string) => Error): CapAssertion =>
    dual(2, (name: string, value: number): number => {
      if (Number.isSafeInteger(value) && value >= 1) {
        return value;
      }
      throw onInvalid(`${owner} internal cap ${name} must be a positive integer, received ${value}`);
    })
);
