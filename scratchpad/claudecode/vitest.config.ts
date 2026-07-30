import { defineConfig } from "vitest/config";

export default defineConfig({
  root: `${import.meta.dirname}/..`,
  test: {
    setupFiles: ["test/claudecode/setup.ts"],
    include: ["test/claudecode/**/*.test.ts"],
    passWithNoTests: false,
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    isolate: false,
  },
});
