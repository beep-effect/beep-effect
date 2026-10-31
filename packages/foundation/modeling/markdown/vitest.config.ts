import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Registry spies need a fresh module context for every test file, including coverage.
      isolate: true,
    },
  })
);
