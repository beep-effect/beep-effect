import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ["test/**/*.test.ts"],
    maxWorkers: 4,
    passWithNoTests: false,
    reporters: ["verbose"],
    testTimeout: 30_000,
  },
});
