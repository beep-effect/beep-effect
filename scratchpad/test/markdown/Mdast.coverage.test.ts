import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Markdown, MarkdownParseOptions } from "../../effected/markdown/Markdown.ts";
import { Code, Root } from "../../effected/markdown/MarkdownNode.ts";
import { Mdast, MdastDecodeError } from "../../effected/markdown/Mdast.ts";

const element = (attributes: ReadonlyArray<unknown>) => ({ type: "root", children: [{ type: "mdxJsxFlowElement", name: "Box", attributes, children: [] }] });

describe("Mdast boundary coverage", () => {
  it.effect("reports a stable message with the structured issue", () => Effect.gen(function* () {
    const error = yield* Effect.flip(Mdast.fromMdast({ type: "root", children: [{ type: "text", value: 1 }] }));
    assert.strictEqual(error.message, "mdast input failed to decode into markdown nodes");
    assert.ok(error.issue);
    assert.ok(S.is(MdastDecodeError)(error));
  }));
  it.effect("rejects malformed attributes through the typed channel", () => Effect.gen(function* () {
    for (const attribute of [null, [], 1, {}, { type: 1 }, { type: "unknown" }, { type: "mdxJsxAttribute", name: "x", value: { type: "wrong" } }]) {
      assert.strictEqual((yield* Effect.flip(Mdast.fromMdast(element([attribute]))))._tag, "MdastDecodeError");
    }
  }));
  it.effect("admits absent, null, string, expression and spread attributes", () => Effect.gen(function* () {
    const root = yield* Mdast.fromMdast(element([
      { type: "mdxJsxAttribute", name: "bare" },
      { type: "mdxJsxAttribute", name: "nil", value: null },
      { type: "mdxJsxAttribute", name: "text", value: "literal" },
      { type: "mdxJsxAttribute", name: "expression", value: { type: "mdxJsxAttributeValueExpression", value: "x + 1" } },
      { type: "mdxJsxExpressionAttribute", value: "...props" },
    ]));
    const projected = Mdast.toMdast(root);
    assert.deepStrictEqual(Mdast.toMdast(yield* Mdast.fromMdast(projected)), projected);
    const child = root.children[0];
    assert.strictEqual(child?.type, "mdxJsxFlowElement");
    if (child?.type === "mdxJsxFlowElement") {
      assert.strictEqual(child.attributes.length, 5);
      assert.strictEqual(child.attributes[0]?.position.start.offset, 0);
    }
  }));
  it.effect("synthesizes incomplete positions and rejects malformed JSX fields", () => Effect.gen(function* () {
    for (const position of [null, {}, { start: {} }, { start: { line: 1, column: 1 }, end: {} }, { start: { line: 1, column: 1, offset: 0 }, end: {} }]) {
      const root = yield* Mdast.fromMdast({ type: "root", children: [], position });
      assert.strictEqual(root.position.end.offset, 0);
    }
    for (const fields of [{ attributes: {} }, { children: "bad" }, { name: 42 }]) {
      assert.strictEqual((yield* Effect.flip(Mdast.fromMdast({ type: "root", children: [{ type: "mdxJsxTextElement", name: null, attributes: [], children: [], ...fields }] })))._tag, "MdastDecodeError");
    }
  }));
});

it.effect("projects optional list, table, reference and code fields canonically", () => Effect.gen(function* () {
  const root = yield* Mdast.fromMdast({ type: "root", children: [
    { type: "list", children: [
      { type: "listItem", children: [], position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } } },
      { type: "listItem", children: [], position: { start: { line: 3, column: 1, offset: 0 }, end: { line: 3, column: 1, offset: 0 } } },
    ] },
    { type: "table", children: [] },
    { type: "code", value: "unterminated" },
    { type: "paragraph", children: [
      { type: "linkReference", identifier: "id", referenceType: "full", children: [] },
      { type: "imageReference", identifier: "id", referenceType: "full" },
    ] },
  ] });
  assert.deepStrictEqual(Mdast.toMdast(yield* Mdast.fromMdast(Mdast.toMdast(root))), Mdast.toMdast(root));
  assert.strictEqual(root.children.length, 4);
}));


it.effect("projects schema-valid unterminated code values without altering content", () => Effect.gen(function* () {
  for (const value of ["no terminator", "line\n", "line\r\n"]) {
    const root = Root.make({ children: [Code.make({ value })] });
    const projected = Mdast.toMdast(root);
    const read = yield* Mdast.fromMdast(projected);
    assert.deepStrictEqual(Mdast.toMdast(read), projected);
  }
  for (const value of [() => 1, null, [], 1, { type: 1 }]) {
    const error = yield* Effect.flip(Mdast.fromMdast(value));
    assert.strictEqual(error._tag, "MdastDecodeError");
  }
}));

it.effect("projects every dialect's flow and phrasing forms and literal frontmatter", () => Effect.gen(function* () {
  const source = "# heading\n\n> *em* **strong** ~~deleted~~ `code` <b>x</b>  \n> next\n\n- one\n- two\n\n```js meta\ncode\n```\n\n![alt](./image \"title\") [link](./url \"title\") ![ref][id] [ref][id] [^note]\n\n[id]: ./target \"title\"\n\n[^note]: note\n\n| a | b |\n| :--- | ---: |\n| c | d |\n\n---\n";
  const root = yield* Markdown.parse(source);
  const plain = Mdast.toMdast(root);
  assert.deepStrictEqual(Mdast.toMdast(yield* Mdast.fromMdast(plain)), plain);
  for (const [type, fence] of [["yaml", "---"], ["toml", "+++"], ["json", "---json"]] as const) {
    const parsed = yield* Markdown.parse(`${fence}\nvalue\n${type === "json" ? "---" : fence}\n`, MarkdownParseOptions.make({ frontmatter: true }));
    assert.deepStrictEqual(Mdast.toMdast(yield* Mdast.fromMdast(Mdast.toMdast(parsed))), Mdast.toMdast(parsed));
    assert.strictEqual(parsed.children[0]?.type === "frontmatter" ? parsed.children[0].format : undefined, type);
  }
  const foreign = yield* Mdast.fromMdast({ type: "root", children: [
    { type: "mdxFlowExpression", value: "a" }, { type: "mdxjsEsm", value: "export const a = 1" },
    { type: "paragraph", children: [{ type: "mdxTextExpression", value: "b" }] },
    { type: "code", value: "carriage\r" },
  ] });
  assert.deepStrictEqual(Mdast.toMdast(yield* Mdast.fromMdast(Mdast.toMdast(foreign))), Mdast.toMdast(foreign));
  assert.strictEqual((yield* Effect.flip(Mdast.fromMdast({ type: "root", children: [{ type: "unknown" }] })))._tag, "MdastDecodeError");
}));

it.effect("projects absent link titles and image titles and alt text to mdast defaults", () => Effect.gen(function* () {
  const root = yield* Mdast.fromMdast({ type: "root", children: [{ type: "paragraph", children: [
    { type: "link", url: "./target", children: [] }, { type: "image", url: "./image" },
  ] }] });
  const plain = Mdast.toMdast(root);
  const defaults = yield* S.decodeUnknownEffect(S.Struct({ children: S.Tuple([S.Struct({ children: S.Tuple([
    S.Struct({ title: S.Null }), S.Struct({ title: S.Null, alt: S.String }),
  ]) })]) }))(plain);
  assert.strictEqual(defaults.children[0].children[1].alt, "");
  assert.deepStrictEqual(Mdast.toMdast(yield* Mdast.fromMdast(plain)), plain);
}));
