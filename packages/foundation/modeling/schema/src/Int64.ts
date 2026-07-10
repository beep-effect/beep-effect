/**
 * Integer schemas and refinements.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Int");

const int64Minimum = -BigInt("9223372036854775808");
const int64Maximum = BigInt("9223372036854775807");

/**
 * Refinement that accepts signed 64-bit integer values.
 *
 * @remarks
 * The full signed int64 range is larger than JavaScript's safe integer range,
 * so this refinement is defined for `bigint` values instead of `number`
 * values.
 *
 * @example
 * ```ts
 * import { isInt64 } from "@beep/schema/Int"
 * import * as S from "effect/Schema"
 *
 * const SignedInt64 = S.BigInt.check(isInt64())
 * console.log(S.is(SignedInt64)(BigInt("9223372036854775807"))) // true
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export function isInt64(annotations?: S.Annotations.Filter) {
  return S.isBetweenBigInt(
    {
      minimum: int64Minimum,
      maximum: int64Maximum,
    },
    {
      identifier: $I`Int64RangeCheck`,
      title: "Int64 Range",
      description: "A signed 64-bit integer in the inclusive int64 range.",
      expected: "a signed 64-bit integer",
      message: "Expected a signed 64-bit integer",
      ...annotations,
    }
  );
}

/**
 * Branded schema for signed 64-bit integers.
 *
 * @remarks
 * Use this schema for values that are already represented as `bigint`. For
 * JSON or OpenAPI boundaries where int64 values are transported as decimal
 * strings, use {@link Int64FromString}.
 *
 * @example
 * ```ts
 * import { Int64 } from "@beep/schema/Int"
 * import * as S from "effect/Schema"
 *
 * const isSignedInt64 = S.is(Int64)
 * console.log(isSignedInt64(-BigInt("9223372036854775808"))) // true
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const Int64 = S.BigInt.check(isInt64()).pipe(
  S.brand("Int64"),
  $I.annoteSchema("Int64", {
    description: "A signed 64-bit integer represented as a BigInt.",
  })
);

/**
 * Type for {@link Int64}.
 *
 * @example
 * ```ts
 * import { Int64 } from "@beep/schema/Int"
 * import type { Int64 as Int64Value } from "@beep/schema/Int"
 * import * as S from "effect/Schema"
 *
 * const input: unknown = BigInt(42)
 * if (S.is(Int64)(input)) {
 *   const value: Int64Value = input
 *   console.log(value)
 * }
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Int64 = typeof Int64.Type;

/**
 * Codec that decodes decimal string input into a branded signed 64-bit
 * integer and encodes it back to a decimal string.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Int64FromString } from "@beep/schema/Int"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(Int64FromString)("9223372036854775807")
 * const value = await Effect.runPromise(program)
 * console.log(value === BigInt("9223372036854775807"))
 * ```
 *
 * @since 0.0.0
 * @category codecs
 */
export const Int64FromString = S.BigIntFromString.pipe(
  S.decodeTo(Int64),
  $I.annoteSchema("Int64FromString", {
    description: "A decimal string codec for signed 64-bit integer BigInt values.",
  })
);

/**
 * Type for {@link Int64FromString}.
 *
 * @example
 * ```ts
 * import { Int64, Int64FromString } from "@beep/schema/Int"
 * import type { Int64FromString as Int64FromStringValue } from "@beep/schema/Int"
 * import * as S from "effect/Schema"
 *
 * const input: unknown = BigInt(0)
 * const acceptsInt64StringValue = (input: Int64FromStringValue) => input
 * if (S.is(Int64FromString)(input)) {
 *   console.log(S.is(Int64)(acceptsInt64StringValue(input)))
 * }
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Int64FromString = typeof Int64FromString.Type;
