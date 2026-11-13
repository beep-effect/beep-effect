import { Story } from "@alchemy.run/domain/Story";
import { it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { RunId } from "@proto/kernel/Ids";
import { type Invocation, provenanceOf } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { AdmissionGateUnmet } from "@proto/party-contract/Claim/AcceptClaim.command";
import { AddEvidence } from "@proto/party-contract/Claim/AddEvidence.command";
import { ApproveProposal } from "@proto/party-contract/Claim/ApproveProposal.command";
import { AssertClaim, ClaimAlreadyAsserted, ClaimAsserted } from "@proto/party-contract/Claim/AssertClaim.command";
import { ClaimNotPending } from "@proto/party-contract/Claim/ClaimNotPending.rejection";
import { proposalDigest } from "@proto/party-contract/Claim/ProposalDigest";
import { DispositionProposed } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { RequestReview } from "@proto/party-contract/Claim/RequestReview.command";
import { ClaimRetracted, RetractClaim } from "@proto/party-contract/Claim/RetractClaim.command";
import { PartyIntake, PartyPropose, PartyReview } from "@proto/party-contract/Party.capabilities";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { PartyAlreadyRegistered, PartyRegistered, RegisterParty } from "@proto/party-contract/Party/RegisterParty.command";
import { Proposition } from "@proto/party-contract/Proposition";
import { Authority } from "@proto/party-model/Authority.external";
import { Claim } from "@proto/party-model/Claim/Claim.aggregate";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { Party } from "@proto/party-model/Party/Party.aggregate";
import { Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { ReviewRuns } from "@proto/party-model/Review/ReviewRuns.external";
import * as Layer from "effect/Layer";
import { acme, agentRun, delegated, human, onOrg, oneSource } from "./fixtures.ts";

// The outcomes the other stories leave unexecuted (`bun run outcomes`): each refusal a Party
// command declares, met by the caller it is meant for.
const { given, provide, rejected, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);
const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns],
});

const intake = human("p_intake", [onOrg("g_intake", PartyIntake, acme)]);
const reviewer = human("p_rev", [onOrg("g_rev", PartyReview, acme)]);
const claim = Claim.ref("claim_1");
const run1 = RunId.make("review:claim_1:1");
const sameParty = Proposition.cases.SameParty.make({ survivor: PartyId.make("party_a"), absorbed: PartyId.make("party_b") });
const asserted = new ClaimAsserted({ org: acme, proposition: sameParty, signals: oneSource, provenance: provenanceOf(intake) });
const retracted = new ClaimRetracted({ reason: "wrong", provenance: provenanceOf(reviewer) });
const proposal = { disposition: "accept" as const, rationale: "same phone", run: run1, evidenceRevision: 1 };
const digest = proposalDigest(proposal);
const asRun = agentRun(run1, "p_intake", [delegated("g_p", `dlg:${run1}`, PartyPropose, acme, "Claim/claim_1", ["ProposeDisposition"])]);
const missing = (capability: typeof PartyIntake, operation: string) => rejected(new MissingGrant({ capability: capability.id, operation }));

it.effect("each claim command refuses a caller whose grants do not cover it", () =>
  story(
    as(reviewer),
    when(Claim.ref("claim_2"), new AssertClaim({ org: acme, proposition: sameParty, signals: oneSource })),
    missing(PartyIntake, "AssertClaim"),
    given(claim, asserted),
    when(claim, new AddEvidence({ signals: oneSource })),
    missing(PartyIntake, "AddEvidence"),
    as(intake),
    when(claim, new RetractClaim({ reason: "x" })),
    missing(PartyReview, "RetractClaim"),
    when(claim, new RequestReview()),
    missing(PartyReview, "RequestReview"),
    when(claim, new AssertClaim({ org: acme, proposition: sameParty, signals: oneSource })),
    rejected(new ClaimAlreadyAsserted()),
  ),
);

it.effect("approving an accept proposal still needs the admission gate", () =>
  story(
    given(claim, asserted, new DispositionProposed({ ...proposal, digest, provenance: provenanceOf(asRun) })),
    as(reviewer),
    when(claim, new ApproveProposal({ digest, evidenceRevision: 1 })),
    rejected(new AdmissionGateUnmet({ gate: "independent-corroboration", have: 1, need: 2 })),
  ),
);

it.effect("a decided claim takes no more evidence, review or approval", () =>
  story(
    given(claim, asserted, new DispositionProposed({ ...proposal, digest, provenance: provenanceOf(asRun) }), retracted),
    as(intake),
    when(claim, new AddEvidence({ signals: oneSource })),
    rejected(new ClaimNotPending({ status: "Retracted" })),
    as(reviewer),
    when(claim, new RequestReview()),
    rejected(new ClaimNotPending({ status: "Retracted" })),
    when(claim, new ApproveProposal({ digest, evidenceRevision: 1 })),
    rejected(new ClaimNotPending({ status: "Retracted" })),
  ),
);

it.effect("a party is registered once, and only under an intake grant", () =>
  story(
    as(reviewer),
    when(Party.ref("party_a"), new RegisterParty({ org: acme, name: "Dana" })),
    missing(PartyIntake, "RegisterParty"),
    given(Party.ref("party_a"), new PartyRegistered({ org: acme, name: "Dana", provenance: provenanceOf(intake) })),
    as(intake),
    when(Party.ref("party_a"), new RegisterParty({ org: acme, name: "Dana" })),
    rejected(new PartyAlreadyRegistered()),
  ),
);
