/**
 * Branded schema for protobuf `sint64` integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { decodeProtobufInt64InputTransformation, ProtobufInt64Input } from "./internal/ProtobufInt64Input.ts";

const $I = $SchemaId.create("Sint64");

const sint64Minimum = -BigInt("9223372036854775808");
const sint64Maximum = BigInt("9223372036854775807");

const Sint64Range = S.isBetweenBigInt(
  {
    minimum: sint64Minimum,
    maximum: sint64Maximum,
  },
  {
    identifier: $I`Sint64RangeCheck`,
    title: "Protobuf sint64 Range",
    description: "A protobuf sint64 value must fit in the signed 64-bit integer range.",
    expected: "a signed 64-bit protobuf integer",
    message: "Expected a protobuf sint64 value between -9223372036854775808 and 9223372036854775807",
  }
);

const Sint64BigInt = S.BigInt.check(Sint64Range);

/**
 * Branded schema for protobuf `sint64` values.
 *
 * **Details**
 *
 * Protobufjs writes and can expose `sint64` as a zig-zag encoded 64-bit varint
 * from `Long`, `number`, decimal `string`, or `bigint` values. This schema
 * accepts those protobufjs-compatible input shapes and normalizes them to
 * `bigint` before enforcing the signed 64-bit range.
 *
 * **Example** (Decode minimum sint64 string)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Sint64 } from "@beep/schema/Sint64"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Sint64)("-9223372036854775808"))
 * console.log(value.toString()) // "-9223372036854775808"
 * ```
 *
 * @invariant Values are bigints from -9223372036854775808 through 9223372036854775807.
 * @category validation
 * @since 0.0.0
 */
export const Sint64 = ProtobufInt64Input.pipe(S.decodeTo(Sint64BigInt, decodeProtobufInt64InputTransformation))
  .annotate({
    toArbitrary: () => (fc) => fc.bigInt({ min: sint64Minimum, max: sint64Maximum }),
  })
  .pipe(
    S.brand("Sint64"),
    $I.annoteSchema("Sint64", {
      description: "A protobuf sint64 bigint in the inclusive signed 64-bit range.",
    })
  );

/**
 * Type-level value inferred from {@link Sint64}.
 *
 * **Example** (Narrow unknown to Sint64)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Sint64 } from "@beep/schema/Sint64"
 * import type { Sint64 as Sint64Value } from "@beep/schema/Sint64"
 *
 * const input: unknown = -BigInt(42)
 * if (S.is(Sint64)(input)) {
 *   const value: Sint64Value = input
 *   console.log(value.toString()) // "-42"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Sint64 = typeof Sint64.Type;
