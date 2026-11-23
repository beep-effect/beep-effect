import * as NodeURL from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestCoverageReportOnly } from "../../../../vitest.shared.ts";

const reportOnly = vitestCoverageReportOnly;

const coverageFloorMeasured20260706RaisedOnlyByRepoRatchet = {
  branches: 84,
  functions: 84,
  lines: 91,
  statements: 90,
};

const markdownConformanceJsonAliasAheadOfSharedSrcAlias = {
  find: /^@beep\/markdown\/conformance\/(.*)$/,
  replacement: `${NodeURL.fileURLToPath(new URL("../markdown/data/conformance/", import.meta.url))}$1.json`,
};

export default mergeConfig(
  shared,
  defineConfig({
    resolve: {
      alias: [markdownConformanceJsonAliasAheadOfSharedSrcAlias],
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
          : coverageFloorMeasured20260706RaisedOnlyByRepoRatchet,
      },
    },
  })
);
