/**
 * Service: LLM Provider Configuration
 *
 * **Details**
 *
 * Defines types and interfaces for configuring different LLM providers
 * (Anthropic, OpenAI, Google) with specific resilience settings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Schedule } from "effect";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Service/LlmProvider");

const PositiveInt = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("PositiveInt", {
    description: "Positive integer used for token capacities.",
  })
);

const RetrySchedule = S.declare<Schedule.Schedule<unknown, unknown, never>>(
  (input: unknown): input is Schedule.Schedule<unknown, unknown, never> => Schedule.isSchedule(input)
).pipe(
  $I.annoteSchema("RetrySchedule", {
    description: "Identity-preserving Effect retry schedule supplied by an LLM provider.",
  })
);

const CircuitBreakerConfig = S.Class<CircuitBreakerConfig>($I`CircuitBreakerConfig`)(
  {
    failureThreshold: PositiveInt,
    resetTimeout: S.Duration,
  },
  $I.annote("CircuitBreakerConfig", {
    description: "Failure threshold and reset delay for one provider circuit breaker.",
  })
);

interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly resetTimeout: S.Duration["Type"];
}

/**
 * Supported LLM providers.
 *
 * **Example** (Guard a provider identifier)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LlmProvider } from "@effect-ontology/Service/LlmProvider"
 *
 * console.log(S.is(LlmProvider)("anthropic")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LlmProvider = LiteralKit(["anthropic", "openai", "google"]).pipe(
  $I.annoteSchema("LlmProvider", {
    description: "Supported hosted language-model provider identifiers.",
  })
);

/**
 * Runtime value accepted by {@link LlmProvider}.
 *
 * @see {@link LlmProvider} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type LlmProvider = typeof LlmProvider.Type;

/**
 * Configuration parameters for an LLM provider.
 *
 * **Example** (Configure an Anthropic model)
 *
 * ```ts
 * import { Duration, Schedule } from "effect"
 * import { LlmProviderParams } from "@effect-ontology/Service/LlmProvider"
 *
 * const config = LlmProviderParams.make({
 *   provider: "anthropic",
 *   model: "claude-3-haiku",
 *   contextWindow: 200_000,
 *   maxOutputTokens: 4_096,
 *   timeout: Duration.seconds(30),
 *   retrySchedule: Schedule.recurs(3)
 * })
 * console.log(config.provider) // "anthropic"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class LlmProviderParams extends S.Class<LlmProviderParams>($I`LlmProviderParams`)(
  {
    provider: LlmProvider.annotateKey({ description: "Provider identifier." }),
    model: S.NonEmptyString.annotateKey({ description: "Provider-specific model identifier." }),
    contextWindow: PositiveInt.annotateKey({ description: "Context-window capacity in tokens." }),
    maxOutputTokens: PositiveInt.annotateKey({ description: "Maximum output-token capacity." }),
    timeout: S.Duration.annotateKey({ description: "Default API-call timeout." }),
    retrySchedule: RetrySchedule.pipe(S.optionalKey).annotateKey({
      description: "Optional retry schedule for transient provider failures.",
    }),
    circuitBreaker: CircuitBreakerConfig.pipe(S.optionalKey).annotateKey({
      description: "Optional provider circuit-breaker configuration.",
    }),
  },
  $I.annote("LlmProviderParams", {
    description: "Model, token, timeout, retry, and circuit-breaker settings for an LLM provider.",
  })
) {}
