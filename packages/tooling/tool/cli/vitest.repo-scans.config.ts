import { defineConfig, mergeConfig } from "vitest/config";
import shared, { packageTestTimeout } from "../../../../vitest.shared.ts";

export const repoScanSuites = [
  "test/cross-package-read-census.test.ts",
  "test/goal-data-consumer-census.test.ts",
  "test/property-sweep-live-checkout.test.ts",
  "test/tracked-turbo-configurations.test.ts",
];

Reflect.deleteProperty(process.env, "BEEP_YEET_PROOF_BASE");
Reflect.deleteProperty(process.env, "BEEP_YEET_INNER_LANE_REPORT_PATH");
Reflect.deleteProperty(process.env, "BEEP_YEET_INNER_LANE_PARENT_ID");

const config = mergeConfig(
  shared,
  defineConfig({
    test: {
      env: {
        BEEP_TURBO_HOST_CACHE_DISABLED: "true",
        TURBO_API: "",
        TURBO_TOKEN: "",
        TURBO_TEAM: "",
        TURBO_CACHE: "",
        TURBO_REMOTE_CACHE_SIGNATURE_KEY: "",
      },
      testTimeout: packageTestTimeout(120_000),
    },
  })
);

export default { ...config, test: { ...config.test, include: repoScanSuites } };
