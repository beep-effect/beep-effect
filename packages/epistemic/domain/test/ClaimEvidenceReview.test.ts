import { EvidenceSpan } from "@beep/epistemic-domain";
import {
  ClaimEvidenceBasis,
  ClaimEvidenceReview,
  ClaimEvidenceVerification,
  reviewStatusFor,
} from "@beep/epistemic-domain/values/ClaimEvidenceReview";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { UserPrincipal } from "@beep/shared-domain/entity/Principal";
import * as SharedIdentity from "@beep/shared-domain/identity/Shared";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as DateTime from "effect/DateTime";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const sourceDigest = SourceTextDigest.make("sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca");
const basis = ClaimEvidenceBasis.make({
  claimRef: "claim:fact",
  assertion: "The source states fact.",
  subject: "Example source",
  evidence: EvidenceSpan.make({
    startChar: NonNegativeInt.make(0),
    endChar: NonNegativeInt.make(4),
    quote: "fact",
    confidence: UnitInterval.make(0.82),
  }),
  source: SourceTextIdentity.make({
    scopeRef: "project:example",
    sourceRef: "document:example",
    locator: PosixPath.make("documents/example.txt"),
    sourceDigest,
    textDigest: sourceDigest,
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  }),
});
const review = ClaimEvidenceReview.make({
  basis,
  reviewedBy: UserPrincipal.make({ kind: "User", userId: SharedIdentity.UserId.make(1) }),
  reviewedAt: DateTime.makeUnsafe(0),
});
const verified = ClaimEvidenceVerification.cases.Verified.make({});
const reviewJson = S.fromJsonString(ClaimEvidenceReview);
const reviewsEquivalent = S.toEquivalence(ClaimEvidenceReview);
const interpretations = Arbitrary.all([
  Arbitrary.schema(ClaimEvidenceBasis.fields.assertion),
  Arbitrary.schema(ClaimEvidenceBasis.fields.subject),
]);

describe("claim evidence review applicability", () => {
  it.effect.prop(
    "preserves arbitrary review history without transferring approval to changed assertions",
    { interpretation: interpretations },
    Effect.fnUntraced(function* ({ interpretation: [assertion, subject] }) {
      const generated = ClaimEvidenceReview.make({
        ...review,
        basis: ClaimEvidenceBasis.make({ ...basis, assertion, subject }),
      });
      const encoded = yield* S.encodeEffect(reviewJson)(generated);
      const retained = yield* S.decodeEffect(reviewJson)(encoded);
      const changed = ClaimEvidenceBasis.make({ ...generated.basis, assertion: `${assertion} changed` });
      expect(reviewsEquivalent(generated, retained)).toBe(true);
      expect(reviewStatusFor(generated.basis, verified, O.some(retained))._tag).toBe("Current");
      expect(reviewStatusFor(changed, verified, O.some(retained))._tag).toBe("Stale");
    }),
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
    { name: "assertion", basis: ClaimEvidenceBasis.make({ ...basis, assertion: "Every claim is proven." }) },
    { name: "subject", basis: ClaimEvidenceBasis.make({ ...basis, subject: "Other source" }) },
    { name: "claim identity", basis: ClaimEvidenceBasis.make({ ...basis, claimRef: "claim:other" }) },
    {
      name: "quote",
      basis: ClaimEvidenceBasis.make({
        ...basis,
        evidence: EvidenceSpan.make({ ...basis.evidence, quote: "fake" }),
      }),
    },
    {
      name: "confidence",
      basis: ClaimEvidenceBasis.make({
        ...basis,
        evidence: EvidenceSpan.make({ ...basis.evidence, confidence: UnitInterval.make(0.99) }),
      }),
    },
    {
      name: "scope",
      basis: ClaimEvidenceBasis.make({
        ...basis,
        source: SourceTextIdentity.make({ ...basis.source, scopeRef: "project:other" }),
      }),
    },
    {
      name: "extractor",
      basis: ClaimEvidenceBasis.make({
        ...basis,
        source: SourceTextIdentity.make({
          ...basis.source,
          extractor: SourceTextExtractor.make({ name: "utf8", version: "2" }),
        }),
      }),
    },
  ])("requires another review after changing $name", ({ basis: changed }) => {
    expect(reviewStatusFor(changed, verified, O.some(review))).toEqual({
      _tag: "Stale",
      reason: "basis-changed",
      review,
    });
  });
  it.effect("round-trips the complete historical approval", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(reviewJson)(review);
      const decoded = yield* S.decodeEffect(reviewJson)(encoded);
      expect(reviewsEquivalent(review, decoded)).toBe(true);
      expect(reviewStatusFor(basis, verified, O.some(decoded))._tag).toBe("Current");
    })
  );
  it.effect("refuses an agent principal as a human reviewer", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ClaimEvidenceReview)(review);
      const exit = yield* Effect.exit(
        S.decodeUnknownEffect(ClaimEvidenceReview)({
          ...encoded,
          reviewedBy: { kind: "Agent", agentId: 1 },
        })
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});
