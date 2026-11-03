import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  APIReference,
  ConflictingTermError,
  CreativeWork,
  CreativeWorkFields,
  DuplicateNodeIdError,
  InvalidNodeIdError,
  JsonLdDocument,
  JsonLdNode,
  NodeId,
  NodeRef,
  Organization,
  Person,
  SoftwareSourceCode,
  TechArticle,
  TechArticleFields,
  ThingFields,
} from "@beep/schema-org";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name} through index: encoded values decode successfully and preserve their value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("graph entrypoint property floor", () => {
  roundTrips("APIReference", APIReference);
  roundTrips("ConflictingTermError", ConflictingTermError);
  roundTrips("CreativeWork", CreativeWork);
  roundTrips("CreativeWorkFields", S.Struct(CreativeWorkFields));
  roundTrips("DuplicateNodeIdError", DuplicateNodeIdError);
  roundTrips("InvalidNodeIdError", InvalidNodeIdError);
  roundTrips("JsonLdDocument", JsonLdDocument);
  roundTrips("JsonLdNode", JsonLdNode);
  roundTrips("NodeId", NodeId);
  roundTrips("NodeRef", NodeRef);
  roundTrips("Organization", Organization);
  roundTrips("Person", Person);
  roundTrips("SoftwareSourceCode", SoftwareSourceCode);
  roundTrips("TechArticle", TechArticle);
  roundTrips("TechArticleFields", S.Struct(TechArticleFields));
  roundTrips("ThingFields", S.Struct(ThingFields));
});

it.effect.prop(
  "entrypoint serialization preserves wire JSON, parses faithfully and escapes idempotently",
  [Arbitrary.schema(JsonLdDocument)],
  ([document]) =>
    Effect.gen(function* () {
      const json = S.fromJsonString(S.Json);
      const body = document.toScriptBody();
      const parsed = yield* S.decodeEffect(json)(body);
      assertTrue(S.toEquivalence(S.Json)(parsed, document.toJsonLd()));
      const argument = S.decodeEffect(json);
      const value3 = yield* S.encodeEffect(json)(parsed);
      const value2 = yield* argument(value3);
      assert.deepStrictEqual(value2, parsed);
      const argument1 = S.decodeEffect(JsonLdDocument);
      const value4 = yield* S.encodeEffect(JsonLdDocument)(document);
      const restored = yield* argument1(value4);
      assert.strictEqual(restored.toScriptBody(), body);
      const escape = flow(
        Str.replaceAll("<", "\\u003c"),
        Str.replaceAll(">", "\\u003e"),
        Str.replaceAll("&", "\\u0026")
      );
      assert.strictEqual(escape(body), body);
      assert.strictEqual(escape(escape(body)), escape(body));
      assert.strictEqual(/[<>&]/.test(body), false);
    }),
  runs
);
