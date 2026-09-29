/**
 * Shared numeric refinements for GovInfo value models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $GovinfoId.create("domain/values/GovinfoNumeric");

/**
 * Non-negative signed 64-bit integer reported by GovInfo count fields.
 *
 * **Details**
 *
 * A `bigint` held to the signed int64 range, then to zero or more.
 *
 * **Example** (Decode BigInt count value)
 *
 * ```ts
 * import { NonNegativeInt64 } from "@beep/govinfo/domain/values/GovinfoNumeric"
 * import * as S from "effect/Schema"
 *
 * const count = S.decodeUnknownSync(NonNegativeInt64)(BigInt(42))
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NonNegativeInt64 = S.BigInt.check(
  S.isBetweenBigInt({ minimum: BigInt("-9223372036854775808"), maximum: BigInt("9223372036854775807") }),
  S.isGreaterThanOrEqualToBigInt(BigInt(0), {
    description: "A non-negative signed 64-bit integer.",
    identifier: $I`NonNegativeInt64MinimumCheck`,
    message: "Expected a non-negative signed 64-bit integer",
    title: "Non-negative signed 64-bit integer",
  })
).pipe(
  $I.annoteSchema("NonNegativeInt64", {
    description: "Non-negative signed 64-bit integer reported by GovInfo count fields.",
  })
);

/**
 * Type for {@link NonNegativeInt64}.
 *
 * **Example** (Type-annotated NonNegativeInt64 decode)
 *
 * ```ts
 * import { NonNegativeInt64 } from "@beep/govinfo/domain/values/GovinfoNumeric"
 * import type { NonNegativeInt64 as NonNegativeInt64Value } from "@beep/govinfo/domain/values/GovinfoNumeric"
 * import * as S from "effect/Schema"
 *
 * const count: NonNegativeInt64Value = S.decodeUnknownSync(NonNegativeInt64)(BigInt(1))
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonNegativeInt64 = typeof NonNegativeInt64.Type;
