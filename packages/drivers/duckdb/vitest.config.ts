import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive, vitestDoctestActive } from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      include: vitestDoctestActive ? [] : ["test/**/*.test.ts"],
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 20_000,
    },
  })
);
