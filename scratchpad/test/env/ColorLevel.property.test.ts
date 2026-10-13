import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ColorLevel } from "../../effected/env/ColorLevel.ts";

const runs = { arbitrary: fcRuns(100) };

describe("ColorLevel schema property floor", () => {
  it.effect.prop(
    "ColorLevel: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(ColorLevel)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ColorLevel)(value);
      const decoded = yield* S.decodeEffect(ColorLevel)(encoded);
      assert.isTrue(S.toEquivalence(ColorLevel)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(ColorLevel)(decoded), encoded);
    }),
    runs,
  );
});
