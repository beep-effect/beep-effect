/**
 * Test-only clock for the fixed source deadline; all other timers stay real.
 * @packageDocumentation
 */
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

/**
 * Capture the actual 110-second timeout without scheduling a real long timer.
 * @example
 * ```ts
 * console.log(typeof makeNativeDeadlineTestClock) // "function"
 * ```
 * @category testing
 * @since 0.0.0
 */
export const makeNativeDeadlineTestClock = Effect.fnUntraced(function* () {
  const real = yield* Clock.Clock;
  const requested = yield* Deferred.make<void>();
  const wake = yield* Deferred.make<void>();
  let intercepted = 0;
  const clock = {
    currentTimeMillisUnsafe: () => real.currentTimeMillisUnsafe(),
    currentTimeNanosUnsafe: () => real.currentTimeNanosUnsafe(),
    currentTimeMillis: real.currentTimeMillis,
    currentTimeNanos: real.currentTimeNanos,
    monotonicTimeNanosUnsafe: () => real.monotonicTimeNanosUnsafe(),
    monotonicTimeNanos: real.monotonicTimeNanos,
    sleep: (duration: Duration.Duration) =>
      Duration.equals(duration, Duration.millis(110000))
        ? Effect.sync(() => {
            intercepted++;
          }).pipe(Effect.andThen(Deferred.succeed(requested, undefined)), Effect.andThen(Deferred.await(wake)))
        : real.sleep(duration),
  } satisfies Clock.Clock;
  return {
    clock,
    trigger: Deferred.await(requested).pipe(Effect.andThen(Deferred.succeed(wake, undefined))),
    intercepted: () => intercepted,
    bound: <Value, Error, Requirements>(effect: Effect.Effect<Value, Error, Requirements>) =>
      effect.pipe(Effect.timeout("5 seconds"), Effect.provideService(Clock.Clock, real)),
  };
});
