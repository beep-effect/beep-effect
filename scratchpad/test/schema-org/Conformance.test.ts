import { assert, describe, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { APIReference } from "../../effected/schema-org/APIReference.ts";
import {
	Conformance,
	DanglingReference,
	DeprecatedProperty,
	NonConformantGraphError,
	PropertyNotOnType,
	UnknownTerm,
} from "../../effected/schema-org/Conformance.ts";
import { CreativeWork } from "../../effected/schema-org/CreativeWork.ts";
import type { JsonLdNode } from "../../effected/schema-org/JsonLdDocument.ts";
import { JsonLdDocument } from "../../effected/schema-org/JsonLdDocument.ts";
import { NodeRef } from "../../effected/schema-org/NodeRef.ts";
import { Organization } from "../../effected/schema-org/Organization.ts";
import { Person } from "../../effected/schema-org/Person.ts";
import { SoftwareSourceCode } from "../../effected/schema-org/SoftwareSourceCode.ts";
import { TechArticle } from "../../effected/schema-org/TechArticle.ts";
import { Vocabulary } from "../../effected/schema-org/Vocabulary.ts";

/** Assemble a graph without going through the identity checks, which are not what this suite is about. */
const graphOf = (...nodes: ReadonlyArray<JsonLdNode>): JsonLdDocument => JsonLdDocument.make({ "@graph": nodes });

const PKG = "https://example.com/pkg#package";

describe("Conformance.check", () => {
	it("passes an inherited property, which is the consumer's first graph", () => {
		// `license` names exactly one domain, CreativeWork. A direct-membership
		// check rejects this graph, and rejecting it is how the gate gets
		// switched off.
		const graph = graphOf(
			SoftwareSourceCode.make({
				"@id": PKG,
				name: "example",
				license: ["https://spdx.org/licenses/MIT"],
				codeRepository: "https://github.com/example/example",
			}),
		);
		assert.deepStrictEqual(Conformance.check(graph), []);
	});

	it("passes a property inherited through a NON-FIRST parent of a multi-parent type", () => {
		// HowToStep is a ListItem AND a CreativeWork AND an ItemList. `license`
		// arrives through the second parent, `itemListElement` through the third,
		// so a single-parent walk reports both as misplaced.
		assert.isTrue(Vocabulary.isPropertyOn("license", "HowToStep"));
		assert.isTrue(Vocabulary.isPropertyOn("itemListElement", "HowToStep"));
		const graph = graphOf(
			CreativeWork.make({
				"@id": `${PKG}-step`,
				additional: { license: "https://spdx.org/licenses/MIT" },
			}),
		);
		assert.deepStrictEqual(Conformance.check(graph), []);
	});

	it("passes a many-domain property matching a non-first domain entry", () => {
		// `sponsor` names MedicalStudy, Event, Organization, Person, CreativeWork
		// and Grant — CreativeWork is the fifth. Equality against the first entry
		// reports this; membership does not.
		const graph = graphOf(
			CreativeWork.make({ "@id": PKG, additional: { sponsor: { "@id": "https://example.com/#acme" } } }),
			Organization.make({ "@id": `${PKG}-org`, additional: { sponsor: { "@id": "https://example.com/#acme" } } }),
		);
		assert.deepStrictEqual(Conformance.check(graph), []);
	});

	it("skips a foreign-namespace term with no issue at all", () => {
		// A consumer writing gs1:telephone opted into a vocabulary this package
		// does not claim to police. Reporting it would be a false rejection;
		// passing it clean is not an accident but the documented rule.
		const graph = graphOf(Organization.make({ "@id": PKG, additional: { "gs1:telephone": "+1 555 0100" } }));
		assert.deepStrictEqual(Conformance.check(graph), []);
		assert.isFalse(Vocabulary.hasProperty("gs1:telephone"));
	});

	it("treats a schema:-prefixed term exactly like its bare spelling", () => {
		// The hole a naive "has a colon, skip it" rule leaves: the prefixed form
		// is legal JSON-LD, so skipping it would silently stop validating
		// anything a consumer writes that way.
		const legal = graphOf(CreativeWork.make({ "@id": PKG, additional: { "schema:license": "https://x" } }));
		assert.deepStrictEqual(Conformance.check(legal), []);

		const misplaced = graphOf(
			SoftwareSourceCode.make({ "@id": PKG, additional: { "schema:softwareVersion": "1.2.3" } }),
		);
		const issues = Conformance.check(misplaced);
		assert.strictEqual(issues.length, 1);
		const [issue] = issues;
		assert.instanceOf(issue, PropertyNotOnType);
		// The issue quotes the term as the author wrote it.
		if (issue instanceof PropertyNotOnType) assert.strictEqual(issue.property, "schema:softwareVersion");

		const invented = graphOf(CreativeWork.make({ "@id": PKG, additional: { "schema:notATerm": "x" } }));
		assert.strictEqual(Conformance.check(invented).length, 1);
		assert.instanceOf(Conformance.check(invented)[0], UnknownTerm);
	});

	it("reports a term whose prefix the vocabulary document never declares", () => {
		// `gs1:` is declared in schema.org's own @context, so it is a vocabulary
		// the consumer plausibly opted into. `bogus:` is not declared by anyone,
		// which is no evidence of a real namespace and at least as likely to be
		// a typo — silence is the expensive direction, so it is reported.
		const graph = graphOf(Organization.make({ "@id": PKG, additional: { "bogus:telephone": "+1 555 0100" } }));
		const issues = Conformance.check(graph);
		assert.strictEqual(issues.length, 1);
		const [issue] = issues;
		assert.instanceOf(issue, UnknownTerm);
		if (issue instanceof UnknownTerm) assert.strictEqual(issue.term, "bogus:telephone");
	});

	it("skips every prefix the document declares, not just the one in the fixture", () => {
		// The recognized set is derived from the document's @context, so a
		// hand-kept list cannot drift out of date behind it.
		const graph = graphOf(
			Organization.make({
				"@id": PKG,
				additional: {
					"gs1:telephone": "+1 555 0100",
					"unece:Country": "US",
					"foaf:homepage": "https://example.com",
					"fibo-fnd-org-org:Organization": "acme",
				},
			}),
		);
		assert.deepStrictEqual(Conformance.check(graph), []);
	});

	it("passes a pending term, which is what shipping the full table buys", () => {
		// `creditText` is a pending term on CreativeWork. The cut this design
		// started with would have made it a documented false positive.
		const graph = graphOf(CreativeWork.make({ "@id": PKG, additional: { creditText: "Photo: Alice" } }));
		assert.deepStrictEqual(Conformance.check(graph), []);
	});

	it("reports a real property used on a type it is not legal on", () => {
		// The authentic case: softwareVersion is SoftwareApplication's;
		// SoftwareSourceCode spells it `version`. It reads correct and is
		// silently ignored downstream.
		const graph = graphOf(SoftwareSourceCode.make({ "@id": PKG, additional: { softwareVersion: "1.2.3" } }));
		const issues = Conformance.check(graph);
		assert.strictEqual(issues.length, 1);
		const [issue] = issues;
		assert.instanceOf(issue, PropertyNotOnType);
		assert.strictEqual(issue?._tag, "PropertyNotOnType");
		assert.deepStrictEqual(issue instanceof PropertyNotOnType ? [issue.nodeId, issue.nodeType, issue.property] : [], [
			PKG,
			"SoftwareSourceCode",
			"softwareVersion",
		]);
	});

	it("reports an invented property as UnknownTerm, never as a domain violation", () => {
		const graph = graphOf(SoftwareSourceCode.make({ "@id": PKG, additional: { codeRepositoryUrl: "https://x" } }));
		const issues = Conformance.check(graph);
		assert.strictEqual(issues.length, 1);
		const [issue] = issues;
		assert.instanceOf(issue, UnknownTerm);
		if (issue instanceof UnknownTerm) {
			assert.strictEqual(issue.kind, "property");
			assert.strictEqual(issue.term, "codeRepositoryUrl");
		}
	});

	it("reports an invented @type as UnknownTerm and does not bury it in property noise", () => {
		// v4 constructors validate, so an invented `@type` cannot be built — it
		// arrives by mutation after construction, or from a graph decoded out of
		// foreign JSON. `check` is total and must survive either.
		const node = SoftwareSourceCode.make({ "@id": PKG, name: "x", codeRepository: "https://example.com" });
		const graph = graphOf(node);
		(node as { "@type": string })["@type"] = "SoftwareSourceCodeRepository";
		const issues = Conformance.check(graph);
		assert.strictEqual(issues.length, 1);
		const [issue] = issues;
		assert.instanceOf(issue, UnknownTerm);
		if (issue instanceof UnknownTerm) assert.strictEqual(issue.kind, "type");
	});

	it("flags a deprecated property with its successor rather than rejecting it", () => {
		// `runtime` is legal on SoftwareSourceCode and superseded by
		// `runtimePlatform`: valid but flagged, exactly as spdx treats a
		// deprecated license id.
		const graph = graphOf(SoftwareSourceCode.make({ "@id": PKG, additional: { runtime: "node" } }));
		const issues = Conformance.check(graph);
		assert.strictEqual(issues.length, 1);
		const [issue] = issues;
		assert.instanceOf(issue, DeprecatedProperty);
		if (issue instanceof DeprecatedProperty) {
			assert.strictEqual(issue.property, "runtime");
			assert.strictEqual(issue.supersededBy, "runtimePlatform");
		}
		// Reported, but the default gate does not fail on it.
		assert.isTrue(Result.isSuccess(Conformance.validateResult(graph)));
		assert.isTrue(Result.isFailure(Conformance.validateResult(graph, { deprecations: "report" })));
	});

	it("reports a dangling reference with the property it sits in", () => {
		const graph = graphOf(SoftwareSourceCode.make({ "@id": PKG, author: [NodeRef.to("https://example.com/#alice")] }));
		const issues = Conformance.check(graph);
		assert.strictEqual(issues.length, 1);
		const [issue] = issues;
		assert.instanceOf(issue, DanglingReference);
		if (issue instanceof DanglingReference) {
			assert.strictEqual(issue.property, "author");
			assert.strictEqual(issue.reference, "https://example.com/#alice");
		}
	});

	it("does not report a reference the graph defines", () => {
		const alice = "https://example.com/#alice";
		const graph = graphOf(
			SoftwareSourceCode.make({ "@id": PKG, author: [NodeRef.to(alice)] }),
			Person.make({ "@id": alice, name: "Alice" }),
		);
		assert.deepStrictEqual(Conformance.check(graph), []);
	});
});

describe("Conformance.validateResult", () => {
	const misplaced = graphOf(SoftwareSourceCode.make({ "@id": PKG, additional: { softwareVersion: "1.2.3" } }));
	const invented = graphOf(SoftwareSourceCode.make({ "@id": PKG, additional: { notATerm: "x" } }));
	const dangling = graphOf(SoftwareSourceCode.make({ "@id": PKG, author: [NodeRef.to("https://example.com/#alice")] }));

	it("fails on a domain violation by default", () => {
		const result = Conformance.validateResult(misplaced);
		assert.isTrue(Result.isFailure(result));
		const error = Result.isFailure(result) ? result.failure : undefined;
		assert.instanceOf(error, NonConformantGraphError);
		assert.strictEqual(error?.issues.length, 1);
	});

	it("reports an unknown term without failing, and fails it under strict mode", () => {
		assert.isTrue(Result.isSuccess(Conformance.validateResult(invented)));
		assert.strictEqual(Conformance.check(invented).length, 1, "still reported, never silently passed");
		assert.isTrue(Result.isFailure(Conformance.validateResult(invented, { unknownTerms: "fail" })));
	});

	it("leaves a dangling reference out of the gate until asked", () => {
		assert.isTrue(Result.isSuccess(Conformance.validateResult(dangling)));
		assert.isTrue(Result.isFailure(Conformance.validateResult(dangling, { danglingReferences: "report" })));
	});

	it("returns the graph itself on success", () => {
		const clean = graphOf(SoftwareSourceCode.make({ "@id": PKG, name: "example" }));
		const result = Conformance.validateResult(clean);
		assert.isTrue(Result.isSuccess(result));
		if (Result.isSuccess(result)) assert.strictEqual(result.success, clean);
	});

	it("carries every issue on the error, not only the failing ones", () => {
		const both = graphOf(
			SoftwareSourceCode.make({
				"@id": PKG,
				author: [NodeRef.to("https://example.com/#alice")],
				additional: { softwareVersion: "1.2.3" },
			}),
		);
		const result = Conformance.validateResult(both);
		assert.isTrue(Result.isFailure(result));
		const error = Result.isFailure(result) ? result.failure : undefined;
		assert.strictEqual(error?.issues.length, 2);
		assert.isTrue(error?.message.includes("schema.org 30.0"));
	});

	it.effect("has an Effect twin defined in terms of the Result form", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(Conformance.validate(misplaced));
			assert.instanceOf(error, NonConformantGraphError);
			const ok = yield* Conformance.validate(graphOf(Person.make({ "@id": PKG, name: "Alice" })));
			assert.instanceOf(ok, JsonLdDocument);
		}),
	);
});

describe("self-conformance", () => {
	// The test that keeps the hand-written node classes honest: every field of
	// every shipped class must be domainIncludes-legal on that class's @type,
	// against the vendored table. It fails the day someone adds a
	// plausible-sounding field, and again the day schema.org moves one.
	const CLASSES = [
		["SoftwareSourceCode", SoftwareSourceCode],
		["TechArticle", TechArticle],
		["APIReference", APIReference],
		["Person", Person],
		["Organization", Organization],
		["CreativeWork", CreativeWork],
	] as const;

	for (const [name, schema] of CLASSES) {
		it(`declares only properties schema.org defines on ${name}`, () => {
			const fields = Object.keys(schema.fields).filter(
				(field) => field !== "@id" && field !== "@type" && field !== "additional",
			);
			assert.isAbove(fields.length, 0, "positive control: the class must actually have fields to check");
			assert.isTrue(Vocabulary.hasType(name));
			const illegal = fields.filter((field) => !Vocabulary.isPropertyOn(field, name));
			assert.deepStrictEqual(illegal, []);
		});
	}
});
