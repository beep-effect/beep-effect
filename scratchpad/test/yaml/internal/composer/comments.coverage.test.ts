import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlAlias, YamlMap, YamlPair, YamlScalar, YamlSeq } from "../../../../effected/yaml/YamlNode.ts";
import * as C from "../../../../effected/yaml/internal/composer/comments.ts";

describe("composer comment boundaries", () => {
  it.effect("recognizes line gaps, own lines, indicators and BOM columns", () => Effect.sync(() => {
    assert.strictEqual(C.hasBlankLineBetween("\n \t\r\n", -1, 6), false);
    assert.strictEqual(C.hasBlankLineBetween(0, 6)("\n \t\r\n"), true);
    assert.strictEqual(C.hasBlankLineBetween("x\ny", 0, 3), false);
    assert.strictEqual(C.sameLineSpan("x", -1, 1), false);
    assert.strictEqual(C.sameLineSpan(0, 1)("x"), true);
    assert.strictEqual(C.sameLineSpan("x\ny", 0, 3), false);
    for (const prefix of ["", " \t", "x\n \t", "x\r "]) {
      assert.strictEqual(C.isOwnLineAt(prefix.length)(`${prefix}#`), true);
    }
    assert.strictEqual(C.isOwnLineAt("x #", 2), false);
    for (const prefix of ["? ", "-\t", ": ", "x\n? ", "x\r- "]) {
      assert.strictEqual(C.isAfterIndicatorOnly(prefix.length)(`${prefix}#`), true);
    }
    for (const prefix of ["", " \t", "x: ", "-- ", "x\n ", "x? "]) {
      assert.strictEqual(C.isAfterIndicatorOnly(`${prefix}#`, prefix.length), false);
    }
    assert.strictEqual(C.columnAt("x", -1), 0);
    assert.strictEqual(C.columnAt(0)("x"), 0);
    assert.strictEqual(C.columnAt("\uFEFFx", 1), 0);
    assert.strictEqual(C.columnAt("x\n\uFEFFy", 2), 0);
    assert.strictEqual(C.columnAt("x\n\uFEFF  y", 5), 2);
    assert.strictEqual(C.columnAt("x\n  y", 4), 2);
  }));

  it.effect("locates blank lines only when adjacent and followed by a line", () => Effect.sync(() => {
    assert.strictEqual(C.blankLineAboveStart("#", 0), -1);
    assert.strictEqual(C.blankLineAboveStart(5)("x\n \t\n#"), 2);
    assert.strictEqual(C.hasBlankLineAbove(5)("x\n \t\n#"), true);
    assert.strictEqual(C.hasBlankLineAbove("x\n#", 2), false);
    assert.strictEqual(C.blankLineAboveStart("\n\n#", 2), 1);
    assert.strictEqual(C.hasBlankLineBelow("#", 0), false);
    assert.strictEqual(C.hasBlankLineBelow("#\n ", 0), false);
    assert.strictEqual(C.hasBlankLineBelow(0)("#\n \t\r\nx"), true);
    assert.strictEqual(C.hasBlankLineBelow("#\nx\ny", 0), false);
    assert.strictEqual(C.rawCommentText("#"), " ");
    assert.strictEqual(C.rawCommentText("#  "), "   ");
    assert.strictEqual(C.rawCommentText("# text"), " text");
    assert.strictEqual(C.rawCommentText("text"), "text");
    assert.strictEqual(C.joinComments(undefined, ""), "");
    assert.strictEqual(C.joinComments(" second")(" first"), " first\n second");
  }));

  it.effect("descends last children and distinguishes kept content from stylistic blanks", () => Effect.sync(() => {
    const text = "x\n\ny";
    const scalar = YamlScalar.make({ value: "x\n\n", style: "block-literal", chomp: "keep", offset: 0, length: 3 });
    const alias = YamlAlias.make({ name: "a", offset: 0, length: 1 });
    const emptyMap = YamlMap.make({ items: [], style: "block", offset: 0, length: 1 });
    const emptySeq = YamlSeq.make({ items: [], style: "block", offset: 0, length: 1 });
    const seq = YamlSeq.make({ items: [alias, scalar], style: "block", offset: 0, length: 3 });
    const map = YamlMap.make({ items: [YamlPair.make({ key: alias, value: seq })], style: "block", offset: 0, length: 3 });
    const absent = YamlMap.make({ items: [YamlPair.make({ key: scalar, value: null })], style: "block", offset: 0, length: 3 });
    for (const node of [scalar, seq, map, absent]) {
      assert.strictEqual(C.blankAboveIsKeepChompContent(3, node)(text), true);
    }
    for (const node of [undefined, alias, emptyMap, emptySeq,
      YamlScalar.make({ ...scalar, chomp: "clip" }),
      YamlScalar.make({ ...scalar, style: "plain" }),
      YamlScalar.make({ ...scalar, style: "block-folded", offset: 3 }),
      YamlScalar.make({ ...scalar, style: "block-folded", length: 2 })]) {
      assert.strictEqual(C.blankAboveIsKeepChompContent(text, 3, node), false);
    }
    assert.strictEqual(C.blankAboveIsKeepChompContent(text, 3, YamlScalar.make({ ...scalar, style: "block-folded" })), true);
  }));

  it.effect("immutably merges all comment field combinations on every node kind", () => Effect.sync(() => {
    const scalar = YamlScalar.make({ value: "x", style: "plain", tag: "tag", anchor: "a", chomp: "keep", blockIndent: 2, raw: "x", sourceMultiline: true, offset: 0, length: 1 });
    const map = YamlMap.make({ items: [], style: "flow", tag: "tag", anchor: "a", sourceMultiline: true, offset: 0, length: 2 });
    const seq = YamlSeq.make({ items: [scalar], style: "flow", tag: "tag", anchor: "a", sourceMultiline: true, offset: 0, length: 3 });
    const alias = YamlAlias.make({ name: "a", offset: 0, length: 2 });
    for (const node of [scalar, map, seq, alias]) {
      assert.deepStrictEqual(C.withCommentFields(node, {}), node);
      const first = C.withCommentFields({ commentBefore: " lead", comment: " tail", spaceBefore: true })(node);
      const second = C.withCommentFields(first, { commentBefore: " next", comment: " last", spaceBefore: false });
      assert.strictEqual(second.commentBefore, " lead\n next");
      assert.strictEqual(second.comment, " tail\n last");
      assert.strictEqual(second.spaceBefore, false);
      assert.deepStrictEqual(C.withCommentFields(first, {}), first);
      assert.strictEqual(node.comment, undefined);
      assert.strictEqual(first.comment, " tail");
      const spaced = C.withCommentFields(node, { spaceBefore: true });
      assert.strictEqual(spaced.spaceBefore, true);
      assert.strictEqual(spaced.commentBefore, undefined);
      assert.strictEqual(spaced.offset, node.offset);
    }
  }));
});
