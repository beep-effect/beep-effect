import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertInclude, assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { IntegerType, StringType } from "../src/DataType/DataType.model.ts";
import {
  InterfaceLinkTypeApiName,
  InterfaceLinkTypeRid,
  InterfacePropertyApiName,
  InterfacePropertyTypeRid,
  InterfaceTypeApiName,
  InterfaceTypeRid,
  ObjectTypeApiName,
  SharedPropertyTypeApiName,
  SharedPropertyTypeRid,
} from "../src/Identifier/Identifier.model.ts";
import {
  InterfaceDefinedPropertyType,
  InterfaceLinkCardinality,
  InterfaceLinkType,
  InterfacePropertyType,
  InterfaceSharedPropertyType,
  InterfaceType,
  LinkedEntity,
  LinkedInterfaceType,
  LinkedObjectType,
  ResolvedInterfacePropertyType,
} from "../src/InterfaceType/index.ts";
import { TypeClass } from "../src/Metadata/Metadata.values.ts";
import { ArrayType } from "../src/Property/Property.model.ts";
import type { PropertyType, SharedPropertyType } from "../src/Property/Property.model.ts";

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

/** Asserts that decoding fails and that the failure names the violated rule or the offending path. */
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

// -----------------------------------------------------------------------------
// Wire fixtures transcribed from osdk-ts `packages/shared.test/src/stubs/interfaceTypes.ts` (and `spts.ts`)
// -----------------------------------------------------------------------------

type InterfaceTypeWire = (typeof InterfaceType)["Encoded"];

const stringDataType: PropertyType.Encoded = { type: "string" };
const stringArrayDataType: PropertyType.Encoded = { type: "array", subType: { type: "string" }, reducers: [] };

/** `fooSpt` of `spts.ts`: a shared property type as the wire sends it. */
const fooSpt: (typeof SharedPropertyType)["Encoded"] = {
  rid: "ri.sharedPropertyType.main.sharedPropertyType.1",
  apiName: "fooSpt",
  dataType: stringDataType,
  displayName: "Foo",
  description: "A foo",
  typeClasses: [],
};

/** `idp` of the stub file: an interface-defined property before the union tag is added. */
const idp = {
  rid: "ri.interfacePropertyType.main.interfacePropertyType.1",
  apiName: "fooIdp",
  displayName: "Foo IDP",
  description: "A Foo IDP",
  dataType: stringDataType,
  requireImplementation: true,
  typeClasses: [],
};

/** `arrayIdp` of the stub file. */
const arrayIdp = {
  rid: "ri.interfacePropertyType.main.interfacePropertyType.2",
  apiName: "fooArray",
  displayName: "Foo Array",
  description: "An array-valued Foo property",
  dataType: stringArrayDataType,
  requireImplementation: false,
  typeClasses: [],
};

const toFooLinkWire: (typeof InterfaceLinkType)["Encoded"] = {
  rid: "ri.interface.link.main.1",
  apiName: "toFoo",
  linkedEntityApiName: { type: "interfaceTypeApiName", apiName: "FooInterface" },
  displayName: "foos",
  cardinality: "MANY",
  required: true,
};

const toBarLinkWire: (typeof InterfaceLinkType)["Encoded"] = {
  rid: "ri.interface.link.main.2",
  apiName: "toBar",
  linkedEntityApiName: { type: "interfaceTypeApiName", apiName: "BarInterface" },
  displayName: "bars",
  cardinality: "MANY",
  required: true,
};

/** `BarInterface` of the stub file: no properties, one link to an interface. */
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
 * `FooInterface` exactly as the stub file evaluates. Its `allPropertiesV2` entries are built with spreads and so
 * carry a `typeClasses` key that the wire's `ResolvedInterfacePropertyType` does not declare.
 */
const fooInterfaceStub: InterfaceTypeWire = {
  apiName: "FooInterface",
  description: "Interface for Foo",
  displayName: "Foo Interface",
  rid: "ri.interface.main.interface.1",
  extendsInterfaces: [],
  properties: {
    fooSpt: { ...fooSpt, required: true },
  },
  propertiesV2: {
    fooSpt: { ...fooSpt, type: "interfaceSharedPropertyType", required: true },
    fooIdp: { ...idp, type: "interfaceDefinedPropertyType" },
    fooArray: { ...arrayIdp, type: "interfaceDefinedPropertyType" },
  },
  links: { toBar: toBarLinkWire },
  implementedByObjectTypes: ["Employee", "Person"],
  allProperties: {
    fooSpt: { ...fooSpt, required: true },
  },
  allPropertiesV2: {
    fooSpt: { ...fooSpt, requireImplementation: true },
    fooIdp: { ...idp },
    fooArray: { ...arrayIdp },
  },
  allExtendsInterfaces: [],
  allLinks: { toBar: toBarLinkWire },
};

/** `FooInterface` as the declared wire type allows it: the stub without the undeclared `typeClasses` keys. */
const fooInterfaceWire: InterfaceTypeWire = {
  ...fooInterfaceStub,
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
    fooArray: {
      rid: "ri.interfacePropertyType.main.interfacePropertyType.2",
      apiName: "fooArray",
      displayName: "Foo Array",
      description: "An array-valued Foo property",
      dataType: { type: "array", subType: { type: "string" }, reducers: [] },
      requireImplementation: false,
    },
  },
};

// -----------------------------------------------------------------------------
// A payload served by a real ontology: `Person` of osdk-ts `packages/e2e.sandbox.peopleapp/ontology.json`
// -----------------------------------------------------------------------------

const selectableAndSortable: ReadonlyArray<(typeof TypeClass)["Encoded"]> = [
  { kind: "render_hint", name: "SELECTABLE" },
  { kind: "render_hint", name: "SORTABLE" },
];

const personEmailWire = {
  rid: "ri.ontology.main.shared-property.2645943a-6870-4fe3-ac30-a27ff1c77b69",
  apiName: "email",
  displayName: "Email",
  dataType: stringDataType,
  required: true,
  typeClasses: selectableAndSortable,
};

const integerDataType: PropertyType.Encoded = { type: "integer" };

const personEmployeeNumberWire = {
  rid: "ri.ontology.main.shared-property.631f0dd2-4e78-4c2a-8487-c767a448d227",
  apiName: "employeeNumber",
  displayName: "Employee Number",
  dataType: integerDataType,
  required: true,
  typeClasses: [],
};

const personLinksWire: InterfaceTypeWire["links"] = {
  peeps: {
    rid: "ri.ontology.main.interface-link.a9fcc905-c097-42de-b441-a86df889b442",
    apiName: "peeps",
    displayName: "Peeps",
    description: "",
    linkedEntityApiName: { type: "interfaceTypeApiName", apiName: "Person" },
    cardinality: "MANY",
    required: true,
  },
  office: {
    rid: "ri.ontology.main.interface-link.1cfe8795-d580-4b55-9af8-24d413525d44",
    apiName: "office",
    displayName: "Office",
    description: "",
    linkedEntityApiName: { type: "objectTypeApiName", apiName: "Office" },
    cardinality: "ONE",
    required: false,
  },
  lead: {
    rid: "ri.ontology.main.interface-link.28fe3c97-e291-44f5-8d47-3f9b6f642ea6",
    apiName: "lead",
    displayName: "Lead",
    description: "",
    linkedEntityApiName: { type: "interfaceTypeApiName", apiName: "Person" },
    cardinality: "ONE",
    required: true,
  },
};

const personInterfaceWire: InterfaceTypeWire = {
  rid: "ri.ontology.main.interface.353734ce-ae2d-4e49-8070-163b2126af5a",
  apiName: "Person",
  displayName: "Person",
  description: "",
  properties: { email: personEmailWire, employeeNumber: personEmployeeNumberWire },
  allProperties: { email: personEmailWire, employeeNumber: personEmployeeNumberWire },
  propertiesV2: {
    email: { type: "interfaceSharedPropertyType", ...personEmailWire },
    employeeNumber: { type: "interfaceSharedPropertyType", ...personEmployeeNumberWire },
  },
  allPropertiesV2: {
    email: {
      rid: "ri.ontology.main.interface-property.2645943a-6870-4fe3-ac30-a27ff1c77b69",
      apiName: "email",
      displayName: "Email",
      dataType: { type: "string" },
      requireImplementation: true,
    },
    employeeNumber: {
      rid: "ri.ontology.main.interface-property.631f0dd2-4e78-4c2a-8487-c767a448d227",
      apiName: "employeeNumber",
      displayName: "Employee Number",
      dataType: { type: "integer" },
      requireImplementation: true,
    },
  },
  extendsInterfaces: [],
  allExtendsInterfaces: [],
  implementedByObjectTypes: ["Employee"],
  links: personLinksWire,
  allLinks: personLinksWire,
};

// -----------------------------------------------------------------------------
// Expected domain values
// -----------------------------------------------------------------------------

const fooSptProperty = InterfaceSharedPropertyType.make({
  rid: SharedPropertyTypeRid.make("ri.sharedPropertyType.main.sharedPropertyType.1"),
  apiName: SharedPropertyTypeApiName.make("fooSpt"),
  displayName: "Foo",
  description: O.some("A foo"),
  dataType: StringType.make({}),
  requireImplementation: true,
});

const fooIdpProperty = InterfaceDefinedPropertyType.make({
  rid: InterfacePropertyTypeRid.make("ri.interfacePropertyType.main.interfacePropertyType.1"),
  apiName: InterfacePropertyApiName.make("fooIdp"),
  displayName: "Foo IDP",
  description: O.some("A Foo IDP"),
  dataType: StringType.make({}),
  requireImplementation: true,
});

const fooArrayProperty = InterfaceDefinedPropertyType.make({
  rid: InterfacePropertyTypeRid.make("ri.interfacePropertyType.main.interfacePropertyType.2"),
  apiName: InterfacePropertyApiName.make("fooArray"),
  displayName: "Foo Array",
  description: O.some("An array-valued Foo property"),
  dataType: ArrayType.make({ elementType: StringType.make({}) }),
  requireImplementation: false,
});

const resolvedFooSpt = ResolvedInterfacePropertyType.make({
  rid: InterfacePropertyTypeRid.make("ri.sharedPropertyType.main.sharedPropertyType.1"),
  apiName: InterfacePropertyApiName.make("fooSpt"),
  displayName: "Foo",
  description: O.some("A foo"),
  dataType: StringType.make({}),
  requireImplementation: true,
});

const resolvedFooIdp = ResolvedInterfacePropertyType.make({
  rid: InterfacePropertyTypeRid.make("ri.interfacePropertyType.main.interfacePropertyType.1"),
  apiName: InterfacePropertyApiName.make("fooIdp"),
  displayName: "Foo IDP",
  description: O.some("A Foo IDP"),
  dataType: StringType.make({}),
  requireImplementation: true,
});

const resolvedFooArray = ResolvedInterfacePropertyType.make({
  rid: InterfacePropertyTypeRid.make("ri.interfacePropertyType.main.interfacePropertyType.2"),
  apiName: InterfacePropertyApiName.make("fooArray"),
  displayName: "Foo Array",
  description: O.some("An array-valued Foo property"),
  dataType: ArrayType.make({ elementType: StringType.make({}) }),
  requireImplementation: false,
});

const toFooLink = InterfaceLinkType.make({
  rid: InterfaceLinkTypeRid.make("ri.interface.link.main.1"),
  apiName: InterfaceLinkTypeApiName.make("toFoo"),
  displayName: "foos",
  linkedEntity: LinkedInterfaceType.make({ apiName: InterfaceTypeApiName.make("FooInterface") }),
  cardinality: "many",
  requireImplementation: true,
});

const toBarLink = InterfaceLinkType.make({
  rid: InterfaceLinkTypeRid.make("ri.interface.link.main.2"),
  apiName: InterfaceLinkTypeApiName.make("toBar"),
  displayName: "bars",
  linkedEntity: LinkedInterfaceType.make({ apiName: InterfaceTypeApiName.make("BarInterface") }),
  cardinality: "many",
  requireImplementation: true,
});

const barInterface = InterfaceType.make({
  rid: InterfaceTypeRid.make("ri.interface.main.interface.2"),
  apiName: InterfaceTypeApiName.make("BarInterface"),
  displayName: "Bar Interface",
  description: O.some("Interface for Bar"),
  ownLinks: R.singleton(InterfaceLinkTypeApiName.make("toFoo"), toFooLink),
  inheritedAndOwnLinks: R.singleton(InterfaceLinkTypeApiName.make("toFoo"), toFooLink),
});

const fooInterface = InterfaceType.make({
  rid: InterfaceTypeRid.make("ri.interface.main.interface.1"),
  apiName: InterfaceTypeApiName.make("FooInterface"),
  displayName: "Foo Interface",
  description: O.some("Interface for Foo"),
  ownSharedProperties: R.singleton(SharedPropertyTypeApiName.make("fooSpt"), fooSptProperty),
  inheritedAndOwnSharedProperties: R.singleton(SharedPropertyTypeApiName.make("fooSpt"), fooSptProperty),
  ownProperties: R.fromEntries([
    [InterfacePropertyApiName.make("fooSpt"), fooSptProperty],
    [InterfacePropertyApiName.make("fooIdp"), fooIdpProperty],
    [InterfacePropertyApiName.make("fooArray"), fooArrayProperty],
  ]),
  inheritedAndOwnProperties: R.fromEntries([
    [InterfacePropertyApiName.make("fooSpt"), resolvedFooSpt],
    [InterfacePropertyApiName.make("fooIdp"), resolvedFooIdp],
    [InterfacePropertyApiName.make("fooArray"), resolvedFooArray],
  ]),
  implementedByObjectTypes: [ObjectTypeApiName.make("Employee"), ObjectTypeApiName.make("Person")],
  ownLinks: R.singleton(InterfaceLinkTypeApiName.make("toBar"), toBarLink),
  inheritedAndOwnLinks: R.singleton(InterfaceLinkTypeApiName.make("toBar"), toBarLink),
});

// -----------------------------------------------------------------------------
// Laws
// -----------------------------------------------------------------------------

lawsOf("InterfaceLinkCardinality", InterfaceLinkCardinality);
lawsOf("LinkedObjectType", LinkedObjectType);
lawsOf("LinkedInterfaceType", LinkedInterfaceType);
lawsOf("LinkedEntity", LinkedEntity);
lawsOf("InterfaceLinkType", InterfaceLinkType);
lawsOf("InterfaceSharedPropertyType", InterfaceSharedPropertyType, 25);
lawsOf("InterfaceDefinedPropertyType", InterfaceDefinedPropertyType, 25);
lawsOf("InterfacePropertyType", InterfacePropertyType, 25);
lawsOf("ResolvedInterfacePropertyType", ResolvedInterfacePropertyType, 25);
lawsOf("InterfaceType", InterfaceType, 15);

// -----------------------------------------------------------------------------
// Interface link cardinality
// -----------------------------------------------------------------------------

describe("InterfaceLinkCardinality", () => {
  it.effect(
    "maps every wire literal to its domain literal and back",
    Effect.fnUntraced(function* () {
      deepStrictEqual(A.fromIterable(InterfaceLinkCardinality.Pairs), [
        ["ONE", "one"],
        ["MANY", "many"],
      ]);
      const decoded = yield* Effect.forEach(["ONE", "MANY"], (wire) =>
        S.decodeUnknownEffect(InterfaceLinkCardinality)(wire)
      );
      deepStrictEqual(decoded, ["one", "many"]);
      const encoded = yield* Effect.forEach(decoded, (domain) => S.encodeEffect(InterfaceLinkCardinality)(domain));
      deepStrictEqual(encoded, ["ONE", "MANY"]);
    })
  );

  it("matches exhaustively on the domain literals", () => {
    const upperBound = InterfaceLinkCardinality.To.match({ one: () => O.some(1), many: () => O.none<number>() });
    assertSome(upperBound("one"), 1);
    assertNone(upperBound("many"));
  });

  it("rejects the authoring model's SINGLE and a domain literal sent as wire", () => {
    assertRejects(InterfaceLinkCardinality, "SINGLE", "InterfaceLinkCardinality");
    assertRejects(InterfaceLinkCardinality, "many", "InterfaceLinkCardinality");
  });
});

// -----------------------------------------------------------------------------
// Linked entity
// -----------------------------------------------------------------------------

describe("LinkedEntity", () => {
  wireFixture(
    "decodes a link to an object type and encodes it back",
    LinkedEntity,
    { type: "objectTypeApiName", apiName: "Office" },
    LinkedEntity.cases.objectTypeApiName.make({ apiName: ObjectTypeApiName.make("Office") })
  );

  wireFixture(
    "decodes a link to an interface type and encodes it back",
    LinkedEntity,
    { type: "interfaceTypeApiName", apiName: "Person" },
    LinkedEntity.cases.interfaceTypeApiName.make({ apiName: InterfaceTypeApiName.make("Person") })
  );

  it("guards, narrows and matches every case", () => {
    const office = LinkedEntity.cases.objectTypeApiName.make({ apiName: ObjectTypeApiName.make("Office") });
    const person = LinkedEntity.cases.interfaceTypeApiName.make({ apiName: InterfaceTypeApiName.make("Person") });
    const describeTarget = LinkedEntity.match({
      objectTypeApiName: ({ apiName }) => `object:${apiName}`,
      interfaceTypeApiName: ({ apiName }) => `interface:${apiName}`,
    });
    deepStrictEqual(A.map([office, person], describeTarget), ["object:Office", "interface:Person"]);
    assertTrue(LinkedEntity.guards.objectTypeApiName(office));
    assertFalse(LinkedEntity.guards.objectTypeApiName(person));
    assertTrue(LinkedEntity.guards.interfaceTypeApiName(person));
    assertTrue(LinkedEntity.isAnyOf(["interfaceTypeApiName"])(person));
    assertFalse(LinkedEntity.isAnyOf(["interfaceTypeApiName"])(office));
  });

  it("rejects an unknown kind of target, a missing name and an empty name", () => {
    assertRejects(LinkedEntity, { type: "linkTypeApiName", apiName: "Office" }, "LinkedEntity");
    assertRejects(LinkedEntity, { type: "objectTypeApiName" }, `["apiName"]`);
    assertRejects(LinkedEntity, { type: "interfaceTypeApiName", apiName: "" }, `["apiName"]`);
  });
});

// -----------------------------------------------------------------------------
// Interface link type
// -----------------------------------------------------------------------------

describe("InterfaceLinkType", () => {
  wireFixture("decodes the stub link toBar and encodes it back", InterfaceLinkType, toBarLinkWire, toBarLink);

  wireFixture(
    "decodes a real optional to-one link to an object type and encodes it back",
    InterfaceLinkType,
    {
      rid: "ri.ontology.main.interface-link.1cfe8795-d580-4b55-9af8-24d413525d44",
      apiName: "office",
      displayName: "Office",
      description: "",
      linkedEntityApiName: { type: "objectTypeApiName", apiName: "Office" },
      cardinality: "ONE",
      required: false,
    },
    InterfaceLinkType.make({
      rid: InterfaceLinkTypeRid.make("ri.ontology.main.interface-link.1cfe8795-d580-4b55-9af8-24d413525d44"),
      apiName: InterfaceLinkTypeApiName.make("office"),
      displayName: "Office",
      description: O.some(""),
      linkedEntity: LinkedObjectType.make({ apiName: ObjectTypeApiName.make("Office") }),
      cardinality: "one",
      requireImplementation: false,
    })
  );

  it("keeps an empty description distinct from an absent one", () => {
    assertNone(toBarLink.description);
    assertSome(InterfaceLinkType.make({ ...toBarLink, description: O.some("") }).description, "");
  });

  it("rejects the domain key names on the wire and a non-boolean flag", () => {
    assertRejects(
      InterfaceLinkType,
      { ...Struct.omit(toBarLinkWire, ["required"]), requireImplementation: true },
      `["required"]`
    );
    assertRejects(
      InterfaceLinkType,
      { ...Struct.omit(toBarLinkWire, ["linkedEntityApiName"]), linkedEntity: toBarLinkWire.linkedEntityApiName },
      `["linkedEntityApiName"]`
    );
    assertRejects(InterfaceLinkType, { ...toBarLinkWire, required: "true" }, `["required"]`);
    assertRejects(InterfaceLinkType, { ...toBarLinkWire, cardinality: "SINGLE" }, `["cardinality"]`);
  });
});

// -----------------------------------------------------------------------------
// Interface property records
// -----------------------------------------------------------------------------

describe("InterfacePropertyType", () => {
  wireFixture(
    "decodes a shared-property-backed property and encodes it back",
    InterfacePropertyType,
    { ...fooSpt, type: "interfaceSharedPropertyType", required: true },
    fooSptProperty
  );

  wireFixture(
    "decodes an interface-defined property and encodes it back",
    InterfacePropertyType,
    { ...idp, type: "interfaceDefinedPropertyType" },
    fooIdpProperty
  );

  wireFixture(
    "decodes an interface-defined array property and encodes it back",
    InterfaceDefinedPropertyType,
    { ...arrayIdp, type: "interfaceDefinedPropertyType" },
    fooArrayProperty
  );

  it("guards, narrows and matches every case", () => {
    const shared = InterfacePropertyType.cases.interfaceSharedPropertyType.make({
      rid: SharedPropertyTypeRid.make("ri.ontology.main.shared-property.631f0dd2"),
      apiName: SharedPropertyTypeApiName.make("employeeNumber"),
      displayName: "Employee Number",
      dataType: IntegerType.make({}),
      requireImplementation: true,
    });
    const defined = InterfacePropertyType.cases.interfaceDefinedPropertyType.make({
      rid: InterfacePropertyTypeRid.make("ri.ontology.main.interface-property.77aa"),
      apiName: InterfacePropertyApiName.make("nickname"),
      displayName: "Nickname",
      dataType: StringType.make({}),
      requireImplementation: false,
    });
    const origin = InterfacePropertyType.match({
      interfaceDefinedPropertyType: ({ apiName }) => `defined:${apiName}`,
      interfaceSharedPropertyType: ({ apiName }) => `shared:${apiName}`,
    });
    deepStrictEqual(A.map([shared, defined], origin), ["shared:employeeNumber", "defined:nickname"]);
    deepStrictEqual(
      A.map([shared, defined], (property) => property.requireImplementation),
      [true, false]
    );
    assertTrue(InterfacePropertyType.guards.interfaceSharedPropertyType(shared));
    assertFalse(InterfacePropertyType.guards.interfaceSharedPropertyType(defined));
    assertTrue(InterfacePropertyType.guards.interfaceDefinedPropertyType(defined));
    assertTrue(InterfacePropertyType.isAnyOf(["interfaceDefinedPropertyType"])(defined));
    assertFalse(InterfacePropertyType.isAnyOf(["interfaceDefinedPropertyType"])(shared));
  });

  it("gives every optional field a constructor default", () => {
    assertNone(fooIdpProperty.valueTypeApiName);
    assertNone(fooSptProperty.valueFormatting);
    deepStrictEqual(fooSptProperty.typeClasses, []);
    deepStrictEqual(fooSptProperty.type, "interfaceSharedPropertyType");
  });

  it.effect(
    "defaults typeClasses when an older payload omits it and always writes it back",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(InterfaceSharedPropertyType)({
        ...Struct.omit(fooSpt, ["typeClasses"]),
        type: "interfaceSharedPropertyType",
        required: true,
      });
      deepStrictEqual(decoded, fooSptProperty);
      const encoded = yield* S.encodeEffect(InterfaceSharedPropertyType)(decoded);
      deepStrictEqual(encoded, { ...fooSpt, type: "interfaceSharedPropertyType", required: true });
    })
  );

  it("rejects an untagged record, each record's flag under the other's wire key, and an empty name", () => {
    assertRejects(InterfacePropertyType, { ...fooSpt, required: true }, "InterfacePropertyType");
    assertRejects(
      InterfaceSharedPropertyType,
      { ...fooSpt, type: "interfaceSharedPropertyType", requireImplementation: true },
      `["required"]`
    );
    assertRejects(
      InterfaceDefinedPropertyType,
      { ...Struct.omit(idp, ["requireImplementation"]), type: "interfaceDefinedPropertyType", required: true },
      `["requireImplementation"]`
    );
    assertRejects(
      InterfaceDefinedPropertyType,
      { ...idp, type: "interfaceDefinedPropertyType", apiName: "" },
      `["apiName"]`
    );
    assertRejects(InterfaceDefinedPropertyType, { ...idp, type: "interfaceSharedPropertyType" }, `["type"]`);
  });
});

describe("ResolvedInterfacePropertyType", () => {
  wireFixture(
    "decodes a real flattened property and encodes it back",
    ResolvedInterfacePropertyType,
    {
      rid: "ri.ontology.main.interface-property.631f0dd2-4e78-4c2a-8487-c767a448d227",
      apiName: "employeeNumber",
      displayName: "Employee Number",
      dataType: { type: "integer" },
      requireImplementation: true,
    },
    ResolvedInterfacePropertyType.make({
      rid: InterfacePropertyTypeRid.make("ri.ontology.main.interface-property.631f0dd2-4e78-4c2a-8487-c767a448d227"),
      apiName: InterfacePropertyApiName.make("employeeNumber"),
      displayName: "Employee Number",
      dataType: IntegerType.make({}),
      requireImplementation: true,
    })
  );

  it.effect(
    "drops the typeClasses key the stub leaks into it, because the wire record does not declare one",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(ResolvedInterfacePropertyType)({ ...idp });
      deepStrictEqual(decoded, resolvedFooIdp);
      const encoded = yield* S.encodeEffect(ResolvedInterfacePropertyType)(decoded);
      deepStrictEqual(encoded, Struct.omit(idp, ["typeClasses"]));
    })
  );

  it("rejects the shared record's flag name and a missing data type", () => {
    assertRejects(
      ResolvedInterfacePropertyType,
      { ...Struct.omit(idp, ["requireImplementation"]), required: true },
      `["requireImplementation"]`
    );
    assertRejects(ResolvedInterfacePropertyType, Struct.omit(idp, ["dataType"]), `["dataType"]`);
  });
});

// -----------------------------------------------------------------------------
// Interface type
// -----------------------------------------------------------------------------

describe("InterfaceType", () => {
  wireFixture("decodes the stub BarInterface and encodes it back", InterfaceType, barInterfaceWire, barInterface);

  wireFixture("decodes the stub FooInterface and encodes it back", InterfaceType, fooInterfaceWire, fooInterface);

  it.effect(
    "decodes FooInterface exactly as the stub file writes it, and encodes the declared wire shape",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(InterfaceType)(fooInterfaceStub);
      deepStrictEqual(decoded, fooInterface);
      const encoded = yield* S.encodeEffect(InterfaceType)(decoded);
      deepStrictEqual(encoded, fooInterfaceWire);
    })
  );

  it.effect(
    "decodes a payload served by a real ontology and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const person = yield* S.decodeEffect(InterfaceType)(personInterfaceWire);
      assertSome(person.description, "");
      deepStrictEqual(R.keys(person.ownSharedProperties), ["email", "employeeNumber"]);
      deepStrictEqual(R.keys(person.inheritedAndOwnProperties), ["email", "employeeNumber"]);
      deepStrictEqual(
        pipe(
          R.get(person.ownProperties, InterfacePropertyApiName.make("email")),
          O.map((property) => A.map(property.typeClasses, (typeClass) => typeClass.name))
        ),
        O.some(["SELECTABLE", "SORTABLE"])
      );
      deepStrictEqual(
        pipe(
          R.values(person.ownLinks),
          A.map((link) => `${link.apiName}:${link.cardinality}:${link.linkedEntity.type}:${link.requireImplementation}`)
        ),
        [
          "peeps:many:interfaceTypeApiName:true",
          "office:one:objectTypeApiName:false",
          "lead:one:interfaceTypeApiName:true",
        ]
      );
      const encoded = yield* S.encodeEffect(InterfaceType)(person);
      deepStrictEqual(encoded, personInterfaceWire);
    })
  );

  it.effect(
    "decodes a shared property to the same value from the untagged map and from the tagged union",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(InterfaceType)(fooInterfaceWire);
      const fromUntaggedMap = R.get(decoded.ownSharedProperties, SharedPropertyTypeApiName.make("fooSpt"));
      const fromTaggedUnion = R.get(decoded.ownProperties, InterfacePropertyApiName.make("fooSpt"));
      assertSome(fromUntaggedMap, fooSptProperty);
      assertSome(fromTaggedUnion, fooSptProperty);
      const encoded = yield* S.encodeEffect(InterfaceType)(decoded);
      deepStrictEqual(encoded.properties, { fooSpt: { ...fooSpt, required: true } });
      deepStrictEqual(encoded.propertiesV2, fooInterfaceWire.propertiesV2);
    })
  );

  it.effect(
    "ignores a tag sent in the untagged map instead of trusting it",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeUnknownEffect(InterfaceType)({
        ...fooInterfaceWire,
        properties: { fooSpt: { ...fooSpt, required: true, type: "interfaceDefinedPropertyType" } },
      });
      deepStrictEqual(decoded, fooInterface);
    })
  );

  it.effect(
    "defaults every collection in the constructor and still writes all of them to the wire",
    Effect.fnUntraced(function* () {
      const bare = InterfaceType.make({
        rid: InterfaceTypeRid.make("ri.interface.main.interface.9"),
        apiName: InterfaceTypeApiName.make("Bare"),
        displayName: "Bare",
      });
      assertNone(bare.description);
      deepStrictEqual(R.size(bare.ownProperties) + R.size(bare.inheritedAndOwnLinks), 0);
      const encoded = yield* S.encodeEffect(InterfaceType)(bare);
      deepStrictEqual(encoded, {
        rid: "ri.interface.main.interface.9",
        apiName: "Bare",
        displayName: "Bare",
        properties: {},
        allProperties: {},
        propertiesV2: {},
        allPropertiesV2: {},
        extendsInterfaces: [],
        allExtendsInterfaces: [],
        implementedByObjectTypes: [],
        links: {},
        allLinks: {},
      });
    })
  );

  it.effect(
    "decodes each of the nine collections as empty when a saved document omits it, and writes all nine back",
    Effect.fnUntraced(function* () {
      // Saved ontology documents leave empty collections out (Conjure semantics); the canonical form writes them.
      const records = Tuple.make("properties", "allProperties", "propertiesV2", "allPropertiesV2", "links", "allLinks");
      const arrays = Tuple.make("extendsInterfaces", "allExtendsInterfaces", "implementedByObjectTypes");
      yield* Effect.forEach(
        records,
        Effect.fnUntraced(function* (collection) {
          const decoded = yield* S.decodeEffect(InterfaceType)(Struct.omit(fooInterfaceWire, [collection]));
          const encoded = yield* S.encodeEffect(InterfaceType)(decoded);
          deepStrictEqual(encoded, { ...fooInterfaceWire, [collection]: {} });
        })
      );
      yield* Effect.forEach(
        arrays,
        Effect.fnUntraced(function* (collection) {
          const decoded = yield* S.decodeEffect(InterfaceType)(Struct.omit(fooInterfaceWire, [collection]));
          const encoded = yield* S.encodeEffect(InterfaceType)(decoded);
          deepStrictEqual(encoded, { ...fooInterfaceWire, [collection]: [] });
        })
      );
      const bare = yield* S.decodeEffect(InterfaceType)({
        rid: "ri.interface.main.interface.9",
        apiName: "Bare",
        displayName: "Bare",
      });
      deepStrictEqual(
        bare,
        InterfaceType.make({
          rid: InterfaceTypeRid.make("ri.interface.main.interface.9"),
          apiName: InterfaceTypeApiName.make("Bare"),
          displayName: "Bare",
        })
      );
      const canonical = yield* S.encodeEffect(InterfaceType)(bare);
      deepStrictEqual(canonical, {
        rid: "ri.interface.main.interface.9",
        apiName: "Bare",
        displayName: "Bare",
        properties: {},
        allProperties: {},
        propertiesV2: {},
        allPropertiesV2: {},
        extendsInterfaces: [],
        allExtendsInterfaces: [],
        implementedByObjectTypes: [],
        links: {},
        allLinks: {},
      });
    })
  );

  it.effect(
    "does not read a collection from its domain key name: the wire key is absent, so the collection is empty",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeUnknownEffect(InterfaceType)({
        ...Struct.omit(barInterfaceWire, ["links", "allExtendsInterfaces"]),
        ownLinks: barInterfaceWire.links,
        ancestorInterfaces: ["FooInterface"],
      });
      deepStrictEqual(decoded.ownLinks, {});
      deepStrictEqual(decoded.ancestorInterfaces, []);
      const encoded = yield* S.encodeEffect(InterfaceType)(decoded);
      deepStrictEqual(encoded, { ...barInterfaceWire, links: {}, allExtendsInterfaces: [] });
    })
  );

  it("rejects a collection of the wrong shape instead of defaulting it", () => {
    assertRejects(InterfaceType, { ...barInterfaceWire, links: [] }, `["links"]`);
    assertRejects(InterfaceType, { ...barInterfaceWire, allProperties: null }, `["allProperties"]`);
    assertRejects(InterfaceType, { ...barInterfaceWire, extendsInterfaces: {} }, `["extendsInterfaces"]`);
    assertRejects(
      InterfaceType,
      { ...barInterfaceWire, implementedByObjectTypes: "Employee" },
      `["implementedByObjectTypes"]`
    );
  });

  it("rejects a value of the wrong generation in each property map", () => {
    assertRejects(
      InterfaceType,
      { ...fooInterfaceWire, propertiesV2: { fooSpt: { ...fooSpt, required: true } } },
      `["propertiesV2"]["fooSpt"]`
    );
    assertRejects(
      InterfaceType,
      { ...fooInterfaceWire, allPropertiesV2: { fooSpt: { ...fooSpt, required: true } } },
      `["allPropertiesV2"]["fooSpt"]["requireImplementation"]`
    );
    assertRejects(
      InterfaceType,
      { ...fooInterfaceWire, allProperties: { fooSpt: { ...fooSpt, requireImplementation: true } } },
      `["allProperties"]["fooSpt"]["required"]`
    );
  });

  it("rejects empty names, an unknown link target and a link cardinality the wire never sends", () => {
    assertRejects(InterfaceType, { ...barInterfaceWire, apiName: "" }, `["apiName"]`);
    assertRejects(InterfaceType, { ...barInterfaceWire, extendsInterfaces: [""] }, `["extendsInterfaces"][0]`);
    assertRejects(InterfaceType, { ...barInterfaceWire, implementedByObjectTypes: ["Employee", ""] }, `[1]`);
    assertRejects(
      InterfaceType,
      { ...barInterfaceWire, allLinks: { toFoo: { ...toFooLinkWire, cardinality: "SINGLE" } } },
      `["allLinks"]["toFoo"]["cardinality"]`
    );
    assertRejects(
      InterfaceType,
      {
        ...barInterfaceWire,
        links: { toFoo: { ...toFooLinkWire, linkedEntityApiName: { type: "linkTypeApiName", apiName: "x" } } },
      },
      `["links"]["toFoo"]["linkedEntityApiName"]`
    );
  });
});
