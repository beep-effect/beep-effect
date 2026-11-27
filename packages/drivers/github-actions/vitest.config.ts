import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

// decision: ported-suites-run-in-order
const portedSuiteOrder = {
  sequence: { concurrent: false },
};

export default mergeConfig(
  shared,
  defineConfig({
    test: portedSuiteOrder,
  })
);
