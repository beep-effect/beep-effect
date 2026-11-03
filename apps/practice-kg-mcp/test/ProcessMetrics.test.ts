import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as TestClock from "effect/testing/TestClock";
import {
  coarsenCpuPercent,
  coarsenRssBytes,
  layerPracticeKgProcessMetrics,
  ProcessReading,
  ProcessSample,
  ProcessSampler,
  ProcessWindow,
  ProcessWindowState,
  processCpuGauge,
  processRssGauge,
  stepProcessWindow,
} from "../src/runtime/ProcessMetrics.ts";
import {
  PracticeKgProcessCpu,
  PracticeKgProcessRss,
  PracticeKgTelemetryInstruments,
} from "../src/telemetry/PracticeKgTelemetry.instruments.ts";

const mebibyte = 1024 * 1024;
const cpuStep = 5;
const rssStep = 32 * mebibyte;

// A sampler that plays `script` in order and repeats its last reading.
const scriptedSampler = (script: A.NonEmptyReadonlyArray<ProcessReading>): Layer.Layer<ProcessSampler> =>
  Layer.effect(
    ProcessSampler,
    Effect.gen(function* () {
      const next = yield* Ref.make(0);
      return ProcessSampler.of({
        read: Ref.getAndUpdate(next, (index) => index + 1).pipe(
          Effect.map((index) => O.getOrElse(A.get(script, index), () => A.lastNonEmpty(script)))
        ),
      });
    })
  );

// 23% of one core (2.3 s of CPU per 10 s) and a resident set that peaks at
// 100 MiB in the first window, then 1 GiB in the second.
const script = A.prepend(
  A.makeBy(60, (index) =>
    ProcessReading.make({
      cpuMicros: (index + 1) * 2_300_000,
      rssBytes: index < 28 ? (60 + index) * mebibyte : index === 28 ? 100 * mebibyte : 1024 * mebibyte,
    })
  ),
  ProcessReading.make({ cpuMicros: 0, rssBytes: 40 * mebibyte })
);

const gauges = Effect.all([Metric.value(processCpuGauge), Metric.value(processRssGauge)]).pipe(
  Effect.map(([cpu, rss]) => [cpu.value, rss.value])
);

describe("practice KG process metrics", () => {
  it.effect("declares exactly the CPU and RSS gauges, with no labels and no disk I/O counter", () =>
    Effect.sync(() => {
      expect(PracticeKgTelemetryInstruments.instruments).toEqual([PracticeKgProcessCpu, PracticeKgProcessRss]);
      for (const gauge of [PracticeKgProcessCpu, PracticeKgProcessRss]) {
        expect([gauge.kind, gauge.attributes]).toEqual(["gauge", []]);
      }
    })
  );

  // A registry of its own: coverage runs files unisolated, so the default
  // registry may already hold these gauges from another file's host.
  it.effect("samples every 10 seconds and records one coarsened value per closed 5-minute window", () =>
    Effect.gen(function* () {
      yield* Layer.build(layerPracticeKgProcessMetrics.pipe(Layer.provide(scriptedSampler(script))));
      yield* TestClock.adjust(Duration.millis(Duration.toMillis(Duration.minutes(5)) - 10_000));
      // The first window is still open: nothing is recorded yet.
      const gauges1 = yield* gauges;
      expect(gauges1).toEqual([0, 0]);
      yield* TestClock.adjust(Duration.seconds(10));
      const gauges2 = yield* gauges;
      expect(gauges2).toEqual([20, 96 * mebibyte]);
      yield* TestClock.adjust(Duration.minutes(5));
      const gauges3 = yield* gauges;
      expect(gauges3).toEqual([20, 1024 * mebibyte]);
    }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()))
  );

  it.effect("closes a window when a sample lands in a later one, counting the interval toward the later one", () =>
    Effect.sync(() => {
      const sample = (atMillis: number, cpuMicros: number, rssBytes: number) =>
        ProcessSample.make({ atMillis, cpuMicros, rssBytes });
      const [first, none] = stepProcessWindow(ProcessWindowState.initial, sample(290_000, 0, 10));
      assertNone(none);
      const [second, closed] = stepProcessWindow(first, sample(310_000, 5_000_000, 70));
      expect(O.getOrUndefined(closed)).toEqual({ windowStartMillis: 0, cpuPercent: 0, rssBytes: 10 });
      expect([second.windowStartMillis, second.cpuMicros, second.wallMicros, second.rssBytes]).toEqual([
        300_000, 5_000_000, 20_000_000, 70,
      ]);
      const [, next] = stepProcessWindow(sample(600_000, 5_000_000, 0))(second);
      expect(O.getOrUndefined(next)).toEqual({ windowStartMillis: 300_000, cpuPercent: 25, rssBytes: 70 });
    })
  );

  it.effect.prop(
    "floors every window to a 5% and a 32 MiB step without rounding up past the raw value",
    [Arbitrary.schema(ProcessWindow)],
    ([window]) =>
      Effect.sync(() => {
        const cpu = coarsenCpuPercent(window.cpuPercent);
        const rss = coarsenRssBytes(window.rssBytes);
        expect([cpu % cpuStep, rss % rssStep]).toEqual([0, 0]);
        expect(cpu - window.cpuPercent).toBeLessThanOrEqual(1e-9);
        expect(window.cpuPercent - cpu).toBeLessThan(cpuStep);
        expect(rss).toBeLessThanOrEqual(window.rssBytes);
        expect(window.rssBytes - rss).toBeLessThan(rssStep);
      }),
    { arbitrary: fcRuns(50) }
  );
});
