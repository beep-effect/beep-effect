import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as DataTypeValues from "../src/DataType/DataType.values.ts";
import {
  ActionParameterTypeKind,
  AnyType,
  AttachmentType,
  BinaryType,
  BooleanType,
  ByteType,
  CipherTextType,
  DataTypeKind,
  DateType,
  DecimalType,
  DeployedEmbedding,
  DoubleType,
  EmbeddingSource,
  FloatType,
  GeohashType,
  GeoPointType,
  GeoShapeType,
  GeospatialKind,
  GeotimeSeriesReferenceType,
  HostedEmbedding,
  HostedEmbeddingModel,
  IntegerType,
  LegacyDataTypeKind,
  LongType,
  MarkingKind,
  MarkingType,
  MediaReferenceType,
  NullType,
  NumericKind,
  ObjectTypeReferenceType,
  PrimaryKeyKind,
  PropertyTypeKind,
  QueryDataTypeKind,
  ScenarioReferenceType,
  SensorSeriesItem,
  SharedValueKind,
  ShortType,
  StringType,
  TemporalKind,
  TimeSeriesItem,
  TimeSeriesReferenceType,
  TimeseriesType,
  TimestampType,
  UnsupportedType,
  ValueTypeKind,
  VectorSimilarity,
  VectorType,
  VoidType,
} from "../src/DataType/index.ts";
import { PropertyTypeRid } from "../src/Identifier/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by every named schema
// ---------------------------------------------------------------------------

const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const is = S.is(schema);
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });

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

// Decodes an exact wire value, compares the domain value, encodes it back and compares with the wire value.
const wireFixture = <T, E>(name: string, schema: S.Codec<T, E>, wire: NoInfer<E>, expected: NoInfer<T>): void => {
  it.effect(
    `${name}: decodes the wire fixture and encodes it back unchanged`,
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(schema)(wire);
      assertTrue(S.toEquivalence(schema)(decoded, expected));
      const encoded = yield* S.encodeEffect(schema)(decoded);
      deepStrictEqual(encoded, wire);
      const fromDomain = yield* S.encodeEffect(schema)(expected);
      deepStrictEqual(fromDomain, wire);
    })
  );
};

const rejects =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isFailure);

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

const sorted = (tags: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(tags, Order.String);

const literalsOf = (kit: unknown): ReadonlyArray<string> =>
  P.hasProperty(kit, "literals") && A.isArray(kit.literals) ? A.filter(kit.literals, P.isString) : [];

// ---------------------------------------------------------------------------
// The tag vocabulary and its universes (08-wire-b.md §5.3, the 44-tag matrix)
// ---------------------------------------------------------------------------

// Tags every one of the five wire unions carries.
const sharedByAll = ["boolean", "date", "double", "integer", "long", "string", "timestamp", "array", "struct"];

// `ObjectPropertyType` (22).
const objectPropertyTags = A.appendAll(sharedByAll, [
  "float",
  "byte",
  "short",
  "decimal",
  "cipherText",
  "marking",
  "mediaReference",
  "attachment",
  "geoshape",
  "vector",
  "geopoint",
  "geotimeSeriesReference",
  "timeseries",
]);

// `OntologyDataType` (23), the legacy universe.
const ontologyDataTags = A.appendAll(sharedByAll, [
  "float",
  "byte",
  "short",
  "decimal",
  "binary",
  "map",
  "set",
  "cipherText",
  "marking",
  "mediaReference",
  "object",
  "objectSet",
  "unsupported",
  "any",
]);

// `ActionParameterType` (22).
const actionParameterTags = A.appendAll(sharedByAll, [
  "decimal",
  "marking",
  "mediaReference",
  "attachment",
  "geoshape",
  "vector",
  "object",
  "objectSet",
  "interfaceObject",
  "objectType",
  "scenarioReference",
  "timeSeriesReference",
  "geohash",
]);

// `QueryDataType` (26).
const queryDataTags = A.appendAll(sharedByAll, [
  "float",
  "set",
  "mediaReference",
  "attachment",
  "geoshape",
  "object",
  "objectSet",
  "interfaceObject",
  "interfaceObjectSet",
  "unsupported",
  "union",
  "entrySet",
  "null",
  "void",
  "typeReference",
  "twoDimensionalAggregation",
  "threeDimensionalAggregation",
]);

// `ValueTypeFieldType` (18).
const valueTypeTags = A.appendAll(sharedByAll, [
  "float",
  "byte",
  "short",
  "decimal",
  "binary",
  "map",
  "union",
  "optional",
  "reference",
]);

const allWireTags = A.dedupe(
  A.flatten([objectPropertyTags, ontologyDataTags, actionParameterTags, queryDataTags, valueTypeTags])
);

describe("DataTypeKind", () => {
  lawful("DataTypeKind", DataTypeKind);
  lawful("PropertyTypeKind", PropertyTypeKind);
  lawful("ActionParameterTypeKind", ActionParameterTypeKind);
  lawful("QueryDataTypeKind", QueryDataTypeKind);
  lawful("ValueTypeKind", ValueTypeKind);
  lawful("LegacyDataTypeKind", LegacyDataTypeKind);
  lawful("NumericKind", NumericKind);
  lawful("TemporalKind", TemporalKind);
  lawful("GeospatialKind", GeospatialKind);
  lawful("PrimaryKeyKind", PrimaryKeyKind);
  lawful("SharedValueKind", SharedValueKind);

  it("names exactly the 44 distinct tags of the five wire unions, once each", () => {
    strictEqual(A.length(DataTypeKind.literals), 44);
    strictEqual(A.length(A.dedupe(DataTypeKind.literals)), 44);
    strictEqual(A.length(allWireTags), 44);
    deepStrictEqual(sorted(DataTypeKind.literals), sorted(allWireTags));
  });

  it("derives each universe with exactly the tags of its wire union", () => {
    deepStrictEqual(
      [
        A.length(PropertyTypeKind.literals),
        A.length(ActionParameterTypeKind.literals),
        A.length(QueryDataTypeKind.literals),
        A.length(ValueTypeKind.literals),
        A.length(LegacyDataTypeKind.literals),
      ],
      [22, 22, 26, 18, 23]
    );
    deepStrictEqual(sorted(PropertyTypeKind.literals), sorted(objectPropertyTags));
    deepStrictEqual(sorted(ActionParameterTypeKind.literals), sorted(actionParameterTags));
    deepStrictEqual(sorted(QueryDataTypeKind.literals), sorted(queryDataTags));
    deepStrictEqual(sorted(ValueTypeKind.literals), sorted(valueTypeTags));
    deepStrictEqual(sorted(LegacyDataTypeKind.literals), sorted(ontologyDataTags));
  });

  it("makes the legacy universe a 23-tag subset of the vocabulary and the only owner of the any tag", () => {
    const legacy: ReadonlyArray<string> = LegacyDataTypeKind.literals;
    strictEqual(A.length(legacy), 23);
    strictEqual(A.length(A.dedupe(legacy)), 23);
    assertTrue(A.every(legacy, S.is(DataTypeKind)));
    deepStrictEqual(A.difference(legacy, DataTypeKind.literals), []);
    // The legacy universe keeps the vocabulary's own order, like every other pick.
    deepStrictEqual(legacy, A.filter(DataTypeKind.literals, S.is(LegacyDataTypeKind)));
    const others: ReadonlyArray<ReadonlyArray<string>> = [
      PropertyTypeKind.literals,
      ActionParameterTypeKind.literals,
      QueryDataTypeKind.literals,
      ValueTypeKind.literals,
    ];
    deepStrictEqual(
      [S.is(LegacyDataTypeKind)("any"), A.some(others, A.contains("any")), LegacyDataTypeKind.Enum.any],
      [true, false, "any"]
    );
    // Tags the legacy universe never had.
    deepStrictEqual(
      A.map(["attachment", "geopoint", "vector", "timeseries", "union", "null", "interfaceObject"], (tag) =>
        S.is(LegacyDataTypeKind)(tag)
      ),
      [false, false, false, false, false, false, false]
    );
    const facts: readonly [
      LegacyDataTypeKind extends DataTypeKind ? true : false,
      DataTypeKind extends LegacyDataTypeKind ? true : false,
      "any" extends LegacyDataTypeKind ? true : false,
      "any" extends PropertyTypeKind | ActionParameterTypeKind | QueryDataTypeKind | ValueTypeKind ? true : false,
    ] = [true, false, true, false];
    deepStrictEqual(facts, [true, false, true, false]);
  });

  it("keeps every universe and every family inside the master vocabulary, without repeats", () => {
    const picks: ReadonlyArray<ReadonlyArray<string>> = [
      PropertyTypeKind.literals,
      ActionParameterTypeKind.literals,
      QueryDataTypeKind.literals,
      ValueTypeKind.literals,
      LegacyDataTypeKind.literals,
      NumericKind.literals,
      TemporalKind.literals,
      GeospatialKind.literals,
      PrimaryKeyKind.literals,
      SharedValueKind.literals,
    ];
    assertTrue(A.every(picks, A.every(S.is(DataTypeKind))));
    assertTrue(A.every(picks, (pick) => A.length(A.dedupe(pick)) === A.length(pick)));
  });

  it("states the semantic families with the counts and members their docs give", () => {
    deepStrictEqual(
      sorted(NumericKind.literals),
      sorted(["byte", "short", "integer", "long", "float", "double", "decimal"])
    );
    deepStrictEqual(sorted(TemporalKind.literals), sorted(["date", "timestamp"]));
    deepStrictEqual(sorted(GeospatialKind.literals), sorted(["geopoint", "geoshape"]));
    // The seven typed wire primary key values (09-wire-c-core-geo.md §5.2), plus short and byte from the
    // generated clients.
    const wirePrimaryKeyTags = ["date", "string", "timestamp", "boolean", "integer", "double", "long"];
    deepStrictEqual(sorted(PrimaryKeyKind.literals), sorted(A.appendAll(wirePrimaryKeyTags, ["short", "byte"])));
    deepStrictEqual(
      [
        A.length(NumericKind.literals),
        A.length(TemporalKind.literals),
        A.length(GeospatialKind.literals),
        A.length(PrimaryKeyKind.literals),
      ],
      [7, 2, 2, 9]
    );
  });

  it("names the tags every universe reads alike: the scalars and three references, never an attachment", () => {
    // The scalar tags are the leaves of a value type, the universe built from nothing but scalars and wrappers.
    const wrappers = ["array", "map", "struct", "union", "optional", "reference"];
    const valueTags: ReadonlyArray<string> = ValueTypeKind.literals;
    const sharedTags: ReadonlyArray<string> = SharedValueKind.literals;
    const scalars = A.difference(valueTags, wrappers);
    deepStrictEqual(
      sorted(SharedValueKind.literals),
      sorted(A.appendAll(scalars, ["marking", "cipherText", "mediaReference", "geoshape"]))
    );
    strictEqual(A.length(SharedValueKind.literals), 16);
    const isShared = S.is(SharedValueKind);
    deepStrictEqual(
      [isShared("attachment"), isShared("vector"), isShared("array"), isShared("object"), isShared("geopoint")],
      [false, false, false, false, false]
    );
    // Every universe has some of them, and no universe has a shared tag the vocabulary lacks.
    deepStrictEqual(
      A.map(
        [PropertyTypeKind, ActionParameterTypeKind, QueryDataTypeKind, ValueTypeKind, LegacyDataTypeKind],
        (universe) => A.length(A.filter(universe.literals, (tag) => A.contains(sharedTags, tag)))
      ),
      [15, 11, 10, 12, 15]
    );
  });

  it("makes every family a set of property tags", () => {
    const families: ReadonlyArray<ReadonlyArray<string>> = [
      NumericKind.literals,
      TemporalKind.literals,
      GeospatialKind.literals,
      PrimaryKeyKind.literals,
    ];
    assertTrue(A.every(families, A.every(S.is(PropertyTypeKind))));
  });

  it("tells tags of one universe from tags of another", () => {
    deepStrictEqual(
      [
        S.is(PropertyTypeKind)("geopoint"),
        S.is(ActionParameterTypeKind)("geopoint"),
        S.is(ActionParameterTypeKind)("geohash"),
        S.is(QueryDataTypeKind)("decimal"),
        S.is(ValueTypeKind)("binary"),
        S.is(PropertyTypeKind)("binary"),
        S.is(DataTypeKind)("datetime"),
        S.is(DataTypeKind)("numericTimeseries"),
      ],
      [true, false, true, false, true, false, false, false]
    );
    deepStrictEqual(
      [DataTypeKind.is.timeseries("timeseries"), DataTypeKind.is.timeseries("timeSeriesReference")],
      [true, false]
    );
    strictEqual(DataTypeKind.Enum.timeseries, "timeseries");
    strictEqual(PropertyTypeKind.Enum.geotimeSeriesReference, "geotimeSeriesReference");
  });

  it("has the tag literals themselves as both its domain and its wire form", () => {
    const facts: readonly [
      Equals<TemporalKind, "date" | "timestamp">,
      Equals<typeof TemporalKind.Encoded, "date" | "timestamp">,
      Equals<GeospatialKind, "geopoint" | "geoshape">,
      PropertyTypeKind extends DataTypeKind ? true : false,
      DataTypeKind extends PropertyTypeKind ? true : false,
      PrimaryKeyKind extends PropertyTypeKind ? true : false,
    ] = [true, true, true, true, false, true];
    deepStrictEqual(facts, [true, true, true, true, false, true]);
  });

  it.effect(
    "rejects OSDK's renamed tags and tags of the wrong case",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(DataTypeKind)("datetime"),
        rejects(DataTypeKind)("numericTimeseries"),
        rejects(DataTypeKind)("stringTimeseries"),
        rejects(DataTypeKind)("sensorTimeseries"),
        rejects(DataTypeKind)("BOOLEAN"),
        rejects(DataTypeKind)("timeSeries"),
        rejects(DataTypeKind)(""),
        rejects(PropertyTypeKind)("binary"),
        rejects(PropertyTypeKind)("timeSeriesReference"),
        rejects(ActionParameterTypeKind)("float"),
        rejects(QueryDataTypeKind)("vector"),
        rejects(ValueTypeKind)("attachment"),
        rejects(PrimaryKeyKind)("decimal"),
        rejects(PrimaryKeyKind)("float"),
        rejects(NumericKind)("string"),
        rejects(LegacyDataTypeKind)("attachment"),
        rejects(LegacyDataTypeKind)("ANY"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  // Law: the five universes cover the vocabulary; no tag is left without a universe that owns it.
  it("gives every tag at least one exported universe", () => {
    // Every exported kit other than the master vocabulary, so that a new pick is counted without editing this test.
    const owned = A.dedupe(
      A.flatMap(R.toEntries(DataTypeValues), ([name, kit]) => (name === "DataTypeKind" ? [] : literalsOf(kit)))
    );
    const literals: ReadonlyArray<string> = DataTypeKind.literals;
    deepStrictEqual(A.difference(literals, owned), []);
  });
});

// ---------------------------------------------------------------------------
// Literal domains carried by type tags (09-wire-c-core-geo.md §17.2)
// ---------------------------------------------------------------------------

describe("literal domains carried by type tags", () => {
  lawful("MarkingKind", MarkingKind);
  lawful("VectorSimilarity", VectorSimilarity);
  lawful("HostedEmbeddingModel", HostedEmbeddingModel);

  it("pairs every wire literal with exactly one domain literal, in wire order", () => {
    deepStrictEqual(MarkingKind.Pairs, [
      ["CBAC", "cbac"],
      ["MANDATORY", "mandatory"],
    ]);
    deepStrictEqual(VectorSimilarity.Pairs, [
      ["COSINE_SIMILARITY", "cosine"],
      ["DOT_PRODUCT", "dotProduct"],
      ["EUCLIDEAN_DISTANCE", "euclidean"],
    ]);
    deepStrictEqual(HostedEmbeddingModel.Pairs, [
      ["OPENAI_TEXT_EMBEDDING_ADA_002", "openAiTextEmbeddingAda002"],
      ["TEXT_EMBEDDING_3_LARGE", "textEmbedding3Large"],
      ["TEXT_EMBEDDING_3_SMALL", "textEmbedding3Small"],
      ["SNOWFLAKE_ARCTIC_EMBED_M", "snowflakeArcticEmbedM"],
      ["INSTRUCTOR_LARGE", "instructorLarge"],
      ["BGE_BASE_EN_V1_5", "bgeBaseEnV15"],
    ]);
  });

  it.effect(
    "decodes every wire literal to its domain literal and encodes it back",
    Effect.fnUntraced(function* () {
      const markings = yield* Effect.all(A.map(MarkingKind.Pairs, ([wire]) => S.decodeEffect(MarkingKind)(wire)));
      const similarities = yield* Effect.all(
        A.map(VectorSimilarity.Pairs, ([wire]) => S.decodeEffect(VectorSimilarity)(wire))
      );
      const models = yield* Effect.all(
        A.map(HostedEmbeddingModel.Pairs, ([wire]) => S.decodeEffect(HostedEmbeddingModel)(wire))
      );
      deepStrictEqual(markings, A.map(MarkingKind.Pairs, ([, domain]) => domain));
      deepStrictEqual(similarities, A.map(VectorSimilarity.Pairs, ([, domain]) => domain));
      deepStrictEqual(models, A.map(HostedEmbeddingModel.Pairs, ([, domain]) => domain));
      const wireMarkings = yield* Effect.all(A.map(markings, (domain) => S.encodeEffect(MarkingKind)(domain)));
      const wireSimilarities = yield* Effect.all(
        A.map(similarities, (domain) => S.encodeEffect(VectorSimilarity)(domain))
      );
      const wireModels = yield* Effect.all(A.map(models, (domain) => S.encodeEffect(HostedEmbeddingModel)(domain)));
      deepStrictEqual(wireMarkings, A.map(MarkingKind.Pairs, ([wire]) => wire));
      deepStrictEqual(wireSimilarities, A.map(VectorSimilarity.Pairs, ([wire]) => wire));
      deepStrictEqual(wireModels, A.map(HostedEmbeddingModel.Pairs, ([wire]) => wire));
    })
  );

  it("matches every domain literal exhaustively through the reverse kit", () => {
    const isClassification = MarkingKind.To.match({ cbac: () => true, mandatory: () => false });
    const kinds: ReadonlyArray<MarkingKind> = ["cbac", "mandatory"];
    deepStrictEqual(A.map(kinds, isClassification), [true, false]);
    const higherIsCloser = VectorSimilarity.To.match({
      cosine: () => true,
      dotProduct: () => true,
      euclidean: () => false,
    });
    const functions: ReadonlyArray<VectorSimilarity> = ["cosine", "dotProduct", "euclidean"];
    deepStrictEqual(A.map(functions, higherIsCloser), [true, true, false]);
  });

  it("has the upper-case wire enum as its encoded side and lowerCamel literals as its domain side", () => {
    const facts: readonly [
      Equals<typeof MarkingKind.Encoded, "CBAC" | "MANDATORY">,
      Equals<MarkingKind, "cbac" | "mandatory">,
      Equals<typeof VectorSimilarity.Encoded, "COSINE_SIMILARITY" | "DOT_PRODUCT" | "EUCLIDEAN_DISTANCE">,
      Equals<VectorSimilarity, "cosine" | "dotProduct" | "euclidean">,
    ] = [true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "rejects domain literals on the wire and literals outside each domain",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(MarkingKind)("cbac"),
        rejects(MarkingKind)("Mandatory"),
        rejects(MarkingKind)("ORGANIZATION"),
        rejects(VectorSimilarity)("cosine"),
        rejects(VectorSimilarity)("COSINE"),
        rejects(VectorSimilarity)("MANHATTAN_DISTANCE"),
        rejects(HostedEmbeddingModel)("textEmbedding3Large"),
        rejects(HostedEmbeddingModel)("TEXT_EMBEDDING_4"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Payload-free tag records (09-wire-c-core-geo.md §17.1)
// ---------------------------------------------------------------------------

type Tagged = { readonly type: string };

const payloadFreeRecords: ReadonlyArray<readonly [tag: DataTypeKind, schema: S.Codec<Tagged, Tagged>, made: Tagged]> = [
  ["boolean", BooleanType, BooleanType.make({})],
  ["byte", ByteType, ByteType.make({})],
  ["short", ShortType, ShortType.make({})],
  ["integer", IntegerType, IntegerType.make({})],
  ["long", LongType, LongType.make({})],
  ["float", FloatType, FloatType.make({})],
  ["double", DoubleType, DoubleType.make({})],
  ["string", StringType, StringType.make({})],
  ["date", DateType, DateType.make({})],
  ["timestamp", TimestampType, TimestampType.make({})],
  ["binary", BinaryType, BinaryType.make({})],
  ["attachment", AttachmentType, AttachmentType.make({})],
  ["mediaReference", MediaReferenceType, MediaReferenceType.make({})],
  ["geopoint", GeoPointType, GeoPointType.make({})],
  ["geoshape", GeoShapeType, GeoShapeType.make({})],
  ["geohash", GeohashType, GeohashType.make({})],
  ["geotimeSeriesReference", GeotimeSeriesReferenceType, GeotimeSeriesReferenceType.make({})],
  ["timeSeriesReference", TimeSeriesReferenceType, TimeSeriesReferenceType.make({})],
  ["null", NullType, NullType.make({})],
  ["void", VoidType, VoidType.make({})],
  ["any", AnyType, AnyType.make({})],
  ["objectType", ObjectTypeReferenceType, ObjectTypeReferenceType.make({})],
  ["scenarioReference", ScenarioReferenceType, ScenarioReferenceType.make({})],
];

const payloadRecordTags: ReadonlyArray<DataTypeKind> = [
  "decimal",
  "marking",
  "cipherText",
  "timeseries",
  "vector",
  "unsupported",
];

describe("payload-free tag records", () => {
  A.forEach(payloadFreeRecords, ([tag, schema]) => lawful(`${tag} tag record`, schema));

  it.effect(
    "decodes each bare wire tag to its record and encodes the record back to the bare tag",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(
        payloadFreeRecords,
        Effect.fnUntraced(function* ([tag, schema, made]) {
          const wire = { type: tag };
          const decoded = yield* S.decodeEffect(schema)(wire);
          const encoded = yield* S.encodeEffect(schema)(decoded);
          const fromDomain = yield* S.encodeEffect(schema)(made);
          deepStrictEqual(encoded, wire);
          deepStrictEqual(fromDomain, wire);
          return decoded.type === tag && made.type === tag && S.toEquivalence(schema)(decoded, made);
        })
      );
      assertTrue(A.every(results, identity));
    })
  );

  it.effect(
    "rejects every other tag, a missing tag and a non-record",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(
        payloadFreeRecords,
        Effect.fnUntraced(function* ([tag, schema]) {
          const others = A.filter(DataTypeKind.literals, (other) => other !== tag);
          const refusedTags = yield* Effect.all(A.map(others, (other) => rejects(schema)({ type: other })));
          const refusedShapes = yield* Effect.all([
            rejects(schema)({}),
            rejects(schema)(tag),
            rejects(schema)(null),
            rejects(schema)([tag]),
          ]);
          return A.every(refusedTags, identity) && A.every(refusedShapes, identity);
        })
      );
      assertTrue(A.every(results, identity));
    })
  );

  it.effect(
    "strips keys the tag does not declare",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeUnknownEffect(StringType)({ type: "string", maxLength: 12 });
      const encoded = yield* S.encodeEffect(StringType)(decoded);
      deepStrictEqual(encoded, { type: "string" });
    })
  );

  it("is exactly the bare tag on both sides", () => {
    const facts: readonly [
      Equals<typeof BooleanType.Encoded, { readonly type: "boolean" }>,
      Equals<typeof GeotimeSeriesReferenceType.Encoded, { readonly type: "geotimeSeriesReference" }>,
      Equals<typeof TimeSeriesReferenceType.Encoded, { readonly type: "timeSeriesReference" }>,
      Equals<BooleanType["type"], "boolean">,
      Equals<BooleanType, ByteType>,
    ] = [true, true, true, true, false];
    deepStrictEqual(facts, [true, true, true, true, false]);
  });

  it("is exactly the bare tag on both sides for the legacy, object-type and scenario records too", () => {
    const facts: readonly [
      Equals<typeof AnyType.Encoded, { readonly type: "any" }>,
      Equals<typeof ObjectTypeReferenceType.Encoded, { readonly type: "objectType" }>,
      Equals<typeof ScenarioReferenceType.Encoded, { readonly type: "scenarioReference" }>,
      Equals<AnyType["type"], "any">,
      Equals<ObjectTypeReferenceType["type"], "objectType">,
      Equals<ScenarioReferenceType["type"], "scenarioReference">,
    ] = [true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
    // Each of the three belongs to the universe its doc names.
    deepStrictEqual(
      [
        S.is(LegacyDataTypeKind)(AnyType.make({}).type),
        S.is(ActionParameterTypeKind)(ObjectTypeReferenceType.make({}).type),
        S.is(ActionParameterTypeKind)(ScenarioReferenceType.make({}).type),
        S.is(PropertyTypeKind)(AnyType.make({}).type),
      ],
      [true, true, true, false]
    );
  });

  // Pins which tags have a record here. Composite tags recurse into their own universe and are declared with it;
  // every payload-free tag of the vocabulary has a record.
  it("declares a record for every scalar and reference tag", () => {
    const withRecord = A.appendAll(
      A.map(payloadFreeRecords, ([tag]) => tag),
      payloadRecordTags
    );
    strictEqual(A.length(withRecord), 29);
    deepStrictEqual(A.difference(DataTypeKind.literals, withRecord), [
      "array",
      "set",
      "map",
      "entrySet",
      "struct",
      "union",
      "optional",
      "object",
      "objectSet",
      "interfaceObject",
      "interfaceObjectSet",
      "twoDimensionalAggregation",
      "threeDimensionalAggregation",
      "typeReference",
      "reference",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Tag records with a payload (09-wire-c-core-geo.md §17.1, 08-wire-b.md §5.1)
// ---------------------------------------------------------------------------

describe("DecimalType", () => {
  lawful("DecimalType", DecimalType);

  wireFixture(
    "DecimalType with precision and scale",
    DecimalType,
    { type: "decimal", precision: 38, scale: 10 },
    DecimalType.make({ precision: O.some(38), scale: O.some(10) })
  );
  wireFixture("DecimalType without bounds", DecimalType, { type: "decimal" }, DecimalType.make({}));
  wireFixture(
    "DecimalType with precision only",
    DecimalType,
    { type: "decimal", precision: 12 },
    DecimalType.make({ precision: O.some(12) })
  );
  wireFixture(
    "DecimalType with scale only",
    DecimalType,
    { type: "decimal", scale: 0 },
    DecimalType.make({ scale: O.some(0) })
  );

  it("defaults both bounds to absent in the constructor", () => {
    const unbounded = DecimalType.make({});
    strictEqual(unbounded.type, "decimal");
    assertNone(unbounded.precision);
    assertNone(unbounded.scale);
  });

  it("has optional numeric bounds on the wire and options in the domain", () => {
    const facts: readonly [
      Equals<
        typeof DecimalType.Encoded,
        { readonly type: "decimal"; readonly precision?: number; readonly scale?: number }
      >,
      Equals<DecimalType["precision"], O.Option<number>>,
      Equals<DecimalType["scale"], O.Option<number>>,
    ] = [true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "rejects a precision below one, a negative scale and fractional bounds",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(DecimalType)({ type: "decimal", precision: 0 }),
        rejects(DecimalType)({ type: "decimal", precision: -3 }),
        rejects(DecimalType)({ type: "decimal", precision: 1.5 }),
        rejects(DecimalType)({ type: "decimal", scale: -1 }),
        rejects(DecimalType)({ type: "decimal", scale: 0.5 }),
        rejects(DecimalType)({ type: "decimal", precision: "38" }),
        rejects(DecimalType)({ type: "decimal", precision: null }),
      ]);
      assertTrue(A.every(verdicts, identity));
      assertNone(DecimalType.makeOption({ precision: O.some(0) }));
      assertNone(DecimalType.makeOption({ scale: O.some(-1) }));
    })
  );

  // Law: when both bounds are stated, the scale is at most the precision.
  it.effect(
    "DecimalType: rejects a scale that exceeds the precision",
    Effect.fnUntraced(function* () {
      const refused = yield* rejects(DecimalType)({ type: "decimal", precision: 2, scale: 5 });
      assertTrue(refused);
    })
  );

  it.effect(
    "accepts a scale equal to the precision and rejects one digit more, on decode, encode and construction",
    Effect.fnUntraced(function* () {
      const atTheBound = yield* S.decodeEffect(DecimalType)({ type: "decimal", precision: 5, scale: 5 });
      deepStrictEqual([atTheBound.precision, atTheBound.scale], [O.some(5), O.some(5)]);
      const encoded = yield* S.encodeEffect(DecimalType)(atTheBound);
      deepStrictEqual(encoded, { type: "decimal", precision: 5, scale: 5 });
      const verdicts = yield* Effect.all([
        rejects(DecimalType)({ type: "decimal", precision: 5, scale: 6 }),
        rejects(DecimalType)({ type: "decimal", precision: 1, scale: 2 }),
        Effect.map(
          Effect.exit(S.encodeUnknownEffect(DecimalType)({ type: "decimal", precision: O.some(5), scale: O.some(6) })),
          Exit.isFailure
        ),
      ]);
      assertTrue(A.every(verdicts, identity));
      assertNone(DecimalType.makeOption({ precision: O.some(5), scale: O.some(6) }));
      assertSome(
        O.flatMap(DecimalType.makeOption({ precision: O.some(5), scale: O.some(5) }), ({ scale }) => scale),
        5
      );
      deepStrictEqual(
        [
          S.is(DecimalType)({ type: "decimal", precision: O.some(5), scale: O.some(6) }),
          S.is(DecimalType)({ type: "decimal", precision: O.some(6), scale: O.some(5) }),
        ],
        [false, true]
      );
    })
  );

  it("leaves a lone bound unconstrained: the invariant needs both", () => {
    // A scale with no precision, however large, and a precision with no scale are both legal.
    deepStrictEqual(
      [
        O.isSome(DecimalType.makeOption({ scale: O.some(400) })),
        O.isSome(DecimalType.makeOption({ precision: O.some(1) })),
        O.isSome(DecimalType.makeOption({})),
      ],
      [true, true, true]
    );
  });

  it.prop(
    "DecimalType: every generated value with both bounds keeps the scale within the precision",
    [Arbitrary.schema(DecimalType)],
    ([{ precision, scale }]) =>
      O.match(O.all([precision, scale]), { onNone: () => true, onSome: ([digits, fraction]) => fraction <= digits }),
    { arbitrary: fcRuns(100) }
  );
});

describe("MarkingType", () => {
  lawful("MarkingType", MarkingType);

  wireFixture(
    "MarkingType narrowed to classification markings",
    MarkingType,
    { type: "marking", markingType: "CBAC" },
    MarkingType.make({ markingType: O.some("cbac") })
  );
  wireFixture(
    "MarkingType narrowed to mandatory markings",
    MarkingType,
    { type: "marking", markingType: "MANDATORY" },
    MarkingType.make({ markingType: O.some("mandatory") })
  );
  wireFixture("MarkingType without a subtype", MarkingType, { type: "marking" }, MarkingType.make({}));

  it("defaults the subtype to absent and types the wire key as the upper-case enum", () => {
    assertNone(MarkingType.make({}).markingType);
    const facts: readonly [
      Equals<typeof MarkingType.Encoded, { readonly type: "marking"; readonly markingType?: "CBAC" | "MANDATORY" }>,
      Equals<MarkingType["markingType"], O.Option<MarkingKind>>,
    ] = [true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "rejects a subtype that is not the wire enum",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(MarkingType)({ type: "marking", markingType: "cbac" }),
        rejects(MarkingType)({ type: "marking", markingType: "ORGANIZATION" }),
        rejects(MarkingType)({ type: "marking", markingType: null }),
        rejects(MarkingType)({ type: "markings" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

describe("CipherTextType", () => {
  lawful("CipherTextType", CipherTextType);

  const channel = "ri.bellaso.main.cipher-channel.6d2ae41e-2d55-4b4b-a5dc-b3d22a8b0f2a";

  wireFixture(
    "CipherTextType with a default channel",
    CipherTextType,
    { type: "cipherText", defaultCipherChannel: channel },
    CipherTextType.make({ defaultCipherChannel: O.some(channel) })
  );
  wireFixture("CipherTextType without a channel", CipherTextType, { type: "cipherText" }, CipherTextType.make({}));

  it("defaults the channel to absent and keeps the wire key name", () => {
    assertNone(CipherTextType.make({}).defaultCipherChannel);
    const facts: readonly [
      Equals<typeof CipherTextType.Encoded, { readonly type: "cipherText"; readonly defaultCipherChannel?: string }>,
      Equals<CipherTextType["defaultCipherChannel"], O.Option<string>>,
    ] = [true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "rejects an empty channel and the lower-case tag",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(CipherTextType)({ type: "cipherText", defaultCipherChannel: "" }),
        rejects(CipherTextType)({ type: "cipherText", defaultCipherChannel: 7 }),
        rejects(CipherTextType)({ type: "ciphertext" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

describe("TimeseriesType", () => {
  lawful("StringType", StringType);
  lawful("DoubleType", DoubleType);
  lawful("SensorSeriesItem", SensorSeriesItem);
  lawful("TimeSeriesItem", TimeSeriesItem);
  lawful("TimeseriesType", TimeseriesType);

  const isCategorical = PropertyTypeRid.make("ri.ontology.main.property.is-categorical");

  wireFixture(
    "TimeseriesType of strings",
    TimeseriesType,
    { type: "timeseries", itemType: { type: "string" } },
    TimeseriesType.make({ itemType: StringType.make({}) })
  );
  wireFixture(
    "TimeseriesType of numbers",
    TimeseriesType,
    { type: "timeseries", itemType: { type: "double" } },
    TimeseriesType.make({ itemType: DoubleType.make({}) })
  );
  wireFixture(
    "TimeseriesType of a sensor that names its discriminating property",
    TimeseriesType,
    {
      type: "timeseries",
      itemType: { type: "numericOrNonNumeric", isNonNumericPropertyTypeId: "ri.ontology.main.property.is-categorical" },
    },
    TimeseriesType.make({ itemType: SensorSeriesItem.make({ isNonNumericProperty: O.some(isCategorical) }) })
  );
  wireFixture(
    "TimeseriesType of a sensor whose kind is inferred",
    TimeseriesType,
    { type: "timeseries", itemType: { type: "numericOrNonNumeric" } },
    TimeseriesType.make({ itemType: SensorSeriesItem.make({}) })
  );

  it("renames the sensor's wire key and keeps the three item tags of the wire", () => {
    type WireItem =
      | { readonly type: "string" }
      | { readonly type: "double" }
      | { readonly type: "numericOrNonNumeric"; readonly isNonNumericPropertyTypeId?: string };
    const facts: readonly [
      Equals<typeof TimeSeriesItem.Encoded, WireItem>,
      Equals<typeof TimeseriesType.Encoded, { readonly type: "timeseries"; readonly itemType: WireItem }>,
      Equals<TimeSeriesItem, StringType | DoubleType | SensorSeriesItem>,
      Equals<SensorSeriesItem["isNonNumericProperty"], O.Option<PropertyTypeRid>>,
    ] = [true, true, true, true];
    assertTrue(A.every(facts, identity));
    assertNone(SensorSeriesItem.make({}).isNonNumericProperty);
  });

  it("constructs, guards and matches every item case", () => {
    const items = {
      string: TimeSeriesItem.cases.string.make({}),
      double: TimeSeriesItem.cases.double.make({}),
      numericOrNonNumeric: TimeSeriesItem.cases.numericOrNonNumeric.make({
        isNonNumericProperty: O.some(isCategorical),
      }),
    };
    const describeItem = TimeSeriesItem.match({
      string: () => "categorical",
      double: () => "numeric",
      numericOrNonNumeric: ({ isNonNumericProperty }) =>
        O.isSome(isNonNumericProperty) ? "declared sensor" : "sensor",
    });
    deepStrictEqual(
      [describeItem(items.string), describeItem(items.double), describeItem(items.numericOrNonNumeric)],
      ["categorical", "numeric", "declared sensor"]
    );
    assertTrue(TimeSeriesItem.guards.string(items.string));
    assertTrue(TimeSeriesItem.guards.double(items.double));
    assertTrue(TimeSeriesItem.guards.numericOrNonNumeric(items.numericOrNonNumeric));
    assertFalse(TimeSeriesItem.guards.string(items.double));
    const isPlain = TimeSeriesItem.isAnyOf(["string", "double"]);
    deepStrictEqual(
      [isPlain(items.string), isPlain(items.double), isPlain(items.numericOrNonNumeric)],
      [true, true, false]
    );
    deepStrictEqual(TimeSeriesItem.discriminants, ["string", "double", "numericOrNonNumeric"]);
  });

  it.effect(
    "rejects a missing item type, OSDK's split tags and the domain key on the wire",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(TimeseriesType)({ type: "timeseries" }),
        rejects(TimeseriesType)({ type: "timeseries", itemType: { type: "integer" } }),
        rejects(TimeseriesType)({ type: "timeseries", itemType: "double" }),
        rejects(TimeseriesType)({ type: "numericTimeseries" }),
        rejects(TimeseriesType)({ type: "timeSeries", itemType: { type: "double" } }),
        rejects(TimeSeriesItem)({ type: "numericOrNonNumeric", isNonNumericPropertyTypeId: "" }),
      ]);
      assertTrue(A.every(verdicts, identity));
      // The domain key is not a wire key: it is ignored like any undeclared key, so the reference is lost.
      const decoded = yield* S.decodeUnknownEffect(SensorSeriesItem)({
        type: "numericOrNonNumeric",
        isNonNumericProperty: "ri.ontology.main.property.is-categorical",
      });
      assertNone(decoded.isNonNumericProperty);
    })
  );
});

describe("VectorType", () => {
  lawful("HostedEmbedding", HostedEmbedding);
  lawful("DeployedEmbedding", DeployedEmbedding);
  lawful("EmbeddingSource", EmbeddingSource);
  lawful("VectorType", VectorType);

  const deployment = "ri.foundry-ml-live.main.live-deployment.2f4a1c3e-0000-4000-8000-000000000001";

  wireFixture(
    "VectorType with every similarity function and a hosted model",
    VectorType,
    {
      type: "vector",
      dimension: 1536,
      supportsSearchWith: [{ value: "COSINE_SIMILARITY" }, { value: "DOT_PRODUCT" }, { value: "EUCLIDEAN_DISTANCE" }],
      embeddingModel: { type: "lms", value: "OPENAI_TEXT_EMBEDDING_ADA_002" },
    },
    VectorType.make({
      dimension: 1536,
      supportsSearchWith: ["cosine", "dotProduct", "euclidean"],
      embeddingModel: O.some(HostedEmbedding.make({ model: "openAiTextEmbeddingAda002" })),
    })
  );
  wireFixture(
    "VectorType with a deployed model that names every parameter",
    VectorType,
    {
      type: "vector",
      dimension: 768,
      supportsSearchWith: [{ value: "DOT_PRODUCT" }],
      embeddingModel: {
        type: "foundryLiveDeployment",
        rid: deployment,
        inputParamName: "text",
        outputParamName: "embedding",
      },
    },
    VectorType.make({
      dimension: 768,
      supportsSearchWith: ["dotProduct"],
      embeddingModel: O.some(
        DeployedEmbedding.make({
          rid: O.some(deployment),
          inputParamName: O.some("text"),
          outputParamName: O.some("embedding"),
        })
      ),
    })
  );
  wireFixture(
    "VectorType with a deployed model that names nothing",
    VectorType,
    { type: "vector", dimension: 3, supportsSearchWith: [], embeddingModel: { type: "foundryLiveDeployment" } },
    VectorType.make({ dimension: 3, embeddingModel: O.some(DeployedEmbedding.make({})) })
  );
  // The shape of the OSDK test stub `objectTypeWithAllPropertyTypes.properties.vector`.
  wireFixture(
    "VectorType with no search support and no model",
    VectorType,
    { type: "vector", dimension: 100, supportsSearchWith: [] },
    VectorType.make({ dimension: 100 })
  );

  it("defaults search support to none and the model to absent in the constructor only", () => {
    const vector = VectorType.make({ dimension: 3 });
    deepStrictEqual(vector.supportsSearchWith, []);
    assertNone(vector.embeddingModel);
    const deployed = DeployedEmbedding.make({});
    assertNone(deployed.rid);
    assertNone(deployed.inputParamName);
    assertNone(deployed.outputParamName);
  });

  it("has the wire's wrapped similarity functions and tagged model as its encoded side", () => {
    type WireModel =
      | "OPENAI_TEXT_EMBEDDING_ADA_002"
      | "TEXT_EMBEDDING_3_LARGE"
      | "TEXT_EMBEDDING_3_SMALL"
      | "SNOWFLAKE_ARCTIC_EMBED_M"
      | "INSTRUCTOR_LARGE"
      | "BGE_BASE_EN_V1_5";
    type WireEmbedding =
      | { readonly type: "lms"; readonly value: WireModel }
      | {
          readonly type: "foundryLiveDeployment";
          readonly rid?: string;
          readonly inputParamName?: string;
          readonly outputParamName?: string;
        };
    type WireVector = {
      readonly type: "vector";
      readonly dimension: number;
      readonly supportsSearchWith?: ReadonlyArray<{
        readonly value?: "COSINE_SIMILARITY" | "DOT_PRODUCT" | "EUCLIDEAN_DISTANCE";
      }>;
      readonly embeddingModel?: WireEmbedding;
    };
    const facts: readonly [
      Equals<typeof EmbeddingSource.Encoded, WireEmbedding>,
      Equals<typeof VectorType.Encoded, WireVector>,
      Equals<VectorType["supportsSearchWith"], ReadonlyArray<VectorSimilarity>>,
      Equals<VectorType["embeddingModel"], O.Option<HostedEmbedding | DeployedEmbedding>>,
      Equals<HostedEmbedding["model"], HostedEmbeddingModel>,
    ] = [true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes every similarity function out of its wire wrapper and wraps it again on encode",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(
        VectorSimilarity.Pairs,
        Effect.fnUntraced(function* ([wire, domain]) {
          const fixture: typeof VectorType.Encoded = {
            type: "vector",
            dimension: 2,
            supportsSearchWith: [{ value: wire }],
          };
          const decoded = yield* S.decodeEffect(VectorType)(fixture);
          const encoded = yield* S.encodeEffect(VectorType)(decoded);
          deepStrictEqual(decoded.supportsSearchWith, [domain]);
          deepStrictEqual(encoded, fixture);
          return true;
        })
      );
      strictEqual(A.length(results), 3);
    })
  );

  it.effect(
    "drops a similarity wrapper whose value the server omitted",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(VectorType)({
        type: "vector",
        dimension: 2,
        supportsSearchWith: [{}, { value: "DOT_PRODUCT" }, {}],
      });
      deepStrictEqual(decoded.supportsSearchWith, ["dotProduct"]);
      const encoded = yield* S.encodeEffect(VectorType)(decoded);
      deepStrictEqual(encoded, { type: "vector", dimension: 2, supportsSearchWith: [{ value: "DOT_PRODUCT" }] });
    })
  );

  it.effect(
    "decodes every hosted model from the wire key `value` into the domain key `model`",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(
        HostedEmbeddingModel.Pairs,
        Effect.fnUntraced(function* ([wire, domain]) {
          const fixture: typeof EmbeddingSource.Encoded = { type: "lms", value: wire };
          const decoded = yield* S.decodeEffect(EmbeddingSource)(fixture);
          const encoded = yield* S.encodeEffect(EmbeddingSource)(decoded);
          deepStrictEqual(encoded, fixture);
          return EmbeddingSource.match(decoded, {
            lms: ({ model }) => model === domain,
            foundryLiveDeployment: () => false,
          });
        })
      );
      strictEqual(A.length(results), 6);
      assertTrue(A.every(results, identity));
    })
  );

  it("constructs, guards and matches every embedding source", () => {
    const hosted = EmbeddingSource.cases.lms.make({ model: "bgeBaseEnV15" });
    const deployed = EmbeddingSource.cases.foundryLiveDeployment.make({ rid: O.some(deployment) });
    const describeSource = EmbeddingSource.match({
      lms: ({ model }) => `hosted ${model}`,
      foundryLiveDeployment: ({ rid }) => `deployed ${O.getOrElse(rid, () => "?")}`,
    });
    deepStrictEqual(
      [describeSource(hosted), describeSource(deployed)],
      ["hosted bgeBaseEnV15", `deployed ${deployment}`]
    );
    assertTrue(EmbeddingSource.guards.lms(hosted));
    assertTrue(EmbeddingSource.guards.foundryLiveDeployment(deployed));
    assertFalse(EmbeddingSource.guards.lms(deployed));
    assertTrue(EmbeddingSource.isAnyOf(["lms"])(hosted));
    assertFalse(EmbeddingSource.isAnyOf(["lms"])(deployed));
    deepStrictEqual(EmbeddingSource.discriminants, ["lms", "foundryLiveDeployment"]);
  });

  it.effect(
    "rejects a dimension that is not a positive integer",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(VectorType)({ type: "vector", dimension: 0, supportsSearchWith: [] }),
        rejects(VectorType)({ type: "vector", dimension: -1, supportsSearchWith: [] }),
        rejects(VectorType)({ type: "vector", dimension: 1.5, supportsSearchWith: [] }),
        rejects(VectorType)({ type: "vector", dimension: "3", supportsSearchWith: [] }),
        rejects(VectorType)({ type: "vector", supportsSearchWith: [] }),
      ]);
      assertTrue(A.every(verdicts, identity));
      assertNone(VectorType.makeOption({ dimension: 0 }));
      assertSome(
        O.map(VectorType.makeOption({ dimension: 1 }), (vector) => vector.dimension),
        1
      );
    })
  );

  it.effect(
    "reads an absent search-support key as no functions, writes it back, and rejects malformed members",
    Effect.fnUntraced(function* () {
      // Saved ontology documents leave empty collections out (Conjure semantics); the canonical form writes them.
      const saved = yield* S.decodeEffect(VectorType)({ type: "vector", dimension: 3 });
      deepStrictEqual(saved, VectorType.make({ dimension: 3 }));
      const canonical = yield* S.encodeEffect(VectorType)(saved);
      deepStrictEqual(canonical, { type: "vector", dimension: 3, supportsSearchWith: [] });
      const verdicts = yield* Effect.all([
        rejects(VectorType)({ type: "vector", dimension: 3, supportsSearchWith: {} }),
        rejects(VectorType)({ type: "vector", dimension: 3, supportsSearchWith: ["COSINE_SIMILARITY"] }),
        rejects(VectorType)({ type: "vector", dimension: 3, supportsSearchWith: [{ value: "cosine" }] }),
        rejects(VectorType)({ type: "vector", dimension: 3, supportsSearchWith: [], embeddingModel: { type: "lms" } }),
        rejects(VectorType)({
          type: "vector",
          dimension: 3,
          supportsSearchWith: [],
          embeddingModel: { type: "lms", value: "textEmbedding3Small" },
        }),
        rejects(VectorType)({
          type: "vector",
          dimension: 3,
          supportsSearchWith: [],
          embeddingModel: { type: "foundryLiveDeployment", rid: "" },
        }),
        rejects(VectorType)({
          type: "vector",
          dimension: 3,
          supportsSearchWith: [],
          embeddingModel: { type: "custom" },
        }),
        // The domain key `model` is not a wire key.
        rejects(EmbeddingSource)({ type: "lms", model: "TEXT_EMBEDDING_3_SMALL" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

describe("UnsupportedType", () => {
  lawful("UnsupportedType", UnsupportedType);

  wireFixture(
    "UnsupportedType with parameters",
    UnsupportedType,
    { type: "unsupported", unsupportedType: "experimentalTensor", params: { rank: "3", dtype: "float32" } },
    UnsupportedType.make({ unsupportedType: "experimentalTensor", params: { rank: "3", dtype: "float32" } })
  );
  wireFixture(
    "UnsupportedType without parameters",
    UnsupportedType,
    { type: "unsupported", unsupportedType: "experimentalTensor", params: {} },
    UnsupportedType.make({ unsupportedType: "experimentalTensor" })
  );

  it("defaults the parameters to an empty record in the constructor only", () => {
    deepStrictEqual(UnsupportedType.make({ unsupportedType: "x" }).params, {});
    const facts: readonly [
      Equals<
        typeof UnsupportedType.Encoded,
        {
          readonly type: "unsupported";
          readonly unsupportedType: string;
          readonly params: { readonly [x: string]: string };
        }
      >,
    ] = [true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "requires both wire keys and string-valued parameters",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(UnsupportedType)({ type: "unsupported", unsupportedType: "x" }),
        rejects(UnsupportedType)({ type: "unsupported", params: {} }),
        rejects(UnsupportedType)({ type: "unsupported", unsupportedType: "x", params: { rank: 3 } }),
        rejects(UnsupportedType)({ type: "unsupported", unsupportedType: "x", params: [] }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});
