import { composeFirstDocument } from "@beep/yaml/internal/composer/document";
import { StringifyOptionsInput } from "@beep/yaml/internal/options";
import { RawDirective, RawYamlDocument } from "@beep/yaml/internal/raw-document";
import { renderDoubleQuoted, stringifyDocument, stringifyValue } from "@beep/yaml/internal/stringifier";
import { YamlMap, YamlPair, YamlScalar, YamlSeq } from "@beep/yaml/YamlNode";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { parse } from "yaml";
import type { YamlNode } from "@beep/yaml/YamlNode";
import type * as S from "effect/Schema";

const scalar = (value: unknown, extra: Partial<YamlScalar> = {}) =>
  YamlScalar.make({ value, style: "plain", offset: 0, length: 1, ...extra });
const document = (
  contents: YamlNode | null,
  extra: Partial<S.Struct.Type<typeof RawYamlDocument.fields>> = {}
): RawYamlDocument =>
  RawYamlDocument.make({
    contents,
    errors: [],
    warnings: [],
    directives: [],
    hasDocumentStart: false,
    hasDocumentEnd: false,
    hasDocumentStartTab: false,
    ...extra,
  });
const map = (key: YamlNode, value: YamlNode | null, extra: Partial<YamlMap> = {}) =>
  YamlMap.make({ items: [YamlPair.make({ key, value })], style: "block", offset: 0, length: 1, ...extra });

type CollectionStyle = "block" | "flow";
type CollectionMetadata = { readonly tag?: string; readonly anchor?: string };

const metadataPrefix = (extra: CollectionMetadata): string =>
  `${extra.anchor === undefined ? "" : `&${extra.anchor} `}${extra.tag === undefined ? "" : `${extra.tag} `}`;

const assertEmptyCollectionMetadata = (style: CollectionStyle, extra: CollectionMetadata) => {
  const emptyMap = YamlMap.make({ items: [], style, offset: 0, length: 1, ...extra });
  const emptySeq = YamlSeq.make({ items: [], style, offset: 0, length: 1, ...extra });
  const prefix = metadataPrefix(extra);
  assert.strictEqual(stringifyDocument(document(emptyMap)), `${prefix}{}\n`);
  assert.strictEqual(stringifyDocument(document(emptySeq)), `${prefix}[]\n`);
};

const assertCommentLayoutRoundtrip = (input: string) => {
  const doc = composeFirstDocument(input);
  assert.deepStrictEqual(doc.errors, []);
  const text = stringifyDocument(doc);
  assert.deepStrictEqual(parse(text), parse(input));
  assert.strictEqual(stringifyDocument(composeFirstDocument(text)), text);
};

const commentedCollections = (
  style: CollectionStyle,
  extra: CollectionMetadata,
  commentBefore: string | undefined
): ReadonlyArray<YamlMap | YamlSeq> => {
  const comments = commentBefore === undefined ? {} : { commentBefore };
  const leaf = scalar("leaf", { comment: " tail", spaceBefore: true, ...comments });
  const nestedMap = YamlMap.make({
    items: [YamlPair.make({ key: scalar("key", { ...comments, spaceBefore: true }), value: leaf })],
    style,
    offset: 0,
    length: 1,
    comment: " end\n\n",
    sourceMultiline: true,
    ...extra,
  });
  const nestedSeq = YamlSeq.make({
    items: [leaf, scalar("other")],
    style,
    offset: 0,
    length: 1,
    comment: " end\n\n",
    sourceMultiline: true,
    ...extra,
  });
  return [nestedMap, nestedSeq];
};

const KEY_LONG_ENOUGH_TO_SPILL_EXPLICIT = Str.repeat(1025)("k");

const parentPositions = (node: YamlMap | YamlSeq): ReadonlyArray<YamlNode> => [
  node,
  map(scalar("outer"), node),
  map(scalar(KEY_LONG_ENOUGH_TO_SPILL_EXPLICIT), node),
  YamlSeq.make({ items: [node], style: "block", offset: 0, length: 1 }),
];

const assertCommentedParent = (parent: YamlNode) => {
  for (const indentSequences of [false, true]) {
    const text = stringifyDocument(document(parent), StringifyOptionsInput.make({ indentSequences }));
    assert.deepStrictEqual(parse(text), parent.toValue());
    assert.include(text, "# end");
  }
};

const assertCommentedVariant = (
  style: CollectionStyle,
  extra: CollectionMetadata,
  commentBefore: string | undefined
) => {
  for (const node of commentedCollections(style, extra, commentBefore)) {
    for (const parent of parentPositions(node)) assertCommentedParent(parent);
  }
};

const assertCommentedStyle = (style: CollectionStyle) => {
  for (const extra of [{}, { anchor: "ref" }, { tag: "!local", anchor: "ref" }]) {
    for (const commentBefore of [undefined, " lead\n\n next"]) assertCommentedVariant(style, extra, commentBefore);
  }
};

describe("stringifier uncovered rendering cases", () => {
  it.effect("escapes named controls, supplementary characters and unmatched surrogates", () =>
    Effect.sync(() => {
      assert.strictEqual(renderDoubleQuoted("\0\x07\b\v\f\x1b\x01"), '"\\0\\a\\b\\v\\f\\e\\x01"');
      assert.strictEqual(renderDoubleQuoted("😀\ud800x\udc00\ud800", true), '"\\U0001F600\\uD800x\\uDC00\\uD800"');
      for (const value of [
        "true",
        "false",
        "0o77",
        "0xF",
        ".inf",
        ".nan",
        ":",
        "?\t",
        "x,y",
        "x\t#y",
        "x:\ty",
        "x\t",
        "x\r",
        "x\x01",
      ]) {
        assert.strictEqual(parse(stringifyValue(value)), value);
        assert.strictEqual(
          parse(stringifyValue([value], StringifyOptionsInput.make({ defaultCollectionStyle: "flow" })))[0],
          value
        );
      }
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 9007199254740993n]) {
        assert.deepStrictEqual(parse(stringifyValue(value), { intAsBigInt: true }), value);
      }
      assert.strictEqual(stringifyValue(Symbol("leaf")), '"Symbol(leaf)"\n');
    })
  );
  it.effect("long explicit value keys keep multiline strings and collections", () =>
    Effect.sync(() => {
      const key = Str.repeat(1025)("k");
      for (const value of ["a\nb\n", "a\nb\n\n", { a: "a\nb\n\n", b: 2 }, ["a\nb\n\n", 2]]) {
        for (const defaultScalarStyle of ["plain", "block-literal", "block-folded"] as const) {
          const text = stringifyValue({ [key]: value }, StringifyOptionsInput.make({ defaultScalarStyle, indent: 4 }));
          assert.deepStrictEqual(parse(text), { [key]: value });
        }
      }
    })
  );
  it.effect("normalizes primary and named tag handles using the directive table", () =>
    Effect.sync(() => {
      for (const [tag, handle, prefix, expected] of [
        ["!local", "!", "tag:yaml.org,2002:", "!!local"],
        ["!local", "!", "tag:example:", "!<tag:example:local>"],
        ["!h!local", "!h!", "tag:yaml.org,2002:", "!!local"],
        ["!!local", "!!", "", "!!local"],
        ["!h!local", "!h!", "", "!h!local"],
        ["!", "!", "tag:example:", "!"],
        ["plain", "!", "tag:example:", "plain"],
      ] as const) {
        const doc = document(scalar("leaf", { tag }), {
          directives: [RawDirective.make({ name: "TAG", parameters: [handle, prefix] })],
        });
        assert.strictEqual(
          stringifyDocument(doc, StringifyOptionsInput.make({ forceDefaultStyles: true })),
          `${expected} leaf\n`
        );
      }
    })
  );
  it.effect("renders empty collection metadata and nested collection comment layouts", () =>
    Effect.sync(() => {
      for (const style of ["block", "flow"] as const) {
        for (const extra of [{}, { tag: "!local" }, { anchor: "ref" }, { tag: "!local", anchor: "ref" }]) {
          assertEmptyCollectionMetadata(style, extra);
        }
      }
      for (const input of [
        "a:\n  # lead\n  |\n  text\n",
        "a:\n  # lead\n  'first\n\n    second'\n",
        "a: &ref\n  # lead\n  b: 1\n",
        "a:\n  # lead\n  - b\n",
        "{a: 1,\n\n# tail\n}\n",
        "[a,\n\n# tail\n]\n",
        "? [a, b]\n: {a: 1,\n # c\n b: 2}\n",
        "? [a, b]\n:\n # lead\n 1\n",
      ]) {
        assertCommentLayoutRoundtrip(input);
      }
    })
  );
  it.effect("renders synthetic scalar values and block headers with leading comments", () =>
    Effect.sync(() => {
      assert.strictEqual(stringifyDocument(document(scalar(Symbol("x")))), '"Symbol(x)"\n');
      for (const style of ["block-literal", "block-folded", "single-quoted"] as const) {
        const value = scalar("first\nsecond\n", { style, commentBefore: " lead\n", comment: " tail" });
        const text = stringifyDocument(document(map(scalar("key"), value)));
        assert.deepStrictEqual(parse(text), { key: "first\nsecond\n" });
        assert.include(text, "# lead");
        assert.include(text, "# tail");
      }
    })
  );
});

describe("stringifier metadata and blank-line branch matrix", () => {
  it.effect("preserves values through commented collections in every parent position", () =>
    Effect.sync(() => {
      for (const style of ["block", "flow"] as const) assertCommentedStyle(style);
    })
  );
  it.effect("keeps blank lines in explicit values and canonical multiline quoted values", () =>
    Effect.sync(() => {
      const key = scalar(Str.repeat(1025)("k"));
      for (const value of ["first\nsecond", "first\nsecond\n", "first\n \tsecond"]) {
        const node = scalar(value, { style: "plain" });
        for (const parent of [
          node,
          map(key, node),
          map(scalar("key"), node),
          YamlSeq.make({ items: [node], style: "block", offset: 0, length: 1 }),
        ]) {
          const text = stringifyDocument(document(parent), StringifyOptionsInput.make({ forceDefaultStyles: true }));
          assert.deepStrictEqual(parse(text), parent.toValue());
        }
      }
      const seq = YamlSeq.make({
        items: [scalar("x", { commentBefore: "\n lead\n" }), scalar("a\nb\n\n", { style: "block-literal" })],
        style: "block",
        offset: 0,
        length: 1,
        commentBefore: "\n heading\n",
      });
      const mapping = map(scalar("x", { commentBefore: "\n lead\n" }), scalar("a\nb\n\n", { style: "block-literal" }), {
        commentBefore: "\n heading\n",
      });
      for (const node of [seq, mapping]) {
        const text = stringifyDocument(document(map(key, node)));
        assert.deepStrictEqual(parse(text), { [Str.repeat(1025)("k")]: node.toValue() });
      }
      const block = scalar("", { style: "block-literal", comment: " empty" });
      assert.strictEqual(stringifyDocument(document(block)), '"" # empty\n');
      for (const comments of [{ commentBefore: " heading" }, {}]) {
        const node = scalar(null, { length: 0, anchor: "empty", ...comments });
        const text = stringifyDocument(document(node, { hasDocumentStart: true }));
        assert.include(text, "--- &empty");
        assert.strictEqual(parse(text), null);
      }
      assert.strictEqual(
        stringifyDocument(document(scalar("leaf"), { commentBefore: " heading" })),
        "# heading\nleaf\n"
      );
      assert.strictEqual(
        stringifyDocument(
          document(null, { hasDocumentEnd: true }),
          StringifyOptionsInput.make({ finalNewline: false })
        ),
        "..."
      );
      assert.strictEqual(
        stringifyDocument(document(null, { comment: " tail" }), StringifyOptionsInput.make({ finalNewline: false })),
        "# tail"
      );
    })
  );
});

describe("stringifier remaining presentation edges", () => {
  it.effect("keeps explicit leading blank comments, empty values and canonical flow collections", () =>
    Effect.sync(() => {
      const key = scalar(Str.repeat(1025)("k"));
      for (const value of [
        scalar(null, { length: 0, commentBefore: "\n lead\n" }),
        scalar("a\nb\n\n", { style: "block-literal", commentBefore: "\n lead\n" }),
      ]) {
        const text = stringifyDocument(document(map(key, value)));
        assert.deepStrictEqual(parse(text), { [Str.repeat(1025)("k")]: value.toValue() });
        assert.include(text, "# lead");
      }
      const seq = YamlSeq.make({
        items: [scalar("a\nb\n\n", { style: "block-literal" })],
        style: "block",
        offset: 0,
        length: 1,
      });
      assert.deepStrictEqual(parse(stringifyDocument(document(map(key, seq)))), {
        [Str.repeat(1025)("k")]: ["a\nb\n\n"],
      });
      const empty = scalar(null, { length: 0, commentBefore: " lead" });
      assert.include(stringifyDocument(document(map(scalar("key"), empty))), "# lead");
      const quoted = scalar("a\nb", { commentBefore: " lead" });
      assert.deepStrictEqual(
        parse(
          stringifyDocument(
            document(map(scalar("key"), quoted)),
            StringifyOptionsInput.make({ forceDefaultStyles: true })
          )
        ),
        { key: "a\nb" }
      );
      const flowNull = map(scalar("key", { commentBefore: " lead" }), null, { style: "flow" });
      assert.deepStrictEqual(parse(stringifyDocument(document(flowNull))), { key: null });
      const flow = map(scalar("key"), scalar("value"), { style: "flow" });
      const wrapper = map(scalar("outer"), flow);
      assert.deepStrictEqual(
        parse(
          stringifyDocument(
            document(wrapper),
            StringifyOptionsInput.make({ forceDefaultStyles: true, defaultCollectionStyle: "flow" })
          )
        ),
        { outer: { key: "value" } }
      );
      assert.strictEqual(
        stringifyDocument(document(null), StringifyOptionsInput.make({ finalNewline: false })),
        "null"
      );
      for (const contents of [
        scalar(null, { length: 0, anchor: "empty", commentBefore: " lead" }),
        scalar("leaf", { anchor: "a", commentBefore: " lead" }),
      ]) {
        assert.include(
          stringifyDocument(
            document(contents, { hasDocumentStart: true }),
            StringifyOptionsInput.make({ finalNewline: false })
          ),
          "# lead"
        );
      }
      assert.strictEqual(
        stringifyDocument(document(scalar("leaf"), { commentBefore: " heading" })),
        "# heading\nleaf\n"
      );
    })
  );
});

describe("stringifier explicit compact and leading flow comments", () => {
  it.effect("places compact collection comments on a single-line explicit key", () =>
    Effect.sync(() => {
      const key = YamlSeq.make({ items: [scalar("key")], style: "flow", offset: 0, length: 1 });
      const value = YamlSeq.make({ items: [scalar(1), scalar(2)], style: "block", offset: 0, length: 1 });
      const text = stringifyDocument(document(map(key, value)));
      assert.strictEqual(text, "? [key]\n: - 1\n  - 2\n");
      const flow = map(scalar("key"), scalar("value", { comment: " tail" }), {
        style: "flow",
        commentBefore: " leading",
      });
      const output = stringifyDocument(document(map(scalar("outer"), flow)));
      assert.deepStrictEqual(parse(output), { outer: { key: "value" } });
      assert.include(output, "# leading");
    })
  );
});

it.effect("keeps one-pair block map values nested beneath explicit newline keys", () =>
  Effect.sync(() => {
    for (const key of ["a", "", "x y"]) {
      const value = [{ "\n": { [key]: [] } }];
      const input = stringifyValue(value);
      for (const forceDefaultStyles of [false, true]) {
        const options = StringifyOptionsInput.make({ forceDefaultStyles });
        const rendered = stringifyDocument(composeFirstDocument(input), options);
        assert.deepStrictEqual(parse(rendered), value);
        assert.deepStrictEqual(composeFirstDocument(rendered).contents?.toValue(), value);
        assert.strictEqual(stringifyDocument(composeFirstDocument(rendered), options), rendered);
      }
    }
  })
);
