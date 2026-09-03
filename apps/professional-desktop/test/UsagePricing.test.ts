import { ProviderUsageMetadata } from "@beep/agents-use-cases/public";
import { ANTHROPIC_DEFAULT_APPROXIMATE_PRICE } from "@beep/anthropic";
import { NonNegativeInt } from "@beep/schema/Number";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { approximateCostUsdMicros } from "@/chat/UsagePricing";

it.effect(
  "computes approximate micro-USD cost from the exact provider-model price row",
  Effect.fnUntraced(function* () {
    const usage = ProviderUsageMetadata.make({
      inputTokens: NonNegativeInt.make(2),
      model: ANTHROPIC_DEFAULT_APPROXIMATE_PRICE.model,
      outputTokens: NonNegativeInt.make(3),
      provider: "anthropic",
      stopReason: O.some("tool-calls"),
    });

    expect(O.getOrThrow(approximateCostUsdMicros(usage))).toBe(255);
  })
);

it.effect(
  "leaves cost absent when the provider-model pair has no price row",
  Effect.fnUntraced(function* () {
    const usage = ProviderUsageMetadata.make({
      inputTokens: NonNegativeInt.make(2),
      model: "unpriced-model",
      outputTokens: NonNegativeInt.make(3),
      provider: "anthropic",
      stopReason: O.none(),
    });

    expect(O.isNone(approximateCostUsdMicros(usage))).toBe(true);
  })
);
