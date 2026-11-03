import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { truthyOptions } from "@beep/yaml/internal/rules/truthy";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

describe("truthy schema properties", () => {
  it.effect.prop(
    "truthyOptions: encoding decodes successfully to the original value",
    [Arbitrary.schema(truthyOptions)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(truthyOptions)(value);
        const decoded = yield* S.decodeEffect(truthyOptions)(encoded);
        assert.isTrue(S.toEquivalence(truthyOptions)(decoded, value));
        const value1 = yield* S.encodeEffect(truthyOptions)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
});
