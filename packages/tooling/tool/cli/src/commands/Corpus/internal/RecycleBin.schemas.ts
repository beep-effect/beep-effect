/**
 * Recycle-bin schema models for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/RecycleBin.schemas");

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
export const encodeCorpusRestorationRecordJson = JsonStringCodec(CorpusRestorationRecord).encode;

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
