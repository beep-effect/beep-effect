import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { keyDuplicatesOptions } from "@beep/yaml/internal/rules/key-duplicates";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

describe("key-duplicates schema properties", () => {
  it.effect.prop(
    "keyDuplicatesOptions: encoding decodes successfully to the original value",
    [Arbitrary.schema(keyDuplicatesOptions)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(keyDuplicatesOptions)(value);
        const decoded = yield* S.decodeEffect(keyDuplicatesOptions)(encoded);
        assert.isTrue(S.toEquivalence(keyDuplicatesOptions)(decoded, value));
        const value1 = yield* S.encodeEffect(keyDuplicatesOptions)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
});
