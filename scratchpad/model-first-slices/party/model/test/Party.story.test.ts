import { streamOf } from "@alchemy.run/domain/Aggregate";
import { Story } from "@alchemy.run/domain/Story";
import { expect, it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { byProcess, Cause, extend, type Invocation, operatorOf, provenanceOf, Root } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { ReadmissionRefused } from "@proto/kernel/ReadmissionRefused.rejection";
import { AcceptClaim, AdmissionGateUnmet, ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { ClaimAsserted } from "@proto/party-contract/Claim/AssertClaim.command";
import { MergeRefused, MergeRefusal } from "@proto/party-contract/Claim/RecordMergeRefused.command";
import type { EvidenceSignal } from "@proto/party-contract/Evidence";
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
import { MergeOnSameParty } from "@proto/party-model/Party/MergeOnSameParty.policy";
import { Party } from "@proto/party-model/Party/Party.aggregate";
import { Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { ReviewRuns } from "@proto/party-model/Review/ReviewRuns.external";
import * as A from "@beep/utils/Array";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { Cast } from "./Cast.ts";
import { member, oneSource, onOrg, readmitted, twoSources } from "./fixtures.ts";

const { call, fail, given, provide, query, rejected, succeed, then, view, when } = Story;

/** Act under this invocation for the following steps, as the Session middleware would. */
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns], // every outside system answers in the story
});

/** Who acts, and on what, in a story over this cast. */
const sceneOf = (cast: Cast) => {
  const { home, other } = cast.orgs;
  const intake = member(cast.people.intake, home, [PartyIntake, PartyRead, PartyPropose]);
  const reviewer = member(cast.people.reviewer, home, [PartyReview, PartyRead]);
  const outsider = member(cast.people.outsider, other, [PartyIntake, PartyRead]);
  const claim = Claim.ref(cast.claims.claim);
  const survivor = Party.ref(cast.parties.survivor);
  const absorbed = Party.ref(cast.parties.absorbed);
  const sameParty = Proposition.cases.SameParty.make({ survivor: survivor.id, absorbed: absorbed.id });
  /** The hop the merge policy adds when it reacts to the accept at `seq`. */
  const mergeHop = (seq: number) =>
    byProcess(MergeOnSameParty.policyName, Cause.cases.Event.make({ stream: streamOf(claim), seq, event: ClaimAccepted.tag }));
  const registered = [
    given(survivor, PartyRegistered.make({ org: home, name: cast.names.survivor, provenance: provenanceOf(intake) })),
    given(absorbed, PartyRegistered.make({ org: home, name: cast.names.absorbed, provenance: provenanceOf(intake) })),
  ];
  const asserted = (signals: ReadonlyArray<EvidenceSignal> = twoSources(cast)) =>
    given(claim, ClaimAsserted.make({ org: home, proposition: sameParty, signals, provenance: provenanceOf(intake) }));
  /** The scope a decision on this claim carries: its org, and no review run (its history asked for none). */
  const unreviewed = { org: O.some(home), reviewRuns: O.some([]) };
  const accepted = [
    as(reviewer),
    when(claim, AcceptClaim.make({})),
    then(claim, ClaimAccepted.make({ proposition: sameParty, ...unreviewed, provenance: provenanceOf(reviewer) })),
    // The policy asks the authority context for this hop, and sends under what comes back.
    call(Authority.readmit, { provenance: provenanceOf(reviewer), hop: mergeHop(2) }),
  ];
  return { home, other, intake, reviewer, outsider, claim, survivor, absorbed, mergeHop, registered, asserted, accepted };
};

it.effect.prop("a policy's command runs under the reviewer's root, re-admitted for its hop, never a system", [Cast], ([cast]) => {
  const { home, reviewer, survivor, absorbed, mergeHop, registered, asserted, accepted } = sceneOf(cast);
  const merging = readmitted(reviewer, mergeHop(2));
  expect(merging.root).toEqual(Root.cases.Human.make({ principal: reviewer.onBehalfOf }));
  expect(operatorOf(merging)).toEqual({ _tag: "Process", process: MergeOnSameParty.policyName });
  return story(
    ...registered,
    asserted(),
    ...accepted,
    succeed(Authority.readmit, merging),
    then(survivor, PartiesMerged.make({ absorbed: absorbed.id, provenance: provenanceOf(merging) })),
    view(EffectiveParty, survivor, { org: home, name: cast.names.survivor, absorbed: [absorbed.id] }),
  );
});

it.effect.prop("a grant revoked between two hops stops the second hop, and the refusal is recorded", [Cast], ([cast]) => {
  const { home, reviewer, claim, survivor, mergeHop, registered, asserted, accepted } = sceneOf(cast);
  return story(
    ...registered,
    asserted(),
    ...accepted,
    // The review grant was revoked after the accept: authority re-admits with the read grant alone.
    succeed(Authority.readmit, readmitted(reviewer, mergeHop(2), [onOrg(cast.people.reviewer, PartyRead, home)])),
    then(
      claim,
      MergeRefused.make({
        reason: MergeRefusal.cases.MissingGrant.make({ capability: PartyReview.id }),
        provenance: extend(provenanceOf(reviewer), mergeHop(2)),
      }),
    ),
    then(survivor),
    view(ClaimReview, claim, { notes: [{ _tag: "MergeRefused", reason: `missing-grant:${PartyReview.id}` }] }),
  );
});

it.effect.prop(
  "a refused re-admission and a veto are recorded, never dropped",
  [Cast, ReadmissionRefused.fields.reason],
  ([cast, reason]) => {
    const { reviewer, claim, mergeHop, asserted, accepted } = sceneOf(cast);
    return story(
      asserted(),
      ...accepted,
      fail(Authority.readmit, ReadmissionRefused.make({ reason, lapsed: [] })),
      then(
        claim,
        MergeRefused.make({ reason: MergeRefusal.cases.Readmission.make({ reason }), provenance: extend(provenanceOf(reviewer), mergeHop(2)) }),
      ),
    );
  },
);

it.effect.prop("a merge the survivor cannot take is a recorded veto", [Cast], ([cast]) => {
  const { reviewer, claim, mergeHop, asserted, accepted } = sceneOf(cast);
  return story(
    // The survivor was never registered.
    asserted(),
    ...accepted,
    succeed(Authority.readmit, readmitted(reviewer, mergeHop(2))),
    then(
      claim,
      MergeRefused.make({ reason: MergeRefusal.cases.Vetoed.make({ reason: "not-registered" }), provenance: extend(provenanceOf(reviewer), mergeHop(2)) }),
    ),
  );
});

it.effect.prop("one source is not corroboration", [Cast], ([cast]) => {
  const { reviewer, claim, asserted } = sceneOf(cast);
  return story(
    asserted(oneSource(cast)),
    as(reviewer),
    when(claim, AcceptClaim.make({})),
    rejected(AdmissionGateUnmet.make({ gate: "independent-corroboration", have: 1, need: 2 })),
  );
});

const byPartyId = Order.mapInput(Order.String, (row: { readonly id: string }) => row.id);

it.effect.prop("a party search returns only a granted org's rows, a page at a time", [Cast], ([cast]) => {
  const { home, other, intake, reviewer, outsider, survivor, absorbed } = sceneOf(cast);
  const elsewhere = Party.ref(cast.parties.elsewhere);
  // Every party shares the family name; the search asks for it in lower case.
  const { family } = cast.names;
  const named = (given: string) => `${given} ${family}`;
  const text = Str.toLowerCase(family);
  const [first, second] = A.sort(
    [
      { id: survivor.id, name: named(cast.names.survivor) },
      { id: absorbed.id, name: named(cast.names.absorbed) },
    ],
    byPartyId,
  );
  return story(
    as(intake),
    when(survivor, RegisterParty.make({ org: home, name: named(cast.names.survivor) })),
    then(survivor, PartyRegistered.make({ org: home, name: named(cast.names.survivor), provenance: provenanceOf(intake) })),
    when(absorbed, RegisterParty.make({ org: home, name: named(cast.names.absorbed) })),
    then(absorbed, PartyRegistered.make({ org: home, name: named(cast.names.absorbed), provenance: provenanceOf(intake) })),
    as(outsider),
    when(elsewhere, RegisterParty.make({ org: other, name: named(cast.names.elsewhere) })),
    then(elsewhere, PartyRegistered.make({ org: other, name: named(cast.names.elsewhere), provenance: provenanceOf(outsider) })),
    as(reviewer),
    query(FindParties, { org: home, text }, [
      { partyId: first.id, org: home, name: first.name },
      { partyId: second.id, org: home, name: second.name },
    ]),
    query(
      FindParties,
      { org: home, text },
      ({ entries, cursor }) => {
        expect(A.map(entries, (row) => row.partyId)).toEqual([first.id]);
        expect(cursor).toBe(first.id);
      },
      { take: 1 },
    ),
    query(FindParties, { org: home, text }, [{ partyId: second.id }], { take: 1, after: first.id }),
    // No grant on another org: refused, not an empty page.
    query(FindParties, { org: other, text }),
    rejected(MissingGrant.make({ capability: PartyRead.id, operation: FindParties.queryName })),
    as(outsider),
    query(FindParties, { org: other, text }, [{ partyId: elsewhere.id, name: named(cast.names.elsewhere) }]),
  );
});
