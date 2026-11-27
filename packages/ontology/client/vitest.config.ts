import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

const suitesRunByVitestBrowserConfig = ["test/browser/**"];

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      isolate: true,
      exclude: suitesRunByVitestBrowserConfig,
    },
  })
);
