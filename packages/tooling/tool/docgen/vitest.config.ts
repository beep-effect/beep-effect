import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 15_000,
    },
  })
);
