import { LocalDate } from "@beep/schema/LocalDate";
import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as BigDecimal from "effect/BigDecimal";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equivalence from "effect/Equivalence";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Tuple from "effect/Tuple";
import { AddedObject, ApplyActionRequest } from "../src/Action/Action.model.ts";
import {
  AggregationRange,
  approximateDistinct,
  approximatePercentile,
  avg,
  count as countMetric,
  duration,
  exact,
  exactDistinct,
  fixedWidth,
  max,
  min,
  ordered,
  ranges,
  sum,
} from "../src/Aggregation/index.ts";
import {
  aggregate,
  ApiError,
  count,
  FetchOptions,
  fetchPage,
  LoadObjectsRequest,
  OntologyTransport,
  stream,
  untyped,
} from "../src/Client/index.ts";
import {
  addLink,
  addObject,
  empty,
  evaluateObjectSet,
  FauxWorld,
  layer,
  loadObjects,
  matchesFilter,
  OffsetFromPageToken,
} from "../src/Faux/index.ts";
import * as Filter from "../src/Filter/Filter.behavior.ts";
import {
  BoundingBoxCorners,
  CircularArea,
  ContainsAllTerms,
  ContainsAnyTerm,
  EnvelopeGeometry,
  IntervalMatch,
  RelativeDateRange,
} from "../src/Filter/Filter.model.ts";
import { Distance, GeoPoint, Polygon } from "../src/Geo/Geo.model.ts";
import {
  ActionTypeApiName,
  AttachmentRid,
  LinkTypeApiName,
  ObjectTypeApiName,
  ParameterId,
  PropertyApiName,
  QueryApiName,
} from "../src/Identifier/Identifier.model.ts";
import { Link } from "../src/Link/Link.model.ts";
import * as Model from "../src/Model/index.ts";
import { ObjectLocator, OntologyObject } from "../src/Object/Object.model.ts";
import * as ObjectSets from "../src/ObjectSet/ObjectSet.behavior.ts";
import { OrderByFields, OrderByRelevance, PropertyOrdering } from "../src/ObjectSet/ObjectSet.model.ts";
import { getObjectType } from "../src/Ontology/Ontology.behavior.ts";
import { PageToken } from "../src/Page/Page.model.ts";
import { PropertyByName, TitleProperty } from "../src/Property/Property.model.ts";
import { ExecuteQueryRequest } from "../src/Query/Query.model.ts";
import type { MetricLookup, PropertyMetricKind } from "../src/Aggregation/index.ts";
import type { FauxActionHandler, FauxQueryHandler } from "../src/Faux/index.ts";
import type { ObjectFilter } from "../src/Filter/Filter.model.ts";

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
    entrance: Model.geopoint,
  },
  links: { occupants: Model.many("Employee") },
});

const Employee = Model.object({
  apiName: "Employee",
  primaryKey: "employeeId",
  properties: {
    employeeId: Model.required(Model.integer),
    fullName: Model.string,
    title: Model.string,
    salary: Model.double,
    badge: Model.long,
    bonus: Model.decimal,
    active: Model.boolean,
    startDate: Model.date,
    lastSeen: Model.timestamp,
    skills: Model.array(Model.string),
    desk: Model.geopoint,
  },
  links: { office: Model.one("Office") },
});

// -----------------------------------------------------------------------------
// The world: three offices and nine employees, as a wire fixture
// -----------------------------------------------------------------------------

const property = (type: string) => ({ dataType: { type }, rid: `ri.property.${type}`, typeClasses: [] });

const implementsLocated = {
  implementsInterfaces: ["Located"],
  implementsInterfaces2: { Located: { properties: {}, propertiesV2: {}, links: {}, actionTypes: {} } },
  sharedPropertyTypeMapping: {},
};

const point = (longitude: number, latitude: number) => ({ type: "Point", coordinates: [longitude, latitude] });

const employee = (employeeId: number, properties: Readonly<Record<string, S.Json>>) => ({
  __apiName: "Employee",
  __primaryKey: employeeId,
  employeeId,
  ...properties,
});

const worksAt = (employeeId: number, officeId: string) => ({
  source: { objectType: "Employee", primaryKey: employeeId },
  linkType: "office",
  target: { objectType: "Office", primaryKey: officeId },
});

const adaRid = "ri.phonograph2-objects.main.object.ada";

const fixture = {
  ontology: {
    ontology: {
      apiName: "faux",
      displayName: "Faux",
      description: "A company held in memory",
      rid: "ri.ontology.main.ontology.faux",
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
          properties: {
            officeId: property("string"),
            city: property("string"),
            capacity: property("integer"),
            entrance: property("geopoint"),
          },
          rid: "ri.ontology.main.object-type.office",
          status: "ACTIVE",
        },
        linkTypes: [
          {
            apiName: "occupants",
            status: "ACTIVE",
            objectTypeApiName: "Employee",
            cardinality: "MANY",
            displayName: "Occupants",
            linkTypeRid: "ri.ontology.main.link-type.employee-office",
          },
        ],
        ...implementsLocated,
      },
      Employee: {
        objectType: {
          apiName: "Employee",
          displayName: "Employee",
          pluralDisplayName: "Employees",
          aliases: [],
          datasources: [],
          icon: { type: "blueprint", color: "blue", name: "person" },
          primaryKey: "employeeId",
          titleProperty: "fullName",
          properties: {
            employeeId: property("integer"),
            fullName: property("string"),
            title: property("string"),
            salary: property("double"),
            badge: property("long"),
            bonus: property("decimal"),
            active: property("boolean"),
            startDate: property("date"),
            lastSeen: property("timestamp"),
            skills: {
              dataType: { type: "array", subType: { type: "string" }, reducers: [] },
              rid: "ri.property.skills",
              typeClasses: [],
            },
            desk: property("geopoint"),
          },
          rid: "ri.ontology.main.object-type.employee",
          status: "ACTIVE",
        },
        linkTypes: [
          {
            apiName: "office",
            status: "ACTIVE",
            objectTypeApiName: "Office",
            cardinality: "ONE",
            displayName: "Office",
            linkTypeRid: "ri.ontology.main.link-type.employee-office",
          },
        ],
        ...implementsLocated,
      },
    },
    actionTypes: {},
    queryTypes: {},
    interfaceTypes: {
      Located: {
        apiName: "Located",
        description: "Anything with a place on the globe",
        displayName: "Located",
        rid: "ri.ontology.main.interface.located",
        extendsInterfaces: [],
        properties: {},
        allProperties: {},
        propertiesV2: {},
        allPropertiesV2: {},
        links: {},
        implementedByObjectTypes: ["Office", "Employee"],
        allExtendsInterfaces: [],
        allLinks: {},
      },
    },
    sharedPropertyTypes: {},
    valueTypes: {},
  },
  objects: [
    {
      __apiName: "Office",
      __primaryKey: "NYC",
      officeId: "NYC",
      city: "New York",
      capacity: 120,
      entrance: point(-74.006, 40.7128),
    },
    {
      __apiName: "Office",
      __primaryKey: "LDN",
      officeId: "LDN",
      city: "London",
      capacity: 80,
      entrance: point(-0.1276, 51.5072),
    },
    {
      __apiName: "Office",
      __primaryKey: "SFO",
      officeId: "SFO",
      city: "San Francisco",
      capacity: 200,
      entrance: point(-122.4194, 37.7749),
    },
    {
      ...employee(1, {
        fullName: "Ada Lovelace",
        title: "Principal Software Engineer",
        salary: 180,
        badge: "9007199254740993",
        bonus: "1000.50",
        active: true,
        startDate: "2015-03-01",
        lastSeen: "2024-05-01T09:00:00Z",
        skills: ["math", "engines"],
        desk: point(-74, 40.7),
      }),
      __rid: adaRid,
    },
    employee(2, {
      fullName: "Grace Hopper",
      title: "Senior Compiler Engineer",
      salary: 170,
      badge: "9007199254740992",
      bonus: "1000.5",
      active: true,
      startDate: "2016-07-15",
      lastSeen: "2024-05-02T10:30:00Z",
      skills: ["compilers", "cobol"],
      desk: point(-74.01, 40.71),
    }),
    employee(3, {
      fullName: "Alan Turing",
      title: "Research Scientist",
      salary: 160,
      badge: "100",
      bonus: "250.25",
      active: false,
      startDate: "2018-01-10",
      lastSeen: "2023-12-31T23:59:59Z",
      skills: ["math", "logic"],
      desk: point(-0.12, 51.5),
    }),
    employee(4, {
      fullName: "Edsger Dijkstra",
      title: "Software Architect",
      salary: 150,
      badge: "200",
      bonus: "0",
      active: true,
      startDate: "2019-11-30",
      lastSeen: "2024-01-15T08:00:00Z",
      skills: ["algorithms"],
      desk: point(-0.13, 51.51),
    }),
    employee(5, {
      fullName: "Barbara Liskov",
      title: "Distinguished Engineer",
      salary: 200,
      badge: "300",
      bonus: "5000",
      active: true,
      startDate: "2012-05-20",
      lastSeen: "2024-06-01T12:00:00Z",
      skills: ["abstraction", "languages"],
      desk: point(-122.42, 37.77),
    }),
    employee(6, {
      fullName: "Donald Knuth",
      title: "Staff Software Engineer",
      salary: 190,
      badge: "400",
      bonus: "750.75",
      active: false,
      startDate: "2010-09-01",
      lastSeen: "2022-03-03T03:03:03Z",
      skills: ["algorithms", "typesetting"],
      desk: point(-122.4, 37.78),
    }),
    employee(7, {
      fullName: "Margaret Hamilton",
      title: "Software Engineering Lead",
      salary: 185,
      badge: "500",
      bonus: "1200",
      active: true,
      startDate: "2014-02-14",
      lastSeen: "2024-04-20T16:45:00Z",
      skills: ["reliability"],
      desk: point(-74.02, 40.72),
    }),
    employee(8, {
      fullName: "Linus Torvalds",
      title: "Kernel Engineer",
      salary: 175,
      badge: "600",
      bonus: "300",
      active: true,
      startDate: "2020-06-01",
      lastSeen: "2024-05-30T07:15:00Z",
      skills: ["kernels", "git"],
    }),
    // Knows nothing about himself: every optional property is absent, and one is an explicit null.
    employee(9, { fullName: "Ken Thompson", salary: null }),
  ],
  links: [
    worksAt(1, "NYC"),
    worksAt(2, "NYC"),
    worksAt(3, "LDN"),
    worksAt(4, "LDN"),
    worksAt(5, "SFO"),
    worksAt(6, "SFO"),
    worksAt(7, "NYC"),
  ],
};

const World = Effect.orDie(S.decodeUnknownEffect(FauxWorld)(fixture));

// -----------------------------------------------------------------------------
// Handlers and the transport
// -----------------------------------------------------------------------------

const decodeRow = S.decodeUnknownEffect(OntologyObject);

// Hires whoever the arguments describe: the arguments are the properties of the new employee.
const hireEmployee: FauxActionHandler = Effect.fnUntraced(function* (parameters, world) {
  const properties = R.getSomes(parameters);
  const employeeId = O.getOrNull(R.get(properties, ParameterId.make("employeeId")));
  const row = yield* Effect.orDie(decodeRow({ ...properties, __apiName: "Employee", __primaryKey: employeeId }));
  return {
    world: addObject(world, row),
    edits: [AddedObject.make({ objectType: ObjectTypeApiName.make("Employee"), primaryKey: employeeId })],
  };
});

const headcount: FauxQueryHandler = (_, world) =>
  Effect.succeed(A.filter(world.objects, (object) => object.locator.objectType === "Employee").length);

const FauxLive = Layer.unwrap(
  Effect.map(World, (world) => layer({ world, actions: { hireEmployee }, queries: { headcount } }))
);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const defaults = FetchOptions.make({});

// Deep equality without tying the expected value to the static type of the actual one.
const same = (actual: unknown, expected: unknown): void => deepStrictEqual(actual, expected);

// Runs an effect and compares what it produced.
const equals = <Value, Failure, Requirements>(effect: Effect.Effect<Value, Failure, Requirements>, expected: unknown) =>
  Effect.map(effect, (actual) => same(actual, expected));

const employees = Model.all(Employee);
const offices = Model.all(Office);

const idsOf = (set: Model.TypedObjectSet<typeof Employee>, options: FetchOptions = defaults) =>
  Effect.map(fetchPage(set, options), (page) => A.map(page.data, (found) => found.properties.employeeId));

const officeIdsOf = (set: Model.TypedObjectSet<typeof Office>) =>
  Effect.map(fetchPage(set, defaults), (page) => A.map(page.data, (found) => found.properties.officeId));

const matching = (filter: Model.TypedFilter<"Employee">) => idsOf(Model.where(employees, filter));

// A filter from the untyped module enters the typed layer as a pair with the model's API name.
const plain = (filter: ObjectFilter): Model.TypedFilter<"Employee"> => ({ owner: Employee.apiName, filter });

const isApiError = S.is(ApiError);

// What a refused request failed with: the error name, and the feature it names when it names one.
const refusalOf = <Value, Failure extends { readonly _tag: string }, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>
) =>
  Effect.map(Effect.flip(effect), (error) =>
    isApiError(error)
      ? Tuple.make<[string, S.Json]>(error.errorName, O.getOrNull(R.get(error.parameters, "feature")))
      : Tuple.make<[string, S.Json]>(error._tag, null)
  );

const unsupported = (feature: string) => Tuple.make<[string, S.Json]>("FauxUnsupportedFeature", feature);

const named = (errorName: string) => Tuple.make<[string, S.Json]>(errorName, null);

const metricOf = (lookup: MetricLookup, name: string, kind: PropertyMetricKind): S.Json =>
  pipe(
    R.get(lookup.properties, PropertyApiName.make(name)),
    O.flatMap((values) => values[kind]),
    O.getOrNull
  );

const salary = PropertyApiName.make("salary");
const active = PropertyApiName.make("active");
const startDate = PropertyApiName.make("startDate");

const newYork = GeoPoint.make({ coordinates: [-74.006, 40.7128] });

const london = BoundingBoxCorners.make({
  topLeft: GeoPoint.make({ coordinates: [-1, 52] }),
  bottomRight: GeoPoint.make({ coordinates: [0, 51] }),
});

const bayArea = Polygon.make({
  coordinates: [
    [
      [-123, 37],
      [-122, 37],
      [-122, 38],
      [-123, 38],
      [-123, 37],
    ],
  ],
});

// -----------------------------------------------------------------------------
// The world as data
// -----------------------------------------------------------------------------

describe("FauxWorld", () => {
  it.effect(
    "decodes the fixture into a dozen objects and seven links",
    Effect.fnUntraced(function* () {
      const world = yield* World;
      strictEqual(world.objects.length, 12);
      strictEqual(world.links.length, 7);
      same(R.keys(world.ontology.objectTypes), ["Office", "Employee"]);
    })
  );

  it.effect(
    "survives its wire form",
    Effect.fnUntraced(function* () {
      const world = yield* World;
      const wire = yield* S.encodeEffect(FauxWorld)(world);
      const again = yield* S.decodeEffect(FauxWorld)(wire);
      assertTrue(S.toEquivalence(FauxWorld)(again, world));
      yield* equals(S.encodeEffect(FauxWorld)(again), wire);
    })
  );

  it.effect(
    "is built by pure constructors: adding replaces by identity and links are a set",
    Effect.fnUntraced(function* () {
      const seeded = yield* World;
      const row = yield* decodeRow({ __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 300 });
      const fresh = yield* decodeRow({ __apiName: "Office", __primaryKey: "BER", officeId: "BER" });
      const link = Link.make({
        source: ObjectLocator.make({ objectType: ObjectTypeApiName.make("Employee"), primaryKey: 8 }),
        linkType: LinkTypeApiName.make("office"),
        target: ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "BER" }),
      });
      const blank = empty(seeded.ontology);
      same([blank.objects.length, blank.links.length], [0, 0]);
      const grown = pipe(seeded, addObject(row), addObject(fresh), addLink(link), addLink(link));
      strictEqual(grown.objects.length, 13);
      strictEqual(grown.links.length, 8);
      same(
        A.map(A.take(grown.objects, 1), (office) => office.properties),
        [{ officeId: "NYC", capacity: 300 }]
      );
      // The seeded world is a value: growing it left it as it was.
      strictEqual(seeded.objects.length, 12);
    })
  );

  it.effect(
    "reads its page tokens as offsets and rejects any other token",
    Effect.fnUntraced(function* () {
      const token = yield* S.encodeEffect(OffsetFromPageToken)(25);
      strictEqual(token, "faux-offset-25");
      yield* equals(S.decodeEffect(OffsetFromPageToken)(token), 25);
      assertNone(S.decodeUnknownOption(OffsetFromPageToken)("25"));
      assertNone(S.decodeUnknownOption(OffsetFromPageToken)("faux-offset--1"));
      assertNone(S.decodeUnknownOption(OffsetFromPageToken)("faux-offset-1.5"));
    })
  );
});

// -----------------------------------------------------------------------------
// End to end: the typed facade over the in-memory transport
// -----------------------------------------------------------------------------

it.layer(FauxLive)("the typed facade over the in-memory transport", (it) => {
  it.effect(
    "the transport hands out the ontology the world defines",
    Effect.fnUntraced(function* () {
      const transport = yield* OntologyTransport;
      const ontology = yield* transport.loadOntology(O.none());
      same(R.keys(ontology.objectTypes), ["Office", "Employee"]);
      same(R.keys(ontology.interfaceTypes), ["Located"]);
    })
  );

  it.effect(
    "every object of a model comes back as a typed instance",
    Effect.fnUntraced(function* () {
      const page = yield* fetchPage(employees, defaults);
      same(
        A.map(page.data, (found) => found.properties.employeeId),
        [1, 2, 3, 4, 5, 6, 7, 8, 9]
      );
      assertSome(page.totalCount, BigInt(9));
      assertNone(page.nextPageToken);
      const ada = yield* Effect.fromOption(A.head(page.data));
      deepStrictEqual(
        ada.locator,
        ObjectLocator.make({ objectType: ObjectTypeApiName.make("Employee"), primaryKey: 1 })
      );
      assertSome(ada.properties.badge, BigInt("9007199254740993"));
      assertSome(
        O.map(ada.properties.startDate, (date) => [date.year, date.month, date.day]),
        [2015, 3, 1]
      );
      assertSome(O.map(ada.properties.lastSeen, DateTime.formatIso), "2024-05-01T09:00:00.000Z");
      assertSome(ada.properties.skills, ["math", "engines"]);
      // The resource identifier is only returned when the request asks for it.
      assertNone(ada.rid);
    })
  );

  it.effect(
    "comparison filters compare numbers numerically",
    Effect.fnUntraced(function* () {
      yield* equals(matching(Model.gt(Employee.property("salary"), 175)), [1, 5, 6, 7]);
      yield* equals(matching(Model.gte(Employee.property("salary"), 175)), [1, 5, 6, 7, 8]);
      yield* equals(matching(Model.lt(Employee.property("salary"), 160)), [4]);
      yield* equals(matching(Model.lte(Employee.property("salary"), 160)), [3, 4]);
      // 9 sorts before 10 as a number and after it as text.
      yield* equals(matching(Model.lt(Employee.property("employeeId"), 10)), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    })
  );

  it.effect(
    "comparison filters compare 64-bit integers and decimals exactly",
    Effect.fnUntraced(function* () {
      // Both badges round to the same double: only exact arithmetic tells them apart.
      yield* equals(matching(Model.gt(Employee.property("badge"), BigInt("9007199254740992"))), [1]);
      yield* equals(matching(Model.eq(Employee.property("badge"), BigInt("9007199254740992"))), [2]);
      // "1000.50" and "1000.5" are one decimal.
      const bonus = BigDecimal.fromStringUnsafe("1000.5");
      yield* equals(matching(Model.eq(Employee.property("bonus"), bonus)), [1, 2]);
      yield* equals(matching(Model.gt(Employee.property("bonus"), bonus)), [5, 7]);
    })
  );

  it.effect(
    "comparison filters compare dates and instants chronologically and text lexically",
    Effect.fnUntraced(function* () {
      const newYear2015 = LocalDate.make({ year: 2015, month: 1, day: 1 });
      yield* equals(matching(Model.lt(Employee.property("startDate"), newYear2015)), [5, 6, 7]);
      const may2024 = DateTime.makeUnsafe("2024-05-01T00:00:00Z");
      yield* equals(matching(Model.gte(Employee.property("lastSeen"), may2024)), [1, 2, 5, 8]);
      // The same instant written with another offset is the same instant.
      const nineInLondon = DateTime.makeUnsafe("2024-05-01T11:00:00+02:00");
      yield* equals(matching(Model.eq(Employee.property("lastSeen"), nineInLondon)), [1]);
      yield* equals(matching(Model.lt(Employee.property("fullName"), "B")), [1, 3]);
    })
  );

  it.effect(
    "equality and membership filters",
    Effect.fnUntraced(function* () {
      yield* equals(matching(Model.eq(Employee.property("active"), false)), [3, 6]);
      // "Not equal" is the complement: it also keeps the employee who has no value.
      yield* equals(matching(Model.ne(Employee.property("active"), false)), [1, 2, 4, 5, 7, 8, 9]);
      yield* equals(matching(Model.oneOf(Employee.property("employeeId"), [2, 4, 99])), [2, 4]);
      // The documented edge: an empty list matches every object.
      yield* equals(matching(Model.oneOf(Employee.property("employeeId"), [])), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      yield* equals(matching(Model.contains(Employee.property("skills"), "math")), [1, 3]);
      yield* equals(matching(Model.contains(Employee.property("skills"), "algorithms")), [4, 6]);
    })
  );

  // A plain filter holds the wire scalar. The transport reads it with the operand codec of the property's type, so
  // the text of a long, a decimal or a date compares in that type's domain, exactly as the typed constructors' do.
  it.effect(
    "an untyped operand is read by the property's operand codec before it is compared",
    Effect.fnUntraced(function* () {
      yield* equals(matching(plain(Filter.gt("badge", "9007199254740992"))), [1]);
      yield* equals(matching(plain(Filter.eq("badge", "9007199254740992"))), [2]);
      // "1000.50" and "1000.5" are one decimal, whichever spelling the operand uses.
      yield* equals(matching(plain(Filter.eq("bonus", "1000.50"))), [1, 2]);
      yield* equals(matching(plain(Filter.oneOf("bonus", ["1000.5", "0"]))), [1, 2, 4]);
      yield* equals(matching(plain(Filter.lt("startDate", "2015-01-01"))), [5, 6, 7]);
      // The same instant written with another offset is the same instant.
      yield* equals(matching(plain(Filter.eq("lastSeen", "2024-05-01T11:00:00+02:00"))), [1]);
      const nineUtc = DateTime.makeUnsafe("2024-05-01T09:00:00Z");
      yield* equals(matching(Model.eq(Employee.property("lastSeen"), nineUtc)), [1]);
      // Text the property's type cannot read is not an operand of it.
      const unreadable = named("InvalidPropertyFilterValue");
      yield* equals(refusalOf(matching(plain(Filter.lt("startDate", "the past")))), unreadable);
      yield* equals(refusalOf(matching(plain(Filter.eq("badge", "many")))), unreadable);
      yield* equals(refusalOf(matching(plain(Filter.eq("badge", 1.5)))), unreadable);
    })
  );

  // The operator table of the filter policy lets an array take the operators of its elements. The transport
  // follows it: the test holds when some element satisfies it, and the operand is one element.
  it.effect(
    "comparison, equality and membership on an array property test its elements",
    Effect.fnUntraced(function* () {
      yield* equals(matching(plain(Filter.eq("skills", "math"))), [1, 3]);
      yield* equals(matching(plain(Filter.contains("skills", "math"))), [1, 3]);
      yield* equals(matching(plain(Filter.oneOf("skills", ["cobol", "git"]))), [2, 8]);
      yield* equals(matching(plain(Filter.lt("skills", "b"))), [4, 5, 6]);
      yield* equals(matching(plain(Filter.gte("skills", "t"))), [6]);
      // "Not equal" is the complement, so it also keeps the employee who has no skills on record.
      yield* equals(matching(plain(Filter.ne("skills", "math"))), [2, 4, 5, 6, 7, 8, 9]);
      // The operand is an element, so it has to be a value of the element type.
      yield* equals(refusalOf(matching(plain(Filter.contains("skills", 7)))), named("InvalidPropertyFilterValue"));
      yield* equals(refusalOf(matching(plain(Filter.eq("skills", true)))), named("InvalidPropertyFilterValue"));
    })
  );

  it.effect(
    "null filters treat an absent property and an explicit null alike",
    Effect.fnUntraced(function* () {
      yield* equals(matching(Model.isNull(Employee.property("salary"))), [9]);
      yield* equals(matching(Model.isNull(Employee.property("desk"))), [8, 9]);
      yield* equals(matching(Model.isNotNull(Employee.property("desk"))), [1, 2, 3, 4, 5, 6, 7]);
    })
  );

  it.effect(
    "logical combinators",
    Effect.fnUntraced(function* () {
      const wellPaid = Model.gt(Employee.property("salary"), 160);
      const isActive = Model.eq(Employee.property("active"), true);
      yield* equals(matching(plain(Filter.every([wellPaid.filter, isActive.filter]))), [1, 2, 5, 7, 8]);
      yield* equals(
        matching(
          plain(Filter.some([Model.lt(Employee.property("salary"), 155).filter, Filter.not(isActive.filter)]))
        ),
        [3, 4, 6, 9]
      );
      yield* equals(matching(plain(Filter.not(Filter.some([wellPaid.filter, isActive.filter])))), [3, 9]);
      yield* equals(matching(plain(Filter.every([]))), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      yield* equals(matching(plain(Filter.some([]))), []);
    })
  );

  it.effect(
    "text search over whitespace-separated, lower-cased terms",
    Effect.fnUntraced(function* () {
      const title = Employee.property("title");
      yield* equals(matching(Model.containsAnyTerm(title, "ARCHITECT scientist")), [3, 4]);
      // "Engineering" is another term than "engineer".
      yield* equals(matching(Model.containsAllTerms(title, "engineer software")), [1, 6]);
      yield* equals(matching(Model.containsAllTermsInOrder(title, "software engineer")), [1, 6]);
      yield* equals(matching(Model.containsAllTermsInOrder(title, "engineer software")), []);
      yield* equals(matching(Model.containsAllTermsInOrderPrefixLastTerm(title, "software eng")), [1, 6, 7]);
      yield* equals(matching(Model.startsWith(title, "dist")), [5]);
      yield* equals(matching(Model.matchesWildcard(Employee.property("fullName"), "a*")), [1, 3]);
      yield* equals(matching(Model.matchesWildcard(Employee.property("fullName"), "?en thompson")), [9]);
      // A wildcard covers the whole text and treats every other character literally.
      yield* equals(matching(Model.matchesWildcard(Employee.property("fullName"), "ada")), []);
      yield* equals(matching(Model.matchesWildcard(Employee.property("fullName"), ".*")), []);
    })
  );

  it.effect(
    "geospatial filters on points",
    Effect.fnUntraced(function* () {
      const desk = Employee.property("desk");
      const fiveKilometres = CircularArea.make({ center: newYork, distance: Distance.kilometers(5) });
      const oneKilometre = CircularArea.make({ center: newYork, distance: Distance.meters(1000) });
      yield* equals(matching(Model.withinDistance(desk, fiveKilometres)), [1, 2, 7]);
      // Ada sits 1.5 km and Margaret 1.4 km from the centre; only Grace is within one.
      yield* equals(matching(Model.withinDistance(desk, oneKilometre)), [2]);
      yield* equals(matching(Model.withinBoundingBox(desk, london)), [3, 4]);
      yield* equals(matching(Model.withinPolygon(desk, bayArea)), [5, 6]);
      // For a point, intersecting a region is lying within it, and employees without a desk never match.
      yield* equals(matching(Model.intersectsBoundingBox(desk, london)), [3, 4]);
      yield* equals(matching(Model.intersectsPolygon(desk, bayArea)), [5, 6]);
      yield* equals(matching(Model.doesNotIntersectBoundingBox(desk, london)), [1, 2, 5, 6, 7]);
      yield* equals(matching(Model.doesNotIntersectPolygon(desk, bayArea)), [1, 2, 3, 4, 7]);
      const envelope = EnvelopeGeometry.make({ topLeft: london.topLeft, bottomRight: london.bottomRight });
      yield* equals(matching(plain(Filter.relatesToGeometry("desk", envelope, "within"))), [3, 4]);
      yield* equals(matching(plain(Filter.relatesToGeometry("desk", envelope, "disjoint"))), [1, 2, 5, 6, 7]);
    })
  );

  it.effect(
    "set algebra works by object identity and answers in the order of the world",
    Effect.fnUntraced(function* () {
      const best = Model.where(employees, Model.gt(Employee.property("salary"), 185));
      const inactive = Model.where(employees, Model.eq(Employee.property("active"), false));
      yield* equals(idsOf(Model.union(best, inactive)), [3, 5, 6]);
      yield* equals(idsOf(Model.union(inactive, best)), [3, 5, 6]);
      yield* equals(idsOf(Model.intersect(best, inactive)), [6]);
      yield* equals(idsOf(Model.subtract(best, inactive)), [5]);
      yield* equals(idsOf(Model.subtract(employees, Model.union(best, inactive))), [1, 2, 4, 7, 8, 9]);
    })
  );

  it.effect(
    "link traversal follows stored links forwards and, through the reverse side, backwards",
    Effect.fnUntraced(function* () {
      const inactive = Model.where(employees, Model.eq(Employee.property("active"), false));
      yield* equals(officeIdsOf(Model.traverse(inactive, "office", Office)), ["LDN", "SFO"]);
      const inNewYork = Model.where(offices, Model.eq(Office.property("city"), "New York"));
      yield* equals(idsOf(Model.traverse(inNewYork, "occupants", Employee)), [1, 2, 7]);
      // There and back again: the colleagues of the inactive employees.
      const theirOffices = Model.traverse(inactive, "office", Office);
      const colleagues = Model.traverse(theirOffices, "occupants", Employee);
      yield* equals(idsOf(colleagues), [3, 4, 5, 6]);
      const nobody = Model.where(employees, plain(Filter.some([])));
      yield* equals(officeIdsOf(Model.traverse(nobody, "office", Office)), []);
    })
  );

  it.effect(
    "the transport answers with wire records, and a set read without a model comes back as the world's objects",
    Effect.fnUntraced(function* () {
      const world = yield* World;
      const stored = A.filter(world.objects, (object) => object.locator.objectType === "Employee");
      // The platform's side writes each object as its flat record: a row is what `OntologyObject` encodes to.
      const transport = yield* OntologyTransport;
      const answer = yield* transport.loadObjects(
        LoadObjectsRequest.make({ objectSet: employees.objectSet, includeRid: true })
      );
      const written = yield* Effect.forEach(stored, (object) => S.encodeEffect(OntologyObject)(object));
      deepStrictEqual<unknown>(answer.data, written);
      // Read through the same function with the codec that needs no ontology, the rows are the stored objects.
      const plain = yield* pipe(
        employees.objectSet,
        untyped,
        fetchPage(FetchOptions.make({ includeRid: true }))
      );
      deepStrictEqual(plain.data, stored);
      // And the typed read of the same set names the same objects, in the same order.
      const typed = yield* fetchPage(employees, defaults);
      deepStrictEqual(
        A.map(typed.data, (employee) => employee.locator),
        A.map(stored, (object) => object.locator)
      );
      // An untyped read spans object types: an interface set holds objects of every type that implements it.
      const located = yield* fetchPage(untyped(ObjectSets.interfaceType("Located")), defaults);
      same(
        A.dedupe(A.map(located.data, (object) => `${object.locator.objectType}`)),
        ["Office", "Employee"]
      );
      strictEqual(located.data.length, 12);
    })
  );

  it.effect(
    "interface sets, narrowing, static sets and selections through the transport",
    Effect.fnUntraced(function* () {
      const transport = yield* OntologyTransport;
      const located = yield* transport.loadObjects(
        LoadObjectsRequest.make({ objectSet: ObjectSets.interfaceType("Located") })
      );
      strictEqual(located.data.length, 12);
      const locatedOffices = yield* transport.loadObjects(
        LoadObjectsRequest.make({ objectSet: ObjectSets.narrowTo(ObjectSets.interfaceType("Located"), "Office") })
      );
      same(
        A.map(locatedOffices.data, (row) => row.__primaryKey),
        ["NYC", "LDN", "SFO"]
      );
      const byRid = yield* fetchPage(
        { model: Employee, objectSet: ObjectSets.objects([adaRid, "ri.phonograph2-objects.main.object.nobody"]) },
        FetchOptions.make({ includeRid: true })
      );
      same(
        A.map(byRid.data, (found) => [found.properties.employeeId, O.getOrNull(found.rid)]),
        [[1, adaRid]]
      );
      const names = yield* transport.loadObjects(
        LoadObjectsRequest.make({
          objectSet: ObjectSets.where(employees.objectSet, Filter.lte("employeeId", 2)),
          selection: [PropertyByName.make({ apiName: PropertyApiName.make("fullName") })],
        })
      );
      // The transport answers with wire records; read with no ontology, each holds the one selected property.
      const named = yield* Effect.forEach(names.data, (row) => S.decodeEffect(OntologyObject)(row));
      same(
        A.map(named, (object) => object.properties),
        [{ fullName: "Ada Lovelace" }, { fullName: "Grace Hopper" }]
      );
    })
  );

  it.effect(
    "ordering compares in the property's domain and puts objects without a value last",
    Effect.fnUntraced(function* () {
      const byPay = Model.orderBy(employees, Employee.property("salary"), "desc");
      yield* equals(idsOf(byPay), [5, 6, 7, 1, 8, 2, 3, 4, 9]);
      const bySeniority = Model.orderBy(employees, Employee.property("startDate"), "asc");
      yield* equals(idsOf(bySeniority), [6, 5, 7, 1, 2, 3, 4, 8, 9]);
      // "1000.50" and "1000.5" tie as decimals, so the second key decides between Ada and Grace.
      const byBonusThenName = Model.thenBy(
        Model.orderBy(employees, Employee.property("bonus"), "asc"),
        Employee.property("fullName"),
        "desc"
      );
      yield* equals(idsOf(byBonusThenName), [4, 3, 8, 6, 2, 1, 7, 5, 9]);
    })
  );

  it.effect(
    "paging: two pages by token, and the same objects as a stream",
    Effect.fnUntraced(function* () {
      const byPay = Model.orderBy(employees, Employee.property("salary"), "desc");
      const fiveAtATime = FetchOptions.make({ pageSize: O.some(5) });
      const first = yield* fetchPage(byPay, fiveAtATime);
      same(
        A.map(first.data, (found) => found.properties.employeeId),
        [5, 6, 7, 1, 8]
      );
      assertSome(first.totalCount, BigInt(9));
      assertSome(first.nextPageToken, PageToken.make("faux-offset-5"));
      const second = yield* fetchPage(byPay, FetchOptions.make({ ...fiveAtATime, pageToken: first.nextPageToken }));
      same(
        A.map(second.data, (found) => found.properties.employeeId),
        [2, 3, 4, 9]
      );
      assertNone(second.nextPageToken);
      const streamed = yield* Stream.runCollect(stream(byPay, fiveAtATime));
      same(
        A.map(streamed, (found) => found.properties.employeeId),
        [5, 6, 7, 1, 8, 2, 3, 4, 9]
      );
    })
  );

  it.effect(
    "aggregation without grouping matches hand-computed numbers",
    Effect.fnUntraced(function* () {
      yield* equals(count(employees.objectSet), 9);
      yield* equals(count(Model.where(employees, plain(Filter.some([]))).objectSet), 0);
      const result = yield* aggregate(
        employees.objectSet,
        [
          countMetric(),
          sum(salary),
          avg(salary),
          min(salary),
          max(salary),
          approximatePercentile(salary, 50),
          min(startDate),
          max(startDate),
          exactDistinct(active),
          approximateDistinct(PropertyApiName.make("bonus")),
        ],
        []
      );
      strictEqual(result.accuracy, "accurate");
      strictEqual(result.groups.length, 1);
      const { metrics } = yield* Effect.fromOption(A.head(result.groups));
      assertSome(metrics.count, 9);
      // Eight salaries: 150 160 170 175 180 185 190 200.
      strictEqual(metricOf(metrics, "salary", "sum"), 1410);
      strictEqual(metricOf(metrics, "salary", "avg"), 176.25);
      strictEqual(metricOf(metrics, "salary", "min"), 150);
      strictEqual(metricOf(metrics, "salary", "max"), 200);
      strictEqual(metricOf(metrics, "salary", "approximatePercentile"), 177.5);
      strictEqual(metricOf(metrics, "startDate", "min"), "2010-09-01");
      strictEqual(metricOf(metrics, "startDate", "max"), "2020-06-01");
      strictEqual(metricOf(metrics, "active", "exactDistinct"), 2);
      // Eight bonuses, of which "1000.50" and "1000.5" are one value.
      strictEqual(metricOf(metrics, "bonus", "approximateDistinct"), 7);
    })
  );

  it.effect(
    "aggregation over nothing still answers one row, with a count and no sum",
    Effect.fnUntraced(function* () {
      const nobody = Model.where(employees, plain(Filter.some([]))).objectSet;
      const result = yield* aggregate(nobody, [countMetric(), sum(salary), exactDistinct(active)], []);
      const { metrics } = yield* Effect.fromOption(A.head(result.groups));
      assertSome(metrics.count, 0);
      strictEqual(metricOf(metrics, "salary", "sum"), null);
      strictEqual(metricOf(metrics, "active", "exactDistinct"), 0);
    })
  );

  it.effect(
    "aggregation with exact, fixed-width and range groupings",
    Effect.fnUntraced(function* () {
      const rowsOf = (result: Effect.Success<ReturnType<typeof aggregate>>) =>
        A.map(result.groups, ({ group, metrics }) =>
          Tuple.make(group, O.getOrNull(metrics.count), metricOf(metrics, "salary", "sum"))
        );
      const byStatus = yield* aggregate(
        employees.objectSet,
        [countMetric(), sum(salary)],
        [exact(active, { includeNullValues: O.some(true) })]
      );
      same(rowsOf(byStatus), [
        [{ active: false }, 2, 350],
        [{ active: true }, 6, 1060],
        [{ active: null }, 1, null],
      ]);
      const byStatusWithoutNulls = yield* aggregate(
        employees.objectSet,
        [countMetric(), sum(salary)],
        [exact(active, {})]
      );
      same(rowsOf(byStatusWithoutNulls), [
        [{ active: false }, 2, 350],
        [{ active: true }, 6, 1060],
      ]);
      const byPayBand = yield* aggregate(employees.objectSet, [countMetric(), sum(salary)], [fixedWidth(salary, 25)]);
      same(rowsOf(byPayBand), [
        [{ salary: 150 }, 3, 480],
        [{ salary: 175 }, 4, 730],
        [{ salary: 200 }, 1, 200],
      ]);
      const eras = [
        AggregationRange.make({ startValue: "2000-01-01", endValue: "2010-01-01" }),
        AggregationRange.make({ startValue: "2010-01-01", endValue: "2015-01-01" }),
        AggregationRange.make({ startValue: "2015-01-01", endValue: "2020-06-01" }),
      ];
      const byEra = yield* aggregate(employees.objectSet, [countMetric(), sum(salary)], [ranges(startDate, eras)]);
      // A range holds its start and not its end: the hire of 2020-06-01 falls outside the last one.
      same(rowsOf(byEra), [
        [{ startDate: { startValue: "2000-01-01", endValue: "2010-01-01" } }, 0, null],
        [{ startDate: { startValue: "2010-01-01", endValue: "2015-01-01" } }, 3, 575],
        [{ startDate: { startValue: "2015-01-01", endValue: "2020-06-01" } }, 4, 660],
      ]);
    })
  );

  it.effect(
    "aggregation nests groupings and lets a metric order the rows",
    Effect.fnUntraced(function* () {
      const nested = yield* aggregate(
        employees.objectSet,
        [countMetric()],
        [exact(active, {}), fixedWidth(salary, 50)]
      );
      same(
        A.map(nested.groups, ({ group, metrics }) => Tuple.make(group, O.getOrNull(metrics.count))),
        [
          [{ active: false, salary: 150 }, 2],
          [{ active: true, salary: 150 }, 5],
          [{ active: true, salary: 200 }, 1],
        ]
      );
      const largestFirst = yield* aggregate(employees.objectSet, [ordered(countMetric(), "desc")], [exact(active, {})]);
      same(
        A.map(largestFirst.groups, ({ group, metrics }) => Tuple.make(group, O.getOrNull(metrics.count))),
        [
          [{ active: true }, 6],
          [{ active: false }, 2],
        ]
      );
    })
  );

  it.effect(
    "features the interpreter does not model are refused with a typed error that names them",
    Effect.fnUntraced(function* () {
      const title = Employee.property("title");
      yield* equals(refusalOf(matching(Model.matchesRegex(title, "eng.*"))), unsupported("filter.regex"));
      yield* equals(
        refusalOf(
          matching(Model.matchesInterval(title, IntervalMatch.make({ query: "software engineer", ordered: true })))
        ),
        unsupported("filter.interval")
      );
      yield* equals(
        refusalOf(
          matching(
            Model.inRelativeDateRange(Employee.property("startDate"), RelativeDateRange.make({ timeZoneId: "UTC" }))
          )
        ),
        unsupported("filter.relativeDateRange")
      );
      const selector = Filter.toSelector("title");
      yield* equals(
        refusalOf(
          matching(plain(ContainsAnyTerm.make({ property: selector, value: "enginer", fuzzy: O.some(true) })))
        ),
        unsupported("filter.containsAnyTerm.fuzzy")
      );
      yield* equals(
        refusalOf(
          matching(
            plain(
              ContainsAllTerms.make({
                property: selector,
                value: "nite",
                analyzerSelection: O.some("phoneticAnalyzer"),
              })
            )
          )
        ),
        unsupported("filter.containsAllTerms.phonetic")
      );
      const envelope = EnvelopeGeometry.make({ topLeft: london.topLeft, bottomRight: london.bottomRight });
      yield* equals(
        refusalOf(matching(plain(Filter.relatesToGeometry("desk", envelope, "contains")))),
        unsupported("filter.geoShapeV2.contains")
      );
      // A refused operator fails the filter even where another branch would decide it.
      yield* equals(
        refusalOf(
          matching(plain(Filter.some([Filter.every([]), Model.matchesRegex(title, "eng.*").filter])))
        ),
        unsupported("filter.regex")
      );
      yield* equals(
        refusalOf(
          fetchPage({ model: Employee, objectSet: ObjectSets.saved("ri.object-set.main.object-set.saved") }, defaults)
        ),
        unsupported("objectSet.reference")
      );
      yield* equals(
        refusalOf(fetchPage({ model: Employee, objectSet: ObjectSets.currentObject }, defaults)),
        unsupported("objectSet.methodInput")
      );
      yield* equals(
        refusalOf(idsOf(employees, FetchOptions.make({ orderBy: O.some(OrderByRelevance.make({})) }))),
        unsupported("orderBy.relevance")
      );
      yield* equals(
        refusalOf(
          aggregate(employees.objectSet, [countMetric()], [duration(PropertyApiName.make("lastSeen"), 1, "days")])
        ),
        unsupported("groupBy.duration")
      );
      const transport = yield* OntologyTransport;
      yield* equals(
        refusalOf(transport.readAttachment(AttachmentRid.make("ri.attachments.main.attachment.missing"))),
        unsupported("transport.readAttachment")
      );
    })
  );

  it.effect(
    "requests the platform would reject fail with the platform's own error names",
    Effect.fnUntraced(function* () {
      yield* equals(refusalOf(matching(plain(Filter.eq("nickname", "Ada")))), named("PropertiesNotFound"));
      yield* equals(refusalOf(matching(plain(Filter.gt("salary", "plenty")))), named("InvalidPropertyFilterValue"));
      yield* equals(refusalOf(matching(plain(Filter.gt("active", true)))), named("PropertyFiltersNotSupported"));
      yield* equals(refusalOf(matching(plain(Filter.contains("salary", 1)))), named("PropertyFiltersNotSupported"));
      yield* equals(
        refusalOf(matching(plain(Filter.containsAnyTerm("salary", "180")))),
        named("PropertyFiltersNotSupported")
      );
      yield* equals(
        refusalOf(fetchPage({ model: Employee, objectSet: ObjectSets.objectType("Ghost") }, defaults)),
        named("ObjectTypeNotFound")
      );
      yield* equals(
        refusalOf(fetchPage({ model: Employee, objectSet: ObjectSets.interfaceType("Haunted") }, defaults)),
        named("InterfaceTypeNotFound")
      );
      yield* equals(
        refusalOf(
          fetchPage({ model: Employee, objectSet: ObjectSets.traverse(employees.objectSet, "manager") }, defaults)
        ),
        named("LinkTypeNotFound")
      );
      yield* equals(
        refusalOf(idsOf(employees, FetchOptions.make({ pageToken: O.some(PageToken.make("page-two")) }))),
        named("InvalidPageToken")
      );
      yield* equals(
        refusalOf(
          idsOf(
            employees,
            FetchOptions.make({
              orderBy: O.some(
                OrderByFields.make({
                  fields: [PropertyOrdering.make({ property: PropertyApiName.make("desk"), direction: O.some("asc") })],
                })
              ),
            })
          )
        ),
        named("PropertyBaseTypeNotSupported")
      );
      yield* equals(
        refusalOf(aggregate(employees.objectSet, [sum(PropertyApiName.make("fullName"))], [])),
        named("PropertyBaseTypeNotSupported")
      );
    })
  );
});

// -----------------------------------------------------------------------------
// Actions and queries change and read the world the layer holds
// -----------------------------------------------------------------------------

it.layer(FauxLive)("actions and queries over the in-memory transport", (it) => {
  it.effect(
    "an action handler that adds an object is visible to the next query",
    Effect.fnUntraced(function* () {
      const transport = yield* OntologyTransport;
      const hire = ActionTypeApiName.make("hireEmployee");
      const tim = Model.where(employees, Model.eq(Employee.property("employeeId"), 10));
      yield* equals(idsOf(tim), []);

      const request = yield* S.decodeEffect(ApplyActionRequest)({
        parameters: { employeeId: 10, fullName: "Tim Berners-Lee", salary: 210, active: true },
        options: { returnEdits: "ALL" },
      });

      const validation = yield* transport.validateAction(hire, request.parameters);
      strictEqual(validation.result, "valid");

      // Validating alone runs no handler.
      const dryRun = yield* S.decodeEffect(ApplyActionRequest)({
        parameters: { employeeId: 10, fullName: "Tim Berners-Lee" },
        options: { mode: "VALIDATE_ONLY" },
      });
      const validated = yield* transport.applyAction(hire, dryRun);
      assertSome(
        O.map(validated.validation, (verdict) => verdict.result),
        "valid"
      );
      assertNone(validated.edits);
      yield* equals(count(employees.objectSet), 9);

      const applied = yield* transport.applyAction(hire, request);
      same(O.getOrNull(O.map(applied.edits, (edits) => (edits.type === "edits" ? edits.addedObjectCount : -1))), 1);

      yield* equals(idsOf(tim), [10]);
      yield* equals(count(employees.objectSet), 10);
      yield* equals(matching(Model.gt(Employee.property("salary"), 195)), [5, 10]);

      const answer = yield* transport.executeQuery(
        QueryApiName.make("headcount"),
        ExecuteQueryRequest.make({}),
        O.none()
      );
      strictEqual(answer.value, 10);
    })
  );

  it.effect(
    "an action or a query nobody registered is refused, and so are the requests the transport does not answer",
    Effect.fnUntraced(function* () {
      const transport = yield* OntologyTransport;
      const request = yield* S.decodeEffect(ApplyActionRequest)({ parameters: {} });
      yield* equals(
        refusalOf(transport.applyAction(ActionTypeApiName.make("fireEveryone"), request)),
        named("FauxUnregisteredHandler")
      );
      yield* equals(
        refusalOf(transport.validateAction(ActionTypeApiName.make("fireEveryone"), request.parameters)),
        named("FauxUnregisteredHandler")
      );
      yield* equals(
        refusalOf(transport.executeQuery(QueryApiName.make("payroll"), ExecuteQueryRequest.make({}), O.none())),
        named("FauxUnregisteredHandler")
      );
    })
  );
});

// -----------------------------------------------------------------------------
// The evaluators as pure functions of a world
// -----------------------------------------------------------------------------

describe("the evaluators", () => {
  it.effect(
    "matchesFilter tests one object against the object type that declares its properties",
    Effect.fnUntraced(function* () {
      const world = yield* World;
      const definition = yield* Effect.fromOption(getObjectType(world.ontology, ObjectTypeApiName.make("Office")));
      const isLarge = matchesFilter(definition.objectType, Filter.gte("capacity", 100));
      const rows = A.filter(world.objects, (object) => object.locator.objectType === "Office");
      yield* equals(Effect.forEach(rows, isLarge), [true, false, true]);
      // The title and primary key selectors resolve through the object type.
      const byTitle = Filter.eq(TitleProperty.make({}), "London");
      yield* equals(Effect.forEach(rows, matchesFilter(definition.objectType, byTitle)), [false, true, false]);
    })
  );

  it.effect(
    "loadObjects answers as the platform does, with wire records, and refuses an object that has no wire form",
    Effect.fnUntraced(function* () {
      const world = yield* World;
      const request = LoadObjectsRequest.make({ objectSet: ObjectSets.objectType("Office") });
      const stored = A.filter(world.objects, (object) => object.locator.objectType === "Office");
      const answer = yield* loadObjects(world, request);
      same(
        A.map(answer.data, (row) => [row.__apiName, row.__primaryKey]),
        A.map(stored, (object) => [object.locator.objectType, object.locator.primaryKey])
      );
      // Each row reads back to the object the world holds; the request did not ask for resource identifiers.
      const read = yield* Effect.forEach(answer.data, (row) => S.decodeEffect(OntologyObject)(row));
      deepStrictEqual(
        read,
        A.map(stored, (object) => OntologyObject.make({ ...object, rid: O.none() }))
      );
      // A handler can put an object in the world whose property is named like a reserved key. The flat record
      // cannot hold both, so the request fails as a fault of the world, not as a defect.
      const unwritable = OntologyObject.make({
        locator: ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "BAD" }),
        properties: { [PropertyApiName.make("officeId")]: "BAD", [PropertyApiName.make("__title")]: "Shadow" },
      });
      yield* equals(refusalOf(loadObjects(addObject(world, unwritable), request)), ["FauxInvalidWorld", null]);
    })
  );

  const Comparison = S.Literals(["lt", "gt", "lte", "gte", "eq"]);

  // A filter over one seeded scalar property, with an operand of that property's kind.
  const Probe = S.Union([
    S.Struct({
      property: S.tag("salary"),
      operator: Comparison,
      value: S.Int.check(S.isBetween({ minimum: 140, maximum: 210 })),
    }),
    S.Struct({
      property: S.tag("employeeId"),
      operator: Comparison,
      value: S.Int.check(S.isBetween({ minimum: 0, maximum: 10 })),
    }),
    S.Struct({ property: S.tag("fullName"), operator: Comparison, value: S.String }),
    S.Struct({
      property: S.tag("startDate"),
      operator: Comparison,
      value: S.Literals(["2010-09-01", "2014-02-14", "2016-01-01", "2020-06-01"]),
    }),
    S.Struct({
      property: S.tag("lastSeen"),
      operator: Comparison,
      value: S.Literals(["2022-03-03T03:03:03Z", "2024-05-01T09:00:00Z", "2024-05-01T11:00:00+02:00"]),
    }),
    S.Struct({ property: S.tag("badge"), operator: Comparison, value: S.Literals(["100", "9007199254740992"]) }),
    S.Struct({ property: S.tag("bonus"), operator: Comparison, value: S.Literals(["0", "1000.5", "1000.50"]) }),
    S.Struct({ property: S.tag("active"), operator: S.tag("eq"), value: S.Boolean }),
  ]);

  const filterOf = ({ property: name, operator, value }: typeof Probe.Type): ObjectFilter =>
    operator === "lt"
      ? Filter.lt(name, value)
      : operator === "gt"
        ? Filter.gt(name, value)
        : operator === "lte"
          ? Filter.lte(name, value)
          : operator === "gte"
            ? Filter.gte(name, value)
            : Filter.eq(name, value);

  const Combinator = S.Literals(["left", "and", "or"]);

  const combine = (combinator: typeof Combinator.Type, left: ObjectFilter, right: ObjectFilter): ObjectFilter =>
    combinator === "and" ? Filter.every([left, right]) : combinator === "or" ? Filter.some([left, right]) : left;

  const sameObject = Equivalence.mapInput(S.toEquivalence(ObjectLocator), (object: OntologyObject) => object.locator);

  const keysOf = (objects: ReadonlyArray<OntologyObject>) => A.map(objects, (object) => object.locator.primaryKey);

  it.effect.prop(
    "for random scalar filters, the objects that satisfy not f are exactly those that do not satisfy f",
    [Arbitrary.schema(Probe), Arbitrary.schema(Probe), Arbitrary.schema(Combinator)],
    Effect.fnUntraced(function* ([left, right, combinator]) {
      const world = yield* World;
      const filter = combine(combinator, filterOf(left), filterOf(right));
      const everyone = yield* evaluateObjectSet(world, employees.objectSet);
      const kept = yield* evaluateObjectSet(world, ObjectSets.where(employees.objectSet, filter));
      const dropped = yield* evaluateObjectSet(world, ObjectSets.where(employees.objectSet, Filter.not(filter)));
      const complement = A.filter(everyone, (object) => !A.containsWith(sameObject)(kept, object));
      same(keysOf(dropped), keysOf(complement));
      strictEqual(kept.length + dropped.length, everyone.length);
    }),
    { arbitrary: fcRuns(100) }
  );
});
