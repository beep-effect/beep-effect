import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(shared, defineConfig({
  test: {
    maxWorkers: 4,
    maxConcurrency: 5,
    isolate: true,
    retry: 0,
    passWithNoTests: false,
  },
}));
