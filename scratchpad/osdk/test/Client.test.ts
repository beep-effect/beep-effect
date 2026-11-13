import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { ActionValidation } from "../src/Action/index.ts";
import { AggregateResponse, avg, count as countMetric, exact, ordered } from "../src/Aggregation/index.ts";
import {
  ActionRejected,
  AggregatedGroup,
  AggregateObjectSetRequest,
  AggregationResult,
  ApiError,
  ApiErrorBody,
  aggregate,
  ClientError,
  count,
  DecodeError,
  FetchOptions,
  fetchOne,
  fetchPage,
  HttpStatus,
  LoadObjectsRequest,
  LoadObjectsResponse,
  LoadObjectsResponseOf,
  MultipleObjectsFound,
  ObjectNotFound,
  ObjectSetEntities,
  OntologyContext,
  OntologyScope,
  OntologyTransport,
  ReferenceSigningOptions,
  stream,
  TransportError,
  TransportFailure,
  untyped,
} from "../src/Client/index.ts";
import {
  ActionTypeApiName,
  ErrorName,
  ObjectTypeApiName,
  OntologyApiName,
  PropertyApiName,
} from "../src/Identifier/index.ts";
import { eq } from "../src/Model/Model.filter.ts";
import { object, one } from "../src/Model/Model.object.ts";
import { all, orderBy, pick, thenBy, traverse, where } from "../src/Model/Model.set.ts";
import { integer, required, string, timestamp } from "../src/Model/Model.spec.ts";
import { ObjectLocator, ObjectRecord, OntologyObject } from "../src/Object/index.ts";
import { ObjectSet, OrderBy, OrderByFields, objectType, PropertyOrdering, saved } from "../src/ObjectSet/index.ts";
import { PageToken } from "../src/Page/index.ts";
import type { PrimaryKeyValue } from "../src/Object/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by the named schemas
// ---------------------------------------------------------------------------

const generates = <T, E>(name: string, schema: S.Codec<T, E>, runs = 50): void => {
  const is = S.is(schema);

  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(runs),
  });
};

// Every schema here: a value has one wire spelling and that spelling decodes back to the same value. The envelopes
// that hold a comparison operand or a primary key are included: both are the wire scalars that carry them.
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, runs = 50): void => {
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  generates(name, schema, runs);

  it.effect.prop(
    `${name}: encode then decode is equivalent to the original`,
    [Arbitrary.schema(schema)],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(equivalence(decoded, value));
    }),
    { arbitrary: fcRuns(runs) }
  );
};

// Decodes one exact wire fixture, hands the domain value to the assertions, and requires the value to encode
// back to the fixture, key for key.
const exactly = Effect.fnUntraced(function* <T, E>(schema: S.Codec<T, E>, wire: unknown) {
  const decoded = yield* S.decodeUnknownEffect(schema)(wire);
  const encoded = yield* S.encodeEffect(schema)(decoded);
  deepStrictEqual<unknown>(encoded, wire);
  return decoded;
});

// Whether each wire value fails to decode, in order.
const rejections = Effect.fnUntraced(function* <T, E>(schema: S.Codec<T, E>, wires: ReadonlyArray<unknown>) {
  const decode = S.decodeUnknownEffect(schema);
  const exits = yield* Effect.forEach(wires, (wire) => Effect.exit(decode(wire)));
  return A.map(exits, (exit) => Exit.isFailure(exit));
});

// How an effect ended when it did not succeed: the typed failure it carried, and whether it died instead.
const outcomeOf = Effect.fnUntraced(function* <Success, Failure, Services>(
  effect: Effect.Effect<Success, Failure, Services>
) {
  const exit = yield* Effect.exit(effect);
  return { failure: Exit.findErrorOption(exit), died: Exit.hasDies(exit) };
});

// ---------------------------------------------------------------------------
// Fixtures: a typed model, wire pages and a transport that serves them
// ---------------------------------------------------------------------------

const Employee = object({
  apiName: "Employee",
  primaryKey: "employeeId",
  properties: {
    employeeId: required(integer),
    fullName: string,
    startedAt: timestamp,
  },
  links: { lead: one("Employee") },
});

const employeeType = ObjectTypeApiName.make("Employee");

const john = {
  __apiName: "Employee",
  __primaryKey: 50030,
  __title: "John Doe",
  employeeId: 50030,
  fullName: "John Doe",
  startedAt: "2019-01-01T00:00:00.000Z",
};
const jane = {
  __apiName: "Employee",
  __primaryKey: 50031,
  __title: "Jane Roe",
  employeeId: 50031,
  fullName: "Jane Roe",
};
const ravi = { __apiName: "Employee", __primaryKey: 50032, employeeId: 50032 };
// A row the platform could send but the model cannot read: the key property is not a number.
const garbled = { __apiName: "Employee", __primaryKey: 50033, employeeId: "fifty thousand" };
const nycOffice = { __apiName: "Office", __primaryKey: "NYC", officeId: "NYC" };

const pageOf = (data: ReadonlyArray<unknown>, total: number) => ({
  data,
  totalCount: `${total}`,
  propertySecurities: [],
});

const everyone = objectType("Employee");
const nobody = saved("ri.object-set.main.object-set.nobody");
const onlyRavi = saved("ri.object-set.main.object-set.only-ravi");
const twins = saved("ri.object-set.main.object-set.twins");
const split = saved("ri.object-set.main.object-set.split");
const lateArrival = saved("ri.object-set.main.object-set.late-arrival");
const corrupt = saved("ri.object-set.main.object-set.corrupt");
const offices = saved("ri.object-set.main.object-set.offices");
const frozen = saved("ri.object-set.main.object-set.frozen");
const cliff = saved("ri.object-set.main.object-set.cliff");
const unknownSet = saved("ri.object-set.main.object-set.unknown");
// The stub serves this set by the ordering a request asks for, so a test can see which ordering was sent.
const sorted = saved("ri.object-set.main.object-set.sorted");

// Every object set of the fixtures is a base set or a saved set, named by what makes it one.
const nameOf = (set: ObjectSet): string =>
  ObjectSet.matchOrElse(
    set,
    {
      base: ({ objectType: apiName }) => `${apiName}`,
      reference: ({ rid }) => `${rid}`,
    },
    () => "unsupported"
  );

const firstPage = "first page";

// The ordering of a request in words: the page of the sorted set a request is served.
const orderingOf = (request: LoadObjectsRequest): string =>
  O.match(request.orderBy, {
    onNone: () => "unordered",
    onSome: OrderBy.match({
      relevance: () => "relevance",
      fields: ({ fields }) =>
        A.join(
          A.map(fields, (key) => `${key.property} ${O.getOrElse(key.direction, () => "any")}`),
          ", "
        ),
    }),
  });

// The pages the stub serves, by object set and then by the page token that asks for them.
const pages = HashMap.make(
  [
    nameOf(everyone),
    HashMap.make(
      [firstPage, { ...pageOf([john, jane], 3), nextPageToken: "v1.second" }],
      ["v1.second", pageOf([ravi], 3)]
    ),
  ],
  [nameOf(nobody), HashMap.make([firstPage, pageOf([], 0)])],
  [nameOf(onlyRavi), HashMap.make([firstPage, pageOf([ravi], 1)])],
  [nameOf(twins), HashMap.make([firstPage, pageOf([john, jane], 2)])],
  // One object per page: the second object only shows after following the token.
  [
    nameOf(split),
    HashMap.make([firstPage, { ...pageOf([john], 2), nextPageToken: "v1.rest" }], ["v1.rest", pageOf([jane], 2)]),
  ],
  // A first page that is empty yet not the last: the only object arrives on the second.
  [
    nameOf(lateArrival),
    HashMap.make([firstPage, { ...pageOf([], 1), nextPageToken: "v1.rest" }], ["v1.rest", pageOf([ravi], 1)]),
  ],
  [nameOf(corrupt), HashMap.make([firstPage, pageOf([john, garbled], 2)])],
  // A first page that points at a page the stub does not have: reading past it fails.
  [nameOf(cliff), HashMap.make([firstPage, { ...pageOf([john, jane], 9), nextPageToken: "v1.missing" }])],
  [nameOf(offices), HashMap.make([firstPage, pageOf([nycOffice], 1)])],
  [
    nameOf(frozen),
    HashMap.make([firstPage, { ...pageOf([john], 2), nextPageToken: "v1.rest" }], ["v1.rest", pageOf([ravi], 2)]),
  ],
  // One page per ordering a request can ask for; an ordering the stub does not know has no answer.
  [
    nameOf(sorted),
    HashMap.make(
      ["unordered", pageOf([jane, ravi, john], 3)],
      ["employeeId asc", pageOf([john, jane, ravi], 3)],
      ["employeeId desc", pageOf([ravi, jane, john], 3)],
      ["fullName asc, employeeId desc", pageOf([jane, john, ravi], 3)]
    ),
  ]
);

// Object sets the stub serves only to a request that reads from a snapshot.
const snapshotOnly = HashSet.make(nameOf(frozen));

const teamsAnswer = {
  accuracy: "ACCURATE",
  data: [
    {
      group: { team: "platform" },
      metrics: [
        { name: "count", value: 2 },
        { name: "salary.avg", value: 91000 },
      ],
    },
    {
      group: { team: "design" },
      metrics: [{ name: "count", value: 1 }, { name: "salary.avg" }, { name: "headcount", value: 1 }],
    },
  ],
};
const totalAnswer = {
  accuracy: "ACCURATE",
  excludedItems: 0,
  data: [{ group: {}, metrics: [{ name: "count", value: 3 }] }],
};
const countlessAnswer = { accuracy: "APPROXIMATE", data: [{ group: {}, metrics: [{ name: "count", value: "many" }] }] };

const outsideTheStub = (request: string) =>
  TransportError.make({ message: `The stub transport has no answer for ${request}`, cause: request });

// What a real transport does with a body: decode it, and report a body that does not fit as a DecodeError.
const decodePage = (wire: unknown) =>
  Effect.mapError(S.decodeUnknownEffect(LoadObjectsResponse)(wire), (cause) =>
    DecodeError.make({ message: cause.message, cause })
  );

const decodeAggregate = (wire: unknown) =>
  Effect.mapError(S.decodeUnknownEffect(AggregateResponse)(wire), (cause) =>
    DecodeError.make({ message: cause.message, cause })
  );

const StubTransport = Layer.succeed(
  OntologyTransport,
  OntologyTransport.of({
    loadObjects: Effect.fn("StubTransport.loadObjects")(function* (request: LoadObjectsRequest) {
      const name = nameOf(request.objectSet);
      const token = name === nameOf(sorted) ? orderingOf(request) : O.getOrElse(request.pageToken, () => firstPage);
      const served = !HashSet.has(snapshotOnly, name) || request.snapshot;
      const wire = yield* pipe(
        O.liftPredicate(pages, () => served),
        O.flatMap(HashMap.get(name)),
        O.flatMap(HashMap.get(token)),
        Effect.fromOption(() => outsideTheStub(`loadObjects(${name}, ${token})`))
      );
      return yield* decodePage(wire);
    }),
    aggregate: Effect.fn("StubTransport.aggregate")(function* (request: AggregateObjectSetRequest) {
      const grouped = A.isReadonlyArrayNonEmpty(request.groupBy);
      const name = nameOf(request.objectSet);
      return yield* decodeAggregate(grouped ? teamsAnswer : name === nameOf(nobody) ? countlessAnswer : totalAnswer);
    }),
    loadOntology: Effect.fn("StubTransport.loadOntology")(() => Effect.fail(outsideTheStub("loadOntology"))),
    loadLinks: Effect.fn("StubTransport.loadLinks")(() => Effect.fail(outsideTheStub("loadLinks"))),
    applyAction: Effect.fn("StubTransport.applyAction")(() => Effect.fail(outsideTheStub("applyAction"))),
    validateAction: Effect.fn("StubTransport.validateAction")(() => Effect.fail(outsideTheStub("validateAction"))),
    applyActionBatch: Effect.fn("StubTransport.applyActionBatch")(() =>
      Effect.fail(outsideTheStub("applyActionBatch"))
    ),
    executeQuery: Effect.fn("StubTransport.executeQuery")(() => Effect.fail(outsideTheStub("executeQuery"))),
    uploadAttachment: Effect.fn("StubTransport.uploadAttachment")(() =>
      Effect.fail(outsideTheStub("uploadAttachment"))
    ),
    readAttachment: Effect.fn("StubTransport.readAttachment")(() => Effect.fail(outsideTheStub("readAttachment"))),
  })
);

const defaults = FetchOptions.make({});

// A typed set of the fixtures: the Employee model paired, by hand, with one of the object sets the stub serves.
const employeesOf = (objectSet: ObjectSet) => ({ model: Employee, objectSet });

type Same<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

// Compiles only when the two types are exactly equal: the argument must then be `true`.
const sameType = <Left, Right>(proof: Same<Left, Right>): boolean => proof;

const isDecodeError = S.is(DecodeError);

const employeeIds = (employees: ReadonlyArray<typeof Employee.Instance.Type>): ReadonlyArray<number> =>
  A.map(employees, (employee) => employee.properties.employeeId);

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

describe("OntologyScope", () => {
  roundTrips("OntologyScope", OntologyScope);

  it.effect(
    "reads the route and query parameters of a scoped request and writes them back",
    Effect.fnUntraced(function* () {
      const scope = yield* exactly(OntologyScope, {
        ontology: "ri.ontology.main.ontology.698267cc-6b48-4d98-beff-29beb24e9361",
        branch: "ri.branch..branch.1",
        transactionId: "txn-42",
        scenarioRid: "ri.ontology.main.scenario.1",
      });
      deepStrictEqual<unknown>(
        [scope.ontology, O.getOrNull(scope.branch), O.getOrNull(scope.transaction), O.getOrNull(scope.scenario)],
        [
          "ri.ontology.main.ontology.698267cc-6b48-4d98-beff-29beb24e9361",
          "ri.branch..branch.1",
          "txn-42",
          "ri.ontology.main.scenario.1",
        ]
      );
    })
  );

  it.effect(
    "needs nothing but the ontology",
    Effect.fnUntraced(function* () {
      const scope = yield* exactly(OntologyScope, { ontology: "default-ontology" });
      assertNone(scope.branch);
      assertNone(scope.transaction);
      assertNone(scope.scenario);
      deepStrictEqual(scope, OntologyScope.make({ ontology: OntologyApiName.make("default-ontology") }));
      const refused = yield* rejections(OntologyScope, [{ ontology: "" }, { branch: "ri.branch..branch.1" }]);
      deepStrictEqual(refused, [true, true]);
    })
  );

  it.effect(
    "is what the context service holds",
    Effect.fnUntraced(function* () {
      const scope = OntologyScope.make({ ontology: OntologyApiName.make("default-ontology") });
      const readOntology = OntologyContext.useSync((held) => held.ontology);
      const ontology = yield* Effect.provideService(readOntology, OntologyContext, scope);
      strictEqual(ontology, "default-ontology");
    })
  );
});

describe("LoadObjectsRequest", () => {
  roundTrips("ReferenceSigningOptions", ReferenceSigningOptions);
  roundTrips("FetchOptions", FetchOptions, 25);
  roundTrips("LoadObjectsRequest", LoadObjectsRequest, 25);

  const employees = { type: "base", objectType: "Employee" };

  it.effect(
    "round-trips the body OSDK sends for a filtered, ordered, paged read",
    Effect.fnUntraced(function* () {
      const request = yield* exactly(LoadObjectsRequest, {
        objectSet: {
          type: "filter",
          objectSet: employees,
          where: { type: "eq", field: "employeeId", value: 50030 },
        },
        select: [],
        selectV2: [
          { type: "property", apiName: "fullName" },
          {
            type: "propertyWithLoadLevel",
            propertyIdentifier: { type: "property", apiName: "address" },
            loadLevel: { type: "extractMainValue" },
          },
        ],
        orderBy: { fields: [{ field: "fullName", direction: "asc" }] },
        pageToken: "v1.second",
        pageSize: 100,
        excludeRid: true,
        snapshot: true,
        loadPropertySecurities: false,
        loadOntologyDefinedDerivedProperties: true,
        defaultLoadLevel: { type: "applyReducers" },
        includeComputeUsage: true,
        referenceSigningOptions: { signMediaReferences: true },
      });
      strictEqual(request.objectSet.type, "filter");
      deepStrictEqual(
        A.map(request.selection, (selector) => selector.type),
        ["property", "propertyWithLoadLevel"]
      );
      assertSome(
        O.map(request.orderBy, (ordering) => ordering.type),
        "fields"
      );
      assertSome(request.pageToken, PageToken.make("v1.second"));
      assertSome(request.pageSize, 100);
      assertFalse(request.includeRid);
      assertTrue(request.snapshot);
      assertFalse(request.loadPropertySecurities);
      assertSome(request.loadOntologyDefinedDerivedProperties, true);
      assertSome(request.defaultLoadLevel, "applyReducers");
      assertSome(request.includeComputeUsage, true);
      assertSome(
        O.flatMap(request.referenceSigningOptions, (signing) => signing.signMediaReferences),
        true
      );
    })
  );

  it.effect(
    "round-trips an ordering by relevance",
    Effect.fnUntraced(function* () {
      const request = yield* exactly(LoadObjectsRequest, {
        objectSet: employees,
        select: [],
        selectV2: [],
        orderBy: { orderType: "relevance", fields: [] },
        excludeRid: false,
        snapshot: false,
        loadPropertySecurities: true,
      });
      assertSome(
        O.map(request.orderBy, (ordering) => ordering.type),
        "relevance"
      );
      assertTrue(request.includeRid);
      assertTrue(request.loadPropertySecurities);
    })
  );

  it.effect(
    "writes the defaults of a request built in code the way OSDK sends them",
    Effect.fnUntraced(function* () {
      const request = LoadObjectsRequest.make({ objectSet: everyone });
      assertFalse(request.includeRid);
      const wire = yield* S.encodeEffect(LoadObjectsRequest)(request);
      deepStrictEqual<unknown>(wire, {
        objectSet: employees,
        select: [],
        selectV2: [],
        excludeRid: true,
        snapshot: false,
        loadPropertySecurities: false,
      });
    })
  );

  it.effect(
    "reads the wire's absent keys by the platform's defaults",
    Effect.fnUntraced(function* () {
      const request = yield* S.decodeUnknownEffect(LoadObjectsRequest)({ objectSet: employees });
      // The platform includes resource identifiers unless told to exclude them.
      assertTrue(request.includeRid);
      assertFalse(request.snapshot);
      assertFalse(request.loadPropertySecurities);
      deepStrictEqual(request.selection, []);
      assertNone(request.orderBy);
      assertNone(request.pageSize);
    })
  );

  it.effect(
    "reads legacy selected names as selectors and writes them under the one selection key",
    Effect.fnUntraced(function* () {
      const request = yield* S.decodeUnknownEffect(LoadObjectsRequest)({
        objectSet: employees,
        select: ["fullName"],
        selectV2: [{ type: "property", apiName: "employeeId" }],
        excludeRid: true,
      });
      const names = A.map(request.selection, (selector) => (selector.type === "property" ? selector.apiName : "?"));
      deepStrictEqual<unknown>(names, ["fullName", "employeeId"]);
      const wire = yield* S.encodeEffect(LoadObjectsRequest)(request);
      deepStrictEqual<unknown>(wire, {
        objectSet: employees,
        select: [],
        selectV2: [
          { type: "property", apiName: "fullName" },
          { type: "property", apiName: "employeeId" },
        ],
        excludeRid: true,
        snapshot: false,
        loadPropertySecurities: false,
      });
    })
  );

  it.effect(
    "negates the wire's exclusion flag in both directions",
    Effect.fnUntraced(function* () {
      const encode = S.encodeEffect(LoadObjectsRequest);
      const included = yield* encode(LoadObjectsRequest.make({ objectSet: everyone, includeRid: true }));
      const excluded = yield* encode(LoadObjectsRequest.make({ objectSet: everyone, includeRid: false }));
      deepStrictEqual([included.excludeRid, excluded.excludeRid], [false, true]);
    })
  );

  it.effect(
    "rejects a request without an object set, with an empty page or with an unknown selector",
    Effect.fnUntraced(function* () {
      const refused = yield* rejections(LoadObjectsRequest, [
        { select: [], selectV2: [] },
        { objectSet: employees, pageSize: 0 },
        { objectSet: employees, pageToken: "" },
        { objectSet: employees, selectV2: [{ type: "column" }] },
        { objectSet: employees, excludeRid: "yes" },
        { objectSet: employees },
      ]);
      deepStrictEqual(refused, [true, true, true, true, true, false]);
    })
  );

  it("carries the options of the typed facade under the same names", () => {
    const options = FetchOptions.make({ pageSize: O.some(10), includeRid: true });
    const request = LoadObjectsRequest.make({ ...options, objectSet: everyone });
    assertSome(request.pageSize, 10);
    assertTrue(request.includeRid);
    assertFalse(defaults.includeRid);
    assertFalse(defaults.snapshot);
    assertNone(defaults.pageToken);
  });
});

describe("LoadObjectsResponse", () => {
  roundTrips("ObjectSetEntities", ObjectSetEntities);
  roundTrips("LoadObjectsResponse", LoadObjectsResponse, 25);

  it.effect(
    "round-trips a full page: rows, cursor, count, compute, securities and entities",
    Effect.fnUntraced(function* () {
      const page = yield* exactly(LoadObjectsResponse, {
        data: [john, jane],
        nextPageToken: "v1.second",
        totalCount: "3",
        computeUsage: 0.25,
        propertySecurities: [
          { disjunction: [{ type: "propertyMarkingSummary", conjunctive: ["secret"] }, { type: "unsupportedPolicy" }] },
        ],
        objectSetEntities: { objectTypeApiNames: ["Employee"] },
      });
      deepStrictEqual<unknown>(
        A.map(page.data, (row) => [row.__apiName, row.__primaryKey, row.__title]),
        [
          ["Employee", 50030, "John Doe"],
          ["Employee", 50031, "Jane Roe"],
        ]
      );
      assertSome(
        O.flatMap(A.head(page.data), (row) => R.get(row, "startedAt")),
        "2019-01-01T00:00:00.000Z"
      );
      // The envelope is decoded and the rows are not: each is the record that arrived, key for key.
      deepStrictEqual<unknown>(page.data, [john, jane]);
      assertTrue(sameType<(typeof page.data)[number], ObjectRecord>(true));
      assertSome(page.nextPageToken, PageToken.make("v1.second"));
      strictEqual(page.totalCount, BigInt(3));
      assertSome(page.computeUsage, 0.25);
      deepStrictEqual(
        A.map(page.propertySecurities, (entry) => A.map(entry.disjunction, (outcome) => outcome.type)),
        [["propertyMarkingSummary", "unsupportedPolicy"]]
      );
      assertSome(
        O.map(page.objectSetEntities, (entities) => entities.objectTypeApiNames),
        [employeeType]
      );
    })
  );

  it.effect(
    "round-trips the last page of an empty set",
    Effect.fnUntraced(function* () {
      const page = yield* exactly(LoadObjectsResponse, { data: [], totalCount: "0", propertySecurities: [] });
      deepStrictEqual(page.data, []);
      assertNone(page.nextPageToken);
      assertNone(page.objectSetEntities);
      assertNone(page.computeUsage);
    })
  );

  it.effect(
    "reads a page from a platform that predates the security table",
    Effect.fnUntraced(function* () {
      const page = yield* S.decodeEffect(LoadObjectsResponse)({ data: [ravi], totalCount: "1" });
      deepStrictEqual(page.propertySecurities, []);
    })
  );

  it.effect(
    "rejects a page without a count, with a negative count or with a row that has no identity",
    Effect.fnUntraced(function* () {
      const refused = yield* rejections(LoadObjectsResponse, [
        { data: [], propertySecurities: [] },
        { data: [], totalCount: "-1", propertySecurities: [] },
        { data: [], totalCount: 3, propertySecurities: [] },
        { data: [{ employeeId: 1 }], totalCount: "1", propertySecurities: [] },
        { data: [], totalCount: "0", propertySecurities: [] },
      ]);
      deepStrictEqual(refused, [true, true, true, true, false]);
    })
  );
});

describe("LoadObjectsResponseOf", () => {
  // The envelope at the instance codec of a model: a whole answer read to typed instances in one step.
  const EmployeePage = LoadObjectsResponseOf("EmployeePage", Employee.Instance);
  // The same envelope at the codec that needs no ontology, named data-last.
  const ObjectPage = LoadObjectsResponseOf(OntologyObject)("ObjectPage");

  roundTrips("LoadObjectsResponseOf(Employee.Instance)", EmployeePage, 25);
  roundTrips("LoadObjectsResponseOf(OntologyObject)", ObjectPage, 25);

  it("is one envelope for every row codec, and the port's response is its instantiation at the wire record", () => {
    type Envelope<Page extends { readonly data: unknown }> = Omit<Page, "data">;
    assertTrue(sameType<Envelope<typeof EmployeePage.Type>, Envelope<typeof ObjectPage.Type>>(true));
    assertTrue(sameType<(typeof EmployeePage.Type)["data"][number], typeof Employee.Instance.Type>(true));
    assertTrue(sameType<(typeof ObjectPage.Type)["data"][number], OntologyObject>(true));
    // Every instantiation has the platform's JSON on its encoded side: the row codec changes the decoded side only.
    assertTrue(sameType<typeof EmployeePage.Encoded, typeof LoadObjectsResponse.Encoded>(true));
    assertTrue(sameType<typeof ObjectPage.Encoded, typeof LoadObjectsResponse.Encoded>(true));
    deepStrictEqual(R.keys(EmployeePage.fields), R.keys(LoadObjectsResponse.fields));
  });

  it.effect(
    "reads a whole answer with the row codec it is given, each row once, and writes it back",
    Effect.fnUntraced(function* () {
      const wire = {
        data: [john, jane],
        nextPageToken: "v1.second",
        totalCount: "3",
        propertySecurities: [],
        objectSetEntities: { objectTypeApiNames: ["Employee"] },
      };
      const typed = yield* exactly(EmployeePage, wire);
      const plain = yield* exactly(ObjectPage, wire);
      const rows = yield* exactly(LoadObjectsResponse, wire);
      deepStrictEqual(employeeIds(typed.data), [50030, 50031]);
      deepStrictEqual(
        A.map(typed.data, (employee) => employee.locator),
        A.map(plain.data, (object) => object.locator)
      );
      // Everything but the rows is the same value at every row codec.
      deepStrictEqual(Struct.omit(typed, ["data"]), Struct.omit(rows, ["data"]));
      deepStrictEqual(Struct.omit(plain, ["data"]), Struct.omit(rows, ["data"]));
      // Decoding the port's rows one by one with the model's codec is the same as reading the answer whole.
      const oneByOne = yield* Effect.forEach(rows.data, (row) => S.decodeEffect(Employee.Instance)(row));
      deepStrictEqual(oneByOne, typed.data);
    })
  );

  it.effect(
    "refuses an answer one of whose rows the row codec refuses, and says which",
    Effect.fnUntraced(function* () {
      const wire = { data: [john, garbled], totalCount: "2" };
      const refusal = yield* Effect.flip(S.decodeEffect(EmployeePage)(wire));
      assertTrue(Str.includes('["data"][1]["properties"]["employeeId"]')(refusal.message));
      // The same answer is two objects when no model reads it, and two rows on the port.
      const plain = yield* S.decodeEffect(ObjectPage)(wire);
      const rows = yield* S.decodeEffect(LoadObjectsResponse)(wire);
      deepStrictEqual([plain.data.length, rows.data.length], [2, 2]);
    })
  );
});

describe("AggregateObjectSetRequest", () => {
  roundTrips("AggregateObjectSetRequest", AggregateObjectSetRequest, 25);
  roundTrips("AggregatedGroup", AggregatedGroup, 25);
  roundTrips("AggregationResult", AggregationResult, 25);

  const employees = { type: "base", objectType: "Employee" };
  const byTeam = { type: "exact", field: "team" };
  const byOffice = { type: "exact", field: "office" };
  const largestFirst = { type: "count", name: "count", direction: "DESC" };

  it.effect(
    "round-trips an exact wire body and reads its singular metrics key",
    Effect.fnUntraced(function* () {
      const request = yield* exactly(AggregateObjectSetRequest, {
        objectSet: employees,
        aggregation: [
          { type: "count", name: "count" },
          { type: "avg", field: "salary", name: "salary.avg" },
        ],
        groupBy: [byTeam],
        accuracy: "REQUIRE_ACCURATE",
        includeComputeUsage: true,
      });
      strictEqual(request.objectSet.type, "base");
      deepStrictEqual(
        A.map(request.aggregations, (metric) => metric.type),
        ["count", "avg"]
      );
      deepStrictEqual(
        A.map(request.groupBy, (grouping) => grouping.type),
        ["exact"]
      );
      assertSome(request.accuracy, "requireAccurate");
      assertSome(request.includeComputeUsage, true);
    })
  );

  it.effect(
    "encodes a request built with the aggregation constructors",
    Effect.fnUntraced(function* () {
      const request = AggregateObjectSetRequest.make({
        objectSet: everyone,
        aggregations: [countMetric(), avg(PropertyApiName.make("salary"))],
        groupBy: [exact(PropertyApiName.make("team"), {})],
      });
      const wire = yield* S.encodeEffect(AggregateObjectSetRequest)(request);
      deepStrictEqual<unknown>(wire, {
        objectSet: employees,
        aggregation: [
          { type: "count", name: "count" },
          { type: "avg", field: "salary", name: "salary.avg" },
        ],
        groupBy: [byTeam],
      });
    })
  );

  it.effect(
    "keeps the rules that tie an ordering metric to the groupings",
    Effect.fnUntraced(function* () {
      const body = (groupBy: ReadonlyArray<unknown>) => ({
        objectSet: employees,
        aggregation: [largestFirst],
        groupBy,
      });
      const refused = yield* rejections(AggregateObjectSetRequest, [
        body([]),
        body([byTeam]),
        body([byTeam, byOffice]),
        body([{ ...byTeam, includeNullValues: true }]),
        { aggregation: [largestFirst], groupBy: [] },
      ]);
      deepStrictEqual(refused, [false, false, true, true, true]);
    })
  );
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

describe("errors", () => {
  generates("HttpStatus", HttpStatus);
  roundTrips("ApiErrorBody", ApiErrorBody);
  generates("ApiError", ApiError);
  generates("ObjectNotFound", ObjectNotFound);
  generates("MultipleObjectsFound", MultipleObjectsFound);
  generates("ActionRejected", ActionRejected, 25);
  generates("TransportFailure", TransportFailure, 25);
  generates("ClientError", ClientError, 25);

  const notFoundBody = {
    errorCode: "NOT_FOUND",
    errorName: "ObjectTypeNotFound",
    errorInstanceId: "b2ae7b3e-2c89-42f5-a762-68957a9c039d",
    parameters: { objectType: "Employe", objectTypeRid: null },
  };

  it.effect(
    "round-trips the platform's error body and pairs it with a status",
    Effect.fnUntraced(function* () {
      yield* exactly(ApiErrorBody, notFoundBody);
      const body = yield* S.decodeEffect(ApiErrorBody)(notFoundBody);
      assertNone(body.errorDescription);
      const error = ApiError.fromBody(404, body);
      deepStrictEqual<unknown>(
        [error._tag, error.status, error.errorCode, error.errorName, error.errorInstanceId, error.parameters],
        ["ApiError", 404, "NOT_FOUND", "ObjectTypeNotFound", notFoundBody.errorInstanceId, notFoundBody.parameters]
      );
      strictEqual(
        error.message,
        "ObjectTypeNotFound (NOT_FOUND, HTTP 404, instance b2ae7b3e-2c89-42f5-a762-68957a9c039d)"
      );
      const described = yield* exactly(ApiErrorBody, { ...notFoundBody, errorDescription: "No such object type" });
      assertSome(described.errorDescription, "No such object type");
    })
  );

  it.effect(
    "reads an error body without details and rejects one without a name",
    Effect.fnUntraced(function* () {
      const body = yield* S.decodeEffect(ApiErrorBody)({
        errorCode: "INTERNAL",
        errorName: "Default:Internal",
        errorInstanceId: "0",
      });
      deepStrictEqual(body.parameters, {});
      const refused = yield* rejections(ApiErrorBody, [
        { errorCode: "INTERNAL", errorInstanceId: "0", parameters: {} },
        { ...notFoundBody, errorName: "" },
      ]);
      deepStrictEqual(refused, [true, true]);
    })
  );

  it("keeps a status code within the range HTTP defines", () => {
    const isStatus = S.is(HttpStatus);
    deepStrictEqual(A.map([100, 404, 599, 99, 600, 200.5], isStatus), [true, true, true, false, false, false]);
  });

  it("builds every case, exercises every guard and matches exhaustively", () => {
    const failures = [
      ClientError.cases.ApiError.make({
        status: 403,
        errorCode: "PERMISSION_DENIED",
        errorName: ErrorName.make("ReadObjectPermissionDenied"),
        errorInstanceId: "1",
      }),
      ClientError.cases.TransportError.make({ message: "Connection reset", cause: "ECONNRESET" }),
      ClientError.cases.DecodeError.make({ message: "Expected a number", cause: "employeeId" }),
      ClientError.cases.ObjectNotFound.make({ objectType: O.some(employeeType) }),
      ClientError.cases.MultipleObjectsFound.make({ objectType: O.some(employeeType) }),
      ClientError.cases.ActionRejected.make({
        action: ActionTypeApiName.make("promoteEmployee"),
        validation: ActionValidation.make({ result: "invalid", submissionCriteria: [], parameters: {} }),
      }),
    ];
    const describeFailure = ClientError.match({
      ApiError: ({ status }) => `refused with ${status}`,
      TransportError: ({ message }) => `unanswered: ${message}`,
      DecodeError: ({ index }) => `unreadable, row known: ${O.isSome(index)}`,
      ObjectNotFound: ({ objectType: apiName }) => `no ${O.getOrNull(apiName)}`,
      MultipleObjectsFound: ({ objectType: apiName }) => `several ${O.getOrNull(apiName)}`,
      ActionRejected: ({ action, validation }) => `${action} not applied: ${validation.result}`,
    });
    deepStrictEqual(
      A.map(failures, (failure) => describeFailure(failure)),
      [
        "refused with 403",
        "unanswered: Connection reset",
        "unreadable, row known: false",
        "no Employee",
        "several Employee",
        "promoteEmployee not applied: invalid",
      ]
    );
    deepStrictEqual(
      A.map(failures, (failure) => failure._tag),
      ["ApiError", "TransportError", "DecodeError", "ObjectNotFound", "MultipleObjectsFound", "ActionRejected"]
    );
    deepStrictEqual(
      A.map(failures, (failure) => [
        ClientError.guards.ApiError(failure),
        ClientError.guards.TransportError(failure),
        ClientError.guards.DecodeError(failure),
        ClientError.guards.ObjectNotFound(failure),
        ClientError.guards.MultipleObjectsFound(failure),
        ClientError.guards.ActionRejected(failure),
      ]),
      [
        [true, false, false, false, false, false],
        [false, true, false, false, false, false],
        [false, false, true, false, false, false],
        [false, false, false, true, false, false],
        [false, false, false, false, true, false],
        [false, false, false, false, false, true],
      ]
    );
    // A transport never decides how many objects a read should find, nor whether an answered action was applied.
    const isTransportFailure = S.is(TransportFailure);
    deepStrictEqual(
      A.map(failures, (failure) => isTransportFailure(failure)),
      [true, true, true, false, false, false]
    );
    const retryable = TransportFailure.match({
      ApiError: ({ status }) => status >= 500,
      TransportError: () => true,
      DecodeError: () => false,
    });
    deepStrictEqual(
      A.map(failures, (failure) => isTransportFailure(failure) && retryable(failure)),
      [false, true, false, false, false, false]
    );
  });

  it("says in words what a single-object read found", () => {
    strictEqual(
      ObjectNotFound.make({ objectType: O.some(employeeType) }).message,
      "Expected exactly one Employee object but the object set holds none"
    );
    strictEqual(
      MultipleObjectsFound.make({ objectType: O.some(employeeType) }).message,
      "Expected exactly one Employee object but the object set holds several"
    );
    // A read of an untyped set was typed by no object type, and its errors name none.
    assertNone(ObjectNotFound.make({}).objectType);
    strictEqual(ObjectNotFound.make({}).message, "Expected exactly one object but the object set holds none");
    strictEqual(
      MultipleObjectsFound.make({}).message,
      "Expected exactly one object but the object set holds several"
    );
  });
});

// ---------------------------------------------------------------------------
// The typed facade, against the stub transport
// ---------------------------------------------------------------------------

it.layer(StubTransport)("the typed facade", (it) => {
  it.effect(
    "fetchPage decodes every object of a page with the instance codec of the set's model",
    Effect.fnUntraced(function* () {
      // The set every combinator starts from is the same pair the fixtures write by hand.
      deepStrictEqual(all(Employee), employeesOf(everyone));
      const page = yield* fetchPage(all(Employee), defaults);
      assertTrue(sameType<(typeof page.data)[number], typeof Employee.Instance.Type>(true));
      deepStrictEqual(employeeIds(page.data), [50030, 50031]);
      deepStrictEqual(
        A.map(page.data, (employee) => [
          employee.locator.objectType,
          employee.locator.primaryKey,
          O.getOrNull(employee.title),
          O.getOrNull(employee.properties.fullName),
          O.getOrNull(O.map(employee.properties.startedAt, DateTime.getPartUtc("year"))),
          O.isNone(employee.rid),
        ]),
        [
          ["Employee", 50030, "John Doe", "John Doe", 2019, true],
          ["Employee", 50031, "Jane Roe", "Jane Roe", null, true],
        ]
      );
      assertSome(page.nextPageToken, PageToken.make("v1.second"));
      assertSome(page.totalCount, BigInt(3));
    })
  );

  it.effect(
    "fetchPage reads the page a token names, piped or called directly",
    Effect.fnUntraced(function* () {
      const second = FetchOptions.make({ pageToken: O.some(PageToken.make("v1.second")) });
      const direct = yield* fetchPage(employeesOf(everyone), second);
      const piped = yield* pipe(employeesOf(everyone), fetchPage(second));
      deepStrictEqual(employeeIds(direct.data), [50032]);
      deepStrictEqual(employeeIds(piped.data), [50032]);
      assertNone(direct.nextPageToken);
    })
  );

  it.effect(
    "stream follows two pages and stops when a page hands back no token",
    Effect.fnUntraced(function* () {
      const employees = yield* Stream.runCollect(stream(employeesOf(everyone), defaults));
      deepStrictEqual(employeeIds(employees), [50030, 50031, 50032]);
      const piped = yield* pipe(employeesOf(everyone), stream(defaults), Stream.runCollect);
      deepStrictEqual(employeeIds(piped), [50030, 50031, 50032]);
    })
  );

  it.effect(
    "stream starts at the token it is given and stops early when its consumer does",
    Effect.fnUntraced(function* () {
      const fromSecond = FetchOptions.make({ pageToken: O.some(PageToken.make("v1.second")) });
      const rest = yield* pipe(stream(employeesOf(everyone), fromSecond), Stream.runCollect);
      deepStrictEqual(employeeIds(rest), [50032]);
      const firstOnly = yield* pipe(stream(employeesOf(everyone), defaults), Stream.take(1), Stream.runCollect);
      deepStrictEqual(employeeIds(firstOnly), [50030]);
      // Asking for no more than the first page holds never requests the second, which here does not exist.
      const withinFirstPage = yield* pipe(stream(employeesOf(cliff), defaults), Stream.take(2), Stream.runCollect);
      deepStrictEqual(employeeIds(withinFirstPage), [50030, 50031]);
      const pastFirstPage = yield* pipe(stream(employeesOf(cliff), defaults), Stream.runCollect, outcomeOf);
      assertSome(
        O.map(pastFirstPage.failure, (failure) => failure._tag),
        "TransportError"
      );
    })
  );

  it.effect(
    "stream reads from a snapshot even when the options do not ask for one",
    Effect.fnUntraced(function* () {
      // The stub serves this set only to snapshot reads, so a plain page read finds no answer.
      const refused = yield* outcomeOf(fetchPage(employeesOf(frozen), defaults));
      assertSome(
        O.map(refused.failure, (failure) => failure._tag),
        "TransportError"
      );
      const asked = yield* fetchPage(employeesOf(frozen), FetchOptions.make({ snapshot: true }));
      deepStrictEqual(employeeIds(asked.data), [50030]);
      const employees = yield* Stream.runCollect(stream(employeesOf(frozen), defaults));
      deepStrictEqual(employeeIds(employees), [50030, 50032]);
    })
  );

  it.effect(
    "fetchOne returns the single object of a set",
    Effect.fnUntraced(function* () {
      const ravindra = yield* fetchOne(employeesOf(onlyRavi), defaults);
      strictEqual(ravindra.properties.employeeId, 50032);
      assertNone(ravindra.properties.fullName);
      const piped = yield* pipe(employeesOf(onlyRavi), fetchOne(defaults));
      strictEqual(piped.properties.employeeId, 50032);
      // An empty first page is not the end of the set: the object on the next page is the one.
      const late = yield* fetchOne(employeesOf(lateArrival), defaults);
      strictEqual(late.properties.employeeId, 50032);
    })
  );

  it.effect(
    "fetchOne fails with ObjectNotFound for an empty set",
    Effect.fnUntraced(function* () {
      const { failure } = yield* outcomeOf(fetchOne(employeesOf(nobody), defaults));
      assertSome(failure, ObjectNotFound.make({ objectType: O.some(employeeType) }));
    })
  );

  it.effect(
    "fetchOne fails with MultipleObjectsFound for two objects, on one page or across two",
    Effect.fnUntraced(function* () {
      const several = MultipleObjectsFound.make({ objectType: O.some(employeeType) });
      const onOnePage = yield* outcomeOf(fetchOne(employeesOf(twins), defaults));
      const acrossPages = yield* outcomeOf(fetchOne(employeesOf(split), defaults));
      const amongMany = yield* outcomeOf(fetchOne(employeesOf(everyone), defaults));
      // Two objects settle the answer, so the page after them is never requested.
      const beforeTheCliff = yield* outcomeOf(fetchOne(employeesOf(cliff), defaults));
      assertSome(onOnePage.failure, several);
      assertSome(acrossPages.failure, several);
      assertSome(amongMany.failure, several);
      assertSome(beforeTheCliff.failure, several);
    })
  );

  it.effect(
    "a row the model cannot read becomes a DecodeError that names the row, not a defect",
    Effect.fnUntraced(function* () {
      const read = yield* outcomeOf(fetchPage(employeesOf(corrupt), defaults));
      assertFalse(read.died);
      const failure = O.filter(read.failure, isDecodeError);
      assertSome(
        O.flatMap(failure, (error) => error.index),
        1
      );
      assertSome(
        O.map(
          O.flatMap(failure, (error) => error.locator),
          (locator) => [locator.objectType, locator.primaryKey]
        ),
        [employeeType, 50033]
      );
      assertTrue(O.exists(failure, (error) => error.message.length > 0));

      const streamed = yield* pipe(stream(employeesOf(corrupt), defaults), Stream.runCollect, outcomeOf);
      assertFalse(streamed.died);
      assertTrue(O.exists(streamed.failure, isDecodeError));
    })
  );

  it.effect(
    "a pair written by hand whose objects are of another object type fails with a DecodeError, not a defect",
    Effect.fnUntraced(function* () {
      // The typed layer cannot build this pair: only a hand-written one names a model its object set does not hold.
      const read = yield* outcomeOf(fetchPage(employeesOf(offices), defaults));
      assertFalse(read.died);
      const failure = O.filter(read.failure, isDecodeError);
      assertSome(
        O.flatMap(failure, (error) => error.index),
        0
      );
      assertSome(
        O.map(
          O.flatMap(failure, (error) => error.locator),
          (locator) => locator.objectType
        ),
        ObjectTypeApiName.make("Office")
      );
    })
  );

  it.effect(
    "a failure of the transport reaches the caller unchanged",
    Effect.fnUntraced(function* () {
      const page = yield* outcomeOf(fetchPage(employeesOf(unknownSet), defaults));
      const one = yield* outcomeOf(fetchOne(employeesOf(unknownSet), defaults));
      const all = yield* pipe(stream(employeesOf(unknownSet), defaults), Stream.runCollect, outcomeOf);
      const tagOf = O.map((failure: ClientError) => failure._tag);
      deepStrictEqual(
        [tagOf(page.failure), tagOf(one.failure), tagOf(all.failure)],
        [O.some("TransportError"), O.some("TransportError"), O.some("TransportError")]
      );
    })
  );

  it.effect(
    "a read takes the typed set whole: the model that decodes is the model of the set, through every combinator",
    Effect.fnUntraced(function* () {
      const byKey = pipe(all(Employee), where(eq(Employee.property("employeeId"), 50030)));
      const leads = pipe(all(Employee), traverse("lead", Employee));
      const Named = pick(Employee, ["fullName"]);
      const named = all(Named);
      // The stub knows a set by its base type or its rid, so only the unfiltered sets get an answer from it.
      const filtered = yield* outcomeOf(pipe(byKey, fetchPage(defaults)));
      const traversed = yield* outcomeOf(pipe(leads, fetchOne(defaults)));
      assertSome(
        O.map(filtered.failure, (failure) => failure._tag),
        "TransportError"
      );
      assertSome(
        O.map(traversed.failure, (failure) => failure._tag),
        "TransportError"
      );
      const page = yield* pipe(named, fetchPage(defaults));
      const first = yield* pipe(named, stream(defaults), Stream.take(1), Stream.runCollect);
      const one = yield* pipe(employeesOf(onlyRavi), fetchOne(defaults));
      // A narrowed model decodes and types only what it kept.
      deepStrictEqual(
        A.map(page.data, (employee) => R.keys(employee.properties)),
        [
          ["employeeId", "fullName"],
          ["employeeId", "fullName"],
        ]
      );
      deepStrictEqual(
        A.map(first, (employee) => employee.properties.employeeId),
        [50030]
      );
      strictEqual(one.properties.employeeId, 50032);
      assertTrue(sameType<(typeof page.data)[number], typeof Named.Instance.Type>(true));
      assertTrue(sameType<(typeof first)[number], typeof Named.Instance.Type>(true));
      assertTrue(sameType<typeof one, typeof Employee.Instance.Type>(true));
      assertTrue(
        sameType<Effect.Success<ReturnType<typeof fetchOneOfLeads>>, typeof Employee.Instance.Type>(true)
      );
    })
  );

  it.effect(
    "a read of an ordered set sends the set's ordering, in place of the options' ordering",
    Effect.fnUntraced(function* () {
      const employees = employeesOf(sorted);
      const employeeId = Employee.property("employeeId");
      const byKeyAscending = PropertyOrdering.make({
        property: PropertyApiName.make("employeeId"),
        direction: O.some("asc"),
      });
      const ascending = FetchOptions.make({ orderBy: O.some(OrderByFields.make({ fields: [byKeyAscending] })) });
      // A set without an ordering is read in the order the options ask for, or in none.
      const unordered = yield* fetchPage(employees, defaults);
      const byOptions = yield* fetchPage(employees, ascending);
      deepStrictEqual(employeeIds(unordered.data), [50031, 50032, 50030]);
      deepStrictEqual(employeeIds(byOptions.data), [50030, 50031, 50032]);
      // An ordered set brings its own ordering, whatever the options say.
      const descending = orderBy(employees, employeeId, "desc");
      const bySet = yield* fetchPage(descending, defaults);
      const bySetOverOptions = yield* pipe(descending, fetchPage(ascending));
      deepStrictEqual(employeeIds(bySet.data), [50032, 50031, 50030]);
      deepStrictEqual(employeeIds(bySetOverOptions.data), [50032, 50031, 50030]);
      // Tie-breakers travel with it, and a stream reads in the same order.
      const byNameThenKey = pipe(employees, orderBy(Employee.property("fullName"), "asc"), thenBy(employeeId, "desc"));
      const streamed = yield* pipe(byNameThenKey, stream(ascending), Stream.runCollect);
      deepStrictEqual(employeeIds(streamed), [50031, 50030, 50032]);
      // The same pair without the ordering beside it is read the way the options ask again.
      const reset = { model: descending.model, objectSet: descending.objectSet };
      const afterReset = yield* fetchPage(reset, ascending);
      deepStrictEqual(employeeIds(afterReset.data), [50030, 50031, 50032]);
      // An ordering the stub has no page for shows that exactly the set's keys were sent.
      const byNameDescending = orderBy(employees, Employee.property("fullName"), "desc");
      const unknownOrdering = yield* outcomeOf(fetchPage(byNameDescending, defaults));
      assertSome(
        O.map(unknownOrdering.failure, (failure) => failure.message),
        "The stub transport has no answer for loadObjects(ri.object-set.main.object-set.sorted, fullName desc)"
      );
    })
  );

  it.effect(
    "the port hands rows on as the records that arrived: nothing is read into them before the facade",
    Effect.fnUntraced(function* () {
      const transport = yield* OntologyTransport;
      const answer = yield* transport.loadObjects(LoadObjectsRequest.make({ objectSet: everyone }));
      deepStrictEqual<unknown>(answer.data, [john, jane]);
      // A row no model could read is still a row: the port does not judge it.
      const unread = yield* transport.loadObjects(LoadObjectsRequest.make({ objectSet: corrupt }));
      deepStrictEqual<unknown>(unread.data, [john, garbled]);
      assertTrue(sameType<(typeof answer.data)[number], ObjectRecord>(true));
    })
  );

  it.effect(
    "every read decodes each row exactly once, with the codec the set carries",
    Effect.fnUntraced(function* () {
      // The Employee codec behind a step that notes the key of every row it is handed. A read that decoded a
      // row twice, or encoded an object back to its record to decode it again, would note the key twice.
      const seen = yield* Ref.make(A.empty<PrimaryKeyValue>());
      const Noted = ObjectRecord.pipe(
        S.decodeTo(
          Employee.Instance,
          SchemaTransformation.transformEffect<ObjectRecord, ObjectRecord>({
            decode: (row) => Effect.as(Ref.update(seen, A.append(row.__primaryKey)), row),
            encode: Effect.succeed,
          })
        )
      );
      const noted = (objectSet: ObjectSet) => ({ model: { apiName: "Employee", Instance: Noted }, objectSet });
      const sinceLast = Ref.getAndSet(seen, A.empty<PrimaryKeyValue>());

      const page = yield* fetchPage(noted(everyone), defaults);
      const afterPage = yield* sinceLast;
      deepStrictEqual(afterPage, [50030, 50031]);
      // The noting codec changes nothing else: the page is the page the model's own codec reads.
      const plain = yield* fetchPage(all(Employee), defaults);
      deepStrictEqual(page.data, plain.data);
      assertTrue(sameType<(typeof page.data)[number], typeof Employee.Instance.Type>(true));

      yield* Stream.runCollect(stream(noted(everyone), defaults));
      const afterStream = yield* sinceLast;
      deepStrictEqual(afterStream, [50030, 50031, 50032]);

      yield* fetchOne(noted(onlyRavi), defaults);
      const afterOne = yield* sinceLast;
      deepStrictEqual(afterOne, [50032]);

      // A row that does not fit is handed to the codec once as well, and no row after it is.
      yield* outcomeOf(fetchPage(noted(corrupt), defaults));
      const afterCorrupt = yield* sinceLast;
      deepStrictEqual(afterCorrupt, [50030, 50033]);
    })
  );

  it.effect(
    "an untyped set goes through the same reads and comes back as OntologyObjects",
    Effect.fnUntraced(function* () {
      const decodeObject = S.decodeEffect(OntologyObject);
      const page = yield* fetchPage(untyped(everyone), defaults);
      const expected = yield* Effect.forEach([john, jane], (row) => decodeObject(row));
      assertTrue(sameType<(typeof page.data)[number], OntologyObject>(true));
      deepStrictEqual(page.data, expected);
      assertSome(page.nextPageToken, PageToken.make("v1.second"));
      assertSome(page.totalCount, BigInt(3));
      // The untyped pair is the plain set beside the codec that needs no ontology, and nothing else.
      deepStrictEqual(Struct.keys(untyped(everyone)), ["model", "objectSet"]);
      strictEqual(untyped(everyone).objectSet, everyone);
      strictEqual(untyped(everyone).model.Instance, OntologyObject);

      // Identity is the same value in both tiers; only the properties differ: JSON here, typed values there.
      const typed = yield* fetchPage(all(Employee), defaults);
      deepStrictEqual(
        A.map(page.data, (object) => object.locator),
        A.map(typed.data, (employee) => employee.locator)
      );
      deepStrictEqual<unknown>(
        A.map(page.data, (object) => R.get(object.properties, PropertyApiName.make("startedAt"))),
        [O.some("2019-01-01T00:00:00.000Z"), O.none()]
      );

      const streamed = yield* pipe(everyone, untyped, stream(defaults), Stream.runCollect);
      deepStrictEqual(
        A.map(streamed, (object) => object.locator.primaryKey),
        [50030, 50031, 50032]
      );
      const one = yield* pipe(onlyRavi, untyped, fetchOne(defaults));
      deepStrictEqual(one.locator, ObjectLocator.make({ objectType: employeeType, primaryKey: 50032 }));

      // No model, so no object type to hold a row to: the row a model refuses and an object of another type
      // are both objects.
      const unjudged = yield* fetchPage(untyped(corrupt), defaults);
      const others = yield* fetchPage(untyped(offices), defaults);
      deepStrictEqual(
        A.map(A.appendAll(unjudged.data, others.data), (object) => [
          object.locator.objectType,
          object.locator.primaryKey,
        ]),
        [
          ["Employee", 50030],
          ["Employee", 50033],
          ["Office", "NYC"],
        ]
      );
    })
  );

  it.effect(
    "fetchOne of an untyped set fails with the same two errors, naming no object type",
    Effect.fnUntraced(function* () {
      const none = yield* outcomeOf(fetchOne(untyped(nobody), defaults));
      const several = yield* outcomeOf(pipe(twins, untyped, fetchOne(defaults)));
      assertSome(none.failure, ObjectNotFound.make({}));
      assertSome(several.failure, MultipleObjectsFound.make({}));
      assertSome(
        O.map(none.failure, (failure) => failure.message),
        "Expected exactly one object but the object set holds none"
      );
      // The transport's own failure reaches the caller unchanged here too.
      const unanswered = yield* outcomeOf(fetchPage(untyped(unknownSet), defaults));
      assertSome(
        O.map(unanswered.failure, (failure) => failure._tag),
        "TransportError"
      );
    })
  );

  it.effect(
    "count reads the object count of an ungrouped aggregation",
    Effect.fnUntraced(function* () {
      const total = yield* count(everyone);
      strictEqual(total, 3);
      // A count decodes no instance, so it takes the plain object set: the one a typed set holds.
      const ofTyped = yield* count(all(Employee).objectSet);
      strictEqual(ofTyped, 3);
      // The stub answers this set with a count that is not a number.
      const counted = yield* outcomeOf(count(nobody));
      assertFalse(counted.died);
      assertTrue(O.exists(counted.failure, isDecodeError));
    })
  );

  it.effect(
    "aggregate regroups each group's metrics into a lookup",
    Effect.fnUntraced(function* () {
      const salary = PropertyApiName.make("salary");
      const byTeam = exact(PropertyApiName.make("team"), {});
      const result = yield* aggregate(everyone, [countMetric(), avg(salary)], [byTeam]);
      strictEqual(result.accuracy, "accurate");
      assertNone(result.excludedItems);
      deepStrictEqual<unknown>(
        A.map(result.groups, ({ group, metrics }) => [
          group,
          O.getOrNull(metrics.count),
          O.getOrNull(O.flatMap(R.get(metrics.properties, salary), (values) => values.avg)),
          metrics.aliased,
        ]),
        [
          [{ team: "platform" }, 2, 91000, {}],
          [{ team: "design" }, 1, null, { headcount: 1 }],
        ]
      );

      const ungrouped = yield* pipe(everyone, aggregate([countMetric()], []));
      assertSome(ungrouped.excludedItems, 0);
      deepStrictEqual(
        A.map(ungrouped.groups, ({ metrics }) => O.getOrNull(metrics.count)),
        [3]
      );
    })
  );

  it.effect(
    "aggregate refuses a request that orders by a metric across two groupings",
    Effect.fnUntraced(function* () {
      const refused = yield* outcomeOf(
        aggregate(
          everyone,
          [ordered(countMetric(), "desc")],
          [exact(PropertyApiName.make("team"), {}), exact(PropertyApiName.make("office"), {})]
        )
      );
      assertFalse(refused.died);
      const failure = O.filter(refused.failure, isDecodeError);
      assertTrue(O.exists(failure, (error) => Str.includes("at most one grouping")(error.message)));
      assertNone(O.flatMap(failure, (error) => error.index));
    })
  );
});

// A transport whose one page holds a row that names no object type.
const NamelessTransport = Layer.mock(OntologyTransport, {
  loadObjects: () => decodePage(pageOf([john, { __apiName: "", __primaryKey: 7, employeeId: 7 }], 2)),
});

it.layer(NamelessTransport)("the read facade, given a row that names no object type", (it) => {
  it.effect(
    "a typed read fails with a DecodeError that names the row's index and no locator",
    Effect.fnUntraced(function* () {
      const read = yield* outcomeOf(fetchPage(all(Employee), defaults));
      assertFalse(read.died);
      const failure = O.filter(read.failure, isDecodeError);
      assertSome(
        O.flatMap(failure, (error) => error.index),
        1
      );
      // The row's own keys yield no locator: an object type name is never empty.
      assertNone(O.flatMap(failure, (error) => error.locator));
      // The port still hands the row on: it is a record with its two identity keys.
      const transport = yield* OntologyTransport;
      const answer = yield* transport.loadObjects(LoadObjectsRequest.make({ objectSet: everyone }));
      strictEqual(answer.data.length, 2);
    })
  );
});

// ---------------------------------------------------------------------------
// Static guarantees. This function is never run: it only has to compile, and every line marked
// `@ts-expect-error` has to fail to. A marker over a line that compiles is itself an error.
// ---------------------------------------------------------------------------

const Office = object({
  apiName: "Office",
  primaryKey: "officeId",
  properties: { officeId: required(string) },
  links: {},
});

// The single lead of everyone, read in a pipeline: its success type is asserted above.
const fetchOneOfLeads = () => pipe(all(Employee), traverse("lead", Employee), fetchOne(defaults));

const staticGuarantees = () => {
  const employees = all(Employee);
  const accepted = [
    fetchPage(employees, defaults),
    pipe(employees, fetchPage(defaults)),
    fetchOne(employees, defaults),
    pipe(employees, fetchOne(defaults)),
    fetchPage(all(Office), defaults),
    fetchPage(orderBy(employees, Employee.property("fullName"), "asc"), defaults),
    fetchPage({ model: Employee, objectSet: everyone }, defaults),
    // An untyped set is a set to read like any other, piped or called directly.
    fetchPage(untyped(everyone), defaults),
    pipe(everyone, untyped, fetchOne(defaults)),
    fetchPage({ model: { Instance: OntologyObject }, objectSet: everyone }, defaults),
  ];
  const streams = [stream(employees, defaults), pipe(employees, stream(defaults))];

  // The model and the object set cannot be given apart, so they cannot disagree. A rejected read still has
  // the type of an effect, which the checker would report on its own, so the page and single-object reads
  // are held to their argument lists: what a data-first call is given.
  // @ts-expect-error a read takes one typed set, not a model and an object set
  const pageApart: Parameters<typeof fetchPage> = [Office, employees.objectSet, defaults];
  // @ts-expect-error a read takes one typed set, not a model and an object set
  const oneApart: Parameters<typeof fetchOne> = [Office, employees.objectSet, defaults];
  // @ts-expect-error the old data-last form, an object set and the options, is gone with it
  const pipedApart: Parameters<typeof fetchPage> = [employees.objectSet, defaults];
  // @ts-expect-error a model alone is not a set to read
  const modelOnly: Parameters<typeof fetchPage> = [Employee, defaults];
  // @ts-expect-error a plain object set has no model to decode its objects with
  const setOnly: Parameters<typeof fetchOne> = [everyone, defaults];
  const pageWhole: Parameters<typeof fetchPage> = [employees, defaults];
  const oneWhole: Parameters<typeof fetchOne> = [{ model: Office, objectSet: employees.objectSet }, defaults];
  const rejected = [
    // @ts-expect-error a read takes one typed set, not a model and an object set
    stream(Office, employees.objectSet, defaults),
    // @ts-expect-error a pipeline pipes the set, not the model
    pipe(Employee, fetchPage(defaults)),
    // @ts-expect-error a pipeline pipes the set, not the model
    pipe(Employee, stream(defaults)),
    // @ts-expect-error a pipeline pipes the typed set, not the plain object set
    pipe(everyone, fetchOne(defaults)),
    // The codec of a set reads the wire row. A schema of anything else is not one.
    // @ts-expect-error a codec that does not read an object record cannot decode the rows of a set
    fetchPage({ model: { Instance: S.String }, objectSet: everyone }, defaults),
    // @ts-expect-error untyped pairs a plain object set with a codec; a typed set already has one
    untyped(employees),
    // Counting and aggregating use no model, so they take the plain object set.
    // @ts-expect-error count takes the plain object set of a typed set
    count(employees),
    // @ts-expect-error aggregate takes the plain object set of a typed set
    aggregate(employees, [countMetric()], []),
  ];
  const argumentLists = [pageApart, oneApart, pipedApart, modelOnly, setOnly, pageWhole, oneWhole];

  return [
    accepted,
    streams,
    rejected,
    argumentLists,
    count(employees.objectSet),
    aggregate(employees.objectSet, [countMetric()], []),
  ];
};

describe("static guarantees of the typed facade", () => {
  it("keeps the negative cases as compile errors", () => {
    strictEqual(typeof staticGuarantees, "function");
    strictEqual(typeof fetchOneOfLeads, "function");
  });
});
