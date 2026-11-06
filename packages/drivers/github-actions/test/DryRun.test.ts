import { ActionInput, ActionLogger, DryRun } from "@beep/github-actions";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestConsole from "effect/testing/TestConsole";

const lines = Effect.map(TestConsole.logLines, (captured) => A.map(captured, String));

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
            const lines1 = yield* lines;
            assert.deepStrictEqual(lines1, ["[DRY-RUN] publish @acme/thing@1.2.3"]);
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
            const lines2 = yield* lines;
            assert.deepStrictEqual(lines2, [], "a real run announces nothing");
          })
        );
      });
    });

    it.layer(DryRun.layerFrom(true), { timeout: "30 seconds" })((it) => {
      it.effect("isDryRun reports the mode", () =>
        Effect.gen(function* () {
          const isDryRun3 = yield* (yield* DryRun).isDryRun;
          assert.isTrue(isDryRun3);
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
          const isDryRun4 = yield* (yield* DryRun).isDryRun;
          assert.isTrue(isDryRun4);
        })
      );
    });

    it.layer(DryRun.layer.pipe(Layer.provide(ActionInput.layer({}))), { timeout: "30 seconds" })((it) => {
      it.effect("defaults to a real run when the input is absent", () =>
        Effect.gen(function* () {
          const isDryRun5 = yield* (yield* DryRun).isDryRun;
          assert.isFalse(isDryRun5);
        })
      );
    });

    it.layer(DryRun.layer.pipe(Layer.provide(ActionInput.layer({ "dry-run": "" }))), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("defaults to a real run when the input is the empty string the runner writes", () =>
        Effect.gen(function* () {
          const isDryRun6 = yield* (yield* DryRun).isDryRun;
          assert.isFalse(isDryRun6);
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
          const isDryRun7 = yield* (yield* DryRun).isDryRun;
          assert.isTrue(isDryRun7);
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
            const isDryRun8 = yield* (yield* DryRun).isDryRun;
            assert.isTrue(isDryRun8);
            yield* (yield* DryRun).guard("publish", effect, "rehearsed");
            assert.deepStrictEqual(performed, []);
          })
        );
      });
    });

    it.layer(DryRun.layerTest({ isDryRun: Effect.succeed(false) }), { timeout: "30 seconds" })((it) => {
      it.effect("an override wins over the default", () =>
        Effect.gen(function* () {
          const isDryRun9 = yield* (yield* DryRun).isDryRun;
          assert.isFalse(isDryRun9);
        })
      );
    });
  });
});
