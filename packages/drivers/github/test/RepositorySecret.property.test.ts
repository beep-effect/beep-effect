import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { SecretInfo } from "@beep/github/RepositorySecret";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

describe("RepositorySecret schema property floor", () => {
  it.effect.prop(
    "SecretInfo decodes every encoded name without losing its value",
    [Arbitrary.schema(SecretInfo)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(SecretInfo)(value);
        const decoded = yield* S.decodeEffect(SecretInfo)(encoded);
        assert.isTrue(S.toEquivalence(SecretInfo)(decoded, value));
        const value1 = yield* S.encodeEffect(SecretInfo)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
});
