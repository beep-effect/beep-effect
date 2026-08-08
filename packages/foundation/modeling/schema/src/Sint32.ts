/**
 * Branded schema for protobuf `sint32` numbers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Sint32");

const sint32Minimum = -2_147_483_648;
const sint32Maximum = 2_147_483_647;

const Sint32Checks = S.makeFilterGroup(
  [
    S.isInt({
      identifier: $I`Sint32IntegerCheck`,
      title: "Protobuf sint32 Integer",
      description: "A protobuf sint32 value must be an integer.",
      message: "Expected a protobuf sint32 integer",
    }),
    S.isBetween(
      {
        minimum: sint32Minimum,
        maximum: sint32Maximum,
      },
      {
        identifier: $I`Sint32RangeCheck`,
        title: "Protobuf sint32 Range",
        description: "A protobuf sint32 value must fit in the signed 32-bit integer range.",
        expected: "a signed 32-bit protobuf integer",
        message: "Expected a protobuf sint32 value between -2147483648 and 2147483647",
      }
    ),
  ],
  {
    identifier: $I`Sint32Checks`,
    title: "Protobuf sint32",
    description: "Checks for protobuf sint32 values represented as JavaScript numbers.",
  }
);

/**
 * Branded schema for protobuf `sint32` values.
 *
 * **Details**
 *
 * Protobufjs writes `sint32` as a zig-zag encoded 32-bit varint and exposes the
 * JavaScript value as a `number`.
 *
 * **Example** (Decode negative sint32 value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Sint32 } from "@beep/schema/Sint32"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Sint32)(-1))
 * console.log(value) // -1
 * ```
 *
 * @invariant Values are integers from -2147483648 through 2147483647.
 * @category validation
 * @since 0.0.0
 */
export const Sint32 = S.Finite.annotate({
  toArbitrary: () => (fc) => fc.integer({ min: sint32Minimum, max: sint32Maximum }),
})
  .check(Sint32Checks)
  .pipe(
    S.brand("Sint32"),
    $I.annoteSchema("Sint32", {
      description: "A protobuf sint32 number in the inclusive signed 32-bit range.",
    })
  );

/**
 * Type-level value inferred from {@link Sint32}.
 *
 * **Example** (Narrow unknown to Sint32)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Sint32 } from "@beep/schema/Sint32"
 * import type { Sint32 as Sint32Value } from "@beep/schema/Sint32"
 *
 * const input: unknown = -8
 * if (S.is(Sint32)(input)) {
 *   const value: Sint32Value = input
 *   console.log(value) // -8
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Sint32 = typeof Sint32.Type;
