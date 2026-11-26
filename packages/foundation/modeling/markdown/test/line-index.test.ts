import { LineColumn, LineIndex } from "@beep/markdown/internal/lineIndex";
import { assert, describe, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("LineIndex", () => {
  it("validates plain positions from a supplied line table and rejects non-finite coordinates", () => {
    const index = LineIndex.fromLineStarts("a\rb", [0, 2]);
    const position = index.positionAt(2);
    assert.deepStrictEqual(position, { line: 2, column: 1 });
    assert.isTrue(S.is(LineColumn)(position));
    assert.isTrue(S.is(LineColumn)(index.positionAt(-1)));
    assert.isTrue(S.is(LineColumn)(index.positionAt(99)));
    assert.isFalse(S.is(LineColumn)({ line: "1", column: 1 }));
    assert.isFalse(S.is(LineColumn)({ line: 1 }));
    for (const coordinate of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assert.isFalse(S.is(LineColumn)({ line: coordinate, column: 1 }));
      assert.isFalse(S.is(LineColumn)({ line: 1, column: coordinate }));
    }
  });

  it("positions the only offset of an empty string at line 1 column 1", () => {
    const index = LineIndex.make("");
    assert.deepStrictEqual(index.positionAt(0), { line: 1, column: 1 });
  });

  it("positions offsets around \\n boundaries", () => {
    const index = LineIndex.make("ab\ncd\nef");
    assert.deepStrictEqual(index.positionAt(0), { line: 1, column: 1 }, "offset 0 is 'a'");
    assert.deepStrictEqual(index.positionAt(1), { line: 1, column: 2 }, "offset 1 is 'b'");
    assert.deepStrictEqual(index.positionAt(2), { line: 1, column: 3 }, "offset 2 is the '\\n' itself");
    assert.deepStrictEqual(index.positionAt(3), { line: 2, column: 1 }, "offset 3 is 'c'");
    assert.deepStrictEqual(index.positionAt(6), { line: 3, column: 1 }, "offset 6 is 'e'");
  });

  it("treats a CRLF pair as a single boundary, keeping \\r on the prior line", () => {
    const index = LineIndex.make("ab\r\ncd");
    assert.deepStrictEqual(index.positionAt(2), { line: 1, column: 3 }, "offset 2 is the '\\r'");
    assert.deepStrictEqual(index.positionAt(3), { line: 1, column: 4 }, "offset 3 is the '\\n'");
    assert.deepStrictEqual(index.positionAt(4), { line: 2, column: 1 }, "offset 4 is 'c'");
  });

  it("positions the final character and the one-past-end position", () => {
    const index = LineIndex.make("hello");
    assert.deepStrictEqual(index.positionAt(4), { line: 1, column: 5 }, "offset 4 is 'o'");
    assert.deepStrictEqual(index.positionAt(5), { line: 1, column: 6 }, "offset 5 is one past the end");
  });

  it("clamps out-of-range offsets to the nearest valid position", () => {
    const index = LineIndex.make("hi");
    assert.deepStrictEqual(index.positionAt(-10), { line: 1, column: 1 });
    assert.deepStrictEqual(index.positionAt(1000), { line: 1, column: 3 });
  });

  it("clamps across multiple lines when out of range", () => {
    const index = LineIndex.make("ab\ncd\nef");
    assert.deepStrictEqual(index.positionAt(1000), { line: 3, column: 3 });
    assert.deepStrictEqual(index.positionAt(-1), { line: 1, column: 1 });
  });
});
