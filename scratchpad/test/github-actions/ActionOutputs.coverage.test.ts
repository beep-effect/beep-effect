import { assert, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ActionEnvironment } from "../../effected/github-actions/ActionEnvironment.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as S from "effect/Schema";
import { ActionOutputs, RunnerFileUnavailableError, RunnerFileWriteError, InvalidOutputNameError, OutputEncodeError, DetachedOutputError } from "../../effected/github-actions/ActionOutputs.ts";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";

it.layer(ActionOutputs.layerTest(), { timeout: "30 seconds" })((it) => {
  it.effect("every unstubbed output operation defects with its member and override", () => Effect.gen(function* () {
    const outputs = yield* ActionOutputs;
    const calls = [
      ["set", outputs.set("key", "value")],
      ["setJson", outputs.setJson("key", "value", S.String)],
      ["summary", outputs.summary("body")],
      ["exportVariable", outputs.exportVariable("key", "value")],
      ["addPath", outputs.addPath("/bin")],
      ["setFailed", outputs.setFailed("failed")],
      ["setSecret", outputs.setSecret("secret")],
    ] as const;
    for (const [member, call] of calls) {
      assertExitFailure(yield* Effect.exit(call), Cause.die(UnstubbedMemberError.make({ message: `ActionOutputs.makeTest: ${member}() was called but not stubbed — pass a \`${member}\` override.` })));
    }
  }));
});
it.effect("output failures identify the affected runner file or value", () => Effect.sync(() => {
  assert.strictEqual(RunnerFileUnavailableError.make({ file: "GITHUB_OUTPUT" }).message, 'Runner file "GITHUB_OUTPUT" is not available; is this running on a GitHub runner?');
  assert.strictEqual(RunnerFileWriteError.make({ file: "GITHUB_ENV" }).message, 'Failed to write to runner file "GITHUB_ENV"');
  assert.strictEqual(InvalidOutputNameError.make({ name: "bad=name" }).message, '"bad=name" is not a usable output name');
  assert.strictEqual(OutputEncodeError.make({ name: "packages" }).message, 'Failed to encode the value for "packages"');
  assert.strictEqual(DetachedOutputError.make({ file: "GITHUB_PATH" }).message, 'Runner file "GITHUB_PATH" cannot be reached from a detached worker — it configures the parent job\'s later steps, and a worker has none and may outlive the job. Publish this from the parent process instead.');
}));

it.layer(ActionOutputs.layer.pipe(Layer.provide(Layer.mergeAll(ActionEnvironment.layerTest({ GITHUB_OUTPUT: "/missing/output" }), MemoryFileSystem.layer))), { timeout: "30 seconds" })((it) => {
  it.effect("a failed append keeps the runner file and filesystem cause", () => Effect.gen(function* () {
    const error = yield* Effect.flip((yield* ActionOutputs).set("key", "value"));
    assert.strictEqual(error._tag, "RunnerFileWriteError");
    if (S.is(RunnerFileWriteError)(error)) assert.strictEqual(error.file, "GITHUB_OUTPUT");
    else assert.fail("expected RunnerFileWriteError");
    assert.isDefined(error.cause);
  }));
});
