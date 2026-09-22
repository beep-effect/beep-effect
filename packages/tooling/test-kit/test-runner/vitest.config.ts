import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Preserve the source suite's ordering: lifecycle assertions inspect prior tests.
      sequence: { concurrent: false },
    },
  })
);
