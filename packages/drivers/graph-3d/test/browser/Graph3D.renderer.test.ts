/** Browser-mode lifecycle and interaction tests for the 3D graph renderer. */

import { generateSyntheticGraph3DProjection, SyntheticGraph3DOptions } from "@beep/graph-3d";
import { Graph3DRenderOptions, renderGraph3D } from "@beep/graph-3d/browser";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { userEvent } from "vitest/browser";

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
      yield* Effect.logInfo("Graph3D stage: mount container");
      const container = yield* Effect.acquireRelease(Effect.sync(mountContainer), (container) =>
        Effect.sync(() => container.remove())
      );
      const options = SyntheticGraph3DOptions.make({
        nodeCount: 60,
        edgeCount: 120,
        communityCount: 4,
        seed: 7,
      });
      const projection = generateSyntheticGraph3DProjection(options);
      yield* Effect.logInfo("Graph3D stage: acquire handle");
      const handle = yield* Effect.acquireRelease(renderGraph3D(container, projection), (handle) =>
        Effect.sync(() => handle.destroy())
      );

      expect(handle.backend).toBe("three-instanced");
      expect(container.querySelectorAll("canvas")).toHaveLength(1);
      expect(handle.stats().nodeCount).toBe(options.nodeCount);
      expect(handle.stats().edgeCount).toBe(options.edgeCount);

      yield* Effect.logInfo("Graph3D stage: destroy renderer");
      handle.destroy();
      container.remove();
    })
  );

  it.live("select dims non-neighbors and clears on undefined", () =>
    Effect.gen(function* () {
      yield* Effect.logInfo("Graph3D stage: mount container");
      const container = yield* Effect.acquireRelease(Effect.sync(mountContainer), (container) =>
        Effect.sync(() => container.remove())
      );
      const options = SyntheticGraph3DOptions.make({
        nodeCount: 60,
        edgeCount: 120,
        communityCount: 4,
        seed: 7,
      });
      const projection = generateSyntheticGraph3DProjection(options);
      yield* Effect.logInfo("Graph3D stage: acquire handle");
      const handle = yield* Effect.acquireRelease(renderGraph3D(container, projection), (handle) =>
        Effect.sync(() => handle.destroy())
      );

      handle.select(0);
      const selectedStats = handle.stats();
      expect(selectedStats.selectedNodeIndex).toBe(0);
      expect(selectedStats.dimmedNodeCount).toBeGreaterThan(0);
      expect(selectedStats.dimmedNodeCount).toBeLessThan(selectedStats.nodeCount);

      handle.select(undefined);
      const clearedStats = handle.stats();
      expect(clearedStats.dimmedNodeCount).toBe(0);
      expect(clearedStats.selectedNodeIndex).toBeUndefined();

      yield* Effect.logInfo("Graph3D stage: destroy renderer");
      handle.destroy();
      container.remove();
    })
  );

  it.live("onNodeSelect fires only from user clicks, not from select()", () =>
    Effect.gen(function* () {
      yield* Effect.logInfo("Graph3D stage: mount container");
      const container = yield* Effect.acquireRelease(Effect.sync(mountContainer), (container) =>
        Effect.sync(() => container.remove())
      );
      const projection = generateSyntheticGraph3DProjection(
        SyntheticGraph3DOptions.make({ nodeCount: 60, edgeCount: 120, communityCount: 4, seed: 7 })
      );
      const calls: Array<number | undefined> = [];
      const renderOptions = Graph3DRenderOptions.make({
        onNodeSelect: (nodeIndex: number | undefined) => {
          calls.push(nodeIndex);
        },
      });
      yield* Effect.logInfo("Graph3D stage: acquire handle");
      const handle = yield* Effect.acquireRelease(renderGraph3D(container, projection, renderOptions), (handle) =>
        Effect.sync(() => handle.destroy())
      );

      handle.select(3);
      expect(calls).toHaveLength(0);

      yield* Effect.logInfo("Graph3D stage: prepare native click target");
      handle.destroy();
      const clickProjection = generateSyntheticGraph3DProjection(
        SyntheticGraph3DOptions.make({ nodeCount: 1, edgeCount: 0, communityCount: 1, seed: 7 })
      );
      const clickHandle = yield* Effect.acquireRelease(
        renderGraph3D(container, clickProjection, renderOptions),
        (handle) => Effect.sync(() => handle.destroy())
      );
      yield* Effect.callback<void>((resume) => {
        const frame = requestAnimationFrame(() => resume(Effect.void));
        return Effect.sync(() => cancelAnimationFrame(frame));
      });
      const canvas = container.querySelector("canvas");
      expect(canvas).not.toBeNull();
      if (canvas !== null) {
        yield* Effect.logInfo("Graph3D stage: native canvas click");
        yield* Effect.promise(() =>
          userEvent.click(canvas, { position: { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 } })
        );
      }
      expect(calls).toEqual([0]);
      expect(clickHandle.stats().selectedNodeIndex).toBe(0);

      yield* Effect.logInfo("Graph3D stage: destroy renderer");
      handle.destroy();
      container.remove();
    })
  );

  it.live("destroy is idempotent and StrictMode double-mount safe", () =>
    Effect.gen(function* () {
      yield* Effect.logInfo("Graph3D stage: mount container");
      const container = yield* Effect.acquireRelease(Effect.sync(mountContainer), (container) =>
        Effect.sync(() => container.remove())
      );
      const options = SyntheticGraph3DOptions.make({
        nodeCount: 60,
        edgeCount: 120,
        communityCount: 4,
        seed: 7,
      });
      const projection = generateSyntheticGraph3DProjection(options);
      yield* Effect.logInfo("Graph3D stage: acquire handle");
      const handle = yield* Effect.acquireRelease(renderGraph3D(container, projection), (handle) =>
        Effect.sync(() => handle.destroy())
      );

      yield* Effect.logInfo("Graph3D stage: destroy renderer");
      handle.destroy();
      expect(() => handle.destroy()).not.toThrow();
      expect(container.querySelectorAll("canvas")).toHaveLength(0);

      yield* Effect.logInfo("Graph3D stage: acquire strictModeHandle");
      const strictModeHandle = yield* Effect.acquireRelease(renderGraph3D(container, projection), (handle) =>
        Effect.sync(() => handle.destroy())
      );
      strictModeHandle.destroy();
      yield* Effect.logInfo("Graph3D stage: acquire remountedHandle");
      const remountedHandle = yield* Effect.acquireRelease(renderGraph3D(container, projection), (handle) =>
        Effect.sync(() => handle.destroy())
      );
      expect(container.querySelectorAll("canvas")).toHaveLength(1);
      expect(remountedHandle.stats().nodeCount).toBe(options.nodeCount);

      remountedHandle.destroy();
      container.remove();
    })
  );

  it.live("update replaces the projection and resets selection", () =>
    Effect.gen(function* () {
      yield* Effect.logInfo("Graph3D stage: mount container");
      const container = yield* Effect.acquireRelease(Effect.sync(mountContainer), (container) =>
        Effect.sync(() => container.remove())
      );
      const projectionA = generateSyntheticGraph3DProjection(
        SyntheticGraph3DOptions.make({ nodeCount: 60, edgeCount: 120, communityCount: 4, seed: 7 })
      );
      yield* Effect.logInfo("Graph3D stage: acquire handle");
      const handle = yield* Effect.acquireRelease(renderGraph3D(container, projectionA), (handle) =>
        Effect.sync(() => handle.destroy())
      );
      handle.select(0);

      const projectionB = generateSyntheticGraph3DProjection(
        SyntheticGraph3DOptions.make({ nodeCount: 30, edgeCount: 40, communityCount: 3, seed: 11 })
      );
      yield* Effect.logInfo("Graph3D stage: update projection");
      handle.update(projectionB);

      const stats = handle.stats();
      expect(stats.nodeCount).toBe(30);
      expect(stats.edgeCount).toBe(40);
      expect(stats.selectedNodeIndex).toBeUndefined();
      expect(stats.dimmedNodeCount).toBe(0);

      yield* Effect.logInfo("Graph3D stage: destroy renderer");
      handle.destroy();
      container.remove();
    })
  );
});
