import {
  click,
  clipboardCopy,
  clipboardPaste,
  expectSelector,
  goto,
  keyboard,
  screenshot,
  setViewport,
  type,
} from "./dsl.ts";
import { GROUP, markdownLifecycle, multiPathLifecycle, query, scenario } from "./helpers.ts";
import { ACTION, CUSTOM_OUTPUT, EDITOR, MARKDOWN, OUTPUT } from "./sourced.ts";
import type { LocatorSpec, Step } from "./dsl.ts";

const rich = (source: string, commit?: string): ReadonlyArray<Step> => [
  type(EDITOR, source),
  ...(commit === undefined ? [] : [keyboard(commit, EDITOR)]),
];
const imported = (source: string): ReadonlyArray<Step> => [
  click(ACTION.markdownTo),
  expectSelector(OUTPUT.markdownSource),
  type(EDITOR, source, "fill"),
  click(ACTION.markdownFrom),
];
const transformer = (id: string, title: string, source: string, output: LocatorSpec, commit?: string) =>
  scenario({
    activationExercise:
      "Type the pinned transformer syntax in rich-text mode, import it through Markdown source mode, export it, and exercise history/clipboard/JSON.",
    group: GROUP.markdownShortcut,
    id,
    steps: multiPathLifecycle([rich(source, commit), imported(source)], output),
    title,
  });

export const scenarios = [
  scenario({
    activationExercise:
      "Type both the automatic :D source and the :smile: Markdown transformer, then import/export Markdown.",
    group: GROUP.markdownShortcut,
    id: "node.emoji",
    steps: [
      goto("/", query()),
      type(EDITOR, ":D"),
      expectSelector(OUTPUT.emojiToken),
      screenshot("automatic-token"),
      keyboard("Control+Z", EDITOR),
      keyboard("Control+A", EDITOR),
      keyboard("Backspace", EDITOR),
      type(EDITOR, MARKDOWN.emoji),
      expectSelector(OUTPUT.emojiText),
      screenshot("markdown-transformer"),
      click(ACTION.markdownTo),
      click(ACTION.markdownFrom),
      clipboardCopy(EDITOR),
      keyboard("End", EDITOR),
      keyboard("Enter", EDITOR),
      clipboardPaste(EDITOR),
      click(ACTION.exportJson, { downloadSlot: "emoji-json" }),
      setViewport(480, 900),
      screenshot("narrow-roundtrip"),
      keyboard("Control+A", EDITOR),
      keyboard("Backspace", EDITOR),
    ],
    title: "Emoji token",
  }),
  scenario({
    activationExercise:
      "Type and import the pinned Markdown link syntax, then round-trip it through Markdown source mode.",
    group: GROUP.markdownShortcut,
    id: "node.link",
    steps: markdownLifecycle(MARKDOWN.link, OUTPUT.link),
    title: "Link",
  }),
  transformer("transformer.check-list", "Checklist Markdown transformer", MARKDOWN.checkList, OUTPUT.listItem, "Space"),
  transformer("transformer.code-block", "Code block Markdown transformer", MARKDOWN.codeBlock, OUTPUT.code, "Space"),
  transformer("transformer.emoji", "Emoji Markdown transformer", MARKDOWN.emoji, OUTPUT.emojiText),
  transformer("transformer.emphasis", "Emphasis Markdown transformer", MARKDOWN.emphasis, OUTPUT.italic),
  transformer("transformer.equation", "Equation Markdown transformer", MARKDOWN.equation, CUSTOM_OUTPUT.equation),
  transformer("transformer.heading", "Heading Markdown transformer", MARKDOWN.heading, OUTPUT.heading1, "Space"),
  transformer("transformer.highlight", "Highlight Markdown transformer", MARKDOWN.highlight, OUTPUT.highlight),
  transformer(
    "transformer.horizontal-rule",
    "Horizontal rule Markdown transformer",
    MARKDOWN.horizontalRule,
    OUTPUT.horizontalRule,
    "Enter"
  ),
  transformer("transformer.image", "Image Markdown transformer", MARKDOWN.image, CUSTOM_OUTPUT.image),
  transformer("transformer.inline-code", "Inline code Markdown transformer", MARKDOWN.inlineCode, OUTPUT.inlineCode),
  transformer("transformer.link", "Link Markdown transformer", MARKDOWN.link, OUTPUT.link),
  transformer(
    "transformer.ordered-list",
    "Ordered list Markdown transformer",
    MARKDOWN.orderedList,
    OUTPUT.numberedList,
    "Space"
  ),
  transformer("transformer.quote", "Quote Markdown transformer", MARKDOWN.quote, OUTPUT.quote, "Space"),
  transformer(
    "transformer.strikethrough",
    "Strikethrough Markdown transformer",
    MARKDOWN.strikethrough,
    OUTPUT.strikethrough
  ),
  transformer("transformer.strong", "Strong Markdown transformer", MARKDOWN.strong, OUTPUT.bold),
  transformer(
    "transformer.strong-emphasis",
    "Strong emphasis Markdown transformer",
    MARKDOWN.strongEmphasis,
    OUTPUT.bold
  ),
  transformer(
    "transformer.table",
    "Table Markdown transformer",
    `${MARKDOWN.table}\n|---|---|\n| 1 | 2 |`,
    OUTPUT.table,
    "Enter"
  ),
  scenario({
    activationExercise:
      "Type the pinned Tweet transformer syntax, commit it with Enter, and attempt Markdown-source conversion without cascading after an uncaught application error.",
    group: GROUP.markdownShortcut,
    id: "transformer.tweet",
    steps: [
      goto("/", query()),
      expectSelector(EDITOR),
      type(EDITOR, MARKDOWN.tweet),
      keyboard("Enter", EDITOR),
      expectSelector(OUTPUT.embed),
      screenshot("activation-path-1"),
      click(ACTION.markdownTo),
      expectSelector(OUTPUT.markdownSource),
      screenshot("activation-path-2"),
    ],
    title: "Tweet Markdown transformer",
  }),
  transformer(
    "transformer.unordered-list",
    "Unordered list Markdown transformer",
    MARKDOWN.unorderedList,
    OUTPUT.bulletList,
    "Space"
  ),
] as const;
