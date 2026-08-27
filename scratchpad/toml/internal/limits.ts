// The zero-dependency leaf every guard imports — no import cycle is possible
// through here (jsonc/yaml/glob precedent).

/** House parity constant for depth guards (yaml/jsonc/glob precedent). */
export const MAX_NESTING_DEPTH = 256;

/** The reasons a guard can trip; mirrors the NestingDepthExceeded parse/stringify codes. */
export type GuardReason = "NestingDepthExceeded";

/**
 * Raw guard-trip signal. The engine throws it; ONLY the public modules catch
 * it and materialize the typed error. It must never escape a public entry
 * point as a defect.
 */
export class GuardExceeded extends Error {
  readonly _tag = "GuardExceeded";
  readonly reason: GuardReason;
  readonly limit: number;
  readonly actual: number;
  readonly offset: number;

  constructor(
    reason: GuardReason,
    limit: number,
    actual: number,
    offset: number,
  ) {
    super(`${reason}: limit ${limit}, actual ${actual}`);
    this.reason = reason;
    this.limit = limit;
    this.actual = actual;
    this.offset = offset;
  }
}

export const isGuardExceeded = (u: unknown): u is GuardExceeded => u instanceof GuardExceeded;

/**
 * Internal caps are programmer-supplied. A NaN or non-integer reaching a guard
 * is a wiring bug and dies as a defect (walker maxDepth rule) — never coerced.
 */
export const assertCap = (name: string, value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`@effected/toml internal cap ${name} must be a positive integer, received ${value}`);
  }
  return value;
};
