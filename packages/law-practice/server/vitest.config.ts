import * as NodeURL from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    // Test-only aliases reach private subjects without publishing package exports.
    resolve: {
      alias: [
        {
          find: /^@beep\/law-practice-server\/internal\/(.+)$/,
          replacement: NodeURL.fileURLToPath(new URL("./src/internal/$1.ts", import.meta.url)),
        },
      ],
    },
    // Real native worker tests include cold module loading. Bound the test
    // runner fan-out so it does not consume the production deadline itself.
    // Each native owner still enforces its configured queue/execution limits.
    test: { maxWorkers: 2, maxConcurrency: 2 },
  })
);
