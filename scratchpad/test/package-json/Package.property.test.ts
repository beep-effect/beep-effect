import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const Json = S.fromJsonString(S.Unknown);
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, sample: S.Codec<T, unknown> = schema): void => {
  it.effect.prop(name, [Arbitrary.schema(sample)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import * as Getter from "effect/SchemaGetter";
import * as Result from "effect/Result";
import { DependencyMapField, StringMapField, BinField, ExportsField, PublishConfigField, PeerDependenciesMetaField, RepositoryField, PackageDecodeError, Package } from "../../effected/package-json/Package.ts";
const WireSample = S.Struct({
  name: S.String.check(S.isPattern(/^[a-z][a-z0-9-]{0,12}$/)),
  version: S.Literals(["1.0.0", "2.3.4", "0.0.1-beta.2"]),
  description: S.optionalKey(S.String),
  private: S.optionalKey(S.Boolean),
  dependencies: S.Record(S.String, S.String),
  devDependencies: S.Record(S.String, S.String),
  peerDependencies: S.Record(S.String, S.String),
  optionalDependencies: S.Record(S.String, S.String),
  scripts: S.Record(S.String, S.String),
  funding: S.optionalKey(S.Union([S.String, S.Struct({url: S.String, type: S.optionalKey(S.String)})])),
  "x-custom": S.Json,
});
const PackageSample = S.instanceOf(Package, {
  toCodecArbitrary: () => S.link<Package>()(WireSample, {
    decode: Getter.transform((wire) => Result.getOrThrow(S.decodeResult(Package.schema)(wire))),
    encode: Getter.transform((pkg) => pkg.pipe(S.encodeResult(Package.schema), Result.getOrThrow, S.decodeUnknownResult(WireSample), Result.getOrThrow)),
  }),
});
it.effect("serialization retains control-character and lone-surrogate dependency keys", () => Effect.gen(function* () {
  const pkg = yield* Package.decode({
    name: "a",
    version: "0.0.1-beta.2",
    peerDependencies: { "\t": "", "\ud890": "" },
    scripts: { j: "Na" },
    "x-custom": [{}, true],
  });
  const text = pkg.toJsonString();
  const parsed = yield* Package.decode(yield* S.decodeEffect(Json)(text));
  assert.strictEqual(parsed.toJsonString(), text, `before: ${text}\nafter: ${parsed.toJsonString()}`);
}));
describe("Package property floor", () => {
  roundTrips("DependencyMapField", DependencyMapField);
  roundTrips("StringMapField", StringMapField);
  roundTrips("BinField", BinField);
  roundTrips("ExportsField", ExportsField);
  roundTrips("PublishConfigField", PublishConfigField);
  roundTrips("PeerDependenciesMetaField", PeerDependenciesMetaField);
  roundTrips("RepositoryField", RepositoryField);
  roundTrips("PackageDecodeError", PackageDecodeError);
  roundTrips("Package", Package, PackageSample);
  roundTrips("Package.schema", Package.schema, PackageSample);
  roundTrips("Package.wireFor(Package)", Package.wireFor(Package), PackageSample);
});
it.effect.prop("serialization is idempotent and parse/stringify retains package data and unknown fields", [Arbitrary.schema(PackageSample)], ([pkg]) => Effect.gen(function* () {
  const text = pkg.toJsonString();
  const wire = yield* S.decodeEffect(Json)(text);
  const parsed = yield* Package.decode(wire);
  assert.strictEqual(parsed.toJsonString(), text, `before: ${text}\nafter: ${parsed.toJsonString()}`);
  assert.isTrue(S.toEquivalence(Package)(parsed, pkg));
  assert.isTrue(S.toEquivalence(S.Unknown)(yield* S.encodeEffect(Package.schema)(parsed), yield* S.encodeEffect(Package.schema)(pkg)));
}), runs);
