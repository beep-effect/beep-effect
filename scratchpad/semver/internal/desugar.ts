// Desugaring of range sugar (caret, tilde, X-ranges, hyphen ranges) into
// primitive comparator sets, matching node-semver semantics. Operates on
// structural parts; the `Range` schema materializes classes from the result.

import type { ComparatorOperator, ComparatorParts, VersionParts } from "./order.ts";

/**
 * A partially specified version as written in range sugar (`1.x`, `1.2`,
 * `*`). `null` in `major`/`minor`/`patch` marks an unspecified (wildcard)
 * component; `prerelease`/`build` are only populated when the fully
 * specified suffix of a partial version carries them.
 */
export interface PartialParts {
	readonly major: number | null;
	readonly minor: number | null;
	readonly patch: number | null;
	readonly prerelease: ReadonlyArray<string | number>;
	readonly build: ReadonlyArray<string>;
}

const sv = (
	major: number,
	minor: number,
	patch: number,
	prerelease: ReadonlyArray<string | number> = [],
	build: ReadonlyArray<string> = [],
): VersionParts => ({ major, minor, patch, prerelease, build });

const comp = (operator: ComparatorOperator, version: VersionParts): ComparatorParts => ({ operator, version });

/**
 * Desugar a tilde range (`~1.2.3`, `~1.2`, `~1`) into a `>=`/`<` comparator
 * pair that allows patch-level changes when a minor version is specified,
 * and minor-level changes when it is not.
 */
export const desugarTilde = (p: PartialParts): ReadonlyArray<ComparatorParts> => {
	const major = p.major ?? 0;
	const minor = p.minor;
	const patch = p.patch ?? 0;

	if (minor === null) {
		// ~1 -> >=1.0.0 <2.0.0-0
		return [comp(">=", sv(major, 0, 0)), comp("<", sv(major + 1, 0, 0, [0]))];
	}

	// ~1.2.3 -> >=1.2.3 <1.3.0-0
	// ~1.2 -> >=1.2.0 <1.3.0-0
	return [comp(">=", sv(major, minor, patch, p.prerelease)), comp("<", sv(major, minor + 1, 0, [0]))];
};

/**
 * Desugar a caret range (`^1.2.3`) into a `>=`/`<` comparator pair per npm's
 * compatibility rules: changes are allowed in the rightmost of
 * major/minor/patch that is non-zero (so `^0.2.3` allows patch bumps only,
 * `^0.0.3` allows none).
 */
export const desugarCaret = (p: PartialParts): ReadonlyArray<ComparatorParts> => {
	const major = p.major ?? 0;
	const minor = p.minor;
	const patch = p.patch;

	const lower = sv(major, minor ?? 0, patch ?? 0, p.prerelease);

	if (major !== 0) {
		// ^1.2.3 -> >=1.2.3 <2.0.0-0
		return [comp(">=", lower), comp("<", sv(major + 1, 0, 0, [0]))];
	}

	// major is 0
	if (minor === null) {
		// ^0.x -> >=0.0.0 <1.0.0-0
		return [comp(">=", lower), comp("<", sv(1, 0, 0, [0]))];
	}

	if (minor !== 0) {
		// ^0.2.3 -> >=0.2.3 <0.3.0-0
		return [comp(">=", lower), comp("<", sv(0, minor + 1, 0, [0]))];
	}

	// major is 0, minor is 0
	if (patch === null) {
		// ^0.0.x or ^0.0 -> >=0.0.0 <0.1.0-0
		return [comp(">=", lower), comp("<", sv(0, 1, 0, [0]))];
	}

	if (patch !== 0) {
		// ^0.0.3 -> >=0.0.3 <0.0.4-0
		return [comp(">=", lower), comp("<", sv(0, 0, patch + 1, [0]))];
	}

	// ^0.0.0 -> >=0.0.0 <0.0.1-0
	return [comp(">=", lower), comp("<", sv(0, 0, 1, [0]))];
};

/**
 * Desugar an X-range (`1.x`, `1.2.x`, `*`) or a fully-specified
 * operator-prefixed version into its equivalent comparator set. A fully
 * specified version with no operator (or `=`) desugars to a single `=`
 * comparator; wildcards expand to the bounding `>=`/`<` pair implied by the
 * given `operator`.
 */
export const desugarXRange = (operator: string | null, p: PartialParts): ReadonlyArray<ComparatorParts> => {
	const major = p.major;
	const minor = p.minor;
	const patch = p.patch;

	// Fully specified (no wildcards)
	if (major !== null && minor !== null && patch !== null) {
		const version = sv(major, minor, patch, p.prerelease, p.build);
		if (operator === null || operator === "=") {
			return [comp("=", version)];
		}
		return [comp(operator as ">" | ">=" | "<" | "<=", version)];
	}

	// Has wildcards
	if (major === null) {
		// * -> >=0.0.0; >* or >=* etc. still resolve to >=0.0.0
		return [comp(">=", sv(0, 0, 0))];
	}

	if (minor === null) {
		// 1.x or 1.*
		if (operator === null || operator === "=") {
			return [comp(">=", sv(major, 0, 0)), comp("<", sv(major + 1, 0, 0, [0]))];
		}
		if (operator === ">") {
			// >1.x -> >=2.0.0
			return [comp(">=", sv(major + 1, 0, 0))];
		}
		if (operator === ">=") {
			// >=1.x -> >=1.0.0
			return [comp(">=", sv(major, 0, 0))];
		}
		if (operator === "<") {
			// <1.x -> <1.0.0
			return [comp("<", sv(major, 0, 0))];
		}
		// <=1.x -> <2.0.0-0
		return [comp("<", sv(major + 1, 0, 0, [0]))];
	}

	// patch is null (minor is set): 1.2.x
	if (operator === null || operator === "=") {
		return [comp(">=", sv(major, minor, 0)), comp("<", sv(major, minor + 1, 0, [0]))];
	}
	if (operator === ">") {
		// >1.2.x -> >=1.3.0
		return [comp(">=", sv(major, minor + 1, 0))];
	}
	if (operator === ">=") {
		// >=1.2.x -> >=1.2.0
		return [comp(">=", sv(major, minor, 0))];
	}
	if (operator === "<") {
		// <1.2.x -> <1.2.0
		return [comp("<", sv(major, minor, 0))];
	}
	// <=1.2.x -> <1.3.0-0
	return [comp("<", sv(major, minor + 1, 0, [0]))];
};

/**
 * Desugar a hyphen range (`1.2.3 - 2.3.4`) into a comparator pair: `>=` the
 * lower bound and, for the upper bound, `<=` when it is fully specified or
 * `<` the next unspecified component when it is partial (`1.2.3 - 2.3` →
 * `>=1.2.3 <2.4.0-0`).
 */
export const desugarHyphen = (lower: PartialParts, upper: PartialParts): ReadonlyArray<ComparatorParts> => {
	const lowerVersion = sv(lower.major ?? 0, lower.minor ?? 0, lower.patch ?? 0, lower.prerelease);

	if (upper.major !== null && upper.minor !== null && upper.patch !== null) {
		// Full upper: >=lower <=upper
		const upperVersion = sv(upper.major, upper.minor, upper.patch, upper.prerelease);
		return [comp(">=", lowerVersion), comp("<=", upperVersion)];
	}

	// Partial upper
	if (upper.major !== null && upper.minor !== null) {
		// 1.2.3 - 2.3 -> >=1.2.3 <2.4.0-0
		return [comp(">=", lowerVersion), comp("<", sv(upper.major, upper.minor + 1, 0, [0]))];
	}

	if (upper.major !== null) {
		// 1.2.3 - 2 -> >=1.2.3 <3.0.0-0
		return [comp(">=", lowerVersion), comp("<", sv(upper.major + 1, 0, 0, [0]))];
	}

	// upper is * -> >=lower
	return [comp(">=", lowerVersion)];
};
