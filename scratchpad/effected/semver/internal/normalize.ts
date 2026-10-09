// Comparator-set normalization: a stable sort by operator weight and version
// precedence, plus semantic deduplication. Comparators that differ only in
// build metadata are duplicate constraints (SemVer §10) and collapse to one.

import * as A from "effect/Array";
import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import type { ComparatorOperator, ComparatorParts } from "./order.ts";
import { compareParts } from "./order.ts";

const operatorWeight = Match.type<ComparatorOperator>().pipe(
	Match.when(">=", () => 0),
	Match.when(">", () => 1),
	Match.when("=", () => 2),
	Match.when("<", () => 3),
	Match.when("<=", () => 4),
	Match.exhaustive,
);

const comparatorOrder = Order.make<ComparatorParts>((a, b) => {
	const weight = Order.Number(operatorWeight(a.operator), operatorWeight(b.operator));
	return weight !== 0 ? weight : compareParts(a.version, b.version);
});

const sortComparators = (set: ReadonlyArray<ComparatorParts>): ReadonlyArray<ComparatorParts> =>
	A.sort(set, comparatorOrder);

const removeDuplicates = (set: ReadonlyArray<ComparatorParts>): ReadonlyArray<ComparatorParts> => {
	const seen = MutableHashSet.empty<string>();
	return set.filter((c) => {
		const v = c.version;
		const pre = v.prerelease.length > 0 ? `-${v.prerelease.join(".")}` : "";
		// Build metadata is ignored per SemVer §10 — comparators differing
		// only in build metadata are semantically identical constraints.
		const key = `${c.operator}${v.major}.${v.minor}.${v.patch}${pre}`;
		if (MutableHashSet.has(seen, key)) return false;
		MutableHashSet.add(seen, key);
		return true;
	});
};

const normalizeComparatorSet = (set: ReadonlyArray<ComparatorParts>): ReadonlyArray<ComparatorParts> =>
	sortComparators(removeDuplicates(set));

/**
 * Normalizes every comparator set in a range: sort and deduplicate each independently.
 *
 * **Details**
 *
 * Sorting is stable: operator weights order `>=`, `>`, `=`, `<`, then `<=`, with version precedence breaking ties. Comparators that differ only in build metadata are duplicate constraints (SemVer §10); the first occurrence survives. Sets are neither merged nor deduplicated against one another.
 *
 * **Example** (Deduplicate constraints across build metadata)
 *
 * ```ts
 * import { normalizeSets } from "@beep/scratchpad/effected/semver/internal/normalize"
 * import { formatRange, parseRange } from "@beep/scratchpad/effected/semver/internal/grammar"
 *
 * const parsed = parseRange("<2.0.0 >=1.2.3+first >=1.2.3+second")
 * if (parsed.ok) {
 *   console.log(formatRange(normalizeSets(parsed.value))) // >=1.2.3+first <2.0.0
 * }
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeSets = (
	sets: ReadonlyArray<ReadonlyArray<ComparatorParts>>,
): ReadonlyArray<ReadonlyArray<ComparatorParts>> => sets.map(normalizeComparatorSet);
