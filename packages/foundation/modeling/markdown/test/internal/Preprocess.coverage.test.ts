import {
  columnsToNextTabStop,
  isBlankLine,
  isSpaceOrTab,
  preprocessLines,
  replaceNul,
} from "@beep/markdown/internal/preprocess";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";

describe("preprocessing boundary behavior", () => {
  it.effect("expands tab widths at every column residue and classifies horizontal whitespace", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(A.map([0, 1, 2, 3, 4, 5], columnsToNextTabStop), [4, 3, 2, 1, 4, 3]);
      assert.strictEqual(isSpaceOrTab(" "), true);
      assert.strictEqual(isSpaceOrTab("\t"), true);
      assert.strictEqual(isSpaceOrTab("\n"), false);
      assert.strictEqual(isSpaceOrTab(""), false);
      assert.strictEqual(isBlankLine(" \t\f\v\r\n"), true);
      assert.strictEqual(isBlankLine("x"), false);
      assert.strictEqual(replaceNul("a\0b"), "a�b");
      assert.strictEqual(replaceNul("abc"), "abc");
    })
  );

  it.effect("splits on every terminator spelling and keeps the trailing-line rules", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(preprocessLines("a\0\r\nb\rc\n"), [
        { text: "a�", start: 0 },
        { text: "b", start: 4 },
        { text: "c", start: 6 },
      ]);
      assert.deepStrictEqual(preprocessLines("a\r"), [
        { text: "a", start: 0 },
        { text: "", start: 2 },
      ]);
      assert.deepStrictEqual(preprocessLines(""), [{ text: "", start: 0 }]);
      assert.deepStrictEqual(preprocessLines("\n\n"), [
        { text: "", start: 0 },
        { text: "", start: 1 },
      ]);
      assert.deepStrictEqual(preprocessLines("\r\r\n\n"), [
        { text: "", start: 0 },
        { text: "", start: 1 },
        { text: "", start: 3 },
      ]);
      assert.deepStrictEqual(preprocessLines("tail"), [{ text: "tail", start: 0 }]);
    })
  );

  it.effect("leaves the shared terminator scan reusable after an early caller", () =>
    Effect.sync(() => {
      assert.strictEqual(preprocessLines("a\nb\nc").length, 3);
      assert.strictEqual(
        preprocessLines("x\ny").length,
        2,
        "the scan shares one global regex, so a second split must start at 0"
      );
    })
  );
});
