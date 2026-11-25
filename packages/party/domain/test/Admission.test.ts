import {
  AdmissionClause,
  AdmissionEvidence,
  AdmissionPolicy,
  AdmissionTier,
  admit,
  independentSupportCount,
  SupportCountInput,
  SupportFacts,
} from "@beep/party-domain/Admission";
import {
  ClaimEvidenceLinks,
  ClaimLedger,
  ClaimReviewRecord,
  DependenceAssessment,
  mergeClaimLedgers,
  ReviewState,
  readClaims,
} from "@beep/party-domain/Claim";
import { ActivityId, AssertionId } from "@beep/party-domain/Ids";
import { Proposition } from "@beep/party-domain/Proposition";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import * as TestUtils from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { AcmeFixture, AcmeFixtureLive, at } from "./fixtures/acme.ts";
import { partyClaim } from "./fixtures/claims.ts";
import type { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import type { Admitted } from "@beep/party-domain/Admission";

const a = AssertionId.make("party-asrt:a");
const b = AssertionId.make("party-asrt:b");
const c = AssertionId.make("party-asrt:c");
const readAt = (ledger: ClaimLedger, claim: ClaimId, asOf: number) =>
  O.getOrThrow(A.findFirst(readClaims(ledger, at(asOf)), (row) => row.record.claim === claim));
const linksAt = (
  claim: ClaimId,
  recordedAt: number,
  supportedBy: ReadonlyArray<AssertionId>,
  challengedBy: ReadonlyArray<AssertionId>
) =>
  ClaimLedger.make({ evidence: [ClaimEvidenceLinks.make({ claim, at: at(recordedAt), supportedBy, challengedBy })] });
const independent = (left: AssertionId, right: AssertionId) =>
  DependenceAssessment.make({
    left,
    right,
    dependence: "independent",
    basis: "Different witnesses and systems",
    producedBy: ActivityId.make("party-act:dependence-review"),
  });

describe("independent evidence and admission tiers", () => {
  it("conservatively groups missing dependence evidence and deduplicates support", () => {
    expect(
      independentSupportCount(
        SupportCountInput.make({ supports: [a, b, a], dependence: [], unknownCountsAs: "dependent" })
      )
    ).toBe(1);
    expect(
      independentSupportCount(
        SupportCountInput.make({ supports: [a, b, a], dependence: [], unknownCountsAs: "independent" })
      )
    ).toBe(2);
    expect(
      independentSupportCount(
        SupportCountInput.make({
          supports: [a, b, c],
          dependence: [independent(a, c), independent(b, c)],
          unknownCountsAs: "dependent",
        })
      )
    ).toBe(2);
  });
  it("does not type a client-facing proof as deposition-ready", () => {
    expectTypeOf<Admitted<"client-facing">>().not.toExtend<Admitted<"deposition-ready">>();
  });
  it.layer(AcmeFixtureLive, { timeout: "30 seconds" })("adversarial-source corroboration", (it) => {
    it.effect("rejects unaccepted or challenged evidence and exposes the minted proof tier", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        const policy = AdmissionPolicy.make({
          id: "reviewed-and-uncontested",
          version: "1",
          tier: "client-facing",
          clauses: [
            AdmissionClause.cases.RequireReviewerAcceptance.make({}),
            AdmissionClause.cases.NoOpenChallenge.make({}),
          ],
        });
        const evidence = AdmissionEvidence.make({
          claim: readAt(fx.ledger, fx.averyAuthorship.claim, 20),
          supports: [],
          dependence: [],
        });
        const proof = Result.getOrThrow(admit({ policy, evidence, knowledgeTime: at(20) }));
        expect(proof.provenTier).toBe("client-facing");
        const refused = admit({
          policy,
          knowledgeTime: at(20),
          evidence: AdmissionEvidence.make({
            ...evidence,
            claim: readAt(
              mergeClaimLedgers([
                fx.ledger,
                linksAt(fx.averyAuthorship.claim, 15, [], [a]),
                ClaimLedger.make({
                  reviews: [
                    ClaimReviewRecord.make({
                      claim: fx.averyAuthorship.claim,
                      at: at(15),
                      review: ReviewState.cases.Proposed.make({}),
                    }),
                  ],
                }),
              ]),
              fx.averyAuthorship.claim,
              20
            ),
          }),
        });
        pipe(refused, Result.isFailure, TestUtils.assertTrue);
        if (Result.isFailure(refused))
          expect(A.map(refused.failure.unmet, (row) => row.clause._tag)).toEqual([
            "RequireReviewerAcceptance",
            "NoOpenChallenge",
          ]);
      })
    );
    it.effect("requires independent testimony outside one interested production", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        const policy = {
          ...AdmissionPolicy.make({
            id: "outside-source",
            version: "1",
            tier: "deposition-ready",
            clauses: [
              AdmissionClause.cases.MinIndependentSupport.make({ n: 2, unknownCountsAs: "dependent" }),
              AdmissionClause.cases.RequireSupportOutsideSide.make({ side: "adversary-production" }),
            ],
          }),
          tier: AdmissionTier.Enum["deposition-ready"],
        };
        const claim = readAt(
          mergeClaimLedgers([fx.ledger, linksAt(fx.averyAuthorship.claim, 15, [a, b, c], [])]),
          fx.averyAuthorship.claim,
          20
        );
        const evidence = AdmissionEvidence.make({
          claim,
          supports: [
            SupportFacts.make({ assertion: a, side: "adversary-production", kind: "distinctive-behavior" }),
            SupportFacts.make({ assertion: b, side: "adversary-production", kind: "distinctive-behavior" }),
          ],
          dependence: [],
        });
        const refused = admit({ policy, evidence, knowledgeTime: at(20) });
        pipe(refused, Result.isFailure, TestUtils.assertTrue);
        if (Result.isFailure(refused))
          expect(A.map(refused.failure.unmet, (row) => row.clause._tag)).toEqual([
            "MinIndependentSupport",
            "RequireSupportOutsideSide",
          ]);
        const corroborated = AdmissionEvidence.make({
          ...evidence,
          supports: [
            ...evidence.supports,
            SupportFacts.make({ assertion: c, side: "third-party-production", kind: "distinctive-behavior" }),
          ],
          dependence: [independent(a, c), independent(b, c)],
        });
        pipe(admit({ policy, evidence: corroborated, knowledgeTime: at(20) }), Result.isSuccess, TestUtils.assertTrue);
      })
    );
  });
});

it.layer(Digest.layerWebCrypto)("joined admission coordinates", (it) => {
  it.effect("refuses absent review, absent evidence links and a knowledge time outside the selected interval", () =>
    Effect.gen(function* () {
      const proposition = Proposition.cases.SameParty.make({ left: PartyId.make(1), right: PartyId.make(2) });
      const original = yield* partyClaim({ proposition, knowledgeStart: 1, review: O.none(), supportedBy: [a] });
      const successor = yield* partyClaim({ proposition, knowledgeStart: 5, supersedes: original.claim });
      const ledger = mergeClaimLedgers([ClaimLedger.make({ ...original.ledger, evidence: [] }), successor.ledger]);
      const policy = AdmissionPolicy.make({
        id: "joined",
        version: "1",
        tier: "client-facing",
        clauses: [
          AdmissionClause.cases.RequireReviewerAcceptance.make({}),
          AdmissionClause.cases.NoOpenChallenge.make({}),
        ],
      });
      const evidence = AdmissionEvidence.make({
        claim: readAt(ledger, original.claim, 3),
        supports: [SupportFacts.make({ assertion: a, side: "client-file", kind: "distinctive-behavior" })],
        dependence: [],
      });
      const refused = admit({ policy, evidence, knowledgeTime: at(5) });
      pipe(refused, Result.isFailure, TestUtils.assertTrue);
      if (Result.isFailure(refused))
        expect(A.map(refused.failure.unmet, (row) => [row.clause._tag, row.saw])).toEqual([
          ["SupportsInVersion", "source evidence links are unavailable"],
          ["KnownAtKnowledgeTime", `version ${original.claim} is not known at ${at(5)}`],
          ["RequireReviewerAcceptance", "review is unassessed"],
          ["NoOpenChallenge", "source challenges are open or unavailable"],
        ]);
      const reviewed = AdmissionEvidence.make({ ...evidence, claim: readAt(ledger, successor.claim, 5) });
      pipe(admit({ policy, evidence: reviewed, knowledgeTime: at(4) }), Result.isFailure, TestUtils.assertTrue);
      const outside = admit({ policy, evidence: reviewed, knowledgeTime: at(5) });
      pipe(outside, Result.isFailure, TestUtils.assertTrue);
      if (Result.isFailure(outside))
        expect(A.map(outside.failure.unmet, (row) => row.saw)).toEqual([
          "1 support(s) not in the version's supportedBy",
        ]);
    })
  );
  it.effect("refuses review and evidence links recorded after the knowledge time", () =>
    Effect.gen(function* () {
      const proposition = Proposition.cases.SameParty.make({ left: PartyId.make(1), right: PartyId.make(2) });
      const original = yield* partyClaim({ proposition, knowledgeStart: 1, supportedBy: [a] });
      const policy = AdmissionPolicy.make({
        id: "known-events",
        version: "1",
        tier: "client-facing",
        clauses: [AdmissionClause.cases.RequireReviewerAcceptance.make({})],
      });
      const later = (ledger: ClaimLedger) =>
        AdmissionEvidence.make({
          claim: readAt(mergeClaimLedgers([original.ledger, ledger]), original.claim, 20),
          supports: [SupportFacts.make({ assertion: a, side: "client-file", kind: "distinctive-behavior" })],
          dependence: [],
        });
      const sawAt = (evidence: AdmissionEvidence, knowledgeTime: number) =>
        Result.match(admit({ policy, evidence, knowledgeTime: at(knowledgeTime) }), {
          onFailure: (refused) => A.map(refused.unmet, (row) => [row.clause._tag, row.saw]),
          onSuccess: () => [],
        });
      const reviewed = later(
        ClaimLedger.make({
          reviews: [
            ClaimReviewRecord.make({
              claim: original.claim,
              at: at(15),
              review: O.getOrThrow(A.head(original.ledger.reviews)).review,
            }),
          ],
        })
      );
      const expected = [["KnownAtKnowledgeTime", `version ${original.claim} carries events recorded after ${at(10)}`]];
      expect(sawAt(reviewed, 10)).toEqual(expected);
      expect(sawAt(reviewed, 15)).toEqual([]);
      const linked = later(linksAt(original.claim, 15, [a], []));
      expect(sawAt(linked, 10)).toEqual(expected);
      expect(sawAt(later(ClaimLedger.make({})), 10)).toEqual([]);
    })
  );
});
