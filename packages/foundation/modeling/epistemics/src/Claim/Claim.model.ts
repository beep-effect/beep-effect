/**
 * Independent review coordinates and valid-time vocabulary for claim owners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Measurement, makeSignal } from "@beep/schema/Signal";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { ReportedConfidence } from "../Confidence.ts";
import { ValidInterval, ValidIntervalFields } from "../ValidInterval/index.ts";
import type { IdCodec, SchemaIdentity } from "../Factory/index.ts";

const $I = $EpistemicsId.create("Claim/Claim.model");
const DispositionKind = LiteralKit(["accepted", "rejected", "abstained"]);
const SourceTrust = LiteralKit(["low", "moderate", "high"]);
const SourceDependence = LiteralKit(["independent", "dependent", "unknown"]);
const ExtractorObservation = S.Union([Measurement, ReportedConfidence]).pipe(
  $I.annoteSchema("ExtractorObservation", { description: "A typed measurement or an explicitly reported confidence." })
);

/**
 * Lowercase SHA-256 hex digest of the evidence basis a reviewer looked at.
 *
 * **Example** (Accept only a lowercase SHA-256 digest)
 *
 * ```ts
 * import { BasisDigest } from "@beep/epistemics/Claim"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BasisDigest)("a".repeat(64))) // true
 * console.log(S.is(BasisDigest)("not-a-digest")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BasisDigest = S.String.check(
  S.isPattern(/^[0-9a-f]{64}$/, $I.annote("BasisDigestPattern", { description: "Lowercase SHA-256 hex." }))
).pipe($I.annoteSchema("BasisDigest", { description: "SHA-256 digest of a sealed evidence basis." }));

/**
 * @category models
 * @since 0.0.0
 */
export type BasisDigest = typeof BasisDigest.Type;

const isOrderedValidInterval = S.is(ValidInterval);

/**
 * When a claim holds. `Unknown` is a real state, not an open interval: an
 * as-of-valid-time read never selects it.
 *
 * **Example** (Unknown valid time is a value, not a missing field)
 *
 * ```ts
 * import { ValidTime } from "@beep/epistemics/Claim"
 * import * as S from "effect/Schema"
 *
 * const unknown = S.decodeUnknownSync(ValidTime)({ _tag: "Unknown" })
 * const bounded = S.decodeUnknownSync(ValidTime)({ _tag: "Interval", validFrom: 0, validTo: 1_000 })
 * console.log(unknown._tag, bounded._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ValidTime = S.TaggedUnion({
  Unknown: {},
  Interval: ValidIntervalFields,
})
  .check(
    S.makeFilter(
      (validTime: { readonly _tag: "Unknown" } | ({ readonly _tag: "Interval" } & ValidInterval)) =>
        validTime._tag === "Unknown" || isOrderedValidInterval(validTime),
      $I.annote("ValidTimeOrderCheck", { description: "An Interval valid time is non-empty and forward." })
    )
  )
  .pipe($I.annoteSchema("ValidTime", { description: "Valid time: unknown, or a half-open interval." }));

/**
 * @category models
 * @since 0.0.0
 */
export type ValidTime = typeof ValidTime.Type;

/**
 * Bind independent evidence observations and review payloads to owner identifiers.
 *
 * **Example** (Keep an unreviewed proposal separate from its core)
 *
 * ```ts
 * import { makeClaimReview } from "@beep/epistemics/Claim"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 * const review = makeClaimReview({ $I: $ScratchpadId.create("Review"),
 *   ids: { assertion: S.NonEmptyString, activity: S.NonEmptyString, principal: S.NonEmptyString } })
 * console.log(review.ReviewState.cases.Proposed.make({})._tag)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeClaimReview = <
  AssertionId extends IdCodec,
  ActivityId extends IdCodec,
  PrincipalId extends IdCodec,
>(config: {
  readonly $I: SchemaIdentity;
  readonly ids: {
    readonly assertion: AssertionId;
    readonly activity: ActivityId;
    readonly principal: PrincipalId;
  };
}) => {
  const { $I: $C, ids } = config;

  const dispositionStruct = <D extends S.Top>(disposition: D) =>
    S.Struct({
      disposition,
      reviewer: ids.principal,
      basis: BasisDigest,
      reviewedAt: S.DateTimeUtcFromMillis,
      reason: S.NonEmptyString,
    });

  const ReviewerDisposition = DispositionKind.pipe(
    dispositionStruct,
    $C.annoteSchema("ReviewerDisposition", {
      description: "A human disposition bound to the exact evidence basis it reviewed.",
    })
  );

  const EvidenceSignals = S.Struct({
    sourceTrust: makeSignal(SourceTrust),
    sourceAssertedConfidence: makeSignal(Measurement),
    extractorConfidence: makeSignal(ExtractorObservation),
    validator: makeSignal(S.TaggedUnion({ Conforms: {}, Violations: { messages: S.NonEmptyArray(S.String) } })),
    reviewer: makeSignal(ReviewerDisposition),
  }).pipe($C.annoteSchema("EvidenceSignals", { description: "evidence-signals/v1: five separate signals, no score." }));

  const DependenceAssessment = S.Struct({
    left: ids.assertion,
    right: ids.assertion,
    dependence: SourceDependence,
    basis: S.NonEmptyString,
    producedBy: ids.activity,
  }).pipe(
    $C.annoteSchema("DependenceAssessment", {
      description: "Lineage between two assertions; unknown is never treated as independent.",
    })
  );

  const ReviewState = S.TaggedUnion({
    Proposed: {},
    Accepted: { disposition: S.tag("accepted").pipe(dispositionStruct) },
    Rejected: { disposition: S.tag("rejected").pipe(dispositionStruct) },
    Disputed: { challengedBy: S.NonEmptyArray(ids.assertion), openedAt: S.DateTimeUtcFromMillis },
    Retracted: { reason: S.NonEmptyString, at: S.DateTimeUtcFromMillis },
  }).pipe($C.annoteSchema("ReviewState", { description: "Epistemic review state." }));

  return { ReviewerDisposition, EvidenceSignals, DependenceAssessment, ReviewState };
};

const ReviewVocabulary = makeClaimReview({
  $I,
  ids: { assertion: S.NonEmptyString, activity: S.NonEmptyString, principal: S.NonEmptyString },
});

/**
 * Discriminants projected from the review-state union for read-scope selection.
 *
 * **Example** (Select accepted review records)
 *
 * ```ts
 * import { ReviewTag } from "@beep/epistemics/Claim"
 * console.log(ReviewTag.is.Accepted("Accepted"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReviewTag = LiteralKit([
  ReviewVocabulary.ReviewState.cases.Proposed.fields._tag.schema.literal,
  ...Struct.keys(Struct.omit(ReviewVocabulary.ReviewState.cases, ["Proposed"])),
]).pipe($I.annoteSchema("ReviewTag", { description: "Read-only projection of the review union discriminants." }));

/**
 * A projected review discriminant.
 * @category models
 * @since 0.0.0
 */
export type ReviewTag = typeof ReviewTag.Type;
