/**
 * Comparator-set normalization: a stable sort by operator weight and version
 * precedence, plus semantic deduplication. Comparators that differ only in
 * build metadata are duplicate constraints (SemVer §10) and collapse to one.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { ComparatorParts } from "./order.ts";
import { compareParts } from "./order.ts";

const operatorWeight = (op: string): number => {
	switch (op) {
		case ">=":
			return 0;
		case ">":
			return 1;
		case "=":
			return 2;
		case "<":
			return 3;
		case "<=":
			return 4;
		default:
			return 5;
	}
};

const sortComparators = (set: ReadonlyArray<ComparatorParts>): ReadonlyArray<ComparatorParts> =>
	[...set].sort((a, b) => {
		const w = operatorWeight(a.operator) - operatorWeight(b.operator);
		if (w !== 0) return w;
		return compareParts(a.version, b.version);
	});

const removeDuplicates = (set: ReadonlyArray<ComparatorParts>): ReadonlyArray<ComparatorParts> => {
	const seen = new Set<string>();
	return set.filter((c) => {
		const v = c.version;
		const pre = v.prerelease.length > 0 ? `-${v.prerelease.join(".")}` : "";
		// Build metadata is ignored per SemVer §10 — comparators differing
		// only in build metadata are semantically identical constraints.
		const key = `${c.operator}${v.major}.${v.minor}.${v.patch}${pre}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const normalizeComparatorSet = (set: ReadonlyArray<ComparatorParts>): ReadonlyArray<ComparatorParts> =>
	sortComparators(removeDuplicates(set));

/**
 * Normalize every comparator set in a range: sort and deduplicate each
 * independently.
 *
 * **Details**
 *
 * Each set is sorted on its own by operator weight (`>=`, `>`, `=`, `<`,
 * `<=`) then SemVer precedence. Sets are never merged or reordered relative
 * to each other.
 *
 * **Gotchas**
 *
 * Dedup keys ignore build metadata (§10). `>=1.0.0+build` and `>=1.0.0`
 * collapse to whichever comparator appeared first; the printer can therefore
 * drop `+build` or keep it depending on input order. That is not a format
 * bug.
 *
 * **Example** (Collapse build-only duplicates and sort by operator)
 *
 * ```ts
 * import { normalizeSets } from "../../semver/internal/normalize.ts";
 *
 * const sets = normalizeSets([
 *   [
 *     {
 *       operator: "<",
 *       version: { major: 2, minor: 0, patch: 0, prerelease: [0], build: [] },
 *     },
 *     {
 *       operator: ">=",
 *       version: { major: 1, minor: 0, patch: 0, prerelease: [], build: ["build"] },
 *     },
 *     {
 *       operator: ">=",
 *       version: { major: 1, minor: 0, patch: 0, prerelease: [], build: [] },
 *     },
 *   ],
 * ]);
 *
 * console.log(sets[0]?.map((c) => c.operator));
 * // => [">=", "<"]
 * console.log(sets[0]?.length);
 * // => 2
 * ```
 *
 * @see {@link compareParts} for the version precedence used as the sort's secondary key.
 * @category normalization
 * @since 0.0.0
 */
export const normalizeSets = (
	sets: ReadonlyArray<ReadonlyArray<ComparatorParts>>,
): ReadonlyArray<ReadonlyArray<ComparatorParts>> => sets.map(normalizeComparatorSet);
