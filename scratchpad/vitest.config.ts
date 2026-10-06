import * as Doctest from "@effect/doctest/Plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [Doctest.plugin()],
  test: {
    include: ["scratchpad/test/**/*.test.ts"],
    includeSource: ["scratchpad/effected/jsonl/**/*.ts"],
    passWithNoTests: true,
  },
});
