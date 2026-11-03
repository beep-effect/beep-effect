import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Several suites swap process.stdout.write, stub the environment, or share a fixture
      // directory between tests, so tests inside one file run in order (repo-cli's setting,
      // which these suites ran under before they moved here).
      sequence: {
        concurrent: false,
      },
    },
  })
);
