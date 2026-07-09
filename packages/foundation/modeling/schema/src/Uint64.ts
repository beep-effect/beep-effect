/**
 * Branded schema for protobuf `uint64` integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

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

/**
 * Branded schema for protobuf `uint64` values.
 *
 * @remarks
 * Protobufjs writes `uint64` from `Long`, `number`, or decimal `string`
 * inputs. This schema represents the full protobuf range as `bigint` so values
 * above JavaScript's safe integer range are not silently narrowed before a
 * writer adapter converts them to a protobufjs-compatible representation.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Uint64 } from "@beep/schema/Uint64"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Uint64)(BigInt("18446744073709551615")))
 * console.log(value.toString()) // "18446744073709551615"
 * ```
 *
 * @invariant Values are bigints from 0 through 18446744073709551615.
 * @category validation
 * @since 0.0.0
 */
export const Uint64 = S.BigInt.annotate({
  toArbitrary: () => (fc) => fc.bigInt({ min: uint64Minimum, max: uint64Maximum }),
})
  .check(Uint64Range)
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
