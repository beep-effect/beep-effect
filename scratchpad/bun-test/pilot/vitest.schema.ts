/**
 * Bounded schema comparison settings derived from the shared repository configuration.
 *
 * @since 0.0.0
 */
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

/**
 * Bounds schema comparison concurrency while preserving the repository shared test configuration.
 *
 * **Example** (Inspect schema worker capacity)
 *
 * ```ts
 * import config from "@beep/scratchpad/bun-test/pilot/vitest.schema"
 *
 * console.log(config.test?.maxWorkers)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export default mergeConfig(shared, defineConfig({
  test: {
    maxWorkers: 4,
    maxConcurrency: 5,
    isolate: true,
    retry: 0,
    passWithNoTests: false,
  },
}));
