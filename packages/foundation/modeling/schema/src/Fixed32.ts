/**
 * Branded schema for protobuf `fixed32` numbers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Fixed32");

const fixed32Minimum = 0;
const fixed32Maximum = 4_294_967_295;

const Fixed32Checks = S.makeFilterGroup(
  [
    S.isInt({
      identifier: $I`Fixed32IntegerCheck`,
      title: "Protobuf fixed32 Integer",
      description: "A protobuf fixed32 value must be an integer.",
      message: "Expected a protobuf fixed32 integer",
    }),
    S.isBetween(
      {
        minimum: fixed32Minimum,
        maximum: fixed32Maximum,
      },
      {
        identifier: $I`Fixed32RangeCheck`,
        title: "Protobuf fixed32 Range",
        description: "A protobuf fixed32 value must fit in the unsigned 32-bit fixed-width range.",
        expected: "an unsigned fixed-width 32-bit protobuf integer",
        message: "Expected a protobuf fixed32 value between 0 and 4294967295",
      }
    ),
  ],
  {
    identifier: $I`Fixed32Checks`,
    title: "Protobuf fixed32",
    description: "Checks for protobuf fixed32 values represented as JavaScript numbers.",
  }
);

/**
 * Branded schema for protobuf `fixed32` values.
 *
 * **Details**
 *
 * Protobufjs writes `fixed32` as four fixed bytes and exposes the JavaScript
 * value as a `number`.
 *
 * **Example** (Decode fixed32 number)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Fixed32 } from "@beep/schema/Fixed32"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Fixed32)(1024))
 * console.log(value) // 1024
 * ```
 *
 * @invariant Values are integers from 0 through 4294967295.
 * @category validation
 * @since 0.0.0
 */
export const Fixed32 = S.Finite.annotate({
  toArbitrary: () => (fc) => fc.integer({ min: fixed32Minimum, max: fixed32Maximum }),
})
  .check(Fixed32Checks)
  .pipe(
    S.brand("Fixed32"),
    $I.annoteSchema("Fixed32", {
      description: "A protobuf fixed32 number in the inclusive unsigned 32-bit range.",
    })
  );

/**
 * Type-level value inferred from {@link Fixed32}.
 *
 * **Example** (Narrow Fixed32 with is)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Fixed32 } from "@beep/schema/Fixed32"
 * import type { Fixed32 as Fixed32Value } from "@beep/schema/Fixed32"
 *
 * const input: unknown = 32
 * if (S.is(Fixed32)(input)) {
 *   const value: Fixed32Value = input
 *   console.log(value) // 32
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Fixed32 = typeof Fixed32.Type;
