import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SecretInfo } from "../../effected/github/RepositorySecret.ts";

const runs = { arbitrary: fcRuns(100) };

describe("RepositorySecret schema property floor", () => {
  it.effect.prop("SecretInfo decodes every encoded name without losing its value", [Arbitrary.schema(SecretInfo)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(SecretInfo)(value);
      const decoded = yield* S.decodeEffect(SecretInfo)(encoded);
      assert.isTrue(S.toEquivalence(SecretInfo)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(SecretInfo)(decoded), encoded);
    }), runs);
});
