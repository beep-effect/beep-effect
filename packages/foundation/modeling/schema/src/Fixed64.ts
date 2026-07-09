/**
 * Branded schema for protobuf `fixed64` integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

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

/**
 * Branded schema for protobuf `fixed64` values.
 *
 * @remarks
 * Protobufjs writes `fixed64` as eight fixed bytes from `Long`, `number`, or
 * decimal `string` inputs. This schema represents the full protobuf range as
 * `bigint` so values above JavaScript's safe integer range are not silently
 * narrowed before a writer adapter converts them.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Fixed64 } from "@beep/schema/Fixed64"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Fixed64)(BigInt("18446744073709551615")))
 * console.log(value.toString()) // "18446744073709551615"
 * ```
 *
 * @invariant Values are bigints from 0 through 18446744073709551615.
 * @category validation
 * @since 0.0.0
 */
export const Fixed64 = S.BigInt.annotate({
  toArbitrary: () => (fc) => fc.bigInt({ min: fixed64Minimum, max: fixed64Maximum }),
})
  .check(Fixed64Range)
  .pipe(
    S.brand("Fixed64"),
    $I.annoteSchema("Fixed64", {
      description: "A protobuf fixed64 bigint in the inclusive unsigned 64-bit range.",
    })
  );

/**
 * Type-level value inferred from {@link Fixed64}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Fixed64 } from "@beep/schema/Fixed64"
 * import type { Fixed64 as Fixed64Value } from "@beep/schema/Fixed64"
 *
 * const input: unknown = BigInt(64)
 * if (S.is(Fixed64)(input)) {
 *   const value: Fixed64Value = input
 *   console.log(value.toString()) // "64"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Fixed64 = typeof Fixed64.Type;
