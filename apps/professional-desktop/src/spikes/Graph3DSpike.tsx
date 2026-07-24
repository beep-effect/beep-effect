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
 * @category spikes
 * @since 0.0.0
 */
import { generateSyntheticGraph3DProjection, SyntheticGraph3DOptions } from "@beep/graph-3d";
import { useGraph3DFps, useGraph3DHandle } from "@beep/graph-3d/react";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { A, N, O, pipe, thunkNull, thunkVoid } from "@beep/utils";
import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { Duration } from "effect";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
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
) {}

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

const DEFAULT_PRESET = StressPreset.make({
  label: "2.5k / 5k",
  nodeCount: NonNegativeInt.make(2_500),
  edgeCount: NonNegativeInt.make(5_000),
});
const stressPresetEquivalence = S.toEquivalence(StressPreset);
const PRESETS = [
  StressPreset.make({
    label: "1k / 2k",
    nodeCount: NonNegativeInt.make(1_000),
    edgeCount: NonNegativeInt.make(2_000),
  }),
  DEFAULT_PRESET,
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

const selectedPresetAtom = Atom.make(DEFAULT_PRESET);
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
 * @example
 * ```ts
 * // Launch the portless-wrapped graph3d-bench entry, then open the spike surface:
 * //   http://graph3d-bench.beep.localhost:1355/?graph3d-spike   (or VITE_GRAPH3D_SPIKE=1)
 * const flag = new URLSearchParams("?graph3d-spike").has("graph3d-spike")
 *
 * console.log(flag) // true
 * ```
 *
 * @category spikes
 * @since 0.0.0
 */
export function Graph3DSpike(): JSX.Element {
  const preset = useAtomValue(selectedPresetAtom);
  const setPreset = useAtomSet(selectedPresetAtom);
  const stress = useAtomValue(stressReportAtom);
  const setStress = useAtomSet(stressReportAtom);
  const projection = useAtomValue(projectionAtom);

  const { containerRef, handle, error } = useGraph3DHandle(projection);
  const fps = useGraph3DFps(handle);
  const maybeHandle = O.fromUndefinedOr(handle);
  const stats = O.map(maybeHandle, (current) => current.stats());
  const heap = heapMb();

  // A remount (new handle) invalidates any stress report from the old one.
  useAtomSubscribe(projectionAtom, () => setStress(O.none()), { immediate: true });

  // Stress pass: 20 full projection updates + select/clear rewrites, timed.
  const runStress = (): void =>
    O.match(maybeHandle, {
      onNone: thunkVoid,
      onSome: (current) => {
        const durations = A.makeBy(20, (round) => {
          const start = globalThis.performance.now();
          current.update(projection);
          current.select(
            pipe(
              O.some(round),
              O.filter((index) => index % 2 === 0),
              O.map((index) => index % projection.nodeCount),
              O.getOrUndefined
            )
          );
          return globalThis.performance.now() - start;
        });
        current.select(O.getOrUndefined(O.none<number>()));
        const updates = A.length(durations);
        setStress(
          O.some(
            StressReport.make({
              updates: PosInt.make(updates),
              avgUpdateMs: Duration.millis(N.round(N.sumAll(durations) / updates, 2)),
              worstUpdateMs: Duration.millis(N.round(A.reduce(durations, 0, N.max), 2)),
            })
          )
        );
      },
    });

  return (
    <div className="relative h-screen w-full bg-[#111111] text-[#9ee2e2]">
      <div ref={containerRef} className="absolute inset-0" data-testid="graph3d-spike-container" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 p-3 font-mono text-xs leading-5">
        <div>graph3d spike — {preset.label}</div>
        <div>
          fps {fps.toFixed(1)} dpr {window.devicePixelRatio}
          {pipe(
            heap,
            O.map((megabytes) => ` heap ${megabytes}MB`),
            O.getOrElse(() => "")
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
        {O.match(O.fromUndefinedOr(error), {
          onNone: thunkNull,
          onSome: (message) => <div className="text-red-400">error: {message}</div>,
        })}
      </div>
      <div className="absolute bottom-3 left-3 flex gap-2">
        {A.map(PRESETS, (candidate) => (
          <button
            key={candidate.label}
            type="button"
            className={`rounded border px-2 py-1 text-xs ${stressPresetEquivalence(candidate, preset) ? "border-cyan-400 text-cyan-300" : "border-slate-600 text-slate-300"}`}
            onClick={() => setPreset(candidate)}
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
