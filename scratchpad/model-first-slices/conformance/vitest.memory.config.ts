import { defineConfig } from "vitest/config";

// The in-memory tests of this package (`bun run test`): no deployed stack. Single fork, no file
// parallelism, as the other packages.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
  },
});
