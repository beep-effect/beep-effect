/**
 * The README's tour, as tests.
 *
 * Every code block of the tour in `../README.md` is one region of this file, copied verbatim (imports aside: the
 * README imports from `@beep/scratchpad/osdk/src/index`). The test of each block holds the comments inside its
 * regions to what the code actually does, and the last suite re-reads the README and fails when one of its
 * blocks is not in this file. Block (g) needs two handlers for the in-memory transport; they sit above its region
 * and are not part of the README.
 */
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual, throws } from "@effect/vitest/utils";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { Action, Agent, DataType, DerivedProperty, Geo, Media } from "../src/index.ts";
// #region imports
import * as A from "effect/Array";
import * as BigDecimal from "effect/BigDecimal";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  Client,
  Faux,
  Filter,
  Identifier,
  Model,
  Object as Objects,
  ObjectSet,
  Ontology,
  Property,
} from "../src/index.ts";
import type { LocalDate } from "@beep/schema/LocalDate";
// #endregion

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

// Compiles only when the two types are exactly equal: the argument must then be `true`.
const exactly = <Left, Right>(proof: Equals<Left, Right>): boolean => proof;

// #region models
const Office = Model.object({
  apiName: "Office",
  primaryKey: "officeId",
  properties: { officeId: Model.required(Model.string), entrance: Model.geopoint },
  links: { occupants: Model.many("Employee") },
});

const Employee = Model.object({
  apiName: "Employee",
  primaryKey: "employeeId",
  properties: {
    employeeId: Model.required(Model.integer),
    fullName: Model.string,
    startedAt: Model.timestamp,
    birthday: Model.date,
    badge: Model.long,
    salary: Model.decimal,
    skills: Model.array(Model.string),
    address: Model.struct({ city: Model.string, postcode: Model.string }),
  },
  links: { office: Model.one("Office"), reports: Model.many("Employee") },
});

// The static type is the Type side of a codec. Nothing else computes it.
type Employee = typeof Employee.Instance.Type;

// The same type written out by hand. The test holds the two exactly equal.
// It is the one instance shape of the library: the dynamic `Object.instanceCodec` decodes to the same six keys.
type EmployeeWrittenOut = {
  readonly locator: Objects.ObjectLocator;
  readonly rid: O.Option<Identifier.ObjectRid>;
  readonly title: O.Option<string>;
  readonly score: O.Option<number>;
  readonly properties: {
    readonly employeeId: number;
    readonly fullName: O.Option<string>;
    readonly startedAt: O.Option<DateTime.Utc>;
    readonly birthday: O.Option<LocalDate>;
    readonly badge: O.Option<bigint>;
    readonly salary: O.Option<BigDecimal.BigDecimal>;
    readonly skills: O.Option<ReadonlyArray<string>>;
    readonly address: O.Option<{ readonly city: O.Option<string>; readonly postcode: O.Option<string> }>;
  };
  readonly undeclared: { readonly [name: Identifier.PropertyApiName]: S.Json };
};
// #endregion

// #region ontology
// An ontology definition as the platform serves it. The annotation checks the literal against the wire type.
const served: typeof Ontology.OntologyDefinition.Encoded = {
  ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
  objectTypes: {
    Office: {
      objectType: {
        apiName: "Office",
        displayName: "Office",
        pluralDisplayName: "Offices",
        status: "ACTIVE",
        icon: { type: "blueprint", color: "blue", name: "office" },
        rid: "ri.ontology.main.object-type.office",
        primaryKey: "officeId",
        titleProperty: "officeId",
        properties: {
          officeId: { dataType: { type: "string" }, rid: "ri.ontology.main.property.office-id" },
          entrance: { dataType: { type: "geoshape" }, rid: "ri.ontology.main.property.entrance" },
        },
      },
      linkTypes: [
        {
          apiName: "occupants",
          displayName: "Occupants",
          status: "ACTIVE",
          objectTypeApiName: "Employee",
          cardinality: "MANY",
          linkTypeRid: "ri.ontology.main.link-type.occupancy",
        },
      ],
      implementsInterfaces: [],
      implementsInterfaces2: {},
      sharedPropertyTypeMapping: {},
    },
  },
  actionTypes: {},
  queryTypes: {},
  interfaceTypes: {},
  sharedPropertyTypes: {},
  valueTypes: {},
};
// #endregion

// #region world
// A world is data: an ontology, objects and links in their wire forms. The layer interprets requests over it.
const World = S.decodeEffect(Faux.FauxWorld)({
  ontology: served,
  objects: [
    { __apiName: "Office", __primaryKey: "NYC", __title: "New York", officeId: "NYC" },
    {
      __apiName: "Office",
      __primaryKey: "LYS",
      __title: "Lyon",
      officeId: "LYS",
      entrance: { type: "Point", coordinates: [4.8357, 45.764] },
    },
  ],
}).pipe(Effect.orDie);

const InMemory = Layer.unwrap(Effect.map(World, (world) => Faux.layer({ world, actions: {}, queries: {} })));
// #endregion

// ---------------------------------------------------------------------------
// The handlers behind tour block (g): what the platform would run, written over the world
// ---------------------------------------------------------------------------

const entranceKey = Identifier.PropertyApiName.make("entrance");

// What `updateOffice` does: the office the reference names gets the new title. Its entrance is left as it is
// when the request leaves the key out, removed when the request sends null, and replaced when it sends a point.
const officeUpdated = (parameters: Action.ActionArguments, world: Faux.FauxWorld): Faux.FauxActionOutcome => {
  const argument = (name: string) => R.get(parameters, Identifier.ParameterId.make(name));
  const office = O.flatten(argument("office"));
  const title = pipe(O.flatten(argument("title")), O.filter(P.isString));
  const updated = (object: Objects.OntologyObject): Objects.OntologyObject =>
    Objects.OntologyObject.make({
      ...object,
      title: O.orElse(title, () => object.title),
      properties: pipe(
        argument("entrance"),
        O.map(
          O.match({
            onNone: () => R.filter(object.properties, (_, name) => name !== entranceKey),
            onSome: (point) => R.set(object.properties, entranceKey, point),
          })
        ),
        O.getOrElse(() => object.properties)
      ),
    });
  const named = (object: Objects.OntologyObject): boolean =>
    object.locator.objectType === "Office" && O.exists(office, (key) => key === object.locator.primaryKey);
  return {
    world: Faux.FauxWorld.make({
      ...world,
      objects: A.map(world.objects, (object) => (named(object) ? updated(object) : object)),
    }),
    edits: A.map(A.filter(world.objects, named), (object) =>
      Action.ModifiedObject.make({ objectType: object.locator.objectType, primaryKey: O.getOrNull(office) })
    ),
  };
};

const updateOffice: Faux.FauxActionHandler = (parameters, world) => Effect.succeed(officeUpdated(parameters, world));

// What `officeTitles` answers: the titles of the offices that have an entrance, or of those that have none.
const titlesOf = (world: Faux.FauxWorld, withEntrance: boolean): ReadonlyArray<string> =>
  pipe(
    A.filter(world.objects, (object) => R.has(object.properties, entranceKey) === withEntrance),
    A.map((object) => object.title),
    A.getSomes
  );

const officeTitles: Faux.FauxQueryHandler = (parameters, world) =>
  Effect.succeed(
    titlesOf(
      world,
      O.exists(R.get(parameters, Identifier.ParameterId.make("withEntrance")), (flag) => flag === true)
    )
  );

// #region g
// An action model is a record of parameter specs. A reference is typed by the key of the model it names.
const UpdateOffice = Model.action({
  apiName: "updateOffice",
  parameters: {
    office: Model.requiredParameter(Model.objectReference(Office)),
    title: Model.requiredParameter(Model.string),
    entrance: Model.optionalParameter(Model.geohash),
  },
});

// A query model also says what a call returns. A `set` is a HashSet in the domain.
const OfficeTitles = Model.query({
  apiName: "officeTitles",
  version: O.none(),
  parameters: { withEntrance: Model.requiredParameter(Model.boolean) },
  output: Model.setOf(Model.string),
});

// The in-memory transport runs the handler registered under a model's API name, over the world of block (f).
const Operations = Layer.unwrap(
  Effect.map(World, (world) => Faux.layer({ world, actions: { updateOffice }, queries: { officeTitles } }))
);

const program = Effect.gen(function* () {
  const door = yield* S.decodeEffect(Model.geohash.value)({ type: "Point", coordinates: [-74.006, 40.7128] });
  // The arguments are checked against the model, written with its codec and sent through the port.
  yield* Client.applyAction(UpdateOffice)({ office: "NYC", title: "Manhattan", entrance: O.some(door) });
  // The transport now holds the world the handler returned, so the next typed read sees the change.
  const nyc = yield* pipe(
    Model.all(Office),
    Model.where(Model.eq(Office.property("officeId"), "NYC")),
    Client.fetchOne(Client.FetchOptions.make({}))
  );
  // nyc.title: O.some("Manhattan"), was "New York"; nyc.properties.entrance: O.some(door), was none

  // An optional parameter has three intents. Each is its own `parameters` record on the wire.
  const wire = S.encodeEffect(UpdateOffice.Arguments);
  const untouched = yield* wire({ office: "LYS", title: "Lyon" });
  // untouched: { office: "LYS", title: "Lyon" }
  const cleared = yield* wire({ office: "LYS", title: "Lyon", entrance: O.none() });
  // cleared: { office: "LYS", title: "Lyon", entrance: null }
  const set = yield* wire({ office: "LYS", title: "Lyon", entrance: O.some(door) });
  // set: { office: "LYS", title: "Lyon", entrance: { type: "Point", coordinates: [-74.006, 40.7128] } }

  // The parameters go out through one codec and the answer comes back through another.
  const titles = yield* Client.executeQuery(OfficeTitles)({ withEntrance: true });
  // titles: HashSet("Manhattan", "Lyon")
  return { door, nyc, untouched, cleared, set, titles };
});

// @ts-expect-error an Office is referred to by its key, which is text: a number is not an argument
const refused = Client.applyAction(UpdateOffice)({ office: 7, title: "Seven" });
// #endregion

describe("README tour", () => {
  it.effect(
    "(a) a property type is data, and the codec of its values is projected from it",
    Effect.fnUntraced(function* () {
      // #region a
      // A property type is a value. This one is decoded from the wire's JSON.
      const type = yield* S.decodeEffect(Property.PropertyType)({
        type: "struct",
        structFieldTypes: [
          { apiName: "city", rid: "ri.ontology.main.struct-field.city", dataType: { type: "string" } },
          {
            apiName: "visits",
            rid: "ri.ontology.main.struct-field.visits",
            dataType: { type: "array", subType: { type: "timestamp" } },
          },
        ],
      });

      // The codec of its values is projected from that value: composites are unfolded, a leaf is a table row.
      const codec = Property.valueCodec(type);
      const value = yield* S.decodeEffect(codec)({ city: "Lyon", visits: ["2021-01-04T05:00:00Z"] });
      // value: { city: O.some("Lyon"), visits: O.some([DateTime.Utc]) }
      const wire = yield* S.encodeEffect(codec)(value);
      // wire: { city: "Lyon", visits: ["2021-01-04T05:00:00.000Z"] }
      // #endregion

      strictEqual(type.type, "struct");
      deepStrictEqual<unknown>(value, {
        city: O.some("Lyon"),
        visits: O.some([DateTime.makeUnsafe("2021-01-04T05:00:00Z")]),
      });
      deepStrictEqual<unknown>(wire, { city: "Lyon", visits: ["2021-01-04T05:00:00.000Z"] });
    })
  );

  it.effect(
    "(b) a typed model decodes a wire record into its exact static type",
    Effect.fnUntraced(function* () {
      // #region b
      const employee = yield* S.decodeEffect(Employee.Instance)({
        __apiName: "Employee",
        __primaryKey: 50030,
        __rid: "ri.phonograph2-objects.main.object.88a6fccb-f333-46d6-a07e-7725c5f18b61",
        __title: "John Doe",
        employeeId: 50030,
        fullName: "John Doe",
        startedAt: "2019-01-01T00:00:00Z",
        birthday: "1990-04-17",
        badge: "9007199254740993",
        salary: "91000.50",
        skills: ["sailing", "sql"],
        address: { city: "Lyon" },
      });
      const { properties } = employee;
      // properties.employeeId  50030, not an Option: the primary key is required
      // properties.badge       O.some(9007199254740993n), a bigint one past Number.MAX_SAFE_INTEGER
      // properties.salary      O.some(BigDecimal 91000.50), scale 2 kept
      // properties.birthday    O.some(LocalDate { year: 1990, month: 4, day: 17 }), no time zone involved
      // properties.address     O.some({ city: O.some("Lyon"), postcode: O.none() })
      // employee.locator       the ordinary ObjectLocator: { objectType: "Employee", primaryKey: 50030 }
      // employee.undeclared    {}: a key the model does not declare is kept here as JSON and written back
      const wire = yield* S.encodeEffect(Employee.Instance)(employee);
      // wire: the record above, with startedAt in canonical form "2019-01-01T00:00:00.000Z"
      // #endregion

      assertTrue(exactly<Employee, EmployeeWrittenOut>(true));
      deepStrictEqual(
        employee.locator,
        Objects.ObjectLocator.make({ objectType: Identifier.ObjectTypeApiName.make("Employee"), primaryKey: 50030 })
      );
      deepStrictEqual(employee.undeclared, {});
      assertSome(employee.title, "John Doe");
      strictEqual(properties.employeeId, 50030);
      assertSome(properties.badge, BigInt("9007199254740993"));
      assertSome(
        O.map(properties.salary, (salary) => [salary.value, salary.scale]),
        [BigInt(9100050), 2]
      );
      assertSome(
        O.map(properties.birthday, ({ year, month, day }) => [year, month, day]),
        [1990, 4, 17]
      );
      assertSome(
        O.flatMap(properties.address, (address) => address.city),
        "Lyon"
      );
      assertNone(O.flatMap(properties.address, (address) => address.postcode));
      deepStrictEqual<unknown>(wire, {
        __apiName: "Employee",
        __primaryKey: 50030,
        __rid: "ri.phonograph2-objects.main.object.88a6fccb-f333-46d6-a07e-7725c5f18b61",
        __title: "John Doe",
        employeeId: 50030,
        fullName: "John Doe",
        startedAt: "2019-01-01T00:00:00.000Z",
        birthday: "1990-04-17",
        badge: "9007199254740993",
        salary: "91000.50",
        skills: ["sailing", "sql"],
        address: { city: "Lyon" },
      });
    })
  );

  it.effect(
    "(c) a typed filter and object set encode to the wire's JSON",
    Effect.fnUntraced(function* () {
      // #region c
      const fullName = Employee.property("fullName");
      const startedAt = Employee.property("startedAt");
      const employeeId = Employee.property("employeeId");

      // A typed filter is a pair: the plain filter, and the API name of the model that issued its references.
      // The operand is a value of the property (an instant here); the constructor writes it with the property's codec.
      const johnSince2019 = Model.and(
        Model.eq(fullName, "John Doe"),
        Model.gt(startedAt, DateTime.makeUnsafe("2019-01-01T00:00:00Z"))
      );
      // johnSince2019.owner: "Employee"
      // johnSince2019.filter: what the untyped constructors build from the wire scalar,
      //   Filter.and(Filter.eq("fullName", "John Doe"), Filter.gt("startedAt", "2019-01-01T00:00:00.000Z"))
      // The same codec reads the operand back as the instant: Property.operandCodec of the property's type.

      const offices = pipe(
        Model.all(Employee),
        // Checked from the pair: the filter's owner is the API name of the set's model.
        Model.where(johnSince2019),
        // Checked from the link specs: Employee has a link "office", and its target is Office's API name.
        Model.traverse("office", Office)
      );
      // offices: Model.TypedObjectSet<typeof Office>

      const wire = yield* S.encodeEffect(ObjectSet.ObjectSet)(offices.objectSet);
      // wire:
      // {
      //   type: "searchAround",
      //   objectSet: {
      //     type: "filter",
      //     objectSet: { type: "base", objectType: "Employee" },
      //     where: {
      //       type: "and",
      //       value: [
      //         { type: "eq", field: "fullName", value: "John Doe" },
      //         { type: "gt", field: "startedAt", value: "2019-01-01T00:00:00.000Z" },
      //       ],
      //     },
      //   },
      //   link: "office",
      // }

      // An operator states the tags it accepts as a parameter type, so these two lines do not compile.
      // @ts-expect-error startsWith takes a property with a text tag; employeeId is "integer"
      Model.startsWith(employeeId, "5");
      // @ts-expect-error an integer property compares with a number, not with text
      const mistyped = () => Model.gt(employeeId, "5");
      // Forced past the compiler, the operand still has to be a value of the property: mistyped() throws.

      // A filter and an ordering name the model they are about, so these two lines do not compile either.
      // @ts-expect-error a filter over Office's properties does not filter Employee objects
      Model.where(Model.all(Employee), Model.eq(Office.property("officeId"), "LYS"));
      // @ts-expect-error a geopoint has no order to sort by
      Model.orderBy(Model.all(Office), Office.property("entrance"), "asc");
      // #endregion

      strictEqual(johnSince2019.owner, "Employee");
      assertTrue(exactly<(typeof johnSince2019)["owner"], "Employee">(true));
      // The pair holds the plain filter the untyped constructors build from the wire scalar, so the wire below is
      // theirs too. The untyped tier does not take the instant itself.
      deepStrictEqual(
        johnSince2019.filter,
        Filter.and(Filter.eq("fullName", "John Doe"), Filter.gt("startedAt", "2019-01-01T00:00:00.000Z"))
      );
      throws(mistyped);
      // @ts-expect-error without a property type in hand an operand is the wire scalar, not a DateTime
      throws(() => Filter.gt("startedAt", DateTime.makeUnsafe("2019-01-01T00:00:00Z")));
      const startedAtOperand = Property.operandCodec(DataType.TimestampType.make({}));
      const since = yield* S.decodeEffect(startedAtOperand)("2019-01-01T00:00:00.000Z");
      deepStrictEqual<unknown>(since, DateTime.makeUnsafe("2019-01-01T00:00:00Z"));
      assertTrue(exactly<typeof offices, Model.TypedObjectSet<typeof Office>>(true));
      strictEqual(offices.model.apiName, "Office");
      deepStrictEqual<unknown>(wire, {
        type: "searchAround",
        objectSet: {
          type: "filter",
          objectSet: { type: "base", objectType: "Employee" },
          where: {
            type: "and",
            value: [
              { type: "eq", field: "fullName", value: "John Doe" },
              { type: "gt", field: "startedAt", value: "2019-01-01T00:00:00.000Z" },
            ],
          },
        },
        link: "office",
      });
    })
  );

  it("(d) one exhaustive match covers a tagged union", () => {
    // #region d
    // Five cases, all required. The match is recursive because the union is.
    const address: (selector: Property.PropertySelector) => string = Property.PropertySelector.match({
      property: ({ apiName }) => apiName,
      structField: ({ propertyApiName, structFieldApiName }) => `${propertyApiName}.${structFieldApiName}`,
      propertyWithLoadLevel: ({ selector }) => address(selector),
      titleProperty: () => "(title)",
      primaryKeyProperty: () => "(primary key)",
    });

    // A filter is a tree of 28 cases in four shapes: a property test, `and`, `or`, `not`. The fold is total.
    const render = Filter.foldFilter<string>({
      property: (test) => `${address(test.property)} ${test.type}`,
      and: A.join(" and "),
      or: A.join(" or "),
      not: (inner) => `not (${inner})`,
    });
    // A typed filter holds a plain one under `filter`, so the fold reads both.
    const text = render(
      Filter.and(Model.eq(Employee.property("fullName"), "John Doe").filter, Filter.not(Filter.isNull("startedAt")))
    );
    // text: "fullName eq and not (startedAt isNull)"

    // @ts-expect-error a match that forgets a case does not compile
    Property.PropertySelector.match({ property: ({ apiName }) => apiName });
    // #endregion

    strictEqual(text, "fullName eq and not (startedAt isNull)");
  });

  it.effect(
    "(e) an ontology is validated as a whole, and a model is checked against it",
    Effect.fnUntraced(function* () {
      // #region e
      const ontology = yield* S.decodeEffect(Ontology.OntologyDefinition)(served);

      // Every rule runs over the whole ontology. The result is data: all findings, not the first exception.
      const findings = Ontology.validateOntology(ontology);
      // findings, encoded: the link leads to an object type this ontology does not define
      // [{ type: "linkTargetMissing", objectType: "Office", linkType: "occupants", targetObjectType: "Employee" }]

      // The same idea one level up: what code relies on (a model) against what the server serves.
      const drift = pipe(
        Ontology.getObjectType(ontology, Identifier.ObjectTypeApiName.make("Office")),
        O.map((definition) => Model.conformance(Office, definition)),
        O.getOrElse(() => A.empty<Model.ConformanceFinding>())
      );
      // drift, encoded: the model says geopoint
      // [{ type: "tagMismatch", property: "entrance", path: [], declared: "geopoint", served: "geoshape" }]
      // #endregion

      const findingsWire = yield* S.encodeEffect(S.Array(Ontology.OntologyFinding))(findings);
      const driftWire = yield* S.encodeEffect(S.Array(Model.ConformanceFinding))(drift);
      deepStrictEqual<unknown>(findingsWire, [
        { type: "linkTargetMissing", objectType: "Office", linkType: "occupants", targetObjectType: "Employee" },
      ]);
      deepStrictEqual<unknown>(driftWire, [
        { type: "tagMismatch", property: "entrance", path: [], declared: "geopoint", served: "geoshape" },
      ]);
    })
  );
});

it.layer(InMemory)("README tour: the client", (it) => {
  it.effect(
    "(f) a typed read goes through the transport port and comes back as typed instances",
    Effect.fnUntraced(function* () {
      // #region f
      const lyon = pipe(Model.all(Office), Model.where(Model.eq(Office.property("officeId"), "LYS")));

      // Needs Client.OntologyTransport in its environment, and nothing else. Here the in-memory world answers.
      // The read takes the typed set whole, so the model that decodes the page is the model the set was built from.
      const page = yield* pipe(lyon, Client.fetchPage(Client.FetchOptions.make({})));
      const entrances = A.map(page.data, (office) => ({
        office: office.properties.officeId,
        longitude: O.map(office.properties.entrance, (point) => point.coordinates[0]),
      }));
      // entrances: [{ office: "LYS", longitude: O.some(4.8357) }]
      // page.totalCount: O.some(1n), the size of the filtered set

      // An ordered set carries its sort keys beside the pair, and the read sends them with the request.
      const sorted = yield* pipe(
        Model.all(Office),
        Model.orderBy(Office.property("officeId"), "asc"),
        Client.fetchPage(Client.FetchOptions.make({}))
      );
      const keys = A.map(sorted.data, (office) => office.properties.officeId);
      // keys: ["LYS", "NYC"], not the order the world lists them in

      // The same function reads without a model: pair the plain set with the codec that needs no ontology.
      const plain = yield* pipe(lyon.objectSet, Client.untyped, Client.fetchPage(Client.FetchOptions.make({})));
      const located = A.map(plain.data, (office) => office.locator);
      // plain.data: Objects.OntologyObject values, their properties as the JSON the platform sent
      // located: the locators of page.data, value for value
      // #endregion

      deepStrictEqual(entrances, [{ office: "LYS", longitude: O.some(4.8357) }]);
      assertSome(page.totalCount, BigInt(1));
      assertNone(page.nextPageToken);
      assertTrue(exactly<(typeof page.data)[number], typeof Office.Instance.Type>(true));
      deepStrictEqual(keys, ["LYS", "NYC"]);
      // The untyped read went through the same port and the same function, with another codec for the row.
      assertTrue(exactly<(typeof plain.data)[number], Objects.OntologyObject>(true));
      deepStrictEqual(
        located,
        A.map(page.data, (office) => office.locator)
      );
      deepStrictEqual<unknown>(
        A.map(plain.data, (office) => office.properties),
        [{ officeId: "LYS", entrance: { type: "Point", coordinates: [4.8357, 45.764] } }]
      );
      // Without the ordering, the same set comes back in the order the world lists its objects.
      const unsorted = yield* Client.fetchPage(Model.all(Office), Client.FetchOptions.make({}));
      deepStrictEqual(
        A.map(unsorted.data, (office) => office.properties.officeId),
        ["NYC", "LYS"]
      );
    })
  );
});

it.layer(Operations)("README tour: typed operations", (it) => {
  it.effect(
    "(g) a typed action changes what a typed read sees, and a typed query returns a typed value",
    Effect.fnUntraced(function* () {
      const options = Client.FetchOptions.make({});
      const office = (id: string) =>
        pipe(Model.all(Office), Model.where(Model.eq(Office.property("officeId"), id)), Client.fetchOne(options));

      // The world of block (f), before any action.
      const before = yield* office("NYC");
      assertSome(before.title, "New York");
      assertNone(before.properties.entrance);
      const titlesBefore = yield* Client.executeQuery(OfficeTitles)({ withEntrance: true });
      deepStrictEqual(A.fromIterable(titlesBefore), ["Lyon"]);

      const { door, nyc, untouched, cleared, set, titles } = yield* program;

      // The models' static types are exact.
      assertTrue(
        exactly<
          typeof UpdateOffice.Arguments.Type,
          { readonly office: string; readonly title: string; readonly entrance?: O.Option<Geo.GeoPoint> }
        >(true)
      );
      assertTrue(exactly<typeof OfficeTitles.Parameters.Type, { readonly withEntrance: boolean }>(true));
      assertTrue(exactly<typeof titles, HashSet.HashSet<string>>(true));
      assertTrue(exactly<typeof nyc, typeof Office.Instance.Type>(true));

      // The read after the action.
      assertSome(nyc.title, "Manhattan");
      deepStrictEqual(nyc.properties.entrance, O.some(door));
      deepStrictEqual<unknown>(door.coordinates, [-74.006, 40.7128]);

      // The three intents, as the wire records the region states.
      deepStrictEqual<unknown>(untouched, { office: "LYS", title: "Lyon" });
      deepStrictEqual<unknown>(cleared, { office: "LYS", title: "Lyon", entrance: null });
      deepStrictEqual<unknown>(set, {
        office: "LYS",
        title: "Lyon",
        entrance: { type: "Point", coordinates: [-74.006, 40.7128] },
      });

      // The query's answer.
      strictEqual(HashSet.size(titles), 2);
      assertTrue(HashSet.has(titles, "Manhattan"));
      assertTrue(HashSet.has(titles, "Lyon"));

      // The line under the marker is still a value at run time; only the compiler refuses it.
      const stillAValue = Effect.isEffect(refused);
      assertTrue(stillAValue);

      // The three records are three requests, and the handler tells them apart: Lyon keeps its entrance when
      // the key is absent, loses it when the request clears it, and gets a new one when the request sets it.
      yield* Client.applyAction(UpdateOffice)({ office: "LYS", title: "Lyon" });
      const kept = yield* office("LYS");
      deepStrictEqual<unknown>(
        O.map(kept.properties.entrance, (point) => point.coordinates),
        O.some([4.8357, 45.764])
      );
      yield* Client.applyAction(UpdateOffice)({ office: "LYS", title: "Lyon", entrance: O.none() });
      const emptied = yield* office("LYS");
      assertNone(emptied.properties.entrance);
      const without = yield* Client.executeQuery(OfficeTitles)({ withEntrance: false });
      deepStrictEqual(A.fromIterable(without), ["Lyon"]);
      yield* Client.applyAction(UpdateOffice)({ office: "LYS", title: "Lyon", entrance: O.some(door) });
      const moved = yield* office("LYS");
      deepStrictEqual(moved.properties.entrance, O.some(door));

      // An application the transport has no handler for is refused by the transport, with its own error.
      const Unregistered = Model.action({ apiName: "closeOffice", parameters: {} });
      const refusal = yield* Effect.flip(Client.applyAction(Unregistered)({}));
      strictEqual(refusal._tag, "ApiError");
    })
  );
});

// ---------------------------------------------------------------------------
// The README itself
// ---------------------------------------------------------------------------

// The same text with every line's indentation removed: a region sits deeper in this file than in the README.
const flushLeft = (text: string): string => pipe(Str.split(text, "\n"), A.map(Str.trim), A.join("\n"));

// The `ts` blocks of the README's tour, each rewritten to import the way this file does.
const tourBlocks = (readme: string): ReadonlyArray<string> =>
  pipe(
    Str.split(readme, "\n## "),
    A.filter(Str.startsWith("2. ")),
    A.flatMap((tour) => A.drop(Str.split(tour, "```ts\n"), 1)),
    A.map((chunk) => A.headNonEmpty(Str.split(chunk, "\n```"))),
    A.map(Str.replaceAll('"@beep/scratchpad/osdk/src/index"', '"../src/index.ts"')),
    A.map(flushLeft)
  );

it.layer(NodeServices.layer)("README", (it) => {
  it.effect(
    "every code block of the tour is in this file, line for line",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const readme = yield* fs.readFileString(path.join(import.meta.dirname, "..", "README.md"));
      const source = yield* fs.readFileString(path.join(import.meta.dirname, "Readme.test.ts"));
      const proven = flushLeft(source);
      const blocks = tourBlocks(readme);

      strictEqual(A.length(blocks), 11);
      deepStrictEqual(
        A.filter(blocks, (block) => !Str.includes(block)(proven)),
        []
      );
    })
  );

  it("the union sizes the README states are the sizes of the unions", () => {
    deepStrictEqual(
      {
        dataTypeKind: A.length(DataType.DataTypeKind.literals),
        propertyType: R.size(Property.PropertyType.cases),
        objectFilter: R.size(Filter.ObjectFilter.cases),
        objectSet: R.size(ObjectSet.ObjectSet.cases),
        derivedProperty: R.size(DerivedProperty.DerivedProperty.cases),
        agentDataType: R.size(Agent.AgentDataType.cases),
        mediaItemMetadata: R.size(Media.MediaItemMetadata.cases),
        mediaTransformation: R.size(Media.MediaTransformation.cases),
      },
      {
        dataTypeKind: 44,
        propertyType: 22,
        objectFilter: 28,
        objectSet: 15,
        derivedProperty: 11,
        agentDataType: 16,
        mediaItemMetadata: 10,
        mediaTransformation: 18,
      }
    );
  });
});
