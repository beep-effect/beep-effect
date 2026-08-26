/**
 * Barrel re-exports for `@beep/observability`.
 *
 * **Details**
 *
 * Provides diagnostics, logging, HTTP errors, metric helpers, phase profiling,
 * and transport-safe schemas for Effect causes and exits.
 *
 * **Example** (Classify cause with logger)
 *
 * ```ts
 * import { Cause, Effect } from "effect"
 * import { classifyCause, layerConsoleLogger } from "@beep/observability"
 *
 * const classification = classifyCause(Cause.fail(new Error("boom")))
 *
 * const program = Effect.logInfo("classified failure", { classification }).pipe(
 *   Effect.provide(layerConsoleLogger({ format: "pretty", minLogLevel: "Info" }))
 * )
 *
 * Effect.runPromise(program)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Current version of the `@beep/observability` package.
 *
 * **Example** (Import package version)
 *
 * ```ts import.meta.vitest name="Import package version"
 * import { VERSION } from "@beep/observability"
 *
 * const version: string = VERSION
 * version // => "0.0.3"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.3" as const;

/**
 * Cause and exit diagnostic utilities.
 *
 * @since 0.0.0
 * @category diagnostics
 */
export * from "./CauseDiagnostics.ts";
/**
 * Safe, bounded redaction of errors and causes for logs, telemetry, and clients.
 *
 * @since 0.0.0
 * @category diagnostics
 */
export * from "./CauseRedaction.ts";
/**
 * Browser-safe shared observability configuration.
 *
 * @since 0.0.0
 * @category configuration
 */
export * from "./CoreConfig.ts";
/**
 * Typed HTTP error classes and convenience constructors.
 *
 * @since 0.0.0
 * @category error-handling
 */
export * from "./HttpError.ts";
/**
 * Configurable console logging layer.
 *
 * @since 0.0.0
 * @category observability
 */
export * from "./Logging.ts";
/**
 * Effect metric observation helpers.
 *
 * @since 0.0.0
 * @category observability
 */
export * from "./Metric.ts";
/**
 * Transport-safe schemas for errors, defects, causes, and exits.
 *
 * @since 0.0.0
 * @category observability
 */
export * from "./Observed.ts";
/**
 * Phase profiling with spans, logs, and optional metrics.
 *
 * @since 0.0.0
 * @category observability
 */
export * from "./PhaseProfiler.ts";
