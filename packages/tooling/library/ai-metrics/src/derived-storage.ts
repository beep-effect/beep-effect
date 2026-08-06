/**
 * DuckDB-derived storage projection for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbParquetExport } from "@beep/duckdb";
import { PathSafety } from "@beep/file-processing";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Clock, Effect, FileSystem, flow, Path, pipe } from "effect";
import * as S from "effect/Schema";
import { AiMetricsRawArchiveObject } from "./archive.ts";
import { AiMetricsStorageLayout } from "./install.ts";
import { AiMetricsDeployTarget, ConfigSnapshot } from "./models.ts";
import { AiMetricsPrivacyCheckResult, hashPublicTextSha256 } from "./privacy.ts";
import type { DuckDbClient, DuckDbError } from "@beep/duckdb";

const $I = $RepoAiMetricsId.create("derived-storage");

const DERIVED_TABLES = [
  "ai_metrics_ingest_runs",
  "ai_metrics_source_files",
  "ai_metrics_raw_archive_objects",
  "ai_metrics_agent_tasks",
  "ai_metrics_sessions",
  "ai_metrics_turns",
  "ai_metrics_model_calls",
  "ai_metrics_tool_invocations",
  "ai_metrics_outcome_labels",
  "ai_metrics_benchmark_cases",
  "ai_metrics_benchmark_runs",
  "ai_metrics_scorecards",
] as const;

/**
 * Parquet export behavior for one derived AI metrics write.
 *
 * **Example** (Read a parquet export mode)
 *
 * ```ts
 * import { AiMetricsParquetExportMode } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsParquetExportMode.Enum.snapshot)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AiMetricsParquetExportMode = LiteralKit(["none", "latest", "snapshot"]).pipe(
  $I.annoteSchema("AiMetricsParquetExportMode", {
    description: "Parquet export mode for one AI metrics derived storage write.",
  })
);

/**
 * Runtime type for {@link AiMetricsParquetExportMode}.
 *
 * **Example** (Type a parquet export mode)
 *
 * ```ts
 * import type { AiMetricsParquetExportMode } from "@beep/repo-ai-metrics"
 * const mode: AiMetricsParquetExportMode = "latest"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsParquetExportMode = typeof AiMetricsParquetExportMode.Type;

const createTableStatements = [
  `CREATE TABLE IF NOT EXISTS ai_metrics_ingest_runs (
    ingest_run_id VARCHAR PRIMARY KEY,
    target VARCHAR NOT NULL,
    config_snapshot_id VARCHAR NOT NULL,
    config_hash VARCHAR NOT NULL,
    started_at_epoch_ms DOUBLE NOT NULL,
    completed_at_epoch_ms DOUBLE NOT NULL,
    source_file_count INTEGER NOT NULL,
    archive_object_count INTEGER NOT NULL,
    turn_count INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_source_files (
    source_file_id VARCHAR PRIMARY KEY,
    ingest_run_id VARCHAR NOT NULL,
    source_kind VARCHAR NOT NULL,
    source_path_hash VARCHAR NOT NULL,
    source_role VARCHAR NOT NULL,
    session_id_hash VARCHAR,
    parent_session_id_hash VARCHAR,
    parent_thread_id_hash VARCHAR,
    forked_from_id_hash VARCHAR,
    thread_spawn BOOLEAN,
    agent_role_hash VARCHAR,
    agent_nickname_hash VARCHAR,
    total_lines INTEGER NOT NULL,
    accepted_events INTEGER NOT NULL,
    rejected_lines INTEGER NOT NULL,
    first_timestamp VARCHAR,
    last_timestamp VARCHAR,
    event_names_json VARCHAR NOT NULL,
    redaction_safe_for_derived_ui BOOLEAN NOT NULL,
    config_snapshot_id VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_raw_archive_objects (
    archive_run_object_id VARCHAR PRIMARY KEY,
    archive_object_id VARCHAR NOT NULL,
    ingest_run_id VARCHAR NOT NULL,
    source_kind VARCHAR NOT NULL,
    source_path_hash VARCHAR NOT NULL,
    plaintext_content_hash VARCHAR NOT NULL,
    archive_path VARCHAR NOT NULL,
    algorithm VARCHAR NOT NULL,
    encrypted_at_epoch_ms DOUBLE NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_agent_tasks (
    agent_task_id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    source_kind VARCHAR NOT NULL,
    source_path_hash VARCHAR NOT NULL,
    source_role VARCHAR NOT NULL,
    repo_root_hash VARCHAR NOT NULL,
    config_snapshot_id VARCHAR NOT NULL,
    created_at_epoch_ms DOUBLE NOT NULL,
    first_seen_at VARCHAR,
    last_seen_at VARCHAR
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_sessions (
    agent_session_id VARCHAR PRIMARY KEY,
    agent_task_id VARCHAR,
    ingest_run_id VARCHAR NOT NULL,
    source_kind VARCHAR NOT NULL,
    source_path_hash VARCHAR NOT NULL,
    source_role VARCHAR NOT NULL,
    session_id_hash VARCHAR,
    parent_session_id_hash VARCHAR,
    parent_thread_id_hash VARCHAR,
    forked_from_id_hash VARCHAR,
    thread_spawn BOOLEAN,
    agent_role_hash VARCHAR,
    agent_nickname_hash VARCHAR,
    started_at VARCHAR,
    config_snapshot_id VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_turns (
    turn_id VARCHAR PRIMARY KEY,
    ingest_run_id VARCHAR NOT NULL,
    agent_session_id VARCHAR NOT NULL,
    source_kind VARCHAR NOT NULL,
    source_path_hash VARCHAR NOT NULL,
    source_role VARCHAR NOT NULL,
    line_number INTEGER NOT NULL,
    event_name VARCHAR NOT NULL,
    raw_event_hash VARCHAR NOT NULL,
    timestamp VARCHAR
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_model_calls (
    call_id VARCHAR PRIMARY KEY,
    ingest_run_id VARCHAR,
    provider VARCHAR,
    model VARCHAR,
    total_tokens INTEGER,
    latency_ms DOUBLE
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_tool_invocations (
    tool_run_id VARCHAR PRIMARY KEY,
    ingest_run_id VARCHAR,
    tool_name VARCHAR,
    duration_ms DOUBLE,
    exit_code INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_outcome_labels (
    label_id VARCHAR PRIMARY KEY,
    agent_task_id VARCHAR NOT NULL,
    rating DOUBLE NOT NULL,
    passed BOOLEAN NOT NULL,
    quality_gate VARCHAR NOT NULL,
    intervention_count INTEGER NOT NULL,
    follow_up_fix BOOLEAN NOT NULL,
    note VARCHAR,
    labeled_at_epoch_ms DOUBLE NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_benchmark_cases (
    benchmark_case_id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    prompt_hash VARCHAR NOT NULL,
    prompt_ref VARCHAR,
    expected_checks_json VARCHAR NOT NULL,
    created_at_epoch_ms DOUBLE NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_benchmark_runs (
    benchmark_run_id VARCHAR PRIMARY KEY,
    benchmark_case_id VARCHAR NOT NULL,
    config_snapshot_id VARCHAR NOT NULL,
    elapsed_ms DOUBLE NOT NULL,
    passed BOOLEAN NOT NULL,
    quality_gate VARCHAR NOT NULL,
    note VARCHAR,
    recorded_at_epoch_ms DOUBLE NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_scorecards (
    scorecard_id VARCHAR PRIMARY KEY,
    config_snapshot_id VARCHAR NOT NULL,
    window_start_epoch_ms DOUBLE NOT NULL,
    window_end_epoch_ms DOUBLE NOT NULL,
    total_score DOUBLE NOT NULL,
    outcome_score DOUBLE NOT NULL,
    flow_score DOUBLE NOT NULL,
    cost_score DOUBLE NOT NULL,
    task_count INTEGER NOT NULL,
    label_count INTEGER NOT NULL,
    benchmark_run_count INTEGER NOT NULL,
    completion_ready BOOLEAN NOT NULL,
    coverage_gaps_json VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_metrics_schema_migrations (
    migration_id VARCHAR PRIMARY KEY,
    applied_at_epoch_ms DOUBLE NOT NULL
  )`,
] as const;

const migrationColumns = [
  {
    // Explicit OTLP export state. Previously the exporter inferred this from
    // `ingest_run_id`, which only worked because every run re-minted its rows. Once
    // ingestion became idempotent that inference broke: a run that committed turns
    // and then died before exporting left them attached to a run the exporter would
    // never look at again, so they could never reach Phoenix.
    columnDefinition: "otlp_exported_at_epoch_ms DOUBLE",
    columnName: "otlp_exported_at_epoch_ms",
    tableName: "ai_metrics_turns",
  },
  {
    columnDefinition: "source_role VARCHAR DEFAULT 'primary'",
    columnName: "source_role",
    tableName: "ai_metrics_source_files",
  },
  {
    columnDefinition: "session_id_hash VARCHAR",
    columnName: "session_id_hash",
    tableName: "ai_metrics_source_files",
  },
  {
    columnDefinition: "parent_session_id_hash VARCHAR",
    columnName: "parent_session_id_hash",
    tableName: "ai_metrics_source_files",
  },
  {
    columnDefinition: "parent_thread_id_hash VARCHAR",
    columnName: "parent_thread_id_hash",
    tableName: "ai_metrics_source_files",
  },
  {
    columnDefinition: "forked_from_id_hash VARCHAR",
    columnName: "forked_from_id_hash",
    tableName: "ai_metrics_source_files",
  },
  {
    columnDefinition: "thread_spawn BOOLEAN",
    columnName: "thread_spawn",
    tableName: "ai_metrics_source_files",
  },
  {
    columnDefinition: "agent_role_hash VARCHAR",
    columnName: "agent_role_hash",
    tableName: "ai_metrics_source_files",
  },
  {
    columnDefinition: "agent_nickname_hash VARCHAR",
    columnName: "agent_nickname_hash",
    tableName: "ai_metrics_source_files",
  },
  {
    columnDefinition: "source_role VARCHAR DEFAULT 'primary'",
    columnName: "source_role",
    tableName: "ai_metrics_agent_tasks",
  },
  {
    columnDefinition: "agent_task_id VARCHAR",
    columnName: "agent_task_id",
    tableName: "ai_metrics_sessions",
  },
  {
    columnDefinition: "source_role VARCHAR DEFAULT 'primary'",
    columnName: "source_role",
    tableName: "ai_metrics_sessions",
  },
  {
    columnDefinition: "session_id_hash VARCHAR",
    columnName: "session_id_hash",
    tableName: "ai_metrics_sessions",
  },
  {
    columnDefinition: "parent_session_id_hash VARCHAR",
    columnName: "parent_session_id_hash",
    tableName: "ai_metrics_sessions",
  },
  {
    columnDefinition: "parent_thread_id_hash VARCHAR",
    columnName: "parent_thread_id_hash",
    tableName: "ai_metrics_sessions",
  },
  {
    columnDefinition: "forked_from_id_hash VARCHAR",
    columnName: "forked_from_id_hash",
    tableName: "ai_metrics_sessions",
  },
  {
    columnDefinition: "thread_spawn BOOLEAN",
    columnName: "thread_spawn",
    tableName: "ai_metrics_sessions",
  },
  {
    columnDefinition: "agent_role_hash VARCHAR",
    columnName: "agent_role_hash",
    tableName: "ai_metrics_sessions",
  },
  {
    columnDefinition: "agent_nickname_hash VARCHAR",
    columnName: "agent_nickname_hash",
    tableName: "ai_metrics_sessions",
  },
  {
    columnDefinition: "source_role VARCHAR DEFAULT 'primary'",
    columnName: "source_role",
    tableName: "ai_metrics_turns",
  },
  {
    columnDefinition: "quality_gate VARCHAR",
    columnName: "quality_gate",
    tableName: "ai_metrics_outcome_labels",
  },
  {
    columnDefinition: "intervention_count INTEGER",
    columnName: "intervention_count",
    tableName: "ai_metrics_outcome_labels",
  },
  {
    columnDefinition: "follow_up_fix BOOLEAN",
    columnName: "follow_up_fix",
    tableName: "ai_metrics_outcome_labels",
  },
  {
    columnDefinition: "note VARCHAR",
    columnName: "note",
    tableName: "ai_metrics_outcome_labels",
  },
  {
    columnDefinition: "labeled_at_epoch_ms DOUBLE",
    columnName: "labeled_at_epoch_ms",
    tableName: "ai_metrics_outcome_labels",
  },
  {
    columnDefinition: "quality_gate VARCHAR",
    columnName: "quality_gate",
    tableName: "ai_metrics_benchmark_runs",
  },
  {
    columnDefinition: "note VARCHAR",
    columnName: "note",
    tableName: "ai_metrics_benchmark_runs",
  },
  {
    columnDefinition: "recorded_at_epoch_ms DOUBLE",
    columnName: "recorded_at_epoch_ms",
    tableName: "ai_metrics_benchmark_runs",
  },
  {
    columnDefinition: "config_snapshot_id VARCHAR",
    columnName: "config_snapshot_id",
    tableName: "ai_metrics_scorecards",
  },
  {
    columnDefinition: "window_start_epoch_ms DOUBLE",
    columnName: "window_start_epoch_ms",
    tableName: "ai_metrics_scorecards",
  },
  {
    columnDefinition: "window_end_epoch_ms DOUBLE",
    columnName: "window_end_epoch_ms",
    tableName: "ai_metrics_scorecards",
  },
  {
    columnDefinition: "task_count INTEGER",
    columnName: "task_count",
    tableName: "ai_metrics_scorecards",
  },
  {
    columnDefinition: "label_count INTEGER",
    columnName: "label_count",
    tableName: "ai_metrics_scorecards",
  },
  {
    columnDefinition: "benchmark_run_count INTEGER",
    columnName: "benchmark_run_count",
    tableName: "ai_metrics_scorecards",
  },
  {
    columnDefinition: "completion_ready BOOLEAN DEFAULT FALSE",
    columnName: "completion_ready",
    tableName: "ai_metrics_scorecards",
  },
  {
    columnDefinition: "coverage_gaps_json VARCHAR DEFAULT '[]'",
    columnName: "coverage_gaps_json",
    tableName: "ai_metrics_scorecards",
  },
  {
    columnDefinition: "archive_run_object_id VARCHAR",
    columnName: "archive_run_object_id",
    tableName: "ai_metrics_raw_archive_objects",
  },
] as const;

const migrationBackfillStatements = [
  "UPDATE ai_metrics_source_files SET source_role = 'primary' WHERE source_role IS NULL",
  "UPDATE ai_metrics_agent_tasks SET source_role = 'primary' WHERE source_role IS NULL",
  "UPDATE ai_metrics_sessions SET source_role = 'primary' WHERE source_role IS NULL",
  "UPDATE ai_metrics_turns SET source_role = 'primary' WHERE source_role IS NULL",
  "UPDATE ai_metrics_scorecards SET completion_ready = FALSE WHERE completion_ready IS NULL",
  "UPDATE ai_metrics_scorecards SET coverage_gaps_json = '[]' WHERE coverage_gaps_json IS NULL",
] as const;

const legacyAgentTaskIdExpression = (tableAlias: string): string =>
  `concat('agent-task-', sha256(concat('agent-task', chr(0), ${tableAlias}.source_kind, chr(0), ${tableAlias}.source_path_hash)))`;

const currentAgentTaskIdExpression = (tableAlias: string): string =>
  `concat('agent-task-', sha256(concat('agent-task', chr(0), ${tableAlias}.config_snapshot_id, chr(0), ${tableAlias}.source_kind, chr(0), ${tableAlias}.source_role, chr(0), ${tableAlias}.source_path_hash)))`;

const legacyAgentTaskIdMigrationStatements = [
  `UPDATE ai_metrics_sessions AS sessions
   SET agent_task_id = ${currentAgentTaskIdExpression("task")}
   FROM ai_metrics_agent_tasks AS task
   WHERE sessions.agent_task_id = task.agent_task_id
     AND task.agent_task_id = ${legacyAgentTaskIdExpression("task")}`,
  `UPDATE ai_metrics_outcome_labels AS label
   SET agent_task_id = ${currentAgentTaskIdExpression("task")}
   FROM ai_metrics_agent_tasks AS task
   WHERE label.agent_task_id = task.agent_task_id
     AND task.agent_task_id = ${legacyAgentTaskIdExpression("task")}`,
  `DELETE FROM ai_metrics_agent_tasks AS legacy
   WHERE legacy.agent_task_id = ${legacyAgentTaskIdExpression("legacy")}
     AND EXISTS (
       SELECT 1
       FROM ai_metrics_agent_tasks AS current
       WHERE current.agent_task_id = ${currentAgentTaskIdExpression("legacy")}
         AND current.agent_task_id <> legacy.agent_task_id
     )`,
  `UPDATE ai_metrics_agent_tasks AS task
   SET agent_task_id = ${currentAgentTaskIdExpression("task")}
   WHERE task.agent_task_id = ${legacyAgentTaskIdExpression("task")}`,
] as const;

const rawArchiveObjectIdMigrationStatements = [
  `UPDATE ai_metrics_raw_archive_objects
   SET archive_run_object_id = concat('archive-object-', sha256(concat('archive-object', chr(0), ingest_run_id, chr(0), archive_object_id)))
   WHERE archive_run_object_id IS NULL`,
] as const;

type MigrationColumn = {
  readonly columnDefinition: string;
  readonly columnName: string;
  readonly tableName: string;
};

type DerivedStorageMigration = {
  readonly migrationId: string;
  readonly requiredColumns?: ReadonlyArray<Pick<MigrationColumn, "columnName" | "tableName">>;
  readonly statements: ReadonlyArray<string>;
  readonly transactional?: boolean;
};

const derivedStorageMigrations = [
  {
    // One-time only, and it must stay that way. Existing stores were written under
    // the old duplicating scheme, so their rows have already been exported, usually
    // many times over. Left entirely un-backfilled, the first run after the watermark
    // lands would see millions of NULLs and flush the whole history to Phoenix in one
    // burst -- the exact backpressure collapse this work exists to prevent.
    //
    // The newest ingest run is deliberately excluded. Under the old scheme a run that
    // committed turns and then died before exporting was rescued by the next run,
    // which re-minted those rows under a fresh id and exported them -- so the content
    // did reach Phoenix even though the original rows never did. The one case with no
    // such rescue is the final run before this migration: if it crashed before
    // exporting, nothing came after it. Leaving that run's turns unmarked costs at
    // most one run's worth of re-exported spans if it had in fact succeeded, and
    // avoids silently burying data if it had not.
    //
    // The `ai_metrics_schema_migrations` ledger guarantees this runs once, and it is
    // applied before the run's inserts, so genuinely new turns are never swept up.
    migrationId: "ai-metrics-otlp-export-watermark-v1",
    // Every column the statement touches, including the ingest-run lookup. Very old
    // stores predate `ingest_run_id` on turns entirely, and the statement must not be
    // attempted against them -- an unguarded reference fails schema-ensure outright.
    // A skipped migration is not recorded, so it applies later once the shape catches up.
    requiredColumns: [
      { columnName: "otlp_exported_at_epoch_ms", tableName: "ai_metrics_turns" },
      { columnName: "ingest_run_id", tableName: "ai_metrics_turns" },
      { columnName: "ingest_run_id", tableName: "ai_metrics_ingest_runs" },
      { columnName: "started_at_epoch_ms", tableName: "ai_metrics_ingest_runs" },
    ],
    statements: [
      `UPDATE ai_metrics_turns
       SET otlp_exported_at_epoch_ms = 0
       WHERE otlp_exported_at_epoch_ms IS NULL
         AND ingest_run_id <> COALESCE(
           (SELECT ingest_run_id FROM ai_metrics_ingest_runs ORDER BY started_at_epoch_ms DESC LIMIT 1),
           ''
         )`,
    ],
    transactional: true,
  },
  {
    migrationId: "ai-metrics-p6a-default-backfill-v1",
    statements: migrationBackfillStatements,
  },
  {
    migrationId: "ai-metrics-agent-task-id-v2",
    requiredColumns: [
      { columnName: "agent_task_id", tableName: "ai_metrics_agent_tasks" },
      { columnName: "config_snapshot_id", tableName: "ai_metrics_agent_tasks" },
      { columnName: "source_kind", tableName: "ai_metrics_agent_tasks" },
      { columnName: "source_path_hash", tableName: "ai_metrics_agent_tasks" },
      { columnName: "source_role", tableName: "ai_metrics_agent_tasks" },
      { columnName: "agent_task_id", tableName: "ai_metrics_sessions" },
      { columnName: "agent_task_id", tableName: "ai_metrics_outcome_labels" },
    ],
    statements: legacyAgentTaskIdMigrationStatements,
    transactional: true,
  },
  {
    migrationId: "ai-metrics-raw-archive-object-id-v2",
    requiredColumns: [
      { columnName: "archive_run_object_id", tableName: "ai_metrics_raw_archive_objects" },
      { columnName: "archive_object_id", tableName: "ai_metrics_raw_archive_objects" },
      { columnName: "ingest_run_id", tableName: "ai_metrics_raw_archive_objects" },
    ],
    statements: rawArchiveObjectIdMigrationStatements,
  },
] as const satisfies ReadonlyArray<DerivedStorageMigration>;

/**
 * Error raised by the DuckDB derived storage projection.
 *
 * **Example** (Construct a projection error)
 *
 * ```ts
 * import { AiMetricsDerivedStorageError } from "@beep/repo-ai-metrics"
 * const error = AiMetricsDerivedStorageError.make({
 *   cause: "boom",
 *   message: "Projection failed."
 * })
 * console.log(error)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsDerivedStorageError extends TaggedErrorClass<AiMetricsDerivedStorageError>(
  $I`AiMetricsDerivedStorageError`
)(
  "AiMetricsDerivedStorageError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annote("AiMetricsDerivedStorageError", {
    description: "Typed failure raised while projecting AI metrics records into DuckDB derived storage.",
  })
) {}

/**
 * One sanitized transcript ready for derived storage projection.
 *
 * **Example** (Build a sanitized transcript record)
 *
 * ```ts
 * import {
 *   AiMetricsDerivedTranscriptRecord,
 *   AiMetricsPrivacyCheckResult,
 *   AiMetricsRawArchiveObject,
 *   AiMetricsRedactionResult,
 *   AiMetricsSanitizedTranscript
 * } from "@beep/repo-ai-metrics"
 *
 * const record = AiMetricsDerivedTranscriptRecord.make({
 *   archiveObject: AiMetricsRawArchiveObject.make({
 *     algorithm: "AES-256-GCM",
 *     archiveObjectId: "raw-0123456789abcdef",
 *     archivePath: ".beep/ai-metrics/raw/codex/raw-0123456789abcdef.json",
 *     created: true,
 *     encryptedAtEpochMillis: 1_717_000_000_000,
 *     plaintextContentHash: "content-hash",
 *     sourceKind: "codex",
 *     sourcePathHash: "source-hash"
 *   }),
 *   privacy: AiMetricsPrivacyCheckResult.make({
 *     hashSaltStatus: "provided",
 *     inputPathHash: "input-path-hash",
 *     redaction: AiMetricsRedactionResult.make({
 *       authHeaderCount: 0,
 *       bearerTokenCount: 0,
 *       excludedRawTextFieldCount: 0,
 *       openAiKeyCount: 0,
 *       safeForDerivedUi: true,
 *       secretAssignmentCount: 0
 *     }),
 *     sanitized: AiMetricsSanitizedTranscript.make({
 *       acceptedEvents: 1,
 *       eventNames: ["codex.event_msg"],
 *       rawEventEnvelopes: [],
 *       rejectedLines: 0,
 *       sourceKind: "codex",
 *       sourcePathHash: "source-hash",
 *       totalLines: 1
 *     }),
 *     sourceKind: "codex"
 *   })
 * })
 * console.log(record.archiveObject.archiveObjectId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsDerivedTranscriptRecord extends S.Class<AiMetricsDerivedTranscriptRecord>(
  $I`AiMetricsDerivedTranscriptRecord`
)(
  {
    archiveObject: AiMetricsRawArchiveObject,
    privacy: AiMetricsPrivacyCheckResult,
  },
  $I.annote("AiMetricsDerivedTranscriptRecord", {
    description: "Sanitized transcript projection plus encrypted raw archive metadata.",
  })
) {}

/**
 * Input for a derived DuckDB storage write.
 *
 * **Example** (Assemble a derived write input)
 *
 * ```ts
 * import {
 *   AiMetricsDerivedStorageWriteInput,
 *   AiMetricsStorageLayout,
 *   ConfigSnapshot
 * } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsDerivedStorageWriteInput.make({
 *   configSnapshot: ConfigSnapshot.make({
 *     changedPaths: [],
 *     configHash: "config-hash",
 *     label: "repo-local-agent-config",
 *     snapshotId: "config-1"
 *   }),
 *   ingestRunId: "ingest-1",
 *   records: [],
 *   repoRootHash: "repo-hash",
 *   startedAtEpochMillis: 1_717_000_000_000,
 *   storage: AiMetricsStorageLayout.make({
 *     dataRoot: ".beep/ai-metrics",
 *     derivedDir: ".beep/ai-metrics/derived",
 *     duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *     parquetDir: ".beep/ai-metrics/derived/parquet",
 *     rawArchiveDir: ".beep/ai-metrics/raw"
 *   }),
 *   target: "local"
 * })
 * console.log(input.parquetExportMode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsDerivedStorageWriteInput extends S.Class<AiMetricsDerivedStorageWriteInput>(
  $I`AiMetricsDerivedStorageWriteInput`
)(
  {
    configSnapshot: ConfigSnapshot,
    ingestRunId: S.String,
    parquetExportMode: AiMetricsParquetExportMode.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsParquetExportMode.Enum.snapshot)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsParquetExportMode.Enum.snapshot))
    ),
    records: S.Array(AiMetricsDerivedTranscriptRecord),
    repoRootHash: S.String,
    startedAtEpochMillis: S.Finite,
    storage: AiMetricsStorageLayout,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsDerivedStorageWriteInput", {
    description: "DuckDB derived storage write request for one AI metrics forwarder run.",
  })
) {}

/**
 * Result of a derived DuckDB storage write.
 *
 * **Example** (Inspect a derived write result)
 *
 * ```ts
 * import { AiMetricsDerivedStorageWriteResult } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsDerivedStorageWriteResult.make({
 *   archiveObjectCount: 1,
 *   duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *   ingestRunId: "ingest-1",
 *   parquetExportMode: "snapshot",
 *   parquetTables: ["ai_metrics_turns"],
 *   sourceFileCount: 1,
 *   turnCount: 12
 * })
 * console.log(result.parquetTables)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsDerivedStorageWriteResult extends S.Class<AiMetricsDerivedStorageWriteResult>(
  $I`AiMetricsDerivedStorageWriteResult`
)(
  {
    archiveObjectCount: S.Finite,
    duckDbPath: S.String,
    ingestRunId: S.String,
    parquetExportDir: S.optionalKey(S.String),
    parquetExportMode: AiMetricsParquetExportMode,
    parquetTables: S.Array(S.String),
    sourceFileCount: S.Finite,
    turnCount: S.Finite,
  },
  $I.annote("AiMetricsDerivedStorageWriteResult", {
    description: "Safe counts and export paths produced by one DuckDB derived storage write.",
  })
) {}

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const derivedFailure = (message: string, cause: unknown): AiMetricsDerivedStorageError =>
  AiMetricsDerivedStorageError.make({ cause, message });

const jsonString = (value: unknown): Effect.Effect<string> => encodeJson(value).pipe(Effect.orDie);

const rowId = Effect.fn("AiMetrics.derivedStorage.rowId")(function* (
  prefix: string,
  parts: ReadonlyArray<string | number>
) {
  const textParts = A.map(parts, globalThis.String);
  const digest = yield* hashPublicTextSha256(`${prefix}\u0000${A.join(textParts, "\u0000")}`).pipe(Effect.orDie);
  return `${prefix}-${digest}`;
});

const addColumnIfMissing: (input: MigrationColumn) => Effect.Effect<void, DuckDbError, DuckDb> = Effect.fn(
  "AiMetrics.derivedStorage.addColumnIfMissing"
)(function* ({ columnDefinition, columnName, tableName }) {
  const duckdb = yield* DuckDb;
  const rows = yield* duckdb.query(
    `SELECT column_name AS "columnName"
     FROM information_schema.columns
      WHERE table_name = $tableName AND column_name = $columnName`,
    { columnName, tableName }
  );
  if (A.isReadonlyArrayNonEmpty(rows)) {
    return;
  }

  yield* duckdb.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
});

const migrationColumnExists: (
  input: Pick<MigrationColumn, "columnName" | "tableName">
) => Effect.Effect<boolean, DuckDbError, DuckDb> = Effect.fn("AiMetrics.derivedStorage.migrationColumnExists")(
  function* ({ columnName, tableName }) {
    const duckdb = yield* DuckDb;
    const rows = yield* duckdb.query(
      `SELECT column_name AS "columnName"
     FROM information_schema.columns
      WHERE table_name = $tableName AND column_name = $columnName`,
      { columnName, tableName }
    );

    return A.isReadonlyArrayNonEmpty(rows);
  }
);

const migrationHasRequiredColumns: (migration: DerivedStorageMigration) => Effect.Effect<boolean, DuckDbError, DuckDb> =
  Effect.fn("AiMetrics.derivedStorage.migrationHasRequiredColumns")(function* (migration) {
    if (migration.requiredColumns === undefined || migration.requiredColumns.length === 0) {
      return true;
    }

    const columnResults = yield* Effect.forEach(migration.requiredColumns, migrationColumnExists);
    return A.every(columnResults, (exists) => exists);
  });

const runDerivedStorageMigrationOnce: (migration: DerivedStorageMigration) => Effect.Effect<void, DuckDbError, DuckDb> =
  Effect.fn("AiMetrics.derivedStorage.runMigrationOnce")(function* (migration) {
    const duckdb = yield* DuckDb;
    const appliedRows = yield* duckdb.query(
      `SELECT migration_id AS "migrationId"
     FROM ai_metrics_schema_migrations
     WHERE migration_id = $migrationId`,
      { migrationId: migration.migrationId }
    );

    if (A.isReadonlyArrayNonEmpty(appliedRows)) {
      return;
    }

    const hasRequiredColumns = yield* migrationHasRequiredColumns(migration);
    if (!hasRequiredColumns) {
      return;
    }

    const appliedAtEpochMillis = globalThis.String(yield* Clock.currentTimeMillis);
    const recordMigration = (client: Pick<DuckDbClient, "run">): Effect.Effect<void, DuckDbError> =>
      client.run(
        `INSERT OR REPLACE INTO ai_metrics_schema_migrations (
      migration_id,
      applied_at_epoch_ms
    ) VALUES (
      $migrationId,
      $appliedAtEpochMillis
    )`,
        {
          appliedAtEpochMillis,
          migrationId: migration.migrationId,
        }
      );

    if (migration.transactional === true) {
      yield* duckdb.withTransaction(
        Effect.fn(function* (transaction) {
          yield* transaction.runMany(migration.statements);
          yield* recordMigration(transaction);
        })
      );
    } else {
      yield* duckdb.runMany(migration.statements);
      yield* recordMigration(duckdb);
    }
  });

const ensureAiMetricsDerivedStorageRaw = Effect.fn("AiMetrics.derivedStorage.ensureRaw")(function* () {
  const duckdb = yield* DuckDb;
  yield* duckdb.runMany(createTableStatements);
  yield* Effect.forEach(migrationColumns, addColumnIfMissing, { discard: true });
  yield* Effect.forEach(derivedStorageMigrations, runDerivedStorageMigrationOnce, { discard: true });
});

/**
 * Ensure the AI metrics derived DuckDB schema exists and has P4 columns.
 *
 * **Example** (Ensure the schema before writing)
 *
 * ```ts
 * import { ensureAiMetricsDerivedStorage } from "@beep/repo-ai-metrics"
 * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
 * import { Effect } from "effect"
 * const program = ensureAiMetricsDerivedStorage.pipe(
 *   Effect.provide(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({
 *     databasePath: ".beep/ai-metrics/derived/ai-metrics.duckdb"
 *   })))
 * )
 * console.log(program)
 * ```
 *
 * @effects Creates or migrates DuckDB tables and schema metadata in the configured derived database.
 * @category services
 * @since 0.0.0
 */
export const ensureAiMetricsDerivedStorage: Effect.Effect<void, AiMetricsDerivedStorageError, DuckDb> =
  ensureAiMetricsDerivedStorageRaw().pipe(
    Effect.withSpan("repo_ai_metrics.derived_storage.ensure"),
    Effect.mapError((cause) => derivedFailure("Failed to ensure AI metrics derived DuckDB schema.", cause))
  );

const optionalStringOrNull = (value: string | undefined): string | null => value ?? null;
const optionalBooleanOrNull = (value: boolean | undefined): boolean | null => value ?? null;

const epochMillisParam = (value: number): string => globalThis.String(value);

const countCreatedArchiveObjects = (records: ReadonlyArray<AiMetricsDerivedTranscriptRecord>): number =>
  A.filter(records, (record) => record.archiveObject.created).length;

const parquetExportDirFor = (pathApi: Path.Path, input: AiMetricsDerivedStorageWriteInput): O.Option<string> =>
  AiMetricsParquetExportMode.$match(input.parquetExportMode, {
    latest: () => O.some(pathApi.join(input.storage.parquetDir, "latest")),
    none: O.none,
    snapshot: () => O.some(pathApi.join(input.storage.parquetDir, input.ingestRunId)),
  });

const prepareParquetExportDir = Effect.fn("AiMetrics.derivedStorage.prepareParquetExportDir")(function* (
  parquetRoot: string,
  exportDir: string
) {
  const fs = yield* FileSystem.FileSystem;
  // Fail closed before any destructive removal: the export directory is built by
  // joining the Parquet root with a possibly-untrusted ingestRunId, so confirm
  // it canonicalizes to a path strictly contained by the Parquet root. This
  // guards against `..` traversal escaping the root into an unrelated tree that
  // the recursive remove below would otherwise destroy.
  const safeExportDir = yield* PathSafety.resolvePathWithinRoot({ root: parquetRoot, candidate: exportDir }).pipe(
    Effect.mapError((cause) =>
      derivedFailure("Refused to prepare AI metrics Parquet export directory outside the Parquet root.", cause)
    )
  );
  yield* fs
    .remove(safeExportDir, { force: true, recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        derivedFailure("Failed to remove existing AI metrics Parquet export directory.", cause)
      )
    );
  yield* fs
    .makeDirectory(safeExportDir, { recursive: true })
    .pipe(Effect.mapError((cause) => derivedFailure("Failed to create AI metrics Parquet export directory.", cause)));
});

const exportDerivedTablesToParquet = Effect.fn("AiMetrics.derivedStorage.exportDerivedTablesToParquet")(function* (
  exportDir: string
) {
  const pathApi = yield* Path.Path;
  const duckdb = yield* DuckDb;
  yield* Effect.forEach(
    DERIVED_TABLES,
    (tableName) =>
      duckdb.copyTableToParquet(
        DuckDbParquetExport.make({
          filePath: pathApi.join(exportDir, `${tableName}.parquet`),
          tableName,
        })
      ),
    { discard: true }
  ).pipe(Effect.mapError((cause) => derivedFailure("Failed to export AI metrics derived tables to Parquet.", cause)));
});

const upsertRun = Effect.fn("AiMetrics.derivedStorage.upsertRun")(function* (
  input: AiMetricsDerivedStorageWriteInput,
  completedAtEpochMillis: number,
  turnCount: number
) {
  const duckdb = yield* DuckDb;
  const archiveObjectCount = countCreatedArchiveObjects(input.records);
  yield* duckdb.run(
    `INSERT OR REPLACE INTO ai_metrics_ingest_runs (
      ingest_run_id,
      target,
      config_snapshot_id,
      config_hash,
      started_at_epoch_ms,
      completed_at_epoch_ms,
      source_file_count,
      archive_object_count,
      turn_count
    ) VALUES (
      $ingestRunId,
      $target,
      $configSnapshotId,
      $configHash,
      $startedAtEpochMillis,
      $completedAtEpochMillis,
      $sourceFileCount,
      $archiveObjectCount,
      $turnCount
    )`,
    {
      archiveObjectCount,
      completedAtEpochMillis: epochMillisParam(completedAtEpochMillis),
      configHash: input.configSnapshot.configHash,
      configSnapshotId: input.configSnapshot.snapshotId,
      ingestRunId: input.ingestRunId,
      sourceFileCount: input.records.length,
      startedAtEpochMillis: epochMillisParam(input.startedAtEpochMillis),
      target: input.target,
      turnCount,
    }
  );
});

const agentTaskIdFor = Effect.fn("AiMetrics.derivedStorage.agentTaskIdFor")(function* (
  input: AiMetricsDerivedStorageWriteInput,
  record: AiMetricsDerivedTranscriptRecord
) {
  const sanitized = record.privacy.sanitized;
  return yield* rowId("agent-task", [
    input.configSnapshot.snapshotId,
    sanitized.sourceKind,
    sanitized.sourceRole,
    sanitized.sourcePathHash,
  ]);
});

const taskTitleFor = (record: AiMetricsDerivedTranscriptRecord): string => {
  const sanitized = record.privacy.sanitized;
  const sourceSuffix = pipe(sanitized.sourcePathHash, Str.takeLeft(12));
  return `${sanitized.sourceKind} ${sanitized.sourceRole} task ${sourceSuffix}`;
};

const upsertAgentTask = Effect.fn("AiMetrics.derivedStorage.upsertAgentTask")(function* (
  input: AiMetricsDerivedStorageWriteInput,
  record: AiMetricsDerivedTranscriptRecord
) {
  const duckdb = yield* DuckDb;
  const sanitized = record.privacy.sanitized;
  const agentTaskId = yield* agentTaskIdFor(input, record);

  yield* duckdb.run(
    `INSERT OR REPLACE INTO ai_metrics_agent_tasks (
      agent_task_id,
      title,
      source_kind,
      source_path_hash,
      source_role,
      repo_root_hash,
      config_snapshot_id,
      created_at_epoch_ms,
      first_seen_at,
      last_seen_at
    ) VALUES (
      $agentTaskId,
      $title,
      $sourceKind,
      $sourcePathHash,
      $sourceRole,
      $repoRootHash,
      $configSnapshotId,
      $createdAtEpochMillis,
      $firstSeenAt,
      $lastSeenAt
    )`,
    {
      agentTaskId,
      configSnapshotId: input.configSnapshot.snapshotId,
      createdAtEpochMillis: epochMillisParam(input.startedAtEpochMillis),
      firstSeenAt: optionalStringOrNull(sanitized.firstTimestamp),
      lastSeenAt: optionalStringOrNull(sanitized.lastTimestamp),
      repoRootHash: input.repoRootHash,
      sourceKind: sanitized.sourceKind,
      sourcePathHash: sanitized.sourcePathHash,
      sourceRole: sanitized.sourceRole,
      title: taskTitleFor(record),
    }
  );

  return agentTaskId;
});

const upsertSourceFile = Effect.fn("AiMetrics.derivedStorage.upsertSourceFile")(function* (
  input: AiMetricsDerivedStorageWriteInput,
  record: AiMetricsDerivedTranscriptRecord
) {
  const duckdb = yield* DuckDb;
  const sanitized = record.privacy.sanitized;
  const sourceFileId = yield* rowId("source-file", [input.ingestRunId, sanitized.sourceKind, sanitized.sourcePathHash]);
  const eventNamesJson = yield* jsonString(sanitized.eventNames);

  yield* duckdb.run(
    `INSERT OR REPLACE INTO ai_metrics_source_files (
      source_file_id,
      ingest_run_id,
      source_kind,
      source_path_hash,
      source_role,
      session_id_hash,
      parent_session_id_hash,
      parent_thread_id_hash,
      forked_from_id_hash,
      thread_spawn,
      agent_role_hash,
      agent_nickname_hash,
      total_lines,
      accepted_events,
      rejected_lines,
      first_timestamp,
      last_timestamp,
      event_names_json,
      redaction_safe_for_derived_ui,
      config_snapshot_id
    ) VALUES (
      $sourceFileId,
      $ingestRunId,
      $sourceKind,
      $sourcePathHash,
      $sourceRole,
      $sessionIdHash,
      $parentSessionIdHash,
      $parentThreadIdHash,
      $forkedFromIdHash,
      $threadSpawn,
      $agentRoleHash,
      $agentNicknameHash,
      $totalLines,
      $acceptedEvents,
      $rejectedLines,
      $firstTimestamp,
      $lastTimestamp,
      $eventNamesJson,
      $redactionSafeForDerivedUi,
      $configSnapshotId
    )`,
    {
      acceptedEvents: sanitized.acceptedEvents,
      agentNicknameHash: optionalStringOrNull(sanitized.agentNicknameHash),
      agentRoleHash: optionalStringOrNull(sanitized.agentRoleHash),
      configSnapshotId: input.configSnapshot.snapshotId,
      eventNamesJson,
      firstTimestamp: optionalStringOrNull(sanitized.firstTimestamp),
      forkedFromIdHash: optionalStringOrNull(sanitized.forkedFromIdHash),
      ingestRunId: input.ingestRunId,
      lastTimestamp: optionalStringOrNull(sanitized.lastTimestamp),
      parentSessionIdHash: optionalStringOrNull(sanitized.parentSessionIdHash),
      parentThreadIdHash: optionalStringOrNull(sanitized.parentThreadIdHash),
      redactionSafeForDerivedUi: record.privacy.redaction.safeForDerivedUi,
      rejectedLines: sanitized.rejectedLines,
      sessionIdHash: optionalStringOrNull(sanitized.sessionIdHash),
      sourceFileId,
      sourceKind: sanitized.sourceKind,
      sourcePathHash: sanitized.sourcePathHash,
      sourceRole: sanitized.sourceRole,
      threadSpawn: optionalBooleanOrNull(sanitized.threadSpawn),
      totalLines: sanitized.totalLines,
    }
  );
});

const upsertArchiveObject = Effect.fn("AiMetrics.derivedStorage.upsertArchiveObject")(function* (
  input: AiMetricsDerivedStorageWriteInput,
  record: AiMetricsDerivedTranscriptRecord
) {
  const duckdb = yield* DuckDb;
  const archive = record.archiveObject;
  const archiveRunObjectId = yield* rowId("archive-object", [input.ingestRunId, archive.archiveObjectId]);
  yield* duckdb.run(
    `INSERT OR REPLACE INTO ai_metrics_raw_archive_objects (
      archive_run_object_id,
      archive_object_id,
      ingest_run_id,
      source_kind,
      source_path_hash,
      plaintext_content_hash,
      archive_path,
      algorithm,
      encrypted_at_epoch_ms
    ) VALUES (
      $archiveRunObjectId,
      $archiveObjectId,
      $ingestRunId,
      $sourceKind,
      $sourcePathHash,
      $plaintextContentHash,
      $archivePath,
      $algorithm,
      $encryptedAtEpochMillis
    )`,
    {
      algorithm: archive.algorithm,
      archiveObjectId: archive.archiveObjectId,
      archiveRunObjectId,
      archivePath: archive.archivePath,
      encryptedAtEpochMillis: epochMillisParam(archive.encryptedAtEpochMillis),
      ingestRunId: input.ingestRunId,
      plaintextContentHash: archive.plaintextContentHash,
      sourceKind: archive.sourceKind,
      sourcePathHash: archive.sourcePathHash,
    }
  );
});

const upsertSessionAndTurns = Effect.fn("AiMetrics.derivedStorage.upsertSessionAndTurns")(function* (
  input: AiMetricsDerivedStorageWriteInput,
  agentTaskId: string,
  record: AiMetricsDerivedTranscriptRecord
) {
  const duckdb = yield* DuckDb;
  const sanitized = record.privacy.sanitized;
  const agentSessionId = yield* rowId("session", [input.ingestRunId, sanitized.sourceKind, sanitized.sourcePathHash]);
  yield* duckdb.run(
    `INSERT OR REPLACE INTO ai_metrics_sessions (
      agent_session_id,
      agent_task_id,
      ingest_run_id,
      source_kind,
      source_path_hash,
      source_role,
      session_id_hash,
      parent_session_id_hash,
      parent_thread_id_hash,
      forked_from_id_hash,
      thread_spawn,
      agent_role_hash,
      agent_nickname_hash,
      started_at,
      config_snapshot_id
    ) VALUES (
      $agentSessionId,
      $agentTaskId,
      $ingestRunId,
      $sourceKind,
      $sourcePathHash,
      $sourceRole,
      $sessionIdHash,
      $parentSessionIdHash,
      $parentThreadIdHash,
      $forkedFromIdHash,
      $threadSpawn,
      $agentRoleHash,
      $agentNicknameHash,
      $startedAt,
      $configSnapshotId
    )`,
    {
      agentSessionId,
      agentTaskId,
      agentNicknameHash: optionalStringOrNull(sanitized.agentNicknameHash),
      agentRoleHash: optionalStringOrNull(sanitized.agentRoleHash),
      configSnapshotId: input.configSnapshot.snapshotId,
      forkedFromIdHash: optionalStringOrNull(sanitized.forkedFromIdHash),
      ingestRunId: input.ingestRunId,
      parentSessionIdHash: optionalStringOrNull(sanitized.parentSessionIdHash),
      parentThreadIdHash: optionalStringOrNull(sanitized.parentThreadIdHash),
      sessionIdHash: optionalStringOrNull(sanitized.sessionIdHash),
      sourceKind: sanitized.sourceKind,
      sourcePathHash: sanitized.sourcePathHash,
      sourceRole: sanitized.sourceRole,
      startedAt: optionalStringOrNull(sanitized.firstTimestamp),
      threadSpawn: optionalBooleanOrNull(sanitized.threadSpawn),
    }
  );

  yield* Effect.forEach(
    sanitized.rawEventEnvelopes,
    Effect.fnUntraced(function* (envelope) {
      // Content-addressed, deliberately excluding input.ingestRunId. With the run id
      // in the key every run minted a fresh turn_id for identical content, so
      // INSERT OR REPLACE never collided and the table accumulated one copy per run
      // (measured: 5.43M rows collapsing to ~516K distinct raw_event_hash across
      // 1,222 runs). Per the packet's identity rule, ingest runs are lineage, never
      // identity.
      const turnId = yield* rowId("turn", [
        envelope.sourceKind,
        envelope.sourcePathHash,
        envelope.lineNumber,
        envelope.rawEventHash,
      ]);
      // OR IGNORE, not OR REPLACE. REPLACE would rewrite ingest_run_id to the
      // current run, and the OTLP export selects `WHERE ingest_run_id = <this run>`
      // -- so every previously-seen turn would be re-exported to Phoenix on every
      // run even though the table itself had stopped growing. Retaining the
      // first-seen run id is what makes that export incremental.
      yield* duckdb.run(
        `INSERT OR IGNORE INTO ai_metrics_turns (
          turn_id,
          ingest_run_id,
          agent_session_id,
          source_kind,
          source_path_hash,
          source_role,
          line_number,
          event_name,
          raw_event_hash,
          timestamp
        ) VALUES (
          $turnId,
          $ingestRunId,
          $agentSessionId,
          $sourceKind,
          $sourcePathHash,
          $sourceRole,
          $lineNumber,
          $eventName,
          $rawEventHash,
          $timestamp
        )`,
        {
          agentSessionId,
          eventName: envelope.eventName,
          ingestRunId: input.ingestRunId,
          lineNumber: envelope.lineNumber,
          rawEventHash: envelope.rawEventHash,
          sourceKind: envelope.sourceKind,
          sourcePathHash: envelope.sourcePathHash,
          sourceRole: envelope.sourceRole,
          timestamp: optionalStringOrNull(envelope.timestamp),
          turnId,
        }
      );
    }),
    { discard: true }
  );
});

const recordTurnCount: (records: ReadonlyArray<AiMetricsDerivedTranscriptRecord>) => number = flow(
  A.map((record) => record.privacy.sanitized.rawEventEnvelopes.length),
  A.reduce(0, (left, right) => left + right)
);

/**
 * Project sanitized AI metrics records into DuckDB and export Parquet snapshots.
 *
 * **Example** (Write one derived ingest run)
 *
 * ```ts
 * import {
 *   AiMetricsDerivedStorageWriteInput,
 *   AiMetricsStorageLayout,
 *   ConfigSnapshot,
 *   writeAiMetricsDerivedStorage
 * } from "@beep/repo-ai-metrics"
 * const input = AiMetricsDerivedStorageWriteInput.make({
 *   configSnapshot: ConfigSnapshot.make({
 *     changedPaths: [],
 *     configHash: "config-hash",
 *     label: "repo-local-agent-config",
 *     snapshotId: "config-1"
 *   }),
 *   ingestRunId: "ingest-1",
 *   parquetExportMode: "none",
 *   records: [],
 *   repoRootHash: "repo-hash",
 *   startedAtEpochMillis: 1_717_000_000_000,
 *   storage: AiMetricsStorageLayout.make({
 *     dataRoot: ".beep/ai-metrics",
 *     derivedDir: ".beep/ai-metrics/derived",
 *     duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *     parquetDir: ".beep/ai-metrics/derived/parquet",
 *     rawArchiveDir: ".beep/ai-metrics/raw"
 *   }),
 *   target: "local"
 * })
 * const write = writeAiMetricsDerivedStorage(input)
 * console.log(write)
 * ```
 *
 * @effects
 * - Creates the derived DuckDB directory when missing.
 * - Runs DuckDB table creation and migrations before writing rows.
 * - Upserts ingest, source-file, archive, session, and turn projections inside a transaction.
 * - Recreates the selected Parquet export directory for `latest` or `snapshot` exports.
 * @category services
 * @since 0.0.0
 */
export const writeAiMetricsDerivedStorage = Effect.fn("AiMetrics.writeAiMetricsDerivedStorage")(
  function* (input: AiMetricsDerivedStorageWriteInput) {
    const fs = yield* FileSystem.FileSystem;
    const pathApi = yield* Path.Path;
    const duckdb = yield* DuckDb;
    const parquetExportDir = parquetExportDirFor(pathApi, input);
    yield* fs
      .makeDirectory(pathApi.dirname(input.storage.duckDbPath), { recursive: true })
      .pipe(Effect.mapError((cause) => derivedFailure("Failed to create AI metrics DuckDB storage directory.", cause)));
    if (O.isSome(parquetExportDir)) {
      // Ensure the Parquet root exists so it can be canonicalized as the
      // confinement boundary before the export directory is prepared.
      yield* fs
        .makeDirectory(input.storage.parquetDir, { recursive: true })
        .pipe(Effect.mapError((cause) => derivedFailure("Failed to create AI metrics Parquet root directory.", cause)));
      yield* prepareParquetExportDir(input.storage.parquetDir, parquetExportDir.value);
    }
    const completedAtEpochMillis = yield* Clock.currentTimeMillis;
    const turnCount = recordTurnCount(input.records);
    const archiveObjectCount = countCreatedArchiveObjects(input.records);

    yield* duckdb
      .withTransaction(
        Effect.fn(function* (transaction) {
          yield* ensureAiMetricsDerivedStorageRaw().pipe(Effect.provideService(DuckDb, transaction));
          yield* upsertRun(input, completedAtEpochMillis, turnCount).pipe(Effect.provideService(DuckDb, transaction));
          yield* Effect.forEach(
            input.records,
            Effect.fnUntraced(function* (record) {
              const agentTaskId = yield* upsertAgentTask(input, record).pipe(
                Effect.provideService(DuckDb, transaction)
              );
              yield* upsertSourceFile(input, record).pipe(Effect.provideService(DuckDb, transaction));
              yield* upsertArchiveObject(input, record).pipe(Effect.provideService(DuckDb, transaction));
              yield* upsertSessionAndTurns(input, agentTaskId, record).pipe(Effect.provideService(DuckDb, transaction));
            }),
            { discard: true }
          );
        })
      )
      .pipe(Effect.mapError((cause) => derivedFailure("Failed to write AI metrics derived DuckDB tables.", cause)));

    if (O.isSome(parquetExportDir)) {
      yield* exportDerivedTablesToParquet(parquetExportDir.value);
    }

    return AiMetricsDerivedStorageWriteResult.make({
      archiveObjectCount,
      duckDbPath: input.storage.duckDbPath,
      ingestRunId: input.ingestRunId,
      ...O.getSomesStruct({ parquetExportDir }),
      parquetExportMode: input.parquetExportMode,
      parquetTables: O.isSome(parquetExportDir) ? DERIVED_TABLES : [],
      sourceFileCount: input.records.length,
      turnCount,
    });
  },
  (effect, input) =>
    effect.pipe(
      Effect.withSpan("repo_ai_metrics.derived_storage.write", {
        attributes: {
          "ai_metrics.record_count": input.records.length,
          "ai_metrics.parquet_export_mode": input.parquetExportMode,
          "ai_metrics.target": input.target,
        },
      })
    )
);
