/**
 * Runtime: LLM Semaphore for Concurrency Control
 *
 * **Details**
 *
 * Provides fine-grained concurrency control for LLM API calls.
 * Complements rate limiting with connection-level limits.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Duration, Effect, Layer, Semaphore } from "effect";
import * as S from "effect/Schema";
import { ErrorMessage } from "../Domain/Error/Base.ts";
import { ConfigService } from "../Service/Config.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/LlmSemaphore");

/**
 * Error thrown when semaphore permit acquisition times out
 *
 * **Example** (Construct a permit-timeout failure)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { SemaphoreTimeoutError } from "@effect-ontology/Runtime/LlmSemaphore"
 *
 * const error = SemaphoreTimeoutError.make({
 *   message: "LLM semaphore permit acquisition timed out after 300000ms",
 *   waitDuration: Duration.seconds(5)
 * })
 * console.log(Duration.toMillis(error.waitDuration)) // 5000
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SemaphoreTimeoutError extends S.TaggedError<SemaphoreTimeoutError>($I`SemaphoreTimeoutError`)(
  "SemaphoreTimeoutError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable semaphore acquisition timeout diagnostic.",
    }),
    waitDuration: S.Duration.annotateKey({
      description: "Duration spent waiting for an LLM semaphore permit.",
    }),
  },
  $I.annote("SemaphoreTimeoutError", {
    description: "Failure raised when an LLM semaphore permit cannot be acquired before its deadline.",
  })
) {}

/**
 * Coordinates bounded concurrent LLM calls.
 *
 * **Details**
 *
 * Use this to wrap LLM calls for fine-grained concurrency control.
 * Works in conjunction with rate limiting.
 *
 * **Example** (Wrap a dummy LLM call with a permit)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { LlmSemaphoreService } from "@effect-ontology/Runtime/LlmSemaphore"
 * import { ConfigService, DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 *
 * const result = Effect.runSync(
 *   Effect.gen(function* () {
 *     const semaphore = yield* LlmSemaphoreService
 *     return yield* semaphore.withPermit(Effect.succeed("ok"))
 *   }).pipe(
 *     Effect.provide(LlmSemaphoreService.Default.pipe(Layer.provide(Layer.succeed(ConfigService, DEFAULT_CONFIG))))
 *   )
 * )
 * console.log(result) // "ok"
 * ```
 *
 * @category services
 * @since 0.0.0
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
                  SemaphoreTimeoutError.make({
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
