import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CreativeWork } from "../../effected/schema-org/CreativeWork.ts";
import { ConflictingTermError, DuplicateNodeIdError, JsonLdDocument } from "../../effected/schema-org/JsonLdDocument.ts";

const JsonValue = S.fromJsonString(S.Json);

it.effect("wire values normalize negative zero exactly as script JSON does", () => Effect.gen(function* () {
  const graph = yield* JsonLdDocument.build([CreativeWork.make({
    "@id": "_:work",
    additional: { nested: { values: [-0, 0, -1] } },
  })]);
  const expected = {
    "@context": "https://schema.org",
    "@graph": [{ "@id": "_:work", "@type": "CreativeWork", nested: { values: [0, 0, -1] } }],
  };
  assert.deepStrictEqual(graph.toJsonLd(), expected);
  assert.deepStrictEqual(yield* S.decodeEffect(JsonValue)(graph.toScriptBody()), expected);
}));

it.effect("graph errors identify duplicate nodes and conflicting catch-all terms", () => Effect.sync(() => {
  assert.strictEqual(DuplicateNodeIdError.make({ id: "_:work" }).message, 'Two nodes claim the same @id: "_:work"');
  assert.strictEqual(ConflictingTermError.make({ nodeId: "_:work", term: "name" }).message,
    'Node "_:work" sets "name" in both a typed field and `additional`');
}));

it.effect("script text escapes all hazards without changing parsed string content", () => Effect.gen(function* () {
  const graph = yield* JsonLdDocument.build([CreativeWork.make({ "@id": "_:work", name: "</script><!-- & >\u2028\u2029" })]);
  assert.match(graph.toScriptBody(), /\\u003c\/script\\u003e/);
  assert.strictEqual(/[<>&]/.test(graph.toScriptBody()), false);
  assert.deepStrictEqual(yield* S.decodeEffect(JsonValue)(graph.toScriptBody()), graph.toJsonLd());
}));
