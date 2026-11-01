import * as Doctest from "@effect/doctest/Plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [Doctest.plugin()],
  test: {
    include: ["scratchpad/test/**/*.test.ts"],
    includeSource: ["packages/foundation/modeling/jsonl/src/**/*.ts"],
    passWithNoTests: true,
    coverage: {
      // @beep/jsonc is held at full coverage; enable with
      // `--coverage.enabled` to enforce it.
      include: ["packages/foundation/modeling/jsonc/src/**/*.ts"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
