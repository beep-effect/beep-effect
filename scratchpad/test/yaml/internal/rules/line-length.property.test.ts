import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { lineLengthOptions } from "../../../../effected/yaml/internal/rules/line-length.ts";

const runs = { arbitrary: fcRuns(100) };

describe("line-length schema properties", () => {
  it.effect.prop(
    "lineLengthOptions: encoding decodes successfully to the original value",
    [Arbitrary.schema(lineLengthOptions)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(lineLengthOptions)(value);
      const decoded = yield* S.decodeEffect(lineLengthOptions)(encoded);
      assert.isTrue(S.toEquivalence(lineLengthOptions)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(lineLengthOptions)(decoded), encoded);
    }),
    runs,
  );
});
