import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { truthyOptions } from "../../../../effected/yaml/internal/rules/truthy.ts";

const runs = { arbitrary: fcRuns(100) };

describe("truthy schema properties", () => {
  it.effect.prop(
    "truthyOptions: encoding decodes successfully to the original value",
    [Arbitrary.schema(truthyOptions)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(truthyOptions)(value);
      const decoded = yield* S.decodeEffect(truthyOptions)(encoded);
      assert.isTrue(S.toEquivalence(truthyOptions)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(truthyOptions)(decoded), encoded);
    }),
    runs,
  );
});
