/**
 * Archive-move schema models for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/ArchiveMove.schemas");

/**
 * Validated options used by `corpus archive-move`.
 *
 * **Example** (Make archive move options)
 *
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
 *
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
 * **Example** (Create manifest record)
 *
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
 *
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
 * **Example** (Encode manifest record JSON)
 *
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
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusArchiveMoveManifestRecordJson = JsonStringCodec(CorpusArchiveMoveManifestRecord).encode;

/**
 * Summary counts returned by `corpus archive-move`.
 *
 * **Example** (Make archive move summary)
 *
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
 *
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
