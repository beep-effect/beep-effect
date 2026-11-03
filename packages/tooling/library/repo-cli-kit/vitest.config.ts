import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Several suites swap process.stdout.write, stub the environment, seed Bun.env before the
      // first config read, or share a fixture directory between tests, so each file keeps its
      // own worker (even under coverage) and tests inside one file run in order: the settings
      // these suites ran under in repo-cli before they moved here.
      isolate: true,
      sequence: {
        concurrent: false,
      },
    },
  })
);
