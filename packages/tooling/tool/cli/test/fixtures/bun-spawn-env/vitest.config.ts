import { defineConfig } from "vitest/config";
import shared from "../../../../../../../vitest.shared.ts";

export default defineConfig({
  ...shared,
  test: {
    ...shared.test,
    root: import.meta.dirname,
    include: ["spawn-env.test.ts"],
    includeSource: [],
    maxWorkers: 1,
    fileParallelism: false,
  },
});
