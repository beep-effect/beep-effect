import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      environment: "jsdom",
      include: ["test/**/*.test.{ts,tsx}"],
      exclude: ["test/integration/**"],
      setupFiles: [fileURLToPath(new URL("./test/setup.dom.ts", import.meta.url))],
      server: {
        deps: {
          // @mui/x-* packages reach core-js-pure via extensionless directory
          // imports that Node's native ESM loader rejects; inline the family
          // (importers included) so Vite resolves the imports instead.
          inline: [/@mui\/x-/, /core-js-pure/],
        },
      },
    },
  })
);
