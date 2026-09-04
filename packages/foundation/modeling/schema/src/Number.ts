/**
 * Numeric refinement helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("NumberChecks");

/**
 * Refinement that accepts positive numbers (greater than zero).
 *
 * **Example** (Decode positive finite number)
 *
 * ```ts import.meta.vitest name="Decode positive finite number"
 * import * as S from "effect/Schema"
 * import { isPositive } from "@beep/schema/Number"
 *
 * const PosNum = S.Finite.check(isPositive)
 * const value = S.decodeUnknownSync(PosNum)(5)
 * value // => 5
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isPositive = S.isGreaterThan(0);

/**
 * Refinement that accepts integers in PostgreSQL `serial` column range.
 *
 * **Example** (Decode PostgreSQL serial integer)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { isPostgresSerialInt } from "@beep/schema/Number"
 *
 * const Serial = S.Int.check(isPostgresSerialInt)
 * const id = S.decodeUnknownSync(Serial)(1)
 * console.log(id)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isPostgresSerialInt = S.makeFilterGroup(
  [
    S.isInt({
      identifier: $I`PostgresSerialIntIntegerCheck`,
      title: "Postgres Serial Integer",
      description: "A PostgreSQL serial value must be an integer.",
      message: "Expected a PostgreSQL serial integer",
    }),
    S.isGreaterThan(0, {
      identifier: $I`PostgresSerialIntPositiveCheck`,
      title: "Postgres Serial Positive",
      description: "A PostgreSQL serial value starts at one.",
      message: "Expected a PostgreSQL serial integer greater than zero",
    }),
    S.isLessThanOrEqualTo(2_147_483_647, {
      identifier: $I`PostgresSerialIntMaxCheck`,
      title: "Postgres Serial Max",
      description: "A PostgreSQL serial value must fit in the signed int4 range.",
      message: "Expected a PostgreSQL serial integer less than or equal to 2147483647",
    }),
  ],
  {
    identifier: $I`PostgresSerialIntChecks`,
    title: "Postgres Serial Int",
    description: "Checks for positive signed int4 values produced by PostgreSQL serial columns.",
  }
);

/**
 * Refinement that accepts non-negative numbers (zero or greater).
 *
 * **Example** (Decode non-negative finite numbers)
 *
 * ```ts import.meta.vitest name="Decode non-negative finite numbers"
 * import * as S from "effect/Schema"
 * import { isNonNegative } from "@beep/schema/Number"
 *
 * const NonNeg = S.Finite.check(isNonNegative)
 * S.decodeUnknownSync(NonNeg)(0) // => 0
 * S.decodeUnknownSync(NonNeg)(42) // => 42
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isNonNegative = S.isGreaterThanOrEqualTo(0);

/**
 * Refinement that accepts negative numbers (less than zero).
 *
 * **Example** (Decode negative finite number)
 *
 * ```ts import.meta.vitest name="Decode negative finite number"
 * import * as S from "effect/Schema"
 * import { isNegative } from "@beep/schema/Number"
 *
 * const NegNum = S.Finite.check(isNegative)
 * const value = S.decodeUnknownSync(NegNum)(-1)
 * value // => -1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isNegative = S.isLessThan(0);

/**
 * Refinement that accepts non-positive numbers (zero or less).
 *
 * **Example** (Decode non-positive finite numbers)
 *
 * ```ts import.meta.vitest name="Decode non-positive finite numbers"
 * import * as S from "effect/Schema"
 * import { isNonPositive } from "@beep/schema/Number"
 *
 * const NonPos = S.Finite.check(isNonPositive)
 * S.decodeUnknownSync(NonPos)(0) // => 0
 * S.decodeUnknownSync(NonPos)(-10) // => -10
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isNonPositive = S.isLessThanOrEqualTo(0);

/**
 * Branded schema for non-negative number (zero or greater).
 *
 * **Example** (Decode non-negative branded number)
 *
 * ```ts import.meta.vitest name="Decode non-negative branded number"
 * import * as S from "effect/Schema"
 * import { NonNegNum } from "@beep/schema/Number"
 *
 * S.decodeUnknownSync(NonNegNum)(0) // => 0
 * S.decodeUnknownSync(NonNegNum)(100) // => 100
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NonNegNum = S.Finite.pipe(
  S.check(isNonNegative),
  $I.annoteSchema("NonNegNum", {
    description: "A non-negative number (zero or greater)",
  })
);

/**
 * Type for {@link NonNegNum}.
 *
 * **Example** (Type non-negative branded value)
 *
 * ```ts import.meta.vitest name="Type non-negative branded value"
 * import * as S from "effect/Schema"
 * import { NonNegNum } from "@beep/schema/Number"
 *
 * const index: NonNegNum = S.decodeUnknownSync(NonNegNum)(0)
 * index >= 0 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonNegNum = typeof NonNegNum.Type;

/**
 * Branded schema for non-negative integers (zero or greater).
 *
 * **Example** (Decode non-negative branded integer)
 *
 * ```ts import.meta.vitest name="Decode non-negative branded integer"
 * import * as S from "effect/Schema"
 * import { NonNegativeInt } from "@beep/schema/Number"
 *
 * S.decodeUnknownSync(NonNegativeInt)(0) // => 0
 * S.decodeUnknownSync(NonNegativeInt)(100) // => 100
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NonNegativeInt = S.Int.pipe(
  S.check(
    S.makeFilterGroup([
      S.isFinite({
        message: "Expected a finite integer",
        description: "A finite integer",
      }),
      isNonNegative.annotate({
        message: "Expected a non-negative integer",
        description: "A non-negative integer",
      }),
    ])
  ),
  S.brand("NonNegativeInt"),
  $I.annoteSchema("NonNegativeInt", {
    description: "A non-negative integer",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownOption", "is"])
);

/**
 * Type for {@link NonNegativeInt}.
 *
 * **Example** (Type non-negative integer value)
 *
 * ```ts import.meta.vitest name="Type non-negative integer value"
 * import * as S from "effect/Schema"
 * import { NonNegativeInt } from "@beep/schema/Number"
 *
 * const index: NonNegativeInt = S.decodeUnknownSync(NonNegativeInt)(0)
 * index >= 0 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonNegativeInt = typeof NonNegativeInt.Type;

/**
 * Codec that decodes strings into finite numbers and encodes finite numbers as strings.
 *
 * **Gotchas**
 *
 * Decoding follows JavaScript number coercion, so strings such as whitespace or
 * hexadecimal notation are accepted when they coerce to finite numbers.
 *
 * **Example** (Decode a finite number from a string)
 *
 * ```ts import.meta.vitest name="Decode a finite number from a string"
 * import * as Effect from "effect/Effect"
 * import { FiniteFromString } from "@beep/schema/Number"
 *
 * const value = Effect.runSync(FiniteFromString.decodeEffect("42.5"))
 * value // => 42.5
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const FiniteFromString = S.FiniteFromString.pipe(
  $I.annoteSchema("FiniteFromString", {
    description: "A codec that decodes strings into finite numbers and encodes finite numbers as strings.",
  }),
  SchemaUtils.withCodecStatics(["decodeEffect"])
);

/**
 * Finite number decoded by {@link FiniteFromString}.
 *
 * @see {@link FiniteFromString} for the runtime codec and schema-bound Effect decoder.
 * @category type-level
 * @since 0.0.0
 */
export type FiniteFromString = typeof FiniteFromString.Type;

/**
 * Type-level companions for {@link FiniteFromString}.
 *
 * @see {@link FiniteFromString} for the runtime codec and schema-bound Effect decoder.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FiniteFromString {
  /**
   * Encoded string representation consumed and produced by {@link FiniteFromString}.
   *
   * @see {@link FiniteFromString} for the runtime codec and decoded finite-number type.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FiniteFromString.Encoded;
}
