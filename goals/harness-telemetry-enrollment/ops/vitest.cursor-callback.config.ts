import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";
export default mergeConfig(
  shared,
  defineConfig({
    test: {
      include: ["goals/harness-telemetry-enrollment/ops/test-cursor-lifecycle-hook.ts"],
      fileParallelism: false,
      testTimeout: 30000,
    },
  })
);
