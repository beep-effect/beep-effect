import { DuckDb } from "@beep/duckdb";
import { aiMetricsDerivedDuckDbPath, withAiMetricsDuckDb } from "@beep/repo-ai-metrics";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

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
    expect(aiMetricsDerivedDuckDbPath("/srv/data/ai-metrics")).toBe("/srv/data/ai-metrics/derived/ai-metrics.duckdb");
    expect(aiMetricsDerivedDuckDbPath("/home/dev/.local/state/beep/ai-metrics")).toBe(
      "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb"
    );
  });

  it.layer(NodeServices.layer)((it) => {
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
      )
    );
  });

  it.layer(NodeServices.layer)((it) => {
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
      )
    );
  });
});
