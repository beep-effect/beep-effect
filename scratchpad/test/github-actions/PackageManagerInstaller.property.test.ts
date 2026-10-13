import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  AmbientPackageManager,
  CachedPackageManager,
  InstalledPackageManager,
  PackageManagerInstallerError,
} from "../../effected/github-actions/PackageManagerInstaller.ts";
const runs = { arbitrary: fcRuns(100) };
const roundTrip = <T, E>(schema: S.Codec<T, E>) => (value: T) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeEffect(schema)(encoded);
  assert.strictEqual(S.toEquivalence(schema)(decoded, value), true);
  assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
});
it.effect.prop("ambient manager survives its codec", [Arbitrary.schema(AmbientPackageManager)],
  ([value]) => roundTrip(AmbientPackageManager)(value), runs);
it.effect.prop("cached manager preserves its directory and bins", [Arbitrary.schema(CachedPackageManager)],
  ([value]) => roundTrip(CachedPackageManager)(value), runs);
it.effect.prop("installed manager preserves the discriminated variant", [Arbitrary.schema(InstalledPackageManager)],
  ([value]) => roundTrip(InstalledPackageManager)(value), runs);
it.effect.prop("installer error preserves its fields and diagnostic", [Arbitrary.schema(PackageManagerInstallerError)],
  ([value]) => Effect.gen(function* () {
    yield* roundTrip(PackageManagerInstallerError)(value);
    const encoded = yield* S.encodeEffect(PackageManagerInstallerError)(value);
    const decoded = yield* S.decodeEffect(PackageManagerInstallerError)(encoded);
    assert.strictEqual(decoded.message, value.message);
  }), runs);
