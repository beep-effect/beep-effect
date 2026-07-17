import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Browser-mode suite for the renderer (mount / node count / select-dim /
// destroy). Run with `bun run test:browser`; requires a Playwright chromium
// (`bunx playwright install chromium`), matching the storybook CI lane's
// browser setup.
export default defineConfig({
  test: {
    name: "graph-3d-browser",
    include: ["test/browser/**/*.test.{ts,tsx}"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),
      instances: [{ browser: "chromium" }],
    },
  },
});
