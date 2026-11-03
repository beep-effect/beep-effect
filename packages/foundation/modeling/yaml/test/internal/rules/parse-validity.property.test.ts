import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { parseValidityOptions } from "@beep/yaml/internal/rules/parse-validity";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

describe("parse-validity schema properties", () => {
  it.effect.prop(
    "parseValidityOptions: encoding decodes successfully to the original value",
    [Arbitrary.schema(parseValidityOptions)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(parseValidityOptions)(value);
        const decoded = yield* S.decodeEffect(parseValidityOptions)(encoded);
        assert.isTrue(S.toEquivalence(parseValidityOptions)(decoded, value));
        const value1 = yield* S.encodeEffect(parseValidityOptions)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
});
