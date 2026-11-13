/**
 * Behavior of aggregations: the metric-name convention, the regrouped view of a result row, and constructors.
 *
 * **Details**
 *
 * A request names each metric and the response returns a flat list of
 * `{ name, value }` per row. The convention that ties the two together is
 * `count` for the object count and `<property>.<metric>` for everything else.
 * OSDK implements it three times with string surgery (a request key cut at
 * the last `:`, a wire name joined with `.`, a result name cut by
 * `name.split(".")`). Here it is one codec, {@link MetricKeyFromName}, and
 * the constructors and the regrouping fold are written against it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, flow } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { PropertyByName, PropertySelector } from "../Property/Property.model.ts";
import {
  Aggregation,
  ApproximateDistinctAggregation,
  ApproximatePercentileAggregation,
  AverageAggregation,
  CountAggregation,
  CountKey,
  DurationGrouping,
  ExactDistinctAggregation,
  ExactGrouping,
  FixedWidthGrouping,
  MaxAggregation,
  MetricKey,
  MetricLookup,
  MetricName,
  MinAggregation,
  PropertyMetricKey,
  PropertyMetricKind,
  PropertyMetricValues,
  RangesGrouping,
  SumAggregation,
} from "./Aggregation.model.ts";
import type { PropertyApiName } from "../Identifier/Identifier.model.ts";
import type { TimeUnit } from "../TimeSeries/TimeSeries.model.ts";
import type { AggregateResponse, AggregationRange, AggregationRow, OrderDirection } from "./Aggregation.model.ts";

const $I = $ScratchpadId.create("osdk/Aggregation/Aggregation.behavior");

// -----------------------------------------------------------------------------
// The metric-name convention
// -----------------------------------------------------------------------------

const countName = "count";
const nameSeparator = ".";

const isPropertyMetricKind = S.is(PropertyMetricKind);

// The metric tags contain no dot, so the LAST dot of a conventional name always separates the property
// from the metric, however many dots the property's own name contains.
const splitAtLastDot = (name: string): O.Option<typeof PropertyMetricKey.Encoded> =>
  O.flatMap(Str.lastIndexOf(nameSeparator)(name), (dot) => {
    const metric = Str.slice(dot + 1)(name);
    return isPropertyMetricKind(metric)
      ? O.some({ type: "property", property: Str.slice(0, dot)(name), metric })
      : O.none();
  });

const parseMetricName = (name: string): Effect.Effect<typeof MetricKey.Encoded, SchemaIssue.Issue> =>
  name === countName
    ? Effect.succeed({ type: "count" })
    : Effect.mapError(
        Effect.fromOption(splitAtLastDot(name)),
        () => new SchemaIssue.InvalidValue({ message: 'Expected "count" or a "<property>.<metric>" metric name' }, name)
      );

const formatMetricKey = Match.type<typeof MetricKey.Encoded>().pipe(
  Match.discriminatorsExhaustive("type")({
    count: () => countName,
    property: ({ property, metric }) => `${property}${nameSeparator}${metric}`,
  })
);

/**
 * Codec between a conventional metric name and what it stands for.
 *
 * **Details**
 *
 * `count` is the object count; anything else is `<property>.<metric>`, split
 * at the LAST dot. The metric tags contain no dot, so a property name that
 * itself contains dots survives the round trip.
 *
 * OSDK cuts the names it reads back with `name.split(".")` and keeps the
 * first two pieces: `address.zip.max` becomes property `address`, metric
 * `zip`, the value is dropped as unrecognised, and the caller sees
 * `undefined`. On the request side it cuts its own `"prop:metric"` keys at
 * the last `:` and passes the metric on unchecked. Here a name whose last
 * piece is not a metric fails to decode instead of being silently dropped.
 *
 * **Example** (Keep the dots of a property name)
 *
 * ```ts import.meta.vitest name="Keep the dots of a property name"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MetricKey, MetricKeyFromName } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const key = await Effect.runPromise(S.decodeEffect(MetricKeyFromName)("address.zip.max"))
 * const parts = MetricKey.match(key, {
 *   count: () => ["", "count"],
 *   property: ({ property, metric }) => [property, metric],
 * })
 * const name = await Effect.runPromise(S.encodeEffect(MetricKeyFromName)(key))
 * const facts = [parts, name]
 * facts // => [["address.zip", "max"], "address.zip.max"]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const MetricKeyFromName = S.String.pipe(
  S.decodeTo(
    MetricKey,
    SchemaTransformation.transformEffect({
      decode: parseMetricName,
      encode: flow(formatMetricKey, Effect.succeed),
    })
  ),
  $I.annoteSchema("MetricKeyFromName", {
    description: "A conventional metric name, parsed into the object count or one metric of one property.",
  })
);

/**
 * Runtime type of {@link MetricKeyFromName}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type MetricKeyFromName = typeof MetricKeyFromName.Type;

const conventionalName = (key: MetricKey): MetricName => MetricName.make(formatMetricKey(key));

const keyOfPropertyMetric = ({
  type,
  property,
}: {
  readonly type: PropertyMetricKind;
  readonly property: PropertySelector;
}): O.Option<MetricKey> =>
  PropertySelector.matchOrElse(
    property,
    { property: ({ apiName }) => O.some(PropertyMetricKey.make({ property: apiName, metric: type })) },
    () => O.none()
  );

/**
 * The key a metric has under the naming convention, when it has one.
 *
 * **Details**
 *
 * The count always has a key. A property metric has one when it addresses
 * its property by a bare name; the convention has no spelling for struct
 * fields, load levels or roles, so those yield `None` and need an explicit
 * name.
 *
 * **Example** (Find the key of a metric)
 *
 * ```ts import.meta.vitest name="Find the key of a metric"
 * import * as O from "effect/Option"
 * import { max, metricKeyOf } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { TitleProperty } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const byName = O.isSome(metricKeyOf(max(PropertyApiName.make("salary"))))
 * const byRole = O.isSome(metricKeyOf(max(TitleProperty.make({}))))
 * const facts = [byName, byRole]
 * facts // => [true, false]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const metricKeyOf: (aggregation: Aggregation) => O.Option<MetricKey> = Aggregation.match({
  count: () => O.some(CountKey.make({})),
  sum: keyOfPropertyMetric,
  avg: keyOfPropertyMetric,
  min: keyOfPropertyMetric,
  max: keyOfPropertyMetric,
  approximateDistinct: keyOfPropertyMetric,
  exactDistinct: keyOfPropertyMetric,
  approximatePercentile: keyOfPropertyMetric,
});

// -----------------------------------------------------------------------------
// Regrouping a result row
// -----------------------------------------------------------------------------

const decodeMetricKey = S.decodeOption(MetricKeyFromName);

const metricsOf = (lookup: MetricLookup, property: PropertyApiName): PropertyMetricValues =>
  O.getOrElse(R.get(lookup.properties, property), () => PropertyMetricValues.make({}));

const placeMetric = (lookup: MetricLookup, name: MetricName, value: S.Json): MetricLookup =>
  O.match(decodeMetricKey(name), {
    onNone: () => MetricLookup.make({ ...lookup, aliased: R.set(lookup.aliased, name, value) }),
    onSome: MetricKey.match({
      count: () => MetricLookup.make({ ...lookup, count: O.some(value) }),
      property: ({ property, metric }) =>
        MetricLookup.make({
          ...lookup,
          properties: R.set(
            lookup.properties,
            property,
            PropertyMetricValues.make({ ...metricsOf(lookup, property), [metric]: O.some(value) })
          ),
        }),
    }),
  });

/**
 * Regroups one result row's flat list of named metric values into a lookup by property and metric.
 *
 * **Details**
 *
 * A metric without a value (nothing to compute it from) leaves no entry, so
 * reading it yields `None` either way. A name that does not follow the
 * convention is kept under `aliased`. OSDK instead seeds `undefined` for
 * every metric it asked for and drops every name it did not ask for.
 *
 * **Example** (Regroup a row)
 *
 * ```ts import.meta.vitest name="Regroup a row"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { AggregationRow, regroupMetrics } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const row = await Effect.runPromise(
 *   S.decodeEffect(AggregationRow)({
 *     group: { team: "platform" },
 *     metrics: [
 *       { name: "count", value: 12 },
 *       { name: "salary.avg", value: 91000 },
 *       { name: "salary.max", value: 140000 },
 *       { name: "headcount", value: 12 },
 *     ],
 *   })
 * )
 * const lookup = regroupMetrics(row)
 * const salary = O.map(R.get(lookup.properties, PropertyApiName.make("salary")), ({ avg, max }) => [avg, max])
 * const facts = [lookup.count, salary, lookup.aliased]
 * facts // => [O.some(12), O.some([O.some(91000), O.some(140000)]), { headcount: 12 }]
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const regroupMetrics = (row: AggregationRow): MetricLookup =>
  A.reduce(row.metrics, MetricLookup.make({}), (lookup, { name, value }) =>
    O.match(value, {
      onNone: () => lookup,
      onSome: (present) => placeMetric(lookup, name, present),
    })
  );

/**
 * Reads the value of one metric out of a regrouped row.
 *
 * **Example** (Read a metric by its key)
 *
 * ```ts import.meta.vitest name="Read a metric by its key"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import {
 *   AggregationRow,
 *   CountKey,
 *   metricValue,
 *   PropertyMetricKey,
 *   regroupMetrics,
 * } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const row = await Effect.runPromise(
 *   S.decodeEffect(AggregationRow)({ group: {}, metrics: [{ name: "count", value: 3 }, { name: "age.min" }] })
 * )
 * const lookup = regroupMetrics(row)
 * const youngest = PropertyMetricKey.make({ property: PropertyApiName.make("age"), metric: "min" })
 * const total = O.getOrNull(metricValue(lookup, CountKey.make({})))
 * const facts = [total, O.isNone(pipe(lookup, metricValue(youngest)))]
 * facts // => [3, true]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const metricValue: {
  (key: MetricKey): (lookup: MetricLookup) => O.Option<S.Json>;
  (lookup: MetricLookup, key: MetricKey): O.Option<S.Json>;
} = dual(
  2,
  (lookup: MetricLookup, key: MetricKey): O.Option<S.Json> =>
    MetricKey.match(key, {
      count: () => lookup.count,
      property: ({ property, metric }) => O.flatMap(R.get(lookup.properties, property), (values) => values[metric]),
    })
);

/**
 * The single row of an aggregation that had no groupings.
 *
 * **Details**
 *
 * Without groupings every object falls into one group, so the response has
 * exactly one row. OSDK asserts this with a thrown invariant; here a response
 * with any other number of rows yields `None`.
 *
 * **Example** (Take the only row)
 *
 * ```ts import.meta.vitest name="Take the only row"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { AggregateResponse, ungroupedRow } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const decode = S.decodeUnknownEffect(AggregateResponse)
 * const row = { group: {}, metrics: [{ name: "count", value: 3 }] }
 * const one = await Effect.runPromise(decode({ accuracy: "ACCURATE", data: [row] }))
 * const two = await Effect.runPromise(decode({ accuracy: "ACCURATE", data: [row, row] }))
 * const facts = [O.isSome(ungroupedRow(one)), O.isSome(ungroupedRow(two))]
 * facts // => [true, false]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const ungroupedRow = (response: AggregateResponse): O.Option<AggregationRow> =>
  response.data.length === 1 ? A.head(response.data) : O.none();

// -----------------------------------------------------------------------------
// Constructors
// -----------------------------------------------------------------------------

const toSelector = (property: PropertySelector | PropertyApiName): PropertySelector =>
  P.isString(property) ? PropertyByName.make({ apiName: property }) : property;

// Every constructor names its metric by the convention when the convention has a spelling for it, which is
// what makes the response's flat list regroup into a lookup without the caller keeping a side table.
const conventionallyNamed = <Metric extends Aggregation>(aggregation: Metric): Metric => ({
  ...aggregation,
  name: O.map(metricKeyOf(aggregation), conventionalName),
});

/**
 * Counts the objects in each group, named `count`.
 *
 * **Example** (Count objects)
 *
 * ```ts import.meta.vitest name="Count objects"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Aggregation, count } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(Aggregation)(count()))
 * wire // => { type: "count", name: "count" }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const count = (): CountAggregation => conventionallyNamed(CountAggregation.make({}));

/**
 * Adds up a numeric property over each group, named `<property>.sum` when addressed by name.
 *
 * **Example** (Sum a property)
 *
 * ```ts import.meta.vitest name="Sum a property"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Aggregation, sum } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(Aggregation)(sum(PropertyApiName.make("salary"))))
 * wire // => { type: "sum", field: "salary", name: "salary.sum" }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const sum = (property: PropertySelector | PropertyApiName): SumAggregation =>
  conventionallyNamed(SumAggregation.make({ property: toSelector(property) }));

/**
 * Averages a numeric property over each group, named `<property>.avg` when addressed by name.
 *
 * **Example** (Average a property)
 *
 * ```ts import.meta.vitest name="Average a property"
 * import * as O from "effect/Option"
 * import { avg } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const metric = avg(PropertyApiName.make("salary"))
 * const facts = [metric.type, O.getOrNull(metric.name)]
 * facts // => ["avg", "salary.avg"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const avg = (property: PropertySelector | PropertyApiName): AverageAggregation =>
  conventionallyNamed(AverageAggregation.make({ property: toSelector(property) }));

/**
 * Takes the smallest value of a property in each group, named `<property>.min` when addressed by name.
 *
 * **Example** (Take the earliest date)
 *
 * ```ts import.meta.vitest name="Take the earliest date"
 * import * as O from "effect/Option"
 * import { min } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const metric = min(PropertyApiName.make("hiredOn"))
 * const facts = [metric.type, O.getOrNull(metric.name)]
 * facts // => ["min", "hiredOn.min"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const min = (property: PropertySelector | PropertyApiName): MinAggregation =>
  conventionallyNamed(MinAggregation.make({ property: toSelector(property) }));

/**
 * Takes the largest value of a property in each group, named `<property>.max` when addressed by name.
 *
 * **Example** (Take the largest primary key)
 *
 * ```ts import.meta.vitest name="Take the largest primary key"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Aggregation, max } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PrimaryKeyProperty } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(Aggregation)(max(PrimaryKeyProperty.make({}))))
 * wire // => { type: "max", propertyIdentifier: { type: "primaryKeyProperty" } }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const max = (property: PropertySelector | PropertyApiName): MaxAggregation =>
  conventionallyNamed(MaxAggregation.make({ property: toSelector(property) }));

/**
 * Estimates the number of distinct values of a property in each group, named `<property>.approximateDistinct`.
 *
 * **Example** (Estimate distinct values)
 *
 * ```ts import.meta.vitest name="Estimate distinct values"
 * import * as O from "effect/Option"
 * import { approximateDistinct } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const metric = approximateDistinct(PropertyApiName.make("office"))
 * O.getOrNull(metric.name) // => "office.approximateDistinct"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const approximateDistinct = (property: PropertySelector | PropertyApiName): ApproximateDistinctAggregation =>
  conventionallyNamed(ApproximateDistinctAggregation.make({ property: toSelector(property) }));

/**
 * Counts exactly the distinct values of a property in each group, named `<property>.exactDistinct`.
 *
 * **Example** (Count distinct values exactly)
 *
 * ```ts import.meta.vitest name="Count distinct values exactly"
 * import * as O from "effect/Option"
 * import { exactDistinct } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const metric = exactDistinct(PropertyApiName.make("office"))
 * O.getOrNull(metric.name) // => "office.exactDistinct"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const exactDistinct = (property: PropertySelector | PropertyApiName): ExactDistinctAggregation =>
  conventionallyNamed(ExactDistinctAggregation.make({ property: toSelector(property) }));

/**
 * Estimates a percentile of a numeric property in each group, named `<property>.approximatePercentile`.
 *
 * **Example** (Estimate the median)
 *
 * ```ts import.meta.vitest name="Estimate the median"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as S from "effect/Schema"
 * import { Aggregation, approximatePercentile, MetricName, named } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const median = pipe(PropertyApiName.make("age"), approximatePercentile(0.5), named(MetricName.make("median")))
 * const wire = await Effect.runPromise(S.encodeEffect(Aggregation)(median))
 * wire // => { type: "approximatePercentile", field: "age", name: "median", approximatePercentile: 0.5 }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const approximatePercentile: {
  (percentile: number): (property: PropertySelector | PropertyApiName) => ApproximatePercentileAggregation;
  (property: PropertySelector | PropertyApiName, percentile: number): ApproximatePercentileAggregation;
} = dual(
  2,
  (property: PropertySelector | PropertyApiName, percentile: number): ApproximatePercentileAggregation =>
    conventionallyNamed(ApproximatePercentileAggregation.make({ property: toSelector(property), percentile }))
);

/**
 * Gives a metric the name under which its value comes back.
 *
 * **Example** (Rename a metric)
 *
 * ```ts import.meta.vitest name="Rename a metric"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import { count, MetricName, named } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const headcount = pipe(count(), named(MetricName.make("headcount")))
 * O.getOrNull(headcount.name) // => "headcount"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const named: {
  (name: MetricName): <Metric extends Aggregation>(aggregation: Metric) => Metric;
  <Metric extends Aggregation>(aggregation: Metric, name: MetricName): Metric;
} = dual(
  2,
  <Metric extends Aggregation>(aggregation: Metric, name: MetricName): Metric => ({
    ...aggregation,
    name: O.some(name),
  })
);

/**
 * Makes a metric sort the result groups, smallest first or largest first.
 *
 * **Gotchas**
 *
 * A request may hold an ordering metric only with at most one grouping, and
 * never with a grouping that keeps a null group; `AggregateRequest` rejects
 * the combination.
 *
 * **Example** (Sort groups by their size)
 *
 * ```ts import.meta.vitest name="Sort groups by their size"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as S from "effect/Schema"
 * import { Aggregation, count, ordered } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const largestFirst = pipe(count(), ordered("desc"))
 * const wire = await Effect.runPromise(S.encodeEffect(Aggregation)(largestFirst))
 * wire // => { type: "count", name: "count", direction: "DESC" }
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const ordered: {
  (direction: OrderDirection): <Metric extends Aggregation>(aggregation: Metric) => Metric;
  <Metric extends Aggregation>(aggregation: Metric, direction: OrderDirection): Metric;
} = dual(
  2,
  <Metric extends Aggregation>(aggregation: Metric, direction: OrderDirection): Metric => ({
    ...aggregation,
    direction: O.some(direction),
  })
);

/**
 * Groups objects by the exact value of a property.
 *
 * **Details**
 *
 * The options are the grouping's own optional fields: a limit on the number
 * of groups, a value to file nulls under, or a null group of their own.
 *
 * **Gotchas**
 *
 * Like every `make`, this throws when the options contradict each other
 * (`defaultValue` together with `includeNullValues: true`). Decode untrusted
 * input instead.
 *
 * **Example** (Group by a value and keep the null group)
 *
 * ```ts import.meta.vitest name="Group by a value and keep the null group"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { exact, GroupBy } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const team = PropertyApiName.make("team")
 * const encode = S.encodeEffect(GroupBy)
 * const plain = await Effect.runPromise(encode(exact(team, {})))
 * const withNulls = await Effect.runPromise(
 *   encode(pipe(team, exact({ maxGroupCount: O.some(50), includeNullValues: O.some(true) })))
 * )
 * plain // => { type: "exact", field: "team" }
 * withNulls // => { type: "exact", field: "team", maxGroupCount: 50, includeNullValues: true }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const exact: {
  (
    options: Omit<Parameters<typeof ExactGrouping.make>[0], "type" | "property">
  ): (property: PropertySelector | PropertyApiName) => ExactGrouping;
  (
    property: PropertySelector | PropertyApiName,
    options: Omit<Parameters<typeof ExactGrouping.make>[0], "type" | "property">
  ): ExactGrouping;
} = dual(
  2,
  (
    property: PropertySelector | PropertyApiName,
    options: Omit<Parameters<typeof ExactGrouping.make>[0], "type" | "property">
  ): ExactGrouping => ExactGrouping.make({ ...options, property: toSelector(property) })
);

/**
 * Groups objects into numeric buckets of equal width.
 *
 * **Example** (Bucket ages by decade)
 *
 * ```ts import.meta.vitest name="Bucket ages by decade"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { fixedWidth, GroupBy } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(GroupBy)(fixedWidth(PropertyApiName.make("age"), 10)))
 * wire // => { type: "fixedWidth", field: "age", fixedWidth: 10 }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fixedWidth: {
  (width: number): (property: PropertySelector | PropertyApiName) => FixedWidthGrouping;
  (property: PropertySelector | PropertyApiName, width: number): FixedWidthGrouping;
} = dual(
  2,
  (property: PropertySelector | PropertyApiName, width: number): FixedWidthGrouping =>
    FixedWidthGrouping.make({ property: toSelector(property), width })
);

/**
 * Groups objects into the buckets the caller lists, each from an inclusive start to an exclusive end.
 *
 * **Example** (Bucket the working ages)
 *
 * ```ts import.meta.vitest name="Bucket the working ages"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AggregationRange, GroupBy, ranges } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const working = AggregationRange.make({ startValue: 18, endValue: 65 })
 * const wire = await Effect.runPromise(S.encodeEffect(GroupBy)(ranges(PropertyApiName.make("age"), [working])))
 * wire // => { type: "ranges", field: "age", ranges: [{ startValue: 18, endValue: 65 }] }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ranges: {
  (buckets: ReadonlyArray<AggregationRange>): (property: PropertySelector | PropertyApiName) => RangesGrouping;
  (property: PropertySelector | PropertyApiName, buckets: ReadonlyArray<AggregationRange>): RangesGrouping;
} = dual(
  2,
  (property: PropertySelector | PropertyApiName, buckets: ReadonlyArray<AggregationRange>): RangesGrouping =>
    RangesGrouping.make({ property: toSelector(property), ranges: buckets })
);

/**
 * Groups objects into buckets of elapsed time over a date or timestamp property.
 *
 * **Gotchas**
 *
 * Like every `make`, this throws when the value is not a whole number of at
 * least one, or is not exactly one for weeks, months, quarters and years.
 * Decode untrusted input instead.
 *
 * **Example** (Bucket hires by month)
 *
 * ```ts import.meta.vitest name="Bucket hires by month"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as S from "effect/Schema"
 * import { duration, GroupBy } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const hiredOn = PropertyApiName.make("hiredOn")
 * const encode = S.encodeEffect(GroupBy)
 * const monthly = await Effect.runPromise(encode(duration(hiredOn, 1, "months")))
 * const twiceDaily = await Effect.runPromise(encode(pipe(hiredOn, duration(12, "hours"))))
 * monthly // => { type: "duration", field: "hiredOn", value: 1, unit: "MONTHS" }
 * twiceDaily // => { type: "duration", field: "hiredOn", value: 12, unit: "HOURS" }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const duration: {
  (value: number, unit: TimeUnit): (property: PropertySelector | PropertyApiName) => DurationGrouping;
  (property: PropertySelector | PropertyApiName, value: number, unit: TimeUnit): DurationGrouping;
} = dual(
  3,
  (property: PropertySelector | PropertyApiName, value: number, unit: TimeUnit): DurationGrouping =>
    DurationGrouping.make({ property: toSelector(property), value, unit })
);
