import { defineConfig, mergeConfig } from "vitest/config";
import shared, { packageTestTimeout } from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Tests here mock modules, stub globals, or change the working directory; keep every file in
      // its own worker even under coverage (vitest.shared.ts shares the graph there by default).
      isolate: true,
      exclude: ["test/fixtures/**"],
      fileParallelism: false,
      globalSetup: [new URL("./test/global-cleanup.ts", import.meta.url).pathname],
      sequence: {
        concurrent: false,
      },
      testTimeout: packageTestTimeout(30_000),
    },
  })
);
