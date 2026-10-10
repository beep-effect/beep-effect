import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { columnsToNextTabStop, isBlankLine, isSpaceOrTab, peekCode, preprocessLines, replaceNul } from "../../../effected/markdown/internal/preprocess.ts";

describe("preprocessing boundary behavior", () => {
  it.effect("expands tab widths at every column residue and reads both cursor call styles", () => Effect.sync(() => {
    assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map(columnsToNextTabStop), [4, 3, 2, 1, 4, 3]);
    assert.strictEqual(peekCode("A", 0), 65);
    assert.strictEqual(peekCode(0)("A"), 65);
    assert.strictEqual(peekCode("A", -1), -1);
    assert.strictEqual(peekCode("A", 1), -1);
    assert.strictEqual(isSpaceOrTab(32), true);
    assert.strictEqual(isSpaceOrTab(9), true);
    assert.strictEqual(isSpaceOrTab(10), false);
    assert.strictEqual(isBlankLine(" \t\f\v\r\n"), true);
    assert.strictEqual(isBlankLine("x"), false);
    assert.strictEqual(replaceNul("a\0b"), "a�b");
    assert.strictEqual(replaceNul("abc"), "abc");
    assert.deepStrictEqual(preprocessLines("a\0\r\nb\rc\n"), [{ text: "a�", start: 0 }, { text: "b", start: 4 }, { text: "c", start: 6 }]);
    assert.deepStrictEqual(preprocessLines("a\r"), [{ text: "a", start: 0 }, { text: "", start: 2 }]);
    assert.deepStrictEqual(preprocessLines(""), [{ text: "", start: 0 }]);
  }));
});
