import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

/**
 * Vitest configuration for the agents server package.
 *
 * **Gotchas**
 *
 * Keep `isolate: true`: these tests mock modules, stub globals or change the
 * working directory, and `vitest.shared.ts` shares the module graph under
 * coverage by default.
 */
export default mergeConfig(
  shared,
  defineConfig({
    test: {
      isolate: true,
    },
  })
);
