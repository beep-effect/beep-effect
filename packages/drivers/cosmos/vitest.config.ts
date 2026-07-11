import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      environment: "happy-dom",
      testTimeout: 30_000,
    },
  })
);
