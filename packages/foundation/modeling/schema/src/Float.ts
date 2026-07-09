/**
 * Branded schema for protobuf `float` numbers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Float");

const floatMinimum = -3.4028234663852886e38;
const floatMaximum = 3.4028234663852886e38;

const FloatChecks = S.makeFilterGroup(
  [
    S.isFinite({
      identifier: $I`FloatFiniteCheck`,
      title: "Protobuf float Finite",
      description: "A protobuf float schema value must be finite at the validation boundary.",
      message: "Expected a finite protobuf float number",
    }),
    S.isBetween(
      {
        minimum: floatMinimum,
        maximum: floatMaximum,
      },
      {
        identifier: $I`FloatRangeCheck`,
        title: "Protobuf float Range",
        description: "A protobuf float value must fit within the finite IEEE-754 binary32 range.",
        expected: "a finite 32-bit protobuf float",
        message: "Expected a protobuf float value in the finite 32-bit float range",
      }
    ),
  ],
  {
    identifier: $I`FloatChecks`,
    title: "Protobuf float",
    description: "Checks for finite protobuf float values represented as JavaScript numbers.",
  }
);

/**
 * Branded schema for protobuf `float` values.
 *
 * @remarks
 * Protobufjs writes `float` as IEEE-754 binary32 and exposes the JavaScript
 * value as a `number`. This schema accepts finite numbers in the finite float32
 * range; protobufjs will round ordinary decimal inputs to binary32 while
 * encoding.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Float } from "@beep/schema/Float"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Float)(0.5))
 * console.log(value) // 0.5
 * ```
 *
 * @invariant Values are finite numbers in the finite IEEE-754 binary32 range.
 * @category validation
 * @since 0.0.0
 */
export const Float = S.Finite.annotate({
  toArbitrary: () => (fc) => fc.float({ noDefaultInfinity: true, noNaN: true }),
})
  .check(FloatChecks)
  .pipe(
    S.brand("Float"),
    $I.annoteSchema("Float", {
      description: "A finite protobuf float number in the finite IEEE-754 binary32 range.",
    })
  );

/**
 * Type-level value inferred from {@link Float}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Float } from "@beep/schema/Float"
 * import type { Float as FloatValue } from "@beep/schema/Float"
 *
 * const input: unknown = 1.25
 * if (S.is(Float)(input)) {
 *   const value: FloatValue = input
 *   console.log(value) // 1.25
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Float = typeof Float.Type;
