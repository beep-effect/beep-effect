import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { TextInput } from "../../../effected/cli/ui/TextInput.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

it.effect("narrow ASCII input cuts the suffix and prefix while preserving the submitted text", () =>
  Effect.gen(function* () {
    const handle = yield* CliUiTest.render(TextInput.screen({ message: "Text", initial: "abcdefghijk" }), { columns: 5, glyphs: "ascii", color: "none" });
    yield* handle.press("home");
    assert.include(yield* handle.plainFrame, "|abc");
    yield* handle.press("right", "right", "right", "right", "right", "right");
    assert.include(yield* handle.plainFrame, "|");
    yield* handle.press("enter");
    assert.strictEqual(yield* handle.result, "abcdefghijk");
  }));

it.effect("wide graphemes are cut whole at a narrow cursor window", () =>
  Effect.gen(function* () {
    const handle = yield* CliUiTest.render(TextInput.screen({ message: "Text", initial: "中中中中中中中" }), { columns: 7, glyphs: "ascii", color: "none" });
    yield* handle.press("home");
    assert.include(yield* handle.plainFrame, "|");
    yield* handle.press("enter");
    assert.strictEqual(yield* handle.result, "中中中中中中中");
  }));

 it.effect("unknown named keys and control chords leave the text unchanged", () => Effect.sync(() => {
   const state = TextInput.init({ initial: "abc" });
   assert.strictEqual(TextInput.step(state, { _tag: "Named", name: "tab" }), state);
 }));

it.effect("bracketed paste normalizes line breaks, drops controls and never submits", () =>
  Effect.gen(function* () {
    const handle = yield* CliUiTest.render(TextInput.screen({ message: "Paste" }));
    yield* handle.chunk({ char: "\u001b[200~\u0001\u001b[201~" });
    yield* handle.chunk({ char: "\u001b[200~a\r\nb\tc\u001b[201~" });
    assert.include(yield* handle.plainFrame, "a bc");
    yield* handle.press("enter");
    assert.strictEqual(yield* handle.result, "a bc");
  }));

it.effect("coalesced controls skip empty runs, backspace a run and ignore Ctrl-X", () =>
  Effect.gen(function* () {
    const handle = yield* CliUiTest.render(TextInput.screen({ message: "Controls" }));
    yield* handle.chunk({ char: "\na\bz" });
    assert.include(yield* handle.plainFrame, " z");
    yield* handle.chunk({ char: "a\u007fz" });
    yield* handle.chunk({ char: "\u0018" });
    yield* handle.press("enter");
    assert.strictEqual(yield* handle.result, " zz");
  }));
