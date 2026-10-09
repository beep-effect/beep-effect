import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { displayWidth, graphemes, stripAnsi } from "../../../effected/cli/internal/displayWidth.ts";
it.effect("counts first Unicode scalars, grapheme clusters and escape-free terminal columns", () => Effect.sync(() => {
  assert.strictEqual(displayWidth(""), 0);
  assert.strictEqual(displayWidth("\u0301\u200b\n"), 0);
  assert.strictEqual(displayWidth("界e\u0301😀🇺🇸𠀀"), 9);
  assert.deepStrictEqual(graphemes("e\u0301👩‍👩‍👧‍👦"), ["e\u0301", "👩‍👩‍👧‍👦"]);
  assert.strictEqual(stripAnsi("\x1b]8;;https://example.com\x1b\\\x1b[31mlink\x1b[39m\x1b]8;;\x07"), "link");
  assert.strictEqual(displayWidth("\x1b[31m界\x1b[39m"), 2);
}));
