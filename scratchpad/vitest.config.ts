import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scratchpad/test/**/*.test.ts"],
    passWithNoTests: true,
  },
});
