import * as NodeURL from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

const testOnlyInternalAlias = {
  find: /^@beep\/law-practice-use-cases\/internal\/(.+)$/,
  replacement: NodeURL.fileURLToPath(new URL("./src/internal/$1.ts", import.meta.url)),
};

export default mergeConfig(
  shared,
  defineConfig({
    resolve: {
      alias: [testOnlyInternalAlias],
    },
    test: {},
  })
);
