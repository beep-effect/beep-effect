import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import { compareParts } from "./order.ts";
import type { ComparatorOperator, ComparatorParts } from "./order.ts";

type ComparatorShape = typeof ComparatorParts.Encoded;

const operatorWeight = Match.type<ComparatorOperator>().pipe(
  Match.when(">=", () => 0),
  Match.when(">", () => 1),
  Match.when("=", () => 2),
  Match.when("<", () => 3),
  Match.when("<=", () => 4),
  Match.exhaustive
);

const comparatorOrder = Order.make<ComparatorShape>((a, b) => {
  const weight = Order.Number(operatorWeight(a.operator), operatorWeight(b.operator));
  return weight !== 0 ? weight : compareParts(a.version, b.version);
});

const sortComparators = (set: ReadonlyArray<ComparatorShape>): ReadonlyArray<ComparatorShape> =>
  A.sort(set, comparatorOrder);

const removeDuplicates = (set: ReadonlyArray<ComparatorShape>): ReadonlyArray<ComparatorShape> => {
  const seen = MutableHashSet.empty<string>();
  return A.filter(set, (c) => {
    const v = c.version;
    const pre = v.prerelease.length > 0 ? `-${pipe(v.prerelease, A.map(String), A.join("."))}` : "";
    const keyIgnoringBuild = `${c.operator}${v.major}.${v.minor}.${v.patch}${pre}`;
    if (MutableHashSet.has(seen, keyIgnoringBuild)) return false;
    MutableHashSet.add(seen, keyIgnoringBuild);
    return true;
  });
};

const normalizeComparatorSet = (set: ReadonlyArray<ComparatorShape>): ReadonlyArray<ComparatorShape> =>
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
 * import { normalizeSets } from "@beep/semver/internal/normalize"
 * import { formatRange, parseRange } from "@beep/semver/internal/grammar"
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
  sets: ReadonlyArray<ReadonlyArray<ComparatorShape>>
): ReadonlyArray<ReadonlyArray<ComparatorShape>> => A.map(sets, normalizeComparatorSet);
