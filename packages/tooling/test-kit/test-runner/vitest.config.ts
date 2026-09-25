import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Exercise cached instrumentation across files in every package test run.
      isolate: false,
      maxWorkers: 1,
      // Preserve the source suite's ordering: lifecycle assertions inspect prior tests.
      sequence: { concurrent: false },
    },
  })
);
