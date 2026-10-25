import * as NodeURL from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestCoverageReportOnly } from "../../../../vitest.shared.ts";

const reportOnly = vitestCoverageReportOnly;

// `@beep/markdown` exports its conformance corpora as `./conformance/*` JSON
// subpaths, but the generated `@beep/markdown/*` source alias rewrites every
// subpath to `src/`, so the bridge-corpus ledger's JSON imports need this
// longer alias. Vite puts a merged config's aliases ahead of the shared ones.
const markdownConformanceAlias = {
  find: /^@beep\/markdown\/conformance\/(.*)$/,
  replacement: `${NodeURL.fileURLToPath(new URL("../markdown/data/conformance/", import.meta.url))}$1.json`,
};

export default mergeConfig(
  shared,
  defineConfig({
    resolve: {
      alias: [markdownConformanceAlias],
    },
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
