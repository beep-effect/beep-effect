import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    // Test-only alias: private implementation stays absent from package exports.
    resolve: {
      alias: [
        {
          find: /^@beep\/law-practice-server\/_test\/Citation\/(.+)$/,
          replacement: `${fileURLToPath(new URL("./src/internal/Citation/", import.meta.url))}$1.ts`,
        },
      ],
    },
    test: {},
  })
);
