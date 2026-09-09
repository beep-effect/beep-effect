import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      exclude: ["test/fixtures/**"],
      fileParallelism: false,
      globalSetup: [new URL("./test/global-cleanup.ts", import.meta.url).pathname],
      sequence: {
        concurrent: false,
      },
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 30_000,
    },
  })
);
