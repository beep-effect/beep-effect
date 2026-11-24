/**
 * ETH-denominated amount transported as a non-negative JSON number.
 *
 * **Details**
 *
 * Decodes into Effect `BigDecimal` for arithmetic safety.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import * as BigDecimal from "effect/BigDecimal";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import { $SchemaId } from "../internal/SchemaId.ts";

const $I = $SchemaId.create("EthAmount");

const EthAmountInputChecks = S.makeFilterGroup(
  [
    S.isGreaterThanOrEqualTo(
      0,
      $I.annote("EthAmountNonNegativeCheck", {
        title: "ETH Amount Non-Negative",
        description: "A non-negative ETH-denominated amount.",
        message: "EthAmount must be greater than or equal to 0",
      })
    ),
  ],
  $I.annote("EthAmountInputChecks", {
    title: "EthAmount",
    description: "Checks for non-negative finite ETH-denominated JSON numbers.",
  })
);

const EthAmountInput = S.Finite.pipe(
  S.check(EthAmountInputChecks),
  $I.annoteSchema("EthAmountInput", {
    description: "Finite non-negative JSON number accepted at ETH amount boundaries.",
  })
);

/**
 * **Example** (Decode ETH amount value)
 *
 * ```ts
 * import { EthAmount } from "@beep/schema/EthAmount"
 * import * as S from "effect/Schema"
 *
 * const amount = S.decodeUnknownSync(EthAmount)(1.5)
 * console.log(amount)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * **Example** (Type decoded ETH amount)
 *
 * ```ts
 * import { EthAmount } from "@beep/schema/EthAmount"
 * import * as S from "effect/Schema"
 *
 * const amount: EthAmount = S.decodeUnknownSync(EthAmount)(1.5)
 * console.log(amount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EthAmount = typeof EthAmount.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { EthAmount as Schema };
