/**
 * Dev-only cosmos.gl viability spike screen.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */

import { CosmosGraphProjection, renderCosmosGraph } from "@beep/cosmos";
import { Button } from "@beep/ui/components/button";
import { P, Str } from "@beep/utils";
import { Effect } from "effect";
import { useEffect, useRef, useState } from "react";
import type { CosmosBackend, CosmosRenderHandle } from "@beep/cosmos";
import type { JSX } from "react";
import type { SyntheticProjectionResponse } from "./CosmosSpike.worker.ts";

type SpikeProbeContract = {
  readonly backend: CosmosBackend;
  readonly elementCount: number;
  readonly foldLevel: "L3";
  readonly fps: () => number;
  readonly projectedEdgeCount: number;
  readonly projectedNodeCount: number;
};

type SpikeSize = {
  readonly edgeCount: number;
  readonly elementCount: number;
  readonly label: string;
  readonly nodeCount: number;
};

type SpikeStatus =
  | {
      readonly state: "failed";
      readonly message: string;
    }
  | {
      readonly state: "ready";
      readonly backend: CosmosBackend;
      readonly handle: CosmosRenderHandle;
      readonly setupMs: number;
    }
  | {
      readonly state: "rendering";
    };

declare global {
  interface Window {
    __COSMOS_SPIKE__?: SpikeProbeContract;
  }
}

const spikeSizes: ReadonlyArray<SpikeSize> = [
  { label: "1k", elementCount: 1_000, nodeCount: 500, edgeCount: 500 },
  { label: "10k", elementCount: 10_000, nodeCount: 5_000, edgeCount: 5_000 },
  { label: "100k", elementCount: 100_000, nodeCount: 50_000, edgeCount: 50_000 },
];

// Tauri's devUrl carries no query string, so headless WebKitGTK probing picks
// the initial size via env (VITE_COSMOS_SPIKE_SIZE=1k|10k|100k).
const initialSpikeSize = (): SpikeSize =>
  spikeSizes.find((candidate) => candidate.label === import.meta.env.VITE_COSMOS_SPIKE_SIZE) ?? spikeSizes[0];

const unknownMessage = (cause: unknown): string =>
  P.hasProperty(cause, "message") && P.isString(cause.message) ? cause.message : "Cosmos spike render failed.";

const workerErrorMessage = (event: ErrorEvent): string =>
  Str.isNonEmpty(event.message) ? event.message : "Cosmos spike worker failed.";

const clearSpikeContract = (): void => {
  const runtimeWindow = globalThis.window;

  if (!P.isUndefined(runtimeWindow)) {
    delete runtimeWindow.__COSMOS_SPIKE__;
  }
};

const setProjectedSpikeContract = (
  handle: CosmosRenderHandle,
  elementCount: number,
  projectedNodeCount: number,
  projectedEdgeCount: number
): void => {
  const runtimeWindow = globalThis.window;

  if (!P.isUndefined(runtimeWindow)) {
    runtimeWindow.__COSMOS_SPIKE__ = {
      backend: handle.backend,
      fps: handle.fps,
      elementCount,
      foldLevel: "L3",
      projectedNodeCount,
      projectedEdgeCount,
    };
  }
};

/**
 * Dev-only cosmos.gl and WebKitGTK viability spike screen.
 *
 * @example
 * ```tsx
 * import { CosmosSpike } from "@/spikes/CosmosSpike"
 *
 * console.log(CosmosSpike.name)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function CosmosSpike(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(initialSpikeSize);
  const [status, setStatus] = useState<SpikeStatus>({ state: "rendering" });
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const container = containerRef.current;

    if (P.isNull(container)) {
      return undefined;
    }

    let disposed = false;
    let handle: CosmosRenderHandle | undefined;
    const worker = new Worker(new URL("./CosmosSpike.worker.ts", import.meta.url), { type: "module" });
    const startedAt = globalThis.performance.now();

    container.replaceChildren();
    clearSpikeContract();
    setFps(0);
    setStatus({ state: "rendering" });

    const failWorker = (message: string): void => {
      if (!disposed) {
        clearSpikeContract();
        setStatus({ state: "failed", message });
        worker.terminate();
      }
    };

    worker.addEventListener("error", (event) => {
      event.preventDefault();
      failWorker(workerErrorMessage(event));
    });
    worker.addEventListener("messageerror", () => {
      failWorker("Cosmos spike worker message failed to deserialize.");
    });
    worker.addEventListener("message", (event: MessageEvent<SyntheticProjectionResponse>) => {
      if (disposed) {
        return;
      }

      const projection = CosmosGraphProjection.make({
        nodeCount: event.data.projection.nodeCount,
        edgeCount: event.data.projection.edgeCount,
        nodeIds: event.data.projection.nodeIds,
        pointPositions: event.data.projection.pointPositions,
        links: event.data.projection.links,
      });

      void Effect.runPromise(renderCosmosGraph(container, projection)).then(
        (mounted) => {
          if (disposed) {
            mounted.destroy();
            return;
          }

          handle = mounted;
          const setupMs = globalThis.performance.now() - startedAt;
          setProjectedSpikeContract(
            mounted,
            event.data.elementCount,
            event.data.projection.nodeCount,
            event.data.projection.edgeCount
          );
          setStatus({
            state: "ready",
            backend: mounted.backend,
            handle: mounted,
            setupMs,
          });
        },
        (cause: unknown) => {
          if (!disposed) {
            clearSpikeContract();
            setStatus({ state: "failed", message: unknownMessage(cause) });
          }
        }
      );
    });
    worker.postMessage({ nodeCount: size.nodeCount, edgeCount: size.edgeCount, seed: 97 });

    return () => {
      disposed = true;
      worker.terminate();
      clearSpikeContract();
      if (!P.isUndefined(handle)) {
        handle.destroy();
      }
    };
  }, [size]);

  useEffect(() => {
    if (status.state !== "ready" || !P.isFunction(globalThis.requestAnimationFrame)) {
      return undefined;
    }

    let active = true;
    let frameId = 0;
    const tick = (): void => {
      setFps(status.handle.fps());
      if (active) {
        frameId = globalThis.requestAnimationFrame(tick);
      }
    };

    frameId = globalThis.requestAnimationFrame(tick);

    return () => {
      active = false;
      if (P.isFunction(globalThis.cancelAnimationFrame)) {
        globalThis.cancelAnimationFrame(frameId);
      }
    };
  }, [status]);

  const backendLabel = status.state === "ready" ? status.backend : status.state;
  const setupLabel = status.state === "ready" ? `${status.setupMs.toFixed(1)} ms` : "pending";
  const fpsLabel = status.state === "ready" ? fps.toFixed(1) : "0.0";

  return (
    <div className="flex h-screen min-h-0 w-full flex-col bg-background text-foreground">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-sm font-semibold">Cosmos WebKitGTK Spike</div>
          <div className="rounded border px-2 py-0.5 font-mono text-xs text-muted-foreground">{backendLabel}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {spikeSizes.map((candidate) => (
            <Button
              key={candidate.elementCount}
              size="sm"
              type="button"
              variant={candidate.elementCount === size.elementCount ? "default" : "outline"}
              onClick={() => setSize(candidate)}
            >
              {candidate.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid h-16 shrink-0 grid-cols-4 border-b text-sm">
        <div className="flex flex-col justify-center border-r px-3">
          <span className="text-xs text-muted-foreground">Elements</span>
          <span className="font-mono">{size.elementCount}</span>
        </div>
        <div className="flex flex-col justify-center border-r px-3">
          <span className="text-xs text-muted-foreground">Nodes / edges</span>
          <span className="font-mono">
            {size.nodeCount} / {size.edgeCount}
          </span>
        </div>
        <div className="flex flex-col justify-center border-r px-3">
          <span className="text-xs text-muted-foreground">Setup</span>
          <span className="font-mono">{setupLabel}</span>
        </div>
        <div className="flex flex-col justify-center px-3">
          <span className="text-xs text-muted-foreground">FPS</span>
          <span className="font-mono">{fpsLabel}</span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full bg-background" />
        {status.state === "failed" ? (
          <div className="absolute inset-x-4 top-4 rounded-md border border-destructive/40 bg-background p-3 text-sm text-destructive shadow-sm">
            {status.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
