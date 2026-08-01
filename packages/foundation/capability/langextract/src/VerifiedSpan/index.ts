/**
 * Strict locator-to-raw-source mapping for verified text spans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { MAX_EXTRACTION_CANDIDATES } from "@beep/langextract/Extraction";
import { isUtf16Boundary, TextAnchor } from "@beep/provenance/TextAnchor";
import { LiteralKit, NonNegativeInt, TaggedErrorClass } from "@beep/schema";
import { A, O } from "@beep/utils";
import { Effect, flow, identity } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { GroundedExtraction } from "@beep/langextract/Extraction";

const $I = $LangExtractId.create("VerifiedSpan");
const MAX_SOURCE_TEXT_LENGTH = 1_000_000;
const MAX_LOCATOR_LENGTH = 4_096;
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

/**
 * Version of the locator-only normalization contract implemented here.
 *
 * @example
 * ```ts
 * import { VERIFIED_SPAN_NORMALIZATION_VERSION } from "@beep/langextract/VerifiedSpan"
 *
 * console.log(VERIFIED_SPAN_NORMALIZATION_VERSION) // "1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERIFIED_SPAN_NORMALIZATION_VERSION = "1";

/**
 * Offset units accepted at explicit foreign-boundary adapters.
 *
 * @example
 * ```ts
 * import { TextOffsetUnit } from "@beep/langextract/VerifiedSpan"
 *
 * console.log(TextOffsetUnit.is["utf16-code-unit"]("utf16-code-unit")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextOffsetUnit = LiteralKit(["unicode-code-point", "utf16-code-unit"]).pipe(
  $I.annoteSchema("TextOffsetUnit", {
    description: "Declared unit for an incoming half-open source-text offset range.",
  })
);

/**
 * Type for {@link TextOffsetUnit}.
 *
 * @example
 * ```ts
 * import type { TextOffsetUnit } from "@beep/langextract/VerifiedSpan"
 *
 * const unit: TextOffsetUnit = "unicode-code-point"
 * console.log(unit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextOffsetUnit = typeof TextOffsetUnit.Type;

class TextOffsetRangeStruct extends S.Class<TextOffsetRangeStruct>($I`TextOffsetRangeStruct`)(
  {
    end: NonNegativeInt.annotateKey({
      description: "Exclusive end offset in unit.",
    }),
    start: NonNegativeInt.annotateKey({
      description: "Inclusive start offset in unit.",
    }),
    unit: TextOffsetUnit,
  },
  $I.annote("TextOffsetRangeStruct", {
    description: "Internal structural base for an explicitly unit-tagged half-open text range.",
  })
) {}

const TextOffsetRangeSchema = TextOffsetRangeStruct.mapFields(identity)
  .check(
    S.makeFilter(({ end, start }) => start < end, {
      identifier: $I`TextOffsetRangeOrderCheck`,
      title: "Text Offset Range Order",
      description: "Checks that an incoming half-open text range is non-empty and forward ordered.",
      message: "Expected start to be less than end.",
    })
  )
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(fc.nat(10_000), fc.integer({ min: 1, max: 10_000 }), fc.constantFrom(...TextOffsetUnit.Options))
        .map(([start, width, unit]) =>
          TextOffsetRangeStruct.make({
            end: NonNegativeInt.make(start + width),
            start: NonNegativeInt.make(start),
            unit,
          })
        ),
  });

/**
 * Half-open incoming offset range with an explicit unit.
 *
 * @example
 * ```ts
 * import { TextOffsetRange } from "@beep/langextract/VerifiedSpan"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const range = TextOffsetRange.make({
 *   start: NonNegativeInt.make(1),
 *   end: NonNegativeInt.make(2),
 *   unit: "unicode-code-point",
 * })
 * console.log(range.unit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextOffsetRange extends S.Class<TextOffsetRange>($I`TextOffsetRange`)(
  TextOffsetRangeSchema,
  $I.annote("TextOffsetRange", {
    description: "A non-empty half-open incoming text range whose offset unit is declared explicitly.",
  })
) {}

class Utf16TextRangeStruct extends S.Class<Utf16TextRangeStruct>($I`Utf16TextRangeStruct`)(
  {
    endChar: NonNegativeInt.annotateKey({
      description: "Exclusive UTF-16 code-unit offset.",
    }),
    startChar: NonNegativeInt.annotateKey({
      description: "Inclusive UTF-16 code-unit offset.",
    }),
  },
  $I.annote("Utf16TextRangeStruct", {
    description: "Internal structural base for a canonical half-open UTF-16 code-unit range.",
  })
) {}

const Utf16TextRangeSchema = Utf16TextRangeStruct.mapFields(identity)
  .check(
    S.makeFilter(({ endChar, startChar }) => startChar < endChar, {
      identifier: $I`Utf16TextRangeOrderCheck`,
      title: "UTF-16 Text Range Order",
      description: "Checks that a canonical half-open UTF-16 range is non-empty and forward ordered.",
      message: "Expected startChar to be less than endChar.",
    })
  )
  .annotate({
    toArbitrary: () => (fc) =>
      fc.tuple(fc.nat(10_000), fc.integer({ min: 1, max: 10_000 })).map(([startChar, width]) =>
        Utf16TextRangeStruct.make({
          endChar: NonNegativeInt.make(startChar + width),
          startChar: NonNegativeInt.make(startChar),
        })
      ),
  });

/**
 * Canonical half-open UTF-16 code-unit range.
 *
 * @example
 * ```ts
 * import { Utf16TextRange } from "@beep/langextract/VerifiedSpan"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const range = Utf16TextRange.make({
 *   startChar: NonNegativeInt.make(1),
 *   endChar: NonNegativeInt.make(3),
 * })
 * console.log(range.endChar) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Utf16TextRange extends S.Class<Utf16TextRange>($I`Utf16TextRange`)(
  Utf16TextRangeSchema,
  $I.annote("Utf16TextRange", {
    description: "Canonical non-empty half-open UTF-16 code-unit source-text range.",
  })
) {}

/**
 * One raw source chunk at an explicit global UTF-16 offset.
 *
 * Separators are part of `text`; reconstruction never inserts one.
 *
 * @example
 * ```ts
 * import { RawTextChunk } from "@beep/langextract/VerifiedSpan"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const chunk = RawTextChunk.make({
 *   startChar: NonNegativeInt.make(0),
 *   text: "page one\f",
 * })
 * console.log(chunk.text)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawTextChunk extends S.Class<RawTextChunk>($I`RawTextChunk`)(
  {
    startChar: NonNegativeInt.annotateKey({
      description: "Global UTF-16 code-unit offset of the first code unit in text.",
    }),
    text: S.NonEmptyString.annotateKey({
      description: "Exact raw chunk text, including every separator after the preceding content.",
    }),
  },
  $I.annote("RawTextChunk", {
    description: "An exact raw source chunk with an explicit global UTF-16 start offset.",
  })
) {}

/**
 * Machine-readable strict-span mapping failures.
 *
 * @example
 * ```ts
 * import { VerifiedSpanErrorReason } from "@beep/langextract/VerifiedSpan"
 *
 * console.log(VerifiedSpanErrorReason.is.ambiguous("ambiguous")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const VerifiedSpanErrorReason = LiteralKit([
  "absent-text",
  "ambiguous",
  "invalid-offset",
  "limit-exceeded",
  "malformed-source",
  "not-found",
]).pipe(
  $I.annoteSchema("VerifiedSpanErrorReason", {
    description: "Fail-closed reasons emitted by strict locator-to-raw-source mapping.",
  })
);

/**
 * Type for {@link VerifiedSpanErrorReason}.
 *
 * @example
 * ```ts
 * import type { VerifiedSpanErrorReason } from "@beep/langextract/VerifiedSpan"
 *
 * const reason: VerifiedSpanErrorReason = "not-found"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type VerifiedSpanErrorReason = typeof VerifiedSpanErrorReason.Type;

/**
 * Sanitized strict-span mapping failure.
 *
 * @example
 * ```ts
 * import { VerifiedSpanError } from "@beep/langextract/VerifiedSpan"
 *
 * console.log(VerifiedSpanError.fromReason("ambiguous").reason) // "ambiguous"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VerifiedSpanError extends TaggedErrorClass<VerifiedSpanError>($I`VerifiedSpanError`)(
  "VerifiedSpanError",
  {
    candidateIndex: S.optionalKey(NonNegativeInt),
    message: S.String,
    reason: VerifiedSpanErrorReason,
  },
  $I.annote("VerifiedSpanError", {
    description: "Sanitized failure from bounded strict source-text reconstruction or locator mapping.",
  })
) {
  /**
   * Construct a failure without retaining raw source or locator text.
   *
   * @param reason - Machine-readable closed-failure reason.
   * @param candidateIndex - Optional index into a direct `GroundedExtraction[]` input.
   * @returns A sanitized verified-span error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (reason: VerifiedSpanErrorReason, candidateIndex?: NonNegativeInt): VerifiedSpanError =>
    VerifiedSpanError.make({
      ...O.getSomesStruct({
        candidateIndex: O.fromUndefinedOr(candidateIndex),
      }),
      message: `Verified span rejected: ${reason}.`,
      reason,
    });
}

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
  const clusters: Array<RawCluster> = [];
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
  const starts: Array<number> = A.empty();
  const ends: Array<number> = A.empty();
  let text = "";

  for (const [sourceStart, sourceEnd] of sourceClusters(source)) {
    for (const point of normalizeCluster(Str.slice(sourceStart, sourceEnd)(source))) {
      text = appendNormalizedPoint(starts, ends, text, point, sourceStart, sourceEnd);
    }
  }

  return { ends, starts, text };
};

/**
 * Normalize text only for deterministic location.
 *
 * The result uses NFKC, straight quote equivalents, and collapsed whitespace.
 * It is never evidence text: successful APIs always recover and emit a raw
 * source slice.
 *
 * @example
 * ```ts
 * import { normalizeTextLocator } from "@beep/langextract/VerifiedSpan"
 *
 * console.log(normalizeTextLocator("“of\uFB01ce”\nrecord")) // "\"office\" record"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeTextLocator = (value: string): string => normalizeWithRawOffsets(value).text;

const indexOfFrom = (text: string, locator: string, from: number): number => text.indexOf(locator, from);

const hasSameRange = (anchors: ReadonlyArray<TextAnchor>, candidate: TextAnchor): boolean =>
  A.some(
    anchors,
    (anchor) => Eq.equals(anchor.startChar, candidate.startChar) && Eq.equals(anchor.endChar, candidate.endChar)
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

const findRawMatches = (
  sourceText: string,
  normalizedSource: NormalizedTextWithRawOffsets,
  locator: string
): ReadonlyArray<TextAnchor> => {
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
};

const locatePreparedRawText = Effect.fnUntraced(function* (
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
});

/**
 * Locate one normalized candidate and recover its unique exact raw slice.
 *
 * Case folding and fuzzy/lesser matching are deliberately absent. Multiple raw
 * occurrences fail as ambiguous rather than choosing the first.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { locateRawText } from "@beep/langextract/VerifiedSpan"
 *
 * Effect.runPromise(locateRawText("The “of\uFB01ce” record.", "\"office\"")).then(
 *   (anchor) => console.log(anchor.quote)
 * )
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const locateRawText = Effect.fn("VerifiedSpan.locateRawText")(function* (
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
});

/**
 * Convert one declared half-open range into canonical UTF-16 offsets.
 *
 * Ranges that split a surrogate pair, exceed the source, or are empty/reversed
 * fail closed.
 *
 * @example
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
export const convertTextOffsetRange = Effect.fn("VerifiedSpan.convertTextOffsetRange")(function* (
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
});

/**
 * Reconstruct one exact raw source from explicit contiguous chunks.
 *
 * Each chunk start is global UTF-16. Separators must already be present in
 * chunk text; gaps, overlaps, and empty input fail closed.
 *
 * @example
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
  if (Eq.equals(A.length(chunks), 0)) {
    return yield* VerifiedSpanError.fromReason("absent-text");
  }

  const parts: Array<string> = A.empty();
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
 * Legacy alignment status, span, and `matchedText` are not authorization
 * inputs: each candidate's original `text` is independently located under the
 * strict normalization contract.
 *
 * @example
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
export const locateGroundedExtractions = Effect.fn("VerifiedSpan.locateGroundedExtractions")(function* (
  sourceText: string,
  extractions: ReadonlyArray<GroundedExtraction>
): Effect.fn.Return<ReadonlyArray<TextAnchor>, VerifiedSpanError> {
  if (A.length(extractions) > MAX_EXTRACTION_CANDIDATES) {
    return yield* VerifiedSpanError.fromReason("limit-exceeded");
  }
  if (Eq.equals(A.length(extractions), 0)) {
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
});
