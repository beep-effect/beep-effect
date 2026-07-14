/**
 * Dev-only cosmos.gl viability spike screen.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */

import { ClientObservabilityLive } from "@beep/agents-client";
import { CosmosBackend, CosmosGraphProjection, CosmosRenderHandle, renderCosmosGraph } from "@beep/cosmos";
import { $ProfessionalDesktopId } from "@beep/identity";
import { Fn, LiteralKit, SchemaUtils } from "@beep/schema";
import { Button } from "@beep/ui/components/button";
import { O, P, pipe, thunkNull } from "@beep/utils";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as BrowserWorker from "@effect/platform-browser/BrowserWorker";
import { Cause, Clock, Duration, Effect, Layer, Match } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import { CosmosSpikeRpcs } from "./CosmosSpike.rpc.ts";
import type { JSX } from "react";

const $I = $ProfessionalDesktopId.create("spikes/CosmosSpike");

class SpikeProbeContract extends S.Class<SpikeProbeContract>($I`SpikeProbeContract`)(
  {
    backend: CosmosBackend,
    elementCount: S.Finite,
    foldLevel: S.tag("L3"),
    fps: Fn({ output: S.Finite }),
    projectedEdgeCount: S.Finite,
    projectedNodeCount: S.Finite,
  },
  $I.annote("SpikeProbeContract", {
    description: "Headless probe contract exposed by the mounted Cosmos spike.",
  })
) {}

const SpikeSizeLabel = LiteralKit(["1k", "10k", "100k"]).pipe(
  $I.annoteSchema("SpikeSizeLabel", {
    description: "Supported synthetic graph size preset.",
  })
);
type SpikeSizeLabel = typeof SpikeSizeLabel.Type;

class SpikeSize extends S.Class<SpikeSize>($I`SpikeSize`)(
  {
    edgeCount: S.Finite,
    elementCount: S.Finite,
    label: SpikeSizeLabel,
    nodeCount: S.Finite,
  },
  $I.annote("SpikeSize", {
    description: "Node and edge counts for a synthetic Cosmos spike preset.",
  })
) {}

class SpikeStatusFailed extends S.Class<SpikeStatusFailed>($I`SpikeStatusFailed`)(
  {
    state: S.tag("failed"),
    message: S.String,
  },
  $I.annote("SpikeStatusFailed", {
    description: "Cosmos spike state after worker or renderer failure.",
  })
) {}

class SpikeStatusReady extends S.Class<SpikeStatusReady>($I`SpikeStatusReady`)(
  {
    state: S.tag("ready"),
    backend: CosmosBackend,
    handle: CosmosRenderHandle,
    setupDuration: S.Duration,
  },
  $I.annote("SpikeStatusReady", {
    description: "Cosmos spike state with an active renderer handle.",
  })
) {}

class SpikeStatusRendering extends S.Class<SpikeStatusRendering>($I`SpikeStatusRendering`)(
  { state: S.tag("rendering") },
  $I.annote("SpikeStatusRendering", {
    description: "Cosmos spike state while projection and renderer setup are in flight.",
  })
) {}

const SpikeStatus = S.Union([SpikeStatusFailed, SpikeStatusReady, SpikeStatusRendering]).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("SpikeStatus", {
    description: "Exhaustive lifecycle state for the Cosmos spike.",
  })
);
type SpikeStatus = typeof SpikeStatus.Type;
const isSpikeStatusFailed = S.is(SpikeStatusFailed);
const isSpikeStatusReady = S.is(SpikeStatusReady);

const SpikeContainer = S.OptionFromNullishOr(S.instanceOf(HTMLDivElement)).pipe(
  SchemaUtils.withNoneDefault,
  $I.annoteSchema("SpikeContainer", {
    description: "Optional mounted DOM container decoded from a React callback ref boundary.",
  })
);

const InitialSpikeSizeLabel = SpikeSizeLabel.pipe(
  S.withDecodingDefault(Effect.succeed(SpikeSizeLabel.Enum["1k"])),
  $I.annoteSchema("InitialSpikeSizeLabel", {
    description: "Vite-provided spike size label with the 1k schema default.",
  })
);

const spikeSizeFor = (label: SpikeSizeLabel): SpikeSize =>
  SpikeSizeLabel.$match(label, {
    "1k": () => SpikeSize.make({ label: "1k", elementCount: 1_000, nodeCount: 500, edgeCount: 500 }),
    "10k": () => SpikeSize.make({ label: "10k", elementCount: 10_000, nodeCount: 5_000, edgeCount: 5_000 }),
    "100k": () => SpikeSize.make({ label: "100k", elementCount: 100_000, nodeCount: 50_000, edgeCount: 50_000 }),
  });

const spikeSizes = A.map(SpikeSizeLabel.Options, spikeSizeFor);
const initialSpikeSize = pipe(
  S.decodeUnknownOption(InitialSpikeSizeLabel)(import.meta.env.VITE_COSMOS_SPIKE_SIZE),
  O.map(spikeSizeFor),
  O.getOrElse(() => spikeSizeFor(SpikeSizeLabel.Enum["1k"]))
);
const renderingStatus: SpikeStatus = SpikeStatusRendering.make({});

declare global {
  interface Window {
    __COSMOS_SPIKE__?: SpikeProbeContract;
  }
}

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
    runtimeWindow.__COSMOS_SPIKE__ = SpikeProbeContract.make({
      backend: handle.backend,
      fps: handle.fps,
      elementCount,
      projectedNodeCount,
      projectedEdgeCount,
    });
  }
};

const CosmosWorkerLive = Layer.unwrap(
  Effect.acquireRelease(
    Effect.sync(() => new Worker(new URL("./CosmosSpike.worker.ts", import.meta.url), { type: "module" })),
    (worker) => Effect.sync(() => worker.terminate())
  ).pipe(Effect.map((worker) => BrowserWorker.layer(() => worker)))
);

const CosmosRpcProtocolLive = RpcClient.layerProtocolWorker({ size: 1 }).pipe(Layer.provide(CosmosWorkerLive));
const cosmosSpikeFactory = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() });
cosmosSpikeFactory.addGlobalLayer(ClientObservabilityLive);
const cosmosSpikeRuntime = cosmosSpikeFactory(CosmosRpcProtocolLive);

const sizeAtom = Atom.make(initialSpikeSize);
const containerAtom = Atom.make<O.Option<HTMLDivElement>>(O.none());

const renderSpike = Effect.fn("CosmosSpike.render")(function* (container: HTMLDivElement, size: SpikeSize) {
  const client = yield* RpcClient.make(CosmosSpikeRpcs);
  const startedAt = yield* Clock.currentTimeNanos;
  const response = yield* client.ProjectSyntheticGraph({
    nodeCount: size.nodeCount,
    edgeCount: size.edgeCount,
  });
  const projection = CosmosGraphProjection.make({
    nodeCount: response.projection.nodeCount,
    edgeCount: response.projection.edgeCount,
    nodeIds: response.projection.nodeIds,
    pointPositions: response.projection.pointPositions,
    links: response.projection.links,
  });

  yield* Effect.sync(() => {
    container.replaceChildren();
    clearSpikeContract();
  });
  const handle = yield* renderCosmosGraph(container, projection);
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      handle.destroy();
      clearSpikeContract();
    })
  );
  const finishedAt = yield* Clock.currentTimeNanos;

  yield* Effect.sync(() =>
    setProjectedSpikeContract(
      handle,
      response.elementCount,
      response.projection.nodeCount,
      response.projection.edgeCount
    )
  );

  return SpikeStatusReady.make({
    backend: handle.backend,
    handle,
    setupDuration: Duration.nanos(finishedAt - startedAt),
  });
});

const statusAtom = cosmosSpikeRuntime.atom<SpikeStatus, never>(
  (get) =>
    O.match(get(containerAtom), {
      onNone: () => Effect.succeed(renderingStatus),
      onSome: (container) =>
        renderSpike(container, get(sizeAtom)).pipe(
          Effect.catchCause((cause) =>
            Effect.sync(() => {
              clearSpikeContract();
              return SpikeStatusFailed.make({ message: Cause.pretty(cause) });
            })
          )
        ),
    }),
  { initialValue: renderingStatus }
);

const fpsAtom = Atom.readable((get) => {
  const status = pipe(
    AsyncResult.value(get(statusAtom)),
    O.getOrElse(() => renderingStatus)
  );

  if (!isSpikeStatusReady(status) || !P.isFunction(globalThis.requestAnimationFrame)) {
    return 0;
  }

  const frame = { active: true, id: 0 };
  const tick = (): void => {
    get.setSelf(status.handle.fps());
    if (frame.active) {
      frame.id = globalThis.requestAnimationFrame(tick);
    }
  };

  frame.id = globalThis.requestAnimationFrame(tick);
  get.addFinalizer(() => {
    frame.active = false;
    if (P.isFunction(globalThis.cancelAnimationFrame)) {
      globalThis.cancelAnimationFrame(frame.id);
    }
  });

  return 0;
});

const backendLabelFor = Match.type<SpikeStatus>().pipe(
  Match.when(isSpikeStatusFailed, () => "failed"),
  Match.when(isSpikeStatusReady, (status) => status.backend),
  Match.orElse(() => "rendering")
);

const setupLabelFor = Match.type<SpikeStatus>().pipe(
  Match.when(isSpikeStatusReady, (status) => `${Duration.toMillis(status.setupDuration).toFixed(1)} ms`),
  Match.orElse(() => "pending")
);

const failureMessageFor = Match.type<SpikeStatus>().pipe(
  Match.when(isSpikeStatusFailed, (status) => O.some(status.message)),
  Match.orElse(O.none<string>)
);

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
  const size = useAtomValue(sizeAtom);
  const setSize = useAtomSet(sizeAtom);
  const setContainer = useAtomSet(containerAtom);
  const status = pipe(
    AsyncResult.value(useAtomValue(statusAtom)),
    O.getOrElse(() => renderingStatus)
  );
  const fps = useAtomValue(fpsAtom);
  const failureMessage = failureMessageFor(status);

  return (
    <div className="flex h-screen min-h-0 w-full flex-col bg-background text-foreground">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-sm font-semibold">Cosmos WebKitGTK Spike</div>
          <div className="rounded border px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {backendLabelFor(status)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {A.map(spikeSizes, (candidate) => (
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
          <span className="font-mono">{setupLabelFor(status)}</span>
        </div>
        <div className="flex flex-col justify-center px-3">
          <span className="text-xs text-muted-foreground">FPS</span>
          <span className="font-mono">{isSpikeStatusReady(status) ? fps.toFixed(1) : "0.0"}</span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={(container) => setContainer(pipe(S.decodeUnknownOption(SpikeContainer)(container), O.flatten))}
          className="h-full w-full bg-background"
        />
        {O.match(failureMessage, {
          onNone: thunkNull,
          onSome: (message) => (
            <div className="absolute inset-x-4 top-4 rounded-md border border-destructive/40 bg-background p-3 text-sm text-destructive shadow-sm">
              {message}
            </div>
          ),
        })}
      </div>
    </div>
  );
}
