/**
 * Embedding Circuit Breaker Service
 *
 * Provides circuit breaker protection for embedding provider API calls.
 * Each provider (Voyage, Nomic) gets its own circuit breaker instance
 * to prevent cascading failures and enable graceful fallback.
 *
 * @since 2.0.0
 * @module Service/EmbeddingCircuitBreaker
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Duration, Effect, HashMap, Layer, Option, Ref } from "effect";
import type { CircuitBreaker, CircuitBreakerConfig, CircuitOpenError } from "../Runtime/CircuitBreaker.ts";
import { makeCircuitBreaker } from "../Runtime/CircuitBreaker.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/EmbeddingCircuitBreaker");

// =============================================================================
// Types
// =============================================================================

/**
 * Supported embedding provider identifiers
 *
 * @since 2.0.0
 * @category Types
 */
export type EmbeddingProviderId = "voyage" | "nomic" | "openai";

/**
 * Provider-specific circuit breaker configuration
 *
 * @since 2.0.0
 * @category Types
 */
export interface ProviderCircuitConfig {
  /** Number of consecutive failures before opening circuit */
  readonly maxFailures: number;
  /** Time to wait before attempting recovery */
  readonly resetTimeoutMs: number;
  /** Number of successful calls needed to close circuit */
  readonly successThreshold: number;
}

/**
 * Circuit breaker status for observability
 *
 * @since 2.0.0
 * @category Types
 */
export interface CircuitStatus {
  readonly providerId: EmbeddingProviderId;
  readonly state: "closed" | "open" | "half_open";
  readonly isAvailable: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default circuit breaker configuration for embedding providers
 *
 * @since 2.0.0
 * @category Constants
 */
export const DEFAULT_EMBEDDING_CIRCUIT_CONFIG: Record<EmbeddingProviderId, ProviderCircuitConfig> = {
  voyage: {
    maxFailures: 3,
    resetTimeoutMs: 30_000, // 30 seconds
    successThreshold: 2,
  },
  nomic: {
    maxFailures: 5,
    resetTimeoutMs: 60_000, // 1 minute (local, more tolerant)
    successThreshold: 1,
  },
  openai: {
    maxFailures: 3,
    resetTimeoutMs: 30_000,
    successThreshold: 2,
  },
};

// =============================================================================
// Service
// =============================================================================

/**
 * Embedding Circuit Breaker Service
 *
 * Manages per-provider circuit breakers for embedding API calls.
 *
 * @since 2.0.0
 * @category Service
 */
export interface EmbeddingCircuitBreakerService {
  readonly protect: <A, E, R>(
    providerId: EmbeddingProviderId,
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | CircuitOpenError, R>;
  readonly getStatus: (providerId: EmbeddingProviderId) => Effect.Effect<CircuitStatus>;
  readonly getAllStatuses: Effect.Effect<ReadonlyArray<CircuitStatus>>;
  readonly isAvailable: (providerId: EmbeddingProviderId) => Effect.Effect<boolean>;
  readonly findAvailableProvider: (
    providers: ReadonlyArray<EmbeddingProviderId>
  ) => Effect.Effect<EmbeddingProviderId | null>;
  readonly reset: (providerId: EmbeddingProviderId) => Effect.Effect<void>;
  readonly resetAll: Effect.Effect<void>;
}

export class EmbeddingCircuitBreaker extends Context.Service<EmbeddingCircuitBreaker, EmbeddingCircuitBreakerService>()(
  $I`EmbeddingCircuitBreaker`,
  {
    make: Effect.gen(function* () {
      // Store circuit breakers per provider
      const circuitsRef = yield* Ref.make(HashMap.empty<EmbeddingProviderId, CircuitBreaker>());

      /**
       * Get or create circuit breaker for a provider
       */
      const getOrCreateCircuit = Effect.fn("EmbeddingCircuitBreaker.getOrCreateCircuit")(function* (
        providerId: EmbeddingProviderId
      ) {
        const circuits = yield* Ref.get(circuitsRef);
        return yield* Option.match(HashMap.get(circuits, providerId), {
          onNone: Effect.fn("EmbeddingCircuitBreaker.getOrCreateCircuit.onNone")(function* () {
            const config = DEFAULT_EMBEDDING_CIRCUIT_CONFIG[providerId];
            const circuitConfig: CircuitBreakerConfig = {
              maxFailures: config.maxFailures,
              resetTimeout: Duration.millis(config.resetTimeoutMs),
              successThreshold: config.successThreshold,
            };
            const circuit = yield* makeCircuitBreaker(circuitConfig);
            yield* Ref.update(circuitsRef, HashMap.set(providerId, circuit));
            yield* Effect.logDebug(`Created circuit breaker for ${providerId}`);
            return circuit;
          }),
          onSome: Effect.succeed,
        });
      });

      /**
       * Protect an effect with the provider's circuit breaker
       *
       * @param providerId - The embedding provider ID
       * @param effect - The effect to protect
       */
      const protect = Effect.fn(function* <A, E, R>(providerId: EmbeddingProviderId, effect: Effect.Effect<A, E, R>) {
        const circuit = yield* getOrCreateCircuit(providerId);
        return yield* circuit.protect(effect);
      });

      /**
       * Get circuit status for a provider
       */
      const getStatus = Effect.fn(function* (providerId: EmbeddingProviderId): Effect.fn.Return<CircuitStatus> {
        const circuit = yield* getOrCreateCircuit(providerId);
        const state = yield* circuit.getState();
        return {
          providerId,
          state,
          isAvailable: state !== "open",
        };
      });

      /**
       * Get status for all providers
       */
      const getAllStatuses: Effect.Effect<ReadonlyArray<CircuitStatus>> = Effect.gen(function* () {
        const circuits = yield* Ref.get(circuitsRef);
        const entries = HashMap.toEntries(circuits);

        if (entries.length === 0) {
          return [];
        }

        return yield* Effect.all(
          entries.map(([providerId, circuit]) =>
            circuit.getState().pipe(
              Effect.map((state) => ({
                providerId,
                state,
                isAvailable: state !== "open",
              }))
            )
          )
        );
      });

      /**
       * Check if a provider is available (circuit not open)
       */
      const isAvailable = (providerId: EmbeddingProviderId): Effect.Effect<boolean> =>
        getStatus(providerId).pipe(Effect.map((s) => s.isAvailable));

      /**
       * Find first available provider from a list
       */
      const findAvailableProvider = Effect.fn(function* (
        providers: ReadonlyArray<EmbeddingProviderId>
      ): Effect.fn.Return<EmbeddingProviderId | null> {
        for (const providerId of providers) {
          const available = yield* isAvailable(providerId);
          if (available) {
            return providerId;
          }
        }
        return null;
      });

      /**
       * Reset a provider's circuit (for testing/recovery)
       */
      const reset = (providerId: EmbeddingProviderId): Effect.Effect<void> =>
        Ref.get(circuitsRef).pipe(
          Effect.flatMap((circuits) =>
            HashMap.get(circuits, providerId).pipe(
              Option.match({
                onNone: () => Effect.void,
                onSome: (circuit) =>
                  circuit.reset().pipe(Effect.tap(() => Effect.logInfo(`Reset circuit breaker for ${providerId}`))),
              })
            )
          )
        );

      /**
       * Reset all circuits
       */
      const resetAll: Effect.Effect<void> = Effect.gen(function* () {
        const circuits = yield* Ref.get(circuitsRef);
        const entries = HashMap.toEntries(circuits);
        for (const [_, circuit] of entries) {
          yield* circuit.reset();
        }
        yield* Effect.logInfo("Reset all embedding circuit breakers");
      });

      return {
        protect,
        getStatus,
        getAllStatuses,
        isAvailable,
        findAvailableProvider,
        reset,
        resetAll,
      };
    }),
  }
) {
  static readonly Default = Layer.effect(this, this.make);
}

/**
 * Live layer for EmbeddingCircuitBreaker
 *
 * @since 2.0.0
 * @category Layers
 */
export const EmbeddingCircuitBreakerLive: Layer.Layer<EmbeddingCircuitBreaker> = EmbeddingCircuitBreaker.Default;
