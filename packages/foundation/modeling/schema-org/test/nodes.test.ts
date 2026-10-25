import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { APIReference } from "@beep/schema-org/APIReference";
import { CreativeWork, CreativeWorkFields } from "@beep/schema-org/CreativeWork";
import { JsonLdDocument } from "@beep/schema-org/JsonLdDocument";
import { NodeId, NodeRef } from "@beep/schema-org/NodeRef";
import { Organization } from "@beep/schema-org/Organization";
import { Person } from "@beep/schema-org/Person";
import { SoftwareSourceCode } from "@beep/schema-org/SoftwareSourceCode";
import { TechArticle, TechArticleFields } from "@beep/schema-org/TechArticle";
import { ThingFields } from "@beep/schema-org/Thing";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

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

  // Optional fields are exact keys (EF-40): absence is spelled by omitting the
  // key, so a present key holding undefined never decodes.
  it.effect.prop(
    "rejects an explicit undefined for any optional field",
    [Arbitrary.schema(TechArticle)],
    ([node]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(TechArticle)(node);
        for (const key of ["headline", "description", "datePublished", "author", "mainEntity", "additional"]) {
          const explicit = yield* S.decodeEffect(TechArticle)({ ...encoded, [key]: undefined }).pipe(Effect.exit);
          explicit.pipe(Exit.isFailure, assertTrue);
        }
      }),
    { arbitrary: fcRuns(25) }
  );

  it("requires @id and nothing else", () => {
    assert.strictEqual(Person.make({ "@id": ID })["@id"], ID);
  });
});

describe("field records", () => {
  it("Thing fields are present on every node", () => {
    const thingKeys = R.keys(ThingFields);

    for (const schema of [SoftwareSourceCode, TechArticle, APIReference, Person, Organization, CreativeWork]) {
      for (const key of thingKeys) {
        assert.property(schema.fields, key, `every node must carry the Thing field ${key}`);
      }
    }
  });

  it("CreativeWork fields reach every CreativeWork descendant and no further", () => {
    const creativeOnly = A.filter(R.keys(CreativeWorkFields), (key) => !(key in ThingFields));
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
    for (const key of R.keys(TechArticleFields)) {
      assert.property(APIReference.fields, key);
    }
    assert.property(APIReference.fields, "assemblyVersion", "plus its own");
  });

  it("no node class inherits from another", () => {
    // Schema inheritance would duplicate the vocabulary's subClassOf chain
    // in TypeScript, giving two sources of truth that drift.
    assert.isFalse(S.is(TechArticle)(APIReference.make({ "@id": ID })));
    assert.isFalse(S.is(CreativeWork)(TechArticle.make({ "@id": ID })));
    assert.isFalse(S.is(CreativeWork)(SoftwareSourceCode.make({ "@id": ID })));
    assert.notStrictEqual(Object.getPrototypeOf(APIReference), TechArticle);
    assert.notStrictEqual(Object.getPrototypeOf(TechArticle), CreativeWork);
    assert.notStrictEqual(Object.getPrototypeOf(SoftwareSourceCode), CreativeWork);
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

    assert.isFalse(A.isArray(node.mainEntity), "not an array: this collapse belongs to the vocabulary");
    assert.isTrue(S.is(NodeRef)(node.mainEntity), "a single node reference");
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
    assertFailure(
      Result.mapError(
        JsonLdDocument.buildResult([TechArticle.make({ "@id": ID, about: [NodeRef.to("not valid")] })]),
        () => undefined
      ),
      undefined
    );
  });

  it("toCheckedResult is the sync primitive and rejects a malformed id", () => {
    assertSuccess(
      Result.map(NodeRef.toCheckedResult("https://example.com/#a"), () => undefined),
      undefined
    );
    assertFailure(
      Result.mapError(NodeRef.toCheckedResult("has space"), () => undefined),
      undefined
    );
    assertFailure(
      Result.mapError(NodeRef.toCheckedResult(""), () => undefined),
      undefined
    );
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
        `predicate and schema must agree on ${JSON.stringify(id)}`
      );
    }
  });

  it.effect.prop(
    "isValidId agrees with the NodeId schema on arbitrary strings",
    [Arbitrary.schema(S.String)],
    ([id]) =>
      Effect.sync(() => {
        assert.strictEqual(NodeRef.isValidId(id), Result.isSuccess(S.decodeResult(NodeId)(id)));
      }),
    { arbitrary: fcRuns(100) }
  );
});
