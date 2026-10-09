// Shared comparison primitives over structural version parts.
//
// Every module in the package compares versions through these functions, so
// SemVer 2.0.0 precedence rules live exactly once. Operating on structural
// parts (not the `SemVer` class) keeps this module import-cycle-free: the
// grammar, desugar and normalize pipeline and the `SemVer` class itself all
// consume it.

import * as Arr from "effect/Array";
import { dual } from "effect/Function";

/** Structural fields of a parsed version, shared by the parser pipeline. */
export interface VersionParts {
	readonly major: number;
	readonly minor: number;
	readonly patch: number;
	readonly prerelease: ReadonlyArray<string | number>;
	readonly build: ReadonlyArray<string>;
}

/** The relational operator prefix of a comparator (`=`, `>`, `>=`, `<`, `<=`). */
export type ComparatorOperator = "=" | ">" | ">=" | "<" | "<=";

/** Structural fields of a parsed comparator. */
export interface ComparatorParts {
	readonly operator: ComparatorOperator;
	readonly version: VersionParts;
}

/**
 * Compare two prerelease identifiers per SemVer 2.0.0 §11: numeric
 * identifiers always have lower precedence than alphanumeric ones; numerics
 * compare numerically, alphanumerics lexically.
 */
export const comparePrereleaseIdentifier: {
	(b: string | number): (a: string | number) => number;
	(a: string | number, b: string | number): number;
} = dual(2, (a: string | number, b: string | number): number => {
	if (typeof a === "number" && typeof b === "number") return a - b;
	if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
	if (typeof a === "number") return -1;
	return 1;
});

/**
 * Compare two versions per SemVer 2.0.0 precedence (§11). Build metadata is
 * ignored (§10).
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
		const cmp = comparePrereleaseIdentifier(Arr.getUnsafe(aPre, i), Arr.getUnsafe(bPre, i));
		if (cmp !== 0) return cmp < 0 ? -1 : 1;
	}

	if (aPre.length !== bPre.length) return aPre.length > bPre.length ? 1 : -1;
	return 0;
});

/**
 * Compare build metadata lexically, identifier by identifier. Versions
 * without build metadata sort before versions with it. This is a total-order
 * tiebreaker outside the SemVer spec (which ignores build metadata), used
 * only by `SemVer.OrderWithBuild`.
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
		const aIdentifier = Arr.getUnsafe(a, i);
		const bIdentifier = Arr.getUnsafe(b, i);
		if (aIdentifier < bIdentifier) return -1;
		if (aIdentifier > bIdentifier) return 1;
	}

	if (a.length !== b.length) {
		return a.length < b.length ? -1 : 1;
	}

	return 0;
});
