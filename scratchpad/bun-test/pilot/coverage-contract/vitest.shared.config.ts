/**
 * Shared-provider coverage qualification configuration for the bounded fixture.
 *
 * @since 0.0.0
 */
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

// No provider override: this fixture qualifies the actual shared selector.
/**
 * Qualifies the repository coverage-provider selector against a bounded branch and untouched-file fixture.
 *
 * **Example** (Inspect coverage fixture selection)
 *
 * ```ts
 * import config from "@beep/scratchpad/bun-test/pilot/coverage-contract/vitest.shared.config"
 *
 * console.log(config.test?.include)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
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
