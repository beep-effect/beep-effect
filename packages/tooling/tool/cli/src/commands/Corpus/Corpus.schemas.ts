/**
 * Schema models for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Corpus/Corpus.schemas");

/**
 * Copy disposition recorded for a salvaged corpus file.
 *
 * @example
 * ```ts
 * import { CorpusCopyMode } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorpusCopyMode)("copied")) // true
 * console.log(S.is(CorpusCopyMode)("provenance-only")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CorpusCopyMode = LiteralKit(["copied", "provenance-only"]).pipe(
  $I.annoteSchema("CorpusCopyMode", {
    title: "Corpus Copy Mode",
    description:
      "Whether salvage copied bytes into raw storage or only recorded provenance for content already present by digest.",
  })
);

/**
 * Type for {@link CorpusCopyMode}. {@inheritDoc CorpusCopyMode}
 *
 * @example
 * ```ts
 * import type { CorpusCopyMode } from "@beep/repo-cli/commands/Corpus"
 *
 * const mode: CorpusCopyMode = "copied"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CorpusCopyMode = typeof CorpusCopyMode.Type;

/**
 * Digest-to-raw-path row loaded from the corpus catalog or provenance manifests.
 *
 * @example
 * ```ts
 * import { CorpusCatalogDigestRow } from "@beep/repo-cli/commands/Corpus"
 *
 * const row = CorpusCatalogDigestRow.make({
 *   destPath: "/tmp/corpus/raw/source-a/a.txt",
 *   sha256: "8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8"
 * })
 * console.log(row.destPath)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusCatalogDigestRow extends S.Class<CorpusCatalogDigestRow>($I`CorpusCatalogDigestRow`)(
  {
    destPath: S.NonEmptyString,
    sha256: Sha256Hex,
  },
  $I.annote("CorpusCatalogDigestRow", {
    title: "Corpus Catalog Digest Row",
    description: "Digest-to-raw-path row loaded from the corpus DuckDB catalog or raw provenance manifests.",
  })
) {}

/**
 * Duplicate-set scope reported by the catalog.
 *
 * @example
 * ```ts
 * import { CorpusDuplicateScope } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorpusDuplicateScope)("cross-run")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CorpusDuplicateScope = LiteralKit(["intra-run", "cross-run"]).pipe(
  $I.annoteSchema("CorpusDuplicateScope", {
    title: "Corpus Duplicate Scope",
    description: "Whether a duplicate digest occurs within one catalog run or across multiple run labels.",
  })
);

/**
 * Type for {@link CorpusDuplicateScope}. {@inheritDoc CorpusDuplicateScope}
 *
 * @example
 * ```ts
 * import type { CorpusDuplicateScope } from "@beep/repo-cli/commands/Corpus"
 *
 * const scope: CorpusDuplicateScope = "cross-run"
 * console.log(scope)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CorpusDuplicateScope = typeof CorpusDuplicateScope.Type;

/**
 * One salvaged-file row of the corpus provenance manifest.
 *
 * @example
 * ```ts
 * import { CorpusProvenanceRecord } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * const record = S.decodeUnknownSync(CorpusProvenanceRecord)({
 *   destPath: "/corpus/raw/source-a/a.txt",
 *   mtimeEpoch: 1718000000,
 *   mtimeIso: "2024-06-10T06:13:20Z",
 *   originPath: "/origin/a.txt",
 *   relativePath: "a.txt",
 *   salvagedAt: "2026-06-11T15:00:00Z",
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   sizeBytes: 0,
 *   sourceLabel: "source-a"
 * })
 * console.log(record.sourceLabel) // "source-a"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusProvenanceRecord extends S.Class<CorpusProvenanceRecord>($I`CorpusProvenanceRecord`)(
  {
    copyMode: S.optionalKey(CorpusCopyMode),
    dedupeOfPath: S.optionalKey(S.NonEmptyString),
    destPath: S.NonEmptyString,
    mtimeEpoch: S.Int,
    mtimeIso: S.NonEmptyString,
    originPath: S.NonEmptyString,
    relativePath: S.NonEmptyString,
    salvagedAt: S.NonEmptyString,
    sha256: Sha256Hex,
    sizeBytes: NonNegativeInt,
    sourceLabel: S.NonEmptyString,
  },
  $I.annote("CorpusProvenanceRecord", {
    title: "Corpus Provenance Record",
    description: "JSONL-safe provenance record written for one verified salvaged corpus file.",
  })
) {}

/**
 * JSONL decoder for {@link CorpusProvenanceRecord}.
 *
 * @example
 * ```ts
 * import { decodeCorpusProvenanceRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const line = JSON.stringify({
 *   destPath: "/corpus/raw/source-a/a.txt",
 *   mtimeEpoch: 1718000000,
 *   mtimeIso: "2024-06-10T06:13:20Z",
 *   originPath: "/origin/a.txt",
 *   relativePath: "a.txt",
 *   salvagedAt: "2026-06-11T15:00:00Z",
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   sizeBytes: 0,
 *   sourceLabel: "source-a"
 * })
 *
 * Effect.runPromise(decodeCorpusProvenanceRecordJson(line)).then((record) => console.log(record.sourceLabel)) // "source-a"
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const decodeCorpusProvenanceRecordJson = S.decodeUnknownEffect(S.fromJsonString(CorpusProvenanceRecord));

/**
 * JSONL encoder for {@link CorpusProvenanceRecord}.
 *
 * @example
 * ```ts
 * import { CorpusProvenanceRecord, encodeCorpusProvenanceRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const record = CorpusProvenanceRecord.make({
 *   copyMode: "copied",
 *   destPath: "/corpus/raw/source-a/a.txt",
 *   mtimeEpoch: 1718000000,
 *   mtimeIso: "2024-06-10T06:13:20Z",
 *   originPath: "/origin/a.txt",
 *   relativePath: "a.txt",
 *   salvagedAt: "2026-06-11T15:00:00Z",
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   sizeBytes: 0,
 *   sourceLabel: "source-a"
 * })
 *
 * Effect.runPromise(encodeCorpusProvenanceRecordJson(record)).then((json) => console.log(json.includes("copied"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusProvenanceRecordJson = S.encodeUnknownEffect(S.fromJsonString(CorpusProvenanceRecord));

/**
 * One catalog occurrence row after provenance manifests are unioned by run.
 *
 * @example
 * ```ts
 * import { CorpusCatalogSourceFileRecord } from "@beep/repo-cli/commands/Corpus"
 *
 * const record = CorpusCatalogSourceFileRecord.make({
 *   copyMode: "copied",
 *   destPath: "/corpus/raw/source-a/a.txt",
 *   mtimeEpoch: 1718000000,
 *   mtimeIso: "2024-06-10T06:13:20Z",
 *   originPath: "/origin/a.txt",
 *   referencedRawPath: "/corpus/raw/source-a/a.txt",
 *   relativePath: "a.txt",
 *   runLabel: "base",
 *   salvagedAt: "2026-06-11T15:00:00Z",
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   sizeBytes: 0,
 *   sourceLabel: "source-a"
 * })
 * console.log(record.runLabel) // "base"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusCatalogSourceFileRecord extends S.Class<CorpusCatalogSourceFileRecord>(
  $I`CorpusCatalogSourceFileRecord`
)(
  {
    copyMode: CorpusCopyMode,
    dedupeOfPath: S.optionalKey(S.NonEmptyString),
    destPath: S.NonEmptyString,
    mtimeEpoch: S.Int,
    mtimeIso: S.NonEmptyString,
    originPath: S.NonEmptyString,
    referencedRawPath: S.NonEmptyString,
    relativePath: S.NonEmptyString,
    runLabel: S.NonEmptyString,
    salvagedAt: S.NonEmptyString,
    sha256: Sha256Hex,
    sizeBytes: NonNegativeInt,
    sourceLabel: S.NonEmptyString,
  },
  $I.annote("CorpusCatalogSourceFileRecord", {
    title: "Corpus Catalog Source File Record",
    description:
      "One source-file occurrence loaded into the catalog after adding the provenance run label and canonical raw-byte path.",
  })
) {}

/**
 * JSONL encoder for {@link CorpusCatalogSourceFileRecord}.
 *
 * @example
 * ```ts
 * import { CorpusCatalogSourceFileRecord, encodeCorpusCatalogSourceFileRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const record = CorpusCatalogSourceFileRecord.make({
 *   copyMode: "provenance-only",
 *   dedupeOfPath: "/corpus/raw/source-a/a.txt",
 *   destPath: "/corpus/raw/refresh/source-b/a.txt",
 *   mtimeEpoch: 1718000000,
 *   mtimeIso: "2024-06-10T06:13:20Z",
 *   originPath: "/origin/b.txt",
 *   referencedRawPath: "/corpus/raw/source-a/a.txt",
 *   relativePath: "a.txt",
 *   runLabel: "refresh",
 *   salvagedAt: "2026-07-01T15:00:00Z",
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   sizeBytes: 0,
 *   sourceLabel: "source-b"
 * })
 *
 * Effect.runPromise(encodeCorpusCatalogSourceFileRecordJson(record)).then((json) => console.log(json.includes("refresh"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusCatalogSourceFileRecordJson = S.encodeUnknownEffect(
  S.fromJsonString(CorpusCatalogSourceFileRecord)
);

/**
 * Recycle-bin metadata format version family.
 *
 * @example
 * ```ts
 * import { RecycleBinFormatVersion } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RecycleBinFormatVersion)("v2")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const RecycleBinFormatVersion = LiteralKit(["v1", "v2"]).pipe(
  $I.annoteSchema("RecycleBinFormatVersion", {
    description: "Windows Recycle Bin $I metadata format family: v1 (Vista-8.1 fixed path) or v2 (10+ sized path).",
  })
);

/**
 * Type for {@link RecycleBinFormatVersion}.
 *
 * @category models
 * @since 0.0.0
 */
export type RecycleBinFormatVersion = typeof RecycleBinFormatVersion.Type;

/**
 * Original-file facts recovered from one `$I` recycle-bin metadata file.
 *
 * @example
 * ```ts
 * import { RecycleBinOriginal } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * const original = S.decodeUnknownSync(RecycleBinOriginal)({
 *   deletedAtFiletime: "133600000000000000",
 *   deletedAtIso: "2024-06-10T06:13:20.000Z",
 *   originalName: "spec.docx",
 *   originalPath: "C:\\Clients\\spec.docx",
 *   originalSizeBytes: 11,
 *   version: "v2"
 * })
 * console.log(original.originalName) // "spec.docx"
 * ```
 * @category models
 * @since 0.0.0
 */
export class RecycleBinOriginal extends S.Class<RecycleBinOriginal>($I`RecycleBinOriginal`)(
  {
    deletedAtFiletime: S.NonEmptyString,
    deletedAtIso: S.NonEmptyString,
    originalName: S.NonEmptyString,
    originalPath: S.NonEmptyString,
    originalSizeBytes: NonNegativeInt,
    version: RecycleBinFormatVersion,
  },
  $I.annote("RecycleBinOriginal", {
    description: "Original path, name, size, and deletion time recovered from a $I recycle-bin metadata file.",
  })
) {}

/**
 * Matched `$I`/`$R` restoration row.
 *
 * @example
 * ```ts
 * import { MatchedRestorationRecord } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * const record = S.decodeUnknownSync(MatchedRestorationRecord)({
 *   contentRelativePath: "$R0CB4M9.docx",
 *   matchStatus: "matched",
 *   metadataRelativePath: "$I0CB4M9.docx",
 *   original: {
 *     deletedAtFiletime: "133600000000000000",
 *     deletedAtIso: "2024-06-10T06:13:20.000Z",
 *     originalName: "spec.docx",
 *     originalPath: "C:\\Clients\\spec.docx",
 *     originalSizeBytes: 11,
 *     version: "v2"
 *   },
 *   pairKey: "0CB4M9.docx",
 *   sourceLabel: "source-a"
 * })
 * console.log(record.matchStatus) // "matched"
 * ```
 * @category models
 * @since 0.0.0
 */
export class MatchedRestorationRecord extends S.Class<MatchedRestorationRecord>($I`MatchedRestorationRecord`)(
  {
    contentRelativePath: S.NonEmptyString,
    matchStatus: S.Literal("matched"),
    metadataRelativePath: S.NonEmptyString,
    original: RecycleBinOriginal,
    pairKey: S.NonEmptyString,
    sourceLabel: S.NonEmptyString,
  },
  $I.annote("MatchedRestorationRecord", {
    description: "A $R content file whose original name and path were restored from its paired $I metadata file.",
  })
) {}

/**
 * Restoration row for a `$I` metadata file with no `$R` content partner.
 *
 * @example
 * ```ts
 * import { UnmatchedMetadataRestorationRecord } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * const record = S.decodeUnknownSync(UnmatchedMetadataRestorationRecord)({
 *   matchStatus: "unmatched-metadata",
 *   metadataRelativePath: "$I0CB4M9.docx",
 *   original: {
 *     deletedAtFiletime: "133600000000000000",
 *     deletedAtIso: "2024-06-10T06:13:20.000Z",
 *     originalName: "spec.docx",
 *     originalPath: "C:\\Clients\\spec.docx",
 *     originalSizeBytes: 11,
 *     version: "v2"
 *   },
 *   pairKey: "0CB4M9.docx",
 *   sourceLabel: "source-a"
 * })
 * console.log(record.metadataRelativePath) // "$I0CB4M9.docx"
 * ```
 * @category models
 * @since 0.0.0
 */
export class UnmatchedMetadataRestorationRecord extends S.Class<UnmatchedMetadataRestorationRecord>(
  $I`UnmatchedMetadataRestorationRecord`
)(
  {
    matchStatus: S.Literal("unmatched-metadata"),
    metadataRelativePath: S.NonEmptyString,
    original: RecycleBinOriginal,
    pairKey: S.NonEmptyString,
    sourceLabel: S.NonEmptyString,
  },
  $I.annote("UnmatchedMetadataRestorationRecord", {
    description: "A $I metadata file whose paired $R content file is absent from the salvaged corpus.",
  })
) {}

/**
 * Restoration row for a `$R` content file with no `$I` metadata partner.
 *
 * @example
 * ```ts
 * import { UnmatchedContentRestorationRecord } from "@beep/repo-cli/commands/Corpus"
 *
 * const record = UnmatchedContentRestorationRecord.make({
 *   contentRelativePath: "$R0CB4M9.docx",
 *   matchStatus: "unmatched-content",
 *   pairKey: "0CB4M9.docx",
 *   sourceLabel: "source-a"
 * })
 * console.log(record.contentRelativePath) // "$R0CB4M9.docx"
 * ```
 * @category models
 * @since 0.0.0
 */
export class UnmatchedContentRestorationRecord extends S.Class<UnmatchedContentRestorationRecord>(
  $I`UnmatchedContentRestorationRecord`
)(
  {
    contentRelativePath: S.NonEmptyString,
    matchStatus: S.Literal("unmatched-content"),
    pairKey: S.NonEmptyString,
    sourceLabel: S.NonEmptyString,
  },
  $I.annote("UnmatchedContentRestorationRecord", {
    description: "A $R content file whose $I metadata file is absent, so its original name stays unknown.",
  })
) {}

/**
 * Restoration manifest row for one recycle-bin artifact.
 *
 * @example
 * ```ts
 * import { CorpusRestorationRecord } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * const record = S.decodeUnknownSync(CorpusRestorationRecord)({
 *   contentRelativePath: "$R0CB4M9.docx",
 *   matchStatus: "unmatched-content",
 *   pairKey: "0CB4M9.docx",
 *   sourceLabel: "source-a"
 * })
 * console.log(record.matchStatus) // "unmatched-content"
 * ```
 * @category models
 * @since 0.0.0
 */
export const CorpusRestorationRecord = S.Union([
  MatchedRestorationRecord,
  UnmatchedMetadataRestorationRecord,
  UnmatchedContentRestorationRecord,
]).pipe(
  S.toTaggedUnion("matchStatus"),
  $I.annoteSchema("CorpusRestorationRecord", {
    description: "JSONL-safe recycle-bin name-restoration record emitted by corpus catalog.",
  })
);

/**
 * Type for {@link CorpusRestorationRecord}.
 *
 * @category models
 * @since 0.0.0
 */
export type CorpusRestorationRecord = typeof CorpusRestorationRecord.Type;

/**
 * JSONL encoder for {@link CorpusRestorationRecord}.
 *
 * @example
 * ```ts
 * import { encodeCorpusRestorationRecordJson, UnmatchedContentRestorationRecord } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const record = UnmatchedContentRestorationRecord.make({
 *   contentRelativePath: "$R123456.docx",
 *   matchStatus: "unmatched-content",
 *   pairKey: "123456.docx",
 *   sourceLabel: "source-a"
 * })
 *
 * Effect.runPromise(encodeCorpusRestorationRecordJson(record)).then((json) => console.log(json.includes("unmatched-content"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusRestorationRecordJson = S.encodeUnknownEffect(S.fromJsonString(CorpusRestorationRecord));

/**
 * One exact-duplicate digest group reported by the corpus catalog.
 *
 * @example
 * ```ts
 * import { CorpusDuplicateSetRecord } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * const record = S.decodeUnknownSync(CorpusDuplicateSetRecord)({
 *   copies: 2,
 *   duplicateScope: "cross-run",
 *   digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   members: "source-a/a.txt | source-b/a.txt",
 *   runCount: 2,
 *   runLabels: "base | refresh",
 *   sizeBytes: 11
 * })
 * console.log(record.copies) // 2
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusDuplicateSetRecord extends S.Class<CorpusDuplicateSetRecord>($I`CorpusDuplicateSetRecord`)(
  {
    copies: NonNegativeInt,
    duplicateScope: CorpusDuplicateScope,
    digest: S.NonEmptyString,
    members: S.NonEmptyString,
    runCount: NonNegativeInt,
    runLabels: S.NonEmptyString,
    sizeBytes: NonNegativeInt,
  },
  $I.annote("CorpusDuplicateSetRecord", {
    description:
      "A digest shared by multiple salvaged file occurrences, with member paths and run labels joined for reporting.",
  })
) {}

/**
 * JSON encoder for the duplicate-set report array.
 *
 * @example
 * ```ts
 * import { encodeCorpusDuplicateSetReportJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const rows = [{
 *   copies: 2,
 *   duplicateScope: "intra-run",
 *   digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   members: "source-a/a.txt | source-b/a.txt",
 *   runCount: 1,
 *   runLabels: "base",
 *   sizeBytes: 11
 * }]
 *
 * Effect.runPromise(encodeCorpusDuplicateSetReportJson(rows)).then((json) => console.log(json.includes("source-a/a.txt"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusDuplicateSetReportJson = S.encodeUnknownEffect(
  S.fromJsonString(S.Array(CorpusDuplicateSetRecord))
);

/**
 * Recycle-bin artifact kind derived from the `$I`/`$R` filename prefix.
 *
 * @example
 * ```ts
 * import { RecycleBinEntryKind } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RecycleBinEntryKind)("metadata")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const RecycleBinEntryKind = LiteralKit(["metadata", "content"]).pipe(
  $I.annoteSchema("RecycleBinEntryKind", {
    description: "Whether a recycle-bin artifact is a $I metadata file or a $R content file.",
  })
);

/**
 * Type for {@link RecycleBinEntryKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type RecycleBinEntryKind = typeof RecycleBinEntryKind.Type;

/**
 * One recycle-bin artifact discovered while scanning salvaged sources.
 *
 * @example
 * ```ts
 * import { RecycleBinScanEntry } from "@beep/repo-cli/commands/Corpus"
 *
 * const entry = RecycleBinScanEntry.make({
 *   kind: "metadata",
 *   pairKey: "0CB4M9.docx",
 *   relativePath: "$I0CB4M9.docx"
 * })
 * console.log(entry.kind) // "metadata"
 * ```
 * @category models
 * @since 0.0.0
 */
export class RecycleBinScanEntry extends S.Class<RecycleBinScanEntry>($I`RecycleBinScanEntry`)(
  {
    kind: RecycleBinEntryKind,
    pairKey: S.NonEmptyString,
    relativePath: S.NonEmptyString,
  },
  $I.annote("RecycleBinScanEntry", {
    description: "A $I or $R artifact observed in a salvaged source, keyed for pairing.",
  })
) {}

/**
 * A `$I`/`$R` pair joined on its shared pair key.
 *
 * @example
 * ```ts
 * import { RecycleBinPairedEntry } from "@beep/repo-cli/commands/Corpus"
 *
 * const pair = RecycleBinPairedEntry.make({
 *   contentRelativePath: "$R0CB4M9.docx",
 *   metadataRelativePath: "$I0CB4M9.docx",
 *   pairKey: "0CB4M9.docx"
 * })
 * console.log(pair.pairKey) // "0CB4M9.docx"
 * ```
 * @category models
 * @since 0.0.0
 */
export class RecycleBinPairedEntry extends S.Class<RecycleBinPairedEntry>($I`RecycleBinPairedEntry`)(
  {
    contentRelativePath: S.NonEmptyString,
    metadataRelativePath: S.NonEmptyString,
    pairKey: S.NonEmptyString,
  },
  $I.annote("RecycleBinPairedEntry", {
    description: "A matched $I metadata and $R content pair sharing one pair key.",
  })
) {}

/**
 * Pairing outcome over a set of recycle-bin scan entries.
 *
 * @example
 * ```ts
 * import { RecycleBinPairing } from "@beep/repo-cli/commands/Corpus"
 *
 * const pairing = RecycleBinPairing.make({
 *   matched: [],
 *   unmatchedContent: [],
 *   unmatchedMetadata: []
 * })
 * console.log(pairing.matched.length) // 0
 * ```
 * @category models
 * @since 0.0.0
 */
export class RecycleBinPairing extends S.Class<RecycleBinPairing>($I`RecycleBinPairing`)(
  {
    matched: S.Array(RecycleBinPairedEntry),
    unmatchedContent: S.Array(RecycleBinScanEntry),
    unmatchedMetadata: S.Array(RecycleBinScanEntry),
  },
  $I.annote("RecycleBinPairing", {
    description: "Matched pairs plus unmatched $I and $R leftovers for one pairing pass.",
  })
) {}

/**
 * One labeled source passed to a corpus salvage copy run.
 *
 * @example
 * ```ts
 * import { CorpusSalvageSourceSpec } from "@beep/repo-cli/commands/Corpus"
 *
 * const spec = CorpusSalvageSourceSpec.make({ sourceLabel: "source-a", sourcePath: "/tmp/source-a" })
 * console.log(spec.sourceLabel) // "source-a"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusSalvageSourceSpec extends S.Class<CorpusSalvageSourceSpec>($I`CorpusSalvageSourceSpec`)(
  {
    sourceLabel: S.NonEmptyString,
    sourcePath: S.NonEmptyString,
  },
  $I.annote("CorpusSalvageSourceSpec", {
    title: "Corpus Salvage Source Spec",
    description:
      "Generic source label plus filesystem path for a salvage copy run; labels should be source-a/source-b style aliases.",
  })
) {}

/**
 * One source file selected for a corpus salvage copy run.
 *
 * @example
 * ```ts
 * import { CorpusSalvageOriginFile } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const origin = CorpusSalvageOriginFile.make({
 *   mtimeEpoch: 1700000000,
 *   mtimeIso: "2023-11-14T22:13:20Z",
 *   originPath: "/tmp/source-a/a.txt",
 *   relativePath: "a.txt",
 *   sizeBytes: NonNegativeInt.make(5),
 *   sourceLabel: "source-a"
 * })
 * console.log(origin.relativePath)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusSalvageOriginFile extends S.Class<CorpusSalvageOriginFile>($I`CorpusSalvageOriginFile`)(
  {
    mtimeEpoch: S.Int,
    mtimeIso: S.NonEmptyString,
    originPath: S.NonEmptyString,
    relativePath: S.NonEmptyString,
    sizeBytes: NonNegativeInt,
    sourceLabel: S.NonEmptyString,
  },
  $I.annote("CorpusSalvageOriginFile", {
    title: "Corpus Salvage Origin File",
    description: "One source file selected for a corpus salvage copy run.",
  })
) {}

/**
 * Validated options used by `corpus catalog`.
 *
 * @example
 * ```ts
 * import { CorpusCatalogOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = CorpusCatalogOptions.make({ corpusRoot: "/data/corpus" })
 * console.log(options.corpusRoot)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusCatalogOptions extends S.Class<CorpusCatalogOptions>($I`CorpusCatalogOptions`)(
  {
    corpusRoot: S.String,
  },
  $I.annote("CorpusCatalogOptions", {
    description: "Validated options used by corpus catalog.",
  })
) {}

/**
 * Validated options used by `corpus extract`.
 *
 * @example
 * ```ts
 * import { CorpusExtractOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = CorpusExtractOptions.make({
 *   corpusRoot: "/data/corpus",
 *   exportChildren: true,
 *   includeDuplicates: false,
 *   overwrite: false,
 *   tikaJarPath: "/opt/tika/tika-app.jar"
 * })
 * console.log(options.exportChildren) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusExtractOptions extends S.Class<CorpusExtractOptions>($I`CorpusExtractOptions`)(
  {
    concurrency: S.optionalKey(S.Finite),
    corpusRoot: S.String,
    exportChildren: S.Boolean,
    includeDuplicates: S.Boolean,
    javaPath: S.optionalKey(S.String),
    maxFiles: S.optionalKey(S.Finite),
    overwrite: S.Boolean,
    pffexportPath: S.optionalKey(S.String),
    sourceLabel: S.optionalKey(S.String),
    tikaJarPath: S.String,
  },
  $I.annote("CorpusExtractOptions", {
    description: "Validated options used by corpus extract.",
  })
) {}

/**
 * Summary counts returned by `corpus extract`.
 *
 * @example
 * ```ts
 * import { CorpusExtractSummary } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = CorpusExtractSummary.make({
 *   childArtifactCount: NonNegativeInt.make(1),
 *   duplicatesSkipped: NonNegativeInt.make(0),
 *   failedCount: NonNegativeInt.make(0),
 *   skippedCount: NonNegativeInt.make(0),
 *   sourceCount: NonNegativeInt.make(2),
 *   succeededCount: NonNegativeInt.make(2),
 *   textArtifactCount: NonNegativeInt.make(2)
 * })
 * console.log(summary.succeededCount) // 2
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusExtractSummary extends S.Class<CorpusExtractSummary>($I`CorpusExtractSummary`)(
  {
    childArtifactCount: NonNegativeInt,
    duplicatesSkipped: NonNegativeInt,
    failedCount: NonNegativeInt,
    skippedCount: NonNegativeInt,
    sourceCount: NonNegativeInt,
    succeededCount: NonNegativeInt,
    textArtifactCount: NonNegativeInt,
  },
  $I.annote("CorpusExtractSummary", {
    description: "Summary counts returned by corpus extract.",
  })
) {}

/**
 * JSON encoder for {@link CorpusExtractSummary}.
 *
 * @example
 * ```ts
 * import { CorpusExtractSummary, encodeCorpusExtractSummaryJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const summary = CorpusExtractSummary.make({
 *   childArtifactCount: NonNegativeInt.make(0),
 *   duplicatesSkipped: NonNegativeInt.make(0),
 *   failedCount: NonNegativeInt.make(0),
 *   skippedCount: NonNegativeInt.make(0),
 *   sourceCount: NonNegativeInt.make(1),
 *   succeededCount: NonNegativeInt.make(1),
 *   textArtifactCount: NonNegativeInt.make(1)
 * })
 *
 * Effect.runPromise(encodeCorpusExtractSummaryJson(summary)).then((json) => console.log(json.includes("\"sourceCount\":1"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusExtractSummaryJson = S.encodeUnknownEffect(S.fromJsonString(CorpusExtractSummary));

/**
 * Validated options used by `corpus organize`.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = CorpusOrganizeOptions.make({ corpusRoot: "/data/corpus", overwrite: false })
 * console.log(options.corpusRoot)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusOrganizeOptions extends S.Class<CorpusOrganizeOptions>($I`CorpusOrganizeOptions`)(
  {
    clientMapPath: S.optionalKey(S.String),
    corpusRoot: S.String,
    overwrite: S.Boolean,
  },
  $I.annote("CorpusOrganizeOptions", {
    description: "Validated options used by corpus organize.",
  })
) {}

/**
 * Organization category assigned to one canonical corpus artifact.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeCategory } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorpusOrganizeCategory)("docket")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CorpusOrganizeCategory = LiteralKit([
  "client",
  "docket",
  "email-archive",
  "email-export",
  "recycle-metadata",
  "unsorted",
]).pipe(
  $I.annoteSchema("CorpusOrganizeCategory", {
    description:
      "Taxonomy category: client-mapped, docket-grouped, PST email archive, per-message email export, recycle-bin metadata, or unsorted.",
  })
);

/**
 * Type for {@link CorpusOrganizeCategory}.
 *
 * @category models
 * @since 0.0.0
 */
export type CorpusOrganizeCategory = typeof CorpusOrganizeCategory.Type;

/**
 * One row of the organize manifest mapping a canonical artifact into the taxonomy.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeRecord } from "@beep/repo-cli/commands/Corpus"
 *
 * const record = CorpusOrganizeRecord.make({
 *   category: "docket",
 *   digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   docket: "10109WO02-US1",
 *   docketFamily: "10109",
 *   effectiveName: "response.docx",
 *   materialized: true,
 *   organizedRelativePath: "dockets/10109/10109WO02-US1/response.docx",
 *   restoredFromRecycleBin: false,
 *   sourceLabel: "source-a",
 *   sourceRelativePath: "response.docx"
 * })
 * console.log(record.category) // "docket"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusOrganizeRecord extends S.Class<CorpusOrganizeRecord>($I`CorpusOrganizeRecord`)(
  {
    category: CorpusOrganizeCategory,
    client: S.optionalKey(S.String),
    digest: S.NonEmptyString,
    docket: S.optionalKey(S.String),
    docketFamily: S.optionalKey(S.String),
    effectiveName: S.NonEmptyString,
    materialized: S.Boolean,
    organizedRelativePath: S.optionalKey(S.String),
    restoredFromRecycleBin: S.Boolean,
    sourceLabel: S.NonEmptyString,
    sourceRelativePath: S.NonEmptyString,
    versionIndex: S.optionalKey(NonNegativeInt),
  },
  $I.annote("CorpusOrganizeRecord", {
    description: "JSONL-safe organize manifest row for one canonical corpus artifact.",
  })
) {}

/**
 * JSONL encoder for {@link CorpusOrganizeRecord}.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeRecord, encodeCorpusOrganizeRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const record = CorpusOrganizeRecord.make({
 *   category: "unsorted",
 *   digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   effectiveName: "a.txt",
 *   materialized: true,
 *   restoredFromRecycleBin: false,
 *   sourceLabel: "source-a",
 *   sourceRelativePath: "a.txt"
 * })
 *
 * Effect.runPromise(encodeCorpusOrganizeRecordJson(record)).then((json) => console.log(json.includes("unsorted"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusOrganizeRecordJson = S.encodeUnknownEffect(S.fromJsonString(CorpusOrganizeRecord));

/**
 * Summary counts returned by `corpus organize`.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeSummary } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = CorpusOrganizeSummary.make({
 *   canonicalArtifacts: NonNegativeInt.make(4),
 *   clientFiles: NonNegativeInt.make(1),
 *   docketFamilies: NonNegativeInt.make(1),
 *   docketFiles: NonNegativeInt.make(2),
 *   duplicatesSkipped: NonNegativeInt.make(0),
 *   emailArchives: NonNegativeInt.make(1),
 *   emailExportFiles: NonNegativeInt.make(0),
 *   restoredNames: NonNegativeInt.make(1),
 *   unsortedFiles: NonNegativeInt.make(0),
 *   versionGroups: NonNegativeInt.make(1)
 * })
 * console.log(summary.docketFiles) // 2
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusOrganizeSummary extends S.Class<CorpusOrganizeSummary>($I`CorpusOrganizeSummary`)(
  {
    canonicalArtifacts: NonNegativeInt,
    clientFiles: NonNegativeInt,
    docketFamilies: NonNegativeInt,
    docketFiles: NonNegativeInt,
    duplicatesSkipped: NonNegativeInt,
    emailArchives: NonNegativeInt,
    emailExportFiles: NonNegativeInt,
    restoredNames: NonNegativeInt,
    unsortedFiles: NonNegativeInt,
    versionGroups: NonNegativeInt,
  },
  $I.annote("CorpusOrganizeSummary", {
    description: "Summary counts returned by corpus organize.",
  })
) {}

/**
 * JSON encoder for {@link CorpusOrganizeSummary}.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeSummary, encodeCorpusOrganizeSummaryJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const summary = CorpusOrganizeSummary.make({
 *   canonicalArtifacts: NonNegativeInt.make(0),
 *   clientFiles: NonNegativeInt.make(0),
 *   docketFamilies: NonNegativeInt.make(0),
 *   docketFiles: NonNegativeInt.make(0),
 *   duplicatesSkipped: NonNegativeInt.make(0),
 *   emailArchives: NonNegativeInt.make(0),
 *   emailExportFiles: NonNegativeInt.make(0),
 *   restoredNames: NonNegativeInt.make(0),
 *   unsortedFiles: NonNegativeInt.make(0),
 *   versionGroups: NonNegativeInt.make(0)
 * })
 *
 * Effect.runPromise(encodeCorpusOrganizeSummaryJson(summary)).then((json) => console.log(json.includes("canonicalArtifacts"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusOrganizeSummaryJson = S.encodeUnknownEffect(S.fromJsonString(CorpusOrganizeSummary));

/**
 * Validated options used by `corpus enrich`.
 *
 * @example
 * ```ts
 * import { CorpusEnrichOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = CorpusEnrichOptions.make({ corpusRoot: "/data/corpus" })
 * console.log(options.corpusRoot)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusEnrichOptions extends S.Class<CorpusEnrichOptions>($I`CorpusEnrichOptions`)(
  {
    corpusRoot: S.String,
    lookupDelayMillis: S.optionalKey(S.Finite),
    maxLookups: S.optionalKey(S.Finite),
  },
  $I.annote("CorpusEnrichOptions", {
    description: "Validated options used by corpus enrich.",
  })
) {}

/**
 * One resolved USPTO identifier row of the enrichment manifest.
 *
 * @example
 * ```ts
 * import { CorpusEnrichmentRecord } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const record = CorpusEnrichmentRecord.make({
 *   candidate: "10772255",
 *   candidateKind: "patent",
 *   docketFamilies: ["10109"],
 *   occurrenceCount: NonNegativeInt.make(3),
 *   parentApplicationNumbers: [],
 *   patentNumber: "10772255",
 *   status: "resolved"
 * })
 * console.log(record.candidateKind) // "patent"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusEnrichmentRecord extends S.Class<CorpusEnrichmentRecord>($I`CorpusEnrichmentRecord`)(
  {
    applicationNumber: S.optionalKey(S.String),
    candidate: S.NonEmptyString,
    candidateKind: LiteralKit(["application", "patent"]),
    docketFamilies: S.Array(S.String),
    firstApplicantName: S.optionalKey(S.String),
    firstInventorName: S.optionalKey(S.String),
    inventionTitle: S.optionalKey(S.String),
    occurrenceCount: NonNegativeInt,
    parentApplicationNumbers: S.Array(S.String),
    patentNumber: S.optionalKey(S.String),
    status: LiteralKit(["resolved", "not-found", "failed"]),
  },
  $I.annote("CorpusEnrichmentRecord", {
    description: "JSONL-safe USPTO enrichment row for one corpus-derived identifier candidate.",
  })
) {}

/**
 * JSONL encoder for {@link CorpusEnrichmentRecord}.
 *
 * @example
 * ```ts
 * import { CorpusEnrichmentRecord, encodeCorpusEnrichmentRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const record = CorpusEnrichmentRecord.make({
 *   candidate: "10772255",
 *   candidateKind: "patent",
 *   docketFamilies: [],
 *   occurrenceCount: NonNegativeInt.make(1),
 *   parentApplicationNumbers: [],
 *   status: "not-found"
 * })
 *
 * Effect.runPromise(encodeCorpusEnrichmentRecordJson(record)).then((json) => console.log(json.includes("patent"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusEnrichmentRecordJson = S.encodeUnknownEffect(S.fromJsonString(CorpusEnrichmentRecord));

/**
 * Summary counts returned by `corpus enrich`.
 *
 * @example
 * ```ts
 * import { CorpusEnrichSummary } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = CorpusEnrichSummary.make({
 *   applicationCandidates: NonNegativeInt.make(1),
 *   failedLookups: NonNegativeInt.make(0),
 *   familyAnchors: NonNegativeInt.make(1),
 *   notFound: NonNegativeInt.make(0),
 *   patentCandidates: NonNegativeInt.make(2),
 *   resolved: NonNegativeInt.make(2)
 * })
 * console.log(summary.resolved) // 2
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusEnrichSummary extends S.Class<CorpusEnrichSummary>($I`CorpusEnrichSummary`)(
  {
    applicationCandidates: NonNegativeInt,
    failedLookups: NonNegativeInt,
    familyAnchors: NonNegativeInt,
    notFound: NonNegativeInt,
    patentCandidates: NonNegativeInt,
    resolved: NonNegativeInt,
  },
  $I.annote("CorpusEnrichSummary", {
    description: "Summary counts returned by corpus enrich.",
  })
) {}

/**
 * JSON encoder for {@link CorpusEnrichSummary}.
 *
 * @example
 * ```ts
 * import { CorpusEnrichSummary, encodeCorpusEnrichSummaryJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const summary = CorpusEnrichSummary.make({
 *   applicationCandidates: NonNegativeInt.make(0),
 *   failedLookups: NonNegativeInt.make(0),
 *   familyAnchors: NonNegativeInt.make(0),
 *   notFound: NonNegativeInt.make(0),
 *   patentCandidates: NonNegativeInt.make(0),
 *   resolved: NonNegativeInt.make(0)
 * })
 *
 * Effect.runPromise(encodeCorpusEnrichSummaryJson(summary)).then((json) => console.log(json.includes("resolved"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusEnrichSummaryJson = S.encodeUnknownEffect(S.fromJsonString(CorpusEnrichSummary));

/**
 * Validated options used by `corpus salvage`.
 *
 * @example
 * ```ts
 * import { CorpusSalvageOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = CorpusSalvageOptions.make({ corpusRoot: "/data/corpus" })
 * console.log(options.corpusRoot)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusSalvageOptions extends S.Class<CorpusSalvageOptions>($I`CorpusSalvageOptions`)(
  {
    corpusRoot: S.String,
    dedupe: S.optionalKey(S.Boolean),
    runLabel: S.optionalKey(S.NonEmptyString),
    sampleStride: S.optionalKey(S.Finite),
    sources: S.optionalKey(CorpusSalvageSourceSpec.pipe(S.Array)),
  },
  $I.annote("CorpusSalvageOptions", {
    title: "Corpus Salvage Options",
    description: "Validated options used by corpus salvage verification or copy runs.",
  })
) {}

/**
 * Summary counts returned by `corpus salvage`.
 *
 * @example
 * ```ts
 * import { CorpusSalvageSummary } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = CorpusSalvageSummary.make({
 *   bytesChecked: NonNegativeInt.make(11),
 *   matched: NonNegativeInt.make(1),
 *   mismatched: NonNegativeInt.make(0),
 *   missing: NonNegativeInt.make(0),
 *   recordsChecked: NonNegativeInt.make(1)
 * })
 * console.log(summary.matched) // 1
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusSalvageSummary extends S.Class<CorpusSalvageSummary>($I`CorpusSalvageSummary`)(
  {
    bytesChecked: NonNegativeInt,
    matched: NonNegativeInt,
    mismatched: NonNegativeInt,
    missing: NonNegativeInt,
    recordsChecked: NonNegativeInt,
  },
  $I.annote("CorpusSalvageSummary", {
    description: "Summary counts returned by corpus salvage verification.",
  })
) {}

/**
 * JSON encoder for {@link CorpusSalvageSummary}.
 *
 * @example
 * ```ts
 * import { CorpusSalvageSummary, encodeCorpusSalvageSummaryJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const summary = CorpusSalvageSummary.make({
 *   bytesChecked: NonNegativeInt.make(0),
 *   matched: NonNegativeInt.make(0),
 *   mismatched: NonNegativeInt.make(0),
 *   missing: NonNegativeInt.make(0),
 *   recordsChecked: NonNegativeInt.make(0)
 * })
 *
 * Effect.runPromise(encodeCorpusSalvageSummaryJson(summary)).then((json) => console.log(json.includes("\"matched\":0"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusSalvageSummaryJson = S.encodeUnknownEffect(S.fromJsonString(CorpusSalvageSummary));

/**
 * Validated options used by `corpus archive-move`.
 *
 * @example
 * ```ts
 * import { CorpusArchiveMoveOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = CorpusArchiveMoveOptions.make({
 *   archiveRoot: "/tmp/archive",
 *   provenancePaths: ["/tmp/corpus/raw/run-a/provenance.jsonl"],
 *   sourcePaths: ["/tmp/source-a"]
 * })
 * console.log(options.sourcePaths.length) // 1
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusArchiveMoveOptions extends S.Class<CorpusArchiveMoveOptions>($I`CorpusArchiveMoveOptions`)(
  {
    archiveRoot: S.NonEmptyString,
    provenancePaths: S.Array(S.NonEmptyString),
    sourcePaths: S.Array(S.NonEmptyString),
  },
  $I.annote("CorpusArchiveMoveOptions", {
    title: "Corpus Archive Move Options",
    description: "Validated source, archive-root, and provenance manifest paths used by corpus archive-move.",
  })
) {}

/**
 * One JSONL row written after a successful archive move.
 *
 * @example
 * ```ts
 * import { CorpusArchiveMoveManifestRecord } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const record = CorpusArchiveMoveManifestRecord.make({
 *   archivePath: "/tmp/archive/source-a",
 *   copiedCount: NonNegativeInt.make(1),
 *   fileCount: NonNegativeInt.make(1),
 *   movedAt: "2026-06-11T15:00:00Z",
 *   originPath: "/tmp/source-a",
 *   provenanceOnlyCount: NonNegativeInt.make(0)
 * })
 * console.log(record.fileCount) // 1
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusArchiveMoveManifestRecord extends S.Class<CorpusArchiveMoveManifestRecord>(
  $I`CorpusArchiveMoveManifestRecord`
)(
  {
    archivePath: S.NonEmptyString,
    copiedCount: NonNegativeInt,
    fileCount: NonNegativeInt,
    movedAt: S.NonEmptyString,
    originPath: S.NonEmptyString,
    provenanceOnlyCount: NonNegativeInt,
  },
  $I.annote("CorpusArchiveMoveManifestRecord", {
    title: "Corpus Archive Move Manifest Record",
    description: "JSONL-safe archive move record for one source moved after provenance verification.",
  })
) {}

/**
 * JSONL encoder for {@link CorpusArchiveMoveManifestRecord}.
 *
 * @example
 * ```ts
 * import { CorpusArchiveMoveManifestRecord, encodeCorpusArchiveMoveManifestRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const record = CorpusArchiveMoveManifestRecord.make({
 *   archivePath: "/tmp/archive/source-a",
 *   copiedCount: NonNegativeInt.make(1),
 *   fileCount: NonNegativeInt.make(1),
 *   movedAt: "2026-06-11T15:00:00Z",
 *   originPath: "/tmp/source-a",
 *   provenanceOnlyCount: NonNegativeInt.make(0)
 * })
 *
 * Effect.runPromise(encodeCorpusArchiveMoveManifestRecordJson(record)).then((json) => console.log(json.includes("source-a"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusArchiveMoveManifestRecordJson = S.encodeUnknownEffect(
  S.fromJsonString(CorpusArchiveMoveManifestRecord)
);

/**
 * Summary counts returned by `corpus archive-move`.
 *
 * @example
 * ```ts
 * import { CorpusArchiveMoveSummary } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = CorpusArchiveMoveSummary.make({
 *   copiedRecords: NonNegativeInt.make(1),
 *   filesCovered: NonNegativeInt.make(1),
 *   provenanceOnlyRecords: NonNegativeInt.make(0),
 *   sourcesMoved: NonNegativeInt.make(1)
 * })
 * console.log(summary.sourcesMoved) // 1
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusArchiveMoveSummary extends S.Class<CorpusArchiveMoveSummary>($I`CorpusArchiveMoveSummary`)(
  {
    copiedRecords: NonNegativeInt,
    filesCovered: NonNegativeInt,
    provenanceOnlyRecords: NonNegativeInt,
    sourcesMoved: NonNegativeInt,
  },
  $I.annote("CorpusArchiveMoveSummary", {
    title: "Corpus Archive Move Summary",
    description: "Summary counts returned by corpus archive-move after moving provenance-covered sources.",
  })
) {}

/**
 * Per-run counts included in the corpus catalog summary.
 *
 * @example
 * ```ts
 * import { CorpusCatalogRunSummary } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const run = CorpusCatalogRunSummary.make({
 *   distinctDigests: NonNegativeInt.make(2),
 *   newDistinctDigests: NonNegativeInt.make(1),
 *   recordCount: NonNegativeInt.make(3),
 *   runLabel: "2026-07-refresh"
 * })
 * console.log(run.newDistinctDigests) // 1
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusCatalogRunSummary extends S.Class<CorpusCatalogRunSummary>($I`CorpusCatalogRunSummary`)(
  {
    distinctDigests: NonNegativeInt,
    newDistinctDigests: NonNegativeInt,
    recordCount: NonNegativeInt,
    runLabel: S.NonEmptyString,
  },
  $I.annote("CorpusCatalogRunSummary", {
    title: "Corpus Catalog Run Summary",
    description: "Per-run record, distinct-digest, and incremental distinct-digest counts emitted by corpus catalog.",
  })
) {}

/**
 * Summary counts returned by `corpus catalog`.
 *
 * @example
 * ```ts
 * import { CorpusCatalogRunSummary, CorpusCatalogSummary } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = CorpusCatalogSummary.make({
 *   distinctDigests: NonNegativeInt.make(1),
 *   duplicateFiles: NonNegativeInt.make(0),
 *   duplicateSets: NonNegativeInt.make(0),
 *   matchedRestorations: NonNegativeInt.make(1),
 *   redundantBytes: NonNegativeInt.make(0),
 *   runs: [
 *     CorpusCatalogRunSummary.make({
 *       distinctDigests: NonNegativeInt.make(1),
 *       newDistinctDigests: NonNegativeInt.make(1),
 *       recordCount: NonNegativeInt.make(1),
 *       runLabel: "base"
 *     })
 *   ],
 *   sourceFiles: NonNegativeInt.make(1),
 *   totalBytes: NonNegativeInt.make(11),
 *   unmatchedContentFiles: NonNegativeInt.make(0),
 *   unmatchedMetadataFiles: NonNegativeInt.make(0)
 * })
 * console.log(summary.sourceFiles) // 1
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusCatalogSummary extends S.Class<CorpusCatalogSummary>($I`CorpusCatalogSummary`)(
  {
    distinctDigests: NonNegativeInt,
    duplicateFiles: NonNegativeInt,
    duplicateSets: NonNegativeInt,
    matchedRestorations: NonNegativeInt,
    redundantBytes: NonNegativeInt,
    runs: S.Array(CorpusCatalogRunSummary),
    sourceFiles: NonNegativeInt,
    totalBytes: NonNegativeInt,
    unmatchedContentFiles: NonNegativeInt,
    unmatchedMetadataFiles: NonNegativeInt,
  },
  $I.annote("CorpusCatalogSummary", {
    description: "Summary counts returned by corpus catalog.",
  })
) {}

/**
 * JSON encoder for {@link CorpusCatalogSummary}.
 *
 * @example
 * ```ts
 * import { CorpusCatalogRunSummary, CorpusCatalogSummary, encodeCorpusCatalogSummaryJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const summary = CorpusCatalogSummary.make({
 *   distinctDigests: NonNegativeInt.make(1),
 *   duplicateFiles: NonNegativeInt.make(0),
 *   duplicateSets: NonNegativeInt.make(0),
 *   matchedRestorations: NonNegativeInt.make(0),
 *   redundantBytes: NonNegativeInt.make(0),
 *   runs: [
 *     CorpusCatalogRunSummary.make({
 *       distinctDigests: NonNegativeInt.make(1),
 *       newDistinctDigests: NonNegativeInt.make(1),
 *       recordCount: NonNegativeInt.make(1),
 *       runLabel: "base"
 *     })
 *   ],
 *   sourceFiles: NonNegativeInt.make(1),
 *   totalBytes: NonNegativeInt.make(11),
 *   unmatchedContentFiles: NonNegativeInt.make(0),
 *   unmatchedMetadataFiles: NonNegativeInt.make(0)
 * })
 *
 * Effect.runPromise(encodeCorpusCatalogSummaryJson(summary)).then((json) => console.log(json.includes("\"sourceFiles\":1"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusCatalogSummaryJson = S.encodeUnknownEffect(S.fromJsonString(CorpusCatalogSummary));
