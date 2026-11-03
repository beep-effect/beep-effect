/**
 * Exact claim and evidence snapshots presented for human review.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- Nominal party bindings instantiate shared epistemics factories with party ids and brands; importing another product slice would violate the boundary. No copied algorithms. Review by 2026-12-03 or on factory/API changes.
import {
  makeClaimEvidenceBasis,
  makeClaimEvidenceReview,
  makeClaimEvidenceReviewStatus,
  makeReviewStatusFor,
} from "@beep/epistemics/ClaimEvidenceReview";
import { $PartyDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { ClaimVersionId, PrincipalId } from "../../Ids.ts";
import type * as O from "effect/Option";

const $I = $PartyDomainId.create("values/ClaimEvidenceReview/ClaimEvidenceReview.model");
const basis = makeClaimEvidenceBasis({ $I, claimRef: ClaimVersionId });

/**
 * Complete assertion and source manifestation a reviewer is asked to assess.
 *
 * **Details**
 *
 * The source carries the scope and extractor identity. Extraction confidence
 * remains an extractor score; it does not establish that the assertion is true.
 * Changing any field changes the basis of the review.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ClaimEvidenceBasis } from "@beep/party-domain/ClaimEvidenceReview"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ClaimEvidenceBasis)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimEvidenceBasis extends S.Opaque<ClaimEvidenceBasis, { readonly brand: unique symbol }>()(
  basis.ClaimEvidenceBasisSchema
) {}

const review = makeClaimEvidenceReview({ $I, ClaimEvidenceBasis, reviewer: PrincipalId });

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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ClaimEvidenceReview } from "@beep/party-domain/ClaimEvidenceReview"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ClaimEvidenceReview)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimEvidenceReview extends S.Opaque<ClaimEvidenceReview, { readonly brand: unique symbol }>()(
  review.ClaimEvidenceReviewSchema
) {}

const status = makeClaimEvidenceReviewStatus({ $I, ClaimEvidenceBasis, ClaimEvidenceReview });

/**
 * Result of checking a quote against the presently resolved source text.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ClaimEvidenceVerification } from "@beep/party-domain/ClaimEvidenceReview"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ClaimEvidenceVerification)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimEvidenceVerification = status.ClaimEvidenceVerification;

/**
 * Runtime type of {@link ClaimEvidenceVerification}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimEvidenceVerification = typeof ClaimEvidenceVerification.Type;

/**
 * Human-review state with the historical approval retained after drift.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ClaimEvidenceReviewStatus } from "@beep/party-domain/ClaimEvidenceReview"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ClaimEvidenceReviewStatus)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimEvidenceReviewStatus = status.ClaimEvidenceReviewStatus;

/**
 * Runtime type of {@link ClaimEvidenceReviewStatus}.
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ClaimEvidenceExplanation } from "@beep/party-domain/ClaimEvidenceReview"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ClaimEvidenceExplanation)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimEvidenceExplanation extends S.Opaque<ClaimEvidenceExplanation, { readonly brand: unique symbol }>()(
  status.ClaimEvidenceExplanationSchema
) {}

/**
 * Explain whether a historical approval still applies to the current basis.
 *
 * **Details**
 *
 * A changed assertion, subject, confidence, span, scope, or source identity
 * invalidates reuse of the approval. Even an unchanged basis requires fresh
 * source verification before its approval can be reported as current.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { reviewStatusFor } from "@beep/party-domain/ClaimEvidenceReview"
 * const binding = reviewStatusFor
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
} = makeReviewStatusFor({
  ClaimEvidenceBasis,
  ClaimEvidenceReview,
  ClaimEvidenceReviewStatus,
}).reviewStatusFor;
