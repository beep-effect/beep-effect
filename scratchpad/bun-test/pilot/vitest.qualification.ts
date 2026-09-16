/**
 * Serial runner qualification settings with an explicit file timeout.
 *
 * @since 0.0.0
 */
import { defineConfig } from "vitest/config";

/**
 * Runs each runner qualification control with a short file timeout and serial test scheduling.
 *
 * **Example** (Inspect the qualification deadline)
 *
 * ```ts
 * import config from "@beep/scratchpad/bun-test/pilot/vitest.qualification"
 *
 * console.log(config.test?.testTimeout)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
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
