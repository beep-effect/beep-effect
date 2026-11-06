import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CommitRef, FileChange, FileContent, FileDeletion, FileMode } from "@beep/github/GitCommit";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decode(encode(x)) preserves the value and never fails`,
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

describe("GitCommit schema property floor", () => {
  roundTrips("FileMode", FileMode);
  roundTrips("FileContent", FileContent);
  roundTrips("FileDeletion", FileDeletion);
  roundTrips("FileChange", FileChange);
  roundTrips("CommitRef", CommitRef);
});
