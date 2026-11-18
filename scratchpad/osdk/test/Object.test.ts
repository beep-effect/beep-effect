import { isLocalDate, LocalDate } from "@beep/schema/LocalDate";
import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import {
  assertFalse,
  assertInclude,
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
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { PrimaryKeyKind, TimestampType } from "../src/DataType/index.ts";
import { ObjectRid, ObjectTypeApiName, PropertyApiName } from "../src/Identifier/index.ts";
import {
  BooleanKeyValue,
  DateKeyValue,
  DoubleKeyValue,
  IntegerKeyValue,
  InstanceOf,
  InterfaceObjectLocator,
  instanceCodec,
  LongKeyValue,
  ObjectLocator,
  ObjectRecord,
  ObjectSpecifier,
  OntologyObject,
  PrimaryKeyValue,
  StringKeyValue,
  TimestampKeyValue,
  TypedPrimaryKeyValue,
} from "../src/Object/index.ts";
import { fieldCodec, operandCodec, PropertyDefinition, PropertyType, valueCodec } from "../src/Property/index.ts";
import { DateValue, DecimalValue, LongValue, TimestampValue } from "../src/Value/index.ts";
import type { ScalarValue } from "../src/Value/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by the named schemas
// ---------------------------------------------------------------------------

const generates = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const is = S.is(schema);

  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });
};

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, arbitrary: Arbitrary.Arbitrary<T>): void => {
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  it.effect.prop(
    `${name}: encode then decode is equivalent to the original`,
    [arbitrary],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(equivalence(decoded, value));
    }),
    { arbitrary: fcRuns(50) }
  );
};

const failureOf = <A>(effect: Effect.Effect<A, S.SchemaError>): Effect.Effect<string, A> =>
  Effect.map(Effect.flip(effect), (error) => error.message);

// The round trip of one wire record through a codec: decoding, encoding and decoding again lands on an equivalent
// value under the codec's own equivalence.
const reDecodes = Effect.fnUntraced(function* <T, E>(codec: S.Codec<T, E>, wire: E) {
  const decoded = yield* S.decodeEffect(codec)(wire);
  const encoded = yield* S.encodeEffect(codec)(decoded);
  const again = yield* S.decodeEffect(codec)(encoded);
  return S.toEquivalence(codec)(again, decoded);
});

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

const employeeType = ObjectTypeApiName.make("Employee");

// ---------------------------------------------------------------------------
// Fixtures transcribed from osdk-ts `packages/shared.test/src/stubs/objects.ts`
// ---------------------------------------------------------------------------

// `employee1`: an employee with a struct property and an array property.
const employee1 = {
  __rid: "ri.phonograph2-objects.main.object.88a6fccb-f333-46d6-a07e-7725c5f18b61",
  __primaryKey: 50030,
  __apiName: "Employee",
  employeeId: 50030,
  fullName: "John Doe",
  office: "NYC",
  class: "Red",
  startDate: "2019-01-01",
  employeeStatus: "TimeSeries<String>",
  employeeSensor: "TimeSeries<>",
  employeeLocation: "GeotimeSeriesReferencePlaceholder",
  employeeProfile: {
    bio: "Senior engineer with expertise in distributed systems",
    yearsExperience: 10,
  },
  performanceScores: [95.5, 88.2, 92.1],
};

// `nycOffice`: an office with a geopoint and a geoshape property.
const nycOffice = {
  __rid: "ri.phonograph2-objects.main.object.c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0",
  __primaryKey: "NYC",
  __apiName: "Office",
  __title: "New York City",
  officeId: "NYC",
  name: "New York City",
  entrance: { type: "Point", coordinates: [1.1, 1.1] },
  occupiedArea: {
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
  },
};

// `travisPlayer`: a player with a struct property.
const travisPlayer = {
  __rid: "ri.phonograph2-objects.main.object.c0c0c3c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0",
  __primaryKey: "tkelce",
  __apiName: "BgaoNflPlayer",
  __title: "tkelce",
  gamesPlayed: 171,
  name: "Travis Kelce",
  number: 87,
  wikiUrl: "myKelce.com",
  address: {
    addressLine1: "15 Muppets Lane",
    addressLine2: "Resort No 4",
    city: "Memphis",
    state: "TN",
    zipCode: 11100,
  },
  id: "tkelce",
};

// ---------------------------------------------------------------------------
// Property definitions transcribed from osdk-ts `packages/shared.test/src/stubs/objectTypeV2.ts`
// ---------------------------------------------------------------------------

// `employeeObjectType.properties`
const employeeProperties = {
  employeeId: { dataType: { type: "integer" }, rid: "rid", typeClasses: [] },
  fullName: { dataType: { type: "string" }, rid: "rid", typeClasses: [] },
  office: {
    description: 'The unique "ID" of the employee\'s \\"primary\\" assigned office.\n This is some more text.',
    dataType: { type: "string" },
    rid: "rid",
    typeClasses: [],
  },
  class: { description: "", dataType: { type: "string" }, rid: "rid", typeClasses: [] },
  startDate: {
    description: "The date the employee was hired (most recently, if they were re-hired)",
    dataType: { type: "date" },
    rid: "rid",
    typeClasses: [],
  },
  employeeStatus: {
    description: "TimeSeries of the status of the employee",
    dataType: { type: "timeseries", itemType: { type: "string" } },
    rid: "rid",
    typeClasses: [],
  },
  employeeSensor: {
    description: "TimeSeries sensor of the status of the employee",
    dataType: { type: "timeseries", itemType: { type: "string" } },
    rid: "rid",
    typeClasses: [],
  },
  employeeLocation: {
    description: "Geotime series reference of the location of the employee",
    dataType: { type: "geotimeSeriesReference" },
    rid: "rid",
    typeClasses: [],
  },
  skillSet: { description: "The skills of the employee", dataType: { type: "string" }, rid: "rid", typeClasses: [] },
  skillSetEmbedding: {
    description: "Vectorized skill set",
    dataType: {
      type: "vector",
      dimension: 1536,
      supportsSearchWith: [{ value: "COSINE_SIMILARITY" }],
      embeddingModel: { type: "lms", value: "OPENAI_TEXT_EMBEDDING_ADA_002" },
    },
    rid: "rid",
    typeClasses: [],
  },
  favoriteRestaurants: {
    dataType: { type: "array", subType: { type: "string" }, reducers: [] },
    rid: "rid",
    typeClasses: [],
  },
  employeeProfile: {
    description: "Employee profile with main value being the bio",
    dataType: {
      type: "struct",
      structFieldTypes: [
        { apiName: "bio", dataType: { type: "string" }, rid: "ri.struct.bio", typeClasses: [] },
        {
          apiName: "yearsExperience",
          dataType: { type: "integer" },
          rid: "ri.struct.yearsExperience",
          typeClasses: [],
        },
      ],
      mainValue: { mainValueType: { type: "string" }, fields: ["bio"] },
    },
    rid: "rid",
    typeClasses: [],
  },
  performanceScores: {
    description: "Array of performance scores with reducers",
    dataType: { type: "array", subType: { type: "double" }, reducers: [{ direction: "DESCENDING_NULLS_LAST" }] },
    rid: "rid",
    typeClasses: [],
  },
  bonusHistory: {
    description: "Bonus history with the latest amount as its main value",
    dataType: {
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
    },
    rid: "rid",
    typeClasses: [],
  },
};

// `officeObjectType.properties`
const officeProperties = {
  officeId: { dataType: { type: "string" }, rid: "rid", typeClasses: [] },
  entrance: { dataType: { type: "geopoint" }, rid: "rid", typeClasses: [] },
  occupiedArea: {
    description: "The occupied area of the Office",
    dataType: { type: "geoshape" },
    rid: "rid",
    typeClasses: [],
  },
  name: { description: "The Name of the Office", dataType: { type: "string" }, rid: "rid", typeClasses: [] },
  capacity: { description: "The capacity of the Office", dataType: { type: "integer" }, rid: "rid", typeClasses: [] },
};

// `BGaoNflPlayerObjectType.properties`
const playerProperties = {
  id: { dataType: { type: "string" }, rid: "rid", typeClasses: [] },
  gamesPlayed: { dataType: { type: "integer" }, rid: "rid", typeClasses: [] },
  name: { dataType: { type: "string" }, rid: "rid", typeClasses: [] },
  number: { dataType: { type: "integer" }, rid: "rid", typeClasses: [] },
  wikiUrl: { dataType: { type: "string" }, rid: "rid", typeClasses: [] },
  address: {
    dataType: {
      type: "struct",
      structFieldTypes: [
        { apiName: "addressLine1", dataType: { type: "string" }, rid: "ri.a.b.c.d", typeClasses: [] },
        { apiName: "addressLine2", dataType: { type: "string" }, rid: "ri.a.b.c.d", typeClasses: [] },
        { apiName: "city", dataType: { type: "string" }, rid: "ri.a.b.c.d", typeClasses: [] },
        { apiName: "state", dataType: { type: "string" }, rid: "ri.a.b.c.d", typeClasses: [] },
        { apiName: "zipCode", dataType: { type: "integer" }, rid: "ri.a.b.c.d", typeClasses: [] },
      ],
    },
    rid: "rid",
    typeClasses: [],
  },
  addressArray: {
    dataType: {
      type: "array",
      subType: {
        type: "struct",
        structFieldTypes: [
          { apiName: "addressLine1", dataType: { type: "string" }, rid: "ri.a.b.c.d", typeClasses: [] },
          { apiName: "addressLine2", dataType: { type: "string" }, rid: "ri.a.b.c.d", typeClasses: [] },
          { apiName: "city", dataType: { type: "geoshape" }, rid: "ri.a.b.c.d", typeClasses: [] },
          { apiName: "location", dataType: { type: "geopoint" }, rid: "ri.a.b.c.d", typeClasses: [] },
          { apiName: "zipCode", dataType: { type: "integer" }, rid: "ri.a.b.c.d", typeClasses: [] },
        ],
      },
      reducers: [],
    },
    rid: "ri.a.b.c.structArray",
    typeClasses: [],
  },
};

// `objectTypeWithTimestampPrimaryKey.properties`
const timestampKeyedProperties = {
  timestamp: { dataType: { type: "timestamp" }, rid: "rid", typeClasses: [] },
  value: { dataType: { type: "string" }, rid: "rid", typeClasses: [] },
};

const decodeDefinitions = S.decodeUnknownEffect(S.Record(PropertyApiName, PropertyDefinition));

// Projects the instance codec the way a caller holding a decoded object type would: name, key property, properties.
const projected = Effect.fnUntraced(function* (apiName: string, primaryKey: string, definitions: unknown) {
  const properties = yield* decodeDefinitions(definitions);
  return instanceCodec({
    apiName: ObjectTypeApiName.make(apiName),
    primaryKey: PropertyApiName.make(primaryKey),
    properties,
  });
});

const EmployeeInstance = projected("Employee", "employeeId", employeeProperties);
const OfficeInstance = projected("Office", "officeId", officeProperties);
const PlayerInstance = projected("BgaoNflPlayer", "id", playerProperties);
const TimestampKeyedInstance = projected("ObjectWithTimestampPrimaryKey", "timestamp", timestampKeyedProperties);

// ---------------------------------------------------------------------------
// Primary key values
// ---------------------------------------------------------------------------

describe("PrimaryKeyValue", () => {
  generates("PrimaryKeyValue", PrimaryKeyValue);
  // The strict law: a key is the wire scalar that carries it, so it is its own wire form in both directions.
  roundTrips("PrimaryKeyValue", PrimaryKeyValue, Arbitrary.schema(PrimaryKeyValue));

  it("is one wire scalar on both sides: the operand union under the name it has in a locator", () => {
    const facts: readonly [
      Equals<PrimaryKeyValue, string | number | boolean>,
      Equals<typeof PrimaryKeyValue.Encoded, string | number | boolean>,
      Equals<PrimaryKeyValue, ScalarValue>,
    ] = [true, true, true];
    assertTrue(A.every(facts, identity));
  });

  // A rich key is written by the codec of its key property's type; what a locator holds is the result.
  it.effect(
    "holds the wire scalar the codec of each kind of key writes, unchanged in both directions",
    Effect.fnUntraced(function* () {
      const long = yield* S.encodeEffect(LongValue)(BigInt("58319870951433"));
      const date = yield* S.encodeEffect(DateValue)(LocalDate.make({ year: 2021, month: 5, day: 1 }));
      const instant = yield* S.encodeEffect(TimestampValue)(DateTime.makeUnsafe("2021-01-04T05:00:00.000Z"));
      const keys: ReadonlyArray<PrimaryKeyValue> = ["EMP1234", 10033123, true, long, date, instant];
      const wire = yield* Effect.forEach(keys, (key) => S.encodeEffect(PrimaryKeyValue)(key));
      deepStrictEqual(wire, ["EMP1234", 10033123, true, "58319870951433", "2021-05-01", "2021-01-04T05:00:00.000Z"]);
      const decoded = yield* Effect.forEach(wire, (key) => S.decodeEffect(PrimaryKeyValue)(key));
      deepStrictEqual(decoded, keys);
    })
  );

  it.effect(
    "decodes a JSON scalar to itself: a date or a long key is the text it travels as",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(PrimaryKeyValue);
      const keys = yield* Effect.all([
        decode("EMP1234"),
        decode(10033123),
        decode(false),
        decode("58319870951433"),
        decode("2021-05-01"),
        decode("2021-01-04T05:00:00Z"),
      ]);
      deepStrictEqual(keys, ["EMP1234", 10033123, false, "58319870951433", "2021-05-01", "2021-01-04T05:00:00Z"]);
    })
  );

  it.effect(
    "rejects values no key property can hold, and a rich value where the wire scalar is expected",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(PrimaryKeyValue);
      const rich: ReadonlyArray<unknown> = [
        BigInt("58319870951433"),
        LocalDate.make({ year: 2021, month: 5, day: 1 }),
        DateTime.makeUnsafe("2021-01-04T05:00:00.000Z"),
      ];
      const messages = yield* Effect.all(
        A.map([null, ["EMP1234"], { value: 1 }, Number.NaN, Number.POSITIVE_INFINITY, ...rich], (input) =>
          failureOf(decode(input))
        )
      );
      strictEqual(messages.length, 8);
      deepStrictEqual(A.map(rich, S.is(PrimaryKeyValue)), [false, false, false]);
      const refused = yield* Effect.all(
        A.map(rich, (key) => Effect.isFailure(S.encodeUnknownEffect(PrimaryKeyValue)(key)))
      );
      deepStrictEqual(refused, [true, true, true]);
      // @ts-expect-error a 64-bit key is the text it travels as: a locator does not take the bigint
      throws(() => ObjectLocator.make({ objectType: employeeType, primaryKey: BigInt("58319870951433") }));
      // @ts-expect-error an instant key is the text it travels as: a locator does not take the DateTime
      throws(() => ObjectLocator.make({ objectType: employeeType, primaryKey: DateTime.makeUnsafe(0) }));
    })
  );

  // Every kind a primary key property may have (the kernel's `PrimaryKeyKind`) projects to an operand codec that
  // writes a value of the key property as a `PrimaryKeyValue` and reads it back: the wire scalar is wide enough
  // for a key of every kind, and with the key property's type in hand no value is lost.
  const keyTypes = A.getSomes(A.map(PrimaryKeyKind.literals, (type) => S.decodeOption(PropertyType)({ type })));

  it("covers all nine kinds a key property may have", () => {
    deepStrictEqual(
      A.map(keyTypes, (type) => type.type),
      ["string", "integer", "long", "short", "byte", "double", "boolean", "date", "timestamp"]
    );
  });

  A.forEach(keyTypes, (type) => {
    const codec = operandCodec(type);
    const same = S.toEquivalence(valueCodec(type));
    it.effect.prop(
      `a ${type.type} key travels as a wire scalar and is read back as the same value`,
      // The date arbitrary generates days no month has (see `realDateKeys` below); the law is stated on real days.
      [Arbitrary.filter(Arbitrary.schema(valueCodec(type)), (value) => !isLocalDate(value) || value.day <= 28)],
      Effect.fnUntraced(function* ([value]) {
        const key = yield* S.encodeEffect(codec)(value);
        assertTrue(S.is(PrimaryKeyValue)(key));
        const locator = ObjectLocator.make({ objectType: employeeType, primaryKey: key });
        const wire = yield* S.encodeEffect(ObjectLocator)(locator);
        const again = yield* S.decodeEffect(ObjectLocator)(wire);
        const read = yield* S.decodeEffect(codec)(again.primaryKey);
        assertTrue(same(read, value));
      }),
      { arbitrary: fcRuns(25) }
    );
  });
});

// `Arbitrary.schema(DateValue)` generates days no month has (kernel defect inherited from `@beep/schema/LocalDate`,
// recorded in test/Value.test.ts). Such a date encodes to a string the decoder refuses, so the round-trip law is
// stated on the days every month has.
const realDateKeys = Arbitrary.filter(Arbitrary.schema(DateKeyValue), (key) => key.value.day <= 28);
const realTypedKeys = Arbitrary.filter(
  Arbitrary.schema(TypedPrimaryKeyValue),
  (key) => !(TypedPrimaryKeyValue.guards.dateValue(key) && key.value.day > 28)
);

describe("TypedPrimaryKeyValue", () => {
  generates("DateKeyValue", DateKeyValue);
  roundTrips("DateKeyValue (days every month has)", DateKeyValue, realDateKeys);
  generates("StringKeyValue", StringKeyValue);
  roundTrips("StringKeyValue", StringKeyValue, Arbitrary.schema(StringKeyValue));
  generates("TimestampKeyValue", TimestampKeyValue);
  roundTrips("TimestampKeyValue", TimestampKeyValue, Arbitrary.schema(TimestampKeyValue));
  generates("BooleanKeyValue", BooleanKeyValue);
  roundTrips("BooleanKeyValue", BooleanKeyValue, Arbitrary.schema(BooleanKeyValue));
  generates("IntegerKeyValue", IntegerKeyValue);
  roundTrips("IntegerKeyValue", IntegerKeyValue, Arbitrary.schema(IntegerKeyValue));
  generates("DoubleKeyValue", DoubleKeyValue);
  roundTrips("DoubleKeyValue", DoubleKeyValue, Arbitrary.schema(DoubleKeyValue));
  generates("LongKeyValue", LongKeyValue);
  roundTrips("LongKeyValue", LongKeyValue, Arbitrary.schema(LongKeyValue));
  generates("TypedPrimaryKeyValue", TypedPrimaryKeyValue);
  roundTrips("TypedPrimaryKeyValue (days every month has)", TypedPrimaryKeyValue, realTypedKeys);

  // The tag adds the type; what travels under it is the wire scalar a locator holds for the same key.
  it.effect.prop(
    "travels with a value that is a primary key value",
    [realTypedKeys],
    Effect.fnUntraced(function* ([key]) {
      const wire = yield* S.encodeEffect(TypedPrimaryKeyValue)(key);
      assertTrue(S.is(PrimaryKeyValue)(wire.value));
    }),
    { arbitrary: fcRuns(50) }
  );

  it("has the wire's seven tags, in the wire's order", () => {
    deepStrictEqual(R.keys(TypedPrimaryKeyValue.cases), [
      "dateValue",
      "stringValue",
      "timestampValue",
      "booleanValue",
      "integerValue",
      "doubleValue",
      "longValue",
    ]);
    const facts: readonly [
      Equals<
        typeof TypedPrimaryKeyValue.Encoded,
        | { readonly type: "dateValue"; readonly value: string }
        | { readonly type: "stringValue"; readonly value: string }
        | { readonly type: "timestampValue"; readonly value: string }
        | { readonly type: "booleanValue"; readonly value: boolean | "true" | "false" }
        | { readonly type: "integerValue"; readonly value: number | string }
        | { readonly type: "doubleValue"; readonly value: number | string }
        // A long travels as a string; decoding is also lenient towards a JSON integer.
        | { readonly type: "longValue"; readonly value: string | number }
      >,
      Equals<LongKeyValue["value"], bigint>,
      Equals<DateKeyValue["value"], LocalDate>,
      Equals<TimestampKeyValue["value"], DateTime.Utc>,
    ] = [true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes the seven wire members to their rich values and encodes them back unchanged",
    Effect.fnUntraced(function* () {
      const wire = [
        { type: "dateValue", value: "2021-05-01" },
        { type: "stringValue", value: "EMP1234" },
        { type: "timestampValue", value: "2021-01-04T05:00:00.000Z" },
        { type: "booleanValue", value: true },
        { type: "integerValue", value: 238940 },
        { type: "doubleValue", value: 3.14159265 },
        { type: "longValue", value: "58319870951433" },
      ];
      const keys = yield* S.decodeUnknownEffect(S.Array(TypedPrimaryKeyValue))(wire);
      const expected = [
        TypedPrimaryKeyValue.cases.dateValue.make({ value: LocalDate.make({ year: 2021, month: 5, day: 1 }) }),
        TypedPrimaryKeyValue.cases.stringValue.make({ value: "EMP1234" }),
        TypedPrimaryKeyValue.cases.timestampValue.make({ value: DateTime.makeUnsafe("2021-01-04T05:00:00.000Z") }),
        TypedPrimaryKeyValue.cases.booleanValue.make({ value: true }),
        TypedPrimaryKeyValue.cases.integerValue.make({ value: 238940 }),
        TypedPrimaryKeyValue.cases.doubleValue.make({ value: 3.14159265 }),
        TypedPrimaryKeyValue.cases.longValue.make({ value: BigInt("58319870951433") }),
      ];
      assertTrue(S.toEquivalence(S.Array(TypedPrimaryKeyValue))(keys, expected));
      const encoded = yield* S.encodeEffect(S.Array(TypedPrimaryKeyValue))(keys);
      deepStrictEqual<unknown>(encoded, wire);
    })
  );

  it.effect(
    "reads a long key written as a JSON integer and writes it back as the documented string",
    Effect.fnUntraced(function* () {
      const key = yield* S.decodeEffect(TypedPrimaryKeyValue)({ type: "longValue", value: 58319870951433 });
      assertTrue(
        S.toEquivalence(TypedPrimaryKeyValue)(
          key,
          TypedPrimaryKeyValue.cases.longValue.make({ value: BigInt("58319870951433") })
        )
      );
      const encoded = yield* S.encodeEffect(TypedPrimaryKeyValue)(key);
      deepStrictEqual<unknown>(encoded, { type: "longValue", value: "58319870951433" });
      const fraction = yield* failureOf(S.decodeEffect(TypedPrimaryKeyValue)({ type: "longValue", value: 1.5 }));
      assertFalse(Str.isEmpty(fraction));
    })
  );

  it("matches every case exhaustively and guards each one", () => {
    const describeKey = TypedPrimaryKeyValue.match({
      dateValue: ({ value }) => `date ${value.toISOString()}`,
      stringValue: ({ value }) => `text ${value}`,
      timestampValue: ({ value }) => `instant ${DateTime.formatIso(value)}`,
      booleanValue: ({ value }) => `flag ${value}`,
      integerValue: ({ value }) => `int ${value}`,
      doubleValue: ({ value }) => `number ${value}`,
      longValue: ({ value }) => `long ${value}`,
    });
    const keys = [
      TypedPrimaryKeyValue.cases.dateValue.make({ value: LocalDate.make({ year: 2021, month: 5, day: 1 }) }),
      TypedPrimaryKeyValue.cases.stringValue.make({ value: "EMP1234" }),
      TypedPrimaryKeyValue.cases.timestampValue.make({ value: DateTime.makeUnsafe(0) }),
      TypedPrimaryKeyValue.cases.booleanValue.make({ value: false }),
      TypedPrimaryKeyValue.cases.integerValue.make({ value: 7 }),
      TypedPrimaryKeyValue.cases.doubleValue.make({ value: 0.5 }),
      TypedPrimaryKeyValue.cases.longValue.make({ value: BigInt(9) }),
    ];
    deepStrictEqual(A.map(keys, describeKey), [
      "date 2021-05-01",
      "text EMP1234",
      "instant 1970-01-01T00:00:00.000Z",
      "flag false",
      "int 7",
      "number 0.5",
      "long 9",
    ]);
    const guards = [
      TypedPrimaryKeyValue.guards.dateValue,
      TypedPrimaryKeyValue.guards.stringValue,
      TypedPrimaryKeyValue.guards.timestampValue,
      TypedPrimaryKeyValue.guards.booleanValue,
      TypedPrimaryKeyValue.guards.integerValue,
      TypedPrimaryKeyValue.guards.doubleValue,
      TypedPrimaryKeyValue.guards.longValue,
    ];
    // Each guard accepts its own case and no other.
    deepStrictEqual(
      A.map(guards, (guard) => A.filter(keys, guard).length),
      [1, 1, 1, 1, 1, 1, 1]
    );
    assertTrue(A.every(A.zip(guards, keys), ([guard, key]) => guard(key)));
    const isNumeric = TypedPrimaryKeyValue.isAnyOf(["integerValue", "doubleValue", "longValue"]);
    deepStrictEqual(A.map(keys, isNumeric), [false, false, false, false, true, true, true]);
  });

  it.effect(
    "rejects an unknown tag, an integer beyond 32 bits, a long that is not a number and an impossible date",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(TypedPrimaryKeyValue);
      const messages = yield* Effect.all(
        A.map(
          [
            { type: "decimalValue", value: "2.5" },
            { type: "integerValue", value: 2147483648 },
            { type: "longValue", value: "fifty" },
            { type: "longValue", value: "9223372036854775808" },
            { type: "dateValue", value: "2021-02-30" },
            { type: "timestampValue", value: "yesterday" },
            { type: "stringValue" },
          ],
          (input) => failureOf(decode(input))
        )
      );
      strictEqual(messages.length, 7);
    })
  );
});

// ---------------------------------------------------------------------------
// Which object
// ---------------------------------------------------------------------------

describe("ObjectLocator", () => {
  generates("ObjectLocator", ObjectLocator);
  // An identity has to survive the wire: the strict law, for every locator.
  roundTrips("ObjectLocator", ObjectLocator, Arbitrary.schema(ObjectLocator));

  it.effect(
    "decodes the record action edits use and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire = { objectType: "Employee", primaryKey: 50030 };
      const locator = yield* S.decodeEffect(ObjectLocator)(wire);
      deepStrictEqual(locator, ObjectLocator.make({ objectType: employeeType, primaryKey: 50030 }));
      const encoded = yield* S.encodeEffect(ObjectLocator)(locator);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "rejects an empty object type and a key that is not a scalar",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(ObjectLocator);
      const emptyType = yield* failureOf(decode({ objectType: "", primaryKey: 1 }));
      assertInclude(emptyType, '["objectType"]');
      const compositeKey = yield* failureOf(decode({ objectType: "Employee", primaryKey: { employeeId: 1 } }));
      assertInclude(compositeKey, '["primaryKey"]');
      const noKey = yield* failureOf(decode({ objectType: "Employee" }));
      assertInclude(noKey, '["primaryKey"]');
    })
  );
});

describe("ObjectSpecifier", () => {
  generates("ObjectSpecifier", ObjectSpecifier);

  it("is a string on the wire and a locator in the domain", () => {
    const facts: readonly [Equals<ObjectSpecifier, ObjectLocator>, Equals<typeof ObjectSpecifier.Encoded, string>] = [
      true,
      true,
    ];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes the specifier of a stub employee and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const locator = yield* S.decodeEffect(ObjectSpecifier)("Employee:50030");
      // A string carries no JSON type: the key is text.
      deepStrictEqual(locator, ObjectLocator.make({ objectType: employeeType, primaryKey: "50030" }));
      const encoded = yield* S.encodeEffect(ObjectSpecifier)(locator);
      strictEqual(encoded, "Employee:50030");
    })
  );

  it.effect(
    "splits at the first colon, so a key that contains colons survives",
    Effect.fnUntraced(function* () {
      const text = "ObjectWithTimestampPrimaryKey:2019-01-01T01:01:01.000Z";
      const locator = yield* S.decodeEffect(ObjectSpecifier)(text);
      strictEqual(locator.objectType, "ObjectWithTimestampPrimaryKey");
      strictEqual(locator.primaryKey, "2019-01-01T01:01:01.000Z");
      const encoded = yield* S.encodeEffect(ObjectSpecifier)(locator);
      strictEqual(encoded, text);
      const emptyKey = yield* S.decodeEffect(ObjectSpecifier)("Employee:");
      strictEqual(emptyKey.primaryKey, "");
    })
  );

  it.effect(
    "writes every kind of key in its canonical text",
    Effect.fnUntraced(function* () {
      const encode = S.encodeEffect(ObjectSpecifier);
      const long = yield* S.encodeEffect(LongValue)(BigInt("58319870951433"));
      const date = yield* S.encodeEffect(DateValue)(LocalDate.make({ year: 2021, month: 5, day: 1 }));
      const instant = yield* S.encodeEffect(TimestampValue)(DateTime.makeUnsafe("2021-01-04T05:00:00.000Z"));
      const keys: ReadonlyArray<PrimaryKeyValue> = [50030, "NYC", true, long, date, instant];
      const specifiers = yield* Effect.all(
        A.map(keys, (primaryKey) => encode(ObjectLocator.make({ objectType: employeeType, primaryKey })))
      );
      deepStrictEqual(specifiers, [
        "Employee:50030",
        "Employee:NYC",
        "Employee:true",
        "Employee:58319870951433",
        "Employee:2021-05-01",
        "Employee:2021-01-04T05:00:00.000Z",
      ]);
    })
  );

  it.effect.prop(
    "decodes any `<objectType>:<key>` text to exactly those parts and encodes it back",
    [Arbitrary.schema(ObjectTypeApiName), Arbitrary.schema(S.String)],
    Effect.fnUntraced(function* ([objectType, key]) {
      // An object type name never contains a colon; one that does is the encode counter-example below.
      if (Str.includes(":")(objectType)) {
        return;
      }
      const text = `${objectType}:${key}`;
      const locator = yield* S.decodeEffect(ObjectSpecifier)(text);
      strictEqual(locator.objectType, objectType);
      strictEqual(locator.primaryKey, key);
      const encoded = yield* S.encodeEffect(ObjectSpecifier)(locator);
      strictEqual(encoded, text);
    }),
    { arbitrary: fcRuns(100) }
  );

  // The one codec of this module that keeps the weaker law, and why: its wire form is a single string, which spells
  // a number key and a boolean key as text and cannot say which it was (`50030` and `"50030"` both write
  // `"Employee:50030"`). Decoding therefore yields a text key, and the round trip is exact for the locators whose
  // key is text. For every other locator the law is that the text is a fixed point.
  it.effect.prop(
    "encode, decode, encode yields the first text again, or refuses a name that could not be split back",
    [Arbitrary.schema(ObjectSpecifier)],
    Effect.fnUntraced(function* ([locator]) {
      if (Str.includes(":")(locator.objectType)) {
        const message = yield* failureOf(S.encodeEffect(ObjectSpecifier)(locator));
        assertInclude(message, "contains a colon");
        return;
      }
      const text = yield* S.encodeEffect(ObjectSpecifier)(locator);
      const decoded = yield* S.decodeEffect(ObjectSpecifier)(text);
      const again = yield* S.encodeEffect(ObjectSpecifier)(decoded);
      strictEqual(again, text);
      // The round trip is exact when the key is text.
      assertTrue(!P.isString(locator.primaryKey) || S.toEquivalence(ObjectSpecifier)(decoded, locator));
    }),
    { arbitrary: fcRuns(100) }
  );

  it.effect(
    "rejects text without a colon and text without an object type",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(ObjectSpecifier);
      const noColon = yield* failureOf(decode("Employee"));
      assertInclude(noColon, '"<objectType>:<primaryKey>"');
      const noType = yield* failureOf(decode(":50030"));
      assertInclude(noType, '["objectType"]');
      const notText = yield* failureOf(decode(50030));
      assertInclude(notText, "Expected string");
    })
  );
});

describe("InterfaceObjectLocator", () => {
  generates("InterfaceObjectLocator", InterfaceObjectLocator);
  roundTrips("InterfaceObjectLocator", InterfaceObjectLocator, Arbitrary.schema(InterfaceObjectLocator));

  it("renames the two keys and nothing else", () => {
    const facts: readonly [
      Equals<InterfaceObjectLocator, ObjectLocator>,
      Equals<
        typeof InterfaceObjectLocator.Encoded,
        { readonly objectTypeApiName: string; readonly primaryKeyValue: string | number | boolean }
      >,
    ] = [true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes the wire's documented interface object reference and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      // The example of the wire's "Ontology Interface Object Reference" row.
      const wire = { objectTypeApiName: "Employee", primaryKeyValue: "EMP1234" };
      const locator = yield* S.decodeEffect(InterfaceObjectLocator)(wire);
      deepStrictEqual(locator, ObjectLocator.make({ objectType: employeeType, primaryKey: "EMP1234" }));
      const encoded = yield* S.encodeEffect(InterfaceObjectLocator)(locator);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "rejects the locator's own key names",
    Effect.fnUntraced(function* () {
      const message = yield* failureOf(
        S.decodeUnknownEffect(InterfaceObjectLocator)({ objectType: "Employee", primaryKey: "EMP1234" })
      );
      assertInclude(message, "Missing key");
    })
  );
});

// ---------------------------------------------------------------------------
// The flat wire record
// ---------------------------------------------------------------------------

describe("ObjectRecord", () => {
  generates("ObjectRecord", ObjectRecord);
  // The strict law, and more: a row is its own wire form, so encoding and decoding change nothing.
  roundTrips("ObjectRecord", ObjectRecord, Arbitrary.schema(ObjectRecord));

  it("is the record as it travels on both sides, and the encoded side of every codec of an object", () => {
    const facts: readonly [
      Equals<ObjectRecord, typeof ObjectRecord.Encoded>,
      Equals<typeof OntologyObject.Encoded, ObjectRecord>,
      Equals<ReturnType<typeof instanceCodec>["Encoded"], ObjectRecord>,
      Equals<ObjectRecord["__apiName"], string>,
      Equals<ObjectRecord["__primaryKey"], PrimaryKeyValue>,
    ] = [true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "passes each stub object through untouched, in both directions",
    Effect.fnUntraced(function* () {
      const rows = yield* Effect.forEach([employee1, nycOffice, travisPlayer], (stub) =>
        S.decodeEffect(ObjectRecord)(stub)
      );
      deepStrictEqual<unknown>(rows, [employee1, nycOffice, travisPlayer]);
      const written = yield* Effect.forEach(rows, (row) => S.encodeEffect(ObjectRecord)(row));
      deepStrictEqual<unknown>(written, [employee1, nycOffice, travisPlayer]);
      // A null in place of an optional reserved key is part of the record, and stays.
      const sparse = yield* S.decodeEffect(ObjectRecord)({ __apiName: "Office", __primaryKey: "SEA", __rid: null });
      deepStrictEqual<unknown>(sparse, { __apiName: "Office", __primaryKey: "SEA", __rid: null });
    })
  );

  it("rejects a record that lacks an identity key, mistypes a reserved key or holds a value that is not JSON", () => {
    const isRow = S.is(ObjectRecord);
    deepStrictEqual(
      [
        isRow({ __apiName: "Office", __primaryKey: "NYC" }),
        isRow({ __primaryKey: "NYC", officeId: "NYC" }),
        isRow({ __apiName: "Office", officeId: "NYC" }),
        isRow({ __apiName: 7, __primaryKey: "NYC" }),
        isRow({ __apiName: "Office", __primaryKey: null }),
        isRow({ __apiName: "Office", __primaryKey: "NYC", __title: 7 }),
        isRow({ __apiName: "Office", __primaryKey: "NYC", __score: "high" }),
        isRow({ __apiName: "Office", __primaryKey: "NYC", opened: BigInt(1) }),
        // The record does not brand its names: an empty object type name is a row, and no codec above it reads it.
        isRow({ __apiName: "", __primaryKey: "NYC" }),
        isRow([]),
      ],
      [true, false, false, false, false, false, false, false, true, false]
    );
    assertFalse(S.is(OntologyObject)({ __apiName: "", __primaryKey: "NYC" }));
  });
});

// ---------------------------------------------------------------------------
// Objects without an ontology
// ---------------------------------------------------------------------------

describe("OntologyObject", () => {
  generates("OntologyObject", OntologyObject);
  roundTrips("OntologyObject", OntologyObject, Arbitrary.schema(OntologyObject));

  it.effect(
    "decodes the stub employee into identity and properties, and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const object = yield* S.decodeEffect(OntologyObject)(employee1);
      deepStrictEqual(object.locator, ObjectLocator.make({ objectType: employeeType, primaryKey: 50030 }));
      assertSome(object.rid, ObjectRid.make("ri.phonograph2-objects.main.object.88a6fccb-f333-46d6-a07e-7725c5f18b61"));
      assertNone(object.title);
      assertNone(object.score);
      deepStrictEqual<unknown>(object.properties, {
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
      });
      const wire = yield* S.encodeEffect(OntologyObject)(object);
      deepStrictEqual<unknown>(wire, employee1);
    })
  );

  it.effect(
    "decodes the stub office with its geometry as JSON, and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const object = yield* S.decodeEffect(OntologyObject)(nycOffice);
      deepStrictEqual(
        object.locator,
        ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "NYC" })
      );
      assertSome(object.rid, ObjectRid.make("ri.phonograph2-objects.main.object.c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0"));
      assertSome(object.title, "New York City");
      assertNone(object.score);
      deepStrictEqual<unknown>(object.properties, {
        officeId: "NYC",
        name: "New York City",
        entrance: { type: "Point", coordinates: [1.1, 1.1] },
        occupiedArea: {
          type: "Polygon",
          coordinates: [
            [
              [1, 1],
              [1, 2],
              [2, 2],
              [2, 1],
              [1, 1],
            ],
          ],
        },
      });
      const wire = yield* S.encodeEffect(OntologyObject)(object);
      deepStrictEqual<unknown>(wire, nycOffice);
    })
  );

  it.effect(
    "decodes the stub player with its struct as JSON, and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const object = yield* S.decodeEffect(OntologyObject)(travisPlayer);
      deepStrictEqual(
        object.locator,
        ObjectLocator.make({ objectType: ObjectTypeApiName.make("BgaoNflPlayer"), primaryKey: "tkelce" })
      );
      assertSome(object.title, "tkelce");
      deepStrictEqual(R.keys(object.properties), ["gamesPlayed", "name", "number", "wikiUrl", "address", "id"]);
      deepStrictEqual<unknown>(R.get(object.properties, PropertyApiName.make("address")), O.some(travisPlayer.address));
      const wire = yield* S.encodeEffect(OntologyObject)(object);
      deepStrictEqual<unknown>(wire, travisPlayer);
    })
  );

  it.effect(
    "decodes the bare object a link response sends: identity and no properties",
    Effect.fnUntraced(function* () {
      const wire = { __apiName: "Office", __primaryKey: "NYC" };
      const object = yield* S.decodeEffect(OntologyObject)(wire);
      deepStrictEqual(
        object.locator,
        ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "NYC" })
      );
      assertTrue(R.isEmptyReadonlyRecord(object.properties));
      const encoded = yield* S.encodeEffect(OntologyObject)(object);
      deepStrictEqual<unknown>(encoded, wire);
    })
  );

  it.effect(
    "reads the relevance score and treats an absent or null reserved key as none",
    Effect.fnUntraced(function* () {
      const scored = yield* S.decodeEffect(OntologyObject)({
        __apiName: "Employee",
        __primaryKey: 50031,
        __score: 0.75,
        __title: null,
        __rid: null,
      });
      assertSome(scored.score, 0.75);
      assertNone(scored.title);
      assertNone(scored.rid);
      deepStrictEqual<unknown>(scored.properties, {});
      // None is written by omitting the key, never as null.
      const wire = yield* S.encodeEffect(OntologyObject)(scored);
      deepStrictEqual<unknown>(wire, { __apiName: "Employee", __primaryKey: 50031, __score: 0.75 });
    })
  );

  it.effect(
    "constructs with only a locator and properties, and writes the key its codec spelled",
    Effect.fnUntraced(function* () {
      const properties = yield* S.decodeEffect(S.Record(PropertyApiName, S.Json))({ value: "first" });
      const primaryKey = yield* S.encodeEffect(TimestampValue)(DateTime.makeUnsafe("2019-01-01T01:01:01.000Z"));
      const object = OntologyObject.make({
        locator: ObjectLocator.make({
          objectType: ObjectTypeApiName.make("ObjectWithTimestampPrimaryKey"),
          primaryKey,
        }),
        properties,
      });
      assertNone(object.rid);
      assertNone(object.title);
      assertNone(object.score);
      const wire = yield* S.encodeEffect(OntologyObject)(object);
      deepStrictEqual<unknown>(wire, {
        __apiName: "ObjectWithTimestampPrimaryKey",
        __primaryKey: "2019-01-01T01:01:01.000Z",
        value: "first",
      });
    })
  );

  it.effect(
    "rejects a record without identity, with a composite key or with a malformed reserved key",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(OntologyObject);
      const noApiName = yield* failureOf(decode({ __primaryKey: 50030, fullName: "John Doe" }));
      assertInclude(noApiName, '["__apiName"]');
      const noKey = yield* failureOf(decode({ __apiName: "Employee", fullName: "John Doe" }));
      assertInclude(noKey, '["__primaryKey"]');
      const compositeKey = yield* failureOf(decode({ __apiName: "Employee", __primaryKey: { employeeId: 50030 } }));
      assertInclude(compositeKey, '["__primaryKey"]');
      const emptyApiName = yield* failureOf(decode({ __apiName: "", __primaryKey: 50030 }));
      assertInclude(emptyApiName, '["objectType"]');
      const numericTitle = yield* failureOf(decode({ __apiName: "Employee", __primaryKey: 50030, __title: 50030 }));
      assertInclude(numericTitle, '["__title"]');
      const emptyRid = yield* failureOf(decode({ __apiName: "Employee", __primaryKey: 50030, __rid: "" }));
      assertInclude(emptyRid, '["rid"]');
      const textScore = yield* failureOf(decode({ __apiName: "Employee", __primaryKey: 50030, __score: "high" }));
      assertInclude(textScore, '["__score"]');
      const notARecord = yield* failureOf(decode(["Employee", 50030]));
      assertFalse(Str.isEmpty(notARecord));
    })
  );

  it.effect(
    "refuses to encode a property named like a reserved key",
    Effect.fnUntraced(function* () {
      const properties = yield* S.decodeEffect(S.Record(PropertyApiName, S.Json))({
        fullName: "John Doe",
        __title: "Shadow",
        __score: 1,
      });
      const object = OntologyObject.make({
        locator: ObjectLocator.make({ objectType: employeeType, primaryKey: 50030 }),
        properties,
      });
      const message = yield* failureOf(S.encodeEffect(OntologyObject)(object));
      assertInclude(message, "Property names collide with reserved object keys: __title, __score");
    })
  );
});

// ---------------------------------------------------------------------------
// Typed instances
// ---------------------------------------------------------------------------

describe("instanceCodec", () => {
  it("returns a codec from the flat wire record to a locator, system fields and two property records", () => {
    type Instance = ReturnType<typeof instanceCodec>;
    const facts: readonly [
      Equals<Instance["Encoded"], ObjectRecord>,
      Equals<Instance["Type"]["locator"], ObjectLocator>,
      Equals<Instance["Type"]["rid"], O.Option<ObjectRid>>,
      Equals<Instance["Type"]["title"], O.Option<string>>,
      Equals<Instance["Type"]["score"], O.Option<number>>,
      Equals<Instance["Type"]["undeclared"], { readonly [x: PropertyApiName]: S.Json }>,
    ] = [true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  // A geotime series reference property holds a bare series id on the wire, so the stub's placeholder string is a
  // well-formed reference by id and the stub decodes exactly as transcribed.
  it.effect(
    "decodes the stub employee as transcribed: its geotime series value is a reference by series id",
    Effect.fnUntraced(function* () {
      const Employee = yield* EmployeeInstance;
      const employee = yield* S.decodeEffect(Employee)(employee1);
      deepStrictEqual<unknown>(
        R.get(employee.properties, PropertyApiName.make("employeeLocation")),
        O.some(O.some({ type: "series", geotimeSeriesId: "GeotimeSeriesReferencePlaceholder" }))
      );
      deepStrictEqual<unknown>(employee.undeclared, {});
      const encoded = yield* S.encodeEffect(Employee)(employee);
      deepStrictEqual<unknown>(encoded, employee1);
      // What is still refused is a value that is none of the three wire shapes of the reference.
      const empty = yield* failureOf(S.decodeEffect(Employee)({ ...employee1, employeeLocation: "" }));
      assertInclude(empty, '["properties"]["employeeLocation"]');
      const number = yield* failureOf(S.decodeEffect(Employee)({ ...employee1, employeeLocation: 7 }));
      assertInclude(number, '["properties"]["employeeLocation"]');
    })
  );

  it.effect(
    "decodes the stub employee to typed values and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const Employee = yield* EmployeeInstance;
      // The stub without its geotime series reference: the property is then absent.
      const wire = Struct.omit(employee1, ["employeeLocation"]);
      const employee = yield* S.decodeEffect(Employee)(wire);
      deepStrictEqual(employee.locator, ObjectLocator.make({ objectType: employeeType, primaryKey: 50030 }));
      assertSome(
        employee.rid,
        ObjectRid.make("ri.phonograph2-objects.main.object.88a6fccb-f333-46d6-a07e-7725c5f18b61")
      );
      assertNone(employee.title);
      assertNone(employee.score);
      deepStrictEqual<unknown>(employee.properties, {
        // The key property is required and bare; every other property is an Option.
        employeeId: 50030,
        fullName: O.some("John Doe"),
        office: O.some("NYC"),
        class: O.some("Red"),
        startDate: O.some(LocalDate.make({ year: 2019, month: 1, day: 1 })),
        employeeStatus: O.some({ type: "series", seriesId: "TimeSeries<String>" }),
        employeeSensor: O.some({ type: "series", seriesId: "TimeSeries<>" }),
        employeeLocation: O.none(),
        skillSet: O.none(),
        skillSetEmbedding: O.none(),
        favoriteRestaurants: O.none(),
        employeeProfile: O.some({
          bio: O.some("Senior engineer with expertise in distributed systems"),
          yearsExperience: O.some(10),
        }),
        performanceScores: O.some([95.5, 88.2, 92.1]),
        bonusHistory: O.none(),
      });
      deepStrictEqual<unknown>(employee.undeclared, {});
      const encoded = yield* S.encodeEffect(Employee)(employee);
      deepStrictEqual<unknown>(encoded, wire);
    })
  );

  it.effect(
    "decodes the stub office to typed geometry and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const Office = yield* OfficeInstance;
      const office = yield* S.decodeEffect(Office)(nycOffice);
      deepStrictEqual(
        office.locator,
        ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "NYC" })
      );
      assertSome(office.title, "New York City");
      deepStrictEqual<unknown>(office.properties, {
        officeId: "NYC",
        name: O.some("New York City"),
        entrance: O.some({ type: "Point", coordinates: [1.1, 1.1], bbox: O.none() }),
        occupiedArea: O.some({
          type: "Polygon",
          coordinates: [
            [
              [1, 1],
              [1, 2],
              [2, 2],
              [2, 1],
              [1, 1],
            ],
          ],
          bbox: O.none(),
        }),
        capacity: O.none(),
      });
      deepStrictEqual<unknown>(office.undeclared, {});
      const encoded = yield* S.encodeEffect(Office)(office);
      deepStrictEqual<unknown>(encoded, nycOffice);
    })
  );

  it.effect(
    "decodes the stub player to a typed struct and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const Player = yield* PlayerInstance;
      const player = yield* S.decodeEffect(Player)(travisPlayer);
      deepStrictEqual(
        player.locator,
        ObjectLocator.make({ objectType: ObjectTypeApiName.make("BgaoNflPlayer"), primaryKey: "tkelce" })
      );
      deepStrictEqual<unknown>(player.properties, {
        id: "tkelce",
        gamesPlayed: O.some(171),
        name: O.some("Travis Kelce"),
        number: O.some(87),
        wikiUrl: O.some("myKelce.com"),
        address: O.some({
          addressLine1: O.some("15 Muppets Lane"),
          addressLine2: O.some("Resort No 4"),
          city: O.some("Memphis"),
          state: O.some("TN"),
          zipCode: O.some(11100),
        }),
        addressArray: O.none(),
      });
      const encoded = yield* S.encodeEffect(Player)(player);
      deepStrictEqual<unknown>(encoded, travisPlayer);
    })
  );

  it.effect(
    "decodes, encodes and decodes each stub to an equivalent typed instance",
    Effect.fnUntraced(function* () {
      const Employee = yield* EmployeeInstance;
      const Office = yield* OfficeInstance;
      const Player = yield* PlayerInstance;
      const verdicts = yield* Effect.all([
        reDecodes(Employee, Struct.omit(employee1, ["employeeLocation"])),
        reDecodes(Office, nycOffice),
        reDecodes(Player, travisPlayer),
        reDecodes(OntologyObject, employee1),
        reDecodes(OntologyObject, nycOffice),
        reDecodes(OntologyObject, travisPlayer),
      ]);
      deepStrictEqual(verdicts, [true, true, true, true, true, true]);
    })
  );

  it.effect(
    "decodes a timestamp key to an instant in the key property, and keeps the wire scalar in the locator",
    Effect.fnUntraced(function* () {
      const Keyed = yield* TimestampKeyedInstance;
      // Not a stub object: osdk-ts declares this object type and no instance of it.
      const wire = {
        __apiName: "ObjectWithTimestampPrimaryKey",
        __primaryKey: "2019-01-01T01:01:01.000Z",
        __title: "first",
        timestamp: "2019-01-01T01:01:01.000Z",
        value: "first",
      };
      const instant = DateTime.makeUnsafe("2019-01-01T01:01:01.000Z");
      const keyed = yield* S.decodeEffect(Keyed)(wire);
      // The locator is the ordinary one: the key as the wire carries it, ready for anything that takes a locator.
      deepStrictEqual(
        keyed.locator,
        ObjectLocator.make({
          objectType: ObjectTypeApiName.make("ObjectWithTimestampPrimaryKey"),
          primaryKey: "2019-01-01T01:01:01.000Z",
        })
      );
      // The rich key is the key property, and the operand codec of its type reads the locator's key as the same value.
      deepStrictEqual<unknown>(keyed.properties, { timestamp: instant, value: O.some("first") });
      const located = yield* S.decodeEffect(operandCodec(TimestampType.make({})))(keyed.locator.primaryKey);
      deepStrictEqual<unknown>(located, instant);
      const encoded = yield* S.encodeEffect(Keyed)(keyed);
      deepStrictEqual<unknown>(encoded, wire);
      // The locator has one text, and its key keeps its colons through the string form.
      const specifier = yield* S.encodeEffect(ObjectSpecifier)(keyed.locator);
      strictEqual(specifier, "ObjectWithTimestampPrimaryKey:2019-01-01T01:01:01.000Z");
      // The generic codec, with no ontology, holds the same locator.
      const generic = yield* S.decodeEffect(OntologyObject)(wire);
      deepStrictEqual(generic.locator, keyed.locator);
    })
  );

  it.effect(
    "compares the locator's key with the key property in the key's own domain, not as text",
    Effect.fnUntraced(function* () {
      const Keyed = yield* TimestampKeyedInstance;
      // One instant spelled two ways: without milliseconds beside the property, with them in the property.
      const wire = {
        __apiName: "ObjectWithTimestampPrimaryKey",
        __primaryKey: "2019-01-01T01:01:01Z",
        timestamp: "2019-01-01T01:01:01.000Z",
      };
      const keyed = yield* S.decodeEffect(Keyed)(wire);
      strictEqual(keyed.locator.primaryKey, "2019-01-01T01:01:01Z");
      const encoded = yield* S.encodeEffect(Keyed)(keyed);
      deepStrictEqual<unknown>(encoded, wire);
      // Another instant is another key, and text that is no instant locates nothing.
      const decode = S.decodeEffect(Keyed);
      const otherInstant = yield* failureOf(decode({ ...wire, __primaryKey: "2019-01-01T01:01:02Z" }));
      assertInclude(otherInstant, 'Expected the primary key to equal the value of the "timestamp" property');
      const noInstant = yield* failureOf(decode({ ...wire, __primaryKey: "first" }));
      assertInclude(noInstant, 'Expected the primary key to equal the value of the "timestamp" property');
    })
  );

  it.effect(
    "keeps undeclared wire keys as JSON beside the typed properties and writes them back",
    Effect.fnUntraced(function* () {
      const Employee = yield* EmployeeInstance;
      // `employee4withDerived` of the stubs, minus its geotime placeholder: a runtime derived property rides in the
      // same flat record as the declared ones.
      const wire = {
        __rid: "ri.phonograph2-objects.main.object.b9a0b2xb0-0a2b-0b8b-9e4b-a9a9b9a0b9a0",
        __primaryKey: 50035,
        __apiName: "Employee",
        __title: "Jack Smith",
        employeeId: 50035,
        fullName: "Jack Smith",
        office: "LON",
        class: "Red",
        startDate: "2015-05-15",
        derivedPropertyName: 1,
        employeeStatus: "TimeSeries<String>",
        employeeSensor: "TimeSeries<>",
      };
      const employee = yield* S.decodeEffect(Employee)(wire);
      deepStrictEqual<unknown>(employee.undeclared, { derivedPropertyName: 1 });
      assertFalse(R.has(employee.properties, PropertyApiName.make("derivedPropertyName")));
      const encoded = yield* S.encodeEffect(Employee)(employee);
      deepStrictEqual<unknown>(encoded, wire);
    })
  );

  it.effect(
    "normalises an explicit null property to an absent one",
    Effect.fnUntraced(function* () {
      const Office = yield* OfficeInstance;
      const office = yield* S.decodeEffect(Office)({
        __apiName: "Office",
        __primaryKey: "SEA",
        officeId: "SEA",
        name: null,
      });
      deepStrictEqual<unknown>(R.get(office.properties, PropertyApiName.make("name")), O.some(O.none()));
      const encoded = yield* S.encodeEffect(Office)(office);
      deepStrictEqual<unknown>(encoded, { __apiName: "Office", __primaryKey: "SEA", officeId: "SEA" });
    })
  );

  it.effect(
    "rejects an object of another type, a missing or disagreeing key and a value of the wrong type",
    Effect.fnUntraced(function* () {
      const Employee = yield* EmployeeInstance;
      const wire = Struct.omit(employee1, ["employeeLocation"]);
      const decode = S.decodeEffect(Employee);
      const otherType = yield* failureOf(decode({ ...wire, __apiName: "Office" }));
      assertInclude(otherType, 'Expected an object of type "Employee"');
      const noKeyProperty = yield* failureOf(decode(Struct.omit(wire, ["employeeId"])));
      assertInclude(noKeyProperty, '["properties"]["employeeId"]');
      const disagreeingKey = yield* failureOf(decode({ ...wire, employeeId: 50031 }));
      assertInclude(disagreeingKey, 'Expected the primary key to equal the value of the "employeeId" property');
      // A key the key property's codec cannot read is refused where the rich key lives, and beside a good key
      // property it is a disagreement.
      const textKey = yield* failureOf(decode({ ...wire, __primaryKey: "fifty", employeeId: "fifty" }));
      assertInclude(textKey, '["properties"]["employeeId"]');
      const unreadableKey = yield* failureOf(decode({ ...wire, __primaryKey: "fifty" }));
      assertInclude(unreadableKey, 'Expected the primary key to equal the value of the "employeeId" property');
      // The legacy numeric text of an integer key is the same key.
      const legacyKey = yield* decode({ ...wire, __primaryKey: "50030" });
      strictEqual(legacyKey.locator.primaryKey, "50030");
      const badDate = yield* failureOf(decode({ ...wire, startDate: "the first of January" }));
      assertInclude(badDate, '["properties"]["startDate"]');
      const badStruct = yield* failureOf(decode({ ...wire, employeeProfile: { bio: 10 } }));
      assertInclude(badStruct, '["properties"]["employeeProfile"]["bio"]');
      const badElement = yield* failureOf(decode({ ...wire, performanceScores: [95.5, "high"] }));
      assertInclude(badElement, '["properties"]["performanceScores"][1]');
    })
  );

  it.effect(
    "refuses to encode an instance of another type, with a disagreeing key or with a shadowed property",
    Effect.fnUntraced(function* () {
      const Office = yield* OfficeInstance;
      const office = yield* S.decodeEffect(Office)(nycOffice);
      const encode = S.encodeEffect(Office);
      const otherType = yield* failureOf(
        encode({ ...office, locator: ObjectLocator.make({ objectType: employeeType, primaryKey: "NYC" }) })
      );
      assertInclude(otherType, 'Expected an object of type "Office"');
      const disagreeingKey = yield* failureOf(
        encode({
          ...office,
          locator: ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "SEA" }),
        })
      );
      assertInclude(disagreeingKey, 'Expected the primary key to equal the value of the "officeId" property');
      const shadow = yield* S.decodeEffect(S.Record(PropertyApiName, S.Json))({ name: "Shadow", floor: 3 });
      const shadowed = yield* failureOf(encode({ ...office, undeclared: shadow }));
      assertInclude(shadowed, "Undeclared keys collide with declared properties: name");
      const reserved = yield* S.decodeEffect(S.Record(PropertyApiName, S.Json))({ __title: "Shadow" });
      const colliding = yield* failureOf(encode({ ...office, undeclared: reserved }));
      assertInclude(colliding, "Property names collide with reserved object keys: __title");
    })
  );

  it.effect(
    "yields a codec that rejects every record when the key property is not declared",
    Effect.fnUntraced(function* () {
      const Unkeyed = yield* projected("Office", "officeCode", officeProperties);
      const message = yield* failureOf(S.decodeEffect(Unkeyed)(nycOffice));
      assertInclude(message, 'The primary key property "officeCode" is not declared by object type "Office"');
    })
  );

  it.effect(
    "reads the key in the domain of whatever type the key property declares",
    Effect.fnUntraced(function* () {
      // Synthetic: a decimal is not a kind of key, and it is the object type that says so (`ObjectType` refuses the
      // definition). The projection follows the signature it is given: the locator holds the wire scalar, as for
      // every key, the key property holds the decimal, and the two are compared as decimals.
      const DecimalKeyed = yield* projected("Invoice", "amount", {
        amount: { dataType: { type: "decimal" }, rid: "rid", typeClasses: [] },
      });
      const wire = { __apiName: "Invoice", __primaryKey: "12.5", amount: "12.50" };
      const invoice = yield* S.decodeEffect(DecimalKeyed)(wire);
      strictEqual(invoice.locator.primaryKey, "12.5");
      const amount = yield* Effect.fromOption(
        O.filter(R.get(invoice.properties, PropertyApiName.make("amount")), S.is(DecimalValue))
      );
      assertTrue(S.toEquivalence(DecimalValue)(amount, BigDecimal.fromStringUnsafe("12.5")));
      const encoded = yield* S.encodeEffect(DecimalKeyed)(invoice);
      deepStrictEqual<unknown>(encoded, wire);
      const message = yield* failureOf(S.decodeEffect(DecimalKeyed)({ ...wire, __primaryKey: "13" }));
      assertInclude(message, 'Expected the primary key to equal the value of the "amount" property');
    })
  );

  it.effect(
    "generates instances of each stub object type whose two keys agree, and they survive encoding and decoding",
    Effect.fnUntraced(function* () {
      const codecs = yield* Effect.all([EmployeeInstance, OfficeInstance, PlayerInstance, TimestampKeyedInstance]);
      const verdicts = yield* Effect.forEach(
        codecs,
        Effect.fnUntraced(function* (codec) {
          const sameInstance = S.toEquivalence(codec);
          const instances = yield* Arbitrary.sampleEffect(Arbitrary.schema(codec), { count: 25, seed: 17 });
          const survived = yield* Effect.forEach(
            instances,
            Effect.fnUntraced(function* (instance) {
              const wire = yield* S.encodeEffect(codec)(instance);
              const decoded = yield* S.decodeEffect(codec)(wire);
              // The same row read with no ontology names the same object.
              const generic = yield* S.decodeEffect(OntologyObject)(wire);
              return (
                S.is(codec)(instance) &&
                sameInstance(decoded, instance) &&
                S.toEquivalence(ObjectLocator)(generic.locator, instance.locator)
              );
            })
          );
          return A.length(instances) === 25 && A.every(survived, identity);
        })
      );
      deepStrictEqual(verdicts, [true, true, true, true]);
    })
  );
});

// ---------------------------------------------------------------------------
// The one instance codec
// ---------------------------------------------------------------------------

describe("InstanceOf", () => {
  // A properties codec written by hand: no property type, no spec, only a struct of codecs.
  const Office = InstanceOf({
    apiName: "Office",
    primaryKey: "officeId",
    properties: S.Struct({
      officeId: S.String,
      capacity: S.OptionFromOptionalNullOr(S.Finite),
      openedOn: S.OptionFromOptionalNullOr(DateValue),
    }),
  });

  it("types the properties by the codec it is given and everything else as every instance has it", () => {
    const facts: readonly [
      Equals<typeof Office.Encoded, ObjectRecord>,
      Equals<(typeof Office.Type)["locator"], ObjectLocator>,
      Equals<
        (typeof Office.Type)["properties"],
        { readonly officeId: string; readonly capacity: O.Option<number>; readonly openedOn: O.Option<LocalDate> }
      >,
      Equals<(typeof Office.Type)["undeclared"], { readonly [x: PropertyApiName]: S.Json }>,
      Equals<keyof typeof Office.Type, "locator" | "rid" | "title" | "score" | "properties" | "undeclared">,
      // The dynamic projection has the same six keys; its properties are a record because it is read at run time.
      Equals<keyof ReturnType<typeof instanceCodec>["Type"], keyof typeof Office.Type>,
    ] = [true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes a row with the codec it is given, keeps what that codec does not declare, and writes all of it back",
    Effect.fnUntraced(function* () {
      const wire = {
        __apiName: "Office",
        __primaryKey: "NYC",
        __title: "New York City",
        officeId: "NYC",
        capacity: 120,
        openedOn: "2019-01-01",
        entrance: { type: "Point", coordinates: [1.1, 1.1] },
      };
      const office = yield* S.decodeEffect(Office)(wire);
      deepStrictEqual(
        office.locator,
        ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "NYC" })
      );
      strictEqual(office.properties.officeId, "NYC");
      assertSome(office.properties.capacity, 120);
      assertSome(office.properties.openedOn, LocalDate.make({ year: 2019, month: 1, day: 1 }));
      deepStrictEqual<unknown>(office.undeclared, { entrance: { type: "Point", coordinates: [1.1, 1.1] } });
      const encoded = yield* S.encodeEffect(Office)(office);
      deepStrictEqual<unknown>(encoded, wire);
    })
  );

  it.effect(
    "keeps the three checks whatever the properties codec: object type, key agreement, no shadowed property",
    Effect.fnUntraced(function* () {
      const wire = { __apiName: "Office", __primaryKey: "NYC", officeId: "NYC" };
      const decode = S.decodeEffect(Office);
      const otherType = yield* failureOf(decode({ ...wire, __apiName: "Employee" }));
      assertInclude(otherType, 'Expected an object of type "Office"');
      const staleKey = yield* failureOf(decode({ ...wire, __primaryKey: "SEA" }));
      assertInclude(staleKey, 'Expected the primary key to equal the value of the "officeId" property');
      const badValue = yield* failureOf(decode({ ...wire, openedOn: "2019-02-30" }));
      assertInclude(badValue, '["properties"]["openedOn"]');
      const office = yield* decode(wire);
      const shadow = yield* S.decodeEffect(S.Record(PropertyApiName, S.Json))({ capacity: 3 });
      const shadowed = yield* failureOf(S.encodeEffect(Office)({ ...office, undeclared: shadow }));
      assertInclude(shadowed, "Undeclared keys collide with declared properties: capacity");
      // The guard is the decoded side of the same checks.
      const elsewhere = ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "SEA" });
      deepStrictEqual([S.is(Office)(office), S.is(Office)({ ...office, locator: elsewhere })], [true, false]);
    })
  );

  it.effect(
    "is what instanceCodec calls: the projected struct given by hand yields the same codec, value for value",
    Effect.fnUntraced(function* () {
      const definitions = yield* decodeDefinitions(officeProperties);
      const officeId = PropertyApiName.make("officeId");
      const ByHand = InstanceOf({
        apiName: "Office",
        primaryKey: officeId,
        properties: S.Struct(
          R.map(definitions, ({ dataType }, name) => (name === officeId ? valueCodec(dataType) : fieldCodec(dataType)))
        ),
      });
      const Projected = yield* OfficeInstance;
      const byHand = yield* S.decodeEffect(ByHand)(nycOffice);
      const projected = yield* S.decodeEffect(Projected)(nycOffice);
      deepStrictEqual(byHand, projected);
      assertTrue(S.toEquivalence(Projected)(byHand, projected));
      const written = yield* S.encodeEffect(ByHand)(projected);
      deepStrictEqual<unknown>(written, nycOffice);
    })
  );

  it.effect.prop(
    "a generated instance is located by its own key property and encodes to a row that decodes back to it",
    [Arbitrary.schema(Office)],
    Effect.fnUntraced(function* ([office]) {
      const wire = yield* S.encodeEffect(Office)(office);
      const decoded = yield* S.decodeEffect(Office)(wire);
      strictEqual(office.locator.objectType, "Office");
      strictEqual(office.locator.primaryKey, office.properties.officeId);
      strictEqual(wire.__primaryKey, office.properties.officeId);
      // A generated undeclared key never shadows a declared one, so every generated instance can be written.
      assertFalse(A.some(R.keys(office.undeclared), (name) => A.contains(["officeId", "capacity", "openedOn"], name)));
      assertTrue(S.toEquivalence(Office)(decoded, office));
    }),
    { arbitrary: fcRuns(50) }
  );
});
