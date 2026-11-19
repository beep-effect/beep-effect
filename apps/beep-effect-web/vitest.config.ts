import * as NodeURL from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    resolve: {
      alias: {
        "@": NodeURL.fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      environment: "jsdom",
      include: ["test/**/*.test.{ts,tsx}"],
    },
  })
);
