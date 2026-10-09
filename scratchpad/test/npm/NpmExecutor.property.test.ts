import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { NpmExecutor } from "../../effected/npm/NpmExecutor.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: decoding an encoded value succeeds and preserves it`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("NpmExecutor property floor", () => {
  roundTrips("NpmExecutor", NpmExecutor);
});

it.effect.prop("cache and extra-argument replacements are idempotent and preserve other executor fields",
  [Arbitrary.schema(NpmExecutor), Arbitrary.schema(S.String), Arbitrary.schema(S.String.pipe(S.Array))],
  ([executor, cache, args]) => Effect.sync(() => {
    const redirected = executor.withCacheDir(cache);
    assert.strictEqual(redirected.spec, executor.spec);
    assert.deepStrictEqual(redirected.extraArgs, executor.extraArgs);
    assertTrue(S.toEquivalence(NpmExecutor)(redirected.withCacheDir(cache), redirected));
    const flagged = redirected.withExtraArgs(args);
    assert.strictEqual(flagged.cacheDir, cache);
    assert.strictEqual(flagged.spec, executor.spec);
    assert.deepStrictEqual(flagged.extraArgs, args);
    assertTrue(S.toEquivalence(NpmExecutor)(flagged.withExtraArgs(args), flagged));
  }), runs);
