import { css, placeholder, role, testId, text } from "./dsl.ts";
import type { LocatorSpec, Query } from "./dsl.ts";

// Source: packages/lexical-playground/src/appSettings.ts (DEFAULT_SETTINGS) and
// packages/lexical-playground/src/setupEnv.ts (query-string override loop).
export const BASE_QUERY: Query = {
  emptyEditor: true,
  isRichText: true,
  showTreeView: false,
};

// Source: packages/lexical-playground/src/appSettings.ts (DEFAULT_SETTINGS).
export const SETTING_QUERY = {
  autocomplete: "isAutocomplete",
  blockSelection: "selectBlock",
  bracketSpecialText: "shouldAllowHighlightingWithBrackets",
  charLimitUtf16: "isCharLimit",
  charLimitUtf8: "isCharLimitUtf8",
  checklistFocus: "shouldDisableFocusOnClickChecklist",
  codeHighlighted: "isCodeHighlighted",
  codeShiki: "isCodeShiki",
  collaboration: "isCollab",
  collaborationV2: "useCollabV2",
  emptyEditor: "emptyEditor",
  fitNestedTables: "hasFitNestedTables",
  lexicalContextMenu: "shouldUseLexicalContextMenu",
  linkAttributes: "hasLinkAttributes",
  listStrictIndent: "listStrictIndent",
  maxLength: "isMaxLength",
  measureTypingPerf: "measureTypingPerf",
  nestedEditorTreeView: "showNestedEditorTreeView",
  nestedTables: "hasNestedTables",
  preserveMarkdownNewlines: "shouldPreserveNewLinesInMarkdown",
  retainSelection: "selectionAlwaysOnDisplay",
  richText: "isRichText",
  shadowDom: "isShadowDOM",
  tableCellBackground: "tableCellBackgroundColor",
  tableCellMerge: "tableCellMerge",
  tableHorizontalScroll: "tableHorizontalScroll",
  tableOfContents: "showTableOfContents",
  treeView: "showTreeView",
  visibleNonPrinting: "isVisibleNonPrinting",
} satisfies Readonly<Record<string, string>>;

// Source: packages/lexical-playground/src/ui/ContentEditable.tsx.
export const EDITOR = css(".ContentEditable__root");
// Source: packages/lexical-playground/src/Editor.tsx.
export const EDITOR_SCROLLER = css(".editor-scroller");
// Source: packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx.
export const MAIN_TOOLBAR = role("toolbar", "Editor toolbar", { exact: true });
// Source: packages/lexical-playground/src/plugins/FloatingTextFormatToolbarPlugin/index.tsx.
export const FLOATING_TOOLBAR = role("toolbar", "Floating text format toolbar", { exact: true });

// Source: packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx (BlockFormatDropDown).
export const BLOCK_MENU = role("button", "Formatting options for text style", { exact: true });

// Source: packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx (Insert DropDown).
export const INSERT_MENU = role("button", "Insert specialized editor node", { exact: true });

// Source: packages/lexical-playground/src/plugins/ComponentPickerPlugin/index.tsx (getBaseOptions/getDynamicOptions).
export const slashOption = (name: string): LocatorSpec => role("option", name, { exact: true });
export const SLASH_ITEM = {
  card: slashOption("Card"),
  checkList: slashOption("Check List"),
  code: slashOption("Code"),
  collapsible: slashOption("Collapsible"),
  columns: slashOption("Columns Layout"),
  date: slashOption("Date"),
  divider: slashOption("Divider"),
  equation: slashOption("Equation"),
  excalidraw: slashOption("Excalidraw"),
  figma: slashOption("Embed Figma Document"),
  heading1: slashOption("Heading 1"),
  image: slashOption("Image"),
  numberedList: slashOption("Numbered List"),
  pageBreak: slashOption("Page Break"),
  paragraph: slashOption("Paragraph"),
  poll: slashOption("Poll"),
  pullQuote: slashOption("Pull Quote"),
  quote: slashOption("Quote"),
  review: slashOption("Review"),
  table: slashOption("Table"),
  tweet: slashOption("Embed X(Tweet)"),
  youtube: slashOption("Embed Youtube Video"),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/AutoEmbedPlugin/index.tsx.
export const AUTO_EMBED = {
  figmaPrompt: role("option", "Embed Figma Document", { exact: true }),
  tweetPrompt: role("option", "Embed X(Tweet)", { exact: true }),
  youtubePrompt: role("option", "Embed Youtube Video", { exact: true }),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/ActionsPlugin/index.tsx.
export const ACTION = {
  clear: role("button", "Clear editor contents", { exact: true }),
  exportJson: role("button", "Export editor state to JSON", { exact: true }),
  htmlFrom: role("button", "Convert from html", { exact: true }),
  htmlTo: role("button", "Convert to html", { exact: true }),
  importJson: role("button", "Import editor state from JSON", { exact: true }),
  lock: role("button", "Lock read-only mode", { exact: true }),
  markdownFrom: role("button", "Convert from markdown", { exact: true }),
  markdownTo: role("button", "Convert To Markdown", { exact: true }),
  share: role("button", "Share Playground link to current editor state", { exact: true }),
  speechDisabled: role("button", "Disable speech to text", { exact: true }),
  speechEnabled: role("button", "Enable speech to text", { exact: true }),
  unlock: role("button", "Unlock read-only mode", { exact: true }),
} satisfies Readonly<Record<string, LocatorSpec>>;
// Source: packages/lexical-playground/src/plugins/ActionsPlugin/index.tsx (clear confirmation and share toast).
export const ACTION_FEEDBACK = {
  clearConfirm: role("button", "Clear", { exact: true }),
  shareToast: text("URL copied to clipboard", { exact: false }),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/CommentPlugin/index.tsx.
export const COMMENTS = {
  commentButton: role("button", "Comment", { exact: true }),
  hide: role("button", "Hide Comments", { exact: true }),
  input: css(".CommentPlugin_CommentInputBox_Editor"),
  mark: css(".PlaygroundEditorTheme__mark"),
  panel: css(".CommentPlugin_CommentsPanel"),
  show: role("button", "Show Comments", { exact: true }),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/FindReplaceExtension/index.tsx.
export const FIND_REPLACE = {
  close: role("button", "Close", { exact: true }),
  dialog: role("dialog", "Find and Replace", { exact: true }),
  find: role("textbox", "Search text", { exact: true }),
  next: role("button", "Next match", { exact: true }),
  replace: role("textbox", "Replace text", { exact: true }),
  replaceAll: role("button", "Replace all matches", { exact: true }),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/Settings.tsx and src/ui/Switch.tsx.
export const SETTINGS_BUTTON = testId("options-button");
export const settingSwitch = (label: string): LocatorSpec => role("switch", label, { exact: true });

// Source: packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx.
export const TOOLBAR_BUTTON = {
  backgroundColor: role("button", "Formatting background color", { exact: true }),
  bold: role("button", "Format text as bold. Shortcut: Ctrl+B", { exact: true }),
  clearFormatting: role("button", "Clear all text formatting", { exact: true }),
  fontFamily: role("button", "Formatting options for font family", { exact: true }),
  inlineCode: role("button", "Insert code block", {
    exact: true,
    scope: '[role="toolbar"][aria-label="Editor toolbar"]',
  }),
  italic: role("button", "Format text as italics. Shortcut: Ctrl+I", { exact: true }),
  link: role("button", "Insert link", { exact: true }),
  moreStyles: role("button", "Formatting options for additional text styles", { exact: true }),
  redo: role("button", "Redo", { exact: true }),
  ruby: role("button", "Insert ruby annotation", { exact: true }),
  shortcutHelp: role("button", "Show keyboard shortcuts", { exact: true }),
  textColor: role("button", "Formatting text color", { exact: true }),
  underline: role("button", "Format text to underlined. Shortcut: Ctrl+U", { exact: true }),
  undo: role("button", "Undo", { exact: true }),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/RubyExtension/FloatingRubyEditor.tsx.
export const RUBY_EDITOR = {
  confirm: role("button", "Confirm", { exact: true, scope: ".ruby-editor" }),
  input: role("textbox", "Ruby annotation", { exact: true }),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx (ElementFormatDropdown).
export const ALIGN_MENU = role("button", "Formatting options for text alignment", { exact: true });

// Source: packages/lexical-playground/src/plugins/ToolbarPlugin/fontSize.tsx.
export const FONT_SIZE = {
  decrease: role("button", "Decrease font size", { exact: true }),
  increase: role("button", "Increase font size", { exact: true }),
  input: css('input[title="Font size"]'),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/ui/ColorPicker.tsx.
export const COLOR_SWATCH = css(".color-picker-basic-color button", 0);
// Source: packages/lexical-playground/src/plugins/PagesReactExtension/PageSetupDropdown.tsx.
export const PAGE_SETUP = role("button", "Page setup: size, orientation, and layout", { exact: true });

// Source: packages/lexical-playground/src/ui/Modal.tsx and the modal titles at each call site.
export const modal = (name: string): LocatorSpec => role("dialog", name, { exact: true });
export const MODAL_BUTTON = {
  close: role("button", "Close modal", { exact: true }),
  confirm: role("button", "Confirm", { exact: true }),
  insert: role("button", "Insert", { exact: true }),
  save: role("button", "Save", { exact: true }),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/TablePlugin.tsx.
export const TABLE_DIALOG = {
  columns: testId("table-modal-columns"),
  confirm: css('[data-test-id="table-model-confirm-insert"] button'),
  rows: testId("table-modal-rows"),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/ImagesExtension/index.tsx.
export const IMAGE_DIALOG = {
  alt: testId("image-modal-alt-text-input"),
  confirmUrl: testId("image-modal-confirm-btn"),
  file: testId("image-modal-option-file"),
  sample: testId("image-modal-option-sample"),
  url: testId("image-modal-option-url"),
  urlInput: testId("image-modal-url-input"),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/ui/KatexEquationAlterer.tsx.
export const EQUATION_DIALOG = {
  input: testId("equation-input"),
  inline: testId("equation-inline-checkbox"),
  submit: testId("equation-submit-btn"),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/PollExtension/index.tsx and src/ui/TextInput.tsx.
export const POLL_QUESTION = css(".Modal__content input.Input__input");

// Source: packages/lexical-playground/src/plugins/LayoutExtension/InsertLayoutDialog.tsx.
export const LAYOUT_DIALOG = {
  defaultLayout: role("button", "2 columns (equal width)", { exact: true }),
  insert: role("button", "Insert", { exact: true }),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/AutoEmbedPlugin/index.tsx.
export const embedInput = (typeName: "figma" | "tweet" | "youtube-video"): LocatorSpec =>
  testId(`${typeName}-embed-modal-url`);
export const embedSubmit = (typeName: "figma" | "tweet" | "youtube-video"): LocatorSpec =>
  testId(`${typeName}-embed-modal-submit-btn`);

// Source: packages/lexical-playground/src/plugins/DraggableBlockPlugin/index.tsx.
export const DRAGGABLE = {
  add: role("button", "Click to add below", { exact: true }),
  filter: placeholder("Filter blocks..."),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/TableActionMenuPlugin/index.tsx.
export const TABLE_ACTION_BUTTON = css(".table-cell-action-button");
export const TABLE_ACTION = {
  background: testId("table-background-color"),
  columnHeader: testId("table-column-header"),
  deleteColumn: testId("table-delete-columns"),
  deleteRow: testId("table-delete-rows"),
  freezeColumn: testId("table-freeze-first-column"),
  freezeRow: testId("table-freeze-first-row"),
  insertColumnAfter: testId("table-insert-column-after"),
  insertRowBelow: testId("table-insert-row-below"),
  merge: role("button", "Merge cells", { exact: true }),
  rowHeader: testId("table-row-header"),
  rowStriping: testId("table-row-striping"),
  verticalAlign: role("button", "Formatting options for vertical alignment", { exact: true }),
} satisfies Readonly<Record<string, LocatorSpec>>;
export const tableCell = (nth: number): LocatorSpec => css(".PlaygroundEditorTheme__tableCell", nth);

// Source: packages/lexical-playground/src/plugins/TableHoverActionsV2Plugin/index.tsx.
export const TABLE_HOVER = {
  addColumn: role("button", "Add column", { exact: true }),
  addRow: role("button", "Add row", { exact: true }),
  dragColumn: role("button", "Drag to reorder column", { exact: true }),
  sort: role("button", "Sort column", { exact: true }),
  sortAscending: role("button", "Sort Ascending", { exact: true }),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/TableCellResizer/index.tsx.
export const TABLE_RESIZER = css(".TableCellResizer__resizer", 0);

// Source: packages/lexical-playground/src/plugins/TreeViewPlugin/index.tsx.
export const TIME_TRAVEL_BUTTON = css(".debug-timetravel-button");
export const TIME_TRAVEL_EXIT = role("button", "Exit", { exact: true, scope: ".debug-timetravel-panel" });

// Source: packages/lexical-playground/src/themes/PlaygroundEditorTheme.ts,
// packages/lexical-playground/src/ui/ContentEditable.tsx,
// packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx, and
// packages/lexical-playground/src/plugins/PagesExtension/PagesExtension.ts.
export const OUTPUT = {
  autocomplete: css('[data-autocomplete-ghost="true"]'),
  bold: css(".PlaygroundEditorTheme__textBold"),
  backgroundColor: css('.PlaygroundEditorTheme__paragraph [style*="background-color"]'),
  bulletList: css(".PlaygroundEditorTheme__ul"),
  capitalize: css(".PlaygroundEditorTheme__textCapitalize"),
  charLimit: css(".PlaygroundEditorTheme__characterLimit"),
  code: css(".PlaygroundEditorTheme__code"),
  emojiText: text("😄", { exact: true }),
  emojiToken: css(".emoji"),
  dateTime: css("[data-lexical-datetime]"),
  embed: css(".PlaygroundEditorTheme__embedBlock"),
  hashtag: css(".PlaygroundEditorTheme__hashtag"),
  heading1: css(".PlaygroundEditorTheme__h1"),
  highlight: css(".PlaygroundEditorTheme__textHighlight"),
  horizontalRule: css(".PlaygroundEditorTheme__hr", 0),
  indent: css(".PlaygroundEditorTheme__indent"),
  inlineCode: css(".PlaygroundEditorTheme__textCode"),
  italic: css(".PlaygroundEditorTheme__textItalic"),
  layoutContainer: css(".PlaygroundEditorTheme__layoutContainer"),
  layoutItem: css(".PlaygroundEditorTheme__layoutItem", 0),
  link: css(".PlaygroundEditorTheme__link"),
  lineBreak: css(".PlaygroundEditorTheme__paragraph:has(br:not([data-lexical-managed-linebreak]))", 0),
  listItem: css(".PlaygroundEditorTheme__listItem", 0),
  lowercase: css(".PlaygroundEditorTheme__textLowercase"),
  markdownSource: css('.PlaygroundEditorTheme__code[data-language="markdown"]'),
  mark: css(".PlaygroundEditorTheme__mark"),
  numberedList: css(".PlaygroundEditorTheme__ol1"),
  page: css(".PlaygroundEditorTheme__page", 0),
  pageBreak: css('hr[data-lexical-page-break="true"]'),
  paragraph: css(".PlaygroundEditorTheme__paragraph", 0),
  quote: css(".PlaygroundEditorTheme__quote"),
  ruby: css(".PlaygroundEditorTheme__ruby"),
  specialText: css(".PlaygroundEditorTheme__specialText"),
  strikethrough: css(".PlaygroundEditorTheme__textStrikethrough"),
  subscript: css(".PlaygroundEditorTheme__textSubscript"),
  superscript: css(".PlaygroundEditorTheme__textSuperscript"),
  table: css(".PlaygroundEditorTheme__table"),
  tablePresence: css(".PlaygroundEditorTheme__table", 0),
  nestedTable: css(".PlaygroundEditorTheme__table .PlaygroundEditorTheme__table", 0),
  tableCell: css(".PlaygroundEditorTheme__tableCell", 0),
  tableRow: css(".PlaygroundEditorTheme__table tr", 0),
  tableScrollable: css(".PlaygroundEditorTheme__tableScrollableWrapper"),
  tableStriped: css(".PlaygroundEditorTheme__tableRowStriping"),
  alignCenter: css('.PlaygroundEditorTheme__paragraph[style*="text-align: center"]'),
  alignEnd: css('.PlaygroundEditorTheme__paragraph[style*="text-align: end"]'),
  alignJustify: css('.PlaygroundEditorTheme__paragraph[style*="text-align: justify"]'),
  alignLeft: css('.PlaygroundEditorTheme__paragraph[style*="text-align: left"]'),
  alignRight: css('.PlaygroundEditorTheme__paragraph[style*="text-align: right"]'),
  alignStart: css('.PlaygroundEditorTheme__paragraph[style*="text-align: start"]'),
  fontFamily: css('.PlaygroundEditorTheme__paragraph [style*="font-family"]'),
  fontSize: css('.PlaygroundEditorTheme__paragraph [style*="font-size"]'),
  textColor: css('.PlaygroundEditorTheme__paragraph [style*="color"]'),
  underline: css(".PlaygroundEditorTheme__textUnderline"),
  uppercase: css(".PlaygroundEditorTheme__textUppercase"),
  visibleNonPrinting: css('[data-lexical-visible-non-printing-active="true"]'),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/nodes and src/plugins node implementations named below.
export const CUSTOM_OUTPUT = {
  card: css(".lexical-card-node", 0), // plugins/CardExtension/CardNode.tsx
  collapsible: css(".Collapsible__container"), // plugins/CollapsibleExtension/CollapsibleContainerNode.ts
  collapsibleContent: css(".Collapsible__content", 0), // plugins/CollapsibleExtension/CollapsibleContentNode.ts
  collapsibleTitle: css(".Collapsible__title", 0), // plugins/CollapsibleExtension/CollapsibleTitleNode.ts
  equation: role("math"), // nodes/EquationNode.tsx
  excalidraw: css(".editor-image"), // nodes/ExcalidrawNode/index.tsx + themes/PlaygroundEditorTheme.ts
  image: css(".editor-image img"), // nodes/ImageNode.tsx wrapper + ImageComponent.tsx
  keyword: css(".keyword"), // nodes/KeywordNode.ts
  mention: css(".mention"), // nodes/MentionNode.ts
  poll: text("Evidence poll", { exact: true }), // nodes/PollNode.tsx
  pullQuote: css(".lexical-pullquote-node", 0), // plugins/PullQuoteExtension/PullQuoteNode.tsx
  review: css(".lexical-review-node"), // plugins/ReviewExtension/ReviewNode.tsx
  sticky: css(".StickyNode__contentEditable"), // nodes/StickyNode.tsx
  figma: css('iframe[src*="figma.com/embed"]'), // nodes/FigmaNode.tsx
  tweet: css(".PlaygroundEditorTheme__embedBlock"), // nodes/TweetNode.tsx BlockWithAlignableContents theme
  youtube: css('iframe[title="YouTube video"]'), // nodes/YouTubeNode.tsx
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/ui/ExcalidrawModal.tsx (portal root class).
export const EXCALIDRAW_DIALOG = css(".ExcalidrawModal__overlay");

// Source: packages/lexical-playground/src/plugins/MentionsExtension/index.tsx (dummyMentionsData and option construction).
export const MENTION_YODA = role("option", "Yoda", { exact: true });

// Source: packages/lexical-playground/src/plugins/ShortcutsPlugin/shortcuts.ts.
export const KEY = {
  addComment: "Control+Alt+M",
  alignCenter: "Control+Shift+E",
  alignJustify: "Control+Shift+J",
  alignLeft: "Control+Shift+L",
  alignRight: "Control+Shift+R",
  bold: "Control+B",
  bulletList: "Control+Shift+8",
  capitalize: "Control+Shift+3",
  checkList: "Control+Shift+9",
  clearFormatting: "Control+\\",
  codeBlock: "Control+Alt+C",
  decreaseFont: "Control+Shift+,",
  heading1: "Control+Alt+1",
  increaseFont: "Control+Shift+>",
  indent: "Control+]",
  inlineCode: "Control+Shift+C",
  italic: "Control+I",
  link: "Control+K",
  lowercase: "Control+Shift+1",
  normal: "Control+Alt+0",
  numberedList: "Control+Shift+7",
  outdent: "Control+[",
  quote: "Control+Shift+Q",
  redo: "Control+Y",
  strikethrough: "Control+Shift+X",
  subscript: "Control+,",
  superscript: "Control+.",
  underline: "Control+U",
  undo: "Control+Z",
  uppercase: "Control+Shift+2",
} satisfies Readonly<Record<string, string>>;

// Source: packages/lexical-playground/src/plugins/FindReplaceExtension/index.tsx.
export const FIND_KEY = {
  next: "Control+G",
  open: "Control+F",
  previous: "Control+Shift+G",
} satisfies Readonly<Record<string, string>>;

// Source: packages/lexical-playground/src/plugins/AutocompleteExtension/index.tsx and dictionaries/english.ts.
export const AUTOCOMPLETE_PREFIX = "collab";

// Source: packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts and
// packages/lexical-markdown/src/MarkdownTransformers.ts at the same pinned revision.
export const MARKDOWN = {
  checkList: "- [ ] evidence",
  codeBlock: "```",
  emoji: ":smile:",
  emphasis: "*evidence*",
  equation: "$x^2$",
  heading: "# ",
  highlight: "==evidence==",
  horizontalRule: "---",
  image: "![evidence](data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==)",
  inlineCode: "`evidence`",
  link: "[evidence](https://example.com)",
  orderedList: "1. ",
  quote: "> ",
  strikethrough: "~~evidence~~",
  strong: "**evidence**",
  strongEmphasis: "***evidence***",
  table: "| A | B |",
  tweet: '<tweet id="20" />',
  unorderedList: "- ",
} satisfies Readonly<Record<string, string>>;

export const FIGMA_URL = "https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File";
export const TWEET_URL = "https://x.com/jack/status/20";
export const YOUTUBE_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
