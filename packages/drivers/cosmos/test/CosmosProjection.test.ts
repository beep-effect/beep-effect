import {
  CosmosCapabilityProbe,
  CosmosGraphProjection,
  generateSyntheticOntologyProjection,
  renderCosmosGraph,
  SyntheticOntologyGraphOptions,
  selectCosmosBackend,
} from "@beep/cosmos";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";

const graphologyState = vi.hoisted(() => ({
  graphs: [] as Array<{
    readonly clearCount: () => number;
    readonly edgeKeys: () => ReadonlyArray<string>;
    readonly nodeKeys: () => ReadonlyArray<string>;
  }>,
  refreshCount: 0,
}));

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

    kill(): void {}
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

  it.effect(
    "rebuilds the sigma graphology graph from the incoming update projection",
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
      const container = globalThis.document?.createElement("div") ?? ({} as HTMLElement);
      const handle = yield* renderCosmosGraph(container, initial);
      const graph = graphologyState.graphs[0];

      expect(graph?.nodeKeys()).toEqual(["n1", "n2"]);
      expect(graph?.edgeKeys()).toEqual(["e0"]);

      handle.update(next);

      expect(graph?.clearCount()).toBe(1);
      expect(graph?.nodeKeys()).toEqual(["n10", "n20", "n30"]);
      expect(graph?.edgeKeys()).toEqual(["e0", "e1"]);
      expect(graphologyState.refreshCount).toBe(2);
    })
  );
});
