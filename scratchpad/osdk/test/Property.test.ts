import { LocalDate } from "@beep/schema/LocalDate";
import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as BigDecimal from "effect/BigDecimal";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import {
  AttachmentType,
  BooleanType,
  ByteType,
  CipherTextType,
  DataTypeKind,
  DateType,
  DecimalType,
  DoubleType,
  FloatType,
  GeoPointType,
  GeoShapeType,
  GeotimeSeriesReferenceType,
  HostedEmbedding,
  IntegerType,
  LongType,
  MarkingType,
  MediaReferenceType,
  PropertyTypeKind,
  SensorSeriesItem,
  ShortType,
  StringType,
  TimeseriesType,
  TimestampType,
  VectorType,
} from "../src/DataType/index.ts";
import {
  PropertyApiName,
  PropertyTypeRid,
  SharedPropertyTypeApiName,
  SharedPropertyTypeRid,
  StructFieldApiName,
  StructFieldTypeRid,
  ValueTypeApiName,
} from "../src/Identifier/index.ts";
import { TypeClass } from "../src/Metadata/index.ts";
import {
  ActiveProperty,
  ArrayReducer,
  ArrayReducerDirection,
  ArrayType,
  DeprecatedProperty,
  decodeAddressTo,
  ExampleProperty,
  ExperimentalProperty,
  fieldCodec,
  Nullability,
  operandCodec,
  operandType,
  PrimaryKeyProperty,
  PropertyAddressFields,
  PropertyAtLoadLevel,
  PropertyByName,
  PropertyDataConstraints,
  PropertyDefinition,
  PropertyLoadLevel,
  PropertySelector,
  PropertyStatus,
  PropertyType,
  SharedPropertyType,
  selectedType,
  StructFieldOfProperty,
  StructFieldType,
  StructMainValue,
  StructType,
  TitleProperty,
  valueCodec,
} from "../src/Property/index.ts";
import { ScalarValue } from "../src/Value/index.ts";
import { ValueFormat } from "../src/ValueFormat/index.ts";

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

const refusesToEncode =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.encodeUnknownEffect(schema)(input)), Exit.isFailure);

// Decodes a wire value with a projected codec and encodes the result back.
const throughCodec = Effect.fnUntraced(function* (type: PropertyType, wire: unknown) {
  const codec = valueCodec(type);
  const decoded = yield* S.decodeUnknownEffect(codec)(wire);
  const encoded = yield* S.encodeUnknownEffect(codec)(decoded);
  return { decoded, encoded };
});

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

const uuid = "401ac022-89eb-4591-8b7e-0a912b9efb44";
const cipherChannel = "ri.bellaso.main.cipher-channel.6d2ae41e-2d55-4b4b-a5dc-b3d22a8b0f2a";
const isCategorical = "ri.ontology.main.property.is-categorical";

const structField = (apiName: string, rid: string, dataType: PropertyType): StructFieldType =>
  StructFieldType.make({
    apiName: StructFieldApiName.make(apiName),
    rid: StructFieldTypeRid.make(rid),
    dataType,
  });

// ---------------------------------------------------------------------------
// One wire fixture per property type (08-wire-b.md §5.1, the 22 members of `ObjectPropertyType`)
// ---------------------------------------------------------------------------

// The struct and the nested array of structs are the `employeeProfile` and `bonusHistory` properties of the OSDK
// test stub `employeeObjectType` (osdk-ts `packages/shared.test/src/stubs/objectTypeV2.ts`), verbatim.
const employeeProfileWire: PropertyType.Encoded = {
  type: "struct",
  structFieldTypes: [
    { apiName: "bio", dataType: { type: "string" }, rid: "ri.struct.bio", typeClasses: [] },
    { apiName: "yearsExperience", dataType: { type: "integer" }, rid: "ri.struct.yearsExperience", typeClasses: [] },
  ],
  mainValue: { mainValueType: { type: "string" }, fields: ["bio"] },
};

const employeeProfile = StructType.make({
  fields: [
    structField("bio", "ri.struct.bio", StringType.make({})),
    structField("yearsExperience", "ri.struct.yearsExperience", IntegerType.make({})),
  ],
  mainValue: O.some(
    StructMainValue.make({ mainValueType: StringType.make({}), fields: [StructFieldApiName.make("bio")] })
  ),
});

const bonusHistoryWire: PropertyType.Encoded = {
  type: "array",
  subType: {
    type: "struct",
    structFieldTypes: [
      { apiName: "year", dataType: { type: "integer" }, rid: "ri.struct.year", typeClasses: [] },
      { apiName: "amount", dataType: { type: "integer" }, rid: "ri.struct.amount", typeClasses: [] },
    ],
    mainValue: { mainValueType: { type: "integer" }, fields: ["amount"] },
  },
  reducers: [{ direction: "DESCENDING_NULLS_LAST", field: "year" }],
};

const bonusHistory = ArrayType.make({
  elementType: StructType.make({
    fields: [
      structField("year", "ri.struct.year", IntegerType.make({})),
      structField("amount", "ri.struct.amount", IntegerType.make({})),
    ],
    mainValue: O.some(
      StructMainValue.make({ mainValueType: IntegerType.make({}), fields: [StructFieldApiName.make("amount")] })
    ),
  }),
  reducers: [
    ArrayReducer.make({ direction: "descendingNullsLast", field: O.some(StructFieldApiName.make("year")) }),
  ],
});

const perCase: { readonly [K in PropertyTypeKind]: readonly [wire: PropertyType.Encoded, domain: PropertyType] } = {
  boolean: [{ type: "boolean" }, BooleanType.make({})],
  byte: [{ type: "byte" }, ByteType.make({})],
  short: [{ type: "short" }, ShortType.make({})],
  integer: [{ type: "integer" }, IntegerType.make({})],
  long: [{ type: "long" }, LongType.make({})],
  float: [{ type: "float" }, FloatType.make({})],
  double: [{ type: "double" }, DoubleType.make({})],
  decimal: [
    { type: "decimal", precision: 38, scale: 10 },
    DecimalType.make({ precision: O.some(38), scale: O.some(10) }),
  ],
  string: [{ type: "string" }, StringType.make({})],
  date: [{ type: "date" }, DateType.make({})],
  timestamp: [{ type: "timestamp" }, TimestampType.make({})],
  marking: [{ type: "marking", markingType: "MANDATORY" }, MarkingType.make({ markingType: O.some("mandatory") })],
  cipherText: [
    { type: "cipherText", defaultCipherChannel: cipherChannel },
    CipherTextType.make({ defaultCipherChannel: O.some(cipherChannel) }),
  ],
  attachment: [{ type: "attachment" }, AttachmentType.make({})],
  mediaReference: [{ type: "mediaReference" }, MediaReferenceType.make({})],
  geopoint: [{ type: "geopoint" }, GeoPointType.make({})],
  geoshape: [{ type: "geoshape" }, GeoShapeType.make({})],
  geotimeSeriesReference: [{ type: "geotimeSeriesReference" }, GeotimeSeriesReferenceType.make({})],
  timeseries: [
    { type: "timeseries", itemType: { type: "numericOrNonNumeric", isNonNumericPropertyTypeId: isCategorical } },
    TimeseriesType.make({
      itemType: SensorSeriesItem.make({ isNonNumericProperty: O.some(PropertyTypeRid.make(isCategorical)) }),
    }),
  ],
  // The `skillSetEmbedding` property of the OSDK test stub `employeeObjectType`.
  vector: [
    {
      type: "vector",
      dimension: 1536,
      supportsSearchWith: [{ value: "COSINE_SIMILARITY" }],
      embeddingModel: { type: "lms", value: "OPENAI_TEXT_EMBEDDING_ADA_002" },
    },
    VectorType.make({
      dimension: 1536,
      supportsSearchWith: ["cosine"],
      embeddingModel: O.some(HostedEmbedding.make({ model: "openAiTextEmbeddingAda002" })),
    }),
  ],
  array: [
    { type: "array", subType: { type: "string" }, reducers: [] },
    ArrayType.make({ elementType: StringType.make({}) }),
  ],
  struct: [employeeProfileWire, employeeProfile],
};

const describeType: (type: PropertyType) => string = PropertyType.match({
  boolean: () => "boolean",
  byte: () => "byte",
  short: () => "short",
  integer: () => "integer",
  long: () => "long",
  float: () => "float",
  double: () => "double",
  decimal: ({ precision, scale }) => `decimal(${O.getOrElse(precision, () => 0)},${O.getOrElse(scale, () => 0)})`,
  string: () => "string",
  date: () => "date",
  timestamp: () => "timestamp",
  marking: ({ markingType }) => `marking<${O.getOrElse(markingType, () => "any")}>`,
  cipherText: ({ defaultCipherChannel }) => (O.isSome(defaultCipherChannel) ? "cipherText with channel" : "cipherText"),
  attachment: () => "attachment",
  mediaReference: () => "mediaReference",
  geopoint: () => "geopoint",
  geoshape: () => "geoshape",
  geotimeSeriesReference: () => "geotimeSeriesReference",
  timeseries: ({ itemType }) => `timeseries<${itemType.type}>`,
  vector: ({ dimension }) => `vector[${dimension}]`,
  array: ({ elementType }) => `array<${describeType(elementType)}>`,
  struct: ({ fields }) => {
    const members = A.map(fields, (field) => `${field.apiName}: ${describeType(field.dataType)}`);
    return `struct{${A.join(members, ", ")}}`;
  },
});

describe("PropertyType", () => {
  lawful("ArrayReducerDirection", ArrayReducerDirection);
  lawful("ArrayReducer", ArrayReducer);
  lawful("ArrayType", ArrayType);
  lawful("StructFieldType", StructFieldType);
  lawful("StructMainValue", StructMainValue);
  lawful("StructType", StructType);
  lawful("PropertyType", PropertyType);

  it("has exactly the property tags as its cases, in the kit's order", () => {
    const tags: ReadonlyArray<string> = PropertyTypeKind.literals;
    const caseKeys: ReadonlyArray<string> = R.keys(PropertyType.cases);
    const discriminants: ReadonlyArray<string> = PropertyType.discriminants;
    const fixtureKeys: ReadonlyArray<string> = R.keys(perCase);
    strictEqual(A.length(tags), 22);
    deepStrictEqual(caseKeys, tags);
    deepStrictEqual(discriminants, tags);
    deepStrictEqual(fixtureKeys, tags);
    strictEqual(PropertyType.tag, "type");
  });

  it.effect(
    "decodes the wire fixture of every case, guards it, and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const equivalence = S.toEquivalence(PropertyType);
      const results = yield* Effect.forEach(
        PropertyTypeKind.literals,
        Effect.fnUntraced(function* (kind) {
          const [wire, domain] = perCase[kind];
          const decoded = yield* S.decodeEffect(PropertyType)(wire);
          const encoded = yield* S.encodeEffect(PropertyType)(decoded);
          const fromDomain = yield* S.encodeEffect(PropertyType)(domain);
          deepStrictEqual(encoded, wire);
          deepStrictEqual(fromDomain, wire);
          return (
            decoded.type === kind &&
            domain.type === kind &&
            equivalence(decoded, domain) &&
            PropertyType.guards[kind](decoded) &&
            PropertyType.isAnyOf([kind])(decoded)
          );
        })
      );
      strictEqual(A.length(results), 22);
      assertTrue(A.every(results, identity));
    })
  );

  it("matches every case exhaustively", () => {
    deepStrictEqual(
      A.map(PropertyTypeKind.literals, (kind) => describeType(perCase[kind][1])),
      [
        "boolean",
        "byte",
        "short",
        "integer",
        "long",
        "float",
        "double",
        "decimal(38,10)",
        "string",
        "date",
        "timestamp",
        "marking<mandatory>",
        "cipherText with channel",
        "attachment",
        "mediaReference",
        "geopoint",
        "geoshape",
        "geotimeSeriesReference",
        "timeseries<numericOrNonNumeric>",
        "vector[1536]",
        "array<string>",
        "struct{bio: string, yearsExperience: integer}",
      ]
    );
    strictEqual(describeType(bonusHistory), "array<struct{year: integer, amount: integer}>");
  });

  it("constructs every case through its case schema and tells collections from leaves", () => {
    const viaCases: ReadonlyArray<PropertyType> = [
      PropertyType.cases.boolean.make({}),
      PropertyType.cases.decimal.make({}),
      PropertyType.cases.marking.make({}),
      PropertyType.cases.cipherText.make({}),
      PropertyType.cases.timeseries.make({ itemType: DoubleType.make({}) }),
      PropertyType.cases.vector.make({ dimension: 3 }),
      PropertyType.cases.array.make({ elementType: PropertyType.cases.long.make({}) }),
      PropertyType.cases.struct.make({ fields: [] }),
    ];
    deepStrictEqual(A.map(viaCases, describeType), [
      "boolean",
      "decimal(0,0)",
      "marking<any>",
      "cipherText",
      "timeseries<double>",
      "vector[3]",
      "array<long>",
      "struct{}",
    ]);
    const isCollection = PropertyType.isAnyOf(["array", "struct"]);
    deepStrictEqual(A.map(viaCases, isCollection), [false, false, false, false, false, false, true, true]);
    assertTrue(A.every(viaCases, S.is(PropertyType)));
  });

  it.effect(
    "rejects every tag that belongs to another universe, OSDK's renamed tags and a missing tag",
    Effect.fnUntraced(function* () {
      const foreignTags = A.filter(DataTypeKind.literals, (tag) => !S.is(PropertyTypeKind)(tag));
      strictEqual(A.length(foreignTags), 22);
      const foreign = yield* Effect.all(A.map(foreignTags, (tag) => rejects(PropertyType)({ type: tag })));
      const renamed = yield* Effect.all([
        rejects(PropertyType)({ type: "datetime" }),
        rejects(PropertyType)({ type: "numericTimeseries" }),
        rejects(PropertyType)({ type: "stringTimeseries" }),
        rejects(PropertyType)({ type: "sensorTimeseries" }),
        rejects(PropertyType)({}),
        rejects(PropertyType)("string"),
        rejects(PropertyType)(null),
        rejects(PropertyType)([{ type: "string" }]),
      ]);
      assertTrue(A.every(foreign, identity));
      assertTrue(A.every(renamed, identity));
    })
  );

  it.effect(
    "strips keys a case does not declare, such as OSDK's multiplicity flag",
    Effect.fnUntraced(function* () {
      const flagged = { type: "string", multiplicity: true, nullable: false };
      const decoded = yield* S.decodeUnknownEffect(PropertyType)(flagged);
      const encoded = yield* S.encodeEffect(PropertyType)(decoded);
      deepStrictEqual(encoded, { type: "string" });
    })
  );

  it.effect(
    "a vector saved without its similarity functions decodes with none, and the list is written back",
    Effect.fnUntraced(function* () {
      // Saved ontology documents leave empty collections out (Conjure semantics); the canonical form writes them.
      const decoded = yield* S.decodeEffect(PropertyType)({ type: "vector", dimension: 1536 });
      deepStrictEqual(decoded, VectorType.make({ dimension: 1536 }));
      const encoded = yield* S.encodeEffect(PropertyType)(decoded);
      deepStrictEqual(encoded, { type: "vector", dimension: 1536, supportsSearchWith: [] });
      const wrongShape = yield* rejects(PropertyType)({ type: "vector", dimension: 1536, supportsSearchWith: {} });
      assertTrue(wrongShape);
    })
  );
});

// ---------------------------------------------------------------------------
// Arrays and structs
// ---------------------------------------------------------------------------

describe("ArrayType and StructType", () => {
  wireFixture(
    "ArrayType of structs with a reducer (OSDK stub bonusHistory)",
    PropertyType,
    bonusHistoryWire,
    bonusHistory
  );
  wireFixture(
    "StructType with a main value (OSDK stub employeeProfile)",
    PropertyType,
    employeeProfileWire,
    employeeProfile
  );

  // An array of arrays of structs whose fields are themselves an array and a struct: every recursive edge at once.
  wireFixture(
    "ArrayType nested in an ArrayType, over structs that nest arrays and structs",
    PropertyType,
    {
      type: "array",
      subType: {
        type: "array",
        subType: {
          type: "struct",
          structFieldTypes: [
            {
              apiName: "tags",
              rid: "ri.struct.tags",
              dataType: { type: "array", subType: { type: "string" }, reducers: [] },
              typeClasses: [{ kind: "render_hint", name: "SELECTABLE" }],
            },
            {
              apiName: "location",
              rid: "ri.struct.location",
              dataType: {
                type: "struct",
                structFieldTypes: [
                  { apiName: "point", rid: "ri.struct.point", dataType: { type: "geopoint" }, typeClasses: [] },
                  {
                    apiName: "measuredAt",
                    rid: "ri.struct.measured-at",
                    dataType: { type: "timestamp" },
                    typeClasses: [],
                  },
                ],
                mainValue: { mainValueType: { type: "geopoint" }, fields: ["point"] },
              },
              typeClasses: [],
            },
          ],
        },
        reducers: [{ direction: "ASCENDING_NULLS_LAST" }],
      },
      reducers: [],
    },
    ArrayType.make({
      elementType: ArrayType.make({
        elementType: StructType.make({
          fields: [
            StructFieldType.make({
              apiName: StructFieldApiName.make("tags"),
              rid: StructFieldTypeRid.make("ri.struct.tags"),
              dataType: ArrayType.make({ elementType: StringType.make({}) }),
              typeClasses: [TypeClass.make({ kind: "render_hint", name: "SELECTABLE" })],
            }),
            structField(
              "location",
              "ri.struct.location",
              StructType.make({
                fields: [
                  structField("point", "ri.struct.point", GeoPointType.make({})),
                  structField("measuredAt", "ri.struct.measured-at", TimestampType.make({})),
                ],
                mainValue: O.some(
                  StructMainValue.make({
                    mainValueType: GeoPointType.make({}),
                    fields: [StructFieldApiName.make("point")],
                  })
                ),
              })
            ),
          ],
        }),
        reducers: [ArrayReducer.make({ direction: "ascendingNullsLast" })],
      }),
    })
  );

  wireFixture(
    "ArrayReducer with a struct field",
    ArrayReducer,
    { direction: "ASCENDING_NULLS_LAST", field: "year" },
    ArrayReducer.make({ direction: "ascendingNullsLast", field: O.some(StructFieldApiName.make("year")) })
  );
  wireFixture(
    "ArrayReducer without a field",
    ArrayReducer,
    { direction: "DESCENDING_NULLS_LAST" },
    ArrayReducer.make({ direction: "descendingNullsLast" })
  );
  wireFixture(
    "StructMainValue",
    StructMainValue,
    { mainValueType: { type: "integer" }, fields: ["amount"] },
    StructMainValue.make({ mainValueType: IntegerType.make({}), fields: [StructFieldApiName.make("amount")] })
  );
  wireFixture(
    "StructFieldType",
    StructFieldType,
    { apiName: "bio", rid: "ri.struct.bio", dataType: { type: "string" }, typeClasses: [{ kind: "k", name: "n" }] },
    StructFieldType.make({
      apiName: StructFieldApiName.make("bio"),
      rid: StructFieldTypeRid.make("ri.struct.bio"),
      dataType: StringType.make({}),
      typeClasses: [TypeClass.make({ kind: "k", name: "n" })],
    })
  );

  it("pairs the reducer directions of the wire with their domain literals", () => {
    deepStrictEqual(ArrayReducerDirection.Pairs, [
      ["ASCENDING_NULLS_LAST", "ascendingNullsLast"],
      ["DESCENDING_NULLS_LAST", "descendingNullsLast"],
    ]);
    const keepsLargest = ArrayReducerDirection.To.match({
      ascendingNullsLast: () => false,
      descendingNullsLast: () => true,
    });
    const directions: ReadonlyArray<ArrayReducerDirection> = ["ascendingNullsLast", "descendingNullsLast"];
    deepStrictEqual(A.map(directions, keepsLargest), [false, true]);
  });

  it("defaults reducers, type classes, the reducer field and the main value in the constructors", () => {
    const array = ArrayType.make({ elementType: StringType.make({}) });
    const struct = StructType.make({ fields: [] });
    const field = structField("bio", "ri.struct.bio", StringType.make({}));
    deepStrictEqual(array.reducers, []);
    deepStrictEqual(field.typeClasses, []);
    assertNone(struct.mainValue);
    assertNone(ArrayReducer.make({ direction: "ascendingNullsLast" }).field);
    strictEqual(array.type, "array");
    strictEqual(struct.type, "struct");
  });

  it.effect(
    "defaults reducers and type classes when the wire omits them, and always emits them",
    Effect.fnUntraced(function* () {
      const array = yield* S.decodeEffect(PropertyType)({ type: "array", subType: { type: "string" } });
      const struct = yield* S.decodeEffect(PropertyType)({
        type: "struct",
        structFieldTypes: [{ apiName: "bio", rid: "ri.struct.bio", dataType: { type: "string" } }],
      });
      assertTrue(S.toEquivalence(PropertyType)(array, ArrayType.make({ elementType: StringType.make({}) })));
      assertTrue(
        S.toEquivalence(PropertyType)(
          struct,
          StructType.make({ fields: [structField("bio", "ri.struct.bio", StringType.make({}))] })
        )
      );
      const encodedArray = yield* S.encodeEffect(PropertyType)(array);
      const encodedStruct = yield* S.encodeEffect(PropertyType)(struct);
      deepStrictEqual(encodedArray, { type: "array", subType: { type: "string" }, reducers: [] });
      deepStrictEqual(encodedStruct, {
        type: "struct",
        structFieldTypes: [{ apiName: "bio", rid: "ri.struct.bio", dataType: { type: "string" }, typeClasses: [] }],
      });
    })
  );

  it("renames the wire keys subType and structFieldTypes, and declares the encoded shapes it really has", () => {
    const facts: readonly [
      Equals<(typeof ArrayType)["Encoded"], ArrayType.Encoded>,
      Equals<(typeof StructType)["Encoded"], StructType.Encoded>,
      Equals<(typeof StructFieldType)["Encoded"], StructFieldType.Encoded>,
      Equals<(typeof StructMainValue)["Encoded"], StructMainValue.Encoded>,
      Equals<(typeof PropertyType)["Encoded"], PropertyType.Encoded>,
      Equals<(typeof PropertyType)["Type"], PropertyType>,
      Equals<ArrayType["elementType"], PropertyType>,
      Equals<StructType["fields"], ReadonlyArray<StructFieldType>>,
      Equals<StructType["mainValue"], O.Option<StructMainValue>>,
      Equals<ArrayType.Encoded["subType"], PropertyType.Encoded>,
      "elementType" extends keyof ArrayType.Encoded ? true : false,
      "fields" extends keyof StructType.Encoded ? true : false,
    ] = [true, true, true, true, true, true, true, true, true, true, false, false];
    deepStrictEqual(facts, [true, true, true, true, true, true, true, true, true, true, false, false]);
  });

  it.effect(
    "rejects the domain key names on the wire and malformed members",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(PropertyType)({ type: "array", elementType: { type: "string" }, reducers: [] }),
        rejects(PropertyType)({ type: "array", reducers: [] }),
        rejects(PropertyType)({ type: "array", subType: { type: "set" }, reducers: [] }),
        rejects(PropertyType)({ type: "array", subType: "string", reducers: [] }),
        rejects(PropertyType)({ type: "array", subType: { type: "string" }, reducers: [{ direction: "ASC" }] }),
        rejects(PropertyType)({ type: "array", subType: { type: "string" }, reducers: [{ field: "year" }] }),
        rejects(PropertyType)({
          type: "array",
          subType: { type: "string" },
          reducers: [{ direction: "ASCENDING_NULLS_LAST", field: "" }],
        }),
        rejects(PropertyType)({ type: "struct", fields: [] }),
        rejects(PropertyType)({ type: "struct" }),
        rejects(PropertyType)({
          type: "struct",
          structFieldTypes: [{ apiName: "", rid: "r", dataType: { type: "string" } }],
        }),
        rejects(PropertyType)({
          type: "struct",
          structFieldTypes: [{ apiName: "a", rid: "", dataType: { type: "string" } }],
        }),
        rejects(PropertyType)({ type: "struct", structFieldTypes: [{ apiName: "a", rid: "r" }] }),
        rejects(PropertyType)({
          type: "struct",
          structFieldTypes: [{ apiName: "a", rid: "r", dataType: { type: "map" } }],
        }),
        rejects(PropertyType)({ type: "struct", structFieldTypes: [], mainValue: { fields: [] } }),
        rejects(PropertyType)({
          type: "struct",
          structFieldTypes: [],
          mainValue: { mainValueType: { type: "string" } },
        }),
        rejects(PropertyType)({ type: "struct", structFieldTypes: { bio: { type: "string" } } }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it("bounds generated struct fields without bounding the structs it decodes", () => {
    const wide = StructType.make({
      fields: A.map(["a", "b", "c", "d", "e"], (name) => structField(name, `ri.struct.${name}`, StringType.make({}))),
    });
    assertTrue(S.is(PropertyType)(wide));
  });
});

// ---------------------------------------------------------------------------
// Property definitions (09-wire-c-core-geo.md §3)
// ---------------------------------------------------------------------------

describe("PropertyStatus", () => {
  lawful("ActiveProperty", ActiveProperty);
  lawful("ExperimentalProperty", ExperimentalProperty);
  lawful("ExampleProperty", ExampleProperty);
  lawful("DeprecatedProperty", DeprecatedProperty);
  lawful("PropertyStatus", PropertyStatus);

  const replacement = PropertyTypeRid.make("ri.ontology.main.property.legal-name");

  wireFixture("PropertyStatus active", PropertyStatus, { type: "active" }, ActiveProperty.make({}));
  wireFixture("PropertyStatus experimental", PropertyStatus, { type: "experimental" }, ExperimentalProperty.make({}));
  wireFixture("PropertyStatus example", PropertyStatus, { type: "example" }, ExampleProperty.make({}));
  wireFixture(
    "PropertyStatus deprecated with a replacement",
    PropertyStatus,
    {
      type: "deprecated",
      message: "Use legalName",
      deadline: "2027-01-01",
      replacedBy: "ri.ontology.main.property.legal-name",
    },
    DeprecatedProperty.make({ message: "Use legalName", deadline: "2027-01-01", replacedBy: O.some(replacement) })
  );
  wireFixture(
    "PropertyStatus deprecated without a replacement",
    PropertyStatus,
    { type: "deprecated", message: "", deadline: "2027-01-01T00:00:00Z" },
    DeprecatedProperty.make({ message: "", deadline: "2027-01-01T00:00:00Z" })
  );

  it("constructs, guards and matches every case", () => {
    const statuses = {
      active: PropertyStatus.cases.active.make({}),
      experimental: PropertyStatus.cases.experimental.make({}),
      example: PropertyStatus.cases.example.make({}),
      deprecated: PropertyStatus.cases.deprecated.make({ message: "Use legalName", deadline: "2027-01-01" }),
    };
    const warning = PropertyStatus.match({
      active: () => "",
      experimental: () => "experimental",
      example: () => "example",
      deprecated: ({ message, deadline, replacedBy }) =>
        `${message} (until ${deadline}${O.isSome(replacedBy) ? ", replaced" : ""})`,
    });
    deepStrictEqual(
      [
        warning(statuses.active),
        warning(statuses.experimental),
        warning(statuses.example),
        warning(statuses.deprecated),
      ],
      ["", "experimental", "example", "Use legalName (until 2027-01-01)"]
    );
    assertTrue(PropertyStatus.guards.active(statuses.active));
    assertTrue(PropertyStatus.guards.experimental(statuses.experimental));
    assertTrue(PropertyStatus.guards.example(statuses.example));
    assertTrue(PropertyStatus.guards.deprecated(statuses.deprecated));
    assertFalse(PropertyStatus.guards.deprecated(statuses.active));
    const isStable = PropertyStatus.isAnyOf(["active"]);
    deepStrictEqual(
      [isStable(statuses.active), isStable(statuses.experimental), isStable(statuses.deprecated)],
      [true, false, false]
    );
    deepStrictEqual(PropertyStatus.discriminants, ["active", "experimental", "example", "deprecated"]);
    assertNone(statuses.deprecated.replacedBy);
  });

  it.effect(
    "rejects the release-status spellings, unknown statuses and an incomplete deprecation",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(PropertyStatus)({ type: "ACTIVE" }),
        rejects(PropertyStatus)("ACTIVE"),
        rejects(PropertyStatus)({ type: "endorsed" }),
        rejects(PropertyStatus)({ type: "deprecated" }),
        rejects(PropertyStatus)({ type: "deprecated", message: "m" }),
        rejects(PropertyStatus)({ type: "deprecated", deadline: "2027-01-01" }),
        rejects(PropertyStatus)({ type: "deprecated", message: "m", deadline: "2027-01-01", replacedBy: "" }),
        rejects(PropertyStatus)({ type: "deprecated", message: "m", deadline: 20270101 }),
        rejects(PropertyStatus)({ type: "deprecated", message: "m", deadline: null }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  // The wire types `deadline` as a plain string, so the kernel does not narrow it: any text is kept verbatim.
  it.effect(
    "keeps a deprecation deadline verbatim, whatever text it is, including the empty string",
    Effect.fnUntraced(function* () {
      const deadlines = ["", " ", "2027-01-01", "2027-01-01T00:00:00Z", "next quarter"];
      const decoded = yield* Effect.forEach(deadlines, (deadline) =>
        S.decodeEffect(DeprecatedProperty)({ type: "deprecated", message: "m", deadline })
      );
      deepStrictEqual(
        A.map(decoded, (status) => status.deadline),
        deadlines
      );
      const encoded = yield* Effect.forEach(decoded, (status) => S.encodeEffect(PropertyStatus)(status));
      deepStrictEqual(
        encoded,
        A.map(deadlines, (deadline) => ({ type: "deprecated", message: "m", deadline }))
      );
      const facts: readonly [
        Equals<DeprecatedProperty["deadline"], string>,
        Equals<(typeof DeprecatedProperty.Encoded)["deadline"], string>,
      ] = [true, true];
      assertTrue(A.every(facts, identity));
      assertSome(
        O.map(DeprecatedProperty.makeOption({ message: "m", deadline: "" }), (status) => status.deadline),
        ""
      );
    })
  );
});

describe("PropertyDefinition", () => {
  lawful("Nullability", Nullability);
  lawful("PropertyDataConstraints", PropertyDataConstraints);
  lawful("PropertyDefinition", PropertyDefinition);
  lawful("SharedPropertyType", SharedPropertyType);

  const fullWire: (typeof PropertyDefinition)["Encoded"] = {
    dataType: { type: "string" },
    rid: "ri.ontology.main.property.full-name",
    displayName: "Full name",
    description: "The employee's legal name",
    status: {
      type: "deprecated",
      message: "Use legalName",
      deadline: "2027-01-01",
      replacedBy: "ri.ontology.main.property.legal-name",
    },
    visibility: "PROMINENT",
    valueTypeApiName: "personName",
    valueFormatting: { type: "knownType", knownType: "USER_OR_GROUP_ID" },
    typeClasses: [{ kind: "render_hint", name: "SORTABLE" }],
    dataConstraints: { nullability: "NOT_NULLABLE" },
  };

  const full = PropertyDefinition.make({
    dataType: StringType.make({}),
    rid: PropertyTypeRid.make("ri.ontology.main.property.full-name"),
    displayName: O.some("Full name"),
    description: O.some("The employee's legal name"),
    status: O.some(
      DeprecatedProperty.make({
        message: "Use legalName",
        deadline: "2027-01-01",
        replacedBy: O.some(PropertyTypeRid.make("ri.ontology.main.property.legal-name")),
      })
    ),
    visibility: O.some("prominent"),
    valueTypeApiName: O.some(ValueTypeApiName.make("personName")),
    valueFormatting: O.some(ValueFormat.cases.knownType.make({ knownType: "userOrGroupId" })),
    typeClasses: [TypeClass.make({ kind: "render_hint", name: "SORTABLE" })],
    dataConstraints: O.some(PropertyDataConstraints.make({ nullability: O.some("notNullable") })),
  });

  wireFixture("PropertyDefinition with every optional field present", PropertyDefinition, fullWire, full);
  // The shape every property of the OSDK test stubs has: a type, a loose rid and no type classes.
  wireFixture(
    "PropertyDefinition with no optional field present",
    PropertyDefinition,
    { dataType: { type: "integer" }, rid: "rid", typeClasses: [] },
    PropertyDefinition.make({ dataType: IntegerType.make({}), rid: PropertyTypeRid.make("rid") })
  );
  wireFixture(
    "PropertyDefinition of a struct array",
    PropertyDefinition,
    { description: "Bonus history", dataType: bonusHistoryWire, rid: "rid", typeClasses: [] },
    PropertyDefinition.make({
      description: O.some("Bonus history"),
      dataType: bonusHistory,
      rid: PropertyTypeRid.make("rid"),
    })
  );
  wireFixture(
    "PropertyDataConstraints that allow null",
    PropertyDataConstraints,
    { nullability: "NULLABLE" },
    PropertyDataConstraints.make({ nullability: O.some("nullable") })
  );
  wireFixture(
    "PropertyDataConstraints that state nothing",
    PropertyDataConstraints,
    {},
    PropertyDataConstraints.make({})
  );

  it("defaults every optional field to absent and the type classes to none in the constructor", () => {
    const minimal = PropertyDefinition.make({ dataType: StringType.make({}), rid: PropertyTypeRid.make("rid") });
    assertNone(minimal.displayName);
    assertNone(minimal.description);
    assertNone(minimal.status);
    assertNone(minimal.visibility);
    assertNone(minimal.valueTypeApiName);
    assertNone(minimal.valueFormatting);
    assertNone(minimal.dataConstraints);
    deepStrictEqual(minimal.typeClasses, []);
    assertNone(PropertyDataConstraints.make({}).nullability);
  });

  it.effect(
    "defaults the type classes when the wire omits them, and always emits them",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(PropertyDefinition)({ dataType: { type: "integer" }, rid: "rid" });
      deepStrictEqual(decoded.typeClasses, []);
      const encoded = yield* S.encodeEffect(PropertyDefinition)(decoded);
      deepStrictEqual(encoded, { dataType: { type: "integer" }, rid: "rid", typeClasses: [] });
    })
  );

  it.effect(
    "reads every optional field into an option and each wire enum into its domain literal",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(PropertyDefinition)(fullWire);
      assertSome(decoded.displayName, "Full name");
      assertSome(decoded.description, "The employee's legal name");
      assertSome(decoded.visibility, "prominent");
      assertSome(decoded.valueTypeApiName, ValueTypeApiName.make("personName"));
      assertSome(
        O.map(decoded.status, (status) => status.type),
        "deprecated"
      );
      assertSome(
        O.map(decoded.valueFormatting, (format) => format.type),
        "knownType"
      );
      assertSome(
        O.flatMap(decoded.dataConstraints, (constraints) => constraints.nullability),
        "notNullable"
      );
      strictEqual(decoded.dataType.type, "string");
      strictEqual(decoded.rid, PropertyTypeRid.make("ri.ontology.main.property.full-name"));
      deepStrictEqual(
        A.map(decoded.typeClasses, (typeClass) => `${typeClass.kind}:${typeClass.name}`),
        ["render_hint:SORTABLE"]
      );
    })
  );

  it("pairs the nullability literals of the wire with their domain literals", () => {
    deepStrictEqual(Nullability.Pairs, [
      ["NULLABLE", "nullable"],
      ["NOT_NULLABLE", "notNullable"],
    ]);
    const mayBeNull = Nullability.To.match({ nullable: () => true, notNullable: () => false });
    const literals: ReadonlyArray<Nullability> = ["nullable", "notNullable"];
    deepStrictEqual(A.map(literals, mayBeNull), [true, false]);
  });

  it("does not repeat the property's own name and types every optional wire key as optional", () => {
    type Wire = (typeof PropertyDefinition)["Encoded"];
    const facts: readonly [
      "apiName" extends keyof Wire ? true : false,
      Equals<Wire["dataType"], PropertyType.Encoded>,
      Equals<Wire["rid"], string>,
      Equals<Wire["displayName"], string | undefined>,
      Equals<Wire["visibility"], "NORMAL" | "PROMINENT" | "HIDDEN" | undefined>,
      Equals<Wire["dataConstraints"], { readonly nullability?: "NULLABLE" | "NOT_NULLABLE" } | undefined>,
      Equals<PropertyDefinition["dataType"], PropertyType>,
      Equals<PropertyDefinition["status"], O.Option<PropertyStatus>>,
      Equals<PropertyDefinition["rid"], PropertyTypeRid>,
    ] = [false, true, true, true, true, true, true, true, true];
    deepStrictEqual(facts, [false, true, true, true, true, true, true, true, true]);
  });

  it.effect(
    "rejects a definition without a type or a rid, and wire enums in their domain spelling",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(PropertyDefinition)({ rid: "rid", typeClasses: [] }),
        rejects(PropertyDefinition)({ dataType: { type: "string" }, typeClasses: [] }),
        rejects(PropertyDefinition)({ dataType: { type: "string" }, rid: "", typeClasses: [] }),
        rejects(PropertyDefinition)({ dataType: { type: "binary" }, rid: "rid", typeClasses: [] }),
        rejects(PropertyDefinition)({ dataType: "string", rid: "rid", typeClasses: [] }),
        rejects(PropertyDefinition)({ baseType: "String", rid: "rid", typeClasses: [] }),
        rejects(PropertyDefinition)({ dataType: { type: "string" }, rid: "rid", visibility: "prominent" }),
        rejects(PropertyDefinition)({ dataType: { type: "string" }, rid: "rid", status: "ACTIVE" }),
        rejects(PropertyDefinition)({ dataType: { type: "string" }, rid: "rid", valueTypeApiName: "" }),
        rejects(PropertyDefinition)({ dataType: { type: "string" }, rid: "rid", typeClasses: [{ kind: "k" }] }),
        rejects(PropertyDefinition)({
          dataType: { type: "string" },
          rid: "rid",
          dataConstraints: { nullability: "notNullable" },
        }),
        rejects(PropertyDefinition)({ dataType: { type: "string" }, rid: "rid", displayName: null }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  wireFixture(
    "SharedPropertyType with every optional field present",
    SharedPropertyType,
    {
      rid: "ri.ontology.main.shared-property.4a0b6a3e-0000-4000-8000-000000000001",
      apiName: "legalName",
      displayName: "Legal name",
      description: "Name as it appears on official documents",
      dataType: { type: "string" },
      valueTypeApiName: "personName",
      valueFormatting: { type: "knownType", knownType: "USER_OR_GROUP_ID" },
      typeClasses: [{ kind: "render_hint", name: "SORTABLE" }],
    },
    SharedPropertyType.make({
      rid: SharedPropertyTypeRid.make("ri.ontology.main.shared-property.4a0b6a3e-0000-4000-8000-000000000001"),
      apiName: SharedPropertyTypeApiName.make("legalName"),
      displayName: "Legal name",
      description: O.some("Name as it appears on official documents"),
      dataType: StringType.make({}),
      valueTypeApiName: O.some(ValueTypeApiName.make("personName")),
      valueFormatting: O.some(ValueFormat.cases.knownType.make({ knownType: "userOrGroupId" })),
      typeClasses: [TypeClass.make({ kind: "render_hint", name: "SORTABLE" })],
    })
  );
  wireFixture(
    "SharedPropertyType with no optional field present",
    SharedPropertyType,
    {
      rid: "rid",
      apiName: "tags",
      displayName: "Tags",
      dataType: { type: "array", subType: { type: "string" }, reducers: [] },
      typeClasses: [],
    },
    SharedPropertyType.make({
      rid: SharedPropertyTypeRid.make("rid"),
      apiName: SharedPropertyTypeApiName.make("tags"),
      displayName: "Tags",
      dataType: ArrayType.make({ elementType: StringType.make({}) }),
    })
  );

  it.effect(
    "requires a shared property type to carry its own name and display name",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(SharedPropertyType)({ rid: "rid", displayName: "Tags", dataType: { type: "string" }, typeClasses: [] }),
        rejects(SharedPropertyType)({ rid: "rid", apiName: "tags", dataType: { type: "string" }, typeClasses: [] }),
        rejects(SharedPropertyType)({ apiName: "tags", displayName: "Tags", dataType: { type: "string" } }),
        rejects(SharedPropertyType)({ rid: "rid", apiName: "", displayName: "Tags", dataType: { type: "string" } }),
      ]);
      assertTrue(A.every(verdicts, identity));
      const minimal = SharedPropertyType.make({
        rid: SharedPropertyTypeRid.make("rid"),
        apiName: SharedPropertyTypeApiName.make("tags"),
        displayName: "Tags",
        dataType: StringType.make({}),
      });
      assertNone(minimal.description);
      assertNone(minimal.valueTypeApiName);
      assertNone(minimal.valueFormatting);
      deepStrictEqual(minimal.typeClasses, []);
    })
  );
});

// ---------------------------------------------------------------------------
// Property selectors and load levels (09-wire-c-core-geo.md §4)
// ---------------------------------------------------------------------------

describe("PropertyLoadLevel", () => {
  lawful("PropertyLoadLevel", PropertyLoadLevel);

  const levels: ReadonlyArray<PropertyLoadLevel> = [
    "noLoadLevel",
    "applyReducers",
    "extractMainValue",
    "applyReducersAndExtractMainValue",
  ];

  it.effect(
    "decodes each of the four empty wire records to its literal and encodes the literal back to the record",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.all(A.map(levels, (level) => S.decodeEffect(PropertyLoadLevel)({ type: level })));
      deepStrictEqual(decoded, levels);
      const encoded = yield* Effect.all(A.map(levels, (level) => S.encodeEffect(PropertyLoadLevel)(level)));
      deepStrictEqual(encoded, [
        { type: "noLoadLevel" },
        { type: "applyReducers" },
        { type: "extractMainValue" },
        { type: "applyReducersAndExtractMainValue" },
      ]);
    })
  );

  it("is the tag itself in the domain and the tagged record on the wire", () => {
    type Level = "noLoadLevel" | "applyReducers" | "extractMainValue" | "applyReducersAndExtractMainValue";
    const facts: readonly [
      Equals<PropertyLoadLevel, Level>,
      Equals<(typeof PropertyLoadLevel)["Encoded"], { readonly type: Level }>,
    ] = [true, true];
    assertTrue(A.every(facts, identity));
    deepStrictEqual(A.map(levels, S.is(PropertyLoadLevel)), [true, true, true, true]);
    assertFalse(S.is(PropertyLoadLevel)({ type: "applyReducers" }));
  });

  it.effect(
    "rejects the bare literal, the documentation's upper-case names and an empty record",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(PropertyLoadLevel)("applyReducers"),
        rejects(PropertyLoadLevel)({ type: "APPLY_REDUCERS" }),
        rejects(PropertyLoadLevel)({ type: "EXTRACT_MAIN_VALUE" }),
        rejects(PropertyLoadLevel)({ type: "reduce" }),
        rejects(PropertyLoadLevel)({}),
        rejects(PropertyLoadLevel)(null),
        refusesToEncode(PropertyLoadLevel)("APPLY_REDUCERS"),
        refusesToEncode(PropertyLoadLevel)({ type: "applyReducers" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

describe("PropertySelector", () => {
  lawful("PropertyByName", PropertyByName);
  lawful("StructFieldOfProperty", StructFieldOfProperty);
  lawful("PropertyAtLoadLevel", PropertyAtLoadLevel);
  lawful("TitleProperty", TitleProperty);
  lawful("PrimaryKeyProperty", PrimaryKeyProperty);
  lawful("PropertySelector", PropertySelector);

  const fullName = PropertyByName.make({ apiName: PropertyApiName.make("fullName") });
  const city = StructFieldOfProperty.make({
    propertyApiName: PropertyApiName.make("address"),
    structFieldApiName: StructFieldApiName.make("city"),
  });
  const mainValueOfCity = PropertyAtLoadLevel.make({ selector: city, loadLevel: "extractMainValue" });

  wireFixture("PropertySelector property", PropertySelector, { type: "property", apiName: "fullName" }, fullName);
  wireFixture(
    "PropertySelector structField",
    PropertySelector,
    { type: "structField", propertyApiName: "address", structFieldApiName: "city" },
    city
  );
  wireFixture(
    "PropertySelector propertyWithLoadLevel wrapping a struct field",
    PropertySelector,
    {
      type: "propertyWithLoadLevel",
      propertyIdentifier: { type: "structField", propertyApiName: "address", structFieldApiName: "city" },
      loadLevel: { type: "extractMainValue" },
    },
    mainValueOfCity
  );
  wireFixture(
    "PropertySelector propertyWithLoadLevel wrapping another load level",
    PropertySelector,
    {
      type: "propertyWithLoadLevel",
      propertyIdentifier: {
        type: "propertyWithLoadLevel",
        propertyIdentifier: { type: "property", apiName: "bonusHistory" },
        loadLevel: { type: "applyReducers" },
      },
      loadLevel: { type: "applyReducersAndExtractMainValue" },
    },
    PropertyAtLoadLevel.make({
      selector: PropertyAtLoadLevel.make({
        selector: PropertyByName.make({ apiName: PropertyApiName.make("bonusHistory") }),
        loadLevel: "applyReducers",
      }),
      loadLevel: "applyReducersAndExtractMainValue",
    })
  );
  wireFixture(
    "PropertySelector propertyWithLoadLevel wrapping the title",
    PropertySelector,
    {
      type: "propertyWithLoadLevel",
      propertyIdentifier: { type: "titleProperty" },
      loadLevel: { type: "noLoadLevel" },
    },
    PropertyAtLoadLevel.make({ selector: TitleProperty.make({}), loadLevel: "noLoadLevel" })
  );
  wireFixture("PropertySelector titleProperty", PropertySelector, { type: "titleProperty" }, TitleProperty.make({}));
  wireFixture(
    "PropertySelector primaryKeyProperty",
    PropertySelector,
    { type: "primaryKeyProperty" },
    PrimaryKeyProperty.make({})
  );

  it("constructs, guards and matches every case", () => {
    const path: (selector: PropertySelector) => string = PropertySelector.match({
      property: ({ apiName }) => apiName,
      structField: ({ propertyApiName, structFieldApiName }) => `${propertyApiName}.${structFieldApiName}`,
      propertyWithLoadLevel: ({ selector, loadLevel }) => `${path(selector)}@${loadLevel}`,
      titleProperty: () => "<title>",
      primaryKeyProperty: () => "<primaryKey>",
    });
    const selectors = {
      property: PropertySelector.cases.property.make({ apiName: PropertyApiName.make("fullName") }),
      structField: PropertySelector.cases.structField.make({
        propertyApiName: PropertyApiName.make("address"),
        structFieldApiName: StructFieldApiName.make("city"),
      }),
      propertyWithLoadLevel: PropertySelector.cases.propertyWithLoadLevel.make({
        selector: city,
        loadLevel: "extractMainValue",
      }),
      titleProperty: PropertySelector.cases.titleProperty.make({}),
      primaryKeyProperty: PropertySelector.cases.primaryKeyProperty.make({}),
    };
    deepStrictEqual(
      [
        path(selectors.property),
        path(selectors.structField),
        path(selectors.propertyWithLoadLevel),
        path(selectors.titleProperty),
        path(selectors.primaryKeyProperty),
      ],
      ["fullName", "address.city", "address.city@extractMainValue", "<title>", "<primaryKey>"]
    );
    assertTrue(PropertySelector.guards.property(selectors.property));
    assertTrue(PropertySelector.guards.structField(selectors.structField));
    assertTrue(PropertySelector.guards.propertyWithLoadLevel(selectors.propertyWithLoadLevel));
    assertTrue(PropertySelector.guards.titleProperty(selectors.titleProperty));
    assertTrue(PropertySelector.guards.primaryKeyProperty(selectors.primaryKeyProperty));
    assertFalse(PropertySelector.guards.property(selectors.structField));
    const isRole = PropertySelector.isAnyOf(["titleProperty", "primaryKeyProperty"]);
    deepStrictEqual(
      [isRole(selectors.titleProperty), isRole(selectors.primaryKeyProperty), isRole(selectors.property)],
      [true, true, false]
    );
    deepStrictEqual(R.keys(PropertySelector.cases), [
      "property",
      "structField",
      "propertyWithLoadLevel",
      "titleProperty",
      "primaryKeyProperty",
    ]);
  });

  it("renames the wire key propertyIdentifier and declares the encoded shape it really has", () => {
    const facts: readonly [
      Equals<(typeof PropertyAtLoadLevel)["Encoded"], PropertyAtLoadLevel.Encoded>,
      Equals<(typeof PropertySelector)["Encoded"], PropertySelector.Encoded>,
      Equals<(typeof PropertySelector)["Type"], PropertySelector>,
      Equals<PropertyAtLoadLevel["selector"], PropertySelector>,
      Equals<PropertyAtLoadLevel["loadLevel"], PropertyLoadLevel>,
      Equals<PropertyByName["apiName"], PropertyApiName>,
      "selector" extends keyof PropertyAtLoadLevel.Encoded ? true : false,
    ] = [true, true, true, true, true, true, false];
    deepStrictEqual(facts, [true, true, true, true, true, true, false]);
  });

  it.effect(
    "rejects the domain key on the wire, a bare load level and incomplete selectors",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(PropertySelector)({
          type: "propertyWithLoadLevel",
          selector: { type: "titleProperty" },
          loadLevel: { type: "noLoadLevel" },
        }),
        rejects(PropertySelector)({
          type: "propertyWithLoadLevel",
          propertyIdentifier: { type: "titleProperty" },
          loadLevel: "noLoadLevel",
        }),
        rejects(PropertySelector)({ type: "propertyWithLoadLevel", propertyIdentifier: { type: "titleProperty" } }),
        rejects(PropertySelector)({ type: "propertyWithLoadLevel", loadLevel: { type: "noLoadLevel" } }),
        rejects(PropertySelector)({
          type: "propertyWithLoadLevel",
          propertyIdentifier: "fullName",
          loadLevel: { type: "noLoadLevel" },
        }),
        rejects(PropertySelector)({ type: "property" }),
        rejects(PropertySelector)({ type: "property", apiName: "" }),
        rejects(PropertySelector)({ type: "structField", propertyApiName: "address" }),
        rejects(PropertySelector)({ type: "structField", propertyApiName: "address", structFieldApiName: "" }),
        rejects(PropertySelector)({ type: "title" }),
        rejects(PropertySelector)("fullName"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// valueCodec: the projection from a property type to the codec of its values
// ---------------------------------------------------------------------------

// One hand-picked value per case: `[type, wire value, canonical re-encoding]`. The wire values are the examples of
// the JSON encoding table in 09-wire-c-core-geo.md §5.1, so its non-scalar rows are covered here.
const valuePerCase: {
  readonly [K in PropertyTypeKind]: readonly [type: PropertyType, wire: unknown, canonical: unknown];
} = {
  boolean: [BooleanType.make({}), true, true],
  byte: [ByteType.make({}), 31, 31],
  short: [ShortType.make({}), 8739, 8739],
  integer: [IntegerType.make({}), 238940, 238940],
  long: [LongType.make({}), "58319870951433", "58319870951433"],
  float: [FloatType.make({}), 3.14159265, 3.14159265],
  double: [DoubleType.make({}), 3.14159265, 3.14159265],
  decimal: [DecimalType.make({}), "2.718281828", "2.718281828"],
  string: [StringType.make({}), "Call me Ishmael", "Call me Ishmael"],
  date: [DateType.make({}), "2021-05-01", "2021-05-01"],
  timestamp: [TimestampType.make({}), "2021-01-04T05:00:00Z", "2021-01-04T05:00:00.000Z"],
  marking: [MarkingType.make({}), "8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b", "8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b"],
  cipherText: [
    CipherTextType.make({}),
    `CIPHER::${cipherChannel}::AAAAkdB7::CIPHER`,
    `CIPHER::${cipherChannel}::AAAAkdB7::CIPHER`,
  ],
  attachment: [
    AttachmentType.make({}),
    { rid: "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f" },
    { rid: "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f" },
  ],
  mediaReference: [
    MediaReferenceType.make({}),
    {
      mimeType: "application/pdf",
      reference: {
        type: "mediaSetViewItem",
        mediaSetViewItem: {
          mediaSetRid: "ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642",
          mediaSetViewRid: "ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b",
          mediaItemRid: "ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225",
        },
      },
    },
    {
      mimeType: "application/pdf",
      reference: {
        type: "mediaSetViewItem",
        mediaSetViewItem: {
          mediaSetRid: "ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642",
          mediaSetViewRid: "ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b",
          mediaItemRid: "ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225",
        },
      },
    },
  ],
  geopoint: [
    GeoPointType.make({}),
    { type: "Point", coordinates: [102.0, 0.5] },
    { type: "Point", coordinates: [102.0, 0.5] },
  ],
  geoshape: [
    GeoShapeType.make({}),
    {
      type: "LineString",
      coordinates: [
        [102.0, 0.0],
        [103.0, 1.0],
      ],
    },
    {
      type: "LineString",
      coordinates: [
        [102.0, 0.0],
        [103.0, 1.0],
      ],
    },
  ],
  geotimeSeriesReference: [
    GeotimeSeriesReferenceType.make({}),
    { type: "geotimeSeriesValue", position: [102.0, 0.5], timestamp: "2021-01-04T05:00:00Z" },
    { type: "geotimeSeriesValue", position: [102.0, 0.5], timestamp: "2021-01-04T05:00:00.000Z" },
  ],
  timeseries: [
    TimeseriesType.make({ itemType: DoubleType.make({}) }),
    { seriesId: "wellPressureSeriesId", syncRid: `ri.time-series-catalog.main.sync.${uuid}` },
    { seriesId: "wellPressureSeriesId", syncRid: `ri.time-series-catalog.main.sync.${uuid}` },
  ],
  vector: [VectorType.make({ dimension: 6 }), [0.1, 0.3, 0.02, 0.05, 0.8, 0.4], [0.1, 0.3, 0.02, 0.05, 0.8, 0.4]],
  array: [
    ArrayType.make({ elementType: StringType.make({}) }),
    ["alpha", "bravo", "charlie"],
    ["alpha", "bravo", "charlie"],
  ],
  struct: [
    StructType.make({
      fields: [
        structField("firstName", "ri.struct.first-name", StringType.make({})),
        structField("lastName", "ri.struct.last-name", StringType.make({})),
      ],
    }),
    { firstName: "Alex", lastName: "Karp" },
    { firstName: "Alex", lastName: "Karp" },
  ],
};

describe("valueCodec", () => {
  it.prop(
    "valueCodec and fieldCodec construct a codec for every generated property type",
    [Arbitrary.schema(PropertyType)],
    ([type]) => S.isSchema(valueCodec(type)) && S.isSchema(fieldCodec(type)),
    { arbitrary: fcRuns(200) }
  );

  it.effect(
    "projects generated types of all 22 cases, nested ones included",
    Effect.fnUntraced(function* () {
      const types = yield* Arbitrary.sampleEffect(Arbitrary.schema(PropertyType), { count: 600, seed: 22 });
      const generatedTags: ReadonlyArray<string> = A.dedupe(A.map(types, (type) => type.type));
      const tags: ReadonlyArray<string> = PropertyTypeKind.literals;
      deepStrictEqual(A.sort(generatedTags, Order.String), A.sort(tags, Order.String));
      assertTrue(A.every(types, (type) => S.isSchema(valueCodec(type))));
      const nested = A.filter(types, PropertyType.isAnyOf(["array", "struct"]));
      assertTrue(A.isReadonlyArrayNonEmpty(nested));
    })
  );

  it.effect(
    "decodes a hand-picked wire value of every case and encodes it back canonically",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(
        PropertyTypeKind.literals,
        Effect.fnUntraced(function* (kind) {
          const [type, wire, canonical] = valuePerCase[kind];
          const { decoded, encoded } = yield* throughCodec(type, wire);
          deepStrictEqual(encoded, canonical);
          // The canonical form is a fixed point: decoding and encoding it again changes nothing.
          const again = yield* throughCodec(type, encoded);
          deepStrictEqual(again.encoded, canonical);
          return type.type === kind && S.toEquivalence(valueCodec(type))(again.decoded, decoded);
        })
      );
      strictEqual(A.length(results), 22);
      assertTrue(A.every(results, identity));
    })
  );

  it.effect(
    "derives an arbitrary from the projected codec of every case, and its values satisfy the codec's guard",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(
        PropertyTypeKind.literals,
        Effect.fnUntraced(function* (kind) {
          const codec = valueCodec(valuePerCase[kind][0]);
          const values = yield* Arbitrary.sampleEffect(Arbitrary.schema(codec), { count: 25, seed: 7 });
          return A.length(values) === 25 && A.every(values, S.is(codec));
        })
      );
      strictEqual(A.length(results), 22);
      assertTrue(A.every(results, identity));
    })
  );

  it.effect(
    "round-trips generated values of every case through the projected codec",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(
        PropertyTypeKind.literals,
        Effect.fnUntraced(function* (kind) {
          const codec = valueCodec(valuePerCase[kind][0]);
          const equivalence = S.toEquivalence(codec);
          const values = yield* Arbitrary.sampleEffect(Arbitrary.schema(codec), { count: 25, seed: 7 });
          const verdicts = yield* Effect.forEach(
            values,
            Effect.fnUntraced(function* (value) {
              const encoded = yield* S.encodeUnknownEffect(codec)(value);
              const decoded = yield* S.decodeUnknownEffect(codec)(encoded);
              return equivalence(decoded, value);
            })
          );
          return A.every(verdicts, identity);
        })
      );
      strictEqual(A.length(results), 22);
      assertTrue(A.every(results, identity));
    })
  );

  it.effect(
    "decodes each scalar to its rich domain value",
    Effect.fnUntraced(function* () {
      const long = yield* throughCodec(LongType.make({}), "9007199254740993");
      const decimal = yield* throughCodec(DecimalType.make({}), "2.718281828");
      const date = yield* throughCodec(DateType.make({}), "2021-05-01");
      const timestamp = yield* throughCodec(TimestampType.make({}), "2021-01-04T05:00:00Z");
      const legacyInteger = yield* throughCodec(IntegerType.make({}), "238940");
      const legacyBoolean = yield* throughCodec(BooleanType.make({}), "false");
      strictEqual(long.decoded, BigInt("9007199254740993"));
      assertTrue(BigDecimal.isBigDecimal(decimal.decoded));
      assertTrue(S.is(LocalDate)(date.decoded));
      assertTrue(DateTime.isDateTime(timestamp.decoded));
      deepStrictEqual([legacyInteger.decoded, legacyInteger.encoded], [238940, 238940]);
      deepStrictEqual([legacyBoolean.decoded, legacyBoolean.encoded], [false, false]);
    })
  );

  it.effect(
    "decodes all three wire shapes of a time series reference, whatever the item type",
    Effect.fnUntraced(function* () {
      const sensor = TimeseriesType.make({ itemType: SensorSeriesItem.make({}) });
      const bare = yield* throughCodec(sensor, "wellPressureSeriesId");
      const qualified = yield* throughCodec(sensor, {
        seriesId: "wellPressureSeriesId",
        syncRid: `ri.time-series-catalog.main.sync.${uuid}`,
      });
      const template = yield* throughCodec(sensor, {
        templateRid: `ri.codex-emu.main.template.${uuid}`,
        templateVersion: "0.0.0",
      });
      deepStrictEqual(
        [bare.encoded, qualified.encoded, template.encoded],
        [
          "wellPressureSeriesId",
          { seriesId: "wellPressureSeriesId", syncRid: `ri.time-series-catalog.main.sync.${uuid}` },
          { templateRid: `ri.codex-emu.main.template.${uuid}`, templateVersion: "0.0.0" },
        ]
      );
    })
  );

  it.effect(
    "enforces the dimension a vector type states, when decoding and when encoding",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(VectorType.make({ dimension: 3 }));
      const exact = yield* S.decodeEffect(codec)([0.1, 0.2, 0.3]);
      deepStrictEqual(exact, [0.1, 0.2, 0.3]);
      const verdicts = yield* Effect.all([
        rejects(codec)([]),
        rejects(codec)([0.1, 0.2]),
        rejects(codec)([0.1, 0.2, 0.3, 0.4]),
        rejects(codec)([0.1, 0.2, "0.3"]),
        rejects(codec)([0.1, 0.2, Number.NaN]),
        refusesToEncode(codec)([0.1, 0.2]),
        refusesToEncode(codec)([0.1, 0.2, 0.3, 0.4]),
      ]);
      assertTrue(A.every(verdicts, identity));
      const single = valueCodec(VectorType.make({ dimension: 1 }));
      const one = yield* S.decodeEffect(single)([7]);
      deepStrictEqual(one, [7]);
    })
  );

  it.effect(
    "generates vectors of exactly the stated dimension",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(VectorType.make({ dimension: 4 }));
      const vectors = yield* Arbitrary.sampleEffect(Arbitrary.schema(codec), { count: 20, seed: 4 });
      assertTrue(A.every(vectors, S.is(S.Array(S.Finite).check(S.isMinLength(4), S.isMaxLength(4)))));
    })
  );

  it.effect(
    "decodes absent and null struct fields to none and omits them again on encode",
    Effect.fnUntraced(function* () {
      const type = StructType.make({
        fields: [
          structField("firstName", "ri.struct.first-name", StringType.make({})),
          structField("age", "ri.struct.age", IntegerType.make({})),
          structField("joined", "ri.struct.joined", DateType.make({})),
        ],
      });
      const codec = valueCodec(type);
      const partial = yield* S.decodeEffect(codec)({ firstName: "Alex", age: null });
      deepStrictEqual(partial, { firstName: O.some("Alex"), age: O.none(), joined: O.none() });
      const encodedPartial = yield* S.encodeUnknownEffect(codec)(partial);
      deepStrictEqual(encodedPartial, { firstName: "Alex" });
      const empty = yield* S.decodeEffect(codec)({});
      deepStrictEqual(empty, { firstName: O.none(), age: O.none(), joined: O.none() });
      const encodedEmpty = yield* S.encodeUnknownEffect(codec)(empty);
      deepStrictEqual(encodedEmpty, {});
      const fromDomain = yield* S.encodeUnknownEffect(codec)({
        firstName: O.none(),
        age: O.some(41),
        joined: O.some(LocalDate.make({ year: 2019, month: 1, day: 1 })),
      });
      deepStrictEqual(fromDomain, { age: 41, joined: "2019-01-01" });
    })
  );

  it.effect(
    "decodes each struct field with its own codec, strips undeclared keys and rejects a wrong field or a non-record",
    Effect.fnUntraced(function* () {
      const type = StructType.make({
        fields: [
          structField("amount", "ri.struct.amount", LongType.make({})),
          structField("paidAt", "ri.struct.paid-at", TimestampType.make({})),
          structField("year", "ri.struct.year", IntegerType.make({})),
        ],
      });
      const { decoded, encoded } = yield* throughCodec(type, {
        amount: "58319870951433",
        paidAt: "2021-01-04T05:00:00Z",
        year: "2021",
        undeclared: "dropped",
      });
      deepStrictEqual(encoded, { amount: "58319870951433", paidAt: "2021-01-04T05:00:00.000Z", year: 2021 });
      assertTrue(
        S.toEquivalence(valueCodec(type))(decoded, {
          amount: O.some(BigInt("58319870951433")),
          paidAt: O.some(DateTime.makeUnsafe("2021-01-04T05:00:00.000Z")),
          year: O.some(2021),
        })
      );
      const codec = valueCodec(type);
      // A long field written as a JSON integer is read like any other long, and written back as the string.
      const lenient = yield* throughCodec(type, { amount: 58319870951433 });
      deepStrictEqual(lenient.decoded, {
        amount: O.some(BigInt("58319870951433")),
        paidAt: O.none(),
        year: O.none(),
      });
      deepStrictEqual(lenient.encoded, { amount: "58319870951433" });
      const verdicts = yield* Effect.all([
        rejects(codec)({ amount: 1.5 }),
        rejects(codec)({ amount: "" }),
        rejects(codec)({ amount: "0x10" }),
        rejects(codec)({ year: 1.5 }),
        rejects(codec)({ year: "" }),
        rejects(codec)({ paidAt: "not a timestamp" }),
        rejects(codec)({ paidAt: "2021-01-04" }),
        rejects(codec)([]),
        rejects(codec)("struct"),
        rejects(codec)(null),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "projects nested arrays and arrays of structs element by element",
    Effect.fnUntraced(function* () {
      const matrix = ArrayType.make({ elementType: ArrayType.make({ elementType: LongType.make({}) }) });
      const longs = yield* throughCodec(matrix, [["1", "2"], [], ["9223372036854775807"]]);
      deepStrictEqual(longs.decoded, [[BigInt(1), BigInt(2)], [], [BigInt("9223372036854775807")]]);
      deepStrictEqual(longs.encoded, [["1", "2"], [], ["9223372036854775807"]]);
      // The `bonusHistory` value shape of the OSDK stub: an array of `{ year, amount }` structs.
      const bonuses = yield* throughCodec(bonusHistory, [{ year: 2023, amount: 5000 }, { year: 2024 }, {}]);
      deepStrictEqual(bonuses.decoded, [
        { year: O.some(2023), amount: O.some(5000) },
        { year: O.some(2024), amount: O.none() },
        { year: O.none(), amount: O.none() },
      ]);
      deepStrictEqual(bonuses.encoded, [{ year: 2023, amount: 5000 }, { year: 2024 }, {}]);
      const codec = valueCodec(matrix);
      // Element by element includes the long leniency: a JSON integer among strings is read and re-encoded as text.
      const mixed = yield* throughCodec(matrix, [["1", 2]]);
      deepStrictEqual(mixed.decoded, [[BigInt(1), BigInt(2)]]);
      deepStrictEqual(mixed.encoded, [["1", "2"]]);
      const verdicts = yield* Effect.all([
        rejects(codec)([["1", 2.5]]),
        rejects(codec)([["1", "two"]]),
        rejects(codec)([["1", true]]),
        rejects(codec)(["1"]),
        rejects(codec)([null]),
        rejects(codec)(null),
        rejects(codec)({ 0: [] }),
        rejects(valueCodec(ArrayType.make({ elementType: StringType.make({}) })))(["alpha", null]),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "ignores reducers and the main value: they describe loading, not the stored value",
    Effect.fnUntraced(function* () {
      const profile = yield* throughCodec(employeeProfile, {
        bio: "Senior engineer with expertise in distributed systems",
        yearsExperience: 10,
      });
      deepStrictEqual(profile.decoded, {
        bio: O.some("Senior engineer with expertise in distributed systems"),
        yearsExperience: O.some(10),
      });
      deepStrictEqual(profile.encoded, {
        bio: "Senior engineer with expertise in distributed systems",
        yearsExperience: 10,
      });
    })
  );

  // DECLARED GAP (src/Property/Property.behavior.ts:79-81, a `crispen:` note): precision and scale are not enforced
  // on decimal values yet. This pins the gap so that closing it is a visible change.
  it.effect(
    "does not yet enforce a decimal type's precision and scale on its values",
    Effect.fnUntraced(function* () {
      const narrow = DecimalType.make({ precision: O.some(3), scale: O.some(1) });
      const { encoded } = yield* throughCodec(narrow, "123456.789");
      strictEqual(encoded, "123456.789");
    })
  );

  // Law: no two fields of a struct share an API name, so the record `valueCodec` builds never drops a field.
  it.effect(
    "rejects a struct type that declares the same field name twice, on construction, on decode and on encode",
    Effect.fnUntraced(function* () {
      const first = structField("value", "ri.struct.value-a", StringType.make({}));
      const second = structField("value", "ri.struct.value-b", IntegerType.make({}));
      const other = structField("unit", "ri.struct.unit", StringType.make({}));
      assertNone(StructType.makeOption({ fields: [first, second] }));
      assertNone(StructType.makeOption({ fields: [first, other, second] }));
      const distinctNames = StructType.makeOption({ fields: [first, other] });
      const noFields = StructType.makeOption({ fields: [] });
      deepStrictEqual([O.isSome(distinctNames), O.isSome(noFields)], [true, true]);
      const duplicateWire = {
        type: "struct",
        structFieldTypes: [
          { apiName: "value", dataType: { type: "string" }, rid: "ri.struct.value-a", typeClasses: [] },
          { apiName: "value", dataType: { type: "integer" }, rid: "ri.struct.value-b", typeClasses: [] },
        ],
      };
      const distinctWire = {
        type: "struct",
        structFieldTypes: [
          { apiName: "value", dataType: { type: "string" }, rid: "ri.struct.value-a", typeClasses: [] },
          { apiName: "Value", dataType: { type: "integer" }, rid: "ri.struct.value-a", typeClasses: [] },
        ],
      };
      const verdicts = yield* Effect.all([
        rejects(StructType)(duplicateWire),
        rejects(PropertyType)(duplicateWire),
        // The check reaches nested structs too.
        rejects(PropertyType)({ type: "array", subType: duplicateWire, reducers: [] }),
        refusesToEncode(StructType)({ type: "struct", fields: [first, second], mainValue: O.none() }),
      ]);
      assertTrue(A.every(verdicts, identity));
      deepStrictEqual(
        [
          S.is(PropertyType)({ type: "struct", fields: [first, second], mainValue: O.none() }),
          S.is(PropertyType)({ type: "struct", fields: [first, other], mainValue: O.none() }),
        ],
        [false, true]
      );
      // Names are compared exactly (case matters), and a repeated rid is not the struct's business.
      const distinct = yield* S.decodeUnknownEffect(StructType)(distinctWire);
      deepStrictEqual(
        A.map(distinct.fields, (field) => field.apiName),
        [StructFieldApiName.make("value"), StructFieldApiName.make("Value")]
      );
      const encoded = yield* S.encodeEffect(StructType)(distinct);
      deepStrictEqual<unknown>(encoded, distinctWire);
    })
  );

  it.prop(
    "StructType: generated struct types never repeat a field name",
    [Arbitrary.schema(StructType)],
    ([{ fields }]) => A.length(A.dedupe(A.map(fields, (field) => field.apiName))) === A.length(fields),
    { arbitrary: fcRuns(100) }
  );

  // Law: a struct type with no fields projects to "a record with no keys", never to "any non-null value".
  it.effect(
    "valueCodec: a struct with no fields still accepts only records",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(StructType.make({ fields: [] }));
      const verdicts = yield* Effect.all([
        rejects(codec)("not a struct"),
        rejects(codec)(42),
        rejects(codec)(true),
        rejects(codec)([]),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "valueCodec: a struct with no fields decodes the empty record, encodes it back and refuses any key",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(StructType.make({ fields: [] }));
      const { decoded, encoded } = yield* throughCodec(StructType.make({ fields: [] }), {});
      deepStrictEqual([decoded, encoded], [{}, {}]);
      const verdicts = yield* Effect.all([
        rejects(codec)(null),
        rejects(codec)(undefined),
        rejects(codec)(["x"]),
        rejects(codec)(0),
        rejects(codec)(""),
        // Unlike a struct with fields, which strips undeclared keys, the empty projection has no key to keep.
        rejects(codec)({ undeclared: "value" }),
        refusesToEncode(codec)("not a struct"),
        refusesToEncode(codec)([]),
      ]);
      assertTrue(A.every(verdicts, identity));
      deepStrictEqual(
        [S.is(codec)({}), S.is(codec)("text"), S.is(codec)(7), S.is(codec)([]), S.is(codec)(null)],
        [true, false, false, false, false]
      );
      const generated = yield* Arbitrary.sampleEffect(Arbitrary.schema(codec), { count: 10, seed: 3 });
      const isRecord = S.is(S.Record(S.String, S.Unknown));
      strictEqual(A.length(generated), 10);
      assertTrue(A.every(generated, (value) => isRecord(value) && A.isReadonlyArrayEmpty(R.keys(value))));
    })
  );

  // Law: a geotime series reference property holds a reference (by id, or by id and integration) or the resolved
  // latest value; all three wire shapes decode.
  it.effect(
    "valueCodec: a geotime series reference property accepts a reference, not only a dereferenced value",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(GeotimeSeriesReferenceType.make({}));
      const verdicts = yield* Effect.all([
        rejects(codec)("GeotimeSeriesReferencePlaceholder"),
        rejects(codec)({
          geotimeSeriesId: "employee-50030",
          geotimeSeriesIntegrationRid: `ri.geotime-catalog.main.integration.${uuid}`,
        }),
      ]);
      assertFalse(A.some(verdicts, identity));
    })
  );

  it.effect(
    "valueCodec: decodes each wire shape of a geotime series reference to its tagged case and encodes it back",
    Effect.fnUntraced(function* () {
      const type = GeotimeSeriesReferenceType.make({});
      const integration = `ri.geotime-catalog.main.integration.${uuid}`;
      const byId = yield* throughCodec(type, "employee-50030");
      const integrated = yield* throughCodec(type, {
        geotimeSeriesId: "employee-50030",
        geotimeSeriesIntegrationRid: integration,
      });
      const resolved = yield* throughCodec(type, {
        type: "geotimeSeriesValue",
        position: [102.0, 0.5],
        timestamp: "2021-01-04T05:00:00.000Z",
      });
      deepStrictEqual(byId.decoded, { type: "series", geotimeSeriesId: "employee-50030" });
      deepStrictEqual(integrated.decoded, {
        type: "integratedSeries",
        geotimeSeriesId: "employee-50030",
        sourceRid: integration,
      });
      deepStrictEqual(
        [byId.encoded, integrated.encoded, resolved.encoded],
        [
          "employee-50030",
          { geotimeSeriesId: "employee-50030", geotimeSeriesIntegrationRid: integration },
          { type: "geotimeSeriesValue", position: [102.0, 0.5], timestamp: "2021-01-04T05:00:00.000Z" },
        ]
      );
      const codec = valueCodec(type);
      const refusals = yield* Effect.all([
        rejects(codec)(""),
        rejects(codec)(7),
        rejects(codec)(null),
        rejects(codec)({ geotimeSeriesId: "employee-50030" }),
        rejects(codec)({ geotimeSeriesId: "", geotimeSeriesIntegrationRid: integration }),
        rejects(codec)({ type: "geotimeSeriesValue", position: [102.0, 0.5] }),
        rejects(codec)(["employee-50030"]),
      ]);
      assertTrue(A.every(refusals, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// operandCodec: the projection from a property type to the codec of a comparison operand
// ---------------------------------------------------------------------------

describe("operandCodec", () => {
  it("is a codec from the wire scalar, whatever the property type", () => {
    const facts: readonly [
      Equals<ReturnType<typeof operandCodec>["Encoded"], ScalarValue>,
      Equals<ReturnType<typeof operandCodec>["Encoded"], string | number | boolean>,
    ] = [true, true];
    assertTrue(A.every(facts, identity));
    assertTrue(A.every(PropertyTypeKind.literals, (kind) => S.isSchema(operandCodec(valuePerCase[kind][0]))));
  });

  // The defining law, for every case of the union: the operand codec is the value codec of the tested type,
  // restricted to the values that travel as one scalar. Where the value codec writes a scalar, the operand codec
  // writes the same scalar and reads it back as an equivalent value; where it writes anything else, the operand
  // codec refuses in both directions. `scalar` counts the generated values of a case that travel as a scalar.
  const scalarShare = Effect.fnUntraced(function* (kind: PropertyTypeKind) {
    const type = valuePerCase[kind][0];
    const value = valueCodec(operandType(type));
    const operand = operandCodec(type);
    const same = S.toEquivalence(value);
    const values = yield* Arbitrary.sampleEffect(Arbitrary.schema(value), { count: 25, seed: 7 });
    const verdicts = yield* Effect.forEach(
      values,
      Effect.fnUntraced(function* (generated) {
        const wire = yield* S.encodeUnknownEffect(value)(generated);
        if (!S.is(ScalarValue)(wire)) {
          const refusals = yield* Effect.all([refusesToEncode(operand)(generated), rejects(operand)(wire)]);
          return { scalar: false, lawful: A.every(refusals, identity) };
        }
        const written = yield* S.encodeUnknownEffect(operand)(generated);
        const read = yield* S.decodeEffect(operand)(wire);
        return { scalar: true, lawful: written === wire && S.is(value)(read) && same(read, generated) };
      })
    );
    return {
      kind,
      lawful: A.length(values) === 25 && A.every(verdicts, (verdict) => verdict.lawful),
      scalar: A.length(A.filter(verdicts, (verdict) => verdict.scalar)),
    };
  });

  it.effect(
    "round-trips every value that travels as a scalar and refuses every other, for each case of the union",
    Effect.fnUntraced(function* () {
      const shares = yield* Effect.forEach(PropertyTypeKind.literals, scalarShare);
      strictEqual(A.length(shares), 22);
      deepStrictEqual(
        A.filter(shares, (share) => !share.lawful),
        []
      );
      const kindsWhere = (holds: (scalar: number) => boolean): ReadonlyArray<string> =>
        A.map(
          A.filter(shares, (share) => holds(share.scalar)),
          (share) => share.kind
        );
      // Every value of these travels as one scalar: the twelve scalar tags, a cipher text (one string), and the
      // array of the fixture table, whose elements are strings.
      deepStrictEqual(
        kindsWhere((scalar) => scalar === 25),
        [
          "boolean",
          "byte",
          "short",
          "integer",
          "long",
          "float",
          "double",
          "decimal",
          "string",
          "date",
          "timestamp",
          "marking",
          "cipherText",
          "array",
        ]
      );
      // No value of these travels as a scalar, so no operand is a value of the property.
      deepStrictEqual(
        kindsWhere((scalar) => scalar === 0),
        ["attachment", "mediaReference", "geopoint", "geoshape", "vector", "struct"]
      );
      // A series reference has a bare-identifier form beside its record forms: only that form is a scalar.
      deepStrictEqual(
        kindsWhere((scalar) => scalar > 0 && scalar < 25),
        ["geotimeSeriesReference", "timeseries"]
      );
    })
  );

  it.effect(
    "reads the canonical text of each rich scalar as the property's value and writes it back",
    Effect.fnUntraced(function* () {
      const through = Effect.fnUntraced(function* (type: PropertyType, wire: ScalarValue) {
        const codec = operandCodec(type);
        const decoded = yield* S.decodeEffect(codec)(wire);
        const encoded = yield* S.encodeEffect(codec)(decoded);
        return { decoded, encoded };
      });
      const long = yield* through(LongType.make({}), "9007199254740993");
      strictEqual(long.decoded, BigInt("9007199254740993"));
      strictEqual(long.encoded, "9007199254740993");
      const decimal = yield* through(DecimalType.make({}), "12.50");
      assertTrue(BigDecimal.isBigDecimal(decimal.decoded) && decimal.decoded.scale === 2);
      strictEqual(decimal.encoded, "12.50");
      const date = yield* through(DateType.make({}), "2021-01-04");
      deepStrictEqual<unknown>(date.decoded, LocalDate.make({ year: 2021, month: 1, day: 4 }));
      strictEqual(date.encoded, "2021-01-04");
      const timestamp = yield* through(TimestampType.make({}), "2021-01-04T05:00:00Z");
      deepStrictEqual<unknown>(timestamp.decoded, DateTime.makeUnsafe("2021-01-04T05:00:00.000Z"));
      strictEqual(timestamp.encoded, "2021-01-04T05:00:00.000Z");
      // The forms the wire tolerates on decode are read too, and the canonical form is what is written.
      const legacy = yield* Effect.all([
        through(IntegerType.make({}), "238940"),
        through(BooleanType.make({}), "true"),
        through(LongType.make({}), 7),
        through(DecimalType.make({}), 2.5),
      ]);
      deepStrictEqual(
        A.map(legacy, ({ encoded }) => encoded),
        [238940, true, "7", "2.5"]
      );
    })
  );

  it.effect(
    "looks through arrays at any depth: the operand of an array is an operand of its innermost element type",
    Effect.fnUntraced(function* () {
      const dates = ArrayType.make({ elementType: DateType.make({}) });
      const matrix = ArrayType.make({ elementType: ArrayType.make({ elementType: LongType.make({}) }) });
      // `operandType` is the one statement of the rule: the innermost element type, or the type itself.
      deepStrictEqual(
        A.map([dates, matrix, DateType.make({})], (type) => operandType(type).type),
        ["date", "long", "date"]
      );
      assertTrue(
        A.every(PropertyTypeKind.literals, (kind) => {
          const type = valuePerCase[kind][0];
          const compared = operandType(type);
          return !PropertyType.guards.array(compared) && (PropertyType.guards.array(type) || compared === type);
        })
      );
      const day = yield* S.decodeEffect(operandCodec(dates))("2021-01-04");
      deepStrictEqual<unknown>(day, LocalDate.make({ year: 2021, month: 1, day: 4 }));
      const cell = yield* S.decodeEffect(operandCodec(matrix))("9007199254740993");
      strictEqual(cell, BigInt("9007199254740993"));
      const written = yield* S.encodeUnknownEffect(operandCodec(matrix))(BigInt(7));
      strictEqual(written, "7");
      // The array itself is not an operand, in either direction.
      const verdicts = yield* Effect.all([
        rejects(operandCodec(dates))(["2021-01-04"]),
        refusesToEncode(operandCodec(dates))([LocalDate.make({ year: 2021, month: 1, day: 4 })]),
        refusesToEncode(operandCodec(matrix))([[BigInt(7)]]),
      ]);
      deepStrictEqual(verdicts, [true, true, true]);
    })
  );

  it.effect(
    "refuses an operand the property's type does not read, and anything that is not a wire scalar",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(operandCodec(DateType.make({})))("4 January"),
        rejects(operandCodec(DateType.make({})))("2021-02-30"),
        rejects(operandCodec(IntegerType.make({})))("old"),
        rejects(operandCodec(IntegerType.make({})))(2147483648),
        rejects(operandCodec(LongType.make({})))("9223372036854775808"),
        rejects(operandCodec(TimestampType.make({})))("yesterday"),
        rejects(operandCodec(BooleanType.make({})))("yes"),
        rejects(operandCodec(StringType.make({})))(7),
        // A struct, a geometry, an attachment: their values are records, so no scalar is one of them.
        rejects(operandCodec(valuePerCase.struct[0]))("Alex"),
        rejects(operandCodec(GeoPointType.make({})))("102.0,0.5"),
        rejects(operandCodec(AttachmentType.make({})))(
          "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f"
        ),
      ]);
      assertTrue(A.every(verdicts, identity));
      const notScalars: ReadonlyArray<unknown> = [null, undefined, {}, [], ["x"], BigInt(7), Number.NaN];
      const refused = yield* Effect.forEach(PropertyTypeKind.literals, (kind) =>
        Effect.forEach(notScalars, rejects(operandCodec(valuePerCase[kind][0])))
      );
      assertTrue(A.every(A.flatten(refused), identity));
      // A rich value is not a wire operand: it has to be written by this codec, not handed to it as its wire form.
      const rich = yield* Effect.all([
        rejects(operandCodec(LongType.make({})))(BigInt("9007199254740993")),
        rejects(operandCodec(DateType.make({})))(LocalDate.make({ year: 2021, month: 1, day: 4 })),
        rejects(operandCodec(TimestampType.make({})))(DateTime.makeUnsafe(0)),
        rejects(operandCodec(DecimalType.make({})))(BigDecimal.fromStringUnsafe("12.50")),
      ]);
      deepStrictEqual(rich, [true, true, true, true]);
    })
  );
});

describe("fieldCodec", () => {
  it.effect(
    "decodes an absent key and an explicit null to none, and a present value with the value codec",
    Effect.fnUntraced(function* () {
      const Row = S.Struct({ nickname: fieldCodec(StringType.make({})), balance: fieldCodec(LongType.make({})) });
      const absent = yield* S.decodeEffect(Row)({});
      const explicitNull = yield* S.decodeEffect(Row)({ nickname: null, balance: null });
      const present = yield* S.decodeEffect(Row)({ nickname: "Ishmael", balance: "58319870951433" });
      deepStrictEqual(absent, { nickname: O.none(), balance: O.none() });
      deepStrictEqual(explicitNull, { nickname: O.none(), balance: O.none() });
      deepStrictEqual(present, { nickname: O.some("Ishmael"), balance: O.some(BigInt("58319870951433")) });
      const encodedAbsent = yield* S.encodeUnknownEffect(Row)(absent);
      const encodedPresent = yield* S.encodeUnknownEffect(Row)(present);
      deepStrictEqual(encodedAbsent, {});
      deepStrictEqual(encodedPresent, { nickname: "Ishmael", balance: "58319870951433" });
    })
  );

  it.effect(
    "still rejects a present value of the wrong type",
    Effect.fnUntraced(function* () {
      const Row = S.Struct({ balance: fieldCodec(LongType.make({})) });
      const verdicts = yield* Effect.all([
        rejects(Row)({ balance: 12.5 }),
        rejects(Row)({ balance: true }),
        rejects(Row)({ balance: "" }),
        rejects(Row)({ balance: "12.5" }),
        rejects(Row)({ balance: "9223372036854775808" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "reads a present long written as a JSON integer and writes the documented string",
    Effect.fnUntraced(function* () {
      const Row = S.Struct({ balance: fieldCodec(LongType.make({})) });
      const decoded = yield* S.decodeEffect(Row)({ balance: 58319870951433 });
      deepStrictEqual(decoded, { balance: O.some(BigInt("58319870951433")) });
      const encoded = yield* S.encodeUnknownEffect(Row)(decoded);
      deepStrictEqual(encoded, { balance: "58319870951433" });
    })
  );
});

// ---------------------------------------------------------------------------
// Parity with the OSDK test stubs (osdk-ts `packages/shared.test/src/stubs`)
// ---------------------------------------------------------------------------

// `objectTypeWithAllPropertyTypes.properties` from `objectTypeV2.ts`: each property's `dataType`, transcribed.
const allPropertyTypesStub: { readonly [property: string]: PropertyType.Encoded } = {
  id: { type: "integer" },
  string: { type: "string" },
  boolean: { type: "boolean" },
  date: { type: "date" },
  dateTime: { type: "timestamp" },
  decimal: { type: "decimal" },
  integer: { type: "integer" },
  long: { type: "long" },
  short: { type: "short" },
  float: { type: "float" },
  double: { type: "double" },
  byte: { type: "byte" },
  attachment: { type: "attachment" },
  attachment2: { type: "attachment" },
  geoPoint: { type: "geopoint" },
  geoShape: { type: "geoshape" },
  stringArray: { type: "array", subType: { type: "string" }, reducers: [] },
  booleanArray: { type: "array", subType: { type: "boolean" }, reducers: [] },
  dateArray: { type: "array", subType: { type: "date" }, reducers: [] },
  dateTimeArray: { type: "array", subType: { type: "timestamp" }, reducers: [] },
  decimalArray: { type: "array", subType: { type: "decimal" }, reducers: [] },
  integerArray: { type: "array", subType: { type: "integer" }, reducers: [] },
  longArray: { type: "array", subType: { type: "long" }, reducers: [] },
  shortArray: { type: "array", subType: { type: "short" }, reducers: [] },
  floatArray: { type: "array", subType: { type: "float" }, reducers: [] },
  doubleArray: { type: "array", subType: { type: "double" }, reducers: [] },
  byteArray: { type: "array", subType: { type: "byte" }, reducers: [] },
  attachmentArray: { type: "array", subType: { type: "attachment" }, reducers: [] },
  geoPointArray: { type: "array", subType: { type: "geopoint" }, reducers: [] },
  geoShapeArray: { type: "array", subType: { type: "geoshape" }, reducers: [] },
  mediaReference: { type: "mediaReference" },
  vector: { type: "vector", dimension: 100, supportsSearchWith: [] },
  cipherText: { type: "cipherText" },
};

// `employeeObjectType.properties` from the same file: the property types the first stub does not exercise.
const employeeStub: { readonly [property: string]: PropertyType.Encoded } = {
  employeeId: { type: "integer" },
  fullName: { type: "string" },
  office: { type: "string" },
  class: { type: "string" },
  startDate: { type: "date" },
  employeeStatus: { type: "timeseries", itemType: { type: "string" } },
  employeeSensor: { type: "timeseries", itemType: { type: "string" } },
  employeeLocation: { type: "geotimeSeriesReference" },
  skillSet: { type: "string" },
  skillSetEmbedding: {
    type: "vector",
    dimension: 1536,
    supportsSearchWith: [{ value: "COSINE_SIMILARITY" }],
    embeddingModel: { type: "lms", value: "OPENAI_TEXT_EMBEDDING_ADA_002" },
  },
  favoriteRestaurants: { type: "array", subType: { type: "string" }, reducers: [] },
  employeeProfile: employeeProfileWire,
  performanceScores: {
    type: "array",
    subType: { type: "double" },
    reducers: [{ direction: "DESCENDING_NULLS_LAST" }],
  },
  bonusHistory: bonusHistoryWire,
};

const polygon = {
  coordinates: [
    [
      [1.0, 1.0],
      [1.0, 2.0],
      [2.0, 2.0],
      [2.0, 1.0],
      [1.0, 1.0],
    ],
  ],
  type: "Polygon",
};

// `objectWithAllPropertyTypes1` from `objects.ts`: the property values, transcribed (the stub has no vector value).
const allPropertyValuesStub: { readonly [property: string]: unknown } = {
  id: 1,
  string: "string",
  boolean: true,
  date: "2019-01-01",
  dateTime: "2019-01-01T01:01:01.000Z",
  decimal: 1.1,
  integer: 1,
  attachment: { rid: "ri.attachments.main.attachment.86016861-707f-4292-b258-6a7108915a75" },
  attachment2: { rid: "ri.attachments.main.attachment.86016861-707f-4292-b258-6a7108915a80" },
  attachmentArray: [
    { rid: "ri.attachments.main.attachment.86016861-707f-4292-b258-6a7108915a75" },
    { rid: "ri.attachments.main.attachment.86016861-707f-4292-b258-6a7108915a80" },
  ],
  long: 1,
  short: 1,
  float: 1.1,
  double: 1.1,
  byte: 1,
  geoPoint: { type: "Point", coordinates: [1.1, 1.1] },
  geoShape: polygon,
  stringArray: ["string"],
  booleanArray: [true],
  dateArray: ["2019-01-01"],
  dateTimeArray: ["2019-01-01T01:01:01.000Z"],
  decimalArray: [1.1],
  integerArray: [1],
  longArray: [1],
  shortArray: [1],
  floatArray: [1.1],
  doubleArray: [1.1],
  byteArray: [1],
  geoPointArray: [{ type: "Point", coordinates: [1.1, 1.1] }],
  geoShapeArray: [polygon],
  mediaReference: {
    mimeType: "application/pdf",
    reference: {
      type: "mediaSetViewItem",
      mediaSetViewItem: {
        mediaSetRid: "ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642",
        mediaSetViewRid: "ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b",
        mediaItemRid: "ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225",
      },
    },
  },
  cipherText: "ciphertext-encrypted-value",
};

// `employee1` from `objects.ts`: the property values, transcribed.
const employeeValuesStub: { readonly [property: string]: unknown } = {
  employeeId: 50030,
  fullName: "John Doe",
  office: "NYC",
  class: "Red",
  startDate: "2019-01-01",
  employeeStatus: "TimeSeries<String>",
  employeeSensor: "TimeSeries<>",
  employeeLocation: "GeotimeSeriesReferencePlaceholder",
  employeeProfile: { bio: "Senior engineer with expertise in distributed systems", yearsExperience: 10 },
  performanceScores: [95.5, 88.2, 92.1],
};

const decodesAsStubProperty = (types: { readonly [property: string]: PropertyType.Encoded }) =>
  Effect.fnUntraced(function* ([property, value]: readonly [string, unknown]) {
    const wire = yield* Effect.fromOption(R.get(types, property));
    const type = yield* S.decodeEffect(PropertyType)(wire);
    const exit = yield* Effect.exit(throughCodec(type, value));
    return Tuple.make(property, Exit.isSuccess(exit));
  });

describe("parity with the OSDK test stubs", () => {
  it.effect(
    "decodes the data type of every stub property, encodes it back verbatim and projects it to a codec",
    Effect.fnUntraced(function* () {
      const stubs = A.appendAll(R.toEntries(allPropertyTypesStub), R.toEntries(employeeStub));
      strictEqual(A.length(R.keys(allPropertyTypesStub)), 33);
      strictEqual(A.length(R.keys(employeeStub)), 14);
      const tags = yield* Effect.forEach(
        stubs,
        Effect.fnUntraced(function* ([, wire]) {
          const type = yield* S.decodeEffect(PropertyType)(wire);
          const encoded = yield* S.encodeEffect(PropertyType)(type);
          deepStrictEqual(encoded, wire);
          deepStrictEqual([S.isSchema(valueCodec(type)), S.isSchema(fieldCodec(type))], [true, true]);
          // Each stub property is `{ dataType, rid: "rid", typeClasses: [] }`.
          const definitionWire: (typeof PropertyDefinition)["Encoded"] = {
            dataType: wire,
            rid: "rid",
            typeClasses: [],
          };
          const definition = yield* S.decodeEffect(PropertyDefinition)(definitionWire);
          const encodedDefinition = yield* S.encodeEffect(PropertyDefinition)(definition);
          deepStrictEqual(encodedDefinition, definitionWire);
          return PropertyType.match(type, {
            boolean: () => [type.type],
            byte: () => [type.type],
            short: () => [type.type],
            integer: () => [type.type],
            long: () => [type.type],
            float: () => [type.type],
            double: () => [type.type],
            decimal: () => [type.type],
            string: () => [type.type],
            date: () => [type.type],
            timestamp: () => [type.type],
            marking: () => [type.type],
            cipherText: () => [type.type],
            attachment: () => [type.type],
            mediaReference: () => [type.type],
            geopoint: () => [type.type],
            geoshape: () => [type.type],
            geotimeSeriesReference: () => [type.type],
            timeseries: () => [type.type],
            vector: () => [type.type],
            array: ({ elementType }) => [type.type, elementType.type],
            struct: () => [type.type],
          });
        })
      );
      // Between them the two stubs exercise every property type except `marking`.
      const covered: ReadonlyArray<string> = A.dedupe(A.flatten(tags));
      const all: ReadonlyArray<string> = PropertyTypeKind.literals;
      deepStrictEqual(A.difference(all, covered), ["marking"]);
    })
  );

  // The stub instance writes its long and its decimal as JSON numbers ("Long | string", "Decimal | string" in
  // 09-wire-c-core-geo.md §5.1); the kernel reads both leniently. The one value it still refuses is a cipher text
  // that is not a `CIPHER::...::CIPHER` envelope. Whoever decodes these stubs as objects has to expect that refusal.
  it.effect(
    "decodes the stub values of the all-property-types object, except where the stub departs from the wire contract",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(
        R.toEntries(allPropertyValuesStub),
        decodesAsStubProperty(allPropertyTypesStub)
      );
      const refused = A.map(
        A.filter(verdicts, ([, decoded]) => !decoded),
        ([property]) => property
      );
      strictEqual(A.length(verdicts), 32);
      deepStrictEqual(A.sort(refused, Order.String), ["cipherText"]);
    })
  );

  it.effect(
    "reads the stub's JSON-number long and decimal values and writes them back as the documented strings",
    Effect.fnUntraced(function* () {
      const decimalType = DecimalType.make({});
      const decimalArrayType = ArrayType.make({ elementType: decimalType });
      const long = yield* throughCodec(LongType.make({}), 1);
      const longArray = yield* throughCodec(ArrayType.make({ elementType: LongType.make({}) }), [1]);
      const decimal = yield* throughCodec(decimalType, 1.1);
      const decimalArray = yield* throughCodec(decimalArrayType, [1.1]);
      deepStrictEqual([long.decoded, longArray.decoded], [BigInt(1), [BigInt(1)]]);
      const onePointOne = BigDecimal.fromStringUnsafe("1.1");
      assertTrue(S.toEquivalence(valueCodec(decimalType))(decimal.decoded, onePointOne));
      assertTrue(S.toEquivalence(valueCodec(decimalArrayType))(decimalArray.decoded, [onePointOne]));
      deepStrictEqual(
        [long.encoded, longArray.encoded, decimal.encoded, decimalArray.encoded],
        ["1", ["1"], "1.1", ["1.1"]]
      );
    })
  );

  it.effect(
    "decodes the stub values of the employee object and encodes them back unchanged",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(R.toEntries(employeeValuesStub), decodesAsStubProperty(employeeStub));
      deepStrictEqual(
        A.map(
          A.filter(verdicts, ([, decoded]) => !decoded),
          ([property]) => property
        ),
        []
      );
      const encoded = yield* Effect.forEach(
        R.toEntries(employeeValuesStub),
        Effect.fnUntraced(function* ([property, value]) {
          const wire = yield* Effect.fromOption(R.get(employeeStub, property));
          const type = yield* S.decodeEffect(PropertyType)(wire);
          const result = yield* throughCodec(type, value);
          return Tuple.make(property, result.encoded);
        })
      );
      deepStrictEqual(R.fromEntries(encoded), employeeValuesStub);
    })
  );
});

// ---------------------------------------------------------------------------
// Property addressing
// ---------------------------------------------------------------------------

describe("decodeAddressTo", () => {
  // A record with a renamed wire key and a checked domain side: the two things the tagged factory cannot say.
  const Wire = S.Struct({ ...PropertyAddressFields, width: S.Finite }).pipe(S.encodeKeys({ width: "fixedWidth" }));
  const Domain = S.Struct({ property: PropertySelector, width: S.Finite.check(S.isGreaterThan(0)) });
  const Bucketed = decodeAddressTo(Wire, Domain);
  const bySalary = PropertyByName.make({ apiName: PropertyApiName.make("salary") });

  lawful("decodeAddressTo", Bucketed);

  it.effect(
    "reads either address key into the one selector and writes the compact key whenever it can",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(Bucketed);
      const byField = yield* decode({ field: "salary", fixedWidth: 10 });
      const byRecord = yield* decode({ propertyIdentifier: { type: "property", apiName: "salary" }, fixedWidth: 10 });
      const byTitle = yield* decode({ propertyIdentifier: { type: "titleProperty" }, fixedWidth: 10 });
      deepStrictEqual(byField, { property: bySalary, width: 10 });
      deepStrictEqual(byRecord, byField);
      deepStrictEqual(byTitle, { property: TitleProperty.make({}), width: 10 });
      const wire = yield* Effect.forEach([byField, byRecord, byTitle], (value) => S.encodeEffect(Bucketed)(value));
      deepStrictEqual<unknown>(wire, [
        { field: "salary", fixedWidth: 10 },
        { field: "salary", fixedWidth: 10 },
        { propertyIdentifier: { type: "titleProperty" }, fixedWidth: 10 },
      ]);
    })
  );

  it.effect(
    "rejects both keys, neither key, the domain key on the wire and a value the domain side refuses",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(
        [
          { field: "salary", propertyIdentifier: { type: "titleProperty" }, fixedWidth: 10 },
          { fixedWidth: 10 },
          { property: { type: "property", apiName: "salary" }, fixedWidth: 10 },
          { field: "salary", width: 10 },
          { field: "salary", fixedWidth: 0 },
          { field: "", fixedWidth: 10 },
        ],
        rejects(Bucketed)
      );
      deepStrictEqual(verdicts, A.map(verdicts, () => true));
      assertFalse(S.is(Bucketed)({ property: bySalary, width: 0 }));
    })
  );

  it.effect(
    "builds the same codec data-first and data-last",
    Effect.fnUntraced(function* () {
      const dataLast = pipe(Wire, decodeAddressTo(Domain));
      const wire = { propertyIdentifier: { type: "primaryKeyProperty" }, fixedWidth: 2.5 };
      const first = yield* S.decodeUnknownEffect(Bucketed)(wire);
      const last = yield* S.decodeUnknownEffect(dataLast)(wire);
      deepStrictEqual(last, first);
      const encoded = yield* S.encodeEffect(dataLast)(last);
      deepStrictEqual<unknown>(encoded, wire);
    })
  );
});

// ---------------------------------------------------------------------------
// The type a selector addresses
// ---------------------------------------------------------------------------

describe("selectedType", () => {
  const rid = PropertyTypeRid.make("ri.ontology.main.property.example");
  const declare = (dataType: PropertyType) => PropertyDefinition.make({ dataType, rid });
  const age = PropertyApiName.make("age");
  const profile = PropertyApiName.make("employeeProfile");
  const bonuses = PropertyApiName.make("bonusHistory");
  const properties = R.fromEntries([
    [age, declare(IntegerType.make({}))],
    [profile, declare(employeeProfile)],
    [bonuses, declare(bonusHistory)],
  ]);
  const named = (apiName: PropertyApiName) => PropertyByName.make({ apiName });
  const fieldOf = (propertyApiName: PropertyApiName, field: string) =>
    StructFieldOfProperty.make({ propertyApiName, structFieldApiName: StructFieldApiName.make(field) });
  const select = selectedType(properties);

  it("gives a declared property its own type, whole", () => {
    deepStrictEqual(select(named(age)), O.some(O.some(IntegerType.make({}))));
    deepStrictEqual(select(named(profile)), O.some(O.some<PropertyType>(employeeProfile)));
    deepStrictEqual(select(named(bonuses)), O.some(O.some<PropertyType>(bonusHistory)));
  });

  it("reads a field of a struct, and a field of an array of structs the same way", () => {
    deepStrictEqual(select(fieldOf(profile, "bio")), O.some(O.some(StringType.make({}))));
    deepStrictEqual(select(fieldOf(profile, "yearsExperience")), O.some(O.some(IntegerType.make({}))));
    deepStrictEqual(select(fieldOf(bonuses, "amount")), O.some(O.some(IntegerType.make({}))));
  });

  it("answers none for a property, a field and a field of a non-struct the table does not declare", () => {
    assertNone(select(named(PropertyApiName.make("nickname"))));
    assertNone(select(fieldOf(profile, "motto")));
    assertNone(select(fieldOf(bonuses, "motto")));
    assertNone(select(fieldOf(age, "bio")));
    assertNone(select(fieldOf(PropertyApiName.make("nickname"), "bio")));
  });

  it("answers declared-but-untyped for the title, the primary key and a selector with a load level", () => {
    assertSome(select(TitleProperty.make({})), O.none());
    assertSome(select(PrimaryKeyProperty.make({})), O.none());
    assertSome(select(PropertyAtLoadLevel.make({ selector: named(age), loadLevel: "applyReducers" })), O.none());
    // The load level does not make an undeclared property declared.
    assertNone(
      select(PropertyAtLoadLevel.make({ selector: named(PropertyApiName.make("nickname")), loadLevel: "applyReducers" }))
    );
  });

  it("is the same function data-first and data-last", () => {
    deepStrictEqual(selectedType(named(age), properties), pipe(named(age), selectedType(properties)));
    deepStrictEqual(selectedType(fieldOf(profile, "bio"), properties), select(fieldOf(profile, "bio")));
  });
});
