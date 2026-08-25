import { click, clipboardPaste, css, drag, expectSelector, expectText, filePaste, keyboard, type } from "./dsl.ts";
import { GROUP, INSERT_ITEM, multiPathLifecycle, nodeLifecycle, scenario } from "./helpers.ts";
import {
  ACTION,
  AUTO_EMBED,
  CUSTOM_OUTPUT,
  EDITOR,
  EQUATION_DIALOG,
  EXCALIDRAW_DIALOG,
  embedInput,
  embedSubmit,
  FIGMA_URL,
  IMAGE_DIALOG,
  INSERT_MENU,
  LAYOUT_DIALOG,
  MARKDOWN,
  MODAL_BUTTON,
  OUTPUT,
  POLL_QUESTION,
  SLASH_ITEM,
  TABLE_DIALOG,
  TWEET_URL,
  YOUTUBE_URL,
} from "./sourced.ts";
import type { LocatorSpec, Step } from "./dsl.ts";

const TINY_PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const PASTE_DROP_IMAGE = css('.editor-image img[alt="paste-drop-evidence.png"]');
const IMPORTED_IMAGE = css('.editor-image img[alt="importer evidence"]');
const IMAGE_IMPORT_HTML = `<figure><img src="${TINY_PNG_DATA_URI}" alt="importer evidence"><figcaption>Importer caption</figcaption></figure>`;

const insert = (item: LocatorSpec): ReadonlyArray<Step> => [click(INSERT_MENU), click(item)];
const slash = (item: LocatorSpec): ReadonlyArray<Step> => [type(EDITOR, "/"), click(item)];
const tableDialog: ReadonlyArray<Step> = [
  type(TABLE_DIALOG.columns, "2", "fill"),
  type(TABLE_DIALOG.rows, "2", "fill"),
  click(TABLE_DIALOG.confirm),
];
const tableInsert = [...insert(INSERT_ITEM.table), ...tableDialog] as const;
const tableSlash = [...slash(SLASH_ITEM.table), ...tableDialog] as const;
const embedDialog = (
  item: LocatorSpec,
  typeName: "figma" | "tweet" | "youtube-video",
  url: string
): ReadonlyArray<Step> => [...insert(item), type(embedInput(typeName), url, "fill"), click(embedSubmit(typeName))];
const slashEmbed = (
  item: LocatorSpec,
  typeName: "figma" | "tweet" | "youtube-video",
  url: string
): ReadonlyArray<Step> => [...slash(item), type(embedInput(typeName), url, "fill"), click(embedSubmit(typeName))];
const automaticEmbed = (url: string, prompt: LocatorSpec): ReadonlyArray<Step> => [
  clipboardPaste(EDITOR, { mimeType: "text/plain", text: url }),
  expectSelector(prompt),
  click(prompt),
];

export const scenarios = [
  scenario({
    activationExercise: "Choose Collapsible container from Insert and Collapsible from the slash picker.",
    group: GROUP.insertMenu,
    id: "node.collapsible-container",
    steps: multiPathLifecycle(
      [insert(INSERT_ITEM.collapsible), slash(SLASH_ITEM.collapsible)],
      CUSTOM_OUTPUT.collapsible
    ),
    title: "Collapsible container",
  }),
  scenario({
    activationExercise: "Choose Date from Insert and Date from the slash picker.",
    group: GROUP.insertMenu,
    id: "node.date-time",
    steps: multiPathLifecycle([insert(INSERT_ITEM.date), slash(SLASH_ITEM.date)], OUTPUT.dateTime),
    title: "Date and time",
  }),
  scenario({
    activationExercise: "Insert an equation from the toolbar, slash picker, and pinned Markdown transformer.",
    group: GROUP.insertMenu,
    id: "node.equation",
    steps: multiPathLifecycle(
      [
        [...insert(INSERT_ITEM.equation), type(EQUATION_DIALOG.input, "x^2", "fill"), click(EQUATION_DIALOG.submit)],
        [...slash(SLASH_ITEM.equation), type(EQUATION_DIALOG.input, "x^2", "fill"), click(EQUATION_DIALOG.submit)],
        [type(EDITOR, MARKDOWN.equation)],
      ],
      CUSTOM_OUTPUT.equation
    ),
    title: "Equation",
  }),
  scenario({
    activationExercise:
      "Choose Excalidraw from Insert and the slash picker, draw a rectangle by keyboard/pointer, and save it.",
    group: GROUP.insertMenu,
    id: "node.excalidraw",
    steps: multiPathLifecycle(
      [
        [
          ...insert(INSERT_ITEM.excalidraw),
          click(EXCALIDRAW_DIALOG),
          keyboard("r"),
          drag(EXCALIDRAW_DIALOG, { delta: { x: 80, y: 50 } }),
          click(MODAL_BUTTON.save),
        ],
        [
          ...slash(SLASH_ITEM.excalidraw),
          click(EXCALIDRAW_DIALOG),
          keyboard("r"),
          drag(EXCALIDRAW_DIALOG, { delta: { x: 80, y: 50 } }),
          click(MODAL_BUTTON.save),
        ],
      ],
      CUSTOM_OUTPUT.excalidraw
    ),
    title: "Excalidraw drawing",
  }),
  scenario({
    activationExercise:
      "Insert Figma through toolbar, slash picker, and automatic URL recognition while recording provider requests.",
    group: GROUP.insertMenu,
    id: "node.figma",
    networkExpectation: "authorized-provider",
    steps: multiPathLifecycle(
      [
        embedDialog(INSERT_ITEM.figma, "figma", FIGMA_URL),
        slashEmbed(SLASH_ITEM.figma, "figma", FIGMA_URL),
        automaticEmbed(FIGMA_URL, AUTO_EMBED.figmaPrompt),
      ],
      CUSTOM_OUTPUT.figma
    ),
    title: "Figma reference",
  }),
  scenario({
    activationExercise: "Insert a divider through Insert, slash picker, and the horizontal-rule Markdown transformer.",
    group: GROUP.insertMenu,
    id: "node.horizontal-rule",
    steps: multiPathLifecycle(
      [
        insert(INSERT_ITEM.horizontalRule),
        slash(SLASH_ITEM.divider),
        [type(EDITOR, MARKDOWN.horizontalRule), keyboard("Enter", EDITOR)],
      ],
      OUTPUT.horizontalRule
    ),
    title: "Horizontal rule",
  }),
  scenario({
    activationExercise:
      "Insert an image through Insert, slash picker, Markdown, file paste, and the figure/image HTML importer.",
    group: GROUP.insertMenu,
    id: "node.image",
    steps: multiPathLifecycle(
      [
        [...insert(INSERT_ITEM.image), click(IMAGE_DIALOG.sample)],
        [...slash(SLASH_ITEM.image), click(IMAGE_DIALOG.sample)],
        [
          type(EDITOR, MARKDOWN.image),
          expectSelector(CUSTOM_OUTPUT.image),
          keyboard("Control+End", EDITOR),
          filePaste(EDITOR, {
            dataUri: TINY_PNG_DATA_URI,
            fileName: "paste-drop-evidence.png",
            mimeType: "image/png",
          }),
          expectSelector(PASTE_DROP_IMAGE),
          click(ACTION.htmlTo),
          expectSelector(OUTPUT.code),
          keyboard("Control+End", EDITOR),
          type(EDITOR, IMAGE_IMPORT_HTML),
          click(ACTION.htmlFrom),
          expectSelector(PASTE_DROP_IMAGE),
          expectSelector(IMPORTED_IMAGE),
          expectText(EDITOR, "Importer caption"),
        ],
      ],
      CUSTOM_OUTPUT.image,
      {
        screenshotLabels: ["activation-path-1", "activation-path-2", "markdown-shortcut-paste-drop-importer"],
      }
    ),
    title: "Image",
  }),
  scenario({
    activationExercise:
      "Choose Columns Layout from Insert and slash picker, accepting the source-backed two-column default.",
    group: GROUP.insertMenu,
    id: "node.layout-container",
    steps: multiPathLifecycle(
      [
        [...insert(INSERT_ITEM.columns), expectSelector(LAYOUT_DIALOG.defaultLayout), click(LAYOUT_DIALOG.insert)],
        [...slash(SLASH_ITEM.columns), expectSelector(LAYOUT_DIALOG.defaultLayout), click(LAYOUT_DIALOG.insert)],
      ],
      OUTPUT.layoutContainer
    ),
    title: "Column layout",
  }),
  scenario({
    activationExercise: "Choose Page Break from Insert and the slash picker.",
    group: GROUP.insertMenu,
    id: "node.page-break",
    steps: multiPathLifecycle([insert(INSERT_ITEM.pageBreak), slash(SLASH_ITEM.pageBreak)], OUTPUT.pageBreak),
    title: "Page break",
  }),
  scenario({
    activationExercise: "Choose Poll from Insert and slash picker, enter a question, and confirm.",
    group: GROUP.insertMenu,
    id: "node.poll",
    steps: multiPathLifecycle(
      [
        [...insert(INSERT_ITEM.poll), type(POLL_QUESTION, "Evidence poll", "fill"), click(MODAL_BUTTON.confirm)],
        [...slash(SLASH_ITEM.poll), type(POLL_QUESTION, "Evidence poll", "fill"), click(MODAL_BUTTON.confirm)],
      ],
      CUSTOM_OUTPUT.poll
    ),
    title: "Poll question and options",
  }),
  scenario({
    activationExercise: "Choose Sticky Note from the toolbar Insert menu.",
    group: GROUP.insertMenu,
    id: "node.sticky",
    steps: nodeLifecycle(insert(INSERT_ITEM.sticky), CUSTOM_OUTPUT.sticky),
    title: "Sticky note",
  }),
  scenario({
    activationExercise: "Create a table through Insert, slash picker, and the pinned Markdown table transformer.",
    group: GROUP.insertMenu,
    id: "node.table",
    steps: multiPathLifecycle(
      [tableInsert, tableSlash, [type(EDITOR, `${MARKDOWN.table}\n|---|---|\n| 1 | 2 |`), keyboard("Enter", EDITOR)]],
      OUTPUT.tablePresence
    ),
    title: "Table",
  }),
  scenario({
    activationExercise:
      "Insert X/Tweet through toolbar, slash picker, and automatic URL recognition while recording provider requests.",
    group: GROUP.insertMenu,
    id: "node.tweet",
    networkExpectation: "authorized-provider",
    steps: multiPathLifecycle(
      [
        embedDialog(INSERT_ITEM.tweet, "tweet", TWEET_URL),
        slashEmbed(SLASH_ITEM.tweet, "tweet", TWEET_URL),
        automaticEmbed(TWEET_URL, AUTO_EMBED.tweetPrompt),
      ],
      CUSTOM_OUTPUT.tweet
    ),
    title: "Tweet",
  }),
  scenario({
    activationExercise:
      "Insert YouTube through toolbar, slash picker, and automatic URL recognition while recording provider requests.",
    group: GROUP.insertMenu,
    id: "node.youtube",
    networkExpectation: "authorized-provider",
    steps: multiPathLifecycle(
      [
        embedDialog(INSERT_ITEM.youtube, "youtube-video", YOUTUBE_URL),
        slashEmbed(SLASH_ITEM.youtube, "youtube-video", YOUTUBE_URL),
        automaticEmbed(YOUTUBE_URL, AUTO_EMBED.youtubePrompt),
      ],
      CUSTOM_OUTPUT.youtube
    ),
    title: "YouTube video",
  }),
  scenario({
    activationExercise: "Exercise the shared table insertion lifecycle through Insert and slash picker.",
    group: GROUP.insertMenu,
    id: "table.insert",
    steps: multiPathLifecycle([tableInsert, tableSlash], OUTPUT.table),
    title: "Table insertion",
  }),
] as const;
