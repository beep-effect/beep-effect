/**
 * Page-level OCR artifact models for corpus extract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ArtifactId, ContentDigest, OperationId } from "@beep/file-processing/Artifact";
import {
  PageOcrEngineIdentity,
  PageOcrErrorReason,
  PageOcrTiming,
  PageOcrWarning,
} from "@beep/file-processing/PageOcr";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { PosInt } from "../../../internal/schema/PosInt.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/Ocr.schemas");

const UnitInterval = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }));

const pageIdentityFields = {
  artifactId: ArtifactId,
  engine: PageOcrEngineIdentity,
  languages: S.Array(S.NonEmptyString),
  operationId: OperationId,
  pageCount: PosInt,
  pageNumber: PosInt,
  sourceDigest: ContentDigest,
};

/**
 * One engine's successful reading of one page, stored beside the page text it points at.
 *
 * **Details**
 *
 * The row is keyed by source, page and engine, so a second reader adds its own row and its own text file for the same page and neither reading replaces the other. `imageDigest` names the rendered image, which lets two engines prove they read the same pixels.
 *
 * **Example** (Decode a page reading row)
 *
 * ```ts
 * import { CorpusPageReadingRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import * as O from "effect/Option"
 *
 * const sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const identity = `"artifactId":"artifact:${sha256}","engine":{"engineId":"tesseract","family":"tesseract","version":"5"},"languages":["eng"],"operationId":"operation:${sha256}","pageCount":1,"pageNumber":1,"sourceDigest":"sha256:${sha256}"`
 * const row = `{${identity},"charCount":14,"confidence":0.9,"imageDigest":"sha256:${sha256}","status":"read","textDigest":"sha256:${sha256}","textPath":"ocr/text/x/1.tesseract.txt","timing":{"recognizeMillis":700},"warnings":[]}`
 *
 * console.log(O.isSome(CorpusPageReadingRecordJson.decodeOption(row))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorpusPageReadRecord extends S.Class<CorpusPageReadRecord>($I`CorpusPageReadRecord`)(
  {
    ...pageIdentityFields,
    charCount: S.Natural,
    confidence: S.optionalKey(UnitInterval),
    imageDigest: ContentDigest,
    status: S.Literal("read"),
    textDigest: ContentDigest,
    textPath: PosixPath,
    timing: PageOcrTiming,
    warnings: S.Array(PageOcrWarning),
  },
  $I.annote("CorpusPageReadRecord", {
    description:
      "One engine's reading of one page: character count, mean confidence, and the path and digest of the page text.",
  })
) {}

/**
 * Why a page has no reading: the page OCR failure reasons plus a failed render.
 *
 * **Example** (List the page failure reasons)
 *
 * ```ts
 * import { CorpusPageFailureReason } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(CorpusPageFailureReason.literals.includes("render-failed")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorpusPageFailureReason = LiteralKit([...PageOcrErrorReason.literals, "render-failed"]).pipe(
  $I.annoteSchema("CorpusPageFailureReason", {
    description: "Why a page has no reading: the page OCR failure reasons plus a failed render.",
  })
);

/**
 * Type for {@link CorpusPageFailureReason}.
 *
 * **Example** (Annotate a page failure reason)
 *
 * ```ts
 * import type { CorpusPageFailureReason } from "@beep/repo-cli/commands/Corpus"
 *
 * const reason: CorpusPageFailureReason = "recognition-timed-out"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CorpusPageFailureReason = typeof CorpusPageFailureReason.Type;

/**
 * One engine's failed attempt at one page, kept so a crash or timeout is visible and bounded to that page.
 *
 * **Example** (Build a failed page row)
 *
 * ```ts
 * import { CorpusPageFailedRecord } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.isSchema(CorpusPageFailedRecord)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorpusPageFailedRecord extends S.Class<CorpusPageFailedRecord>($I`CorpusPageFailedRecord`)(
  {
    ...pageIdentityFields,
    message: S.String,
    reason: CorpusPageFailureReason,
    status: S.Literal("failed"),
  },
  $I.annote("CorpusPageFailedRecord", {
    description: "One engine's failed attempt at one page, with the sanitized reason.",
  })
) {}

/**
 * Row of `ocr/pages/<operationId>.jsonl`: one engine's reading of, or failure on, one page.
 *
 * **Example** (Branch on the row status)
 *
 * ```ts
 * import { CorpusPageReadingRecord } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(Object.keys(CorpusPageReadingRecord.cases)) // ["read", "failed"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CorpusPageReadingRecord = S.Union([CorpusPageReadRecord, CorpusPageFailedRecord]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("CorpusPageReadingRecord", {
    description: "One engine's reading of, or failure on, one page of a source.",
  })
);

/**
 * Type for {@link CorpusPageReadingRecord}.
 *
 * **Example** (Annotate a page row)
 *
 * ```ts
 * import type { CorpusPageReadingRecord } from "@beep/repo-cli/commands/Corpus"
 *
 * const describe = (row: CorpusPageReadingRecord) => `${row.pageNumber}: ${row.status}`
 * console.log(typeof describe) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CorpusPageReadingRecord = typeof CorpusPageReadingRecord.Type;

/**
 * JSON text codec for {@link CorpusPageReadingRecord} rows.
 *
 * **Example** (Reject a truncated page row)
 *
 * ```ts
 * import { CorpusPageReadingRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(CorpusPageReadingRecordJson.decodeOption('{"status":"read"'))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CorpusPageReadingRecordJson = JsonStringCodec(CorpusPageReadingRecord);

/**
 * Page counts of the OCR pass over one source, carried in its outcome marker.
 *
 * **Example** (Count read and failed pages)
 *
 * ```ts
 * import { CorpusExtractOcrCounts } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * const counts = CorpusExtractOcrCounts.make({ failedPageCount: S.Natural.make(1), readPageCount: S.Natural.make(3) })
 * console.log(counts.readPageCount) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorpusExtractOcrCounts extends S.Class<CorpusExtractOcrCounts>($I`CorpusExtractOcrCounts`)(
  {
    failedPageCount: S.Natural,
    readPageCount: S.Natural,
  },
  $I.annote("CorpusExtractOcrCounts", {
    description: "How many pages of one source the OCR pass read and how many it failed.",
  })
) {}

/**
 * Report of `ocr/languages.json`: the engine that ran, its installed language models, and the models sources asked for that are not installed.
 *
 * **Example** (Report a missing language model)
 *
 * ```ts
 * import { CorpusOcrLanguageReport } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.isSchema(CorpusOcrLanguageReport)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorpusOcrLanguageReport extends S.Class<CorpusOcrLanguageReport>($I`CorpusOcrLanguageReport`)(
  {
    engine: PageOcrEngineIdentity,
    installed: S.Array(S.NonEmptyString),
    missing: S.Array(S.NonEmptyString),
    scriptDetection: S.Boolean,
  },
  $I.annote("CorpusOcrLanguageReport", {
    description:
      "The OCR engine that ran, its installed language models, the requested models that are missing, and whether script detection was available.",
  })
) {}

/**
 * JSON encoder for {@link CorpusOcrLanguageReport}.
 *
 * **Example** (Reference the report encoder)
 *
 * ```ts
 * import { encodeCorpusOcrLanguageReportJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof encodeCorpusOcrLanguageReportJson) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusOcrLanguageReportJson = JsonStringCodec(CorpusOcrLanguageReport).encode;
