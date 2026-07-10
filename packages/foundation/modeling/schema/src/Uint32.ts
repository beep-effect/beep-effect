/**
 * Branded schema for protobuf `uint32` numbers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Uint32");

const uint32Minimum = 0;
const uint32Maximum = 4_294_967_295;

const Uint32Checks = S.makeFilterGroup(
  [
    S.isInt({
      identifier: $I`Uint32IntegerCheck`,
      title: "Protobuf uint32 Integer",
      description: "A protobuf uint32 value must be an integer.",
      message: "Expected a protobuf uint32 integer",
    }),
    S.isBetween(
      {
        minimum: uint32Minimum,
        maximum: uint32Maximum,
      },
      {
        identifier: $I`Uint32RangeCheck`,
        title: "Protobuf uint32 Range",
        description: "A protobuf uint32 value must fit in the unsigned 32-bit integer range.",
        expected: "an unsigned 32-bit protobuf integer",
        message: "Expected a protobuf uint32 value between 0 and 4294967295",
      }
    ),
  ],
  {
    identifier: $I`Uint32Checks`,
    title: "Protobuf uint32",
    description: "Checks for protobuf uint32 values represented as JavaScript numbers.",
  }
);

/**
 * Branded schema for protobuf `uint32` values.
 *
 * @remarks
 * Protobufjs writes `uint32` as an unsigned 32-bit varint and exposes the
 * JavaScript value as a `number`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Uint32 } from "@beep/schema/Uint32"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Uint32)(4_294_967_295))
 * console.log(value) // 4294967295
 * ```
 *
 * @invariant Values are integers from 0 through 4294967295.
 * @category validation
 * @since 0.0.0
 */
export const Uint32 = S.Finite.annotate({
  toArbitrary: () => (fc) => fc.integer({ min: uint32Minimum, max: uint32Maximum }),
})
  .check(Uint32Checks)
  .pipe(
    S.brand("Uint32"),
    $I.annoteSchema("Uint32", {
      description: "A protobuf uint32 number in the inclusive unsigned 32-bit range.",
    })
  );

/**
 * Type-level value inferred from {@link Uint32}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Uint32 } from "@beep/schema/Uint32"
 * import type { Uint32 as Uint32Value } from "@beep/schema/Uint32"
 *
 * const input: unknown = 15
 * if (S.is(Uint32)(input)) {
 *   const value: Uint32Value = input
 *   console.log(value) // 15
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Uint32 = typeof Uint32.Type;
