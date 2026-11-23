import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestCoverageReportOnly } from "../../../../vitest.shared.ts";

const coverageThresholds = vitestCoverageReportOnly
  ? {}
  : {
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    };

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      coverage: {
        include: ["src/**/*.ts"],
        ...coverageThresholds,
      },
    },
  })
);
