import { $selectionBlockType } from "@beep/editor/chat/toolbar";
import { editorNodes } from "@beep/editor/nodes";
import { $createCodeNode } from "@lexical/code";
import { createHeadlessEditor } from "@lexical/headless";
import { $createListItemNode, $createListNode } from "@lexical/list";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $createTableCellNode, $createTableNode, $createTableRowNode, TableCellHeaderStates } from "@lexical/table";
import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";
import { describe, expect, it } from "vitest";
import type { BlockType } from "@beep/editor/chat/toolbar";
import type { ElementNode, LexicalEditor, TextNode } from "lexical";

interface SelectedBlock {
  readonly block: ElementNode;
  readonly text: TextNode;
}

const makeEditor = (): LexicalEditor =>
  createHeadlessEditor({
    namespace: "table-toolbar-selection",
    nodes: [...editorNodes],
    onError: (error) => {
      throw error;
    },
  });

const selected = (block: ElementNode, text: TextNode): SelectedBlock => ({ block, text });

const classify = (insideTable: boolean, build: () => SelectedBlock): BlockType => {
  const editor = makeEditor();
  let blockType: BlockType = "paragraph";
  editor.update(
    () => {
      const { block, text } = build();
      if (insideTable) {
        const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS).append(block);
        $getRoot()
          .clear()
          .append($createTableNode().append($createTableRowNode().append(cell)));
      } else {
        $getRoot().clear().append(block);
      }
      text.selectEnd();
      blockType = $selectionBlockType();
    },
    { discrete: true }
  );
  return blockType;
};

const paragraph = (): SelectedBlock => {
  const text = $createTextNode("paragraph");
  return selected($createParagraphNode().append(text), text);
};

const heading = (): SelectedBlock => {
  const text = $createTextNode("heading");
  return selected($createHeadingNode("h2").append(text), text);
};

const quote = (): SelectedBlock => {
  const text = $createTextNode("quote");
  return selected($createQuoteNode().append(text), text);
};

const code = (): SelectedBlock => {
  const text = $createTextNode("code");
  return selected($createCodeNode().append(text), text);
};

const bulletList = (): SelectedBlock => {
  const text = $createTextNode("list");
  return selected($createListNode("bullet").append($createListItemNode().append(text)), text);
};

describe("toolbar block classification with real Lexical selections", () => {
  it.each([
    ["paragraph", paragraph, "paragraph"],
    ["heading", heading, "h2"],
    ["quote", quote, "quote"],
    ["code", code, "code"],
    ["list", bulletList, "bullet"],
  ] as const)("classifies %s inside a table cell", (_label, build, expected) => {
    expect(classify(true, build)).toBe(expected);
  });

  it("classifies an ordinary paragraph outside a table", () => {
    expect(classify(false, paragraph)).toBe("paragraph");
  });

  it("chooses the nearest supported ancestor before the table-cell boundary", () => {
    expect(
      classify(true, () => {
        const text = $createTextNode("nearest");
        const nestedHeading = $createHeadingNode("h3").append(text);
        return selected($createQuoteNode().append(nestedHeading), text);
      })
    ).toBe("h3");
  });
});
