import { click, clipboardPaste, expectSelector, keyboard, type } from "./dsl.ts";
import { GROUP, INSERT_ITEM, manualScenario, nodeLifecycle, scenario, surfaceLifecycle } from "./helpers.ts";
import {
  COMMENTS,
  CUSTOM_OUTPUT,
  EDITOR,
  INSERT_MENU,
  LAYOUT_DIALOG,
  OUTPUT,
  SLASH_ITEM,
  TABLE_DIALOG,
} from "./sourced.ts";

const insert = (item: (typeof INSERT_ITEM)[keyof typeof INSERT_ITEM]) => [click(INSERT_MENU), click(item)] as const;
const insertTable = [
  ...insert(INSERT_ITEM.table),
  type(TABLE_DIALOG.rows, "2", "fill"),
  type(TABLE_DIALOG.columns, "2", "fill"),
  click(TABLE_DIALOG.confirm),
] as const;
const insertLayout = [
  ...insert(INSERT_ITEM.columns),
  expectSelector(LAYOUT_DIALOG.defaultLayout),
  click(LAYOUT_DIALOG.insert),
] as const;
const collaborationReason =
  "The pinned npm dev command starts only Vite; realtime collaboration additionally requires the separately managed y-websocket endpoint and a second browser peer, so connection/reconciliation must be closed in an interactive two-peer session.";

export const scenarios = [
  manualScenario({
    activationExercise: "Start the collaboration relay, open two peers, and reconcile concurrent edits.",
    group: GROUP.programmatic,
    id: "collaboration.realtime",
    reason: collaborationReason,
    title: "Realtime collaboration",
  }),
  scenario({
    activationExercise: "Compose the comments extension, create a marked range, and inspect the thread panel.",
    group: GROUP.programmatic,
    id: "comments.threads",
    steps: surfaceLifecycle(
      [
        keyboard("Control+A", EDITOR),
        keyboard("Control+Alt+M", EDITOR),
        type(COMMENTS.input, "Thread evidence", "fill"),
        click(COMMENTS.commentButton),
        expectSelector(COMMENTS.panel),
        expectSelector(COMMENTS.mark),
      ],
      {
        afterActivation: [click(COMMENTS.hide), expectSelector(COMMENTS.panel, "detached")],
        seed: "Thread range",
      }
    ),
    title: "Comment threads",
  }),
  scenario({
    activationExercise: "Insert the owning Collapsible composite and exercise its content child.",
    group: GROUP.programmatic,
    id: "node.collapsible-content",
    steps: nodeLifecycle(insert(INSERT_ITEM.collapsible), CUSTOM_OUTPUT.collapsibleContent),
    title: "Collapsible content",
  }),
  scenario({
    activationExercise: "Insert the owning Collapsible composite and exercise its title child.",
    group: GROUP.programmatic,
    id: "node.collapsible-title",
    steps: nodeLifecycle(insert(INSERT_ITEM.collapsible), CUSTOM_OUTPUT.collapsibleTitle),
    title: "Collapsible title",
  }),
  scenario({
    activationExercise: "Insert the owning Columns Layout composite and exercise its layout item children.",
    group: GROUP.programmatic,
    id: "node.layout-item",
    steps: nodeLifecycle(insertLayout, OUTPUT.layoutItem),
    title: "Layout item",
  }),
  scenario({
    activationExercise: "Insert a core line break with Shift+Enter and round-trip history and JSON.",
    group: GROUP.programmatic,
    id: "node.line-break",
    steps: nodeLifecycle(
      [type(EDITOR, "before"), keyboard("Shift+Enter", EDITOR), type(EDITOR, "after")],
      OUTPUT.lineBreak
    ),
    title: "Line break",
  }),
  scenario({
    activationExercise: "Create the owning list composite and exercise its registered list item child.",
    group: GROUP.programmatic,
    id: "node.list-item",
    steps: nodeLifecycle(
      [type(EDITOR, "/"), click(SLASH_ITEM.numberedList), type(EDITOR, "List item evidence")],
      OUTPUT.listItem,
      {
        clipboardRoundTrip: [
          keyboard("Home", EDITOR),
          keyboard("Shift+End", EDITOR),
          keyboard("Control+C", EDITOR),
          keyboard("End", EDITOR),
          keyboard("Enter", EDITOR),
          clipboardPaste(EDITOR),
        ],
      }
    ),
    title: "List item",
  }),
  scenario({
    activationExercise: "Create a core TabNode in a code block with the Tab key.",
    group: GROUP.programmatic,
    id: "node.tab",
    steps: nodeLifecycle(
      [
        type(EDITOR, "/"),
        click(SLASH_ITEM.code),
        type(EDITOR, "before"),
        keyboard("Tab", EDITOR),
        type(EDITOR, "after"),
      ],
      OUTPUT.code
    ),
    title: "Tab",
  }),
  scenario({
    activationExercise: "Insert the owning Table composite and exercise a registered table cell child.",
    group: GROUP.programmatic,
    id: "node.table-cell",
    steps: nodeLifecycle(insertTable, OUTPUT.tableCell),
    title: "Table cell",
  }),
  scenario({
    activationExercise: "Insert the owning Table composite and exercise a registered table row child.",
    group: GROUP.programmatic,
    id: "node.table-row",
    steps: nodeLifecycle(insertTable, OUTPUT.tableRow),
    title: "Table row",
  }),
  scenario({
    activationExercise: "Type core text, edit it, and exercise undo, redo, clipboard, and JSON serialization.",
    group: GROUP.programmatic,
    id: "node.text",
    steps: nodeLifecycle([type(EDITOR, "Core text evidence")], OUTPUT.paragraph),
    title: "Text",
  }),
] as const;
