import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Browser-mode suite for the graph renderer toggle (cosmos default, 3D opt-in,
// selection sync). Run with `bun run test:browser`; requires a Playwright
// chromium, matching the storybook CI lane's browser setup.
// Since @cosmos.gl/graph 3.4.2 the package imports gl-bench's shipped ESM
// build by its deep path, so the former `gl-bench` alias (which a bare-name
// prefix rewrite would turn into a doubled, nonexistent path) is gone here and
// in the professional-desktop vite config alike.
export default defineConfig({
  // Rolldown deconflicts effect/schema and effect/Schema as case-colliding
  // entry names, but Vite indexes them by their original names. Keep the
  // lowercase namespace as native ESM so both public modules remain distinct.
  optimizeDeps: { exclude: ["effect/schema"] },
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
