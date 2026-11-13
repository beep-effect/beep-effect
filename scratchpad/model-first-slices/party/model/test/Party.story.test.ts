import { Story } from "@alchemy.run/domain/Story";
import { expect, it } from "@effect/vitest";
import { type Actor, agent, human, system } from "@proto/kernel/Actor";
import { CurrentActor } from "@proto/kernel/CurrentActor.context";
import { OrgId } from "@proto/kernel/Ids";
import { AcceptClaim, AdmissionGateUnmet, ClaimAccepted } from "@proto/party/Claim/AcceptClaim.command";
import { AssertClaim, ClaimAsserted } from "@proto/party/Claim/AssertClaim.command";
import { Claim } from "@proto/party/Claim/Claim.aggregate";
import { ClaimReview } from "@proto/party/Claim/ClaimReview.view";
import { DispositionProposed } from "@proto/party/Claim/ProposeDisposition.command";
import { FindParties } from "@proto/party/Directory/FindParties.query";
import { MemoryPartyDirectoryStore } from "@proto/party/Directory/PartyDirectory.store";
import { EvidenceSignal } from "@proto/party/Evidence";
import { PartyHandlers } from "@proto/party/Handlers";
import { EffectiveParty } from "@proto/party/Party/EffectiveParty.view";
import { PartiesMerged } from "@proto/party/Party/MergeParties.command";
import { Party } from "@proto/party/Party/Party.aggregate";
import { PartyRegistered, RegisterParty } from "@proto/party/Party/RegisterParty.command";
import { PartyModel } from "@proto/party/Party.model";
import { Proposition } from "@proto/party/Proposition";
import { Reasoner } from "@proto/party/Review/Reasoner.external";
import { HumanDecision, ReviewAssist } from "@proto/party/Review/ReviewAssist.saga";
import * as Layer from "effect/Layer";

const { call, given, provide, query, rejected, saga, signal, succeed, then, view, when } = Story;

/** Act as this actor for the following steps, as the Session middleware would. */
const as = (actor: Actor) => provide(CurrentActor, actor);

const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner], // faked: the story answers each call
});

const acme = OrgId.make("org_acme");
const intake = human("p_intake", "org_acme");
const reviewer = human("p_rev", "org_acme");
const outsider = human("p_eve", "org_globex");

const claim = Claim.ref("claim_1");
const dana = Party.ref("party_dana");
const duplicate = Party.ref("party_dup");
const otherDana = Party.ref("party_globex_dana");

const sameParty = Proposition.cases.SameParty.make({ survivor: dana.id, absorbed: duplicate.id });
const hasIdentifier = Proposition.cases.HasIdentifier.make({ party: dana.id, scheme: "email", value: "dana@acme.test" });

const signalFrom = (source: string) => EvidenceSignal.make({ source, excerpt: `${source} says so` });
const twoSources = [signalFrom("mailbox:intake"), signalFrom("crm")];
// Two signals, one source: one source for the gate.
const oneSource = [signalFrom("mailbox:intake"), signalFrom("mailbox:intake")];

it.effect("an accepted SameParty claim merges the parties, through the policy", () =>
  story(
    given(dana, new PartyRegistered({ name: "Dana Smith", by: intake })),
    given(duplicate, new PartyRegistered({ name: "D. Smith", by: intake })),
    given(claim, new ClaimAsserted({ proposition: sameParty, signals: twoSources, by: intake })),
    as(reviewer),
    when(claim, new AcceptClaim()),
    then(claim, new ClaimAccepted({ proposition: sameParty, by: reviewer, corroboration: 2 })),
    // The policy ran, for real, as the system acting in the claim's org.
    then(dana, new PartiesMerged({ absorbed: duplicate.id, by: system("MergeOnSameParty", "org_acme") })),
    view(EffectiveParty, dana, { org: acme, name: "Dana Smith", absorbed: [duplicate.id] }),
  ),
);

it.effect("one source is not corroboration", () =>
  story(
    given(claim, new ClaimAsserted({ proposition: sameParty, signals: oneSource, by: intake })),
    as(reviewer),
    when(claim, new AcceptClaim()),
    rejected(new AdmissionGateUnmet({ gate: "independent-corroboration", have: 1, need: 2 })),
  ),
);

it.effect("the assistant proposes, a reviewer decides", () => {
  const assistant = agent({
    agent: "review-assistant",
    model: "reasoner",
    run: "ReviewAssist/claim_1",
    onBehalfOf: "p_intake",
    org: "org_acme",
  });
  const rationale = "the intake mailbox names the address";
  return story(
    as(intake),
    when(claim, new AssertClaim({ proposition: hasIdentifier, signals: oneSource })),
    then(claim, new ClaimAsserted({ proposition: hasIdentifier, signals: oneSource, by: intake })),
    // The run reached the model call; the story answers it.
    call(Reasoner.assess, { proposition: hasIdentifier }),
    succeed(Reasoner.assess, { disposition: "accept", rationale }),
    then(claim, new DispositionProposed({ disposition: "accept", rationale, by: assistant })),
    view(ClaimReview, claim, { status: "pending", proposal: { disposition: "accept", rationale, by: assistant } }),
    // Waiting on a person.
    saga(ReviewAssist, claim.id, { _tag: "Running" }),
    signal(ReviewAssist, claim.id, HumanDecision, { disposition: "accept", by: reviewer }),
    then(claim, new ClaimAccepted({ proposition: hasIdentifier, by: reviewer, corroboration: 1 })),
    saga(ReviewAssist, claim.id, { _tag: "Completed", result: undefined }),
    view(ClaimReview, claim, { status: "accepted" }),
  );
});

it.effect("a party search returns only the caller's org's rows, a page at a time", () =>
  story(
    as(intake),
    when(dana, new RegisterParty({ name: "Dana Smith" })),
    then(dana, new PartyRegistered({ name: "Dana Smith", by: intake })),
    when(duplicate, new RegisterParty({ name: "Dana S." })),
    then(duplicate, new PartyRegistered({ name: "Dana S.", by: intake })),
    as(outsider),
    when(otherDana, new RegisterParty({ name: "Dana Other" })),
    then(otherDana, new PartyRegistered({ name: "Dana Other", by: outsider })),
    as(reviewer),
    query(FindParties, { text: "dana" }, [
      { partyId: dana.id, org: acme, name: "Dana Smith" },
      { partyId: duplicate.id, org: acme, name: "Dana S." },
    ]),
    query(
      FindParties,
      { text: "dana" },
      ({ entries, cursor }) => {
        expect(entries.map((row) => row.partyId)).toEqual([dana.id]);
        expect(cursor).toBe(dana.id);
      },
      { take: 1 },
    ),
    query(FindParties, { text: "dana" }, [{ partyId: duplicate.id }], { take: 1, after: dana.id }),
    as(outsider),
    query(FindParties, { text: "dana" }, [{ partyId: otherDana.id, name: "Dana Other" }]),
  ),
);
