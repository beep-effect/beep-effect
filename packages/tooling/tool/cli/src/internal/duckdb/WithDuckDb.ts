/**
 * Schema-agnostic scoped DuckDB provider for the repo CLI.
 *
 * The command groups that read non-metrics DuckDB catalogs (Corpus, Research)
 * each open a connection with the same idiom: build {@link DuckDb.makeNodeLayer}
 * for a set of connection options, provide the resulting {@link DuckDb} service
 * to the work effect, and discharge the connection scope on completion. This
 * module hosts that idiom once, parameterized by the connection options so any
 * database path and native option map flows through. Callers keep their own
 * tagged error by mapping the failure channel after the wrapper — this variant
 * is deliberately schema-agnostic and imposes no metrics storage convention,
 * unlike `withAiMetricsDuckDb` in `@beep/repo-ai-metrics`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { Effect, Layer } from "effect";
import { dual } from "effect/Function";
import type { DuckDbConnectionOptions } from "@beep/duckdb";

/**
 * Run an effect against a scoped DuckDB connection.
 *
 * **Details**
 *
 * Builds {@link DuckDb.makeNodeLayer} for `options`, provides the resulting
 * {@link DuckDb} service to `effect`, and discharges the connection scope when
 * `effect` completes. The `DuckDb` requirement is removed from the returned
 * effect; the error channel and every other requirement pass through unchanged.
 *
 * **Example** (Scoped DuckDB query effect)
 *
 * ```ts
 * import { withDuckDb } from "@beep/repo-cli/internal/duckdb"
 * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
 * import { Effect } from "effect"
 *
 * const rows = Effect.gen(function* () {
 *   const duckdb = yield* DuckDb
 *   return yield* duckdb.query("SELECT 1 AS ok")
 * })
 *
 * const program = withDuckDb(rows, DuckDbConnectionOptions.make({ databasePath: ".beep/corpus/catalog.duckdb" }))
 * console.log(program)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const withDuckDb: {
  <A, E, R>(effect: Effect.Effect<A, E, R>, options: DuckDbConnectionOptions): Effect.Effect<A, E, Exclude<R, DuckDb>>;
  (
    options: DuckDbConnectionOptions
  ): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, DuckDb>>;
} = dual(
  2,
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    options: DuckDbConnectionOptions
  ): Effect.Effect<A, E, Exclude<R, DuckDb>> =>
    Effect.scoped(
      Layer.build(DuckDb.makeNodeLayer(options)).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
    )
);
