/**
 * Branded schema for protobuf `fixed64` integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { decodeProtobufInt64InputTransformation, ProtobufInt64Input } from "./internal/ProtobufInt64Input.ts";

const $I = $SchemaId.create("Fixed64");

const fixed64Minimum = BigInt(0);
const fixed64Maximum = BigInt("18446744073709551615");

const Fixed64Range = S.isBetweenBigInt(
  {
    minimum: fixed64Minimum,
    maximum: fixed64Maximum,
  },
  {
    identifier: $I`Fixed64RangeCheck`,
    title: "Protobuf fixed64 Range",
    description: "A protobuf fixed64 value must fit in the unsigned 64-bit fixed-width range.",
    expected: "an unsigned fixed-width 64-bit protobuf integer",
    message: "Expected a protobuf fixed64 value between 0 and 18446744073709551615",
  }
);

const Fixed64BigInt = S.BigInt.check(Fixed64Range);

/**
 * Branded schema for protobuf `fixed64` values.
 *
 * **Details**
 *
 * Protobufjs writes and can expose `fixed64` as eight fixed bytes from `Long`,
 * `number`, decimal `string`, or `bigint` values. This schema accepts those
 * protobufjs-compatible input shapes and normalizes them to `bigint` before
 * enforcing the unsigned fixed-width 64-bit range.
 *
 * **Example** (Decode fixed64 from string)
 *
 * ```ts import.meta.vitest name="Decode fixed64 from string"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Fixed64 } from "@beep/schema/Fixed64"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Fixed64)("18446744073709551615"))
 * value.toString() // => "18446744073709551615"
 * ```
 *
 * @invariant Values are bigints from 0 through 18446744073709551615.
 * @category validation
 * @since 0.0.0
 */
export const Fixed64 = ProtobufInt64Input.pipe(S.decodeTo(Fixed64BigInt, decodeProtobufInt64InputTransformation))
  .annotate({
    toArbitrary: () => (fc) => fc.bigInt({ min: fixed64Minimum, max: fixed64Maximum }),
  })
  .pipe(
    S.brand("Fixed64"),
    $I.annoteSchema("Fixed64", {
      description: "A protobuf fixed64 bigint in the inclusive unsigned 64-bit range.",
    })
  );

/**
 * Type-level value inferred from {@link Fixed64}.
 *
 * **Example** (Narrow Fixed64 with is)
 *
 * ```ts import.meta.vitest name="Narrow Fixed64 with is"
 * import * as S from "effect/Schema"
 * import { Fixed64 } from "@beep/schema/Fixed64"
 * import type { Fixed64 as Fixed64Value } from "@beep/schema/Fixed64"
 *
 * const input: unknown = BigInt(64)
 * if (S.is(Fixed64)(input)) {
 *   const value: Fixed64Value = input
 *   value.toString() // => "64"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Fixed64 = typeof Fixed64.Type;
