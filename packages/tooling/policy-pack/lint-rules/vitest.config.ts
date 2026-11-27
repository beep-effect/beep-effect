import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../../vitest.shared.ts";

// decision: rule-harness-tests-run-serially
const ruleHarnessTestOptions = {
  sequence: { concurrent: false },
  fileParallelism: false,
  testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 30_000,
};

export default mergeConfig(shared, defineConfig({ test: ruleHarnessTestOptions }));
