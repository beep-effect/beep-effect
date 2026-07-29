/**
 * The default `/` command set: formatting / block-insert items only, all mapping
 * to nodes the `@beep/lexical-schema` v1 vocabulary already supports (heading,
 * quote, list, code) so the emitted state round-trips. Product / knowledge
 * commands are injected later through the same menu mechanism — this is just the
 * generic formatting baseline an app can spread into its own list.
 *
 * @packageDocumentation \@beep/editor/chat/slash-items
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { $createCodeNode } from "@lexical/code";
import { INSERT_CHECK_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { CodeBlockIcon } from "@phosphor-icons/react/CodeBlock";
import { ListBulletsIcon } from "@phosphor-icons/react/ListBullets";
import { ListChecksIcon } from "@phosphor-icons/react/ListChecks";
import { ListNumbersIcon } from "@phosphor-icons/react/ListNumbers";
import { ParagraphIcon } from "@phosphor-icons/react/Paragraph";
import { QuotesIcon } from "@phosphor-icons/react/Quotes";
import { TextHOneIcon } from "@phosphor-icons/react/TextHOne";
import { TextHThreeIcon } from "@phosphor-icons/react/TextHThree";
import { TextHTwoIcon } from "@phosphor-icons/react/TextHTwo";
import { $createParagraphNode, $getSelection, $isRangeSelection } from "lexical";
import { SlashItem } from "./config.ts";
import type { HeadingTagType } from "@lexical/rich-text";
import type { ElementNode, LexicalEditor } from "lexical";

const ICON_CLASS = "size-4 shrink-0";

const setBlock = (editor: LexicalEditor, create: () => ElementNode): void =>
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      $setBlocksType(selection, create);
    }
  });

const heading = (editor: LexicalEditor, tag: HeadingTagType): void => setBlock(editor, () => $createHeadingNode(tag));

/**
 * Formatting / insert `/` items over the schema-safe block vocabulary.
 *
 * @example
 * ```ts
 * import { defaultChatSlashItems } from "@beep/editor/chat/slash-items"
 *
 * console.log(defaultChatSlashItems.length > 0) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const defaultChatSlashItems: ReadonlyArray<SlashItem> = A.map(
  [
    {
      key: "paragraph",
      label: "Text",
      hint: "text",
      keywords: ["paragraph", "normal", "body"],
      icon: <ParagraphIcon className={ICON_CLASS} />,
      onSelect: (editor: LexicalEditor) => setBlock(editor, () => $createParagraphNode()),
    },
    {
      key: "h1",
      label: "Heading 1",
      hint: "h1",
      keywords: ["title", "large"],
      icon: <TextHOneIcon className={ICON_CLASS} />,
      onSelect: (editor: LexicalEditor) => heading(editor, "h1"),
    },
    {
      key: "h2",
      label: "Heading 2",
      hint: "h2",
      keywords: ["subtitle", "medium"],
      icon: <TextHTwoIcon className={ICON_CLASS} />,
      onSelect: (editor: LexicalEditor) => heading(editor, "h2"),
    },
    {
      key: "h3",
      label: "Heading 3",
      hint: "h3",
      keywords: ["subheading", "small"],
      icon: <TextHThreeIcon className={ICON_CLASS} />,
      onSelect: (editor: LexicalEditor) => heading(editor, "h3"),
    },
    {
      key: "bulleted-list",
      label: "Bulleted list",
      hint: "ul",
      keywords: ["unordered", "bullet", "list"],
      icon: <ListBulletsIcon className={ICON_CLASS} />,
      onSelect: (editor: LexicalEditor) => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
    },
    {
      key: "numbered-list",
      label: "Numbered list",
      hint: "ol",
      keywords: ["ordered", "number", "list"],
      icon: <ListNumbersIcon className={ICON_CLASS} />,
      onSelect: (editor: LexicalEditor) => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
    },
    {
      key: "check-list",
      label: "Check list",
      hint: "todo",
      keywords: ["task", "todo", "checkbox"],
      icon: <ListChecksIcon className={ICON_CLASS} />,
      onSelect: (editor: LexicalEditor) => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
    },
    {
      key: "quote",
      label: "Quote",
      hint: "quote",
      keywords: ["blockquote", "citation"],
      icon: <QuotesIcon className={ICON_CLASS} />,
      onSelect: (editor: LexicalEditor) => setBlock(editor, () => $createQuoteNode()),
    },
    {
      key: "code-block",
      label: "Code block",
      hint: "code",
      keywords: ["fenced", "pre", "snippet"],
      icon: <CodeBlockIcon className={ICON_CLASS} />,
      onSelect: (editor: LexicalEditor) => setBlock(editor, () => $createCodeNode()),
    },
  ],
  (item) => SlashItem.make(item)
);
