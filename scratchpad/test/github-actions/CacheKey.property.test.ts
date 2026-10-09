import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { InvalidDigestLengthError, CacheKeyReadError, CacheKeyBadPatternError, CacheKey } from "../../effected/github-actions/CacheKey.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves its value`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assert.isTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* encode(decoded), encoded);
    }),
    runs
  );
};
describe("CacheKey property floor", () => {
  roundTrips("InvalidDigestLengthError", InvalidDigestLengthError);
  roundTrips("CacheKeyReadError", CacheKeyReadError);
  roundTrips("CacheKeyBadPatternError", CacheKeyBadPatternError);
  roundTrips("CacheKey", CacheKey);
});

it.effect.prop(
  "key formatting is idempotent and codec fidelity includes the restore ladder",
  [Arbitrary.schema(CacheKey)],
  ([value]) => Effect.gen(function* () {
    const formatted = value.key;
    assert.strictEqual(CacheKey.of(formatted).key, formatted);
    const encoded = yield* S.encodeEffect(CacheKey)(value);
    const parsed = yield* S.decodeEffect(CacheKey)(encoded);
    const reparsed = yield* S.decodeEffect(CacheKey)(yield* S.encodeEffect(CacheKey)(parsed));
    assert.strictEqual(parsed.key, formatted);
    assert.deepStrictEqual(parsed.restoreKeys, value.restoreKeys);
    assert.strictEqual(reparsed.key, parsed.key);
    assert.deepStrictEqual(reparsed.restoreKeys, parsed.restoreKeys);
  }),
  runs
);
