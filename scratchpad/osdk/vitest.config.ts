import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestDoctestActive } from "../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    root: import.meta.dirname,
    test: {
      include: vitestDoctestActive ? [] : ["test/**/*.test.ts"],
      includeSource: vitestDoctestActive ? ["src/**/*.ts"] : [],
      passWithNoTests: false,
    },
  })
);
