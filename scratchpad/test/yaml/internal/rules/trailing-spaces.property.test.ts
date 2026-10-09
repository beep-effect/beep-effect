import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { trailingSpacesOptions } from "../../../../effected/yaml/internal/rules/trailing-spaces.ts";

const runs = { arbitrary: fcRuns(100) };

describe("trailing-spaces schema properties", () => {
  it.effect.prop(
    "trailingSpacesOptions: encoding decodes successfully to the original value",
    [Arbitrary.schema(trailingSpacesOptions)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(trailingSpacesOptions)(value);
      const decoded = yield* S.decodeEffect(trailingSpacesOptions)(encoded);
      assert.isTrue(S.toEquivalence(trailingSpacesOptions)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(trailingSpacesOptions)(decoded), encoded);
    }),
    runs,
  );
});
