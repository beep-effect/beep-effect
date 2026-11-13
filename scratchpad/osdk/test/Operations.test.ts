import { $ScratchpadId } from "@beep/identity/packages";
import { describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { argumentCodec, argumentsCodec, leafCodec as actionLeafCodec } from "../src/Action/Action.behavior.ts";
import {
  ActionArguments,
  ActionEdits,
  ActionParameterType,
  ActionType,
  ActionValidation,
  AddedObject,
  ApplyActionRequest,
  ApplyActionResponse,
} from "../src/Action/Action.model.ts";
import {
  ActionRejected,
  ApiError,
  applyAction,
  applyActionWithEdits,
  executeQuery,
  FetchOptions,
  fetchPage,
  OntologyTransport,
  validateAction,
} from "../src/Client/index.ts";
import { addObject, FauxWorld, layer } from "../src/Faux/index.ts";
import {
  ActionTypeApiName,
  InterfaceTypeApiName,
  ObjectTypeApiName,
  ParameterId,
  PropertyApiName,
  QueryApiName,
  StructFieldApiName,
} from "../src/Identifier/Identifier.model.ts";
import * as Model from "../src/Model/index.ts";
import { ObjectLocator, OntologyObject, PrimaryKeyValue } from "../src/Object/Object.model.ts";
import { getActionType } from "../src/Ontology/Ontology.behavior.ts";
import { outputCodec, parametersCodec, leafCodec as queryLeafCodec, valueCodec } from "../src/Query/Query.behavior.ts";
import { ExecuteQueryResponse, QueryDataType, QueryType } from "../src/Query/Query.model.ts";
import type { FauxActionHandler, FauxQueryHandler } from "../src/Faux/index.ts";
import type { ObjectSetArgument } from "../src/ObjectSet/ObjectSet.model.ts";

const $I = $ScratchpadId.create("osdk/test/Operations");

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

// Deep equality without tying the expected value to the static type of the actual one.
const same = (actual: unknown, expected: unknown): void => deepStrictEqual(actual, expected);

// Runs an effect and compares what it produced.
const equals = <Value, Failure, Requirements>(effect: Effect.Effect<Value, Failure, Requirements>, expected: unknown) =>
  Effect.map(effect, (actual) => same(actual, expected));

// -----------------------------------------------------------------------------
// The typed models
// -----------------------------------------------------------------------------

const Office = Model.object({
  apiName: "Office",
  primaryKey: "officeId",
  properties: {
    officeId: Model.required(Model.string),
    city: Model.string,
    capacity: Model.integer,
  },
  links: {},
});

const Employee = Model.object({
  apiName: "Employee",
  primaryKey: "employeeId",
  properties: { employeeId: Model.required(Model.integer), fullName: Model.string },
  links: {},
});

// Transcribed from the `promoteEmployeeObject` action type of the OSDK stubs.
const Promote = Model.action({
  apiName: "promoteEmployeeObject",
  parameters: {
    employee: Model.requiredParameter(Model.objectReference(Employee)),
    newTitle: Model.requiredParameter(Model.string),
    newCompensation: Model.requiredParameter(Model.double),
  },
});

// Transcribed from the `createStructPerson` action type of the OSDK stubs.
const CreateStructPerson = Model.action({
  apiName: "createStructPerson",
  parameters: {
    name: Model.requiredParameter(Model.string),
    address: Model.optionalParameter(
      Model.structOf({ city: Model.string, state: Model.string, zipcode: Model.nullable(Model.integer) })
    ),
  },
});

const OpenOffice = Model.action({
  apiName: "openOffice",
  parameters: {
    officeId: Model.requiredParameter(Model.string),
    city: Model.optionalParameter(Model.string),
    capacity: Model.optionalParameter(Model.integer),
  },
});

const CloseEverything = Model.action({ apiName: "closeEverything", parameters: {} });

const Person = Model.structOf({
  firstName: Model.string,
  lastName: Model.string,
  age: Model.nullable(Model.integer),
  object: Model.objectReference(Employee),
});

// Transcribed from the `incrementPersonAgeComplex` query type of the OSDK stubs.
const IncrementPersonAgeComplex = Model.query({
  apiName: "incrementPersonAgeComplex",
  version: O.some("0.0.9"),
  parameters: { person: Model.requiredParameter(Person) },
  output: Person,
});

// Transcribed from the `queryTypeReturnsMap` query type of the OSDK stubs.
const QueryTypeReturnsMap = Model.query({
  apiName: "queryTypeReturnsMap",
  version: O.some("0.1.1"),
  parameters: { peopleMap: Model.requiredParameter(Model.mapOf(Model.objectReference(Employee), Model.string)) },
  output: Model.mapOf(Model.objectReference(Employee), Model.float),
});

const OfficeDirectory = Model.query({
  apiName: "officeDirectory",
  version: O.none(),
  parameters: { minimumCapacity: Model.optionalParameter(Model.integer) },
  output: Model.structOf({
    offices: Model.integer,
    cities: Model.setOf(Model.string),
    largest: Model.nullable(Model.string),
  }),
});

// -----------------------------------------------------------------------------
// Served types, as wire fixtures
// -----------------------------------------------------------------------------

const promoteEmployeeObjectFixture = {
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

const createStructPersonFixture = {
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

const personType = {
  type: "struct",
  fields: [
    { name: "firstName", fieldType: { type: "string" } },
    { name: "lastName", fieldType: { type: "string" } },
    { name: "age", fieldType: { type: "union", unionTypes: [{ type: "integer" }, { type: "null" }] } },
    { name: "object", fieldType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" } },
  ],
};

const complexStructFixture = {
  apiName: "incrementPersonAgeComplex",
  displayName: "incrementAgeComplex",
  parameters: { person: { dataType: personType, required: true } },
  output: personType,
  rid: "ri.function-registry.main.function.b2ae7b3e-2c89-42f5-a762-68957a9c039d",
  version: "0.0.9",
  typeReferences: {},
};

const entrySetFixture = {
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

const openOfficeFixture = {
  apiName: "openOffice",
  parameters: {
    officeId: { displayName: "Office", dataType: { type: "string" }, required: true, typeClasses: [] },
    city: { displayName: "City", dataType: { type: "string" }, required: false, typeClasses: [] },
    capacity: { displayName: "Capacity", dataType: { type: "integer" }, required: false, typeClasses: [] },
  },
  rid: "ri.ontology.main.action-type.open-office",
  operations: [{ type: "createObject", objectTypeApiName: "Office" }],
  status: "ACTIVE",
};

const officeDirectoryFixture = {
  apiName: "officeDirectory",
  parameters: { minimumCapacity: { dataType: { type: "integer" }, required: false } },
  output: {
    type: "struct",
    fields: [
      { name: "offices", fieldType: { type: "integer" } },
      { name: "cities", fieldType: { type: "set", subType: { type: "string" } } },
      { name: "largest", fieldType: { type: "union", unionTypes: [{ type: "string" }, { type: "null" }] } },
    ],
  },
  rid: "ri.function-registry.main.function.office-directory",
  version: "1.2.0",
  typeReferences: {},
};

const decodeActionType = S.decodeUnknownEffect(ActionType);
const decodeQueryType = S.decodeUnknownEffect(QueryType);

// A typed codec and the codec projected from the served type are interchangeable on a wire value: each
// reads it, each writes what the other read, and both write the same canonical wire.
const agree = Effect.fnUntraced(function* (
  typed: S.Codec<unknown, unknown>,
  projected: S.Codec<unknown, unknown>,
  wire: unknown
) {
  const viaTyped = yield* S.decodeUnknownEffect(typed)(wire);
  const viaProjected = yield* S.decodeUnknownEffect(projected)(wire);
  const typedWire = yield* S.encodeUnknownEffect(typed)(viaProjected);
  const projectedWire = yield* S.encodeUnknownEffect(projected)(viaTyped);
  same(typedWire, projectedWire);
  return typedWire;
});

// -----------------------------------------------------------------------------
// The world and its handlers
// -----------------------------------------------------------------------------

const property = (type: string) => ({ dataType: { type }, rid: `ri.property.${type}`, typeClasses: [] });

const worldFixture = {
  ontology: {
    ontology: {
      apiName: "operations",
      displayName: "Operations",
      description: "Two offices held in memory",
      rid: "ri.ontology.main.ontology.operations",
    },
    objectTypes: {
      Office: {
        objectType: {
          apiName: "Office",
          displayName: "Office",
          pluralDisplayName: "Offices",
          aliases: [],
          datasources: [],
          icon: { type: "blueprint", color: "blue", name: "office" },
          primaryKey: "officeId",
          titleProperty: "city",
          properties: { officeId: property("string"), city: property("string"), capacity: property("integer") },
          rid: "ri.ontology.main.object-type.office",
          status: "ACTIVE",
        },
        linkTypes: [],
        implementsInterfaces: [],
        implementsInterfaces2: {},
        sharedPropertyTypeMapping: {},
      },
    },
    actionTypes: { openOffice: openOfficeFixture },
    queryTypes: { officeDirectory: officeDirectoryFixture },
    interfaceTypes: {},
    sharedPropertyTypes: {},
    valueTypes: {},
  },
  objects: [
    { __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", city: "New York", capacity: 120 },
    { __apiName: "Office", __primaryKey: "LDN", officeId: "LDN", city: "London", capacity: 80 },
  ],
};

const World = Effect.orDie(S.decodeUnknownEffect(FauxWorld)(worldFixture));

// What the action handlers were handed, as the wire record of each request, in the order they ran.
class Received extends Context.Service<Received, Ref.Ref<ReadonlyArray<S.Json>>>()($I`Received`) {}

const decodeRow = S.decodeUnknownEffect(OntologyObject);
const encodeArguments = S.encodeEffect(ActionArguments);

// Opens the office the arguments describe: the arguments that set a value are its properties.
const openOffice = (received: Ref.Ref<ReadonlyArray<S.Json>>): FauxActionHandler =>
  Effect.fnUntraced(function* (parameters, world) {
    const wire = yield* Effect.orDie(encodeArguments(parameters));
    yield* Ref.update(received, A.append<S.Json>(wire));
    const properties = R.getSomes(parameters);
    const officeId = O.getOrNull(R.get(properties, ParameterId.make("officeId")));
    const row = yield* Effect.orDie(decodeRow({ ...properties, __apiName: "Office", __primaryKey: officeId }));
    return {
      world: addObject(world, row),
      edits: [AddedObject.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: officeId })],
    };
  });

// Describes the offices that hold at least `minimumCapacity` people, or every office when it is left out.
const officeDirectory: FauxQueryHandler = (parameters, world) => {
  const minimum = pipe(R.get(parameters, ParameterId.make("minimumCapacity")), O.filter(P.isNumber));
  const offices = pipe(
    A.filter(world.objects, (object) => object.locator.objectType === "Office"),
    A.map((object) => ({
      city: pipe(R.get(object.properties, PropertyApiName.make("city")), O.filter(P.isString)),
      capacity: pipe(
        R.get(object.properties, PropertyApiName.make("capacity")),
        O.filter(P.isNumber),
        O.getOrElse(() => 0)
      ),
    })),
    A.filter((office) => O.match(minimum, { onNone: () => true, onSome: (least) => office.capacity >= least }))
  );
  const largest = pipe(
    A.sortWith(
      offices,
      (office) => -office.capacity,
      (left: number, right: number) => (left < right ? -1 : left > right ? 1 : 0)
    ),
    A.head,
    O.flatMap((office) => office.city)
  );
  return Effect.succeed({
    offices: offices.length,
    // The same city twice: a set on the wire may repeat itself.
    cities: A.flatMap(offices, (office) => A.appendAll(A.fromOption(office.city), A.fromOption(office.city))),
    largest: O.getOrNull(largest),
  });
};

const FauxLive = Layer.unwrap(
  Effect.gen(function* () {
    const world = yield* World;
    const received = yield* Ref.make<ReadonlyArray<S.Json>>(A.empty());
    return Layer.merge(
      layer({ world, actions: { openOffice: openOffice(received) }, queries: { officeDirectory } }),
      Layer.succeed(Received, received)
    );
  })
);

const defaults = FetchOptions.make({});

const officeIds = Effect.map(fetchPage(Model.all(Office), defaults), (page) =>
  A.map(page.data, (found) => found.properties.officeId)
);

const isApiError = S.is(ApiError);

// -----------------------------------------------------------------------------
// Static types
// -----------------------------------------------------------------------------

describe("the static types of a typed operation", () => {
  it("an Arguments codec is exact on both sides", () => {
    const proofs: [
      Equals<
        typeof Promote.Arguments.Type,
        { readonly employee: number; readonly newTitle: string; readonly newCompensation: number }
      >,
      Equals<
        typeof CreateStructPerson.Arguments.Type,
        {
          readonly name: string;
          readonly address?: O.Option<{
            readonly city: string;
            readonly state: string;
            readonly zipcode: O.Option<number>;
          }>;
        }
      >,
      Equals<
        typeof CreateStructPerson.Arguments.Encoded,
        {
          readonly name: string;
          readonly address?: {
            readonly city: string;
            readonly state: string;
            readonly zipcode?: number | string | null;
          } | null;
        }
      >,
      Equals<
        typeof OpenOffice.Arguments.Type,
        { readonly officeId: string; readonly city?: O.Option<string>; readonly capacity?: O.Option<number> }
      >,
      // An action without parameters takes the empty record.
      Equals<typeof CloseEverything.Arguments.Type, {}>,
    ] = [true, true, true, true, true];
    same(proofs, [true, true, true, true, true]);
  });

  it("the Parameters and Output codecs of a query are exact", () => {
    type PersonValue = {
      readonly firstName: string;
      readonly lastName: string;
      readonly age: O.Option<number>;
      readonly object: number;
    };
    const proofs: [
      Equals<typeof IncrementPersonAgeComplex.Parameters.Type, { readonly person: PersonValue }>,
      Equals<typeof IncrementPersonAgeComplex.Output.Type, PersonValue>,
      Equals<typeof QueryTypeReturnsMap.Parameters.Type, { readonly peopleMap: HashMap.HashMap<number, string> }>,
      Equals<typeof QueryTypeReturnsMap.Output.Type, HashMap.HashMap<number, number>>,
      // An optional query parameter is an Option under a required key: none leaves the key out.
      Equals<typeof OfficeDirectory.Parameters.Type, { readonly minimumCapacity: O.Option<number> }>,
      Equals<
        typeof OfficeDirectory.Output.Type,
        { readonly offices: number; readonly cities: HashSet.HashSet<string>; readonly largest: O.Option<string> }
      >,
    ] = [true, true, true, true, true, true];
    same(proofs, [true, true, true, true, true, true]);
  });

  it("value specs keep the type of what they wrap", () => {
    const located = Model.mapOf(Model.interfaceObject, Model.listOf(Model.long));
    const flexible = Model.unionOf([Model.string, Model.integer]);
    const members = Model.objectSetOf(Employee);
    const officeKey = Model.objectReference(Office);
    const anyKey = Model.namedObjectReference("Office");
    const proofs: [
      // A reference is typed by the model's own primary key, an untyped one by any key.
      Equals<typeof officeKey.value.Type, string>,
      Equals<typeof anyKey.value.Type, PrimaryKeyValue>,
      // A map keeps the class of an opaque key.
      Equals<typeof located.value.Type, HashMap.HashMap<ObjectLocator, ReadonlyArray<bigint>>>,
      Equals<typeof flexible.value.Type, string | number>,
      Equals<typeof members.value.Type, ObjectSetArgument>,
      Equals<(typeof members)["kind"], "objectSet">,
    ] = [true, true, true, true, true, true];
    same(proofs, [true, true, true, true, true, true]);
    strictEqual(officeKey.kind, "object");
    strictEqual(anyKey.kind, "object");
  });

  it("wrong arguments and wrong specs do not compile", () => {
    const Rename = Model.action({ apiName: "rename", parameters: { id: Model.requiredParameter(Model.string) } });
    const Lookup = Model.query({
      apiName: "lookup",
      version: O.none(),
      parameters: { limit: Model.optionalParameter(Model.integer) },
      output: Model.string,
    });
    const exact = Model.requiredParameter(Model.decimal);
    const refused = [
      // @ts-expect-error a required parameter is missing
      applyAction(Rename)({}),
      // @ts-expect-error an argument has the wrong type
      applyAction(Rename)({ id: 7 }),
      // @ts-expect-error an argument names no parameter
      applyAction(Rename)({ id: "NYC", name: "New York" }),
      // @ts-expect-error the data-first form checks the arguments against the model too
      validateAction({ id: 7 }, Rename),
      // @ts-expect-error an optional action argument is an Option, never the bare value
      applyActionWithEdits(OpenOffice)({ officeId: "SEA", capacity: 40 }),
      // @ts-expect-error an optional query parameter is an Option, never the bare value
      executeQuery(Lookup)({ limit: 5 }),
      // @ts-expect-error a byte is not a type an action parameter can have
      Model.action({ apiName: "level", parameters: { level: Model.requiredParameter(Model.byte) } }),
      // @ts-expect-error a decimal is not a type a query parameter can have
      Model.query({ apiName: "q", version: O.none(), parameters: { exact }, output: Model.string }),
      // @ts-expect-error an attachment property spec reads a reference record, not the argument's identifier
      Model.requiredParameter(Model.attachment),
      // @ts-expect-error an array of property specs is not a list of argument specs
      Model.listOf(Model.array(Model.string)),
      // @ts-expect-error a point property is no argument: an action takes a point as a geohash
      Model.requiredParameter(Model.geopoint),
      // @ts-expect-error the primary key marker makes a spec an object's own: an argument takes the spec it marks
      Model.listOf(Model.required(Model.string)),
    ];
    strictEqual(refused.length, 12);
  });

  // One table per universe: a leaf spec is its tag and the row of the table, so the typed codec and the
  // projected codec of a leaf are one value, not two that a test holds equal.
  it("a leaf spec only an argument or a query has is the row of that universe's leaf table", () => {
    const rows: ReadonlyArray<readonly [spec: Model.ExchangeSpec, row: unknown]> = [
      [Model.attachmentRid, actionLeafCodec.attachment],
      [Model.geohash, actionLeafCodec.geohash],
      [Model.timeSeriesReference, actionLeafCodec.timeSeriesReference],
      [Model.objectTypeName, actionLeafCodec.objectType],
      [Model.scenarioReference, actionLeafCodec.scenarioReference],
      [Model.namedObjectReference("Office"), actionLeafCodec.object],
      [Model.objectSetArgument, actionLeafCodec.objectSet],
      [Model.objectSetOf(Employee), actionLeafCodec.objectSet],
      [Model.interfaceObject, actionLeafCodec.interfaceObject],
      [Model.interfaceObjectOf("Located"), actionLeafCodec.interfaceObject],
      [Model.interfaceObjectSetOf("Located"), queryLeafCodec.interfaceObjectSet],
    ];
    same(
      A.filter(rows, ([spec, row]) => spec.value !== row || spec.member !== row),
      []
    );
    // An action and a query read every leaf tag they both have with the same codec, so a spec built from one
    // table is right in the other: `Model.attachmentRid` is an argument of an action and a value of a query.
    const ofAction: Readonly<Record<string, unknown>> = actionLeafCodec;
    const ofQuery: Readonly<Record<string, unknown>> = queryLeafCodec;
    const common = A.intersection(R.keys(ofAction), R.keys(ofQuery));
    strictEqual(common.length, 15);
    same(
      A.filter(common, (tag) => R.get(ofAction, tag).pipe(O.getOrNull) !== R.get(ofQuery, tag).pipe(O.getOrNull)),
      []
    );
  });

  it("every spec is one representation: a tag, a codec and a shape, read as they are", () => {
    const tags = Model.listOf(Model.string);
    const address = Model.structOf({ city: Model.string, zipcode: Model.nullable(Model.integer) });
    const zipcode = Model.nullable(Model.integer);
    const shapes: ReadonlyArray<readonly [Model.SpecShape, Model.SpecShape]> = [
      [Model.attachmentRid.shape, { type: "leaf" }],
      [Model.string.shape, { type: "leaf" }],
      [Model.vector(3).shape, { type: "vector", dimension: 3 }],
      // A spec is held as it was given: nothing completes or copies it.
      [tags.shape, { type: "list", element: Model.string }],
      [Model.setOf(Model.long).shape, { type: "list", element: Model.long }],
      [zipcode.shape, { type: "nullable", inner: Model.integer }],
      [Model.mapOf(Model.string, Model.integer).shape, { type: "entries", key: Model.string, value: Model.integer }],
      [
        Model.unionOf([Model.string, Model.integer]).shape,
        { type: "union", alternatives: [Model.string, Model.integer] },
      ],
      [Model.objectSetArgument.shape, { type: "reference", target: O.none() }],
      [Model.objectSetOf(Employee).shape, { type: "reference", target: O.some(ObjectTypeApiName.make("Employee")) }],
    ];
    A.forEach(shapes, ([actual, expected]) => same(actual, expected));
    strictEqual(address.shape.type, "struct");
    // A parameter spec is the value spec it was declared from, with the same tag, codec and shape.
    const required = Model.requiredParameter(tags);
    const optional = Model.optionalParameter(address);
    strictEqual(required.shape, tags.shape);
    strictEqual(required.value, tags.value);
    strictEqual(optional.shape, address.shape);
    same(
      [required.kind, optional.kind, required.presence, optional.presence],
      ["array", "struct", "required", "optional"]
    );
    const proofs: [
      typeof required extends Model.ValueSpec<"array"> ? true : false,
      typeof tags extends Model.ValueSpec<"array"> ? true : false,
      typeof Model.string extends Model.ValueSpec<"string"> ? true : false,
      // A parameter is not itself a value to nest: it has no place in a struct.
      typeof required extends Model.ExchangeSpec ? true : false,
    ] = [true, true, true, false];
    same(proofs, [true, true, true, false]);
  });
});

// -----------------------------------------------------------------------------
// Exact wire fixtures
// -----------------------------------------------------------------------------

describe("the codecs of a typed operation, on the wire", () => {
  it.effect(
    "PromoteEmployeeObject: the Arguments codec writes and reads the documented request",
    Effect.fnUntraced(function* () {
      const wire = { employee: 50030, newTitle: "Director", newCompensation: 250000.5 };
      const args = { employee: 50030, newTitle: "Director", newCompensation: 250000.5 };
      yield* equals(S.encodeEffect(Promote.Arguments)(args), wire);
      yield* equals(S.decodeEffect(Promote.Arguments)(wire), args);
      // The projection from the served action type reads and writes the very same record.
      const served = yield* decodeActionType(promoteEmployeeObjectFixture);
      same(Model.actionConformance(Promote, served), []);
      yield* equals(agree(Promote.Arguments, argumentsCodec(served), wire), wire);
    })
  );

  it.effect(
    "ActionTakesStruct: an optional struct argument keeps its three intents and writes an empty field as null",
    Effect.fnUntraced(function* () {
      const encode = S.encodeEffect(CreateStructPerson.Arguments);
      const decode = S.decodeUnknownEffect(CreateStructPerson.Arguments);
      const wire = { name: "testMan", address: { city: "NYC", state: "NY", zipcode: null } };
      const args = { name: "testMan", address: O.some({ city: "NYC", state: "NY", zipcode: O.none<number>() }) };
      yield* equals(encode(args), wire);
      yield* equals(decode(wire), args);
      // Untouched, cleared and set are three records.
      yield* equals(encode({ name: "testMan" }), { name: "testMan" });
      yield* equals(encode({ name: "testMan", address: O.none() }), { name: "testMan", address: null });
      yield* equals(decode({ name: "testMan" }), { name: "testMan" });
      yield* equals(decode({ name: "testMan", address: null }), { name: "testMan", address: O.none() });
      // A field that is not required may be left out of a struct that is read.
      yield* equals(decode({ name: "testMan", address: { city: "NYC", state: "NY" } }), args);
      const served = yield* decodeActionType(createStructPersonFixture);
      const projected = argumentsCodec(served);
      yield* equals(agree(CreateStructPerson.Arguments, projected, wire), wire);
      yield* equals(agree(CreateStructPerson.Arguments, projected, { name: "testMan" }), { name: "testMan" });
      yield* equals(agree(CreateStructPerson.Arguments, projected, { name: "testMan", address: null }), {
        name: "testMan",
        address: null,
      });
      assertNone(S.decodeUnknownOption(CreateStructPerson.Arguments)({ address: null }));
      assertNone(S.decodeUnknownOption(CreateStructPerson.Arguments)({ name: "testMan", address: { city: "NYC" } }));
    })
  );

  it.effect(
    "incrementPersonAgeComplex: the Parameters and Output codecs write and read the documented struct",
    Effect.fnUntraced(function* () {
      const wire = { person: { firstName: "John", lastName: "Doe", age: null, object: 50030 } };
      const parameters = { person: { firstName: "John", lastName: "Doe", age: O.none<number>(), object: 50030 } };
      yield* equals(S.encodeEffect(IncrementPersonAgeComplex.Parameters)(parameters), wire);
      yield* equals(S.decodeEffect(IncrementPersonAgeComplex.Parameters)(wire), parameters);
      const aged = { firstName: "John", lastName: "Doe", age: 43, object: 50030 };
      const output = yield* S.decodeEffect(IncrementPersonAgeComplex.Output)(aged);
      assertSome(output.age, 43);
      yield* equals(S.encodeEffect(IncrementPersonAgeComplex.Output)(output), aged);
      const served = yield* decodeQueryType(complexStructFixture);
      same(Model.queryConformance(IncrementPersonAgeComplex, served), []);
      yield* equals(agree(IncrementPersonAgeComplex.Parameters, parametersCodec(served), wire), wire);
      yield* equals(agree(IncrementPersonAgeComplex.Output, outputCodec(served), aged), aged);
    })
  );

  it.effect(
    "queryTypeReturnsMap: a map travels as entries and is a HashMap keyed by the employee's primary key",
    Effect.fnUntraced(function* () {
      const wire = {
        peopleMap: [
          { key: 50030, value: "John" },
          { key: 50031, value: "Jane" },
        ],
      };
      const parameters = yield* S.decodeEffect(QueryTypeReturnsMap.Parameters)(wire);
      assertSome(HashMap.get(parameters.peopleMap, 50031), "Jane");
      strictEqual(HashMap.size(parameters.peopleMap), 2);
      const again = yield* S.encodeEffect(QueryTypeReturnsMap.Parameters)({
        peopleMap: HashMap.make([50030, "John"]),
      });
      same(again, { peopleMap: [{ key: 50030, value: "John" }] });
      const output = yield* S.decodeEffect(QueryTypeReturnsMap.Output)([{ key: 50030, value: 1.5 }]);
      assertSome(HashMap.get(output, 50030), 1.5);
      const served = yield* decodeQueryType(entrySetFixture);
      same(Model.queryConformance(QueryTypeReturnsMap, served), []);
      yield* equals(agree(QueryTypeReturnsMap.Parameters, parametersCodec(served), wire), wire);
      yield* equals(agree(QueryTypeReturnsMap.Output, outputCodec(served), [{ key: 50030, value: 1.5 }]), [
        { key: 50030, value: 1.5 },
      ]);
    })
  );

  it.effect(
    "an optional query parameter of a nullable type tells left out from null",
    Effect.fnUntraced(function* () {
      const Parameters = S.Struct(Model.inputsOf({ note: Model.optionalParameter(Model.nullable(Model.string)) }));
      const encode = S.encodeEffect(Parameters);
      yield* equals(encode({ note: O.none() }), {});
      yield* equals(encode({ note: O.some(O.none()) }), { note: null });
      yield* equals(encode({ note: O.some(O.some("late")) }), { note: "late" });
      const decode = S.decodeUnknownEffect(Parameters);
      yield* equals(decode({}), { note: O.none() });
      yield* equals(decode({ note: null }), { note: O.some(O.none()) });
    })
  );

  const rid = "ri.attachments.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f";
  const point = { type: "Point", coordinates: [-74.006, 40.7128] };
  const employeeReference = { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" };
  const media = {
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

  // A spec, the served type it stands for, a wire value, and the wire both codecs must write for it.
  const row = (spec: S.Codec<unknown, unknown>, type: unknown, wire: unknown, canonical: unknown = wire) => ({
    spec,
    type,
    wire,
    canonical,
  });

  it.effect(
    "an argument spec is the codec Action.argumentCodec projects for the same parameter type",
    Effect.fnUntraced(function* () {
      const rows = [
        // The scalar constants shared with properties.
        row(Model.boolean.value, { type: "boolean" }, true),
        row(Model.integer.value, { type: "integer" }, 7),
        row(Model.long.value, { type: "long" }, 7, "7"),
        row(Model.long.value, { type: "long" }, "9007199254740993"),
        row(Model.double.value, { type: "double" }, 1.5),
        row(Model.decimal.value, { type: "decimal" }, 3, "3"),
        row(Model.decimal.value, { type: "decimal" }, "2.718281828"),
        row(Model.string.value, { type: "string" }, "NYC"),
        row(Model.date.value, { type: "date" }, "2024-02-29"),
        row(Model.timestamp.value, { type: "timestamp" }, "2024-05-01T09:00:00Z", "2024-05-01T09:00:00.000Z"),
        row(Model.marking.value, { type: "marking" }, "8fb6fbbd-ae5c-4b22-a4dd-a0b3d1a3a2b1"),
        row(Model.mediaReference.value, { type: "mediaReference" }, media),
        row(Model.geoshape.value, { type: "geoshape" }, point),
        row(Model.vector(3).value, { type: "vector", dimension: 3 }, [1, 2, 3]),
        // The tags only arguments have.
        row(Model.attachmentRid.value, { type: "attachment" }, rid),
        row(Model.geohash.value, { type: "geohash" }, point),
        row(Model.timeSeriesReference.value, { type: "timeSeriesReference" }, "wellPressureSeriesId"),
        row(Model.objectTypeName.value, { type: "objectType" }, "Employee"),
        row(Model.scenarioReference.value, { type: "scenarioReference" }, "ri.ontology.main.scenario.what-if"),
        row(Model.namedObjectReference("Employee").value, employeeReference, "EMP-1"),
        row(Model.objectReference(Employee).value, employeeReference, 50030),
        row(Model.objectSetArgument.value, { type: "objectSet" }, "ri.object-set.main.object-set.1"),
        row(Model.objectSetOf(Employee).value, { type: "objectSet" }, { type: "base", objectType: "Employee" }),
        row(
          Model.interfaceObject.value,
          { type: "interfaceObject" },
          { objectTypeApiName: "Office", primaryKeyValue: "NYC" }
        ),
        row(
          Model.interfaceObjectOf("Located").value,
          { type: "interfaceObject", interfaceTypeApiName: "Located" },
          { objectTypeApiName: "Office", primaryKeyValue: "NYC" }
        ),
        row(
          Model.listOf(Model.decimal).value,
          { type: "array", subType: { type: "decimal" } },
          ["2.5", 3],
          ["2.5", "3"]
        ),
        row(
          Model.structOf({ city: Model.string, zipcode: Model.nullable(Model.integer) }).value,
          {
            type: "struct",
            fields: [
              { name: "city", fieldType: { type: "string" }, required: true },
              { name: "zipcode", fieldType: { type: "integer" }, required: false },
            ],
          },
          { city: "NYC" },
          { city: "NYC", zipcode: null }
        ),
      ];
      yield* Effect.forEach(rows, ({ spec, type, wire, canonical }) =>
        Effect.flatMap(S.decodeUnknownEffect(ActionParameterType)(type), (parameterType) =>
          equals(agree(spec, argumentCodec(parameterType), wire), canonical)
        )
      );
      // What the projection refuses, the spec refuses: a vector of another dimension, an empty identifier,
      // a key that is not of the model's key type.
      assertNone(S.decodeOption(Model.vector(3).value)([1, 2]));
      assertNone(S.decodeOption(Model.attachmentRid.value)(""));
      assertNone(S.decodeOption(Model.objectReference(Employee).value)("fifty"));
    })
  );

  it.effect(
    "a query value spec is the codec Query.valueCodec projects for the same data type",
    Effect.fnUntraced(function* () {
      const nullableInteger = { type: "union", unionTypes: [{ type: "integer" }, { type: "null" }] };
      const rows = [
        row(Model.float.value, { type: "float" }, 1.5),
        row(Model.attachmentRid.value, { type: "attachment" }, rid),
        // One member: a HashSet does not promise to hand its members back in the order they came.
        row(
          Model.setOf(Model.string).value,
          { type: "set", subType: { type: "string" } },
          ["alpha", "alpha"],
          ["alpha"]
        ),
        row(Model.setOf(Model.long).value, { type: "set", subType: { type: "long" } }, [7], ["7"]),
        row(
          Model.mapOf(Model.string, Model.integer).value,
          { type: "entrySet", keyType: { type: "string" }, valueType: { type: "integer" } },
          [{ key: "NYC", value: 120 }]
        ),
        row(Model.nullable(Model.integer).value, nullableInteger, null),
        row(Model.nullable(Model.integer).value, nullableInteger, 3),
        row(
          Model.unionOf([Model.string, Model.integer]).value,
          { type: "union", unionTypes: [{ type: "string" }, { type: "integer" }] },
          7
        ),
        row(
          Model.structOf({ name: Model.string, age: Model.nullable(Model.integer) }).value,
          {
            type: "struct",
            fields: [
              { name: "name", fieldType: { type: "string" } },
              { name: "age", fieldType: nullableInteger },
            ],
          },
          { name: "Ada" },
          { name: "Ada", age: null }
        ),
        row(Model.listOf(Model.timestamp).value, { type: "array", subType: { type: "timestamp" } }, []),
        row(Model.objectReference(Employee).value, employeeReference, 50030),
        row(
          Model.interfaceObjectSetOf("Located").value,
          { type: "interfaceObjectSet", interfaceTypeApiName: "Located" },
          { type: "interfaceBase", interfaceType: "Located" }
        ),
      ];
      yield* Effect.forEach(rows, ({ spec, type, wire, canonical }) =>
        Effect.flatMap(S.decodeUnknownEffect(QueryDataType)(type), (dataType) =>
          equals(agree(spec, valueCodec(dataType, {}), wire), canonical)
        )
      );
    })
  );

  it.effect(
    "sets collapse duplicates, references are written as what identifies their target",
    Effect.fnUntraced(function* () {
      const tags = yield* S.decodeEffect(Model.setOf(Model.string).value)(["alpha", "bravo", "alpha"]);
      strictEqual(HashSet.size(tags), 2);
      yield* equals(S.encodeEffect(Model.setOf(Model.long).value)(HashSet.make(BigInt(7))), ["7"]);
      const members = yield* S.encodeEffect(Model.objectSetOf(Employee).value)(Model.all(Employee).objectSet);
      same(members, { type: "base", objectType: "Employee" });
      const stored = yield* S.decodeEffect(Model.objectSetArgument.value)("ri.object-set.main.object-set.1");
      assertTrue(P.isString(stored));
      const locator = ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "NYC" });
      yield* equals(S.encodeEffect(Model.interfaceObject.value)(locator), {
        objectTypeApiName: "Office",
        primaryKeyValue: "NYC",
      });
      const groups = yield* S.decodeEffect(Model.threeDimensionalAggregation.value)({
        groups: [{ key: "Q-AFN", groups: [{ key: { startValue: 0, endValue: 10 }, value: 65 }] }],
      });
      strictEqual(groups.groups.length, 1);
    })
  );
});

// -----------------------------------------------------------------------------
// Conformance
// -----------------------------------------------------------------------------

describe("conformance of a typed operation to the served type", () => {
  const employee = ParameterId.make("employee");
  const newTitle = ParameterId.make("newTitle");
  const newCompensation = ParameterId.make("newCompensation");

  it.effect(
    "an action model that conforms has no findings, and each drift is its own finding",
    Effect.fnUntraced(function* () {
      const drifted = yield* decodeActionType({
        ...promoteEmployeeObjectFixture,
        apiName: "promoteEmployee",
        parameters: {
          // The reference now ranges over another object type.
          employee: {
            displayName: "Employee",
            dataType: { type: "object", objectApiName: "Contractor", objectTypeApiName: "Contractor" },
            required: true,
            typeClasses: [],
          },
          // The title became a number and is no longer required.
          newTitle: { displayName: "New Title", dataType: { type: "integer" }, required: false, typeClasses: [] },
          // `newCompensation` is gone, and two parameters appeared: only the required one matters.
          approver: { displayName: "Approver", dataType: { type: "string" }, required: true, typeClasses: [] },
          note: { displayName: "Note", dataType: { type: "string" }, required: false, typeClasses: [] },
        },
      });
      same(Model.actionConformance(Promote, drifted), [
        Model.ActionNameMismatch.make({
          declared: ActionTypeApiName.make("promoteEmployeeObject"),
          served: ActionTypeApiName.make("promoteEmployee"),
        }),
        Model.ReferenceTargetMismatch.make({
          parameter: O.some(employee),
          path: [],
          declared: ObjectTypeApiName.make("Employee"),
          served: ObjectTypeApiName.make("Contractor"),
        }),
        Model.ValueTagMismatch.make({ parameter: O.some(newTitle), path: [], declared: "string", served: "integer" }),
        Model.RequiredMismatch.make({ parameter: newTitle, path: [], declared: true, served: false }),
        Model.MissingParameter.make({ parameter: newCompensation }),
        Model.UndeclaredRequiredParameter.make({ parameter: ParameterId.make("approver") }),
      ]);
      // The data-last form gives the same findings.
      same(pipe(Promote, Model.actionConformance(drifted)), Model.actionConformance(Promote, drifted));
    })
  );

  it.effect(
    "an action finding points into a struct through its path",
    Effect.fnUntraced(function* () {
      const conforming = yield* decodeActionType(createStructPersonFixture);
      same(Model.actionConformance(CreateStructPerson, conforming), []);
      const address = ParameterId.make("address");
      const drifted = yield* decodeActionType({
        ...createStructPersonFixture,
        parameters: {
          ...createStructPersonFixture.parameters,
          address: {
            displayName: "Address",
            dataType: {
              type: "struct",
              fields: [
                { name: "city", fieldType: { type: "integer" }, required: false },
                { name: "zipcode", fieldType: { type: "integer" }, required: true },
              ],
            },
            required: false,
            typeClasses: [],
          },
        },
      });
      const field = (name: string) => [Model.FieldStep.make({ name: StructFieldApiName.make(name) })];
      same(Model.actionConformance(CreateStructPerson, drifted), [
        Model.RequiredMismatch.make({ parameter: address, path: field("city"), declared: true, served: false }),
        Model.ValueTagMismatch.make({
          parameter: O.some(address),
          path: field("city"),
          declared: "string",
          served: "integer",
        }),
        Model.MissingValueField.make({
          parameter: O.some(address),
          path: [],
          field: StructFieldApiName.make("state"),
        }),
        Model.RequiredMismatch.make({ parameter: address, path: field("zipcode"), declared: false, served: true }),
      ]);
    })
  );

  it.effect(
    "a list, an interface reference and a tag from another universe are compared in place",
    Effect.fnUntraced(function* () {
      const Notify = Model.action({
        apiName: "notify",
        parameters: {
          recipients: Model.requiredParameter(Model.listOf(Model.string)),
          about: Model.requiredParameter(Model.interfaceObjectOf("Located")),
          attachment: Model.optionalParameter(Model.attachmentRid),
        },
      });
      const served = yield* decodeActionType({
        apiName: "notify",
        parameters: {
          recipients: {
            displayName: "Recipients",
            dataType: { type: "array", subType: { type: "integer" } },
            required: true,
            typeClasses: [],
          },
          about: {
            displayName: "About",
            dataType: { type: "interfaceObject", interfaceTypeApiName: "Tracked" },
            required: true,
            typeClasses: [],
          },
          attachment: { displayName: "Attachment", dataType: { type: "attachment" }, required: false, typeClasses: [] },
        },
        rid: "ri.ontology.main.action-type.notify",
        operations: [],
        status: "ACTIVE",
      });
      same(Model.actionConformance(Notify, served), [
        Model.ValueTagMismatch.make({
          parameter: O.some(ParameterId.make("recipients")),
          path: [Model.ElementStep.make({})],
          declared: "string",
          served: "integer",
        }),
        Model.ReferenceTargetMismatch.make({
          parameter: O.some(ParameterId.make("about")),
          path: [],
          declared: InterfaceTypeApiName.make("Located"),
          served: InterfaceTypeApiName.make("Tracked"),
        }),
      ]);
    })
  );

  it.effect(
    "a query model is compared by name, version, parameters and output",
    Effect.fnUntraced(function* () {
      const person = ParameterId.make("person");
      const field = (name: string) => [Model.FieldStep.make({ name: StructFieldApiName.make(name) })];
      const drifted = yield* decodeQueryType({
        ...complexStructFixture,
        apiName: "incrementPersonAge",
        version: "0.1.0",
        parameters: {
          person: { dataType: personType, required: false },
          dryRun: { dataType: { type: "boolean" }, required: true },
        },
        output: {
          type: "struct",
          fields: [
            { name: "firstName", fieldType: { type: "string" } },
            // The age is no longer nullable, and the reference ranges over another object type.
            { name: "age", fieldType: { type: "integer" } },
            { name: "object", fieldType: { type: "object", objectApiName: "Person", objectTypeApiName: "Person" } },
          ],
        },
      });
      same(Model.queryConformance(IncrementPersonAgeComplex, drifted), [
        Model.QueryNameMismatch.make({
          declared: QueryApiName.make("incrementPersonAgeComplex"),
          served: QueryApiName.make("incrementPersonAge"),
        }),
        Model.QueryVersionMismatch.make({ declared: "0.0.9", served: drifted.version }),
        Model.RequiredMismatch.make({ parameter: person, path: [], declared: true, served: false }),
        Model.UndeclaredRequiredParameter.make({ parameter: ParameterId.make("dryRun") }),
        Model.MissingValueField.make({ parameter: O.none(), path: [], field: StructFieldApiName.make("lastName") }),
        Model.ValueTagMismatch.make({ parameter: O.none(), path: field("age"), declared: "union", served: "integer" }),
        Model.ReferenceTargetMismatch.make({
          parameter: O.none(),
          path: field("object"),
          declared: ObjectTypeApiName.make("Employee"),
          served: ObjectTypeApiName.make("Person"),
        }),
      ]);
      same(
        pipe(IncrementPersonAgeComplex, Model.queryConformance(drifted)),
        Model.queryConformance(IncrementPersonAgeComplex, drifted)
      );
    })
  );

  it.effect(
    "a query output is compared through sets, maps and by-name type references",
    Effect.fnUntraced(function* () {
      const Report = Model.query({
        apiName: "report",
        version: O.none(),
        parameters: {},
        output: Model.structOf({
          tags: Model.setOf(Model.string),
          headcounts: Model.mapOf(Model.string, Model.integer),
          lead: Model.nullable(Model.objectReference(Employee)),
        }),
      });
      const signature = (fields: ReadonlyArray<unknown>) => ({
        apiName: "report",
        parameters: {},
        output: { type: "typeReference", typeId: "report" },
        rid: "ri.function-registry.main.function.report",
        version: "2.0.0",
        typeReferences: {
          report: { type: "struct", fields },
          count: { type: "typeReference", typeId: "whole" },
          whole: { type: "integer" },
        },
      });
      const conforming = yield* decodeQueryType(
        signature([
          { name: "tags", fieldType: { type: "set", subType: { type: "string" } } },
          {
            name: "headcounts",
            fieldType: {
              type: "entrySet",
              keyType: { type: "string" },
              valueType: { type: "typeReference", typeId: "count" },
            },
          },
          {
            name: "lead",
            fieldType: {
              type: "union",
              unionTypes: [
                { type: "null" },
                { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" },
              ],
            },
          },
        ])
      );
      // A model that pins no version is not compared by version.
      same(Model.queryConformance(Report, conforming), []);
      const drifted = yield* decodeQueryType(
        signature([
          { name: "tags", fieldType: { type: "array", subType: { type: "string" } } },
          {
            name: "headcounts",
            fieldType: { type: "entrySet", keyType: { type: "integer" }, valueType: { type: "string" } },
          },
          { name: "lead", fieldType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" } },
        ])
      );
      const field = (name: string) => Model.FieldStep.make({ name: StructFieldApiName.make(name) });
      same(Model.queryConformance(Report, drifted), [
        Model.ValueTagMismatch.make({ parameter: O.none(), path: [field("tags")], declared: "set", served: "array" }),
        Model.ValueTagMismatch.make({
          parameter: O.none(),
          path: [field("headcounts"), field("key")],
          declared: "string",
          served: "integer",
        }),
        Model.ValueTagMismatch.make({
          parameter: O.none(),
          path: [field("headcounts"), field("value")],
          declared: "integer",
          served: "string",
        }),
        Model.ValueTagMismatch.make({
          parameter: O.none(),
          path: [field("lead")],
          declared: "union",
          served: "object",
        }),
      ]);
    })
  );
});

// -----------------------------------------------------------------------------
// End to end: typed actions and queries over the in-memory transport
// -----------------------------------------------------------------------------

it.layer(FauxLive)("typed actions and queries over the in-memory transport", (it) => {
  it.effect(
    "the models conform to the action and query types the transport serves",
    Effect.fnUntraced(function* () {
      const transport = yield* OntologyTransport;
      const ontology = yield* transport.loadOntology(O.none());
      const servedAction = yield* Effect.fromOption(getActionType(ontology, ActionTypeApiName.make("openOffice")));
      same(Model.actionConformance(OpenOffice, servedAction), []);
      const servedQuery = yield* Effect.fromOption(
        A.findFirst(R.values(ontology.queryTypes), (queryType) => queryType.apiName === "officeDirectory")
      );
      same(Model.queryConformance(OfficeDirectory, servedQuery), []);
    })
  );

  it.effect(
    "a typed action applies and the next typed read sees the new object",
    Effect.fnUntraced(function* () {
      yield* equals(officeIds, ["NYC", "LDN"]);
      const nothing = yield* applyAction(OpenOffice)({ officeId: "SEA", city: O.some("Seattle") });
      strictEqual(nothing, undefined);
      yield* equals(officeIds, ["NYC", "LDN", "SEA"]);
      const page = yield* fetchPage(Model.all(Office), defaults);
      const seattle = yield* Effect.fromOption(A.findFirst(page.data, (found) => found.properties.officeId === "SEA"));
      assertSome(seattle.properties.city, "Seattle");
      assertNone(seattle.properties.capacity);
    })
  );

  it.effect(
    "untouched, cleared and set optional parameters reach the handler as three wire records",
    Effect.fnUntraced(function* () {
      const received = yield* Received;
      yield* Ref.set(received, A.empty());
      yield* applyAction(OpenOffice)({ officeId: "BER" });
      yield* applyAction(OpenOffice)({ officeId: "BER", capacity: O.none() });
      yield* applyAction(OpenOffice)({ officeId: "BER", capacity: O.some(40), city: O.none() });
      // The data-first form sends the same request.
      yield* applyAction({ officeId: "BER", city: O.some("Berlin") }, OpenOffice);
      yield* equals(Ref.get(received), [
        { officeId: "BER" },
        { officeId: "BER", capacity: null },
        { officeId: "BER", capacity: 40, city: null },
        { officeId: "BER", city: "Berlin" },
      ]);
    })
  );

  it.effect(
    "an action applied for its edits returns what the handler changed",
    Effect.fnUntraced(function* () {
      const edits = yield* applyActionWithEdits(OpenOffice)({ officeId: "TYO", capacity: O.some(10) });
      const added = ActionEdits.match(edits, {
        edits: ({ edits: listed, addedObjectCount }) => [listed.length, addedObjectCount],
        largeScaleEdits: () => [-1, -1],
      });
      same(added, [1, 1]);
      const ids = yield* officeIds;
      assertTrue(A.contains(ids, "TYO"));
    })
  );

  it.effect(
    "validating a typed action runs no handler, and a refusal of the transport passes through",
    Effect.fnUntraced(function* () {
      const received = yield* Received;
      yield* Ref.set(received, A.empty());
      const before = yield* officeIds;
      const validation = yield* validateAction(OpenOffice)({ officeId: "OSL", capacity: O.some(5) });
      strictEqual(validation.result, "valid");
      yield* equals(Ref.get(received), []);
      yield* equals(officeIds, before);
      const refused = yield* Effect.flip(validateAction(CloseEverything)({}));
      // The refusal is the transport's own error, untouched.
      same(isApiError(refused) ? [refused.status, refused.errorName] : [], [404, "FauxUnregisteredHandler"]);
      const notApplied = yield* Effect.flip(applyAction(CloseEverything)({}));
      strictEqual(notApplied._tag, "ApiError");
    })
  );

  it.effect(
    "a typed query sends its parameters and returns its typed output",
    Effect.fnUntraced(function* () {
      const large = yield* executeQuery(OfficeDirectory)({ minimumCapacity: O.some(100) });
      strictEqual(large.offices, 1);
      // The handler lists every city twice; a set holds it once.
      same(A.fromIterable(large.cities), ["New York"]);
      assertSome(large.largest, "New York");
      const none = yield* executeQuery({ minimumCapacity: O.some(100000) }, OfficeDirectory);
      strictEqual(none.offices, 0);
      strictEqual(HashSet.size(none.cities), 0);
      assertNone(none.largest);
      // Leaving the parameter out is not the same call: every office counts.
      const every = yield* executeQuery(OfficeDirectory)({ minimumCapacity: O.none() });
      assertTrue(every.offices >= 2);
      assertTrue(HashSet.has(every.cities, "London"));
    })
  );

  it.effect(
    "a query nobody registered is refused by the transport, not by the facade",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(
        executeQuery(IncrementPersonAgeComplex)({
          person: { firstName: "John", lastName: "Doe", age: O.none(), object: 50030 },
        })
      );
      strictEqual(error._tag, "ApiError");
    })
  );
});

// -----------------------------------------------------------------------------
// What the facade does with answers the in-memory transport never gives
// -----------------------------------------------------------------------------

const invalid = ActionValidation.make({ result: "invalid", submissionCriteria: [], parameters: {} });

// Records every request it is sent, and answers the way the name of the action or query asks.
const Scripted = Layer.unwrap(
  Effect.gen(function* () {
    const received = yield* Ref.make<ReadonlyArray<S.Json>>(A.empty());
    const record = (entry: S.Json) => Ref.update(received, A.append<S.Json>(entry));
    return Layer.merge(
      Layer.mock(OntologyTransport, {
        applyAction: Effect.fn("Scripted.applyAction")(function* (
          action: ActionTypeApiName,
          request: ApplyActionRequest
        ) {
          const wire = yield* Effect.orDie(S.encodeEffect(ApplyActionRequest)(request));
          yield* record({
            action,
            parameters: wire.parameters,
            mode: request.options.mode,
            returnEdits: request.options.returnEdits,
          });
          return action === "rejected"
            ? ApplyActionResponse.make({ validation: O.some(invalid) })
            : ApplyActionResponse.make({});
        }),
        executeQuery: Effect.fn("Scripted.executeQuery")(function* (query, request, version) {
          yield* record({ query, parameters: request.parameters, version: O.getOrNull(version) });
          return ExecuteQueryResponse.make({ value: query === "malformed" ? { offices: "many" } : "ok" });
        }),
      }),
      Layer.succeed(Received, received)
    );
  })
);

it.layer(Scripted)("the typed facade over a scripted transport", (it) => {
  const parameters = { id: Model.requiredParameter(Model.string), badge: Model.optionalParameter(Model.long) };
  const Accepted = Model.action({ apiName: "accepted", parameters });
  const Rejected = Model.action({ apiName: "rejected", parameters });

  it.effect(
    "a request carries the encoded arguments and asks for edits only when edits are wanted",
    Effect.fnUntraced(function* () {
      const received = yield* Received;
      yield* Ref.set(received, A.empty());
      yield* applyAction(Accepted)({ id: "a", badge: O.some(BigInt("9007199254740993")) });
      const withoutEdits = yield* Effect.flip(applyActionWithEdits(Accepted)({ id: "a" }));
      // The transport answered without edits although they were asked for.
      strictEqual(withoutEdits._tag, "DecodeError");
      yield* equals(Ref.get(received), [
        {
          action: "accepted",
          // A 64-bit integer travels as text.
          parameters: { id: "a", badge: "9007199254740993" },
          mode: "validateAndExecute",
          returnEdits: "none",
        },
        {
          action: "accepted",
          parameters: { id: "a" },
          mode: "validateAndExecute",
          // Every edit, deletions included.
          returnEdits: "allV2WithDeletions",
        },
      ]);
    })
  );

  it.effect(
    "an action the platform reports invalid fails with the validation report",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(applyAction(Rejected)({ id: "a" }));
      same(error, ActionRejected.make({ action: ActionTypeApiName.make("rejected"), validation: invalid }));
      strictEqual(error._tag === "ActionRejected" ? error.validation.result : "", "invalid");
    })
  );

  it.effect(
    "a model whose name is empty fails before anything is sent",
    Effect.fnUntraced(function* () {
      const received = yield* Received;
      yield* Ref.set(received, A.empty());
      const Nameless = Model.action({ apiName: "", parameters });
      const unapplied = yield* Effect.flip(applyAction(Nameless)({ id: "a" }));
      strictEqual(unapplied._tag, "DecodeError");
      const unvalidated = yield* Effect.flip(validateAction(Nameless)({ id: "a" }));
      strictEqual(unvalidated._tag, "DecodeError");
      const Unversioned = Model.query({
        apiName: "lookup",
        version: O.some("latest"),
        parameters: {},
        output: Model.string,
      });
      const uncalled = yield* Effect.flip(executeQuery(Unversioned)({}));
      strictEqual(uncalled._tag, "DecodeError");
      yield* equals(Ref.get(received), []);
    })
  );

  it.effect(
    "a query call names its version and a malformed answer is a DecodeError",
    Effect.fnUntraced(function* () {
      const received = yield* Received;
      yield* Ref.set(received, A.empty());
      const Greeting = Model.query({
        apiName: "greeting",
        version: O.some("1.2.3"),
        parameters: { since: Model.requiredParameter(Model.date), limit: Model.optionalParameter(Model.integer) },
        output: Model.string,
      });
      const since = yield* S.decodeEffect(Model.date.value)("2024-02-29");
      yield* equals(executeQuery(Greeting)({ since, limit: O.none() }), "ok");
      const Malformed = Model.query({
        apiName: "malformed",
        version: O.none(),
        parameters: {},
        output: Model.structOf({ offices: Model.integer }),
      });
      const error = yield* Effect.flip(executeQuery(Malformed)({}));
      strictEqual(error._tag, "DecodeError");
      yield* equals(Ref.get(received), [
        { query: "greeting", parameters: { since: "2024-02-29" }, version: "1.2.3" },
        { query: "malformed", parameters: {}, version: null },
      ]);
    })
  );
});
