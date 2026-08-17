/**
 * Service: LLM with Retry
 *
 * **Details**
 *
 * Provides a standardized wrapper for LLM calls with:
 * - Configurable retry policy (exponential backoff, jitter)
 * - Timeout management
 * - Telemetry (spans, logging, error annotation)
 * - Consistent error handling
 *
 * Reduces code duplication across extractors and grounders.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Unknown } from "@beep/schema/Unknown";
import { Cause, Effect, Ref } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Prompt } from "effect/unstable/ai";
import type * as AiError from "effect/unstable/ai/AiError";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import type { StructuredPrompt } from "../Prompt/PromptGenerator.ts";
import { annotateError, annotateLlmCall, annotateRetry, LlmAttributes } from "../Telemetry/LlmAttributes.ts";
import { sha256Sync } from "../Utils/Hash.ts";
import { makeCachedPromptFromStructured } from "./PromptCache.ts";
import type { RetryPolicyInput } from "./Retry.ts";
import { RetryPolicy, retryEffect } from "./Retry.ts";

/**
 * Options for generateObjectWithRetry
 *
 *
 * **Example** (Use the GenerateObjectWithRetryOptions contract)
 *
 * ```ts
 * import type { GenerateObjectWithRetryOptions } from "@effect-ontology/Service/LlmWithRetry"
 *
 * const acceptsGenerateObjectWithRetryOptions = (_value: GenerateObjectWithRetryOptions<never>): void => undefined
 *
 * console.log(acceptsGenerateObjectWithRetryOptions)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface GenerateObjectWithRetryOptions<
  StructuredOutputSchema extends S.Codec<Record<string, unknown>, Record<string, unknown>, never, never>,
> {
  readonly prompt: string | StructuredPrompt;
  readonly schema: StructuredOutputSchema;
  readonly objectName: string;
  readonly serviceName: string;
  readonly model: string;
  readonly provider: string;
  readonly retryPolicy: RetryPolicyInput;
  /**
   * Optional telemetry attributes to add to the span
   */
  readonly spanAttributes?: Record<string, unknown>;
  /**
   * Optional callback to annotate success logs with domain-specific info
   */
  readonly annotateSuccess?: (
    response: LanguageModel.GenerateObjectResponse<Record<never, never>, StructuredOutputSchema["Type"]>
  ) => Record<string, unknown>;
  /**
   * Whether to enable prompt caching (only applies when prompt is StructuredPrompt)
   */
  readonly enablePromptCaching?: boolean;
}

/**
 * Generate structured object with standardized retry, timeout, and telemetry.
 *
 * **Example** (Inspect generate object with retry)
 *
 * ```ts
 * import { generateObjectWithRetry } from "@effect-ontology/Service/LlmWithRetry"
 *
 * console.log(generateObjectWithRetry)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const generateObjectWithRetry = Effect.fn("generateObjectWithRetry")(function* <
  StructuredOutputSchema extends S.Codec<Record<string, unknown>, Record<string, unknown>, never, never>,
>(
  options: GenerateObjectWithRetryOptions<StructuredOutputSchema>
): Effect.fn.Return<
  LanguageModel.GenerateObjectResponse<Record<never, never>, StructuredOutputSchema["Type"]>,
  AiError.AiError | Cause.TimeoutError | S.SchemaError,
  LanguageModel.LanguageModel | StructuredOutputSchema["DecodingServices"]
> {
  const {
    annotateSuccess,
    enablePromptCaching = false,
    model,
    objectName,
    prompt,
    provider,
    retryPolicy: retryPolicyInput,
    schema,
    serviceName,
    spanAttributes,
  } = options;
  const llm = yield* LanguageModel.LanguageModel;

  // Convert prompt to Prompt.Prompt if needed
  const promptObj: Prompt.Prompt = P.isString(prompt)
    ? Prompt.make(prompt)
    : makeCachedPromptFromStructured(prompt, enablePromptCaching);

  // Calculate prompt length for telemetry
  const promptLength = P.isString(prompt) ? prompt.length : prompt.systemMessage.length + prompt.userMessage.length;

  const retryPolicy = yield* S.decodeEffect(RetryPolicy)({ ...retryPolicyInput, serviceName });

  const attemptCount = yield* Ref.make(0);
  const schemaJson = yield* schema.pipe(S.toJsonSchemaDocument, Unknown.encodeUnknownEffectFromJsonString);
  const schemaHash = sha256Sync(schemaJson);

  const attempt = Ref.update(attemptCount, (count) => count + 1).pipe(
    Effect.andThen(
      llm.generateObject({
        prompt: promptObj,
        schema,
        objectName,
      })
    )
  );

  return yield* attempt.pipe(
    retryEffect(retryPolicy),
    Effect.tapCause((cause) =>
      Effect.all([
        Effect.logError(`${serviceName} LLM attempts exhausted`, {
          stage: Str.toLowerCase(serviceName),
          promptLength,
          cause: Cause.pretty(cause),
        }),
        annotateError({
          errorType: "UnknownCause",
          errorMessage: Str.slice(0, 500)(Cause.pretty(cause)),
        }),
      ])
    ),
    Effect.tap(
      Effect.fn("LlmWithRetry.annotateSuccess")(function* (response) {
        const attempts = yield* Ref.get(attemptCount);
        const retries = attempts - 1;
        const successAnnotations = P.isNotUndefined(annotateSuccess) ? annotateSuccess(response) : {};
        const inputTokens = response.usage.inputTokens.total ?? 0;
        const outputTokens = response.usage.outputTokens.total ?? 0;

        yield* Effect.all([
          Effect.logInfo(`${serviceName} LLM response`, {
            stage: Str.toLowerCase(serviceName),
            inputTokens,
            outputTokens,
            retryCount: retries,
            ...successAnnotations,
          }),
          annotateLlmCall({
            model,
            provider,
            promptLength,
            inputTokens,
            outputTokens,
            schemaHash,
          }),
          annotateRetry({
            retryCount: retries,
            maxAttempts: retryPolicy.maxAttempts,
          }),
        ]);
      })
    ),
    Effect.withSpan(`${Str.toLowerCase(serviceName)}-llm`, {
      attributes: {
        [LlmAttributes.PROMPT_LENGTH]: promptLength,
        [LlmAttributes.SCHEMA_HASH]: schemaHash,
        ...spanAttributes,
      },
    })
  );
});
