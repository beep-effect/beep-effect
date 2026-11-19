import * as Domain from "@alchemy.run/domain";
import * as InMemory from "@alchemy.run/domain/InMemory";
import { Internals } from "@alchemy.run/domain/Model";
import { expect, it } from "@effect/vitest";
import type { RunId } from "@proto/kernel/Ids";
import { provenanceOf } from "@proto/kernel/Invocation";
import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
import { ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { ProposalApproved } from "@proto/party-contract/Claim/ApproveProposal.command";
import { ClaimAsserted } from "@proto/party-contract/Claim/AssertClaim.command";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { type AssertedReview, ClaimReviewState } from "@proto/party-contract/Claim/ClaimReview.read";
import { ClaimRetracted } from "@proto/party-contract/Claim/RetractClaim.command";
import { ReviewRequested } from "@proto/party-contract/Claim/ReviewRequested.event";
import { ClaimDecided, ClaimDecidedV1, ClaimDecidedV2, ClaimFeed } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { PartyIntake, PartyReview } from "@proto/party-contract/Party.capabilities";
import { Authority } from "@proto/party-model/Authority.external";
import { Claim, ClaimState } from "@proto/party-model/Claim/Claim.aggregate";
import { ClaimReviewLive } from "@proto/party-model/Claim/ClaimReview.handler";
import { ClaimReview } from "@proto/party-model/Claim/ClaimReview.view";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { ContactSource } from "@proto/party-model/Evidence/ContactSource.external";
import { PartyFacts } from "@proto/party-model/Facts/PartyFacts.stream";
import { PartyFacts2 } from "@proto/party-model/Facts/PartyFacts2.stream";
import { partyStreamPins } from "@proto/party-model/Facts/StreamPins";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { reviewRun } from "@proto/party-model/Review/ReviewPlan";
import { ReviewRuns } from "@proto/party-model/Review/ReviewRuns.external";
import { checkPublisherHandover } from "@proto/tooling/PublisherHandover";
import * as A from "@beep/utils/Array";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "@beep/utils/Option";
import * as Schedule from "effect/Schedule";
import { Cast, rolesOf } from "./Cast.ts";
import { member, twoSources } from "./fixtures.ts";

// Phase 10 (D47): an upgrade that replaces a publisher waits until the old one has published
// everything pending. The old code is phase 8's: `ClaimFacts` reads the review view and writes
// generation 1. A claim with two review runs is decided under it (its decision event carries no
// scope) while `ClaimFacts` is held, so its fact is undelivered. The check refuses the upgrade;
// once the old publisher drains it passes; the new code then republishes the decision into
// generation 2 with both review runs, through the generation 1 lookup. The fallback for a decision
// generation 1 never published would name no run for this direct decision: it is not taken.

/** Phase 8's publisher, as that code had it: the review view's state names the org and the runs. */
class ClaimFacts extends Domain.Projection("ClaimFacts", {
  from: [ClaimReview],
  key: ClaimFeed,
  keyOf: { ClaimReview: () => "claims" as const },
  on: [ClaimAccepted, ClaimRetracted, ProposalApproved],
  writes: [PartyFacts],
}) {}

const isAsserted = (review: ClaimReviewState): review is AssertedReview => !ClaimReviewState.guards.Unasserted(review);

/** Phase 8's handler, held until `gate` opens. */
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
          const common = { factId: ClaimDecided.factIdOf(claim), claim, org, reviewRuns: reviews };
          yield* facts.append(input, ClaimDecidedV1.make({ ...common, outcome: decided.decision }), ClaimDecidedV2.make({ ...common, ...decided }));
        }
      });
    }),
  );

/** The model phase 8 ran, as far as its publisher goes. */
class PartyPhase8 extends Domain.Model("Party", {
  aggregates: [Claim],
  views: [ClaimReview],
  projections: [ClaimFacts],
  streams: [PartyFacts],
}) {}
/** Phase 8's pins: generation 1 open, written by `ClaimFacts` from the review view (version 1). */
const phase8Pins = [
  StreamPin.cases.Open.make({ stream: "PartyFacts", writer: StreamWriter.make({ projection: "ClaimFacts", generation: 1, sources: ["ClaimReview"] }) }),
];

/** No port is called: nothing is sent. */
const ports = Layer.mergeAll(
  Authority.toLayer(Effect.succeed({ readmit: () => Effect.die("unused") })),
  ReviewRuns.toLayer(
    Effect.succeed({
      open: () => Effect.die("unused"),
      reserve: () => Effect.die("unused"),
      settle: () => Effect.die("unused"),
      release: () => Effect.die("unused"),
      step: () => Effect.die("unused"),
      awaitApproval: () => Effect.die("unused"),
      exhaust: () => Effect.die("unused"),
      refuse: () => Effect.die("unused"),
    }),
  ),
  Reasoner.toLayer(Effect.succeed({ assess: () => Effect.die("unused") })),
  ContactSource.toLayer(Effect.succeed({ observe: () => Effect.die("unused") })),
);

/** A claim of this cast decided under phase 8's code: its org, its two review runs, and its history as that code stored it. */
const sceneOf = (cast: Cast) => {
  const { home: org, intake: asserter, reviewer: decider, claim } = rolesOf(cast);
  const intake = member(asserter, org, [PartyIntake]);
  const reviewer = member(decider, org, [PartyReview]);
  const runs = [reviewRun(claim, 1), reviewRun(claim, 2)];
  const proposition = cast.identifier;
  const signals = twoSources(cast);
  const reviewRequested = (run: RunId) =>
    ReviewRequested.make({ run, org, proposition, signals, evidenceRevision: 1, provenance: provenanceOf(intake) });
  /** Asserted, two reviews, accepted directly, no scope. */
  const history = [
    ClaimAsserted.make({ org, proposition, signals, provenance: provenanceOf(intake) }),
    ...A.map(runs, reviewRequested),
    ClaimAccepted.make({ proposition, org: O.none(), reviewRuns: O.none(), provenance: provenanceOf(reviewer) }),
  ];
  return { org, claim, runs, history };
};

// Each run deploys two generations of the model and polls their publishers, so this property runs
// ten times, not the default hundred.
it.live.prop("an upgrade that closes generation 1 waits for the old publisher; the new one republishes every review run", [Cast], ([cast]) =>
  Effect.gen(function* () {
    const { org, claim, runs, history } = sceneOf(cast);
    const platform = InMemory.make();
    const gate = yield* Deferred.make<void>();
    const store = yield* Layer.build(MemoryPartyDirectoryStore);

    // The old code, live: the decision is stored, its fact not yet published.
    const drained = yield* Effect.scoped(
      Effect.gen(function* () {
        const old = yield* Layer.build(PartyPhase8.layer(Layer.merge(ClaimReviewLive, claimFactsLive(gate))).pipe(Layer.provide(platform.layer)));
        const internals = Context.get(old, Internals);
        const claims = yield* Effect.fromOption(O.fromNullishOr(internals.aggregates.get("Claim")?.seed)).pipe(Effect.orDie);
        const encoded = yield* Effect.forEach(history, internals.kernel.encodeEvent, { concurrency: 1 });
        yield* claims(claim, encoded);
        // The backlog the check reads on this host: decided claims whose fact generation 1 lacks.
        const backlog = Effect.gen(function* () {
          const state = yield* Effect.flatMap(Effect.service(Claim), (claims) => claims.get(claim));
          const page = yield* Effect.flatMap(Effect.service(PartyFacts), (facts) => facts.list("claims"));
          const decided = ClaimState.isAnyOf(["Accepted", "Retracted"])(state);
          const published = A.some(page.entries, (entry) => entry.event.factId === ClaimDecided.factIdOf(claim));
          return [{ stream: "PartyFacts", writer: "ClaimFacts", pending: decided && !published ? 1 : 0 }];
        }).pipe(Effect.provideContext(old));
        const before = yield* backlog;
        const refused = yield* Effect.flip(checkPublisherHandover({ current: phase8Pins, next: partyStreamPins, backlog: before }));
        // The old publisher drains.
        yield* Deferred.succeed(gate, undefined);
        const after = yield* backlog.pipe(Effect.repeat({ schedule: Schedule.spaced("50 millis"), until: (read) => read[0]!.pending === 0, times: 100 }));
        const handovers = yield* checkPublisherHandover({ current: phase8Pins, next: partyStreamPins, backlog: after });
        const published = yield* Effect.flatMap(Effect.service(PartyFacts), (facts) => facts.list("claims")).pipe(Effect.provideContext(old));
        return { refused, handovers, published: A.map(published.entries, (entry) => entry.event) };
      }),
    );
    expect(drained.refused.pending).toMatchObject([{ handover: { stream: "PartyFacts", change: "closed" }, pending: 1 }]);
    expect(A.map(drained.handovers, (handover) => handover.change)).toEqual(["closed"]);
    expect(drained.published).toMatchObject([
      { _tag: "ClaimDecidedV1", reviewRuns: runs },
      { _tag: "ClaimDecidedV2", reviewRuns: runs },
    ]);

    // The new code, deployed over the same platform.
    const next = yield* Layer.build(
      PartyModel.layer(PartyHandlers).pipe(Layer.provide(Layer.mergeAll(platform.layer, ports, Layer.succeedContext(store)))),
    );
    const republished = yield* Effect.flatMap(Effect.service(PartyFacts2), (facts) => facts.list("claims")).pipe(
      Effect.repeat({ schedule: Schedule.spaced("50 millis"), until: (page) => page.entries.length >= 2, times: 100 }),
      Effect.provideContext(next),
    );
    // The scope generation 1 published, both review runs: the lookup, not the fallback (which would name none).
    expect(A.map(republished.entries, (entry) => entry.event)).toMatchObject([
      { _tag: "ClaimDecidedV1", factId: ClaimDecided.factIdOf(claim), org, reviewRuns: runs },
      { _tag: "ClaimDecidedV2", factId: ClaimDecided.factIdOf(claim), org, reviewRuns: runs, basis: "direct" },
    ]);
  }).pipe(Effect.scoped),
  { timeout: 120_000, arbitrary: { runs: 10 } },
);
