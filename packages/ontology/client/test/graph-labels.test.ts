import { cosmosProjectionFromOntology } from "@beep/ontology-client/aggregates/Session";
import {
  OntologyGraphNode,
  OntologyGraphProjection,
  OntologyGraphProjectionStats,
} from "@beep/ontology-use-cases/aggregates/Session";
import { describe, expect, it } from "@effect/vitest";

const node = (id: number, label: string) =>
  OntologyGraphNode.make({
    id,
    iri: `https://example.test/${label}`,
    label,
    kind: "class",
    classification: "tbox",
    folded: false,
    memberCount: 1,
    x: id,
    y: id,
  });

const projectionWith = (labelDetail: "full" | "key" | "hidden") =>
  OntologyGraphProjection.make({
    revision: 1,
    foldLevel: "L2",
    labelDetail,
    nodeCount: 2,
    edgeCount: 1,
    nodeIds: new Uint32Array([0, 1]),
    nodeKinds: new Uint8Array([0, 0]),
    nodeFlags: new Uint8Array([0, 0]),
    edgeIds: new Uint32Array([0]),
    edgeKinds: new Uint8Array([0]),
    pointPositions: new Float32Array([0, 0, 1, 1]),
    links: new Float32Array([0, 1]),
    nodes: [node(0, "Pizza"), node(1, "Pizza base")],
    edges: [],
    clusters: [],
    changedNodeIds: [],
    changedEdgeIds: [],
    stats: OntologyGraphProjectionStats.make({
      visibleResourceCount: 2,
      projectedNodeCount: 2,
      projectedEdgeCount: 1,
      foldedResourceCount: 0,
    }),
  });

describe("ontology graph labels reach the renderer", () => {
  it("carries every node's label through to the cosmos projection", () => {
    // The projection has always computed a label for each node, and the renderer
    // always dropped them — so a graph of named classes drew as a field of
    // anonymous dots, and the "labels full" badge described text nobody could see.
    const projection = cosmosProjectionFromOntology(projectionWith("full"));

    expect(projection.labels).toStrictEqual(["Pizza", "Pizza base"]);
  });

  it("sends no labels when the fold level says they are hidden", () => {
    // `hidden` is a real answer, not an oversight: past a certain size the names
    // stop being readable and start being noise.
    const projection = cosmosProjectionFromOntology(projectionWith("hidden"));

    expect(projection.labels).toBeUndefined();
  });
});
