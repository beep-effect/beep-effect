import { streamOf } from "@alchemy.run/domain/Aggregate";
import { Story } from "@alchemy.run/domain/Story";
import { it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { type Invocation, provenanceOf } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { AdmissionGateUnmet } from "@proto/party-contract/Claim/AcceptClaim.command";
import { AddEvidence } from "@proto/party-contract/Claim/AddEvidence.command";
import { ApproveProposal } from "@proto/party-contract/Claim/ApproveProposal.command";
import { AssertClaim, ClaimAlreadyAsserted, ClaimAsserted } from "@proto/party-contract/Claim/AssertClaim.command";
import { ClaimNotPending } from "@proto/party-contract/Claim/ClaimNotPending.rejection";
import { proposalDigest } from "@proto/party-contract/Claim/ProposalDigest";
import { DispositionProposed, ProposeDisposition } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { RequestReview } from "@proto/party-contract/Claim/RequestReview.command";
import { ClaimRetracted, RetractClaim } from "@proto/party-contract/Claim/RetractClaim.command";
import { PartyIntake, PartyPropose, PartyReview } from "@proto/party-contract/Party.capabilities";
import { PartyAlreadyRegistered, PartyRegistered, RegisterParty } from "@proto/party-contract/Party/RegisterParty.command";
import { Proposition } from "@proto/party-contract/Proposition";
import { Authority } from "@proto/party-model/Authority.external";
import { Claim } from "@proto/party-model/Claim/Claim.aggregate";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { Party } from "@proto/party-model/Party/Party.aggregate";
import { Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { reviewRun } from "@proto/party-model/Review/ReviewPlan";
import { ReviewRuns } from "@proto/party-model/Review/ReviewRuns.external";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { Cast, rolesOf } from "./Cast.ts";
import { agentRun, delegationOf, grantOf, member, oneSource, onRecord } from "./fixtures.ts";

// The outcomes the other stories leave unexecuted (`bun run outcomes`): each refusal a Party
// command declares, met by the caller it is meant for.
const { given, provide, rejected, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);
const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns],
});

/** What a story says that no cast member is: a proposal's rationale and a retraction's reasons. */
const Words = S.Struct({
  rationale: DispositionProposed.fields.rationale,
  retraction: ClaimRetracted.fields.reason,
  attempt: ClaimRetracted.fields.reason,
});

/** Who acts, and on what, in a story over this cast. */
const sceneOf = (cast: Cast, words: typeof Words.Type) => {
  const roles = rolesOf(cast);
  const intake = member(roles.intake, roles.home, [PartyIntake]);
  const reviewer = member(roles.reviewer, roles.home, [PartyReview]);
  const claim = Claim.ref(roles.claim);
  const run = reviewRun(roles.claim, 1);
  const sameParty = Proposition.cases.SameParty.make({ survivor: roles.survivor, absorbed: roles.absorbed });
  const asserted = ClaimAsserted.make({ org: roles.home, proposition: sameParty, signals: oneSource(cast), provenance: provenanceOf(intake) });
  const retracted = ClaimRetracted.make({
    reason: words.retraction,
    org: O.some(roles.home),
    reviewRuns: O.some([]),
    provenance: provenanceOf(reviewer),
  });
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
  const proposed = DispositionProposed.make({ ...proposal, digest, provenance: provenanceOf(asRun) });
  return { ...roles, intake, reviewer, claim, sameParty, asserted, retracted, digest, proposed };
};
const missing = (capability: typeof PartyIntake, operation: string) => rejected(MissingGrant.make({ capability: capability.id, operation }));

it.effect.prop("each claim command refuses a caller whose grants do not cover it", [Cast, Words], ([cast, words]) => {
  const { home, intake, reviewer, claim, otherClaim, sameParty, asserted } = sceneOf(cast, words);
  return story(
    as(reviewer),
    when(Claim.ref(otherClaim), AssertClaim.make({ org: home, proposition: sameParty, signals: oneSource(cast) })),
    missing(PartyIntake, AssertClaim.tag),
    given(claim, asserted),
    when(claim, AddEvidence.make({ signals: oneSource(cast) })),
    missing(PartyIntake, AddEvidence.tag),
    as(intake),
    when(claim, RetractClaim.make({ reason: words.attempt })),
    missing(PartyReview, RetractClaim.tag),
    when(claim, RequestReview.make({})),
    missing(PartyReview, RequestReview.tag),
    when(claim, AssertClaim.make({ org: home, proposition: sameParty, signals: oneSource(cast) })),
    rejected(ClaimAlreadyAsserted.make({})),
  );
});

it.effect.prop("approving an accept proposal still needs the admission gate", [Cast, Words], ([cast, words]) => {
  const { reviewer, claim, asserted, digest, proposed } = sceneOf(cast, words);
  return story(
    given(claim, asserted, proposed),
    as(reviewer),
    when(claim, ApproveProposal.make({ digest, evidenceRevision: 1 })),
    rejected(AdmissionGateUnmet.make({ gate: "independent-corroboration", have: 1, need: 2 })),
  );
});

it.effect.prop("a decided claim takes no more evidence, review or approval", [Cast, Words], ([cast, words]) => {
  const { intake, reviewer, claim, asserted, retracted, digest, proposed } = sceneOf(cast, words);
  return story(
    given(claim, asserted, proposed, retracted),
    as(intake),
    when(claim, AddEvidence.make({ signals: oneSource(cast) })),
    rejected(ClaimNotPending.make({ status: "Retracted" })),
    as(reviewer),
    when(claim, RequestReview.make({})),
    rejected(ClaimNotPending.make({ status: "Retracted" })),
    when(claim, ApproveProposal.make({ digest, evidenceRevision: 1 })),
    rejected(ClaimNotPending.make({ status: "Retracted" })),
  );
});

it.effect.prop("a party is registered once, and only under an intake grant", [Cast, Words], ([cast, words]) => {
  const { home, intake, reviewer, survivor } = sceneOf(cast, words);
  const party = Party.ref(survivor);
  const name = cast.names.survivor;
  return story(
    as(reviewer),
    when(party, RegisterParty.make({ org: home, name })),
    missing(PartyIntake, RegisterParty.tag),
    given(party, PartyRegistered.make({ org: home, name, provenance: provenanceOf(intake) })),
    as(intake),
    when(party, RegisterParty.make({ org: home, name })),
    rejected(PartyAlreadyRegistered.make({})),
  );
});
