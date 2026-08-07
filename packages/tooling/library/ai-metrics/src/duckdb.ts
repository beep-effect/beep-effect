/**
 * Derived-store location and DuckDB provider helpers for repo AI metrics.
 *
 * **Details**
 *
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
 * Resolve the derived DuckDB database path under an AI metrics data root.
 *
 * **Details**
 *
 * The helper only shapes a path; it never invents a root. Resolve the root with
 * {@link resolveAiMetricsDataRoot} first, so the derived store always lands in
 * the canonical location rather than beside whichever clone is running.
 *
 * **Example** (Locating the derived store under a resolved root)
 *
 * ```ts
 * import { aiMetricsDerivedDuckDbPath } from "@beep/repo-ai-metrics"
 *
 * console.log(aiMetricsDerivedDuckDbPath("/home/dev/.local/state/beep/ai-metrics"))
 * // /home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb
 * ```
 *
 * @param dataRoot - Resolved AI metrics data root.
 * @returns The `derived/ai-metrics.duckdb` path beneath `dataRoot`.
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsDerivedDuckDbPath = (dataRoot: string): string => `${dataRoot}/derived/ai-metrics.duckdb`;

/**
 * Run an effect against a scoped AI metrics DuckDB connection.
 *
 * **Details**
 *
 * Builds {@link DuckDb.makeNodeLayer} for `databasePath`, provides the resulting
 * {@link DuckDb} service to `effect`, and discharges the connection scope when
 * `effect` completes. The `DuckDb` requirement is removed from the returned
 * effect; every other requirement, and the error channel, pass through
 * unchanged so callers keep their own typed failure by mapping afterwards.
 *
 * **Gotchas**
 *
 * Each call opens its own connection. Wrapping several small queries separately
 * pays the connection cost once per call, so batch related reads into a single
 * wrapped effect instead of wrapping each query.
 *
 * **Example** (Read a count through a discharged connection scope)
 *
 * ```ts
 * import { DuckDb } from "@beep/duckdb"
 * import { aiMetricsDerivedDuckDbPath, withAiMetricsDuckDb } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const rowCount = Effect.gen(function* () {
 *   const duckdb = yield* DuckDb
 *   const rows = yield* duckdb.query("SELECT count(*) AS n FROM ai_metrics_ingest_runs")
 *   return rows.length
 * })
 *
 * // `DuckDb` is discharged by the wrapper, so `runPromise` accepts the program directly.
 * const program = withAiMetricsDuckDb(
 *   rowCount,
 *   aiMetricsDerivedDuckDbPath("/home/dev/.local/state/beep/ai-metrics")
 * )
 *
 * Effect.runPromise(program).then((count: number) => console.log(count))
 * ```
 *
 * @see {@link aiMetricsDerivedDuckDbPath} for the derived database path this wrapper expects.
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
