/**
 * Browser-mode integration test for the workbench 2D/3D renderer toggle:
 * cosmos mounts by default, `ontologyGraphRendererAtom` swaps to the 3D
 * renderer and back, and selection changes flow through the bridge without
 * errors — the P2 toggle contract from goals/graph-3d-view.
 */

import {
  ontologyGraphBackendAtom,
  ontologyGraphContainerAtom,
  ontologyGraphContainerBindingAtom,
  ontologyGraphErrorAtom,
  ontologyGraphProjectionAtom,
  ontologyGraphRenderBridgeAtom,
  ontologyGraphRendererAtom,
  selectedOntologyResourceIriAtom,
  setOntologyGraphContainerElementAtom,
} from "@beep/ontology-client/aggregates/Session";
import {
  OntologyGraphEdge,
  OntologyGraphNode,
  OntologyGraphProjection,
  OntologyGraphProjectionStats,
} from "@beep/ontology-use-cases/aggregates/Session";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import { AtomRegistry } from "effect/reactivity";
import { vi } from "vitest";
import type { CosmosRenderHandle } from "@beep/cosmos";
import type { Graph3DRenderHandle } from "@beep/graph-3d/browser";

// These observers call the real factories and methods: WebGL, canvas mounting,
// projection updates, and selection remain the integration-test subjects.
const renderers = vi.hoisted(() => ({
  graph3d: vi.fn<(handle: Graph3DRenderHandle) => void>(),
  cosmos: vi.fn<(handle: CosmosRenderHandle) => void>(),
}));

vi.mock("@beep/graph-3d/browser", (importOriginal) =>
  Promise.all([importOriginal<typeof import("@beep/graph-3d/browser")>(), import("effect/Effect")]).then(
    ([actual, Effect]) => ({
      ...actual,
      renderGraph3D: (...args: Parameters<typeof actual.renderGraph3D>) =>
        actual.renderGraph3D(...args).pipe(
          Effect.tap((handle) =>
            Effect.sync(() => {
              vi.spyOn(handle, "destroy");
              vi.spyOn(handle, "update");
              renderers.graph3d(handle);
            })
          )
        ),
    })
  )
);

vi.mock("@beep/cosmos", (importOriginal) =>
  Promise.all([importOriginal<typeof import("@beep/cosmos")>(), import("effect/Effect")]).then(([actual, Effect]) => ({
    ...actual,
    renderCosmosGraph: (...args: Parameters<typeof actual.renderCosmosGraph>) =>
      actual.renderCosmosGraph(...args).pipe(
        Effect.tap((handle) =>
          Effect.sync(() => {
            vi.spyOn(handle, "destroy");
            renderers.cosmos(handle);
          })
        )
      ),
  }))
);

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
  it.live("publishes only measurable containers and clears them when the callback ref releases", () =>
    Effect.gen(function* () {
      const container = yield* Effect.acquireRelease(
        Effect.sync(() => document.createElement("div")),
        (container) => Effect.sync(() => container.remove())
      );
      container.style.width = "0";
      container.style.height = "0";
      document.body.append(container);
      renderers.graph3d.mockClear();
      renderers.cosmos.mockClear();
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          // A failed assertion must also release a renderer the bridge has not
          // finished disposing before the registry shuts down.
          for (const [handle] of [...renderers.graph3d.mock.calls, ...renderers.cosmos.mock.calls]) {
            if (vi.mocked(handle.destroy).mock.calls.length === 0) handle.destroy();
          }
        })
      );
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make()),
        (registry) => Effect.sync(() => registry.dispose())
      );
      yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(ontologyGraphContainerAtom)),
        (release) => Effect.sync(release)
      );
      yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(ontologyGraphContainerBindingAtom)),
        (release) => Effect.sync(release)
      );
      yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(setOntologyGraphContainerElementAtom)),
        (release) => Effect.sync(release)
      );
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          registry.set(setOntologyGraphContainerElementAtom, null);
          yield* waitFor("finalized graph container", () => O.isNone(registry.get(ontologyGraphContainerAtom)));
        })
      );

      registry.set(setOntologyGraphContainerElementAtom, container);
      yield* Effect.sleep("50 millis");
      expect(registry.get(ontologyGraphContainerAtom)).toStrictEqual(O.none());

      container.style.width = "320px";
      container.style.height = "180px";
      yield* waitFor("resized graph container", () => O.isSome(registry.get(ontologyGraphContainerAtom)));
      expect(registry.get(ontologyGraphContainerAtom)).toStrictEqual(O.some(container));

      registry.set(setOntologyGraphContainerElementAtom, null);
      yield* waitFor("released graph container", () => O.isNone(registry.get(ontologyGraphContainerAtom)));
    })
  );

  it.live("mounts cosmos by default, swaps to 3D and back, and keeps selection flowing", () =>
    Effect.gen(function* () {
      const container = yield* Effect.acquireRelease(
        Effect.sync(() => document.createElement("div")),
        (container) => Effect.sync(() => container.remove())
      );
      container.style.width = "800px";
      container.style.height = "600px";
      document.body.append(container);
      renderers.graph3d.mockClear();
      renderers.cosmos.mockClear();
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          // A failed assertion must also release a renderer the bridge has not
          // finished disposing before the registry shuts down.
          for (const [handle] of [...renderers.graph3d.mock.calls, ...renderers.cosmos.mock.calls]) {
            if (vi.mocked(handle.destroy).mock.calls.length === 0) handle.destroy();
          }
        })
      );
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make()),
        (registry) => Effect.sync(() => registry.dispose())
      );

      // Atoms are lazy: values written by the bridge only persist while the
      // atom is mounted, so the test mounts everything it reads — the same
      // thing the workbench's useAtomValue subscriptions do.
      yield* Effect.acquireRelease(
        Effect.sync(() => registry.subscribe(ontologyGraphBackendAtom, () => undefined)),
        (release) => Effect.sync(release)
      );
      yield* Effect.acquireRelease(
        Effect.sync(() => registry.subscribe(ontologyGraphErrorAtom, () => undefined)),
        (release) => Effect.sync(release)
      );
      yield* Effect.acquireRelease(
        Effect.sync(() => registry.subscribe(ontologyGraphRenderBridgeAtom, () => undefined)),
        (release) => Effect.sync(release)
      );
      yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(ontologyGraphContainerBindingAtom)),
        (release) => Effect.sync(release)
      );
      yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(setOntologyGraphContainerElementAtom)),
        (release) => Effect.sync(release)
      );
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          registry.set(setOntologyGraphContainerElementAtom, null);
          yield* waitFor("finalized graph container", () => O.isNone(registry.get(ontologyGraphContainerAtom)));
        })
      );
      // subscribing mounts lazily; reading forces the bridge body to run
      registry.get(ontologyGraphRenderBridgeAtom);

      registry.set(setOntologyGraphContainerElementAtom, container);
      yield* waitFor("measurable graph container", () => O.isSome(registry.get(ontologyGraphContainerAtom)));
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
      yield* waitFor("3D selection applied", () =>
        renderers.graph3d.mock.calls.some(([handle]) => handle.stats().selectedNodeIndex === 0)
      );
      const handle = renderers.graph3d.mock.calls.at(-1)![0];
      expect(handle.stats().selectedNodeIndex).toBe(0);
      expect(handle.stats().dimmedNodeCount).toBeGreaterThan(0);
      expect(O.isNone(registry.get(ontologyGraphErrorAtom))).toBe(true);

      // a projection update while selected re-applies selection without errors
      const updatesBefore = vi.mocked(handle.update).mock.calls.length;
      registry.set(ontologyGraphProjectionAtom, O.some(fixtureProjection()));
      yield* waitFor(
        "3D projection and selection reapplied",
        () => vi.mocked(handle.update).mock.calls.length > updatesBefore && handle.stats().selectedNodeIndex === 0
      );
      expect(handle.stats().dimmedNodeCount).toBeGreaterThan(0);
      expect(O.isNone(registry.get(ontologyGraphErrorAtom))).toBe(true);

      // toggling back restores the cosmos default
      registry.set(ontologyGraphRendererAtom, "cosmos");
      yield* waitFor("cosmos restored", () => O.isSome(registry.get(ontologyGraphBackendAtom)));
      expect(container.querySelectorAll("canvas").length).toBeGreaterThan(0);
      expect(O.isNone(registry.get(ontologyGraphErrorAtom))).toBe(true);

      registry.set(setOntologyGraphContainerElementAtom, null);
      yield* waitFor("released graph container", () => O.isNone(registry.get(ontologyGraphContainerAtom)));
    })
  );
});
