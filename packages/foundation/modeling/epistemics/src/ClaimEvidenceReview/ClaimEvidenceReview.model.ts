/**
 * Exact claim evidence and human-review schema factories.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LiteralKit } from "@beep/schema";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { VerifiedTextAnchorErrorReason } from "@beep/text/VerifiedTextAnchor";
import { dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { EvidenceSpan } from "../EvidenceSpan/index.ts";
import type { SchemaIdentity } from "../Factory/index.ts";

/**
 * Build the exact claim evidence basis schema over a caller-supplied claim
 * reference schema.
 *
 * **Details**
 *
 * Returns `ClaimEvidenceBasisSchema`: the assertion, subject, evidence span and
 * scoped source identity a reviewer approves. A binding wraps it in its own
 * `S.Opaque` class before building {@link makeClaimEvidenceReview}.
 *
 * **Example** (Bind an evidence basis to string claim references)
 *
 * ```ts
 * import { makeClaimEvidenceBasis } from "@beep/epistemics/ClaimEvidenceReview"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const { ClaimEvidenceBasisSchema } = makeClaimEvidenceBasis({
 *   $I: $ScratchpadId.create("party/ClaimEvidenceReview"),
 *   claimRef: S.NonEmptyString
 * })
 * console.log(Object.keys(ClaimEvidenceBasisSchema.fields).length) // 5
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeClaimEvidenceBasis = <ClaimRef extends S.Top>(config: {
  readonly $I: SchemaIdentity;
  readonly claimRef: ClaimRef;
}) => {
  const { $I, claimRef } = config;

  const ClaimEvidenceBasisSchema = S.Struct({
    claimRef,
    assertion: S.NonEmptyString,
    subject: S.NonEmptyString,
    evidence: EvidenceSpan,
    source: SourceTextIdentity,
  }).pipe(
    $I.annoteSchema("ClaimEvidenceBasis", {
      description: "Exact assertion, subject, evidence span, and scoped source identity presented for human review.",
    })
  );

  return { ClaimEvidenceBasisSchema };
};

/**
 * Build the human approval schema over a caller-bound evidence basis class and
 * reviewer schema.
 *
 * **Details**
 *
 * Returns `ClaimEvidenceReviewSchema`: one exact basis, the reviewer, and the
 * review instant. A binding wraps it in its own `S.Opaque` class before building
 * {@link makeClaimEvidenceReviewStatus}.
 *
 * **Example** (Bind a review to a string reviewer)
 *
 * ```ts
 * import { makeClaimEvidenceBasis, makeClaimEvidenceReview } from "@beep/epistemics/ClaimEvidenceReview"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const $I = $ScratchpadId.create("party/ClaimEvidenceReview")
 * const { ClaimEvidenceBasisSchema } = makeClaimEvidenceBasis({ $I, claimRef: S.NonEmptyString })
 * const { ClaimEvidenceReviewSchema } = makeClaimEvidenceReview({
 *   $I,
 *   ClaimEvidenceBasis: ClaimEvidenceBasisSchema,
 *   reviewer: S.NonEmptyString
 * })
 * console.log(Object.keys(ClaimEvidenceReviewSchema.fields)) // ["basis", "reviewedBy", "reviewedAt"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeClaimEvidenceReview = <Basis extends S.Top, Reviewer extends S.Top>(config: {
  readonly $I: SchemaIdentity;
  readonly ClaimEvidenceBasis: Basis;
  readonly reviewer: Reviewer;
}) => {
  const { $I, ClaimEvidenceBasis, reviewer } = config;

  const ClaimEvidenceReviewSchema = S.Struct({
    basis: ClaimEvidenceBasis,
    reviewedBy: reviewer,
    reviewedAt: S.DateTimeUtcFromMillis,
  }).pipe(
    $I.annoteSchema("ClaimEvidenceReview", {
      description: "Human approval of one exact claim and evidence basis; retained as history when that basis changes.",
    })
  );

  return { ClaimEvidenceReviewSchema };
};

/**
 * Build source verification, review applicability and the explanation read
 * model over caller-bound basis and review classes.
 *
 * **Details**
 *
 * Returns `ClaimEvidenceVerification`, `ClaimEvidenceReviewStatus` and
 * `ClaimEvidenceExplanationSchema` (for the binding's `S.Opaque` class). Decide
 * applicability with {@link makeReviewStatusFor}.
 *
 * **Example** (Decide a pending review)
 *
 * ```ts
 * import {
 *   makeClaimEvidenceBasis,
 *   makeClaimEvidenceReview,
 *   makeClaimEvidenceReviewStatus
 * } from "@beep/epistemics/ClaimEvidenceReview"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const $I = $ScratchpadId.create("party/ClaimEvidenceReview")
 * const { ClaimEvidenceBasisSchema } = makeClaimEvidenceBasis({ $I, claimRef: S.NonEmptyString })
 * const { ClaimEvidenceReviewSchema } = makeClaimEvidenceReview({
 *   $I,
 *   ClaimEvidenceBasis: ClaimEvidenceBasisSchema,
 *   reviewer: S.NonEmptyString
 * })
 * const { ClaimEvidenceVerification } = makeClaimEvidenceReviewStatus({
 *   $I,
 *   ClaimEvidenceBasis: ClaimEvidenceBasisSchema,
 *   ClaimEvidenceReview: ClaimEvidenceReviewSchema
 * })
 * console.log(ClaimEvidenceVerification.cases.Verified.make({})._tag) // "Verified"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeClaimEvidenceReviewStatus = <Basis extends S.Top, Review extends S.Top>(config: {
  readonly $I: SchemaIdentity;
  readonly ClaimEvidenceBasis: Basis;
  readonly ClaimEvidenceReview: Review;
}) => {
  const { $I, ClaimEvidenceBasis, ClaimEvidenceReview } = config;

  const ClaimEvidenceVerification = S.TaggedUnion({
    Verified: {},
    Unverified: { reason: VerifiedTextAnchorErrorReason },
  }).pipe(
    $I.annoteSchema("ClaimEvidenceVerification", {
      description: "Current exact-source verification result, separate from any human approval.",
    })
  );

  const ReviewStalenessReason = LiteralKit(["basis-changed", "source-unverified"]).pipe(
    $I.annoteSchema("ReviewStalenessReason", {
      description: "Reason a historical approval cannot apply to the current evidence.",
    })
  );

  const ClaimEvidenceReviewStatus = S.TaggedUnion({
    Pending: {},
    Current: { review: ClaimEvidenceReview },
    Stale: { review: ClaimEvidenceReview, reason: ReviewStalenessReason },
  }).pipe(
    $I.annoteSchema("ClaimEvidenceReviewStatus", {
      description: "Pending human review, a current approval, or a retained approval whose basis is stale.",
    })
  );

  const ClaimEvidenceExplanationSchema = S.Struct({
    basis: ClaimEvidenceBasis,
    currentSource: SourceTextIdentity,
    sourceText: S.String,
    verification: ClaimEvidenceVerification,
    review: ClaimEvidenceReviewStatus,
  }).pipe(
    $I.annoteSchema("ClaimEvidenceExplanation", {
      description:
        "Read model explaining an assertion, its exact source evidence, and the applicability of human review.",
    })
  );

  return { ClaimEvidenceVerification, ClaimEvidenceReviewStatus, ClaimEvidenceExplanationSchema };
};

/**
 * Current exact-source verification result read by `reviewStatusFor`.
 *
 * **Example** (Type an unverified result)
 *
 * ```ts
 * import type { ClaimEvidenceVerificationShape } from "@beep/epistemics/ClaimEvidenceReview"
 *
 * const verification: ClaimEvidenceVerificationShape = { _tag: "Unverified", reason: "stale-source" }
 * console.log(verification._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClaimEvidenceVerificationShape =
  | { readonly _tag: "Verified" }
  | { readonly _tag: "Unverified"; readonly reason: VerifiedTextAnchorErrorReason };

/**
 * Build `reviewStatusFor` over caller-bound basis and review-status schemas.
 *
 * **Details**
 *
 * `reviewStatusFor` (dual) decides whether a retained approval still applies:
 * pending without a review, stale when the basis changed or the source is
 * unverified, current otherwise. Bases are compared with the basis schema's
 * equivalence; statuses are built with the bound status cases, so they are
 * validated like any other constructed value.
 *
 * **Example** (Report a missing approval as pending)
 *
 * ```ts
 * import {
 *   makeClaimEvidenceBasis,
 *   makeClaimEvidenceReview,
 *   makeClaimEvidenceReviewStatus,
 *   makeReviewStatusFor
 * } from "@beep/epistemics/ClaimEvidenceReview"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const $I = $ScratchpadId.create("party/ClaimEvidenceReview")
 * const { ClaimEvidenceBasisSchema } = makeClaimEvidenceBasis({ $I, claimRef: S.NonEmptyString })
 * const { ClaimEvidenceReviewSchema } = makeClaimEvidenceReview({
 *   $I,
 *   ClaimEvidenceBasis: ClaimEvidenceBasisSchema,
 *   reviewer: S.NonEmptyString
 * })
 * const { ClaimEvidenceReviewStatus } = makeClaimEvidenceReviewStatus({
 *   $I,
 *   ClaimEvidenceBasis: ClaimEvidenceBasisSchema,
 *   ClaimEvidenceReview: ClaimEvidenceReviewSchema
 * })
 * const { reviewStatusFor } = makeReviewStatusFor({
 *   ClaimEvidenceBasis: ClaimEvidenceBasisSchema,
 *   ClaimEvidenceReview: ClaimEvidenceReviewSchema,
 *   ClaimEvidenceReviewStatus
 * })
 *
 * const pendingFor = reviewStatusFor({ _tag: "Verified" }, O.none())
 * console.log(typeof pendingFor) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeReviewStatusFor = <
  Basis extends S.Top,
  Review extends S.Top & { readonly Type: { readonly basis: Basis["Type"] } },
  Status extends S.Top & {
    readonly cases: {
      readonly Pending: { readonly make: (input: {}) => Status["Type"] };
      readonly Current: { readonly make: (input: { readonly review: Review["Type"] }) => Status["Type"] };
      readonly Stale: {
        readonly make: (input: {
          readonly review: Review["Type"];
          readonly reason: "basis-changed" | "source-unverified";
        }) => Status["Type"];
      };
    };
  },
>(config: {
  readonly ClaimEvidenceBasis: Basis;
  readonly ClaimEvidenceReview: Review;
  readonly ClaimEvidenceReviewStatus: Status;
}) => {
  const { ClaimEvidenceBasis, ClaimEvidenceReviewStatus } = config;
  type ReviewStatus = Status["Type"];

  const sameBasis = S.toEquivalence(ClaimEvidenceBasis);

  const reviewStatusFor: {
    (
      basis: Basis["Type"],
      verification: ClaimEvidenceVerificationShape,
      review: O.Option<Review["Type"]>
    ): ReviewStatus;
    (
      verification: ClaimEvidenceVerificationShape,
      review: O.Option<Review["Type"]>
    ): (basis: Basis["Type"]) => ReviewStatus;
  } = dual(
    3,
    (
      basis: Basis["Type"],
      verification: ClaimEvidenceVerificationShape,
      review: O.Option<Review["Type"]>
    ): ReviewStatus =>
      O.match(review, {
        onNone: () => ClaimEvidenceReviewStatus.cases.Pending.make({}),
        onSome: (retained) => {
          if (!sameBasis(basis, retained.basis)) {
            return ClaimEvidenceReviewStatus.cases.Stale.make({ review: retained, reason: "basis-changed" });
          }
          return pipe(
            Match.value(verification),
            Match.tagsExhaustive({
              Unverified: (): ReviewStatus =>
                ClaimEvidenceReviewStatus.cases.Stale.make({ review: retained, reason: "source-unverified" }),
              Verified: () => ClaimEvidenceReviewStatus.cases.Current.make({ review: retained }),
            })
          );
        },
      })
  );

  return { reviewStatusFor };
};
