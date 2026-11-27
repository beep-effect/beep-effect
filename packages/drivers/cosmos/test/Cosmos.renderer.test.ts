import { CosmosGraphProjection, renderCosmosGraph } from "@beep/cosmos";
import { it } from "@beep/test-runner";
import { afterEach, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { vi } from "vitest";

const renderer = vi.hoisted(() => ({
  setPointPositions: vi.fn(),
  setLinks: vi.fn(),
  render: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("@cosmos.gl/graph", () => ({
  Graph: class {
    setPointPositions = renderer.setPointPositions;
    setLinks = renderer.setLinks;
    render = renderer.render;
    stop = renderer.stop;
    destroy = renderer.destroy;
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.effect(
  "initializes the Cosmos buffers and releases its renderer and frame sampler",
  Effect.fnUntraced(function* () {
    const container = document.createElement("div");
    const documentSeenOnlyByCapabilityProbe = { createElement: () => ({ getContext: () => ({}) }) };
    vi.stubGlobal("document", documentSeenOnlyByCapabilityProbe);
    const requestFrame = vi.fn<(callback: FrameRequestCallback) => number>().mockReturnValue(7);
    const cancelFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    const projection = CosmosGraphProjection.make({
      nodeCount: 1,
      edgeCount: 0,
      nodeIds: new Uint32Array([3]),
      pointPositions: new Float32Array([10, 20]),
      links: new Float32Array(),
    });
    const handle = yield* renderCosmosGraph(container, projection);
    expect(handle.backend).toBe("cosmos");
    expect(renderer.setPointPositions).toHaveBeenCalledWith(projection.pointPositions);
    expect(renderer.setLinks).toHaveBeenCalledWith(projection.links);
    expect(renderer.render).toHaveBeenCalledOnce();
    expect(handle.fps()).toBe(0);
    handle.destroy();
    expect(cancelFrame).toHaveBeenCalledWith(7);
    expect(renderer.stop).toHaveBeenCalledOnce();
    expect(renderer.destroy).toHaveBeenCalledOnce();
  })
);
