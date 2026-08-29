import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Browser-mode suite for the graph renderer toggle (cosmos default, 3D opt-in,
// selection sync). Run with `bun run test:browser`; requires a Playwright
// chromium, matching the storybook CI lane's browser setup.
export default defineConfig({
  resolve: {
    alias: {
      // cosmos.gl imports gl-bench whose `main` is a default-less UMD build;
      // pin the shipped ESM build, mirroring the professional-desktop vite fix.
      "gl-bench": fileURLToPath(new URL("../../../node_modules/gl-bench/dist/gl-bench.module.js", import.meta.url)),
    },
  },
  test: {
    name: "ontology-client-browser",
    include: ["test/browser/**/*.test.{ts,tsx}"],
    testTimeout: 60_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),
      instances: [{ browser: "chromium" }],
    },
  },
});
