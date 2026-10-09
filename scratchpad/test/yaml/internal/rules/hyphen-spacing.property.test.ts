import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { hyphenSpacingOptions } from "../../../../effected/yaml/internal/rules/hyphen-spacing.ts";

const runs = { arbitrary: fcRuns(100) };

describe("hyphen-spacing schema properties", () => {
  it.effect.prop(
    "hyphenSpacingOptions: encoding decodes successfully to the original value",
    [Arbitrary.schema(hyphenSpacingOptions)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(hyphenSpacingOptions)(value);
      const decoded = yield* S.decodeEffect(hyphenSpacingOptions)(encoded);
      assert.isTrue(S.toEquivalence(hyphenSpacingOptions)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(hyphenSpacingOptions)(decoded), encoded);
    }),
    runs,
  );
});
