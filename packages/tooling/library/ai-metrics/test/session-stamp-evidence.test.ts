import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  AiMetricsDeployTarget,
  AiMetricsDerivedStorageWriteInput,
  AiMetricsDerivedTranscriptRecord,
  AiMetricsParquetExportMode,
  AiMetricsRawArchiveObject,
  AiMetricsSessionStampCompleteness,
  AiMetricsSessionStampJoin,
  AiMetricsSessionStampQualification,
  AiMetricsStorageLayout,
  AiMetricsTranscriptSource,
  AiMetricsTranscriptTextSummaryInput,
  aiMetricsSessionStampCompletenessFor,
  aiMetricsSessionStampQualificationFor,
  ConfigSnapshot,
  ensureAiMetricsDerivedStorage,
  HarnessHash,
  makeAiMetricsPrivacyCheckResult,
  readAiMetricsOtlpSpanProjections,
  rollbackAiMetricsSessionStampEvidence,
  summarizeTranscriptText,
  writeAiMetricsDerivedStorage,
} from "@beep/repo-ai-metrics";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const stampX = HarnessHash.make(Str.repeat(64)("b"));
const stampY = HarnessHash.make(Str.repeat(64)("c"));

const decodeRecord = S.decodeUnknownEffect(AiMetricsDerivedTranscriptRecord);
const encodeRecord = S.encodeEffect(AiMetricsDerivedTranscriptRecord);

// Each provision opens one private in-memory database; derived-storage only creates the
// on-disk parent directory, which the in-memory file system absorbs.
const memoryDuckDb = DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }));

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    layer.pipe(
      Layer.build,
      Effect.flatMap((context) => effect.pipe(Effect.provide(context))),
      Effect.scoped
    );

type StampVerdict = {
  readonly completeness: AiMetricsSessionStampCompleteness;
  readonly hash: O.Option<HarnessHash>;
  readonly qualification: AiMetricsSessionStampQualification;
};

const fixtureContent = '{"type":"event_msg","timestamp":"2026-10-18T10:01:00Z"}';
const fixtureSourcePath = "/fixture/home/.codex/sessions/codex.jsonl";

const makeRecord = Effect.fn("SessionStampEvidenceTest.makeRecord")(function* (verdict: StampVerdict) {
  const summary = yield* summarizeTranscriptText(
    AiMetricsTranscriptTextSummaryInput.make({
      content: fixtureContent,
      hashSalt: O.some("test-salt"),
      sourceKind: AiMetricsTranscriptSource.Enum.codex,
      sourcePath: fixtureSourcePath,
    })
  );
  const privacy = yield* makeAiMetricsPrivacyCheckResult({
    content: fixtureContent,
    hashSalt: O.some("test-salt"),
    sourcePath: fixtureSourcePath,
    summary,
  });
  return AiMetricsDerivedTranscriptRecord.make({
    archiveObject: AiMetricsRawArchiveObject.make({
      algorithm: "AES-256-GCM",
      archiveObjectId: `raw-${Str.repeat(64)("1")}`,
      archivePath: "/fixture/metrics/raw/codex/raw-object.json",
      created: false,
      encryptedAtEpochMillis: 1,
      plaintextContentHash: Str.repeat(64)("2"),
      sourceKind: AiMetricsTranscriptSource.Enum.codex,
      sourcePathHash: summary.sourcePathHash,
    }),
    privacy,
    sessionHarnessHash: verdict.hash,
    sessionStampCompleteness: verdict.completeness,
    sessionStampQualification: verdict.qualification,
  });
});

// One derived-storage fixture: a codex transcript whose session row is rewritten by every run.
const fixtureStorage = AiMetricsStorageLayout.make({
  dataRoot: "/fixture/metrics",
  derivedDir: "/fixture/metrics/derived",
  duckDbPath: "/fixture/metrics/derived/ai-metrics.duckdb",
  parquetDir: "/fixture/metrics/derived/parquet",
  rawArchiveDir: "/fixture/metrics/raw",
});

const writeVerdict = Effect.fn("SessionStampEvidenceTest.writeVerdict")(function* (
  ingestRunId: string,
  verdict: StampVerdict
) {
  yield* writeAiMetricsDerivedStorage(
    AiMetricsDerivedStorageWriteInput.make({
      configSnapshot: ConfigSnapshot.make({
        changedPaths: [],
        configHash: "config-hash",
        label: "repo-local-agent-config",
        snapshotId: "config-1",
      }),
      ingestRunId,
      parquetExportMode: AiMetricsParquetExportMode.Enum.none,
      records: [yield* makeRecord(verdict)],
      repoRootHash: "repo-root-hash",
      startedAtEpochMillis: 1,
      storage: fixtureStorage,
      target: AiMetricsDeployTarget.Enum.local,
    })
  );
});

const readSession = Effect.fnUntraced(function* () {
  const db = yield* DuckDb;
  return yield* db.query(
    `SELECT session_harness_hash AS hash,
            session_stamp_completeness AS completeness,
            session_stamp_qualification AS qualification,
            session_stamp_collection_complete AS legacy
     FROM ai_metrics_sessions`
  );
});

const readSourceFile = Effect.fnUntraced(function* (ingestRunId: string) {
  const db = yield* DuckDb;
  return yield* db.query(
    `SELECT session_harness_hash AS hash,
            session_stamp_completeness AS completeness,
            session_stamp_qualification AS qualification
     FROM ai_metrics_source_files WHERE ingest_run_id = $ingestRunId`,
    { ingestRunId }
  );
});

const evidenceColumnCount = Effect.fnUntraced(function* () {
  const db = yield* DuckDb;
  const rows = yield* db.query(
    `SELECT count(*)::INTEGER AS count FROM information_schema.columns
     WHERE column_name IN ('session_stamp_completeness', 'session_stamp_qualification')`
  );
  const ledger = yield* db.query(
    `SELECT count(*)::INTEGER AS count FROM ai_metrics_schema_migrations
     WHERE migration_id = 'ai-metrics-session-stamp-evidence-v1'`
  );
  return { columns: rows, ledger };
});

it.layer(Layer.mergeAll(MemoryFileSystem.layer, Path.layer), { timeout: "30 seconds" })(
  "@beep/repo-ai-metrics session stamp evidence",
  (it) => {
    it.effect.prop(
      "derives completeness from collection only and qualification from the record's own join",
      [S.Boolean, S.Boolean, AiMetricsSessionStampJoin],
      ([hookComplete, gapComplete, join]) =>
        Effect.sync(() => {
          const completeness = aiMetricsSessionStampCompletenessFor(hookComplete, gapComplete);
          const qualification = aiMetricsSessionStampQualificationFor(join, completeness);
          const expectedCompleteness = hookComplete && gapComplete ? "complete" : "partial";
          const unresolved = completeness === "complete" ? "unqualified" : "unknown";
          const expectedQualification = AiMetricsSessionStampJoin.match(join, {
            retained: () => "qualified",
            contradicted: () => "unqualified",
            unsupported: () => "unsupported",
            unresolved: () => unresolved,
          });
          expect(completeness).toBe(expectedCompleteness);
          expect(qualification).toBe(expectedQualification);
          // A collection derivation never yields the historical default.
          expect(completeness).not.toBe("unknown");
        }),
      { arbitrary: fcRuns(32) }
    );

    it.effect(
      "keeps qualification and completeness mutually underdetermined",
      Effect.fnUntraced(function* () {
        const reachable = (completeness: AiMetricsSessionStampCompleteness) =>
          A.dedupe(A.map(AiMetricsSessionStampJoin.literals, aiMetricsSessionStampQualificationFor(completeness)));
        // Each completeness admits several qualifications, so completeness does not fix qualification.
        expect(A.sort(reachable("complete"), Order.String)).toEqual(["qualified", "unqualified", "unsupported"]);
        expect(A.sort(reachable("partial"), Order.String)).toEqual([
          "qualified",
          "unknown",
          "unqualified",
          "unsupported",
        ]);
        // Every verdict is reachable under both completeness values, so qualification does not
        // fix completeness; only an unresolved join consults completeness at all.
        for (const join of ["retained", "contradicted", "unsupported"] as const)
          expect(aiMetricsSessionStampQualificationFor(join, "complete")).toBe(
            aiMetricsSessionStampQualificationFor(join, "partial")
          );
      })
    );

    it.effect.prop(
      "round-trips every completeness and qualification pairing independently through the record codec",
      [AiMetricsSessionStampCompleteness, AiMetricsSessionStampQualification],
      Effect.fnUntraced(function* ([completeness, qualification]) {
        const record = yield* makeRecord({ completeness, hash: O.none(), qualification });
        const encodedRecord = yield* encodeRecord(record);
        const decoded = yield* decodeRecord(encodedRecord);
        expect(decoded.sessionStampCompleteness).toBe(completeness);
        expect(decoded.sessionStampQualification).toBe(qualification);
      }),
      { arbitrary: fcRuns(12) }
    );

    it.effect(
      "decodes historical records without the fields as unknown and rejects malformed values",
      Effect.fnUntraced(function* () {
        const madeRecord = yield* makeRecord({
          completeness: "complete",
          hash: O.some(stampX),
          qualification: "qualified",
        });
        const encoded = yield* encodeRecord(madeRecord);
        const { sessionStampCompleteness: _completeness, sessionStampQualification: _qualification, ...rest } = encoded;
        // A round-2 record carried only the conflated boolean; it must not become verified.
        const historical = yield* decodeRecord({ ...rest, sessionStampCollectionComplete: true });
        expect(historical.sessionStampCompleteness).toBe("unknown");
        expect(historical.sessionStampQualification).toBe("unknown");
        expect(O.getOrNull(historical.sessionHarnessHash)).toBe(stampX);
        const malformed = yield* decodeRecord({ ...rest, sessionStampCompleteness: "done" }).pipe(Effect.flip);
        expect(malformed._tag).toBe("SchemaError");
      })
    );

    it.effect(
      "keeps a stored stamp only for an unknown verdict and lets any reached verdict replace it",
      Effect.fnUntraced(function* () {
        yield* Effect.gen(function* () {
          const verified = { hash: stampX, completeness: "complete", qualification: "qualified", legacy: true };
          // Complete stamped.
          yield* writeVerdict("run-1", { completeness: "complete", hash: O.some(stampX), qualification: "qualified" });
          const readSession1 = yield* readSession();
          expect(readSession1).toEqual([verified]);

          // Partial collection the gates could not evaluate keeps the stored verdict.
          yield* writeVerdict("run-2", { completeness: "partial", hash: O.none(), qualification: "unknown" });
          const readSession2 = yield* readSession();
          expect(readSession2).toEqual([verified]);
          // The run-scoped source-file row records what run 2 itself observed.
          const readSourceFile3 = yield* readSourceFile("run-2");
          expect(readSourceFile3).toEqual([{ hash: null, completeness: "partial", qualification: "unknown" }]);
          const preserved = yield* readAiMetricsOtlpSpanProjections;
          expect(preserved.projections.length).toBeGreaterThan(0);
          for (const span of preserved.projections) {
            expect(span.attributes["ai_metrics.session_harness_hash"]).toBe(stampX);
            expect(span.attributes["ai_metrics.session_stamp_completeness"]).toBe("complete");
            expect(span.attributes["ai_metrics.session_stamp_qualification"]).toBe("qualified");
          }

          // Partial collection whose own evidence disqualifies the session still clears it.
          yield* writeVerdict("run-3", { completeness: "partial", hash: O.none(), qualification: "unqualified" });
          const readSession4 = yield* readSession();
          expect(readSession4).toEqual([
            { hash: null, completeness: "partial", qualification: "unqualified", legacy: false },
          ]);

          // Partial stamped: a stamp retained from decodable evidence replaces the stored one.
          yield* writeVerdict("run-4", { completeness: "complete", hash: O.some(stampX), qualification: "qualified" });
          yield* writeVerdict("run-5", { completeness: "partial", hash: O.some(stampY), qualification: "qualified" });
          const readSession5 = yield* readSession();
          expect(readSession5).toEqual([
            { hash: stampY, completeness: "partial", qualification: "qualified", legacy: false },
          ]);

          // Complete unstamped: complete collection that finds no stamp clears the stored one.
          yield* writeVerdict("run-6", { completeness: "complete", hash: O.none(), qualification: "unqualified" });
          const readSession6 = yield* readSession();
          expect(readSession6).toEqual([
            { hash: null, completeness: "complete", qualification: "unqualified", legacy: false },
          ]);

          // With nothing stored, an unknown verdict is recorded as unknown, never as non-use.
          yield* writeVerdict("run-7", { completeness: "partial", hash: O.none(), qualification: "unknown" });
          const readSession7 = yield* readSession();
          expect(readSession7).toEqual([
            { hash: null, completeness: "partial", qualification: "unknown", legacy: false },
          ]);

          // Historical-default records (unknown/unknown) also never clear a stored stamp.
          yield* writeVerdict("run-8", { completeness: "complete", hash: O.some(stampX), qualification: "qualified" });
          yield* writeVerdict("run-9", { completeness: "unknown", hash: O.none(), qualification: "unknown" });
          const readSession8 = yield* readSession();
          expect(readSession8).toEqual([verified]);
        }).pipe(provideScopedLayer(memoryDuckDb));
      })
    );

    it.effect(
      "migrates historical rows to unknown except the exact round-2 translation, and rolls back",
      Effect.fnUntraced(function* () {
        yield* Effect.gen(function* () {
          const db = yield* DuckDb;
          // Build the pre-split shape: current schema minus the two new columns and ledger row.
          yield* ensureAiMetricsDerivedStorage;
          yield* rollbackAiMetricsSessionStampEvidence;
          const evidenceColumnCount9 = yield* evidenceColumnCount();
          expect(evidenceColumnCount9).toEqual({ columns: [{ count: 0 }], ledger: [{ count: 0 }] });
          const insert = (id: string, hash: string | null, legacy: boolean | null) =>
            db.run(
              `INSERT INTO ai_metrics_sessions (
               agent_session_id, ingest_run_id, source_kind, source_path_hash, source_role,
               config_snapshot_id, session_harness_hash, session_stamp_collection_complete
             ) VALUES ($id, 'legacy-run', 'codex', $id, 'primary', 'config-1', $hash, $legacy)`,
              { hash, id, legacy }
            );
          yield* insert("verified", stampX, true);
          yield* insert("stamped-unverified", stampY, false);
          yield* insert("unstamped", null, false);
          yield* insert("pre-round-2", null, null);
          yield* insert("pre-round-2-stamped", stampX, null);

          yield* ensureAiMetricsDerivedStorage;
          const readAll = db.query(
            `SELECT agent_session_id AS id,
                  session_stamp_completeness AS completeness,
                  session_stamp_qualification AS qualification
           FROM ai_metrics_sessions ORDER BY agent_session_id`
          );
          const migrated = [
            { id: "pre-round-2", completeness: "unknown", qualification: "unknown" },
            { id: "pre-round-2-stamped", completeness: "unknown", qualification: "unknown" },
            { id: "stamped-unverified", completeness: "unknown", qualification: "unknown" },
            { id: "unstamped", completeness: "unknown", qualification: "unknown" },
            { id: "verified", completeness: "complete", qualification: "qualified" },
          ];
          const readAll10 = yield* readAll;
          expect(readAll10).toEqual(migrated);
          // Re-running ensure is idempotent through the ledger.
          yield* ensureAiMetricsDerivedStorage;
          const readAll11 = yield* readAll;
          expect(readAll11).toEqual(migrated);

          // Down path: columns and ledger row go; the legacy marker and stamps stay intact.
          yield* rollbackAiMetricsSessionStampEvidence;
          const evidenceColumnCount12 = yield* evidenceColumnCount();
          expect(evidenceColumnCount12).toEqual({ columns: [{ count: 0 }], ledger: [{ count: 0 }] });
          const query13 = yield* db.query(
            `SELECT agent_session_id AS id, session_harness_hash AS hash, session_stamp_collection_complete AS legacy
             FROM ai_metrics_sessions ORDER BY agent_session_id`
          );
          expect(query13).toEqual([
            { id: "pre-round-2", hash: null, legacy: null },
            { id: "pre-round-2-stamped", hash: stampX, legacy: null },
            { id: "stamped-unverified", hash: stampY, legacy: false },
            { id: "unstamped", hash: null, legacy: false },
            { id: "verified", hash: stampX, legacy: true },
          ]);
          // Re-applying after a rollback reproduces the same conservative translation.
          yield* ensureAiMetricsDerivedStorage;
          const evidenceColumnCount14 = yield* evidenceColumnCount();
          expect(evidenceColumnCount14).toEqual({ columns: [{ count: 4 }], ledger: [{ count: 1 }] });
          const readAll15 = yield* readAll;
          expect(readAll15).toEqual(migrated);
        }).pipe(provideScopedLayer(memoryDuckDb));
      })
    );
  }
);
