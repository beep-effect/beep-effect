/**
 * Conformance of the reference platform, `Domain.InMemory`: the scenarios
 * describe upstream semantics, so they must hold here first.
 *
 * The conformance platform runs on an explicit clock, so its scheduled
 * commands fire when a scenario advances it rather than when a timer wakes.
 */
import * as Domain from "@alchemy.run/domain";
import * as InMemory from "@alchemy.run/domain/InMemory";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { consumers } from "./consumers.ts";
import { conformance } from "./scenarios.ts";
import type { ScenarioClock } from "./scenarios.ts";

/** The explicit clock's time, in epoch milliseconds, from a fixed start; every built platform reads it. */
let clockMillis = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-01-01T00:00:00Z"));
/** Every platform built on the clock: a scenario may build a second one, and `advance` drains them all. */
const controls: Array<InMemory.Control> = [];

/** Builds a fresh in-memory platform on the explicit clock, as `Domain.InMemory` does on the wall clock. */
const platform = Layer.suspend(() => {
  const built = InMemory.make({ now: () => clockMillis });
  controls.push(built.control);
  return built.layer;
});

const clock: ScenarioClock = {
  advance: (millis) =>
    Effect.suspend(() => {
      clockMillis += millis;
      return Effect.forEach(controls, (control) => control.drain, { discard: true });
    }),
  now: Effect.sync(() => DateTime.makeUnsafe(clockMillis)),
};

conformance({
  name: "Domain.InMemory",
  base: Layer.empty,
  platform,
  durable: false,
  redelivers: false,
  clock,
});
consumers({ name: "Domain.InMemory", base: Layer.empty, platform: Domain.InMemory, durable: false });
