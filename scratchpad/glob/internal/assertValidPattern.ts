/**
 * Engine entry guard for glob pattern strings.
 *
 * Rejects a non-string as a `TypeError` defect and an over-length string as
 * the typed {@link GuardExceeded} `PatternTooLong` signal the facade
 * materializes into {@link GlobPatternError}. A non-string cannot arrive
 * through the schema-typed public surface, so it is programmer error.
 *
 * Ported from minimatch@10.2.5. Copyright Isaac Z. Schlueter and Contributors.
 * License: BlueOak-1.0.0.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GuardExceeded, MAX_PATTERN_LENGTH } from "./limits.ts";

/**
 * Assert that `pattern` is a string no longer than {@link MAX_PATTERN_LENGTH}.
 *
 * **Gotchas**
 *
 * Compile-time only. A non-string is a `TypeError` defect; length over the
 * 64 KiB cap is {@link GuardExceeded} `PatternTooLong`, not a match-time
 * hang. Invalid options never reach this function.
 *
 * **Example** (Reject a non-string and an over-length pattern)
 *
 * ```ts
 * import { assertValidPattern } from "../../glob/internal/assertValidPattern.ts"
 * import { GuardExceeded } from "../../glob/internal/limits.ts"
 *
 * try {
 *   assertValidPattern(1)
 * } catch (error) {
 *   console.log(error instanceof TypeError) // true
 * }
 *
 * try {
 *   assertValidPattern("x".repeat(64 * 1024 + 1))
 * } catch (error) {
 *   console.log(error instanceof GuardExceeded && error.reason === "PatternTooLong") // true
 * }
 * ```
 *
 * @throws `TypeError` when `pattern` is not a string — a programmer defect
 * outside the typed error channel.
 * @throws `GuardExceeded` with reason `PatternTooLong` when the string
 * exceeds 64 KiB.
 * @internal
 * @category assertions
 * @since 0.0.0
 */
export const assertValidPattern: (pattern: unknown) => void = (pattern: unknown): asserts pattern is string => {
	if (typeof pattern !== "string") {
		throw new TypeError("invalid pattern");
	}

	if (pattern.length > MAX_PATTERN_LENGTH) {
		throw new GuardExceeded("PatternTooLong", MAX_PATTERN_LENGTH, pattern.length);
	}
};
