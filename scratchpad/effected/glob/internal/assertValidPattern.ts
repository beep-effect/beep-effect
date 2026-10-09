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

/** Programmer error raised by this internal glob boundary. */
export class InvalidPattern extends S.TaggedError<InvalidPattern>($I`InvalidPattern`)("InvalidPattern", {
	message: S.String,
}) {}

export const assertValidPattern: (pattern: unknown) => void = (pattern: unknown): asserts pattern is string => {
	if (!P.isString(pattern)) {
		throw InvalidPattern.make({ message: "invalid pattern" });
	}

	if (pattern.length > MAX_PATTERN_LENGTH) {
		throw new GuardExceeded("PatternTooLong", MAX_PATTERN_LENGTH, pattern.length);
	}
};
