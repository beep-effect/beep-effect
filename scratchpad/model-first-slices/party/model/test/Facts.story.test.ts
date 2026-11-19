import { streamOf } from "@alchemy.run/domain/Aggregate";
import { Story } from "@alchemy.run/domain/Story";
import { it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { type Invocation, provenanceOf } from "@proto/kernel/Invocation";
import { AcceptClaim, ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { ApproveProposal, ProposalApproved } from "@proto/party-contract/Claim/ApproveProposal.command";
import { ClaimAsserted } from "@proto/party-contract/Claim/AssertClaim.command";
import { ClaimNotPending } from "@proto/party-contract/Claim/ClaimNotPending.rejection";
import { proposalDigest } from "@proto/party-contract/Claim/ProposalDigest";
import { DispositionProposed, ProposeDisposition } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { ClaimRetracted, RetractClaim } from "@proto/party-contract/Claim/RetractClaim.command";
import { ReviewRequested } from "@proto/party-contract/Claim/ReviewRequested.event";
import { ClaimDecided, ClaimDecidedV1, ClaimDecidedV2 } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { PartyIntake, PartyPropose, PartyRead, PartyReview } from "@proto/party-contract/Party.capabilities";
import { Authority } from "@proto/party-model/Authority.external";
import { Claim } from "@proto/party-model/Claim/Claim.aggregate";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { PartyFacts2 } from "@proto/party-model/Facts/PartyFacts2.stream";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { reviewRun } from "@proto/party-model/Review/ReviewPlan";
import { ReviewRuns } from "@proto/party-model/Review/ReviewRuns.external";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { Cast, rolesOf } from "./Cast.ts";
import { agentRun, delegationOf, grantOf, member, onRecord, twoSources } from "./fixtures.ts";

const { given, provide, streamed, then, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns],
});

/** What a story says that no cast member is: a proposal's rationale and a retraction's reasons. */
const Words = S.Struct({
  rationale: DispositionProposed.fields.rationale,
  retraction: ClaimRetracted.fields.reason,
  again: ClaimRetracted.fields.reason,
});

/** Who acts, and on what, in a story over this cast. */
const sceneOf = (cast: Cast, words: typeof Words.Type) => {
  const roles = rolesOf(cast);
  const intake = member(roles.intake, roles.home, [PartyIntake, PartyPropose]);
  const reviewer = member(roles.reviewer, roles.home, [PartyReview, PartyRead]);
  const claim = Claim.ref(roles.claim);
  const run = reviewRun(roles.claim, 1);
  const proposition = cast.identifier;
  const proposal = { disposition: "accept" as const, rationale: words.rationale, run, evidenceRevision: 1 };
  const digest = proposalDigest(proposal);
  const asRun = agentRun(run, roles.intake, [
    onRecord({
      grant: grantOf(roles.intake, PartyPropose),
      delegation: O.some(delegationOf(run)),
      capability: PartyPropose,
      org: roles.home,
      record: streamOf(claim),
      operations: [ProposeDisposition.tag],
    }),
  ]);
  const signals = twoSources(cast);
  const asserted = given(
    claim,
    ClaimAsserted.make({ org: roles.home, proposition, signals, provenance: provenanceOf(intake) }),
    ReviewRequested.make({ run, org: roles.home, proposition, signals, evidenceRevision: 1, provenance: provenanceOf(intake) }),
  );
  const proposed = DispositionProposed.make({ ...proposal, digest, provenance: provenanceOf(asRun) });
  const common = { factId: ClaimDecided.factIdOf(roles.claim), claim: roles.claim, org: roles.home, reviewRuns: [run] };
  /** What each decision event carries since phase 9 (D43): the fact is built from it alone. */
  const scope = { org: O.some(roles.home), reviewRuns: O.some([run]) };
  return { reviewer, claim, run, proposition, digest, asserted, proposed, common, scope };
};

it.effect.prop("a claim decided directly publishes ClaimDecided once, in both versions, with no private field", [Cast, Words], ([cast, words]) => {
  const { reviewer, claim, proposition, asserted, common, scope } = sceneOf(cast, words);
  return story(
    asserted,
    as(reviewer),
    when(claim, AcceptClaim.make({})),
    then(claim, ClaimAccepted.make({ proposition, ...scope, provenance: provenanceOf(reviewer) })),
    streamed(
      PartyFacts2,
      "claims",
      ClaimDecidedV1.make({ ...common, outcome: "accepted" }),
      ClaimDecidedV2.make({ ...common, decision: "accepted", basis: "direct", approval: O.none() }),
    ),
  );
});

it.effect.prop("an approved proposal publishes the decision with its approval", [Cast, Words], ([cast, words]) => {
  const { reviewer, claim, run, proposition, digest, asserted, proposed, common, scope } = sceneOf(cast, words);
  return story(
    asserted,
    given(claim, proposed),
    as(reviewer),
    when(claim, ApproveProposal.make({ digest, evidenceRevision: 1 }), { commandId: cast.approval }),
    then(
      claim,
      ProposalApproved.make({
        approval: cast.approval,
        run,
        digest,
        evidenceRevision: 1,
        outcome: "accepted",
        proposition,
        corroboration: O.some(2),
        ...scope,
        provenance: provenanceOf(reviewer),
      }),
    ),
    streamed(
      PartyFacts2,
      "claims",
      ClaimDecidedV1.make({ ...common, outcome: "accepted" }),
      ClaimDecidedV2.make({ ...common, decision: "accepted", basis: "approval", approval: O.some(cast.approval) }),
    ),
  );
});

it.effect.prop("a retraction is a decision too; a rejected command publishes nothing", [Cast, Words], ([cast, words]) => {
  const { reviewer, claim, asserted, common, scope } = sceneOf(cast, words);
  return story(
    asserted,
    as(reviewer),
    when(claim, RetractClaim.make({ reason: words.retraction })),
    then(claim, ClaimRetracted.make({ reason: words.retraction, ...scope, provenance: provenanceOf(reviewer) })),
    streamed(
      PartyFacts2,
      "claims",
      ClaimDecidedV1.make({ ...common, outcome: "retracted" }),
      ClaimDecidedV2.make({ ...common, decision: "retracted", basis: "direct", approval: O.none() }),
    ),
    when(claim, RetractClaim.make({ reason: words.again })),
    Story.rejected(ClaimNotPending.make({ status: "Retracted" })),
    streamed(PartyFacts2, "claims"),
  );
});

// Decisions stored before phase 9 carry no scope. Generation 1 never published these two (its
// stream is empty here), so the org comes from the claim's state and the runs from the event.
const legacy = { org: O.none(), reviewRuns: O.none() };

it.effect.prop("a direct decision stored without a scope, never published: the org from the claim, no run", [Cast, Words], ([cast, words]) => {
  const { reviewer, claim, proposition, asserted, common } = sceneOf(cast, words);
  return story(
    asserted,
    given(claim, ClaimAccepted.make({ proposition, ...legacy, provenance: provenanceOf(reviewer) })),
    streamed(
      PartyFacts2,
      "claims",
      ClaimDecidedV1.make({ ...common, reviewRuns: [], outcome: "accepted" }),
      ClaimDecidedV2.make({ ...common, reviewRuns: [], decision: "accepted", basis: "direct", approval: O.none() }),
    ),
  );
});

it.effect.prop("an approval stored without a scope, never published: the org from the claim, the approved run", [Cast, Words], ([cast, words]) => {
  const { reviewer, claim, run, proposition, digest, asserted, proposed, common } = sceneOf(cast, words);
  return story(
    asserted,
    given(
      claim,
      proposed,
      ProposalApproved.make({
        approval: cast.approval,
        run,
        digest,
        evidenceRevision: 1,
        outcome: "retracted",
        proposition,
        corroboration: O.none(),
        ...legacy,
        provenance: provenanceOf(reviewer),
      }),
    ),
    streamed(
      PartyFacts2,
      "claims",
      ClaimDecidedV1.make({ ...common, outcome: "retracted" }),
      ClaimDecidedV2.make({ ...common, decision: "retracted", basis: "approval", approval: O.some(cast.approval) }),
    ),
  );
});
