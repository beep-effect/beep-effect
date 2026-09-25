import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // TaggedError.equivalence stubs `process.getBuiltinModule` to reach the
      // private Node runtime errors, and Path/FileSystem/NodeUrl cache their
      // builtin handles at module level, so the stub only works on a fresh
      // module graph. Opt back out of the shared-worker coverage isolation.
      isolate: true,
    },
  })
);
