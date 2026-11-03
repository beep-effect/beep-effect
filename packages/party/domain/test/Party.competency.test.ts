import { StructuralVerdict } from "@beep/epistemics/Claim";
import {
  AdmissionClause,
  AdmissionEvidence,
  AdmissionPolicy,
  AdmissionTier,
  admit,
  depositionOutlineEntry,
  SupportFacts,
} from "@beep/party-domain/Admission";
import { ClaimVersion, ReviewState } from "@beep/party-domain/Claim";
import { CommunicationEvent, isDelegated, voiceOf } from "@beep/party-domain/Communication";
import { assessOperational, divergences } from "@beep/party-domain/Hierarchy";
import { AccountId, ActivityId, AssertionId, ClaimVersionId } from "@beep/party-domain/Ids";
import {
  attributeEvents,
  chainOfCommand,
  declaredHierarchyCycle,
  declaredLines,
  identityView,
  orgGraph,
  orgMermaid,
  ProjectionScope,
  selectorGraph,
  selectorReach,
} from "@beep/party-domain/Projection";
import { logicalKey, Proposition, partiesOf } from "@beep/party-domain/Proposition";
import { EvidenceAnchor } from "@beep/party-domain/Provenance";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { AcmeFixture, AcmeFixtureLive, at, email, ids } from "./fixtures/acme.ts";

const scope = (asOf = 20, validAt = 100) =>
  ProjectionScope.make({ asOf: at(asOf), validAt: at(validAt), states: ["Accepted"] });

describe("party model competency questions", () => {
  it("rejects identity/category mistakes and invalid evidence spans", () => {
    expect(
      Result.isFailure(
        S.decodeUnknownResult(Proposition)({ _tag: "AccountControl", account: 1, controller: 1, relation: "used-by" })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        S.decodeResult(EvidenceAnchor)({
          _tag: "TextSpan",
          occurrence: "party-occ:synthetic",
          textDigest: "feedface",
          start: 8,
          end: 3,
          quote: "synthetic",
        })
      )
    ).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(CommunicationEvent)({ participants: [] }))).toBe(true);
  });

  it("distinguishes structural gates from reviewer acceptance and rejects self-reporting", () => {
    expect(Result.isSuccess(S.decodeResult(StructuralVerdict)({ _tag: "Admitted" }))).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(ReviewState)({ _tag: "Admitted" }))).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(ReviewState)({ _tag: "Accepted" }))).toBe(true);
    expect(
      Result.isFailure(
        S.decodeResult(Proposition)({ _tag: "ReportsTo", subordinate: 1, superior: 1, organization: null })
      )
    ).toBe(true);
    expect(
      partiesOf(Proposition.cases.MailboxKind.make({ account: AccountId.make("party-acct:shared"), kind: "shared" }))
    ).toEqual([]);
  });

  it("rejects two From participants in an otherwise valid message", () => {
    expect(
      Result.isFailure(
        S.decodeResult(CommunicationEvent)({
          id: "party-evt:double-from",
          occurrence: "party-occ:message",
          channel: "email",
          sentAt: null,
          messageId: null,
          conversationKey: null,
          participants: [
            { role: "from", identifier: "party-ident:a", observation: "party-obs:a" },
            { role: "from", identifier: "party-ident:b", observation: "party-obs:b" },
          ],
        })
      )
    ).toBe(true);
  });

  it.layer(AcmeFixtureLive)("synthetic Acme evidence", (it) => {
    it.effect("separates delegated authorship from the displayed from address", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        expect(isDelegated(voiceOf(fx.eventNo(2)))).toBe(true);
        expect(isDelegated(voiceOf(fx.eventNo(1)))).toBe(false);
        expect(voiceOf(fx.eventNo(4)).id).toBe(voiceOf(fx.eventNo(6)).id);
        const view = identityView({ ledger: fx.ledger, scope: scope() });
        const attributed = attributeEvents({ events: [fx.eventNo(2)], observations: fx.observations, view });
        expect(O.getOrThrow(O.getOrThrow(A.head(attributed)).author)).toBe(ids.avery);
      })
    );

    it.effect("corrects shared-mailbox attribution without rewriting history", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        const before = identityView({ ledger: fx.ledger, scope: scope(18) });
        const after = identityView({ ledger: fx.ledger, scope: scope(19) });
        expect(O.getOrThrow(HashMap.get(before.partyOfIdentifier, email("finance")))).toBe(ids.maya);
        expect(O.isNone(HashMap.get(after.partyOfIdentifier, email("finance")))).toBe(true);
        const attributed = attributeEvents({ events: [fx.eventNo(1)], observations: fx.observations, view: after });
        expect(O.flatMap(A.head(attributed), (event) => event.author)).toEqual(O.none());
      })
    );

    it.effect("keeps a reassigned phone separate across valid time, including the gap", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        const owner = (validAt: number) =>
          HashMap.get(identityView({ ledger: fx.ledger, scope: scope(20, validAt) }).partyOfIdentifier, fx.phone);
        expect(O.getOrThrow(owner(39))).toBe(ids.jordan);
        expect(O.isNone(owner(40))).toBe(true);
        expect(O.isNone(owner(59))).toBe(true);
        expect(O.getOrThrow(owner(60))).toBe(ids.riley);
      })
    );

    it.effect("does not merge homonyms through an intermediate duplicate", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        const view = identityView({ ledger: fx.ledger, scope: scope() });
        expect(view.representative(ids.chrisDuplicate)).toBe(ids.chrisA);
        expect(view.representative(ids.chrisB)).toBe(ids.chrisB);
        expect(A.flatMap(view.reviewCases, (row) => row.vetoClaims)).toEqual(["party-cv:distinct:chris-a-b"]);
      })
    );

    it.effect("treats a shared personal selector as ambiguous instead of picking an owner", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        const replacement = Proposition.cases.IdentifierOf.make({
          identifier: email("finance"),
          party: ids.riley,
          relation: "used-by",
        });
        const alternative = ClaimVersion.make({
          ...fx.financeV1,
          id: fx.financeV2.id,
          proposition: replacement,
          logicalKey: logicalKey(replacement),
        });
        const view = identityView({ ledger: [fx.financeV1, alternative], scope: scope(18) });
        expect(O.isNone(HashMap.get(view.partyOfIdentifier, email("finance")))).toBe(true);
      })
    );

    it.effect("distinguishes operational leads, declared authority and collection gaps", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        const view = identityView({ ledger: fx.ledger, scope: scope() });
        const declared = declaredLines({ ledger: fx.ledger, scope: scope(), view });
        const custodians = HashSet.make(ids.maya, ids.jordan, ids.avery, ids.dana, ids.sam, ids.riley, ids.quinn);
        const operational = assessOperational({
          events: attributeEvents({ events: fx.events, observations: fx.observations, view }),
          producedBy: ActivityId.make("party-act:assessor"),
          custodians,
        });
        const leads = divergences({ declared, operational, custodians, shadowGateMinimum: 2 });
        expect(A.some(leads, (row) => row._tag === "InvertedAuthority")).toBe(true);
        expect(A.some(leads, (row) => row._tag === "ShadowGate")).toBe(true);
        expect(
          A.sort(
            A.map(leads, (row) => row._tag),
            Order.String
          )
        ).toEqual([
          "CoverageGap",
          "InvertedAuthority",
          "PhantomManager",
          "PhantomManager",
          "PhantomManager",
          "ShadowGate",
        ]);
        expect(
          O.map(
            A.findFirst(leads, (row) => row._tag === "ShadowGate"),
            (row) => row.party
          )
        ).toEqual(O.some(ids.sam));
        expect(
          O.map(
            A.findFirst(leads, (row) => row._tag === "CoverageGap"),
            (row) => row.party
          )
        ).toEqual(O.some(ids.pat));
        const org = orgGraph({ ledger: fx.ledger, scope: scope(), view });
        expect(chainOfCommand({ org, party: ids.sam })).toEqual([ids.dana, ids.pat]);
        expect(O.isNone(declaredHierarchyCycle(org))).toBe(true);
        expect(
          HashMap.size(selectorReach({ selectors: selectorGraph(fx.events), seed: email("riley"), hops: 2 }))
        ).toBeGreaterThan(0);
      })
    );

    it.effect("preserves selector hop distances and graph counts without attributing people", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        const selectors = selectorGraph(fx.events);
        expect(Graph.nodeCount(selectors.graph)).toBe(7);
        expect(Graph.edgeCount(selectors.graph)).toBe(10);
        const reach = selectorReach({ selectors, seed: email("riley"), hops: 2 });
        expect(HashMap.get(reach, email("sam"))).toEqual(O.some(1));
        expect(HashMap.get(reach, email("dana"))).toEqual(O.some(1));
        expect(HashMap.get(reach, email("quinn"))).toEqual(O.some(2));
        expect(HashMap.get(reach, email("pat"))).toEqual(O.some(2));
        expect(HashMap.get(reach, email("riley"))).toEqual(O.none());
      })
    );

    it.effect("surfaces contradictory reporting cycles and renders declared lines", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        const view = identityView({ ledger: fx.ledger, scope: scope() });
        const org = orgGraph({ ledger: fx.ledger, scope: scope(), view });
        const mermaid = orgMermaid({ org, label: (party) => `Party ${party}` });
        expect(mermaid).toContain("reports-to");
        expect(mermaid).toContain(`Party ${ids.sam}`);
        const proposition = Proposition.cases.ReportsTo.make({
          subordinate: ids.pat,
          superior: ids.sam,
          organization: O.some(ids.acme),
        });
        const contradiction = ClaimVersion.make({
          ...fx.averyAuthorship,
          id: ClaimVersionId.make("party-cv:contradictory-hierarchy"),
          proposition,
          logicalKey: logicalKey(proposition),
        });
        const cycle = declaredHierarchyCycle(orgGraph({ ledger: [...fx.ledger, contradiction], scope: scope(), view }));
        expect(O.map(cycle, (parties) => A.contains(parties, ids.sam))).toEqual(O.some(true));
      })
    );

    it.effect("requires reviewer and distinctive evidence for strong admission", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        const policy = {
          ...AdmissionPolicy.make({
            id: "deposition",
            version: "v1",
            tier: "deposition-ready",
            clauses: [
              AdmissionClause.cases.RequireReviewerAcceptance.make({}),
              AdmissionClause.cases.RequireDistinctiveEvidence.make({}),
              AdmissionClause.cases.NoOpenChallenge.make({}),
            ],
          }),
          tier: AdmissionTier.Enum["deposition-ready"],
        };
        const evidence = AdmissionEvidence.make({
          version: fx.averyAuthorship,
          supports: [
            SupportFacts.make({ assertion: fx.assertion.id, side: "client-file", kind: "distinctive-behavior" }),
          ],
          dependence: [],
        });
        const accepted = admit({ policy, evidence, knowledgeTime: at(20) });
        expect(Result.isSuccess(accepted)).toBe(true);
        if (Result.isSuccess(accepted))
          expect(depositionOutlineEntry({ admitted: accepted.success, note: "Synthetic evidence" }).claimVersion).toBe(
            fx.averyAuthorship.id
          );
        const weak = AdmissionEvidence.make({
          ...evidence,
          supports: [SupportFacts.make({ assertion: fx.assertion.id, side: "client-file", kind: "shared-template" })],
        });
        expect(Result.isFailure(admit({ policy, evidence: weak, knowledgeTime: at(20) }))).toBe(true);
        expect(Result.isFailure(admit({ policy, evidence, knowledgeTime: at(9) }))).toBe(true);
        const foreign = AdmissionEvidence.make({
          ...evidence,
          supports: [
            SupportFacts.make({
              assertion: AssertionId.make("party-asrt:foreign"),
              side: "client-file",
              kind: "distinctive-behavior",
            }),
          ],
        });
        expect(Result.isFailure(admit({ policy, evidence: foreign, knowledgeTime: at(20) }))).toBe(true);
      })
    );
  });
});
