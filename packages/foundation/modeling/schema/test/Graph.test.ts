import { fcRuns } from "@beep/fc-runs";
import * as GraphSchema from "@beep/schema/Graph";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as Graph_ from "effect/Graph";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const NodeIndexArbitrary = S.toArbitrary(GraphSchema.NodeIndex);
const EdgeIndexArbitrary = S.toArbitrary(GraphSchema.EdgeIndex);
const GraphKindArbitrary = S.toArbitrary(GraphSchema.GraphKind);

describe("Graph indices", () => {
  it("brands non-negative integer node and edge indices", () => {
    expect(S.decodeUnknownSync(GraphSchema.NodeIndex)(0)).toBe(0);
    expect(S.decodeUnknownSync(GraphSchema.NodeIndexFromString)("2")).toBe(2);
    expect(S.decodeUnknownSync(GraphSchema.EdgeIndex)(1)).toBe(1);
    expect(S.decodeUnknownSync(GraphSchema.EdgeIndexFromString)("3")).toBe(3);
  });

  it("rejects invalid indices", () => {
    expect(() => S.decodeUnknownSync(GraphSchema.NodeIndex)(-1)).toThrow(
      "Expected a value greater than or equal to 0, got -1"
    );
    expect(() => S.decodeUnknownSync(GraphSchema.EdgeIndexFromString)("-1")).toThrow(
      "Expected a value greater than or equal to 0, got -1"
    );
  });

  it("decodes graph kind discriminators", () => {
    expect(S.decodeUnknownSync(GraphSchema.GraphKind)("directed")).toBe("directed");
    expect(S.decodeUnknownSync(GraphSchema.GraphKind)("undirected")).toBe("undirected");
  });

  it("derives valid graph primitives from their source schemas", () => {
    fc.assert(
      fc.property(NodeIndexArbitrary, EdgeIndexArbitrary, GraphKindArbitrary, (nodeIndex, edgeIndex, graphKind) => {
        expect(S.is(GraphSchema.NodeIndex)(nodeIndex)).toBe(true);
        expect(S.is(GraphSchema.EdgeIndex)(edgeIndex)).toBe(true);
        expect(S.is(GraphSchema.GraphKind)(graphKind)).toBe(true);
      }),
      fcRuns(50)
    );
  });
});

describe("Graph edge schemas", () => {
  it("preserves metadata on encoded edge schemas", () => {
    const schema = GraphSchema.EdgeEncoded(S.FiniteFromString);

    expect(schema.data).toBe(S.FiniteFromString);
    expect(schema.annotate({}).data).toBe(S.FiniteFromString);
  });

  it("transforms encoded edges into Graph.Edge instances and back", () => {
    const schema = GraphSchema.EdgeTransform(S.FiniteFromString);
    const decoded = S.decodeUnknownSync(schema)({ source: 0, target: 1, data: "1" });

    expect(GraphSchema.isEdge(decoded)).toBe(true);
    expect(decoded).toBeInstanceOf(Graph_.Edge);
    expect(decoded.source).toBe(0);
    expect(decoded.target).toBe(1);
    expect(decoded.data).toBe(1);
    expect(S.encodeSync(schema)(decoded)).toEqual({ source: 0, target: 1, data: "1" });
  });

  it("exposes Edge as the public edge transform alias", () => {
    const schema = GraphSchema.Edge(S.FiniteFromString);
    const decoded = S.decodeUnknownSync(schema)({ source: 0, target: 1, data: "1" });

    expect(decoded).toBeInstanceOf(Graph_.Edge);
    expect(decoded.data).toBe(1);
  });

  it("validates existing Graph.Edge instances with nested transforms", () => {
    const schema = GraphSchema.EdgeFromSelf(S.FiniteFromString);
    const decoded = S.decodeUnknownSync(schema)(new Graph_.Edge({ source: 0, target: 1, data: "1" }));

    expect(decoded).toBeInstanceOf(Graph_.Edge);
    expect(decoded.data).toBe(1);
    expect(() => S.decodeUnknownSync(schema)(new Graph_.Edge({ source: 0, target: 1, data: null }))).toThrow(
      "Expected string, got null"
    );
  });

  it("rejects non-edge values and derives edge equivalence", () => {
    const schema = GraphSchema.EdgeFromSelf(S.String);
    const equivalent = S.toEquivalence(schema);
    const edge = new Graph_.Edge({ source: 0, target: 1, data: "x" });

    expect(() => S.decodeUnknownSync(schema)({ source: 0, target: 1, data: "x" })).toThrow();
    expect(equivalent(edge, new Graph_.Edge({ source: 0, target: 1, data: "x" }))).toBe(true);
    expect(equivalent(edge, new Graph_.Edge({ source: 1, target: 1, data: "x" }))).toBe(false);
    expect(equivalent(edge, new Graph_.Edge({ source: 0, target: 2, data: "x" }))).toBe(false);
    expect(equivalent(edge, new Graph_.Edge({ source: 0, target: 1, data: "y" }))).toBe(false);
  });
});

describe("Graph encoded schemas", () => {
  it("preserves metadata on encoded graph schemas", () => {
    const schema = GraphSchema.GraphEncoded(S.String, S.FiniteFromString);

    expect(schema.node).toBe(S.String);
    expect(schema.edge).toBe(S.FiniteFromString);
    expect(schema.annotate({}).node).toBe(S.String);
    expect(schema.annotate({}).edge).toBe(S.FiniteFromString);
  });
});

describe("DirectedGraph", () => {
  it("decodes encoded payloads into immutable directed graphs and sorts nodes by index", () => {
    const schema = GraphSchema.DirectedGraph({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const decoded = S.decodeUnknownSync(schema)({
      _tag: "Graph",
      type: "directed",
      nodes: [
        [1, "2"],
        [0, "1"],
      ],
      edges: [{ index: 0, source: 0, target: 1, data: "a" }],
    });

    expect(schema.node).toBe(S.FiniteFromString);
    expect(schema.edge).toBe(S.String);
    expect(GraphSchema.isGraph(decoded)).toBe(true);
    expect(decoded.type).toBe("directed");
    expect(decoded.mutable).toBe(false);
    expect(A.fromIterable(Graph_.entries(Graph_.nodes(decoded)))).toEqual([
      [0, 1],
      [1, 2],
    ]);
    expect(A.fromIterable(Graph_.entries(Graph_.edges(decoded)))).toEqual([
      [0, new Graph_.Edge({ source: 0, target: 1, data: "a" })],
    ]);
  });

  it("encodes immutable directed graphs back to the wire shape", () => {
    const schema = GraphSchema.DirectedGraph({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const graph = Graph_.directed<number, string>((mutable) => {
      const a = Graph_.addNode(mutable, 1);
      const b = Graph_.addNode(mutable, 2);
      Graph_.addEdge(mutable, a, b, "a");
    });

    expect(S.encodeSync(schema)(graph)).toEqual({
      _tag: "Graph",
      type: "directed",
      nodes: [
        [0, "1"],
        [1, "2"],
      ],
      edges: [{ index: 0, source: 0, target: 1, data: "a" }],
    });
  });

  it("rejects the wrong graph kind and malformed topology", () => {
    const schema = GraphSchema.DirectedGraph({
      node: S.String,
      edge: S.String,
    });

    expect(() =>
      S.decodeUnknownSync(schema)({
        _tag: "Graph",
        type: "undirected",
        nodes: [],
        edges: [],
      })
    ).toThrow("Expected directed graph, got undirected");

    expect(() =>
      S.decodeUnknownSync(schema)({
        _tag: "Graph",
        type: "directed",
        nodes: [[0, "a"]],
        edges: [{ index: 0, source: 0, target: 1, data: "x" }],
      })
    ).toThrow("Node 1 does not exist");

    expect(() =>
      S.decodeUnknownSync(schema)({
        _tag: "Graph",
        type: "directed",
        nodes: [[1, "a"]],
        edges: [],
      })
    ).toThrow("Expected node index 1, got 0");

    expect(() =>
      S.decodeUnknownSync(schema)({
        _tag: "Graph",
        type: "directed",
        nodes: [
          [0, "a"],
          [1, "b"],
        ],
        edges: [{ index: 1, source: 0, target: 1, data: "x" }],
      })
    ).toThrow("Expected edge index 1, got 0");
  });
});

describe("UndirectedGraph", () => {
  it("decodes encoded payloads into immutable undirected graphs", () => {
    const schema = GraphSchema.UndirectedGraph({
      node: S.String,
      edge: S.FiniteFromString,
    });
    const decoded = S.decodeUnknownSync(schema)({
      _tag: "Graph",
      type: "undirected",
      nodes: [
        [0, "a"],
        [1, "b"],
      ],
      edges: [{ index: 0, source: 0, target: 1, data: "1" }],
    });

    expect(decoded.type).toBe("undirected");
    expect(decoded.mutable).toBe(false);
    expect(A.fromIterable(Graph_.entries(Graph_.edges(decoded)))).toEqual([
      [0, new Graph_.Edge({ source: 0, target: 1, data: 1 })],
    ]);
  });

  it("validates existing immutable undirected graphs with nested transforms", () => {
    const schema = GraphSchema.UndirectedGraphFromSelf({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const graph = Graph_.undirected<string, string>((mutable) => {
      const a = Graph_.addNode(mutable, "1");
      const b = Graph_.addNode(mutable, "2");
      Graph_.addEdge(mutable, a, b, "x");
    });

    const decoded = S.decodeUnknownSync(schema)(graph);

    expect(decoded.type).toBe("undirected");
    expect(decoded.mutable).toBe(false);
    expect(A.fromIterable(Graph_.entries(Graph_.nodes(decoded)))).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });
});

describe("Graph FromSelf schemas", () => {
  it("validates existing immutable directed graphs with nested transforms", () => {
    const schema = GraphSchema.DirectedGraphFromSelf({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const graph = Graph_.directed<string, string>((mutable) => {
      const a = Graph_.addNode(mutable, "1");
      const b = Graph_.addNode(mutable, "2");
      Graph_.addEdge(mutable, a, b, "x");
    });
    const decoded = S.decodeUnknownSync(schema)(graph);

    expect(decoded.type).toBe("directed");
    expect(decoded.mutable).toBe(false);
    expect(A.fromIterable(Graph_.entries(Graph_.nodes(decoded)))).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });

  it("reports nested node decode failures on existing graphs", () => {
    const schema = GraphSchema.DirectedGraphFromSelf({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const graph = Graph_.directed<string | null, string>((mutable) => {
      const a = Graph_.addNode(mutable, "1");
      const b = Graph_.addNode(mutable, null);
      Graph_.addEdge(mutable, a, b, "x");
    });

    expect(() => S.decodeUnknownSync(schema)(graph)).toThrow(`Expected string, got null
  at ["nodes"][1][1]`);
  });

  it("rejects mutable graphs when the schema expects immutable ones", () => {
    const schema = GraphSchema.GraphFromSelf({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const graph = Graph_.beginMutation(
      Graph_.directed<string, string>((mutable) => {
        const a = Graph_.addNode(mutable, "1");
        const b = Graph_.addNode(mutable, "2");
        Graph_.addEdge(mutable, a, b, "x");
      })
    );

    expect(() => S.decodeUnknownSync(schema)(graph)).toThrow(
      "Expected @beep/schema/Graph/GraphFromSelf, got Graph(directed, 2, 1)"
    );
  });

  it("validates existing mutable directed graphs and preserves mutability", () => {
    const schema = GraphSchema.MutableDirectedGraphFromSelf({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const graph = Graph_.beginMutation(Graph_.directed<string, string>());
    const a = Graph_.addNode(graph, "1");
    const b = Graph_.addNode(graph, "2");
    Graph_.addEdge(graph, a, b, "x");

    const decoded = S.decodeUnknownSync(schema)(graph);

    expect(decoded.type).toBe("directed");
    expect(decoded.mutable).toBe(true);
    expect(A.fromIterable(Graph_.entries(Graph_.nodes(decoded)))).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });

  it("validates generic and undirected mutable graphs", () => {
    const genericSchema = GraphSchema.MutableGraphFromSelf({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const undirectedSchema = GraphSchema.MutableUndirectedGraphFromSelf({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const directedSchema = GraphSchema.MutableDirectedGraphFromSelf({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const graph = Graph_.beginMutation(Graph_.undirected<string, string>());
    const a = Graph_.addNode(graph, "1");
    const b = Graph_.addNode(graph, "2");
    Graph_.addEdge(graph, a, b, "x");

    const generic = S.decodeUnknownSync(genericSchema)(graph);
    const undirected = S.decodeUnknownSync(undirectedSchema)(graph);

    expect(generic.type).toBe("undirected");
    expect(generic.mutable).toBe(true);
    expect(undirected.type).toBe("undirected");
    expect(undirected.mutable).toBe(true);
    expect(() => S.decodeUnknownSync(directedSchema)(graph)).toThrow();
  });
});

describe("MutableDirectedGraph", () => {
  it("decodes encoded payloads into mutable directed graphs", () => {
    const schema = GraphSchema.MutableDirectedGraph({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const decoded = S.decodeUnknownSync(schema)({
      _tag: "Graph",
      type: "directed",
      nodes: [
        [0, "1"],
        [1, "2"],
      ],
      edges: [{ index: 0, source: 0, target: 1, data: "a" }],
    });

    expect(decoded.type).toBe("directed");
    expect(decoded.mutable).toBe(true);
    expect(S.encodeSync(schema)(decoded)).toEqual({
      _tag: "Graph",
      type: "directed",
      nodes: [
        [0, "1"],
        [1, "2"],
      ],
      edges: [{ index: 0, source: 0, target: 1, data: "a" }],
    });
  });
});

describe("MutableUndirectedGraph", () => {
  it("decodes encoded payloads into mutable undirected graphs", () => {
    const schema = GraphSchema.MutableUndirectedGraph({
      node: S.FiniteFromString,
      edge: S.String,
    });
    const decoded = S.decodeUnknownSync(schema)({
      _tag: "Graph",
      type: "undirected",
      nodes: [
        [0, "1"],
        [1, "2"],
      ],
      edges: [{ index: 0, source: 0, target: 1, data: "a" }],
    });

    expect(decoded.type).toBe("undirected");
    expect(decoded.mutable).toBe(true);
    expect(S.encodeSync(schema)(decoded)).toEqual({
      _tag: "Graph",
      type: "undirected",
      nodes: [
        [0, "1"],
        [1, "2"],
      ],
      edges: [{ index: 0, source: 0, target: 1, data: "a" }],
    });
  });
});

describe("Graph formatting and equivalence", () => {
  it("derives formatter and equivalence instances", () => {
    const schema = GraphSchema.DirectedGraphFromSelf({
      node: S.Finite,
      edge: S.String,
    });
    const graphA = Graph_.directed<number, string>((mutable) => {
      const a = Graph_.addNode(mutable, 1);
      const b = Graph_.addNode(mutable, 2);
      Graph_.addEdge(mutable, a, b, "x");
    });
    const graphB = Graph_.directed<number, string>((mutable) => {
      const a = Graph_.addNode(mutable, 1);
      const b = Graph_.addNode(mutable, 2);
      Graph_.addEdge(mutable, a, b, "x");
    });

    expect(S.toFormatter(schema)(graphA)).toBe(
      `Graph.directed({ nodes: [[0, 1], [1, 2]], edges: [[0, Edge(0, 1, "x")]] })`
    );
    expect(S.toEquivalence(schema)(graphA, graphB)).toBe(true);
  });

  it("detects graph equivalence differences", () => {
    const schema = GraphSchema.GraphFromSelf({
      node: S.Finite,
      edge: S.String,
    });
    const equivalent = S.toEquivalence(schema);
    const graph = Graph_.directed<number, string>((mutable) => {
      const a = Graph_.addNode(mutable, 1);
      const b = Graph_.addNode(mutable, 2);
      Graph_.addEdge(mutable, a, b, "x");
    });
    const undirected = Graph_.undirected<number, string>((mutable) => {
      const a = Graph_.addNode(mutable, 1);
      const b = Graph_.addNode(mutable, 2);
      Graph_.addEdge(mutable, a, b, "x");
    });
    const extraNode = Graph_.directed<number, string>((mutable) => {
      const a = Graph_.addNode(mutable, 1);
      const b = Graph_.addNode(mutable, 2);
      Graph_.addNode(mutable, 3);
      Graph_.addEdge(mutable, a, b, "x");
    });
    const differentNode = Graph_.directed<number, string>((mutable) => {
      const a = Graph_.addNode(mutable, 1);
      const b = Graph_.addNode(mutable, 3);
      Graph_.addEdge(mutable, a, b, "x");
    });
    const differentEdgeTarget = Graph_.directed<number, string>((mutable) => {
      const a = Graph_.addNode(mutable, 1);
      const b = Graph_.addNode(mutable, 2);
      Graph_.addEdge(mutable, b, a, "x");
    });
    const differentEdgeData = Graph_.directed<number, string>((mutable) => {
      const a = Graph_.addNode(mutable, 1);
      const b = Graph_.addNode(mutable, 2);
      Graph_.addEdge(mutable, a, b, "y");
    });

    expect(equivalent(graph, undirected)).toBe(false);
    expect(equivalent(graph, extraNode)).toBe(false);
    expect(equivalent(graph, differentNode)).toBe(false);
    expect(equivalent(graph, differentEdgeTarget)).toBe(false);
    expect(equivalent(graph, differentEdgeData)).toBe(false);
  });
});
