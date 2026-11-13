/**
 * Object filters: the predicate language of object searches and filtered object sets.
 *
 * **Details**
 *
 * OSDK writes a filter as a bag of `$`-keyed records (`{ age: { $gt: 21 } }`) and
 * compiles it by hand into the wire's tagged search query. Here the tagged tree
 * is the model: {@link ObjectFilter} is one recursive union of the 28 wire
 * members on `type`, so a filter is data that can be matched, folded, checked
 * against an object type and sent as is.
 *
 * Every wire member that tests a property addresses it with one of two mutually
 * exclusive keys, `field` (a bare property name) or `propertyIdentifier` (a
 * selector record). The domain has one field, `property`, holding a property
 * selector. The pair is read and written in one place, the `PropertyAddressed`
 * factory of the Property concept, and {@link PropertyFilter} is the union of
 * the 25 members built with it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { BoundingBox, Distance, GeoPoint, Geometry, Polygon } from "../Geo/Geo.model.ts";
import { RecursiveArraySizeHint } from "../internal/RecursionHint.ts";
import { PropertyAddressed } from "../Property/Property.addressing.ts";
import { ScalarValue } from "../Value/Value.model.ts";
import type { Position } from "../Geo/Geo.model.ts";

const $I = $ScratchpadId.create("osdk/Filter/Filter.model");

// -----------------------------------------------------------------------------
// Literal domains
// -----------------------------------------------------------------------------

/**
 * Which indexed form of a text property a full-text operator searches.
 *
 * **Details**
 *
 * `baseAnalyzer` is the analyzer the property was indexed with and is what the
 * platform uses when no analyzer is named. `phoneticAnalyzer` searches the
 * sounds-alike index, so "Jon" finds "John".
 *
 * **Example** (Decode the wire analyzer name)
 *
 * ```ts import.meta.vitest name="Decode the wire analyzer name"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TextAnalyzer } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const analyzer = await Effect.runPromise(S.decodeUnknownEffect(TextAnalyzer)("PHONETIC_ANALYZER"))
 * analyzer // => "phoneticAnalyzer"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextAnalyzer = MappedLiteralKit([
  ["BASE_ANALYZER", "baseAnalyzer"],
  ["PHONETIC_ANALYZER", "phoneticAnalyzer"],
]).pipe(
  $I.annoteSchema("TextAnalyzer", {
    description: "Which indexed form of a text property a full-text operator searches: as indexed, or by sound.",
  })
);

/**
 * Runtime type of {@link TextAnalyzer}.
 *
 * @category models
 * @since 0.0.0
 */
export type TextAnalyzer = typeof TextAnalyzer.Type;

/**
 * How a geospatial property must relate to a search geometry.
 *
 * **Example** (Decode the wire relation)
 *
 * ```ts import.meta.vitest name="Decode the wire relation"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SpatialRelation } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const relation = await Effect.runPromise(S.decodeUnknownEffect(SpatialRelation)("DISJOINT"))
 * relation // => "disjoint"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SpatialRelation = MappedLiteralKit([
  ["INTERSECTS", "intersects"],
  ["DISJOINT", "disjoint"],
  ["WITHIN", "within"],
  ["CONTAINS", "contains"],
]).pipe(
  $I.annoteSchema("SpatialRelation", {
    description:
      "How a geospatial property must relate to a search geometry: touch it, avoid it, lie inside it or enclose it.",
  })
);

/**
 * Runtime type of {@link SpatialRelation}.
 *
 * @category models
 * @since 0.0.0
 */
export type SpatialRelation = typeof SpatialRelation.Type;

/**
 * Calendar unit a relative date bound is counted in.
 *
 * **Details**
 *
 * The wire spells these four units in the singular (`DAY`), unlike the plural
 * `DAYS` of durations and series reads, so this is its own enum. The domain
 * literals are the lowerCamel form of the wire words, as for every mapped enum
 * of the library: singular here (`day`), plural there (`days`).
 *
 * **Example** (Decode the singular wire unit)
 *
 * ```ts import.meta.vitest name="Decode the singular wire unit"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { RelativeDateUnit } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const unit = await Effect.runPromise(S.decodeUnknownEffect(RelativeDateUnit)("WEEK"))
 * unit // => "week"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RelativeDateUnit = MappedLiteralKit([
  ["DAY", "day"],
  ["WEEK", "week"],
  ["MONTH", "month"],
  ["YEAR", "year"],
]).pipe(
  $I.annoteSchema("RelativeDateUnit", {
    description: "Calendar unit a relative date bound is counted in: a day, a week, a month or a year.",
  })
);

/**
 * Runtime type of {@link RelativeDateUnit}.
 *
 * @category models
 * @since 0.0.0
 */
export type RelativeDateUnit = typeof RelativeDateUnit.Type;

// -----------------------------------------------------------------------------
// Interval rules
// -----------------------------------------------------------------------------

const IntervalRuleKind = LiteralKit(["match", "prefixOnLastToken", "allOf", "anyOf", "fuzzy"]);

const suspendedIntervalRule = S.suspend((): S.Codec<IntervalRule, IntervalRule.Encoded> => IntervalRule);

const maxGapsField = S.OptionFromOptionalKey(S.Finite).pipe(
  S.withConstructorDefault(Effect.succeedNone),
  S.annotateKey({
    description: "Most positions allowed between matches; gaps are not considered when absent.",
  })
);

const orderedField = S.Boolean.annotateKey({
  description: "Whether the matches must occur in the order given.",
});

/**
 * Interval rule that matches the terms of a query.
 *
 * @category models
 * @since 0.0.0
 */
export class IntervalMatch extends S.Opaque<IntervalMatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("match"),
    query: S.String.annotateKey({ description: "Whitespace-separated terms to find." }),
    ordered: orderedField,
    maxGaps: maxGapsField,
  }).pipe($I.annoteSchema("IntervalMatch", { description: "Interval rule that matches the terms of a query." }))
) {}

/**
 * Interval rule that matches every term exactly except the last, which matches as a prefix.
 *
 * @category models
 * @since 0.0.0
 */
export class IntervalPrefixMatch extends S.Opaque<IntervalPrefixMatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("prefixOnLastToken"),
    query: S.String.annotateKey({ description: "Whitespace-separated terms, in order; the last one is a prefix." }),
  }).pipe(
    $I.annoteSchema("IntervalPrefixMatch", {
      description: "Interval rule that matches every term exactly except the last, which matches as a prefix.",
    })
  )
) {}

/**
 * Interval rule satisfied when every sub-rule matches.
 *
 * @category models
 * @since 0.0.0
 */
export class IntervalAllOf extends S.Opaque<IntervalAllOf, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("allOf"),
    rules: S.Array(suspendedIntervalRule)
      .check(RecursiveArraySizeHint)
      .annotateKey({ description: "Rules that must all match." }),
    ordered: orderedField,
    maxGaps: maxGapsField,
  }).pipe($I.annoteSchema("IntervalAllOf", { description: "Interval rule satisfied when every sub-rule matches." }))
) {}

/**
 * Companion namespace for {@link IntervalAllOf}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IntervalAllOf {
  /**
   * Encoded form of {@link IntervalAllOf}, declared explicitly because the rule is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "allOf";
    readonly rules: ReadonlyArray<IntervalRule.Encoded>;
    readonly ordered: boolean;
    readonly maxGaps?: number;
  }
}

/**
 * Interval rule satisfied when at least one sub-rule matches.
 *
 * @category models
 * @since 0.0.0
 */
export class IntervalAnyOf extends S.Opaque<IntervalAnyOf, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("anyOf"),
    rules: S.Array(suspendedIntervalRule)
      .check(RecursiveArraySizeHint)
      .annotateKey({ description: "Rules of which one must match." }),
  }).pipe(
    $I.annoteSchema("IntervalAnyOf", { description: "Interval rule satisfied when at least one sub-rule matches." })
  )
) {}

/**
 * Companion namespace for {@link IntervalAnyOf}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IntervalAnyOf {
  /**
   * Encoded form of {@link IntervalAnyOf}, declared explicitly because the rule is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "anyOf";
    readonly rules: ReadonlyArray<IntervalRule.Encoded>;
  }
}

/**
 * Interval rule that matches terms within an edit distance of one term.
 *
 * **Details**
 *
 * One edit is a character inserted, deleted, substituted or swapped with its
 * neighbor. The platform documents distances 0, 1 and 2 and uses 2 when none is
 * given; the wire itself only says "number", so no range is enforced here.
 *
 * @category models
 * @since 0.0.0
 */
export class IntervalFuzzyMatch extends S.Opaque<IntervalFuzzyMatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("fuzzy"),
    term: S.String.annotateKey({ description: "The single term to approximate." }),
    fuzziness: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Most edits a matching term may be away; the platform default applies when absent.",
      })
    ),
  }).pipe(
    $I.annoteSchema("IntervalFuzzyMatch", {
      description: "Interval rule that matches terms within an edit distance of one term.",
    })
  )
) {}

/**
 * A positional full-text rule over the analyzed form of a text property: where terms occur relative to each other.
 *
 * **Example** (Describe a nested interval rule)
 *
 * ```ts import.meta.vitest name="Describe a nested interval rule"
 * import { IntervalAllOf, IntervalFuzzyMatch, IntervalMatch, IntervalRule } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const describe: (rule: IntervalRule) => string = IntervalRule.match({
 *   match: ({ query }) => `"${query}"`,
 *   prefixOnLastToken: ({ query }) => `"${query}"*`,
 *   allOf: ({ rules }) => `all(${rules.length})`,
 *   anyOf: ({ rules }) => `some(${rules.length})`,
 *   fuzzy: ({ term }) => `~${term}`,
 * })
 * const quick = IntervalMatch.make({ query: "quick", ordered: true })
 * const fox = IntervalFuzzyMatch.make({ term: "fox" })
 * const texts = [describe(quick), describe(fox), describe(IntervalAllOf.make({ rules: [quick, fox], ordered: true }))]
 * texts // => ['"quick"', "~fox", "all(2)"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const IntervalRule = IntervalRuleKind.mapMembers(() =>
  Tuple.make(IntervalMatch, IntervalPrefixMatch, IntervalAllOf, IntervalAnyOf, IntervalFuzzyMatch)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("IntervalRule", {
    description: "A positional full-text rule: where terms occur relative to each other in a text property.",
  })
);

/**
 * Runtime type of {@link IntervalRule}.
 *
 * @category models
 * @since 0.0.0
 */
export type IntervalRule = IntervalMatch | IntervalPrefixMatch | IntervalAllOf | IntervalAnyOf | IntervalFuzzyMatch;

/**
 * Companion namespace for {@link IntervalRule}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IntervalRule {
  /**
   * Encoded (wire) form of {@link IntervalRule}, declared explicitly because the union is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | (typeof IntervalMatch)["Encoded"]
    | (typeof IntervalPrefixMatch)["Encoded"]
    | IntervalAllOf.Encoded
    | IntervalAnyOf.Encoded
    | (typeof IntervalFuzzyMatch)["Encoded"];
}

// -----------------------------------------------------------------------------
// Operand records
// -----------------------------------------------------------------------------

/**
 * A moment counted in calendar units from the time the query runs.
 *
 * **Details**
 *
 * The wire wraps this in a one-member union tagged `relativePoint`; the tag is
 * kept so the encoded form is exactly the wire's.
 *
 * **Example** (Encode one week before the query runs)
 *
 * ```ts import.meta.vitest name="Encode one week before the query runs"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { RelativePoint } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(RelativePoint)(RelativePoint.make({ value: -1, timeUnit: "week" })))
 * wire // => { type: "relativePoint", value: -1, timeUnit: "WEEK" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RelativePoint extends S.Opaque<RelativePoint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("relativePoint"),
    value: S.Finite.annotateKey({ description: "How many units away from the time the query runs." }),
    timeUnit: RelativeDateUnit.annotateKey({ description: "Calendar unit the value is counted in." }),
  }).pipe(
    $I.annoteSchema("RelativePoint", {
      description: "A moment counted in calendar units from the time the query runs.",
    })
  )
) {}

/**
 * A date range whose ends move with the clock: each bound is relative to the time the query runs.
 *
 * **Details**
 *
 * Bounds are rounded to midnight in `timeZoneId`. A missing bound leaves that
 * side of the range open.
 *
 * **Example** (Describe the last seven days in New York)
 *
 * ```ts import.meta.vitest name="Describe the last seven days in New York"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { RelativeDateRange, RelativePoint } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const lastWeek = RelativeDateRange.make({
 *   relativeStartTime: O.some(RelativePoint.make({ value: -7, timeUnit: "day" })),
 *   timeZoneId: "America/New_York",
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(RelativeDateRange)(lastWeek))
 * wire // => { relativeStartTime: { type: "relativePoint", value: -7, timeUnit: "DAY" }, timeZoneId: "America/New_York" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RelativeDateRange extends S.Opaque<RelativeDateRange, { readonly brand: unique symbol }>()(
  S.Struct({
    relativeStartTime: S.OptionFromOptionalKey(RelativePoint).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Start of the range; open when absent." })
    ),
    relativeEndTime: S.OptionFromOptionalKey(RelativePoint).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "End of the range; open when absent." })
    ),
    timeZoneId: S.NonEmptyString.annotateKey({
      description: "Time zone in whose midnight the bounds are rounded, such as America/New_York.",
    }),
  }).pipe(
    $I.annoteSchema("RelativeDateRange", {
      description: "A date range whose bounds are counted from the time the query runs.",
    })
  )
) {}

/**
 * A rectangle on the globe given by its north-west and south-east corners.
 *
 * **Details**
 *
 * This is the wire's own corner order, top-left then bottom-right, not the
 * south-west / north-east order of a GeoJSON bounding box.
 * {@link BoundingBoxCorners.fromBoundingBox} converts from the GeoJSON form.
 *
 * **Example** (Take the corners of a GeoJSON bounding box)
 *
 * ```ts import.meta.vitest name="Take the corners of a GeoJSON bounding box"
 * import { BoundingBoxCorners } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const corners = BoundingBoxCorners.fromBoundingBox([-122.5, 47.5, -122.2, 47.7])
 * const coordinates = [corners.topLeft.coordinates, corners.bottomRight.coordinates]
 * coordinates // => [[-122.5, 47.7], [-122.2, 47.5]]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoundingBoxCorners extends S.Opaque<BoundingBoxCorners, { readonly brand: unique symbol }>()(
  S.Struct({
    // North-west corner. (Bare: annotating the key of a class would type the field as its un-branded record.)
    topLeft: GeoPoint,
    // South-east corner. (Bare: annotating the key of a class would type the field as its un-branded record.)
    bottomRight: GeoPoint,
  }).pipe(
    $I.annoteSchema("BoundingBoxCorners", {
      description: "A rectangle on the globe given by its north-west and south-east corners.",
    })
  )
) {
  /**
   * The corners of a GeoJSON bounding box; altitudes are dropped.
   *
   * @category constructors
   * @since 0.0.0
   */
  static fromBoundingBox(box: BoundingBox): BoundingBoxCorners {
    return BoundingBoxCorners.make({
      topLeft: GeoPoint.make({ coordinates: BoundingBox.topLeft(box) }),
      bottomRight: GeoPoint.make({ coordinates: BoundingBox.bottomRight(box) }),
    });
  }
}

/**
 * Everything within a distance of a point: the area a "within distance of" filter searches.
 *
 * **Example** (Describe five kilometres around a position)
 *
 * ```ts import.meta.vitest name="Describe five kilometres around a position"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Distance } from "@beep/scratchpad/osdk/src/Geo/index"
 * import { CircularArea } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const area = CircularArea.around([-122.33, 47.61], Distance.kilometers(5))
 * const wire = await Effect.runPromise(S.encodeEffect(CircularArea)(area))
 * wire // => { center: { type: "Point", coordinates: [-122.33, 47.61] }, distance: { value: 5, unit: "KILOMETERS" } }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CircularArea extends S.Opaque<CircularArea, { readonly brand: unique symbol }>()(
  S.Struct({
    // Point the distance is measured from.
    // (Bare: annotating the key of a class would type the field as its un-branded record.)
    center: GeoPoint,
    // How far from the center the area reaches.
    // (Bare: annotating the key of a class would type the field as its un-branded record.)
    distance: Distance,
  }).pipe(
    $I.annoteSchema("CircularArea", {
      description: "Everything within a distance of a point.",
    })
  )
) {
  /**
   * The area reaching `distance` from a position.
   *
   * @category constructors
   * @since 0.0.0
   */
  static around(center: Position, distance: Distance): CircularArea {
    return CircularArea.make({ center: GeoPoint.make({ coordinates: center }), distance });
  }
}

const SearchGeometryKind = LiteralKit(["envelope", "geoJson"]);

/**
 * Search geometry given as a rectangle between two corners.
 *
 * @category models
 * @since 0.0.0
 */
export class EnvelopeGeometry extends S.Opaque<EnvelopeGeometry, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("envelope"),
    ...BoundingBoxCorners.fields,
  }).pipe(
    $I.annoteSchema("EnvelopeGeometry", { description: "Search geometry given as a rectangle between two corners." })
  )
) {}

/**
 * Search geometry given as any GeoJSON geometry.
 *
 * **Details**
 *
 * The wire carries the geometry as GeoJSON text inside a JSON string. Here it
 * is the parsed geometry; encoding serializes it again without whitespace.
 *
 * @category models
 * @since 0.0.0
 */
export class GeoJsonGeometry extends S.Opaque<GeoJsonGeometry, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("geoJson"),
    geoJson: S.fromJsonString(Geometry).annotateKey({ description: "The geometry to compare with." }),
  }).pipe($I.annoteSchema("GeoJsonGeometry", { description: "Search geometry given as any GeoJSON geometry." }))
) {}

/**
 * The shape a spatial-relation filter compares a geospatial property with.
 *
 * **Example** (Decode a geometry sent as GeoJSON text)
 *
 * ```ts import.meta.vitest name="Decode a geometry sent as GeoJSON text"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SearchGeometry } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const shape = await Effect.runPromise(
 *   S.decodeUnknownEffect(SearchGeometry)({ type: "geoJson", geoJson: '{"type":"Point","coordinates":[1,2]}' })
 * )
 * const kind = SearchGeometry.match(shape, { envelope: () => "rectangle", geoJson: ({ geoJson }) => geoJson.type })
 * kind // => "Point"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SearchGeometry = SearchGeometryKind.mapMembers(() => Tuple.make(EnvelopeGeometry, GeoJsonGeometry)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("SearchGeometry", {
    description: "The shape a spatial-relation filter compares a geospatial property with.",
  })
);

/**
 * Runtime type of {@link SearchGeometry}.
 *
 * @category models
 * @since 0.0.0
 */
export type SearchGeometry = typeof SearchGeometry.Type;

// -----------------------------------------------------------------------------
// Comparison, membership and null tests
// -----------------------------------------------------------------------------

const comparandField = ScalarValue.annotateKey({ description: "Value the property is compared with." });

/**
 * Matches objects whose property is less than a value.
 *
 * @category models
 * @since 0.0.0
 */
export class LessThan extends S.Opaque<LessThan, { readonly brand: unique symbol }>()(
  PropertyAddressed("lt", { value: comparandField }).pipe(
    $I.annoteSchema("LessThan", { description: "Matches objects whose property is less than a value." })
  )
) {}

/**
 * Matches objects whose property is greater than a value.
 *
 * @category models
 * @since 0.0.0
 */
export class GreaterThan extends S.Opaque<GreaterThan, { readonly brand: unique symbol }>()(
  PropertyAddressed("gt", { value: comparandField }).pipe(
    $I.annoteSchema("GreaterThan", { description: "Matches objects whose property is greater than a value." })
  )
) {}

/**
 * Matches objects whose property is less than or equal to a value.
 *
 * @category models
 * @since 0.0.0
 */
export class LessThanOrEqual extends S.Opaque<LessThanOrEqual, { readonly brand: unique symbol }>()(
  PropertyAddressed("lte", { value: comparandField }).pipe(
    $I.annoteSchema("LessThanOrEqual", {
      description: "Matches objects whose property is less than or equal to a value.",
    })
  )
) {}

/**
 * Matches objects whose property is greater than or equal to a value.
 *
 * @category models
 * @since 0.0.0
 */
export class GreaterThanOrEqual extends S.Opaque<GreaterThanOrEqual, { readonly brand: unique symbol }>()(
  PropertyAddressed("gte", { value: comparandField }).pipe(
    $I.annoteSchema("GreaterThanOrEqual", {
      description: "Matches objects whose property is greater than or equal to a value.",
    })
  )
) {}

/**
 * Matches objects whose property equals a value.
 *
 * **Gotchas**
 *
 * On a string property the platform matches the whole value only when the
 * property is marked "Selectable" in the ontology; otherwise it matches terms.
 * The wire has no "not equals": negate this filter instead.
 *
 * @category models
 * @since 0.0.0
 */
export class Equals extends S.Opaque<Equals, { readonly brand: unique symbol }>()(
  PropertyAddressed("eq", { value: comparandField }).pipe(
    $I.annoteSchema("Equals", { description: "Matches objects whose property equals a value." })
  )
) {}

/**
 * Matches objects whose property equals any of the listed values.
 *
 * **Gotchas**
 *
 * An empty list matches every object, not none.
 *
 * @category models
 * @since 0.0.0
 */
export class OneOf extends S.Opaque<OneOf, { readonly brand: unique symbol }>()(
  PropertyAddressed("in", {
    value: S.Array(ScalarValue).annotateKey({ description: "Values of which the property must equal one." }),
  }).pipe($I.annoteSchema("OneOf", { description: "Matches objects whose property equals any of the listed values." }))
) {}

/**
 * Matches objects by whether their property has a value at all.
 *
 * @category models
 * @since 0.0.0
 */
export class IsNull extends S.Opaque<IsNull, { readonly brand: unique symbol }>()(
  PropertyAddressed("isNull", {
    value: S.Boolean.annotateKey({
      description: "True to match objects without a value, false to match those with one.",
    }),
  }).pipe($I.annoteSchema("IsNull", { description: "Matches objects by whether their property has a value at all." }))
) {}

/**
 * Matches objects whose array property contains a value.
 *
 * @category models
 * @since 0.0.0
 */
export class Contains extends S.Opaque<Contains, { readonly brand: unique symbol }>()(
  PropertyAddressed("contains", {
    value: ScalarValue.annotateKey({ description: "Value the array must contain." }),
  }).pipe($I.annoteSchema("Contains", { description: "Matches objects whose array property contains a value." }))
) {}

// -----------------------------------------------------------------------------
// Text search
// -----------------------------------------------------------------------------

const analyzerField = S.OptionFromOptionalKey(TextAnalyzer).pipe(
  S.withConstructorDefault(Effect.succeedNone),
  S.annotateKey({ description: "Indexed form to search; the form the property was indexed with when absent." })
);

const phraseFields = {
  analyzerSelection: analyzerField,
  value: S.String.annotateKey({ description: "Whitespace-separated terms to find." }),
};

const termFields = {
  ...phraseFields,
  fuzzy: S.OptionFromOptionalKey(S.Boolean).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Whether terms may match approximately; exact when absent." })
  ),
};

const PhoneticExcludesFuzzyCheck = S.makeFilter(
  (terms: { readonly analyzerSelection: O.Option<TextAnalyzer>; readonly fuzzy: O.Option<boolean> }) =>
    !(O.contains(terms.analyzerSelection, TextAnalyzer.From.Enum.PHONETIC_ANALYZER) && O.contains(terms.fuzzy, true)),
  $I.annote("PhoneticExcludesFuzzyCheck", {
    title: "Phonetic Excludes Fuzzy",
    description: "A term search that does not ask for fuzzy matching on the phonetic index.",
    expected: "fuzzy absent or false when the phonetic analyzer is selected",
    message: "Fuzzy matching cannot be combined with the phonetic analyzer",
  })
);

/**
 * Matches objects whose text property holds the terms as a phrase whose last term is a prefix.
 *
 * **Details**
 *
 * The platform keeps this tag as a deprecated alias of
 * {@link ContainsAllTermsInOrderPrefixLastTerm}: the name suggests a string
 * prefix test, which it is not.
 *
 * @category models
 * @since 0.0.0
 */
export class StartsWith extends S.Opaque<StartsWith, { readonly brand: unique symbol }>()(
  PropertyAddressed("startsWith", phraseFields).pipe(
    $I.annoteSchema("StartsWith", {
      description: "Matches objects whose text property holds the terms as a phrase whose last term is a prefix.",
    })
  )
) {}

/**
 * Matches objects whose text property matches a wildcard pattern.
 *
 * @category models
 * @since 0.0.0
 */
export class MatchesWildcard extends S.Opaque<MatchesWildcard, { readonly brand: unique symbol }>()(
  PropertyAddressed("wildcard", {
    value: S.String.annotateKey({ description: "Wildcard pattern the property must match." }),
  }).pipe(
    $I.annoteSchema("MatchesWildcard", {
      description: "Matches objects whose text property matches a wildcard pattern.",
    })
  )
) {}

/**
 * Matches objects whose text property, in its stored form, matches a regular expression.
 *
 * **Details**
 *
 * The pattern runs against the non-analyzed form of the text, in the platform's
 * search-syntax dialect rather than JavaScript's.
 *
 * @category models
 * @since 0.0.0
 */
export class MatchesRegex extends S.Opaque<MatchesRegex, { readonly brand: unique symbol }>()(
  PropertyAddressed("regex", {
    value: S.String.annotateKey({ description: "Regular expression in the platform's search syntax." }),
  }).pipe(
    $I.annoteSchema("MatchesRegex", {
      description: "Matches objects whose text property, in its stored form, matches a regular expression.",
    })
  )
) {}

/**
 * Matches objects whose text property contains at least one of the terms, in any order.
 *
 * @invariant Fuzzy matching is not requested together with the phonetic analyzer.
 * @category models
 * @since 0.0.0
 */
export class ContainsAnyTerm extends S.Opaque<ContainsAnyTerm, { readonly brand: unique symbol }>()(
  PropertyAddressed("containsAnyTerm", termFields)
    .check(PhoneticExcludesFuzzyCheck)
    .pipe(
      $I.annoteSchema("ContainsAnyTerm", {
        description: "Matches objects whose text property contains at least one of the terms, in any order.",
      })
    )
) {}

/**
 * Matches objects whose text property contains every term, in any order.
 *
 * @invariant Fuzzy matching is not requested together with the phonetic analyzer.
 * @category models
 * @since 0.0.0
 */
export class ContainsAllTerms extends S.Opaque<ContainsAllTerms, { readonly brand: unique symbol }>()(
  PropertyAddressed("containsAllTerms", termFields)
    .check(PhoneticExcludesFuzzyCheck)
    .pipe(
      $I.annoteSchema("ContainsAllTerms", {
        description: "Matches objects whose text property contains every term, in any order.",
      })
    )
) {}

/**
 * Matches objects whose text property contains the terms as a phrase: in order and adjacent.
 *
 * @category models
 * @since 0.0.0
 */
export class ContainsAllTermsInOrder extends S.Opaque<ContainsAllTermsInOrder, { readonly brand: unique symbol }>()(
  PropertyAddressed("containsAllTermsInOrder", phraseFields).pipe(
    $I.annoteSchema("ContainsAllTermsInOrder", {
      description: "Matches objects whose text property contains the terms as a phrase: in order and adjacent.",
    })
  )
) {}

/**
 * Matches objects whose text property contains the terms as a phrase whose last term may be a prefix.
 *
 * @category models
 * @since 0.0.0
 */
export class ContainsAllTermsInOrderPrefixLastTerm extends S.Opaque<
  ContainsAllTermsInOrderPrefixLastTerm,
  { readonly brand: unique symbol }
>()(
  PropertyAddressed("containsAllTermsInOrderPrefixLastTerm", phraseFields).pipe(
    $I.annoteSchema("ContainsAllTermsInOrderPrefixLastTerm", {
      description:
        "Matches objects whose text property contains the terms as a phrase whose last term may be a prefix.",
    })
  )
) {}

/**
 * Matches objects whose text property satisfies a positional interval rule.
 *
 * @category models
 * @since 0.0.0
 */
export class MatchesInterval extends S.Opaque<MatchesInterval, { readonly brand: unique symbol }>()(
  PropertyAddressed("interval", {
    rule: IntervalRule.annotateKey({ description: "Rule the analyzed text must satisfy." }),
  }).pipe(
    $I.annoteSchema("MatchesInterval", {
      description: "Matches objects whose text property satisfies a positional interval rule.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Dates
// -----------------------------------------------------------------------------

/**
 * Matches objects whose date or timestamp property falls in a range that moves with the clock.
 *
 * @category models
 * @since 0.0.0
 */
export class InRelativeDateRange extends S.Opaque<InRelativeDateRange, { readonly brand: unique symbol }>()(
  PropertyAddressed("relativeDateRange", RelativeDateRange.fields).pipe(
    $I.annoteSchema("InRelativeDateRange", {
      description: "Matches objects whose date or timestamp property falls in a range that moves with the clock.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Geospatial
// -----------------------------------------------------------------------------

// The rectangle or polygon a spatial member compares the property with sits under `value` as the bare
// class: annotating the key of a class would type the field as its un-branded record.
const cornersField = BoundingBoxCorners;
const polygonField = Polygon;

/**
 * Matches objects whose point lies within a distance of a center point.
 *
 * @category models
 * @since 0.0.0
 */
export class WithinDistance extends S.Opaque<WithinDistance, { readonly brand: unique symbol }>()(
  PropertyAddressed("withinDistanceOf", {
    // Center point and radius of the searched area.
    // (Bare: annotating the key of a class would type the field as its un-branded record.)
    value: CircularArea,
  }).pipe(
    $I.annoteSchema("WithinDistance", {
      description: "Matches objects whose point lies within a distance of a center point.",
    })
  )
) {}

/**
 * Matches objects whose geometry lies inside a rectangle.
 *
 * @category models
 * @since 0.0.0
 */
export class WithinBoundingBox extends S.Opaque<WithinBoundingBox, { readonly brand: unique symbol }>()(
  PropertyAddressed("withinBoundingBox", { value: cornersField }).pipe(
    $I.annoteSchema("WithinBoundingBox", { description: "Matches objects whose geometry lies inside a rectangle." })
  )
) {}

/**
 * Matches objects whose geometry lies inside a polygon.
 *
 * @category models
 * @since 0.0.0
 */
export class WithinPolygon extends S.Opaque<WithinPolygon, { readonly brand: unique symbol }>()(
  PropertyAddressed("withinPolygon", { value: polygonField }).pipe(
    $I.annoteSchema("WithinPolygon", { description: "Matches objects whose geometry lies inside a polygon." })
  )
) {}

/**
 * Matches objects whose geometry touches or overlaps a rectangle.
 *
 * @category models
 * @since 0.0.0
 */
export class IntersectsBoundingBox extends S.Opaque<IntersectsBoundingBox, { readonly brand: unique symbol }>()(
  PropertyAddressed("intersectsBoundingBox", { value: cornersField }).pipe(
    $I.annoteSchema("IntersectsBoundingBox", {
      description: "Matches objects whose geometry touches or overlaps a rectangle.",
    })
  )
) {}

/**
 * Matches objects whose geometry touches or overlaps a polygon.
 *
 * @category models
 * @since 0.0.0
 */
export class IntersectsPolygon extends S.Opaque<IntersectsPolygon, { readonly brand: unique symbol }>()(
  PropertyAddressed("intersectsPolygon", { value: polygonField }).pipe(
    $I.annoteSchema("IntersectsPolygon", {
      description: "Matches objects whose geometry touches or overlaps a polygon.",
    })
  )
) {}

/**
 * Matches objects whose geometry has no point in common with a rectangle.
 *
 * @category models
 * @since 0.0.0
 */
export class DoesNotIntersectBoundingBox extends S.Opaque<
  DoesNotIntersectBoundingBox,
  { readonly brand: unique symbol }
>()(
  PropertyAddressed("doesNotIntersectBoundingBox", { value: cornersField }).pipe(
    $I.annoteSchema("DoesNotIntersectBoundingBox", {
      description: "Matches objects whose geometry has no point in common with a rectangle.",
    })
  )
) {}

/**
 * Matches objects whose geometry has no point in common with a polygon.
 *
 * @category models
 * @since 0.0.0
 */
export class DoesNotIntersectPolygon extends S.Opaque<DoesNotIntersectPolygon, { readonly brand: unique symbol }>()(
  PropertyAddressed("doesNotIntersectPolygon", { value: polygonField }).pipe(
    $I.annoteSchema("DoesNotIntersectPolygon", {
      description: "Matches objects whose geometry has no point in common with a polygon.",
    })
  )
) {}

/**
 * Matches objects whose geopoint or geoshape stands in a chosen spatial relation to a geometry.
 *
 * **Details**
 *
 * One member that covers what the six fixed members (within, intersects, does
 * not intersect, each for a rectangle and a polygon) express, plus the
 * `contains` relation and geometries other than rectangles and polygons.
 *
 * @category models
 * @since 0.0.0
 */
export class RelatesToGeometry extends S.Opaque<RelatesToGeometry, { readonly brand: unique symbol }>()(
  PropertyAddressed("geoShapeV2", {
    geometry: SearchGeometry.annotateKey({ description: "Geometry the property is compared with." }),
    spatialFilterMode: SpatialRelation.annotateKey({ description: "Relation the property must have to the geometry." }),
  }).pipe(
    $I.annoteSchema("RelatesToGeometry", {
      description: "Matches objects whose geopoint or geoshape stands in a chosen spatial relation to a geometry.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Logical combinators
// -----------------------------------------------------------------------------

const suspendedObjectFilter = S.suspend((): S.Codec<ObjectFilter, ObjectFilter.Encoded> => ObjectFilter);

/**
 * Matches objects that satisfy every listed filter.
 *
 * **Details**
 *
 * The wire key is `value`; here it is `filters`. With no filters it matches
 * every object.
 *
 * @category models
 * @since 0.0.0
 */
export class And extends S.Opaque<And, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("and"),
    filters: S.Array(suspendedObjectFilter)
      .check(RecursiveArraySizeHint)
      .annotateKey({ description: "Filters that must all match." }),
  }).pipe(
    S.encodeKeys({ filters: "value" }),
    $I.annoteSchema("And", { description: "Matches objects that satisfy every listed filter." })
  )
) {}

/**
 * Companion namespace for {@link And}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace And {
  /**
   * Encoded form of {@link And}, declared explicitly because the filter is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "and";
    readonly value: ReadonlyArray<ObjectFilter.Encoded>;
  }
}

/**
 * Matches objects that satisfy at least one of the listed filters.
 *
 * **Details**
 *
 * The wire key is `value`; here it is `filters`. With no filters it matches no
 * object.
 *
 * @category models
 * @since 0.0.0
 */
export class Or extends S.Opaque<Or, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("or"),
    filters: S.Array(suspendedObjectFilter)
      .check(RecursiveArraySizeHint)
      .annotateKey({ description: "Filters of which one must match." }),
  }).pipe(
    S.encodeKeys({ filters: "value" }),
    $I.annoteSchema("Or", { description: "Matches objects that satisfy at least one of the listed filters." })
  )
) {}

/**
 * Companion namespace for {@link Or}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Or {
  /**
   * Encoded form of {@link Or}, declared explicitly because the filter is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "or";
    readonly value: ReadonlyArray<ObjectFilter.Encoded>;
  }
}

/**
 * Matches objects that do not satisfy a filter.
 *
 * **Details**
 *
 * The wire key is `value`; here it is `filter`.
 *
 * @category models
 * @since 0.0.0
 */
export class Not extends S.Opaque<Not, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("not"),
    filter: suspendedObjectFilter.annotateKey({ description: "Filter that must not match." }),
  }).pipe(
    S.encodeKeys({ filter: "value" }),
    $I.annoteSchema("Not", { description: "Matches objects that do not satisfy a filter." })
  )
) {}

/**
 * Companion namespace for {@link Not}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Not {
  /**
   * Encoded form of {@link Not}, declared explicitly because the filter is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "not";
    readonly value: ObjectFilter.Encoded;
  }
}

// -----------------------------------------------------------------------------
// The filter unions
// -----------------------------------------------------------------------------

const ObjectFilterKind = LiteralKit([
  "lt",
  "gt",
  "lte",
  "gte",
  "eq",
  "in",
  "isNull",
  "contains",
  "startsWith",
  "wildcard",
  "regex",
  "containsAnyTerm",
  "containsAllTerms",
  "containsAllTermsInOrder",
  "containsAllTermsInOrderPrefixLastTerm",
  "interval",
  "relativeDateRange",
  "withinDistanceOf",
  "withinBoundingBox",
  "withinPolygon",
  "intersectsBoundingBox",
  "intersectsPolygon",
  "doesNotIntersectBoundingBox",
  "doesNotIntersectPolygon",
  "geoShapeV2",
  "and",
  "or",
  "not",
]);

const PropertyFilterKind = ObjectFilterKind.omit(["and", "or", "not"]);

/**
 * A filter that tests exactly one property: every {@link ObjectFilter} case except the logical combinators.
 *
 * **Example** (Read the property a leaf filter tests)
 *
 * ```ts import.meta.vitest name="Read the property a leaf filter tests"
 * import * as S from "effect/Schema"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { PropertyByName } from "@beep/scratchpad/osdk/src/Property/index"
 * import { And, GreaterThan, PropertyFilter } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const older = GreaterThan.make({ property: PropertyByName.make({ apiName: PropertyApiName.make("age") }), value: 21 })
 * const isLeaf = S.is(PropertyFilter)
 * const facts = [isLeaf(older), isLeaf(And.make({ filters: [older] })), older.property.type, PropertyFilter.discriminants.length]
 * facts // => [true, false, "property", 25]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PropertyFilter = PropertyFilterKind.mapMembers(() =>
  Tuple.make(
    LessThan,
    GreaterThan,
    LessThanOrEqual,
    GreaterThanOrEqual,
    Equals,
    OneOf,
    IsNull,
    Contains,
    StartsWith,
    MatchesWildcard,
    MatchesRegex,
    ContainsAnyTerm,
    ContainsAllTerms,
    ContainsAllTermsInOrder,
    ContainsAllTermsInOrderPrefixLastTerm,
    MatchesInterval,
    InRelativeDateRange,
    WithinDistance,
    WithinBoundingBox,
    WithinPolygon,
    IntersectsBoundingBox,
    IntersectsPolygon,
    DoesNotIntersectBoundingBox,
    DoesNotIntersectPolygon,
    RelatesToGeometry
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("PropertyFilter", {
    description: "A filter that tests exactly one property of an object.",
  })
);

/**
 * Runtime type of {@link PropertyFilter}.
 *
 * @category models
 * @since 0.0.0
 */
export type PropertyFilter = typeof PropertyFilter.Type;

/**
 * A predicate over the objects of one type: property tests combined with and, or and not.
 *
 * **Details**
 *
 * The encoded side is the platform's search query, member for member. The
 * domain side differs in three sanctioned ways: one `property` selector
 * replaces the `field` / `propertyIdentifier` pair, the combinators name their
 * operands `filters` and `filter`, and upper-case enums are domain literals.
 *
 * A comparison operand is the wire scalar that carries it (`ScalarValue`), so
 * the codec round-trips exactly: a filter decoded from its own encoding is
 * equivalent to the original. Where the property is a date, a long, a decimal
 * or an instant the operand is its text; `operandCodec` of the property's type
 * reads it as a value of that property, and the typed constructors of `Model`
 * write it from one.
 *
 * **Example** (Decode a wire filter and walk it)
 *
 * ```ts import.meta.vitest name="Decode a wire filter and walk it"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectFilter } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const wire = {
 *   type: "and",
 *   value: [
 *     { type: "gte", field: "age", value: 21 },
 *     { type: "not", value: { type: "eq", propertyIdentifier: { type: "titleProperty" }, value: "Ishmael" } },
 *   ],
 * }
 * const filter = await Effect.runPromise(S.decodeUnknownEffect(ObjectFilter)(wire))
 * const size = (node: ObjectFilter): number =>
 *   ObjectFilter.matchOrElse(
 *     node,
 *     {
 *       and: ({ filters }) => 1 + A.reduce(filters, 0, (total, child) => total + size(child)),
 *       or: ({ filters }) => 1 + A.reduce(filters, 0, (total, child) => total + size(child)),
 *       not: ({ filter: negated }) => 1 + size(negated),
 *     },
 *     () => 1
 *   )
 * const encoded = await Effect.runPromise(S.encodeEffect(ObjectFilter)(filter))
 * const facts = [size(filter), ObjectFilter.discriminants.length, encoded]
 * facts // => [4, 28, wire]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectFilter = ObjectFilterKind.mapMembers(() =>
  Tuple.make(
    LessThan,
    GreaterThan,
    LessThanOrEqual,
    GreaterThanOrEqual,
    Equals,
    OneOf,
    IsNull,
    Contains,
    StartsWith,
    MatchesWildcard,
    MatchesRegex,
    ContainsAnyTerm,
    ContainsAllTerms,
    ContainsAllTermsInOrder,
    ContainsAllTermsInOrderPrefixLastTerm,
    MatchesInterval,
    InRelativeDateRange,
    WithinDistance,
    WithinBoundingBox,
    WithinPolygon,
    IntersectsBoundingBox,
    IntersectsPolygon,
    DoesNotIntersectBoundingBox,
    DoesNotIntersectPolygon,
    RelatesToGeometry,
    And,
    Or,
    Not
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ObjectFilter", {
    description: "A predicate over the objects of one type: property tests combined with and, or and not.",
  })
);

/**
 * Runtime type of {@link ObjectFilter}.
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectFilter = PropertyFilter | And | Or | Not;

/**
 * Companion namespace for {@link ObjectFilter}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ObjectFilter {
  /**
   * Encoded (wire) form of {@link ObjectFilter}, declared explicitly because the union is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = (typeof PropertyFilter)["Encoded"] | And.Encoded | Or.Encoded | Not.Encoded;
}
