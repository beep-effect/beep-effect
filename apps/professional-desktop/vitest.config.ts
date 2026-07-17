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
      // The surface-boundary tests intentionally throw during render; React
      // reports its "recovered by synchronous rendering" notice as an
      // unhandled error under bun-run vitest. Everything else still fails.
      onUnhandledError(error: unknown): boolean | undefined {
        const message = error instanceof Error ? error.message : String(error);
        return message.includes("error during concurrent rendering") ? false : undefined;
      },
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
