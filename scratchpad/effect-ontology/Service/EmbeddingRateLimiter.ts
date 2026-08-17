/**
 * Rate Limiter for Embedding APIs
 *
 * Provides RPM (requests per minute) and concurrency limiting for embedding providers.
 * Uses Effect patterns: Semaphore for concurrency, Ref + Clock for sliding window.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Clock, Context, Effect, Layer, Ref } from "effect";
import * as O from "effect/Option";
import * as Semaphore from "effect/Semaphore";
import { Milliseconds } from "../Domain/Error/Base.ts";
import { EmbeddingRateLimitError } from "../Domain/Error/Embedding.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/EmbeddingRateLimiter");

/**
 * Rate limiter state for sliding window
 *
 * @since 0.0.0
 * @category type-level
 */
interface RateLimiterState {
  /** Number of requests in current window */
  readonly count: number;
  /** Timestamp when window resets (ms since epoch) */
  readonly resetAt: number;
}

/**
 * Rate limiter configuration
 *
 * @since 0.0.0
 * @category type-level
 */
export interface EmbeddingRateLimiterConfig {
  /** Provider identifier for error messages */
  readonly provider: string;
  /** Requests per minute limit */
  readonly requestsPerMinute: number;
  /** Maximum concurrent requests */
  readonly maxConcurrent: number;
}

/**
 * Default configuration for Voyage AI (100 RPM, 10 concurrent)
 *
 * @since 0.0.0
 * @category constants
 */
export const VOYAGE_RATE_LIMITS: EmbeddingRateLimiterConfig = {
  provider: "voyage",
  requestsPerMinute: 100,
  maxConcurrent: 10,
};

/**
 * Default configuration for local models (effectively unlimited)
 *
 * @since 0.0.0
 * @category constants
 */
export const LOCAL_RATE_LIMITS: EmbeddingRateLimiterConfig = {
  provider: "nomic",
  requestsPerMinute: 10000,
  maxConcurrent: 50,
};

/**
 * EmbeddingRateLimiter service interface
 *
 * @since 0.0.0
 * @category services
 */
export interface EmbeddingRateLimiterMethods {
  /**
   * Acquire rate limit permit
   *
   * Blocks if at concurrency limit, fails if RPM exceeded.
   */
  readonly acquire: Effect.Effect<void, EmbeddingRateLimitError>;

  /**
   * Release permit after request completes
   */
  readonly release: Effect.Effect<void>;

  /**
   * Get current metrics
   */
  readonly getMetrics: Effect.Effect<{
    readonly requestsThisMinute: number;
    readonly msUntilReset: number;
  }>;
}

/**
 * EmbeddingRateLimiter service tag
 *
 * @since 0.0.0
 * @category services
 */
export class EmbeddingRateLimiter extends Context.Service<EmbeddingRateLimiter, EmbeddingRateLimiterMethods>()(
  $I`EmbeddingRateLimiter`
) {}

/**
 * Create a rate limiter layer with the given configuration
 *
 * @param config - Rate limiter configuration
 * @returns Layer providing EmbeddingRateLimiter
 *
 * @since 0.0.0
 * @category layers
 */
export const makeEmbeddingRateLimiter = (config: EmbeddingRateLimiterConfig): Layer.Layer<EmbeddingRateLimiter> =>
  Layer.effect(
    EmbeddingRateLimiter,
    Effect.gen(function* () {
      const semaphore = yield* Semaphore.make(config.maxConcurrent);
      const now = yield* Clock.currentTimeMillis;
      const stateRef = yield* Ref.make<RateLimiterState>({
        count: 0,
        resetAt: now + 60_000,
      });

      const maybeResetWindow = Effect.gen(function* () {
        const currentTime = yield* Clock.currentTimeMillis;
        yield* Ref.update(stateRef, (state) =>
          currentTime >= state.resetAt ? { count: 0, resetAt: currentTime + 60_000 } : state
        );
      });

      return {
        acquire: Effect.gen(function* () {
          yield* maybeResetWindow;
          const state = yield* Ref.get(stateRef);
          const currentTime = yield* Clock.currentTimeMillis;
          if (state.count >= config.requestsPerMinute) {
            return yield* EmbeddingRateLimitError.make({
              message: `Rate limit exceeded: ${config.requestsPerMinute} RPM`,
              provider: config.provider,
              retryAfterMs: O.some(Milliseconds.make(Math.max(0, state.resetAt - currentTime))),
            });
          }
          yield* semaphore.take(1);
          yield* Ref.update(stateRef, (s) => ({ ...s, count: s.count + 1 }));
        }),
        release: semaphore.release(1),
        getMetrics: Effect.gen(function* () {
          const currentTime = yield* Clock.currentTimeMillis;
          const state = yield* Ref.get(stateRef);
          return {
            requestsThisMinute: state.count,
            msUntilReset: Math.max(0, state.resetAt - currentTime),
          };
        }),
      };
    })
  );

/**
 * Default rate limiter for Voyage AI
 *
 * @since 0.0.0
 * @category layers
 */
export const EmbeddingRateLimiterVoyage = makeEmbeddingRateLimiter(VOYAGE_RATE_LIMITS);

/**
 * Rate limiter for local models (effectively unlimited)
 *
 * @since 0.0.0
 * @category layers
 */
export const EmbeddingRateLimiterLocal = makeEmbeddingRateLimiter(LOCAL_RATE_LIMITS);

/**
 * No-op rate limiter for testing
 *
 * @since 0.0.0
 * @category layers
 */
export const EmbeddingRateLimiterNoop: Layer.Layer<EmbeddingRateLimiter> = Layer.succeed(EmbeddingRateLimiter, {
  acquire: Effect.void,
  release: Effect.void,
  getMetrics: Effect.succeed({ requestsThisMinute: 0, msUntilReset: 60000 }),
});
