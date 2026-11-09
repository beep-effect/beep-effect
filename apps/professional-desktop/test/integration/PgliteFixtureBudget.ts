import { fcDeepSweepActive, vitestCoverageRunActive } from "../../../../vitest.shared.ts";

/**
 * Layer budget for integration fixtures that open a cold in-process PGlite
 * (the bundled extension set plus the boot migrations).
 *
 * **Details**
 *
 * Ten seconds fits a warm local checkout and the 8-vCPU heavy runner. On the
 * 4-vCPU hosted `Test Integration (int-rest)` partition, with this package's
 * other integration files running alongside, the first cold PGlite layer took
 * longer (main run 42662847801: `contradiction-qa-seed` hook timed out at 10 s
 * while `PgliteDataDirCompatibility` measured 39 s for the bundled layer in the
 * same job), so every PGlite-backed fixture shares this two-minute budget;
 * coverage and deep sweeps keep five minutes.
 *
 * @internal @category testing @since 0.0.0
 */
export const pgliteFixtureTimeout = vitestCoverageRunActive || fcDeepSweepActive ? "5 minutes" : "2 minutes";
