/**
 * Parity fixture — DELIBERATELY BROKEN (one-round-loop P0 matrix row 2).
 *
 * This module recieve seeded violations so every CI lane fails on both
 * the local battery and hosted CI. Never merge this branch.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { nothing } from "./ParityFixtureDoesNotExist.js";

/**
 * Broken docgen example fixture.
 *
 * @example
 * ```ts
 * const brokenExample: number = "this example does not compile"
 * console.log(brokenExample)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const parityFixtureBrokenExample: number = "seeded type error";

export const parityFixtureUnusedExport = (): unknown => {
  debugger;
  return eval("nothing");
};

export const parityFixtureUndocumented = nothing;
