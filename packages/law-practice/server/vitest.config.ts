import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    // Real native worker tests include cold module loading. Bound the test
    // runner fan-out so it does not consume the production deadline itself.
    // Each native owner still enforces its configured queue/execution limits.
    test: { maxWorkers: 2, maxConcurrency: 2 },
  })
);
