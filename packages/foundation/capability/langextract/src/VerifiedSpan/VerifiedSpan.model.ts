/**
 * Range and chunk models for strict verified-span mapping.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { GroundedExtraction, MAX_EXTRACTION_CANDIDATES } from "@beep/langextract/Extraction";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchorVerificationReceipt, VerifiedTextAnchorErrorReason } from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { ISOStr } from "@beep/schema/Timestamp";
import { Tuple } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { VERIFIED_SPAN_NORMALIZATION_VERSION } from "./VerifiedSpan.config.ts";
import { VerifiedSpanErrorReason } from "./VerifiedSpan.errors.ts";
import { normalizeTextLocator } from "./VerifiedSpan.normalization.ts";

const $I = $LangExtractId.create("VerifiedSpan");

/**
 * Offset units accepted at explicit foreign-boundary adapters.
 *
 * **Example** (Check offset unit membership)
 *
 * ```ts import.meta.vitest name="Check offset unit membership"
 * import { TextOffsetUnit } from "@beep/langextract/VerifiedSpan"
 *
 * TextOffsetUnit.is["utf16-code-unit"]("utf16-code-unit") // => true
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
 * **Example** (Annotate offset unit type)
 *
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

const TextOffsetRangeInvariant = TextOffsetRangeStruct.mapFields(identity)
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
        .tuple(
          fc.nat(10_000),
          fc.integer({
            min: 1,
            max: 10_000,
          }),
          fc.constantFrom(...TextOffsetUnit.Options)
        )
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
 * **Example** (Create half-open offset range)
 *
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
  TextOffsetRangeInvariant,
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

const Utf16TextRangeInvariant = Utf16TextRangeStruct.mapFields(identity)
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
      fc
        .tuple(
          fc.nat(10_000),
          fc.integer({
            min: 1,
            max: 10_000,
          })
        )
        .map(([startChar, width]) =>
          Utf16TextRangeStruct.make({
            endChar: NonNegativeInt.make(startChar + width),
            startChar: NonNegativeInt.make(startChar),
          })
        ),
  });

/**
 * Canonical half-open UTF-16 code-unit range.
 *
 * **Example** (Create UTF-16 text range)
 *
 * ```ts import.meta.vitest name="Create UTF-16 text range"
 * import { Utf16TextRange } from "@beep/langextract/VerifiedSpan"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const range = Utf16TextRange.make({
 *   startChar: NonNegativeInt.make(1),
 *   endChar: NonNegativeInt.make(3),
 * })
 * range.endChar // => 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Utf16TextRange extends S.Class<Utf16TextRange>($I`Utf16TextRange`)(
  Utf16TextRangeInvariant,
  $I.annote("Utf16TextRange", {
    description: "Canonical non-empty half-open UTF-16 code-unit source-text range.",
  })
) {}

/**
 * One raw source chunk at an explicit global UTF-16 offset.
 *
 * **Details**
 *
 * Separators are part of `text`; reconstruction never inserts one.
 *
 * **Example** (Create raw text chunk)
 *
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
 * Stable identifier for one persisted verification or re-anchor attempt.
 *
 * **Example** (Create an attempt identifier)
 *
 * ```ts import.meta.vitest name="Create an attempt identifier"
 * import { VerifiedSpanAttemptId } from "@beep/langextract/VerifiedSpan"
 *
 * VerifiedSpanAttemptId.make("attempt-1") // => "attempt-1"
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const VerifiedSpanAttemptId = S.NonEmptyString.pipe(
  S.brand("VerifiedSpanAttemptId"),
  $I.annoteSchema("VerifiedSpanAttemptId", {
    description: "Stable identifier linking one persisted verified-span attempt to its predecessor.",
  })
);

/**
 * Runtime type decoded by {@link VerifiedSpanAttemptId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type VerifiedSpanAttemptId = typeof VerifiedSpanAttemptId.Type;

/**
 * Pinned implementation identity for the engine that emitted a candidate
 * batch.
 *
 * **Example** (Create an engine identity)
 *
 * ```ts import.meta.vitest name="Create an engine identity"
 * import { VerifiedSpanEngine } from "@beep/langextract/VerifiedSpan"
 *
 * const engine = VerifiedSpanEngine.make({ name: "fixture-extractor", version: "1" })
 * engine.version // => "1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerifiedSpanEngine extends S.Class<VerifiedSpanEngine>($I`VerifiedSpanEngine`)(
  {
    name: S.NonEmptyString.annotateKey({
      description: "Stable extraction or verification engine name.",
    }),
    version: S.NonEmptyString.annotateKey({
      description: "Pinned engine version that produced the persisted candidates.",
    }),
  },
  $I.annote("VerifiedSpanEngine", {
    description: "Named and versioned engine responsible for one raw grounded-extraction candidate batch.",
  })
) {}

/**
 * Distinguishes ordinary verification from a re-anchor authorized only after
 * a retained stale-source failure.
 *
 * **Example** (Inspect attempt kinds)
 *
 * ```ts import.meta.vitest name="Inspect attempt kinds"
 * import { VerifiedSpanAttemptKind } from "@beep/langextract/VerifiedSpan"
 *
 * VerifiedSpanAttemptKind.Options // => ["verification", "re-anchor"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VerifiedSpanAttemptKind = LiteralKit(["verification", "re-anchor"]).pipe(
  $I.annoteSchema("VerifiedSpanAttemptKind", {
    description: "Closed kind vocabulary for initial/current verification and explicit re-anchor attempts.",
  })
);

/**
 * Runtime type decoded by {@link VerifiedSpanAttemptKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type VerifiedSpanAttemptKind = typeof VerifiedSpanAttemptKind.Type;

/**
 * Stage at which one persisted attempt failed closed.
 *
 * **Example** (Inspect failure stages)
 *
 * ```ts import.meta.vitest name="Inspect failure stages"
 * import { VerifiedSpanAttemptFailureStage } from "@beep/langextract/VerifiedSpan"
 *
 * VerifiedSpanAttemptFailureStage.is.location("location") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VerifiedSpanAttemptFailureStage = LiteralKit(["source", "location", "anchor"]).pipe(
  $I.annoteSchema("VerifiedSpanAttemptFailureStage", {
    description: "Closed stage vocabulary for source, locator, and exact-anchor verification failures.",
  })
);

/**
 * Runtime type decoded by {@link VerifiedSpanAttemptFailureStage}.
 *
 * @category models
 * @since 0.0.0
 */
export type VerifiedSpanAttemptFailureStage = typeof VerifiedSpanAttemptFailureStage.Type;

/**
 * Closed persistence vocabulary spanning locator and exact-anchor failures.
 *
 * **Example** (Recognize a stale-source failure)
 *
 * ```ts import.meta.vitest name="Recognize a stale-source failure"
 * import { VerifiedSpanAttemptFailureReason } from "@beep/langextract/VerifiedSpan"
 * import * as S from "effect/Schema"
 *
 * S.is(VerifiedSpanAttemptFailureReason)("stale-source") // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const VerifiedSpanAttemptFailureReason = S.Union([VerifiedSpanErrorReason, VerifiedTextAnchorErrorReason]).pipe(
  $I.annoteSchema("VerifiedSpanAttemptFailureReason", {
    description: "Typed fail-closed reason retained by a verified-span attempt regardless of failure stage.",
  })
);

/**
 * Runtime type decoded by {@link VerifiedSpanAttemptFailureReason}.
 *
 * @category errors
 * @since 0.0.0
 */
export type VerifiedSpanAttemptFailureReason = typeof VerifiedSpanAttemptFailureReason.Type;

const VerifiedSpanSourceFailureReason = LiteralKit(["cross-scope", "normalization-version-mismatch", "stale-source"]);
const VerifiedSpanLocationFailureReason = LiteralKit([
  "absent-text",
  "ambiguous",
  "invalid-offset",
  "limit-exceeded",
  "malformed-source",
  "not-found",
]);
const VerifiedSpanAnchorFailureReason = LiteralKit(["invalid-anchor", "quote-mismatch"]);

const VerifiedSpanAttemptFailureStruct = S.Struct({
  candidateIndex: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  reason: VerifiedSpanAttemptFailureReason,
  stage: VerifiedSpanAttemptFailureStage,
});

type VerifiedSpanAttemptFailureStruct = typeof VerifiedSpanAttemptFailureStruct.Type;
const isVerifiedSpanSourceFailureReason = S.is(VerifiedSpanSourceFailureReason);
const isVerifiedSpanLocationFailureReason = S.is(VerifiedSpanLocationFailureReason);
const isVerifiedSpanAnchorFailureReason = S.is(VerifiedSpanAnchorFailureReason);

const hasConsistentFailureStage = (failure: VerifiedSpanAttemptFailureStruct): boolean =>
  VerifiedSpanAttemptFailureStage.$match(failure.stage, {
    anchor: () => isVerifiedSpanAnchorFailureReason(failure.reason),
    location: () => isVerifiedSpanLocationFailureReason(failure.reason),
    source: () => isVerifiedSpanSourceFailureReason(failure.reason),
  });

const VerifiedSpanAttemptFailureInvariant = VerifiedSpanAttemptFailureStruct.check(
  S.makeFilter(hasConsistentFailureStage, {
    identifier: $I`VerifiedSpanAttemptFailureStageCheck`,
    title: "Verified Span Attempt Failure Stage",
    description: "Checks that each persisted failure reason belongs to its source, locator, or anchor stage.",
    message: "Expected the verified-span failure reason to match its recorded stage.",
  })
);

/**
 * Sanitized persisted failure with optional candidate position.
 *
 * **Example** (Create a source drift failure)
 *
 * ```ts import.meta.vitest name="Create a source drift failure"
 * import { VerifiedSpanAttemptFailure } from "@beep/langextract/VerifiedSpan"
 *
 * const failure = VerifiedSpanAttemptFailure.make({ reason: "stale-source", stage: "source" })
 * failure.reason // => "stale-source"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerifiedSpanAttemptFailure extends S.Class<VerifiedSpanAttemptFailure>($I`VerifiedSpanAttemptFailure`)(
  VerifiedSpanAttemptFailureInvariant,
  $I.annote("VerifiedSpanAttemptFailure", {
    description: "Sanitized stage and reason retained when a source, locator, or anchor verification fails closed.",
  })
) {}

/**
 * Explicit association between one candidate position and its verified anchor
 * receipt.
 *
 * **Details**
 *
 * Persisting the candidate position prevents anchor receipts from being
 * reordered independently of the raw candidate batch.
 *
 * **Example** (Inspect candidate-anchor association fields)
 *
 * ```ts import.meta.vitest name="Inspect candidate-anchor association fields"
 * import { VerifiedSpanCandidateAnchorReceipt } from "@beep/langextract/VerifiedSpan"
 *
 * VerifiedSpanCandidateAnchorReceipt.fields.candidateIndex !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerifiedSpanCandidateAnchorReceipt extends S.Class<VerifiedSpanCandidateAnchorReceipt>(
  $I`VerifiedSpanCandidateAnchorReceipt`
)(
  {
    candidateIndex: NonNegativeInt.annotateKey({
      description: "Zero-based position of the raw candidate associated with receipt.",
    }),
    receipt: TextAnchorVerificationReceipt,
  },
  $I.annote("VerifiedSpanCandidateAnchorReceipt", {
    description: "Verified anchor receipt paired with its stable position in the retained raw candidate batch.",
  })
) {}

const VerifiedSpanAttemptOutcomeStatus = LiteralKit(["verified", "failed", "no-candidates"]);

class VerifiedSpanAttemptVerified extends S.Class<VerifiedSpanAttemptVerified>($I`VerifiedSpanAttemptVerified`)(
  {
    status: S.tag("verified"),
    anchors: S.NonEmptyArray(VerifiedSpanCandidateAnchorReceipt),
  },
  $I.annote("VerifiedSpanAttemptVerified", {
    description: "Successful attempt retaining one exact verified-anchor receipt for every raw candidate.",
  })
) {}

class VerifiedSpanAttemptFailed extends S.Class<VerifiedSpanAttemptFailed>($I`VerifiedSpanAttemptFailed`)(
  {
    status: S.tag("failed"),
    failure: VerifiedSpanAttemptFailure,
  },
  $I.annote("VerifiedSpanAttemptFailed", {
    description: "Fail-closed attempt retaining its typed sanitized failure and no verified anchors.",
  })
) {}

class VerifiedSpanAttemptNoCandidates extends S.Class<VerifiedSpanAttemptNoCandidates>(
  $I`VerifiedSpanAttemptNoCandidates`
)(
  {
    status: S.tag("no-candidates"),
  },
  $I.annote("VerifiedSpanAttemptNoCandidates", {
    description: "Negative extraction attempt that produced no candidates and therefore no downstream entity.",
  })
) {}

/**
 * Persisted terminal outcome for one verification or re-anchor attempt.
 *
 * **Details**
 *
 * Only the `verified` case can carry anchors. `failed` and `no-candidates`
 * cannot accidentally persist a partially authorized anchor or citation-like
 * entity.
 *
 * **Example** (Create a negative extraction outcome)
 *
 * ```ts import.meta.vitest name="Create a negative extraction outcome"
 * import { VerifiedSpanAttemptOutcome } from "@beep/langextract/VerifiedSpan"
 *
 * const outcome = VerifiedSpanAttemptOutcome.cases["no-candidates"].make({})
 * outcome.status // => "no-candidates"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VerifiedSpanAttemptOutcome = VerifiedSpanAttemptOutcomeStatus.mapMembers(
  Tuple.evolve([
    () => VerifiedSpanAttemptVerified,
    () => VerifiedSpanAttemptFailed,
    () => VerifiedSpanAttemptNoCandidates,
  ])
).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("VerifiedSpanAttemptOutcome", {
    description: "Closed persisted outcome for verified, fail-closed, and no-candidate extraction attempts.",
  })
);

/**
 * Runtime type decoded by {@link VerifiedSpanAttemptOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type VerifiedSpanAttemptOutcome = typeof VerifiedSpanAttemptOutcome.Type;

const GroundedExtractionBatch: S.Codec<
  ReadonlyArray<GroundedExtraction>,
  ReadonlyArray<GroundedExtraction.Encoded>
> = S.Array(GroundedExtraction).check(
  S.isMaxLength(MAX_EXTRACTION_CANDIDATES, {
    identifier: $I`VerifiedSpanAttemptCandidatesMaxLengthCheck`,
    title: "Verified Span Attempt Candidate Limit",
    description: "Checks that a persisted raw candidate batch stays within the extraction capability bound.",
    message: `Verified span attempts must retain at most ${MAX_EXTRACTION_CANDIDATES} candidates.`,
  })
);
const VerifiedSpanNormalizationVersion = S.Literal(VERIFIED_SPAN_NORMALIZATION_VERSION);
const sourceTextIdentityEquivalence = S.toEquivalence(SourceTextIdentity);
const attemptIdEquivalence = S.toEquivalence(VerifiedSpanAttemptId);

const OptionalVerifiedSpanAttemptId = VerifiedSpanAttemptId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);

type VerifiedSpanAttemptRecordFields = {
  readonly attemptId: typeof VerifiedSpanAttemptId;
  readonly attemptedAt: typeof ISOStr;
  readonly candidates: typeof GroundedExtractionBatch;
  readonly engine: typeof VerifiedSpanEngine;
  readonly expectedSource: typeof SourceTextIdentity;
  readonly kind: typeof VerifiedSpanAttemptKind;
  readonly matterRef: typeof S.NonEmptyString;
  readonly normalizationVersion: typeof VerifiedSpanNormalizationVersion;
  readonly outcome: typeof VerifiedSpanAttemptOutcome;
  readonly previousAttemptId: typeof OptionalVerifiedSpanAttemptId;
  readonly source: typeof SourceTextIdentity;
};

const VerifiedSpanAttemptRecordFields: VerifiedSpanAttemptRecordFields = {
  attemptId: VerifiedSpanAttemptId,
  attemptedAt: ISOStr,
  candidates: GroundedExtractionBatch,
  engine: VerifiedSpanEngine,
  expectedSource: SourceTextIdentity,
  kind: VerifiedSpanAttemptKind,
  matterRef: S.NonEmptyString,
  normalizationVersion: VerifiedSpanNormalizationVersion,
  outcome: VerifiedSpanAttemptOutcome,
  previousAttemptId: OptionalVerifiedSpanAttemptId,
  source: SourceTextIdentity,
};

const VerifiedSpanAttemptRecordStruct = S.Struct(VerifiedSpanAttemptRecordFields);
type VerifiedSpanAttemptRecordStruct = typeof VerifiedSpanAttemptRecordStruct.Type;

const hasConsistentAttemptLink = (attempt: VerifiedSpanAttemptRecordStruct): boolean =>
  VerifiedSpanAttemptKind.$match(attempt.kind, {
    "re-anchor": () =>
      O.isSome(attempt.previousAttemptId) && sourceTextIdentityEquivalence(attempt.expectedSource, attempt.source),
    verification: () => true,
  });

const hasCandidateAt = (
  candidates: VerifiedSpanAttemptRecordStruct["candidates"],
  candidateIndex: O.Option<NonNegativeInt>
): boolean => O.exists(candidateIndex, (index) => index < A.length(candidates));

const isGlobalLocationFailureReason = S.is(LiteralKit(["absent-text", "limit-exceeded"]));

const hasConsistentFailureCandidates = (
  attempt: VerifiedSpanAttemptRecordStruct,
  failure: VerifiedSpanAttemptFailureStruct
): boolean =>
  VerifiedSpanAttemptFailureStage.$match(failure.stage, {
    anchor: () =>
      A.isReadonlyArrayNonEmpty(attempt.candidates) && hasCandidateAt(attempt.candidates, failure.candidateIndex),
    location: () =>
      A.isReadonlyArrayNonEmpty(attempt.candidates) &&
      O.match(failure.candidateIndex, {
        onNone: () => isGlobalLocationFailureReason(failure.reason),
        onSome: (index) => index < A.length(attempt.candidates) && !isGlobalLocationFailureReason(failure.reason),
      }),
    source: () => O.isNone(failure.candidateIndex),
  });

const sourceFailureMatchesEvidence = (
  attempt: VerifiedSpanAttemptRecordStruct,
  reason: typeof VerifiedSpanSourceFailureReason.Type
): boolean => {
  const expectedInMatter = Eq.equals(attempt.matterRef, attempt.expectedSource.scopeRef);
  const sourceInMatter = Eq.equals(attempt.matterRef, attempt.source.scopeRef);
  const expectedVersionSupported = Eq.equals(
    attempt.expectedSource.normalizationVersion,
    VERIFIED_SPAN_NORMALIZATION_VERSION
  );
  const sourceVersionSupported = Eq.equals(attempt.source.normalizationVersion, VERIFIED_SPAN_NORMALIZATION_VERSION);

  return VerifiedSpanSourceFailureReason.$match(reason, {
    "cross-scope": () => !(expectedInMatter && sourceInMatter),
    "normalization-version-mismatch": () =>
      expectedInMatter && sourceInMatter && !(expectedVersionSupported && sourceVersionSupported),
    "stale-source": () => expectedInMatter && sourceInMatter && expectedVersionSupported && sourceVersionSupported,
  });
};

const hasConsistentAttemptSource = (attempt: VerifiedSpanAttemptRecordStruct): boolean => {
  const hasAuthorizedSource =
    Eq.equals(attempt.matterRef, attempt.expectedSource.scopeRef) &&
    Eq.equals(attempt.matterRef, attempt.source.scopeRef) &&
    Eq.equals(attempt.expectedSource.normalizationVersion, VERIFIED_SPAN_NORMALIZATION_VERSION) &&
    Eq.equals(attempt.source.normalizationVersion, VERIFIED_SPAN_NORMALIZATION_VERSION) &&
    sourceTextIdentityEquivalence(attempt.expectedSource, attempt.source);

  return VerifiedSpanAttemptOutcome.match({
    failed: ({ failure }) =>
      VerifiedSpanAttemptFailureStage.$match(failure.stage, {
        anchor: () => hasAuthorizedSource,
        location: () => hasAuthorizedSource,
        source: () =>
          O.exists(O.liftPredicate(isVerifiedSpanSourceFailureReason)(failure.reason), (reason) =>
            sourceFailureMatchesEvidence(attempt, reason)
          ),
      }),
    "no-candidates": () => hasAuthorizedSource,
    verified: () => hasAuthorizedSource,
  })(attempt.outcome);
};

const hasConsistentAttemptOutcome = (attempt: VerifiedSpanAttemptRecordStruct): boolean =>
  VerifiedSpanAttemptOutcome.match({
    failed: ({ failure }) => hasConsistentFailureCandidates(attempt, failure),
    "no-candidates": () => A.isReadonlyArrayEmpty(attempt.candidates),
    verified: ({ anchors }) =>
      A.isReadonlyArrayNonEmpty(attempt.candidates) &&
      Eq.equals(A.length(anchors), A.length(attempt.candidates)) &&
      A.every(
        anchors,
        ({ candidateIndex, receipt }, index) =>
          Eq.equals(candidateIndex, index) &&
          sourceTextIdentityEquivalence(receipt.source, attempt.source) &&
          O.exists(A.get(attempt.candidates, index), ({ text }) =>
            Eq.equals(normalizeTextLocator(text), normalizeTextLocator(receipt.anchor.quote))
          )
      ),
  })(attempt.outcome);

const VerifiedSpanAttemptRecordInvariant = VerifiedSpanAttemptRecordStruct.check(
  S.makeFilter(hasConsistentAttemptLink, {
    identifier: $I`VerifiedSpanAttemptLinkCheck`,
    title: "Verified Span Attempt Link",
    description:
      "Checks that every re-anchor attempt identifies its immediate predecessor and makes its newly proven source explicit.",
    message:
      "Expected a re-anchor attempt to carry previousAttemptId and matching expected/resolved source identities.",
  }),
  S.makeFilter(hasConsistentAttemptSource, {
    identifier: $I`VerifiedSpanAttemptSourceCheck`,
    title: "Verified Span Attempt Source",
    description:
      "Checks matter, source, and normalization authority while preserving only evidence-matched source-stage failures.",
    message: "Expected source authority and any source-stage failure reason to agree with the retained identities.",
  }),
  S.makeFilter(hasConsistentAttemptOutcome, {
    identifier: $I`VerifiedSpanAttemptOutcomeCheck`,
    title: "Verified Span Attempt Outcome",
    description:
      "Checks that negative attempts have no candidates and successful attempts retain one source-matched anchor per candidate.",
    message: "Expected candidate and anchor fields to agree with the terminal attempt outcome.",
  })
);

const VerifiedSpanAttemptRecordBase: S.Class<
  VerifiedSpanAttemptRecord,
  S.Struct<VerifiedSpanAttemptRecordFields>,
  {}
> = S.Class<VerifiedSpanAttemptRecord>($I`VerifiedSpanAttemptRecord`)(
  VerifiedSpanAttemptRecordInvariant,
  $I.annote("VerifiedSpanAttemptRecord", {
    description:
      "Durable matter-scoped candidate attempt retaining source identity, raw candidates, versions, predecessor, and a closed outcome.",
  })
);

/**
 * Durable matter-scoped record for one candidate verification or re-anchor
 * attempt.
 *
 * **Details**
 *
 * The record keeps both expected and resolved source identities so stale or
 * cross-scope failures remain auditable without mutating the prior anchor.
 * Raw candidate values, engine and normalization versions, and the typed
 * terminal outcome all survive persistence.
 *
 * **Example** (Inspect durable attempt fields)
 *
 * ```ts import.meta.vitest name="Inspect durable attempt fields"
 * import { VerifiedSpanAttemptRecord } from "@beep/langextract/VerifiedSpan"
 *
 * VerifiedSpanAttemptRecord.fields.expectedSource !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerifiedSpanAttemptRecord extends VerifiedSpanAttemptRecordBase {}

type HistoryScanState = readonly [previous: VerifiedSpanAttemptRecord, valid: boolean];

const hasAllowedAttemptTransition = (
  previous: VerifiedSpanAttemptRecord,
  attempt: VerifiedSpanAttemptRecord
): boolean =>
  sourceTextIdentityEquivalence(attempt.expectedSource, previous.source) &&
  VerifiedSpanAttemptKind.$match(attempt.kind, {
    "re-anchor": () =>
      VerifiedSpanAttemptOutcome.guards.failed(previous.outcome) &&
      Eq.equals(previous.outcome.failure.reason, "stale-source") &&
      O.isSome(previous.previousAttemptId),
    verification: () => VerifiedSpanAttemptOutcome.guards.verified(previous.outcome),
  });

const hasLinkedAttemptHistory = (history: {
  readonly attempts: readonly [VerifiedSpanAttemptRecord, ...VerifiedSpanAttemptRecord[]];
}): boolean =>
  pipe(
    A.head(history.attempts),
    O.exists((first) => {
      const initialState: HistoryScanState = [
        first,
        VerifiedSpanAttemptKind.is.verification(first.kind) && O.isNone(first.previousAttemptId),
      ];
      const uniqueIds = pipe(
        history.attempts,
        A.map(({ attemptId }) => attemptId),
        A.dedupeWith(attemptIdEquivalence),
        A.length,
        Eq.equals(A.length(history.attempts))
      );
      const [, linked] = A.reduce(
        A.drop(history.attempts, 1),
        initialState,
        ([previous, valid], attempt): HistoryScanState => [
          attempt,
          valid &&
            Eq.equals(first.matterRef, attempt.matterRef) &&
            hasAllowedAttemptTransition(previous, attempt) &&
            O.exists(attempt.previousAttemptId, (previousAttemptId) =>
              attemptIdEquivalence(previousAttemptId, previous.attemptId)
            ),
        ]
      );
      return uniqueIds && linked;
    })
  );

const VerifiedSpanHistoryAttempts = S.NonEmptyArray(VerifiedSpanAttemptRecord);

class VerifiedSpanHistoryStruct extends S.Class<VerifiedSpanHistoryStruct>($I`VerifiedSpanHistoryStruct`)(
  {
    attempts: VerifiedSpanHistoryAttempts,
  },
  $I.annote("VerifiedSpanHistoryStruct", {
    description: "Internal structural base for a non-empty linked verified-span attempt history.",
  })
) {}

const VerifiedSpanHistoryInvariant = VerifiedSpanHistoryStruct.mapFields(identity).check(
  S.makeFilter(hasLinkedAttemptHistory, {
    identifier: $I`VerifiedSpanAttemptHistoryCheck`,
    title: "Verified Span Attempt History",
    description:
      "Checks unique attempt ids, one initial verification, permitted verification/re-anchor transitions, same-matter continuity, and immediate predecessor links.",
    message: "Expected a uniquely identified, validly transitioned, same-matter verified-span history.",
  })
);

/**
 * Non-destructive history of verification, drift failure, and re-anchor
 * attempts.
 *
 * **Details**
 *
 * History is append-only by contract. Derived current-anchor views are
 * recomputed from the terminal successful attempt instead of persisted as a
 * second mutable authority.
 *
 * **Example** (Inspect history fields)
 *
 * ```ts import.meta.vitest name="Inspect history fields"
 * import { VerifiedSpanHistory } from "@beep/langextract/VerifiedSpan"
 *
 * VerifiedSpanHistory.fields.attempts !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerifiedSpanHistory extends S.Class<VerifiedSpanHistory>($I`VerifiedSpanHistory`)(
  VerifiedSpanHistoryInvariant,
  $I.annote("VerifiedSpanHistory", {
    description:
      "Append-only same-matter history linking source verification, fail-closed drift, and re-anchor attempts.",
  })
) {}

type VerifiedSpanRunFields = {
  readonly attemptId: typeof VerifiedSpanAttemptId;
  readonly attemptedAt: typeof ISOStr;
  readonly candidates: typeof GroundedExtractionBatch;
  readonly engine: typeof VerifiedSpanEngine;
  readonly source: typeof SourceTextIdentity;
  readonly sourceText: typeof S.String;
};

const VerifiedSpanRunFields: VerifiedSpanRunFields = {
  attemptId: VerifiedSpanAttemptId,
  attemptedAt: ISOStr,
  candidates: GroundedExtractionBatch,
  engine: VerifiedSpanEngine,
  source: SourceTextIdentity,
  sourceText: S.String,
};

type BeginVerifiedSpanHistoryInputFields = VerifiedSpanRunFields & {
  readonly expectedSource: typeof SourceTextIdentity;
  readonly matterRef: typeof S.NonEmptyString;
};

const BeginVerifiedSpanHistoryInputBase: S.Class<
  BeginVerifiedSpanHistoryInput,
  S.Struct<BeginVerifiedSpanHistoryInputFields>,
  {}
> = S.Class<BeginVerifiedSpanHistoryInput>($I`BeginVerifiedSpanHistoryInput`)<BeginVerifiedSpanHistoryInputFields>(
  {
    ...VerifiedSpanRunFields,
    expectedSource: SourceTextIdentity,
    matterRef: S.NonEmptyString,
  },
  $I.annote("BeginVerifiedSpanHistoryInput", {
    description:
      "Initial candidate verification input with authorized matter/source identity and non-persisted canonical raw text.",
  })
);

/**
 * Boundary input for starting a verified-span history.
 *
 * **Details**
 *
 * `sourceText` is verification input only and is deliberately absent from the
 * durable {@link VerifiedSpanAttemptRecord}.
 *
 * **Example** (Inspect initial input fields)
 *
 * ```ts import.meta.vitest name="Inspect initial input fields"
 * import { BeginVerifiedSpanHistoryInput } from "@beep/langextract/VerifiedSpan"
 *
 * BeginVerifiedSpanHistoryInput.fields.sourceText !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BeginVerifiedSpanHistoryInput extends BeginVerifiedSpanHistoryInputBase {}

const ContinueVerifiedSpanHistoryInputBase: S.Class<
  ContinueVerifiedSpanHistoryInput,
  S.Struct<VerifiedSpanRunFields>,
  {}
> = S.Class<ContinueVerifiedSpanHistoryInput>($I`ContinueVerifiedSpanHistoryInput`)<VerifiedSpanRunFields>(
  VerifiedSpanRunFields,
  $I.annote("ContinueVerifiedSpanHistoryInput", {
    description:
      "Candidate verification continuation input whose matter, expected source, mode, and predecessor come from history.",
  })
);

/**
 * Boundary input for appending current-source verification or a deterministic
 * re-anchor to an existing history.
 *
 * **Example** (Inspect continuation input fields)
 *
 * ```ts import.meta.vitest name="Inspect continuation input fields"
 * import { ContinueVerifiedSpanHistoryInput } from "@beep/langextract/VerifiedSpan"
 *
 * ContinueVerifiedSpanHistoryInput.fields.candidates !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContinueVerifiedSpanHistoryInput extends ContinueVerifiedSpanHistoryInputBase {}
