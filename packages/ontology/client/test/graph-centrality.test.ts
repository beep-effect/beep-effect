import { graph3dProjectionFromOntology } from "@beep/ontology-client/aggregates/Session";
import {
  OntologyGraphNode,
  OntologyGraphProjection,
  OntologyGraphProjectionStats,
} from "@beep/ontology-use-cases/aggregates/Session";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";

const pathProjection = (nodeCount: number, revision: number): OntologyGraphProjection => {
  const nodeIndices = A.range(0, nodeCount - 1);
  const edgeSources = A.range(0, nodeCount - 2);
  return OntologyGraphProjection.make({
    revision,
    foldLevel: "L2",
    labelDetail: "hidden",
    nodeCount,
    edgeCount: nodeCount - 1,
    nodeIds: new Uint32Array(nodeIndices),
    nodeKinds: new Uint8Array(nodeCount),
    nodeFlags: new Uint8Array(nodeCount),
    edgeIds: new Uint32Array(edgeSources),
    edgeKinds: new Uint8Array(nodeCount - 1),
    pointPositions: new Float32Array(A.flatMap(nodeIndices, (node) => [node, 0])),
    links: new Float32Array(A.flatMap(edgeSources, (source) => [source, source + 1])),
    nodes: A.map(nodeIndices, (id) =>
      OntologyGraphNode.make({
        id,
        iri: `https://example.test/node/${id}`,
        label: `Node ${id}`,
        kind: "class",
        classification: "tbox",
        folded: false,
        memberCount: 1,
        x: id,
        y: 0,
      })
    ),
    edges: [],
    clusters: [],
    changedNodeIds: [],
    changedEdgeIds: [],
    stats: OntologyGraphProjectionStats.make({
      visibleResourceCount: nodeCount,
      projectedNodeCount: nodeCount,
      projectedEdgeCount: nodeCount - 1,
      foldedResourceCount: 0,
    }),
  });
};

describe("3d graph centrality budget", () => {
  it("does not reuse channels for unrelated projections with the same revision", () => {
    const first = graph3dProjectionFromOntology(pathProjection(4, 1));
    const second = graph3dProjectionFromOntology(pathProjection(7, 1));

    expect(first.nodeImportance).toHaveLength(4);
    expect(first.edgeWeights).toHaveLength(3);
    expect(second.nodeImportance).toHaveLength(7);
    expect(second.nodeCommunities).toHaveLength(7);
    expect(second.edgeWeights).toHaveLength(6);
  });

  it("stays exact at the cutover and samples deterministically above it", () => {
    const exactNodeCount = 1_500;
    const exact = graph3dProjectionFromOntology(pathProjection(exactNodeCount, 10_001));
    const exactMaximum = Math.floor(((exactNodeCount - 1) * (exactNodeCount - 1)) / 4);
    expect(exact.nodeImportance[1]).toBeCloseTo((exactNodeCount - 2) / exactMaximum, 6);

    const sampledNodeCount = 1_502;
    const first = graph3dProjectionFromOntology(pathProjection(sampledNodeCount, 10_002));
    const second = graph3dProjectionFromOntology(pathProjection(sampledNodeCount, 10_003));
    expect(first.nodeImportance).toEqual(second.nodeImportance);
    expect(first.nodeImportance[1]).toBeGreaterThan(0.004);
  });
});
