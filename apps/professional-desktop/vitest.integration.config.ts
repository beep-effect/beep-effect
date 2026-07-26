import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    assetsInclude: ["**/*.data", "**/*.wasm", "**/*.tar.gz"],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      environment: "node",
      include: ["test/integration/**/*.test.{ts,tsx}"],
      // The shared config contributes `test/**/*.test.{ts,tsx}` via mergeConfig
      // array concatenation; exclude the jsdom suites so only the node-env
      // integration tests run here.
      exclude: ["test/*.test.{ts,tsx}"],
    },
  })
);
