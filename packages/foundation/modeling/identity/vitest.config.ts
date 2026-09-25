import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Keep all test runs isolated; shared config disables isolation for coverage.
      isolate: true,
      // Package-specific overrides
    },
  })
);
