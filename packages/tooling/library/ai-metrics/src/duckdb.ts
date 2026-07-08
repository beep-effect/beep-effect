/**
 * Derived-store location and DuckDB provider helpers for repo AI metrics.
 *
 * @remarks
 * The AI-metrics workflows all read and write a single derived DuckDB database
 * that lives at a fixed offset under the local data root, and every consumer
 * opens it with the same scoped {@link DuckDb.makeNodeLayer} idiom: build the
 * node layer, provide it to the work effect, and discharge the connection scope
 * on completion. {@link aiMetricsDerivedDuckDbPath} owns the path shape and
 * {@link withAiMetricsDuckDb} owns the scoping idiom so call sites stop
 * re-deriving either. Callers keep their own error surface by mapping the
 * failure channel after the wrapper.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { Effect, Layer } from "effect";
import { dual } from "effect/Function";

/**
 * Default local data root for repo AI metrics storage.
 *
 * @example
 * ```ts
 * import { DEFAULT_AI_METRICS_DATA_ROOT, aiMetricsDerivedDuckDbPath } from "@beep/repo-ai-metrics"
 *
 * console.log(aiMetricsDerivedDuckDbPath(DEFAULT_AI_METRICS_DATA_ROOT))
 * // .beep/ai-metrics/derived/ai-metrics.duckdb
 * ```
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_AI_METRICS_DATA_ROOT = ".beep/ai-metrics";

/**
 * Resolve the derived DuckDB database path under an AI metrics data root.
 *
 * @param dataRoot - Local AI metrics data root, e.g. {@link DEFAULT_AI_METRICS_DATA_ROOT}.
 * @returns The `derived/ai-metrics.duckdb` path relative to `dataRoot`.
 * @example
 * ```ts
 * import { aiMetricsDerivedDuckDbPath } from "@beep/repo-ai-metrics"
 *
 * console.log(aiMetricsDerivedDuckDbPath(".beep/ai-metrics"))
 * // .beep/ai-metrics/derived/ai-metrics.duckdb
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsDerivedDuckDbPath = (dataRoot: string): string => `${dataRoot}/derived/ai-metrics.duckdb`;

/**
 * Run an effect against a scoped AI metrics DuckDB connection.
 *
 * @remarks
 * Builds {@link DuckDb.makeNodeLayer} for `databasePath`, provides the resulting
 * {@link DuckDb} service to `effect`, and discharges the connection scope when
 * `effect` completes. The `DuckDb` requirement is removed from the returned
 * effect; every other requirement, and the error channel, pass through
 * unchanged so callers keep their own typed failure by mapping afterwards.
 *
 * @example
 * ```ts
 * import { aiMetricsDerivedDuckDbPath, withAiMetricsDuckDb } from "@beep/repo-ai-metrics"
 * import { DuckDb } from "@beep/duckdb"
 * import { Effect } from "effect"
 *
 * const rowCount = Effect.gen(function* () {
 *   const duckdb = yield* DuckDb
 *   const rows = yield* duckdb.query("SELECT count(*) AS n FROM ai_metrics_ingest_runs")
 *   return rows.length
 * })
 *
 * const program = withAiMetricsDuckDb(rowCount, aiMetricsDerivedDuckDbPath(".beep/ai-metrics"))
 * console.log(program)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const withAiMetricsDuckDb: {
  <A, E, R>(effect: Effect.Effect<A, E, R>, databasePath: string): Effect.Effect<A, E, Exclude<R, DuckDb>>;
  (databasePath: string): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, DuckDb>>;
} = dual(
  2,
  <A, E, R>(effect: Effect.Effect<A, E, R>, databasePath: string): Effect.Effect<A, E, Exclude<R, DuckDb>> =>
    Effect.scoped(
      Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }))).pipe(
        Effect.flatMap((context) => effect.pipe(Effect.provide(context)))
      )
    )
);
