import { CyclicDependencyError, computeTransitiveClosure, detectCycles, topologicalSort } from "@beep/repo-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, HashMap, HashSet } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

/**
 * Helper to build an adjacency list from a record for readability.
 */
const makeAdj = (entries: Record<string, ReadonlyArray<string>>): HashMap.HashMap<string, HashSet.HashSet<string>> => {
  let map = HashMap.empty<string, HashSet.HashSet<string>>();
  for (const [key, deps] of R.toEntries(entries)) {
    map = HashMap.set(map, key, HashSet.fromIterable(deps));
  }
  return map;
};

const indexOfOrThrow = (values: ReadonlyArray<string>, value: string): number =>
  O.getOrThrowWith(A.indexOf(values, value), () => new Error(`Missing expected value: ${value}`));

const isCyclicDependencyError = S.is(CyclicDependencyError);

// ---------------------------------------------------------------------------
// topologicalSort
// ---------------------------------------------------------------------------

describe("topologicalSort", () => {
  it.effect(
    "should sort a simple linear DAG (A -> B -> C)",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B"],
        B: ["C"],
        C: [],
      });
      const order = yield* topologicalSort(adj);

      // C must come before B, B before A
      const idxC = indexOfOrThrow(order, "C");
      const idxB = indexOfOrThrow(order, "B");
      const idxA = indexOfOrThrow(order, "A");

      expect(idxC).toBeLessThan(idxB);
      expect(idxB).toBeLessThan(idxA);
      expect(order).toHaveLength(3);
    })
  );

  it.effect(
    "should sort a diamond dependency (A -> B,C; B,C -> D)",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B", "C"],
        B: ["D"],
        C: ["D"],
        D: [],
      });
      const order = yield* topologicalSort(adj);

      const idxD = indexOfOrThrow(order, "D");
      const idxB = indexOfOrThrow(order, "B");
      const idxC = indexOfOrThrow(order, "C");
      const idxA = indexOfOrThrow(order, "A");

      // D must come before B and C, and B and C before A
      expect(idxD).toBeLessThan(idxB);
      expect(idxD).toBeLessThan(idxC);
      expect(idxB).toBeLessThan(idxA);
      expect(idxC).toBeLessThan(idxA);
      expect(order).toHaveLength(4);
    })
  );

  it.effect(
    "should fail with CyclicDependencyError for a cycle (A -> B -> C -> A)",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B"],
        B: ["C"],
        C: ["A"],
      });
      const result = yield* topologicalSort(adj).pipe(
        Effect.catchTag("CyclicDependencyError", (e) => Effect.succeed(e))
      );

      expect(isCyclicDependencyError(result)).toBe(true);
      if (isCyclicDependencyError(result)) {
        expect(result.cycles.length).toBeGreaterThan(0);
        expect(result.message).toContain("Cyclic dependencies detected");
      }
    })
  );

  it.effect(
    "should fail with CyclicDependencyError for a self-cycle (A -> A)",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["A"],
      });
      const result = yield* topologicalSort(adj).pipe(
        Effect.catchTag("CyclicDependencyError", (e) => Effect.succeed(e))
      );

      expect(isCyclicDependencyError(result)).toBe(true);
      if (isCyclicDependencyError(result)) {
        expect(result.cycles.length).toBeGreaterThan(0);
      }
    })
  );

  it.effect(
    "should handle a disconnected graph",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B"],
        B: [],
        C: ["D"],
        D: [],
      });
      const order = yield* topologicalSort(adj);

      expect(order).toHaveLength(4);
      // B before A
      expect(indexOfOrThrow(order, "B")).toBeLessThan(indexOfOrThrow(order, "A"));
      // D before C
      expect(indexOfOrThrow(order, "D")).toBeLessThan(indexOfOrThrow(order, "C"));
    })
  );

  it.effect(
    "should handle an empty graph",
    Effect.fn(function* () {
      const adj = HashMap.empty<string, HashSet.HashSet<string>>();
      const order = yield* topologicalSort(adj);
      expect(order).toEqual([]);
    })
  );

  it.effect(
    "should handle a single node with no dependencies",
    Effect.fn(function* () {
      const adj = makeAdj({ A: [] });
      const order = yield* topologicalSort(adj);
      expect(order).toEqual(["A"]);
    })
  );
});

// ---------------------------------------------------------------------------
// detectCycles
// ---------------------------------------------------------------------------

describe("detectCycles", () => {
  it.effect(
    "should return empty array for acyclic graph",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B"],
        B: ["C"],
        C: [],
      });
      const cycles = yield* detectCycles(adj);
      expect(cycles).toEqual([]);
    })
  );

  it.effect(
    "should detect a simple cycle (A -> B -> C -> A)",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B"],
        B: ["C"],
        C: ["A"],
      });
      const cycles = yield* detectCycles(adj);
      expect(cycles.length).toBeGreaterThan(0);

      // The cycle should contain A, B, C and loop back
      const cycle = cycles[0];
      expect(cycle[0]).toBe(cycle[cycle.length - 1]); // Should loop back
      expect(cycle.length).toBeGreaterThanOrEqual(3); // At least 3 distinct + repeat
    })
  );

  it.effect(
    "should detect a self-cycle (A -> A)",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["A"],
      });
      const cycles = yield* detectCycles(adj);
      expect(cycles.length).toBe(1);
      expect(cycles[0]).toEqual(["A", "A"]);
    })
  );

  it.effect(
    "should return empty for empty graph",
    Effect.fn(function* () {
      const adj = HashMap.empty<string, HashSet.HashSet<string>>();
      const cycles = yield* detectCycles(adj);
      expect(cycles).toEqual([]);
    })
  );

  it.effect(
    "should return empty for disconnected acyclic graph",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B"],
        B: [],
        C: ["D"],
        D: [],
      });
      const cycles = yield* detectCycles(adj);
      expect(cycles).toEqual([]);
    })
  );

  it.effect(
    "should detect multiple independent cycles",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B"],
        B: ["A"],
        C: ["D"],
        D: ["C"],
      });
      const cycles = yield* detectCycles(adj);
      expect(cycles.length).toBe(2);
    })
  );
});

// ---------------------------------------------------------------------------
// computeTransitiveClosure
// ---------------------------------------------------------------------------

describe("computeTransitiveClosure", () => {
  it.effect(
    "should compute direct + indirect deps for linear chain",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B"],
        B: ["C"],
        C: [],
      });
      const deps = yield* computeTransitiveClosure(adj, "A");
      expect(HashSet.size(deps)).toBe(2);
      expect(HashSet.has(deps, "B")).toBe(true);
      expect(HashSet.has(deps, "C")).toBe(true);
    })
  );

  it.effect(
    "should compute transitive closure for diamond dependency",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B", "C"],
        B: ["D"],
        C: ["D"],
        D: [],
      });
      const deps = yield* computeTransitiveClosure(adj, "A");
      expect(HashSet.size(deps)).toBe(3);
      expect(HashSet.has(deps, "B")).toBe(true);
      expect(HashSet.has(deps, "C")).toBe(true);
      expect(HashSet.has(deps, "D")).toBe(true);
    })
  );

  it.effect(
    "should return empty set for leaf node",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B"],
        B: [],
      });
      const deps = yield* computeTransitiveClosure(adj, "B");
      expect(HashSet.size(deps)).toBe(0);
    })
  );

  it.effect(
    "should return empty set for unknown package",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B"],
        B: [],
      });
      const deps = yield* computeTransitiveClosure(adj, "Z");
      expect(HashSet.size(deps)).toBe(0);
    })
  );

  it.effect(
    "should return empty set for empty graph",
    Effect.fn(function* () {
      const adj = HashMap.empty<string, HashSet.HashSet<string>>();
      const deps = yield* computeTransitiveClosure(adj, "A");
      expect(HashSet.size(deps)).toBe(0);
    })
  );

  it.effect(
    "should handle disconnected components (no cross-deps)",
    Effect.fn(function* () {
      const adj = makeAdj({
        A: ["B"],
        B: [],
        C: ["D"],
        D: [],
      });
      const depsA = yield* computeTransitiveClosure(adj, "A");
      expect(HashSet.size(depsA)).toBe(1);
      expect(HashSet.has(depsA, "B")).toBe(true);
      // C and D should NOT be reachable from A
      expect(HashSet.has(depsA, "C")).toBe(false);
      expect(HashSet.has(depsA, "D")).toBe(false);
    })
  );

  it.effect(
    "should handle single node with no dependencies",
    Effect.fn(function* () {
      const adj = makeAdj({ A: [] });
      const deps = yield* computeTransitiveClosure(adj, "A");
      expect(HashSet.size(deps)).toBe(0);
    })
  );
});
