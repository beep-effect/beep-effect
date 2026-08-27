/**
 * Rate Limiter for Embedding APIs
 *
 * **Details**
 *
 * Provides RPM (requests per minute) and concurrency limiting for embedding providers.
 * Uses Effect patterns: Semaphore for concurrency, Ref + Clock for sliding window.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Clock, Context, Effect, Layer, Ref, Semaphore } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
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
 *
 * **Example** (Create embedding rate limits)
 *
 * ```ts
 * import { EmbeddingRateLimiterConfig } from "@effect-ontology/Service/EmbeddingRateLimiter"
 *
 * const limits = EmbeddingRateLimiterConfig.make({ provider: "nomic", requestsPerMinute: 100, maxConcurrent: 4 })
 * console.log(limits.maxConcurrent) // 4
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class EmbeddingRateLimiterConfig extends S.Class<EmbeddingRateLimiterConfig>($I`EmbeddingRateLimiterConfig`)(
  {
    provider: S.NonEmptyString,
    requestsPerMinute: S.Int.check(S.isGreaterThan(0, { message: "Requests per minute must be positive." })),
    maxConcurrent: S.Int.check(S.isGreaterThan(0, { message: "Maximum concurrency must be positive." })),
  },
  $I.annote("EmbeddingRateLimiterConfig", {
    description: "Positive request-rate and concurrency limits for one named embedding provider.",
  })
) {}

/**
 * Default configuration for Voyage AI (100 RPM, 10 concurrent)
 *
 * **Example** (Inspect voyage rate limits)
 *
 * ```ts
 * import { VOYAGE_RATE_LIMITS } from "@effect-ontology/Service/EmbeddingRateLimiter"
 *
 * console.log(VOYAGE_RATE_LIMITS)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VOYAGE_RATE_LIMITS: EmbeddingRateLimiterConfig = {
  provider: "voyage",
  requestsPerMinute: 100,
  maxConcurrent: 10,
};

/**
 * Default configuration for local models (effectively unlimited)
 *
 * **Example** (Inspect local rate limits)
 *
 * ```ts
 * import { LOCAL_RATE_LIMITS } from "@effect-ontology/Service/EmbeddingRateLimiter"
 *
 * console.log(LOCAL_RATE_LIMITS)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LOCAL_RATE_LIMITS: EmbeddingRateLimiterConfig = {
  provider: "nomic",
  requestsPerMinute: 10000,
  maxConcurrent: 50,
};

/**
 * EmbeddingRateLimiter service interface
 *
 * **Example** (Read deterministic rate-limit metrics)
 *
 * ```ts
 * import type { EmbeddingRateLimiterMethods } from "@effect-ontology/Service/EmbeddingRateLimiter"
 * import * as Effect from "effect/Effect"
 *
 * const limiter: EmbeddingRateLimiterMethods = {
 *   acquire: Effect.void,
 *   release: Effect.void,
 *   getMetrics: Effect.succeed({ requestsThisMinute: 2, msUntilReset: 500 })
 * }
 * console.log(Effect.runSync(limiter.getMetrics).requestsThisMinute) // 2
 * ```
 *
 * @category type-level
 * @since 0.0.0
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
 * Context tag for RPM and concurrency limits around embedding calls.
 *
 * **Example** (Acquire a no-op permit)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EmbeddingRateLimiter, EmbeddingRateLimiterNoop } from "@effect-ontology/Service/EmbeddingRateLimiter"
 *
 * const metrics = Effect.runSync(
 *   Effect.gen(function* () {
 *     const limiter = yield* EmbeddingRateLimiter
 *     yield* limiter.acquire
 *     yield* limiter.release
 *     return yield* limiter.getMetrics
 *   }).pipe(Effect.provide(EmbeddingRateLimiterNoop), Effect.orDie)
 * )
 * console.log(metrics.requestsThisMinute) // 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EmbeddingRateLimiter extends Context.Service<EmbeddingRateLimiter, EmbeddingRateLimiterMethods>()(
  $I`EmbeddingRateLimiter`
) {}

/**
 * Build an embedding rate-limiter layer from explicit RPM and concurrency caps.
 *
 * **Example** (Count one acquired request)
 *
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   EmbeddingRateLimiter,
 *   EmbeddingRateLimiterConfig,
 *   makeEmbeddingRateLimiter
 * } from "@effect-ontology/Service/EmbeddingRateLimiter"
 *
 * const metrics = Effect.runSync(
 *   Effect.gen(function* () {
 *     const limiter = yield* EmbeddingRateLimiter
 *     yield* limiter.acquire
 *     yield* limiter.release
 *     return yield* limiter.getMetrics
 *   }).pipe(
 *     Effect.provide(
 *       makeEmbeddingRateLimiter(
 *         EmbeddingRateLimiterConfig.make({
 *           provider: "nomic",
 *           requestsPerMinute: 100,
 *           maxConcurrent: 4
 *         })
 *       )
 *     ),
 *     Effect.orDie
 *   )
 * )
 * console.log(metrics.requestsThisMinute) // 1
 * ```
 *
 * @param config - Rate limiter configuration
 * @category layers
 * @since 0.0.0
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
 * Voyage RPM/concurrency limiter using {@link VOYAGE_RATE_LIMITS}.
 *
 * **Example** (Acquire under Voyage limits)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EmbeddingRateLimiter, EmbeddingRateLimiterVoyage } from "@effect-ontology/Service/EmbeddingRateLimiter"
 *
 * const metrics = Effect.runSync(
 *   Effect.gen(function* () {
 *     const limiter = yield* EmbeddingRateLimiter
 *     yield* limiter.acquire
 *     yield* limiter.release
 *     return yield* limiter.getMetrics
 *   }).pipe(Effect.provide(EmbeddingRateLimiterVoyage), Effect.orDie)
 * )
 * console.log(metrics.requestsThisMinute) // 1
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingRateLimiterVoyage = makeEmbeddingRateLimiter(VOYAGE_RATE_LIMITS);

/**
 * High-cap limiter for local embedding models.
 *
 * **Example** (Acquire under local limits)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EmbeddingRateLimiter, EmbeddingRateLimiterLocal } from "@effect-ontology/Service/EmbeddingRateLimiter"
 *
 * const metrics = Effect.runSync(
 *   Effect.gen(function* () {
 *     const limiter = yield* EmbeddingRateLimiter
 *     yield* limiter.acquire
 *     yield* limiter.release
 *     return yield* limiter.getMetrics
 *   }).pipe(Effect.provide(EmbeddingRateLimiterLocal), Effect.orDie)
 * )
 * console.log(metrics.requestsThisMinute) // 1
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingRateLimiterLocal = makeEmbeddingRateLimiter(LOCAL_RATE_LIMITS);

/**
 * Test limiter that never delays or rejects acquire.
 *
 * **Example** (Observe unchanged metrics)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EmbeddingRateLimiter, EmbeddingRateLimiterNoop } from "@effect-ontology/Service/EmbeddingRateLimiter"
 *
 * const metrics = Effect.runSync(
 *   Effect.gen(function* () {
 *     const limiter = yield* EmbeddingRateLimiter
 *     yield* limiter.acquire
 *     return yield* limiter.getMetrics
 *   }).pipe(Effect.provide(EmbeddingRateLimiterNoop), Effect.orDie)
 * )
 * console.log(metrics.requestsThisMinute) // 0
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingRateLimiterNoop: Layer.Layer<EmbeddingRateLimiter> = Layer.succeed(EmbeddingRateLimiter, {
  acquire: Effect.void,
  release: Effect.void,
  getMetrics: Effect.succeed({ requestsThisMinute: 0, msUntilReset: 60000 }),
});
