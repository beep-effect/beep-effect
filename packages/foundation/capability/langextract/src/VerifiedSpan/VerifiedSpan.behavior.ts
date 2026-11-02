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
import * as A from "@beep/utils/Array";
import { lazy } from "@beep/utils/Function";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import * as Bool from "effect/Boolean";
import * as Chunk from "effect/Chunk";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { dual, pipe } from "effect/Function";
import * as I from "effect/Iterable";
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
import type * as Digest from "effect/crypto/Digest";
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
type ReconstructionState = readonly [expectedStart: number, parts: Chunk.Chunk<string>];

const reconstructionInitial = (): ReconstructionState => [S.Natural.make(0), Chunk.empty()];

// Performance boundary (KMP scan): the scan below touches every UTF-16 code
// unit of a source up to 1,000,000 long, so it reads arrays and strings with
// native indexing. Module-namespace helper calls cost a property lookup per
// call (a getter call under Vite's module runner), which dominated hosted CI.

const nextMatchedLength = (
  locator: string,
  prefixTable: ReadonlyArray<number>,
  matchedLength: number,
  unit: string | undefined
): number => {
  // KMP fallback walks the prefix chain iteratively, so a scanned code unit
  // allocates nothing and uses constant stack. The chain can be as long as the
  // NFKC-normalized locator, which may be several times MAX_LOCATOR_LENGTH (for
  // example U+2026 expands to three code units), so recursion here could
  // overflow. `length` always stays below the locator length, keeping both
  // reads in bounds.
  let length = matchedLength;
  while (length > 0 && locator[length] !== unit) {
    length = A.getUnsafe(prefixTable, length - 1);
  }
  return locator[length] === unit ? length + 1 : 0;
};

const prefixTable = (locator: string): ReadonlyArray<number> => {
  // The single KMP-table allocation; it is immutable once construction returns.
  const table = A.make(0);
  pipe(
    I.range(1),
    I.take(Str.length(locator) - 1),
    I.reduce(0, (matchedLength, index) => {
      const nextLength = nextMatchedLength(locator, table, matchedLength, locator[index]);
      A.appendInPlace(table, nextLength);
      return nextLength;
    })
  );
  return table;
};

// A located match is unique only when no second occurrence exists, so every
// scan stops at the second accepted occurrence.
const MATCH_LIMIT = 2;

/**
 * Scan `text` for `locator` and keep the first {@link MATCH_LIMIT} matches
 * whose start passes the cheap `admits` predicate and then yields an anchor.
 *
 * Matches are visited in source order and the scan returns as soon as the
 * limit is reached, so repetitive sources never enumerate remaining matches.
 */
const firstAcceptedMatches = <A>(
  text: string,
  locator: string,
  admits: (start: number) => boolean,
  anchor: (start: number) => O.Option<A>
): ReadonlyArray<A> => {
  const locatorLength = Str.length(locator);
  const table = prefixTable(locator);
  const retainedLength = pipe(
    A.get(table, locatorLength - 1),
    O.getOrElse(() => 0)
  );
  const accepted = A.empty<A>();
  const textLength = Str.length(text);
  let matchedLength = 0;
  for (let index = 0; index < textLength && accepted.length < MATCH_LIMIT; index++) {
    matchedLength = nextMatchedLength(locator, table, matchedLength, text[index]);
    if (matchedLength === locatorLength) {
      matchedLength = retainedLength;
      const start = index - locatorLength + 1;
      if (admits(start)) {
        O.map(anchor(start), (match) => A.appendInPlace(accepted, match));
      }
    }
  }
  return accepted;
};

const rawAnchor = (sourceText: string, startChar: number, endChar: number): O.Option<TextAnchor> =>
  pipe(
    Bool.and(isUtf16Boundary(sourceText, startChar), isUtf16Boundary(sourceText, endChar)),
    Bool.match({
      onFalse: O.none<TextAnchor>,
      onTrue: () =>
        O.some(
          TextAnchor.make({
            endChar: S.Natural.make(endChar),
            quote: Str.slice(startChar, endChar)(sourceText),
            startChar: S.Natural.make(startChar),
          })
        ),
    })
  );

const admitsEveryStart = (): boolean => true;

const exactRawMatches = (sourceText: string, locator: string): ReadonlyArray<TextAnchor> =>
  firstAcceptedMatches(sourceText, locator, admitsEveryStart, (startChar) =>
    rawAnchor(sourceText, startChar, startChar + Str.length(locator))
  );

/**
 * A normalized match maps back to raw text only when it starts at the first
 * and ends at the last normalized code unit of its raw clusters; a match that
 * shares a raw range with its neighbour would split a cluster.
 */
const alignsWithRawClusters =
  (normalizedSource: NormalizedTextWithRawOffsets, normalizedLocatorLength: number) =>
  (normalizedStart: number): boolean => {
    // KMP reports matches inside the normalized text, whose offset maps hold one
    // entry per normalized code unit; neighbour reads past either end are
    // undefined and never equal a raw offset.
    const { ends, starts } = normalizedSource;
    const normalizedEnd = normalizedStart + normalizedLocatorLength;
    return starts[normalizedStart - 1] !== starts[normalizedStart] && ends[normalizedEnd] !== ends[normalizedEnd - 1];
  };

const normalizedRawAnchor = (
  sourceText: string,
  normalizedSource: NormalizedTextWithRawOffsets,
  normalizedLocator: string,
  normalizedStart: number
): O.Option<TextAnchor> =>
  pipe(
    O.all([
      A.get(normalizedSource.starts, normalizedStart),
      A.get(normalizedSource.ends, normalizedStart + Str.length(normalizedLocator) - 1),
    ]),
    O.flatMap(([startChar, endChar]) => rawAnchor(sourceText, startChar, endChar)),
    O.filter((anchor) => Eq.equals(normalizeTextLocator(anchor.quote), normalizedLocator))
  );

const normalizedRawMatches = (
  sourceText: string,
  normalizedSource: NormalizedTextWithRawOffsets,
  normalizedLocator: string
): ReadonlyArray<TextAnchor> =>
  firstAcceptedMatches(
    normalizedSource.text,
    normalizedLocator,
    alignsWithRawClusters(normalizedSource, Str.length(normalizedLocator)),
    (normalizedStart) => normalizedRawAnchor(sourceText, normalizedSource, normalizedLocator, normalizedStart)
  );

type PreparedNormalizedSource = () => NormalizedTextWithRawOffsets;

// Normalization runs at most once per source, and only when a locator needs it.
const preparedNormalizedSource = (sourceText: string): PreparedNormalizedSource =>
  lazy(() => normalizeWithRawOffsets(sourceText));

const findRawMatches: {
  (sourceText: string, normalizedSource: PreparedNormalizedSource, locator: string): ReadonlyArray<TextAnchor>;
  (normalizedSource: PreparedNormalizedSource, locator: string): (sourceText: string) => ReadonlyArray<TextAnchor>;
} = dual(
  3,
  (sourceText: string, normalizedSource: PreparedNormalizedSource, locator: string): ReadonlyArray<TextAnchor> => {
    const exactMatches = exactRawMatches(sourceText, locator);
    // Two exact raw occurrences already establish ambiguity: normalized matches
    // can only be appended after them, so the source is never normalized.
    return A.length(exactMatches) > 1
      ? exactMatches
      : pipe(
          normalizedRawMatches(sourceText, normalizedSource(), normalizeTextLocator(locator)),
          A.filter((normalized) =>
            Bool.not(
              A.some(
                exactMatches,
                (exact) => normalized.startChar <= exact.startChar && normalized.endChar >= exact.endChar
              )
            )
          ),
          (additionalNormalizedMatches) => A.appendAll(exactMatches, additionalNormalizedMatches),
          A.take(2)
        );
  }
);

const locatePreparedRawText: {
  (
    sourceText: string,
    normalizedSource: PreparedNormalizedSource,
    locator: string
  ): Effect.Effect<TextAnchor, VerifiedSpanError>;
  (
    normalizedSource: PreparedNormalizedSource,
    locator: string
  ): (sourceText: string) => Effect.Effect<TextAnchor, VerifiedSpanError>;
} = dual(
  3,
  Effect.fnUntraced(function* (
    sourceText: string,
    normalizedSource: PreparedNormalizedSource,
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
 * import * as Effect from "effect/Effect";
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

    return yield* locatePreparedRawText(sourceText, preparedNormalizedSource(sourceText), locator);
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
    endChar: S.Natural.make(Str.length(A.join(A.take(points, range.end), ""))),
    startChar: S.Natural.make(Str.length(A.join(A.take(points, range.start), ""))),
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
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect";
 * import {
 *   TextOffsetRange,
 *   convertTextOffsetRange,
 * } from "@beep/langextract/VerifiedSpan"
 *
 * const range = TextOffsetRange.make({
 *   start: S.Natural.make(1),
 *   end: S.Natural.make(2),
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

    return yield* TextOffsetUnit.match(range.unit, {
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
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect";
 * import { RawTextChunk, reconstructSourceText } from "@beep/langextract/VerifiedSpan"
 *
 * const first = RawTextChunk.make({ startChar: S.Natural.make(0), text: "page one\f" })
 * const second = RawTextChunk.make({ startChar: S.Natural.make(9), text: "page two" })
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
      const nextStart = S.Natural.make(expectedStart + Str.length(chunk.text));
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
 * import * as Effect from "effect/Effect";
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
    const normalizedSource = preparedNormalizedSource(sourceText);
    return yield* Effect.forEach(
      extractions,
      (extraction, index) =>
        locatePreparedRawText(sourceText, normalizedSource, extraction.text).pipe(
          Effect.mapError((error) =>
            VerifiedSpanError.make({
              candidateIndex: O.some(S.Natural.make(index)),
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
  candidateIndex: O.Option<number> = O.none()
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
    onEmpty:
      /* istanbul ignore next -- successful location preserves one anchor per non-empty candidate batch. Owner: @beep/langextract. Exit: successful location returns a non-empty receipt array type. */ () =>
        failedAttemptOutcome(attemptFailure("anchor", "invalid-anchor")),
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
        Effect.mapBoth({
          onFailure:
            /* istanbul ignore next -- locator output already proves boundaries and exact slices; retain fail-closed defense. Owner: @beep/langextract. Exit: the locator returns a verified-receipt type that the verifier does not re-check. */
            (error) => attemptFailure("anchor", error.reason, O.some(S.Natural.make(index))),
          onSuccess: (verified) =>
            VerifiedSpanCandidateAnchorReceipt.make({
              candidateIndex: S.Natural.make(index),
              receipt: toTextAnchorVerificationReceipt(verified),
            }),
        })
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
): Effect.fn.Return<VerifiedSpanAttemptRecord, never, Digest.Digest> {
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
 * @effects Requires `Digest.Digest` for source-digest and exact-anchor proof.
 * @category validation
 * @since 0.0.0
 */
export const beginVerifiedSpanHistory = Effect.fn("VerifiedSpan.beginHistory")(function* (
  input: BeginVerifiedSpanHistoryInput
): Effect.fn.Return<VerifiedSpanHistoryType, never, Digest.Digest> {
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
 * @effects Requires `Digest.Digest` for source-digest and exact-anchor proof.
 * @category validation
 * @since 0.0.0
 */
export const verifyCurrentSpanHistory: {
  (
    input: ContinueVerifiedSpanHistoryInput
  ): (history: VerifiedSpanHistoryType) => Effect.Effect<VerifiedSpanHistoryType, VerifiedSpanError, Digest.Digest>;
  (
    history: VerifiedSpanHistoryType,
    input: ContinueVerifiedSpanHistoryInput
  ): Effect.Effect<VerifiedSpanHistoryType, VerifiedSpanError, Digest.Digest>;
} = dual(
  2,
  Effect.fn("VerifiedSpan.verifyCurrentHistory")(function* (
    history: VerifiedSpanHistoryType,
    input: ContinueVerifiedSpanHistoryInput
  ): Effect.fn.Return<VerifiedSpanHistoryType, VerifiedSpanError, Digest.Digest> {
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
 * @effects Requires `Digest.Digest` for source-digest and exact-anchor proof.
 * @category validation
 * @since 0.0.0
 */
export const reanchorVerifiedSpanHistory: {
  (
    input: ContinueVerifiedSpanHistoryInput
  ): (history: VerifiedSpanHistoryType) => Effect.Effect<VerifiedSpanHistoryType, VerifiedSpanError, Digest.Digest>;
  (
    history: VerifiedSpanHistoryType,
    input: ContinueVerifiedSpanHistoryInput
  ): Effect.Effect<VerifiedSpanHistoryType, VerifiedSpanError, Digest.Digest>;
} = dual(
  2,
  Effect.fn("VerifiedSpan.reanchorHistory")(function* (
    history: VerifiedSpanHistoryType,
    input: ContinueVerifiedSpanHistoryInput
  ): Effect.fn.Return<VerifiedSpanHistoryType, VerifiedSpanError, Digest.Digest> {
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
