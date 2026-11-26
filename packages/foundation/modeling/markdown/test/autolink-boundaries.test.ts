import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { appendChild, childrenOf, makeInlineNode } from "@beep/markdown/internal/inlineNode";
import { linkifyEmails } from "@beep/markdown/internal/inlines/autolinkLiteral";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { childOfType } from "./support/tree.ts";

describe("email autolink source boundaries", () => {
  it.each(["a\\@b.co", "a@b\\.co", "a\\@b\\.co", "a\\_b@c.de", "a@b.co\\.uk"])(
    "keeps an escaped email literal: %s",
    (source) => {
      const paragraph = childOfType(parseBlocks(source, { dialect: "gfm" }).root.children, 0, "paragraph");
      assert.isFalse(A.some(paragraph.children, (node) => node.type === "link"));
    }
  );

  it.each(["http://x\\.y", "https://x.y/a\\_b", "www.x\\.y"])("decodes a URL escape: %s", (source) => {
    const paragraph = childOfType(parseBlocks(source, { dialect: "gfm" }).root.children, 0, "paragraph");
    const link = childOfType(paragraph.children, 0, "link");
    const decoded = Str.replace(/\\([!-/:-@[-`{-~])/g, "$1")(source);
    assert.strictEqual(link.url, Str.startsWith("www.")(source) ? `http://${decoded}` : decoded);
    assert.strictEqual(childOfType(link.children, 0, "text").value, source);
    assert.strictEqual(link.position.end.offset, source.length);
  });

  it.each([
    ["&amp;", "&"],
    ["\\!", "!"],
    ["&#33;", "!"],
    ["&NotEqualTilde;", "≂̸"],
  ])("starts an email after the complete decoded prefix %s", (prefix, decoded) => {
    const source = `${prefix}a@b.com`;
    const paragraph = childOfType(parseBlocks(source, { dialect: "gfm" }).root.children, 0, "paragraph");
    const text = childOfType(paragraph.children, 0, "text");
    assert.strictEqual(text.value, decoded);
    assert.strictEqual(text.position.start.offset, 0);
    assert.strictEqual(text.position.end.offset, prefix.length);
    const link = childOfType(paragraph.children, 1, "link");
    assert.strictEqual(link.position.start.offset, prefix.length);
    assert.strictEqual(link.position.end.offset, source.length);
    assert.strictEqual(link.url, "mailto:a@b.com");
    const label = childOfType(link.children, 0, "text");
    assert.strictEqual(label.position.start.offset, prefix.length);
    assert.strictEqual(label.position.end.offset, source.length);
  });

  it("maps an email ending in a decoded piece to that piece's source end", () => {
    const source = "a@b.co&#109;";
    const [paragraph] = parseBlocks(source, { dialect: "gfm" }).root.children;
    assert.strictEqual(paragraph?.type, "paragraph");
    if (paragraph?.type !== "paragraph") return;
    const [link] = paragraph.children;
    assert.strictEqual(link?.type, "link");
    assert.strictEqual(link?.position.start.offset, 0);
    assert.strictEqual(link?.position.end.offset, source.length);
    if (link?.type !== "link") return;
    assert.strictEqual(link.url, "mailto:a@b.com");
    assert.strictEqual(link.children[0]?.position.end.offset, source.length);
  });

  it("keeps repeated boundaries ordered across decoded prefixes and several email pieces", () => {
    const source = "&amp;a_b@c.de \\!d_e@f.com &gt;g_h@i.net";
    const [paragraph] = parseBlocks(source, { dialect: "gfm" }).root.children;
    assert.strictEqual(paragraph?.type, "paragraph");
    if (paragraph?.type !== "paragraph") return;
    const links = A.filter(paragraph.children, (node) => node.type === "link");
    assert.strictEqual(links.length, 3);
    for (const [index, address] of A.map(
      ["a_b@c.de", "d_e@f.com", "g_h@i.net"],
      (address, index) => [index, address] as const
    )) {
      const link = links[index];
      const start = O.getOrElse(Str.indexOf(address)(source), () => -1);
      assert.strictEqual(link?.position.start.offset, start);
      assert.strictEqual(link?.position.end.offset, start + address.length);
      assert.strictEqual(link?.type === "link" ? link.url : "", `mailto:${address}`);
      assert.strictEqual(link?.type === "link" ? link.children[0]?.position.start.offset : -1, start);
    }
    const text = A.filter(paragraph.children, (node) => node.type === "text");
    assert.deepStrictEqual(
      A.map(text, (node) => [node.value, node.position.start.offset, node.position.end.offset]),
      [
        ["&", 0, 5],
        [" !", 13, 16],
        [" >", 25, 30],
      ]
    );
  });

  it.each([64, 128, 256])("recovers positions with linear original-piece reads for %i emails", (count) => {
    const root = makeInlineNode("emphasis", 0, count * 9);
    let reads = 0;
    for (let index = 0; index < count; index += 1) {
      let start = index * 9;
      for (const value of ["a", "_", "b@c.de "]) {
        const node = {
          ...makeInlineNode("text", start, start + value.length),
          get value() {
            reads += 1;
            return value;
          },
        };
        appendChild(root, node);
        start += value.length;
      }
    }
    linkifyEmails(root);
    const links = A.filter(childrenOf(root), (node) => node.type === "link");
    assert.strictEqual(links.length, count);
    for (let index = 0; index < count; index += 1) {
      assert.strictEqual(links[index]?.start, index * 9);
      assert.strictEqual(links[index]?.end, index * 9 + 8);
    }
    assert.isAtMost(
      reads,
      count * 20,
      "each piece is visited once as the boundary cursor advances, plus fixed reads per match and during initial concatenation"
    );
  });

  it("preserves the existing interior-index mapping within a decoded piece", () => {
    const root = makeInlineNode("emphasis", 0, 12);
    appendChild(root, makeInlineNode("text", 0, 6, "!a"));
    appendChild(root, makeInlineNode("text", 6, 12, "@b.com"));
    linkifyEmails(root);
    const [text, link] = childrenOf(root);
    assert.strictEqual(text?.end, 1);
    assert.strictEqual(link?.start, 1);
    assert.strictEqual(link?.end, 12);
    assert.strictEqual(link?.data.url, "mailto:a@b.com");
  });
});
