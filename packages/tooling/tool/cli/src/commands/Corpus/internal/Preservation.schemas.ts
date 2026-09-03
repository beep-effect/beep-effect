/**
 * Preservation-gate schema models for the T7 salvage archive operation.
 *
 * Models the restoration bar v2 contract from
 * `goals/oppold-corpus-salvage-restoration/SPEC.md`: one-pass
 * copy-while-hashing archive rows, truncate-and-resume-by-hash outcomes,
 * source-stability checks, the inherited-loss opening balance, capacity
 * preflight with an approved ceiling, and independent destination
 * verification. Ledger rows decode through these schemas only; the ledgers
 * themselves live outside the repo under the corpus home.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { EffectSchema, Fn, LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { CorpusProvenanceRecord } from "./Salvage.schemas.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/Preservation.schemas");

/**
 * Source class of one preserved T7 archive object.
 *
 * **Example** (Validate source classes)
 *
 * ```ts
 * import { PreservationSourceClass } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PreservationSourceClass)("salvage-tree")) // true
 * console.log(S.is(PreservationSourceClass)("root-archive-object")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PreservationSourceClass = LiteralKit(["salvage-tree", "root-archive-object"]).pipe(
  $I.annoteSchema("PreservationSourceClass", {
    title: "Preservation Source Class",
    description:
      "Whether an archive object comes from the salvage tree or is the verbatim root archive preserved as its own object.",
  })
);

/**
 * Source class type of one preserved T7 archive object.
 *
 * **Example** (Assign a typed source class)
 *
 * ```ts
 * import type { PreservationSourceClass } from "@beep/repo-cli/commands/Corpus"
 *
 * const sourceClass: PreservationSourceClass = "salvage-tree"
 * console.log(sourceClass) // "salvage-tree"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PreservationSourceClass = typeof PreservationSourceClass.Type;

/**
 * Occurrence identity of one archive object within the preservation scope.
 *
 * **Details**
 *
 * Occurrence identity is positional: source class plus source-root-relative
 * path plus the observed size and mtime. Content identity is the streaming
 * SHA-256 recorded by the attempt outcome; two occurrences may share content
 * while remaining distinct rows.
 *
 * **Example** (Build an object identity)
 *
 * ```ts
 * import { PreservationObjectIdentity } from "@beep/repo-cli/commands/Corpus"
 *
 * const object = PreservationObjectIdentity.make({
 *   mtimeEpoch: 1754784000000,
 *   mtimeIso: "2026-08-10T00:00:00Z",
 *   relativePath: "store-a/mailbox.pst",
 *   sizeBytes: 1024,
 *   sourceClass: "salvage-tree"
 * })
 * console.log(object.relativePath) // "store-a/mailbox.pst"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PreservationObjectIdentity extends S.Class<PreservationObjectIdentity>($I`PreservationObjectIdentity`)(
  {
    mtimeEpoch: S.Int,
    mtimeIso: S.NonEmptyString,
    relativePath: S.NonEmptyString,
    sizeBytes: NonNegativeInt,
    sourceClass: PreservationSourceClass,
  },
  $I.annote("PreservationObjectIdentity", {
    title: "Preservation Object Identity",
    description: "Occurrence identity of one T7 archive object: source class, relative path, size, and mtime.",
  })
) {}

/**
 * One size-and-mtime observation taken around a streaming copy.
 *
 * **Example** (Record a stability observation)
 *
 * ```ts
 * import { SourceStabilityObservation } from "@beep/repo-cli/commands/Corpus"
 *
 * const observed = SourceStabilityObservation.make({
 *   mtimeEpoch: 1754784000000,
 *   sizeBytes: 2048
 * })
 * console.log(observed.sizeBytes) // 2048
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceStabilityObservation extends S.Class<SourceStabilityObservation>($I`SourceStabilityObservation`)(
  {
    mtimeEpoch: S.Int,
    sizeBytes: NonNegativeInt,
  },
  $I.annote("SourceStabilityObservation", {
    title: "Source Stability Observation",
    description: "Size and mtime re-stat snapshot taken immediately before or after a streaming copy attempt.",
  })
) {}

/**
 * Result of incrementally hashing a file or file prefix.
 *
 * **Example** (Describe a streamed hash)
 *
 * ```ts
 * import { StreamingHashResult } from "@beep/repo-cli/commands/Corpus"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const result = StreamingHashResult.make({
 *   bytes: 0,
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * })
 * console.log(result.bytes) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StreamingHashResult extends S.Class<StreamingHashResult>($I`StreamingHashResult`)(
  {
    bytes: NonNegativeInt,
    sha256: Sha256Hex,
  },
  $I.annote("StreamingHashResult", {
    title: "Streaming Hash Result",
    description: "SHA-256 digest and byte count produced without materializing the complete file in memory.",
  })
) {}

class CopiedOutcome extends S.Class<CopiedOutcome>($I`CopiedOutcome`)(
  {
    kind: S.tag("copied"),
    bytesCopied: NonNegativeInt,
    sha256: Sha256Hex,
    statAfter: SourceStabilityObservation,
    statBefore: SourceStabilityObservation,
  },
  $I.annote("CopiedOutcome", {
    description: "A fresh full copy streamed once while hashing, with matching pre and post source stats.",
  })
) {}

class ResumeCompletedOutcome extends S.Class<ResumeCompletedOutcome>($I`ResumeCompletedOutcome`)(
  {
    kind: S.tag("resume-completed"),
    bytesCopied: NonNegativeInt,
    bytesReused: NonNegativeInt,
    sha256: Sha256Hex,
    statAfter: SourceStabilityObservation,
    statBefore: SourceStabilityObservation,
  },
  $I.annote("ResumeCompletedOutcome", {
    description:
      "An existing partial destination whose bytes re-hashed as a valid prefix and whose remainder streamed to completion.",
  })
) {}

class AlreadyCompleteOutcome extends S.Class<AlreadyCompleteOutcome>($I`AlreadyCompleteOutcome`)(
  {
    kind: S.tag("already-complete"),
    bytesReused: NonNegativeInt,
    sha256: Sha256Hex,
    statAfter: SourceStabilityObservation,
    statBefore: SourceStabilityObservation,
  },
  $I.annote("AlreadyCompleteOutcome", {
    description:
      "An existing full-length destination whose digest matched two stable source reads bracketed by source stats.",
  })
) {}

class ResumeDiscardedOutcome extends S.Class<ResumeDiscardedOutcome>($I`ResumeDiscardedOutcome`)(
  {
    kind: S.tag("resume-discarded"),
    bytesDiscarded: NonNegativeInt,
  },
  $I.annote("ResumeDiscardedOutcome", {
    description:
      "Existing destination bytes failed the prefix re-hash and were truncated to zero; a fresh attempt follows. Never terminal.",
  })
) {}

class ChangedDuringCopyOutcome extends S.Class<ChangedDuringCopyOutcome>($I`ChangedDuringCopyOutcome`)(
  {
    kind: S.tag("changed-during-copy"),
    statAfter: SourceStabilityObservation,
    statBefore: SourceStabilityObservation,
  },
  $I.annote("ChangedDuringCopyOutcome", {
    description:
      "The pre/post re-stat pair diverged around the copy; the attempt is terminal and the object is re-copied from its stable state. Never a PASS row.",
  })
) {}

class UnreadableOutcome extends S.Class<UnreadableOutcome>($I`UnreadableOutcome`)(
  {
    kind: S.tag("unreadable"),
    message: S.NonEmptyString,
  },
  $I.annote("UnreadableOutcome", {
    description: "The source could not be read; carries the platform error text with no corpus content.",
  })
) {}

/**
 * Attempt-outcome kinds recorded by the preservation archive runner.
 *
 * **Example** (Enumerate outcome kinds)
 *
 * ```ts
 * import { PreservationAttemptKind } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(PreservationAttemptKind.Options.length) // 6
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PreservationAttemptKind = LiteralKit([
  "copied",
  "resume-completed",
  "already-complete",
  "resume-discarded",
  "changed-during-copy",
  "unreadable",
]).pipe(
  $I.annoteSchema("PreservationAttemptKind", {
    title: "Preservation Attempt Kind",
    description: "Discriminator domain for one archive attempt outcome.",
  })
);

/**
 * Attempt-outcome kind type recorded by the preservation archive runner.
 *
 * **Example** (Assign a typed kind)
 *
 * ```ts
 * import type { PreservationAttemptKind } from "@beep/repo-cli/commands/Corpus"
 *
 * const kind: PreservationAttemptKind = "copied"
 * console.log(kind) // "copied"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PreservationAttemptKind = typeof PreservationAttemptKind.Type;

/**
 * Kinds that satisfy the preservation gate as approved terminal rows.
 *
 * **Details**
 *
 * `resume-discarded` is transient and `changed-during-copy`/`unreadable` are
 * unapproved terminals: any manifest whose final row for an object falls
 * outside this domain trips the packet stop condition.
 *
 * **Example** (Check an approved terminal kind)
 *
 * ```ts
 * import { PreservationPassKind } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PreservationPassKind)("copied")) // true
 * console.log(S.is(PreservationPassKind)("unreadable")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PreservationPassKind = LiteralKit(
  PreservationAttemptKind.pickOptions(["copied", "resume-completed", "already-complete"])
).pipe(
  $I.annoteSchema("PreservationPassKind", {
    title: "Preservation Pass Kind",
    description: "Attempt kinds that may stand as approved terminal manifest rows.",
  })
);

/**
 * Approved terminal kind type for preservation manifest rows.
 *
 * **Example** (Assign a typed pass kind)
 *
 * ```ts
 * import type { PreservationPassKind } from "@beep/repo-cli/commands/Corpus"
 *
 * const kind: PreservationPassKind = "already-complete"
 * console.log(kind) // "already-complete"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PreservationPassKind = typeof PreservationPassKind.Type;

/**
 * Outcome of one streaming archive attempt.
 *
 * **Example** (Construct a copied outcome)
 *
 * ```ts
 * import { PreservationAttemptOutcome } from "@beep/repo-cli/commands/Corpus"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const outcome = PreservationAttemptOutcome.cases["copied"].make({
 *   kind: "copied",
 *   bytesCopied: 2048,
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   statAfter: { mtimeEpoch: 1754784000000, sizeBytes: 2048 },
 *   statBefore: { mtimeEpoch: 1754784000000, sizeBytes: 2048 }
 * })
 * console.log(outcome.kind) // "copied"
 * ```
 *
 * @returns A tagged-union schema whose constructors and matcher cover every archive-attempt outcome.
 * @category schemas
 * @since 0.0.0
 */
export const PreservationAttemptOutcome = PreservationAttemptKind.mapMembers(
  Tuple.evolve([
    () => CopiedOutcome,
    () => ResumeCompletedOutcome,
    () => AlreadyCompleteOutcome,
    () => ResumeDiscardedOutcome,
    () => ChangedDuringCopyOutcome,
    () => UnreadableOutcome,
  ])
)
  .annotate(
    $I.annote("PreservationAttemptOutcome", {
      description: "Exhaustive outcomes of one copy-while-hashing archive attempt under restoration bar v2.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

/**
 * Decoded outcome of one streaming archive attempt.
 *
 * **Example** (Branch on an outcome kind)
 *
 * ```ts
 * import type { PreservationAttemptOutcome } from "@beep/repo-cli/commands/Corpus"
 *
 * const describe = (outcome: PreservationAttemptOutcome) => outcome.kind
 * console.log(typeof describe) // "function"
 * ```
 *
 * @see {@link PreservationAttemptOutcome} for variants.
 * @category type-level
 * @since 0.0.0
 */
export type PreservationAttemptOutcome = typeof PreservationAttemptOutcome.Type;

/**
 * One append-only manifest row for one archive attempt over one object.
 *
 * **Details**
 *
 * Rows append per attempt; the manifest's final row per occurrence identity is
 * that object's terminal row. `destRelativePath` is relative to the archive
 * home so the ledger never carries a machine-absolute path. A PASS row may be
 * appended only after payload, manifest, rename, and parent-directory fsync.
 *
 * **Example** (Build a manifest row)
 *
 * ```ts
 * import { PreservationManifestRow } from "@beep/repo-cli/commands/Corpus"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const row = PreservationManifestRow.make({
 *   archivedAt: "2026-08-27T00:00:00Z",
 *   attempt: 1,
 *   destRelativePath: "store-a/mailbox.pst",
 *   object: {
 *     mtimeEpoch: 1754784000000,
 *     mtimeIso: "2026-08-10T00:00:00Z",
 *     relativePath: "store-a/mailbox.pst",
 *     sizeBytes: 2048,
 *     sourceClass: "salvage-tree"
 *   },
 *   outcome: {
 *     kind: "already-complete",
 *     bytesReused: 2048,
 *     sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *     statAfter: { mtimeEpoch: 1754784000000, sizeBytes: 2048 },
 *     statBefore: { mtimeEpoch: 1754784000000, sizeBytes: 2048 }
 *   }
 * })
 * console.log(row.outcome.kind) // "already-complete"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PreservationManifestRow extends S.Class<PreservationManifestRow>($I`PreservationManifestRow`)(
  {
    archivedAt: S.NonEmptyString,
    attempt: NonNegativeInt,
    destRelativePath: S.NonEmptyString,
    object: PreservationObjectIdentity,
    outcome: PreservationAttemptOutcome,
  },
  $I.annote("PreservationManifestRow", {
    title: "Preservation Manifest Row",
    description: "Append-only destination-manifest row for one archive attempt over one T7 object.",
  })
) {}

/**
 * JSONL codec for {@link PreservationManifestRow}.
 *
 * **Example** (Round-trip one manifest line)
 *
 * ```ts
 * import { PreservationManifestRowJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof PreservationManifestRowJson.decode) // "function"
 * console.log(typeof PreservationManifestRowJson.encode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const PreservationManifestRowJson = JsonStringCodec(PreservationManifestRow);

/**
 * Ratified inherited-loss opening classes for the T7 preservation ledger.
 *
 * **Example** (Validate a loss class)
 *
 * ```ts
 * import { InheritedLossClass } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(InheritedLossClass)("collector-error")) // true
 * console.log(S.is(InheritedLossClass)("new-loss")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InheritedLossClass = LiteralKit([
  "collector-error",
  "deliberate-exclusion",
  "exfat-stripped-metadata",
  "missing-recycle-r-record",
  "mutated-e-tree-destination",
]).pipe(
  $I.annoteSchema("InheritedLossClass", {
    title: "Inherited Loss Class",
    description:
      "Ratified opening-balance loss classes inherited from the collector run; the preservation gate records them without claiming recovery.",
  })
);

/**
 * Inherited-loss class type for the T7 preservation ledger.
 *
 * **Example** (Assign a typed loss class)
 *
 * ```ts
 * import type { InheritedLossClass } from "@beep/repo-cli/commands/Corpus"
 *
 * const lossClass: InheritedLossClass = "exfat-stripped-metadata"
 * console.log(lossClass) // "exfat-stripped-metadata"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type InheritedLossClass = typeof InheritedLossClass.Type;

/**
 * One inherited-loss opening-balance row.
 *
 * **Example** (Seed a loss row)
 *
 * ```ts
 * import { InheritedLossRow } from "@beep/repo-cli/commands/Corpus"
 *
 * const row = InheritedLossRow.make({
 *   count: 13,
 *   evidenceRef: "collector-report#missing-r-records",
 *   lossClass: "missing-recycle-r-record"
 * })
 * console.log(row.count) // 13
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InheritedLossRow extends S.Class<InheritedLossRow>($I`InheritedLossRow`)(
  {
    count: NonNegativeInt,
    evidenceRef: S.NonEmptyString,
    lossClass: InheritedLossClass,
    note: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("InheritedLossRow", {
    title: "Inherited Loss Row",
    description:
      "Aggregate opening-balance entry for one inherited loss class, referencing out-of-repo evidence without corpus content.",
  })
) {}

/**
 * Measured capacity facts gathered before the archive run.
 *
 * **Example** (Record a measurement)
 *
 * ```ts
 * import { CapacityMeasurement } from "@beep/repo-cli/commands/Corpus"
 *
 * const measurement = CapacityMeasurement.make({
 *   destFreeBytes: 2200000000000,
 *   measuredAt: "2026-08-27T00:00:00Z",
 *   objectCount: 12157,
 *   requiredBytes: 358000000000,
 *   sourceRoot: "/media/t7",
 *   sourceBytes: 357000000000
 * })
 * console.log(measurement.objectCount) // 12157
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapacityMeasurement extends S.Class<CapacityMeasurement>($I`CapacityMeasurement`)(
  {
    destFreeBytes: NonNegativeInt,
    measuredAt: S.NonEmptyString,
    objectCount: NonNegativeInt,
    requiredBytes: NonNegativeInt,
    sourceRoot: S.NonEmptyString,
    sourceBytes: NonNegativeInt,
  },
  $I.annote("CapacityMeasurement", {
    title: "Capacity Measurement",
    description:
      "Canonical source identity, object count, and byte totals measured against destination free space before the archive run.",
  })
) {}

/**
 * Paths supplied to the archive writer's post-payload-sync hook.
 *
 * **Example** (Inspect hook paths)
 *
 * ```ts
 * import { ArchiveWriterPayloadSyncHookInput } from "@beep/repo-cli/commands/Corpus"
 *
 * const input = ArchiveWriterPayloadSyncHookInput.make({
 *   partialAbs: "/tmp/archive.bin.preservation-partial",
 *   sourceAbs: "/tmp/source.bin"
 * })
 * console.log(input.sourceAbs) // "/tmp/source.bin"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchiveWriterPayloadSyncHookInput extends S.Class<ArchiveWriterPayloadSyncHookInput>(
  $I`ArchiveWriterPayloadSyncHookInput`
)(
  {
    partialAbs: S.NonEmptyString,
    sourceAbs: S.NonEmptyString,
  },
  $I.annote("ArchiveWriterPayloadSyncHookInput", {
    title: "Archive Writer Payload Sync Hook Input",
    description: "Source and staged-destination paths observed after payload sync and before source re-stat.",
  })
) {}

/**
 * Optional fault-injection contract for constructing an archive-writer layer.
 *
 * **Example** (Construct writer options)
 *
 * ```ts
 * import { ArchiveWriterLiveOptions } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const options = ArchiveWriterLiveOptions.make({
 *   afterPayloadSync: () => Effect.void
 * })
 * console.log(options.afterPayloadSync !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchiveWriterLiveOptions extends S.Class<ArchiveWriterLiveOptions>($I`ArchiveWriterLiveOptions`)(
  {
    afterPayloadSync: Fn({
      input: ArchiveWriterPayloadSyncHookInput,
      output: EffectSchema<void, never, never>(),
    }).pipe(S.optionalKey),
  },
  $I.annote("ArchiveWriterLiveOptions", {
    title: "Archive Writer Live Options",
    description: "Schema-backed test hook invoked between staged payload sync and the source stability re-stat.",
  })
) {}

/**
 * Roots supplied to the T7 preservation commands.
 *
 * **Example** (Configure synthetic roots)
 *
 * ```ts
 * import { T7PreservationOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = T7PreservationOptions.make({ corpusRoot: "/tmp/archive", t7Root: "/tmp/source" })
 * console.log(options.t7Root) // "/tmp/source"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class T7PreservationOptions extends S.Class<T7PreservationOptions>($I`T7PreservationOptions`)(
  {
    corpusRoot: S.NonEmptyString,
    t7Root: S.NonEmptyString,
  },
  $I.annote("T7PreservationOptions", {
    title: "T7 Preservation Options",
    description: "Out-of-repo corpus archive home and removable-drive root used by a preservation operation.",
  })
) {}

class PreflightProposed extends S.Class<PreflightProposed>($I`PreflightProposed`)(
  {
    kind: S.tag("proposed"),
    measurement: CapacityMeasurement,
  },
  $I.annote("PreflightProposed", {
    description: "A capacity preflight awaiting an approved ceiling; the archive runner refuses this state.",
  })
) {}

class PreflightApproved extends S.Class<PreflightApproved>($I`PreflightApproved`)(
  {
    kind: S.tag("approved"),
    approvedAt: S.NonEmptyString,
    approvedBy: S.NonEmptyString,
    ceilingBytes: NonNegativeInt,
    measurement: CapacityMeasurement,
  },
  $I.annote("PreflightApproved", {
    description: "An operator-approved disk ceiling over a recorded measurement; required before any archive run.",
  })
) {}

const CapacityPreflightKind = LiteralKit(["proposed", "approved"]);

/**
 * Capacity preflight state recorded before the archive run.
 *
 * **Example** (Construct an approved preflight)
 *
 * ```ts
 * import { CapacityPreflight } from "@beep/repo-cli/commands/Corpus"
 *
 * const preflight = CapacityPreflight.cases["approved"].make({
 *   kind: "approved",
 *   approvedAt: "2026-08-27T00:00:00Z",
 *   approvedBy: "operator",
 *   ceilingBytes: 400000000000,
 *   measurement: {
 *     destFreeBytes: 2200000000000,
 *     measuredAt: "2026-08-27T00:00:00Z",
 *     objectCount: 12157,
 *     requiredBytes: 358000000000,
 *     sourceRoot: "/media/t7",
 *     sourceBytes: 357000000000
 *   }
 * })
 * console.log(preflight.kind) // "approved"
 * ```
 *
 * @returns A tagged-union schema for proposed and operator-approved capacity states.
 * @category schemas
 * @since 0.0.0
 */
export const CapacityPreflight = CapacityPreflightKind.mapMembers(
  Tuple.evolve([() => PreflightProposed, () => PreflightApproved])
)
  .annotate(
    $I.annote("CapacityPreflight", {
      description: "Two-state capacity preflight: measured-and-proposed, or approved with an explicit disk ceiling.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

/**
 * Decoded capacity preflight state.
 *
 * **Example** (Branch on preflight state)
 *
 * ```ts
 * import type { CapacityPreflight } from "@beep/repo-cli/commands/Corpus"
 *
 * const state = (preflight: CapacityPreflight) => preflight.kind
 * console.log(typeof state) // "function"
 * ```
 *
 * @see {@link CapacityPreflight} for variants.
 * @category type-level
 * @since 0.0.0
 */
export type CapacityPreflight = typeof CapacityPreflight.Type;

/**
 * JSON codec for persisted capacity preflight state.
 *
 * **Example** (Inspect the codec)
 *
 * ```ts
 * import { CapacityPreflightJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof CapacityPreflightJson.decode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CapacityPreflightJson = JsonStringCodec(CapacityPreflight);

/**
 * Aggregate outcome of a preservation archive run.
 *
 * **Example** (Describe an empty run)
 *
 * ```ts
 * import { PreservationRunSummary } from "@beep/repo-cli/commands/Corpus"
 *
 * const summary = PreservationRunSummary.make({ attempted: 0, passed: 0, unapproved: 0 })
 * console.log(summary.passed) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PreservationRunSummary extends S.Class<PreservationRunSummary>($I`PreservationRunSummary`)(
  {
    attempted: NonNegativeInt,
    passed: NonNegativeInt,
    unapproved: NonNegativeInt,
  },
  $I.annote("PreservationRunSummary", {
    title: "Preservation Run Summary",
    description: "Attempt, approved-terminal, and unapproved-terminal counts from one preservation run.",
  })
) {}

class VerifiedOutcome extends S.Class<VerifiedOutcome>($I`VerifiedOutcome`)(
  {
    kind: S.tag("verified"),
    sha256: Sha256Hex,
  },
  $I.annote("VerifiedOutcome", {
    description: "Destination bytes re-hashed to the manifest digest in a fresh process.",
  })
) {}

class MissingDestinationOutcome extends S.Class<MissingDestinationOutcome>($I`MissingDestinationOutcome`)(
  {
    kind: S.tag("missing-destination"),
  },
  $I.annote("MissingDestinationOutcome", {
    description: "A terminal manifest row references a destination that does not exist.",
  })
) {}

class SizeMismatchOutcome extends S.Class<SizeMismatchOutcome>($I`SizeMismatchOutcome`)(
  {
    kind: S.tag("size-mismatch"),
    actualBytes: NonNegativeInt,
    expectedBytes: NonNegativeInt,
  },
  $I.annote("SizeMismatchOutcome", {
    description: "Destination length diverged from the manifest row before hashing.",
  })
) {}

class HashMismatchOutcome extends S.Class<HashMismatchOutcome>($I`HashMismatchOutcome`)(
  {
    kind: S.tag("hash-mismatch"),
    actualSha256: Sha256Hex,
    expectedSha256: Sha256Hex,
  },
  $I.annote("HashMismatchOutcome", {
    description: "Destination bytes re-hashed to a different digest than the manifest row.",
  })
) {}

const VerificationOutcomeKind = LiteralKit(["verified", "missing-destination", "size-mismatch", "hash-mismatch"]);

/**
 * Outcome of independently re-verifying one terminal manifest row.
 *
 * **Example** (Construct a verified outcome)
 *
 * ```ts
 * import { PreservationVerificationOutcome } from "@beep/repo-cli/commands/Corpus"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const outcome = PreservationVerificationOutcome.cases["verified"].make({
 *   kind: "verified",
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * })
 * console.log(outcome.kind) // "verified"
 * ```
 *
 * @returns A tagged-union schema covering every independent destination-verification outcome.
 * @category schemas
 * @since 0.0.0
 */
export const PreservationVerificationOutcome = VerificationOutcomeKind.mapMembers(
  Tuple.evolve([
    () => VerifiedOutcome,
    () => MissingDestinationOutcome,
    () => SizeMismatchOutcome,
    () => HashMismatchOutcome,
  ])
)
  .annotate(
    $I.annote("PreservationVerificationOutcome", {
      description: "Exhaustive fresh-process verification outcomes for one terminal destination-manifest row.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

/**
 * Decoded verification outcome for one terminal manifest row.
 *
 * **Example** (Branch on a verification outcome)
 *
 * ```ts
 * import type { PreservationVerificationOutcome } from "@beep/repo-cli/commands/Corpus"
 *
 * const describe = (outcome: PreservationVerificationOutcome) => outcome.kind
 * console.log(typeof describe) // "function"
 * ```
 *
 * @see {@link PreservationVerificationOutcome} for variants.
 * @category type-level
 * @since 0.0.0
 */
export type PreservationVerificationOutcome = typeof PreservationVerificationOutcome.Type;

/**
 * One fresh-process verification row for one terminal manifest row.
 *
 * **Example** (Build a verification row)
 *
 * ```ts
 * import { PreservationVerificationRow } from "@beep/repo-cli/commands/Corpus"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const row = PreservationVerificationRow.make({
 *   destRelativePath: "store-a/mailbox.pst",
 *   object: {
 *     mtimeEpoch: 1754784000000,
 *     mtimeIso: "2026-08-10T00:00:00Z",
 *     relativePath: "store-a/mailbox.pst",
 *     sizeBytes: 2048,
 *     sourceClass: "salvage-tree"
 *   },
 *   outcome: {
 *     kind: "verified",
 *     sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   },
 *   verifiedAt: "2026-08-27T00:00:00Z"
 * })
 * console.log(row.outcome.kind) // "verified"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PreservationVerificationRow extends S.Class<PreservationVerificationRow>($I`PreservationVerificationRow`)(
  {
    destRelativePath: S.NonEmptyString,
    object: PreservationObjectIdentity,
    outcome: PreservationVerificationOutcome,
    verifiedAt: S.NonEmptyString,
  },
  $I.annote("PreservationVerificationRow", {
    title: "Preservation Verification Row",
    description: "Independent re-verification result for one terminal destination-manifest row.",
  })
) {}

/**
 * Aggregate result of one independent verification pass.
 *
 * **Example** (Summarize a verification pass)
 *
 * ```ts
 * import { PreservationVerificationSummary } from "@beep/repo-cli/commands/Corpus"
 *
 * const summary = PreservationVerificationSummary.make({
 *   bytesVerified: 357000000000,
 *   hashMismatched: 0,
 *   missing: 0,
 *   rowsChecked: 12157,
 *   sizeMismatched: 0,
 *   verified: 12157
 * })
 * console.log(summary.verified === summary.rowsChecked) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PreservationVerificationSummary extends S.Class<PreservationVerificationSummary>(
  $I`PreservationVerificationSummary`
)(
  {
    bytesVerified: NonNegativeInt,
    hashMismatched: NonNegativeInt,
    missing: NonNegativeInt,
    rowsChecked: NonNegativeInt,
    sizeMismatched: NonNegativeInt,
    verified: NonNegativeInt,
  },
  $I.annote("PreservationVerificationSummary", {
    title: "Preservation Verification Summary",
    description: "Aggregate counts for one fresh-process verification pass over the destination manifest.",
  })
) {}

/**
 * Rows and aggregate counts returned by an independent verification pass.
 *
 * **Example** (Describe an empty report)
 *
 * ```ts
 * import { PreservationVerificationReport } from "@beep/repo-cli/commands/Corpus"
 *
 * const report = PreservationVerificationReport.make({
 *   rows: [],
 *   summary: { bytesVerified: 0, hashMismatched: 0, missing: 0, rowsChecked: 0, sizeMismatched: 0, verified: 0 }
 * })
 * console.log(report.rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PreservationVerificationReport extends S.Class<PreservationVerificationReport>(
  $I`PreservationVerificationReport`
)(
  {
    rows: S.Array(PreservationVerificationRow),
    summary: PreservationVerificationSummary,
  },
  $I.annote("PreservationVerificationReport", {
    title: "Preservation Verification Report",
    description: "Per-object verification rows paired with their aggregate preservation summary.",
  })
) {}

/**
 * Preservation-era record appended to the shared corpus provenance ledger.
 *
 * **Details**
 *
 * The out-of-repo provenance ledger already holds untagged salvage rows; this
 * record carries a `record` discriminator so both generations decode from one
 * ledger. Destination identity is archive-home relative, never
 * machine-absolute.
 *
 * **Example** (Build a ledger record)
 *
 * ```ts
 * import { T7ArchiveProvenanceRecord } from "@beep/repo-cli/commands/Corpus"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const record = T7ArchiveProvenanceRecord.make({
 *   record: "t7-archive/v1",
 *   archivedAt: "2026-08-27T00:00:00Z",
 *   destRelativePath: "store-a/mailbox.pst",
 *   mtimeEpoch: 1754784000000,
 *   mtimeIso: "2026-08-10T00:00:00Z",
 *   relativePath: "store-a/mailbox.pst",
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   sizeBytes: 2048,
 *   sourceClass: "salvage-tree"
 * })
 * console.log(record.record) // "t7-archive/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class T7ArchiveProvenanceRecord extends S.Class<T7ArchiveProvenanceRecord>($I`T7ArchiveProvenanceRecord`)(
  {
    record: S.tag("t7-archive/v1"),
    archivedAt: S.NonEmptyString,
    destRelativePath: S.NonEmptyString,
    mtimeEpoch: S.Int,
    mtimeIso: S.NonEmptyString,
    relativePath: S.NonEmptyString,
    sha256: Sha256Hex,
    sizeBytes: NonNegativeInt,
    sourceClass: PreservationSourceClass,
  },
  $I.annote("T7ArchiveProvenanceRecord", {
    title: "T7 Archive Provenance Record",
    description:
      "Tagged provenance-ledger row for one verified T7 archive object, appended beside untagged legacy salvage rows.",
  })
) {}

/**
 * Union of every record generation in the corpus provenance ledger.
 *
 * **Example** (Inspect the ledger union)
 *
 * ```ts
 * import { CorpusLedgerRecord } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorpusLedgerRecord)({ nope: true })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorpusLedgerRecord = S.Union([T7ArchiveProvenanceRecord, CorpusProvenanceRecord]).pipe(
  $I.annoteSchema("CorpusLedgerRecord", {
    title: "Corpus Ledger Record",
    description:
      "One line of the shared corpus provenance ledger: a tagged T7 archive record or an untagged legacy salvage record.",
  })
);

/**
 * Decoded corpus provenance ledger record.
 *
 * **Example** (Accept either ledger generation)
 *
 * ```ts
 * import type { CorpusLedgerRecord } from "@beep/repo-cli/commands/Corpus"
 *
 * const relativePath = (record: CorpusLedgerRecord) => record.relativePath
 * console.log(typeof relativePath) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CorpusLedgerRecord = typeof CorpusLedgerRecord.Type;

/**
 * JSONL codec for {@link CorpusLedgerRecord}.
 *
 * **Example** (Decode one ledger line)
 *
 * ```ts
 * import { CorpusLedgerRecordJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof CorpusLedgerRecordJson.decode) // "function"
 * console.log(typeof CorpusLedgerRecordJson.decodeOption) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CorpusLedgerRecordJson = JsonStringCodec(CorpusLedgerRecord);
