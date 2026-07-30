/**
 * Type-conformance tests pinning `@beep/lexical-schema` encoded shapes to
 * `lexical` 0.48 serialized types. `lexical` and friends are devDependencies
 * used type-only here — the package has zero runtime `lexical` imports.
 *
 * `children` is omitted from element-node comparisons: lexical types the
 * recursion as mutable `Array<SerializedLexicalNode>` (the open base type)
 * while the schema closes it over the v1 tagged union as a `ReadonlyArray`.
 * The `type` key is omitted on the lexical → schema direction because lexical
 * widens most discriminants to `string`.
 */

import { analyzeEditorStateCompatibility } from "@beep/lexical-schema";
import { describe, expect, it } from "tstyche";
import type {
  ArtifactRefNode,
  CodeNode,
  Direction,
  ElementFormat,
  HeadingNode,
  HeadingTag,
  LexicalNode,
  LexicalNodeWire,
  LineBreakNode,
  LinkNode,
  ListItemNode,
  ListNode,
  ListTag,
  ListType,
  ParagraphNode,
  QuoteNode,
  RootNode,
  SerializedEditorState,
  TableCellHeaderState,
  TableCellNode,
  TableNode,
  TableRowNode,
  TabNode,
  TextMode,
  TextNode,
} from "@beep/lexical-schema";
import type { SerializedCodeNode } from "@lexical/code";
import type { SerializedLinkNode } from "@lexical/link";
import type {
  ListType as LexicalListType,
  ListNodeTagType,
  SerializedListItemNode,
  SerializedListNode,
} from "@lexical/list";
import type { HeadingTagType, SerializedHeadingNode, SerializedQuoteNode } from "@lexical/rich-text";
import type { SerializedTableCellNode, SerializedTableNode, SerializedTableRowNode } from "@lexical/table";
import type {
  ElementFormatType,
  SerializedEditorState as LexicalSerializedEditorState,
  SerializedElementNode,
  SerializedLexicalNode,
  SerializedLineBreakNode,
  SerializedParagraphNode,
  SerializedRootNode,
  SerializedTabNode,
  SerializedTextNode,
  TextModeType,
} from "lexical";

type SansChildren<T> = Omit<T, "children">;
type SansChildrenAndType<T> = Omit<T, "children" | "type">;

describe("@beep/lexical-schema ↔ lexical 0.48", () => {
  it("pins the shared token vocabularies", () => {
    expect<ElementFormat>().type.toBe<ElementFormatType>();
    expect<TextMode>().type.toBe<TextModeType>();
    expect<HeadingTag>().type.toBe<HeadingTagType>();
    expect<ListType>().type.toBe<LexicalListType>();
    expect<ListTag>().type.toBe<ListNodeTagType>();
    expect<TableCellHeaderState>().type.toBeAssignableTo<SerializedTableCellNode["headerState"]>();
    expect<Direction | null>().type.toBe<SerializedElementNode["direction"]>();
  });

  it("pins leaf nodes", () => {
    expect<TextNode.Encoded>().type.toBeAssignableTo<SerializedTextNode>();
    expect<Omit<SerializedTextNode, "type">>().type.toBeAssignableTo<Omit<TextNode.Encoded, "type">>();

    expect<TabNode.Encoded>().type.toBeAssignableTo<SerializedTabNode>();
    expect<Omit<SerializedTabNode, "type">>().type.toBeAssignableTo<Omit<TabNode.Encoded, "type">>();

    expect<LineBreakNode.Encoded>().type.toBeAssignableTo<SerializedLineBreakNode>();
    expect<Omit<SerializedLineBreakNode, "type">>().type.toBeAssignableTo<Omit<LineBreakNode.Encoded, "type">>();

    expect<ArtifactRefNode.Encoded>().type.toBeAssignableTo<SerializedLexicalNode>();
  });

  it("pins element nodes", () => {
    expect<SansChildren<RootNode.Encoded>>().type.toBeAssignableTo<SansChildren<SerializedRootNode>>();
    expect<SansChildrenAndType<SerializedRootNode>>().type.toBeAssignableTo<SansChildrenAndType<RootNode.Encoded>>();

    expect<SansChildren<HeadingNode.Encoded>>().type.toBeAssignableTo<SansChildren<SerializedHeadingNode>>();
    expect<SansChildrenAndType<SerializedHeadingNode>>().type.toBeAssignableTo<
      SansChildrenAndType<HeadingNode.Encoded>
    >();

    expect<SansChildren<QuoteNode.Encoded>>().type.toBeAssignableTo<SansChildren<SerializedQuoteNode>>();
    expect<SansChildrenAndType<SerializedQuoteNode>>().type.toBeAssignableTo<SansChildrenAndType<QuoteNode.Encoded>>();

    expect<SansChildren<ListNode.Encoded>>().type.toBeAssignableTo<SansChildren<SerializedListNode>>();
    expect<SansChildrenAndType<SerializedListNode>>().type.toBeAssignableTo<SansChildrenAndType<ListNode.Encoded>>();

    expect<SansChildrenAndType<SerializedLinkNode>>().type.toBeAssignableTo<SansChildrenAndType<LinkNode.Encoded>>();

    expect<
      Omit<TableNode.Encoded, "children" | "colWidths" | "frozenColumnCount" | "frozenRowCount" | "rowStriping">
    >().type.toBeAssignableTo<
      Omit<SerializedTableNode, "children" | "colWidths" | "frozenColumnCount" | "frozenRowCount" | "rowStriping">
    >();
    expect<SansChildrenAndType<SerializedTableNode>>().type.toBeAssignableTo<SansChildrenAndType<TableNode.Encoded>>();

    expect<Omit<TableRowNode.Encoded, "children" | "height">>().type.toBeAssignableTo<
      Omit<SerializedTableRowNode, "children" | "height">
    >();
    expect<SansChildrenAndType<SerializedTableRowNode>>().type.toBeAssignableTo<
      SansChildrenAndType<TableRowNode.Encoded>
    >();

    expect<
      Omit<TableCellNode.Encoded, "backgroundColor" | "children" | "colSpan" | "rowSpan" | "verticalAlign" | "width">
    >().type.toBeAssignableTo<
      Omit<SerializedTableCellNode, "backgroundColor" | "children" | "colSpan" | "rowSpan" | "verticalAlign" | "width">
    >();
    expect<
      Omit<
        SerializedTableCellNode,
        "backgroundColor" | "children" | "colSpan" | "headerState" | "rowSpan" | "type" | "verticalAlign" | "width"
      >
    >().type.toBeAssignableTo<
      Omit<
        TableCellNode.Encoded,
        "backgroundColor" | "children" | "colSpan" | "headerState" | "rowSpan" | "type" | "verticalAlign" | "width"
      >
    >();
  });

  it("pins element nodes where lexical 0.48 narrows or widens optionality", () => {
    // Lexical 0.48 narrows paragraph textFormat/textStyle to required; the
    // schema keeps the SerializedElementNode optionality for durability
    // across lexical releases, so they are omitted on this direction only.
    expect<Omit<ParagraphNode.Encoded, "children" | "textFormat" | "textStyle">>().type.toBeAssignableTo<
      Omit<SerializedParagraphNode, "children" | "textFormat" | "textStyle">
    >();
    expect<SansChildrenAndType<SerializedParagraphNode>>().type.toBeAssignableTo<
      SansChildrenAndType<ParagraphNode.Encoded>
    >();

    // `checked` is a required-but-maybe-undefined key on the lexical side;
    // the schema models it as an optional key (absent on the wire when the
    // list is not a check list).
    expect<Omit<ListItemNode.Encoded, "children" | "checked">>().type.toBeAssignableTo<
      Omit<SerializedListItemNode, "children" | "checked">
    >();
    expect<SansChildrenAndType<SerializedListItemNode>>().type.toBeAssignableTo<
      SansChildrenAndType<ListItemNode.Encoded>
    >();

    // Same shape for `language` on code blocks.
    expect<Omit<CodeNode.Encoded, "children" | "language">>().type.toBeAssignableTo<
      Omit<SerializedCodeNode, "children" | "language">
    >();
    expect<SansChildrenAndType<SerializedCodeNode>>().type.toBeAssignableTo<SansChildrenAndType<CodeNode.Encoded>>();

    // Link attributes: the schema's encoded optionals admit a present
    // `undefined` (identical after JSON serialization) where lexical's
    // `LinkAttributes` declare `key?: null | string`, so the schema → lexical
    // direction omits them.
    expect<Omit<LinkNode.Encoded, "children" | "rel" | "target" | "title">>().type.toBeAssignableTo<
      Omit<SerializedLinkNode, "children" | "rel" | "target" | "title">
    >();
  });

  it("pins the editor state envelope", () => {
    expect(analyzeEditorStateCompatibility).type.toBeAssignableTo<(input: unknown) => unknown>();
    expect<LexicalNodeWire["children"]>().type.toBe<import("effect/Schema").Json | undefined>();
    const decodedFutureNode: LexicalNodeWire.Type = {
      type: "future-node",
      version: 2,
      pluginData: { enabled: true },
    };
    const encodedFutureNode: LexicalNodeWire.Encoded = {
      type: "future-node",
      version: 2,
      pluginData: { enabled: true },
    };
    expect(decodedFutureNode.pluginData).type.toBe<import("effect/Schema").Json>();
    expect(encodedFutureNode.pluginData).type.toBe<import("effect/Schema").Json>();
    expect<SerializedEditorState.Encoded["root"]["type"]>().type.toBe<"root">();
    expect<SansChildren<SerializedEditorState.Encoded["root"]>>().type.toBeAssignableTo<
      SansChildren<LexicalSerializedEditorState["root"]>
    >();
    expect<LexicalNode.Encoded>().type.toBeAssignableTo<SerializedLexicalNode>();
  });
});
