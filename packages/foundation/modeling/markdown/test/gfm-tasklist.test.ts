// decision: tasklist-reproduces-cmark-gfm-quirks

import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { offsetOf } from "./support/offsets.ts";
import type { MdxjsEsm } from "@beep/markdown/MarkdownMdx";
import type { FlowContent, Frontmatter, ListItem, Text } from "@beep/markdown/MarkdownNode";

const itemsOf = (source: string, dialect: "commonmark" | "gfm" = "gfm"): ReadonlyArray<ListItem> => {
  const found: ListItem[] = [];
  const walk = (nodes: ReadonlyArray<Frontmatter | MdxjsEsm | FlowContent>): void => {
    for (const node of nodes) {
      if (node.type === "list") {
        for (const item of node.children) {
          found.push(item);
          walk(item.children);
        }
      } else if (node.type === "blockquote") {
        walk(node.children);
      }
    }
  };
  walk(parseBlocks(source, { dialect: dialect }).root.children);
  return found;
};

const firstItem = (source: string, dialect: "commonmark" | "gfm" = "gfm"): ListItem => {
  const item = itemsOf(source, dialect)[0];
  assert.isDefined(item, "expected the source to parse as a list item");
  return item;
};

const firstText = (item: ListItem): Text | undefined => {
  const paragraph = item.children[0];
  if (paragraph?.type !== "paragraph") {
    return undefined;
  }
  const text = paragraph.children[0];
  return text?.type === "text" ? text : undefined;
};

const textOf = (item: ListItem): string => firstText(item)?.value ?? "";

describe("gfm task-list items", () => {
  describe("the marker sets checked", () => {
    it("reads an unchecked marker as false", () => {
      assert.strictEqual(firstItem("- [ ] foo").checked, false);
    });

    it("reads a lowercase checked marker as true", () => {
      assert.strictEqual(firstItem("- [x] foo").checked, true);
    });

    it("reads an uppercase checked marker as true", () => {
      assert.strictEqual(
        firstItem("- [X] foo").checked,
        true,
        "the generated scanner accepts ` `, `x` AND `X` though ext_scanners.re lists only the first two; tasklist.c tests both cases"
      );
    });

    it("reads a marker on an ordered item", () => {
      assert.strictEqual(firstItem("1. [x] foo").checked, true);
    });

    it("reads a marker on a deeper bullet character", () => {
      assert.strictEqual(firstItem("* [ ] foo").checked, false);
      assert.strictEqual(firstItem("+ [x] foo").checked, true);
    });
  });

  describe("checked is genuinely absent on a plain item", () => {
    it("leaves no key at all when there is no marker", () => {
      const item = firstItem("- foo");
      assert.isFalse(P.hasProperty(item, "checked"));
    });

    it("leaves no key when the bracket content is not a task marker", () => {
      const item = firstItem("- [@] foo");
      assert.isFalse(P.hasProperty(item, "checked"));
      assert.strictEqual(textOf(item), "[@] foo");
    });
  });

  describe("the marker grammar", () => {
    it("requires whitespace after the closing bracket", () => {
      const item = firstItem("- [x]foo");
      assert.isFalse(P.hasProperty(item, "checked"));
      assert.strictEqual(textOf(item), "[x]foo");
    });

    it("does not match a marker that ends the line", () => {
      const item = firstItem("- [x]");
      assert.isFalse(
        P.hasProperty(item, "checked"),
        "`spacechar+` is required after `]`, and the line terminator is not a `spacechar`"
      );
      assert.strictEqual(textOf(item), "[x]");
    });

    it("matches a marker followed by whitespace and nothing else", () => {
      const item = firstItem("- [ ] ");
      assert.strictEqual(item.checked, false);
      assert.deepStrictEqual([...item.children], []);
    });

    it("requires exactly one character between the brackets", () => {
      assert.isFalse(P.hasProperty(firstItem("- [xx] foo"), "checked"));
      assert.isFalse(P.hasProperty(firstItem("- [] foo"), "checked"));
    });

    it("does not match a marker that is not the item's first content", () => {
      const item = firstItem("- foo [x] bar");
      assert.isFalse(P.hasProperty(item, "checked"));
      assert.strictEqual(textOf(item), "foo [x] bar");
    });

    it("does not match a marker on a continuation line", () => {
      const item = firstItem("- foo\n  [x] bar");
      assert.isFalse(P.hasProperty(item, "checked"));
    });

    it("does not match a marker outside a list", () => {
      const source = "[x] foo";
      const block = parseBlocks(source, { dialect: "gfm" }).root.children[0];
      assert.strictEqual(block?.type, "paragraph");
    });
  });

  describe("the scan runs over the raw line from column zero", () => {
    it("does not match inside a blockquote", () => {
      const item = firstItem("> - [x] foo");
      assert.isFalse(
        P.hasProperty(item, "checked"),
        "`_scan_tasklist` runs at offset 0 of the whole line, so a `>` prefix never looks like a task item to cmark-gfm"
      );
      assert.strictEqual(textOf(item), "[x] foo");
    });

    it("does not match a nested item opened on the same line", () => {
      const items = itemsOf("- - [x] foo");
      assert.strictEqual(items.length, 2);
      for (const item of items) {
        assert.isFalse(
          P.hasProperty(item, "checked"),
          "a second list marker between column zero and the bracket is not admitted by the scanner's grammar"
        );
      }
    });

    it("matches a nested item opened on its own line", () => {
      const items = itemsOf("- [x] foo\n  - [ ] bar\n  - [X] baz\n- [ ] bim");
      assert.deepStrictEqual(
        A.map(items, (item) => item.checked),
        [true, false, true, false]
      );
    });

    it("matches an item indented by up to three spaces", () => {
      assert.strictEqual(firstItem("   - [x] foo").checked, true);
    });
  });

  describe("the checked state comes from a whole-line scan", () => {
    it("preserves cmark-gfm's whole-line search for a checked marker", () => {
      const item = firstItem("- [ ] foo [x]");
      assert.strictEqual(
        item.checked,
        true,
        "tasklist.c sets checked with strstr over the ENTIRE line, so a later [x] checks the box: an upstream quirk reproduced on purpose"
      );
      assert.strictEqual(textOf(item), "foo [x]");
    });
  });

  describe("the consumed marker", () => {
    it("removes the marker from the item's content", () => {
      assert.strictEqual(textOf(firstItem("- [x] foo")), "foo");
    });

    it("leaves the first text node positioned on the source it came from", () => {
      const source = "- [x] foo";
      const text = firstText(firstItem(source));
      assert.isDefined(text);
      assert.strictEqual(text.value, "foo");
      assert.strictEqual(text.position.start.offset, offsetOf(source, "foo"));
      assert.strictEqual(text.position.end.offset, source.length);
      assert.strictEqual(text.position.start.column, offsetOf(source, "foo") + 1);
    });

    it("keeps offsets right for a nested task item on a later line", () => {
      const source = "- [x] foo\n  - [ ] bar\n";
      const inner = itemsOf(source)[1];
      assert.isDefined(inner);
      const text = firstText(inner);
      assert.isDefined(text);
      assert.strictEqual(text.value, "bar");
      assert.strictEqual(text.position.start.offset, offsetOf(source, "bar"));
      assert.strictEqual(text.position.start.line, 2);
    });

    it("stops the block-start scan the way cmark-gfm's break does", () => {
      const item = firstItem("- [x] # foo");
      assert.strictEqual(item.checked, true);
      assert.strictEqual(
        item.children[0]?.type,
        "paragraph",
        "open_tasklist_item returns NULL and open_new_blocks breaks on it, so nothing after a task marker opens another block on that line"
      );
      assert.strictEqual(textOf(item), "# foo");
    });
  });

  describe("the commonmark dialect", () => {
    it("never forms a task item", () => {
      for (const source of ["- [ ] foo", "- [x] foo", "- [X] foo"]) {
        const item = firstItem(source, "commonmark");
        assert.isFalse(P.hasProperty(item, "checked"));
      }
    });

    it("keeps the marker as literal text", () => {
      const source = "- [x] foo";
      const text = firstText(firstItem(source, "commonmark"));
      assert.isDefined(text);
      assert.strictEqual(text.value, "[x] foo");
      assert.strictEqual(text.position.start.offset, offsetOf(source, "[x]"));
    });
  });

  describe("interaction with other gfm constructs", () => {
    it("leaves a marker inside a table cell as literal text", () => {
      const source = "| a |\n| - |\n| [x] b |\n";
      const table = O.getOrThrow(
        A.findFirst(parseBlocks(source, { dialect: "gfm" }).root.children, (child) => child.type === "table")
      );
      const cell = table.children[1]?.children[0];
      assert.isDefined(cell);
      const text = cell.children[0];
      assert.strictEqual(text?.type === "text" ? text.value : undefined, "[x] b");
    });
  });
});
