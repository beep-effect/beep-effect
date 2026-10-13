import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import * as O from "effect/Option";
import { InvalidPackageNameError, PackageName, ScopedPackageName, UnscopedPackageName } from "../../effected/package-json/PackageName.ts";
describe("package name property floor", () => {
  roundTrips("InvalidPackageNameError", InvalidPackageNameError);
  roundTrips("PackageName", PackageName);
  roundTrips("ScopedPackageName", ScopedPackageName);
  roundTrips("UnscopedPackageName", UnscopedPackageName);
  it.effect.prop("unscoping is idempotent and scoped decomposition is faithful", [Arbitrary.schema(ScopedPackageName)], ([name]) => Effect.sync(() => {
    const plain = PackageName.unscoped(name);
    assert.strictEqual(PackageName.unscoped(plain), plain);
    assert.strictEqual(`@${O.getOrThrow(PackageName.scope(name))}/${plain}`, name);
  }), runs);
});
