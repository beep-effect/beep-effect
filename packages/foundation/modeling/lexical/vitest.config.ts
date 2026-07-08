import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestCoverageRunActive, vitestFcDeepSweepActive } from "../../../../vitest.shared.ts";

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
      // Defer to the shared config's coverage/property-aware ceiling instead of
      // clamping it back to a deep-sweep-unaware constant; keep focused
      // non-coverage headroom over the 30s shared default.
      testTimeout: vitestCoverageRunActive || vitestFcDeepSweepActive ? 180_000 : 60_000,
    },
  })
);
