import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import * as Sbom from "@beep/sbom";
import { SbomDocument } from "@beep/sbom";
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

describe("index property floor", () => {
  roundTrips("SbomDocument through the barrel", SbomDocument);
  // W3-f: the barrel no longer re-exports the manifest models; consumers import
  // them from @beep/package-json directly.
  it.effect("does not re-export the manifest models", () =>
    Effect.sync(() => {
      for (const name of ["Package", "Person", "Repository"]) {
        assert.notProperty(Sbom, name);
      }
    })
  );
});
