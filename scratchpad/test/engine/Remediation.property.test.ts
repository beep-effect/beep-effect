import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Remediation } from "../../effected/engine/Remediation.ts";

const runs = { arbitrary: fcRuns(100) };

describe("Remediation property floor", () => {
  it.effect.prop(
    "Remediation encoding decodes successfully to an equivalent value",
    [Arbitrary.schema(Remediation)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(Remediation)(value);
      const decoded = yield* S.decodeEffect(Remediation)(encoded);
      assert.strictEqual(S.toEquivalence(Remediation)(decoded, value), true);
    }),
    runs,
  );
});
