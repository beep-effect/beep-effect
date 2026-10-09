// The emitter: an owned CycloneDX 1.6 model and its canonical JSON.
//
// `generate` and `toJson` are TOTAL — no error channel — which is a deliberate
// correction of the package this replaces, where both were typed
// `Effect<_, SbomError>` with `reason: "build" | "serialize"`. Those failures
// could only happen because the CycloneDX library might throw; with an owned
// model over already-validated Schema values, neither can fail.

import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as S from "effect/Schema";
import { Component, Sbom, SbomMetadata, Supplier } from "../../effected/sbom/index.ts";

const ComponentDocument = S.Struct({
	metadata: S.Struct({ component: S.Record(S.String, S.Unknown) }),
});

const MetadataDocument = S.Struct({
	metadata: S.Struct({
		supplier: S.Struct({ name: S.String }),
		authors: S.Array(S.Struct({ name: S.String })),
		timestamp: S.String,
	}),
});

const root = Component.make({
	type: "library",
	name: "@effected/sbom",
	version: "0.1.0",
	purl: "pkg:npm/%40effected%2Fsbom@0.1.0",
	bomRef: "@effected/sbom@0.1.0",
});

const dep = (name: string, version: string) =>
	Component.make({
		type: "library",
		name,
		version,
		purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
		bomRef: `${name}@${version}`,
	});

describe("Sbom.generate", () => {
	it("is a plain function — no Effect, no error channel", () => {
		// If this ever needs `yield*`, the pure-tier claim has been lost.
		const document = Sbom.generate({ root, components: [] });
		assert.strictEqual(document.bomFormat, "CycloneDX");
		assert.strictEqual(document.specVersion, "1.6");
	});

	it("carries the root component as metadata.component", () => {
		const document = Sbom.generate({ root, components: [] });
		assert.strictEqual(document.metadata?.component?.name, "@effected/sbom");
	});

	it("sorts components by name for a stable document", () => {
		// Two runs over the same inputs must produce the same bytes, or an SBOM
		// digest changes for no reason and an attestation subject drifts with it.
		const document = Sbom.generate({ root, components: [dep("zulu", "1.0.0"), dep("alpha", "2.0.0")] });
		assert.deepStrictEqual(
			document.components.map((c) => c.name),
			["alpha", "zulu"],
		);
	});

	it("is deterministic across calls", () => {
		const once = Sbom.toJson(Sbom.generate({ root, components: [dep("a", "1.0.0")] }));
		const twice = Sbom.toJson(Sbom.generate({ root, components: [dep("a", "1.0.0")] }));
		assert.strictEqual(once, twice);
	});
});

describe("Sbom.toJson", () => {
	it("emits the hyphenated `bom-ref` key, not `bomRef`", () => {
		// The one field whose JSON name differs from its TypeScript name. Emitting
		// `bomRef` produces a document that looks right and validates wrong.
		const json: unknown = JSON.parse(Sbom.toJson(Sbom.generate({ root, components: [] })));
		assertTrue(S.is(ComponentDocument)(json));
		assert.property(json.metadata.component, "bom-ref");
		assert.notProperty(json.metadata.component, "bomRef");
	});

	it("omits absent optional fields rather than emitting null", () => {
		const bare = Component.make({ type: "library", name: "bare" });
		const json: unknown = JSON.parse(Sbom.toJson(Sbom.generate({ root: bare, components: [] })));
		assertTrue(S.is(ComponentDocument)(json));
		assert.notProperty(json.metadata.component, "version");
		assert.notProperty(json.metadata.component, "purl");
		assert.notProperty(json.metadata.component, "description");
	});

	it("renders licenses in CycloneDX's wrapper shape", () => {
		// `licenses` is an array of single-key wrapper objects, not bare strings.
		const licensed = Component.make({ type: "library", name: "x", licenses: ["MIT"] });
		const json: unknown = JSON.parse(Sbom.toJson(Sbom.generate({ root: licensed, components: [] })));
		assertTrue(S.is(ComponentDocument)(json));
		assert.deepStrictEqual<unknown>(json.metadata.component.licenses, [{ license: { id: "MIT" } }]);
	});

	it("carries supplier and authors onto metadata", () => {
		const document = Sbom.generate({
			root,
			components: [],
			metadata: SbomMetadata.make({
				timestamp: "2026-07-25T00:00:00.000Z",
				supplier: Supplier.make({ name: "Acme", url: ["https://acme.example"] }),
				authors: [{ name: "Dee", email: "dee@example.com" }],
			}),
		});
		const json: unknown = JSON.parse(Sbom.toJson(document));
		assertTrue(S.is(MetadataDocument)(json));
		assert.strictEqual(json.metadata.supplier.name, "Acme");
		assert.strictEqual(json.metadata.authors[0]?.name, "Dee");
		assert.strictEqual(json.metadata.timestamp, "2026-07-25T00:00:00.000Z");
	});

	it("honours an explicit indent", () => {
		const dense = Sbom.toJson(Sbom.generate({ root, components: [] }), { space: 0 });
		assert.isFalse(dense.includes("\n"));
	});

	it("accepts statically-undefined inputs under exactOptionalPropertyTypes", () => {
		// The #664 widening, applied to this module's inputs: an explicit
		// `undefined` metadata or indent behaves exactly like an omitted key.
		const input: { metadata: SbomMetadata | undefined; space: number | undefined } = {
			metadata: undefined,
			space: undefined,
		};
		const json = Sbom.toJson(Sbom.generate({ root, components: [], metadata: input.metadata }), { space: input.space });
		assert.isTrue(json.includes("\n"));
		assert.strictEqual(json, Sbom.toJson(Sbom.generate({ root, components: [] })));
	});
});
