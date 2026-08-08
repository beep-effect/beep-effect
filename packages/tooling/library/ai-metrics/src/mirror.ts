/**
 * P7 sanitized mirror bundle helpers for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions, DuckDbParquetExport } from "@beep/duckdb";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Clock, Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { AiMetricsDeployTarget } from "./models.ts";

const $I = $RepoAiMetricsId.create("mirror");

const defaultLocalDataRoot = ".beep/ai-metrics";
const defaultRemoteMirrorRoot = "/srv/data/ai-metrics/p7-derived-mirror";
const mirrorSchemaVersion = "beep.ai_metrics.mirror_bundle.v1";
const mirrorStatusSchemaVersion = "beep.ai_metrics.mirror_status.v1";

type MirrorTableProjection = {
  readonly columnNames: ReadonlyArray<string>;
  readonly selectSql: string;
  readonly targetTable: string;
};

type ForbiddenTokenCheck = {
  readonly label: string;
  readonly matchMode?: "substring" | "json-string";
  readonly value: string;
};

const selectMirrorColumns = (sourceTable: string, columns: ReadonlyArray<string>): string =>
  `SELECT
      ${pipe(columns, A.join(",\n      "))}
    FROM source_db.${sourceTable}`;

const mirrorTableProjections = [
  {
    columnNames: [
      "ingest_run_id",
      "target",
      "config_snapshot_id",
      "config_hash",
      "started_at_epoch_ms",
      "completed_at_epoch_ms",
      "source_file_count",
      "archive_object_count",
      "turn_count",
    ],
    selectSql: selectMirrorColumns("ai_metrics_ingest_runs", [
      "ingest_run_id",
      "target",
      "config_snapshot_id",
      "config_hash",
      "started_at_epoch_ms",
      "completed_at_epoch_ms",
      "source_file_count",
      "archive_object_count",
      "turn_count",
    ]),
    targetTable: "ai_metrics_ingest_runs",
  },
  {
    columnNames: [
      "source_file_id",
      "ingest_run_id",
      "source_kind",
      "source_path_hash",
      "source_role",
      "session_id_hash",
      "parent_session_id_hash",
      "parent_thread_id_hash",
      "forked_from_id_hash",
      "thread_spawn",
      "agent_role_hash",
      "agent_nickname_hash",
      "total_lines",
      "accepted_events",
      "rejected_lines",
      "first_timestamp",
      "last_timestamp",
      "event_names_json",
      "redaction_safe_for_derived_ui",
      "config_snapshot_id",
    ],
    selectSql: selectMirrorColumns("ai_metrics_source_files", [
      "source_file_id",
      "ingest_run_id",
      "source_kind",
      "source_path_hash",
      "source_role",
      "session_id_hash",
      "parent_session_id_hash",
      "parent_thread_id_hash",
      "forked_from_id_hash",
      "thread_spawn",
      "agent_role_hash",
      "agent_nickname_hash",
      "total_lines",
      "accepted_events",
      "rejected_lines",
      "first_timestamp",
      "last_timestamp",
      "event_names_json",
      "redaction_safe_for_derived_ui",
      "config_snapshot_id",
    ]),
    targetTable: "ai_metrics_source_files",
  },
  {
    columnNames: [
      "agent_task_id",
      "title",
      "source_kind",
      "source_path_hash",
      "source_role",
      "repo_root_hash",
      "config_snapshot_id",
      "created_at_epoch_ms",
      "first_seen_at",
      "last_seen_at",
    ],
    selectSql: selectMirrorColumns("ai_metrics_agent_tasks", [
      "agent_task_id",
      "title",
      "source_kind",
      "source_path_hash",
      "source_role",
      "repo_root_hash",
      "config_snapshot_id",
      "created_at_epoch_ms",
      "first_seen_at",
      "last_seen_at",
    ]),
    targetTable: "ai_metrics_agent_tasks",
  },
  {
    columnNames: [
      "agent_session_id",
      "agent_task_id",
      "ingest_run_id",
      "source_kind",
      "source_path_hash",
      "source_role",
      "session_id_hash",
      "parent_session_id_hash",
      "parent_thread_id_hash",
      "forked_from_id_hash",
      "thread_spawn",
      "agent_role_hash",
      "agent_nickname_hash",
      "started_at",
      "config_snapshot_id",
    ],
    selectSql: selectMirrorColumns("ai_metrics_sessions", [
      "agent_session_id",
      "agent_task_id",
      "ingest_run_id",
      "source_kind",
      "source_path_hash",
      "source_role",
      "session_id_hash",
      "parent_session_id_hash",
      "parent_thread_id_hash",
      "forked_from_id_hash",
      "thread_spawn",
      "agent_role_hash",
      "agent_nickname_hash",
      "started_at",
      "config_snapshot_id",
    ]),
    targetTable: "ai_metrics_sessions",
  },
  {
    columnNames: [
      "turn_id",
      "ingest_run_id",
      "agent_session_id",
      "source_kind",
      "source_path_hash",
      "source_role",
      "line_number",
      "event_name",
      "raw_event_hash",
      "timestamp",
    ],
    selectSql: selectMirrorColumns("ai_metrics_turns", [
      "turn_id",
      "ingest_run_id",
      "agent_session_id",
      "source_kind",
      "source_path_hash",
      "source_role",
      "line_number",
      "event_name",
      "raw_event_hash",
      "timestamp",
    ]),
    targetTable: "ai_metrics_turns",
  },
  {
    columnNames: ["call_id", "ingest_run_id", "provider", "model", "total_tokens", "latency_ms"],
    selectSql: selectMirrorColumns("ai_metrics_model_calls", [
      "call_id",
      "ingest_run_id",
      "provider",
      "model",
      "total_tokens",
      "latency_ms",
    ]),
    targetTable: "ai_metrics_model_calls",
  },
  {
    columnNames: ["tool_run_id", "ingest_run_id", "tool_name", "duration_ms", "exit_code"],
    selectSql: selectMirrorColumns("ai_metrics_tool_invocations", [
      "tool_run_id",
      "ingest_run_id",
      "tool_name",
      "duration_ms",
      "exit_code",
    ]),
    targetTable: "ai_metrics_tool_invocations",
  },
  {
    columnNames: [
      "label_id",
      "agent_task_id",
      "rating",
      "passed",
      "quality_gate",
      "intervention_count",
      "follow_up_fix",
      "note_hash",
      "labeled_at_epoch_ms",
    ],
    selectSql: `SELECT
      label_id,
      agent_task_id,
      rating,
      passed,
      quality_gate,
      intervention_count,
      follow_up_fix,
      CASE WHEN note IS NULL THEN NULL ELSE sha256(note) END AS note_hash,
      labeled_at_epoch_ms
    FROM source_db.ai_metrics_outcome_labels`,
    targetTable: "ai_metrics_outcome_labels",
  },
  {
    columnNames: [
      "benchmark_case_id",
      "title",
      "prompt_hash",
      "prompt_ref_hash",
      "expected_checks_json",
      "created_at_epoch_ms",
    ],
    selectSql: `SELECT
      benchmark_case_id,
      title,
      prompt_hash,
      CASE WHEN prompt_ref IS NULL THEN NULL ELSE sha256(prompt_ref) END AS prompt_ref_hash,
      expected_checks_json,
      created_at_epoch_ms
    FROM source_db.ai_metrics_benchmark_cases`,
    targetTable: "ai_metrics_benchmark_cases",
  },
  {
    columnNames: [
      "benchmark_run_id",
      "benchmark_case_id",
      "config_snapshot_id",
      "elapsed_ms",
      "passed",
      "quality_gate",
      "note_hash",
      "recorded_at_epoch_ms",
    ],
    selectSql: `SELECT
      benchmark_run_id,
      benchmark_case_id,
      config_snapshot_id,
      elapsed_ms,
      passed,
      quality_gate,
      CASE WHEN note IS NULL THEN NULL ELSE sha256(note) END AS note_hash,
      recorded_at_epoch_ms
    FROM source_db.ai_metrics_benchmark_runs`,
    targetTable: "ai_metrics_benchmark_runs",
  },
  {
    columnNames: [
      "scorecard_id",
      "config_snapshot_id",
      "window_start_epoch_ms",
      "window_end_epoch_ms",
      "total_score",
      "outcome_score",
      "flow_score",
      "cost_score",
      "task_count",
      "label_count",
      "benchmark_run_count",
      "completion_ready",
      "coverage_gaps_json",
    ],
    selectSql: selectMirrorColumns("ai_metrics_scorecards", [
      "scorecard_id",
      "config_snapshot_id",
      "window_start_epoch_ms",
      "window_end_epoch_ms",
      "total_score",
      "outcome_score",
      "flow_score",
      "cost_score",
      "task_count",
      "label_count",
      "benchmark_run_count",
      "completion_ready",
      "coverage_gaps_json",
    ]),
    targetTable: "ai_metrics_scorecards",
  },
] as const satisfies ReadonlyArray<MirrorTableProjection>;

const omittedMirrorTables = ["ai_metrics_raw_archive_objects"] as const;

const forbiddenFieldTokens = [
  { label: "archivePath", value: "archivePath" },
  { label: "rawArchiveDir", value: "rawArchiveDir" },
  { label: "duckDbPath", value: "duckDbPath" },
  { label: "parquetExportDir", value: "parquetExportDir" },
  { label: "ciphertextBase64", value: "ciphertextBase64" },
  { label: "nonceBase64", value: "nonceBase64" },
] as const;

const sqlString = (value: string): string => `'${pipe(value, Str.replace(/'/gu, "''"))}'`;

const childPath = (root: string, child: string): string => `${root}/${child}`;

const countFromRow = (row: Record<string, unknown> | undefined): number => {
  const value = row?.count;
  const parsed = globalThis.Number(value);
  return globalThis.Number.isFinite(parsed) ? parsed : 0;
};

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const mirrorFailure = (message: string, cause: unknown): AiMetricsMirrorError =>
  AiMetricsMirrorError.make({ cause, message });

/**
 * Error raised by the P7 AI metrics mirror bundle workflow.
 *
 * **Example** (Construct mirror error)
 *
 * ```ts
 * import { AiMetricsMirrorError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsMirrorError.make({
 *   cause: "privacy proof failed",
 *   message: "AI metrics mirror manifest failed its privacy proof."
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsMirrorError extends TaggedErrorClass<AiMetricsMirrorError>($I`AiMetricsMirrorError`)(
  "AiMetricsMirrorError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annote("AiMetricsMirrorError", {
    description: "Typed failure raised while building or locating sanitized AI metrics mirror bundles.",
  })
) {}

class AiMetricsMirrorLatestPointer extends S.Class<AiMetricsMirrorLatestPointer>($I`AiMetricsMirrorLatestPointer`)(
  {
    bundleDir: S.String,
    bundleId: S.String,
  },
  $I.annote("AiMetricsMirrorLatestPointer", {
    description: "Local pointer to the latest sanitized AI metrics mirror bundle.",
  })
) {}

const decodeLatestPointer = S.decodeUnknownEffect(S.fromJsonString(AiMetricsMirrorLatestPointer));

/**
 * Input for building a sanitized P7 mirror bundle.
 *
 * **Example** (Make empty bundle input)
 *
 * ```ts
 * import { AiMetricsMirrorBundleInput } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsMirrorBundleInput.make({}).remoteRoot)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsMirrorBundleInput extends S.Class<AiMetricsMirrorBundleInput>($I`AiMetricsMirrorBundleInput`)(
  {
    bundleId: S.optionalKey(S.String),
    bundleRoot: S.optionalKey(S.String),
    dataRoot: S.String.pipe(
      S.withConstructorDefault(Effect.succeed(defaultLocalDataRoot)),
      S.withDecodingDefaultKey(Effect.succeed(defaultLocalDataRoot))
    ),
    remoteRoot: S.String.pipe(
      S.withConstructorDefault(Effect.succeed(defaultRemoteMirrorRoot)),
      S.withDecodingDefaultKey(Effect.succeed(defaultRemoteMirrorRoot))
    ),
    target: AiMetricsDeployTarget.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsDeployTarget.Enum.dankserver)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsDeployTarget.Enum.dankserver))
    ),
  },
  $I.annote("AiMetricsMirrorBundleInput", {
    description: "Local derived storage and remote target roots for one deploy-safe P7 mirror bundle build.",
  })
) {}

/**
 * One sanitized table exported into a P7 mirror bundle.
 *
 * **Example** (Make table export)
 *
 * ```ts
 * import { AiMetricsMirrorTableExport } from "@beep/repo-ai-metrics"
 *
 * const table = AiMetricsMirrorTableExport.make({
 *   parquetPath: "parquet/ai_metrics_turns.parquet",
 *   rowCount: 120,
 *   tableName: "ai_metrics_turns"
 * })
 * console.log(table.rowCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsMirrorTableExport extends S.Class<AiMetricsMirrorTableExport>($I`AiMetricsMirrorTableExport`)(
  {
    parquetPath: S.String,
    rowCount: S.Finite,
    tableName: S.String,
  },
  $I.annote("AiMetricsMirrorTableExport", {
    description: "Deploy-safe table and Parquet path produced by a mirror bundle build.",
  })
) {}

/**
 * Privacy proof summary attached to a P7 mirror bundle.
 *
 * **Example** (Make privacy proof)
 *
 * ```ts
 * import { AiMetricsMirrorPrivacyProof } from "@beep/repo-ai-metrics"
 *
 * const proof = AiMetricsMirrorPrivacyProof.make({
 *   checkedTokens: ["rawDir", "derivedDir"],
 *   forbiddenMatches: [],
 *   omittedTables: ["ai_metrics_raw_archive_objects"],
 *   safe: true
 * })
 * console.log(proof.safe)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsMirrorPrivacyProof extends S.Class<AiMetricsMirrorPrivacyProof>($I`AiMetricsMirrorPrivacyProof`)(
  {
    checkedTokens: S.Array(S.String),
    forbiddenMatches: S.Array(S.String),
    omittedTables: S.Array(S.String),
    safe: S.Boolean,
  },
  $I.annote("AiMetricsMirrorPrivacyProof", {
    description: "Machine-readable proof that the manifest and status omit raw archive and local path fields.",
  })
) {}

/**
 * Deploy-safe manifest written into every P7 mirror bundle.
 *
 * **Example** (Make bundle manifest)
 *
 * ```ts
 * import {
 *   AiMetricsMirrorBundleManifest,
 *   AiMetricsMirrorPrivacyProof
 * } from "@beep/repo-ai-metrics"
 *
 * const manifest = AiMetricsMirrorBundleManifest.make({
 *   bundleId: "p7-mirror-1",
 *   createdAtEpochMillis: 1_717_000_000_000,
 *   includedTables: ["ai_metrics_turns"],
 *   mirrorStatusSchemaVersion: "beep.ai_metrics.mirror_status.v1",
 *   omittedDataClasses: ["raw_transcript_bodies"],
 *   omittedTables: ["ai_metrics_raw_archive_objects"],
 *   p6ProofPreserved: true,
 *   privacyProof: AiMetricsMirrorPrivacyProof.make({
 *     checkedTokens: ["rawDir"],
 *     forbiddenMatches: [],
 *     omittedTables: ["ai_metrics_raw_archive_objects"],
 *     safe: true
 *   }),
 *   remoteRoot: "/srv/beep/ai-metrics",
 *   rowCounts: { ai_metrics_turns: 120 },
 *   schemaVersion: "beep.ai_metrics.mirror_bundle.v1",
 *   sourceDataClass: "workstation_local_sanitized_derived_storage",
 *   target: "dankserver"
 * })
 * console.log(manifest.p6ProofPreserved)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsMirrorBundleManifest extends S.Class<AiMetricsMirrorBundleManifest>(
  $I`AiMetricsMirrorBundleManifest`
)(
  {
    bundleId: S.String,
    createdAtEpochMillis: S.Finite,
    includedTables: S.Array(S.String),
    mirrorStatusSchemaVersion: S.String,
    omittedDataClasses: S.Array(S.String),
    omittedTables: S.Array(S.String),
    p6ProofPreserved: S.Boolean,
    privacyProof: AiMetricsMirrorPrivacyProof,
    remoteRoot: S.String,
    rowCounts: S.Record(S.String, S.Finite),
    schemaVersion: S.String,
    sourceDataClass: S.String,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsMirrorBundleManifest", {
    description: "Deploy-safe bundle manifest for the hybrid P7 derived mirror.",
  })
) {}

/**
 * Result of building a sanitized P7 mirror bundle.
 *
 * **Example** (Make bundle result)
 *
 * ```ts
 * import {
 *   AiMetricsMirrorBundleManifest,
 *   AiMetricsMirrorBundleResult,
 *   AiMetricsMirrorPrivacyProof
 * } from "@beep/repo-ai-metrics"
 *
 * const manifest = AiMetricsMirrorBundleManifest.make({
 *   bundleId: "p7-mirror-1",
 *   createdAtEpochMillis: 1_717_000_000_000,
 *   includedTables: [],
 *   mirrorStatusSchemaVersion: "beep.ai_metrics.mirror_status.v1",
 *   omittedDataClasses: [],
 *   omittedTables: [],
 *   p6ProofPreserved: true,
 *   privacyProof: AiMetricsMirrorPrivacyProof.make({
 *     checkedTokens: [],
 *     forbiddenMatches: [],
 *     omittedTables: [],
 *     safe: true
 *   }),
 *   remoteRoot: "/srv/beep/ai-metrics",
 *   rowCounts: {},
 *   schemaVersion: "beep.ai_metrics.mirror_bundle.v1",
 *   sourceDataClass: "workstation_local_sanitized_derived_storage",
 *   target: "dankserver"
 * })
 * const result = AiMetricsMirrorBundleResult.make({
 *   bundleDir: ".beep/ai-metrics/mirror/bundles/p7-mirror-1",
 *   bundleId: "p7-mirror-1",
 *   manifest,
 *   manifestPath: ".beep/ai-metrics/mirror/bundles/p7-mirror-1/manifest.json",
 *   mirrorDuckDbPath: ".beep/ai-metrics/mirror/work/p7-mirror-1/mirror.duckdb",
 *   parquetDir: ".beep/ai-metrics/mirror/bundles/p7-mirror-1/parquet",
 *   statusPath: ".beep/ai-metrics/mirror/bundles/p7-mirror-1/status/mirror-status.json",
 *   tables: []
 * })
 * console.log(result.bundleId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsMirrorBundleResult extends S.Class<AiMetricsMirrorBundleResult>($I`AiMetricsMirrorBundleResult`)(
  {
    bundleDir: S.String,
    bundleId: S.String,
    manifest: AiMetricsMirrorBundleManifest,
    manifestPath: S.String,
    mirrorDuckDbPath: S.String,
    parquetDir: S.String,
    statusPath: S.String,
    tables: S.Array(AiMetricsMirrorTableExport),
  },
  $I.annote("AiMetricsMirrorBundleResult", {
    description: "Local build result for a sanitized P7 AI metrics mirror bundle.",
  })
) {}

/**
 * Locate the latest local mirror bundle pointer for a data root.
 *
 * **Example** (Locate latest mirror bundle)
 *
 * ```ts
 * import { locateLatestAiMetricsMirrorBundle } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 * const program = locateLatestAiMetricsMirrorBundle(".beep/ai-metrics").pipe(
 *   Effect.provide(NodeServices.layer)
 * )
 * console.log(program)
 * ```
 *
 * @effects Reads and decodes `.beep/ai-metrics/mirror/latest.json` under the selected data root.
 * @category services
 * @since 0.0.0
 */
export const locateLatestAiMetricsMirrorBundle = Effect.fn("AiMetrics.locateLatestAiMetricsMirrorBundle")(function* (
  dataRoot: string = defaultLocalDataRoot
) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(childPath(dataRoot, "mirror/latest.json"))
    .pipe(Effect.mapError((cause) => mirrorFailure("Failed to read latest AI metrics mirror bundle pointer.", cause)));
  const pointer = yield* decodeLatestPointer(content).pipe(
    Effect.mapError((cause) => mirrorFailure("Failed to decode latest AI metrics mirror bundle pointer.", cause))
  );
  return pointer.bundleDir;
});

const mirrorStatusFor = (
  input: AiMetricsMirrorBundleInput,
  bundleId: string,
  createdAtEpochMillis: number,
  tables: ReadonlyArray<AiMetricsMirrorTableExport>
) => ({
  bundleId,
  createdAtEpochMillis,
  mirrorStatusSchemaVersion,
  remoteRoot: input.remoteRoot,
  rowCounts: pipe(
    tables,
    A.map((table) => [table.tableName, table.rowCount] as const),
    R.fromEntries
  ),
  syncStatus: "not_synced",
  target: input.target,
});

const privacyProofFor = (
  payload: string,
  additionalForbiddenTokens: ReadonlyArray<ForbiddenTokenCheck> = A.empty<ForbiddenTokenCheck>()
): AiMetricsMirrorPrivacyProof => {
  const checkedTokens = [...forbiddenFieldTokens, ...additionalForbiddenTokens];
  const tokenMatchesPayload = (token: ForbiddenTokenCheck): boolean =>
    token.matchMode === "json-string"
      ? // TODO(effect-native-migration): model schema
        Str.includes(S.encodeUnknownSync(S.fromJsonString(S.Unknown))(token.value))(payload)
      : Str.includes(token.value)(payload);
  const forbiddenMatches = pipe(
    checkedTokens,
    A.filter(tokenMatchesPayload),
    A.map((token) => token.label)
  );

  return AiMetricsMirrorPrivacyProof.make({
    checkedTokens: A.map(checkedTokens, (token) => token.label),
    forbiddenMatches,
    omittedTables: A.fromIterable(omittedMirrorTables),
    safe: A.isReadonlyArrayEmpty(forbiddenMatches),
  });
};

const buildMirrorTables = Effect.fn("AiMetrics.buildMirrorTables")(function* ({
  parquetDir,
  sourceDuckDbPath,
}: {
  readonly parquetDir: string;
  readonly sourceDuckDbPath: string;
}) {
  const duckdb = yield* DuckDb;
  const path = yield* Path.Path;
  yield* duckdb.run(`ATTACH ${sqlString(sourceDuckDbPath)} AS source_db (READ_ONLY)`);
  let exports: ReadonlyArray<AiMetricsMirrorTableExport> = A.empty();

  for (const projection of mirrorTableProjections) {
    yield* duckdb.run(`DROP TABLE IF EXISTS ${projection.targetTable}`);
    yield* duckdb.run(`CREATE TABLE ${projection.targetTable} AS ${projection.selectSql}`);
    const rows = yield* duckdb.query(`SELECT count(*) AS count FROM ${projection.targetTable}`);
    const parquetPath = path.join(parquetDir, `${projection.targetTable}.parquet`);
    yield* duckdb.copyTableToParquet(
      DuckDbParquetExport.make({ filePath: parquetPath, tableName: projection.targetTable })
    );
    exports = A.append(
      exports,
      AiMetricsMirrorTableExport.make({
        parquetPath,
        rowCount: countFromRow(rows[0]),
        tableName: projection.targetTable,
      })
    );
  }

  return exports;
});

/**
 * Build a sanitized deploy-safe P7 mirror bundle from local derived DuckDB data.
 *
 * **Details**
 *
 * The source DuckDB database is attached read-only into a separate mirror
 * database so the active P6 proof database is never mutated by bundle builds.
 *
 * **Example** (Build sanitized mirror bundle)
 *
 * ```ts
 * import { AiMetricsMirrorBundleInput, buildAiMetricsMirrorBundle } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 * const program = buildAiMetricsMirrorBundle(
 *   AiMetricsMirrorBundleInput.make({
 *     dataRoot: ".beep/ai-metrics",
 *     target: "dankserver"
 *   })
 * ).pipe(Effect.provide(NodeServices.layer))
 * console.log(program)
 * ```
 *
 * @effects
 * - Checks for the source derived DuckDB database.
 * - Removes and recreates bundle and mirror working directories.
 * - Attaches the source DuckDB read-only into a temporary mirror database.
 * - Writes sanitized Parquet tables, status JSON, manifest JSON, and latest pointer JSON.
 * - Removes the temporary mirror working directory after a successful build.
 * @category services
 * @since 0.0.0
 */
export const buildAiMetricsMirrorBundle = Effect.fn("AiMetrics.buildAiMetricsMirrorBundle")(function* (
  input: AiMetricsMirrorBundleInput
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const createdAtEpochMillis = yield* Clock.currentTimeMillis;
  const bundleId = input.bundleId ?? `p7-mirror-${createdAtEpochMillis}`;
  const bundleRoot = input.bundleRoot ?? path.join(input.dataRoot, "mirror/bundles");
  const bundleDir = path.join(bundleRoot, bundleId);
  const mirrorWorkDir = path.join(input.dataRoot, "mirror/work", bundleId);
  const parquetDir = path.join(bundleDir, "parquet");
  const statusDir = path.join(bundleDir, "status");
  const manifestPath = path.join(bundleDir, "manifest.json");
  const statusPath = path.join(statusDir, "mirror-status.json");
  const mirrorDuckDbPath = path.join(mirrorWorkDir, "mirror.duckdb");
  const sourceDuckDbPath = path.join(input.dataRoot, "derived/ai-metrics.duckdb");
  const sourceExists = yield* fs
    .exists(sourceDuckDbPath)
    .pipe(
      Effect.mapError((cause) => mirrorFailure("Failed to inspect AI metrics derived DuckDB for mirror build.", cause))
    );

  if (!sourceExists) {
    return yield* mirrorFailure("AI metrics derived DuckDB does not exist for mirror bundle build.", {
      sourceDuckDbPath,
    });
  }

  yield* fs
    .remove(bundleDir, { force: true, recursive: true })
    .pipe(Effect.mapError((cause) => mirrorFailure("Failed to reset AI metrics mirror bundle directory.", cause)));
  yield* fs
    .remove(mirrorWorkDir, { force: true, recursive: true })
    .pipe(Effect.mapError((cause) => mirrorFailure("Failed to reset AI metrics mirror working directory.", cause)));
  yield* fs
    .makeDirectory(parquetDir, { recursive: true })
    .pipe(Effect.mapError((cause) => mirrorFailure("Failed to create AI metrics mirror Parquet directory.", cause)));
  yield* fs
    .makeDirectory(statusDir, { recursive: true })
    .pipe(Effect.mapError((cause) => mirrorFailure("Failed to create AI metrics mirror status directory.", cause)));
  yield* fs
    .makeDirectory(mirrorWorkDir, { recursive: true })
    .pipe(Effect.mapError((cause) => mirrorFailure("Failed to create AI metrics mirror working directory.", cause)));

  const tables = yield* Effect.scoped(
    Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: mirrorDuckDbPath }))).pipe(
      Effect.flatMap((context) => buildMirrorTables({ parquetDir, sourceDuckDbPath }).pipe(Effect.provide(context)))
    )
  ).pipe(Effect.mapError((cause) => mirrorFailure("Failed to build AI metrics mirror tables.", cause)));
  const status = mirrorStatusFor(input, bundleId, createdAtEpochMillis, tables);
  const statusJson = yield* encodeJson(status).pipe(
    Effect.mapError((cause) => mirrorFailure("Failed to encode AI metrics mirror status JSON.", cause))
  );
  const forbiddenLocalTokens: ReadonlyArray<ForbiddenTokenCheck> = [
    { label: "dataRoot", matchMode: "json-string", value: input.dataRoot },
    { label: "sourceDuckDbPath", matchMode: "json-string", value: sourceDuckDbPath },
    { label: "rawDir", matchMode: "json-string", value: path.join(input.dataRoot, "raw") },
    { label: "derivedDir", matchMode: "json-string", value: path.join(input.dataRoot, "derived") },
    { label: "configSnapshotsDir", matchMode: "json-string", value: path.join(input.dataRoot, "config-snapshots") },
  ];
  const rowCounts = pipe(
    tables,
    A.map((table) => [table.tableName, table.rowCount] as const),
    R.fromEntries
  );
  const manifestBase = {
    bundleId,
    createdAtEpochMillis,
    includedTables: A.map(tables, (table) => table.tableName),
    mirrorStatusSchemaVersion,
    omittedDataClasses: [
      "raw_transcript_bodies",
      "encrypted_raw_archive_objects",
      "raw_archive_paths",
      "local_source_paths",
      "local_storage_paths",
      "prompt_output_text",
      "secret_values",
    ],
    omittedTables: A.fromIterable(omittedMirrorTables),
    p6ProofPreserved: true,
    remoteRoot: input.remoteRoot,
    rowCounts,
    schemaVersion: mirrorSchemaVersion,
    sourceDataClass: "workstation_local_sanitized_derived_storage",
    target: input.target,
  };
  const manifestBaseJson = yield* encodeJson(manifestBase).pipe(
    Effect.mapError((cause) => mirrorFailure("Failed to encode AI metrics mirror manifest probe JSON.", cause))
  );
  const privacyProof = privacyProofFor(`${statusJson}\n${manifestBaseJson}`, forbiddenLocalTokens);
  const manifest = AiMetricsMirrorBundleManifest.make({
    ...manifestBase,
    privacyProof,
  });
  const manifestJson = yield* encodeJson(manifest).pipe(
    Effect.mapError((cause) => mirrorFailure("Failed to encode AI metrics mirror manifest JSON.", cause))
  );

  if (!privacyProof.safe) {
    return yield* mirrorFailure("AI metrics mirror manifest failed its privacy proof.", privacyProof);
  }

  yield* fs
    .writeFileString(statusPath, statusJson)
    .pipe(Effect.mapError((cause) => mirrorFailure("Failed to write AI metrics mirror status JSON.", cause)));
  yield* fs
    .writeFileString(manifestPath, manifestJson)
    .pipe(Effect.mapError((cause) => mirrorFailure("Failed to write AI metrics mirror manifest JSON.", cause)));
  yield* fs
    .writeFileString(
      path.join(input.dataRoot, "mirror/latest.json"),
      yield* encodeJson({ bundleDir, bundleId }).pipe(
        Effect.mapError((cause) => mirrorFailure("Failed to encode AI metrics latest mirror pointer.", cause))
      )
    )
    .pipe(Effect.mapError((cause) => mirrorFailure("Failed to write latest AI metrics mirror pointer.", cause)));
  yield* fs
    .remove(mirrorWorkDir, { force: true, recursive: true })
    .pipe(Effect.mapError((cause) => mirrorFailure("Failed to clean up AI metrics mirror working directory.", cause)));

  return AiMetricsMirrorBundleResult.make({
    bundleDir,
    bundleId,
    manifest,
    manifestPath,
    mirrorDuckDbPath,
    parquetDir,
    statusPath,
    tables,
  });
});

const encodeMirrorBundleJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsMirrorBundleResult));

/**
 * Render a mirror bundle build result as JSON.
 *
 * **Example** (Render bundle result JSON)
 *
 * ```ts
 * import {
 *   AiMetricsMirrorBundleManifest,
 *   AiMetricsMirrorBundleResult,
 *   AiMetricsMirrorPrivacyProof,
 *   aiMetricsMirrorBundleToJson
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const manifest = AiMetricsMirrorBundleManifest.make({
 *   bundleId: "p7-mirror-1",
 *   createdAtEpochMillis: 1_717_000_000_000,
 *   includedTables: [],
 *   mirrorStatusSchemaVersion: "beep.ai_metrics.mirror_status.v1",
 *   omittedDataClasses: [],
 *   omittedTables: [],
 *   p6ProofPreserved: true,
 *   privacyProof: AiMetricsMirrorPrivacyProof.make({
 *     checkedTokens: [],
 *     forbiddenMatches: [],
 *     omittedTables: [],
 *     safe: true
 *   }),
 *   remoteRoot: "/srv/beep/ai-metrics",
 *   rowCounts: {},
 *   schemaVersion: "beep.ai_metrics.mirror_bundle.v1",
 *   sourceDataClass: "workstation_local_sanitized_derived_storage",
 *   target: "dankserver"
 * })
 * const json = Effect.runPromise(
 *   aiMetricsMirrorBundleToJson(
 *     AiMetricsMirrorBundleResult.make({
 *       bundleDir: ".beep/ai-metrics/mirror/bundles/p7-mirror-1",
 *       bundleId: "p7-mirror-1",
 *       manifest,
 *       manifestPath: ".beep/ai-metrics/mirror/bundles/p7-mirror-1/manifest.json",
 *       mirrorDuckDbPath: ".beep/ai-metrics/mirror/work/p7-mirror-1/mirror.duckdb",
 *       parquetDir: ".beep/ai-metrics/mirror/bundles/p7-mirror-1/parquet",
 *       statusPath: ".beep/ai-metrics/mirror/bundles/p7-mirror-1/status/mirror-status.json",
 *       tables: []
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsMirrorBundleToJson: (
  result: AiMetricsMirrorBundleResult
) => Effect.Effect<string, AiMetricsMirrorError> = Effect.fn("AiMetrics.aiMetricsMirrorBundleToJson")((result) =>
  encodeMirrorBundleJson(result).pipe(
    Effect.mapError((cause) => mirrorFailure("Failed to encode AI metrics mirror bundle result as JSON.", cause))
  )
);
