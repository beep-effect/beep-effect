import { defineConfig, mergeConfig } from "vitest/config";
import schema from "./vitest.schema.ts";

export default mergeConfig(schema, defineConfig({
  test: {
    disableConsoleIntercept: true,
    setupFiles: [new URL("./runtime-witness.ts", import.meta.url).pathname],
  },
}));
