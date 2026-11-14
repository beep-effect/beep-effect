import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import {
  assertFalse,
  assertNone,
  assertSome,
  assertTrue,
  deepStrictEqual,
  strictEqual,
  throws,
} from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as BigDecimal from "effect/BigDecimal";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  AccuracyRequirement,
  AggregateRequest,
  AggregateResponse,
  Aggregation,
  AggregationAccuracy,
  AggregationKind,
  AggregationOrderingChecks,
  AggregationRange,
  AggregationRow,
  AggregationViolation,
  ApproximateDistinctAggregation,
  ApproximatePercentileAggregation,
  AverageAggregation,
  allowedGroupings,
  allowedMetrics,
  approximateDistinct,
  approximatePercentile,
  avg,
  CountAggregation,
  CountKey,
  checkAggregation,
  count,
  DurationGrouping,
  DurationUnitNotAllowed,
  duration,
  durationUnits,
  ExactDistinctAggregation,
  ExactGrouping,
  exact,
  exactDistinct,
  FixedWidthGrouping,
  fixedWidth,
  GroupBy,
  GroupByKind,
  GroupingNotAllowed,
  GroupDefaultValue,
  GroupKey,
  groupingsFor,
  MaxAggregation,
  MetricKey,
  MetricKeyFromName,
  MetricLookup,
  MetricName,
  MetricResult,
  MetricResultKind,
  MinAggregation,
  max,
  metricKeyOf,
  metricResultKind,
  metricsFor,
  metricValue,
  min,
  MetricNotAllowed,
  named,
  OrderDirection,
  ordered,
  PropertyMetricKey,
  PropertyMetricKind,
  PropertyMetricValues,
  RangesGrouping,
  ranges,
  regroupMetrics,
  SumAggregation,
  sum,
  UnknownAggregatedProperty,
  ungroupedRow,
} from "../src/Aggregation/index.ts";
import {
  DateType,
  DoubleType,
  GeoPointType,
  IntegerType,
  LongType,
  NumericKind,
  PropertyTypeKind,
  StringType,
  TemporalKind,
  TimestampType,
} from "../src/DataType/index.ts";
import { Equals as EqualsFilter, ObjectFilter } from "../src/Filter/index.ts";
import { PropertyApiName, PropertyTypeRid, StructFieldApiName, StructFieldTypeRid } from "../src/Identifier/index.ts";
import {
  ArrayType,
  PrimaryKeyProperty,
  PropertyAtLoadLevel,
  PropertyByName,
  PropertyDefinition,
  PropertySelector,
  PropertyType,
  StructFieldOfProperty,
  StructFieldType,
  StructType,
  TitleProperty,
} from "../src/Property/index.ts";
import { TimeUnit } from "../src/TimeSeries/index.ts";
import { LongValue, TimestampValue } from "../src/Value/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by every named schema
// ---------------------------------------------------------------------------

const generatesMembers = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const is = S.is(schema);
  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });
};

// The law of every schema here: a value has one wire spelling and that spelling decodes back to the same value. A
// range bound is the wire scalar itself and a default value is text, so the schemas that hold them are included.
const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  generatesMembers(name, schema);

  it.effect.prop(
    `${name}: encode then decode is equivalent to the original`,
    [Arbitrary.schema(schema)],
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

// Decodes an exact wire fixture, compares the domain value, encodes it back and compares with the fixture.
const roundTrips = <T, E>(schema: S.Codec<T, E>) => {
  const equivalence = S.toEquivalence(schema);
  const decode = S.decodeEffect(schema);
  const encode = S.encodeEffect(schema);
  return Effect.fnUntraced(function* (wire: E, expected: T) {
    const decoded = yield* decode(wire);
    assertTrue(equivalence(decoded, expected));
    const encoded = yield* encode(decoded);
    deepStrictEqual(encoded, wire);
  });
};

// The message a decode failure reports, or the empty string when the input decodes.
const failureOf =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<string> =>
    Effect.match(S.decodeUnknownEffect(schema)(input), {
      onFailure: (error) => error.message,
      onSuccess: () => "",
    });

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

const salary = PropertyApiName.make("salary");
const team = PropertyApiName.make("team");
const hiredOn = PropertyApiName.make("hiredOn");
const age = PropertyApiName.make("age");
const bySalary = PropertyByName.make({ apiName: salary });
const byTeam = PropertyByName.make({ apiName: team });
const zipOfAddress = StructFieldOfProperty.make({
  propertyApiName: PropertyApiName.make("address"),
  structFieldApiName: StructFieldApiName.make("zip"),
});
const zipOfAddressWire: PropertySelector.Encoded = {
  type: "structField",
  propertyApiName: "address",
  structFieldApiName: "zip",
};
const nameOf = (text: string) => O.some(MetricName.make(text));

// ---------------------------------------------------------------------------
// Literal domains
// ---------------------------------------------------------------------------

describe("literal domains", () => {
  lawful("OrderDirection", OrderDirection);
  lawful("AccuracyRequirement", AccuracyRequirement);
  lawful("AggregationAccuracy", AggregationAccuracy);
  lawful("AggregationKind", AggregationKind);
  lawful("PropertyMetricKind", PropertyMetricKind);
  lawful("GroupByKind", GroupByKind);
  lawful("MetricResultKind", MetricResultKind);
  lawful("MetricName", MetricName);
  lawful("GroupKey", GroupKey);

  it("pairs every wire literal with exactly one domain literal, in wire order", () => {
    deepStrictEqual(OrderDirection.Pairs, [
      ["ASC", "asc"],
      ["DESC", "desc"],
    ]);
    deepStrictEqual(AccuracyRequirement.Pairs, [
      ["REQUIRE_ACCURATE", "requireAccurate"],
      ["ALLOW_APPROXIMATE", "allowApproximate"],
    ]);
    deepStrictEqual(AggregationAccuracy.Pairs, [
      ["ACCURATE", "accurate"],
      ["APPROXIMATE", "approximate"],
    ]);
  });

  it("lists the wire's eight metric tags and four grouping tags", () => {
    deepStrictEqual(AggregationKind.literals, [
      "count",
      "sum",
      "avg",
      "min",
      "max",
      "approximateDistinct",
      "exactDistinct",
      "approximatePercentile",
    ]);
    deepStrictEqual(PropertyMetricKind.literals, [
      "sum",
      "avg",
      "min",
      "max",
      "approximateDistinct",
      "exactDistinct",
      "approximatePercentile",
    ]);
    deepStrictEqual(GroupByKind.literals, ["exact", "fixedWidth", "ranges", "duration"]);
  });

  it.effect(
    "rejects domain literals on the wire, unknown literals and empty names",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(OrderDirection)("asc"),
        rejects(OrderDirection)("UNORDERED"),
        rejects(AccuracyRequirement)("ACCURATE"),
        rejects(AggregationAccuracy)("REQUIRE_ACCURATE"),
        rejects(AggregationKind)("collectList"),
        rejects(PropertyMetricKind)("count"),
        rejects(GroupByKind)("objectType"),
        rejects(MetricName)(""),
        rejects(GroupKey)(""),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

describe("Aggregation", () => {
  lawful("CountAggregation", CountAggregation);
  lawful("SumAggregation", SumAggregation);
  lawful("AverageAggregation", AverageAggregation);
  lawful("MinAggregation", MinAggregation);
  lawful("MaxAggregation", MaxAggregation);
  lawful("ApproximateDistinctAggregation", ApproximateDistinctAggregation);
  lawful("ExactDistinctAggregation", ExactDistinctAggregation);
  lawful("ApproximatePercentileAggregation", ApproximatePercentileAggregation);
  lawful("Aggregation", Aggregation);

  const aggregationRoundTrips = roundTrips(Aggregation);

  it("has the wire union as its encoded side and one property selector as its domain side", () => {
    type WireMetric<Tag> = {
      readonly type: Tag;
      readonly field?: string;
      readonly propertyIdentifier?: PropertySelector.Encoded;
      readonly name?: string;
      readonly direction?: "ASC" | "DESC";
    };
    type WirePercentile = {
      readonly type: "approximatePercentile";
      readonly field?: string;
      readonly propertyIdentifier?: PropertySelector.Encoded;
      readonly name?: string;
      readonly approximatePercentile: number;
      readonly direction?: "ASC" | "DESC";
    };
    const facts: readonly [
      Equals<
        typeof CountAggregation.Encoded,
        { readonly type: "count"; readonly name?: string; readonly direction?: "ASC" | "DESC" }
      >,
      Equals<typeof SumAggregation.Encoded, WireMetric<"sum">>,
      Equals<typeof ExactDistinctAggregation.Encoded, WireMetric<"exactDistinct">>,
      Equals<typeof ApproximatePercentileAggregation.Encoded, WirePercentile>,
      Equals<SumAggregation["property"], PropertySelector>,
      Equals<SumAggregation["direction"], O.Option<"asc" | "desc">>,
      Equals<SumAggregation["name"], O.Option<MetricName>>,
      Equals<ApproximatePercentileAggregation["percentile"], number>,
      Equals<Aggregation["type"], AggregationKind>,
    ] = [true, true, true, true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes the count the client sends and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      yield* aggregationRoundTrips(
        { type: "count", name: "count", direction: "DESC" },
        CountAggregation.make({ name: nameOf("count"), direction: O.some("desc") })
      );
      yield* aggregationRoundTrips({ type: "count" }, CountAggregation.make({}));
    })
  );

  it.effect(
    "decodes every property metric addressed by a bare field and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      yield* aggregationRoundTrips(
        { type: "sum", name: "salary.sum", direction: "ASC", field: "salary" },
        SumAggregation.make({ property: bySalary, name: nameOf("salary.sum"), direction: O.some("asc") })
      );
      yield* aggregationRoundTrips(
        { type: "avg", name: "salary.avg", field: "salary" },
        AverageAggregation.make({ property: bySalary, name: nameOf("salary.avg") })
      );
      yield* aggregationRoundTrips(
        { type: "min", name: "salary.min", field: "salary" },
        MinAggregation.make({ property: bySalary, name: nameOf("salary.min") })
      );
      yield* aggregationRoundTrips(
        { type: "max", name: "salary.max", field: "salary" },
        MaxAggregation.make({ property: bySalary, name: nameOf("salary.max") })
      );
      yield* aggregationRoundTrips(
        { type: "approximateDistinct", name: "salary.approximateDistinct", field: "salary" },
        ApproximateDistinctAggregation.make({ property: bySalary, name: nameOf("salary.approximateDistinct") })
      );
      yield* aggregationRoundTrips(
        { type: "exactDistinct", name: "salary.exactDistinct", field: "salary" },
        ExactDistinctAggregation.make({ property: bySalary, name: nameOf("salary.exactDistinct") })
      );
      yield* aggregationRoundTrips(
        { type: "approximatePercentile", field: "salary", approximatePercentile: 0.95, direction: "DESC" },
        ApproximatePercentileAggregation.make({ property: bySalary, percentile: 0.95, direction: O.some("desc") })
      );
    })
  );

  it.effect(
    "decodes a metric addressed by a property identifier and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      yield* aggregationRoundTrips(
        { type: "min", propertyIdentifier: zipOfAddressWire },
        MinAggregation.make({ property: zipOfAddress })
      );
      yield* aggregationRoundTrips(
        { type: "max", propertyIdentifier: { type: "titleProperty" }, name: "latest" },
        MaxAggregation.make({ property: TitleProperty.make({}), name: nameOf("latest") })
      );
      yield* aggregationRoundTrips(
        {
          type: "exactDistinct",
          propertyIdentifier: {
            type: "propertyWithLoadLevel",
            propertyIdentifier: { type: "property", apiName: "tags" },
            loadLevel: { type: "applyReducers" },
          },
        },
        ExactDistinctAggregation.make({
          property: PropertyAtLoadLevel.make({
            selector: PropertyByName.make({ apiName: PropertyApiName.make("tags") }),
            loadLevel: "applyReducers",
          }),
        })
      );
    })
  );

  it.effect(
    "normalises a bare property spelled as an identifier to the compact field key",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(Aggregation)({
        type: "sum",
        propertyIdentifier: { type: "property", apiName: "salary" },
      });
      assertTrue(S.toEquivalence(Aggregation)(decoded, SumAggregation.make({ property: bySalary })));
      const encoded = yield* S.encodeEffect(Aggregation)(decoded);
      deepStrictEqual(encoded, { type: "sum", field: "salary" });
    })
  );

  it.effect(
    "rejects a property metric that names its property twice or not at all",
    Effect.fnUntraced(function* () {
      const both = A.map(PropertyMetricKind.literals, (type) =>
        rejects(Aggregation)({
          type,
          field: "salary",
          propertyIdentifier: zipOfAddressWire,
          approximatePercentile: 0.5,
        })
      );
      const neither = A.map(PropertyMetricKind.literals, (type) =>
        rejects(Aggregation)({ type, approximatePercentile: 0.5 })
      );
      const verdicts = yield* Effect.all([...both, ...neither]);
      strictEqual(verdicts.length, 14);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "accepts each addressing key on its own for every property metric",
    Effect.fnUntraced(function* () {
      const byField = A.map(PropertyMetricKind.literals, (type) =>
        rejects(Aggregation)({ type, field: "salary", approximatePercentile: 0.5 })
      );
      const byIdentifier = A.map(PropertyMetricKind.literals, (type) =>
        rejects(Aggregation)({ type, propertyIdentifier: zipOfAddressWire, approximatePercentile: 0.5 })
      );
      const verdicts = yield* Effect.all([...byField, ...byIdentifier]);
      assertFalse(A.some(verdicts, identity));
    })
  );

  it.effect(
    "rejects unknown tags, empty names, an empty field and a percentile without its value",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(Aggregation)({ type: "median", field: "salary" }),
        rejects(Aggregation)({ type: "collectList", field: "salary", limit: 10 }),
        rejects(Aggregation)({ type: "sum", field: "" }),
        rejects(Aggregation)({ type: "sum", field: "salary", name: "" }),
        rejects(Aggregation)({ type: "sum", field: "salary", direction: "desc" }),
        rejects(Aggregation)({ type: "approximatePercentile", field: "salary" }),
        rejects(Aggregation)({ type: "approximatePercentile", field: "salary", percentile: 0.5 }),
        rejects(Aggregation)({ field: "salary" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it("constructs every case through the union's cases and tells them apart", () => {
    const values: ReadonlyArray<Aggregation> = [
      Aggregation.cases.count.make({}),
      Aggregation.cases.sum.make({ property: bySalary }),
      Aggregation.cases.avg.make({ property: bySalary }),
      Aggregation.cases.min.make({ property: bySalary }),
      Aggregation.cases.max.make({ property: bySalary }),
      Aggregation.cases.approximateDistinct.make({ property: bySalary }),
      Aggregation.cases.exactDistinct.make({ property: bySalary }),
      Aggregation.cases.approximatePercentile.make({ property: bySalary, percentile: 0.5 }),
    ];
    const describeMetric = Aggregation.match({
      count: () => "count",
      sum: ({ property }) => `sum of ${property.type}`,
      avg: ({ property }) => `avg of ${property.type}`,
      min: ({ property }) => `min of ${property.type}`,
      max: ({ property }) => `max of ${property.type}`,
      approximateDistinct: ({ property }) => `approximateDistinct of ${property.type}`,
      exactDistinct: ({ property }) => `exactDistinct of ${property.type}`,
      approximatePercentile: ({ percentile }) => `percentile ${percentile}`,
    });
    deepStrictEqual(
      A.map(values, (value) => value.type),
      [...AggregationKind.literals]
    );
    deepStrictEqual([...Aggregation.discriminants], [...AggregationKind.literals]);
    deepStrictEqual(A.map(values, describeMetric), [
      "count",
      "sum of property",
      "avg of property",
      "min of property",
      "max of property",
      "approximateDistinct of property",
      "exactDistinct of property",
      "percentile 0.5",
    ]);
    const guards = [
      Aggregation.guards.count,
      Aggregation.guards.sum,
      Aggregation.guards.avg,
      Aggregation.guards.min,
      Aggregation.guards.max,
      Aggregation.guards.approximateDistinct,
      Aggregation.guards.exactDistinct,
      Aggregation.guards.approximatePercentile,
    ];
    const hits = A.map(values, (value) => A.map(guards, (guard) => guard(value)));
    deepStrictEqual(
      hits,
      A.map(values, (_, row) => A.map(guards, (__, column) => row === column))
    );
    const readsProperty = Aggregation.isAnyOf(PropertyMetricKind.literals);
    deepStrictEqual(A.map(values, readsProperty), [false, true, true, true, true, true, true, true]);
  });

  it("defaults the name and the direction to absent in the constructors", () => {
    const metric = SumAggregation.make({ property: bySalary });
    assertNone(metric.name);
    assertNone(metric.direction);
    strictEqual(metric.type, "sum");
    assertNone(CountAggregation.make({}).direction);
  });
});

// ---------------------------------------------------------------------------
// Group-bys
// ---------------------------------------------------------------------------

describe("GroupBy", () => {
  lawful("AggregationRange", AggregationRange);
  lawful("GroupDefaultValue", GroupDefaultValue);
  lawful("ExactGrouping", ExactGrouping);
  lawful("FixedWidthGrouping", FixedWidthGrouping);
  lawful("RangesGrouping", RangesGrouping);
  lawful("DurationGrouping", DurationGrouping);
  lawful("GroupBy", GroupBy);

  const groupByRoundTrips = roundTrips(GroupBy);

  it("has the wire union as its encoded side and renamed, optional and scalar fields as its domain side", () => {
    type WireScalar = string | number | boolean;
    type WireUnit =
      | "MILLISECONDS"
      | "SECONDS"
      | "MINUTES"
      | "HOURS"
      | "DAYS"
      | "WEEKS"
      | "MONTHS"
      | "YEARS"
      | "QUARTERS";
    const facts: readonly [
      Equals<
        typeof ExactGrouping.Encoded,
        {
          readonly type: "exact";
          readonly field?: string;
          readonly propertyIdentifier?: PropertySelector.Encoded;
          readonly maxGroupCount?: number;
          readonly defaultValue?: string;
          readonly includeNullValues?: boolean;
        }
      >,
      Equals<
        typeof FixedWidthGrouping.Encoded,
        {
          readonly type: "fixedWidth";
          readonly field?: string;
          readonly propertyIdentifier?: PropertySelector.Encoded;
          readonly fixedWidth: number;
        }
      >,
      Equals<
        typeof RangesGrouping.Encoded,
        {
          readonly type: "ranges";
          readonly field?: string;
          readonly propertyIdentifier?: PropertySelector.Encoded;
          readonly ranges: ReadonlyArray<{ readonly startValue: WireScalar; readonly endValue: WireScalar }>;
        }
      >,
      Equals<
        typeof DurationGrouping.Encoded,
        {
          readonly type: "duration";
          readonly field?: string;
          readonly propertyIdentifier?: PropertySelector.Encoded;
          readonly value: number;
          readonly unit: WireUnit;
        }
      >,
      Equals<typeof GroupDefaultValue.Encoded, string>,
      Equals<FixedWidthGrouping["width"], number>,
      Equals<DurationGrouping["unit"], TimeUnit>,
      Equals<ExactGrouping["includeNullValues"], O.Option<boolean>>,
      Equals<GroupBy["type"], GroupByKind>,
    ] = [true, true, true, true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes every exact grouping form the client sends and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      yield* groupByRoundTrips({ type: "exact", field: "team" }, ExactGrouping.make({ property: byTeam }));
      yield* groupByRoundTrips(
        { type: "exact", field: "team", maxGroupCount: 10 },
        ExactGrouping.make({ property: byTeam, maxGroupCount: O.some(10) })
      );
      yield* groupByRoundTrips(
        { type: "exact", field: "team", maxGroupCount: 5, defaultValue: "unassigned" },
        ExactGrouping.make({ property: byTeam, maxGroupCount: O.some(5), defaultValue: O.some("unassigned") })
      );
      yield* groupByRoundTrips(
        { type: "exact", field: "team", includeNullValues: true },
        ExactGrouping.make({ property: byTeam, includeNullValues: O.some(true) })
      );
      yield* groupByRoundTrips(
        { type: "exact", propertyIdentifier: zipOfAddressWire, defaultValue: "none", includeNullValues: false },
        ExactGrouping.make({
          property: zipOfAddress,
          defaultValue: O.some("none"),
          includeNullValues: O.some(false),
        })
      );
    })
  );

  it.effect(
    "decodes the fixed-width, ranges and duration groupings and encodes them back unchanged",
    Effect.fnUntraced(function* () {
      const byAge = PropertyByName.make({ apiName: age });
      const byHiredOn = PropertyByName.make({ apiName: hiredOn });
      yield* groupByRoundTrips(
        { type: "fixedWidth", field: "age", fixedWidth: 10 },
        FixedWidthGrouping.make({ property: byAge, width: 10 })
      );
      yield* groupByRoundTrips(
        {
          type: "ranges",
          field: "age",
          ranges: [
            { startValue: 0, endValue: 18 },
            { startValue: 18, endValue: 65 },
          ],
        },
        RangesGrouping.make({
          property: byAge,
          ranges: [
            AggregationRange.make({ startValue: 0, endValue: 18 }),
            AggregationRange.make({ startValue: 18, endValue: 65 }),
          ],
        })
      );
      yield* groupByRoundTrips(
        { type: "ranges", field: "hiredOn", ranges: [{ startValue: "2020-01-01", endValue: "2021-01-01" }] },
        RangesGrouping.make({
          property: byHiredOn,
          ranges: [AggregationRange.make({ startValue: "2020-01-01", endValue: "2021-01-01" })],
        })
      );
      yield* groupByRoundTrips(
        { type: "duration", field: "hiredOn", value: 1, unit: "QUARTERS" },
        DurationGrouping.make({ property: byHiredOn, value: 1, unit: "quarters" })
      );
      yield* groupByRoundTrips(
        { type: "duration", field: "hiredOn", value: 30, unit: "MINUTES" },
        DurationGrouping.make({ property: byHiredOn, value: 30, unit: "minutes" })
      );
      yield* groupByRoundTrips(
        { type: "duration", propertyIdentifier: { type: "primaryKeyProperty" }, value: 7, unit: "DAYS" },
        DurationGrouping.make({ property: PrimaryKeyProperty.make({}), value: 7, unit: "days" })
      );
    })
  );

  // A range bound is the wire scalar and a default value is text. A rich bound is written by the codec of its own
  // type before it enters a range, and the range then round-trips exactly.
  it.effect(
    "holds range bounds as wire scalars and default values as text, and decodes both back unchanged",
    Effect.fnUntraced(function* () {
      const instant = yield* S.encodeEffect(TimestampValue)(DateTime.makeUnsafe("2021-01-04T05:00:00.000Z"));
      const nextDay = yield* S.encodeEffect(TimestampValue)(DateTime.makeUnsafe("2021-01-05T05:00:00.000Z"));
      const zero = yield* S.encodeEffect(LongValue)(BigInt(0));
      const beyondDoubles = yield* S.encodeEffect(LongValue)(BigInt("9007199254740993"));
      const day = AggregationRange.make({ startValue: instant, endValue: nextDay });
      const longs = AggregationRange.make({ startValue: zero, endValue: beyondDoubles });
      const dayWire = yield* S.encodeEffect(AggregationRange)(day);
      const longsWire = yield* S.encodeEffect(AggregationRange)(longs);
      deepStrictEqual(dayWire, { startValue: "2021-01-04T05:00:00.000Z", endValue: "2021-01-05T05:00:00.000Z" });
      deepStrictEqual(longsWire, { startValue: "0", endValue: "9007199254740993" });
      const dayAgain = yield* S.decodeEffect(AggregationRange)(dayWire);
      const longsAgain = yield* S.decodeEffect(AggregationRange)(longsWire);
      deepStrictEqual([dayAgain, longsAgain], [day, longs]);
      // A default is the text the wire types it as, whatever the property's type: the caller spells a number, a
      // boolean, a decimal with its scale or an instant, and the codec changes nothing in either direction.
      const texts: ReadonlyArray<GroupDefaultValue> = ["0", "2.5", "true", "unassigned", "7", "12.50", instant];
      const defaults = yield* Effect.forEach(texts, (text) => S.encodeEffect(GroupDefaultValue)(text));
      deepStrictEqual(defaults, ["0", "2.5", "true", "unassigned", "7", "12.50", "2021-01-04T05:00:00.000Z"]);
      const defaultsAgain = yield* Effect.forEach(defaults, (text) => S.decodeEffect(GroupDefaultValue)(text));
      deepStrictEqual(defaultsAgain, texts);
      const grouping = yield* S.encodeEffect(GroupBy)(
        ExactGrouping.make({ property: byTeam, defaultValue: O.some("0") })
      );
      deepStrictEqual(grouping, { type: "exact", field: "team", defaultValue: "0" });
    })
  );

  it.effect(
    "refuses a rich value as a range bound and anything but text as a default value",
    Effect.fnUntraced(function* () {
      const instant = DateTime.makeUnsafe("2021-01-04T05:00:00.000Z");
      // @ts-expect-error an instant bound is the text it travels as, not a DateTime
      throws(() => AggregationRange.make({ startValue: instant, endValue: instant }));
      // @ts-expect-error a 64-bit bound is the text it travels as, not a bigint
      throws(() => AggregationRange.make({ startValue: BigInt(0), endValue: BigInt("9007199254740993") }));
      // @ts-expect-error a default value is text: the wire types it as a string for every property type
      throws(() => ExactGrouping.make({ property: byTeam, defaultValue: O.some(0) }));
      const verdicts = yield* Effect.all([
        rejects(AggregationRange)({ startValue: instant, endValue: "2021-01-05T05:00:00.000Z" }),
        rejects(AggregationRange)({ startValue: 0, endValue: BigInt(7) }),
        rejects(GroupDefaultValue)(0),
        rejects(GroupDefaultValue)(true),
        rejects(GroupDefaultValue)(BigDecimal.fromStringUnsafe("12.50")),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "rejects an exact grouping that sets both a default value and a null group",
    Effect.fnUntraced(function* () {
      const contradictory = { type: "exact", field: "team", defaultValue: "unassigned", includeNullValues: true };
      const rejected = yield* Effect.all([rejects(GroupBy)(contradictory), rejects(ExactGrouping)(contradictory)]);
      const accepted = yield* Effect.all([
        rejects(GroupBy)({ ...contradictory, includeNullValues: false }),
        rejects(GroupBy)({ type: "exact", field: "team", includeNullValues: true }),
        rejects(GroupBy)({ type: "exact", field: "team", defaultValue: "unassigned" }),
      ]);
      assertTrue(A.every(rejected, identity));
      assertFalse(A.some(accepted, identity));
      assertNone(
        ExactGrouping.makeOption({
          property: byTeam,
          defaultValue: O.some("unassigned"),
          includeNullValues: O.some(true),
        })
      );
    })
  );

  it.effect(
    "rejects a duration grouping of more than one week, month, quarter or year",
    Effect.fnUntraced(function* () {
      const twoOf = (unit: string) => rejects(GroupBy)({ type: "duration", field: "hiredOn", value: 2, unit });
      const oneOf = (unit: string) => rejects(GroupBy)({ type: "duration", field: "hiredOn", value: 1, unit });
      const calendar = ["WEEKS", "MONTHS", "QUARTERS", "YEARS"];
      const clock = ["MILLISECONDS", "SECONDS", "MINUTES", "HOURS", "DAYS"];
      const rejected = yield* Effect.forEach(calendar, twoOf);
      const acceptedSingles = yield* Effect.forEach([...calendar, ...clock], oneOf);
      const acceptedMultiples = yield* Effect.forEach(clock, twoOf);
      assertTrue(A.every(rejected, identity));
      assertFalse(A.some(acceptedSingles, identity));
      assertFalse(A.some(acceptedMultiples, identity));
      const twoYears = DurationGrouping.makeOption({ property: byTeam, value: 2, unit: "years" });
      const oneYear = DurationGrouping.makeOption({ property: byTeam, value: 1, unit: "years" });
      const acceptsOneYear = O.isSome(oneYear);
      assertNone(twoYears);
      assertTrue(acceptsOneYear);
    })
  );

  it.effect(
    "rejects a grouping that names its property twice or not at all",
    Effect.fnUntraced(function* () {
      const shapes = [
        { type: "exact" },
        { type: "fixedWidth", fixedWidth: 10 },
        { type: "ranges", ranges: [] },
        { type: "duration", value: 1, unit: "DAYS" },
      ];
      const neither = yield* Effect.forEach(shapes, rejects(GroupBy));
      const both = yield* Effect.forEach(shapes, (shape) =>
        rejects(GroupBy)({ ...shape, field: "team", propertyIdentifier: zipOfAddressWire })
      );
      const byField = yield* Effect.forEach(shapes, (shape) => rejects(GroupBy)({ ...shape, field: "team" }));
      const byIdentifier = yield* Effect.forEach(shapes, (shape) =>
        rejects(GroupBy)({ ...shape, propertyIdentifier: zipOfAddressWire })
      );
      assertTrue(A.every(neither, identity));
      assertTrue(A.every(both, identity));
      assertFalse(A.some(byField, identity));
      assertFalse(A.some(byIdentifier, identity));
    })
  );

  it.effect(
    "rejects unknown tags, fractional and non-positive counts, non-positive widths and missing payloads",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(GroupBy)({ type: "objectType" }),
        rejects(GroupBy)({ type: "exact", field: "team", maxGroupCount: 0 }),
        rejects(GroupBy)({ type: "exact", field: "team", maxGroupCount: 2.5 }),
        rejects(GroupBy)({ type: "exact", field: "team", defaultValue: 0 }),
        rejects(GroupBy)({ type: "fixedWidth", field: "age" }),
        rejects(GroupBy)({ type: "fixedWidth", field: "age", width: 10 }),
        rejects(GroupBy)({ type: "fixedWidth", field: "age", fixedWidth: 0 }),
        rejects(GroupBy)({ type: "fixedWidth", field: "age", fixedWidth: -5 }),
        rejects(GroupBy)({ type: "ranges", field: "age" }),
        rejects(GroupBy)({ type: "ranges", field: "age", ranges: [{ startValue: 0 }] }),
        rejects(GroupBy)({ type: "duration", field: "hiredOn", value: 0, unit: "DAYS" }),
        rejects(GroupBy)({ type: "duration", field: "hiredOn", value: 1.5, unit: "DAYS" }),
        rejects(GroupBy)({ type: "duration", field: "hiredOn", value: 1, unit: "days" }),
        rejects(GroupBy)({ type: "duration", field: "hiredOn", value: 1, unit: "FORTNIGHTS" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it("constructs every case through the union's cases and tells them apart", () => {
    const values: ReadonlyArray<GroupBy> = [
      GroupBy.cases.exact.make({ property: byTeam }),
      GroupBy.cases.fixedWidth.make({ property: byTeam, width: 5 }),
      GroupBy.cases.ranges.make({ property: byTeam, ranges: [] }),
      GroupBy.cases.duration.make({ property: byTeam, value: 1, unit: "weeks" }),
    ];
    const describeGrouping = GroupBy.match({
      exact: ({ maxGroupCount }) => `exact, limited: ${O.isSome(maxGroupCount)}`,
      fixedWidth: ({ width }) => `every ${width}`,
      ranges: ({ ranges: buckets }) => `${buckets.length} ranges`,
      duration: ({ value, unit }) => `every ${value} ${unit}`,
    });
    deepStrictEqual([...GroupBy.discriminants], [...GroupByKind.literals]);
    deepStrictEqual(A.map(values, describeGrouping), ["exact, limited: false", "every 5", "0 ranges", "every 1 weeks"]);
    deepStrictEqual(
      A.map(values, (value) => [
        GroupBy.guards.exact(value),
        GroupBy.guards.fixedWidth(value),
        GroupBy.guards.ranges(value),
        GroupBy.guards.duration(value),
      ]),
      [
        [true, false, false, false],
        [false, true, false, false],
        [false, false, true, false],
        [false, false, false, true],
      ]
    );
    const bucketsNumbers = GroupBy.isAnyOf(["fixedWidth", "ranges"]);
    deepStrictEqual(A.map(values, bucketsNumbers), [false, true, true, false]);
  });

  it("defaults every option of an exact grouping to absent", () => {
    const grouping = ExactGrouping.make({ property: byTeam });
    assertNone(grouping.maxGroupCount);
    assertNone(grouping.defaultValue);
    assertNone(grouping.includeNullValues);
  });
});

// ---------------------------------------------------------------------------
// Request and response envelopes
// ---------------------------------------------------------------------------

describe("AggregateRequest", () => {
  lawful("AggregateRequest", AggregateRequest);

  const requestRoundTrips = roundTrips(AggregateRequest);
  const largestFirst = { type: "count", name: "count", direction: "DESC" };
  const unordered = { type: "count", name: "count" };
  const byTeamWire = { type: "exact", field: "team" };
  const byOfficeWire = { type: "exact", field: "office" };
  const byTeamWithNullsWire = { type: "exact", field: "team", includeNullValues: true };

  it("keeps the wire's singular metrics key on the encoded side only", () => {
    const facts: readonly [
      Equals<(typeof AggregateRequest.Encoded)["aggregation"], ReadonlyArray<typeof Aggregation.Encoded>>,
      Equals<(typeof AggregateRequest.Encoded)["groupBy"], ReadonlyArray<typeof GroupBy.Encoded>>,
      Equals<
        Exclude<(typeof AggregateRequest.Encoded)["accuracy"], undefined>,
        "REQUIRE_ACCURATE" | "ALLOW_APPROXIMATE"
      >,
      Equals<AggregateRequest["aggregations"], ReadonlyArray<Aggregation>>,
      Equals<AggregateRequest["accuracy"], O.Option<AccuracyRequirement>>,
    ] = [true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes a grouped, ordered request and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      yield* requestRoundTrips(
        {
          aggregation: [
            { type: "count", name: "count" },
            { type: "avg", name: "salary.avg", direction: "DESC", field: "salary" },
          ],
          groupBy: [{ type: "exact", field: "team" }],
          accuracy: "REQUIRE_ACCURATE",
        },
        AggregateRequest.make({
          aggregations: [
            CountAggregation.make({ name: nameOf("count") }),
            AverageAggregation.make({ property: bySalary, name: nameOf("salary.avg"), direction: O.some("desc") }),
          ],
          groupBy: [ExactGrouping.make({ property: byTeam })],
          accuracy: O.some("requireAccurate"),
        })
      );
    })
  );

  it.effect(
    "decodes an ungrouped request with a filter and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      yield* requestRoundTrips(
        {
          aggregation: [{ type: "max", name: "salary.max", field: "salary" }],
          where: { type: "eq", field: "active", value: true },
          groupBy: [],
        },
        AggregateRequest.make({
          aggregations: [MaxAggregation.make({ property: bySalary, name: nameOf("salary.max") })],
          where: O.some(
            EqualsFilter.make({
              property: PropertyByName.make({ apiName: PropertyApiName.make("active") }),
              value: true,
            })
          ),
        })
      );
    })
  );

  it.effect(
    "reads the filter as an object filter: a nested tree decodes, and JSON that is no filter is rejected",
    Effect.fnUntraced(function* () {
      const isActive = { type: "eq", field: "active", value: true };
      const request = yield* S.decodeUnknownEffect(AggregateRequest)({
        aggregation: [{ type: "count" }],
        groupBy: [],
        where: {
          type: "not",
          value: { type: "and", value: [isActive, { type: "isNull", field: "team", value: true }] },
        },
      });
      assertTrue(O.exists(request.where, S.is(ObjectFilter)));
      strictEqual(O.getOrThrow(request.where).type, "not");
      const rejected = yield* Effect.forEach(
        [
          { aggregation: [{ type: "count" }], groupBy: [], where: { active: true } },
          { aggregation: [{ type: "count" }], groupBy: [], where: { type: "eq", value: true } },
          { aggregation: [{ type: "count" }], groupBy: [], where: "active" },
          { aggregation: [{ type: "count" }], groupBy: [], where: { type: "between", field: "age", value: [1, 2] } },
        ],
        (wire) => Effect.exit(S.decodeUnknownEffect(AggregateRequest)(wire))
      );
      assertTrue(A.every(rejected, Exit.isFailure));
    })
  );

  it("defaults the groupings to none and the filter and accuracy to absent", () => {
    const request = AggregateRequest.make({ aggregations: [count()] });
    deepStrictEqual(request.groupBy, []);
    assertNone(request.where);
    assertNone(request.accuracy);
  });

  it.effect(
    "lets a metric order the result with no grouping or with exactly one",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(AggregateRequest)({ aggregation: [largestFirst], groupBy: [] }),
        rejects(AggregateRequest)({ aggregation: [largestFirst], groupBy: [byTeamWire] }),
        rejects(AggregateRequest)({ aggregation: [unordered, largestFirst], groupBy: [byTeamWire] }),
      ]);
      assertFalse(A.some(verdicts, identity));
    })
  );

  it.effect(
    "rejects a metric that orders the result across two or more groupings",
    Effect.fnUntraced(function* () {
      const rejected = yield* Effect.all([
        rejects(AggregateRequest)({ aggregation: [largestFirst], groupBy: [byTeamWire, byOfficeWire] }),
        rejects(AggregateRequest)({
          aggregation: [unordered, { type: "sum", field: "salary", direction: "ASC" }],
          groupBy: [byTeamWire, { type: "fixedWidth", field: "age", fixedWidth: 10 }, byOfficeWire],
        }),
      ]);
      const accepted = yield* rejects(AggregateRequest)({
        aggregation: [unordered],
        groupBy: [byTeamWire, byOfficeWire],
      });
      assertTrue(A.every(rejected, identity));
      assertFalse(accepted);
    })
  );

  it.effect(
    "rejects a metric that orders the result when a grouping keeps a null group",
    Effect.fnUntraced(function* () {
      const rejected = yield* rejects(AggregateRequest)({
        aggregation: [largestFirst],
        groupBy: [byTeamWithNullsWire],
      });
      const accepted = yield* Effect.all([
        rejects(AggregateRequest)({ aggregation: [unordered], groupBy: [byTeamWithNullsWire] }),
        rejects(AggregateRequest)({
          aggregation: [largestFirst],
          groupBy: [{ type: "exact", field: "team", includeNullValues: false }],
        }),
        rejects(AggregateRequest)({
          aggregation: [largestFirst],
          groupBy: [{ type: "exact", field: "team", defaultValue: "unassigned" }],
        }),
      ]);
      assertTrue(rejected);
      assertFalse(A.some(accepted, identity));
      assertNone(
        AggregateRequest.makeOption({
          aggregations: [pipe(count(), ordered("desc"))],
          groupBy: [exact(team, { includeNullValues: O.some(true) })],
        })
      );
    })
  );

  it("offers the ordering rules as a check that any envelope with metrics and groupings can adopt", () => {
    const ObjectSetAggregation = S.Struct({
      aggregations: S.Array(Aggregation),
      groupBy: S.Array(GroupBy),
      objectSet: S.Json,
    }).check(AggregationOrderingChecks);
    const adopts = S.is(ObjectSetAggregation);
    const largest = pipe(count(), ordered("desc"));
    const withNulls = exact(team, { includeNullValues: O.some(true) });
    deepStrictEqual(
      [
        adopts({ aggregations: [largest], groupBy: [], objectSet: null }),
        adopts({ aggregations: [largest], groupBy: [exact(team, {})], objectSet: null }),
        adopts({ aggregations: [largest], groupBy: [exact(team, {}), exact(age, {})], objectSet: null }),
        adopts({ aggregations: [largest], groupBy: [withNulls], objectSet: null }),
        adopts({ aggregations: [count()], groupBy: [withNulls, exact(age, {})], objectSet: null }),
      ],
      [true, true, false, false, true]
    );
  });

  it.effect(
    "names the rule that was broken in every invariant's failure",
    Effect.fnUntraced(function* () {
      const messages = yield* Effect.all([
        failureOf(Aggregation)({ type: "sum" }),
        failureOf(Aggregation)({ type: "sum", field: "salary", propertyIdentifier: zipOfAddressWire }),
        failureOf(GroupBy)({ type: "exact", field: "team", defaultValue: "none", includeNullValues: true }),
        failureOf(GroupBy)({ type: "duration", field: "hiredOn", value: 2, unit: "YEARS" }),
        failureOf(AggregateRequest)({ aggregation: [largestFirst], groupBy: [byTeamWire, byOfficeWire] }),
        failureOf(AggregateRequest)({ aggregation: [largestFirst], groupBy: [byTeamWithNullsWire] }),
      ]);
      const valid = yield* failureOf(AggregateRequest)({ aggregation: [largestFirst], groupBy: [byTeamWire] });
      const rules = [
        'Expected exactly one of "field" and "propertyIdentifier" to address a property, got neither',
        'Expected exactly one of "field" and "propertyIdentifier" to address a property, got both',
        "An exact grouping cannot set both a default value and a null group",
        "A duration grouping by weeks, months, quarters or years must have the value 1",
        "A metric can order the result only when there is at most one grouping",
        "A metric cannot order the result when a grouping keeps a null group",
      ];
      deepStrictEqual(
        A.zipWith(messages, rules, (message, rule) => Str.includes(rule)(message)),
        [true, true, true, true, true, true]
      );
      strictEqual(valid, "");
    })
  );

  it.effect(
    "rejects a request without its metrics or groupings, with an invalid member, or with an unknown accuracy",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(AggregateRequest)({ groupBy: [] }),
        rejects(AggregateRequest)({ aggregation: [unordered] }),
        rejects(AggregateRequest)({ aggregations: [unordered], groupBy: [] }),
        rejects(AggregateRequest)({ aggregation: [{ type: "sum" }], groupBy: [] }),
        rejects(AggregateRequest)({
          aggregation: [unordered],
          groupBy: [{ type: "duration", field: "hiredOn", value: 3, unit: "MONTHS" }],
        }),
        rejects(AggregateRequest)({ aggregation: [unordered], groupBy: [], accuracy: "ACCURATE" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

describe("AggregateResponse", () => {
  lawful("MetricResult", MetricResult);
  lawful("AggregationRow", AggregationRow);
  lawful("AggregateResponse", AggregateResponse);

  const responseRoundTrips = roundTrips(AggregateResponse);

  // The fixture OSDK's own client test feeds its aggregate call (packages/client/src/object/aggregate.test.ts).
  const clientFixture: typeof AggregateResponse.Encoded = {
    accuracy: "APPROXIMATE",
    data: [
      {
        group: { string: "hello" },
        metrics: [
          { name: "string.approximateDistinct", value: 1 },
          { name: "string.exactDistinct", value: 1 },
          { name: "id.max", value: 1 },
          { name: "id.avg", value: 1 },
        ],
      },
    ],
  };

  it.effect(
    "decodes the response fixture of the OSDK client test and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const metric = (name: string) => MetricResult.make({ name: MetricName.make(name), value: O.some(1) });
      yield* responseRoundTrips(
        clientFixture,
        AggregateResponse.make({
          accuracy: "approximate",
          data: [
            AggregationRow.make({
              group: { [GroupKey.make("string")]: "hello" },
              metrics: [
                metric("string.approximateDistinct"),
                metric("string.exactDistinct"),
                metric("id.max"),
                metric("id.avg"),
              ],
            }),
          ],
        })
      );
    })
  );

  it.effect(
    "decodes a null group, a range group, a metric without a value and the usage counters",
    Effect.fnUntraced(function* () {
      yield* responseRoundTrips(
        {
          excludedItems: 3,
          accuracy: "ACCURATE",
          data: [
            { group: { team: null }, metrics: [{ name: "count", value: 4 }, { name: "salary.min" }] },
            { group: { age: { startValue: 0, endValue: 18 } }, metrics: [{ name: "salary.avg", value: 1200.5 }] },
          ],
          computeUsage: 0.25,
        },
        AggregateResponse.make({
          excludedItems: O.some(3),
          accuracy: "accurate",
          data: [
            AggregationRow.make({
              group: { [GroupKey.make("team")]: null },
              metrics: [
                MetricResult.make({ name: MetricName.make("count"), value: O.some(4) }),
                MetricResult.make({ name: MetricName.make("salary.min") }),
              ],
            }),
            AggregationRow.make({
              group: { [GroupKey.make("age")]: { startValue: 0, endValue: 18 } },
              metrics: [MetricResult.make({ name: MetricName.make("salary.avg"), value: O.some(1200.5) })],
            }),
          ],
          computeUsage: O.some(0.25),
        })
      );
    })
  );

  it.effect(
    "keeps a null metric value distinct from an absent one",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(MetricResult);
      const explicit = yield* decode({ name: "salary.min", value: null });
      const absent = yield* decode({ name: "salary.min" });
      assertSome(explicit.value, null);
      assertNone(absent.value);
    })
  );

  it.effect(
    "rejects a response without accuracy or rows, a negative exclusion count and an unnamed metric",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(AggregateResponse)({ data: [] }),
        rejects(AggregateResponse)({ accuracy: "ACCURATE" }),
        rejects(AggregateResponse)({ accuracy: "accurate", data: [] }),
        rejects(AggregateResponse)({ accuracy: "ACCURATE", data: [], excludedItems: -1 }),
        rejects(AggregateResponse)({ accuracy: "ACCURATE", data: [{ group: {} }] }),
        rejects(AggregateResponse)({ accuracy: "ACCURATE", data: [{ group: {}, metrics: [{ value: 1 }] }] }),
        rejects(AggregateResponse)({ accuracy: "ACCURATE", data: [{ group: {}, metrics: [{ name: "", value: 1 }] }] }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "yields the single row of an ungrouped response and nothing for any other number of rows",
    Effect.fnUntraced(function* () {
      const single = yield* S.decodeEffect(AggregateResponse)(clientFixture);
      const empty = AggregateResponse.make({ accuracy: "accurate", data: [] });
      const double = AggregateResponse.make({ accuracy: "accurate", data: [...single.data, ...single.data] });
      const hasOnlyRow = O.isSome(ungroupedRow(single));
      assertTrue(hasOnlyRow);
      assertNone(ungroupedRow(empty));
      assertNone(ungroupedRow(double));
    })
  );
});

// ---------------------------------------------------------------------------
// The metric-name convention
// ---------------------------------------------------------------------------

describe("MetricKeyFromName", () => {
  lawful("CountKey", CountKey);
  lawful("PropertyMetricKey", PropertyMetricKey);
  lawful("MetricKey", MetricKey);
  lawful("MetricKeyFromName", MetricKeyFromName);

  const decodeKey = S.decodeEffect(MetricKeyFromName);
  const encodeKey = S.encodeEffect(MetricKeyFromName);
  const keyEquivalence = S.toEquivalence(MetricKey);

  it.effect(
    "parses the count and every property metric and prints them back unchanged",
    Effect.fnUntraced(function* () {
      const names = ["count", ...A.map(PropertyMetricKind.literals, (metric) => `salary.${metric}`)];
      const keys = yield* Effect.forEach(names, (name) => decodeKey(name));
      const expected: ReadonlyArray<MetricKey> = [
        CountKey.make({}),
        ...A.map(PropertyMetricKind.literals, (metric) => PropertyMetricKey.make({ property: salary, metric })),
      ];
      assertTrue(A.every(A.zip(keys, expected), ([key, wanted]) => keyEquivalence(key, wanted)));
      const printed = yield* Effect.forEach(keys, (key) => encodeKey(key));
      deepStrictEqual(printed, names);
    })
  );

  it.effect(
    "splits at the last dot, so a dotted property name survives where OSDK's two-piece split loses it",
    Effect.fnUntraced(function* () {
      const key = yield* decodeKey("address.zip.max");
      assertTrue(
        keyEquivalence(key, PropertyMetricKey.make({ property: PropertyApiName.make("address.zip"), metric: "max" }))
      );
      const printed = yield* encodeKey(key);
      strictEqual(printed, "address.zip.max");
      // OSDK reads `[property, metric] = name.split(".")`: property "address", metric "zip", value dropped.
      const trailing = yield* decodeKey("a..sum");
      assertTrue(
        keyEquivalence(trailing, PropertyMetricKey.make({ property: PropertyApiName.make("a."), metric: "sum" }))
      );
      const countProperty = yield* decodeKey("count.sum");
      assertTrue(
        keyEquivalence(
          countProperty,
          PropertyMetricKey.make({ property: PropertyApiName.make("count"), metric: "sum" })
        )
      );
    })
  );

  it.effect(
    "rejects names that are not the count and do not end in a metric",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(MetricKeyFromName)(""),
        rejects(MetricKeyFromName)("salary"),
        rejects(MetricKeyFromName)("salary.median"),
        rejects(MetricKeyFromName)("salary.count"),
        rejects(MetricKeyFromName)("salary:sum"),
        rejects(MetricKeyFromName)("salary.sum."),
        rejects(MetricKeyFromName)(".sum"),
        rejects(MetricKeyFromName)("$count"),
        rejects(MetricKeyFromName)(12),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it("constructs both cases through the union's cases and tells them apart", () => {
    const keys: ReadonlyArray<MetricKey> = [
      MetricKey.cases.count.make({}),
      MetricKey.cases.property.make({ property: salary, metric: "sum" }),
    ];
    const describeKey = MetricKey.match({
      count: () => "count",
      property: ({ property, metric }) => `${metric}(${property})`,
    });
    deepStrictEqual(A.map(keys, describeKey), ["count", "sum(salary)"]);
    deepStrictEqual(
      A.map(keys, (key) => [MetricKey.guards.count(key), MetricKey.guards.property(key)]),
      [
        [true, false],
        [false, true],
      ]
    );
    deepStrictEqual(A.map(keys, MetricKey.isAnyOf(["property"])), [false, true]);
  });

  it.prop(
    "gives a key to the count and to every metric addressed by a bare name, and to nothing else",
    [Arbitrary.schema(Aggregation)],
    ([aggregation]) =>
      O.isSome(metricKeyOf(aggregation)) ===
      Aggregation.match(aggregation, {
        count: () => true,
        sum: ({ property }) => PropertySelector.guards.property(property),
        avg: ({ property }) => PropertySelector.guards.property(property),
        min: ({ property }) => PropertySelector.guards.property(property),
        max: ({ property }) => PropertySelector.guards.property(property),
        approximateDistinct: ({ property }) => PropertySelector.guards.property(property),
        exactDistinct: ({ property }) => PropertySelector.guards.property(property),
        approximatePercentile: ({ property }) => PropertySelector.guards.property(property),
      }),
    { arbitrary: fcRuns(50) }
  );
});

// ---------------------------------------------------------------------------
// Regrouping a result row
// ---------------------------------------------------------------------------

describe("regroupMetrics", () => {
  lawful("PropertyMetricValues", PropertyMetricValues);
  lawful("MetricLookup", MetricLookup);

  const decodeRow = S.decodeUnknownEffect(AggregationRow);
  const lookupEquivalence = S.toEquivalence(MetricLookup);

  it.effect(
    "regroups the row of the OSDK client fixture by property and metric",
    Effect.fnUntraced(function* () {
      const row = yield* decodeRow({
        group: { string: "hello" },
        metrics: [
          { name: "string.approximateDistinct", value: 1 },
          { name: "string.exactDistinct", value: 1 },
          { name: "id.max", value: 1 },
          { name: "id.avg", value: 1 },
        ],
      });
      const expected = MetricLookup.make({
        properties: {
          [PropertyApiName.make("string")]: PropertyMetricValues.make({
            approximateDistinct: O.some(1),
            exactDistinct: O.some(1),
          }),
          [PropertyApiName.make("id")]: PropertyMetricValues.make({ max: O.some(1), avg: O.some(1) }),
        },
      });
      assertTrue(lookupEquivalence(regroupMetrics(row), expected));
    })
  );

  it.effect(
    "files the count, dotted properties and unconventional names, and skips metrics without a value",
    Effect.fnUntraced(function* () {
      const row = yield* decodeRow({
        group: {},
        metrics: [
          { name: "count", value: 12 },
          { name: "address.zip.max", value: "99501" },
          { name: "salary.min" },
          { name: "salary.sum", value: null },
          { name: "headcount", value: 12 },
          { name: "salary.median", value: 5 },
        ],
      });
      const lookup = regroupMetrics(row);
      const zip = PropertyMetricKey.make({ property: PropertyApiName.make("address.zip"), metric: "max" });
      const lowest = PropertyMetricKey.make({ property: salary, metric: "min" });
      const total = PropertyMetricKey.make({ property: salary, metric: "sum" });
      const average = PropertyMetricKey.make({ property: salary, metric: "avg" });
      assertSome(metricValue(lookup, CountKey.make({})), 12);
      assertSome(metricValue(lookup, zip), "99501");
      assertNone(metricValue(lookup, lowest));
      assertSome(metricValue(lookup, total), null);
      assertNone(metricValue(lookup, average));
      assertNone(metricValue(lookup, PropertyMetricKey.make({ property: team, metric: "max" })));
      deepStrictEqual<unknown>(lookup.aliased, { headcount: 12, "salary.median": 5 });
      deepStrictEqual<ReadonlyArray<string>>(R.keys(lookup.properties), ["address.zip", "salary"]);
      assertSome(pipe(lookup, metricValue(zip)), "99501");
    })
  );

  it("regroups a row without metrics into an empty lookup", () => {
    const lookup = regroupMetrics(AggregationRow.make({ group: {}, metrics: [] }));
    assertNone(lookup.count);
    deepStrictEqual(lookup.properties, {});
    deepStrictEqual(lookup.aliased, {});
  });

  it.effect(
    "finds every metric a constructor named, once the response echoes the names back",
    Effect.fnUntraced(function* () {
      const metrics = [count(), sum(salary), avg(salary), min(hiredOn), max(hiredOn), exactDistinct(team)];
      const row = AggregationRow.make({
        group: {},
        metrics: A.map(A.getSomes(A.map(metrics, (metric) => metric.name)), (name, index) =>
          MetricResult.make({ name, value: O.some(index) })
        ),
      });
      const lookup = regroupMetrics(row);
      const values = A.map(metrics, (metric) => O.flatMap(metricKeyOf(metric), (key) => metricValue(lookup, key)));
      deepStrictEqual(values, [O.some(0), O.some(1), O.some(2), O.some(3), O.some(4), O.some(5)]);
      deepStrictEqual(lookup.aliased, {});
      const names = yield* Effect.forEach(A.getSomes(A.map(metrics, metricKeyOf)), (key) =>
        S.encodeEffect(MetricKeyFromName)(key)
      );
      deepStrictEqual(names, ["count", "salary.sum", "salary.avg", "hiredOn.min", "hiredOn.max", "team.exactDistinct"]);
    })
  );
});

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

describe("constructors", () => {
  const aggregationEquivalence = S.toEquivalence(Aggregation);
  const groupByEquivalence = S.toEquivalence(GroupBy);
  const encodeAggregation = S.encodeEffect(Aggregation);
  const encodeRequest = S.encodeEffect(AggregateRequest);

  it.effect(
    "names each metric by the convention and addresses a bare name by the compact field key",
    Effect.fnUntraced(function* () {
      const wire = yield* Effect.forEach(
        [
          count(),
          sum(salary),
          avg(salary),
          min(salary),
          max(salary),
          approximateDistinct(salary),
          exactDistinct(salary),
          approximatePercentile(salary, 0.9),
        ],
        (metric) => encodeAggregation(metric)
      );
      deepStrictEqual(wire, [
        { type: "count", name: "count" },
        { type: "sum", name: "salary.sum", field: "salary" },
        { type: "avg", name: "salary.avg", field: "salary" },
        { type: "min", name: "salary.min", field: "salary" },
        { type: "max", name: "salary.max", field: "salary" },
        { type: "approximateDistinct", name: "salary.approximateDistinct", field: "salary" },
        { type: "exactDistinct", name: "salary.exactDistinct", field: "salary" },
        {
          type: "approximatePercentile",
          name: "salary.approximatePercentile",
          field: "salary",
          approximatePercentile: 0.9,
        },
      ]);
    })
  );

  it.effect(
    "accepts a selector and leaves a metric the convention cannot spell unnamed",
    Effect.fnUntraced(function* () {
      const metric = sum(zipOfAddress);
      assertNone(metric.name);
      assertNone(metricKeyOf(metric));
      const wire = yield* encodeAggregation(metric);
      deepStrictEqual(wire, { type: "sum", propertyIdentifier: zipOfAddressWire });
      assertTrue(aggregationEquivalence(sum(bySalary), sum(salary)));
    })
  );

  it("offers the data-first and the data-last form of every two-argument constructor", () => {
    assertTrue(aggregationEquivalence(approximatePercentile(salary, 0.5), pipe(salary, approximatePercentile(0.5))));
    assertTrue(
      aggregationEquivalence(
        named(count(), MetricName.make("headcount")),
        pipe(count(), named(MetricName.make("headcount")))
      )
    );
    assertTrue(aggregationEquivalence(ordered(sum(salary), "asc"), pipe(sum(salary), ordered("asc"))));
    assertTrue(
      groupByEquivalence(exact(team, { maxGroupCount: O.some(3) }), pipe(team, exact({ maxGroupCount: O.some(3) })))
    );
    assertTrue(groupByEquivalence(fixedWidth(age, 10), pipe(age, fixedWidth(10))));
    const buckets = [AggregationRange.make({ startValue: 0, endValue: 18 })];
    assertTrue(groupByEquivalence(ranges(age, buckets), pipe(age, ranges(buckets))));
    assertTrue(groupByEquivalence(duration(hiredOn, 1, "months"), pipe(hiredOn, duration(1, "months"))));
  });

  it("renames and orders a metric without touching the rest of it", () => {
    const metric = pipe(max(salary), named(MetricName.make("topSalary")), ordered("desc"));
    assertSome(metric.name, MetricName.make("topSalary"));
    assertSome(metric.direction, "desc");
    strictEqual(metric.type, "max");
    assertTrue(S.toEquivalence(PropertySelector)(metric.property, bySalary));
    assertTrue(S.is(MaxAggregation)(metric));
  });

  it.effect(
    "builds the request the OSDK client would send for the same question",
    Effect.fnUntraced(function* () {
      const request = AggregateRequest.make({
        aggregations: [pipe(count(), ordered("desc")), avg(salary)],
        groupBy: [exact(team, { maxGroupCount: O.some(50) })],
      });
      const wire = yield* encodeRequest(request);
      deepStrictEqual(wire, {
        aggregation: [
          { type: "count", name: "count", direction: "DESC" },
          { type: "avg", name: "salary.avg", field: "salary" },
        ],
        groupBy: [{ type: "exact", field: "team", maxGroupCount: 50 }],
      });
    })
  );
});

// ---------------------------------------------------------------------------
// Policy tables
// ---------------------------------------------------------------------------

describe("policy tables", () => {
  it("are total over the property type tags, in the kernel's order", () => {
    deepStrictEqual(R.keys(allowedMetrics), [...PropertyTypeKind.literals]);
    deepStrictEqual(R.keys(allowedGroupings), [...PropertyTypeKind.literals]);
    deepStrictEqual(R.keys(durationUnits), [...TemporalKind.literals]);
    deepStrictEqual(R.keys(metricResultKind), [...AggregationKind.literals]);
  });

  it("lets every property be counted distinctly and keeps the object count out of the property metrics", () => {
    assertTrue(
      A.every(PropertyTypeKind.literals, (kind) =>
        A.every(["approximateDistinct", "exactDistinct"], (metric) => A.contains(allowedMetrics[kind], metric))
      )
    );
    assertTrue(A.every(R.values(allowedMetrics), A.every(S.is(PropertyMetricKind))));
  });

  it("gives the sum, the average and the percentile to exactly the numeric types", () => {
    const arithmetic = A.filter(PropertyTypeKind.literals, (kind) => A.contains(allowedMetrics[kind], "sum"));
    deepStrictEqual(arithmetic, [...NumericKind.literals]);
    assertTrue(
      A.every(NumericKind.literals, (kind) =>
        A.every(["sum", "avg", "min", "max", "approximatePercentile"], (metric) =>
          A.contains(allowedMetrics[kind], metric)
        )
      )
    );
  });

  it("gives the smallest and the largest value to numbers, dates and timestamps only", () => {
    const ordered = A.filter(PropertyTypeKind.literals, (kind) => A.contains(allowedMetrics[kind], "min"));
    deepStrictEqual(ordered, [...NumericKind.literals, ...TemporalKind.literals]);
    deepStrictEqual(allowedMetrics.date, ["min", "max", "approximateDistinct", "exactDistinct"]);
    deepStrictEqual(allowedMetrics.string, ["approximateDistinct", "exactDistinct"]);
  });

  it("groups a 64-bit integer like every other number, fixing the row OSDK leaves out", () => {
    deepStrictEqual(allowedGroupings.long, ["exact", "fixedWidth", "ranges"]);
    assertTrue(A.every(NumericKind.literals, (kind) => allowedGroupings[kind] === allowedGroupings.long));
  });

  it("groups strings and booleans exactly, times by duration, and nothing else at all", () => {
    deepStrictEqual(allowedGroupings.string, ["exact"]);
    deepStrictEqual(allowedGroupings.boolean, ["exact"]);
    deepStrictEqual(allowedGroupings.date, ["exact", "ranges", "duration"]);
    deepStrictEqual(allowedGroupings.timestamp, ["exact", "ranges", "duration"]);
    const groupable = A.filter(PropertyTypeKind.literals, (kind) => A.isReadonlyArrayNonEmpty(allowedGroupings[kind]));
    deepStrictEqual(groupable, ["boolean", ...NumericKind.literals, "string", ...TemporalKind.literals]);
    const durations = A.filter(PropertyTypeKind.literals, (kind) => A.contains(allowedGroupings[kind], "duration"));
    deepStrictEqual(durations, [...TemporalKind.literals]);
  });

  it("keeps sub-day duration units to timestamps", () => {
    deepStrictEqual(durationUnits.date, ["days", "weeks", "months", "years", "quarters"]);
    deepStrictEqual(A.difference(durationUnits.timestamp, durationUnits.date), [
      "milliseconds",
      "seconds",
      "minutes",
      "hours",
    ]);
    deepStrictEqual(
      durationUnits.timestamp,
      A.map(TimeUnit.Pairs, ([, unit]) => unit)
    );
  });

  it("says which metrics count, which compute and which keep the property's type", () => {
    deepStrictEqual(metricResultKind, {
      count: "integer",
      sum: "numeric",
      avg: "numeric",
      min: "sameAsProperty",
      max: "sameAsProperty",
      approximateDistinct: "integer",
      exactDistinct: "integer",
      approximatePercentile: "numeric",
    });
    assertTrue(A.every(R.values(metricResultKind), S.is(MetricResultKind)));
  });

  it("looks through arrays to the element type and reads every other type from its own row", () => {
    const scores = ArrayType.make({ elementType: IntegerType.make({}) });
    const nested = ArrayType.make({ elementType: ArrayType.make({ elementType: TimestampType.make({}) }) });
    strictEqual(metricsFor(scores), allowedMetrics.integer);
    strictEqual(groupingsFor(scores), allowedGroupings.integer);
    strictEqual(metricsFor(nested), allowedMetrics.timestamp);
    strictEqual(groupingsFor(nested), allowedGroupings.timestamp);
    strictEqual(metricsFor(DoubleType.make({})), allowedMetrics.double);
    strictEqual(metricsFor(DateType.make({})), allowedMetrics.date);
    strictEqual(groupingsFor(LongType.make({})), allowedGroupings.long);
    strictEqual(groupingsFor(StringType.make({})), allowedGroupings.string);
    deepStrictEqual(groupingsFor(GeoPointType.make({})), []);
  });
});

// ---------------------------------------------------------------------------
// Checking a request against an object type
// ---------------------------------------------------------------------------

lawful("UnknownAggregatedProperty", UnknownAggregatedProperty);
lawful("MetricNotAllowed", MetricNotAllowed);
lawful("GroupingNotAllowed", GroupingNotAllowed);
lawful("DurationUnitNotAllowed", DurationUnitNotAllowed);
lawful("AggregationViolation", AggregationViolation);

describe("checkAggregation", () => {
  const rid = PropertyTypeRid.make("ri.ontology.main.property.example");
  const fullName = PropertyApiName.make("fullName");
  const scores = PropertyApiName.make("scores");
  const address = PropertyApiName.make("address");
  const seenAt = PropertyApiName.make("seenAt");
  const desk = PropertyApiName.make("desk");
  const declare = (dataType: PropertyType) => PropertyDefinition.make({ dataType, rid });
  const properties = R.fromEntries([
    [salary, declare(DoubleType.make({}))],
    [age, declare(IntegerType.make({}))],
    [team, declare(StringType.make({}))],
    [fullName, declare(StringType.make({}))],
    [hiredOn, declare(DateType.make({}))],
    [seenAt, declare(TimestampType.make({}))],
    [desk, declare(GeoPointType.make({}))],
    [scores, declare(ArrayType.make({ elementType: IntegerType.make({}) }))],
    [
      address,
      declare(
        StructType.make({
          fields: [
            StructFieldType.make({
              apiName: StructFieldApiName.make("zip"),
              rid: StructFieldTypeRid.make("ri.struct.zip"),
              dataType: StringType.make({}),
            }),
          ],
        })
      ),
    ],
  ]);
  const selectorOf = (apiName: PropertyApiName) => PropertyByName.make({ apiName });
  const check = checkAggregation(properties);

  it("finds nothing wrong with a request every row of the tables admits", () => {
    deepStrictEqual(
      check({
        aggregations: [
          count(),
          sum(salary),
          avg(age),
          max(hiredOn),
          min(seenAt),
          exactDistinct(team),
          approximateDistinct(desk),
          approximatePercentile(salary, 0.5),
          sum(scores),
        ],
        groupBy: [
          exact(team, {}),
          fixedWidth(age, 10),
          duration(hiredOn, 1, "months"),
          duration(seenAt, 6, "hours"),
          exact(scores, {}),
          exact(zipOfAddress, {}),
        ],
      }),
      []
    );
  });

  it("reports a metric the property's type does not admit, with the metrics it does", () => {
    deepStrictEqual(check({ aggregations: [sum(fullName), avg(hiredOn), max(team)], groupBy: [] }), [
      MetricNotAllowed.make({
        metric: "sum",
        property: selectorOf(fullName),
        propertyType: "string",
        allowed: ["approximateDistinct", "exactDistinct"],
      }),
      MetricNotAllowed.make({
        metric: "avg",
        property: selectorOf(hiredOn),
        propertyType: "date",
        allowed: ["min", "max", "approximateDistinct", "exactDistinct"],
      }),
      MetricNotAllowed.make({
        metric: "max",
        property: selectorOf(team),
        propertyType: "string",
        allowed: ["approximateDistinct", "exactDistinct"],
      }),
    ]);
  });

  it("reports a way of grouping the property's type does not admit, with the ways it does", () => {
    deepStrictEqual(
      check({ aggregations: [count()], groupBy: [fixedWidth(fullName, 10), duration(age, 1, "days"), exact(desk, {})] }),
      [
        GroupingNotAllowed.make({
          grouping: "fixedWidth",
          property: selectorOf(fullName),
          propertyType: "string",
          allowed: ["exact"],
        }),
        GroupingNotAllowed.make({
          grouping: "duration",
          property: selectorOf(age),
          propertyType: "integer",
          allowed: ["exact", "fixedWidth", "ranges"],
        }),
        GroupingNotAllowed.make({ grouping: "exact", property: selectorOf(desk), propertyType: "geopoint", allowed: [] }),
      ]
    );
  });

  it("reports a duration unit a calendar date has no use for, and admits the same unit on a timestamp", () => {
    deepStrictEqual(check({ aggregations: [], groupBy: [duration(hiredOn, 6, "hours"), duration(seenAt, 6, "hours")] }), [
      DurationUnitNotAllowed.make({
        property: selectorOf(hiredOn),
        propertyType: "date",
        unit: "hours",
        allowed: ["days", "weeks", "months", "years", "quarters"],
      }),
    ]);
  });

  it("reports a property and a struct field the table does not declare, for metrics and for groupings", () => {
    const bonus = PropertyApiName.make("bonus");
    const cityOfAddress = StructFieldOfProperty.make({
      propertyApiName: address,
      structFieldApiName: StructFieldApiName.make("city"),
    });
    deepStrictEqual(
      check({ aggregations: [sum(bonus), exactDistinct(cityOfAddress)], groupBy: [exact(bonus, {})] }),
      [
        UnknownAggregatedProperty.make({ operation: "sum", property: selectorOf(bonus) }),
        UnknownAggregatedProperty.make({ operation: "exactDistinct", property: cityOfAddress }),
        UnknownAggregatedProperty.make({ operation: "exact", property: selectorOf(bonus) }),
      ]
    );
  });

  it("holds an array to its element's row, and names the element's tag in the finding", () => {
    const tags = PropertyApiName.make("tags");
    const withTags = R.set(properties, tags, declare(ArrayType.make({ elementType: StringType.make({}) })));
    deepStrictEqual(checkAggregation({ aggregations: [sum(scores), sum(tags)], groupBy: [] }, withTags), [
      MetricNotAllowed.make({
        metric: "sum",
        property: selectorOf(tags),
        propertyType: "string",
        allowed: ["approximateDistinct", "exactDistinct"],
      }),
    ]);
  });

  it("checks the title, the primary key and a selector with a load level for existence only", () => {
    const atLevel = (apiName: PropertyApiName) =>
      PropertyAtLoadLevel.make({ selector: selectorOf(apiName), loadLevel: "applyReducers" });
    deepStrictEqual(
      check({
        aggregations: [sum(TitleProperty.make({})), sum(PrimaryKeyProperty.make({})), sum(atLevel(fullName))],
        groupBy: [fixedWidth(TitleProperty.make({}), 10)],
      }),
      []
    );
    deepStrictEqual(check({ aggregations: [sum(atLevel(PropertyApiName.make("bonus")))], groupBy: [] }), [
      UnknownAggregatedProperty.make({ operation: "sum", property: atLevel(PropertyApiName.make("bonus")) }),
    ]);
  });

  it("reports metrics before groupings, each in request order, and never the object count", () => {
    const kinds = A.map(
      check({
        aggregations: [count(), sum(fullName), count(), sum(PropertyApiName.make("bonus"))],
        groupBy: [fixedWidth(fullName, 10), duration(hiredOn, 1, "minutes")],
      }),
      (violation) => violation.type
    );
    deepStrictEqual(kinds, ["metricNotAllowed", "unknownProperty", "groupingNotAllowed", "durationUnitNotAllowed"]);
  });

  it("checks both request envelopes, data-first and data-last", () => {
    const request = AggregateRequest.make({ aggregations: [sum(fullName)], groupBy: [exact(team, {})] });
    const expected = [
      MetricNotAllowed.make({
        metric: "sum",
        property: selectorOf(fullName),
        propertyType: "string",
        allowed: ["approximateDistinct", "exactDistinct"],
      }),
    ];
    deepStrictEqual(checkAggregation(request, properties), expected);
    deepStrictEqual(pipe(request, checkAggregation(properties)), expected);
  });

  it("matches every violation exhaustively and guards each case", () => {
    const explain = AggregationViolation.match({
      unknownProperty: ({ operation }) => `${operation} reads an undeclared property`,
      metricNotAllowed: ({ metric, propertyType }) => `${metric} does not apply to ${propertyType}`,
      groupingNotAllowed: ({ grouping, propertyType }) => `${propertyType} cannot be grouped by ${grouping}`,
      durationUnitNotAllowed: ({ unit, propertyType }) => `a ${propertyType} has no ${unit}`,
    });
    const violations = check({
      aggregations: [sum(fullName), sum(PropertyApiName.make("bonus"))],
      groupBy: [fixedWidth(fullName, 10), duration(hiredOn, 1, "minutes")],
    });
    deepStrictEqual(A.map(violations, explain), [
      "sum does not apply to string",
      "sum reads an undeclared property",
      "string cannot be grouped by fixedWidth",
      "a date has no minutes",
    ]);
    deepStrictEqual(R.keys(AggregationViolation.cases), [
      "unknownProperty",
      "metricNotAllowed",
      "groupingNotAllowed",
      "durationUnitNotAllowed",
    ]);
    assertTrue(A.every(violations, S.is(AggregationViolation)));
    deepStrictEqual(
      A.map(violations, AggregationViolation.guards.metricNotAllowed),
      [true, false, false, false]
    );
  });

  // The validator and the tables say the same thing: for any property type and any metric or way of grouping,
  // the request is reported exactly when the type's row leaves the operation out.
  const metricOf: { readonly [Kind in PropertyMetricKind]: (property: PropertyApiName) => Aggregation } = {
    sum,
    avg,
    min,
    max,
    approximateDistinct,
    exactDistinct,
    approximatePercentile: approximatePercentile(0.5),
  };
  const groupingOf: { readonly [Kind in GroupByKind]: (property: PropertyApiName) => GroupBy } = {
    exact: exact({}),
    fixedWidth: fixedWidth(10),
    ranges: ranges([]),
    duration: duration(1, "days"),
  };
  const only = PropertyApiName.make("only");

  it.prop(
    "a metric is reported exactly when the table leaves it out of the property's row",
    [Arbitrary.schema(PropertyType), Arbitrary.schema(PropertyMetricKind)],
    ([dataType, metric]) => {
      const violations = checkAggregation(
        { aggregations: [metricOf[metric](only)], groupBy: [] },
        R.singleton(only, declare(dataType))
      );
      return A.contains(metricsFor(dataType), metric)
        ? A.isReadonlyArrayEmpty(violations)
        : A.length(violations) === 1 && A.every(violations, AggregationViolation.guards.metricNotAllowed);
    },
    { arbitrary: fcRuns(200) }
  );

  it.prop(
    "a grouping is reported exactly when the table leaves it out of the property's row",
    [Arbitrary.schema(PropertyType), Arbitrary.schema(GroupByKind)],
    ([dataType, grouping]) => {
      const violations = checkAggregation(
        { aggregations: [], groupBy: [groupingOf[grouping](only)] },
        R.singleton(only, declare(dataType))
      );
      return A.contains(groupingsFor(dataType), grouping)
        ? A.isReadonlyArrayEmpty(violations)
        : A.length(violations) === 1 && A.every(violations, AggregationViolation.guards.groupingNotAllowed);
    },
    { arbitrary: fcRuns(200) }
  );
});
