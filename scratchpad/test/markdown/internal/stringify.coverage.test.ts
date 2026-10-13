import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as N from "../../../effected/markdown/MarkdownNode.ts";
import { stringifyTree } from "../../../effected/markdown/internal/stringify.ts";
const text = (value: string) => N.Text.make({ value });
const literal = (value: string) => N.Text.make({ value, escapeStyle: "literal" });
const para = (...children: N.Paragraph["children"]) => N.Paragraph.make({ children });
const emit = (...children: N.Root["children"]) => stringifyTree(N.Root.make({ children }));
const tight = (...children: N.ListItem["children"]) => N.List.make({ children: [N.ListItem.make({ children })] });
describe("stringify coverage regressions", () => {
  it.effect("literal leading spaces and sibling newlines retain safe spelling", () => Effect.sync(() => {
    assert.strictEqual(emit(para(text(" space"))), "&#32;space\n");
    assert.strictEqual(emit(para(literal("\tvalue"))), "&#9;value\n");
    assert.strictEqual(emit(para(literal(" space"))), "&#32;space\n");
    assert.strictEqual(emit(para(literal("#"), literal(" title\nnext"))), "\\# title\nnext\n");
    assert.strictEqual(emit(para(literal("---\nnext"))), "\\---\nnext\n");
    assert.strictEqual(emit(para(literal("####### x"))), "####### x\n");
  }));
  it.effect("single-line breaks and intraword underscore emphasis stay representable", () => Effect.sync(() => {
    assert.strictEqual(emit(N.Heading.make({ depth: 1, children: [text("a"), N.Break.make({}), text("b")] })), "# a b\n");
    assert.strictEqual(emit(para(text("a"), N.Emphasis.make({ markerChar: "_", children: [text("b")] }))), "a*b*\n");
    assert.strictEqual(emit(para(N.Emphasis.make({ markerChar: "_", children: [N.Strong.make({ children: [text("b")] })] }))), "___b___\n");
    assert.strictEqual(emit(para(N.Strong.make({ children: [N.Strong.make({ children: [text("b")] })] }))), "****b****\n");
  }));
  it.effect("reference identifier fallbacks and image alt escaping are observable", () => Effect.sync(() => {
    assert.strictEqual(emit(para(N.LinkReference.make({ identifier: "id", referenceType: "shortcut", children: [] }))), "[id]\n");
    assert.strictEqual(emit(para(N.ImageReference.make({ identifier: "id", referenceType: "full", alt: "[a]\\" }))), "![\\[a\\]\\\\][id]\n");
    assert.strictEqual(emit(para(N.ImageReference.make({ identifier: "id", referenceType: "full" }))), "![][id]\n");
  }));
  it.effect("empty and ragged tables produce explicit empty cells", () => Effect.sync(() => {
    assert.strictEqual(emit(N.Table.make({ children: [] })), "|  |\n| --- |\n");
    const cell = N.TableCell.make({ children: [text("x")] });
    assert.strictEqual(emit(N.Table.make({ children: [N.TableRow.make({ children: [cell, cell] }), N.TableRow.make({ children: [cell] })] })), "| x | x |\n| --- | --- |\n| x |  |\n");
  }));
  it.effect("empty frontmatter and code-first footnotes preserve delimiters and blank lines", () => Effect.sync(() => {
    assert.strictEqual(emit(N.Frontmatter.make({ format: "yaml", value: "" })), "---\n---\n");
    assert.strictEqual(emit(N.FootnoteDefinition.make({ identifier: "id", children: [N.Code.make({ value: "a\n\nb" })] })), "[^id]:\n        a\n\n        b\n");
  }));
  it.effect("adjacent list delimiters flip in both directions", () => Effect.sync(() => {
    const children = [N.ListItem.make({ children: [para(text("x"))] })];
    assert.strictEqual(emit(N.List.make({ ordered: true, delimiter: ")", children }), N.List.make({ ordered: true, delimiter: ")", children })), "1) x\n\n1. x\n");
    assert.strictEqual(emit(N.List.make({ bulletChar: "*", children }), N.List.make({ bulletChar: "*", children })), "* x\n\n- x\n");
  }));
  it.effect("tight synthesized multi-block items use a blank only when needed", () => Effect.sync(() => {
    const p = para(text("p"));
    const heading = N.Heading.make({ depth: 1, children: [text("h")] });
    const setext = N.Heading.make({ depth: 2, headingStyle: "setext", children: [text("h")] });
    const code = N.Code.make({ value: "c" });
    const fence = N.Code.make({ value: "c", fenceChar: "`" });
    const lang = N.Code.make({ value: "c", lang: "ts" });
    const list = N.List.make({ children: [N.ListItem.make({ children: [p] })], ordered: true });
    const pairs: ReadonlyArray<readonly [N.FlowContent, N.FlowContent, string]> = [
      [p, setext, "- p\n\n  h\n  -\n"],
      [p, heading, "- p\n  # h\n"],
      [p, list, "- p\n  1. p\n"],
      [p, N.List.make({ children: list.children, ordered: true, start: 2 }), "- p\n\n  2. p\n"],
      [p, code, "- p\n\n      c\n"],
      [p, lang, "- p\n  ```ts\n  c\n  ```\n"],
      [p, para(text("q")), "- p\n\n  q\n"],
      [N.ThematicBreak.make({}), p, "- ***\n  p\n"],
      [fence, p, "- ```\n  c\n  ```\n  p\n"],
      [lang, p, "- ```ts\n  c\n  ```\n  p\n"],
      [code, p, "-     c\n  p\n"],
      [code, code, "-     c\n\n      c\n"],
      [code, lang, "-     c\n  ```ts\n  c\n  ```\n"],
      [N.Html.make({ value: "<hr>" }), p, "- <hr>\n\n  p\n"],
    ];
    for (const [first, second, expected] of pairs) assert.strictEqual(emit(tight(first, second)), expected);
  }));
});
