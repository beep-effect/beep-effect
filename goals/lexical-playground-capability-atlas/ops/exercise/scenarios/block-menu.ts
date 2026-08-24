import { click, keyboard, type } from "./dsl.ts";
import { BLOCK_ITEM, GROUP, multiPathLifecycle, scenario } from "./helpers.ts";
import { BLOCK_MENU, EDITOR, KEY, MARKDOWN, OUTPUT, SLASH_ITEM } from "./sourced.ts";
import type { LocatorSpec, Step } from "./dsl.ts";

const resetEditor: ReadonlyArray<Step> = [keyboard("Control+A", EDITOR), keyboard("Backspace", EDITOR)];
const block = (item: LocatorSpec): ReadonlyArray<Step> => [
  ...resetEditor,
  type(EDITOR, "evidence"),
  click(BLOCK_MENU),
  click(item),
];
const slash = (item: LocatorSpec): ReadonlyArray<Step> => [...resetEditor, type(EDITOR, "/"), click(item)];
const markdown = (source: string): ReadonlyArray<Step> => [
  ...resetEditor,
  type(EDITOR, source),
  keyboard("Space", EDITOR),
];

export const scenarios = [
  scenario({
    activationExercise: "Choose Code Block, slash Code, and the fenced-code Markdown transformer.",
    group: GROUP.blockMenu,
    id: "node.code",
    steps: multiPathLifecycle(
      [block(BLOCK_ITEM.code), slash(SLASH_ITEM.code), markdown(MARKDOWN.codeBlock)],
      OUTPUT.code
    ),
    title: "Code block",
  }),
  scenario({
    activationExercise: "Choose Heading 1, slash Heading 1, and the heading Markdown transformer.",
    group: GROUP.blockMenu,
    id: "node.heading",
    steps: multiPathLifecycle(
      [block(BLOCK_ITEM.heading1), slash(SLASH_ITEM.heading1), markdown(MARKDOWN.heading)],
      OUTPUT.heading1
    ),
    title: "Heading",
  }),
  scenario({
    activationExercise: "Choose Bullet List, slash Numbered List, and the unordered-list Markdown transformer.",
    group: GROUP.blockMenu,
    id: "node.list",
    steps: multiPathLifecycle(
      [block(BLOCK_ITEM.bulletList), slash(SLASH_ITEM.numberedList), markdown(MARKDOWN.unorderedList)],
      OUTPUT.listItem
    ),
    title: "Lists",
  }),
  scenario({
    activationExercise: "Choose Normal, slash Paragraph, and invoke Ctrl+Alt+0.",
    group: GROUP.blockMenu,
    id: "node.paragraph",
    steps: multiPathLifecycle(
      [
        block(BLOCK_ITEM.normal),
        slash(SLASH_ITEM.paragraph),
        [...resetEditor, type(EDITOR, "evidence"), keyboard(KEY.normal, EDITOR)],
      ],
      OUTPUT.paragraph
    ),
    title: "Paragraph",
  }),
  scenario({
    activationExercise: "Choose Quote, slash Quote, and the quote Markdown transformer.",
    group: GROUP.blockMenu,
    id: "node.quote",
    steps: multiPathLifecycle(
      [block(BLOCK_ITEM.quote), slash(SLASH_ITEM.quote), markdown(MARKDOWN.quote)],
      OUTPUT.quote
    ),
    title: "Block quote",
  }),
] as const;
