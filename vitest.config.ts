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
      // Lab apps live one level deeper (apps/labs/<name>); globs do not cross "/".
      // Canonical labs path module: packages/tooling/tool/cli/src/internal/cli/Labs.
      "apps/labs/*/vitest.config.ts",
      ...(isBun
        ? [
            // Exclude Node-specific packages when running with Bun
            // Add exclusions here as needed
          ]
        : []),
    ],
  },
});
