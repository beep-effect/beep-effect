import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, packageTestTimeout, vitestCoverageRunActive } from "../../../../vitest.shared.ts";

const recursiveSchemaSuiteTimeoutMs = 60_000;

// decision: serial-files-on-heavy-lanes
const serialFilesOnHeavyLanes = {
  fileParallelism: !(vitestCoverageRunActive || fcDeepSweepActive),
};

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      ...serialFilesOnHeavyLanes,
      testTimeout: packageTestTimeout(recursiveSchemaSuiteTimeoutMs),
    },
  })
);
