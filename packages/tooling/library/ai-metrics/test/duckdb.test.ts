import { DuckDb } from "@beep/duckdb";
import { aiMetricsDerivedDuckDbPath, DEFAULT_AI_METRICS_DATA_ROOT, withAiMetricsDuckDb } from "@beep/repo-ai-metrics";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()),
    use,
    (tmpDir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(tmpDir, { recursive: true, force: true }))
  );

const makeDerivedDuckDbPath = Effect.fn("makeDerivedDuckDbPath")(function* (tmpDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dbPath = aiMetricsDerivedDuckDbPath(path.join(tmpDir, "metrics"));
  yield* fs.makeDirectory(path.dirname(dbPath), { recursive: true });
  return dbPath;
});

describe("@beep/repo-ai-metrics duckdb helpers", () => {
  it("resolves the derived-store path under a data root", () => {
    expect(DEFAULT_AI_METRICS_DATA_ROOT).toBe(".beep/ai-metrics");
    expect(aiMetricsDerivedDuckDbPath(DEFAULT_AI_METRICS_DATA_ROOT)).toBe(".beep/ai-metrics/derived/ai-metrics.duckdb");
    expect(aiMetricsDerivedDuckDbPath("/srv/data/ai-metrics")).toBe("/srv/data/ai-metrics/derived/ai-metrics.duckdb");
  });

  it.effect("provides a scoped DuckDb connection to the wrapped effect (data-first)", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const dbPath = yield* makeDerivedDuckDbPath(tmpDir);
        const rows = yield* withAiMetricsDuckDb(
          Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* duckdb.run("CREATE TABLE metrics_probe (n INTEGER)");
            yield* duckdb.run("INSERT INTO metrics_probe VALUES (1), (2)");
            return yield* duckdb.query("SELECT n FROM metrics_probe ORDER BY n ASC");
          }),
          dbPath
        );

        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.n)).toEqual([1, 2]);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("provides a scoped DuckDb connection to the wrapped effect (data-last)", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const dbPath = yield* makeDerivedDuckDbPath(tmpDir);
        const rows = yield* Effect.gen(function* () {
          const duckdb = yield* DuckDb;
          return yield* duckdb.query("SELECT 7 AS n");
        }).pipe(withAiMetricsDuckDb(dbPath));

        expect(rows[0]?.n).toBe(7);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
});
