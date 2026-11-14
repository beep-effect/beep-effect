import { expect, it } from "@effect/vitest";
import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
import { checkPublisherHandover, Handover, handoversOf } from "@proto/tooling/PublisherHandover";
import * as Effect from "effect/Effect";

// Phase 10 (D47): an upgrade that closes a published stream's generation, or gives it another
// writer, is refused while the outgoing writer has anything pending.

const claimFacts = StreamWriter.make({ projection: "ClaimFacts", generation: 1, sources: ["ClaimReview"] });
const claimDecisions = StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Claim"] });
/** The pins of the code phase 8 ran: generation 1, written from the review view. */
const phase8 = [StreamPin.cases.Open.make({ stream: "PartyFacts", writer: claimFacts })];
/** Phase 9's: generation 1 closed, generation 2 opened. */
const phase9 = [
  StreamPin.cases.Closed.make({ stream: "PartyFacts" }),
  StreamPin.cases.Open.make({ stream: "PartyFacts2", writer: claimDecisions }),
];
const closing = Handover.make({ stream: "PartyFacts", writer: claimFacts, change: "closed" });

it.effect("closing a generation is a handover; keeping its writer is not", () =>
  Effect.gen(function* () {
    expect(handoversOf({ current: phase8, next: phase9 })).toEqual([closing]);
    expect(handoversOf({ current: phase9, next: phase9 })).toEqual([]);
    const rebuilt = [StreamPin.cases.Open.make({ stream: "PartyFacts", writer: { ...claimFacts, generation: 2 } })];
    expect(handoversOf({ current: phase8, next: rebuilt })).toEqual([Handover.make({ stream: "PartyFacts", writer: claimFacts, change: "replaced" })]);
  }),
);

it.effect("the upgrade is refused while the outgoing writer has anything pending, or its backlog is unread", () =>
  Effect.gen(function* () {
    const pending = yield* Effect.flip(
      checkPublisherHandover({ current: phase8, next: phase9, backlog: [{ stream: "PartyFacts", writer: "ClaimFacts", pending: 1 }] }),
    );
    expect(pending.pending).toEqual([{ handover: closing, pending: 1 }]);
    const unread = yield* Effect.flip(checkPublisherHandover({ current: phase8, next: phase9, backlog: [] }));
    expect(unread.unread).toEqual([closing]);
  }),
);

it.effect("once the outgoing writer has drained, the upgrade passes with its handovers", () =>
  Effect.gen(function* () {
    const handovers = yield* checkPublisherHandover({
      current: phase8,
      next: phase9,
      backlog: [{ stream: "PartyFacts", writer: "ClaimFacts", pending: 0 }],
    });
    expect(handovers).toEqual([closing]);
    // A deploy that hands nothing over needs no backlog.
    const none = yield* checkPublisherHandover({ current: phase9, next: phase9, backlog: [] });
    expect(none).toEqual([]);
  }),
);
