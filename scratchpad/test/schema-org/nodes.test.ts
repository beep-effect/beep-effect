import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { APIReference } from "../../effected/schema-org/APIReference.ts";
import { CreativeWork, CreativeWorkFields } from "../../effected/schema-org/CreativeWork.ts";
import { JsonLdDocument } from "../../effected/schema-org/JsonLdDocument.ts";
import { NodeId, NodeRef } from "../../effected/schema-org/NodeRef.ts";
import { Organization } from "../../effected/schema-org/Organization.ts";
import { Person } from "../../effected/schema-org/Person.ts";
import { SoftwareSourceCode } from "../../effected/schema-org/SoftwareSourceCode.ts";
import { TechArticle, TechArticleFields } from "../../effected/schema-org/TechArticle.ts";
import { ThingFields } from "../../effected/schema-org/Thing.ts";

const ID = "https://example.com/#node";

describe("node classes", () => {
	it("each carries its schema.org type as @type, populated automatically", () => {
		const cases = [
			[SoftwareSourceCode.make({ "@id": ID }), "SoftwareSourceCode"],
			[TechArticle.make({ "@id": ID }), "TechArticle"],
			[APIReference.make({ "@id": ID }), "APIReference"],
			[Person.make({ "@id": ID }), "Person"],
			[Organization.make({ "@id": ID }), "Organization"],
			[CreativeWork.make({ "@id": ID }), "CreativeWork"],
		] as const;

		for (const [node, type] of cases) {
			assert.strictEqual(node["@type"], type, "the @type must match the vocabulary term exactly");
		}
	});

	it("accepts an explicit undefined for any optional field", () => {
		// This is the scoped `Schema.optional` exception. Under `optionalKey`
		// every one of these would throw, and every consumer call site would
		// need a conditional spread, because every field originates in a
		// possibly-absent piece of upstream metadata.
		const node = TechArticle.make({
			"@id": ID,
			headline: undefined,
			description: undefined,
			datePublished: undefined,
			author: undefined,
			mainEntity: undefined,
			additional: undefined,
		});

		assert.strictEqual(node["@id"], ID);
		assert.isUndefined(node.headline);
	});

	it("requires @id and nothing else", () => {
		assert.strictEqual(Person.make({ "@id": ID })["@id"], ID);
	});
});

describe("field records", () => {
	it("Thing fields are present on every node", () => {
		const thingKeys = Object.keys(ThingFields);

		for (const schema of [SoftwareSourceCode, TechArticle, APIReference, Person, Organization, CreativeWork]) {
			for (const key of thingKeys) {
				assert.property(schema.fields, key, `every node must carry the Thing field ${key}`);
			}
		}
	});

	it("CreativeWork fields reach every CreativeWork descendant and no further", () => {
		const creativeOnly = Object.keys(CreativeWorkFields).filter((key) => !(key in ThingFields));
		assert.isAbove(creativeOnly.length, 0, "positive control: there must be CreativeWork-only fields to test");

		for (const schema of [CreativeWork, SoftwareSourceCode, TechArticle, APIReference]) {
			for (const key of creativeOnly) assert.property(schema.fields, key);
		}

		// Person and Organization are not CreativeWorks. `license` and
		// `datePublished` are not domainIncludes-legal on them, and the shape of
		// the classes has to say so.
		for (const schema of [Person, Organization]) {
			for (const key of creativeOnly) {
				assert.notProperty(schema.fields, key, `${key} is not legal on a non-CreativeWork node`);
			}
		}
	});

	it("APIReference carries the TechArticle fields, because the vocabulary says it is one", () => {
		for (const key of Object.keys(TechArticleFields)) {
			assert.property(APIReference.fields, key);
		}
		assert.property(APIReference.fields, "assemblyVersion", "plus its own");
	});

	it("no node class inherits from another", () => {
		// Schema inheritance would duplicate the vocabulary's subClassOf chain
		// in TypeScript, giving two sources of truth that drift.
		assert.notInstanceOf(APIReference.make({ "@id": ID }), TechArticle);
		assert.notInstanceOf(TechArticle.make({ "@id": ID }), CreativeWork);
		assert.notInstanceOf(SoftwareSourceCode.make({ "@id": ID }), CreativeWork);
	});
});

describe("arity is fixed per property", () => {
	it("models the properties the design's arity table calls repeatable as arrays", () => {
		const node = SoftwareSourceCode.make({
			"@id": ID,
			license: ["https://spdx.org/licenses/MIT", "https://spdx.org/licenses/Apache-2.0"],
			author: [NodeRef.to("https://example.com/#a"), NodeRef.to("https://example.com/#b")],
			publisher: [NodeRef.to("https://example.com/#org")],
			isPartOf: [NodeRef.to("https://example.com/#parent")],
			keywords: ["a", "b"],
			programmingLanguage: ["TypeScript", "JavaScript"],
		});

		assert.lengthOf(node.license ?? [], 2, "a dual license must survive: this is the spdx `licensesOf` case");
		assert.lengthOf(node.author ?? [], 2);
		assert.lengthOf(node.publisher ?? [], 1, "publisher is many — widening later would be a breaking change");
	});

	it("keeps mainEntity singular, because schema.org defines it that way", () => {
		const node = TechArticle.make({ "@id": ID, mainEntity: NodeRef.to("https://example.com/#api") });

		assert.instanceOf(node.mainEntity, NodeRef, "not an array: this collapse belongs to the vocabulary");
	});
});

describe("NodeRef", () => {
	it("builds from a node you are already holding", () => {
		const person = Person.make({ "@id": "https://example.com/#alice", name: "Alice" });

		assert.strictEqual(NodeRef.to(person)["@id"], "https://example.com/#alice");
	});

	it("builds from a bare identifier, totally", () => {
		assert.strictEqual(NodeRef.to("_:blank")["@id"], "_:blank");
	});

	it("never throws, even on an identifier the graph will later reject", () => {
		// Totality is the point: identity failures belong to JsonLdDocument.buildResult,
		// where they arrive typed, not to an arbitrary call site as a throw.
		assert.strictEqual(NodeRef.to("not valid")["@id"], "not valid");
		assertFailure(Result.mapError(JsonLdDocument.buildResult([TechArticle.make({ "@id": ID, about: [NodeRef.to("not valid")] })]), () => undefined), undefined);
	});

	it("toCheckedResult is the sync primitive and rejects a malformed id", () => {
		assertSuccess(Result.map(NodeRef.toCheckedResult("https://example.com/#a"), () => undefined), undefined);
		assertFailure(Result.mapError(NodeRef.toCheckedResult("has space"), () => undefined), undefined);
		assertFailure(Result.mapError(NodeRef.toCheckedResult(""), () => undefined), undefined);
	});

	it("encodes to the {'@id'} form and nothing else", () => {
		assert.deepStrictEqual(Result.getOrThrow(S.encodeResult(NodeRef)(NodeRef.to("x"))), { "@id": "x" });
	});

	it("rejects C1 control characters, not only the C0 block", () => {
		// The rule is written `\p{Cc}` rather than an explicit
		// `\u0000-\u001F\u007F` range. That is not a re-spelling: the explicit
		// range admitted the C1 block, so `U+0085` and `U+0090` passed as legal
		// node ids and would have reached an emitted document.
		for (const id of ["nel\u0085here", "c1\u0090here", "\u009Fleading"]) {
			assert.isFalse(NodeRef.isValidId(id), JSON.stringify(id));
		}
		// C0 and DEL were already rejected and must stay rejected.
		for (const id of ["bell\u0007here", "del\u007Fhere"]) {
			assert.isFalse(NodeRef.isValidId(id), JSON.stringify(id));
		}
		// A legitimate id with astral characters is unaffected by the widening.
		assert.isTrue(NodeRef.isValidId("https://example.com/#\u{1F642}"));
	});

	it("isValidId agrees with the NodeId schema, so the two cannot drift", () => {
		// The predicate and the schema check are a lexically paired surface: if
		// one is relaxed and the other is not, this fails.
		for (const id of [
			"https://example.com/#a",
			"_:b",
			"#c",
			"",
			"has space",
			"tab\there",
			"nel\u0085here",
			"c1\u0090here",
		]) {
			const schemaAccepts = Result.isSuccess(S.decodeResult(NodeId)(id));
			assert.strictEqual(
				NodeRef.isValidId(id),
				schemaAccepts,
				`predicate and schema must agree on ${JSON.stringify(id)}`,
			);
		}
	});
});
