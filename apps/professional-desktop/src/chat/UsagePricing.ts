/**
 * Approximate per-model pricing used for finalized desktop chat usage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ANTHROPIC_DEFAULT_APPROXIMATE_PRICE } from "@beep/anthropic";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema/Number";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { ProviderUsageMetadata } from "@beep/agents-use-cases/public";

const $I = $ProfessionalDesktopId.create("chat/UsagePricing");
const TokenPriceUsd = S.Finite.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`TokenPriceUsdNonNegativeCheck`,
    title: "Token Price USD Non Negative",
    description: "An approximate USD price per million tokens must be zero or greater.",
    message: "Expected a non-negative token price",
  })
).pipe(
  $I.annoteSchema("TokenPriceUsd", {
    description: "Approximate USD price per million tokens used for product attribution.",
  })
);

// One static approximate provider-model price row (module-internal: the public
// surface is approximateCostUsdMicros; the table itself is private data).
class ApproximateModelPrice extends S.Class<ApproximateModelPrice>($I`ApproximateModelPrice`)(
  {
    inputPerMillionTokensUsd: TokenPriceUsd.annotateKey({
      description: "Approximate USD price per million input tokens.",
    }),
    model: S.NonEmptyString.annotateKey({ description: "Provider model identifier." }),
    outputPerMillionTokensUsd: TokenPriceUsd.annotateKey({
      description: "Approximate USD price per million output tokens.",
    }),
    provider: S.NonEmptyString.annotateKey({ description: "Provider identifier." }),
  },
  $I.annote("ApproximateModelPrice", {
    description: "Static approximate provider-model price used for desktop chat usage attribution.",
  })
) {
  /**
   * Small data-only pricing table. Rates are approximate USD per million
   * tokens; update these literals when the configured production model or
   * published provider pricing changes.
   */
  static readonly table: ReadonlyArray<ApproximateModelPrice> = [
    ApproximateModelPrice.make({
      inputPerMillionTokensUsd: ANTHROPIC_DEFAULT_APPROXIMATE_PRICE.inputPerMillionTokensUsd,
      model: ANTHROPIC_DEFAULT_APPROXIMATE_PRICE.model,
      outputPerMillionTokensUsd: ANTHROPIC_DEFAULT_APPROXIMATE_PRICE.outputPerMillionTokensUsd,
      provider: "anthropic",
    }),
    ApproximateModelPrice.make({
      inputPerMillionTokensUsd: 0,
      model: "fixture",
      outputPerMillionTokensUsd: 0,
      provider: "fixture",
    }),
  ];

  /**
   * The price row for a `(model, provider)` pair, when one is known.
   */
  static readonly forUsage = (usage: {
    readonly model: string;
    readonly provider: string;
  }): O.Option<ApproximateModelPrice> =>
    A.findFirst(
      ApproximateModelPrice.table,
      P.Struct({
        model: Eq.equals(usage.model),
        provider: Eq.equals(usage.provider),
      })
    );
}

/**
 * Compute approximate micro-USD cost for provider usage when its exact model
 * has a price row. One USD per million tokens equals one micro-USD per token.
 * Unknown models intentionally return `None` instead of guessing.
 *
 * **Example** (Compute cost for fixture usage)
 *
 * ```ts
 * import { approximateCostUsdMicros } from "@/chat/UsagePricing"
 * import { ProviderUsageMetadata } from "@beep/agents-use-cases/public"
 * import { NonNegativeInt } from "@beep/schema/Number";
 * import * as O from "effect/Option"
 *
 * const cost = approximateCostUsdMicros(ProviderUsageMetadata.make({
 *   inputTokens: NonNegativeInt.make(1),
 *   model: "fixture",
 *   outputTokens: NonNegativeInt.make(1),
 *   provider: "fixture",
 *   stopReason: O.none()
 * }))
 * console.log(O.getOrThrow(cost)) // 0
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const approximateCostUsdMicros = (usage: ProviderUsageMetadata): O.Option<NonNegativeInt> =>
  O.map(ApproximateModelPrice.forUsage(usage), (price) =>
    NonNegativeInt.make(
      N.round(
        N.sum(
          N.multiply(usage.inputTokens, price.inputPerMillionTokensUsd),
          N.multiply(usage.outputTokens, price.outputPerMillionTokensUsd)
        ),
        0
      )
    )
  );
