import {
  ClaimEvidenceBasis,
  ClaimEvidenceReview,
  ClaimEvidenceVerification,
  reviewStatusFor,
} from "@beep/epistemic-domain/values/ClaimEvidenceReview";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeBasis = S.decodeUnknownSync(ClaimEvidenceBasis);
const encodeBasis = S.encodeSync(ClaimEvidenceBasis);
const decodeReview = S.decodeUnknownSync(ClaimEvidenceReview);
const decodeReviewResult = S.decodeUnknownResult(ClaimEvidenceReview);
const encodeReview = S.encodeSync(ClaimEvidenceReview);
const reviewJson = S.fromJsonString(ClaimEvidenceReview);
const decodeReviewJson = S.decodeSync(reviewJson);
const encodeReviewJson = S.encodeSync(reviewJson);
const reviewsEquivalent = S.toEquivalence(ClaimEvidenceReview);
const interpretations = Arbitrary.all([
  Arbitrary.schema(ClaimEvidenceBasis.fields.assertion),
  Arbitrary.schema(ClaimEvidenceBasis.fields.subject),
]);
const basis = decodeBasis({
  claimRef: "claim:fact",
  assertion: "The source states fact.",
  subject: "Example source",
  evidence: { startChar: 0, endChar: 4, quote: "fact", confidence: 0.82 },
  source: {
    scopeRef: "project:example",
    sourceRef: "document:example",
    locator: "documents/example.txt",
    sourceDigest: "sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca",
    textDigest: "sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca",
    extractor: { name: "utf8", version: "1" },
    normalizationVersion: "1",
  },
});
const review = decodeReview({
  basis: encodeBasis(basis),
  reviewedBy: { kind: "User", userId: 1 },
  reviewedAt: 0,
});
const verified = ClaimEvidenceVerification.cases.Verified.make({});

describe("claim evidence review applicability", () => {
  it.prop(
    "preserves arbitrary review history without transferring approval to changed assertions",
    { interpretation: interpretations },
    ({ interpretation: [assertion, subject] }) => {
      const generated = ClaimEvidenceReview.make({
        ...review,
        basis: ClaimEvidenceBasis.make({ ...basis, assertion, subject }),
      });
      const retained = decodeReviewJson(encodeReviewJson(generated));
      const changed = ClaimEvidenceBasis.make({ ...generated.basis, assertion: `${assertion} changed` });
      expect(reviewsEquivalent(generated, retained)).toBe(true);
      expect(reviewStatusFor(generated.basis, verified, O.some(retained))._tag).toBe("Current");
      expect(reviewStatusFor(changed, verified, O.some(retained))._tag).toBe("Stale");
    },
    { arbitrary: fcRuns(50) }
  );
  it("keeps source verification separate from human approval", () => {
    expect(reviewStatusFor(basis, verified, O.none())._tag).toBe("Pending");
    expect(reviewStatusFor(basis, verified, O.some(review))).toEqual({ _tag: "Current", review });
  });
  it("retains historical approval when the source cannot be verified", () => {
    expect(
      reviewStatusFor(
        basis,
        ClaimEvidenceVerification.cases.Unverified.make({ reason: "stale-source" }),
        O.some(review)
      )
    ).toEqual({ _tag: "Stale", reason: "source-unverified", review });
  });
  it.each([
    { name: "assertion", basis: decodeBasis({ ...basis, assertion: "Every claim is proven." }) },
    { name: "subject", basis: decodeBasis({ ...basis, subject: "Other source" }) },
    { name: "claim identity", basis: decodeBasis({ ...basis, claimRef: "claim:other" }) },
    { name: "quote", basis: decodeBasis({ ...basis, evidence: { ...basis.evidence, quote: "fake" } }) },
    { name: "confidence", basis: decodeBasis({ ...basis, evidence: { ...basis.evidence, confidence: 0.99 } }) },
    { name: "scope", basis: decodeBasis({ ...basis, source: { ...basis.source, scopeRef: "project:other" } }) },
    {
      name: "extractor",
      basis: decodeBasis({ ...basis, source: { ...basis.source, extractor: { name: "utf8", version: "2" } } }),
    },
  ])("requires another review after changing $name", ({ basis: changed }) => {
    expect(reviewStatusFor(changed, verified, O.some(review))).toEqual({
      _tag: "Stale",
      reason: "basis-changed",
      review,
    });
  });
  it("round-trips the complete historical approval", () => {
    const decoded = decodeReviewJson(encodeReviewJson(review));
    expect(reviewsEquivalent(review, decoded)).toBe(true);
    expect(reviewStatusFor(basis, verified, O.some(decoded))._tag).toBe("Current");
  });
  it("refuses an agent principal as a human reviewer", () => {
    expect(
      decodeReviewResult({
        ...encodeReview(review),
        reviewedBy: { kind: "Agent", agentId: 1 },
      })._tag
    ).toBe("Failure");
  });
});
