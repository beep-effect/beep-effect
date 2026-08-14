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
import { NonNegativeInt } from "@beep/schema/Int";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as S from "effect/Schema";
import {
  MAX_CANDIDATE_ATTRIBUTES,
  MAX_CANDIDATE_TEXT_LENGTH,
  MAX_REQUEST_EXAMPLES,
  MAX_REQUEST_TEXT_LENGTH,
} from "./Extraction.config.ts";

const $I = $LangExtractId.create("Extraction");

const ExtractionCandidateLabel = S.NonEmptyString.check(
  S.isPattern(/\S/u, {
    identifier: $I`ExtractionCandidateLabelNonBlankCheck`,
    title: "Non-Blank Extraction Candidate Label",
    description: "Checks that an extraction candidate label contains at least one non-whitespace character.",
    message: "Extraction candidate labels cannot be blank.",
  }),
  S.isMaxLength(MAX_CANDIDATE_TEXT_LENGTH, {
    identifier: $I`ExtractionCandidateLabelMaxLengthCheck`,
    title: "Extraction Candidate Label Length",
    description: "Checks that an extraction candidate label stays within the bounded model-output length.",
    message: `Extraction candidate label must be ${MAX_CANDIDATE_TEXT_LENGTH} characters or fewer.`,
  })
).pipe(
  $I.annoteSchema("ExtractionCandidateLabel", {
    description: "Non-blank, bounded label emitted for one extraction candidate.",
  })
);

const ExtractionCandidateText = S.NonEmptyString.check(
  S.isPattern(/\S/u, {
    identifier: $I`ExtractionCandidateTextNonBlankCheck`,
    title: "Non-Blank Extraction Candidate Text",
    description: "Checks that extraction evidence contains at least one non-whitespace character.",
    message: "Extraction candidate text cannot be blank.",
  }),
  S.isMaxLength(MAX_CANDIDATE_TEXT_LENGTH, {
    identifier: $I`ExtractionCandidateTextMaxLengthCheck`,
    title: "Extraction Candidate Text Length",
    description: "Checks that extraction candidate source text stays within the bounded model-output length.",
    message: `Extraction candidate text must be ${MAX_CANDIDATE_TEXT_LENGTH} characters or fewer.`,
  })
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
export const AlignmentStatus = LiteralKit(["match_exact", "match_lesser", "match_fuzzy", "unaligned"]).pipe(
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
 * import { LangExtractOptions } from "@beep/langextract/Extraction"
 * import { UnitInterval } from "@beep/nlp/Handoff"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * console.log(LangExtractOptions.make({
 *   fuzzyThreshold: O.some(UnitInterval.make(0.9)),
 *   maxExtractions: O.some(NonNegativeInt.make(5))
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LangExtractOptions extends S.Class<LangExtractOptions>($I`LangExtractOptions`)(
  {
    fuzzyThreshold: UnitInterval.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    maxExtractions: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("LangExtractOptions", {
    description: "Options for model parsing and deterministic source alignment.",
  })
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
 *   confidence: O.some(UnitInterval.make(0.98))
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionCandidate extends S.Class<ExtractionCandidate>($I`ExtractionCandidate`)(
  {
    attributes: S.Record(S.String, S.String).pipe(
      S.check(
        S.isMaxProperties(MAX_CANDIDATE_ATTRIBUTES, {
          identifier: $I`ExtractionCandidateAttributesMaxPropertiesCheck`,
          title: "Extraction Candidate Attribute Limit",
          description: "Checks that one extraction candidate stays within the bounded attribute count.",
          message: `Extraction candidate attributes must have at most ${MAX_CANDIDATE_ATTRIBUTES} entries.`,
        })
      ),
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault
    ),
    confidence: UnitInterval.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    label: ExtractionCandidateLabel,
    text: ExtractionCandidateText,
  },
  $I.annote("ExtractionCandidate", {
    description: "Model-emitted extraction candidate before deterministic source alignment.",
  })
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

class GroundedExtractionMatchExact extends S.Class<GroundedExtractionMatchExact>($I`GroundedExtractionMatchExact`)(
  {
    ...GroundedExtractionAlignedFields,
    alignmentStatus: S.tag(AlignmentStatus.Enum.match_exact),
  },
  $I.annote("GroundedExtractionMatchExact", {
    description: "Source-grounded extraction aligned by an exact text match.",
  })
) {}

class GroundedExtractionMatchLesser extends S.Class<GroundedExtractionMatchLesser>($I`GroundedExtractionMatchLesser`)(
  {
    ...GroundedExtractionAlignedFields,
    alignmentStatus: S.tag(AlignmentStatus.Enum.match_lesser),
  },
  $I.annote("GroundedExtractionMatchLesser", {
    description: "Source-grounded extraction aligned by a case-insensitive text match.",
  })
) {}

class GroundedExtractionMatchFuzzy extends S.Class<GroundedExtractionMatchFuzzy>($I`GroundedExtractionMatchFuzzy`)(
  {
    ...GroundedExtractionAlignedFields,
    alignmentStatus: S.tag(AlignmentStatus.Enum.match_fuzzy),
  },
  $I.annote("GroundedExtractionMatchFuzzy", {
    description: "Source-grounded extraction aligned by a bounded fuzzy text match.",
  })
) {}

class GroundedExtractionUnaligned extends S.Class<GroundedExtractionUnaligned>($I`GroundedExtractionUnaligned`)(
  {
    ...GroundedExtractionCommonFields,
    alignmentStatus: S.tag(AlignmentStatus.Enum.unaligned),
  },
  $I.annote("GroundedExtractionUnaligned", {
    description: "Extraction candidate for which deterministic source alignment found no match.",
  })
) {}

/**
 * Extraction after deterministic source alignment.
 *
 * **Example** (Create grounded extraction)
 *
 * ```ts
 * import { GroundedExtraction } from "@beep/langextract/Extraction"
 * import { Contract } from "@beep/nlp/Handoff"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const span = Contract.Span.make({ start: NonNegativeInt.make(0), end: NonNegativeInt.make(12) })
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
export class LangExtractRequest extends S.Class<LangExtractRequest>($I`LangExtractRequest`)(
  {
    documentId: DocumentId,
    examples: ExtractionExample.pipe(
      S.Array,
      S.check(
        S.isMaxLength(MAX_REQUEST_EXAMPLES, {
          message: `LangExtract request must include at most ${MAX_REQUEST_EXAMPLES} examples.`,
        })
      ),
      SchemaUtils.withEmptyArrayDefaults<ExtractionExample>()
    ),
    options: LangExtractOptions.pipe(SchemaUtils.withKeyDefaults(LangExtractOptions.make({}))),
    targets: S.NonEmptyArray(ExtractionTarget),
    text: S.String.check(
      S.isMaxLength(MAX_REQUEST_TEXT_LENGTH, {
        message: `LangExtract request text must be ${MAX_REQUEST_TEXT_LENGTH} characters or fewer.`,
      })
    ),
  },
  $I.annote("LangExtractRequest", {
    description: "Provider-neutral request for LangExtract-style structured extraction.",
  })
) {}

/**
 * Counts emitted with a completed extraction result.
 *
 * **Example** (Create diagnostics counts)
 *
 * ```ts
 * import { LangExtractDiagnostics } from "@beep/langextract/Extraction"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * console.log(LangExtractDiagnostics.make({
 *   alignedCount: NonNegativeInt.make(1),
 *   candidateCount: NonNegativeInt.make(1),
 *   promptChars: NonNegativeInt.make(120),
 *   unalignedCount: NonNegativeInt.make(0)
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LangExtractDiagnostics extends S.Class<LangExtractDiagnostics>($I`LangExtractDiagnostics`)(
  {
    alignedCount: NonNegativeInt,
    candidateCount: NonNegativeInt,
    promptChars: NonNegativeInt,
    unalignedCount: NonNegativeInt,
  },
  $I.annote("LangExtractDiagnostics", {
    description: "Sanitized extraction diagnostics containing counts only.",
  })
) {}

/**
 * Provider-neutral extraction result plus NLP handoff document.
 *
 * **Example** (Build extraction result)
 *
 * ```ts
 * import { LangExtractDiagnostics, LangExtractResult } from "@beep/langextract/Extraction"
 * import { Contract } from "@beep/nlp/Handoff"
 * import { DocumentId } from "@beep/nlp/Core"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const provenance = Contract.Provenance.make({ generatedBy: "@beep/langextract", source: "doc-1", timestamp: 0 })
 * const annotatedDocument = Contract.AnnotatedDocument.make({
 *   chunks: [],
 *   entities: [],
 *   provenance,
 *   relations: [],
 *   version: "nlp-ir/1.0"
 * })
 * console.log(LangExtractResult.make({
 *   annotatedDocument,
 *   diagnostics: LangExtractDiagnostics.make({
 *     alignedCount: NonNegativeInt.make(0),
 *     candidateCount: NonNegativeInt.make(0),
 *     promptChars: NonNegativeInt.make(0),
 *     unalignedCount: NonNegativeInt.make(0)
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
export class LangExtractResult extends S.Class<LangExtractResult>($I`LangExtractResult`)(
  {
    annotatedDocument: Contract.AnnotatedDocument,
    diagnostics: LangExtractDiagnostics,
    documentId: DocumentId,
    extractions: S.Array(GroundedExtraction),
    text: S.String,
  },
  $I.annote("LangExtractResult", {
    description: "Structured extraction result with source-grounded spans and NLP handoff output.",
  })
) {}
