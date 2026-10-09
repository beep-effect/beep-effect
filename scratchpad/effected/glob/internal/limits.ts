// Shared guard leaf; it never imports the glob engine or facades.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

import { dual } from "effect/Function";

const $I = $ScratchpadId.create("effected/glob/internal/limits");

/**
 * Programmer error raised by this internal glob boundary.
 *
 * **Example** (Describe an invalid internal cap)
 *
 * ```ts
 * import { InvalidCap } from "@beep/scratchpad/effected/glob/internal/limits";
 *
 * const error = InvalidCap.make({ message: "The expansion cap must be a positive safe integer." });
 *
 * console.log(error.message); // The expansion cap must be a positive safe integer.
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class InvalidCap extends S.TaggedError<InvalidCap>($I`InvalidCap`)("InvalidCap", {
	message: S.String.annotateKey({ description: "Why the programmer-supplied internal cap is invalid." }),
}, $I.annote("InvalidCap", {
	title: "Invalid internal glob cap",
	description: "A programmer-supplied glob cap is not a positive safe integer.",
})) {}

/**
 * Hard cap on pattern length.
 *
 * **Details**
 *
 * Upstream minimatch's MAX_PATTERN_LENGTH (64KB).
 *
 * **Example** (Inspect the pattern length cap)
 *
 * ```ts
 * import { MAX_PATTERN_LENGTH } from "@beep/scratchpad/effected/glob/internal/limits";
 *
 * console.log(MAX_PATTERN_LENGTH); // 65536
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_PATTERN_LENGTH = 1024 * 64;

/**
 * Default brace-expansion output budget.
 *
 * **Details**
 *
 * Upstream brace-expansion's EXPANSION_MAX.
 *
 * **Example** (Inspect the brace expansion budget)
 *
 * ```ts
 * import { EXPANSION_MAX } from "@beep/scratchpad/effected/glob/internal/limits";
 *
 * console.log(EXPANSION_MAX); // 100000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const EXPANSION_MAX = 100_000;

/**
 * Default bound on non-adjacent globstar backtracking.
 *
 * **Details**
 *
 * Upstream minimatch.
 *
 * **Example** (Inspect the globstar backtracking bound)
 *
 * ```ts
 * import { MAX_GLOBSTAR_RECURSION } from "@beep/scratchpad/effected/glob/internal/limits";
 *
 * console.log(MAX_GLOBSTAR_RECURSION); // 200
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_GLOBSTAR_RECURSION = 200;

/**
 * Default extglob parse depth; over-nesting degrades to literal.
 *
 * **Details**
 *
 * Upstream minimatch.
 *
 * **Example** (Inspect the extglob parse depth)
 *
 * ```ts
 * import { MAX_EXTGLOB_RECURSION } from "@beep/scratchpad/effected/glob/internal/limits";
 *
 * console.log(MAX_EXTGLOB_RECURSION); // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_EXTGLOB_RECURSION = 2;

/**
 * House parity constant for the NEW depth guards (yaml/jsonc precedent).
 *
 * **Example** (Inspect the nesting depth bound)
 *
 * ```ts
 * import { MAX_NESTING_DEPTH } from "@beep/scratchpad/effected/glob/internal/limits";
 *
 * console.log(MAX_NESTING_DEPTH); // 256
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_NESTING_DEPTH = 256;

/**
 * The shared reasons a compile-time glob guard can trip.
 *
 * **Example** (Recognize a pattern length guard reason)
 *
 * ```ts
 * import { GuardReason } from "@beep/scratchpad/effected/glob/internal/limits";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(GuardReason)("PatternTooLong")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GuardReason = LiteralKit(["PatternTooLong", "ExpansionBudgetExceeded", "NestingDepthExceeded"]).annotate(
	$I.annote("GuardReason", {
		title: "Glob compile-time guard reason",
		description: "Identifies a pattern-length, brace-expansion-budget or nesting-depth guard failure.",
	}),
);
/**
 * Identifies a pattern-length, brace-expansion-budget or nesting-depth guard failure.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GuardReason = typeof GuardReason.Type;

/**
 * A finite guard measurement or positive infinity from expansion overflow.
 *
 * **Example** (Recognizing an overflow measurement)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { GuardMeasurement } from "@beep/scratchpad/effected/glob/internal/limits";
 *
 * console.log(S.is(GuardMeasurement)(Infinity)); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GuardMeasurement = S.declare((value): value is number => S.is(S.Finite)(value) || value === Infinity).annotate(
	$I.annote("GuardMeasurement", {
		title: "Glob guard measurement",
		description: "A finite guard measurement or positive infinity when an expansion count overflows.",
	}),
);
/**
 * Represents a finite guard measurement or positive infinity from expansion overflow.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GuardMeasurement = typeof GuardMeasurement.Type;

/**
 * Raw compile-time guard-trip signal.
 *
 * **Details**
 *
 * The engine throws it; ONLY the facade
 * (GlobPattern.compile / the schema check) catches it and materializes the
 * typed GlobPatternError.
 *
 * **Gotchas**
 *
 * Match-time code paths never throw it — matches() is
 * total.
 *
 * **Example** (Inspect an expansion overflow signal)
 *
 * ```ts
 * import { GuardExceeded } from "@beep/scratchpad/effected/glob/internal/limits";
 *
 * const error = GuardExceeded.fromReason("ExpansionBudgetExceeded", 100_000, Infinity);
 *
 * console.log(error.message); // ExpansionBudgetExceeded: limit 100000, actual Infinity
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GuardExceeded extends S.TaggedError<GuardExceeded>($I`GuardExceeded`)("GuardExceeded", {
	reason: GuardReason.annotateKey({ description: "The compile-time guard whose cap was exceeded." }),
	limit: S.Finite.annotateKey({ description: "The finite cap enforced by the compile-time guard." }),
	// Expansion arithmetic intentionally overflows to Infinity; retain the oracle measurement.
	actual: GuardMeasurement.annotateKey({ description: "The measured value, including Infinity when an expansion count overflows." }),
	message: S.String.annotateKey({ description: "The guard reason, limit and measured value rendered for the caller." }),
}, $I.annote("GuardExceeded", {
	title: "Glob compile-time guard exceeded",
	description: "The internal compile-time guard signal converted by the facades into GlobPatternError.",
})) {
	/**
	 * Identifies the raw guard signal with the standard error name.
	 *
	 * **Example** (Inspect the raw signal name)
	 *
	 * ```ts
	 * import { GuardExceeded } from "@beep/scratchpad/effected/glob/internal/limits";
	 *
	 * const error = GuardExceeded.fromReason("PatternTooLong", 65_536, 65_537);
	 *
	 * console.log(error.name); // Error
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	override readonly name = "Error";

	/**
	 * Construct a guard signal with its standard diagnostic message.
	 *
	 * **Example** (Render a pattern length diagnostic)
	 *
	 * ```ts
	 * import { GuardExceeded } from "@beep/scratchpad/effected/glob/internal/limits";
	 *
	 * const error = GuardExceeded.fromReason("PatternTooLong", 65_536, 65_537);
	 *
	 * console.log(error.message); // PatternTooLong: limit 65536, actual 65537
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	static fromReason(reason: GuardReason, limit: number, actual: number): GuardExceeded {
		return GuardExceeded.make({ reason, limit, actual, message: `${reason}: limit ${limit}, actual ${actual}` });
	}
}

/**
 * Recognizes the internal compile-time guard signal.
 *
 * **Example** (Recognize a guard signal)
 *
 * ```ts
 * import { GuardExceeded, isGuardExceeded } from "@beep/scratchpad/effected/glob/internal/limits";
 *
 * const error = GuardExceeded.fromReason("NestingDepthExceeded", 256, 257);
 *
 * console.log(isGuardExceeded(error)); // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isGuardExceeded = S.is(GuardExceeded);

/**
 * Validates programmer-supplied internal caps as positive safe integers.
 *
 * **Details**
 *
 * Internal caps are programmer-supplied.
 *
 * **Gotchas**
 *
 * A NaN or non-integer reaching a guard
 * can only come from code, is a wiring bug, and dies as a defect (walker
 * maxDepth rule) — it must never be coerced or clamped.
 *
 * **Example** (Validate an internal expansion cap)
 *
 * ```ts
 * import { assertCap } from "@beep/scratchpad/effected/glob/internal/limits";
 *
 * console.log(assertCap("expansion", 100_000)); // 100000
 * ```
 *
 * @category assertions
 * @since 0.0.0
 */
export const assertCap: {
	(value: number): (name: string) => number;
	(name: string, value: number): number;
} = dual(2, (name: string, value: number): number => {
	if (!Number.isSafeInteger(value) || value < 1) {
		throw InvalidCap.make({ message: `@effected/glob internal cap ${name} must be a positive integer, received ${value}` });
	}
	return value;
});
