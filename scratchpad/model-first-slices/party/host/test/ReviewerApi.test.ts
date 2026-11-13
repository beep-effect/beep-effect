import * as Domain from "@alchemy.run/domain";
import { expect, it } from "@effect/vitest";
import { OrgId } from "@proto/kernel/Ids";
import { AgentContract } from "@proto/party-contract/AgentApi.contract";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyIntake, PartyPropose, PartyRead, PartyReview } from "@proto/party-contract/Party.capabilities";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
import { AgentApi } from "@proto/party-model/AgentApi.api";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import { ReviewerApi } from "@proto/party-model/ReviewerApi.api";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Access, asAgent, asHuman, AuthorityWorld, PartyWorld, Session, World } from "./World.ts";

/**
 * A contract's client over the real Api's in-process protocol, both living for
 * the caller's scope (as the Api's own `clientInProcess` builds it).
 */
const contractClient = <C, R, P, RP>(client: Effect.Effect<C, never, R>, protocol: Layer.Layer<P, never, RP>) =>
  Effect.flatMap(Layer.build(protocol), (context) => Effect.provide(client, context));

const acme = OrgId.make("org_acme");
const globex = OrgId.make("org_globex");

const dana = PartyId.make("party_dana");
const duplicate = PartyId.make("party_dup");
const sameParty = Proposition.cases.SameParty.make({ survivor: dana, absorbed: duplicate });
const twoSources = [
  EvidenceSignal.make({ source: "mailbox:intake", quote: "Dana Smith is D. Smith" }),
  EvidenceSignal.make({ source: "crm", quote: "same phone number" }),
];

/** The grants each principal holds, issued by the authority context. */
const grantsIssued = Effect.gen(function* () {
  const authority = yield* Access;
  yield* authority.issue("g_intake", "p_intake", PartyIntake, acme);
  yield* authority.issue("g_intake_propose", "p_intake", PartyPropose, acme);
  yield* authority.issue("g_rev", "p_rev", PartyReview, acme);
  yield* authority.issue("g_rev_read", "p_rev", PartyRead, acme);
  yield* authority.issue("g_eve", "p_eve", PartyReview, globex);
  yield* authority.issue("g_eve_read", "p_eve", PartyRead, globex);
});

it.live("grants decide who may accept and read; another org's grants are refused", () =>
  Effect.gen(function* () {
    yield* grantsIssued;
    const intake = yield* IntakeApi.clientInProcess;
    const reviewer = yield* ReviewerApi.clientInProcess;
    const claimId = ClaimId.make("claim_http_1");

    const registered = [
      yield* intake.RegisterParty(dana, { org: acme, name: "Dana Smith" }, asHuman("p_intake")),
      yield* intake.RegisterParty(duplicate, { org: acme, name: "D. Smith" }, asHuman("p_intake")),
    ];
    const asserted = yield* intake.AssertClaim(
      claimId,
      { org: acme, proposition: sameParty, signals: twoSources },
      asHuman("p_intake"),
    );

    // A grant on another org reaches neither the decision nor the read. The read waits for
    // the assertion: a view that has not caught up reads as empty, and is not refused.
    const refusedAccept = yield* reviewer.AcceptClaim(claimId, {}, asHuman("p_eve")).pipe(Effect.flip);
    expect(refusedAccept).toMatchObject({ _tag: "MissingGrant", capability: "party.review", operation: "AcceptClaim" });
    const refusedRead = yield* reviewer.ClaimReview.get(claimId, { ...asHuman("p_eve"), atLeast: asserted }).pipe(
      Effect.flip,
    );
    expect(refusedRead).toMatchObject({ _tag: "MissingGrant", capability: "party.read" });

    // No credential at all.
    const anonymous = yield* reviewer.AcceptClaim(claimId).pipe(Effect.flip);
    expect(anonymous._tag).toBe("Unauthorized");

    // Intake asserted, but may not decide.
    const intakeAccept = yield* reviewer.AcceptClaim(claimId, {}, asHuman("p_intake")).pipe(Effect.flip);
    expect(intakeAccept._tag).toBe("MissingGrant");

    // The granted reviewer accepts; the receipt lets the read wait for that write.
    const accepted = yield* reviewer.AcceptClaim(claimId, {}, asHuman("p_rev"));
    const review = yield* reviewer.ClaimReview.get(claimId, { ...asHuman("p_rev"), atLeast: accepted });
    expect(review).toMatchObject({ status: "accepted", org: "org_acme" });

    // The merge policy ran under the reviewer's relayed invocation; the party view shows it once it lands.
    const merged = yield* reviewer.EffectiveParty.get(dana, asHuman("p_rev")).pipe(
      Effect.repeat({
        schedule: Schedule.spaced("25 millis"),
        until: (party) => (party?.absorbed.length ?? 0) > 0,
        times: 80,
      }),
    );
    expect(merged).toMatchObject({ name: "Dana Smith", absorbed: [duplicate] });

    // Events carry provenance only: a view's list and events hold grant ids and no grant terms.
    const listed = yield* reviewer.ClaimReview.list(claimId, asHuman("p_rev"));
    const streamed = yield* reviewer.ClaimReview.events(claimId, asHuman("p_rev")).pipe(Stream.take(3), Stream.runCollect);
    for (const read of [listed.entries, streamed]) {
      const text = JSON.stringify(read);
      expect(text).toContain('"grants":[{"grant":"g_rev"');
      expect(text).not.toContain('"capability"');
      expect(text).not.toContain('"operations"');
      expect(text).not.toContain('"resource"');
    }

    // The directory query refuses an org without a read grant; `atLeast` waits for the projection.
    const acmeRows = yield* reviewer.FindParties({ org: acme, text: "smith" }, { ...asHuman("p_rev"), atLeast: registered });
    expect(acmeRows.entries.map((row) => row.partyId)).toEqual([dana, duplicate]);
    const globexRows = yield* reviewer.FindParties({ org: globex, text: "smith" }, { ...asHuman("p_eve"), atLeast: registered });
    expect(globexRows.entries).toEqual([]);
    const refusedSearch = yield* reviewer
      .FindParties({ org: acme, text: "smith" }, { ...asHuman("p_eve"), atLeast: registered })
      .pipe(Effect.flip);
    expect(refusedSearch._tag).toBe("MissingGrant");
  }).pipe(Effect.scoped, Effect.provide(World)),
);

it.live("the contract client, with no model in its closure, drives the hosted model over the Api's wire", () =>
  Effect.gen(function* () {
    yield* grantsIssued;
    const claimId = ClaimId.make("claim_contract_1");
    const intake = yield* IntakeApi.clientInProcess;
    const asserted = yield* intake.AssertClaim(
      claimId,
      { org: acme, proposition: sameParty, signals: twoSources },
      asHuman("p_intake"),
    );
    // The contract's client speaks the ReviewerApi's group, served in process by the real Api.
    const reviewer = yield* contractClient(ReviewerContract.client, Domain.protocolInProcess(ReviewerApi));
    const pending = yield* reviewer.ClaimReview.get(claimId, { ...asHuman("p_rev"), atLeast: asserted });
    expect(pending).toMatchObject({ status: "pending", org: "org_acme", sources: 2 });
    const refused = yield* reviewer.AcceptClaim(claimId, {}, asHuman("p_intake")).pipe(Effect.flip);
    // A rejection decodes to the contract's class: the same class the model declares.
    expect(refused).toMatchObject({ _tag: "MissingGrant", operation: "AcceptClaim" });
    const accepted = yield* reviewer.AcceptClaim(claimId, {}, asHuman("p_rev"));
    expect(accepted.stream).toBe("Claim/claim_contract_1");
  }).pipe(Effect.scoped, Effect.provide(World)),
);

it.live("an agent run with no accountable human is refused at the boundary", () =>
  Effect.gen(function* () {
    const agent = yield* contractClient(AgentContract.client, Domain.protocolInProcess(AgentApi));
    const refused = yield* agent
      .ProposeDisposition(ClaimId.make("claim_any"), { disposition: "accept", rationale: "x", evidenceRevision: 1 }, asAgent("run_orphan"))
      .pipe(Effect.flip);
    expect(refused).toMatchObject({ _tag: "Unaccountable", run: "run_orphan" });
  }).pipe(Effect.scoped, Effect.provide(World)),
);

it.live("two models on one InMemory share it, but merging both hosted Layers hands a Party Api the wrong model", () => {
  // Build a reviewer client and accept a claim nobody asserted, all inside one exit.
  const acceptUnder = <E, R>(layer: Layer.Layer<Layer.Success<typeof PartyWorld> | Layer.Success<typeof Session>, E, R>) =>
    Effect.gen(function* () {
      const reviewer = yield* ReviewerApi.clientInProcess;
      return yield* reviewer.AcceptClaim(ClaimId.make("claim_unasserted"), {}, asHuman("p_rev"));
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.exit);
  return Effect.gen(function* () {
    // Scoped: the Party model alone meets its Api, and decides (a typed rejection).
    const scoped = yield* acceptUnder(Layer.mergeAll(PartyWorld, Session));
    expect(scoped).toMatchObject({ _tag: "Failure", cause: { reasons: [{ _tag: "Fail", error: { _tag: "ClaimNotPending" } }] } });
    // Merged at the top: the authority model's `Model.Internals` wins the single service key,
    // and the Party Api dies building its in-process protocol.
    const merged = yield* acceptUnder(Layer.mergeAll(PartyWorld, AuthorityWorld, Session));
    expect(merged).toMatchObject({
      _tag: "Failure",
      cause: { reasons: [{ _tag: "Die", defect: { _tag: "DefinitionError" } }] },
    });
    expect(String(merged._tag === "Failure" ? merged.cause : "")).toContain("AcceptClaim is served, but no hosted aggregate handles it");
  });
});
