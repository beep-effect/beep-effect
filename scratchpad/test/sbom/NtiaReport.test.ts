// The NTIA minimum elements, seven of them, each checked in both directions.
//
// The discriminating direction is the negative one: a validator that answers
// `satisfied: true` unconditionally passes every positive test ever written for
// it. Every element below therefore gets a document that satisfies it AND a
// document that does not — and the pair differs in exactly the one field the
// element is about, so a check reading the wrong field fails.

import { assert, describe, it } from "@effect/vitest";
import type { NtiaElementId } from "../../effected/sbom/index.ts";
import { Component, Contact, NtiaReport, Sbom, SbomDocument, SbomMetadata, Supplier } from "../../effected/sbom/index.ts";

const root = Component.make({
	type: "library",
	name: "@effected/sbom",
	version: "0.1.0",
	purl: "pkg:npm/%40effected/sbom@0.1.0",
});

const dep = Component.make({ type: "library", name: "dep", version: "1.0.0" });

/** A document satisfying all seven elements. */
const compliant = (metadata?: Partial<Parameters<typeof SbomMetadata.make>[0]>) =>
	Sbom.generate({
		root,
		components: [dep],
		metadata: SbomMetadata.make({
			timestamp: "2026-07-25T00:00:00.000Z",
			authors: [Contact.make({ name: "release-bot" })],
			supplier: Supplier.make({ name: "Acme" }),
			...metadata,
		}),
	});

const elementOf = (document: SbomDocument, id: NtiaElementId) => {
	const found = NtiaReport.of(document).elements.find((element) => element.id === id);
	assert.isDefined(found, `the report has no ${id} element`);
	return found;
};

const satisfies = (document: SbomDocument, id: NtiaElementId): boolean => elementOf(document, id)?.satisfied === true;

describe("NtiaReport.of — the seven elements", () => {
	it("reports every element exactly once, in the published order", () => {
		const ids = NtiaReport.of(compliant()).elements.map((element) => element.id);
		assert.deepStrictEqual(ids, [
			"supplierName",
			"componentName",
			"componentVersion",
			"uniqueIdentifier",
			"dependencyRelationship",
			"sbomAuthor",
			"timestamp",
		]);
	});

	it("1. supplier name", () => {
		assert.isTrue(satisfies(compliant(), "supplierName"));
		assert.strictEqual(elementOf(compliant(), "supplierName")?.value, "Acme");
		// An empty name is a supplier that identifies nobody.
		assert.isFalse(satisfies(compliant({ supplier: Supplier.make({ name: "  " }) }), "supplierName"));
	});

	it("2. component name", () => {
		assert.isTrue(satisfies(compliant(), "componentName"));
		const nameless = Sbom.generate({ root: Component.make({ type: "library", name: " " }), components: [dep] });
		assert.isFalse(satisfies(nameless, "componentName"));
	});

	it("3. component version", () => {
		assert.isTrue(satisfies(compliant(), "componentVersion"));
		const unversioned = Sbom.generate({ root: Component.make({ type: "library", name: "x" }), components: [dep] });
		assert.isFalse(satisfies(unversioned, "componentVersion"));
	});

	it("4. unique identifier — a purl, not merely a string", () => {
		assert.isTrue(satisfies(compliant(), "uniqueIdentifier"));
		assert.strictEqual(elementOf(compliant(), "uniqueIdentifier")?.value, "pkg:npm/%40effected/sbom@0.1.0");
		// The discriminating negative: present, non-empty, and not a package URL.
		const notAPurl = Sbom.generate({
			root: Component.make({ type: "library", name: "x", version: "1.0.0", purl: "https://example.test/x" }),
			components: [dep],
		});
		assert.isFalse(satisfies(notAPurl, "uniqueIdentifier"));
	});

	it("5. dependency relationship — a declared subject the components relate to", () => {
		assert.isTrue(satisfies(compliant(), "dependencyRelationship"));
		assert.strictEqual(elementOf(compliant(), "dependencyRelationship")?.value, "1 component");

		// A component list with nothing declaring what it is a list OF relates
		// nothing to anything, which is what this element is about.
		const rootless = SbomDocument.make({
			bomFormat: "CycloneDX",
			specVersion: "1.6",
			version: 1,
			components: [dep],
		});
		assert.isFalse(satisfies(rootless, "dependencyRelationship"));
	});

	it("5b. a package with no dependencies is still compliant", () => {
		// An empty list is an assertion ("this has no dependencies"), not a gap.
		const standalone = Sbom.generate({ root, components: [] });
		assert.isTrue(satisfies(standalone, "dependencyRelationship"));
		assert.strictEqual(elementOf(standalone, "dependencyRelationship")?.value, "0 components");
	});

	it("6. SBOM author — authors, else supplier, else publisher", () => {
		assert.isTrue(satisfies(compliant(), "sbomAuthor"));
		assert.strictEqual(elementOf(compliant(), "sbomAuthor")?.value, "release-bot");

		// The supplier stands in when nobody named an author…
		const bySupplier = Sbom.generate({
			root,
			components: [dep],
			metadata: SbomMetadata.make({ supplier: Supplier.make({ name: "Acme" }) }),
		});
		assert.isTrue(satisfies(bySupplier, "sbomAuthor"));
		assert.strictEqual(elementOf(bySupplier, "sbomAuthor")?.value, "Acme");

		// …and the publisher when there is no supplier either.
		const byPublisher = Sbom.generate({
			root: Component.make({ type: "library", name: "x", version: "1.0.0", publisher: "Dee" }),
			components: [dep],
		});
		assert.isTrue(satisfies(byPublisher, "sbomAuthor"));
		assert.strictEqual(elementOf(byPublisher, "sbomAuthor")?.value, "Dee");

		// Nothing at all.
		assert.isFalse(satisfies(Sbom.generate({ root, components: [dep] }), "sbomAuthor"));
	});

	it("7. timestamp — one that is actually a date", () => {
		assert.isTrue(satisfies(compliant(), "timestamp"));
		assert.strictEqual(elementOf(compliant(), "timestamp")?.value, "2026-07-25T00:00:00.000Z");
		// Present and non-empty is not the same as being a timestamp.
		assert.isFalse(satisfies(compliant({ timestamp: "last tuesday" }), "timestamp"));
		assert.isFalse(satisfies(Sbom.generate({ root, components: [dep] }), "timestamp"));
	});

	it("carries no value for an element it could not satisfy", () => {
		const element = elementOf(Sbom.generate({ root, components: [dep] }), "supplierName");
		assert.isFalse(element?.satisfied);
		assert.isUndefined(element?.value);
	});
});

describe("NtiaReport — the derived verdict", () => {
	it("is compliant only when every element is satisfied", () => {
		assert.isTrue(NtiaReport.of(compliant()).compliant);
		assert.isFalse(NtiaReport.of(Sbom.generate({ root, components: [dep] })).compliant);
	});

	it("names what is missing by stable id, never by prose", () => {
		// The ids are what a consumer branches on. The predecessor carried display
		// strings ("Supplier Name") plus remediation text naming its own config
		// file — a library cannot know a consumer's config format, and rendering
		// is the edge's job.
		const report = NtiaReport.of(Sbom.generate({ root, components: [dep] }));
		assert.deepStrictEqual(report.missing, ["supplierName", "sbomAuthor", "timestamp"]);
	});

	it("reports nothing missing for a compliant document", () => {
		assert.lengthOf(NtiaReport.of(compliant()).missing, 0);
	});

	it("is a report, not a failure — a non-compliant document still produces one", () => {
		// Compliance is a question, not an error: a caller may legitimately emit a
		// non-compliant SBOM and warn. Gating is the caller's decision to make.
		const report = NtiaReport.of(
			SbomDocument.make({ bomFormat: "CycloneDX", specVersion: "1.6", version: 1, components: [] }),
		);
		assert.instanceOf(report, NtiaReport);
		assert.lengthOf(report.elements, 7);
		assert.lengthOf(report.missing, 7);
	});
});
