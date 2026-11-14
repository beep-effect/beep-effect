import * as Domain from "@alchemy.run/domain";
import * as DurableObjects from "@alchemy.run/domain/DurableObjects";
import { Internals } from "@alchemy.run/domain/Model";
import { expect, it } from "@effect/vitest";
import { CapabilityGrant, ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { GrantId, OrgId, PrincipalId } from "@proto/kernel/Ids";
import { Invocation, Root } from "@proto/kernel/Invocation";
import { AcceptClaim, ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { ProposalApproved } from "@proto/party-contract/Claim/ApproveProposal.command";
import { AssertClaim } from "@proto/party-contract/Claim/AssertClaim.command";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { type AssertedReview, ClaimReviewState } from "@proto/party-contract/Claim/ClaimReview.read";
import { RequestReview } from "@proto/party-contract/Claim/RequestReview.command";
import { ClaimRetracted } from "@proto/party-contract/Claim/RetractClaim.command";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { ClaimDecidedV1, ClaimDecidedV2, ClaimFeed } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { PartyIntake, PartyReview } from "@proto/party-contract/Party.capabilities";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { Claim } from "@proto/party-model/Claim/Claim.aggregate";
import { ClaimReviewLive } from "@proto/party-model/Claim/ClaimReview.handler";
import { ClaimReview } from "@proto/party-model/Claim/ClaimReview.view";
import { PartyFacts } from "@proto/party-model/Facts/PartyFacts.stream";
import { backlogOf, type StoredRow, writerShapeOf } from "@proto/tooling/PublisherBacklog";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import { makeSimHost, type SimHost } from "./SimHost.ts";

// Phase 11 (D50): the drain check's generic reader, which reads any writer's backlog from the
// host's own records, against Party's own query (decided claims whose fact the outgoing generation
// lacks), on the in-process Durable Object host, which stores instances as every Durable Object
// host does. Phase 8's publisher is live and held; a claim with two review runs is decided; both
// readers see one thing pending; once the publisher drains, both see none. The in-memory platform
// keeps its deliveries and consumer logs out of reach, so the generic reader cannot run there
// (notes/phase-11.md).

class ClaimFacts extends Domain.Projection("ClaimFacts", {
  from: [ClaimReview],
  key: ClaimFeed,
  keyOf: { ClaimReview: () => "claims" as const },
  on: [ClaimAccepted, ClaimRetracted, ProposalApproved],
  writes: [PartyFacts],
}) {}

const isAsserted = (review: ClaimReviewState): review is AssertedReview => !ClaimReviewState.guards.Unasserted(review);

/** Phase 8's publisher, held until `gate` opens (as in `party/model/test/Handover.test.ts`). */
const claimFactsLive = (gate: Deferred.Deferred<void>) =>
  ClaimFacts.toLayer(
    Effect.gen(function* () {
      const facts = yield* PartyFacts;
      return Effect.fn(function* (batch) {
        yield* Deferred.await(gate);
        for (const input of batch) {
          const review = O.filter(O.fromNullishOr(input.state), isAsserted);
          if (O.isNone(review)) continue;
          const { org, reviews } = review.value;
          const claim = ClaimId.make(input.source.id);
          const decided = Match.value(input.event).pipe(
            Match.tagsExhaustive({
              ClaimAccepted: () => ({ decision: "accepted" as const, basis: "direct" as const, approval: O.none() }),
              ClaimRetracted: () => ({ decision: "retracted" as const, basis: "direct" as const, approval: O.none() }),
              ProposalApproved: (approved) => ({ decision: approved.outcome, basis: "approval" as const, approval: O.some(approved.approval) }),
            }),
          );
          const common = { factId: `${claim}:decided`, claim, org, reviewRuns: reviews };
          yield* facts.append(input, ClaimDecidedV1.make({ ...common, outcome: decided.decision }), ClaimDecidedV2.make({ ...common, ...decided }));
        }
      });
    }),
  );

class PartyPhase8 extends Domain.Model("Party", { aggregates: [Claim], views: [ClaimReview], projections: [ClaimFacts], streams: [PartyFacts] }) {}

const acme = OrgId.make("org_acme");
const grant = (id: string, capability: typeof PartyIntake) =>
  CapabilityGrant.make({
    grant: GrantId.make(id),
    delegation: O.none(),
    capability: capability.id,
    operations: O.none(),
    resource: ResourceScope.cases.Org.make({ org: acme }),
    expires: O.none(),
  });
const person = (principal: string, grants: ReadonlyArray<CapabilityGrant>) =>
  Invocation.make({ root: Root.cases.Human.make({ principal: PrincipalId.make(principal) }), onBehalfOf: PrincipalId.make(principal), grants: A.fromIterable(grants), chain: [] });
const intake = person("p_intake", [grant("g_intake", PartyIntake)]);
const reviewer = person("p_rev", [grant("g_rev", PartyReview)]);
const claim = ClaimId.make("claim_1");
const proposition = Proposition.cases.HasIdentifier.make({ party: PartyId.make("party_dana"), scheme: "email", value: "dana@acme.test" });
const signals = [EvidenceSignal.make({ source: "mailbox:intake", quote: "dana@acme.test" }), EvidenceSignal.make({ source: "crm", quote: "dana@acme.test on file" })];

/** Every row the in-process host stores, as the generic reader reads a host's rows. */
const rowsOf = Effect.fn("rowsOf")(function* (sim: SimHost) {
  const all = yield* Effect.forEach(sim.ids(), (id) =>
    O.match(sim.storageOf(id), {
      onNone: () => Effect.succeed(A.empty<StoredRow>()),
      onSome: (storage) => Effect.map(storage.list<unknown>(), (entries) => A.map(A.fromIterable(entries), ([key, value]) => ({ object: id, key, value }))),
    }),
  );
  return A.flatten(all);
});

it.live("the generic backlog and Party's own query agree: one undelivered decision while the old publisher is held, none after it drains", () =>
  Effect.gen(function* () {
    const sim = makeSimHost(() => ({}));
    const gate = yield* Deferred.make<void>();
    const context = yield* Layer.build(
      PartyPhase8.layer(Layer.merge(ClaimReviewLive, claimFactsLive(gate))).pipe(
        Layer.provideMerge(DurableObjects.makePlatform(sim.host)),
        Layer.provideMerge(SecureRandom.layerWebCrypto),
      ),
    );
    const { kernel } = Context.get(context, Internals);
    const shape = yield* Effect.fromOption(writerShapeOf({ model: PartyPhase8, generations: kernel })("PartyFacts")).pipe(Effect.orDie);
    const result = yield* Effect.gen(function* () {
      const claims = yield* Claim;
      const generic = Effect.map(rowsOf(sim), (rows) => backlogOf(shape, rows));
      // The deploy's first call starts the publisher's backfill run; with nothing stored yet it
      // completes at once, and later decisions reach the publisher live.
      yield* claims.get(ClaimId.make("claim_0"));
      yield* generic.pipe(Effect.repeat({ schedule: Schedule.spaced("50 millis"), until: (backlog) => backlog.runComplete, times: 200 }));
      yield* claims.send(claim, AssertClaim.make({ org: acme, proposition, signals })).pipe(Effect.provideService(CurrentInvocation, intake));
      yield* claims.send(claim, RequestReview.make({})).pipe(Effect.provideService(CurrentInvocation, reviewer));
      yield* claims.send(claim, AcceptClaim.make({})).pipe(Effect.provideService(CurrentInvocation, reviewer));
      // Party's own query: a decided claim whose fact generation 1 lacks.
      const oracle = Effect.gen(function* () {
        const state = yield* claims.get(claim);
        const page = yield* Effect.flatMap(Effect.service(PartyFacts), (facts) => facts.list("claims"));
        const decided = state._tag === "Accepted" || state._tag === "Retracted";
        return decided && !A.some(page.entries, (entry) => entry.event.factId === `${claim}:decided`) ? 1 : 0;
      });
      const held = yield* generic.pipe(Effect.repeat({ schedule: Schedule.spaced("50 millis"), until: (backlog) => backlog.pending >= 1, times: 100 }));
      const heldOracle = yield* oracle;
      yield* Deferred.succeed(gate, undefined);
      const drained = yield* generic.pipe(Effect.repeat({ schedule: Schedule.spaced("50 millis"), until: (backlog) => backlog.pending === 0, times: 200 }));
      const drainedOracle = yield* oracle.pipe(Effect.repeat({ schedule: Schedule.spaced("50 millis"), until: (n) => n === 0, times: 100 }));
      return { held, heldOracle, drained, drainedOracle };
    }).pipe(Effect.ensuring(sim.close), Effect.provideContext(context));
    expect(shape).toEqual({
      model: "Party",
      projection: { name: "ClaimFacts", generation: 1, classGeneration: 1 },
      on: ["ClaimAccepted", "ClaimRetracted", "ProposalApproved"],
      // Version 1, rebuilt in place: its storage keeps generation 0.
      views: [{ name: "ClaimReview", generation: 1, classGeneration: 0 }],
    });
    expect(result.held.pending).toBe(1);
    expect(result.heldOracle).toBe(1);
    expect(result.drained.pending).toBe(0);
    expect(result.drainedOracle).toBe(0);
  }),
);
