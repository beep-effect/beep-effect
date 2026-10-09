// Comparator-set normalization: a stable sort by operator weight and version
// precedence, plus semantic deduplication. Comparators that differ only in
// build metadata are duplicate constraints (SemVer §10) and collapse to one.

import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";
import type { ComparatorParts } from "./order.ts";
import { compareParts } from "./order.ts";

const operatorWeight = Match.type<string>().pipe(
	Match.when(">=", () => 0),
	Match.when(">", () => 1),
	Match.when("=", () => 2),
	Match.when("<", () => 3),
	Match.when("<=", () => 4),
	Match.orElse(() => 5),
);

const sortComparators = (set: ReadonlyArray<ComparatorParts>): ReadonlyArray<ComparatorParts> =>
	[...set].sort((a, b) => {
		const w = operatorWeight(a.operator) - operatorWeight(b.operator);
		if (w !== 0) return w;
		return compareParts(a.version, b.version);
	});

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

/** Normalize every comparator set in a range: sort and deduplicate each independently. */
export const normalizeSets = (
	sets: ReadonlyArray<ReadonlyArray<ComparatorParts>>,
): ReadonlyArray<ReadonlyArray<ComparatorParts>> => sets.map(normalizeComparatorSet);
