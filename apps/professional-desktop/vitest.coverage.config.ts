import { defineConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    exclude: ["**/.context/**", "**/node_modules/**"],
    include: ["test/*.test.{ts,tsx}", "test/integration/contradiction-qa-seed.pglite.test.ts"],
  },
});
