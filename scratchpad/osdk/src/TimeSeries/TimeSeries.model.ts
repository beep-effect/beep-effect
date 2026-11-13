/**
 * Time series: which series a property points at, what its points look like and how a read is windowed and aggregated.
 *
 * **Details**
 *
 * A time series property never holds its points. It holds a
 * {@link TimeSeriesReference}, and the points are read on demand through one of
 * three operations: the first point, the last point, or a stream of points
 * narrowed by a {@link TimeRange} and optionally reduced by a
 * {@link TimeSeriesAggregation}. Only the stream carries a request body
 * ({@link StreamPointsRequest}); the first and last point reads are addressed by
 * the request path alone and answer with one {@link TimeSeriesPoint}.
 *
 * Every schema here encodes to the Foundry v2 JSON exactly. The domain side
 * differs only where the wire is weaker than the idea it carries: absent keys
 * are `Option`, instants are `DateTime.Utc`, upper-case enums are lowerCamel
 * literals, and the untagged series reference is a tagged union.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";
import { Position } from "../Geo/Geo.model.ts";
import { TimestampValue } from "../Value/Value.model.ts";
import type * as DateTime from "effect/DateTime";

const $I = $ScratchpadId.create("osdk/TimeSeries/TimeSeries.model");

// -----------------------------------------------------------------------------
// Identifiers
// -----------------------------------------------------------------------------

/**
 * Identifier of one time series inside the time series store.
 *
 * **Example** (Brand a series identifier)
 *
 * ```ts import.meta.vitest name="Brand a series identifier"
 * import * as S from "effect/Schema"
 * import { SeriesId } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const verdicts = [S.is(SeriesId)(SeriesId.make("wellPressureSeriesId")), S.is(SeriesId)("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const SeriesId = S.NonEmptyString.pipe(
  S.brand("SeriesId"),
  $I.annoteSchema("SeriesId", {
    description: "Identifier of one time series inside the time series store.",
  })
);

/**
 * Runtime type of {@link SeriesId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type SeriesId = typeof SeriesId.Type;

/**
 * Resource identifier of a time series sync, the ingestion that feeds a series.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const TimeSeriesSyncRid = S.NonEmptyString.pipe(
  S.brand("TimeSeriesSyncRid"),
  $I.annoteSchema("TimeSeriesSyncRid", {
    description: "Resource identifier of a time series sync, the ingestion that feeds a series.",
  })
);

/**
 * Runtime type of {@link TimeSeriesSyncRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type TimeSeriesSyncRid = typeof TimeSeriesSyncRid.Type;

/**
 * Resource identifier of a template whose formula resolves to a derived series.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const TimeSeriesTemplateRid = S.NonEmptyString.pipe(
  S.brand("TimeSeriesTemplateRid"),
  $I.annoteSchema("TimeSeriesTemplateRid", {
    description: "Resource identifier of a template whose formula resolves to a derived series.",
  })
);

/**
 * Runtime type of {@link TimeSeriesTemplateRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type TimeSeriesTemplateRid = typeof TimeSeriesTemplateRid.Type;

/**
 * Version of a derived-series template, such as `"0.0.0"`.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const TimeSeriesTemplateVersion = S.NonEmptyString.pipe(
  S.brand("TimeSeriesTemplateVersion"),
  $I.annoteSchema("TimeSeriesTemplateVersion", {
    description: "Version of a derived-series template.",
  })
);

/**
 * Runtime type of {@link TimeSeriesTemplateVersion}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type TimeSeriesTemplateVersion = typeof TimeSeriesTemplateVersion.Type;

// -----------------------------------------------------------------------------
// Units
// -----------------------------------------------------------------------------

/**
 * Calendar-aware units of elapsed time, decoded from the wire's upper-case enum.
 *
 * **Details**
 *
 * This is the widest unit vocabulary of the ontology contract: it is the only
 * one with `quarters`, which duration group-bys use. Relative times of a series
 * read use {@link SeriesTimeUnit}, the same set without quarters. A unit is one
 * literal; the spelling variants other clients accept (`"hr"`, `"hrs"`,
 * `"hour"`) are input sugar and are not part of the model.
 *
 * **Example** (Decode a wire time unit)
 *
 * ```ts import.meta.vitest name="Decode a wire time unit"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TimeUnit } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const unit = await Effect.runPromise(S.decodeUnknownEffect(TimeUnit)("QUARTERS"))
 * unit // => "quarters"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TimeUnit = MappedLiteralKit([
  ["MILLISECONDS", "milliseconds"],
  ["SECONDS", "seconds"],
  ["MINUTES", "minutes"],
  ["HOURS", "hours"],
  ["DAYS", "days"],
  ["WEEKS", "weeks"],
  ["MONTHS", "months"],
  ["YEARS", "years"],
  ["QUARTERS", "quarters"],
]).pipe(
  $I.annoteSchema("TimeUnit", {
    description: "Calendar-aware unit of elapsed time, from milliseconds up to years and quarters.",
  })
);

/**
 * Runtime type of {@link TimeUnit}.
 *
 * @category models
 * @since 0.0.0
 */
export type TimeUnit = typeof TimeUnit.Type;

/**
 * Units a relative time of a series read may be counted in: every {@link TimeUnit} except quarters.
 *
 * **Example** (Quarters are not a series unit)
 *
 * ```ts import.meta.vitest name="Quarters are not a series unit"
 * import * as S from "effect/Schema"
 * import { SeriesTimeUnit, TimeUnit } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const verdicts = [S.is(TimeUnit)("quarters"), S.is(SeriesTimeUnit)("quarters"), S.is(SeriesTimeUnit)("days")]
 * verdicts // => [true, false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SeriesTimeUnit = TimeUnit.omit(["QUARTERS"]).pipe(
  $I.annoteSchema("SeriesTimeUnit", {
    description: "Unit a relative time of a series read may be counted in: every time unit except quarters.",
  })
);

/**
 * Runtime type of {@link SeriesTimeUnit}.
 *
 * @category models
 * @since 0.0.0
 */
export type SeriesTimeUnit = typeof SeriesTimeUnit.Type;

/**
 * Fixed-width units of duration: a day is always 24 hours and a week is always 7 days.
 *
 * **Details**
 *
 * Unlike {@link TimeUnit} there are no months or years, whose length depends
 * on the calendar, and the finest grain is the nanosecond rather than the
 * millisecond.
 *
 * **Example** (Decode a fixed-width unit)
 *
 * ```ts import.meta.vitest name="Decode a fixed-width unit"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PreciseTimeUnit } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const unit = await Effect.runPromise(S.decodeUnknownEffect(PreciseTimeUnit)("NANOSECONDS"))
 * unit // => "nanoseconds"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PreciseTimeUnit = MappedLiteralKit([
  ["NANOSECONDS", "nanoseconds"],
  ["SECONDS", "seconds"],
  ["MINUTES", "minutes"],
  ["HOURS", "hours"],
  ["DAYS", "days"],
  ["WEEKS", "weeks"],
]).pipe(
  $I.annoteSchema("PreciseTimeUnit", {
    description: "Fixed-width unit of duration: a day is always 24 hours and a week is always 7 days.",
  })
);

/**
 * Runtime type of {@link PreciseTimeUnit}.
 *
 * @category models
 * @since 0.0.0
 */
export type PreciseTimeUnit = typeof PreciseTimeUnit.Type;

// -----------------------------------------------------------------------------
// Relative time and time ranges
// -----------------------------------------------------------------------------

/**
 * Which side of the current moment a relative time lies on.
 *
 * **Example** (Branch on the direction of a relative time)
 *
 * ```ts import.meta.vitest name="Branch on the direction of a relative time"
 * import { RelativeTimeRelation } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const describe = RelativeTimeRelation.To.match({
 *   before: () => "in the past",
 *   after: () => "in the future",
 * })
 * describe("before") // => "in the past"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RelativeTimeRelation = MappedLiteralKit([
  ["BEFORE", "before"],
  ["AFTER", "after"],
]).pipe(
  $I.annoteSchema("RelativeTimeRelation", {
    description: "Which side of the current moment a relative time lies on.",
  })
);

/**
 * Runtime type of {@link RelativeTimeRelation}.
 *
 * @category models
 * @since 0.0.0
 */
export type RelativeTimeRelation = typeof RelativeTimeRelation.Type;

/**
 * A moment named by its distance from now, such as "3 days before" or "2 hours after".
 *
 * **Details**
 *
 * The server resolves the moment when it executes the read, so the same value
 * names a different instant on every request.
 *
 * **Example** (Name a moment three days ago)
 *
 * ```ts import.meta.vitest name="Name a moment three days ago"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { RelativeTime } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(RelativeTime)(RelativeTime.before(3, "days")))
 * wire // => { when: "BEFORE", value: 3, unit: "DAYS" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RelativeTime extends S.Opaque<RelativeTime, { readonly brand: unique symbol }>()(
  S.Struct({
    when: RelativeTimeRelation.annotateKey({ description: "Whether the moment lies before or after now." }),
    value: S.Finite.annotateKey({ description: "How many units away from now the moment lies." }),
    unit: SeriesTimeUnit.annotateKey({ description: "Unit the distance is counted in." }),
  }).pipe(
    $I.annoteSchema("RelativeTime", {
      description: "A moment named by its distance before or after the time the read executes.",
    })
  )
) {
  /** The moment `value` units before now. */
  static before(value: number, unit: SeriesTimeUnit): RelativeTime {
    return RelativeTime.make({ when: "before", value, unit });
  }

  /** The moment `value` units after now. */
  static after(value: number, unit: SeriesTimeUnit): RelativeTime {
    return RelativeTime.make({ when: "after", value, unit });
  }
}

const TimeRangeKind = LiteralKit(["absolute", "relative"]);

/**
 * Range between two fixed instants; the start is inclusive and the end is exclusive.
 *
 * @category models
 * @since 0.0.0
 */
export class AbsoluteTimeRange extends S.Opaque<AbsoluteTimeRange, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("absolute"),
    startTime: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "First instant included; absent means from the first point." })
    ),
    endTime: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "First instant excluded; absent means through the last point." })
    ),
  }).pipe(
    $I.annoteSchema("AbsoluteTimeRange", {
      description: "Range between two fixed instants, start inclusive and end exclusive.",
    })
  )
) {}

/**
 * Range whose bounds are distances from the moment the read executes.
 *
 * @category models
 * @since 0.0.0
 */
export class RelativeTimeRange extends S.Opaque<RelativeTimeRange, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("relative"),
    startTime: S.OptionFromOptionalKey(RelativeTime).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Where the range starts relative to now; absent means from the first point." })
    ),
    endTime: S.OptionFromOptionalKey(RelativeTime).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Where the range ends relative to now; absent means through the last point." })
    ),
  }).pipe(
    $I.annoteSchema("RelativeTimeRange", {
      description: "Range whose bounds are distances from the moment the read executes.",
    })
  )
) {}

/**
 * The window of time a series read covers, given as fixed instants or as distances from now.
 *
 * **Details**
 *
 * Either bound may be absent, and the wire accepts a range with neither: it
 * reads the same points as sending no range at all. The static constructors
 * cover the usual windows: `last` starts a distance before now, while `since`,
 * `until` and `between` fix one or both instants. Anything else is built from
 * the cases directly, such as a relative range that ends after now.
 *
 * **Example** (Read the last seven days)
 *
 * ```ts import.meta.vitest name="Read the last seven days"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TimeRange } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(TimeRange)(TimeRange.last(7, "days")))
 * wire // => { type: "relative", startTime: { when: "BEFORE", value: 7, unit: "DAYS" } }
 * ```
 *
 * **Example** (Branch on the kind of range)
 *
 * ```ts import.meta.vitest name="Branch on the kind of range"
 * import * as DateTime from "effect/DateTime"
 * import { TimeRange } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const describe = TimeRange.match({
 *   absolute: () => "fixed instants",
 *   relative: () => "distances from now",
 * })
 * const kinds = [
 *   describe(TimeRange.since(DateTime.makeUnsafe("2021-01-04T05:00:00.000Z"))),
 *   describe(TimeRange.last(1, "hours")),
 * ]
 * kinds // => ["fixed instants", "distances from now"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TimeRange = TimeRangeKind.mapMembers(() => Tuple.make(AbsoluteTimeRange, RelativeTimeRange)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("TimeRange", {
    description: "The window of time a series read covers, as fixed instants or as distances from now.",
  }),
  SchemaUtils.withStatics(() => ({
    /** Everything from `value` units before now onwards. */
    last: (value: number, unit: SeriesTimeUnit): RelativeTimeRange =>
      RelativeTimeRange.make({ startTime: O.some(RelativeTime.before(value, unit)) }),
    /** Everything from `start` (inclusive) onwards. */
    since: (start: DateTime.Utc): AbsoluteTimeRange => AbsoluteTimeRange.make({ startTime: O.some(start) }),
    /** Everything before `end` (exclusive). */
    until: (end: DateTime.Utc): AbsoluteTimeRange => AbsoluteTimeRange.make({ endTime: O.some(end) }),
    /** Everything from `start` (inclusive) up to `end` (exclusive). */
    between: (start: DateTime.Utc, end: DateTime.Utc): AbsoluteTimeRange =>
      AbsoluteTimeRange.make({ startTime: O.some(start), endTime: O.some(end) }),
  }))
);

/**
 * Runtime type of {@link TimeRange}.
 *
 * @category models
 * @since 0.0.0
 */
export type TimeRange = typeof TimeRange.Type;

// -----------------------------------------------------------------------------
// Points
// -----------------------------------------------------------------------------

/**
 * What one point of a series holds: a number for a numeric series, text for a categorical one.
 *
 * **Example** (Accept numbers and text, nothing else)
 *
 * ```ts import.meta.vitest name="Accept numbers and text, nothing else"
 * import * as S from "effect/Schema"
 * import { PointValue } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const verdicts = [S.is(PointValue)(101.3), S.is(PointValue)("OPEN"), S.is(PointValue)(true)]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PointValue = S.Union([S.Finite, S.String]).pipe(
  $I.annoteSchema("PointValue", {
    description: "What one point of a series holds: a number for a numeric series, text for a categorical one.",
  })
);

/**
 * Runtime type of {@link PointValue}.
 *
 * @category models
 * @since 0.0.0
 */
export type PointValue = typeof PointValue.Type;

/**
 * One observation of a series: an instant and the value recorded at it.
 *
 * **Details**
 *
 * The same record answers every read of a series: the first point, the last
 * point, each element of a stream and each entry of a value bank.
 *
 * **Example** (Decode a point of a numeric series)
 *
 * ```ts import.meta.vitest name="Decode a point of a numeric series"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TimeSeriesPoint } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const point = await Effect.runPromise(
 *   S.decodeUnknownEffect(TimeSeriesPoint)({ time: "2021-01-04T05:00:00Z", value: 101.3 })
 * )
 * const summary = `${DateTime.formatIso(point.time)} -> ${point.value}`
 * summary // => "2021-01-04T05:00:00.000Z -> 101.3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TimeSeriesPoint extends S.Opaque<TimeSeriesPoint, { readonly brand: unique symbol }>()(
  S.Struct({
    time: S.DateTimeUtcFromString.annotateKey({ description: "Instant the value was recorded at." }),
    value: PointValue.annotateKey({ description: "Value recorded at that instant." }),
  }).pipe(
    $I.annoteSchema("TimeSeriesPoint", {
      description: "One observation of a series: an instant and the value recorded at it.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Aggregation
// -----------------------------------------------------------------------------

/**
 * Function that reduces the points of one window to a single value.
 *
 * **Example** (Decode an aggregation method)
 *
 * ```ts import.meta.vitest name="Decode an aggregation method"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TimeSeriesAggregationMethod } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const method = await Effect.runPromise(S.decodeUnknownEffect(TimeSeriesAggregationMethod)("STANDARD_DEVIATION"))
 * method // => "standardDeviation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TimeSeriesAggregationMethod = MappedLiteralKit([
  ["SUM", "sum"],
  ["MEAN", "mean"],
  ["STANDARD_DEVIATION", "standardDeviation"],
  ["MAX", "max"],
  ["MIN", "min"],
  ["PERCENT_CHANGE", "percentChange"],
  ["DIFFERENCE", "difference"],
  ["PRODUCT", "product"],
  ["COUNT", "count"],
  ["FIRST", "first"],
  ["LAST", "last"],
]).pipe(
  $I.annoteSchema("TimeSeriesAggregationMethod", {
    description: "Function that reduces the points of one window to a single value.",
  })
);

/**
 * Runtime type of {@link TimeSeriesAggregationMethod}.
 *
 * @category models
 * @since 0.0.0
 */
export type TimeSeriesAggregationMethod = typeof TimeSeriesAggregationMethod.Type;

/**
 * Edge of a periodic window whose timestamp labels the aggregated point.
 *
 * **Example** (Decode a window edge)
 *
 * ```ts import.meta.vitest name="Decode a window edge"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { WindowEdge } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const edge = await Effect.runPromise(S.decodeUnknownEffect(WindowEdge)("START"))
 * edge // => "start"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WindowEdge = MappedLiteralKit([
  ["START", "start"],
  ["END", "end"],
]).pipe(
  $I.annoteSchema("WindowEdge", {
    description: "Edge of a periodic window whose timestamp labels the aggregated point.",
  })
);

/**
 * Runtime type of {@link WindowEdge}.
 *
 * @category models
 * @since 0.0.0
 */
export type WindowEdge = typeof WindowEdge.Type;

const preciseDurationFields = {
  value: S.Finite.annotateKey({ description: "How many units the duration spans." }),
  unit: PreciseTimeUnit.annotateKey({ description: "Fixed-width unit the span is counted in." }),
};

/**
 * A span of time of fixed width, independent of the calendar.
 *
 * **Example** (Describe a one hour span)
 *
 * ```ts import.meta.vitest name="Describe a one hour span"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PreciseDuration } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const wire = await Effect.runPromise(
 *   S.encodeEffect(PreciseDuration)(PreciseDuration.make({ value: 1, unit: "hours" }))
 * )
 * wire // => { value: 1, unit: "HOURS" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PreciseDuration extends S.Opaque<PreciseDuration, { readonly brand: unique symbol }>()(
  S.Struct(preciseDurationFields).pipe(
    $I.annoteSchema("PreciseDuration", {
      description: "A span of time of fixed width, independent of the calendar.",
    })
  )
) {}

const RollingWindowKind = LiteralKit(["duration", "pointsCount"]);

/**
 * Rolling window that reaches a fixed span of time back from each point.
 *
 * @category models
 * @since 0.0.0
 */
export class DurationWindow extends S.Opaque<DurationWindow, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("duration"), ...preciseDurationFields }).pipe(
    $I.annoteSchema("DurationWindow", {
      description: "Rolling window that reaches a fixed span of time back from each point.",
    })
  )
) {}

/**
 * Rolling window that holds a fixed number of the most recent points.
 *
 * @invariant `count` is a positive integer.
 * @category models
 * @since 0.0.0
 */
export class PointsCountWindow extends S.Opaque<PointsCountWindow, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("pointsCount"),
    count: S.Int.check(S.isGreaterThanOrEqualTo(1)).annotateKey({ description: "Number of points in each window." }),
  }).pipe(
    $I.annoteSchema("PointsCountWindow", {
      description: "Rolling window that holds a fixed number of the most recent points.",
    })
  )
) {}

/**
 * Size of a rolling window, measured in time or in points.
 *
 * **Details**
 *
 * A rolling window ends at the current point (inclusive) and reaches back by
 * its size, so every input point yields one output point.
 *
 * **Example** (Measure a rolling window in points)
 *
 * ```ts import.meta.vitest name="Measure a rolling window in points"
 * import { RollingWindow } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const describe = RollingWindow.match({
 *   duration: ({ value, unit }) => `${value} ${unit}`,
 *   pointsCount: ({ count }) => `${count} points`,
 * })
 * describe(RollingWindow.cases.pointsCount.make({ count: 5 })) // => "5 points"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RollingWindow = RollingWindowKind.mapMembers(() => Tuple.make(DurationWindow, PointsCountWindow)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("RollingWindow", {
    description: "Size of a rolling window, measured in time or in points.",
  })
);

/**
 * Runtime type of {@link RollingWindow}.
 *
 * @category models
 * @since 0.0.0
 */
export type RollingWindow = typeof RollingWindow.Type;

const AggregationStrategyKind = LiteralKit(["cumulative", "rolling", "periodic"]);

/**
 * Aggregates, for each point, every point of the series up to and including it.
 *
 * @category models
 * @since 0.0.0
 */
export class CumulativeAggregate extends S.Opaque<CumulativeAggregate, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("cumulative") }).pipe(
    $I.annoteSchema("CumulativeAggregate", {
      description: "Aggregates, for each point, every point of the series up to and including it.",
    })
  )
) {}

/**
 * Aggregates, for each point, the points inside a window that ends at it.
 *
 * @category models
 * @since 0.0.0
 */
export class RollingAggregate extends S.Opaque<RollingAggregate, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("rolling"),
    windowSize: RollingWindow.annotateKey({ description: "How far the window reaches back from each point." }),
  }).pipe(
    $I.annoteSchema("RollingAggregate", {
      description: "Aggregates, for each point, the points inside a window that ends at it.",
    })
  )
) {}

/**
 * Aggregates the series into consecutive windows of one fixed width, which downsamples it.
 *
 * **Details**
 *
 * Windows that contain no points are left out of the result.
 *
 * @category models
 * @since 0.0.0
 */
export class PeriodicAggregate extends S.Opaque<PeriodicAggregate, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("periodic"),
    windowSize: PreciseDuration,
    alignmentTimestamp: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Instant a window boundary is aligned to, when the caller pins the grid." })
    ),
    windowType: WindowEdge.annotateKey({ description: "Which edge of each window timestamps its aggregated point." }),
  }).pipe(
    $I.annoteSchema("PeriodicAggregate", {
      description: "Aggregates the series into consecutive windows of one fixed width.",
    })
  )
) {}

/**
 * How the points of a series are grouped into windows before a method reduces each window.
 *
 * **Example** (Choose a windowing strategy)
 *
 * ```ts import.meta.vitest name="Choose a windowing strategy"
 * import {
 *   PreciseDuration,
 *   RollingWindow,
 *   TimeSeriesAggregationStrategy,
 * } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const describe = TimeSeriesAggregationStrategy.match({
 *   cumulative: () => "everything so far",
 *   rolling: ({ windowSize }) => `a sliding window (${windowSize.type})`,
 *   periodic: ({ windowSize }) => `buckets of ${windowSize.value} ${windowSize.unit}`,
 * })
 * const strategies = [
 *   describe(TimeSeriesAggregationStrategy.cases.cumulative.make({})),
 *   describe(
 *     TimeSeriesAggregationStrategy.cases.rolling.make({
 *       windowSize: RollingWindow.cases.pointsCount.make({ count: 5 }),
 *     })
 *   ),
 *   describe(
 *     TimeSeriesAggregationStrategy.cases.periodic.make({
 *       windowSize: PreciseDuration.make({ value: 1, unit: "hours" }),
 *       windowType: "start",
 *     })
 *   ),
 * ]
 * strategies // => ["everything so far", "a sliding window (pointsCount)", "buckets of 1 hours"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TimeSeriesAggregationStrategy = AggregationStrategyKind.mapMembers(() =>
  Tuple.make(CumulativeAggregate, RollingAggregate, PeriodicAggregate)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("TimeSeriesAggregationStrategy", {
    description: "How the points of a series are grouped into windows before a method reduces each window.",
  })
);

/**
 * Runtime type of {@link TimeSeriesAggregationStrategy}.
 *
 * @category models
 * @since 0.0.0
 */
export type TimeSeriesAggregationStrategy = typeof TimeSeriesAggregationStrategy.Type;

/**
 * An aggregation of a series: how to window its points and how to reduce each window.
 *
 * **Example** (Downsample a series to hourly means)
 *
 * ```ts import.meta.vitest name="Downsample a series to hourly means"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import {
 *   PeriodicAggregate,
 *   PreciseDuration,
 *   TimeSeriesAggregation,
 * } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const hourlyMean = TimeSeriesAggregation.make({
 *   method: "mean",
 *   strategy: PeriodicAggregate.make({
 *     windowSize: PreciseDuration.make({ value: 1, unit: "hours" }),
 *     windowType: "end",
 *   }),
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(TimeSeriesAggregation)(hourlyMean))
 * wire // => { method: "MEAN", strategy: { type: "periodic", windowSize: { value: 1, unit: "HOURS" }, windowType: "END" } }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TimeSeriesAggregation extends S.Opaque<TimeSeriesAggregation, { readonly brand: unique symbol }>()(
  S.Struct({
    method: TimeSeriesAggregationMethod.annotateKey({ description: "How the points of one window are reduced." }),
    strategy: TimeSeriesAggregationStrategy.annotateKey({ description: "How points are grouped into windows." }),
  }).pipe(
    $I.annoteSchema("TimeSeriesAggregation", {
      description: "An aggregation of a series: how to window its points and how to reduce each window.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------------

/**
 * Serialization of a streamed response, chosen with the `format` query parameter of a stream read.
 *
 * **Details**
 *
 * `arrow` is the more efficient choice for a large response.
 *
 * **Example** (Decode a stream format)
 *
 * ```ts import.meta.vitest name="Decode a stream format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { StreamingOutputFormat } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const format = await Effect.runPromise(S.decodeUnknownEffect(StreamingOutputFormat)("ARROW"))
 * format // => "arrow"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StreamingOutputFormat = MappedLiteralKit([
  ["JSON", "json"],
  ["ARROW", "arrow"],
]).pipe(
  $I.annoteSchema("StreamingOutputFormat", {
    description: "Serialization of a streamed response: JSON, or Arrow for large responses.",
  })
);

/**
 * Runtime type of {@link StreamingOutputFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type StreamingOutputFormat = typeof StreamingOutputFormat.Type;

/**
 * Body of a read that streams the points of a time series property.
 *
 * **Details**
 *
 * With neither field the read returns every point of the series, and the body
 * is the empty object. The first and last point reads have no body at all.
 *
 * **Example** (Stream every point, or a reduced window)
 *
 * ```ts import.meta.vitest name="Stream every point, or a reduced window"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import {
 *   CumulativeAggregate,
 *   StreamPointsRequest,
 *   TimeRange,
 *   TimeSeriesAggregation,
 * } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const encode = S.encodeEffect(StreamPointsRequest)
 * const everything = await Effect.runPromise(encode(StreamPointsRequest.make({})))
 * const runningTotal = await Effect.runPromise(
 *   encode(
 *     StreamPointsRequest.make({
 *       range: O.some(TimeRange.last(7, "days")),
 *       aggregate: O.some(TimeSeriesAggregation.make({ method: "sum", strategy: CumulativeAggregate.make({}) })),
 *     })
 *   )
 * )
 * const bodies = [everything, runningTotal]
 * bodies // => [{}, { range: { type: "relative", startTime: { when: "BEFORE", value: 7, unit: "DAYS" } }, aggregate: { method: "SUM", strategy: { type: "cumulative" } } }]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StreamPointsRequest extends S.Opaque<StreamPointsRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    range: S.OptionFromOptionalKey(TimeRange).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Window of time to read; absent reads the whole series." })
    ),
    aggregate: S.OptionFromOptionalKey(TimeSeriesAggregation).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Aggregation applied before points are returned; absent returns raw points." })
    ),
  }).pipe(
    $I.annoteSchema("StreamPointsRequest", {
      description: "Body of a read that streams the points of a time series property.",
    })
  )
) {}

/**
 * Body of a read that streams the entries of a value bank, such as the positions behind a geotime series.
 *
 * **Example** (Stream the entries since an instant)
 *
 * ```ts import.meta.vitest name="Stream the entries since an instant"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { StreamValuesRequest, TimeRange } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const request = StreamValuesRequest.make({
 *   range: O.some(TimeRange.since(DateTime.makeUnsafe("2021-01-04T05:00:00.000Z"))),
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(StreamValuesRequest)(request))
 * wire // => { range: { type: "absolute", startTime: "2021-01-04T05:00:00.000Z" } }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StreamValuesRequest extends S.Opaque<StreamValuesRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    range: S.OptionFromOptionalKey(TimeRange).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Window of time to read; absent reads every entry." })
    ),
  }).pipe(
    $I.annoteSchema("StreamValuesRequest", {
      description: "Body of a read that streams the entries of a value bank.",
    })
  )
) {}

/**
 * Points answered by a stream read, in the order the server produced them.
 *
 * **Example** (Decode the points of a categorical series)
 *
 * ```ts import.meta.vitest name="Decode the points of a categorical series"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { StreamPointsResponse } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const response = await Effect.runPromise(
 *   S.decodeUnknownEffect(StreamPointsResponse)({
 *     data: [
 *       { time: "2021-01-04T05:00:00Z", value: "OPEN" },
 *       { time: "2021-01-04T06:00:00Z", value: "CLOSED" },
 *     ],
 *   })
 * )
 * const values = A.map(response.data, (point) => point.value)
 * values // => ["OPEN", "CLOSED"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StreamPointsResponse extends S.Opaque<StreamPointsResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    data: S.Array(TimeSeriesPoint).annotateKey({ description: "The points read, one per instant or per window." }),
  }).pipe(
    $I.annoteSchema("StreamPointsResponse", {
      description: "Points answered by a stream read, in the order the server produced them.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Series references
// -----------------------------------------------------------------------------

const TimeSeriesReferenceKind = LiteralKit(["series", "qualifiedSeries", "template"]);

/**
 * Reference to a series by its identifier alone; on the wire it is the bare identifier string.
 *
 * @category models
 * @since 0.0.0
 */
export class SeriesReference extends S.Opaque<SeriesReference, { readonly brand: unique symbol }>()(
  S.String.pipe(
    S.decodeTo(
      S.Struct({
        type: S.tag("series"),
        seriesId: SeriesId.annotateKey({ description: "The series the property points at." }),
      }),
      SchemaTransformation.transform({
        decode: (seriesId) => ({ type: TimeSeriesReferenceKind.Enum.series, seriesId }),
        encode: ({ seriesId }) => seriesId,
      })
    ),
    $I.annoteSchema("SeriesReference", {
      description: "Reference to a series by its identifier alone.",
    })
  )
) {}

/**
 * Reference to a series fed by several syncs, which names the sync as well as the series.
 *
 * @category models
 * @since 0.0.0
 */
export class QualifiedSeriesReference extends S.Opaque<QualifiedSeriesReference, { readonly brand: unique symbol }>()(
  S.Struct({ seriesId: S.String, syncRid: S.String }).pipe(
    S.decodeTo(
      S.Struct({
        type: S.tag("qualifiedSeries"),
        seriesId: SeriesId.annotateKey({ description: "The series the property points at." }),
        syncRid: TimeSeriesSyncRid.annotateKey({ description: "The sync that feeds the series." }),
      }),
      SchemaTransformation.transform({
        decode: (wire) => ({ type: TimeSeriesReferenceKind.Enum.qualifiedSeries, ...wire }),
        encode: ({ seriesId, syncRid }) => ({ seriesId, syncRid }),
      })
    ),
    $I.annoteSchema("QualifiedSeriesReference", {
      description: "Reference to a series fed by several syncs, naming the sync as well as the series.",
    })
  )
) {}

/**
 * Reference to a derived series, computed by a template's formula rather than stored.
 *
 * @category models
 * @since 0.0.0
 */
export class TemplateSeriesReference extends S.Opaque<TemplateSeriesReference, { readonly brand: unique symbol }>()(
  S.Struct({ templateRid: S.String, templateVersion: S.optionalKey(S.String) }).pipe(
    S.decodeTo(
      S.Struct({
        type: S.tag("template"),
        templateRid: TimeSeriesTemplateRid.annotateKey({ description: "The template that computes the series." }),
        templateVersion: S.OptionFromOptionalKey(TimeSeriesTemplateVersion).pipe(
          S.withConstructorDefault(Effect.succeedNone),
          S.annotateKey({ description: "Version of the template, when the reference pins one." })
        ),
      }),
      SchemaTransformation.transform({
        decode: (wire) => ({ type: TimeSeriesReferenceKind.Enum.template, ...wire }),
        encode: ({ type: _type, ...wire }) => wire,
      })
    ),
    $I.annoteSchema("TemplateSeriesReference", {
      description: "Reference to a derived series, computed by a template's formula rather than stored.",
    })
  )
) {}

/**
 * Which series a time series property points at, decoded from the three untagged shapes the wire uses.
 *
 * **Details**
 *
 * The wire value is a bare series identifier, a `{ seriesId, syncRid }` record
 * or a `{ templateRid, templateVersion? }` record, with nothing naming which
 * one it is. Each case of this union is a codec for exactly one of those
 * shapes and adds the `type` tag on the way in, so domain code matches on the
 * tag and the encoded value is still the untagged wire shape. The same value
 * is what an action sends to repoint a time series property; that changes
 * which series the property references, never the series' points.
 *
 * **Example** (Decode the three wire shapes of a series reference)
 *
 * ```ts import.meta.vitest name="Decode the three wire shapes of a series reference"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TimeSeriesReference } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const decode = S.decodeUnknownEffect(TimeSeriesReference)
 * const references = await Effect.runPromise(
 *   Effect.all([
 *     decode("wellPressureSeriesId"),
 *     decode({ seriesId: "wellPressureSeriesId", syncRid: "ri.time-series-catalog.main.sync.1" }),
 *     decode({ templateRid: "ri.codex-emu.main.template.1", templateVersion: "0.0.0" }),
 *   ])
 * )
 * const tags = A.map(references, (reference) => reference.type)
 * tags // => ["series", "qualifiedSeries", "template"]
 * ```
 *
 * **Example** (Encode a series reference back to its bare identifier)
 *
 * ```ts import.meta.vitest name="Encode a series reference back to its bare identifier"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SeriesId, TimeSeriesReference } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const reference = TimeSeriesReference.cases.series.make({ seriesId: SeriesId.make("wellPressureSeriesId") })
 * const wire = await Effect.runPromise(S.encodeEffect(TimeSeriesReference)(reference))
 * wire // => "wellPressureSeriesId"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const TimeSeriesReference = TimeSeriesReferenceKind.mapMembers(() =>
  Tuple.make(SeriesReference, QualifiedSeriesReference, TemplateSeriesReference)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("TimeSeriesReference", {
    description: "Which series a time series property points at: a stored series, a synced series or a template.",
  })
);

/**
 * Runtime type of {@link TimeSeriesReference}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type TimeSeriesReference = typeof TimeSeriesReference.Type;

// -----------------------------------------------------------------------------
// Geotime series
// -----------------------------------------------------------------------------

/**
 * Where a tracked entity was at one instant: the value a geotime series reference resolves to.
 *
 * **Details**
 *
 * This is the record the wire tags `geotimeSeriesValue`, both as the value
 * loaded alongside an object and as the payload of a subscription update that
 * dereferences the property.
 *
 * **Example** (Decode the latest position of a tracked entity)
 *
 * ```ts import.meta.vitest name="Decode the latest position of a tracked entity"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GeotimeSeriesValue } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const value = await Effect.runPromise(
 *   S.decodeUnknownEffect(GeotimeSeriesValue)({
 *     type: "geotimeSeriesValue",
 *     position: [102.0, 0.5],
 *     timestamp: "2021-01-04T05:00:00Z",
 *   })
 * )
 * const summary = `${value.position[0]}, ${value.position[1]} at ${DateTime.formatIso(value.timestamp)}`
 * summary // => "102, 0.5 at 2021-01-04T05:00:00.000Z"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GeotimeSeriesValue extends S.Opaque<GeotimeSeriesValue, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("geotimeSeriesValue"),
    position: Position.annotateKey({
      description: "Longitude then latitude in decimal degrees, and optionally altitude in metres.",
    }),
    timestamp: TimestampValue.annotateKey({ description: "Instant the entity was at the position." }),
  }).pipe(
    $I.annoteSchema("GeotimeSeriesValue", {
      description: "Where a tracked entity was at one instant: the value a geotime series reference resolves to.",
    })
  )
) {}
