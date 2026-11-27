/**
 * Coarsened process metrics for the practice KG host: CPU and resident set
 * size sampled every 10 seconds, folded into 5-minute windows, floored to 5%
 * CPU and 32 MiB RSS steps, and recorded on the two allowlisted gauges.
 *
 * **Details**
 *
 * No disk I/O counter is read or recorded. The recorded values pass through
 * the strict gate like every other metric, which floors them again onto its
 * value ladder.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeKgMcpId } from "@beep/identity/packages";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import { PracticeKgProcessCpu, PracticeKgProcessRss } from "../telemetry/PracticeKgTelemetry.instruments.ts";

const $I = $PracticeKgMcpId.create("runtime/ProcessMetrics");

const ProcessSampleInterval: Duration.Duration = Duration.seconds(10);
const ProcessMetricsWindow: Duration.Duration = Duration.minutes(5);

const cpuStepPercent = 5;
const rssStepBytes = 32 * 1024 * 1024;
const windowMillis = Duration.toMillis(ProcessMetricsWindow);
const microsPerMilli = 1_000;

const NonNegative = S.Finite.check(S.isGreaterThanOrEqualTo(0));
// A thousand cores at full load, and 256 TiB: far past any host, well inside
// exact float arithmetic.
const maxCpuPercent = 100_000;
const maxRssBytes = 2 ** 48;
const WindowCpuPercent = S.Finite.check(S.isBetween({ minimum: 0, maximum: maxCpuPercent }));
const WindowRssBytes = S.Int.check(S.isBetween({ minimum: 0, maximum: maxRssBytes }));

/**
 * One raw reading of the host process: cumulative CPU time (user plus
 * system) in microseconds and the resident set size in bytes.
 *
 * **Example** (Make a reading)
 *
 * ```ts
 * import { ProcessReading } from "../../src/runtime/ProcessMetrics.ts"
 *
 * console.log(ProcessReading.make({ cpuMicros: 1_500, rssBytes: 64 }).rssBytes) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessReading extends S.Opaque<ProcessReading, { readonly brand: unique symbol }>()(
  S.Struct({
    cpuMicros: NonNegative,
    rssBytes: NonNegative,
  }).pipe(
    $I.annoteSchema("ProcessReading", {
      description: "Raw host process reading: cumulative CPU microseconds and resident set bytes.",
    })
  )
) {}

/**
 * **Example** (Make a sample)
 *
 * ```ts
 * import { ProcessSample } from "../../src/runtime/ProcessMetrics.ts"
 *
 * console.log(ProcessSample.make({ atMillis: 10_000, cpuMicros: 0, rssBytes: 0 }).atMillis) // 10000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessSample extends S.Opaque<ProcessSample, { readonly brand: unique symbol }>()(
  S.Struct({
    atMillis: S.Natural,
    cpuMicros: NonNegative,
    rssBytes: NonNegative,
  }).pipe(
    $I.annoteSchema("ProcessSample", {
      description: "Host process reading stamped with the clock time it was taken at.",
    })
  )
) {}

/**
 * One closed 5-minute window: mean CPU use as a percent of one core and the
 * largest resident set size, both raw (not yet coarsened).
 *
 * **Example** (Make a window)
 *
 * ```ts
 * import { ProcessWindow } from "../../src/runtime/ProcessMetrics.ts"
 *
 * console.log(ProcessWindow.make({ windowStartMillis: 0, cpuPercent: 12.5, rssBytes: 1 }).cpuPercent) // 12.5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessWindow extends S.Opaque<ProcessWindow, { readonly brand: unique symbol }>()(
  S.Struct({
    windowStartMillis: S.Natural,
    cpuPercent: WindowCpuPercent,
    rssBytes: WindowRssBytes,
  }).pipe(
    $I.annoteSchema("ProcessWindow", {
      description: "Closed 5-minute process window: mean CPU percent of one core and largest resident set bytes.",
    })
  )
) {}

/**
 * **Details**
 *
 * `previous` is the last sample taken; CPU time and wall time accumulate over
 * the intervals that end inside the open window, and `rssBytes` is the
 * largest resident set size sampled in it.
 *
 * **Example** (The empty state)
 *
 * ```ts
 * import { ProcessWindowState } from "../../src/runtime/ProcessMetrics.ts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(ProcessWindowState.initial.previous)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessWindowState extends S.Opaque<ProcessWindowState, { readonly brand: unique symbol }>()(
  S.Struct({
    previous: S.Option(ProcessSample),
    windowStartMillis: S.Natural,
    cpuMicros: NonNegative,
    wallMicros: NonNegative,
    rssBytes: NonNegative,
  }).pipe(
    $I.annoteSchema("ProcessWindowState", {
      description: "Running fold of the open process-metrics window: last sample, CPU and wall time, peak RSS.",
    })
  )
) {
  /** The state before the first sample. */
  static readonly initial: ProcessWindowState = ProcessWindowState.make({
    previous: O.none(),
    windowStartMillis: 0,
    cpuMicros: 0,
    wallMicros: 0,
    rssBytes: 0,
  });
}

/**
 * Floors a CPU percent to a 5% step; a negative value reads as `0`.
 *
 * **Example** (Coarsen two percents)
 *
 * ```ts
 * import { coarsenCpuPercent } from "../../src/runtime/ProcessMetrics.ts"
 *
 * console.log(coarsenCpuPercent(37.9)) // 35
 * console.log(coarsenCpuPercent(4.99)) // 0
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const coarsenCpuPercent = (percent: number): number =>
  Math.max(0, Math.floor(percent / cpuStepPercent) * cpuStepPercent);

/**
 * Floors a resident set size to a 32 MiB step; a negative value reads as
 * `0`.
 *
 * **Example** (Coarsen a resident set size)
 *
 * ```ts
 * import { coarsenRssBytes } from "../../src/runtime/ProcessMetrics.ts"
 *
 * console.log(coarsenRssBytes(100 * 1024 * 1024)) // 100663296
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const coarsenRssBytes = (bytes: number): number => Math.max(0, Math.floor(bytes / rssStepBytes) * rssStepBytes);

const windowStartOf = (atMillis: number): number => Math.floor(atMillis / windowMillis) * windowMillis;

const closeWindow = (state: ProcessWindowState): ProcessWindow =>
  ProcessWindow.make({
    windowStartMillis: state.windowStartMillis,
    cpuPercent: Math.min(maxCpuPercent, state.wallMicros > 0 ? (100 * state.cpuMicros) / state.wallMicros : 0),
    rssBytes: Math.min(maxRssBytes, Math.floor(state.rssBytes)),
  });

/**
 * Folds one sample into the window state, returning the next state and the
 * window the sample closed, if any.
 *
 * **Details**
 *
 * The interval from the previous sample counts toward the window the sample
 * falls in. A sample in a later window than the open one closes the open
 * window first. The first sample only opens a window.
 *
 * **Example** (Close a window)
 *
 * ```ts
 * import { ProcessSample, ProcessWindowState, stepProcessWindow } from "../../src/runtime/ProcessMetrics.ts"
 * import * as O from "effect/Option"
 *
 * const [opened] = stepProcessWindow(
 *   ProcessWindowState.initial,
 *   ProcessSample.make({ atMillis: 0, cpuMicros: 0, rssBytes: 10 })
 * )
 * const [, closed] = stepProcessWindow(opened, ProcessSample.make({ atMillis: 300_000, cpuMicros: 0, rssBytes: 10 }))
 * console.log(O.isSome(closed)) // true
 * ```
 *
 * @param state - The open window.
 * @param sample - The new sample.
 * @category combinators
 * @since 0.0.0
 */
export const stepProcessWindow: {
  (sample: ProcessSample): (state: ProcessWindowState) => readonly [ProcessWindowState, O.Option<ProcessWindow>];
  (state: ProcessWindowState, sample: ProcessSample): readonly [ProcessWindowState, O.Option<ProcessWindow>];
} = dual(
  2,
  (state: ProcessWindowState, sample: ProcessSample): readonly [ProcessWindowState, O.Option<ProcessWindow>] => {
    const windowStartMillis = windowStartOf(sample.atMillis);
    const interval = O.match(state.previous, {
      onNone: () => ({ cpuMicros: 0, wallMicros: 0 }),
      onSome: (previous) => ({
        cpuMicros: Math.max(0, sample.cpuMicros - previous.cpuMicros),
        wallMicros: Math.max(0, sample.atMillis - previous.atMillis) * microsPerMilli,
      }),
    });
    const opensWindow = O.isNone(state.previous) || windowStartMillis > state.windowStartMillis;
    const closed = O.isSome(state.previous) && opensWindow ? O.some(closeWindow(state)) : O.none<ProcessWindow>();
    const next = ProcessWindowState.make(
      opensWindow
        ? {
            previous: O.some(sample),
            windowStartMillis,
            cpuMicros: interval.cpuMicros,
            wallMicros: interval.wallMicros,
            rssBytes: sample.rssBytes,
          }
        : {
            previous: O.some(sample),
            windowStartMillis: state.windowStartMillis,
            cpuMicros: state.cpuMicros + interval.cpuMicros,
            wallMicros: state.wallMicros + interval.wallMicros,
            rssBytes: Math.max(state.rssBytes, sample.rssBytes),
          }
    );
    return [next, closed];
  }
);

/**
 * Reads the host process. Production reads Bun's `process.cpuUsage()` and
 * `process.memoryUsage.rss()`; tests provide scripted readings.
 *
 * **Example** (Provide a fixed reading)
 *
 * ```ts
 * import { ProcessReading, ProcessSampler } from "../../src/runtime/ProcessMetrics.ts"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const fixed = Layer.succeed(
 *   ProcessSampler,
 *   ProcessSampler.of({ read: Effect.succeed(ProcessReading.make({ cpuMicros: 0, rssBytes: 0 })) })
 * )
 * console.log(Layer.isLayer(fixed)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ProcessSampler extends Context.Service<
  ProcessSampler,
  {
    readonly read: Effect.Effect<ProcessReading>;
  }
>()($I`ProcessSampler`) {}

/**
 * The production sampler: cumulative user plus system CPU time and the
 * resident set size of the running process.
 *
 * **Example** (Reference the Bun sampler)
 *
 * ```ts
 * import { layerBunProcessSampler } from "../../src/runtime/ProcessMetrics.ts"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerBunProcessSampler)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerBunProcessSampler: Layer.Layer<ProcessSampler> = Layer.succeed(
  ProcessSampler,
  ProcessSampler.of({
    read: Effect.sync(() => {
      const cpu = process.cpuUsage();
      return ProcessReading.make({ cpuMicros: cpu.user + cpu.system, rssBytes: process.memoryUsage.rss() });
    }),
  })
);

/**
 * Gauge the coarsened CPU percent of each closed window is recorded on.
 *
 * **Example** (Read the gauge value)
 *
 * ```ts
 * import { processCpuGauge } from "../../src/runtime/ProcessMetrics.ts"
 * import * as Effect from "effect/Effect"
 * import * as Metric from "effect/Metric"
 *
 * console.log(Effect.isEffect(Metric.value(processCpuGauge))) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const processCpuGauge = Metric.gauge(PracticeKgProcessCpu.name, {
  description: PracticeKgProcessCpu.description,
});

/**
 * Gauge the coarsened peak resident set size of each closed window is
 * recorded on.
 *
 * **Example** (Read the gauge value)
 *
 * ```ts
 * import { processRssGauge } from "../../src/runtime/ProcessMetrics.ts"
 * import * as Effect from "effect/Effect"
 * import * as Metric from "effect/Metric"
 *
 * console.log(Effect.isEffect(Metric.value(processRssGauge))) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const processRssGauge = Metric.gauge(PracticeKgProcessRss.name, {
  description: PracticeKgProcessRss.description,
});

const recordWindow = (window: ProcessWindow): Effect.Effect<void> =>
  Effect.all(
    [
      Metric.update(processCpuGauge, coarsenCpuPercent(window.cpuPercent)),
      Metric.update(processRssGauge, coarsenRssBytes(window.rssBytes)),
    ],
    { concurrency: 1 }
  ).pipe(Effect.asVoid);

/**
 * Samples the host every 10 seconds for as long as the layer lives and
 * records each closed 5-minute window on the CPU and RSS gauges, coarsened
 * to 5% and 32 MiB steps.
 *
 * **Example** (Sample with the Bun sampler)
 *
 * ```ts
 * import { layerBunProcessSampler, layerPracticeKgProcessMetrics } from "../../src/runtime/ProcessMetrics.ts"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerPracticeKgProcessMetrics.pipe(Layer.provide(layerBunProcessSampler)))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerPracticeKgProcessMetrics: Layer.Layer<never, never, ProcessSampler> = Layer.effectDiscard(
  Effect.gen(function* () {
    const sampler = yield* ProcessSampler;
    const state = yield* Ref.make(ProcessWindowState.initial);
    const tick = Effect.gen(function* () {
      const atMillis = yield* Clock.currentTimeMillis;
      const reading = yield* sampler.read;
      const sample = ProcessSample.make({ atMillis, cpuMicros: reading.cpuMicros, rssBytes: reading.rssBytes });
      const closed = yield* Ref.modify(state, (current) => {
        const [next, window] = stepProcessWindow(current, sample);
        return [window, next] as const;
      });
      yield* O.match(closed, { onNone: () => Effect.void, onSome: recordWindow });
    });
    yield* Effect.forkScoped(Effect.repeat(tick, Schedule.spaced(ProcessSampleInterval)));
  })
);
