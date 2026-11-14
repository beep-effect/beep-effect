/**
 * A reference interpreter for filters, object sets, ordering, paging and aggregations over a `FauxWorld`.
 *
 * **Details**
 *
 * Every evaluator here is a total fold over a tagged union another concept
 * already defines: `foldFilter` over the 28 filter operators, `foldObjectSet`
 * over the 15 object set nodes, the matchers of `Aggregation` and `GroupBy`.
 * Nothing throws. A request the interpreter cannot answer fails with the
 * client's `ApiError`, the way the platform refuses a request, and its
 * `errorName` is one of `FauxErrorName`.
 *
 * Supported: comparison, equality, membership, null tests and array
 * containment. An operand is the wire scalar the filter carries; the
 * property's `operandCodec` reads it, the stored value is read by the
 * property's value codec, and the two are compared in that domain (numbers
 * numerically, 64-bit integers and decimals exactly, dates and instants
 * chronologically, text lexically). On an array property these operators test
 * the elements, as the operator table of the filter policy says: the test
 * holds when some element satisfies it. Also `and`, `or`, `not`; term and
 * phrase search over whitespace-separated, lower-cased terms; wildcards;
 * point-in-circle, point-in-rectangle and point-in-polygon tests; every object
 * set node that the stored objects and links can answer; ordering by
 * properties; offset paging; `count`, `sum`, `avg`, `min`, `max`, distinct
 * counts and percentiles with exact, fixed-width and range groupings.
 *
 * Refused with `FauxUnsupportedFeature`: the phonetic analyzer and fuzzy term
 * matching, regular expressions, interval rules, relative date ranges,
 * predicates between two shapes, struct field selectors, saved and method
 * input object sets, interface link traversal, nearest neighbors, derived
 * properties, ordering by relevance, duration groupings and default values of
 * exact groupings.
 *
 * This is an interpreter for tests and local development. It does not model
 * the platform's performance, its limits, its search-engine tokenisation or
 * its approximations: every aggregation here is exact.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { isLocalDate, Order as LocalDateOrder } from "@beep/schema/LocalDate";
import * as A from "effect/Array";
import * as BigDecimal from "effect/BigDecimal";
import * as Bool from "effect/Boolean";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equivalence from "effect/Equivalence";
import { dual, identity, pipe } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { metricKeyOf } from "../Aggregation/Aggregation.behavior.ts";
import {
  AggregateResponse,
  Aggregation,
  AggregationRow,
  GroupBy,
  GroupKey,
  MetricKey,
  MetricName,
  MetricResult,
} from "../Aggregation/Aggregation.model.ts";
import { ApiError } from "../Client/Client.errors.ts";
import { LoadObjectsResponse } from "../Client/Client.model.ts";
import { foldFilter } from "../Filter/Filter.behavior.ts";
import { PropertyFilter, SearchGeometry, SpatialRelation } from "../Filter/Filter.model.ts";
import { DistanceUnit, GeoPoint, Polygon, Position } from "../Geo/Geo.model.ts";
import { ErrorName, InterfaceTypeApiName, ObjectTypeApiName } from "../Identifier/Identifier.model.ts";
import { OrderedKind } from "../Model/Model.filter.ts";
import { ObjectLocator, OntologyObject } from "../Object/Object.model.ts";
import { foldObjectSet } from "../ObjectSet/ObjectSet.behavior.ts";
import { OrderBy } from "../ObjectSet/ObjectSet.model.ts";
import { getInterfaceType, getObjectType, getReverseLinkSide, implementers } from "../Ontology/Ontology.behavior.ts";
import { operandCodec, operandType, valueCodec } from "../Property/Property.behavior.ts";
import { PropertyByName, PropertySelector, PropertyType } from "../Property/Property.model.ts";
import { OffsetFromPageToken } from "./Faux.model.ts";
import type { ExactGrouping, FixedWidthGrouping, RangesGrouping } from "../Aggregation/Aggregation.model.ts";
import type { AggregateObjectSetRequest, LoadObjectsRequest } from "../Client/Client.model.ts";
import type { ObjectFilter, TextAnalyzer } from "../Filter/Filter.model.ts";
import type { EntityTypeApiName, LinkTypeApiName, PropertyApiName } from "../Identifier/Identifier.model.ts";
import type { ObjectRecord } from "../Object/Object.model.ts";
import type { ObjectSet, SortDirection } from "../ObjectSet/ObjectSet.model.ts";
import type { ObjectType } from "../ObjectType/ObjectType.model.ts";
import type { OntologyDefinition } from "../Ontology/Ontology.model.ts";
import type { PageSize, PageToken } from "../Page/Page.model.ts";
import type { ScalarValue } from "../Value/Value.model.ts";
import type { FauxErrorName, FauxWorld } from "./Faux.model.ts";

// -----------------------------------------------------------------------------
// Failures
// -----------------------------------------------------------------------------

type Evaluation<Value> = Effect.Effect<Value, ApiError>;

type Objects = ReadonlyArray<OntologyObject>;

const failure = (
  status: number,
  errorCode: string,
  errorName: FauxErrorName,
  description: string,
  parameters: Readonly<Record<string, S.Json>>
): ApiError =>
  ApiError.make({
    status,
    errorCode,
    errorName: ErrorName.make(errorName),
    errorInstanceId: "faux",
    errorDescription: O.some(description),
    parameters,
  });

const unsupported = (feature: string, reason: string): ApiError =>
  failure(400, "INVALID_ARGUMENT", "FauxUnsupportedFeature", reason, { feature });

const notFound = (
  errorName: FauxErrorName,
  description: string,
  parameters: Readonly<Record<string, S.Json>>
): ApiError => failure(404, "NOT_FOUND", errorName, description, parameters);

const invalid = (
  errorName: FauxErrorName,
  description: string,
  parameters: Readonly<Record<string, S.Json>>
): ApiError => failure(400, "INVALID_ARGUMENT", errorName, description, parameters);

const invalidWorld = (description: string, parameters: Readonly<Record<string, S.Json>>): ApiError =>
  failure(500, "INTERNAL", "FauxInvalidWorld", description, parameters);

// -----------------------------------------------------------------------------
// Reading a property of an object in the property's own domain
// -----------------------------------------------------------------------------

// One object under evaluation, with the type that says what its properties hold.
interface Subject {
  readonly objectType: ObjectType;
  readonly object: OntologyObject;
}

interface Declared {
  readonly name: PropertyApiName;
  readonly type: PropertyType;
}

// A property value that is present: as it is stored, and decoded by the codec of its property type.
interface Reading {
  readonly declared: Declared;
  readonly json: S.Json;
  readonly value: unknown;
}

const objectTypeOf = (ontology: OntologyDefinition, name: ObjectTypeApiName): Evaluation<ObjectType> =>
  O.match(getObjectType(ontology, name), {
    onNone: () =>
      Effect.fail(notFound("ObjectTypeNotFound", `Object type "${name}" is not defined`, { objectType: name })),
    onSome: (definition) => Effect.succeed(definition.objectType),
  });

const subjectOf = (world: FauxWorld, object: OntologyObject): Evaluation<Subject> =>
  Effect.map(objectTypeOf(world.ontology, object.locator.objectType), (objectType) => ({ objectType, object }));

const propertyNameOf = (objectType: ObjectType, selector: PropertySelector): Evaluation<PropertyApiName> =>
  PropertySelector.match(selector, {
    property: ({ apiName }): Evaluation<PropertyApiName> => Effect.succeed(apiName),
    structField: (): Evaluation<PropertyApiName> =>
      Effect.fail(unsupported("selector.structField", "Fields of struct properties cannot be addressed")),
    propertyWithLoadLevel: ({ selector: inner }): Evaluation<PropertyApiName> => propertyNameOf(objectType, inner),
    titleProperty: (): Evaluation<PropertyApiName> => Effect.succeed(objectType.titleProperty),
    primaryKeyProperty: (): Evaluation<PropertyApiName> => Effect.succeed(objectType.primaryKey),
  });

const declaredProperty = (objectType: ObjectType, selector: PropertySelector): Evaluation<Declared> =>
  Effect.flatMap(propertyNameOf(objectType, selector), (name) =>
    O.match(R.get(objectType.properties, name), {
      onNone: (): Evaluation<Declared> =>
        Effect.fail(
          notFound("PropertiesNotFound", `Object type "${objectType.apiName}" has no property "${name}"`, {
            objectType: objectType.apiName,
            properties: [name],
          })
        ),
      onSome: ({ dataType }): Evaluation<Declared> => Effect.succeed({ name, type: dataType }),
    })
  );

// Absent and null are the same thing: the property has no value.
const storedJson = (object: OntologyObject, name: PropertyApiName): O.Option<S.Json> =>
  O.filter(R.get(object.properties, name), P.isNotNull);

const readStored = (declared: Declared, object: OntologyObject): Evaluation<O.Option<Reading>> =>
  O.match(storedJson(object, declared.name), {
    onNone: (): Evaluation<O.Option<Reading>> => Effect.succeedNone,
    onSome: (json): Evaluation<O.Option<Reading>> =>
      Effect.mapBoth(S.decodeEffect(valueCodec(declared.type))(json), {
        onFailure: (cause) =>
          invalidWorld(
            `Property "${declared.name}" of an object of type "${object.locator.objectType}" does not hold a ${declared.type.type}: ${cause.message}`,
            { objectType: object.locator.objectType, property: declared.name }
          ),
        onSuccess: (value) => O.some({ declared, json, value }),
      }),
  });

const readIn = (world: FauxWorld, object: OntologyObject, selector: PropertySelector): Evaluation<O.Option<Reading>> =>
  Effect.flatMap(subjectOf(world, object), ({ objectType }) =>
    Effect.flatMap(declaredProperty(objectType, selector), (declared) => readStored(declared, object))
  );

// An operator applied to an array property tests the elements of the array, at any depth: the values
// of the property's operand type. Any other property is tested as the one value it holds.
const testedValues = (type: PropertyType, value: unknown): ReadonlyArray<unknown> =>
  PropertyType.guards.array(type) && P.isIterable(value)
    ? A.flatMap(A.fromIterable(value), (element) => testedValues(type.elementType, element))
    : A.of(value);

// An operand is the wire scalar a filter or a range carries. The property's operand codec reads it as
// a value of the operand type, so that it is compared in the same domain as the stored values.
const decodeOperand = (declared: Declared, operand: ScalarValue, errorName: FauxErrorName): Evaluation<unknown> =>
  Effect.mapError(S.decodeEffect(operandCodec(declared.type))(operand), (cause) =>
    invalid(errorName, `The operand is not a ${operandType(declared.type).type} value: ${cause.message}`, {
      property: declared.name,
    })
  );

// -----------------------------------------------------------------------------
// Order and equality of decoded values
// -----------------------------------------------------------------------------

// The order of two values of one domain. None when the domain has no order, or the domains differ.
const compareValues = (left: unknown, right: unknown): O.Option<number> =>
  P.isNumber(left) && P.isNumber(right)
    ? O.some(Order.Number(left, right))
    : P.isBigInt(left) && P.isBigInt(right)
      ? O.some(Order.BigInt(left, right))
      : BigDecimal.isBigDecimal(left) && BigDecimal.isBigDecimal(right)
        ? O.some(BigDecimal.Order(left, right))
        : DateTime.isDateTime(left) && DateTime.isDateTime(right)
          ? O.some(DateTime.Order(left, right))
          : isLocalDate(left) && isLocalDate(right)
            ? O.some(LocalDateOrder(left, right))
            : P.isString(left) && P.isString(right)
              ? O.some(Order.String(left, right))
              : P.isBoolean(left) && P.isBoolean(right)
                ? O.some(Order.Boolean(left, right))
                : O.none();

const isOrderedKind = S.is(OrderedKind);

const notOrdered = (operation: string, declared: Declared, errorName: FauxErrorName): ApiError =>
  invalid(errorName, `${operation} needs an ordered property, and "${declared.name}" is a ${declared.type.type}`, {
    property: declared.name,
    propertyType: declared.type.type,
  });

const numberOf = (value: unknown): O.Option<number> =>
  P.isNumber(value)
    ? O.some(value)
    : P.isBigInt(value)
      ? pipe(BigDecimal.fromBigInt(value), BigDecimal.toNumberUnsafe, O.some)
      : BigDecimal.isBigDecimal(value)
        ? pipe(value, BigDecimal.toNumberUnsafe, O.some)
        : O.none();

// -----------------------------------------------------------------------------
// Property tests: comparison, membership, presence
// -----------------------------------------------------------------------------

interface Comparison {
  readonly type: string;
  readonly property: PropertySelector;
  readonly value: ScalarValue;
}

const compare = Effect.fnUntraced(function* (
  subject: Subject,
  filter: Comparison,
  holds: (ordering: number) => boolean
) {
  const declared = yield* declaredProperty(subject.objectType, filter.property);
  if (!isOrderedKind(operandType(declared.type).type)) {
    return yield* notOrdered(`The "${filter.type}" filter`, declared, "PropertyFiltersNotSupported");
  }
  const operand = yield* decodeOperand(declared, filter.value, "InvalidPropertyFilterValue");
  const stored = yield* readStored(declared, subject.object);
  return O.exists(stored, ({ value }) =>
    A.some(testedValues(declared.type, value), (held) => O.exists(compareValues(held, operand), holds))
  );
});

// Equality is the equivalence of the operand type's own value codec, so "1000.50" and "1000.5" are one decimal.
const equalsAny = Effect.fnUntraced(function* (
  subject: Subject,
  property: PropertySelector,
  operands: ReadonlyArray<ScalarValue>
) {
  const declared = yield* declaredProperty(subject.objectType, property);
  const candidates = yield* Effect.forEach(operands, (operand) =>
    decodeOperand(declared, operand, "InvalidPropertyFilterValue")
  );
  const stored = yield* readStored(declared, subject.object);
  const same = S.toEquivalence(valueCodec(operandType(declared.type)));
  return O.exists(stored, ({ value }) =>
    A.some(testedValues(declared.type, value), (held) => A.some(candidates, (candidate) => same(held, candidate)))
  );
});

// Containment is equality with one element, and only an array has elements.
const containsElement = Effect.fnUntraced(function* (
  subject: Subject,
  property: PropertySelector,
  operand: ScalarValue
) {
  const declared = yield* declaredProperty(subject.objectType, property);
  if (!PropertyType.guards.array(declared.type)) {
    return yield* invalid(
      "PropertyFiltersNotSupported",
      `The "contains" filter needs an array property, and "${declared.name}" is a ${declared.type.type}`,
      { property: declared.name, propertyType: declared.type.type }
    );
  }
  return yield* equalsAny(subject, property, A.of(operand));
});

const hasNoValue = (subject: Subject, property: PropertySelector): Evaluation<boolean> =>
  Effect.map(declaredProperty(subject.objectType, property), ({ name }) => O.isNone(storedJson(subject.object, name)));

// -----------------------------------------------------------------------------
// Property tests: text
// -----------------------------------------------------------------------------

// The whole of this interpreter's text analysis: lower-case, then split on whitespace.
const termsOf = (text: string): ReadonlyArray<string> =>
  A.filter(Str.split(Str.toLowerCase(text), /\s+/), Str.isNonEmpty);

const textOf = Effect.fnUntraced(function* (subject: Subject, operator: string, property: PropertySelector) {
  const declared = yield* declaredProperty(subject.objectType, property);
  if (declared.type.type !== "string") {
    return yield* invalid(
      "PropertyFiltersNotSupported",
      `The "${operator}" filter needs a string property, and "${declared.name}" is a ${declared.type.type}`,
      { property: declared.name, propertyType: declared.type.type }
    );
  }
  const stored = yield* readStored(declared, subject.object);
  return O.filter(
    O.map(stored, ({ value }) => value),
    P.isString
  );
});

const requirePlainTerms = (
  operator: string,
  analyzer: O.Option<TextAnalyzer>,
  fuzzy: O.Option<boolean>
): Evaluation<void> =>
  O.exists(analyzer, (selected) => selected === "phoneticAnalyzer")
    ? Effect.fail(unsupported(`filter.${operator}.phonetic`, "The phonetic analyzer is not modelled"))
    : O.exists(fuzzy, identity)
      ? Effect.fail(unsupported(`filter.${operator}.fuzzy`, "Fuzzy term matching is not modelled"))
      : Effect.void;

// Whether the terms occur next to each other and in order; the last one may be only the start of a term.
const holdsPhrase = (held: ReadonlyArray<string>, phrase: ReadonlyArray<string>, prefixLast: boolean): boolean =>
  A.isReadonlyArrayEmpty(phrase) ||
  (held.length >= phrase.length &&
    A.some(A.makeBy(held.length - phrase.length + 1, identity), (start) =>
      A.every(phrase, (term, index) =>
        O.exists(A.get(held, start + index), (candidate) =>
          prefixLast && index === phrase.length - 1 ? Str.startsWith(term)(candidate) : candidate === term
        )
      )
    ));

interface TermSearch {
  readonly type: string;
  readonly property: PropertySelector;
  readonly value: string;
  readonly analyzerSelection: O.Option<TextAnalyzer>;
}

const searchTerms = Effect.fnUntraced(function* (
  subject: Subject,
  filter: TermSearch,
  fuzzy: O.Option<boolean>,
  holds: (held: ReadonlyArray<string>, sought: ReadonlyArray<string>) => boolean
) {
  yield* requirePlainTerms(filter.type, filter.analyzerSelection, fuzzy);
  const text = yield* textOf(subject, filter.type, filter.property);
  const sought = termsOf(filter.value);
  return O.exists(text, (present) => holds(termsOf(present), sought));
});

const escapePattern = Str.replaceAll(/[\\^$.*+?()[\]{}|]/g, "\\$&");

// `*` stands for any run of characters and `?` for exactly one; the pattern covers the whole text.
const wildcardPattern = (pattern: string): RegExp =>
  new RegExp(
    `^${pipe(
      Str.split(pattern, ""),
      A.map((character) => (character === "*" ? ".*" : character === "?" ? "." : escapePattern(character))),
      A.join("")
    )}$`,
    "is"
  );

const matchesWildcard = (subject: Subject, property: PropertySelector, pattern: string): Evaluation<boolean> =>
  Effect.map(
    textOf(subject, "wildcard", property),
    O.exists((text) => O.isSome(Str.match(wildcardPattern(pattern))(text)))
  );

// -----------------------------------------------------------------------------
// Property tests: points on the globe
// -----------------------------------------------------------------------------

interface Corners {
  readonly topLeft: { readonly coordinates: Position };
  readonly bottomRight: { readonly coordinates: Position };
}

interface Rings {
  readonly coordinates: ReadonlyArray<ReadonlyArray<Position>>;
}

const earthRadiusMeters = 6_371_008.8;

const metersPerUnit = DistanceUnit.To.match({
  millimeters: () => 0.001,
  centimeters: () => 0.01,
  meters: () => 1,
  kilometers: () => 1000,
  inches: () => 0.0254,
  feet: () => 0.3048,
  yards: () => 0.9144,
  miles: () => 1609.344,
  nauticalMiles: () => 1852,
});

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

// Great-circle distance on a sphere of the earth's mean radius (the haversine formula).
const greatCircleMeters = (from: Position, to: Position): number => {
  const fromLatitude = radians(Position.latitude(from));
  const toLatitude = radians(Position.latitude(to));
  const halfLatitude = (toLatitude - fromLatitude) / 2;
  const halfLongitude = radians(Position.longitude(to) - Position.longitude(from)) / 2;
  const chord =
    Math.sin(halfLatitude) ** 2 + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(halfLongitude) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(chord)));
};

// A rectangle whose west edge lies east of its east edge crosses the antimeridian.
const insideBox =
  (corners: Corners) =>
  (position: Position): boolean => {
    const west = Position.longitude(corners.topLeft.coordinates);
    const east = Position.longitude(corners.bottomRight.coordinates);
    const longitude = Position.longitude(position);
    const latitude = Position.latitude(position);
    return (
      latitude <= Position.latitude(corners.topLeft.coordinates) &&
      latitude >= Position.latitude(corners.bottomRight.coordinates) &&
      (west <= east ? longitude >= west && longitude <= east : longitude >= west || longitude <= east)
    );
  };

// Ray casting on the plane of longitude and latitude: a point is inside when a ray from it crosses the ring an odd number of times.
const insideRing = (ring: ReadonlyArray<Position>, position: Position): boolean => {
  const longitude = Position.longitude(position);
  const latitude = Position.latitude(position);
  const crossings = A.filter(A.zip(ring, A.drop(ring, 1)), ([from, to]) => {
    const fromLatitude = Position.latitude(from);
    const toLatitude = Position.latitude(to);
    return (
      fromLatitude > latitude !== toLatitude > latitude &&
      longitude <
        ((Position.longitude(to) - Position.longitude(from)) * (latitude - fromLatitude)) /
          (toLatitude - fromLatitude) +
          Position.longitude(from)
    );
  });
  return crossings.length % 2 === 1;
};

const insidePolygon =
  (polygon: Rings) =>
  (position: Position): boolean =>
    A.matchLeft(polygon.coordinates, {
      onEmpty: () => false,
      onNonEmpty: (exterior, holes) =>
        insideRing(exterior, position) && !A.some(holes, (hole) => insideRing(hole, position)),
    });

const isPoint = S.is(GeoPoint);
const isPolygon = S.is(Polygon);

// The position of a geospatial property. Only points are modelled: any other stored shape is refused.
const pointOf = Effect.fnUntraced(function* (subject: Subject, operator: string, property: PropertySelector) {
  const declared = yield* declaredProperty(subject.objectType, property);
  if (declared.type.type !== "geopoint" && declared.type.type !== "geoshape") {
    return yield* invalid(
      "PropertyFiltersNotSupported",
      `The "${operator}" filter needs a geospatial property, and "${declared.name}" is a ${declared.type.type}`,
      { property: declared.name, propertyType: declared.type.type }
    );
  }
  const stored = yield* readStored(declared, subject.object);
  return yield* O.match(stored, {
    onNone: (): Evaluation<O.Option<Position>> => Effect.succeedNone,
    onSome: ({ value }): Evaluation<O.Option<Position>> =>
      isPoint(value)
        ? Effect.succeedSome(value.coordinates)
        : Effect.fail(
            unsupported(`filter.${operator}.shape`, "Predicates between two shapes are not modelled: only points are")
          ),
  });
});

const pointSatisfies = (
  subject: Subject,
  operator: string,
  property: PropertySelector,
  holds: (position: Position) => boolean
): Evaluation<boolean> => Effect.map(pointOf(subject, operator, property), O.exists(holds));

const regionOf = (geometry: SearchGeometry): Evaluation<(position: Position) => boolean> =>
  SearchGeometry.match(geometry, {
    envelope: (envelope): Evaluation<(position: Position) => boolean> => Effect.succeed(insideBox(envelope)),
    geoJson: ({ geoJson }): Evaluation<(position: Position) => boolean> =>
      isPolygon(geoJson)
        ? Effect.succeed(insidePolygon(geoJson))
        : Effect.fail(
            unsupported("filter.geoShapeV2.geometry", "Only envelopes and polygons are modelled as search geometries")
          ),
  });

// For a point, lying within a region and intersecting it are the same thing. A point contains no region.
const relationOf: (relation: SpatialRelation) => O.Option<(inside: boolean) => boolean> = SpatialRelation.To.match({
  intersects: () => O.some(identity<boolean>),
  disjoint: () => O.some(Bool.not),
  within: () => O.some(identity<boolean>),
  contains: () => O.none(),
});

const relatesTo = (
  subject: Subject,
  property: PropertySelector,
  geometry: SearchGeometry,
  relation: SpatialRelation
): Evaluation<boolean> =>
  O.match(relationOf(relation), {
    onNone: (): Evaluation<boolean> =>
      Effect.fail(unsupported("filter.geoShapeV2.contains", "A property that contains a geometry is not modelled")),
    onSome: (holds): Evaluation<boolean> =>
      Effect.flatMap(regionOf(geometry), (inside) =>
        pointSatisfies(subject, "geoShapeV2", property, (position) => holds(inside(position)))
      ),
  });

// -----------------------------------------------------------------------------
// Filters
// -----------------------------------------------------------------------------

const refuse = (feature: string, reason: string) => (): Evaluation<boolean> =>
  Effect.fail(unsupported(feature, reason));

const evaluateProperty = (subject: Subject): ((filter: PropertyFilter) => Evaluation<boolean>) =>
  PropertyFilter.match({
    lt: (filter) => compare(subject, filter, (ordering) => ordering < 0),
    gt: (filter) => compare(subject, filter, (ordering) => ordering > 0),
    lte: (filter) => compare(subject, filter, (ordering) => ordering <= 0),
    gte: (filter) => compare(subject, filter, (ordering) => ordering >= 0),
    eq: ({ property, value }) => equalsAny(subject, property, A.of(value)),
    // An empty list matches every object, not none.
    in: ({ property, value }) =>
      A.isReadonlyArrayEmpty(value)
        ? Effect.as(declaredProperty(subject.objectType, property), true)
        : equalsAny(subject, property, value),
    isNull: ({ property, value }) => Effect.map(hasNoValue(subject, property), (absent) => absent === value),
    contains: ({ property, value }) => containsElement(subject, property, value),
    startsWith: (filter) => searchTerms(subject, filter, O.none(), (held, sought) => holdsPhrase(held, sought, true)),
    wildcard: ({ property, value }) => matchesWildcard(subject, property, value),
    regex: refuse("filter.regex", "Regular expressions run in the platform's search dialect, which is not modelled"),
    containsAnyTerm: (filter) =>
      searchTerms(subject, filter, filter.fuzzy, (held, sought) => A.some(sought, (term) => A.contains(held, term))),
    containsAllTerms: (filter) =>
      searchTerms(subject, filter, filter.fuzzy, (held, sought) => A.every(sought, (term) => A.contains(held, term))),
    containsAllTermsInOrder: (filter) =>
      searchTerms(subject, filter, O.none(), (held, sought) => holdsPhrase(held, sought, false)),
    containsAllTermsInOrderPrefixLastTerm: (filter) =>
      searchTerms(subject, filter, O.none(), (held, sought) => holdsPhrase(held, sought, true)),
    interval: refuse("filter.interval", "Interval rules need the positions a search index assigns to terms"),
    relativeDateRange: refuse("filter.relativeDateRange", "Ranges relative to the wall clock are not modelled"),
    withinDistanceOf: ({ property, value }) =>
      pointSatisfies(
        subject,
        "withinDistanceOf",
        property,
        (position) =>
          greatCircleMeters(value.center.coordinates, position) <=
          value.distance.value * metersPerUnit(value.distance.unit)
      ),
    withinBoundingBox: ({ property, value }) =>
      pointSatisfies(subject, "withinBoundingBox", property, insideBox(value)),
    withinPolygon: ({ property, value }) => pointSatisfies(subject, "withinPolygon", property, insidePolygon(value)),
    intersectsBoundingBox: ({ property, value }) =>
      pointSatisfies(subject, "intersectsBoundingBox", property, insideBox(value)),
    intersectsPolygon: ({ property, value }) =>
      pointSatisfies(subject, "intersectsPolygon", property, insidePolygon(value)),
    doesNotIntersectBoundingBox: ({ property, value }) =>
      pointSatisfies(subject, "doesNotIntersectBoundingBox", property, (position) => !insideBox(value)(position)),
    doesNotIntersectPolygon: ({ property, value }) =>
      pointSatisfies(subject, "doesNotIntersectPolygon", property, (position) => !insidePolygon(value)(position)),
    geoShapeV2: ({ property, geometry, spatialFilterMode }) =>
      relatesTo(subject, property, geometry, spatialFilterMode),
  });

const matchesFilterImpl = (object: OntologyObject, objectType: ObjectType, filter: ObjectFilter): Evaluation<boolean> =>
  foldFilter<Evaluation<boolean>>(filter, {
    property: evaluateProperty({ objectType, object }),
    and: (verdicts) => Effect.map(Effect.all(verdicts), (all) => A.every(all, identity)),
    or: (verdicts) => Effect.map(Effect.all(verdicts), (all) => A.some(all, identity)),
    not: Effect.map(Bool.not),
  });

/**
 * Whether one object satisfies a filter, read against the object type that declares its properties.
 *
 * **Details**
 *
 * The fold is total over the 28 operators. Every operand is decoded by the
 * value codec of the property it is compared with, and so is the stored
 * value, which makes `"2021-03-04"` a date for a date property and a string
 * for a string property. A property without a value satisfies only `isNull`,
 * and `not` of anything it does not satisfy. An empty `in` list and an empty
 * `and` match every object; an empty `or` matches none.
 *
 * Text search lower-cases both sides and splits them on whitespace:
 * `containsAnyTerm` and `containsAllTerms` look for whole terms,
 * `containsAllTermsInOrder` for the terms next to each other, and
 * `containsAllTermsInOrderPrefixLastTerm` (with its alias `startsWith`) lets
 * the last term be only the start of one. `wildcard` matches the whole text
 * without regard to case, `*` for any run of characters and `?` for one.
 *
 * Geospatial tests read points. `withinDistanceOf` measures the great-circle
 * distance; the rectangle and polygon tests work on longitude and latitude as
 * a plane, a polygon by ray casting with holes cut out. For a point,
 * `intersects` equals `within` and `doesNotIntersect` is its negation.
 *
 * **Gotchas**
 *
 * Every branch of `and` and `or` is evaluated, so a refused operator fails the
 * whole filter even when another branch already decides it.
 *
 * **Example** (Test offices against a capacity filter)
 *
 * ```ts import.meta.vitest name="Test offices against a capacity filter"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { FauxWorld, matchesFilter } from "@beep/scratchpad/osdk/src/Faux/index"
 * import { every, gt, isNotNull } from "@beep/scratchpad/osdk/src/Filter/index"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { getObjectType } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const world = await Effect.runPromise(
 *   S.decodeUnknownEffect(FauxWorld)({
 *     ontology: {
 *       ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *       objectTypes: {
 *         Office: {
 *           objectType: {
 *             apiName: "Office",
 *             displayName: "Office",
 *             pluralDisplayName: "Offices",
 *             icon: { type: "blueprint", color: "blue", name: "office" },
 *             primaryKey: "officeId",
 *             titleProperty: "officeId",
 *             properties: {
 *               officeId: { dataType: { type: "string" }, rid: "ri.property.officeId" },
 *               capacity: { dataType: { type: "integer" }, rid: "ri.property.capacity" },
 *             },
 *             rid: "ri.ontology.main.object-type.office",
 *             status: "ACTIVE",
 *           },
 *           linkTypes: [],
 *           implementsInterfaces: [],
 *           implementsInterfaces2: {},
 *           sharedPropertyTypeMapping: {},
 *         },
 *       },
 *       actionTypes: {},
 *       queryTypes: {},
 *       interfaceTypes: {},
 *       sharedPropertyTypes: {},
 *       valueTypes: {},
 *     },
 *     objects: [
 *       { __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 120 },
 *       { __apiName: "Office", __primaryKey: "LDN", officeId: "LDN", capacity: 80 },
 *       { __apiName: "Office", __primaryKey: "SFO", officeId: "SFO" },
 *     ],
 *   })
 * )
 * const office = O.getOrThrow(getObjectType(world.ontology, ObjectTypeApiName.make("Office"))).objectType
 * const isLarge = matchesFilter(office, every([isNotNull("capacity"), gt("capacity", 100)]))
 * const verdicts = await Effect.runPromise(Effect.forEach(world.objects, isLarge))
 * verdicts // => [true, false, false]
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const matchesFilter: {
  (objectType: ObjectType, filter: ObjectFilter): (object: OntologyObject) => Effect.Effect<boolean, ApiError>;
  (object: OntologyObject, objectType: ObjectType, filter: ObjectFilter): Effect.Effect<boolean, ApiError>;
} = dual(3, matchesFilterImpl);

// -----------------------------------------------------------------------------
// Object sets
// -----------------------------------------------------------------------------

const sameLocator = S.toEquivalence(ObjectLocator);

const sameObject = Equivalence.mapInput(sameLocator, (object: OntologyObject) => object.locator);

const keep = <Item>(
  items: ReadonlyArray<Item>,
  holds: (item: Item) => Evaluation<boolean>
): Evaluation<ReadonlyArray<Item>> =>
  Effect.map(
    Effect.forEach(items, (item) => Effect.map(holds(item), (kept) => (kept ? O.some(item) : O.none()))),
    (kept) => A.getSomes(kept)
  );

const ofTypes = (world: FauxWorld, types: ReadonlyArray<ObjectTypeApiName>): Objects =>
  A.filter(world.objects, (object) => A.contains(types, object.locator.objectType));

// The objects a link side leads to from one object: forwards along the stored links of that side, and
// backwards along the stored links of the side the ontology pairs it with.
const linkedFrom = (world: FauxWorld, from: ObjectLocator, link: LinkTypeApiName): ReadonlyArray<ObjectLocator> =>
  A.flatMap(world.links, (stored) =>
    stored.linkType === link && sameLocator(stored.source, from)
      ? A.of(stored.target)
      : sameLocator(stored.target, from) &&
          O.exists(
            getReverseLinkSide(world.ontology, stored.source.objectType, stored.linkType),
            (reverse) => reverse.apiName === link
          )
        ? A.of(stored.source)
        : A.empty<ObjectLocator>()
  );

const definesLink = (ontology: OntologyDefinition, link: LinkTypeApiName): boolean =>
  A.some(R.values(ontology.objectTypes), (definition) => A.some(definition.linkTypes, (side) => side.apiName === link));

const decodeObjectTypeName = S.decodeOption(ObjectTypeApiName);
const decodeInterfaceTypeName = S.decodeOption(InterfaceTypeApiName);

// The concrete object types an entity type name stands for: itself, or the implementers of the interface.
const typesNamed = (
  ontology: OntologyDefinition,
  entityType: EntityTypeApiName
): Evaluation<ReadonlyArray<ObjectTypeApiName>> =>
  pipe(
    decodeObjectTypeName(entityType),
    O.filter((name) => O.isSome(getObjectType(ontology, name))),
    O.map((name): ReadonlyArray<ObjectTypeApiName> => A.of(name)),
    O.orElse(() =>
      pipe(
        decodeInterfaceTypeName(entityType),
        O.filter((name) => O.isSome(getInterfaceType(ontology, name))),
        O.map((name) => implementers(ontology, name))
      )
    ),
    Effect.fromOption,
    Effect.mapError(() =>
      notFound("ObjectTypeNotFound", `"${entityType}" names neither an object type nor an interface type`, {
        entityType,
      })
    )
  );

const refuseSet = (feature: string, reason: string) => (): Evaluation<Objects> =>
  Effect.fail(unsupported(feature, reason));

const evaluateObjectSetImpl = (world: FauxWorld, objectSet: ObjectSet): Evaluation<Objects> =>
  foldObjectSet<Evaluation<Objects>>(objectSet, {
    base: ({ objectType }) => Effect.as(objectTypeOf(world.ontology, objectType), ofTypes(world, A.of(objectType))),
    interfaceBase: ({ interfaceType }) =>
      O.match(getInterfaceType(world.ontology, interfaceType), {
        onNone: () =>
          Effect.fail(
            notFound("InterfaceTypeNotFound", `Interface type "${interfaceType}" is not defined`, { interfaceType })
          ),
        onSome: () => Effect.succeed(ofTypes(world, implementers(world.ontology, interfaceType))),
      }),
    static: ({ objects }) =>
      Effect.succeed(A.filter(world.objects, (object) => O.exists(object.rid, (rid) => A.contains(objects, rid)))),
    reference: refuseSet("objectSet.reference", "Saved object sets are not modelled"),
    methodInput: refuseSet("objectSet.methodInput", "There is no object a method input could stand for"),
    filter: (source, { where }) =>
      Effect.flatMap(source, (objects) =>
        keep(objects, (object) =>
          Effect.flatMap(subjectOf(world, object), ({ objectType }) => matchesFilterImpl(object, objectType, where))
        )
      ),
    searchAround: (source, { link }) =>
      definesLink(world.ontology, link)
        ? Effect.map(source, (objects) => {
            const reached = A.flatMap(objects, (object) => linkedFrom(world, object.locator, link));
            return A.filter(world.objects, (object) => A.containsWith(sameLocator)(reached, object.locator));
          })
        : Effect.fail(notFound("LinkTypeNotFound", `No object type has a link "${link}"`, { linkType: link })),
    interfaceLinkSearchAround: refuseSet("objectSet.interfaceLinkSearchAround", "Interface links are not modelled"),
    asType: (source, { entityType }) =>
      Effect.flatMap(typesNamed(world.ontology, entityType), (types) =>
        Effect.map(source, (objects) => A.filter(objects, (object) => A.contains(types, object.locator.objectType)))
      ),
    // Stored objects are rows of concrete object types already.
    asBaseObjectTypes: identity,
    nearestNeighbors: refuseSet("objectSet.nearestNeighbors", "Vector search is not modelled"),
    withProperties: (source, { derivedProperties }) =>
      R.isEmptyRecord(derivedProperties)
        ? source
        : Effect.fail(unsupported("objectSet.withProperties", "Derived properties are not computed")),
    // Every result keeps the order of the world, so set arithmetic answers in that order too.
    union: (operands) =>
      Effect.map(Effect.all(operands), (sets) => {
        const pooled = A.flatten(sets);
        return A.filter(world.objects, (object) => A.containsWith(sameObject)(pooled, object));
      }),
    intersect: (operands) =>
      Effect.map(
        Effect.all(operands),
        A.matchLeft({
          onEmpty: A.empty<OntologyObject>,
          onNonEmpty: (first, rest) =>
            A.reduce(rest, first, (kept, next) => A.intersectionWith(sameObject)(kept, next)),
        })
      ),
    subtract: (operands) =>
      Effect.map(
        Effect.all(operands),
        A.matchLeft({
          onEmpty: A.empty<OntologyObject>,
          onNonEmpty: (first, rest) => A.reduce(rest, first, (kept, next) => A.differenceWith(sameObject)(kept, next)),
        })
      ),
  });

/**
 * The objects of a world that an object set describes, in the order the world holds them.
 *
 * **Details**
 *
 * The fold is total over the 15 nodes. `base` and `interfaceBase` read the
 * stored objects by type (an interface through the ontology's implementers),
 * `static` by resource identifier, `filter` through {@link matchesFilter},
 * `searchAround` through the stored links in both directions, `asType` by
 * narrowing to an object type or to the implementers of an interface, and
 * `union`, `intersect` and `subtract` by object identity: object type plus
 * primary key. `asBaseObjectTypes` and a `withProperties` node that derives
 * nothing change nothing.
 *
 * `reference`, `methodInput`, `interfaceLinkSearchAround`, `nearestNeighbors`
 * and a `withProperties` node that derives something are refused.
 *
 * **Example** (Evaluate a filtered object set)
 *
 * ```ts import.meta.vitest name="Evaluate a filtered object set"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { evaluateObjectSet, FauxWorld } from "@beep/scratchpad/osdk/src/Faux/index"
 * import { lt } from "@beep/scratchpad/osdk/src/Filter/index"
 * import { objectType, where } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const world = await Effect.runPromise(
 *   S.decodeUnknownEffect(FauxWorld)({
 *     ontology: {
 *       ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *       objectTypes: {
 *         Office: {
 *           objectType: {
 *             apiName: "Office",
 *             displayName: "Office",
 *             pluralDisplayName: "Offices",
 *             icon: { type: "blueprint", color: "blue", name: "office" },
 *             primaryKey: "officeId",
 *             titleProperty: "officeId",
 *             properties: {
 *               officeId: { dataType: { type: "string" }, rid: "ri.property.officeId" },
 *               capacity: { dataType: { type: "integer" }, rid: "ri.property.capacity" },
 *             },
 *             rid: "ri.ontology.main.object-type.office",
 *             status: "ACTIVE",
 *           },
 *           linkTypes: [],
 *           implementsInterfaces: [],
 *           implementsInterfaces2: {},
 *           sharedPropertyTypeMapping: {},
 *         },
 *       },
 *       actionTypes: {},
 *       queryTypes: {},
 *       interfaceTypes: {},
 *       sharedPropertyTypes: {},
 *       valueTypes: {},
 *     },
 *     objects: [
 *       { __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 120 },
 *       { __apiName: "Office", __primaryKey: "LDN", officeId: "LDN", capacity: 80 },
 *     ],
 *   })
 * )
 * const small = await Effect.runPromise(evaluateObjectSet(world, where(objectType("Office"), lt("capacity", 100))))
 * const keys = A.map(small, (office) => office.locator.primaryKey)
 * keys // => ["LDN"]
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const evaluateObjectSet: {
  (objectSet: ObjectSet): (world: FauxWorld) => Effect.Effect<ReadonlyArray<OntologyObject>, ApiError>;
  (world: FauxWorld, objectSet: ObjectSet): Effect.Effect<ReadonlyArray<OntologyObject>, ApiError>;
} = dual(2, evaluateObjectSetImpl);

// -----------------------------------------------------------------------------
// Ordering and paging
// -----------------------------------------------------------------------------

interface Sortable {
  readonly object: OntologyObject;
  readonly keys: ReadonlyArray<O.Option<unknown>>;
}

interface SortField {
  readonly property: PropertyApiName;
  readonly direction: O.Option<SortDirection>;
}

const sortKeyOf = Effect.fnUntraced(function* (world: FauxWorld, object: OntologyObject, property: PropertyApiName) {
  const { objectType } = yield* subjectOf(world, object);
  const declared = yield* declaredProperty(objectType, PropertyByName.make({ apiName: property }));
  if (!isOrderedKind(declared.type.type)) {
    return yield* notOrdered("Ordering", declared, "PropertyBaseTypeNotSupported");
  }
  const stored = yield* readStored(declared, object);
  return O.map(stored, ({ value }) => value);
});

// Objects without a value sort last in both directions.
const compareKeys = (mine: O.Option<unknown>, theirs: O.Option<unknown>, descending: boolean): number =>
  pipe(
    O.zipWith(mine, theirs, (left, right) => {
      const ordering = O.getOrElse(compareValues(left, right), () => 0);
      return descending ? -ordering : ordering;
    }),
    O.getOrElse(() => (O.isSome(mine) ? -1 : O.isSome(theirs) ? 1 : 0))
  );

const bySortKeys = (fields: ReadonlyArray<SortField>): Order.Order<Sortable> =>
  Order.make((mine, theirs) =>
    Order.Number(
      A.reduce(A.zip(A.zip(mine.keys, theirs.keys), fields), 0, (decided, [[left, right], field]) =>
        decided === 0
          ? compareKeys(
              left,
              right,
              O.exists(field.direction, (direction) => direction === "desc")
            )
          : decided
      ),
      0
    )
  );

const sortByFields = (world: FauxWorld, objects: Objects, fields: ReadonlyArray<SortField>): Evaluation<Objects> =>
  Effect.map(
    Effect.forEach(objects, (object) =>
      Effect.map(
        Effect.forEach(fields, (field) => sortKeyOf(world, object, field.property)),
        (keys): Sortable => ({ object, keys })
      )
    ),
    (sortables) => A.map(A.sort(sortables, bySortKeys(fields)), ({ object }) => object)
  );

const orderObjects = (world: FauxWorld, objects: Objects, orderBy: O.Option<OrderBy>): Evaluation<Objects> =>
  O.match(orderBy, {
    onNone: (): Evaluation<Objects> => Effect.succeed(objects),
    onSome: OrderBy.match({
      relevance: (): Evaluation<Objects> =>
        Effect.fail(unsupported("orderBy.relevance", "Relevance scores are not computed")),
      fields: ({ fields }): Evaluation<Objects> => sortByFields(world, objects, fields),
    }),
  });

const defaultPageSize = 1000;

const decodeOffset = S.decodeEffect(OffsetFromPageToken);
const encodeOffset = S.encodeEffect(OffsetFromPageToken);

const pageOf = Effect.fnUntraced(function* (
  objects: Objects,
  pageSize: O.Option<PageSize>,
  pageToken: O.Option<PageToken>
) {
  const offset = yield* O.match(pageToken, {
    onNone: (): Evaluation<number> => Effect.succeed(0),
    onSome: (token): Evaluation<number> =>
      Effect.mapError(decodeOffset(token), (cause) => invalid("InvalidPageToken", cause.message, { pageToken: token })),
  });
  const end = offset + O.getOrElse(pageSize, () => defaultPageSize);
  const nextPageToken = yield* end < objects.length
    ? Effect.mapBoth(encodeOffset(end), {
        onFailure: (cause) => invalid("InvalidPageToken", cause.message, { offset: end }),
        onSuccess: O.some,
      })
    : Effect.succeedNone;
  return { data: A.take(A.drop(objects, offset), end - offset), nextPageToken };
});

const project = Effect.fnUntraced(function* (world: FauxWorld, object: OntologyObject, request: LoadObjectsRequest) {
  const { objectType } = yield* subjectOf(world, object);
  const selected = yield* Effect.forEach(request.selection, (selector) => declaredProperty(objectType, selector));
  const names = A.map(selected, ({ name }) => name);
  return OntologyObject.make({
    ...object,
    rid: request.includeRid ? object.rid : O.none(),
    properties: A.isReadonlyArrayEmpty(names)
      ? object.properties
      : R.filter(object.properties, (_, name) => A.contains(names, name)),
  });
});

const encodeRow = S.encodeEffect(OntologyObject);

// This is the platform's side of the wire, so an object leaves as the flat record a client decodes. The one
// object that cannot be written is one with a property named like a reserved key, which is a fault of the world.
const recordOf = (object: OntologyObject): Evaluation<ObjectRecord> =>
  Effect.mapError(encodeRow(object), (cause) =>
    invalidWorld(
      `An object of type "${object.locator.objectType}" cannot be written as a wire record: ${cause.message}`,
      { objectType: object.locator.objectType, primaryKey: object.locator.primaryKey }
    )
  );

const loadObjectsImpl = Effect.fn("Faux.loadObjects")(function* (world: FauxWorld, request: LoadObjectsRequest) {
  if (request.loadPropertySecurities) {
    return yield* unsupported("loadObjects.loadPropertySecurities", "Property securities are not modelled");
  }
  const matching = yield* evaluateObjectSetImpl(world, request.objectSet);
  const ordered = yield* orderObjects(world, matching, request.orderBy);
  const page = yield* pageOf(ordered, request.pageSize, request.pageToken);
  const data = yield* Effect.forEach(page.data, (object) =>
    Effect.flatMap(project(world, object, request), recordOf)
  );
  return LoadObjectsResponse.make({
    data,
    nextPageToken: page.nextPageToken,
    totalCount: BigInt(matching.length),
  });
});

/**
 * One page of the objects of an object set: evaluated, ordered, cut to the page, projected and written as rows.
 *
 * **Details**
 *
 * Without an ordering the objects come in the order the world holds them.
 * Ordering by fields compares each property in its own domain, keeps the
 * world's order between equal objects, and puts objects without a value last
 * in both directions. A page holds `pageSize` objects (1000 when absent) and
 * its token encodes how many objects came before it. `totalCount` counts the
 * whole object set. A selection keeps only the selected properties, and the
 * resource identifier is dropped unless the request includes it.
 *
 * The answer is what the platform would send: each object of the page is
 * written as its flat wire record, and the reader decodes it with a codec of
 * its own choosing. An object the world holds that cannot be written (one with
 * a property named like a reserved key) fails the request with
 * `FauxInvalidWorld`.
 *
 * Ordering by relevance and property securities are refused.
 *
 * **Example** (Read the second page of an ordered object set)
 *
 * ```ts import.meta.vitest name="Read the second page of an ordered object set"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LoadObjectsRequest } from "@beep/scratchpad/osdk/src/Client/index"
 * import { FauxWorld, loadObjects } from "@beep/scratchpad/osdk/src/Faux/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { objectType, OrderByFields, PropertyOrdering } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const world = await Effect.runPromise(
 *   S.decodeUnknownEffect(FauxWorld)({
 *     ontology: {
 *       ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *       objectTypes: {
 *         Office: {
 *           objectType: {
 *             apiName: "Office",
 *             displayName: "Office",
 *             pluralDisplayName: "Offices",
 *             icon: { type: "blueprint", color: "blue", name: "office" },
 *             primaryKey: "officeId",
 *             titleProperty: "officeId",
 *             properties: {
 *               officeId: { dataType: { type: "string" }, rid: "ri.property.officeId" },
 *               capacity: { dataType: { type: "integer" }, rid: "ri.property.capacity" },
 *             },
 *             rid: "ri.ontology.main.object-type.office",
 *             status: "ACTIVE",
 *           },
 *           linkTypes: [],
 *           implementsInterfaces: [],
 *           implementsInterfaces2: {},
 *           sharedPropertyTypeMapping: {},
 *         },
 *       },
 *       actionTypes: {},
 *       queryTypes: {},
 *       interfaceTypes: {},
 *       sharedPropertyTypes: {},
 *       valueTypes: {},
 *     },
 *     objects: [
 *       { __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 120 },
 *       { __apiName: "Office", __primaryKey: "LDN", officeId: "LDN", capacity: 80 },
 *       { __apiName: "Office", __primaryKey: "SFO", officeId: "SFO", capacity: 200 },
 *     ],
 *   })
 * )
 * const byCapacity = OrderByFields.make({
 *   fields: [PropertyOrdering.make({ property: PropertyApiName.make("capacity"), direction: O.some("desc") })],
 * })
 * const request = LoadObjectsRequest.make({
 *   objectSet: objectType("Office"),
 *   orderBy: O.some(byCapacity),
 *   pageSize: O.some(2),
 * })
 * const first = await Effect.runPromise(loadObjects(world, request))
 * const second = await Effect.runPromise(
 *   loadObjects(world, LoadObjectsRequest.make({ ...request, pageToken: first.nextPageToken }))
 * )
 * const keysOf = A.map((office: (typeof first.data)[number]) => office.__primaryKey)
 * const keys = [keysOf(first.data), keysOf(second.data)]
 * keys // => [["SFO", "NYC"], ["LDN"]]
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const loadObjects: {
  (request: LoadObjectsRequest): (world: FauxWorld) => Effect.Effect<LoadObjectsResponse, ApiError>;
  (world: FauxWorld, request: LoadObjectsRequest): Effect.Effect<LoadObjectsResponse, ApiError>;
} = dual(2, loadObjectsImpl);

// -----------------------------------------------------------------------------
// Aggregation: metrics
// -----------------------------------------------------------------------------

const readingsOf = (
  world: FauxWorld,
  objects: Objects,
  property: PropertySelector
): Evaluation<ReadonlyArray<Reading>> =>
  Effect.map(
    Effect.forEach(objects, (object) => readIn(world, object, property)),
    (readings) => A.getSomes(readings)
  );

const numbersOf = (
  metric: string,
  world: FauxWorld,
  objects: Objects,
  property: PropertySelector
): Evaluation<ReadonlyArray<number>> =>
  Effect.flatMap(readingsOf(world, objects, property), (readings) =>
    Effect.forEach(readings, ({ declared, value }) =>
      Effect.fromOption(numberOf(value), () =>
        invalid(
          "PropertyBaseTypeNotSupported",
          `The "${metric}" metric needs a numeric property, and "${declared.name}" is a ${declared.type.type}`,
          { property: declared.name, propertyType: declared.type.type }
        )
      )
    )
  );

const noValue: O.Option<S.Json> = O.none();

const summarize = (
  metric: string,
  world: FauxWorld,
  objects: Objects,
  property: PropertySelector,
  reduce: (numbers: A.NonEmptyReadonlyArray<number>) => number
): Evaluation<O.Option<S.Json>> =>
  Effect.map(
    numbersOf(metric, world, objects, property),
    A.match({
      onEmpty: () => noValue,
      onNonEmpty: (numbers) => O.some(reduce(numbers)),
    })
  );

// Linear interpolation between the two values the percentile falls between. The percentile is a percentage
// from 0 to 100 (50 is the median), the scale OSDK's documentation uses; values outside it are clamped.
const percentileOf =
  (percentile: number) =>
  (numbers: A.NonEmptyReadonlyArray<number>): number => {
    const sorted = A.sort(numbers, Order.Number);
    const rank = (N.clamp(percentile, { minimum: 0, maximum: 100 }) / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const below = O.getOrElse(A.get(sorted, lower), () => A.headNonEmpty(sorted));
    const above = O.getOrElse(A.get(sorted, lower + 1), () => below);
    return below + (above - below) * (rank - lower);
  };

// The stored form of the smallest or the largest value, compared in the property's own domain.
const extremeOf = (
  metric: string,
  world: FauxWorld,
  objects: Objects,
  property: PropertySelector,
  wins: (ordering: number) => boolean
): Evaluation<O.Option<S.Json>> =>
  Effect.flatMap(readingsOf(world, objects, property), (readings) =>
    A.matchLeft(readings, {
      onEmpty: (): Evaluation<O.Option<S.Json>> => Effect.succeed(noValue),
      onNonEmpty: (first, rest): Evaluation<O.Option<S.Json>> =>
        isOrderedKind(first.declared.type.type)
          ? Effect.succeedSome(
              A.reduce(rest, first, (best, next) =>
                O.exists(compareValues(next.value, best.value), wins) ? next : best
              ).json
            )
          : Effect.fail(notOrdered(`The "${metric}" metric`, first.declared, "PropertyBaseTypeNotSupported")),
    })
  );

const distinctOf = (world: FauxWorld, objects: Objects, property: PropertySelector): Evaluation<O.Option<S.Json>> =>
  Effect.map(readingsOf(world, objects, property), (readings) =>
    O.some(
      A.matchLeft(readings, {
        onEmpty: () => 0,
        onNonEmpty: (first) =>
          A.dedupeWith(
            readings,
            Equivalence.mapInput(S.toEquivalence(valueCodec(first.declared.type)), ({ value }: Reading) => value)
          ).length,
      })
    )
  );

const metricOf = (world: FauxWorld, objects: Objects): ((aggregation: Aggregation) => Evaluation<O.Option<S.Json>>) =>
  Aggregation.match({
    count: (): Evaluation<O.Option<S.Json>> => Effect.succeedSome(objects.length),
    sum: ({ property }) => summarize("sum", world, objects, property, N.sumAll),
    avg: ({ property }) => summarize("avg", world, objects, property, (numbers) => N.sumAll(numbers) / numbers.length),
    min: ({ property }) => extremeOf("min", world, objects, property, (ordering) => ordering < 0),
    max: ({ property }) => extremeOf("max", world, objects, property, (ordering) => ordering > 0),
    approximateDistinct: ({ property }) => distinctOf(world, objects, property),
    exactDistinct: ({ property }) => distinctOf(world, objects, property),
    approximatePercentile: ({ property, percentile }) =>
      summarize("approximatePercentile", world, objects, property, percentileOf(percentile)),
  });

// The name the client's regrouping expects: the request's own, or "count" and "<property>.<metric>".
const metricNameOf = (aggregation: Aggregation): MetricName =>
  O.getOrElse(aggregation.name, () =>
    MetricName.make(
      O.match(metricKeyOf(aggregation), {
        onNone: (): string => aggregation.type,
        onSome: MetricKey.match({
          count: (): string => "count",
          property: ({ property, metric }): string => `${property}.${metric}`,
        }),
      })
    )
  );

// -----------------------------------------------------------------------------
// Aggregation: groupings
// -----------------------------------------------------------------------------

// One group of a grouping: the value that identifies it and the objects that fall in it.
interface Part {
  readonly key: S.Json;
  readonly objects: Objects;
}

// One row in the making: the group values of the groupings applied so far, and the objects they share.
interface Bucket {
  readonly group: Readonly<Record<GroupKey, S.Json>>;
  readonly objects: Objects;
}

interface Member {
  readonly object: OntologyObject;
  readonly reading: O.Option<Reading>;
}

interface Valued {
  readonly object: OntologyObject;
  readonly reading: Reading;
}

interface Placed<Key> {
  readonly object: OntologyObject;
  readonly key: Key;
  readonly json: S.Json;
}

// The members that have a value, with that value.
const valuedOf = (members: ReadonlyArray<Member>): ReadonlyArray<Valued> =>
  A.getSomes(
    A.map(members, ({ object, reading }) => O.map(reading, (present): Valued => ({ object, reading: present })))
  );

const membersOf = (world: FauxWorld, objects: Objects, property: PropertySelector): Evaluation<ReadonlyArray<Member>> =>
  Effect.forEach(objects, (object) =>
    Effect.map(readIn(world, object, property), (reading): Member => ({ object, reading }))
  );

// Sorts by key and gathers the runs of equal keys; the sort is stable, so a group keeps the world's order.
const partsOf = <Key>(placed: ReadonlyArray<Placed<Key>>, order: Order.Order<Key>): ReadonlyArray<Part> =>
  A.match(
    A.sort(
      placed,
      Order.mapInput(order, ({ key }: Placed<Key>) => key)
    ),
    {
      onEmpty: A.empty<Part>,
      onNonEmpty: (sorted) =>
        A.map(
          A.groupWith(sorted, (mine, theirs) => order(mine.key, theirs.key) === 0),
          (run): Part => ({ key: A.headNonEmpty(run).json, objects: A.map(run, ({ object }) => object) })
        ),
    }
  );

const byDecodedValue: Order.Order<unknown> = Order.make((mine, theirs) =>
  Order.Number(
    O.getOrElse(compareValues(mine, theirs), () => 0),
    0
  )
);

const exactParts = Effect.fnUntraced(function* (world: FauxWorld, objects: Objects, grouping: ExactGrouping) {
  if (O.isSome(grouping.defaultValue)) {
    return yield* unsupported("groupBy.exact.defaultValue", "A default value for objects without one is not modelled");
  }
  const members = yield* membersOf(world, objects, grouping.property);
  const placed = yield* Effect.forEach(
    valuedOf(members),
    ({ object, reading }): Evaluation<Placed<unknown>> =>
      O.isSome(compareValues(reading.value, reading.value))
        ? Effect.succeed({ object, key: reading.value, json: reading.json })
        : Effect.fail(
            invalid(
              "PropertyBaseTypeNotSupported",
              `An exact grouping needs a scalar property, and "${reading.declared.name}" is a ${reading.declared.type.type}`,
              { property: reading.declared.name, propertyType: reading.declared.type.type }
            )
          )
  );
  const valued = partsOf(placed, byDecodedValue);
  const limited = O.match(grouping.maxGroupCount, {
    onNone: () => valued,
    onSome: (limit) => A.take(valued, limit),
  });
  const valueless = A.map(
    A.filter(members, ({ reading }) => O.isNone(reading)),
    ({ object }) => object
  );
  return O.exists(grouping.includeNullValues, identity) && A.isReadonlyArrayNonEmpty(valueless)
    ? A.append(limited, { key: null, objects: valueless })
    : limited;
});

const fixedWidthParts = Effect.fnUntraced(function* (world: FauxWorld, objects: Objects, grouping: FixedWidthGrouping) {
  const members = yield* membersOf(world, objects, grouping.property);
  const placed = yield* Effect.forEach(
    valuedOf(members),
    ({ object, reading }): Evaluation<Placed<number>> =>
      O.match(numberOf(reading.value), {
        onNone: (): Evaluation<Placed<number>> =>
          Effect.fail(
            invalid(
              "PropertyBaseTypeNotSupported",
              `A fixed-width grouping needs a numeric property, and "${reading.declared.name}" is a ${reading.declared.type.type}`,
              { property: reading.declared.name, propertyType: reading.declared.type.type }
            )
          ),
        onSome: (number): Evaluation<Placed<number>> => {
          const start = Math.floor(number / grouping.width) * grouping.width;
          return Effect.succeed({ object, key: start, json: start });
        },
      })
  );
  return partsOf(placed, Order.Number);
});

interface Bounds {
  readonly startValue: ScalarValue;
  readonly endValue: ScalarValue;
}

// A range holds its start and not its end.
const inRange = Effect.fnUntraced(function* (reading: Reading, range: Bounds) {
  const start = yield* decodeOperand(reading.declared, range.startValue, "InvalidAggregationRange");
  const end = yield* decodeOperand(reading.declared, range.endValue, "InvalidAggregationRange");
  return A.some(
    testedValues(reading.declared.type, reading.value),
    (held) =>
      O.exists(compareValues(held, start), (ordering) => ordering >= 0) &&
      O.exists(compareValues(held, end), (ordering) => ordering < 0)
  );
});

// One part per listed range, in the listed order, whether or not an object falls in it. The key of a
// part is the range as it was asked for: its bounds are wire scalars already.
const rangesParts = Effect.fnUntraced(function* (world: FauxWorld, objects: Objects, grouping: RangesGrouping) {
  const members = yield* membersOf(world, objects, grouping.property);
  return yield* Effect.forEach(grouping.ranges, ({ startValue, endValue }) =>
    Effect.map(
      keep(members, ({ reading }) =>
        O.match(reading, {
          onNone: (): Evaluation<boolean> => Effect.succeed(false),
          onSome: (present): Evaluation<boolean> => inRange(present, { startValue, endValue }),
        })
      ),
      (held): Part => ({ key: { startValue, endValue }, objects: A.map(held, ({ object }) => object) })
    )
  );
});

const partsBy = (world: FauxWorld, objects: Objects): ((grouping: GroupBy) => Evaluation<ReadonlyArray<Part>>) =>
  GroupBy.match({
    exact: (grouping): Evaluation<ReadonlyArray<Part>> => exactParts(world, objects, grouping),
    fixedWidth: (grouping): Evaluation<ReadonlyArray<Part>> => fixedWidthParts(world, objects, grouping),
    ranges: (grouping): Evaluation<ReadonlyArray<Part>> => rangesParts(world, objects, grouping),
    duration: (): Evaluation<ReadonlyArray<Part>> =>
      Effect.fail(unsupported("groupBy.duration", "Calendar and duration buckets are not modelled")),
  });

const groupKeyOf = (grouping: GroupBy): Evaluation<GroupKey> =>
  PropertySelector.matchOrElse(
    grouping.property,
    { property: ({ apiName }): Evaluation<GroupKey> => Effect.succeed(GroupKey.make(apiName)) },
    (): Evaluation<GroupKey> =>
      Effect.fail(unsupported("groupBy.selector", "A grouping must name its property by API name"))
  );

const divide = (
  world: FauxWorld,
  buckets: ReadonlyArray<Bucket>,
  grouping: GroupBy
): Evaluation<ReadonlyArray<Bucket>> =>
  Effect.flatMap(groupKeyOf(grouping), (name) =>
    Effect.map(
      Effect.forEach(buckets, (bucket) =>
        Effect.map(partsBy(world, bucket.objects)(grouping), (parts) =>
          A.map(parts, (part): Bucket => ({ group: R.set(bucket.group, name, part.key), objects: part.objects }))
        )
      ),
      (divided) => A.flatten(divided)
    )
  );

const bucketsOf = (
  world: FauxWorld,
  objects: Objects,
  groupBy: ReadonlyArray<GroupBy>
): Evaluation<ReadonlyArray<Bucket>> => {
  const whole: Evaluation<ReadonlyArray<Bucket>> = Effect.succeed(
    A.of({ group: R.empty<GroupKey, S.Json>(), objects })
  );
  return A.reduce(groupBy, whole, (buckets, grouping) =>
    Effect.flatMap(buckets, (held) => divide(world, held, grouping))
  );
};

// -----------------------------------------------------------------------------
// Aggregation: rows
// -----------------------------------------------------------------------------

const rowOf = (
  world: FauxWorld,
  aggregations: ReadonlyArray<Aggregation>,
  bucket: Bucket
): Evaluation<AggregationRow> =>
  Effect.map(
    Effect.forEach(aggregations, (aggregation) =>
      Effect.map(metricOf(world, bucket.objects)(aggregation), (value) =>
        MetricResult.make({ name: metricNameOf(aggregation), value })
      )
    ),
    (metrics) => AggregationRow.make({ group: bucket.group, metrics })
  );

const numericMetric = (row: AggregationRow, name: MetricName): O.Option<number> =>
  pipe(
    A.findFirst(row.metrics, (metric) => metric.name === name),
    O.flatMap((metric) => metric.value),
    O.filter(P.isNumber)
  );

// The first metric that names a direction orders the rows; rows without a value for it go last.
const orderRows = (
  rows: ReadonlyArray<AggregationRow>,
  aggregations: ReadonlyArray<Aggregation>
): ReadonlyArray<AggregationRow> =>
  O.match(
    A.findFirst(aggregations, (aggregation) => O.isSome(aggregation.direction)),
    {
      onNone: () => rows,
      onSome: (ordering) =>
        A.sort(
          rows,
          Order.make<AggregationRow>((mine, theirs) =>
            Order.Number(
              compareKeys(
                numericMetric(mine, metricNameOf(ordering)),
                numericMetric(theirs, metricNameOf(ordering)),
                O.exists(ordering.direction, (direction) => direction === "desc")
              ),
              0
            )
          )
        ),
    }
  );

const aggregateObjectsImpl = Effect.fn("Faux.aggregateObjects")(function* (
  world: FauxWorld,
  request: AggregateObjectSetRequest
) {
  const objects = yield* evaluateObjectSetImpl(world, request.objectSet);
  const buckets = yield* bucketsOf(world, objects, request.groupBy);
  const rows = yield* Effect.forEach(buckets, (bucket) => rowOf(world, request.aggregations, bucket));
  return AggregateResponse.make({ accuracy: "accurate", data: orderRows(rows, request.aggregations) });
});

/**
 * The rows of an aggregation over an object set, in the shape the platform answers with.
 *
 * **Details**
 *
 * Without groupings there is exactly one row, also for an empty object set.
 * Groupings nest, outermost first. An exact grouping makes one group per value
 * in ascending order, leaves objects without a value out unless
 * `includeNullValues` asks for a `null` group (which comes last), and honours
 * `maxGroupCount`. A fixed-width grouping names each bucket by its lower
 * bound. A range grouping answers one row per listed range, in the listed
 * order and also when the range is empty, keyed by its start and end.
 *
 * `count` counts objects. `sum`, `avg` and `approximatePercentile` read
 * numeric properties in double precision; the percentile interpolates
 * linearly. `min` and `max` compare in the property's own domain and answer
 * the stored form of the winner. Both distinct counts are exact. A metric over
 * no values has no value, except `count` and the distinct counts, which are
 * zero. A metric is named by the request, or `count` and
 * `<property>.<metric>` otherwise. The first metric with a direction orders
 * the rows. The answer is always reported as accurate. A percentile is read as
 * a percentage from `0` to `100`, so `50` is the median.
 *
 * Duration groupings and default values of exact groupings are refused.
 *
 * **Example** (Average a property per group)
 *
 * ```ts import.meta.vitest name="Average a property per group"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { avg, exact } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { AggregateObjectSetRequest } from "@beep/scratchpad/osdk/src/Client/index"
 * import { aggregateObjects, FauxWorld } from "@beep/scratchpad/osdk/src/Faux/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { objectType } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const world = await Effect.runPromise(
 *   S.decodeUnknownEffect(FauxWorld)({
 *     ontology: {
 *       ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *       objectTypes: {
 *         Office: {
 *           objectType: {
 *             apiName: "Office",
 *             displayName: "Office",
 *             pluralDisplayName: "Offices",
 *             icon: { type: "blueprint", color: "blue", name: "office" },
 *             primaryKey: "officeId",
 *             titleProperty: "officeId",
 *             properties: {
 *               officeId: { dataType: { type: "string" }, rid: "ri.property.officeId" },
 *               country: { dataType: { type: "string" }, rid: "ri.property.country" },
 *               capacity: { dataType: { type: "integer" }, rid: "ri.property.capacity" },
 *             },
 *             rid: "ri.ontology.main.object-type.office",
 *             status: "ACTIVE",
 *           },
 *           linkTypes: [],
 *           implementsInterfaces: [],
 *           implementsInterfaces2: {},
 *           sharedPropertyTypeMapping: {},
 *         },
 *       },
 *       actionTypes: {},
 *       queryTypes: {},
 *       interfaceTypes: {},
 *       sharedPropertyTypes: {},
 *       valueTypes: {},
 *     },
 *     objects: [
 *       { __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", country: "US", capacity: 120 },
 *       { __apiName: "Office", __primaryKey: "SFO", officeId: "SFO", country: "US", capacity: 200 },
 *       { __apiName: "Office", __primaryKey: "LDN", officeId: "LDN", country: "UK", capacity: 80 },
 *     ],
 *   })
 * )
 * const capacity = PropertyApiName.make("capacity")
 * const response = await Effect.runPromise(
 *   aggregateObjects(
 *     world,
 *     AggregateObjectSetRequest.make({
 *       objectSet: objectType("Office"),
 *       aggregations: [avg(capacity)],
 *       groupBy: [exact(PropertyApiName.make("country"), {})],
 *     })
 *   )
 * )
 * const rows = A.map(response.data, (row) => [row.group, A.map(row.metrics, (metric) => [metric.name, O.getOrNull(metric.value)])])
 * rows // => [[{ country: "UK" }, [["capacity.avg", 80]]], [{ country: "US" }, [["capacity.avg", 160]]]]
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const aggregateObjects: {
  (request: AggregateObjectSetRequest): (world: FauxWorld) => Effect.Effect<AggregateResponse, ApiError>;
  (world: FauxWorld, request: AggregateObjectSetRequest): Effect.Effect<AggregateResponse, ApiError>;
} = dual(2, aggregateObjectsImpl);
