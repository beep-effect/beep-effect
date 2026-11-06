import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  ConflictingTermError,
  DuplicateNodeIdError,
  JsonLdDocument,
  JsonLdNode,
} from "@beep/schema-org/JsonLdDocument";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves the value`,
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

describe("JsonLdDocument property floor", () => {
  roundTrips("DuplicateNodeIdError", DuplicateNodeIdError);
  roundTrips("ConflictingTermError", ConflictingTermError);
  roundTrips("JsonLdNode", JsonLdNode);
  roundTrips("JsonLdDocument", JsonLdDocument);
});

it.effect.prop(
  "script serialization preserves wire JSON and is stable after a schema round trip",
  [Arbitrary.schema(JsonLdDocument)],
  ([document]) =>
    Effect.gen(function* () {
      const body = document.toScriptBody();
      const jsonText = S.fromJsonString(S.Json);
      const parsed = yield* S.decodeEffect(jsonText)(body);
      assert.deepStrictEqual(parsed, document.toJsonLd());
      const argument = S.decodeEffect(jsonText);
      const value2 = yield* S.encodeEffect(jsonText)(parsed);
      const reparsed = yield* argument(value2);
      assert.deepStrictEqual(reparsed, parsed);
      const argument1 = S.decodeEffect(JsonLdDocument);
      const value3 = yield* S.encodeEffect(JsonLdDocument)(document);
      const restored = yield* argument1(value3);
      assert.strictEqual(restored.toScriptBody(), body);
      assert.strictEqual(/[<>&]/.test(body), false);
      // README composition guarantee: escaping the already escaped body is idempotent.
      assert.strictEqual(
        Str.replace(/&/g, "\\u0026")(Str.replace(/>/g, "\\u003e")(Str.replace(/</g, "\\u003c")(body))),
        body
      );
    }),
  runs
);
