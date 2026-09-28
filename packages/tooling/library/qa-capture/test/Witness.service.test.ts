import { Witness } from "@beep/qa-capture";
import { it } from "@beep/test-runner";
import { describe, expect, vi } from "@effect/vitest";
import { Effect } from "effect";

describe("@beep/qa-capture witness bundling", { concurrent: false }, () => {
  it.layer(Witness.layer, { concurrent: false })(
    "bundles the witness source into a browser IIFE exposing __beepQa",
    (it) => {
      it.effect(
        "bundles the witness source into a browser IIFE exposing __beepQa",
        () =>
          Effect.gen(function* () {
            expect(vi.isMockFunction(Bun.build)).toBe(false);
            const build = yield* Effect.acquireRelease(
              Effect.sync(() => vi.spyOn(Bun, "build")),
              (spy) => Effect.sync(() => spy.mockRestore())
            );
            expect(build).toHaveBeenCalledTimes(0);
            const witness = yield* Witness;
            const script = yield* witness.script;
            expect(build).toHaveBeenCalledTimes(1);
            expect(script.length).toBeGreaterThan(0);
            expect(script).toContain("__beepQa");
            expect(script).toContain("/events");
            // The cancel-reset lens needs a ground-truth cancellation instant:
            // the witness must both listen for pointercancel and emit the
            // schema-modeled pointer-cancel kind.
            expect(script).toContain("pointercancel");
            expect(script).toContain("pointer-cancel");
            // The pass-through spy preserves native compilation and counts builds.
            expect(yield* witness.script).toBe(script);
            expect(build).toHaveBeenCalledTimes(1);
          }),
        20000
      );
    }
  );
  it.layer(Witness.layer, { concurrent: false })("builds once for a second independently owned witness layer", (it) => {
    it.effect(
      "builds once for a second independently owned witness layer",
      () =>
        Effect.gen(function* () {
          expect(vi.isMockFunction(Bun.build)).toBe(false);
          const build = yield* Effect.acquireRelease(
            Effect.sync(() => vi.spyOn(Bun, "build")),
            (spy) => Effect.sync(() => spy.mockRestore())
          );
          expect(build).toHaveBeenCalledTimes(0);
          const witness = yield* Witness;
          const script = yield* witness.script;
          expect(build).toHaveBeenCalledTimes(1);
          expect(script.length).toBeGreaterThan(0);
          expect(script).toContain("__beepQa");
          expect(script).toContain("/events");
          // The cancel-reset lens needs a ground-truth cancellation instant:
          // the witness must both listen for pointercancel and emit the
          // schema-modeled pointer-cancel kind.
          expect(script).toContain("pointercancel");
          expect(script).toContain("pointer-cancel");
          // The pass-through spy preserves native compilation and counts builds.
          expect(yield* witness.script).toBe(script);
          expect(build).toHaveBeenCalledTimes(1);
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
