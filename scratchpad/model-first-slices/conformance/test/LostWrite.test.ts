import * as Domain from "@alchemy.run/domain";
import * as DurableObjects from "@alchemy.run/domain/DurableObjects";
import { expect, it } from "@effect/vitest";
import * as A from "@beep/utils/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { makeSimHost, type SimHost } from "./SimHost.ts";

// Phase 9, patch 3 (D41): two runners on one instance, as while a shard moves. The first decides
// on version 0 and holds there; the second commits version 1 meanwhile; then the first commits. A
// commit must not be acknowledged on a version that has moved since its decide: without the
// patch the first overwrites `event:1` and `meta`, so the second's acknowledged write is lost.

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
/** How long the first runner's decide holds. */
const HOLD_MS = 10_000;

/** The slot's stored events and state, as the host's storage holds them. */
const stored = Effect.fn("stored")(function* (sim: SimHost) {
  const storage = yield* Effect.fromOption(sim.storageOf(SLOT)).pipe(Effect.orDie);
  const events = yield* storage.list<{ readonly event: { readonly label: string } }>({ prefix: "event:" });
  const meta = yield* storage.get<{ readonly state: { readonly labels: ReadonlyArray<string> }; readonly version: number }>("meta");
  return { events: A.map(A.fromIterable(events.values()), (row) => row.event.label), meta };
});

it.effect("a commit on a version that moved since its decide is never acknowledged: both writes stand, in order", () =>
  Effect.gen(function* () {
    const sim = makeSimHost(() => ({}));
    const context = yield* Layer.build(
      Slots.layer(Layer.empty).pipe(Layer.provideMerge(DurableObjects.makePlatform(sim.host)), Layer.provideMerge(SecureRandom.layerWebCrypto)),
    );
    const result = yield* Effect.gen(function* () {
      const slots = yield* Slot;
      // Runner 0 takes A and decides on version 0, holding there.
      sim.serveFrom(0);
      const first = yield* Effect.forkChild(slots.send("s", Write.make({ label: "A", holdMs: HOLD_MS })));
      yield* TestClock.adjust("1 second");
      // The shard moves: runner 1 takes B and commits version 1 while A still holds.
      sim.serveFrom(1);
      const second = yield* slots.send("s", Write.make({ label: "B", holdMs: 0 }));
      // A's decide returns. Its commit finds version 1 stored, not the 0 it decided on: it is not
      // acknowledged, and the caller's retry (same command id) decides again on runner 1.
      yield* TestClock.adjust(`${HOLD_MS} millis`);
      yield* TestClock.adjust(`${HOLD_MS * 2} millis`);
      const firstReceipt = yield* Fiber.join(first);
      const after = yield* stored(sim);
      return { firstReceipt, second, after };
    }).pipe(Effect.ensuring(sim.close), Effect.provideContext(context));
    expect(result.second.version).toBe(1);
    // Without the version check: A is acknowledged at version 1 and stored over B.
    expect(result.firstReceipt.version).toBe(2);
    expect(result.after.events).toEqual(["B", "A"]);
    expect(result.after.meta).toEqual({ state: { labels: ["B", "A"] }, version: 2 });
  }),
);
