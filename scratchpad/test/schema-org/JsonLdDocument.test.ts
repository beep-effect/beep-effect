import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { APIReference } from "../../effected/schema-org/APIReference.ts";
import { ConflictingTermError, DuplicateNodeIdError, JsonLdDocument } from "../../effected/schema-org/JsonLdDocument.ts";
import { InvalidNodeIdError, NodeRef } from "../../effected/schema-org/NodeRef.ts";
import { Organization } from "../../effected/schema-org/Organization.ts";
import { Person } from "../../effected/schema-org/Person.ts";
import { SoftwareSourceCode } from "../../effected/schema-org/SoftwareSourceCode.ts";
import { TechArticle } from "../../effected/schema-org/TechArticle.ts";

const PKG = "https://example.com/pkg#source";
const DOC = "https://example.com/docs#intro";
const API = "https://example.com/api#v2";
const ALICE = "https://example.com/#alice";

const WireDocument = S.Struct({
	"@context": S.String,
	"@graph": S.Array(S.JsonObject),
});

describe("JsonLdDocument.buildResult — identity", () => {
	it("assembles the consumer's canonical three-node graph", () => {
		const built = JsonLdDocument.buildResult([
			SoftwareSourceCode.make({
				"@id": PKG,
				name: "example",
				version: "1.2.3",
				codeRepository: "https://github.com/example/example",
				license: ["https://spdx.org/licenses/MIT"],
				programmingLanguage: ["TypeScript"],
				author: [NodeRef.to(ALICE)],
			}),
			TechArticle.make({
				"@id": DOC,
				headline: "Getting started",
				isPartOf: [NodeRef.to(PKG)],
				mainEntity: NodeRef.to(API),
				inLanguage: "en",
			}),
			APIReference.make({ "@id": API, name: "example API", assemblyVersion: "2.0.0" }),
			Person.make({ "@id": ALICE, name: "Alice" }),
		]);

		assert.isTrue(Result.isSuccess(built), "a well-formed graph must build");
		const graph = Result.getOrThrow(built);
		assert.strictEqual(graph["@graph"].length, 4);
		assert.deepStrictEqual(graph.danglingReferences, [], "every reference resolves within the graph");
	});

	it("rejects two nodes claiming one @id", () => {
		const built = JsonLdDocument.buildResult([
			Person.make({ "@id": ALICE, name: "Alice" }),
			Organization.make({ "@id": ALICE, name: "Also Alice" }),
		]);

		assert.isTrue(Result.isFailure(built));
		const error = Result.getFailure(built).pipe((option) => (option._tag === "Some" ? option.value : undefined));
		assert.instanceOf(error, DuplicateNodeIdError);
		if (!S.is(DuplicateNodeIdError)(error)) assert.fail("expected DuplicateNodeIdError");
		assert.strictEqual(error.id, ALICE);
	});

	it("rejects a catch-all key that collides with a typed field", () => {
		// `about` is a typed field on every CreativeWork descendant, so setting
		// it through the catch-all would emit the term twice.
		const built = JsonLdDocument.buildResult([
			SoftwareSourceCode.make({ "@id": PKG, additional: { about: "collides" } }),
		]);

		assert.isTrue(Result.isFailure(built));
		const error = Result.getFailure(built).pipe((option) => (option._tag === "Some" ? option.value : undefined));
		assert.instanceOf(error, ConflictingTermError);
		if (!S.is(ConflictingTermError)(error)) assert.fail("expected ConflictingTermError");
		assert.strictEqual(error.term, "about");
	});

	it("rejects a catch-all key colliding with @id or @type", () => {
		for (const term of ["@id", "@type"]) {
			const built = JsonLdDocument.buildResult([Person.make({ "@id": ALICE, additional: { [term]: "x" } })]);
			assert.isTrue(Result.isFailure(built), `${term} must not be settable through the catch-all`);
		}
	});

	it("accepts a catch-all key the package does not model", () => {
		const built = JsonLdDocument.buildResult([
			SoftwareSourceCode.make({ "@id": PKG, additional: { alternateName: "ex", codeSampleType: "full" } }),
		]);

		assert.isTrue(Result.isSuccess(built), "the catch-all is the point; unmodelled terms must pass");
	});

	it("rejects a malformed @id on a node, typed rather than thrown", () => {
		for (const id of ["", "has space", "tab\there", "null\u0000byte"]) {
			const built = JsonLdDocument.buildResult([Person.make({ "@id": id })]);
			assert.isTrue(Result.isFailure(built), `${JSON.stringify(id)} must not be usable as an @id`);
			const error = Result.getFailure(built).pipe((option) => (option._tag === "Some" ? option.value : undefined));
			assert.instanceOf(error, InvalidNodeIdError, "identity failures arrive on the error channel, never as a defect");
		}
	});

	it("rejects a malformed @id on a reference too", () => {
		const built = JsonLdDocument.buildResult([
			TechArticle.make({ "@id": DOC, isPartOf: [NodeRef.to("not a valid id")] }),
		]);

		assert.isTrue(Result.isFailure(built), "a reference id is held to the same rule as a node id");
	});

	it("accepts the identifier forms JSON-LD actually allows", () => {
		for (const id of ["https://example.com/#a", "_:blank", "#fragment", "relative/path"]) {
			const built = JsonLdDocument.buildResult([Person.make({ "@id": id })]);
			assert.isTrue(Result.isSuccess(built), `${JSON.stringify(id)} is legal JSON-LD and must be accepted`);
		}
	});
});

describe("JsonLdDocument — dangling references", () => {
	it("does not fail on a reference outside the graph", () => {
		const built = JsonLdDocument.buildResult([
			TechArticle.make({ "@id": DOC, publisher: [NodeRef.to("https://elsewhere.example/#org")] }),
		]);

		assert.isTrue(Result.isSuccess(built), "pointing at a node described on another page is legal and common");
	});

	it("reports the dangling ids so a closed-world consumer can gate", () => {
		const graph = Result.getOrThrow(
			JsonLdDocument.buildResult([
				TechArticle.make({
					"@id": DOC,
					isPartOf: [NodeRef.to(PKG)],
					publisher: [NodeRef.to("https://elsewhere.example/#org")],
					mainEntity: NodeRef.to("https://elsewhere.example/#api"),
				}),
			]),
		);

		assert.deepStrictEqual(
			[...graph.danglingReferences].sort(),
			[PKG, "https://elsewhere.example/#api", "https://elsewhere.example/#org"].sort(),
			"every unresolved reference is reported, from array and scalar fields alike",
		);
	});

	it("deduplicates repeated dangling references", () => {
		const graph = Result.getOrThrow(
			JsonLdDocument.buildResult([
				TechArticle.make({ "@id": DOC, author: [NodeRef.to(ALICE), NodeRef.to(ALICE)] }),
				APIReference.make({ "@id": API, author: [NodeRef.to(ALICE)] }),
			]),
		);

		assert.deepStrictEqual(graph.danglingReferences, [ALICE]);
	});
});

describe("JsonLdDocument.build — the Effect twin", () => {
	it.effect("succeeds where buildResult succeeds", () =>
		Effect.gen(function* () {
			const graph = yield* JsonLdDocument.build([Person.make({ "@id": ALICE, name: "Alice" })]);

			assert.strictEqual(graph["@graph"].length, 1);
		}),
	);

	it.effect("fails with the same typed error buildResult returns", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(JsonLdDocument.build([Person.make({ "@id": "bad id" })]));

			assert.instanceOf(error, InvalidNodeIdError);
		}),
	);
});

describe("JsonLdDocument.toJsonLd — the wire form", () => {
	it("fixes @context and leads each node with @id and @type", () => {
		const graph = Result.getOrThrow(JsonLdDocument.buildResult([Person.make({ "@id": ALICE, name: "Alice" })]));

		const wire = graph.toJsonLd();
		if (!S.is(WireDocument)(wire)) assert.fail("expected a JSON-LD wire document");

		assert.strictEqual(wire["@context"], "https://schema.org");
		assert.deepStrictEqual(Object.keys(wire["@graph"][0] ?? {}), ["@id", "@type", "name"]);
	});

	it("flattens the catch-all into the node, as JSON-LD requires", () => {
		const graph = Result.getOrThrow(
			JsonLdDocument.buildResult([SoftwareSourceCode.make({ "@id": PKG, additional: { alternateName: "ex" } })]),
		);

		const wire = graph.toJsonLd();
		if (!S.is(WireDocument)(wire)) assert.fail("expected a JSON-LD wire document");
		const node = wire["@graph"][0];

		assert.strictEqual(node?.alternateName, "ex", "a catch-all term must be a sibling term, not a nested object");
		assert.notProperty(node, "additional", "`additional` is this package's word, not a schema.org term");
	});

	it("drops undefined-valued keys rather than emitting them", () => {
		const graph = Result.getOrThrow(
			JsonLdDocument.buildResult([Person.make({ "@id": ALICE, name: "Alice", email: undefined, url: undefined })]),
		);

		const wire = graph.toJsonLd();
		if (!S.is(WireDocument)(wire)) assert.fail("expected a JSON-LD wire document");
		const node = wire["@graph"][0];

		assert.deepStrictEqual(
			Object.keys(node ?? {}),
			["@id", "@type", "name"],
			"a set field survives; the two passed as explicit undefined do not — JSON-LD has no undefined",
		);
	});

	it("emits a repeatable property as an array even at length one", () => {
		const graph = Result.getOrThrow(
			JsonLdDocument.buildResult([
				SoftwareSourceCode.make({
					"@id": PKG,
					license: ["https://spdx.org/licenses/MIT"],
					author: [NodeRef.to(ALICE)],
				}),
			]),
		);

		const wire = graph.toJsonLd();
		if (!S.is(WireDocument)(wire)) assert.fail("expected a JSON-LD wire document");
		const node = wire["@graph"][0];

		assert.deepStrictEqual(
			node?.license,
			["https://spdx.org/licenses/MIT"],
			"one arity per property, always the wire shape",
		);
		assert.deepStrictEqual(node?.author, [{ "@id": ALICE }], "a reference encodes to the {'@id'} form");
	});

	it("emits a single-valued property as a scalar", () => {
		const graph = Result.getOrThrow(
			JsonLdDocument.buildResult([TechArticle.make({ "@id": DOC, mainEntity: NodeRef.to(API), headline: "H" })]),
		);

		const wire = graph.toJsonLd();
		if (!S.is(WireDocument)(wire)) assert.fail("expected a JSON-LD wire document");
		const node = wire["@graph"][0];

		assert.deepStrictEqual(node?.mainEntity, { "@id": API }, "mainEntity is singular by schema.org's own definition");
		assert.strictEqual(node?.headline, "H");
	});
});

describe("JsonLdDocument — the decode direction is unimplemented, and the asymmetry is pinned", () => {
	/**
	 * This is the test the design doc promises. It exists because the round trip
	 * does not merely fail — it **half-works**, which is worse: decoding the wire
	 * form succeeds and silently discards the catch-all, because a flattened term
	 * is an excess key to the schema. A reader who assumed `decode(encode(g))`
	 * round-trips would lose data with no error.
	 */
	it("decoding the wire form silently loses the catch-all", () => {
		const graph = Result.getOrThrow(
			JsonLdDocument.buildResult([SoftwareSourceCode.make({ "@id": PKG, additional: { alternateName: "ex" } })]),
		);

		const decoded = S.decodeUnknownResult(JsonLdDocument)(graph.toJsonLd());

		assert.isTrue(Result.isSuccess(decoded), "it succeeds — which is precisely the hazard");
		const node = Result.getOrThrow(decoded)["@graph"][0];
		assert.isUndefined(
			node?.additional,
			"the catch-all is gone: this is why the decode direction is declared unimplemented",
		);
	});

	it("the structural form does round-trip, which is what makes the wire form's loss a choice", () => {
		const graph = Result.getOrThrow(
			JsonLdDocument.buildResult([SoftwareSourceCode.make({ "@id": PKG, additional: { alternateName: "ex" } })]),
		);

		const decoded = S.encodeResult(JsonLdDocument)(graph).pipe(Result.getOrThrow, S.decodeResult(JsonLdDocument));

		assert.isTrue(Result.isSuccess(decoded));
		assert.deepStrictEqual(
			Result.getOrThrow(decoded)["@graph"][0]?.additional,
			{ alternateName: "ex" },
			"the structural encoding keeps the catch-all nested, so it survives",
		);
	});

	it("toJsonLd and the schema's own encode are deliberately different values", () => {
		const graph = Result.getOrThrow(
			JsonLdDocument.buildResult([SoftwareSourceCode.make({ "@id": PKG, additional: { alternateName: "ex" } })]),
		);

		assert.notDeepEqual<unknown>(
			graph.toJsonLd(),
			Result.getOrThrow(S.encodeResult(JsonLdDocument)(graph)),
			"the wire form flattens; the structural form nests",
		);
	});
});
