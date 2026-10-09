import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CreativeWork } from "../../effected/schema-org/CreativeWork.ts";
import { ConflictingTermError, DuplicateNodeIdError, JsonLdDocument } from "../../effected/schema-org/JsonLdDocument.ts";

it.effect("graph errors identify duplicate nodes and conflicting catch-all terms", () => Effect.sync(() => {
  assert.strictEqual(DuplicateNodeIdError.make({ id: "_:work" }).message, 'Two nodes claim the same @id: "_:work"');
  assert.strictEqual(ConflictingTermError.make({ nodeId: "_:work", term: "name" }).message,
    'Node "_:work" sets "name" in both a typed field and `additional`');
}));

it.effect("script text escapes all hazards without changing parsed string content", () => Effect.gen(function* () {
  const graph = yield* JsonLdDocument.build([CreativeWork.make({ "@id": "_:work", name: "</script><!-- & >\u2028\u2029" })]);
  assert.match(graph.toScriptBody(), /\\u003c\/script\\u003e/);
  assert.strictEqual(/[<>&]/.test(graph.toScriptBody()), false);
  assert.deepStrictEqual(yield* S.decodeEffect(S.fromJsonString(S.Json))(graph.toScriptBody()), graph.toJsonLd());
}));
