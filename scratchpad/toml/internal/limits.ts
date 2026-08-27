/**
 * Zero-dependency nesting-depth guards shared by every TOML engine file.
 *
 * **Details**
 *
 * This leaf module lets public facades translate internal guard failures into
 * typed diagnostics without creating an engine-to-facade import cycle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("toml/internal/limits");


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
const GuardReason = LiteralKit(["NestingDepthExceeded"]).annotate(
  $I.annote("GuardReason", {
    description: "Reason a defensive TOML engine guard rejected an operation.",
  })
);

/**
 * Reason carried by an internal defensive guard failure.
 *
 * @see {@link GuardReason} for the runtime literal schema.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type GuardReason = typeof GuardReason.Type;

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
 * const error = GuardExceeded.make({
 *   reason: "NestingDepthExceeded",
 *   limit: MAX_NESTING_DEPTH,
 *   actual: 257,
 *   offset: 0,
 * })
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
export class GuardExceeded extends S.TaggedError<GuardExceeded>($I`GuardExceeded`)(
  "GuardExceeded",
  {
    reason: GuardReason,
    limit: S.Finite,
    actual: S.Finite,
    offset: S.Finite,
  },
  $I.annote("GuardExceeded", {
    description: "Typed engine signal for a defensive TOML nesting-depth failure.",
  })
) {
  override get message(): string {
    return `${this.reason}: limit ${this.limit}, actual ${this.actual}`;
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
 * const error: unknown = GuardExceeded.make({ reason: "NestingDepthExceeded", limit: 256, actual: 257, offset: 0 })
 * console.log(isGuardExceeded(error)) // true
 * console.log(isGuardExceeded(new Error("nope"))) // false
 * ```
 *
 * @see {@link GuardExceeded} for the class this guard narrows.
 * @internal
 * @category guards
 * @since 0.0.0
 */
export const isGuardExceeded = S.is(GuardExceeded);

class TomlInvariantError extends S.TaggedError<TomlInvariantError>($I`TomlInvariantError`)(
  "TomlInvariantError",
  { operation: S.NonEmptyString, detail: S.NonEmptyString },
  $I.annote("TomlInvariantError", {
    description: "Programmer defect raised when internal TOML engine wiring violates an invariant.",
  })
) {
  override get message(): string {
    return `${this.operation}: ${this.detail}`;
  }
}

const PositiveSafeInteger = S.Finite.check(S.isInt(), S.isGreaterThan(0)).pipe(
  $I.annoteSchema("PositiveSafeInteger", {
    description: "Positive safe integer accepted by internal TOML engine caps.",
  })
);

const isPositiveSafeInteger = S.is(PositiveSafeInteger);

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
export const assertCap: {
  (name: string, value: number): number;
  (value: number): (name: string) => number;
} = dual(2, (name: string, value: number): number => {
  if (!isPositiveSafeInteger(value)) {
    throw TomlInvariantError.make({
      operation: "assertCap",
      detail: `@effected/toml internal cap ${name} must be a positive integer, received ${value}`,
    });
  }
  return value;
});
