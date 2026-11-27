import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

const suitesForVitestBrowserConfig = ["test/browser/**"];

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      exclude: suitesForVitestBrowserConfig,
    },
  })
);
