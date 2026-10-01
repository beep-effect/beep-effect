import { ProviderUsageMetadata } from "@beep/agents-use-cases/public";
import { ANTHROPIC_DEFAULT_APPROXIMATE_PRICE } from "@beep/anthropic";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { approximateCostUsdMicros } from "@/chat/UsagePricing";

it.effect(
  "computes approximate micro-USD cost from the exact provider-model price row",
  Effect.fnUntraced(function* () {
    const usage = ProviderUsageMetadata.make({
      inputTokens: S.Natural.make(2),
      model: ANTHROPIC_DEFAULT_APPROXIMATE_PRICE.model,
      outputTokens: S.Natural.make(3),
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
      inputTokens: S.Natural.make(2),
      model: "unpriced-model",
      outputTokens: S.Natural.make(3),
      provider: "anthropic",
      stopReason: O.none(),
    });

    assertNone(approximateCostUsdMicros(usage));
  })
);
