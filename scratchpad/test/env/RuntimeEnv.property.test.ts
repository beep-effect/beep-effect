import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { RuntimeEnv, CiName } from "../../effected/env/RuntimeEnv.ts";

const runs = { arbitrary: fcRuns(100) };

describe("RuntimeEnv schema property floor", () => {
  it.effect.prop(
    "RuntimeEnv: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(RuntimeEnv)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(RuntimeEnv)(value);
      const decoded = yield* S.decodeEffect(RuntimeEnv)(encoded);
      assert.isTrue(S.toEquivalence(RuntimeEnv)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(RuntimeEnv)(decoded), encoded);
    }),
    runs,
  );
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

describe("RuntimeEnv JSON persistence fidelity", () => {
  const codec = S.fromJsonString(RuntimeEnv);
  it.effect.prop("persisted JSON recovers the snapshot and stabilizes after parsing", [Arbitrary.schema(RuntimeEnv)], ([value]) =>
    Effect.gen(function* () {
      const text = yield* S.encodeEffect(codec)(value);
      const parsed = yield* S.decodeEffect(codec)(text);
      const reparsed = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(parsed));
      assert.isTrue(S.toEquivalence(RuntimeEnv)(parsed, value));
      assert.isTrue(S.toEquivalence(RuntimeEnv)(reparsed, parsed));
      assert.strictEqual(yield* S.encodeEffect(codec)(reparsed), text);
    }), runs);
});
