import { defineConfig } from "vitest/config";

const isBun = process.versions.bun !== undefined;

export default defineConfig({
  test: {
    coverage: {
      provider: isBun ? "istanbul" : "v8",
    },
    projects: [
      "packages/*/vitest.config.ts",
      "packages/*/*/vitest.config.ts",
      "packages/tooling/*/*/vitest.config.ts",
      "apps/*/vitest.config.ts",
      "apps/labs/*/vitest.config.ts",
    ],
  },
});
