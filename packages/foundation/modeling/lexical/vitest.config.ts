import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // These suites compile large recursive Lexical schemas (`S.toArbitrary`
      // + first-touch decoder compilation of `SerializedEditorState`) and run
      // codec round-trip property tests over arbitrary editor states. Under v8
      // coverage instrumentation the first decode is 10x+ slower, and the
      // full-monorepo `sequence.concurrent` coverage lane saturates small CI
      // runners — a ~5s local decode was observed ballooning past 60s there.
      // Defer to the shared config's coverage-aware ceiling (300s under
      // coverage or a deep property sweep) instead of clamping it back to a
      // coverage-unaware constant; keep focused non-coverage headroom over
      // the 30s shared default.
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 60_000,
    },
  })
);
