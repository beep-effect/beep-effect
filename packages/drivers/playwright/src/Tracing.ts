/**
 * Effect service wrapper for Playwright trace and HAR recording.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { useHelper } from "./internal/use.ts";
import type * as Scope from "effect/Scope";
import type { Tracing as CoreTracing } from "playwright";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("Tracing");

/**
 * The tracing of a browser context, with trace and HAR recording as Effects.
 *
 * @category models
 * @since 0.0.0
 */
export interface TracingShape {
  /**
   * Starts tracing.
   *
   * @see {@link CoreTracing.start} for the wrapped Playwright method.
   */
  readonly start: (options?: Parameters<CoreTracing["start"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Starts a new tracing chunk.
   *
   * @see {@link CoreTracing.startChunk} for the wrapped Playwright method.
   */
  readonly startChunk: (options?: Parameters<CoreTracing["startChunk"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Starts a new tracing chunk and stops it when the current `Scope` closes. Tracing must already be started.
   * Pass `stopOptions.path` to save the chunk; a failure while stopping is logged instead of failing the scope.
   *
   * @param options - Options passed to `startChunk`.
   * @param stopOptions - Options passed to `stopChunk` when the scope closes.
   * @see {@link CoreTracing.startChunk} for the wrapped Playwright method.
   */
  readonly startChunkScoped: (
    options?: Parameters<CoreTracing["startChunk"]>[0],
    stopOptions?: Parameters<CoreTracing["stopChunk"]>[0]
  ) => Effect.Effect<void, PlaywrightError, Scope.Scope>;
  /**
   * Starts HAR recording.
   *
   * @see {@link CoreTracing.startHar} for the wrapped Playwright method.
   */
  readonly startHar: (options: Parameters<CoreTracing["startHar"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Starts tracing and stops it when the current `Scope` closes, so the trace is stopped even when the workflow
   * fails or is interrupted. Pass `stopOptions.path` to save the trace; without it Playwright discards the
   * recording. A failure while stopping is logged instead of failing the scope.
   *
   * @param options - Options passed to `start`.
   * @param stopOptions - Options passed to `stop` when the scope closes.
   * @see {@link CoreTracing.start} for the wrapped Playwright method.
   */
  readonly startScoped: (
    options?: Parameters<CoreTracing["start"]>[0],
    stopOptions?: Parameters<CoreTracing["stop"]>[0]
  ) => Effect.Effect<void, PlaywrightError, Scope.Scope>;
  /**
   * Stops tracing.
   *
   * @see {@link CoreTracing.stop} for the wrapped Playwright method.
   */
  readonly stop: (options?: Parameters<CoreTracing["stop"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Stops a tracing chunk.
   *
   * @see {@link CoreTracing.stopChunk} for the wrapped Playwright method.
   */
  readonly stopChunk: (options?: Parameters<CoreTracing["stopChunk"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Stops HAR recording.
   *
   * @see {@link CoreTracing.stopHar} for the wrapped Playwright method.
   */
  readonly stopHar: Effect.Effect<void, PlaywrightError>;
}

/**
 * Service for a {@link TracingShape}.
 *
 * **When to use**
 *
 * Prefer `startScoped` over pairing `start` with `stop`, so the trace is
 * stopped even when the workflow fails or is interrupted.
 *
 * **Gotchas**
 *
 * Pass `stopOptions.path` to save the trace; without it Playwright discards
 * the recording.
 *
 * **Example** (Trace for the lifetime of a scope)
 *
 * ```ts
 * import { Tracing } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const traced = Effect.gen(function* () {
 *   const tracing = yield* Tracing
 *   yield* tracing.startScoped({ screenshots: true, snapshots: true }, { path: "trace.zip" })
 * }).pipe(Effect.scoped)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Tracing extends Context.Service<Tracing, TracingShape>()($I`Tracing`) {}

/**
 * Creates `Tracing` from a Playwright `Tracing` instance.
 *
 * **Example** (Wrap a context's tracing)
 *
 * ```ts
 * import { makeTracing } from "@beep/playwright"
 * import type { BrowserContext } from "playwright"
 *
 * const stopTrace = (context: BrowserContext) => makeTracing(context.tracing).stop({ path: "trace.zip" })
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeTracing = (tracing: CoreTracing): TracingShape => {
  const use = useHelper(tracing);
  const start: TracingShape["start"] = Effect.fn("Tracing.start")((options) =>
    use((t) => t.start(options)).pipe(Effect.asVoid)
  );
  const startChunk: TracingShape["startChunk"] = Effect.fn("Tracing.startChunk")((options) =>
    use((t) => t.startChunk(options)).pipe(Effect.asVoid)
  );
  const stopChunk: TracingShape["stopChunk"] = Effect.fn("Tracing.stopChunk")((options) =>
    use((t) => t.stopChunk(options))
  );
  const stop: TracingShape["stop"] = Effect.fn("Tracing.stop")((options) => use((t) => t.stop(options)));

  return Tracing.of({
    start,
    startChunk,
    startScoped: Effect.fn("Tracing.startScoped")((options, stopOptions) =>
      Effect.acquireRelease(start(options), () => stop(stopOptions).pipe(Effect.ignore({ log: true })))
    ),
    startChunkScoped: Effect.fn("Tracing.startChunkScoped")((options, stopOptions) =>
      Effect.acquireRelease(startChunk(options), () => stopChunk(stopOptions).pipe(Effect.ignore({ log: true })))
    ),
    stopChunk,
    stop,
    startHar: Effect.fn("Tracing.startHar")((options) => use((t) => t.startHar(options)).pipe(Effect.asVoid)),
    stopHar: use((t) => t.stopHar()),
  });
};
