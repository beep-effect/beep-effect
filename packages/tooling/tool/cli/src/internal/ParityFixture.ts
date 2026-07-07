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
  return globalThis.process.argv.join(" ");
};

export const parityFixtureUndocumented = nothing;

export const parityFixtureFakeKey = [
  "-----BEGIN RSA PRIVATE KEY-----",
  "MIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Qu",
  "KUpRKfFLfRYC9AIKjbJTWit+CqvjWYzvQwECAwEAAQJAIJLixBy2qpFoS4DSmoEm",
  "-----END RSA PRIVATE KEY-----",
].join("\n");
