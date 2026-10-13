import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as ST from "effect/SchemaTransformation";

const runs = { arbitrary: fcRuns(100) };
const Json = S.fromJsonString(S.Unknown);

const roundTrips = <T, E>(name: string, codec: S.Codec<T, E>, schema: S.Codec<T, unknown> = codec): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(codec)(value);
    const decoded = yield* S.decodeEffect(codec)(encoded);
    assertTrue(S.toEquivalence(codec)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(codec)(decoded), encoded);
  }), runs);
};
import { PackageManifest } from "../../effected/package-json/PackageManifest.ts";
import { UnscopedPackageName } from "../../effected/package-json/PackageName.ts";
const Wire = S.Struct({ name: S.optionalKey(UnscopedPackageName), version: S.optionalKey(S.Literal("1.2.3")), private: S.optionalKey(S.Boolean), extra: S.Json, scripts: S.Record(S.String, S.String) });
const generation = { toCodecArbitrary: () => S.link<PackageManifest>()(Wire, ST.transformEffect<PackageManifest, typeof Wire.Type>({ decode: (wire) => S.decodeEffect(PackageManifest.schema)(wire).pipe(Effect.orDie), encode: () => Effect.die("generation-only representation") })) };
const codec = S.declare(S.is(PackageManifest), generation);
describe("manifest property floor", () => {
  roundTrips("PackageManifest class", PackageManifest, codec);
  roundTrips("PackageManifest.schema", PackageManifest.schema, codec);
  it.effect.prop("manifest text formatting is idempotent, parsed values and unknown fields survive", [Arbitrary.schema(codec)], ([value]) => Effect.gen(function* () {
    const text = value.toJsonString();
    const parsed = yield* S.decodeEffect(Json)(text);
    const decoded = yield* PackageManifest.decode(parsed);
    assert.strictEqual(decoded.toJsonString(), text);
    const expectedRest = yield* S.decodeEffect(Json)(yield* S.encodeEffect(Json)(value.rest));
    assert.deepStrictEqual(decoded.rest, expectedRest);
    assertTrue(S.toEquivalence(PackageManifest)(decoded, value));
  }), runs);
});
