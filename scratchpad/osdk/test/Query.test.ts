import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { IntegerType, NullType, StringType } from "../src/DataType/DataType.model.ts";
import { QueryDataTypeKind } from "../src/DataType/DataType.values.ts";
import {
  FunctionRid,
  FunctionVersion,
  InterfaceTypeApiName,
  ObjectTypeApiName,
  ParameterId,
  QueryApiName,
} from "../src/Identifier/Identifier.model.ts";
import {
  EntrySetType,
  ExecuteQueryRequest,
  ExecuteQueryResponse,
  GetQueryTypesByRidRequest,
  GetQueryTypesByRidResponse,
  InterfaceObjectReferenceType,
  InterfaceObjectSetType,
  NestedAggregationType,
  NestedQueryAggregationGroup,
  nonNullAlternative,
  ObjectReferenceType,
  ObjectSetType,
  QueryAggregationBoundType,
  QueryAggregationGroup,
  QueryAggregationKey,
  QueryAggregationKeyType,
  QueryAggregationRangeKeyType,
  QueryAggregationValueType,
  QueryArrayType,
  QueryDataType,
  QueryParameter,
  QueryRange,
  QuerySetType,
  QueryStreamData,
  QueryStreamEvent,
  QueryStreamFailure,
  QueryStructField,
  QueryStructFieldName,
  QueryStructType,
  QueryType,
  QueryTypeByRid,
  QueryUnionType,
  resolveTypeReference,
  ThreeDimensionalAggregation,
  ThreeDimensionalAggregationType,
  TwoDimensionalAggregation,
  TwoDimensionalAggregationType,
  TypeReferenceId,
  TypeReferenceType,
} from "../src/Query/index.ts";
import { LongValue } from "../src/Value/Value.model.ts";
import type { ScalarValue } from "../src/Value/Value.model.ts";

// ---------------------------------------------------------------------------
// Laws shared by every named schema
// ---------------------------------------------------------------------------

const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const arbitrary = Arbitrary.schema(schema);
  const is = S.is(schema);
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  it.prop(`${name}: generated values satisfy the schema guard`, [arbitrary], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });

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

const rejects =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isFailure);

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

const decodeQueryType = S.decodeEffect(QueryType);
const encodeQueryType = S.encodeEffect(QueryType);
const queryTypeEquivalence = S.toEquivalence(QueryType);
const dataTypeEquivalence = S.toEquivalence(QueryDataType);
const decodeDataType = S.decodeEffect(QueryDataType);
const encodeDataType = S.encodeEffect(QueryDataType);
const decodeRange = S.decodeEffect(QueryRange);
const encodeRange = S.encodeEffect(QueryRange);
const decodeStreamEvent = S.decodeEffect(QueryStreamEvent);
const encodeStreamEvent = S.encodeEffect(QueryStreamEvent);

// ---------------------------------------------------------------------------
// Wire fixtures, transcribed from osdk-ts packages/shared.test/src/stubs/queryTypes.ts
// ---------------------------------------------------------------------------

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

const employee = ObjectTypeApiName.make("Employee");
const fieldNamed = (name: string, fieldType: QueryDataType): QueryStructField =>
  QueryStructField.make({ name: QueryStructFieldName.make(name), fieldType });
const referenceTo = (name: string): TypeReferenceType => TypeReferenceType.make({ typeId: TypeReferenceId.make(name) });
const unionOf = (unionTypes: ReadonlyArray<QueryDataType>): QueryUnionType => QueryUnionType.make({ unionTypes });
const tagOf = (dataType: QueryDataType): QueryDataTypeKind => dataType.type;

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

describe("query identifiers", () => {
  lawful("TypeReferenceId", TypeReferenceId);
  lawful("QueryStructFieldName", QueryStructFieldName);

  it.effect(
    "rejects empty names",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([rejects(TypeReferenceId)(""), rejects(QueryStructFieldName)("")]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Aggregation type descriptors
// ---------------------------------------------------------------------------

describe("aggregation type descriptors", () => {
  lawful("QueryAggregationBoundType", QueryAggregationBoundType);
  lawful("QueryAggregationRangeKeyType", QueryAggregationRangeKeyType);
  lawful("QueryAggregationKeyType", QueryAggregationKeyType);
  lawful("QueryAggregationValueType", QueryAggregationValueType);
  lawful("NestedAggregationType", NestedAggregationType);
  lawful("TwoDimensionalAggregationType", TwoDimensionalAggregationType);
  lawful("ThreeDimensionalAggregationType", ThreeDimensionalAggregationType);

  it("lists the literal sets the wire allows for keys, range bounds and values", () => {
    deepStrictEqual(QueryAggregationKeyType.discriminants, [
      "boolean",
      "integer",
      "double",
      "string",
      "date",
      "timestamp",
      "range",
    ]);
    deepStrictEqual(QueryAggregationBoundType.discriminants, ["integer", "double", "date", "timestamp"]);
    deepStrictEqual(QueryAggregationValueType.discriminants, ["double", "date", "timestamp"]);
  });

  it("constructs every key, bound and value case and runs the exhaustive matchers", () => {
    const booleanKey = QueryAggregationKeyType.cases.boolean.make({});
    const rangeKey = QueryAggregationKeyType.cases.range.make({
      boundType: QueryAggregationBoundType.cases.date.make({}),
    });
    const keys = [
      booleanKey,
      QueryAggregationKeyType.cases.integer.make({}),
      QueryAggregationKeyType.cases.double.make({}),
      QueryAggregationKeyType.cases.string.make({}),
      QueryAggregationKeyType.cases.date.make({}),
      QueryAggregationKeyType.cases.timestamp.make({}),
      rangeKey,
    ];
    const bounds = [
      QueryAggregationBoundType.cases.integer.make({}),
      QueryAggregationBoundType.cases.double.make({}),
      QueryAggregationBoundType.cases.date.make({}),
      QueryAggregationBoundType.cases.timestamp.make({}),
    ];
    const values = [
      QueryAggregationValueType.cases.double.make({}),
      QueryAggregationValueType.cases.date.make({}),
      QueryAggregationValueType.cases.timestamp.make({}),
    ];
    const describeKey = QueryAggregationKeyType.match({
      boolean: () => "boolean",
      integer: () => "integer",
      double: () => "double",
      string: () => "string",
      date: () => "date",
      timestamp: () => "timestamp",
      range: ({ boundType }) => `range<${boundType.type}>`,
    });
    const isNumericBound = QueryAggregationBoundType.match({
      integer: () => true,
      double: () => true,
      date: () => false,
      timestamp: () => false,
    });
    const isTemporalValue = QueryAggregationValueType.match({
      double: () => false,
      date: () => true,
      timestamp: () => true,
    });
    deepStrictEqual(A.map(keys, describeKey), [
      "boolean",
      "integer",
      "double",
      "string",
      "date",
      "timestamp",
      "range<date>",
    ]);
    deepStrictEqual(A.map(bounds, isNumericBound), [true, true, false, false]);
    deepStrictEqual(A.map(values, isTemporalValue), [false, true, true]);
    assertTrue(A.every(keys, (key) => QueryAggregationKeyType.guards[key.type](key)));
    assertTrue(A.every(bounds, (bound) => QueryAggregationBoundType.guards[bound.type](bound)));
    assertTrue(A.every(values, (value) => QueryAggregationValueType.guards[value.type](value)));
    assertTrue(QueryAggregationKeyType.isAnyOf(["range"])(rangeKey));
    assertFalse(QueryAggregationKeyType.guards.range(booleanKey));
  });

  it.effect(
    "renames the range key's wire subType to boundType and back",
    Effect.fnUntraced(function* () {
      const wire: typeof QueryAggregationKeyType.Encoded = { type: "range", subType: { type: "timestamp" } };
      const decoded = yield* S.decodeEffect(QueryAggregationKeyType)(wire);
      assertTrue(QueryAggregationKeyType.guards.range(decoded));
      strictEqual(QueryAggregationKeyType.guards.range(decoded) ? decoded.boundType.type : "none", "timestamp");
      const encoded = yield* S.encodeEffect(QueryAggregationKeyType)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "rejects key, bound and value types outside the wire's literal sets",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(QueryAggregationKeyType)({ type: "long" }),
        rejects(QueryAggregationKeyType)({ type: "range" }),
        rejects(QueryAggregationKeyType)({ type: "range", subType: { type: "string" } }),
        rejects(QueryAggregationKeyType)({ type: "range", boundType: { type: "date" } }),
        rejects(QueryAggregationBoundType)({ type: "boolean" }),
        rejects(QueryAggregationValueType)({ type: "integer" }),
        rejects(QueryAggregationValueType)({ type: "string" }),
        rejects(TwoDimensionalAggregationType)({
          type: "twoDimensionalAggregation",
          keyType: { type: "string" },
          valueType: { type: "boolean" },
        }),
        rejects(ThreeDimensionalAggregationType)({
          type: "threeDimensionalAggregation",
          keyType: { type: "string" },
          valueType: { type: "double" },
        }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Query data types
// ---------------------------------------------------------------------------

describe("QueryDataType", () => {
  lawful("QueryArrayType", QueryArrayType);
  lawful("QuerySetType", QuerySetType);
  lawful("EntrySetType", EntrySetType);
  lawful("QueryStructField", QueryStructField);
  lawful("QueryStructType", QueryStructType);
  lawful("QueryUnionType", QueryUnionType);
  lawful("ObjectReferenceType", ObjectReferenceType);
  lawful("ObjectSetType", ObjectSetType);
  lawful("InterfaceObjectReferenceType", InterfaceObjectReferenceType);
  lawful("InterfaceObjectSetType", InterfaceObjectSetType);
  lawful("TypeReferenceType", TypeReferenceType);
  lawful("QueryDataType", QueryDataType);

  const string = QueryDataType.cases.string.make({});
  const integer = QueryDataType.cases.integer.make({});
  const everyCase: ReadonlyArray<QueryDataType> = [
    QueryDataType.cases.boolean.make({}),
    integer,
    QueryDataType.cases.long.make({}),
    QueryDataType.cases.float.make({}),
    QueryDataType.cases.double.make({}),
    string,
    QueryDataType.cases.date.make({}),
    QueryDataType.cases.timestamp.make({}),
    QueryDataType.cases.attachment.make({}),
    QueryDataType.cases.mediaReference.make({}),
    QueryDataType.cases.geoshape.make({}),
    QueryDataType.cases.array.make({ elementType: string }),
    QueryDataType.cases.set.make({ elementType: integer }),
    QueryDataType.cases.entrySet.make({ keyType: string, valueType: integer }),
    QueryDataType.cases.struct.make({ fields: [fieldNamed("id", string), fieldNamed("value", integer)] }),
    QueryDataType.cases.union.make({ unionTypes: [integer, QueryDataType.cases.null.make({})] }),
    QueryDataType.cases.object.make({ objectApiName: employee, objectTypeApiName: employee }),
    QueryDataType.cases.objectSet.make({ objectTypeApiName: O.some(employee) }),
    QueryDataType.cases.interfaceObject.make({}),
    QueryDataType.cases.interfaceObjectSet.make({ interfaceTypeApiName: InterfaceTypeApiName.make("FooInterface") }),
    QueryDataType.cases.twoDimensionalAggregation.make({
      keyType: QueryAggregationKeyType.cases.string.make({}),
      valueType: QueryAggregationValueType.cases.double.make({}),
    }),
    QueryDataType.cases.threeDimensionalAggregation.make({
      keyType: QueryAggregationKeyType.cases.string.make({}),
      valueType: NestedAggregationType.make({
        keyType: QueryAggregationRangeKeyType.make({ boundType: QueryAggregationBoundType.cases.timestamp.make({}) }),
        valueType: QueryAggregationValueType.cases.double.make({}),
      }),
    }),
    QueryDataType.cases.typeReference.make({ typeId: TypeReferenceId.make("recursive-tree-node") }),
    QueryDataType.cases.null.make({}),
    QueryDataType.cases.void.make({}),
    QueryDataType.cases.unsupported.make({ unsupportedType: "optional" }),
  ];

  const leaf = (): ReadonlyArray<QueryDataType> => A.empty();
  const children: (dataType: QueryDataType) => ReadonlyArray<QueryDataType> = QueryDataType.match({
    boolean: leaf,
    integer: leaf,
    long: leaf,
    float: leaf,
    double: leaf,
    string: leaf,
    date: leaf,
    timestamp: leaf,
    attachment: leaf,
    mediaReference: leaf,
    geoshape: leaf,
    array: ({ elementType }) => A.of(elementType),
    set: ({ elementType }) => A.of(elementType),
    entrySet: ({ keyType, valueType }) => A.make(keyType, valueType),
    struct: ({ fields }) => A.map(fields, (field) => field.fieldType),
    union: ({ unionTypes }) => unionTypes,
    object: leaf,
    objectSet: leaf,
    interfaceObject: leaf,
    interfaceObjectSet: leaf,
    twoDimensionalAggregation: leaf,
    threeDimensionalAggregation: leaf,
    typeReference: leaf,
    null: leaf,
    void: leaf,
    unsupported: leaf,
  });

  it("has one member per query type tag, in the vocabulary's order", () => {
    strictEqual(QueryDataType.discriminants.length, 26);
    deepStrictEqual(QueryDataType.discriminants, QueryDataTypeKind.literals);
    deepStrictEqual<ReadonlyArray<QueryDataTypeKind>>(A.map(everyCase, tagOf), QueryDataTypeKind.literals);
  });

  it("constructs every case, exercises every guard and the exhaustive matcher", () => {
    assertTrue(A.every(everyCase, (dataType) => QueryDataType.guards[dataType.type](dataType)));
    assertTrue(A.every(everyCase, S.is(QueryDataType)));
    assertFalse(QueryDataType.guards.array(string));
    assertFalse(QueryDataType.guards.null(integer));
    deepStrictEqual(
      A.map(everyCase, (dataType) => children(dataType).length),
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    );
    deepStrictEqual(
      A.map(A.filter(everyCase, QueryDataType.isAnyOf(["array", "set", "entrySet", "struct", "union"])), tagOf),
      ["array", "set", "entrySet", "struct", "union"]
    );
  });

  it("keeps the hand-written encoded types equal to what the schemas infer", () => {
    const facts: readonly [
      Equals<typeof QueryArrayType.Encoded, QueryArrayType.Encoded>,
      Equals<typeof QuerySetType.Encoded, QuerySetType.Encoded>,
      Equals<typeof EntrySetType.Encoded, EntrySetType.Encoded>,
      Equals<typeof QueryStructField.Encoded, QueryStructField.Encoded>,
      Equals<typeof QueryStructType.Encoded, QueryStructType.Encoded>,
      Equals<typeof QueryUnionType.Encoded, QueryUnionType.Encoded>,
      Equals<typeof QueryDataType.Encoded, QueryDataType.Encoded>,
      Equals<QueryArrayType["elementType"], QueryDataType>,
      Equals<QueryStructField["name"], QueryStructFieldName>,
      Equals<
        typeof ObjectSetType.Encoded,
        { readonly type: "objectSet"; readonly objectApiName?: string; readonly objectTypeApiName?: string }
      >,
      Equals<
        typeof ThreeDimensionalAggregationType.Encoded,
        {
          readonly type: "threeDimensionalAggregation";
          readonly keyType: typeof QueryAggregationKeyType.Encoded;
          readonly valueType: {
            readonly keyType: typeof QueryAggregationKeyType.Encoded;
            readonly valueType: typeof QueryAggregationValueType.Encoded;
          };
        }
      >,
    ] = [true, true, true, true, true, true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes each composite from its exact wire shape and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wires: ReadonlyArray<QueryDataType.Encoded> = [
        { type: "array", subType: { type: "string" } },
        { type: "set", subType: { type: "array", subType: { type: "timestamp" } } },
        { type: "entrySet", keyType: { type: "string" }, valueType: { type: "set", subType: { type: "long" } } },
        { type: "struct", fields: [{ name: "id", fieldType: { type: "string" } }] },
        { type: "union", unionTypes: [{ type: "null" }, { type: "attachment" }] },
        { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" },
        { type: "objectSet" },
        { type: "interfaceObject" },
        { type: "interfaceObjectSet", interfaceTypeApiName: "FooInterface" },
        { type: "typeReference", typeId: "recursive-tree-node" },
        { type: "unsupported", unsupportedType: "optional", params: { wrapped: "string" } },
        { type: "void" },
      ];
      const decoded = yield* Effect.forEach(wires, (wire) => decodeDataType(wire));
      const encoded = yield* Effect.forEach(decoded, (dataType) => encodeDataType(dataType));
      deepStrictEqual(encoded, wires);
      deepStrictEqual(A.map(decoded, tagOf), [
        "array",
        "set",
        "entrySet",
        "struct",
        "union",
        "object",
        "objectSet",
        "interfaceObject",
        "interfaceObjectSet",
        "typeReference",
        "unsupported",
        "void",
      ]);
      const elements = A.map(decoded, (dataType) =>
        QueryDataType.guards.set(dataType) || QueryDataType.guards.array(dataType) ? dataType.elementType.type : "none"
      );
      deepStrictEqual(A.take(elements, 2), ["string", "array"]);
    })
  );

  it("fills absent optional keys with none when a case is constructed", () => {
    const anyObjects = ObjectSetType.make({});
    const anyInterface = InterfaceObjectReferenceType.make({});
    assertNone(anyObjects.objectApiName);
    assertNone(anyObjects.objectTypeApiName);
    assertNone(anyInterface.interfaceTypeApiName);
  });

  it.effect(
    "rejects tags outside the query universe and members missing their payload",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(QueryDataType)({ type: "decimal" }),
        rejects(QueryDataType)({ type: "byte" }),
        rejects(QueryDataType)({ type: "map", keyType: { type: "string" }, valueType: { type: "string" } }),
        rejects(QueryDataType)({ type: "optional", wrappedType: { type: "string" } }),
        rejects(QueryDataType)({ type: "interface", interface: "FooInterface" }),
        rejects(QueryDataType)({ type: "array" }),
        rejects(QueryDataType)({ type: "array", elementType: { type: "string" } }),
        rejects(QueryDataType)({ type: "array", subType: { type: "decimal" } }),
        rejects(QueryDataType)({ type: "struct", fields: [{ name: "", fieldType: { type: "string" } }] }),
        rejects(QueryDataType)({ type: "struct", fields: { id: { type: "string" } } }),
        rejects(QueryDataType)({ type: "union", unionTypes: [null] }),
        rejects(QueryDataType)({ type: "entrySet", keyType: { type: "string" } }),
        rejects(QueryDataType)({ type: "object", objectTypeApiName: "Employee" }),
        rejects(QueryDataType)({ type: "interfaceObjectSet" }),
        rejects(QueryDataType)({ type: "typeReference", typeId: "" }),
        rejects(QueryDataType)({ type: "unsupported" }),
        rejects(QueryDataType)(null),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Nullability
// ---------------------------------------------------------------------------

describe("nonNullAlternative", () => {
  const integer = IntegerType.make({});
  const string = StringType.make({});
  const nothing = NullType.make({});
  const alternativeTag = (dataType: QueryDataType): O.Option<QueryDataTypeKind> =>
    O.map(nonNullAlternative(dataType), tagOf);

  it("reads a two-member union with null as its other member, wherever null is listed", () => {
    assertSome(alternativeTag(unionOf([integer, nothing])), "integer");
    assertSome(alternativeTag(unionOf([nothing, integer])), "integer");
  });

  it("keeps the remaining members as a union when more than one is left", () => {
    const alternative = nonNullAlternative(unionOf([nothing, integer, string, nothing]));
    assertTrue(O.exists(alternative, QueryDataType.guards.union));
    deepStrictEqual(
      O.map(alternative, (dataType) => (QueryDataType.guards.union(dataType) ? A.map(dataType.unionTypes, tagOf) : [])),
      O.some(["integer", "string"])
    );
  });

  it("is none for types that are not a union with null, and for a union of nothing but null", () => {
    assertNone(nonNullAlternative(integer));
    assertNone(nonNullAlternative(nothing));
    assertNone(nonNullAlternative(unionOf([integer, string])));
    assertNone(nonNullAlternative(unionOf([nothing])));
    assertNone(nonNullAlternative(unionOf([nothing, nothing])));
    assertNone(nonNullAlternative(unionOf([])));
    assertNone(nonNullAlternative(QueryArrayType.make({ elementType: unionOf([integer, nothing]) })));
  });

  it("reads nested unions at their own level only", () => {
    const nested = unionOf([unionOf([integer, nothing]), string]);
    assertNone(nonNullAlternative(nested));
    assertSome(alternativeTag(unionOf([unionOf([integer, nothing]), nothing])), "union");
  });

  it.prop(
    "never returns null itself, and returns something only for a union that lists null",
    [Arbitrary.schema(QueryDataType)],
    ([dataType]) =>
      O.match(nonNullAlternative(dataType), {
        onNone: () => true,
        onSome: (alternative) =>
          !QueryDataType.guards.null(alternative) &&
          QueryDataType.guards.union(dataType) &&
          A.some(dataType.unionTypes, QueryDataType.guards.null),
      }),
    { arbitrary: fcRuns(100) }
  );
});

// ---------------------------------------------------------------------------
// Query types
// ---------------------------------------------------------------------------

describe("QueryType", () => {
  lawful("QueryParameter", QueryParameter);
  lawful("QueryType", QueryType);

  const roundTrips = (name: string, fixture: typeof QueryType.Encoded): void => {
    it.effect(
      `${name}: decodes the wire fixture and encodes it back unchanged`,
      Effect.fnUntraced(function* () {
        const decoded = yield* decodeQueryType(fixture);
        const encoded = yield* encodeQueryType(decoded);
        deepStrictEqual(encoded, fixture);
      })
    );
  };

  roundTrips("incrementPersonAgeComplex", complexStructFixture);
  roundTrips("queryReturnsRecursiveStruct", recursiveStructFixture);
  roundTrips("twoDimensionalAggregationFunction", twoDimensionalFixture);
  roundTrips("threeDimensionalAggregationFunction", threeDimensionalFixture);
  roundTrips("queryAcceptsObjectSets", objectSetFixture);
  roundTrips("queryTypeReturnsMap", entrySetFixture);
  roundTrips("queryAcceptsInterface", interfaceFixture);

  it.effect(
    "decodes a struct parameter with an optional field and an object reference into the domain value",
    Effect.fnUntraced(function* () {
      const person = QueryStructType.make({
        fields: [
          fieldNamed("firstName", StringType.make({})),
          fieldNamed("lastName", StringType.make({})),
          fieldNamed("age", unionOf([IntegerType.make({}), NullType.make({})])),
          fieldNamed("object", ObjectReferenceType.make({ objectApiName: employee, objectTypeApiName: employee })),
        ],
      });
      const expected = QueryType.make({
        apiName: QueryApiName.make("incrementPersonAgeComplex"),
        displayName: O.some("incrementAgeComplex"),
        parameters: R.singleton(ParameterId.make("person"), QueryParameter.make({ dataType: person, required: true })),
        output: person,
        rid: FunctionRid.make("ri.function-registry.main.function.b2ae7b3e-2c89-42f5-a762-68957a9c039d"),
        version: FunctionVersion.make("0.0.9"),
      });
      const decoded = yield* decodeQueryType(complexStructFixture);
      assertTrue(queryTypeEquivalence(decoded, expected));
      assertNone(decoded.description);
      deepStrictEqual(R.keys(decoded.parameters), ["person"]);
      const optionalFields = QueryDataType.guards.struct(decoded.output)
        ? A.map(decoded.output.fields, (field) =>
            O.match(nonNullAlternative(field.fieldType), {
              onNone: () => `${field.name}: ${field.fieldType.type}`,
              onSome: (alternative) => `${field.name}?: ${alternative.type}`,
            })
          )
        : [];
      deepStrictEqual(optionalFields, ["firstName: string", "lastName: string", "age?: integer", "object: object"]);
    })
  );

  it.effect(
    "resolves a recursive type reference one level at a time, in both call styles",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeQueryType(recursiveStructFixture);
      const node = referenceTo("recursive-tree-node");
      assertTrue(dataTypeEquivalence(decoded.output, node));
      const resolved = resolveTypeReference(decoded, node);
      assertTrue(O.exists(resolved, QueryDataType.guards.struct));
      deepStrictEqual(pipe(decoded, resolveTypeReference(node), O.map(tagOf)), O.some("struct"));
      const childElement = pipe(
        resolved,
        O.filter(QueryDataType.guards.struct),
        O.flatMap((struct) => A.last(struct.fields)),
        O.map((field) => field.fieldType),
        O.filter(QueryDataType.guards.array),
        O.map((array) => array.elementType),
        O.filter(QueryDataType.guards.typeReference)
      );
      assertTrue(O.exists(childElement, (reference) => dataTypeEquivalence(reference, node)));
      const again = O.flatMap(childElement, (reference) => resolveTypeReference(decoded, reference));
      assertTrue(O.exists(again, (dataType) => O.exists(resolved, (first) => dataTypeEquivalence(dataType, first))));
      assertNone(resolveTypeReference(decoded, referenceTo("forest")));
      assertNone(pipe(decoded, resolveTypeReference(referenceTo("forest"))));
    })
  );

  it.effect(
    "decodes aggregation outputs with their key, range bound and value types",
    Effect.fnUntraced(function* () {
      const flat = yield* decodeQueryType(twoDimensionalFixture);
      const nested = yield* decodeQueryType(threeDimensionalFixture);
      const expectedFlat = TwoDimensionalAggregationType.make({
        keyType: QueryAggregationKeyType.cases.string.make({}),
        valueType: QueryAggregationValueType.cases.double.make({}),
      });
      const expectedNested = ThreeDimensionalAggregationType.make({
        keyType: QueryAggregationKeyType.cases.string.make({}),
        valueType: NestedAggregationType.make({
          keyType: QueryAggregationRangeKeyType.make({ boundType: QueryAggregationBoundType.cases.timestamp.make({}) }),
          valueType: QueryAggregationValueType.cases.double.make({}),
        }),
      });
      assertTrue(dataTypeEquivalence(flat.output, expectedFlat));
      assertTrue(dataTypeEquivalence(nested.output, expectedNested));
      strictEqual(R.size(flat.parameters), 0);
      strictEqual(flat.version, "0.11.0");
    })
  );

  it.effect(
    "decodes object set, entry set and interface types with their api names",
    Effect.fnUntraced(function* () {
      const objectSets = yield* decodeQueryType(objectSetFixture);
      const maps = yield* decodeQueryType(entrySetFixture);
      const interfaces = yield* decodeQueryType(interfaceFixture);
      assertSome(objectSets.description, "description of the query that takes objectSet types");
      assertTrue(
        dataTypeEquivalence(
          objectSets.output,
          ObjectSetType.make({ objectApiName: O.some(employee), objectTypeApiName: O.some(employee) })
        )
      );
      assertTrue(
        dataTypeEquivalence(
          maps.output,
          EntrySetType.make({
            keyType: ObjectReferenceType.make({ objectApiName: employee, objectTypeApiName: employee }),
            valueType: QueryDataType.cases.float.make({}),
          })
        )
      );
      assertNone(maps.displayName);
      assertTrue(
        dataTypeEquivalence(
          interfaces.output,
          InterfaceObjectReferenceType.make({ interfaceTypeApiName: O.some(InterfaceTypeApiName.make("FooInterface")) })
        )
      );
      deepStrictEqual(
        A.map(R.values(interfaces.parameters), (parameter) => parameter.required),
        [true]
      );
    })
  );

  it("defaults parameters and type references to empty when a query type is constructed", () => {
    const constructed = QueryType.make({
      apiName: QueryApiName.make("returnsTimestamp"),
      output: QueryDataType.cases.timestamp.make({}),
      rid: FunctionRid.make("ri.function-registry.main.function.b2ae7b3e-2c89-42f5-a762-68957a9c039d"),
      version: FunctionVersion.make("0.0.9"),
    });
    strictEqual(R.size(constructed.parameters), 0);
    strictEqual(R.size(constructed.typeReferences), 0);
    assertNone(constructed.description);
    assertNone(constructed.displayName);
  });

  it.effect(
    "defaults absent type references to empty on decode, and always writes them on encode",
    Effect.fnUntraced(function* () {
      const withoutReferences: typeof QueryType.Encoded = {
        apiName: "returnsDate",
        displayName: "returnsDate",
        parameters: {},
        output: { type: "date" },
        rid: "ri.function-registry.main.function.b2ae7b3e-2c89-42f5-a762-68957a9c039d",
        version: "0.0.9",
      };
      const decoded = yield* decodeQueryType(withoutReferences);
      strictEqual(R.size(decoded.typeReferences), 0);
      const encoded = yield* encodeQueryType(decoded);
      deepStrictEqual(encoded, { ...withoutReferences, typeReferences: {} });
    })
  );

  it.effect(
    "has no latest version, and rejects signatures missing what the wire requires",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(QueryType)({ ...twoDimensionalFixture, version: "latest" }),
        rejects(QueryType)({ ...twoDimensionalFixture, version: "" }),
        rejects(QueryType)({ ...twoDimensionalFixture, version: "1.2" }),
        rejects(QueryType)({ ...twoDimensionalFixture, apiName: "" }),
        rejects(QueryType)({ ...twoDimensionalFixture, rid: "" }),
        rejects(QueryType)({ ...twoDimensionalFixture, output: { type: "decimal" } }),
        rejects(QueryType)({ ...twoDimensionalFixture, parameters: { n: { dataType: { type: "integer" } } } }),
        rejects(QueryType)({ ...twoDimensionalFixture, typeReferences: { node: { type: "reference" } } }),
        rejects(QueryParameter)({ dataType: { type: "string" } }),
        rejects(QueryParameter)({ required: true }),
        rejects(QueryParameter)({ dataType: { type: "string" }, required: "true" }),
      ]);
      assertTrue(A.every(verdicts, identity));
      const accepted = yield* Effect.all([
        rejects(QueryType)({ ...twoDimensionalFixture, version: "1.2.3-rc1" }),
        rejects(QueryType)(twoDimensionalFixture),
      ]);
      deepStrictEqual(accepted, [false, false]);
    })
  );
});

// ---------------------------------------------------------------------------
// Aggregation values
// ---------------------------------------------------------------------------

describe("aggregation values", () => {
  // An aggregation value read without its type descriptor holds each key, bound and measure as the wire scalar that
  // carries it, so these schemas keep the strict law like every other.
  lawful("QueryRange", QueryRange);
  lawful("QueryAggregationKey", QueryAggregationKey);
  lawful("QueryAggregationGroup", QueryAggregationGroup);
  lawful("NestedQueryAggregationGroup", NestedQueryAggregationGroup);
  lawful("TwoDimensionalAggregation", TwoDimensionalAggregation);
  lawful("ThreeDimensionalAggregation", ThreeDimensionalAggregation);

  it("has optional bounds on the wire and options of scalars in the domain", () => {
    const facts: readonly [
      Equals<QueryRange["startValue"], O.Option<ScalarValue>>,
      Equals<QueryRange["endValue"], O.Option<ScalarValue>>,
      Equals<QueryAggregationKey, ScalarValue | QueryRange>,
      Equals<QueryAggregationGroup["value"], ScalarValue>,
      Equals<
        typeof QueryRange.Encoded,
        { readonly startValue?: string | number | boolean; readonly endValue?: string | number | boolean }
      >,
    ] = [true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes a two-dimensional aggregation from its groups envelope and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof TwoDimensionalAggregation.Encoded = {
        groups: [
          { key: "Q-AFN", value: 1 },
          { key: "Q-AFO", value: 2 },
        ],
      };
      const decoded = yield* S.decodeEffect(TwoDimensionalAggregation)(wire);
      deepStrictEqual(
        A.map(decoded.groups, (group) => [group.key, group.value]),
        [
          ["Q-AFN", 1],
          ["Q-AFO", 2],
        ]
      );
      const encoded = yield* S.encodeEffect(TwoDimensionalAggregation)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes a three-dimensional aggregation with a range key and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof ThreeDimensionalAggregation.Encoded = {
        groups: [
          {
            key: "Q-AFN",
            groups: [{ key: { startValue: "2010-10-01T00:00:00Z", endValue: "2010-10-02T00:00:00Z" }, value: 65.0 }],
          },
          { key: "Q-AFO", groups: [] },
        ],
      };
      const decoded = yield* S.decodeEffect(ThreeDimensionalAggregation)(wire);
      deepStrictEqual(
        A.map(decoded.groups, (outer) => [outer.key, outer.groups.length]),
        [
          ["Q-AFN", 1],
          ["Q-AFO", 0],
        ]
      );
      const innerKeys = A.flatMap(decoded.groups, (outer) => A.map(outer.groups, (inner) => inner.key));
      const ranges = A.filter(innerKeys, S.is(QueryRange));
      strictEqual(ranges.length, 1);
      deepStrictEqual(
        A.map(ranges, (range) => [range.startValue, range.endValue]),
        [[O.some("2010-10-01T00:00:00Z"), O.some("2010-10-02T00:00:00Z")]]
      );
      const encoded = yield* S.encodeEffect(ThreeDimensionalAggregation)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "keeps an absent bound absent in both directions",
    Effect.fnUntraced(function* () {
      const openBelow: typeof QueryRange.Encoded = { endValue: 10 };
      const openAbove: typeof QueryRange.Encoded = { startValue: "2010-10-01" };
      const decoded = yield* Effect.forEach([openBelow, openAbove], (wire) => decodeRange(wire));
      deepStrictEqual(
        A.map(decoded, (range) => [range.startValue, range.endValue]),
        [
          [O.none(), O.some(10)],
          [O.some("2010-10-01"), O.none()],
        ]
      );
      const encoded = yield* Effect.forEach(decoded, (range) => encodeRange(range));
      deepStrictEqual(encoded, [openBelow, openAbove]);
    })
  );

  it.effect(
    "holds a rich bound as the wire scalar its codec writes, and refuses the rich value itself",
    Effect.fnUntraced(function* () {
      const long = yield* S.encodeEffect(LongValue)(BigInt("58319870951433"));
      const range = QueryRange.make({ startValue: O.some(long), endValue: O.some(3.5) });
      const encoded = yield* encodeRange(range);
      deepStrictEqual(encoded, { startValue: "58319870951433", endValue: 3.5 });
      const decoded = yield* decodeRange(encoded);
      assertTrue(S.toEquivalence(QueryRange)(decoded, range));
      const richBound = O.some(BigInt("58319870951433"));
      // @ts-expect-error a 64-bit bound is the text it travels as, not a bigint
      assertNone(QueryRange.makeOption({ startValue: richBound, endValue: O.some(3.5) }));
    })
  );

  it.effect(
    "rejects a range without bounds, on decode and on construction",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(QueryRange)({}),
        rejects(QueryRange)({ startValue: null }),
        rejects(QueryRange)({ startValue: { nested: true } }),
        rejects(QueryAggregationKey)({}),
        rejects(QueryAggregationKey)(null),
        rejects(QueryAggregationGroup)({ key: {}, value: 1 }),
        rejects(QueryAggregationGroup)({ key: "Q-AFN" }),
        rejects(QueryAggregationGroup)({ key: "Q-AFN", value: { startValue: 1 } }),
        rejects(TwoDimensionalAggregation)([{ key: "Q-AFN", value: 1 }]),
        rejects(ThreeDimensionalAggregation)({ groups: [{ key: "Q-AFN", value: 1 }] }),
      ]);
      assertTrue(A.every(verdicts, identity));
      assertNone(QueryRange.makeOption({}));
      assertFalse(S.is(QueryRange)({ startValue: O.none(), endValue: O.none() }));
      assertTrue(S.is(QueryRange)({ startValue: O.none(), endValue: O.some(1) }));
    })
  );
});

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

describe("query execution", () => {
  lawful("ExecuteQueryRequest", ExecuteQueryRequest);
  lawful("ExecuteQueryResponse", ExecuteQueryResponse);
  lawful("QueryStreamData", QueryStreamData);
  lawful("QueryStreamFailure", QueryStreamFailure);
  lawful("QueryStreamEvent", QueryStreamEvent);
  lawful("QueryTypeByRid", QueryTypeByRid);
  lawful("GetQueryTypesByRidRequest", GetQueryTypesByRidRequest);
  lawful("GetQueryTypesByRidResponse", GetQueryTypesByRidResponse);

  it.effect(
    "carries arguments as JSON keyed by parameter, and tells a null argument from an absent one",
    Effect.fnUntraced(function* () {
      const wire: typeof ExecuteQueryRequest.Encoded = {
        parameters: {
          aggFunction: {
            groups: [
              { key: "testKey1", value: 1 },
              { key: "testKey2", value: 2 },
            ],
          },
          people: ["Brad", "George", "Ryan"],
          nickname: null,
        },
      };
      const decoded = yield* S.decodeEffect(ExecuteQueryRequest)(wire);
      deepStrictEqual(R.keys(decoded.parameters), ["aggFunction", "people", "nickname"]);
      assertSome(R.get(decoded.parameters, ParameterId.make("nickname")), null);
      assertNone(R.get(decoded.parameters, ParameterId.make("age")));
      const encoded = yield* S.encodeEffect(ExecuteQueryRequest)(decoded);
      deepStrictEqual(encoded, wire);
      strictEqual(R.size(ExecuteQueryRequest.make({}).parameters), 0);
    })
  );

  it.effect(
    "drops an entry whose key is not a parameter identifier instead of failing the whole record",
    Effect.fnUntraced(function* () {
      // A record keyed by a refined string keeps only the properties whose key satisfies the refinement.
      const decoded = yield* S.decodeEffect(ExecuteQueryRequest)({ parameters: { "": 1, n: 2 } });
      deepStrictEqual(R.keys(decoded.parameters), ["n"]);
    })
  );

  it.effect(
    "returns JSON that the output's own codec then decodes",
    Effect.fnUntraced(function* () {
      const wire: typeof ExecuteQueryResponse.Encoded = {
        value: {
          groups: [
            {
              key: "Q-AFN",
              groups: [{ key: { startValue: "2010-10-01T00:00:00Z", endValue: "2010-10-02T00:00:00Z" }, value: 65.0 }],
            },
            { key: "Q-AFO", groups: [] },
          ],
        },
      };
      const response = yield* S.decodeEffect(ExecuteQueryResponse)(wire);
      const aggregation = yield* S.decodeUnknownEffect(ThreeDimensionalAggregation)(response.value);
      deepStrictEqual(
        A.map(aggregation.groups, (outer) => outer.groups.length),
        [1, 0]
      );
      const encoded = yield* S.encodeEffect(ExecuteQueryResponse)(response);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes both stream events from their exact wire shape and encodes them back unchanged",
    Effect.fnUntraced(function* () {
      const data: typeof QueryStreamEvent.Encoded = { type: "data", value: ["Pitt", "Clooney", "Reynolds"] };
      const failure: typeof QueryStreamEvent.Encoded = {
        type: "error",
        errorCode: "INVALID_ARGUMENT",
        errorName: "QueryRuntimeError",
        errorInstanceId: "b2ae7b3e-2c89-42f5-a762-68957a9c039d",
        parameters: { functionRid: "ri.function-registry.main.function.9b55870a-63c7-4d48-8f06-9627c0805968" },
      };
      const decoded = yield* Effect.forEach([data, failure], (wire) => decodeStreamEvent(wire));
      const summarize = QueryStreamEvent.match({
        data: ({ value }) => `data:${A.isArray(value) ? value.length : 0}`,
        error: ({ errorName, errorDescription }) => `error:${errorName}:${O.isSome(errorDescription)}`,
      });
      deepStrictEqual(A.map(decoded, summarize), ["data:3", "error:QueryRuntimeError:false"]);
      const encoded = yield* Effect.forEach(decoded, (event) => encodeStreamEvent(event));
      deepStrictEqual(encoded, [data, failure]);
    })
  );

  it("constructs both stream event cases and exercises their guards", () => {
    const batch = QueryStreamEvent.cases.data.make({ value: 1 });
    const failure = QueryStreamEvent.cases.error.make({
      errorCode: "INTERNAL",
      errorName: "QueryRuntimeError",
      errorInstanceId: "b2ae7b3e-2c89-42f5-a762-68957a9c039d",
    });
    assertTrue(QueryStreamEvent.guards.data(batch));
    assertTrue(QueryStreamEvent.guards.error(failure));
    assertFalse(QueryStreamEvent.guards.data(failure));
    assertTrue(QueryStreamEvent.isAnyOf(["error"])(failure));
    deepStrictEqual(QueryStreamEvent.discriminants, ["data", "error"]);
    assertNone(failure.errorDescription);
    strictEqual(R.size(failure.parameters), 0);
  });

  it.effect(
    "asks for the latest signature by leaving the version out",
    Effect.fnUntraced(function* () {
      const wire: typeof GetQueryTypesByRidRequest.Encoded = {
        requests: [
          {
            queryTypeRid: "ri.function-registry.main.function.9b55870a-63c7-4d48-8f06-9627c0805968",
            functionVersion: "0.11.0",
          },
          { queryTypeRid: "ri.function-registry.main.function.c3e58d52-8430-44ee-9f0b-3785d9a9bdd2" },
        ],
      };
      const decoded = yield* S.decodeEffect(GetQueryTypesByRidRequest)(wire);
      deepStrictEqual(
        A.map(decoded.requests, (request) => request.functionVersion),
        [O.some(FunctionVersion.make("0.11.0")), O.none()]
      );
      const encoded = yield* S.encodeEffect(GetQueryTypesByRidRequest)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "returns found signatures as query types",
    Effect.fnUntraced(function* () {
      const wire: typeof GetQueryTypesByRidResponse.Encoded = { data: [twoDimensionalFixture, entrySetFixture] };
      const decoded = yield* S.decodeEffect(GetQueryTypesByRidResponse)(wire);
      deepStrictEqual(
        A.map(decoded.data, (queryType) => queryType.apiName),
        ["twoDimensionalAggregationFunction", "queryTypeReturnsMap"]
      );
      const encoded = yield* S.encodeEffect(GetQueryTypesByRidResponse)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "rejects malformed execution messages",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(ExecuteQueryRequest)({}),
        rejects(ExecuteQueryRequest)({ parameters: [] }),
        rejects(ExecuteQueryResponse)({}),
        rejects(QueryStreamEvent)({ type: "done" }),
        rejects(QueryStreamEvent)({ type: "data" }),
        rejects(QueryStreamEvent)({ type: "error", errorCode: "INTERNAL", errorName: "QueryRuntimeError" }),
        rejects(QueryTypeByRid)({ functionVersion: "0.11.0" }),
        rejects(QueryTypeByRid)({ queryTypeRid: "ri.function-registry.main.function.x", functionVersion: "latest" }),
        rejects(GetQueryTypesByRidRequest)({ requests: {} }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
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
      SameType<ThreeDimensionalAggregationType["valueType"], NestedAggregationType>,
    ] = [true];
    assertTrue(A.every(facts, (fact) => fact));
  });
});
