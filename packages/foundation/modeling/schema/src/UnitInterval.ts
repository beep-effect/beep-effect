/**
 * UnitInterval - value object for a real number in the closed unit interval [0, 1].
 *
 * A branded type constrained to `0 <= x <= 1` — the canonical, domain-agnostic
 * shape for probabilities, confidences, ratios, and normalized scores. Uses
 * `Schema.brand` for compile-time type safety. Slices give it a semantic name at
 * the point of use (e.g. epistemic re-exports it as `Confidence`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("UnitInterval");

/**
 * Schema for a real number in the closed unit interval `[0, 1]` (inclusive).
 *
 * **Example** (Decode unit interval value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 *
 * const value = S.decodeUnknownSync(UnitInterval)(0.92)
 * console.log(value) // 0.92
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UnitInterval = S.Finite.check(
  S.makeFilterGroup([S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(1)])
).pipe(
  S.brand("UnitInterval"),
  $I.annoteSchema("UnitInterval", {
    description:
      "Schema for a real number in the closed unit interval [0, 1] (inclusive).\nThe canonical shape for probabilities, confidences, ratios, and normalized scores.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * {@inheritDoc UnitInterval}
 * @category models
 * @since 0.0.0
 */
export type UnitInterval = typeof UnitInterval.Type;

/**
 * Type guard for {@link UnitInterval}.
 *
 * **Example** (Check unit interval bounds)
 *
 * ```ts
 * import { isUnitInterval } from "@beep/schema/UnitInterval"
 *
 * console.log(isUnitInterval(0.5)) // true
 * console.log(isUnitInterval(1.5)) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isUnitInterval = UnitInterval.is;

/**
 * UnitInterval constant for `0` (the empty/none bound).
 *
 * **Example** (Use ZERO with complement)
 *
 * ```ts
 * import { ZERO, complement, isUnitInterval } from "@beep/schema/UnitInterval"
 *
 * console.log(isUnitInterval(ZERO)) // true
 * console.log(complement(ZERO)) // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ZERO: UnitInterval = UnitInterval.make(0);

/**
 * UnitInterval constant for `1` (the full/certain bound).
 *
 * **Example** (Use ONE with complement)
 *
 * ```ts
 * import { ONE, complement, isUnitInterval } from "@beep/schema/UnitInterval"
 *
 * console.log(isUnitInterval(ONE)) // true
 * console.log(complement(ONE)) // 0
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ONE: UnitInterval = UnitInterval.make(1);

/**
 * The complement of a unit-interval value (`1 - value`).
 *
 * **Example** (Complement of ONE)
 *
 * ```ts
 * import { complement, ONE } from "@beep/schema/UnitInterval"
 *
 * console.log(complement(ONE)) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const complement = (value: UnitInterval): UnitInterval => UnitInterval.make(1 - value);
