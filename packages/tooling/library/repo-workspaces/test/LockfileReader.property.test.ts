import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { LockfileReadError, LockfileReaderOptions } from "@beep/repo-workspaces/LockfileReader";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding encoded values succeeds and preserves their value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(equivalent(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("LockfileReader property floor", () => {
  roundTrips("LockfileReadError", LockfileReadError);
  roundTrips("LockfileReaderOptions", LockfileReaderOptions);
});

it.effect.prop(
  "read-error rendering remains stable across codec round trips",
  [Arbitrary.schema(LockfileReadError)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(LockfileReadError)(value);
      const decoded = yield* S.decodeEffect(LockfileReadError)(encoded);
      assert.strictEqual(decoded.message, value.message);
      assert.strictEqual(decoded.message, `Cannot read ${value.format} lockfile at ${value.lockfilePath}`);
    }),
  runs
);
