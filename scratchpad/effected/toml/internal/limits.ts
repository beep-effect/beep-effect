import { $ScratchpadId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
// The zero-dependency leaf every guard imports — no import cycle is possible
// through here (jsonc/yaml/glob precedent).

const $I = $ScratchpadId.create("effected/toml/internal/limits");

class TomlCapError extends S.TaggedError<TomlCapError>($I`TomlCapError`)("TomlCapError", {
	message: S.String.annotateKey({ description: "Explanation of the invalid programmer-supplied cap." }),
}, $I.annote("TomlCapError", { description: "An invalid internal cap indicates a wiring defect." })) {}

/**
 * Sets the house parity limit for depth guards (yaml/jsonc/glob precedent).
 *
 * **Example** (Inspect the nesting limit)
 *
 * ```ts
 * import { MAX_NESTING_DEPTH } from "@beep/scratchpad/effected/toml/internal/limits"
 *
 * console.log(MAX_NESTING_DEPTH) // 256
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_NESTING_DEPTH = 256;

/**
 * Identifies why a guard trips; mirrors the NestingDepthExceeded parse/stringify codes.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GuardReason = "NestingDepthExceeded";

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
 * import { GuardExceeded } from "@beep/scratchpad/effected/toml/internal/limits"
 *
 * const error = GuardExceeded.new("NestingDepthExceeded", 256, 257, 12)
 * console.log(error.message) // NestingDepthExceeded: limit 256, actual 257
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GuardExceeded extends S.TaggedError<GuardExceeded>($I`GuardExceeded`)("GuardExceeded", {
	message: S.String.annotateKey({ description: "The reason, configured limit and observed depth." }),
	reason: S.Literal("NestingDepthExceeded").annotateKey({ description: "The engine guard that exceeded its limit." }),
	limit: S.Finite.annotateKey({ description: "The configured nesting limit." }),
	actual: S.Finite.annotateKey({ description: "The observed nesting depth." }),
	offset: S.Finite.annotateKey({ description: "Source offset where the guard tripped." }),
}, $I.annote("GuardExceeded", { description: "A raw nesting guard trip materialized into a diagnostic by the facade." })) {
	/**
	 * Presents the guard-trip signal with the standard Error name.
	 *
	 * **Example** (Inspect the guard signal name)
	 *
	 * ```ts
	 * import { GuardExceeded } from "@beep/scratchpad/effected/toml/internal/limits"
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
	 * import { GuardExceeded } from "@beep/scratchpad/effected/toml/internal/limits"
	 *
	 * const error = GuardExceeded.new("NestingDepthExceeded", 256, 257, 12)
	 * console.log(error.offset) // 12
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	static new(reason: GuardReason, limit: number, actual: number, offset: number): GuardExceeded {
		return GuardExceeded.make({ reason, limit, actual, offset, message: `${reason}: limit ${limit}, actual ${actual}` });
	}
}

/**
 * Recognizes a schema-valid guard-trip signal before the facade materializes it.
 *
 * **Example** (Recognize a nesting guard trip)
 *
 * ```ts
 * import { GuardExceeded, isGuardExceeded } from "@beep/scratchpad/effected/toml/internal/limits"
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
 * import { assertCap } from "@beep/scratchpad/effected/toml/internal/limits"
 *
 * console.log(assertCap("maxDepth", 256)) // 256
 * console.log(assertCap(64)("maxDepth")) // 64
 * ```
 *
 * @category assertions
 * @since 0.0.0
 */
export const assertCap: {
	(name: string, value: number): number;
	(value: number): (name: string) => number;
} = dual(2, (name: string, value: number): number => {
	if (!Number.isSafeInteger(value) || value < 1) {
		throw TomlCapError.make({
			message: `@effected/toml internal cap ${name} must be a positive integer, received ${value}`,
		});
	}
	return value;
});
