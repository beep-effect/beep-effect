import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestDoctestActive } from "../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      include: vitestDoctestActive ? [] : ["test/**/*.test.{ts,tsx}"],
    },
  })
);
