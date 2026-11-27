import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../vitest.shared.ts";

const isolateMockingAndCwdChanges = true;
const coldCacheCanonicalizeTimeoutMs = 30_000;

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      isolate: isolateMockingAndCwdChanges,
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : coldCacheCanonicalizeTimeoutMs,
    },
  })
);
