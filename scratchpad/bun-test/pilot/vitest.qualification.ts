import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scratchpad/test/bun-test/qualification/*.test.ts"],
    testTimeout: 100,
    hookTimeout: 2_000,
    maxWorkers: 1,
    fileParallelism: false,
    isolate: true,
    sequence: { concurrent: false },
    retry: 0,
    passWithNoTests: false,
  },
});
