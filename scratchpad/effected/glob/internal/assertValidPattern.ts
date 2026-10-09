// Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
// Copyright: Isaac Z. Schlueter and Contributors
// License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
// Port notes: the over-length throw is rewired from a bare TypeError to the
// GuardExceeded("PatternTooLong") signal the facade materializes into the
// typed GlobPatternError. A non-string throws InvalidPattern — it cannot arrive
// through the schema-typed public surface, so it is programmer error and dies
// as a defect.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { GuardExceeded, MAX_PATTERN_LENGTH } from "./limits.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/glob/internal/assertValidPattern");

/**
 * Programmer error raised by this internal glob boundary.
 *
 * **Example** (Inspect an invalid-pattern error)
 *
 * ```ts
 * import { InvalidPattern } from "@beep/scratchpad/effected/glob/internal/assertValidPattern";
 *
 * const error = InvalidPattern.make({ message: "invalid pattern" });
 * console.log(error.message); // invalid pattern
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class InvalidPattern extends S.TaggedError<InvalidPattern>($I`InvalidPattern`)("InvalidPattern", {
	message: S.String.annotateKey({ description: "Why the programmer-supplied pattern is invalid." }),
}, $I.annote("InvalidPattern", {
	title: "Invalid internal glob pattern",
	description: "An internal glob boundary received a non-string pattern, indicating a programmer error.",
})) {}

/**
 * Rejects non-string patterns and strings that exceed the glob engine's length cap.
 *
 * **Gotchas**
 *
 * A non-string throws {@link InvalidPattern}, indicating a programmer error.
 * An over-length string throws {@link GuardExceeded} with the `PatternTooLong`
 * reason; the facade materializes this signal into a typed `GlobPatternError`.
 *
 * **Example** (Validate a pattern before compilation)
 *
 * ```ts
 * import { assertValidPattern } from "@beep/scratchpad/effected/glob/internal/assertValidPattern";
 *
 * console.log(assertValidPattern("packages/*")); // undefined
 * ```
 *
 * @category assertions
 * @since 0.0.0
 */
export const assertValidPattern: (pattern: unknown) => void = (pattern: unknown): asserts pattern is string => {
	if (!P.isString(pattern)) {
		throw InvalidPattern.make({ message: "invalid pattern" });
	}

	if (pattern.length > MAX_PATTERN_LENGTH) {
		throw GuardExceeded.fromReason("PatternTooLong", MAX_PATTERN_LENGTH, pattern.length);
	}
};
