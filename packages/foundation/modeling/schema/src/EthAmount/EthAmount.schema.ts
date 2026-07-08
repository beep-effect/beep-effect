/**
 * ETH-denominated amount transported as a non-negative JSON number.
 *
 * Decodes into Effect `BigDecimal` for arithmetic safety.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { BigDecimal, SchemaGetter } from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("EthAmount");

const EthAmountInputChecks = S.makeFilterGroup(
  [
    S.isGreaterThanOrEqualTo(0).annotate({
      identifier: $I`EthAmountNonNegativeCheck`,
      title: "ETH Amount Non-Negative",
      description: "A non-negative ETH-denominated amount.",
      message: "EthAmount must be greater than or equal to 0",
    }),
  ],
  {
    identifier: $I`EthAmountInputChecks`,
    title: "EthAmount",
    description: "Checks for non-negative finite ETH-denominated JSON numbers.",
  }
);

const EthAmountInput = S.Finite.pipe(
  S.check(EthAmountInputChecks),
  $I.annoteSchema("EthAmountInput", {
    description: "Finite non-negative JSON number accepted at ETH amount boundaries.",
  })
);

/**
 * ETH-denominated amount decoded from a non-negative JSON number into Effect
 * `BigDecimal`.
 *
 * @example
 * ```ts
 * import { EthAmount } from "@beep/schema/EthAmount"
 * import * as S from "effect/Schema"
 *
 * const amount = S.decodeUnknownSync(EthAmount)(1.5)
 * console.log(amount)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const EthAmount = EthAmountInput.pipe(
  S.decodeTo(S.BigDecimal, {
    decode: SchemaGetter.transform(BigDecimal.fromNumberUnsafe),
    encode: SchemaGetter.transform(BigDecimal.toNumberUnsafe),
  }),
  $I.annoteSchema("EthAmount", {
    description: "ETH-denominated amount decoded from a non-negative JSON number into Effect BigDecimal.",
  })
);

/**
 * Type for {@link EthAmount}.
 *
 * @example
 * ```ts
 * import { EthAmount } from "@beep/schema/EthAmount"
 * import * as S from "effect/Schema"
 *
 * const amount: EthAmount = S.decodeUnknownSync(EthAmount)(1.5)
 * console.log(amount)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EthAmount = typeof EthAmount.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { EthAmount as Schema };
