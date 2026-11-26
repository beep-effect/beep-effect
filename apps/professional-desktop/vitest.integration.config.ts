import * as NodeURL from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

const pgliteBunEmbeddedAssets = /^(.*\/@electric-sql\/pglite\/dist\/.*\.(?:wasm|data|tar\.gz))$/;
const sharedIncludedJsdomSuites = ["test/*.test.{ts,tsx}"];

export default mergeConfig(
  shared,
  defineConfig({
    assetsInclude: ["**/*.data", "**/*.wasm", "**/*.tar.gz"],
    resolve: {
      alias: [
        { find: "@", replacement: NodeURL.fileURLToPath(new URL("./src", import.meta.url)) },
        {
          find: pgliteBunEmbeddedAssets,
          replacement: "$1?url",
        },
      ],
    },
    test: {
      environment: "node",
      include: ["test/integration/**/*.test.{ts,tsx}"],
      exclude: sharedIncludedJsdomSuites,
    },
  })
);
