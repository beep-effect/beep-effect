import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertInclude, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as BigDecimal from "effect/BigDecimal";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Exit from "effect/Exit";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  ActionParameterType,
  ActionType,
  argumentCodec,
  argumentsCodec,
  fieldValueCodec,
  OntologyDataType,
  OntologyDataTypeKind,
  StructParameterField,
} from "../src/Action/index.ts";
import { CipherText } from "../src/CipherText/CipherText.model.ts";
import { ActionParameterTypeKind, QueryDataTypeKind } from "../src/DataType/DataType.values.ts";
import { GeoJsonObject, GeoPoint } from "../src/Geo/Geo.model.ts";
import {
  InterfaceTypeApiName,
  ObjectSetRid,
  ObjectTypeApiName,
  ParameterId,
  StructFieldApiName,
} from "../src/Identifier/Identifier.model.ts";
import { MediaReference } from "../src/Media/Media.model.ts";
import { ObjectLocator } from "../src/Object/Object.model.ts";
import { ObjectSet } from "../src/ObjectSet/ObjectSet.model.ts";
import {
  outputCodec,
  parametersCodec,
  QueryDataType,
  QueryParameter,
  QueryStructField,
  QueryStructFieldName,
  QueryType,
  ThreeDimensionalAggregation,
  TwoDimensionalAggregation,
  TypeReferenceId,
  valueCodec,
} from "../src/Query/index.ts";
import { TimeSeriesReference } from "../src/TimeSeries/TimeSeries.model.ts";
import { DateValue } from "../src/Value/Value.model.ts";

// -----------------------------------------------------------------------------
// Law and fixture helpers
// -----------------------------------------------------------------------------

/** Laws of a projected codec whose domain values survive the wire unchanged. */
const lawful = <T, E>(name: string, codec: S.Codec<T, E>): void => {
  const arbitrary = Arbitrary.schema(codec);
  const isValid = S.is(codec);
  const isEquivalent = S.toEquivalence(codec);
  const encode = S.encodeEffect(codec);
  const decode = S.decodeEffect(codec);
  it.prop(`${name}: generated values satisfy the guard`, [arbitrary], ([value]) => isValid(value), {
    arbitrary: fcRuns(25),
  });
  it.effect.prop(
    `${name}: encoding then decoding gives an equivalent value`,
    [arbitrary],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(isEquivalent(decoded, value));
    }),
    { arbitrary: fcRuns(25) }
  );
};

/** Decodes an exact wire value to the expected domain value and encodes it back to the same wire value. */
const wireFixture = <T, E>(name: string, codec: S.Codec<T, E>, wire: unknown, expected: unknown): void =>
  it.effect(
    name,
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeUnknownEffect(codec)(wire);
      deepStrictEqual(decoded, expected);
      const encoded = yield* S.encodeUnknownEffect(codec)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

const rejects =
  <T, E>(codec: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(codec)(input)), Exit.isFailure);

const refusesToEncode =
  <T, E>(codec: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.encodeUnknownEffect(codec)(input)), Exit.isFailure);

const failureOf =
  <T, E>(codec: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<string> =>
    Effect.match(S.decodeUnknownEffect(codec)(input), {
      onFailure: (error) => error.message,
      onSuccess: () => "decoded",
    });

/** Whether two JSON arrays hold the same members, whatever their order: the wire form of a set or a map. */
const sameMembers = (actual: unknown, expected: unknown): boolean =>
  A.isArray(actual) &&
  A.isArray(expected) &&
  actual.length === expected.length &&
  A.every(expected, (member) => A.some(actual, (candidate) => Equal.equals(candidate, member)));

// -----------------------------------------------------------------------------
// One row per case of a type union: a wire value, what it decodes to, and a value it must refuse
// -----------------------------------------------------------------------------

type Row<Type> = {
  readonly type: Type;
  readonly wire: unknown;
  readonly holds: (value: unknown) => boolean;
  readonly refused: unknown;
  /** `exact`: the wire value comes back as written. `unordered`: the wire is a set, compared member by member. */
  readonly law: "exact" | "unordered";
};

const caseTable = <Type extends { readonly type: string }>(
  universe: string,
  literals: ReadonlyArray<string>,
  rows: ReadonlyArray<Row<Type>>,
  project: (type: Type) => S.Codec<unknown, unknown>
) =>
  describe(universe, () => {
    it("has one row per case of the union, in declaration order", () => {
      deepStrictEqual(
        A.map(rows, (row) => row.type.type),
        A.fromIterable(literals)
      );
    });
    A.forEach(rows, (row) => {
      const codec = project(row.type);
      const label = row.type.type;
      it.effect(
        `${label}: decodes its wire value, encodes it back and refuses a counter-example`,
        Effect.fnUntraced(function* () {
          const decoded = yield* S.decodeUnknownEffect(codec)(row.wire);
          assertTrue(row.holds(decoded), "the decoded value is not of the expected domain kind");
          const encoded = yield* S.encodeUnknownEffect(codec)(decoded);
          assertTrue(
            row.law === "unordered" ? sameMembers(encoded, row.wire) : Equal.equals(encoded, row.wire),
            "the encoded value differs from the wire fixture"
          );
          const refused = yield* rejects(codec)(row.refused);
          assertTrue(refused, "the counter-example was accepted");
        })
      );
      // Every row keeps the strict law, the rows that hold a primary key or an object set included: a key and a
      // comparison operand are the wire scalars that carry them.
      return lawful(label, codec);
    });
  });

// -----------------------------------------------------------------------------
// Shared wire values, copied from the platform's table of value encodings
// -----------------------------------------------------------------------------

const attachmentRid = "ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e";
const objectSetRid = "ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z";
const inlineObjectSet = {
  type: "filter",
  objectSet: { type: "base", objectType: "Employee" },
  where: { type: "eq", field: "office", value: "Seattle" },
};

// The value table gives an object-set argument two spellings, "a RID or an inline definition". An object set holds
// filters, whose rich comparands only keep their wire form, which is why the case rows above use the `stable` law.
const objectSetArgumentLaw = (universe: string, codec: S.Codec<unknown, unknown>): void =>
  it.effect(
    `${universe}: an object-set argument is the identifier of a stored set or an inline definition`,
    Effect.fnUntraced(function* () {
      const stored = yield* S.decodeEffect(codec)(objectSetRid);
      const inline = yield* S.decodeEffect(codec)(inlineObjectSet);
      deepStrictEqual(stored, ObjectSetRid.make(objectSetRid));
      assertTrue(S.is(ObjectSetRid)(stored) && !S.is(ObjectSet)(stored));
      assertTrue(S.is(ObjectSet)(inline) && inline.type === "filter");
      const wire = yield* Effect.forEach([stored, inline], (value) => S.encodeUnknownEffect(codec)(value));
      deepStrictEqual<unknown>(wire, [objectSetRid, inlineObjectSet]);
      const verdicts = yield* Effect.forEach(
        ["", 42, null, { type: "base" }, { type: "everything" }, { objectType: "Employee" }, [objectSetRid]],
        rejects(codec)
      );
      deepStrictEqual(verdicts, A.map(verdicts, () => true));
    })
  );
const scenarioRid = "ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48";
const cipherText =
  "CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER";
const mediaReference = {
  mimeType: "application/pdf",
  reference: {
    type: "mediaSetViewItem",
    mediaSetViewItem: {
      mediaSetRid: "ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642",
      mediaSetViewRid: "ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b",
      mediaItemRid: "ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225",
    },
  },
};
const point = { type: "Point", coordinates: [102.0, 0.5] };
const interfaceObject = { objectTypeApiName: "Employee", primaryKeyValue: "EMP1234" };

const employee = ObjectTypeApiName.make("Employee");
const isLocalDate = S.is(DateValue);
const isRecord = P.isObject;

// -----------------------------------------------------------------------------
// Action parameter types
// -----------------------------------------------------------------------------

const structFieldNamed = (name: string, fieldType: OntologyDataType, required: boolean): StructParameterField =>
  StructParameterField.make({ name: StructFieldApiName.make(name), fieldType, required });

const addressFields = [
  structFieldNamed("city", OntologyDataType.cases.string.make({}), true),
  structFieldNamed("state", OntologyDataType.cases.string.make({}), true),
  structFieldNamed("zipcode", OntologyDataType.cases.integer.make({}), false),
];

const parameterCases = ActionParameterType.cases;

const actionParameterRows: ReadonlyArray<Row<ActionParameterType>> = [
  { type: parameterCases.boolean.make({}), wire: true, holds: P.isBoolean, refused: "yes", law: "exact" },
  { type: parameterCases.integer.make({}), wire: 238940, holds: P.isNumber, refused: 2.5, law: "exact" },
  { type: parameterCases.long.make({}), wire: "58319870951433", holds: P.isBigInt, refused: "12.5", law: "exact" },
  { type: parameterCases.double.make({}), wire: 3.14159265, holds: P.isNumber, refused: "pi", law: "exact" },
  {
    type: parameterCases.decimal.make({}),
    wire: "2.718281828",
    holds: BigDecimal.isBigDecimal,
    refused: "1e3",
    law: "exact",
  },
  { type: parameterCases.string.make({}), wire: "Call me Ishmael", holds: P.isString, refused: 42, law: "exact" },
  { type: parameterCases.date.make({}), wire: "2021-05-01", holds: isLocalDate, refused: "2021-02-30", law: "exact" },
  {
    type: parameterCases.timestamp.make({}),
    wire: "2021-01-04T05:00:00.000Z",
    holds: DateTime.isDateTime,
    refused: "2021-01-04",
    law: "exact",
  },
  { type: parameterCases.marking.make({}), wire: "MU", holds: P.isString, refused: "", law: "exact" },
  { type: parameterCases.attachment.make({}), wire: attachmentRid, holds: P.isString, refused: "", law: "exact" },
  {
    type: parameterCases.mediaReference.make({}),
    wire: mediaReference,
    holds: S.is(MediaReference),
    refused: { mimeType: "application/pdf" },
    law: "exact",
  },
  {
    type: parameterCases.geoshape.make({}),
    wire: point,
    holds: S.is(GeoJsonObject),
    refused: { type: "Circle", coordinates: [102.0, 0.5] },
    law: "exact",
  },
  {
    type: parameterCases.geohash.make({}),
    wire: point,
    holds: S.is(GeoPoint),
    refused: {
      type: "LineString",
      coordinates: [
        [102.0, 0.5],
        [103.0, 1.5],
      ],
    },
    law: "exact",
  },
  {
    type: parameterCases.timeSeriesReference.make({}),
    wire: { seriesId: "sensor-123", syncRid: "ri.time-series-catalog.main.sync.cf2a8a49-8b56-446d-ab04-a6bc7fadef48" },
    holds: S.is(TimeSeriesReference),
    refused: { syncRid: "ri.time-series-catalog.main.sync.cf2a8a49-8b56-446d-ab04-a6bc7fadef48" },
    law: "exact",
  },
  {
    type: parameterCases.vector.make({ dimension: 3 }),
    wire: [0.1, 0.2, 0.3],
    holds: A.isArray,
    refused: [0.1, 0.2],
    law: "exact",
  },
  {
    type: parameterCases.array.make({ elementType: parameterCases.string.make({}) }),
    wire: ["alpha", "bravo", "charlie"],
    holds: A.isArray,
    refused: ["alpha", 1],
    law: "exact",
  },
  {
    type: parameterCases.struct.make({ fields: addressFields }),
    wire: { city: "NYC", state: "NY", zipcode: null },
    holds: isRecord,
    refused: { city: "NYC" },
    law: "exact",
  },
  {
    type: parameterCases.object.make({ objectApiName: employee, objectTypeApiName: employee }),
    wire: 10033123,
    holds: P.isNumber,
    refused: { id: 10033123 },
    law: "exact",
  },
  { type: parameterCases.objectSet.make({}), wire: objectSetRid, holds: P.isString, refused: "", law: "exact" },
  {
    type: parameterCases.interfaceObject.make({}),
    wire: interfaceObject,
    holds: S.is(ObjectLocator),
    refused: { objectTypeApiName: "Employee" },
    law: "exact",
  },
  { type: parameterCases.objectType.make({}), wire: "Employee", holds: P.isString, refused: "", law: "exact" },
  { type: parameterCases.scenarioReference.make({}), wire: scenarioRid, holds: P.isString, refused: "", law: "exact" },
];

caseTable("argumentCodec", ActionParameterTypeKind.literals, actionParameterRows, argumentCodec);

const fieldCases = OntologyDataType.cases;

const ontologyDataRows: ReadonlyArray<Row<OntologyDataType>> = [
  { type: fieldCases.boolean.make({}), wire: true, holds: P.isBoolean, refused: "yes", law: "exact" },
  { type: fieldCases.byte.make({}), wire: 31, holds: P.isNumber, refused: 128, law: "exact" },
  { type: fieldCases.short.make({}), wire: 8739, holds: P.isNumber, refused: 32_768, law: "exact" },
  { type: fieldCases.integer.make({}), wire: 238940, holds: P.isNumber, refused: 2.5, law: "exact" },
  { type: fieldCases.long.make({}), wire: "58319870951433", holds: P.isBigInt, refused: "12.5", law: "exact" },
  { type: fieldCases.float.make({}), wire: 3.5, holds: P.isNumber, refused: "pi", law: "exact" },
  { type: fieldCases.double.make({}), wire: 3.14159265, holds: P.isNumber, refused: "pi", law: "exact" },
  {
    type: fieldCases.decimal.make({}),
    wire: "2.718281828",
    holds: BigDecimal.isBigDecimal,
    refused: "1e3",
    law: "exact",
  },
  { type: fieldCases.string.make({}), wire: "Call me Ishmael", holds: P.isString, refused: 42, law: "exact" },
  { type: fieldCases.date.make({}), wire: "2021-05-01", holds: isLocalDate, refused: "2021-02-30", law: "exact" },
  {
    type: fieldCases.timestamp.make({}),
    wire: "2021-01-04T05:00:00.000Z",
    holds: DateTime.isDateTime,
    refused: "2021-01-04",
    law: "exact",
  },
  { type: fieldCases.binary.make({}), wire: "aGVsbG8=", holds: P.isUint8Array, refused: "not base64!", law: "exact" },
  { type: fieldCases.marking.make({}), wire: "MU", holds: P.isString, refused: "", law: "exact" },
  { type: fieldCases.cipherText.make({}), wire: cipherText, holds: S.is(CipherText), refused: "plain", law: "exact" },
  {
    type: fieldCases.mediaReference.make({}),
    wire: mediaReference,
    holds: S.is(MediaReference),
    refused: { mimeType: "application/pdf" },
    law: "exact",
  },
  {
    type: fieldCases.array.make({ elementType: fieldCases.string.make({}) }),
    wire: ["alpha", "bravo", "charlie"],
    holds: A.isArray,
    refused: ["alpha", 1],
    law: "exact",
  },
  {
    type: fieldCases.set.make({ elementType: fieldCases.string.make({}) }),
    wire: ["alpha", "bravo", "charlie"],
    holds: HashSet.isHashSet,
    refused: ["alpha", 1],
    law: "unordered",
  },
  {
    type: fieldCases.map.make({ keyType: fieldCases.string.make({}), valueType: fieldCases.integer.make({}) }),
    wire: { alpha: 1, bravo: 2 },
    holds: isRecord,
    refused: Number.NaN,
    law: "exact",
  },
  {
    type: fieldCases.struct.make({ fields: addressFields }),
    wire: { city: "NYC", state: "NY", zipcode: 10001 },
    holds: isRecord,
    refused: { city: "NYC" },
    law: "exact",
  },
  {
    type: fieldCases.object.make({ objectApiName: employee, objectTypeApiName: employee }),
    wire: "EMP1234",
    holds: P.isString,
    refused: { id: "EMP1234" },
    law: "exact",
  },
  { type: fieldCases.objectSet.make({}), wire: objectSetRid, holds: P.isString, refused: "", law: "exact" },
  {
    type: fieldCases.any.make({}),
    wire: { name: "John Doe", age: null },
    holds: isRecord,
    refused: Number.NaN,
    law: "exact",
  },
  {
    type: fieldCases.unsupported.make({ unsupportedType: "duration" }),
    wire: ["alpha", 1],
    holds: A.isArray,
    refused: Number.NaN,
    law: "exact",
  },
];

caseTable("fieldValueCodec", OntologyDataTypeKind.literals, ontologyDataRows, fieldValueCodec);

describe("argument values", () => {
  objectSetArgumentLaw("argumentCodec", argumentCodec(parameterCases.objectSet.make({})));
  objectSetArgumentLaw("fieldValueCodec", fieldValueCodec(fieldCases.objectSet.make({})));

  it.effect(
    "long and decimal accept a JSON number and always write the documented string",
    Effect.fnUntraced(function* () {
      const long = argumentCodec(parameterCases.long.make({}));
      const decimal = argumentCodec(parameterCases.decimal.make({}));
      const decodedLong = yield* S.decodeEffect(long)(58319870951433);
      const decodedDecimal = yield* S.decodeEffect(decimal)(2.5);
      const wire = yield* Effect.all([
        S.encodeUnknownEffect(long)(decodedLong),
        S.encodeUnknownEffect(decimal)(decodedDecimal),
      ]);
      deepStrictEqual(wire, ["58319870951433", "2.5"]);
    })
  );

  it.effect(
    "a time series reference keeps each of its three wire spellings",
    Effect.fnUntraced(function* () {
      const codec = argumentCodec(parameterCases.timeSeriesReference.make({}));
      const spellings = [
        "sensor-123",
        { seriesId: "sensor-123", syncRid: "ri.time-series-catalog.main.sync.cf2a8a49-8b56-446d-ab04-a6bc7fadef48" },
        {
          templateRid: "ri.time-series-catalog.main.template.cf2a8a49-8b56-446d-ab04-a6bc7fadef48",
          templateVersion: "1",
        },
      ];
      const decoded = yield* Effect.forEach(spellings, (spelling) => S.decodeEffect(codec)(spelling));
      const encoded = yield* Effect.forEach(decoded, (reference) => S.encodeUnknownEffect(codec)(reference));
      deepStrictEqual(encoded, spellings);
    })
  );

  it.effect(
    "an object argument is its primary key and an interface object argument a locator",
    Effect.fnUntraced(function* () {
      const object = argumentCodec(
        parameterCases.object.make({ objectApiName: employee, objectTypeApiName: employee })
      );
      const viaInterface = argumentCodec(
        parameterCases.interfaceObject.make({ interfaceTypeApiName: O.some(InterfaceTypeApiName.make("Worker")) })
      );
      const keys = yield* Effect.forEach([10033123, "EMP1234"], (key) => S.decodeEffect(object)(key));
      deepStrictEqual(keys, [10033123, "EMP1234"]);
      const locator = yield* S.decodeEffect(viaInterface)(interfaceObject);
      deepStrictEqual(locator, ObjectLocator.make({ objectType: employee, primaryKey: "EMP1234" }));
      const encoded = yield* S.encodeUnknownEffect(viaInterface)(locator);
      deepStrictEqual(encoded, interfaceObject);
    })
  );

  it.effect(
    "a vector must have exactly the declared number of components",
    Effect.fnUntraced(function* () {
      const refuses = rejects(argumentCodec(parameterCases.vector.make({ dimension: 3 })));
      const verdicts = yield* Effect.forEach([[0.1, 0.2], [0.1, 0.2, 0.3], [0.1, 0.2, 0.3, 0.4]], refuses);
      deepStrictEqual(verdicts, [true, false, true]);
    })
  );

  it.effect(
    "a struct field that is not required may be absent or null, and is written as null",
    Effect.fnUntraced(function* () {
      const codec = argumentCodec(parameterCases.struct.make({ fields: addressFields }));
      const decode = S.decodeUnknownEffect(codec);
      const absent = yield* decode({ city: "NYC", state: "NY" });
      const explicit = yield* decode({ city: "NYC", state: "NY", zipcode: null });
      const present = yield* decode({ city: "NYC", state: "NY", zipcode: 10001 });
      deepStrictEqual(absent, { city: "NYC", state: "NY", zipcode: O.none() });
      deepStrictEqual(explicit, absent);
      deepStrictEqual(present, { city: "NYC", state: "NY", zipcode: O.some(10001) });
      const encoded = yield* S.encodeUnknownEffect(codec)(absent);
      deepStrictEqual(encoded, { city: "NYC", state: "NY", zipcode: null });
      const requiredNull = yield* rejects(codec)({ city: null, state: "NY" });
      assertTrue(requiredNull);
    })
  );

  it.effect(
    "a struct with no fields is a record with no keys, and a nested struct nests",
    Effect.fnUntraced(function* () {
      const empty = argumentCodec(parameterCases.struct.make({ fields: [] }));
      const nested = argumentCodec(
        parameterCases.struct.make({
          fields: [structFieldNamed("home", fieldCases.struct.make({ fields: addressFields }), true)],
        })
      );
      const verdicts = yield* Effect.forEach([{}, { city: "NYC" }, "NYC"], rejects(empty));
      deepStrictEqual(verdicts, [false, true, true]);
      const home = yield* S.decodeEffect(nested)({ home: { city: "NYC", state: "NY" } });
      deepStrictEqual(home, { home: { city: "NYC", state: "NY", zipcode: O.none() } });
    })
  );

  it.effect(
    "a set field collapses duplicates and decodes its members by their own type",
    Effect.fnUntraced(function* () {
      const codec = fieldValueCodec(fieldCases.set.make({ elementType: fieldCases.long.make({}) }));
      const decoded = yield* S.decodeEffect(codec)(["1", "2", "1"]);
      assertTrue(Equal.equals(decoded, HashSet.make(BigInt(1), BigInt(2))));
      const encoded = yield* S.encodeUnknownEffect(codec)(decoded);
      assertTrue(sameMembers(encoded, ["1", "2"]));
    })
  );
});

// -----------------------------------------------------------------------------
// Action types, transcribed from osdk-ts packages/shared.test/src/stubs/actionTypes.ts
// -----------------------------------------------------------------------------

const promoteEmployeeObject: typeof ActionType.Encoded = {
  apiName: "promoteEmployeeObject",
  description: "Update an employee's title and compensation",
  parameters: {
    employee: {
      displayName: "Employee",
      dataType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" },
      required: true,
      typeClasses: [],
    },
    newTitle: { displayName: "New Title", dataType: { type: "string" }, required: true, typeClasses: [] },
    newCompensation: {
      displayName: "New Compensation",
      dataType: { type: "double" },
      required: true,
      typeClasses: [],
    },
  },
  rid: "ri.ontology.main.action-type.7ed72754-7491-428a-bb18-4d7296eb2168",
  operations: [{ type: "modifyObject", objectTypeApiName: "Employee" }],
  status: "ACTIVE",
};

const createStructPerson: typeof ActionType.Encoded = {
  apiName: "createStructPerson",
  description: "Create a struct",
  parameters: {
    name: { displayName: "Name", dataType: { type: "string" }, required: true, typeClasses: [] },
    address: {
      displayName: "Address",
      dataType: {
        type: "struct",
        fields: [
          { name: "city", fieldType: { type: "string" }, required: true },
          { name: "state", fieldType: { type: "string" }, required: true },
          { name: "zipcode", fieldType: { type: "integer" }, required: false },
        ],
      },
      required: false,
      typeClasses: [],
    },
  },
  rid: "ri.ontology.main.action-type.9f24017d-cf17-4fa8-84c3-8e01e5d594f2",
  operations: [],
  status: "ACTIVE",
};

const actionTakesAttachment: typeof ActionType.Encoded = {
  apiName: "actionTakesAttachment",
  description: "An action which takes an attachment",
  parameters: {
    attachment: { displayName: "Attachment", dataType: { type: "attachment" }, required: true, typeClasses: [] },
  },
  rid: "ri.ontology.main.action-type.9f84017d-cf17-4fa8-84c3-8e01e5d594f3",
  operations: [],
  status: "ACTIVE",
};

const scheduleMeeting: typeof ActionType.Encoded = {
  apiName: "scheduleMeeting",
  displayName: "Schedule meeting",
  toolDescription: "Books a meeting room for a list of invitees.",
  parameters: {
    invitees: {
      displayName: "Invitees",
      description: "Who to invite",
      dataType: { type: "array", subType: { type: "string" } },
      required: true,
      typeClasses: [{ kind: "render_hint", name: "USER_PICKER" }],
      validation: { defaultValidation: { arraySize: { gte: 1, lte: 20 } } },
    },
  },
  rid: "ri.ontology.main.action-type.schedule-meeting",
  operations: [],
  status: "EXPERIMENTAL",
};

/** Registers the tests of one action type fixture, or one failing test when the fixture no longer decodes. */
const forActionType = (wire: typeof ActionType.Encoded, body: (actionType: ActionType) => void) =>
  describe(`argumentsCodec of ${wire.apiName}`, () =>
    O.match(S.decodeOption(ActionType)(wire), {
      onNone: () => it("decodes its action type fixture", () => assertTrue(false, "the fixture did not decode")),
      onSome: body,
    })
  );

forActionType(promoteEmployeeObject, (actionType) => {
  const codec = argumentsCodec(actionType);

  wireFixture(
    "every required parameter is a required key holding its own kind of value",
    codec,
    { employee: 50030, newTitle: "Director", newCompensation: 250000.5 },
    { employee: 50030, newTitle: "Director", newCompensation: 250000.5 }
  );

  it.effect(
    "refuses a missing argument, a null for a required one, a mistyped one and an unknown one",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(
        [
          { employee: 50030, newTitle: "Director" },
          { employee: 50030, newTitle: null, newCompensation: 250000.5 },
          { employee: 50030, newTitle: "Director", newCompensation: "a lot" },
          { employee: 50030, newTitle: "Director", newCompensation: 250000.5, newOffice: "NYC" },
        ],
        rejects(codec)
      );
      deepStrictEqual(verdicts, [true, true, true, true]);
      const unknownParameter = yield* failureOf(codec)({
        employee: 50030,
        newTitle: "Director",
        newCompensation: 250000.5,
        newOffice: "NYC",
      });
      assertInclude(unknownParameter, "newOffice");
    })
  );

  it.effect(
    "refuses to encode an argument the action type does not declare",
    Effect.fnUntraced(function* () {
      const refused = yield* refusesToEncode(codec)({
        employee: 50030,
        newTitle: "Director",
        newCompensation: 250000.5,
        newOffice: "NYC",
      });
      assertTrue(refused);
    })
  );

  lawful("arguments", codec);
});

forActionType(createStructPerson, (actionType) => {
  const codec = argumentsCodec(actionType);

  wireFixture(
    "actionRequestWithStructAcceptNull: a struct argument is set, with its optional field cleared",
    codec,
    { name: "testMan", address: { city: "NYC", state: "NY", zipcode: null } },
    { name: "testMan", address: O.some({ city: "NYC", state: "NY", zipcode: O.none() }) }
  );

  wireFixture("an absent argument leaves the parameter untouched", codec, { name: "testMan" }, { name: "testMan" });

  wireFixture(
    "a null argument clears the parameter",
    codec,
    { name: "testMan", address: null },
    { name: "testMan", address: O.none() }
  );

  it.effect(
    "the three intents stay distinct values",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(codec);
      const untouched = yield* decode({ name: "testMan" });
      const cleared = yield* decode({ name: "testMan", address: null });
      const isEquivalent = S.toEquivalence(codec);
      assertFalse(P.hasProperty(untouched, "address"));
      assertTrue(P.hasProperty(cleared, "address"));
      assertFalse(isEquivalent(untouched, cleared));
    })
  );

  it.effect(
    "refuses a struct argument that lacks a required field or mistypes one",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(
        [
          { name: "testMan", address: { city: "NYC" } },
          { name: "testMan", address: { city: "NYC", state: "NY", zipcode: "10001-0001" } },
          { address: { city: "NYC", state: "NY" } },
        ],
        rejects(codec)
      );
      deepStrictEqual(verdicts, [true, true, true]);
    })
  );

  lawful("arguments", codec);
});

forActionType(actionTakesAttachment, (actionType) => {
  const codec = argumentsCodec(actionType);

  wireFixture("an attachment argument is the attachment's identifier", codec, { attachment: attachmentRid }, {
    attachment: attachmentRid,
  });

  it.effect(
    "refuses an empty identifier and an upload that was never sent",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(
        [{ attachment: "" }, { attachment: { name: "report.pdf" } }, {}],
        rejects(codec)
      );
      deepStrictEqual(verdicts, [true, true, true]);
    })
  );

  lawful("arguments", codec);
});

forActionType(scheduleMeeting, (actionType) => {
  const codec = argumentsCodec(actionType);

  wireFixture("a list argument is a list of its element type", codec, { invitees: ["alpha", "bravo", "charlie"] }, {
    invitees: ["alpha", "bravo", "charlie"],
  });

  it.effect(
    "refuses a bare element and a list holding another type",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach([{ invitees: "alpha" }, { invitees: ["alpha", 7] }], rejects(codec));
      deepStrictEqual(verdicts, [true, true]);
    })
  );

  lawful("arguments", codec);
});

describe("argumentsCodec of an action without parameters", () => {
  const codec = argumentsCodec({ parameters: {} });

  wireFixture("the only argument record is the empty one", codec, {}, {});

  it.effect(
    "refuses any key and anything that is not a record",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach([{ officeId: "NYC" }, [], "NYC", null], rejects(codec));
      deepStrictEqual(verdicts, [true, true, true, true]);
    })
  );
});

// -----------------------------------------------------------------------------
// Query data types
// -----------------------------------------------------------------------------

const dataCases = QueryDataType.cases;
const noReferences: QueryType["typeReferences"] = {};

const queryFieldNamed = (name: string, fieldType: QueryDataType): QueryStructField =>
  QueryStructField.make({ name: QueryStructFieldName.make(name), fieldType });

const referenceTo = (name: string): QueryDataType =>
  dataCases.typeReference.make({ typeId: TypeReferenceId.make(name) });

const namedTypes = (entries: ReadonlyArray<readonly [string, QueryDataType]>): QueryType["typeReferences"] =>
  A.reduce(entries, noReferences, (types, [name, dataType]) => ({ ...types, [TypeReferenceId.make(name)]: dataType }));

const optionalInteger = dataCases.union.make({ unionTypes: [dataCases.integer.make({}), dataCases.null.make({})] });

const coordinateTypes = namedTypes([
  ["coordinate", dataCases.struct.make({ fields: [queryFieldNamed("x", dataCases.double.make({}))] })],
]);

const queryDataRows: ReadonlyArray<Row<QueryDataType>> = [
  { type: dataCases.boolean.make({}), wire: true, holds: P.isBoolean, refused: "yes", law: "exact" },
  { type: dataCases.integer.make({}), wire: 238940, holds: P.isNumber, refused: 2.5, law: "exact" },
  { type: dataCases.long.make({}), wire: "58319870951433", holds: P.isBigInt, refused: "12.5", law: "exact" },
  { type: dataCases.float.make({}), wire: 3.5, holds: P.isNumber, refused: "pi", law: "exact" },
  { type: dataCases.double.make({}), wire: 3.14159265, holds: P.isNumber, refused: "pi", law: "exact" },
  { type: dataCases.string.make({}), wire: "Call me Ishmael", holds: P.isString, refused: 42, law: "exact" },
  { type: dataCases.date.make({}), wire: "2021-05-01", holds: isLocalDate, refused: "2021-02-30", law: "exact" },
  {
    type: dataCases.timestamp.make({}),
    wire: "2021-01-04T05:00:00.000Z",
    holds: DateTime.isDateTime,
    refused: "2021-01-04",
    law: "exact",
  },
  { type: dataCases.attachment.make({}), wire: attachmentRid, holds: P.isString, refused: "", law: "exact" },
  {
    type: dataCases.mediaReference.make({}),
    wire: mediaReference,
    holds: S.is(MediaReference),
    refused: { mimeType: "application/pdf" },
    law: "exact",
  },
  {
    type: dataCases.geoshape.make({}),
    wire: point,
    holds: S.is(GeoJsonObject),
    refused: { type: "Circle", coordinates: [102.0, 0.5] },
    law: "exact",
  },
  {
    type: dataCases.array.make({ elementType: dataCases.string.make({}) }),
    wire: ["alpha", "bravo", "charlie"],
    holds: A.isArray,
    refused: ["alpha", 1],
    law: "exact",
  },
  {
    type: dataCases.set.make({ elementType: dataCases.string.make({}) }),
    wire: ["alpha", "bravo", "charlie"],
    holds: HashSet.isHashSet,
    refused: ["alpha", 1],
    law: "unordered",
  },
  {
    type: dataCases.entrySet.make({ keyType: dataCases.string.make({}), valueType: dataCases.string.make({}) }),
    wire: [
      { key: "EMP1234", value: "true" },
      { key: "EMP4444", value: "false" },
    ],
    holds: HashMap.isHashMap,
    refused: [{ key: "EMP1234" }],
    law: "unordered",
  },
  {
    type: dataCases.struct.make({
      fields: [queryFieldNamed("name", dataCases.string.make({})), queryFieldNamed("age", dataCases.integer.make({}))],
    }),
    wire: { name: "John Doe", age: 42 },
    holds: isRecord,
    refused: { name: "John Doe" },
    law: "exact",
  },
  {
    type: dataCases.union.make({ unionTypes: [dataCases.string.make({}), dataCases.boolean.make({})] }),
    wire: true,
    holds: P.isBoolean,
    refused: { neither: true },
    law: "exact",
  },
  {
    type: dataCases.object.make({ objectApiName: employee, objectTypeApiName: employee }),
    wire: 10033123,
    holds: P.isNumber,
    refused: { id: 10033123 },
    law: "exact",
  },
  { type: dataCases.objectSet.make({}), wire: objectSetRid, holds: P.isString, refused: "", law: "exact" },
  {
    type: dataCases.interfaceObject.make({}),
    wire: interfaceObject,
    holds: S.is(ObjectLocator),
    refused: { objectTypeApiName: "Employee" },
    law: "exact",
  },
  {
    type: dataCases.interfaceObjectSet.make({ interfaceTypeApiName: InterfaceTypeApiName.make("FooInterface") }),
    wire: objectSetRid,
    holds: P.isString,
    refused: "",
    law: "exact",
  },
  {
    type: dataCases.twoDimensionalAggregation.make({
      keyType: dataCases.string.make({}),
      valueType: dataCases.double.make({}),
    }),
    wire: {
      groups: [
        { key: "alpha", value: 100 },
        { key: "beta", value: 101 },
      ],
    },
    holds: S.is(TwoDimensionalAggregation),
    refused: { groups: [{ key: "alpha" }] },
    law: "exact",
  },
  {
    type: dataCases.threeDimensionalAggregation.make({
      keyType: dataCases.string.make({}),
      valueType: { keyType: dataCases.string.make({}), valueType: dataCases.double.make({}) },
    }),
    wire: { groups: [{ key: "NYC", groups: [{ key: "Engineer", value: 100 }] }] },
    holds: S.is(ThreeDimensionalAggregation),
    refused: { groups: [{ key: "NYC", value: 100 }] },
    law: "exact",
  },
  { type: referenceTo("coordinate"), wire: { x: 102.5 }, holds: isRecord, refused: { x: "east" }, law: "exact" },
  { type: dataCases.null.make({}), wire: null, holds: P.isNull, refused: 0, law: "exact" },
  { type: dataCases.void.make({}), wire: null, holds: P.isUndefined, refused: 0, law: "exact" },
  {
    type: dataCases.unsupported.make({ unsupportedType: "duration" }),
    wire: { anything: [1, null] },
    holds: isRecord,
    refused: Number.NaN,
    law: "exact",
  },
];

caseTable("valueCodec", QueryDataTypeKind.literals, queryDataRows, valueCodec(coordinateTypes));

describe("query values", () => {
  objectSetArgumentLaw("valueCodec of an object set", valueCodec(coordinateTypes)(dataCases.objectSet.make({})));
  objectSetArgumentLaw(
    "valueCodec of an interface object set",
    valueCodec(coordinateTypes)(
      dataCases.interfaceObjectSet.make({ interfaceTypeApiName: InterfaceTypeApiName.make("FooInterface") })
    )
  );

  it.effect(
    "a union with the null tag is an Option of the rest, whichever way round it is declared",
    Effect.fnUntraced(function* () {
      const nullFirst = dataCases.union.make({ unionTypes: [dataCases.null.make({}), dataCases.integer.make({})] });
      const codecs = A.map([optionalInteger, nullFirst], valueCodec(noReferences));
      const decoded = yield* Effect.forEach(codecs, (codec) =>
        Effect.forEach([42, null], (wire) => S.decodeEffect(codec)(wire))
      );
      deepStrictEqual(decoded, [
        [O.some(42), O.none()],
        [O.some(42), O.none()],
      ]);
      const encoded = yield* Effect.forEach(codecs, (codec) =>
        Effect.forEach([O.some(42), O.none()], (value) => S.encodeUnknownEffect(codec)(value))
      );
      deepStrictEqual(encoded, [
        [42, null],
        [42, null],
      ]);
    })
  );

  it.effect(
    "a union of several alternatives and null is an Option of their union",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(
        dataCases.union.make({
          unionTypes: [dataCases.boolean.make({}), dataCases.null.make({}), dataCases.date.make({})],
        }),
        noReferences
      );
      const decoded = yield* Effect.forEach([true, null], (wire) => S.decodeEffect(codec)(wire));
      deepStrictEqual(decoded, [O.some(true), O.none()]);
      const date = yield* S.decodeEffect(codec)("2021-05-01");
      assertTrue(O.isOption(date) && O.exists(date, isLocalDate));
      const refused = yield* rejects(codec)(7.5);
      assertTrue(refused);
    })
  );

  it.effect(
    "a struct field of a nullable type may be absent or null, and is written as null",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(
        dataCases.struct.make({
          fields: [queryFieldNamed("name", dataCases.string.make({})), queryFieldNamed("age", optionalInteger)],
        }),
        noReferences
      );
      const absent = yield* S.decodeEffect(codec)({ name: "John Doe" });
      const explicit = yield* S.decodeEffect(codec)({ name: "John Doe", age: null });
      deepStrictEqual(absent, { name: "John Doe", age: O.none() });
      deepStrictEqual(explicit, absent);
      const encoded = yield* S.encodeUnknownEffect(codec)(absent);
      deepStrictEqual(encoded, { name: "John Doe", age: null });
    })
  );

  it.effect(
    "a set decodes its members by their own type and collapses duplicates",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(dataCases.set.make({ elementType: dataCases.date.make({}) }), noReferences);
      const decoded = yield* S.decodeEffect(codec)(["2021-05-01", "2021-05-02", "2021-05-01"]);
      assertTrue(HashSet.isHashSet(decoded) && HashSet.size(decoded) === 2 && HashSet.every(decoded, isLocalDate));
      const encoded = yield* S.encodeUnknownEffect(codec)(decoded);
      assertTrue(sameMembers(encoded, ["2021-05-01", "2021-05-02"]));
    })
  );

  it.effect(
    "an entry set is a HashMap from decoded keys to decoded values",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(
        dataCases.entrySet.make({ keyType: dataCases.string.make({}), valueType: dataCases.long.make({}) }),
        noReferences
      );
      const decoded = yield* S.decodeEffect(codec)([
        { key: "EMP1234", value: "58319870951433" },
        { key: "EMP4444", value: 7 },
      ]);
      assertTrue(
        Equal.equals(
          decoded,
          HashMap.make(["EMP1234", BigInt("58319870951433")], ["EMP4444", BigInt(7)])
        )
      );
      const encoded = yield* S.encodeUnknownEffect(codec)(decoded);
      assertTrue(
        sameMembers(encoded, [
          { key: "EMP1234", value: "58319870951433" },
          { key: "EMP4444", value: "7" },
        ])
      );
    })
  );

  it.effect(
    "aggregation keys, range bounds and values are read by the scalar codecs the type declares",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(
        dataCases.twoDimensionalAggregation.make({
          keyType: { type: "range", boundType: dataCases.date.make({}) },
          valueType: dataCases.timestamp.make({}),
        }),
        noReferences
      );
      const wire = {
        groups: [
          { key: { startValue: "2021-05-01", endValue: "2021-06-01" }, value: "2021-05-17T09:30:00.000Z" },
          { key: { startValue: "2021-06-01" }, value: "2021-06-02T00:00:00.000Z" },
        ],
      };
      const decoded = yield* S.decodeEffect(codec)(wire);
      // The projection knows the declared types, so it holds the rich values: calendar dates and instants.
      const mayFirst = yield* S.decodeEffect(DateValue)("2021-05-01");
      const juneFirst = yield* S.decodeEffect(DateValue)("2021-06-01");
      deepStrictEqual<unknown>(decoded, {
        groups: [
          {
            key: { startValue: O.some(mayFirst), endValue: O.some(juneFirst) },
            value: DateTime.makeUnsafe("2021-05-17T09:30:00.000Z"),
          },
          {
            key: { startValue: O.some(juneFirst), endValue: O.none() },
            value: DateTime.makeUnsafe("2021-06-02T00:00:00.000Z"),
          },
        ],
      });
      const encoded = yield* S.encodeUnknownEffect(codec)(decoded);
      deepStrictEqual(encoded, wire);
      // The ontology-free schema reads the same record and holds each bound and value as the scalar that travels.
      // The two tiers meet on the wire, not in the domain: a rich value is not a wire scalar.
      const untyped = yield* S.decodeEffect(TwoDimensionalAggregation)(wire);
      const untypedWire = yield* S.encodeEffect(TwoDimensionalAggregation)(untyped);
      deepStrictEqual<unknown>(untypedWire, wire);
      assertTrue(S.is(TwoDimensionalAggregation)(untyped));
      assertFalse(S.is(TwoDimensionalAggregation)(decoded));
      const verdicts = yield* Effect.forEach(
        [
          { groups: [{ key: {}, value: "2021-05-17T09:30:00.000Z" }] },
          { groups: [{ key: { startValue: "May" }, value: "2021-05-17T09:30:00.000Z" }] },
          { groups: [{ key: { startValue: "2021-05-01" }, value: 17 }] },
        ],
        rejects(codec)
      );
      deepStrictEqual(verdicts, [true, true, true]);
      const unbounded = yield* failureOf(codec)({ groups: [{ key: {}, value: "2021-05-17T09:30:00.000Z" }] });
      assertInclude(unbounded, "A range needs a startValue, an endValue or both");
    })
  );

  it.effect(
    "void reads null or an absent value as the unit value and writes null",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(dataCases.void.make({}), noReferences);
      const decoded = yield* Effect.forEach([null, undefined], (wire) => S.decodeEffect(codec)(wire));
      deepStrictEqual(decoded, [undefined, undefined]);
      const encoded = yield* S.encodeUnknownEffect(codec)(undefined);
      strictEqual(encoded, null);
    })
  );
});

describe("type references", () => {
  const linkedList = namedTypes([
    [
      "list",
      dataCases.struct.make({
        fields: [
          queryFieldNamed("head", dataCases.integer.make({})),
          queryFieldNamed(
            "tail",
            dataCases.union.make({ unionTypes: [referenceTo("list"), dataCases.null.make({})] })
          ),
        ],
      }),
    ],
    ["alias", referenceTo("list")],
  ]);

  it.effect(
    "a type that contains itself decodes as deep as the value goes, through an alias too",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(referenceTo("alias"), linkedList);
      const wire = { head: 1, tail: { head: 2, tail: { head: 3, tail: null } } };
      const decoded = yield* S.decodeEffect(codec)(wire);
      deepStrictEqual(decoded, {
        head: 1,
        tail: O.some({ head: 2, tail: O.some({ head: 3, tail: O.none() }) }),
      });
      const encoded = yield* S.encodeUnknownEffect(codec)(decoded);
      deepStrictEqual(encoded, wire);
      const refused = yield* rejects(codec)({ head: 1, tail: { head: "two", tail: null } });
      assertTrue(refused);
    })
  );

  lawful("a recursive list", valueCodec(referenceTo("list"), linkedList));

  it.effect(
    "a reference to a name nobody defines projects to a codec that refuses every value",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(dataCases.array.make({ elementType: referenceTo("missing") }), linkedList);
      const empty = yield* S.decodeEffect(codec)([]);
      deepStrictEqual(empty, []);
      const message = yield* failureOf(codec)([1]);
      assertInclude(message, 'Unknown type reference "missing"');
    })
  );

  it.effect(
    "a name that only refers to itself is refused instead of unfolding forever",
    Effect.fnUntraced(function* () {
      const circular = namedTypes([
        ["self", referenceTo("self")],
        ["ping", dataCases.union.make({ unionTypes: [referenceTo("pong"), dataCases.null.make({})] })],
        ["pong", referenceTo("ping")],
      ]);
      const messages = yield* Effect.forEach(["self", "ping", "pong"], (name) =>
        failureOf(valueCodec(referenceTo(name), circular))(1)
      );
      deepStrictEqual(messages, [
        'Type reference "self" refers only to itself',
        'Type reference "ping" refers only to itself',
        'Type reference "pong" refers only to itself',
      ]);
    })
  );
});

// -----------------------------------------------------------------------------
// Query types, transcribed from osdk-ts packages/shared.test/src/stubs/queryTypes.ts
// -----------------------------------------------------------------------------

const complexStructFixture: typeof QueryType.Encoded = {
  apiName: "incrementPersonAgeComplex",
  displayName: "incrementAgeComplex",
  parameters: {
    person: {
      dataType: {
        type: "struct",
        fields: [
          { name: "firstName", fieldType: { type: "string" } },
          { name: "lastName", fieldType: { type: "string" } },
          { name: "age", fieldType: { type: "union", unionTypes: [{ type: "integer" }, { type: "null" }] } },
          {
            name: "object",
            fieldType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" },
          },
        ],
      },
      required: true,
    },
  },
  output: {
    type: "struct",
    fields: [
      { name: "firstName", fieldType: { type: "string" } },
      { name: "lastName", fieldType: { type: "string" } },
      { name: "age", fieldType: { type: "union", unionTypes: [{ type: "integer" }, { type: "null" }] } },
      {
        name: "object",
        fieldType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" },
      },
    ],
  },
  rid: "ri.function-registry.main.function.b2ae7b3e-2c89-42f5-a762-68957a9c039d",
  version: "0.0.9",
  typeReferences: {},
};

const recursiveStructFixture: typeof QueryType.Encoded = {
  apiName: "queryReturnsRecursiveStruct",
  displayName: "queryReturnsRecursiveStruct",
  parameters: {
    treeNode: {
      dataType: { type: "typeReference", typeId: "recursive-tree-node" },
      required: true,
    },
  },
  output: { type: "typeReference", typeId: "recursive-tree-node" },
  rid: "ri.function-registry.main.function.d4f69e63-9531-55ff-0a1c-4896e0a0bee5",
  version: "0.1.0",
  typeReferences: {
    "recursive-tree-node": {
      type: "struct",
      fields: [
        { name: "id", fieldType: { type: "string" } },
        { name: "value", fieldType: { type: "integer" } },
        {
          name: "children",
          fieldType: { type: "array", subType: { type: "typeReference", typeId: "recursive-tree-node" } },
        },
      ],
    },
  },
};

const twoDimensionalFixture: typeof QueryType.Encoded = {
  apiName: "twoDimensionalAggregationFunction",
  displayName: "twoDimensionalAggregation",
  parameters: {},
  output: {
    type: "twoDimensionalAggregation",
    keyType: { type: "string" },
    valueType: { type: "double" },
  },
  rid: "ri.function-registry.main.function.9b55870a-63c7-4d48-8f06-9627c0805968",
  version: "0.11.0",
  typeReferences: {},
};

const threeDimensionalFixture: typeof QueryType.Encoded = {
  apiName: "threeDimensionalAggregationFunction",
  displayName: "threeDimensionalAggregation",
  parameters: {},
  output: {
    type: "threeDimensionalAggregation",
    keyType: { type: "string" },
    valueType: {
      keyType: { type: "range", subType: { type: "timestamp" } },
      valueType: { type: "double" },
    },
  },
  rid: "ri.function-registry.main.function.9b55870a-63c7-4d48-8f06-9627c0805968",
  version: "0.11.0",
  typeReferences: {},
};

const objectSetFixture: typeof QueryType.Encoded = {
  apiName: "queryAcceptsObjectSets",
  description: "description of the query that takes objectSet types",
  displayName: "QueryAcceptsObjectSets",
  parameters: {
    objectSet: {
      dataType: { type: "objectSet", objectApiName: "Employee", objectTypeApiName: "Employee" },
      required: true,
    },
  },
  output: { type: "objectSet", objectApiName: "Employee", objectTypeApiName: "Employee" },
  rid: "ri.function-registry.main.function.9b55870a-63c7-4d48-8f06-9627c0805968",
  version: "0.11.0",
  typeReferences: {},
};

const entrySetFixture: typeof QueryType.Encoded = {
  apiName: "queryTypeReturnsMap",
  output: {
    type: "entrySet",
    keyType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" },
    valueType: { type: "float" },
  },
  parameters: {
    peopleMap: {
      dataType: {
        type: "entrySet",
        keyType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" },
        valueType: { type: "string" },
      },
      required: true,
    },
  },
  rid: "ri.function-registry.main.function.c3e58d52-8430-44ee-9f0b-3785d9a9bdd2",
  version: "0.1.1",
  typeReferences: {},
};

const interfaceFixture: typeof QueryType.Encoded = {
  apiName: "queryAcceptsInterface",
  description: "description of the query that takes interface types",
  displayName: "QueryAcceptsObject",
  parameters: {
    interfaceObject: {
      dataType: { type: "interfaceObject", interfaceTypeApiName: "FooInterface" },
      required: true,
    },
  },
  output: { type: "interfaceObject", interfaceTypeApiName: "FooInterface" },
  rid: "ri.function-registry.main.function.9b35870a-63c7-4d48-8f06-9617c0805968",
  version: "0.11.0",
  typeReferences: {},
};

/** Registers the tests of one query type fixture, or one failing test when the fixture no longer decodes. */
const forQueryType = (wire: typeof QueryType.Encoded, body: (queryType: QueryType) => void) =>
  describe(`parametersCodec and outputCodec of ${wire.apiName}`, () =>
    O.match(S.decodeOption(QueryType)(wire), {
      onNone: () => it("decodes its query type fixture", () => assertTrue(false, "the fixture did not decode")),
      onSome: body,
    })
  );

forQueryType(complexStructFixture, (queryType) => {
  const parameters = parametersCodec(queryType);
  const output = outputCodec(queryType);
  const person = { firstName: "John", lastName: "Doe", age: 42, object: 50030 };
  const ageless = { firstName: "Jane", lastName: "Doe", age: null, object: "EMP1234" };

  wireFixture("a struct parameter holds each field in its own type", parameters, { person }, {
    person: { firstName: "John", lastName: "Doe", age: O.some(42), object: 50030 },
  });

  wireFixture("the output reads a null age as none", output, ageless, {
    firstName: "Jane",
    lastName: "Doe",
    age: O.none(),
    object: "EMP1234",
  });

  it.effect(
    "refuses a missing parameter, an unknown one and a field of the wrong type",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(
        [{}, { person, manager: person }, { person: { ...person, age: "forty-two" } }],
        rejects(parameters)
      );
      deepStrictEqual(verdicts, [true, true, true]);
      const unknownParameter = yield* failureOf(parameters)({ person, manager: person });
      assertInclude(unknownParameter, "manager");
      const refused = yield* refusesToEncode(parameters)({
        person: { firstName: "John", lastName: "Doe", age: O.some(42), object: 50030 },
        manager: 1,
      });
      assertTrue(refused);
    })
  );

  lawful("parameters", parameters);
  lawful("output", output);
});

forQueryType(recursiveStructFixture, (queryType) => {
  const parameters = parametersCodec(queryType);
  const output = outputCodec(queryType);
  const treeNode = {
    id: "root",
    value: 1,
    children: [
      { id: "left", value: 2, children: [{ id: "leaf", value: 4, children: [] }] },
      { id: "right", value: 3, children: [] },
    ],
  };

  wireFixture("a recursive parameter decodes at every depth", parameters, { treeNode }, { treeNode });
  wireFixture("a recursive output decodes at every depth", output, treeNode, treeNode);

  it.effect(
    "refuses a node that is malformed three levels down",
    Effect.fnUntraced(function* () {
      const refused = yield* rejects(output)({
        id: "root",
        value: 1,
        children: [{ id: "left", value: 2, children: [{ id: "leaf", value: "four", children: [] }] }],
      });
      assertTrue(refused);
    })
  );

  lawful("parameters", parameters);
  lawful("output", output);
});

forQueryType(twoDimensionalFixture, (queryType) => {
  const parameters = parametersCodec(queryType);
  const output = outputCodec(queryType);
  const groups = {
    groups: [
      { key: "Q-AFN", value: 1 },
      { key: "Q-AFO", value: 2 },
    ],
  };

  wireFixture("a query without parameters takes the empty record", parameters, {}, {});
  wireFixture("the output is one value per group key", output, groups, groups);

  it.effect(
    "the decoded output is a two-dimensional aggregation, and a text value is refused",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(output)(groups);
      assertTrue(S.is(TwoDimensionalAggregation)(decoded));
      const verdicts = yield* Effect.forEach(
        [{ groups: [{ key: "Q-AFN", value: "many" }] }, { groups: [{ key: 7, value: 1 }] }, [groups]],
        rejects(output)
      );
      deepStrictEqual(verdicts, [true, true, true]);
      const stray = yield* rejects(parameters)({ limit: 10 });
      assertTrue(stray);
    })
  );

  lawful("output", output);
});

forQueryType(threeDimensionalFixture, (queryType) => {
  const output = outputCodec(queryType);
  const groups = {
    groups: [
      {
        key: "Q-AFN",
        groups: [{ key: { startValue: "2010-10-01T00:00:00.000Z", endValue: "2010-10-02T00:00:00.000Z" }, value: 65 }],
      },
      { key: "Q-AFO", groups: [] },
    ],
  };

  wireFixture("the output is one value per pair of keys, with range bounds read as instants", output, groups, {
    groups: [
      {
        key: "Q-AFN",
        groups: [
          {
            key: {
              startValue: O.some(DateTime.makeUnsafe("2010-10-01T00:00:00.000Z")),
              endValue: O.some(DateTime.makeUnsafe("2010-10-02T00:00:00.000Z")),
            },
            value: 65,
          },
        ],
      },
      { key: "Q-AFO", groups: [] },
    ],
  });

  it.effect(
    "the decoded output is a three-dimensional aggregation, and a range without bounds is refused",
    Effect.fnUntraced(function* () {
      // The projected output holds instants (the fixture above asserts them). The ontology-free schema reads the
      // same wire record with the bounds as the text that travels, and writes it back unchanged.
      const decoded = yield* S.decodeEffect(output)(groups);
      assertFalse(S.is(ThreeDimensionalAggregation)(decoded));
      const untyped = yield* S.decodeEffect(ThreeDimensionalAggregation)(groups);
      const untypedWire = yield* S.encodeEffect(ThreeDimensionalAggregation)(untyped);
      deepStrictEqual<unknown>(untypedWire, groups);
      const projectedWire = yield* S.encodeUnknownEffect(output)(decoded);
      deepStrictEqual<unknown>(projectedWire, groups);
      const refused = yield* rejects(output)({ groups: [{ key: "Q-AFN", groups: [{ key: {}, value: 65 }] }] });
      assertTrue(refused);
    })
  );

  lawful("output", output);
});

forQueryType(objectSetFixture, (queryType) => {
  const parameters = parametersCodec(queryType);
  const output = outputCodec(queryType);

  wireFixture("an object set parameter may be a stored set's identifier", parameters, { objectSet: objectSetRid }, {
    objectSet: objectSetRid,
  });
  wireFixture("an object set output may be a stored set's identifier", output, objectSetRid, objectSetRid);

  it.effect(
    "an object set parameter and output may also be a definition written in place",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(parameters)({ objectSet: inlineObjectSet });
      assertTrue(S.is(ObjectSet)(decoded.objectSet));
      const encoded = yield* S.encodeEffect(parameters)(decoded);
      deepStrictEqual<unknown>(encoded, { objectSet: inlineObjectSet });
      const returned = yield* S.decodeEffect(output)(inlineObjectSet);
      assertTrue(S.is(ObjectSet)(returned));
      const written = yield* S.encodeEffect(output)(returned);
      deepStrictEqual<unknown>(written, inlineObjectSet);
    })
  );

  it.effect(
    "refuses an empty identifier and a record that defines no object set",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(parameters)({ objectSet: "" }),
        rejects(output)(""),
        rejects(parameters)({ objectSet: { type: "base" } }),
        rejects(output)({ objectType: "Employee" }),
      ]);
      deepStrictEqual(verdicts, [true, true, true, true]);
    })
  );

  // An object set holds filters, whose comparands are wire scalars: the parameters round-trip exactly.
  lawful("parameters", parameters);
});

forQueryType(entrySetFixture, (queryType) => {
  const parameters = parametersCodec(queryType);
  const output = outputCodec(queryType);
  const peopleMap = [
    { key: "EMP1234", value: "true" },
    { key: "EMP4444", value: "false" },
  ];

  it.effect(
    "a map parameter is a HashMap keyed by primary key, written as key and value entries",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(parameters)({ peopleMap });
      assertTrue(Equal.equals(decoded.peopleMap, HashMap.make(["EMP1234", "true"], ["EMP4444", "false"])));
      const encoded = yield* S.encodeUnknownEffect(parameters)(decoded);
      assertTrue(P.hasProperty(encoded, "peopleMap") && sameMembers(encoded.peopleMap, peopleMap));
    })
  );

  it.effect(
    "a map output decodes each value by the declared value type",
    Effect.fnUntraced(function* () {
      const wire = [{ key: 50030, value: 1.5 }];
      const decoded = yield* S.decodeEffect(output)(wire);
      assertTrue(Equal.equals(decoded, HashMap.make([50030, 1.5])));
      const encoded = yield* S.encodeUnknownEffect(output)(decoded);
      deepStrictEqual(encoded, wire);
      const verdicts = yield* Effect.forEach([[{ key: 50030, value: "tall" }], { EMP1234: 1.5 }], rejects(output));
      deepStrictEqual(verdicts, [true, true]);
    })
  );
});

forQueryType(interfaceFixture, (queryType) => {
  const parameters = parametersCodec(queryType);
  const output = outputCodec(queryType);
  const locator = ObjectLocator.make({ objectType: employee, primaryKey: "EMP1234" });

  wireFixture("an interface object parameter names its concrete object type and key", parameters, { interfaceObject }, {
    interfaceObject: locator,
  });
  wireFixture("an interface object output is an object locator", output, interfaceObject, locator);

  it.effect(
    "refuses a bare primary key",
    Effect.fnUntraced(function* () {
      const refused = yield* rejects(output)("EMP1234");
      assertTrue(refused);
    })
  );

  lawful("parameters", parameters);
});

describe("parametersCodec of a query with an optional parameter", () => {
  const codec = parametersCodec({
    parameters: R.mapKeys(
      {
        since: QueryParameter.make({ dataType: dataCases.date.make({}), required: true }),
        limit: QueryParameter.make({ dataType: dataCases.integer.make({}), required: false }),
        cursor: QueryParameter.make({ dataType: optionalInteger, required: false }),
      },
      (key) => ParameterId.make(key)
    ),
    typeReferences: noReferences,
  });

  it.effect(
    "leaving a parameter out and supplying null are different messages",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(codec);
      const leftOut = yield* decode({ since: "2021-05-01" });
      const supplied = yield* decode({ since: "2021-05-01", limit: 10, cursor: null });
      deepStrictEqual([leftOut.limit, leftOut.cursor], [O.none(), O.none()]);
      deepStrictEqual([supplied.limit, supplied.cursor], [O.some(10), O.some(O.none())]);
      const encoded = yield* Effect.forEach([leftOut, supplied], (args) => S.encodeUnknownEffect(codec)(args));
      deepStrictEqual(encoded, [{ since: "2021-05-01" }, { since: "2021-05-01", limit: 10, cursor: null }]);
      const nullForNonNullable = yield* rejects(codec)({ since: "2021-05-01", limit: null });
      assertTrue(nullForNonNullable);
    })
  );

  lawful("parameters", codec);
});
