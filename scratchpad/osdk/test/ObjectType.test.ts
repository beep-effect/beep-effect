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
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { PrimaryKeyKind } from "../src/DataType/DataType.values.ts";
import { HostedEmbedding, IntegerType, StringType, VectorType } from "../src/DataType/index.ts";
import {
  ActionTypeApiName,
  InterfaceLinkTypeApiName,
  InterfacePropertyApiName,
  InterfaceTypeApiName,
  InterfaceTypeRid,
  LinkTypeApiName,
  LinkTypeRid,
  MediaSetRid,
  MediaSetViewRid,
  ObjectTypeApiName,
  ObjectTypeRid,
  PropertyApiName,
  PropertyTypeRid,
  SharedPropertyTypeApiName,
  StructFieldApiName,
} from "../src/Identifier/index.ts";
import { LinkCardinality, LinkTypeSide } from "../src/LinkType/index.ts";
import { Icon } from "../src/Metadata/index.ts";
import {
  ColumnFieldName,
  ColumnName,
  ColumnPropertyMapping,
  DatasetDatasource,
  DatasetRid,
  DatasourceBranchId,
  DatasourceDefinition,
  DatasourceRid,
  DescriptionChecks,
  DirectDatasource,
  DirectSourceRid,
  DisplayNameChecks,
  EditOnlyPropertyMapping,
  EditsOnlyDatasource,
  GeotimeSeriesDatasource,
  InterfaceActionConstraintApiName,
  InterfaceApiNameChecks,
  InterfaceImplementation,
  InterfacePropertyImplementation,
  LinkApiNameChecks,
  LocalPropertyImplementation,
  MediaSetViewDatasource,
  ObjectType,
  ObjectTypeApiNameChecks,
  ObjectTypeAuthoringChecks,
  ObjectTypeDatasource,
  ObjectTypeDefinition,
  PropertyApiNameChecks,
  PropertyDisplayNameChecks,
  PropertyMapping,
  PropertySource,
  PropertyStructField,
  ReducedPropertyImplementation,
  ReservedKeyword,
  RestrictedViewDatasource,
  RestrictedViewRid,
  StreamDatasource,
  StreamRid,
  StructFieldImplementation,
  StructFieldOfPropertySource,
  StructFieldPropertyMapping,
  StructFieldSource,
  StructImplementation,
  StructPropertyMapping,
  TableDatasource,
  TableRid,
  TimeSeriesDatasource,
  UnreducedInterfacePropertyImplementation,
  UnsupportedDatasource,
} from "../src/ObjectType/index.ts";
import { ArrayReducer, ArrayType, PropertyDefinition } from "../src/Property/index.ts";
import { GeotimeSeriesIntegrationRid, TimeSeriesSyncRid } from "../src/TimeSeries/index.ts";

// -----------------------------------------------------------------------------
// Law and fixture helpers
// -----------------------------------------------------------------------------

/** Laws every named schema obeys: generated values are valid, and the wire form loses nothing. */
const lawsOf = <A, I>(name: string, schema: S.Codec<A, I>, runs = 50) => {
  const arbitrary = Arbitrary.schema(schema);
  const isValid = S.is(schema);
  const isEquivalent = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  describe(`${name} laws`, () => {
    it.prop("generated values satisfy the guard", [arbitrary], ([value]) => isValid(value), {
      arbitrary: fcRuns(runs),
    });
    it.effect.prop(
      "encoding then decoding gives an equivalent value",
      [arbitrary],
      Effect.fnUntraced(function* ([value]) {
        const encoded = yield* encode(value);
        const decoded = yield* decode(encoded);
        assertTrue(isEquivalent(decoded, value));
      }),
      { arbitrary: fcRuns(runs) }
    );
  });
};

/** Decodes an exact wire value to the expected domain value and encodes it back to the same wire value. */
const wireFixture = <A, I>(name: string, schema: S.Codec<A, I>, wire: NoInfer<I>, expected: NoInfer<A>) =>
  it.effect(
    name,
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(schema)(wire);
      deepStrictEqual(decoded, expected);
      assertTrue(S.toEquivalence(schema)(decoded, expected));
      const encoded = yield* S.encodeEffect(schema)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

/** Asserts that decoding fails and that the failure names the violated rule. */
const assertRejects = <A, I>(schema: S.Codec<A, I>, input: unknown, fragment: string) =>
  assertInclude(
    pipe(
      S.decodeUnknownResult(schema)(input),
      Result.getFailure,
      O.map((error) => error.message),
      O.getOrUndefined
    ),
    fragment
  );

/** Asserts that the wire codec takes a value, whatever stricter rules might say about it. */
const assertAccepts = <A, I>(schema: S.Codec<A, I>, input: unknown) =>
  assertTrue(pipe(S.decodeUnknownResult(schema)(input), Result.isSuccess));

const property = PropertyApiName.make;
const structField = StructFieldApiName.make;

// -----------------------------------------------------------------------------
// Wire fixtures transcribed from the OSDK test stubs
// (packages/shared.test/src/stubs: objectTypeV2.ts, linkTypes.ts, objectTypesWithLinkTypes.ts,
// complexImplementationTypes.ts)
// -----------------------------------------------------------------------------

const employeeWire: typeof ObjectType.Encoded = {
  apiName: "Employee",
  displayName: "Employee",
  pluralDisplayName: "Employees",
  aliases: [],
  datasources: [],
  icon: { type: "blueprint", color: "blue", name: "person" },
  description: "A full-time or part-time \n\n employee of our firm",
  primaryKey: "employeeId",
  titleProperty: "fullName",
  visibility: "NORMAL",
  properties: {
    employeeId: {
      dataType: { type: "integer" },
      rid: "rid",
      typeClasses: [],
    },
    fullName: {
      dataType: { type: "string" },
      rid: "rid",
      typeClasses: [],
    },
    office: {
      description: 'The unique "ID" of the employee\'s \\"primary\\" assigned office.\n This is some more text.',
      dataType: { type: "string" },
      rid: "rid",
      typeClasses: [],
    },
    class: {
      description: "",
      dataType: { type: "string" },
      rid: "rid",
      typeClasses: [],
    },
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
    skillSet: {
      description: "The skills of the employee",
      dataType: { type: "string" },
      rid: "rid",
      typeClasses: [],
    },
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
      dataType: {
        type: "array",
        subType: { type: "double" },
        reducers: [{ direction: "DESCENDING_NULLS_LAST" }],
      },
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
  },
  rid: "ri.ontology.main.object-type.401ac022-89eb-4591-8b7e-0a912b9efb44",
  status: "ACTIVE",
};

const officeWire: typeof ObjectType.Encoded = {
  apiName: "Office",
  displayName: "Office",
  pluralDisplayName: "Office",
  aliases: [],
  datasources: [],
  icon: { type: "blueprint", color: "blue", name: "office" },
  description: "A office in our Company",
  primaryKey: "officeId",
  titleProperty: "officeId",
  properties: {
    officeId: {
      dataType: { type: "string" },
      rid: "rid",
      typeClasses: [],
    },
    entrance: {
      dataType: { type: "geopoint" },
      rid: "rid",
      typeClasses: [],
    },
    occupiedArea: {
      description: "The occupied area of the Office",
      dataType: { type: "geoshape" },
      rid: "rid",
      typeClasses: [],
    },
    name: {
      description: "The Name of the Office",
      dataType: { type: "string" },
      rid: "rid",
      typeClasses: [],
    },
    capacity: {
      description: "The capacity of the Office",
      dataType: { type: "integer" },
      rid: "rid",
      typeClasses: [],
    },
  },
  rid: "ri.ontology.main.object-type.404ac022-89eb-4591-8b7e-1a912b9efb45",
  status: "ACTIVE",
};

const peepsWire: typeof LinkTypeSide.Encoded = {
  apiName: "peeps",
  status: "EXPERIMENTAL",
  objectTypeApiName: "Employee",
  cardinality: "MANY",
  displayName: "Peeps",
  linkTypeRid: "rid.link-type.327",
};

const leadWire: typeof LinkTypeSide.Encoded = {
  apiName: "lead",
  status: "EXPERIMENTAL",
  objectTypeApiName: "Employee",
  cardinality: "ONE",
  displayName: "Lead",
  linkTypeRid: "rid.link-type.327",
  foreignKeyPropertyApiName: "leadId",
};

const officeLinkWire: typeof LinkTypeSide.Encoded = {
  apiName: "officeLink",
  status: "EXPERIMENTAL",
  objectTypeApiName: "Office",
  cardinality: "ONE",
  displayName: "Office",
  linkTypeRid: "rid.link-type.324",
  foreignKeyPropertyApiName: "office",
};

const visitedOfficesWire: typeof LinkTypeSide.Encoded = {
  apiName: "visitedOffices",
  status: "EXPERIMENTAL",
  objectTypeApiName: "Office",
  cardinality: "MANY",
  displayName: "Visited Offices",
  linkTypeRid: "ri.a.b.c.visitedOffices",
};

const employeeDefinitionWire: typeof ObjectTypeDefinition.Encoded = {
  objectType: employeeWire,
  linkTypes: [peepsWire, leadWire, officeLinkWire, visitedOfficesWire],
  implementsInterfaces: ["FooInterface"],
  implementsInterfaces2: {
    FooInterface: {
      properties: { fooSpt: "fullName" },
      propertiesV2: {
        fooSpt: { type: "localPropertyImplementation", propertyApiName: "fullName" },
        fooIdp: { type: "localPropertyImplementation", propertyApiName: "office" },
      },
      links: {},
      actionTypes: {},
    },
  },
  sharedPropertyTypeMapping: { fooSpt: "fullName" },
};

const complexImplementationWire: typeof InterfaceImplementation.Encoded = {
  properties: {},
  propertiesV2: {
    iLocal: { type: "localPropertyImplementation", propertyApiName: "localValue" },
    iStructField: {
      type: "structFieldImplementation",
      structFieldOfProperty: { propertyApiName: "nestedStruct", structFieldApiName: "label" },
    },
    iStruct: {
      type: "structImplementation",
      mapping: {
        theAlpha: { type: "structFieldOfProperty", propertyApiName: "multiStruct", structFieldApiName: "alpha" },
        theBeta: { type: "structFieldOfProperty", propertyApiName: "multiStruct", structFieldApiName: "beta" },
      },
    },
    iReduced: {
      type: "reducedPropertyImplementation",
      implementation: { type: "localPropertyImplementation", propertyApiName: "arrayValue" },
    },
  },
  links: {},
  actionTypes: {},
};

const stringProperty = PropertyDefinition.make({ dataType: StringType.make({}), rid: PropertyTypeRid.make("rid") });
const describedProperty = (definition: PropertyDefinition, description: string) =>
  PropertyDefinition.make({ ...definition, description: O.some(description) });

// -----------------------------------------------------------------------------
// Laws
// -----------------------------------------------------------------------------

lawsOf("LinkCardinality", LinkCardinality);
lawsOf("LinkTypeSide", LinkTypeSide);

lawsOf("DatasourceRid", DatasourceRid);
lawsOf("DatasourceBranchId", DatasourceBranchId);
lawsOf("DatasetRid", DatasetRid);
lawsOf("TableRid", TableRid);
lawsOf("StreamRid", StreamRid);
lawsOf("RestrictedViewRid", RestrictedViewRid);
lawsOf("DirectSourceRid", DirectSourceRid);
lawsOf("ColumnName", ColumnName);
lawsOf("ColumnFieldName", ColumnFieldName);
lawsOf("InterfaceActionConstraintApiName", InterfaceActionConstraintApiName);

lawsOf("ColumnPropertyMapping", ColumnPropertyMapping);
lawsOf("StructFieldPropertyMapping", StructFieldPropertyMapping);
lawsOf("StructPropertyMapping", StructPropertyMapping);
lawsOf("EditOnlyPropertyMapping", EditOnlyPropertyMapping);
lawsOf("PropertyMapping", PropertyMapping);

lawsOf("DatasetDatasource", DatasetDatasource);
lawsOf("TableDatasource", TableDatasource);
lawsOf("StreamDatasource", StreamDatasource);
lawsOf("RestrictedViewDatasource", RestrictedViewDatasource);
lawsOf("DirectDatasource", DirectDatasource);
lawsOf("TimeSeriesDatasource", TimeSeriesDatasource);
lawsOf("GeotimeSeriesDatasource", GeotimeSeriesDatasource);
lawsOf("MediaSetViewDatasource", MediaSetViewDatasource);
lawsOf("UnsupportedDatasource", UnsupportedDatasource);
lawsOf("EditsOnlyDatasource", EditsOnlyDatasource);
lawsOf("DatasourceDefinition", DatasourceDefinition);
lawsOf("ObjectTypeDatasource", ObjectTypeDatasource);

lawsOf("PropertyStructField", PropertyStructField);
lawsOf("PropertySource", PropertySource);
lawsOf("StructFieldOfPropertySource", StructFieldOfPropertySource);
lawsOf("StructFieldSource", StructFieldSource);
lawsOf("LocalPropertyImplementation", LocalPropertyImplementation);
lawsOf("StructFieldImplementation", StructFieldImplementation);
lawsOf("StructImplementation", StructImplementation);
lawsOf("UnreducedInterfacePropertyImplementation", UnreducedInterfacePropertyImplementation);
lawsOf("ReducedPropertyImplementation", ReducedPropertyImplementation);
lawsOf("InterfacePropertyImplementation", InterfacePropertyImplementation);
lawsOf("InterfaceImplementation", InterfaceImplementation);

lawsOf("ObjectType", ObjectType, 30);
lawsOf("ObjectTypeDefinition", ObjectTypeDefinition, 30);

lawsOf("ReservedKeyword", ReservedKeyword);
lawsOf("authored object type API name", S.String.check(ObjectTypeApiNameChecks));
lawsOf("authored property API name", S.String.check(PropertyApiNameChecks));
lawsOf("authored link API name", S.String.check(LinkApiNameChecks));
lawsOf("authored interface API name", S.String.check(InterfaceApiNameChecks));
lawsOf("authored display name", S.String.check(DisplayNameChecks));
lawsOf("authored property display name", S.String.check(PropertyDisplayNameChecks));
lawsOf("authored description", S.String.check(DescriptionChecks));

// -----------------------------------------------------------------------------
// Link types
// -----------------------------------------------------------------------------

describe("LinkCardinality", () => {
  it.effect(
    "maps the wire's ONE and MANY to the domain literals and back",
    Effect.fnUntraced(function* () {
      deepStrictEqual(A.fromIterable(LinkCardinality.Pairs), [
        ["ONE", "one"],
        ["MANY", "many"],
      ]);
      const decoded = yield* Effect.forEach(["ONE", "MANY"], (wire) => S.decodeUnknownEffect(LinkCardinality)(wire));
      deepStrictEqual(decoded, ["one", "many"]);
      const encoded = yield* Effect.forEach(decoded, (cardinality) => S.encodeEffect(LinkCardinality)(cardinality));
      deepStrictEqual(encoded, ["ONE", "MANY"]);
    })
  );

  it("matches exhaustively on the domain literal and guards it, not the wire literal", () => {
    const reachesSeveral = LinkCardinality.To.match({ one: () => false, many: () => true });
    deepStrictEqual(
      A.map(LinkCardinality.Pairs, ([, cardinality]) => reachesSeveral(cardinality)),
      [false, true]
    );
    strictEqual(LinkCardinality.Enum.MANY, "many");
    strictEqual(LinkCardinality.To.Enum.many, "MANY");
    assertTrue(S.is(LinkCardinality)("many"));
    assertFalse(S.is(LinkCardinality)("MANY"));
  });

  it("rejects a cardinality outside the domain", () => {
    assertRejects(LinkCardinality, "FEW", "LinkCardinality");
    assertRejects(LinkCardinality, "one", "LinkCardinality");
  });
});

describe("LinkTypeSide", () => {
  wireFixture(
    "decodes and re-encodes a to-many side without a foreign key",
    LinkTypeSide,
    peepsWire,
    LinkTypeSide.make({
      apiName: LinkTypeApiName.make("peeps"),
      displayName: "Peeps",
      status: "experimental",
      targetObjectType: ObjectTypeApiName.make("Employee"),
      cardinality: "many",
      linkTypeRid: LinkTypeRid.make("rid.link-type.327"),
    })
  );

  wireFixture(
    "decodes and re-encodes a to-one side that follows a foreign key",
    LinkTypeSide,
    leadWire,
    LinkTypeSide.make({
      apiName: LinkTypeApiName.make("lead"),
      displayName: "Lead",
      status: "experimental",
      targetObjectType: ObjectTypeApiName.make("Employee"),
      cardinality: "one",
      foreignKeyProperty: O.some(property("leadId")),
      linkTypeRid: LinkTypeRid.make("rid.link-type.327"),
    })
  );

  it.effect(
    "defaults the foreign key to none when constructed, and leaves its key off the wire",
    Effect.fnUntraced(function* () {
      const side = LinkTypeSide.make({
        apiName: LinkTypeApiName.make("visitedOffices"),
        displayName: "Visited Offices",
        status: "experimental",
        targetObjectType: ObjectTypeApiName.make("Office"),
        cardinality: "many",
        linkTypeRid: LinkTypeRid.make("ri.a.b.c.visitedOffices"),
      });
      assertNone(side.foreignKeyProperty);
      const encoded = yield* S.encodeEffect(LinkTypeSide)(side);
      deepStrictEqual(encoded, visitedOfficesWire);
    })
  );

  it("rejects a side with a missing or empty name, an unknown status or no target", () => {
    assertRejects(LinkTypeSide, { ...peepsWire, apiName: "" }, "length of at least 1");
    assertRejects(LinkTypeSide, { ...peepsWire, status: "RETIRED" }, "ReleaseStatus");
    assertRejects(LinkTypeSide, { ...peepsWire, cardinality: "FEW" }, "LinkCardinality");
    assertRejects(
      LinkTypeSide,
      {
        apiName: "peeps",
        status: "EXPERIMENTAL",
        cardinality: "MANY",
        displayName: "Peeps",
        linkTypeRid: "rid.link-type.327",
      },
      "Missing key"
    );
  });

  it("does not read the domain key names from the wire", () => {
    assertRejects(
      LinkTypeSide,
      {
        apiName: "peeps",
        status: "EXPERIMENTAL",
        targetObjectType: "Employee",
        cardinality: "MANY",
        displayName: "Peeps",
        linkTypeRid: "rid.link-type.327",
      },
      "Missing key"
    );
  });
});

// -----------------------------------------------------------------------------
// Property mappings and datasources
// -----------------------------------------------------------------------------

describe("PropertyMapping", () => {
  wireFixture(
    "decodes and re-encodes a column mapping",
    PropertyMapping,
    { type: "column", column: "employee_id" },
    PropertyMapping.cases.column.make({ column: ColumnName.make("employee_id") })
  );

  wireFixture(
    "decodes and re-encodes a struct mapping, field by field",
    PropertyMapping,
    {
      type: "struct",
      column: "profile",
      fields: { bio_text: { apiName: "bio" }, years: { apiName: "yearsExperience" } },
    },
    PropertyMapping.cases.struct.make({
      column: ColumnName.make("profile"),
      fields: R.fromEntries([
        [ColumnFieldName.make("bio_text"), StructFieldPropertyMapping.make({ apiName: structField("bio") })],
        [ColumnFieldName.make("years"), StructFieldPropertyMapping.make({ apiName: structField("yearsExperience") })],
      ]),
    })
  );

  wireFixture(
    "decodes and re-encodes an edit-only mapping",
    PropertyMapping,
    { type: "editOnly" },
    PropertyMapping.cases.editOnly.make({})
  );

  it("is a union of exactly the wire's three cases, each constructible, guarded and matched", () => {
    deepStrictEqual(R.keys(PropertyMapping.cases), ["column", "struct", "editOnly"]);
    const mappings = [
      PropertyMapping.cases.column.make({ column: ColumnName.make("a") }),
      PropertyMapping.cases.struct.make({ column: ColumnName.make("b") }),
      PropertyMapping.cases.editOnly.make({}),
    ];
    const describeMapping = PropertyMapping.match({
      column: ({ column }) => `column:${column}`,
      struct: ({ column, fields }) => `struct:${column}:${R.size(fields)}`,
      editOnly: () => "editOnly",
    });
    deepStrictEqual(A.map(mappings, describeMapping), ["column:a", "struct:b:0", "editOnly"]);
    assertTrue(PropertyMapping.guards.column(mappings[0]));
    assertTrue(PropertyMapping.guards.struct(mappings[1]));
    assertTrue(PropertyMapping.guards.editOnly(mappings[2]));
    deepStrictEqual(A.map(mappings, PropertyMapping.isAnyOf(["column", "struct"])), [true, true, false]);
  });

  it("rejects an unknown mapping kind, a missing column and an empty column name", () => {
    assertRejects(PropertyMapping, { type: "formula", column: "a" }, "PropertyMapping");
    assertRejects(PropertyMapping, { type: "column" }, "Missing key");
    assertRejects(PropertyMapping, { type: "column", column: "" }, "length of at least 1");
    assertRejects(PropertyMapping, { type: "struct", column: "a" }, "Missing key");
  });
});

describe("DatasourceDefinition", () => {
  const employeeIdColumn: typeof PropertyMapping.Encoded = { type: "column", column: "employee_id" };
  const employeeIdMapping = R.fromEntries([
    [property("employeeId"), PropertyMapping.cases.column.make({ column: ColumnName.make("employee_id") })],
  ]);

  wireFixture(
    "decodes and re-encodes a dataset on a branch",
    DatasourceDefinition,
    {
      type: "dataset",
      datasetRid: "ri.foundry.main.dataset.employees",
      branch: "master",
      propertyMapping: { employeeId: employeeIdColumn },
    },
    DatasourceDefinition.cases.dataset.make({
      datasetRid: DatasetRid.make("ri.foundry.main.dataset.employees"),
      branch: O.some(DatasourceBranchId.make("master")),
      propertyMapping: employeeIdMapping,
    })
  );

  wireFixture(
    "decodes and re-encodes a table without a branch",
    DatasourceDefinition,
    { type: "table", tableRid: "ri.tables.main.table.employees", propertyMapping: { employeeId: employeeIdColumn } },
    DatasourceDefinition.cases.table.make({
      tableRid: TableRid.make("ri.tables.main.table.employees"),
      propertyMapping: employeeIdMapping,
    })
  );

  wireFixture(
    "decodes and re-encodes a stream",
    DatasourceDefinition,
    {
      type: "stream",
      streamRid: "ri.foundry-streaming.main.stream.badges",
      branch: "develop",
      propertyMapping: { employeeId: employeeIdColumn },
    },
    DatasourceDefinition.cases.stream.make({
      streamRid: StreamRid.make("ri.foundry-streaming.main.stream.badges"),
      branch: O.some(DatasourceBranchId.make("develop")),
      propertyMapping: employeeIdMapping,
    })
  );

  wireFixture(
    "decodes and re-encodes a restricted view",
    DatasourceDefinition,
    {
      type: "restrictedView",
      restrictedViewRid: "ri.gps.main.view.employees",
      propertyMapping: { employeeId: employeeIdColumn, salary: { type: "editOnly" } },
    },
    DatasourceDefinition.cases.restrictedView.make({
      restrictedViewRid: RestrictedViewRid.make("ri.gps.main.view.employees"),
      propertyMapping: R.fromEntries([
        [property("employeeId"), PropertyMapping.cases.column.make({ column: ColumnName.make("employee_id") })],
        [property("salary"), PropertyMapping.cases.editOnly.make({})],
      ]),
    })
  );

  wireFixture(
    "decodes and re-encodes a direct-write source",
    DatasourceDefinition,
    {
      type: "direct",
      directSourceRid: "ri.ontology.main.direct-source.employees",
      propertyMapping: { employeeId: employeeIdColumn },
    },
    DatasourceDefinition.cases.direct.make({
      directSourceRid: DirectSourceRid.make("ri.ontology.main.direct-source.employees"),
      propertyMapping: employeeIdMapping,
    })
  );

  wireFixture(
    "decodes and re-encodes a time series sync",
    DatasourceDefinition,
    {
      type: "timeSeries",
      timeSeriesSyncRid: "ri.time-series-catalog.main.sync.status",
      properties: ["employeeStatus", "employeeSensor"],
    },
    DatasourceDefinition.cases.timeSeries.make({
      timeSeriesSyncRid: TimeSeriesSyncRid.make("ri.time-series-catalog.main.sync.status"),
      properties: [property("employeeStatus"), property("employeeSensor")],
    })
  );

  wireFixture(
    "decodes and re-encodes a geotime series integration",
    DatasourceDefinition,
    {
      type: "geotimeSeries",
      geotimeSeriesIntegrationRid: "ri.geotime-catalog.main.integration.locations",
      properties: ["employeeLocation"],
    },
    DatasourceDefinition.cases.geotimeSeries.make({
      geotimeSeriesIntegrationRid: GeotimeSeriesIntegrationRid.make("ri.geotime-catalog.main.integration.locations"),
      properties: [property("employeeLocation")],
    })
  );

  wireFixture(
    "decodes and re-encodes a media set view",
    DatasourceDefinition,
    {
      type: "mediaSetView",
      mediaSetRid: "ri.mio.main.media-set.badges",
      mediaSetViewRid: "ri.mio.main.view.badges",
      properties: ["badgePhoto"],
    },
    DatasourceDefinition.cases.mediaSetView.make({
      mediaSetRid: MediaSetRid.make("ri.mio.main.media-set.badges"),
      mediaSetViewRid: MediaSetViewRid.make("ri.mio.main.view.badges"),
      properties: [property("badgePhoto")],
    })
  );

  wireFixture(
    "decodes and re-encodes an unsupported source by name",
    DatasourceDefinition,
    { type: "unsupported", unsupportedType: "derived", properties: ["tenure"] },
    DatasourceDefinition.cases.unsupported.make({ unsupportedType: "derived", properties: [property("tenure")] })
  );

  wireFixture(
    "decodes and re-encodes the marker for an object type with no source",
    DatasourceDefinition,
    { type: "editsOnly" },
    DatasourceDefinition.cases.editsOnly.make({})
  );

  wireFixture(
    "decodes and re-encodes a datasource with its identifier",
    ObjectTypeDatasource,
    {
      rid: "ri.ontology.main.datasource.0a1b",
      definition: {
        type: "dataset",
        datasetRid: "ri.foundry.main.dataset.employees",
        propertyMapping: { employeeId: employeeIdColumn },
      },
    },
    ObjectTypeDatasource.make({
      rid: DatasourceRid.make("ri.ontology.main.datasource.0a1b"),
      definition: DatasourceDefinition.cases.dataset.make({
        datasetRid: DatasetRid.make("ri.foundry.main.dataset.employees"),
        propertyMapping: employeeIdMapping,
      }),
    })
  );

  it("is a union of exactly the wire's ten cases, matched exhaustively by family", () => {
    deepStrictEqual(R.keys(DatasourceDefinition.cases), [
      "dataset",
      "table",
      "stream",
      "restrictedView",
      "direct",
      "timeSeries",
      "geotimeSeries",
      "mediaSetView",
      "unsupported",
      "editsOnly",
    ]);
    strictEqual(DatasourceDefinition.members.length, 10);
    const definitions = [
      DatasourceDefinition.cases.dataset.make({ datasetRid: DatasetRid.make("d") }),
      DatasourceDefinition.cases.table.make({ tableRid: TableRid.make("t") }),
      DatasourceDefinition.cases.stream.make({ streamRid: StreamRid.make("s") }),
      DatasourceDefinition.cases.restrictedView.make({ restrictedViewRid: RestrictedViewRid.make("v") }),
      DatasourceDefinition.cases.direct.make({ directSourceRid: DirectSourceRid.make("w") }),
      DatasourceDefinition.cases.timeSeries.make({ timeSeriesSyncRid: TimeSeriesSyncRid.make("y") }),
      DatasourceDefinition.cases.geotimeSeries.make({
        geotimeSeriesIntegrationRid: GeotimeSeriesIntegrationRid.make("g"),
      }),
      DatasourceDefinition.cases.mediaSetView.make({
        mediaSetRid: MediaSetRid.make("m"),
        mediaSetViewRid: MediaSetViewRid.make("mv"),
      }),
      DatasourceDefinition.cases.unsupported.make({ unsupportedType: "derived" }),
      DatasourceDefinition.cases.editsOnly.make({}),
    ];
    const backedCount = DatasourceDefinition.match({
      dataset: ({ propertyMapping }) => R.size(propertyMapping),
      table: ({ propertyMapping }) => R.size(propertyMapping),
      stream: ({ propertyMapping }) => R.size(propertyMapping),
      restrictedView: ({ propertyMapping }) => R.size(propertyMapping),
      direct: ({ propertyMapping }) => R.size(propertyMapping),
      timeSeries: ({ properties }) => properties.length,
      geotimeSeries: ({ properties }) => properties.length,
      mediaSetView: ({ properties }) => properties.length,
      unsupported: ({ properties }) => properties.length,
      editsOnly: () => 0,
    });
    deepStrictEqual(A.map(definitions, backedCount), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    deepStrictEqual(
      A.map(definitions, (definition) => definition.type),
      R.keys(DatasourceDefinition.cases)
    );
    const isTabular = DatasourceDefinition.isAnyOf(["dataset", "table", "stream", "restrictedView", "direct"]);
    deepStrictEqual(A.map(definitions, isTabular), [true, true, true, true, true, false, false, false, false, false]);
    assertTrue(DatasourceDefinition.guards.editsOnly(definitions[9]));
    assertFalse(DatasourceDefinition.guards.editsOnly(definitions[0]));
  });

  it.effect(
    "defaults an empty mapping and no branch when constructed, yet keeps the mapping key on the wire",
    Effect.fnUntraced(function* () {
      const dataset = DatasetDatasource.make({ datasetRid: DatasetRid.make("ri.foundry.main.dataset.employees") });
      assertNone(dataset.branch);
      deepStrictEqual(dataset.propertyMapping, {});
      const encoded = yield* S.encodeEffect(DatasetDatasource)(dataset);
      deepStrictEqual(encoded, {
        type: "dataset",
        datasetRid: "ri.foundry.main.dataset.employees",
        propertyMapping: {},
      });
    })
  );

  it("rejects an unknown kind and a source that omits what the wire requires", () => {
    assertRejects(DatasourceDefinition, { type: "derived", properties: [] }, "DatasourceDefinition");
    assertRejects(DatasourceDefinition, { type: "dataset", datasetRid: "ri.foundry.main.dataset.x" }, "Missing key");
    assertRejects(
      DatasourceDefinition,
      { type: "dataset", datasetRid: "", propertyMapping: {} },
      "length of at least 1"
    );
    assertRejects(DatasourceDefinition, { type: "timeSeries", timeSeriesSyncRid: "ri.sync" }, "Missing key");
    assertRejects(ObjectTypeDatasource, { definition: { type: "editsOnly" } }, "Missing key");
  });
});

// -----------------------------------------------------------------------------
// Interface implementations
// -----------------------------------------------------------------------------

describe("InterfacePropertyImplementation", () => {
  const localValue = LocalPropertyImplementation.make({ propertyApiName: property("localValue") });
  const label = StructFieldImplementation.make({
    structFieldOfProperty: PropertyStructField.make({
      propertyApiName: property("nestedStruct"),
      structFieldApiName: structField("label"),
    }),
  });
  const assembled = StructImplementation.make({
    mapping: R.fromEntries([
      [
        structField("theAlpha"),
        StructFieldOfPropertySource.make({
          propertyApiName: property("multiStruct"),
          structFieldApiName: structField("alpha"),
        }),
      ],
      [
        structField("theBeta"),
        StructFieldOfPropertySource.make({
          propertyApiName: property("multiStruct"),
          structFieldApiName: structField("beta"),
        }),
      ],
    ]),
  });
  const reduced = ReducedPropertyImplementation.make({
    implementation: LocalPropertyImplementation.make({ propertyApiName: property("arrayValue") }),
  });

  wireFixture(
    "decodes and re-encodes an implementation that uses all four ways",
    InterfaceImplementation,
    complexImplementationWire,
    InterfaceImplementation.make({
      propertyImplementations: R.fromEntries([
        [InterfacePropertyApiName.make("iLocal"), localValue],
        [InterfacePropertyApiName.make("iStructField"), label],
        [InterfacePropertyApiName.make("iStruct"), assembled],
        [InterfacePropertyApiName.make("iReduced"), reduced],
      ]),
    })
  );

  wireFixture(
    "decodes and re-encodes an implementation that names its interface, its links and its actions",
    InterfaceImplementation,
    {
      apiName: "FooInterface",
      rid: "ri.ontology.main.interface.foo",
      properties: { fooSpt: "fullName" },
      propertiesV2: { fooSpt: { type: "localPropertyImplementation", propertyApiName: "fullName" } },
      links: { toBar: ["peeps", "lead"] },
      actionTypes: { promote: "promote-employee" },
    },
    InterfaceImplementation.make({
      apiName: O.some(InterfaceTypeApiName.make("FooInterface")),
      rid: O.some(InterfaceTypeRid.make("ri.ontology.main.interface.foo")),
      sharedPropertyTypeMapping: R.fromEntries([[SharedPropertyTypeApiName.make("fooSpt"), property("fullName")]]),
      propertyImplementations: R.fromEntries([
        [
          InterfacePropertyApiName.make("fooSpt"),
          LocalPropertyImplementation.make({ propertyApiName: property("fullName") }),
        ],
      ]),
      links: R.fromEntries([
        [InterfaceLinkTypeApiName.make("toBar"), [LinkTypeApiName.make("peeps"), LinkTypeApiName.make("lead")]],
      ]),
      actionTypes: R.fromEntries([
        [InterfaceActionConstraintApiName.make("promote"), ActionTypeApiName.make("promote-employee")],
      ]),
    })
  );

  wireFixture(
    "decodes and re-encodes a struct field taken from a whole property",
    StructFieldSource,
    { type: "property", propertyApiName: "nickname" },
    StructFieldSource.cases.property.make({ propertyApiName: property("nickname") })
  );

  it("is a union of exactly the wire's four cases, each constructible, guarded and matched", () => {
    deepStrictEqual(R.keys(InterfacePropertyImplementation.cases), [
      "localPropertyImplementation",
      "structFieldImplementation",
      "structImplementation",
      "reducedPropertyImplementation",
    ]);
    const implementations = [
      InterfacePropertyImplementation.cases.localPropertyImplementation.make({
        propertyApiName: property("localValue"),
      }),
      InterfacePropertyImplementation.cases.structFieldImplementation.make({
        structFieldOfProperty: label.structFieldOfProperty,
      }),
      InterfacePropertyImplementation.cases.structImplementation.make({ mapping: assembled.mapping }),
      InterfacePropertyImplementation.cases.reducedPropertyImplementation.make({ implementation: localValue }),
    ];
    const describeImplementation = InterfacePropertyImplementation.match({
      localPropertyImplementation: ({ propertyApiName }) => `local:${propertyApiName}`,
      structFieldImplementation: ({ structFieldOfProperty }) =>
        `field:${structFieldOfProperty.propertyApiName}.${structFieldOfProperty.structFieldApiName}`,
      structImplementation: ({ mapping }) => `struct:${R.size(mapping)}`,
      reducedPropertyImplementation: ({ implementation }) => `reduced:${implementation.type}`,
    });
    deepStrictEqual(A.map(implementations, describeImplementation), [
      "local:localValue",
      "field:nestedStruct.label",
      "struct:2",
      "reduced:localPropertyImplementation",
    ]);
    assertTrue(InterfacePropertyImplementation.guards.localPropertyImplementation(implementations[0]));
    assertTrue(InterfacePropertyImplementation.guards.structFieldImplementation(implementations[1]));
    assertTrue(InterfacePropertyImplementation.guards.structImplementation(implementations[2]));
    assertTrue(InterfacePropertyImplementation.guards.reducedPropertyImplementation(implementations[3]));
    deepStrictEqual(
      A.map(implementations, InterfacePropertyImplementation.isAnyOf(["reducedPropertyImplementation"])),
      [false, false, false, true]
    );
  });

  it("keeps the unreduced union to the three cases a reduction may wrap", () => {
    deepStrictEqual(R.keys(UnreducedInterfacePropertyImplementation.cases), [
      "localPropertyImplementation",
      "structFieldImplementation",
      "structImplementation",
    ]);
    const base = UnreducedInterfacePropertyImplementation.match({
      localPropertyImplementation: () => "property",
      structFieldImplementation: () => "struct field",
      structImplementation: () => "struct",
    });
    deepStrictEqual(A.map([localValue, label, assembled], base), ["property", "struct field", "struct"]);
    assertTrue(S.is(UnreducedInterfacePropertyImplementation)(assembled));
    assertFalse(S.is(UnreducedInterfacePropertyImplementation)(reduced));
  });

  it("matches both sources of an interface struct field", () => {
    deepStrictEqual(R.keys(StructFieldSource.cases), ["property", "structFieldOfProperty"]);
    const sources = [
      StructFieldSource.cases.property.make({ propertyApiName: property("nickname") }),
      StructFieldSource.cases.structFieldOfProperty.make({
        propertyApiName: property("multiStruct"),
        structFieldApiName: structField("alpha"),
      }),
    ];
    const path = StructFieldSource.match({
      property: ({ propertyApiName }) => `${propertyApiName}`,
      structFieldOfProperty: ({ propertyApiName, structFieldApiName }) => `${propertyApiName}.${structFieldApiName}`,
    });
    deepStrictEqual(A.map(sources, path), ["nickname", "multiStruct.alpha"]);
    assertTrue(StructFieldSource.guards.property(sources[0]));
    assertTrue(StructFieldSource.guards.structFieldOfProperty(sources[1]));
    assertTrue(PropertySource.make({ propertyApiName: property("nickname") }).type === "property");
  });

  it("rejects a reduction of a reduction, which the wire forbids", () => {
    assertRejects(
      InterfacePropertyImplementation,
      {
        type: "reducedPropertyImplementation",
        implementation: {
          type: "reducedPropertyImplementation",
          implementation: { type: "localPropertyImplementation", propertyApiName: "arrayValue" },
        },
      },
      "UnreducedInterfacePropertyImplementation"
    );
  });

  it("rejects an unknown way of implementing, a missing property name and a record of the wrong shape", () => {
    assertRejects(
      InterfacePropertyImplementation,
      { type: "computedImplementation", propertyApiName: "a" },
      "InterfacePropertyImplementation"
    );
    assertRejects(InterfacePropertyImplementation, { type: "localPropertyImplementation" }, "Missing key");
    assertRejects(InterfaceImplementation, { properties: {}, propertiesV2: [], links: {} }, `["propertiesV2"]`);
    assertRejects(InterfaceImplementation, { properties: {}, propertiesV2: {}, links: null }, `["links"]`);
  });

  it.effect(
    "reads each of the four records as empty when a saved document omits it, and writes all four back",
    Effect.fnUntraced(function* () {
      // Saved ontology documents leave empty collections out (Conjure semantics); the canonical form writes them.
      const full: typeof InterfaceImplementation.Encoded = {
        properties: { fooSpt: "fullName" },
        propertiesV2: { fooSpt: { type: "localPropertyImplementation", propertyApiName: "fullName" } },
        links: { toBar: ["officeLink"] },
        actionTypes: { promote: "promoteEmployeeObject" },
      };
      yield* Effect.forEach(
        Tuple.make("properties", "propertiesV2", "links", "actionTypes"),
        Effect.fnUntraced(function* (record) {
          const decoded = yield* S.decodeEffect(InterfaceImplementation)(Struct.omit(full, [record]));
          const encoded = yield* S.encodeEffect(InterfaceImplementation)(decoded);
          deepStrictEqual(encoded, { ...full, [record]: {} });
        })
      );
      const bare = yield* S.decodeEffect(InterfaceImplementation)({});
      deepStrictEqual(bare, InterfaceImplementation.make({}));
      const canonical = yield* S.encodeEffect(InterfaceImplementation)(bare);
      deepStrictEqual(canonical, { properties: {}, propertiesV2: {}, links: {}, actionTypes: {} });
    })
  );

  it.effect(
    "defaults every record to empty when constructed, and still writes the four wire keys",
    Effect.fnUntraced(function* () {
      const implementation = InterfaceImplementation.make({});
      assertNone(implementation.apiName);
      assertNone(implementation.rid);
      const encoded = yield* S.encodeEffect(InterfaceImplementation)(implementation);
      deepStrictEqual(encoded, {
        properties: {},
        propertiesV2: {},
        links: {},
        actionTypes: {},
      });
    })
  );

  // osdk-ts packages/e2e.sandbox.peopleapp/ontology.json, `Employee.implementsInterfaces2.Person`: a document
  // saved from a platform that predates the `actionTypes` map carries the other three maps and not that one.
  it.effect(
    "reads an implementation saved before action slots existed, and writes the key back",
    Effect.fnUntraced(function* () {
      const saved: typeof InterfaceImplementation.Encoded = {
        apiName: "Person",
        rid: "ri.ontology.main.interface.353734ce-ae2d-4e49-8070-163b2126af5a",
        properties: { email: "emailPrimaryWork", employeeNumber: "employeeNumber" },
        propertiesV2: {
          email: { type: "localPropertyImplementation", propertyApiName: "emailPrimaryWork" },
          employeeNumber: { type: "localPropertyImplementation", propertyApiName: "employeeNumber" },
        },
        links: { peeps: ["peeps"], office: ["primaryOffice"], lead: ["lead"] },
      };
      const implementation = yield* S.decodeEffect(InterfaceImplementation)(saved);
      deepStrictEqual(implementation.actionTypes, {});
      const encoded = yield* S.encodeEffect(InterfaceImplementation)(implementation);
      deepStrictEqual(encoded, { ...saved, actionTypes: {} });
    })
  );
});

// -----------------------------------------------------------------------------
// Object types
// -----------------------------------------------------------------------------

describe("ObjectType", () => {
  wireFixture(
    "decodes and re-encodes the Office object type",
    ObjectType,
    officeWire,
    ObjectType.make({
      apiName: ObjectTypeApiName.make("Office"),
      displayName: "Office",
      pluralDisplayName: "Office",
      description: O.some("A office in our Company"),
      status: "active",
      icon: Icon.cases.blueprint.make({ color: "blue", name: "office" }),
      rid: ObjectTypeRid.make("ri.ontology.main.object-type.404ac022-89eb-4591-8b7e-1a912b9efb45"),
      primaryKey: property("officeId"),
      titleProperty: property("officeId"),
      properties: R.fromEntries([
        [property("officeId"), stringProperty],
        [
          property("entrance"),
          PropertyDefinition.make({
            dataType: { type: "geopoint" },
            rid: PropertyTypeRid.make("rid"),
          }),
        ],
        [
          property("occupiedArea"),
          PropertyDefinition.make({
            dataType: { type: "geoshape" },
            rid: PropertyTypeRid.make("rid"),
            description: O.some("The occupied area of the Office"),
          }),
        ],
        [property("name"), describedProperty(stringProperty, "The Name of the Office")],
        [
          property("capacity"),
          PropertyDefinition.make({
            dataType: IntegerType.make({}),
            rid: PropertyTypeRid.make("rid"),
            description: O.some("The capacity of the Office"),
          }),
        ],
      ]),
    })
  );

  it.effect(
    "decodes the Employee object type into the domain and re-encodes it to the same wire value",
    Effect.fnUntraced(function* () {
      const employee = yield* S.decodeEffect(ObjectType)(employeeWire);

      strictEqual(employee.apiName, "Employee");
      strictEqual(employee.status, "active");
      assertSome(employee.visibility, "normal");
      assertSome(employee.description, "A full-time or part-time \n\n employee of our firm");
      deepStrictEqual(employee.icon, Icon.cases.blueprint.make({ color: "blue", name: "person" }));
      strictEqual(R.size(employee.properties), 14);
      deepStrictEqual(employee.aliases, []);
      deepStrictEqual(employee.datasources, []);

      assertSome(
        ObjectType.primaryKeyDefinition(employee),
        PropertyDefinition.make({ dataType: IntegerType.make({}), rid: PropertyTypeRid.make("rid") })
      );
      assertSome(ObjectType.titleDefinition(employee), stringProperty);
      assertSome(ObjectType.property(employee, property("class")), describedProperty(stringProperty, ""));
      assertSome(
        ObjectType.property(employee, property("skillSetEmbedding")),
        PropertyDefinition.make({
          description: O.some("Vectorized skill set"),
          dataType: VectorType.make({
            dimension: 1536,
            supportsSearchWith: ["cosine"],
            embeddingModel: O.some(HostedEmbedding.make({ model: "openAiTextEmbeddingAda002" })),
          }),
          rid: PropertyTypeRid.make("rid"),
        })
      );
      assertSome(
        pipe(employee, ObjectType.property(property("performanceScores"))),
        PropertyDefinition.make({
          description: O.some("Array of performance scores with reducers"),
          dataType: ArrayType.make({
            elementType: { type: "double" },
            reducers: [ArrayReducer.make({ direction: "descendingNullsLast" })],
          }),
          rid: PropertyTypeRid.make("rid"),
        })
      );
      assertNone(ObjectType.property(employee, property("salary")));

      const encoded = yield* S.encodeEffect(ObjectType)(employee);
      deepStrictEqual(encoded, employeeWire);
    })
  );

  it.effect(
    "fills arrays the wire left out, so the canonical encoding has them empty",
    Effect.fnUntraced(function* () {
      // Transcribed from `objectTypeWithTimestampPrimaryKey`, with every defaulted array removed.
      const sparse: typeof ObjectType.Encoded = {
        apiName: "ObjectWithTimestampPrimaryKey",
        displayName: "ObjectWithTimestampPrimaryKey",
        pluralDisplayName: "ObjectWithTimestampPrimaryKeys",
        icon: { type: "blueprint", color: "blue", name: "person" },
        description: "Object Type With Timestamp Primary Key",
        primaryKey: "timestamp",
        titleProperty: "value",
        properties: {
          timestamp: { dataType: { type: "timestamp" }, rid: "rid" },
          value: { dataType: { type: "string" }, rid: "rid" },
          tags: { dataType: { type: "array", subType: { type: "string" } }, rid: "rid" },
        },
        rid: "ri.ontology.main.object-type.32bb9402-9cab-4705-81bb-edb65a4a6806",
        status: "ACTIVE",
      };
      const decoded = yield* S.decodeEffect(ObjectType)(sparse);
      deepStrictEqual(decoded.aliases, []);
      deepStrictEqual(decoded.datasources, []);
      assertNone(decoded.visibility);
      assertSome(
        O.map(ObjectType.primaryKeyDefinition(decoded), (definition) => definition.dataType.type),
        "timestamp"
      );
      const encoded = yield* S.encodeEffect(ObjectType)(decoded);
      deepStrictEqual(encoded, {
        ...sparse,
        aliases: [],
        datasources: [],
        properties: {
          timestamp: { dataType: { type: "timestamp" }, rid: "rid", typeClasses: [] },
          value: { dataType: { type: "string" }, rid: "rid", typeClasses: [] },
          tags: { dataType: { type: "array", subType: { type: "string" }, reducers: [] }, rid: "rid", typeClasses: [] },
        },
      });
    })
  );

  it("defaults the optional fields when constructed", () => {
    const office = ObjectType.make({
      apiName: ObjectTypeApiName.make("Office"),
      displayName: "Office",
      pluralDisplayName: "Offices",
      status: "active",
      icon: Icon.cases.blueprint.make({ color: "blue", name: "office" }),
      rid: ObjectTypeRid.make("ri.ontology.main.object-type.office"),
      primaryKey: property("officeId"),
      titleProperty: property("officeId"),
      properties: R.fromEntries([[property("officeId"), stringProperty]]),
    });
    assertNone(office.description);
    assertNone(office.visibility);
    deepStrictEqual(office.aliases, []);
    deepStrictEqual(office.datasources, []);
    assertTrue(S.is(ObjectType)(office));
  });

  it("rejects a primary key that is not a declared property", () => {
    assertRejects(
      ObjectType,
      { ...officeWire, primaryKey: "buildingId" },
      "The primary key must name a declared property"
    );
  });

  it("rejects a title property that is not a declared property", () => {
    assertRejects(
      ObjectType,
      { ...officeWire, titleProperty: "nickname" },
      "The title property must name a declared property"
    );
  });

  it("rejects a primary key whose type cannot identify an object", () => {
    assertRejects(ObjectType, { ...officeWire, primaryKey: "entrance" }, "The primary key must be a string, integer");
    assertRejects(
      ObjectType,
      { ...employeeWire, primaryKey: "favoriteRestaurants" },
      "The primary key must be a string"
    );
    assertRejects(ObjectType, { ...employeeWire, primaryKey: "employeeProfile" }, "The primary key must be a string");
  });

  it.effect(
    "accepts every primary key kind",
    Effect.fnUntraced(function* () {
      const kinds = yield* Effect.forEach(PrimaryKeyKind.literals, (kind) =>
        S.decodeEffect(ObjectType)({
          ...officeWire,
          properties: { ...officeWire.properties, officeId: { dataType: { type: kind }, rid: "rid" } },
        }).pipe(
          Effect.map(ObjectType.primaryKeyDefinition),
          Effect.map(O.map((definition) => definition.dataType.type))
        )
      );
      deepStrictEqual(A.getSomes(kinds), A.fromIterable(PrimaryKeyKind.literals));
    })
  );

  it("rejects an object type with an empty name, an unknown status or a missing icon", () => {
    assertRejects(ObjectType, { ...officeWire, apiName: "" }, "length of at least 1");
    assertRejects(ObjectType, { ...officeWire, status: "RETIRED" }, "ReleaseStatus");
    assertRejects(ObjectType, { ...officeWire, visibility: "SECRET" }, "Visibility");
    assertRejects(ObjectType, { ...officeWire, primaryKey: "" }, "length of at least 1");
    assertRejects(
      ObjectType,
      {
        apiName: "Office",
        displayName: "Office",
        pluralDisplayName: "Office",
        primaryKey: "officeId",
        titleProperty: "officeId",
        properties: officeWire.properties,
        rid: "ri.ontology.main.object-type.404ac022-89eb-4591-8b7e-1a912b9efb45",
        status: "ACTIVE",
      },
      "Missing key"
    );
  });

  it.effect(
    "drops a property keyed by something that is not a property name, as every record with named keys does",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(ObjectType)({
        ...officeWire,
        properties: { ...officeWire.properties, "": { dataType: { type: "string" }, rid: "rid" } },
      });
      deepStrictEqual(R.keys(decoded.properties), R.keys(officeWire.properties));
      assertRejects(
        S.Struct({ objectType: ObjectType }),
        { objectType: { ...officeWire, primaryKey: "", properties: { "": officeWire.properties.name } } },
        "length of at least 1"
      );
    })
  );

  it("does not take a bare record for an object type", () => {
    assertFalse(S.is(ObjectType)(officeWire));
    assertFalse(S.is(ObjectType)({ ...officeWire, status: "active" }));
  });

  it.effect(
    "generates object types whose keys agree, across key kinds and with distinct titles",
    Effect.fnUntraced(function* () {
      const samples = yield* Arbitrary.sampleEffect(Arbitrary.schema(ObjectType), { count: 60, seed: 20261112 });
      strictEqual(samples.length, 60);
      const keyKinds = A.map(samples, (objectType) =>
        pipe(
          ObjectType.primaryKeyDefinition(objectType),
          O.map((definition) => definition.dataType.type),
          O.filter(S.is(PrimaryKeyKind))
        )
      );
      assertTrue(A.every(keyKinds, O.isSome));
      assertTrue(A.every(samples, (objectType) => O.isSome(ObjectType.titleDefinition(objectType))));
      assertTrue(A.dedupe(A.getSomes(keyKinds)).length > 3);
      assertTrue(A.some(samples, (objectType) => objectType.primaryKey !== objectType.titleProperty));
      assertTrue(A.some(samples, (objectType) => R.size(objectType.properties) > 2));
    })
  );
});

// -----------------------------------------------------------------------------
// Object type definitions
// -----------------------------------------------------------------------------

describe("ObjectTypeDefinition", () => {
  it.effect(
    "decodes the Employee full metadata into the domain and re-encodes it to the same wire value",
    Effect.fnUntraced(function* () {
      const definition = yield* S.decodeEffect(ObjectTypeDefinition)(employeeDefinitionWire);
      const employee = yield* S.decodeEffect(ObjectType)(employeeWire);

      deepStrictEqual(definition.objectType, employee);
      deepStrictEqual(
        A.map(definition.linkTypes, (side) => `${side.apiName}:${side.cardinality}:${side.targetObjectType}`),
        ["peeps:many:Employee", "lead:one:Employee", "officeLink:one:Office", "visitedOffices:many:Office"]
      );
      deepStrictEqual(definition.implementsInterfaces, [InterfaceTypeApiName.make("FooInterface")]);
      deepStrictEqual(
        definition.sharedPropertyTypeMapping,
        R.fromEntries([[SharedPropertyTypeApiName.make("fooSpt"), property("fullName")]])
      );

      assertSome(
        ObjectTypeDefinition.link(definition, LinkTypeApiName.make("officeLink")),
        LinkTypeSide.make({
          apiName: LinkTypeApiName.make("officeLink"),
          displayName: "Office",
          status: "experimental",
          targetObjectType: ObjectTypeApiName.make("Office"),
          cardinality: "one",
          foreignKeyProperty: O.some(property("office")),
          linkTypeRid: LinkTypeRid.make("rid.link-type.324"),
        })
      );
      assertSome(
        pipe(
          definition,
          ObjectTypeDefinition.link(LinkTypeApiName.make("peeps")),
          O.map((side) => side.cardinality)
        ),
        "many"
      );
      assertNone(ObjectTypeDefinition.link(definition, LinkTypeApiName.make("occupants")));

      assertSome(
        ObjectTypeDefinition.interfaceImplementation(definition, InterfaceTypeApiName.make("FooInterface")),
        InterfaceImplementation.make({
          sharedPropertyTypeMapping: R.fromEntries([[SharedPropertyTypeApiName.make("fooSpt"), property("fullName")]]),
          propertyImplementations: R.fromEntries([
            [
              InterfacePropertyApiName.make("fooSpt"),
              LocalPropertyImplementation.make({ propertyApiName: property("fullName") }),
            ],
            [
              InterfacePropertyApiName.make("fooIdp"),
              LocalPropertyImplementation.make({ propertyApiName: property("office") }),
            ],
          ]),
        })
      );
      assertNone(
        pipe(definition, ObjectTypeDefinition.interfaceImplementation(InterfaceTypeApiName.make("BarInterface")))
      );

      const encoded = yield* S.encodeEffect(ObjectTypeDefinition)(definition);
      deepStrictEqual(encoded, employeeDefinitionWire);
    })
  );

  it.effect(
    "keeps a link side whose foreign key is not a declared property, as the platform sends it",
    Effect.fnUntraced(function* () {
      const definition = yield* S.decodeEffect(ObjectTypeDefinition)(employeeDefinitionWire);
      const foreignKey = O.flatMap(
        ObjectTypeDefinition.link(definition, LinkTypeApiName.make("lead")),
        (side) => side.foreignKeyProperty
      );
      assertSome(foreignKey, property("leadId"));
      assertNone(O.flatMap(foreignKey, (name) => ObjectType.property(definition.objectType, name)));
    })
  );

  it.effect(
    "decodes and re-encodes an object type with no links and no interfaces",
    Effect.fnUntraced(function* () {
      const wire: typeof ObjectTypeDefinition.Encoded = {
        objectType: officeWire,
        linkTypes: [],
        implementsInterfaces: [],
        implementsInterfaces2: {},
        sharedPropertyTypeMapping: {},
      };
      const office = yield* S.decodeEffect(ObjectType)(officeWire);
      const decoded = yield* S.decodeEffect(ObjectTypeDefinition)(wire);
      deepStrictEqual(decoded, ObjectTypeDefinition.make({ objectType: office }));
      const encoded = yield* S.encodeEffect(ObjectTypeDefinition)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "reads each of the four collections as empty when a saved document omits it, and writes all four back",
    Effect.fnUntraced(function* () {
      // Saved ontology documents leave empty collections out (Conjure semantics); the canonical form writes them.
      yield* Effect.forEach(
        Tuple.make("linkTypes", "implementsInterfaces"),
        Effect.fnUntraced(function* (collection) {
          const decoded = yield* S.decodeEffect(ObjectTypeDefinition)(Struct.omit(employeeDefinitionWire, [collection]));
          const encoded = yield* S.encodeEffect(ObjectTypeDefinition)(decoded);
          deepStrictEqual(encoded, { ...employeeDefinitionWire, [collection]: [] });
        })
      );
      yield* Effect.forEach(
        Tuple.make("implementsInterfaces2", "sharedPropertyTypeMapping"),
        Effect.fnUntraced(function* (collection) {
          const decoded = yield* S.decodeEffect(ObjectTypeDefinition)(Struct.omit(employeeDefinitionWire, [collection]));
          const encoded = yield* S.encodeEffect(ObjectTypeDefinition)(decoded);
          deepStrictEqual(encoded, { ...employeeDefinitionWire, [collection]: {} });
        })
      );
      const office = yield* S.decodeEffect(ObjectType)(officeWire);
      const bare = yield* S.decodeEffect(ObjectTypeDefinition)({ objectType: officeWire });
      deepStrictEqual(bare, ObjectTypeDefinition.make({ objectType: office }));
      const canonical = yield* S.encodeEffect(ObjectTypeDefinition)(bare);
      deepStrictEqual(canonical, {
        objectType: officeWire,
        linkTypes: [],
        implementsInterfaces: [],
        implementsInterfaces2: {},
        sharedPropertyTypeMapping: {},
      });
    })
  );

  it.effect(
    "does not read the implementations from their domain key name: the wire key is absent, so there are none",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeUnknownEffect(ObjectTypeDefinition)({
        ...Struct.omit(employeeDefinitionWire, ["implementsInterfaces2"]),
        interfaceImplementations: employeeDefinitionWire.implementsInterfaces2,
      });
      deepStrictEqual(decoded.interfaceImplementations, {});
      const encoded = yield* S.encodeEffect(ObjectTypeDefinition)(decoded);
      deepStrictEqual(encoded, { ...employeeDefinitionWire, implementsInterfaces2: {} });
    })
  );

  it("rejects a bundle with a collection of the wrong shape, or one that carries a broken object type", () => {
    assertRejects(
      ObjectTypeDefinition,
      {
        objectType: officeWire,
        linkTypes: {},
        implementsInterfaces: [],
        implementsInterfaces2: {},
        sharedPropertyTypeMapping: {},
      },
      `["linkTypes"]`
    );
    assertRejects(
      ObjectTypeDefinition,
      {
        objectType: { ...officeWire, primaryKey: "buildingId" },
        linkTypes: [],
        implementsInterfaces: [],
        implementsInterfaces2: {},
        sharedPropertyTypeMapping: {},
      },
      "The primary key must name a declared property"
    );
  });
});

// -----------------------------------------------------------------------------
// Authoring policy
// -----------------------------------------------------------------------------

describe("ObjectType authoring policy", () => {
  const isObjectTypeName = S.is(S.String.check(ObjectTypeApiNameChecks));
  const isPropertyName = S.is(S.String.check(PropertyApiNameChecks));
  const isLinkName = S.is(S.String.check(LinkApiNameChecks));
  const isInterfaceName = S.is(S.String.check(InterfaceApiNameChecks));

  it("lists the nine reserved words", () => {
    deepStrictEqual(A.fromIterable(ReservedKeyword.literals), [
      "ontology",
      "object",
      "property",
      "link",
      "relation",
      "rid",
      "primarykey",
      "typeid",
      "ontologyobject",
    ]);
  });

  it("accepts namespaced object type names and rejects underscores, leading digits and empty segments", () => {
    deepStrictEqual(A.map(["Employee", "equipment", "com.acme.Employee", "A1", "a.1"], isObjectTypeName), [
      true,
      true,
      true,
      true,
      true,
    ]);
    deepStrictEqual(
      A.map(["employee_record", "9Lives", "", "Employee.", ".Employee", "a..b", "Emp loyee"], isObjectTypeName),
      [false, false, false, false, false, false, false]
    );
  });

  it("limits an object type name to a hundred characters, namespace included", () => {
    assertTrue(isObjectTypeName(Str.repeat(100)("a")));
    assertFalse(isObjectTypeName(Str.repeat(101)("a")));
    assertTrue(isObjectTypeName(`${Str.repeat(49)("a")}.${Str.repeat(50)("b")}`));
    assertFalse(isObjectTypeName(`${Str.repeat(50)("a")}.${Str.repeat(50)("b")}`));
  });

  it("accepts underscores in property and link names and rejects dots, dashes and leading underscores", () => {
    deepStrictEqual(A.map(["employeeId", "start_date", "x", "A_1"], isPropertyName), [true, true, true, true]);
    deepStrictEqual(A.map(["full.name", "lead-of", "_hidden", "1st", ""], isPropertyName), [
      false,
      false,
      false,
      false,
      false,
    ]);
    deepStrictEqual(A.map(["occupants", "visited_offices", "lead-of", "to.office"], isLinkName), [
      true,
      true,
      false,
      false,
    ]);
    assertTrue(isPropertyName(Str.repeat(100)("a")));
    assertFalse(isPropertyName(Str.repeat(101)("a")));
  });

  it("accepts namespaced interface names with underscores, up to a hundred characters", () => {
    deepStrictEqual(A.map(["FooInterface", "com.acme.Has_Location", "a_b.c_d"], isInterfaceName), [true, true, true]);
    deepStrictEqual(A.map(["Foo..Bar", "_Foo", "Foo.", "Foo-Bar", ""], isInterfaceName), [
      false,
      false,
      false,
      false,
      false,
    ]);
    assertTrue(isInterfaceName(Str.repeat(100)("a")));
    assertFalse(isInterfaceName(Str.repeat(101)("a")));
    assertTrue(A.every(ReservedKeyword.literals, (word) => !isInterfaceName(Str.capitalize(word))));
    assertRejects(S.String.check(InterfaceApiNameChecks), "Foo-Bar", "An interface API name must start with a letter");
    assertRejects(S.String.check(InterfaceApiNameChecks), "Relation", "An interface API name must not be a reserved");
  });

  it("rejects every reserved word in any letter case, but only as a whole name", () => {
    assertTrue(A.every(ReservedKeyword.literals, (word) => !isObjectTypeName(word)));
    assertTrue(A.every(ReservedKeyword.literals, (word) => !isPropertyName(Str.toUpperCase(word))));
    assertTrue(A.every(ReservedKeyword.literals, (word) => !isLinkName(Str.capitalize(word))));
    deepStrictEqual(A.map(["objectId", "ridOf", "linked"], isPropertyName), [true, true, true]);
  });

  it("names the rule a rejected name broke", () => {
    assertRejects(S.String.check(ObjectTypeApiNameChecks), "employee_record", "must start with a letter and use only");
    assertRejects(S.String.check(ObjectTypeApiNameChecks), Str.repeat(101)("a"), "at most 100 characters");
    assertRejects(S.String.check(ObjectTypeApiNameChecks), "Ontology", "must not be a reserved word");
    assertRejects(S.String.check(PropertyApiNameChecks), "full.name", "A property API name must start with a letter");
    assertRejects(S.String.check(PropertyApiNameChecks), "RID", "A property API name must not be a reserved word");
    assertRejects(S.String.check(LinkApiNameChecks), "link", "A link API name must not be a reserved word");
  });

  it("measures display names and descriptions in UTF-8 bytes", () => {
    const fitsDisplayName = S.is(S.String.check(DisplayNameChecks));
    const fitsPropertyDisplayName = S.is(S.String.check(PropertyDisplayNameChecks));
    const fitsDescription = S.is(S.String.check(DescriptionChecks));
    assertTrue(fitsDisplayName(Str.repeat(1000)("a")));
    assertFalse(fitsDisplayName(Str.repeat(1001)("a")));
    assertTrue(fitsDisplayName(Str.repeat(500)("é")));
    assertFalse(fitsDisplayName(Str.repeat(501)("é")));
    assertTrue(fitsPropertyDisplayName(Str.repeat(1500)("a")));
    assertFalse(fitsPropertyDisplayName(Str.repeat(1501)("a")));
    assertTrue(fitsDescription(Str.repeat(10000)("a")));
    assertFalse(fitsDescription(Str.repeat(10001)("a")));
    assertRejects(S.String.check(DisplayNameChecks), Str.repeat(1001)("a"), "at most 1000 UTF-8 bytes");
    assertRejects(S.String.check(PropertyDisplayNameChecks), Str.repeat(1501)("a"), "at most 1500 UTF-8 bytes");
    assertRejects(S.String.check(DescriptionChecks), Str.repeat(10001)("a"), "at most 10000 UTF-8 bytes");
  });

  it.effect(
    "accepts the Employee and Office fixtures as authored object types",
    Effect.fnUntraced(function* () {
      const isAuthored = S.is(ObjectType.check(ObjectTypeAuthoringChecks));
      const employee = yield* S.decodeEffect(ObjectType)(employeeWire);
      const office = yield* S.decodeEffect(ObjectType)(officeWire);
      assertTrue(isAuthored(employee));
      assertTrue(isAuthored(office));
    })
  );

  it("is not part of the wire codec, and names each authoring rule a wire-valid object type breaks", () => {
    const Authored = ObjectType.check(ObjectTypeAuthoringChecks);
    const reservedProperty = {
      ...officeWire,
      primaryKey: "rid",
      titleProperty: "rid",
      properties: { rid: officeWire.properties.officeId },
    };
    assertAccepts(ObjectType, reservedProperty);
    assertRejects(Authored, reservedProperty, "Every property API name must start with a letter");

    const underscored = { ...officeWire, apiName: "branch_office" };
    assertAccepts(ObjectType, underscored);
    assertRejects(Authored, underscored, "The object type API name must start with a letter");

    assertRejects(
      Authored,
      { ...officeWire, pluralDisplayName: Str.repeat(1001)("a") },
      "The display name and the plural display name must each be at most 1000 UTF-8 bytes long"
    );
    assertRejects(
      Authored,
      { ...officeWire, description: Str.repeat(10001)("a") },
      "The description must be at most 10000 UTF-8 bytes long"
    );
    assertRejects(
      Authored,
      {
        ...officeWire,
        properties: {
          ...officeWire.properties,
          name: { ...officeWire.properties.name, displayName: Str.repeat(1501)("a") },
        },
      },
      "Every property display name must be at most 1500 UTF-8 bytes long"
    );
  });
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
      SameType<StructFieldImplementation["structFieldOfProperty"], PropertyStructField>,
      SameType<ObjectTypeDefinition["objectType"], ObjectType>,
    ] = [true, true];
    assertTrue(A.every(facts, (fact) => fact));
  });
});
