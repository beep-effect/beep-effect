import { Story } from "@alchemy.run/domain/Story";
import { expect, it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { byProcess, Cause, extend, type Invocation, operatorOf, provenanceOf, Root } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { ReadmissionRefused } from "@proto/kernel/ReadmissionRefused.rejection";
import { AcceptClaim, AdmissionGateUnmet, ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { ClaimAsserted } from "@proto/party-contract/Claim/AssertClaim.command";
import { MergeRefused, MergeRefusal } from "@proto/party-contract/Claim/RecordMergeRefused.command";
import { PartyIntake, PartyPropose, PartyRead, PartyReview } from "@proto/party-contract/Party.capabilities";
import { PartiesMerged } from "@proto/party-contract/Party/MergeParties.command";
import { PartyRegistered, RegisterParty } from "@proto/party-contract/Party/RegisterParty.command";
import { Proposition } from "@proto/party-contract/Proposition";
import { Authority } from "@proto/party-model/Authority.external";
import { Claim } from "@proto/party-model/Claim/Claim.aggregate";
import { ClaimReview } from "@proto/party-model/Claim/ClaimReview.view";
import { FindParties } from "@proto/party-model/Directory/FindParties.query";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { EffectiveParty } from "@proto/party-model/Party/EffectiveParty.view";
import { Party } from "@proto/party-model/Party/Party.aggregate";
import { Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { ReviewRuns } from "@proto/party-model/Review/ReviewRuns.external";
import * as A from "@beep/utils/Array";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import { acme, globex, human, onOrg, oneSource, readmitted, twoSources } from "./fixtures.ts";

const { call, fail, given, provide, query, rejected, succeed, then, view, when } = Story;

/** Act under this invocation for the following steps, as the Session middleware would. */
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns], // every outside system answers in the story
});

const intake = human("p_intake", [
  onOrg("g_intake", PartyIntake, acme),
  onOrg("g_intake_read", PartyRead, acme),
  onOrg("g_intake_propose", PartyPropose, acme),
]);
const reviewer = human("p_rev", [onOrg("g_rev", PartyReview, acme), onOrg("g_rev_read", PartyRead, acme)]);
const outsider = human("p_eve", [onOrg("g_eve", PartyIntake, globex), onOrg("g_eve_read", PartyRead, globex)]);

const claim = Claim.ref("claim_1");
const dana = Party.ref("party_dana");
const duplicate = Party.ref("party_dup");
const otherDana = Party.ref("party_globex_dana");

const sameParty = Proposition.cases.SameParty.make({ survivor: dana.id, absorbed: duplicate.id });

/** The hop the merge policy adds when it reacts to the accept at `seq`. */
const mergeHop = (seq: number, event = "ClaimAccepted") =>
  byProcess("MergeOnSameParty", Cause.cases.Event.make({ stream: "Claim/claim_1", seq, event }));

const registered = [
  given(dana, PartyRegistered.make({ org: acme, name: "Dana Smith", provenance: provenanceOf(intake) })),
  given(duplicate, PartyRegistered.make({ org: acme, name: "D. Smith", provenance: provenanceOf(intake) })),
];
const asserted = (signals = twoSources) =>
  given(claim, ClaimAsserted.make({ org: acme, proposition: sameParty, signals, provenance: provenanceOf(intake) }));
/** The scope a decision on this claim carries: its org, and no review run (its history asked for none). */
const unreviewed = { org: O.some(acme), reviewRuns: O.some([]) };

it.effect("a policy's command runs under the reviewer's root, re-admitted for its hop, never a system", () => {
  const merging = readmitted(reviewer, mergeHop(2));
  expect(merging.root).toEqual(Root.cases.Human.make({ principal: reviewer.onBehalfOf }));
  expect(operatorOf(merging)).toEqual({ _tag: "Process", process: "MergeOnSameParty" });
  return story(
    ...registered,
    asserted(),
    as(reviewer),
    when(claim, AcceptClaim.make({})),
    then(claim, ClaimAccepted.make({ proposition: sameParty, ...unreviewed, provenance: provenanceOf(reviewer) })),
    // The policy asks the authority context for this hop, and sends under what comes back.
    call(Authority.readmit, { provenance: provenanceOf(reviewer), hop: mergeHop(2) }),
    succeed(Authority.readmit, merging),
    then(dana, PartiesMerged.make({ absorbed: duplicate.id, provenance: provenanceOf(merging) })),
    view(EffectiveParty, dana, { org: acme, name: "Dana Smith", absorbed: [duplicate.id] }),
  );
});

it.effect("a grant revoked between two hops stops the second hop, and the refusal is recorded", () =>
  story(
    ...registered,
    asserted(),
    as(reviewer),
    when(claim, AcceptClaim.make({})),
    then(claim, ClaimAccepted.make({ proposition: sameParty, ...unreviewed, provenance: provenanceOf(reviewer) })),
    call(Authority.readmit, { provenance: provenanceOf(reviewer), hop: mergeHop(2) }),
    // The review grant was revoked after the accept: authority re-admits with the read grant alone.
    succeed(Authority.readmit, readmitted(reviewer, mergeHop(2), [onOrg("g_rev_read", PartyRead, acme)])),
    then(
      claim,
      MergeRefused.make({
        reason: MergeRefusal.cases.MissingGrant.make({ capability: "party.review" }),
        provenance: extend(provenanceOf(reviewer), mergeHop(2)),
      }),
    ),
    then(dana),
    view(ClaimReview, claim, { notes: [{ _tag: "MergeRefused", reason: "missing-grant:party.review" }] }),
  ),
);

it.effect("a refused re-admission and a veto are recorded, never dropped", () =>
  story(
    asserted(),
    as(reviewer),
    when(claim, AcceptClaim.make({})),
    then(claim, ClaimAccepted.make({ proposition: sameParty, ...unreviewed, provenance: provenanceOf(reviewer) })),
    call(Authority.readmit, { provenance: provenanceOf(reviewer), hop: mergeHop(2) }),
    fail(Authority.readmit, ReadmissionRefused.make({ reason: "lapsed", lapsed: [] })),
    then(claim, MergeRefused.make({ reason: MergeRefusal.cases.Readmission.make({ reason: "lapsed" }), provenance: extend(provenanceOf(reviewer), mergeHop(2)) })),
  ),
);

it.effect("a merge the survivor cannot take is a recorded veto", () =>
  story(
    // The survivor was never registered.
    asserted(),
    as(reviewer),
    when(claim, AcceptClaim.make({})),
    then(claim, ClaimAccepted.make({ proposition: sameParty, ...unreviewed, provenance: provenanceOf(reviewer) })),
    call(Authority.readmit, { provenance: provenanceOf(reviewer), hop: mergeHop(2) }),
    succeed(Authority.readmit, readmitted(reviewer, mergeHop(2))),
    then(
      claim,
      MergeRefused.make({ reason: MergeRefusal.cases.Vetoed.make({ reason: "not-registered" }), provenance: extend(provenanceOf(reviewer), mergeHop(2)) }),
    ),
  ),
);

it.effect("one source is not corroboration", () =>
  story(
    asserted(oneSource),
    as(reviewer),
    when(claim, AcceptClaim.make({})),
    rejected(AdmissionGateUnmet.make({ gate: "independent-corroboration", have: 1, need: 2 })),
  ),
);

it.effect("a party search returns only a granted org's rows, a page at a time", () =>
  story(
    as(intake),
    when(dana, RegisterParty.make({ org: acme, name: "Dana Smith" })),
    then(dana, PartyRegistered.make({ org: acme, name: "Dana Smith", provenance: provenanceOf(intake) })),
    when(duplicate, RegisterParty.make({ org: acme, name: "Dana S." })),
    then(duplicate, PartyRegistered.make({ org: acme, name: "Dana S.", provenance: provenanceOf(intake) })),
    as(outsider),
    when(otherDana, RegisterParty.make({ org: globex, name: "Dana Other" })),
    then(otherDana, PartyRegistered.make({ org: globex, name: "Dana Other", provenance: provenanceOf(outsider) })),
    as(reviewer),
    query(FindParties, { org: acme, text: "dana" }, [
      { partyId: dana.id, org: acme, name: "Dana Smith" },
      { partyId: duplicate.id, org: acme, name: "Dana S." },
    ]),
    query(
      FindParties,
      { org: acme, text: "dana" },
      ({ entries, cursor }) => {
        expect(A.map(entries, (row) => row.partyId)).toEqual([dana.id]);
        expect(cursor).toBe(dana.id);
      },
      { take: 1 },
    ),
    query(FindParties, { org: acme, text: "dana" }, [{ partyId: duplicate.id }], { take: 1, after: dana.id }),
    // No grant on another org: refused, not an empty page.
    query(FindParties, { org: globex, text: "dana" }),
    rejected(MissingGrant.make({ capability: PartyRead.id, operation: "FindParties" })),
    as(outsider),
    query(FindParties, { org: globex, text: "dana" }, [{ partyId: otherDana.id, name: "Dana Other" }]),
  ),
);
