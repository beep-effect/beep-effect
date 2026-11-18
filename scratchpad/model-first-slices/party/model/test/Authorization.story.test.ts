import { streamOf } from "@alchemy.run/domain/Aggregate";
import { Story } from "@alchemy.run/domain/Story";
import { it } from "@effect/vitest";
import { CapabilityGrant, ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { byProcess, Cause, extend, type Invocation, provenanceOf } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { AcceptClaim, ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { ClaimAsserted } from "@proto/party-contract/Claim/AssertClaim.command";
import { NotAnAgent, ProposeDisposition } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { PartyIntake, PartyPropose, PartyRead, PartyReview } from "@proto/party-contract/Party.capabilities";
import { PartyRegistered } from "@proto/party-contract/Party/RegisterParty.command";
import { Proposition } from "@proto/party-contract/Proposition";
import { Claim } from "@proto/party-model/Claim/Claim.aggregate";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { MergeOnSameParty } from "@proto/party-model/Party/MergeOnSameParty.policy";
import { Party } from "@proto/party-model/Party/Party.aggregate";
import { Assessment, Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { ReviewRuns } from "@proto/party-model/Review/ReviewRuns.external";
import { Authority } from "@proto/party-model/Authority.external";
import { MergeRefused, MergeRefusal } from "@proto/party-contract/Claim/RecordMergeRefused.command";
import * as DateTime from "effect/DateTime";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { Cast, rolesOf } from "./Cast.ts";
import { grantOf, human, member, onOrg, onRecord, readmitted, twoSources } from "./fixtures.ts";
import * as O from "@beep/utils/Option";

const { call, clock, given, provide, rejected, succeed, then, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns],
});

/** Who acts, and on what, in a story over this cast. */
const sceneOf = (cast: Cast) => {
  const roles = rolesOf(cast);
  const intake = member(roles.intake, roles.home, [PartyIntake]);
  const claim = Claim.ref(roles.claim);
  const otherClaim = Claim.ref(roles.otherClaim);
  const survivor = Party.ref(roles.survivor);
  const absorbed = Party.ref(roles.absorbed);
  const sameParty = Proposition.cases.SameParty.make({ survivor: survivor.id, absorbed: absorbed.id });
  const asserted = ClaimAsserted.make({ org: roles.home, proposition: sameParty, signals: twoSources(cast), provenance: provenanceOf(intake) });
  /** The scope a decision on this claim carries: its org, and no review run (its history asked for none). */
  const unreviewed = { org: O.some(roles.home), reviewRuns: O.some([]) };
  const mergeHop = byProcess(MergeOnSameParty.policyName, Cause.cases.Event.make({ stream: streamOf(claim), seq: 2, event: ClaimAccepted.tag }));
  const registered = [
    given(survivor, PartyRegistered.make({ org: roles.home, name: cast.names.survivor, provenance: provenanceOf(intake) })),
    given(absorbed, PartyRegistered.make({ org: roles.home, name: cast.names.absorbed, provenance: provenanceOf(intake) })),
  ];
  /** The merge the policy sends for the accept, re-admitted under `reviewer`'s own grants, refused and recorded. */
  const mergeRefused = (reviewer: Invocation) => [
    call(Authority.readmit, { provenance: provenanceOf(reviewer), hop: mergeHop }),
    succeed(Authority.readmit, readmitted(reviewer, mergeHop)),
    then(
      claim,
      MergeRefused.make({ reason: MergeRefusal.cases.MissingGrant.make({ capability: PartyReview.id }), provenance: extend(provenanceOf(reviewer), mergeHop) }),
    ),
    then(survivor),
  ];
  return { ...roles, intake, claim, otherClaim, sameParty, asserted, unreviewed, registered, mergeRefused };
};
const refusedAccept = rejected(MissingGrant.make({ capability: PartyReview.id, operation: AcceptClaim.tag }));

it.effect.prop("a caller without the capability grant is refused by decide", [Cast], ([cast]) => {
  const { intake, claim, asserted } = sceneOf(cast);
  return story(
    given(claim, asserted),
    // Intake may assert claims, not decide them.
    as(intake),
    when(claim, AcceptClaim.make({})),
    refusedAccept,
  );
});

it.effect.prop("a grant on another org does not reach this org's claim", [Cast], ([cast]) => {
  const { outsider, other, claim, asserted } = sceneOf(cast);
  return story(given(claim, asserted), as(member(outsider, other, [PartyReview])), when(claim, AcceptClaim.make({})), refusedAccept);
});

it.effect.prop("a grant on one record reaches that record only", [Cast], ([cast]) => {
  const { reviewer, home, claim, otherClaim, sameParty, asserted, unreviewed, registered, mergeRefused } = sceneOf(cast);
  const onClaim = onRecord({
    grant: grantOf(reviewer, PartyReview),
    capability: PartyReview,
    org: home,
    record: streamOf(claim),
    operations: [AcceptClaim.tag],
  });
  const narrow = human(reviewer, [onClaim]);
  return story(
    ...registered,
    given(claim, asserted),
    given(otherClaim, asserted),
    as(narrow),
    when(otherClaim, AcceptClaim.make({})),
    refusedAccept,
    when(claim, AcceptClaim.make({})),
    then(claim, ClaimAccepted.make({ proposition: sameParty, ...unreviewed, provenance: provenanceOf(narrow) })),
    // Re-admitted for the merge, the same grant reaches the claim's record only: the merge is refused, and recorded.
    ...mergeRefused(narrow),
  );
});

/** Two instants: a grant's expiry, and a time at or after it. */
const Lapse = S.Tuple([S.DateTimeUtc, S.DateTimeUtc]);

it.effect.prop("an expired grant no longer covers", [Cast, Lapse], ([cast, [one, two]]) => {
  const { reviewer, home, claim, asserted } = sceneOf(cast);
  const byInstant: Order.Order<DateTime.Utc> = DateTime.Order;
  const expires = Order.min(byInstant)(one, two);
  const now = Order.max(byInstant)(one, two);
  const expiring = CapabilityGrant.make({
    grant: grantOf(reviewer, PartyReview),
    delegation: O.none(),
    capability: PartyReview.id,
    operations: O.none(),
    resource: ResourceScope.cases.Org.make({ org: home }),
    expires: O.some(expires),
  });
  return story(clock(now), given(claim, asserted), as(human(reviewer, [expiring])), when(claim, AcceptClaim.make({})), refusedAccept);
});

it.effect.prop("a person with the propose grant still cannot propose: only an agent run does", [Cast, Assessment], ([cast, assessment]) => {
  const { home, claim, asserted } = sceneOf(cast);
  return story(
    given(claim, asserted),
    as(member(rolesOf(cast).intake, home, [PartyPropose])),
    when(claim, ProposeDisposition.make({ ...assessment, evidenceRevision: 1 })),
    rejected(NotAnAgent.make({})),
  );
});

it.effect.prop(
  "a merge runs under the reviewer's re-admitted grants, so a reviewer without merge rights gets a recorded refusal",
  [Cast],
  ([cast]) => {
    const { reviewer, home, claim, sameParty, asserted, unreviewed, registered, mergeRefused } = sceneOf(cast);
    const acceptOnly = CapabilityGrant.make({
      grant: grantOf(reviewer, PartyReview),
      delegation: O.none(),
      capability: PartyReview.id,
      operations: O.some([AcceptClaim.tag]),
      resource: ResourceScope.cases.Org.make({ org: home }),
      expires: O.none(),
    });
    const acting = human(reviewer, [acceptOnly, onOrg(reviewer, PartyRead, home)]);
    return story(
      ...registered,
      given(claim, asserted),
      as(acting),
      when(claim, AcceptClaim.make({})),
      then(claim, ClaimAccepted.make({ proposition: sameParty, ...unreviewed, provenance: provenanceOf(acting) })),
      // The policy acts with no more authority than the root has now: the merge is refused, and recorded.
      ...mergeRefused(acting),
    );
  },
);
