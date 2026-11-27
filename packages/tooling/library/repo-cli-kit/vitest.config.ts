import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

// decision: process-state-suites-run-in-order
const processStateSuiteOrder = {
  isolate: true,
  sequence: {
    concurrent: false,
  },
};

export default mergeConfig(
  shared,
  defineConfig({
    test: processStateSuiteOrder,
  })
);
