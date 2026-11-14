import * as Domain from "@alchemy.run/domain";
import * as DurableObjects from "@alchemy.run/domain/DurableObjects";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { makeSimHost, makeSimHostWith, type SimHost } from "./SimHost.ts";

// Phase 10, patch 4 (D45): a commit is acknowledged only if its runner owned the instance for the
// whole commit. Runner 0 decides on version 0 and holds; the instance moves to runner 1, which
// commits nothing; runner 0's commit then returns. The version has not moved, so the version check
// (patch 3) passes: only the fence can refuse it. In process, the host fences the way Effect
// Cluster's storage does after patch 4 (`SimHost` `fenced`): a transaction whose runner no longer
// serves the instance when it commits is rolled back and dies with `ShardLost`, which the library
// turns into the call's failure; the caller's retry reaches runner 1.

class Written extends Domain.Event("Written", { label: Schema.String }) {}
class Write extends Domain.Command("Write", {
  target: Schema.String,
  input: { label: Schema.String, holdMs: Schema.Finite },
  events: [Written],
}) {}
class Slot extends Domain.Aggregate("Slot", {
  id: Schema.String,
  state: Schema.Struct({ labels: Schema.Array(Schema.String) }),
  initial: { labels: [] },
  commands: [Write],
  decide: {
    Write: Effect.fn(function* (_, command) {
      yield* Effect.sleep(command.holdMs);
      return [Written.make({ label: command.label })];
    }),
  },
  evolve: { Written: (state, event) => ({ labels: A.append(state.labels, event.label) }) },
}) {}
class Slots extends Domain.Model("Slots", { aggregates: [Slot] }) {}

const SLOT = "Slots.SlotAggregate/s";
/** How long runner 0's decide holds. */
const HOLD_MS = 10_000;

/** One write decided on runner 0, with the instance moved to runner 1 before it commits. */
const moveDuringCommit = Effect.fn("moveDuringCommit")(function* (sim: SimHost) {
  const context = yield* Layer.build(
    Slots.layer(Layer.empty).pipe(Layer.provideMerge(DurableObjects.makePlatform(sim.host)), Layer.provideMerge(SecureRandom.layerWebCrypto)),
  );
  return yield* Effect.gen(function* () {
    const slots = yield* Slot;
    sim.serveFrom(0);
    const write = yield* Effect.forkChild(slots.send("s", Write.make({ label: "A", holdMs: HOLD_MS })));
    yield* TestClock.adjust("1 second");
    // The shard moves; runner 1 commits nothing.
    sim.serveFrom(1);
    // Runner 0's decide returns and it commits; a retry decides again (another hold) on runner 1.
    yield* TestClock.adjust(`${HOLD_MS} millis`);
    yield* TestClock.adjust(`${HOLD_MS * 2} millis`);
    const receipt = yield* Fiber.join(write);
    return { receipt, committers: sim.committers(SLOT) };
  }).pipe(Effect.ensuring(sim.close), Effect.provideContext(context));
});

it.effect("a runner that lost the instance during its commit is refused; the retry commits on the owner", () =>
  Effect.gen(function* () {
    const fenced = yield* moveDuringCommit(makeSimHostWith({ fenced: true })(() => ({})));
    expect(fenced.receipt.version).toBe(1);
    // Only runner 1's commit completed: runner 0's was rolled back.
    expect(fenced.committers).toEqual([1]);
  }),
);

it.effect("without the fence the version check alone lets the runner that lost the instance commit", () =>
  Effect.gen(function* () {
    const unfenced = yield* moveDuringCommit(makeSimHost(() => ({})));
    expect(unfenced.receipt.version).toBe(1);
    expect(unfenced.committers).toEqual([0]);
  }),
);
