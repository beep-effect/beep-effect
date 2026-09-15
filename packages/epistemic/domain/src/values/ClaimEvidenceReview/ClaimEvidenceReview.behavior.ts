/**
 * Applicability of a retained human review to current evidence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ClaimEvidenceBasis,
  ClaimEvidenceReviewStatus,
  ClaimEvidenceVerification,
} from "./ClaimEvidenceReview.model.ts";
import type { ClaimEvidenceReview } from "./ClaimEvidenceReview.model.ts";

const sameBasis = S.toEquivalence(ClaimEvidenceBasis);

/**
 * Explain whether a historical approval still applies to the current basis.
 *
 * **Details**
 *
 * A changed assertion, subject, confidence, span, scope, or source identity
 * invalidates reuse of the approval. Even an unchanged basis requires fresh
 * source verification before its approval can be reported as current.
 *
 * **Example** (No approval means pending review)
 *
 * ```ts
 * import { reviewStatusFor } from "@beep/epistemic-domain/values/ClaimEvidenceReview"
 *
 * console.log(typeof reviewStatusFor) // function
 * ```
 *
 * @param basis - Exact claim and evidence currently presented.
 * @param verification - Result of verifying the presently resolved source.
 * @param review - Optional historical human approval.
 * @returns Pending, current, or stale status, retaining the original approval.
 * @category validation
 * @since 0.0.0
 */
export const reviewStatusFor: {
  (
    basis: ClaimEvidenceBasis,
    verification: ClaimEvidenceVerification,
    review: O.Option<ClaimEvidenceReview>
  ): ClaimEvidenceReviewStatus;
  (
    verification: ClaimEvidenceVerification,
    review: O.Option<ClaimEvidenceReview>
  ): (basis: ClaimEvidenceBasis) => ClaimEvidenceReviewStatus;
} = dual(
  3,
  (
    basis: ClaimEvidenceBasis,
    verification: ClaimEvidenceVerification,
    review: O.Option<ClaimEvidenceReview>
  ): ClaimEvidenceReviewStatus =>
    O.match(review, {
      onNone: () => ClaimEvidenceReviewStatus.cases.Pending.make({}),
      onSome: (retained) => {
        if (!sameBasis(basis, retained.basis)) {
          return ClaimEvidenceReviewStatus.cases.Stale.make({ review: retained, reason: "basis-changed" });
        }
        return ClaimEvidenceVerification.match(verification, {
          Unverified: (): ClaimEvidenceReviewStatus =>
            ClaimEvidenceReviewStatus.cases.Stale.make({ review: retained, reason: "source-unverified" }),
          Verified: () => ClaimEvidenceReviewStatus.cases.Current.make({ review: retained }),
        });
      },
    })
);
