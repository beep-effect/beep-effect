import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { detectWrapper, WrapperInfo } from "../../../../effected/env/internal/osc8/wrappers.ts";

const runs = { arbitrary: fcRuns(100) };

describe("wrapper property floor", () => {
  it.effect.prop("WrapperInfo decoding encoded values never fails and preserves the value", [Arbitrary.schema(WrapperInfo)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(WrapperInfo)(value);
      const decoded = yield* S.decodeEffect(WrapperInfo)(encoded);
      assert.strictEqual(S.toEquivalence(WrapperInfo)(decoded, value), true);
      assert.deepStrictEqual(yield* S.encodeEffect(WrapperInfo)(decoded), encoded);
    }), runs);

  it.effect.prop("tmux wins over screen and every detected wrapper conservatively disables passthrough", [Arbitrary.schema(S.String), Arbitrary.schema(S.String)], ([tmux, screen]) =>
    Effect.sync(() => {
      assert.deepStrictEqual(detectWrapper({ TMUX: `tmux:${tmux}`, STY: `screen:${screen}` }), { name: "tmux", passesThrough: false });
      assert.deepStrictEqual(detectWrapper({ TMUX: "", STY: `screen:${screen}` }), { name: "screen", passesThrough: false });
      assert.strictEqual(detectWrapper({ TMUX: "", STY: "" }), null);
    }), runs);
});
