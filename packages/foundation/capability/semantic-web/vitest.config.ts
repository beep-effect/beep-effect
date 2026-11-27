import { defineConfig, mergeConfig } from "vitest/config";
import shared, { packageTestTimeout } from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      testTimeout: packageTestTimeout(30_000),
    },
  })
);
