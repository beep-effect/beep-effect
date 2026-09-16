import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

// No provider override: this fixture qualifies the actual shared selector.
export default mergeConfig(shared, defineConfig({
  test: {
    include: ["test/contract.test.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    isolate: true,
    retry: 0,
    passWithNoTests: false,
    disableConsoleIntercept: true,
    setupFiles: [new URL("../runtime-witness.ts", import.meta.url).pathname],
    coverage: {
      include: ["src/*.ts"],
      reporter: ["json", "json-summary"],
    },
  },
}));
