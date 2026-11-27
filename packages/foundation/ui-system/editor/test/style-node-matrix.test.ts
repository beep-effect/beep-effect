import { editorNodes } from "@beep/editor/nodes";
import {
  LexicalNode,
  SerializedEditorState,
  TextFormatBits,
  TextFormatMask,
  withTextFormat,
} from "@beep/lexical-schema";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { $createCodeNode } from "@lexical/code";
import { createHeadlessEditor } from "@lexical/headless";
import { $createLinkNode } from "@lexical/link";
import { $createListItemNode, $createListNode } from "@lexical/list";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $createTableCellNode, $createTableNode, $createTableRowNode, TableCellHeaderStates } from "@lexical/table";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";

const decodeUnknownSerializedEditorState = S.decodeUnknownEffect(SerializedEditorState);

const SCHEMA_MARKS = [
  { name: "bold", bit: TextFormatBits.bold },
  { name: "italic", bit: TextFormatBits.italic },
  { name: "underline", bit: TextFormatBits.underline },
  { name: "strikethrough", bit: TextFormatBits.strikethrough },
  { name: "code", bit: TextFormatBits.code },
] as const;

const MARK_POWER_SET = A.makeBy(32, (index) => {
  const active = A.filter(SCHEMA_MARKS, (_, i) => (index & (1 << i)) !== 0);
  return {
    label: A.match(active, {
      onEmpty: () => "none",
      onNonEmpty: (marks) =>
        A.join(
          A.map(marks, (mark) => mark.name),
          "+"
        ),
    }),
    mask: A.reduce(active, TextFormatMask.make(0), (acc, mark) => withTextFormat(acc, mark.bit)),
  };
});

const CONTENT = "Sample";

const makeFormattedLeaf = (mask: TextFormatMask) => $createTextNode(CONTENT).setFormat(mask);

type NodeContext = {
  readonly key: string;
  readonly appendInUpdate: (mask: TextFormatMask) => void;
};

const NODE_CONTEXTS: ReadonlyArray<NodeContext> = [
  {
    key: "paragraph",
    appendInUpdate: (mask) => void $getRoot().append($createParagraphNode().append(makeFormattedLeaf(mask))),
  },
  {
    key: "heading-h1",
    appendInUpdate: (mask) => void $getRoot().append($createHeadingNode("h1").append(makeFormattedLeaf(mask))),
  },
  {
    key: "heading-h2",
    appendInUpdate: (mask) => void $getRoot().append($createHeadingNode("h2").append(makeFormattedLeaf(mask))),
  },
  {
    key: "heading-h3",
    appendInUpdate: (mask) => void $getRoot().append($createHeadingNode("h3").append(makeFormattedLeaf(mask))),
  },
  {
    key: "quote",
    appendInUpdate: (mask) => void $getRoot().append($createQuoteNode().append(makeFormattedLeaf(mask))),
  },
  {
    key: "list-bullet",
    appendInUpdate: (mask) =>
      void $getRoot().append($createListNode("bullet").append($createListItemNode().append(makeFormattedLeaf(mask)))),
  },
  {
    key: "list-number",
    appendInUpdate: (mask) =>
      void $getRoot().append($createListNode("number").append($createListItemNode().append(makeFormattedLeaf(mask)))),
  },
  {
    key: "list-check",
    appendInUpdate: (mask) =>
      void $getRoot().append(
        $createListNode("check").append($createListItemNode(true).append(makeFormattedLeaf(mask)))
      ),
  },
  { key: "code", appendInUpdate: (mask) => void $getRoot().append($createCodeNode().append(makeFormattedLeaf(mask))) },
  {
    key: "link",
    appendInUpdate: (mask) =>
      void $getRoot().append(
        $createParagraphNode().append($createLinkNode("https://example.com").append(makeFormattedLeaf(mask)))
      ),
  },
  {
    key: "table",
    appendInUpdate: (mask) =>
      void $getRoot().append(
        $createTableNode().append(
          $createTableRowNode().append(
            $createTableCellNode(TableCellHeaderStates.NO_STATUS).append(
              $createParagraphNode().append(makeFormattedLeaf(mask))
            )
          )
        )
      ),
  },
];

const collectLeafFormatsDepthFirst: (node: LexicalNode) => ReadonlyArray<number> = LexicalNode.match({
  text: (node) => [node.format],
  tab: () => [],
  linebreak: () => [],
  "artifact-ref": () => [],
  youtube: () => [],
  root: (node) => A.flatMap(node.children, collectLeafFormatsDepthFirst),
  paragraph: (node) => A.flatMap(node.children, collectLeafFormatsDepthFirst),
  heading: (node) => A.flatMap(node.children, collectLeafFormatsDepthFirst),
  quote: (node) => A.flatMap(node.children, collectLeafFormatsDepthFirst),
  list: (node) => A.flatMap(node.children, collectLeafFormatsDepthFirst),
  listitem: (node) => A.flatMap(node.children, collectLeafFormatsDepthFirst),
  link: (node) => A.flatMap(node.children, collectLeafFormatsDepthFirst),
  code: (node) => A.flatMap(node.children, collectLeafFormatsDepthFirst),
  table: (node) => A.flatMap(node.children, collectLeafFormatsDepthFirst),
  tablerow: (node) => A.flatMap(node.children, collectLeafFormatsDepthFirst),
  tablecell: (node) => A.flatMap(node.children, collectLeafFormatsDepthFirst),
});

const newEditor = () =>
  createHeadlessEditor({
    namespace: "beep-editor-style-matrix",
    nodes: [...editorNodes],
    onError: (error) => {
      throw error;
    },
  });

describe("@beep/editor style × node matrix", () => {
  for (const context of NODE_CONTEXTS) {
    describe(context.key, () => {
      for (const combo of MARK_POWER_SET) {
        it.effect(`preserves ${combo.label} through schema decoding and Lexical round trips`, () =>
          Effect.gen(function* () {
            const editor = newEditor();
            editor.update(() => context.appendInUpdate(combo.mask), { discrete: true });
            const wire = editor.getEditorState().toJSON();

            const decoded = yield* decodeUnknownSerializedEditorState(wire);

            expect(
              collectLeafFormatsDepthFirst(decoded.root),
              "Every context must retain exactly one text leaf with the case's exact schema mark mask."
            ).toEqual([combo.mask]);

            const reimported = newEditor();
            reimported.setEditorState(reimported.parseEditorState(wire));
            expect(
              reimported.getEditorState().toJSON(),
              "Lexical export/import/export must preserve the node structure and every text format bitmask."
            ).toEqual(wire);
          })
        );
      }
    });
  }
});
