/**
 * WebKitGTK viability spike for the graph-3d driver (goal graph-3d-view P2).
 *
 * Mounts the instanced three.js renderer on synthetic data inside the desktop
 * webview and reports sustained framerate, projection-update cost, and
 * selection-rewrite cost — the acceptance evidence the design gate deferred to
 * the target webview. Reached with `?graph3d-spike` in dev mode, mirroring the
 * cosmos spike's flag pattern.
 */
import { generateSyntheticGraph3DProjection, SyntheticGraph3DOptions } from "@beep/graph-3d";
import { Graph3DRenderOptions, renderGraph3D } from "@beep/graph-3d/browser";
import { Effect } from "effect";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Graph3DRenderHandle } from "@beep/graph-3d/browser";
import type { JSX } from "react";

const PRESETS = [
  { label: "1k / 2k", nodeCount: 1_000, edgeCount: 2_000 },
  { label: "2.5k / 5k", nodeCount: 2_500, edgeCount: 5_000 },
  { label: "2.5k / 12.5k", nodeCount: 2_500, edgeCount: 12_500 },
  { label: "5k / 10k", nodeCount: 5_000, edgeCount: 10_000 },
] as const;

interface StressReport {
  readonly avgUpdateMs: number;
  readonly updates: number;
  readonly worstUpdateMs: number;
}

const heapMb = (): number | undefined => {
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return memory === undefined ? undefined : Math.round(memory.usedJSHeapSize / 1_048_576);
};

export function Graph3DSpike(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [presetIndex, setPresetIndex] = useState(1);
  const [handle, setHandle] = useState<Graph3DRenderHandle | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [fps, setFps] = useState(0);
  const [stress, setStress] = useState<StressReport | undefined>(undefined);
  const preset = PRESETS[presetIndex] ?? PRESETS[1];

  const projection = useMemo(
    () =>
      generateSyntheticGraph3DProjection(
        SyntheticGraph3DOptions.make({
          nodeCount: preset.nodeCount,
          edgeCount: preset.edgeCount,
          communityCount: 8,
          seed: 1_337,
        })
      ),
    [preset]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    let cancelled = false;
    let mounted: Graph3DRenderHandle | undefined;
    setError(undefined);
    setStress(undefined);
    void Effect.runPromise(renderGraph3D(container, projection, Graph3DRenderOptions.make({}))).then(
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

  useEffect(() => {
    if (handle === undefined) {
      return;
    }
    let frameId = 0;
    let lastSample = 0;
    const tick = (time: number): void => {
      frameId = requestAnimationFrame(tick);
      if (time - lastSample >= 500) {
        lastSample = time;
        setFps(handle.fps());
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [handle]);

  // Stress pass: 20 full projection updates + select/clear rewrites, timed.
  const runStress = (): void => {
    if (handle === undefined) {
      return;
    }
    const durations: number[] = [];
    for (let round = 0; round < 20; round += 1) {
      const start = performance.now();
      handle.update(projection);
      handle.select(round % 2 === 0 ? round % projection.nodeCount : undefined);
      durations.push(performance.now() - start);
    }
    handle.select(undefined);
    const total = durations.reduce((sum, value) => sum + value, 0);
    setStress({
      updates: durations.length,
      avgUpdateMs: Math.round((total / durations.length) * 100) / 100,
      worstUpdateMs: Math.round(Math.max(...durations) * 100) / 100,
    });
  };

  const stats = handle?.stats();

  return (
    <div className="relative h-screen w-full bg-[#111111] text-[#9ee2e2]">
      <div ref={containerRef} className="absolute inset-0" data-testid="graph3d-spike-container" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 p-3 font-mono text-xs leading-5">
        <div>graph3d spike — {preset.label}</div>
        <div>
          fps {fps.toFixed(1)} dpr {window.devicePixelRatio}
          {heapMb() === undefined ? "" : ` heap ${heapMb()}MB`}
        </div>
        {stats === undefined ? null : (
          <div>
            nodes {stats.nodeCount} edges {stats.edgeCount} labels {stats.visibleLabelCount}
          </div>
        )}
        {stress === undefined ? null : (
          <div>
            stress: {stress.updates} updates avg {stress.avgUpdateMs}ms worst {stress.worstUpdateMs}ms
          </div>
        )}
        {error === undefined ? null : <div className="text-red-400">error: {error}</div>}
      </div>
      <div className="absolute bottom-3 left-3 flex gap-2">
        {PRESETS.map((candidate, index) => (
          <button
            key={candidate.label}
            type="button"
            className={`rounded border px-2 py-1 text-xs ${index === presetIndex ? "border-cyan-400 text-cyan-300" : "border-slate-600 text-slate-300"}`}
            onClick={() => setPresetIndex(index)}
          >
            {candidate.label}
          </button>
        ))}
        <button
          type="button"
          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
          onClick={runStress}
        >
          run stress pass
        </button>
      </div>
    </div>
  );
}
