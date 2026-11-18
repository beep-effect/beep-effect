import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Position } from "../src/Geo/index.ts";
import {
  AbsoluteTimeRange,
  CumulativeAggregate,
  DurationWindow,
  GeotimeSeriesValue,
  PeriodicAggregate,
  PointsCountWindow,
  PointValue,
  PreciseDuration,
  PreciseTimeUnit,
  QualifiedSeriesReference,
  RelativeTime,
  RelativeTimeRange,
  RelativeTimeRelation,
  RollingAggregate,
  RollingWindow,
  SeriesId,
  SeriesReference,
  SeriesTimeUnit,
  StreamingOutputFormat,
  StreamPointsRequest,
  StreamPointsResponse,
  StreamValuesRequest,
  TemplateSeriesReference,
  TimeRange,
  TimeSeriesAggregation,
  TimeSeriesAggregationMethod,
  TimeSeriesAggregationStrategy,
  TimeSeriesPoint,
  TimeSeriesReference,
  TimeSeriesSyncRid,
  TimeSeriesTemplateRid,
  TimeSeriesTemplateVersion,
  TimeUnit,
  WindowEdge,
} from "../src/TimeSeries/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by every named schema
// ---------------------------------------------------------------------------

const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const arbitrary = Arbitrary.schema(schema);
  const is = S.is(schema);
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  it.prop(`${name}: generated values satisfy the schema guard`, [arbitrary], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });

  it.effect.prop(
    `${name}: encode then decode is equivalent to the original`,
    [arbitrary],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(equivalence(decoded, value));
    }),
    { arbitrary: fcRuns(50) }
  );
};

const rejects =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isFailure);

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

const uuid = "401ac022-89eb-4591-8b7e-0a912b9efb44";
const instant = DateTime.makeUnsafe("2021-01-04T05:00:00.000Z");
const nextDay = DateTime.makeUnsafe("2021-01-05T05:00:00.000Z");

// ---------------------------------------------------------------------------
// Identifiers and literal domains
// ---------------------------------------------------------------------------

describe("identifiers and literal domains", () => {
  lawful("SeriesId", SeriesId);
  lawful("TimeSeriesSyncRid", TimeSeriesSyncRid);
  lawful("TimeSeriesTemplateRid", TimeSeriesTemplateRid);
  lawful("TimeSeriesTemplateVersion", TimeSeriesTemplateVersion);
  lawful("TimeUnit", TimeUnit);
  lawful("SeriesTimeUnit", SeriesTimeUnit);
  lawful("PreciseTimeUnit", PreciseTimeUnit);
  lawful("RelativeTimeRelation", RelativeTimeRelation);
  lawful("TimeSeriesAggregationMethod", TimeSeriesAggregationMethod);
  lawful("WindowEdge", WindowEdge);
  lawful("StreamingOutputFormat", StreamingOutputFormat);

  it("pairs every wire literal with exactly one domain literal, in wire order", () => {
    deepStrictEqual(TimeUnit.Pairs, [
      ["MILLISECONDS", "milliseconds"],
      ["SECONDS", "seconds"],
      ["MINUTES", "minutes"],
      ["HOURS", "hours"],
      ["DAYS", "days"],
      ["WEEKS", "weeks"],
      ["MONTHS", "months"],
      ["YEARS", "years"],
      ["QUARTERS", "quarters"],
    ]);
    deepStrictEqual(
      A.map(SeriesTimeUnit.Pairs, ([wire]) => wire),
      ["MILLISECONDS", "SECONDS", "MINUTES", "HOURS", "DAYS", "WEEKS", "MONTHS", "YEARS"]
    );
    deepStrictEqual(PreciseTimeUnit.Pairs, [
      ["NANOSECONDS", "nanoseconds"],
      ["SECONDS", "seconds"],
      ["MINUTES", "minutes"],
      ["HOURS", "hours"],
      ["DAYS", "days"],
      ["WEEKS", "weeks"],
    ]);
    deepStrictEqual(RelativeTimeRelation.Pairs, [
      ["BEFORE", "before"],
      ["AFTER", "after"],
    ]);
    deepStrictEqual(TimeSeriesAggregationMethod.Pairs, [
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
    ]);
    deepStrictEqual(WindowEdge.Pairs, [
      ["START", "start"],
      ["END", "end"],
    ]);
    deepStrictEqual(StreamingOutputFormat.Pairs, [
      ["JSON", "json"],
      ["ARROW", "arrow"],
    ]);
  });

  it.effect(
    "decodes each wire enum literal to its domain literal and encodes it back",
    Effect.fnUntraced(function* () {
      const unit = yield* S.decodeEffect(TimeUnit)("QUARTERS");
      const method = yield* S.decodeEffect(TimeSeriesAggregationMethod)("PERCENT_CHANGE");
      const precise = yield* S.decodeEffect(PreciseTimeUnit)("NANOSECONDS");
      deepStrictEqual([unit, method, precise], ["quarters", "percentChange", "nanoseconds"]);
      const wireUnit = yield* S.encodeEffect(TimeUnit)(unit);
      const wireMethod = yield* S.encodeEffect(TimeSeriesAggregationMethod)(method);
      const wirePrecise = yield* S.encodeEffect(PreciseTimeUnit)(precise);
      deepStrictEqual([wireUnit, wireMethod, wirePrecise], ["QUARTERS", "PERCENT_CHANGE", "NANOSECONDS"]);
    })
  );

  it("matches every domain literal exhaustively through the reverse kit", () => {
    const relations: ReadonlyArray<RelativeTimeRelation> = ["before", "after"];
    const direction = RelativeTimeRelation.To.match({ before: () => -1, after: () => 1 });
    deepStrictEqual(A.map(relations, direction), [-1, 1]);
    const calendarAware = TimeUnit.To.match({
      milliseconds: () => false,
      seconds: () => false,
      minutes: () => false,
      hours: () => false,
      days: () => false,
      weeks: () => false,
      months: () => true,
      years: () => true,
      quarters: () => true,
    });
    const units: ReadonlyArray<TimeUnit> = ["days", "months", "quarters"];
    deepStrictEqual(A.map(units, calendarAware), [false, true, true]);
  });

  it.effect(
    "rejects empty identifiers, domain literals on the wire, unknown units and quarters as a series unit",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(SeriesId)(""),
        rejects(TimeSeriesSyncRid)(""),
        rejects(TimeSeriesTemplateRid)(""),
        rejects(TimeSeriesTemplateVersion)(""),
        rejects(TimeUnit)("quarters"),
        rejects(TimeUnit)("FORTNIGHTS"),
        rejects(SeriesTimeUnit)("QUARTERS"),
        rejects(PreciseTimeUnit)("MILLISECONDS"),
        rejects(PreciseTimeUnit)("MONTHS"),
        rejects(TimeSeriesAggregationMethod)("MEDIAN"),
        rejects(WindowEdge)("MIDDLE"),
        rejects(StreamingOutputFormat)("CSV"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Relative time and time ranges
// ---------------------------------------------------------------------------

describe("TimeRange", () => {
  lawful("RelativeTime", RelativeTime);
  lawful("AbsoluteTimeRange", AbsoluteTimeRange);
  lawful("RelativeTimeRange", RelativeTimeRange);
  lawful("TimeRange", TimeRange);

  const rangeEquivalence = S.toEquivalence(TimeRange);
  const decodeRange = S.decodeEffect(TimeRange);
  const encodeRange = S.encodeEffect(TimeRange);

  it("has the wire union as its encoded side and instants, options and domain literals as its domain side", () => {
    type WireUnit = "MILLISECONDS" | "SECONDS" | "MINUTES" | "HOURS" | "DAYS" | "WEEKS" | "MONTHS" | "YEARS";
    type WireRelativeTime = { readonly when: "BEFORE" | "AFTER"; readonly value: number; readonly unit: WireUnit };
    const facts: readonly [
      Equals<typeof RelativeTime.Encoded, WireRelativeTime>,
      Equals<
        typeof TimeRange.Encoded,
        | { readonly type: "absolute"; readonly startTime?: string; readonly endTime?: string }
        | { readonly type: "relative"; readonly startTime?: WireRelativeTime; readonly endTime?: WireRelativeTime }
      >,
      Equals<TimeRange, AbsoluteTimeRange | RelativeTimeRange>,
      Equals<AbsoluteTimeRange["startTime"], O.Option<DateTime.Utc>>,
      Equals<RelativeTimeRange["endTime"], O.Option<RelativeTime>>,
      Equals<RelativeTime["when"], "before" | "after">,
      Equals<RelativeTime["unit"], Exclude<TimeUnit, "quarters">>,
    ] = [true, true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes a relative time and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof RelativeTime.Encoded = { when: "AFTER", value: 2, unit: "HOURS" };
      const decoded = yield* S.decodeEffect(RelativeTime)(wire);
      assertTrue(S.toEquivalence(RelativeTime)(decoded, RelativeTime.after(2, "hours")));
      deepStrictEqual([decoded.when, decoded.value, decoded.unit], ["after", 2, "hours"]);
      const encoded = yield* S.encodeEffect(RelativeTime)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes a range that starts a distance before now and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof TimeRange.Encoded = {
        type: "relative",
        startTime: { when: "BEFORE", value: 7, unit: "DAYS" },
      };
      const decoded = yield* decodeRange(wire);
      assertTrue(rangeEquivalence(decoded, TimeRange.last(7, "days")));
      const encoded = yield* encodeRange(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes a range that ends a distance after now and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof TimeRange.Encoded = {
        type: "relative",
        endTime: { when: "AFTER", value: 2, unit: "HOURS" },
      };
      const decoded = yield* decodeRange(wire);
      const expected = RelativeTimeRange.make({ endTime: O.some(RelativeTime.after(2, "hours")) });
      assertTrue(rangeEquivalence(decoded, expected));
      const encoded = yield* encodeRange(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes an absolute range with both bounds and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof TimeRange.Encoded = {
        type: "absolute",
        startTime: "2021-01-04T05:00:00.000Z",
        endTime: "2021-01-05T05:00:00.000Z",
      };
      const decoded = yield* decodeRange(wire);
      assertTrue(rangeEquivalence(decoded, TimeRange.between(instant, nextDay)));
      const encoded = yield* encodeRange(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "keeps an absent bound absent in both directions",
    Effect.fnUntraced(function* () {
      const onlyStart: typeof TimeRange.Encoded = { type: "absolute", startTime: "2021-01-04T05:00:00.000Z" };
      const onlyEnd: typeof TimeRange.Encoded = { type: "absolute", endTime: "2021-01-05T05:00:00.000Z" };
      const unbounded: typeof TimeRange.Encoded = { type: "absolute" };
      const since = yield* decodeRange(onlyStart);
      const until = yield* decodeRange(onlyEnd);
      const everything = yield* decodeRange(unbounded);
      assertTrue(rangeEquivalence(since, TimeRange.since(instant)));
      assertTrue(rangeEquivalence(until, TimeRange.until(nextDay)));
      assertTrue(rangeEquivalence(everything, AbsoluteTimeRange.make({})));
      const encodedSince = yield* encodeRange(since);
      const encodedUntil = yield* encodeRange(until);
      const encodedEverything = yield* encodeRange(everything);
      deepStrictEqual(encodedSince, onlyStart);
      deepStrictEqual(encodedUntil, onlyEnd);
      deepStrictEqual(encodedEverything, unbounded);
    })
  );

  it.effect(
    "normalizes a second-precision wire timestamp to the canonical millisecond form",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeRange({ type: "absolute", startTime: "2021-01-04T05:00:00Z" });
      assertTrue(rangeEquivalence(decoded, TimeRange.since(instant)));
      const encoded = yield* encodeRange(decoded);
      deepStrictEqual(encoded, { type: "absolute", startTime: "2021-01-04T05:00:00.000Z" });
    })
  );

  it("defaults both bounds to absent in the constructors", () => {
    const absolute = AbsoluteTimeRange.make({});
    const relative = RelativeTimeRange.make({});
    assertNone(absolute.startTime);
    assertNone(absolute.endTime);
    assertNone(relative.startTime);
    assertNone(relative.endTime);
  });

  it("builds the usual windows through the static constructors", () => {
    const last = TimeRange.last(7, "days");
    assertSome(last.startTime, RelativeTime.before(7, "days"));
    assertNone(last.endTime);
    const between = TimeRange.between(instant, nextDay);
    assertSome(between.startTime, instant);
    assertSome(between.endTime, nextDay);
    assertNone(TimeRange.since(instant).endTime);
    assertNone(TimeRange.until(nextDay).startTime);
    deepStrictEqual([RelativeTime.before(3, "days").when, RelativeTime.after(2, "hours").when], ["before", "after"]);
  });

  it("constructs every case, exercises every guard and the exhaustive matcher", () => {
    const absolute = TimeRange.cases.absolute.make({ startTime: O.some(instant) });
    const relative = TimeRange.cases.relative.make({ startTime: O.some(RelativeTime.before(1, "weeks")) });
    const describeRange = TimeRange.match({
      absolute: ({ startTime }) => `absolute:${O.isSome(startTime)}`,
      relative: ({ startTime }) => `relative:${O.isSome(startTime)}`,
    });
    assertTrue(TimeRange.guards.absolute(absolute));
    assertTrue(TimeRange.guards.relative(relative));
    assertFalse(TimeRange.guards.absolute(relative));
    assertTrue(TimeRange.isAnyOf(["relative"])(relative));
    deepStrictEqual(A.map([absolute, relative], describeRange), ["absolute:true", "relative:true"]);
    deepStrictEqual(TimeRange.discriminants, ["absolute", "relative"]);
  });

  it.effect(
    "rejects unknown range kinds, malformed bounds, quarters and non-finite distances",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(TimeRange)({ type: "open" }),
        rejects(TimeRange)({ startTime: "2021-01-04T05:00:00.000Z" }),
        rejects(TimeRange)({ type: "absolute", startTime: "not a timestamp" }),
        rejects(TimeRange)({ type: "absolute", startTime: 1609736400000 }),
        rejects(TimeRange)({ type: "relative", startTime: { when: "BEFORE", value: 1, unit: "QUARTERS" } }),
        rejects(TimeRange)({ type: "relative", startTime: { when: "before", value: 1, unit: "DAYS" } }),
        rejects(TimeRange)({ type: "relative", startTime: { when: "BEFORE", unit: "DAYS" } }),
        rejects(RelativeTime)({ when: "BEFORE", value: Number.POSITIVE_INFINITY, unit: "DAYS" }),
        rejects(RelativeTime)({ when: "BEFORE", value: "7", unit: "DAYS" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

describe("TimeSeriesPoint", () => {
  lawful("PointValue", PointValue);
  lawful("TimeSeriesPoint", TimeSeriesPoint);
  lawful("StreamPointsResponse", StreamPointsResponse);

  const pointEquivalence = S.toEquivalence(TimeSeriesPoint);

  it("carries an ISO string and a number or text on the wire, and an instant in the domain", () => {
    const facts: readonly [
      Equals<typeof TimeSeriesPoint.Encoded, { readonly time: string; readonly value: number | string }>,
      Equals<TimeSeriesPoint["time"], DateTime.Utc>,
      Equals<TimeSeriesPoint["value"], PointValue>,
      Equals<PointValue, number | string>,
      Equals<StreamPointsResponse["data"], ReadonlyArray<TimeSeriesPoint>>,
    ] = [true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes a numeric point and a categorical point and encodes them back unchanged",
    Effect.fnUntraced(function* () {
      const numeric: typeof TimeSeriesPoint.Encoded = { time: "2021-01-04T05:00:00.000Z", value: 101.3 };
      const categorical: typeof TimeSeriesPoint.Encoded = { time: "2021-01-05T05:00:00.000Z", value: "OPEN" };
      const decodedNumeric = yield* S.decodeEffect(TimeSeriesPoint)(numeric);
      const decodedCategorical = yield* S.decodeEffect(TimeSeriesPoint)(categorical);
      assertTrue(pointEquivalence(decodedNumeric, TimeSeriesPoint.make({ time: instant, value: 101.3 })));
      assertTrue(pointEquivalence(decodedCategorical, TimeSeriesPoint.make({ time: nextDay, value: "OPEN" })));
      const encodedNumeric = yield* S.encodeEffect(TimeSeriesPoint)(decodedNumeric);
      const encodedCategorical = yield* S.encodeEffect(TimeSeriesPoint)(decodedCategorical);
      deepStrictEqual(encodedNumeric, numeric);
      deepStrictEqual(encodedCategorical, categorical);
    })
  );

  it.effect(
    "decodes a stream response in order and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof StreamPointsResponse.Encoded = {
        data: [
          { time: "2021-01-04T05:00:00.000Z", value: 1 },
          { time: "2021-01-05T05:00:00.000Z", value: 2.5 },
        ],
      };
      const decoded = yield* S.decodeEffect(StreamPointsResponse)(wire);
      deepStrictEqual(
        A.map(decoded.data, (point) => point.value),
        [1, 2.5]
      );
      const encoded = yield* S.encodeEffect(StreamPointsResponse)(decoded);
      deepStrictEqual(encoded, wire);
      const empty = yield* S.decodeEffect(StreamPointsResponse)({ data: [] });
      strictEqual(A.length(empty.data), 0);
    })
  );

  it.effect(
    "rejects values that are neither finite numbers nor text, and times that are not timestamps",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(PointValue)(true),
        rejects(PointValue)(null),
        rejects(PointValue)(Number.NaN),
        rejects(PointValue)({ type: "Point", coordinates: [102.0, 0.5] }),
        rejects(TimeSeriesPoint)({ time: "yesterday", value: 1 }),
        rejects(TimeSeriesPoint)({ time: "2021-01-04T05:00:00.000Z" }),
        rejects(TimeSeriesPoint)({ value: 1 }),
        rejects(StreamPointsResponse)({}),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

describe("TimeSeriesAggregation", () => {
  lawful("PreciseDuration", PreciseDuration);
  lawful("DurationWindow", DurationWindow);
  lawful("PointsCountWindow", PointsCountWindow);
  lawful("RollingWindow", RollingWindow);
  lawful("CumulativeAggregate", CumulativeAggregate);
  lawful("RollingAggregate", RollingAggregate);
  lawful("PeriodicAggregate", PeriodicAggregate);
  lawful("TimeSeriesAggregationStrategy", TimeSeriesAggregationStrategy);
  lawful("TimeSeriesAggregation", TimeSeriesAggregation);

  const aggregationEquivalence = S.toEquivalence(TimeSeriesAggregation);
  const decodeAggregation = S.decodeEffect(TimeSeriesAggregation);
  const encodeAggregation = S.encodeEffect(TimeSeriesAggregation);

  it("keeps the flat wire unions on the encoded side and the named cases on the domain side", () => {
    type WirePreciseUnit = "NANOSECONDS" | "SECONDS" | "MINUTES" | "HOURS" | "DAYS" | "WEEKS";
    type WireDuration = { readonly value: number; readonly unit: WirePreciseUnit };
    const facts: readonly [
      Equals<typeof PreciseDuration.Encoded, WireDuration>,
      Equals<
        typeof RollingWindow.Encoded,
        | { readonly type: "duration"; readonly value: number; readonly unit: WirePreciseUnit }
        | { readonly type: "pointsCount"; readonly count: number }
      >,
      Equals<
        typeof TimeSeriesAggregationStrategy.Encoded,
        | { readonly type: "cumulative" }
        | { readonly type: "rolling"; readonly windowSize: typeof RollingWindow.Encoded }
        | {
            readonly type: "periodic";
            readonly windowSize: WireDuration;
            readonly alignmentTimestamp?: string;
            readonly windowType: "START" | "END";
          }
      >,
      Equals<RollingWindow, DurationWindow | PointsCountWindow>,
      Equals<TimeSeriesAggregationStrategy, CumulativeAggregate | RollingAggregate | PeriodicAggregate>,
      Equals<RollingAggregate["windowSize"], RollingWindow>,
      Equals<PeriodicAggregate["windowSize"], PreciseDuration>,
      Equals<PeriodicAggregate["alignmentTimestamp"], O.Option<DateTime.Utc>>,
      Equals<TimeSeriesAggregation["strategy"], TimeSeriesAggregationStrategy>,
      Equals<TimeSeriesAggregation["method"], TimeSeriesAggregationMethod>,
    ] = [true, true, true, true, true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes a periodic aggregation with a pinned grid and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof TimeSeriesAggregation.Encoded = {
        method: "MEAN",
        strategy: {
          type: "periodic",
          windowSize: { value: 1, unit: "HOURS" },
          alignmentTimestamp: "2021-01-04T05:00:00.000Z",
          windowType: "START",
        },
      };
      const decoded = yield* decodeAggregation(wire);
      const expected = TimeSeriesAggregation.make({
        method: "mean",
        strategy: PeriodicAggregate.make({
          windowSize: PreciseDuration.make({ value: 1, unit: "hours" }),
          alignmentTimestamp: O.some(instant),
          windowType: "start",
        }),
      });
      assertTrue(aggregationEquivalence(decoded, expected));
      const encoded = yield* encodeAggregation(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes rolling aggregations sized by time and by points and encodes them back unchanged",
    Effect.fnUntraced(function* () {
      const byTime: typeof TimeSeriesAggregation.Encoded = {
        method: "STANDARD_DEVIATION",
        strategy: { type: "rolling", windowSize: { type: "duration", value: 30, unit: "MINUTES" } },
      };
      const byPoints: typeof TimeSeriesAggregation.Encoded = {
        method: "MAX",
        strategy: { type: "rolling", windowSize: { type: "pointsCount", count: 5 } },
      };
      const decodedByTime = yield* decodeAggregation(byTime);
      const decodedByPoints = yield* decodeAggregation(byPoints);
      assertTrue(
        aggregationEquivalence(
          decodedByTime,
          TimeSeriesAggregation.make({
            method: "standardDeviation",
            strategy: RollingAggregate.make({ windowSize: DurationWindow.make({ value: 30, unit: "minutes" }) }),
          })
        )
      );
      assertTrue(
        aggregationEquivalence(
          decodedByPoints,
          TimeSeriesAggregation.make({
            method: "max",
            strategy: RollingAggregate.make({ windowSize: PointsCountWindow.make({ count: 5 }) }),
          })
        )
      );
      const encodedByTime = yield* encodeAggregation(decodedByTime);
      const encodedByPoints = yield* encodeAggregation(decodedByPoints);
      deepStrictEqual(encodedByTime, byTime);
      deepStrictEqual(encodedByPoints, byPoints);
    })
  );

  it.effect(
    "decodes a cumulative aggregation, whose strategy carries nothing but its tag",
    Effect.fnUntraced(function* () {
      const wire: typeof TimeSeriesAggregation.Encoded = { method: "SUM", strategy: { type: "cumulative" } };
      const decoded = yield* decodeAggregation(wire);
      assertTrue(
        aggregationEquivalence(
          decoded,
          TimeSeriesAggregation.make({ method: "sum", strategy: CumulativeAggregate.make({}) })
        )
      );
      const encoded = yield* encodeAggregation(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it("constructs every strategy and window case, exercises every guard and the exhaustive matchers", () => {
    const duration = RollingWindow.cases.duration.make({ value: 2, unit: "days" });
    const pointsCount = RollingWindow.cases.pointsCount.make({ count: 3 });
    const describeWindow = RollingWindow.match({
      duration: ({ value, unit }) => `${value} ${unit}`,
      pointsCount: ({ count }) => `${count} points`,
    });
    assertTrue(RollingWindow.guards.duration(duration));
    assertTrue(RollingWindow.guards.pointsCount(pointsCount));
    assertFalse(RollingWindow.guards.duration(pointsCount));
    deepStrictEqual(A.map([duration, pointsCount], describeWindow), ["2 days", "3 points"]);
    deepStrictEqual(RollingWindow.discriminants, ["duration", "pointsCount"]);

    const cumulative = TimeSeriesAggregationStrategy.cases.cumulative.make({});
    const rolling = TimeSeriesAggregationStrategy.cases.rolling.make({ windowSize: pointsCount });
    const periodic = TimeSeriesAggregationStrategy.cases.periodic.make({
      windowSize: PreciseDuration.make({ value: 1, unit: "weeks" }),
      windowType: "end",
    });
    const describeStrategy = TimeSeriesAggregationStrategy.match({
      cumulative: () => "cumulative",
      rolling: ({ windowSize }) => `rolling over ${describeWindow(windowSize)}`,
      periodic: ({ windowSize, windowType }) =>
        `every ${windowSize.value} ${windowSize.unit}, labelled at ${windowType}`,
    });
    assertTrue(TimeSeriesAggregationStrategy.guards.cumulative(cumulative));
    assertTrue(TimeSeriesAggregationStrategy.guards.rolling(rolling));
    assertTrue(TimeSeriesAggregationStrategy.guards.periodic(periodic));
    assertTrue(TimeSeriesAggregationStrategy.isAnyOf(["rolling", "periodic"])(periodic));
    assertFalse(TimeSeriesAggregationStrategy.isAnyOf(["rolling", "periodic"])(cumulative));
    assertNone(periodic.alignmentTimestamp);
    deepStrictEqual(A.map([cumulative, rolling, periodic], describeStrategy), [
      "cumulative",
      "rolling over 3 points",
      "every 1 weeks, labelled at end",
    ]);
    deepStrictEqual(TimeSeriesAggregationStrategy.discriminants, ["cumulative", "rolling", "periodic"]);
  });

  it.effect(
    "rejects windows without a positive whole point count, calendar units and missing strategy parts",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(PointsCountWindow)({ type: "pointsCount", count: 0 }),
        rejects(PointsCountWindow)({ type: "pointsCount", count: 1.5 }),
        rejects(RollingWindow)({ type: "points", count: 5 }),
        rejects(RollingWindow)({ value: 30, unit: "MINUTES" }),
        rejects(PreciseDuration)({ value: 1, unit: "MONTHS" }),
        rejects(PreciseDuration)({ value: 1, unit: "hours" }),
        rejects(PeriodicAggregate)({ type: "periodic", windowSize: { value: 1, unit: "HOURS" } }),
        rejects(PeriodicAggregate)({
          type: "periodic",
          windowSize: { value: 1, unit: "HOURS" },
          alignmentTimestamp: "noon",
          windowType: "START",
        }),
        rejects(TimeSeriesAggregationStrategy)({ type: "rolling" }),
        rejects(TimeSeriesAggregationStrategy)({ type: "exponential" }),
        rejects(TimeSeriesAggregation)({ method: "sum", strategy: { type: "cumulative" } }),
        rejects(TimeSeriesAggregation)({ method: "SUM" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Read bodies
// ---------------------------------------------------------------------------

describe("stream requests", () => {
  lawful("StreamPointsRequest", StreamPointsRequest);
  lawful("StreamValuesRequest", StreamValuesRequest);

  const requestEquivalence = S.toEquivalence(StreamPointsRequest);

  it("makes both body fields optional keys on the wire and options in the domain", () => {
    const facts: readonly [
      Equals<
        typeof StreamPointsRequest.Encoded,
        { readonly range?: typeof TimeRange.Encoded; readonly aggregate?: typeof TimeSeriesAggregation.Encoded }
      >,
      Equals<typeof StreamValuesRequest.Encoded, { readonly range?: typeof TimeRange.Encoded }>,
      Equals<StreamPointsRequest["range"], O.Option<TimeRange>>,
      Equals<StreamPointsRequest["aggregate"], O.Option<TimeSeriesAggregation>>,
      Equals<StreamValuesRequest["range"], O.Option<TimeRange>>,
    ] = [true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "encodes a request for every point as the empty body, and decodes the empty body back",
    Effect.fnUntraced(function* () {
      const everything = StreamPointsRequest.make({});
      assertNone(everything.range);
      assertNone(everything.aggregate);
      const wire: typeof StreamPointsRequest.Encoded = {};
      const encoded = yield* S.encodeEffect(StreamPointsRequest)(everything);
      deepStrictEqual(encoded, wire);
      const decoded = yield* S.decodeEffect(StreamPointsRequest)(wire);
      assertTrue(requestEquivalence(decoded, everything));
    })
  );

  it.effect(
    "decodes a windowed, aggregated points request and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof StreamPointsRequest.Encoded = {
        range: { type: "relative", startTime: { when: "BEFORE", value: 7, unit: "DAYS" } },
        aggregate: {
          method: "MEAN",
          strategy: { type: "periodic", windowSize: { value: 1, unit: "DAYS" }, windowType: "END" },
        },
      };
      const decoded = yield* S.decodeEffect(StreamPointsRequest)(wire);
      const expected = StreamPointsRequest.make({
        range: O.some(TimeRange.last(7, "days")),
        aggregate: O.some(
          TimeSeriesAggregation.make({
            method: "mean",
            strategy: PeriodicAggregate.make({
              windowSize: PreciseDuration.make({ value: 1, unit: "days" }),
              windowType: "end",
            }),
          })
        ),
      });
      assertTrue(requestEquivalence(decoded, expected));
      const encoded = yield* S.encodeEffect(StreamPointsRequest)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes a values request, which carries only a range, and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof StreamValuesRequest.Encoded = {
        range: { type: "absolute", startTime: "2021-01-04T05:00:00.000Z", endTime: "2021-01-05T05:00:00.000Z" },
      };
      const decoded = yield* S.decodeEffect(StreamValuesRequest)(wire);
      const expected = StreamValuesRequest.make({ range: O.some(TimeRange.between(instant, nextDay)) });
      assertTrue(S.toEquivalence(StreamValuesRequest)(decoded, expected));
      const encoded = yield* S.encodeEffect(StreamValuesRequest)(decoded);
      deepStrictEqual(encoded, wire);
      assertNone(StreamValuesRequest.make({}).range);
    })
  );

  it.effect(
    "rejects a malformed range or aggregation inside a request",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(StreamPointsRequest)({ range: { type: "sometime" } }),
        rejects(StreamPointsRequest)({ aggregate: { method: "MEAN" } }),
        rejects(StreamPointsRequest)({ range: null }),
        rejects(StreamValuesRequest)({ range: "last week" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Series references
// ---------------------------------------------------------------------------

describe("TimeSeriesReference", () => {
  lawful("SeriesReference", SeriesReference);
  lawful("QualifiedSeriesReference", QualifiedSeriesReference);
  lawful("TemplateSeriesReference", TemplateSeriesReference);
  lawful("TimeSeriesReference", TimeSeriesReference);

  const referenceEquivalence = S.toEquivalence(TimeSeriesReference);
  const decodeReference = S.decodeEffect(TimeSeriesReference);
  const encodeReference = S.encodeEffect(TimeSeriesReference);

  const syncRid = `ri.time-series-catalog.main.sync.${uuid}`;
  const templateRid = `ri.codex-emu.main.template.${uuid}`;

  it("has the untagged wire union as its encoded side and the tagged union as its domain side", () => {
    const facts: readonly [
      Equals<
        typeof TimeSeriesReference.Encoded,
        | string
        | { readonly seriesId: string; readonly syncRid: string }
        | { readonly templateRid: string; readonly templateVersion?: string }
      >,
      Equals<TimeSeriesReference, SeriesReference | QualifiedSeriesReference | TemplateSeriesReference>,
      Equals<typeof SeriesReference.Encoded, string>,
      Equals<SeriesReference["type"], "series">,
      Equals<SeriesReference["seriesId"], SeriesId>,
      Equals<QualifiedSeriesReference["syncRid"], TimeSeriesSyncRid>,
      Equals<TemplateSeriesReference["templateVersion"], O.Option<TimeSeriesTemplateVersion>>,
    ] = [true, true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes a bare series id to the series case and encodes it back to the bare string",
    Effect.fnUntraced(function* () {
      const wire: typeof TimeSeriesReference.Encoded = "wellPressureSeriesId";
      const decoded = yield* decodeReference(wire);
      const expected = SeriesReference.make({ seriesId: SeriesId.make("wellPressureSeriesId") });
      strictEqual(decoded.type, "series");
      assertTrue(referenceEquivalence(decoded, expected));
      const encoded = yield* encodeReference(decoded);
      strictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes a series id with its sync to the qualified case and encodes it back without a tag",
    Effect.fnUntraced(function* () {
      const wire: typeof TimeSeriesReference.Encoded = { seriesId: "wellPressureSeriesId", syncRid };
      const decoded = yield* decodeReference(wire);
      const expected = QualifiedSeriesReference.make({
        seriesId: SeriesId.make("wellPressureSeriesId"),
        syncRid: TimeSeriesSyncRid.make(syncRid),
      });
      strictEqual(decoded.type, "qualifiedSeries");
      assertTrue(referenceEquivalence(decoded, expected));
      const encoded = yield* encodeReference(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes a versioned template to the template case and encodes it back without a tag",
    Effect.fnUntraced(function* () {
      const wire: typeof TimeSeriesReference.Encoded = { templateRid, templateVersion: "0.0.0" };
      const decoded = yield* decodeReference(wire);
      const expected = TemplateSeriesReference.make({
        templateRid: TimeSeriesTemplateRid.make(templateRid),
        templateVersion: O.some(TimeSeriesTemplateVersion.make("0.0.0")),
      });
      strictEqual(decoded.type, "template");
      assertTrue(referenceEquivalence(decoded, expected));
      const encoded = yield* encodeReference(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes a template without a version to an absent version and keeps the key absent on the wire",
    Effect.fnUntraced(function* () {
      const wire: typeof TimeSeriesReference.Encoded = { templateRid };
      const decoded = yield* decodeReference(wire);
      const expected = TemplateSeriesReference.make({ templateRid: TimeSeriesTemplateRid.make(templateRid) });
      assertNone(expected.templateVersion);
      assertTrue(referenceEquivalence(decoded, expected));
      const encoded = yield* encodeReference(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes the action parameter examples of the same three shapes",
    Effect.fnUntraced(function* () {
      const wires: ReadonlyArray<typeof TimeSeriesReference.Encoded> = [
        "sensor-123",
        { seriesId: "sensor-123", syncRid },
        { templateRid: `ri.time-series-catalog.main.template.${uuid}`, templateVersion: "1" },
      ];
      const decoded = yield* Effect.forEach(wires, (wire) => decodeReference(wire));
      deepStrictEqual(
        A.map(decoded, (reference) => reference.type),
        ["series", "qualifiedSeries", "template"]
      );
      const encoded = yield* Effect.forEach(decoded, (reference) => encodeReference(reference));
      deepStrictEqual(encoded, wires);
    })
  );

  it.effect(
    "encodes each member class through its own wire shape",
    Effect.fnUntraced(function* () {
      const series = yield* S.encodeEffect(SeriesReference)(SeriesReference.make({ seriesId: SeriesId.make("a") }));
      const qualified = yield* S.encodeEffect(QualifiedSeriesReference)(
        QualifiedSeriesReference.make({ seriesId: SeriesId.make("a"), syncRid: TimeSeriesSyncRid.make("b") })
      );
      const template = yield* S.encodeEffect(TemplateSeriesReference)(
        TemplateSeriesReference.make({ templateRid: TimeSeriesTemplateRid.make("t") })
      );
      strictEqual(series, "a");
      deepStrictEqual(qualified, { seriesId: "a", syncRid: "b" });
      deepStrictEqual(template, { templateRid: "t" });
    })
  );

  it("constructs every case, exercises every guard and the exhaustive matcher", () => {
    const series = TimeSeriesReference.cases.series.make({ seriesId: SeriesId.make("wellPressureSeriesId") });
    const qualified = TimeSeriesReference.cases.qualifiedSeries.make({
      seriesId: SeriesId.make("wellPressureSeriesId"),
      syncRid: TimeSeriesSyncRid.make(syncRid),
    });
    const template = TimeSeriesReference.cases.template.make({
      templateRid: TimeSeriesTemplateRid.make(templateRid),
      templateVersion: O.some(TimeSeriesTemplateVersion.make("0.0.0")),
    });
    const describeReference = TimeSeriesReference.match({
      series: ({ seriesId }) => `series ${seriesId}`,
      qualifiedSeries: ({ seriesId }) => `synced series ${seriesId}`,
      template: ({ templateVersion }) => `template at ${O.getOrElse(templateVersion, () => "latest")}`,
    });
    assertTrue(TimeSeriesReference.guards.series(series));
    assertTrue(TimeSeriesReference.guards.qualifiedSeries(qualified));
    assertTrue(TimeSeriesReference.guards.template(template));
    assertFalse(TimeSeriesReference.guards.series(qualified));
    assertTrue(TimeSeriesReference.isAnyOf(["series", "qualifiedSeries"])(qualified));
    assertFalse(TimeSeriesReference.isAnyOf(["series", "qualifiedSeries"])(template));
    deepStrictEqual(A.map([series, qualified, template], describeReference), [
      "series wellPressureSeriesId",
      "synced series wellPressureSeriesId",
      "template at 0.0.0",
    ]);
    deepStrictEqual(TimeSeriesReference.discriminants, ["series", "qualifiedSeries", "template"]);
  });

  it.effect(
    "rejects empty identifiers, a series record without its sync, the tagged domain form and non-references",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(TimeSeriesReference)(""),
        rejects(TimeSeriesReference)({ seriesId: "wellPressureSeriesId" }),
        rejects(TimeSeriesReference)({ seriesId: "", syncRid }),
        rejects(TimeSeriesReference)({ seriesId: "wellPressureSeriesId", syncRid: "" }),
        rejects(TimeSeriesReference)({ templateRid: "" }),
        rejects(TimeSeriesReference)({ templateVersion: "0.0.0" }),
        rejects(TimeSeriesReference)({ type: "series", seriesId: "wellPressureSeriesId" }),
        rejects(TimeSeriesReference)({}),
        rejects(TimeSeriesReference)(42),
        rejects(TimeSeriesReference)(null),
        rejects(SeriesReference)({ seriesId: "wellPressureSeriesId", syncRid }),
        rejects(QualifiedSeriesReference)("wellPressureSeriesId"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Geotime series
// ---------------------------------------------------------------------------

describe("GeotimeSeriesValue", () => {
  lawful("GeotimeSeriesValue", GeotimeSeriesValue);

  const valueEquivalence = S.toEquivalence(GeotimeSeriesValue);

  it("carries the wire tag, a position of two or more numbers and an ISO string, decoded to an instant", () => {
    const facts: readonly [
      Equals<
        typeof GeotimeSeriesValue.Encoded,
        {
          readonly type: "geotimeSeriesValue";
          readonly position: readonly [number, number, ...number[]];
          readonly timestamp: string;
        }
      >,
      Equals<GeotimeSeriesValue["position"], readonly [number, number, ...number[]]>,
      Equals<GeotimeSeriesValue["timestamp"], DateTime.Utc>,
    ] = [true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes a tagged position and timestamp and encodes them back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof GeotimeSeriesValue.Encoded = {
        type: "geotimeSeriesValue",
        timestamp: "2021-01-04T05:00:00.000Z",
        position: [102.0, 0.5],
      };
      const decoded = yield* S.decodeEffect(GeotimeSeriesValue)(wire);
      const expected = GeotimeSeriesValue.make({ position: [102.0, 0.5], timestamp: instant });
      assertTrue(valueEquivalence(decoded, expected));
      strictEqual(decoded.type, "geotimeSeriesValue");
      const encoded = yield* S.encodeEffect(GeotimeSeriesValue)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "keeps an altitude when the position has one",
    Effect.fnUntraced(function* () {
      const wire: typeof GeotimeSeriesValue.Encoded = {
        type: "geotimeSeriesValue",
        timestamp: "2021-01-05T05:00:00.000Z",
        position: [102.0, 0.5, 1250],
      };
      const decoded = yield* S.decodeEffect(GeotimeSeriesValue)(wire);
      deepStrictEqual(decoded.position, [102.0, 0.5, 1250]);
      const encoded = yield* S.encodeEffect(GeotimeSeriesValue)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "is a geographic position: elements after the altitude are kept untouched",
    Effect.fnUntraced(function* () {
      const wire: typeof GeotimeSeriesValue.Encoded = {
        type: "geotimeSeriesValue",
        timestamp: "2021-01-05T05:00:00.000Z",
        position: [102.0, 0.5, 1250, 7],
      };
      const decoded = yield* S.decodeEffect(GeotimeSeriesValue)(wire);
      assertTrue(S.is(Position)(decoded.position));
      assertSome(Position.altitude(decoded.position), 1250);
      const encoded = yield* S.encodeEffect(GeotimeSeriesValue)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "rejects positions that are not a longitude and a latitude, a missing tag and a malformed timestamp",
    Effect.fnUntraced(function* () {
      const timestamp = "2021-01-04T05:00:00.000Z";
      const verdicts = yield* Effect.all([
        rejects(GeotimeSeriesValue)({ type: "geotimeSeriesValue", timestamp, position: [102.0] }),
        rejects(GeotimeSeriesValue)({ type: "geotimeSeriesValue", timestamp, position: [] }),
        rejects(GeotimeSeriesValue)({ type: "geotimeSeriesValue", timestamp, position: [180.5, 0.5] }),
        rejects(GeotimeSeriesValue)({ type: "geotimeSeriesValue", timestamp, position: [102.0, -90.5] }),
        rejects(GeotimeSeriesValue)({ type: "geotimeSeriesValue", timestamp, position: [102.0, 0.5, "high"] }),
        rejects(GeotimeSeriesValue)({ type: "geotimeSeriesValue", timestamp, position: ["102.0", "0.5"] }),
        rejects(GeotimeSeriesValue)({ type: "geotimeSeriesValue", timestamp, position: { lon: 102.0, lat: 0.5 } }),
        rejects(GeotimeSeriesValue)({ timestamp, position: [102.0, 0.5] }),
        rejects(GeotimeSeriesValue)({ type: "geotimeSeriesValue", timestamp: "now", position: [102.0, 0.5] }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});
