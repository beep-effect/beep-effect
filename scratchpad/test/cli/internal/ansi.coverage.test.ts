import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { nearest256, openSequence, paintStyle, parseHex } from "../../../effected/cli/internal/ansi.ts";

it.effect("hex parsing, palette ties and foreground levels retain their documented output", () => Effect.sync(() => {
  assert.deepStrictEqual(parseHex("#f80"), [255, 136, 0]);
  assert.deepStrictEqual(parseHex("#AbCdEf"), [171, 205, 239]);
  assert.strictEqual(parseHex("#nope"), undefined);
  assert.strictEqual(nearest256([0, 0, 0]), 16);
  assert.strictEqual(nearest256([255, 0, 0]), 196);
  assert.strictEqual(nearest256([128, 128, 128]), 244);
  assert.strictEqual(nearest256([115, 0, 0]), 52);
  assert.strictEqual(openSequence({ fg: "#000" }, "basic"), "\x1b[30m");
  assert.strictEqual(openSequence({ fg: "#fff" }, "basic"), "\x1b[97m");
  assert.strictEqual(openSequence({ fg: "#f00" }, "256"), "\x1b[38;5;196m");
  assert.strictEqual(openSequence({ fg: "#f80" }, "truecolor"), "\x1b[38;2;255;136;0m");
  assert.strictEqual(openSequence({ fg: "red" }, "none"), "");
  assert.strictEqual(openSequence({ fg: "#invalid" }, "basic"), "");
  assert.strictEqual(openSequence({ bold: false, dim: false, italic: false, underline: false }, "basic"), "");
  assert.strictEqual(paintStyle({ bold: true }, "basic", ""), "");
  assert.strictEqual(paintStyle({ bold: true }, "none", "hello"), "hello");
  assert.strictEqual(paintStyle({ bold: true }, "basic", "a\x1b[22mb"), "\x1b[1ma\x1b[22m\x1b[1mb\x1b[22m");
}));
