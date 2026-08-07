/**
 * Product-neutral Anthropic forced-tool repair utilities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AnthropicId } from "@beep/identity";
import { PosInt } from "@beep/schema";
import { Duration, Effect, ExecutionPlan, pipe, Schedule, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AiError, LanguageModel, Response } from "effect/unstable/ai";
import { AnthropicLanguageModelOptions } from "./Anthropic.config.ts";
import { RepairError } from "./Anthropic.errors.ts";
import { makeAnthropicLanguageModelLayer } from "./Anthropic.service.ts";
import type { Config } from "effect";
import type { Tool, Toolkit } from "effect/unstable/ai";
import type { GenerateTextOptions } from "effect/unstable/ai/LanguageModel";

const $I = $AnthropicId.create("Anthropic.repair");

/**
 * Small Claude model used for forced-tool repair calls.
 *
 * **Example** (Configure repair model option)
 *
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
 * **Example** (Set repair max tokens)
 *
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
 * **Example** (Build exponential backoff delays)
 *
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
 * **Example** (Compute second retry delay)
 *
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
 * **Details**
 *
 * The plan retries only retryable Effect AI provider failures and supplies a
 * repair-sized language-model layer; callers do not need to provide
 * `LanguageModel` separately.
 *
 * **Example** (Create plan with options)
 *
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
 * **Details**
 *
 * Collection stops at the first `tool-params-end` part; later deltas are
 * ignored so callers can feed the result directly to a schema decoder.
 *
 * **Example** (Collect streamed tool params)
 *
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
 * Tool-parameter JSON plus provider-reported usage from one Anthropic repair call.
 *
 * **Example** (Make tool JSON response)
 *
 * ```ts
 * import { AnthropicToolJsonResponse } from "@beep/anthropic"
 * import { Response } from "effect/unstable/ai"
 *
 * const result = AnthropicToolJsonResponse.make({
 *   paramsJson: '{"repairs":[]}',
 *   usage: Response.Usage.make({
 *     inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 4, uncached: 4 },
 *     outputTokens: { reasoning: undefined, text: 2, total: 2 },
 *   }),
 * })
 * console.log(result.paramsJson)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AnthropicToolJsonResponse extends S.Class<AnthropicToolJsonResponse>($I`AnthropicToolJsonResponse`)(
  {
    paramsJson: S.String.annotateKey({ description: "Collected forced-tool parameter JSON." }),
    usage: Response.Usage.annotateKey({ description: "Provider-reported token usage for the repair call." }),
  },
  $I.annote("AnthropicToolJsonResponse", {
    description: "Collected forced-tool parameter JSON and provider usage for one Anthropic repair call.",
  })
) {}

const isFinishPart = <Tools extends Record<string, Tool.Any>>(
  part: Response.StreamPart<Tools>
): part is Response.FinishPart => part.type === "finish";

const isToolParamsDeltaPart = <Tools extends Record<string, Tool.Any>>(
  part: Response.StreamPart<Tools>
): part is Response.ToolParamsDeltaPart => part.type === "tool-params-delta";

/**
 * Collect forced-tool params and the terminal provider usage from a streamed repair response.
 *
 * **Details**
 *
 * Tool-parameter collection stops at the first `tool-params-end`, while the
 * stream itself is consumed through its terminal `finish` part so usage is not
 * discarded.
 *
 * **Example** (Collect params and usage)
 *
 * ```ts
 * import { collectToolParamsJsonWithUsage } from "@beep/anthropic"
 * import { Effect, Stream } from "effect"
 * import { Response } from "effect/unstable/ai"
 *
 * const parts: Stream.Stream<Response.StreamPart<{}>> = Stream.fromIterable([])
 *
 * const program = Effect.gen(function* () {
 *   const collected = yield* collectToolParamsJsonWithUsage(parts)
 *   return collected.paramsJson
 * })
 * console.log(typeof program)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const collectToolParamsJsonWithUsage = Effect.fn("collectToolParamsJsonWithUsage")(function* <
  Tools extends Record<string, Tool.Any>,
  E,
  R,
>(parts: Stream.Stream<Response.StreamPart<Tools>, E, R>) {
  const streamParts = A.fromIterable(yield* Stream.runCollect(parts));
  const paramsJson = pipe(
    streamParts,
    A.takeWhile((part) => part.type !== "tool-params-end"),
    A.filter(isToolParamsDeltaPart),
    A.map((part) => part.delta),
    A.join("")
  );
  const finish = A.findLast(streamParts, isFinishPart);
  if (O.isNone(finish)) {
    return yield* RepairError.make({
      message: "Anthropic repair call completed without provider usage metadata",
      operation: "generate_tool_json",
    });
  }
  return AnthropicToolJsonResponse.make({ paramsJson, usage: finish.value.usage });
});

/**
 * Run a forced-tool Anthropic call and return its tool-params JSON and usage.
 *
 * **Gotchas**
 *
 * This uses `streamText` and consumes the tool params whole because the
 * non-streaming tool-use path is unsafe for the currently pinned Effect AI
 * Anthropic provider.
 *
 * **Example** (Run forced-tool repair call)
 *
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
 * - Collects tool-parameter deltas until the provider emits `tool-params-end`.
 * - Consumes the terminal `finish` part so provider usage remains attributable.
 * @category combinators
 * @since 0.0.0
 */
export const generateAnthropicToolJson = <Tools extends Record<string, Tool.Any>>(
  options: GenerateTextOptions<Tools> & { readonly toolkit: Toolkit.Toolkit<Tools> }
): Effect.Effect<AnthropicToolJsonResponse, RepairError> =>
  LanguageModel.streamText({
    ...options,
    disableToolCallResolution: true,
  }).pipe(
    Stream.withExecutionPlan(makeAnthropicRepairPlan(), { preventFallbackOnPartialStream: true }),
    Stream.mapError(toRepairError("generate_tool_json")),
    collectToolParamsJsonWithUsage
  );
