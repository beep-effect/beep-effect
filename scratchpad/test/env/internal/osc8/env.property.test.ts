import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { envIsTruthy, TruthySpec } from "../../../../effected/env/internal/osc8/env.ts";

import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };

describe("internal/osc8/env schema property floor", () => {
  it.effect.prop(
    "TruthySpec: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(TruthySpec)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(TruthySpec)(value);
      const decoded = yield* S.decodeEffect(TruthySpec)(encoded);
      assert.isTrue(S.toEquivalence(TruthySpec)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(TruthySpec)(decoded), encoded);
    }),
    runs,
  );
});

describe("environment truthiness normalization", () => {
  it.effect.prop("default flags preserve truthiness after case normalization and canonical rendering", [Arbitrary.schema(S.String)], ([value]) =>
    Effect.sync(() => {
      const parsed = envIsTruthy(value, "default");
      assert.strictEqual(envIsTruthy(Str.toLowerCase(value), "default"), parsed);
      assert.strictEqual(envIsTruthy(parsed ? "1" : "0", "default"), parsed);
      assert.strictEqual(envIsTruthy("default")(value), parsed);
      assert.strictEqual(envIsTruthy(value, "no-color"), value.length > 0);
    }), runs);
});
