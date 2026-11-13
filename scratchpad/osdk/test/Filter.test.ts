import { LocalDate } from "@beep/schema/LocalDate";
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
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as BigDecimal from "effect/BigDecimal";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import {
  BooleanType,
  DateType,
  DecimalType,
  GeoPointType,
  GeospatialKind,
  IntegerType,
  LongType,
  NumericKind,
  PropertyTypeKind,
  ShortType,
  StringType,
  TemporalKind,
  TimestampType,
} from "../src/DataType/index.ts";
import {
  And,
  allowedOperands,
  allowedOperators,
  and,
  BoundingBoxCorners,
  CircularArea,
  ComparisonOperator,
  Contains,
  ContainsAllTerms,
  ContainsAllTermsInOrder,
  ContainsAllTermsInOrderPrefixLastTerm,
  ContainsAnyTerm,
  checkFilter,
  contains,
  containsAllTerms,
  containsAllTermsInOrder,
  containsAllTermsInOrderPrefixLastTerm,
  containsAnyTerm,
  DoesNotIntersectBoundingBox,
  DoesNotIntersectPolygon,
  doesNotIntersectBoundingBox,
  doesNotIntersectPolygon,
  EmptyCombinator,
  EnvelopeGeometry,
  Equals,
  eq,
  every,
  FilterOperator,
  FilterViolation,
  foldFilter,
  GeoJsonGeometry,
  GeoOperator,
  GreaterThan,
  GreaterThanOrEqual,
  gt,
  gte,
  InRelativeDateRange,
  IntersectsBoundingBox,
  IntersectsPolygon,
  IntervalAllOf,
  IntervalAnyOf,
  IntervalFuzzyMatch,
  IntervalMatch,
  IntervalPrefixMatch,
  IntervalRule,
  IsNull,
  inRelativeDateRange,
  intersectsBoundingBox,
  intersectsPolygon,
  isNotNull,
  isNull,
  LessThan,
  LessThanOrEqual,
  LogicalOperator,
  lt,
  lte,
  MatchesInterval,
  MatchesRegex,
  MatchesWildcard,
  MembershipOperator,
  matchesInterval,
  matchesRegex,
  matchesWildcard,
  Not,
  ne,
  not,
  ObjectFilter,
  OneOf,
  OperandFamily,
  OperandMismatch,
  OperatorNotAllowed,
  Or,
  oneOf,
  operandFamily,
  operandsOf,
  operatorsOf,
  or,
  PropertyFilter,
  PropertyOperator,
  RelatesToGeometry,
  RelativeDateRange,
  RelativeDateUnit,
  RelativePoint,
  relatesToGeometry,
  SearchGeometry,
  SpatialRelation,
  StartsWith,
  selectorsOf,
  some,
  startsWith,
  TemporalOperator,
  TextAnalyzer,
  TextOperator,
  toSelector,
  UnknownProperty,
  WithinBoundingBox,
  WithinDistance,
  WithinPolygon,
  withinBoundingBox,
  withinDistance,
  withinPolygon,
} from "../src/Filter/index.ts";
import { Distance, GeoPoint, LinearRing, Polygon } from "../src/Geo/index.ts";
import { PropertyApiName, PropertyTypeRid, StructFieldApiName, StructFieldTypeRid } from "../src/Identifier/index.ts";
import { EquatableKind } from "../src/Model/index.ts";
import {
  ArrayType,
  operandCodec,
  operandType,
  PrimaryKeyProperty,
  PropertyAddressed,
  PropertyAtLoadLevel,
  PropertyByName,
  PropertyDefinition,
  PropertySelector,
  PropertyType,
  StructFieldOfProperty,
  StructFieldType,
  StructType,
  TitleProperty,
  valueCodec,
} from "../src/Property/index.ts";
import { DateValue, ScalarValue } from "../src/Value/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by every named schema
// ---------------------------------------------------------------------------

const generated = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const is = S.is(schema);
  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });
};

// Every schema of this module: encode then decode is the identity. A comparison operand is the wire scalar itself,
// so that includes the members that carry one and the tree that contains them.
const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  generated(name, schema);

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

const failureMessage =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<string> =>
    Effect.match(S.decodeUnknownEffect(schema)(input), {
      onFailure: (error) => error.message,
      onSuccess: () => "",
    });

// Assertion helpers that keep every `yield*` out of call arguments.
const expectRejected = <T, E>(schema: S.Codec<T, E>) =>
  Effect.fnUntraced(function* (inputs: ReadonlyArray<unknown>) {
    const verdicts = yield* Effect.forEach(inputs, rejects(schema));
    deepStrictEqual(
      verdicts,
      A.map(inputs, () => true)
    );
  });

const expectAccepted = <T, E>(schema: S.Codec<T, E>) =>
  Effect.fnUntraced(function* (inputs: ReadonlyArray<unknown>) {
    const verdicts = yield* Effect.forEach(inputs, rejects(schema));
    deepStrictEqual(
      verdicts,
      A.map(inputs, () => false)
    );
  });

const expectWire = <T, E>(schema: S.Codec<T, E>) =>
  Effect.fnUntraced(function* (value: T, wire: E) {
    const encoded = yield* S.encodeEffect(schema)(value);
    deepStrictEqual(encoded, wire);
  });

// Decodes a wire fixture, compares it with the expected domain value and encodes both back to the fixture.
const expectFixture = <T, E>(schema: S.Codec<T, E>) =>
  Effect.fnUntraced(function* (wire: E, domain: T) {
    const decoded = yield* S.decodeEffect(schema)(wire);
    assertTrue(S.toEquivalence(schema)(decoded, domain));
    const fromDecoded = yield* S.encodeEffect(schema)(decoded);
    const fromDomain = yield* S.encodeEffect(schema)(domain);
    deepStrictEqual(fromDecoded, wire);
    deepStrictEqual(fromDomain, wire);
  });

const decodeFilter = S.decodeEffect(ObjectFilter);
const encodeFilter = S.encodeEffect(ObjectFilter);
const sameFilter = S.toEquivalence(ObjectFilter);
const rejectsFilters = expectRejected(ObjectFilter);
const acceptsFilters = expectAccepted(ObjectFilter);
const filterFixture = expectFixture(ObjectFilter);
const filterFailure = failureMessage(ObjectFilter);

// ---------------------------------------------------------------------------
// Shared values
// ---------------------------------------------------------------------------

const named = (name: string): PropertyByName => PropertyByName.make({ apiName: PropertyApiName.make(name) });

const zipOfAddress = StructFieldOfProperty.make({
  propertyApiName: PropertyApiName.make("address"),
  structFieldApiName: StructFieldApiName.make("zip"),
});

const triangle = Polygon.make({
  coordinates: [
    LinearRing.fromVertices([
      [0, 0],
      [4, 0],
      [0, 3],
    ]),
  ],
});
const triangleWire: typeof Polygon.Encoded = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [4, 0],
      [0, 3],
      [0, 0],
    ],
  ],
};

const seattleBox = BoundingBoxCorners.fromBoundingBox([-122.5, 47.5, -122.2, 47.7]);
const seattleBoxWire: typeof BoundingBoxCorners.Encoded = {
  topLeft: { type: "Point", coordinates: [-122.5, 47.7] },
  bottomRight: { type: "Point", coordinates: [-122.2, 47.5] },
};

const downtown = CircularArea.around([-122.33, 47.61], Distance.kilometers(5));

const lastWeek = RelativeDateRange.make({
  relativeStartTime: O.some(RelativePoint.make({ value: -7, timeUnit: "day" })),
  timeZoneId: "America/New_York",
});

const quick = IntervalMatch.make({ query: "quick brown", ordered: true });
const fox = IntervalFuzzyMatch.make({ term: "fox", fuzziness: O.some(1) });
const nearby = IntervalAllOf.make({
  rules: [quick, IntervalAnyOf.make({ rules: [fox, IntervalPrefixMatch.make({ query: "lazy do" })] })],
  ordered: false,
  maxGaps: O.some(2),
});

// ---------------------------------------------------------------------------
// Literal domains
// ---------------------------------------------------------------------------

describe("literal domains", () => {
  lawful("TextAnalyzer", TextAnalyzer);
  lawful("SpatialRelation", SpatialRelation);
  lawful("RelativeDateUnit", RelativeDateUnit);

  it("pairs every wire literal with exactly one domain literal, in wire order", () => {
    deepStrictEqual(TextAnalyzer.Pairs, [
      ["BASE_ANALYZER", "baseAnalyzer"],
      ["PHONETIC_ANALYZER", "phoneticAnalyzer"],
    ]);
    deepStrictEqual(SpatialRelation.Pairs, [
      ["INTERSECTS", "intersects"],
      ["DISJOINT", "disjoint"],
      ["WITHIN", "within"],
      ["CONTAINS", "contains"],
    ]);
    deepStrictEqual(RelativeDateUnit.Pairs, [
      ["DAY", "day"],
      ["WEEK", "week"],
      ["MONTH", "month"],
      ["YEAR", "year"],
    ]);
  });

  it.effect(
    "rejects the plural spelling that other time units use on the wire",
    Effect.fnUntraced(function* () {
      yield* expectRejected(RelativeDateUnit)(["DAYS", "day"]);
      yield* expectRejected(TextAnalyzer)(["phoneticAnalyzer", "phonetic", "PHONETIC"]);
      yield* expectRejected(SpatialRelation)(["OVERLAPS", "within"]);
    })
  );
});

// ---------------------------------------------------------------------------
// Interval rules
// ---------------------------------------------------------------------------

describe("IntervalRule", () => {
  lawful("IntervalMatch", IntervalMatch);
  lawful("IntervalPrefixMatch", IntervalPrefixMatch);
  lawful("IntervalAllOf", IntervalAllOf);
  lawful("IntervalAnyOf", IntervalAnyOf);
  lawful("IntervalFuzzyMatch", IntervalFuzzyMatch);
  lawful("IntervalRule", IntervalRule);

  it.effect(
    "decodes a nested wire rule to the domain tree and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: IntervalRule.Encoded = {
        type: "allOf",
        rules: [
          { type: "match", query: "quick brown", ordered: true },
          {
            type: "anyOf",
            rules: [
              { type: "fuzzy", term: "fox", fuzziness: 1 },
              { type: "prefixOnLastToken", query: "lazy do" },
            ],
          },
        ],
        ordered: false,
        maxGaps: 2,
      };
      yield* expectFixture(IntervalRule)(wire, nearby);
    })
  );

  it("constructs every case through the union and matches it exhaustively", () => {
    const samples: ReadonlyArray<IntervalRule> = [
      IntervalRule.cases.match.make({ query: "quick", ordered: false }),
      IntervalRule.cases.prefixOnLastToken.make({ query: "qui" }),
      IntervalRule.cases.allOf.make({ rules: [quick], ordered: true }),
      IntervalRule.cases.anyOf.make({ rules: [quick, fox] }),
      IntervalRule.cases.fuzzy.make({ term: "fox" }),
    ];
    const tagOf: (rule: IntervalRule) => string = IntervalRule.match({
      match: () => "match",
      prefixOnLastToken: () => "prefixOnLastToken",
      allOf: () => "allOf",
      anyOf: () => "anyOf",
      fuzzy: () => "fuzzy",
    });
    deepStrictEqual<ReadonlyArray<string>>(A.map(samples, tagOf), IntervalRule.discriminants);
    assertTrue(A.every(samples, (sample) => IntervalRule.guards[sample.type](sample)));
    assertFalse(IntervalRule.guards.match(fox));
  });

  it("leaves the optional settings absent by default", () => {
    assertNone(quick.maxGaps);
    assertNone(IntervalFuzzyMatch.make({ term: "fox" }).fuzziness);
    assertSome(nearby.maxGaps, 2);
  });

  it.effect(
    "rejects a rule that omits what the wire requires",
    Effect.fnUntraced(function* () {
      yield* expectRejected(IntervalRule)([
        { type: "match", query: "quick" },
        { type: "allOf", rules: [] },
        { type: "allOf", rules: [{ type: "match", query: "quick" }], ordered: true },
        { type: "fuzzy" },
        { type: "phrase", query: "quick" },
      ]);
      yield* expectAccepted(IntervalRule)([
        { type: "allOf", rules: [], ordered: true },
        { type: "anyOf", rules: [] },
        { type: "fuzzy", term: "fox", fuzziness: 7 },
      ]);
    })
  );
});

// ---------------------------------------------------------------------------
// Operand records
// ---------------------------------------------------------------------------

describe("operand records", () => {
  lawful("RelativePoint", RelativePoint);
  lawful("RelativeDateRange", RelativeDateRange);
  lawful("BoundingBoxCorners", BoundingBoxCorners);
  lawful("CircularArea", CircularArea);
  lawful("EnvelopeGeometry", EnvelopeGeometry);
  lawful("GeoJsonGeometry", GeoJsonGeometry);
  lawful("SearchGeometry", SearchGeometry);

  it.effect(
    "decodes each wire operand to its domain record and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const range: typeof RelativeDateRange.Encoded = {
        relativeStartTime: { type: "relativePoint", value: -7, timeUnit: "DAY" },
        timeZoneId: "America/New_York",
      };
      const area: typeof CircularArea.Encoded = {
        center: { type: "Point", coordinates: [-122.33, 47.61] },
        distance: { value: 5, unit: "KILOMETERS" },
      };
      yield* expectFixture(RelativeDateRange)(range, lastWeek);
      yield* expectFixture(BoundingBoxCorners)(seattleBoxWire, seattleBox);
      yield* expectFixture(CircularArea)(area, downtown);
    })
  );

  it.effect(
    "parses a search geometry out of its GeoJSON text and serializes it back without whitespace",
    Effect.fnUntraced(function* () {
      const wire: typeof SearchGeometry.Encoded = {
        type: "geoJson",
        geoJson: '{"type":"Polygon","coordinates":[[[0,0],[4,0],[0,3],[0,0]]]}',
      };
      yield* expectFixture(SearchGeometry)(wire, GeoJsonGeometry.make({ geoJson: triangle }));

      const spaced = yield* S.decodeEffect(SearchGeometry)({
        type: "geoJson",
        geoJson: '{ "type": "Point", "coordinates": [1, 2] }',
      });
      yield* expectWire(SearchGeometry)(spaced, {
        type: "geoJson",
        geoJson: '{"type":"Point","coordinates":[1,2]}',
      });
    })
  );

  it("constructs both search geometries through the union and matches them exhaustively", () => {
    const samples: ReadonlyArray<SearchGeometry> = [
      SearchGeometry.cases.envelope.make({ topLeft: seattleBox.topLeft, bottomRight: seattleBox.bottomRight }),
      SearchGeometry.cases.geoJson.make({ geoJson: GeoPoint.make({ coordinates: [1, 2] }) }),
    ];
    const tagOf: (geometry: SearchGeometry) => string = SearchGeometry.match({
      envelope: () => "envelope",
      geoJson: () => "geoJson",
    });
    deepStrictEqual<ReadonlyArray<string>>(A.map(samples, tagOf), SearchGeometry.discriminants);
    assertTrue(A.every(samples, (sample) => SearchGeometry.guards[sample.type](sample)));
  });

  it("derives the corners of a GeoJSON bounding box, dropping altitudes", () => {
    deepStrictEqual(seattleBox.topLeft.coordinates, [-122.5, 47.7]);
    deepStrictEqual(seattleBox.bottomRight.coordinates, [-122.2, 47.5]);
    const solid = BoundingBoxCorners.fromBoundingBox([-122.5, 47.5, 0, -122.2, 47.7, 100]);
    assertTrue(S.toEquivalence(BoundingBoxCorners)(solid, seattleBox));
    assertNone(lastWeek.relativeEndTime);
  });

  it.effect(
    "rejects operands that break an invariant",
    Effect.fnUntraced(function* () {
      yield* expectRejected(RelativeDateRange)([
        { relativeStartTime: { type: "relativePoint", value: 1, timeUnit: "DAY" } },
        { timeZoneId: "" },
        { timeZoneId: "UTC", relativeEndTime: { type: "relativePoint", value: 1, timeUnit: "DAYS" } },
      ]);
      yield* expectRejected(RelativePoint)([
        { value: 1, timeUnit: "DAY" },
        { type: "relativePoint", value: "1", timeUnit: "DAY" },
      ]);
      yield* expectRejected(CircularArea)([
        { center: { type: "Point", coordinates: [0, 0] }, distance: { value: -1, unit: "METERS" } },
        { center: { type: "Point", coordinates: [0, 0] } },
      ]);
      yield* expectRejected(BoundingBoxCorners)([
        { topLeft: { type: "Point", coordinates: [0, 0] } },
        { topLeft: { type: "Point", coordinates: [0, 0] }, bottomRight: { type: "LineString", coordinates: [] } },
      ]);
      yield* expectRejected(SearchGeometry)([
        { type: "geoJson", geoJson: "not json" },
        { type: "geoJson", geoJson: '{"type":"Circle"}' },
        { type: "geoJson", geoJson: { type: "Point", coordinates: [1, 2] } },
        { type: "envelope", topLeft: { type: "Point", coordinates: [0, 0] } },
        { type: "polygon" },
      ]);
    })
  );
});

// ---------------------------------------------------------------------------
// Property addressing
// ---------------------------------------------------------------------------

describe("PropertyAddressed", () => {
  const LongerThan = PropertyAddressed("longerThan", { length: S.Finite });
  const decode = S.decodeUnknownEffect(LongerThan);
  const expectLeafWire = expectWire(LongerThan);
  const longerThanThree = (property: PropertySelector) => LongerThan.make({ property, length: 3 });

  lawful("PropertyAddressed", LongerThan);

  it.effect(
    "reads either wire key into the one property selector",
    Effect.fnUntraced(function* () {
      const byField = yield* decode({ type: "longerThan", field: "title", length: 3 });
      const byIdentifier = yield* decode({
        type: "longerThan",
        propertyIdentifier: { type: "titleProperty" },
        length: 3,
      });
      deepStrictEqual(byField, { type: "longerThan", property: named("title"), length: 3 });
      deepStrictEqual(byIdentifier, { type: "longerThan", property: TitleProperty.make({}), length: 3 });
    })
  );

  it.effect(
    "writes the compact key for a selector by name and the record for every other selector",
    Effect.fnUntraced(function* () {
      yield* expectLeafWire(longerThanThree(named("title")), { type: "longerThan", field: "title", length: 3 });
      yield* expectLeafWire(longerThanThree(zipOfAddress), {
        type: "longerThan",
        propertyIdentifier: { type: "structField", propertyApiName: "address", structFieldApiName: "zip" },
        length: 3,
      });
      yield* expectLeafWire(longerThanThree(PrimaryKeyProperty.make({})), {
        type: "longerThan",
        propertyIdentifier: { type: "primaryKeyProperty" },
        length: 3,
      });
      yield* expectLeafWire(
        longerThanThree(PropertyAtLoadLevel.make({ selector: named("title"), loadLevel: "applyReducers" })),
        {
          type: "longerThan",
          propertyIdentifier: {
            type: "propertyWithLoadLevel",
            propertyIdentifier: { type: "property", apiName: "title" },
            loadLevel: { type: "applyReducers" },
          },
          length: 3,
        }
      );
    })
  );

  it.effect(
    "compacts the long spelling of a selector by name to the bare field",
    Effect.fnUntraced(function* () {
      const decoded = yield* decode({
        type: "longerThan",
        propertyIdentifier: { type: "property", apiName: "title" },
        length: 3,
      });
      yield* expectLeafWire(decoded, { type: "longerThan", field: "title", length: 3 });
    })
  );

  it.effect(
    "fails with a clear issue when both keys or neither key address the property",
    Effect.fnUntraced(function* () {
      const failure = failureMessage(LongerThan);
      const both = yield* failure({
        type: "longerThan",
        field: "title",
        propertyIdentifier: { type: "titleProperty" },
        length: 3,
      });
      const neither = yield* failure({ type: "longerThan", length: 3 });
      assertTrue(Str.includes('Expected exactly one of "field" and "propertyIdentifier"')(both));
      assertTrue(Str.includes("got both")(both));
      assertTrue(Str.includes("got neither")(neither));
    })
  );

  it.effect(
    "still validates the payload and the selector",
    Effect.fnUntraced(function* () {
      yield* expectRejected(LongerThan)([
        { type: "longerThan", field: "title", length: "3" },
        { type: "longerThan", field: "title" },
        { type: "longerThan", field: "", length: 3 },
        { type: "longerThan", field: 7, length: 3 },
        { type: "longerThan", propertyIdentifier: { type: "column" }, length: 3 },
        { type: "longerThan", propertyIdentifier: "title", length: 3 },
        { type: "shorterThan", field: "title", length: 3 },
        { type: "longerThan", property: { type: "property", apiName: "title" }, length: 3 },
      ]);
    })
  );

  it("is a plain tagged struct on the domain side, in both call shapes", () => {
    const dataLast = pipe("longerThan", PropertyAddressed({ length: S.Finite }));
    const value = dataLast.make({ property: named("title"), length: 3 });
    strictEqual(value.type, "longerThan");
    assertTrue(S.is(LongerThan)(value));
    assertFalse(S.is(LongerThan)({ type: "longerThan", field: "title", length: 3 }));
  });
});

// ---------------------------------------------------------------------------
// The filter union
// ---------------------------------------------------------------------------

describe("ObjectFilter members", () => {
  lawful("LessThan", LessThan);
  lawful("GreaterThan", GreaterThan);
  lawful("LessThanOrEqual", LessThanOrEqual);
  lawful("GreaterThanOrEqual", GreaterThanOrEqual);
  lawful("Equals", Equals);
  lawful("OneOf", OneOf);
  lawful("IsNull", IsNull);
  lawful("Contains", Contains);
  lawful("StartsWith", StartsWith);
  lawful("MatchesWildcard", MatchesWildcard);
  lawful("MatchesRegex", MatchesRegex);
  lawful("ContainsAnyTerm", ContainsAnyTerm);
  lawful("ContainsAllTerms", ContainsAllTerms);
  lawful("ContainsAllTermsInOrder", ContainsAllTermsInOrder);
  lawful("ContainsAllTermsInOrderPrefixLastTerm", ContainsAllTermsInOrderPrefixLastTerm);
  lawful("MatchesInterval", MatchesInterval);
  lawful("InRelativeDateRange", InRelativeDateRange);
  lawful("WithinDistance", WithinDistance);
  lawful("WithinBoundingBox", WithinBoundingBox);
  lawful("WithinPolygon", WithinPolygon);
  lawful("IntersectsBoundingBox", IntersectsBoundingBox);
  lawful("IntersectsPolygon", IntersectsPolygon);
  lawful("DoesNotIntersectBoundingBox", DoesNotIntersectBoundingBox);
  lawful("DoesNotIntersectPolygon", DoesNotIntersectPolygon);
  lawful("RelatesToGeometry", RelatesToGeometry);
  lawful("And", And);
  lawful("Or", Or);
  lawful("Not", Not);
  lawful("PropertyFilter", PropertyFilter);
  lawful("ObjectFilter", ObjectFilter);
});

describe("ObjectFilter wire fixtures", () => {
  const fixtures: ReadonlyArray<{
    readonly name: string;
    readonly wire: ObjectFilter.Encoded;
    readonly domain: ObjectFilter;
  }> = [
    {
      name: "eq on a bare field",
      wire: { type: "eq", field: "fullName", value: "Ishmael" },
      domain: eq("fullName", "Ishmael"),
    },
    {
      name: "not wrapping eq, the wire's only spelling of not-equals",
      wire: { type: "not", value: { type: "eq", field: "status", value: "archived" } },
      domain: ne("status", "archived"),
    },
    {
      name: "lt on an array property, the erased form of an element filter",
      wire: { type: "lt", field: "scores", value: 5 },
      domain: lt("scores", 5),
    },
    {
      name: "gt on a struct field through a property identifier",
      wire: {
        type: "gt",
        propertyIdentifier: { type: "structField", propertyApiName: "address", structFieldApiName: "zip" },
        value: 98000,
      },
      domain: gt(zipOfAddress, 98000),
    },
    {
      name: "lte and gte with fractional numbers",
      wire: {
        type: "and",
        value: [
          { type: "gte", field: "price", value: 0.5 },
          { type: "lte", field: "price", value: 9.99 },
        ],
      },
      domain: and(gte("price", 0.5), lte("price", 9.99)),
    },
    {
      name: "in with several values",
      wire: { type: "in", field: "office", value: ["Seattle", "Boston"] },
      domain: oneOf("office", ["Seattle", "Boston"]),
    },
    {
      name: "in with no values",
      wire: { type: "in", field: "office", value: [] },
      domain: oneOf("office", []),
    },
    {
      name: "isNull on the primary key",
      wire: { type: "isNull", propertyIdentifier: { type: "primaryKeyProperty" }, value: false },
      domain: isNotNull(PrimaryKeyProperty.make({})),
    },
    {
      name: "contains on an array property",
      wire: { type: "contains", field: "tags", value: "urgent" },
      domain: contains("tags", "urgent"),
    },
    {
      name: "startsWith with the phonetic analyzer",
      wire: { type: "startsWith", field: "fullName", analyzerSelection: "PHONETIC_ANALYZER", value: "jon" },
      domain: StartsWith.make({ property: named("fullName"), value: "jon", analyzerSelection: O.some("phoneticAnalyzer") }),
    },
    {
      name: "containsAnyTerm with fuzzy written out as false",
      wire: { type: "containsAnyTerm", field: "bio", value: "whale harpoon", fuzzy: false },
      domain: ContainsAnyTerm.make({ property: named("bio"), value: "whale harpoon", fuzzy: O.some(false) }),
    },
    {
      name: "containsAllTerms with fuzzy matching on the title",
      wire: {
        type: "containsAllTerms",
        propertyIdentifier: { type: "titleProperty" },
        value: "white whale",
        fuzzy: true,
      },
      domain: ContainsAllTerms.make({ property: TitleProperty.make({}), value: "white whale", fuzzy: O.some(true) }),
    },
    {
      name: "containsAllTermsInOrder",
      wire: { type: "containsAllTermsInOrder", field: "bio", value: "call me Ishmael" },
      domain: containsAllTermsInOrder("bio", "call me Ishmael"),
    },
    {
      name: "containsAllTermsInOrderPrefixLastTerm",
      wire: { type: "containsAllTermsInOrderPrefixLastTerm", field: "bio", value: "call me Ish" },
      domain: containsAllTermsInOrderPrefixLastTerm("bio", "call me Ish"),
    },
    {
      name: "wildcard",
      wire: { type: "wildcard", field: "serial", value: "PQ-*" },
      domain: matchesWildcard("serial", "PQ-*"),
    },
    {
      name: "regex",
      wire: { type: "regex", field: "serial", value: "PQ-[0-9]{4}" },
      domain: matchesRegex("serial", "PQ-[0-9]{4}"),
    },
    {
      name: "interval with a nested rule, keyed rule rather than value",
      wire: {
        type: "interval",
        field: "bio",
        rule: {
          type: "allOf",
          rules: [
            { type: "match", query: "quick brown", ordered: true },
            {
              type: "anyOf",
              rules: [
                { type: "fuzzy", term: "fox", fuzziness: 1 },
                { type: "prefixOnLastToken", query: "lazy do" },
              ],
            },
          ],
          ordered: false,
          maxGaps: 2,
        },
      },
      domain: matchesInterval("bio", nearby),
    },
    {
      name: "relativeDateRange with one open side",
      wire: {
        type: "relativeDateRange",
        field: "hireDate",
        relativeStartTime: { type: "relativePoint", value: -7, timeUnit: "DAY" },
        timeZoneId: "America/New_York",
      },
      domain: inRelativeDateRange("hireDate", lastWeek),
    },
    {
      name: "withinDistanceOf",
      wire: {
        type: "withinDistanceOf",
        field: "location",
        value: {
          center: { type: "Point", coordinates: [-122.33, 47.61] },
          distance: { value: 5, unit: "KILOMETERS" },
        },
      },
      domain: withinDistance("location", downtown),
    },
    {
      name: "withinBoundingBox with top-left and bottom-right corners",
      wire: { type: "withinBoundingBox", field: "location", value: seattleBoxWire },
      domain: withinBoundingBox("location", seattleBox),
    },
    {
      name: "withinPolygon",
      wire: { type: "withinPolygon", field: "location", value: triangleWire },
      domain: withinPolygon("location", triangle),
    },
    {
      name: "intersectsBoundingBox",
      wire: { type: "intersectsBoundingBox", field: "route", value: seattleBoxWire },
      domain: intersectsBoundingBox("route", seattleBox),
    },
    {
      name: "intersectsPolygon",
      wire: { type: "intersectsPolygon", field: "route", value: triangleWire },
      domain: intersectsPolygon("route", triangle),
    },
    {
      name: "doesNotIntersectBoundingBox",
      wire: { type: "doesNotIntersectBoundingBox", field: "route", value: seattleBoxWire },
      domain: doesNotIntersectBoundingBox("route", seattleBox),
    },
    {
      name: "doesNotIntersectPolygon",
      wire: { type: "doesNotIntersectPolygon", field: "route", value: triangleWire },
      domain: doesNotIntersectPolygon("route", triangle),
    },
    {
      name: "geoShapeV2 with an envelope",
      wire: {
        type: "geoShapeV2",
        field: "region",
        geometry: { type: "envelope", ...seattleBoxWire },
        spatialFilterMode: "INTERSECTS",
      },
      domain: relatesToGeometry(
        "region",
        EnvelopeGeometry.make({ topLeft: seattleBox.topLeft, bottomRight: seattleBox.bottomRight }),
        "intersects"
      ),
    },
    {
      name: "geoShapeV2 with GeoJSON text",
      wire: {
        type: "geoShapeV2",
        field: "region",
        geometry: { type: "geoJson", geoJson: '{"type":"Point","coordinates":[1,2]}' },
        spatialFilterMode: "CONTAINS",
      },
      domain: relatesToGeometry(
        "region",
        GeoJsonGeometry.make({ geoJson: GeoPoint.make({ coordinates: [1, 2] }) }),
        "contains"
      ),
    },
    {
      name: "or of and, with a load-level selector and an empty and",
      wire: {
        type: "or",
        value: [
          {
            type: "and",
            value: [
              { type: "gte", field: "age", value: 21 },
              {
                type: "isNull",
                propertyIdentifier: {
                  type: "propertyWithLoadLevel",
                  propertyIdentifier: { type: "property", apiName: "tags" },
                  loadLevel: { type: "applyReducers" },
                },
                value: true,
              },
            ],
          },
          { type: "and", value: [] },
        ],
      },
      domain: or(
        and(gte("age", 21), isNull(PropertyAtLoadLevel.make({ selector: named("tags"), loadLevel: "applyReducers" }))),
        every([])
      ),
    },
  ];

  A.forEach(fixtures, ({ name, wire, domain }) => {
    it.effect(
      `${name}: decodes to the domain value and encodes back to the exact wire value`,
      Effect.fnUntraced(function* () {
        yield* filterFixture(wire, domain);
      })
    );
  });

  it("keeps the hand-written encoded types of the recursive unions in step with the schemas", () => {
    // Each identity function compiles only if the two types are assignable in that direction.
    const filterToSchema = (wire: ObjectFilter.Encoded): typeof ObjectFilter.Encoded => wire;
    const filterFromSchema = (wire: typeof ObjectFilter.Encoded): ObjectFilter.Encoded => wire;
    const ruleToSchema = (wire: IntervalRule.Encoded): typeof IntervalRule.Encoded => wire;
    const ruleFromSchema = (wire: typeof IntervalRule.Encoded): IntervalRule.Encoded => wire;
    const filter: ObjectFilter.Encoded = { type: "not", value: { type: "isNull", field: "manager", value: true } };
    const rule: IntervalRule.Encoded = { type: "anyOf", rules: [{ type: "fuzzy", term: "fox" }] };
    strictEqual(filterFromSchema(filterToSchema(filter)), filter);
    strictEqual(ruleFromSchema(ruleToSchema(rule)), rule);
  });

  it("covers every one of the 28 wire members", () => {
    const collect = (wire: ObjectFilter.Encoded): ReadonlyArray<string> =>
      wire.type === "and" || wire.type === "or"
        ? A.prepend(A.flatMap(wire.value, collect), wire.type)
        : wire.type === "not"
          ? A.prepend(collect(wire.value), wire.type)
          : A.of(wire.type);
    const covered = A.dedupe(A.flatMap(fixtures, ({ wire }) => collect(wire)));
    deepStrictEqual<ReadonlyArray<string>>(A.difference(ObjectFilter.discriminants, covered), []);
    strictEqual(ObjectFilter.discriminants.length, 28);
  });

  // The filter holds the wire scalar. A rich operand enters through the operand codec of its property's type, which
  // writes the one canonical spelling, and leaves through the same codec.
  it.effect(
    "holds each rich operand as the wire scalar its property's codec writes, and round-trips exactly",
    Effect.fnUntraced(function* () {
      const long = operandCodec(LongType.make({}));
      const decimal = operandCodec(DecimalType.make({}));
      const date = operandCodec(DateType.make({}));
      const timestamp = operandCodec(TimestampType.make({}));
      const hiredOn = yield* S.decodeEffect(DateValue)("2021-01-04");
      const employeeId = yield* S.encodeEffect(long)(BigInt("58319870951433"));
      const salary = yield* S.encodeEffect(decimal)(BigDecimal.fromStringUnsafe("12.50"));
      const hireDate = yield* S.encodeEffect(date)(hiredOn);
      const updatedAt = yield* S.encodeEffect(timestamp)(DateTime.makeUnsafe("2021-01-04T05:00:00Z"));
      const filter = every([
        eq("employeeId", employeeId),
        lt("salary", salary),
        gte("hireDate", hireDate),
        gt("updatedAt", updatedAt),
      ]);
      const wire = yield* encodeFilter(filter);
      deepStrictEqual(wire, {
        type: "and",
        value: [
          { type: "eq", field: "employeeId", value: "58319870951433" },
          // A decimal operand keeps the scale it was given.
          { type: "lt", field: "salary", value: "12.50" },
          { type: "gte", field: "hireDate", value: "2021-01-04" },
          { type: "gt", field: "updatedAt", value: "2021-01-04T05:00:00.000Z" },
        ],
      });
      const decoded = yield* decodeFilter(wire);
      // The strict law on a fixture: the decoded filter is the filter that was encoded.
      assertTrue(sameFilter(decoded, filter));
      assertTrue(
        sameFilter(
          decoded,
          every([
            eq("employeeId", "58319870951433"),
            lt("salary", "12.50"),
            gte("hireDate", "2021-01-04"),
            gt("updatedAt", "2021-01-04T05:00:00.000Z"),
          ])
        )
      );
      // And the rich values are one decode away, each through the codec that wrote it.
      const longBack = yield* S.decodeEffect(long)(employeeId);
      const decimalBack = yield* S.decodeEffect(decimal)(salary);
      const dateBack = yield* S.decodeEffect(date)(hireDate);
      const instantBack = yield* S.decodeEffect(timestamp)(updatedAt);
      strictEqual(longBack, BigInt("58319870951433"));
      // "12.50" and "12.5" are one decimal.
      assertTrue(S.toEquivalence(decimal)(decimalBack, BigDecimal.fromStringUnsafe("12.5")));
      assertTrue(S.toEquivalence(date)(dateBack, hiredOn));
      assertTrue(S.toEquivalence(timestamp)(instantBack, DateTime.makeUnsafe("2021-01-04T05:00:00Z")));
    })
  );

  it.effect(
    "refuses a rich value where the wire scalar is expected: at compile time, in a constructor and on decode",
    Effect.fnUntraced(function* () {
      const hiredOn = yield* S.decodeEffect(DateValue)("2021-01-04");
      const rich: ReadonlyArray<unknown> = [
        BigInt("58319870951433"),
        BigDecimal.fromStringUnsafe("12.50"),
        hiredOn,
        DateTime.makeUnsafe("2021-01-04T05:00:00Z"),
      ];
      const builds = [
        // @ts-expect-error a 64-bit integer operand is the text it travels as
        () => eq("employeeId", BigInt("58319870951433")),
        // @ts-expect-error a decimal operand is the text it travels as
        () => lt("salary", BigDecimal.fromStringUnsafe("12.50")),
        // @ts-expect-error a date operand is the text it travels as
        () => gte("hireDate", hiredOn),
        // @ts-expect-error an instant operand is the text it travels as
        () => gt("updatedAt", DateTime.makeUnsafe("2021-01-04T05:00:00Z")),
        // @ts-expect-error a list of operands holds wire scalars only
        () => oneOf("employeeId", [1, BigInt(2)]),
        // @ts-expect-error an element operand is a wire scalar too
        () => contains("badges", BigInt(7)),
      ];
      A.forEach(builds, (build) => throws(build));
      yield* rejectsFilters(A.map(rich, (value) => ({ type: "eq", field: "subject", value })));
      yield* rejectsFilters(A.map(rich, (value) => ({ type: "in", field: "subject", value: [1, value] })));
      yield* rejectsFilters(A.map(rich, (value) => ({ type: "contains", field: "subject", value })));
    })
  );
});

describe("ObjectFilter cases and invariants", () => {
  const property = named("subject");
  const samples: ReadonlyArray<ObjectFilter> = [
    ObjectFilter.cases.lt.make({ property, value: 1 }),
    ObjectFilter.cases.gt.make({ property, value: 1 }),
    ObjectFilter.cases.lte.make({ property, value: 1 }),
    ObjectFilter.cases.gte.make({ property, value: 1 }),
    ObjectFilter.cases.eq.make({ property, value: true }),
    ObjectFilter.cases.in.make({ property, value: ["a", "b"] }),
    ObjectFilter.cases.isNull.make({ property, value: true }),
    ObjectFilter.cases.contains.make({ property, value: "a" }),
    ObjectFilter.cases.startsWith.make({ property, value: "a" }),
    ObjectFilter.cases.wildcard.make({ property, value: "a*" }),
    ObjectFilter.cases.regex.make({ property, value: "a+" }),
    ObjectFilter.cases.containsAnyTerm.make({ property, value: "a b" }),
    ObjectFilter.cases.containsAllTerms.make({ property, value: "a b" }),
    ObjectFilter.cases.containsAllTermsInOrder.make({ property, value: "a b" }),
    ObjectFilter.cases.containsAllTermsInOrderPrefixLastTerm.make({ property, value: "a b" }),
    ObjectFilter.cases.interval.make({ property, rule: quick }),
    ObjectFilter.cases.relativeDateRange.make({ property, timeZoneId: "UTC" }),
    ObjectFilter.cases.withinDistanceOf.make({ property, value: downtown }),
    ObjectFilter.cases.withinBoundingBox.make({ property, value: seattleBox }),
    ObjectFilter.cases.withinPolygon.make({ property, value: triangle }),
    ObjectFilter.cases.intersectsBoundingBox.make({ property, value: seattleBox }),
    ObjectFilter.cases.intersectsPolygon.make({ property, value: triangle }),
    ObjectFilter.cases.doesNotIntersectBoundingBox.make({ property, value: seattleBox }),
    ObjectFilter.cases.doesNotIntersectPolygon.make({ property, value: triangle }),
    ObjectFilter.cases.geoShapeV2.make({
      property,
      geometry: GeoJsonGeometry.make({ geoJson: triangle }),
      spatialFilterMode: "within",
    }),
    ObjectFilter.cases.and.make({ filters: [eq("a", 1)] }),
    ObjectFilter.cases.or.make({ filters: [eq("a", 1)] }),
    ObjectFilter.cases.not.make({ filter: eq("a", 1) }),
  ];

  const tagOf: (filter: ObjectFilter) => string = ObjectFilter.match({
    lt: () => "lt",
    gt: () => "gt",
    lte: () => "lte",
    gte: () => "gte",
    eq: () => "eq",
    in: () => "in",
    isNull: () => "isNull",
    contains: () => "contains",
    startsWith: () => "startsWith",
    wildcard: () => "wildcard",
    regex: () => "regex",
    containsAnyTerm: () => "containsAnyTerm",
    containsAllTerms: () => "containsAllTerms",
    containsAllTermsInOrder: () => "containsAllTermsInOrder",
    containsAllTermsInOrderPrefixLastTerm: () => "containsAllTermsInOrderPrefixLastTerm",
    interval: () => "interval",
    relativeDateRange: () => "relativeDateRange",
    withinDistanceOf: () => "withinDistanceOf",
    withinBoundingBox: () => "withinBoundingBox",
    withinPolygon: () => "withinPolygon",
    intersectsBoundingBox: () => "intersectsBoundingBox",
    intersectsPolygon: () => "intersectsPolygon",
    doesNotIntersectBoundingBox: () => "doesNotIntersectBoundingBox",
    doesNotIntersectPolygon: () => "doesNotIntersectPolygon",
    geoShapeV2: () => "geoShapeV2",
    and: () => "and",
    or: () => "or",
    not: () => "not",
  });

  it("discriminates the transformed members on the domain side: cases, match and guards agree", () => {
    deepStrictEqual<ReadonlyArray<string>>(A.map(samples, tagOf), ObjectFilter.discriminants);
    assertTrue(A.every(samples, S.is(ObjectFilter)));
    assertTrue(A.every(samples, (sample) => ObjectFilter.guards[sample.type](sample)));
    assertFalse(ObjectFilter.guards.gt(eq("a", 1)));
    strictEqual(ObjectFilter.cases.eq, Equals);
    strictEqual(ObjectFilter.cases.and, And);
    strictEqual(ObjectFilter.tag, "type");
  });

  it("separates property tests from combinators", () => {
    const isLogical = ObjectFilter.isAnyOf(["and", "or", "not"]);
    const isLeaf = S.is(PropertyFilter);
    deepStrictEqual(
      A.map(samples, (sample) => isLeaf(sample) !== isLogical(sample)),
      A.map(samples, () => true)
    );
    deepStrictEqual<ReadonlyArray<string>>(
      A.appendAll(PropertyFilter.discriminants, ["and", "or", "not"]),
      ObjectFilter.discriminants
    );
  });

  it.effect(
    "every case encodes to a wire record with the same tag and decodes back",
    Effect.fnUntraced(function* () {
      const wires = yield* Effect.forEach(samples, (sample) => encodeFilter(sample));
      deepStrictEqual<ReadonlyArray<string>>(
        A.map(wires, (wire) => wire.type),
        ObjectFilter.discriminants
      );
      const decoded = yield* Effect.forEach(wires, (wire) => decodeFilter(wire));
      assertTrue(A.every(A.zip(decoded, samples), ([left, right]) => sameFilter(left, right)));
    })
  );

  it("fills absent options with none and the tag with its literal", () => {
    const terms = ContainsAnyTerm.make({ property, value: "a b" });
    assertNone(terms.fuzzy);
    assertNone(terms.analyzerSelection);
    strictEqual(terms.type, "containsAnyTerm");
    const range = InRelativeDateRange.make({ property, timeZoneId: "UTC" });
    assertNone(range.relativeStartTime);
    assertNone(range.relativeEndTime);
  });

  it.effect(
    "addresses a property with exactly one of field and propertyIdentifier",
    Effect.fnUntraced(function* () {
      const both = yield* filterFailure({
        type: "eq",
        field: "fullName",
        propertyIdentifier: { type: "titleProperty" },
        value: "Ishmael",
      });
      const neither = yield* filterFailure({ type: "isNull", value: true });
      assertTrue(Str.includes("got both")(both));
      assertTrue(Str.includes("got neither")(neither));
      yield* acceptsFilters([
        { type: "eq", field: "fullName", value: "Ishmael" },
        { type: "eq", propertyIdentifier: { type: "titleProperty" }, value: "Ishmael" },
      ]);
    })
  );

  it.effect(
    "rejects fuzzy matching on the phonetic index, in both directions",
    Effect.fnUntraced(function* () {
      const wire = { type: "containsAnyTerm", field: "fullName", analyzerSelection: "PHONETIC_ANALYZER", value: "jon" };
      yield* rejectsFilters([
        { ...wire, fuzzy: true },
        { ...wire, type: "containsAllTerms", fuzzy: true },
      ]);
      yield* acceptsFilters([
        wire,
        { ...wire, fuzzy: false },
        { ...wire, analyzerSelection: "BASE_ANALYZER", fuzzy: true },
        { type: "containsAnyTerm", field: "fullName", value: "jon", fuzzy: true },
      ]);
      assertNone(
        ContainsAllTerms.makeOption({
          property,
          value: "jon",
          analyzerSelection: O.some("phoneticAnalyzer"),
          fuzzy: O.some(true),
        })
      );
      const message = yield* filterFailure({ ...wire, fuzzy: true });
      assertTrue(Str.includes("Fuzzy matching cannot be combined with the phonetic analyzer")(message));
    })
  );

  it.effect(
    "rejects wire values outside the 28 members and malformed payloads",
    Effect.fnUntraced(function* () {
      yield* rejectsFilters([
        { type: "ne", field: "status", value: "archived" },
        { type: "prefix", field: "status", value: "arch" },
        { type: "eq", field: "status" },
        { type: "eq", field: "status", value: null },
        { type: "eq", field: "status", value: { nested: true } },
        { type: "in", field: "status", value: "archived" },
        { type: "isNull", field: "status", value: "true" },
        { type: "startsWith", field: "status", value: 1 },
        { type: "interval", field: "bio", value: "quick" },
        { type: "and", value: { type: "eq", field: "a", value: 1 } },
        { type: "not", value: [{ type: "eq", field: "a", value: 1 }] },
        { type: "and", filters: [] },
        {
          type: "withinPolygon",
          field: "location",
          value: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [4, 0],
                [0, 3],
              ],
            ],
          },
        },
        {
          type: "geoShapeV2",
          field: "region",
          geometry: { type: "envelope", ...seattleBoxWire },
          spatialFilterMode: "TOUCHES",
        },
      ]);
    })
  );

  it.effect(
    "reports a nested failure at its place in the tree",
    Effect.fnUntraced(function* () {
      const message = yield* filterFailure({
        type: "and",
        value: [
          { type: "eq", field: "a", value: 1 },
          { type: "not", value: { type: "gt", value: 2 } },
        ],
      });
      // The path is spelled with the domain keys: the combinators rename the wire's `value`.
      assertTrue(Str.includes("got neither")(message));
      assertTrue(Str.includes('at ["filters"][1]["filter"]')(message));
    })
  );
});

// ---------------------------------------------------------------------------
// Constructors and the fold
// ---------------------------------------------------------------------------

describe("constructors", () => {
  it("accepts a bare name or any selector for the property", () => {
    deepStrictEqual(toSelector("age"), named("age"));
    strictEqual(toSelector(zipOfAddress), zipOfAddress);
    assertTrue(sameFilter(eq(named("age"), 30), eq("age", 30)));
    strictEqual(gt(TitleProperty.make({}), "M").property.type, "titleProperty");
  });

  it("builds the same filter data-first and data-last", () => {
    const pairs: ReadonlyArray<readonly [ObjectFilter, ObjectFilter]> = [
      [lt("age", 65), pipe("age", lt(65))],
      [gt("age", 21), pipe("age", gt(21))],
      [lte("age", 65), pipe("age", lte(65))],
      [gte("age", 21), pipe("age", gte(21))],
      [eq("age", 30), pipe("age", eq(30))],
      [ne("age", 30), pipe("age", ne(30))],
      [oneOf("age", [30, 31]), pipe("age", oneOf([30, 31]))],
      [contains("tags", "urgent"), pipe("tags", contains("urgent"))],
      [startsWith("bio", "call me"), pipe("bio", startsWith("call me"))],
      [matchesWildcard("bio", "call*"), pipe("bio", matchesWildcard("call*"))],
      [matchesRegex("bio", "call.+"), pipe("bio", matchesRegex("call.+"))],
      [containsAnyTerm("bio", "call me"), pipe("bio", containsAnyTerm("call me"))],
      [containsAllTerms("bio", "call me"), pipe("bio", containsAllTerms("call me"))],
      [containsAllTermsInOrder("bio", "call me"), pipe("bio", containsAllTermsInOrder("call me"))],
      [
        containsAllTermsInOrderPrefixLastTerm("bio", "call m"),
        pipe("bio", containsAllTermsInOrderPrefixLastTerm("call m")),
      ],
      [matchesInterval("bio", quick), pipe("bio", matchesInterval(quick))],
      [inRelativeDateRange("hireDate", lastWeek), pipe("hireDate", inRelativeDateRange(lastWeek))],
      [withinDistance("location", downtown), pipe("location", withinDistance(downtown))],
      [withinBoundingBox("location", seattleBox), pipe("location", withinBoundingBox(seattleBox))],
      [withinPolygon("location", triangle), pipe("location", withinPolygon(triangle))],
      [intersectsBoundingBox("route", seattleBox), pipe("route", intersectsBoundingBox(seattleBox))],
      [intersectsPolygon("route", triangle), pipe("route", intersectsPolygon(triangle))],
      [doesNotIntersectBoundingBox("route", seattleBox), pipe("route", doesNotIntersectBoundingBox(seattleBox))],
      [doesNotIntersectPolygon("route", triangle), pipe("route", doesNotIntersectPolygon(triangle))],
      [
        relatesToGeometry("region", GeoJsonGeometry.make({ geoJson: triangle }), "within"),
        pipe("region", relatesToGeometry(GeoJsonGeometry.make({ geoJson: triangle }), "within")),
      ],
      [and(eq("a", 1), eq("b", 2)), pipe(eq("a", 1), and(eq("b", 2)))],
      [or(eq("a", 1), eq("b", 2)), pipe(eq("a", 1), or(eq("b", 2)))],
    ];
    assertTrue(A.every(pairs, ([dataFirst, dataLast]) => sameFilter(dataFirst, dataLast)));
    deepStrictEqual(
      A.map(pairs, ([dataFirst]) => dataFirst.type),
      [
        "lt",
        "gt",
        "lte",
        "gte",
        "eq",
        "not",
        "in",
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
      ]
    );
  });

  it("spells not-equals as the negation of an equality", () => {
    assertTrue(sameFilter(ne("status", "archived"), not(eq("status", "archived"))));
    assertTrue(sameFilter(isNotNull("manager"), IsNull.make({ property: named("manager"), value: false })));
    assertTrue(isNull("manager").value);
  });

  it("appends to an existing conjunction or disjunction instead of nesting", () => {
    const a = eq("a", 1);
    const b = eq("b", 2);
    const c = eq("c", 3);
    assertTrue(sameFilter(pipe(a, and(b), and(c)), every([a, b, c])));
    assertTrue(sameFilter(pipe(a, or(b), or(c)), some([a, b, c])));
    assertTrue(sameFilter(pipe(a, or(b), and(c)), every([some([a, b]), c])));
    assertTrue(sameFilter(and(a, every([b, c])), every([a, every([b, c])])));
    strictEqual(not(not(a)).filter.type, "not");
  });

  it.prop(
    "folding a filter with its own constructors rebuilds it",
    [Arbitrary.schema(ObjectFilter)],
    ([filter]) =>
      sameFilter(foldFilter(filter, { property: (leaf): ObjectFilter => leaf, and: every, or: some, not }), filter),
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "lists one selector per property test, in both call shapes",
    [Arbitrary.schema(ObjectFilter)],
    ([filter]) => {
      const count = (counts: ReadonlyArray<number>): number => A.reduce(counts, 0, (total, each) => total + each);
      const tests = pipe(filter, foldFilter({ property: () => 1, and: count, or: count, not: identity }));
      return selectorsOf(filter).length === tests;
    },
    { arbitrary: fcRuns(50) }
  );

  it("lists selectors in the order their tests appear", () => {
    const filter = every([gt("age", 21), some([ne("office", "Boston"), isNull(zipOfAddress)]), eq("age", 30)]);
    deepStrictEqual(selectorsOf(filter), [named("age"), named("office"), zipOfAddress, named("age")]);
  });
});

// ---------------------------------------------------------------------------
// Operator and operand tables
// ---------------------------------------------------------------------------

describe("operator tables", () => {
  lawful("FilterOperator", FilterOperator);
  lawful("PropertyOperator", PropertyOperator);
  lawful("ComparisonOperator", ComparisonOperator);
  lawful("MembershipOperator", MembershipOperator);
  lawful("TextOperator", TextOperator);
  lawful("TemporalOperator", TemporalOperator);
  lawful("GeoOperator", GeoOperator);
  lawful("LogicalOperator", LogicalOperator);
  lawful("OperandFamily", OperandFamily);

  it("derives the operator vocabulary from the union and partitions it into families", () => {
    deepStrictEqual<ReadonlyArray<string>>(FilterOperator.literals, ObjectFilter.discriminants);
    deepStrictEqual<ReadonlyArray<string>>(PropertyOperator.literals, PropertyFilter.discriminants);
    const families: ReadonlyArray<ReadonlyArray<FilterOperator>> = [
      ComparisonOperator.literals,
      MembershipOperator.literals,
      TextOperator.literals,
      TemporalOperator.literals,
      GeoOperator.literals,
      LogicalOperator.literals,
    ];
    const all = A.flatten(families);
    strictEqual(all.length, 28);
    deepStrictEqual<ReadonlyArray<string>>(A.difference(FilterOperator.literals, all), []);
    strictEqual(A.dedupe(all).length, 28);
  });

  it("has a row for every property type tag in both tables", () => {
    deepStrictEqual<ReadonlyArray<string>>(A.difference(PropertyTypeKind.literals, R.keys(allowedOperators)), []);
    deepStrictEqual<ReadonlyArray<string>>(A.difference(PropertyTypeKind.literals, R.keys(allowedOperands)), []);
    strictEqual(R.size(allowedOperators), PropertyTypeKind.literals.length);
    strictEqual(R.size(allowedOperands), PropertyTypeKind.literals.length);
    const isPropertyOperator = S.is(PropertyOperator);
    assertTrue(A.every(A.flatten(R.values(allowedOperators)), isPropertyOperator));
    assertTrue(A.every(R.values(allowedOperators), (row) => A.contains(row, "isNull")));
  });

  it("treats short and long as numeric: the orderings, and for long an operand that travels as text", () => {
    deepStrictEqual(allowedOperators.short, allowedOperators.integer);
    deepStrictEqual(allowedOperators.long, allowedOperators.integer);
    deepStrictEqual(allowedOperators.integer, ["eq", "in", "isNull", "lt", "gt", "lte", "gte"]);
    deepStrictEqual(allowedOperands.short, ["number"]);
    deepStrictEqual(allowedOperands.long, ["text", "number"]);
    deepStrictEqual(allowedOperands.decimal, allowedOperands.long);
    deepStrictEqual(allowedOperands.date, ["text"]);
    deepStrictEqual(allowedOperands.timestamp, ["text"]);
    assertTrue(A.every(NumericKind.literals, (kind) => allowedOperators[kind] === allowedOperators.integer));
    assertTrue(A.every(TemporalKind.literals, (kind) => allowedOperators[kind] === allowedOperators.date));
    assertTrue(A.every(GeospatialKind.literals, (kind) => allowedOperators[kind] === allowedOperators.geopoint));
  });

  it("gives each family of types the operators the wire documents for it", () => {
    deepStrictEqual(allowedOperators.boolean, ["eq", "in", "isNull"]);
    deepStrictEqual<ReadonlyArray<string>>(
      A.difference(allowedOperators.string, allowedOperators.integer),
      TextOperator.literals
    );
    deepStrictEqual(A.difference(allowedOperators.date, allowedOperators.integer), ["relativeDateRange"]);
    deepStrictEqual(allowedOperators.timestamp, allowedOperators.date);
    deepStrictEqual(allowedOperators.geopoint, A.prepend(GeoOperator.literals, "isNull"));
    deepStrictEqual(allowedOperators.geoshape, allowedOperators.geopoint);
    deepStrictEqual(allowedOperators.array, ["contains", "isNull"]);
    deepStrictEqual(allowedOperators.struct, ["isNull"]);
    deepStrictEqual(allowedOperators.vector, ["eq", "in", "isNull"]);
  });

  it("looks through arrays to the operators and operands of their elements", () => {
    const integers = ArrayType.make({ elementType: IntegerType.make({}) });
    const nested = ArrayType.make({ elementType: ArrayType.make({ elementType: StringType.make({}) }) });
    deepStrictEqual(operatorsOf(integers), ["contains", "isNull", "eq", "in", "lt", "gt", "lte", "gte"]);
    deepStrictEqual(operatorsOf(IntegerType.make({})), allowedOperators.integer);
    assertTrue(A.contains(operatorsOf(nested), "regex"));
    deepStrictEqual(operandsOf(integers), ["number"]);
    deepStrictEqual(operandsOf(nested), ["text"]);
    deepStrictEqual(operandsOf(GeoPointType.make({})), []);
  });

  it("classifies every JSON form of a wire operand, and a rich spelling as the text it is", () => {
    deepStrictEqual<ReadonlyArray<string>>(
      [operandFamily("Ishmael"), operandFamily(3.5), operandFamily(false)],
      OperandFamily.literals
    );
    deepStrictEqual(
      A.map(["58319870951433", "12.50", "2021-01-04", "2021-01-04T05:00:00.000Z", "true", ""], operandFamily),
      ["text", "text", "text", "text", "text", "text"]
    );
  });

  it.prop(
    "classifies every generated operand by its JSON form",
    [Arbitrary.schema(ScalarValue)],
    ([operand]) =>
      operandFamily(operand) === (P.isString(operand) ? "text" : P.isNumber(operand) ? "number" : "boolean"),
    { arbitrary: fcRuns(100) }
  );
});

// ---------------------------------------------------------------------------
// The operand table and the operand codec say the same thing
// ---------------------------------------------------------------------------

// `allowedOperands` names the JSON forms an operand of each type takes; `Property.operandCodec` is the codec that
// reads and writes them. Nothing derives one from the other, so this suite holds them together.
describe("the operand table and operandCodec", () => {
  // One type per tag, decoded from the smallest wire record that states it.
  const wireOf = (kind: PropertyTypeKind): unknown =>
    kind === "array"
      ? { type: kind, subType: { type: "string" } }
      : kind === "struct"
        ? { type: kind, structFieldTypes: [] }
        : kind === "vector"
          ? { type: kind, dimension: 3 }
          : kind === "timeseries"
            ? { type: kind, itemType: { type: "double" } }
            : { type: kind };

  const typeOf = (kind: PropertyTypeKind): Effect.Effect<PropertyType, S.SchemaError> =>
    S.decodeUnknownEffect(PropertyType)(wireOf(kind));

  // The wire operands the codec writes for 25 generated values of the type, one per value it accepts.
  const written = Effect.fnUntraced(function* (type: PropertyType) {
    const compared = valueCodec(operandType(type));
    const values = yield* Arbitrary.sampleEffect(Arbitrary.schema(compared), { count: 25, seed: 7 });
    return A.getSomes(A.map(values, (value) => S.encodeUnknownOption(operandCodec(type))(value)));
  });

  it.effect(
    "every operand the codec writes is of a family the table admits for that type",
    Effect.fnUntraced(function* () {
      const rows = yield* Effect.forEach(
        PropertyTypeKind.literals,
        Effect.fnUntraced(function* (kind) {
          const type = yield* typeOf(kind);
          const operands = yield* written(type);
          return {
            kind,
            written: A.length(operands),
            admitted: operandsOf(type),
            strangers: A.filter(operands, (operand) => !A.contains(operandsOf(type), operandFamily(operand))),
          };
        })
      );
      strictEqual(A.length(rows), 22);
      deepStrictEqual(
        A.filter(rows, (row) => A.isReadonlyArrayNonEmpty(row.strangers)),
        []
      );
      const kindsWhere = (holds: (row: (typeof rows)[number]) => boolean): ReadonlyArray<string> =>
        A.map(A.filter(rows, holds), (row) => row.kind);
      // Where the table admits no operand, the codec writes none: no value of a geometry or a struct is a scalar.
      deepStrictEqual(
        kindsWhere((row) => A.isReadonlyArrayEmpty(row.admitted)),
        ["geopoint", "geoshape", "struct"]
      );
      assertTrue(A.every(rows, (row) => A.isReadonlyArrayNonEmpty(row.admitted) || row.written === 0));
      // The one place the two differ, and it is the table that is wider: OSDK's fallback filter compares these
      // three with text, and that text is not a value of the property, so no codec writes or reads it.
      deepStrictEqual(
        kindsWhere((row) => A.isReadonlyArrayNonEmpty(row.admitted) && row.written === 0),
        ["attachment", "mediaReference", "vector"]
      );
    })
  );

  it.effect(
    "the codec reads an operand of every family the table admits for a scalar type",
    Effect.fnUntraced(function* () {
      const probes: ReadonlyArray<ScalarValue> = [7, 0.5, true, "7", "true", "x"];
      const rows = yield* Effect.forEach(
        EquatableKind.literals,
        Effect.fnUntraced(function* (kind) {
          const type = yield* typeOf(kind);
          const canonical = yield* written(type);
          const readable = A.dedupe(
            A.map(
              A.filter(A.appendAll(canonical, probes), (operand) =>
                O.isSome(S.decodeOption(operandCodec(type))(operand))
              ),
              operandFamily
            )
          );
          return {
            kind,
            missing: A.difference(allowedOperands[kind], readable),
            extra: A.difference(readable, allowedOperands[kind]),
          };
        })
      );
      strictEqual(A.length(rows), 12);
      deepStrictEqual(
        A.filter(rows, (row) => A.isReadonlyArrayNonEmpty(row.missing)),
        []
      );
      // The codec is wider than the table in one documented way: the wire lets a number and a boolean travel as
      // text for backwards compatibility, and the table names the canonical form only.
      deepStrictEqual(
        A.map(
          A.filter(rows, (row) => A.isReadonlyArrayNonEmpty(row.extra)),
          (row) => [row.kind, row.extra]
        ),
        [
          ["boolean", ["text"]],
          ["byte", ["text"]],
          ["short", ["text"]],
          ["integer", ["text"]],
          ["float", ["text"]],
          ["double", ["text"]],
        ]
      );
    })
  );

  it.effect(
    "a filter the typed tier could have written passes the check: its operands come from the operand codec",
    Effect.fnUntraced(function* () {
      const rid = PropertyTypeRid.make("ri.ontology.main.property.test");
      const verdicts = yield* Effect.forEach(
        EquatableKind.literals,
        Effect.fnUntraced(function* (kind) {
          const type = yield* typeOf(kind);
          const operands = yield* written(type);
          const properties = R.fromEntries([
            Tuple.make(PropertyApiName.make("subject"), PropertyDefinition.make({ dataType: type, rid })),
          ]);
          return (
            A.length(operands) === 25 &&
            A.isReadonlyArrayEmpty(
              checkFilter(
                every([oneOf("subject", operands), ...A.map(operands, (operand) => eq("subject", operand))]),
                properties
              )
            )
          );
        })
      );
      deepStrictEqual(verdicts, A.map(EquatableKind.literals, () => true));
    })
  );
});

// ---------------------------------------------------------------------------
// Checking a filter against a property table
// ---------------------------------------------------------------------------

// A role (title, primary key) is declared by every object type, with or without a load level around it.
const restsOnRole: (selector: PropertySelector) => boolean = PropertySelector.match({
  property: () => false,
  structField: () => false,
  propertyWithLoadLevel: ({ selector }) => restsOnRole(selector),
  titleProperty: () => true,
  primaryKeyProperty: () => true,
});

describe("checkFilter", () => {
  const rid = PropertyTypeRid.make("ri.ontology.main.property.test");
  const declare = (name: string, dataType: PropertyType) =>
    Tuple.make(PropertyApiName.make(name), PropertyDefinition.make({ dataType, rid }));
  const field = (name: string, dataType: PropertyType): StructFieldType =>
    StructFieldType.make({
      apiName: StructFieldApiName.make(name),
      rid: StructFieldTypeRid.make("ri.ontology.main.struct-field.test"),
      dataType,
    });
  const address = StructType.make({
    fields: [field("city", StringType.make({})), field("zip", IntegerType.make({}))],
  });
  const properties = R.fromEntries([
    declare("fullName", StringType.make({})),
    declare("age", IntegerType.make({})),
    declare("badge", ShortType.make({})),
    declare("employeeId", LongType.make({})),
    declare("salary", DecimalType.make({})),
    declare("active", BooleanType.make({})),
    declare("hireDate", DateType.make({})),
    declare("updatedAt", TimestampType.make({})),
    declare("location", GeoPointType.make({})),
    declare("tags", ArrayType.make({ elementType: StringType.make({}) })),
    declare("scores", ArrayType.make({ elementType: IntegerType.make({}) })),
    declare("address", address),
    declare("offices", ArrayType.make({ elementType: address })),
  ]);
  const check = checkFilter(properties);
  const kinds = (filter: ObjectFilter): ReadonlyArray<string> => A.map(check(filter), (violation) => violation.type);

  lawful("UnknownProperty", UnknownProperty);
  lawful("OperatorNotAllowed", OperatorNotAllowed);
  lawful("OperandMismatch", OperandMismatch);
  lawful("EmptyCombinator", EmptyCombinator);
  lawful("FilterViolation", FilterViolation);

  it("constructs every violation through the union and matches it exhaustively", () => {
    const samples: ReadonlyArray<FilterViolation> = [
      FilterViolation.cases.unknownProperty.make({ operator: "eq", property: named("nickname") }),
      FilterViolation.cases.operatorNotAllowed.make({
        operator: "gt",
        property: named("active"),
        propertyType: "boolean",
        allowed: allowedOperators.boolean,
      }),
      FilterViolation.cases.operandMismatch.make({
        operator: "eq",
        property: named("age"),
        propertyType: "integer",
        operand: "text",
        expected: allowedOperands.integer,
      }),
      FilterViolation.cases.emptyCombinator.make({ operator: "and" }),
    ];
    const tagOf: (violation: FilterViolation) => string = FilterViolation.match({
      unknownProperty: () => "unknownProperty",
      operatorNotAllowed: () => "operatorNotAllowed",
      operandMismatch: () => "operandMismatch",
      emptyCombinator: () => "emptyCombinator",
    });
    deepStrictEqual<ReadonlyArray<string>>(A.map(samples, tagOf), FilterViolation.discriminants);
    assertTrue(A.every(samples, (sample) => FilterViolation.guards[sample.type](sample)));
  });

  it.effect(
    "accepts a filter that agrees with the property table",
    Effect.fnUntraced(function* () {
      // The operands of the long, decimal, date and timestamp properties, written by their own operand codecs.
      const employeeId = yield* S.encodeEffect(operandCodec(LongType.make({})))(BigInt("58319870951433"));
      const salary = yield* S.encodeEffect(operandCodec(DecimalType.make({})))(BigDecimal.fromStringUnsafe("12.5"));
      const fourthOfJanuary = LocalDate.make({ year: 2021, month: 1, day: 4 });
      const hiredOn = yield* S.encodeEffect(operandCodec(DateType.make({})))(fourthOfJanuary);
      const epoch = yield* S.encodeEffect(operandCodec(TimestampType.make({})))(DateTime.makeUnsafe(0));
      const filter = every([
        startsWith("fullName", "Ish"),
        some([gt("age", 21), lte("badge", 7)]),
        eq("employeeId", employeeId),
        eq("employeeId", 42),
        gte("salary", salary),
        ne("active", true),
        gte("hireDate", hiredOn),
        inRelativeDateRange("hireDate", lastWeek),
        lt("updatedAt", epoch),
        withinDistance("location", downtown),
        contains("tags", "urgent"),
        matchesRegex("tags", "urg.+"),
        lt("scores", 5),
        isNull("address"),
        gt(zipOfAddress, 98000),
        oneOf("age", [1, 2, 3]),
        oneOf("age", []),
      ]);
      deepStrictEqual(check(filter), []);
    })
  );

  it.effect(
    "accepts a filter read from the wire, whose rich operands are text",
    Effect.fnUntraced(function* () {
      const filter = yield* decodeFilter({
        type: "and",
        value: [
          { type: "eq", field: "employeeId", value: "58319870951433" },
          { type: "lt", field: "salary", value: "12.5" },
          { type: "gte", field: "hireDate", value: "2021-01-04" },
          { type: "gt", field: "updatedAt", value: "2021-01-04T05:00:00.000Z" },
        ],
      });
      deepStrictEqual(check(filter), []);
    })
  );

  it("reports a property the table does not declare", () => {
    deepStrictEqual(check(eq("nickname", "Ish")), [
      UnknownProperty.make({ operator: "eq", property: named("nickname") }),
    ]);
    const country = StructFieldOfProperty.make({
      propertyApiName: PropertyApiName.make("address"),
      structFieldApiName: StructFieldApiName.make("country"),
    });
    const fieldOfScalar = StructFieldOfProperty.make({
      propertyApiName: PropertyApiName.make("age"),
      structFieldApiName: StructFieldApiName.make("zip"),
    });
    deepStrictEqual(kinds(isNull(country)), ["unknownProperty"]);
    deepStrictEqual(kinds(isNull(fieldOfScalar)), ["unknownProperty"]);
  });

  it("resolves a struct field, also through an array of structs", () => {
    const cityOfOffices = StructFieldOfProperty.make({
      propertyApiName: PropertyApiName.make("offices"),
      structFieldApiName: StructFieldApiName.make("city"),
    });
    deepStrictEqual(check(startsWith(cityOfOffices, "Sea")), []);
    deepStrictEqual(kinds(gt(zipOfAddress, "98000")), ["operandMismatch"]);
    deepStrictEqual(kinds(startsWith(zipOfAddress, "98")), ["operatorNotAllowed"]);
  });

  it("reports an operator the property's type does not admit, with what it does admit", () => {
    deepStrictEqual(check(gt("active", true)), [
      OperatorNotAllowed.make({
        operator: "gt",
        property: named("active"),
        propertyType: "boolean",
        allowed: ["eq", "in", "isNull"],
      }),
    ]);
    deepStrictEqual(kinds(startsWith("age", "2")), ["operatorNotAllowed"]);
    deepStrictEqual(kinds(eq("location", "here")), ["operatorNotAllowed"]);
    deepStrictEqual(kinds(withinPolygon("fullName", triangle)), ["operatorNotAllowed"]);
    deepStrictEqual(kinds(inRelativeDateRange("age", lastWeek)), ["operatorNotAllowed"]);
    deepStrictEqual(kinds(eq("address", "x")), ["operatorNotAllowed"]);
    deepStrictEqual(kinds(matchesRegex("scores", "1+")), ["operatorNotAllowed"]);
    deepStrictEqual(kinds(contains("age", 1)), ["operatorNotAllowed"]);
  });

  it("reports an operand of a family the property's type does not admit, once per family", () => {
    deepStrictEqual(check(eq("age", "old")), [
      OperandMismatch.make({
        operator: "eq",
        property: named("age"),
        propertyType: "integer",
        operand: "text",
        expected: ["number"],
      }),
    ]);
    deepStrictEqual(kinds(gte("hireDate", 2021)), ["operandMismatch"]);
    deepStrictEqual(kinds(eq("employeeId", true)), ["operandMismatch"]);
    deepStrictEqual(kinds(eq("active", "true")), ["operandMismatch"]);
    deepStrictEqual(kinds(contains("scores", "five")), ["operandMismatch"]);
    deepStrictEqual(
      A.map(check(oneOf("age", [1, "two", "three", true, 4])), (violation) =>
        FilterViolation.guards.operandMismatch(violation) ? violation.operand : ""
      ),
      ["text", "boolean"]
    );
  });

  it("reports an and or an or without operands, wherever it sits", () => {
    deepStrictEqual(check(every([])), [EmptyCombinator.make({ operator: "and" })]);
    deepStrictEqual(check(some([])), [EmptyCombinator.make({ operator: "or" })]);
    deepStrictEqual(kinds(not(every([gt("age", 21), some([])]))), ["emptyCombinator"]);
    deepStrictEqual(check(not(eq("age", 30))), []);
  });

  it("checks role and load-level selectors for existence only", () => {
    const reduced = (name: string) => PropertyAtLoadLevel.make({ selector: named(name), loadLevel: "applyReducers" });
    deepStrictEqual(check(gt(TitleProperty.make({}), "M")), []);
    deepStrictEqual(check(withinPolygon(PrimaryKeyProperty.make({}), triangle)), []);
    deepStrictEqual(check(gt(reduced("scores"), "anything")), []);
    deepStrictEqual(kinds(gt(reduced("missing"), 1)), ["unknownProperty"]);
  });

  it("returns every violation in tree order, the same in both call shapes", () => {
    const filter = every([
      gt("age", 21),
      gt("active", true),
      eq("age", "old"),
      startsWith("nickname", "ish"),
      some([]),
    ]);
    deepStrictEqual(kinds(filter), ["operatorNotAllowed", "operandMismatch", "unknownProperty", "emptyCombinator"]);
    deepStrictEqual(checkFilter(filter, properties), check(filter));
    deepStrictEqual(pipe(filter, checkFilter(properties)), check(filter));
  });

  it.prop(
    "against an empty table, reports exactly the tests whose selector names a property",
    [Arbitrary.schema(ObjectFilter)],
    ([filter]) => {
      const violations = checkFilter(filter, R.empty<PropertyApiName, PropertyDefinition>());
      const undeclared = A.filter(selectorsOf(filter), (selector) => !restsOnRole(selector));
      const unknown = A.filter(violations, FilterViolation.guards.unknownProperty);
      return A.every(violations, S.is(FilterViolation)) && unknown.length === undeclared.length;
    },
    { arbitrary: fcRuns(50) }
  );
});

// ---------------------------------------------------------------------------
// Fields that hold another class
// ---------------------------------------------------------------------------

type SameType<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

describe("fields that hold another class", () => {
  // Law: a field whose schema is a class is typed as that class, so its value can be handed to anything that asks
  // for the class. Annotating the key of a class would silently type the field as the class's un-branded record.
  it("are typed as the class and never as its un-branded record", () => {
    const facts: readonly [
      SameType<BoundingBoxCorners["topLeft"], GeoPoint>,
      SameType<BoundingBoxCorners["bottomRight"], GeoPoint>,
      SameType<CircularArea["center"], GeoPoint>,
      SameType<CircularArea["distance"], Distance>,
      SameType<WithinDistance["value"], CircularArea>,
      SameType<WithinBoundingBox["value"], BoundingBoxCorners>,
      SameType<IntersectsBoundingBox["value"], BoundingBoxCorners>,
      SameType<DoesNotIntersectBoundingBox["value"], BoundingBoxCorners>,
      SameType<WithinPolygon["value"], Polygon>,
      SameType<IntersectsPolygon["value"], Polygon>,
      SameType<DoesNotIntersectPolygon["value"], Polygon>,
    ] = [true, true, true, true, true, true, true, true, true, true, true];
    assertTrue(A.every(facts, (fact) => fact));
  });
});
