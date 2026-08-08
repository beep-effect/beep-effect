/**
 * Effect AI layers and acquisition retry plans for the Anthropic provider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic";
import { Config, Duration, Effect, ExecutionPlan, Layer, Schedule } from "effect";
import { AiError } from "effect/unstable/ai";
import { FetchHttpClient } from "effect/unstable/http";
import {
  ANTHROPIC_API_KEY_ENV,
  ANTHROPIC_DEFAULT_MODEL,
  ANTHROPIC_DEFAULT_RETRY_ATTEMPTS,
  ANTHROPIC_DEFAULT_RETRY_BASE_DELAY_MILLIS,
  ANTHROPIC_MODEL_ENV,
  AnthropicLanguageModelOptions,
} from "./Anthropic.config.ts";

/**
 * Live Anthropic HTTP client layer backed by Effect Config and Fetch.
 *
 * **Example** (Live client layer type)
 *
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
 * **Details**
 *
 * `AnthropicLanguageModelOptions` owns the default `model` and `maxTokens`
 * values, so this helper only maps the schema-backed options to the provider
 * config names.
 *
 * **Example** (Layer from model options)
 *
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
 * Live language-model layer for the default Anthropic model.
 *
 * **Details**
 *
 * The model id resolves from `AI_ANTHROPIC_MODEL` at layer acquisition and
 * falls back to {@link ANTHROPIC_DEFAULT_MODEL} when the variable is unset.
 *
 * **Example** (Default model live layer)
 *
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
 * @effects
 * - Reads `AI_ANTHROPIC_MODEL` from Effect Config when the layer is acquired.
 * @category layers
 * @since 0.0.0
 */
export const AnthropicLanguageModelLive = Layer.unwrap(
  Config.nonEmptyString(ANTHROPIC_MODEL_ENV).pipe(
    Config.withDefault(ANTHROPIC_DEFAULT_MODEL),
    Effect.map((model) => makeAnthropicLanguageModelLayer(AnthropicLanguageModelOptions.make({ model })))
  )
);

/**
 * Build an acquisition-only execution plan for Anthropic turns.
 *
 * **Gotchas**
 *
 * Use this plan with `Stream.withExecutionPlan` or `Effect.withExecutionPlan`
 * at the caller boundary. The `while` predicate retries only `AiError`
 * failures marked retryable by Effect AI, so auth and invalid-request failures
 * fail fast.
 *
 * **Example** (Create turn execution plan)
 *
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
 * **Example** (Default turn plan value)
 *
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
