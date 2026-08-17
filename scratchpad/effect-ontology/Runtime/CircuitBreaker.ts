/**
 * Runtime: Circuit Breaker for LLM Calls
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

import { Clock, Duration, Effect, Ref, Schema } from "effect";
import * as O from "effect/Option";
import { CircuitOpenError } from "../Domain/Error/Circuit.ts";

/**
 * Circuit breaker state
 */
export type CircuitState = "closed" | "open" | "half_open";

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /**
   * Number of consecutive failures before opening circuit
   */
  readonly maxFailures: number;
  /**
   * Time to wait before attempting recovery (half-open state)
   */
  readonly resetTimeout: Duration.Duration;
  /**
   * Number of successful calls needed to close circuit from half-open
   */
  readonly successThreshold: number;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  maxFailures: 5,
  resetTimeout: Duration.minutes(2),
  successThreshold: 2,
};

/**
 * Circuit breaker internal state
 */
interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
}

/**
 * Create a circuit breaker
 *
 * @param config - Circuit breaker configuration
 * @returns Scoped effect providing the circuit breaker
 */
export const makeCircuitBreaker = Effect.fn("makeCircuitBreaker")(function* (
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG
) {
  const stateRef = yield* Ref.make<CircuitBreakerState>({
    state: "closed",
    failureCount: 0,
    successCount: 0,
    lastFailureTime: 0,
  });
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
        });
        yield* Effect.logInfo("Circuit breaker closed after recovery", {
          successCount: newSuccessCount,
        });
      } else {
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          successCount: newSuccessCount,
        }));
      }
    } else if (current.state === "closed") {
      yield* Ref.update(stateRef, (s) => ({
        ...s,
        failureCount: 0,
      }));
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
      });
      yield* Effect.logWarning("Circuit breaker reopened after half-open failure");
    } else if (current.state === "closed") {
      const newFailureCount = current.failureCount + 1;
      if (newFailureCount >= config.maxFailures) {
        yield* Ref.set(stateRef, {
          state: "open",
          failureCount: newFailureCount,
          successCount: 0,
          lastFailureTime: Number(now),
        });
        yield* Effect.logWarning("Circuit breaker opened", {
          failureCount: newFailureCount,
          resetTimeoutMs: Duration.toMillis(config.resetTimeout),
        });
      } else {
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          failureCount: newFailureCount,
        }));
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
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          state: "half_open",
          successCount: 0,
        }));
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
                  const error = yield* Schema.decodeUnknownEffect(CircuitOpenError)({
                    resetTimeoutMs,
                    lastFailureTime: O.some(current.lastFailureTime),
                    retryAfterMs: O.some(Math.max(0, retryAfterMs)),
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
      }),
  };
});

/**
 * Type for the circuit breaker service
 */
export type CircuitBreaker = Effect.Success<ReturnType<typeof makeCircuitBreaker>>;

// Re-export CircuitOpenError for backward compatibility
export { CircuitOpenError } from "../Domain/Error/Circuit.ts";
