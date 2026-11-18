import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Identifier from "../src/Identifier/index.ts";
import {
  ActionTypeApiName,
  ActionTypeRid,
  AttachmentRid,
  DerivedPropertyApiName,
  EntityTypeApiName,
  ErrorName,
  FoundryBranch,
  FunctionRid,
  FunctionVersion,
  InterfaceLinkTypeApiName,
  InterfaceLinkTypeRid,
  InterfacePropertyApiName,
  InterfacePropertyTypeRid,
  InterfaceTypeApiName,
  InterfaceTypeRid,
  LinkTypeApiName,
  LinkTypeRid,
  MarkingId,
  MediaItemRid,
  MediaSetRid,
  MediaSetViewRid,
  ObjectRid,
  ObjectSetRid,
  ObjectTypeApiName,
  ObjectTypeRid,
  OntologyApiName,
  OntologyIdentifier,
  OntologyRid,
  OntologyScenarioRid,
  OntologyTransactionId,
  ParameterId,
  PrincipalId,
  PropertyApiName,
  PropertyTypeRid,
  QueryApiName,
  ResourceIdentifier,
  ResourceIdentifierParts,
  SharedPropertyTypeApiName,
  SharedPropertyTypeRid,
  StructFieldApiName,
  StructFieldTypeRid,
  ValueTypeApiName,
  ValueTypeRid,
} from "../src/Identifier/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by every named schema
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

const rejects =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isFailure);

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

const uuid = "401ac022-89eb-4591-8b7e-0a912b9efb44";

// ---------------------------------------------------------------------------
// Kind brands
// ---------------------------------------------------------------------------

const apiNameBrands: ReadonlyArray<readonly [name: string, schema: S.Codec<string, string>]> = [
  ["OntologyApiName", OntologyApiName],
  ["ObjectTypeApiName", ObjectTypeApiName],
  ["PropertyApiName", PropertyApiName],
  ["StructFieldApiName", StructFieldApiName],
  ["LinkTypeApiName", LinkTypeApiName],
  ["InterfaceTypeApiName", InterfaceTypeApiName],
  ["InterfacePropertyApiName", InterfacePropertyApiName],
  ["InterfaceLinkTypeApiName", InterfaceLinkTypeApiName],
  ["SharedPropertyTypeApiName", SharedPropertyTypeApiName],
  ["ValueTypeApiName", ValueTypeApiName],
  ["ActionTypeApiName", ActionTypeApiName],
  ["ParameterId", ParameterId],
  ["QueryApiName", QueryApiName],
  ["DerivedPropertyApiName", DerivedPropertyApiName],
  ["EntityTypeApiName", EntityTypeApiName],
];

const ridBrands: ReadonlyArray<readonly [name: string, schema: S.Codec<string, string>]> = [
  ["OntologyRid", OntologyRid],
  ["ObjectTypeRid", ObjectTypeRid],
  ["PropertyTypeRid", PropertyTypeRid],
  ["SharedPropertyTypeRid", SharedPropertyTypeRid],
  ["StructFieldTypeRid", StructFieldTypeRid],
  ["LinkTypeRid", LinkTypeRid],
  ["InterfaceTypeRid", InterfaceTypeRid],
  ["InterfacePropertyTypeRid", InterfacePropertyTypeRid],
  ["InterfaceLinkTypeRid", InterfaceLinkTypeRid],
  ["ActionTypeRid", ActionTypeRid],
  ["FunctionRid", FunctionRid],
  ["ValueTypeRid", ValueTypeRid],
  ["ObjectRid", ObjectRid],
  ["ObjectSetRid", ObjectSetRid],
  ["AttachmentRid", AttachmentRid],
  ["MediaSetRid", MediaSetRid],
  ["MediaSetViewRid", MediaSetViewRid],
  ["MediaItemRid", MediaItemRid],
  ["OntologyScenarioRid", OntologyScenarioRid],
  ["OntologyTransactionId", OntologyTransactionId],
  ["MarkingId", MarkingId],
];

// Identifiers of platform things that are not part of an ontology: a branch, a principal, a reported failure.
const platformBrands: ReadonlyArray<readonly [name: string, schema: S.Codec<string, string>]> = [
  ["FoundryBranch", FoundryBranch],
  ["PrincipalId", PrincipalId],
  ["ErrorName", ErrorName],
];

const kindBrands = A.appendAll(A.appendAll(apiNameBrands, ridBrands), platformBrands);

describe("kind brands", () => {
  A.forEach(kindBrands, ([name, schema]) => lawful(name, schema));

  it("exports exactly the identifiers the design contract names", () => {
    const expected = A.appendAll(
      A.map(kindBrands, ([name]) => name),
      ["ResourceIdentifier", "ResourceIdentifierParts", "OntologyIdentifier", "FunctionVersion"]
    );
    const exported: ReadonlyArray<string> = R.keys(Identifier);
    deepStrictEqual(A.sort(exported, Order.String), A.sort(expected, Order.String));
    strictEqual(A.length(apiNameBrands), 15);
    strictEqual(A.length(ridBrands), 21);
    strictEqual(A.length(platformBrands), 3);
  });

  it("accepts any non-empty string, which is all the wire promises", () => {
    // The OSDK test stubs use `rid: "rid"`; real payloads use canonical RIDs. Both must pass a kind brand.
    const samples = ["rid", "Employee", "com.example.Namespaced", `ri.ontology.main.object-type.${uuid}`, " ", "é"];
    const verdicts = A.flatMap(kindBrands, ([, schema]) => A.map(samples, S.is(schema)));
    assertTrue(A.every(verdicts, identity));
  });

  it("rejects the empty string and every non-string", () => {
    const counterExamples: ReadonlyArray<unknown> = ["", 0, 1, true, null, undefined, {}, [], ["rid"]];
    const verdicts = A.flatMap(kindBrands, ([, schema]) => A.map(counterExamples, S.is(schema)));
    assertFalse(A.some(verdicts, identity));
  });

  it.effect(
    "encodes a brand to the bare string and decodes it back",
    Effect.fnUntraced(function* () {
      const wire = `ri.ontology.main.object-type.${uuid}`;
      const rid = yield* S.decodeEffect(ObjectTypeRid)(wire);
      const encoded = yield* S.encodeEffect(ObjectTypeRid)(rid);
      strictEqual(rid, ObjectTypeRid.make(wire));
      strictEqual(encoded, wire);
      const verdicts = yield* Effect.all(A.map(kindBrands, ([, schema]) => rejects(schema)("")));
      assertTrue(A.every(verdicts, identity));
    })
  );

  it("keeps kinds apart at the type level while every kind stays a string", () => {
    const facts: readonly [
      Equals<ObjectTypeApiName, PropertyApiName>,
      Equals<PropertyApiName, StructFieldApiName>,
      Equals<LinkTypeApiName, InterfaceLinkTypeApiName>,
      Equals<ObjectTypeRid, ObjectRid>,
      Equals<PropertyTypeRid, SharedPropertyTypeRid>,
      Equals<PropertyApiName, string>,
      PropertyApiName extends string ? true : false,
      string extends PropertyApiName ? true : false,
      LinkTypeApiName extends PropertyApiName ? true : false,
      Equals<typeof PropertyApiName.Encoded, string>,
      Equals<typeof MarkingId.Encoded, string>,
    ] = [false, false, false, false, false, false, true, false, false, true, true];
    deepStrictEqual(facts, [false, false, false, false, false, false, true, false, false, true, true]);
  });
});

// ---------------------------------------------------------------------------
// Canonical resource identifiers
// ---------------------------------------------------------------------------

const canonicalRids = [
  `ri.ontology.main.object-type.${uuid}`,
  "ri.a.b.c.d",
  // The instance segment may be empty.
  "ri.a..c.d",
  // The locator may contain dots, underscores, hyphens and upper-case letters.
  "ri.a.b.c.d.e",
  "ri.a-1.0x.c-d.D_e-f.g",
  "ri.phonograph2-objects.main.object.88a6fccb-f333-46d6-a07e-7725c5f18b61",
  "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f",
];

const malformedRids = [
  "",
  "rid",
  "ri",
  "ri.a.b.c",
  // Upper case is only legal in the locator.
  "RI.a.b.c.d",
  "ri.A.b.c.d",
  "ri.a.B.c.d",
  "ri.a.b.C.d",
  // Service and type must start with a letter; the instance must not start with a hyphen.
  "ri.1a.b.c.d",
  "ri.a.b.1c.d",
  "ri.a.-b.c.d",
  // The locator is never empty and admits no whitespace or other punctuation.
  "ri.a.b.c.",
  "ri.a.b.c.d e",
  "ri.a.b.c.d/e",
  "ri.a.b.c.d\n",
  " ri.a.b.c.d",
  // Service and type are never empty.
  "ri..b.c.d",
  "ri.a.b..d",
];

describe("ResourceIdentifier", () => {
  lawful("ResourceIdentifier", ResourceIdentifier);

  it("accepts canonical identifiers, including an empty instance and a dotted locator", () => {
    deepStrictEqual(A.map(canonicalRids, S.is(ResourceIdentifier)), A.map(canonicalRids, () => true));
  });

  it("rejects each malformed segment", () => {
    deepStrictEqual(A.map(malformedRids, S.is(ResourceIdentifier)), A.map(malformedRids, () => false));
  });

  it("is stricter than the kind brands, which accept the loose identifiers real payloads carry", () => {
    deepStrictEqual(
      [S.is(ResourceIdentifier)("rid"), S.is(ObjectTypeRid)("rid"), S.is(PropertyTypeRid)("ri.struct.bio")],
      [false, true, true]
    );
  });

  it.effect(
    "decodes to the same string under its own brand",
    Effect.fnUntraced(function* () {
      const wire = `ri.ontology.main.object-type.${uuid}`;
      const decoded = yield* S.decodeEffect(ResourceIdentifier)(wire);
      const encoded = yield* S.encodeEffect(ResourceIdentifier)(decoded);
      strictEqual(decoded, ResourceIdentifier.make(wire));
      strictEqual(encoded, wire);
      const verdicts = yield* Effect.all(A.map(malformedRids, rejects(ResourceIdentifier)));
      assertTrue(A.every(verdicts, identity));
    })
  );
});

describe("ResourceIdentifierParts", () => {
  generates("ResourceIdentifierParts", ResourceIdentifierParts);

  const decodeParts = S.decodeUnknownEffect(ResourceIdentifierParts);
  const encodeParts = S.encodeEffect(ResourceIdentifierParts);
  const partsEquivalence = S.toEquivalence(ResourceIdentifierParts);

  it.effect(
    "decodes the four segments of a canonical identifier and encodes them back to the same string",
    Effect.fnUntraced(function* () {
      const wire = `ri.ontology.main.object-type.${uuid}`;
      const parts = yield* decodeParts(wire);
      deepStrictEqual(parts, { service: "ontology", instance: "main", type: "object-type", locator: uuid });
      const encoded = yield* encodeParts(parts);
      strictEqual(encoded, wire);
    })
  );

  it.effect(
    "keeps an empty instance and a dotted locator intact",
    Effect.fnUntraced(function* () {
      const withoutInstance = yield* decodeParts("ri.a..c.d");
      const dottedLocator = yield* decodeParts("ri.a-1.0x.c-d.D_e-f.g");
      deepStrictEqual(withoutInstance, { service: "a", instance: "", type: "c", locator: "d" });
      deepStrictEqual(dottedLocator, { service: "a-1", instance: "0x", type: "c-d", locator: "D_e-f.g" });
      const encodedWithoutInstance = yield* encodeParts(withoutInstance);
      const encodedDottedLocator = yield* encodeParts(dottedLocator);
      deepStrictEqual([encodedWithoutInstance, encodedDottedLocator], ["ri.a..c.d", "ri.a-1.0x.c-d.D_e-f.g"]);
    })
  );

  it.effect(
    "accepts exactly the strings ResourceIdentifier accepts",
    Effect.fnUntraced(function* () {
      const accepted = yield* Effect.all(A.map(canonicalRids, rejects(ResourceIdentifierParts)));
      const refused = yield* Effect.all(A.map(malformedRids, rejects(ResourceIdentifierParts)));
      assertFalse(A.some(accepted, identity));
      assertTrue(A.every(refused, identity));
    })
  );

  // The round-trip law that holds: it starts from the wire side, where every value is a canonical identifier.
  it.effect.prop(
    "ResourceIdentifierParts: decode then encode returns the canonical identifier it was given",
    [Arbitrary.schema(ResourceIdentifier)],
    Effect.fnUntraced(function* ([rid]) {
      const parts = yield* decodeParts(rid);
      const encoded = yield* encodeParts(parts);
      const again = yield* decodeParts(encoded);
      strictEqual<string>(encoded, rid);
      assertTrue(partsEquivalence(again, parts));
    }),
    { arbitrary: fcRuns(100) }
  );

  it.effect(
    "refuses to encode segments that would not form a canonical identifier",
    Effect.fnUntraced(function* () {
      const encodeUnknownParts = S.encodeUnknownEffect(ResourceIdentifierParts);
      const upperCaseService = yield* Effect.exit(
        encodeUnknownParts({ service: "Ontology", instance: "main", type: "object-type", locator: "employee" })
      );
      const dottedService = yield* Effect.exit(
        encodeUnknownParts({ service: "a.b", instance: "main", type: "object-type", locator: "employee" })
      );
      const emptyLocator = yield* Effect.exit(
        encodeUnknownParts({ service: "ontology", instance: "main", type: "object-type", locator: "" })
      );
      assertTrue(A.every([upperCaseService, dottedService, emptyLocator], Exit.isFailure));
    })
  );

  // Law: the decoded struct carries the same four segment patterns as the parsed string, so the guard admits exactly
  // the values that encode.
  it("ResourceIdentifierParts: the guard rejects segments that cannot be encoded", () => {
    const unencodable = { service: "Ontology", instance: "", type: "object-type", locator: "x" };
    assertFalse(S.is(ResourceIdentifierParts)(unencodable));
    const isParts = S.is(ResourceIdentifierParts);
    deepStrictEqual(
      [
        isParts({ service: "ontology", instance: "", type: "object-type", locator: "x" }),
        isParts({ service: "ontology", instance: "main", type: "object-type", locator: "a.b_c-D" }),
        isParts({ service: "a.b", instance: "main", type: "object-type", locator: "x" }),
        isParts({ service: "ontology", instance: "Main", type: "object-type", locator: "x" }),
        isParts({ service: "ontology", instance: "main", type: "object_type", locator: "x" }),
        isParts({ service: "ontology", instance: "main", type: "object-type", locator: "" }),
        isParts({ service: "ontology", instance: "main", type: "object-type", locator: "a b" }),
      ],
      [true, true, false, false, false, false, false]
    );
  });

  // C9 law (b): every generated domain value encodes, and decoding the text gives the same parts back.
  it.effect(
    "ResourceIdentifierParts: encode then decode is equivalent to the original",
    Effect.fnUntraced(function* () {
      const samples = yield* Arbitrary.sampleEffect(Arbitrary.schema(ResourceIdentifierParts), { count: 50, seed: 1 });
      const exits = yield* Effect.all(A.map(samples, (parts) => Effect.exit(encodeParts(parts))));
      assertTrue(A.every(exits, Exit.isSuccess));
      const returned = yield* Effect.forEach(
        samples,
        Effect.fnUntraced(function* (parts) {
          const encoded = yield* encodeParts(parts);
          const decoded = yield* decodeParts(encoded);
          return partsEquivalence(decoded, parts);
        })
      );
      strictEqual(A.length(returned), 50);
      assertTrue(A.every(returned, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

describe("OntologyIdentifier", () => {
  lawful("OntologyIdentifier", OntologyIdentifier);

  const ontologyRid = `ri.ontology.main.ontology.${uuid}`;
  const isRid = S.is(OntologyIdentifier.members[0]);
  const isApiName = S.is(OntologyIdentifier.members[1]);

  it("is either brand in the domain and plain text on the wire", () => {
    const facts: readonly [
      Equals<OntologyIdentifier, OntologyRid | OntologyApiName>,
      Equals<typeof OntologyIdentifier.Encoded, string>,
    ] = [true, true];
    assertTrue(A.every(facts, identity));
    strictEqual(A.length(OntologyIdentifier.members), 2);
  });

  // Decoding picks the first member that accepts the text. The resource identifier member is gated by the
  // canonical form, so text is classified by what it is and an API name is never called a resource identifier.
  it.effect(
    "decodes text of the resource identifier form as a resource identifier and any other text as an API name",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(OntologyIdentifier);
      const rid = yield* decode(ontologyRid);
      const apiName = yield* decode("default-ontology");
      strictEqual(rid, OntologyRid.make(ontologyRid));
      strictEqual(apiName, OntologyApiName.make("default-ontology"));
      deepStrictEqual([isRid(rid), isRid(apiName)], [true, false]);
      deepStrictEqual([isApiName(rid), isApiName(apiName)], [true, true]);
      deepStrictEqual([S.is(ResourceIdentifier)(rid), S.is(ResourceIdentifier)(apiName)], [true, false]);
      // Loose text that only looks like a resource identifier is an API name: `ri.a.b.c.d` has the form, `rid` not.
      const loose = yield* Effect.forEach(["ri.a.b.c.d", "rid", "ri.ontology", "RI.ontology.main.ontology.x"], (text) =>
        decode(text)
      );
      deepStrictEqual(A.map(loose, S.is(ResourceIdentifier)), [true, false, false, false]);
    })
  );

  it.effect(
    "encodes either brand to its bare text and refuses the empty string in both directions",
    Effect.fnUntraced(function* () {
      const encode = S.encodeEffect(OntologyIdentifier);
      const wire = yield* Effect.all([
        encode(OntologyRid.make(ontologyRid)),
        encode(OntologyApiName.make("default-ontology")),
        // The bare brand is as loose as the wire: a resource identifier that is not canonical still encodes.
        encode(OntologyRid.make("rid")),
      ]);
      deepStrictEqual(wire, [ontologyRid, "default-ontology", "rid"]);
      const verdicts = yield* Effect.all([rejects(OntologyIdentifier)(""), rejects(OntologyIdentifier)(7)]);
      deepStrictEqual(verdicts, [true, true]);
      assertFalse(S.is(OntologyIdentifier)(""));
    })
  );

  it.effect.prop(
    "classifies every generated identifier the same way after a round trip",
    [Arbitrary.schema(OntologyIdentifier)],
    Effect.fnUntraced(function* ([identifier]) {
      const wire = yield* S.encodeEffect(OntologyIdentifier)(identifier);
      const decoded = yield* S.decodeEffect(OntologyIdentifier)(wire);
      strictEqual(decoded, identifier);
      strictEqual(S.is(ResourceIdentifier)(decoded), S.is(ResourceIdentifier)(identifier));
    }),
    { arbitrary: fcRuns(100) }
  );
});

describe("FunctionVersion", () => {
  lawful("FunctionVersion", FunctionVersion);

  it("accepts release versions and versions with a tag suffix", () => {
    // `1.2.3` and `1.2.3-rc1` are the two examples the wire contract documents.
    const versions = ["1.2.3", "1.2.3-rc1", "0.0.0", "10.200.3000", "1.2.3-rc.1-x", "1.2.3-SNAPSHOT", "01.02.03"];
    deepStrictEqual(A.map(versions, S.is(FunctionVersion)), A.map(versions, () => true));
  });

  it("rejects everything that is not major.minor.patch with an optional tag", () => {
    const counterExamples = [
      "",
      "latest",
      "1",
      "1.2",
      "1.2.3.4",
      "v1.2.3",
      "1.2.x",
      "1.2.3-",
      "1.2.3-.x",
      "1.2.3+build",
      "1.2.3 ",
      " 1.2.3",
      "1.2.3\n",
      "-1.2.3",
      "1.-2.3",
      "१.२.३",
    ];
    deepStrictEqual(A.map(counterExamples, S.is(FunctionVersion)), A.map(counterExamples, () => false));
  });

  it.effect(
    "decodes to the same string under its own brand",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(FunctionVersion)("1.2.3-rc1");
      const encoded = yield* S.encodeEffect(FunctionVersion)(decoded);
      strictEqual(decoded, FunctionVersion.make("1.2.3-rc1"));
      strictEqual(encoded, "1.2.3-rc1");
      const refusesLatest = yield* rejects(FunctionVersion)("latest");
      assertTrue(refusesLatest);
    })
  );

  it("is a brand of its own, distinct from the function it versions", () => {
    const facts: readonly [Equals<FunctionVersion, FunctionRid>, FunctionVersion extends string ? true : false] = [
      false,
      true,
    ];
    deepStrictEqual(facts, [false, true]);
  });
});
