import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import { AtomRegistry } from "effect/unstable/reactivity";
import { afterEach, vi } from "vitest";
import { fpsSampleAtoms } from "@/spikes/Fps.atoms";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("spike FPS sampling", () => {
  it("publishes at most every 500 ms and cancels the active frame on disposal", () => {
    let scheduled = O.none<FrameRequestCallback>();
    let nextFrameId = 0;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      scheduled = O.some(callback);
      nextFrameId += 1;
      return nextFrameId;
    });
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const fps = vi.fn(() => 47);
    const atom = fpsSampleAtoms({ fps });
    const registry = AtomRegistry.make();
    registry.mount(atom);

    expect(registry.get(atom)).toBe(0);
    O.getOrThrow(scheduled)(499);
    expect(fps).not.toHaveBeenCalled();
    expect(registry.get(atom)).toBe(0);

    O.getOrThrow(scheduled)(500);
    expect(fps).toHaveBeenCalledTimes(1);
    expect(registry.get(atom)).toBe(47);

    O.getOrThrow(scheduled)(999);
    expect(fps).toHaveBeenCalledTimes(1);
    O.getOrThrow(scheduled)(1_000);
    expect(fps).toHaveBeenCalledTimes(2);

    registry.dispose();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(nextFrameId);
  });
});
