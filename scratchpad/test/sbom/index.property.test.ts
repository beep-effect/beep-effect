import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SbomDocument, Package, Person, Repository } from "../../effected/sbom/index.ts";
import * as Manifest from "../../effected/package-json/index.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves the value`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* encode(decoded), encoded);
    }),
    runs,
  );
};

describe("index property floor", () => {
  roundTrips("SbomDocument through the barrel", SbomDocument);
  it.effect("reexports the manifest schemas by identity", () => Effect.sync(() => {
    assert.strictEqual(Package, Manifest.Package);
    assert.strictEqual(Person, Manifest.Person);
    assert.strictEqual(Repository, Manifest.Repository);
  }));
});
