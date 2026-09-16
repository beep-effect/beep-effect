import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/contract.test.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    isolate: true,
    retry: 0,
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      include: ["src/*.ts"],
      reporter: ["json", "json-summary"],
    },
  },
});
