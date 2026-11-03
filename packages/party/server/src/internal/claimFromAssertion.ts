/**
 * Shared construction of a first claim version from one real source assertion.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ClaimVersion } from "@beep/party-domain/Claim";
import { ClaimVersionId } from "@beep/party-domain/Ids";
import { logicalKey } from "@beep/party-domain/Proposition";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import type { EvidenceSignals, ReviewState, SourceAssertion } from "@beep/party-domain/Claim";

/**
 * Preserve source timing/support while requiring the caller's explicit review state.
 * @internal
 */
export const claimFromAssertion: {
  (review: ReviewState, signals: EvidenceSignals): (assertion: SourceAssertion) => ClaimVersion;
  (assertion: SourceAssertion, review: ReviewState, signals: EvidenceSignals): ClaimVersion;
} = dual(
  3,
  (assertion: SourceAssertion, review: ReviewState, signals: EvidenceSignals): ClaimVersion =>
    ClaimVersion.make({
      id: ClaimVersionId.make(`party-cv:${assertion.id}`),
      proposition: assertion.proposition,
      logicalKey: logicalKey(assertion.proposition),
      supportedBy: [assertion.id],
      challengedBy: [],
      supersedes: O.none(),
      knowledge: { recordedAt: assertion.recordedAt, expiredAt: O.none() },
      validTime: assertion.validTime,
      review,
      signals,
    })
);
