/**
 * Browser-mode integration test for the workbench 2D/3D renderer toggle:
 * cosmos mounts by default, `ontologyGraphRendererAtom` swaps to the 3D
 * renderer and back, and selection changes flow through the bridge without
 * errors — the P2 toggle contract from goals/graph-3d-view.
 */

import {
  ontologyGraphBackendAtom,
  ontologyGraphContainerAtom,
  ontologyGraphErrorAtom,
  ontologyGraphProjectionAtom,
  ontologyGraphRenderBridgeAtom,
  ontologyGraphRendererAtom,
  selectedOntologyResourceIriAtom,
} from "@beep/ontology-client/aggregates/Session";
import {
  OntologyGraphEdge,
  OntologyGraphNode,
  OntologyGraphProjection,
  OntologyGraphProjectionStats,
} from "@beep/ontology-use-cases/aggregates/Session";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import { AtomRegistry } from "effect/unstable/reactivity";

const node = (id: number, label: string) =>
  OntologyGraphNode.make({
    id,
    iri: `https://example.test/${label}`,
    label,
    kind: "class",
    classification: "tbox",
    folded: false,
    memberCount: 1,
    x: id * 20,
    y: id * 12,
  });

const edge = (id: number, sourceId: number, targetId: number) =>
  OntologyGraphEdge.make({
    id,
    sourceId,
    targetId,
    sourceIri: `https://example.test/n${sourceId}`,
    targetIri: `https://example.test/n${targetId}`,
    predicateIri: "https://example.test/linkedTo",
    label: "linkedTo",
    folded: false,
  });

const fixtureProjection = () => {
  const nodeCount = 6;
  const nodes = [
    node(0, "Pizza"),
    node(1, "Base"),
    node(2, "Topping"),
    node(3, "Cheese"),
    node(4, "Ham"),
    node(5, "Dough"),
  ];
  const pointPositions = new Float32Array(nodeCount * 2);
  const pointDepths = new Float32Array(nodeCount);
  for (let index = 0; index < nodeCount; index += 1) {
    pointPositions[index * 2] = nodes[index]!.x;
    pointPositions[index * 2 + 1] = nodes[index]!.y;
    pointDepths[index] = (index - 2.5) * 15;
  }
  return OntologyGraphProjection.make({
    revision: 1,
    foldLevel: "L2",
    labelDetail: "full",
    nodeCount,
    edgeCount: 5,
    nodeIds: new Uint32Array([0, 1, 2, 3, 4, 5]),
    nodeKinds: new Uint8Array(nodeCount),
    nodeFlags: new Uint8Array(nodeCount),
    edgeIds: new Uint32Array([0, 1, 2, 3, 4]),
    edgeKinds: new Uint8Array(5),
    pointPositions,
    pointDepths,
    links: new Float32Array([0, 1, 0, 2, 2, 3, 2, 4, 1, 5]),
    nodes,
    edges: [edge(0, 0, 1), edge(1, 0, 2), edge(2, 2, 3), edge(3, 2, 4), edge(4, 1, 5)],
    clusters: [],
    changedNodeIds: [],
    changedEdgeIds: [],
    stats: OntologyGraphProjectionStats.make({
      visibleResourceCount: nodeCount,
      projectedNodeCount: nodeCount,
      projectedEdgeCount: 5,
      foldedResourceCount: 0,
    }),
  });
};

const waitFor = (label: string, predicate: () => boolean, timeoutMs = 20_000): Effect.Effect<void> =>
  Effect.gen(function* () {
    const start = performance.now();
    while (!predicate()) {
      if (performance.now() - start > timeoutMs) {
        return yield* Effect.die(new Error(`waitFor timed out: ${label}`));
      }
      yield* Effect.sleep("100 millis");
    }
  });

describe("workbench graph renderer toggle", () => {
  it.live("mounts cosmos by default, swaps to 3D and back, and keeps selection flowing", () =>
    Effect.gen(function* () {
      const registry = AtomRegistry.make();
      const container = document.createElement("div");
      container.style.width = "800px";
      container.style.height = "600px";
      document.body.append(container);

      // Atoms are lazy: values written by the bridge only persist while the
      // atom is mounted, so the test mounts everything it reads — the same
      // thing the workbench's useAtomValue subscriptions do.
      const unsubscribers = [
        registry.subscribe(ontologyGraphBackendAtom, () => undefined),
        registry.subscribe(ontologyGraphErrorAtom, () => undefined),
        registry.subscribe(ontologyGraphRenderBridgeAtom, () => undefined),
      ];
      // subscribing mounts lazily; reading forces the bridge body to run
      registry.get(ontologyGraphRenderBridgeAtom);

      registry.set(ontologyGraphContainerAtom, O.some(container));
      registry.set(ontologyGraphProjectionAtom, O.some(fixtureProjection()));

      // cosmos is the default renderer
      yield* waitFor(
        "first canvas or error",
        () => container.querySelectorAll("canvas").length > 0 || O.isSome(registry.get(ontologyGraphErrorAtom))
      );
      expect(registry.get(ontologyGraphErrorAtom)).toStrictEqual(O.none());
      yield* waitFor("cosmos backend", () => O.isSome(registry.get(ontologyGraphBackendAtom)));
      expect(registry.get(ontologyGraphRendererAtom)).toBe("cosmos");
      const cosmosCanvasCount = container.querySelectorAll("canvas").length;
      expect(cosmosCanvasCount).toBeGreaterThan(0);

      // opt into the 3D renderer: cosmos unmounts (its canvases go away), the
      // single 3D canvas mounts, and the cosmos backend badge source goes quiet
      registry.set(ontologyGraphRendererAtom, "graph3d");
      yield* waitFor("backend cleared", () => O.isNone(registry.get(ontologyGraphBackendAtom)));
      yield* waitFor("single 3d canvas", () => container.querySelectorAll("canvas").length === 1);
      expect(O.isNone(registry.get(ontologyGraphErrorAtom))).toBe(true);

      // selection flows through the bridge into the mounted 3D renderer
      registry.set(selectedOntologyResourceIriAtom, O.some("https://example.test/Pizza"));
      yield* Effect.sleep("300 millis");
      expect(O.isNone(registry.get(ontologyGraphErrorAtom))).toBe(true);

      // a projection update while selected re-applies selection without errors
      registry.set(ontologyGraphProjectionAtom, O.some(fixtureProjection()));
      yield* Effect.sleep("300 millis");
      expect(O.isNone(registry.get(ontologyGraphErrorAtom))).toBe(true);

      // toggling back restores the cosmos default
      registry.set(ontologyGraphRendererAtom, "cosmos");
      yield* waitFor("cosmos restored", () => O.isSome(registry.get(ontologyGraphBackendAtom)));
      expect(container.querySelectorAll("canvas").length).toBeGreaterThan(0);
      expect(O.isNone(registry.get(ontologyGraphErrorAtom))).toBe(true);

      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      container.remove();
    })
  );
});
