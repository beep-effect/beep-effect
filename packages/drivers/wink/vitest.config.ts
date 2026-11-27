import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../vitest.shared.ts";

const isolateMutatedWinkModelState = true;

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      isolate: isolateMutatedWinkModelState,
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 20_000,
    },
  })
);
