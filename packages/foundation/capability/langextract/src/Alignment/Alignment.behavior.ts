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
import * as A from "effect/Array";
import { dual, identity } from "effect/Function";
import * as Str from "effect/String";
import { DEFAULT_MAX_EXTRACTIONS, MAX_FUZZY_QUERY_LENGTH, MAX_FUZZY_SOURCE_LENGTH } from "./Alignment.config.ts";
import type { ExtractionCandidate } from "@beep/langextract/Extraction";
import type { AlignedMatch, AlignedStatus, AlignmentSource, MatchedText, ScoredMatch } from "./Alignment.model.ts";

const lower = Str.toLowerCase;

const alignedMatch = (status: AlignedStatus, [start, text]: MatchedText): AlignedMatch => [status, start, text];
const matchedText = (start: number, text: string): MatchedText => [NonNegativeInt.make(start), text];

/**
 * Convert a matched slice into its half-open source span.
 *
 * **Example** (Span from a matched slice)
 *
 * ```ts
 * import { spanFromMatch } from "@beep/langextract/Alignment"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * console.log(spanFromMatch([NonNegativeInt.make(4), "Lovelace"]).end) // 12
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const spanFromMatch = ([start, text]: MatchedText): Contract.Span =>
  Contract.Span.make({
    end: NonNegativeInt.make(start + text.length),
    start,
  });

const findExact = (sourceText: string, query: string): O.Option<MatchedText> => {
  const start = sourceText.indexOf(query);
  return start >= 0 ? O.some(matchedText(start, query)) : O.none();
};

const lowerWithSourceOffsets = (
  sourceText: string
): {
  readonly ends: ReadonlyArray<number>;
  readonly starts: ReadonlyArray<number>;
  readonly text: string;
} => {
  const starts = A.empty<number>();
  const ends = A.empty<number>();
  let text = "";
  let sourceStart = 0;

  for (const segment of sourceText) {
    const sourceEnd = sourceStart + segment.length;
    const normalizedSegment = lower(segment);
    for (let index = 0; index < normalizedSegment.length; index += 1) {
      starts.push(sourceStart);
      ends.push(sourceEnd);
    }
    text += normalizedSegment;
    sourceStart = sourceEnd;
  }

  return { ends, starts, text };
};

const findLesser = (sourceText: string, query: string): O.Option<MatchedText> => {
  const normalizedQuery = lower(query);
  if (Str.isEmpty(normalizedQuery)) {
    return O.none();
  }

  const normalizedSource = lowerWithSourceOffsets(sourceText);
  const normalizedStart = normalizedSource.text.indexOf(normalizedQuery);
  if (normalizedStart < 0) {
    return O.none();
  }

  const normalizedEnd = normalizedStart + normalizedQuery.length - 1;
  return O.flatMap(A.get(normalizedSource.starts, normalizedStart), (start) =>
    O.map(A.get(normalizedSource.ends, normalizedEnd), (end) => matchedText(start, sourceText.slice(start, end)))
  );
};

const toCodePoints = (value: string): ReadonlyArray<string> => [...value];

const levenshtein = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): number => {
  const previous = A.makeBy(right.length + 1, identity);

  for (let i = 0; i < left.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < right.length; j += 1) {
      current[j + 1] =
        left[i] === right[j]
          ? (previous[j] ?? 0)
          : Math.min(previous[j] ?? 0, current[j] ?? 0, previous[j + 1] ?? 0) + 1;
    }
    for (let k = 0; k < current.length; k += 1) {
      previous[k] = current[k] ?? 0;
    }
    previous.length = current.length;
  }

  return previous[right.length] ?? 0;
};

const similarity = (left: string, right: string): UnitInterval => {
  const leftNormalized = toCodePoints(lower(left));
  const rightNormalized = toCodePoints(lower(right));
  const denominator = Math.max(leftNormalized.length, rightNormalized.length, 1);
  return UnitInterval.make(1 - levenshtein(leftNormalized, rightNormalized) / denominator);
};

const wordsWithOffsets = (sourceText: string): ReadonlyArray<readonly [number, number]> => {
  const words = A.empty<readonly [number, number]>();
  const pattern = /\S+/gu;
  let match: RegExpExecArray | null = pattern.exec(sourceText);

  while (match !== null) {
    words.push([match.index, match.index + match[0].length]);
    match = pattern.exec(sourceText);
  }

  return words;
};

const findFuzzy = (sourceText: string, query: string, threshold: UnitInterval): O.Option<MatchedText> => {
  if (sourceText.length > MAX_FUZZY_SOURCE_LENGTH || query.length > MAX_FUZZY_QUERY_LENGTH) {
    return O.none();
  }

  const queryWordCount = query.trim().split(/\s+/u).filter(Boolean).length;
  if (queryWordCount === 0) {
    return O.none();
  }

  const words = wordsWithOffsets(sourceText);
  if (words.length < queryWordCount) {
    return O.none();
  }

  let best: O.Option<ScoredMatch> = O.none();
  for (let index = 0; index <= words.length - queryWordCount; index += 1) {
    const start = words[index]?.[0];
    const end = words[index + queryWordCount - 1]?.[1];
    if (start === undefined || end === undefined) {
      continue;
    }

    const candidate = sourceText.slice(start, end);
    const score = similarity(candidate, query);
    if (
      score >= threshold &&
      O.match(best, {
        onNone: () => true,
        onSome: (current) => score > current[2],
      })
    ) {
      best = O.some([NonNegativeInt.make(start), candidate, score]);
    }
  }

  return O.map(best, ([start, text]) => matchedText(start, text));
};

const bestAlignedMatch = (source: AlignmentSource, query: string): O.Option<AlignedMatch> =>
  O.firstSomeOf([
    O.map(findExact(source.sourceText, query), (match) => alignedMatch("match_exact", match)),
    O.map(findLesser(source.sourceText, query), (match) => alignedMatch("match_lesser", match)),
    O.map(findFuzzy(source.sourceText, query, source.fuzzyThreshold), (match) => alignedMatch("match_fuzzy", match)),
  ]);

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
    O.match(bestAlignedMatch(source, candidate.text), {
      onNone: () => GroundedExtraction.fromCandidate(candidate, "unaligned"),
      onSome: ([status, start, text]) =>
        GroundedExtraction.fromCandidate(candidate, status, spanFromMatch([start, text]), text),
    })
);

/**
 * Align a candidate batch, honoring the source's resolved extraction cap.
 *
 * **Details**
 *
 * When the source resolves no explicit `maxExtractions`, the cap falls back to
 * `min(candidates.length, DEFAULT_MAX_EXTRACTIONS)`.
 *
 * **Example** (Align candidates both ways)
 *
 * ```ts
 * import { AlignmentSource, alignCandidates } from "@beep/langextract/Alignment"
 * import { ExtractionCandidate } from "@beep/langextract/Extraction"
 *
 * const source = AlignmentSource.make({ sourceText: "Ada Lovelace wrote notes." })
 * const candidates = [ExtractionCandidate.make({ label: "person", text: "Ada Lovelace" })]
 * console.log(alignCandidates(candidates, source).length)
 * console.log(alignCandidates(source)(candidates).length)
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
  (candidates: ReadonlyArray<ExtractionCandidate>, source: AlignmentSource): ReadonlyArray<GroundedExtraction> => {
    const limit = O.getOrElse(source.maxExtractions, () => Math.min(A.length(candidates), DEFAULT_MAX_EXTRACTIONS));
    return A.map(A.take(candidates, limit), alignCandidate(source));
  }
);
