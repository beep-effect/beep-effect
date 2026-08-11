import path from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      exclude: ["test/fixtures/**"],
      fileParallelism: false,
      globalSetup: [path.join(import.meta.dirname, "test/global-cleanup.ts")],
      sequence: {
        concurrent: false,
      },
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 30_000,
    },
  })
);
