import { expect, it } from "@effect/vitest";
import { DeploymentDescriptor } from "@proto/kernel/Deployment";
import { type GenerationEntry, StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
import { checkGenerationRetirement, RetirementRefusal } from "@proto/tooling/GenerationRetirement";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";

// Phase 11 (D51): a closed generation stops being served only when the retirement check approves the
// pin change against the live host.

const feed = { producer: "party", contract: "ClaimDecided" };
const writer = StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Claim"] });
const served = [StreamPin.cases.Closed.make({ stream: "PartyFacts" }), StreamPin.cases.Open.make({ stream: "PartyFacts2", writer })];
const retiring = (length: number) => [StreamPin.cases.Retired.make({ stream: "PartyFacts", length }), StreamPin.cases.Open.make({ stream: "PartyFacts2", writer })];

const descriptor = (context: string, consumes: ReadonlyArray<number>, publishes: ReadonlyArray<number>) =>
  DeploymentDescriptor.make({
    context,
    models: [],
    processes: [],
    publishes: A.map(publishes, (version) => ({ ...feed, version })),
    consumes: A.map(consumes, (version) => ({ ...feed, version })),
    cluster: { module: "m", export: "e", parts: [], apis: [] },
  });
const descriptors = [descriptor("party", [], [1, 2]), descriptor("runs", [1], []), descriptor("audit", [2], [])];

const entry = (position: number, claim: string, version: number, outcome = "accepted"): GenerationEntry => ({
  position,
  factId: `${claim}:decided`,
  version,
  payload: { claim, version, outcome },
});
/** Generation 1: claim a's decision in both versions. Generation 2: republished, then claim b's. */
const gen1 = { stream: "PartyFacts", entries: [entry(1, "a", 1), entry(2, "a", 2)] };
const gen2 = { stream: "PartyFacts2", entries: [entry(1, "a", 1), entry(2, "a", 2), entry(3, "b", 1), entry(4, "b", 2)] };
const caughtUp = [{ consumer: "runs", position: 6 }, { consumer: "audit", position: 2 }];

it.effect("allowed when the next generation holds every fact, every consumer has read past it, positions stay and D34 allows it", () =>
  Effect.gen(function* () {
    const approved = yield* checkGenerationRetirement({ feed, current: served, next: retiring(2), descriptors, generations: [gen1, gen2], checkpoints: caughtUp });
    expect(approved).toEqual([{ stream: "PartyFacts", from: 0, through: 2 }]);
    // A change that retires nothing has nothing to approve.
    const none = yield* checkGenerationRetirement({ feed, current: served, next: served, descriptors, generations: [], checkpoints: [] });
    expect(none).toEqual([]);
  }),
);

it.effect("refused when a consumer is behind, or its checkpoint was not read", () =>
  Effect.gen(function* () {
    const behind = yield* Effect.flip(
      checkGenerationRetirement({ feed, current: served, next: retiring(2), descriptors, generations: [gen1, gen2], checkpoints: [{ consumer: "runs", position: 1 }] }),
    );
    expect(behind.refusals).toEqual([
      RetirementRefusal.cases.ConsumerBehind.make({ stream: "PartyFacts", consumer: "runs", checkpoint: 1, through: 2 }),
      RetirementRefusal.cases.CheckpointUnread.make({ stream: "PartyFacts", consumer: "audit" }),
    ]);
  }),
);

it.effect("refused when the next generation lacks a fact or holds it with a different payload", () =>
  Effect.gen(function* () {
    const lacking = { stream: "PartyFacts2", entries: [entry(1, "a", 2, "retracted"), entry(2, "b", 1)] };
    const refused = yield* Effect.flip(
      checkGenerationRetirement({ feed, current: served, next: retiring(2), descriptors, generations: [gen1, lacking], checkpoints: caughtUp }),
    );
    expect(refused.refusals).toEqual([
      RetirementRefusal.cases.FactMissing.make({ stream: "PartyFacts", successor: "PartyFacts2", factId: "a:decided", version: 1 }),
      RetirementRefusal.cases.PayloadDiffers.make({ stream: "PartyFacts", successor: "PartyFacts2", factId: "a:decided", version: 2 }),
    ]);
  }),
);

it.effect("refused when positions would move, the generation is not closed, or D34 refuses", () =>
  Effect.gen(function* () {
    const wrongLength = yield* Effect.flip(
      checkGenerationRetirement({ feed, current: served, next: retiring(1), descriptors, generations: [gen1, gen2], checkpoints: caughtUp }),
    );
    expect(wrongLength.refusals).toEqual([RetirementRefusal.cases.LengthDiffers.make({ stream: "PartyFacts", pinned: 1, live: 2 })]);
    const dropped = yield* Effect.flip(
      checkGenerationRetirement({ feed, current: served, next: [StreamPin.cases.Open.make({ stream: "PartyFacts2", writer })], descriptors, generations: [gen1, gen2], checkpoints: caughtUp }),
    );
    expect(dropped.refusals).toEqual([RetirementRefusal.cases.PinsMoved.make({ current: ["PartyFacts", "PartyFacts2"], next: ["PartyFacts2"] })]);
    const open = [StreamPin.cases.Open.make({ stream: "PartyFacts", writer }), StreamPin.cases.Open.make({ stream: "PartyFacts2", writer })];
    const notClosed = yield* Effect.flip(
      checkGenerationRetirement({ feed, current: open, next: retiring(2), descriptors, generations: [gen1, gen2], checkpoints: caughtUp }),
    );
    expect(notClosed.refusals).toEqual([RetirementRefusal.cases.NotClosed.make({ stream: "PartyFacts" })]);
    const withoutV1 = [descriptor("party", [], [2]), descriptor("runs", [1], []), descriptor("audit", [2], [])];
    const unpublished = yield* Effect.flip(
      checkGenerationRetirement({ feed, current: served, next: retiring(2), descriptors: withoutV1, generations: [gen1, gen2], checkpoints: caughtUp }),
    );
    expect(unpublished.refusals).toEqual([
      RetirementRefusal.cases.VersionUnpublished.make({ consumer: "runs", fact: { ...feed, version: 1 } }),
    ]);
  }),
);

it.effect("a generation not read cannot be retired, and nothing after it can be placed", () =>
  Effect.gen(function* () {
    const unread = yield* Effect.flip(
      checkGenerationRetirement({ feed, current: served, next: retiring(2), descriptors, generations: [gen1], checkpoints: caughtUp }),
    );
    expect(unread.refusals).toEqual([RetirementRefusal.cases.Unread.make({ stream: "PartyFacts2" })]);
  }),
);
