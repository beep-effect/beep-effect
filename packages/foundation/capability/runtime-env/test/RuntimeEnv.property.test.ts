import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CiName, RuntimeEnv } from "@beep/runtime-env/RuntimeEnv";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

describe("RuntimeEnv schema property floor", () => {
  it.effect.prop(
    "RuntimeEnv: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(RuntimeEnv)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(RuntimeEnv)(value);
        const decoded = yield* S.decodeEffect(RuntimeEnv)(encoded);
        assert.isTrue(S.toEquivalence(RuntimeEnv)(decoded, value));
        const value1 = yield* S.encodeEffect(RuntimeEnv)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
  it.effect.prop(
    "CiName: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(CiName)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(CiName)(value);
        const decoded = yield* S.decodeEffect(CiName)(encoded);
        assert.isTrue(S.toEquivalence(CiName)(decoded, value));
        const value2 = yield* S.encodeEffect(CiName)(decoded);
        assert.deepStrictEqual(value2, encoded);
      }),
    runs
  );
});

describe("RuntimeEnv JSON persistence fidelity", () => {
  const codec = S.fromJsonString(RuntimeEnv);
  it.effect.prop(
    "persisted JSON recovers the snapshot and stabilizes after parsing",
    [Arbitrary.schema(RuntimeEnv)],
    ([value]) =>
      Effect.gen(function* () {
        const text = yield* S.encodeEffect(codec)(value);
        const parsed = yield* S.decodeEffect(codec)(text);
        const argument = S.decodeEffect(codec);
        const value4 = yield* S.encodeEffect(codec)(parsed);
        const reparsed = yield* argument(value4);
        assert.isTrue(S.toEquivalence(RuntimeEnv)(parsed, value));
        assert.isTrue(S.toEquivalence(RuntimeEnv)(reparsed, parsed));
        const value3 = yield* S.encodeEffect(codec)(reparsed);
        assert.strictEqual(value3, text);
      }),
    runs
  );
});
