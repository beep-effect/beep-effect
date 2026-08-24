import { scenarios as automatic } from "./automatic.ts";
import { scenarios as blockMenu } from "./block-menu.ts";
import { scenarios as browserApi } from "./browser-api.ts";
import { scenarios as contextMenu } from "./context-menu.ts";
import { scenarios as documentAction } from "./document-action.ts";
import { scenarios as draggableBlock } from "./draggable-block.ts";
import { scenarios as floatingToolbar } from "./floating-toolbar.ts";
import { scenarios as importer } from "./importer.ts";
import { scenarios as insertMenu } from "./insert-menu.ts";
import { scenarios as keyboard } from "./keyboard.ts";
import { scenarios as markdownShortcut } from "./markdown-shortcut.ts";
import { scenarios as pasteDrop } from "./paste-drop.ts";
import { scenarios as programmatic } from "./programmatic.ts";
import { scenarios as selection } from "./selection.ts";
import { scenarios as settingsPanel } from "./settings-panel.ts";
import { scenarios as slashMenu } from "./slash-menu.ts";
import { scenarios as toolbar } from "./toolbar.ts";
import { scenarios as typeahead } from "./typeahead.ts";
import type { Scenario } from "./dsl.ts";

export type ScenarioGroup = Readonly<{
  scenarios: ReadonlyArray<Scenario>;
  slug: string;
  title: string;
}>;

export const scenarioGroups: ReadonlyArray<ScenarioGroup> = [
  { scenarios: automatic, slug: "automatic", title: "Automatic transforms and recognition" },
  { scenarios: blockMenu, slug: "block-menu", title: "Block menu" },
  { scenarios: browserApi, slug: "browser-api", title: "Browser API" },
  { scenarios: contextMenu, slug: "context-menu", title: "Contextual and table menus" },
  { scenarios: documentAction, slug: "document-action", title: "Document actions" },
  { scenarios: draggableBlock, slug: "draggable-block", title: "Draggable block controls" },
  { scenarios: floatingToolbar, slug: "floating-toolbar", title: "Floating selection toolbar" },
  { scenarios: importer, slug: "importer", title: "Import boundaries" },
  { scenarios: insertMenu, slug: "insert-menu", title: "Toolbar Insert menu" },
  { scenarios: keyboard, slug: "keyboard", title: "Keyboard-first commands" },
  { scenarios: markdownShortcut, slug: "markdown-shortcut", title: "Markdown shortcuts and transformers" },
  { scenarios: pasteDrop, slug: "paste-drop", title: "Paste and drop" },
  { scenarios: programmatic, slug: "programmatic", title: "Programmatic and composite registration" },
  { scenarios: selection, slug: "selection", title: "Selection and pointer affordances" },
  { scenarios: settingsPanel, slug: "settings-panel", title: "Settings and query flags" },
  { scenarios: slashMenu, slug: "slash-menu", title: "Slash/component picker" },
  { scenarios: toolbar, slug: "toolbar", title: "Main toolbar and Page Setup" },
  { scenarios: typeahead, slug: "typeahead", title: "Entity typeahead" },
];

export const allScenarios: ReadonlyArray<Scenario> = scenarioGroups.flatMap(({ scenarios }) => scenarios);
