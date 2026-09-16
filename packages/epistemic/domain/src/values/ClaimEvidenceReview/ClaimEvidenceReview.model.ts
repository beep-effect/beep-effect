/**
 * Exact claim and evidence snapshots presented for human review.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicDomainId } from "@beep/identity/packages";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifiedTextAnchorErrorReason } from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit } from "@beep/schema";
import { UserPrincipal } from "@beep/shared-domain/entity/Principal";
import * as S from "effect/Schema";
import { EpistemicFixtureKey } from "../EpistemicFixtureKey/index.ts";
import { EvidenceSpan } from "../EvidenceSpan/index.ts";

const $I = $EpistemicDomainId.create("values/ClaimEvidenceReview/ClaimEvidenceReview.model");

/**
 * Complete assertion and source manifestation a reviewer is asked to assess.
 *
 * **Details**
 *
 * The source carries the scope and extractor identity. Extraction confidence
 * remains an extractor score; it does not establish that the assertion is true.
 * Changing any field changes the basis of the review.
 *
 * **Example** (Inspect the evidence boundary)
 *
 * ```ts
 * import { ClaimEvidenceBasis } from "@beep/epistemic-domain/values/ClaimEvidenceReview"
 *
 * console.log(ClaimEvidenceBasis.fields.evidence !== undefined) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimEvidenceBasis extends S.Class<ClaimEvidenceBasis>($I`ClaimEvidenceBasis`)(
  {
    claimRef: EpistemicFixtureKey,
    assertion: S.NonEmptyString,
    subject: S.NonEmptyString,
    evidence: EvidenceSpan,
    source: SourceTextIdentity,
  },
  $I.annote("ClaimEvidenceBasis", {
    description: "Exact assertion, subject, evidence span, and scoped source identity presented for human review.",
  })
) {}

/**
 * A human approval bound to the entire reviewed claim and evidence snapshot.
 *
 * **Details**
 *
 * This is a portable record of an approval, not authentication or current
 * source verification. The application supplies its authenticated user and
 * stores the returned record. Current use must reverify the source and compare
 * the complete basis; an old approval never silently transfers to a new one.
 *
 * **Example** (Inspect the human principal requirement)
 *
 * ```ts
 * import { ClaimEvidenceReview } from "@beep/epistemic-domain/values/ClaimEvidenceReview"
 *
 * console.log(ClaimEvidenceReview.fields.reviewedBy !== undefined) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimEvidenceReview extends S.Class<ClaimEvidenceReview>($I`ClaimEvidenceReview`)(
  {
    basis: ClaimEvidenceBasis,
    reviewedBy: UserPrincipal,
    reviewedAt: S.DateTimeUtcFromMillis,
  },
  $I.annote("ClaimEvidenceReview", {
    description: "Human approval of one exact claim and evidence basis; retained as history when that basis changes.",
  })
) {}

/**
 * Result of checking a quote against the presently resolved source text.
 *
 * **Example** (Construct an unverified result)
 *
 * ```ts
 * import { ClaimEvidenceVerification } from "@beep/epistemic-domain/values/ClaimEvidenceReview"
 *
 * const result = ClaimEvidenceVerification.cases.Unverified.make({ reason: "stale-source" })
 * console.log(result.reason) // stale-source
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimEvidenceVerification = S.TaggedUnion({
  Verified: {},
  Unverified: { reason: VerifiedTextAnchorErrorReason },
}).annotate(
  $I.annote("ClaimEvidenceVerification", {
    description: "Current exact-source verification result, separate from any human approval.",
  })
);

/**
 * Runtime type of {@link ClaimEvidenceVerification}.
 *
 * **Example** (Use the verified variant)
 *
 * ```ts
 * import { ClaimEvidenceVerification } from "@beep/epistemic-domain/values/ClaimEvidenceReview"
 *
 * const verification: ClaimEvidenceVerification = ClaimEvidenceVerification.cases.Verified.make({})
 * console.log(verification._tag) // Verified
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimEvidenceVerification = typeof ClaimEvidenceVerification.Type;

const ReviewStalenessReason = LiteralKit(["basis-changed", "source-unverified"]).annotate(
  $I.annote("ReviewStalenessReason", {
    description: "Reason a historical approval cannot apply to the current evidence.",
  })
);

/**
 * Human-review state with the historical approval retained after drift.
 *
 * **Example** (Start without a review)
 *
 * ```ts
 * import { ClaimEvidenceReviewStatus } from "@beep/epistemic-domain/values/ClaimEvidenceReview"
 *
 * console.log(ClaimEvidenceReviewStatus.cases.Pending.make({})._tag) // Pending
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimEvidenceReviewStatus = S.TaggedUnion({
  Pending: {},
  Current: { review: ClaimEvidenceReview },
  Stale: { review: ClaimEvidenceReview, reason: ReviewStalenessReason },
}).annotate(
  $I.annote("ClaimEvidenceReviewStatus", {
    description: "Pending human review, a current approval, or a retained approval whose basis is stale.",
  })
);

/**
 * Runtime type of {@link ClaimEvidenceReviewStatus}.
 *
 * **Example** (Type a pending state)
 *
 * ```ts
 * import { ClaimEvidenceReviewStatus } from "@beep/epistemic-domain/values/ClaimEvidenceReview"
 *
 * const status: ClaimEvidenceReviewStatus = ClaimEvidenceReviewStatus.cases.Pending.make({})
 * console.log(status._tag) // Pending
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimEvidenceReviewStatus = typeof ClaimEvidenceReviewStatus.Type;

/**
 * Inspectable claim, exact-source verification, and human-review status.
 *
 * **Details**
 *
 * Consumers must inspect both verification and review: a correctly quoted
 * source does not approve its interpretation, and a historical approval does
 * not prove that the source still matches.
 *
 * **Example** (Inspect the independent review and verification fields)
 *
 * ```ts
 * import { ClaimEvidenceExplanation } from "@beep/epistemic-domain/values/ClaimEvidenceReview"
 *
 * console.log(ClaimEvidenceExplanation.fields.review !== undefined) // true
 * console.log(ClaimEvidenceExplanation.fields.verification !== undefined) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimEvidenceExplanation extends S.Class<ClaimEvidenceExplanation>($I`ClaimEvidenceExplanation`)(
  {
    basis: ClaimEvidenceBasis,
    currentSource: SourceTextIdentity,
    sourceText: S.String,
    verification: ClaimEvidenceVerification,
    review: ClaimEvidenceReviewStatus,
  },
  $I.annote("ClaimEvidenceExplanation", {
    description:
      "Read model explaining an assertion, its exact source evidence, and the applicability of human review.",
  })
) {}
