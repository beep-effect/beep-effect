import { fcRuns } from "@beep/fc-runs";
import * as GraphSchema from "@beep/schema/Graph";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as Graph_ from "effect/Graph";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeGraphSchemaEdgeIndex = S.decodeUnknownEffect(GraphSchema.EdgeIndex);
const decodeGraphSchemaEdgeIndexFromString = S.decodeUnknownEffect(GraphSchema.EdgeIndexFromString);
const decodeGraphSchemaGraphKind = S.decodeUnknownEffect(GraphSchema.GraphKind);
const decodeGraphSchemaNodeIndex = S.decodeUnknownEffect(GraphSchema.NodeIndex);
const decodeGraphSchemaNodeIndexFromString = S.decodeUnknownEffect(GraphSchema.NodeIndexFromString);
const isGraphSchemaEdgeIndex = S.is(GraphSchema.EdgeIndex);
const isGraphSchemaGraphKind = S.is(GraphSchema.GraphKind);
const isGraphSchemaNodeIndex = S.is(GraphSchema.NodeIndex);

const NodeIndexArbitrary = Arbitrary.schema(GraphSchema.NodeIndex);
const EdgeIndexArbitrary = Arbitrary.schema(GraphSchema.EdgeIndex);
const GraphKindArbitrary = Arbitrary.schema(GraphSchema.GraphKind);

describe("Graph indices", () => {
  it.effect(
    "brands non-negative integer node and edge indices",
    Effect.fnUntraced(function* () {
      expect(yield* decodeGraphSchemaNodeIndex(0)).toBe(0);
      expect(yield* decodeGraphSchemaNodeIndexFromString("2")).toBe(2);
      expect(yield* decodeGraphSchemaEdgeIndex(1)).toBe(1);
      expect(yield* decodeGraphSchemaEdgeIndexFromString("3")).toBe(3);
    })
  );

  it.effect(
    "rejects invalid indices",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeGraphSchemaNodeIndex(-1));
      const isFailure1 = Result.isFailure(failure1);
      assertTrue(isFailure1);
      expect(failure1.failure.message).toContain("Expected a value greater than or equal to 0");
      const failure2 = yield* Effect.result(decodeGraphSchemaEdgeIndexFromString("-1"));
      const isFailure2 = Result.isFailure(failure2);
      assertTrue(isFailure2);
      expect(failure2.failure.message).toContain("Expected a value greater than or equal to 0");
    })
  );

  it.effect(
    "decodes graph kind discriminators",
    Effect.fnUntraced(function* () {
      expect(yield* decodeGraphSchemaGraphKind("directed")).toBe("directed");
      expect(yield* decodeGraphSchemaGraphKind("undirected")).toBe("undirected");
    })
  );

  it.effect.prop(
    "derives valid graph primitives from their source schemas",
    [NodeIndexArbitrary, EdgeIndexArbitrary, GraphKindArbitrary],
    Effect.fnUntraced(function* ([nodeIndex, edgeIndex, graphKind]) {
      expect(isGraphSchemaNodeIndex(nodeIndex)).toBe(true);
      expect(isGraphSchemaEdgeIndex(edgeIndex)).toBe(true);
      expect(isGraphSchemaGraphKind(graphKind)).toBe(true);

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );
});

describe("Graph edge schemas", () => {
  it("preserves metadata on encoded edge schemas", () => {
    const schema = GraphSchema.EdgeEncoded(S.FiniteFromString);

    expect(schema.data).toBe(S.FiniteFromString);
    expect(schema.annotate({}).data).toBe(S.FiniteFromString);
  });

  it.effect(
    "transforms encoded edges into Graph.Edge values and back",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.EdgeTransform(S.FiniteFromString);
      const decoded = yield* S.decodeUnknownEffect(schema)({ source: 0, target: 1, data: "1" });

      expect(GraphSchema.isEdge(decoded)).toBe(true);
      expect(decoded.source).toBe(0);
      expect(decoded.target).toBe(1);
      expect(decoded.data).toBe(1);
      expect(yield* S.encodeEffect(schema)(decoded)).toEqual({ source: 0, target: 1, data: "1" });
    })
  );

  it.effect(
    "exposes Edge as the public edge transform alias",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.Edge(S.FiniteFromString);
      const decoded = yield* S.decodeUnknownEffect(schema)({ source: 0, target: 1, data: "1" });

      expect(GraphSchema.isEdge(decoded)).toBe(true);
      expect(decoded.data).toBe(1);
    })
  );

  it.effect(
    "validates existing Graph.Edge values with nested transforms",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.EdgeFromSelf(S.FiniteFromString);
      const decoded = yield* S.decodeEffect(schema)({ source: 0, target: 1, data: "1" });

      expect(GraphSchema.isEdge(decoded)).toBe(true);
      expect(decoded.data).toBe(1);
      const failure3 = yield* Effect.result(S.decodeUnknownEffect(schema)({ source: 0, target: 1, data: null }));
      const isFailure3 = Result.isFailure(failure3);
      assertTrue(isFailure3);
      expect(failure3.failure.message).toContain("Expected string");
    })
  );

  it.effect(
    "rejects malformed edge values and derives edge equivalence",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.EdgeFromSelf(S.String);
      const equivalent = S.toEquivalence(schema);
      const edge = { source: 0, target: 1, data: "x" };

      const isFailure4 = Result.isFailure(
        yield* Effect.result(S.decodeEffect(schema)({ source: -1, target: 1, data: "x" }))
      );
      assertTrue(isFailure4);
      expect(equivalent(edge, { source: 0, target: 1, data: "x" })).toBe(true);
      expect(equivalent(edge, { source: 1, target: 1, data: "x" })).toBe(false);
      expect(equivalent(edge, { source: 0, target: 2, data: "x" })).toBe(false);
      expect(equivalent(edge, { source: 0, target: 1, data: "y" })).toBe(false);
    })
  );
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
  it.effect(
    "decodes encoded payloads into immutable directed graphs and sorts nodes by index",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.DirectedGraph({
        node: S.FiniteFromString,
        edge: S.String,
      });
      const decoded = yield* S.decodeUnknownEffect(schema)({
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
      expect(A.fromIterable(Graph_.entries(Graph_.edges(decoded)))).toEqual([[0, { source: 0, target: 1, data: "a" }]]);
    })
  );

  it.effect(
    "encodes immutable directed graphs back to the wire shape",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.DirectedGraph({
        node: S.FiniteFromString,
        edge: S.String,
      });
      const graph = Graph_.directed<number, string>((mutable) => {
        const a = Graph_.addNode(mutable, 1);
        const b = Graph_.addNode(mutable, 2);
        Graph_.addEdge(mutable, a, b, "a");
      });

      expect(yield* S.encodeEffect(schema)(graph)).toEqual({
        _tag: "Graph",
        type: "directed",
        nodes: [
          [0, "1"],
          [1, "2"],
        ],
        edges: [{ index: 0, source: 0, target: 1, data: "a" }],
      });
    })
  );

  it.effect(
    "rejects the wrong graph kind and malformed topology",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.DirectedGraph({
        node: S.String,
        edge: S.String,
      });

      const failure4 = yield* Effect.result(
        S.decodeEffect(schema)({
          _tag: "Graph",
          type: "undirected",
          nodes: [],
          edges: [],
        })
      );
      const isFailure5 = Result.isFailure(failure4);
      assertTrue(isFailure5);
      expect(failure4.failure.message).toContain("Expected directed graph, got undirected");

      const failure5 = yield* Effect.result(
        S.decodeUnknownEffect(schema)({
          _tag: "Graph",
          type: "directed",
          nodes: [[0, "a"]],
          edges: [{ index: 0, source: 0, target: 1, data: "x" }],
        })
      );
      const isFailure6 = Result.isFailure(failure5);
      assertTrue(isFailure6);
      expect(failure5.failure.message).toContain("Node 1 does not exist");

      const failure6 = yield* Effect.result(
        S.decodeUnknownEffect(schema)({
          _tag: "Graph",
          type: "directed",
          nodes: [[1, "a"]],
          edges: [],
        })
      );
      const isFailure7 = Result.isFailure(failure6);
      assertTrue(isFailure7);
      expect(failure6.failure.message).toContain("Expected node index 1, got 0");

      const failure7 = yield* Effect.result(
        S.decodeUnknownEffect(schema)({
          _tag: "Graph",
          type: "directed",
          nodes: [
            [0, "a"],
            [1, "b"],
          ],
          edges: [{ index: 1, source: 0, target: 1, data: "x" }],
        })
      );
      const isFailure8 = Result.isFailure(failure7);
      assertTrue(isFailure8);
      expect(failure7.failure.message).toContain("Expected edge index 1, got 0");
    })
  );
});

describe("UndirectedGraph", () => {
  it.effect(
    "decodes encoded payloads into immutable undirected graphs",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.UndirectedGraph({
        node: S.String,
        edge: S.FiniteFromString,
      });
      const decoded = yield* S.decodeUnknownEffect(schema)({
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
      expect(A.fromIterable(Graph_.entries(Graph_.edges(decoded)))).toEqual([[0, { source: 0, target: 1, data: 1 }]]);
    })
  );

  it.effect(
    "validates existing immutable undirected graphs with nested transforms",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.UndirectedGraphFromSelf({
        node: S.FiniteFromString,
        edge: S.String,
      });
      const graph = Graph_.undirected<string, string>((mutable) => {
        const a = Graph_.addNode(mutable, "1");
        const b = Graph_.addNode(mutable, "2");
        Graph_.addEdge(mutable, a, b, "x");
      });

      const decoded = yield* S.decodeEffect(schema)(graph);

      expect(decoded.type).toBe("undirected");
      expect(decoded.mutable).toBe(false);
      expect(A.fromIterable(Graph_.entries(Graph_.nodes(decoded)))).toEqual([
        [0, 1],
        [1, 2],
      ]);
    })
  );
});

describe("Graph FromSelf schemas", () => {
  it.effect(
    "validates existing immutable directed graphs with nested transforms",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.DirectedGraphFromSelf({
        node: S.FiniteFromString,
        edge: S.String,
      });
      const graph = Graph_.directed<string, string>((mutable) => {
        const a = Graph_.addNode(mutable, "1");
        const b = Graph_.addNode(mutable, "2");
        Graph_.addEdge(mutable, a, b, "x");
      });
      const decoded = yield* S.decodeEffect(schema)(graph);

      expect(decoded.type).toBe("directed");
      expect(decoded.mutable).toBe(false);
      expect(A.fromIterable(Graph_.entries(Graph_.nodes(decoded)))).toEqual([
        [0, 1],
        [1, 2],
      ]);
    })
  );

  it.effect(
    "reports nested node decode failures on existing graphs",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.DirectedGraphFromSelf({
        node: S.FiniteFromString,
        edge: S.String,
      });
      const graph = Graph_.directed<string | null, string>((mutable) => {
        const a = Graph_.addNode(mutable, "1");
        const b = Graph_.addNode(mutable, null);
        Graph_.addEdge(mutable, a, b, "x");
      });

      const failure8 = yield* Effect.result(S.decodeUnknownEffect(schema)(graph));
      const isFailure9 = Result.isFailure(failure8);
      assertTrue(isFailure9);
      expect(failure8.failure.message).toContain(`Expected string
  at ["nodes"][1][1]`);
    })
  );

  it.effect(
    "rejects mutable graphs when the schema expects immutable ones",
    Effect.fnUntraced(function* () {
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

      const failure9 = yield* Effect.result(S.decodeUnknownEffect(schema)(graph));
      const isFailure10 = Result.isFailure(failure9);
      assertTrue(isFailure10);
      expect(failure9.failure.message).toContain("Expected @beep/schema/Graph/GraphFromSelf");
    })
  );

  it.effect(
    "validates existing mutable directed graphs and preserves mutability",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.MutableDirectedGraphFromSelf({
        node: S.FiniteFromString,
        edge: S.String,
      });
      const graph = Graph_.beginMutation(Graph_.directed<string, string>());
      const a = Graph_.addNode(graph, "1");
      const b = Graph_.addNode(graph, "2");
      Graph_.addEdge(graph, a, b, "x");

      const decoded = yield* S.decodeEffect(schema)(graph);

      expect(decoded.type).toBe("directed");
      expect(decoded.mutable).toBe(true);
      expect(A.fromIterable(Graph_.entries(Graph_.nodes(decoded)))).toEqual([
        [0, 1],
        [1, 2],
      ]);
    })
  );

  it.effect(
    "validates generic and undirected mutable graphs",
    Effect.fnUntraced(function* () {
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

      const generic = yield* S.decodeEffect(genericSchema)(graph);
      const undirected = yield* S.decodeEffect(undirectedSchema)(graph);

      expect(generic.type).toBe("undirected");
      expect(generic.mutable).toBe(true);
      expect(undirected.type).toBe("undirected");
      expect(undirected.mutable).toBe(true);
      const isFailure11 = Result.isFailure(yield* Effect.result(S.decodeUnknownEffect(directedSchema)(graph)));
      assertTrue(isFailure11);
    })
  );
});

describe("MutableDirectedGraph", () => {
  it.effect(
    "decodes encoded payloads into mutable directed graphs",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.MutableDirectedGraph({
        node: S.FiniteFromString,
        edge: S.String,
      });
      const decoded = yield* S.decodeUnknownEffect(schema)({
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
      expect(yield* S.encodeEffect(schema)(decoded)).toEqual({
        _tag: "Graph",
        type: "directed",
        nodes: [
          [0, "1"],
          [1, "2"],
        ],
        edges: [{ index: 0, source: 0, target: 1, data: "a" }],
      });
    })
  );
});

describe("MutableUndirectedGraph", () => {
  it.effect(
    "decodes encoded payloads into mutable undirected graphs",
    Effect.fnUntraced(function* () {
      const schema = GraphSchema.MutableUndirectedGraph({
        node: S.FiniteFromString,
        edge: S.String,
      });
      const decoded = yield* S.decodeUnknownEffect(schema)({
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
      expect(yield* S.encodeEffect(schema)(decoded)).toEqual({
        _tag: "Graph",
        type: "undirected",
        nodes: [
          [0, "1"],
          [1, "2"],
        ],
        edges: [{ index: 0, source: 0, target: 1, data: "a" }],
      });
    })
  );
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
