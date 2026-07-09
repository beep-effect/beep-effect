/**
 * Branded schema for protobuf `uint64` integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { decodeProtobufInt64InputTransformation, ProtobufInt64Input } from "./internal/ProtobufInt64Input.ts";

const $I = $SchemaId.create("Uint64");

const uint64Minimum = BigInt(0);
const uint64Maximum = BigInt("18446744073709551615");

const Uint64Range = S.isBetweenBigInt(
  {
    minimum: uint64Minimum,
    maximum: uint64Maximum,
  },
  {
    identifier: $I`Uint64RangeCheck`,
    title: "Protobuf uint64 Range",
    description: "A protobuf uint64 value must fit in the unsigned 64-bit integer range.",
    expected: "an unsigned 64-bit protobuf integer",
    message: "Expected a protobuf uint64 value between 0 and 18446744073709551615",
  }
);

const Uint64BigInt = S.BigInt.check(Uint64Range);

/**
 * Branded schema for protobuf `uint64` values.
 *
 * @remarks
 * Protobufjs writes and can expose `uint64` from `Long`, `number`, decimal
 * `string`, or `bigint` values. This schema accepts those protobufjs-compatible
 * input shapes and normalizes them to `bigint` before enforcing the unsigned
 * 64-bit range.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Uint64 } from "@beep/schema/Uint64"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Uint64)("18446744073709551615"))
 * console.log(value.toString()) // "18446744073709551615"
 * ```
 *
 * @invariant Values are bigints from 0 through 18446744073709551615.
 * @category validation
 * @since 0.0.0
 */
export const Uint64 = ProtobufInt64Input.pipe(S.decodeTo(Uint64BigInt, decodeProtobufInt64InputTransformation))
  .annotate({
    toArbitrary: () => (fc) => fc.bigInt({ min: uint64Minimum, max: uint64Maximum }),
  })
  .pipe(
    S.brand("Uint64"),
    $I.annoteSchema("Uint64", {
      description: "A protobuf uint64 bigint in the inclusive unsigned 64-bit range.",
    })
  );

/**
 * Type-level value inferred from {@link Uint64}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Uint64 } from "@beep/schema/Uint64"
 * import type { Uint64 as Uint64Value } from "@beep/schema/Uint64"
 *
 * const input: unknown = BigInt(42)
 * if (S.is(Uint64)(input)) {
 *   const value: Uint64Value = input
 *   console.log(value.toString()) // "42"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Uint64 = typeof Uint64.Type;
