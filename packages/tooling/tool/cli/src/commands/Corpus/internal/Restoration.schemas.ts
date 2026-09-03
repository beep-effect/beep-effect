/**
 * Schema models for bounded corpus preservation and restoration runs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/Restoration.schemas");

const SchemaVersion = S.Literal("oppold-corpus-restoration/v1").pipe(
  $I.annoteSchema("RestorationSchemaVersion", {
    description: "Version identifier shared by preservation, transformation, and acceptance evidence.",
  })
);
const RecordedAt = S.NonEmptyString.pipe(
  $I.annoteSchema("RestorationRecordedAt", {
    description: "Non-empty ISO timestamp recorded with immutable restoration evidence.",
  })
);
const RunId = S.NonEmptyString.pipe(
  $I.annoteSchema("RestorationRunId", {
    description: "Opaque identity for one preservation or transformation execution.",
  })
);
const ObjectId = S.NonEmptyString.pipe(
  $I.annoteSchema("RestorationObjectId", {
    description: "Stable identity assigned to one preserved source occurrence.",
  })
);
const AttemptId = S.NonEmptyString.check(
  S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u, {
    identifier: $I`RestorationAttemptIdCheck`,
    title: "Restoration Attempt Identifier",
    description: "Attempt identifiers are bounded portable path segments and may not carry traversal syntax.",
    message: "Expected one bounded alphanumeric attempt-id segment.",
  })
).pipe(
  $I.annoteSchema("RestorationAttemptId", {
    description: "Stable traversal-safe single-segment identity assigned to one bounded processing attempt.",
  })
);

const isSafeRelativePath = (value: string): boolean =>
  Eq.equals(value, ".") ||
  (A.isReadonlyArrayNonEmpty(Str.split("/")(value)) &&
    A.every(
      Str.split("/")(value),
      (segment) => Str.isNonEmpty(segment) && !Eq.equals(segment, ".") && !Eq.equals(segment, "..")
    ));

const RelativePath = S.NonEmptyString.check(
  S.isPattern(/^(?:\.|(?![\\/]|[A-Za-z]:)[^\\\u0000]+)$/u, {
    identifier: $I`RestorationRelativePathSyntaxCheck`,
    title: "Restoration Relative Path Syntax",
    description: "Restoration paths must be root-relative POSIX paths without backslashes or drive prefixes.",
    message: "Expected a root-relative POSIX path.",
  }),
  S.makeFilter(isSafeRelativePath, {
    identifier: $I`RestorationRelativePathSegmentCheck`,
    title: "Restoration Relative Path Segments",
    description: "Restoration path segments must not be empty, current-directory, or parent-directory markers.",
    message: "Restoration paths must not contain empty, '.' or '..' segments.",
  })
).pipe(
  $I.annoteSchema("RestorationRelativePath", {
    description: "Traversal-safe POSIX path relative to a pinned restoration authority root.",
  })
);

const RunLabel = S.NonEmptyString.check(
  S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u, {
    identifier: $I`RestorationRunLabelCheck`,
    title: "Restoration Run Label",
    description: "Run labels are one bounded portable filesystem segment.",
    message: "Expected one portable run-label segment beginning with an alphanumeric character.",
  })
).pipe(
  $I.annoteSchema("RestorationRunLabel", {
    description: "Traversal-safe single-segment label used to isolate one restoration run.",
  })
);

const PositiveFinite = S.Finite.check(
  S.isGreaterThan(0, {
    identifier: $I`RestorationPositiveFiniteCheck`,
    title: "Positive Finite Restoration Limit",
    description: "A bounded restoration ratio or fidelity threshold that must be greater than zero.",
    message: "Expected a finite number greater than zero.",
  })
).pipe(
  $I.annoteSchema("RestorationPositiveFinite", {
    description: "Strictly positive finite restoration limit.",
  })
);

const NonNegativeFinite = S.Finite.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`RestorationNonNegativeFiniteCheck`,
    title: "Non-negative Finite Restoration Limit",
    description: "A restoration fidelity threshold that must not be negative.",
    message: "Expected a finite number greater than or equal to zero.",
  })
).pipe(
  $I.annoteSchema("RestorationNonNegativeFinite", {
    description: "Finite restoration threshold greater than or equal to zero.",
  })
);

const RestorationFamily = LiteralKit(["legacy-word", "mail", "preservation", "recycle"]).pipe(
  $I.annoteSchema("RestorationFamily", {
    description: "Acceptance family represented by one restoration evidence row.",
  })
);

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
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 *
 * const options = RestorationPreserveOptions.make({
 *   absentRecycleTreePath: "/media/absent-recycle-tree",
 *   capacityCeilingBytes: PosInt.make(1024),
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
    capacityCeilingBytes: PosInt,
    chunkSizeBytes: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(8 * 1024 * 1024))),
    collectorDestinationPrefixSegments: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(2))),
    corpusRoot: S.NonEmptyString,
    crashPoint: PreservationCrashPoint.pipe(SchemaUtils.withKeyDefaults("none")),
    expectedCollectorRowCount: NonNegativeInt,
    expectedCollectorCopiedCount: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(10_871))),
    expectedCollectorErrorCount: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(5_986))),
    expectedCollectorExcludedSecretCount: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(12))),
    expectedCollectorPresentSuccessfulRowCount: NonNegativeInt.pipe(
      SchemaUtils.withKeyDefaults(NonNegativeInt.make(21_489))
    ),
    expectedCollectorResumedCount: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(11_639))),
    expectedCollectorUniqueSuccessfulDestinationCount: NonNegativeInt.pipe(
      SchemaUtils.withKeyDefaults(NonNegativeInt.make(10_871))
    ),
    expectedMissingRecyclePayloadCount: NonNegativeInt,
    expectedMutatedDestinationCount: NonNegativeInt,
    expectedRootArchiveBytes: NonNegativeInt,
    expectedSourceDirectoryCount: NonNegativeInt,
    expectedSourceFileCount: NonNegativeInt,
    expectedSourceTreeBytes: NonNegativeInt,
    minimumFreeAfterBytes: NonNegativeInt,
    rootArchivePath: S.NonEmptyString,
    runLabel: RunLabel.pipe(SchemaUtils.withKeyDefaults("t7-salvage-2026-08-10")),
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
    runLabel: RunLabel.pipe(SchemaUtils.withKeyDefaults("t7-salvage-2026-08-10")),
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

/**
 * Decoded mail restoration scope used by command options and run-bound evidence.
 *
 * @see {@link MailRestorationScope} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type MailRestorationScope = typeof MailRestorationScope.Type;

const TransformationFamily = LiteralKit(["legacy-word", "mail", "recycle"]).pipe(
  $I.annoteSchema("TransformationFamily", {
    description: "Mutation-bearing restoration family represented in the transformation ledger.",
  })
);

const TransformationEvidenceIdentity = S.Struct({
  preservationRunId: RunId,
  preservationSealSha256: Sha256Hex,
  recordedAt: RecordedAt,
  runLabel: RunLabel,
  schemaVersion: SchemaVersion,
  transformationRunId: RunId,
});

/**
 * Validated inputs for the mail slice or full estate run.
 *
 * **Example** (Create mail restoration options)
 *
 * ```ts
 * import { RestorationMailOptions } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 *
 * const options = RestorationMailOptions.make({
 *   corpusRoot: "/data/corpus",
 *   expectedStoreCount: NonNegativeInt.make(1),
 *   maxAmplificationRatio: 4,
 *   maxElapsedMillis: PosInt.make(60000),
 *   maxTotalElapsedMillis: PosInt.make(60000),
 *   maxTotalOutputBytes: PosInt.make(1073741824),
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
    bwrapPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("bwrap")),
    corpusRoot: S.NonEmptyString,
    expectedStoreCount: NonNegativeInt,
    maxAmplificationRatio: PositiveFinite,
    maxElapsedMillis: PosInt,
    maxTotalElapsedMillis: PosInt,
    maxTotalOutputBytes: PosInt,
    pffexportPath: S.NonEmptyString,
    runLabel: RunLabel.pipe(SchemaUtils.withKeyDefaults("t7-salvage-2026-08-10")),
    scope: MailRestorationScope,
    systemdRunPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("systemd-run")),
    tikaJarPath: S.NonEmptyString,
    javaPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("java")),
  },
  $I.annote("RestorationMailOptions", {
    description:
      "Frozen engine and sandbox locations, denominator, elapsed-time ceiling, and disk amplification ceiling for one mail restoration scope.",
  })
) {}

/**
 * Validated inputs for three-volume recycle reconciliation.
 *
 * **Example** (Create recycle reconciliation options)
 *
 * ```ts
 * import { RestorationRecycleOptions } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 *
 * const options = RestorationRecycleOptions.make({
 *   corpusRoot: "/data/corpus",
 *   expectedMissingContentCount: NonNegativeInt.make(13),
 *   expectedSurfaceCount: NonNegativeInt.make(3),
 *   maxTotalElapsedMillis: PosInt.make(3600000),
 *   maxTotalOutputBytes: PosInt.make(1073741824)
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
    maxTotalElapsedMillis: PosInt,
    maxTotalOutputBytes: PosInt,
    runLabel: RunLabel.pipe(SchemaUtils.withKeyDefaults("t7-salvage-2026-08-10")),
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
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 *
 * const options = RestorationLegacyWordOptions.make({
 *   converterPath: "soffice",
 *   corpusRoot: "/data/corpus",
 *   expectedConverterVersion: "LibreOffice 26.2.0.0",
 *   expectedOccurrenceCount: NonNegativeInt.make(564),
 *   maxElapsedMillis: PosInt.make(60000),
 *   maxTotalElapsedMillis: PosInt.make(3600000),
 *   maxTotalOutputBytes: PosInt.make(1073741824),
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
    maxElapsedMillis: PosInt,
    maxTotalElapsedMillis: PosInt,
    maxTotalOutputBytes: PosInt,
    maxVisualRmse: NonNegativeFinite,
    pdfinfoPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("pdfinfo")),
    pdftoppmPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("pdftoppm")),
    runLabel: RunLabel.pipe(SchemaUtils.withKeyDefaults("t7-salvage-2026-08-10")),
    tikaJarPath: S.NonEmptyString,
  },
  $I.annote("RestorationLegacyWordOptions", {
    description:
      "Pinned converter identity, source denominator, elapsed-time ceiling, and declared visual fidelity threshold for one conversion run.",
  })
) {}

class CollectorCopiedManifestRecord extends S.Class<CollectorCopiedManifestRecord>($I`CollectorCopiedManifestRecord`)(
  {
    dst: S.NonEmptyString,
    size: NonNegativeInt,
    src: S.NonEmptyString,
    status: S.Literal("copied"),
  },
  $I.annote("CollectorCopiedManifestRecord", {
    description: "Inherited collector success row for a newly copied destination.",
  })
) {}

class CollectorResumedManifestRecord extends S.Class<CollectorResumedManifestRecord>(
  $I`CollectorResumedManifestRecord`
)(
  {
    dst: S.NonEmptyString,
    size: NonNegativeInt,
    src: S.NonEmptyString,
    status: S.Literal("resumed"),
  },
  $I.annote("CollectorResumedManifestRecord", {
    description: "Inherited collector success row for a destination resumed from prior work.",
  })
) {}

class CollectorErrorManifestRecord extends S.Class<CollectorErrorManifestRecord>($I`CollectorErrorManifestRecord`)(
  {
    reason: S.NonEmptyString,
    src: S.NonEmptyString,
    status: S.Literal("error"),
  },
  $I.annote("CollectorErrorManifestRecord", {
    description: "Inherited collector failure row that records a source and non-empty reason without a destination.",
  })
) {}

class CollectorExcludedSecretManifestRecord extends S.Class<CollectorExcludedSecretManifestRecord>(
  $I`CollectorExcludedSecretManifestRecord`
)(
  {
    src: S.NonEmptyString,
    status: S.Literal("excluded-secret"),
  },
  $I.annote("CollectorExcludedSecretManifestRecord", {
    description: "Inherited collector exclusion row whose source was deliberately omitted as secret material.",
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
 *   reason: "source unreadable",
 *   src: "C:\\source\\file.bin",
 *   status: "error"
 * })
 * console.log(decoded._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CollectorManifestRecord = S.Union([
  CollectorCopiedManifestRecord,
  CollectorErrorManifestRecord,
  CollectorExcludedSecretManifestRecord,
  CollectorResumedManifestRecord,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("CollectorManifestRecord", {
    description: "Status-tagged source, destination, size, and outcome row from the inherited collector ledger.",
  })
);

/**
 * One status-specific row from the inherited collector manifest.
 *
 * @category models
 * @since 0.0.0
 */
export type CollectorManifestRecord = typeof CollectorManifestRecord.Type;

/**
 * Decodes one inherited collector JSONL row.
 *
 * **Example** (Decode collector JSON)
 *
 * ```ts
 * import { decodeCollectorManifestRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const decoded = decodeCollectorManifestRecordJson('{"reason":"unreadable","src":"C:\\\\source","status":"error"}')
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

/**
 * Decoded append-only preservation ledger row.
 *
 * @see {@link ArchiveLedgerRecord} for the tagged runtime schema and record cases.
 * @category models
 * @since 0.0.0
 */
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

/**
 * Decoded independent verification row for one preserved object.
 *
 * @see {@link ArchiveVerificationRecord} for the tagged runtime schema and record cases.
 * @category models
 * @since 0.0.0
 */
export type ArchiveVerificationRecord = typeof ArchiveVerificationRecord.Type;

/**
 * Encode one independent archive-verification row as JSON.
 *
 * **Example** (Encode a verification failure)
 *
 * ```ts
 * import { ArchiveVerificationRecord, encodeArchiveVerificationRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const row = ArchiveVerificationRecord.cases["verification-failure"].make({
 *   failureKind: "manifest-unsealed",
 *   message: "The preservation ledger has no terminal seal.",
 *   objectId: "manifest",
 *   recordType: "verification-failure"
 * })
 * console.log(Effect.isEffect(encodeArchiveVerificationRecordJson(row))) // true
 * ```
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
    family: RestorationFamily,
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
 * import { NonNegativeInt, Sha256Hex } from "@beep/schema"
 *
 * const record = RestorationAcceptanceRecord.make({
 *   evidenceSha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   elapsedMillis: NonNegativeInt.make(1),
 *   exceptionCount: NonNegativeInt.make(0),
 *   expectedTerminalCount: NonNegativeInt.make(1),
 *   family: "preservation",
 *   inputBytes: NonNegativeInt.make(4),
 *   outputTreeSha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   outputBytes: NonNegativeInt.make(4),
 *   passCount: NonNegativeInt.make(1),
 *   preservationRunId: "preservation-1",
 *   preservationSealSha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   recordedAt: "2026-08-27T00:00:00.000Z",
 *   runLabel: "restoration-1",
 *   schemaVersion: "oppold-corpus-restoration/v1",
 *   sourceCount: NonNegativeInt.make(1),
 *   status: "pass",
 *   terminalCount: NonNegativeInt.make(1),
 *   unapprovedCount: 0
 * })
 * console.log(record.status) // "pass"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RestorationAcceptanceRecord extends S.Class<RestorationAcceptanceRecord>($I`RestorationAcceptanceRecord`)(
  {
    evidenceSha256: Sha256Hex,
    elapsedMillis: NonNegativeInt,
    exceptionCount: NonNegativeInt,
    expectedTerminalCount: NonNegativeInt,
    family: RestorationFamily,
    inputBytes: NonNegativeInt,
    mailScope: S.optionalKey(MailRestorationScope),
    outputBytes: NonNegativeInt,
    outputTreeSha256: Sha256Hex,
    passCount: NonNegativeInt,
    preservationRunId: RunId,
    preservationSealSha256: Sha256Hex,
    recordedAt: RecordedAt,
    runLabel: RunLabel,
    schemaVersion: SchemaVersion,
    sourceCount: NonNegativeInt,
    status: S.Literal("pass"),
    terminalCount: NonNegativeInt,
    transformationRunId: S.optionalKey(RunId),
    unapprovedCount: S.Literal(0),
  },
  $I.annote("RestorationAcceptanceRecord", {
    description: "Separate immutable PASS record emitted only after one family ledger independently reconciles.",
  })
) {}

/**
 * Encode one reconciled acceptance record as JSON.
 *
 * **Example** (Encode preservation acceptance)
 *
 * ```ts
 * import { RestorationAcceptanceRecord, encodeRestorationAcceptanceRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt, Sha256Hex } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const digest = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * const row = RestorationAcceptanceRecord.make({
 *   evidenceSha256: digest,
 *   elapsedMillis: NonNegativeInt.make(1),
 *   exceptionCount: NonNegativeInt.make(0),
 *   expectedTerminalCount: NonNegativeInt.make(1),
 *   family: "preservation",
 *   inputBytes: NonNegativeInt.make(4),
 *   outputBytes: NonNegativeInt.make(4),
 *   outputTreeSha256: digest,
 *   passCount: NonNegativeInt.make(1),
 *   preservationRunId: "preservation-1",
 *   preservationSealSha256: digest,
 *   recordedAt: "2026-08-27T00:00:00.000Z",
 *   runLabel: "restoration-1",
 *   schemaVersion: "oppold-corpus-restoration/v1",
 *   sourceCount: NonNegativeInt.make(1),
 *   status: "pass",
 *   terminalCount: NonNegativeInt.make(1),
 *   unapprovedCount: 0
 * })
 * console.log(Effect.isEffect(encodeRestorationAcceptanceRecordJson(row))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeRestorationAcceptanceRecordJson = JsonStringCodec(RestorationAcceptanceRecord).encode;

/**
 * Decode one reconciled acceptance JSON object.
 *
 * **Example** (Decode an invalid acceptance safely)
 *
 * ```ts
 * import { decodeRestorationAcceptanceRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const decoded = decodeRestorationAcceptanceRecordJson("{}")
 * console.log(Effect.isEffect(decoded)) // true
 * ```
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

class FamilyRunStartRecord extends S.Class<FamilyRunStartRecord>($I`FamilyRunStartRecord`)(
  {
    ...TransformationEvidenceIdentity.fields,
    expectedCount: NonNegativeInt,
    family: TransformationFamily,
    mailScope: S.optionalKey(MailRestorationScope),
    maxTotalElapsedMillis: PosInt,
    maxTotalOutputBytes: PosInt,
    policySha256: Sha256Hex,
    recordType: S.Literal("family-run-start"),
  },
  $I.annote("FamilyRunStartRecord", {
    description:
      "Durable family clock, denominator, and resource contract reused unchanged by every restart of one transformation run.",
  })
) {}

class FamilyAttemptStartRecord extends S.Class<FamilyAttemptStartRecord>($I`FamilyAttemptStartRecord`)(
  {
    ...TransformationEvidenceIdentity.fields,
    attemptId: AttemptId,
    family: TransformationFamily,
    inputBytes: NonNegativeInt,
    mailScope: S.optionalKey(MailRestorationScope),
    recordType: S.Literal("family-attempt-start"),
    retryOrdinal: NonNegativeInt,
    sourceId: ObjectId,
    sourceSha256: Sha256Hex,
  },
  $I.annote("FamilyAttemptStartRecord", {
    description:
      "Durable source-bound checkpoint written before one transformation candidate may create retained output.",
  })
) {}

class FamilyAttemptInterruptedRecord extends S.Class<FamilyAttemptInterruptedRecord>(
  $I`FamilyAttemptInterruptedRecord`
)(
  {
    ...TransformationEvidenceIdentity.fields,
    attemptId: AttemptId,
    disposition: S.Literal("retained-for-retry"),
    family: TransformationFamily,
    mailScope: S.optionalKey(MailRestorationScope),
    recordType: S.Literal("family-attempt-interrupted"),
    retainedOutputBytes: NonNegativeInt,
    retainedOutputRelativePath: RelativePath,
    retainedOutputSha256: Sha256Hex,
    retryOrdinal: NonNegativeInt,
    sourceId: ObjectId,
  },
  $I.annote("FamilyAttemptInterruptedRecord", {
    description:
      "Immutable ownership row for canonical interrupted output retained before the same source is retried under a new attempt generation.",
  })
) {}

class MailStorePassRecord extends S.Class<MailStorePassRecord>($I`MailStorePassRecord`)(
  {
    ...TransformationEvidenceIdentity.fields,
    accountedChildCount: NonNegativeInt,
    attemptId: AttemptId,
    childCount: NonNegativeInt,
    elapsedMillis: NonNegativeInt,
    family: S.Literal("mail"),
    inputBytes: NonNegativeInt,
    mailScope: MailRestorationScope,
    objectId: ObjectId,
    outputBytes: NonNegativeInt,
    postProcessSha256: Sha256Hex,
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
    ...TransformationEvidenceIdentity.fields,
    approved: S.Boolean,
    attemptId: AttemptId,
    disposition: S.optionalKey(MailDisposition),
    exceptionKind: MailExceptionKind,
    family: S.Literal("mail"),
    mailScope: MailRestorationScope,
    message: S.NonEmptyString,
    objectId: ObjectId,
    recordType: S.Literal("mail-store-exception"),
    retainedOutputBytes: NonNegativeInt,
    retainedOutputSha256: Sha256Hex,
    sourceFamily: LiteralKit(["eml", "msg", "ost", "pst", "residue"]),
  },
  $I.annote("MailStoreExceptionRecord", {
    description:
      "Terminal mail-store exception with explicit approval state and a digest covering every retained partial and final output byte.",
  })
) {}

class MailWarningRecord extends S.Class<MailWarningRecord>($I`MailWarningRecord`)(
  {
    ...TransformationEvidenceIdentity.fields,
    attemptId: AttemptId,
    family: S.Literal("mail"),
    mailScope: MailRestorationScope,
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
    ...TransformationEvidenceIdentity.fields,
    attemptId: AttemptId,
    childRelativePath: RelativePath,
    engineReported: S.Boolean,
    family: S.Literal("mail"),
    mailScope: MailRestorationScope,
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
    ...TransformationEvidenceIdentity.fields,
    attemptId: AttemptId,
    detectedExtension: S.NonEmptyString,
    derivedSha256: S.optionalKey(Sha256Hex),
    derivedRelativePath: RelativePath,
    derivedSizeBytes: S.optionalKey(PosInt),
    family: S.Literal("mail"),
    mailScope: MailRestorationScope,
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
    ...TransformationEvidenceIdentity.fields,
    count: NonNegativeInt,
    family: S.Literal("recycle"),
    joinClass: RecycleJoinClass,
    recordType: S.Literal("recycle-join"),
    sourceObjectIds: S.Array(ObjectId),
    surfaceId: S.NonEmptyString,
  },
  $I.annote("RecycleJoinRecord", {
    description: "Aggregate four-class join count for one recycle volume surface.",
  })
) {}

class RecycleMappingRecord extends S.Class<RecycleMappingRecord>($I`RecycleMappingRecord`)(
  {
    ...TransformationEvidenceIdentity.fields,
    attemptId: AttemptId,
    contentObjectId: ObjectId,
    digest: Sha256Hex,
    family: S.Literal("recycle"),
    metadataObjectId: ObjectId,
    originalPath: S.NonEmptyString,
    recordType: S.Literal("recycle-mapping"),
    restoredRelativePath: RelativePath,
    surfaceId: S.NonEmptyString,
  },
  $I.annote("RecycleMappingRecord", {
    description: "Original path, content digest, restored path, occurrence, and volume identity mapping.",
  })
) {}

class LegacyWordPassRecord extends S.Class<LegacyWordPassRecord>($I`LegacyWordPassRecord`)(
  {
    ...TransformationEvidenceIdentity.fields,
    attemptId: AttemptId,
    convertedSha256: Sha256Hex,
    engineVersion: S.NonEmptyString,
    family: S.Literal("legacy-word"),
    normalizedTextSha256: Sha256Hex,
    originalSha256: Sha256Hex,
    postProcessOriginalSha256: Sha256Hex,
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
    ...TransformationEvidenceIdentity.fields,
    approved: S.Boolean,
    attemptId: AttemptId,
    exceptionKind: LiteralKit(["conversion-failed", "fidelity-failed", "not-binary-word"]),
    family: S.Literal("legacy-word"),
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
    ...TransformationEvidenceIdentity.fields,
    evidenceSha256: Sha256Hex,
    expectedCount: NonNegativeInt,
    family: TransformationFamily,
    mailScope: S.optionalKey(MailRestorationScope),
    maxTotalElapsedMillis: PosInt,
    maxTotalOutputBytes: PosInt,
    outputTreeSha256: Sha256Hex,
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
    ...TransformationEvidenceIdentity.fields,
    evidenceSha256: Sha256Hex,
    expectedCount: NonNegativeInt,
    family: TransformationFamily,
    mailScope: S.optionalKey(MailRestorationScope),
    maxTotalElapsedMillis: PosInt,
    maxTotalOutputBytes: PosInt,
    message: S.NonEmptyString,
    outputTreeSha256: Sha256Hex,
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
    ...TransformationEvidenceIdentity.fields,
    elapsedMillis: NonNegativeInt,
    exceptionCount: NonNegativeInt,
    family: TransformationFamily,
    inputBytes: NonNegativeInt,
    mailScope: S.optionalKey(MailRestorationScope),
    maxTotalElapsedMillis: PosInt,
    maxTotalOutputBytes: PosInt,
    outputTreeSha256: Sha256Hex,
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
 * Append-only checkpoint, terminal, or acceptance row for one transformation family.
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
  FamilyAttemptInterruptedRecord,
  FamilyAttemptStartRecord,
  FamilyRunStartRecord,
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
    description: "Schema-versioned start, interruption, terminal, mapping, and acceptance rows for bounded families.",
  })
);

/**
 * Decoded run-bound transformation ledger row.
 *
 * @see {@link TransformationLedgerRecord} for the tagged runtime schema and record cases.
 * @category models
 * @since 0.0.0
 */
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
