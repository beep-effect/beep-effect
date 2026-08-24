/**
 * P7 retention, restore, delete, and compaction workflows for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Clock, Effect, FileSystem, flow, Match, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
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
import { aiMetricsDerivedDuckDbPath, withAiMetricsDuckDb } from "./duckdb.ts";
import { listAiMetricsDirectoryFileInfo } from "./file-inventory.ts";
import { summarizeTranscriptText } from "./ingest.ts";
import { AiMetricsInstallInput, makeAiMetricsInstallSpec } from "./install.ts";
import { AiMetricsDeployTarget, AiMetricsTranscriptSource, ConfigSnapshot } from "./models.ts";
import { hashPrivateIdentifier, hashPublicTextSha256, makeAiMetricsPrivacyCheckResult } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("retention");

const AiMetricsRetentionMutationMode = LiteralKit(["delete", "compact"]).pipe(
  $I.annoteSchema("AiMetricsRetentionMutationMode", {
    description: "Mutation operation recorded by AI metrics retention delete and compact workflows.",
  })
);
const RawArchiveObjectIdPattern = /^raw-[a-f0-9]{64}$/u;
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

class RawArchiveObjectRow extends S.Class<RawArchiveObjectRow>($I`RawArchiveObjectRow`)(
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
  $I.annote("RawArchiveObjectRow", {
    description: "Decoded DuckDB row for one retained raw archive object.",
  })
) {
  static readonly decodeUnknownArrayEffect = S.decodeUnknownEffect(S.Array(RawArchiveObjectRow));
}

class IngestRunRow extends S.Class<IngestRunRow>($I`IngestRunRow`)(
  {
    completedAtEpochMillis: S.Finite,
    ingestRunId: S.String,
  },
  $I.annote("IngestRunRow", {
    description: "Decoded DuckDB row for one retained ingest run.",
  })
) {
  static readonly decodeUnknownArrayEffect = S.decodeUnknownEffect(S.Array(IngestRunRow));
}

class OutcomeLabelRow extends S.Class<OutcomeLabelRow>($I`OutcomeLabelRow`)(
  {
    labelId: S.String,
    labeledAtEpochMillis: S.OptionFromNullOr(S.Finite),
  },
  $I.annote("OutcomeLabelRow", {
    description: "Decoded DuckDB row for one outcome label with a nullable legacy timestamp.",
  })
) {
  static readonly decodeUnknownArrayEffect = S.decodeUnknownEffect(S.Array(OutcomeLabelRow));
}

class BenchmarkRunRow extends S.Class<BenchmarkRunRow>($I`BenchmarkRunRow`)(
  {
    benchmarkRunId: S.String,
    recordedAtEpochMillis: S.OptionFromNullOr(S.Finite),
  },
  $I.annote("BenchmarkRunRow", {
    description: "Decoded DuckDB row for one benchmark run with a nullable legacy timestamp.",
  })
) {
  static readonly decodeUnknownArrayEffect = S.decodeUnknownEffect(S.Array(BenchmarkRunRow));
}

class ScorecardRow extends S.Class<ScorecardRow>($I`ScorecardRow`)(
  {
    scorecardId: S.String,
    windowEndEpochMillis: S.OptionFromNullOr(S.Finite),
  },
  $I.annote("ScorecardRow", {
    description: "Decoded DuckDB row for one scorecard with a nullable legacy window end.",
  })
) {
  static readonly decodeUnknownArrayEffect = S.decodeUnknownEffect(S.Array(ScorecardRow));
}

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
    const upper = O.orElse(input.beforeEpochMillis, () => input.untilEpochMillis);
    return (
      O.getOrElse(
        O.map(lower, (value) => epochMillis >= value),
        () => true
      ) &&
      O.getOrElse(
        O.map(upper, (value) => epochMillis < value),
        () => true
      )
    );
  };

const hasExplicitWindow = (input: AiMetricsRetentionSelector): boolean =>
  O.isSome(input.beforeEpochMillis) || O.isSome(input.sinceEpochMillis) || O.isSome(input.untilEpochMillis);

const hasBoundedMutationWindow = (input: AiMetricsRetentionSelector): boolean =>
  O.isSome(input.beforeEpochMillis) || (O.isSome(input.sinceEpochMillis) && O.isSome(input.untilEpochMillis));

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
 * Typed failure raised by retention inventory, delete, compaction, and restore-drill workflows.
 *
 * **Details**
 *
 * The retention surface deletes data, so it fails rather than degrades: a path
 * that escapes the expected storage layout, an archive id that does not match
 * the generated digest format, or an unreadable store all produce this error
 * instead of a partial run.
 *
 * **Example** (Constructing the failure)
 *
 * ```ts
 * import { AiMetricsRetentionError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsRetentionError.make({
 *   cause: "duckdb unavailable",
 *   message: "Failed to read AI metrics retention inventory."
 * })
 *
 * console.log(error._tag) // "AiMetricsRetentionError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsRetentionError extends S.TaggedError<AiMetricsRetentionError>($I`AiMetricsRetentionError`)(
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
 * **Gotchas**
 *
 * `dataRoot` is required. A default here would let a destructive retention run
 * target a store the operator never named, which is the reverse of what a
 * delete-and-compact surface should do.
 *
 * **Example** (Selecting a window in a resolved store)
 *
 * ```ts
 * import { AiMetricsRetentionSelector } from "@beep/repo-ai-metrics"
 *
 * const selector = AiMetricsRetentionSelector.make({
 *   dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 * })
 *
 * console.log(selector.dataRoot) // /home/dev/.local/state/beep/ai-metrics
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionSelector extends S.Class<AiMetricsRetentionSelector>($I`AiMetricsRetentionSelector`)(
  S.Struct({
    beforeEpochMillis: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    dataRoot: S.String,
    sinceEpochMillis: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    untilEpochMillis: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
  }).check(
    S.makeFilter(
      (selector) => {
        const upper = O.orElse(selector.beforeEpochMillis, () => selector.untilEpochMillis);
        return O.getOrElse(
          O.zipWith(selector.sinceEpochMillis, upper, (lower, upperBound) => lower < upperBound),
          () => true
        );
      },
      {
        identifier: $I`OrderedRetentionWindowCheck`,
        title: "Ordered retention window",
        description: "Requires a retention window lower bound to precede its upper bound when both are present.",
        message: "Retention window lower bound must be before its upper bound",
      }
    )
  ),
  $I.annote("AiMetricsRetentionSelector", {
    description: "Local data root and optional explicit time window for AI metrics retention operations.",
  })
) {}

/**
 * One retained raw archive object, described without any filesystem path.
 *
 * **Details**
 *
 * The row carries `sourcePathHash` rather than a source path, so an inventory
 * can be printed, logged, or shipped off-machine without leaking where the
 * operator's transcripts live. The archive path is reconstructed from
 * `archiveObjectId` and `sourceKind` at delete time and re-validated against the
 * storage layout.
 *
 * **Example** (Reading an inventory row)
 *
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
 *
 * console.log(item.sourceKind) // "codex"
 * console.log(item.archiveObjectId) // "raw-0123456789abcdef"
 * ```
 *
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
 * One retained derived export or report, addressed relative to the data root.
 *
 * **Details**
 *
 * `relativePath` is deliberately relative: it keeps the absolute store location
 * out of printed inventories, and it is re-joined against the selector's
 * `dataRoot` and re-checked for containment before anything is deleted.
 *
 * **Example** (Reading a retained export row)
 *
 * ```ts
 * import { AiMetricsRetentionFileItem } from "@beep/repo-ai-metrics"
 *
 * const file = AiMetricsRetentionFileItem.make({
 *   modifiedAtEpochMillis: 1_717_000_000_000,
 *   relativePath: "derived/parquet/forwarder-1"
 * })
 *
 * console.log(file.relativePath) // "derived/parquet/forwarder-1"
 * ```
 *
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
 * Everything a selector matched across the raw, derived, and report trees.
 *
 * **Details**
 *
 * `explicitWindow` records whether the operator named a time window or fell
 * through to the default, which is what lets a reviewer tell "this selected
 * three objects" apart from "this selected the whole store". The `selected*`
 * counts describe the match; the arrays carry the rows themselves.
 *
 * **Example** (Reading one selector's matches)
 *
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
 *
 * console.log(inventory.selectedRawArchiveObjectCount) // 1
 * console.log(inventory.explicitWindow) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionInventory extends S.Class<AiMetricsRetentionInventory>($I`AiMetricsRetentionInventory`)(
  {
    derivedExports: S.Array(AiMetricsRetentionFileItem),
    explicitWindow: S.Boolean,
    rawArchiveObjects: S.Array(AiMetricsRetentionRawArchiveItem),
    reports: S.Array(AiMetricsRetentionFileItem),
    schemaVersion: S.Literal("beep.ai_metrics.retention_inventory.v1").pipe(
      SchemaUtils.withConstantDefault("beep.ai_metrics.retention_inventory.v1")
    ),
    selectedDerivedExportCount: S.Finite,
    selectedRawArchiveObjectCount: S.Finite,
    selectedReportCount: S.Finite,
  },
  $I.annote("AiMetricsRetentionInventory", {
    description: "Path-safe retained AI metrics raw, derived, and report inventory for one selector.",
  })
) {
  static readonly encodeUnknownEffectFromJsonString = S.encodeUnknownEffect(
    S.fromJsonString(AiMetricsRetentionInventory)
  );
}

/**
 * What a delete or compaction run removed, or would have removed.
 *
 * **Details**
 *
 * The counts mean the same thing under `dryRun: true` and `dryRun: false` — a
 * dry run reports exactly what the real run would delete — so a plan can be
 * reviewed and then executed without recounting. `explicitWindow` travels with
 * the result so a reviewer can see whether the operator bounded the run.
 *
 * **Example** (Reviewing a dry run before executing it)
 *
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
 *
 * console.log(result.dryRun) // true
 * console.log(result.deletedRawArchiveObjectCount) // 1
 * ```
 *
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
    schemaVersion: S.Literal("beep.ai_metrics.retention_mutation.v1").pipe(
      SchemaUtils.withConstantDefault("beep.ai_metrics.retention_mutation.v1")
    ),
  },
  $I.annote("AiMetricsRetentionMutationResult", {
    description: "Summary for an AI metrics retention delete or compaction run.",
  })
) {
  static readonly encodeUnknownEffectFromJsonString = S.encodeUnknownEffect(
    S.fromJsonString(AiMetricsRetentionMutationResult)
  );
}

/**
 * Policy for preventive local AI metrics retention enforcement.
 *
 * **Gotchas**
 *
 * `dataRoot` is required for the same reason it is on
 * {@link AiMetricsRetentionSelector}: enforcement deletes snapshot exports, and
 * a defaulted root would let it delete from a store the operator never named.
 *
 * **Example** (A dry-run policy against a resolved store)
 *
 * ```ts
 * import { AiMetricsRetentionEnforcementPolicy } from "@beep/repo-ai-metrics"
 *
 * const policy = AiMetricsRetentionEnforcementPolicy.make({
 *   dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 * })
 *
 * console.log(policy.maxSnapshotExports) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionEnforcementPolicy extends S.Class<AiMetricsRetentionEnforcementPolicy>(
  $I`AiMetricsRetentionEnforcementPolicy`
)(
  {
    dataRoot: S.String,
    dryRun: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
    maxSnapshotExports: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
  },
  $I.annote("AiMetricsRetentionEnforcementPolicy", {
    description: "Preventive policy for removing old per-run AI metrics Parquet snapshots.",
  })
) {}

/**
 * How many per-run Parquet snapshots an enforcement pass kept and removed.
 *
 * **Details**
 *
 * `keptDerivedExportCount` is the newest `maxSnapshotExports` exports;
 * everything older is counted in `deletedDerivedExportCount`. Reporting both
 * makes an over-aggressive policy obvious before it is run without `dryRun`.
 *
 * **Example** (Checking what a policy would prune)
 *
 * ```ts
 * import { AiMetricsRetentionEnforcementResult } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsRetentionEnforcementResult.make({
 *   dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *   deletedDerivedExportCount: 3,
 *   dryRun: true,
 *   keptDerivedExportCount: 2,
 *   maxSnapshotExports: 2,
 *   schemaVersion: "beep.ai_metrics.retention_enforcement.v1"
 * })
 *
 * console.log(result.deletedDerivedExportCount) // 3
 * console.log(result.keptDerivedExportCount === result.maxSnapshotExports) // true
 * ```
 *
 * @see {@link AiMetricsRetentionEnforcementPolicy} for the policy that produces this result.
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
    schemaVersion: S.Literal("beep.ai_metrics.retention_enforcement.v1").pipe(
      SchemaUtils.withConstantDefault("beep.ai_metrics.retention_enforcement.v1")
    ),
  },
  $I.annote("AiMetricsRetentionEnforcementResult", {
    description: "Summary for preventive AI metrics Parquet snapshot retention enforcement.",
  })
) {
  static readonly encodeUnknownEffectFromJsonString = S.encodeUnknownEffect(
    S.fromJsonString(AiMetricsRetentionEnforcementResult)
  );
}

/**
 * Request to replay selected archive objects into a disposable store and verify them.
 *
 * **Details**
 *
 * A restore drill proves the encrypted archive is still decryptable and still
 * hashes to the same content — the only way to learn that a backup is intact
 * before needing it. `restoreRoot` must be disposable: the drill writes a fresh
 * derived database there rather than touching the live store.
 *
 * **Gotchas**
 *
 * `hashSalt` must be the salt the objects were written with. A different salt
 * produces a drill that decrypts fine and reports a hash mismatch, which reads
 * like corruption.
 *
 * **Example** (Drilling one object into a scratch root)
 *
 * ```ts
 * import { AiMetricsRetentionRestoreDrillInput, AiMetricsRetentionSelector } from "@beep/repo-ai-metrics"
 * import { Redacted } from "effect"
 *
 * const input = AiMetricsRetentionRestoreDrillInput.make({
 *   rawArchiveKey: Redacted.make("base64-32-byte-key"),
 *   restoreRoot: "/tmp/ai-metrics-restore",
 *   selector: AiMetricsRetentionSelector.make({ dataRoot: "/home/dev/.local/state/beep/ai-metrics" })
 * })
 *
 * console.log(input.maxObjects) // 1
 * console.log(input.selector.dataRoot) // /home/dev/.local/state/beep/ai-metrics
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRetentionRestoreDrillInput extends S.Class<AiMetricsRetentionRestoreDrillInput>(
  $I`AiMetricsRetentionRestoreDrillInput`
)(
  {
    hashSalt: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    maxObjects: S.Int.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(1)),
      S.withDecodingDefaultKey(Effect.succeed(1))
    ),
    rawArchiveKey: AiMetricsRawArchiveKey,
    restoreRoot: S.String,
    selector: AiMetricsRetentionSelector,
  },
  $I.annote("AiMetricsRetentionRestoreDrillInput", {
    description: "Restore drill request that replays selected archive objects into disposable derived storage.",
  })
) {}

/**
 * Whether a restore drill replayed its objects and reproduced their content hashes.
 *
 * **Details**
 *
 * `hashMatches` is the drill's verdict: the replayed plaintext hashed to the
 * same value recorded when it was archived. `transcriptTextPrinted` stays
 * `false` on any normal run and exists so that a drill which did surface raw
 * transcript text is visible in the record rather than only in a terminal
 * scrollback.
 *
 * **Example** (Reading a successful drill)
 *
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
 *
 * console.log(result.hashMatches) // true
 * console.log(result.replayedObjectCount) // 1
 * ```
 *
 * @see {@link AiMetricsRetentionRestoreDrillInput} for the request that produces this result.
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
    schemaVersion: S.Literal("beep.ai_metrics.retention_restore_drill.v1").pipe(
      SchemaUtils.withConstantDefault("beep.ai_metrics.retention_restore_drill.v1")
    ),
    transcriptTextPrinted: S.Boolean,
  },
  $I.annote("AiMetricsRetentionRestoreDrillResult", {
    description:
      "Proof that retained encrypted archive objects can decrypt and replay into disposable derived storage.",
  })
) {
  static readonly encodeUnknownEffectFromJsonString = S.encodeUnknownEffect(
    S.fromJsonString(AiMetricsRetentionRestoreDrillResult)
  );
}

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

  const files = yield* listAiMetricsDirectoryFileInfo(root).pipe(
    Effect.mapError((error) =>
      retentionFailure(
        Match.value(error.operation).pipe(
          Match.when("inspect", () => "Failed to inspect an AI metrics retained file."),
          Match.when("read", () => "Failed to read AI metrics retained directory."),
          Match.exhaustive
        ),
        error.cause
      )
    )
  );
  return pipe(
    files,
    A.map(
      ([absolutePath, info]): PathPlanItem => ({
        absolutePath,
        modifiedAtEpochMillis: optionalModifiedAtMillis(info),
        relativePath: relativeToDataRoot(dataRoot, absolutePath),
      })
    ),
    A.sort(Order.mapInput(Order.String, (item: PathPlanItem) => item.relativePath))
  );
});

const listParquetExportDirs = Effect.fn("AiMetrics.retention.listParquetExportDirs")(function* (
  dataRoot: string,
  keep: (item: PathPlanItem, entry: string) => boolean
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

      const item = PathPlanItem.make({
        absolutePath,
        modifiedAtEpochMillis: optionalModifiedAtMillis(stat),
        relativePath: relativeToDataRoot(dataRoot, absolutePath),
      });
      return keep(item, entry) ? O.some(item) : O.none<PathPlanItem>();
    }),
    { concurrency: 8 }
  );

  return A.getSomes(items);
});

const readRetentionPlan = Effect.fn("AiMetrics.retention.readPlan")(function* (input: AiMetricsRetentionSelector) {
  const duckdb = yield* DuckDb;
  const withinWindow = inWindow(input);
  const rawRows = yield* duckdb
    .query(`SELECT archive_run_object_id  AS "archiveRunObjectId",
                                              archive_object_id      AS "archiveObjectId",
                                              ingest_run_id          AS "ingestRunId",
                                              source_kind            AS "sourceKind",
                                              source_path_hash       AS "sourcePathHash",
                                              plaintext_content_hash AS "plaintextContentHash",
                                              archive_path           AS "archivePath",
                                              encrypted_at_epoch_ms  AS "encryptedAtEpochMillis"
                                       FROM ai_metrics_raw_archive_objects
                                       ORDER BY encrypted_at_epoch_ms ASC`)
    .pipe(
      Effect.flatMap(RawArchiveObjectRow.decodeUnknownArrayEffect),
      Effect.mapError((cause) => retentionFailure("AI metrics raw archive retention rows failed schema decode.", cause))
    );
  const rawArchiveItems = pipe(
    rawRows,
    A.map((row) => RawArchivePlanItem.make(row)),
    A.filter((item) => withinWindow(item.encryptedAtEpochMillis))
  );
  const runRows = yield* duckdb
    .query(`SELECT ingest_run_id         AS "ingestRunId",
                                              completed_at_epoch_ms AS "completedAtEpochMillis"
                                       FROM ai_metrics_ingest_runs
                                       ORDER BY completed_at_epoch_ms ASC`)
    .pipe(
      Effect.flatMap(IngestRunRow.decodeUnknownArrayEffect),
      Effect.mapError((cause) => retentionFailure("AI metrics ingest-run retention rows failed schema decode.", cause))
    );
  const windowIngestRunIds = pipe(
    runRows,
    A.filter((row) => withinWindow(row.completedAtEpochMillis)),
    A.map((row) => row.ingestRunId)
  );
  const ingestRunIds = pipe(
    windowIngestRunIds,
    A.appendAll(A.map(rawArchiveItems, (item) => item.ingestRunId)),
    A.dedupe
  );
  const labelRows = yield* duckdb
    .query(`SELECT label_id            AS "labelId",
                                                labeled_at_epoch_ms AS "labeledAtEpochMillis"
                                         FROM ai_metrics_outcome_labels
                                         ORDER BY labeled_at_epoch_ms ASC`)
    .pipe(
      Effect.flatMap(OutcomeLabelRow.decodeUnknownArrayEffect),
      Effect.mapError((cause) =>
        retentionFailure("AI metrics outcome-label retention rows failed schema decode.", cause)
      )
    );
  const labelIds = pipe(
    labelRows,
    A.filter((row) => O.exists(row.labeledAtEpochMillis, withinWindow)),
    A.map((row) => row.labelId)
  );
  const benchmarkRunRows = yield* duckdb
    .query(`SELECT benchmark_run_id     AS "benchmarkRunId",
                                                       recorded_at_epoch_ms AS "recordedAtEpochMillis"
                                                FROM ai_metrics_benchmark_runs
                                                ORDER BY recorded_at_epoch_ms ASC`)
    .pipe(
      Effect.flatMap(BenchmarkRunRow.decodeUnknownArrayEffect),
      Effect.mapError((cause) =>
        retentionFailure("AI metrics benchmark-run retention rows failed schema decode.", cause)
      )
    );
  const benchmarkRunIds = pipe(
    benchmarkRunRows,
    A.filter((row) => O.exists(row.recordedAtEpochMillis, withinWindow)),
    A.map((row) => row.benchmarkRunId)
  );
  const scorecardRows = yield* duckdb
    .query(`SELECT scorecard_id        AS "scorecardId",
                                                    window_end_epoch_ms AS "windowEndEpochMillis"
                                             FROM ai_metrics_scorecards
                                             ORDER BY window_end_epoch_ms ASC`)
    .pipe(
      Effect.flatMap(ScorecardRow.decodeUnknownArrayEffect),
      Effect.mapError((cause) => retentionFailure("AI metrics scorecard retention rows failed schema decode.", cause))
    );
  const scorecardIds = pipe(
    scorecardRows,
    A.filter((row) => O.exists(row.windowEndEpochMillis, withinWindow)),
    A.map((row) => row.scorecardId)
  );
  const derivedExportItems = yield* listParquetExportDirs(
    input.dataRoot,
    (item, entry) => A.contains(ingestRunIds, entry) || withinWindow(item.modifiedAtEpochMillis)
  );
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
    selectedDerivedExportCount: plan.derivedExportItems.length,
    selectedRawArchiveObjectCount: plan.rawArchiveItems.length,
    selectedReportCount: plan.reportItems.length,
  });

/**
 * List everything a retention selector matches, without deleting anything.
 *
 * **When to use**
 *
 * Use when planning a delete or compaction run. The inventory is the review
 * artifact: it names exactly the objects the same selector would remove.
 *
 * **Details**
 *
 * The DuckDB connection is opened and closed around the read, so the listing
 * holds no lock afterwards. Rows come back path-free — hashes and data-root
 * relative paths — which is what makes an inventory safe to paste into a review.
 *
 * **Example** (Reviewing what a window selects)
 *
 * ```ts
 * import { AiMetricsRetentionSelector, listAiMetricsRetentionInventory } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = listAiMetricsRetentionInventory(
 *   AiMetricsRetentionSelector.make({
 *     beforeEpochMillis: O.some(1_717_086_400_000),
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 *   })
 * ).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((inventory) => console.log(inventory.selectedRawArchiveObjectCount))
 * ```
 *
 * @effects
 * - Opens the derived DuckDB database under the selected data root.
 * - Reads retention rows from AI-metrics derived tables.
 * - Walks retained Parquet and report directories to build path-safe inventory rows.
 * @see {@link AiMetricsRetentionInventory} for how to read the returned rows.
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
  return yield* listParquetExportDirs(dataRoot, (_item, entry) => Str.startsWith("forwarder-")(entry));
});

/**
 * Keep only the newest per-run Parquet snapshots and prune the rest.
 *
 * **Details**
 *
 * Snapshots are ordered newest first by modification time, the first
 * `maxSnapshotExports` are kept, and the remainder are removed. The policy
 * schema rejects negative and fractional limits before enforcement starts.
 *
 * **Gotchas**
 *
 * `dryRun` defaults to `true`. The default run reports what it would delete and
 * touches nothing; pass `dryRun: false` deliberately to make it destructive.
 *
 * **Example** (Previewing a two-snapshot policy)
 *
 * ```ts
 * import { AiMetricsRetentionEnforcementPolicy, enforceAiMetricsRetentionPolicy } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = enforceAiMetricsRetentionPolicy(
 *   AiMetricsRetentionEnforcementPolicy.make({
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *     maxSnapshotExports: 2
 *   })
 * ).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((result) => console.log(result.deletedDerivedExportCount))
 * ```
 *
 * @effects
 * - Reads the derived Parquet snapshot directory and file metadata.
 * - Removes old snapshot directories only when `dryRun` is `false`.
 * @category services
 * @since 0.0.0
 */
export const enforceAiMetricsRetentionPolicy = Effect.fn("AiMetrics.enforceAiMetricsRetentionPolicy")(function* (
  policy: AiMetricsRetentionEnforcementPolicy
) {
  const snapshotItems = yield* listForwarderSnapshotExportDirs(policy.dataRoot);
  const sortedSnapshots = A.sort(snapshotItems, byModifiedDescending);
  const keptItems = A.take(sortedSnapshots, policy.maxSnapshotExports);
  const deletedItems = A.drop(sortedSnapshots, policy.maxSnapshotExports);

  if (!policy.dryRun) {
    yield* removePlanPaths(deletedItems);
  }

  return AiMetricsRetentionEnforcementResult.make({
    dataRoot: policy.dataRoot,
    deletedDerivedExportCount: deletedItems.length,
    dryRun: policy.dryRun,
    keptDerivedExportCount: keptItems.length,
    maxSnapshotExports: policy.maxSnapshotExports,
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
  readonly mode: typeof AiMetricsRetentionMutationMode.Type;
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

  const deletesRawArchive = AiMetricsRetentionMutationMode.$match(mode, {
    compact: () => false,
    delete: () => true,
  });

  if (!dryRun) {
    yield* removePlanPaths(plan.derivedExportItems);
    yield* removePlanPaths(plan.reportItems);
    if (deletesRawArchive) {
      yield* removeRawArchivePaths(input.dataRoot, plan.rawArchiveItems);
      yield* withAiMetricsDuckDb(deleteRowsForPlan(plan), duckDbPath).pipe(
        Effect.mapError((cause) => retentionFailure("Failed to delete selected AI metrics derived rows.", cause))
      );
    }
  }

  return AiMetricsRetentionMutationResult.make({
    deletedDerivedExportCount: plan.derivedExportItems.length,
    deletedRawArchiveObjectCount: deletesRawArchive ? plan.rawArchiveItems.length : 0,
    deletedReportCount: plan.reportItems.length,
    dryRun,
    explicitWindow: hasExplicitWindow(input),
    mode,
  });
});

/**
 * Delete the raw archive objects, derived outputs, and reports a selector matches.
 *
 * **Details**
 *
 * Every archive path is rebuilt from its object id and re-checked for
 * containment inside the selector's data root before deletion, so a tampered or
 * stale inventory row cannot make the delete escape the store. Rows are removed
 * from DuckDB in the same run, keeping the database and the filesystem
 * consistent.
 *
 * **Gotchas**
 *
 * `dryRun` is a required positional argument, not a defaulted option. Pass
 * `true` to plan; the counts returned are identical to what `false` would
 * remove.
 *
 * **Example** (Planning a delete before running it)
 *
 * ```ts
 * import { AiMetricsRetentionSelector, runAiMetricsRetentionDelete } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = runAiMetricsRetentionDelete(
 *   AiMetricsRetentionSelector.make({
 *     beforeEpochMillis: O.some(1_717_086_400_000),
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 *   }),
 *   true
 * ).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((result) => console.log(result.deletedRawArchiveObjectCount))
 * ```
 *
 * @effects
 * - Reads the selected retention plan from derived DuckDB storage.
 * - Deletes selected raw archive files and derived/report outputs only when `dryRun` is `false`.
 * - Deletes selected derived rows from DuckDB only when `dryRun` is `false`.
 * @see {@link runAiMetricsRetentionCompact} when only derived outputs should go and the raw archive must stay.
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
    mode: AiMetricsRetentionMutationMode.Enum.delete,
  })
);

/**
 * Reclaim space by removing derived exports and reports while keeping the raw archive.
 *
 * **When to use**
 *
 * Use when the store is large but the evidence must stay recoverable. Derived
 * Parquet and reports are rebuildable from the encrypted raw archive; the
 * archive itself is not rebuildable from anything.
 *
 * **Details**
 *
 * Compaction reports `deletedRawArchiveObjectCount: 0` by construction — it is
 * the same mutation path as delete with the raw tree left untouched.
 *
 * **Example** (Planning a compaction)
 *
 * ```ts
 * import { AiMetricsRetentionSelector, runAiMetricsRetentionCompact } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = runAiMetricsRetentionCompact(
 *   AiMetricsRetentionSelector.make({
 *     beforeEpochMillis: O.some(1_717_086_400_000),
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 *   }),
 *   true
 * ).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((result) => console.log(result.deletedDerivedExportCount))
 * ```
 *
 * @effects
 * - Reads the selected retention plan from derived DuckDB storage.
 * - Removes selected derived/report output files only when `dryRun` is `false`.
 * @see {@link runAiMetricsRetentionDelete} when the raw archive objects must go too.
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
    mode: AiMetricsRetentionMutationMode.Enum.compact,
  })
);

/**
 * Prove the encrypted archive is still recoverable by replaying it into a scratch store.
 *
 * **When to use**
 *
 * Use when a retention delete is planned, and on a schedule between deletes. An
 * archive nobody has ever restored is an assumption, not a backup.
 *
 * **Details**
 *
 * Selected envelopes are decrypted, hashed, and compared against the content
 * hash recorded at archive time; the replay then writes a fresh derived DuckDB
 * database under `restoreRoot`. The live store is only read.
 *
 * **Gotchas**
 *
 * `restoreRoot` is written to and should be disposable. Pointing it at the live
 * data root would have the drill build a second derived database inside the
 * store it is supposed to be verifying.
 *
 * **Example** (Drilling one archived object)
 *
 * ```ts
 * import {
 *   AiMetricsRetentionRestoreDrillInput,
 *   AiMetricsRetentionSelector,
 *   runAiMetricsRetentionRestoreDrill
 * } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect, Redacted } from "effect"
 *
 * const program = runAiMetricsRetentionRestoreDrill(
 *   AiMetricsRetentionRestoreDrillInput.make({
 *     rawArchiveKey: Redacted.make("base64-32-byte-key"),
 *     restoreRoot: "/tmp/ai-metrics-restore",
 *     selector: AiMetricsRetentionSelector.make({ dataRoot: "/home/dev/.local/state/beep/ai-metrics" })
 *   })
 * ).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((result) => console.log(result.hashMatches))
 * ```
 *
 * @effects
 * - Reads source retention rows from derived DuckDB storage.
 * - Reads and decrypts selected raw archive envelopes using `globalThis.crypto`.
 * - Creates restore directories, writes a disposable raw archive copy, and writes restored derived DuckDB storage.
 * - Hashes restored plaintext to prove retained archive integrity before replay.
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
      dataRoot: O.some(input.restoreRoot),
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
  const repoRootHash = yield* hashPrivateIdentifier(input.restoreRoot, O.getOrUndefined(input.hashSalt)).pipe(
    Effect.mapError((cause) => retentionFailure("Failed to hash restore drill root.", cause))
  );
  const startedAtEpochMillis = yield* Clock.currentTimeMillis;
  const records = yield* Effect.forEach(
    selected,
    Effect.fnUntraced(function* (item) {
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
      const contentHash = yield* hashPrivateIdentifier(plaintext, O.getOrUndefined(input.hashSalt)).pipe(
        Effect.mapError((cause) => retentionFailure("Failed to hash restored archive plaintext identity.", cause))
      );
      const legacyPublicContentHash = yield* hashPublicTextSha256(plaintext).pipe(
        Effect.mapError((cause) =>
          retentionFailure("Failed to hash restored archive plaintext legacy identity.", cause)
        )
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
        ...O.getSomesStruct({ hashSalt: input.hashSalt }),
        sourceKind: item.sourceKind,
        sourcePath: restoreSourcePath,
      }).pipe(Effect.mapError((cause) => retentionFailure("Failed to summarize restored archive plaintext.", cause)));
      const privacy = yield* makeAiMetricsPrivacyCheckResult({
        content: plaintext,
        ...O.getSomesStruct({ hashSalt: input.hashSalt }),
        sourcePath: restoreSourcePath,
        summary,
      }).pipe(Effect.mapError((cause) => retentionFailure("Failed to sanitize restored archive plaintext.", cause)));
      const archiveObject = yield* writeEncryptedRawArchiveObject({
        content: plaintext,
        ...O.getSomesStruct({ hashSalt: input.hashSalt }),
        rawArchiveDir: spec.storage.rawArchiveDir,
        rawArchiveKey: input.rawArchiveKey,
        sourceKind: item.sourceKind,
        sourcePath: restoreSourcePath,
      }).pipe(Effect.mapError((cause) => retentionFailure("Failed to write restore drill archive object.", cause)));
      return AiMetricsDerivedTranscriptRecord.make({
        archiveObject,
        privacy,
      });
    })
  );

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
    transcriptTextPrinted: false,
  });
});

/**
 * Encode a retention inventory as the JSON the CLI emits under `--json`.
 *
 * **Details**
 *
 * Encoding goes through the schema, so the text round-trips back through
 * {@link AiMetricsRetentionInventory} and carries `schemaVersion` for a
 * downstream reader to gate on.
 *
 * **Example** (Encoding an empty inventory)
 *
 * ```ts
 * import { AiMetricsRetentionInventory, aiMetricsRetentionInventoryToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
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
 *
 * const json = Effect.runSync(aiMetricsRetentionInventoryToJson(inventory))
 *
 * console.log(json.includes("beep.ai_metrics.retention_inventory.v1")) // true
 * ```
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsRetentionError` if inventory cannot be encoded.
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsRetentionInventoryToJson: (
  result: AiMetricsRetentionInventory
) => Effect.Effect<string, AiMetricsRetentionError> = Effect.fn("AiMetrics.aiMetricsRetentionInventoryToJson")(
  (result) =>
    AiMetricsRetentionInventory.encodeUnknownEffectFromJsonString(result).pipe(
      Effect.mapError((cause) => retentionFailure("Failed to encode AI metrics retention inventory JSON.", cause))
    )
);

/**
 * Encode an enforcement result as the JSON the CLI emits under `--json`.
 *
 * **Details**
 *
 * The encoded text keeps `dataRoot`, so an automated pruning job's log records
 * which store it acted on rather than only how much it removed.
 *
 * **Example** (Encoding a dry-run enforcement result)
 *
 * ```ts
 * import { AiMetricsRetentionEnforcementResult, aiMetricsRetentionEnforcementToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const result = AiMetricsRetentionEnforcementResult.make({
 *   dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *   deletedDerivedExportCount: 1,
 *   dryRun: true,
 *   keptDerivedExportCount: 2,
 *   maxSnapshotExports: 2,
 *   schemaVersion: "beep.ai_metrics.retention_enforcement.v1"
 * })
 *
 * const json = Effect.runSync(aiMetricsRetentionEnforcementToJson(result))
 *
 * console.log(json.includes("\"dryRun\":true")) // true
 * ```
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsRetentionError` if enforcement result cannot be encoded.
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsRetentionEnforcementToJson: (
  result: AiMetricsRetentionEnforcementResult
) => Effect.Effect<string, AiMetricsRetentionError> = Effect.fn("AiMetrics.aiMetricsRetentionEnforcementToJson")(
  (result) =>
    AiMetricsRetentionEnforcementResult.encodeUnknownEffectFromJsonString(result).pipe(
      Effect.mapError((cause) => retentionFailure("Failed to encode AI metrics retention enforcement JSON.", cause))
    )
);

/**
 * Encode a delete or compaction result as the JSON the CLI emits under `--json`.
 *
 * **Details**
 *
 * `mode` and `dryRun` both survive encoding, which is what lets an audit trail
 * distinguish a reviewed plan from the destructive run that followed it.
 *
 * **Example** (Encoding a compaction plan)
 *
 * ```ts
 * import { AiMetricsRetentionMutationResult, aiMetricsRetentionMutationToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const result = AiMetricsRetentionMutationResult.make({
 *   deletedDerivedExportCount: 2,
 *   deletedRawArchiveObjectCount: 0,
 *   deletedReportCount: 1,
 *   dryRun: true,
 *   explicitWindow: true,
 *   mode: "compact",
 *   schemaVersion: "beep.ai_metrics.retention_mutation.v1"
 * })
 *
 * const json = Effect.runSync(aiMetricsRetentionMutationToJson(result))
 *
 * console.log(json.includes("\"mode\":\"compact\"")) // true
 * ```
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsRetentionError` if mutation result cannot be encoded.
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsRetentionMutationToJson: (
  result: AiMetricsRetentionMutationResult
) => Effect.Effect<string, AiMetricsRetentionError> = Effect.fn("AiMetrics.aiMetricsRetentionMutationToJson")(
  (result) =>
    AiMetricsRetentionMutationResult.encodeUnknownEffectFromJsonString(result).pipe(
      Effect.mapError((cause) => retentionFailure("Failed to encode AI metrics retention mutation JSON.", cause))
    )
);

/**
 * Encode a restore-drill result as the JSON that records the drill was run.
 *
 * **Details**
 *
 * This encoded record is the durable evidence that the archive was recoverable
 * on a given day. Keep it beside the store rather than only in a terminal, so a
 * later incident can point at when integrity was last proven.
 *
 * **Example** (Encoding a passing drill)
 *
 * ```ts
 * import { AiMetricsRetentionRestoreDrillResult, aiMetricsRetentionRestoreDrillToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const result = AiMetricsRetentionRestoreDrillResult.make({
 *   derivedDuckDbPath: "/tmp/ai-metrics-restore/derived/ai-metrics.duckdb",
 *   hashMatches: true,
 *   replayedObjectCount: 1,
 *   restoreRoot: "/tmp/ai-metrics-restore",
 *   schemaVersion: "beep.ai_metrics.retention_restore_drill.v1",
 *   transcriptTextPrinted: false
 * })
 *
 * const json = Effect.runSync(aiMetricsRetentionRestoreDrillToJson(result))
 *
 * console.log(json.includes("\"hashMatches\":true")) // true
 * ```
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsRetentionError` if restore-drill result cannot be encoded.
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsRetentionRestoreDrillToJson: (
  result: AiMetricsRetentionRestoreDrillResult
) => Effect.Effect<string, AiMetricsRetentionError> = Effect.fn("AiMetrics.aiMetricsRetentionRestoreDrillToJson")(
  (result) =>
    AiMetricsRetentionRestoreDrillResult.encodeUnknownEffectFromJsonString(result).pipe(
      Effect.mapError((cause) => retentionFailure("Failed to encode AI metrics restore drill JSON.", cause))
    )
);
