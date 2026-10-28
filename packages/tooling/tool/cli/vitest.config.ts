import * as NodeURL from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared, { packageTestTimeout } from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Tests here mock modules, stub globals, or change the working directory; keep every file in
      // its own worker even under coverage (vitest.shared.ts shares the graph there by default).
      isolate: true,
      // Fixtures own cache enrollment; the operator's host defaults must not change command plans.
      env: { BEEP_TURBO_HOST_CACHE_DISABLED: "true" },
      exclude: ["test/fixtures/**"],
      fileParallelism: false,
      globalSetup: [NodeURL.fileURLToPath(new URL("./test/global-cleanup.ts", import.meta.url))],
      sequence: {
        concurrent: false,
      },
      testTimeout: packageTestTimeout(30_000),
    },
  })
);
