import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  CachingPackageManager,
  DefaultCacheDirectoryOptions,
  PackageManagerCache,
} from "@beep/npm-spec/PackageManagerCache";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves it`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(equivalent(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("PackageManagerCache property floor", () => {
  roundTrips("CachingPackageManager", CachingPackageManager);
  roundTrips("DefaultCacheDirectoryOptions", DefaultCacheDirectoryOptions);
  roundTrips("PackageManagerCache.Manager", PackageManagerCache.Manager);
});
