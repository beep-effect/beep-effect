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
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { ActionType } from "../src/Action/Action.model.ts";
import {
  ActionTypeApiName,
  FoundryBranch,
  FunctionVersion,
  InterfaceLinkTypeApiName,
  InterfacePropertyApiName,
  InterfaceTypeApiName,
  LinkTypeApiName,
  ObjectTypeApiName,
  OntologyApiName,
  OntologyRid,
  ParameterId,
  PropertyApiName,
  QueryApiName,
  SharedPropertyTypeApiName,
  ValueTypeApiName,
} from "../src/Identifier/Identifier.model.ts";
import {
  InterfaceLinkType,
  InterfaceType,
  LinkedInterfaceType,
  LinkedObjectType,
} from "../src/InterfaceType/InterfaceType.model.ts";
import { LinkTypeSide } from "../src/LinkType/LinkType.model.ts";
import { TypeClass } from "../src/Metadata/Metadata.values.ts";
import { InterfaceImplementation, ObjectType, ObjectTypeDefinition } from "../src/ObjectType/ObjectType.model.ts";
import {
  claimedInterfaces,
  getActionType,
  getInterfaceType,
  getLinkSide,
  getObjectType,
  getQueryType,
  getReverseLinkSide,
  implementers,
  interfaceAncestors,
  interfaceGraph,
  linkComponents,
  linkGraph,
  qualifyApiName,
  reachableObjectTypes,
  splitApiName,
} from "../src/Ontology/Ontology.behavior.ts";
import {
  ApiNameParts,
  OntologyBranch,
  OntologyDefinition,
  OntologyIdentity,
  OntologyInclusions,
  OntologyList,
  OntologySelection,
  QuerySelector,
  QuerySelectorFromVersionedApiName,
  VersionedQueryApiName,
} from "../src/Ontology/Ontology.model.ts";
import {
  ActionOperationTypeMissing,
  ActionParameterTypeMissing,
  ClaimedInterfaceMissing,
  ImplementedPropertyMissing,
  ImplementerNotClaiming,
  InterfaceExtensionCycle,
  InterfaceLinkTargetMissing,
  InterfaceParentMissing,
  LinkReverseMissing,
  LinkTargetMissing,
  OntologyFinding,
  OntologyFindingKind,
  PropertyValueTypeMissing,
  QueryReferenceMissing,
  SharedPropertyTypeMissing,
  TypeReferenceDangling,
  validateOntology,
} from "../src/Ontology/Ontology.policy.ts";
import { PropertyDefinition, SharedPropertyType } from "../src/Property/Property.model.ts";
import { QueryType, TypeReferenceId } from "../src/Query/Query.model.ts";

// -----------------------------------------------------------------------------
// Law and fixture helpers
// -----------------------------------------------------------------------------

/** Laws every named schema obeys: generated values are valid, and the wire form loses nothing. */
const lawsOf = <T, E>(name: string, schema: S.Codec<T, E>, runs = 50) => {
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
const wireFixture = <T, E>(name: string, schema: S.Codec<T, E>, wire: NoInfer<E>, expected: NoInfer<T>) =>
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
const assertRejects = <T, E>(schema: S.Codec<T, E>, input: unknown, fragment: string) =>
  assertInclude(
    pipe(
      S.decodeUnknownResult(schema)(input),
      Result.getFailure,
      O.map((error) => error.message),
      O.getOrUndefined
    ),
    fragment
  );

// -----------------------------------------------------------------------------
// Wire fixtures, transcribed from osdk-ts packages/shared.test/src/stubs
// (ontologies/defaultOntologyMetadata.ts, objectTypeV2.ts, linkTypes.ts, objectTypesWithLinkTypes.ts, spts.ts,
// interfaceTypes.ts, actionTypes.ts, queryTypes.ts)
// -----------------------------------------------------------------------------

type OntologyWire = typeof OntologyDefinition.Encoded;
type ObjectTypeDefinitionWire = typeof ObjectTypeDefinition.Encoded;
type InterfaceTypeWire = typeof InterfaceType.Encoded;
type LinkTypeSideWire = typeof LinkTypeSide.Encoded;
type ActionTypeWire = typeof ActionType.Encoded;
type QueryTypeWire = typeof QueryType.Encoded;

const identityWire: typeof OntologyIdentity.Encoded = {
  apiName: "default-ontology",
  displayName: "Ontology",
  description: "The default ontology",
  rid: "ri.ontology.main.ontology.698267cc-6b48-4d98-beff-29beb24e9361",
};

const identity = OntologyIdentity.make({
  apiName: OntologyApiName.make("default-ontology"),
  displayName: "Ontology",
  description: "The default ontology",
  rid: OntologyRid.make("ri.ontology.main.ontology.698267cc-6b48-4d98-beff-29beb24e9361"),
});

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
    employeeId: { dataType: { type: "integer" }, rid: "rid", typeClasses: [] },
    fullName: { dataType: { type: "string" }, rid: "rid", typeClasses: [] },
    office: {
      description: 'The unique "ID" of the employee\'s \\"primary\\" assigned office.\n This is some more text.',
      dataType: { type: "string" },
      rid: "rid",
      typeClasses: [],
    },
    class: { description: "", dataType: { type: "string" }, rid: "rid", typeClasses: [] },
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
    employeeLocation: {
      description: "Geotime series reference of the location of the employee",
      dataType: { type: "geotimeSeriesReference" },
      rid: "rid",
      typeClasses: [],
    },
    skillSet: { description: "The skills of the employee", dataType: { type: "string" }, rid: "rid", typeClasses: [] },
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
      dataType: { type: "array", subType: { type: "double" }, reducers: [{ direction: "DESCENDING_NULLS_LAST" }] },
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
    officeId: { dataType: { type: "string" }, rid: "rid", typeClasses: [] },
    entrance: { dataType: { type: "geopoint" }, rid: "rid", typeClasses: [] },
    occupiedArea: {
      description: "The occupied area of the Office",
      dataType: { type: "geoshape" },
      rid: "rid",
      typeClasses: [],
    },
    name: { description: "The Name of the Office", dataType: { type: "string" }, rid: "rid", typeClasses: [] },
    capacity: { description: "The capacity of the Office", dataType: { type: "integer" }, rid: "rid", typeClasses: [] },
  },
  rid: "ri.ontology.main.object-type.404ac022-89eb-4591-8b7e-1a912b9efb45",
  status: "ACTIVE",
};

const peepsWire: LinkTypeSideWire = {
  apiName: "peeps",
  status: "EXPERIMENTAL",
  objectTypeApiName: "Employee",
  cardinality: "MANY",
  displayName: "Peeps",
  linkTypeRid: "rid.link-type.327",
};

const leadWire: LinkTypeSideWire = {
  apiName: "lead",
  status: "EXPERIMENTAL",
  objectTypeApiName: "Employee",
  cardinality: "ONE",
  displayName: "Lead",
  linkTypeRid: "rid.link-type.327",
  foreignKeyPropertyApiName: "leadId",
};

const officeLinkWire: LinkTypeSideWire = {
  apiName: "officeLink",
  status: "EXPERIMENTAL",
  objectTypeApiName: "Office",
  cardinality: "ONE",
  displayName: "Office",
  linkTypeRid: "rid.link-type.324",
  foreignKeyPropertyApiName: "office",
};

/** The stub lists this side under `Employee` and gives `Office` no side that answers it. */
const visitedOfficesWire: LinkTypeSideWire = {
  apiName: "visitedOffices",
  status: "EXPERIMENTAL",
  objectTypeApiName: "Office",
  cardinality: "MANY",
  displayName: "Visited Offices",
  linkTypeRid: "ri.a.b.c.visitedOffices",
};

const occupantsWire: LinkTypeSideWire = {
  apiName: "occupants",
  status: "EXPERIMENTAL",
  objectTypeApiName: "Employee",
  cardinality: "MANY",
  displayName: "Office Occupants",
  linkTypeRid: "rid.link-type.324",
};

/** The link sides of `employeeObjectWithLinkTypes` of the stub file, without the one side nothing answers. */
const employeeLinkSidesWire: ReadonlyArray<LinkTypeSideWire> = [peepsWire, leadWire, officeLinkWire];

/** `employeeObjectWithLinkTypes` of the stub file, without the one side nothing answers. */
const employeeDefinitionWire: ObjectTypeDefinitionWire = {
  objectType: employeeWire,
  linkTypes: employeeLinkSidesWire,
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

const officeDefinitionWire: ObjectTypeDefinitionWire = {
  objectType: officeWire,
  linkTypes: [occupantsWire],
  implementsInterfaces: [],
  implementsInterfaces2: {},
  sharedPropertyTypeMapping: {},
};

const fooSptWire: typeof SharedPropertyType.Encoded = {
  rid: "ri.sharedPropertyType.main.sharedPropertyType.1",
  apiName: "fooSpt",
  dataType: { type: "string" },
  displayName: "Foo",
  description: "A foo",
  typeClasses: [],
};

const toFooLinkWire: typeof InterfaceLinkType.Encoded = {
  rid: "ri.interface.link.main.1",
  apiName: "toFoo",
  linkedEntityApiName: { type: "interfaceTypeApiName", apiName: "FooInterface" },
  displayName: "foos",
  cardinality: "MANY",
  required: true,
};

const toBarLinkWire: typeof InterfaceLinkType.Encoded = {
  rid: "ri.interface.link.main.2",
  apiName: "toBar",
  linkedEntityApiName: { type: "interfaceTypeApiName", apiName: "BarInterface" },
  displayName: "bars",
  cardinality: "MANY",
  required: true,
};

const barInterfaceWire: InterfaceTypeWire = {
  apiName: "BarInterface",
  description: "Interface for Bar",
  displayName: "Bar Interface",
  rid: "ri.interface.main.interface.2",
  extendsInterfaces: [],
  properties: {},
  allProperties: {},
  propertiesV2: {},
  allPropertiesV2: {},
  links: { toFoo: toFooLinkWire },
  implementedByObjectTypes: [],
  allExtendsInterfaces: [],
  allLinks: { toFoo: toFooLinkWire },
};

/**
 * `FooInterface` of the stub file, with two departures. Its `allPropertiesV2` entries drop the `typeClasses` key the
 * stub's spreads carry over and the wire type does not declare. Its implementers are `Employee` alone: the stub also
 * lists `Person`, which claims no interface.
 */
const fooInterfaceWire: InterfaceTypeWire = {
  apiName: "FooInterface",
  description: "Interface for Foo",
  displayName: "Foo Interface",
  rid: "ri.interface.main.interface.1",
  extendsInterfaces: [],
  properties: { fooSpt: { ...fooSptWire, required: true } },
  propertiesV2: {
    fooSpt: { ...fooSptWire, type: "interfaceSharedPropertyType", required: true },
    fooIdp: {
      type: "interfaceDefinedPropertyType",
      rid: "ri.interfacePropertyType.main.interfacePropertyType.1",
      apiName: "fooIdp",
      displayName: "Foo IDP",
      description: "A Foo IDP",
      dataType: { type: "string" },
      requireImplementation: true,
      typeClasses: [],
    },
  },
  links: { toBar: toBarLinkWire },
  implementedByObjectTypes: ["Employee"],
  allProperties: { fooSpt: { ...fooSptWire, required: true } },
  allPropertiesV2: {
    fooSpt: {
      rid: "ri.sharedPropertyType.main.sharedPropertyType.1",
      apiName: "fooSpt",
      dataType: { type: "string" },
      displayName: "Foo",
      description: "A foo",
      requireImplementation: true,
    },
    fooIdp: {
      rid: "ri.interfacePropertyType.main.interfacePropertyType.1",
      apiName: "fooIdp",
      displayName: "Foo IDP",
      description: "A Foo IDP",
      dataType: { type: "string" },
      requireImplementation: true,
    },
  },
  allExtendsInterfaces: [],
  allLinks: { toBar: toBarLinkWire },
};

/** `PromoteEmployeeObject` of `actionTypes.ts`. */
const promoteEmployeeWire: ActionTypeWire = {
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
    newCompensation: { displayName: "New Compensation", dataType: { type: "double" }, required: true, typeClasses: [] },
  },
  rid: "ri.ontology.main.action-type.7ed72754-7491-428a-bb18-4d7296eb2168",
  operations: [{ type: "modifyObject", objectTypeApiName: "Employee" }],
  status: "ACTIVE",
};

/** `incrementPersonAgeComplex` of `queryTypes.ts`: a struct that holds an object reference. */
const incrementAgeWire: QueryTypeWire = {
  apiName: "incrementPersonAgeComplex",
  displayName: "incrementAgeComplex",
  parameters: {
    person: {
      dataType: {
        type: "struct",
        fields: [
          { name: "firstName", fieldType: { type: "string" } },
          { name: "age", fieldType: { type: "union", unionTypes: [{ type: "integer" }, { type: "null" }] } },
          { name: "object", fieldType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" } },
        ],
      },
      required: true,
    },
  },
  output: {
    type: "struct",
    fields: [
      { name: "firstName", fieldType: { type: "string" } },
      { name: "object", fieldType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" } },
    ],
  },
  rid: "ri.function-registry.main.function.b2ae7b3e-2c89-42f5-a762-68957a9c039d",
  version: "0.0.9",
  typeReferences: {},
};

/** `queryReturnsRecursiveStruct` of `queryTypes.ts`: a type that names itself through the reference table. */
const recursiveStructWire: QueryTypeWire = {
  apiName: "queryReturnsRecursiveStruct",
  displayName: "queryReturnsRecursiveStruct",
  parameters: {
    treeNode: { dataType: { type: "typeReference", typeId: "recursive-tree-node" }, required: true },
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

/** `queryAcceptsInterface` of `queryTypes.ts`. */
const acceptsInterfaceWire: QueryTypeWire = {
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

/** A small, complete ontology: two linked object types, two interfaces, one action, three queries. */
const ontologyWire: OntologyWire = {
  ontology: identityWire,
  objectTypes: { Employee: employeeDefinitionWire, Office: officeDefinitionWire },
  actionTypes: { promoteEmployeeObject: promoteEmployeeWire },
  actionTypesFullMetadata: {},
  queryTypes: {
    incrementPersonAgeComplex: incrementAgeWire,
    "queryReturnsRecursiveStruct:0.1.0": recursiveStructWire,
    "queryAcceptsInterface:0.11.0": acceptsInterfaceWire,
  },
  interfaceTypes: { FooInterface: fooInterfaceWire, BarInterface: barInterfaceWire },
  sharedPropertyTypes: { fooSpt: fooSptWire },
  valueTypes: {},
};

const decodeOntology = S.decodeEffect(OntologyDefinition);
const encodeOntology = S.encodeEffect(OntologyDefinition);
const findingsOf = flow(decodeOntology, Effect.map(validateOntology));

/** Decodes a broken variant of the fixture and asserts the exact findings, in order. */
const reports = (name: string, wire: OntologyWire, expected: ReadonlyArray<OntologyFinding>) =>
  it.effect(
    name,
    Effect.fnUntraced(function* () {
      const findings = yield* findingsOf(wire);
      deepStrictEqual(findings, expected);
    })
  );

const objectTypesWith = (overrides: OntologyWire["objectTypes"]): OntologyWire => ({
  ...ontologyWire,
  objectTypes: { ...ontologyWire.objectTypes, ...overrides },
});

const interfaceTypesWith = (overrides: OntologyWire["interfaceTypes"]): OntologyWire => ({
  ...ontologyWire,
  interfaceTypes: { ...ontologyWire.interfaceTypes, ...overrides },
});

const actionTypesWith = (overrides: OntologyWire["actionTypes"]): OntologyWire => ({
  ...ontologyWire,
  actionTypes: { ...ontologyWire.actionTypes, ...overrides },
});

const queryTypesWith = (overrides: OntologyWire["queryTypes"]): OntologyWire => ({
  ...ontologyWire,
  queryTypes: { ...ontologyWire.queryTypes, ...overrides },
});

/** An interface with nothing but a name and the interfaces it extends. */
const bareInterfaceWire = (apiName: string, extendsInterfaces: ReadonlyArray<string>): InterfaceTypeWire => ({
  rid: `ri.interface.main.interface.${apiName}`,
  apiName,
  displayName: apiName,
  properties: {},
  allProperties: {},
  propertiesV2: {},
  allPropertiesV2: {},
  extendsInterfaces,
  allExtendsInterfaces: extendsInterfaces,
  implementedByObjectTypes: [],
  links: {},
  allLinks: {},
});

/** An object type with one property, no links and the given claims. */
const bareObjectTypeWire = (
  apiName: string,
  implementsInterfaces: ReadonlyArray<string>
): ObjectTypeDefinitionWire => ({
  objectType: {
    apiName,
    displayName: apiName,
    pluralDisplayName: apiName,
    status: "ACTIVE",
    icon: { type: "blueprint", color: "blue", name: "cube" },
    rid: `ri.ontology.main.object-type.${apiName}`,
    primaryKey: "id",
    titleProperty: "id",
    properties: { id: { dataType: { type: "string" }, rid: "rid", typeClasses: [] } },
    aliases: [],
    datasources: [],
  },
  linkTypes: [],
  implementsInterfaces,
  implementsInterfaces2: {},
  sharedPropertyTypeMapping: {},
});

const employee = ObjectTypeApiName.make("Employee");
const office = ObjectTypeApiName.make("Office");
const fooInterface = InterfaceTypeApiName.make("FooInterface");
const barInterface = InterfaceTypeApiName.make("BarInterface");
const promoteEmployee = ActionTypeApiName.make("promoteEmployeeObject");
const ghostObjectType = LinkedObjectType.make({ apiName: ObjectTypeApiName.make("Ghost") });
const ghostInterface = LinkedInterfaceType.make({ apiName: InterfaceTypeApiName.make("GhostInterface") });
const linkNamed = LinkTypeApiName.make;
const interfaceNamed = InterfaceTypeApiName.make;
const sortedNames = A.sort(Order.String);
/** Reads branded names as plain text, so expectations can be written as string literals. */
const texts = (names: ReadonlyArray<string>): ReadonlyArray<string> => names;
const textGroups = (groups: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<ReadonlyArray<string>> => groups;

// -----------------------------------------------------------------------------
// Laws
// -----------------------------------------------------------------------------

lawsOf("OntologyIdentity", OntologyIdentity);
lawsOf("OntologyList", OntologyList);
lawsOf("OntologyBranch", OntologyBranch);
lawsOf("VersionedQueryApiName", VersionedQueryApiName);
lawsOf("QuerySelector", QuerySelector);
lawsOf("QuerySelectorFromVersionedApiName", QuerySelectorFromVersionedApiName);
lawsOf("OntologySelection", OntologySelection);
lawsOf("OntologyInclusions", OntologyInclusions);
lawsOf("ApiNameParts", ApiNameParts);
lawsOf("OntologyFindingKind", OntologyFindingKind);
lawsOf("OntologyFinding", OntologyFinding);
// Value types and action parameters hold scalar operands, which are wire scalars: the whole definition keeps the
// strict law.
lawsOf("OntologyDefinition", OntologyDefinition, 10);

// -----------------------------------------------------------------------------
// Identity, listing, branch, selection
// -----------------------------------------------------------------------------

describe("OntologyIdentity", () => {
  wireFixture("defaultOntologyMetadata decodes and encodes back unchanged", OntologyIdentity, identityWire, identity);

  it("requires the description the wire makes mandatory, and non-empty names", () => {
    assertRejects(OntologyIdentity, { ...identityWire, description: undefined }, "description");
    assertRejects(OntologyIdentity, { ...identityWire, apiName: "" }, "apiName");
    assertRejects(OntologyIdentity, { ...identityWire, rid: "" }, "rid");
  });
});

describe("OntologyList", () => {
  wireFixture(
    "a listing decodes to the identities in order",
    OntologyList,
    { data: [identityWire] },
    OntologyList.make({ data: [identity] })
  );
});

describe("OntologyBranch", () => {
  wireFixture(
    "the branch record keeps the wire's key",
    OntologyBranch,
    { rid: "ri.branch..branch.00000000-0000-0000-0000-000000000001" },
    OntologyBranch.make({ rid: FoundryBranch.make("ri.branch..branch.00000000-0000-0000-0000-000000000001") })
  );

  it("rejects an empty branch identifier", () => {
    assertRejects(OntologyBranch, { rid: "" }, "rid");
  });
});

describe("OntologySelection", () => {
  wireFixture(
    "a load request with every key decodes and encodes back unchanged",
    OntologySelection,
    {
      objectTypes: ["Employee", "Office"],
      linkTypes: ["peeps"],
      actionTypes: ["promoteEmployeeObject"],
      queryTypes: ["incrementPersonAgeComplex", "queryReturnsRecursiveStruct:0.1.0"],
      interfaceTypes: ["FooInterface"],
      includeActionTypeFullMetadata: true,
    },
    OntologySelection.make({
      objectTypes: [employee, office],
      linkTypes: [linkNamed("peeps")],
      actionTypes: [promoteEmployee],
      queryTypes: [
        VersionedQueryApiName.make("incrementPersonAgeComplex"),
        VersionedQueryApiName.make("queryReturnsRecursiveStruct:0.1.0"),
      ],
      interfaceTypes: [fooInterface],
      includeActionTypeDefinitions: O.some(true),
    })
  );

  it.effect(
    "the constructor selects nothing, and says nothing about action definitions",
    Effect.fnUntraced(function* () {
      const selection = OntologySelection.make({});
      assertNone(selection.includeActionTypeDefinitions);
      const wire = yield* S.encodeEffect(OntologySelection)(selection);
      deepStrictEqual(wire, { objectTypes: [], linkTypes: [], actionTypes: [], queryTypes: [], interfaceTypes: [] });
    })
  );
});

describe("OntologyInclusions", () => {
  wireFixture(
    "both inclusions stated, one of them refused",
    OntologyInclusions,
    { includeActionTypeDefinitions: true, includeDatasources: false },
    OntologyInclusions.make({ includeActionTypeDefinitions: O.some(true), includeDatasources: O.some(false) })
  );

  wireFixture("nothing stated leaves both to the platform", OntologyInclusions, {}, OntologyInclusions.make({}));

  it("rejects a word in place of a switch and a null in place of an absent key", () => {
    assertRejects(OntologyInclusions, { includeDatasources: "yes" }, "includeDatasources");
    assertRejects(OntologyInclusions, { includeActionTypeDefinitions: null }, "includeActionTypeDefinitions");
  });
});

// -----------------------------------------------------------------------------
// Versioned query names
// -----------------------------------------------------------------------------

describe("QuerySelectorFromVersionedApiName", () => {
  const decode = S.decodeEffect(QuerySelectorFromVersionedApiName);
  const encode = S.encodeEffect(QuerySelectorFromVersionedApiName);
  const selector = (apiName: string, version: O.Option<string>) =>
    QuerySelector.make({
      apiName: QueryApiName.make(apiName),
      version: O.map(version, (text) => FunctionVersion.make(text)),
    });

  // The four examples the platform documents for the grammar.
  wireFixture(
    "a grouped name pinned to latest",
    QuerySelectorFromVersionedApiName,
    "myGroup:myFunction:latest",
    selector("myGroup:myFunction", O.none())
  );
  wireFixture(
    "a grouped name pinned to a version",
    QuerySelectorFromVersionedApiName,
    "myGroup:myFunction:1.0.0",
    selector("myGroup:myFunction", O.some("1.0.0"))
  );
  wireFixture("a bare name", QuerySelectorFromVersionedApiName, "myFunction", selector("myFunction", O.none()));
  wireFixture(
    "a bare name pinned to a version",
    QuerySelectorFromVersionedApiName,
    "myFunction:2.0.0",
    selector("myFunction", O.some("2.0.0"))
  );
  wireFixture(
    "a tagged version",
    QuerySelectorFromVersionedApiName,
    "myFunction:2.0.0-rc1",
    selector("myFunction", O.some("2.0.0-rc1"))
  );

  it.effect(
    "a redundant :latest on a bare name is dropped when written back",
    Effect.fnUntraced(function* () {
      const decoded = yield* decode("myFunction:latest");
      deepStrictEqual(decoded, selector("myFunction", O.none()));
      const encoded = yield* encode(decoded);
      strictEqual(encoded, "myFunction");
    })
  );

  it("rejects a name with a colon that ends in neither a version nor latest", () => {
    assertRejects(QuerySelectorFromVersionedApiName, "myGroup:myFunction", "Expected a query name of the form");
    assertRejects(QuerySelectorFromVersionedApiName, "myFunction:1.0", "Expected a query name of the form");
    assertRejects(QuerySelectorFromVersionedApiName, "myFunction:", "Expected a query name of the form");
  });

  it("rejects an empty name and a version with no name before it", () => {
    assertRejects(QuerySelectorFromVersionedApiName, "", "length of at least 1");
    assertRejects(QuerySelectorFromVersionedApiName, ":1.0.0", "apiName");
  });

  it.effect(
    "the constructor default asks for the latest version",
    Effect.fnUntraced(function* () {
      const latest = QuerySelector.make({ apiName: QueryApiName.make("addOne") });
      assertNone(latest.version);
      const encoded = yield* encode(latest);
      strictEqual(encoded, "addOne");
    })
  );
});

// -----------------------------------------------------------------------------
// The ontology definition: parity fixture
// -----------------------------------------------------------------------------

describe("OntologyDefinition", () => {
  it.effect(
    "the assembled stub ontology decodes and encodes back unchanged",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(ontologyWire);
      const encoded = yield* encodeOntology(ontology);
      deepStrictEqual(encoded, ontologyWire);
    })
  );

  it.effect(
    "the decoded ontology is the definitions its parts decode to, under the wire's keys",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(ontologyWire);
      const employeeDefinition = yield* S.decodeEffect(ObjectTypeDefinition)(employeeDefinitionWire);
      const officeDefinition = yield* S.decodeEffect(ObjectTypeDefinition)(officeDefinitionWire);
      const promote = yield* S.decodeEffect(ActionType)(promoteEmployeeWire);
      const incrementAge = yield* S.decodeEffect(QueryType)(incrementAgeWire);
      const recursiveStruct = yield* S.decodeEffect(QueryType)(recursiveStructWire);
      const acceptsInterface = yield* S.decodeEffect(QueryType)(acceptsInterfaceWire);
      const foo = yield* S.decodeEffect(InterfaceType)(fooInterfaceWire);
      const bar = yield* S.decodeEffect(InterfaceType)(barInterfaceWire);
      const fooSpt = yield* S.decodeEffect(SharedPropertyType)(fooSptWire);
      const expected = OntologyDefinition.make({
        identity,
        objectTypes: R.fromEntries([Tuple.make(employee, employeeDefinition), Tuple.make(office, officeDefinition)]),
        actionTypes: R.fromEntries([Tuple.make(promoteEmployee, promote)]),
        queryTypes: R.fromEntries([
          Tuple.make(VersionedQueryApiName.make("incrementPersonAgeComplex"), incrementAge),
          Tuple.make(VersionedQueryApiName.make("queryReturnsRecursiveStruct:0.1.0"), recursiveStruct),
          Tuple.make(VersionedQueryApiName.make("queryAcceptsInterface:0.11.0"), acceptsInterface),
        ]),
        interfaceTypes: R.fromEntries([Tuple.make(fooInterface, foo), Tuple.make(barInterface, bar)]),
        sharedPropertyTypes: R.fromEntries([Tuple.make(SharedPropertyTypeApiName.make("fooSpt"), fooSpt)]),
      });
      assertTrue(S.toEquivalence(OntologyDefinition)(ontology, expected));
      assertNone(ontology.branch);
      deepStrictEqual(ontology.actionTypeDefinitions, {});
      strictEqual(ontology.identity.apiName, "default-ontology");
    })
  );

  it.effect(
    "the optional keys of newer platforms decode and encode back unchanged",
    Effect.fnUntraced(function* () {
      const wire: OntologyWire = {
        ...ontologyWire,
        branch: { rid: "ri.branch..branch.1" },
        actionTypesFullMetadata: {
          promoteEmployeeObject: {
            actionType: promoteEmployeeWire,
            fullLogicRules: [
              {
                type: "modifyObject",
                objectToModify: "employee",
                propertyArguments: { fullName: { type: "parameterId", parameterId: "newTitle" } },
                structPropertyArguments: {},
              },
            ],
          },
        },
        valueTypes: {
          colorValueType: {
            apiName: "colorValueType",
            description: "A value type for specific colors",
            displayName: "Color Value Type",
            rid: "ri.a.b.c.d",
            version: "1.0.0",
            fieldType: { type: "string" },
            constraints: [],
          },
        },
      };
      const ontology = yield* decodeOntology(wire);
      assertSome(
        O.map(ontology.branch, (branch) => `${branch.rid}`),
        "ri.branch..branch.1"
      );
      deepStrictEqual(R.keys(ontology.actionTypeDefinitions), ["promoteEmployeeObject"]);
      deepStrictEqual(R.keys(ontology.valueTypes), ["colorValueType"]);
      const encoded = yield* encodeOntology(ontology);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "the constructor defines nothing but the identity, and writes every required key",
    Effect.fnUntraced(function* () {
      const empty = OntologyDefinition.make({ identity });
      strictEqual(R.size(empty.objectTypes), 0);
      strictEqual(R.size(empty.actionTypeDefinitions), 0);
      const wire = yield* encodeOntology(empty);
      deepStrictEqual(wire, {
        ontology: identityWire,
        objectTypes: {},
        actionTypes: {},
        actionTypesFullMetadata: {},
        queryTypes: {},
        interfaceTypes: {},
        sharedPropertyTypes: {},
        valueTypes: {},
      });
      deepStrictEqual(validateOntology(empty), []);
    })
  );

  it.effect(
    "a saved document that omits a collection decodes it as empty, and every collection is written back",
    Effect.fnUntraced(function* () {
      // Saved ontology documents leave empty collections out (Conjure semantics); the canonical form writes them.
      const identityOnly = yield* decodeOntology({ ontology: identityWire });
      deepStrictEqual(identityOnly, OntologyDefinition.make({ identity }));
      const canonical = yield* encodeOntology(identityOnly);
      deepStrictEqual(canonical, {
        ontology: identityWire,
        objectTypes: {},
        actionTypes: {},
        actionTypesFullMetadata: {},
        queryTypes: {},
        interfaceTypes: {},
        sharedPropertyTypes: {},
        valueTypes: {},
      });
      // Each collection on its own: leaving it out of the stub ontology reads as an empty record and nothing else moves.
      const collections = Tuple.make(
        "objectTypes",
        "actionTypes",
        "actionTypesFullMetadata",
        "queryTypes",
        "interfaceTypes",
        "sharedPropertyTypes",
        "valueTypes"
      );
      yield* Effect.forEach(
        collections,
        Effect.fnUntraced(function* (collection) {
          const decoded = yield* decodeOntology(Struct.omit(ontologyWire, [collection]));
          const encoded = yield* encodeOntology(decoded);
          deepStrictEqual(encoded, { ...ontologyWire, [collection]: {} });
        })
      );
    })
  );

  it("rejects a payload without its identity, and a collection of the wrong shape", () => {
    assertRejects(OntologyDefinition, { ...ontologyWire, ontology: undefined }, "ontology");
    assertRejects(OntologyDefinition, { ...ontologyWire, valueTypes: [] }, "valueTypes");
    assertRejects(OntologyDefinition, { ...ontologyWire, actionTypesFullMetadata: null }, "actionTypesFullMetadata");
  });

  it("rejects an object type whose primary key is not declared, so no finding is needed for it", () => {
    assertRejects(
      OntologyDefinition,
      objectTypesWith({ Office: { ...officeDefinitionWire, objectType: { ...officeWire, primaryKey: "missing" } } }),
      "The primary key must name a declared property"
    );
  });
});

// -----------------------------------------------------------------------------
// Saved documents: real data
// -----------------------------------------------------------------------------

describe("saved ontology documents", () => {
  // osdk-ts packages/e2e.sandbox.peopleapp/ontology.json, trimmed to the object type `ExampleObjects` and the
  // interface it implements. Every key and value below is the document's own. It was saved without the root's
  // `actionTypesFullMetadata` and without the implementation's `actionTypes`: the two collections it leaves out.
  const exampleObjectTypeSaved: typeof ObjectType.Encoded = {
    apiName: "ExampleObjects",
    displayName: "Example Objects",
    status: "EXPERIMENTAL",
    description: "",
    pluralDisplayName: "Example Objects",
    icon: { type: "blueprint", color: "#4C90F0", name: "cube" },
    primaryKey: "primaryKey_",
    properties: {
      primaryKey_: {
        displayName: "id",
        dataType: { type: "string" },
        rid: "ri.ontology.main.property.82078e46-36ad-4a05-8ed8-508fea2fed1f",
        status: { type: "experimental" },
        visibility: "NORMAL",
        typeClasses: [
          { kind: "render_hint", name: "SELECTABLE" },
          { kind: "render_hint", name: "SORTABLE" },
        ],
      },
      type: {
        displayName: "type",
        dataType: { type: "string" },
        rid: "ri.ontology.main.property.789165cd-e793-42c8-9a57-0c893f8dc2d8",
        status: { type: "experimental" },
        visibility: "NORMAL",
        typeClasses: [
          { kind: "render_hint", name: "SELECTABLE" },
          { kind: "render_hint", name: "SORTABLE" },
        ],
      },
    },
    rid: "ri.ontology.main.object-type.9bd216ec-22a2-48dc-8c61-63db7c4e1fc8",
    titleProperty: "primaryKey_",
    visibility: "NORMAL",
  };

  const exampleImplementationSaved: typeof InterfaceImplementation.Encoded = {
    apiName: "ExampleInterface",
    rid: "ri.ontology.main.interface.05598367-c4f3-455b-b050-12f6c90041db",
    properties: { id: "primaryKey_", type: "type" },
    propertiesV2: {
      id: { type: "localPropertyImplementation", propertyApiName: "primaryKey_" },
      type: { type: "localPropertyImplementation", propertyApiName: "type" },
    },
    links: {},
  };

  const exampleObjectsSaved: ObjectTypeDefinitionWire = {
    objectType: exampleObjectTypeSaved,
    linkTypes: [],
    implementsInterfaces: ["ExampleInterface"],
    implementsInterfaces2: { ExampleInterface: exampleImplementationSaved },
    sharedPropertyTypeMapping: { id: "primaryKey_", type: "type" },
  };

  const renderHints: ReadonlyArray<typeof TypeClass.Encoded> = [
    { kind: "render_hint", name: "SELECTABLE" },
    { kind: "render_hint", name: "SORTABLE" },
  ];

  const exampleInterfaceSaved: InterfaceTypeWire = {
    rid: "ri.ontology.main.interface.05598367-c4f3-455b-b050-12f6c90041db",
    apiName: "ExampleInterface",
    displayName: "Example Interface",
    description: "",
    properties: {
      id: {
        rid: "ri.ontology.main.shared-property.bce1dd5c-edae-4f7e-90f7-51077f886c4d",
        apiName: "id",
        displayName: "id",
        dataType: { type: "string" },
        required: true,
        typeClasses: renderHints,
      },
      type: {
        rid: "ri.ontology.main.shared-property.971ef747-7c06-4750-91d8-10e59eb4b360",
        apiName: "type",
        displayName: "type",
        dataType: { type: "string" },
        required: true,
        typeClasses: renderHints,
      },
    },
    allProperties: {
      id: {
        rid: "ri.ontology.main.shared-property.bce1dd5c-edae-4f7e-90f7-51077f886c4d",
        apiName: "id",
        displayName: "id",
        dataType: { type: "string" },
        required: true,
        typeClasses: renderHints,
      },
      type: {
        rid: "ri.ontology.main.shared-property.971ef747-7c06-4750-91d8-10e59eb4b360",
        apiName: "type",
        displayName: "type",
        dataType: { type: "string" },
        required: true,
        typeClasses: renderHints,
      },
    },
    propertiesV2: {
      id: {
        type: "interfaceSharedPropertyType",
        rid: "ri.ontology.main.shared-property.bce1dd5c-edae-4f7e-90f7-51077f886c4d",
        apiName: "id",
        displayName: "id",
        dataType: { type: "string" },
        required: true,
        typeClasses: renderHints,
      },
      type: {
        type: "interfaceSharedPropertyType",
        rid: "ri.ontology.main.shared-property.971ef747-7c06-4750-91d8-10e59eb4b360",
        apiName: "type",
        displayName: "type",
        dataType: { type: "string" },
        required: true,
        typeClasses: renderHints,
      },
    },
    allPropertiesV2: {
      id: {
        rid: "ri.ontology.main.interface-property.bce1dd5c-edae-4f7e-90f7-51077f886c4d",
        apiName: "id",
        displayName: "id",
        dataType: { type: "string" },
        requireImplementation: true,
      },
      type: {
        rid: "ri.ontology.main.interface-property.971ef747-7c06-4750-91d8-10e59eb4b360",
        apiName: "type",
        displayName: "type",
        dataType: { type: "string" },
        requireImplementation: true,
      },
    },
    extendsInterfaces: [],
    allExtendsInterfaces: [],
    implementedByObjectTypes: ["ExampleObjects"],
    links: {},
    allLinks: {},
  };

  const peopleAppSaved: OntologyWire = {
    ontology: {
      apiName: "ontology-d097f725-ab77-46cf-83c0-e3cb9186bff1",
      displayName: "EA Ontology",
      description: " Ontology",
      rid: "ri.ontology.main.ontology.a35bb7f9-2c57-4199-a1cd-af461d88bd6e",
    },
    objectTypes: { ExampleObjects: exampleObjectsSaved },
    actionTypes: {},
    queryTypes: {},
    interfaceTypes: { ExampleInterface: exampleInterfaceSaved },
    sharedPropertyTypes: {},
    valueTypes: {},
  };

  it.effect(
    "the people app's ExampleObjects decodes although the document omits two collections, and both are written back",
    Effect.fnUntraced(function* () {
      const exampleObjects = ObjectTypeApiName.make("ExampleObjects");
      const exampleInterface = InterfaceTypeApiName.make("ExampleInterface");
      const ontology = yield* decodeOntology(peopleAppSaved);
      // The two collections the document leaves out are empty, not missing.
      deepStrictEqual(ontology.actionTypeDefinitions, {});
      const implementation = pipe(
        getObjectType(ontology, exampleObjects),
        O.flatMap(ObjectTypeDefinition.interfaceImplementation(exampleInterface))
      );
      assertSome(
        O.map(implementation, (found) => found.actionTypes),
        {}
      );
      assertSome(
        O.map(implementation, (found) => R.keys(found.propertyImplementations)),
        ["id", "type"]
      );
      assertSome(
        pipe(
          getInterfaceType(ontology, exampleInterface),
          O.map((interfaceType) => [
            A.join(R.keys(interfaceType.ownProperties), ","),
            A.join(R.keys(interfaceType.inheritedAndOwnProperties), ","),
            A.join(interfaceType.implementedByObjectTypes, ","),
          ])
        ),
        ["id,type", "id,type", "ExampleObjects"]
      );
      // The canonical form is the saved document plus every collection it left out.
      const encoded = yield* encodeOntology(ontology);
      deepStrictEqual(encoded, {
        ...peopleAppSaved,
        objectTypes: {
          ExampleObjects: {
            ...exampleObjectsSaved,
            objectType: { ...exampleObjectTypeSaved, aliases: [], datasources: [] },
            implementsInterfaces2: { ExampleInterface: { ...exampleImplementationSaved, actionTypes: {} } },
          },
        },
        actionTypesFullMetadata: {},
      });
      // The canonical form is a fixed point: nothing more is added the second time.
      const decodedAgain = yield* decodeOntology(encoded);
      const encodedAgain = yield* encodeOntology(decodedAgain);
      deepStrictEqual(encodedAgain, encoded);
      // What the document itself gets wrong is reported as data: it maps two shared property types it never defines.
      deepStrictEqual(validateOntology(ontology), [
        SharedPropertyTypeMissing.make({
          objectType: exampleObjects,
          property: PropertyApiName.make("primaryKey_"),
          sharedPropertyType: SharedPropertyTypeApiName.make("id"),
        }),
        SharedPropertyTypeMissing.make({
          objectType: exampleObjects,
          property: PropertyApiName.make("type"),
          sharedPropertyType: SharedPropertyTypeApiName.make("type"),
        }),
      ]);
    })
  );

  // osdk-ts packages/e2e.generated.catchall/ontology.json, `NihalbCastingObjectTypeA` and the interface it
  // implements, each as saved. This older document leaves out more: the implementation has neither `propertiesV2`
  // nor `actionTypes`, the interface has neither `propertiesV2` nor `allPropertiesV2`, and no property carries
  // `typeClasses`.
  const castingImplementationSaved: typeof InterfaceImplementation.Encoded = {
    properties: { interfaceProperty: "primaryKey_" },
    links: { nihalbCastingLinkedObjectTypeA: ["nihalbCastingLinkedObjectTypeAs"] },
  };

  const castingAdditionalPropertySaved: typeof PropertyDefinition.Encoded = {
    displayName: "Additional Property",
    dataType: { type: "string" },
    rid: "ri.ontology.main.property.b7fe356f-0f79-46ab-90fd-98604eeff14e",
    status: { type: "experimental" },
    visibility: "NORMAL",
  };

  const castingPrimaryKeySaved: typeof PropertyDefinition.Encoded = {
    displayName: "Primary Key",
    dataType: { type: "string" },
    rid: "ri.ontology.main.property.1eb5d966-e4c0-4d35-8d1a-56fb23d810a5",
    status: { type: "experimental" },
    visibility: "NORMAL",
  };

  const castingObjectTypeSaved: typeof ObjectType.Encoded = {
    apiName: "NihalbCastingObjectTypeA",
    displayName: "(nihalb) Casting Object Type A",
    status: "EXPERIMENTAL",
    description: "",
    pluralDisplayName: "(nihalb) Casting Object Type AS",
    icon: { type: "blueprint", color: "#4C90F0", name: "cube" },
    primaryKey: "primaryKey_",
    properties: { additionalProperty: castingAdditionalPropertySaved, primaryKey_: castingPrimaryKeySaved },
    rid: "ri.ontology.main.object-type.47776705-2ee2-4f59-af48-da192cd42456",
    titleProperty: "primaryKey_",
    visibility: "NORMAL",
  };

  const castingObjectSaved: ObjectTypeDefinitionWire = {
    objectType: castingObjectTypeSaved,
    linkTypes: [
      {
        apiName: "nihalbCastingLinkedObjectTypeAs",
        displayName: "(nihalb) Casting Linked Object Type A",
        status: "EXPERIMENTAL",
        objectTypeApiName: "NihalbCastingLinkedObjectTypeA",
        cardinality: "MANY",
        linkTypeRid: "ri.ontology.main.relation.11001c0f-83a9-41c8-8e2d-38eee3061383",
      },
    ],
    implementsInterfaces: ["NihalbCastingInterfaceTypeA"],
    implementsInterfaces2: { NihalbCastingInterfaceTypeA: castingImplementationSaved },
    sharedPropertyTypeMapping: {},
  };

  const castingLinkSaved: typeof InterfaceLinkType.Encoded = {
    rid: "ri.ontology.main.interface-link.830df50e-1bad-4dab-b352-dd55b01191ec",
    apiName: "nihalbCastingLinkedObjectTypeA",
    displayName: "(nihalb) Casting Linked Object Type A",
    description: "",
    linkedEntityApiName: { type: "objectTypeApiName", apiName: "NihalbCastingLinkedObjectTypeA" },
    cardinality: "MANY",
    required: true,
  };

  const castingInterfacePropertySaved: NonNullable<InterfaceTypeWire["properties"]>[string] = {
    rid: "ri.ontology.main.shared-property.38ab96fe-719c-4f53-a53a-8ab595d8e038",
    apiName: "interfaceProperty",
    displayName: "InterfaceProperty",
    dataType: { type: "string" },
    required: true,
  };

  const castingInterfaceSaved: InterfaceTypeWire = {
    rid: "ri.ontology.main.interface.daed91f9-ee83-4e6c-bfc7-a17c8ff9433c",
    apiName: "NihalbCastingInterfaceTypeA",
    displayName: "(nihalb) CastingInterfaceTypeA",
    description: "",
    properties: { interfaceProperty: castingInterfacePropertySaved },
    allProperties: { interfaceProperty: castingInterfacePropertySaved },
    extendsInterfaces: [],
    allExtendsInterfaces: [],
    implementedByObjectTypes: ["NihalbCastingObjectTypeB", "NihalbCastingObjectTypeA"],
    links: { nihalbCastingLinkedObjectTypeA: castingLinkSaved },
    allLinks: { nihalbCastingLinkedObjectTypeA: castingLinkSaved },
  };

  it.effect(
    "an older saved object type decodes without the implementation records it predates, and they are written back",
    Effect.fnUntraced(function* () {
      const definition = yield* S.decodeEffect(ObjectTypeDefinition)(castingObjectSaved);
      const implementation = ObjectTypeDefinition.interfaceImplementation(
        definition,
        InterfaceTypeApiName.make("NihalbCastingInterfaceTypeA")
      );
      assertSome(
        O.map(implementation, (found) => [found.propertyImplementations, found.actionTypes]),
        [{}, {}]
      );
      assertSome(
        O.map(implementation, (found) => R.keys(found.links)),
        ["nihalbCastingLinkedObjectTypeA"]
      );
      const encoded = yield* S.encodeEffect(ObjectTypeDefinition)(definition);
      deepStrictEqual(encoded, {
        ...castingObjectSaved,
        objectType: {
          ...castingObjectTypeSaved,
          properties: {
            additionalProperty: { ...castingAdditionalPropertySaved, typeClasses: [] },
            primaryKey_: { ...castingPrimaryKeySaved, typeClasses: [] },
          },
          aliases: [],
          datasources: [],
        },
        implementsInterfaces2: {
          NihalbCastingInterfaceTypeA: { ...castingImplementationSaved, propertiesV2: {}, actionTypes: {} },
        },
      });
    })
  );

  it.effect(
    "an older saved interface decodes without the two newer property maps, and they are written back",
    Effect.fnUntraced(function* () {
      const interfaceType = yield* S.decodeEffect(InterfaceType)(castingInterfaceSaved);
      deepStrictEqual(R.keys(interfaceType.ownSharedProperties), ["interfaceProperty"]);
      deepStrictEqual(interfaceType.ownProperties, {});
      deepStrictEqual(interfaceType.inheritedAndOwnProperties, {});
      deepStrictEqual(R.keys(interfaceType.inheritedAndOwnLinks), ["nihalbCastingLinkedObjectTypeA"]);
      const encoded = yield* S.encodeEffect(InterfaceType)(interfaceType);
      deepStrictEqual(encoded, {
        ...castingInterfaceSaved,
        properties: { interfaceProperty: { ...castingInterfacePropertySaved, typeClasses: [] } },
        allProperties: { interfaceProperty: { ...castingInterfacePropertySaved, typeClasses: [] } },
        propertiesV2: {},
        allPropertiesV2: {},
      });
    })
  );
});

// -----------------------------------------------------------------------------
// Lookups
// -----------------------------------------------------------------------------

describe("lookups", () => {
  it.effect(
    "object, interface and action types are found by name, and a miss is none",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(ontologyWire);
      assertSome(
        O.map(getObjectType(ontology, employee), (definition) => definition.objectType.titleProperty),
        PropertyApiName.make("fullName")
      );
      assertNone(getObjectType(ontology, ObjectTypeApiName.make("Person")));
      assertSome(
        O.map(pipe(ontology, getInterfaceType(fooInterface)), (found) => found.displayName),
        "Foo Interface"
      );
      assertNone(getInterfaceType(ontology, interfaceNamed("Ghost")));
      assertSome(
        O.map(getActionType(ontology, promoteEmployee), (action) => R.size(action.parameters)),
        3
      );
      assertNone(pipe(ontology, getActionType(ActionTypeApiName.make("demote"))));
    })
  );

  it.effect(
    "a link side is found under the object type that holds it",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(ontologyWire);
      assertSome(
        O.map(getLinkSide(ontology, employee, linkNamed("officeLink")), (side) => side.targetObjectType),
        office
      );
      assertSome(
        O.map(pipe(ontology, getLinkSide(office, linkNamed("occupants"))), (side) => side.cardinality),
        "many"
      );
      assertNone(getLinkSide(ontology, office, linkNamed("officeLink")));
      assertNone(getLinkSide(ontology, ObjectTypeApiName.make("Person"), linkNamed("officeLink")));
    })
  );

  it.effect(
    "the reverse of a link side is the side of the same link type that leads back",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(ontologyWire);
      const reverseName = (objectType: ObjectTypeApiName, linkType: string) =>
        O.map(getReverseLinkSide(ontology, objectType, linkNamed(linkType)), (side) => `${side.apiName}`);
      assertSome(reverseName(employee, "officeLink"), "occupants");
      assertSome(reverseName(office, "occupants"), "officeLink");
      // A link from a type to itself: both sides sit under the same object type.
      assertSome(reverseName(employee, "peeps"), "lead");
      assertSome(reverseName(employee, "lead"), "peeps");
      assertNone(reverseName(employee, "missing"));
      assertNone(pipe(ontology, getReverseLinkSide(ObjectTypeApiName.make("Person"), linkNamed("peeps"))));
    })
  );

  it.effect(
    "reversing a link side twice gives the side back",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(ontologyWire);
      const sides = A.flatMap(R.toEntries(ontology.objectTypes), ([objectType, definition]) =>
        A.map(definition.linkTypes, (side) => Tuple.make(objectType, side))
      );
      const returned = A.map(sides, ([objectType, side]) =>
        pipe(
          getReverseLinkSide(ontology, objectType, side.apiName),
          O.flatMap((reverse) => getReverseLinkSide(ontology, side.targetObjectType, reverse.apiName)),
          O.map((back) => `${back.apiName}`),
          O.getOrNull
        )
      );
      deepStrictEqual(returned, ["peeps", "lead", "officeLink", "occupants"]);
    })
  );

  it.effect(
    "a pinned query is found by its own version, and latest only where the ontology files it as latest",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(
        queryTypesWith({ "myGroup:myFunction:latest": { ...incrementAgeWire, apiName: "myGroup:myFunction" } })
      );
      const select = (apiName: string, version: O.Option<string>) =>
        QuerySelector.make({
          apiName: QueryApiName.make(apiName),
          version: O.map(version, (text) => FunctionVersion.make(text)),
        });
      const versionOf = (selector: QuerySelector) =>
        O.map(getQueryType(ontology, selector), (found) => `${found.version}`);
      // Filed under the bare name: that entry is the latest, and it is also findable by the version it states.
      assertSome(versionOf(select("incrementPersonAgeComplex", O.none())), "0.0.9");
      assertSome(versionOf(select("incrementPersonAgeComplex", O.some("0.0.9"))), "0.0.9");
      assertNone(versionOf(select("incrementPersonAgeComplex", O.some("1.0.0"))));
      // Filed under a pinned name: findable by that version, and nothing says it is the latest.
      assertSome(versionOf(select("queryReturnsRecursiveStruct", O.some("0.1.0"))), "0.1.0");
      assertNone(versionOf(select("queryReturnsRecursiveStruct", O.none())));
      // Filed under name:latest.
      assertSome(
        pipe(
          ontology,
          getQueryType(select("myGroup:myFunction", O.none())),
          O.map((found) => `${found.apiName}`)
        ),
        "myGroup:myFunction"
      );
      assertNone(versionOf(select("unknown", O.none())));
    })
  );

  it.effect(
    "every key of the fixture parses as a versioned query name that selects its own entry",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(ontologyWire);
      const selectors = yield* Effect.forEach(R.keys(ontology.queryTypes), (key) =>
        S.decodeEffect(QuerySelectorFromVersionedApiName)(key)
      );
      deepStrictEqual(
        A.map(selectors, (selector) =>
          O.getOrNull(O.map(getQueryType(ontology, selector), (found) => `${found.apiName}`))
        ),
        ["incrementPersonAgeComplex", "queryReturnsRecursiveStruct", "queryAcceptsInterface"]
      );
    })
  );
});

// -----------------------------------------------------------------------------
// The link graph
// -----------------------------------------------------------------------------

describe("linkGraph", () => {
  it.effect(
    "has one node per object type and one edge per link side",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(ontologyWire);
      const graph = linkGraph(ontology);
      strictEqual(Graph.nodeCount(graph), 2);
      strictEqual(Graph.edgeCount(graph), 4);
      deepStrictEqual(pipe(graph, Graph.nodes, Graph.values, A.fromIterable), [employee, office]);
      deepStrictEqual(
        pipe(
          graph,
          Graph.edges,
          Graph.values,
          A.fromIterable,
          A.map((edge) => `${edge.data.apiName}`)
        ),
        ["peeps", "lead", "officeLink", "occupants"]
      );
      // The self link makes the graph cyclic, and the pair of sides makes it strongly connected.
      const acyclic = Graph.isAcyclic(graph);
      const stronglyConnected = Graph.isStronglyConnected(graph);
      assertFalse(acyclic);
      assertTrue(stronglyConnected);
    })
  );

  it.effect(
    "leaves out a side whose target is not defined",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(
        objectTypesWith({
          Employee: {
            ...employeeDefinitionWire,
            linkTypes: A.append(employeeLinkSidesWire, {
              ...visitedOfficesWire,
              objectTypeApiName: "Ghost",
            }),
          },
        })
      );
      strictEqual(Graph.edgeCount(linkGraph(ontology)), 4);
    })
  );

  it.effect(
    "reachability follows link sides forward, and an undefined start reaches nothing",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(
        objectTypesWith({
          Office: {
            ...officeDefinitionWire,
            linkTypes: [{ ...visitedOfficesWire, apiName: "building", objectTypeApiName: "Building" }],
          },
          Building: bareObjectTypeWire("Building", []),
          Vendor: bareObjectTypeWire("Vendor", []),
        })
      );
      deepStrictEqual(texts(reachableObjectTypes(ontology, employee)), ["Employee", "Office", "Building"]);
      deepStrictEqual(texts(pipe(ontology, reachableObjectTypes(office))), ["Office", "Building"]);
      deepStrictEqual(texts(reachableObjectTypes(ontology, ObjectTypeApiName.make("Building"))), ["Building"]);
      deepStrictEqual(texts(reachableObjectTypes(ontology, ObjectTypeApiName.make("Ghost"))), []);
    })
  );

  it.effect(
    "components group object types joined by links in either direction",
    Effect.fnUntraced(function* () {
      const connected = yield* decodeOntology(ontologyWire);
      deepStrictEqual(textGroups(linkComponents(connected)), [["Employee", "Office"]]);
      const islands = yield* decodeOntology(
        objectTypesWith({ Vendor: bareObjectTypeWire("Vendor", []), Badge: bareObjectTypeWire("Badge", []) })
      );
      deepStrictEqual(textGroups(A.map(linkComponents(islands), sortedNames)), [
        ["Employee", "Office"],
        ["Vendor"],
        ["Badge"],
      ]);
    })
  );
});

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------

describe("interfaces", () => {
  it.effect(
    "ancestors are every interface reached by extension, nearest first",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(
        interfaceTypesWith({
          Director: bareInterfaceWire("Director", ["Manager", "Ghost"]),
          Manager: bareInterfaceWire("Manager", ["FooInterface"]),
        })
      );
      deepStrictEqual(texts(interfaceAncestors(ontology, interfaceNamed("Director"))), ["Manager", "FooInterface"]);
      deepStrictEqual(texts(pipe(ontology, interfaceAncestors(interfaceNamed("Manager")))), ["FooInterface"]);
      deepStrictEqual(texts(interfaceAncestors(ontology, fooInterface)), []);
      deepStrictEqual(texts(interfaceAncestors(ontology, interfaceNamed("Ghost"))), []);
      strictEqual(Graph.edgeCount(interfaceGraph(ontology)), 2);
    })
  );

  it.effect(
    "ancestry terminates on a circle and never lists the interface itself",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology(
        interfaceTypesWith({
          A: bareInterfaceWire("A", ["B"]),
          B: bareInterfaceWire("B", ["C"]),
          C: bareInterfaceWire("C", ["A"]),
          Selfish: bareInterfaceWire("Selfish", ["Selfish"]),
        })
      );
      deepStrictEqual(texts(interfaceAncestors(ontology, interfaceNamed("A"))), ["B", "C"]);
      deepStrictEqual(texts(interfaceAncestors(ontology, interfaceNamed("C"))), ["A", "B"]);
      deepStrictEqual(texts(interfaceAncestors(ontology, interfaceNamed("Selfish"))), []);
    })
  );

  it.effect(
    "an object type claims an interface through either wire field",
    Effect.fnUntraced(function* () {
      const listed = yield* S.decodeEffect(ObjectTypeDefinition)(bareObjectTypeWire("Listed", ["FooInterface"]));
      const keyed = yield* S.decodeEffect(ObjectTypeDefinition)({
        ...bareObjectTypeWire("Keyed", []),
        implementsInterfaces2: { BarInterface: { properties: {}, propertiesV2: {}, links: {}, actionTypes: {} } },
      });
      const both = yield* S.decodeEffect(ObjectTypeDefinition)(employeeDefinitionWire);
      deepStrictEqual(claimedInterfaces(listed), [fooInterface]);
      deepStrictEqual(claimedInterfaces(keyed), [barInterface]);
      deepStrictEqual(claimedInterfaces(both), [fooInterface]);
    })
  );

  it.effect(
    "implementers are the object types that claim an interface or one that extends it",
    Effect.fnUntraced(function* () {
      const ontology = yield* decodeOntology({
        ...ontologyWire,
        interfaceTypes: { ...ontologyWire.interfaceTypes, Manager: bareInterfaceWire("Manager", ["FooInterface"]) },
        objectTypes: { ...ontologyWire.objectTypes, Director: bareObjectTypeWire("Director", ["Manager"]) },
      });
      deepStrictEqual(texts(implementers(ontology, fooInterface)), ["Employee", "Director"]);
      deepStrictEqual(texts(pipe(ontology, implementers(interfaceNamed("Manager")))), ["Director"]);
      deepStrictEqual(texts(implementers(ontology, barInterface)), []);
    })
  );
});

// -----------------------------------------------------------------------------
// API namespaces
// -----------------------------------------------------------------------------

describe("API namespaces", () => {
  const localName = Arbitrary.schema(S.String.check(S.isPattern(/^[A-Za-z][A-Za-z0-9_]{0,20}$/)));
  const namespace = Arbitrary.schema(S.String.check(S.isPattern(/^[a-z0-9-]{1,8}(\.[a-z0-9-]{1,8}){0,3}$/)));

  it("splits at the last dot", () => {
    deepStrictEqual(
      splitApiName("com.example.Employee"),
      ApiNameParts.make({ namespace: O.some("com.example"), localName: "Employee" })
    );
    deepStrictEqual(splitApiName("Employee"), ApiNameParts.make({ localName: "Employee" }));
    deepStrictEqual(splitApiName(""), ApiNameParts.make({ localName: "" }));
    deepStrictEqual(splitApiName("a."), ApiNameParts.make({ namespace: O.some("a"), localName: "" }));
    // A leading dot leaves nothing before it, and nothing is not a namespace.
    deepStrictEqual(splitApiName(".Employee"), ApiNameParts.make({ localName: "Employee" }));
  });

  it("qualifies a local name once, in both call styles", () => {
    strictEqual(qualifyApiName("Employee", "com.example"), "com.example.Employee");
    strictEqual(pipe("Employee", qualifyApiName("com.example.")), "com.example.Employee");
    strictEqual(qualifyApiName("com.example.Employee", "org.other"), "com.example.Employee");
    strictEqual(qualifyApiName("Employee", ""), "Employee");
  });

  it.prop(
    "splitting undoes qualifying a local name",
    [localName, namespace],
    ([local, prefix]) => {
      deepStrictEqual(
        splitApiName(qualifyApiName(local, prefix)),
        ApiNameParts.make({ namespace: O.some(prefix), localName: local })
      );
    },
    { arbitrary: fcRuns(100) }
  );

  it.prop(
    "qualifying is idempotent",
    [localName, namespace, namespace],
    ([local, first, second]) => qualifyApiName(qualifyApiName(local, first), second) === qualifyApiName(local, first),
    { arbitrary: fcRuns(100) }
  );

  it("the parts record rejects an empty namespace", () => {
    assertFalse(S.is(ApiNameParts)({ namespace: O.some(""), localName: "Employee" }));
    assertTrue(S.is(ApiNameParts)({ namespace: O.none(), localName: "Employee" }));
  });
});

// -----------------------------------------------------------------------------
// Findings
// -----------------------------------------------------------------------------

describe("OntologyFinding", () => {
  const everyCase: ReadonlyArray<OntologyFinding> = [
    OntologyFinding.cases.linkTargetMissing.make({
      objectType: employee,
      linkType: linkNamed("badge"),
      targetObjectType: ObjectTypeApiName.make("Badge"),
    }),
    OntologyFinding.cases.linkReverseMissing.make({
      objectType: employee,
      linkType: linkNamed("visitedOffices"),
      targetObjectType: office,
    }),
    OntologyFinding.cases.interfaceParentMissing.make({ interfaceType: fooInterface, parent: interfaceNamed("Ghost") }),
    OntologyFinding.cases.interfaceExtensionCycle.make({ interfaceTypes: [fooInterface, barInterface] }),
    OntologyFinding.cases.claimedInterfaceMissing.make({ objectType: office, interfaceType: interfaceNamed("Ghost") }),
    OntologyFinding.cases.implementerNotClaiming.make({ interfaceType: fooInterface, objectType: office }),
    OntologyFinding.cases.implementedPropertyMissing.make({
      objectType: employee,
      interfaceType: fooInterface,
      interfaceProperty: InterfacePropertyApiName.make("fooIdp"),
      property: PropertyApiName.make("cubicle"),
    }),
    OntologyFinding.cases.interfaceLinkTargetMissing.make({
      interfaceType: fooInterface,
      link: InterfaceLinkTypeApiName.make("toBar"),
      missing: ghostInterface,
    }),
    OntologyFinding.cases.actionParameterTypeMissing.make({
      actionType: promoteEmployee,
      parameter: ParameterId.make("employee"),
      missing: ghostObjectType,
    }),
    OntologyFinding.cases.actionOperationTypeMissing.make({
      actionType: promoteEmployee,
      operation: 0,
      missing: ghostObjectType,
    }),
    OntologyFinding.cases.queryReferenceMissing.make({
      query: VersionedQueryApiName.make("incrementPersonAgeComplex"),
      missing: ghostObjectType,
    }),
    OntologyFinding.cases.typeReferenceDangling.make({
      query: VersionedQueryApiName.make("queryReturnsRecursiveStruct:0.1.0"),
      typeId: TypeReferenceId.make("recursive-tree-node"),
    }),
    OntologyFinding.cases.propertyValueTypeMissing.make({
      objectType: office,
      property: PropertyApiName.make("name"),
      valueType: ValueTypeApiName.make("officeName"),
    }),
    OntologyFinding.cases.sharedPropertyTypeMissing.make({
      objectType: employee,
      property: PropertyApiName.make("fullName"),
      sharedPropertyType: SharedPropertyTypeApiName.make("fooSpt"),
    }),
  ];

  it("has one case per kind, in the kit's order", () => {
    deepStrictEqual<ReadonlyArray<OntologyFindingKind>>(
      A.map(everyCase, (finding) => finding.type),
      OntologyFindingKind.literals
    );
    assertTrue(A.every(everyCase, S.is(OntologyFinding)));
  });

  it("matches every case exhaustively", () => {
    const subject: (finding: OntologyFinding) => string = OntologyFinding.match({
      linkTargetMissing: ({ objectType, linkType }) => `${objectType}.${linkType}`,
      linkReverseMissing: ({ objectType, linkType }) => `${objectType}.${linkType}`,
      interfaceParentMissing: ({ interfaceType }) => interfaceType,
      interfaceExtensionCycle: ({ interfaceTypes }) => A.join(interfaceTypes, ">"),
      claimedInterfaceMissing: ({ objectType }) => objectType,
      implementerNotClaiming: ({ interfaceType }) => interfaceType,
      implementedPropertyMissing: ({ objectType, property }) => `${objectType}.${property}`,
      interfaceLinkTargetMissing: ({ interfaceType, link }) => `${interfaceType}.${link}`,
      actionParameterTypeMissing: ({ actionType, parameter }) => `${actionType}(${parameter})`,
      actionOperationTypeMissing: ({ actionType, operation }) => `${actionType}[${operation}]`,
      queryReferenceMissing: ({ query }) => query,
      typeReferenceDangling: ({ query, typeId }) => `${query}#${typeId}`,
      propertyValueTypeMissing: ({ objectType, property }) => `${objectType}.${property}`,
      sharedPropertyTypeMissing: ({ objectType, property }) => `${objectType}.${property}`,
    });
    deepStrictEqual(A.map(everyCase, subject), [
      "Employee.badge",
      "Employee.visitedOffices",
      "FooInterface",
      "FooInterface>BarInterface",
      "Office",
      "FooInterface",
      "Employee.cubicle",
      "FooInterface.toBar",
      "promoteEmployeeObject(employee)",
      "promoteEmployeeObject[0]",
      "incrementPersonAgeComplex",
      "queryReturnsRecursiveStruct:0.1.0#recursive-tree-node",
      "Office.name",
      "Employee.fullName",
    ]);
  });

  it("guards tell the cases apart", () => {
    strictEqual(A.length(A.filter(everyCase, OntologyFinding.guards.interfaceExtensionCycle)), 1);
    strictEqual(A.length(A.filter(everyCase, OntologyFinding.isAnyOf(["linkTargetMissing", "linkReverseMissing"]))), 2);
  });

  it("rejects a circle of no interfaces and an operation at a negative position", () => {
    assertRejects(OntologyFinding, { type: "interfaceExtensionCycle", interfaceTypes: [] }, "interfaceTypes");
    assertRejects(
      OntologyFinding,
      {
        type: "actionOperationTypeMissing",
        actionType: "promote",
        operation: -1,
        missing: { type: "objectTypeApiName", apiName: "Ghost" },
      },
      "operation"
    );
    assertRejects(OntologyFinding, { type: "somethingElse" }, "OntologyFinding");
  });
});

// -----------------------------------------------------------------------------
// Validation: the sound fixture, then one break per rule
// -----------------------------------------------------------------------------

describe("validateOntology", () => {
  reports("the assembled stub ontology has no findings", ontologyWire, []);

  // --- links -------------------------------------------------------------------------------------------------

  reports(
    "a link side whose target object type is not defined",
    objectTypesWith({
      Employee: {
        ...employeeDefinitionWire,
        linkTypes: A.append(employeeLinkSidesWire, {
          apiName: "badge",
          displayName: "Badge",
          status: "ACTIVE",
          objectTypeApiName: "Badge",
          cardinality: "ONE",
          linkTypeRid: "rid.link-type.900",
        }),
      },
    }),
    [
      LinkTargetMissing.make({
        objectType: employee,
        linkType: linkNamed("badge"),
        targetObjectType: ObjectTypeApiName.make("Badge"),
      }),
    ]
  );

  reports(
    "a link side its target does not answer (the stub's visitedOffices)",
    objectTypesWith({
      Employee: {
        ...employeeDefinitionWire,
        linkTypes: A.append(employeeLinkSidesWire, visitedOfficesWire),
      },
    }),
    [LinkReverseMissing.make({ objectType: employee, linkType: linkNamed("visitedOffices"), targetObjectType: office })]
  );

  reports(
    "removing one side of a link type leaves the other unanswered",
    objectTypesWith({ Office: { ...officeDefinitionWire, linkTypes: [] } }),
    [LinkReverseMissing.make({ objectType: employee, linkType: linkNamed("officeLink"), targetObjectType: office })]
  );

  reports(
    "a side of the same link type that leads elsewhere is not an answer",
    objectTypesWith({
      Office: { ...officeDefinitionWire, linkTypes: [{ ...occupantsWire, objectTypeApiName: "Office" }] },
    }),
    [
      LinkReverseMissing.make({ objectType: employee, linkType: linkNamed("officeLink"), targetObjectType: office }),
      LinkReverseMissing.make({ objectType: office, linkType: linkNamed("occupants"), targetObjectType: office }),
    ]
  );

  reports(
    "a self link with one side alone does not answer itself",
    objectTypesWith({
      Employee: { ...employeeDefinitionWire, linkTypes: [peepsWire, officeLinkWire] },
    }),
    [LinkReverseMissing.make({ objectType: employee, linkType: linkNamed("peeps"), targetObjectType: employee })]
  );

  // --- interface inheritance ---------------------------------------------------------------------------------

  reports(
    "an interface that extends an undefined interface",
    interfaceTypesWith({ FooInterface: { ...fooInterfaceWire, extendsInterfaces: ["Ghost"] } }),
    [InterfaceParentMissing.make({ interfaceType: fooInterface, parent: interfaceNamed("Ghost") })]
  );

  reports(
    "an interface that extends itself",
    interfaceTypesWith({ FooInterface: { ...fooInterfaceWire, extendsInterfaces: ["FooInterface"] } }),
    [InterfaceExtensionCycle.make({ interfaceTypes: [fooInterface] })]
  );

  it.effect(
    "two interfaces that extend each other are one circle",
    Effect.fnUntraced(function* () {
      const findings = yield* findingsOf(
        interfaceTypesWith({
          FooInterface: { ...fooInterfaceWire, extendsInterfaces: ["BarInterface"] },
          BarInterface: { ...barInterfaceWire, extendsInterfaces: ["FooInterface"] },
        })
      );
      strictEqual(A.length(findings), 1);
      deepStrictEqual(
        A.map(A.filter(findings, OntologyFinding.guards.interfaceExtensionCycle), (finding) =>
          sortedNames(finding.interfaceTypes)
        ),
        [["BarInterface", "FooInterface"]]
      );
    })
  );

  it.effect(
    "every circle is reported, and interfaces that merely lead into one are not",
    Effect.fnUntraced(function* () {
      const findings = yield* findingsOf(
        interfaceTypesWith({
          A: bareInterfaceWire("A", ["B"]),
          B: bareInterfaceWire("B", ["C"]),
          C: bareInterfaceWire("C", ["A"]),
          X: bareInterfaceWire("X", ["Y"]),
          Y: bareInterfaceWire("Y", ["X"]),
          Entering: bareInterfaceWire("Entering", ["A"]),
          Sound: bareInterfaceWire("Sound", ["FooInterface"]),
        })
      );
      assertTrue(A.every(findings, OntologyFinding.guards.interfaceExtensionCycle));
      deepStrictEqual(
        pipe(
          A.filter(findings, OntologyFinding.guards.interfaceExtensionCycle),
          A.map((finding) => A.join(sortedNames(finding.interfaceTypes), ",")),
          sortedNames
        ),
        ["A,B,C", "X,Y"]
      );
    })
  );

  // --- interface implementation ------------------------------------------------------------------------------

  reports(
    "an object type that claims an undefined interface, through either wire field",
    objectTypesWith({
      Office: {
        ...officeDefinitionWire,
        implementsInterfaces: ["Ghost"],
        implementsInterfaces2: { Spectre: { properties: {}, propertiesV2: {}, links: {}, actionTypes: {} } },
      },
    }),
    [
      ClaimedInterfaceMissing.make({ objectType: office, interfaceType: interfaceNamed("Ghost") }),
      ClaimedInterfaceMissing.make({ objectType: office, interfaceType: interfaceNamed("Spectre") }),
    ]
  );

  reports(
    "an interface that lists implementers that do not claim it (the stub's Person, and a defined type)",
    interfaceTypesWith({
      FooInterface: { ...fooInterfaceWire, implementedByObjectTypes: ["Employee", "Person", "Office"] },
    }),
    [
      ImplementerNotClaiming.make({ interfaceType: fooInterface, objectType: ObjectTypeApiName.make("Person") }),
      ImplementerNotClaiming.make({ interfaceType: fooInterface, objectType: office }),
    ]
  );

  reports(
    "an implementer that claims an extending interface does claim the extended one",
    {
      ...ontologyWire,
      interfaceTypes: {
        ...ontologyWire.interfaceTypes,
        FooInterface: { ...fooInterfaceWire, implementedByObjectTypes: ["Employee", "Director"] },
        Manager: bareInterfaceWire("Manager", ["FooInterface"]),
      },
      objectTypes: { ...ontologyWire.objectTypes, Director: bareObjectTypeWire("Director", ["Manager"]) },
    },
    []
  );

  reports(
    "an implementation that names undeclared properties, in every way of implementing",
    objectTypesWith({
      Employee: {
        ...employeeDefinitionWire,
        implementsInterfaces2: {
          FooInterface: {
            properties: { fooSpt: "fullName" },
            propertiesV2: {
              fooSpt: { type: "localPropertyImplementation", propertyApiName: "fullName" },
              fooIdp: { type: "localPropertyImplementation", propertyApiName: "cubicle" },
              fooField: {
                type: "structFieldImplementation",
                structFieldOfProperty: { propertyApiName: "nestedStruct", structFieldApiName: "label" },
              },
              fooStruct: {
                type: "structImplementation",
                mapping: {
                  theBio: {
                    type: "structFieldOfProperty",
                    propertyApiName: "employeeProfile",
                    structFieldApiName: "bio",
                  },
                  theAlpha: {
                    type: "structFieldOfProperty",
                    propertyApiName: "multiStruct",
                    structFieldApiName: "alpha",
                  },
                  theBeta: {
                    type: "structFieldOfProperty",
                    propertyApiName: "multiStruct",
                    structFieldApiName: "beta",
                  },
                  theWhole: { type: "property", propertyApiName: "wholeValue" },
                },
              },
              fooReduced: {
                type: "reducedPropertyImplementation",
                implementation: { type: "localPropertyImplementation", propertyApiName: "arrayValue" },
              },
              fooScores: {
                type: "reducedPropertyImplementation",
                implementation: { type: "localPropertyImplementation", propertyApiName: "performanceScores" },
              },
            },
            links: {},
            actionTypes: {},
          },
        },
      },
    }),
    A.map(
      [
        Tuple.make("fooIdp", "cubicle"),
        Tuple.make("fooField", "nestedStruct"),
        Tuple.make("fooStruct", "multiStruct"),
        Tuple.make("fooStruct", "wholeValue"),
        Tuple.make("fooReduced", "arrayValue"),
      ],
      ([interfaceProperty, property]) =>
        ImplementedPropertyMissing.make({
          objectType: employee,
          interfaceType: fooInterface,
          interfaceProperty: InterfacePropertyApiName.make(interfaceProperty),
          property: PropertyApiName.make(property),
        })
    )
  );

  reports(
    "an interface link that points at an undefined interface or object type",
    {
      ...ontologyWire,
      interfaceTypes: {
        FooInterface: {
          ...fooInterfaceWire,
          links: {
            toBar: toBarLinkWire,
            toOffice: {
              ...toBarLinkWire,
              apiName: "toOffice",
              linkedEntityApiName: { type: "objectTypeApiName", apiName: "Office" },
            },
            toGhost: {
              ...toBarLinkWire,
              apiName: "toGhost",
              linkedEntityApiName: { type: "objectTypeApiName", apiName: "Ghost" },
            },
          },
        },
      },
    },
    [
      InterfaceLinkTargetMissing.make({
        interfaceType: fooInterface,
        link: InterfaceLinkTypeApiName.make("toBar"),
        missing: LinkedInterfaceType.make({ apiName: barInterface }),
      }),
      InterfaceLinkTargetMissing.make({
        interfaceType: fooInterface,
        link: InterfaceLinkTypeApiName.make("toGhost"),
        missing: ghostObjectType,
      }),
    ]
  );

  // --- actions -----------------------------------------------------------------------------------------------

  reports(
    "action parameters whose types refer to undefined types, however deeply",
    actionTypesWith({
      relocate: {
        apiName: "relocate",
        rid: "ri.ontology.main.action-type.relocate",
        status: "ACTIVE",
        parameters: {
          who: {
            displayName: "Who",
            dataType: { type: "object", objectApiName: "Ghost", objectTypeApiName: "Ghost" },
            required: true,
            typeClasses: [],
          },
          team: {
            displayName: "Team",
            dataType: { type: "array", subType: { type: "objectSet", objectTypeApiName: "Ghost" } },
            required: false,
            typeClasses: [],
          },
          through: {
            displayName: "Through",
            dataType: { type: "interfaceObject", interfaceTypeApiName: "GhostInterface" },
            required: false,
            typeClasses: [],
          },
          form: {
            displayName: "Form",
            dataType: {
              type: "struct",
              fields: [
                { name: "city", fieldType: { type: "string" }, required: true },
                {
                  name: "desks",
                  fieldType: {
                    type: "map",
                    keyType: { type: "string" },
                    valueType: {
                      type: "array",
                      itemType: { type: "object", objectApiName: "Ghost", objectTypeApiName: "Ghost" },
                    },
                  },
                  required: false,
                },
              ],
            },
            required: false,
            typeClasses: [],
          },
          sound: {
            displayName: "Sound",
            dataType: { type: "objectSet", objectApiName: "Office", objectTypeApiName: "Office" },
            required: false,
            typeClasses: [],
          },
          any: { displayName: "Any", dataType: { type: "interfaceObject" }, required: false, typeClasses: [] },
        },
        operations: [],
      },
    }),
    A.map(
      [
        Tuple.make("who", ghostObjectType),
        Tuple.make("team", ghostObjectType),
        Tuple.make("through", ghostInterface),
        Tuple.make("form", ghostObjectType),
      ],
      ([parameter, missing]) =>
        ActionParameterTypeMissing.make({
          actionType: ActionTypeApiName.make("relocate"),
          parameter: ParameterId.make(parameter),
          missing,
        })
    )
  );

  reports(
    "action operations that edit undefined types, located by position",
    actionTypesWith({
      restructure: {
        apiName: "restructure",
        rid: "ri.ontology.main.action-type.restructure",
        status: "ACTIVE",
        parameters: {},
        operations: [
          { type: "modifyObject", objectTypeApiName: "Employee" },
          { type: "createObject", objectTypeApiName: "Ghost" },
          {
            type: "createLink",
            linkTypeApiNameAtoB: "officeLink",
            linkTypeApiNameBtoA: "occupants",
            aSideObjectTypeApiName: "Employee",
            bSideObjectTypeApiName: "Ghost",
          },
          { type: "deleteInterfaceObject", interfaceTypeApiName: "GhostInterface" },
          { type: "modifyInterfaceObject", interfaceTypeApiName: "FooInterface" },
        ],
      },
    }),
    A.map(
      [Tuple.make(1, ghostObjectType), Tuple.make(2, ghostObjectType), Tuple.make(3, ghostInterface)],
      ([operation, missing]) =>
        ActionOperationTypeMissing.make({ actionType: ActionTypeApiName.make("restructure"), operation, missing })
    )
  );

  // --- queries -----------------------------------------------------------------------------------------------

  reports(
    "a query whose signature refers to undefined types, each reported once",
    queryTypesWith({
      "census:1.0.0": {
        apiName: "census",
        parameters: {
          people: {
            dataType: {
              type: "entrySet",
              keyType: { type: "object", objectApiName: "Ghost", objectTypeApiName: "Ghost" },
              valueType: {
                type: "set",
                subType: { type: "interfaceObjectSet", interfaceTypeApiName: "GhostInterface" },
              },
            },
            required: true,
          },
        },
        output: {
          type: "union",
          unionTypes: [
            { type: "objectSet", objectApiName: "Ghost", objectTypeApiName: "Ghost" },
            { type: "typeReference", typeId: "row" },
            { type: "null" },
          ],
        },
        rid: "ri.function-registry.main.function.census",
        version: "1.0.0",
        typeReferences: {
          row: {
            type: "struct",
            fields: [
              { name: "office", fieldType: { type: "object", objectApiName: "Office", objectTypeApiName: "Office" } },
              {
                name: "spectre",
                fieldType: { type: "object", objectApiName: "Spectre", objectTypeApiName: "Spectre" },
              },
            ],
          },
        },
      },
    }),
    A.map(
      [ghostObjectType, ghostInterface, LinkedObjectType.make({ apiName: ObjectTypeApiName.make("Spectre") })],
      (missing) => QueryReferenceMissing.make({ query: VersionedQueryApiName.make("census:1.0.0"), missing })
    )
  );

  reports(
    "a by-name reference the query's own table does not hold",
    queryTypesWith({ "queryReturnsRecursiveStruct:0.1.0": { ...recursiveStructWire, typeReferences: {} } }),
    [
      TypeReferenceDangling.make({
        query: VersionedQueryApiName.make("queryReturnsRecursiveStruct:0.1.0"),
        typeId: TypeReferenceId.make("recursive-tree-node"),
      }),
    ]
  );

  reports(
    "a dangling reference nested inside a named type",
    queryTypesWith({
      "queryReturnsRecursiveStruct:0.1.0": {
        ...recursiveStructWire,
        typeReferences: {
          "recursive-tree-node": {
            type: "struct",
            fields: [
              { name: "next", fieldType: { type: "array", subType: { type: "typeReference", typeId: "lost" } } },
            ],
          },
        },
      },
    }),
    [
      TypeReferenceDangling.make({
        query: VersionedQueryApiName.make("queryReturnsRecursiveStruct:0.1.0"),
        typeId: TypeReferenceId.make("lost"),
      }),
    ]
  );

  // --- properties --------------------------------------------------------------------------------------------

  const officeNamedByValueType: OntologyWire = objectTypesWith({
    Office: {
      ...officeDefinitionWire,
      objectType: {
        ...officeWire,
        properties: {
          ...officeWire.properties,
          name: { dataType: { type: "string" }, rid: "rid", typeClasses: [], valueTypeApiName: "officeName" },
        },
      },
    },
  });

  reports("a property that names an undefined value type", officeNamedByValueType, [
    PropertyValueTypeMissing.make({
      objectType: office,
      property: PropertyApiName.make("name"),
      valueType: ValueTypeApiName.make("officeName"),
    }),
  ]);

  reports(
    "defining the value type clears the finding",
    {
      ...officeNamedByValueType,
      valueTypes: {
        officeName: {
          apiName: "officeName",
          displayName: "Office name",
          rid: "ri.ontology.main.value-type.office-name",
          version: "1.0.0",
          fieldType: { type: "string" },
          constraints: [],
        },
      },
    },
    []
  );

  reports("a property mapped to an undefined shared property type", { ...ontologyWire, sharedPropertyTypes: {} }, [
    SharedPropertyTypeMissing.make({
      objectType: employee,
      property: PropertyApiName.make("fullName"),
      sharedPropertyType: SharedPropertyTypeApiName.make("fooSpt"),
    }),
  ]);

  // --- the whole ---------------------------------------------------------------------------------------------

  reports(
    "the stub files as shipped carry exactly two findings",
    {
      ...ontologyWire,
      objectTypes: {
        ...ontologyWire.objectTypes,
        Employee: { ...employeeDefinitionWire, linkTypes: [peepsWire, leadWire, officeLinkWire, visitedOfficesWire] },
      },
      interfaceTypes: {
        ...ontologyWire.interfaceTypes,
        FooInterface: { ...fooInterfaceWire, implementedByObjectTypes: ["Employee", "Person"] },
      },
    },
    [
      LinkReverseMissing.make({
        objectType: employee,
        linkType: linkNamed("visitedOffices"),
        targetObjectType: office,
      }),
      ImplementerNotClaiming.make({ interfaceType: fooInterface, objectType: ObjectTypeApiName.make("Person") }),
    ]
  );

  it.effect(
    "findings of every rule arrive together, and all of them are valid findings",
    Effect.fnUntraced(function* () {
      const findings = yield* findingsOf({
        ...ontologyWire,
        objectTypes: { Employee: employeeDefinitionWire },
        interfaceTypes: {},
        sharedPropertyTypes: {},
        queryTypes: {
          "queryReturnsRecursiveStruct:0.1.0": { ...recursiveStructWire, typeReferences: {} },
          acceptsInterface: acceptsInterfaceWire,
        },
      });
      deepStrictEqual(
        A.map(findings, (finding) => finding.type),
        [
          "linkTargetMissing",
          "claimedInterfaceMissing",
          "queryReferenceMissing",
          "typeReferenceDangling",
          "sharedPropertyTypeMissing",
        ]
      );
      assertTrue(A.every(findings, S.is(OntologyFinding)));
    })
  );

  it.prop(
    "any decodable ontology validates without throwing, into valid findings",
    [Arbitrary.schema(OntologyDefinition)],
    ([ontology]) => A.every(validateOntology(ontology), S.is(OntologyFinding)),
    { arbitrary: fcRuns(10) }
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
      SameType<OntologyDefinition["identity"], OntologyIdentity>,
    ] = [true];
    assertTrue(A.every(facts, (fact) => fact));
  });
});
