// Shared guard leaf; it never imports the glob engine or facades.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

import * as Data from "effect/Data";
import { dual } from "effect/Function";

const $I = $ScratchpadId.create("effected/glob/internal/limits");

/** Programmer error raised by this internal glob boundary. */
export class InvalidCap extends S.TaggedError<InvalidCap>($I`InvalidCap`)("InvalidCap", {
	message: S.String,
}) {}

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

/** The reasons a compile-time guard can trip; mirrors GlobPatternError's reason union. */
export type GuardReason = "PatternTooLong" | "ExpansionBudgetExceeded" | "NestingDepthExceeded";

/**
 * Raw compile-time guard-trip signal. The engine throws it; ONLY the facade
 * (GlobPattern.compile / the schema check) catches it and materializes the
 * typed GlobPatternError. Match-time code paths never throw it — matches() is
 * total.
 */
export class GuardExceeded extends Data.TaggedError("GuardExceeded")<{
	readonly reason: GuardReason;
	readonly limit: number;
	readonly actual: number;
}> {
	constructor(reason: GuardReason, limit: number, actual: number) {
		const fields = { reason, limit, actual, message: `${reason}: limit ${limit}, actual ${actual}` };
		super(fields);
		this.name = "Error";
	}
}

export const isGuardExceeded = (u: unknown): u is GuardExceeded => u instanceof GuardExceeded;

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
