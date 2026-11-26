import { MarkdownEdit, MarkdownRange } from "@beep/markdown/MarkdownEdit";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";

describe("MarkdownRange", () => {
  it("constructs via make with offset and length", () => {
    const range = MarkdownRange.make({ offset: 4, length: 10 });
    assert.strictEqual(range.offset, 4);
    assert.strictEqual(range.length, 10);
  });

  it("is structurally equal for identical fields", () => {
    assert.isTrue(
      Equal.equals(MarkdownRange.make({ offset: 1, length: 2 }), MarkdownRange.make({ offset: 1, length: 2 }))
    );
  });
});

describe("MarkdownEdit", () => {
  const edit = (offset: number, length: number, content: string) => MarkdownEdit.make({ offset, length, content });

  it("applies a single replacement splice", () => {
    assert.strictEqual(MarkdownEdit.applyAll("# Hello", [edit(2, 5, "World")]), "# World");
  });

  it("applies multiple edits regardless of input order", () => {
    const text = "one two three";
    const edits = [edit(0, 3, "ONE"), edit(8, 5, "THREE"), edit(4, 3, "TWO")];
    assert.strictEqual(MarkdownEdit.applyAll(text, edits), "ONE TWO THREE");
  });

  it("deletes with empty content", () => {
    assert.strictEqual(MarkdownEdit.applyAll("a b c", [edit(1, 2, "")]), "a c");
  });

  it("inserts with zero length", () => {
    assert.strictEqual(MarkdownEdit.applyAll("ac", [edit(1, 0, "b")]), "abc");
  });

  it("allows adjacent edits that touch without overlapping", () => {
    const text = "abcdef";
    const edits = [edit(0, 3, "X"), edit(3, 3, "Y")];
    assert.strictEqual(MarkdownEdit.applyAll(text, edits), "XY");
  });

  it("throws on overlapping edits as a programmer error, the toml posture where jsonc and yaml do not check", () => {
    const edits = [edit(0, 4, "x"), edit(2, 4, "y")];
    assert.throws(() => MarkdownEdit.applyAll("abcdefgh", edits), /overlapping edits are a programmer error/);
  });

  it("throws when an insertion sits inside a replaced span", () => {
    const edits = [edit(0, 4, "x"), edit(2, 0, "y")];
    assert.throws(() => MarkdownEdit.applyAll("abcdefgh", edits), /overlapping edits are a programmer error/);
  });

  it("does not mutate the input edits array", () => {
    const edits = [edit(4, 1, "B"), edit(0, 1, "A")];
    MarkdownEdit.applyAll("a b c", edits);
    assert.strictEqual(edits[0]?.offset, 4);
    assert.strictEqual(edits[1]?.offset, 0);
  });

  it("preserves stable equal-offset insertion ordering without mutating edits", () => {
    const first = edit(1, 0, "x");
    const second = edit(1, 0, "y");
    const edits = [first, second];
    assert.strictEqual(MarkdownEdit.applyAll("ab", edits), "ayxb");
    assert.strictEqual(edits[0], first);
    assert.strictEqual(edits[1], second);
  });

  it("offsets are UTF-16 code units on astral content", () => {
    assert.strictEqual(
      MarkdownEdit.applyAll("a\u{1D11E}b", [edit(3, 1, "c")]),
      "a\u{1D11E}c",
      "𝄞 occupies two UTF-16 code units, so b sits at offset 3"
    );
    assert.strictEqual(
      MarkdownEdit.applyAll("a\u{1D11E}b", [edit(1, 2, "-")]),
      "a-b",
      "the surrogate pair splices out as a unit"
    );
  });

  it("empty edits array returns the text unchanged", () => {
    assert.strictEqual(MarkdownEdit.applyAll("unchanged", []), "unchanged");
  });

  const Nat = (max: number) => S.Int.check(S.isBetween({ minimum: 0, maximum: max }));
  const disjointEdits = Arbitrary.schema(
    S.Tuple([
      S.String.check(S.isBetweenLength(8, 64)),
      S.Array(S.Tuple([Nat(7), Nat(3), S.String.check(S.isMaxLength(5))])).check(S.isMaxLength(4)),
    ])
  ).pipe(
    Arbitrary.map(([text, raw]) => {
      const edits: Array<MarkdownEdit> = [];
      let cursor = 0;
      for (const [gap, length, content] of raw) {
        const offset = cursor + gap;
        if (offset + length > text.length) {
          break;
        }
        edits.push(MarkdownEdit.make({ offset, length, content }));
        const stepPastInsertionOffset = Math.max(length, 1);
        cursor = offset + stepPastInsertionOffset;
      }
      return { text, edits };
    })
  );

  const scaleToTextLengthCap = { arbitrary: { runs: 200, size: 64 } };
  it.prop(
    "batch application equals sequential reverse-offset application on disjoint edits",
    [disjointEdits],
    ([{ text, edits }]) => {
      const batch = MarkdownEdit.applyAll(text, edits);
      let sequential = text;
      for (const e of [...edits].sort((a, b) => b.offset - a.offset)) {
        sequential = MarkdownEdit.applyAll(sequential, [e]);
      }
      return batch === sequential;
    },
    scaleToTextLengthCap
  );
});
