import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../vitest.shared.ts";

const coldCacheCanonicalizeTimeoutMs = 30_000;

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Tests here mock modules, stub globals, or change the working directory; keep every file in
      // its own worker even under coverage (vitest.shared.ts shares the graph there by default).
      isolate: true,
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : coldCacheCanonicalizeTimeoutMs,
    },
  })
);
