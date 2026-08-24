import {
  click,
  clipboardCopy,
  clipboardPaste,
  defineScenario,
  expectSelector,
  goto,
  keyboard,
  markManual,
  role,
  screenshot,
  setViewport,
  type,
} from "./dsl.ts";
import { ACTION, BASE_QUERY, EDITOR } from "./sourced.ts";
import type { LocatorSpec, NetworkExpectation, Query, Scenario, Step } from "./dsl.ts";

export const GROUP = {
  automatic: "automatic",
  blockMenu: "block-menu",
  browserApi: "browser-api",
  contextMenu: "context-menu",
  documentAction: "document-action",
  draggableBlock: "draggable-block",
  floatingToolbar: "floating-toolbar",
  importer: "importer",
  insertMenu: "insert-menu",
  keyboard: "keyboard",
  markdownShortcut: "markdown-shortcut",
  pasteDrop: "paste-drop",
  programmatic: "programmatic",
  selection: "selection",
  settingsPanel: "settings-panel",
  slashMenu: "slash-menu",
  toolbar: "toolbar",
  typeahead: "typeahead",
} as const;

export const dropdownItem = (name: string): LocatorSpec =>
  role("button", name, { nameMatch: "prefix", scope: ".dropdown:visible" });

// Source: packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx (BlockFormatDropDown).
export const BLOCK_ITEM = {
  bulletList: dropdownItem("Bullet List"),
  checkList: dropdownItem("Check List"),
  code: dropdownItem("Code Block"),
  heading1: dropdownItem("Heading 1"),
  heading2: dropdownItem("Heading 2"),
  heading3: dropdownItem("Heading 3"),
  normal: dropdownItem("Normal"),
  numberedList: dropdownItem("Numbered List"),
  quote: dropdownItem("Quote"),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx (Insert DropDown).
export const INSERT_ITEM = {
  collapsible: dropdownItem("Collapsible container"),
  columns: dropdownItem("Columns Layout"),
  date: dropdownItem("Date"),
  equation: dropdownItem("Equation"),
  excalidraw: dropdownItem("Excalidraw"),
  figma: dropdownItem("Figma Document"),
  horizontalRule: dropdownItem("Horizontal Rule"),
  image: dropdownItem("Image"),
  pageBreak: dropdownItem("Page Break"),
  poll: dropdownItem("Poll"),
  sticky: dropdownItem("Sticky Note"),
  table: dropdownItem("Table"),
  tweet: dropdownItem("X(Tweet)"),
  youtube: dropdownItem("Youtube Video"),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx (additional styles DropDown).
export const MORE_STYLE_ITEM = {
  capitalize: dropdownItem("Capitalize"),
  clear: dropdownItem("Clear Formatting"),
  highlight: dropdownItem("Highlight"),
  lowercase: dropdownItem("Lowercase"),
  strikethrough: dropdownItem("Strikethrough"),
  subscript: dropdownItem("Subscript"),
  superscript: dropdownItem("Superscript"),
  uppercase: dropdownItem("Uppercase"),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx (ElementFormatDropdown).
export const ALIGN_ITEM = {
  center: dropdownItem("Center Align"),
  end: dropdownItem("End Align"),
  indent: dropdownItem("Indent"),
  justify: dropdownItem("Justify Align"),
  left: dropdownItem("Left Align"),
  outdent: dropdownItem("Outdent"),
  right: dropdownItem("Right Align"),
  start: dropdownItem("Start Align"),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx (FONT_FAMILY_OPTIONS).
export const FONT_FAMILY_ARIAL = dropdownItem("Arial");
export const FONT_FAMILY_COURIER = dropdownItem("Courier New");

// Source: packages/lexical-playground/src/plugins/PagesReactExtension/PageSetupDropdown.tsx.
export const PAGE_ITEM = {
  a4: dropdownItem("A4"),
  landscape: dropdownItem("Landscape"),
  margins: dropdownItem("Margins"),
  narrowMargins: dropdownItem('Narrow (0.25")'),
  orientation: dropdownItem("Orientation"),
  pageSize: dropdownItem("Page size"),
  pageless: dropdownItem("Pageless"),
  portrait: dropdownItem("Portrait"),
} satisfies Readonly<Record<string, LocatorSpec>>;

// Source: packages/lexical-playground/src/plugins/TableActionMenuPlugin/index.tsx.
export const TABLE_VERTICAL_ITEM = {
  bottom: dropdownItem("Bottom Align"),
  middle: dropdownItem("Middle Align"),
  top: dropdownItem("Top Align"),
} satisfies Readonly<Record<string, LocatorSpec>>;

export const query = (extra: Query = {}): Query => ({ ...BASE_QUERY, ...extra });

export const scenario = (
  input: Readonly<{
    activationExercise: string;
    group: string;
    id: string;
    networkExpectation?: NetworkExpectation;
    steps: ReadonlyArray<Step>;
    title: string;
  }>
): Scenario =>
  defineScenario({
    ...input,
    networkExpectation: input.networkExpectation ?? "none",
    scripted: true,
  });

export const manualScenario = (
  input: Readonly<{
    activationExercise: string;
    group: string;
    id: string;
    networkExpectation?: NetworkExpectation;
    reason: string;
    title: string;
  }>
): Scenario =>
  defineScenario({
    activationExercise: input.activationExercise,
    group: input.group,
    id: input.id,
    manualReason: input.reason,
    networkExpectation: input.networkExpectation ?? "none",
    scripted: false,
    steps: [markManual(input.reason)],
    title: input.title,
  });

export const baseLifecycle = (
  activation: ReadonlyArray<Step>,
  output: LocatorSpec,
  options: Readonly<{
    afterActivation?: ReadonlyArray<Step>;
    beforeActivation?: ReadonlyArray<Step>;
    query?: Query;
    seed?: string;
  }> = {}
): ReadonlyArray<Step> => [
  goto("/", query(options.query)),
  expectSelector(EDITOR),
  type(EDITOR, options.seed ?? "Evidence lifecycle"),
  ...(options.beforeActivation ?? [keyboard("Control+A", EDITOR)]),
  ...activation,
  expectSelector(output),
  screenshot("activated"),
  ...(options.afterActivation ?? []),
  keyboard("Control+Z", EDITOR),
  screenshot("undone"),
  keyboard("Control+Y", EDITOR),
  expectSelector(output),
  clipboardCopy(EDITOR),
  keyboard("End", EDITOR),
  keyboard("Enter", EDITOR),
  clipboardPaste(EDITOR),
  click(ACTION.exportJson, { downloadSlot: "serialized-json" }),
  setViewport(480, 900),
  expectSelector(EDITOR),
  screenshot("narrow-keyboard-copy-paste-redone"),
  keyboard("Control+A", EDITOR),
  keyboard("Backspace", EDITOR),
  expectSelector(EDITOR),
];

export const nodeLifecycle = (
  activation: ReadonlyArray<Step>,
  output: LocatorSpec,
  options: Readonly<{
    afterActivation?: ReadonlyArray<Step>;
    beforeActivation?: ReadonlyArray<Step>;
    clipboardRoundTrip?: ReadonlyArray<Step>;
    query?: Query;
    seed?: string;
  }> = {}
): ReadonlyArray<Step> => [
  goto("/", query(options.query)),
  expectSelector(EDITOR),
  ...(options.seed === undefined ? [] : [type(EDITOR, options.seed)]),
  ...(options.beforeActivation ?? []),
  ...activation,
  expectSelector(output),
  screenshot("created"),
  ...(options.afterActivation ?? []),
  keyboard("Control+Z", EDITOR),
  screenshot("undone"),
  keyboard("Control+Y", EDITOR),
  expectSelector(output),
  ...(options.clipboardRoundTrip ?? [
    clipboardCopy(EDITOR),
    keyboard("End", EDITOR),
    keyboard("Enter", EDITOR),
    clipboardPaste(EDITOR),
  ]),
  click(ACTION.exportJson, { downloadSlot: "serialized-json" }),
  setViewport(480, 900),
  expectSelector(output),
  screenshot("narrow-redone-and-serialized"),
  keyboard("Control+A", EDITOR),
  keyboard("Backspace", EDITOR),
  expectSelector(EDITOR),
];

export const multiPathLifecycle = (
  activations: ReadonlyArray<ReadonlyArray<Step>>,
  output: LocatorSpec,
  options: Readonly<{ query?: Query }> = {}
): ReadonlyArray<Step> => [
  goto("/", query(options.query)),
  expectSelector(EDITOR),
  ...activations.flatMap((activation, index) => [
    ...activation,
    expectSelector(output),
    ...(index < 3 ? [screenshot(`activation-path-${index + 1}`)] : []),
    ...(index === activations.length - 1
      ? []
      : [keyboard("Control+Z", EDITOR), keyboard("Control+A", EDITOR), keyboard("Backspace", EDITOR)]),
  ]),
  clipboardCopy(EDITOR),
  keyboard("End", EDITOR),
  keyboard("Enter", EDITOR),
  clipboardPaste(EDITOR),
  click(ACTION.exportJson, { downloadSlot: "serialized-json" }),
  setViewport(480, 900),
  expectSelector(EDITOR),
  screenshot("narrow-keyboard-copy-paste-serialized"),
  keyboard("Control+A", EDITOR),
  keyboard("Backspace", EDITOR),
  expectSelector(EDITOR),
];

export const markdownLifecycle = (
  source: string,
  output: LocatorSpec,
  options: Readonly<{ commit?: string; query?: Query }> = {}
): ReadonlyArray<Step> =>
  nodeLifecycle(
    [type(EDITOR, source), ...(options.commit === undefined ? [] : [keyboard(options.commit, EDITOR)])],
    output,
    {
      afterActivation: [
        click(ACTION.markdownTo),
        expectSelector(EDITOR),
        click(ACTION.markdownFrom),
        expectSelector(output),
      ],
      query: options.query,
    }
  );

export const surfaceLifecycle = (
  steps: ReadonlyArray<Step>,
  options: Readonly<{ afterActivation?: ReadonlyArray<Step>; query?: Query; seed?: string }> = {}
): ReadonlyArray<Step> => [
  goto("/", query(options.query)),
  expectSelector(EDITOR),
  ...(options.seed === undefined ? [] : [type(EDITOR, options.seed)]),
  screenshot("before"),
  ...steps,
  screenshot("after"),
  ...(options.afterActivation ?? []),
  setViewport(480, 900),
  keyboard("Tab"),
  expectSelector(EDITOR),
  screenshot("narrow-keyboard"),
  keyboard("Control+Z", EDITOR),
  keyboard("Control+Y", EDITOR),
  clipboardCopy(EDITOR),
  keyboard("End", EDITOR),
  keyboard("Enter", EDITOR),
  clipboardPaste(EDITOR),
  click(ACTION.exportJson, { downloadSlot: "surface-json" }),
  keyboard("Control+A", EDITOR),
  keyboard("Backspace", EDITOR),
  expectSelector(EDITOR),
];

export const slashActivation = (option: LocatorSpec): ReadonlyArray<Step> => [
  type(EDITOR, "/"),
  expectSelector(option),
  click(option),
];
