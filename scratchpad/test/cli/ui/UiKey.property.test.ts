import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { KeyName, UiKey, UiKeyPayload } from "../../../effected/cli/ui/UiKey.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("KeyName encodes and decodes without loss or failure", [Arbitrary.schema(KeyName)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(KeyName)(value);
    const decoded = yield* S.decodeEffect(KeyName)(encoded);
    assert.strictEqual(decoded, value);
    assert.strictEqual(yield* S.encodeEffect(KeyName)(decoded), encoded);
  }), runs);

it.effect.prop("UiKeyPayload encodes and decodes named keys and text without loss or failure", [Arbitrary.schema(UiKeyPayload)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(UiKeyPayload)(value);
    const decoded = yield* S.decodeEffect(UiKeyPayload)(encoded);
    assert.isTrue(S.toEquivalence(UiKeyPayload)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(UiKeyPayload)(decoded), encoded);
  }), runs);

// The Ink event representation of each named key, including shifted Tab and Ctrl-C.
const inkKey = {
  upArrow: false, downArrow: false, leftArrow: false, rightArrow: false,
  pageDown: false, pageUp: false, home: false, end: false, return: false,
  escape: false, ctrl: false, shift: false, tab: false, backspace: false,
  delete: false, meta: false, super: false, hyper: false, capsLock: false, numLock: false,
};
const flags = {
  up: { upArrow: true }, down: { downArrow: true }, left: { leftArrow: true }, right: { rightArrow: true },
  pageup: { pageUp: true }, pagedown: { pageDown: true }, home: { home: true }, end: { end: true },
  enter: { return: true }, escape: { escape: true }, "ctrl+c": { ctrl: true },
  tab: { tab: true }, "shift+tab": { tab: true, shift: true }, backspace: { backspace: true }, delete: { delete: true }, space: {},
};

it.effect.prop("named-key normalization is faithful and stable after re-serialization as an Ink event", [Arbitrary.schema(KeyName)], ([name]) =>
  Effect.sync(() => {
    const input = name === "space" ? " " : name === "ctrl+c" ? "c" : "";
    const key = { ...inkKey, ...flags[name] };
    const parsed = UiKey.fromInk(input, key);
    assert.deepStrictEqual(parsed, UiKey.named(name));
    assertDefined(parsed);
    if (parsed._tag === "Char") return assert.fail("expected a named key");
    const serializedInput = parsed.name === "space" ? " " : parsed.name === "ctrl+c" ? "c" : "";
    assert.deepStrictEqual(UiKey.fromInk(serializedInput, { ...inkKey, ...flags[parsed.name] }), parsed);
  }), runs);

const printable = Arbitrary.schema(S.Array(S.Literals(["a", "Z", "0", " ", "é", "中", "😀"])).check(S.isMinLength(1))).pipe(Arbitrary.map(A.join("")));
it.effect.prop("typed-text normalization preserves text and is idempotent through its Ink representation", [printable], ([text]) =>
  Effect.sync(() => {
    const parsed = UiKey.fromInk(text, inkKey);
    assert.deepStrictEqual(parsed, text === " " ? UiKey.named("space") : UiKey.char(text));
    const encoded = parsed?._tag === "Char" ? parsed.char : " ";
    assert.deepStrictEqual(UiKey.fromInk(encoded, inkKey), parsed);
  }), runs);
