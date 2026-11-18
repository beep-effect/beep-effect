/**
 * Constructors for every filter operator, the logical combinators and the fold over a filter tree.
 *
 * **Details**
 *
 * Each property operator has one constructor in two call shapes. Data-first it
 * reads as a sentence, `gt("age", 21)`; data-last it composes in a pipeline,
 * `pipe("age", gt(21))`. A property is named by a bare API name or by any
 * property selector. Operators with options beyond their main operand (the
 * analyzer and fuzzy switches of the text operators) take them through the
 * member class's own `make`.
 *
 * A comparison operand is the wire scalar (`ScalarValue`): text, a number or a
 * boolean. These constructors know a property by name only, so a date, an
 * instant, a 64-bit integer or a decimal operand is the text it travels as.
 * The typed constructors of `Model` take the rich value and write that text
 * with the property's codec.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual, identity } from "effect/Function";
import * as P from "effect/Predicate";
import { PropertyApiName } from "../Identifier/Identifier.model.ts";
import { PropertyByName } from "../Property/Property.model.ts";
import {
  And,
  Contains,
  ContainsAllTerms,
  ContainsAllTermsInOrder,
  ContainsAllTermsInOrderPrefixLastTerm,
  ContainsAnyTerm,
  DoesNotIntersectBoundingBox,
  DoesNotIntersectPolygon,
  Equals,
  GreaterThan,
  GreaterThanOrEqual,
  InRelativeDateRange,
  IntersectsBoundingBox,
  IntersectsPolygon,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MatchesInterval,
  MatchesRegex,
  MatchesWildcard,
  Not,
  ObjectFilter,
  OneOf,
  Or,
  RelatesToGeometry,
  StartsWith,
  WithinBoundingBox,
  WithinDistance,
  WithinPolygon,
} from "./Filter.model.ts";
import type { Polygon } from "../Geo/Geo.model.ts";
import type { PropertySelector } from "../Property/Property.model.ts";
import type { ScalarValue } from "../Value/Value.model.ts";
import type {
  BoundingBoxCorners,
  CircularArea,
  IntervalRule,
  PropertyFilter,
  RelativeDateRange,
  SearchGeometry,
  SpatialRelation,
} from "./Filter.model.ts";

type PropertyNameOrSelector = string | PropertySelector;

/**
 * Turns a property reference into a selector: a bare API name selects the property of that name.
 *
 * **Example** (Select a property by its bare name)
 *
 * ```ts import.meta.vitest name="Select a property by its bare name"
 * import { TitleProperty } from "@beep/scratchpad/osdk/src/Property/index"
 * import { toSelector } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const kinds = [toSelector("fullName").type, toSelector(TitleProperty.make({})).type]
 * kinds // => ["property", "titleProperty"]
 * ```
 *
 * @throws When a bare name is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const toSelector = (property: PropertyNameOrSelector): PropertySelector =>
  P.isString(property) ? PropertyByName.make({ apiName: PropertyApiName.make(property) }) : property;

// One definition of the two call shapes shared by every operator that takes a property and one operand.
const withOperand = <Operand, Filter>(
  make: (property: PropertySelector, operand: Operand) => Filter
): {
  (operand: Operand): (property: PropertyNameOrSelector) => Filter;
  (property: PropertyNameOrSelector, operand: Operand): Filter;
} => dual(2, (property: PropertyNameOrSelector, operand: Operand): Filter => make(toSelector(property), operand));

// -----------------------------------------------------------------------------
// Comparison, membership and null tests
// -----------------------------------------------------------------------------

/**
 * Filter for objects whose property is less than a value.
 *
 * **Example** (Keep ages below 65)
 *
 * ```ts import.meta.vitest name="Keep ages below 65"
 * import { lt } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const young = lt("age", 65)
 * const parts = [young.type, young.value]
 * parts // => ["lt", 65]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const lt = withOperand((property, value: ScalarValue) => LessThan.make({ property, value }));

/**
 * Filter for objects whose property is greater than a value.
 *
 * **Example** (Keep ages above 21 in a pipeline)
 *
 * ```ts import.meta.vitest name="Keep ages above 21 in a pipeline"
 * import { pipe } from "effect/Function"
 * import { gt } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const adult = pipe("age", gt(21))
 * const parts = [adult.type, adult.property.type, adult.value]
 * parts // => ["gt", "property", 21]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const gt = withOperand((property, value: ScalarValue) => GreaterThan.make({ property, value }));

/**
 * Filter for objects whose property is less than or equal to a value.
 *
 * **Example** (Keep prices up to a ceiling)
 *
 * ```ts import.meta.vitest name="Keep prices up to a ceiling"
 * import { lte } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const affordable = lte("price", 9.99)
 * const parts = [affordable.type, affordable.value]
 * parts // => ["lte", 9.99]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const lte = withOperand((property, value: ScalarValue) => LessThanOrEqual.make({ property, value }));

/**
 * Filter for objects whose property is greater than or equal to a value.
 *
 * **Example** (Keep employees hired since an instant)
 *
 * ```ts import.meta.vitest name="Keep employees hired since an instant"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { gte, ObjectFilter } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * // No property type is in hand here, so the instant is the text it travels as.
 * const recent = gte("hiredAt", "1970-01-01T00:00:00.000Z")
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectFilter)(recent))
 * wire // => { type: "gte", field: "hiredAt", value: "1970-01-01T00:00:00.000Z" }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const gte = withOperand((property, value: ScalarValue) => GreaterThanOrEqual.make({ property, value }));

/**
 * Filter for objects whose property equals a value.
 *
 * **Example** (Match one name)
 *
 * ```ts import.meta.vitest name="Match one name"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { eq, ObjectFilter } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectFilter)(eq("fullName", "Ishmael")))
 * wire // => { type: "eq", field: "fullName", value: "Ishmael" }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const eq = withOperand((property, value: ScalarValue) => Equals.make({ property, value }));

/**
 * Filter for objects whose property does not equal a value.
 *
 * **Details**
 *
 * The wire has no "not equals" member, so this is the negation of an equality.
 *
 * **Example** (Exclude one status)
 *
 * ```ts import.meta.vitest name="Exclude one status"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ne, ObjectFilter } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectFilter)(ne("status", "archived")))
 * wire // => { type: "not", value: { type: "eq", field: "status", value: "archived" } }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ne = withOperand((property, value: ScalarValue) => Not.make({ filter: Equals.make({ property, value }) }));

/**
 * Filter for objects whose property equals any of the listed values.
 *
 * **Gotchas**
 *
 * An empty list matches every object, not none.
 *
 * **Example** (Match any of several offices)
 *
 * ```ts import.meta.vitest name="Match any of several offices"
 * import { oneOf } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const coastal = oneOf("office", ["Seattle", "Boston"])
 * const parts = [coastal.type, coastal.value]
 * parts // => ["in", ["Seattle", "Boston"]]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const oneOf = withOperand((property, value: ReadonlyArray<ScalarValue>) => OneOf.make({ property, value }));

/**
 * Filter for objects whose property has no value.
 *
 * **Example** (Find objects without a manager)
 *
 * ```ts import.meta.vitest name="Find objects without a manager"
 * import { isNull } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const unmanaged = isNull("manager")
 * const parts = [unmanaged.type, unmanaged.value]
 * parts // => ["isNull", true]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const isNull = (property: PropertyNameOrSelector): IsNull =>
  IsNull.make({ property: toSelector(property), value: true });

/**
 * Filter for objects whose property has a value.
 *
 * **Example** (Find objects with a manager)
 *
 * ```ts import.meta.vitest name="Find objects with a manager"
 * import { isNotNull } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const managed = isNotNull("manager")
 * const parts = [managed.type, managed.value]
 * parts // => ["isNull", false]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const isNotNull = (property: PropertyNameOrSelector): IsNull =>
  IsNull.make({ property: toSelector(property), value: false });

/**
 * Filter for objects whose array property contains a value.
 *
 * **Example** (Find objects tagged urgent)
 *
 * ```ts import.meta.vitest name="Find objects tagged urgent"
 * import { contains } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const urgent = contains("tags", "urgent")
 * const parts = [urgent.type, urgent.value]
 * parts // => ["contains", "urgent"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const contains = withOperand((property, value: ScalarValue) => Contains.make({ property, value }));

// -----------------------------------------------------------------------------
// Text search
// -----------------------------------------------------------------------------

/**
 * Filter for objects whose text property holds the terms as a phrase whose last term is a prefix.
 *
 * **Details**
 *
 * The platform keeps this operator as a deprecated alias of
 * {@link containsAllTermsInOrderPrefixLastTerm}.
 *
 * **Example** (Match a phrase with a prefix)
 *
 * ```ts import.meta.vitest name="Match a phrase with a prefix"
 * import { startsWith } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const filter = startsWith("title", "moby di")
 * const parts = [filter.type, filter.value]
 * parts // => ["startsWith", "moby di"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const startsWith = withOperand((property, value: string) => StartsWith.make({ property, value }));

/**
 * Filter for objects whose text property matches a wildcard pattern.
 *
 * **Example** (Match by wildcard)
 *
 * ```ts import.meta.vitest name="Match by wildcard"
 * import { matchesWildcard } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const filter = matchesWildcard("serial", "PQ-*")
 * const parts = [filter.type, filter.value]
 * parts // => ["wildcard", "PQ-*"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const matchesWildcard = withOperand((property, value: string) => MatchesWildcard.make({ property, value }));

/**
 * Filter for objects whose text property, in its stored form, matches a regular expression.
 *
 * **Example** (Match by regular expression)
 *
 * ```ts import.meta.vitest name="Match by regular expression"
 * import { matchesRegex } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const filter = matchesRegex("serial", "PQ-[0-9]{4}")
 * const parts = [filter.type, filter.value]
 * parts // => ["regex", "PQ-[0-9]{4}"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const matchesRegex = withOperand((property, value: string) => MatchesRegex.make({ property, value }));

/**
 * Filter for objects whose text property contains at least one of the terms.
 *
 * **Details**
 *
 * For fuzzy or phonetic matching construct the member directly:
 * `ContainsAnyTerm.make({ property, value, fuzzy: O.some(true) })`.
 *
 * **Example** (Match any term)
 *
 * ```ts import.meta.vitest name="Match any term"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { containsAnyTerm, ObjectFilter } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectFilter)(containsAnyTerm("bio", "whale harpoon")))
 * wire // => { type: "containsAnyTerm", field: "bio", value: "whale harpoon" }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const containsAnyTerm = withOperand((property, value: string) => ContainsAnyTerm.make({ property, value }));

/**
 * Filter for objects whose text property contains every term, in any order.
 *
 * **Example** (Match all terms)
 *
 * ```ts import.meta.vitest name="Match all terms"
 * import { containsAllTerms } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const filter = containsAllTerms("bio", "white whale")
 * const parts = [filter.type, filter.value]
 * parts // => ["containsAllTerms", "white whale"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const containsAllTerms = withOperand((property, value: string) => ContainsAllTerms.make({ property, value }));

/**
 * Filter for objects whose text property contains the terms as a phrase.
 *
 * **Example** (Match a phrase)
 *
 * ```ts import.meta.vitest name="Match a phrase"
 * import { containsAllTermsInOrder } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const filter = containsAllTermsInOrder("bio", "call me Ishmael")
 * const parts = [filter.type, filter.value]
 * parts // => ["containsAllTermsInOrder", "call me Ishmael"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const containsAllTermsInOrder = withOperand((property, value: string) =>
  ContainsAllTermsInOrder.make({ property, value })
);

/**
 * Filter for objects whose text property contains the terms as a phrase whose last term may be a prefix.
 *
 * **Example** (Match a phrase as it is typed)
 *
 * ```ts import.meta.vitest name="Match a phrase as it is typed"
 * import { containsAllTermsInOrderPrefixLastTerm } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const filter = containsAllTermsInOrderPrefixLastTerm("bio", "call me Ish")
 * const parts = [filter.type, filter.value]
 * parts // => ["containsAllTermsInOrderPrefixLastTerm", "call me Ish"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const containsAllTermsInOrderPrefixLastTerm = withOperand((property, value: string) =>
  ContainsAllTermsInOrderPrefixLastTerm.make({ property, value })
);

/**
 * Filter for objects whose text property satisfies a positional interval rule.
 *
 * **Example** (Match two terms at most one position apart)
 *
 * ```ts import.meta.vitest name="Match two terms at most one position apart"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { IntervalMatch, matchesInterval, ObjectFilter } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const near = matchesInterval("bio", IntervalMatch.make({ query: "quick fox", ordered: true, maxGaps: O.some(1) }))
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectFilter)(near))
 * wire // => { type: "interval", field: "bio", rule: { type: "match", query: "quick fox", ordered: true, maxGaps: 1 } }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const matchesInterval = withOperand((property, rule: IntervalRule) => MatchesInterval.make({ property, rule }));

// -----------------------------------------------------------------------------
// Dates
// -----------------------------------------------------------------------------

/**
 * Filter for objects whose date or timestamp property falls in a range that moves with the clock.
 *
 * **Example** (Match the last seven days)
 *
 * ```ts import.meta.vitest name="Match the last seven days"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import {
 *   inRelativeDateRange,
 *   ObjectFilter,
 *   RelativeDateRange,
 *   RelativePoint,
 * } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const lastWeek = RelativeDateRange.make({
 *   relativeStartTime: O.some(RelativePoint.make({ value: -7, timeUnit: "day" })),
 *   timeZoneId: "UTC",
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectFilter)(inRelativeDateRange("hireDate", lastWeek)))
 * wire // => { type: "relativeDateRange", field: "hireDate", relativeStartTime: { type: "relativePoint", value: -7, timeUnit: "DAY" }, timeZoneId: "UTC" }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const inRelativeDateRange = withOperand((property, range: RelativeDateRange) =>
  InRelativeDateRange.make({ property, ...range })
);

// -----------------------------------------------------------------------------
// Geospatial
// -----------------------------------------------------------------------------

/**
 * Filter for objects whose point lies within a distance of a center point.
 *
 * **Example** (Match points within five kilometres)
 *
 * ```ts import.meta.vitest name="Match points within five kilometres"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Distance } from "@beep/scratchpad/osdk/src/Geo/index"
 * import { CircularArea, ObjectFilter, withinDistance } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const nearby = withinDistance("location", CircularArea.around([-122.33, 47.61], Distance.kilometers(5)))
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectFilter)(nearby))
 * wire // => { type: "withinDistanceOf", field: "location", value: { center: { type: "Point", coordinates: [-122.33, 47.61] }, distance: { value: 5, unit: "KILOMETERS" } } }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const withinDistance = withOperand((property, value: CircularArea) => WithinDistance.make({ property, value }));

/**
 * Filter for objects whose geometry lies inside a rectangle.
 *
 * **Example** (Match geometry inside a GeoJSON bounding box)
 *
 * ```ts import.meta.vitest name="Match geometry inside a GeoJSON bounding box"
 * import { BoundingBoxCorners, withinBoundingBox } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const inside = withinBoundingBox("location", BoundingBoxCorners.fromBoundingBox([-122.5, 47.5, -122.2, 47.7]))
 * const parts = [inside.type, inside.value.topLeft.coordinates, inside.value.bottomRight.coordinates]
 * parts // => ["withinBoundingBox", [-122.5, 47.7], [-122.2, 47.5]]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const withinBoundingBox = withOperand((property, value: BoundingBoxCorners) =>
  WithinBoundingBox.make({ property, value })
);

/**
 * Filter for objects whose geometry lies inside a polygon.
 *
 * **Example** (Match geometry inside a triangle)
 *
 * ```ts import.meta.vitest name="Match geometry inside a triangle"
 * import { LinearRing, Polygon } from "@beep/scratchpad/osdk/src/Geo/index"
 * import { withinPolygon } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const triangle = Polygon.make({ coordinates: [LinearRing.fromVertices([[0, 0], [4, 0], [0, 3]])] })
 * const inside = withinPolygon("location", triangle)
 * const parts = [inside.type, inside.value.coordinates.length]
 * parts // => ["withinPolygon", 1]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const withinPolygon = withOperand((property, value: Polygon) => WithinPolygon.make({ property, value }));

/**
 * Filter for objects whose geometry touches or overlaps a rectangle.
 *
 * **Example** (Match geometry touching a rectangle)
 *
 * ```ts import.meta.vitest name="Match geometry touching a rectangle"
 * import { BoundingBoxCorners, intersectsBoundingBox } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const touching = intersectsBoundingBox("route", BoundingBoxCorners.fromBoundingBox([0, 0, 10, 10]))
 * const parts = [touching.type, touching.value.topLeft.coordinates]
 * parts // => ["intersectsBoundingBox", [0, 10]]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const intersectsBoundingBox = withOperand((property, value: BoundingBoxCorners) =>
  IntersectsBoundingBox.make({ property, value })
);

/**
 * Filter for objects whose geometry touches or overlaps a polygon.
 *
 * **Example** (Match geometry touching a triangle)
 *
 * ```ts import.meta.vitest name="Match geometry touching a triangle"
 * import { LinearRing, Polygon } from "@beep/scratchpad/osdk/src/Geo/index"
 * import { intersectsPolygon } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const triangle = Polygon.make({ coordinates: [LinearRing.fromVertices([[0, 0], [4, 0], [0, 3]])] })
 * const touching = intersectsPolygon("route", triangle)
 * touching.type // => "intersectsPolygon"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const intersectsPolygon = withOperand((property, value: Polygon) => IntersectsPolygon.make({ property, value }));

/**
 * Filter for objects whose geometry has no point in common with a rectangle.
 *
 * **Example** (Match geometry clear of a rectangle)
 *
 * ```ts import.meta.vitest name="Match geometry clear of a rectangle"
 * import { BoundingBoxCorners, doesNotIntersectBoundingBox } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const clear = doesNotIntersectBoundingBox("route", BoundingBoxCorners.fromBoundingBox([0, 0, 10, 10]))
 * clear.type // => "doesNotIntersectBoundingBox"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const doesNotIntersectBoundingBox = withOperand((property, value: BoundingBoxCorners) =>
  DoesNotIntersectBoundingBox.make({ property, value })
);

/**
 * Filter for objects whose geometry has no point in common with a polygon.
 *
 * **Example** (Match geometry clear of a triangle)
 *
 * ```ts import.meta.vitest name="Match geometry clear of a triangle"
 * import { LinearRing, Polygon } from "@beep/scratchpad/osdk/src/Geo/index"
 * import { doesNotIntersectPolygon } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const triangle = Polygon.make({ coordinates: [LinearRing.fromVertices([[0, 0], [4, 0], [0, 3]])] })
 * const clear = doesNotIntersectPolygon("route", triangle)
 * clear.type // => "doesNotIntersectPolygon"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const doesNotIntersectPolygon = withOperand((property, value: Polygon) =>
  DoesNotIntersectPolygon.make({ property, value })
);

/**
 * Filter for objects whose geopoint or geoshape stands in a chosen spatial relation to a geometry.
 *
 * **Example** (Match shapes that enclose a point)
 *
 * ```ts import.meta.vitest name="Match shapes that enclose a point"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GeoPoint } from "@beep/scratchpad/osdk/src/Geo/index"
 * import { GeoJsonGeometry, ObjectFilter, relatesToGeometry } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const point = GeoJsonGeometry.make({ geoJson: GeoPoint.make({ coordinates: [1, 2] }) })
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectFilter)(relatesToGeometry("region", point, "contains")))
 * wire // => { type: "geoShapeV2", field: "region", geometry: { type: "geoJson", geoJson: '{"type":"Point","coordinates":[1,2]}' }, spatialFilterMode: "CONTAINS" }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const relatesToGeometry: {
  (geometry: SearchGeometry, relation: SpatialRelation): (property: PropertyNameOrSelector) => RelatesToGeometry;
  (property: PropertyNameOrSelector, geometry: SearchGeometry, relation: SpatialRelation): RelatesToGeometry;
} = dual(
  3,
  (property: PropertyNameOrSelector, geometry: SearchGeometry, relation: SpatialRelation): RelatesToGeometry =>
    RelatesToGeometry.make({ property: toSelector(property), geometry, spatialFilterMode: relation })
);

// -----------------------------------------------------------------------------
// Logical combinators
// -----------------------------------------------------------------------------

// Tests of the tag alone. The union's `guards` validate the whole subtree, which a tree walk must
// not repeat at every node.
const isAnd = ObjectFilter.isAnyOf(["and"]);
const isOr = ObjectFilter.isAnyOf(["or"]);
const isNot = ObjectFilter.isAnyOf(["not"]);

/**
 * Filter for objects that satisfy every listed filter.
 *
 * **Example** (Require every filter of a list)
 *
 * ```ts import.meta.vitest name="Require every filter of a list"
 * import { eq, every, gt } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const filter = every([gt("age", 21), eq("office", "Seattle")])
 * const parts = [filter.type, filter.filters.length]
 * parts // => ["and", 2]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const every = (filters: ReadonlyArray<ObjectFilter>): And => And.make({ filters });

/**
 * Filter for objects that satisfy at least one of the listed filters.
 *
 * **Example** (Accept any filter of a list)
 *
 * ```ts import.meta.vitest name="Accept any filter of a list"
 * import { eq, some } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const filter = some([eq("office", "Seattle"), eq("office", "Boston")])
 * const parts = [filter.type, filter.filters.length]
 * parts // => ["or", 2]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const some = (filters: ReadonlyArray<ObjectFilter>): Or => Or.make({ filters });

/**
 * Filter for objects that satisfy both filters.
 *
 * **Details**
 *
 * When the first filter is already a conjunction the second is appended to it,
 * so a chain of `and` produces one flat `and` on the wire instead of a nest.
 *
 * **Example** (Chain conjunctions into one flat filter)
 *
 * ```ts import.meta.vitest name="Chain conjunctions into one flat filter"
 * import { pipe } from "effect/Function"
 * import { and, eq, gt, isNotNull } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const filter = pipe(gt("age", 21), and(eq("office", "Seattle")), and(isNotNull("manager")))
 * const parts = [filter.type, filter.filters.length]
 * parts // => ["and", 3]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const and: {
  (that: ObjectFilter): (self: ObjectFilter) => And;
  (self: ObjectFilter, that: ObjectFilter): And;
} = dual(
  2,
  (self: ObjectFilter, that: ObjectFilter): And =>
    And.make({ filters: isAnd(self) ? A.append(self.filters, that) : A.make(self, that) })
);

/**
 * Filter for objects that satisfy either filter.
 *
 * **Details**
 *
 * When the first filter is already a disjunction the second is appended to it,
 * so a chain of `or` produces one flat `or` on the wire instead of a nest.
 *
 * **Example** (Chain disjunctions into one flat filter)
 *
 * ```ts import.meta.vitest name="Chain disjunctions into one flat filter"
 * import { pipe } from "effect/Function"
 * import { eq, or } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const filter = pipe(eq("office", "Seattle"), or(eq("office", "Boston")), or(eq("office", "Austin")))
 * const parts = [filter.type, filter.filters.length]
 * parts // => ["or", 3]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const or: {
  (that: ObjectFilter): (self: ObjectFilter) => Or;
  (self: ObjectFilter, that: ObjectFilter): Or;
} = dual(
  2,
  (self: ObjectFilter, that: ObjectFilter): Or =>
    Or.make({ filters: isOr(self) ? A.append(self.filters, that) : A.make(self, that) })
);

/**
 * Filter for objects that do not satisfy a filter.
 *
 * **Example** (Negate a filter)
 *
 * ```ts import.meta.vitest name="Negate a filter"
 * import { isNull, not } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const filter = not(isNull("manager"))
 * const parts = [filter.type, filter.filter.type]
 * parts // => ["not", "isNull"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const not = (filter: ObjectFilter): Not => Not.make({ filter });

// -----------------------------------------------------------------------------
// Folding
// -----------------------------------------------------------------------------

/**
 * One function per shape of a filter tree, each producing a result from the results of its children.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface FilterAlgebra<Result> {
  readonly property: (filter: PropertyFilter) => Result;
  readonly and: (results: ReadonlyArray<Result>) => Result;
  readonly or: (results: ReadonlyArray<Result>) => Result;
  readonly not: (result: Result) => Result;
}

/**
 * Reduces a filter tree bottom-up: property tests become results and each combinator combines its children's results.
 *
 * **Details**
 *
 * The fold is total. A walker written with it handles every present and future
 * property operator through the one `property` case and cannot forget a
 * combinator.
 *
 * **Example** (Count the property tests of a filter)
 *
 * ```ts import.meta.vitest name="Count the property tests of a filter"
 * import * as A from "effect/Array"
 * import { identity } from "effect/Function"
 * import { eq, every, foldFilter, gt, ne } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const sum = (counts: ReadonlyArray<number>): number => A.reduce(counts, 0, (total, count) => total + count)
 * const tests = foldFilter(every([gt("age", 21), ne("office", "Boston"), eq("active", true)]), {
 *   property: () => 1,
 *   and: sum,
 *   or: sum,
 *   not: identity,
 * })
 * tests // => 3
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const foldFilter: {
  <Result>(algebra: FilterAlgebra<Result>): (filter: ObjectFilter) => Result;
  <Result>(filter: ObjectFilter, algebra: FilterAlgebra<Result>): Result;
} = dual(2, <Result>(filter: ObjectFilter, algebra: FilterAlgebra<Result>): Result => {
  const fold = (node: ObjectFilter): Result =>
    isAnd(node)
      ? algebra.and(A.map(node.filters, fold))
      : isOr(node)
        ? algebra.or(A.map(node.filters, fold))
        : isNot(node)
          ? algebra.not(fold(node.filter))
          : algebra.property(node);
  return fold(filter);
});

/**
 * Every property selector a filter tests, in the order the tests appear.
 *
 * **Example** (List the properties a filter depends on)
 *
 * ```ts import.meta.vitest name="List the properties a filter depends on"
 * import * as A from "effect/Array"
 * import { PropertySelector } from "@beep/scratchpad/osdk/src/Property/index"
 * import { eq, every, gt, ne, selectorsOf } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const name: (selector: PropertySelector) => string = PropertySelector.matchOrElse(
 *   { property: ({ apiName }) => apiName },
 *   () => "?"
 * )
 * const names = A.map(selectorsOf(every([gt("age", 21), ne("office", "Boston"), eq("age", 30)])), name)
 * names // => ["age", "office", "age"]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const selectorsOf: (filter: ObjectFilter) => ReadonlyArray<PropertySelector> = foldFilter<
  ReadonlyArray<PropertySelector>
>({
  property: (filter) => A.of(filter.property),
  and: A.flatten,
  or: A.flatten,
  not: identity,
});
