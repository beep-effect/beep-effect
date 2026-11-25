import { makeAssessmentArrows, makeAssessments } from "@beep/epistemics/Assessments";
import { ReviewTag } from "@beep/epistemics/Claim";
import { $PartyDomainId } from "@beep/identity/packages";
import { AdmissionClause, AdmissionEvidence, AdmissionPolicy, admit, SupportFacts } from "@beep/party-domain/Admission";
import {
  ClaimEvidenceLinks,
  ClaimRead,
  ClaimReviewRecord,
  DependenceAssessment,
  ReviewState,
  readClaims,
} from "@beep/party-domain/Claim";
import { ActivityId, AssertionId } from "@beep/party-domain/Ids";
import { Proposition } from "@beep/party-domain/Proposition";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { accepted, at, partyClaim } from "./fixtures/claims.ts";
import type { Gate } from "@beep/epistemics/Assessments";

const $I = $PartyDomainId.create("test/Assessments.party.laws");
const coordinates = { review: ReviewTag, independentSupport: S.FiniteFromString, openChallenges: S.FiniteFromString };
const arrows = makeAssessmentArrows({ $I, coordinates });
const Assessments = makeAssessments({ $I, coordinates });
type AssessmentRecord = typeof Assessments.Type;

const policy = AdmissionPolicy.make({
  id: "client-facing-corroborated",
  version: "1",
  tier: "client-facing",
  clauses: [
    AdmissionClause.cases.MinIndependentSupport.make({ n: 2, unknownCountsAs: "dependent" }),
    AdmissionClause.cases.RequireReviewerAcceptance.make({}),
    AdmissionClause.cases.NoOpenChallenge.make({}),
  ],
});
const supportPool = A.map(A.range(1, 8), (n) => AssertionId.make(`party-asrt:support:${n}`));
const challengePool = A.map(A.range(1, 8), (n) => AssertionId.make(`party-asrt:challenge:${n}`));
const reviewFor = (tag: ReviewTag): ReviewState =>
  ReviewTag.match(tag, {
    Proposed: () => ReviewState.cases.Proposed.make({}),
    Accepted: () => accepted(1),
    Rejected: () =>
      ReviewState.cases.Rejected.make({ disposition: { ...accepted(1).disposition, disposition: "rejected" } }),
    Disputed: () => ReviewState.cases.Disputed.make({ challengedBy: [A.headNonEmpty(challengePool)], openedAt: at(1) }),
    Retracted: () => ReviewState.cases.Retracted.make({ reason: "Synthetic withdrawal", at: at(1) }),
  });
const independentPairs = (supports: ReadonlyArray<AssertionId>) =>
  A.flatMap(supports, (left, index) =>
    A.map(A.drop(supports, index + 1), (right) =>
      DependenceAssessment.make({
        left,
        right,
        dependence: "independent",
        basis: "Different synthetic witnesses",
        producedBy: ActivityId.make("party-act:dependence"),
      })
    )
  );

const evidenceGate = (base: ClaimRead, calls: { count: number }): Gate<typeof coordinates> => ({
  name: "party-admission-client-facing",
  version: "1",
  requiredCoordinates: HashSet.fromIterable<keyof typeof coordinates>([
    "review",
    "independentSupport",
    "openChallenges",
  ]),
  order: {
    review: Order.mapInput(Num.Order, (tag: ReviewTag) => (tag === "Accepted" ? 1 : 0)),
    independentSupport: Num.Order,
    openChallenges: Order.flip(Num.Order),
  },
  passes: (record) => {
    calls.count += 1;
    if (
      record.review._tag !== "Assessed" ||
      record.independentSupport._tag !== "Assessed" ||
      record.openChallenges._tag !== "Assessed"
    )
      return false;
    const supports = A.take(supportPool, record.independentSupport.value);
    const challenges = A.take(challengePool, record.openChallenges.value);
    const claim = ClaimRead.make({
      ...base,
      evidence: ClaimEvidenceLinks.makeOption({
        claim: base.record.claim,
        at: at(1),
        supportedBy: supports,
        challengedBy: challenges,
      }),
      review: ClaimReviewRecord.makeOption({
        claim: base.record.claim,
        at: at(1),
        review: reviewFor(record.review.value),
      }),
    });
    const evidence = AdmissionEvidence.make({
      claim,
      supports: A.map(supports, (assertion) =>
        SupportFacts.make({ assertion, side: "third-party-production", kind: "distinctive-behavior" })
      ),
      dependence: independentPairs(supports),
    });
    return Result.isSuccess(admit({ policy, evidence, knowledgeTime: at(20) }));
  },
});

const assessed = (review: ReviewTag, independentSupport: number, openChallenges: number): AssessmentRecord =>
  Assessments.make({
    review: { _tag: "Assessed", value: review },
    independentSupport: { _tag: "Assessed", value: independentSupport },
    openChallenges: { _tag: "Assessed", value: openChallenges },
  });
const setup = Effect.gen(function* () {
  const proposition = Proposition.cases.SameParty.make({ left: PartyId.make(1), right: PartyId.make(2) });
  const { ledger } = yield* partyClaim({ proposition, knowledgeStart: 1 });
  const base = O.getOrThrow(A.head(readClaims(ledger, at(20))));
  const calls = { count: 0 };
  return { calls, gate: evidenceGate(base, calls), initial: assessed("Accepted", 2, 0) };
});
const SupportCount = S.Int.check(S.isBetween({ minimum: 0, maximum: 6 }));
const ChallengeCount = S.Int.check(S.isBetween({ minimum: 0, maximum: 3 }));

describe("party admission assessments", () => {
  it.layer(Digest.layerWebCrypto)("owner gate", (it) => {
    it.effect("L4-6 the party gate admits the corroborated record and every coordinate is required", () =>
      Effect.gen(function* () {
        const { gate, initial } = yield* setup;
        expect(gate.passes(initial)).toBe(true);
        expect(gate.passes(assessed("Accepted", 1, 0))).toBe(false);
        expect(gate.passes(assessed("Accepted", 2, 1))).toBe(false);
        expect(gate.passes(assessed("Disputed", 2, 0))).toBe(false);
        expect(S.is(Assessments)({ review: initial.review, independentSupport: initial.independentSupport })).toBe(
          false
        );
      })
    );

    it.effect("L4-6 malformed encoded coordinates return the original record and never call the party gate", () =>
      Effect.gen(function* () {
        const { calls, gate, initial } = yield* setup;
        const support = yield* arrows.updateAssessment({
          record: initial,
          coordinate: "independentSupport",
          input: "two",
          gate,
        });
        const review = yield* arrows.updateAssessment({
          record: initial,
          coordinate: "review",
          input: "Admitted",
          gate,
        });
        expect(support._tag).toBe("Invalid");
        expect(support.record).toBe(initial);
        expect(review._tag).toBe("Invalid");
        expect(review.record).toBe(initial);
        expect(calls.count).toBe(0);
      })
    );

    it.effect("L4-6 refused transitions are no-ops and unassessed coordinates never pass", () =>
      Effect.gen(function* () {
        const { calls, gate, initial } = yield* setup;
        const refused = yield* arrows.updateAssessment({
          record: initial,
          coordinate: "review",
          input: "Proposed",
          gate,
        });
        expect(refused._tag).toBe("Refused");
        expect(refused.record).toBe(initial);
        expect(calls.count).toBe(1);
        const unknown = Assessments.make({ ...initial, openChallenges: { _tag: "Unassessed", reason: "unavailable" } });
        const blocked = yield* arrows.updateAssessment({
          record: unknown,
          coordinate: "independentSupport",
          input: "5",
          gate,
        });
        expect(blocked._tag).toBe("Refused");
        expect(blocked.record).toBe(unknown);
        expect(calls.count).toBe(1);
        expect(gate.passes(unknown)).toBe(false);
      })
    );

    it.effect.prop(
      "L4-6 distinct encoded party coordinates commute under the actual admission gate",
      [S.Tuple([SupportCount, ChallengeCount, ReviewTag])],
      ([[support, challenges, review]]) =>
        Effect.gen(function* () {
          const { gate, initial } = yield* setup;
          const update = (record: AssessmentRecord, coordinate: keyof typeof coordinates, input: string) =>
            arrows.updateAssessment({ record, coordinate, input, gate }).pipe(Effect.map((result) => result.record));
          const supportThenChallenges = yield* update(initial, "independentSupport", `${support}`).pipe(
            Effect.flatMap((record) => update(record, "openChallenges", `${challenges}`))
          );
          const challengesThenSupport = yield* update(initial, "openChallenges", `${challenges}`).pipe(
            Effect.flatMap((record) => update(record, "independentSupport", `${support}`))
          );
          const reviewThenSupport = yield* update(initial, "review", review).pipe(
            Effect.flatMap((record) => update(record, "independentSupport", `${support}`))
          );
          const supportThenReview = yield* update(initial, "independentSupport", `${support}`).pipe(
            Effect.flatMap((record) => update(record, "review", review))
          );
          expect(supportThenChallenges).toEqual(challengesThenSupport);
          expect(reviewThenSupport).toEqual(supportThenReview);
        }),
      { arbitrary: { runs: 60, seed: "party-l4-6-commute" } }
    );

    it.effect.prop(
      "L4-6 the party admission gate is monotone under the explicit owner order including ties",
      [S.Tuple([SupportCount, SupportCount, ChallengeCount, ChallengeCount, ReviewTag, S.Boolean])],
      ([[support, extraSupport, challenges, fewerChallenges, review, promote]]) =>
        Effect.gen(function* () {
          const { gate } = yield* setup;
          const lower = assessed(review, support, challenges);
          const upper = assessed(
            promote ? "Accepted" : review,
            support + extraSupport,
            Num.max(0, challenges - fewerChallenges)
          );
          if (lower.review._tag === "Assessed" && upper.review._tag === "Assessed")
            expect(gate.order.review(lower.review.value, upper.review.value)).toBeLessThanOrEqual(0);
          expect(!gate.passes(lower) || gate.passes(upper)).toBe(true);
        }),
      { arbitrary: { runs: 120, seed: "party-l4-6-monotone" } }
    );
  });
});
