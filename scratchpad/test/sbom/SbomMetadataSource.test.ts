// Derivation from a package.json manifest.
//
// Half of the hand-rolled predecessor is DEAD here rather than ported:
// `parseAuthor` is `Person.FromValue`, and `parseRepository`'s four-substitution
// git-URL normalization is `Repository.browseUrl` — both in
// `@effected/package-json`, both with wire fidelity the hand-roll lacked. What
// remains is the part that is genuinely CycloneDX vocabulary: which manifest
// field becomes which external-reference type, how a supplier resolves, and
// what a purl looks like.
//
// The purl expectations are the package-url spec's own test vectors
// (`tests/types/npm-test.json`): a scoped package is `pkg:npm/%40angular/animation@12.3.1`
// — the scope is the NAMESPACE with its `@` percent-encoded and the separating
// slash kept literal. The predecessor emitted `encodeURIComponent(name)`, which
// collapses that slash to `%2F` and is not a canonical purl.

import { assert, describe, it } from "@effect/vitest";
import { Package } from "../../effected/package-json/index.ts";
import * as Effect from "effect/Effect";
import { Contact, SbomMetadata, SbomMetadataSource, Supplier } from "../../effected/sbom/index.ts";

const manifest = {
	name: "@effected/sbom",
	version: "0.1.0",
	description: "supply-chain artifacts",
	license: "MIT",
	author: "Dee <dee@example.com> (https://dee.example)",
	maintainers: ["Ray <ray@example.com>", { name: "Vee", email: "vee@example.com" }],
	keywords: ["sbom", "cyclonedx"],
	repository: { type: "git", url: "git+https://github.com/effected/kit.git", directory: "packages/sbom" },
	bugs: { url: "https://github.com/effected/kit/issues" },
	homepage: "https://effected.dev",
};

const decode = (value: Record<string, unknown> = manifest) => Package.decode(value);

describe("SbomMetadataSource.npmPurl", () => {
	it("encodes an unscoped package as the spec's canonical form", () => {
		assert.strictEqual(SbomMetadataSource.npmPurl("foobar", "12.3.1"), "pkg:npm/foobar@12.3.1");
	});

	it("keeps the scope a namespace: %40scope/name, not %40scope%2Fname", () => {
		// The package-url spec's own roundtrip vector. `encodeURIComponent(name)`
		// — what the predecessor did — produces `pkg:npm/%40angular%2Fanimation`,
		// which parses as a namespace-less name and is not canonical.
		assert.strictEqual(
			SbomMetadataSource.npmPurl("@angular/animation", "12.3.1"),
			"pkg:npm/%40angular/animation@12.3.1",
		);
	});

	it("omits the version segment when there is no version", () => {
		assert.strictEqual(SbomMetadataSource.npmPurl("foobar"), "pkg:npm/foobar");
	});
});

describe("SbomMetadataSource.componentFor", () => {
	it("derives purl and bom-ref from name and version", () => {
		const component = SbomMetadataSource.componentFor({ name: "lodash", version: "4.17.21" });
		assert.strictEqual(component.type, "library");
		assert.strictEqual(component.purl, "pkg:npm/lodash@4.17.21");
		assert.strictEqual(component.bomRef, "lodash@4.17.21");
	});

	it("carries license and description when supplied, and omits them when not", () => {
		const rich = SbomMetadataSource.componentFor({
			name: "left-pad",
			version: "1.0.0",
			license: "WTFPL",
			description: "pads",
		});
		assert.deepStrictEqual(rich.licenses, ["WTFPL"]);
		assert.strictEqual(rich.description, "pads");

		const bare = SbomMetadataSource.componentFor({ name: "left-pad", version: "1.0.0" });
		assert.strictEqual(bare.licenses, undefined);
		assert.strictEqual(bare.description, undefined);
	});

	it("honours an explicit component type", () => {
		assert.strictEqual(SbomMetadataSource.componentFor({ name: "app", type: "application" }).type, "application");
	});

	it("accepts statically-undefined optional fields under exactOptionalPropertyTypes", () => {
		// Regression for #664: a caller forwarding a statically optional value
		// (the shape `@effected/workspaces` hands out for `version`) must compile
		// without a conditional spread. This test file is compiled with
		// exactOptionalPropertyTypes: true, so the widening lives or dies here.
		const pkg: {
			name: string;
			version: string | undefined;
			license: string | undefined;
			description: string | undefined;
			type: "library" | undefined;
		} = {
			name: "left-pad",
			version: undefined,
			license: undefined,
			description: undefined,
			type: undefined,
		};
		const component = SbomMetadataSource.componentFor({
			name: pkg.name,
			version: pkg.version,
			license: pkg.license,
			description: pkg.description,
			type: pkg.type,
		});
		// Explicit `undefined` behaves exactly like an omitted key: no version
		// segment in the purl, no licenses, no description, the default type.
		assert.strictEqual(component.purl, "pkg:npm/left-pad");
		assert.strictEqual(component.licenses, undefined);
		assert.strictEqual(component.description, undefined);
		assert.strictEqual(component.type, "library");
	});
});

describe("SbomMetadataSource.rootComponent", () => {
	it.effect("maps the manifest's identity fields", () =>
		Effect.gen(function* () {
			const component = SbomMetadataSource.rootComponent(yield* decode());
			assert.strictEqual(component.name, "@effected/sbom");
			assert.strictEqual(component.version, "0.1.0");
			assert.strictEqual(component.description, "supply-chain artifacts");
			assert.strictEqual(component.purl, "pkg:npm/%40effected/sbom@0.1.0");
			assert.strictEqual(component.bomRef, "@effected/sbom@0.1.0");
			assert.deepStrictEqual(component.licenses, ["MIT"]);
		}),
	);

	it.effect("maps keywords onto CycloneDX 1.6 tags", () =>
		Effect.gen(function* () {
			// `tags` is 1.6-only, which is part of what the 1.6-only ruling bought.
			assert.deepStrictEqual(SbomMetadataSource.rootComponent(yield* decode()).tags, ["sbom", "cyclonedx"]);
		}),
	);

	it.effect("maps maintainers onto component authors", () =>
		Effect.gen(function* () {
			const authors = SbomMetadataSource.rootComponent(yield* decode()).authors ?? [];
			assert.deepStrictEqual(
				authors.map((author) => author.name),
				["Ray", "Vee"],
			);
			assert.strictEqual(authors[0]?.email, "ray@example.com");
		}),
	);

	it.effect("falls back to the author when the manifest lists no maintainers", () =>
		Effect.gen(function* () {
			const { maintainers: _maintainers, ...withoutMaintainers } = manifest;
			const authors = SbomMetadataSource.rootComponent(yield* decode(withoutMaintainers)).authors ?? [];
			assert.deepStrictEqual(
				authors.map((author) => author.name),
				["Dee"],
			);
		}),
	);

	it.effect("resolves the publisher: explicit, then supplier, then the manifest author", () =>
		Effect.gen(function* () {
			const pkg = yield* decode();
			const supplier = Supplier.make({ name: "Acme" });
			assert.strictEqual(
				SbomMetadataSource.rootComponent(pkg, { publisher: "Explicit", supplier }).publisher,
				"Explicit",
			);
			assert.strictEqual(SbomMetadataSource.rootComponent(pkg, { supplier }).publisher, "Acme");
			assert.strictEqual(SbomMetadataSource.rootComponent(pkg).publisher, "Dee");
		}),
	);

	it.effect("carries an explicit copyright and omits it otherwise", () =>
		Effect.gen(function* () {
			const pkg = yield* decode();
			assert.strictEqual(SbomMetadataSource.rootComponent(pkg).copyright, undefined);
			assert.strictEqual(
				SbomMetadataSource.rootComponent(pkg, { copyright: "Copyright 2026 Acme" }).copyright,
				"Copyright 2026 Acme",
			);
		}),
	);

	it.effect("omits the licenses array entirely for an unlicensed manifest", () =>
		Effect.gen(function* () {
			const pkg = yield* decode({ name: "bare", version: "1.0.0" });
			const component = SbomMetadataSource.rootComponent(pkg);
			assert.strictEqual(component.licenses, undefined);
			assert.strictEqual(component.description, undefined);
			assert.strictEqual(component.tags, undefined);
			assert.strictEqual(component.authors, undefined);
			assert.strictEqual(component.publisher, undefined);
		}),
	);
});

describe("SbomMetadataSource.externalReferences", () => {
	it.effect("normalizes the repository through the package-json model, not a regex", () =>
		Effect.gen(function* () {
			// `git+https://github.com/effected/kit.git` browses at
			// `https://github.com/effected/kit`. The normalization is
			// `Repository.browseUrl`'s; this package only chooses the reference type.
			const references = SbomMetadataSource.externalReferences(yield* decode());
			const vcs = references.find((reference) => reference.type === "vcs");
			assert.strictEqual(vcs?.url, "https://github.com/effected/kit");
		}),
	);

	it.effect("normalizes the scp-like git form the predecessor's regex chain also handled", () =>
		Effect.gen(function* () {
			const pkg = yield* decode({ ...manifest, repository: "git@github.com:effected/kit.git" });
			const vcs = SbomMetadataSource.externalReferences(pkg).find((reference) => reference.type === "vcs");
			assert.strictEqual(vcs?.url, "https://github.com/effected/kit");
		}),
	);

	it.effect("emits no vcs reference when the repository value is not a URL the model recognizes", () =>
		Effect.gen(function* () {
			// The discriminating negative: an externalReference.url that is not a URL
			// is a document that validates and misleads.
			const pkg = yield* decode({ ...manifest, repository: "  " });
			assert.isUndefined(SbomMetadataSource.externalReferences(pkg).find((r) => r.type === "vcs"));
		}),
	);

	it.effect("maps bugs onto issue-tracker and homepage onto documentation", () =>
		Effect.gen(function* () {
			const references = SbomMetadataSource.externalReferences(yield* decode());
			assert.strictEqual(
				references.find((reference) => reference.type === "issue-tracker")?.url,
				"https://github.com/effected/kit/issues",
			);
			assert.strictEqual(
				references.find((reference) => reference.type === "documentation")?.url,
				"https://effected.dev",
			);
		}),
	);

	it.effect("emits no issue-tracker reference for an email-only bugs entry", () =>
		Effect.gen(function* () {
			const pkg = yield* decode({ ...manifest, bugs: { email: "bugs@example.com" } });
			assert.isUndefined(SbomMetadataSource.externalReferences(pkg).find((r) => r.type === "issue-tracker"));
		}),
	);

	it.effect("lets an explicit documentation URL win over the manifest's homepage", () =>
		Effect.gen(function* () {
			const references = SbomMetadataSource.externalReferences(yield* decode(), {
				documentationUrl: "https://docs.example",
			});
			assert.strictEqual(
				references.find((reference) => reference.type === "documentation")?.url,
				"https://docs.example",
			);
		}),
	);

	it.effect("adds the supplier's first URL as a website when it differs from the documentation URL", () =>
		Effect.gen(function* () {
			const pkg = yield* decode();
			const supplier = Supplier.make({ name: "Acme", url: ["https://acme.example"] });
			assert.strictEqual(
				SbomMetadataSource.externalReferences(pkg, { supplier }).find((r) => r.type === "website")?.url,
				"https://acme.example",
			);

			// Same URL twice is one reference, not two rows saying the same thing.
			const same = Supplier.make({ name: "Acme", url: ["https://effected.dev"] });
			assert.isUndefined(
				SbomMetadataSource.externalReferences(pkg, { supplier: same }).find((r) => r.type === "website"),
			);
		}),
	);

	it.effect("emits nothing at all for a manifest carrying none of the four fields", () =>
		Effect.gen(function* () {
			assert.lengthOf(SbomMetadataSource.externalReferences(yield* decode({ name: "bare", version: "1.0.0" })), 0);
		}),
	);
});

describe("SbomMetadataSource.fromPackage", () => {
	it.effect("threads an explicit supplier and timestamp onto the metadata", () =>
		Effect.gen(function* () {
			const metadata = SbomMetadataSource.fromPackage(yield* decode(), {
				supplier: Supplier.make({ name: "Acme" }),
				timestamp: "2026-07-25T00:00:00.000Z",
			});
			assert.strictEqual(metadata.supplier?.name, "Acme");
			assert.strictEqual(metadata.timestamp, "2026-07-25T00:00:00.000Z");
		}),
	);

	it.effect("fills the supplier's contacts from maintainers when it has none", () =>
		Effect.gen(function* () {
			const metadata = SbomMetadataSource.fromPackage(yield* decode(), { supplier: Supplier.make({ name: "Acme" }) });
			assert.deepStrictEqual(
				(metadata.supplier?.contact ?? []).map((contact) => contact.name),
				["Ray", "Vee"],
			);
		}),
	);

	it.effect("never overwrites contacts the caller supplied", () =>
		Effect.gen(function* () {
			const supplier = Supplier.make({ name: "Acme", contact: [Contact.make({ name: "Support" })] });
			const metadata = SbomMetadataSource.fromPackage(yield* decode(), { supplier });
			assert.deepStrictEqual(
				(metadata.supplier?.contact ?? []).map((contact) => contact.name),
				["Support"],
			);
		}),
	);

	it.effect("derives no supplier and no authors from a manifest alone", () =>
		Effect.gen(function* () {
			// A manifest says who wrote the software, never who assembled the SBOM or
			// which organization supplied it. Inventing either would fabricate two of
			// the NTIA elements.
			const metadata = SbomMetadataSource.fromPackage(yield* decode());
			assert.isUndefined(metadata.supplier);
			assert.isUndefined(metadata.authors);
			assert.isUndefined(metadata.timestamp);
		}),
	);

	it.effect("carries explicit SBOM authors", () =>
		Effect.gen(function* () {
			const metadata = SbomMetadataSource.fromPackage(yield* decode(), {
				authors: [Contact.make({ name: "release-bot" })],
			});
			assert.strictEqual(metadata.authors?.[0]?.name, "release-bot");
		}),
	);

	it.effect("accepts statically-undefined options under exactOptionalPropertyTypes", () =>
		Effect.gen(function* () {
			// Same wall as ComponentInput (#664): a timestamp or supplier read out
			// of config arrives as `T | undefined`, and forwarding it must compile
			// without a conditional spread at every call site.
			const config: {
				supplier: Supplier | undefined;
				authors: ReadonlyArray<Contact> | undefined;
				timestamp: string | undefined;
				publisher: string | undefined;
				copyright: string | undefined;
				documentationUrl: string | undefined;
				type: "library" | undefined;
			} = {
				supplier: undefined,
				authors: undefined,
				timestamp: undefined,
				publisher: undefined,
				copyright: undefined,
				documentationUrl: undefined,
				type: undefined,
			};
			const pkg = yield* decode();
			const metadata = SbomMetadataSource.fromPackage(pkg, config);
			assert.isUndefined(metadata.supplier);
			assert.isUndefined(metadata.authors);
			assert.isUndefined(metadata.timestamp);
			// The same options feed the root component: explicit `undefined` falls
			// through to the manifest exactly as an omitted key does.
			const root = SbomMetadataSource.rootComponent(pkg, config);
			assert.strictEqual(root.type, "library");
			assert.strictEqual(root.publisher, "Dee");
			assert.isUndefined(root.copyright);
			assert.isTrue(
				root.externalReferences?.some((ref) => ref.type === "documentation" && ref.url === "https://effected.dev"),
			);
		}),
	);
});

describe("SbomMetadataSource.formatCopyright", () => {
	it("names a single year", () => {
		assert.strictEqual(SbomMetadataSource.formatCopyright("Acme", { year: 2026 }), "Copyright 2026 Acme");
	});

	it("spans a range when the start year differs", () => {
		assert.strictEqual(
			SbomMetadataSource.formatCopyright("Acme", { startYear: 2020, year: 2026 }),
			"Copyright 2020-2026 Acme",
		);
	});

	it("collapses a range whose ends are the same year", () => {
		assert.strictEqual(
			SbomMetadataSource.formatCopyright("Acme", { startYear: 2026, year: 2026 }),
			"Copyright 2026 Acme",
		);
	});

	it("accepts a statically-undefined start year under exactOptionalPropertyTypes", () => {
		const years: { startYear: number | undefined; year: number } = { startYear: undefined, year: 2026 };
		assert.strictEqual(SbomMetadataSource.formatCopyright("Acme", years), "Copyright 2026 Acme");
	});

	it("takes the year as an argument, never from an ambient clock", () => {
		// The predecessor defaulted `endYear` to `new Date().getFullYear()`, which
		// made its output untestable and its purity a claim rather than a property.
		// Two calls a year apart must be reproducible from the arguments alone.
		assert.strictEqual(SbomMetadataSource.formatCopyright("Acme", { year: 1999 }), "Copyright 1999 Acme");
	});
});

describe("SbomMetadataSource.merge", () => {
	it("lets the override win on every field, not just the one a test happens to check", () => {
		// Field by field, or a merge that is right about `supplier` and wrong about
		// `timestamp` passes a suite that only ever asserts on suppliers.
		const base = SbomMetadata.make({
			timestamp: "2026-01-01T00:00:00.000Z",
			authors: [Contact.make({ name: "base-author" })],
			component: SbomMetadataSource.componentFor({ name: "base", version: "1.0.0" }),
			supplier: Supplier.make({ name: "Inferred" }),
		});
		const merged = SbomMetadataSource.merge(
			base,
			SbomMetadata.make({
				timestamp: "2026-07-25T00:00:00.000Z",
				authors: [Contact.make({ name: "override-author" })],
				component: SbomMetadataSource.componentFor({ name: "override", version: "2.0.0" }),
				supplier: Supplier.make({ name: "Explicit" }),
			}),
		);
		assert.strictEqual(merged.timestamp, "2026-07-25T00:00:00.000Z");
		assert.strictEqual(merged.authors?.[0]?.name, "override-author");
		assert.strictEqual(merged.component?.name, "override");
		assert.strictEqual(merged.supplier?.name, "Explicit");
	});

	it("keeps every base field the override does not carry", () => {
		const base = SbomMetadata.make({
			timestamp: "2026-01-01T00:00:00.000Z",
			authors: [Contact.make({ name: "base-author" })],
			component: SbomMetadataSource.componentFor({ name: "base", version: "1.0.0" }),
			supplier: Supplier.make({ name: "Inferred" }),
		});
		const merged = SbomMetadataSource.merge(base, SbomMetadata.make({}));
		assert.strictEqual(merged.timestamp, "2026-01-01T00:00:00.000Z");
		assert.strictEqual(merged.authors?.[0]?.name, "base-author");
		assert.strictEqual(merged.component?.name, "base");
		assert.strictEqual(merged.supplier?.name, "Inferred");
	});

	it("is a helper, not a policy — the caller decides which side is the override", () => {
		const inferred = SbomMetadata.make({ supplier: Supplier.make({ name: "Inferred" }) });
		const explicit = SbomMetadata.make({ supplier: Supplier.make({ name: "Explicit" }) });
		assert.strictEqual(SbomMetadataSource.merge(explicit, inferred).supplier?.name, "Inferred");
	});

	it("returns a SbomMetadata instance, not a plain object", () => {
		const merged = SbomMetadataSource.merge(SbomMetadata.make({}), SbomMetadata.make({}));
		assert.instanceOf(merged, SbomMetadata);
	});
});
