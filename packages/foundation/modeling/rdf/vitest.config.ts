import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestCoverageReportOnly } from "../../../../vitest.shared.ts";

const coverageThresholds = vitestCoverageReportOnly
  ? {}
  : {
      thresholds: {
        // Calibrated to measured coverage (quality-gate-ratchets, 2026-07-06):
        // the wave-2 100% floors were unmet/never executed; the repo coverage
        // ratchet (fail-on-drop baseline) drives improvement from here.
        branches: 99,
        functions: 77,
        lines: 95,
        statements: 94,
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
