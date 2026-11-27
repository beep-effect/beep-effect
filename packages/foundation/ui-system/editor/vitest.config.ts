import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

/**
 * Keeps mutable editor test environments isolated under coverage.
 *
 * **Gotchas**
 *
 * Keep files isolated even under coverage: these tests mock modules, stub globals
 * or change the working directory, while the shared coverage config shares the graph.
 *
 * **Example** (Preserve isolation over shared defaults)
 *
 * ```ts
 * import { defineConfig, mergeConfig } from "vitest/config"
 *
 * const defaults = defineConfig({ test: { isolate: false } })
 * const isolated = mergeConfig(defaults, defineConfig({ test: { isolate: true } }))
 * console.log(isolated.test?.isolate)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export default mergeConfig(
  shared,
  defineConfig({
    test: {
      isolate: true,
    },
  })
);
