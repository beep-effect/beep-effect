/**
 * Server-only six-form extraction contracts over canonical source evidence.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { CitationDocument } from "@beep/law-practice-domain/values";
import { CourtReporterArtifactVersion } from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationEngineAbsoluteMaxima, CitationEngineLimits } from "../CitationEngine/CitationEngine.limits.ts";

const $I = $LawPracticeUseCasesId.create("CitationExtractor/CitationExtractor.models");
const max = CitationEngineAbsoluteMaxima;
const sameSource = S.toEquivalence(SourceTextIdentity);

/**
 * Exact plain text and its expected canonical identity before source verification.
 * Installation policy and executable behavior never come from this request.
 *
 * **Example** (Inspect the canonical source input)
 * ```ts
 * import { CitationExtractorInput } from "@beep/law-practice-use-cases/server"
 * console.log(CitationExtractorInput.fields.source !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationExtractorInput extends S.Opaque<CitationExtractorInput, { readonly brand: unique symbol }>()(
  S.Struct({
    source: SourceTextIdentity,
    sourceText: S.String.check(S.isMaxLength(max.sourceUtf16)),
  }).pipe(
    $I.annoteSchema("CitationExtractorInput", {
      description: "Bounded primitive source and expected identity; neither field grants verified source authority.",
    })
  )
) {}

/**
 * Completed six-form extraction diagnostics tied to the installed artifact and
 * policy. Outside-profile counts describe excluded recognizer tokens, not an
 * exhaustive inventory of every unsupported citation in the source.
 *
 * **Details**
 * The profile covers full cases, short cases, Id., supra, title 35 U.S.C. and
 * title 37 C.F.R. It makes no CPython parity, tokenizer or pattern-count claim.
 * The artifact commits the trusted installation, projection and linking rules.
 *
 * **Example** (Inspect the pinned recognizer)
 * ```ts
 * import { CitationExtractorReport } from "@beep/law-practice-use-cases/server"
 * console.log(CitationExtractorReport.fields.recognizerVersion !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationExtractorReport extends S.Opaque<CitationExtractorReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("citation-extractor-report/v1"),
    profile: S.tag("six-form/v1"),
    recognizer: S.tag("eyecite-ts"),
    recognizerVersion: S.tag("0.34.2"),
    engineArtifact: Sha256Hex,
    vocabularyVersion: CourtReporterArtifactVersion,
    limits: CitationEngineLimits,
    recognizedMentions: S.Natural.check(S.isLessThanOrEqualTo(max.mentions)),
    outsideProfile: S.Natural.check(S.isLessThanOrEqualTo(max.candidates)),
  })
    .check(
      S.makeFilter(
        ({ recognizedMentions, outsideProfile, limits }) =>
          recognizedMentions <= limits.mentions && recognizedMentions + outsideProfile <= limits.candidates,
        $I.annote("ReportCounts", {
          description:
            "Verified mentions and excluded recognizer tokens fit the captured candidate and mention ceilings.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationExtractorReport", {
        description:
          "Source-free six-form completion counts, pinned recognizer, artifact and effective execution policy.",
      })
    )
) {}

type ResultFields = {
  readonly source: S.Codec<VerifiedSourceText>;
  readonly document: typeof CitationDocument;
  readonly report: typeof CitationExtractorReport;
};
const ResultFields: ResultFields = {
  source: VerifiedSourceText,
  document: CitationDocument,
  report: CitationExtractorReport,
};

/**
 * Atomically completed verified source, resolved citation document and truthful
 * six-form diagnostics. Structural decoding cannot manufacture source proofs.
 *
 * **Example** (Inspect the verified extraction result)
 * ```ts
 * import { CitationExtractorResult } from "@beep/law-practice-use-cases/server"
 * console.log(CitationExtractorResult.fields.document !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationExtractorResult extends S.Opaque<CitationExtractorResult, { readonly brand: unique symbol }>()(
  S.Struct(ResultFields)
    .check(
      S.makeFilter(
        ({ source, document, report }) =>
          sameSource(source.source, document.source) && document.engineArtifact === report.engineArtifact,
        $I.annote("ResultIdentity", {
          description: "Verified source, document and completion report retain one source and installation artifact.",
        })
      ),
      S.makeFilter(
        ({ source, document, report }) =>
          Str.length(source.sourceText) <= report.limits.sourceUtf16 &&
          A.length(document.mentions) === report.recognizedMentions &&
          A.length(document.authorities) <= report.limits.authorities,
        $I.annote("ResultCounts", {
          description:
            "Canonical text, verified mention counts and authorities agree with the captured policy and report.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationExtractorResult", {
        description: "Server capability carrying canonical evidence, a resolved document and coherent six-form report.",
      })
    )
) {}
