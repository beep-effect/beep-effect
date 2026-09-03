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
import { Match, MutableHashSet, Number as Num } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual, flow, identity, pipe } from "effect/Function";
import * as Str from "effect/String";
import { MAX_FUZZY_QUERY_LENGTH, MAX_FUZZY_SOURCE_LENGTH, MAX_MINIMAL_FOLD_TRANSITIONS } from "./Alignment.config.ts";
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

interface SourceOffsets {
  readonly ends: ReadonlyArray<number>;
  readonly starts: ReadonlyArray<number>;
}

interface NormalizedSourceOffsets extends SourceOffsets {
  readonly text: string;
}

interface PreparedAlignmentSource {
  readonly lesser: NormalizedSourceOffsets;
  readonly minimalFold: MinimalFoldSourceOffsets;
  readonly source: AlignmentSource;
}

type NormalizedSegment = readonly [sourceStart: number, sourceEnd: number, text: string];

interface MinimalFoldToken {
  readonly encoded: string;
  readonly optionalHyphen: boolean;
  readonly sourceEnd: number;
  readonly sourceStart: number;
}

interface MinimalFoldSourceOffsets extends SourceOffsets {
  readonly tokens: ReadonlyArray<MinimalFoldToken>;
}

interface MinimalFoldBudget {
  remaining: number;
}

interface MinimalFoldMatchSearch extends UniqueMatchSearch {
  readonly exhausted: boolean;
}

const MINIMAL_FOLD_SEGMENTS = /(-[^\S\r\n]*(?:\r\n|[\n\r])[^\S\r\n]*)|(\s+)|([^\s-]+)|(-)/gu;
const MINIMAL_FOLD_LITERAL_BASE = 0x10_000;
const MINIMAL_FOLD_OPTIONAL_HYPHEN = globalThis.String.fromCodePoint(0x20_000);
const MINIMAL_FOLD_HYPHEN = globalThis.String.fromCodePoint(MINIMAL_FOLD_LITERAL_BASE + 0x2d);

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

const encodedMinimalFoldLiteral = (text: string): string =>
  globalThis.String.fromCodePoint(Num.sum(MINIMAL_FOLD_LITERAL_BASE, O.getOrThrow(Str.charCodeAt(text, 0))));

const minimalFoldLiteralTokens = ([sourceStart, sourceEnd, text]: NormalizedSegment): ReadonlyArray<MinimalFoldToken> =>
  pipe(
    Str.split(text, ""),
    A.take(Str.length(text)),
    A.map((codeUnit) => ({
      encoded: encodedMinimalFoldLiteral(codeUnit),
      optionalHyphen: false,
      sourceEnd,
      sourceStart,
    }))
  );

const minimalFoldTokens: (sourceText: string) => ReadonlyArray<MinimalFoldToken> = flow(
  Str.matchAll(MINIMAL_FOLD_SEGMENTS),
  A.fromIterable,
  A.flatMap(
    (match): ReadonlyArray<MinimalFoldToken> =>
      pipe(
        O.fromUndefinedOr(match.index),
        O.map((sourceStart): ReadonlyArray<MinimalFoldToken> => {
          const text = match[0];
          const segmentKind = {
            endOfLineHyphen: match[1] !== undefined,
            whitespace: match[2] !== undefined,
          };
          return Match.value(segmentKind).pipe(
            Match.when({ endOfLineHyphen: true }, () => [
              {
                encoded: MINIMAL_FOLD_OPTIONAL_HYPHEN,
                optionalHyphen: true,
                sourceEnd: Num.sum(sourceStart, Str.length(text)),
                sourceStart,
              },
            ]),
            Match.when({ whitespace: true }, () => {
              const sourceEnd = Num.sum(sourceStart, Str.length(text));
              return minimalFoldLiteralTokens(normalizedSegment(sourceStart, sourceEnd, " "));
            }),
            Match.orElse(() => A.flatMap(lowerSegments(sourceStart, text), minimalFoldLiteralTokens))
          );
        }),
        O.getOrElse(A.empty)
      )
  )
);

const minimalFoldWithSourceOffsets = (sourceText: string): MinimalFoldSourceOffsets => {
  const tokens = minimalFoldTokens(sourceText);
  return {
    ends: A.map(tokens, (token) => token.sourceEnd),
    starts: A.map(tokens, (token) => token.sourceStart),
    tokens,
  };
};

const matchedTextFromOffsets = (
  sourceOffsets: SourceOffsets,
  sourceText: string,
  normalizedStart: number,
  normalizedLength: number
): O.Option<MatchedText> =>
  O.map(
    O.all({
      end: A.get(sourceOffsets.ends, Num.decrement(Num.sum(normalizedStart, normalizedLength))),
      start: A.get(sourceOffsets.starts, normalizedStart),
    }),
    ({ end, start }) => matchedText(start, Str.slice(start, end)(sourceText))
  );

const findLesser = (
  normalizedSource: NormalizedSourceOffsets,
  sourceText: string,
  query: string
): UniqueMatchSearch => {
  const normalizedQuery = lower(query);
  return findUniqueMatch(normalizedSource.text, normalizedQuery, (normalizedStart) =>
    matchedTextFromOffsets(normalizedSource, sourceText, normalizedStart, Str.length(normalizedQuery))
  );
};

const sameMatchedText = (left: MatchedText, right: MatchedText): boolean =>
  Num.Equivalence(left[0], right[0]) && Eq.equals(left[1], right[1]);

const spendMinimalFoldTransition = (budget: MinimalFoldBudget): boolean => {
  if (budget.remaining <= 0) return false;
  budget.remaining = Num.decrement(budget.remaining);
  return true;
};

const sourceTokenMatches = (source: MinimalFoldToken, query: MinimalFoldToken): boolean =>
  query.optionalHyphen || Eq.equals(query.encoded, MINIMAL_FOLD_HYPHEN)
    ? source.optionalHyphen || Eq.equals(source.encoded, MINIMAL_FOLD_HYPHEN)
    : Eq.equals(source.encoded, query.encoded);

type MinimalFoldState = readonly [queryIndex: number, sourceIndex: number];

const minimalFoldTransitions = (
  queryIndex: number,
  sourceIndex: number,
  queryToken: MinimalFoldToken,
  sourceToken: O.Option<MinimalFoldToken>,
  allOptional: boolean
): Array<MinimalFoldState> => {
  const transitions: Array<MinimalFoldState> = [];
  if (queryToken.optionalHyphen && !allOptional) transitions.push([Num.increment(queryIndex), sourceIndex]);
  if (queryIndex > 0 && O.exists(sourceToken, (token) => token.optionalHyphen)) {
    transitions.push([queryIndex, Num.increment(sourceIndex)]);
  }
  if (O.exists(sourceToken, (token) => sourceTokenMatches(token, queryToken))) {
    transitions.push([Num.increment(queryIndex), Num.increment(sourceIndex)]);
  }
  return transitions;
};

const enqueueMinimalFoldTransitions = (
  pending: Array<MinimalFoldState>,
  transitions: ReadonlyArray<MinimalFoldState>,
  budget: MinimalFoldBudget
): boolean => {
  for (const transition of transitions) {
    if (!spendMinimalFoldTransition(budget)) return false;
    pending.push(transition);
  }
  return true;
};

const appendUniqueMinimalFoldMatch = (matches: Array<MatchedText>, match: O.Option<MatchedText>): boolean =>
  O.match(match, {
    onNone: () => false,
    onSome: (value) => {
      if (A.some(matches, (candidate) => sameMatchedText(candidate, value))) return false;
      matches.push(value);
      return A.length(matches) > 1;
    },
  });

interface MinimalFoldStartSearch {
  readonly exhausted: boolean;
  readonly matches: ReadonlyArray<MatchedText>;
}

const findMinimalFoldAtStart = (
  normalizedSource: MinimalFoldSourceOffsets,
  sourceText: string,
  queryTokens: ReadonlyArray<MinimalFoldToken>,
  allOptional: boolean,
  start: number,
  budget: MinimalFoldBudget
): MinimalFoldStartSearch => {
  const pending: Array<MinimalFoldState> = [[0, start]];
  const visited = MutableHashSet.empty<number>();
  const matches: Array<MatchedText> = [];
  const sourceLength = A.length(normalizedSource.tokens);
  const queryLength = A.length(queryTokens);
  while (A.isReadonlyArrayNonEmpty(pending)) {
    const [queryIndex, sourceIndex] = O.getOrThrow(O.fromUndefinedOr(pending.pop()));
    const stateKey = Num.sum(Num.multiply(queryIndex, Num.increment(sourceLength)), sourceIndex);
    if (MutableHashSet.has(visited, stateKey)) continue;
    MutableHashSet.add(visited, stateKey);

    if (queryIndex === queryLength) {
      O.map(matchedTextFromOffsets(normalizedSource, sourceText, start, Num.subtract(sourceIndex, start)), (match) =>
        matches.push(match)
      );
      continue;
    }

    const queryToken = O.getOrThrow(A.get(queryTokens, queryIndex));
    const sourceToken = A.get(normalizedSource.tokens, sourceIndex);
    const transitions = minimalFoldTransitions(queryIndex, sourceIndex, queryToken, sourceToken, allOptional);
    if (!enqueueMinimalFoldTransitions(pending, transitions, budget)) return { exhausted: true, matches };
  }
  return { exhausted: false, matches };
};

const mergeMinimalFoldStartMatches = (
  matches: Array<MatchedText>,
  startSearch: MinimalFoldStartSearch
): Pick<MinimalFoldMatchSearch, "ambiguous" | "exhausted"> => {
  for (const match of startSearch.matches) {
    if (appendUniqueMinimalFoldMatch(matches, O.some(match))) return { ambiguous: true, exhausted: false };
  }
  return { ambiguous: false, exhausted: startSearch.exhausted };
};

const findMinimalFold = (
  normalizedSource: MinimalFoldSourceOffsets,
  sourceText: string,
  query: string,
  budget: MinimalFoldBudget
): MinimalFoldMatchSearch => {
  const rawQueryTokens = minimalFoldTokens(query);
  const allOptional =
    A.isReadonlyArrayNonEmpty(rawQueryTokens) && A.every(rawQueryTokens, (token) => token.optionalHyphen);
  const queryTokens = allOptional ? A.take(rawQueryTokens, 1) : rawQueryTokens;
  const matches: Array<MatchedText> = [];
  const sourceLength = A.length(normalizedSource.tokens);

  for (let start = 0; start < sourceLength; start = Num.increment(start)) {
    const startSearch = findMinimalFoldAtStart(normalizedSource, sourceText, queryTokens, allOptional, start, budget);
    const merged = mergeMinimalFoldStartMatches(matches, startSearch);
    if (merged.exhausted) return { ...noMatch, exhausted: true };
    if (merged.ambiguous) return { ambiguous: true, exhausted: false, match: O.none() };
  }

  return A.isReadonlyArrayNonEmpty(matches)
    ? { ambiguous: false, exhausted: false, match: A.head(matches) }
    : { ...noMatch, exhausted: false };
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
  minimalFold: minimalFoldWithSourceOffsets(source.sourceText),
  source,
});

const bestAlignedMatch = (
  prepared: PreparedAlignmentSource,
  query: string,
  minimalFoldBudget: MinimalFoldBudget
): O.Option<AlignedMatch> => {
  const exact = findExact(prepared.source.sourceText, query);
  const lesser = findLesser(prepared.lesser, prepared.source.sourceText, query);
  const minimalFold = findMinimalFold(prepared.minimalFold, prepared.source.sourceText, query, minimalFoldBudget);
  if (minimalFold.exhausted) {
    return O.none();
  }
  if (minimalFold.ambiguous) {
    return O.none();
  }

  if (O.isSome(exact.match)) {
    return O.some(alignedMatch("match_exact", exact.match.value));
  }

  if (O.isSome(lesser.match)) {
    return O.some(alignedMatch("match_lesser", lesser.match.value));
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
};

const alignPreparedCandidate = (
  prepared: PreparedAlignmentSource,
  candidate: ExtractionCandidate,
  minimalFoldBudget: MinimalFoldBudget
): GroundedExtraction =>
  O.match(bestAlignedMatch(prepared, candidate.text, minimalFoldBudget), {
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
    alignPreparedCandidate(prepareAlignmentSource(source), candidate, { remaining: MAX_MINIMAL_FOLD_TRANSITIONS })
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
        const minimalFoldBudget: MinimalFoldBudget = { remaining: MAX_MINIMAL_FOLD_TRANSITIONS };
        return A.map(cappedCandidates, (candidate) => alignPreparedCandidate(prepared, candidate, minimalFoldBudget));
      },
    })
);
