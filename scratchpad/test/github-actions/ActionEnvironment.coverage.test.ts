import { assert, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ActionEnvironment, ActionEnvironmentError } from "../../effected/github-actions/ActionEnvironment.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
it.layer(ActionEnvironment.layerFrom({ X: "", RUNNER_DEBUG: "0" }).pipe(Layer.provide(MemoryFileSystem.layer)), { timeout: "30 seconds" })((it) => {
  it.effect("empty values and a present non-debug flag remain absent and disabled", () => Effect.gen(function* () {
    const env = yield* ActionEnvironment;
    assertNone(yield* env.getOptional("X"));
    assert.isFalse(yield* env.isDebug);
    assert.strictEqual((yield* Effect.flip(env.get("X"))).reason, "missing");
  }));
});
it.effect("malformed environment diagnostics allow missing detail", () => Effect.sync(() => {
  assert.strictEqual(ActionEnvironmentError.make({ reason: "malformed", name: "X" }).message, 'Environment variable "X" is malformed');
  assert.strictEqual(ActionEnvironmentError.make({ reason: "malformed", name: "X", detail: "bad" }).message, 'Environment variable "X" is malformed: bad');
}));
