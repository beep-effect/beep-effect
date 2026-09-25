import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Coverage must retain per-file runtime and test-context isolation.
      isolate: true,
      // Package-specific overrides
    },
  })
);
