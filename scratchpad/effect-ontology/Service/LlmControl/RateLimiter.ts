/**
 * Central Rate Limiter Service
 *
 * **Details**
 *
 * Provides centralized rate limiting with circuit breaker for LLM API calls:
 * - 50 requests per minute
 * - 100,000 tokens per minute
 * - 5 max concurrent requests
 * - Circuit breaker: opens after 5 failures, recovers after 120s
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Clock, Context, Duration, Effect, Layer, Number as N, Ref, Semaphore } from "effect";
import * as S from "effect/Schema";
import { CircuitOpenError, RateLimitError } from "../../Domain/Error/Circuit.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/LlmControl/RateLimiter");

const PositiveInt = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("PositiveInt", {
    description: "Positive integer used for rate and circuit-breaker limits.",
  })
);

// =============================================================================
// Types
// =============================================================================

/**
 * Circuit-breaker states.
 *
 * **Example** (Guard a closed circuit)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CircuitState } from "@effect-ontology/Service/LlmControl/RateLimiter"
 *
 * console.log(S.is(CircuitState)("closed")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CircuitState = LiteralKit(["closed", "open", "half_open"]).pipe(
  $I.annoteSchema("CircuitState", {
    description: "Closed, open, and half-open circuit-breaker states.",
  })
);

/**
 * Runtime value accepted by {@link CircuitState}.
 *
 * @see {@link CircuitState} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type CircuitState = typeof CircuitState.Type;

/**
 * Rate limiter state
 *
 *
 * **Example** (Use the RateLimiterState contract)
 *
 * ```ts
 * import { RateLimiterState } from "@effect-ontology/Service/LlmControl/RateLimiter"
 *
 * const state = RateLimiterState.make({
 *   requestsThisMinute: 0,
 *   tokensThisMinute: 0,
 *   lastReset: 0,
 *   circuitState: "closed",
 *   failureCount: 0,
 *   successCount: 0
 * })
 * console.log(state.circuitState) // "closed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RateLimiterState extends S.Class<RateLimiterState>($I`RateLimiterState`)(
  {
    requestsThisMinute: S.Natural.annotateKey({ description: "Requests made in the current minute window." }),
    tokensThisMinute: S.Natural.annotateKey({ description: "Tokens used in the current minute window." }),
    lastReset: S.Natural.annotateKey({ description: "Epoch-millisecond timestamp of the last counter reset." }),
    circuitState: CircuitState.annotateKey({ description: "Current circuit-breaker state." }),
    failureCount: S.Natural.annotateKey({ description: "Consecutive failure count." }),
    successCount: S.Natural.annotateKey({ description: "Consecutive half-open success count." }),
  },
  $I.annote("RateLimiterState", {
    description: "Rate-window counters and circuit-breaker recovery state.",
  })
) {}

/**
 * Rate limiter configuration
 *
 *
 * **Example** (Use the RateLimiterConfig contract)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { RateLimiterConfig } from "@effect-ontology/Service/LlmControl/RateLimiter"
 *
 * const config = RateLimiterConfig.make({
 *   requestsPerMinute: 50,
 *   tokensPerMinute: 80_000,
 *   maxConcurrent: 4,
 *   failureThreshold: 5,
 *   recoveryTimeout: Duration.seconds(30),
 *   successThreshold: 2
 * })
 * console.log(config.requestsPerMinute) // 50
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class RateLimiterConfig extends S.Class<RateLimiterConfig>($I`RateLimiterConfig`)(
  {
    requestsPerMinute: PositiveInt.annotateKey({ description: "Maximum requests per minute." }),
    tokensPerMinute: PositiveInt.annotateKey({ description: "Maximum tokens per minute." }),
    maxConcurrent: PositiveInt.annotateKey({ description: "Maximum concurrent requests." }),
    failureThreshold: PositiveInt.annotateKey({ description: "Failures observed before the circuit opens." }),
    recoveryTimeout: S.Duration.annotateKey({ description: "Delay before an open circuit may become half-open." }),
    successThreshold: PositiveInt.annotateKey({
      description: "Half-open successes required before the circuit closes.",
    }),
  },
  $I.annote("RateLimiterConfig", {
    description: "Request, token, concurrency, and circuit-breaker limits.",
  })
) {}

/**
 * Default configuration
 */
const DEFAULT_CONFIG = RateLimiterConfig.make({
  requestsPerMinute: 50,
  tokensPerMinute: 100_000,
  maxConcurrent: 5,
  failureThreshold: 5,
  recoveryTimeout: Duration.minutes(2),
  successThreshold: 2,
});

// =============================================================================
// Service
// =============================================================================

/**
 * Central rate limiting for LLM API calls
 *
 * **Details**
 *
 * Provides:
 * - Request and token rate limiting with sliding window
 * - Concurrent request limiting with semaphore
 * - Circuit breaker pattern for cascading failure protection
 *
 * **Example** (Inspect the central rate-limiter layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { Effect } from "effect"
 * import { CentralRateLimiterService, CentralRateLimiterServiceLive } from "@effect-ontology/Service/LlmControl/RateLimiter"
 *
 * const program = Effect.gen(function* () {
 *   const limiter = yield* CentralRateLimiterService
 *   return limiter
 * }).pipe(Effect.provide(CentralRateLimiterServiceLive))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CentralRateLimiterService extends Context.Service<
  CentralRateLimiterService,
  {
    /**
     * Acquire a rate limit permit
     *
     * Checks circuit breaker, rate limits, and acquires semaphore permit.
     * Fails with RateLimitError or CircuitOpenError if limits exceeded.
     *
     * @param estimatedTokens - Estimated tokens for the request
     */
    readonly acquire: (estimatedTokens: number) => Effect.Effect<void, RateLimitError | CircuitOpenError>;

    /**
     * Release permit and update circuit breaker state
     *
     * @param actualTokens - Actual tokens used (for accurate tracking)
     * @param success - Whether the request succeeded
     */
    readonly release: (actualTokens: number, success: boolean) => Effect.Effect<void>;

    /**
     * Get current rate limiter metrics
     */
    readonly getMetrics: Effect.Effect<RateLimiterState>;

    /**
     * Get time until rate limit resets
     *
     * @returns Duration until counters reset
     */
    readonly getResetTime: Effect.Effect<Duration.Duration>;

    /**
     * Force circuit breaker state (for testing/recovery)
     *
     * @param state - New circuit state
     */
    readonly setCircuitState: (state: CircuitState) => Effect.Effect<void>;
  }
>()($I`CentralRateLimiterService`) {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create rate limiter with configuration
 */
const make = Effect.fn("CentralRateLimiter.make")(function* (config: RateLimiterConfig = DEFAULT_CONFIG) {
  const rateWindow = Duration.minutes(1);
  const rateWindowMillis = Duration.toMillis(rateWindow);
  const recoveryTimeoutMillis = Duration.toMillis(config.recoveryTimeout);
  const initialTime = yield* Clock.currentTimeMillis;
  const state = yield* Ref.make(
    RateLimiterState.make({
      requestsThisMinute: 0,
      tokensThisMinute: 0,
      lastReset: Number(initialTime),
      circuitState: "closed",
      failureCount: 0,
      successCount: 0,
    })
  );
  const semaphore = yield* Semaphore.make(config.maxConcurrent);
  const maybeResetCounters = (now: number) =>
    Ref.update(state, (s) =>
      now - s.lastReset > rateWindowMillis
        ? RateLimiterState.make({
            ...s,
            requestsThisMinute: 0,
            tokensThisMinute: 0,
            lastReset: now,
          })
        : s
    );
  return {
    acquire: Effect.fn("CentralRateLimiter.acquire")(function* (estimatedTokens: number) {
      const now = Number(yield* Clock.currentTimeMillis);
      const current = yield* Ref.get(state);
      if (current.circuitState === "open") {
        const elapsed = now - current.lastReset;
        if (elapsed < recoveryTimeoutMillis) {
          const error = yield* CircuitOpenError.decodeUnknownEffect({
            resetTimeoutMs: recoveryTimeoutMillis,
            retryAfterMs: recoveryTimeoutMillis - elapsed,
          }).pipe(Effect.orDie);
          return yield* error;
        }
        yield* Ref.update(
          state,
          (s) =>
            RateLimiterState.make({
            ...s,
            circuitState: "half_open",
            })
        );
      }
      yield* maybeResetCounters(now);
      const updated = yield* Ref.get(state);
      if (updated.requestsThisMinute >= config.requestsPerMinute) {
        const msUntilReset = rateWindowMillis - (now - updated.lastReset);
        const error = yield* RateLimitError.decodeUnknownEffect({
          reason: "requests",
          retryAfterMs: msUntilReset,
        }).pipe(Effect.orDie);
        return yield* error;
      }
      if (updated.tokensThisMinute + estimatedTokens > config.tokensPerMinute) {
        const msUntilReset = rateWindowMillis - (now - updated.lastReset);
        const error = yield* RateLimitError.decodeUnknownEffect({
          reason: "tokens",
          retryAfterMs: msUntilReset,
        }).pipe(Effect.orDie);
        return yield* error;
      }
      yield* semaphore.take(1);
      yield* Ref.update(state, (s) =>
        RateLimiterState.make({
          ...s,
          requestsThisMinute: s.requestsThisMinute + 1,
          tokensThisMinute: s.tokensThisMinute + estimatedTokens,
        })
      );
    }),
    release: Effect.fn("CentralRateLimiter.release")(function* (_actualTokens: number, success: boolean) {
      yield* semaphore.release(1);
      const now = Number(yield* Clock.currentTimeMillis);
      yield* Ref.update(state, (s) => {
        if (success) {
          const newSuccessCount = s.successCount + 1;
          return RateLimiterState.make({
            ...s,
            successCount: newSuccessCount,
            failureCount: 0,
            circuitState:
              s.circuitState === "half_open" && newSuccessCount >= config.successThreshold ? "closed" : s.circuitState,
          });
        } else {
          const newFailureCount = s.failureCount + 1;
          const shouldOpen = newFailureCount >= config.failureThreshold;
          return RateLimiterState.make({
            ...s,
            failureCount: newFailureCount,
            successCount: 0,
            circuitState: shouldOpen ? "open" : s.circuitState,
            lastReset: shouldOpen ? now : s.lastReset,
          });
        }
      });
    }),
    getMetrics: Ref.get(state),
    getResetTime: Effect.gen(function* () {
      const s = yield* Ref.get(state);
      const now = Number(yield* Clock.currentTimeMillis);
      const elapsed = now - s.lastReset;
      return Duration.millis(N.max(0, rateWindowMillis - elapsed));
    }),
    setCircuitState: (circuitState: CircuitState) =>
      Ref.update(state, (s) =>
        RateLimiterState.make({
          ...s,
          circuitState,
          failureCount: circuitState === "closed" ? 0 : s.failureCount,
          successCount: circuitState === "closed" ? 0 : s.successCount,
        })
      ),
  };
});

/**
 * Default layer providing CentralRateLimiterService
 *
 * **Example** (Inspect central rate limiter service live)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { CentralRateLimiterService, CentralRateLimiterServiceLive } from "@effect-ontology/Service/LlmControl/RateLimiter"
 *
 * const program = Effect.gen(function* () {
 *   const limiter = yield* CentralRateLimiterService
 *   return limiter
 * }).pipe(Effect.provide(CentralRateLimiterServiceLive))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CentralRateLimiterServiceLive = Layer.effect(CentralRateLimiterService, make());

/**
 * Test layer with configurable limits (useful for faster tests)
 *
 * **Example** (Inspect central rate limiter service test)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { CentralRateLimiterService, CentralRateLimiterServiceTest } from "@effect-ontology/Service/LlmControl/RateLimiter"
 *
 * const program = Effect.gen(function* () {
 *   const limiter = yield* CentralRateLimiterService
 *   return limiter
 * }).pipe(Effect.provide(CentralRateLimiterServiceTest))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CentralRateLimiterServiceTest = (
  overrides: Partial<RateLimiterConfig> = {}
): Layer.Layer<CentralRateLimiterService> =>
  Layer.effect(CentralRateLimiterService, make(RateLimiterConfig.make({ ...DEFAULT_CONFIG, ...overrides })));
