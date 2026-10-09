import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { indentationOptions } from "../../../../effected/yaml/internal/rules/indentation.ts";

const runs = { arbitrary: fcRuns(100) };

describe("indentation schema properties", () => {
  it.effect.prop(
    "indentationOptions: encoding decodes successfully to the original value",
    [Arbitrary.schema(indentationOptions)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(indentationOptions)(value);
      const decoded = yield* S.decodeEffect(indentationOptions)(encoded);
      assert.isTrue(S.toEquivalence(indentationOptions)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(indentationOptions)(decoded), encoded);
    }),
    runs,
  );
});
