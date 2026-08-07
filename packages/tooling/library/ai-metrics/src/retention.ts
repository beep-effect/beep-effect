/**
 * P7 retention, restore, delete, and compaction workflows for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Clock, Effect, FileSystem, flow, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import {
  AiMetricsRawArchiveKey,
  decryptEncryptedRawArchiveEnvelope,
  readEncryptedRawArchiveEnvelope,
  writeEncryptedRawArchiveObject,
} from "./archive.ts";
import {
  AiMetricsDerivedStorageWriteInput,
  AiMetricsDerivedTranscriptRecord,
  writeAiMetricsDerivedStorage,
} from "./derived-storage.ts";
import { aiMetricsDerivedDuckDbPath, DEFAULT_AI_METRICS_DATA_ROOT, withAiMetricsDuckDb } from "./duckdb.ts";
import { summarizeTranscriptText } from "./ingest.ts";
import { AiMetricsInstallInput, makeAiMetricsInstallSpec } from "./install.ts";
import { AiMetricsDeployTarget, AiMetricsTranscriptSource, ConfigSnapshot } from "./models.ts";
import { hashPrivateIdentifier, hashPublicTextSha256, makeAiMetricsPrivacyCheckResult } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("retention");

const retentionSchemaVersion = "beep.ai_metrics.retention_inventory.v1";
const retentionMutationSchemaVersion = "beep.ai_metrics.retention_mutation.v1";
const retentionEnforcementSchemaVersion = "beep.ai_metrics.retention_enforcement.v1";
const restoreDrillSchemaVersion = "beep.ai_metrics.retention_restore_drill.v1";
const AiMetricsRetentionMutationMode = LiteralKit(["delete", "compact"]).pipe(
  $I.annoteSchema("AiMetricsRetentionMutationMode", {
    description: "Mutation operation recorded by AI metrics retention delete and compact workflows.",
  })
);
const RawArchiveObjectIdPattern = /^raw-[a-f0-9]{64}$/u;
const isAiMetricsTranscriptSource = (value: string): value is AiMetricsTranscriptSource =>
  AiMetricsTranscriptSource.is.claude(value) ||
  AiMetricsTranscriptSource.is.codex(value) ||
  AiMetricsTranscriptSource.is.openclaw(value);

class RawArchivePlanItem extends S.Class<RawArchivePlanItem>($I`RawArchivePlanItem`)(
  {
    archiveObjectId: S.String,
    archivePath: S.String,
    archiveRunObjectId: S.String,
    encryptedAtEpochMillis: S.Finite,
    ingestRunId: S.String,
    plaintextContentHash: S.String,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
  },
  $I.annote("RawArchivePlanItem", {
    description: "A plan item for a raw archive object",
  })
) {}

class PathPlanItem extends S.Class<PathPlanItem>($I`PathPlanItem`)(
  {
    absolutePath: S.String,
    modifiedAtEpochMillis: S.Finite,
    relativePath: S.String,
  },
  $I.annote("PathPlanItem", {
    description: "A plan item for a path",
  })
) {}

class RetentionPlan extends S.Class<RetentionPlan>($I`RetentionPlan`)(
  {
    benchmarkRunIds: S.Array(S.String),
    derivedExportItems: S.Array(PathPlanItem),
    ingestRunIds: S.Array(S.String),
    labelIds: S.Array(S.String),
    rawArchiveItems: S.Array(RawArchivePlanItem),
    reportItems: S.Array(PathPlanItem),
    scorecardIds: S.Array(S.String),
  },
  $I.annote("RetentionPlan", {
    description: "A plan for retention of data",
  })
) {}

const retentionFailure = (message: string, cause: unknown): AiMetricsRetentionError =>
  AiMetricsRetentionError.make({
    cause,
    message,
  });

const numberValue = (value: unknown): number => {
  const parsed = globalThis.Number(value);
  return globalThis.Number.isFinite(parsed) ? parsed : 0;
};

const stringValue = (value: unknown): string => (P.isString(value) ? value : globalThis.String(value ?? ""));

const optionalModifiedAtMillis = (info: FileSystem.File.Info): number =>
  pipe(
    info.mtime,
    O.map((mtime) => mtime.getTime()),
    O.getOrElse(() => 0)
  );

const inWindow =
  (input: AiMetricsRetentionSelector) =>
  (epochMillis: number): boolean => {
    const lower = input.sinceEpochMillis;
    const upper = input.beforeEpochMillis ?? input.untilEpochMillis;
    return (lower === undefined || epochMillis >= lower) && (upper === undefined || epochMillis < upper);
  };

const hasExplicitWindow = (input: AiMetricsRetentionSelector): boolean =>
  input.beforeEpochMillis !== undefined || input.sinceEpochMillis !== undefined || input.untilEpochMillis !== undefined;

const retentionWindowUpper = (input: AiMetricsRetentionSelector): number | undefined =>
  input.beforeEpochMillis ?? input.untilEpochMillis;

const hasBoundedMutationWindow = (input: AiMetricsRetentionSelector): boolean =>
  input.beforeEpochMillis !== undefined ||
  (input.sinceEpochMillis !== undefined && input.untilEpochMillis !== undefined);

const hasOrderedMutationWindow = (input: AiMetricsRetentionSelector): boolean => {
  const upper = retentionWindowUpper(input);
  return input.sinceEpochMillis === undefined || upper === undefined || input.sinceEpochMillis < upper;
};

const relativeToDataRoot = (dataRoot: string, absolutePath: string): string =>
  Str.startsWith(`${dataRoot}/`)(absolutePath) ? pipe(absolutePath, Str.slice(dataRoot.length + 1)) : absolutePath;

const quoteSqlString = flow(Str.replace(/'/gu, "''"), (value) => `'${value}'`);

const sqlStringList: (values: ReadonlyArray<string>) => string = flow(A.map(quoteSqlString), A.join(", "));

const normalizedRelativePath = (path: Path.Path, root: string, filePath: string): string =>
  pipe(path.relative(root, filePath), Str.replace(/\\/gu, "/"));

const isStrictChildPath = (path: Path.Path, root: string, filePath: string): boolean => {
  const relativePath = normalizedRelativePath(path, root, filePath);
  return (
    Str.isNonEmpty(relativePath) &&
    relativePath !== ".." &&
    !Str.startsWith("../")(relativePath) &&
    !Str.startsWith("/")(relativePath)
  );
};

const validateRawArchivePath = (
  path: Path.Path,
  dataRoot: string,
  item: RawArchivePlanItem
): Effect.Effect<string, AiMetricsRetentionError> => {
  if (!RawArchiveObjectIdPattern.test(item.archiveObjectId)) {
    return Effect.fail(
      retentionFailure("AI metrics raw archive object id is not in the generated raw digest format.", {
        archiveObjectId: item.archiveObjectId,
      })
    );
  }

  const sourceArchiveDir = path.resolve(dataRoot, "raw", item.sourceKind);
  const expectedArchivePath = path.resolve(sourceArchiveDir, `${item.archiveObjectId}.json`);
  const selectedArchivePath = path.resolve(item.archivePath);
  if (selectedArchivePath !== expectedArchivePath || !isStrictChildPath(path, sourceArchiveDir, selectedArchivePath)) {
    return Effect.fail(
      retentionFailure("AI metrics raw archive path is outside the expected storage layout.", {
        archiveObjectId: item.archiveObjectId,
        expectedArchivePath,
        selectedArchivePath,
      })
    );
  }

  return Effect.succeed(selectedArchivePath);
};

/**
 * Error raised by P7 AI metrics retention workflows.
 *
 * @example
 * ```ts
 * import { AiMetricsRetentionError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsRetentionError.make({
 *   cause: "duckdb unavailable",
 *   message: "Failed to read AI metrics retention inventory."
 * })
 * console.log(error.message)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsRetentionError extends TaggedErrorClass<AiMetricsRetentionError>($I`AiMetricsRetentionError`)(
  "AiMetricsRetentionError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annote("AiMetricsRetentionError", {
    description: "Typed failure raised by AI metrics retention, restore, delete, and compaction workflows.",
  })
) {}

/**
 * Time-window selector for AI metrics retention commands.
 *
 * @example
 * ```ts
 * import { AiMetricsRetentionSelector } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsRetentionSelector.make({}).dataRoot)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionSelector extends S.Class<AiMetricsRetentionSelector>($I`AiMetricsRetentionSelector`)(
  {
    beforeEpochMillis: S.optionalKey(S.Finite),
    dataRoot: S.String.pipe(
      S.withConstructorDefault(Effect.succeed(DEFAULT_AI_METRICS_DATA_ROOT)),
      S.withDecodingDefaultKey(Effect.succeed(DEFAULT_AI_METRICS_DATA_ROOT))
    ),
    sinceEpochMillis: S.optionalKey(S.Finite),
    untilEpochMillis: S.optionalKey(S.Finite),
  },
  $I.annote("AiMetricsRetentionSelector", {
    description: "Local data root and optional explicit time window for AI metrics retention operations.",
  })
) {}

/**
 * Deploy-safe raw archive inventory row.
 *
 * @example
 * ```ts
 * import { AiMetricsRetentionRawArchiveItem } from "@beep/repo-ai-metrics"
 *
 * const item = AiMetricsRetentionRawArchiveItem.make({
 *   archiveObjectId: "raw-0123456789abcdef",
 *   encryptedAtEpochMillis: 1_717_000_000_000,
 *   ingestRunId: "ingest-1",
 *   plaintextContentHash: "content-hash",
 *   sourceKind: "codex",
 *   sourcePathHash: "source-hash"
 * })
 * console.log(item.sourceKind)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionRawArchiveItem extends S.Class<AiMetricsRetentionRawArchiveItem>(
  $I`AiMetricsRetentionRawArchiveItem`
)(
  {
    archiveObjectId: S.String,
    encryptedAtEpochMillis: S.Finite,
    ingestRunId: S.String,
    plaintextContentHash: S.String,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
  },
  $I.annote("AiMetricsRetentionRawArchiveItem", {
    description: "Path-free retained raw archive row selected for local operator workflows.",
  })
) {}

/**
 * Deploy-safe retained file inventory row.
 *
 * @example
 * ```ts
 * import { AiMetricsRetentionFileItem } from "@beep/repo-ai-metrics"
 *
 * const file = AiMetricsRetentionFileItem.make({
 *   modifiedAtEpochMillis: 1_717_000_000_000,
 *   relativePath: "derived/parquet/forwarder-1"
 * })
 * console.log(file.relativePath)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionFileItem extends S.Class<AiMetricsRetentionFileItem>($I`AiMetricsRetentionFileItem`)(
  {
    modifiedAtEpochMillis: S.Finite,
    relativePath: S.String,
  },
  $I.annote("AiMetricsRetentionFileItem", {
    description: "Retained derived or report file represented relative to the AI metrics data root.",
  })
) {}

/**
 * Path-safe inventory returned by `ai-metrics retention list`.
 *
 * @example
 * ```ts
 * import {
 *   AiMetricsRetentionFileItem,
 *   AiMetricsRetentionInventory,
 *   AiMetricsRetentionRawArchiveItem
 * } from "@beep/repo-ai-metrics"
 *
 * const inventory = AiMetricsRetentionInventory.make({
 *   derivedExports: [
 *     AiMetricsRetentionFileItem.make({
 *       modifiedAtEpochMillis: 1_717_000_000_000,
 *       relativePath: "derived/parquet/forwarder-1"
 *     })
 *   ],
 *   explicitWindow: true,
 *   rawArchiveObjects: [
 *     AiMetricsRetentionRawArchiveItem.make({
 *       archiveObjectId: "raw-0123456789abcdef",
 *       encryptedAtEpochMillis: 1_717_000_000_000,
 *       ingestRunId: "ingest-1",
 *       plaintextContentHash: "content-hash",
 *       sourceKind: "codex",
 *       sourcePathHash: "source-hash"
 *     })
 *   ],
 *   reports: [],
 *   schemaVersion: "beep.ai_metrics.retention_inventory.v1",
 *   selectedDerivedExportCount: 1,
 *   selectedRawArchiveObjectCount: 1,
 *   selectedReportCount: 0
 * })
 * console.log(inventory.selectedRawArchiveObjectCount)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionInventory extends S.Class<AiMetricsRetentionInventory>($I`AiMetricsRetentionInventory`)(
  {
    derivedExports: S.Array(AiMetricsRetentionFileItem),
    explicitWindow: S.Boolean,
    rawArchiveObjects: S.Array(AiMetricsRetentionRawArchiveItem),
    reports: S.Array(AiMetricsRetentionFileItem),
    schemaVersion: S.String,
    selectedDerivedExportCount: S.Finite,
    selectedRawArchiveObjectCount: S.Finite,
    selectedReportCount: S.Finite,
  },
  $I.annote("AiMetricsRetentionInventory", {
    description: "Path-safe retained AI metrics raw, derived, and report inventory for one selector.",
  })
) {}

/**
 * Result for delete or compaction retention commands.
 *
 * @example
 * ```ts
 * import { AiMetricsRetentionMutationResult } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsRetentionMutationResult.make({
 *   deletedDerivedExportCount: 2,
 *   deletedRawArchiveObjectCount: 1,
 *   deletedReportCount: 0,
 *   dryRun: true,
 *   explicitWindow: true,
 *   mode: "delete",
 *   schemaVersion: "beep.ai_metrics.retention_mutation.v1"
 * })
 * console.log(result.dryRun)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionMutationResult extends S.Class<AiMetricsRetentionMutationResult>(
  $I`AiMetricsRetentionMutationResult`
)(
  {
    deletedDerivedExportCount: S.Finite,
    deletedRawArchiveObjectCount: S.Finite,
    deletedReportCount: S.Finite,
    dryRun: S.Boolean,
    explicitWindow: S.Boolean,
    mode: AiMetricsRetentionMutationMode,
    schemaVersion: S.String,
  },
  $I.annote("AiMetricsRetentionMutationResult", {
    description: "Summary for an AI metrics retention delete or compaction run.",
  })
) {}

/**
 * Policy for preventive local AI metrics retention enforcement.
 *
 * @example
 * ```ts
 * import { AiMetricsRetentionEnforcementPolicy } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsRetentionEnforcementPolicy.make({}).maxSnapshotExports)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionEnforcementPolicy extends S.Class<AiMetricsRetentionEnforcementPolicy>(
  $I`AiMetricsRetentionEnforcementPolicy`
)(
  {
    dataRoot: S.String.pipe(
      S.withConstructorDefault(Effect.succeed(DEFAULT_AI_METRICS_DATA_ROOT)),
      S.withDecodingDefaultKey(Effect.succeed(DEFAULT_AI_METRICS_DATA_ROOT))
    ),
    dryRun: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
    maxSnapshotExports: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
  },
  $I.annote("AiMetricsRetentionEnforcementPolicy", {
    description: "Preventive policy for removing old per-run AI metrics Parquet snapshots.",
  })
) {}

/**
 * Result for preventive local AI metrics retention enforcement.
 *
 * @example
 * ```ts
 * import { AiMetricsRetentionEnforcementResult } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsRetentionEnforcementResult.make({
 *   dataRoot: ".beep/ai-metrics",
 *   deletedDerivedExportCount: 3,
 *   dryRun: true,
 *   keptDerivedExportCount: 2,
 *   maxSnapshotExports: 2,
 *   schemaVersion: "beep.ai_metrics.retention_enforcement.v1"
 * })
 * console.log(result.deletedDerivedExportCount)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionEnforcementResult extends S.Class<AiMetricsRetentionEnforcementResult>(
  $I`AiMetricsRetentionEnforcementResult`
)(
  {
    dataRoot: S.String,
    deletedDerivedExportCount: S.Finite,
    dryRun: S.Boolean,
    keptDerivedExportCount: S.Finite,
    maxSnapshotExports: S.Finite,
    schemaVersion: S.String,
  },
  $I.annote("AiMetricsRetentionEnforcementResult", {
    description: "Summary for preventive AI metrics Parquet snapshot retention enforcement.",
  })
) {}

/**
 * Input for a retained raw archive restore drill.
 *
 * @example
 * ```ts
 * import { AiMetricsRetentionRestoreDrillInput, AiMetricsRetentionSelector } from "@beep/repo-ai-metrics"
 * import { Redacted } from "effect"
 *
 * const input = AiMetricsRetentionRestoreDrillInput.make({
 *   maxObjects: 1,
 *   rawArchiveKey: Redacted.make("base64-32-byte-key"),
 *   restoreRoot: "/tmp/ai-metrics-restore",
 *   selector: AiMetricsRetentionSelector.make({ dataRoot: ".beep/ai-metrics" })
 * })
 * console.log(input.maxObjects)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionRestoreDrillInput extends S.Class<AiMetricsRetentionRestoreDrillInput>(
  $I`AiMetricsRetentionRestoreDrillInput`
)(
  {
    hashSalt: S.optionalKey(S.String),
    maxObjects: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(1)), S.withDecodingDefaultKey(Effect.succeed(1))),
    rawArchiveKey: AiMetricsRawArchiveKey,
    restoreRoot: S.String,
    selector: AiMetricsRetentionSelector,
  },
  $I.annote("AiMetricsRetentionRestoreDrillInput", {
    description: "Restore drill request that replays selected archive objects into disposable derived storage.",
  })
) {}

/**
 * Result for a retained raw archive restore drill.
 *
 * @example
 * ```ts
 * import { AiMetricsRetentionRestoreDrillResult } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsRetentionRestoreDrillResult.make({
 *   derivedDuckDbPath: "/tmp/ai-metrics-restore/derived/ai-metrics.duckdb",
 *   hashMatches: true,
 *   replayedObjectCount: 1,
 *   restoreRoot: "/tmp/ai-metrics-restore",
 *   schemaVersion: "beep.ai_metrics.retention_restore_drill.v1",
 *   transcriptTextPrinted: false
 * })
 * console.log(result.hashMatches)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionRestoreDrillResult extends S.Class<AiMetricsRetentionRestoreDrillResult>(
  $I`AiMetricsRetentionRestoreDrillResult`
)(
  {
    derivedDuckDbPath: S.String,
    hashMatches: S.Boolean,
    replayedObjectCount: S.Finite,
    restoreRoot: S.String,
    schemaVersion: S.String,
    transcriptTextPrinted: S.Boolean,
  },
  $I.annote("AiMetricsRetentionRestoreDrillResult", {
    description:
      "Proof that retained encrypted archive objects can decrypt and replay into disposable derived storage.",
  })
) {}

const listDirectoryFiles = Effect.fn("AiMetrics.retention.listDirectoryFiles")(function* (
  dataRoot: string,
  relativeRoot: string
): Effect.fn.Return<ReadonlyArray<PathPlanItem>, AiMetricsRetentionError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(dataRoot, relativeRoot);
  const rootExists = yield* fs
    .exists(root)
    .pipe(Effect.mapError((cause) => retentionFailure("Failed to inspect AI metrics retained directory root.", cause)));
  if (!rootExists) {
    return A.empty<PathPlanItem>();
  }

  const walk = Effect.fnUntraced(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<PathPlanItem>, AiMetricsRetentionError, FileSystem.FileSystem | Path.Path> {
    const stat = yield* fs
      .stat(currentPath)
      .pipe(Effect.mapError((cause) => retentionFailure("Failed to inspect an AI metrics retained file.", cause)));
    if (stat.type === "File") {
      return [
        {
          absolutePath: currentPath,
          modifiedAtEpochMillis: optionalModifiedAtMillis(stat),
          relativePath: relativeToDataRoot(dataRoot, currentPath),
        },
      ];
    }

    if (stat.type !== "Directory") {
      return A.empty<PathPlanItem>();
    }

    const entries = yield* fs
      .readDirectory(currentPath)
      .pipe(Effect.mapError((cause) => retentionFailure("Failed to read AI metrics retained directory.", cause)));
    const nested = yield* Effect.forEach(entries, (entry) => walk(path.join(currentPath, entry)), { concurrency: 8 });
    return A.flatten(nested);
  });

  return pipe(yield* walk(root), A.sort(Order.mapInput(Order.String, (item: PathPlanItem) => item.relativePath)));
});

const readRetentionPlan = Effect.fn("AiMetrics.retention.readPlan")(function* (input: AiMetricsRetentionSelector) {
  const duckdb = yield* DuckDb;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const withinWindow = inWindow(input);
  const rawRows = yield* duckdb.query(`SELECT archive_run_object_id  AS "archiveRunObjectId",
                                              archive_object_id      AS "archiveObjectId",
                                              ingest_run_id          AS "ingestRunId",
                                              source_kind            AS "sourceKind",
                                              source_path_hash       AS "sourcePathHash",
                                              plaintext_content_hash AS "plaintextContentHash",
                                              archive_path           AS "archivePath",
                                              encrypted_at_epoch_ms  AS "encryptedAtEpochMillis"
                                       FROM ai_metrics_raw_archive_objects
                                       ORDER BY encrypted_at_epoch_ms ASC`);
  const rawArchiveItems = pipe(
    rawRows,
    A.map((row): RawArchivePlanItem => {
      const sourceKind = stringValue(row.sourceKind);
      return {
        archiveObjectId: stringValue(row.archiveObjectId),
        archivePath: stringValue(row.archivePath),
        archiveRunObjectId: stringValue(row.archiveRunObjectId),
        encryptedAtEpochMillis: numberValue(row.encryptedAtEpochMillis),
        ingestRunId: stringValue(row.ingestRunId),
        plaintextContentHash: stringValue(row.plaintextContentHash),
        sourceKind: isAiMetricsTranscriptSource(sourceKind) ? sourceKind : AiMetricsTranscriptSource.Enum.codex,
        sourcePathHash: stringValue(row.sourcePathHash),
      };
    }),
    A.filter((item) => withinWindow(item.encryptedAtEpochMillis))
  );
  const runRows = yield* duckdb.query(`SELECT ingest_run_id         AS "ingestRunId",
                                              completed_at_epoch_ms AS "completedAtEpochMillis"
                                       FROM ai_metrics_ingest_runs
                                       ORDER BY completed_at_epoch_ms ASC`);
  const windowIngestRunIds = pipe(
    runRows,
    A.filter((row) => withinWindow(numberValue(row.completedAtEpochMillis))),
    A.map((row) => stringValue(row.ingestRunId))
  );
  const ingestRunIds = pipe(
    windowIngestRunIds,
    A.appendAll(A.map(rawArchiveItems, (item) => item.ingestRunId)),
    A.dedupe
  );
  const labelRows = yield* duckdb.query(`SELECT label_id            AS "labelId",
                                                labeled_at_epoch_ms AS "labeledAtEpochMillis"
                                         FROM ai_metrics_outcome_labels
                                         ORDER BY labeled_at_epoch_ms ASC`);
  const labelIds = pipe(
    labelRows,
    A.filter((row) => withinWindow(numberValue(row.labeledAtEpochMillis))),
    A.map((row) => stringValue(row.labelId))
  );
  const benchmarkRunRows = yield* duckdb.query(`SELECT benchmark_run_id     AS "benchmarkRunId",
                                                       recorded_at_epoch_ms AS "recordedAtEpochMillis"
                                                FROM ai_metrics_benchmark_runs
                                                ORDER BY recorded_at_epoch_ms ASC`);
  const benchmarkRunIds = pipe(
    benchmarkRunRows,
    A.filter((row) => withinWindow(numberValue(row.recordedAtEpochMillis))),
    A.map((row) => stringValue(row.benchmarkRunId))
  );
  const scorecardRows = yield* duckdb.query(`SELECT scorecard_id        AS "scorecardId",
                                                    window_end_epoch_ms AS "windowEndEpochMillis"
                                             FROM ai_metrics_scorecards
                                             ORDER BY window_end_epoch_ms ASC`);
  const scorecardIds = pipe(
    scorecardRows,
    A.filter((row) => withinWindow(numberValue(row.windowEndEpochMillis))),
    A.map((row) => stringValue(row.scorecardId))
  );
  const derivedRoot = path.join(input.dataRoot, "derived/parquet");
  const derivedRootExists = yield* fs
    .exists(derivedRoot)
    .pipe(
      Effect.mapError((cause) => retentionFailure("Failed to inspect AI metrics Parquet export directory.", cause))
    );
  let derivedExportItems = A.empty<PathPlanItem>();
  if (derivedRootExists) {
    const entries = yield* fs
      .readDirectory(derivedRoot)
      .pipe(Effect.mapError((cause) => retentionFailure("Failed to read AI metrics Parquet export directory.", cause)));
    const items = yield* Effect.forEach(
      entries,
      Effect.fnUntraced(function* (entry): Effect.fn.Return<
        O.Option<PathPlanItem>,
        AiMetricsRetentionError,
        FileSystem.FileSystem
      > {
        const absolutePath = path.join(derivedRoot, entry);
        const stat = yield* fs
          .stat(absolutePath)
          .pipe(Effect.mapError((cause) => retentionFailure("Failed to inspect AI metrics Parquet export.", cause)));
        if (stat.type !== "Directory") {
          return O.none<PathPlanItem>();
        }

        const item = {
          absolutePath,
          modifiedAtEpochMillis: optionalModifiedAtMillis(stat),
          relativePath: relativeToDataRoot(input.dataRoot, absolutePath),
        };
        return A.contains(ingestRunIds, entry) || withinWindow(item.modifiedAtEpochMillis)
          ? O.some(item)
          : O.none<PathPlanItem>();
      }),
      { concurrency: 8 }
    );
    derivedExportItems = A.getSomes(items);
  }
  const reportItems = pipe(
    yield* listDirectoryFiles(input.dataRoot, "reports"),
    A.filter((item) => withinWindow(item.modifiedAtEpochMillis))
  );

  return {
    benchmarkRunIds,
    derivedExportItems,
    ingestRunIds,
    labelIds,
    rawArchiveItems,
    reportItems,
    scorecardIds,
  } satisfies RetentionPlan;
});

const planToInventory = (input: AiMetricsRetentionSelector, plan: RetentionPlan): AiMetricsRetentionInventory =>
  AiMetricsRetentionInventory.make({
    derivedExports: A.map(plan.derivedExportItems, (item) =>
      AiMetricsRetentionFileItem.make({
        modifiedAtEpochMillis: item.modifiedAtEpochMillis,
        relativePath: item.relativePath,
      })
    ),
    explicitWindow: hasExplicitWindow(input),
    rawArchiveObjects: A.map(plan.rawArchiveItems, (item) =>
      AiMetricsRetentionRawArchiveItem.make({
        archiveObjectId: item.archiveObjectId,
        encryptedAtEpochMillis: item.encryptedAtEpochMillis,
        ingestRunId: item.ingestRunId,
        plaintextContentHash: item.plaintextContentHash,
        sourceKind: item.sourceKind,
        sourcePathHash: item.sourcePathHash,
      })
    ),
    reports: A.map(plan.reportItems, (item) =>
      AiMetricsRetentionFileItem.make({
        modifiedAtEpochMillis: item.modifiedAtEpochMillis,
        relativePath: item.relativePath,
      })
    ),
    schemaVersion: retentionSchemaVersion,
    selectedDerivedExportCount: plan.derivedExportItems.length,
    selectedRawArchiveObjectCount: plan.rawArchiveItems.length,
    selectedReportCount: plan.reportItems.length,
  });

/**
 * List retained AI metrics raw archive objects and derived/report outputs.
 *
 * @effects
 * - Opens the derived DuckDB database under the selected data root.
 * - Reads retention rows from AI-metrics derived tables.
 * - Walks retained Parquet and report directories to build path-safe inventory rows.
 * @example
 * ```ts
 * import { AiMetricsRetentionSelector, listAiMetricsRetentionInventory } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const program = listAiMetricsRetentionInventory(
 *   AiMetricsRetentionSelector.make({
 *     beforeEpochMillis: 1_717_086_400_000,
 *     dataRoot: ".beep/ai-metrics"
 *   })
 * )
 * const selectedCount = Effect.map(program, (inventory) => inventory.selectedRawArchiveObjectCount)
 * console.log(selectedCount)
 * ```
 * @category services
 * @since 0.0.0
 */
export const listAiMetricsRetentionInventory = Effect.fn("AiMetrics.listAiMetricsRetentionInventory")(function* (
  input: AiMetricsRetentionSelector
) {
  const duckDbPath = aiMetricsDerivedDuckDbPath(input.dataRoot);
  const plan = yield* withAiMetricsDuckDb(readRetentionPlan(input), duckDbPath).pipe(
    Effect.mapError((cause) => retentionFailure("Failed to read AI metrics retention inventory.", cause))
  );
  return planToInventory(input, plan);
});

const deleteRowsForPlan = Effect.fn("AiMetrics.retention.deleteRowsForPlan")(function* (plan: RetentionPlan) {
  const duckdb = yield* DuckDb;
  if (
    A.isReadonlyArrayEmpty(plan.ingestRunIds) &&
    A.isReadonlyArrayEmpty(plan.rawArchiveItems) &&
    A.isReadonlyArrayEmpty(plan.labelIds) &&
    A.isReadonlyArrayEmpty(plan.benchmarkRunIds) &&
    A.isReadonlyArrayEmpty(plan.scorecardIds)
  ) {
    return;
  }

  const runIds = sqlStringList(plan.ingestRunIds);
  const archiveRunObjectIds = sqlStringList(A.map(plan.rawArchiveItems, (item) => item.archiveRunObjectId));
  const labelIds = sqlStringList(plan.labelIds);
  const benchmarkRunIds = sqlStringList(plan.benchmarkRunIds);
  const scorecardIds = sqlStringList(plan.scorecardIds);
  if (Str.isNonEmpty(labelIds)) {
    yield* duckdb.run(`DELETE
	                   FROM ai_metrics_outcome_labels
	                   WHERE label_id IN (${labelIds})`);
  }
  if (Str.isNonEmpty(benchmarkRunIds)) {
    yield* duckdb.run(`DELETE
	                   FROM ai_metrics_benchmark_runs
	                   WHERE benchmark_run_id IN (${benchmarkRunIds})`);
  }
  if (Str.isNonEmpty(scorecardIds)) {
    yield* duckdb.run(`DELETE
	                   FROM ai_metrics_scorecards
	                   WHERE scorecard_id IN (${scorecardIds})`);
  }
  if (Str.isNonEmpty(runIds)) {
    yield* duckdb.run(`DELETE
	                   FROM ai_metrics_turns
	                   WHERE ingest_run_id IN (${runIds})`);
    yield* duckdb.run(`DELETE
	                   FROM ai_metrics_source_files
	                   WHERE ingest_run_id IN (${runIds})`);
    yield* duckdb.run(`DELETE
	                   FROM ai_metrics_model_calls
	                   WHERE ingest_run_id IN (${runIds})`);
    yield* duckdb.run(`DELETE
	                   FROM ai_metrics_tool_invocations
	                   WHERE ingest_run_id IN (${runIds})`);
    yield* duckdb.run(`DELETE
	                   FROM ai_metrics_ingest_runs
	                   WHERE ingest_run_id IN (${runIds})`);
    // Sessions are pruned last, and keyed on neither the prune set nor the run column.
    // A session row is content-addressed and upserted OR REPLACE, so its `ingest_run_id`
    // names the run that LAST saw the transcript, not the one that created it -- pruning by
    // that column would delete a row whose turns from other runs survive, and the exporter
    // joins sessions INNER, so those turns would leave every future export silently.
    //
    // Scoping it to the prune set instead leaks the mirror image: a row kept because it
    // still had turns is tagged with an already-pruned run, so when the last of its turns
    // goes in a later prune, no predicate matches it again and the empty row lives forever
    // -- pinning its agent task alive through the GC below. Running after the ingest-run
    // delete lets this ask the only two questions that matter: are there turns left, and
    // does the run this row points at still exist. That also sweeps up rows already leaked
    // by an earlier prune.
    yield* duckdb.run(`DELETE
	                   FROM ai_metrics_sessions
	                   WHERE NOT EXISTS (
	                       SELECT 1
	                       FROM ai_metrics_turns
	                       WHERE ai_metrics_turns.agent_session_id = ai_metrics_sessions.agent_session_id
	                     )
	                     AND NOT EXISTS (
	                       SELECT 1
	                       FROM ai_metrics_ingest_runs
	                       WHERE ai_metrics_ingest_runs.ingest_run_id = ai_metrics_sessions.ingest_run_id
	                     )`);
  }
  if (Str.isNonEmpty(runIds) || Str.isNonEmpty(labelIds)) {
    yield* duckdb.run(`DELETE
	                   FROM ai_metrics_agent_tasks AS task
	                   WHERE NOT EXISTS (SELECT 1
	                                     FROM ai_metrics_sessions AS session
		                   WHERE session.agent_task_id = task.agent_task_id)
		                 AND NOT EXISTS (SELECT 1
		                                 FROM ai_metrics_outcome_labels AS label
		                                 WHERE label.agent_task_id = task.agent_task_id)`);
  }
  if (Str.isNonEmpty(archiveRunObjectIds)) {
    yield* duckdb.run(`DELETE
	                   FROM ai_metrics_raw_archive_objects
	                   WHERE archive_run_object_id IN (${archiveRunObjectIds})`);
  }
});

const removePlanPaths = Effect.fn("AiMetrics.retention.removePlanPaths")(function* (
  items: ReadonlyArray<PathPlanItem>
) {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.forEach(
    items,
    (item) =>
      fs
        .remove(item.absolutePath, {
          force: true,
          recursive: true,
        })
        .pipe(Effect.mapError((cause) => retentionFailure("Failed to remove an AI metrics retained file.", cause))),
    { discard: true }
  );
});

const byModifiedDescending: Order.Order<PathPlanItem> = Order.mapInput(
  Order.Number,
  (item) => -item.modifiedAtEpochMillis
);

const listForwarderSnapshotExportDirs = Effect.fn("AiMetrics.retention.listForwarderSnapshotExportDirs")(function* (
  dataRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const derivedRoot = path.join(dataRoot, "derived/parquet");
  const derivedRootExists = yield* fs
    .exists(derivedRoot)
    .pipe(
      Effect.mapError((cause) => retentionFailure("Failed to inspect AI metrics Parquet export directory.", cause))
    );
  if (!derivedRootExists) {
    return A.empty<PathPlanItem>();
  }

  const entries = yield* fs
    .readDirectory(derivedRoot)
    .pipe(Effect.mapError((cause) => retentionFailure("Failed to read AI metrics Parquet export directory.", cause)));
  const items = yield* Effect.forEach(
    entries,
    Effect.fnUntraced(function* (entry) {
      if (!Str.startsWith("forwarder-")(entry)) {
        return O.none<PathPlanItem>();
      }

      const absolutePath = path.join(derivedRoot, entry);
      const stat = yield* fs
        .stat(absolutePath)
        .pipe(Effect.mapError((cause) => retentionFailure("Failed to inspect AI metrics Parquet export.", cause)));
      if (stat.type !== "Directory") {
        return O.none<PathPlanItem>();
      }

      return O.some({
        absolutePath,
        modifiedAtEpochMillis: optionalModifiedAtMillis(stat),
        relativePath: relativeToDataRoot(dataRoot, absolutePath),
      });
    }),
    { concurrency: 8 }
  );

  return A.getSomes(items);
});

/**
 * Enforce local AI metrics retention for old per-run Parquet snapshots.
 *
 * @effects
 * - Reads the derived Parquet snapshot directory and file metadata.
 * - Removes old snapshot directories only when `dryRun` is `false`.
 * @example
 * ```ts
 * import { AiMetricsRetentionEnforcementPolicy, enforceAiMetricsRetentionPolicy } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const program = enforceAiMetricsRetentionPolicy(
 *   AiMetricsRetentionEnforcementPolicy.make({
 *     dataRoot: ".beep/ai-metrics",
 *     dryRun: true,
 *     maxSnapshotExports: 2
 *   })
 * )
 * const deletedCount = Effect.map(program, (result) => result.deletedDerivedExportCount)
 * console.log(deletedCount)
 * ```
 * @category services
 * @since 0.0.0
 */
export const enforceAiMetricsRetentionPolicy = Effect.fn("AiMetrics.enforceAiMetricsRetentionPolicy")(function* (
  policy: AiMetricsRetentionEnforcementPolicy
) {
  const snapshotItems = yield* listForwarderSnapshotExportDirs(policy.dataRoot);
  const sortedSnapshots = A.sort(snapshotItems, byModifiedDescending);
  const keepCount = policy.maxSnapshotExports < 0 ? 0 : policy.maxSnapshotExports;
  const keptItems = A.take(sortedSnapshots, keepCount);
  const deletedItems = A.drop(sortedSnapshots, keepCount);

  if (!policy.dryRun) {
    yield* removePlanPaths(deletedItems);
  }

  return AiMetricsRetentionEnforcementResult.make({
    dataRoot: policy.dataRoot,
    deletedDerivedExportCount: deletedItems.length,
    dryRun: policy.dryRun,
    keptDerivedExportCount: keptItems.length,
    maxSnapshotExports: keepCount,
    schemaVersion: retentionEnforcementSchemaVersion,
  });
});

const removeRawArchivePaths = Effect.fn("AiMetrics.retention.removeRawArchivePaths")(function* (
  dataRoot: string,
  items: ReadonlyArray<RawArchivePlanItem>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* Effect.forEach(
    items,
    Effect.fnUntraced(function* (item) {
      const selectedArchivePath = yield* validateRawArchivePath(path, dataRoot, item);
      yield* fs
        .remove(selectedArchivePath, { force: true })
        .pipe(
          Effect.mapError((cause) => retentionFailure("Failed to remove an AI metrics raw archive object.", cause))
        );
    }),
    { discard: true }
  );
});

const runRetentionMutation = Effect.fn("AiMetrics.retention.runMutation")(function* ({
  dryRun,
  input,
  mode,
}: {
  readonly dryRun: boolean;
  readonly input: AiMetricsRetentionSelector;
  readonly mode: "compact" | "delete";
}) {
  const duckDbPath = aiMetricsDerivedDuckDbPath(input.dataRoot);
  const plan = yield* withAiMetricsDuckDb(readRetentionPlan(input), duckDbPath).pipe(
    Effect.mapError((cause) => retentionFailure("Failed to read AI metrics retention mutation plan.", cause))
  );

  if (!dryRun && !hasBoundedMutationWindow(input)) {
    return yield* retentionFailure(
      "AI metrics retention mutations require --before or a bounded --since/--until window.",
      input
    );
  }

  if (!dryRun && !hasOrderedMutationWindow(input)) {
    return yield* retentionFailure(
      "AI metrics retention mutation window lower bound must be before its upper bound.",
      input
    );
  }

  if (!dryRun) {
    yield* removePlanPaths(plan.derivedExportItems);
    yield* removePlanPaths(plan.reportItems);
    if (mode === "delete") {
      yield* removeRawArchivePaths(input.dataRoot, plan.rawArchiveItems);
      yield* withAiMetricsDuckDb(deleteRowsForPlan(plan), duckDbPath).pipe(
        Effect.mapError((cause) => retentionFailure("Failed to delete selected AI metrics derived rows.", cause))
      );
    }
  }

  return AiMetricsRetentionMutationResult.make({
    deletedDerivedExportCount: plan.derivedExportItems.length,
    deletedRawArchiveObjectCount: mode === "delete" ? plan.rawArchiveItems.length : 0,
    deletedReportCount: plan.reportItems.length,
    dryRun,
    explicitWindow: hasExplicitWindow(input),
    mode,
    schemaVersion: retentionMutationSchemaVersion,
  });
});

/**
 * Delete selected AI metrics raw, derived, and report data.
 *
 * @effects
 * - Reads the selected retention plan from derived DuckDB storage.
 * - Deletes selected raw archive files and derived/report outputs only when `dryRun` is `false`.
 * - Deletes selected derived rows from DuckDB only when `dryRun` is `false`.
 * @example
 * ```ts
 * import { AiMetricsRetentionSelector, runAiMetricsRetentionDelete } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const program = runAiMetricsRetentionDelete(
 *   AiMetricsRetentionSelector.make({
 *     beforeEpochMillis: 1_717_086_400_000,
 *     dataRoot: ".beep/ai-metrics"
 *   }),
 *   true
 * )
 * const plannedRawDeletes = Effect.map(program, (result) => result.deletedRawArchiveObjectCount)
 * console.log(plannedRawDeletes)
 * ```
 * @category services
 * @since 0.0.0
 */
export const runAiMetricsRetentionDelete: {
  (
    input: AiMetricsRetentionSelector,
    dryRun: boolean
  ): Effect.Effect<AiMetricsRetentionMutationResult, AiMetricsRetentionError, FileSystem.FileSystem | Path.Path>;
  (
    dryRun: boolean
  ): (
    input: AiMetricsRetentionSelector
  ) => Effect.Effect<AiMetricsRetentionMutationResult, AiMetricsRetentionError, FileSystem.FileSystem | Path.Path>;
} = dual(2, (input: AiMetricsRetentionSelector, dryRun: boolean) =>
  runRetentionMutation({
    dryRun,
    input,
    mode: "delete",
  })
);

/**
 * Compact selected AI metrics derived Parquet and report outputs.
 *
 * @effects
 * - Reads the selected retention plan from derived DuckDB storage.
 * - Removes selected derived/report output files only when `dryRun` is `false`.
 * @example
 * ```ts
 * import { AiMetricsRetentionSelector, runAiMetricsRetentionCompact } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const program = runAiMetricsRetentionCompact(
 *   AiMetricsRetentionSelector.make({
 *     beforeEpochMillis: 1_717_086_400_000,
 *     dataRoot: ".beep/ai-metrics"
 *   }),
 *   true
 * )
 * const plannedFileDeletes = Effect.map(program, (result) => result.deletedDerivedExportCount)
 * console.log(plannedFileDeletes)
 * ```
 * @category services
 * @since 0.0.0
 */
export const runAiMetricsRetentionCompact: {
  (
    input: AiMetricsRetentionSelector,
    dryRun: boolean
  ): Effect.Effect<AiMetricsRetentionMutationResult, AiMetricsRetentionError, FileSystem.FileSystem | Path.Path>;
  (
    dryRun: boolean
  ): (
    input: AiMetricsRetentionSelector
  ) => Effect.Effect<AiMetricsRetentionMutationResult, AiMetricsRetentionError, FileSystem.FileSystem | Path.Path>;
} = dual(2, (input: AiMetricsRetentionSelector, dryRun: boolean) =>
  runRetentionMutation({
    dryRun,
    input,
    mode: "compact",
  })
);

/**
 * Restore selected encrypted raw archive objects into disposable derived storage.
 *
 * @effects
 * - Reads source retention rows from derived DuckDB storage.
 * - Reads and decrypts selected raw archive envelopes using `globalThis.crypto`.
 * - Creates restore directories, writes a disposable raw archive copy, and writes restored derived DuckDB storage.
 * - Hashes restored plaintext to prove retained archive integrity before replay.
 * @example
 * ```ts
 * import {
 *   AiMetricsRetentionRestoreDrillInput,
 *   AiMetricsRetentionSelector,
 *   runAiMetricsRetentionRestoreDrill
 * } from "@beep/repo-ai-metrics"
 * import { Effect, Redacted } from "effect"
 * const program = runAiMetricsRetentionRestoreDrill(
 *   AiMetricsRetentionRestoreDrillInput.make({
 *     maxObjects: 1,
 *     rawArchiveKey: Redacted.make("base64-32-byte-key"),
 *     restoreRoot: "/tmp/ai-metrics-restore",
 *     selector: AiMetricsRetentionSelector.make({ dataRoot: ".beep/ai-metrics" })
 *   })
 * )
 * const replayedCount = Effect.map(program, (result) => result.replayedObjectCount)
 * console.log(replayedCount)
 * ```
 * @category services
 * @since 0.0.0
 */
export const runAiMetricsRetentionRestoreDrill = Effect.fn("AiMetrics.runAiMetricsRetentionRestoreDrill")(function* (
  input: AiMetricsRetentionRestoreDrillInput
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceDuckDbPath = aiMetricsDerivedDuckDbPath(input.selector.dataRoot);
  const plan = yield* withAiMetricsDuckDb(readRetentionPlan(input.selector), sourceDuckDbPath).pipe(
    Effect.mapError((cause) => retentionFailure("Failed to select archive objects for restore drill.", cause))
  );
  const selected = pipe(plan.rawArchiveItems, A.take(input.maxObjects));
  if (A.isReadonlyArrayEmpty(selected)) {
    return yield* retentionFailure(
      "No AI metrics raw archive objects matched the restore drill selector.",
      input.selector
    );
  }

  yield* fs
    .makeDirectory(input.restoreRoot, { recursive: true })
    .pipe(Effect.mapError((cause) => retentionFailure("Failed to create AI metrics restore drill root.", cause)));
  const spec = yield* makeAiMetricsInstallSpec(
    AiMetricsInstallInput.make({
      dataRoot: input.restoreRoot,
      target: AiMetricsDeployTarget.Enum.local,
    })
  ).pipe(Effect.mapError((cause) => retentionFailure("Failed to build restore drill storage layout.", cause)));
  const configSnapshot = ConfigSnapshot.make({
    changedPaths: [],
    configHash: "restore-drill",
    includedPaths: [],
    label: "P7 restore drill",
    snapshotId: "restore-drill",
  });
  const repoRootHash = yield* hashPrivateIdentifier(input.restoreRoot, input.hashSalt).pipe(
    Effect.mapError((cause) => retentionFailure("Failed to hash restore drill root.", cause))
  );
  let records: ReadonlyArray<AiMetricsDerivedTranscriptRecord> = A.empty();
  const startedAtEpochMillis = yield* Clock.currentTimeMillis;

  for (const item of selected) {
    const selectedArchivePath = yield* validateRawArchivePath(path, input.selector.dataRoot, item);
    const envelope = yield* readEncryptedRawArchiveEnvelope(selectedArchivePath).pipe(
      Effect.mapError((cause) =>
        retentionFailure("Failed to read retained archive object during restore drill.", cause)
      )
    );
    const plaintext = yield* decryptEncryptedRawArchiveEnvelope({
      envelope,
      rawArchiveKey: input.rawArchiveKey,
    }).pipe(
      Effect.mapError((cause) =>
        retentionFailure("Failed to decrypt retained archive object during restore drill.", cause)
      )
    );
    const contentHash = yield* hashPrivateIdentifier(plaintext, input.hashSalt).pipe(
      Effect.mapError((cause) => retentionFailure("Failed to hash restored archive plaintext identity.", cause))
    );
    const legacyPublicContentHash = yield* hashPublicTextSha256(plaintext).pipe(
      Effect.mapError((cause) => retentionFailure("Failed to hash restored archive plaintext legacy identity.", cause))
    );
    if (contentHash !== item.plaintextContentHash && legacyPublicContentHash !== item.plaintextContentHash) {
      return yield* retentionFailure("Restored AI metrics archive object failed plaintext hash verification.", {
        archiveObjectId: item.archiveObjectId,
        expectedPlaintextContentHash: item.plaintextContentHash,
        legacyRestoredPlaintextContentHash: legacyPublicContentHash,
        restoredPlaintextContentHash: contentHash,
      });
    }
    const restoreSourcePath = path.join(input.restoreRoot, "restore-source", `${item.archiveObjectId}.jsonl`);
    const summary = yield* summarizeTranscriptText({
      content: plaintext,
      ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(input.hashSalt) }),
      sourceKind: item.sourceKind,
      sourcePath: restoreSourcePath,
    }).pipe(Effect.mapError((cause) => retentionFailure("Failed to summarize restored archive plaintext.", cause)));
    const privacy = yield* makeAiMetricsPrivacyCheckResult({
      content: plaintext,
      ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(input.hashSalt) }),
      sourcePath: restoreSourcePath,
      summary,
    }).pipe(Effect.mapError((cause) => retentionFailure("Failed to sanitize restored archive plaintext.", cause)));
    const archiveObject = yield* writeEncryptedRawArchiveObject({
      content: plaintext,
      ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(input.hashSalt) }),
      rawArchiveDir: spec.storage.rawArchiveDir,
      rawArchiveKey: input.rawArchiveKey,
      sourceKind: item.sourceKind,
      sourcePath: restoreSourcePath,
    }).pipe(Effect.mapError((cause) => retentionFailure("Failed to write restore drill archive object.", cause)));
    records = A.append(
      records,
      AiMetricsDerivedTranscriptRecord.make({
        archiveObject,
        privacy,
      })
    );
  }

  yield* withAiMetricsDuckDb(
    writeAiMetricsDerivedStorage(
      AiMetricsDerivedStorageWriteInput.make({
        configSnapshot,
        ingestRunId: `restore-drill-${startedAtEpochMillis}`,
        records,
        repoRootHash,
        startedAtEpochMillis,
        storage: spec.storage,
        target: AiMetricsDeployTarget.Enum.local,
      })
    ),
    spec.storage.duckDbPath
  ).pipe(Effect.mapError((cause) => retentionFailure("Failed to write restore drill derived storage.", cause)));

  return AiMetricsRetentionRestoreDrillResult.make({
    derivedDuckDbPath: spec.storage.duckDbPath,
    hashMatches: true,
    replayedObjectCount: records.length,
    restoreRoot: input.restoreRoot,
    schemaVersion: restoreDrillSchemaVersion,
    transcriptTextPrinted: false,
  });
});

const encodeInventoryJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsRetentionInventory));
const encodeEnforcementJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsRetentionEnforcementResult));
const encodeMutationJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsRetentionMutationResult));
const encodeRestoreDrillJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsRetentionRestoreDrillResult));

/**
 * Render a retention inventory as JSON.
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsRetentionError` if inventory cannot be encoded.
 * @example
 * ```ts
 * import { AiMetricsRetentionInventory, aiMetricsRetentionInventoryToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const inventory = AiMetricsRetentionInventory.make({
 *   derivedExports: [],
 *   explicitWindow: true,
 *   rawArchiveObjects: [],
 *   reports: [],
 *   schemaVersion: "beep.ai_metrics.retention_inventory.v1",
 *   selectedDerivedExportCount: 0,
 *   selectedRawArchiveObjectCount: 0,
 *   selectedReportCount: 0
 * })
 * const json = Effect.runPromise(aiMetricsRetentionInventoryToJson(inventory))
 * console.log(json)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsRetentionInventoryToJson: (
  result: AiMetricsRetentionInventory
) => Effect.Effect<string, AiMetricsRetentionError> = Effect.fn("AiMetrics.aiMetricsRetentionInventoryToJson")(
  (result) =>
    encodeInventoryJson(result).pipe(
      Effect.mapError((cause) => retentionFailure("Failed to encode AI metrics retention inventory JSON.", cause))
    )
);

/**
 * Render a retention enforcement result as JSON.
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsRetentionError` if enforcement result cannot be encoded.
 * @example
 * ```ts
 * import { AiMetricsRetentionEnforcementResult, aiMetricsRetentionEnforcementToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const result = AiMetricsRetentionEnforcementResult.make({
 *   dataRoot: ".beep/ai-metrics",
 *   deletedDerivedExportCount: 1,
 *   dryRun: true,
 *   keptDerivedExportCount: 2,
 *   maxSnapshotExports: 2,
 *   schemaVersion: "beep.ai_metrics.retention_enforcement.v1"
 * })
 * const json = Effect.runPromise(aiMetricsRetentionEnforcementToJson(result))
 * console.log(json)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsRetentionEnforcementToJson: (
  result: AiMetricsRetentionEnforcementResult
) => Effect.Effect<string, AiMetricsRetentionError> = Effect.fn("AiMetrics.aiMetricsRetentionEnforcementToJson")(
  (result) =>
    encodeEnforcementJson(result).pipe(
      Effect.mapError((cause) => retentionFailure("Failed to encode AI metrics retention enforcement JSON.", cause))
    )
);

/**
 * Render a retention mutation result as JSON.
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsRetentionError` if mutation result cannot be encoded.
 * @example
 * ```ts
 * import { AiMetricsRetentionMutationResult, aiMetricsRetentionMutationToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const result = AiMetricsRetentionMutationResult.make({
 *   deletedDerivedExportCount: 2,
 *   deletedRawArchiveObjectCount: 0,
 *   deletedReportCount: 1,
 *   dryRun: true,
 *   explicitWindow: true,
 *   mode: "compact",
 *   schemaVersion: "beep.ai_metrics.retention_mutation.v1"
 * })
 * const json = Effect.runPromise(aiMetricsRetentionMutationToJson(result))
 * console.log(json)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsRetentionMutationToJson: (
  result: AiMetricsRetentionMutationResult
) => Effect.Effect<string, AiMetricsRetentionError> = Effect.fn("AiMetrics.aiMetricsRetentionMutationToJson")(
  (result) =>
    encodeMutationJson(result).pipe(
      Effect.mapError((cause) => retentionFailure("Failed to encode AI metrics retention mutation JSON.", cause))
    )
);

/**
 * Render a restore drill result as JSON.
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsRetentionError` if restore-drill result cannot be encoded.
 * @example
 * ```ts
 * import { AiMetricsRetentionRestoreDrillResult, aiMetricsRetentionRestoreDrillToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const result = AiMetricsRetentionRestoreDrillResult.make({
 *   derivedDuckDbPath: "/tmp/ai-metrics-restore/derived/ai-metrics.duckdb",
 *   hashMatches: true,
 *   replayedObjectCount: 1,
 *   restoreRoot: "/tmp/ai-metrics-restore",
 *   schemaVersion: "beep.ai_metrics.retention_restore_drill.v1",
 *   transcriptTextPrinted: false
 * })
 * const json = Effect.runPromise(aiMetricsRetentionRestoreDrillToJson(result))
 * console.log(json)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsRetentionRestoreDrillToJson: (
  result: AiMetricsRetentionRestoreDrillResult
) => Effect.Effect<string, AiMetricsRetentionError> = Effect.fn("AiMetrics.aiMetricsRetentionRestoreDrillToJson")(
  (result) =>
    encodeRestoreDrillJson(result).pipe(
      Effect.mapError((cause) => retentionFailure("Failed to encode AI metrics restore drill JSON.", cause))
    )
);
