import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import type { Key } from "ink";
import { UiKey } from "../../../effected/cli/ui/UiKey.ts";

const key: Key = {
  upArrow: false, downArrow: false, leftArrow: false, rightArrow: false,
  pageDown: false, pageUp: false, home: false, end: false, return: false,
  escape: false, ctrl: false, shift: false, tab: false, backspace: false,
  delete: false, meta: false, super: false, hyper: false, capsLock: false, numLock: false,
};
it.effect("Ctrl-C is named while other control and meta chords are ignored", () => Effect.sync(() => {
  assert.deepStrictEqual(UiKey.fromInk("c", { ...key, ctrl: true }), UiKey.named("ctrl+c"));
  assert.strictEqual(UiKey.fromInk("x", { ...key, ctrl: true }), undefined);
  assert.strictEqual(UiKey.fromInk("c", { ...key, meta: true }), undefined);
  assert.strictEqual(UiKey.fromInk("", key), undefined);
  assert.strictEqual(UiKey.fromInk("\u0001", key), undefined);
  assert.deepStrictEqual(UiKey.fromInk("hello", key), UiKey.char("hello"));
}));

it.effect("arrow, page and escape flags normalize directly", () => Effect.sync(() => {
  assert.deepStrictEqual(UiKey.fromInk("", { ...key, upArrow: true }), UiKey.named("up"));
  assert.deepStrictEqual(UiKey.fromInk("", { ...key, pageUp: true }), UiKey.named("pageup"));
  assert.deepStrictEqual(UiKey.fromInk("", { ...key, end: true }), UiKey.named("end"));
  assert.deepStrictEqual(UiKey.fromInk("", { ...key, escape: true }), UiKey.named("escape"));
}));
