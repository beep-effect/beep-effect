import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Runtime-boundary tests disable Node built-ins before lazy handles resolve.
      // Earlier files must not populate those handles in the same module instance.
      isolate: true,
    },
  })
);
