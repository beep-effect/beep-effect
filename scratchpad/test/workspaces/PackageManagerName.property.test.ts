import { assert, describe, it } from "@effect/vitest";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PackageManagerName, PackageManagerEvidence, DetectedPackageManager, JsonObject, PackageManagerDetectionError } from "../../effected/workspaces/PackageManagerName.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding encoded values succeeds and preserves their value`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }),
    runs,
  );
};

describe("PackageManagerName property floor", () => {
  roundTrips("PackageManagerName", PackageManagerName);
  roundTrips("PackageManagerEvidence", PackageManagerEvidence);
  roundTrips("DetectedPackageManager", DetectedPackageManager);
  roundTrips("JsonObject", JsonObject);
  roundTrips("PackageManagerDetectionError", PackageManagerDetectionError);
});

it.effect.prop("detection-error rendering preserves root and marker order through the codec", [Arbitrary.schema(PackageManagerDetectionError)],
  ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(PackageManagerDetectionError)(value);
    const decoded = yield* S.decodeEffect(PackageManagerDetectionError)(encoded);
    assert.strictEqual(decoded.message, value.message);
    assert.strictEqual(decoded.message, `No package manager detected at ${value.root} (checked ${value.checked.join(", ")})`);
  }), runs);
