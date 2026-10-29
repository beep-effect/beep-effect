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
      // Fixtures own cache enrollment. A root `bun run` also loads its dotenv into the parent,
      // so disable host defaults and clear the inherited cache tuple before fixture setup.
      env: {
        BEEP_TURBO_HOST_CACHE_DISABLED: "true",
        TURBO_API: "",
        TURBO_TOKEN: "",
        TURBO_TEAM: "",
        TURBO_CACHE: "",
        TURBO_REMOTE_CACHE_SIGNATURE_KEY: "",
      },
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
