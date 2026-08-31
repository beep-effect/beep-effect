/**
 * Compile-time guard caps for hostile glob input.
 *
 * **Details**
 *
 * This is the zero-dependency leaf every guard imports — no import cycle is
 * possible through here. Pattern length, brace-expansion budget, globstar
 * backtracking, extglob parse depth, and structural nesting each have a
 * distinct policy: throw, silent false-negative, or degrade-to-literal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("glob/internal/limits");

const GuardReasonBase = LiteralKit([
	"PatternTooLong",
	"ExpansionBudgetExceeded",
	"NestingDepthExceeded",
]);

/**
 * Hard cap on pattern length. Upstream minimatch's MAX_PATTERN_LENGTH (64KB).
 *
 * **Gotchas**
 *
 * Over-length is a compile-time {@link GuardExceeded} `PatternTooLong` that
 * the facade turns into {@link GlobPatternError}. Match-time never throws this.
 *
 * **Example** (Reject a 64 KiB-plus pattern)
 *
 * ```ts
 * import { GlobPattern } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const compiled = GlobPattern.compileResult("x".repeat(64 * 1024 + 1))
 * console.log(Result.isFailure(compiled) && compiled.failure.reason === "PatternTooLong") // true
 * console.log(Result.isFailure(compiled) && compiled.failure.limit === 64 * 1024) // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const MAX_PATTERN_LENGTH = 1024 * 64;

/**
 * Default brace-expansion output budget. Upstream brace-expansion's EXPANSION_MAX.
 *
 * **Gotchas**
 *
 * Exhausting this budget throws {@link GuardExceeded} `ExpansionBudgetExceeded`
 * instead of silently truncating the expansion list. Caps on
 * `braceExpandMax` tighten toward this ceiling; they never raise it.
 *
 * **Example** (Trip the brace budget)
 *
 * ```ts
 * import { GlobPattern } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const compiled = GlobPattern.compileResult("{0..100000}")
 * console.log(Result.isFailure(compiled) && compiled.failure.reason === "ExpansionBudgetExceeded") // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const EXPANSION_MAX = 100_000;

/**
 * Default bound on non-adjacent globstar backtracking. Upstream minimatch.
 *
 * **Gotchas**
 *
 * Exceeding this cap is a silent false negative: {@link GlobPattern.matches}
 * returns `false` and never {@link GuardExceeded}. `noglobstar` rewrites `**`
 * to `*` instead of walking nested directories. This is not a compile error.
 *
 * **Example** (Match under the default globstar cap)
 *
 * ```ts
 * import { GlobPattern } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const compiled = GlobPattern.compileResult("**\/*.ts")
 * console.log(Result.isSuccess(compiled) && compiled.success.matches("src/index.ts")) // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const MAX_GLOBSTAR_RECURSION = 200;

/**
 * Default extglob parse depth; over-nesting degrades to literal. Upstream minimatch.
 *
 * **Gotchas**
 *
 * Over-limit nested extglobs become literals — match semantics change with no
 * {@link GlobPatternError}. {@link MAX_NESTING_DEPTH} is the throw
 * (`NestingDepthExceeded`) on hostile `@(@(@` chains. Globstar over-cap is a
 * false `false`. Brace-budget over-cap throws `ExpansionBudgetExceeded`.
 *
 * **Example** (Compile a shallow extglob)
 *
 * ```ts
 * import { GlobPattern } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const compiled = GlobPattern.compileResult("+(js|ts)")
 * console.log(Result.isSuccess(compiled) && compiled.success.matches("ts")) // true
 * console.log(Result.isSuccess(compiled) && compiled.success.matches("tsx")) // false
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const MAX_EXTGLOB_RECURSION = 2;

/**
 * House parity constant for the NEW depth guards (yaml/jsonc precedent).
 *
 * **Gotchas**
 *
 * This is the structural throw (`NestingDepthExceeded`) on brace expand and
 * on `@(@(@` extglob chains that overflow real minimatch 10.2.5. It is not
 * the extglob degrade-to-literal cap and not the globstar false-negative cap.
 *
 * **Example** (Compile a shallow brace set)
 *
 * ```ts
 * import { GlobPattern } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const compiled = GlobPattern.compileResult("a{b,c}d")
 * console.log(Result.isSuccess(compiled) && compiled.success.matches("abd")) // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const MAX_NESTING_DEPTH = 256;

/**
 * Finite reason vocabulary for compile-time glob guard failures.
 *
 * **Example** (Recognize a guard reason)
 *
 * ```ts
 * import { GuardReason } from "../../glob/internal/limits.ts"
 *
 * console.log(GuardReason.is.PatternTooLong("PatternTooLong")) // true
 * console.log(GuardReason.is.PatternTooLong("Unknown")) // false
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const GuardReason = GuardReasonBase.pipe(
	$I.annoteSchema("GuardReason", {
		description: "Reason a defensive compile-time glob guard rejected a pattern.",
	}),
	SchemaUtils.withLiteralKitStatics(GuardReasonBase),
);

/**
 * Decoded reason produced by {@link GuardReason}.
 *
 * **Example** (Declare a guard reason)
 *
 * ```ts
 * import type { GuardReason } from "../../glob/internal/limits.ts"
 *
 * const reason = "PatternTooLong" satisfies GuardReason
 * console.log(reason) // "PatternTooLong"
 * ```
 *
 * @see {@link GuardReason} for the runtime schema and guard helpers.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type GuardReason = typeof GuardReason.Type;

const GuardMagnitude = S.Natural.pipe(
	$I.annoteSchema("GuardMagnitude", {
		description: "Non-negative safe integer observed or configured by a defensive glob guard.",
	}),
);

/**
 * Raw compile-time guard-trip signal. The engine throws it; ONLY the facade
 * (GlobPattern.compile / the schema check) catches it and materializes the
 * typed GlobPatternError. Match-time code paths never throw it — matches() is
 * total.
 *
 * **Gotchas**
 *
 * Compile-time only. The three reasons are `PatternTooLong`,
 * `ExpansionBudgetExceeded`, and `NestingDepthExceeded`. Invalid caps are
 * {@link GlobInvariantError} defects via {@link assertCap}. Globstar over-cap
 * never becomes this error.
 *
 * **Example** (Construct a compile-time guard trip)
 *
 * ```ts
 * import { GuardExceeded } from "../../glob/internal/limits.ts"
 *
 * const error = GuardExceeded.make({ reason: "PatternTooLong", limit: 64 * 1024, actual: 64 * 1024 + 1 })
 * console.log(error.reason) // "PatternTooLong"
 * console.log(error.limit) // 65536
 * console.log(error.actual) // 65537
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class GuardExceeded extends S.TaggedError<GuardExceeded>($I`GuardExceeded`)(
	"GuardExceeded",
	{
		reason: GuardReason,
		limit: GuardMagnitude,
		actual: GuardMagnitude,
	},
	$I.annote("GuardExceeded", {
		description: "Raw engine signal for a defensive compile-time glob guard failure.",
	}),
) {
	/** Human-readable guard failure with the configured and observed values. */
	override get message(): string {
		return `${this.reason}: limit ${this.limit}, actual ${this.actual}`;
	}
}

/**
 * Type guard for the raw engine {@link GuardExceeded} signal.
 *
 * **Example** (Recognize a thrown GuardExceeded)
 *
 * ```ts
 * import { GlobInvariantError, GuardExceeded, isGuardExceeded } from "../../glob/internal/limits.ts"
 *
 * console.log(isGuardExceeded(GuardExceeded.make({ reason: "ExpansionBudgetExceeded", limit: 100_000, actual: 100_001 }))) // true
 * console.log(isGuardExceeded(GlobInvariantError.make({ operation: "assertCap", detail: "invalid cap" }))) // false
 * ```
 *
 * @internal
 * @category guards
 * @since 0.0.0
 */
export const isGuardExceeded: (u: unknown) => u is GuardExceeded = S.is(GuardExceeded);

/**
 * Defect raised when internal glob wiring violates an invariant.
 *
 * **Example** (Construct an invariant defect)
 *
 * ```ts
 * import { GlobInvariantError } from "../../glob/internal/limits.ts"
 *
 * const error = GlobInvariantError.make({ operation: "assertCap", detail: "cap must be positive" })
 * console.log(error.operation) // "assertCap"
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class GlobInvariantError extends S.TaggedError<GlobInvariantError>($I`GlobInvariantError`)(
	"GlobInvariantError",
	{
		operation: S.NonEmptyString,
		detail: S.NonEmptyString,
	},
	$I.annote("GlobInvariantError", {
		description: "Programmer defect raised when internal glob engine wiring violates an invariant.",
	}),
) {
	/** Human-readable invariant failure. */
	override get message(): string {
		return `${this.operation}: ${this.detail}`;
	}
}

const PositiveSafeInteger = S.Int.check(S.isGreaterThan(0)).pipe(
	$I.annoteSchema("PositiveSafeInteger", {
		description: "Positive safe integer accepted by internal glob recursion and expansion caps.",
	}),
	SchemaUtils.withCodecStatics(["is"]),
);

/**
 * Internal caps are programmer-supplied. A NaN or non-integer reaching a guard
 * can only come from code, is a wiring bug, and dies as a defect (walker
 * maxDepth rule) — it must never be coerced or clamped.
 *
 * **Gotchas**
 *
 * Invalid options/caps are defects, not {@link GlobPatternError}. The public
 * `braceExpandMax` schema already rejects values outside 1..100000 at `make`.
 *
 * **Example** (Reject a non-positive cap)
 *
 * ```ts
 * import { assertCap, GlobInvariantError } from "../../glob/internal/limits.ts"
 *
 * console.log(assertCap(8, "braceExpandMax")) // 8
 * try {
 *   assertCap(0, "braceExpandMax")
 * } catch (error) {
 *   console.log(error instanceof GlobInvariantError) // true
 * }
 * ```
 *
 * @throws When `value` is not a positive safe integer, with {@link GlobInvariantError}.
 * @internal
 * @category assertions
 * @since 0.0.0
 */
export const assertCap: {
	(name: string): (value: number) => number;
	(value: number, name: string): number;
} = dual(2, (value: number, name: string): number => {
	if (!PositiveSafeInteger.is(value)) {
		throw GlobInvariantError.make({
			operation: "assertCap",
			detail: `@effected/glob internal cap ${name} must be a positive integer, received ${value}`,
		});
	}
	return value;
});
