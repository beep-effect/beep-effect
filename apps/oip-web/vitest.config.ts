import * as NodeURL from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestDoctestActive } from "../../vitest.shared.ts";

// decision: isolated-browser-test-environment
const browserTestEnv = {
  CRM_HUBSPOT_ACCOUNT_ID: "",
  HUBSPOT_ACCOUNT_ID: "",
  CRM_HUBSPOT_SERVICE_KEY: "",
  HUBSPOT_SERVICE_KEY: "",
  CRM_HUBSPOT_FORM_GUID: "",
  HUBSPOT_FORM_GUID: "",
  SANITY_PROJECT_ID: "",
  SANITY_DATASET: "",
  SANITY_API_HOST: "",
  SANITY_API_VERSION: "",
  SANITY_API_TOKEN: "",
};

export default mergeConfig(
  shared,
  defineConfig({
    resolve: {
      alias: {
        "@": NodeURL.fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      env: browserTestEnv,
      isolate: true,
      environment: "jsdom",
      include: vitestDoctestActive ? [] : ["test/**/*.test.{ts,tsx}"],
      setupFiles: [NodeURL.fileURLToPath(new URL("./test/setup.dom.ts", import.meta.url))],
    },
  })
);
