/**
 * Extraction request, candidate, and result models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { ExtractionExample, ExtractionTarget } from "@beep/langextract/Target";
import { DocumentId } from "@beep/nlp/Core";
import { Contract, UnitInterval } from "@beep/nlp/Handoff";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  MAX_CANDIDATE_ATTRIBUTES,
  MAX_CANDIDATE_TEXT_LENGTH,
  MAX_REQUEST_EXAMPLES,
  MAX_REQUEST_TEXT_LENGTH,
} from "./Extraction.config.ts";

const $I = $LangExtractId.create("Extraction");

const ExtractionCandidateLabel = S.NonEmptyString.check(
  S.isPattern(
    /\S/u,
    $I.annote("ExtractionCandidateLabelNonBlankCheck", {
      title: "Non-Blank Extraction Candidate Label",
      description: "Checks that an extraction candidate label contains at least one non-whitespace character.",
      message: "Extraction candidate labels cannot be blank.",
    })
  ),
  S.isMaxLength(
    MAX_CANDIDATE_TEXT_LENGTH,
    $I.annote("ExtractionCandidateLabelMaxLengthCheck", {
      title: "Extraction Candidate Label Length",
      description: "Checks that an extraction candidate label stays within the bounded model-output length.",
      message: `Extraction candidate label must be ${MAX_CANDIDATE_TEXT_LENGTH} characters or fewer.`,
    })
  )
).pipe(
  $I.annoteSchema("ExtractionCandidateLabel", {
    description: "Non-blank, bounded label emitted for one extraction candidate.",
  })
);

const ExtractionCandidateText = S.NonEmptyString.check(
  S.isPattern(
    /\S/u,
    $I.annote("ExtractionCandidateTextNonBlankCheck", {
      title: "Non-Blank Extraction Candidate Text",
      description: "Checks that extraction evidence contains at least one non-whitespace character.",
      message: "Extraction candidate text cannot be blank.",
    })
  ),
  S.isMaxLength(
    MAX_CANDIDATE_TEXT_LENGTH,
    $I.annote("ExtractionCandidateTextMaxLengthCheck", {
      title: "Extraction Candidate Text Length",
      description: "Checks that extraction candidate source text stays within the bounded model-output length.",
      message: `Extraction candidate text must be ${MAX_CANDIDATE_TEXT_LENGTH} characters or fewer.`,
    })
  )
).pipe(
  $I.annoteSchema("ExtractionCandidateText", {
    description: "Non-blank, bounded source evidence emitted for one extraction candidate.",
  })
);

/**
 * Alignment status assigned to a parsed extraction candidate.
 *
 * **Example** (Check match_exact status)
 *
 * ```ts
 * import { AlignmentStatus } from "@beep/langextract/Extraction"
 *
 * console.log(AlignmentStatus.is.match_exact("match_exact"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AlignmentStatus = LiteralKit([
  "match_exact",
  "match_lesser",
  "match_minimal_fold",
  "match_fuzzy",
  "unaligned",
]).pipe(
  $I.annoteSchema("AlignmentStatus", {
    description: "Deterministic source-alignment status for a parsed extraction candidate.",
  })
);

/**
 * {@inheritDoc AlignmentStatus}
 * @category models
 * @since 0.0.0
 */
export type AlignmentStatus = typeof AlignmentStatus.Type;

/**
 * Options controlling provider-neutral extraction and alignment.
 *
 * **Example** (Build extraction options)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LangExtractOptions } from "@beep/langextract/Extraction"
 * import { UnitInterval } from "@beep/nlp/Handoff"
 * import * as O from "effect/Option"
 *
 * console.log(LangExtractOptions.make({
 *   fuzzyThreshold: UnitInterval.makeOption(0.9),
 *   maxExtractions: S.Natural.makeOption(5)
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LangExtractOptions extends S.Opaque<LangExtractOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    fuzzyThreshold: UnitInterval.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    maxExtractions: S.Natural.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("LangExtractOptions", {
      description: "Options for model parsing and deterministic source alignment.",
    })
  )
) {}

/**
 * Candidate extraction decoded from model output before source alignment.
 *
 * **Example** (Create extraction candidate)
 *
 * ```ts
 * import { ExtractionCandidate } from "@beep/langextract/Extraction"
 * import { UnitInterval } from "@beep/nlp/Handoff"
 * import * as O from "effect/Option"
 *
 * console.log(ExtractionCandidate.make({
 *   label: "person",
 *   text: "Ada Lovelace",
 *   confidence: UnitInterval.makeOption(0.98)
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionCandidate extends S.Opaque<ExtractionCandidate, { readonly brand: unique symbol }>()(
  S.Struct({
    attributes: S.Record(S.String, S.String).pipe(
      S.check(
        S.isMaxProperties(
          MAX_CANDIDATE_ATTRIBUTES,
          $I.annote("ExtractionCandidateAttributesMaxPropertiesCheck", {
            title: "Extraction Candidate Attribute Limit",
            description: "Checks that one extraction candidate stays within the bounded attribute count.",
            message: `Extraction candidate attributes must have at most ${MAX_CANDIDATE_ATTRIBUTES} entries.`,
          })
        )
      ),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    confidence: UnitInterval.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    label: ExtractionCandidateLabel,
    text: ExtractionCandidateText,
  }).pipe(
    $I.annoteSchema("ExtractionCandidate", {
      description: "Model-emitted extraction candidate before deterministic source alignment.",
    })
  )
) {}

const GroundedExtractionCommonFields = {
  attributes: ExtractionCandidate.fields.attributes,
  confidence: ExtractionCandidate.fields.confidence,
  label: ExtractionCandidate.fields.label,
  text: ExtractionCandidate.fields.text,
};

const GroundedExtractionAlignedFields = {
  ...GroundedExtractionCommonFields,
  matchedText: S.NonEmptyString,
  span: Contract.Span,
};

/**
 * Source-grounded extraction aligned by an exact text match.
 *
 * **Example** (Ground a party name found verbatim)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GroundedExtraction, GroundedExtractionMatchExact } from "@beep/langextract/Extraction"
 * import { Contract } from "@beep/nlp/Handoff"
 *
 * const party = GroundedExtractionMatchExact.make({
 *   label: "party",
 *   text: "Acme Robotics, Inc.",
 *   matchedText: "Acme Robotics, Inc.",
 *   span: Contract.Span.make({ start: S.Natural.make(17), end: S.Natural.make(36) })
 * })
 *
 * console.log(party.alignmentStatus) // => "match_exact"
 * console.log(GroundedExtraction.guards.match_exact(party)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroundedExtractionMatchExact extends S.Opaque<
  GroundedExtractionMatchExact,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...GroundedExtractionAlignedFields,
    alignmentStatus: S.tag(AlignmentStatus.Enum.match_exact),
  }).pipe(
    $I.annoteSchema("GroundedExtractionMatchExact", {
      description: "Source-grounded extraction aligned by an exact text match.",
    })
  )
) {}

/**
 * Source-grounded extraction aligned by a case-insensitive text match.
 *
 * **Example** (Ground a claim term that differs only in case)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GroundedExtractionMatchLesser } from "@beep/langextract/Extraction"
 * import { Contract } from "@beep/nlp/Handoff"
 *
 * const term = GroundedExtractionMatchLesser.make({
 *   label: "claim-term",
 *   text: "Robotic Arm",
 *   matchedText: "robotic arm",
 *   span: Contract.Span.make({ start: S.Natural.make(102), end: S.Natural.make(113) })
 * })
 *
 * console.log(term.text === term.matchedText) // => false
 * console.log(term.alignmentStatus) // => "match_lesser"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroundedExtractionMatchLesser extends S.Opaque<
  GroundedExtractionMatchLesser,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...GroundedExtractionAlignedFields,
    alignmentStatus: S.tag(AlignmentStatus.Enum.match_lesser),
  }).pipe(
    $I.annoteSchema("GroundedExtractionMatchLesser", {
      description: "Source-grounded extraction aligned by a case-insensitive text match.",
    })
  )
) {}

/**
 * Source-grounded extraction aligned by case folding, whitespace collapse, or end-of-line hyphen folding.
 *
 * **Example** (Ground text split by an end-of-line hyphen)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GroundedExtractionMatchMinimalFold } from "@beep/langextract/Extraction"
 * import { Contract } from "@beep/nlp/Handoff"
 *
 * const term = GroundedExtractionMatchMinimalFold.make({
 *   label: "component",
 *   text: "end effector",
 *   matchedText: "end ef-\nfector",
 *   span: Contract.Span.make({ start: S.Natural.make(240), end: S.Natural.make(255) })
 * })
 *
 * console.log(term.span.end - term.span.start) // => 15
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroundedExtractionMatchMinimalFold extends S.Opaque<
  GroundedExtractionMatchMinimalFold,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...GroundedExtractionAlignedFields,
    alignmentStatus: S.tag(AlignmentStatus.Enum.match_minimal_fold),
  }).pipe(
    $I.annoteSchema("GroundedExtractionMatchMinimalFold", {
      description:
        "Source-grounded extraction aligned by case folding, whitespace collapse, or end-of-line hyphen folding.",
    })
  )
) {}

/**
 * Source-grounded extraction aligned by a bounded fuzzy text match.
 *
 * **Example** (Ground an OCR-damaged date with model confidence)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GroundedExtractionMatchFuzzy } from "@beep/langextract/Extraction"
 * import { Contract } from "@beep/nlp/Handoff"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 *
 * const filingDate = GroundedExtractionMatchFuzzy.make({
 *   label: "filing-date",
 *   text: "March 3, 2024",
 *   matchedText: "Rarch 3, 2O24",
 *   span: Contract.Span.make({ start: S.Natural.make(58), end: S.Natural.make(71) }),
 *   confidence: UnitInterval.makeOption(0.82)
 * })
 *
 * console.log(O.getOrUndefined(filingDate.confidence)) // => 0.82
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroundedExtractionMatchFuzzy extends S.Opaque<
  GroundedExtractionMatchFuzzy,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...GroundedExtractionAlignedFields,
    alignmentStatus: S.tag(AlignmentStatus.Enum.match_fuzzy),
  }).pipe(
    $I.annoteSchema("GroundedExtractionMatchFuzzy", {
      description: "Source-grounded extraction aligned by a bounded fuzzy text match.",
    })
  )
) {}

/**
 * Extraction candidate for which deterministic source alignment found no match.
 *
 * **Example** (Keep a candidate the source text never mentions)
 *
 * ```ts
 * import { GroundedExtraction, GroundedExtractionUnaligned } from "@beep/langextract/Extraction"
 *
 * const hallucinated = GroundedExtractionUnaligned.make({ label: "inventor", text: "Grace Hopper" })
 *
 * console.log(GroundedExtraction.isAnyOf(["unaligned"])(hallucinated)) // => true
 * console.log("span" in hallucinated) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroundedExtractionUnaligned extends S.Opaque<
  GroundedExtractionUnaligned,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...GroundedExtractionCommonFields,
    alignmentStatus: S.tag(AlignmentStatus.Enum.unaligned),
  }).pipe(
    $I.annoteSchema("GroundedExtractionUnaligned", {
      description: "Extraction candidate for which deterministic source alignment found no match.",
    })
  )
) {}

/**
 * Extraction after deterministic source alignment.
 *
 * **Example** (Create grounded extraction)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GroundedExtraction } from "@beep/langextract/Extraction"
 * import { Contract } from "@beep/nlp/Handoff"
 *
 * const span = Contract.Span.make({ start: S.Natural.make(0), end: S.Natural.make(12) })
 * console.log(GroundedExtraction.cases.match_exact.make({
 *   label: "person",
 *   matchedText: "Ada Lovelace",
 *   span,
 *   text: "Ada Lovelace"
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GroundedExtraction = S.Union([
  GroundedExtractionMatchExact,
  GroundedExtractionMatchLesser,
  GroundedExtractionMatchMinimalFold,
  GroundedExtractionMatchFuzzy,
  GroundedExtractionUnaligned,
]).pipe(
  S.toTaggedUnion("alignmentStatus"),
  $I.annoteSchema("GroundedExtraction", {
    description: "Extraction candidate with deterministic source-alignment metadata.",
  })
);

/**
 * {@inheritDoc GroundedExtraction}
 * @category models
 * @since 0.0.0
 */
export type GroundedExtraction = typeof GroundedExtraction.Type;

/**
 * Encoded companion type for the {@link GroundedExtraction} tagged-union schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GroundedExtraction {
  /**
   * Wire representation accepted and emitted by {@link GroundedExtraction}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GroundedExtraction.Encoded;
}

const langExtractRequestExamplesDefault = A.empty<ExtractionExample>();
const langExtractRequestOptionsDefault = LangExtractOptions.make({});
/**
 * Provider-neutral extraction request.
 *
 * **Example** (Build extraction request)
 *
 * ```ts
 * import { LangExtractRequest } from "@beep/langextract/Extraction"
 * import { ExtractionTarget } from "@beep/langextract/Target"
 * import { DocumentId } from "@beep/nlp/Core"
 *
 * console.log(LangExtractRequest.make({
 *   documentId: DocumentId.make("doc-1"),
 *   targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
 *   text: "Ada Lovelace wrote notes."
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LangExtractRequest extends S.Opaque<LangExtractRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    documentId: DocumentId,
    examples: ExtractionExample.pipe(
      S.Array,
      S.check(
        S.isMaxLength(MAX_REQUEST_EXAMPLES, {
          message: `LangExtract request must include at most ${MAX_REQUEST_EXAMPLES} examples.`,
        })
      ),
      S.withConstructorDefault(Effect.succeed(langExtractRequestExamplesDefault)),
      S.withDecodingDefaultType(Effect.succeed(langExtractRequestExamplesDefault))
    ),
    options: LangExtractOptions.pipe(
      S.withConstructorDefault(Effect.succeed(langExtractRequestOptionsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(langExtractRequestOptionsDefault))
    ),
    targets: S.NonEmptyArray(ExtractionTarget),
    text: S.String.check(
      S.isMaxLength(MAX_REQUEST_TEXT_LENGTH, {
        message: `LangExtract request text must be ${MAX_REQUEST_TEXT_LENGTH} characters or fewer.`,
      })
    ),
  }).pipe(
    $I.annoteSchema("LangExtractRequest", {
      description: "Provider-neutral request for LangExtract-style structured extraction.",
    })
  )
) {}

/**
 * Counts emitted with a completed extraction result.
 *
 * **Example** (Create diagnostics counts)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LangExtractDiagnostics } from "@beep/langextract/Extraction"
 *
 * console.log(LangExtractDiagnostics.make({
 *   alignedCount: S.Natural.make(1),
 *   candidateCount: S.Natural.make(1),
 *   promptChars: S.Natural.make(120),
 *   unalignedCount: S.Natural.make(0)
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LangExtractDiagnostics extends S.Opaque<LangExtractDiagnostics, { readonly brand: unique symbol }>()(
  S.Struct({
    alignedCount: S.Natural,
    candidateCount: S.Natural,
    promptChars: S.Natural,
    unalignedCount: S.Natural,
  }).pipe(
    $I.annoteSchema("LangExtractDiagnostics", {
      description: "Sanitized extraction diagnostics containing counts only.",
    })
  )
) {}

/**
 * Provider-neutral extraction result plus NLP handoff document.
 *
 * **Example** (Build extraction result)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LangExtractDiagnostics, LangExtractResult } from "@beep/langextract/Extraction"
 * import { Contract } from "@beep/nlp/Handoff"
 * import { DocumentId } from "@beep/nlp/Core"
 *
 * const provenance = Contract.Provenance.make({ generatedBy: "@beep/langextract", source: "doc-1", timestamp: 0 })
 * const annotatedDocument = Contract.AnnotatedDocument.make({
 *   chunks: [],
 *   entities: [],
 *   mentions: [],
 *   provenance,
 *   relations: [],
 *   version: "nlp-ir/1.1"
 * })
 * console.log(LangExtractResult.make({
 *   annotatedDocument,
 *   diagnostics: LangExtractDiagnostics.make({
 *     alignedCount: S.Natural.make(0),
 *     candidateCount: S.Natural.make(0),
 *     promptChars: S.Natural.make(0),
 *     unalignedCount: S.Natural.make(0)
 *   }),
 *   documentId: DocumentId.make("doc-1"),
 *   extractions: [],
 *   text: ""
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LangExtractResult extends S.Opaque<LangExtractResult, { readonly brand: unique symbol }>()(
  S.Struct({
    annotatedDocument: Contract.AnnotatedDocument,
    diagnostics: LangExtractDiagnostics,
    documentId: DocumentId,
    extractions: S.Array(GroundedExtraction),
    text: S.String,
  }).pipe(
    $I.annoteSchema("LangExtractResult", {
      description: "Structured extraction result with source-grounded spans and NLP handoff output.",
    })
  )
) {}
