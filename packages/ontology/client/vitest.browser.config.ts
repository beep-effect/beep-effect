import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const unbundledCaseCollidingEntries = ["effect/schema"];

export default defineConfig({
  optimizeDeps: { exclude: unbundledCaseCollidingEntries },
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
