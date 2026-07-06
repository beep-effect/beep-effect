/**
 * Deterministic source alignment for parsed extraction candidates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GroundedExtraction } from "@beep/langextract/Extraction";
import { Contract } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type { ExtractionCandidate, LangExtractOptions } from "@beep/langextract/Extraction";

const DEFAULT_FUZZY_THRESHOLD = 0.82;

/**
 * Defensive bounds for the fuzzy alignment path. Fuzzy matching slides a
 * query-sized word window across the source and runs an `O(n*m)` Levenshtein
 * comparison per window, so even schema-bounded inputs are kept within a
 * predictable CPU budget. When the source or query exceeds these limits the
 * fuzzy fallback is skipped and the candidate fails closed to `unaligned`
 * rather than blocking the runtime. The default extraction cap prevents an
 * unbounded candidate array from multiplying that per-candidate cost when the
 * caller omits an explicit `maxExtractions`.
 */
const MAX_FUZZY_SOURCE_LENGTH = 100_000;
const MAX_FUZZY_QUERY_LENGTH = 4_096;
const DEFAULT_MAX_EXTRACTIONS = 256;

const lower = Str.toLowerCase;
type AlignedStatus = "match_exact" | "match_lesser" | "match_fuzzy";
type AlignedMatch = readonly [status: AlignedStatus, start: number, text: string];
type MatchedText = readonly [start: number, text: string];
type ScoredMatch = readonly [start: number, text: string, score: number];

const alignedMatch = (status: AlignedStatus, [start, text]: MatchedText): AlignedMatch => [status, start, text];
const matchedText = (start: number, text: string): MatchedText => [start, text];

const spanFromMatch = (start: number, matchedText: string): Contract.Span =>
  Contract.Span.make({
    end: NonNegativeInt.make(start + matchedText.length),
    start: NonNegativeInt.make(start),
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
  const starts: Array<number> = [];
  const ends: Array<number> = [];
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
  if (normalizedQuery.length === 0) {
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
  const previous = A.makeBy(right.length + 1, (index) => index);

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

const similarity = (left: string, right: string): number => {
  const leftNormalized = toCodePoints(lower(left));
  const rightNormalized = toCodePoints(lower(right));
  const denominator = Math.max(leftNormalized.length, rightNormalized.length, 1);
  return 1 - levenshtein(leftNormalized, rightNormalized) / denominator;
};

const wordsWithOffsets = (sourceText: string): ReadonlyArray<readonly [number, number]> => {
  const words: Array<readonly [number, number]> = [];
  const pattern = /\S+/gu;
  let match: RegExpExecArray | null = pattern.exec(sourceText);

  while (match !== null) {
    words.push([match.index, match.index + match[0].length]);
    match = pattern.exec(sourceText);
  }

  return words;
};

const findFuzzy = (sourceText: string, query: string, threshold: number): O.Option<MatchedText> => {
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
      best = O.some([start, candidate, score]);
    }
  }

  return O.map(best, ([start, text]) => matchedText(start, text));
};

/**
 * Align one extraction candidate against source text.
 *
 * @example
 * ```ts
 * import { alignCandidate } from "@beep/langextract/Alignment"
 * import { ExtractionCandidate } from "@beep/langextract/Extraction"
 *
 * const candidate = ExtractionCandidate.make({ label: "person", text: "Ada Lovelace" })
 * console.log(alignCandidate("Ada Lovelace wrote notes.", candidate).alignmentStatus)
 * console.log(alignCandidate(candidate)("Ada Lovelace wrote notes.").alignmentStatus)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const alignCandidate: {
  (sourceText: string, candidate: ExtractionCandidate, options?: LangExtractOptions): GroundedExtraction;
  (candidate: ExtractionCandidate, options?: LangExtractOptions): (sourceText: string) => GroundedExtraction;
} = dual(
  (args) => P.isString(args[0]),
  function alignCandidateImpl(
    sourceText: string,
    candidate: ExtractionCandidate,
    options?: LangExtractOptions
  ): GroundedExtraction {
    return O.match(
      O.firstSomeOf([
        O.map(findExact(sourceText, candidate.text), (match) => alignedMatch("match_exact", match)),
        O.map(findLesser(sourceText, candidate.text), (match) => alignedMatch("match_lesser", match)),
        O.map(findFuzzy(sourceText, candidate.text, options?.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD), (match) =>
          alignedMatch("match_fuzzy", match)
        ),
      ]),
      {
        onNone: () => GroundedExtraction.fromCandidate(candidate, "unaligned"),
        onSome: ([status, start, text]) =>
          GroundedExtraction.fromCandidate(candidate, status, spanFromMatch(start, text), text),
      }
    );
  }
);

/**
 * Align candidates and honor the optional maximum extraction count.
 *
 * @example
 * ```ts
 * import { alignCandidates } from "@beep/langextract/Alignment"
 * import { ExtractionCandidate } from "@beep/langextract/Extraction"
 *
 * const candidates = [ExtractionCandidate.make({ label: "person", text: "Ada Lovelace" })]
 * console.log(alignCandidates("Ada Lovelace wrote notes.", candidates).length)
 * console.log(alignCandidates(candidates)("Ada Lovelace wrote notes.").length)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const alignCandidates: {
  (
    sourceText: string,
    candidates: ReadonlyArray<ExtractionCandidate>,
    options?: LangExtractOptions
  ): ReadonlyArray<GroundedExtraction>;
  (
    candidates: ReadonlyArray<ExtractionCandidate>,
    options?: LangExtractOptions
  ): (sourceText: string) => ReadonlyArray<GroundedExtraction>;
} = dual(
  (args) => P.isString(args[0]),
  function alignCandidatesImpl(
    sourceText: string,
    candidates: ReadonlyArray<ExtractionCandidate>,
    options?: LangExtractOptions
  ): ReadonlyArray<GroundedExtraction> {
    const limit = options?.maxExtractions ?? Math.min(candidates.length, DEFAULT_MAX_EXTRACTIONS);
    return A.map(A.take(candidates, limit), (candidate) => alignCandidate(sourceText, candidate, options));
  }
);
