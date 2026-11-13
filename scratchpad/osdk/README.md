# osdk

An Effect-native, schema-first ontology core: the core of Palantir's OSDK (`@osdk/api` and the Foundry v2 wire
contract it compiles to), rebuilt on Effect 4.1.2 around one representation.

## 1. What this is

OSDK states one idea five times: conditional types (`@osdk/api` 2.88.0 is 12,291 lines of source in 111 files,
`*.test.ts` left out, and its export census counts 289 of its 310 public symbols as type-only), wire
declarations, hand-written converters, an authoring model and generator converters. Here the aim is one
statement: runtime schemas whose `Encoded` side is exactly the Foundry v2 JSON and whose `Type` side is the
domain. Guards, codecs in both directions, arbitraries, equivalences and exhaustive matchers precipitate from
each schema. Value codecs are projected from property types, instance codecs from definitions and argument
codecs from parameters; a typed model of an object type, an action or a query is the same pairing written at
authoring time, so the compiler sees it. The operator and metric tables are data that a validator reads
(`Filter.checkFilter`, `Aggregation.checkAggregation`). Where the code still states something twice, section 7
says where.

Size on 2026-11-13, measured: 57,762 lines in 109 files under `src`, 33 concepts, 1,377 exported values (697
constants and 680 classes), 4,282 unit tests in 37 files and 754 doctests in 75 files.

## 2. A tour in code

Every block in this section is a `#region` of [`test/Readme.test.ts`](./test/Readme.test.ts), copied verbatim
except for the import path (the test imports `../src/index.ts`). That file also re-reads this README and fails
when a block here is not in it. Lines with `yield*` run inside `Effect.gen`; block (g) writes its `Effect.gen`
out. A comment that states a result is asserted in the test of its block. The tour imports the `Object` concept
under the name `Objects`, so that it does not shadow the global of that name.

```ts
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
} from "@beep/scratchpad/osdk/src/index";
import type { LocalDate } from "@beep/schema/LocalDate";
```

### (a) A property type is data; the codec of its values is projected from it

```ts
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
```

`valueCodec` unfolds the three types that hold other types (a vector, an array, a struct) and reads every other
type from `Property.leafCodec` by its tag. That table is the rows every type universe shares (`Value.sharedCodec`)
plus the four only a property has, so a property type added to the union is a compile error until it has a
handler or a row ([`src/Property/Property.behavior.ts`](./src/Property/Property.behavior.ts)).
`Object.instanceCodec`, the codec of one object of a served object type, is `Object.InstanceOf` applied to the
struct that `valueCodec` and `fieldCodec` project from the definition's properties.

### (b) A typed model, and the static type that falls out of it

A spec (`Model.string`, `Model.array(spec)`, `Model.struct({...})`) pairs a type tag with the codec `valueCodec`
picks for that tag. For a leaf the pairing is not kept by hand: `Model.string` is the tag and the row
`Property.leafCodec` holds under it, the very value `valueCodec` returns, and `Model.typeOf(spec)` reads any spec
back as the property type it denotes. `Model.object` maps a record of specs to a struct schema with one heterogeneous map
(`effect/Struct`); no conditional type takes part. `Model.required` marks the primary key, the one property the
platform guarantees a value for. On any other property, or on a field of a struct, it is a compile error: those can
be absent, and a model that typed them as present would have nothing to check the claim.

```ts
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
```

`Employee.Instance` is not written in the typed layer. It is `Object.InstanceOf`, the one instance codec of the
library, applied to the struct the specs precipitate (`Employee.Properties`); `Object.instanceCodec` is the same
function applied to the struct projected from a served definition. So the typed tier and the dynamic tier decode
a row to one shape, `{ locator, rid, title, score, properties, undeclared }`, with the same checks and the same
refusals, and a model differs from a projection only in how finely `properties` is typed.

Decoding a wire record:

```ts
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
```

### (c) A typed filter and object set, and the JSON they encode to

```ts
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
```

`Model.eq`, `Model.gt` and the other typed constructors return a `Model.TypedFilter`: the pair `{ owner, filter }`
of the plain `Filter.ObjectFilter` and the API name of the model that issued the property reference. A typed set is
likewise a pair `{ model, objectSet }`. Each pair holds exactly the value the untyped layer builds, so the wire
cannot tell typed from untyped. The operand is where the two layers differ. The typed constructor takes a value
of the property (a `DateTime`, a `bigint`, a `BigDecimal`, a `LocalDate`) and writes the wire scalar with the
property's own codec; the plain filter holds that scalar, and `Property.operandCodec(type)` reads it back as the
value. An operand the codec refuses, such as a number past the 32-bit range of an integer property, throws when
the filter is built. What the pairs add is a literal to compare: `Model.where` takes a filter whose
owner is the set's model, `Model.and` and `Model.or` take two filters of one owner, and `Model.orderBy` takes a
reference the set's model issued, with a tag that has an order. A plain filter enters the typed layer as a pair
written by hand, which is the line where the caller vouches for it. The four `@ts-expect-error` lines are checked
by the compiler: a marker over a line that compiles is itself an error. The second of them is a thunk because the
call it holds would also be refused at run time.

### (d) One exhaustive match over a tagged union

```ts
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
```

`Property.valueCodec` is the partial form of the same construction (`matchOrElse`) over the 22 cases of
`PropertyType`: three handlers, and a fallback that indexes the leaf table with the tag of what is left, so a case
with neither a handler nor a row does not compile.

### (e) Validating an ontology, and checking a model against it

```ts
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
```

```ts
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
```

### (f) A typed read, end to end

`Client.OntologyTransport` is the one port to the platform: one member per request, in domain types. Any layer
that provides it runs the same program. `Api.HttpOntologyTransport` provides it over `effect/http`; here
`Faux.layer` provides it over a world held in memory, which evaluates the filter.

```ts
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
```

```ts
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
```

`Client.stream` and `Client.fetchOne` take the set the same way, so no read can name one model and load the
objects of another. `Client.count` and `Client.aggregate` decode no instance and take the plain `set.objectSet`.
All five are written against the same port. The port answers a load with the envelope decoded and every row as
the flat record the platform sent (`Object.ObjectRecord`); the read decodes each row once, with the codec the
set carries. For a typed set that is the model's `Instance`. `Client.untyped` pairs a plain object set with
`Object.OntologyObject`, the codec that needs no ontology, so reading without a model is the same function with
another codec, not a second facade. A row that does not fit the codec fails the read with a `DecodeError`
carrying the row's index and, when the row's own keys name an object, its locator.

### (g) A typed action and a typed query, end to end

`Model.action` and `Model.query` do for an action type and a query type what `Model.object` does for an object
type: a record of specs is mapped to a struct codec, and the static types are the two sides of that codec.
`Client.applyAction`, `Client.applyActionWithEdits`, `Client.validateAction` and `Client.executeQuery` are
called with the model and then the arguments, `Client.applyAction(model)(args)`, and go through the same
`OntologyTransport` port as the reads; each also has a data-first form, `Client.applyAction(args, model)`. Here
the port is the in-memory transport again, now with one handler registered for the action and one for the
query. A
handler is what the platform would run: for an action, a function from the arguments and the current world to
the next world and the edits to report; for a query, a function from the arguments and the world to the JSON
answer. The two used here, `updateOffice` and `officeTitles`, are plain functions over the world and sit in the
test file just above this region.

```ts
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
```

The read after `applyAction` sees the new title and entrance because the action handler returned the next world
and the transport replaced its own with it. `applyAction` returns nothing; `applyActionWithEdits` returns the
edits the platform reports, and `validateAction` returns the validation report without running anything. An
application the platform reports invalid fails with `ActionRejected`, a member of `ClientError`. The test goes on
from here and sends the three records through the port: the handler keeps Lyon's entrance when the key is
absent, removes it for `null` and replaces it for a point. An optional parameter of a query is typed
differently: it is an `Option` under a key that is always there, and none leaves the key out of the request;
whether `null` may be sent is said by the parameter's own type (`Model.nullable`).
`Model.actionConformance` and `Model.queryConformance` compare a model with the action or query type the
platform serves, as `Model.conformance` does for an object type.

## 3. Tiers and concepts

Tier 1, metamodel and algebra, is schemas only. Tier 2, projections, is total functions from tier-1 values to
codecs and tables. Every projection from a type to a codec reads one table for its leaves: `Value.sharedCodec`
holds the row of each tag every universe reads alike, a universe's `leafCodec` adds the rows only it has, and the
projection indexes it with the tag of whatever it does not unfold. Tier 3 is the typed layer, whose static types come from schema generics, and the services.
Rows are in dependency order: a concept imports only from rows above it (`ObjectSet` and `DerivedProperty` are
mutually recursive and share a row). The typed facades of `Client` do not import `Model`: they take anything
with the shape of a model (`InstanceSet`, `ActionModel`, `QueryModel`).

| Concept | Tier | Holds | Replaces (OSDK or wire) |
| --- | --- | --- | --- |
| `Identifier` | 1 | API-name and RID brands, `ResourceIdentifier` and its parsed parts, `OntologyIdentifier`, `FunctionVersion` | the wire's `string` aliases |
| `Metadata` | 1 | `ReleaseStatus`, `Visibility`, `Icon`, `TypeClass` | `ObjectTypeVisibility` + `PropertyTypeVisibility`, UPPER_CASE statuses |
| `Page` | 1 | `PageToken`, `PageSize`, `TotalCount`, `PageRequest`, `Page(identifier, item)`; the load requests and the answer to an object load (`Client.LoadObjectsResponseOf`) are built from them | `PageResult<T>`, `$pageSize`, `$nextPageToken` |
| `CipherText` | 1 | the cipher text envelope as a parsed record, `Plaintext` as `Redacted` | the branded `CipherText` string |
| `DataType` | 1 | `DataTypeKind` (44 tags), one pick per type universe, `SharedValueKind` (the 16 tags every universe reads alike), the shared tag records | `WirePropertyTypes`, `BaseActionParameterTypes`, `WireQueryDataTypes` |
| `Geo` | 1 | GeoJSON, `Position`, `BoundingBox`, `LinearRing`, `Distance` | `BBox`, `Coordinate`, `DistanceUnitMapping` |
| `Attachment` | 1 | `AttachmentReference`, `AttachmentMetadata`, `SizeBytes` | the `Attachment` handle, wire `AttachmentV2` |
| `Media` | 1 | `MediaReference`, `MediaItemMetadata` (10 cases), `MediaTransformation` (18 cases), language kits | `Media*`, the `$key` transformation records |
| `Value` | 1, 2 | one codec per scalar tag (`LongValue`, `DecimalValue`, `DateValue`, ...); `VectorOf(dimension)`, the vector rule; `ScalarValue`, the operand as the wire carries it; `sharedCodec`, the one table from each tag every universe reads alike to its codec | `PropertyValueWireToClient` and its five sibling tables |
| `Security` | 1 | marking requirements, `PropertySecurity`, `SecuredValue(name, codec)` | `SecuredPropertyValue { value?: any }` |
| `ValueFormat` | 1 | `ValueFormat` and its number, date and duration domains | the 39 `valueFormatting/*` exports |
| `LinkType` | 1 | `LinkTypeSide`, `LinkCardinality` | `LinkTypeSideV2`, `multiplicity: boolean` |
| `TimeSeries` | 1 | series references, `TimeRange`, points, aggregation strategies, geotime references | `TimeSeriesQuery`, `TimeseriesDurationMapping` |
| `ValueType` | 1, 2 | value types and constraints; `constraintCheck` | wire `OntologyValueType`, `ValueTypeConstraint` |
| `Property` | 1, 2 | `PropertyType` (22 cases), `PropertyDefinition`, `PropertySelector`; `leafCodec`, `valueCodec`, `fieldCodec`, `operandType`, `operandCodec`, `selectedType` | `ObjectMetadata.Property`, `PropertyV2`, the value mapping tables |
| `ObjectType` | 1 | `ObjectType`, `ObjectTypeDefinition`, datasources, interface implementations, naming checks | `ObjectTypeV2`, `ObjectTypeFullMetadata`, `ObjectMetadata` |
| `InterfaceType` | 1 | `InterfaceType`, its property and link constraints | `InterfaceMetadata`, wire `InterfaceType` |
| `Object` | 1, 2 | `ObjectLocator`, `ObjectSpecifier`, `PrimaryKeyValue`, `ObjectRecord` (the flat wire row), `OntologyObject`; `InstanceOf(shape)`, the one instance codec, generic in the codec of the properties, and `instanceCodec(signature)`, the same function at the struct a definition projects to | `OsdkBase`, `ObjectIdentifiers`, `convertWireToOsdkObjects` |
| `Filter` | 1, 2 | `ObjectFilter` (28 cases), a constructor per operator, `foldFilter`; `allowedOperators`, `checkFilter` | `WhereClause`, `SearchJsonQueryV2`, `FilterFor<PD>` |
| `Aggregation` | 1, 2 | `Aggregation`, `GroupBy`, `MetricKey`; `allowedMetrics`, `allowedGroupings`, `checkAggregation` | `AggregateOpts`, `AGG_FOR_TYPE`; the rows `AggregationsResults` is computed from, not its static result type |
| `ObjectSet`, `DerivedProperty` | 1, 2 | `ObjectSet` (15 cases), `DerivedProperty` (11 cases), combinators, folds; `checkObjectSet` | the `ObjectSet<Q>` closure object, `DerivedProperty.*` builders |
| `Action` | 1, 2 | `ActionType`, logic rules, requests, edits, validation; `leafCodec`, `argumentCodec`, `fieldValueCodec`, `argumentsCodec` | `ActionMetadata`, `toDataValue`; the runtime half of `ActionParam.*` (one codec per parameter type, statically `unknown`; the static half is `Model.action`) |
| `Query` | 1, 2 | `QueryType`, `QueryDataType`, aggregation values; `leafCodec`, `valueCodec`, `parametersCodec`, `outputCodec` | `QueryDataTypeDefinition`; the runtime half of `QueryParam.*` and `QueryResult.*` (codecs, statically `unknown`; the static half is `Model.query`) |
| `Agent` | 1, 2 | `AgentDefinition`, `AgentDataType` (16 cases), sessions, events; `valueCodec` | `AgentParam.*`, `toDataValueAgents` |
| `Subscription`, `Link` | 1 | subscribe requests, stream messages, updates; `Link`, `LinkPage` | the messages of `ObjectSetSubscription.*` and `LinkSubscription.*`; their listener side has no successor |
| `Ontology` | 1, 2 | `OntologyDefinition`, `OntologySelection`, `OntologyInclusions`; lookups, `linkGraph`, `interfaceGraph`, `validateOntology` | `OntologyFullMetadata`, `OntologyProvider` |
| `Shape` | 1, 2 | `ShapeDefinition`, `NullPolicy`, link sets; `applyShape`, `shapeId` | `ShapeBuilder`, `computeShapeId` |
| `Model` | 3 | one spec representation (`ValueSpec`: tag, value codec, tagged `SpecShape`) and its three refinements (`PropertySpec`, `ExchangeSpec`, `ParameterSpec`). Typed objects: property specs, `typeOf`, `Model.object` (whose `Instance` is `Object.InstanceOf` at the struct of its specs), typed filters (`TypedFilter`) and sets (`TypedObjectSet`, `OrderedObjectSet`), `pick`, `conformance`. Typed actions and queries: exchange specs (`objectReference`, `listOf`, `structOf`, `nullable`, `setOf`, `mapOf`, `unionOf`), `requiredParameter`, `optionalParameter`, `Model.action`, `Model.query`, `actionConformance`, `queryConformance` | generated SDK constants, `Osdk.Instance`, `ObjectSet<Q, RDPs>`; `ActionDefinition`, `QueryDefinition` and the static half of `ActionParam.*`, `QueryParam.*`, `QueryResult.*` |
| `Client` | 3 | envelopes (`LoadObjectsResponseOf(identifier, row)`, the answer to a load for any row codec, and `LoadObjectsResponse`, the port's answer, whose rows are wire records), `ClientError`, `OntologyTransport`, `OntologyContext`. The read facade: `fetchPage`, `stream`, `fetchOne` over a set and the codec of its rows, `untyped` to read a plain set as `OntologyObject`s, `count`, `aggregate`. The operations facade: `applyAction`, `applyActionWithEdits`, `validateAction`, `executeQuery`, and the error `ActionRejected` | `MinimalClient`, `PalantirApiError`, `Result<T>`; `client(action).applyAction`, `client(query).executeFunction`, `ActionValidationError` |
| `Api` | 3 | `OntologyApi` (the ontology routes as one `HttpApi` value), `FoundryConnection`, the `HttpOntologyTransport` layer | the generated `@osdk/foundry.ontologies` client |
| `Faux` | 3 | `FauxWorld`, `matchesFilter`, `evaluateObjectSet`, `loadObjects`, `aggregateObjects`, the in-memory `layer` | `@osdk/faux` |

## 4. Conventions

`Encoded` is exactly the Foundry v2 JSON. `Type` equals `Encoded` except for this closed list of upgrades; a
schema never invents another.

| On the wire | In the domain | Why |
| --- | --- | --- |
| absent key (or `null` on object records) | `Option`, constructor default none | absence is a value |
| absent wire collection | empty collection, always written on encode | saved documents omit them; Conjure semantics |
| closed UPPER_CASE enum | the lowerCamel form of the wire word, nothing else, through `MappedLiteralKit([["WIRE", "domain"], ...])`: `DAY` is `day`, `DAYS` is `days`, `ROUND_CLOSEST` is `roundClosest`, `DATE_FORMAT_DATE` is `dateFormatDate` | one literal rule: no pluralising, no synonym, no dropped prefix or suffix, so the wire word predicts the literal (`test/LiteralRule.test.ts` checks every exported enum and names the three literals of `DataType.values.ts` that still deviate: `cosine`, `euclidean`, `openAiTextEmbeddingAda002`); `type` tags are already camelCase and stay `LiteralKit` |
| instant text, calendar date text | `DateTime.Utc`, `LocalDate` | a date has no time zone to get wrong |
| int64 text, decimal text, counts in a string | `bigint`, `BigDecimal`, `bigint` | no digit is lost |
| magic string | parsed record (`ObjectSpecifier`, `CipherText`, `ResourceIdentifier`, `MetricKeyFromName`) | structure, not string surgery |
| untagged union, optional-field bag | tagged union | finite variants are a union |
| conjure wrapper `{ type: K, [K]: payload }` | `{ type: K, ...payload }` | the wrapper says nothing |
| union of empty records | the literal itself (`PropertyLoadLevel`) | an enum in union clothing |
| exclusive key pair (`field` / `propertyIdentifier`) | one field (`property: PropertySelector`) | one fact, one field |
| a flag the wire asks backwards (`excludeRid`) | the positive flag (`includeRid`), negated in both directions | a question is asked one way |
| a superseded key beside its successor (`select`, `selectV2`) | one field (`selection`); encoding writes the successor and leaves the old key empty | one fact, one field |
| unclear key (`subType`, `structFieldTypes`) | clear key (`elementType`, `fields`), wire key kept by `S.encodeKeys` | the name says what it holds |
| secret | `S.Redacted` | "do not log" becomes a type |

- The discriminator is the wire's own `type`. A union is `Kit.mapMembers(() => Tuple.make(A, B, ...))` piped to
  `S.toTaggedUnion("type")`; consumers use `.match`, `.cases`, `.guards` and `.isAnyOf`.
- Plain data is an `S.Opaque` class over an annotated `S.Struct`, with statics only and constructor defaults.
- Recursion is `S.suspend((): S.Codec<T, T.Encoded> => T)` plus a hand-written `declare namespace T { type Encoded }`
  for every schema on the cycle. Recursive arrays carry `RecursiveArraySizeHint` so arbitraries terminate.
- There are no codec walls: no `decodeX`, `isX` or `encodeX` exports. Derive at the call site (`S.is(X)`,
  `S.decodeEffect(X)`). Helpers are statics or exported `dual` functions.
- Names are domain nouns: no `V2`, no `Schema` suffix, no `$` or `__` sigils. A codec is `<Target>From<Source>`.
- A primitive is narrowed only when the wire guarantees it. Stricter authoring rules (API-name patterns, reserved
  words) are separate annotated checks in `ObjectType.policy.ts`, not part of a wire codec.
- The tier that knows a property's type carries the rich value; the tier that does not carries the wire scalar. A
  property value, the key property of an instance, the operand of a typed filter and a typed argument are decoded
  by the codec of their type. A filter operand, a range bound, an enum option and the key of an `ObjectLocator` are
  read with no property type in hand, so they hold the JSON scalar that travels (`Value.ScalarValue`,
  `Object.PrimaryKeyValue`: a string, a finite number or a boolean). No schema claims a `Type` it cannot decode
  to, so `decode(encode(x))` is equivalent to `x` for every schema, the ones that contain an operand included.
  `Property.operandCodec(type)` is the bridge between the tiers: the codec from a wire operand to a value of the
  property it is compared with.
- A tag has one row. The codec of a tag every universe reads alike is stated once, in `Value.sharedCodec`, keyed by
  the kit `DataType.SharedValueKind`. A table is its rows picked by its kit (`Struct.pick(rows, Kit.literals)`), so
  a tag without a row does not compile and each key keeps the type of its own codec. A projection is
  `Union.matchOrElse({ ...the types that hold other types }, (leaf) => leafCodec[leaf.type])`: a tag with neither a
  handler nor a row is a type error, with no assertion. The typed layer reads the same tables by key
  (`Model.string` is `leafCodec.string` under the tag `string`), so a spec and a projection cannot name two codecs
  for one tag. A universe writes a row of its own only where it reads a tag differently (an attachment is a
  reference record for a property and an identifier for an argument) or is the only one to have it.
- A spec has one representation. `Model.ValueSpec` is a tag, the codec of a value and a tagged `SpecShape` (leaf,
  vector, list, struct, entries, nullable, union, reference). `PropertySpec` adds how the value stands as a key of
  an object, `ExchangeSpec` how it stands as a field of a struct an action or a query exchanges, `ParameterSpec`
  whether a request must supply it. A property spec's shape is typed by its tag, so a spec tagged a vector that
  states no dimension cannot be written, and the constructors refuse what no property type could state
  (`Model.vector` a dimension that is not a positive integer, `Model.struct` a field with the empty name), so
  `Model.typeOf` is total over the specs they build.
- An object has two decoded shapes, and the second has one implementation. `Object.OntologyObject` is the object
  when nothing is known of its type: its locator, and its properties as JSON. An instance,
  `{ locator, rid, title, score, properties, undeclared }`, is the object when its type is known, and
  `Object.InstanceOf(shape)` is the only function that builds its codec. It is generic in the codec of the
  properties: `Object.instanceCodec(signature)` calls it with the struct projected from a served definition,
  `Model.object` with the struct of its specs. `locator` is the ordinary `ObjectLocator`, and `undeclared` keeps
  every key the properties codec does not declare, so a round trip loses nothing in either tier. Until a codec
  reads it, an object is the flat wire record (`Object.ObjectRecord`): the transport port returns rows as they
  arrived, and a read decodes each row exactly once, with the codec the set carries.

## 5. Naming ledger

A selection of the naming decisions the implementers recorded: the OSDK or wire name, the name here, and why.
Every name in the middle column is an export of `src` on 2026-11-13.

| OSDK or wire | Here | Why |
| --- | --- | --- |
| **Identity and values** | | |
| `$apiName` `$primaryKey` `$rid` `$title`, `__apiName` ... | `locator.objectType`, `locator.primaryKey`, `rid`, `title`, `score` | identity is one value beside the properties, so no key needs a sigil |
| `ObjectSpecifier<Q>` branded string, `split(":")` | `ObjectSpecifier`, a codec from text to `ObjectLocator` | a parsed structure; the first-colon split keeps keys that contain colons |
| `OsdkBase`, `ObjectIdentifiers`, wire `ObjectLocator`, the edit reference | `ObjectLocator` | one name for "which object"; the other spellings are codecs to it |
| `PrimaryKeyValue = any`, `PropertyValue = any` operands | `PrimaryKeyValue`, `ScalarValue`; `Property.operandCodec(type)` | the JSON scalars that travel, and the codec that reads one as a value of its property |
| `DataValue`, `PropertyValueWireToClient` | `Property.valueCodec(type)` | the type knows its value |
| `nullable: boolean`, `T \| undefined`, `NullabilityAdherence` | `Option` | absence is a value |
| `SizeBytes = string`, `totalCount: string` | `SizeBytes`, `TotalCount` (`bigint`) | a number in a string should round-trip without losing digits |
| `CipherText` branded string, `getValue()` | `CipherText { channel, ciphertext }` | the envelope is a magic string; the channel is a field |
| `Result<T>`, `Logger` | the Effect error channel, `Effect.log` | subsumed by Effect |
| **Types** | | |
| `WirePropertyTypes`, `BaseWirePropertyTypes` | `PropertyType`, `PropertyTypeKind` | it was never the wire; one tag vocabulary |
| property tag `datetime` | `date` | it is a calendar date, and the wire already says `date` |
| `numericTimeseries`, `stringTimeseries`, `sensorTimeseries` | `timeseries` with a `TimeSeriesItem` | the wire has one tag with an item type |
| `multiplicity: boolean` on properties | the `array` case, `ArrayType.elementType` | an array is a type, not a flag, so arrays nest |
| `PropertyIdentifier` and its five `...Selector` members | `PropertySelector`: `PropertyByName`, `StructFieldOfProperty`, `PropertyAtLoadLevel`, `TitleProperty`, `PrimaryKeyProperty` | members named for what they select |
| `PropertyLoadLevel`, a union of four empty records | the literal, with the record as its encoding | an enum in union clothing |
| `ObjectTypeV2`, `ObjectMetadata`, the generated definition | `ObjectType` | one representation |
| `ObjectTypeFullMetadata`, `OntologyFullMetadata` | `ObjectTypeDefinition`, `OntologyDefinition` | the thing plus what hangs off it, not metadata about metadata |
| `LinkTypeSideV2.objectTypeApiName` | `LinkTypeSide.targetObjectType` | on a record that hangs off an object type the wire name reads like the near end |
| `multiplicity: boolean` on links, `ONE` / `MANY` | `LinkCardinality` `"one" \| "many"` | cardinality is a domain, not a flag |
| `InterfaceType.allExtendsInterfaces`, `allPropertiesV2` | `ancestorInterfaces`, `inheritedAndOwnProperties` | `all` did not say all of what |
| `ReleaseStatus` `ACTIVE` ... | `"active" \| "endorsed" \| "experimental" \| "deprecated"` | one literal convention |
| `QueryDataTypeDefinition` with `nullable` on every member | `QueryDataType` and `nonNullAlternative` | nullability is a union with the `null` tag, read by a total function |
| `isFixedVersion` + `version`, `"latest"` | `Option<FunctionVersion>` | latest is the absence of a version |
| `nullable: boolean` on action parameters | `required: boolean` | the wire's own word, never inverted |
| **Filters and aggregations** | | |
| `WhereClause`, `$eq`, `$and`, `SearchJsonQueryV2` | `ObjectFilter`, a tagged tree | data, not `$`-keyed bags |
| `field?` / `propertyIdentifier?` on every leaf | `property: PropertySelector` | an exclusive pair is one value |
| `LtQueryV2`, `GteQueryV2`, `EqualsQueryV2` | `LessThan`, `GreaterThanOrEqual`, `Equals` | words; no `Query`, no `V2` |
| `InQuery` (tag `in`) | `OneOf`, `oneOf` | `in` is a reserved word and `In` says nothing |
| `$ne`; `$isNull: false` | `ne`, which is `not(eq)`; `isNotNull(property)` | the wire has no not-equals; a boolean operand read as a word |
| `CenterPoint { center, distance }` | `CircularArea` | the name lied: it is an area, not a point |
| `GeoJsonString.geoJson: string` | `geoJson: Geometry` | JSON text in a string is a structure |
| `FilterFor<PD>`, `BaseFilterFor<T>` | `allowedOperators`, `operatorsOf`, `allowedOperands`, `operandsOf` | conditional types become total tables |
| invariants thrown by `modernToLegacyWhereClause` | `checkFilter` returning `FilterViolation` values | every violation as data, not the first as an exception |
| `"prop:metric"` keys, `"prop.metric"` names, `$count` | `MetricKey` and the codec `MetricKeyFromName` | structure, not string surgery in three places |
| `AGG_FOR_TYPE`, `GroupByMapper` | `allowedMetrics`, `allowedGroupings`, `durationUnits`, read by `checkAggregation` | data a validator reads at runtime: a `sum` over a string is an `AggregationViolation`, not a type-level error string |
| `AggregateOptsThatErrorsAndDisallowsOrderingWithMultipleGroupBy` | `AggregationOrderingChecks` | two annotated checks instead of type-level error strings |
| **Object sets, actions, queries** | | |
| the `ObjectSet<Q>` closure object and its `WeakMap` | `ObjectSet`, a recursive tagged union | the definition is the value; nothing depends on a client |
| `pivotTo`, wire `searchAround` | `traverse`, `LinkTraversal` | says what it does |
| wire `reference.reference` | `saved(rid)`, `SavedObjectSet` | a stored set named by a RID |
| `extractObjectOrInterfaceType` | `baseType(set)` returning `Option<EntityType>` | a total fold instead of a walker that throws or returns `undefined` |
| `SearchOrderByV2`, `$orderBy: "relevance" \| record` | `OrderBy`: `OrderByRelevance` or `OrderByFields` | an optional-field bag is a two-case union |
| fetch-time `invariant(...)` | `checkObjectSet`, `checkDerivedProperty` returning findings | all findings up front, as data |
| `Record<ParameterId, DataValue \| undefined>`, `NULL_VALUE` | `ActionArguments`: absent key, `Option.none()`, `Option.some(value)` | three intents (untouched, clear, set) are three values |
| `$validateOnly`, `$returnEdits` | `ApplyActionOptions { mode, returnEdits }` | enums with documented defaults, not two booleans |
| `toDataValue`, `toDataValueQueries` + `remapQueryResponse` | `Action.argumentCodec(parameterType)`, `Query.valueCodec(dataType, typeReferences)` | type-directed, one codec for both directions |
| query `set` (an array at runtime), `entrySet` re-keyed by text | `HashSet`, `HashMap` | the collections they claim to be; keys keep their type |
| **Typed layer and client** | | |
| a generated constant + `__DefinitionMetadata` | `Model.object({ apiName, primaryKey, properties, links })` | written once, in code |
| `Osdk.Instance<Q, OPTIONS, P, R>` | `typeof Model.Instance.Type` | the Type side of a codec |
| `convertWireToOsdkObjects` + `fixObjectPropertiesInPlace` | `Object.InstanceOf(shape)`; `Object.instanceCodec(signature)` and `Model.object(...).Instance` are its two callers | one codec for both tiers, both directions, no mutation |
| `OntologyObjectV2`, `LoadObjectSetResponseV2` | `Object.ObjectRecord`; `Client.LoadObjectsResponseOf(identifier, row)`, `LoadObjectsResponse` | the row is named and the envelope is stated once, with the row codec as its parameter |
| `client(Q)`; `ObjectSet<Q, RDPs>` | `Model.all(model)`; `TypedObjectSet<Model>`, the pair `{ model, objectSet }` | two values instead of phantom generics |
| `pivotTo(link)`, `LinkedType<Q, L>`, `LinkNames<Q>` | `Model.traverse(link, targetModel)` | the compiler checks link name and target from the link specs |
| `$select`, `SubSelectKeys<Q, X>` | `Model.pick(model, names)` | a narrowed model is a model |
| `$orderBy: { prop: "asc" }` | `Model.orderBy(reference, direction)`, `Model.thenBy`, set combinators that return an `OrderedObjectSet` | sort keys are an ordered list beside the set, not record insertion order; a tag without an order is a compile error |
| `WhereClause<Q>`, a filter typed by its object type | `Model.TypedFilter`, the pair `{ owner, filter }`; `Model.and`, `Model.or`, `Model.not` | the owner is a literal to compare, not a phantom parameter |
| `ActionDefinition`, `client(action).applyAction(args, options)` | `Model.action({ apiName, parameters })`; `Client.applyAction(model)(args)`, `applyActionWithEdits`, `validateAction` | the function that is called says what comes back, so no type depends on an option |
| `ActionValidationError`, thrown | `ActionRejected` in the error channel, a case of `ClientError` | a refused action is a typed failure that carries the validation report |
| `QueryDefinition`, `client(query).executeFunction(args)` | `Model.query({ apiName, version, parameters, output })`; `Client.executeQuery(model)(args)` | parameters and output are the two sides of two codecs |
| regenerating the SDK when the ontology changes | `Model.conformance(model, definition)` | drift between a model and the served type is a value |
| `MinimalClient` (`fetch`, `baseUrl`, `tokenProvider`, `ontologyRid`, `branch`) | `OntologyTransport`; `OntologyScope` in the `OntologyContext` service | one port in domain types; the scope is provided, not copied into every call |
| `PalantirApiError`; "Expected a single result but got n" | `ApiError` with an `ApiErrorBody`; `ObjectNotFound`, `MultipleObjectsFound` | the body is a wire record; two cases with different recoveries |
| `fetchPageWithErrors`, `ObjectSet.asyncIter` | `ClientError` in the error channel, `Client.stream` | subsumed by Effect |
| **Shapes, subscriptions, media, geometry, time** | | |
| `NullabilityOp`; `ShapeTransformResult { data, dropped, violations }` | `NullPolicy`; `Result<record, ShapeRejection>` | three exclusive outcomes instead of a bag of three fields |
| `computeShapeId` (djb2, 8 hex digits) | `shapeId` (SHA-256 of the canonical JSON) | a real digest of the whole definition |
| `SubscriptionSuccess`, `SubscriptionError`, `QosError` | `SubscribeSuccess`, `SubscribeFailure`, `SubscribeQosRejection` | `qos` is "retry elsewhere", not an error |
| OSDK `MediaTransformation` as records with one `$key` | the wire union on `type` | the `$key` records are client sugar |
| `BBox`, `Coordinate` | `BoundingBox`, `Longitude`, `Latitude`, `Altitude` | one alias hid three quantities with different ranges |
| `DistanceUnitMapping` (20 aliases) | `Distance.of(value, unit)`, one literal per unit | aliases are a second vocabulary for the same 9 values |
| `TimeSeriesQuery` (`$before`, `$after`, `$startTime` ...) | `TimeRange.last`, `since`, `until`, `between` | a tagged range instead of a keyless bag with `?: never` exclusions |

## 6. What it does better

Each line names the file that does it and a test that holds it.

| What | Where | Held by |
| --- | --- | --- |
| A `long` is a `bigint`: `"9007199254740993"` round-trips exactly. | `Value/Value.model.ts` `LongValue` | `test/Value.test.ts`, block (b) above |
| A decimal keeps its scale: `"12.50"` re-encodes as `"12.50"`, always as plain decimal text. OSDK types it `string`. | `Value/Value.model.ts` `DecimalValue` | `test/Value.test.ts`, block (b) above |
| A date is a calendar date (`LocalDate`), and 30 February does not decode. A timestamp must be ISO 8601 and may not roll an impossible day forward. | `Value/Value.model.ts` `DateValue`, `TimestampValue` | `test/Value.test.ts` |
| Arrays nest. OSDK's `multiplicity` flag cannot say "array of arrays". | `Property/Property.model.ts` `ArrayType` | `test/Property.test.ts` |
| A load level is a literal, not a union of four empty records. | `Property/Property.model.ts` `PropertyLoadLevel` | `test/Property.test.ts` |
| An object specifier splits at the first colon, so a key containing colons survives. OSDK's `split(":")[1]` truncates it. | `Object/Object.model.ts` `ObjectSpecifier` | `test/Object.test.ts` |
| The corners of a six-number (3D) bounding box are right. OSDK reads `bbox[3]` and `bbox[2]`, which in a six-number box are east and minimum altitude. | `Geo/Geo.model.ts` `BoundingBox.topLeft`, `bottomRight` | `test/Geo.test.ts` |
| All nine wire distance units are constructible. OSDK's alias table has none for millimetres. | `Geo/Geo.model.ts` `Distance` | `test/Geo.test.ts` |
| Operator checks are parameter types over tag families, and the same matrix is data. A test holds the typed families to the untyped table. | `Model/Model.filter.ts`, `Filter/Filter.policy.ts` | `test/Model.object.test.ts` |
| A filter operand is typed by the property it is compared with: a `bigint` for a long, a `LocalDate` for a date. The filter that travels holds the wire scalar, so filters, object sets and locators round-trip exactly, and one projection reads an operand back. OSDK types a `long` operand as `number`. | `Model/Model.filter.ts`, `Property/Property.behavior.ts` `operandCodec`, `Value/Value.model.ts` `ScalarValue` | `test/Model.object.test.ts`, `test/Property.test.ts`, `test/Filter.test.ts`, block (c) above |
| A dotted property name survives in a metric name: `address.zip.max` splits at the last dot. | `Aggregation/Aggregation.behavior.ts` `MetricKeyFromName` | `test/Aggregation.test.ts` |
| A query union type with `null` in any position projects to `Option`; a union return type projects to a union codec. | `Query/Query.model.ts` `nonNullAlternative`, `Query/Query.behavior.ts` | `test/Query.test.ts`, `test/Arguments.test.ts` |
| A query `set` is a `HashSet`, and an `entrySet` is a `HashMap` whose keys keep their type. | `Query/Query.behavior.ts` | `test/Arguments.test.ts` |
| The codec of a tag is stated once. Five projections (property, action parameter, struct field, query, agent) and the typed specs read one table, and totality is a type error, not a test. OSDK keeps six parallel value-mapping tables. | `Value/Value.behavior.ts` `sharedCodec`; `leafCodec` in `Property/Property.behavior.ts`, `Action/Action.behavior.ts`, `Query/Query.behavior.ts`; `Model/Model.spec.ts` | `test/Value.test.ts` ("the projection gives each of its ... shared tags the row of the shared table"), `test/Model.test.ts` ("leaf specs and the tables they are read from"), `test/Operations.test.ts` |
| A typed spec reads back as the property type it denotes, and its own codec and the projection of that type read the same values. | `Model/Model.spec.ts` `typeOf` | `test/Model.test.ts` ("typeOf") |
| Drift between code and the served ontology is a list of findings, with no SDK to regenerate. The check compares two property types: the served one and the one the spec denotes. | `Model/Model.policy.ts` `conformance`, `Model/Model.spec.ts` `typeOf` | `test/Model.object.test.ts`, block (e) above |
| Validation returns every problem, not the first: ontology, filter, aggregation, object set, derived property, shape. | `Ontology/Ontology.policy.ts`, `Filter/Filter.policy.ts`, `Aggregation/Aggregation.policy.ts`, `ObjectSet/ObjectSet.policy.ts`, `Shape/Shape.behavior.ts` | their concept tests |
| A saved ontology document that leaves out empty collections, or predates some of them, decodes; the canonical form writes every one. | `Ontology/Ontology.model.ts`, `ObjectType/ObjectType.model.ts`, `InterfaceType/InterfaceType.model.ts` | `test/Ontology.test.ts` ("saved ontology documents": real documents of the OSDK repository) |
| A shape's identity is a SHA-256 of its canonical JSON, pinned against `sha256sum`. | `Shape/Shape.behavior.ts` `shapeId` | `test/Shape.test.ts` |
| Secrets (`Plaintext`, media read tokens) are `Redacted` and absent from formatted output. | `CipherText/CipherText.model.ts`, `Media/Media.model.ts` | `test/References.test.ts` |
| Counts and sizes sent as text are `bigint`, not `Number(...)`. | `Page/Page.model.ts` `TotalCount`, `Attachment/Attachment.model.ts` `SizeBytes` | `test/Page.test.ts`, `test/Client.test.ts`, `test/References.test.ts`, block (f) above |
| `fetchOne` reads past an empty page that carries a token before it says "none", and `stream` requests a page only when its consumer needs one. | `Client/Client.behavior.ts` | `test/Client.test.ts` |
| An object has one instance codec. The projection from a served definition and a typed model call the same function, so one wire row decodes to equal values in both tiers, both keep the keys they do not declare, both hold `__primaryKey` to the key property in the key's own domain, and both refuse with the same words. OSDK has `convertWireToOsdkObjects` for the values and `Osdk.Instance` for the types. | `Object/Object.behavior.ts` `InstanceOf`, `instanceCodec`; `Model/Model.object.ts` `object` | `test/Model.object.test.ts` ("one instance codec for both tiers"), `test/Object.test.ts` ("InstanceOf"), block (b) above |
| An instance codec generates its own instances although two of its fields must agree: the locator is drawn from the key property, so `Arbitrary.schema(Employee.Instance)` yields instances that encode, and the strict round-trip law is checked on them for a model keyed by each of the nine kinds a key may have. | `Object/Object.behavior.ts` `InstanceOf` | `test/Model.object.test.ts` ("holds the same law for a model keyed by each kind a primary key may have"), `test/Object.test.ts` ("generates instances of each stub object type ...") |
| A row is decoded once. The port returns a page with its envelope read and its rows as the records the platform sent; the read decodes each with the codec of the set, a model's or the untyped one, through one function. The answer's envelope is one factory with the row codec as its parameter. | `Client/Client.model.ts` `LoadObjectsResponseOf`, `LoadObjectsResponse`; `Client/Client.behavior.ts` `fetchPage`, `untyped`; `Faux/Faux.behavior.ts` `loadObjects` | `test/Client.test.ts` ("every read decodes each row exactly once, with the codec the set carries", "the port hands rows on as the records that arrived", "LoadObjectsResponseOf"), `test/Api.test.ts`, `test/Faux.test.ts`, block (f) above |

## 7. What it does not do

Not modelled or not built:

- Interface-typed models. `Model.object` describes object types only; the interface load response
  (`LoadObjectSetV2MultipleObjectTypesResponse`) and a transport member for it are absent.
- Derived properties in the typed layer. `ObjectSet.withProperties` and `DerivedProperty` are untyped values: a
  `TypedObjectSet` does not track them and a model's `Instance` does not type them (a derived value that arrives
  in a row is kept, as JSON, in `undeclared`). `nearestNeighbors` and `narrowTo` are likewise untyped only.
- Typed aggregation results. `Client.aggregate` returns rows keyed by `MetricKey`; no result type is computed
  from the request, as OSDK's `AggregationsResults<Q, AO>` does.
- Typed `eq` / `oneOf` on the six reference-valued tags (cipher text, attachment, media reference, geotime series
  reference, time series, vector). The untyped table admits them with a text operand. `Property.operandCodec`
  reads that text as the property's value only where the value itself travels as text (a cipher text, a series
  named by a bare identifier); for an attachment, a media reference and a vector the text is not a value of the
  property and stays text.
- Parts of typed actions and queries. `Model.action`, `Model.query` and the four functions of the operations
  facade exist (block (g)); these do not:
  - a value spec for four query tags: a by-name type reference (so a recursive query type cannot be written as
    a model; `queryConformance` follows the references of the served side), `void`, `null` on its own
    (`Model.nullable` covers a union with `null`) and `unsupported`;
  - a typed batch application. The port has `applyActionBatch`; no facade function takes a model and a list of
    argument records, and the in-memory transport refuses the request;
  - a conformance check below the tag for two shapes: `actionConformance` and `queryConformance` compare a
    vector by its tag, not its dimension, and a union by its tag, not its alternatives. (`Model.conformance`,
    for object models, does compare vector dimensions.)
- Running services beyond the read and operations facades: subscriptions (the protocol is schemas; there is no
  socket or listener), media upload and transformation flows (nothing submits or polls a transformation job,
  and no error class exists for one that fails or times out), time-series reads, agent session polling (its two
  timeout errors exist and nothing raises them).
- Reading media and attachment metadata. The transport has no member for media content, media metadata or an
  attachment's metadata by RID; `MediaItemMetadata` and `AttachmentMetadata` are schemas with no route behind
  them. Attachment content and upload are the only two attachment routes.
- Cipher text beyond its envelope. Nothing decrypts (`DecryptionResult` is a schema with no route), and no value
  pairs a plaintext with a channel strategy to update an encrypted property (OSDK's `UpdateCipherText`).
- Streaming function execution. `Query.QueryStreamEvent` models the events; `executeQuery` is request and
  response only.
- Typed shape results and link load state. `applyShape` maps an untyped record to an untyped record, a `Shape`
  has no type parameter, and nothing loads a shape's derived links, so OSDK's `ShapeInstance` and `LinkStatus`
  have no counterpart.
- Six wire unions of the families modelled here: the V1 search query, the V1 aggregation and V1 group-by,
  transaction edits, edit-history edits and the action-type search query.
- A fetch-by-primary-key helper, a helper for a read by RID (it is the pair
  `{ model, objectSet: ObjectSet.objects(rids) }` given to `Client.fetchPage`), and a placeholder for "the source
  object's primary key" inside a shape's link filter (OSDK's `SourcePrimaryKeySymbol`).
- OSDK's input sugar: unit alias tables (`ms`, `hr`, `cm`), `$key` transformation records. Constructors replace
  them.
- Rendering. `ValueFormat` says how a value should be displayed; nothing formats one.
- A code generator and the ontology authoring model. Models are written by hand and checked with
  `Model.conformance`, `Model.actionConformance` and `Model.queryConformance`.
- Value-level enforcement of a decimal's declared precision and scale. It carries a `crispen:` note in the
  source.
- Aggregation checks in the typed layer. `Aggregation.checkAggregation` holds a request to the metric, grouping
  and duration-unit tables at runtime; `Client.aggregate` does not call it, `Faux` does not consult the tables,
  and `Model` has no typed metric constructor, so a `sum` over a string property is a finding only when asked for
  and never a compile error.
- Everything in the in-memory transport: `Faux.layer` refuses batches of actions, pages of links and
  attachments with a typed `ApiError`, reports every registered action as valid, and does not model permissions,
  limits or search-engine tokenisation.

Open design findings. [`REVIEW.md`](./REVIEW.md) numbers the review's findings F1 to F23 and its first section
gives the status of each after the fix wave. F4, the operand union that could not decode its own members, is
closed: `ScalarValue` and `PrimaryKeyValue` are the JSON scalars that travel, the rule is in section 4, and the
tests hold every schema to the strict round-trip law where 78 of them were held to wire stability
(`encode(decode(encode(x))) = encode(x)`). F5, the rows from a type tag to its value codec written by hand in
five projections and again in the typed specs, is closed for every leaf: `Value.sharedCodec` states the row of
each of the 16 tags every universe reads alike, each projection and each leaf spec reads a table by key, and a
spec is one representation with a tagged shape (the "A tag has one row" and "A spec has one representation"
items of section 4). What F5 leaves written twice
is listed under "Sharp edges" below. F6, three shapes for one object and a run-time bridge between two of them,
is closed: an object has two decoded shapes and one instance codec, `Object.InstanceOf`, which the dynamic
projection and a typed model both call; the port returns rows as wire records and the read facade decodes each
once, with the codec its set carries, typed or untyped (the last item of section 4). Of the twelve major
findings, the one not fully closed is F7.

Smaller open items, each with its evidence in `REVIEW.md`: three enum literals still break the literal rule of
section 4 (F7), `ObjectType` checks three cross-field rules in its wire codec (F14), and F16 to F23.

Sharp edges:

- `S.Record(<branded key>, V)` silently drops an entry whose key fails the key schema. This is Effect's behaviour;
  `test/Shape.test.ts` pins it.
- Closed enums and tag sets reject a literal that a newer server adds, and the whole enclosing value fails with
  it. `MediaItemMetadata` has no `unknown` fallback on purpose.
- Only collections are defaulted when a saved document leaves them out. A wire-required scalar that is absent
  (`rid` on a property, `displayName` on an action parameter, `pluralDisplayName` or `icon` on an object type)
  still rejects the document: of the nine `ontology.json` files in the OSDK repository, three decode whole and
  six stop at such a key.
- A key that decodes with a default is optional in the schema's `Encoded` type, although encoding always writes
  it. `typeof ObjectTypeDefinition.Encoded` therefore accepts a document without `implementsInterfaces2`.
- Instants re-encode in canonical form (`2019-01-01T00:00:00Z` becomes `2019-01-01T00:00:00.000Z`) and digits
  finer than a millisecond are truncated.
- An instance codec, of a model or projected from a definition, holds `__primaryKey` to the key property: a
  record whose two keys differ is refused, in both tiers. A locator-only record, a record loaded with a `select`
  that omits the key, and a record loaded with property securities (every value wrapped) are not instances; all
  three decode as `Object.OntologyObject`, which is what a read through `Client.untyped` returns.
- A typed instance keeps what its model does not declare. A record read with a narrowed model
  (`Model.pick`) carries the properties that were not picked in `undeclared`, as JSON, and writes them back.
- The decoded side of an instance codec is a declaration, not a plain struct with a check. The agreement of the
  two keys ties two fields together, and Effect derives an arbitrary for such a rule only from a declaration that
  says how to generate itself (draw the properties, locate the object by its key property). The guard, the
  equivalence and the refusals are those of the checked struct; the price is that a decoded instance is validated
  a second time by the declaration.
- A property codec needs no service. `Model.PropertySpec` and `Object.InstanceOf` are bounded by
  `Object.PropertyCodec` (`S.Codec<unknown, unknown>`), because the instance codec reads and writes a key on its
  own to compare the two keys.
- A row on the port is checked to be a record with its two identity keys and is otherwise unread: its
  `__apiName` is text and may be empty. A read of such a row fails with a `DecodeError` that has an index and no
  locator.
- `ObjectNotFound` and `MultipleObjectsFound` name the object type of the model a read was typed by. A read of
  an untyped set was typed by none, so their `objectType` is an `Option`.
- `Client.fetchPage` returns the page shape: rows, cursor and count. The security table, the compute usage and
  the entities of an answer are on the port's `LoadObjectsResponse`, and on `LoadObjectsResponseOf(identifier, row)`
  when a whole answer is decoded with a row codec; the facade does not hand them on.
- `ObjectType` is the one `S.Class`: `S.is(ObjectType)(plainObject)` is false. Build values with
  `ObjectType.make` or by decoding.
- `X.make` throws on invalid input such as an empty API name. `Model.all`, `Model.orderBy`, the reference specs
  of `Model.action.ts` and the three conformance functions brand names with it and say so with `@throws`. The
  filter constructors brand a bare property name the same way, through `Filter.toSelector`, which documents it.
- The typed filter constructors that take a value of the property (`Model.eq`, `ne`, `oneOf`, `contains`, `gt`,
  `gte`, `lt`, `lte`) throw when the operand is not one. The static type of an operand is wider than the codec's
  checks: a `number` can be past 32 bits and a `LocalDate` can be a 30 February. What is thrown is the codec's
  `SchemaError`, with the property's name as the path of its issue.
- An untyped filter, range and locator take the wire scalar only. `Filter.gt("startedAt", someDateTime)` does not
  compile; write the operand with `Property.operandCodec(type)` or build the filter through a model.
- `ObjectSpecifier` refuses to encode an object type name that contains a colon, because it could not split the
  text back. Its round trip is exact for only part of its `Type`: the text `"Employee:50030"` cannot say whether
  the key was the number or the text, so decoding yields a text key and a locator with a number or boolean key
  comes back with text. It is the one schema that held the weaker law before F4 and still does.
- An instance keeps the key of `locator` as the wire scalar; the rich key is the key property in `properties`.
  The two are compared in the key's own domain, so an instant spelled with and without milliseconds is one key,
  and the locator is written back as it came.
- The rules that compose codecs are still written once per layer. A projection builds the codec of an array, a
  set, a map, a struct or a nullable from a type at run time; `Model.array`, `struct`, `listOf`, `structOf`,
  `setOf`, `mapOf` and `nullable` build the statically typed one. They are held together by tests
  (`test/Model.test.ts` "typeOf", `agree` in `test/Operations.test.ts`), not by one definition. They differ in one
  place: a struct with no fields drops an undeclared key as a typed spec and refuses it as a projection
  (`S.Record(S.String, S.Never)`).
- An action and a query each state the rows of the references they both have (`attachment` as an identifier,
  `object`, `objectSet`, `interfaceObject`, `unsupported`), because `Object` and `ObjectSet` come after `Value` in
  the dependency order and cannot be in the shared table. `test/Operations.test.ts` holds the two tables equal
  on every tag they share.
- `Model.typeOf` states less than a served type does. A spec has no rids and does not say what the points of a
  time series hold, so the `rid` of a struct field is the field's own name and a time series holds
  `numericOrNonNumeric` points. Compare its result by structure, as `Model.conformance` does.
- `Model.vector` throws on a dimension that is not a positive integer, and `Model.required(spec)` is a property
  spec only: the marker drops `member`, so a typed action takes the spec it marks, not the marked one.
- `Client.applyAction` treats an answer whose validation verdict is `invalid` as the failure `ActionRejected`,
  whatever the status of the answer. `Client.validateAction` returns the same verdict as a value.

## 8. How to verify

From the repository root (`R`):

```bash
cd R && ./node_modules/.bin/tsrs -p scratchpad/osdk/tsconfig.json --noEmit --pretty false
cd R/scratchpad && bunx --bun vitest run --config osdk/vitest.config.ts
cd R/scratchpad && BEEP_VITEST_DOCTEST=1 bunx --bun vitest run --config osdk/vitest.config.ts
```

`tsrs` runs the type checker and the Effect language-service rules as errors; a clean run prints nothing. Final
lines of the three commands on 2026-11-13:

```text
$ ./node_modules/.bin/tsrs -p scratchpad/osdk/tsconfig.json --noEmit --pretty false
(no output)

$ bunx --bun vitest run --config osdk/vitest.config.ts
 Test Files  37 passed (37)
      Tests  4282 passed (4282)

$ BEEP_VITEST_DOCTEST=1 bunx --bun vitest run --config osdk/vitest.config.ts
 Test Files  75 passed (75)
      Tests  754 passed (754)
```

Append a test file (`test/Readme.test.ts`) or a source folder (`src/Property`) to the second or third command to
run one concept.

The repository's four Effect law gates are a separate check, run from `R` as `bun run beep laws <gate> --check`
over `scratchpad/osdk/src` (`--include-prefix scratchpad/osdk/src` for `native-runtime` and `effect-imports`,
`--include <comma-separated files>` for `effect-fn` and `terse-effect`). On 2026-11-13 all four exit 0 over the
109 source files: `native-runtime` `errors=0`, `effect-imports` `manual_reviews=0`, `effect-fn` `violations=0`,
`terse-effect` `blocking_files=0`.

## 9. Layout

```text
src/index.ts                      one namespace export per concept
src/<Concept>/index.ts            the concept's barrel
src/<Concept>/<Concept>.<role>.ts
src/internal/                     shared by concepts, not exported
test/<Concept>.test.ts            laws, exact wire fixtures, counter-examples
```

Roles: `.model.ts` schemas; `.values.ts` literal domains; `.behavior.ts` pure folds, constructors and projections;
`.policy.ts` decision tables and validation; `.errors.ts` tagged errors; `.service.ts` `Context.Service`
contracts; `.operations.ts` the typed facade for actions and queries; `.definition.ts` and `.layer.ts` the HTTP
routes and the layers. A concept with more than one model file names each for its subject (`Model.spec.ts`,
`Model.object.ts`, `Model.filter.ts`, `Model.set.ts`, `Model.action.ts`, `Model.query.ts`, `Action.rules.ts`,
`Property.addressing.ts`). Four files are named for a subject other than their folder: `MediaMetadata.model.ts`,
`MediaTransformation.model.ts` and `MediaTransformation.values.ts` in `Media`, and `GeotimeSeries.model.ts` in
`TimeSeries`. Concepts import each other through the role file with its `.ts` extension, never through a barrel.
Every identified schema takes its identity from `$ScratchpadId.create("osdk/<Concept>/<file name>")`, the path
of the file that declares it.

Examples: 626 of the 697 exported constants carry a runnable example in their JSDoc, which is every exported
union, kit, codec, table, projection and function. The 71 without one are 70 brands over non-empty text (API names,
RIDs and other identifiers) and `Security.ConjunctiveMarkings`, an array of one of those brands. 109 of the 680
exported classes carry one too; the other 571 have no example of their own. The doctest run of section 8
executes all 754 examples.

Tests: 37 files. 26 of the 33 concepts have a file of their own name. `Attachment`, `CipherText`, `Security`
and the reference half of `Media` are in `References.test.ts`, the rest of `Media` in the three `Media*` files,
`Link` in `Subscription.test.ts`, `LinkType` in `ObjectType.test.ts` and `DerivedProperty` in
`ObjectSet.test.ts`. The other eleven files are named for what they hold: `Arguments`, `GeotimeSeries`,
`LiteralRule`, `MediaMetadata`, `MediaOperations`, `MediaTransformation`, `Model.object`, `Operations`, `Readme`,
`RecursionHint`, `References`.

Two things sat in this folder while the package was written and are not committed with it: `index.ts`, an
earlier sketch, and `client/api`, 210 files of type declarations that carry Palantir's Apache 2.0 header. Both
are outside the `include` of `tsconfig.json` and the globs of `vitest.config.ts`, and no number in this file
counts them.

Two records sit beside this file, and each opens with a section dated 2026-11-12 that gives its state after the
fix wave. `REVIEW.md` is the independent review of the laws, the consistency and the design, with its findings
numbered F1 to F23 and a status for each: fixed, partly fixed or open. `PORTING_LEDGER.md` gives the disposition
of each of the 310 `@osdk/api` exports (ported, redesigned, subsumed, rejected or missing) and ranks what is
missing; its opening section recomputes the totals and the ranking.
