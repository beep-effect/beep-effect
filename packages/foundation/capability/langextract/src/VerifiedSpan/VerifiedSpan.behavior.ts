/**
 * Strict locator normalization and raw-source mapping behavior.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { MAX_EXTRACTION_CANDIDATES } from "@beep/langextract/Extraction";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { isUtf16Boundary, TextAnchor } from "@beep/provenance/TextAnchor";
import {
  toTextAnchorVerificationReceipt,
  VerifySourceTextIdentityInput,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifySourceTextIdentity,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import { NonNegativeInt } from "@beep/schema";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import { Chunk, Effect, Iterable as I, Result } from "effect";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import { dual, pipe } from "effect/Function";
import * as S from "effect/Schema";
import {
  MAX_LOCATOR_LENGTH,
  MAX_SOURCE_TEXT_LENGTH,
  VERIFIED_SPAN_NORMALIZATION_VERSION,
} from "./VerifiedSpan.config.ts";
import { VerifiedSpanError } from "./VerifiedSpan.errors.ts";
import {
  TextOffsetUnit,
  Utf16TextRange,
  VerifiedSpanAttemptFailure,
  VerifiedSpanAttemptKind,
  VerifiedSpanAttemptOutcome,
  VerifiedSpanAttemptRecord,
  VerifiedSpanCandidateAnchorReceipt,
  VerifiedSpanHistory,
} from "./VerifiedSpan.model.ts";
import { normalizeTextLocator, normalizeWithRawOffsets } from "./VerifiedSpan.normalization.ts";
import type { GroundedExtraction } from "@beep/langextract/Extraction";
import type { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import type * as Crypto from "effect/Crypto";
import type {
  BeginVerifiedSpanHistoryInput,
  ContinueVerifiedSpanHistoryInput,
  RawTextChunk,
  TextOffsetRange,
  VerifiedSpanAttemptId,
  VerifiedSpanAttemptOutcome as VerifiedSpanAttemptOutcomeType,
  VerifiedSpanHistory as VerifiedSpanHistoryType,
} from "./VerifiedSpan.model.ts";
import type { NormalizedTextWithRawOffsets } from "./VerifiedSpan.normalization.ts";

const sourceTextIdentityEquivalence = S.toEquivalence(SourceTextIdentity);
type MatchScanState = readonly [matchedLength: number, start: O.Option<number>];
type ReconstructionState = readonly [expectedStart: NonNegativeInt, parts: Chunk.Chunk<string>];

const matchScanInitial = (): MatchScanState => [0, O.none()];
const reconstructionInitial = (): ReconstructionState => [NonNegativeInt.make(0), Chunk.empty()];
const missingAnchor = () => "missing-anchor";
const missingMatch = () => "missing-match";

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
    const additionalNormalizedMatches = pipe(
      normalizedRawMatches(sourceText, normalizedSource, normalizedLocator),
      A.filter((normalized) =>
        Bool.not(
          A.some(
            exactMatches,
            (exact) => normalized.startChar <= exact.startChar && normalized.endChar >= exact.endChar
          )
        )
      )
    );
    return pipe(exactMatches, A.appendAll(additionalNormalizedMatches), A.take(2));
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

const attemptFailure = (
  stage: VerifiedSpanAttemptFailure["stage"],
  reason: VerifiedSpanAttemptFailure["reason"],
  candidateIndex: O.Option<NonNegativeInt> = O.none()
): VerifiedSpanAttemptFailure =>
  VerifiedSpanAttemptFailure.make({
    candidateIndex,
    reason,
    stage,
  });

const failedAttemptOutcome = (failure: VerifiedSpanAttemptFailure): VerifiedSpanAttemptOutcomeType =>
  VerifiedSpanAttemptOutcome.cases.failed.make({ failure });

const verifiedAttemptOutcome = (
  receipts: ReadonlyArray<VerifiedSpanCandidateAnchorReceipt>
): VerifiedSpanAttemptOutcomeType =>
  A.match(receipts, {
    /* v8 ignore next -- successful location preserves one anchor per non-empty candidate batch */
    onEmpty: () => failedAttemptOutcome(attemptFailure("anchor", "invalid-anchor")),
    onNonEmpty: (anchors) => VerifiedSpanAttemptOutcome.cases.verified.make({ anchors }),
  });

type AttemptRunInput = BeginVerifiedSpanHistoryInput | ContinueVerifiedSpanHistoryInput;

const attemptRecord = (
  input: AttemptRunInput,
  expectedSource: SourceTextIdentity,
  matterRef: string,
  kind: VerifiedSpanAttemptKind,
  previousAttemptId: O.Option<VerifiedSpanAttemptId>,
  outcome: VerifiedSpanAttemptOutcomeType
): VerifiedSpanAttemptRecord =>
  VerifiedSpanAttemptRecord.make({
    attemptId: input.attemptId,
    attemptedAt: input.attemptedAt,
    candidates: input.candidates,
    engine: input.engine,
    expectedSource,
    kind,
    matterRef,
    normalizationVersion: VERIFIED_SPAN_NORMALIZATION_VERSION,
    outcome,
    previousAttemptId,
    source: input.source,
  });

const verifyLocatedAnchors = (
  verifiedSource: VerifiedSourceText,
  anchors: ReadonlyArray<TextAnchor>
): Effect.Effect<VerifiedSpanAttemptOutcomeType> =>
  Effect.forEach(
    anchors,
    (anchor, index) =>
      verifyTextAnchorAgainstVerifiedSource(
        VerifyTextAnchorAgainstVerifiedSourceInput.make({
          anchor,
          verifiedSource,
        })
      ).pipe(
        Effect.map((verified) =>
          VerifiedSpanCandidateAnchorReceipt.make({
            candidateIndex: NonNegativeInt.make(index),
            receipt: toTextAnchorVerificationReceipt(verified),
          })
        ),
        /* v8 ignore next -- locator output already proves boundaries and exact slices; retain fail-closed defense */
        Effect.mapError((error) => attemptFailure("anchor", error.reason, O.some(NonNegativeInt.make(index))))
      ),
    { concurrency: 1 }
  ).pipe(
    Effect.match({
      onFailure: failedAttemptOutcome,
      onSuccess: verifiedAttemptOutcome,
    })
  );

const locateAttemptOutcome = (
  input: AttemptRunInput,
  verifiedSource: VerifiedSourceText
): Effect.Effect<VerifiedSpanAttemptOutcomeType> =>
  locateGroundedExtractions(input.candidates, input.sourceText).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.succeed(failedAttemptOutcome(attemptFailure("location", error.reason, error.candidateIndex))),
      onSuccess: (anchors) => verifyLocatedAnchors(verifiedSource, anchors),
    })
  );

const sourceIdentityMatchesMatter = (
  matterRef: string,
  expectedSource: SourceTextIdentity,
  source: SourceTextIdentity
): boolean => Eq.equals(matterRef, expectedSource.scopeRef) && Eq.equals(matterRef, source.scopeRef);

const usesSupportedNormalization = (expectedSource: SourceTextIdentity, source: SourceTextIdentity): boolean =>
  Eq.equals(expectedSource.normalizationVersion, VERIFIED_SPAN_NORMALIZATION_VERSION) &&
  Eq.equals(source.normalizationVersion, VERIFIED_SPAN_NORMALIZATION_VERSION);

const runAttempt = Effect.fnUntraced(function* (
  input: AttemptRunInput,
  expectedSource: SourceTextIdentity,
  matterRef: string,
  kind: VerifiedSpanAttemptKind,
  previousAttemptId: O.Option<VerifiedSpanAttemptId>
): Effect.fn.Return<VerifiedSpanAttemptRecord, never, Crypto.Crypto> {
  if (!sourceIdentityMatchesMatter(matterRef, expectedSource, input.source)) {
    return attemptRecord(
      input,
      expectedSource,
      matterRef,
      kind,
      previousAttemptId,
      failedAttemptOutcome(attemptFailure("source", "cross-scope"))
    );
  }
  if (!usesSupportedNormalization(expectedSource, input.source)) {
    return attemptRecord(
      input,
      expectedSource,
      matterRef,
      kind,
      previousAttemptId,
      failedAttemptOutcome(attemptFailure("source", "normalization-version-mismatch"))
    );
  }

  const outcome = yield* verifySourceTextIdentity(
    VerifySourceTextIdentityInput.make({
      expectedSource,
      source: input.source,
      sourceText: input.sourceText,
    })
  ).pipe(
    Effect.matchEffect({
      onFailure: (error) => Effect.succeed(failedAttemptOutcome(attemptFailure("source", error.reason))),
      onSuccess: (verifiedSource) =>
        A.match(input.candidates, {
          onEmpty: () => Effect.succeed(VerifiedSpanAttemptOutcome.cases["no-candidates"].make({})),
          onNonEmpty: () => locateAttemptOutcome(input, verifiedSource),
        }),
    })
  );

  return attemptRecord(input, expectedSource, matterRef, kind, previousAttemptId, outcome);
});

const lastHistoryAttempt = (
  history: VerifiedSpanHistoryType
): Effect.Effect<VerifiedSpanAttemptRecord, VerifiedSpanError> => Effect.succeed(A.lastNonEmpty(history.attempts));

const appendHistoryAttempt = (
  history: VerifiedSpanHistoryType,
  attempt: VerifiedSpanAttemptRecord
): VerifiedSpanHistoryType =>
  VerifiedSpanHistory.make({
    attempts: A.append(history.attempts, attempt),
  });

const containsAttemptId = (history: VerifiedSpanHistoryType, attemptId: VerifiedSpanAttemptId): boolean =>
  A.some(history.attempts, (attempt) => Eq.equals(attempt.attemptId, attemptId));

const isStaleSourceFailure = (outcome: VerifiedSpanAttemptOutcomeType): boolean =>
  VerifiedSpanAttemptOutcome.match({
    failed: ({ failure }) => Eq.equals(failure.reason, "stale-source"),
    "no-candidates": () => false,
    verified: () => false,
  })(outcome);

/**
 * Start an append-only verified-span history from direct
 * `GroundedExtraction[]` candidates.
 *
 * **Details**
 *
 * Source, matter, and normalization checks happen before an empty candidate
 * batch can become a durable `no-candidates` outcome. Successful outcomes
 * contain only receipts whose raw slices were re-verified.
 *
 * **Example** (Inspect the history-start operation)
 *
 * ```ts import.meta.vitest name="Inspect the history-start operation"
 * import { beginVerifiedSpanHistory } from "@beep/langextract/VerifiedSpan"
 *
 * typeof beginVerifiedSpanHistory // => "function"
 * ```
 *
 * @effects Requires `Crypto.Crypto` for source-digest and exact-anchor proof.
 * @category validation
 * @since 0.0.0
 */
export const beginVerifiedSpanHistory = Effect.fn("VerifiedSpan.beginHistory")(function* (
  input: BeginVerifiedSpanHistoryInput
): Effect.fn.Return<VerifiedSpanHistoryType, never, Crypto.Crypto> {
  const attempt = yield* runAttempt(
    input,
    input.expectedSource,
    input.matterRef,
    VerifiedSpanAttemptKind.Enum.verification,
    O.none()
  );
  return VerifiedSpanHistory.make({ attempts: [attempt] });
});

/**
 * Re-verify the latest authorized source without changing anchor authority.
 *
 * **Details**
 *
 * The previous successful source remains the expected identity. A new source
 * manifestation therefore appends a typed `stale-source` failure instead of
 * silently rewriting its anchor.
 *
 * **Example** (Inspect the current-source verification operation)
 *
 * ```ts import.meta.vitest name="Inspect the current-source verification operation"
 * import { verifyCurrentSpanHistory } from "@beep/langextract/VerifiedSpan"
 *
 * typeof verifyCurrentSpanHistory // => "function"
 * ```
 *
 * @effects Requires `Crypto.Crypto` for source-digest and exact-anchor proof.
 * @category validation
 * @since 0.0.0
 */
export const verifyCurrentSpanHistory: {
  (
    input: ContinueVerifiedSpanHistoryInput
  ): (history: VerifiedSpanHistoryType) => Effect.Effect<VerifiedSpanHistoryType, VerifiedSpanError, Crypto.Crypto>;
  (
    history: VerifiedSpanHistoryType,
    input: ContinueVerifiedSpanHistoryInput
  ): Effect.Effect<VerifiedSpanHistoryType, VerifiedSpanError, Crypto.Crypto>;
} = dual(
  2,
  Effect.fn("VerifiedSpan.verifyCurrentHistory")(function* (
    history: VerifiedSpanHistoryType,
    input: ContinueVerifiedSpanHistoryInput
  ): Effect.fn.Return<VerifiedSpanHistoryType, VerifiedSpanError, Crypto.Crypto> {
    const previous = yield* lastHistoryAttempt(history);
    if (
      Bool.or(
        Bool.not(VerifiedSpanAttemptOutcome.guards.verified(previous.outcome)),
        containsAttemptId(history, input.attemptId)
      )
    ) {
      return yield* VerifiedSpanError.fromReason("invalid-history");
    }
    const attempt = yield* runAttempt(
      input,
      previous.source,
      previous.matterRef,
      VerifiedSpanAttemptKind.Enum.verification,
      O.some(previous.attemptId)
    );
    return appendHistoryAttempt(history, attempt);
  })
);

/**
 * Append a deterministic re-anchor only after a retained stale-source
 * verification failure.
 *
 * **Details**
 *
 * The new source becomes authoritative only inside this explicit operation,
 * and every new anchor repeats locator-to-raw recovery, source digest proof,
 * UTF-16 boundary checks, and exact raw-slice equality. The predecessor link
 * preserves both the failed attempt and the prior successful receipt.
 *
 * **Example** (Inspect the re-anchor operation)
 *
 * ```ts import.meta.vitest name="Inspect the re-anchor operation"
 * import { reanchorVerifiedSpanHistory } from "@beep/langextract/VerifiedSpan"
 *
 * typeof reanchorVerifiedSpanHistory // => "function"
 * ```
 *
 * @effects Requires `Crypto.Crypto` for source-digest and exact-anchor proof.
 * @category validation
 * @since 0.0.0
 */
export const reanchorVerifiedSpanHistory: {
  (
    input: ContinueVerifiedSpanHistoryInput
  ): (history: VerifiedSpanHistoryType) => Effect.Effect<VerifiedSpanHistoryType, VerifiedSpanError, Crypto.Crypto>;
  (
    history: VerifiedSpanHistoryType,
    input: ContinueVerifiedSpanHistoryInput
  ): Effect.Effect<VerifiedSpanHistoryType, VerifiedSpanError, Crypto.Crypto>;
} = dual(
  2,
  Effect.fn("VerifiedSpan.reanchorHistory")(function* (
    history: VerifiedSpanHistoryType,
    input: ContinueVerifiedSpanHistoryInput
  ): Effect.fn.Return<VerifiedSpanHistoryType, VerifiedSpanError, Crypto.Crypto> {
    const previous = yield* lastHistoryAttempt(history);
    if (
      Bool.or(
        Bool.not(Bool.and(isStaleSourceFailure(previous.outcome), O.isSome(previous.previousAttemptId))),
        Bool.or(
          Bool.not(sourceTextIdentityEquivalence(input.source, previous.source)),
          containsAttemptId(history, input.attemptId)
        )
      )
    ) {
      return yield* VerifiedSpanError.fromReason("invalid-history");
    }
    const attempt = yield* runAttempt(
      input,
      input.source,
      previous.matterRef,
      VerifiedSpanAttemptKind.Enum["re-anchor"],
      O.some(previous.attemptId)
    );
    return appendHistoryAttempt(history, attempt);
  })
);
