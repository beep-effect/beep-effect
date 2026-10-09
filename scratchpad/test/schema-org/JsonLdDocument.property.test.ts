import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { DuplicateNodeIdError, ConflictingTermError, JsonLdNode, JsonLdDocument } from "../../effected/schema-org/JsonLdDocument.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves the value`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }),
    runs,
  );
};

describe("JsonLdDocument property floor", () => {
  roundTrips("DuplicateNodeIdError", DuplicateNodeIdError);
  roundTrips("ConflictingTermError", ConflictingTermError);
  roundTrips("JsonLdNode", JsonLdNode);
  roundTrips("JsonLdDocument", JsonLdDocument);
});

it.effect.prop(
  "script serialization preserves wire JSON and is stable after a schema round trip",
  [Arbitrary.schema(JsonLdDocument)],
  ([document]) => Effect.gen(function* () {
    const body = document.toScriptBody();
    const jsonText = S.fromJsonString(S.Json);
    const parsed = yield* S.decodeEffect(jsonText)(body);
    assert.deepStrictEqual(parsed, document.toJsonLd());
    const reparsed = yield* S.decodeEffect(jsonText)(yield* S.encodeEffect(jsonText)(parsed));
    assert.deepStrictEqual(reparsed, parsed);
    const restored = yield* S.decodeEffect(JsonLdDocument)(yield* S.encodeEffect(JsonLdDocument)(document));
    assert.strictEqual(restored.toScriptBody(), body);
    assert.strictEqual(/[<>&]/.test(body), false);
    // README composition guarantee: escaping the already escaped body is idempotent.
    assert.strictEqual(body.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"), body);
  }),
  runs,
);
