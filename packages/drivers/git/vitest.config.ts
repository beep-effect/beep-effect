import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

// decision: staged-integration-fixtures-run-in-order
const stagedFixtureOrder = {
  sequence: { concurrent: false },
};

export default mergeConfig(
  shared,
  defineConfig({
    test: stagedFixtureOrder,
  })
);
