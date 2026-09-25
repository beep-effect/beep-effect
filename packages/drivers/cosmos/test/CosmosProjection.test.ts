import {
  CosmosCapabilityProbe,
  CosmosGraphProjection,
  generateSyntheticOntologyProjection,
  ProbeWebGl2Options,
  probeWebGl2,
  renderCosmosGraph,
  SyntheticOntologyGraphOptions,
  selectCosmosBackend,
} from "@beep/cosmos";
import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertExitFailure, assertNone } from "@effect/vitest/utils";
import { Cause, Effect } from "effect";
import * as O from "effect/Option";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { vi } from "vitest";

const graphologyState = vi.hoisted(
  (): {
    readonly graphs: Array<{
      readonly clearCount: () => number;
      readonly edgeKeys: () => ReadonlyArray<string>;
      readonly nodeKeys: () => ReadonlyArray<string>;
    }>;
    refreshCount: number;
    killCount: number;
  } => ({
    graphs: [],
    refreshCount: 0,
    killCount: 0,
  })
);

vi.mock("graphology", () => ({
  default: class {
    private clearCountValue = 0;
    private readonly edges: Array<string> = [];
    private readonly nodes: Array<string> = [];

    constructor() {
      graphologyState.graphs.push({
        clearCount: () => this.clearCountValue,
        edgeKeys: () => this.edges,
        nodeKeys: () => this.nodes,
      });
    }

    addDirectedEdgeWithKey(key: string): void {
      this.edges.push(key);
    }

    addNode(key: string): void {
      this.nodes.push(key);
    }

    clear(): void {
      this.clearCountValue += 1;
      this.edges.length = 0;
      this.nodes.length = 0;
    }
  },
}));

vi.mock("sigma", () => ({
  default: class {
    refresh(): void {
      graphologyState.refreshCount += 1;
    }

    kill(): void {
      graphologyState.killCount += 1;
    }
  },
}));

describe("cosmos driver projection and capability detection", () => {
  it.effect("selects cosmos only when WebGL2 is available", () =>
    Effect.sync(() => {
      expect(selectCosmosBackend(CosmosCapabilityProbe.make({ webGl2: true, reason: "ok" })).backend).toBe("cosmos");
      expect(selectCosmosBackend(CosmosCapabilityProbe.make({ webGl2: false, reason: "missing" })).backend).toBe(
        "sigma"
      );
    })
  );

  it.effect("generates deterministic typed-array graph projections", () =>
    Effect.sync(() => {
      const first = generateSyntheticOntologyProjection(
        SyntheticOntologyGraphOptions.make({ nodeCount: 100, edgeCount: 250, seed: 42 })
      );
      const second = generateSyntheticOntologyProjection(
        SyntheticOntologyGraphOptions.make({ nodeCount: 100, edgeCount: 250, seed: 42 })
      );

      expect(first.nodeIds).toBeInstanceOf(Uint32Array);
      expect(first.pointPositions).toBeInstanceOf(Float32Array);
      expect(first.links).toBeInstanceOf(Float32Array);
      expect(first.nodeIds).toHaveLength(100);
      expect(first.pointPositions).toHaveLength(200);
      expect(first.links).toHaveLength(500);
      expect(first.links[0]).toBe(second.links[0]);
      expect(first.links[1]).toBe(second.links[1]);
    })
  );

  it.prop(
    "preserves every projection buffer for generated production options",
    [
      Arbitrary.schema(SyntheticOntologyGraphOptions).pipe(
        Arbitrary.map((options) =>
          SyntheticOntologyGraphOptions.make({
            nodeCount: options.nodeCount % 65,
            edgeCount: options.edgeCount % 129,
            seed: options.seed % 2_147_483_648,
          })
        )
      ),
    ],
    ([options]) => {
      const first = generateSyntheticOntologyProjection(options);
      const second = generateSyntheticOntologyProjection(options);

      expect(first.nodeCount).toBe(second.nodeCount);
      expect(first.edgeCount).toBe(second.edgeCount);
      expect(first.nodeIds).toEqual(second.nodeIds);
      expect(first.pointPositions).toEqual(second.pointPositions);
      expect(first.links).toEqual(second.links);
    },
    { arbitrary: fcRuns(100) }
  );

  it.effect("normalizes synthetic graph counts without a parallel defaults object", () =>
    Effect.sync(() => {
      const projection = generateSyntheticOntologyProjection(
        SyntheticOntologyGraphOptions.make({ nodeCount: 0, edgeCount: -1, seed: 0 })
      );

      expect(projection.nodeCount).toBe(1);
      expect(projection.edgeCount).toBe(0);
      expect(projection.nodeIds).toHaveLength(1);
      expect(projection.links).toHaveLength(0);
    })
  );

  it.effect("models an omitted WebGL canvas as Option none", () =>
    Effect.sync(() => {
      assertNone(ProbeWebGl2Options.make({}).canvas);
    })
  );

  it.effect("probes explicit canvases without depending on the host WebGL runtime", () =>
    Effect.sync(() => {
      const availableCanvas = {
        getContext: vi.fn(() => ({})),
      } as unknown as HTMLCanvasElement;
      const unavailableCanvas = {
        getContext: vi.fn(() => null),
      } as unknown as HTMLCanvasElement;

      expect(probeWebGl2(ProbeWebGl2Options.make({ canvas: O.some(availableCanvas) })).webGl2).toBe(true);
      expect(probeWebGl2(ProbeWebGl2Options.make({ canvas: O.some(unavailableCanvas) })).webGl2).toBe(false);
    })
  );

  it.effect(
    "rebuilds the sigma graphology graph on update and destroys the renderer after scope failure",
    Effect.fnUntraced(function* () {
      graphologyState.graphs.length = 0;
      graphologyState.refreshCount = 0;
      const initial = CosmosGraphProjection.make({
        nodeCount: 2,
        edgeCount: 1,
        nodeIds: new Uint32Array([1, 2]),
        pointPositions: new Float32Array([0, 0, 1, 1]),
        links: new Float32Array([0, 1]),
      });
      const next = CosmosGraphProjection.make({
        nodeCount: 3,
        edgeCount: 2,
        nodeIds: new Uint32Array([10, 20, 30]),
        pointPositions: new Float32Array([0, 0, 1, 1, 2, 2]),
        links: new Float32Array([0, 1, 1, 2]),
      });
      const container = globalThis.document.createElement("div");

      try {
        yield* Effect.scoped(
          Effect.gen(function* () {
            vi.stubGlobal("requestAnimationFrame", undefined);
            yield* Effect.logInfo("Cosmos stage: acquire unframed renderer");
            yield* Effect.scoped(
              Effect.acquireRelease(renderCosmosGraph(container, initial), (unframedHandle) =>
                Effect.sync(() => unframedHandle.destroy())
              )
            );

            graphologyState.graphs.length = 0;
            graphologyState.refreshCount = 0;
            vi.stubGlobal("requestAnimationFrame", (_callback: FrameRequestCallback) => 1);
            vi.stubGlobal("cancelAnimationFrame", (_handle: number) => undefined);

            yield* Effect.logInfo("Cosmos stage: acquire framed renderer");
            const handle = yield* Effect.acquireRelease(renderCosmosGraph(container, initial), (handle) =>
              Effect.sync(() => handle.destroy())
            );
            const graph = graphologyState.graphs[0];

            expect(graph?.nodeKeys()).toEqual(["n1", "n2"]);
            expect(graph?.edgeKeys()).toEqual(["e0"]);

            yield* Effect.logInfo("Cosmos stage: update projection");
            handle.update(next);

            expect(graph?.clearCount()).toBe(1);
            expect(graph?.nodeKeys()).toEqual(["n10", "n20", "n30"]);
            expect(graph?.edgeKeys()).toEqual(["e0", "e1"]);
            expect(graphologyState.refreshCount).toBe(2);
          })
        );
      } finally {
        vi.unstubAllGlobals();
      }

      yield* Effect.sync(() => {
        graphologyState.killCount = 0;
      });
      const failureContainer = globalThis.document.createElement("div");
      const failureProjection = generateSyntheticOntologyProjection(
        SyntheticOntologyGraphOptions.make({ nodeCount: 2, edgeCount: 1, seed: 42 })
      );

      try {
        vi.stubGlobal("requestAnimationFrame", undefined);
        const exit = yield* Effect.scoped(
          Effect.gen(function* () {
            yield* Effect.logInfo("Cosmos stage: acquire failure-path renderer");
            yield* Effect.acquireRelease(renderCosmosGraph(failureContainer, failureProjection), (handle) =>
              Effect.sync(() => handle.destroy())
            );
            return yield* Effect.fail("scope cleanup probe");
          })
        ).pipe(Effect.exit);

        assertExitFailure(exit, Cause.fail("scope cleanup probe"));
        expect(graphologyState.killCount).toBe(1);
      } finally {
        vi.unstubAllGlobals();
      }
    })
  );
});
