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
 * Shutdown configuration
 *
 *
 * **Example** (Use the ShutdownConfig contract)
 *
 * ```ts
 * import type { ShutdownConfig } from "@effect-ontology/Runtime/Shutdown"
 *
 * const acceptsShutdownConfig = (_value: ShutdownConfig): void => undefined
 *
 * console.log(acceptsShutdownConfig)
 * ```
 *
 * @category type-level
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
 * **Example** (Inspect default shutdown config)
 *
 * ```ts
 * import { DEFAULT_SHUTDOWN_CONFIG } from "@effect-ontology/Runtime/Shutdown"
 *
 * console.log(DEFAULT_SHUTDOWN_CONFIG)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_SHUTDOWN_CONFIG = ShutdownConfig.make({});

/**
 * Error thrown when request is rejected during shutdown
 *
 * **Example** (Inspect shutdown error)
 *
 * ```ts
 * import { ShutdownError } from "@effect-ontology/Runtime/Shutdown"
 *
 * console.log(ShutdownError)
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
 * Create a graceful shutdown handler
 *
 * Tracks in-flight requests and provides drain functionality
 * for clean pod termination.
 *
 * @param config - Shutdown configuration
 * @returns Effect providing the shutdown handler
 *
 * **Example** (Use ShutdownService)
 * ```ts
 * const shutdown = yield* makeGracefulShutdown()
 *
 * // Wrap all requests
 * const result = yield* shutdown.trackRequest(myEffect)
 *
 * // On SIGTERM
 * yield* shutdown.initiateShutdown()
 * yield* shutdown.drain()
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
/**
 * Shutdown Service
 *
 * **Example** (Inspect shutdown service)
 *
 * ```ts
 * import { ShutdownService } from "@effect-ontology/Runtime/Shutdown"
 *
 * console.log(ShutdownService)
 * ```
 *
 * @category layers
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
