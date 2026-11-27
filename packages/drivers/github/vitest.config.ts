import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

// decision: ported-suites-run-sequentially
const sequentialSuiteOrder = {
  sequence: { concurrent: false },
};

export default mergeConfig(
  shared,
  defineConfig({
    test: sequentialSuiteOrder,
  })
);
