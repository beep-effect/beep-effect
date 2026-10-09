import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { keyDuplicatesOptions } from "../../../../effected/yaml/internal/rules/key-duplicates.ts";

const runs = { arbitrary: fcRuns(100) };

describe("key-duplicates schema properties", () => {
  it.effect.prop(
    "keyDuplicatesOptions: encoding decodes successfully to the original value",
    [Arbitrary.schema(keyDuplicatesOptions)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(keyDuplicatesOptions)(value);
      const decoded = yield* S.decodeEffect(keyDuplicatesOptions)(encoded);
      assert.isTrue(S.toEquivalence(keyDuplicatesOptions)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(keyDuplicatesOptions)(decoded), encoded);
    }),
    runs,
  );
});
