import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // wink-nlp's model loader mutates its shared module state on every
      // `nlp()` load, so a shared-worker coverage run (`isolate: false`, one
      // worker) accumulates until `loadNERModel` dies with "Invalid string
      // length". Keep each test file on a fresh module graph.
      isolate: true,
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 20_000,
    },
  })
);
