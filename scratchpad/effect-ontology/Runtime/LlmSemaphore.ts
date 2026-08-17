/**
 * Runtime: LLM Semaphore for Concurrency Control
 *
 * Provides fine-grained concurrency control for LLM API calls.
 * Complements rate limiting with connection-level limits.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Layer } from "effect";

const $I = $ScratchpadId.create("effect-ontology/Runtime/LlmSemaphore");

import { Data, Duration, Effect } from "effect";
import * as Semaphore from "effect/Semaphore";
import { ConfigService } from "../Service/Config.ts";

/**
 * Error thrown when semaphore permit acquisition times out
 *
 * @since 0.0.0
 * @category errors
 */
export class SemaphoreTimeoutError extends Data.TaggedError("SemaphoreTimeoutError")<{
  readonly message: string;
  readonly waitDuration: Duration.Duration;
}> {}

/**
 * LlmSemaphoreService - Concurrency control for LLM calls
 *
 * Use this to wrap LLM calls for fine-grained concurrency control.
 * Works in conjunction with rate limiting.
 *
 * **Example** (Use LlmSemaphoreService)
 * ```
 *
 * @since 0.0.0
 * @category services
 */
export class LlmSemaphoreService extends Context.Service<LlmSemaphoreService>()($I`LlmSemaphoreService`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const limit = config.runtime.llmConcurrencyLimit;

    const semaphore = yield* Semaphore.make(limit);

    yield* Effect.logInfo("LLM semaphore initialized", {
      concurrencyLimit: limit,
    });

    // Timeout for permit acquisition - prevents deadlock if permits never released
    const permitTimeout = Duration.minutes(5);

    return {
      /**
       * Execute effect with semaphore permit
       *
       * Acquires a permit before execution and releases after.
       * Times out if permit acquisition takes longer than 5 minutes.
       *
       * @throws SemaphoreTimeoutError if permit acquisition times out
       */
      withPermit: <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | SemaphoreTimeoutError, R> =>
        semaphore
          .withPermits(1)(effect)
          .pipe(
            Effect.timeoutOrElse({
              duration: permitTimeout,
              orElse: () =>
                Effect.fail(
                  new SemaphoreTimeoutError({
                    message: `LLM semaphore permit acquisition timed out after ${Duration.toMillis(permitTimeout)}ms`,
                    waitDuration: permitTimeout,
                  })
                ),
            })
          ),

      /**
       * Get number of available permits
       */
      availablePermits: Effect.succeed(limit), // Semaphore doesn't expose available, return max

      /**
       * Get the concurrency limit
       */
      limit: (): number => limit,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
