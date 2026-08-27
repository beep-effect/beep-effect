/**
 * Desugaring of range sugar (caret, tilde, X-ranges, hyphen ranges) into
 * primitive comparator sets, matching node-semver semantics. Operates on
 * structural parts; the `Range` schema materializes classes from the result.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { ComparatorOperator, ComparatorParts, VersionParts } from "./order.ts";

/**
 * A partially specified version as written in range sugar (`1.x`, `1.2`,
 * `*`). `null` in `major`/`minor`/`patch` marks an unspecified (wildcard)
 * component; `prerelease`/`build` are only populated when the fully
 * specified suffix of a partial version carries them.
 *
 * @category type-level
 * @since 0.0.0
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
 *
 * **Gotchas**
 *
 * `~1` (no minor) allows minor-level changes: `>=1.0.0 <2.0.0-0`. That is
 * broader than `~1.2.3` (`>=1.2.3 <1.3.0-0`).
 *
 * **Example** (Expand `~1.2.3` to a patch-level window)
 *
 * ```ts
 * import { desugarTilde } from "../../semver/internal/desugar.ts";
 * import { formatComparator } from "../../semver/internal/grammar.ts";
 *
 * const comparators = desugarTilde({
 *   major: 1,
 *   minor: 2,
 *   patch: 3,
 *   prerelease: [],
 *   build: [],
 * });
 * console.log(comparators.map(formatComparator));
 * // => [">=1.2.3", "<1.3.0-0"]
 * ```
 *
 * @see {@link desugarCaret} for npm compatibility (`^`) expansion, which uses the rightmost non-zero 0.x rule.
 * @see {@link parseRange} for the grammar entry point that calls this after seeing `~`.
 * @category normalization
 * @since 0.0.0
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
 *
 * **Gotchas**
 *
 * `^` is not "compatible major" on 0.x: `^0.2.3` is `>=0.2.3 <0.3.0-0`, and
 * `^0.0.3` is `>=0.0.3 <0.0.4-0`.
 *
 * **Example** (Caret on 0.x allows only the rightmost non-zero component)
 *
 * ```ts
 * import { desugarCaret } from "../../semver/internal/desugar.ts";
 * import { formatComparator } from "../../semver/internal/grammar.ts";
 *
 * const comparators = desugarCaret({
 *   major: 0,
 *   minor: 2,
 *   patch: 3,
 *   prerelease: [],
 *   build: [],
 * });
 * console.log(comparators.map(formatComparator));
 * // => [">=0.2.3", "<0.3.0-0"]
 * ```
 *
 * @see {@link desugarTilde} for `~` expansion, which does not special-case 0.x.
 * @see {@link parseRange} for the grammar entry point that calls this after seeing `^`.
 * @category normalization
 * @since 0.0.0
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
 *
 * **Gotchas**
 *
 * Operator + wildcard rewrites do not preserve the operator: `>1.x` becomes
 * `>=2.0.0`, and `<=1.2.x` becomes `<1.3.0-0`. Both `*` and `>*` expand to
 * `>=0.0.0`.
 *
 * **Example** (Rewrite `>1.x` to a lower bound on the next major)
 *
 * ```ts
 * import { desugarXRange } from "../../semver/internal/desugar.ts";
 * import { formatComparator } from "../../semver/internal/grammar.ts";
 *
 * const comparators = desugarXRange(">", {
 *   major: 1,
 *   minor: null,
 *   patch: null,
 *   prerelease: [],
 *   build: [],
 * });
 * console.log(comparators.map(formatComparator));
 * // => [">=2.0.0"]
 * ```
 *
 * @see {@link desugarHyphen} for hyphen-range expansion (`1.2.3 - 2.3`).
 * @see {@link parseRange} for the grammar entry point that feeds partial versions into this function.
 * @category normalization
 * @since 0.0.0
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
 *
 * **Gotchas**
 *
 * A partial upper bound uses exclusive `<` on the next component
 * (`1.2.3 - 2.3` → `>=1.2.3 <2.4.0-0`). A fully specified upper bound uses
 * inclusive `<=`.
 *
 * **Example** (Partial upper bound becomes an exclusive next-minor)
 *
 * ```ts
 * import { desugarHyphen } from "../../semver/internal/desugar.ts";
 * import { formatComparator } from "../../semver/internal/grammar.ts";
 *
 * const comparators = desugarHyphen(
 *   { major: 1, minor: 2, patch: 3, prerelease: [], build: [] },
 *   { major: 2, minor: 3, patch: null, prerelease: [], build: [] },
 * );
 * console.log(comparators.map(formatComparator));
 * // => [">=1.2.3", "<2.4.0-0"]
 * ```
 *
 * @see {@link desugarXRange} for wildcard and operator-prefix expansion.
 * @see {@link parseRange} for the grammar entry point that detects ` - ` hyphen ranges.
 * @category normalization
 * @since 0.0.0
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
