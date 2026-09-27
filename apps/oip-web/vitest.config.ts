import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestDoctestActive } from "../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      // Effect's default ConfigProvider snapshots the worker environment. Configure absence
      // before module loading so route-owned runtimes cannot inherit live provider settings.
      env: {
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
      },
      // Tests here mock modules, stub globals, or change the working directory; keep every file in
      // its own worker even under coverage (vitest.shared.ts shares the graph there by default).
      isolate: true,
      environment: "jsdom",
      include: vitestDoctestActive ? [] : ["test/**/*.test.{ts,tsx}"],
      setupFiles: [new URL("./test/setup.dom.ts", import.meta.url).pathname],
    },
  })
);
