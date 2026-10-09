import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { parse } from "yaml";
import { YamlMap, YamlPair, YamlScalar, YamlSeq, type YamlNode } from "../../../effected/yaml/YamlNode.ts";
import { composeFirstDocument } from "../../../effected/yaml/internal/composer/document.ts";
import type { RawYamlDocument } from "../../../effected/yaml/internal/raw-document.ts";
import { renderDoubleQuoted, stringifyDocument, stringifyValue } from "../../../effected/yaml/internal/stringifier.ts";

const scalar = (value: unknown, extra: Partial<YamlScalar> = {}) => YamlScalar.make({ value, style: "plain", offset: 0, length: 1, ...extra });
const document = (contents: YamlNode | null, extra: Partial<RawYamlDocument> = {}): RawYamlDocument => ({ contents, errors: [], warnings: [], directives: [], hasDocumentStart: false, hasDocumentEnd: false, hasDocumentStartTab: false, ...extra });
const map = (key: YamlNode, value: YamlNode | null, extra: Partial<YamlMap> = {}) => YamlMap.make({ items: [YamlPair.make({ key, value })], style: "block", offset: 0, length: 1, ...extra });

describe("stringifier uncovered rendering cases", () => {
  it.effect("escapes named controls, supplementary characters and unmatched surrogates", () => Effect.sync(() => {
    assert.strictEqual(renderDoubleQuoted("\0\x07\b\v\f\x1b\x01"), '"\\0\\a\\b\\v\\f\\e\\x01"');
    assert.strictEqual(renderDoubleQuoted("😀\ud800x\udc00\ud800", true), '"\\U0001F600\\uD800x\\uDC00\\uD800"');
    for (const value of ["true", "false", "0o77", "0xF", ".inf", ".nan", ":", "?\t", "x,y", "x\t#y", "x:\ty", "x\t", "x\r", "x\x01"]) {
      assert.strictEqual(parse(stringifyValue(value)), value);
      assert.strictEqual(parse(stringifyValue([value], { defaultCollectionStyle: "flow" }))[0], value);
    }
    for (const value of [NaN, Infinity, -Infinity, 9007199254740993n]) {
      assert.deepStrictEqual(parse(stringifyValue(value), { intAsBigInt: true }), value);
    }
    assert.strictEqual(stringifyValue(Symbol("leaf")), '"Symbol(leaf)"\n');
  }));
  it.effect("long explicit value keys keep multiline strings and collections", () => Effect.sync(() => {
    const key = "k".repeat(1025);
    for (const value of ["a\nb\n", "a\nb\n\n", { a: "a\nb\n\n", b: 2 }, ["a\nb\n\n", 2]]) {
      for (const defaultScalarStyle of ["plain", "block-literal", "block-folded"] as const) {
        const text = stringifyValue({ [key]: value }, { defaultScalarStyle, indent: 4 });
        assert.deepStrictEqual(parse(text), { [key]: value });
      }
    }
  }));
  it.effect("normalizes primary and named tag handles using the directive table", () => Effect.sync(() => {
    for (const [tag, handle, prefix, expected] of [
      ["!local", "!", "tag:yaml.org,2002:", "!!local"],
      ["!local", "!", "tag:example:", "!<tag:example:local>"],
      ["!h!local", "!h!", "tag:yaml.org,2002:", "!!local"],
      ["!!local", "!!", "", "!!local"],
      ["!h!local", "!h!", "", "!h!local"],
      ["!", "!", "tag:example:", "!"],
      ["plain", "!", "tag:example:", "plain"],
    ] as const) {
      const doc = document(scalar("leaf", { tag }), { directives: [{ name: "TAG", parameters: [handle, prefix] }] });
      assert.strictEqual(stringifyDocument(doc, { forceDefaultStyles: true }), `${expected} leaf\n`);
    }
  }));
  it.effect("renders empty collection metadata and nested collection comment layouts", () => Effect.sync(() => {
    for (const style of ["block", "flow"] as const) {
      for (const extra of [{}, { tag: "!local" }, { anchor: "ref" }, { tag: "!local", anchor: "ref" }]) {
        const emptyMap = YamlMap.make({ items: [], style, offset: 0, length: 1, ...extra });
        const emptySeq = YamlSeq.make({ items: [], style, offset: 0, length: 1, ...extra });
        const prefix = `${extra.anchor === undefined ? "" : `&${extra.anchor} `}${extra.tag === undefined ? "" : `${extra.tag} `}`;
        assert.strictEqual(stringifyDocument(document(emptyMap)), `${prefix}{}\n`);
        assert.strictEqual(stringifyDocument(document(emptySeq)), `${prefix}[]\n`);
      }
    }
    for (const input of [
      "a:\n  # lead\n  |\n  text\n", "a:\n  # lead\n  'first\n\n    second'\n",
      "a: &ref\n  # lead\n  b: 1\n", "a:\n  # lead\n  - b\n",
      "{a: 1,\n\n# tail\n}\n", "[a,\n\n# tail\n]\n",
      "? [a, b]\n: {a: 1,\n # c\n b: 2}\n",
      "? [a, b]\n:\n # lead\n 1\n",
    ]) {
      const doc = composeFirstDocument(input);
      assert.deepStrictEqual(doc.errors, []);
      const text = stringifyDocument(doc);
      assert.deepStrictEqual(parse(text), parse(input));
      assert.strictEqual(stringifyDocument(composeFirstDocument(text)), text);
    }
  }));
  it.effect("renders synthetic scalar values and block headers with leading comments", () => Effect.sync(() => {
    assert.strictEqual(stringifyDocument(document(scalar(Symbol("x")))), '"Symbol(x)"\n');
    for (const style of ["block-literal", "block-folded", "single-quoted"] as const) {
      const value = scalar("first\nsecond\n", { style, commentBefore: " lead\n", comment: " tail" });
      const text = stringifyDocument(document(map(scalar("key"), value)));
      assert.deepStrictEqual(parse(text), { key: "first\nsecond\n" });
      assert.include(text, "# lead");
      assert.include(text, "# tail");
    }
  }));
});

describe("stringifier metadata and blank-line branch matrix", () => {
  it.effect("preserves values through commented collections in every parent position", () => Effect.sync(() => {
    for (const style of ["block", "flow"] as const) {
      for (const extra of [{}, { anchor: "ref" }, { tag: "!local", anchor: "ref" }]) {
        for (const commentBefore of [undefined, " lead\n\n next"]) {
          const comments = commentBefore === undefined ? {} : { commentBefore };
          const leaf = scalar("leaf", { comment: " tail", spaceBefore: true, ...comments });
          const nestedMap = YamlMap.make({ items: [YamlPair.make({ key: scalar("key", { ...comments, spaceBefore: true }), value: leaf })], style, offset: 0, length: 1, comment: " end\n\n", sourceMultiline: true, ...extra });
          const nestedSeq = YamlSeq.make({ items: [leaf, scalar("other")], style, offset: 0, length: 1, comment: " end\n\n", sourceMultiline: true, ...extra });
          for (const node of [nestedMap, nestedSeq]) {
            for (const parent of [node, map(scalar("outer"), node), map(scalar("k".repeat(1025)), node), YamlSeq.make({ items: [node], style: "block", offset: 0, length: 1 })]) {
              for (const indentSequences of [false, true]) {
                const text = stringifyDocument(document(parent), { indentSequences });
                assert.deepStrictEqual(parse(text), parent.toValue());
                assert.include(text, "# end");
              }
            }
          }
        }
      }
    }
  }));
  it.effect("keeps blank lines in explicit values and canonical multiline quoted values", () => Effect.sync(() => {
    const key = scalar("k".repeat(1025));
    for (const value of ["first\nsecond", "first\nsecond\n", "first\n \tsecond"]) {
      const node = scalar(value, { style: "plain" });
      for (const parent of [node, map(key, node), map(scalar("key"), node), YamlSeq.make({ items: [node], style: "block", offset: 0, length: 1 })]) {
        const text = stringifyDocument(document(parent), { forceDefaultStyles: true });
        assert.deepStrictEqual(parse(text), parent.toValue());
      }
    }
    const seq = YamlSeq.make({ items: [scalar("x", { commentBefore: "\n lead\n" }), scalar("a\nb\n\n", { style: "block-literal" })], style: "block", offset: 0, length: 1, commentBefore: "\n heading\n" });
    const mapping = map(scalar("x", { commentBefore: "\n lead\n" }), scalar("a\nb\n\n", { style: "block-literal" }), { commentBefore: "\n heading\n" });
    for (const node of [seq, mapping]) {
      const text = stringifyDocument(document(map(key, node)));
      assert.deepStrictEqual(parse(text), { ["k".repeat(1025)]: node.toValue() });
    }
    const block = scalar("", { style: "block-literal", comment: " empty" });
    assert.strictEqual(stringifyDocument(document(block)), '"" # empty\n');
    for (const comments of [{ commentBefore: " heading" }, {}]) {
      const node = scalar(null, { length: 0, anchor: "empty", ...comments });
      const text = stringifyDocument(document(node, { hasDocumentStart: true }));
      assert.include(text, "--- &empty");
      assert.strictEqual(parse(text), null);
    }
    assert.strictEqual(stringifyDocument(document(scalar("leaf"), { commentBefore: " heading" })), "# heading\nleaf\n");
    assert.strictEqual(stringifyDocument(document(null, { hasDocumentEnd: true }), { finalNewline: false }), "...");
    assert.strictEqual(stringifyDocument(document(null, { comment: " tail" }), { finalNewline: false }), "# tail");
  }));
});

describe("stringifier remaining presentation edges", () => {
  it.effect("keeps explicit leading blank comments, empty values and canonical flow collections", () => Effect.sync(() => {
    const key = scalar("k".repeat(1025));
    for (const value of [scalar(null, { length: 0, commentBefore: "\n lead\n" }), scalar("a\nb\n\n", { style: "block-literal", commentBefore: "\n lead\n" })]) {
      const text = stringifyDocument(document(map(key, value)));
      assert.deepStrictEqual(parse(text), { ["k".repeat(1025)]: value.toValue() });
      assert.include(text, "# lead");
    }
    const seq = YamlSeq.make({ items: [scalar("a\nb\n\n", { style: "block-literal" })], style: "block", offset: 0, length: 1 });
    assert.deepStrictEqual(parse(stringifyDocument(document(map(key, seq)))), { ["k".repeat(1025)]: ["a\nb\n\n"] });
    const empty = scalar(null, { length: 0, commentBefore: " lead" });
    assert.include(stringifyDocument(document(map(scalar("key"), empty))), "# lead");
    const quoted = scalar("a\nb", { commentBefore: " lead" });
    assert.deepStrictEqual(parse(stringifyDocument(document(map(scalar("key"), quoted)), { forceDefaultStyles: true })), { key: "a\nb" });
    const flowNull = map(scalar("key", { commentBefore: " lead" }), null, { style: "flow" });
    assert.deepStrictEqual(parse(stringifyDocument(document(flowNull))), { key: null });
    const flow = map(scalar("key"), scalar("value"), { style: "flow" });
    const wrapper = map(scalar("outer"), flow);
    assert.deepStrictEqual(parse(stringifyDocument(document(wrapper), { forceDefaultStyles: true, defaultCollectionStyle: "flow" })), { outer: { key: "value" } });
    assert.strictEqual(stringifyDocument(document(null), { finalNewline: false }), "null");
    for (const contents of [scalar(null, { length: 0, anchor: "empty", commentBefore: " lead" }), scalar("leaf", { anchor: "a", commentBefore: " lead" })]) {
      assert.include(stringifyDocument(document(contents, { hasDocumentStart: true }), { finalNewline: false }), "# lead");
    }
    assert.strictEqual(stringifyDocument(document(scalar("leaf"), { commentBefore: " heading" })), "# heading\nleaf\n");
  }));
});

describe("stringifier explicit compact and leading flow comments", () => {
  it.effect("places compact collection comments on a single-line explicit key", () => Effect.sync(() => {
    const key = YamlSeq.make({ items: [scalar("key")], style: "flow", offset: 0, length: 1 });
    const value = YamlSeq.make({ items: [scalar(1), scalar(2)], style: "block", offset: 0, length: 1 });
    const text = stringifyDocument(document(map(key, value)));
    assert.strictEqual(text, "? [key]\n: - 1\n  - 2\n");
    const flow = map(scalar("key"), scalar("value", { comment: " tail" }), { style: "flow", commentBefore: " leading" });
    const output = stringifyDocument(document(map(scalar("outer"), flow)));
    assert.deepStrictEqual(parse(output), { outer: { key: "value" } });
    assert.include(output, "# leading");
  }));
});
