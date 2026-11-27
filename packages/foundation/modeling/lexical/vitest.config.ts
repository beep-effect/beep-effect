import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, packageTestTimeout, vitestCoverageRunActive } from "../../../../vitest.shared.ts";

const recursiveSchemaSuiteTimeoutMs = 60_000;

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Deep schema sweeps and coverage instrumentation are CPU-bound enough
      // that running both Lexical test files together starves their 400-run
      // properties. Preserve normal file parallelism, but serialize the two
      // files for resource-intensive lanes while each suite serializes its own
      // tests.
      fileParallelism: !(vitestCoverageRunActive || fcDeepSweepActive),
      testTimeout: packageTestTimeout(recursiveSchemaSuiteTimeoutMs),
    },
  })
);
