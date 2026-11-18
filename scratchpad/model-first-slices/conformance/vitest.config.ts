import { defineConfig } from "vitest/config";

// Runs only against a deployed stack (`bun run conformance` from the prototype root, with
// CONFORMANCE_URL set). Not part of `bun run test`.
export default defineConfig({
  test: {
    include: ["test/**/*.conformance.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
  },
});
