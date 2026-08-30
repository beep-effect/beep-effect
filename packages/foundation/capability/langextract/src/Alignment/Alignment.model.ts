/**
 * Alignment data model: match lattice schemas, the alignment source context,
 * and the schema transformations that ground extraction candidates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { AlignmentStatus, ExtractionCandidate, GroundedExtraction } from "@beep/langextract/Extraction";
import { Contract, UnitInterval } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema/Int";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import { Context, Effect, SchemaGetter, SchemaIssue } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { alignCandidate, alignCandidates, spanFromMatch } from "./Alignment.behavior.ts";
import { DEFAULT_FUZZY_THRESHOLD, DEFAULT_MAX_EXTRACTIONS } from "./Alignment.config.ts";
import type { LangExtractOptions, LangExtractRequest } from "@beep/langextract/Extraction";

const $I = $LangExtractId.create("Alignment");

/**
 * Alignment status of a successfully matched candidate.
 *
 * **Details**
 *
 * Derived from {@link AlignmentStatus} minus `unaligned`: an absent match is
 * represented by `Option.none`, never by a status member, so the "no match"
 * case cannot leak into a matched tuple.
 *
 * **Example** (Check aligned status membership)
 *
 * ```ts import.meta.vitest name="Check aligned status membership"
 * import { AlignedStatus } from "@beep/langextract/Alignment"
 *
 * AlignedStatus.is.match_exact("match_exact") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AlignedStatus = LiteralKit(AlignmentStatus.omitOptions(["unaligned"])).pipe(
  $I.annoteSchema("AlignedStatus", {
    description:
      "Alignment status of a successfully matched candidate; absence of a match is Option.none, never a member.",
  })
);

/**
 * {@inheritDoc AlignedStatus}
 * @category models
 * @since 0.0.0
 */
export type AlignedStatus = typeof AlignedStatus.Type;

/**
 * A raw source slice located by one match attempt.
 *
 * **Example** (Type a matched slice)
 *
 * ```ts
 * import type { MatchedText } from "@beep/langextract/Alignment"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const match: MatchedText = [NonNegativeInt.make(4), "Lovelace"]
 * console.log(match[1])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MatchedText = S.Tuple([
  NonNegativeInt.pipe(
    $I.annoteKey("MatchedText.start", {
      description: "UTF-16 start offset of the matched slice in the source text.",
    })
  ),
  S.String.pipe(
    $I.annoteKey("MatchedText.text", {
      description: "Exact raw source slice the candidate query matched.",
    })
  ),
]).pipe(
  $I.annoteSchema("MatchedText", {
    description: "A raw source slice located by one match attempt: start offset plus the exact matched text.",
  })
);

/**
 * {@inheritDoc MatchedText}
 * @category models
 * @since 0.0.0
 */
export type MatchedText = typeof MatchedText.Type;

/**
 * A fuzzy match candidate carrying its similarity score.
 *
 * **Example** (Type a scored match)
 *
 * ```ts
 * import type { ScoredMatch } from "@beep/langextract/Alignment"
 * import { UnitInterval } from "@beep/nlp/Handoff"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const scored: ScoredMatch = [NonNegativeInt.make(0), "Acme.", UnitInterval.make(0.8)]
 * console.log(scored[2])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScoredMatch = S.Tuple([
  MatchedText.elements[0].pipe(
    $I.annoteKey("ScoredMatch.start", {
      description: "UTF-16 start offset of the scored window in the source text.",
    })
  ),
  MatchedText.elements[1].pipe(
    $I.annoteKey("ScoredMatch.text", {
      description: "Exact raw source window the similarity score was computed against.",
    })
  ),
  UnitInterval.pipe(
    $I.annoteKey("ScoredMatch.score", {
      description: "Levenshtein similarity of the window against the query, in [0, 1].",
    })
  ),
]).pipe(
  $I.annoteSchema("ScoredMatch", {
    description: "A fuzzy match window with its similarity score in [0, 1].",
  })
);

/**
 * {@inheritDoc ScoredMatch}
 * @category models
 * @since 0.0.0
 */
export type ScoredMatch = typeof ScoredMatch.Type;

/**
 * A successful match tagged with the alignment tier that produced it.
 *
 * **Example** (Type an aligned match)
 *
 * ```ts
 * import type { AlignedMatch } from "@beep/langextract/Alignment"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const aligned: AlignedMatch = ["match_exact", NonNegativeInt.make(0), "Ada"]
 * console.log(aligned[0])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AlignedMatch = S.Tuple([
  AlignedStatus.pipe(
    $I.annoteKey("AlignedMatch.status", {
      description: "Alignment tier (exact, lesser, minimal fold, or fuzzy) that produced the match.",
    })
  ),
  MatchedText.elements[0].pipe(
    $I.annoteKey("AlignedMatch.start", {
      description: "UTF-16 start offset of the matched slice in the source text.",
    })
  ),
  MatchedText.elements[1].pipe(
    $I.annoteKey("AlignedMatch.text", {
      description: "Exact raw source slice the candidate query matched.",
    })
  ),
]).pipe(
  $I.annoteSchema("AlignedMatch", {
    description: "A successful match tagged with the alignment tier that produced it.",
  })
);

/**
 * {@inheritDoc AlignedMatch}
 * @category models
 * @since 0.0.0
 */
export type AlignedMatch = typeof AlignedMatch.Type;

/**
 * Encoded companion type for the {@link AlignedMatch} runtime schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AlignedMatch {
  /**
   * Wire representation accepted and emitted by {@link AlignedMatch}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AlignedMatch.Encoded;
}

/**
 * The source text plus resolved alignment options one alignment run reads.
 *
 * **Details**
 *
 * Both options resolve at construction time through schema constructor
 * defaults, so behavior never juggles an `Option` or recomputes fallbacks.
 *
 * **Example** (Construct an alignment source)
 *
 * ```ts import.meta.vitest name="Construct an alignment source"
 * import { AlignmentSource } from "@beep/langextract/Alignment"
 *
 * const source = AlignmentSource.make({ sourceText: "Ada Lovelace wrote notes." })
 * source.fuzzyThreshold // => 0.82
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AlignmentSource extends S.Class<AlignmentSource>($I`AlignmentSource`)(
  {
    fuzzyThreshold: UnitInterval.pipe(SchemaUtils.withConstantDefault<number>(DEFAULT_FUZZY_THRESHOLD)),
    maxExtractions: NonNegativeInt.pipe(SchemaUtils.withConstantDefault<number>(DEFAULT_MAX_EXTRACTIONS)),
    sourceText: S.String,
  },
  $I.annote("AlignmentSource", {
    description: "Source text plus resolved alignment options consumed by one deterministic alignment run.",
  })
) {
  /**
   * Resolve an alignment source from source text and decoded extraction options.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromOptions: {
    (options: LangExtractOptions): (sourceText: string) => AlignmentSource;
    (sourceText: string, options: LangExtractOptions): AlignmentSource;
  } = dual(
    2,
    (sourceText: string, options: LangExtractOptions): AlignmentSource =>
      AlignmentSource.make({
        sourceText,
        ...O.getSomesStruct({
          fuzzyThreshold: options.fuzzyThreshold,
          maxExtractions: options.maxExtractions,
        }),
      })
  );

  /**
   * Resolve an alignment source from a provider-neutral extraction request.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromRequest = (request: LangExtractRequest): AlignmentSource =>
    AlignmentSource.fromOptions(request.text, request.options);
}

/**
 * Ambient service carrying the {@link AlignmentSource} a decode run aligns
 * against.
 *
 * **Details**
 *
 * Context-dependent transformations ({@link SpanFromMatch} encode,
 * {@link GroundedExtractionFromCandidate}, {@link GroundedExtractionsFromCandidates})
 * require this service through the schema `DecodingServices`/`EncodingServices`
 * channel; provide it with `Effect.provideService` around `S.decodeEffect`.
 *
 * **Example** (Provide the current alignment source)
 *
 * ```ts
 * import { AlignmentSource, CurrentAlignmentSource } from "@beep/langextract/Alignment"
 * import { Effect } from "effect"
 *
 * const program = Effect.map(CurrentAlignmentSource, (source) => source.sourceText).pipe(
 *   Effect.provideService(CurrentAlignmentSource, AlignmentSource.make({ sourceText: "Ada" }))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CurrentAlignmentSource extends Context.Service<CurrentAlignmentSource, AlignmentSource>()(
  $I`CurrentAlignmentSource`
) {}

/**
 * Codec from a matched slice to a half-open source span.
 *
 * **Details**
 *
 * Decoding is pure: `[start, text]` becomes a half-open span covering the
 * matched text's UTF-16 length.
 * Encoding recovers the matched slice from {@link CurrentAlignmentSource} and
 * fails closed when the span exceeds the current source text.
 *
 * **Example** (Decode a matched slice into a span)
 *
 * ```ts
 * import { SpanFromMatch } from "@beep/langextract/Alignment"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * Effect.runPromise(S.decodeEffect(SpanFromMatch)([4, "Lovelace"])).then(
 *   (span) => console.log(span.end) // 12
 * )
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SpanFromMatch = MatchedText.pipe(
  S.decodeTo(Contract.Span, {
    decode: SchemaGetter.transform(spanFromMatch),
    encode: SchemaGetter.transformOrFail((span: Contract.Span.Encoded, options) =>
      CurrentAlignmentSource.use((source) => {
        if (span.end > Str.length(source.sourceText)) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(
              { message: "Span end exceeds the current alignment source text." },
              span,
              options
            )
          );
        }
        const match: MatchedText = [
          NonNegativeInt.make(span.start),
          Str.slice(span.start, span.end)(source.sourceText),
        ];
        return Effect.succeed(match);
      })
    ),
  }),
  $I.annoteSchema("SpanFromMatch", {
    description: "Bidirectional codec between matched source slices and half-open UTF-16 spans.",
  })
);

/**
 * Codec that projects a scored fuzzy window down to its matched slice.
 *
 * **Details**
 *
 * Decoding drops the similarity score. Encoding is forbidden: a score cannot
 * be restored without re-running fuzzy alignment against the query.
 *
 * **Example** (Drop the score from a scored match)
 *
 * ```ts
 * import { MatchedTextFromScored } from "@beep/langextract/Alignment"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * Effect.runPromise(S.decodeEffect(MatchedTextFromScored)([0, "Acme.", 0.8])).then(
 *   (match) => console.log(match[1]) // "Acme."
 * )
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const MatchedTextFromScored = ScoredMatch.pipe(
  S.decodeTo(MatchedText, {
    decode: SchemaGetter.transform(([start, text]: ScoredMatch) => {
      const match: MatchedText = [start, text];
      return match;
    }),
    encode: SchemaGetter.forbidden(
      () => "Cannot restore a similarity score from a matched slice; re-run fuzzy alignment."
    ),
  }),
  $I.annoteSchema("MatchedTextFromScored", {
    description: "One-way codec that projects a scored fuzzy window to its source match.",
  })
);

/**
 * Codec that tags a matched slice with the alignment tier that produced it.
 *
 * **Example** (Tag and untag a matched slice)
 *
 * ```ts
 * import { AlignedMatchFromMatchedText } from "@beep/langextract/Alignment"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const ExactMatch = AlignedMatchFromMatchedText("match_exact")
 * Effect.runPromise(S.decodeEffect(ExactMatch)([0, "Ada"])).then(
 *   (match) => console.log(match[0]) // "match_exact"
 * )
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const AlignedMatchFromMatchedText = (status: AlignedStatus) =>
  MatchedText.pipe(
    S.decodeTo(AlignedMatch, {
      decode: SchemaGetter.transform(([start, text]: MatchedText) => {
        const aligned: AlignedMatch = [status, start, text];
        return aligned;
      }),
      encode: SchemaGetter.transform(([, start, text]: AlignedMatch.Encoded) => {
        const match: MatchedText = [NonNegativeInt.make(start), text];
        return match;
      }),
    }),
    $I.annoteSchema("AlignedMatchFromMatchedText", {
      description: `Bidirectional codec between matched text and the ${status} alignment tier.`,
    })
  );

const candidateFromGrounded = (grounded: GroundedExtraction): ExtractionCandidate =>
  ExtractionCandidate.make({
    attributes: grounded.attributes,
    confidence: grounded.confidence,
    label: grounded.label,
    text: grounded.text,
  });

/**
 * Codec from a model-emitted candidate to a source-grounded extraction.
 *
 * **Details**
 *
 * Decoding aligns the candidate against {@link CurrentAlignmentSource} and
 * never fails: candidates with no match ground as `unaligned`. Encoding
 * projects the grounded extraction back to the candidate type. Both schemas
 * share the same field definitions, so boundary invariants stay enforced.
 *
 * **Example** (Ground one candidate through the codec)
 *
 * ```ts
 * import { AlignmentSource, CurrentAlignmentSource, GroundedExtractionFromCandidate } from "@beep/langextract/Alignment"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeEffect(GroundedExtractionFromCandidate)({ label: "person", text: "Ada Lovelace" }).pipe(
 *   Effect.provideService(CurrentAlignmentSource, AlignmentSource.make({ sourceText: "Ada Lovelace wrote notes." }))
 * )
 * Effect.runPromise(program).then((grounded) => console.log(grounded.alignmentStatus)) // "match_exact"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const GroundedExtractionFromCandidate: S.Codec<
  GroundedExtraction,
  typeof ExtractionCandidate.Encoded,
  CurrentAlignmentSource
> = ExtractionCandidate.pipe(
  S.decodeTo(S.toType(GroundedExtraction), {
    decode: SchemaGetter.transformOrFail((candidate: ExtractionCandidate) =>
      CurrentAlignmentSource.useSync((source) => alignCandidate(candidate, source))
    ),
    encode: SchemaGetter.transform(candidateFromGrounded),
  }),
  $I.annoteSchema("GroundedExtractionFromCandidate", {
    description: "Context-aware codec from a model candidate to a source-grounded extraction.",
  })
);

/**
 * Codec from a candidate batch to source-grounded extractions.
 *
 * **Details**
 *
 * Decoding caps the batch at the already-resolved `maxExtractions` of
 * {@link CurrentAlignmentSource} and aligns each surviving candidate. Encoding
 * projects every grounded extraction back to a validated candidate.
 *
 * **Example** (Ground a candidate batch through the codec)
 *
 * ```ts
 * import { AlignmentSource, CurrentAlignmentSource, GroundedExtractionsFromCandidates } from "@beep/langextract/Alignment"
 * import { Effect } from "effect"
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeEffect(GroundedExtractionsFromCandidates)([{ label: "person", text: "Ada Lovelace" }]).pipe(
 *   Effect.provideService(CurrentAlignmentSource, AlignmentSource.make({ sourceText: "Ada Lovelace wrote notes." }))
 * )
 * Effect.runPromise(program).then((grounded) => console.log(A.length(grounded))) // 1
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const GroundedExtractionsFromCandidates: S.Codec<
  ReadonlyArray<GroundedExtraction>,
  ReadonlyArray<typeof ExtractionCandidate.Encoded>,
  CurrentAlignmentSource
> = S.Array(ExtractionCandidate).pipe(
  S.decodeTo(GroundedExtraction.pipe(S.Array, S.toType), {
    decode: SchemaGetter.transformOrFail((candidates: ReadonlyArray<ExtractionCandidate>) =>
      CurrentAlignmentSource.useSync((source) => alignCandidates(candidates, source))
    ),
    encode: SchemaGetter.transform(A.map(candidateFromGrounded)),
  }),
  $I.annoteSchema("GroundedExtractionsFromCandidates", {
    description: "Context-aware codec from candidate batches to source-grounded extractions.",
  })
);

/**
 * {@inheritDoc GroundedExtractionsFromCandidates}
 * @category models
 * @since 0.0.0
 */
export type GroundedExtractionsFromCandidates = typeof GroundedExtractionsFromCandidates.Type;
