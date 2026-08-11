/**
 * LLM Span Attributes
 *
 * Semantic conventions for LLM tracing following OpenTelemetry GenAI specs.
 *
 * @module Telemetry/LlmAttributes
 * @since 2.0.0
 */

import { Effect } from "effect"
import { calculateCost } from "./CostCalculator.ts"

/**
 * Semantic conventions for LLM spans (OpenTelemetry GenAI)
 *
 * @since 2.0.0
 * @category constants
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
  ERROR_MESSAGE: "error.message"
} as const

/**
 * Annotate current span with LLM call metadata
 *
 * @param attrs - LLM call attributes
 * @returns Effect that annotates the current span
 *
 * @since 2.0.0
 * @category annotation
 */
export const annotateLlmCall = (attrs: {
  model: string
  provider: string
  promptLength: number
  inputTokens?: number
  outputTokens?: number
  responseLength?: number
  schemaHash?: string
}): Effect.Effect<void> =>
  Effect.gen(function*() {
    yield* Effect.annotateCurrentSpan(LlmAttributes.MODEL, attrs.model)
    yield* Effect.annotateCurrentSpan(LlmAttributes.PROVIDER, attrs.provider)
    yield* Effect.annotateCurrentSpan(LlmAttributes.PROMPT_LENGTH, attrs.promptLength)

    if (attrs.inputTokens !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.INPUT_TOKENS, attrs.inputTokens)
    }
    if (attrs.outputTokens !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.OUTPUT_TOKENS, attrs.outputTokens)
    }
    if (attrs.inputTokens !== undefined && attrs.outputTokens !== undefined) {
      yield* Effect.annotateCurrentSpan(
        LlmAttributes.TOTAL_TOKENS,
        attrs.inputTokens + attrs.outputTokens
      )
      const cost = calculateCost(attrs.model, attrs.inputTokens, attrs.outputTokens)
      yield* Effect.annotateCurrentSpan(LlmAttributes.ESTIMATED_COST_USD, cost)
    }
    // NOTE: Removed PROMPT_TEXT and RESPONSE_TEXT to prevent PII leakage
    // Only safe metadata (lengths, hashes) should be captured in telemetry
    if (attrs.responseLength !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.RESPONSE_LENGTH, attrs.responseLength)
    }
    if (attrs.schemaHash !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.SCHEMA_HASH, attrs.schemaHash)
    }
  })

/**
 * Annotate current span with retry metadata
 *
 * @param attrs - Retry attributes
 * @returns Effect that annotates the current span
 *
 * @since 2.0.0
 * @category annotation
 */
export const annotateRetry = (attrs: {
  retryCount: number
  maxAttempts: number
}): Effect.Effect<void> =>
  Effect.all([
    Effect.annotateCurrentSpan(LlmAttributes.RETRY_COUNT, attrs.retryCount),
    Effect.annotateCurrentSpan(LlmAttributes.RETRY_MAX_ATTEMPTS, attrs.maxAttempts)
  ]).pipe(Effect.asVoid)

/**
 * Annotate current span with error metadata
 *
 * @param attrs - Error attributes
 * @returns Effect that annotates the current span
 *
 * @since 2.0.0
 * @category annotation
 */
export const annotateError = (attrs: {
  errorType: string
  errorMessage?: string
}): Effect.Effect<void> =>
  Effect.gen(function*() {
    yield* Effect.annotateCurrentSpan(LlmAttributes.ERROR_TYPE, attrs.errorType)
    if (attrs.errorMessage !== undefined) {
      // Truncate error message to avoid huge spans
      yield* Effect.annotateCurrentSpan(
        LlmAttributes.ERROR_MESSAGE,
        attrs.errorMessage.slice(0, 500)
      )
    }
  })

/**
 * Annotate current span with extraction metadata
 *
 * @param attrs - Extraction attributes
 * @returns Effect that annotates the current span
 *
 * @since 2.0.0
 * @category annotation
 */
export const annotateExtraction = (attrs: {
  chunkIndex?: number
  chunkTextLength?: number
  entityCount?: number
  relationCount?: number
  mentionCount?: number
  candidateClassCount?: number
}): Effect.Effect<void> =>
  Effect.gen(function*() {
    if (attrs.chunkIndex !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.CHUNK_INDEX, attrs.chunkIndex)
    }
    if (attrs.chunkTextLength !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.CHUNK_TEXT_LENGTH, attrs.chunkTextLength)
    }
    if (attrs.entityCount !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.ENTITY_COUNT, attrs.entityCount)
    }
    if (attrs.relationCount !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.RELATION_COUNT, attrs.relationCount)
    }
    if (attrs.mentionCount !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.MENTION_COUNT, attrs.mentionCount)
    }
    if (attrs.candidateClassCount !== undefined) {
      yield* Effect.annotateCurrentSpan(LlmAttributes.CANDIDATE_CLASS_COUNT, attrs.candidateClassCount)
    }
  })
