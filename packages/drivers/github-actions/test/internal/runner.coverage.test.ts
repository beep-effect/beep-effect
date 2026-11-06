import { ActionEnvironment } from "@beep/github-actions/ActionEnvironment";
import { isWindowsRunner, toolCacheRoot } from "@beep/github-actions/internal/runner";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

it.layer(Layer.merge(MemoryFileSystem.layer, Path.layer), { timeout: 10000 })("runner dependencies", (it) => {
  it.effect("runner defaults and case-insensitive Windows lookup", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const absent = yield* ActionEnvironment.makeTest({ RUNNER_OS: "", RUNNER_TOOL_CACHE: "" });
      const isWindowsRunner1 = yield* isWindowsRunner(absent);
      assert.strictEqual(isWindowsRunner1, false);
      const value = yield* toolCacheRoot(path)(absent);
      assert.strictEqual(value, path.join("/tmp", "runner-tool-cache"));
      const windows = yield* ActionEnvironment.makeTest({ RUNNER_OS: "wInDoWs", RUNNER_TOOL_CACHE: "/custom" });
      const isWindowsRunner2 = yield* isWindowsRunner(windows);
      assert.strictEqual(isWindowsRunner2, true);
      const toolCacheRoot3 = yield* toolCacheRoot(windows, path);
      assert.strictEqual(toolCacheRoot3, "/custom");
    })
  );
});
