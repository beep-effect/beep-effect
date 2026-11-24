/**
 * Extraction request, candidate, and result models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { ExtractionExample, ExtractionTarget } from "@beep/langextract/Target";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
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
 * import { UnitInterval } from "@beep/schema/UnitInterval"
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
 * import { UnitInterval } from "@beep/schema/UnitInterval"
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
  anchor: TextAnchor.annotateKey({
    description: "The aligned source slice: its UTF-16 range and the exact raw text it covers.",
  }),
};

/**
 * **Example** (Ground a party name found verbatim)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GroundedExtraction, GroundedExtractionMatchExact } from "@beep/langextract/Extraction"
 * import { TextAnchor } from "@beep/text/TextAnchor"
 *
 * const party = GroundedExtractionMatchExact.make({
 *   label: "party",
 *   text: "Acme Robotics, Inc.",
 *   anchor: TextAnchor.make({ startChar: S.Natural.make(17), endChar: S.Natural.make(36), quote: "Acme Robotics, Inc." })
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
 * **Example** (Ground a claim term that differs only in case)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GroundedExtractionMatchLesser } from "@beep/langextract/Extraction"
 * import { TextAnchor } from "@beep/text/TextAnchor"
 *
 * const term = GroundedExtractionMatchLesser.make({
 *   label: "claim-term",
 *   text: "Robotic Arm",
 *   anchor: TextAnchor.make({ startChar: S.Natural.make(102), endChar: S.Natural.make(113), quote: "robotic arm" })
 * })
 *
 * console.log(term.text === term.anchor.quote) // => false
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
 * **Example** (Ground text split by an end-of-line hyphen)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GroundedExtractionMatchMinimalFold } from "@beep/langextract/Extraction"
 * import { TextAnchor } from "@beep/text/TextAnchor"
 *
 * const term = GroundedExtractionMatchMinimalFold.make({
 *   label: "component",
 *   text: "end effector",
 *   anchor: TextAnchor.make({ startChar: S.Natural.make(240), endChar: S.Natural.make(255), quote: "end ef-\nfector" })
 * })
 *
 * console.log(term.anchor.endChar - term.anchor.startChar) // => 15
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
 * **Example** (Ground an OCR-damaged date with model confidence)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GroundedExtractionMatchFuzzy } from "@beep/langextract/Extraction"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { TextAnchor } from "@beep/text/TextAnchor"
 *
 * const filingDate = GroundedExtractionMatchFuzzy.make({
 *   label: "filing-date",
 *   text: "March 3, 2024",
 *   anchor: TextAnchor.make({ startChar: S.Natural.make(58), endChar: S.Natural.make(71), quote: "Rarch 3, 2O24" }),
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
 * **Example** (Keep a candidate the source text never mentions)
 *
 * ```ts
 * import { GroundedExtraction, GroundedExtractionUnaligned } from "@beep/langextract/Extraction"
 *
 * const hallucinated = GroundedExtractionUnaligned.make({ label: "inventor", text: "Grace Hopper" })
 *
 * console.log(GroundedExtraction.isAnyOf(["unaligned"])(hallucinated)) // => true
 * console.log("anchor" in hallucinated) // => false
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
 * **Example** (Create grounded extraction)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GroundedExtraction } from "@beep/langextract/Extraction"
 * import { TextAnchor } from "@beep/text/TextAnchor"
 *
 * const anchor = TextAnchor.make({ startChar: S.Natural.make(0), endChar: S.Natural.make(12), quote: "Ada Lovelace" })
 * console.log(GroundedExtraction.cases.match_exact.make({
 *   label: "person",
 *   anchor,
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
 * **Example** (Build extraction request)
 *
 * ```ts
 * import { LangExtractRequest } from "@beep/langextract/Extraction"
 * import { ExtractionTarget, TargetAnnotation } from "@beep/langextract/Target"
 * import { iri } from "@beep/identity/Registry"
 * import { TermIri } from "@beep/identity/Term"
 * import type { SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 *
 * const requestFor = (source: SourceTextIdentity, text: string) => LangExtractRequest.make({
 *   source, text, targets: [ExtractionTarget.make({ kind: "entity", name: "person",
 *     annotates: TargetAnnotation.cases.Mention.make({ class: TermIri.make(iri("semantica:person")) }) })]
 * })
 * console.log(typeof requestFor)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LangExtractRequest extends S.Opaque<LangExtractRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    source: SourceTextIdentity,
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
