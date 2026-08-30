/**
 * Deterministic source alignment behavior over the alignment model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GroundedExtraction } from "@beep/langextract/Extraction";
import { Contract, UnitInterval } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema/Int";
import * as O from "@beep/utils/Option";
import { Match, Number as Num } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual, flow, identity, pipe } from "effect/Function";
import * as Str from "effect/String";
import { MAX_FUZZY_QUERY_LENGTH, MAX_FUZZY_SOURCE_LENGTH } from "./Alignment.config.ts";
import type { ExtractionCandidate } from "@beep/langextract/Extraction";
import type { AlignedMatch, AlignedStatus, AlignmentSource, MatchedText, ScoredMatch } from "./Alignment.model.ts";

const lower = Str.toLowerCase;

const alignedMatch = (status: AlignedStatus, [start, text]: MatchedText): AlignedMatch => [status, start, text];
const matchedText = (start: number, text: string): MatchedText => [NonNegativeInt.make(start), text];
const candidateFields = (candidate: ExtractionCandidate) => ({
  attributes: candidate.attributes,
  confidence: candidate.confidence,
  label: candidate.label,
  text: candidate.text,
});

interface UniqueMatchSearch {
  readonly ambiguous: boolean;
  readonly match: O.Option<MatchedText>;
}

const noMatch: UniqueMatchSearch = { ambiguous: false, match: O.none() };

const findUniqueMatch = (
  sourceText: string,
  query: string,
  matchAt: (start: number) => O.Option<MatchedText>
): UniqueMatchSearch =>
  O.match(
    O.all({
      first: Str.indexOf(query)(sourceText),
      last: Str.lastIndexOf(query)(sourceText),
    }),
    {
      onNone: () => noMatch,
      onSome: ({ first, last }) =>
        Num.Equivalence(first, last)
          ? { ambiguous: false, match: matchAt(first) }
          : { ambiguous: true, match: O.none() },
    }
  );

/**
 * Convert a matched slice into its half-open source span.
 *
 * **Example** (Span from a matched slice)
 *
 * ```ts import.meta.vitest name="Span from a matched slice"
 * import { spanFromMatch } from "@beep/langextract/Alignment"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * spanFromMatch([NonNegativeInt.make(4), "Lovelace"]).end // => 12
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const spanFromMatch = ([start, text]: MatchedText): Contract.Span =>
  Contract.Span.make({
    end: NonNegativeInt.make(Num.sum(start, Str.length(text))),
    start,
  });

const findExact = (sourceText: string, query: string): UniqueMatchSearch =>
  findUniqueMatch(sourceText, query, (start) => O.some(matchedText(start, query)));

interface NormalizedSourceOffsets {
  readonly ends: ReadonlyArray<number>;
  readonly starts: ReadonlyArray<number>;
  readonly text: string;
}

interface PreparedAlignmentSource {
  readonly lesser: NormalizedSourceOffsets;
  readonly minimalFold: ReadonlyArray<NormalizedSourceOffsets>;
  readonly source: AlignmentSource;
}

type NormalizedSegment = readonly [sourceStart: number, sourceEnd: number, text: string];

type MinimalFoldMode = "drop-end-of-line-hyphen" | "keep-end-of-line-hyphen";

const MINIMAL_FOLD_MODES: ReadonlyArray<MinimalFoldMode> = ["drop-end-of-line-hyphen", "keep-end-of-line-hyphen"];
const MINIMAL_FOLD_SEGMENTS = /(-[^\S\r\n]*(?:\r\n|[\n\r])[^\S\r\n]*)|(\s+)|([^\s-]+)|(-)/gu;

const normalizedSegment = (sourceStart: number, sourceEnd: number, text: string): NormalizedSegment => [
  sourceStart,
  sourceEnd,
  text,
];

const normalizedSourceOffsets = (segments: ReadonlyArray<NormalizedSegment>): NormalizedSourceOffsets => ({
  ends: A.flatMap(segments, ([, sourceEnd, text]) => {
    const codeUnits = A.take(Str.split(text, ""), Str.length(text));
    return A.map(codeUnits, () => sourceEnd);
  }),
  starts: A.flatMap(segments, ([sourceStart, , text]) => {
    const codeUnits = A.take(Str.split(text, ""), Str.length(text));
    return A.map(codeUnits, () => sourceStart);
  }),
  text: A.join(
    A.map(segments, ([, , text]) => text),
    ""
  ),
});

const lowerSegments = (sourceStart: number, text: string): ReadonlyArray<NormalizedSegment> =>
  pipe(
    A.mapAccum(A.fromIterable(text), sourceStart, (pointStart, point): readonly [number, NormalizedSegment] => {
      const pointEnd = Num.sum(pointStart, Str.length(point));
      return [pointEnd, normalizedSegment(pointStart, pointEnd, lower(point))];
    }),
    ([, segments]) => segments
  );

const lowerWithSourceOffsets = (sourceText: string): NormalizedSourceOffsets =>
  pipe(
    A.mapAccum(A.fromIterable(sourceText), 0, (sourceStart, segment): readonly [number, NormalizedSegment] => {
      const sourceEnd = Num.sum(sourceStart, Str.length(segment));
      return [sourceEnd, [sourceStart, sourceEnd, lower(segment)]];
    }),
    ([, segments]) => normalizedSourceOffsets(segments)
  );

const minimalFoldWithSourceOffsets = (sourceText: string, mode: MinimalFoldMode): NormalizedSourceOffsets =>
  pipe(
    sourceText,
    Str.matchAll(MINIMAL_FOLD_SEGMENTS),
    A.fromIterable,
    A.flatMap(
      (match): ReadonlyArray<NormalizedSegment> =>
        pipe(
          O.fromUndefinedOr(match.index),
          O.map((sourceStart): ReadonlyArray<NormalizedSegment> => {
            const text = match[0];
            const segmentKind = {
              endOfLineHyphen: match[1] !== undefined,
              whitespace: match[2] !== undefined,
            };
            return Match.value(segmentKind).pipe(
              Match.when({ endOfLineHyphen: true }, () =>
                Match.value(mode).pipe(
                  Match.when("drop-end-of-line-hyphen", A.empty<NormalizedSegment>),
                  Match.orElse(() => [normalizedSegment(sourceStart, Num.increment(sourceStart), "-")])
                )
              ),
              Match.when({ whitespace: true }, () => {
                const sourceEnd = Num.sum(sourceStart, Str.length(text));
                return [normalizedSegment(sourceStart, sourceEnd, " ")];
              }),
              Match.orElse(() => lowerSegments(sourceStart, text))
            );
          }),
          O.getOrElse(A.empty)
        )
    ),
    normalizedSourceOffsets
  );

const minimalFoldVariants = (sourceText: string): ReadonlyArray<NormalizedSourceOffsets> =>
  pipe(
    MINIMAL_FOLD_MODES,
    A.map((mode) => minimalFoldWithSourceOffsets(sourceText, mode)),
    A.dedupeWith((left, right) => Eq.equals(left.text, right.text))
  );

const matchedTextFromNormalized = (
  normalizedSource: NormalizedSourceOffsets,
  sourceText: string,
  normalizedStart: number,
  normalizedQuery: string
): O.Option<MatchedText> =>
  O.map(
    O.all({
      end: A.get(normalizedSource.ends, Num.decrement(Num.sum(normalizedStart, Str.length(normalizedQuery)))),
      start: A.get(normalizedSource.starts, normalizedStart),
    }),
    ({ end, start }) => matchedText(start, Str.slice(start, end)(sourceText))
  );

const findLesser = (
  normalizedSource: NormalizedSourceOffsets,
  sourceText: string,
  query: string
): UniqueMatchSearch => {
  const normalizedQuery = lower(query);
  if (Str.isEmpty(normalizedQuery)) {
    return noMatch;
  }

  return findUniqueMatch(normalizedSource.text, normalizedQuery, (normalizedStart) =>
    matchedTextFromNormalized(normalizedSource, sourceText, normalizedStart, normalizedQuery)
  );
};

const sameMatchedText = (left: MatchedText, right: MatchedText): boolean =>
  Num.Equivalence(left[0], right[0]) && Eq.equals(left[1], right[1]);

const findMinimalFold = (
  normalizedSources: ReadonlyArray<NormalizedSourceOffsets>,
  sourceText: string,
  query: string
): UniqueMatchSearch => {
  const normalizedQueries = pipe(
    minimalFoldVariants(query),
    A.map((variant) => variant.text),
    A.filter(Str.isNonEmpty),
    A.dedupe
  );
  const searches = A.flatMap(normalizedSources, (normalizedSource) =>
    A.map(normalizedQueries, (normalizedQuery) =>
      findUniqueMatch(normalizedSource.text, normalizedQuery, (normalizedStart) =>
        matchedTextFromNormalized(normalizedSource, sourceText, normalizedStart, normalizedQuery)
      )
    )
  );

  if (A.some(searches, (search) => search.ambiguous)) {
    return { ambiguous: true, match: O.none() };
  }

  const matches = pipe(
    searches,
    A.map((search) => search.match),
    A.getSomes,
    A.dedupeWith(sameMatchedText)
  );

  return Match.value(A.length(matches)).pipe(
    Match.when(0, () => noMatch),
    Match.when(1, () => ({ ambiguous: false, match: A.head(matches) })),
    Match.orElse(() => ({ ambiguous: true, match: O.none() }))
  );
};

const toCodePoints = A.fromIterable<string>;

const levenshtein = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): number => {
  const initial = A.makeBy(Num.increment(A.length(right)), identity);
  const final = A.reduce(left, initial, (previous, leftPoint, leftIndex) => {
    const currentStart = Num.increment(leftIndex);
    const [, currentTail] = A.mapAccum(
      right,
      currentStart,
      (leftDistance, rightPoint, rightIndex): readonly [number, number] => {
        const diagonal = O.getOrElse(A.get(previous, rightIndex), () => 0);
        const above = O.getOrElse(A.get(previous, Num.increment(rightIndex)), () => 0);
        const distance = Eq.equals(leftPoint, rightPoint)
          ? diagonal
          : Num.increment(Num.min(diagonal, Num.min(leftDistance, above)));
        return [distance, distance];
      }
    );
    return A.prepend(currentTail, currentStart);
  });

  return O.getOrElse(A.get(final, A.length(right)), () => 0);
};

const similarity = (left: string, right: string): UnitInterval => {
  const leftNormalized = toCodePoints(lower(left));
  const rightNormalized = toCodePoints(lower(right));
  const denominator = Num.max(A.length(leftNormalized), Num.max(A.length(rightNormalized), 1));
  return UnitInterval.make(
    Num.subtract(1, Num.divideUnsafe(levenshtein(leftNormalized, rightNormalized), denominator))
  );
};

const wordsWithOffsets: (sourceText: string) => ReadonlyArray<readonly [number, number]> = flow(
  Str.matchAll(/\S+/gu),
  A.fromIterable,
  A.flatMap((match) =>
    A.fromOption(
      O.map(
        O.all({ match: A.head(match), start: O.fromUndefinedOr(match.index) }),
        ({ match, start }): readonly [number, number] => [start, Num.sum(start, Str.length(match))]
      )
    )
  )
);

const findFuzzy = (sourceText: string, query: string, threshold: UnitInterval): O.Option<MatchedText> => {
  if (
    Num.Equivalence(threshold, 1) ||
    Str.length(sourceText) > MAX_FUZZY_SOURCE_LENGTH ||
    Str.length(query) > MAX_FUZZY_QUERY_LENGTH
  ) {
    return O.none();
  }

  const normalizedQuery = Str.trim(query);
  if (Str.isEmpty(normalizedQuery)) {
    return O.none();
  }

  const queryWordCount = A.length(Str.split(normalizedQuery, /\s+/u));
  const words = wordsWithOffsets(sourceText);
  if (A.length(words) < queryWordCount) {
    return O.none();
  }

  const scored = pipe(
    A.makeBy(Num.increment(Num.subtract(A.length(words), queryWordCount)), (index) =>
      O.map(
        O.all({
          end: O.map(A.get(words, Num.decrement(Num.sum(index, queryWordCount))), ([, end]) => end),
          start: O.map(A.get(words, index), ([start]) => start),
        }),
        ({ end, start }): ScoredMatch => {
          const candidate = Str.slice(start, end)(sourceText);
          return [NonNegativeInt.make(start), candidate, similarity(candidate, query)];
        }
      )
    ),
    A.getSomes,
    A.filter(([, , score]) => Num.isGreaterThanOrEqualTo(score, threshold))
  );
  const best = A.reduce(scored, O.none<ScoredMatch>(), (currentBest, candidate) =>
    pipe(
      currentBest,
      O.filter((current) => Num.isGreaterThanOrEqualTo(current[2], candidate[2])),
      O.orElse(() => O.some(candidate))
    )
  );

  return O.map(best, ([start, text]) => matchedText(start, text));
};

const prepareAlignmentSource = (source: AlignmentSource): PreparedAlignmentSource => ({
  lesser: lowerWithSourceOffsets(source.sourceText),
  minimalFold: minimalFoldVariants(source.sourceText),
  source,
});

const bestAlignedMatch = (prepared: PreparedAlignmentSource, query: string): O.Option<AlignedMatch> => {
  const exact = findExact(prepared.source.sourceText, query);
  if (exact.ambiguous) {
    return O.none();
  }

  return pipe(
    exact.match,
    O.map((match) => alignedMatch("match_exact", match)),
    O.orElse(() => {
      const lesser = findLesser(prepared.lesser, prepared.source.sourceText, query);
      if (lesser.ambiguous) {
        return O.none();
      }
      return pipe(
        lesser.match,
        O.map((match) => alignedMatch("match_lesser", match)),
        O.orElse(() => {
          const minimalFold = findMinimalFold(prepared.minimalFold, prepared.source.sourceText, query);
          if (minimalFold.ambiguous) {
            return O.none();
          }
          return pipe(
            minimalFold.match,
            O.map((match) => alignedMatch("match_minimal_fold", match)),
            O.orElse(() =>
              O.map(findFuzzy(prepared.source.sourceText, query, prepared.source.fuzzyThreshold), (match) =>
                alignedMatch("match_fuzzy", match)
              )
            )
          );
        })
      );
    })
  );
};

const alignPreparedCandidate = (
  prepared: PreparedAlignmentSource,
  candidate: ExtractionCandidate
): GroundedExtraction =>
  O.match(bestAlignedMatch(prepared, candidate.text), {
    onNone: () => GroundedExtraction.cases.unaligned.make(candidateFields(candidate)),
    onSome: ([status, start, text]) =>
      Match.value(status).pipe(
        Match.when("match_exact", () =>
          GroundedExtraction.cases.match_exact.make({
            ...candidateFields(candidate),
            matchedText: text,
            span: spanFromMatch([start, text]),
          })
        ),
        Match.when("match_lesser", () =>
          GroundedExtraction.cases.match_lesser.make({
            ...candidateFields(candidate),
            matchedText: text,
            span: spanFromMatch([start, text]),
          })
        ),
        Match.when("match_minimal_fold", () =>
          GroundedExtraction.cases.match_minimal_fold.make({
            ...candidateFields(candidate),
            matchedText: text,
            span: spanFromMatch([start, text]),
          })
        ),
        Match.when("match_fuzzy", () =>
          GroundedExtraction.cases.match_fuzzy.make({
            ...candidateFields(candidate),
            matchedText: text,
            span: spanFromMatch([start, text]),
          })
        ),
        Match.exhaustive
      ),
  });

/**
 * Align one extraction candidate against an alignment source.
 *
 * **Details**
 *
 * The candidate is the piped subject: the data-last form closes over the
 * source, so a batch maps as `A.map(candidates, alignCandidate(source))`.
 *
 * **Example** (Align a candidate both ways)
 *
 * ```ts
 * import { AlignmentSource, alignCandidate } from "@beep/langextract/Alignment"
 * import { ExtractionCandidate } from "@beep/langextract/Extraction"
 *
 * const source = AlignmentSource.make({ sourceText: "Ada Lovelace wrote notes." })
 * const candidate = ExtractionCandidate.make({ label: "person", text: "Ada Lovelace" })
 * console.log(alignCandidate(candidate, source).alignmentStatus)
 * console.log(alignCandidate(source)(candidate).alignmentStatus)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const alignCandidate: {
  (source: AlignmentSource): (candidate: ExtractionCandidate) => GroundedExtraction;
  (candidate: ExtractionCandidate, source: AlignmentSource): GroundedExtraction;
} = dual(
  2,
  (candidate: ExtractionCandidate, source: AlignmentSource): GroundedExtraction =>
    alignPreparedCandidate(prepareAlignmentSource(source), candidate)
);

/**
 * Align a candidate batch, honoring the source's resolved extraction cap.
 *
 * **Details**
 *
 * The source resolves its default cap at schema construction time, so this
 * behavior only applies the already-total `maxExtractions` value.
 *
 * **Example** (Align candidates both ways)
 *
 * ```ts
 * import { AlignmentSource, alignCandidates } from "@beep/langextract/Alignment"
 * import { ExtractionCandidate } from "@beep/langextract/Extraction"
 * import * as A from "effect/Array"
 *
 * const source = AlignmentSource.make({ sourceText: "Ada Lovelace wrote notes." })
 * const candidates = [ExtractionCandidate.make({ label: "person", text: "Ada Lovelace" })]
 * console.log(A.length(alignCandidates(candidates, source)))
 * console.log(A.length(alignCandidates(source)(candidates)))
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const alignCandidates: {
  (source: AlignmentSource): (candidates: ReadonlyArray<ExtractionCandidate>) => ReadonlyArray<GroundedExtraction>;
  (candidates: ReadonlyArray<ExtractionCandidate>, source: AlignmentSource): ReadonlyArray<GroundedExtraction>;
} = dual(
  2,
  (candidates: ReadonlyArray<ExtractionCandidate>, source: AlignmentSource): ReadonlyArray<GroundedExtraction> =>
    A.match(A.take(candidates, source.maxExtractions), {
      onEmpty: A.empty,
      onNonEmpty: (cappedCandidates) => {
        const prepared = prepareAlignmentSource(source);
        return A.map(cappedCandidates, (candidate) => alignPreparedCandidate(prepared, candidate));
      },
    })
);
