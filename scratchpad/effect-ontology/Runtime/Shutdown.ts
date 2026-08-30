/**
 * Runtime: Graceful Shutdown Handler
 *
 * **Details**
 *
 * Provides graceful shutdown with request draining for cloud deployment.
 * Ensures in-flight requests complete before pod termination.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Context, Duration, Effect, Layer, Ref } from "effect";
import * as S from "effect/Schema";
import { ErrorMessage } from "../Domain/Error/Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/Shutdown");

/**
 * Maximum duration allowed for graceful in-flight request draining.
 *
 * **Example** (Construct a 30-second drain config)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { ShutdownConfig } from "@effect-ontology/Runtime/Shutdown"
 *
 * const config = ShutdownConfig.make({ drainTimeout: Duration.seconds(30) })
 * console.log(Duration.toMillis(config.drainTimeout)) // 30000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShutdownConfig extends S.Class<ShutdownConfig>($I`ShutdownConfig`)(
  {
    drainTimeout: S.Duration.pipe(SchemaUtils.withKeyDefaults(Duration.seconds(30))),
  },
  $I.annote("ShutdownConfig", {
    description: "Maximum duration allowed for graceful in-flight request draining.",
  })
) {}

/**
 * Default shutdown configuration
 *
 * **Example** (Read the default drain timeout)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { DEFAULT_SHUTDOWN_CONFIG } from "@effect-ontology/Runtime/Shutdown"
 *
 * console.log(Duration.toMillis(DEFAULT_SHUTDOWN_CONFIG.drainTimeout)) // 30000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_SHUTDOWN_CONFIG = ShutdownConfig.make({});

/**
 * Error thrown when request is rejected during shutdown
 *
 * **Example** (Construct a reject-during-shutdown failure)
 *
 * ```ts
 * import { ShutdownError } from "@effect-ontology/Runtime/Shutdown"
 *
 * const error = ShutdownError.make({
 *   message: "Service is shutting down, not accepting new requests"
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ShutdownError extends S.TaggedError<ShutdownError>($I`ShutdownError`)(
  "ShutdownError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable reason a new request was rejected during shutdown.",
    }),
  },
  $I.annote("ShutdownError", {
    description: "Failure raised when a request arrives after graceful shutdown has begun.",
  })
) {}

/**
 * Tracks in-flight requests and rejects new work after graceful shutdown starts.
 *
 * **Details**
 *
 * `trackRequest` increments the in-flight counter, runs the request, then
 * decrements it. After `initiateShutdown`, later `trackRequest` calls fail with
 * {@link ShutdownError}. `drain` waits until the counter is zero or
 * {@link DEFAULT_SHUTDOWN_CONFIG} times out.
 *
 * **Example** (Reject a request after shutdown starts)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ShutdownService } from "@effect-ontology/Runtime/Shutdown"
 *
 * const rejected = Effect.runSync(
 *   Effect.gen(function* () {
 *     const shutdown = yield* ShutdownService
 *     yield* shutdown.initiateShutdown
 *     return yield* shutdown.trackRequest(Effect.succeed("ok")).pipe(
 *       Effect.catchTag("ShutdownError", (error) => Effect.succeed(error.message))
 *     )
 *   }).pipe(Effect.provide(ShutdownService.Default))
 * )
 * console.log(rejected)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ShutdownService extends Context.Service<ShutdownService>()($I`ShutdownService`, {
  make: Effect.gen(function* () {
    const inFlightRef = yield* Ref.make(0);
    const shuttingDownRef = yield* Ref.make(false);
    const config = DEFAULT_SHUTDOWN_CONFIG; // could be injected

    return {
      /**
       * Track a request for graceful shutdown
       */
      trackRequest: Effect.fn("ShutdownService.trackRequest")(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
        const isShuttingDown = yield* Ref.get(shuttingDownRef);
        if (isShuttingDown) {
          return yield* ShutdownError.make({
            message: "Service is shutting down, not accepting new requests",
          });
        }

        yield* Ref.update(inFlightRef, (n) => n + 1);

        return yield* effect.pipe(Effect.ensuring(Ref.update(inFlightRef, (n) => n - 1)));
      }),

      /**
       * Get current in-flight request count
       */
      inFlightCount: Ref.get(inFlightRef),

      /**
       * Initiate shutdown - stop accepting new requests
       */
      initiateShutdown: Effect.gen(function* () {
        yield* Ref.set(shuttingDownRef, true);
        yield* Effect.logInfo("Graceful shutdown initiated");
      }),

      /**
       * Check if shutdown has been initiated
       */
      isShuttingDown: Ref.get(shuttingDownRef),

      /**
       * Drain in-flight requests with timeout
       */
      drain: Effect.gen(function* () {
        yield* Effect.logInfo("Draining in-flight requests");

        // Poll until no in-flight requests or timeout
        yield* Effect.gen(function* () {
          let remaining = yield* Ref.get(inFlightRef);
          while (remaining > 0) {
            yield* Effect.sleep(Duration.millis(100));
            remaining = yield* Ref.get(inFlightRef);
          }
        }).pipe(
          Effect.timeout(config.drainTimeout),
          Effect.catch(
            Effect.fnUntraced(function* () {
              const remaining = yield* Ref.get(inFlightRef);
              yield* Effect.logWarning("Drain timeout exceeded", {
                remainingRequests: remaining,
                timeout: Duration.format(config.drainTimeout),
              });
            })
          )
        );

        yield* Effect.logInfo("Drain complete");
      }),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
