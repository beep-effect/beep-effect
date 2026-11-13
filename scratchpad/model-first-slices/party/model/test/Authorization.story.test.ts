import { Story } from "@alchemy.run/domain/Story";
import { it } from "@effect/vitest";
import { CapabilityGrant, ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { GrantId } from "@proto/kernel/Ids";
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
import { Party } from "@proto/party-model/Party/Party.aggregate";
import { Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { ReviewRuns } from "@proto/party-model/Review/ReviewRuns.external";
import { Authority } from "@proto/party-model/Authority.external";
import { MergeRefused, MergeRefusal } from "@proto/party-contract/Claim/RecordMergeRefused.command";
import * as DateTime from "effect/DateTime";
import * as Layer from "effect/Layer";
import { acme, globex, human, onOrg, readmitted, twoSources } from "./fixtures.ts";

const mergeHop = byProcess("MergeOnSameParty", Cause.cases.Event.make({ stream: "Claim/claim_1", seq: 2, event: "ClaimAccepted" }));

const { call, clock, given, provide, rejected, succeed, then, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns],
});

const intake = human("p_intake", [onOrg("g_intake", PartyIntake, acme)]);
const claim = Claim.ref("claim_1");
const otherClaim = Claim.ref("claim_2");
const dana = Party.ref("party_dana");
const duplicate = Party.ref("party_dup");
const sameParty = Proposition.cases.SameParty.make({ survivor: dana.id, absorbed: duplicate.id });
const asserted = new ClaimAsserted({ org: acme, proposition: sameParty, signals: twoSources, provenance: provenanceOf(intake) });

it.effect("a caller without the capability grant is refused by decide", () =>
  story(
    given(claim, asserted),
    // Intake may assert claims, not decide them.
    as(intake),
    when(claim, new AcceptClaim()),
    rejected(new MissingGrant({ capability: PartyReview.id, operation: "AcceptClaim" })),
  ),
);

it.effect("a grant on another org does not reach this org's claim", () =>
  story(
    given(claim, asserted),
    as(human("p_eve", [onOrg("g_eve", PartyReview, globex)])),
    when(claim, new AcceptClaim()),
    rejected(new MissingGrant({ capability: PartyReview.id, operation: "AcceptClaim" })),
  ),
);

it.effect("a grant on one record reaches that record only", () => {
  const onClaim1 = CapabilityGrant.make({
    grant: GrantId.make("g_claim_1"),
    delegation: null,
    capability: PartyReview.id,
    operations: ["AcceptClaim"],
    resource: ResourceScope.cases.Record.make({ org: acme, record: "Claim/claim_1" }),
    expires: null,
  });
  const narrow = human("p_rev", [onClaim1]);
  return story(
    given(dana, new PartyRegistered({ org: acme, name: "Dana Smith", provenance: provenanceOf(intake) })),
    given(duplicate, new PartyRegistered({ org: acme, name: "D. Smith", provenance: provenanceOf(intake) })),
    given(claim, asserted),
    given(otherClaim, asserted),
    as(narrow),
    when(otherClaim, new AcceptClaim()),
    rejected(new MissingGrant({ capability: PartyReview.id, operation: "AcceptClaim" })),
    when(claim, new AcceptClaim()),
    then(claim, new ClaimAccepted({ proposition: sameParty, provenance: provenanceOf(narrow) })),
    // Re-admitted for the merge, the same grant reaches Claim/claim_1 only: the merge is refused, and recorded.
    call(Authority.readmit, { provenance: provenanceOf(narrow), hop: mergeHop }),
    succeed(Authority.readmit, readmitted(narrow, mergeHop)),
    then(claim, new MergeRefused({ reason: MergeRefusal.cases.MissingGrant.make({ capability: "party.review" }), provenance: extend(provenanceOf(narrow), mergeHop) })),
    then(dana),
  );
});

it.effect("an expired grant no longer covers", () => {
  const expiring = CapabilityGrant.make({
    grant: GrantId.make("g_expiring"),
    delegation: null,
    capability: PartyReview.id,
    operations: null,
    resource: ResourceScope.cases.Org.make({ org: acme }),
    expires: DateTime.makeUnsafe("2026-06-01T00:00:00Z"),
  });
  return story(
    clock("2026-06-02T00:00:00Z"),
    given(claim, asserted),
    as(human("p_rev", [expiring])),
    when(claim, new AcceptClaim()),
    rejected(new MissingGrant({ capability: PartyReview.id, operation: "AcceptClaim" })),
  );
});

it.effect("a person with the propose grant still cannot propose: only an agent run does", () =>
  story(
    given(claim, asserted),
    as(human("p_intake", [onOrg("g_propose", PartyPropose, acme)])),
    when(claim, new ProposeDisposition({ disposition: "accept", rationale: "looks right", evidenceRevision: 1 })),
    rejected(new NotAnAgent()),
  ),
);

it.effect("a merge runs under the reviewer's re-admitted grants, so a reviewer without merge rights gets a recorded refusal", () => {
  const acceptOnly = CapabilityGrant.make({
    grant: GrantId.make("g_accept_only"),
    delegation: null,
    capability: PartyReview.id,
    operations: ["AcceptClaim"],
    resource: ResourceScope.cases.Org.make({ org: acme }),
    expires: null,
  });
  const reviewer = human("p_rev", [acceptOnly, onOrg("g_read", PartyRead, acme)]);
  return story(
    given(dana, new PartyRegistered({ org: acme, name: "Dana Smith", provenance: provenanceOf(intake) })),
    given(duplicate, new PartyRegistered({ org: acme, name: "D. Smith", provenance: provenanceOf(intake) })),
    given(claim, asserted),
    as(reviewer),
    when(claim, new AcceptClaim()),
    then(claim, new ClaimAccepted({ proposition: sameParty, provenance: provenanceOf(reviewer) })),
    // The policy acts with no more authority than the root has now: the merge is refused, and recorded.
    call(Authority.readmit, { provenance: provenanceOf(reviewer), hop: mergeHop }),
    succeed(Authority.readmit, readmitted(reviewer, mergeHop)),
    then(claim, new MergeRefused({ reason: MergeRefusal.cases.MissingGrant.make({ capability: "party.review" }), provenance: extend(provenanceOf(reviewer), mergeHop) })),
    then(dana),
  );
});

