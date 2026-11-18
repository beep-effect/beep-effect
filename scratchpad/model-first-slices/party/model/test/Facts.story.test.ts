import { Story } from "@alchemy.run/domain/Story";
import { it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { RunId } from "@proto/kernel/Ids";
import { type Invocation, provenanceOf } from "@proto/kernel/Invocation";
import { AcceptClaim, ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { ApprovalId } from "@proto/party-contract/Claim/Approval.id";
import { ApproveProposal, ProposalApproved } from "@proto/party-contract/Claim/ApproveProposal.command";
import { ClaimAsserted } from "@proto/party-contract/Claim/AssertClaim.command";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimNotPending } from "@proto/party-contract/Claim/ClaimNotPending.rejection";
import { proposalDigest } from "@proto/party-contract/Claim/ProposalDigest";
import { DispositionProposed } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { ClaimRetracted, RetractClaim } from "@proto/party-contract/Claim/RetractClaim.command";
import { ReviewRequested } from "@proto/party-contract/Claim/ReviewRequested.event";
import { ClaimDecidedV1, ClaimDecidedV2 } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { PartyIntake, PartyPropose, PartyRead, PartyReview } from "@proto/party-contract/Party.capabilities";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { Authority } from "@proto/party-model/Authority.external";
import { Claim } from "@proto/party-model/Claim/Claim.aggregate";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { PartyFacts2 } from "@proto/party-model/Facts/PartyFacts2.stream";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { ReviewRuns } from "@proto/party-model/Review/ReviewRuns.external";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { acme, agentRun, delegated, human, onOrg, twoSources } from "./fixtures.ts";

const { given, provide, streamed, then, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns],
});

const intake = human("p_intake", [onOrg("g_intake", PartyIntake, acme), onOrg("g_intake_propose", PartyPropose, acme)]);
const reviewer = human("p_rev", [onOrg("g_rev", PartyReview, acme), onOrg("g_rev_read", PartyRead, acme)]);
const claim = Claim.ref("claim_1");
const run1 = RunId.make("review:claim_1:1");
const hasIdentifier = Proposition.cases.HasIdentifier.make({
  party: PartyId.make("party_dana"),
  scheme: "email",
  value: "dana@acme.test",
});
const proposal = { disposition: "accept" as const, rationale: "two sources agree", run: run1, evidenceRevision: 1 };
const digest = proposalDigest(proposal);
const asRun = agentRun(run1, "p_intake", [
  delegated({
    grant: "g_intake_propose",
    delegation: `dlg:${run1}`,
    capability: PartyPropose,
    org: acme,
    record: "Claim/claim_1",
    operations: ["ProposeDisposition"],
  }),
]);

const asserted = given(
  claim,
  ClaimAsserted.make({ org: acme, proposition: hasIdentifier, signals: twoSources, provenance: provenanceOf(intake) }),
  ReviewRequested.make({
    run: run1,
    org: acme,
    proposition: hasIdentifier,
    signals: twoSources,
    evidenceRevision: 1,
    provenance: provenanceOf(intake),
  }),
);
const common = { factId: "claim_1:decided", claim: ClaimId.make("claim_1"), org: acme, reviewRuns: [run1] };
/** What each decision event carries since phase 9 (D43): the fact is built from it alone. */
const scope = { org: O.some(acme), reviewRuns: O.some([run1]) };

it.effect("a claim decided directly publishes ClaimDecided once, in both versions, with no private field", () =>
  story(
    asserted,
    as(reviewer),
    when(claim, AcceptClaim.make({})),
    then(claim, ClaimAccepted.make({ proposition: hasIdentifier, ...scope, provenance: provenanceOf(reviewer) })),
    streamed(
      PartyFacts2,
      "claims",
      ClaimDecidedV1.make({ ...common, outcome: "accepted" }),
      ClaimDecidedV2.make({ ...common, decision: "accepted", basis: "direct", approval: O.none() }),
    ),
  ),
);

it.effect("an approved proposal publishes the decision with its approval", () =>
  story(
    asserted,
    given(claim, DispositionProposed.make({ ...proposal, digest, provenance: provenanceOf(asRun) })),
    as(reviewer),
    when(claim, ApproveProposal.make({ digest, evidenceRevision: 1 }), { commandId: "approval_1" }),
    then(
      claim,
      ProposalApproved.make({
        approval: ApprovalId.make("approval_1"),
        run: run1,
        digest,
        evidenceRevision: 1,
        outcome: "accepted",
        proposition: hasIdentifier,
        corroboration: O.some(2),
        ...scope,
        provenance: provenanceOf(reviewer),
      }),
    ),
    streamed(
      PartyFacts2,
      "claims",
      ClaimDecidedV1.make({ ...common, outcome: "accepted" }),
      ClaimDecidedV2.make({
        ...common,
        decision: "accepted",
        basis: "approval",
        approval: ApprovalId.makeOption("approval_1"),
      }),
    ),
  ),
);

it.effect("a retraction is a decision too; a rejected command publishes nothing", () =>
  story(
    asserted,
    as(reviewer),
    when(claim, RetractClaim.make({ reason: "wrong person" })),
    then(claim, ClaimRetracted.make({ reason: "wrong person", ...scope, provenance: provenanceOf(reviewer) })),
    streamed(
      PartyFacts2,
      "claims",
      ClaimDecidedV1.make({ ...common, outcome: "retracted" }),
      ClaimDecidedV2.make({ ...common, decision: "retracted", basis: "direct", approval: O.none() }),
    ),
    when(claim, RetractClaim.make({ reason: "again" })),
    Story.rejected(ClaimNotPending.make({ status: "Retracted" })),
    streamed(PartyFacts2, "claims"),
  ),
);

// Decisions stored before phase 9 carry no scope. Generation 1 never published these two (its
// stream is empty here), so the org comes from the claim's state and the runs from the event.
const legacy = { org: O.none(), reviewRuns: O.none() };

it.effect("a direct decision stored without a scope, never published: the org from the claim, no run", () =>
  story(
    asserted,
    given(claim, ClaimAccepted.make({ proposition: hasIdentifier, ...legacy, provenance: provenanceOf(reviewer) })),
    streamed(
      PartyFacts2,
      "claims",
      ClaimDecidedV1.make({ ...common, reviewRuns: [], outcome: "accepted" }),
      ClaimDecidedV2.make({ ...common, reviewRuns: [], decision: "accepted", basis: "direct", approval: O.none() }),
    ),
  ),
);

it.effect("an approval stored without a scope, never published: the org from the claim, the approved run", () =>
  story(
    asserted,
    given(
      claim,
      DispositionProposed.make({ ...proposal, digest, provenance: provenanceOf(asRun) }),
      ProposalApproved.make({
        approval: ApprovalId.make("approval_1"),
        run: run1,
        digest,
        evidenceRevision: 1,
        outcome: "retracted",
        proposition: hasIdentifier,
        corroboration: O.none(),
        ...legacy,
        provenance: provenanceOf(reviewer),
      }),
    ),
    streamed(
      PartyFacts2,
      "claims",
      ClaimDecidedV1.make({ ...common, outcome: "retracted" }),
      ClaimDecidedV2.make({
        ...common,
        decision: "retracted",
        basis: "approval",
        approval: ApprovalId.makeOption("approval_1"),
      }),
    ),
  ),
);
