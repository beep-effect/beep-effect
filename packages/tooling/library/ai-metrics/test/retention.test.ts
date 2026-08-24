import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { AiMetricsDerivedStorageWriteResult } from "@beep/repo-ai-metrics/derived-storage";
import {
  AiMetricsRetentionEnforcementPolicy,
  AiMetricsRetentionEnforcementResult,
  AiMetricsRetentionInventory,
  AiMetricsRetentionMutationResult,
  AiMetricsRetentionRestoreDrillResult,
  AiMetricsRetentionSelector,
  runAiMetricsRetentionDelete,
} from "@beep/repo-ai-metrics/retention";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeRetentionInventoryResult = S.decodeUnknownResult(AiMetricsRetentionInventory);
const decodeDerivedStorageWriteResult = S.decodeUnknownResult(AiMetricsDerivedStorageWriteResult);
const encodeDerivedStorageWriteResult = S.encodeUnknownResult(AiMetricsDerivedStorageWriteResult);
const DerivedStorageWriteResultArbitrary = S.toArbitrary(AiMetricsDerivedStorageWriteResult)(fc);
const isDerivedStorageWriteResult = S.is(AiMetricsDerivedStorageWriteResult);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    Effect.fnUntraced(function* (tmpDir) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.remove(tmpDir, { recursive: true, force: true });
    })
  );

it("enforces retention policy, window, version, and Parquet-table invariants at construction or decode", () => {
  expect(() =>
    AiMetricsRetentionEnforcementPolicy.make({ dataRoot: "/tmp/metrics", maxSnapshotExports: -1 })
  ).toThrow();
  expect(() =>
    AiMetricsRetentionMutationResult.make({
      deletedDerivedExportCount: -1,
      deletedRawArchiveObjectCount: 0,
      deletedReportCount: 0,
      dryRun: true,
      explicitWindow: true,
      mode: "delete",
    })
  ).toThrow();
  expect(() =>
    AiMetricsRetentionEnforcementResult.make({
      dataRoot: "/tmp/metrics",
      deletedDerivedExportCount: 0,
      dryRun: true,
      keptDerivedExportCount: 1.5,
      maxSnapshotExports: 2,
    })
  ).toThrow();
  expect(() =>
    AiMetricsRetentionRestoreDrillResult.make({
      derivedDuckDbPath: "/tmp/restore/derived.duckdb",
      hashMatches: true,
      replayedObjectCount: -1,
      restoreRoot: "/tmp/restore",
      transcriptTextPrinted: false,
    })
  ).toThrow();
  expect(() =>
    AiMetricsRetentionEnforcementPolicy.make({ dataRoot: "/tmp/metrics", maxSnapshotExports: 1.5 })
  ).toThrow();
  expect(() =>
    AiMetricsRetentionSelector.make({
      dataRoot: "/tmp/metrics",
      sinceEpochMillis: O.some(20),
      untilEpochMillis: O.some(10),
    })
  ).toThrow();
  expect(
    Result.isFailure(
      decodeRetentionInventoryResult({
        derivedExports: [],
        explicitWindow: false,
        rawArchiveObjects: [],
        reports: [],
        schemaVersion: "beep.ai_metrics.retention_inventory.v2",
        selectedDerivedExportCount: 0,
        selectedRawArchiveObjectCount: 0,
        selectedReportCount: 0,
      })
    )
  ).toBe(true);
  expect(
    Result.isFailure(
      decodeDerivedStorageWriteResult({
        archiveObjectCount: 0,
        duckDbPath: "/tmp/metrics/derived/ai-metrics.duckdb",
        ingestRunId: "ingest-1",
        parquetExportMode: "snapshot",
        parquetTables: ["not_a_derived_table"],
        sourceFileCount: 0,
        turnCount: 0,
      })
    )
  ).toBe(true);
  const absentParquetDir = Result.getOrThrow(
    decodeDerivedStorageWriteResult({
      archiveObjectCount: 0,
      duckDbPath: "/tmp/metrics/derived/ai-metrics.duckdb",
      ingestRunId: "ingest-1",
      parquetExportMode: "none",
      parquetTables: [],
      sourceFileCount: 0,
      turnCount: 0,
    })
  );
  expect(absentParquetDir.parquetExportDir).toEqual(O.none());
  expect(Result.getOrThrow(encodeDerivedStorageWriteResult(absentParquetDir))).not.toHaveProperty("parquetExportDir");
});

it("derives valid storage results from the schema", () =>
  fc.assert(
    fc.property(DerivedStorageWriteResultArbitrary, (result) => isDerivedStorageWriteResult(result)),
    fcRuns(12)
  ));

it.effect(
  "defaults and encodes the retention inventory schema version",
  Effect.fn(function* () {
    const inventory = AiMetricsRetentionInventory.make({
      derivedExports: [],
      explicitWindow: false,
      rawArchiveObjects: [],
      reports: [],
      selectedDerivedExportCount: 0,
      selectedRawArchiveObjectCount: 0,
      selectedReportCount: 0,
    });
    const json = yield* AiMetricsRetentionInventory.encodeUnknownEffectFromJsonString(inventory);
    expect(json).toContain('"schemaVersion":"beep.ai_metrics.retention_inventory.v1"');
  })
);

it.effect(
  "does not select a legacy NULL timestamp for a before window",
  Effect.fn(function* () {
    yield* withTempDirectory(
      Effect.fn(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dataRoot = path.join(tmpDir, "metrics");
        const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
        yield* fs.makeDirectory(path.dirname(duckDbPath), { recursive: true });

        const duckDbLayer = DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }));
        yield* Effect.gen(function* () {
          const duckdb = yield* DuckDb;
          yield* duckdb.runMany([
            `CREATE TABLE ai_metrics_raw_archive_objects (
              archive_run_object_id VARCHAR,
              archive_object_id VARCHAR,
              ingest_run_id VARCHAR,
              source_kind VARCHAR,
              source_path_hash VARCHAR,
              plaintext_content_hash VARCHAR,
              archive_path VARCHAR,
              encrypted_at_epoch_ms DOUBLE
            )`,
            `CREATE TABLE ai_metrics_ingest_runs (
              ingest_run_id VARCHAR,
              completed_at_epoch_ms DOUBLE
            )`,
            `CREATE TABLE ai_metrics_outcome_labels (
              label_id VARCHAR,
              labeled_at_epoch_ms DOUBLE
            )`,
            `CREATE TABLE ai_metrics_benchmark_runs (
              benchmark_run_id VARCHAR,
              recorded_at_epoch_ms DOUBLE
            )`,
            `CREATE TABLE ai_metrics_scorecards (
              scorecard_id VARCHAR,
              window_end_epoch_ms DOUBLE
            )`,
          ]);
          yield* duckdb.run(
            "INSERT INTO ai_metrics_outcome_labels (label_id, labeled_at_epoch_ms) VALUES ('legacy-null', NULL)"
          );
        }).pipe(provideScopedLayer(duckDbLayer));

        yield* runAiMetricsRetentionDelete(
          AiMetricsRetentionSelector.make({ beforeEpochMillis: O.some(4_102_444_800_000), dataRoot }),
          false
        ).pipe(provideScopedLayer(duckDbLayer));

        const rows = yield* Effect.gen(function* () {
          const duckdb = yield* DuckDb;
          return yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_outcome_labels");
        }).pipe(provideScopedLayer(duckDbLayer));
        expect(globalThis.Number(rows[0]?.count)).toBe(1);
      })
    ).pipe(Effect.provide(NodeServices.layer));
  })
);
