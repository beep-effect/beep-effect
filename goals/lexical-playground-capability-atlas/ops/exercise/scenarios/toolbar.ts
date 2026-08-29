import { click, css, expectAttr, expectSelector, keyboard, role, type } from "./dsl.ts";
import {
  ALIGN_ITEM,
  baseLifecycle,
  FONT_FAMILY_COURIER,
  GROUP,
  MORE_STYLE_ITEM,
  multiPathLifecycle,
  nodeLifecycle,
  PAGE_ITEM,
  scenario,
  surfaceLifecycle,
} from "./helpers.ts";
import {
  ALIGN_MENU,
  COLOR_SWATCH,
  EDITOR,
  FLOATING_TOOLBAR,
  FONT_SIZE,
  KEY,
  MAIN_TOOLBAR,
  MARKDOWN,
  modal,
  OUTPUT,
  PAGE_SETUP,
  RUBY_EDITOR,
  TOOLBAR_BUTTON,
} from "./sourced.ts";
import type { LocatorSpec, Step } from "./dsl.ts";

const FLOATING_BOLD = role("button", "Format text as bold", {
  exact: true,
  scope: '[role="toolbar"][aria-label="Floating text format toolbar"]',
});
const FOURTH_BOLD = css(".PlaygroundEditorTheme__textBold", 3);
const FOURTH_ITALIC = css(".PlaygroundEditorTheme__textItalic", 3);

type MarkdownFormatPath = Readonly<{
  assertion: LocatorSpec;
  sources: ReadonlyArray<string>;
}>;

const markdownFormatActivation = ({ assertion, sources }: MarkdownFormatPath): ReadonlyArray<Step> => [
  ...sources.flatMap((source, index) => [
    type(EDITOR, source),
    ...(index === sources.length - 1 ? [] : [keyboard("Enter", EDITOR)]),
  ]),
  expectSelector(assertion),
];

const selected = (steps: ReadonlyArray<Step>): ReadonlyArray<Step> => [
  type(EDITOR, "Evidence"),
  keyboard("Control+A", EDITOR),
  ...steps,
];
const directFormat = (
  id: string,
  title: string,
  button: LocatorSpec,
  key: string,
  output: LocatorSpec,
  markdown?: MarkdownFormatPath
) =>
  scenario({
    activationExercise: `Invoke ${title} from the main toolbar and through its pinned keyboard binding${markdown === undefined ? "." : " and Markdown transformers."}`,
    group: GROUP.toolbar,
    id,
    steps: multiPathLifecycle(
      [
        selected([click(button)]),
        selected([keyboard(key, EDITOR)]),
        ...(markdown === undefined ? [] : [markdownFormatActivation(markdown)]),
      ],
      output,
      markdown === undefined
        ? {}
        : { screenshotLabels: ["activation-path-1", "activation-path-2", "markdown-shortcut"] }
    ),
    title,
  });
const moreFormat = (
  id: string,
  title: string,
  item: LocatorSpec,
  key: string,
  output: LocatorSpec,
  markdown?: MarkdownFormatPath
) =>
  scenario({
    activationExercise: `Invoke ${title} from the additional text styles menu, floating selection surface, and pinned keyboard binding${markdown === undefined ? "." : " and Markdown transformer."}`,
    group: GROUP.toolbar,
    id,
    steps: multiPathLifecycle(
      [
        selected([click(TOOLBAR_BUTTON.moreStyles), click(item)]),
        selected([expectSelector(FLOATING_TOOLBAR), keyboard(key, EDITOR)]),
        ...(markdown === undefined ? [] : [markdownFormatActivation(markdown)]),
      ],
      output,
      markdown === undefined
        ? {}
        : { screenshotLabels: ["activation-path-1", "activation-path-2", "markdown-shortcut"] }
    ),
    title,
  });
const align = (id: string, title: string, item: LocatorSpec, output: LocatorSpec, key?: string) =>
  scenario({
    activationExercise: `Invoke ${title} from the alignment menu${key === undefined ? "" : " and pinned keyboard binding"}.`,
    group: GROUP.toolbar,
    id,
    steps: multiPathLifecycle(
      [
        [type(EDITOR, "Evidence"), click(ALIGN_MENU), click(item)],
        ...(key === undefined ? [] : [[type(EDITOR, "Evidence"), keyboard(key, EDITOR)]]),
      ],
      output
    ),
    title,
  });

export const scenarios = [
  scenario({
    activationExercise: "Edit, invoke Redo from the toolbar, and invoke Ctrl+Y.",
    group: GROUP.toolbar,
    id: "authoring.redo",
    steps: surfaceLifecycle(
      [
        type(EDITOR, " edit"),
        keyboard(KEY.undo, EDITOR),
        click(TOOLBAR_BUTTON.redo),
        keyboard(KEY.undo, EDITOR),
        keyboard(KEY.redo, EDITOR),
      ],
      { seed: "Redo" }
    ),
    title: "Redo",
  }),
  scenario({
    activationExercise: "Edit, invoke Undo from the toolbar, and invoke Ctrl+Z.",
    group: GROUP.toolbar,
    id: "authoring.undo",
    steps: surfaceLifecycle(
      [type(EDITOR, " edit"), click(TOOLBAR_BUTTON.undo), type(EDITOR, " again"), keyboard(KEY.undo, EDITOR)],
      { seed: "Undo" }
    ),
    title: "Undo",
  }),
  scenario({
    activationExercise: "Select text, focus the floating toolbar's Bold button, and activate it with Enter.",
    group: GROUP.toolbar,
    id: "extension.floating-toolbar",
    steps: surfaceLifecycle(
      [
        keyboard("Control+A", EDITOR),
        expectSelector(FLOATING_TOOLBAR),
        expectSelector(FLOATING_BOLD),
        expectAttr(FLOATING_BOLD, "tabindex", "0"),
        keyboard("Enter", FLOATING_BOLD),
        expectSelector(OUTPUT.bold),
      ],
      { seed: "Floating toolbar" }
    ),
    title: "Floating selection toolbar",
  }),
  scenario({
    activationExercise: "Open the source-backed Keyboard shortcuts modal and traverse it without a pointer.",
    group: GROUP.toolbar,
    id: "extension.shortcut-help",
    steps: surfaceLifecycle([
      click(TOOLBAR_BUTTON.shortcutHelp),
      expectSelector(modal("Keyboard shortcuts")),
      keyboard("Tab"),
      keyboard("Escape"),
    ]),
    title: "Generated shortcut help",
  }),
  scenario({
    activationExercise:
      "Locate the Editor toolbar by accessible name and traverse its controls by keyboard at wide and narrow viewports.",
    group: GROUP.toolbar,
    id: "extension.toolbar",
    steps: surfaceLifecycle(
      [expectSelector(MAIN_TOOLBAR), click(MAIN_TOOLBAR), keyboard("Tab"), keyboard("Shift+Tab")],
      { seed: "Toolbar surface" }
    ),
    title: "Main toolbar",
  }),
  directFormat("format.bold", "Bold", TOOLBAR_BUTTON.bold, KEY.bold, OUTPUT.bold, {
    assertion: FOURTH_BOLD,
    sources: [MARKDOWN.boldStar, MARKDOWN.boldUnderscore, MARKDOWN.boldItalicStar, MARKDOWN.boldItalicUnderscore],
  }),
  moreFormat("format.capitalize", "Capitalize", MORE_STYLE_ITEM.capitalize, KEY.capitalize, OUTPUT.capitalize),
  scenario({
    activationExercise: "Apply Bold, clear it from the toolbar, then apply Bold and clear it with Ctrl+Backslash.",
    group: GROUP.toolbar,
    id: "format.clear",
    steps: surfaceLifecycle(
      [
        keyboard("Control+A", EDITOR),
        click(TOOLBAR_BUTTON.bold),
        expectSelector(OUTPUT.bold),
        click(TOOLBAR_BUTTON.moreStyles),
        click(MORE_STYLE_ITEM.clear),
        expectSelector(OUTPUT.bold, "detached"),
        keyboard(KEY.bold, EDITOR),
        keyboard(KEY.clearFormatting, EDITOR),
        expectSelector(OUTPUT.bold, "detached"),
      ],
      { seed: "Clear formatting" }
    ),
    title: "Clear formatting",
  }),
  directFormat("format.inline-code", "Inline code", TOOLBAR_BUTTON.inlineCode, KEY.inlineCode, OUTPUT.inlineCode, {
    assertion: OUTPUT.inlineCode,
    sources: [MARKDOWN.inlineCode],
  }),
  directFormat("format.italic", "Italic", TOOLBAR_BUTTON.italic, KEY.italic, OUTPUT.italic, {
    assertion: FOURTH_ITALIC,
    sources: [MARKDOWN.italicStar, MARKDOWN.italicUnderscore, MARKDOWN.boldItalicStar, MARKDOWN.boldItalicUnderscore],
  }),
  moreFormat("format.lowercase", "Lowercase", MORE_STYLE_ITEM.lowercase, KEY.lowercase, OUTPUT.lowercase),
  scenario({
    activationExercise:
      "Invoke semantic highlight from the additional styles menu and through the HIGHLIGHT Markdown transformer.",
    group: GROUP.toolbar,
    id: "format.semantic-highlight",
    steps: baseLifecycle(
      [
        click(TOOLBAR_BUTTON.moreStyles),
        click(MORE_STYLE_ITEM.highlight),
        expectSelector(OUTPUT.highlight),
        keyboard("Control+Z", EDITOR),
        keyboard("Control+A", EDITOR),
        keyboard("Backspace", EDITOR),
        type(EDITOR, MARKDOWN.highlight),
      ],
      OUTPUT.highlight,
      { activatedScreenshotLabel: "markdown-shortcut" }
    ),
    title: "Semantic highlight",
  }),
  moreFormat(
    "format.strikethrough",
    "Strikethrough",
    MORE_STYLE_ITEM.strikethrough,
    KEY.strikethrough,
    OUTPUT.strikethrough,
    { assertion: OUTPUT.strikethrough, sources: [MARKDOWN.strikethrough] }
  ),
  moreFormat("format.subscript", "Subscript", MORE_STYLE_ITEM.subscript, KEY.subscript, OUTPUT.subscript),
  moreFormat("format.superscript", "Superscript", MORE_STYLE_ITEM.superscript, KEY.superscript, OUTPUT.superscript),
  directFormat("format.underline", "Underline", TOOLBAR_BUTTON.underline, KEY.underline, OUTPUT.underline),
  moreFormat("format.uppercase", "Uppercase", MORE_STYLE_ITEM.uppercase, KEY.uppercase, OUTPUT.uppercase),
  align("layout.align-center", "Align center", ALIGN_ITEM.center, OUTPUT.alignCenter, KEY.alignCenter),
  align("layout.align-end", "Align end", ALIGN_ITEM.end, OUTPUT.alignEnd),
  align("layout.align-justify", "Justify", ALIGN_ITEM.justify, OUTPUT.alignJustify, KEY.alignJustify),
  align("layout.align-left", "Align left", ALIGN_ITEM.left, OUTPUT.alignLeft, KEY.alignLeft),
  align("layout.align-right", "Align right", ALIGN_ITEM.right, OUTPUT.alignRight, KEY.alignRight),
  align("layout.align-start", "Align start", ALIGN_ITEM.start, OUTPUT.alignStart),
  scenario({
    activationExercise: "Invoke Indent from the alignment menu and with Ctrl+Right Bracket.",
    group: GROUP.toolbar,
    id: "layout.indent",
    steps: multiPathLifecycle(
      [
        [type(EDITOR, "Evidence"), click(ALIGN_MENU), click(ALIGN_ITEM.indent)],
        [type(EDITOR, "Evidence"), keyboard(KEY.indent, EDITOR)],
      ],
      OUTPUT.indent
    ),
    title: "Indent",
  }),
  scenario({
    activationExercise: "Indent content, then invoke Outdent from the alignment menu and with Ctrl+Left Bracket.",
    group: GROUP.toolbar,
    id: "layout.outdent",
    steps: surfaceLifecycle(
      [
        keyboard(KEY.indent, EDITOR),
        expectSelector(OUTPUT.indent),
        click(ALIGN_MENU),
        click(ALIGN_ITEM.outdent),
        keyboard(KEY.indent, EDITOR),
        keyboard(KEY.outdent, EDITOR),
      ],
      { seed: "Outdent evidence" }
    ),
    title: "Outdent",
  }),
  scenario({
    activationExercise: "Choose A4 in Page Setup to register and project fixed Page nodes.",
    group: GROUP.toolbar,
    id: "node.page",
    steps: nodeLifecycle([click(PAGE_SETUP), click(PAGE_ITEM.a4)], OUTPUT.page),
    title: "Fixed page",
  }),
  scenario({
    activationExercise: "Select text, invoke Insert ruby annotation, edit it, and serialize the Ruby node.",
    group: GROUP.toolbar,
    id: "node.ruby",
    steps: baseLifecycle(
      [click(TOOLBAR_BUTTON.ruby), type(RUBY_EDITOR.input, "annotation", "fill"), click(RUBY_EDITOR.confirm)],
      OUTPUT.ruby
    ),
    title: "Ruby annotation",
  }),
  scenario({
    activationExercise: "Choose Margins then Narrow (0.25 inches) in Page Setup.",
    group: GROUP.toolbar,
    id: "page.margins",
    steps: surfaceLifecycle(
      [click(PAGE_SETUP), click(PAGE_ITEM.margins), click(PAGE_ITEM.narrowMargins), expectSelector(OUTPUT.page)],
      { seed: "Margin evidence" }
    ),
    title: "Page margins",
  }),
  scenario({
    activationExercise: "Switch Page Setup between A4 fixed pages and Pageless mode.",
    group: GROUP.toolbar,
    id: "page.mode",
    steps: surfaceLifecycle(
      [
        click(PAGE_SETUP),
        click(PAGE_ITEM.a4),
        expectSelector(OUTPUT.page),
        click(PAGE_ITEM.pageless),
        expectSelector(OUTPUT.page, "detached"),
      ],
      { seed: "Page mode evidence" }
    ),
    title: "Page mode",
  }),
  scenario({
    activationExercise: "Choose Orientation then Landscape in Page Setup.",
    group: GROUP.toolbar,
    id: "page.orientation",
    steps: surfaceLifecycle(
      [click(PAGE_SETUP), click(PAGE_ITEM.orientation), click(PAGE_ITEM.landscape), expectSelector(OUTPUT.page)],
      { seed: "Orientation evidence" }
    ),
    title: "Page orientation",
  }),
  scenario({
    activationExercise: "Choose Page size then A4 in Page Setup.",
    group: GROUP.toolbar,
    id: "page.size",
    steps: surfaceLifecycle([click(PAGE_SETUP), click(PAGE_ITEM.a4), expectSelector(OUTPUT.page)], {
      seed: "Page size evidence",
    }),
    title: "Page size",
  }),
  scenario({
    activationExercise: "Select text, open Formatting background color, and choose a basic color swatch.",
    group: GROUP.toolbar,
    id: "style.background-color",
    steps: baseLifecycle([click(TOOLBAR_BUTTON.backgroundColor), click(COLOR_SWATCH)], OUTPUT.backgroundColor, {
      afterActivation: [click(TOOLBAR_BUTTON.backgroundColor)],
    }),
    title: "Background color",
  }),
  scenario({
    activationExercise: "Select text, open font-family options, and choose Courier New.",
    group: GROUP.toolbar,
    id: "style.font-family",
    steps: baseLifecycle([click(TOOLBAR_BUTTON.fontFamily), click(FONT_FAMILY_COURIER)], OUTPUT.fontFamily),
    title: "Font family",
  }),
  scenario({
    activationExercise: "Select text, increase font size from the toolbar, then invoke the pinned keyboard binding.",
    group: GROUP.toolbar,
    id: "style.font-size",
    steps: multiPathLifecycle(
      [selected([click(FONT_SIZE.increase)]), selected([keyboard(KEY.increaseFont, EDITOR)])],
      OUTPUT.fontSize
    ),
    title: "Font size",
  }),
  scenario({
    activationExercise: "Select text, open Formatting text color, and choose a basic color swatch.",
    group: GROUP.toolbar,
    id: "style.text-color",
    steps: baseLifecycle([click(TOOLBAR_BUTTON.textColor), click(COLOR_SWATCH)], OUTPUT.textColor, {
      afterActivation: [click(TOOLBAR_BUTTON.textColor)],
    }),
    title: "Text color",
  }),
] as const;
