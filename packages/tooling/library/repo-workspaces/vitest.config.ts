import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

// decision: sequential-isolated-test-files
const sequentialIsolatedTestFiles = {
  isolate: true,
  sequence: {
    concurrent: false,
  },
};

export default mergeConfig(
  shared,
  defineConfig({
    test: sequentialIsolatedTestFiles,
  })
);
