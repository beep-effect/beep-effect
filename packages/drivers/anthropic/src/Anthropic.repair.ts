/**
 * Product-neutral Anthropic forced-tool repair utilities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PosInt } from "@beep/schema";
import { Duration, Effect, ExecutionPlan, Schedule, Stream } from "effect";
import * as Str from "effect/String";
import { AiError, LanguageModel } from "effect/unstable/ai";
import { AnthropicLanguageModelOptions } from "./Anthropic.config.ts";
import { RepairError } from "./Anthropic.errors.ts";
import { makeAnthropicLanguageModelLayer } from "./Anthropic.service.ts";
import type { Config } from "effect";
import type { Response, Tool, Toolkit } from "effect/unstable/ai";
import type { GenerateTextOptions } from "effect/unstable/ai/LanguageModel";

/**
 * Small Claude model used for forced-tool repair calls.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ANTHROPIC_REPAIR_MODEL, AnthropicLanguageModelOptions } from "@beep/anthropic"
 *
 * const repairOptions = AnthropicLanguageModelOptions.make({
 *   model: ANTHROPIC_REPAIR_MODEL,
 * })
 *
 * strictEqual(repairOptions.model, "claude-haiku-4-5")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ANTHROPIC_REPAIR_MODEL = "claude-haiku-4-5" as const;

/**
 * Maximum output-token budget used for repair calls.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ANTHROPIC_REPAIR_MAX_TOKENS, AnthropicLanguageModelOptions } from "@beep/anthropic"
 * import { PosInt } from "@beep/schema"
 *
 * const repairOptions = AnthropicLanguageModelOptions.make({
 *   maxTokens: PosInt.make(ANTHROPIC_REPAIR_MAX_TOKENS),
 * })
 *
 * strictEqual(repairOptions.maxTokens, 4096)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ANTHROPIC_REPAIR_MAX_TOKENS = 4096 as const;

/**
 * Maximum acquisition attempts used by the repair execution plan.
 *
 * @example
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { ANTHROPIC_REPAIR_ATTEMPTS, ANTHROPIC_REPAIR_RETRY_BASE_DELAY_MILLIS } from "@beep/anthropic"
 *
 * const repairBackoffMillis = Array.from(
 *   { length: ANTHROPIC_REPAIR_ATTEMPTS },
 *   (_, attempt) => ANTHROPIC_REPAIR_RETRY_BASE_DELAY_MILLIS * 2 ** attempt
 * )
 *
 * deepStrictEqual(repairBackoffMillis, [250, 500])
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ANTHROPIC_REPAIR_ATTEMPTS = 2 as const;

/**
 * Initial delay, in milliseconds, for repair-call acquisition retries.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ANTHROPIC_REPAIR_RETRY_BASE_DELAY_MILLIS } from "@beep/anthropic"
 *
 * const secondRepairDelayMillis = ANTHROPIC_REPAIR_RETRY_BASE_DELAY_MILLIS * 2
 *
 * strictEqual(secondRepairDelayMillis, 500)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ANTHROPIC_REPAIR_RETRY_BASE_DELAY_MILLIS = 250 as const;

const toRepairError =
  (operation: string) =>
  (error: AiError.AiError | Config.ConfigError): RepairError =>
    RepairError.make({ message: error.message, operation });

/**
 * Build the Anthropic repair-call execution plan with repair-specific defaults.
 *
 * @remarks
 * The plan retries only retryable Effect AI provider failures and supplies a
 * repair-sized language-model layer; callers do not need to provide
 * `LanguageModel` separately.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { AnthropicLanguageModelOptions, makeAnthropicRepairPlan } from "@beep/anthropic"
 * import { PosInt } from "@beep/schema"
 *
 * const plan = makeAnthropicRepairPlan(
 *   AnthropicLanguageModelOptions.make({
 *     maxTokens: PosInt.make(2048),
 *     model: "claude-haiku-4-5",
 *   })
 * )
 *
 * strictEqual(typeof plan, "object")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const makeAnthropicRepairPlan = (
  options: AnthropicLanguageModelOptions = AnthropicLanguageModelOptions.make({
    maxTokens: PosInt.make(ANTHROPIC_REPAIR_MAX_TOKENS),
    model: ANTHROPIC_REPAIR_MODEL,
  })
) =>
  ExecutionPlan.make({
    attempts: ANTHROPIC_REPAIR_ATTEMPTS,
    provide: makeAnthropicLanguageModelLayer(options),
    schedule: Schedule.exponential(Duration.millis(ANTHROPIC_REPAIR_RETRY_BASE_DELAY_MILLIS), 2),
    while: (error: AiError.AiError | Config.ConfigError) => AiError.isAiError(error) && error.isRetryable,
  });

/**
 * Collect streamed forced-tool params into one JSON string.
 *
 * @remarks
 * Collection stops at the first `tool-params-end` part; later deltas are
 * ignored so callers can feed the result directly to a schema decoder.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { collectToolParamsJson } from "@beep/anthropic"
 * import { Effect, Stream } from "effect"
 * import { Response } from "effect/unstable/ai"
 *
 * const json = Effect.runSync(
 *   collectToolParamsJson(
 *     Stream.make(
 *       Response.makePart("tool-params-delta", { delta: "{\"answer\":", id: "repair" }),
 *       Response.makePart("tool-params-delta", { delta: "42}", id: "repair" }),
 *       Response.makePart("tool-params-end", { id: "repair" }),
 *       Response.makePart("tool-params-delta", { delta: "ignored", id: "repair" })
 *     )
 *   )
 * )
 *
 * strictEqual(json, "{\"answer\":42}")
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const collectToolParamsJson = <Tools extends Record<string, Tool.Any>, E, R>(
  parts: Stream.Stream<Response.StreamPart<Tools>, E, R>
): Effect.Effect<string, E, R> =>
  parts.pipe(
    Stream.takeUntil((part) => part.type === "tool-params-end"),
    Stream.flatMap((part) => (part.type === "tool-params-delta" ? Stream.succeed(part.delta) : Stream.empty)),
    Stream.runFold(() => "", Str.concat)
  );

/**
 * Run a forced-tool Anthropic call and return the streamed tool-params JSON.
 *
 * @remarks
 * This uses `streamText` and consumes the tool params whole because the
 * non-streaming tool-use path is unsafe for the currently pinned Effect AI
 * Anthropic provider.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { generateAnthropicToolJson } from "@beep/anthropic"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Tool, Toolkit } from "effect/unstable/ai"
 *
 * const RepairTool = Tool.make("repair", {
 *   description: "Return a corrected JSON object.",
 *   parameters: S.Struct({ issue: S.String }),
 *   success: S.String,
 * }).annotate(Tool.Strict, false)
 *
 * const program = generateAnthropicToolJson({
 *   prompt: "Fix the malformed JSON.",
 *   toolChoice: { tool: "repair" },
 *   toolkit: Toolkit.make(RepairTool),
 * }).pipe(
 *   Effect.catchTag("RepairError", (error) => Effect.succeed(error.message))
 * )
 *
 * strictEqual(typeof program, "object")
 * ```
 *
 * @effects
 * - Runs a streamed Anthropic language-model request when the returned Effect is executed.
 * - Consumes tool-parameter deltas until the provider emits `tool-params-end`.
 *
 * @category combinators
 * @since 0.0.0
 */
export const generateAnthropicToolJson = <Tools extends Record<string, Tool.Any>>(
  options: GenerateTextOptions<Tools> & { readonly toolkit: Toolkit.Toolkit<Tools> }
): Effect.Effect<string, RepairError> =>
  LanguageModel.streamText({
    ...options,
    disableToolCallResolution: true,
  }).pipe(
    Stream.withExecutionPlan(makeAnthropicRepairPlan(), { preventFallbackOnPartialStream: true }),
    collectToolParamsJson,
    Effect.mapError(toRepairError("generate_tool_json"))
  );
