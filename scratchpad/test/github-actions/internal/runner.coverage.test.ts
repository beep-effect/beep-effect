import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { ActionEnvironment } from "../../../effected/github-actions/ActionEnvironment.ts";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { isWindowsRunner, toolCacheRoot } from "../../../effected/github-actions/internal/runner.ts";
it.layer(Layer.merge(MemoryFileSystem.layer, Path.layer), { timeout: 10000 })("runner dependencies", (it) => {
it.effect("runner defaults and case-insensitive Windows lookup", () => Effect.gen(function* () {
  const path = yield* Path.Path;
  const absent = yield* ActionEnvironment.makeTest({ RUNNER_OS: "", RUNNER_TOOL_CACHE: "" });
  assert.strictEqual(yield* isWindowsRunner(absent), false);
  assert.strictEqual(yield* toolCacheRoot(path)(absent), path.join("/tmp", "runner-tool-cache"));
  const windows = yield* ActionEnvironment.makeTest({ RUNNER_OS: "wInDoWs", RUNNER_TOOL_CACHE: "/custom" });
  assert.strictEqual(yield* isWindowsRunner(windows), true);
  assert.strictEqual(yield* toolCacheRoot(windows, path), "/custom");
}));
});
