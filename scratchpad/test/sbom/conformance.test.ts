// @effect-diagnostics nodeBuiltinImport:skip-file
// Conformance against the CycloneDX 1.6 specification itself.
//
// This package declines the CycloneDX library (6.6 MB, seven optional peers)
// and owns its emitter, so "the output is conformant" has to be checkable
// rather than asserted. The published schema is vendored under `fixtures/` and
// the expectations below are DERIVED FROM IT — `required` arrays, `enum`
// members, property names — never hand-written. A wrong external-reference
// type, a missing required field or a renamed property therefore fails against
// the specification, not against a copy of our own assumptions.
//
// This is targeted conformance over the subset we emit, not full JSON-schema
// validation: validating fully would need `ajv`, and taking a validator as a
// devDependency to check output we entirely control is the weight this package
// exists to avoid. The subset IS everything the emitter produces.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { License, isValidExpression } from "../../effected/spdx/index.ts";
import { Component, Contact, ExternalReference, Sbom, SbomMetadata, Supplier } from "../../effected/sbom/index.ts";

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

const SCHEMA: unknown = JSON.parse(
	readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", "bom-1.6.SNAPSHOT.schema.json"), "utf8"),
);
assertTrue(S.is(S.Struct({
	...JsonDefinition.fields,
	$id: S.optionalKey(S.String),
	definitions: S.Record(S.String, S.Unknown),
}))(SCHEMA));

const definition = (name: string): typeof JsonDefinition.Type => {
	const found = SCHEMA.definitions[name];
	assert.isDefined(found, `the vendored schema has no definition for ${name}`);
	assertTrue(S.is(JsonDefinition)(found));
	return found;
};

/** A document exercising every field the emitter can produce. */
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
	const document: unknown = JSON.parse(Sbom.toJson(fullDocument()));
	assertTrue(S.is(ConformanceDocument)(document));
	return document;
};

describe("CycloneDX 1.6 conformance — derived from the vendored schema", () => {
	it("the vendored schema is the released 1.6 one", () => {
		// Guards the oracle itself: if the fixture is swapped for another version,
		// every assertion below silently changes meaning.
		const id = SCHEMA.$id;
		assert.strictEqual(id, "http://cyclonedx.org/schema/bom-1.6.schema.json");
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
		const components = [
			document.metadata.component,
			...document.components,
		];
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
		const types = [
			document.metadata.component.type,
			...document.components.map((c) => c.type),
		];
		for (const type of types) {
			assert.include(permitted, type, `${type} is not a CycloneDX component type`);
		}
	});

	it("every external-reference type is a member of the schema's 43-value enum", () => {
		// The assertion most likely to catch an invented value: the model narrows
		// to four of the specification's types, and each must really exist.
		const permitted = definition("externalReference").properties?.type?.enum ?? [];
		assert.isAbove(permitted.length, 40);
		const references = emitted().metadata.component.externalReferences;
		assert.lengthOf(references, 4);
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
		// The `bom-ref` guard, generalized. A key the specification does not define
		// is either a typo or an invention, and both produce a document that looks
		// right to us and wrong to a verifier.
		const known = (name: string) => new Set(Object.keys(definition(name).properties ?? {}));
		const document = emitted();

		const componentKeys = known("component");
		const rootComponent = document.metadata.component;
		for (const key of Object.keys(rootComponent)) {
			assert.isTrue(componentKeys.has(key), `component.${key} is not in the CycloneDX component definition`);
		}

		const metadataKeys = known("metadata");
		for (const key of Object.keys(document.metadata)) {
			assert.isTrue(metadataKeys.has(key), `metadata.${key} is not in the CycloneDX metadata definition`);
		}

		const documentKeys = new Set(Object.keys(SCHEMA.properties ?? {}));
		for (const key of Object.keys(document)) {
			assert.isTrue(documentKeys.has(key), `${key} is not a CycloneDX document property`);
		}
	});
});

const LicenseDocument = S.Struct({
	metadata: S.Struct({
		component: S.Struct({ licenses: S.Record(S.String, S.Unknown).pipe(S.Array, S.optionalKey) }),
	}),
});

/** The `licenses` array a single-component document emits for these license strings. */
const licensesOf = (...licenses: ReadonlyArray<string>): ReadonlyArray<Record<string, unknown>> => {
	const document = Sbom.generate({
		root: Component.make({ type: "library", name: "x", licenses }),
		components: [],
	});
	const emitted: unknown = JSON.parse(Sbom.toJson(document));
	assertTrue(S.is(LicenseDocument)(emitted));
	return emitted.metadata.component.licenses ?? [];
};

describe("licenses — the three shapes the schema permits, chosen by @effected/spdx", () => {
	// A manifest's `license` field is an SPDX EXPRESSION field: `MIT`,
	// `MIT OR Apache-2.0` and `UNLICENSED` are all legal values of it, and the
	// specification renders them through three different JSON shapes. Emitting
	// every one as `{ license: { id } }` produces a document that looks right
	// and fails validation, because `license.id` is constrained to the SPDX
	// identifier enumeration. The id-versus-expression question is answered by
	// `@effected/spdx` — the kit's one SPDX engine — never by a local regex.

	it("the schema's license object offers exactly an id branch and a name branch", () => {
		const branches = (definition("license").oneOf ?? []).flatMap((branch) => branch.required ?? []);
		assert.deepStrictEqual(branches, ["id", "name"]);
	});

	it("renders a catalog identifier through the id branch", () => {
		assert.isTrue(License.isKnownId("MIT"), "the oracle must agree MIT is a catalog identifier");
		assert.deepStrictEqual<unknown>(licensesOf("MIT"), [{ license: { id: "MIT" } }]);
	});

	it("renders an expression through the expression tuple, never as an id", () => {
		// The discriminating case. `MIT OR Apache-2.0` is not an SPDX identifier,
		// so `{ license: { id: "MIT OR Apache-2.0" } }` is invalid against the
		// identifier enumeration the schema references.
		assert.isFalse(License.isKnownId("MIT OR Apache-2.0"));
		assert.isTrue(isValidExpression("MIT OR Apache-2.0"));

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
		// npm's own non-SPDX values: `UNLICENSED` and `SEE LICENSE IN <file>`.
		assert.isFalse(isValidExpression("UNLICENSED"));
		assert.deepStrictEqual<unknown>(licensesOf("UNLICENSED"), [{ license: { name: "UNLICENSED" } }]);
		assert.deepStrictEqual<unknown>(licensesOf("SEE LICENSE IN LICENSE.txt"), [
			{ license: { name: "SEE LICENSE IN LICENSE.txt" } },
		]);
	});

	it("never mixes an expression into a multi-entry list", () => {
		// The schema's two branches are exclusive: a list of license objects, OR a
		// single-element expression tuple. A second entry rules the tuple out, so
		// an expression that cannot be an id degrades to a named license.
		const emitted = licensesOf("MIT", "MIT OR Apache-2.0");
		assert.lengthOf(emitted, 2);
		assert.deepStrictEqual<unknown>(emitted, [{ license: { id: "MIT" } }, { license: { name: "MIT OR Apache-2.0" } }]);
	});

	it("emits only keys the schema's license object defines", () => {
		const known = new Set(Object.keys(definition("license").properties ?? {}));
		for (const entry of licensesOf("MIT")) {
			const license = entry.license;
			assertTrue(P.isObject(license));
			for (const key of Object.keys(license)) {
				assert.isTrue(known.has(key), `license.${key} is not in the CycloneDX license definition`);
			}
		}
	});
});
