import { defineConfig } from "vitest/config";
import scratchpad from "./vitest.config.ts";

export default defineConfig({
  ...scratchpad,
  test: {
    ...scratchpad.test,
    include: ["scratchpad/test/jsonl.test.ts", "scratchpad/test/jsonl/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["scratchpad/effected/jsonl/**/*.ts"],
      reporter: ["text", "json", "json-summary", "html"],
      reportsDirectory: "coverage/scratchpad-jsonl",
      thresholds: { perFile: true, statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
