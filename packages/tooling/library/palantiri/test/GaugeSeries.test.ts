import { replaceGaugeSeries } from "@beep/palantiri";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric";
import * as Result from "effect/Result";

const seriesOf = (name: string) =>
  Effect.map(Metric.snapshot, (snapshot) =>
    A.filterMap(snapshot, (metric) =>
      metric.id === name ? Result.succeed([{ ...metric.attributes }, metric.state] as const) : Result.failVoid
    )
  );

// Read twice: both providers fresh, then only anthropic.
const freshThenStale = Effect.fnUntraced(function* (gauge: Metric.Gauge<number>) {
  yield* replaceGaugeSeries(gauge, [
    [{ "beep.provider": "anthropic" }, 60],
    [{ "beep.provider": "openai" }, 40],
  ]);
  yield* replaceGaugeSeries(gauge, [[{ "beep.provider": "anthropic" }, 55]]);
  return yield* seriesOf(gauge.id);
});

describe("replaceGaugeSeries", () => {
  it.effect("keeps the fresh series and drops the stale one", () =>
    Effect.gen(function* () {
      const series = yield* freshThenStale(Metric.gauge("beep.test.plain"));
      expect(series).toEqual([[{ "beep.provider": "anthropic" }, { value: 55 }]]);
    }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()))
  );

  it.effect("matches series recorded under ambient metric attributes", () =>
    Effect.gen(function* () {
      const series = yield* freshThenStale(Metric.gauge("beep.test.ambient"));
      expect(series).toEqual([[{ "service.name": "beep-palantiri-mcp", "beep.provider": "anthropic" }, { value: 55 }]]);
    }).pipe(
      Effect.provideService(Metric.CurrentMetricAttributes, { "service.name": "beep-palantiri-mcp" }),
      Effect.provideService(Metric.MetricRegistry, new Map())
    )
  );

  it.effect("matches series of a gauge with its own attributes", () =>
    Effect.gen(function* () {
      const series = yield* freshThenStale(Metric.gauge("beep.test.base", { attributes: { "beep.window": "weekly" } }));
      expect(series).toEqual([[{ "beep.window": "weekly", "beep.provider": "anthropic" }, { value: 55 }]]);
    }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()))
  );

  it.effect("clears the gauge on an empty reading list", () =>
    Effect.gen(function* () {
      const gauge = Metric.gauge("beep.test.cleared", { attributes: { "beep.window": "weekly" } });
      yield* replaceGaugeSeries(gauge, [[{ "beep.provider": "anthropic" }, 60]]);
      yield* replaceGaugeSeries(gauge, []);
      const seriesOf1 = yield* seriesOf(gauge.id);
      expect(seriesOf1).toEqual([]);
    }).pipe(
      Effect.provideService(Metric.CurrentMetricAttributes, { "service.name": "beep-palantiri-mcp" }),
      Effect.provideService(Metric.MetricRegistry, new Map())
    )
  );
});
