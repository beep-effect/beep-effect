import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { detectWrapper as detectWrapperOption, WrapperInfo } from "@beep/runtime-env/internal/osc8/wrappers";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

// The detector answers with an Option; these assertions read its value, or null when it is None.
const detectWrapper = flow(detectWrapperOption, O.getOrNull);

const runs = { arbitrary: fcRuns(100) };

describe("wrapper property floor", () => {
  it.effect.prop(
    "WrapperInfo decoding encoded values never fails and preserves the value",
    [Arbitrary.schema(WrapperInfo)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(WrapperInfo)(value);
        const decoded = yield* S.decodeEffect(WrapperInfo)(encoded);
        assert.strictEqual(S.toEquivalence(WrapperInfo)(decoded, value), true);
        const value1 = yield* S.encodeEffect(WrapperInfo)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );

  it.effect.prop(
    "tmux wins over screen and every detected wrapper conservatively disables passthrough",
    [Arbitrary.schema(S.String), Arbitrary.schema(S.String)],
    ([tmux, screen]) =>
      Effect.sync(() => {
        assert.deepStrictEqual<unknown>(detectWrapper({ TMUX: `tmux:${tmux}`, STY: `screen:${screen}` }), {
          name: "tmux",
          passesThrough: false,
        });
        assert.deepStrictEqual<unknown>(detectWrapper({ TMUX: "", STY: `screen:${screen}` }), {
          name: "screen",
          passesThrough: false,
        });
        assert.strictEqual(detectWrapper({ TMUX: "", STY: "" }), null);
      }),
    runs
  );
});
