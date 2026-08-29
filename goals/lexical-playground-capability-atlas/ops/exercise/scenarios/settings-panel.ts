import {
  click,
  clipboardCopy,
  clipboardPaste,
  css,
  expectAttr,
  expectSelector,
  goto,
  keyboard,
  screenshot,
  setViewport,
  type,
} from "./dsl.ts";
import { GROUP, query, scenario } from "./helpers.ts";
import { ACTION, EDITOR, MAIN_TOOLBAR, OUTPUT, SETTING_QUERY, SETTINGS_BUTTON, settingSwitch } from "./sourced.ts";
import type { Step } from "./dsl.ts";

type SettingKey = (typeof SETTING_QUERY)[keyof typeof SETTING_QUERY];

const PLAIN_TEXT_EDITOR = css(".editor-container.plain-text");
const RICH_TEXT_SWITCH = settingSwitch("Rich Text");

const panelSetting = (
  id: string,
  title: string,
  key: SettingKey,
  label: string,
  behavior: ReadonlyArray<Step> = [type(EDITOR, `${title} evidence`)],
  enabledScreenshotLabel = "enabled-and-serialized"
) => {
  const control = settingSwitch(label);
  return scenario({
    activationExercise: `Toggle ${label} in the source-backed Playground settings panel; record behavior, focus, serialization, reset, and narrow layout.`,
    group: GROUP.settingsPanel,
    id,
    steps: [
      goto("/", query({ [key]: false })),
      expectSelector(EDITOR),
      click(SETTINGS_BUTTON),
      expectSelector(control),
      click(control),
      expectAttr(control, "aria-checked", "true"),
      ...behavior,
      click(ACTION.exportJson, { downloadSlot: "setting-enabled-json" }),
      screenshot(enabledScreenshotLabel),
      setViewport(480, 900),
      keyboard("Tab"),
      screenshot("enabled-narrow-keyboard"),
      click(control),
      expectAttr(control, "aria-checked", "false"),
      screenshot("reset"),
      clipboardCopy(EDITOR),
      keyboard("End", EDITOR),
      keyboard("Enter", EDITOR),
      clipboardPaste(EDITOR),
      keyboard("Control+Z", EDITOR),
      keyboard("Control+Y", EDITOR),
      keyboard("Control+A", EDITOR),
      keyboard("Backspace", EDITOR),
    ],
    title,
  });
};

const querySetting = (
  id: string,
  title: string,
  key: SettingKey,
  behavior: ReadonlyArray<Step> = [type(EDITOR, `${title} evidence`)]
) =>
  scenario({
    activationExercise: `Enable the non-panel ${key} setting through setupEnv's exact query parameter, record dependent behavior, then reload without it to reset.`,
    group: GROUP.settingsPanel,
    id,
    steps: [
      goto("/", query({ [key]: true })),
      expectSelector(EDITOR),
      ...behavior,
      click(ACTION.exportJson, { downloadSlot: "query-setting-enabled-json" }),
      screenshot("query-enabled-and-serialized"),
      setViewport(480, 900),
      keyboard("Tab"),
      screenshot("query-enabled-narrow-keyboard"),
      goto("/", query({ [key]: false })),
      expectSelector(EDITOR),
      screenshot("query-reset"),
      clipboardCopy(EDITOR),
      keyboard("End", EDITOR),
      keyboard("Enter", EDITOR),
      clipboardPaste(EDITOR),
      keyboard("Control+Z", EDITOR),
      keyboard("Control+Y", EDITOR),
      keyboard("Control+A", EDITOR),
      keyboard("Backspace", EDITOR),
    ],
    title,
  });

const reloadPanelSetting = (id: string, title: string, key: SettingKey, label: string) => {
  const control = settingSwitch(label);
  return scenario({
    activationExercise: `Toggle the reload-gated ${label} switch, reopen settings after reload, verify its exact query-backed state, then reset it.`,
    group: GROUP.settingsPanel,
    id,
    steps: [
      goto("/", query({ [key]: false })),
      expectSelector(EDITOR),
      click(SETTINGS_BUTTON),
      click(control),
      expectSelector(EDITOR),
      click(SETTINGS_BUTTON),
      expectAttr(control, "aria-checked", "true"),
      type(EDITOR, `${title} evidence`),
      click(ACTION.exportJson, { downloadSlot: "reload-setting-json" }),
      screenshot("enabled-after-reload"),
      setViewport(480, 900),
      keyboard("Tab"),
      screenshot("enabled-narrow-keyboard"),
      click(control),
      expectSelector(EDITOR),
      screenshot("reset-after-reload"),
      clipboardCopy(EDITOR),
      keyboard("End", EDITOR),
      keyboard("Enter", EDITOR),
      clipboardPaste(EDITOR),
      keyboard("Control+Z", EDITOR),
      keyboard("Control+Y", EDITOR),
      keyboard("Control+A", EDITOR),
      keyboard("Backspace", EDITOR),
    ],
    title,
  });
};

export const scenarios = [
  panelSetting(
    "authoring.visible-non-printing",
    "Visible non-printing authoring",
    SETTING_QUERY.visibleNonPrinting,
    "Visible Non-Printing",
    [type(EDITOR, "space evidence "), expectSelector(OUTPUT.visibleNonPrinting)]
  ),
  panelSetting("setting.autocomplete", "Autocomplete", SETTING_QUERY.autocomplete, "Autocomplete", [
    type(EDITOR, "collab"),
    expectSelector(OUTPUT.autocomplete),
  ]),
  panelSetting("setting.block-selection", "Block selection", SETTING_QUERY.blockSelection, "Block selection"),
  panelSetting(
    "setting.bracket-special-text",
    "Bracket special text",
    SETTING_QUERY.bracketSpecialText,
    "Use Brackets for Highlighting",
    [type(EDITOR, "[evidence]"), expectSelector(OUTPUT.specialText)]
  ),
  panelSetting("setting.char-limit-utf16", "UTF-16 character limit", SETTING_QUERY.charLimitUtf16, "Char Limit", [
    type(EDITOR, "123456789"),
    expectSelector(OUTPUT.charLimit),
  ]),
  panelSetting("setting.char-limit-utf8", "UTF-8 character limit", SETTING_QUERY.charLimitUtf8, "Char Limit (UTF-8)", [
    type(EDITOR, "éééééé"),
    expectSelector(OUTPUT.charLimit),
  ]),
  querySetting("setting.checklist-focus", "Checklist focus policy", SETTING_QUERY.checklistFocus),
  panelSetting(
    "setting.code-highlighted",
    "Code highlighting",
    SETTING_QUERY.codeHighlighted,
    "Enable Code Highlighting"
  ),
  panelSetting(
    "setting.code-shiki",
    "Shiki code highlighting",
    SETTING_QUERY.codeShiki,
    "Use Shiki for Code Highlighting"
  ),
  reloadPanelSetting("setting.collaboration", "Collaboration", SETTING_QUERY.collaboration, "Collaboration"),
  querySetting("setting.collaboration-v2", "Collaboration v2", SETTING_QUERY.collaborationV2),
  querySetting("setting.empty-editor", "Empty initial editor", SETTING_QUERY.emptyEditor),
  panelSetting("setting.fit-nested-tables", "Fit nested tables", SETTING_QUERY.fitNestedTables, "Fit nested tables"),
  panelSetting(
    "setting.lexical-context-menu",
    "Lexical context menu",
    SETTING_QUERY.lexicalContextMenu,
    "Use Lexical Context Menu"
  ),
  panelSetting("setting.link-attributes", "Link attributes", SETTING_QUERY.linkAttributes, "Link Attributes"),
  querySetting("setting.list-strict-indent", "Strict list indent", SETTING_QUERY.listStrictIndent),
  panelSetting("setting.max-length", "Maximum length", SETTING_QUERY.maxLength, "Max Length"),
  panelSetting(
    "setting.measure-typing-perf",
    "Typing performance logger",
    SETTING_QUERY.measureTypingPerf,
    "Measure Perf"
  ),
  panelSetting(
    "setting.nested-editor-tree-view",
    "Nested editor debug view",
    SETTING_QUERY.nestedEditorTreeView,
    "Nested Editors Debug View"
  ),
  panelSetting("setting.nested-tables", "Nested tables", SETTING_QUERY.nestedTables, "Nested Tables"),
  panelSetting(
    "setting.preserve-markdown-newlines",
    "Preserve Markdown newlines",
    SETTING_QUERY.preserveMarkdownNewlines,
    "Preserve newlines in Markdown"
  ),
  panelSetting(
    "setting.retain-selection",
    "Retained selection display",
    SETTING_QUERY.retainSelection,
    "Retain selection"
  ),
  scenario({
    activationExercise:
      "Enable Rich Text from plain-text mode, reopen Settings after the editor rebuild, then restore and verify plain-text mode.",
    group: GROUP.settingsPanel,
    id: "setting.rich-text",
    steps: [
      goto("/", query({ [SETTING_QUERY.richText]: false })),
      expectSelector(EDITOR),
      expectSelector(PLAIN_TEXT_EDITOR),
      click(SETTINGS_BUTTON),
      expectSelector(RICH_TEXT_SWITCH),
      expectAttr(RICH_TEXT_SWITCH, "aria-checked", "false"),
      click(RICH_TEXT_SWITCH),
      expectSelector(MAIN_TOOLBAR),
      click(SETTINGS_BUTTON),
      expectSelector(RICH_TEXT_SWITCH),
      expectAttr(RICH_TEXT_SWITCH, "aria-checked", "true"),
      click(ACTION.exportJson, { downloadSlot: "setting-enabled-json" }),
      screenshot("enabled-and-serialized"),
      setViewport(480, 900),
      keyboard("Tab"),
      screenshot("enabled-narrow-keyboard"),
      click(RICH_TEXT_SWITCH),
      expectSelector(MAIN_TOOLBAR, "hidden"),
      expectSelector(PLAIN_TEXT_EDITOR),
      click(SETTINGS_BUTTON),
      expectSelector(RICH_TEXT_SWITCH),
      expectAttr(RICH_TEXT_SWITCH, "aria-checked", "false"),
      screenshot("reset"),
      clipboardCopy(EDITOR),
      keyboard("End", EDITOR),
      keyboard("Enter", EDITOR),
      clipboardPaste(EDITOR),
      keyboard("Control+Z", EDITOR),
      keyboard("Control+Y", EDITOR),
      keyboard("Control+A", EDITOR),
      keyboard("Backspace", EDITOR),
    ],
    title: "Rich-text mode",
  }),
  panelSetting("setting.shadow-dom", "Shadow DOM", SETTING_QUERY.shadowDom, "Render in Shadow DOM"),
  querySetting("setting.table-cell-background", "Table cell backgrounds", SETTING_QUERY.tableCellBackground),
  querySetting("setting.table-cell-merge", "Table cell merge", SETTING_QUERY.tableCellMerge),
  querySetting("setting.table-horizontal-scroll", "Table horizontal scroll", SETTING_QUERY.tableHorizontalScroll),
  panelSetting(
    "setting.table-of-contents",
    "Table of contents diagnostic",
    SETTING_QUERY.tableOfContents,
    "Table Of Contents"
  ),
  panelSetting(
    "setting.tree-view",
    "Tree and state debug view",
    SETTING_QUERY.treeView,
    "Debug View",
    [type(EDITOR, "Tree view evidence"), expectSelector(OUTPUT.treeView)],
    "settings-panel-tree-view"
  ),
  panelSetting(
    "setting.visible-non-printing",
    "Visible non-printing characters",
    SETTING_QUERY.visibleNonPrinting,
    "Visible Non-Printing",
    [type(EDITOR, "space evidence "), expectSelector(OUTPUT.visibleNonPrinting)]
  ),
] as const;
