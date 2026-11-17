/**
 * Replace a gauge's whole series set on every read, so a long-lived process
 * stops reporting a series whose reading is no longer fresh.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Metric from "effect/Metric";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";

const byKey: Order.Order<readonly [string, string]> = Order.mapInput(Str.Order, ([key]) => key);

const seriesKey = (attributes: Metric.Metric.AttributeSet | undefined): string =>
  pipe(
    R.toEntries(attributes ?? {}),
    A.sort(byKey),
    A.map(([key, value]) => `${key}=${value}`),
    A.join("\n")
  );

/**
 * Set one series per reading, then drop every other series of the gauge from
 * the current metric registry.
 *
 * **Details**
 *
 * A gauge keeps its last value, so a series whose reading went stale would
 * otherwise keep exporting it for the life of the process. The registry is
 * the `Map` Effect defines for `Metric.MetricRegistry` (Effect ships no
 * remove-series API); deleting an entry is how a series leaves the next
 * `Metric.snapshot`, which is what the OTLP exporter reads. Effect 4.0.4
 * stores a series under the gauge's own attributes, overlaid by the ambient
 * `Metric.CurrentMetricAttributes`, overlaid by the `withAttributes` set
 * (`Metric.ts` `hook` and `addAttributesToContext`), so the kept set is built
 * with that same merge. The new series are written before the old ones are
 * dropped, so a concurrent export never sees a fresh series missing. An empty
 * reading list clears the gauge.
 *
 * **Example** (Keep only the fresh provider's series)
 *
 * ```ts
 * import { replaceGaugeSeries } from "@beep/palantiri"
 * import * as Effect from "effect/Effect"
 * import * as Metric from "effect/Metric"
 *
 * const remaining = Metric.gauge("beep.example.remaining")
 * const program = Effect.gen(function* () {
 *   yield* replaceGaugeSeries(remaining, [[{ "beep.provider": "anthropic" }, 60], [{ "beep.provider": "openai" }, 40]])
 *   yield* replaceGaugeSeries(remaining, [[{ "beep.provider": "anthropic" }, 55]])
 *   return yield* Metric.snapshot
 * })
 * const series = Effect.runSync(Effect.provideService(program, Metric.MetricRegistry, new Map()))
 * console.log(series.map((metric) => metric.attributes?.["beep.provider"])) // ["anthropic"]
 * ```
 *
 * @param gauge - The gauge whose series set is replaced.
 * @param readings - One attribute set and value per series to keep.
 * @returns An effect that writes the readings and removes every other series of the gauge.
 * @category observability
 * @since 0.0.0
 */
export const replaceGaugeSeries = Effect.fnUntraced(function* (
  gauge: Metric.Gauge<number>,
  readings: ReadonlyArray<readonly [Metric.Metric.AttributeSet, number]>
) {
  yield* Effect.forEach(
    readings,
    ([attributes, value]) => Metric.update(Metric.withAttributes(gauge, attributes), value),
    { concurrency: 1, discard: true }
  );
  const ambient = yield* Metric.CurrentMetricAttributes;
  const kept = HashSet.fromIterable(
    A.map(readings, ([attributes]) => seriesKey({ ...gauge.attributes, ...ambient, ...attributes }))
  );
  const registry = yield* Metric.MetricRegistry;
  const dropped = A.filter(
    A.fromIterable(registry),
    ([, metadata]) => metadata.id === gauge.id && !HashSet.has(kept, seriesKey(metadata.attributes))
  );
  yield* Effect.sync(() => A.forEach(dropped, ([key]) => registry.delete(key)));
});
