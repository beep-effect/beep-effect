/**
 * Dev-only cosmos.gl viability spike screen.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */

import { CosmosBackend, CosmosGraphProjection, CosmosRenderHandle, renderCosmosGraph } from "@beep/cosmos/browser";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LogRedactedCauseOptions, logRedactedCause, redactCauseForClient } from "@beep/observability/CauseRedaction";
import { Fn } from "@beep/schema/Fn";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Button } from "@beep/ui/components/button";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import { thunkNull } from "@beep/utils/thunk";
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import * as BrowserWorker from "@effect/platform-browser/BrowserWorker";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import { reportedBrowserFailureAtoms } from "@/runtime/BrowserFailure.atoms";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import { CosmosSpikeRpcs, SyntheticProjectionCount, SyntheticProjectionNodeCount } from "./CosmosSpike.rpc.ts";
import { fpsSampleAtoms } from "./Fps.atoms.ts";
import type { JSX } from "react";

const $I = $ProfessionalDesktopId.create("spikes/CosmosSpike");

const CosmosWorkerInitializationErrorFields = {
  cause: S.Unknown,
  message: S.NonEmptyString,
} satisfies S.Struct.Fields;
const CosmosWorkerInitializationErrorEquivalenceFields = {
  message: CosmosWorkerInitializationErrorFields.message,
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameCosmosWorkerInitializationErrorFields = S.toEquivalence(
  S.TaggedStruct("CosmosWorkerInitializationError", CosmosWorkerInitializationErrorEquivalenceFields)
);
const sameCosmosWorkerInitializationError = (
  self: CosmosWorkerInitializationError,
  that: CosmosWorkerInitializationError
): boolean => sameCosmosWorkerInitializationErrorFields(self, that);

/**
 * Failure raised when the Cosmos spike projection worker cannot initialize.
 *
 * **Example** (Create a worker initialization failure)
 *
 * ```ts
 * import { CosmosWorkerInitializationError } from "@/spikes/CosmosSpike"
 *
 * const error = CosmosWorkerInitializationError.make({
 *   cause: new Error("worker unavailable"),
 *   message: "The graph worker could not start."
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CosmosWorkerInitializationError extends S.TaggedError<CosmosWorkerInitializationError>(
  $I`CosmosWorkerInitializationError`
)(
  "CosmosWorkerInitializationError",
  CosmosWorkerInitializationErrorFields,
  $I.annoteClass<
    S.declare<CosmosWorkerInitializationError>,
    readonly [S.TaggedStruct<"CosmosWorkerInitializationError", typeof CosmosWorkerInitializationErrorFields>]
  >("CosmosWorkerInitializationError", {
    description: "The Cosmos spike projection worker could not be initialized.",
    toEquivalence: () => sameCosmosWorkerInitializationError,
  })
) {}

/**
 * Headless probe contract exposed by a mounted Cosmos spike.
 *
 * **Example** (Constructing probe contract)
 *
 * ```ts
 * import { CosmosSpikeProbeContract } from "@/spikes/CosmosSpike"
 *
 * const probe = CosmosSpikeProbeContract.make({
 *   backend: "cosmos",
 *   elementCount: 1_000,
 *   fps: () => 60,
 *   projectedEdgeCount: 500,
 *   projectedNodeCount: 500
 * })
 * console.log(probe.backend) // "cosmos"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CosmosSpikeProbeContract extends S.Class<CosmosSpikeProbeContract>($I`CosmosSpikeProbeContract`)(
  {
    backend: CosmosBackend,
    elementCount: SyntheticProjectionNodeCount,
    foldLevel: S.tag("L3"),
    fps: Fn({ output: S.Finite }),
    projectedEdgeCount: SyntheticProjectionCount,
    projectedNodeCount: SyntheticProjectionNodeCount,
  },
  $I.annote("CosmosSpikeProbeContract", {
    description: "Headless probe contract exposed by the mounted Cosmos spike.",
  })
) {}

const SpikeSizeLabel = LiteralKit(["1k", "10k", "100k"]).pipe(
  $I.annoteSchema("SpikeSizeLabel", {
    description: "Supported synthetic graph size preset.",
  })
);
type SpikeSizeLabel = typeof SpikeSizeLabel.Type;

/**
 * Synthetic graph dimensions for one Cosmos spike preset.
 *
 * **Example** (Making size preset)
 *
 * ```ts
 * import { CosmosSpikeSize } from "@/spikes/CosmosSpike"
 *
 * const size = CosmosSpikeSize.make({
 *   edgeCount: 500,
 *   elementCount: 1_000,
 *   label: "1k",
 *   nodeCount: 500
 * })
 * console.log(size.elementCount) // 1000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CosmosSpikeSize extends S.Class<CosmosSpikeSize>($I`CosmosSpikeSize`)(
  {
    edgeCount: SyntheticProjectionCount,
    elementCount: SyntheticProjectionNodeCount,
    label: SpikeSizeLabel,
    nodeCount: SyntheticProjectionNodeCount,
  },
  $I.annote("CosmosSpikeSize", {
    description: "Node and edge counts for a synthetic Cosmos spike preset.",
  })
) {}

class CosmosSpikeStatusFailed extends S.Class<CosmosSpikeStatusFailed>($I`CosmosSpikeStatusFailed`)(
  {
    state: S.tag("failed"),
    message: S.NonEmptyString,
  },
  $I.annote("CosmosSpikeStatusFailed", {
    description: "Cosmos spike state after worker or renderer failure.",
  })
) {}

class CosmosSpikeStatusReady extends S.Class<CosmosSpikeStatusReady>($I`CosmosSpikeStatusReady`)(
  {
    state: S.tag("ready"),
    backend: CosmosBackend,
    handle: CosmosRenderHandle,
    setupDuration: S.Duration,
  },
  $I.annote("CosmosSpikeStatusReady", {
    description: "Cosmos spike state with an active renderer handle.",
  })
) {}

class CosmosSpikeStatusRendering extends S.Class<CosmosSpikeStatusRendering>($I`CosmosSpikeStatusRendering`)(
  { state: S.tag("rendering") },
  $I.annote("CosmosSpikeStatusRendering", {
    description: "Cosmos spike state while projection and renderer setup are in flight.",
  })
) {}

const CosmosSpikeState = LiteralKit(["rendering", "ready", "failed"]).pipe(
  $I.annoteSchema("CosmosSpikeState", {
    description: "Lifecycle variants for the Cosmos spike renderer.",
  })
);

/**
 * Exhaustive lifecycle state for the Cosmos spike renderer.
 *
 * **Example** (Creating rendering status)
 *
 * ```ts
 * import { CosmosSpikeStatus } from "@/spikes/CosmosSpike"
 *
 * const status = CosmosSpikeStatus.cases.rendering.make()
 * console.log(CosmosSpikeStatus.guards.rendering(status)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CosmosSpikeStatus = CosmosSpikeState.mapMembers(
  Tuple.evolve([() => CosmosSpikeStatusRendering, () => CosmosSpikeStatusReady, () => CosmosSpikeStatusFailed])
).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("CosmosSpikeStatus", {
    description: "Exhaustive lifecycle state for the Cosmos spike.",
  })
);

/**
 * Runtime type for {@link CosmosSpikeStatus}.
 *
 * @category models
 * @since 0.0.0
 */
type CosmosSpikeStatus = typeof CosmosSpikeStatus.Type;

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

const spikeSizeFor = (label: SpikeSizeLabel): CosmosSpikeSize =>
  SpikeSizeLabel.$match(label, {
    "1k": () => CosmosSpikeSize.make({ label: "1k", elementCount: 1_000, nodeCount: 500, edgeCount: 500 }),
    "10k": () => CosmosSpikeSize.make({ label: "10k", elementCount: 10_000, nodeCount: 5_000, edgeCount: 5_000 }),
    "100k": () => CosmosSpikeSize.make({ label: "100k", elementCount: 100_000, nodeCount: 50_000, edgeCount: 50_000 }),
  });

const spikeSizes = A.map(SpikeSizeLabel.Options, spikeSizeFor);
const spikeSizeEquivalence = S.toEquivalence(CosmosSpikeSize);
const initialSpikeSize = pipe(
  S.decodeUnknownOption(InitialSpikeSizeLabel)(import.meta.env.VITE_COSMOS_SPIKE_SIZE),
  O.map(spikeSizeFor),
  O.getOrElse(() => spikeSizeFor(SpikeSizeLabel.Enum["1k"]))
);
const renderingStatus: CosmosSpikeStatus = CosmosSpikeStatus.cases.rendering.make();

declare global {
  interface Window {
    __COSMOS_SPIKE__?: CosmosSpikeProbeContract;
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
  elementCount: SyntheticProjectionNodeCount,
  projectedNodeCount: SyntheticProjectionNodeCount,
  projectedEdgeCount: SyntheticProjectionCount
): void => {
  const runtimeWindow = globalThis.window;

  if (!P.isUndefined(runtimeWindow)) {
    runtimeWindow.__COSMOS_SPIKE__ = CosmosSpikeProbeContract.make({
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
    Effect.try({
      try: () => new Worker(new URL("./CosmosSpike.worker.ts", import.meta.url), { type: "module" }),
      catch: (cause) =>
        CosmosWorkerInitializationError.make({
          cause,
          message: "The graph projection worker could not be initialized.",
        }),
    }),
    (worker) => Effect.sync(() => worker.terminate())
  ).pipe(Effect.map((worker) => BrowserWorker.layer(() => worker)))
);

const CosmosRpcProtocolLive = RpcClient.layerProtocolWorker({ size: 1 }).pipe(Layer.provide(CosmosWorkerLive));
const cosmosSpikeRuntime = professionalBrowserRuntime.factory(CosmosRpcProtocolLive);
const decodeSpikeContainer = S.decodeUnknownOption(SpikeContainer);

const sizeAtom = Atom.make(initialSpikeSize);
const containerAtom = Atom.make<O.Option<HTMLDivElement>>(O.none());

const selectCosmosSpikeSizeAtom = professionalBrowserRuntime.fn<CosmosSpikeSize>()(
  Effect.fn("professional_desktop.cosmos_spike.select_size")(function* (size, ctx) {
    ctx.set(sizeAtom, size);
  })
);

const setCosmosSpikeContainerAtom = professionalBrowserRuntime.fn<HTMLDivElement | null>()(
  Effect.fn("professional_desktop.cosmos_spike.set_container")(function* (element, ctx) {
    ctx.set(containerAtom, pipe(decodeSpikeContainer(element), O.flatten));
  })
);

const renderSpike = Effect.fn("professional_desktop.cosmos_spike.render")(function* (
  container: HTMLDivElement,
  size: CosmosSpikeSize
) {
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

  return CosmosSpikeStatus.cases.ready.make({
    backend: handle.backend,
    handle,
    setupDuration: Duration.nanos(finishedAt - startedAt),
  });
});

const statusAtom = cosmosSpikeRuntime.atom<CosmosSpikeStatus, never>(
  (get) =>
    O.match(get(containerAtom), {
      onNone: () => Effect.succeed(renderingStatus),
      onSome: (container) =>
        renderSpike(container, get(sizeAtom)).pipe(
          Effect.catchCause((cause) =>
            logRedactedCause(
              cause,
              LogRedactedCauseOptions.make({
                message: "cosmos spike renderer failed",
                level: "Error",
                attributes: { subsystem: "cosmos_spike" },
              })
            ).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  clearSpikeContract();
                  return CosmosSpikeStatus.cases.failed.make({ message: redactCauseForClient(cause).message });
                })
              )
            )
          )
        ),
    }),
  { initialValue: renderingStatus }
);

const fpsAtom = Atom.readable((get) => {
  const status = AsyncResult.match(get(statusAtom), {
    onInitial: () => renderingStatus,
    onFailure: ({ cause }) =>
      CosmosSpikeStatus.cases.failed.make({
        message: redactCauseForClient(cause).message,
      }),
    onSuccess: ({ value }) => value,
  });

  return CosmosSpikeStatus.guards.ready(status) ? get(fpsSampleAtoms(status.handle)) : 0;
});

const backendLabelFor = (status: CosmosSpikeStatus): string =>
  CosmosSpikeStatus.match(status, {
    rendering: () => "rendering",
    ready: ({ backend }) => backend,
    failed: () => "failed",
  });

const setupLabelFor = (status: CosmosSpikeStatus): string =>
  CosmosSpikeStatus.match(status, {
    rendering: () => "pending",
    ready: ({ setupDuration }) => `${Duration.toMillis(setupDuration).toFixed(1)} ms`,
    failed: () => "pending",
  });

const failureMessageFor = (status: CosmosSpikeStatus): O.Option<string> =>
  CosmosSpikeStatus.match(status, {
    rendering: O.none<string>,
    ready: O.none<string>,
    failed: ({ message }) => O.some(message),
  });

const CosmosRuntimeFailureReporter = ({ cause }: { readonly cause: unknown }): null => {
  useAtomMount(reportedBrowserFailureAtoms("cosmos_spike")(cause));
  return null;
};

/**
 * Dev-only cosmos.gl and WebKitGTK viability spike screen.
 *
 * **Example** (Accessing component name)
 *
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
  const setSize = useAtomSet(selectCosmosSpikeSizeAtom);
  const setContainer = useAtomSet(setCosmosSpikeContainerAtom);
  const statusResult = useAtomValue(statusAtom);
  const runtimeFailure = AsyncResult.cause(statusResult);
  const status = AsyncResult.match(statusResult, {
    onInitial: () => renderingStatus,
    onFailure: ({ cause }) =>
      CosmosSpikeStatus.cases.failed.make({
        message: redactCauseForClient(cause).message,
      }),
    onSuccess: ({ value }) => value,
  });
  const fps = useAtomValue(fpsAtom);
  const failureMessage = failureMessageFor(status);

  return (
    <div className="flex h-screen min-h-0 w-full flex-col bg-background text-foreground">
      {O.match(runtimeFailure, {
        onNone: thunkNull,
        onSome: (cause) => <CosmosRuntimeFailureReporter cause={cause} />,
      })}
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
              variant={spikeSizeEquivalence(candidate, size) ? "default" : "outline"}
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
          <span className="font-mono">{CosmosSpikeStatus.guards.ready(status) ? fps.toFixed(1) : "0.0"}</span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={setContainer} className="h-full w-full bg-background" />
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
