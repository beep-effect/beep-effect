import { Witness } from "@beep/qa-capture";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

describe("@beep/qa-capture witness bundling", () => {
  it.layer(Witness.layer)("bundles the witness source into a browser IIFE exposing __beepQa", (it) => {
    it.effect(
      "bundles the witness source into a browser IIFE exposing __beepQa",
      () =>
        Effect.gen(function* () {
          const witness = yield* Witness;
          const script = yield* witness.script;
          expect(script.length).toBeGreaterThan(0);
          expect(script).toContain("__beepQa");
          expect(script).toContain("/events");
          // The cancel-reset lens needs a ground-truth cancellation instant:
          // the witness must both listen for pointercancel and emit the
          // schema-modeled pointer-cancel kind.
          expect(script).toContain("pointercancel");
          expect(script).toContain("pointer-cancel");
          // Bundling is cached: a second request returns the identical text.
          expect(yield* witness.script).toBe(script);
        }),
      20000
    );
  });

  it.layer(Witness.layerScript("(()=>{})();"))("serves a fixed script through the test layer", (it) => {
    it.effect("serves a fixed script through the test layer", () =>
      Effect.gen(function* () {
        const witness = yield* Witness;
        expect(yield* witness.script).toBe("(()=>{})();");
      })
    );
  });
});
