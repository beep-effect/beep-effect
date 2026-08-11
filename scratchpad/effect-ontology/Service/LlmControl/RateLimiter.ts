/**
 * Central Rate Limiter Service
 *
 * Provides centralized rate limiting with circuit breaker for LLM API calls:
 * - 50 requests per minute
 * - 100,000 tokens per minute
 * - 5 max concurrent requests
 * - Circuit breaker: opens after 5 failures, recovers after 120s
 *
 * @since 2.0.0
 * @module Service/LlmControl/RateLimiter
 */

import { Clock, Context, Effect, Layer, Ref, Schema } from "effect"
import { CircuitOpenError, RateLimitError } from "../../Domain/Error/Circuit.ts"
import { $ScratchpadId } from "@beep/identity";
import * as Semaphore from "effect/Semaphore";

const $I = $ScratchpadId.create("effect-ontology/Service/LlmControl/RateLimiter");

// =============================================================================
// Types
// =============================================================================

/**
 * Circuit breaker states
 */
export type CircuitState = "closed" | "open" | "half_open"

/**
 * Rate limiter state
 */
export interface RateLimiterState {
  /** Requests made in current minute window */
  readonly requestsThisMinute: number
  /** Tokens used in current minute window */
  readonly tokensThisMinute: number
  /** Timestamp of last counter reset */
  readonly lastReset: number
  /** Circuit breaker state */
  readonly circuitState: CircuitState
  /** Consecutive failures count */
  readonly failureCount: number
  /** Consecutive successes count (for half_open recovery) */
  readonly successCount: number
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests per minute */
  readonly requestsPerMinute: number
  /** Maximum tokens per minute */
  readonly tokensPerMinute: number
  /** Maximum concurrent requests */
  readonly maxConcurrent: number
  /** Failures before circuit opens */
  readonly failureThreshold: number
  /** Recovery timeout in milliseconds */
  readonly recoveryTimeoutMs: number
  /** Successes in half_open before closing */
  readonly successThreshold: number
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RateLimiterConfig = {
  requestsPerMinute: 50,
  tokensPerMinute: 100_000,
  maxConcurrent: 5,
  failureThreshold: 5,
  recoveryTimeoutMs: 120_000,
  successThreshold: 2
}

// =============================================================================
// Service
// =============================================================================

/**
 * Central rate limiting for LLM API calls
 *
 * Provides:
 * - Request and token rate limiting with sliding window
 * - Concurrent request limiting with semaphore
 * - Circuit breaker pattern for cascading failure protection
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const limiter = yield* CentralRateLimiterService
 *
 *   // Acquire permit before LLM call
 *   yield* limiter.acquire(1000)  // Estimated tokens
 *
 *   try {
 *     const result = yield* llmCall()
 *     yield* limiter.release(result.tokensUsed, true)
 *     return result
 *   } catch (e) {
 *     yield* limiter.release(0, false)
 *     throw e
 *   }
 * })
 * ```
 */
export class CentralRateLimiterService extends Context.Service<CentralRateLimiterService, {
    /**
     * Acquire a rate limit permit
     *
     * Checks circuit breaker, rate limits, and acquires semaphore permit.
     * Fails with RateLimitError or CircuitOpenError if limits exceeded.
     *
     * @param estimatedTokens - Estimated tokens for the request
     */
    readonly acquire: (
      estimatedTokens: number
    ) => Effect.Effect<void, RateLimitError | CircuitOpenError>

    /**
     * Release permit and update circuit breaker state
     *
     * @param actualTokens - Actual tokens used (for accurate tracking)
     * @param success - Whether the request succeeded
     */
    readonly release: (
      actualTokens: number,
      success: boolean
    ) => Effect.Effect<void>

    /**
     * Get current rate limiter metrics
     */
    readonly getMetrics: () => Effect.Effect<RateLimiterState>

    /**
     * Get time until rate limit resets
     *
     * @returns Milliseconds until counters reset
     */
    readonly getResetTime: () => Effect.Effect<number>

    /**
     * Force circuit breaker state (for testing/recovery)
     *
     * @param state - New circuit state
     */
    readonly setCircuitState: (state: CircuitState) => Effect.Effect<void>
  }>()($I`CentralRateLimiterService`) {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create rate limiter with configuration
 */
const make = (config: RateLimiterConfig = DEFAULT_CONFIG) =>
  Effect.gen(function*() {
    const initialTime = yield* Clock.currentTimeMillis
    const state = yield* Ref.make<RateLimiterState>({
      requestsThisMinute: 0,
      tokensThisMinute: 0,
      lastReset: Number(initialTime),
      circuitState: "closed",
      failureCount: 0,
      successCount: 0
    })

    const semaphore = yield* Semaphore.make(config.maxConcurrent)

    /**
     * Reset counters if minute has elapsed
     */
    const maybeResetCounters = (now: number) =>
      Ref.update(state, (s) =>
        now - s.lastReset > 60_000
          ? { ...s, requestsThisMinute: 0, tokensThisMinute: 0, lastReset: now }
          : s)

    return {
      acquire:
        Effect.fn(function* (estimatedTokens: number)  {
          const now = Number(yield* Clock.currentTimeMillis)
          const current = yield* Ref.get(state)

          // Check circuit breaker
          if (current.circuitState === "open") {
            const elapsed = now - current.lastReset
            if (elapsed < config.recoveryTimeoutMs) {
              return yield* Effect.fail(
                Schema.decodeUnknownSync(CircuitOpenError)({
                  resetTimeoutMs: config.recoveryTimeoutMs,
                  retryAfterMs: config.recoveryTimeoutMs - elapsed
                })
              )
            }
            // Transition to half_open
            yield* Ref.update(state, (s) => ({
              ...s,
              circuitState: "half_open" as const
            }))
          }

          // Reset counters if minute elapsed
          yield* maybeResetCounters(now)

          // Re-read state after potential reset
          const updated = yield* Ref.get(state)

          // Check request limit
          if (updated.requestsThisMinute >= config.requestsPerMinute) {
            const msUntilReset = 60_000 - (now - updated.lastReset)
            return yield* Effect.fail(
              Schema.decodeUnknownSync(RateLimitError)({
                reason: "requests",
                retryAfterMs: msUntilReset
              })
            )
          }

          // Check token limit
          if (
            updated.tokensThisMinute + estimatedTokens >
              config.tokensPerMinute
          ) {
            const msUntilReset = 60_000 - (now - updated.lastReset)
            return yield* Effect.fail(
              Schema.decodeUnknownSync(RateLimitError)({
                reason: "tokens",
                retryAfterMs: msUntilReset
              })
            )
          }

          // Acquire semaphore permit (blocks if at max concurrency)
          // CRITICAL: Use take() so permit is held until release() is called
          yield* semaphore.take(1)

          // Increment counters
          yield* Ref.update(state, (s) => ({
            ...s,
            requestsThisMinute: s.requestsThisMinute + 1,
            tokensThisMinute: s.tokensThisMinute + estimatedTokens
          }))
        }),

      release:
        Effect.fn(function*(_actualTokens: number, success: boolean)  {
          // CRITICAL: Release the semaphore permit acquired in acquire()
          yield* semaphore.release(1)

          // Get current time for potential circuit open reset
          const now = Number(yield* Clock.currentTimeMillis)

          // Update circuit breaker state based on success/failure
          yield* Ref.update(state, (s) => {
            if (success) {
              const newSuccessCount = s.successCount + 1
              return {
                ...s,
                successCount: newSuccessCount,
                failureCount: 0,
                circuitState: s.circuitState === "half_open" &&
                    newSuccessCount >= config.successThreshold
                  ? ("closed" as const)
                  : s.circuitState
              }
            } else {
              const newFailureCount = s.failureCount + 1
              const shouldOpen = newFailureCount >= config.failureThreshold
              return {
                ...s,
                failureCount: newFailureCount,
                successCount: 0,
                circuitState: shouldOpen ? ("open" as const) : s.circuitState,
                lastReset: shouldOpen ? now : s.lastReset
              }
            }
          })
        }),

      getMetrics: () => Ref.get(state),

      getResetTime:
        Effect.fn(function*() {
          const s = yield* Ref.get(state)
          const now = Number(yield* Clock.currentTimeMillis)
          const elapsed = now - s.lastReset
          return Math.max(0, 60_000 - elapsed)
        }),

      setCircuitState: (circuitState: CircuitState) =>
        Ref.update(state, (s) => ({
          ...s,
          circuitState,
          failureCount: circuitState === "closed" ? 0 : s.failureCount,
          successCount: circuitState === "closed" ? 0 : s.successCount
        }))
    }
  })

/**
 * Default layer providing CentralRateLimiterService
 */
export const CentralRateLimiterServiceLive = Layer.effect(
  CentralRateLimiterService,
  make()
)

/**
 * Test layer with configurable limits (useful for faster tests)
 */
export const CentralRateLimiterServiceTest = (
  overrides: Partial<RateLimiterConfig> = {}
): Layer.Layer<CentralRateLimiterService> =>
  Layer.effect(
    CentralRateLimiterService,
    make({ ...DEFAULT_CONFIG, ...overrides })
  )
