/**
 * Extraction schema models for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FileProcessingFailureRecord, SourceProcessingRecord } from "@beep/file-processing/Extraction";
import { SelectedStrategy } from "@beep/file-processing/Strategy";
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { PosInt } from "../../../internal/schema/PosInt.ts";
import { CorpusExtractOcrCounts } from "./Ocr.schemas.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/Extract.schemas");

/**
 * Validated options used by `corpus extract`.
 *
 * **Details**
 *
 * A run against an existing output tree resumes: sources that already carry a
 * complete {@link CorpusExtractOutcomeRecord} are reused and only the rest are
 * extracted. `overwrite` removes the tree first and redoes every source.
 *
 * **Example** (Make extract options)
 *
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
 *
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
    ocr: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    ocrPageTimeoutMillis: S.optionalKey(PosInt),
    outLabel: S.optionalKey(S.String),
    overwrite: S.Boolean,
    pdfinfoPath: S.optionalKey(S.NonEmptyString),
    pdftoppmPath: S.optionalKey(S.NonEmptyString),
    pffexportPath: S.optionalKey(S.String),
    sourceLabel: S.optionalKey(S.String),
    tesseractPath: S.optionalKey(S.NonEmptyString),
    tikaJarPath: S.String,
    tikaTimeoutMillis: S.optionalKey(PosInt),
  },
  $I.annote("CorpusExtractOptions", {
    description:
      "Validated options used by corpus extract. outLabel, when supplied, must be one staging directory name. overwrite forces a full redo; otherwise a run resumes an existing output tree.",
  })
) {}

/**
 * Summary counts returned by `corpus extract`.
 *
 * **Details**
 *
 * `alreadyCompleteCount` counts sources reused from a settled outcome on
 * disk and `extractedCount` the sources this run processed without failing.
 * `succeededCount`, `skippedCount`, and `failedCount` describe the final
 * status of every source, reused or not; `skippedCount` counts sources the
 * engines deferred, never resumed ones. `noEngineFailedCount` is the part of
 * `failedCount` that no engine routes: those failures are settled and are not
 * retried until the engine routing changes, while every other failure is
 * retried by the next run.
 *
 * **Example** (Make extract summary counts)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CorpusExtractSummary } from "@beep/repo-cli/commands/Corpus"
 *
 * const summary = CorpusExtractSummary.make({
 *   alreadyCompleteCount: S.Natural.make(1),
 *   childArtifactCount: S.Natural.make(1),
 *   duplicatesSkipped: S.Natural.make(0),
 *   extractedCount: S.Natural.make(1),
 *   failedCount: S.Natural.make(0),
 *   noEngineFailedCount: S.Natural.make(0),
 *   ocrFailedPageCount: S.Natural.make(0),
 *   ocrPageCount: S.Natural.make(0),
 *   ocrSourceCount: S.Natural.make(0),
 *   skippedCount: S.Natural.make(0),
 *   sourceCount: S.Natural.make(2),
 *   succeededCount: S.Natural.make(2),
 *   textArtifactCount: S.Natural.make(2)
 * })
 * console.log(summary.alreadyCompleteCount + summary.extractedCount) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorpusExtractSummary extends S.Class<CorpusExtractSummary>($I`CorpusExtractSummary`)(
  {
    alreadyCompleteCount: S.Natural,
    childArtifactCount: S.Natural,
    duplicatesSkipped: S.Natural,
    extractedCount: S.Natural,
    failedCount: S.Natural,
    noEngineFailedCount: S.Natural,
    ocrFailedPageCount: S.Natural,
    ocrPageCount: S.Natural,
    ocrSourceCount: S.Natural,
    skippedCount: S.Natural,
    sourceCount: S.Natural,
    succeededCount: S.Natural,
    textArtifactCount: S.Natural,
  },
  $I.annote("CorpusExtractSummary", {
    description:
      "Summary counts returned by corpus extract: sources reused from disk, sources processed now, final statuses, and the failures no engine routes.",
  })
) {}

/**
 * JSON encoder for {@link CorpusExtractSummary}.
 *
 * **Example** (Encode extract summary JSON)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CorpusExtractSummary, encodeCorpusExtractSummaryJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const summary = CorpusExtractSummary.make({
 *   alreadyCompleteCount: S.Natural.make(0),
 *   childArtifactCount: S.Natural.make(0),
 *   duplicatesSkipped: S.Natural.make(0),
 *   extractedCount: S.Natural.make(1),
 *   failedCount: S.Natural.make(0),
 *   noEngineFailedCount: S.Natural.make(0),
 *   ocrFailedPageCount: S.Natural.make(0),
 *   ocrPageCount: S.Natural.make(0),
 *   ocrSourceCount: S.Natural.make(0),
 *   skippedCount: S.Natural.make(0),
 *   sourceCount: S.Natural.make(1),
 *   succeededCount: S.Natural.make(1),
 *   textArtifactCount: S.Natural.make(1)
 * })
 *
 * Effect.runPromise(encodeCorpusExtractSummaryJson(summary)).then((json) => console.log(json.includes("\"sourceCount\":1"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusExtractSummaryJson = JsonStringCodec(CorpusExtractSummary).encode;

/**
 * Completion marker for one source, written last and atomically under
 * `outcomes/<sha256>.json` in the extract output tree.
 *
 * **Details**
 *
 * The marker is the only evidence `corpus extract` accepts that a source is
 * done: it is staged in a temporary file and renamed into place after every
 * text, metadata, and child artifact for the source is on disk, so a killed
 * run leaves either a whole marker or none. Only settled outcomes are
 * recorded: succeeded, deferred, and failures that no engine routes. The last
 * carry `routingKey`, a fingerprint of the engine routing and the source's
 * format, and are reused only while it still matches; every other failure
 * carries no marker and is retried. `exportChildren` and the source record's
 * relative path are stored so a resumed run reuses a marker only for the same
 * inputs.
 *
 * **Example** (Decode an extract outcome marker)
 *
 * ```ts
 * import { CorpusExtractOutcomeRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const sourceRecord = `{"artifactId":"artifact:${sha256}","digest":"sha256:${sha256}","format":"unknown","operationId":"operation:${sha256}","relativePath":"source-a/empty.bin","sizeBytes":0,"skipReason":"unsupported-format","status":"skipped"}`
 * const strategy = `{"disposition":"deferred","engine":"auto","format":"unknown","operationKind":"process","skipReason":"unsupported-format"}`
 * const marker = `{"childArtifactCount":0,"exportChildren":true,"sha256":"${sha256}","sourceRecord":${sourceRecord},"strategy":${strategy}}`
 *
 * Effect.runPromise(CorpusExtractOutcomeRecordJson.decode(marker)).then((record) =>
 *   console.log(record.sourceRecord.status) // "skipped"
 * )
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorpusExtractOutcomeRecord extends S.Class<CorpusExtractOutcomeRecord>($I`CorpusExtractOutcomeRecord`)(
  {
    childArtifactCount: S.Natural,
    exportChildren: S.Boolean,
    failure: S.OptionFromOptionalKey(FileProcessingFailureRecord),
    ocr: S.OptionFromOptionalKey(CorpusExtractOcrCounts),
    routingKey: S.OptionFromOptionalKey(Sha256Hex),
    sha256: Sha256Hex,
    sourceRecord: SourceProcessingRecord,
    strategy: SelectedStrategy,
  },
  $I.annote("CorpusExtractOutcomeRecord", {
    description:
      "Atomically written completion marker for one corpus extract source: the settled outcome plus the inputs that make it reusable on resume.",
  })
) {}

/**
 * JSON text codec for {@link CorpusExtractOutcomeRecord} markers.
 *
 * **Example** (Reject a truncated outcome marker)
 *
 * ```ts
 * import { CorpusExtractOutcomeRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(CorpusExtractOutcomeRecordJson.decodeOption('{"childArtifactCount":0'))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CorpusExtractOutcomeRecordJson = JsonStringCodec(CorpusExtractOutcomeRecord);
