import { assert, it } from "@effect/vitest";
import { assertExitFailure, assertNone } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { ActionEnvironment } from "../../effected/github-actions/ActionEnvironment.ts";
import { ActionOutputs } from "../../effected/github-actions/ActionOutputs.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as S from "effect/Schema";
import { ActionState, ActionStateError } from "../../effected/github-actions/ActionState.ts";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";
it.layer(ActionState.layerTest(), { timeout: "30 seconds" })((it) => {
  it.effect("every unstubbed state member defects naming its override", () => Effect.gen(function* () {
    const state = yield* ActionState;
    const calls = [["save", state.save("k", "v", S.String)], ["get", state.get("k", S.String)], ["getOptional", state.getOptional("k", S.String)], ["saveSecret", state.saveSecret("k", "secret")]] as const;
    for (const [member, call] of calls) {
      assertExitFailure(yield* Effect.exit(call), Cause.die(UnstubbedMemberError.make({ message: `ActionState.makeTest: ${member}() was called but not stubbed — pass a \`${member}\` override.` })));
    }
  }));
});
it.effect("state diagnostics distinguish missing, malformed and write failures", () => Effect.sync(() => {
  assert.strictEqual(ActionStateError.make({ reason: "missing", key: "token" }).message, 'No action state was saved under "token"');
  assert.strictEqual(ActionStateError.make({ reason: "malformed", key: "token" }).message, 'Action state under "token" could not be decoded');
  assert.strictEqual(ActionStateError.make({ reason: "writeFailed", key: "token" }).message, 'Failed to persist action state under "token"');
}));

it.layer(ActionState.layer.pipe(Layer.provideMerge(Layer.mergeAll(ActionEnvironment.layerTest({ GITHUB_STATE: "/state" }), MemoryFileSystem.layer, ActionOutputs.layerTest()))), { timeout: "30 seconds" })((it) => {
  it.effect("saving a value rejected by its codec fails malformed before writing", () => Effect.gen(function* () {
    const error = yield* Effect.flip((yield* ActionState).save("count", 1.5, S.Int));
    assert.strictEqual(error.reason, "malformed");
    assert.strictEqual(error.key, "count");
    assert.isDefined(error.cause);
    assertNone(yield* Effect.option((yield* FileSystem.FileSystem).readFileString("/state")));
  }));
});
