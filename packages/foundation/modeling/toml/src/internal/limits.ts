import { $TomlId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as N from "@beep/utils/Number";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $TomlId.create("internal/limits");

class TomlCapError extends S.TaggedError<TomlCapError, { readonly brand: unique symbol }>($I`TomlCapError`)(
  "TomlCapError",
  {
    message: S.String.pipe(
      $I.annoteKey("TomlCapError.message", { description: "Explanation of the invalid programmer-supplied cap." })
    ),
  },
  $I.annoteError<TomlCapError>("TomlCapError", { description: "An invalid internal cap indicates a wiring defect." })
) {}

/**
 * Sets the house parity limit for depth guards (yaml/jsonc/glob precedent).
 *
 * **Example** (Inspect the nesting limit)
 *
 * ```ts
 * import { MAX_NESTING_DEPTH } from "@beep/toml/internal/limits"
 *
 * console.log(MAX_NESTING_DEPTH) // 256
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_NESTING_DEPTH = 256;

const GuardReason = LiteralKit(["NestingDepthExceeded"]).pipe(
  $I.annoteSchema("GuardReason", {
    description: "The engine guard reason mirrored by parse and stringify diagnostics.",
  })
);

/**
 * Identifies why a guard trips; mirrors the NestingDepthExceeded parse/stringify codes.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GuardReason = typeof GuardReason.Type;

// decision: engine-diagnostic-boundary
/**
 * Signals a raw guard trip from the engine.
 *
 * **Details**
 *
 * The engine throws it; ONLY the public modules catch it and materialize the
 * typed error.
 *
 * **Gotchas**
 *
 * It must never escape a public entry point as a defect.
 *
 * **Example** (Inspect a nesting guard trip)
 *
 * ```ts
 * import { GuardExceeded } from "@beep/toml/internal/limits"
 *
 * const error = GuardExceeded.new("NestingDepthExceeded", 256, 257, 12)
 * console.log(error.message) // NestingDepthExceeded: limit 256, actual 257
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GuardExceeded extends S.TaggedError<GuardExceeded, { readonly brand: unique symbol }>($I`GuardExceeded`)(
  "GuardExceeded",
  {
    message: S.String.pipe(
      $I.annoteKey("GuardExceeded.message", { description: "The reason, configured limit and observed depth." })
    ),
    reason: GuardReason.pipe(
      $I.annoteKey("GuardExceeded.reason", { description: "The engine guard that exceeded its limit." })
    ),
    limit: S.Finite.pipe($I.annoteKey("GuardExceeded.limit", { description: "The configured nesting limit." })),
    actual: S.Finite.pipe($I.annoteKey("GuardExceeded.actual", { description: "The observed nesting depth." })),
    offset: S.Finite.pipe(
      $I.annoteKey("GuardExceeded.offset", { description: "Source offset where the guard tripped." })
    ),
  },
  $I.annoteError<GuardExceeded>("GuardExceeded", {
    description: "A raw nesting guard trip materialized into a diagnostic by the facade.",
  })
) {
  /**
   * Presents the guard-trip signal with the standard Error name.
   *
   * **Example** (Inspect the guard signal name)
   *
   * ```ts
   * import { GuardExceeded } from "@beep/toml/internal/limits"
   *
   * const error = GuardExceeded.new("NestingDepthExceeded", 256, 257, 12)
   * console.log(error.name) // Error
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override readonly name = "Error";

  /**
   * Builds a guard-trip signal with a message containing the reason, limit and actual depth.
   *
   * **Example** (Retain the opening bracket offset)
   *
   * ```ts
   * import { GuardExceeded } from "@beep/toml/internal/limits"
   *
   * const error = GuardExceeded.new("NestingDepthExceeded", 256, 257, 12)
   * console.log(error.offset) // 12
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly new: {
    (reason: GuardReason, limit: number, actual: number, offset: number): GuardExceeded;
    (limit: number, actual: number, offset: number): (reason: GuardReason) => GuardExceeded;
  } = dual(
    4,
    (reason: GuardReason, limit: number, actual: number, offset: number): GuardExceeded =>
      GuardExceeded.make({ reason, limit, actual, offset, message: `${reason}: limit ${limit}, actual ${actual}` })
  );
}

/**
 * Recognizes a schema-valid guard-trip signal before the facade materializes it.
 *
 * **Example** (Recognize a nesting guard trip)
 *
 * ```ts
 * import { GuardExceeded, isGuardExceeded } from "@beep/toml/internal/limits"
 *
 * const error = GuardExceeded.new("NestingDepthExceeded", 256, 257, 12)
 * console.log(isGuardExceeded(error)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isGuardExceeded = S.is(GuardExceeded);

/**
 * Validates a programmer-supplied internal cap as a positive safe integer.
 *
 * **Gotchas**
 *
 * Internal caps are programmer-supplied. A NaN or non-integer reaching a guard
 * is a wiring bug and dies as a defect (walker maxDepth rule) — never coerced.
 *
 * **Example** (Validate a nesting cap in both call forms)
 *
 * ```ts
 * import { assertCap } from "@beep/toml/internal/limits"
 *
 * console.log(assertCap("maxDepth", 256)) // 256
 * console.log(assertCap(64)("maxDepth")) // 64
 * ```
 *
 * @category assertions
 * @since 0.0.0
 */
export const assertCap: N.CapAssertion = N.makeCapAssertion("@beep/toml", (message) => TomlCapError.make({ message }));
