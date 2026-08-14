/**
 * Strict locator normalization and raw-source mapping behavior.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { MAX_EXTRACTION_CANDIDATES } from "@beep/langextract/Extraction";
import { isUtf16Boundary, TextAnchor } from "@beep/provenance/TextAnchor";
import { NonNegativeInt } from "@beep/schema";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { dual, flow, pipe } from "effect/Function";
import * as S from "effect/Schema";
import { MAX_LOCATOR_LENGTH, MAX_SOURCE_TEXT_LENGTH } from "./VerifiedSpan.config.ts";
import { VerifiedSpanError } from "./VerifiedSpan.errors.ts";
import { TextOffsetUnit, Utf16TextRange } from "./VerifiedSpan.model.ts";
import type { GroundedExtraction } from "@beep/langextract/Extraction";
import type { RawTextChunk, TextOffsetRange } from "./VerifiedSpan.model.ts";

const $I = $LangExtractId.create("VerifiedSpan");
const combiningMarkPattern = /^\p{M}$/u;
const whitespacePattern = /^\s$/u;
const CombiningMark = S.String.check(
  S.isPattern(combiningMarkPattern, {
    identifier: $I`CombiningMarkCheck`,
    title: "Combining Mark",
    description: "Checks for one Unicode combining-mark code point.",
    message: "Expected one Unicode combining-mark code point.",
  })
);
const WhitespaceCodePoint = S.String.check(
  S.isPattern(whitespacePattern, {
    identifier: $I`WhitespaceCodePointCheck`,
    title: "Whitespace Code Point",
    description: "Checks for one Unicode whitespace code point.",
    message: "Expected one Unicode whitespace code point.",
  })
);

interface NormalizedTextWithRawOffsets {
  readonly ends: ReadonlyArray<number>;
  readonly starts: ReadonlyArray<number>;
  readonly text: string;
}

type RawCluster = readonly [start: number, end: number];

const isCombiningMark = S.is(CombiningMark);
const isWhitespace = S.is(WhitespaceCodePoint);
const normalizeUnicode = Str.normalize("NFKC");
const joinsNormalizedCluster = (source: string, cluster: RawCluster, point: string): boolean => {
  const clusterText = Str.slice(cluster[0], cluster[1])(source);
  return !Eq.equals(
    normalizeUnicode(Str.concat(clusterText, point)),
    Str.concat(normalizeUnicode(clusterText), normalizeUnicode(point))
  );
};

const sourceClusters = (source: string): ReadonlyArray<RawCluster> => {
  // Store only raw boundaries so a long combining-mark run never rebuilds its
  // accumulated text. Each cluster is sliced once during normalization below.
  const clusters = A.empty<RawCluster>();
  let start = 0;

  for (const point of source) {
    const end = start + Str.length(point);
    const previous = A.last(clusters);
    if (O.isSome(previous) && (isCombiningMark(point) || joinsNormalizedCluster(source, previous.value, point))) {
      A.spliceInPlace(clusters, {
        start: A.length(clusters) - 1,
        deleteCount: 1,
        items: [[previous.value[0], end]],
      });
    } else {
      A.appendInPlace(clusters, [start, end]);
    }
    start = end;
  }

  return clusters;
};

const normalizeCluster = flow(normalizeUnicode, Str.replace(/[‘’‚‛]/gu, "'"), Str.replace(/[“”„‟]/gu, '"'));

const appendNormalizedPoint = (
  starts: Array<number>,
  ends: Array<number>,
  text: string,
  point: string,
  sourceStart: number,
  sourceEnd: number
): string => {
  if (!isWhitespace(point)) {
    for (let index = 0; index < Str.length(point); index += 1) {
      A.appendInPlace(starts, sourceStart);
      A.appendInPlace(ends, sourceEnd);
    }
    return Str.concat(text, point);
  }

  if (Str.endsWith(" ")(text)) {
    A.spliceInPlace(ends, {
      start: A.length(ends) - 1,
      deleteCount: 1,
      items: [sourceEnd],
    });
    return text;
  }

  A.appendInPlace(starts, sourceStart);
  A.appendInPlace(ends, sourceEnd);
  return Str.concat(text, " ");
};

const normalizeWithRawOffsets = (source: string): NormalizedTextWithRawOffsets => {
  // The paired offset maps are allocation-sensitive and can contain one entry
  // per source code unit. Repository Array mutation helpers keep construction
  // linear while all reads below remain total through Option.
  const starts = A.empty<number>();
  const ends = A.empty<number>();
  let text = "";

  A.forEach(sourceClusters(source), ([sourceStart, sourceEnd]) => {
    A.forEach(pipe(source, Str.slice(sourceStart, sourceEnd), normalizeCluster), (point) => {
      text = appendNormalizedPoint(starts, ends, text, point, sourceStart, sourceEnd);
    });
  });

  return { ends, starts, text };
};

/**
 * Normalize text only for deterministic location.
 *
 * **Details**
 *
 * The result uses NFKC, straight quote equivalents, and collapsed whitespace.
 * It is never evidence text: successful APIs always recover and emit a raw
 * source slice.
 *
 * **Example** (Normalize locator candidate text)
 *
 * ```ts
 * import { normalizeTextLocator } from "@beep/langextract/VerifiedSpan"
 *
 * console.log(normalizeTextLocator("“ofﬁce”\nrecord")) // "\"office\" record"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeTextLocator = (value: string): string => normalizeWithRawOffsets(value).text;

const indexOfFrom: {
  (text: string, locator: string, from: number): number;
  (locator: string, from: number): (text: string) => number;
} = dual(3, (text: string, locator: string, from: number): number => text.indexOf(locator, from));

const hasSameRange: {
  (anchors: ReadonlyArray<TextAnchor>, candidate: TextAnchor): boolean;
  (candidate: TextAnchor): (anchors: ReadonlyArray<TextAnchor>) => boolean;
} = dual(2, (anchors: ReadonlyArray<TextAnchor>, candidate: TextAnchor): boolean =>
  A.some(
    anchors,
    (anchor) => Eq.equals(anchor.startChar, candidate.startChar) && Eq.equals(anchor.endChar, candidate.endChar)
  )
);

const appendRawMatch = (matches: Array<TextAnchor>, sourceText: string, startChar: number, endChar: number): void => {
  if (!isUtf16Boundary(sourceText, startChar) || !isUtf16Boundary(sourceText, endChar)) {
    return;
  }

  const anchor = TextAnchor.make({
    endChar: NonNegativeInt.make(endChar),
    quote: Str.slice(startChar, endChar)(sourceText),
    startChar: NonNegativeInt.make(startChar),
  });
  if (!hasSameRange(matches, anchor)) {
    A.appendInPlace(matches, anchor);
  }
};

const findRawMatches: {
  (sourceText: string, normalizedSource: NormalizedTextWithRawOffsets, locator: string): ReadonlyArray<TextAnchor>;
  (normalizedSource: NormalizedTextWithRawOffsets, locator: string): (sourceText: string) => ReadonlyArray<TextAnchor>;
} = dual(
  3,
  (sourceText: string, normalizedSource: NormalizedTextWithRawOffsets, locator: string): ReadonlyArray<TextAnchor> => {
    // crispen: overlapping-match enumeration is deliberately explicit; replacing
    // it with a first-match combinator would violate the ambiguity contract.
    const normalizedLocator = normalizeTextLocator(locator);
    const matches: Array<TextAnchor> = A.empty();
    let rawStart = indexOfFrom(sourceText, locator, 0);

    while (rawStart >= 0 && A.length(matches) < 2) {
      appendRawMatch(matches, sourceText, rawStart, rawStart + Str.length(locator));
      rawStart = indexOfFrom(sourceText, locator, rawStart + 1);
    }

    if (A.length(matches) > 0) {
      return matches;
    }

    let normalizedStart = indexOfFrom(normalizedSource.text, normalizedLocator, 0);

    while (normalizedStart >= 0 && A.length(matches) < 2) {
      const normalizedEnd = normalizedStart + Str.length(normalizedLocator);
      let nextNormalizedStart = normalizedStart + 1;
      O.match(
        O.all([
          A.get(normalizedSource.starts, normalizedStart),
          A.get(normalizedSource.ends, normalizedStart),
          A.get(normalizedSource.ends, normalizedEnd - 1),
        ]),
        {
          onNone: () => undefined,
          onSome: ([startChar, startClusterEnd, endChar]) => {
            const startsAtRawBoundary = !O.exists(
              A.get(normalizedSource.starts, normalizedStart - 1),
              Eq.equals(startChar)
            );
            const endsAtRawBoundary = !O.exists(A.get(normalizedSource.ends, normalizedEnd), Eq.equals(endChar));
            if (startsAtRawBoundary && endsAtRawBoundary) {
              const quote = Str.slice(startChar, endChar)(sourceText);
              if (Eq.equals(normalizeTextLocator(quote), normalizedLocator)) {
                appendRawMatch(matches, sourceText, startChar, endChar);
                return;
              }
            }

            while (
              O.exists(A.get(normalizedSource.starts, nextNormalizedStart), (nextStart) => nextStart < startClusterEnd)
            ) {
              nextNormalizedStart += 1;
            }
          },
        }
      );

      normalizedStart = indexOfFrom(normalizedSource.text, normalizedLocator, nextNormalizedStart);
    }

    return matches;
  }
);

const locatePreparedRawText: {
  (
    sourceText: string,
    normalizedSource: NormalizedTextWithRawOffsets,
    locator: string
  ): Effect.Effect<TextAnchor, VerifiedSpanError>;
  (
    normalizedSource: NormalizedTextWithRawOffsets,
    locator: string
  ): (sourceText: string) => Effect.Effect<TextAnchor, VerifiedSpanError>;
} = dual(
  3,
  Effect.fnUntraced(function* (
    sourceText: string,
    normalizedSource: NormalizedTextWithRawOffsets,
    locator: string
  ): Effect.fn.Return<TextAnchor, VerifiedSpanError> {
    if (Str.isEmpty(Str.trim(locator))) {
      return yield* VerifiedSpanError.fromReason("absent-text");
    }
    if (Str.length(locator) > MAX_LOCATOR_LENGTH) {
      return yield* VerifiedSpanError.fromReason("limit-exceeded");
    }

    const matches = findRawMatches(sourceText, normalizedSource, locator);
    if (Eq.equals(A.length(matches), 0)) {
      return yield* VerifiedSpanError.fromReason("not-found");
    }
    if (A.length(matches) > 1) {
      return yield* VerifiedSpanError.fromReason("ambiguous");
    }

    return yield* O.match(A.head(matches), {
      onNone: () => Effect.fail(VerifiedSpanError.fromReason("not-found")),
      onSome: Effect.succeed,
    });
  })
);

/**
 * Locate one normalized candidate and recover its unique exact raw slice.
 *
 * **Details**
 *
 * Case folding and fuzzy/lesser matching are deliberately absent. Multiple raw
 * occurrences fail as ambiguous rather than choosing the first.
 *
 * **Example** (Locate unique raw slice)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { locateRawText } from "@beep/langextract/VerifiedSpan"
 *
 * Effect.runPromise(locateRawText("The “ofﬁce” record.", "\"office\"")).then(
 *   (anchor) => console.log(anchor.quote)
 * )
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const locateRawText: {
  (sourceText: string, locator: string): Effect.Effect<TextAnchor, VerifiedSpanError>;
  (locator: string): (sourceText: string) => Effect.Effect<TextAnchor, VerifiedSpanError>;
} = dual(
  2,
  Effect.fn("VerifiedSpan.locateRawText")(function* (
    sourceText: string,
    locator: string
  ): Effect.fn.Return<TextAnchor, VerifiedSpanError> {
    if (Str.isEmpty(sourceText)) {
      return yield* VerifiedSpanError.fromReason("absent-text");
    }
    if (Str.length(sourceText) > MAX_SOURCE_TEXT_LENGTH) {
      return yield* VerifiedSpanError.fromReason("limit-exceeded");
    }

    return yield* locatePreparedRawText(sourceText, normalizeWithRawOffsets(sourceText), locator);
  })
);

/**
 * Convert one declared half-open range into canonical UTF-16 offsets.
 *
 * **Details**
 *
 * Ranges that split a surrogate pair, exceed the source, or are empty/reversed
 * fail closed.
 *
 * **Example** (Convert range to UTF-16)
 *
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   TextOffsetRange,
 *   convertTextOffsetRange,
 * } from "@beep/langextract/VerifiedSpan"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const range = TextOffsetRange.make({
 *   start: NonNegativeInt.make(1),
 *   end: NonNegativeInt.make(2),
 *   unit: "unicode-code-point",
 * })
 * Effect.runPromise(convertTextOffsetRange("A😀B", range)).then(console.log)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const convertTextOffsetRange: {
  (sourceText: string, range: TextOffsetRange): Effect.Effect<Utf16TextRange, VerifiedSpanError>;
  (range: TextOffsetRange): (sourceText: string) => Effect.Effect<Utf16TextRange, VerifiedSpanError>;
} = dual(
  2,
  Effect.fn("VerifiedSpan.convertTextOffsetRange")(function* (
    sourceText: string,
    range: TextOffsetRange
  ): Effect.fn.Return<Utf16TextRange, VerifiedSpanError> {
    if (Str.isEmpty(sourceText)) {
      return yield* VerifiedSpanError.fromReason("absent-text");
    }
    if (Str.length(sourceText) > MAX_SOURCE_TEXT_LENGTH) {
      return yield* VerifiedSpanError.fromReason("limit-exceeded");
    }

    if (TextOffsetUnit.is["utf16-code-unit"](range.unit)) {
      if (
        range.end > Str.length(sourceText) ||
        !isUtf16Boundary(sourceText, range.start) ||
        !isUtf16Boundary(sourceText, range.end)
      ) {
        return yield* VerifiedSpanError.fromReason("invalid-offset");
      }
      return Utf16TextRange.make({
        endChar: range.end,
        startChar: range.start,
      });
    }

    const points = A.fromIterable(sourceText);
    if (range.end > A.length(points)) {
      return yield* VerifiedSpanError.fromReason("invalid-offset");
    }

    return Utf16TextRange.make({
      endChar: NonNegativeInt.make(Str.length(A.join(A.take(points, range.end), ""))),
      startChar: NonNegativeInt.make(Str.length(A.join(A.take(points, range.start), ""))),
    });
  })
);

/**
 * Reconstruct one exact raw source from explicit contiguous chunks.
 *
 * **Details**
 *
 * Each chunk start is global UTF-16. Separators must already be present in
 * chunk text; gaps, overlaps, and empty input fail closed.
 *
 * **Example** (Reconstruct source from chunks)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { RawTextChunk, reconstructSourceText } from "@beep/langextract/VerifiedSpan"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const first = RawTextChunk.make({ startChar: NonNegativeInt.make(0), text: "page one\f" })
 * const second = RawTextChunk.make({ startChar: NonNegativeInt.make(9), text: "page two" })
 * Effect.runPromise(reconstructSourceText([first, second])).then(console.log)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const reconstructSourceText = Effect.fn("VerifiedSpan.reconstructSourceText")(function* (
  chunks: ReadonlyArray<RawTextChunk>
): Effect.fn.Return<string, VerifiedSpanError> {
  if (A.isReadonlyArrayEmpty(chunks)) {
    return yield* VerifiedSpanError.fromReason("absent-text");
  }

  const parts = A.empty<string>();
  let expectedStart = 0;

  for (const chunk of chunks) {
    if (!Eq.equals(chunk.startChar, expectedStart) || Str.isEmpty(chunk.text)) {
      return yield* VerifiedSpanError.fromReason("malformed-source");
    }
    A.appendInPlace(parts, chunk.text);
    expectedStart += Str.length(chunk.text);
    if (expectedStart > MAX_SOURCE_TEXT_LENGTH) {
      return yield* VerifiedSpanError.fromReason("limit-exceeded");
    }
  }

  return A.join(parts, "");
});

/**
 * Strictly locate direct `GroundedExtraction[]` candidate text in raw source.
 *
 * **Details**
 *
 * Legacy alignment status, span, and `matchedText` are not authorization
 * inputs: each candidate's original `text` is independently located under the
 * strict normalization contract.
 *
 * **Example** (Locate grounded extraction texts)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { GroundedExtraction } from "@beep/langextract/Extraction"
 * import { locateGroundedExtractions } from "@beep/langextract/VerifiedSpan"
 *
 * const candidates = [
 *   GroundedExtraction.make({
 *     alignmentStatus: "unaligned",
 *     label: "quotation",
 *     text: "\"Affirmed.\"",
 *   }),
 * ]
 * Effect.runPromise(locateGroundedExtractions("The court wrote “Affirmed.”", candidates)).then(console.log)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const locateGroundedExtractions: {
  (
    sourceText: string,
    extractions: readonly GroundedExtraction[]
  ): Effect.Effect<readonly TextAnchor[], VerifiedSpanError>;
  (
    extractions: readonly GroundedExtraction[]
  ): (sourceText: string) => Effect.Effect<readonly TextAnchor[], VerifiedSpanError>;
} = dual(
  2,
  Effect.fn("VerifiedSpan.locateGroundedExtractions")(function* (
    sourceText: string,
    extractions: ReadonlyArray<GroundedExtraction>
  ): Effect.fn.Return<ReadonlyArray<TextAnchor>, VerifiedSpanError> {
    if (A.length(extractions) > MAX_EXTRACTION_CANDIDATES) {
      return yield* VerifiedSpanError.fromReason("limit-exceeded");
    }
    if (A.isReadonlyArrayEmpty(extractions)) {
      return [];
    }
    if (Str.isEmpty(sourceText)) {
      return yield* VerifiedSpanError.fromReason("absent-text");
    }
    if (Str.length(sourceText) > MAX_SOURCE_TEXT_LENGTH) {
      return yield* VerifiedSpanError.fromReason("limit-exceeded");
    }
    const normalizedSource = normalizeWithRawOffsets(sourceText);
    return yield* Effect.forEach(
      extractions,
      (extraction, index) =>
        locatePreparedRawText(sourceText, normalizedSource, extraction.text).pipe(
          Effect.mapError((error) =>
            VerifiedSpanError.make({
              candidateIndex: NonNegativeInt.make(index),
              message: error.message,
              reason: error.reason,
            })
          )
        ),
      { concurrency: 1 }
    );
  })
);
