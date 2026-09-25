import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestCoverageRunActive } from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Tests here mock modules, stub globals, or change the working directory; keep every file in
      // its own worker even under coverage (vitest.shared.ts shares the graph there by default).
      isolate: true,
      // Package-specific overrides
      // The rdf-canonize-backed tests load the real module (vi.importActual) and
      // canonicalize schema-derived datasets; cold-cache CI runs exceed the 5000ms
      // default per-test timeout, so widen the budget package-wide.
      testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 30_000,
    },
  })
);
