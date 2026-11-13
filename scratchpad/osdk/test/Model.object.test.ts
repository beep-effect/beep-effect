import { LocalDate } from "@beep/schema/LocalDate";
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
} from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as BigDecimal from "effect/BigDecimal";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  DateType,
  DecimalType,
  GeospatialKind,
  LongType,
  PrimaryKeyKind,
  PropertyTypeKind,
  TemporalKind,
  TimestampType,
} from "../src/DataType/index.ts";
import * as Filter from "../src/Filter/Filter.behavior.ts";
import {
  allowedOperators,
  BoundingBoxCorners,
  CircularArea,
  GeoJsonGeometry,
  IntervalMatch,
  ObjectFilter,
  RelativeDateRange,
  RelativePoint,
} from "../src/Filter/index.ts";
import { Distance, GeoPoint, LinearRing, Polygon } from "../src/Geo/index.ts";
import {
  LinkTypeApiName,
  MarkingId,
  ObjectTypeApiName,
  PropertyApiName,
  PropertyTypeRid,
  StructFieldApiName,
} from "../src/Identifier/index.ts";
import * as Model from "../src/Model/index.ts";
import { InstanceOf, instanceCodec, ObjectLocator, OntologyObject } from "../src/Object/index.ts";
import { ObjectSet, OrderBy } from "../src/ObjectSet/index.ts";
import { ObjectTypeDefinition } from "../src/ObjectType/index.ts";
import { operandCodec, PropertyDefinition } from "../src/Property/index.ts";
import type { AttachmentReference } from "../src/Attachment/index.ts";
import type { And, Equals as EqualsFilter, Not, Or, PropertyOperator } from "../src/Filter/index.ts";
import type { ObjectRid } from "../src/Identifier/index.ts";
import type { ObjectRecord } from "../src/Object/index.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyCodec = S.Codec<unknown, unknown>;

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

// Compiles only when the two types are exactly equal: the argument must then be `true`.
const exactly = <Left, Right>(proof: Equals<Left, Right>): boolean => proof;

type Wire = Readonly<Record<string, unknown>>;

const sameMembers = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  A.isReadonlyArrayEmpty(A.difference(left, right)) && A.isReadonlyArrayEmpty(A.difference(right, left));

const encodeFilter = S.encodeEffect(ObjectFilter);
const encodeSet = S.encodeEffect(ObjectSet);
const encodeOrderBy = S.encodeEffect(OrderBy);
const decodeDefinition = S.decodeUnknownEffect(ObjectTypeDefinition);

// Whether an effect fails, as a value a test can assert on.
const fails = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<boolean> =>
  Effect.map(Effect.exit(effect), Exit.isFailure);

// What a codec says when it refuses a value.
const failureOf = <A>(effect: Effect.Effect<A, S.SchemaError>): Effect.Effect<string, A> =>
  Effect.map(Effect.flip(effect), (error) => error.message);

const roundTrips = Effect.fnUntraced(function* (schema: AnyCodec, value: unknown) {
  const encoded = yield* S.encodeUnknownEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  return S.toEquivalence(schema)(decoded, value);
});

const uuid = "401ac022-89eb-4591-8b7e-0a912b9efb44";
const cipherChannel = "ri.bellaso.main.cipher-channel.6d2ae41e-2d55-4b4b-a5dc-b3d22a8b0f2a";

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

const Office = Model.object({
  apiName: "Office",
  primaryKey: "officeId",
  properties: {
    officeId: Model.required(Model.string),
    entrance: Model.geopoint,
    footprint: Model.geoshape,
  },
  links: { occupants: Model.many("Employee") },
});

const Employee = Model.object({
  apiName: "Employee",
  primaryKey: "employeeId",
  properties: {
    employeeId: Model.required(Model.integer),
    fullName: Model.string,
    active: Model.boolean,
    badge: Model.long,
    salary: Model.decimal,
    startDate: Model.date,
    startedAt: Model.timestamp,
    clearance: Model.marking,
    skills: Model.array(Model.string),
    address: Model.struct({ city: Model.string, postcode: Model.string }),
    photo: Model.attachment,
    embedding: Model.vector(3),
  },
  links: { lead: Model.one("Employee"), peeps: Model.many("Employee"), office: Model.one("Office") },
});

// One property per type tag, so the instance codec is exercised across the whole tag vocabulary.
const Everything = Model.object({
  apiName: "Everything",
  primaryKey: "id",
  properties: {
    id: Model.required(Model.string),
    flag: Model.boolean,
    tiny: Model.byte,
    small: Model.short,
    count: Model.integer,
    big: Model.long,
    ratio: Model.float,
    measure: Model.double,
    amount: Model.decimal,
    label: Model.string,
    day: Model.date,
    moment: Model.timestamp,
    clearance: Model.marking,
    secret: Model.cipherText,
    file: Model.attachment,
    picture: Model.mediaReference,
    place: Model.geopoint,
    outline: Model.geoshape,
    track: Model.geotimeSeriesReference,
    pressure: Model.timeseries,
    embedding: Model.vector(3),
    tags: Model.array(Model.string),
    name: Model.struct({ firstName: Model.string, lastName: Model.string }),
  },
  links: { owner: Model.one("Employee"), parts: Model.many("Everything") },
});

// ---------------------------------------------------------------------------
// Wire fixtures
// ---------------------------------------------------------------------------

// A flat object record as the platform sends it, with every value in its canonical spelling
// (09-wire-c-core-geo.md §5.1 for the property values, 08-wire-b.md "OntologyObjectV2" for the reserved keys).
// It is typed as the row every instance codec has on its encoded side, so a record that is not one (no
// `__apiName`, no `__primaryKey`) reaches a codec only through the decoder for unknown input.
const everythingWire: ObjectRecord = {
  __apiName: "Everything",
  __primaryKey: "e-1",
  __rid: "ri.phonograph2-objects.main.object.88a6fccb-f333-46d6-a07e-7725c5f18b61",
  __title: "The first thing",
  id: "e-1",
  flag: true,
  tiny: 31,
  small: 8739,
  count: 238940,
  big: "58319870951433",
  ratio: 1.5,
  measure: 3.14159265,
  amount: "2.718281828",
  label: "Call me Ishmael",
  day: "2021-05-01",
  moment: "2021-01-04T05:00:00.000Z",
  clearance: "8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b",
  secret: `CIPHER::${cipherChannel}::AAAAkdB7::CIPHER`,
  file: { rid: "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f" },
  picture: {
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
  place: { type: "Point", coordinates: [102.0, 0.5] },
  outline: {
    type: "LineString",
    coordinates: [
      [102.0, 0.0],
      [103.0, 1.0],
    ],
  },
  track: {
    geotimeSeriesId: "employee-50030",
    geotimeSeriesIntegrationRid: `ri.geotime-catalog.main.integration.${uuid}`,
  },
  pressure: { seriesId: "wellPressureSeriesId", syncRid: `ri.time-series-catalog.main.sync.${uuid}` },
  embedding: [0.1, 0.3, 0.02],
  tags: ["alpha", "bravo"],
  name: { firstName: "Alex", lastName: "Karp" },
};

const employeeWire: ObjectRecord = {
  __apiName: "Employee",
  __primaryKey: 50030,
  __title: "John Doe",
  employeeId: 50030,
  fullName: "John Doe",
  active: true,
  badge: "9007199254740993",
  salary: "12.5",
  startDate: "2019-01-01",
  startedAt: "2019-01-01T09:00:00.000Z",
  skills: ["sailing", "whaling"],
  address: { city: "Nantucket" },
};

const propertyWire = (name: string, dataType: unknown): unknown => ({
  dataType,
  rid: `ri.ontology.main.property.${name}`,
});

const fieldWire = (apiName: string, dataType: unknown): unknown => ({
  apiName,
  rid: `ri.ontology.main.struct-field.${apiName}`,
  dataType,
});

const linkWire = (apiName: string, target: string, cardinality: string): unknown => ({
  apiName,
  displayName: apiName,
  status: "ACTIVE",
  objectTypeApiName: target,
  cardinality,
  linkTypeRid: `ri.ontology.main.link-type.${apiName}`,
});

const employeeProperties: Wire = {
  employeeId: propertyWire("employee-id", { type: "integer" }),
  fullName: propertyWire("full-name", { type: "string" }),
  active: propertyWire("active", { type: "boolean" }),
  badge: propertyWire("badge", { type: "long" }),
  salary: propertyWire("salary", { type: "decimal" }),
  startDate: propertyWire("start-date", { type: "date" }),
  startedAt: propertyWire("started-at", { type: "timestamp" }),
  clearance: propertyWire("clearance", { type: "marking" }),
  skills: propertyWire("skills", { type: "array", subType: { type: "string" } }),
  address: propertyWire("address", {
    type: "struct",
    structFieldTypes: [
      fieldWire("city", { type: "string" }),
      fieldWire("postcode", { type: "string" }),
      fieldWire("country", { type: "string" }),
    ],
  }),
  photo: propertyWire("photo", { type: "attachment" }),
  embedding: propertyWire("embedding", { type: "vector", dimension: 3, supportsSearchWith: [] }),
  // Served and not in the model: never a finding.
  nickname: propertyWire("nickname", { type: "string" }),
};

const employeeLinks: ReadonlyArray<unknown> = [
  linkWire("lead", "Employee", "ONE"),
  linkWire("peeps", "Employee", "MANY"),
  linkWire("office", "Office", "ONE"),
  linkWire("mentor", "Employee", "ONE"),
];

// The served definition of the Employee object type (08-wire-b.md "ObjectTypeFullMetadata").
const definitionWire = (overrides: {
  readonly apiName?: string;
  readonly primaryKey?: string;
  readonly properties?: Wire;
  readonly linkTypes?: ReadonlyArray<unknown>;
}): unknown => ({
  objectType: {
    apiName: overrides.apiName ?? "Employee",
    displayName: "Employee",
    pluralDisplayName: "Employees",
    status: "ACTIVE",
    icon: { type: "blueprint", color: "blue", name: "person" },
    rid: "ri.ontology.main.object-type.employee",
    primaryKey: overrides.primaryKey ?? "employeeId",
    titleProperty: "fullName",
    properties: overrides.properties ?? employeeProperties,
  },
  linkTypes: overrides.linkTypes ?? employeeLinks,
  implementsInterfaces: [],
  implementsInterfaces2: {},
  sharedPropertyTypeMapping: {},
});

const findingsFor = Effect.fnUntraced(function* (overrides: Parameters<typeof definitionWire>[0]) {
  const definition = yield* decodeDefinition(definitionWire(overrides));
  return Model.conformance(Employee, definition);
});

// ---------------------------------------------------------------------------
// Model.object
// ---------------------------------------------------------------------------

describe("Model.object", () => {
  it.effect(
    "decodes a record with every type tag and encodes it back to the same wire value",
    Effect.fnUntraced(function* () {
      const thing = yield* S.decodeEffect(Everything.Instance)(everythingWire);
      const { properties } = thing;

      // Identity is the ordinary locator, the same value the untyped codec reads from the record.
      deepStrictEqual(
        thing.locator,
        ObjectLocator.make({ objectType: ObjectTypeApiName.make("Everything"), primaryKey: "e-1" })
      );
      const untyped = yield* S.decodeEffect(OntologyObject)(everythingWire);
      deepStrictEqual(thing.locator, untyped.locator);
      deepStrictEqual(thing.undeclared, {});
      assertSome(
        O.map(thing.rid, (rid): string => rid),
        "ri.phonograph2-objects.main.object.88a6fccb-f333-46d6-a07e-7725c5f18b61"
      );
      assertSome(thing.title, "The first thing");
      assertNone(thing.score);

      strictEqual(properties.id, "e-1");
      assertSome(properties.flag, true);
      assertSome(properties.tiny, 31);
      assertSome(properties.small, 8739);
      assertSome(properties.count, 238940);
      assertSome(properties.big, BigInt("58319870951433"));
      assertSome(properties.ratio, 1.5);
      assertSome(properties.measure, 3.14159265);
      assertSome(O.map(properties.amount, BigDecimal.format), "2.718281828");
      assertSome(properties.label, "Call me Ishmael");
      assertSome(
        O.map(properties.day, (day) => [day.year, day.month, day.day]),
        [2021, 5, 1]
      );
      assertSome(O.map(properties.moment, DateTime.toEpochMillis), 1609736400000);
      assertSome(properties.clearance, MarkingId.make("8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b"));
      assertSome(
        O.map(properties.secret, (secret) => secret.ciphertext),
        "AAAAkdB7"
      );
      assertSome(
        O.map(properties.file, (file): string => file.rid),
        "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f"
      );
      assertSome(
        O.map(properties.picture, (picture): string => picture.mimeType),
        "application/pdf"
      );
      assertSome(
        O.map(properties.place, (place) => place.coordinates),
        [102.0, 0.5]
      );
      assertSome(
        O.map(properties.outline, (outline) => outline.type),
        "LineString"
      );
      assertSome(
        O.map(properties.track, (track) => track.type),
        "integratedSeries"
      );
      assertSome(
        O.map(properties.pressure, (pressure) => pressure.type),
        "qualifiedSeries"
      );
      assertSome(properties.embedding, [0.1, 0.3, 0.02]);
      assertSome(properties.tags, ["alpha", "bravo"]);
      assertSome(
        O.map(properties.name, (name) => [name.firstName, name.lastName]),
        [O.some("Alex"), O.some("Karp")]
      );

      const encoded = yield* S.encodeEffect(Everything.Instance)(thing);
      deepStrictEqual(encoded, everythingWire);
    })
  );

  it.effect(
    "reads absent and null optional properties as none, and writes them back as absent keys",
    Effect.fnUntraced(function* () {
      const sparse: ObjectRecord = {
        __apiName: "Everything",
        __primaryKey: "e-2",
        __rid: null,
        id: "e-2",
        label: null,
      };
      const thing = yield* S.decodeEffect(Everything.Instance)(sparse);

      assertNone(thing.rid);
      assertNone(thing.title);
      assertNone(thing.score);
      assertNone(thing.properties.label);
      assertNone(thing.properties.flag);
      assertNone(thing.properties.tags);
      assertNone(thing.properties.name);
      assertNone(thing.properties.embedding);
      strictEqual(thing.properties.id, "e-2");

      const encoded = yield* S.encodeEffect(Everything.Instance)(thing);
      deepStrictEqual(encoded, { __apiName: "Everything", __primaryKey: "e-2", id: "e-2" });
    })
  );

  it.effect(
    "reads a struct value with an absent field as a record whose field is none",
    Effect.fnUntraced(function* () {
      const employee = yield* S.decodeEffect(Employee.Instance)(employeeWire);
      assertSome(
        O.map(employee.properties.address, (address) => [address.city, address.postcode]),
        [O.some("Nantucket"), O.none()]
      );
      assertSome(employee.properties.badge, BigInt("9007199254740993"));
      assertNone(employee.properties.clearance);

      const encoded = yield* S.encodeEffect(Employee.Instance)(employee);
      deepStrictEqual(encoded, employeeWire);
    })
  );

  it.effect(
    "rejects a record of another object type, and a record without an object type",
    Effect.fnUntraced(function* () {
      const decode = S.decodeEffect(Everything.Instance);
      const foreign = yield* failureOf(decode({ ...everythingWire, __apiName: "Employee" }));
      // A record without an object type is not a row at all: only the decoder for unknown input takes it.
      const anonymous = yield* fails(
        S.decodeUnknownEffect(Everything.Instance)(R.remove(everythingWire, "__apiName"))
      );
      const crossed = yield* fails(S.decodeEffect(Employee.Instance)(everythingWire));

      assertInclude(foreign, 'Expected an object of type "Everything"');
      deepStrictEqual([anonymous, crossed], [true, true]);
    })
  );

  it.effect(
    "rejects a record whose primary key property is missing, null or of the wrong type",
    Effect.fnUntraced(function* () {
      const decode = S.decodeEffect(Everything.Instance);
      const missing = yield* failureOf(S.decodeUnknownEffect(Everything.Instance)(R.remove(everythingWire, "id")));
      const nulled = yield* fails(decode({ ...everythingWire, id: null }));
      const mistyped = yield* fails(decode({ ...everythingWire, id: 7 }));
      // `__primaryKey` alone is not enough: the rich key is the key property, and it has to be there.
      const keyOnly = yield* failureOf(decode({ __apiName: "Everything", __primaryKey: "e-1" }));

      assertInclude(missing, '["properties"]["id"]');
      assertInclude(keyOnly, '["properties"]["id"]');
      deepStrictEqual([nulled, mistyped], [true, true]);
    })
  );

  it.effect(
    "rejects a record whose property value does not fit its declared tag",
    Effect.fnUntraced(function* () {
      const decode = S.decodeEffect(Everything.Instance);
      const verdicts = yield* Effect.forEach(
        [
          { ...everythingWire, count: "many" },
          { ...everythingWire, tiny: 300 },
          { ...everythingWire, day: "2021-02-30" },
          { ...everythingWire, embedding: [0.1, 0.3] },
          { ...everythingWire, tags: ["alpha", 7] },
          { ...everythingWire, name: "Alex Karp" },
        ],
        (wire) => fails(decode(wire))
      );
      deepStrictEqual(verdicts, [true, true, true, true, true, true]);
    })
  );

  it.effect(
    "holds __primaryKey to the key property in both directions, comparing in the key's own domain",
    Effect.fnUntraced(function* () {
      // The wire says the key twice. A record whose two keys differ is not an instance, and one without
      // `__primaryKey` is not a row.
      const stale = yield* failureOf(S.decodeEffect(Everything.Instance)({ ...everythingWire, __primaryKey: "stale" }));
      assertInclude(stale, 'Expected the primary key to equal the value of the "id" property');
      const absent = yield* fails(S.decodeUnknownEffect(Employee.Instance)(R.remove(employeeWire, "__primaryKey")));
      assertTrue(absent);

      // The comparison reads the locator's key with the key property's codec, so the legacy numeric text of an
      // integer key is the same key. The locator keeps the scalar as it came, and encoding writes it back.
      const legacyWire = { ...employeeWire, __primaryKey: "50030" };
      const legacy = yield* S.decodeEffect(Employee.Instance)(legacyWire);
      strictEqual(legacy.locator.primaryKey, "50030");
      strictEqual(legacy.properties.employeeId, 50030);
      const encodedLegacy = yield* S.encodeEffect(Employee.Instance)(legacy);
      deepStrictEqual(encodedLegacy, legacyWire);

      // Encoding holds the same two rules: an instance located by another key, or under another object type,
      // is not written.
      const employee = yield* S.decodeEffect(Employee.Instance)(employeeWire);
      const encode = S.encodeEffect(Employee.Instance);
      const moved = yield* failureOf(
        encode({
          ...employee,
          locator: ObjectLocator.make({ objectType: ObjectTypeApiName.make("Employee"), primaryKey: 50031 }),
        })
      );
      assertInclude(moved, 'Expected the primary key to equal the value of the "employeeId" property');
      const retyped = yield* failureOf(
        encode({
          ...employee,
          locator: ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: 50030 }),
        })
      );
      assertInclude(retyped, 'Expected an object of type "Employee"');
      const encoded = yield* encode(employee);
      assertSome(R.get(encoded, "__primaryKey"), 50030);
      deepStrictEqual(encoded, employeeWire);
    })
  );

  it.effect(
    "keeps the keys the model does not declare as JSON, and writes them back",
    Effect.fnUntraced(function* () {
      const wire = { ...employeeWire, nickname: "Johnny", __extra: 1, derived: { rank: [1, 2] } };
      const employee = yield* S.decodeEffect(Employee.Instance)(wire);
      deepStrictEqual<unknown>(employee.undeclared, { nickname: "Johnny", __extra: 1, derived: { rank: [1, 2] } });
      // They stay out of the typed properties, whose keys are exactly the declared ones.
      deepStrictEqual(R.keys(employee.properties), R.keys(Employee.properties));
      const encoded = yield* S.encodeEffect(Employee.Instance)(employee);
      deepStrictEqual(encoded, wire);
      const survived = yield* roundTrips(Employee.Instance, employee);
      assertTrue(survived);

      // An undeclared key may not shadow a declared property on the way out.
      const shadow = yield* S.decodeEffect(S.Record(PropertyApiName, S.Json))({ fullName: "Shadow" });
      const shadowed = yield* failureOf(S.encodeEffect(Employee.Instance)({ ...employee, undeclared: shadow }));
      assertInclude(shadowed, "Undeclared keys collide with declared properties: fullName");
    })
  );

  it.effect(
    "generates instances that satisfy the codec and survive encoding and decoding",
    Effect.fnUntraced(function* () {
      const things = yield* Arbitrary.sampleEffect(Arbitrary.schema(Everything.Instance), { count: 25, seed: 7 });
      const employees = yield* Arbitrary.sampleEffect(Arbitrary.schema(Employee.Instance), { count: 25, seed: 11 });
      const thingsSurvive = yield* Effect.forEach(things, (thing) => roundTrips(Everything.Instance, thing));
      const employeesSurvive = yield* Effect.forEach(employees, (employee) => roundTrips(Employee.Instance, employee));
      const wires = yield* Effect.forEach(employees, (employee) => S.encodeEffect(Employee.Instance)(employee));

      assertTrue(A.every(things, S.is(Everything.Instance)));
      assertTrue(A.every(employees, S.is(Employee.Instance)));
      assertTrue(A.every(thingsSurvive, (survived) => survived));
      assertTrue(A.every(employeesSurvive, (survived) => survived));
      // Every generated instance encodes with its key written twice: as the property and as `__primaryKey`.
      assertTrue(
        A.every(
          A.zip(employees, wires),
          ([employee, wire]) =>
            O.contains(R.get(wire, "__primaryKey"), employee.properties.employeeId) &&
            O.contains(R.get(wire, "employeeId"), employee.properties.employeeId) &&
            O.contains(R.get(wire, "__apiName"), "Employee")
        )
      );
    })
  );

  it("types an instance exactly: a locator, the key plain, every other property an Option, the rest as JSON", () => {
    type EmployeeInstance = {
      readonly locator: ObjectLocator;
      readonly rid: O.Option<ObjectRid>;
      readonly title: O.Option<string>;
      readonly score: O.Option<number>;
      readonly properties: {
        readonly employeeId: number;
        readonly fullName: O.Option<string>;
        readonly active: O.Option<boolean>;
        readonly badge: O.Option<bigint>;
        readonly salary: O.Option<BigDecimal.BigDecimal>;
        readonly startDate: O.Option<LocalDate>;
        readonly startedAt: O.Option<DateTime.Utc>;
        readonly clearance: O.Option<MarkingId>;
        readonly skills: O.Option<ReadonlyArray<string>>;
        readonly address: O.Option<{ readonly city: O.Option<string>; readonly postcode: O.Option<string> }>;
        readonly photo: O.Option<AttachmentReference>;
        readonly embedding: O.Option<ReadonlyArray<number>>;
      };
      readonly undeclared: { readonly [name: PropertyApiName]: S.Json };
    };

    assertTrue(exactly<typeof Employee.Instance.Type, EmployeeInstance>(true));
    assertTrue(exactly<typeof Employee.Properties.Type, EmployeeInstance["properties"]>(true));
    // The encoded side is the named wire row, the same for every instance codec and for the untyped one.
    assertTrue(exactly<typeof Employee.Instance.Encoded, ObjectRecord>(true));
    assertTrue(exactly<typeof Employee.Instance.Encoded, typeof OntologyObject.Encoded>(true));
    // The shape is the one the dynamic projection has: only `properties` is typed more finely here.
    type Dynamic = ReturnType<typeof instanceCodec>["Type"];
    assertTrue(exactly<Omit<EmployeeInstance, "properties">, Omit<Dynamic, "properties">>(true));
    // A record that lacks one of its two identity keys is not a row, so the typed decoder does not take it.
    const notARow = () =>
      // @ts-expect-error a record without `__primaryKey` is not an `ObjectRecord`
      S.decodeEffect(Employee.Instance)({ __apiName: "Employee", employeeId: 50030 });
    strictEqual(typeof notARow, "function");
    assertTrue(exactly<typeof Employee.apiName, "Employee">(true));
    assertTrue(exactly<typeof Employee.primaryKey, "employeeId">(true));
    assertTrue(exactly<typeof Employee.links.office, Model.LinkSpec<"one", "Office">>(true));
    assertTrue(exactly<typeof Employee.links.peeps, Model.LinkSpec<"many", "Employee">>(true));
  });

  it("hands out references that carry the property's name, tag, value codec and issuing model", () => {
    const fullName = Employee.property("fullName");
    const skills = Employee.property("skills");
    const entrance = Office.property("entrance");

    deepStrictEqual([fullName.owner, fullName.name, fullName.kind], ["Employee", "fullName", "string"]);
    deepStrictEqual([skills.owner, skills.name, skills.kind], ["Employee", "skills", "array"]);
    deepStrictEqual([entrance.owner, entrance.name, entrance.kind], ["Office", "entrance", "geopoint"]);
    strictEqual(fullName.value, Employee.properties.fullName.value);
    // The owner is the object type's API name, so a narrowed model issues references of the model it narrows.
    strictEqual(Model.pick(Employee, ["fullName"]).property("fullName").owner, "Employee");
    assertTrue(
      exactly<typeof fullName, Model.PropertyReference<"fullName", "string", typeof Model.string.value, "Employee">>(
        true
      )
    );
    assertTrue(exactly<(typeof entrance)["owner"], "Office">(true));
    assertTrue(exactly<(typeof skills)["owner"], "Employee">(true));
    assertTrue(exactly<(typeof skills)["kind"], "array">(true));
    assertTrue(exactly<(typeof skills)["value"]["Type"], ReadonlyArray<string>>(true));
  });

  it("keeps the specs as written: the key required, every other property optional", () => {
    assertTrue(exactly<typeof Employee.properties.employeeId.presence, "required">(true));
    assertTrue(exactly<typeof Employee.properties.fullName.presence, "optional">(true));
    assertTrue(exactly<typeof Employee.properties.fullName, typeof Model.string>(true));
    strictEqual(Employee.properties.fullName, Model.string);
    deepStrictEqual(
      R.keys(R.filter(Employee.properties, (spec) => spec.presence === "required")),
      [Employee.primaryKey]
    );
    deepStrictEqual(
      R.keys(R.filter(Everything.properties, (spec) => spec.presence === "required")),
      [Everything.primaryKey]
    );
  });
});

// ---------------------------------------------------------------------------
// Static guarantees. This function is never run: it only has to compile, and every line marked
// `@ts-expect-error` has to fail to. A marker over a line that compiles is itself an error.
// ---------------------------------------------------------------------------

const staticGuarantees = () => {
  const everyone = Model.all(Employee);
  const employeeId = Employee.property("employeeId");
  const fullName = Employee.property("fullName");
  const active = Employee.property("active");
  const skills = Employee.property("skills");
  const address = Employee.property("address");
  const photo = Employee.property("photo");
  const entrance = Office.property("entrance");
  const triangle = Polygon.make({
    coordinates: [
      LinearRing.fromVertices([
        [0, 0],
        [4, 0],
        [0, 3],
      ]),
    ],
  });

  // An operator accepts the tags of its family, in both call shapes.
  const accepted = [
    Model.startsWith(fullName, "Jo"),
    pipe(fullName, Model.startsWith("Jo")),
    Model.gt(employeeId, 5),
    pipe(employeeId, Model.gt(5)),
    Model.gt(fullName, "M"),
    Model.eq(active, true),
    pipe(active, Model.eq(true)),
    Model.oneOf(employeeId, [1, 2]),
    pipe(employeeId, Model.oneOf([1, 2])),
    Model.contains(skills, "sailing"),
    pipe(skills, Model.contains("sailing")),
    Model.withinPolygon(entrance, triangle),
    Model.isNull(address),
    Model.isNull(photo),
  ];

  // startsWith on an integer property
  // @ts-expect-error "integer" is not a text tag
  Model.startsWith(employeeId, "5");
  // @ts-expect-error "integer" is not a text tag
  pipe(employeeId, Model.startsWith("5"));

  // gt on a boolean
  // @ts-expect-error "boolean" is not an ordered tag
  Model.gt(active, true);
  // @ts-expect-error "boolean" is not an ordered tag
  pipe(active, Model.gt(true));

  // an operand of the wrong type
  // @ts-expect-error an integer property compares with a number
  Model.gt(employeeId, "5");
  // @ts-expect-error an integer property compares with a number
  pipe(employeeId, Model.gt("5"));
  // @ts-expect-error a string property compares with text
  Model.eq(fullName, 5);
  // @ts-expect-error a long property compares with a bigint
  Model.eq(Employee.property("badge"), 7);
  // @ts-expect-error a date property compares with a calendar date
  Model.lt(Employee.property("startDate"), "2021-05-01");
  // @ts-expect-error every listed value has the property's type
  Model.oneOf(employeeId, [1, "2"]);
  // @ts-expect-error every listed value has the property's type
  pipe(employeeId, Model.oneOf(["1"]));
  // @ts-expect-error an array of strings contains text
  Model.contains(skills, 5);
  // @ts-expect-error an array of strings contains text
  pipe(skills, Model.contains(5));
  // @ts-expect-error without a reference in sight, a data-last operand has nothing to be checked against
  Model.gt(5);

  // operators of another family
  // @ts-expect-error a string is not an array
  Model.contains(fullName, "J");
  // @ts-expect-error a struct is not equatable
  Model.eq(address, "x");
  // @ts-expect-error an attachment has no scalar to compare with
  Model.eq(photo, "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f");
  // @ts-expect-error a string is not geospatial
  Model.withinPolygon(fullName, triangle);
  // @ts-expect-error a geopoint is not temporal
  Model.inRelativeDateRange(entrance, RelativeDateRange.make({ timeZoneId: "UTC" }));

  // a property name the model does not have
  // @ts-expect-error "nickname" is not a property of Employee
  Employee.property("nickname");
  // @ts-expect-error "fullName" is not a property of Office
  Office.property("fullName");

  // a link that does not exist
  // @ts-expect-error "manager" is not a link of Employee
  Model.traverse(everyone, "manager", Employee);
  // @ts-expect-error "manager" is not a link of Employee
  pipe(everyone, Model.traverse("manager", Employee));

  // a traverse target of the wrong model
  // @ts-expect-error "lead" leads to Employee
  Model.traverse(everyone, "lead", Office);
  // @ts-expect-error "lead" leads to Employee
  pipe(everyone, Model.traverse("lead", Office));
  // @ts-expect-error without a set in sight, a data-last traversal has no model to check the link against
  Model.traverse("lead", Employee);

  // sets of different models do not combine
  // @ts-expect-error an Office set is not an Employee set
  Model.union(everyone, Model.all(Office));
  // @ts-expect-error an Office set is not an Employee set
  pipe(everyone, Model.intersect(Model.all(Office)));

  // a filter knows its model: one built from another model's properties does not filter this set
  const officeId = Office.property("officeId");
  const named = Model.eq(fullName, "John Doe");
  const inLyon = Model.eq(officeId, "LYS");
  // @ts-expect-error a filter over Office properties does not filter Employee objects
  Model.where(everyone, inLyon);
  // @ts-expect-error a filter over Office properties does not filter Employee objects
  pipe(everyone, Model.where(inLyon));
  // @ts-expect-error a filter over Office properties does not filter Employee objects, however it was built
  Model.where(everyone, Model.withinPolygon(entrance, triangle));
  // @ts-expect-error negating a filter does not change the model it is about
  Model.where(everyone, Model.not(inLyon));
  // @ts-expect-error a plain filter has no owner: it enters the typed layer as a pair, by hand
  Model.where(everyone, Filter.eq("fullName", "John Doe"));
  // A data-last filter stands on its own, and still checks the set it is later applied to.
  const keepNamed = Model.where(named);
  keepNamed(everyone);
  // @ts-expect-error a filter over Employee properties does not filter Office objects
  keepNamed(Model.all(Office));

  // filters of different models do not combine
  // @ts-expect-error an Office filter is not an Employee filter
  Model.and(named, inLyon);
  // @ts-expect-error an Office filter is not an Employee filter
  pipe(named, Model.and(inLyon));
  // @ts-expect-error an Office filter is not an Employee filter
  Model.or(named, inLyon);
  // @ts-expect-error an Office filter is not an Employee filter
  pipe(named, Model.or(inLyon));
  // @ts-expect-error a plain filter is not a typed one
  Model.and(named, Filter.isNull("fullName"));
  // @ts-expect-error a plain filter is not a typed one
  Model.not(Filter.isNull("fullName"));

  // an ordering takes a property of the set's own model whose values have an order
  const byName = Model.orderBy(everyone, fullName, "asc");
  // @ts-expect-error a geopoint has no order
  Model.orderBy(Model.all(Office), entrance, "asc");
  // @ts-expect-error a geopoint has no order
  pipe(Model.all(Office), Model.orderBy(entrance, "asc"));
  // @ts-expect-error a boolean has no order
  Model.orderBy(everyone, active, "asc");
  // @ts-expect-error an array has no order
  Model.orderBy(everyone, skills, "asc");
  // @ts-expect-error a struct has no order
  pipe(everyone, Model.orderBy(address, "desc"));
  // @ts-expect-error an Office property does not order Employee objects
  Model.orderBy(everyone, officeId, "asc");
  // @ts-expect-error an Office property does not order Employee objects
  pipe(everyone, Model.orderBy(officeId, "asc"));
  // @ts-expect-error an Office property does not break ties between Employee objects
  Model.thenBy(byName, officeId, "desc");
  // @ts-expect-error an Office property does not break ties between Employee objects
  pipe(byName, Model.thenBy(officeId, "desc"));
  // @ts-expect-error a boolean has no order
  Model.thenBy(byName, active, "desc");
  // @ts-expect-error a tie-breaker needs a first key: this set is not ordered
  Model.thenBy(everyone, employeeId, "desc");
  const filteredAfterwards = Model.where(byName, named);
  // @ts-expect-error a tie-breaker needs a first key: filtering returned a set without an ordering
  Model.thenBy(filteredAfterwards, employeeId, "desc");
  // A data-last ordering stands on its own, and still checks the set it is later applied to.
  const sortByName = Model.orderBy(fullName, "asc");
  sortByName(everyone);
  // @ts-expect-error an Employee property does not order Office objects
  sortByName(Model.all(Office));

  // presence is what the platform guarantees: the primary key, and nothing else
  Model.object({
    apiName: "Strict",
    primaryKey: "id",
    properties: {
      id: Model.required(Model.string),
      // @ts-expect-error only the primary key may be required
      name: Model.required(Model.string),
    },
    links: {},
  });
  Model.object({
    apiName: "Strict",
    primaryKey: "id",
    properties: {
      id: Model.required(Model.string),
      // @ts-expect-error only the primary key may be required, whatever the property holds
      scores: Model.required(Model.array(Model.double)),
    },
    links: {},
  });
  Model.object({
    apiName: "Loose",
    primaryKey: "id",
    properties: {
      // @ts-expect-error the primary key is always present, so its spec must say so
      id: Model.string,
      name: Model.string,
    },
    links: {},
  });
  Model.object({
    apiName: "Odd",
    primaryKey: "id",
    properties: {
      // @ts-expect-error a geopoint cannot be a primary key
      id: Model.required(Model.geopoint),
    },
    links: {},
  });
  // @ts-expect-error a struct field can be absent, so it cannot be required
  Model.struct({ city: Model.required(Model.string) });
  // @ts-expect-error a struct field can be absent at any depth
  Model.struct({ address: Model.struct({ city: Model.required(Model.string) }) });
  Model.object({
    apiName: "Nested",
    primaryKey: "id",
    properties: {
      id: Model.required(Model.string),
      // @ts-expect-error a struct field can be absent, also inside an array
      lines: Model.array(Model.struct({ text: Model.required(Model.string) })),
    },
    links: {},
  });

  // a picked model has only the picked properties
  // @ts-expect-error "nickname" is not a property of Employee
  Model.pick(Employee, ["nickname"]);
  // @ts-expect-error "nickname" is not a property of Employee
  pipe(Employee, Model.pick(["nickname"]));
  // @ts-expect-error "active" was not picked
  Model.pick(Employee, ["fullName"]).property("active");

  return accepted;
};

// ---------------------------------------------------------------------------
// One instance codec for both tiers
// ---------------------------------------------------------------------------

// What the laws below need of a model: its names, its specs and the codec of one instance.
interface DeclaredModel<A> {
  readonly apiName: string;
  readonly primaryKey: string;
  readonly properties: Readonly<Record<string, Model.AnyPropertySpec>>;
  readonly Instance: S.Codec<A, ObjectRecord>;
}

// The signature a decoded object type would hand `instanceCodec` for a model: its name, its key and, for each
// property, the type its spec denotes. It is the model read back as data, so the dynamic codec projected from
// it and the model's own codec are two callers of `InstanceOf` whose property codecs agree.
const signatureOf = <A>(model: DeclaredModel<A>) => ({
  apiName: ObjectTypeApiName.make(model.apiName),
  primaryKey: PropertyApiName.make(model.primaryKey),
  properties: R.mapEntries(model.properties, (spec, name) => [
    PropertyApiName.make(name),
    PropertyDefinition.make({
      dataType: Model.typeOf(spec),
      rid: PropertyTypeRid.make(`ri.ontology.main.property.${name}`),
    }),
  ]),
});

// One wire row through both tiers: the typed instance and the dynamic instance are the same value, each codec
// accepts the other's instance, and each writes it to the same record.
const sameInBothTiers = Effect.fnUntraced(function* <A>(model: DeclaredModel<A>, wire: ObjectRecord) {
  const Dynamic = instanceCodec(signatureOf(model));
  const typed = yield* S.decodeEffect(model.Instance)(wire);
  const dynamic = yield* S.decodeEffect(Dynamic)(wire);
  deepStrictEqual<unknown>(typed, dynamic);
  const byModel = yield* S.encodeEffect(model.Instance)(typed);
  const byProjection = yield* S.encodeEffect(Dynamic)(dynamic);
  const crossed = yield* S.encodeUnknownEffect(Dynamic)(typed);
  deepStrictEqual<unknown>(byModel, byProjection);
  deepStrictEqual<unknown>(crossed, byModel);
  return (
    S.is(Dynamic)(typed) &&
    S.is(model.Instance)(dynamic) &&
    S.toEquivalence(model.Instance)(dynamic, typed) &&
    S.toEquivalence(Dynamic)(dynamic, typed)
  );
});

// The laws of a model's instance codec over instances it generates itself. Each generated instance satisfies
// the guard, encodes to a row that says its key twice and its object type once, and decodes back to an
// equivalent instance (the strict law). The projection of the type the model denotes reads the same row to
// the same value and writes it back unchanged.
const lawfulInstances = Effect.fnUntraced(function* <A>(model: DeclaredModel<A>, seed: number) {
  const Dynamic = instanceCodec(signatureOf(model));
  const isInstance = S.is(model.Instance);
  const sameInstance = S.toEquivalence(model.Instance);
  const instances = yield* Arbitrary.sampleEffect(Arbitrary.schema(model.Instance), { count: 25, seed });
  const verdicts = yield* Effect.forEach(
    instances,
    Effect.fnUntraced(function* (instance) {
      const wire = yield* S.encodeEffect(model.Instance)(instance);
      const decoded = yield* S.decodeEffect(model.Instance)(wire);
      const projected = yield* S.decodeEffect(Dynamic)(wire);
      const rewritten = yield* S.encodeEffect(Dynamic)(projected);
      deepStrictEqual<unknown>(rewritten, wire);
      return (
        isInstance(instance) &&
        sameInstance(decoded, instance) &&
        isInstance(projected) &&
        sameInstance(projected, instance) &&
        wire.__apiName === model.apiName &&
        O.isSome(R.get(wire, model.primaryKey))
      );
    })
  );
  return A.length(instances) === 25 && A.every(verdicts, (verdict) => verdict);
});

// A model whose primary key has the given spec, beside a plain property and an array.
const keyedBy = <Kind extends PrimaryKeyKind, Value extends AnyCodec, Field extends AnyCodec>(
  spec: Model.PropertySpec<Kind, Value, Field, "optional">
) =>
  Model.object({
    apiName: "Keyed",
    primaryKey: "key",
    properties: { key: Model.required(spec), note: Model.string, tags: Model.array(Model.string) },
    links: {},
  });

describe("one instance codec for both tiers", () => {
  it("gives the typed and the dynamic tier the same function: InstanceOf, at two codecs of the properties", () => {
    // A model's `Instance` is `InstanceOf` at its `Properties` struct, so building it again by hand is the same
    // codec, type for type.
    const ByHand = InstanceOf({ apiName: "Employee", primaryKey: "employeeId", properties: Employee.Properties });
    assertTrue(exactly<typeof ByHand.Type, typeof Employee.Instance.Type>(true));
    assertTrue(exactly<typeof ByHand.Encoded, typeof Employee.Instance.Encoded>(true));
  });

  it.effect(
    "reads one wire row to equal values with a model and with the projection of the type the model denotes",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        sameInBothTiers(Employee, employeeWire),
        sameInBothTiers(Everything, everythingWire),
        sameInBothTiers(Employee, { ...employeeWire, nickname: "Johnny", derived: { rank: [1, 2] } }),
        sameInBothTiers(Employee, { ...employeeWire, __primaryKey: "50030", __rid: null, __score: 0.5 }),
        sameInBothTiers(Model.pick(Employee, ["fullName"]), employeeWire),
        sameInBothTiers(Office, { __apiName: "Office", __primaryKey: "nyc", officeId: "nyc" }),
      ]);
      deepStrictEqual(verdicts, [true, true, true, true, true, true]);
    })
  );

  it.effect(
    "refuses in both tiers what either refuses: another object type, a stale key, a value of the wrong type",
    Effect.fnUntraced(function* () {
      const Dynamic = instanceCodec(signatureOf(Employee));
      const refused = yield* Effect.forEach(
        [
          { ...employeeWire, __apiName: "Office" },
          { ...employeeWire, __primaryKey: 50031 },
          { ...employeeWire, startDate: "the first of January" },
          { ...employeeWire, address: { city: 7 } },
        ],
        Effect.fnUntraced(function* (wire) {
          const byModel = yield* failureOf(S.decodeEffect(Employee.Instance)(wire));
          const byProjection = yield* failureOf(S.decodeEffect(Dynamic)(wire));
          return byModel === byProjection;
        })
      );
      // One implementation, so the two tiers refuse with the very same words.
      deepStrictEqual(refused, [true, true, true, true]);
    })
  );

  it.effect(
    "holds the strict round-trip law for generated instances of every model, in both tiers",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        lawfulInstances(Office, 3),
        lawfulInstances(Employee, 5),
        lawfulInstances(Everything, 7),
        lawfulInstances(Model.pick(Employee, ["fullName", "skills"]), 11),
      ]);
      deepStrictEqual(verdicts, [true, true, true, true]);
    })
  );

  it.effect(
    "holds the same law for a model keyed by each kind a primary key may have",
    Effect.fnUntraced(function* () {
      const keyed = {
        string: keyedBy(Model.string),
        integer: keyedBy(Model.integer),
        long: keyedBy(Model.long),
        short: keyedBy(Model.short),
        byte: keyedBy(Model.byte),
        double: keyedBy(Model.double),
        boolean: keyedBy(Model.boolean),
        date: keyedBy(Model.date),
        timestamp: keyedBy(Model.timestamp),
      };
      // One model per kind of key, and no kind left out.
      assertTrue(sameMembers(R.keys(keyed), PrimaryKeyKind.literals));
      const verdicts = yield* Effect.all({
        string: lawfulInstances(keyed.string, 1),
        integer: lawfulInstances(keyed.integer, 2),
        long: lawfulInstances(keyed.long, 3),
        short: lawfulInstances(keyed.short, 4),
        byte: lawfulInstances(keyed.byte, 5),
        double: lawfulInstances(keyed.double, 6),
        boolean: lawfulInstances(keyed.boolean, 7),
        date: lawfulInstances(keyed.date, 8),
        timestamp: lawfulInstances(keyed.timestamp, 9),
      });
      deepStrictEqual(verdicts, {
        string: true,
        integer: true,
        long: true,
        short: true,
        byte: true,
        double: true,
        boolean: true,
        date: true,
        timestamp: true,
      });
    })
  );

  it.effect.prop(
    "a generated employee is located by its own key property, read in the key's domain",
    [Arbitrary.schema(Employee.Instance)],
    Effect.fnUntraced(function* ([employee]) {
      const wire = yield* S.encodeEffect(Employee.Instance)(employee);
      const again = yield* S.decodeEffect(Employee.Instance)(wire);
      strictEqual(employee.locator.objectType, "Employee");
      strictEqual(wire.__primaryKey, employee.properties.employeeId);
      deepStrictEqual(
        employee.locator,
        ObjectLocator.make({ objectType: employee.locator.objectType, primaryKey: wire.__primaryKey })
      );
      assertTrue(S.toEquivalence(Employee.Instance)(again, employee));
      // The same row read with no ontology has the same locator and every property as JSON.
      const untyped = yield* S.decodeEffect(OntologyObject)(wire);
      deepStrictEqual(untyped.locator, employee.locator);
    }),
    { arbitrary: fcRuns(50) }
  );
});

describe("static guarantees", () => {
  it("types a traversal by the target model, in both call shapes", () => {
    const everyone = Model.all(Employee);
    const offices = Model.traverse(everyone, "office", Office);
    const piped = pipe(everyone, Model.traverse("office", Office));
    const colleagues = pipe(offices, Model.traverse("occupants", Employee), Model.traverse("lead", Employee));

    assertTrue(exactly<typeof everyone, Model.TypedObjectSet<typeof Employee>>(true));
    assertTrue(exactly<typeof offices, Model.TypedObjectSet<typeof Office>>(true));
    assertTrue(exactly<typeof piped, Model.TypedObjectSet<typeof Office>>(true));
    assertTrue(exactly<typeof colleagues, Model.TypedObjectSet<typeof Employee>>(true));
    strictEqual(colleagues.model, Employee);
  });

  it("types a filter by its owner and its operator, in both call shapes", () => {
    const fullName = Employee.property("fullName");
    const filter = Model.eq(fullName, "John Doe");
    const piped = pipe(fullName, Model.eq("John Doe"));
    const prefixed = pipe(fullName, Model.startsWith("Jo"));
    const unnamed = Model.isNull(fullName);
    const located = Model.withinDistance(Office.property("entrance"), sampleArea);

    assertTrue(exactly<typeof filter, Model.TypedFilter<"Employee", EqualsFilter>>(true));
    assertTrue(exactly<typeof piped, Model.TypedFilter<"Employee", EqualsFilter>>(true));
    assertTrue(exactly<(typeof prefixed)["owner"], "Employee">(true));
    assertTrue(exactly<(typeof prefixed)["filter"]["type"], "startsWith">(true));
    assertTrue(exactly<(typeof unnamed)["owner"], "Employee">(true));
    assertTrue(exactly<(typeof located)["owner"], "Office">(true));
    assertTrue(exactly<(typeof filter)["filter"]["type"], "eq">(true));
    deepStrictEqual(
      [filter.owner, piped.owner, prefixed.owner, unnamed.owner, located.owner],
      ["Employee", "Employee", "Employee", "Employee", "Office"]
    );
    assertTrue(S.is(ObjectFilter)(filter.filter));
  });

  it("types a combination by the one owner of its parts", () => {
    const named = Model.eq(Employee.property("fullName"), "John Doe");
    const active = Model.eq(Employee.property("active"), true);
    const both = Model.and(named, active);
    const bothPiped = pipe(named, Model.and(active));
    const either = Model.or(named, active);
    const eitherPiped = pipe(named, Model.or(active));
    const neither = Model.not(either);

    assertTrue(exactly<typeof both, Model.TypedFilter<"Employee", And>>(true));
    assertTrue(exactly<typeof bothPiped, Model.TypedFilter<"Employee", And>>(true));
    assertTrue(exactly<typeof either, Model.TypedFilter<"Employee", Or>>(true));
    assertTrue(exactly<typeof eitherPiped, Model.TypedFilter<"Employee", Or>>(true));
    assertTrue(exactly<typeof neither, Model.TypedFilter<"Employee", Not>>(true));
    // A combination is a filter of the same model, so it goes where its parts go.
    const filtered = Model.where(Model.all(Employee), Model.and(neither, both));
    assertTrue(exactly<typeof filtered, Model.TypedObjectSet<typeof Employee>>(true));
    strictEqual(filtered.model, Employee);
  });

  it("types a filtered set and an ordered set by the model of the set", () => {
    const everyone = Model.all(Employee);
    const named = Model.eq(Employee.property("fullName"), "John Doe");
    const filtered = Model.where(everyone, named);
    const filteredPiped = pipe(everyone, Model.where(named));
    const ordered = Model.orderBy(everyone, Employee.property("fullName"), "asc");
    const orderedPiped = pipe(everyone, Model.orderBy(Employee.property("fullName"), "asc"));
    const tieBroken = pipe(ordered, Model.thenBy(Employee.property("employeeId"), "desc"));

    assertTrue(exactly<typeof filtered, Model.TypedObjectSet<typeof Employee>>(true));
    assertTrue(exactly<typeof filteredPiped, Model.TypedObjectSet<typeof Employee>>(true));
    assertTrue(exactly<typeof ordered, Model.OrderedObjectSet<typeof Employee>>(true));
    assertTrue(exactly<typeof orderedPiped, Model.OrderedObjectSet<typeof Employee>>(true));
    assertTrue(exactly<typeof tieBroken, Model.OrderedObjectSet<typeof Employee>>(true));
    assertTrue(exactly<(typeof ordered)["orderBy"]["type"], "fields">(true));
    // The checks do not depend on how a call is written: nested directly, the model still comes through.
    const nestedFilter = Model.where(Model.where(everyone, named), Model.not(named));
    const nestedOrdering = Model.thenBy(
      Model.orderBy(Model.where(everyone, named), Employee.property("fullName"), "asc"),
      Employee.property("employeeId"),
      "desc"
    );
    const standalone = Model.where(named)(everyone);
    const standaloneOrdering = Model.orderBy(Employee.property("fullName"), "asc")(everyone);
    assertTrue(exactly<typeof nestedFilter, Model.TypedObjectSet<typeof Employee>>(true));
    assertTrue(exactly<typeof nestedOrdering, Model.OrderedObjectSet<typeof Employee>>(true));
    assertTrue(exactly<typeof standalone, Model.TypedObjectSet<typeof Employee>>(true));
    assertTrue(exactly<typeof standaloneOrdering, Model.OrderedObjectSet<typeof Employee>>(true));
    deepStrictEqual(standalone, filtered);
    deepStrictEqual(standaloneOrdering, ordered);
    strictEqual(A.length(nestedOrdering.orderBy.fields), 2);
    strictEqual(nestedFilter.model, Employee);
    // An ordered set is a typed set, so it goes wherever one goes.
    const asSet: Model.TypedObjectSet<typeof Employee> = tieBroken;
    strictEqual(asSet.model, Employee);
    assertTrue(S.is(OrderBy)(ordered.orderBy));
  });

  it("keeps the negative cases as compile errors", () => {
    strictEqual(typeof staticGuarantees, "function");
  });
});

// ---------------------------------------------------------------------------
// Model.filter
// ---------------------------------------------------------------------------

// References of a given tag for the family laws. A reference is only a carrier, so the codec need not match the tag.
const scalarReference = <Kind extends PropertyTypeKind>(kind: Kind) => ({
  owner: "Sample",
  name: "sample",
  kind,
  value: S.String,
});
const listReference = <Kind extends PropertyTypeKind>(kind: Kind) => ({
  owner: "Sample",
  name: "sample",
  kind,
  value: S.Array(S.String),
});

const sampleArea = CircularArea.around([-122.33, 47.61], Distance.kilometers(5));
const sampleBox = BoundingBoxCorners.fromBoundingBox([-122.5, 47.5, -122.2, 47.7]);
const samplePolygon = Polygon.make({
  coordinates: [
    LinearRing.fromVertices([
      [0, 0],
      [4, 0],
      [0, 3],
    ]),
  ],
});
const sampleGeometry = GeoJsonGeometry.make({ geoJson: GeoPoint.make({ coordinates: [1, 2] }) });
const sampleInterval = IntervalMatch.make({ query: "quick fox", ordered: true, maxGaps: O.some(1) });
const lastWeek = RelativeDateRange.make({
  relativeStartTime: O.some(RelativePoint.make({ value: -7, timeUnit: "day" })),
  timeZoneId: "UTC",
});

// For each family, the operators its constructors actually emit when applied to a reference of the given tag.
const emittedBy: { readonly [Family in Model.OperatorFamily]: ReadonlyArray<ReadonlyArray<string>> } = {
  nullable: A.map(PropertyTypeKind.literals, (kind) => [
    Model.isNull(scalarReference(kind)).filter.type,
    Model.isNotNull(scalarReference(kind)).filter.type,
  ]),
  equatable: A.map(Model.EquatableKind.literals, (kind) => [
    Model.eq(scalarReference(kind), "x").filter.type,
    Model.ne(scalarReference(kind), "x").filter.filter.type,
    Model.oneOf(scalarReference(kind), ["x", "y"]).filter.type,
  ]),
  ordered: A.map(Model.OrderedKind.literals, (kind) => [
    Model.lt(scalarReference(kind), "x").filter.type,
    Model.gt(scalarReference(kind), "x").filter.type,
    Model.lte(scalarReference(kind), "x").filter.type,
    Model.gte(scalarReference(kind), "x").filter.type,
  ]),
  text: A.map(Model.TextKind.literals, (kind) => [
    Model.startsWith(scalarReference(kind), "x").filter.type,
    Model.matchesWildcard(scalarReference(kind), "x*").filter.type,
    Model.matchesRegex(scalarReference(kind), "x+").filter.type,
    Model.containsAnyTerm(scalarReference(kind), "x y").filter.type,
    Model.containsAllTerms(scalarReference(kind), "x y").filter.type,
    Model.containsAllTermsInOrder(scalarReference(kind), "x y").filter.type,
    Model.containsAllTermsInOrderPrefixLastTerm(scalarReference(kind), "x y").filter.type,
    Model.matchesInterval(scalarReference(kind), sampleInterval).filter.type,
  ]),
  temporal: A.map(TemporalKind.literals, (kind) => [
    Model.inRelativeDateRange(scalarReference(kind), lastWeek).filter.type,
  ]),
  geospatial: A.map(GeospatialKind.literals, (kind) => [
    Model.withinDistance(scalarReference(kind), sampleArea).filter.type,
    Model.withinBoundingBox(scalarReference(kind), sampleBox).filter.type,
    Model.withinPolygon(scalarReference(kind), samplePolygon).filter.type,
    Model.intersectsBoundingBox(scalarReference(kind), sampleBox).filter.type,
    Model.intersectsPolygon(scalarReference(kind), samplePolygon).filter.type,
    Model.doesNotIntersectBoundingBox(scalarReference(kind), sampleBox).filter.type,
    Model.doesNotIntersectPolygon(scalarReference(kind), samplePolygon).filter.type,
    Model.relatesToGeometry(scalarReference(kind), sampleGeometry, "intersects").filter.type,
  ]),
  array: A.map(Model.ArrayKind.literals, (kind) => [Model.contains(listReference(kind), "x").filter.type]),
};

// The tags whose values are references rather than scalars: the policy lets them be compared as text, the typed
// layer has no operand of their own type to offer.
const referenceValued: ReadonlyArray<PropertyTypeKind> = [
  "cipherText",
  "attachment",
  "mediaReference",
  "geotimeSeriesReference",
  "timeseries",
  "vector",
];

describe("Model.filter families", () => {
  it("declares each family as a pick of the property tag kit", () => {
    assertTrue(
      A.every(Model.OperatorFamily.literals, (family) => A.isReadonlyArrayNonEmpty(Model.familyKinds[family]))
    );
    assertTrue(
      A.every(Model.OperatorFamily.literals, (family) => A.every(Model.familyKinds[family], S.is(PropertyTypeKind)))
    );
    deepStrictEqual(Model.familyKinds.nullable, PropertyTypeKind.literals);
    deepStrictEqual(Model.familyKinds.temporal, ["date", "timestamp"]);
    deepStrictEqual(Model.familyKinds.geospatial, ["geopoint", "geoshape"]);
    deepStrictEqual(Model.TextKind.literals, ["string"]);
    deepStrictEqual(Model.ArrayKind.literals, ["array"]);
    // Ordered tags are equatable tags: whatever can be ranked can be compared for equality.
    assertTrue(A.every(Model.OrderedKind.literals, S.is(Model.EquatableKind)));
    assertTrue(exactly<Model.TextKind, "string">(true));
    assertTrue(exactly<Model.ArrayKind, "array">(true));
    assertTrue(exactly<Exclude<Model.EquatableKind, Model.OrderedKind>, "boolean" | "marking">(true));
  });

  it("has constructors that emit exactly the operators their family lists, for every tag of the family", () => {
    const verdicts = A.map(Model.OperatorFamily.literals, (family) =>
      A.every(emittedBy[family], (emitted) => sameMembers(emitted, Model.familyOperators[family]))
    );
    deepStrictEqual(verdicts, [true, true, true, true, true, true, true]);
    deepStrictEqual(
      A.map(Model.OperatorFamily.literals, (family) => A.length(emittedBy[family])),
      A.map(Model.OperatorFamily.literals, (family) => A.length(Model.familyKinds[family]))
    );
  });

  it("admits, for every tag of every family, only operators the policy table allows", () => {
    const strays = A.flatMap(Model.OperatorFamily.literals, (family) =>
      A.flatMap(Model.familyKinds[family], (kind) =>
        A.map(
          A.filter(Model.familyOperators[family], (operator) => !A.contains(allowedOperators[kind], operator)),
          (operator) => `${family}:${kind}:${operator}`
        )
      )
    );
    deepStrictEqual(strays, []);
    assertTrue(
      A.every(PropertyTypeKind.literals, (kind) =>
        A.every(Model.typedOperators(kind), (operator) => A.contains(allowedOperators[kind], operator))
      )
    );
  });

  it("admits every operator the policy table allows, except text comparison of reference-valued tags", () => {
    const missing = (kind: PropertyTypeKind): ReadonlyArray<PropertyOperator> =>
      A.difference(allowedOperators[kind], Model.typedOperators(kind));
    const complete = A.filter(PropertyTypeKind.literals, (kind) => !A.contains(referenceValued, kind));

    assertTrue(A.every(complete, (kind) => sameMembers(Model.typedOperators(kind), allowedOperators[kind])));
    deepStrictEqual(
      A.map(referenceValued, missing),
      A.map(referenceValued, (): ReadonlyArray<PropertyOperator> => ["eq", "in"])
    );
    strictEqual(A.length(complete), 16);
    // No tag gets the same operator from two families.
    assertTrue(
      A.every(
        PropertyTypeKind.literals,
        (kind) => A.length(A.dedupe(Model.typedOperators(kind))) === A.length(Model.typedOperators(kind))
      )
    );
  });

  it.prop(
    "generates family members that are property tags",
    [
      Arbitrary.schema(Model.EquatableKind),
      Arbitrary.schema(Model.OrderedKind),
      Arbitrary.schema(Model.TextKind),
      Arbitrary.schema(Model.ArrayKind),
      Arbitrary.schema(Model.OperatorFamily),
    ],
    ([equatable, ordered, text, array, family]) =>
      S.is(Model.EquatableKind)(equatable) &&
      S.is(Model.OrderedKind)(ordered) &&
      S.is(Model.TextKind)(text) &&
      S.is(Model.ArrayKind)(array) &&
      S.is(Model.OperatorFamily)(family) &&
      A.every([equatable, ordered, text, array], S.is(PropertyTypeKind)) &&
      A.contains(Model.familyKinds.equatable, equatable) &&
      A.contains(Model.familyKinds.ordered, ordered),
    { arbitrary: fcRuns(50) }
  );
});

describe("Model.filter constructors", () => {
  it("build the same filter as their untyped twin, in both call shapes", () => {
    const fullName = Employee.property("fullName");
    const employeeId = Employee.property("employeeId");
    const skills = Employee.property("skills");
    const startedAt = Employee.property("startedAt");
    const entrance = Office.property("entrance");
    const footprint = Office.property("footprint");

    // Each row: the typed filter, the model that issued its reference, and what the untyped constructor builds.
    const twins: ReadonlyArray<readonly [typed: Model.TypedFilter, owner: string, plain: ObjectFilter]> = [
      [Model.eq(fullName, "John Doe"), "Employee", Filter.eq("fullName", "John Doe")],
      [pipe(fullName, Model.eq("John Doe")), "Employee", Filter.eq("fullName", "John Doe")],
      [Model.ne(fullName, "John Doe"), "Employee", Filter.ne("fullName", "John Doe")],
      [pipe(fullName, Model.ne("John Doe")), "Employee", Filter.ne("fullName", "John Doe")],
      [Model.oneOf(employeeId, [1, 2, 3]), "Employee", Filter.oneOf("employeeId", [1, 2, 3])],
      [pipe(employeeId, Model.oneOf([1, 2, 3])), "Employee", Filter.oneOf("employeeId", [1, 2, 3])],
      [Model.isNull(fullName), "Employee", Filter.isNull("fullName")],
      [Model.isNotNull(skills), "Employee", Filter.isNotNull("skills")],
      [Model.gt(employeeId, 5), "Employee", Filter.gt("employeeId", 5)],
      [pipe(employeeId, Model.gt(5)), "Employee", Filter.gt("employeeId", 5)],
      [Model.gte(employeeId, 5), "Employee", Filter.gte("employeeId", 5)],
      [pipe(employeeId, Model.gte(5)), "Employee", Filter.gte("employeeId", 5)],
      [Model.lt(employeeId, 5), "Employee", Filter.lt("employeeId", 5)],
      [pipe(employeeId, Model.lt(5)), "Employee", Filter.lt("employeeId", 5)],
      [Model.lte(employeeId, 5), "Employee", Filter.lte("employeeId", 5)],
      [pipe(employeeId, Model.lte(5)), "Employee", Filter.lte("employeeId", 5)],
      [Model.contains(skills, "sailing"), "Employee", Filter.contains("skills", "sailing")],
      [pipe(skills, Model.contains("sailing")), "Employee", Filter.contains("skills", "sailing")],
      [Model.startsWith(fullName, "Jo"), "Employee", Filter.startsWith("fullName", "Jo")],
      [pipe(fullName, Model.startsWith("Jo")), "Employee", Filter.startsWith("fullName", "Jo")],
      [Model.matchesWildcard(fullName, "Jo*"), "Employee", Filter.matchesWildcard("fullName", "Jo*")],
      [Model.matchesRegex(fullName, "Jo.+"), "Employee", Filter.matchesRegex("fullName", "Jo.+")],
      [Model.containsAnyTerm(fullName, "john doe"), "Employee", Filter.containsAnyTerm("fullName", "john doe")],
      [Model.containsAllTerms(fullName, "john doe"), "Employee", Filter.containsAllTerms("fullName", "john doe")],
      [
        Model.containsAllTermsInOrder(fullName, "john doe"),
        "Employee",
        Filter.containsAllTermsInOrder("fullName", "john doe"),
      ],
      [
        Model.containsAllTermsInOrderPrefixLastTerm(fullName, "john d"),
        "Employee",
        Filter.containsAllTermsInOrderPrefixLastTerm("fullName", "john d"),
      ],
      [Model.matchesInterval(fullName, sampleInterval), "Employee", Filter.matchesInterval("fullName", sampleInterval)],
      [Model.inRelativeDateRange(startedAt, lastWeek), "Employee", Filter.inRelativeDateRange("startedAt", lastWeek)],
      [
        pipe(startedAt, Model.inRelativeDateRange(lastWeek)),
        "Employee",
        Filter.inRelativeDateRange("startedAt", lastWeek),
      ],
      [Model.withinDistance(entrance, sampleArea), "Office", Filter.withinDistance("entrance", sampleArea)],
      [pipe(entrance, Model.withinDistance(sampleArea)), "Office", Filter.withinDistance("entrance", sampleArea)],
      [Model.withinBoundingBox(entrance, sampleBox), "Office", Filter.withinBoundingBox("entrance", sampleBox)],
      [Model.withinPolygon(entrance, samplePolygon), "Office", Filter.withinPolygon("entrance", samplePolygon)],
      [
        Model.intersectsBoundingBox(footprint, sampleBox),
        "Office",
        Filter.intersectsBoundingBox("footprint", sampleBox),
      ],
      [
        Model.intersectsPolygon(footprint, samplePolygon),
        "Office",
        Filter.intersectsPolygon("footprint", samplePolygon),
      ],
      [
        Model.doesNotIntersectBoundingBox(footprint, sampleBox),
        "Office",
        Filter.doesNotIntersectBoundingBox("footprint", sampleBox),
      ],
      [
        Model.doesNotIntersectPolygon(footprint, samplePolygon),
        "Office",
        Filter.doesNotIntersectPolygon("footprint", samplePolygon),
      ],
      [
        Model.relatesToGeometry(footprint, sampleGeometry, "contains"),
        "Office",
        Filter.relatesToGeometry("footprint", sampleGeometry, "contains"),
      ],
      [
        pipe(footprint, Model.relatesToGeometry(sampleGeometry, "contains")),
        "Office",
        Filter.relatesToGeometry("footprint", sampleGeometry, "contains"),
      ],
    ];
    strictEqual(A.length(twins), 39);
    // The filter inside the pair is the untyped twin's value, so the wire cannot tell the two apart.
    deepStrictEqual(
      A.map(twins, ([typed]) => typed.filter),
      A.map(twins, ([, , plain]) => plain)
    );
    // The owner beside it is the API name of the model the reference came from.
    deepStrictEqual(
      A.map(twins, ([typed]) => typed.owner),
      A.map(twins, ([, owner]) => owner)
    );
    // A typed filter is exactly that pair, nothing more.
    assertTrue(A.every(twins, ([typed]) => sameMembers(R.keys(typed), ["owner", "filter"])));
  });

  it("combine typed filters of one model into the filter the untyped combinators build", () => {
    const named = Model.eq(Employee.property("fullName"), "John Doe");
    const active = Model.eq(Employee.property("active"), true);
    const senior = Model.lt(Employee.property("employeeId"), 100);

    deepStrictEqual(Model.and(named, active), { owner: "Employee", filter: Filter.and(named.filter, active.filter) });
    deepStrictEqual(pipe(named, Model.and(active)), Model.and(named, active));
    deepStrictEqual(Model.or(named, active), { owner: "Employee", filter: Filter.or(named.filter, active.filter) });
    deepStrictEqual(pipe(named, Model.or(active)), Model.or(named, active));
    deepStrictEqual(Model.not(named), { owner: "Employee", filter: Filter.not(named.filter) });
    // Like the untyped combinators, a conjunction grows flat instead of nesting.
    const three = pipe(named, Model.and(active), Model.and(senior));
    deepStrictEqual(three.filter, Filter.every([named.filter, active.filter, senior.filter]));
    const any = pipe(named, Model.or(active), Model.or(senior));
    deepStrictEqual(any.filter, Filter.some([named.filter, active.filter, senior.filter]));
    deepStrictEqual(
      [three.owner, any.owner, Model.not(any).owner, Model.and(Model.not(any), three).owner],
      ["Employee", "Employee", "Employee", "Employee"]
    );
    assertTrue(S.is(ObjectFilter)(Model.and(Model.not(any), three).filter));
  });

  it.effect(
    "encode operands of the property's own type to their canonical wire spelling",
    Effect.fnUntraced(function* () {
      const wire = yield* Effect.forEach(
        [
          Model.eq(Employee.property("fullName"), "John Doe"),
          Model.eq(Employee.property("active"), true),
          Model.gt(Employee.property("employeeId"), 50000),
          Model.gte(Employee.property("badge"), BigInt("9007199254740993")),
          Model.lt(Employee.property("salary"), BigDecimal.fromStringUnsafe("12.5")),
          Model.lte(Employee.property("startDate"), LocalDate.make({ year: 2021, month: 5, day: 1 })),
          Model.gt(Employee.property("startedAt"), DateTime.makeUnsafe(1609736400000)),
          Model.oneOf(Employee.property("badge"), [BigInt(1), BigInt(2)]),
          Model.ne(Employee.property("clearance"), MarkingId.make("8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b")),
          Model.contains(Employee.property("skills"), "sailing"),
          Model.isNull(Employee.property("address")),
          Model.startsWith(Employee.property("fullName"), "John D"),
        ],
        (typed) => encodeFilter(typed.filter)
      );
      deepStrictEqual(wire, [
        { type: "eq", field: "fullName", value: "John Doe" },
        { type: "eq", field: "active", value: true },
        { type: "gt", field: "employeeId", value: 50000 },
        { type: "gte", field: "badge", value: "9007199254740993" },
        { type: "lt", field: "salary", value: "12.5" },
        { type: "lte", field: "startDate", value: "2021-05-01" },
        { type: "gt", field: "startedAt", value: "2021-01-04T05:00:00.000Z" },
        { type: "in", field: "badge", value: ["1", "2"] },
        { type: "not", value: { type: "eq", field: "clearance", value: "8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b" } },
        { type: "contains", field: "skills", value: "sailing" },
        { type: "isNull", field: "address", value: true },
        { type: "startsWith", field: "fullName", value: "John D" },
      ]);
    })
  );

  // The typed layer takes the rich operand and the plain filter holds the wire scalar: nothing rich is left in
  // it, so it is the value the untyped constructor builds and it round-trips exactly.
  it.effect(
    "write each rich operand as its canonical wire text, which the operand codec of the property's type reads back",
    Effect.fnUntraced(function* () {
      const longBadge = BigInt("9007199254740993");
      const twelveFifty = BigDecimal.fromStringUnsafe("12.50");
      const fourthOfJanuary = LocalDate.make({ year: 2021, month: 1, day: 4 });
      const instant = DateTime.makeUnsafe(1609736400000);
      const badge = Model.gte(Employee.property("badge"), longBadge);
      const salary = Model.lt(Employee.property("salary"), twelveFifty);
      const startDate = Model.lte(Employee.property("startDate"), fourthOfJanuary);
      const startedAt = pipe(Employee.property("startedAt"), Model.gt(instant));
      // A 64-bit integer as text, a decimal with the scale it was given, a date as YYYY-MM-DD, an instant in ISO form.
      deepStrictEqual(
        [badge.filter.value, salary.filter.value, startDate.filter.value, startedAt.filter.value],
        ["9007199254740993", "12.50", "2021-01-04", "2021-01-04T05:00:00.000Z"]
      );
      deepStrictEqual(Model.oneOf(Employee.property("badge"), [BigInt(1), longBadge]).filter.value, [
        "1",
        "9007199254740993",
      ]);
      deepStrictEqual<ObjectFilter>(
        Model.ne(Employee.property("badge"), longBadge).filter,
        Filter.ne("badge", "9007199254740993")
      );
      const typed = [badge, salary, startDate, startedAt];
      // Each is the plain filter the untyped constructor builds from that scalar.
      deepStrictEqual<ReadonlyArray<ObjectFilter>>(
        A.map(typed, ({ filter }) => filter),
        [
          Filter.gte("badge", "9007199254740993"),
          Filter.lt("salary", "12.50"),
          Filter.lte("startDate", "2021-01-04"),
          Filter.gt("startedAt", "2021-01-04T05:00:00.000Z"),
        ]
      );
      // The strict law on these filters: decoding the encoding gives an equivalent filter back.
      const verdicts = yield* Effect.forEach(
        typed,
        Effect.fnUntraced(function* ({ filter }) {
          const wire = yield* encodeFilter(filter);
          const decoded = yield* S.decodeEffect(ObjectFilter)(wire);
          return S.toEquivalence(ObjectFilter)(decoded, filter);
        })
      );
      deepStrictEqual(verdicts, [true, true, true, true]);
      // And the rich operand is one decode away, through the projection the tier below publishes.
      const readBadge = yield* S.decodeEffect(operandCodec(LongType.make({})))(badge.filter.value);
      const readSalary = yield* S.decodeEffect(operandCodec(DecimalType.make({})))(salary.filter.value);
      const readStartDate = yield* S.decodeEffect(operandCodec(DateType.make({})))(startDate.filter.value);
      const readStartedAt = yield* S.decodeEffect(operandCodec(TimestampType.make({})))(startedAt.filter.value);
      strictEqual(readBadge, longBadge);
      // "12.50" and "12.5" are one decimal.
      const oneDecimal = S.toEquivalence(Model.decimal.value);
      assertTrue(S.is(Model.decimal.value)(readSalary) && oneDecimal(readSalary, BigDecimal.fromStringUnsafe("12.5")));
      deepStrictEqual<unknown>(readStartDate, fourthOfJanuary);
      deepStrictEqual<unknown>(readStartedAt, instant);
    })
  );

  it("write an element operand with the element's codec, not the array's", () => {
    const Ledger = Model.object({
      apiName: "Ledger",
      primaryKey: "ledgerId",
      properties: {
        ledgerId: Model.required(Model.string),
        accounts: Model.array(Model.long),
        closings: Model.array(Model.date),
      },
      links: {},
    });
    const holds = Model.contains(Ledger.property("accounts"), BigInt("9007199254740993"));
    const closed = pipe(Ledger.property("closings"), Model.contains(LocalDate.make({ year: 2021, month: 1, day: 4 })));
    deepStrictEqual([holds.filter, closed.filter], [
      Filter.contains("accounts", "9007199254740993"),
      Filter.contains("closings", "2021-01-04"),
    ]);
    strictEqual(holds.owner, "Ledger");
  });

  // The static type of an operand can be wider than the property's values: `number` says nothing of 32 bits. Such
  // an operand is refused when the filter is built, the way `X.make` refuses input its schema rejects.
  it("refuse an operand that is not a value of the property, naming the property and carrying the schema issue", () => {
    // What a constructor throws: the message, and the path of the issue when the error is a schema error.
    const refusal = (build: () => unknown): { readonly message: string; readonly path: ReadonlyArray<PropertyKey> } => {
      const outcome = Result.try(build);
      return Result.isFailure(outcome) && S.isSchemaError(outcome.failure)
        ? {
            message: outcome.failure.message,
            path: outcome.failure.issue._tag === "Pointer" ? outcome.failure.issue.path : [],
          }
        : { message: "", path: [] };
    };
    const pastInt32 = refusal(() => Model.gt(Employee.property("employeeId"), 2147483648));
    deepStrictEqual(pastInt32.path, ["employeeId"]);
    assertInclude(pastInt32.message, '["employeeId"]');
    assertInclude(pastInt32.message, "2147483648");
    const fraction = refusal(() => Model.eq(Employee.property("employeeId"), 1.5));
    deepStrictEqual(fraction.path, ["employeeId"]);
    const pastInt64 = refusal(() => Model.lte(Employee.property("badge"), BigInt("9223372036854775808")));
    deepStrictEqual(pastInt64.path, ["badge"]);
    assertInclude(pastInt64.message, '["badge"]');
    const oneBadMember = refusal(() => Model.oneOf(Employee.property("employeeId"), [1, 2147483648]));
    deepStrictEqual(oneBadMember.path, ["employeeId"]);
    const emptyMarking = refusal(() =>
      Model.ne(Employee.property("clearance"), MarkingId.make("", { disableChecks: true }))
    );
    deepStrictEqual(emptyMarking.path, ["clearance"]);
    // A calendar date type admits a 30th of February; the date property's codec does not.
    const impossibleDay = refusal(() =>
      Model.lt(Employee.property("startDate"), LocalDate.make({ year: 2021, month: 2, day: 30 }))
    );
    deepStrictEqual(impossibleDay.path, ["startDate"]);
    assertInclude(impossibleDay.message, '["startDate"]');
    // The bounds themselves are values of the property and build a filter.
    deepStrictEqual(
      [
        Model.gt(Employee.property("employeeId"), 2147483647).filter.value,
        Model.lte(Employee.property("badge"), BigInt("9223372036854775807")).filter.value,
      ],
      [2147483647, "9223372036854775807"]
    );
  });
});

// ---------------------------------------------------------------------------
// Model.set
// ---------------------------------------------------------------------------

describe("Model.set", () => {
  it.effect(
    "builds the wire object set of each combinator and keeps the model",
    Effect.fnUntraced(function* () {
      const everyone = Model.all(Employee);
      const johns = Model.where(everyone, Model.startsWith(Employee.property("fullName"), "John"));
      const adults = pipe(everyone, Model.where(Model.gte(Employee.property("employeeId"), 18)));
      const sets = [
        everyone,
        johns,
        Model.union(johns, adults),
        pipe(johns, Model.union(adults)),
        Model.intersect(johns, adults),
        pipe(johns, Model.intersect(adults)),
        Model.subtract(everyone, johns),
        pipe(everyone, Model.subtract(johns)),
      ];
      const wire = yield* Effect.forEach(sets, (set) => encodeSet(set.objectSet));

      const base = { type: "base", objectType: "Employee" };
      const johnsWire = {
        type: "filter",
        objectSet: base,
        where: { type: "startsWith", field: "fullName", value: "John" },
      };
      const adultsWire = { type: "filter", objectSet: base, where: { type: "gte", field: "employeeId", value: 18 } };
      const expected: ReadonlyArray<unknown> = [
        base,
        johnsWire,
        { type: "union", objectSets: [johnsWire, adultsWire] },
        { type: "union", objectSets: [johnsWire, adultsWire] },
        { type: "intersect", objectSets: [johnsWire, adultsWire] },
        { type: "intersect", objectSets: [johnsWire, adultsWire] },
        { type: "subtract", objectSets: [base, johnsWire] },
        { type: "subtract", objectSets: [base, johnsWire] },
      ];
      deepStrictEqual<ReadonlyArray<unknown>>(wire, expected);
      assertTrue(A.every(sets, (set) => set.model === Employee));
      assertTrue(A.every(sets, (set) => S.is(ObjectSet)(set.objectSet)));
    })
  );

  it.effect(
    "traverses a link to the target model's objects",
    Effect.fnUntraced(function* () {
      const offices = Model.traverse(Model.all(Employee), "office", Office);
      const occupants = pipe(offices, Model.traverse("occupants", Employee));
      const officesWire = yield* encodeSet(offices.objectSet);
      const occupantsWire = yield* encodeSet(occupants.objectSet);

      const toOffice = { type: "searchAround", objectSet: { type: "base", objectType: "Employee" }, link: "office" };
      const toOccupants = { type: "searchAround", objectSet: toOffice, link: "occupants" };
      deepStrictEqual<unknown>(officesWire, toOffice);
      deepStrictEqual<unknown>(occupantsWire, toOccupants);
      strictEqual(offices.model, Office);
      strictEqual(occupants.model, Employee);

      // The traversed set decodes with the target model.
      const office = yield* S.decodeEffect(offices.model.Instance)({
        __apiName: "Office",
        __primaryKey: "nyc",
        officeId: "nyc",
        entrance: { type: "Point", coordinates: [-74.0, 40.7] },
      });
      strictEqual(office.properties.officeId, "nyc");
      const refused = yield* fails(S.decodeEffect(offices.model.Instance)(employeeWire));
      assertTrue(refused);
    })
  );

  it.effect(
    "filters by a combination of typed filters and by a hand-made pair, with the same wire value",
    Effect.fnUntraced(function* () {
      const everyone = Model.all(Employee);
      const named = Model.eq(Employee.property("fullName"), "John Doe");
      const active = Model.eq(Employee.property("active"), true);
      const typed = Model.where(everyone, Model.and(named, Model.not(active)));
      // The seam to the untyped module: a plain filter paired, by hand, with the model it is about.
      const plain = Filter.and(Filter.eq("fullName", "John Doe"), Filter.not(Filter.eq("active", true)));
      const adopted = Model.where(everyone, { owner: Employee.apiName, filter: plain });
      const typedWire = yield* encodeSet(typed.objectSet);
      const adoptedWire = yield* encodeSet(adopted.objectSet);

      deepStrictEqual<unknown>(typedWire, {
        type: "filter",
        objectSet: { type: "base", objectType: "Employee" },
        where: {
          type: "and",
          value: [
            { type: "eq", field: "fullName", value: "John Doe" },
            { type: "not", value: { type: "eq", field: "active", value: true } },
          ],
        },
      });
      deepStrictEqual(adoptedWire, typedWire);
      deepStrictEqual(adopted, typed);
    })
  );

  it.effect(
    "orders a set by one property in the given direction, then by tie-breakers",
    Effect.fnUntraced(function* () {
      const everyone = Model.all(Employee);
      const ascending = Model.orderBy(everyone, Employee.property("fullName"), "asc");
      const descending = pipe(everyone, Model.orderBy(Employee.property("startedAt"), "desc"));
      const ascendingWire = yield* encodeOrderBy(ascending.orderBy);
      const descendingWire = yield* encodeOrderBy(descending.orderBy);

      deepStrictEqual(ascendingWire, { fields: [{ field: "fullName", direction: "asc" }] });
      deepStrictEqual(descendingWire, { fields: [{ field: "startedAt", direction: "desc" }] });
      strictEqual(ascending.orderBy.type, "fields");
      // Ordering adds the sort keys beside the pair and leaves the pair as it was.
      strictEqual(ascending.model, Employee);
      strictEqual(ascending.objectSet, everyone.objectSet);
      deepStrictEqual(R.keys(ascending), ["model", "objectSet", "orderBy"]);

      const tieBroken = Model.thenBy(ascending, Employee.property("employeeId"), "desc");
      const piped = pipe(ascending, Model.thenBy(Employee.property("employeeId"), "desc"));
      const tieBrokenWire = yield* encodeOrderBy(tieBroken.orderBy);
      deepStrictEqual(tieBrokenWire, {
        fields: [
          { field: "fullName", direction: "asc" },
          { field: "employeeId", direction: "desc" },
        ],
      });
      deepStrictEqual(piped, tieBroken);
      strictEqual(tieBroken.objectSet, everyone.objectSet);
      // The ordering it extends is left as it was.
      strictEqual(A.length(ascending.orderBy.fields), 1);

      // Ordering an ordered set starts over: the new key replaces the old ones.
      const reordered = Model.orderBy(tieBroken, Employee.property("startDate"), "desc");
      const reorderedWire = yield* encodeOrderBy(reordered.orderBy);
      deepStrictEqual(reorderedWire, { fields: [{ field: "startDate", direction: "desc" }] });

      // Sets have no order: a set combinator returns the plain pair, and its type says so.
      const filtered = Model.where(tieBroken, Model.isNotNull(Employee.property("fullName")));
      const united = Model.union(tieBroken, everyone);
      const traversed = Model.traverse(tieBroken, "office", Office);
      deepStrictEqual(A.map([filtered, united], R.keys), [
        ["model", "objectSet"],
        ["model", "objectSet"],
      ]);
      deepStrictEqual(R.keys(traversed), ["model", "objectSet"]);

      // A narrowed model is the same object type, so its references order the sets of the model it narrows.
      const Named = Model.pick(Employee, ["fullName"]);
      const byPicked = Model.orderBy(everyone, Named.property("fullName"), "asc");
      deepStrictEqual(byPicked.orderBy, ascending.orderBy);
    })
  );

  it.effect(
    "picks a model that decodes and types only the picked properties and the primary key",
    Effect.fnUntraced(function* () {
      const Named = Model.pick(Employee, ["fullName", "skills"]);
      const Piped = pipe(Employee, Model.pick(["fullName", "skills"]));
      const KeyOnly = Model.pick(Employee, []);
      const KeyNamed = Model.pick(Employee, ["employeeId", "fullName"]);

      type NamedInstance = {
        readonly locator: ObjectLocator;
        readonly rid: O.Option<ObjectRid>;
        readonly title: O.Option<string>;
        readonly score: O.Option<number>;
        readonly properties: {
          readonly employeeId: number;
          readonly fullName: O.Option<string>;
          readonly skills: O.Option<ReadonlyArray<string>>;
        };
        readonly undeclared: { readonly [name: PropertyApiName]: S.Json };
      };
      assertTrue(exactly<typeof Named.Instance.Type, NamedInstance>(true));
      assertTrue(exactly<typeof Piped.Instance.Type, NamedInstance>(true));
      assertTrue(exactly<typeof Named.Properties.Type, NamedInstance["properties"]>(true));
      assertTrue(exactly<(typeof KeyOnly.Properties)["Type"], { readonly employeeId: number }>(true));
      assertTrue(
        exactly<
          (typeof KeyNamed.Properties)["Type"],
          { readonly employeeId: number; readonly fullName: O.Option<string> }
        >(true)
      );
      assertTrue(exactly<typeof Named.apiName, "Employee">(true));
      assertTrue(exactly<typeof Named.primaryKey, "employeeId">(true));
      assertTrue(exactly<typeof Named.links, typeof Employee.links>(true));

      // Picked specs keep the model's declaration order, whatever order they were named in.
      deepStrictEqual(R.keys(Named.properties), ["employeeId", "fullName", "skills"]);
      deepStrictEqual(R.keys(Piped.properties), ["employeeId", "fullName", "skills"]);
      deepStrictEqual(R.keys(Model.pick(Employee, ["skills", "fullName"]).properties), [
        "employeeId",
        "fullName",
        "skills",
      ]);
      deepStrictEqual(R.keys(KeyOnly.properties), ["employeeId"]);
      deepStrictEqual(R.keys(KeyNamed.properties), ["employeeId", "fullName"]);
      strictEqual(Named.apiName, "Employee");
      strictEqual(Named.primaryKey, "employeeId");
      strictEqual(Named.links, Employee.links);
      strictEqual(Named.properties.fullName, Employee.properties.fullName);

      const named = yield* S.decodeEffect(Named.Instance)(employeeWire);
      deepStrictEqual(R.keys(named.properties), ["employeeId", "fullName", "skills"]);
      strictEqual(named.properties.employeeId, 50030);
      assertSome(named.properties.fullName, "John Doe");
      assertSome(named.properties.skills, ["sailing", "whaling"]);

      // What the narrowed model does not declare is not typed and not lost: it is carried as JSON and written back.
      deepStrictEqual(R.keys(named.undeclared), ["active", "badge", "salary", "startDate", "startedAt", "address"]);
      const encoded = yield* S.encodeEffect(Named.Instance)(named);
      deepStrictEqual(encoded, employeeWire);
      // A record that holds only what was selected has nothing undeclared.
      const selected = yield* S.decodeEffect(Named.Instance)({
        __apiName: "Employee",
        __primaryKey: 50030,
        __title: "John Doe",
        employeeId: 50030,
        fullName: "John Doe",
        skills: ["sailing", "whaling"],
      });
      deepStrictEqual(selected.undeclared, {});
      deepStrictEqual(selected.properties, named.properties);

      // The key stays required, the object type stays checked, and a picked model is a model like any other.
      const keyless = yield* fails(S.decodeUnknownEffect(Named.Instance)(R.remove(employeeWire, "employeeId")));
      const foreign = yield* fails(S.decodeEffect(Named.Instance)(everythingWire));
      deepStrictEqual([keyless, foreign], [true, true]);
      deepStrictEqual(Model.gt(Named.property("employeeId"), 5), {
        owner: "Employee",
        filter: Filter.gt("employeeId", 5),
      });
      strictEqual(Model.traverse(Model.all(Named), "office", Office).model, Office);

      const generated = yield* Arbitrary.sampleEffect(Arbitrary.schema(Named.Instance), { count: 20, seed: 3 });
      const survived = yield* Effect.forEach(generated, (instance) => roundTrips(Named.Instance, instance));
      assertTrue(A.every(generated, S.is(Named.Instance)));
      assertTrue(A.every(survived, (verdict) => verdict));
    })
  );
});

// ---------------------------------------------------------------------------
// Model.policy
// ---------------------------------------------------------------------------

const employeeId = PropertyApiName.make("employeeId");
const address = PropertyApiName.make("address");
const skills = PropertyApiName.make("skills");

describe("Model.policy conformance", () => {
  it.effect(
    "finds nothing when the served definition has everything the model declares",
    Effect.fnUntraced(function* () {
      const definition = yield* decodeDefinition(definitionWire({}));
      deepStrictEqual(Model.conformance(Employee, definition), []);
      deepStrictEqual(pipe(Employee, Model.conformance(definition)), []);
      deepStrictEqual(Model.conformance(Model.pick(Employee, ["fullName"]), definition), []);

      // A conforming model decodes what the server sends for that definition.
      const refused = yield* fails(S.decodeEffect(Employee.Instance)(employeeWire));
      assertFalse(refused);
    })
  );

  it.effect(
    "reports a definition of another object type and a different primary key",
    Effect.fnUntraced(function* () {
      const renamed = yield* findingsFor({ apiName: "Staff" });
      const rekeyed = yield* findingsFor({ primaryKey: "fullName" });

      deepStrictEqual(renamed, [
        Model.ObjectTypeMismatch.make({
          declared: ObjectTypeApiName.make("Employee"),
          served: ObjectTypeApiName.make("Staff"),
        }),
      ]);
      deepStrictEqual(rekeyed, [
        Model.PrimaryKeyMismatch.make({ declared: employeeId, served: PropertyApiName.make("fullName") }),
      ]);
    })
  );

  it.effect(
    "reports a missing property and a property with another type tag",
    Effect.fnUntraced(function* () {
      const findings = yield* findingsFor({
        properties: {
          ...R.remove(employeeProperties, "photo"),
          active: propertyWire("active", { type: "string" }),
          badge: propertyWire("badge", { type: "integer" }),
        },
      });
      deepStrictEqual(findings, [
        Model.TagMismatch.make({
          property: PropertyApiName.make("active"),
          path: [],
          declared: "boolean",
          served: "string",
        }),
        Model.TagMismatch.make({
          property: PropertyApiName.make("badge"),
          path: [],
          declared: "long",
          served: "integer",
        }),
        Model.MissingProperty.make({ property: PropertyApiName.make("photo") }),
      ]);
    })
  );

  it.effect(
    "looks through arrays to their element and through structs to each declared field",
    Effect.fnUntraced(function* () {
      const findings = yield* findingsFor({
        properties: {
          ...employeeProperties,
          skills: propertyWire("skills", { type: "array", subType: { type: "integer" } }),
          address: propertyWire("address", {
            type: "struct",
            structFieldTypes: [fieldWire("city", { type: "geopoint" })],
          }),
        },
      });
      deepStrictEqual(findings, [
        Model.TagMismatch.make({
          property: skills,
          path: [Model.ElementStep.make({})],
          declared: "string",
          served: "integer",
        }),
        Model.TagMismatch.make({
          property: address,
          path: [Model.FieldStep.make({ name: StructFieldApiName.make("city") })],
          declared: "string",
          served: "geopoint",
        }),
        Model.MissingStructField.make({ property: address, path: [], field: StructFieldApiName.make("postcode") }),
      ]);
    })
  );

  it.effect(
    "follows a path through nested arrays and structs",
    Effect.fnUntraced(function* () {
      const Nested = Model.object({
        apiName: "Employee",
        primaryKey: "employeeId",
        properties: {
          employeeId: Model.required(Model.integer),
          address: Model.struct({ lines: Model.array(Model.struct({ text: Model.string, floor: Model.integer })) }),
        },
        links: {},
      });
      const definition = yield* decodeDefinition(
        definitionWire({
          properties: {
            ...employeeProperties,
            address: propertyWire("address", {
              type: "struct",
              structFieldTypes: [
                fieldWire("lines", {
                  type: "array",
                  subType: { type: "struct", structFieldTypes: [fieldWire("text", { type: "boolean" })] },
                }),
              ],
            }),
          },
        })
      );
      const inside = [Model.FieldStep.make({ name: StructFieldApiName.make("lines") }), Model.ElementStep.make({})];
      deepStrictEqual(Model.conformance(Nested, definition), [
        Model.TagMismatch.make({
          property: address,
          path: [...inside, Model.FieldStep.make({ name: StructFieldApiName.make("text") })],
          declared: "string",
          served: "boolean",
        }),
        Model.MissingStructField.make({ property: address, path: inside, field: StructFieldApiName.make("floor") }),
      ]);
    })
  );

  it.effect(
    "reports a vector whose served dimension differs from the dimension the model declares",
    Effect.fnUntraced(function* () {
      const findings = yield* findingsFor({
        properties: {
          ...employeeProperties,
          embedding: propertyWire("embedding", { type: "vector", dimension: 4, supportsSearchWith: [] }),
        },
      });
      deepStrictEqual(findings, [
        Model.VectorDimensionMismatch.make({ property: PropertyApiName.make("embedding"), path: [], served: 4 }),
      ]);
      // The finding is true to decoding: the model refuses the vectors that definition stores.
      const refused = yield* fails(
        S.decodeEffect(Employee.Instance)({ ...employeeWire, embedding: [0.1, 0.2, 0.3, 0.4] })
      );
      assertTrue(refused);
    })
  );

  it.effect(
    "compares the declared dimension as data: every vector spec states one, in its shape",
    Effect.fnUntraced(function* () {
      const definition = yield* decodeDefinition(
        definitionWire({
          properties: {
            ...employeeProperties,
            embedding: propertyWire("embedding", { type: "vector", dimension: 4, supportsSearchWith: [] }),
          },
        })
      );
      const exact = { ...Employee, properties: { ...Employee.properties, embedding: Model.vector(4) } };
      deepStrictEqual(Model.conformance(exact, definition), []);
      // The dimension that is compared is the one in the spec's shape, whatever else the record carries.
      const restated = { ...Model.vector(3), shape: Model.vector(4).shape };
      const agreeing = { ...Employee, properties: { ...Employee.properties, embedding: restated } };
      deepStrictEqual(Model.conformance(agreeing, definition), []);
      // A spec tagged a vector that states no dimension used to have nothing to disagree with. It can no longer be
      // written: the shape of a vector spec is typed to state one.
      const undeclared = { ...Model.vector(3), shape: Model.string.shape };
      const silent = { ...Employee, properties: { ...Employee.properties, embedding: undeclared } };
      // @ts-expect-error a vector spec with the shape of a leaf is not a property spec
      const refused: Parameters<typeof Model.conformance>[0] = silent;
      strictEqual<unknown>(refused, silent);
      strictEqual(silent.properties.embedding.kind, "vector");
    })
  );

  it.effect(
    "reports a missing link, another cardinality and another target",
    Effect.fnUntraced(function* () {
      const findings = yield* findingsFor({
        linkTypes: [linkWire("lead", "Employee", "MANY"), linkWire("peeps", "Office", "ONE")],
      });
      const lead = LinkTypeApiName.make("lead");
      const peeps = LinkTypeApiName.make("peeps");
      deepStrictEqual(findings, [
        Model.CardinalityMismatch.make({ link: lead, declared: "one", served: "many" }),
        Model.CardinalityMismatch.make({ link: peeps, declared: "many", served: "one" }),
        Model.TargetMismatch.make({
          link: peeps,
          declared: ObjectTypeApiName.make("Employee"),
          served: ObjectTypeApiName.make("Office"),
        }),
        Model.MissingLink.make({ link: LinkTypeApiName.make("office") }),
      ]);
    })
  );

  it.effect(
    "reports every difference at once, in declaration order",
    Effect.fnUntraced(function* () {
      const findings = yield* findingsFor({
        apiName: "Staff",
        primaryKey: "badge",
        properties: R.remove(employeeProperties, "photo"),
        linkTypes: [],
      });
      deepStrictEqual(
        A.map(findings, (finding) => finding.type),
        ["objectTypeMismatch", "primaryKeyMismatch", "missingProperty", "missingLink", "missingLink", "missingLink"]
      );
      assertTrue(A.every(findings, S.is(Model.ConformanceFinding)));
    })
  );
});

describe("Model.policy findings", () => {
  const describeFinding = Model.ConformanceFinding.match({
    objectTypeMismatch: ({ declared, served }) => `object type ${declared} is served as ${served}`,
    primaryKeyMismatch: ({ declared, served }) => `key ${declared} is served as ${served}`,
    missingProperty: ({ property }) => `no property ${property}`,
    tagMismatch: ({ property, path, declared, served }) =>
      `${property}${A.join(A.map(path, Model.TypePathStep.match({ element: () => "[]", field: ({ name }) => `.${name}` })), "")} is ${served}, not ${declared}`,
    missingStructField: ({ property, field }) => `${property} has no field ${field}`,
    vectorDimensionMismatch: ({ property, served }) => `${property} has ${served} components`,
    missingLink: ({ link }) => `no link ${link}`,
    cardinalityMismatch: ({ link, declared, served }) => `${link} reaches ${served}, not ${declared}`,
    targetMismatch: ({ link, declared, served }) => `${link} leads to ${served}, not ${declared}`,
  });

  it("builds every case through the union and matches each exhaustively", () => {
    const lead = LinkTypeApiName.make("lead");
    const cases = Model.ConformanceFinding.cases;
    const findings = [
      cases.objectTypeMismatch.make({
        declared: ObjectTypeApiName.make("Employee"),
        served: ObjectTypeApiName.make("Staff"),
      }),
      cases.primaryKeyMismatch.make({ declared: employeeId, served: PropertyApiName.make("badge") }),
      cases.missingProperty.make({ property: skills }),
      cases.tagMismatch.make({
        property: address,
        path: [
          Model.TypePathStep.cases.element.make({}),
          Model.TypePathStep.cases.field.make({ name: StructFieldApiName.make("city") }),
        ],
        declared: "string",
        served: "integer",
      }),
      cases.missingStructField.make({ property: address, path: [], field: StructFieldApiName.make("postcode") }),
      cases.vectorDimensionMismatch.make({ property: PropertyApiName.make("embedding"), path: [], served: 4 }),
      cases.missingLink.make({ link: lead }),
      cases.cardinalityMismatch.make({ link: lead, declared: "one", served: "many" }),
      cases.targetMismatch.make({
        link: lead,
        declared: ObjectTypeApiName.make("Employee"),
        served: ObjectTypeApiName.make("Office"),
      }),
    ];

    const kinds: ReadonlyArray<string> = A.map(findings, (finding) => finding.type);
    const discriminants: ReadonlyArray<string> = Model.ConformanceFinding.discriminants;
    deepStrictEqual(kinds, discriminants);
    deepStrictEqual(A.map(findings, describeFinding), [
      "object type Employee is served as Staff",
      "key employeeId is served as badge",
      "no property skills",
      "address[].city is integer, not string",
      "address has no field postcode",
      "embedding has 4 components",
      "no link lead",
      "lead reaches many, not one",
      "lead leads to Office, not Employee",
    ]);
    assertTrue(A.every(findings, S.is(Model.ConformanceFinding)));
    assertTrue(Model.ConformanceFinding.guards.tagMismatch(A.getUnsafe(findings, 3)));
    assertFalse(Model.ConformanceFinding.guards.tagMismatch(A.getUnsafe(findings, 0)));
    assertTrue(Model.ConformanceFinding.isAnyOf(["missingLink", "missingProperty"])(A.getUnsafe(findings, 6)));
    deepStrictEqual(Model.TypePathStep.discriminants, ["element", "field"]);
  });

  it.effect(
    "rejects a finding with an empty name, an unknown tag or an unknown kind",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(Model.ConformanceFinding);
      const verdicts = yield* Effect.forEach(
        [
          { type: "missingProperty", property: "" },
          { type: "tagMismatch", property: "age", path: [], declared: "integer", served: "number" },
          { type: "tagMismatch", property: "age", path: [{ type: "index" }], declared: "integer", served: "string" },
          { type: "cardinalityMismatch", link: "lead", declared: "ONE", served: "many" },
          { type: "vectorDimensionMismatch", property: "embedding", path: [], served: 1.5 },
          { type: "renamedProperty", property: "age" },
        ],
        (input) => fails(decode(input))
      );
      deepStrictEqual(verdicts, [true, true, true, true, true, true]);

      const accepted = yield* decode({
        type: "tagMismatch",
        property: "age",
        path: [{ type: "element" }, { type: "field", name: "years" }],
        declared: "integer",
        served: "string",
      });
      strictEqual(describeFinding(accepted), "age[].years is string, not integer");
    })
  );

  it.effect.prop(
    "generates findings and path steps that satisfy their schema and survive encoding and decoding",
    [Arbitrary.schema(Model.ConformanceFinding), Arbitrary.schema(Model.TypePathStep)],
    Effect.fnUntraced(function* ([finding, step]) {
      const findingSurvives = yield* roundTrips(Model.ConformanceFinding, finding);
      const stepSurvives = yield* roundTrips(Model.TypePathStep, step);
      return (
        S.is(Model.ConformanceFinding)(finding) && S.is(Model.TypePathStep)(step) && findingSurvives && stepSurvives
      );
    }),
    { arbitrary: fcRuns(50) }
  );
});
