// Shared comparison primitives over structural version parts.
//
// Every module in the package compares versions through these functions, so
// SemVer 2.0.0 precedence rules live exactly once. Operating on structural
// parts (not the `SemVer` class) keeps this module import-cycle-free: the
// grammar, desugar and normalize pipeline and the `SemVer` class itself all
// consume it.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/semver/internal/order");

/**
 * Structural fields of a parsed version, shared by the parser pipeline.
 *
 * **Details**
 *
 * Numeric prerelease identifiers are numbers; alphanumeric prerelease identifiers and all build identifiers are strings. Empty arrays represent absent prerelease or build suffixes.
 *
 * **Example** (Recognize structural parser output)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { VersionParts } from "@beep/scratchpad/effected/semver/internal/order";
 *
 * S.is(VersionParts)({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] }); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VersionParts = S.Struct({
	major: S.Finite.annotateKey({ description: "The numeric major component before final SemVer validation." }),
	minor: S.Finite.annotateKey({ description: "The numeric minor component before final SemVer validation." }),
	patch: S.Finite.annotateKey({ description: "The numeric patch component before final SemVer validation." }),
	prerelease: S.Array(S.Union([S.String, S.Finite])).annotateKey({ description: "Ordered numeric or text prerelease identifiers; empty for a stable release." }),
	build: S.Array(S.String).annotateKey({ description: "Ordered build identifiers, ignored by version precedence." }),
}).annotate($I.annote("VersionParts", { description: "Plain structural version parts shared by the parser and comparison pipeline before final SemVer validation." }));

/**
 * The structural version data described by {@link VersionParts}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type VersionParts = typeof VersionParts.Type;

/**
 * Defines the relational operator prefix of a comparator (`=`, `>`, `>=`, `<`, `<=`).
 *
 * **Example** (Validate comparator operator literals)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ComparatorOperator } from "@beep/scratchpad/effected/semver/internal/order"
 *
 * console.log(S.is(ComparatorOperator)(">=")) // true
 * console.log(S.is(ComparatorOperator)("~")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ComparatorOperator = LiteralKit(["=", ">", ">=", "<", "<="]).annotate(
	$I.annote("ComparatorOperator", {
		description: "The five relational operators supported by SemVer comparators.",
	}),
);
/**
 * The relational operator literals accepted by the comparator operator schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ComparatorOperator = typeof ComparatorOperator.Type;

/**
 * Structural fields of a parsed comparator.
 *
 * **Details**
 *
 * Pairs a relational operator with the complete structural version used as its comparison bound.
 *
 * **Example** (Recognize a structural comparator)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ComparatorParts } from "@beep/scratchpad/effected/semver/internal/order";
 *
 * S.is(ComparatorParts)({ operator: ">=", version: { major: 1, minor: 0, patch: 0, prerelease: [], build: [] } }); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ComparatorParts = S.Struct({
	operator: ComparatorOperator.annotateKey({ description: "The relational operator applied to the version bound." }),
	version: VersionParts.annotateKey({ description: "The structural comparison bound before final SemVer validation." }),
}).annotate($I.annote("ComparatorParts", { description: "A plain structural comparator pairing an operator with its version bound." }));

/**
 * The structural comparator data described by {@link ComparatorParts}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ComparatorParts = typeof ComparatorParts.Type;

/**
 * Compares two prerelease identifiers per SemVer 2.0.0 §11.
 *
 * **Details**
 *
 * Numeric identifiers always have lower precedence than alphanumeric ones; numerics compare numerically, alphanumerics lexically. The sign determines ordering; comparing two numeric identifiers returns their difference rather than a normalized ordering value.
 *
 * **Example** (Compare numeric and alphanumeric identifiers)
 *
 * ```ts
 * import { comparePrereleaseIdentifier } from "@beep/scratchpad/effected/semver/internal/order"
 *
 * console.log(comparePrereleaseIdentifier(2, 10)) // -8
 * console.log(comparePrereleaseIdentifier(1, "alpha")) // -1
 * console.log(comparePrereleaseIdentifier("beta")("alpha")) // -1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const comparePrereleaseIdentifier: {
	(b: string | number): (a: string | number) => number;
	(a: string | number, b: string | number): number;
} = dual(2, (a: string | number, b: string | number): number => {
	if (P.isNumber(a) && P.isNumber(b)) return a - b;
	if (P.isString(a) && P.isString(b)) return a < b ? -1 : a > b ? 1 : 0;
	if (P.isNumber(a)) return -1;
	return 1;
});

/**
 * Compares two versions per SemVer 2.0.0 precedence (§11).
 *
 * **Details**
 *
 * Build metadata is ignored (§10). Major, minor, and patch components are compared first. A release sorts after a prerelease of the same core version; prerelease identifiers are compared in sequence, with the shorter sequence sorting first when its identifiers all match.
 *
 * **Example** (Order a prerelease before a release)
 *
 * ```ts
 * import { compareParts } from "@beep/scratchpad/effected/semver/internal/order"
 * import type { VersionParts } from "@beep/scratchpad/effected/semver/internal/order"
 *
 * const release: VersionParts = { major: 1, minor: 2, patch: 3, prerelease: [], build: ["first"] }
 * console.log(compareParts({ ...release, prerelease: ["alpha"] }, release)) // -1
 * console.log(compareParts(release, { ...release, build: ["second"] })) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const compareParts: {
	(b: VersionParts): (a: VersionParts) => -1 | 0 | 1;
	(a: VersionParts, b: VersionParts): -1 | 0 | 1;
} = dual(2, (a: VersionParts, b: VersionParts): -1 | 0 | 1 => {
	if (a.major !== b.major) return a.major > b.major ? 1 : -1;
	if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
	if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;

	const aPre = a.prerelease;
	const bPre = b.prerelease;
	if (aPre.length === 0 && bPre.length === 0) return 0;
	if (aPre.length === 0) return 1;
	if (bPre.length === 0) return -1;

	const len = Math.min(aPre.length, bPre.length);
	for (let i = 0; i < len; i++) {
		const cmp = comparePrereleaseIdentifier(A.getUnsafe(aPre, i), A.getUnsafe(bPre, i));
		if (cmp !== 0) return cmp < 0 ? -1 : 1;
	}

	if (aPre.length !== bPre.length) return aPre.length > bPre.length ? 1 : -1;
	return 0;
});

/**
 * Compares build metadata lexically, identifier by identifier.
 *
 * **Details**
 *
 * Versions without build metadata sort before versions with it. This is a total-order tiebreaker outside the SemVer spec (which ignores build metadata), used only by `SemVer.OrderWithBuild`. If matching identifiers exhaust one array first, the shorter array sorts first.
 *
 * **Example** (Break ties using build identifiers)
 *
 * ```ts
 * import { compareBuild } from "@beep/scratchpad/effected/semver/internal/order"
 *
 * console.log(compareBuild([], ["build"])) // -1
 * console.log(compareBuild(["10"], ["2"])) // -1
 * console.log(compareBuild(["build", "1"], ["build"])) // 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const compareBuild: {
	(b: ReadonlyArray<string>): (a: ReadonlyArray<string>) => -1 | 0 | 1;
	(a: ReadonlyArray<string>, b: ReadonlyArray<string>): -1 | 0 | 1;
} = dual(2, (a: ReadonlyArray<string>, b: ReadonlyArray<string>): -1 | 0 | 1 => {
	const aHasBuild = a.length > 0;
	const bHasBuild = b.length > 0;
	if (!aHasBuild && bHasBuild) return -1;
	if (aHasBuild && !bHasBuild) return 1;

	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		const aIdentifier = A.getUnsafe(a, i);
		const bIdentifier = A.getUnsafe(b, i);
		if (aIdentifier < bIdentifier) return -1;
		if (aIdentifier > bIdentifier) return 1;
	}

	if (a.length !== b.length) {
		return a.length < b.length ? -1 : 1;
	}

	return 0;
});
