/**
 * Runtime: Rate-Limited Language Model Layer
 *
 * Wraps LanguageModel.LanguageModel with rate limiting to prevent API quota exhaustion.
 * Uses Effect's built-in RateLimiter with token-bucket algorithm.
 *
 * Implements dual rate limiting:
 * - Per-second burst protection (max 2 concurrent starts)
 * - Per-minute sustained rate (max 20 RPM)
 *
 * This layer sits between the base LanguageModel provider and consuming services,
 * ensuring all LLM calls are automatically rate limited.
 *
 * @since 2.0.0
 * @module Runtime/RateLimitedLanguageModel
 */

import { AiError, LanguageModel } from "effect/unstable/ai"
import * as RateLimiter from "effect/unstable/persistence/RateLimiter"
import { Clock, Duration, Effect, Layer, Scope, Stream } from "effect"
import { ConfigService } from "../Service/Config.ts"
import { LlmAttributes } from "../Telemetry/LlmAttributes.ts"
import type { CircuitOpenError } from "./CircuitBreaker.ts"
import { makeCircuitBreaker } from "./CircuitBreaker.ts"

/**
 * Rate limit configurations per provider
 *
 * Uses very conservative values to avoid socket errors from API rate limiting.
 * Dual limits: per-second (burst) and per-minute (sustained).
 *
 * @internal
 */
const RATE_LIMITS: Record<string, {
  perSecond: number
  perMinute: number
}> = {
  // Anthropic: Very conservative - 2/sec burst, 20/min sustained
  anthropic: { perSecond: 2, perMinute: 20 },
  // OpenAI: Slightly higher limits
  openai: { perSecond: 3, perMinute: 30 },
  // Google: Similar to Anthropic
  google: { perSecond: 2, perMinute: 20 }
}

/**
 * Create a rate-limited LanguageModel layer
 *
 * Wraps the base LanguageModel with rate limiting based on provider configuration.
 * All LLM methods (generateObject, generateText, streamText) are wrapped.
 *
 * @example
 * ```typescript
 * // In ProductionRuntime
 * const layers = ExtractionLayersLive.pipe(
 *   Layer.provide(RateLimitedLanguageModelLayer),
 *   Layer.provide(makeLanguageModelLayer)
 * )
 * ```
 *
 * @since 2.0.0
 */
/**
 * Track LLM call statistics for observability
 */
let callCount = 0

export const RateLimitedLanguageModelLayer = Layer.effect(
  LanguageModel.LanguageModel,
  Effect.gen(function*() {
    const config = yield* ConfigService
    const baseLlm = yield* LanguageModel.LanguageModel
    const scope = yield* Scope.Scope

    // Get rate limit config for the current provider
    const rateLimitConfig = RATE_LIMITS[config.llm.provider] ?? RATE_LIMITS.anthropic

    // Create dual rate limiters:
    // 1. Per-second burst limiter - prevents too many concurrent starts
    const perSecondLimiter = yield* RateLimiter.make({
      limit: rateLimitConfig.perSecond,
      interval: "1 seconds",
      algorithm: "fixed-window"
    }).pipe(Scope.extend(scope))

    // 2. Per-minute sustained limiter - respects API quota
    const perMinuteLimiter = yield* RateLimiter.make({
      limit: rateLimitConfig.perMinute,
      interval: "1 minutes",
      algorithm: "fixed-window"
    }).pipe(Scope.extend(scope))

    // Compose both rate limiters - request must pass both
    const rateLimiter = <A, E, R>(effect: Effect.Effect<A, E, R>) => perSecondLimiter(perMinuteLimiter(effect))

    yield* Effect.logInfo("Dual rate limiter initialized", {
      provider: config.llm.provider,
      perSecond: rateLimitConfig.perSecond,
      perMinute: rateLimitConfig.perMinute
    })

    // Initialize Circuit Breaker
    // This provides a safety valve for when the API is failing repeatedly
    const circuitBreaker = yield* makeCircuitBreaker({
      maxFailures: 5, // Open after 5 consecutive failures
      resetTimeout: Duration.minutes(2), // Wait 2 minutes before testing recovery
      successThreshold: 2 // Require 2 successful calls to close circuit
    }).pipe(Scope.extend(scope))

    // Helper to wrap LLM calls with rate limiting and observability
    const withRateLimit = <A, E, R>(
      method: string,
      effect: Effect.Effect<A, E, R>
    ): Effect.Effect<A, E, R> => {
      const callId = ++callCount

      return Clock.currentTimeMillis.pipe(
        Effect.tap((_startTime) =>
          Effect.logDebug("LLM call queued", {
            provider: config.llm.provider,
            method,
            callId
          })
        ),
        Effect.flatMap((startTime) =>
          // Apply protection layers:
          // 1. Circuit Breaker (fail fast if API is down)
          // 2. Rate Limiter (wait for token)
          circuitBreaker.protect(
            rateLimiter(effect)
          ).pipe(
            // Convert CircuitOpenError to AiError.UnknownError
            // This maintains compatibility with LanguageModel error channel (E must extend AiError)
            // while preserving circuit breaker state information
            Effect.catchTag("CircuitOpenError", (err) => {
              // Type assertion is safe here - we know err is CircuitOpenError based on the tag
              const circuitErr = err as CircuitOpenError
              const lastFailureStr = circuitErr.lastFailureTime
                ? new Date(circuitErr.lastFailureTime).toISOString()
                : "unknown"
              return Effect.fail(
                AiError.UnknownError.make({
                  module: "RateLimitedLanguageModel",
                  method: `${method} (circuit breaker)`,
                  description:
                    `Circuit breaker is open. Last failure: ${lastFailureStr}. Reset timeout: ${circuitErr.resetTimeoutMs}ms`,
                  cause: circuitErr
                }) as E // Safe cast since E extends AiError.AiError
              )
            }),
            Effect.tap((_result) =>
              Clock.currentTimeMillis.pipe(
                Effect.flatMap((endTime) => {
                  const waitMs = Number(endTime - startTime)
                  return Effect.all([
                    Effect.logDebug("LLM call completed", {
                      provider: config.llm.provider,
                      method,
                      callId,
                      rateLimiterWaitMs: waitMs
                    }),
                    Effect.annotateCurrentSpan(LlmAttributes.RATE_LIMITER_WAIT_MS, waitMs),
                    Effect.annotateCurrentSpan(LlmAttributes.LLM_CALL_ID, callId),
                    Effect.annotateCurrentSpan(LlmAttributes.LLM_METHOD, method)
                  ])
                })
              )
            )
          )
        ),
        Effect.withSpan(`llm.${method}`, {
          attributes: {
            [LlmAttributes.PROVIDER]: config.llm.provider,
            [LlmAttributes.MODEL]: config.llm.model
          }
        })
      )
    }

    // Return wrapped LanguageModel with all methods rate-limited
    return LanguageModel.LanguageModel.of({
      generateObject: (opts) => withRateLimit("generateObject", baseLlm.generateObject(opts)),
      generateText: (opts) => withRateLimit("generateText", baseLlm.generateText(opts)),
      // streamText returns a Stream, so we rate-limit the stream creation
      streamText: (opts) =>
        Stream.unwrap(
          withRateLimit("streamText", Effect.sync(() => baseLlm.streamText(opts)))
        )
    })
  })
)
