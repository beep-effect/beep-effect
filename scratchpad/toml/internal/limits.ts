/**
 * Zero-dependency nesting-depth guards shared by every TOML engine file.
 *
 * **Details**
 *
 * This is a leaf module: no import cycle is possible through here
 * (jsonc/yaml/glob precedent). Public facades catch {@link GuardExceeded}
 * and materialize a typed `NestingDepthExceeded` diagnostic; the engine
 * throws it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * House parity constant for depth guards (yaml/jsonc/glob precedent).
 *
 * **Example** (Read the shared cap)
 *
 * ```ts
 * import { MAX_NESTING_DEPTH } from "../../../toml/internal/limits.ts"
 *
 * console.log(MAX_NESTING_DEPTH) // 256
 * ```
 *
 * @see {@link GuardExceeded} for the throw carrier that reports this limit.
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const MAX_NESTING_DEPTH = 256;

/**
 * The reasons a guard can trip; mirrors the NestingDepthExceeded parse/stringify codes.
 *
 * @see {@link GuardExceeded} for the class that stores this reason.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type GuardReason = "NestingDepthExceeded";

/**
 * Raw guard-trip signal. The engine throws it; ONLY the public modules catch
 * it and materialize the typed error. It must never escape a public entry
 * point as a defect.
 *
 * **Gotchas**
 *
 * An internal caller that forgets to catch {@link GuardExceeded} surfaces a
 * defect to users. Passing `maxDepth: 0` or `NaN` is not a typed
 * `NestingDepthExceeded` — that dies as {@link assertCap}'s `TypeError`.
 *
 * **Example** (Construct a depth-guard trip)
 *
 * ```ts
 * import { GuardExceeded, MAX_NESTING_DEPTH } from "../../../toml/internal/limits.ts"
 *
 * const error = new GuardExceeded("NestingDepthExceeded", MAX_NESTING_DEPTH, 257, 0)
 * console.log(error._tag) // "GuardExceeded"
 * console.log(error.limit) // 256
 * ```
 *
 * @see {@link MAX_NESTING_DEPTH} for the default limit public facades materialize.
 * @see {@link TomlParseError} for the public tagged error that absorbs this carrier.
 * @internal
 * @category errors
 * @since 0.0.0
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

/**
 * Type guard for {@link GuardExceeded}, used by public facades at the engine
 * firewall.
 *
 * **Example** (Narrow a thrown guard)
 *
 * ```ts
 * import { GuardExceeded, isGuardExceeded } from "../../../toml/internal/limits.ts"
 *
 * const error: unknown = new GuardExceeded("NestingDepthExceeded", 256, 257, 0)
 * console.log(isGuardExceeded(error)) // true
 * console.log(isGuardExceeded(new Error("nope"))) // false
 * ```
 *
 * @see {@link GuardExceeded} for the class this guard narrows.
 * @internal
 * @category guards
 * @since 0.0.0
 */
export const isGuardExceeded = (u: unknown): u is GuardExceeded => u instanceof GuardExceeded;

/**
 * Internal caps are programmer-supplied. A NaN or non-integer reaching a guard
 * is a wiring bug and dies as a defect (walker maxDepth rule) — never coerced.
 *
 * **Gotchas**
 *
 * {@link GuardExceeded} is thrown by depth guards, not returned. {@link assertCap}
 * throws `TypeError` for `NaN`, non-integers, and values `< 1`. The TypeError
 * message still says `@effected/toml` (runtime, not docs).
 *
 * **Example** (Reject a NaN cap)
 *
 * ```ts
 * import { assertCap } from "../../../toml/internal/limits.ts"
 *
 * console.log(assertCap("maxDepth", 8)) // 8
 * try {
 *   assertCap("maxDepth", Number.NaN)
 * } catch (error) {
 *   console.log(error instanceof TypeError) // true
 * }
 * ```
 *
 * @throws A `TypeError` when `value` is not a positive safe integer.
 * @see {@link MAX_NESTING_DEPTH} for the default cap this function validates.
 * @see {@link TomlParseError} for the public materialization of a real depth trip.
 * @internal
 * @category assertions
 * @since 0.0.0
 */
export const assertCap = (name: string, value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`@effected/toml internal cap ${name} must be a positive integer, received ${value}`);
  }
  return value;
};
