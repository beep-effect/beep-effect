/**
 * Branded schema for protobuf `float` numbers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Float");

const floatMinimum = -3.4028234663852886e38;
const floatMaximum = 3.4028234663852886e38;

const isProtobufFloatValue = (value: number) =>
  globalThis.Number.isNaN(value) ||
  value === globalThis.Number.POSITIVE_INFINITY ||
  value === globalThis.Number.NEGATIVE_INFINITY ||
  (globalThis.Number.isFinite(value) && value >= floatMinimum && value <= floatMaximum);

const FloatChecks = S.makeFilter(isProtobufFloatValue, {
  identifier: $I`FloatValueCheck`,
  title: "Protobuf float Value",
  description:
    "A protobuf float value must be an IEEE-754 binary32 JavaScript number or a protobuf-valid special value.",
  expected: "a protobuf float number",
  message: "Expected a protobuf float value in the binary32 range or an IEEE-754 special value",
});

const ProtobufNumber = S.declare<number>(P.isNumber, {
  description: "A JavaScript number, including IEEE-754 special values accepted by protobuf.",
  identifier: $I`ProtobufNumber`,
  title: "Protobuf Number",
});

/**
 * Branded schema for protobuf `float` values.
 *
 * @remarks
 * Protobufjs writes `float` as IEEE-754 binary32 and exposes the JavaScript
 * value as a `number`. This schema accepts finite numbers in the finite
 * binary32 range plus the IEEE-754 special values `NaN`, `Infinity`, and
 * `-Infinity`, all of which can appear in protobuf float payloads.
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
 * @invariant Values are finite numbers in the IEEE-754 binary32 range or protobuf-valid IEEE-754 special values.
 * @category validation
 * @since 0.0.0
 */
export const Float = ProtobufNumber.annotate({
  toArbitrary: () => (fc) =>
    fc.oneof(
      fc.float({ max: floatMaximum, min: floatMinimum, noDefaultInfinity: true, noNaN: true }),
      fc.constant(globalThis.Number.NaN),
      fc.constant(globalThis.Number.POSITIVE_INFINITY),
      fc.constant(globalThis.Number.NEGATIVE_INFINITY)
    ),
})
  .check(FloatChecks)
  .pipe(
    S.brand("Float"),
    $I.annoteSchema("Float", {
      description: "A protobuf float number in the IEEE-754 binary32 range, including valid special values.",
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
