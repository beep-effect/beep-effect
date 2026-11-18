/**
 * Aggregations: what to compute over a set of objects, how to bucket the objects first, and what comes back.
 *
 * **Details**
 *
 * OSDK spells an aggregation request as a record of magic strings
 * (`{ "salary:sum": "desc", $count: "unordered" }`) beside a record of
 * `$`-keyed group-by bags, polices both with conditional types and converts
 * them to the wire by cutting strings. Here the request is the wire's own two
 * tagged unions: {@link Aggregation} (8 metrics) and {@link GroupBy}
 * (4 groupings). The rules OSDK spreads over type-level error strings
 * (ordering only with at most one grouping, a default value or a null bucket
 * but not both, whole calendar steps) are checks on the schemas, so they hold
 * for decoded values, constructed values and generated values alike.
 *
 * Every metric except `count` and every grouping reads one property. The wire
 * offers two mutually exclusive keys for it, `field` and
 * `propertyIdentifier`; the domain has one, `property`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constFalse, constTrue } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { ObjectFilter } from "../Filter/Filter.model.ts";
import { PropertyApiName } from "../Identifier/Identifier.model.ts";
import { decodeAddressTo, PropertyAddressFields } from "../Property/Property.addressing.ts";
import { PropertySelector } from "../Property/Property.model.ts";
import { TimeUnit } from "../TimeSeries/TimeSeries.model.ts";
import { ScalarValue } from "../Value/Value.model.ts";

const $I = $ScratchpadId.create("osdk/Aggregation/Aggregation.model");

// -----------------------------------------------------------------------------
// Literal domains
// -----------------------------------------------------------------------------

/**
 * Direction in which result groups are sorted by a metric.
 *
 * **Details**
 *
 * The wire has no "unordered" literal: a metric that does not order the
 * result simply omits its direction, which is `None` here.
 *
 * **Example** (Decode the wire direction)
 *
 * ```ts import.meta.vitest name="Decode the wire direction"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OrderDirection } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const direction = await Effect.runPromise(S.decodeEffect(OrderDirection)("DESC"))
 * direction // => "desc"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OrderDirection = MappedLiteralKit([
  ["ASC", "asc"],
  ["DESC", "desc"],
]).pipe(
  $I.annoteSchema("OrderDirection", {
    description: "Direction in which result groups are sorted by a metric: smallest first or largest first.",
  })
);

/**
 * Runtime type of {@link OrderDirection}.
 *
 * @category models
 * @since 0.0.0
 */
export type OrderDirection = typeof OrderDirection.Type;

/**
 * How exact the caller needs aggregation results to be.
 *
 * **Details**
 *
 * `requireAccurate` makes the platform fail the request when it cannot
 * guarantee exact results (for example a group limit lower than the number of
 * distinct values) instead of degrading. Omitting the requirement means
 * `allowApproximate`.
 *
 * **Example** (Insist on exact results)
 *
 * ```ts import.meta.vitest name="Insist on exact results"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AccuracyRequirement } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(AccuracyRequirement)("requireAccurate"))
 * wire // => "REQUIRE_ACCURATE"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccuracyRequirement = MappedLiteralKit([
  ["REQUIRE_ACCURATE", "requireAccurate"],
  ["ALLOW_APPROXIMATE", "allowApproximate"],
]).pipe(
  $I.annoteSchema("AccuracyRequirement", {
    description: "Whether the platform must fail rather than return approximate aggregation results.",
  })
);

/**
 * Runtime type of {@link AccuracyRequirement}.
 *
 * @category models
 * @since 0.0.0
 */
export type AccuracyRequirement = typeof AccuracyRequirement.Type;

/**
 * How exact the returned aggregation results actually are.
 *
 * **Example** (Read how exact a result is)
 *
 * ```ts import.meta.vitest name="Read how exact a result is"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AggregationAccuracy } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const accuracy = await Effect.runPromise(S.decodeEffect(AggregationAccuracy)("APPROXIMATE"))
 * accuracy // => "approximate"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AggregationAccuracy = MappedLiteralKit([
  ["ACCURATE", "accurate"],
  ["APPROXIMATE", "approximate"],
]).pipe(
  $I.annoteSchema("AggregationAccuracy", {
    description: "Whether the returned aggregation results are exact or an approximation.",
  })
);

/**
 * Runtime type of {@link AggregationAccuracy}.
 *
 * @category models
 * @since 0.0.0
 */
export type AggregationAccuracy = typeof AggregationAccuracy.Type;

/**
 * Every metric an aggregation can compute, by its wire tag.
 *
 * **Example** (Separate the metrics that read a property)
 *
 * ```ts import.meta.vitest name="Separate the metrics that read a property"
 * import { AggregationKind, PropertyMetricKind } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const sizes = [AggregationKind.literals.length, PropertyMetricKind.literals.length]
 * sizes // => [8, 7]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AggregationKind = LiteralKit([
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "approximateDistinct",
  "exactDistinct",
  "approximatePercentile",
]).pipe(
  $I.annoteSchema("AggregationKind", {
    description: "Every metric an aggregation can compute over a set of objects.",
  })
);

/**
 * Runtime type of {@link AggregationKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type AggregationKind = typeof AggregationKind.Type;

/**
 * The metrics that are computed from one property's values: every metric except the object count.
 *
 * **Example** (Tell a property metric from the count)
 *
 * ```ts import.meta.vitest name="Tell a property metric from the count"
 * import * as S from "effect/Schema"
 * import { PropertyMetricKind } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const isPropertyMetric = S.is(PropertyMetricKind)
 * const verdicts = [isPropertyMetric("avg"), isPropertyMetric("count")]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PropertyMetricKind = AggregationKind.omit(["count"]).pipe(
  $I.annoteSchema("PropertyMetricKind", {
    description: "Metrics computed from the values of one property, as opposed to counting objects.",
  })
);

/**
 * Runtime type of {@link PropertyMetricKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type PropertyMetricKind = typeof PropertyMetricKind.Type;

/**
 * Every way to divide objects into groups before aggregating, by its wire tag.
 *
 * **Example** (Name each grouping)
 *
 * ```ts import.meta.vitest name="Name each grouping"
 * import { GroupByKind } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const label = GroupByKind.match({
 *   exact: () => "by value",
 *   fixedWidth: () => "by equal buckets",
 *   ranges: () => "by listed buckets",
 *   duration: () => "by span of time",
 * })
 * label("duration") // => "by span of time"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GroupByKind = LiteralKit(["exact", "fixedWidth", "ranges", "duration"]).pipe(
  $I.annoteSchema("GroupByKind", {
    description: "Every way to divide objects into groups before aggregating them.",
  })
);

/**
 * Runtime type of {@link GroupByKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type GroupByKind = typeof GroupByKind.Type;

// -----------------------------------------------------------------------------
// Names and small values
// -----------------------------------------------------------------------------

/**
 * The name under which a metric's value comes back in each result row.
 *
 * **Details**
 *
 * The platform accepts any alias. The convention every OSDK client follows is
 * `count` for the object count and `<property>.<metric>` for the rest; the
 * `MetricKeyFromName` codec parses that convention.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MetricName = S.NonEmptyString.pipe(
  S.brand("MetricName"),
  $I.annoteSchema("MetricName", {
    description: "The name under which a metric's value comes back in each aggregation result row.",
  })
);

/**
 * Runtime type of {@link MetricName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type MetricName = typeof MetricName.Type;

/**
 * Key of one grouping in a result row's `group` record: the name of the property the row was grouped by.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const GroupKey = S.NonEmptyString.pipe(
  S.brand("GroupKey"),
  $I.annoteSchema("GroupKey", {
    description: "Key of one grouping in an aggregation result row, naming the property the row was grouped by.",
  })
);

/**
 * Runtime type of {@link GroupKey}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type GroupKey = typeof GroupKey.Type;

const CountOfAtLeastOne = S.Int.check(S.isGreaterThanOrEqualTo(1));

const PositiveWidth = S.Finite.check(S.isGreaterThan(0));

// -----------------------------------------------------------------------------
// Property addressing
// -----------------------------------------------------------------------------

// Every metric but `count` and every grouping reads one property. A member is the wire struct
// `{ type, ...PropertyAddressFields, ...rest }` decoded with `decodeAddressTo` to the domain struct
// `{ type, property: propertyField, ...rest }`; the Property concept owns the rule that joins them.
const propertyField = PropertySelector.annotateKey({ description: "The property whose values the operation reads." });

// -----------------------------------------------------------------------------
// Metrics
// -----------------------------------------------------------------------------

const metricFields = {
  name: S.OptionFromOptionalKey(MetricName).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Name under which the value comes back; the platform picks one when absent." })
  ),
  direction: S.OptionFromOptionalKey(OrderDirection).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Sorts the result groups by this metric; absent means the metric does not order." })
  ),
};

const propertyMetric = <const Tag extends PropertyMetricKind>(tag: Tag) =>
  S.Struct({ type: S.tag(tag), ...PropertyAddressFields, ...metricFields }).pipe(
    decodeAddressTo(S.Struct({ type: S.tag(tag), property: propertyField, ...metricFields }))
  );

/**
 * Counts the objects in each group.
 *
 * @category models
 * @since 0.0.0
 */
export class CountAggregation extends S.Opaque<CountAggregation, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("count"), ...metricFields }).pipe(
    $I.annoteSchema("CountAggregation", { description: "Counts the objects in each group." })
  )
) {}

/**
 * Adds up a numeric property over each group.
 *
 * @category models
 * @since 0.0.0
 */
export class SumAggregation extends S.Opaque<SumAggregation, { readonly brand: unique symbol }>()(
  propertyMetric("sum").pipe(
    $I.annoteSchema("SumAggregation", { description: "Adds up a numeric property over each group." })
  )
) {}

/**
 * Averages a numeric property over each group.
 *
 * @category models
 * @since 0.0.0
 */
export class AverageAggregation extends S.Opaque<AverageAggregation, { readonly brand: unique symbol }>()(
  propertyMetric("avg").pipe(
    $I.annoteSchema("AverageAggregation", { description: "Averages a numeric property over each group." })
  )
) {}

/**
 * Takes the smallest value of a property in each group.
 *
 * @category models
 * @since 0.0.0
 */
export class MinAggregation extends S.Opaque<MinAggregation, { readonly brand: unique symbol }>()(
  propertyMetric("min").pipe(
    $I.annoteSchema("MinAggregation", { description: "Takes the smallest value of a property in each group." })
  )
) {}

/**
 * Takes the largest value of a property in each group.
 *
 * @category models
 * @since 0.0.0
 */
export class MaxAggregation extends S.Opaque<MaxAggregation, { readonly brand: unique symbol }>()(
  propertyMetric("max").pipe(
    $I.annoteSchema("MaxAggregation", { description: "Takes the largest value of a property in each group." })
  )
) {}

/**
 * Estimates how many distinct values a property takes in each group.
 *
 * @category models
 * @since 0.0.0
 */
export class ApproximateDistinctAggregation extends S.Opaque<
  ApproximateDistinctAggregation,
  { readonly brand: unique symbol }
>()(
  propertyMetric("approximateDistinct").pipe(
    $I.annoteSchema("ApproximateDistinctAggregation", {
      description: "Estimates how many distinct values a property takes in each group.",
    })
  )
) {}

/**
 * Counts exactly how many distinct values a property takes in each group.
 *
 * **Gotchas**
 *
 * Slower than the approximate count, and only available on Object Storage V2.
 *
 * @category models
 * @since 0.0.0
 */
export class ExactDistinctAggregation extends S.Opaque<ExactDistinctAggregation, { readonly brand: unique symbol }>()(
  propertyMetric("exactDistinct").pipe(
    $I.annoteSchema("ExactDistinctAggregation", {
      description: "Counts exactly how many distinct values a property takes in each group.",
    })
  )
) {}

/**
 * Estimates the value below which a given share of a numeric property's values fall in each group.
 *
 * **Details**
 *
 * The wire key is `approximatePercentile`, the same word as the tag; here it
 * is `percentile`.
 *
 * **Gotchas**
 *
 * The wire does not say whether the scale is a fraction or a percentage: the
 * OSDK runtime defaults to `0.5` while its documentation passes `95`. The
 * value is therefore any finite number. The `Faux` backend reads it as a
 * percentage from `0` to `100`. Only available on Object Storage V2.
 *
 * @category models
 * @since 0.0.0
 */
export class ApproximatePercentileAggregation extends S.Opaque<
  ApproximatePercentileAggregation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("approximatePercentile"),
    ...PropertyAddressFields,
    ...metricFields,
    percentile: S.Finite,
  }).pipe(
    S.encodeKeys({ percentile: "approximatePercentile" }),
    decodeAddressTo(
      S.Struct({
        type: S.tag("approximatePercentile"),
        property: propertyField,
        ...metricFields,
        percentile: S.Finite.annotateKey({ description: "Which percentile of the property's values to estimate." }),
      })
    ),
    $I.annoteSchema("ApproximatePercentileAggregation", {
      description: "Estimates the value below which a given share of a numeric property's values fall.",
    })
  )
) {}

/**
 * One metric to compute over each group of objects.
 *
 * **Details**
 *
 * This is the wire's `AggregationV2` union. Every case can carry a `name`
 * (under which its value comes back) and a `direction` (which sorts the result
 * groups by it). Every case but `count` reads one `property`.
 *
 * **Example** (Decode a metric addressed by a bare property name)
 *
 * ```ts import.meta.vitest name="Decode a metric addressed by a bare property name"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Aggregation } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertySelector } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const wire = { type: "sum", field: "salary", name: "salary.sum", direction: "DESC" }
 * const metric = await Effect.runPromise(S.decodeUnknownEffect(Aggregation)(wire))
 * const reads = Aggregation.match(metric, {
 *   count: () => "every object",
 *   sum: ({ property }) => PropertySelector.guards.property(property) ? property.apiName : "a selector",
 *   avg: () => "",
 *   min: () => "",
 *   max: () => "",
 *   approximateDistinct: () => "",
 *   exactDistinct: () => "",
 *   approximatePercentile: () => "",
 * })
 * const encoded = await Effect.runPromise(S.encodeEffect(Aggregation)(metric))
 * const facts = [reads, encoded]
 * facts // => ["salary", { type: "sum", field: "salary", name: "salary.sum", direction: "DESC" }]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Aggregation = AggregationKind.mapMembers(() =>
  Tuple.make(
    CountAggregation,
    SumAggregation,
    AverageAggregation,
    MinAggregation,
    MaxAggregation,
    ApproximateDistinctAggregation,
    ExactDistinctAggregation,
    ApproximatePercentileAggregation
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("Aggregation", { description: "One metric to compute over each group of objects." })
);

/**
 * Runtime type of {@link Aggregation}.
 *
 * @category models
 * @since 0.0.0
 */
export type Aggregation = typeof Aggregation.Type;

// -----------------------------------------------------------------------------
// Group-bys
// -----------------------------------------------------------------------------

/**
 * One bucket of a ranges grouping: values from `startValue` (inclusive) up to `endValue` (exclusive).
 *
 * **Details**
 *
 * The same record comes back as the group value of each row, so the wire's
 * own key names are kept. The bounds are wire scalars: an instant or a 64-bit
 * integer bound is the text it travels as, and `operandCodec` of the grouped
 * property's type reads it as a value of that property.
 *
 * **Example** (Bound a bucket with wire scalars)
 *
 * ```ts import.meta.vitest name="Bound a bucket with wire scalars"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AggregationRange } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const day = AggregationRange.make({ startValue: "1970-01-01T00:00:00.000Z", endValue: "1970-01-02T00:00:00.000Z" })
 * const wire = await Effect.runPromise(S.encodeEffect(AggregationRange)(day))
 * const again = await Effect.runPromise(S.decodeEffect(AggregationRange)(wire))
 * const facts = [wire.startValue, S.toEquivalence(AggregationRange)(again, day)]
 * facts // => ["1970-01-01T00:00:00.000Z", true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AggregationRange extends S.Opaque<AggregationRange, { readonly brand: unique symbol }>()(
  S.Struct({
    startValue: ScalarValue.annotateKey({ description: "Smallest value the bucket holds (inclusive)." }),
    endValue: ScalarValue.annotateKey({ description: "Value at which the bucket ends (exclusive)." }),
  }).pipe(
    $I.annoteSchema("AggregationRange", {
      description: "One bucket of a ranges grouping, from an inclusive start to an exclusive end.",
    })
  )
) {}

/**
 * The value an exact grouping files null property values under: text, whatever the property's type.
 *
 * **Details**
 *
 * The wire types this field `string` for every property type, so a numeric or
 * boolean default is written out by the caller (`"0"`, `"false"`). `Type` and
 * `Encoded` are both text and the codec round-trips exactly.
 *
 * **Example** (State a numeric default as text)
 *
 * ```ts import.meta.vitest name="State a numeric default as text"
 * import * as S from "effect/Schema"
 * import { GroupDefaultValue } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const isDefault = S.is(GroupDefaultValue)
 * const verdicts = [isDefault("0"), isDefault("unknown"), isDefault(0), isDefault(false)]
 * verdicts // => [true, true, false, false]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const GroupDefaultValue = S.String.pipe(
  $I.annoteSchema("GroupDefaultValue", {
    description: "The value an exact grouping files null property values under, always text.",
  })
);

/**
 * Runtime type of {@link GroupDefaultValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type GroupDefaultValue = typeof GroupDefaultValue.Type;

const exactFields = {
  maxGroupCount: S.OptionFromOptionalKey(CountOfAtLeastOne).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Largest number of groups to return; the platform's own limit applies when absent." })
  ),
  defaultValue: S.OptionFromOptionalKey(GroupDefaultValue).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Value that null property values are grouped under, instead of being left out." })
  ),
  includeNullValues: S.OptionFromOptionalKey(S.Boolean).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Whether objects with a null property value form a group of their own." })
  ),
};

/**
 * Groups objects by the exact value of a property.
 *
 * **Details**
 *
 * By default objects whose property is null fall out of the result. They can
 * instead be filed under a `defaultValue`, or form a null group of their own
 * with `includeNullValues`, but not both: the two answers to "where do nulls
 * go" contradict each other.
 *
 * @invariant `defaultValue` and `includeNullValues: true` are never both set.
 * @category models
 * @since 0.0.0
 */
export class ExactGrouping extends S.Opaque<ExactGrouping, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("exact"), ...PropertyAddressFields, ...exactFields }).pipe(
    decodeAddressTo(
      S.Struct({ type: S.tag("exact"), property: propertyField, ...exactFields }).check(
        S.makeFilter(
          ({ defaultValue, includeNullValues }) => O.isNone(defaultValue) || !O.contains(includeNullValues, true),
          $I.annote("ExclusiveNullHandlingCheck", {
            title: "Exclusive null handling",
            description: "An exact grouping that sets a default value or keeps a null group, never both.",
            message: "An exact grouping cannot set both a default value and a null group",
          })
        )
      )
    ),
    $I.annoteSchema("ExactGrouping", { description: "Groups objects by the exact value of a property." })
  )
) {}

/**
 * Groups objects into numeric buckets of equal width.
 *
 * **Details**
 *
 * The wire key is `fixedWidth`, the same word as the tag; here it is `width`.
 *
 * @invariant `width` is greater than zero.
 * @category models
 * @since 0.0.0
 */
export class FixedWidthGrouping extends S.Opaque<FixedWidthGrouping, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("fixedWidth"), ...PropertyAddressFields, width: PositiveWidth }).pipe(
    S.encodeKeys({ width: "fixedWidth" }),
    decodeAddressTo(
      S.Struct({
        type: S.tag("fixedWidth"),
        property: propertyField,
        width: PositiveWidth.annotateKey({ description: "Width of every bucket, in the property's own unit." }),
      })
    ),
    $I.annoteSchema("FixedWidthGrouping", { description: "Groups objects into numeric buckets of equal width." })
  )
) {}

/**
 * Groups objects into the buckets the caller lists.
 *
 * @category models
 * @since 0.0.0
 */
export class RangesGrouping extends S.Opaque<RangesGrouping, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("ranges"), ...PropertyAddressFields, ranges: S.Array(AggregationRange) }).pipe(
    decodeAddressTo(
      S.Struct({
        type: S.tag("ranges"),
        property: propertyField,
        ranges: S.Array(AggregationRange).annotateKey({
          description: "The buckets, each from an inclusive start to an exclusive end.",
        }),
      })
    ),
    $I.annoteSchema("RangesGrouping", { description: "Groups objects into the buckets the caller lists." })
  )
) {}

const isCalendarStep = TimeUnit.To.match({
  milliseconds: constFalse,
  seconds: constFalse,
  minutes: constFalse,
  hours: constFalse,
  days: constFalse,
  weeks: constTrue,
  months: constTrue,
  years: constTrue,
  quarters: constTrue,
});

const durationFields = {
  value: CountOfAtLeastOne.annotateKey({ description: "How many units each bucket spans." }),
  unit: TimeUnit.annotateKey({ description: "Unit of the bucket's span." }),
};

/**
 * Groups objects into buckets of elapsed time over a date or timestamp property.
 *
 * **Details**
 *
 * Weeks, months, quarters and years have no fixed length, so the platform
 * only buckets by one of them at a time. Sub-day units make sense only for a
 * timestamp property; that rule needs the property's type and lives in the
 * policy tables.
 *
 * @invariant `value` is 1 when `unit` is weeks, months, quarters or years.
 * @category models
 * @since 0.0.0
 */
export class DurationGrouping extends S.Opaque<DurationGrouping, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("duration"), ...PropertyAddressFields, ...durationFields }).pipe(
    decodeAddressTo(
      S.Struct({ type: S.tag("duration"), property: propertyField, ...durationFields }).check(
        S.makeFilter(
          ({ unit, value }) => value === 1 || !isCalendarStep(unit),
          $I.annote("WholeCalendarStepCheck", {
            title: "Whole calendar step",
            description: "A duration grouping that buckets by exactly one week, month, quarter or year at a time.",
            message: "A duration grouping by weeks, months, quarters or years must have the value 1",
          })
        )
      )
    ),
    $I.annoteSchema("DurationGrouping", {
      description: "Groups objects into buckets of elapsed time over a date or timestamp property.",
    })
  )
) {}

/**
 * One way to divide objects into groups before aggregating them.
 *
 * **Details**
 *
 * This is the wire's `AggregationGroupByV2` union. OSDK's six `$`-keyed forms
 * (`"exact"`, `$exactWithLimit`, `$exact`, `$fixedWidth`, `$ranges`,
 * `$duration`) collapse into these four: the first three are one case with
 * more or fewer options set.
 *
 * **Example** (Reject a duration that spans two months)
 *
 * ```ts import.meta.vitest name="Reject a duration that spans two months"
 * import * as Effect from "effect/Effect"
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { GroupBy } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const decode = S.decodeUnknownEffect(GroupBy)
 * const everyMonth = { type: "duration", field: "hiredOn", value: 1, unit: "MONTHS" }
 * const monthly = await Effect.runPromise(decode(everyMonth))
 * const twoMonths = await Effect.runPromiseExit(decode({ ...everyMonth, value: 2 }))
 * const facts = [GroupBy.guards.duration(monthly), Exit.isFailure(twoMonths)]
 * facts // => [true, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GroupBy = GroupByKind.mapMembers(() =>
  Tuple.make(ExactGrouping, FixedWidthGrouping, RangesGrouping, DurationGrouping)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("GroupBy", { description: "One way to divide objects into groups before aggregating them." })
);

/**
 * Runtime type of {@link GroupBy}.
 *
 * @category models
 * @since 0.0.0
 */
export type GroupBy = typeof GroupBy.Type;

// -----------------------------------------------------------------------------
// Request and response envelopes
// -----------------------------------------------------------------------------

const ordersTheResult = (aggregations: ReadonlyArray<Aggregation>): boolean =>
  A.some(aggregations, (aggregation) => O.isSome(aggregation.direction));

const keepsNullGroup = GroupBy.match({
  exact: ({ includeNullValues }) => O.contains(includeNullValues, true),
  fixedWidth: constFalse,
  ranges: constFalse,
  duration: constFalse,
});

/**
 * The two rules that tie the metrics that order a result to the groupings of the same request.
 *
 * **Details**
 *
 * Sorting result groups by a metric is only defined when there is at most
 * one grouping, and never when a grouping keeps a null group. The rules read
 * only the metrics and the groupings, so any request envelope that carries
 * both can adopt them with `.check`. They are exported because rebuilding an
 * envelope from another one's fields silently drops struct-level checks.
 *
 * **Example** (Adopt the ordering rules on another envelope)
 *
 * ```ts import.meta.vitest name="Adopt the ordering rules on another envelope"
 * import * as S from "effect/Schema"
 * import {
 *   Aggregation,
 *   AggregationOrderingChecks,
 *   count,
 *   exact,
 *   GroupBy,
 *   ordered,
 * } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const Envelope = S.Struct({
 *   aggregations: S.Array(Aggregation),
 *   groupBy: S.Array(GroupBy),
 *   objectSet: S.Json,
 * }).check(AggregationOrderingChecks)
 * const byTeam = exact(PropertyApiName.make("team"), {})
 * const byOffice = exact(PropertyApiName.make("office"), {})
 * const largestFirst = ordered(count(), "desc")
 * const isEnvelope = S.is(Envelope)
 * const verdicts = [
 *   isEnvelope({ aggregations: [largestFirst], groupBy: [byTeam], objectSet: null }),
 *   isEnvelope({ aggregations: [largestFirst], groupBy: [byTeam, byOffice], objectSet: null }),
 * ]
 * verdicts // => [true, false]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const AggregationOrderingChecks = S.makeFilterGroup<{
  readonly aggregations: ReadonlyArray<Aggregation>;
  readonly groupBy: ReadonlyArray<GroupBy>;
}>(
  [
    S.makeFilter(
      ({ aggregations, groupBy }) => groupBy.length <= 1 || !ordersTheResult(aggregations),
      $I.annote("OrderedBySingleGroupingCheck", {
        title: "Ordered by a single grouping",
        description: "An aggregation that sorts its result by a metric and has at most one grouping.",
        message: "A metric can order the result only when there is at most one grouping",
      })
    ),
    S.makeFilter(
      ({ aggregations, groupBy }) => !A.some(groupBy, keepsNullGroup) || !ordersTheResult(aggregations),
      $I.annote("OrderedWithoutNullGroupCheck", {
        title: "Ordered without a null group",
        description: "An aggregation that sorts its result by a metric and keeps no null group.",
        message: "A metric cannot order the result when a grouping keeps a null group",
      })
    ),
  ],
  $I.annote("AggregationOrderingChecks", {
    title: "Aggregation ordering",
    description: "An aggregation whose ordering metrics are compatible with its groupings.",
  })
);

/**
 * Body of an aggregation over the objects of one object type.
 *
 * **Details**
 *
 * The wire key for the metrics is the singular `aggregation`; here it is
 * `aggregations`. Sorting the result groups by a metric is only defined when
 * there is at most one grouping, and never when that grouping keeps a null
 * group. OSDK enforces both with type-level error strings; here they are
 * checks, so a decoded or generated request obeys them too.
 *
 * **Example** (Reject ordering across two groupings)
 *
 * ```ts import.meta.vitest name="Reject ordering across two groupings"
 * import * as Effect from "effect/Effect"
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { AggregateRequest } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const decode = S.decodeUnknownEffect(AggregateRequest)
 * const byTeam = { type: "exact", field: "team" }
 * const byOffice = { type: "exact", field: "office" }
 * const largestFirst = { type: "count", name: "count", direction: "DESC" }
 * const one = await Effect.runPromiseExit(decode({ aggregation: [largestFirst], groupBy: [byTeam] }))
 * const two = await Effect.runPromiseExit(decode({ aggregation: [largestFirst], groupBy: [byTeam, byOffice] }))
 * const verdicts = [Exit.isSuccess(one), Exit.isSuccess(two)]
 * verdicts // => [true, false]
 * ```
 *
 * @invariant A metric orders the result only when there is at most one grouping.
 * @invariant A metric never orders the result when a grouping keeps a null group.
 * @category models
 * @since 0.0.0
 */
export class AggregateRequest extends S.Opaque<AggregateRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    aggregations: S.Array(Aggregation).annotateKey({ description: "The metrics to compute for each group." }),
    where: S.OptionFromOptionalKey(ObjectFilter).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Filter that narrows the objects before they are grouped and aggregated." })
    ),
    groupBy: S.Array(GroupBy).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<GroupBy>())),
      S.annotateKey({ description: "The groupings, outermost first; none aggregates every object into one row." })
    ),
    accuracy: S.OptionFromOptionalKey(AccuracyRequirement).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether approximate results are acceptable; they are when absent." })
    ),
  })
    .check(AggregationOrderingChecks)
    .pipe(
      S.encodeKeys({ aggregations: "aggregation" }),
      $I.annoteSchema("AggregateRequest", {
        description: "Body of an aggregation over the objects of one object type.",
      })
    )
) {}

/**
 * The value of one metric in one result row.
 *
 * **Details**
 *
 * The value is absent when there was nothing to compute it from, for example
 * the minimum of an empty group. Its type depends on the metric and on the
 * property, which this envelope does not know, so it is JSON.
 *
 * @category models
 * @since 0.0.0
 */
export class MetricResult extends S.Opaque<MetricResult, { readonly brand: unique symbol }>()(
  S.Struct({
    name: MetricName.annotateKey({ description: "The name the request gave the metric, or the platform's default." }),
    value: S.OptionFromOptionalKey(S.Json).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "The computed value; absent when there was nothing to compute it from." })
    ),
  }).pipe($I.annoteSchema("MetricResult", { description: "The value of one metric in one aggregation result row." }))
) {}

/**
 * One row of an aggregation result: a group of objects and the metrics computed over it.
 *
 * **Details**
 *
 * `group` has one entry per grouping of the request. Each value is the
 * grouped value itself (for a fixed-width or duration grouping, the value
 * that identifies the bucket), a `{ startValue, endValue }` record for a
 * ranges grouping, or `null` for the null group. Their types depend on the
 * grouped property, which this envelope does not know, so they are JSON.
 *
 * @category models
 * @since 0.0.0
 */
export class AggregationRow extends S.Opaque<AggregationRow, { readonly brand: unique symbol }>()(
  S.Struct({
    group: S.Record(GroupKey, S.Json).annotateKey({
      description: "The value that identifies the group, per grouping of the request.",
    }),
    metrics: S.Array(MetricResult).annotateKey({ description: "The metrics computed over the group, by name." }),
  }).pipe(
    $I.annoteSchema("AggregationRow", {
      description: "One row of an aggregation result: a group of objects and the metrics computed over it.",
    })
  )
) {}

/**
 * What an aggregation returns: one row per group, and how much to trust them.
 *
 * **Example** (Decode a grouped result)
 *
 * ```ts import.meta.vitest name="Decode a grouped result"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AggregateResponse } from "@beep/scratchpad/osdk/src/Aggregation/index"
 *
 * const wire = {
 *   accuracy: "APPROXIMATE",
 *   data: [{ group: { team: "platform" }, metrics: [{ name: "count", value: 12 }] }],
 * }
 * const response = await Effect.runPromise(S.decodeUnknownEffect(AggregateResponse)(wire))
 * const facts = [response.accuracy, response.data.length]
 * facts // => ["approximate", 1]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AggregateResponse extends S.Opaque<AggregateResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    excludedItems: S.OptionFromOptionalKey(S.Int.check(S.isGreaterThanOrEqualTo(0))).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "How many objects were left out of the result, when the platform reports it." })
    ),
    accuracy: AggregationAccuracy.annotateKey({ description: "Whether the rows are exact or an approximation." }),
    data: S.Array(AggregationRow).annotateKey({ description: "One row per group; a single row without groupings." }),
    computeUsage: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Compute-seconds the aggregation used, when the request asked for it." })
    ),
  }).pipe(
    $I.annoteSchema("AggregateResponse", {
      description: "What an aggregation returns: one row per group, and how much to trust them.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Metric keys and the regrouped view of a row
// -----------------------------------------------------------------------------

const MetricKeyKind = LiteralKit(["count", "property"]);

/**
 * Identifies the object count among a row's metrics.
 *
 * @category models
 * @since 0.0.0
 */
export class CountKey extends S.Opaque<CountKey, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("count") }).pipe(
    $I.annoteSchema("CountKey", { description: "Identifies the object count among a row's metrics." })
  )
) {}

/**
 * Identifies one metric of one property among a row's metrics.
 *
 * @category models
 * @since 0.0.0
 */
export class PropertyMetricKey extends S.Opaque<PropertyMetricKey, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("property"),
    property: PropertyApiName.annotateKey({ description: "The property the metric was computed from." }),
    metric: PropertyMetricKind.annotateKey({ description: "Which metric of the property." }),
  }).pipe(
    $I.annoteSchema("PropertyMetricKey", {
      description: "Identifies one metric of one property among a row's metrics.",
    })
  )
) {}

/**
 * What a conventionally named metric stands for: the object count, or one metric of one property.
 *
 * **Details**
 *
 * This is the structure OSDK hides inside its `"salary:sum"` request keys and
 * `"salary.sum"` result names. The `MetricKeyFromName` codec moves between the
 * name and this value.
 *
 * **Example** (Describe a metric key)
 *
 * ```ts import.meta.vitest name="Describe a metric key"
 * import { MetricKey, PropertyMetricKey } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const describe = MetricKey.match({
 *   count: () => "number of objects",
 *   property: ({ property, metric }) => `${metric} of ${property}`,
 * })
 * const key = PropertyMetricKey.make({ property: PropertyApiName.make("salary"), metric: "avg" })
 * describe(key) // => "avg of salary"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MetricKey = MetricKeyKind.mapMembers(() => Tuple.make(CountKey, PropertyMetricKey)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("MetricKey", {
    description: "What a conventionally named metric stands for: the object count, or one metric of one property.",
  })
);

/**
 * Runtime type of {@link MetricKey}.
 *
 * @category models
 * @since 0.0.0
 */
export type MetricKey = typeof MetricKey.Type;

/**
 * The metrics computed from one property in one result row, each present only when the row carried it.
 *
 * @category models
 * @since 0.0.0
 */
export class PropertyMetricValues extends S.Opaque<PropertyMetricValues, { readonly brand: unique symbol }>()(
  S.Struct(
    R.map(PropertyMetricKind.Enum, () =>
      S.OptionFromOptionalKey(S.Json).pipe(
        S.withConstructorDefault(Effect.succeedNone),
        S.annotateKey({ description: "Value of this metric, when the row carried one." })
      )
    )
  ).pipe(
    $I.annoteSchema("PropertyMetricValues", {
      description: "The metrics computed from one property in one aggregation result row.",
    })
  )
) {}

/**
 * A result row's metrics, regrouped from a flat list of named values into a lookup by property and metric.
 *
 * **Details**
 *
 * `count` is the object count, `properties` holds every metric whose name
 * follows the `<property>.<metric>` convention, and `aliased` keeps the rest
 * under their own names. OSDK's decoder drops what it does not recognise;
 * nothing is dropped here.
 *
 * @category models
 * @since 0.0.0
 */
export class MetricLookup extends S.Opaque<MetricLookup, { readonly brand: unique symbol }>()(
  S.Struct({
    count: S.OptionFromOptionalKey(S.Json).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "The object count, when the row carried one." })
    ),
    properties: S.Record(PropertyApiName, PropertyMetricValues).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<PropertyApiName, PropertyMetricValues>())),
      S.annotateKey({ description: "Conventionally named metrics, by property and then by metric." })
    ),
    aliased: S.Record(MetricName, S.Json).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<MetricName, S.Json>())),
      S.annotateKey({ description: "Metrics whose names do not follow the convention, under their own names." })
    ),
  }).pipe(
    $I.annoteSchema("MetricLookup", {
      description: "A result row's metrics, regrouped into a lookup by property and metric.",
    })
  )
) {}
