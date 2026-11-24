/**
 * Enumerate-before-read and final coverage-attestation contracts for telemetry-v2 ingest.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { PosInt } from "./internal/PosInt.ts";
import { AiMetricsTranscriptSource } from "./models.ts";
import { combineOipTaints, EvidenceTier, OipTaint, SkipReason, weakestEvidenceTier } from "./telemetry-v2.ts";

const $I = $RepoAiMetricsId.create("ingest-manifest");
const ingestEnumerationSchemaVersion = "telemetry-v2/ingest-enumeration/v1";
const ingestManifestSchemaVersion = "telemetry-v2/ingest-manifest/v1";

/**
 * Kind of content-addressed subject included in an ingest denominator.
 *
 * **Example** (Enumerate a source instance before reading transcripts)
 *
 * ```ts
 * import { IngestSubjectKind } from "@beep/repo-ai-metrics"
 *
 * console.log(IngestSubjectKind.Enum["source-instance"]) // "source-instance"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const IngestSubjectKind = LiteralKit([
  "canonical-root",
  "source-instance",
  "session-directory",
  "transcript",
]).pipe(
  $I.annoteSchema("IngestSubjectKind", {
    description: "Granularity of a hash-only subject enumerated for one telemetry-v2 ingest run.",
  })
);

/**
 * @see {@link IngestSubjectKind} for the runtime schema.
 * @category models
 * @since 0.0.0
 */
export type IngestSubjectKind = typeof IngestSubjectKind.Type;

/**
 * One content-addressed subject in an ingest denominator.
 *
 * **Example** (Reference one registry source instance)
 *
 * ```ts
 * import { IngestSubject } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const subject = S.decodeUnknownSync(IngestSubject)({
 *   subjectId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *   rootId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
 *   sourceKind: "codex",
 *   subjectKind: "source-instance",
 *   evidenceTier: "derived",
 *   oipTaint: "unknown"
 * })
 * console.log(subject.sourceKind) // "codex"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IngestSubject extends S.Opaque<IngestSubject, { readonly brand: unique symbol }>()(
  S.Struct({
    subjectId: Sha256Hex,
    rootId: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    subjectKind: IngestSubjectKind,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  }).pipe(
    $I.annoteSchema("IngestSubject", {
      description: "Hash-only root and source identity for one subject in an ingest denominator.",
    })
  )
) {}

const hasUniqueSubjectIds = (subjects: ReadonlyArray<IngestSubject>): boolean =>
  A.length(A.dedupe(A.map(subjects, (subject) => subject.subjectId))) === A.length(subjects);

/**
 * Initial denominator durably emitted before an ingest opens source content.
 *
 * **Details**
 *
 * This is a distinct wire contract from {@link IngestManifest}. The later
 * service writes it first, then finalizes a manifest carrying the same run and
 * enumeration identifiers. A post-hoc success list therefore cannot masquerade
 * as an enumerate-before-read attestation.
 *
 * **Example** (Create an empty but explicit denominator)
 *
 * ```ts
 * import { IngestEnumeration } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const enumeration = S.decodeUnknownSync(IngestEnumeration)({
 *   schemaVersion: "telemetry-v2/ingest-enumeration/v1",
 *   enumerationId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *   ingestRunId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
 *   enumeratedAt: "2026-09-03T12:00:00.000Z",
 *   identityNamespaceId: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
 *   configFingerprint: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
 *   configEvidenceTier: "observed",
 *   inventoryEvidenceDigest: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
 *   subjects: [],
 *   enumeratedCount: 0,
 *   evidenceTier: "observed",
 *   oipTaint: "clear"
 * })
 * console.log(enumeration.enumeratedCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IngestEnumeration extends S.Opaque<IngestEnumeration, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag(ingestEnumerationSchemaVersion),
    enumerationId: Sha256Hex,
    ingestRunId: Sha256Hex,
    enumeratedAt: S.DateTimeUtcFromString,
    identityNamespaceId: Sha256Hex,
    configFingerprint: Sha256Hex,
    configEvidenceTier: EvidenceTier,
    inventoryEvidenceDigest: Sha256Hex,
    subjects: S.Array(IngestSubject),
    enumeratedCount: S.Natural,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  })
    .check(
      S.makeFilterGroup(
        [
          S.makeFilter((input) => input.enumeratedCount === A.length(input.subjects), {
            identifier: "IngestEnumerationCountInvariant",
            title: "Ingest-enumeration count invariant",
            description: "Requires the persisted denominator count to equal its complete subject list.",
            message: "Expected enumeratedCount to equal the number of subjects",
          }),
          S.makeFilter((input) => hasUniqueSubjectIds(input.subjects), {
            identifier: "IngestEnumerationIdentityInvariant",
            title: "Ingest-enumeration identity invariant",
            description: "Requires every enumerated subject identity to appear exactly once.",
            message: "Expected every enumerated subjectId to be unique",
          }),
          S.makeFilter(
            (input) =>
              input.evidenceTier ===
              weakestEvidenceTier([
                input.configEvidenceTier,
                ...A.map(input.subjects, (subject) => subject.evidenceTier),
              ]),
            {
              identifier: "IngestEnumerationEvidenceTierInvariant",
              title: "Ingest-enumeration evidence-tier invariant",
              description: "Requires the denominator to inherit its weakest configuration or subject evidence tier.",
              message: "Expected evidenceTier to equal the weakest denominator input tier",
            }
          ),
          S.makeFilter(
            (input) => input.oipTaint === combineOipTaints(A.map(input.subjects, (subject) => subject.oipTaint)),
            {
              identifier: "IngestEnumerationOipTaintInvariant",
              title: "Ingest-enumeration OIP taint invariant",
              description: "Requires the denominator to retain the most restrictive source-subject OIP taint.",
              message: "Expected oipTaint to preserve the most restrictive subject taint",
            }
          ),
        ],
        {
          identifier: "IngestEnumerationInvariants",
          title: "Ingest-enumeration invariants",
          description: "Checks denominator completeness, uniqueness, evidence tier, and OIP taint.",
        }
      )
    )
    .pipe(
      $I.annoteSchema("IngestEnumeration", {
        description: "Content-addressed pre-read denominator for one telemetry-v2 ingest run.",
      })
    )
) {
  static readonly decodeEffect = S.decodeUnknownEffect(IngestEnumeration);
  static readonly encodeEffect = S.encodeUnknownEffect(IngestEnumeration);
  static readonly decodeResult = S.decodeUnknownResult(IngestEnumeration);
  static readonly encodeResult = S.encodeResult(IngestEnumeration);
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(IngestEnumeration));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(IngestEnumeration));
}

const IngestDispositionStatus = LiteralKit(["read", "tombstoned", "unreachable", "skipped", "unemittable"]);
const IngestUnreachableReason = LiteralKit([
  "not-found",
  "permission-denied",
  "io-failure",
  "invalid-source",
  "unknown",
]);
const IngestUnemittableReason = LiteralKit([
  "unsupported-brand",
  "emitter-not-installed",
  "emitter-version-incompatible",
]);

/**
 * **Example** (Account for a transcript that was read)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { IngestDisposition, ReadIngestDisposition } from "@beep/repo-ai-metrics/ingest-manifest"
 *
 * const subject = { subjectId: "a".repeat(64), rootId: "b".repeat(64), sourceKind: "codex", subjectKind: "transcript", evidenceTier: "observed", oipTaint: "clear" }
 * const read = S.decodeUnknownSync(ReadIngestDisposition)({
 *   status: "read",
 *   subject,
 *   recordCount: 37,
 *   evidenceDigest: "c".repeat(64),
 *   evidenceTier: "observed"
 * })
 *
 * console.log(read.recordCount) // => 37
 * console.log(S.is(IngestDisposition)(read)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReadIngestDisposition extends S.Opaque<ReadIngestDisposition, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(IngestDispositionStatus.Enum.read),
    subject: IngestSubject,
    recordCount: PosInt,
    evidenceDigest: Sha256Hex,
    evidenceTier: EvidenceTier,
  }).pipe(
    $I.annoteSchema("ReadIngestDisposition", {
      description: "Successfully read subject with positive record count and content-addressed evidence.",
    })
  )
) {}

/**
 * **Example** (Keep an empty session directory as a tombstone)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TombstonedIngestDisposition } from "@beep/repo-ai-metrics/ingest-manifest"
 *
 * const tombstone = S.decodeUnknownSync(TombstonedIngestDisposition)({
 *   status: "tombstoned",
 *   subject: { subjectId: "a".repeat(64), rootId: "b".repeat(64), sourceKind: "claude", subjectKind: "session-directory", evidenceTier: "reconstructed", oipTaint: "unknown" },
 *   tombstoneEvidenceDigest: "d".repeat(64),
 *   evidenceTier: "reconstructed"
 * })
 *
 * console.log(tombstone.evidenceTier) // => "reconstructed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TombstonedIngestDisposition extends S.Opaque<
  TombstonedIngestDisposition,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.tag(IngestDispositionStatus.Enum.tombstoned),
    subject: IngestSubject,
    tombstoneEvidenceDigest: Sha256Hex,
    evidenceTier: S.tag(EvidenceTier.Enum.reconstructed),
  }).pipe(
    $I.annoteSchema("TombstonedIngestDisposition", {
      description: "Enumerated-but-recordless subject recovered as an explicit reconstructed tombstone.",
    })
  )
) {}

/**
 * **Example** (Record a transcript the ingest could not open)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UnreachableIngestDisposition } from "@beep/repo-ai-metrics/ingest-manifest"
 *
 * const unreachable = S.decodeUnknownSync(UnreachableIngestDisposition)({
 *   status: "unreachable",
 *   subject: { subjectId: "a".repeat(64), rootId: "b".repeat(64), sourceKind: "codex", subjectKind: "transcript", evidenceTier: "observed", oipTaint: "clear" },
 *   reason: "permission-denied",
 *   evidenceDigest: "e".repeat(64),
 *   evidenceTier: "observed"
 * })
 *
 * console.log(unreachable.reason) // => "permission-denied"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnreachableIngestDisposition extends S.Opaque<
  UnreachableIngestDisposition,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.tag(IngestDispositionStatus.Enum.unreachable),
    subject: IngestSubject,
    reason: IngestUnreachableReason,
    evidenceDigest: Sha256Hex,
    evidenceTier: EvidenceTier,
  }).pipe(
    $I.annoteSchema("UnreachableIngestDisposition", {
      description: "Explicitly unreachable subject with bounded failure class and content-addressed evidence.",
    })
  )
) {}

/**
 * **Example** (Skip every subject during a dry run)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { IngestDisposition, SkippedIngestDisposition } from "@beep/repo-ai-metrics/ingest-manifest"
 *
 * const skipped = S.decodeUnknownSync(SkippedIngestDisposition)({
 *   status: "skipped",
 *   subject: { subjectId: "a".repeat(64), rootId: "b".repeat(64), sourceKind: "openclaw", subjectKind: "source-instance", evidenceTier: "derived", oipTaint: "clear" },
 *   reason: "dry-run",
 *   evidenceTier: "derived"
 * })
 *
 * console.log(skipped.reason) // => "dry-run"
 * console.log(S.is(IngestDisposition)(skipped)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkippedIngestDisposition extends S.Opaque<SkippedIngestDisposition, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(IngestDispositionStatus.Enum.skipped),
    subject: IngestSubject,
    reason: SkipReason,
    evidenceTier: EvidenceTier,
  }).pipe(
    $I.annoteSchema("SkippedIngestDisposition", {
      description: "Intentionally skipped subject carrying a required bounded policy reason.",
    })
  )
) {}

/**
 * **Example** (Count a source that has no emitter yet)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UnemittableIngestDisposition } from "@beep/repo-ai-metrics/ingest-manifest"
 *
 * const unemittable = S.decodeUnknownSync(UnemittableIngestDisposition)({
 *   status: "unemittable",
 *   subject: { subjectId: "a".repeat(64), rootId: "b".repeat(64), sourceKind: "openclaw", subjectKind: "canonical-root", evidenceTier: "derived", oipTaint: "clear" },
 *   reason: "emitter-not-installed",
 *   evidenceTier: "derived"
 * })
 *
 * console.log(unemittable.reason) // => "emitter-not-installed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnemittableIngestDisposition extends S.Opaque<
  UnemittableIngestDisposition,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.tag(IngestDispositionStatus.Enum.unemittable),
    subject: IngestSubject,
    reason: IngestUnemittableReason,
    evidenceTier: EvidenceTier,
  }).pipe(
    $I.annoteSchema("UnemittableIngestDisposition", {
      description: "Enumerated source class that cannot yet emit telemetry-v2 flight records.",
    })
  )
) {}

/**
 * Exactly one terminal disposition for an enumerated ingest subject.
 *
 * **Example** (Require a reason only on skipped subjects)
 *
 * ```ts
 * import { IngestDisposition } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IngestDisposition)({ status: "skipped" })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const IngestDisposition = S.Union([
  ReadIngestDisposition,
  TombstonedIngestDisposition,
  UnreachableIngestDisposition,
  SkippedIngestDisposition,
  UnemittableIngestDisposition,
]).pipe(
  S.toTaggedUnion("status"),
  S.check(
    S.makeFilter(
      (input) => input.evidenceTier === weakestEvidenceTier([input.evidenceTier, input.subject.evidenceTier]),
      {
        identifier: "IngestDispositionEvidenceTierInvariant",
        title: "Ingest-disposition evidence-tier invariant",
        description: "Prevents a final disposition from outranking the evidence that enumerated its subject.",
        message: "Expected disposition evidenceTier to be no stronger than its subject evidence tier",
      }
    )
  ),
  $I.annoteSchema("IngestDisposition", {
    description: "Tagged final disposition that structurally rejects impossible status-specific field combinations.",
  })
);

/**
 * Decoded final disposition for one ingest subject.
 *
 * @see {@link IngestDisposition} for the runtime tagged union.
 * @category models
 * @since 0.0.0
 */
export type IngestDisposition = typeof IngestDisposition.Type;

/**
 * **Example** (Partition an ingest denominator by disposition)
 *
 * ```ts
 * import { IngestManifestSummary } from "@beep/repo-ai-metrics/ingest-manifest"
 *
 * const summary = IngestManifestSummary.make({
 *   enumeratedCount: 10,
 *   accountedCount: 10,
 *   readCount: 7,
 *   tombstonedCount: 1,
 *   unreachableCount: 1,
 *   skippedCount: 0,
 *   unemittableCount: 1
 * })
 *
 * console.log(summary.readCount + summary.tombstonedCount + summary.unreachableCount + summary.skippedCount + summary.unemittableCount) // => 10
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IngestManifestSummary extends S.Opaque<IngestManifestSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    enumeratedCount: S.Natural,
    accountedCount: S.Natural,
    readCount: S.Natural,
    tombstonedCount: S.Natural,
    unreachableCount: S.Natural,
    skippedCount: S.Natural,
    unemittableCount: S.Natural,
  }).pipe(
    $I.annoteSchema("IngestManifestSummary", {
      description: "Disposition partition for a complete telemetry-v2 ingest denominator.",
    })
  )
) {}

const countDisposition = (
  dispositions: ReadonlyArray<IngestDisposition>,
  status: IngestDisposition["status"]
): number => A.length(A.filter(dispositions, (disposition) => disposition.status === status));

const manifestSummaryIsConsistent = (input: {
  readonly enumeratedCount: number;
  readonly dispositions: ReadonlyArray<IngestDisposition>;
  readonly summary: IngestManifestSummary;
}): boolean => {
  const accountedCount = A.length(input.dispositions);
  return (
    input.enumeratedCount === accountedCount &&
    input.summary.enumeratedCount === input.enumeratedCount &&
    input.summary.accountedCount === accountedCount &&
    input.summary.readCount === countDisposition(input.dispositions, IngestDispositionStatus.Enum.read) &&
    input.summary.tombstonedCount === countDisposition(input.dispositions, IngestDispositionStatus.Enum.tombstoned) &&
    input.summary.unreachableCount === countDisposition(input.dispositions, IngestDispositionStatus.Enum.unreachable) &&
    input.summary.skippedCount === countDisposition(input.dispositions, IngestDispositionStatus.Enum.skipped) &&
    input.summary.unemittableCount === countDisposition(input.dispositions, IngestDispositionStatus.Enum.unemittable)
  );
};

const manifestHasUniqueSubjectIds = (dispositions: ReadonlyArray<IngestDisposition>): boolean =>
  A.length(A.dedupe(A.map(dispositions, (disposition) => disposition.subject.subjectId))) === A.length(dispositions);

/**
 * Final coverage attestation linked to a previously persisted enumeration.
 *
 * **Details**
 *
 * The disposition array is itself the full denominator: every subject appears
 * exactly once and every summary count is checked against that partition. A
 * consumer cannot render an aggregate from this contract without the
 * denominator count and its content-addressed enumeration link.
 *
 * **Example** (Decode a finalized manifest)
 *
 * ```ts
 * import { IngestManifest } from "@beep/repo-ai-metrics"
 *
 * console.log(IngestManifest.decodeJsonEffect('{"schemaVersion":"telemetry-v2/ingest-manifest/v1"}'))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IngestManifest extends S.Opaque<IngestManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag(ingestManifestSchemaVersion),
    enumerationId: Sha256Hex,
    ingestRunId: Sha256Hex,
    attestedAt: S.DateTimeUtcFromString,
    configFingerprint: Sha256Hex,
    configEvidenceTier: EvidenceTier,
    enumeratedCount: S.Natural,
    dispositions: S.Array(IngestDisposition),
    summary: IngestManifestSummary,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  })
    .check(
      S.makeFilterGroup(
        [
          S.makeFilter(manifestSummaryIsConsistent, {
            identifier: "IngestManifestSummaryInvariant",
            title: "Ingest-manifest summary invariant",
            description: "Requires complete denominator accounting and exact disposition partition counts.",
            message: "Expected every enumerated subject to receive exactly one summary-accounted disposition",
          }),
          S.makeFilter((input) => manifestHasUniqueSubjectIds(input.dispositions), {
            identifier: "IngestManifestIdentityInvariant",
            title: "Ingest-manifest identity invariant",
            description: "Requires every finalized subject identity to appear exactly once.",
            message: "Expected every disposition subjectId to be unique",
          }),
          S.makeFilter(
            (input) =>
              input.evidenceTier ===
              weakestEvidenceTier([
                input.configEvidenceTier,
                ...A.map(input.dispositions, (disposition) => disposition.evidenceTier),
              ]),
            {
              identifier: "IngestManifestEvidenceTierInvariant",
              title: "Ingest-manifest evidence-tier invariant",
              description: "Requires the final attestation to inherit its weakest configuration or disposition tier.",
              message: "Expected evidenceTier to equal the weakest attestation input tier",
            }
          ),
          S.makeFilter(
            (input) =>
              input.oipTaint ===
              combineOipTaints(A.map(input.dispositions, (disposition) => disposition.subject.oipTaint)),
            {
              identifier: "IngestManifestOipTaintInvariant",
              title: "Ingest-manifest OIP taint invariant",
              description: "Requires the final attestation to retain the most restrictive subject OIP taint.",
              message: "Expected oipTaint to preserve the most restrictive disposition-subject taint",
            }
          ),
        ],
        {
          identifier: "IngestManifestInvariants",
          title: "Ingest-manifest invariants",
          description: "Checks exact denominator accounting, uniqueness, weakest-link evidence, and OIP taint.",
        }
      )
    )
    .pipe(
      $I.annoteSchema("IngestManifest", {
        description: "Final hash-only telemetry-v2 coverage attestation linked to a pre-read enumeration.",
      })
    )
) {
  static readonly decodeEffect = S.decodeUnknownEffect(IngestManifest);
  static readonly encodeEffect = S.encodeUnknownEffect(IngestManifest);
  static readonly decodeResult = S.decodeUnknownResult(IngestManifest);
  static readonly encodeResult = S.encodeResult(IngestManifest);
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(IngestManifest));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(IngestManifest));
}
