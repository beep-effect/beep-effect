import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { TestConsole } from "effect/testing";
import { ActionInput, ActionLogger, DryRun } from "../../effected/github-actions/index.ts";

const lines = Effect.map(TestConsole.logLines, (captured) => captured.map(String));

/** A mutation that records the fact it ran, so "did not run" is observable. */
const mutation = () => {
  const performed: Array<string> = [];
  const effect = Effect.sync(() => {
    performed.push("ran");
    return "real";
  });
  return { performed, effect };
};

describe("DryRun", () => {
  describe("guard", () => {
    it.layer(DryRun.layerFrom(true), { timeout: "30 seconds" })((it) => {
      it.effect("skips the mutation and takes the fallback when rehearsing", () =>
        Effect.gen(function* () {
          const { performed, effect } = mutation();
          const result = yield* (yield* DryRun).guard("publish", effect, "rehearsed");
          assert.strictEqual(result, "rehearsed");
          assert.deepStrictEqual(performed, [], "a rehearsal must not perform the mutation");
        })
      );
    });

    it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
      it.layer(DryRun.layerFrom(true), { timeout: "30 seconds" })((it) => {
        it.effect("reports what it would have done", () =>
          Effect.gen(function* () {
            yield* (yield* DryRun).guard("publish @acme/thing@1.2.3", Effect.succeed("real"), "rehearsed");
            assert.deepStrictEqual(yield* lines, ["[DRY-RUN] publish @acme/thing@1.2.3"]);
          })
        );
      });
    });

    it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
      it.layer(DryRun.layerFrom(false), { timeout: "30 seconds" })((it) => {
        it.effect("runs the mutation for real otherwise", () =>
          Effect.gen(function* () {
            const { performed, effect } = mutation();
            const result = yield* (yield* DryRun).guard("publish", effect, "rehearsed");
            assert.strictEqual(result, "real");
            assert.deepStrictEqual(performed, ["ran"]);
            assert.deepStrictEqual(yield* lines, [], "a real run announces nothing");
          })
        );
      });
    });

    it.layer(DryRun.layerFrom(true), { timeout: "30 seconds" })((it) => {
      it.effect("isDryRun reports the mode", () =>
        Effect.gen(function* () {
          assert.isTrue(yield* (yield* DryRun).isDryRun);
        })
      );
    });
  });

  describe("driven by the action input", () => {
    // Input-name keyed, `with:`-block style: mangling remains in ActionInput.
    it.layer(DryRun.layer.pipe(Layer.provide(ActionInput.layer({ "dry-run": "true" }))), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("reads a true input", () =>
        Effect.gen(function* () {
          assert.isTrue(yield* (yield* DryRun).isDryRun);
        })
      );
    });

    it.layer(DryRun.layer.pipe(Layer.provide(ActionInput.layer({}))), { timeout: "30 seconds" })((it) => {
      it.effect("defaults to a real run when the input is absent", () =>
        Effect.gen(function* () {
          assert.isFalse(yield* (yield* DryRun).isDryRun);
        })
      );
    });

    it.layer(DryRun.layer.pipe(Layer.provide(ActionInput.layer({ "dry-run": "" }))), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("defaults to a real run when the input is the empty string the runner writes", () =>
        Effect.gen(function* () {
          assert.isFalse(yield* (yield* DryRun).isDryRun);
        })
      );
    });

    it.layer(ActionInput.layer({ "INPUT_DRY-RUN": "yes" }), { timeout: "30 seconds" })((it) => {
      it.effect("refuses a malformed input rather than defaulting it away", () =>
        // The discriminating case, and the reason `ActionInput`'s validation
        // errors carry their `actual` value: `Config.withDefault` falls back for
        // MISSING data only, and an `InvalidValue` with no actual is classified
        // as missing. Without that, `dry-run: yes` would silently resolve to
        // `false` and the action would perform every mutation it was asked to
        // rehearse — the worst possible direction for this particular default.
        Effect.gen(function* () {
          const error = yield* DryRun.layer.pipe(Layer.build, Effect.flip);
          assert.strictEqual(error._tag, "ConfigError");
          assert.include(error.message, "YAML 1.2 core schema");
        })
      );
    });

    it.layer(
      DryRun.layerFromInput("rehearse only").pipe(Layer.provide(ActionInput.layer({ "rehearse only": "true" }))),
      {
        timeout: "30 seconds",
      }
    )((it) => {
      it.effect("layerFromInput reads the name it is given", () =>
        Effect.gen(function* () {
          assert.isTrue(yield* (yield* DryRun).isDryRun);
        })
      );
    });
  });

  describe("test double", () => {
    it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
      it.layer(DryRun.layerTest(), { timeout: "30 seconds" })((it) => {
        it.effect("defaults to rehearsing, which is the safe direction", () =>
          Effect.gen(function* () {
            const { performed, effect } = mutation();
            assert.isTrue(yield* (yield* DryRun).isDryRun);
            yield* (yield* DryRun).guard("publish", effect, "rehearsed");
            assert.deepStrictEqual(performed, []);
          })
        );
      });
    });

    it.layer(DryRun.layerTest({ isDryRun: Effect.succeed(false) }), { timeout: "30 seconds" })((it) => {
      it.effect("an override wins over the default", () =>
        Effect.gen(function* () {
          assert.isFalse(yield* (yield* DryRun).isDryRun);
        })
      );
    });
  });
});
