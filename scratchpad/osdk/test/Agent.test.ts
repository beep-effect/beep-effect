import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import {
  AgentApiName,
  AgentApiNameIdentifier,
  AgentArgumentName,
  AgentConsistencyKey,
  AgentContextItem,
  AgentContextItemDefinition,
  AgentContextItemId,
  AgentContextItemType,
  AgentDataType,
  AgentDataTypeKind,
  AgentDefinition,
  AgentDiscriminatedUnionType,
  AgentEvent,
  AgentEventAccepted,
  AgentEventDefinition,
  AgentEventId,
  AgentEventResult,
  AgentEventTimeout,
  AgentEventType,
  AgentIdentifier,
  AgentListType,
  AgentNullableType,
  AgentObjectReference,
  AgentObjectSetType,
  AgentObjectType,
  AgentParameter,
  AgentRecordType,
  AgentReference,
  AgentRid,
  AgentSession,
  AgentSessionId,
  AgentSessionNotReady,
  AgentSessionState,
  AgentSessionStatus,
  AgentSessionStatusFromRecord,
  AgentState,
  AgentStateBehind,
  AgentStateNotReady,
  AgentStateResponse,
  AgentStateTimeout,
  AgentStructField,
  AgentStructType,
  AgentUnionMember,
  AgentVersion,
  argumentsCodec,
  CreateAgentSessionRequest,
  defaultPollInterval,
  defaultPollTimeout,
  fieldCodec,
  isTerminal,
  SendAgentEventRequest,
  SendAgentEventResponse,
  valueCodec,
} from "../src/Agent/index.ts";
import {
  BooleanType,
  DateType,
  DoubleType,
  FloatType,
  IntegerType,
  LongType,
  ShortType,
  StringType,
  TimestampType,
} from "../src/DataType/index.ts";
import {
  ObjectTypeApiName,
  OntologyApiName,
  OntologyRid,
  PrincipalId,
  PropertyApiName,
} from "../src/Identifier/index.ts";
import { LongValue } from "../src/Value/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by the named schemas
// ---------------------------------------------------------------------------

const generates = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const is = S.is(schema);

  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });
};

const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  generates(name, schema);

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

const accepts =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isSuccess);

const failureOf = <T>(effect: Effect.Effect<T, S.SchemaError>): Effect.Effect<string, T> =>
  Effect.map(Effect.flip(effect), (error) => error.message);

// Whether decoding a wire value with a projected codec fails with a message that contains the given text.
const failsWith = Effect.fnUntraced(function* (codec: S.Codec<unknown, unknown>, wire: unknown, text: string) {
  const exit = yield* Effect.exit(S.decodeUnknownEffect(codec)(wire));
  return O.exists(Exit.findErrorOption(exit), (error) => Str.includes(text)(error.message));
});

// Decodes a wire value with a projected codec and encodes the result back.
const throughCodec = Effect.fnUntraced(function* (codec: S.Codec<unknown, unknown>, wire: unknown) {
  const decoded = yield* S.decodeUnknownEffect(codec)(wire);
  const encoded = yield* S.encodeUnknownEffect(codec)(decoded);
  return { decoded, encoded };
});

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

// ---------------------------------------------------------------------------
// Fixtures: literal values from the platform's own documentation of the agents wire
// ---------------------------------------------------------------------------

const ontologyRid = "ri.ontology.main.ontology.def0ca71-bafa-4a0b-9575-5174961ac9d2";
const objectSetRid = "ri.object-set.main.object-set.082ecf59-4302-4a75-9283-810166df1900";
const agentRid = "ri.agents.main.agent.2f3c2b1e-90a7-4a56-8f3d-5a0c0d1e7b42";
const publisher = "f05f8da4-b84c-4fca-9c77-8af0b13d11de";
const eventId = "0b7f1b0e-6a52-4d4f-9a53-0c1f2f6a9d11";

const crm = OntologyApiName.make("crm");
const customer = ObjectTypeApiName.make("Customer");
const triage = AgentApiName.make("triage");
const version = AgentVersion.make("1.2.0");
const sessionId = AgentSessionId.make("session-1");
const consistencyKey = AgentConsistencyKey.make("ck-17");
const userMessage = AgentEventType.make("userMessage");

const booleanType = BooleanType.make({});
const integerType = IntegerType.make({});
const longType = LongType.make({});
const doubleType = DoubleType.make({});
const stringType = StringType.make({});
const timestampType = TimestampType.make({});

const field = (name: string, dataType: AgentDataType): AgentStructField => AgentStructField.make({ name, dataType });

const parameter = (name: string, dataType: AgentDataType): AgentParameter =>
  AgentParameter.make({ name: AgentArgumentName.make(name), dataType });

const nullable = (wrappedType: AgentDataType): AgentNullableType => AgentNullableType.make({ wrappedType });

const list = (elementType: AgentDataType): AgentListType => AgentListType.make({ elementType });

const struct = (fields: ReadonlyArray<AgentStructField>): AgentStructType => AgentStructType.make({ fields });

const customerType = AgentObjectType.make({ ontologyApiName: crm, objectTypeApiName: customer });

const customerSetType = AgentObjectSetType.make({ ontologyApiName: crm, objectTypeApiName: customer });

// The platform's example of a struct value is `{ "entityType": "customer", "id": 123 }`.
const entityStruct = struct([field("entityType", stringType), field("id", integerType)]);

// The platform's examples of union values are `{ "type": "customer", "customerId": 123 }` and
// `{ "type": "employee", "employeeId": "1ff8ceda-7354-4aea-8412-a7434164aca9" }`.
const partyUnion = AgentDiscriminatedUnionType.make({
  discriminatorKey: "type",
  members: [
    AgentUnionMember.make({ discriminatorValue: "customer", fields: [field("customerId", integerType)] }),
    AgentUnionMember.make({ discriminatorValue: "employee", fields: [field("employeeId", stringType)] }),
  ],
});

const partyUnionWire: AgentDataType.Encoded = {
  type: "discriminatedUnion",
  discriminatorKey: "type",
  members: [
    { discriminatorValue: "customer", fields: [{ name: "customerId", dataType: { type: "integer" } }] },
    { discriminatorValue: "employee", fields: [{ name: "employeeId", dataType: { type: "string" } }] },
  ],
};

// One exact wire record and its domain value for every case of the data type union. The mapped type makes the
// table total: a seventeenth case would not compile until it has a row.
const dataTypePerCase: {
  readonly [K in AgentDataTypeKind]: readonly [wire: AgentDataType.Encoded, domain: AgentDataType];
} = {
  boolean: [{ type: "boolean" }, booleanType],
  short: [{ type: "short" }, ShortType.make({})],
  integer: [{ type: "integer" }, integerType],
  long: [{ type: "long" }, longType],
  float: [{ type: "float" }, FloatType.make({})],
  double: [{ type: "double" }, doubleType],
  string: [{ type: "string" }, stringType],
  date: [{ type: "date" }, DateType.make({})],
  timestamp: [{ type: "timestamp" }, timestampType],
  nullable: [{ type: "nullable", wrappedType: { type: "string" } }, nullable(stringType)],
  list: [{ type: "list", elementType: { type: "integer" } }, list(integerType)],
  record: [{ type: "record", valueType: { type: "double" } }, AgentRecordType.make({ valueType: doubleType })],
  struct: [
    {
      type: "struct",
      fields: [
        { name: "entityType", dataType: { type: "string" } },
        { name: "id", dataType: { type: "integer" } },
      ],
    },
    entityStruct,
  ],
  discriminatedUnion: [partyUnionWire, partyUnion],
  object: [{ type: "object", ontologyApiName: "crm", objectTypeApiName: "Customer" }, customerType],
  objectSet: [{ type: "objectSet", ontologyApiName: "crm", objectTypeApiName: "Customer" }, customerSetType],
};

const customerReferenceWire = {
  ontologyRid,
  objectTypeApiName: "Customer",
  primaryKey: { customerId: 123 },
};

// One data type, one wire value of it and the canonical wire form that value encodes back to, for every case.
const valuePerCase: {
  readonly [K in AgentDataTypeKind]: readonly [dataType: AgentDataType, wire: unknown, canonical: unknown];
} = {
  boolean: [booleanType, true, true],
  short: [ShortType.make({}), 7, 7],
  integer: [integerType, 42, 42],
  long: [longType, "9007199254740993", "9007199254740993"],
  float: [FloatType.make({}), 1.5, 1.5],
  double: [doubleType, 2.25, 2.25],
  string: [stringType, "hello", "hello"],
  date: [DateType.make({}), "2024-05-01", "2024-05-01"],
  timestamp: [timestampType, "2021-01-04T05:00:00Z", "2021-01-04T05:00:00.000Z"],
  nullable: [nullable(stringType), null, null],
  list: [list(integerType), [1, 2, 3], [1, 2, 3]],
  record: [AgentRecordType.make({ valueType: integerType }), { first: 1, second: 2 }, { first: 1, second: 2 }],
  struct: [entityStruct, { entityType: "customer", id: 123 }, { entityType: "customer", id: 123 }],
  discriminatedUnion: [partyUnion, { type: "customer", customerId: 123 }, { type: "customer", customerId: 123 }],
  object: [customerType, customerReferenceWire, customerReferenceWire],
  objectSet: [customerSetType, objectSetRid, objectSetRid],
};

const definitionWire: (typeof AgentDefinition)["Encoded"] = {
  version: "1.2.0",
  createdTime: "2026-03-04T05:06:07.000Z",
  createdBy: publisher,
  argumentDefinitions: [
    { name: "customer", dataType: { type: "object", ontologyApiName: "crm", objectTypeApiName: "Customer" } },
    { name: "note", dataType: { type: "nullable", wrappedType: { type: "string" } } },
  ],
  eventDefinitions: [{ eventType: "userMessage", payloadType: { type: "string" } }],
  agentStateType: { type: "struct", fields: [{ name: "summary", dataType: { type: "string" } }] },
  contextItemDefinitions: [
    { contextItemType: "toolCall", dataType: { type: "record", valueType: { type: "string" } } },
  ],
};

const definition = AgentDefinition.make({
  version,
  createdTime: DateTime.makeUnsafe("2026-03-04T05:06:07.000Z"),
  createdBy: PrincipalId.make(publisher),
  argumentDefinitions: [parameter("customer", customerType), parameter("note", nullable(stringType))],
  eventDefinitions: [AgentEventDefinition.make({ eventType: userMessage, payloadType: stringType })],
  agentStateType: struct([field("summary", stringType)]),
  contextItemDefinitions: [
    AgentContextItemDefinition.make({
      contextItemType: AgentContextItemType.make("toolCall"),
      dataType: AgentRecordType.make({ valueType: stringType }),
    }),
  ],
});

const sessionStateWire: (typeof AgentSessionState)["Encoded"] = {
  type: "available",
  arguments: { customerId: 123, note: null },
  consistencyKey: "ck-17",
  agentState: { data: { summary: "open" } },
  contextItems: {
    "item-1": { contextItemType: "userMessage", data: "hello" },
    "item-2": { contextItemType: "toolCall", data: { tool: "lookup", attempts: 2 } },
  },
  contextItemOrder: ["item-2", "item-1"],
  status: { type: "live" },
};

const sessionState = AgentSessionState.make({
  arguments: R.fromEntries([
    [AgentArgumentName.make("customerId"), 123],
    [AgentArgumentName.make("note"), null],
  ]),
  consistencyKey,
  agentState: AgentState.make({ data: { summary: "open" } }),
  contextItems: R.fromEntries([
    [
      AgentContextItemId.make("item-1"),
      AgentContextItem.make({ contextItemType: AgentContextItemType.make("userMessage"), data: "hello" }),
    ],
    [
      AgentContextItemId.make("item-2"),
      AgentContextItem.make({
        contextItemType: AgentContextItemType.make("toolCall"),
        data: { tool: "lookup", attempts: 2 },
      }),
    ],
  ]),
  contextItemOrder: [AgentContextItemId.make("item-2"), AgentContextItemId.make("item-1")],
  status: "live",
});

const event = AgentEvent.make({
  id: AgentEventId.make(eventId),
  eventType: userMessage,
  payload: { text: "hello", attachments: [1, 2] },
});

const eventWire: (typeof AgentEvent)["Encoded"] = {
  id: eventId,
  eventType: "userMessage",
  payload: { text: "hello", attachments: [1, 2] },
};

const address = AgentApiNameIdentifier.make({ ontology: OntologyRid.make(ontologyRid), agentApiName: triage });

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

describe("identifiers", () => {
  lawful("AgentApiName", AgentApiName);
  lawful("AgentRid", AgentRid);
  lawful("AgentVersion", AgentVersion);
  lawful("AgentSessionId", AgentSessionId);
  lawful("AgentArgumentName", AgentArgumentName);
  lawful("AgentEventType", AgentEventType);
  lawful("AgentEventId", AgentEventId);
  lawful("AgentContextItemType", AgentContextItemType);
  lawful("AgentContextItemId", AgentContextItemId);
  lawful("AgentConsistencyKey", AgentConsistencyKey);

  it.effect(
    "every identifier rejects the empty string",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(AgentApiName)(""),
        rejects(AgentRid)(""),
        rejects(AgentVersion)(""),
        rejects(AgentSessionId)(""),
        rejects(AgentArgumentName)(""),
        rejects(AgentEventType)(""),
        rejects(AgentEventId)(""),
        rejects(AgentContextItemType)(""),
        rejects(AgentContextItemId)(""),
        rejects(AgentConsistencyKey)(""),
        rejects(PrincipalId)(""),
      ]);
      strictEqual(A.length(verdicts), 11);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "AgentVersion accepts the documented forms and rejects anything else",
    Effect.fnUntraced(function* () {
      const accepted = yield* Effect.forEach(["1.2.3", "1.2.3-rc1", "0.0.0", "10.20.30-beta.2"], accepts(AgentVersion));
      assertTrue(A.every(accepted, identity));
      const rejected = yield* Effect.forEach(["latest", "1.2", "1.2.3-", "v1.2.3", "1.2.3 "], rejects(AgentVersion));
      assertTrue(A.every(rejected, identity));
      const message = yield* failureOf(S.decodeEffect(AgentVersion)("latest"));
      strictEqual(message, "Expected an agent version such as 1.2.3 or 1.2.3-rc1");
    })
  );
});

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

describe("AgentDataType", () => {
  lawful("AgentDataTypeKind", AgentDataTypeKind);
  lawful("AgentNullableType", AgentNullableType);
  lawful("AgentListType", AgentListType);
  lawful("AgentRecordType", AgentRecordType);
  lawful("AgentStructField", AgentStructField);
  lawful("AgentStructType", AgentStructType);
  lawful("AgentUnionMember", AgentUnionMember);
  lawful("AgentDiscriminatedUnionType", AgentDiscriminatedUnionType);
  lawful("AgentObjectType", AgentObjectType);
  lawful("AgentObjectSetType", AgentObjectSetType);
  lawful("AgentDataType", AgentDataType);

  it("has the wire's 16 tags: nine scalars, a nullable wrapper, three containers, a union and two references", () => {
    const tags: ReadonlyArray<string> = AgentDataTypeKind.literals;
    deepStrictEqual(tags, [
      "boolean",
      "short",
      "integer",
      "long",
      "float",
      "double",
      "string",
      "date",
      "timestamp",
      "nullable",
      "list",
      "record",
      "struct",
      "discriminatedUnion",
      "object",
      "objectSet",
    ]);
    const kindIsTheTagOfTheUnion: Equals<AgentDataType["type"], AgentDataTypeKind> = true;
    assertTrue(kindIsTheTagOfTheUnion);
  });

  it.effect(
    "decodes the exact wire record of every case and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(
        AgentDataTypeKind.literals,
        Effect.fnUntraced(function* (kind) {
          const [wire, expected] = dataTypePerCase[kind];
          const decoded = yield* S.decodeEffect(AgentDataType)(wire);
          const encoded = yield* S.encodeEffect(AgentDataType)(decoded);
          deepStrictEqual(encoded, wire);
          const fromDomain = yield* S.encodeEffect(AgentDataType)(expected);
          deepStrictEqual(fromDomain, wire);
          return decoded.type === kind && S.toEquivalence(AgentDataType)(decoded, expected);
        })
      );
      strictEqual(A.length(verdicts), 16);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it("reaches every case through its member schema, its guard and the exhaustive matcher", () => {
    const tagOf: (dataType: AgentDataType) => string = AgentDataType.match({
      boolean: () => "boolean",
      short: () => "short",
      integer: () => "integer",
      long: () => "long",
      float: () => "float",
      double: () => "double",
      string: () => "string",
      date: () => "date",
      timestamp: () => "timestamp",
      nullable: ({ wrappedType }) => `nullable<${wrappedType.type}>`,
      list: ({ elementType }) => `list<${elementType.type}>`,
      record: ({ valueType }) => `record<${valueType.type}>`,
      struct: ({ fields }) => `struct<${A.length(fields)}>`,
      discriminatedUnion: ({ discriminatorKey, members }) => `union<${discriminatorKey}:${A.length(members)}>`,
      object: ({ objectTypeApiName }) => `object<${objectTypeApiName}>`,
      objectSet: ({ objectTypeApiName }) => `objectSet<${objectTypeApiName}>`,
    });
    const described = A.map(AgentDataTypeKind.literals, (kind) => tagOf(dataTypePerCase[kind][1]));
    deepStrictEqual(described, [
      "boolean",
      "short",
      "integer",
      "long",
      "float",
      "double",
      "string",
      "date",
      "timestamp",
      "nullable<string>",
      "list<integer>",
      "record<double>",
      "struct<2>",
      "union<type:2>",
      "object<Customer>",
      "objectSet<Customer>",
    ]);
    const verdicts = A.map(AgentDataTypeKind.literals, (kind) => {
      const domain = dataTypePerCase[kind][1];
      const guardedOnlyByItsOwnCase = A.every(
        AgentDataTypeKind.literals,
        (other) => AgentDataType.guards[other](domain) === (other === kind)
      );
      return guardedOnlyByItsOwnCase && S.is(AgentDataType.cases[kind])(domain);
    });
    assertTrue(A.every(verdicts, identity));
    assertTrue(AgentDataType.isAnyOf(["nullable", "list", "record"])(nullable(stringType)));
    assertFalse(AgentDataType.isAnyOf(["nullable", "list", "record"])(stringType));
  });

  it.effect(
    "decodes a deeply nested type and keeps its shape through a round trip",
    Effect.fnUntraced(function* () {
      const wire: AgentDataType.Encoded = {
        type: "list",
        elementType: {
          type: "nullable",
          wrappedType: {
            type: "record",
            valueType: {
              type: "struct",
              fields: [
                { name: "party", dataType: partyUnionWire },
                { name: "seen", dataType: { type: "list", elementType: { type: "timestamp" } } },
              ],
            },
          },
        },
      };
      const decoded = yield* S.decodeEffect(AgentDataType)(wire);
      const expected = list(
        nullable(
          AgentRecordType.make({
            valueType: struct([field("party", partyUnion), field("seen", list(timestampType))]),
          })
        )
      );
      assertTrue(S.toEquivalence(AgentDataType)(decoded, expected));
      const encoded = yield* S.encodeEffect(AgentDataType)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "rejects tags of other type universes and records that miss their payload",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(
        [
          { type: "decimal" },
          { type: "array", subType: { type: "string" } },
          { type: "optional", wrappedType: { type: "string" } },
          { type: "nullable" },
          { type: "list", elementType: { type: "byte" } },
          { type: "record" },
          { type: "struct" },
          { type: "discriminatedUnion", members: [] },
          { type: "object", ontologyApiName: "crm" },
          { type: "objectSet", ontologyApiName: "", objectTypeApiName: "Customer" },
          "string",
          null,
        ],
        rejects(AgentDataType)
      );
      strictEqual(A.length(verdicts), 12);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "a struct rejects two fields with one name, and says why",
    Effect.fnUntraced(function* () {
      const duplicated = {
        type: "struct",
        fields: [
          { name: "id", dataType: { type: "integer" } },
          { name: "id", dataType: { type: "string" } },
        ],
      };
      const verdicts = yield* Effect.all([
        rejects(AgentDataType)(duplicated),
        rejects(AgentStructType)(duplicated),
        accepts(AgentStructType)({ type: "struct", fields: [] }),
      ]);
      assertTrue(A.every(verdicts, identity));
      const message = yield* failureOf(S.decodeUnknownEffect(AgentStructType)(duplicated));
      assertTrue(Str.includes("Expected every field to have a distinct name")(message));
      assertNone(AgentStructType.makeOption({ fields: [field("id", integerType), field("id", stringType)] }));
    })
  );

  it.effect(
    "a discriminated union rejects repeated discriminator values, repeated member fields and a field under its key",
    Effect.fnUntraced(function* () {
      const repeatedValue = {
        type: "discriminatedUnion",
        discriminatorKey: "type",
        members: [
          { discriminatorValue: "customer", fields: [] },
          { discriminatorValue: "customer", fields: [{ name: "customerId", dataType: { type: "integer" } }] },
        ],
      };
      const repeatedField = {
        type: "discriminatedUnion",
        discriminatorKey: "type",
        members: [
          {
            discriminatorValue: "customer",
            fields: [
              { name: "customerId", dataType: { type: "integer" } },
              { name: "customerId", dataType: { type: "long" } },
            ],
          },
        ],
      };
      const shadowedKey = {
        type: "discriminatedUnion",
        discriminatorKey: "type",
        members: [{ discriminatorValue: "customer", fields: [{ name: "type", dataType: { type: "string" } }] }],
      };
      const verdicts = yield* Effect.forEach([repeatedValue, repeatedField, shadowedKey], rejects(AgentDataType));
      assertTrue(A.every(verdicts, identity));
      const valueMessage = yield* failureOf(S.decodeUnknownEffect(AgentDiscriminatedUnionType)(repeatedValue));
      assertTrue(Str.includes("Expected every union member to have a distinct discriminator value")(valueMessage));
      const keyMessage = yield* failureOf(S.decodeUnknownEffect(AgentDiscriminatedUnionType)(shadowedKey));
      assertTrue(Str.includes("Expected no union member field to be named after the discriminator key")(keyMessage));
      // A union with no members is well-formed: it is the type with no values.
      const memberless = yield* accepts(AgentDataType)({
        type: "discriminatedUnion",
        discriminatorKey: "type",
        members: [],
      });
      assertTrue(memberless);
    })
  );
});

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

describe("AgentDefinition", () => {
  lawful("AgentParameter", AgentParameter);
  lawful("AgentEventDefinition", AgentEventDefinition);
  lawful("AgentContextItemDefinition", AgentContextItemDefinition);
  lawful("AgentDefinition", AgentDefinition);
  lawful("AgentReference", AgentReference);

  wireFixture("AgentDefinition", AgentDefinition, definitionWire, definition);

  wireFixture(
    "AgentParameter",
    AgentParameter,
    { name: "tags", dataType: { type: "list", elementType: { type: "string" } } },
    parameter("tags", list(stringType))
  );

  wireFixture(
    "AgentReference",
    AgentReference,
    { apiName: "triage", version: "1.2.0" },
    AgentReference.make({ apiName: triage, version })
  );

  it.effect(
    "re-encodes a publication instant without milliseconds in its canonical form",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(AgentDefinition)({
        ...definitionWire,
        createdTime: "2026-03-04T05:06:07Z",
      });
      assertTrue(S.toEquivalence(AgentDefinition)(decoded, definition));
      const encoded = yield* S.encodeEffect(AgentDefinition)(decoded);
      deepStrictEqual(encoded, definitionWire);
    })
  );

  it.effect(
    "rejects a definition whose argument names, event types or context item types repeat",
    Effect.fnUntraced(function* () {
      const [customerArgument] = definitionWire.argumentDefinitions;
      const [messageEvent] = definitionWire.eventDefinitions;
      const [toolCallItem] = definitionWire.contextItemDefinitions;
      const verdicts = yield* Effect.forEach(
        [
          { ...definitionWire, argumentDefinitions: [customerArgument, customerArgument] },
          { ...definitionWire, eventDefinitions: [messageEvent, messageEvent] },
          { ...definitionWire, contextItemDefinitions: [toolCallItem, toolCallItem] },
          { ...definitionWire, version: "latest" },
          { ...definitionWire, createdTime: "yesterday" },
          { ...definitionWire, agentStateType: { type: "decimal" } },
        ],
        rejects(AgentDefinition)
      );
      strictEqual(A.length(verdicts), 6);
      assertTrue(A.every(verdicts, identity));
      const message = yield* failureOf(
        S.decodeUnknownEffect(AgentDefinition)({
          ...definitionWire,
          argumentDefinitions: [customerArgument, customerArgument],
        })
      );
      assertTrue(Str.includes("Expected every argument to have a distinct name")(message));
    })
  );
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

describe("sessions", () => {
  lawful("AgentApiNameIdentifier", AgentApiNameIdentifier);
  lawful("AgentIdentifier", AgentIdentifier);
  lawful("CreateAgentSessionRequest", CreateAgentSessionRequest);
  lawful("AgentSession", AgentSession);

  wireFixture(
    "AgentIdentifier",
    AgentIdentifier,
    { type: "agentApiName", ontology: ontologyRid, agentApiName: "triage" },
    AgentIdentifier.make({ ontology: OntologyRid.make(ontologyRid), agentApiName: triage })
  );

  wireFixture(
    "CreateAgentSessionRequest",
    CreateAgentSessionRequest,
    {
      agent: { type: "agentApiName", ontology: ontologyRid, agentApiName: "triage" },
      arguments: { customer: customerReferenceWire, note: null },
      agentVersion: "1.2.0",
    },
    CreateAgentSessionRequest.make({
      agent: AgentIdentifier.make({ ontology: OntologyRid.make(ontologyRid), agentApiName: triage }),
      arguments: R.fromEntries([
        [AgentArgumentName.make("customer"), customerReferenceWire],
        [AgentArgumentName.make("note"), null],
      ]),
      agentVersion: version,
    })
  );

  wireFixture(
    "AgentSession",
    AgentSession,
    {
      id: "session-1",
      agentRid,
      agentApiNameIdentifier: { ontology: ontologyRid, agentApiName: "triage" },
      agentVersion: "1.2.0",
    },
    AgentSession.make({
      id: sessionId,
      agentRid: AgentRid.make(agentRid),
      agentApiNameIdentifier: O.some(address),
      agentVersion: version,
    })
  );

  wireFixture(
    "AgentSession without an API name",
    AgentSession,
    { id: "session-1", agentRid, agentVersion: "1.2.0" },
    AgentSession.make({ id: sessionId, agentRid: AgentRid.make(agentRid), agentVersion: version })
  );

  it.effect(
    "an agent may be named by ontology API name as well as by RID, and the tag is required",
    Effect.fnUntraced(function* () {
      const byApiName = yield* S.decodeEffect(AgentIdentifier)({
        type: "agentApiName",
        ontology: "crm",
        agentApiName: "triage",
      });
      strictEqual(byApiName.ontology, "crm");
      strictEqual(AgentIdentifier.make({ ontology: crm, agentApiName: triage }).type, "agentApiName");
      const verdicts = yield* Effect.forEach(
        [
          { ontology: "crm", agentApiName: "triage" },
          { type: "agentRid", ontology: "crm", agentApiName: "triage" },
          { type: "agentApiName", ontology: "", agentApiName: "triage" },
        ],
        rejects(AgentIdentifier)
      );
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

describe("events", () => {
  lawful("AgentEvent", AgentEvent);
  lawful("SendAgentEventRequest", SendAgentEventRequest);
  lawful("AgentEventAccepted", AgentEventAccepted);
  lawful("AgentSessionNotReady", AgentSessionNotReady);
  lawful("AgentEventResult", AgentEventResult);
  lawful("SendAgentEventResponse", SendAgentEventResponse);

  wireFixture("AgentEvent", AgentEvent, eventWire, event);

  wireFixture(
    "SendAgentEventRequest",
    SendAgentEventRequest,
    { event: eventWire },
    SendAgentEventRequest.make({ event })
  );

  wireFixture(
    "SendAgentEventResponse accepted",
    SendAgentEventResponse,
    { result: { type: "accepted", consistencyKey: "ck-17" } },
    SendAgentEventResponse.make({ result: AgentEventAccepted.make({ consistencyKey }) })
  );

  wireFixture(
    "SendAgentEventResponse not ready",
    SendAgentEventResponse,
    { result: { type: "sessionNotReady" } },
    SendAgentEventResponse.make({ result: AgentSessionNotReady.make({}) })
  );

  it.effect(
    "an event needs all three parts of its envelope; the one-key sugar record is not an event",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(
        [
          { userMessage: { text: "hello" } },
          { eventType: "userMessage", payload: "hello" },
          { id: eventId, payload: "hello" },
          { id: eventId, eventType: "userMessage" },
          { id: "", eventType: "userMessage", payload: "hello" },
        ],
        rejects(AgentEvent)
      );
      strictEqual(A.length(verdicts), 5);
      assertTrue(A.every(verdicts, identity));
      // A payload may be any JSON value, null included.
      const nullPayload = yield* accepts(AgentEvent)({ id: eventId, eventType: "ping", payload: null });
      assertTrue(nullPayload);
    })
  );

  it("reaches both results through their member schemas, guards and the exhaustive matcher", () => {
    const accepted = AgentEventResult.cases.accepted.make({ consistencyKey });
    const notReady = AgentEventResult.cases.sessionNotReady.make({});
    const keyOf = AgentEventResult.match({
      accepted: (result) => O.some(result.consistencyKey),
      sessionNotReady: () => O.none<AgentConsistencyKey>(),
    });
    assertSome(keyOf(accepted), consistencyKey);
    assertNone(keyOf(notReady));
    assertTrue(AgentEventResult.guards.accepted(accepted) && !AgentEventResult.guards.accepted(notReady));
    assertTrue(AgentEventResult.guards.sessionNotReady(notReady) && !AgentEventResult.guards.sessionNotReady(accepted));
    assertTrue(AgentEventResult.isAnyOf(["sessionNotReady"])(notReady));
  });
});

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

describe("session state", () => {
  lawful("AgentSessionStatus", AgentSessionStatus);
  lawful("AgentSessionStatusFromRecord", AgentSessionStatusFromRecord);
  lawful("AgentState", AgentState);
  lawful("AgentContextItem", AgentContextItem);
  lawful("AgentSessionState", AgentSessionState);
  lawful("AgentStateBehind", AgentStateBehind);
  lawful("AgentStateNotReady", AgentStateNotReady);
  lawful("AgentStateResponse", AgentStateResponse);

  wireFixture("AgentSessionState", AgentSessionState, sessionStateWire, sessionState);
  wireFixture("AgentStateResponse available", AgentStateResponse, sessionStateWire, sessionState);
  wireFixture("AgentStateResponse behind", AgentStateResponse, { type: "behind" }, AgentStateBehind.make({}));
  wireFixture("AgentStateResponse notReady", AgentStateResponse, { type: "notReady" }, AgentStateNotReady.make({}));

  wireFixture(
    "AgentContextItem",
    AgentContextItem,
    { contextItemType: "userMessage", data: "hello" },
    AgentContextItem.make({ contextItemType: AgentContextItemType.make("userMessage"), data: "hello" })
  );

  it.effect(
    "spells the four statuses as the wire does and decodes each from its empty record",
    Effect.fnUntraced(function* () {
      const literals: ReadonlyArray<string> = AgentSessionStatus.literals;
      deepStrictEqual(literals, ["live", "completed", "failed", "canceled"]);
      const decoded = yield* Effect.forEach(AgentSessionStatus.literals, (type) =>
        S.decodeEffect(AgentSessionStatusFromRecord)({ type })
      );
      deepStrictEqual<ReadonlyArray<string>>(decoded, ["live", "completed", "failed", "canceled"]);
      const encoded = yield* Effect.forEach(AgentSessionStatus.literals, (status) =>
        S.encodeEffect(AgentSessionStatusFromRecord)(status)
      );
      deepStrictEqual(encoded, [{ type: "live" }, { type: "completed" }, { type: "failed" }, { type: "canceled" }]);
      const verdicts = yield* Effect.forEach(
        [{ type: "cancelled" }, { type: "paused" }, "live", {}],
        rejects(AgentSessionStatusFromRecord)
      );
      assertTrue(A.every(verdicts, identity));
      const literalIsTheDomainValue: Equals<AgentSessionStatusFromRecord, AgentSessionStatus> = true;
      assertTrue(literalIsTheDomainValue);
    })
  );

  it("only a live session is not terminal", () => {
    deepStrictEqual(A.map(AgentSessionStatus.literals, isTerminal), [false, true, true, true]);
    const described = A.map(
      AgentSessionStatus.literals,
      AgentSessionStatus.match({
        live: () => "open",
        completed: () => "done",
        failed: () => "broken",
        canceled: () => "stopped",
      })
    );
    deepStrictEqual(described, ["open", "done", "broken", "stopped"]);
    assertTrue(AgentSessionStatus.is.live("live"));
    assertFalse(AgentSessionStatus.is.live("completed"));
  });

  it("reaches all three answers through their member schemas, guards and the exhaustive matcher", () => {
    const answers = [
      sessionState,
      AgentStateResponse.cases.behind.make({}),
      AgentStateResponse.cases.notReady.make({}),
    ];
    const shouldPollAgain = AgentStateResponse.match({
      available: () => false,
      behind: () => true,
      notReady: () => true,
    });
    deepStrictEqual(A.map(answers, shouldPollAgain), [false, true, true]);
    deepStrictEqual(A.map(answers, AgentStateResponse.guards.available), [true, false, false]);
    deepStrictEqual(A.map(answers, AgentStateResponse.guards.behind), [false, true, false]);
    deepStrictEqual(A.map(answers, AgentStateResponse.guards.notReady), [false, false, true]);
    assertTrue(S.is(AgentStateResponse.cases.available)(sessionState));
  });

  it.effect(
    "a state record keeps the wire's keys, and an unknown answer is rejected",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(AgentSessionState)(sessionStateWire);
      strictEqual(decoded.status, "live");
      deepStrictEqual(decoded.contextItemOrder, [AgentContextItemId.make("item-2"), AgentContextItemId.make("item-1")]);
      const first = R.get(decoded.contextItems, AgentContextItemId.make("item-1"));
      assertSome(
        O.map(first, (item) => item.contextItemType),
        AgentContextItemType.make("userMessage")
      );
      const verdicts = yield* Effect.forEach(
        [
          { type: "stale" },
          { ...sessionStateWire, status: "live" },
          { ...sessionStateWire, agentState: { summary: "open" } },
          { ...sessionStateWire, contextItems: { "item-1": { type: "userMessage", data: "hello" } } },
        ],
        rejects(AgentStateResponse)
      );
      strictEqual(A.length(verdicts), 4);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Object references
// ---------------------------------------------------------------------------

describe("AgentObjectReference", () => {
  // A key is the wire scalar that carries it, so the reference round-trips exactly.
  lawful("AgentObjectReference", AgentObjectReference);

  wireFixture(
    "AgentObjectReference",
    AgentObjectReference,
    customerReferenceWire,
    AgentObjectReference.make({
      ontologyRid: OntologyRid.make(ontologyRid),
      objectTypeApiName: customer,
      primaryKey: R.fromEntries([[PropertyApiName.make("customerId"), 123]]),
    })
  );

  it.effect(
    "holds exactly one primary key entry",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(
        [
          { ...customerReferenceWire, primaryKey: {} },
          { ...customerReferenceWire, primaryKey: { customerId: 123, region: "EU" } },
          { ...customerReferenceWire, primaryKey: 123 },
          { ...customerReferenceWire, primaryKey: { customerId: { nested: true } } },
          { ...customerReferenceWire, ontologyRid: "" },
          { objectTypeApiName: "Customer", primaryKey: { customerId: 123 } },
        ],
        rejects(AgentObjectReference)
      );
      strictEqual(A.length(verdicts), 6);
      assertTrue(A.every(verdicts, identity));
      const message = yield* failureOf(
        S.decodeEffect(AgentObjectReference)({ ...customerReferenceWire, primaryKey: {} })
      );
      strictEqual(message, 'Expected exactly one primary key entry, found none\n  at ["primaryKey"]');
      const several = yield* failureOf(
        S.decodeEffect(AgentObjectReference)({
          ...customerReferenceWire,
          primaryKey: { customerId: 123, region: "EU" },
        })
      );
      strictEqual(several, 'Expected exactly one primary key entry, found several\n  at ["primaryKey"]');
      // An empty string is not a property name: a record drops it before its entries are counted.
      const unnamed = yield* S.decodeEffect(AgentObjectReference)({
        ...customerReferenceWire,
        primaryKey: { "": 1, customerId: 123 },
      });
      deepStrictEqual(R.keys(unnamed.primaryKey), ["customerId"]);
      assertNone(
        AgentObjectReference.makeOption({
          ontologyRid: OntologyRid.make(ontologyRid),
          objectTypeApiName: customer,
          primaryKey: R.fromEntries([
            [PropertyApiName.make("customerId"), 123],
            [PropertyApiName.make("region"), "EU"],
          ]),
        })
      );
    })
  );

  it.effect(
    "holds a long key as the text its codec writes, and refuses the bigint itself",
    Effect.fnUntraced(function* () {
      const customerId = yield* S.encodeEffect(LongValue)(BigInt("9007199254740993"));
      const reference = AgentObjectReference.make({
        ontologyRid: OntologyRid.make(ontologyRid),
        objectTypeApiName: customer,
        primaryKey: R.fromEntries([[PropertyApiName.make("customerId"), customerId]]),
      });
      const encoded = yield* S.encodeEffect(AgentObjectReference)(reference);
      deepStrictEqual(encoded.primaryKey, { customerId: "9007199254740993" });
      const decoded = yield* S.decodeEffect(AgentObjectReference)(encoded);
      assertTrue(S.toEquivalence(AgentObjectReference)(decoded, reference));
      const richKey = R.fromEntries([[PropertyApiName.make("customerId"), BigInt("9007199254740993")]]);
      assertNone(
        AgentObjectReference.makeOption({
          ontologyRid: OntologyRid.make(ontologyRid),
          objectTypeApiName: customer,
          // @ts-expect-error a 64-bit key is the text it travels as, not a bigint
          primaryKey: richKey,
        })
      );
    })
  );
});

// ---------------------------------------------------------------------------
// valueCodec: the projection from an agent data type to the codec of its values
// ---------------------------------------------------------------------------

describe("valueCodec", () => {
  it.prop(
    "valueCodec and fieldCodec construct a codec for every generated data type",
    [Arbitrary.schema(AgentDataType)],
    ([dataType]) => S.isSchema(valueCodec(dataType)) && S.isSchema(fieldCodec(dataType)),
    { arbitrary: fcRuns(200) }
  );

  it.effect(
    "projects generated types of all 16 cases, nested ones included",
    Effect.fnUntraced(function* () {
      const types = yield* Arbitrary.sampleEffect(Arbitrary.schema(AgentDataType), { count: 600, seed: 16 });
      const generatedTags: ReadonlyArray<string> = A.dedupe(A.map(types, (dataType) => dataType.type));
      const tags: ReadonlyArray<string> = AgentDataTypeKind.literals;
      deepStrictEqual(A.sort(generatedTags, Order.String), A.sort(tags, Order.String));
      assertTrue(A.every(types, (dataType) => S.isSchema(valueCodec(dataType))));
      const nested = A.filter(
        types,
        AgentDataType.isAnyOf(["nullable", "list", "record", "struct", "discriminatedUnion"])
      );
      assertTrue(A.isReadonlyArrayNonEmpty(nested));
    })
  );

  it.effect(
    "decodes a hand-picked wire value of every case and encodes it back canonically",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(
        AgentDataTypeKind.literals,
        Effect.fnUntraced(function* (kind) {
          const [dataType, wire, canonical] = valuePerCase[kind];
          const codec = valueCodec(dataType);
          const { decoded, encoded } = yield* throughCodec(codec, wire);
          deepStrictEqual(encoded, canonical);
          // The canonical form is a fixed point: decoding and encoding it again changes nothing.
          const again = yield* throughCodec(codec, encoded);
          deepStrictEqual(again.encoded, canonical);
          return dataType.type === kind && S.is(codec)(decoded) && S.toEquivalence(codec)(again.decoded, decoded);
        })
      );
      strictEqual(A.length(results), 16);
      assertTrue(A.every(results, identity));
    })
  );

  it.effect(
    "round-trips generated values of every case that has an exact round trip",
    Effect.fnUntraced(function* () {
      // The projected codec of an object reference pins the object type its data type names, which a generator
      // cannot guess. That case is generated below as a plain reference and given the pinned name.
      const kinds = AgentDataTypeKind.omit(["object"]).literals;
      const results = yield* Effect.forEach(
        kinds,
        Effect.fnUntraced(function* (kind) {
          const codec = valueCodec(valuePerCase[kind][0]);
          const equivalence = S.toEquivalence(codec);
          const values = yield* Arbitrary.sampleEffect(Arbitrary.schema(codec), { count: 25, seed: 7 });
          const verdicts = yield* Effect.forEach(
            values,
            Effect.fnUntraced(function* (value) {
              const encoded = yield* S.encodeUnknownEffect(codec)(value);
              const decoded = yield* S.decodeUnknownEffect(codec)(encoded);
              return S.is(codec)(value) && equivalence(decoded, value);
            })
          );
          return A.length(values) === 25 && A.every(verdicts, identity);
        })
      );
      strictEqual(A.length(results), 15);
      assertTrue(A.every(results, identity));
      // The sixteenth case. Its key is the wire scalar that carries it, so it round-trips exactly like the others.
      const objectCodec = valueCodec(valuePerCase.object[0]);
      const sameReference = S.toEquivalence(objectCodec);
      const references = yield* Arbitrary.sampleEffect(Arbitrary.schema(AgentObjectReference), { count: 25, seed: 7 });
      const objectVerdicts = yield* Effect.forEach(
        references,
        Effect.fnUntraced(function* ({ ontologyRid: rid, primaryKey }) {
          const value = AgentObjectReference.make({ ontologyRid: rid, objectTypeApiName: customer, primaryKey });
          const encoded = yield* S.encodeUnknownEffect(objectCodec)(value);
          const decoded = yield* S.decodeUnknownEffect(objectCodec)(encoded);
          return S.is(objectCodec)(value) && sameReference(decoded, value);
        })
      );
      strictEqual(A.length(objectVerdicts), 25);
      assertTrue(A.every(objectVerdicts, identity));
    })
  );

  it.effect(
    "decodes each scalar to its rich domain value",
    Effect.fnUntraced(function* () {
      const long = yield* S.decodeEffect(valueCodec(longType))("9007199254740993");
      strictEqual(long, BigInt("9007199254740993"));
      const longFromNumber = yield* throughCodec(valueCodec(longType), 12);
      strictEqual(longFromNumber.decoded, BigInt(12));
      strictEqual(longFromNumber.encoded, "12");
      const instant = yield* S.decodeEffect(valueCodec(timestampType))("2021-01-04T05:00:00Z");
      assertTrue(DateTime.isDateTime(instant));
      assertTrue(DateTime.isDateTime(instant) && DateTime.toEpochMillis(instant) === 1609736400000);
      const date = yield* throughCodec(valueCodec(DateType.make({})), "2024-02-29");
      assertFalse(P.isString(date.decoded));
      strictEqual(date.encoded, "2024-02-29");
      const verdicts = yield* Effect.all([
        rejects(valueCodec(DateType.make({})))("2024-02-30"),
        rejects(valueCodec(ShortType.make({})))(40000),
        rejects(valueCodec(integerType))(1.5),
        rejects(valueCodec(booleanType))("yes"),
        rejects(valueCodec(stringType))(7),
        rejects(valueCodec(timestampType))("yesterday"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "nullable is an Option over JSON null, at any depth of a container",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(nullable(stringType));
      const decoded = yield* Effect.forEach([null, "hello"], (wire) => S.decodeEffect(codec)(wire));
      deepStrictEqual(decoded, [O.none(), O.some("hello")]);
      const encoded = yield* Effect.forEach([O.none(), O.some("hello")], (value) => S.encodeEffect(codec)(value));
      deepStrictEqual(encoded, [null, "hello"]);
      // Not nullable means not nullable.
      const verdicts = yield* Effect.all([rejects(codec)(7), rejects(valueCodec(stringType))(null)]);
      assertTrue(A.every(verdicts, identity));
      const sparse = yield* throughCodec(valueCodec(list(nullable(integerType))), [1, null, 3]);
      deepStrictEqual(sparse.decoded, [O.some(1), O.none(), O.some(3)]);
      deepStrictEqual(sparse.encoded, [1, null, 3]);
      // A nullable of a nullable has two absences and the wire one null: both encode to it, and it reads back
      // as the inner one.
      const twice = valueCodec(nullable(nullable(stringType)));
      const decodedTwice = yield* Effect.forEach([null, "hello"], (wire) => S.decodeEffect(twice)(wire));
      deepStrictEqual(decodedTwice, [O.some(O.none()), O.some(O.some("hello"))]);
      const innerAbsence: O.Option<O.Option<string>> = O.some(O.none());
      const outerAbsence: O.Option<O.Option<string>> = O.none();
      const encodedTwice = yield* Effect.forEach([innerAbsence, outerAbsence], (value) => S.encodeEffect(twice)(value));
      deepStrictEqual(encodedTwice, [null, null]);
    })
  );

  it.effect(
    "list and record decode every element with the element codec",
    Effect.fnUntraced(function* () {
      const longs = yield* throughCodec(valueCodec(list(longType)), ["1", 2, "3"]);
      deepStrictEqual(longs.decoded, [BigInt(1), BigInt(2), BigInt(3)]);
      deepStrictEqual(longs.encoded, ["1", "2", "3"]);
      const matrix = yield* throughCodec(valueCodec(list(list(integerType))), [[1, 2], [], [3]]);
      deepStrictEqual(matrix.encoded, [[1, 2], [], [3]]);
      const byName = yield* throughCodec(valueCodec(AgentRecordType.make({ valueType: list(stringType) })), {
        first: ["a"],
        second: [],
      });
      deepStrictEqual(byName.encoded, { first: ["a"], second: [] });
      const verdicts = yield* Effect.all([
        rejects(valueCodec(list(integerType)))({ 0: 1 }),
        rejects(valueCodec(list(integerType)))([1, "two"]),
        rejects(valueCodec(list(integerType)))(null),
        rejects(valueCodec(AgentRecordType.make({ valueType: integerType })))([1, 2]),
        rejects(valueCodec(AgentRecordType.make({ valueType: integerType })))({ first: "one" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "a struct requires its fields unless they are nullable, and drops keys it does not declare",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(struct([field("id", integerType), field("note", nullable(stringType))]));
      const absent = yield* throughCodec(codec, { id: 1 });
      deepStrictEqual(absent.decoded, { id: 1, note: O.none() });
      // A nullable field that was absent is written back as the null its type admits.
      deepStrictEqual(absent.encoded, { id: 1, note: null });
      const explicit = yield* throughCodec(codec, { id: 1, note: null });
      deepStrictEqual(explicit.decoded, { id: 1, note: O.none() });
      const present = yield* throughCodec(codec, { id: 1, note: "seen", undeclared: true });
      deepStrictEqual(present.decoded, { id: 1, note: O.some("seen") });
      deepStrictEqual(present.encoded, { id: 1, note: "seen" });
      const verdicts = yield* Effect.all([
        rejects(codec)({ note: "seen" }),
        rejects(codec)({ id: null, note: "seen" }),
        rejects(codec)({ id: "one" }),
        rejects(codec)([1, "seen"]),
        rejects(codec)(null),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "a struct with no fields accepts only the empty record",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(struct([]));
      const empty = yield* throughCodec(codec, {});
      deepStrictEqual(empty.encoded, {});
      const verdicts = yield* Effect.all([
        rejects(codec)({ anything: 1 }),
        rejects(codec)("text"),
        rejects(codec)(7),
        rejects(codec)([]),
        rejects(codec)(null),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "a discriminated union selects the member by its discriminator value and keeps the literal",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(partyUnion);
      const customerValue = yield* throughCodec(codec, { type: "customer", customerId: 123 });
      deepStrictEqual(customerValue.decoded, { type: "customer", customerId: 123 });
      deepStrictEqual(customerValue.encoded, { type: "customer", customerId: 123 });
      const employeeValue = yield* throughCodec(codec, {
        type: "employee",
        employeeId: "1ff8ceda-7354-4aea-8412-a7434164aca9",
      });
      deepStrictEqual(employeeValue.encoded, { type: "employee", employeeId: "1ff8ceda-7354-4aea-8412-a7434164aca9" });
      const verdicts = yield* Effect.all([
        // An unknown discriminator value is not a value of the union; OSDK passes it through.
        rejects(codec)({ type: "supplier", supplierId: 9 }),
        // The discriminator selects the member, so the other member's fields do not rescue the value.
        rejects(codec)({ type: "customer", employeeId: "1ff8ceda" }),
        rejects(codec)({ customerId: 123 }),
        rejects(codec)("customer"),
      ]);
      assertTrue(A.every(verdicts, identity));
      const single = valueCodec(
        AgentDiscriminatedUnionType.make({
          discriminatorKey: "kind",
          members: [AgentUnionMember.make({ discriminatorValue: "ping", fields: [] })],
        })
      );
      const ping = yield* throughCodec(single, { kind: "ping", ignored: 1 });
      deepStrictEqual(ping.encoded, { kind: "ping" });
      const withoutDiscriminator = yield* rejects(single)({});
      assertTrue(withoutDiscriminator);
    })
  );

  it.effect(
    "a discriminated union with no members has no values",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(AgentDiscriminatedUnionType.make({ discriminatorKey: "type", members: [] }));
      const verdicts = yield* Effect.forEach([{}, { type: "customer" }, null, "text", 1], rejects(codec));
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "an object value is a reference to an object of the declared type",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(customerType);
      const decoded = yield* S.decodeEffect(codec)(customerReferenceWire);
      deepStrictEqual(decoded, {
        ontologyRid,
        objectTypeApiName: "Customer",
        primaryKey: { customerId: 123 },
      });
      assertTrue(S.is(AgentObjectReference)(decoded));
      const anotherType = yield* failsWith(
        codec,
        { ...customerReferenceWire, objectTypeApiName: "Employee" },
        "Expected a reference to an object of type Customer"
      );
      assertTrue(anotherType);
      const verdicts = yield* Effect.all([
        rejects(codec)({ ...customerReferenceWire, primaryKey: { customerId: 123, region: "EU" } }),
        rejects(codec)({ ...customerReferenceWire, primaryKey: {} }),
        // OSDK's sugar forms are not wire values: a bare key, and its `$apiName` / `$primaryKey` record.
        rejects(codec)(123),
        rejects(codec)({ $apiName: "Customer", $primaryKey: 123 }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "an object set value is the RID of an object set",
    Effect.fnUntraced(function* () {
      const codec = valueCodec(customerSetType);
      const through = yield* throughCodec(codec, objectSetRid);
      strictEqual(through.decoded, objectSetRid);
      strictEqual(through.encoded, objectSetRid);
      const verdicts = yield* Effect.all([
        rejects(codec)(""),
        rejects(codec)({ type: "base", objectType: "Customer" }),
        rejects(codec)(null),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "fieldCodec differs from valueCodec only for nullable types",
    Effect.fnUntraced(function* () {
      const Row = S.Struct({ required: fieldCodec(stringType), optional: fieldCodec(nullable(stringType)) });
      const decoded = yield* S.decodeUnknownEffect(Row)({ required: "a" });
      strictEqual(decoded.required, "a");
      deepStrictEqual(decoded.optional, O.none());
      const encoded = yield* S.encodeUnknownEffect(Row)(decoded);
      deepStrictEqual(encoded, { required: "a", optional: null });
      const verdicts = yield* Effect.all([
        rejects(Row)({ optional: "b" }),
        rejects(Row)({ required: null, optional: "b" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "argumentsCodec decodes the arguments of a session with the definition's argument types",
    Effect.fnUntraced(function* () {
      const codec = argumentsCodec(definition.argumentDefinitions);
      const through = yield* throughCodec(codec, { customer: customerReferenceWire });
      deepStrictEqual(through.decoded, {
        customer: { ontologyRid, objectTypeApiName: "Customer", primaryKey: { customerId: 123 } },
        note: O.none(),
      });
      deepStrictEqual(through.encoded, { customer: customerReferenceWire, note: null });
      // An agent with no arguments takes the empty record and nothing else.
      const none = argumentsCodec([]);
      const empty = yield* throughCodec(none, {});
      deepStrictEqual(empty.encoded, {});
      const verdicts = yield* Effect.all([
        rejects(codec)({ note: "no customer" }),
        rejects(codec)({ customer: { ...customerReferenceWire, objectTypeApiName: "Employee" } }),
        rejects(none)({ unexpected: 1 }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "decodes the parts of a session state with codecs projected from the session's definition",
    Effect.fnUntraced(function* () {
      const stateCodec = valueCodec(definition.agentStateType);
      const state = yield* S.decodeEffect(stateCodec)(sessionState.agentState.data);
      deepStrictEqual(state, { summary: "open" });
      // `attempts` is a number, and the declared item type is a record of strings: the projection notices.
      const toolCallType = AgentRecordType.make({ valueType: stringType });
      const mistyped = yield* rejects(valueCodec(toolCallType))({ tool: "lookup", attempts: 2 });
      assertTrue(mistyped);
      const wellTyped = yield* throughCodec(valueCodec(toolCallType), { tool: "lookup", attempts: "2" });
      deepStrictEqual(wellTyped.encoded, { tool: "lookup", attempts: "2" });
    })
  );
});

// ---------------------------------------------------------------------------
// Polling: defaults and failures
// ---------------------------------------------------------------------------

describe("polling", () => {
  lawful("AgentStateTimeout", AgentStateTimeout);
  lawful("AgentEventTimeout", AgentEventTimeout);

  it("polls for thirty seconds, once a second, unless told otherwise", () => {
    strictEqual(Duration.toMillis(defaultPollTimeout), 30_000);
    strictEqual(Duration.toMillis(defaultPollInterval), 1000);
    assertTrue(Duration.isFinite(defaultPollTimeout) && Duration.isPositive(defaultPollInterval));
  });

  it.effect(
    "a state timeout carries the session, the timeout and the awaited consistency key",
    Effect.fnUntraced(function* () {
      const bare = AgentStateTimeout.make({ sessionId, timeout: defaultPollTimeout });
      strictEqual(bare._tag, "AgentStateTimeout");
      strictEqual(bare.message, "Agent session state reading timed out after 30s");
      assertNone(bare.consistencyKey);
      const awaited = AgentStateTimeout.make({
        sessionId,
        timeout: Duration.millis(250),
        consistencyKey: O.some(consistencyKey),
      });
      assertSome(awaited.consistencyKey, consistencyKey);
      const recovered = yield* Effect.catchTag(Effect.fail(awaited), "AgentStateTimeout", (error) =>
        Effect.succeed(Tuple.make(error.sessionId, Duration.toMillis(error.timeout)))
      );
      deepStrictEqual(recovered, Tuple.make(sessionId, 250));
      const failing: Effect.Effect<never, AgentStateTimeout> = Effect.fail(bare);
      const exit = yield* Effect.exit(failing);
      assertSome(Exit.findErrorOption(exit), bare);
      const encoded = yield* S.encodeEffect(AgentStateTimeout)(awaited);
      strictEqual(encoded.consistencyKey, "ck-17");
      const decoded = yield* S.decodeEffect(AgentStateTimeout)(encoded);
      assertTrue(S.toEquivalence(AgentStateTimeout)(decoded, awaited));
      const isStateTimeout = S.is(AgentStateTimeout)(decoded);
      assertTrue(isStateTimeout);
    })
  );

  it.effect(
    "an event timeout carries the idempotency key needed to send the same event again",
    Effect.fnUntraced(function* () {
      const failure = AgentEventTimeout.make({ sessionId, eventId: event.id, timeout: Duration.seconds(5) });
      strictEqual(failure._tag, "AgentEventTimeout");
      strictEqual(failure.message, "Agent event sending timed out after 5s");
      const retried = yield* Effect.catchTag(Effect.fail(failure), "AgentEventTimeout", (error) =>
        Effect.succeed(AgentEvent.make({ id: error.eventId, eventType: event.eventType, payload: event.payload }))
      );
      assertTrue(S.toEquivalence(AgentEvent)(retried, event));
      const eitherTimeout = Effect.catchTags(Effect.fail<AgentStateTimeout | AgentEventTimeout>(failure), {
        AgentStateTimeout: () => Effect.succeed("state"),
        AgentEventTimeout: () => Effect.succeed("event"),
      });
      const handled = yield* eitherTimeout;
      strictEqual(handled, "event");
    })
  );
});
