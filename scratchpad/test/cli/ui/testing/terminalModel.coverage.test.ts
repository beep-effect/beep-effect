import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { screenAfter } from "../../../../effected/cli/ui/testing/terminalModel.ts";

describe("terminalModel coverage", () => {
  it.effect("overwrites whole emoji and CJK graphemes using terminal cells", () => Effect.sync(() => {
    assert.deepStrictEqual(screenAfter("😀x\rA"), ["A x"]);
    assert.deepStrictEqual(screenAfter("界x\rA"), ["A x"]);
    assert.deepStrictEqual(screenAfter("👨‍👩‍👧‍👦x\rA"), ["A x"]);
    assert.deepStrictEqual(screenAfter("🇺🇸x\rA"), ["A x"]);
    assert.deepStrictEqual(screenAfter("e\u0301x\rA"), ["Ax"]);
    assert.deepStrictEqual(screenAfter("😀x\u001b[1;2HA"), [" Ax"]);
    assert.deepStrictEqual(screenAfter("界x\u001b[2GA"), [" Ax"]);
    assert.deepStrictEqual(screenAfter("abc\r界"), ["界c"]);
    assert.deepStrictEqual(screenAfter("😀界x\u001b[2G好"), [" 好 x"]);
    assert.deepStrictEqual(screenAfter("😀x\u001b[4GA"), ["😀xA"]);
    assert.deepStrictEqual(screenAfter("e\u001b[31m\u0301x\rA"), ["Ax"]);
    assert.deepStrictEqual(screenAfter("\u0301x"), ["x"]);
    assert.deepStrictEqual(screenAfter("e\u001b[1;2H\u0301x"), ["e\u0301x"]);
    assert.deepStrictEqual(screenAfter("界\u001b[1;3H\u0301x"), ["界\u0301x"]);
    assert.deepStrictEqual(screenAfter("e\u001b[8G\u0301x"), ["e      x"]);
  }));

  it.effect("supports both dual forms and normalizes empty lines and trailing whitespace", () => Effect.sync(() => {
    assert.deepStrictEqual(screenAfter(""), []);
    assert.deepStrictEqual(screenAfter("first  \n\nlast\t \n"), ["first", "last"]);
    assert.deepStrictEqual(screenAfter()("hello"), ["hello"]);
    assert.deepStrictEqual(screenAfter(2)("hello"), ["hello"]);
    assert.deepStrictEqual(screenAfter("a\u0000\u0007\t\bZ"), ["aZ"]);
  }));

  it.effect("overwrites at carriage return, clamps cursor-up and erases whole lines", () => Effect.sync(() => {
    assert.deepStrictEqual(screenAfter("abc\rX"), ["Xbc"]);
    assert.deepStrictEqual(screenAfter("first\nsecond\u001b[AX"), ["first X", "second"]);
    assert.deepStrictEqual(screenAfter("abc\u001b[9A\u001b[1GZ"), ["Zbc"]);
    assert.deepStrictEqual(screenAfter("abc\u001b[2KZ"), ["   Z"]);
    assert.deepStrictEqual(screenAfter("abc\u001b[0A\u001b[GZ"), ["Zbc"]);
  }));

  it.effect("ignores unsupported CSI and OSC terminated by BEL or ST", () => Effect.sync(() => {
    assert.deepStrictEqual(screenAfter("a\u001b[?25l\u001b[31m\u001b[1Jb"), ["ab"]);
    assert.deepStrictEqual(screenAfter("\u001b]8;;https://example.com\u0007link\u001b]8;;\u001b\\!"), ["link!"]);
  }));

  it.effect("clears the visible screen with known and unknown heights", () => Effect.sync(() => {
    assert.deepStrictEqual(screenAfter("old\nvisible\nlast\u001b[2J"), []);
    assert.deepStrictEqual(screenAfter("old\nvisible\nlast\u001b[2J", 2), ["old"]);
    assert.deepStrictEqual(screenAfter("old\nlast\u001b[2J", 9), []);
    assert.deepStrictEqual(screenAfter("old\u001b[2J", 0), ["old"]);
  }));

  it.effect("drops only scrollback and keeps the cursor relative to the remaining screen", () => Effect.sync(() => {
    assert.deepStrictEqual(screenAfter("old\nvisible\nlast\u001b[3J\rX", 2), ["visible", "Xast"]);
    assert.deepStrictEqual(screenAfter("old\nlast\u001b[3J"), ["old", "last"]);
    assert.deepStrictEqual(screenAfter("old\u001b[3Jnew", 0), ["   new"]);
  }));

  it.effect("homes to screen coordinates, fills skipped columns and extends skipped rows", () => Effect.sync(() => {
    assert.deepStrictEqual(screenAfter("old\nlast\u001b[Hnew"), ["new", "last"]);
    assert.deepStrictEqual(screenAfter("old\nlast\u001b[;HX", 1), ["old", "Xast"]);
    assert.deepStrictEqual(screenAfter("abc\u001b[3HX"), ["abc", "X"]);
    assert.deepStrictEqual(screenAfter("\u001b[2;4HX"), ["   X"]);
    assert.deepStrictEqual(screenAfter("\u001b[0;1HX\nvisible"), ["visible"]);
  }));
});
