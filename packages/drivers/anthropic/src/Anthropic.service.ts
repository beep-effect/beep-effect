/**
 * Effect AI layers and acquisition retry plans for the Anthropic provider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic";
import { Config, Duration, ExecutionPlan, Layer, Schedule } from "effect";
import { AiError } from "effect/unstable/ai";
import { FetchHttpClient } from "effect/unstable/http";
import {
  ANTHROPIC_API_KEY_ENV,
  ANTHROPIC_DEFAULT_RETRY_ATTEMPTS,
  ANTHROPIC_DEFAULT_RETRY_BASE_DELAY_MILLIS,
  AnthropicLanguageModelOptions,
} from "./Anthropic.config.ts";

/**
 * Live Anthropic HTTP client layer backed by Effect Config and Fetch.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { AnthropicLive } from "@beep/anthropic"
 * import type { AnthropicClient } from "@effect/ai-anthropic"
 * import type { Config, Layer } from "effect"
 *
 * const layer: Layer.Layer<AnthropicClient.AnthropicClient, Config.ConfigError, never> =
 *   AnthropicLive
 *
 * strictEqual(typeof layer, "object")
 * ```
 *
 * @effects
 * - Reads `AI_ANTHROPIC_API_KEY` from Effect Config when the layer is acquired.
 * - Provides the Fetch HTTP client used by downstream Anthropic requests.
 *
 * @category layers
 * @since 0.0.0
 */
export const AnthropicLive: Layer.Layer<AnthropicClient.AnthropicClient, Config.ConfigError, never> =
  AnthropicClient.layerConfig({
    apiKey: Config.redacted(ANTHROPIC_API_KEY_ENV),
  }).pipe(Layer.provide(FetchHttpClient.layer));

/**
 * Build an Anthropic language-model layer from caller options plus package defaults.
 *
 * @remarks
 * `AnthropicLanguageModelOptions` owns the default `model` and `maxTokens`
 * values, so this helper only maps the schema-backed options to the provider
 * config names.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { AnthropicLanguageModelOptions, makeAnthropicLanguageModelLayer } from "@beep/anthropic"
 * import { PosInt } from "@beep/schema"
 *
 * const layer = makeAnthropicLanguageModelLayer(
 *   AnthropicLanguageModelOptions.make({
 *     maxTokens: PosInt.make(1024),
 *     model: "claude-opus-4-6",
 *   })
 * )
 *
 * strictEqual(typeof layer, "object")
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeAnthropicLanguageModelLayer = (
  options: AnthropicLanguageModelOptions = AnthropicLanguageModelOptions.make({})
) =>
  AnthropicLanguageModel.layer({
    config: { max_tokens: options.maxTokens },
    model: options.model,
  }).pipe(Layer.provide(AnthropicLive));

/**
 * Live language-model layer for the pinned Anthropic model.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { AnthropicLanguageModelLive } from "@beep/anthropic"
 * import type { Config, Layer } from "effect"
 * import type * as LanguageModel from "effect/unstable/ai/LanguageModel"
 *
 * const layer: Layer.Layer<LanguageModel.LanguageModel, Config.ConfigError, never> =
 *   AnthropicLanguageModelLive
 *
 * strictEqual(typeof layer, "object")
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const AnthropicLanguageModelLive = makeAnthropicLanguageModelLayer();

/**
 * Build an acquisition-only execution plan for Anthropic turns.
 *
 * @remarks
 * Use this plan with `Stream.withExecutionPlan` or `Effect.withExecutionPlan`
 * at the caller boundary. The `while` predicate retries only `AiError`
 * failures marked retryable by Effect AI, so auth and invalid-request failures
 * fail fast.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { makeAnthropicTurnPlan } from "@beep/anthropic"
 *
 * const plan = makeAnthropicTurnPlan()
 *
 * strictEqual(typeof plan, "object")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const makeAnthropicTurnPlan = () =>
  ExecutionPlan.make({
    attempts: ANTHROPIC_DEFAULT_RETRY_ATTEMPTS,
    provide: AnthropicLanguageModelLive,
    schedule: Schedule.exponential(Duration.millis(ANTHROPIC_DEFAULT_RETRY_BASE_DELAY_MILLIS), 2),
    while: (error: AiError.AiError | Config.ConfigError) => AiError.isAiError(error) && error.isRetryable,
  });

/**
 * Default Anthropic turn acquisition plan.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { AnthropicTurnPlan } from "@beep/anthropic"
 *
 * strictEqual(typeof AnthropicTurnPlan, "object")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const AnthropicTurnPlan = makeAnthropicTurnPlan();
