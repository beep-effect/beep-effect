import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Tests here depend on per-file module state (runtime error singletons, property
      // instrumentation, the wink engine); keep every file in its own worker even under coverage
      // (vitest.shared.ts shares the graph there by default).
      isolate: true,
    },
  })
);
