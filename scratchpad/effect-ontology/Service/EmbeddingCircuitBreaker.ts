/**
 * Embedding Circuit Breaker Service
 *
 * **Details**
 *
 * Provides circuit breaker protection for embedding provider API calls.
 * Each provider (Voyage, Nomic) gets its own circuit breaker instance
 * to prevent cascading failures and enable graceful fallback.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, PosInt, SchemaUtils } from "@beep/schema";
import { Context, Duration, Effect, HashMap, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { CircuitBreaker, CircuitOpenError } from "../Runtime/CircuitBreaker.ts";
import { CircuitState, makeCircuitBreaker } from "../Runtime/CircuitBreaker.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/EmbeddingCircuitBreaker");

// =============================================================================
// Types
// =============================================================================

/**
 * Supported embedding provider identifiers managed by circuit breakers.
 *
 *
 * **Example** (Use the EmbeddingProviderId contract)
 *
 * ```ts
 * import { EmbeddingProviderId } from "@effect-ontology/Service/EmbeddingCircuitBreaker"
 *
 * console.log(EmbeddingProviderId.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EmbeddingProviderId = LiteralKit(["voyage", "nomic", "openai"]).pipe(
  $I.annoteSchema("EmbeddingProviderId", {
    description: "Embedding providers managed by the circuit-breaker service.",
  })
);

/**
 * Runtime value accepted by {@link EmbeddingProviderId}.
 *
 * **Example** (Use an embedding provider identifier)
 *
 * ```ts
 * import type { EmbeddingProviderId } from "@effect-ontology/Service/EmbeddingCircuitBreaker"
 *
 * const provider: EmbeddingProviderId = "voyage"
 * console.log(provider)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingProviderId = typeof EmbeddingProviderId.Type;

/**
 * Provider-specific circuit breaker configuration
 *
 *
 * **Example** (Use the ProviderCircuitConfig contract)
 *
 * ```ts
 * import { ProviderCircuitConfig } from "@effect-ontology/Service/EmbeddingCircuitBreaker"
 *
 * const config = ProviderCircuitConfig.make({})
 * console.log(config.maxFailures) // 3
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ProviderCircuitConfig extends S.Class<ProviderCircuitConfig>($I`ProviderCircuitConfig`)(
  {
    maxFailures: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(3))),
    resetTimeout: S.Duration.pipe(SchemaUtils.withKeyDefaults(Duration.seconds(30))),
    successThreshold: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(2))),
  },
  $I.annote("ProviderCircuitConfig", {
    description: "Failure, recovery-delay, and recovery-success thresholds for an embedding provider.",
  })
) {}

/**
 * Circuit breaker status for observability
 *
 *
 * **Example** (Use the CircuitStatus contract)
 *
 * ```ts
 * import { CircuitStatus } from "@effect-ontology/Service/EmbeddingCircuitBreaker"
 *
 * const status = CircuitStatus.make({
 *   providerId: "nomic",
 *   state: "closed",
 *   isAvailable: true
 * })
 * console.log(status.state) // "closed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CircuitStatus extends S.Class<CircuitStatus>($I`CircuitStatus`)(
  {
    providerId: EmbeddingProviderId,
    state: CircuitState,
    isAvailable: S.Boolean,
  },
  $I.annote("CircuitStatus", {
    description: "Current circuit state and availability of one embedding provider.",
  })
) {}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default circuit breaker configuration for embedding providers
 *
 * **Example** (Inspect default embedding circuit config)
 *
 * ```ts
 * import { DEFAULT_EMBEDDING_CIRCUIT_CONFIG } from "@effect-ontology/Service/EmbeddingCircuitBreaker"
 *
 * console.log(DEFAULT_EMBEDDING_CIRCUIT_CONFIG)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_EMBEDDING_CIRCUIT_CONFIG: Record<EmbeddingProviderId, ProviderCircuitConfig> = {
  voyage: {
    maxFailures: PosInt.make(3),
    resetTimeout: Duration.seconds(30),
    successThreshold: PosInt.make(2),
  },
  nomic: ProviderCircuitConfig.make({
    maxFailures: PosInt.make(5),
    resetTimeout: Duration.minutes(1),
    successThreshold: PosInt.make(1),
  }),
  openai: ProviderCircuitConfig.make({}),
};

// =============================================================================
// Service
// =============================================================================

/**
 * Embedding Circuit Breaker Service
 *
 * **Details**
 *
 * Manages per-provider circuit breakers for embedding API calls.
 *
 *
 * @category type-level
 * @since 0.0.0
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
  ) => Effect.Effect<O.Option<EmbeddingProviderId>>;
  readonly reset: (providerId: EmbeddingProviderId) => Effect.Effect<void>;
  readonly resetAll: Effect.Effect<void>;
}

/**
 * Provides the embedding circuit breaker service capability.
 *
 * **Example** (Inspect embedding circuit breaker)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EmbeddingCircuitBreaker, EmbeddingCircuitBreakerLive } from "@effect-ontology/Service/EmbeddingCircuitBreaker"
 *
 * const program = Effect.gen(function* () {
 *   const breaker = yield* EmbeddingCircuitBreaker
 *   return breaker
 * }).pipe(Effect.provide(EmbeddingCircuitBreakerLive))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
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
        return yield* O.match(HashMap.get(circuits, providerId), {
          onNone: Effect.fn("EmbeddingCircuitBreaker.getOrCreateCircuit.onNone")(function* () {
            const config = DEFAULT_EMBEDDING_CIRCUIT_CONFIG[providerId];
            const circuit = yield* makeCircuitBreaker(config);
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
      const protect = Effect.fn("EmbeddingCircuitBreaker.protect")(function* <A, E, R>(
        providerId: EmbeddingProviderId,
        effect: Effect.Effect<A, E, R>
      ) {
        const circuit = yield* getOrCreateCircuit(providerId);
        return yield* circuit.protect(effect);
      });

      /**
       * Get circuit status for a provider
       */
      const getStatus = Effect.fn("EmbeddingCircuitBreaker.getStatus")(function* (
        providerId: EmbeddingProviderId
      ): Effect.fn.Return<CircuitStatus> {
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

        return yield* Effect.all(
          A.map(entries, ([providerId, circuit]) =>
            circuit.getState().pipe(
              Effect.map((state) => ({
                providerId,
                state,
                isAvailable: state !== "open",
              }))
            )
          ),
          { concurrency: "unbounded" }
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
      const findAvailableProvider = Effect.fn("EmbeddingCircuitBreaker.findAvailableProvider")(function* (
        providers: ReadonlyArray<EmbeddingProviderId>
      ): Effect.fn.Return<O.Option<EmbeddingProviderId>> {
        for (const providerId of providers) {
          const available = yield* isAvailable(providerId);
          if (available) {
            return O.some(providerId);
          }
        }
        return O.none();
      });

      /**
       * Reset a provider's circuit (for testing/recovery)
       */
      const reset = (providerId: EmbeddingProviderId): Effect.Effect<void> =>
        Ref.get(circuitsRef).pipe(
          Effect.flatMap((circuits) =>
            HashMap.get(circuits, providerId).pipe(
              O.match({
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
 * **Example** (Inspect embedding circuit breaker live)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EmbeddingCircuitBreaker, EmbeddingCircuitBreakerLive } from "@effect-ontology/Service/EmbeddingCircuitBreaker"
 *
 * const program = Effect.gen(function* () {
 *   const breaker = yield* EmbeddingCircuitBreaker
 *   return breaker
 * }).pipe(Effect.provide(EmbeddingCircuitBreakerLive))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingCircuitBreakerLive: Layer.Layer<EmbeddingCircuitBreaker> = EmbeddingCircuitBreaker.Default;
