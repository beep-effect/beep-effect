/**
 * Env-max fast-check run-count helpers for the property-law lane.
 *
 * A leaf package upstream of the entire `@beep/test-utils` dependency
 * closure. It holds the `fcRuns` env-floor helper so closure packages
 * (`@beep/schema`, `@beep/utils`, `@beep/pglite`) can raise property-test
 * depth without importing back out of a package that depends on them.
 * `@beep/test-utils` re-exports everything here.
 *
 * @packageDocumentation
 * @example
 * ```ts
 * import { fcRuns } from "@beep/fc-runs"
 * const options = fcRuns(40)
 * console.log(options.numRuns >= 40) // true; higher when BEEP_FC_NUM_RUNS is set
 * ```
 * @since 0.0.0
 */

/**
 * Fast-check run-count helper exports.
 *
 * @example
 * ```ts
 * import { fcRuns } from "@beep/fc-runs"
 *
 * console.log(fcRuns(40).numRuns >= 40) // true
 * ```
 * @category testing
 * @since 0.0.0
 */
export * from "./FastCheckRuns.ts";
