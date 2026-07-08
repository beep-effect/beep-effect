/**
 * USPTO enrichment schema models for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.js";

const $I = $RepoCliId.create("commands/Corpus/internal/Enrich.schemas");

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
export const encodeCorpusEnrichmentRecordJson = JsonStringCodec(CorpusEnrichmentRecord).encode;

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
export const encodeCorpusEnrichSummaryJson = JsonStringCodec(CorpusEnrichSummary).encode;
