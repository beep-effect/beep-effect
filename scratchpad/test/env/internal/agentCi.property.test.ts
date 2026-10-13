import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CiName, detectAgent, detectCi } from "../../../effected/env/internal/agentCi.ts";

const runs = { arbitrary: fcRuns(100) };

describe("internal/agentCi schema property floor", () => {
  it.effect.prop(
    "CiName: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(CiName)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CiName)(value);
      const decoded = yield* S.decodeEffect(CiName)(encoded);
      assert.isTrue(S.toEquivalence(CiName)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(CiName)(decoded), encoded);
    }),
    runs,
  );
});

const Environment = S.Record(S.String, S.String);
const json = S.fromJsonString(Environment);

describe("agent and CI detector fidelity", () => {
  it.effect.prop("JSON persistence preserves agent and CI identities", [Arbitrary.schema(Environment)], ([env]) =>
    Effect.gen(function* () {
      const restored = yield* S.decodeEffect(json)(yield* S.encodeEffect(json)(env));
      assert.deepStrictEqual(detectAgent(restored), detectAgent(env));
      assert.deepStrictEqual(detectCi(restored), detectCi(env));
      assert.deepStrictEqual(detectCi({ ...env, GITHUB_ACTIONS: "1", CI: "1" }), detectCi({ GITHUB_ACTIONS: "1" }));
    }), runs);
});
