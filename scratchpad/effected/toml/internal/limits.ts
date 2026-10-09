import { $ScratchpadId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
// The zero-dependency leaf every guard imports — no import cycle is possible
// through here (jsonc/yaml/glob precedent).

const $I = $ScratchpadId.create("effected/toml/internal/limits");

class TomlCapError extends S.TaggedError<TomlCapError>($I`TomlCapError`)("TomlCapError", {
	message: S.String.annotateKey({ description: "Explanation of the invalid programmer-supplied cap." }),
}, $I.annote("TomlCapError", { description: "An invalid internal cap indicates a wiring defect." })) {}

/** House parity constant for depth guards (yaml/jsonc/glob precedent). */
export const MAX_NESTING_DEPTH = 256;

/** The reasons a guard can trip; mirrors the NestingDepthExceeded parse/stringify codes. */
export type GuardReason = "NestingDepthExceeded";

/**
 * Raw guard-trip signal. The engine throws it; ONLY the public modules catch
 * it and materialize the typed error. It must never escape a public entry
 * point as a defect.
 */
export class GuardExceeded extends S.TaggedError<GuardExceeded>($I`GuardExceeded`)("GuardExceeded", {
	message: S.String.annotateKey({ description: "The reason, configured limit and observed depth." }),
	reason: S.Literal("NestingDepthExceeded").annotateKey({ description: "The engine guard that exceeded its limit." }),
	limit: S.Finite.annotateKey({ description: "The configured nesting limit." }),
	actual: S.Finite.annotateKey({ description: "The observed nesting depth." }),
	offset: S.Finite.annotateKey({ description: "Source offset where the guard tripped." }),
}, $I.annote("GuardExceeded", { description: "A raw nesting guard trip materialized into a diagnostic by the facade." })) {
	override readonly name = "Error";

	static new(reason: GuardReason, limit: number, actual: number, offset: number): GuardExceeded {
		return GuardExceeded.make({ reason, limit, actual, offset, message: `${reason}: limit ${limit}, actual ${actual}` });
	}
}

export const isGuardExceeded = S.is(GuardExceeded);

/**
 * Internal caps are programmer-supplied. A NaN or non-integer reaching a guard
 * is a wiring bug and dies as a defect (walker maxDepth rule) — never coerced.
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
