// Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
// Copyright: Isaac Z. Schlueter and Contributors
// License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
// Port notes: the over-length throw is rewired from a bare TypeError to the
// GuardExceeded("PatternTooLong") signal the facade materializes into the
// typed GlobPatternError. A non-string stays a TypeError — it cannot arrive
// through the schema-typed public surface, so it is programmer error and dies
// as a defect.

import { GuardExceeded, MAX_PATTERN_LENGTH } from "./limits.ts";

export const assertValidPattern: (pattern: unknown) => void = (pattern: unknown): asserts pattern is string => {
	if (typeof pattern !== "string") {
		throw new TypeError("invalid pattern");
	}

	if (pattern.length > MAX_PATTERN_LENGTH) {
		throw new GuardExceeded("PatternTooLong", MAX_PATTERN_LENGTH, pattern.length);
	}
};
