/**
 * Schema models for bounded corpus preservation and restoration runs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/Restoration.schemas");

const SchemaVersion = S.Literal("oppold-corpus-restoration/v1");
const RecordedAt = S.NonEmptyString;
const RunId = S.NonEmptyString;
const ObjectId = S.NonEmptyString;
const AttemptId = S.NonEmptyString;
const RelativePath = S.String;

/**
 * Filesystem object kinds accepted by the preservation runner.
 *
 * **Example** (Validate archive object kinds)
 *
 * ```ts
 * import { ArchiveObjectKind } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(ArchiveObjectKind.is.file("file")) // true
 * console.log(ArchiveObjectKind.is.rootArchive("root-archive")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArchiveObjectKind = LiteralKit(["directory", "file", "root-archive"]).pipe(
  $I.annoteSchema("ArchiveObjectKind", {
    description: "Filesystem object kind preserved by the bar-v2 archive runner.",
  })
);

/**
 * Decoded archive object kind.
 *
 * @see {@link ArchiveObjectKind} for the runtime schema and helper surface.
 * @category models
 * @since 0.0.0
 */
export type ArchiveObjectKind = typeof ArchiveObjectKind.Type;

const PreservationCrashPoint = LiteralKit(["none", "after-payload-sync", "after-rename", "before-pass"]).pipe(
  $I.annoteSchema("PreservationCrashPoint", {
    description: "Synthetic interruption point used to prove copy, verification, and PASS recovery ordering.",
  })
);

/**
 * Validated inputs for one preservation run.
 *
 * **Example** (Create preservation options)
 *
 * ```ts
 * import { RestorationPreserveOptions } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const options = RestorationPreserveOptions.make({
 *   absentRecycleTreePath: "/media/absent-recycle-tree",
 *   capacityCeilingBytes: NonNegativeInt.make(1024),
 *   corpusRoot: "/data/corpus",
 *   expectedCollectorRowCount: NonNegativeInt.make(28508),
 *   expectedMissingRecyclePayloadCount: NonNegativeInt.make(13),
 *   expectedMutatedDestinationCount: NonNegativeInt.make(1021),
 *   expectedRootArchiveBytes: NonNegativeInt.make(147731138560),
 *   expectedSourceDirectoryCount: NonNegativeInt.make(755),
 *   expectedSourceFileCount: NonNegativeInt.make(12156),
 *   expectedSourceTreeBytes: NonNegativeInt.make(207772579526),
 *   minimumFreeAfterBytes: NonNegativeInt.make(128),
 *   rootArchivePath: "/media/archive.zip",
 *   sourceManifestPath: "/media/salvage/_meta/manifest.jsonl",
 *   sourceRoot: "/media/salvage"
 * })
 * console.log(options.runLabel) // "t7-salvage-2026-08-10"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class RestorationPreserveOptions extends S.Class<RestorationPreserveOptions>($I`RestorationPreserveOptions`)(
  {
    absentRecycleTreePath: S.NonEmptyString,
    capacityCeilingBytes: NonNegativeInt,
    chunkSizeBytes: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(8 * 1024 * 1024))),
    corpusRoot: S.NonEmptyString,
    crashPoint: PreservationCrashPoint.pipe(SchemaUtils.withKeyDefaults("none")),
    expectedCollectorRowCount: NonNegativeInt,
    expectedMissingRecyclePayloadCount: NonNegativeInt,
    expectedMutatedDestinationCount: NonNegativeInt,
    expectedRootArchiveBytes: NonNegativeInt,
    expectedSourceDirectoryCount: NonNegativeInt,
    expectedSourceFileCount: NonNegativeInt,
    expectedSourceTreeBytes: NonNegativeInt,
    minimumFreeAfterBytes: NonNegativeInt,
    rootArchivePath: S.NonEmptyString,
    runLabel: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("t7-salvage-2026-08-10")),
    sourceManifestPath: S.NonEmptyString,
    sourceRoot: S.NonEmptyString,
  },
  $I.annote("RestorationPreserveOptions", {
    description:
      "Explicit capacity policy, source locations, archive destination label, and optional recovery-test controls for one preservation run.",
  })
) {}

/**
 * Inputs for a fresh-process archive verification pass.
 *
 * **Example** (Create verification options)
 *
 * ```ts
 * import { RestorationVerifyOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = RestorationVerifyOptions.make({ corpusRoot: "/data/corpus" })
 * console.log(options.runLabel) // "t7-salvage-2026-08-10"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class RestorationVerifyOptions extends S.Class<RestorationVerifyOptions>($I`RestorationVerifyOptions`)(
  {
    corpusRoot: S.NonEmptyString,
    runLabel: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("t7-salvage-2026-08-10")),
  },
  $I.annote("RestorationVerifyOptions", {
    description: "Corpus root and preservation run label independently reparsed and verified from a fresh process.",
  })
) {}

/**
 * Mail restoration run scope.
 *
 * **Example** (Select the vertical-slice scope)
 *
 * ```ts
 * import { MailRestorationScope } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(MailRestorationScope.is.slice("slice")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MailRestorationScope = LiteralKit(["slice", "full"]).pipe(
  $I.annoteSchema("MailRestorationScope", {
    description: "Whether mail restoration processes one metadata-selected store or the complete preserved estate.",
  })
);

/** Decoded mail restoration scope. @category models @since 0.0.0 */
export type MailRestorationScope = typeof MailRestorationScope.Type;

/**
 * Validated inputs for the mail slice or full estate run.
 *
 * **Example** (Create mail restoration options)
 *
 * ```ts
 * import { RestorationMailOptions } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const options = RestorationMailOptions.make({
 *   corpusRoot: "/data/corpus",
 *   expectedStoreCount: NonNegativeInt.make(1),
 *   maxAmplificationRatio: 4,
 *   maxElapsedMillis: NonNegativeInt.make(60000),
 *   maxTotalElapsedMillis: NonNegativeInt.make(60000),
 *   maxTotalOutputBytes: NonNegativeInt.make(1073741824),
 *   pffexportPath: "pffexport",
 *   scope: "slice",
 *   tikaJarPath: "/opt/tika/tika-app.jar"
 * })
 * console.log(options.scope) // "slice"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class RestorationMailOptions extends S.Class<RestorationMailOptions>($I`RestorationMailOptions`)(
  {
    corpusRoot: S.NonEmptyString,
    expectedStoreCount: NonNegativeInt,
    maxAmplificationRatio: S.Finite,
    maxElapsedMillis: NonNegativeInt,
    maxTotalElapsedMillis: NonNegativeInt,
    maxTotalOutputBytes: NonNegativeInt,
    pffexportPath: S.NonEmptyString,
    runLabel: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("t7-salvage-2026-08-10")),
    scope: MailRestorationScope,
    tikaJarPath: S.NonEmptyString,
    javaPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("java")),
  },
  $I.annote("RestorationMailOptions", {
    description:
      "Frozen engine locations, denominator, elapsed-time ceiling, and disk amplification ceiling for one mail restoration scope.",
  })
) {}

/**
 * Validated inputs for three-volume recycle reconciliation.
 *
 * **Example** (Create recycle reconciliation options)
 *
 * ```ts
 * import { RestorationRecycleOptions } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const options = RestorationRecycleOptions.make({
 *   corpusRoot: "/data/corpus",
 *   expectedMissingContentCount: NonNegativeInt.make(13),
 *   expectedSurfaceCount: NonNegativeInt.make(3),
 *   maxTotalElapsedMillis: NonNegativeInt.make(3600000),
 *   maxTotalOutputBytes: NonNegativeInt.make(1073741824)
 * })
 * console.log(options.expectedSurfaceCount) // 3
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class RestorationRecycleOptions extends S.Class<RestorationRecycleOptions>($I`RestorationRecycleOptions`)(
  {
    corpusRoot: S.NonEmptyString,
    expectedMissingContentCount: NonNegativeInt,
    expectedSurfaceCount: NonNegativeInt,
    maxTotalElapsedMillis: NonNegativeInt,
    maxTotalOutputBytes: NonNegativeInt,
    runLabel: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("t7-salvage-2026-08-10")),
  },
  $I.annote("RestorationRecycleOptions", {
    description: "Expected three-volume and inherited-missing-payload denominators for recycle reconciliation.",
  })
) {}

/**
 * Validated inputs for distinct-digest legacy-Word conversion.
 *
 * **Example** (Create legacy-Word conversion options)
 *
 * ```ts
 * import { RestorationLegacyWordOptions } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const options = RestorationLegacyWordOptions.make({
 *   converterPath: "soffice",
 *   corpusRoot: "/data/corpus",
 *   expectedConverterVersion: "LibreOffice 26.2.0.0",
 *   expectedOccurrenceCount: NonNegativeInt.make(564),
 *   maxElapsedMillis: NonNegativeInt.make(60000),
 *   maxTotalElapsedMillis: NonNegativeInt.make(3600000),
 *   maxTotalOutputBytes: NonNegativeInt.make(1073741824),
 *   maxVisualRmse: 0,
 *   tikaJarPath: "/opt/tika/tika-app.jar"
 * })
 * console.log(options.converterPath) // "soffice"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class RestorationLegacyWordOptions extends S.Class<RestorationLegacyWordOptions>(
  $I`RestorationLegacyWordOptions`
)(
  {
    bwrapPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("bwrap")),
    comparePath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("compare")),
    converterPath: S.NonEmptyString,
    corpusRoot: S.NonEmptyString,
    expectedConverterVersion: S.NonEmptyString,
    expectedOccurrenceCount: NonNegativeInt,
    javaPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("java")),
    maxElapsedMillis: NonNegativeInt,
    maxTotalElapsedMillis: NonNegativeInt,
    maxTotalOutputBytes: NonNegativeInt,
    maxVisualRmse: S.Finite,
    pdfinfoPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("pdfinfo")),
    pdftoppmPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("pdftoppm")),
    runLabel: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("t7-salvage-2026-08-10")),
    tikaJarPath: S.NonEmptyString,
  },
  $I.annote("RestorationLegacyWordOptions", {
    description:
      "Pinned converter identity, source denominator, elapsed-time ceiling, and declared visual fidelity threshold for one conversion run.",
  })
) {}

/**
 * One row from the inherited collector manifest.
 *
 * **Example** (Decode a collector row)
 *
 * ```ts
 * import { CollectorManifestRecord } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(CollectorManifestRecord)({
 *   dst: "F:\\salvage\\tree\\file.bin",
 *   size: 4,
 *   src: "C:\\source\\file.bin",
 *   status: "copied"
 * })
 * console.log(decoded._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CollectorManifestRecord extends S.Class<CollectorManifestRecord>($I`CollectorManifestRecord`)(
  {
    dst: S.NonEmptyString,
    size: NonNegativeInt,
    src: S.NonEmptyString,
    status: LiteralKit(["copied", "error", "excluded-secret", "resumed"]),
  },
  $I.annote("CollectorManifestRecord", {
    description: "Schema-decoded source, destination, size, and outcome from the inherited collector ledger.",
  })
) {}

/**
 * Decodes one inherited collector JSONL row.
 *
 * **Example** (Decode collector JSON)
 *
 * ```ts
 * import { decodeCollectorManifestRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const decoded = decodeCollectorManifestRecordJson('{"dst":"relative","size":0,"src":"C:\\\\source","status":"error"}')
 * console.log(Effect.isEffect(decoded)) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeCollectorManifestRecordJson = JsonStringCodec(CollectorManifestRecord).decode;

class SourceStat extends S.Class<SourceStat>($I`SourceStat`)(
  {
    mtimeMillis: NonNegativeInt,
    sizeBytes: NonNegativeInt,
  },
  $I.annote("SourceStat", {
    description: "Source size and modification time observed before or after a streaming copy attempt.",
  })
) {}

class ArchivePreflightRecord extends S.Class<ArchivePreflightRecord>($I`ArchivePreflightRecord`)(
  {
    approved: S.Boolean,
    approvedCeilingBytes: NonNegativeInt,
    availableBytes: NonNegativeInt,
    directoryCount: NonNegativeInt,
    fileCount: NonNegativeInt,
    minimumFreeAfterBytes: NonNegativeInt,
    recordedAt: RecordedAt,
    recordType: S.Literal("archive-preflight"),
    requiredBytes: NonNegativeInt,
    runId: RunId,
    schemaVersion: SchemaVersion,
  },
  $I.annote("ArchivePreflightRecord", {
    description: "Capacity and object-count preflight that must pass before preservation writes payload bytes.",
  })
) {}

class ArchiveDirectoryPassRecord extends S.Class<ArchiveDirectoryPassRecord>($I`ArchiveDirectoryPassRecord`)(
  {
    destinationRelativePath: RelativePath,
    objectId: ObjectId,
    objectKind: S.Literal("directory"),
    recordedAt: RecordedAt,
    recordType: S.Literal("archive-directory-pass"),
    runId: RunId,
    schemaVersion: SchemaVersion,
    sourceLabel: S.NonEmptyString,
    sourceRelativePath: RelativePath,
  },
  $I.annote("ArchiveDirectoryPassRecord", {
    description: "Durably synced archive directory occurrence.",
  })
) {}

class ArchiveFilePassRecord extends S.Class<ArchiveFilePassRecord>($I`ArchiveFilePassRecord`)(
  {
    attemptId: AttemptId,
    destinationRelativePath: RelativePath,
    objectId: ObjectId,
    objectKind: ArchiveObjectKind,
    postCopySource: SourceStat,
    preCopySource: SourceStat,
    recordedAt: RecordedAt,
    recordType: S.Literal("archive-file-pass"),
    resumedBytes: NonNegativeInt,
    runId: RunId,
    schemaVersion: SchemaVersion,
    sha256: Sha256Hex,
    sizeBytes: NonNegativeInt,
    sourceLabel: S.NonEmptyString,
    sourceRelativePath: RelativePath,
  },
  $I.annote("ArchiveFilePassRecord", {
    description:
      "Terminal PASS for one stable source file after payload fsync, atomic promotion, independent destination hashing, and manifest fsync.",
  })
) {}

class ArchiveChangedDuringCopyRecord extends S.Class<ArchiveChangedDuringCopyRecord>(
  $I`ArchiveChangedDuringCopyRecord`
)(
  {
    attemptId: AttemptId,
    destinationRelativePath: RelativePath,
    objectId: ObjectId,
    postCopySource: SourceStat,
    preCopySource: SourceStat,
    recordedAt: RecordedAt,
    recordType: S.Literal("archive-changed-during-copy"),
    runId: RunId,
    schemaVersion: SchemaVersion,
    sourceLabel: S.NonEmptyString,
    sourceRelativePath: RelativePath,
  },
  $I.annote("ArchiveChangedDuringCopyRecord", {
    description: "Rejected copy attempt whose source size or modification time changed while bytes were streaming.",
  })
) {}

const ArchiveFailureKind = LiteralKit([
  "capacity-denied",
  "hash-mismatch",
  "source-manifest-mismatch",
  "unreadable",
  "unsupported-object",
]).pipe(
  $I.annoteSchema("ArchiveFailureKind", {
    description: "Fail-closed preservation outcome that cannot become PASS without a later successful attempt.",
  })
);

class ArchiveFailureRecord extends S.Class<ArchiveFailureRecord>($I`ArchiveFailureRecord`)(
  {
    approved: S.Boolean,
    failureKind: ArchiveFailureKind,
    message: S.NonEmptyString,
    objectId: ObjectId,
    recordedAt: RecordedAt,
    recordType: S.Literal("archive-failure"),
    runId: RunId,
    schemaVersion: SchemaVersion,
    sourceLabel: S.NonEmptyString,
    sourceRelativePath: RelativePath,
  },
  $I.annote("ArchiveFailureRecord", {
    description: "Terminal preservation failure with explicit approval state.",
  })
) {}

const InheritedLossCategory = LiteralKit([
  "collector-error",
  "missing-recycle-payload",
  "mutated-destination",
  "stripped-filesystem-metadata",
]).pipe(
  $I.annoteSchema("InheritedLossCategory", {
    description: "Ratified opening-loss class carried without a recovery claim.",
  })
);

class InheritedLossRecord extends S.Class<InheritedLossRecord>($I`InheritedLossRecord`)(
  {
    approved: S.Literal(true),
    category: InheritedLossCategory,
    count: NonNegativeInt,
    recordedAt: RecordedAt,
    recordType: S.Literal("inherited-loss"),
    runId: RunId,
    schemaVersion: SchemaVersion,
  },
  $I.annote("InheritedLossRecord", {
    description: "Operator-ratified inherited-loss opening balance recorded without claiming byte recovery.",
  })
) {}

class ArchiveManifestSealRecord extends S.Class<ArchiveManifestSealRecord>($I`ArchiveManifestSealRecord`)(
  {
    manifestSha256: Sha256Hex,
    recordCount: NonNegativeInt,
    recordedAt: RecordedAt,
    recordType: S.Literal("archive-manifest-seal"),
    runId: RunId,
    schemaVersion: SchemaVersion,
  },
  $I.annote("ArchiveManifestSealRecord", {
    description: "Digest and row count covering the exact manifest bytes before this terminal seal row.",
  })
) {}

/**
 * Append-only preservation ledger row.
 *
 * **Example** (Inspect preservation record cases)
 *
 * ```ts
 * import { ArchiveLedgerRecord } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(Object.keys(ArchiveLedgerRecord.cases).includes("archive-file-pass")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArchiveLedgerRecord = S.Union([
  ArchiveChangedDuringCopyRecord,
  ArchiveDirectoryPassRecord,
  ArchiveFailureRecord,
  ArchiveFilePassRecord,
  ArchiveManifestSealRecord,
  ArchivePreflightRecord,
  InheritedLossRecord,
]).pipe(
  S.toTaggedUnion("recordType"),
  $I.annoteSchema("ArchiveLedgerRecord", {
    description: "Schema-versioned preflight, attempt, terminal, inherited-loss, and seal rows for preservation.",
  })
);

/** Decoded append-only preservation ledger row. @category models @since 0.0.0 */
export type ArchiveLedgerRecord = typeof ArchiveLedgerRecord.Type;

/**
 * Encodes one preservation row as a JSONL line.
 *
 * **Example** (Reference preservation encoder)
 *
 * ```ts
 * import { encodeArchiveLedgerRecordJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof encodeArchiveLedgerRecordJson) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeArchiveLedgerRecordJson = JsonStringCodec(ArchiveLedgerRecord).encode;

/**
 * Decodes one preservation JSONL line.
 *
 * **Example** (Reference preservation decoder)
 *
 * ```ts
 * import { decodeArchiveLedgerRecordJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof decodeArchiveLedgerRecordJson) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeArchiveLedgerRecordJson = JsonStringCodec(ArchiveLedgerRecord).decode;

const VerificationFailureKind = LiteralKit([
  "digest-mismatch",
  "duplicate-object",
  "manifest-corrupt",
  "manifest-unsealed",
  "missing-destination",
  "unapproved-terminal",
]).pipe(
  $I.annoteSchema("VerificationFailureKind", {
    description: "Independent archive verification failure classification.",
  })
);

class ArchiveVerificationPassRecord extends S.Class<ArchiveVerificationPassRecord>($I`ArchiveVerificationPassRecord`)(
  {
    destinationRelativePath: RelativePath,
    objectId: ObjectId,
    recordType: S.Literal("verification-pass"),
    sha256: Sha256Hex,
    sizeBytes: NonNegativeInt,
  },
  $I.annote("ArchiveVerificationPassRecord", {
    description: "Fresh-process destination byte verification PASS for one terminal archive object.",
  })
) {}

class ArchiveVerificationFailureRecord extends S.Class<ArchiveVerificationFailureRecord>(
  $I`ArchiveVerificationFailureRecord`
)(
  {
    failureKind: VerificationFailureKind,
    message: S.NonEmptyString,
    objectId: ObjectId,
    recordType: S.Literal("verification-failure"),
  },
  $I.annote("ArchiveVerificationFailureRecord", {
    description: "Fresh-process archive verification failure for one object or manifest invariant.",
  })
) {}

/**
 * Independent archive verification result row.
 *
 * **Example** (Inspect verification cases)
 *
 * ```ts
 * import { ArchiveVerificationRecord } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(Object.keys(ArchiveVerificationRecord.cases).length) // 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArchiveVerificationRecord = S.Union([
  ArchiveVerificationFailureRecord,
  ArchiveVerificationPassRecord,
]).pipe(
  S.toTaggedUnion("recordType"),
  $I.annoteSchema("ArchiveVerificationRecord", {
    description: "PASS or fail-closed row produced by an independent archive verifier.",
  })
);

/** Decoded independent verification row. @category models @since 0.0.0 */
export type ArchiveVerificationRecord = typeof ArchiveVerificationRecord.Type;

/**
 * Encode one independent archive-verification row as JSON.
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeArchiveVerificationRecordJson = JsonStringCodec(ArchiveVerificationRecord).encode;

/**
 * Summary returned by preservation, verification, and transformation families.
 *
 * **Example** (Build a passing family summary)
 *
 * ```ts
 * import { RestorationRunSummary } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = RestorationRunSummary.make({
 *   elapsedMillis: NonNegativeInt.make(10),
 *   exceptionCount: NonNegativeInt.make(0),
 *   family: "preservation",
 *   inputBytes: NonNegativeInt.make(4),
 *   outputBytes: NonNegativeInt.make(4),
 *   passCount: NonNegativeInt.make(1),
 *   sourceCount: NonNegativeInt.make(1),
 *   unapprovedCount: NonNegativeInt.make(0)
 * })
 * console.log(summary.passCount) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RestorationRunSummary extends S.Class<RestorationRunSummary>($I`RestorationRunSummary`)(
  {
    elapsedMillis: NonNegativeInt,
    exceptionCount: NonNegativeInt,
    family: LiteralKit(["legacy-word", "mail", "preservation", "recycle"]),
    inputBytes: NonNegativeInt,
    outputBytes: NonNegativeInt,
    passCount: NonNegativeInt,
    sourceCount: NonNegativeInt,
    unapprovedCount: NonNegativeInt,
  },
  $I.annote("RestorationRunSummary", {
    description: "Aggregate-only terminal counts and byte/time measurements for one acceptance family.",
  })
) {}

/**
 * Immutable reconciled acceptance record for one preservation or transformation family.
 *
 * **Example** (Build a reconciled acceptance record)
 *
 * ```ts
 * import { RestorationAcceptanceRecord } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const record = RestorationAcceptanceRecord.make({
 *   elapsedMillis: NonNegativeInt.make(1),
 *   exceptionCount: NonNegativeInt.make(0),
 *   expectedTerminalCount: NonNegativeInt.make(1),
 *   family: "preservation",
 *   inputBytes: NonNegativeInt.make(4),
 *   outputBytes: NonNegativeInt.make(4),
 *   passCount: NonNegativeInt.make(1),
 *   recordedAt: "2026-08-27T00:00:00.000Z",
 *   schemaVersion: "oppold-corpus-restoration/v1",
 *   sourceCount: NonNegativeInt.make(1),
 *   status: "pass",
 *   terminalCount: NonNegativeInt.make(1),
 *   unapprovedCount: NonNegativeInt.make(0)
 * })
 * console.log(record.status) // "pass"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RestorationAcceptanceRecord extends S.Class<RestorationAcceptanceRecord>($I`RestorationAcceptanceRecord`)(
  {
    elapsedMillis: NonNegativeInt,
    exceptionCount: NonNegativeInt,
    expectedTerminalCount: NonNegativeInt,
    family: LiteralKit(["legacy-word", "mail", "preservation", "recycle"]),
    inputBytes: NonNegativeInt,
    outputBytes: NonNegativeInt,
    passCount: NonNegativeInt,
    recordedAt: RecordedAt,
    schemaVersion: SchemaVersion,
    sourceCount: NonNegativeInt,
    status: S.Literal("pass"),
    terminalCount: NonNegativeInt,
    unapprovedCount: S.Literal(0),
  },
  $I.annote("RestorationAcceptanceRecord", {
    description: "Separate immutable PASS record emitted only after one family ledger independently reconciles.",
  })
) {}

/**
 * Encode one reconciled acceptance record as JSON.
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeRestorationAcceptanceRecordJson = JsonStringCodec(RestorationAcceptanceRecord).encode;

/**
 * Decode one reconciled acceptance JSON object.
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeRestorationAcceptanceRecordJson = JsonStringCodec(RestorationAcceptanceRecord).decode;

const MailExceptionKind = LiteralKit(["codepage", "corrupt", "engine-failure", "password", "unsupported-family"]).pipe(
  $I.annoteSchema("MailExceptionKind", {
    description: "Explicit mail store exception or non-PST family disposition.",
  })
);

const MailDisposition = LiteralKit(["defer", "process", "quarantine"]).pipe(
  $I.annoteSchema("MailDisposition", {
    description: "Explicit terminal handling decision for a non-PST mail family.",
  })
);

class MailStorePassRecord extends S.Class<MailStorePassRecord>($I`MailStorePassRecord`)(
  {
    accountedChildCount: NonNegativeInt,
    attemptId: AttemptId,
    childCount: NonNegativeInt,
    elapsedMillis: NonNegativeInt,
    inputBytes: NonNegativeInt,
    objectId: ObjectId,
    outputBytes: NonNegativeInt,
    recordType: S.Literal("mail-store-pass"),
    sha256: Sha256Hex,
    warningCount: NonNegativeInt,
  },
  $I.annote("MailStorePassRecord", {
    description: "Terminal mail-store PASS with zero unaccounted children and measured amplification.",
  })
) {}

class MailStoreExceptionRecord extends S.Class<MailStoreExceptionRecord>($I`MailStoreExceptionRecord`)(
  {
    approved: S.Boolean,
    attemptId: AttemptId,
    disposition: S.optionalKey(MailDisposition),
    exceptionKind: MailExceptionKind,
    message: S.NonEmptyString,
    objectId: ObjectId,
    recordType: S.Literal("mail-store-exception"),
    sourceFamily: LiteralKit(["eml", "msg", "ost", "pst", "residue"]),
  },
  $I.annote("MailStoreExceptionRecord", {
    description: "Terminal mail-store exception with explicit approval state and no silent skip.",
  })
) {}

class MailWarningRecord extends S.Class<MailWarningRecord>($I`MailWarningRecord`)(
  {
    attemptId: AttemptId,
    message: S.NonEmptyString,
    objectId: ObjectId,
    recordType: S.Literal("mail-warning"),
  },
  $I.annote("MailWarningRecord", {
    description: "Bounded engine warning persisted for one mail restoration attempt.",
  })
) {}

class MailChildPassRecord extends S.Class<MailChildPassRecord>($I`MailChildPassRecord`)(
  {
    attemptId: AttemptId,
    childRelativePath: RelativePath,
    recordType: S.Literal("mail-child-pass"),
    sha256: Sha256Hex,
    sizeBytes: NonNegativeInt,
    sourceObjectId: ObjectId,
  },
  $I.annote("MailChildPassRecord", {
    description: "Per-child digest and size accounting row for one mail export attempt.",
  })
) {}

class AttachmentTypeRepairRecord extends S.Class<AttachmentTypeRepairRecord>($I`AttachmentTypeRepairRecord`)(
  {
    detectedExtension: S.NonEmptyString,
    derivedRelativePath: RelativePath,
    originalRelativePath: RelativePath,
    recordType: S.Literal("attachment-type-repair"),
    repairStatus: LiteralKit(["repaired", "unchanged", "unsupported"]),
    sourceObjectId: ObjectId,
  },
  $I.annote("AttachmentTypeRepairRecord", {
    description: "Byte-signature attachment disposition and non-destructive derived path for second-pass extraction.",
  })
) {}

const RecycleJoinClass = LiteralKit(["duplicate", "missing-content", "orphan-content", "valid-pair"]).pipe(
  $I.annoteSchema("RecycleJoinClass", {
    description: "Four-class recycle metadata/content join outcome.",
  })
);

class RecycleJoinRecord extends S.Class<RecycleJoinRecord>($I`RecycleJoinRecord`)(
  {
    count: NonNegativeInt,
    joinClass: RecycleJoinClass,
    recordType: S.Literal("recycle-join"),
    surfaceId: S.NonEmptyString,
  },
  $I.annote("RecycleJoinRecord", {
    description: "Aggregate four-class join count for one recycle volume surface.",
  })
) {}

class RecycleMappingRecord extends S.Class<RecycleMappingRecord>($I`RecycleMappingRecord`)(
  {
    digest: Sha256Hex,
    originalPath: S.NonEmptyString,
    recordType: S.Literal("recycle-mapping"),
    restoredRelativePath: RelativePath,
    sourceObjectId: ObjectId,
    surfaceId: S.NonEmptyString,
  },
  $I.annote("RecycleMappingRecord", {
    description: "Original path, content digest, restored path, occurrence, and volume identity mapping.",
  })
) {}

class LegacyWordPassRecord extends S.Class<LegacyWordPassRecord>($I`LegacyWordPassRecord`)(
  {
    convertedSha256: Sha256Hex,
    engineVersion: S.NonEmptyString,
    normalizedTextSha256: Sha256Hex,
    originalSha256: Sha256Hex,
    pageCountDelta: S.Int,
    recordType: S.Literal("legacy-word-pass"),
    visualRmse: S.Finite,
  },
  $I.annote("LegacyWordPassRecord", {
    description:
      "Distinct-digest legacy-Word conversion PASS with pinned engine and declared text, pagination, and visual measures.",
  })
) {}

class LegacyWordExceptionRecord extends S.Class<LegacyWordExceptionRecord>($I`LegacyWordExceptionRecord`)(
  {
    approved: S.Boolean,
    exceptionKind: LiteralKit(["conversion-failed", "fidelity-failed", "not-binary-word"]),
    message: S.NonEmptyString,
    originalSha256: Sha256Hex,
    recordType: S.Literal("legacy-word-exception"),
  },
  $I.annote("LegacyWordExceptionRecord", {
    description: "Terminal distinct-digest legacy-Word exception with explicit approval state.",
  })
) {}

class FamilyAcceptancePassRecord extends S.Class<FamilyAcceptancePassRecord>($I`FamilyAcceptancePassRecord`)(
  {
    expectedCount: NonNegativeInt,
    family: LiteralKit(["legacy-word", "mail", "preservation", "recycle"]),
    recordType: S.Literal("family-acceptance-pass"),
    terminalCount: NonNegativeInt,
    unapprovedCount: S.Literal(0),
  },
  $I.annote("FamilyAcceptancePassRecord", {
    description: "Reconciled family acceptance record with a complete denominator and zero unapproved rows.",
  })
) {}

class FamilyAcceptanceFailureRecord extends S.Class<FamilyAcceptanceFailureRecord>($I`FamilyAcceptanceFailureRecord`)(
  {
    expectedCount: NonNegativeInt,
    family: LiteralKit(["legacy-word", "mail", "preservation", "recycle"]),
    message: S.NonEmptyString,
    recordType: S.Literal("family-acceptance-failure"),
    terminalCount: NonNegativeInt,
    unapprovedCount: NonNegativeInt,
  },
  $I.annote("FamilyAcceptanceFailureRecord", {
    description: "Fail-closed family acceptance record for an incomplete denominator or unapproved terminal row.",
  })
) {}

class FamilyRunSummaryRecord extends S.Class<FamilyRunSummaryRecord>($I`FamilyRunSummaryRecord`)(
  {
    elapsedMillis: NonNegativeInt,
    exceptionCount: NonNegativeInt,
    family: LiteralKit(["legacy-word", "mail", "recycle"]),
    inputBytes: NonNegativeInt,
    outputBytes: NonNegativeInt,
    passCount: NonNegativeInt,
    recordType: S.Literal("family-run-summary"),
    sourceCount: NonNegativeInt,
    unapprovedCount: NonNegativeInt,
  },
  $I.annote("FamilyRunSummaryRecord", {
    description: "Measured aggregate summary paired with one transformation-family acceptance row.",
  })
) {}

/**
 * Append-only terminal row for mail, recycle, legacy-Word, or family acceptance.
 *
 * **Example** (Inspect transformation cases)
 *
 * ```ts
 * import { TransformationLedgerRecord } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(Object.keys(TransformationLedgerRecord.cases).includes("mail-store-pass")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TransformationLedgerRecord = S.Union([
  AttachmentTypeRepairRecord,
  FamilyAcceptanceFailureRecord,
  FamilyAcceptancePassRecord,
  FamilyRunSummaryRecord,
  LegacyWordExceptionRecord,
  LegacyWordPassRecord,
  MailChildPassRecord,
  MailStoreExceptionRecord,
  MailStorePassRecord,
  MailWarningRecord,
  RecycleJoinRecord,
  RecycleMappingRecord,
]).pipe(
  S.toTaggedUnion("recordType"),
  $I.annoteSchema("TransformationLedgerRecord", {
    description: "Schema-versioned terminal and mapping rows for the bounded transformation families.",
  })
);

/** Decoded transformation ledger row. @category models @since 0.0.0 */
export type TransformationLedgerRecord = typeof TransformationLedgerRecord.Type;

/**
 * Encodes one transformation ledger row as JSON.
 *
 * **Example** (Reference transformation encoder)
 *
 * ```ts
 * import { encodeTransformationLedgerRecordJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof encodeTransformationLedgerRecordJson) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeTransformationLedgerRecordJson = JsonStringCodec(TransformationLedgerRecord).encode;

/**
 * Decodes one transformation ledger JSON line.
 *
 * **Example** (Reference transformation decoder)
 *
 * ```ts
 * import { decodeTransformationLedgerRecordJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof decodeTransformationLedgerRecordJson) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeTransformationLedgerRecordJson = JsonStringCodec(TransformationLedgerRecord).decode;
