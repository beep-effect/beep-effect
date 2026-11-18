/**
 * Which aggregations make sense for which property types, and the check that holds a request to it.
 *
 * **Details**
 *
 * OSDK decides this with conditional types (`AGG_FOR_TYPE`, `GroupByMapper`)
 * that exist only at compile time and only for its own request syntax. Here
 * the same facts are data: total tables keyed by the property type tag, which
 * the compiler checks for a missing or misspelled tag and which any validator,
 * form or query builder can read at runtime. {@link checkAggregation} is the
 * validator that reads them: it holds the metrics and groupings of a request
 * to a table of properties and returns every violation as a value.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { PropertyTypeKind, TemporalKind } from "../DataType/DataType.values.ts";
import { selectedType } from "../Property/Property.behavior.ts";
import { PropertySelector, PropertyType } from "../Property/Property.model.ts";
import { TimeUnit } from "../TimeSeries/TimeSeries.model.ts";
import { Aggregation, GroupBy, GroupByKind, PropertyMetricKind } from "./Aggregation.model.ts";
import type { PropertyApiName } from "../Identifier/Identifier.model.ts";
import type { PropertyDefinition } from "../Property/Property.model.ts";
import type { AggregationKind } from "./Aggregation.model.ts";

const $I = $ScratchpadId.create("osdk/Aggregation/Aggregation.policy");

// -----------------------------------------------------------------------------
// Property type -> metrics
// -----------------------------------------------------------------------------

const distinctCounts: ReadonlyArray<PropertyMetricKind> = ["approximateDistinct", "exactDistinct"];

const temporalMetrics: ReadonlyArray<PropertyMetricKind> = ["min", "max", "approximateDistinct", "exactDistinct"];

const numericMetrics: ReadonlyArray<PropertyMetricKind> = [
  "sum",
  "avg",
  "min",
  "max",
  "approximateDistinct",
  "exactDistinct",
  "approximatePercentile",
];

/**
 * The metrics that can be computed from a property of each type.
 *
 * **Details**
 *
 * Every property can be counted distinctly. Dates and timestamps also have a
 * smallest and a largest value. The seven numeric types add the sum, the
 * average and the percentile. Counting objects needs no property and is
 * always allowed, so `count` is not in the table.
 *
 * `approximatePercentile` is listed for the numeric types because the wire
 * offers it and a percentile is a numeric statistic; OSDK's object-set
 * `aggregate` cannot express it and only its derived-property builder can.
 *
 * The `array` row is what holds for any element type. OSDK erases arrays to
 * their element's tag and so applies the element's row; {@link metricsFor}
 * does the same from a full property type.
 *
 * **Example** (Look up the metrics of a type tag)
 *
 * ```ts import.meta.vitest name="Look up the metrics of a type tag"
 * import { allowedMetrics } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const facts = [allowedMetrics.timestamp, allowedMetrics.string]
 * facts // => [["min", "max", "approximateDistinct", "exactDistinct"], ["approximateDistinct", "exactDistinct"]]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const allowedMetrics: { readonly [Kind in PropertyTypeKind]: ReadonlyArray<PropertyMetricKind> } = {
  boolean: distinctCounts,
  byte: numericMetrics,
  short: numericMetrics,
  integer: numericMetrics,
  long: numericMetrics,
  float: numericMetrics,
  double: numericMetrics,
  decimal: numericMetrics,
  string: distinctCounts,
  date: temporalMetrics,
  timestamp: temporalMetrics,
  marking: distinctCounts,
  cipherText: distinctCounts,
  attachment: distinctCounts,
  mediaReference: distinctCounts,
  geopoint: distinctCounts,
  geoshape: distinctCounts,
  geotimeSeriesReference: distinctCounts,
  timeseries: distinctCounts,
  vector: distinctCounts,
  array: distinctCounts,
  struct: distinctCounts,
};

/**
 * The metrics that can be computed from a property of the given type, looking through arrays to their elements.
 *
 * **Example** (Read the metrics of an array of integers)
 *
 * ```ts import.meta.vitest name="Read the metrics of an array of integers"
 * import * as A from "effect/Array"
 * import { metricsFor } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { IntegerType, StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ArrayType } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const scores = ArrayType.make({ elementType: IntegerType.make({}) })
 * const facts = [A.contains(metricsFor(scores), "sum"), A.contains(metricsFor(StringType.make({})), "sum")]
 * facts // => [true, false]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const metricsFor = (type: PropertyType): ReadonlyArray<PropertyMetricKind> =>
  PropertyType.matchOrElse(
    type,
    { array: ({ elementType }) => metricsFor(elementType) },
    (other) => allowedMetrics[other.type]
  );

// -----------------------------------------------------------------------------
// Property type -> groupings
// -----------------------------------------------------------------------------

const noGroupings = A.empty<GroupByKind>();

const exactOnly: ReadonlyArray<GroupByKind> = ["exact"];

const numericGroupings: ReadonlyArray<GroupByKind> = ["exact", "fixedWidth", "ranges"];

const temporalGroupings: ReadonlyArray<GroupByKind> = ["exact", "ranges", "duration"];

/**
 * The ways objects can be grouped by a property of each type.
 *
 * **Details**
 *
 * Strings and booleans group by exact value. Numbers also group into
 * fixed-width buckets and listed ranges. Dates and timestamps group by exact
 * value, listed ranges and spans of time. Nothing else is groupable.
 *
 * OSDK's own table leaves `long` out, so a 64-bit integer cannot be grouped
 * at all from OSDK although the wire groups it like any other number. That is
 * an omission, not a rule, and `long` has the numeric row here.
 *
 * The `array` row is what holds for any element type; {@link groupingsFor}
 * looks through arrays to their elements, as OSDK does by erasing them.
 *
 * **Example** (Group a 64-bit integer like any other number)
 *
 * ```ts import.meta.vitest name="Group a 64-bit integer like any other number"
 * import { allowedGroupings } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const facts = [allowedGroupings.long, allowedGroupings.geopoint]
 * facts // => [["exact", "fixedWidth", "ranges"], []]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const allowedGroupings: { readonly [Kind in PropertyTypeKind]: ReadonlyArray<GroupByKind> } = {
  boolean: exactOnly,
  byte: numericGroupings,
  short: numericGroupings,
  integer: numericGroupings,
  long: numericGroupings,
  float: numericGroupings,
  double: numericGroupings,
  decimal: numericGroupings,
  string: exactOnly,
  date: temporalGroupings,
  timestamp: temporalGroupings,
  marking: noGroupings,
  cipherText: noGroupings,
  attachment: noGroupings,
  mediaReference: noGroupings,
  geopoint: noGroupings,
  geoshape: noGroupings,
  geotimeSeriesReference: noGroupings,
  timeseries: noGroupings,
  vector: noGroupings,
  array: noGroupings,
  struct: noGroupings,
};

/**
 * The ways objects can be grouped by a property of the given type, looking through arrays to their elements.
 *
 * **Example** (Read the groupings of an array of strings)
 *
 * ```ts import.meta.vitest name="Read the groupings of an array of strings"
 * import { groupingsFor } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ArrayType } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const tags = ArrayType.make({ elementType: StringType.make({}) })
 * groupingsFor(tags) // => ["exact"]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const groupingsFor = (type: PropertyType): ReadonlyArray<GroupByKind> =>
  PropertyType.matchOrElse(
    type,
    { array: ({ elementType }) => groupingsFor(elementType) },
    (other) => allowedGroupings[other.type]
  );

/**
 * The units a duration grouping may use on a date and on a timestamp.
 *
 * **Details**
 *
 * A calendar date has no time of day, so units shorter than a day only make
 * sense for a timestamp. Milliseconds are in the wire's unit vocabulary but
 * OSDK offers no spelling for them; they are listed for timestamps because
 * the wire accepts them there.
 *
 * **Example** (Compare the units of a date and a timestamp)
 *
 * ```ts import.meta.vitest name="Compare the units of a date and a timestamp"
 * import * as A from "effect/Array"
 * import { durationUnits } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const facts = [A.contains(durationUnits.date, "hours"), A.contains(durationUnits.timestamp, "hours")]
 * facts // => [false, true]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const durationUnits: { readonly [Kind in TemporalKind]: ReadonlyArray<TimeUnit> } = {
  date: ["days", "weeks", "months", "years", "quarters"],
  timestamp: ["milliseconds", "seconds", "minutes", "hours", "days", "weeks", "months", "years", "quarters"],
};

// -----------------------------------------------------------------------------
// Metric -> kind of result
// -----------------------------------------------------------------------------

/**
 * What kind of value a metric produces, relative to the property it reads.
 *
 * **Details**
 *
 * `integer` is a whole number whatever the property; `numeric` is a number
 * whatever the property's own numeric type; `sameAsProperty` is a value of
 * the property's own type.
 *
 * **Example** (Describe a result kind)
 *
 * ```ts import.meta.vitest name="Describe a result kind"
 * import { MetricResultKind } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const describe = MetricResultKind.match({
 *   integer: () => "a whole number",
 *   numeric: () => "a number",
 *   sameAsProperty: () => "a value of the property's own type",
 * })
 * describe("sameAsProperty") // => "a value of the property's own type"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MetricResultKind = LiteralKit(["integer", "numeric", "sameAsProperty"]).pipe(
  $I.annoteSchema("MetricResultKind", {
    description: "What kind of value a metric produces, relative to the property it reads.",
  })
);

/**
 * Runtime type of {@link MetricResultKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type MetricResultKind = typeof MetricResultKind.Type;

/**
 * The kind of value each metric produces.
 *
 * **Details**
 *
 * Counts are integers. A sum, an average and a percentile are numbers. The
 * smallest and the largest value keep the property's own type, which is why
 * they exist for dates and timestamps too.
 *
 * OSDK disagrees with itself here: its object-set results type a sum or an
 * average as the property's own client type (a string for `long` and
 * `decimal`), while its derived-property builder types them `double`. The
 * table follows the second, which matches what a sum and an average are.
 *
 * **Example** (Tell which metrics keep the property's type)
 *
 * ```ts import.meta.vitest name="Tell which metrics keep the property's type"
 * import { metricResultKind } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const facts = [metricResultKind.count, metricResultKind.avg, metricResultKind.max]
 * facts // => ["integer", "numeric", "sameAsProperty"]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const metricResultKind: { readonly [Metric in AggregationKind]: MetricResultKind } = {
  count: "integer",
  sum: "numeric",
  avg: "numeric",
  min: "sameAsProperty",
  max: "sameAsProperty",
  approximateDistinct: "integer",
  exactDistinct: "integer",
  approximatePercentile: "numeric",
};

// -----------------------------------------------------------------------------
// Violations
// -----------------------------------------------------------------------------

const AggregationViolationKind = LiteralKit([
  "unknownProperty",
  "metricNotAllowed",
  "groupingNotAllowed",
  "durationUnitNotAllowed",
]);

/**
 * A metric or a grouping reads a property, or a struct field, that the object type does not declare.
 *
 * @category models
 * @since 0.0.0
 */
export class UnknownAggregatedProperty extends S.Opaque<UnknownAggregatedProperty, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("unknownProperty"),
    operation: S.Union([PropertyMetricKind, GroupByKind]).annotateKey({
      description: "The metric or the grouping that reads the property.",
    }),
    property: PropertySelector.annotateKey({ description: "Selector that resolves to nothing." }),
  }).pipe(
    $I.annoteSchema("UnknownAggregatedProperty", {
      description: "A metric or a grouping reads a property, or a struct field, that the object type does not declare.",
    })
  )
) {}

/**
 * A request computes a metric that the property's type does not admit, such as the sum of a string.
 *
 * @category models
 * @since 0.0.0
 */
export class MetricNotAllowed extends S.Opaque<MetricNotAllowed, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("metricNotAllowed"),
    metric: PropertyMetricKind.annotateKey({ description: "The offending metric." }),
    property: PropertySelector.annotateKey({ description: "Selector of the property the metric reads." }),
    propertyType: PropertyTypeKind.annotateKey({ description: "Type tag of that property." }),
    allowed: S.Array(PropertyMetricKind).annotateKey({ description: "Metrics the property's type admits." }),
  }).pipe(
    $I.annoteSchema("MetricNotAllowed", {
      description: "A request computes a metric that the property's type does not admit.",
    })
  )
) {}

/**
 * A request groups by a property in a way its type does not admit, such as fixed-width buckets of a string.
 *
 * @category models
 * @since 0.0.0
 */
export class GroupingNotAllowed extends S.Opaque<GroupingNotAllowed, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("groupingNotAllowed"),
    grouping: GroupByKind.annotateKey({ description: "The offending way of grouping." }),
    property: PropertySelector.annotateKey({ description: "Selector of the property the grouping reads." }),
    propertyType: PropertyTypeKind.annotateKey({ description: "Type tag of that property." }),
    allowed: S.Array(GroupByKind).annotateKey({ description: "Ways of grouping the property's type admits." }),
  }).pipe(
    $I.annoteSchema("GroupingNotAllowed", {
      description: "A request groups by a property in a way its type does not admit.",
    })
  )
) {}

/**
 * A duration grouping buckets a calendar date by a unit shorter than a day.
 *
 * @category models
 * @since 0.0.0
 */
export class DurationUnitNotAllowed extends S.Opaque<DurationUnitNotAllowed, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("durationUnitNotAllowed"),
    property: PropertySelector.annotateKey({ description: "Selector of the property the grouping reads." }),
    propertyType: TemporalKind.annotateKey({ description: "Type tag of that property: a date or a timestamp." }),
    unit: TimeUnit.annotateKey({ description: "The offending unit." }),
    allowed: S.Array(TimeUnit).annotateKey({ description: "Units a duration grouping may use on that type." }),
  }).pipe(
    $I.annoteSchema("DurationUnitNotAllowed", {
      description: "A duration grouping buckets a calendar date by a unit shorter than a day.",
    })
  )
) {}

/**
 * One way an aggregation request can disagree with the object type it is meant for.
 *
 * **Example** (Explain a violation in words)
 *
 * ```ts import.meta.vitest name="Explain a violation in words"
 * import { AggregationViolation, MetricNotAllowed } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { PropertyByName } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const explain = AggregationViolation.match({
 *   unknownProperty: ({ operation }) => `${operation} reads an undeclared property`,
 *   metricNotAllowed: ({ metric, propertyType }) => `${metric} does not apply to ${propertyType}`,
 *   groupingNotAllowed: ({ grouping, propertyType }) => `${propertyType} cannot be grouped by ${grouping}`,
 *   durationUnitNotAllowed: ({ unit, propertyType }) => `a ${propertyType} has no ${unit}`,
 * })
 * const violation = MetricNotAllowed.make({
 *   metric: "sum",
 *   property: PropertyByName.make({ apiName: PropertyApiName.make("fullName") }),
 *   propertyType: "string",
 *   allowed: ["approximateDistinct", "exactDistinct"],
 * })
 * explain(violation) // => "sum does not apply to string"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AggregationViolation = AggregationViolationKind.mapMembers(() =>
  Tuple.make(UnknownAggregatedProperty, MetricNotAllowed, GroupingNotAllowed, DurationUnitNotAllowed)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("AggregationViolation", {
    description: "One way an aggregation request can disagree with the object type it is meant for.",
  })
);

/**
 * Runtime type of {@link AggregationViolation}.
 *
 * @category models
 * @since 0.0.0
 */
export type AggregationViolation = typeof AggregationViolation.Type;

// -----------------------------------------------------------------------------
// Checking a request against an object type
// -----------------------------------------------------------------------------

type PropertyTable = Readonly<Record<PropertyApiName, PropertyDefinition>>;

// An array is aggregated and grouped by its elements, so the tag that decides is the innermost element's.
const decidingKind = (type: PropertyType): PropertyTypeKind =>
  PropertyType.matchOrElse(type, { array: ({ elementType }) => decidingKind(elementType) }, (other) => other.type);

type PropertyMetric = Exclude<Aggregation, { readonly type: "count" }>;

const checkMetric =
  (properties: PropertyTable) =>
  (metric: PropertyMetric): ReadonlyArray<AggregationViolation> =>
    O.match(selectedType(metric.property, properties), {
      onNone: () => A.of(UnknownAggregatedProperty.make({ operation: metric.type, property: metric.property })),
      // Declared, but of a type a property table cannot tell: nothing to check the metric against.
      onSome: flow(
        O.filter((dataType) => !A.contains(metricsFor(dataType), metric.type)),
        O.map((dataType) =>
          MetricNotAllowed.make({
            metric: metric.type,
            property: metric.property,
            propertyType: decidingKind(dataType),
            allowed: metricsFor(dataType),
          })
        ),
        O.toArray
      ),
    });

const isTemporalKind = S.is(TemporalKind);

// The units of a duration grouping depend on the property: a calendar date has no hours.
const checkDurationUnit = (grouping: GroupBy, dataType: PropertyType): ReadonlyArray<AggregationViolation> => {
  const propertyType = decidingKind(dataType);
  return GroupBy.guards.duration(grouping) &&
    isTemporalKind(propertyType) &&
    !A.contains(durationUnits[propertyType], grouping.unit)
    ? A.of(
        DurationUnitNotAllowed.make({
          property: grouping.property,
          propertyType,
          unit: grouping.unit,
          allowed: durationUnits[propertyType],
        })
      )
    : A.empty();
};

const checkTypedGrouping = (grouping: GroupBy, dataType: PropertyType): ReadonlyArray<AggregationViolation> =>
  A.contains(groupingsFor(dataType), grouping.type)
    ? checkDurationUnit(grouping, dataType)
    : A.of(
        GroupingNotAllowed.make({
          grouping: grouping.type,
          property: grouping.property,
          propertyType: decidingKind(dataType),
          allowed: groupingsFor(dataType),
        })
      );

const checkGrouping =
  (properties: PropertyTable) =>
  (grouping: GroupBy): ReadonlyArray<AggregationViolation> =>
    O.match(selectedType(grouping.property, properties), {
      onNone: () => A.of(UnknownAggregatedProperty.make({ operation: grouping.type, property: grouping.property })),
      // Declared, but of a type a property table cannot tell: nothing to check the grouping against.
      onSome: flow(
        O.map((dataType) => checkTypedGrouping(grouping, dataType)),
        O.getOrElse(A.empty<AggregationViolation>)
      ),
    });

const isPropertyMetric = (metric: Aggregation): metric is PropertyMetric => !Aggregation.guards.count(metric);

/**
 * Checks the metrics and groupings of a request against the properties of an object type and returns every violation.
 *
 * **Details**
 *
 * An empty result means the request is consistent with the property table.
 * Four things are reported, metrics first and then groupings, each in request
 * order: a selector that resolves to no declared property or struct field, a
 * metric the property's type does not admit ({@link allowedMetrics}), a way of
 * grouping it does not admit ({@link allowedGroupings}), and a duration
 * grouping whose unit the property's type has no use for
 * ({@link durationUnits}). `count` reads no property and is never reported.
 *
 * The request is anything that carries `aggregations` and `groupBy`: the
 * aggregation over one object type and the aggregation over an object set are
 * both checked by this one function. An array is held to its element's row,
 * as OSDK does. Like the filter check, the title and primary-key selectors
 * and selectors with a load level are checked for existence only.
 *
 * **Example** (Report every violation of an aggregation request)
 *
 * ```ts import.meta.vitest name="Report every violation of an aggregation request"
 * import * as A from "effect/Array"
 * import * as R from "effect/Record"
 * import { checkAggregation, count, duration, exact, fixedWidth, sum } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { DateType, DoubleType, StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { PropertyApiName, PropertyTypeRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { PropertyDefinition } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const rid = PropertyTypeRid.make("ri.ontology.main.property.example")
 * const properties = R.fromEntries([
 *   [PropertyApiName.make("fullName"), PropertyDefinition.make({ dataType: StringType.make({}), rid })],
 *   [PropertyApiName.make("salary"), PropertyDefinition.make({ dataType: DoubleType.make({}), rid })],
 *   [PropertyApiName.make("startDate"), PropertyDefinition.make({ dataType: DateType.make({}), rid })],
 * ])
 * const named = PropertyApiName.make
 * const request = {
 *   aggregations: [count(), sum(named("salary")), sum(named("fullName")), sum(named("bonus"))],
 *   groupBy: [exact(named("fullName"), {}), fixedWidth(named("fullName"), 10), duration(named("startDate"), 1, "hours")],
 * }
 * const kinds = A.map(checkAggregation(request, properties), (violation) => violation.type)
 * kinds // => ["metricNotAllowed", "unknownProperty", "groupingNotAllowed", "durationUnitNotAllowed"]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkAggregation: {
  (properties: PropertyTable): (request: {
    readonly aggregations: ReadonlyArray<Aggregation>;
    readonly groupBy: ReadonlyArray<GroupBy>;
  }) => ReadonlyArray<AggregationViolation>;
  (
    request: { readonly aggregations: ReadonlyArray<Aggregation>; readonly groupBy: ReadonlyArray<GroupBy> },
    properties: PropertyTable
  ): ReadonlyArray<AggregationViolation>;
} = dual(
  2,
  (
    request: { readonly aggregations: ReadonlyArray<Aggregation>; readonly groupBy: ReadonlyArray<GroupBy> },
    properties: PropertyTable
  ): ReadonlyArray<AggregationViolation> =>
    A.appendAll(
      A.flatMap(A.filter(request.aggregations, isPropertyMetric), checkMetric(properties)),
      A.flatMap(request.groupBy, checkGrouping(properties))
    )
);
