import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Sbom, SbomInput, SbomJsonOptions, SbomWriteError } from "@beep/sbom/Sbom";
import { documentJson, SbomDocument } from "@beep/sbom/SbomDocument";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves the value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encode(value);
        const decoded = yield* decode(encoded);
        assertTrue(equivalent(decoded, value));
        const encoded1 = yield* encode(decoded);
        assert.deepStrictEqual(encoded1, encoded);
      }),
    runs
  );
};

describe("Sbom property floor", () => {
  roundTrips("SbomInput", SbomInput);
  roundTrips("SbomJsonOptions", SbomJsonOptions);
  roundTrips("SbomWriteError", SbomWriteError);
});

it.effect.prop(
  "SBOM JSON is faithful to the CycloneDX projection and formatting is idempotent",
  [Arbitrary.schema(SbomDocument)],
  ([document]) =>
    Effect.gen(function* () {
      const bytes = Sbom.toJson(document);
      const json = S.fromJsonString(S.Json, { space: 2 });
      const parsed = yield* S.decodeEffect(json)(bytes);
      const projection = yield* S.decodeUnknownEffect(S.Json)(documentJson(document));
      assertTrue(S.toEquivalence(S.Json)(parsed, projection));
      const formatted = yield* S.encodeEffect(json)(parsed);
      assert.strictEqual(formatted, bytes);
      const reparsed = yield* S.decodeEffect(json)(formatted);
      assert.deepStrictEqual(reparsed, parsed);
      const value2 = yield* S.encodeEffect(json)(reparsed);
      assert.strictEqual(value2, formatted);
    }),
  runs
);

it.effect.prop(
  "the README stable-byte guarantee holds across repeated generation",
  [Arbitrary.schema(SbomInput)],
  ([input]) =>
    Effect.gen(function* () {
      const document = Sbom.generate(input);
      assert.strictEqual(Sbom.toJson(Sbom.generate(input)), Sbom.toJson(document));
      // Single admission copies (W4-g): the root is the caller's value by
      // structure, never by reference.
      assert.deepStrictEqual(document.metadata?.component, input.root);
      assert.notStrictEqual(document.metadata?.component, input.root);
    }),
  runs
);
