/**
 * Catalog schema models for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { CorpusCopyMode } from "./Salvage.schemas.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/Catalog.schemas");

/**
 * Duplicate-set scope reported by the catalog.
 *
 * **Example** (Validate cross-run scope)
 *
 * ```ts
 * import { CorpusDuplicateScope } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorpusDuplicateScope)("cross-run")) // true
 * ```
 *
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
 * Duplicate-set scope type reported by the catalog.
 *
 * **Example** (Assign cross-run scope type)
 *
 * ```ts
 * import type { CorpusDuplicateScope } from "@beep/repo-cli/commands/Corpus"
 *
 * const scope: CorpusDuplicateScope = "cross-run"
 * console.log(scope) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CorpusDuplicateScope = typeof CorpusDuplicateScope.Type;

/**
 * One catalog occurrence row after provenance manifests are unioned by run.
 *
 * **Example** (Make source file record)
 *
 * ```ts
 * import { CorpusCatalogSourceFileRecord } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt, Sha256Hex } from "@beep/schema"
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
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   sizeBytes: NonNegativeInt.make(0),
 *   sourceLabel: "source-a"
 * })
 * console.log(record.runLabel) // "base"
 * ```
 *
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
 * **Example** (Encode source file JSONL)
 *
 * ```ts
 * import { CorpusCatalogSourceFileRecord, encodeCorpusCatalogSourceFileRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt, Sha256Hex } from "@beep/schema"
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
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   sizeBytes: NonNegativeInt.make(0),
 *   sourceLabel: "source-b"
 * })
 *
 * Effect.runPromise(encodeCorpusCatalogSourceFileRecordJson(record)).then((json) => console.log(json.includes("refresh"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusCatalogSourceFileRecordJson = JsonStringCodec(CorpusCatalogSourceFileRecord).encode;

/**
 * One exact-duplicate digest group reported by the corpus catalog.
 *
 * **Example** (Decode duplicate set record)
 *
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
 *
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
 * **Example** (Encode duplicate set report)
 *
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
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusDuplicateSetReportJson = JsonStringCodec(CorpusDuplicateSetRecord.pipe(S.Array)).encode;

/**
 * Validated options used by `corpus catalog`.
 *
 * **Example** (Make catalog options)
 *
 * ```ts
 * import { CorpusCatalogOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = CorpusCatalogOptions.make({ corpusRoot: "/data/corpus" })
 * console.log(options.corpusRoot)
 * ```
 *
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
 * Per-run counts included in the corpus catalog summary.
 *
 * **Example** (Make run summary counts)
 *
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
 *
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
 * **Example** (Make catalog summary)
 *
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
 *
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
 * **Example** (Encode catalog summary JSON)
 *
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
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusCatalogSummaryJson = JsonStringCodec(CorpusCatalogSummary).encode;
