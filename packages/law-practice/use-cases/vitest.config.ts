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
          find: /^@beep\/law-practice-use-cases\/internal\/(.+)$/,
          replacement: NodeURL.fileURLToPath(new URL("./src/internal/$1.ts", import.meta.url)),
        },
      ],
    },
    test: {},
  })
);
