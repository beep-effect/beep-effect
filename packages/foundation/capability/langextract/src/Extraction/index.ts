/**
 * Extraction models, parser contracts, and typed boundary errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LangExtractId } from "@beep/identity";
import { ExtractionExample, ExtractionTarget } from "@beep/langextract/Target";
import { DocumentId } from "@beep/nlp/Core";
import { Contract, UnitInterval } from "@beep/nlp/Handoff";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { O } from "@beep/utils";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LangExtractId.create("Extraction");

/**
 * Defensive upper bounds that fail closed at decode time to keep deterministic
 * alignment within a predictable CPU budget. Fuzzy alignment is
 * `O(sourceWords * candidateChars * candidateCount)`, so each axis is bounded before any
 * untrusted document or model output reaches {@link parseModelOutput} or the
 * synchronous alignment path.
 */
const MAX_REQUEST_TEXT_LENGTH = 1_000_000;
const MAX_CANDIDATE_TEXT_LENGTH = 4_096;
const MAX_CANDIDATE_ATTRIBUTES = 64;
const MAX_REQUEST_EXAMPLES = 64;

/**
 * Maximum extraction candidates accepted at any LangExtract boundary.
 *
 * **Example** (Log candidate limit constant)
 *
 * ```ts
 * import { MAX_EXTRACTION_CANDIDATES } from "@beep/langextract/Extraction"
 *
 * console.log(MAX_EXTRACTION_CANDIDATES) // 1024
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_EXTRACTION_CANDIDATES = 1_024;

/**
 * Machine-readable LangExtract failure reasons.
 *
 * **Example** (Check alignment-failed reason)
 *
 * ```ts
 * import { LangExtractErrorReason } from "@beep/langextract/Extraction"
 *
 * console.log(LangExtractErrorReason.is["alignment-failed"]("alignment-failed"))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const LangExtractErrorReason = LiteralKit([
  "remote-policy-denied",
  "model-generation-failed",
  "model-generation-timeout",
  "model-output-parse-failed",
  "model-output-schema-invalid",
  "alignment-failed",
  "handoff-failed",
]).pipe(
  $I.annoteSchema("LangExtractErrorReason", {
    description: "Sanitized failure reasons exposed by the LangExtract capability boundary.",
  })
);

/**
 * {@inheritDoc LangExtractErrorReason}
 * @category errors
 * @since 0.0.0
 */
export type LangExtractErrorReason = typeof LangExtractErrorReason.Type;

/**
 * Sanitized LangExtract capability error.
 *
 * **Example** (Create error from reason)
 *
 * ```ts
 * import { LangExtractError } from "@beep/langextract/Extraction"
 *
 * console.log(LangExtractError.fromReason("alignment-failed", { message: "Could not align output." }))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LangExtractError extends S.TaggedError<LangExtractError>($I`LangExtractError`)(
  "LangExtractError",
  {
    details: S.optionalKey(S.Record(S.String, S.String)),
    message: S.String,
    reason: LangExtractErrorReason,
  },
  $I.annote("LangExtractError", {
    description: "Sanitized error emitted by provider-neutral LangExtract operations.",
  })
) {
  /**
   * Create a sanitized LangExtract error from a reason and message.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (
    reason: LangExtractErrorReason,
    options: {
      readonly details?: Readonly<Record<string, string>>;
      readonly message: string;
    }
  ): LangExtractError => LangExtractError.make({ reason, ...options });
}

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
 *
 * console.log(LangExtractOptions.make({
 *   fuzzyThreshold: UnitInterval.make(0.9),
 *   maxExtractions: NonNegativeInt.make(5)
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LangExtractOptions extends S.Class<LangExtractOptions>($I`LangExtractOptions`)(
  {
    fuzzyThreshold: S.optionalKey(UnitInterval),
    maxExtractions: S.optionalKey(NonNegativeInt),
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
 *
 * console.log(ExtractionCandidate.make({
 *   label: "person",
 *   text: "Ada Lovelace",
 *   confidence: UnitInterval.make(0.98)
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionCandidate extends S.Class<ExtractionCandidate>($I`ExtractionCandidate`)(
  {
    attributes: S.optionalKey(
      S.Record(S.String, S.String).check(
        S.isMaxProperties(MAX_CANDIDATE_ATTRIBUTES, {
          message: `Extraction candidate attributes must have at most ${MAX_CANDIDATE_ATTRIBUTES} entries.`,
        })
      )
    ),
    confidence: S.optionalKey(UnitInterval),
    label: S.NonEmptyString.check(
      S.isMaxLength(MAX_CANDIDATE_TEXT_LENGTH, {
        message: `Extraction candidate label must be ${MAX_CANDIDATE_TEXT_LENGTH} characters or fewer.`,
      })
    ),
    text: S.NonEmptyString.check(
      S.isMaxLength(MAX_CANDIDATE_TEXT_LENGTH, {
        message: `Extraction candidate text must be ${MAX_CANDIDATE_TEXT_LENGTH} characters or fewer.`,
      })
    ),
  },
  $I.annote("ExtractionCandidate", {
    description: "Model-emitted extraction candidate before deterministic source alignment.",
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
 * console.log(GroundedExtraction.make({ alignmentStatus: "match_exact", label: "person", span, text: "Ada Lovelace" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroundedExtraction extends S.Class<GroundedExtraction>($I`GroundedExtraction`)(
  {
    alignmentStatus: AlignmentStatus,
    attributes: S.optionalKey(S.Record(S.String, S.String)),
    confidence: S.optionalKey(UnitInterval),
    label: S.NonEmptyString,
    matchedText: S.optionalKey(S.String),
    span: S.optionalKey(Contract.Span),
    text: S.NonEmptyString,
  },
  $I.annote("GroundedExtraction", {
    description: "Extraction candidate with deterministic source-alignment metadata.",
  })
) {
  /**
   * Construct grounded alignment metadata from a parsed model candidate.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromCandidate = (
    candidate: ExtractionCandidate,
    status: AlignmentStatus,
    span?: Contract.Span,
    matchedText?: string
  ): GroundedExtraction =>
    GroundedExtraction.make({
      alignmentStatus: status,
      label: candidate.label,
      text: candidate.text,
      ...O.getSomesStruct({
        attributes: O.fromUndefinedOr(candidate.attributes),
        confidence: O.fromUndefinedOr(candidate.confidence),
        matchedText: O.fromUndefinedOr(matchedText),
        span: O.fromUndefinedOr(span),
      }),
    });
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
      S.optionalKey
    ),
    options: S.optionalKey(LangExtractOptions),
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

const ModelOutputCandidates = S.Array(ExtractionCandidate).check(
  S.isMaxLength(MAX_EXTRACTION_CANDIDATES, {
    message: `Language model output must contain at most ${MAX_EXTRACTION_CANDIDATES} extraction candidates.`,
  })
);

class ModelOutputObject extends S.Class<ModelOutputObject>($I`ModelOutputObject`)(
  {
    extractions: ModelOutputCandidates,
  },
  $I.annote("ModelOutputObject", {
    description: "Internal JSON object shape returned by a language model.",
  })
) {}

const ModelOutput = S.Union([ModelOutputObject, ModelOutputCandidates]);
const decodeModelOutputJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeModelOutputPayload = S.decodeUnknownEffect(ModelOutput);
type ParsedModelOutput = ReadonlyArray<ExtractionCandidate> | ModelOutputObject;
const isCandidateArray = (output: ParsedModelOutput): output is ReadonlyArray<ExtractionCandidate> => A.isArray(output);

const stripJsonFence = (text: string): string => {
  const trimmed = Str.trim(text);
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed);
  return fenced?.[1] === undefined ? trimmed : Str.trim(fenced[1]);
};

const outputToCandidates = (output: ParsedModelOutput): ReadonlyArray<ExtractionCandidate> =>
  isCandidateArray(output) ? output : output.extractions;

/**
 * Decode a model text response into extraction candidates.
 *
 * **Example** (Parse model JSON output)
 *
 * ```ts
 * import { parseModelOutput } from "@beep/langextract/Extraction"
 * import { Effect } from "effect"
 *
 * const program = parseModelOutput('{"extractions":[{"label":"person","text":"Ada Lovelace"}]}')
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Decodes model text in Effect so malformed output returns a typed LangExtractError.
 * @category parsing
 * @since 0.0.0
 */
export const parseModelOutput = Effect.fn("LangExtract.parseModelOutput")(function* (
  text: string
): Effect.fn.Return<ReadonlyArray<ExtractionCandidate>, LangExtractError> {
  const json = yield* decodeModelOutputJson(stripJsonFence(text)).pipe(
    Effect.mapError(() =>
      LangExtractError.fromReason("model-output-parse-failed", {
        details: { cause: "json-parse-failed" },
        message: "Language model output was not valid JSON.",
      })
    )
  );

  const parsed = yield* decodeModelOutputPayload(json).pipe(
    Effect.mapError(() =>
      LangExtractError.fromReason("model-output-schema-invalid", {
        details: { cause: "schema-decode-failed" },
        message: "Language model output did not match the LangExtract response schema.",
      })
    )
  );

  return outputToCandidates(parsed);
});
