// Shared guard leaf; it never imports the glob engine or facades.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

import { dual } from "effect/Function";

const $I = $ScratchpadId.create("effected/glob/internal/limits");

/** Programmer error raised by this internal glob boundary. */
export class InvalidCap extends S.TaggedError<InvalidCap>($I`InvalidCap`)("InvalidCap", {
	message: S.String.annotateKey({ description: "Why the programmer-supplied internal cap is invalid." }),
}, $I.annote("InvalidCap", {
	title: "Invalid internal glob cap",
	description: "A programmer-supplied glob cap is not a positive safe integer.",
})) {}

/** Hard cap on pattern length. Upstream minimatch's MAX_PATTERN_LENGTH (64KB). */
export const MAX_PATTERN_LENGTH = 1024 * 64;

/** Default brace-expansion output budget. Upstream brace-expansion's EXPANSION_MAX. */
export const EXPANSION_MAX = 100_000;

/** Default bound on non-adjacent globstar backtracking. Upstream minimatch. */
export const MAX_GLOBSTAR_RECURSION = 200;

/** Default extglob parse depth; over-nesting degrades to literal. Upstream minimatch. */
export const MAX_EXTGLOB_RECURSION = 2;

/** House parity constant for the NEW depth guards (yaml/jsonc precedent). */
export const MAX_NESTING_DEPTH = 256;

/** The shared reasons a compile-time glob guard can trip. */
export const GuardReason = LiteralKit(["PatternTooLong", "ExpansionBudgetExceeded", "NestingDepthExceeded"]).annotate(
	$I.annote("GuardReason", {
		title: "Glob compile-time guard reason",
		description: "Identifies a pattern-length, brace-expansion-budget or nesting-depth guard failure.",
	}),
);
export type GuardReason = typeof GuardReason.Type;

/**
 * A finite guard measurement or positive infinity from expansion overflow.
 *
 * **Example** (Recognizing an overflow measurement)
 * ```ts
 * import * as S from "effect/Schema";
 * import { GuardMeasurement } from "./limits.ts";
 * S.is(GuardMeasurement)(Infinity); // true
 * ```
 */
export const GuardMeasurement = S.declare((value): value is number => S.is(S.Finite)(value) || value === Infinity).annotate(
	$I.annote("GuardMeasurement", {
		title: "Glob guard measurement",
		description: "A finite guard measurement or positive infinity when an expansion count overflows.",
	}),
);
export type GuardMeasurement = typeof GuardMeasurement.Type;

/**
 * Raw compile-time guard-trip signal. The engine throws it; ONLY the facade
 * (GlobPattern.compile / the schema check) catches it and materializes the
 * typed GlobPatternError. Match-time code paths never throw it — matches() is
 * total.
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
	override readonly name = "Error";

	/** Construct a guard signal with its standard diagnostic message. */
	static fromReason(reason: GuardReason, limit: number, actual: number): GuardExceeded {
		return GuardExceeded.make({ reason, limit, actual, message: `${reason}: limit ${limit}, actual ${actual}` });
	}
}

export const isGuardExceeded = S.is(GuardExceeded);

/**
 * Internal caps are programmer-supplied. A NaN or non-integer reaching a guard
 * can only come from code, is a wiring bug, and dies as a defect (walker
 * maxDepth rule) — it must never be coerced or clamped.
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
