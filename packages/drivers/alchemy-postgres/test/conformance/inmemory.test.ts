/**
 * Conformance of the reference platform, `Domain.InMemory`: the scenarios
 * describe upstream semantics, so they must hold here first.
 */
import * as Domain from "@alchemy.run/domain";
import * as InMemory from "@alchemy.run/domain/InMemory";
import { layer } from "@effect/vitest";
import { strictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { conformance } from "./scenarios.ts";

conformance({
  name: "Domain.InMemory",
  base: Layer.empty,
  platform: Domain.InMemory,
  durable: false,
  redelivers: false,
});

class TimerFired extends Domain.Event("TimerFired", {}) {}
class FireTimer extends Domain.Command("FireTimer", { target: S.String, input: {}, events: [TimerFired] }) {}
class TimerCounter extends Domain.Aggregate("TimerCounter", {
  id: S.String,
  state: S.Int,
  initial: 0,
  commands: [FireTimer],
  decide: { FireTimer: () => [TimerFired.make({})] },
  evolve: { TimerFired: (count) => count + 1 },
}) {}
class TimerRegression extends Domain.Model("TimerRegression", { aggregates: [TimerCounter] }) {}

// This one-test layer owns the clock used by both its model and timer fibers.
const wallClock = MutableRef.make(0);
const timerPlatform = InMemory.make({ now: () => MutableRef.get(wallClock) });
const timerLayer = TimerRegression.layer(Layer.empty).pipe(Layer.provide(timerPlatform.layer));

layer(timerLayer, { timeout: "10 seconds" })("InMemory early-wake regression", (it) => {
  it.effect("rearms until its wall-clock deadline and fires once", () =>
    Effect.gen(function* () {
      // Separate the platform wall clock from its sleep clock: an early wake
      // must not consume the only timer notification before the deadline.
      MutableRef.set(wallClock, 0);
      const timers = yield* TimerCounter;
      yield* timers.schedule("timer", FireTimer.make({}), { after: "10 millis", commandId: "early" });
      yield* TestClock.adjust("10 millis");
      const count0 = yield* timers.state("timer");
      strictEqual(count0, 0);

      MutableRef.set(wallClock, 5);
      yield* TestClock.adjust("10 millis");
      const count1 = yield* timers.state("timer");
      strictEqual(count1, 0);

      MutableRef.set(wallClock, 10);
      yield* TestClock.adjust("5 millis");
      const count2 = yield* timers.state("timer");
      strictEqual(count2, 1);
      yield* TestClock.adjust("20 millis");
      const count3 = yield* timers.state("timer");
      strictEqual(count3, 1);
      const executed = yield* timers.unschedule("timer", "early").pipe(Effect.flip);
      strictEqual(executed._tag, "AlreadyExecuted");
    })
  );
});
