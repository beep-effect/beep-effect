import { Witness } from "@beep/qa-capture";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("@beep/qa-capture witness bundling", () => {
  it.effect(
    "bundles the witness source into a browser IIFE exposing __beepQa",
    () =>
      Effect.gen(function* () {
        const witness = yield* Witness;
        const script = yield* witness.script;
        expect(script.length).toBeGreaterThan(0);
        expect(script).toContain("__beepQa");
        expect(script).toContain("/events");
        // Bundling is cached: a second request returns the identical text.
        expect(yield* witness.script).toBe(script);
      }).pipe(provideScopedLayer(Witness.layer)),
    20000
  );

  it.effect("serves a fixed script through the test layer", () =>
    Effect.gen(function* () {
      const witness = yield* Witness;
      expect(yield* witness.script).toBe("(()=>{})();");
    }).pipe(provideScopedLayer(Witness.layerScript("(()=>{})();")))
  );
});
