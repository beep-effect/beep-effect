import { expect, it } from "@effect/vitest";
import { backlogOf, type StoredRow, type WriterShape } from "@proto/tooling/PublisherBacklog";
import * as Effect from "effect/Effect";

// Phase 11 (D50): a publisher's backlog read from its host's own records, for any writer.

/** Phase 6's publisher: generation 0, reading the review view, generation 0. */
const shape: WriterShape = {
  model: "Party",
  projection: { name: "ClaimFacts", generation: 0, classGeneration: 0 },
  on: ["ClaimAccepted", "ClaimRetracted", "ProposalApproved"],
  views: [{ name: "ClaimReview", generation: 0, classGeneration: 0 }],
};
const row = (object: string, key: string, value: unknown): StoredRow => ({ object, key, value });
const delivery = (kind: string, name: string, tag: string, generation?: number, seq = 1, key = "k") => ({
  target: generation === undefined ? { kind, name } : { kind, name, generation },
  tag,
  key,
  source: "s",
  seq,
});

it.effect("a drained writer has nothing pending", () =>
  Effect.gen(function* () {
    const drained = backlogOf(shape, [
      row("Practice/Party.ClaimFactsProjection/claims", "meta", { accepted: 1, processed: 1, intake: {} }),
      row("Practice/Party.ClaimFactsProjectionRun/~run", "run:projection%3AClaimFacts", { phase: "complete" }),
    ]);
    expect(drained).toEqual({ staged: 0, throughViews: 0, unprocessed: 0, runComplete: true, pending: 0 });
  }),
);

it.effect("deliveries staged to the writer, consumed events on their way through a view, and accepted inputs not handled are pending", () =>
  Effect.gen(function* () {
    const backlog = backlogOf(shape, [
      row("Practice/Party.ClaimReviewView/c1", "outbox:000000000001", delivery("projection", "ClaimFacts", "ClaimAccepted")),
      row("Practice/Party.ClaimAggregate/c2", "outbox:000000000003", delivery("view", "ClaimReview", "ProposalApproved")),
      // Not the writer's: an event it does not consume, another generation, another consumer.
      row("Practice/Party.ClaimAggregate/c2", "outbox:000000000004", delivery("view", "ClaimReview", "EvidenceAdded")),
      row("Practice/Party.ClaimAggregate/c3", "outbox:000000000001", delivery("view", "ClaimReview", "ClaimAccepted", 1)),
      row("Practice/Party.ClaimAggregate/c3", "outbox:000000000002", delivery("policy", "MergeOnSameParty", "ClaimAccepted")),
      row("Practice/Party.ClaimFactsProjection/claims", "meta", { accepted: 3, processed: 1, intake: {} }),
      // Another model's key of the same class name.
      row("Practice/Runs.ClaimFactsProjection/claims", "meta", { accepted: 9, processed: 0, intake: {} }),
    ]);
    expect(backlog).toEqual({ staged: 1, throughViews: 1, unprocessed: 2, runComplete: true, pending: 4 });
  }),
);

it.effect("a delivery the consumer already took in, whose outbox row is not yet deleted, is counted once, where it now waits", () =>
  Effect.gen(function* () {
    const backlog = backlogOf(shape, [
      // Taken into the writer's log (intake s: 2), not yet handled.
      row("Practice/Party.ClaimReviewView/c1", "outbox:000000000002", delivery("projection", "ClaimFacts", "ClaimAccepted", undefined, 2, "claims")),
      row("Practice/Party.ClaimFactsProjection/claims", "meta", { accepted: 2, processed: 1, intake: { s: 2 } }),
      // Applied by the view (checkpoint s: 5), its own delivery to the writer not yet staged.
      row("Practice/Party.ClaimAggregate/c1", "outbox:000000000005", delivery("view", "ClaimReview", "ClaimAccepted", undefined, 5, "c1")),
      row("Practice/Party.ClaimReviewView/c1", "snapshot", { checkpoints: { s: 5 }, state: null, version: 5, seq: 5 }),
    ]);
    expect(backlog).toEqual({ staged: 0, throughViews: 0, unprocessed: 1, runComplete: true, pending: 1 });
  }),
);

it.effect("a view rebuilt in place is read from its kept storage, while deliveries to it carry its generation", () =>
  Effect.gen(function* () {
    // Phase 8's shape: the review view at version 1, rebuilt in place (storage generation 0).
    const phase8 = { ...shape, projection: { name: "ClaimFacts", generation: 1, classGeneration: 1 }, views: [{ name: "ClaimReview", generation: 1, classGeneration: 0 }] };
    const backlog = backlogOf(phase8, [
      row("Practice/Party.ClaimAggregate/c1", "outbox:000000000004", delivery("view", "ClaimReview", "ClaimAccepted", 1, 4, "c1")),
      row("Practice/Party.ClaimAggregate/c2", "outbox:000000000002", delivery("view", "ClaimReview", "ClaimAccepted", 1, 2, "c2")),
      // c1 applied its delivery already; c2 has not.
      row("Practice/Party.ClaimReviewView/c1", "snapshot", { checkpoints: { s: 4 }, state: null, version: 4, seq: 4 }),
      row("Practice/Party.ClaimFactsProjectionV1/claims", "meta", { accepted: 1, processed: 0, intake: {} }),
    ]);
    expect(backlog).toEqual({ staged: 0, throughViews: 1, unprocessed: 1, runComplete: true, pending: 2 });
  }),
);

it.effect("a writer whose backfill run is not complete counts as pending", () =>
  Effect.gen(function* () {
    const running = backlogOf(
      { ...shape, projection: { name: "ClaimFacts", generation: 1, classGeneration: 1 } },
      [row("Practice/Party.ClaimFactsProjectionV1Run/~run", "run:projection%3AClaimFacts%231", { phase: "discover" })],
    );
    expect(running).toEqual({ staged: 0, throughViews: 0, unprocessed: 0, runComplete: false, pending: 1 });
  }),
);
