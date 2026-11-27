import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../vitest.shared.ts";

const coldCacheCanonicalizeTimeoutMs = 30_000;

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      isolate: true,
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : coldCacheCanonicalizeTimeoutMs,
    },
  })
);
