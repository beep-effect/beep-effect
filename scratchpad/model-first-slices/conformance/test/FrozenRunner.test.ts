import * as DurableObjects from "@alchemy.run/domain/DurableObjects";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as TestClock from "effect/testing/TestClock";
import { TRANSIT_RETRY_BUDGET_MS } from "./RecoveryBound.ts";
import { makeSimHost, makeSimHostWith, type SimHost } from "./SimHost.ts";
import { SLOT, Slot, Slots, Write } from "./SlotModel.ts";

// Phase 12 (D55): a write sent to a frozen runner completes or fails within the caller's retry
// budget (`TRANSIT_RETRY_BUDGET_MS`, derived from the library's `TRANSIT_RETRY` and pinned by the
// canary in RecoveryBound.test.ts), is never stored twice, and a retry under the same command id
// gets its receipt. In process, a frozen runner (`SimHost` `freeze`) is unreachable, as a paused
// process behind a transport that fails the call is: each attempt routed to it fails in transit
// and the caller retries; work already running on it stops at its next storage operation.

/** The slot model hosted on `sim`, for `body`. */
const onSlots = <A, E, R>(sim: SimHost, body: Effect.Effect<A, E, R>) =>
  Effect.flatMap(
    Layer.build(Slots.layer(Layer.empty).pipe(Layer.provideMerge(DurableObjects.makePlatform(sim.host)), Layer.provideMerge(SecureRandom.layerWebCrypto))),
    (context) => body.pipe(Effect.ensuring(sim.close), Effect.provideContext(context)),
  );

/** Send `label` under `commandId`, answered with the receipt or the failure, and when. */
const sendTimed = Effect.fn("sendTimed")(function* (label: string, commandId: string, holdMs: number) {
  const slots = yield* Slot;
  const sentAt = yield* Clock.currentTimeMillis;
  const exit = yield* Effect.exit(slots.send("s", Write.make({ label, holdMs }), { commandId }));
  const answeredAt = yield* Clock.currentTimeMillis;
  return { exit, took: answeredAt - sentAt };
});

/** How many times `label` is stored in the slot. */
const stored = Effect.fn("stored")(function* (label: string) {
  const slots = yield* Slot;
  const state = yield* slots.get("s");
  return A.filter(state.labels, (each) => each === label).length;
});

it.effect("a write sent to a frozen runner that resumes within the budget completes once; its retry gets the receipt", () => {
  const sim = makeSimHost(() => ({}));
  return onSlots(
    sim,
    Effect.gen(function* () {
      const slots = yield* Slot;
      yield* slots.send("s", Write.make({ label: "first", holdMs: 0 }));
      sim.freeze(0);
      const sending = yield* Effect.forkChild(sendTimed("B", "b", 0));
      yield* TestClock.adjust("10 seconds");
      // Nothing reached the frozen runner.
      expect(sim.committers(SLOT)).toEqual([0]);
      sim.thaw(0);
      yield* TestClock.adjust("2 seconds");
      const { exit, took } = yield* Fiber.join(sending);
      expect(Exit.isSuccess(exit)).toBe(true);
      expect(took).toBeLessThanOrEqual(TRANSIT_RETRY_BUDGET_MS);
      const again = yield* slots.send("s", Write.make({ label: "B", holdMs: 0 }), { commandId: "b" });
      expect(Exit.isSuccess(exit) ? exit.value : undefined).toEqual(again);
      expect(sim.committers(SLOT)).toEqual([0, 0]);
      const storedB = yield* stored("B");
      expect(storedB).toBe(1);
    }),
  );
});

it.effect("a write sent to a runner frozen past the budget fails at the budget, stores nothing, and is stored once when retried after the resume", () => {
  const sim = makeSimHost(() => ({}));
  return onSlots(
    sim,
    Effect.gen(function* () {
      const slots = yield* Slot;
      yield* slots.send("s", Write.make({ label: "first", holdMs: 0 }));
      sim.freeze(0);
      const answered = yield* Ref.make(false);
      const sending = yield* Effect.forkChild(sendTimed("C", "c", 0).pipe(Effect.ensuring(Ref.set(answered, true))));
      yield* TestClock.adjust(`${TRANSIT_RETRY_BUDGET_MS - 1} millis`);
      const beforeBudget = yield* Ref.get(answered);
      yield* TestClock.adjust("1 millis");
      const { exit, took } = yield* Fiber.join(sending);
      // The caller's attempt ends at the budget, with a failure; nothing was stored.
      expect(beforeBudget).toBe(false);
      expect(Exit.isFailure(exit)).toBe(true);
      expect(took).toBe(TRANSIT_RETRY_BUDGET_MS);
      expect(sim.committers(SLOT)).toEqual([0]);
      sim.thaw(0);
      const later = yield* slots.send("s", Write.make({ label: "C", holdMs: 0 }), { commandId: "c" });
      const again = yield* slots.send("s", Write.make({ label: "C", holdMs: 0 }), { commandId: "c" });
      expect(again).toEqual(later);
      expect(sim.committers(SLOT)).toEqual([0, 0]);
      const storedC = yield* stored("C");
      expect(storedC).toBe(1);
    }),
  );
});

it.effect("a write in flight when its runner froze, and one sent while it was frozen, after the shard moves: each stored once, each retry answered with its receipt", () => {
  const sim = makeSimHostWith({ fenced: true })(() => ({}));
  return onSlots(
    sim,
    Effect.gen(function* () {
      const slots = yield* Slot;
      sim.serveFrom(0);
      // A is deciding on runner 0 (a 5 s hold) when runner 0 freezes.
      const inFlight = yield* Effect.forkChild(sendTimed("A", "a", 5_000));
      yield* TestClock.adjust("1 second");
      sim.freeze(0);
      const sending = yield* Effect.forkChild(sendTimed("B", "b", 0));
      yield* TestClock.adjust("3 seconds");
      // The shard moves to runner 1: B's next retry reaches it.
      sim.serveFrom(1);
      yield* TestClock.adjust("2 seconds");
      const b = yield* Fiber.join(sending);
      // A's decide has ended; its commit waits on the frozen runner.
      yield* TestClock.adjust("5 seconds");
      expect(sim.committers(SLOT)).toEqual([1]);
      sim.thaw(0);
      // A's commit is fenced (runner 0 no longer serves), and its retry decides again on runner 1.
      yield* TestClock.adjust("10 seconds");
      const a = yield* Fiber.join(inFlight);
      expect(Exit.isSuccess(b.exit) && Exit.isSuccess(a.exit)).toBe(true);
      expect(b.took).toBeLessThanOrEqual(TRANSIT_RETRY_BUDGET_MS);
      expect(sim.committers(SLOT)).toEqual([1, 1]);
      const againA = yield* slots.send("s", Write.make({ label: "A", holdMs: 5_000 }), { commandId: "a" });
      const againB = yield* slots.send("s", Write.make({ label: "B", holdMs: 0 }), { commandId: "b" });
      expect([Exit.isSuccess(a.exit) ? a.exit.value : undefined, Exit.isSuccess(b.exit) ? b.exit.value : undefined]).toEqual([againA, againB]);
      expect(sim.committers(SLOT)).toEqual([1, 1]);
      const counts = yield* Effect.all([stored("A"), stored("B")]);
      expect(counts).toEqual([1, 1]);
    }),
  );
});
