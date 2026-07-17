/** Browser-mode lifecycle and interaction tests for the 3D graph renderer. */

import { generateSyntheticGraph3DProjection, SyntheticGraph3DOptions } from "@beep/graph-3d";
import { Graph3DRenderOptions, renderGraph3D } from "@beep/graph-3d/browser";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

const mountContainer = (): HTMLDivElement => {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.append(container);
  return container;
};

describe("renderGraph3D", () => {
  it.live("mounts and reports the projected node and edge counts", () =>
    Effect.gen(function* () {
      const container = mountContainer();
      const options = SyntheticGraph3DOptions.make({
        nodeCount: 60,
        edgeCount: 120,
        communityCount: 4,
        seed: 7,
      });
      const projection = generateSyntheticGraph3DProjection(options);
      const handle = yield* renderGraph3D(container, projection);

      expect(handle.backend).toBe("three-instanced");
      expect(container.querySelectorAll("canvas")).toHaveLength(1);
      expect(handle.stats().nodeCount).toBe(options.nodeCount);
      expect(handle.stats().edgeCount).toBe(options.edgeCount);

      handle.destroy();
      container.remove();
    })
  );

  it.live("select dims non-neighbors and clears on undefined", () =>
    Effect.gen(function* () {
      const container = mountContainer();
      const options = SyntheticGraph3DOptions.make({
        nodeCount: 60,
        edgeCount: 120,
        communityCount: 4,
        seed: 7,
      });
      const projection = generateSyntheticGraph3DProjection(options);
      const handle = yield* renderGraph3D(container, projection);

      handle.select(0);
      const selectedStats = handle.stats();
      expect(selectedStats.selectedNodeIndex).toBe(0);
      expect(selectedStats.dimmedNodeCount).toBeGreaterThan(0);
      expect(selectedStats.dimmedNodeCount).toBeLessThan(selectedStats.nodeCount);

      handle.select(undefined);
      const clearedStats = handle.stats();
      expect(clearedStats.dimmedNodeCount).toBe(0);
      expect(clearedStats.selectedNodeIndex).toBeUndefined();

      handle.destroy();
      container.remove();
    })
  );

  it.live("onNodeSelect fires only from user clicks, not from select()", () =>
    Effect.gen(function* () {
      const container = mountContainer();
      const projection = generateSyntheticGraph3DProjection(
        SyntheticGraph3DOptions.make({ nodeCount: 60, edgeCount: 120, communityCount: 4, seed: 7 })
      );
      const calls: Array<number | undefined> = [];
      const renderOptions = Graph3DRenderOptions.make({
        onNodeSelect: (nodeIndex: number | undefined) => {
          calls.push(nodeIndex);
        },
      });
      const handle = yield* renderGraph3D(container, projection, renderOptions);

      handle.select(3);
      expect(calls).toHaveLength(0);

      handle.destroy();
      container.remove();
    })
  );

  it.live("destroy is idempotent and StrictMode double-mount safe", () =>
    Effect.gen(function* () {
      const container = mountContainer();
      const options = SyntheticGraph3DOptions.make({
        nodeCount: 60,
        edgeCount: 120,
        communityCount: 4,
        seed: 7,
      });
      const projection = generateSyntheticGraph3DProjection(options);
      const handle = yield* renderGraph3D(container, projection);

      handle.destroy();
      expect(() => handle.destroy()).not.toThrow();
      expect(container.querySelectorAll("canvas")).toHaveLength(0);

      const strictModeHandle = yield* renderGraph3D(container, projection);
      strictModeHandle.destroy();
      const remountedHandle = yield* renderGraph3D(container, projection);
      expect(container.querySelectorAll("canvas")).toHaveLength(1);
      expect(remountedHandle.stats().nodeCount).toBe(options.nodeCount);

      remountedHandle.destroy();
      container.remove();
    })
  );

  it.live("update replaces the projection and resets selection", () =>
    Effect.gen(function* () {
      const container = mountContainer();
      const projectionA = generateSyntheticGraph3DProjection(
        SyntheticGraph3DOptions.make({ nodeCount: 60, edgeCount: 120, communityCount: 4, seed: 7 })
      );
      const handle = yield* renderGraph3D(container, projectionA);
      handle.select(0);

      const projectionB = generateSyntheticGraph3DProjection(
        SyntheticGraph3DOptions.make({ nodeCount: 30, edgeCount: 40, communityCount: 3, seed: 11 })
      );
      handle.update(projectionB);

      const stats = handle.stats();
      expect(stats.nodeCount).toBe(30);
      expect(stats.edgeCount).toBe(40);
      expect(stats.selectedNodeIndex).toBeUndefined();
      expect(stats.dimmedNodeCount).toBe(0);

      handle.destroy();
      container.remove();
    })
  );
});
