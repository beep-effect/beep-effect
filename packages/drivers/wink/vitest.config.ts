import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Coverage must retain per-file runtime and test-context isolation.
      isolate: true,
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 20_000,
    },
  })
);
