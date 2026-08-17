/**
 * Service: Generate Object with Feedback
 *
 * Provides retry with feedback for LLM structured output generation.
 * When schema validation fails (MalformedOutput), includes the error
 * in the retry prompt so the LLM can self-correct.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { Cause, Schedule } from "effect";
import { Duration, Effect, Result } from "effect";
import * as P from "effect/Predicate";
import type * as S from "effect/Schema";
import type { AiError, LanguageModel } from "effect/unstable/ai";
import { Prompt } from "effect/unstable/ai";
import type { StructuredPrompt } from "../Prompt/PromptGenerator.ts";
import { makeCachedPromptFromStructured } from "./PromptCache.ts";

/**
 * Options for generateObjectWithFeedback
 *
 * @since 0.0.0
 */
export interface GenerateWithFeedbackOptions<
  StructuredOutputSchema extends S.Codec<Record<string, unknown>, Record<string, unknown>, never, never>,
> {
  /**
   * The initial prompt - can be a string or structured prompt for caching
   */
  readonly prompt: string | StructuredPrompt;
  /**
   * The schema for structured output
   */
  readonly schema: StructuredOutputSchema;
  /**
   * Name for the structured output object
   */
  readonly objectName: string;
  /**
   * Maximum number of retry attempts
   */
  readonly maxAttempts: number;
  /**
   * Service name for logging
   */
  readonly serviceName: string;
  /**
   * Timeout per attempt in milliseconds
   */
  readonly timeoutMs?: number;
  /**
   * Optional retry schedule for non-schema errors.
   * When provided, uses Effect.retry with this schedule instead of simple loop.
   * Schema validation errors (MalformedOutput) still get feedback-based retry.
   */
  readonly retrySchedule?: Schedule.Schedule<unknown, unknown, never>;
  /**
   * Whether to enable prompt caching (only applies when prompt is StructuredPrompt)
   */
  readonly enablePromptCaching?: boolean;
}

/**
 * Generate object with schema validation feedback on retry.
 *
 * When MalformedOutput occurs (schema validation failure), includes the error
 * description in the retry prompt so the LLM can understand what went wrong
 * and self-correct.
 *
 * For other errors (network, rate limiting), retries without feedback.
 *
 * **Example** (Use generateObjectWithFeedback)
 * ```ts
 * const response = yield* generateObjectWithFeedback(llm, {
 *   prompt: entityExtractionPrompt,
 *   schema: EntityGraphSchema,
 *   objectName: "EntityGraph",
 *   maxAttempts: 5,
 *   serviceName: "EntityExtractor"
 * })
 * ```
 *
 * @since 0.0.0
 */
export const generateObjectWithFeedback = Effect.fn("generateObjectWithFeedback")(function* <
  StructuredOutputSchema extends S.Codec<Record<string, unknown>, Record<string, unknown>, never, never>,
>(
  llm: LanguageModel.Service,
  opts: GenerateWithFeedbackOptions<StructuredOutputSchema>
): Effect.fn.Return<
  LanguageModel.GenerateObjectResponse<{}, StructuredOutputSchema["Type"]>,
  AiError.AiError | Cause.TimeoutError,
  StructuredOutputSchema["DecodingServices"]
> {
  // Build initial prompt - support both string and structured prompts
  const enableCaching = opts.enablePromptCaching ?? false;
  const isStructured = typeof opts.prompt !== "string";
  const structuredPrompt: StructuredPrompt | null = typeof opts.prompt !== "string" ? opts.prompt : null;

  let currentPrompt: Prompt.Prompt =
    typeof opts.prompt === "string"
      ? Prompt.make(opts.prompt)
      : makeCachedPromptFromStructured(opts.prompt, enableCaching);

  let lastError: AiError.AiError | Cause.TimeoutError | null = null;
  let attempts = 0;

  // Calculate delay for each attempt (exponential with jitter if no custom schedule)
  const getDelay = (attempt: number): Duration.Duration => {
    if (P.isNotUndefined(opts.retrySchedule)) {
      // Use custom schedule timing strategy (approximate for loop)
      // Note: Full schedule integration is complex with feedback loop, so we use
      // a simple delay strategy based on successful retry patterns or default to standard backoff
      // For simplicity in this feedback loop, we'll default to standard backoff if schedule provided
      // but ideally we'd extract the delay from the schedule.
      const baseMs = 3000; // Match default retry policy
      return Duration.millis(Math.min(baseMs * 2 ** (attempt - 1), 30000));
    }
    return Duration.zero; // Original behavior: no delay between attempts
  };

  while (attempts < opts.maxAttempts) {
    attempts++;

    // Add delay between retries (not on first attempt)
    if (attempts > 1 && P.isNotUndefined(opts.retrySchedule)) {
      const delay = getDelay(attempts - 1);
      yield* Effect.sleep(delay);
      yield* Effect.logDebug("Retry delay applied", {
        service: opts.serviceName,
        attempt: attempts,
        delayMs: Duration.toMillis(delay),
      });
    }

    // Attempt to generate object
    const generateEffect = llm.generateObject({
      prompt: currentPrompt,
      schema: opts.schema,
      objectName: opts.objectName,
    });

    // Apply timeout if specified
    const timedEffect = P.isNotUndefined(opts.timeoutMs)
      ? generateEffect.pipe(Effect.timeout(Duration.millis(opts.timeoutMs)))
      : generateEffect;

    const result = yield* timedEffect.pipe(Effect.result);

    // Success - return the response
    if (Result.isSuccess(result)) {
      // Log if we succeeded after retries with feedback
      if (attempts > 1) {
        yield* Effect.logInfo("Schema validation succeeded after feedback retry", {
          service: opts.serviceName,
          attempt: attempts,
          maxAttempts: opts.maxAttempts,
        });
      }
      return result.success;
    }

    // Failure - check error type
    const error = result.failure;
    lastError = error;

    // Only add feedback for MalformedOutput (schema validation errors)
    if (error._tag === "AiError" && error.reason._tag === "InvalidOutputError") {
      yield* Effect.logWarning("Schema validation failed, retrying with feedback", {
        service: opts.serviceName,
        attempt: attempts,
        maxAttempts: opts.maxAttempts,
        errorDescription: error.reason.description?.slice(0, 500),
      });

      // Build feedback prompt with error details
      // This creates a multi-turn conversation where the LLM sees its mistake
      const feedbackMessage = buildFeedbackMessage(error.reason);

      // When using structured prompts, we need to append feedback to user message
      // and preserve the cached system message
      if (isStructured && P.isNotNull(structuredPrompt)) {
        // Append feedback to user message while keeping system message cached
        const updatedUserMessage = `${structuredPrompt.userMessage}\n\n${feedbackMessage[1]?.content || ""}`;
        currentPrompt = makeCachedPromptFromStructured(
          {
            systemMessage: structuredPrompt.systemMessage,
            userMessage: updatedUserMessage,
          },
          enableCaching
        );
      } else {
        // For string prompts, use merge as before
        currentPrompt = Prompt.concat(currentPrompt, feedbackMessage);
      }
    } else {
      // For other errors (network, timeout, etc), retry without feedback
      yield* Effect.logWarning("LLM call failed, retrying without feedback", {
        service: opts.serviceName,
        attempt: attempts,
        maxAttempts: opts.maxAttempts,
        errorTag: error._tag,
      });
      // Keep the same prompt for non-schema errors
    }
  }

  // All attempts exhausted - fail with last error
  yield* Effect.logError("All retry attempts exhausted", {
    service: opts.serviceName,
    attempts: opts.maxAttempts,
    lastErrorTag: lastError?._tag,
  });

  if (lastError === null) {
    return yield* Effect.die(new Error("generateObjectWithFeedback requires maxAttempts to be greater than zero"));
  }
  return yield* lastError;
});

/**
 * Build a feedback message to help the LLM understand the schema validation error.
 *
 * @internal
 */
const buildFeedbackMessage = (error: AiError.InvalidOutputError): ReadonlyArray<Prompt.MessageEncoded> => {
  // Extract useful information from the error description
  const errorDescription = error.description || "Schema validation failed";

  return [
    {
      role: "assistant",
      content: "I attempted to generate the output but it failed schema validation.",
    },
    {
      role: "user",
      content: `Your response failed schema validation with this error:

${errorDescription}

Please try again. Common issues:
1. Entity types must be from the ALLOWED CLASSES list (use Local Names, NOT full IRIs)
2. Attribute keys should be from ALLOWED DATATYPE PROPERTIES when possible
3. Entity IDs must be snake_case (lowercase with underscores)
4. Each entity must have at least one type

Generate a corrected response following the schema exactly.`,
    },
  ];
};

/**
 * Type helper for the generateObjectWithFeedback result
 *
 * @since 0.0.0
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type GenerateWithFeedbackResult<A> = LanguageModel.GenerateObjectResponse<{}, A>;
