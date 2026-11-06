import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { hyphenSpacingOptions } from "@beep/yaml/internal/rules/hyphen-spacing";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

describe("hyphen-spacing schema properties", () => {
  it.effect.prop(
    "hyphenSpacingOptions: encoding decodes successfully to the original value",
    [Arbitrary.schema(hyphenSpacingOptions)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(hyphenSpacingOptions)(value);
        const decoded = yield* S.decodeEffect(hyphenSpacingOptions)(encoded);
        assert.isTrue(S.toEquivalence(hyphenSpacingOptions)(decoded, value));
        const value1 = yield* S.encodeEffect(hyphenSpacingOptions)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
});
