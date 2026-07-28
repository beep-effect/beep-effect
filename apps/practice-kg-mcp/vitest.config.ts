import { defineConfig } from "vitest/config";

const isBun = process.versions.bun !== undefined;

export default defineConfig({
  test: {
    coverage: {
      provider: isBun ? "istanbul" : "v8",
    },
    include: ["test/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
  },
});
