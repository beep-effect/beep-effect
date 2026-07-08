/**
 * Env-max fast-check run-count helpers (one-round-loop P1).
 *
 * Inline `numRuns` values override `fc.configureGlobal`, so a global
 * floor alone cannot raise property-law depth across the repo. These
 * helpers make every migrated site env-raisable: the effective run
 * count is `max(inline ?? default, BEEP_FC_NUM_RUNS)` — inline values
 * are floors and can never be lowered by the environment.
 *
 * Lives in this leaf package (upstream of the entire `@beep/test-utils`
 * dependency closure) so that `@beep/schema`, `@beep/utils`, and
 * `@beep/pglite` — which `@beep/test-utils` itself depends on — can
 * import `fcRuns` without forming a package cycle. `@beep/test-utils`
 * re-exports these helpers so existing `@beep/test-utils` imports keep
 * working unchanged.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Config, Effect, pipe } from "effect";
import * as O from "effect/Option";

/**
 * fast-check's own default run count, used when a site passes no inline value.
 *
 * @example
 * ```ts
 * import { DEFAULT_FC_NUM_RUNS } from "@beep/fc-runs"
 *
 * console.log(DEFAULT_FC_NUM_RUNS) // 100
 * ```
 * @category testing
 * @since 0.0.0
 */
export const DEFAULT_FC_NUM_RUNS = 100;

/**
 * Parse a raw `BEEP_FC_NUM_RUNS` value into a usable floor.
 *
 * Non-integers, non-positives, and absent values collapse to 0 so the
 * result can feed the environment side of a `max()` directly.
 *
 * @param raw - Raw environment value, if any.
 * @returns The parsed positive-integer floor, or 0.
 * @example
 * ```ts
 * import { parseFcNumRunsFloor } from "@beep/fc-runs"
 *
 * console.log(parseFcNumRunsFloor("400")) // 400
 * console.log(parseFcNumRunsFloor("2.5")) // 0
 * console.log(parseFcNumRunsFloor(undefined)) // 0
 * ```
 * @category testing
 * @since 0.0.0
 */
export const parseFcNumRunsFloor = (raw: string | undefined): number =>
  O.match(O.flatMap(O.fromNullishOr(raw), parsePositiveInteger), {
    onNone: () => 0,
    onSome: (floor) => floor,
  });

const parsePositiveInteger = (raw: string): O.Option<number> => {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? O.some(parsed) : O.none();
};

// Effect's default ConfigProvider snapshots the environment at process
// boot — exactly the lane semantics (CI exports BEEP_FC_NUM_RUNS before
// vitest starts). Runtime mutation is deliberately NOT observed.
const fcNumRunsConfig = Config.option(Config.string("BEEP_FC_NUM_RUNS"));

/**
 * Read the `BEEP_FC_NUM_RUNS` environment floor.
 *
 * Returns 0 when the variable is unset or not a positive integer, so it
 * can be used directly as the environment side of a `max()`.
 *
 * @returns The configured floor, or 0 when absent or invalid.
 * @example
 * ```ts
 * import { envFcNumRunsFloor } from "@beep/fc-runs"
 *
 * const floor = envFcNumRunsFloor()
 * console.log(floor >= 0) // true
 * ```
 * @category testing
 * @since 0.0.0
 */
export const envFcNumRunsFloor = (): number =>
  pipe(Effect.runSync(fcNumRunsConfig), O.getOrUndefined, parseFcNumRunsFloor);

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
 * import { fcRuns } from "@beep/fc-runs"
 *
 * const options = fcRuns(40)
 * console.log(options.numRuns >= 40) // true; higher when BEEP_FC_NUM_RUNS is set
 * ```
 * @category testing
 * @since 0.0.0
 */
export const fcRuns = (inline?: number): { readonly numRuns: number } => ({
  numRuns: Math.max(inline ?? DEFAULT_FC_NUM_RUNS, envFcNumRunsFloor()),
});
