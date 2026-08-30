/**
 * LLM Span Attributes
 *
 * **Details**
 *
 * Semantic conventions for LLM tracing following OpenTelemetry GenAI specs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import { calculateCost } from "./CostCalculator.ts";

/**
 * OpenTelemetry GenAI and extraction span attribute keys used by the
 * annotate helpers in this module.
 *
 * **Gotchas**
 *
 * Prompt and response bodies are intentionally absent. Only lengths, hashes,
 * token counts, and similar metadata are recorded.
 *
 * **Example** (Read the model and prompt-length keys)
 *
 * ```ts
 * import { LlmAttributes } from "@effect-ontology/Telemetry/LlmAttributes"
 *
 * console.log(LlmAttributes.MODEL) // "gen_ai.request.model"
 * console.log(LlmAttributes.PROMPT_LENGTH) // "gen_ai.prompt.length"
 * console.log("PROMPT_TEXT" in LlmAttributes) // false
 * ```
 *
 * @see {@link annotateLlmCall} for writing these keys onto the current span.
 * @category observability
 * @since 0.0.0
 */
export const LlmAttributes = {
  // Provider info (OpenTelemetry GenAI conventions)
  MODEL: "gen_ai.request.model",
  PROVIDER: "gen_ai.system",

  // Token counts
  INPUT_TOKENS: "gen_ai.usage.input_tokens",
  OUTPUT_TOKENS: "gen_ai.usage.output_tokens",
  TOTAL_TOKENS: "gen_ai.usage.total_tokens",

  // Cost tracking (custom)
  ESTIMATED_COST_USD: "llm.cost.usd",

  // Request details (safe metadata only - no PII)
  PROMPT_LENGTH: "gen_ai.prompt.length",
  RESPONSE_LENGTH: "gen_ai.response.length",
  SCHEMA_HASH: "gen_ai.request.schema_hash",

  // Prompt caching (custom)
  PROMPT_CACHING_ENABLED: "llm.prompt_caching.enabled",
  SYSTEM_MESSAGE_LENGTH: "llm.prompt_caching.system_message.length",
  USER_MESSAGE_LENGTH: "llm.prompt_caching.user_message.length",

  // Extraction-specific (custom)
  ENTITY_COUNT: "extraction.entity_count",
  RELATION_COUNT: "extraction.relation_count",
  MENTION_COUNT: "extraction.mention_count",
  CHUNK_INDEX: "extraction.chunk_index",
  CHUNK_TEXT_LENGTH: "extraction.chunk_text_length",
  CANDIDATE_CLASS_COUNT: "extraction.candidate_class_count",

  // Rate limiter (custom)
  RATE_LIMITER_WAIT_MS: "rate_limiter.wait_ms",
  LLM_CALL_ID: "llm.call_id",
  LLM_METHOD: "llm.method",

  // Retry tracking (custom)
  RETRY_COUNT: "retry.count",
  RETRY_MAX_ATTEMPTS: "retry.max_attempts",

  // Error tracking (OpenTelemetry semantic conventions)
  ERROR_TYPE: "error.type",
  ERROR_MESSAGE: "error.message",
};

/**
 * Annotates the current span with model, provider, token, and length metadata
 * for one language-model call.
 *
 * **Gotchas**
 *
 * Prompt and response text are never written. Pass lengths and optional
 * `schemaHash` only.
 *
 * **Example** (Compose a call annotation)
 *
 * ```ts
 * import { LlmAttributes, annotateLlmCall } from "@effect-ontology/Telemetry/LlmAttributes"
 * import { calculateCost } from "@effect-ontology/Telemetry/CostCalculator"
 *
 * const attrs = {
 *   model: "claude-sonnet-4-5",
 *   provider: "anthropic",
 *   promptLength: 128,
 *   inputTokens: 100,
 *   outputTokens: 40
 * }
 * const annotate = annotateLlmCall(attrs)
 * console.log(LlmAttributes.TOTAL_TOKENS) // "gen_ai.usage.total_tokens"
 * console.log(calculateCost(attrs.model, attrs.inputTokens, attrs.outputTokens)) // 0.0009
 * console.log(typeof annotate) // "object"
 * ```
 *
 * @see {@link LlmAttributes} for the attribute keys written by this helper.
 * @category observability
 * @since 0.0.0
 */
export const annotateLlmCall = (attrs: {
  model: string;
  provider: string;
  promptLength: number;
  inputTokens?: number;
  outputTokens?: number;
  responseLength?: number;
  schemaHash?: string;
}): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan(LlmAttributes.MODEL, attrs.model);
    yield* Effect.annotateCurrentSpan(LlmAttributes.PROVIDER, attrs.provider);
    yield* Effect.annotateCurrentSpan(LlmAttributes.PROMPT_LENGTH, attrs.promptLength);

    if (attrs.inputTokens !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.INPUT_TOKENS, attrs.inputTokens);
    }
    if (attrs.outputTokens !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.OUTPUT_TOKENS, attrs.outputTokens);
    }
    if (attrs.inputTokens !== undefined && attrs.outputTokens !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.TOTAL_TOKENS, attrs.inputTokens + attrs.outputTokens);
      const cost = calculateCost(attrs.model, attrs.inputTokens, attrs.outputTokens);
      yield* Effect.annotateCurrentSpan(LlmAttributes.ESTIMATED_COST_USD, cost);
    }
    // NOTE: Removed PROMPT_TEXT and RESPONSE_TEXT to prevent PII leakage
    // Only safe metadata (lengths, hashes) should be captured in telemetry
    if (attrs.responseLength !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.RESPONSE_LENGTH, attrs.responseLength);
    }
    if (attrs.schemaHash !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.SCHEMA_HASH, attrs.schemaHash);
    }
  });

/**
 * Annotates the current span with the current retry attempt and configured
 * maximum attempts.
 *
 * **Example** (Compose a retry annotation)
 *
 * ```ts
 * import { LlmAttributes, annotateRetry } from "@effect-ontology/Telemetry/LlmAttributes"
 *
 * const attrs = { retryCount: 2, maxAttempts: 3 }
 * const annotate = annotateRetry(attrs)
 * console.log(LlmAttributes.RETRY_COUNT) // "retry.count"
 * console.log(LlmAttributes.RETRY_MAX_ATTEMPTS) // "retry.max_attempts"
 * console.log(attrs.retryCount < attrs.maxAttempts) // true
 * console.log(typeof annotate) // "object"
 * ```
 *
 * @see {@link LlmAttributes} for the retry attribute keys.
 * @category observability
 * @since 0.0.0
 */
export const annotateRetry = (attrs: { retryCount: number; maxAttempts: number }): Effect.Effect<void> =>
  Effect.all([
    Effect.annotateCurrentSpan(LlmAttributes.RETRY_COUNT, attrs.retryCount),
    Effect.annotateCurrentSpan(LlmAttributes.RETRY_MAX_ATTEMPTS, attrs.maxAttempts),
  ]).pipe(Effect.asVoid);

/**
 * Annotates the current span with an error type and an optional message.
 *
 * **Gotchas**
 *
 * `errorMessage` is truncated to 500 characters before it is written.
 *
 * **Example** (Compose a truncated error annotation)
 *
 * ```ts
 * import { LlmAttributes, annotateError } from "@effect-ontology/Telemetry/LlmAttributes"
 *
 * const errorMessage = "x".repeat(600)
 * const annotate = annotateError({ errorType: "LlmTimeout", errorMessage })
 * console.log(LlmAttributes.ERROR_TYPE) // "error.type"
 * console.log(LlmAttributes.ERROR_MESSAGE) // "error.message"
 * console.log(errorMessage.slice(0, 500).length) // 500
 * console.log(typeof annotate) // "object"
 * ```
 *
 * @see {@link LlmAttributes} for the error attribute keys.
 * @category observability
 * @since 0.0.0
 */
export const annotateError = (attrs: { errorType: string; errorMessage?: string }): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan(LlmAttributes.ERROR_TYPE, attrs.errorType);
    if (attrs.errorMessage !== undefined) {
      // Truncate error message to avoid huge spans
      yield* Effect.annotateCurrentSpan(LlmAttributes.ERROR_MESSAGE, attrs.errorMessage.slice(0, 500));
    }
  });

/**
 * Annotates the current span with chunk, entity, relation, and mention counts
 * for one extraction step.
 *
 * **Example** (Compose an extraction annotation)
 *
 * ```ts
 * import { LlmAttributes, annotateExtraction } from "@effect-ontology/Telemetry/LlmAttributes"
 *
 * const attrs = { chunkIndex: 0, entityCount: 3, relationCount: 1 }
 * const annotate = annotateExtraction(attrs)
 * console.log(LlmAttributes.CHUNK_INDEX) // "extraction.chunk_index"
 * console.log(LlmAttributes.ENTITY_COUNT) // "extraction.entity_count"
 * console.log(attrs.entityCount + attrs.relationCount) // 4
 * console.log(typeof annotate) // "object"
 * ```
 *
 * @see {@link LlmAttributes} for the extraction attribute keys.
 * @category observability
 * @since 0.0.0
 */
export const annotateExtraction = (attrs: {
  chunkIndex?: number;
  chunkTextLength?: number;
  entityCount?: number;
  relationCount?: number;
  mentionCount?: number;
  candidateClassCount?: number;
}): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (attrs.chunkIndex !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.CHUNK_INDEX, attrs.chunkIndex);
    }
    if (attrs.chunkTextLength !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.CHUNK_TEXT_LENGTH, attrs.chunkTextLength);
    }
    if (attrs.entityCount !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.ENTITY_COUNT, attrs.entityCount);
    }
    if (attrs.relationCount !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.RELATION_COUNT, attrs.relationCount);
    }
    if (attrs.mentionCount !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.MENTION_COUNT, attrs.mentionCount);
    }
    if (attrs.candidateClassCount !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.CANDIDATE_CLASS_COUNT, attrs.candidateClassCount);
    }
  });
