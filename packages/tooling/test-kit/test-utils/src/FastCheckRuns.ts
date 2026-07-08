/**
 * Env-max fast-check run-count helpers (one-round-loop P1).
 *
 * Inline `numRuns` values override `fc.configureGlobal`, so a global
 * floor alone cannot raise property-law depth across the repo. These
 * helpers make every migrated site env-raisable: the effective run
 * count is `max(inline ?? default, BEEP_FC_NUM_RUNS)` — inline values
 * are floors and can never be lowered by the environment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as O from "effect/Option";

/**
 * fast-check's own default run count, used when a site passes no inline value.
 *
 * @example
 * ```ts
 * import { DEFAULT_FC_NUM_RUNS } from "@beep/test-utils"
 *
 * console.log(DEFAULT_FC_NUM_RUNS) // 100
 * ```
 * @category fast-check
 * @since 0.0.0
 */
export const DEFAULT_FC_NUM_RUNS = 100;

const parsePositiveInteger = (raw: string): O.Option<number> => {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? O.some(parsed) : O.none();
};

/**
 * Read the `BEEP_FC_NUM_RUNS` environment floor.
 *
 * Returns 0 when the variable is unset or not a positive integer, so it
 * can be used directly as the environment side of a `max()`.
 *
 * @returns The configured floor, or 0 when absent or invalid.
 * @example
 * ```ts
 * import { envFcNumRunsFloor } from "@beep/test-utils"
 *
 * const floor = envFcNumRunsFloor()
 * console.log(floor >= 0) // true
 * ```
 * @category fast-check
 * @since 0.0.0
 */
export const envFcNumRunsFloor = (): number =>
  O.match(O.flatMap(O.fromNullishOr(process.env.BEEP_FC_NUM_RUNS), parsePositiveInteger), {
    onNone: () => 0,
    onSome: (floor) => floor,
  });

/**
 * Build fast-check run options whose effective `numRuns` is
 * `max(inline ?? DEFAULT_FC_NUM_RUNS, BEEP_FC_NUM_RUNS)`.
 *
 * Inline values are floors: the environment can raise the run count for
 * a deep sweep (the nightly property lane runs with
 * `BEEP_FC_NUM_RUNS=1000`), but can never lower a site below the value
 * it declares (one-round-loop fence 3).
 *
 * @param inline - The site's own run count; defaults to fast-check's 100.
 * @returns Options bag spreadable into `fc.assert` parameters.
 * @example
 * ```ts
 * import { fcRuns } from "@beep/test-utils"
 *
 * const options = fcRuns(40)
 * console.log(options.numRuns >= 40) // true; higher when BEEP_FC_NUM_RUNS is set
 * ```
 * @category fast-check
 * @since 0.0.0
 */
export const fcRuns = (inline?: number): { readonly numRuns: number } => ({
  numRuns: Math.max(inline ?? DEFAULT_FC_NUM_RUNS, envFcNumRunsFloor()),
});
