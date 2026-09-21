/**
 * Schema comparison settings that record the actual worker runtime.
 *
 * @since 0.0.0
 */
import { defineConfig, mergeConfig } from "vitest/config";
import schema from "./vitest.schema.ts";

/**
 * Adds worker runtime receipts to the isolated schema comparison configuration.
 *
 * **Example** (Inspect the runtime witness setup)
 *
 * ```ts
 * import config from "@beep/scratchpad/bun-test/pilot/vitest.runtime"
 *
 * console.log(config.test?.setupFiles)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export default mergeConfig(schema, defineConfig({
  test: {
    disableConsoleIntercept: true,
    setupFiles: [new URL("./runtime-witness.ts", import.meta.url).pathname],
  },
}));
