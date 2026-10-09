import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { quotedStringsOptions } from "../../../../effected/yaml/internal/rules/quoted-strings.ts";

const runs = { arbitrary: fcRuns(100) };

describe("quoted-strings schema properties", () => {
  it.effect.prop(
    "quotedStringsOptions: encoding decodes successfully to the original value",
    [Arbitrary.schema(quotedStringsOptions)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(quotedStringsOptions)(value);
      const decoded = yield* S.decodeEffect(quotedStringsOptions)(encoded);
      assert.isTrue(S.toEquivalence(quotedStringsOptions)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(quotedStringsOptions)(decoded), encoded);
    }),
    runs,
  );
});
