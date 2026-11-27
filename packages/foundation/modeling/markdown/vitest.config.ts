import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

// decision: isolated-test-files
const isolatedTestFiles = {
  isolate: true,
};

export default mergeConfig(
  shared,
  defineConfig({
    test: isolatedTestFiles,
  })
);
