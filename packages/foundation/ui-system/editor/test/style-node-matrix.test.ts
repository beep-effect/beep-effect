import { editorNodes } from "@beep/editor";
import {
  LexicalNode,
  SerializedEditorState,
  TextFormatBits,
  TextFormatMask,
  withTextFormat,
} from "@beep/lexical-schema";
import { describe, expect, it } from "@effect/vitest";
import { $createCodeNode } from "@lexical/code";
import { createHeadlessEditor } from "@lexical/headless";
import { $createLinkNode } from "@lexical/link";
import { $createListItemNode, $createListNode } from "@lexical/list";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $createTableCellNode, $createTableNode, $createTableRowNode, TableCellHeaderStates } from "@lexical/table";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";

// The five inline marks under test. Bit values come from the schema package's
// TextFormatBits (the wire vocabulary's source of truth), never hand-rolled.
const MARKS = [
  { name: "bold", bit: TextFormatBits.bold },
  { name: "italic", bit: TextFormatBits.italic },
  { name: "underline", bit: TextFormatBits.underline },
  { name: "strikethrough", bit: TextFormatBits.strikethrough },
  { name: "code", bit: TextFormatBits.code },
] as const;

// The full 32-element power set of MARKS: index bit i selects MARKS[i], so the
// enumeration is exhaustive and each case is uniquely labeled for failure output.
const MARK_COMBOS = A.makeBy(32, (index) => {
  const active = A.filter(MARKS, (_, i) => (index & (1 << i)) !== 0);
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

// One formatted text leaf per case: setFormat takes the exact bitmask so the
// case's marks land verbatim on the node Lexical actually serializes.
const makeText = (mask: TextFormatMask) => $createTextNode(CONTENT).setFormat(mask);

type NodeContext = {
  readonly key: string;
  // Runs inside editor.update, appending the case's subtree onto the root.
  readonly build: (mask: TextFormatMask) => void;
};

// Each context wraps the formatted text leaf in a different block/inline
// container, exercising the mark set in every node position of the wire union.
const CONTEXTS: ReadonlyArray<NodeContext> = [
  { key: "paragraph", build: (mask) => void $getRoot().append($createParagraphNode().append(makeText(mask))) },
  { key: "heading-h1", build: (mask) => void $getRoot().append($createHeadingNode("h1").append(makeText(mask))) },
  { key: "heading-h2", build: (mask) => void $getRoot().append($createHeadingNode("h2").append(makeText(mask))) },
  { key: "heading-h3", build: (mask) => void $getRoot().append($createHeadingNode("h3").append(makeText(mask))) },
  { key: "quote", build: (mask) => void $getRoot().append($createQuoteNode().append(makeText(mask))) },
  {
    key: "list-bullet",
    build: (mask) =>
      void $getRoot().append($createListNode("bullet").append($createListItemNode().append(makeText(mask)))),
  },
  {
    key: "list-number",
    build: (mask) =>
      void $getRoot().append($createListNode("number").append($createListItemNode().append(makeText(mask)))),
  },
  {
    key: "list-check",
    build: (mask) =>
      void $getRoot().append($createListNode("check").append($createListItemNode(true).append(makeText(mask)))),
  },
  { key: "code", build: (mask) => void $getRoot().append($createCodeNode().append(makeText(mask))) },
  {
    key: "link",
    build: (mask) =>
      void $getRoot().append(
        $createParagraphNode().append($createLinkNode("https://example.com").append(makeText(mask)))
      ),
  },
  {
    key: "table",
    build: (mask) =>
      void $getRoot().append(
        $createTableNode().append(
          $createTableRowNode().append(
            $createTableCellNode(TableCellHeaderStates.NO_STATUS).append($createParagraphNode().append(makeText(mask)))
          )
        )
      ),
  },
];

// Depth-first collection of every text leaf's format bitmask, mirroring the
// codec's LexicalNode.match walkers. Each case has exactly one text leaf, so
// the result pins down both "the text survived" and "its mask is intact".
const collectTextFormats: (node: LexicalNode) => ReadonlyArray<number> = LexicalNode.match({
  text: (node) => [node.format],
  tab: () => [],
  linebreak: () => [],
  "artifact-ref": () => [],
  youtube: () => [],
  root: (node) => A.flatMap(node.children, collectTextFormats),
  paragraph: (node) => A.flatMap(node.children, collectTextFormats),
  heading: (node) => A.flatMap(node.children, collectTextFormats),
  quote: (node) => A.flatMap(node.children, collectTextFormats),
  list: (node) => A.flatMap(node.children, collectTextFormats),
  listitem: (node) => A.flatMap(node.children, collectTextFormats),
  link: (node) => A.flatMap(node.children, collectTextFormats),
  code: (node) => A.flatMap(node.children, collectTextFormats),
  table: (node) => A.flatMap(node.children, collectTextFormats),
  tablerow: (node) => A.flatMap(node.children, collectTextFormats),
  tablecell: (node) => A.flatMap(node.children, collectTextFormats),
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
  for (const context of CONTEXTS) {
    describe(context.key, () => {
      for (const combo of MARK_COMBOS) {
        it(`marks: ${combo.label}`, () => {
          const editor = newEditor();
          editor.update(() => context.build(combo.mask), { discrete: true });
          const wire = editor.getEditorState().toJSON();

          // (1) The built state decodes through the @beep/lexical-schema wire
          // vocabulary — the same decode editor-nodes.test.ts asserts against.
          const decoded = S.decodeUnknownSync(SerializedEditorState)(wire);

          // The text leaf's format bitmask carries this case's exact mark set
          // (no context silently drops or rewrites the marks). If a context
          // ever normalized marks away, this fails loudly with the combo label
          // rather than skipping the case.
          expect(collectTextFormats(decoded.root)).toEqual([combo.mask]);

          // (2) export → import → export is a fixed point, so the node
          // structure and every text format bitmask survive the round-trip.
          const reimported = newEditor();
          reimported.setEditorState(reimported.parseEditorState(wire));
          expect(reimported.getEditorState().toJSON()).toEqual(wire);
        });
      }
    });
  }
});
