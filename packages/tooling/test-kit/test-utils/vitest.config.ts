import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestCoverageReportOnly } from "../../../../vitest.shared.ts";

const coverageThresholds = vitestCoverageReportOnly
  ? {}
  : {
      thresholds: {
        // Calibrated to CI-measured coverage (quality-gate-ratchets,
        // 2026-07-06): environment-conditional tests (PGLite/docker-gated)
        // skip on CI, so CI measures lower than local (56/37/55/16 vs
        // local ~60+). The repo coverage ratchet guards regressions.
        branches: 16,
        functions: 37,
        lines: 56,
        statements: 55,
      },
    };

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      coverage: coverageThresholds,
      globals: true,
    },
  })
);
