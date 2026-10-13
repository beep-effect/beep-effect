import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { computeEdits } from "../../../effected/yaml/internal/diff.ts";

describe("diff boundary contracts", () => {
  it.effect("distinguishes identity, insertion, deletion and replacement", () => Effect.sync(() => {
    assert.deepStrictEqual(computeEdits("", ""), []);
    assert.deepStrictEqual(computeEdits("abc", "abc"), []);
    assert.deepStrictEqual(computeEdits("", "abc"), [{ offset: 0, length: 0, content: "abc" }]);
    assert.deepStrictEqual(computeEdits("abc", ""), [{ offset: 0, length: 3, content: "" }]);
    assert.deepStrictEqual(computeEdits("abc", "abXc"), [{ offset: 2, length: 0, content: "X" }]);
    assert.deepStrictEqual(computeEdits("abXc", "abc"), [{ offset: 2, length: 1, content: "" }]);
    assert.deepStrictEqual(computeEdits("abc", "XYZ"), [{ offset: 0, length: 3, content: "XYZ" }]);
    assert.deepStrictEqual(computeEdits("abc", "abd"), [{ offset: 2, length: 1, content: "d" }]);
  }));
  it.effect("splits changed lines and retains equal interior lines and CRLF offsets", () => Effect.sync(() => {
    assert.deepStrictEqual(computeEdits("a\nkeep\nb", "x\nkeep\ny"), [
      { offset: 0, length: 1, content: "x" }, { offset: 7, length: 1, content: "y" },
    ]);
    assert.deepStrictEqual(computeEdits("a\r\nkeep\r\nb", "x\r\nkeep\r\ny"), [
      { offset: 0, length: 2, content: "x\r" }, { offset: 9, length: 1, content: "y" },
    ]);
    assert.deepStrictEqual(computeEdits("a\nb", "xyz"), [{ offset: 0, length: 3, content: "xyz" }]);
  }));
});
