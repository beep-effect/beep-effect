/**
 * Proofs for the generic GraphOps: functor laws (identity/composition) for
 * mapNodes, the bifunctor bimap, filtering, folds, indexed search including
 * union/intersection, effectful traversal and
 * mapNodesEffect, streaming/batching, and structural merge.
 *
 * Effect v4 + `@effect/vitest` coverage for GraphOps tests.
 * Graphs are built over plain `string` nodes / `number` edges so the laws are
 * checked without coupling to NLP schemas.
 */

import * as GraphOps from "@beep/nlp/Graph/GraphOps";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Graph from "effect/Graph";
import * as Stream from "effect/Stream";

// build: a -> b, a -> c, b -> d
const sample = (): GraphOps.DirectedGraph<string, number> =>
  Graph.directed<string, number>((mutable) => {
    const a = Graph.addNode(mutable, "a");
    const b = Graph.addNode(mutable, "b");
    const c = Graph.addNode(mutable, "c");
    const d = Graph.addNode(mutable, "d");
    Graph.addEdge(mutable, a, b, 1);
    Graph.addEdge(mutable, a, c, 2);
    Graph.addEdge(mutable, b, d, 3);
  });

describe("GraphOps functor laws", () => {
  it("mapNodes preserves identity (map(id) = id)", () => {
    const g = sample();
    const mapped = GraphOps.mapNodes(g, (n) => n);
    expect(GraphOps.nodeCount(mapped)).toBe(GraphOps.nodeCount(g));
    expect(GraphOps.edgeCount(mapped)).toBe(GraphOps.edgeCount(g));
    expect([...GraphOps.collectNodes(mapped)].sort()).toEqual([...GraphOps.collectNodes(g)].sort());
  });

  it("mapNodes respects composition (map(f∘g) = map(f)∘map(g))", () => {
    const g = sample();
    const f = (s: string): string => s.toUpperCase();
    const h = (s: string): string => `${s}!`;
    const composed = GraphOps.mapNodes(g, (s) => h(f(s)));
    const sequential = GraphOps.mapNodes(GraphOps.mapNodes(g, f), h);
    expect([...GraphOps.collectNodes(composed)].sort()).toEqual([...GraphOps.collectNodes(sequential)].sort());
  });

  it("mapNodes can change the node type", () => {
    const g = sample();
    const lengths = GraphOps.mapNodes(g, (s) => s.length);
    expect(GraphOps.nodeCount(lengths)).toBe(4);
    expect(GraphOps.collectNodes(lengths).every((n) => n === 1)).toBe(true);
  });

  it("mapEdges transforms edge data and keeps structure", () => {
    const g = sample();
    const doubled = GraphOps.mapEdges(g, (e) => e * 2);
    expect(GraphOps.edgeCount(doubled)).toBe(3);
    expect(GraphOps.nodeCount(doubled)).toBe(4);
  });

  it("bimap transforms nodes and edges together", () => {
    const g = sample();
    const out = GraphOps.bimap(
      g,
      (n) => n.toUpperCase(),
      (e) => `${e}`
    );
    expect(GraphOps.collectNodes(out).includes("A")).toBe(true);
    expect(GraphOps.edgeCount(out)).toBe(3);
  });
});

describe("GraphOps filtering & folds", () => {
  it("filterNodes drops nodes and their edges", () => {
    const g = sample();
    const noD = GraphOps.filterNodes(g, (n) => n !== "d");
    expect(GraphOps.nodeCount(noD)).toBe(3);
    // the b -> d edge is dropped, leaving a -> b and a -> c
    expect(GraphOps.edgeCount(noD)).toBe(2);
  });

  it("filterEdges drops edges and keeps all nodes", () => {
    const g = sample();
    const heavy = GraphOps.filterEdges(g, (e) => e >= 2);
    expect(GraphOps.nodeCount(heavy)).toBe(4);
    expect(GraphOps.edgeCount(heavy)).toBe(2);
  });

  it("foldNodes aggregates over all nodes", () => {
    const g = sample();
    const total = GraphOps.foldNodes(g, 0, (acc, n) => acc + n.length);
    expect(total).toBe(4);
  });

  it("collectTraversal yields nodes in dfs order from roots", () => {
    const g = sample();
    const order = GraphOps.collectTraversal(g, { start: GraphOps.getRoots(g), order: "dfs" });
    expect(order.length).toBe(4);
    expect(order[0]).toBe("a");
  });
});

describe("GraphOps indexed search", () => {
  it("buildIndex then queryIndex round-trips by key", () => {
    const g = sample();
    const idx = GraphOps.buildIndex(g, (n) => [n.length]);
    // all nodes have length 1
    expect(GraphOps.queryIndex(idx, 1).length).toBe(4);
    expect(GraphOps.queryIndex(idx, 99).length).toBe(0);
  });

  it("queryIndexUnion returns nodes matching any key, deduplicated", () => {
    const g = sample();
    const idx = GraphOps.buildIndex(g, (n) => [n]);
    const union = GraphOps.queryIndexUnion(idx, ["a", "b", "zzz"]);
    expect(union.length).toBe(2);
  });

  it("queryIndexIntersection returns nodes matching all keys", () => {
    const g = sample();
    // two keys per node: its char and its length
    const idx = GraphOps.buildIndex(g, (n) => [n, `len${n.length}`]);
    const both = GraphOps.queryIndexIntersection(idx, ["a", "len1"]);
    expect(both.length).toBe(1);
    const none = GraphOps.queryIndexIntersection(idx, ["a", "b"]);
    expect(none.length).toBe(0);
  });
});

describe("GraphOps effectful operations", () => {
  it.effect(
    "traverseNodesCollect runs an effect per node",
    Effect.fnUntraced(function* () {
      const g = sample();
      const out = yield* GraphOps.traverseNodesCollect(g, { start: GraphOps.getRoots(g), order: "bfs" }, (n) =>
        Effect.succeed(n.toUpperCase())
      );
      expect(out.length).toBe(4);
      expect(out.includes("A")).toBe(true);
    })
  );

  it.effect(
    "mapNodesEffect rebuilds the graph with transformed nodes",
    Effect.fnUntraced(function* () {
      const g = sample();
      const out = yield* GraphOps.mapNodesEffect(g, (n) => Effect.succeed(`${n}${n}`));
      expect(GraphOps.nodeCount(out)).toBe(4);
      expect(GraphOps.edgeCount(out)).toBe(3);
      expect(GraphOps.collectNodes(out).includes("aa")).toBe(true);
    })
  );
});

describe("GraphOps streaming & merge", () => {
  it.effect(
    "streamNodes emits every node",
    Effect.fnUntraced(function* () {
      const g = sample();
      const collected = yield* Stream.runCollect(
        GraphOps.streamNodes(g, { start: GraphOps.getRoots(g), order: "dfs" })
      );
      expect(collected.length).toBe(4);
    })
  );

  it.effect(
    "batchNodes groups nodes into fixed-size batches",
    Effect.fnUntraced(function* () {
      const g = sample();
      const batches = yield* Stream.runCollect(
        GraphOps.batchNodes(g, { start: GraphOps.getRoots(g), order: "dfs", batchSize: 2 })
      );
      expect(batches.length).toBe(2);
    })
  );

  it("merge combines nodes and edges from both graphs", () => {
    const g1 = sample();
    const g2 = GraphOps.singleton<string, number>("z");
    const merged = GraphOps.merge(g1, g2);
    expect(GraphOps.nodeCount(merged)).toBe(5);
    expect(GraphOps.edgeCount(merged)).toBe(3);
    expect(GraphOps.collectNodes(merged).includes("z")).toBe(true);
  });

  it("empty / isEmpty / singleton", () => {
    expect(GraphOps.isEmpty(GraphOps.empty<string, number>())).toBe(true);
    expect(GraphOps.isEmpty(GraphOps.singleton<string, number>("x"))).toBe(false);
    expect(GraphOps.nodeCount(GraphOps.singleton<string, number>("x"))).toBe(1);
  });
});
