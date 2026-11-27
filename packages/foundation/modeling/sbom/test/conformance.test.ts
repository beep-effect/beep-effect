import { Component, Contact, ExternalReference, Sbom, SbomMetadata, Supplier } from "@beep/sbom";
import { isValidExpression, License } from "@beep/spdx";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { identity } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import VENDORED_SCHEMA from "./fixtures/bom-1.6.SNAPSHOT.schema.json" with { type: "json" };

const UnknownJson = S.fromJsonString(S.Unknown);

const RequiredProperties = S.Struct({ required: S.String.pipe(S.Array, S.optionalKey) });
const RequiredPropertyItems = S.Array(RequiredProperties);
const JsonDefinition = S.Struct({
  properties: S.optionalKey(S.Record(S.String, S.Struct({ enum: S.String.pipe(S.Array, S.optionalKey) }))),
  required: RequiredProperties.fields.required,
  oneOf: S.Struct({
    ...RequiredProperties.fields,
    items: S.optionalKey(S.Unknown),
    maxItems: S.optionalKey(S.Finite),
  }).pipe(S.Array, S.optionalKey),
});

const SCHEMA: unknown = VENDORED_SCHEMA;
assertTrue(
  S.is(
    S.Struct({
      ...JsonDefinition.fields,
      $id: S.optionalKey(S.String),
      definitions: S.Record(S.String, S.Unknown),
    })
  )(SCHEMA)
);

// decision: conformance-against-the-vendored-schema
const definition = (name: string): typeof JsonDefinition.Type => {
  const found = SCHEMA.definitions[name];
  assert.isDefined(found, `the vendored schema has no definition for ${name}`);
  assertTrue(S.is(JsonDefinition)(found));
  return found;
};

const fullDocument = () =>
  Sbom.generate({
    root: Component.make({
      type: "library",
      name: "@effected/sbom",
      version: "0.1.0",
      purl: "pkg:npm/%40effected%2Fsbom@0.1.0",
      bomRef: "@effected/sbom@0.1.0",
      description: "supply-chain artifacts",
      licenses: ["MIT"],
      tags: ["sbom", "cyclonedx"],
      publisher: "Acme",
      copyright: "Copyright 2026 Acme",
      authors: [Contact.make({ name: "Dee", email: "dee@example.com" })],
      externalReferences: [
        ExternalReference.make({ type: "vcs", url: "https://github.com/effected/kit" }),
        ExternalReference.make({ type: "issue-tracker", url: "https://github.com/effected/kit/issues" }),
        ExternalReference.make({ type: "website", url: "https://effected.dev" }),
        ExternalReference.make({ type: "documentation", url: "https://effected.dev/docs" }),
      ],
    }),
    components: [Component.make({ type: "library", name: "dep", version: "1.0.0" })],
    metadata: SbomMetadata.make({
      timestamp: "2026-07-25T00:00:00.000Z",
      authors: [Contact.make({ name: "Ray", email: "ray@example.com" })],
      supplier: Supplier.make({ name: "Acme", url: ["https://acme.example"] }),
    }),
  });

const ConformanceDocument = S.Struct({
  bomFormat: S.String,
  metadata: S.Struct({
    component: S.Struct({
      type: S.String,
      externalReferences: S.Array(S.Struct({ type: S.String })),
    }),
  }),
  components: S.Array(S.Struct({ type: S.String })),
});

const emitted = (): typeof ConformanceDocument.Type => {
  const document: unknown = Result.getOrThrowWith(S.decodeResult(UnknownJson)(Sbom.toJson(fullDocument())), identity);
  assertTrue(S.is(ConformanceDocument)(document));
  return document;
};

describe("CycloneDX 1.6 conformance — expectations derived from the vendored schema, never hand-written", () => {
  it("the vendored schema is the released 1.6 one", () => {
    const id = SCHEMA.$id;
    assert.strictEqual(
      id,
      "http://cyclonedx.org/schema/bom-1.6.schema.json",
      "guards the oracle: a fixture of another version silently changes the meaning of every assertion"
    );
  });

  it("satisfies the document's required properties", () => {
    const document = emitted();
    for (const key of SCHEMA.required ?? []) {
      assert.property(document, key, `the schema requires a top-level ${key}`);
    }
  });

  it("declares the bomFormat the schema's enum permits", () => {
    const permitted = SCHEMA.properties?.bomFormat?.enum ?? [];
    assert.include(permitted, emitted().bomFormat);
  });

  it("every component satisfies the component definition's required properties", () => {
    const required = definition("component").required ?? [];
    const document = emitted();
    const components = [document.metadata.component, ...document.components];
    assert.isAbove(components.length, 1);
    for (const component of components) {
      for (const key of required) {
        assert.property(component, key, `a component must carry ${key}`);
      }
    }
  });

  it("every component type is a member of the schema's enum", () => {
    const permitted = definition("component").properties?.type?.enum ?? [];
    assert.isAbove(permitted.length, 0);
    const document = emitted();
    const types = [document.metadata.component.type, ...A.map(document.components, (c) => c.type)];
    for (const type of types) {
      assert.include(permitted, type, `${type} is not a CycloneDX component type`);
    }
  });

  it("every external-reference type is a member of the schema's 43-value enum", () => {
    const permitted = definition("externalReference").properties?.type?.enum ?? [];
    assert.isAbove(permitted.length, 40);
    const references = emitted().metadata.component.externalReferences;
    assert.lengthOf(references, 4, "the model narrows to four of the specification types, and each must really exist");
    for (const reference of references) {
      assert.include(permitted, reference.type, `${reference.type} is not a CycloneDX external-reference type`);
    }
  });

  it("every external reference carries the properties the schema requires", () => {
    const required = definition("externalReference").required ?? [];
    const references = emitted().metadata.component.externalReferences;
    for (const reference of references) {
      for (const key of required) assert.property(reference, key);
    }
  });

  it("emits only property names the schema knows, at every level", () => {
    const known = (name: string): ReadonlyArray<string> => R.keys(definition(name).properties ?? {});
    const document = emitted();

    const componentKeys = known("component");
    const rootComponent = document.metadata.component;
    for (const key of R.keys(rootComponent)) {
      assert.isTrue(A.contains(componentKeys, key), `component.${key} is not in the CycloneDX component definition`);
    }

    const metadataKeys = known("metadata");
    for (const key of R.keys(document.metadata)) {
      assert.isTrue(A.contains(metadataKeys, key), `metadata.${key} is not in the CycloneDX metadata definition`);
    }

    const documentKeys = R.keys(SCHEMA.properties ?? {});
    for (const key of R.keys(document)) {
      assert.isTrue(
        A.contains(documentKeys, key),
        `${key} is not a CycloneDX document property: a typo or an invention looks right to us, wrong to a verifier`
      );
    }
  });
});

const LicenseDocument = S.Struct({
  metadata: S.Struct({
    component: S.Struct({ licenses: S.Record(S.String, S.Unknown).pipe(S.Array, S.optionalKey) }),
  }),
});

const licensesOf = (...licenses: ReadonlyArray<string>): ReadonlyArray<Record<string, unknown>> => {
  const document = Sbom.generate({
    root: Component.make({ type: "library", name: "x", licenses }),
    components: [],
  });
  const emitted: unknown = Result.getOrThrowWith(S.decodeResult(UnknownJson)(Sbom.toJson(document)), identity);
  assertTrue(S.is(LicenseDocument)(emitted));
  return emitted.metadata.component.licenses ?? [];
};

describe("licenses — the three shapes the schema permits, chosen by @beep/spdx", () => {
  it("the schema's license object offers exactly an id branch and a name branch", () => {
    const branches = A.flatMap(definition("license").oneOf ?? [], (branch) => branch.required ?? []);
    assert.deepStrictEqual(branches, ["id", "name"]);
  });

  it("renders a catalog identifier through the id branch", () => {
    assert.isTrue(
      License.isKnownId("MIT"),
      "@beep/spdx, the one SPDX engine and never a local regex, must agree MIT is a catalog identifier"
    );
    assert.deepStrictEqual<unknown>(licensesOf("MIT"), [{ license: { id: "MIT" } }]);
  });

  it("renders an expression through the expression tuple, never as an id", () => {
    assert.isFalse(License.isKnownId("MIT OR Apache-2.0"), "as a license.id it would fail the identifier enumeration");
    assert.isTrue(isValidExpression("MIT OR Apache-2.0"), "a manifest license field is an SPDX expression field");

    const expressionBranch = (definition("licenseChoice").oneOf ?? [])[1];
    assert.strictEqual(expressionBranch?.maxItems, 1, "the schema's expression branch is a one-element tuple");
    const items = expressionBranch?.items;
    assertTrue(S.is(RequiredPropertyItems)(items));
    assert.deepStrictEqual(items[0]?.required, ["expression"]);

    const emitted = licensesOf("MIT OR Apache-2.0");
    assert.lengthOf(emitted, 1);
    assert.deepStrictEqual<unknown>(emitted, [{ expression: "MIT OR Apache-2.0" }]);
  });

  it("renders a string that is neither identifier nor expression as a named license", () => {
    assert.isFalse(isValidExpression("UNLICENSED"), "UNLICENSED and SEE LICENSE IN <file> are npm values outside SPDX");
    assert.deepStrictEqual<unknown>(licensesOf("UNLICENSED"), [{ license: { name: "UNLICENSED" } }]);
    assert.deepStrictEqual<unknown>(licensesOf("SEE LICENSE IN LICENSE.txt"), [
      { license: { name: "SEE LICENSE IN LICENSE.txt" } },
    ]);
  });

  it("never mixes an expression into a multi-entry list", () => {
    const emitted = licensesOf("MIT", "MIT OR Apache-2.0");
    assert.lengthOf(emitted, 2);
    assert.deepStrictEqual<unknown>(
      emitted,
      [{ license: { id: "MIT" } }, { license: { name: "MIT OR Apache-2.0" } }],
      "the list and the one-element expression tuple are exclusive, so a second entry degrades it to a name"
    );
  });

  it("emits only keys the schema's license object defines", () => {
    const known = R.keys(definition("license").properties ?? {});
    for (const entry of licensesOf("MIT")) {
      const license = entry.license;
      assertTrue(P.isObject(license));
      for (const key of R.keys(license)) {
        assert.isTrue(A.contains(known, key), `license.${key} is not in the CycloneDX license definition`);
      }
    }
  });
});
