/**
 * Branded schema for protobuf `double` numbers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Double");

const isProtobufDoubleValue = (value: number) =>
  globalThis.Number.isNaN(value) ||
  value === globalThis.Number.POSITIVE_INFINITY ||
  value === globalThis.Number.NEGATIVE_INFINITY ||
  (value >= -globalThis.Number.MAX_VALUE && value <= globalThis.Number.MAX_VALUE);

const DoubleChecks = S.makeFilter(isProtobufDoubleValue, {
  identifier: $I`DoubleValueCheck`,
  title: "Protobuf double Value",
  description: "A protobuf double value is any IEEE-754 binary64 JavaScript number, including NaN and infinities.",
  expected: "a protobuf double number",
  message: "Expected a protobuf double number",
});

const ProtobufNumber = S.declare<number>(P.isNumber, {
  description: "A JavaScript number, including IEEE-754 special values accepted by protobuf.",
  identifier: $I`ProtobufNumber`,
  title: "Protobuf Number",
});

/**
 * Branded schema for protobuf `double` values.
 *
 * **Gotchas**
 *
 * Protobufjs writes `double` as IEEE-754 binary64 and exposes the JavaScript
 * value as a `number`. IEEE-754 special values are valid protobuf scalar
 * payloads, so this schema accepts `NaN`, `Infinity`, and `-Infinity`.
 *
 * **Example** (Decode double number value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Double } from "@beep/schema/Double"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Double)(1.25))
 * console.log(value) // 1.25
 * ```
 *
 * @invariant Values are JavaScript numbers in the protobuf `double` domain, including IEEE-754 special values.
 * @category validation
 * @since 0.0.0
 */
export const Double = ProtobufNumber.annotate({
  toArbitrary: () => (fc) =>
    fc.oneof(
      fc.double({ noDefaultInfinity: true, noNaN: true }),
      fc.constant(globalThis.Number.NaN),
      fc.constant(globalThis.Number.POSITIVE_INFINITY),
      fc.constant(globalThis.Number.NEGATIVE_INFINITY)
    ),
})
  .check(DoubleChecks)
  .pipe(
    S.brand("Double"),
    $I.annoteSchema("Double", {
      description: "A protobuf double number represented as an IEEE-754 binary64 JavaScript number.",
    })
  );

/**
 * Type-level value inferred from {@link Double}.
 *
 * **Example** (Narrow unknown to Double)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Double } from "@beep/schema/Double"
 * import type { Double as DoubleValue } from "@beep/schema/Double"
 *
 * const input: unknown = 1.25
 * if (S.is(Double)(input)) {
 *   const value: DoubleValue = input
 *   console.log(value) // 1.25
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Double = typeof Double.Type;
