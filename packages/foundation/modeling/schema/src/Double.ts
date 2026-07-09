/**
 * Branded schema for protobuf `double` numbers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Double");

const DoubleFinite = S.isFinite({
  identifier: $I`DoubleFiniteCheck`,
  title: "Protobuf double Finite",
  description: "A protobuf double schema value must be finite at the validation boundary.",
  message: "Expected a finite protobuf double number",
});

/**
 * Branded schema for protobuf `double` values.
 *
 * @remarks
 * Protobufjs writes `double` as IEEE-754 binary64 and exposes the JavaScript
 * value as a `number`. This schema rejects `NaN` and infinities at the
 * validation boundary.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Double } from "@beep/schema/Double"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Double)(1.25))
 * console.log(value) // 1.25
 * ```
 *
 * @invariant Values are finite JavaScript numbers.
 * @category validation
 * @since 0.0.0
 */
export const Double = S.Finite.annotate({
  toArbitrary: () => (fc) => fc.double({ noDefaultInfinity: true, noNaN: true }),
})
  .check(DoubleFinite)
  .pipe(
    S.brand("Double"),
    $I.annoteSchema("Double", {
      description: "A finite protobuf double number represented as an IEEE-754 binary64 JavaScript number.",
    })
  );

/**
 * Type-level value inferred from {@link Double}.
 *
 * @example
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
