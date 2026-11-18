import { defineConfig } from "vitest/config";

// Single fork, no file parallelism: keep the machine's load light.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
  },
});
