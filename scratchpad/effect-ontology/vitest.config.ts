import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    root: import.meta.dirname,
    test: {
      include: ["test/**/*.test.ts"],
      passWithNoTests: false,
      coverage: {
        include: ["Domain/**/*.ts"],
      },
    },
  })
);
