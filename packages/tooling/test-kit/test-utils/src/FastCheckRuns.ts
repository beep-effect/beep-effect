/**
 * Re-exports the env-max fast-check run-count helpers from `@beep/fc-runs`.
 *
 * The helpers live in `@beep/fc-runs` — a leaf package upstream of this
 * package's dependency closure — so that `@beep/schema`, `@beep/utils`,
 * and `@beep/pglite` (which `@beep/test-utils` itself depends on) can
 * import `fcRuns` without forming a package cycle. This module keeps the
 * historical `@beep/test-utils` import path working for every other
 * consumer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Re-exported env-max fast-check run-count helpers (`fcRuns`,
 * `envFcNumRunsFloor`, `parseFcNumRunsFloor`, `DEFAULT_FC_NUM_RUNS`).
 *
 * @example
 * ```ts
 * import { fcRuns } from "@beep/test-utils"
 *
 * console.log(fcRuns(40).numRuns >= 40) // true; higher when BEEP_FC_NUM_RUNS is set
 * ```
 * @category testing
 * @since 0.0.0
 */
export * from "@beep/fc-runs";
