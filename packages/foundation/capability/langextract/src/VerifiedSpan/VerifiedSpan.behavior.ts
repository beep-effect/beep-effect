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
import { Chunk, Effect, Iterable as I, Match, Result } from "effect";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import { dual, flow, identity, pipe } from "effect/Function";
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

class NormalizedTextWithRawOffsets extends S.Class<NormalizedTextWithRawOffsets>($I`NormalizedTextWithRawOffsets`)(
  {
    ends: S.Array(NonNegativeInt),
    starts: S.Array(NonNegativeInt),
    text: S.String,
  },
  $I.annote("NormalizedTextWithRawOffsets", {
    description: "Normalized locator text paired with the raw UTF-16 source range behind each normalized code unit.",
  })
) {}

const RawCluster = S.Tuple([NonNegativeInt, NonNegativeInt]).pipe(
  $I.annoteSchema("RawCluster", {
    description: "Half-open raw UTF-16 range whose code points normalize as one cluster.",
  })
);
type RawCluster = typeof RawCluster.Type;

type SourceClusterState = readonly [start: NonNegativeInt, clusters: Array<RawCluster>];
type NormalizationState = readonly [starts: Array<NonNegativeInt>, ends: Array<NonNegativeInt>, points: Array<string>];
type NormalizedRawPoint = readonly [point: string, sourceStart: NonNegativeInt, sourceEnd: NonNegativeInt];
type MatchScanState = readonly [matchedLength: number, start: O.Option<number>];
type ReconstructionState = readonly [expectedStart: NonNegativeInt, parts: Chunk.Chunk<string>];

const rawCluster = (start: NonNegativeInt, end: NonNegativeInt): RawCluster => [start, end];
const normalizedRawPoint = (
  point: string,
  sourceStart: NonNegativeInt,
  sourceEnd: NonNegativeInt
): NormalizedRawPoint => [point, sourceStart, sourceEnd];
const sourceClusterInitial = (): SourceClusterState => [NonNegativeInt.make(0), A.empty()];
const normalizationInitial = (): NormalizationState => [A.empty(), A.empty(), A.empty()];
const matchScanInitial = (): MatchScanState => [0, O.none()];
const reconstructionInitial = (): ReconstructionState => [NonNegativeInt.make(0), Chunk.empty()];
const missingAnchor = () => "missing-anchor";
const missingMatch = () => "missing-match";

const isCombiningMark = S.is(CombiningMark);
const isWhitespace = S.is(WhitespaceCodePoint);
const normalizeUnicode = Str.normalize("NFKC");
const joinsNormalizedCluster = (source: string, cluster: RawCluster, point: string): boolean => {
  const clusterText = Str.slice(cluster[0], cluster[1])(source);
  return Bool.not(
    Eq.equals(
      normalizeUnicode(Str.concat(clusterText, point)),
      Str.concat(normalizeUnicode(clusterText), normalizeUnicode(point))
    )
  );
};

const sourceClusters = (source: string): ReadonlyArray<RawCluster> => {
  // Performance boundary: one allocation keeps cluster construction linear for
  // hostile 100k inputs. The completed array is read-only after this function.
  const [, clusters] = pipe(
    source,
    A.fromIterable,
    A.reduce(sourceClusterInitial(), ([start, clusters], point): SourceClusterState => {
      const end = NonNegativeInt.make(start + Str.length(point));
      const next = rawCluster(start, end);
      return [
        end,
        pipe(
          A.last(clusters),
          O.match({
            onNone: () => A.appendInPlace(clusters, next),
            onSome: (previous) =>
              pipe(
                Bool.match(isCombiningMark(point), {
                  onFalse: () => joinsNormalizedCluster(source, previous, point),
                  onTrue: () => true,
                }),
                Bool.match({
                  onFalse: () => A.appendInPlace(clusters, next),
                  onTrue: () => {
                    A.spliceInPlace(clusters, {
                      start: A.length(clusters) - 1,
                      deleteCount: 1,
                      items: [rawCluster(previous[0], end)],
                    });
                    return clusters;
                  },
                })
              ),
          })
        ),
      ];
    })
  );
  return clusters;
};

const normalizeCluster = flow(normalizeUnicode, Str.replace(/[‘’‚‛]/gu, "'"), Str.replace(/[“”„‟]/gu, '"'));

const appendNormalizedPoint = (
  [starts, ends, points]: NormalizationState,
  point: string,
  sourceStart: NonNegativeInt,
  sourceEnd: NonNegativeInt
): NormalizationState =>
  pipe(
    isWhitespace(point),
    Bool.match({
      onFalse: () => {
        A.appendAllInPlace(starts, A.replicate(sourceStart, Str.length(point)));
        A.appendAllInPlace(ends, A.replicate(sourceEnd, Str.length(point)));
        A.appendInPlace(points, point);
        return [starts, ends, points];
      },
      onTrue: () =>
        Match.value(O.exists(A.last(points), Eq.equals(" "))).pipe(
          Match.when(false, (): NormalizationState => {
            A.appendInPlace(starts, sourceStart);
            A.appendInPlace(ends, sourceEnd);
            A.appendInPlace(points, " ");
            return [starts, ends, points];
          }),
          Match.orElse((): NormalizationState => {
            A.spliceInPlace(ends, {
              start: A.length(ends) - 1,
              deleteCount: 1,
              items: [sourceEnd],
            });
            return [starts, ends, points];
          })
        ),
    })
  );

const normalizeWithRawOffsets = (source: string): NormalizedTextWithRawOffsets => {
  // Performance boundary: these parallel offset maps can hold multiple entries per source
  // code unit. Mutation stays inside this allocation boundary; the completed
  // schema value is immutable to every downstream consumer.
  const [starts, ends, points] = pipe(
    sourceClusters(source),
    I.flatMap(([sourceStart, sourceEnd]) =>
      pipe(
        source,
        Str.slice(sourceStart, sourceEnd),
        normalizeCluster,
        I.map((point) => normalizedRawPoint(point, sourceStart, sourceEnd))
      )
    ),
    I.reduce(normalizationInitial(), (state, [point, sourceStart, sourceEnd]) =>
      appendNormalizedPoint(state, point, sourceStart, sourceEnd)
    )
  );

  return NormalizedTextWithRawOffsets.make({
    ends,
    starts,
    text: A.join(points, ""),
  });
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
 * ```ts import.meta.vitest name="Normalize locator candidate text"
 * import { normalizeTextLocator } from "@beep/langextract/VerifiedSpan"
 *
 * normalizeTextLocator("“ofﬁce”\nrecord") // => "\"office\" record"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeTextLocator = (value: string): string => normalizeWithRawOffsets(value).text;

const fallbackLengths = (prefixTable: ReadonlyArray<number>, matchedLength: number): Iterable<number> =>
  I.unfold(
    O.some(matchedLength),
    O.map((length): readonly [number, O.Option<number>] => [
      length,
      pipe(
        length > 0,
        Bool.match({
          onFalse: O.none<number>,
          onTrue: () => A.get(prefixTable, length - 1),
        })
      ),
    ])
  );

const nextMatchedLength = (
  locator: string,
  prefixTable: ReadonlyArray<number>,
  matchedLength: number,
  codeUnit: number
): number =>
  pipe(
    fallbackLengths(prefixTable, matchedLength),
    I.findFirst((candidate) => O.exists(Str.charCodeAt(locator, candidate), Eq.equals(codeUnit))),
    O.map((candidate) => candidate + 1),
    O.getOrElse(() => 0)
  );

const prefixTable = (locator: string): ReadonlyArray<number> => {
  // Performance boundary: this is the single KMP-table allocation. In-place append
  // is linear; the table is immutable as soon as construction returns.
  const table = A.make(0);
  pipe(
    I.range(1),
    I.take(Str.length(locator) - 1),
    I.reduce(0, (matchedLength, index) => {
      const nextLength = pipe(
        Str.charCodeAt(locator, index),
        O.map((codeUnit) => nextMatchedLength(locator, table, matchedLength, codeUnit)),
        O.getOrElse(() => 0)
      );
      A.appendInPlace(table, nextLength);
      return nextLength;
    })
  );
  return table;
};

const matchStarts = (text: string, locator: string): Iterable<number> => {
  const locatorLength = Str.length(locator);
  const table = prefixTable(locator);
  const retainedLength = pipe(
    A.get(table, locatorLength - 1),
    O.getOrElse(() => 0)
  );
  return pipe(
    I.range(0),
    I.take(Str.length(text)),
    I.scan(matchScanInitial(), ([matchedLength], index): MatchScanState => {
      const nextLength = pipe(
        Str.charCodeAt(text, index),
        O.map((codeUnit) => nextMatchedLength(locator, table, matchedLength, codeUnit)),
        O.getOrElse(() => 0)
      );
      return pipe(
        Eq.equals(nextLength, locatorLength),
        Bool.match({
          onFalse: () => [nextLength, O.none()],
          onTrue: () => [retainedLength, O.some(index - locatorLength + 1)],
        })
      );
    }),
    I.filterMap(([, start]) => Result.fromOption(start, missingMatch))
  );
};

const rawAnchor = (sourceText: string, startChar: number, endChar: number): O.Option<TextAnchor> =>
  pipe(
    Bool.and(isUtf16Boundary(sourceText, startChar), isUtf16Boundary(sourceText, endChar)),
    Bool.match({
      onFalse: O.none<TextAnchor>,
      onTrue: () =>
        O.some(
          TextAnchor.make({
            endChar: NonNegativeInt.make(endChar),
            quote: Str.slice(startChar, endChar)(sourceText),
            startChar: NonNegativeInt.make(startChar),
          })
        ),
    })
  );

const exactRawMatches = (sourceText: string, locator: string): ReadonlyArray<TextAnchor> =>
  pipe(
    matchStarts(sourceText, locator),
    I.filterMap((startChar) =>
      pipe(rawAnchor(sourceText, startChar, startChar + Str.length(locator)), Result.fromOption(missingAnchor))
    ),
    I.take(2),
    A.fromIterable
  );

type NormalizedRange = readonly [startChar: NonNegativeInt, endChar: NonNegativeInt];

const normalizedRange = (
  normalizedSource: NormalizedTextWithRawOffsets,
  normalizedStart: number,
  normalizedEnd: number
): O.Option<NormalizedRange> =>
  O.all([A.get(normalizedSource.starts, normalizedStart), A.get(normalizedSource.ends, normalizedEnd - 1)]);

const normalizedRawAnchor = (
  sourceText: string,
  normalizedSource: NormalizedTextWithRawOffsets,
  normalizedLocator: string,
  normalizedStart: number,
  normalizedEnd: number,
  startChar: NonNegativeInt,
  endChar: NonNegativeInt
): O.Option<TextAnchor> =>
  pipe(
    Bool.and(
      Bool.not(O.exists(A.get(normalizedSource.starts, normalizedStart - 1), Eq.equals(startChar))),
      Bool.not(O.exists(A.get(normalizedSource.ends, normalizedEnd), Eq.equals(endChar)))
    ),
    Bool.match({
      onFalse: O.none<TextAnchor>,
      onTrue: () =>
        pipe(
          rawAnchor(sourceText, startChar, endChar),
          O.filter((anchor) => Eq.equals(normalizeTextLocator(anchor.quote), normalizedLocator))
        ),
    })
  );

const normalizedRawMatches = (
  sourceText: string,
  normalizedSource: NormalizedTextWithRawOffsets,
  normalizedLocator: string
): ReadonlyArray<TextAnchor> =>
  pipe(
    matchStarts(normalizedSource.text, normalizedLocator),
    I.map((normalizedStart): O.Option<TextAnchor> => {
      const normalizedEnd = normalizedStart + Str.length(normalizedLocator);
      return pipe(
        normalizedRange(normalizedSource, normalizedStart, normalizedEnd),
        O.flatMap(([startChar, endChar]) =>
          normalizedRawAnchor(
            sourceText,
            normalizedSource,
            normalizedLocator,
            normalizedStart,
            normalizedEnd,
            startChar,
            endChar
          )
        )
      );
    }),
    I.filterMap(Result.fromOption(missingAnchor)),
    I.take(2),
    A.fromIterable
  );

const findRawMatches: {
  (sourceText: string, normalizedSource: NormalizedTextWithRawOffsets, locator: string): ReadonlyArray<TextAnchor>;
  (normalizedSource: NormalizedTextWithRawOffsets, locator: string): (sourceText: string) => ReadonlyArray<TextAnchor>;
} = dual(
  3,
  (sourceText: string, normalizedSource: NormalizedTextWithRawOffsets, locator: string): ReadonlyArray<TextAnchor> => {
    const normalizedLocator = normalizeTextLocator(locator);
    const exactMatches = exactRawMatches(sourceText, locator);
    return A.match(exactMatches, {
      onEmpty: () => normalizedRawMatches(sourceText, normalizedSource, normalizedLocator),
      onNonEmpty: identity,
    });
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
    if (A.isReadonlyArrayEmpty(matches)) {
      return yield* VerifiedSpanError.fromReason("not-found");
    }
    if (A.length(matches) > 1) {
      return yield* VerifiedSpanError.fromReason("ambiguous");
    }

    return yield* Effect.fromOption(A.head(matches), () => VerifiedSpanError.fromReason("not-found"));
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

const convertUtf16CodeUnitRange = Effect.fnUntraced(function* (
  range: TextOffsetRange,
  sourceText: string
): Effect.fn.Return<Utf16TextRange, VerifiedSpanError> {
  if (
    Bool.or(
      range.end > Str.length(sourceText),
      Bool.or(Bool.not(isUtf16Boundary(sourceText, range.start)), Bool.not(isUtf16Boundary(sourceText, range.end)))
    )
  ) {
    return yield* VerifiedSpanError.fromReason("invalid-offset");
  }
  return Utf16TextRange.make({
    endChar: range.end,
    startChar: range.start,
  });
});

const convertCodePointRange = Effect.fnUntraced(function* (
  range: TextOffsetRange,
  sourceText: string
): Effect.fn.Return<Utf16TextRange, VerifiedSpanError> {
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
 * Effect.runPromise(convertTextOffsetRange(range, "A😀B")).then(console.log)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const convertTextOffsetRange: {
  (sourceText: string): (range: TextOffsetRange) => Effect.Effect<Utf16TextRange, VerifiedSpanError>;
  (range: TextOffsetRange, sourceText: string): Effect.Effect<Utf16TextRange, VerifiedSpanError>;
} = dual(
  2,
  Effect.fn("VerifiedSpan.convertTextOffsetRange")(function* (
    range: TextOffsetRange,
    sourceText: string
  ): Effect.fn.Return<Utf16TextRange, VerifiedSpanError> {
    if (Str.isEmpty(sourceText)) {
      return yield* VerifiedSpanError.fromReason("absent-text");
    }
    if (Str.length(sourceText) > MAX_SOURCE_TEXT_LENGTH) {
      return yield* VerifiedSpanError.fromReason("limit-exceeded");
    }

    return yield* TextOffsetUnit.$match(range.unit, {
      "unicode-code-point": () => convertCodePointRange(range, sourceText),
      "utf16-code-unit": () => convertUtf16CodeUnitRange(range, sourceText),
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

  const [, parts] = yield* Effect.reduce(
    chunks,
    reconstructionInitial,
    ([expectedStart, parts], chunk): Effect.Effect<ReconstructionState, VerifiedSpanError> => {
      if (Bool.or(Bool.not(Eq.equals(chunk.startChar, expectedStart)), Str.isEmpty(chunk.text))) {
        return Effect.fail(VerifiedSpanError.fromReason("malformed-source"));
      }
      const nextStart = NonNegativeInt.make(expectedStart + Str.length(chunk.text));
      return pipe(
        nextStart > MAX_SOURCE_TEXT_LENGTH,
        Bool.match({
          onFalse: () => Effect.succeed([nextStart, Chunk.append(parts, chunk.text)]),
          onTrue: () => Effect.fail(VerifiedSpanError.fromReason("limit-exceeded")),
        })
      );
    }
  );

  return pipe(parts, Chunk.toReadonlyArray, A.join(""));
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
 *   GroundedExtraction.cases.unaligned.make({
 *     label: "quotation",
 *     text: "\"Affirmed.\"",
 *   }),
 * ]
 * Effect.runPromise(locateGroundedExtractions(candidates, "The court wrote “Affirmed.”")).then(console.log)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const locateGroundedExtractions: {
  (
    sourceText: string
  ): (extractions: ReadonlyArray<GroundedExtraction>) => Effect.Effect<ReadonlyArray<TextAnchor>, VerifiedSpanError>;
  (
    extractions: ReadonlyArray<GroundedExtraction>,
    sourceText: string
  ): Effect.Effect<ReadonlyArray<TextAnchor>, VerifiedSpanError>;
} = dual(
  2,
  Effect.fn("VerifiedSpan.locateGroundedExtractions")(function* (
    extractions: ReadonlyArray<GroundedExtraction>,
    sourceText: string
  ): Effect.fn.Return<ReadonlyArray<TextAnchor>, VerifiedSpanError> {
    if (A.length(extractions) > MAX_EXTRACTION_CANDIDATES) {
      return yield* VerifiedSpanError.fromReason("limit-exceeded");
    }
    if (A.isReadonlyArrayEmpty(extractions)) {
      return A.empty();
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
              candidateIndex: O.some(NonNegativeInt.make(index)),
              message: error.message,
              reason: error.reason,
            })
          )
        ),
      { concurrency: 1 }
    );
  })
);
