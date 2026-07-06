import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestCoverageReportOnly } from "../../../../vitest.shared.ts";

const reportOnly = vitestCoverageReportOnly;

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      coverage: {
        thresholds: reportOnly
          ? {
              branches: 0,
              functions: 0,
              lines: 0,
              statements: 0,
            }
          : {
              // Calibrated to measured coverage (quality-gate-ratchets, 2026-07-06);
              // the repo coverage ratchet drives improvement from here.
              branches: 84,
              functions: 84,
              lines: 91,
              statements: 90,
            },
      },
    },
  })
);
