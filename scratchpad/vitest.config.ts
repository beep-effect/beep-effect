import * as Doctest from "@effect/doctest/Plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [Doctest.plugin()],
  test: {
    include: ["scratchpad/test/**/*.test.ts"],
    includeSource: ["scratchpad/effected/jsonl/**/*.ts"],
    passWithNoTests: true,
    coverage: {
      // The @effected/jsonc port is held at full coverage; enable with
      // `--coverage.enabled` to enforce it.
      include: ["scratchpad/effected/jsonc/**/*.ts"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
