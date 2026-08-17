/**
 * Runtime: Circuit Breaker for LLM Calls
 *
 * **Details**
 *
 * Provides circuit breaker protection for LLM API calls.
 * Opens after consecutive failures to prevent cascading issues.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failing fast, requests rejected immediately
 * - HALF_OPEN: Testing recovery, limited requests allowed
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, PosInt, SchemaUtils } from "@beep/schema";
import { Clock, Duration, Effect, Ref } from "effect";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CircuitOpenError } from "../Domain/Error/Circuit.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/CircuitBreaker");
const NonNegativeCounter = S.Finite.check(
  S.isGreaterThanOrEqualTo(0, { message: "Expected a non-negative circuit-breaker counter" })
);

/**
 * Circuit breaker state
 *
 *
 * **Example** (Use the CircuitState contract)
 *
 * ```ts
 * import type { CircuitState } from "@effect-ontology/Runtime/CircuitBreaker"
 *
 * const acceptsCircuitState = (_value: CircuitState): void => undefined
 *
 * console.log(acceptsCircuitState)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
/**
 * Runtime state of a circuit breaker.
 *
 * **Example** (Inspect circuit states)
 *
 * ```ts
 * import { CircuitState } from "@effect-ontology/Runtime/CircuitBreaker"
 *
 * console.log(CircuitState.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CircuitState = LiteralKit(["closed", "open", "half_open"]).pipe(
  $I.annoteSchema("CircuitState", {
    description: "Closed set of runtime circuit-breaker states.",
  })
);

/**
 * Runtime value accepted by {@link CircuitState}.
 *
 * **Example** (Use a circuit state)
 *
 * ```ts
 * import type { CircuitState } from "@effect-ontology/Runtime/CircuitBreaker"
 *
 * const state: CircuitState = "closed"
 * console.log(state)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CircuitState = typeof CircuitState.Type;

/**
 * Circuit breaker configuration
 *
 *
 * **Example** (Use the CircuitBreakerConfig contract)
 *
 * ```ts
 * import type { CircuitBreakerConfig } from "@effect-ontology/Runtime/CircuitBreaker"
 *
 * const acceptsCircuitBreakerConfig = (_value: CircuitBreakerConfig): void => undefined
 *
 * console.log(acceptsCircuitBreakerConfig)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class CircuitBreakerConfig extends S.Class<CircuitBreakerConfig>($I`CircuitBreakerConfig`)(
  {
    maxFailures: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(5))),
    resetTimeout: S.Duration.pipe(SchemaUtils.withKeyDefaults(Duration.minutes(2))),
    successThreshold: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(2))),
  },
  $I.annote("CircuitBreakerConfig", {
    description: "Failure, recovery-delay, and recovery-success thresholds for a circuit breaker.",
  })
) {}

/**
 * Constructor input accepted by {@link CircuitBreakerConfig}.
 *
 * **Example** (Configure a circuit breaker)
 *
 * ```ts
 * import type { CircuitBreakerConfigInput } from "@effect-ontology/Runtime/CircuitBreaker"
 *
 * const config: CircuitBreakerConfigInput = {}
 * console.log(config)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CircuitBreakerConfigInput = (typeof CircuitBreakerConfig)["~type.make.in"];

/**
 * Default circuit breaker configuration
 *
 * **Example** (Inspect default circuit config)
 *
 * ```ts
 * import { DEFAULT_CIRCUIT_CONFIG } from "@effect-ontology/Runtime/CircuitBreaker"
 *
 * console.log(DEFAULT_CIRCUIT_CONFIG)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_CIRCUIT_CONFIG = CircuitBreakerConfig.make({});

/**
 * Circuit breaker internal state
 */
class CircuitBreakerState extends S.Class<CircuitBreakerState>($I`CircuitBreakerState`)(
  {
    state: CircuitState,
    failureCount: NonNegativeCounter,
    successCount: NonNegativeCounter,
    lastFailureTime: NonNegativeCounter,
  },
  $I.annote("CircuitBreakerState", {
    description: "Mutable runtime counters and state held by a circuit breaker Ref.",
  })
) {}

/**
 * Create a circuit breaker
 *
 * **Example** (Inspect make circuit breaker)
 *
 * ```ts
 * import { makeCircuitBreaker } from "@effect-ontology/Runtime/CircuitBreaker"
 *
 * console.log(makeCircuitBreaker)
 * ```
 *
 * @param config - Circuit breaker configuration
 * @returns Scoped effect providing the circuit breaker
 * @category constructors
 * @since 0.0.0
 */
export const makeCircuitBreaker = Effect.fn("makeCircuitBreaker")(function* (input: CircuitBreakerConfigInput = {}) {
  const config = CircuitBreakerConfig.make(input);
  const stateRef = yield* Ref.make<CircuitBreakerState>(
    CircuitBreakerState.make({
      state: "closed",
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
    })
  );
  const getState = Ref.get(stateRef);
  const recordSuccess = Effect.gen(function* () {
    const current = yield* getState;
    if (current.state === "half_open") {
      const newSuccessCount = current.successCount + 1;
      if (newSuccessCount >= config.successThreshold) {
        yield* Ref.set(stateRef, {
          state: "closed",
          failureCount: 0,
          successCount: 0,
          lastFailureTime: 0,
        } satisfies CircuitBreakerState);
        yield* Effect.logInfo("Circuit breaker closed after recovery", {
          successCount: newSuccessCount,
        });
      } else {
        yield* Ref.update(
          stateRef,
          (s): CircuitBreakerState => ({
            ...s,
            successCount: newSuccessCount,
          })
        );
      }
    } else if (current.state === "closed") {
      yield* Ref.update(
        stateRef,
        (s): CircuitBreakerState => ({
          ...s,
          failureCount: 0,
        })
      );
    }
  });
  const recordFailure = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const current = yield* getState;
    if (current.state === "half_open") {
      yield* Ref.set(stateRef, {
        state: "open",
        failureCount: config.maxFailures,
        successCount: 0,
        lastFailureTime: Number(now),
      } satisfies CircuitBreakerState);
      yield* Effect.logWarning("Circuit breaker reopened after half-open failure");
    } else if (current.state === "closed") {
      const newFailureCount = current.failureCount + 1;
      if (newFailureCount >= config.maxFailures) {
        yield* Ref.set(stateRef, {
          state: "open",
          failureCount: newFailureCount,
          successCount: 0,
          lastFailureTime: Number(now),
        } satisfies CircuitBreakerState);
        yield* Effect.logWarning("Circuit breaker opened", {
          failureCount: newFailureCount,
          resetTimeoutMs: Duration.toMillis(config.resetTimeout),
        });
      } else {
        yield* Ref.update(
          stateRef,
          (s): CircuitBreakerState => ({
            ...s,
            failureCount: newFailureCount,
          })
        );
      }
    }
  });
  const canAttempt = Effect.gen(function* () {
    const current = yield* getState;
    const now = yield* Clock.currentTimeMillis;
    if (current.state === "closed") {
      return true;
    }
    if (current.state === "open") {
      const elapsed = Number(now) - current.lastFailureTime;
      if (elapsed >= Duration.toMillis(config.resetTimeout)) {
        yield* Ref.update(
          stateRef,
          (s): CircuitBreakerState => ({
            ...s,
            state: "half_open",
            successCount: 0,
          })
        );
        yield* Effect.logInfo("Circuit breaker entering half-open state");
        return true;
      }
      return false;
    }
    return true;
  });
  return {
    protect: <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | CircuitOpenError, R> =>
      canAttempt.pipe(
        Effect.flatMap(
          (allowed): Effect.Effect<A, E | CircuitOpenError, R> =>
            allowed
              ? effect.pipe(
                  Effect.tap(() => recordSuccess),
                  Effect.tapError(() => recordFailure)
                )
              : Effect.gen(function* () {
                  const current = yield* getState;
                  const now = yield* Clock.currentTimeMillis;
                  const resetTimeoutMs = Duration.toMillis(config.resetTimeout);
                  const retryAfterMs = resetTimeoutMs - (Number(now) - current.lastFailureTime);
                  const error = yield* CircuitOpenError.decodeUnknownEffect({
                    resetTimeoutMs,
                    lastFailureTime: O.some(current.lastFailureTime),
                    retryAfterMs: O.some(N.max(0)(retryAfterMs)),
                  }).pipe(Effect.orDie);
                  return yield* error;
                })
        )
      ),
    getState: () => Ref.get(stateRef).pipe(Effect.map((s) => s.state)),
    reset: () =>
      Ref.set(stateRef, {
        state: "closed",
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
      } satisfies CircuitBreakerState),
  };
});

/**
 * Type for the circuit breaker service
 *
 *
 * **Example** (Use the CircuitBreaker contract)
 *
 * ```ts
 * import type { CircuitBreaker } from "@effect-ontology/Runtime/CircuitBreaker"
 *
 * const acceptsCircuitBreaker = (_value: CircuitBreaker): void => undefined
 *
 * console.log(acceptsCircuitBreaker)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CircuitBreaker = Effect.Success<ReturnType<typeof makeCircuitBreaker>>;

// Re-export CircuitOpenError for backward compatibility
export { CircuitOpenError } from "../Domain/Error/Circuit.ts";
