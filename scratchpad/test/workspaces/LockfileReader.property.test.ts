import { assert, describe, it } from "@effect/vitest";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LockfileReadError, LockfileReaderOptions } from "../../effected/workspaces/LockfileReader.ts";

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

describe("LockfileReader property floor", () => {
  roundTrips("LockfileReadError", LockfileReadError);
  roundTrips("LockfileReaderOptions", LockfileReaderOptions);
});

it.effect.prop("read-error rendering remains stable across codec round trips", [Arbitrary.schema(LockfileReadError)],
  ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(LockfileReadError)(value);
    const decoded = yield* S.decodeEffect(LockfileReadError)(encoded);
    assert.strictEqual(decoded.message, value.message);
    assert.strictEqual(decoded.message, `Cannot read ${value.format} lockfile at ${value.lockfilePath}`);
  }), runs);
