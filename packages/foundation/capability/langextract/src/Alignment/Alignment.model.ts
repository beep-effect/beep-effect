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
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import { alignCandidate, alignCandidates, spanFromMatch } from "./Alignment.behavior.ts";
import { DEFAULT_FUZZY_THRESHOLD } from "./Alignment.config.ts";
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
 * ```ts
 * import { AlignedStatus } from "@beep/langextract/Alignment"
 *
 * console.log(AlignedStatus.is.match_exact("match_exact")) // true
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
      description: "Alignment tier (exact, lesser, fuzzy) that produced the match.",
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

export declare namespace AlignedMatch {
  export type Encoded = typeof AlignedMatch.Encoded;
}

/**
 * The source text plus resolved alignment options one alignment run reads.
 *
 * **Details**
 *
 * `fuzzyThreshold` resolves at construction time through a schema constructor
 * default, so behavior never juggles an `Option` threshold. `maxExtractions`
 * stays `Option` because its fallback depends on the candidate batch length.
 *
 * **Example** (Construct an alignment source)
 *
 * ```ts
 * import { AlignmentSource } from "@beep/langextract/Alignment"
 *
 * const source = AlignmentSource.make({ sourceText: "Ada Lovelace wrote notes." })
 * console.log(source.fuzzyThreshold) // 0.82
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AlignmentSource extends S.Class<AlignmentSource>($I`AlignmentSource`)(
  {
    fuzzyThreshold: UnitInterval.pipe(SchemaUtils.withConstantDefault<number>(DEFAULT_FUZZY_THRESHOLD)),
    maxExtractions: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    sourceText: S.String,
  },
  $I.annote("AlignmentSource", {
    description: "Source text plus resolved alignment options consumed by one deterministic alignment run.",
  })
) {
  /**
   * Resolve an alignment source from source text and optional extraction options.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromOptions = (sourceText: string, options: O.Option<LangExtractOptions>): AlignmentSource =>
    AlignmentSource.make({
      sourceText,
      ...O.getSomesStruct({
        fuzzyThreshold: O.flatMap(options, (o) => o.fuzzyThreshold),
        maxExtractions: O.map(
          O.flatMap(options, (o) => o.maxExtractions),
          O.some
        ),
      }),
    });

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
 * Decoding is pure: `[start, text]` becomes `[start, start + text.length)`.
 * Encoding recovers the matched slice from {@link CurrentAlignmentSource} and
 * fails closed when the span exceeds the current source text.
 *
 * **Example** (Decode a matched slice into a span)
 *
 * ```ts
 * import { SpanFromMatch } from "@beep/langextract/Alignment"
 * import * as S from "effect/Schema"
 *
 * const span = S.decodeSync(SpanFromMatch)([4, "Lovelace"])
 * console.log(span.end) // 12
 * ```
 *
 * @category transformations
 * @since 0.0.0
 */
export const SpanFromMatch = MatchedText.pipe(
  S.decodeTo(Contract.Span, {
    decode: SchemaGetter.transform(spanFromMatch),
    encode: SchemaGetter.transformOrFail((span: Contract.Span.Encoded, options) =>
      CurrentAlignmentSource.use((source) => {
        if (span.end > source.sourceText.length) {
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
 * import * as S from "effect/Schema"
 *
 * const match = S.decodeSync(MatchedTextFromScored)([0, "Acme.", 0.8])
 * console.log(match[1]) // "Acme."
 * ```
 *
 * @category transformations
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
  })
);

/**
 * Codec that tags a matched slice with the alignment tier that produced it.
 *
 * **Example** (Tag and untag a matched slice)
 *
 * ```ts
 * import { AlignedMatchFromMatchedText } from "@beep/langextract/Alignment"
 * import * as S from "effect/Schema"
 *
 * const ExactMatch = AlignedMatchFromMatchedText("match_exact")
 * console.log(S.decodeSync(ExactMatch)([0, "Ada"])[0]) // "match_exact"
 * console.log(S.encodeSync(ExactMatch)(S.decodeSync(ExactMatch)([0, "Ada"]))[1]) // "Ada"
 * ```
 *
 * @category transformations
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
    })
  );

const candidateFromGrounded = (grounded: GroundedExtraction.Encoded) =>
  ExtractionCandidate.decodeUnknownEffect({
    label: grounded.label,
    text: grounded.text,
    attributes: grounded.attributes,
    confidence: grounded.confidence,
  }).pipe(Effect.mapError((error) => error.issue));

/**
 * Codec from a model-emitted candidate to a source-grounded extraction.
 *
 * **Details**
 *
 * Decoding aligns the candidate against {@link CurrentAlignmentSource} and
 * never fails: candidates with no match ground as `unaligned`. Encoding
 * projects the grounded extraction back to its candidate fields and re-decodes
 * them, so boundary invariants (length caps, attribute caps) stay enforced.
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
 * @category transformations
 * @since 0.0.0
 */
export const GroundedExtractionFromCandidate = ExtractionCandidate.pipe(
  S.decodeTo(GroundedExtraction, {
    decode: SchemaGetter.transformOrFail((candidate: ExtractionCandidate) =>
      CurrentAlignmentSource.useSync((source) => alignCandidate(candidate, source))
    ),
    encode: SchemaGetter.transformOrFail(candidateFromGrounded),
  })
);

/**
 * Codec from a candidate batch to source-grounded extractions.
 *
 * **Details**
 *
 * Decoding caps the batch at the resolved `maxExtractions` of
 * {@link CurrentAlignmentSource} (falling back to the default extraction cap)
 * and aligns each surviving candidate. Encoding projects every grounded
 * extraction back to a validated candidate.
 *
 * **Example** (Ground a candidate batch through the codec)
 *
 * ```ts
 * import { AlignmentSource, CurrentAlignmentSource, GroundedExtractionsFromCandidates } from "@beep/langextract/Alignment"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeEffect(GroundedExtractionsFromCandidates)([{ label: "person", text: "Ada Lovelace" }]).pipe(
 *   Effect.provideService(CurrentAlignmentSource, AlignmentSource.make({ sourceText: "Ada Lovelace wrote notes." }))
 * )
 * Effect.runPromise(program).then((grounded) => console.log(grounded.length)) // 1
 * ```
 *
 * @category transformations
 * @since 0.0.0
 */
export const GroundedExtractionsFromCandidates = S.Array(ExtractionCandidate).pipe(
  S.decodeTo(S.Array(GroundedExtraction), {
    decode: SchemaGetter.transformOrFail((candidates: ReadonlyArray<ExtractionCandidate>) =>
      CurrentAlignmentSource.useSync((source) => alignCandidates(candidates, source))
    ),
    encode: SchemaGetter.transformOrFail(Effect.forEach(candidateFromGrounded)),
  })
);
