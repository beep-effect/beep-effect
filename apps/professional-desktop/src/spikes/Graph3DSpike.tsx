/**
 * WebKitGTK viability spike for the graph-3d driver (goal graph-3d-view P2).
 *
 * Mounts the instanced three.js renderer on synthetic data inside the desktop
 * webview and reports sustained framerate, projection-update cost, and
 * selection-rewrite cost — the acceptance evidence the design gate deferred to
 * the target webview. Reached with `?graph3d-spike` in dev mode, mirroring the
 * cosmos spike's flag pattern.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */

import {
  Graph3DRenderHandle,
  Graph3DRenderOptions,
  generateSyntheticGraph3DProjection,
  renderGraph3D,
  SyntheticGraph3DOptions,
} from "@beep/graph-3d/browser";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LogRedactedCauseOptions, logRedactedCause, redactCauseForClient } from "@beep/observability/CauseRedaction";
import { PosInt } from "@beep/schema/Int";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { NonNegativeInt } from "@beep/schema/Number";
import * as A from "@beep/utils/Array";
import * as N from "@beep/utils/Number";
import * as O from "@beep/utils/Option";
import { thunkEmptyStr, thunkNull } from "@beep/utils/thunk";
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import { fpsSampleAtoms } from "./Fps.atoms.ts";
import type { JSX } from "react";

const $I = $ProfessionalDesktopId.create("spikes/Graph3DSpike");

class StressPreset extends S.Class<StressPreset>($I`StressPreset`)(
  {
    label: S.NonEmptyString,
    nodeCount: NonNegativeInt,
    edgeCount: NonNegativeInt,
  },
  $I.annote("StressPreset", {
    description: "Synthetic graph dimensions used by one Graph3D stress preset.",
  })
) {
  static readonly equivalence = S.toEquivalence(StressPreset);

  static readonly default = StressPreset.make({
    label: "2.5k / 5k",
    nodeCount: NonNegativeInt.make(2_500),
    edgeCount: NonNegativeInt.make(5_000),
  });

  static readonly presets: ReadonlyArray<StressPreset> = [
    StressPreset.make({
      label: "1k / 2k",
      nodeCount: NonNegativeInt.make(1_000),
      edgeCount: NonNegativeInt.make(2_000),
    }),
    StressPreset.default,
    StressPreset.make({
      label: "2.5k / 12.5k",
      nodeCount: NonNegativeInt.make(2_500),
      edgeCount: NonNegativeInt.make(12_500),
    }),
    StressPreset.make({
      label: "5k / 10k",
      nodeCount: NonNegativeInt.make(5_000),
      edgeCount: NonNegativeInt.make(10_000),
    }),
  ];
}

class StressReport extends S.Class<StressReport>($I`StressReport`)(
  {
    avgUpdateMs: S.DurationFromMillis,
    updates: PosInt,
    worstUpdateMs: S.DurationFromMillis,
  },
  $I.annote("StressReport", {
    description: "Measured projection-update latency from one Graph3D stress pass.",
  })
) {}

class BrowserHeapMemory extends S.Class<BrowserHeapMemory>($I`BrowserHeapMemory`)(
  {
    usedJSHeapSize: NonNegativeInt,
  },
  $I.annote("BrowserHeapMemory", {
    description: "Chromium-specific browser heap measurement when the performance extension is available.",
  })
) {}

class BrowserPerformance extends S.Class<BrowserPerformance>($I`BrowserPerformance`)(
  {
    memory: S.OptionFromOptionalKey(BrowserHeapMemory),
  },
  $I.annote("BrowserPerformance", {
    description: "Browser performance boundary with an optional Chromium heap measurement.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(BrowserPerformance);
}

class Graph3DSpikeRendering extends S.Class<Graph3DSpikeRendering>($I`Graph3DSpikeRendering`)(
  { state: S.tag("rendering") },
  $I.annote("Graph3DSpikeRendering", {
    description: "The graph-3d spike renderer is mounting.",
  })
) {}

class Graph3DSpikeReady extends S.Class<Graph3DSpikeReady>($I`Graph3DSpikeReady`)(
  {
    state: S.tag("ready"),
    handle: Graph3DRenderHandle,
  },
  $I.annote("Graph3DSpikeReady", {
    description: "The graph-3d spike renderer is mounted and ready.",
  })
) {}

class Graph3DSpikeFailed extends S.Class<Graph3DSpikeFailed>($I`Graph3DSpikeFailed`)(
  {
    state: S.tag("failed"),
    message: S.NonEmptyString,
  },
  $I.annote("Graph3DSpikeFailed", {
    description: "The graph-3d spike renderer failed to mount.",
  })
) {}

const Graph3DSpikeState = LiteralKit(["rendering", "ready", "failed"]).pipe(
  $I.annoteSchema("Graph3DSpikeState", {
    description: "Lifecycle variants for the graph-3d spike renderer.",
  })
);

/**
 * Exhaustive lifecycle state for the graph-3d spike renderer.
 *
 * **Example** (Creating rendering status)
 *
 * ```ts
 * import { Graph3DSpikeStatus } from "@/spikes/Graph3DSpike"
 *
 * const status = Graph3DSpikeStatus.cases.rendering.make()
 * console.log(Graph3DSpikeStatus.guards.rendering(status)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Graph3DSpikeStatus = Graph3DSpikeState.mapMembers(
  Tuple.evolve([() => Graph3DSpikeRendering, () => Graph3DSpikeReady, () => Graph3DSpikeFailed])
).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("Graph3DSpikeStatus", {
    description: "Exhaustive lifecycle state for the graph-3d spike renderer.",
  })
);

/**
 * Runtime type for the graph-3d spike lifecycle state.
 *
 * @category models
 * @since 0.0.0
 */
type Graph3DSpikeStatus = typeof Graph3DSpikeStatus.Type;

const renderingStatus: Graph3DSpikeStatus = Graph3DSpikeStatus.cases.rendering.make();

const selectedPresetAtom = Atom.make(StressPreset.default);
const stressReportAtom = Atom.make<O.Option<StressReport>>(O.none());
const projectionAtom = Atom.readable((get) => {
  const preset = get(selectedPresetAtom);
  return generateSyntheticGraph3DProjection(
    SyntheticGraph3DOptions.make({
      nodeCount: preset.nodeCount,
      edgeCount: preset.edgeCount,
      communityCount: 8,
      seed: 1_337,
    })
  );
});
const graphContainerAtom = Atom.make<O.Option<HTMLDivElement>>(O.none());

const graphStatusAtom = professionalBrowserRuntime.atom<Graph3DSpikeStatus, never>(
  (get) =>
    O.match(get(graphContainerAtom), {
      onNone: () => Effect.succeed(renderingStatus),
      onSome: (container) =>
        renderGraph3D(container, get(projectionAtom), Graph3DRenderOptions.make({})).pipe(
          Effect.tap((handle) => Effect.addFinalizer(() => Effect.sync(handle.destroy))),
          Effect.map((handle) => Graph3DSpikeStatus.cases.ready.make({ handle })),
          Effect.catchCause((cause) =>
            logRedactedCause(
              cause,
              LogRedactedCauseOptions.make({
                message: "graph-3d spike renderer failed",
                level: "Error",
                attributes: { subsystem: "graph3d_spike" },
              })
            ).pipe(
              Effect.as(
                Graph3DSpikeStatus.cases.failed.make({
                  message: redactCauseForClient(cause).message,
                })
              )
            )
          )
        ),
    }),
  { initialValue: renderingStatus }
);

const graphFpsAtom = Atom.readable((get) => {
  const status = AsyncResult.value(get(graphStatusAtom)).pipe(O.getOrElse(() => renderingStatus));
  return Graph3DSpikeStatus.guards.ready(status) ? get(fpsSampleAtoms(status.handle)) : 0;
});

const setGraphContainerAtom = professionalBrowserRuntime.fn<HTMLDivElement | null>()(
  Effect.fn("professional_desktop.graph3d_spike.set_container")(function* (container, ctx) {
    ctx.set(graphContainerAtom, O.fromNullishOr(container));
  })
);

const selectStressPresetAtom = professionalBrowserRuntime.fn<StressPreset>()(
  Effect.fn("professional_desktop.graph3d_spike.select_stress_preset")(function* (preset, ctx) {
    ctx.set(selectedPresetAtom, preset);
  })
);

const clearStressReportBindingAtom = Atom.make((get) => {
  get.subscribe(projectionAtom, () => get.set(stressReportAtom, O.none()), { immediate: true });
  return undefined;
});

const runGraphStressAtom = professionalBrowserRuntime.fn<void>()(
  Effect.fn("professional_desktop.graph3d_spike.run_stress")(function* (_, ctx) {
    const status = AsyncResult.value(ctx(graphStatusAtom)).pipe(O.getOrElse(() => renderingStatus));
    if (!Graph3DSpikeStatus.guards.ready(status)) return;
    const projection = ctx(projectionAtom);
    const durations = yield* Effect.sync(() =>
      A.makeBy(20, (round) => {
        const start = globalThis.performance.now();
        status.handle.update(projection);
        status.handle.select(
          O.some(round).pipe(
            O.filter((index) => index % 2 === 0),
            O.map((index) => index % projection.nodeCount),
            O.getOrUndefined
          )
        );
        return globalThis.performance.now() - start;
      })
    );
    yield* Effect.sync(() => status.handle.select(undefined));
    const updates = A.length(durations);
    ctx.set(
      stressReportAtom,
      O.some(
        StressReport.make({
          updates: PosInt.make(updates),
          avgUpdateMs: Duration.millis(N.round(N.sumAll(durations) / updates, 2)),
          worstUpdateMs: Duration.millis(N.round(A.reduce(durations, 0, N.max), 2)),
        })
      )
    );
  })
);

const heapMb = (): O.Option<number> =>
  pipe(
    BrowserPerformance.decodeOption(globalThis.performance),
    O.flatMap((performance) => performance.memory),
    O.map((memory) => N.round(memory.usedJSHeapSize / 1_048_576, 0))
  );

/**
 * Full-screen benchmark surface: preset scale buttons, an fps/heap/stats HUD,
 * and a timed stress pass of twenty projection updates with select/clear
 * rewrites.
 *
 * **Example** (Checking spike enablement)
 *
 * ```ts
 * import { Graph3DSpike } from "@/spikes/Graph3DSpike"
 *
 * // Launch the portless-wrapped graph3d-bench entry, then open the spike surface:
 * //   http://graph3d-bench.beep.localhost:1355/?graph3d-spike   (or VITE_GRAPH3D_SPIKE=1)
 * const flag = new URLSearchParams("?graph3d-spike").has("graph3d-spike")
 *
 * console.log(flag && typeof Graph3DSpike === "function") // true
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Graph3DSpike(): JSX.Element {
  const preset = useAtomValue(selectedPresetAtom);
  const selectPreset = useAtomSet(selectStressPresetAtom);
  const stress = useAtomValue(stressReportAtom);
  const status = AsyncResult.value(useAtomValue(graphStatusAtom)).pipe(O.getOrElse(() => renderingStatus));
  const setContainer = useAtomSet(setGraphContainerAtom);
  const runStress = useAtomSet(runGraphStressAtom);
  const fps = useAtomValue(graphFpsAtom);
  const maybeHandle = Graph3DSpikeStatus.guards.ready(status) ? O.some(status.handle) : O.none();
  const stats = O.map(maybeHandle, (current) => current.stats());
  const heap = heapMb();
  const error = Graph3DSpikeStatus.match(status, {
    rendering: O.none<string>,
    ready: O.none<string>,
    failed: ({ message }) => O.some(message),
  });
  useAtomMount(clearStressReportBindingAtom);

  return (
    <div className="relative h-screen w-full bg-[#111111] text-[#9ee2e2]">
      <div ref={setContainer} className="absolute inset-0" data-testid="graph3d-spike-container" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 p-3 font-mono text-xs leading-5">
        <div>graph3d spike — {preset.label}</div>
        <div>
          fps {fps.toFixed(1)} dpr {window.devicePixelRatio}
          {pipe(
            heap,
            O.map((megabytes) => ` heap ${megabytes}MB`),
            O.getOrElse(thunkEmptyStr)
          )}
        </div>
        {O.match(stats, {
          onNone: thunkNull,
          onSome: (current) => (
            <div>
              nodes {current.nodeCount} edges {current.edgeCount} labels {current.visibleLabelCount}
            </div>
          ),
        })}
        {O.match(stress, {
          onNone: thunkNull,
          onSome: (report) => (
            <div>
              stress: {report.updates} updates avg {Duration.toMillis(report.avgUpdateMs)}ms worst{" "}
              {Duration.toMillis(report.worstUpdateMs)}ms
            </div>
          ),
        })}
        {O.match(error, {
          onNone: thunkNull,
          onSome: (message) => <div className="text-red-400">error: {message}</div>,
        })}
      </div>
      <div className="absolute bottom-3 left-3 flex gap-2">
        {A.map(StressPreset.presets, (candidate) => (
          <button
            key={candidate.label}
            type="button"
            className={`rounded border px-2 py-1 text-xs ${StressPreset.equivalence(candidate, preset) ? "border-cyan-400 text-cyan-300" : "border-slate-600 text-slate-300"}`}
            onClick={() => selectPreset(candidate)}
          >
            {candidate.label}
          </button>
        ))}
        <button
          type="button"
          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
          onClick={() => runStress(void 0)}
        >
          run stress pass
        </button>
      </div>
    </div>
  );
}
