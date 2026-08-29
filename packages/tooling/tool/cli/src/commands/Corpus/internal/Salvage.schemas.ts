/**
 * Salvage and provenance schema models for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/Salvage.schemas");

/**
 * Copy disposition recorded for a salvaged corpus file.
 *
 * **Example** (Validate copy mode values)
 *
 * ```ts
 * import { CorpusCopyMode } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorpusCopyMode)("copied")) // true
 * console.log(S.is(CorpusCopyMode)("provenance-only")) // true
 * ```
 *
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
 * Copy disposition type recorded for a salvaged corpus file.
 *
 * **Example** (Assign typed copy mode)
 *
 * ```ts
 * import type { CorpusCopyMode } from "@beep/repo-cli/commands/Corpus"
 *
 * const mode: CorpusCopyMode = "copied"
 * console.log(mode) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CorpusCopyMode = typeof CorpusCopyMode.Type;

/**
 * Digest-to-raw-path row loaded from the corpus catalog or provenance manifests.
 *
 * **Example** (Build catalog digest row)
 *
 * ```ts
 * import { CorpusCatalogDigestRow } from "@beep/repo-cli/commands/Corpus"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const row = CorpusCatalogDigestRow.make({
 *   destPath: "/tmp/corpus/raw/source-a/a.txt",
 *   sha256: Sha256Hex.make("8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8")
 * })
 * console.log(row.destPath)
 * ```
 *
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
 * One salvaged-file row of the corpus provenance manifest.
 *
 * **Example** (Decode provenance record)
 *
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
 *
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
 * **Example** (Decode provenance JSONL line)
 *
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
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeCorpusProvenanceRecordJson = JsonStringCodec(CorpusProvenanceRecord).decode;

/**
 * JSONL encoder for {@link CorpusProvenanceRecord}.
 *
 * **Example** (Encode provenance record JSON)
 *
 * ```ts
 * import { CorpusProvenanceRecord, encodeCorpusProvenanceRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt, Sha256Hex } from "@beep/schema"
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
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   sizeBytes: NonNegativeInt.make(0),
 *   sourceLabel: "source-a"
 * })
 *
 * Effect.runPromise(encodeCorpusProvenanceRecordJson(record)).then((json) => console.log(json.includes("copied"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusProvenanceRecordJson = JsonStringCodec(CorpusProvenanceRecord).encode;

/**
 * One labeled source passed to a corpus salvage copy run.
 *
 * **Example** (Create salvage source spec)
 *
 * ```ts
 * import { CorpusSalvageSourceSpec } from "@beep/repo-cli/commands/Corpus"
 *
 * const spec = CorpusSalvageSourceSpec.make({ sourceLabel: "source-a", sourcePath: "/tmp/source-a" })
 * console.log(spec.sourceLabel) // "source-a"
 * ```
 *
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
 * **Example** (Build salvage origin file)
 *
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
 *
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
 * Validated options used by `corpus salvage`.
 *
 * **Example** (Create salvage options)
 *
 * ```ts
 * import { CorpusSalvageOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = CorpusSalvageOptions.make({ corpusRoot: "/data/corpus" })
 * console.log(options.corpusRoot)
 * ```
 *
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
 * **Example** (Build salvage summary counts)
 *
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
 *
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
 * **Example** (Encode salvage summary JSON)
 *
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
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusSalvageSummaryJson = JsonStringCodec(CorpusSalvageSummary).encode;
