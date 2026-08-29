/**
 * Branded schema for protobuf `sfixed32` numbers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Sfixed32");

const sfixed32Minimum = -2_147_483_648;
const sfixed32Maximum = 2_147_483_647;

const Sfixed32Checks = S.makeFilterGroup(
  [
    S.isInt({
      identifier: $I`Sfixed32IntegerCheck`,
      title: "Protobuf sfixed32 Integer",
      description: "A protobuf sfixed32 value must be an integer.",
      message: "Expected a protobuf sfixed32 integer",
    }),
    S.isBetween(
      {
        minimum: sfixed32Minimum,
        maximum: sfixed32Maximum,
      },
      {
        identifier: $I`Sfixed32RangeCheck`,
        title: "Protobuf sfixed32 Range",
        description: "A protobuf sfixed32 value must fit in the signed 32-bit fixed-width range.",
        expected: "a signed fixed-width 32-bit protobuf integer",
        message: "Expected a protobuf sfixed32 value between -2147483648 and 2147483647",
      }
    ),
  ],
  {
    identifier: $I`Sfixed32Checks`,
    title: "Protobuf sfixed32",
    description: "Checks for protobuf sfixed32 values represented as JavaScript numbers.",
  }
);

/**
 * Branded schema for protobuf `sfixed32` values.
 *
 * **Details**
 *
 * Protobufjs writes `sfixed32` as four fixed bytes and exposes the JavaScript
 * value as a `number`.
 *
 * **Example** (Decode negative sfixed32 value)
 *
 * ```ts import.meta.vitest name="Decode negative sfixed32 value"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Sfixed32 } from "@beep/schema/Sfixed32"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Sfixed32)(-1024))
 * value // => -1024
 * ```
 *
 * @invariant Values are integers from -2147483648 through 2147483647.
 * @category validation
 * @since 0.0.0
 */
export const Sfixed32 = S.Finite.annotate({
  toArbitrary: () => (fc) => fc.integer({ min: sfixed32Minimum, max: sfixed32Maximum }),
})
  .check(Sfixed32Checks)
  .pipe(
    S.brand("Sfixed32"),
    $I.annoteSchema("Sfixed32", {
      description: "A protobuf sfixed32 number in the inclusive signed 32-bit range.",
    })
  );

/**
 * Type-level value inferred from {@link Sfixed32}.
 *
 * **Example** (Narrow unknown to Sfixed32)
 *
 * ```ts import.meta.vitest name="Narrow unknown to Sfixed32"
 * import * as S from "effect/Schema"
 * import { Sfixed32 } from "@beep/schema/Sfixed32"
 * import type { Sfixed32 as Sfixed32Value } from "@beep/schema/Sfixed32"
 *
 * const input: unknown = -32
 * if (S.is(Sfixed32)(input)) {
 *   const value: Sfixed32Value = input
 *   value // => -32
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Sfixed32 = typeof Sfixed32.Type;
