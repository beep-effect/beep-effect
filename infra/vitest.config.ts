import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestDoctestActive } from "../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    ssr: {
      external: ["@pulumi/gharunners"],
    },
    test: {
      environment: "node",
      include: vitestDoctestActive ? [] : ["test/**/*.test.ts"],
    },
  })
);
