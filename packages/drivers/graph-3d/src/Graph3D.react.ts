/**
 * React bindings for the imperative graph-3d render handle: a mount hook that
 * owns the `renderGraph3D` lifecycle (StrictMode-safe cancel/destroy) and an
 * fps sampling hook driven by `requestAnimationFrame`.
 *
 * The driver core stays framework-free; these hooks are the one sanctioned
 * React adapter, shared by the Storybook demo and the desktop spike so the
 * mount contract lives in a single place.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import { useEffect, useRef, useState } from "react";
import { Graph3DRenderOptions, renderGraph3D } from "./Graph3D.renderer.js";
import type * as React from "react";
import type { Graph3DProjection } from "./Graph3D.projection.js";
import type { Graph3DRenderHandle } from "./Graph3D.renderer.js";

/**
 * Mounts `renderGraph3D` into a ref'd container and owns the handle
 * lifecycle: remounts when the projection identity changes, destroys on
 * unmount, and safely discards a late mount after cancellation (the
 * StrictMode double-mount contract). The optional `onNodeSelect` callback is
 * held in a ref so its identity never forces a remount.
 *
 * @example
 * ```ts
 * import { generateSyntheticGraph3DProjection, SyntheticGraph3DOptions } from "@beep/graph-3d"
 * import { useGraph3DHandle } from "@beep/graph-3d/react"
 *
 * const projection = generateSyntheticGraph3DProjection(SyntheticGraph3DOptions.make({}))
 *
 * const useDemo = () => {
 *   const { containerRef, handle, error } = useGraph3DHandle(projection)
 *   return { containerRef, mounted: handle !== undefined, error }
 * }
 *
 * console.log(typeof useDemo) // "function"
 * ```
 *
 * @category react
 * @since 0.0.0
 */
export const useGraph3DHandle = (
  projection: Graph3DProjection,
  onNodeSelect?: (nodeIndex: number | undefined) => void
): {
  // Inline structural result: a live DOM ref and an imperative handle are
  // runtime capabilities, not data to model as an exported schema.
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly error: string | undefined;
  readonly handle: Graph3DRenderHandle | undefined;
} => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState<Graph3DRenderHandle | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    let cancelled = false;
    let mounted: Graph3DRenderHandle | undefined;
    setError(undefined);
    void Effect.runPromise(
      renderGraph3D(
        container,
        projection,
        Graph3DRenderOptions.make({
          onNodeSelect: (nodeIndex: number | undefined) => onNodeSelectRef.current?.(nodeIndex),
        })
      )
    ).then(
      (next) => {
        if (cancelled) {
          next.destroy();
          return;
        }
        mounted = next;
        setHandle(next);
      },
      (cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    );
    return () => {
      cancelled = true;
      mounted?.destroy();
      setHandle(undefined);
    };
  }, [projection]);

  return { containerRef, error, handle };
};

/**
 * Samples `handle.fps()` on a `requestAnimationFrame` loop, updating at most
 * once per `sampleIntervalMs` (default 500ms). Returns `0` until the first
 * sample lands or while no handle is mounted.
 *
 * @example
 * ```ts
 * import { useGraph3DFps } from "@beep/graph-3d/react"
 * import type { Graph3DRenderHandle } from "@beep/graph-3d/browser"
 *
 * const useOverlay = (handle: Graph3DRenderHandle | undefined) => {
 *   const fps = useGraph3DFps(handle)
 *   return `fps ${fps.toFixed(1)}`
 * }
 *
 * console.log(typeof useOverlay) // "function"
 * ```
 *
 * @category react
 * @since 0.0.0
 */
export const useGraph3DFps = (handle: Graph3DRenderHandle | undefined, sampleIntervalMs = 500): number => {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (handle === undefined) {
      setFps(0);
      return;
    }
    let frameId = 0;
    let lastSample = 0;
    const tick = (time: number): void => {
      frameId = requestAnimationFrame(tick);
      if (time - lastSample >= sampleIntervalMs) {
        lastSample = time;
        setFps(handle.fps());
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [handle, sampleIntervalMs]);

  return fps;
};
