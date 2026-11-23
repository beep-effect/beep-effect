import { makeClaimEnvelope } from "@beep/epistemics/Claim";
import { ClaimId } from "@beep/epistemics/ClaimCore";
import {
  makeClaimEvidenceBasis,
  makeClaimEvidenceReview,
  makeClaimEvidenceReviewStatus,
  makeReviewStatusFor,
} from "@beep/epistemics/ClaimEvidenceReview";
import { EvidencePosition, ExtractorConfidence } from "@beep/epistemics/EvidencePosition.schema";
import { $EpistemicsId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fixture, flow, requestFor } from "./support/Admissions.ts";

const $I = $EpistemicsId.create("test/ClaimGate.two-claims-one-occurrence");
const basisVocabulary = makeClaimEvidenceBasis({ $I, claimRef: ClaimId });
class Basis extends S.Opaque<Basis, { readonly brand: unique symbol }>()(basisVocabulary.ClaimEvidenceBasisSchema) {}
const approvalVocabulary = makeClaimEvidenceReview({ $I, ClaimEvidenceBasis: Basis, reviewer: S.NonEmptyString });
class Approval extends S.Opaque<Approval, { readonly brand: unique symbol }>()(
  approvalVocabulary.ClaimEvidenceReviewSchema
) {}
const reviewStatusVocabulary = makeClaimEvidenceReviewStatus({
  $I,
  ClaimEvidenceBasis: Basis,
  ClaimEvidenceReview: Approval,
});
const { reviewStatusFor } = makeReviewStatusFor({
  ClaimEvidenceBasis: Basis,
  ClaimEvidenceReview: Approval,
  ClaimEvidenceReviewStatus: reviewStatusVocabulary.ClaimEvidenceReviewStatus,
});
const reviewVocabulary = makeClaimEnvelope({
  $I,
  proposition: S.NonEmptyString,
  logicalKey: (value) => value,
  ids: { claimVersion: ClaimId, assertion: S.NonEmptyString, activity: S.NonEmptyString, principal: S.NonEmptyString },
});
class ReviewedEvidence extends S.Opaque<ReviewedEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    claim: ClaimId,
    receipt: TextAnchorVerificationReceipt,
    review: reviewVocabulary.ReviewState,
  }).pipe(
    $I.annoteSchema("ReviewedEvidence", { description: "Claim-local synthetic evidence and independent review." })
  )
) {}

it.layer(Digest.layerWebCrypto, { timeout: "10 seconds" })("claim-local evidence at a shared occurrence", (it) => {
  it.effect("L4-2 the admission gate and review records keep two claims at one occurrence separate", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      expect(value.a.claim).not.toBe(value.b.claim);
      expect(value.a.core.supportAtCreation).toEqual(value.b.core.supportAtCreation);
      const request = requestFor(value);
      const accepted = yield* flow.admit(request);
      const rejected = yield* flow.admit({ ...request, record: value.b });
      expect(accepted._tag).toBe("Admitted");
      expect(rejected).toMatchObject({ _tag: "Refused", refusal: { _tag: "InvalidBinding", claim: value.b.claim } });
      const evidence = EvidencePosition.make({
        position: value.receipt.anchor,
        extractorConfidence: ExtractorConfidence.cases.Absent.make({ reason: "not-assessed" }),
      });
      const basisA = Basis.make({
        claimRef: value.a.claim,
        assertion: value.a.core.proposition.text,
        subject: value.source.sourceRef,
        evidence,
        source: value.source,
      });
      const basisB = Basis.make({
        claimRef: value.b.claim,
        assertion: value.b.core.proposition.text,
        subject: value.source.sourceRef,
        evidence,
        source: value.source,
      });
      const approval = Approval.make({ basis: basisA, reviewedBy: "human", reviewedAt: DateTime.makeUnsafe(30) });
      const verified = reviewStatusVocabulary.ClaimEvidenceVerification.cases.Verified.make({});
      expect(reviewStatusFor(basisA, verified, O.some(approval))).toMatchObject({ _tag: "Current" });
      expect(reviewStatusFor(basisB, verified, O.some(approval))).toMatchObject({
        _tag: "Stale",
        reason: "basis-changed",
      });
      const disposition = {
        reviewer: "human",
        basis: Str.repeat(64)("a"),
        reviewedAt: DateTime.makeUnsafe(30),
      };
      const left = ReviewedEvidence.make({
        claim: value.a.claim,
        receipt: value.receipt,
        review: reviewVocabulary.ReviewState.cases.Accepted.make({
          disposition: { ...disposition, disposition: "accepted", reason: "The exact proposition was approved." },
        }),
      });
      const right = ReviewedEvidence.make({
        claim: value.b.claim,
        receipt: value.receipt,
        review: reviewVocabulary.ReviewState.cases.Rejected.make({
          disposition: {
            ...disposition,
            disposition: "rejected",
            reason: "The occurrence does not authorize this proposition.",
          },
        }),
      });
      const byClaim = HashMap.make([left.claim, left], [right.claim, right]);
      expect(HashMap.size(byClaim)).toBe(2);
      assertSome(HashMap.get(byClaim, value.a.claim), left);
      assertSome(HashMap.get(byClaim, value.b.claim), right);
      expect(left.receipt).toEqual(right.receipt);
      expect(left.review).toMatchObject({
        _tag: "Accepted",
        disposition: { reason: "The exact proposition was approved." },
      });
      expect(right.review).toMatchObject({
        _tag: "Rejected",
        disposition: { reason: "The occurrence does not authorize this proposition." },
      });
    })
  );
});
