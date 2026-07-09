/**
 * Branded schema for protobuf `sfixed64` integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Sfixed64");

const sfixed64Minimum = -BigInt("9223372036854775808");
const sfixed64Maximum = BigInt("9223372036854775807");

const Sfixed64Range = S.isBetweenBigInt(
  {
    minimum: sfixed64Minimum,
    maximum: sfixed64Maximum,
  },
  {
    identifier: $I`Sfixed64RangeCheck`,
    title: "Protobuf sfixed64 Range",
    description: "A protobuf sfixed64 value must fit in the signed 64-bit fixed-width range.",
    expected: "a signed fixed-width 64-bit protobuf integer",
    message: "Expected a protobuf sfixed64 value between -9223372036854775808 and 9223372036854775807",
  }
);

/**
 * Branded schema for protobuf `sfixed64` values.
 *
 * @remarks
 * Protobufjs writes `sfixed64` as eight fixed bytes from `Long`, `number`, or
 * decimal `string` inputs. This schema represents the full protobuf range as
 * `bigint` so values above JavaScript's safe integer range are not silently
 * narrowed before a writer adapter converts them.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Sfixed64 } from "@beep/schema/Sfixed64"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Sfixed64)(-BigInt("9223372036854775808")))
 * console.log(value.toString()) // "-9223372036854775808"
 * ```
 *
 * @invariant Values are bigints from -9223372036854775808 through 9223372036854775807.
 * @category validation
 * @since 0.0.0
 */
export const Sfixed64 = S.BigInt.annotate({
  toArbitrary: () => (fc) => fc.bigInt({ min: sfixed64Minimum, max: sfixed64Maximum }),
})
  .check(Sfixed64Range)
  .pipe(
    S.brand("Sfixed64"),
    $I.annoteSchema("Sfixed64", {
      description: "A protobuf sfixed64 bigint in the inclusive signed 64-bit range.",
    })
  );

/**
 * Type-level value inferred from {@link Sfixed64}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Sfixed64 } from "@beep/schema/Sfixed64"
 * import type { Sfixed64 as Sfixed64Value } from "@beep/schema/Sfixed64"
 *
 * const input: unknown = -BigInt(64)
 * if (S.is(Sfixed64)(input)) {
 *   const value: Sfixed64Value = input
 *   console.log(value.toString()) // "-64"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Sfixed64 = typeof Sfixed64.Type;
