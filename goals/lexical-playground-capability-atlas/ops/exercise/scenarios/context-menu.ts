import { click, drag, expectSelector, hover, type } from "./dsl.ts";
import { GROUP, INSERT_ITEM, scenario, surfaceLifecycle, TABLE_VERTICAL_ITEM } from "./helpers.ts";
import {
  COLOR_SWATCH,
  EDITOR,
  INSERT_MENU,
  OUTPUT,
  SETTING_QUERY,
  TABLE_ACTION,
  TABLE_ACTION_BUTTON,
  TABLE_DIALOG,
  TABLE_HOVER,
  TABLE_RESIZER,
  tableCell,
} from "./sourced.ts";
import type { LocatorSpec, Step } from "./dsl.ts";

const insertTable = (rows = "2", columns = "2", output: LocatorSpec = OUTPUT.table): ReadonlyArray<Step> => [
  click(INSERT_MENU),
  click(INSERT_ITEM.table),
  type(TABLE_DIALOG.rows, rows, "fill"),
  type(TABLE_DIALOG.columns, columns, "fill"),
  click(TABLE_DIALOG.confirm),
  expectSelector(output),
];
const openCellMenu = (cell = tableCell(0)): ReadonlyArray<Step> => [
  click(cell),
  expectSelector(TABLE_ACTION_BUTTON),
  click(TABLE_ACTION_BUTTON),
];

export const scenarios = [
  scenario({
    activationExercise:
      "Insert a table, open its cell action menu, choose Table cell background, and choose a source-backed color swatch.",
    group: GROUP.contextMenu,
    id: "table.cell-background",
    steps: surfaceLifecycle([...insertTable(), ...openCellMenu(), click(TABLE_ACTION.background), click(COLOR_SWATCH)]),
    title: "Table cell background",
  }),
  scenario({
    activationExercise:
      "Insert a table, hover its header affordance, and drag the accessible column reorder handle to the next column.",
    group: GROUP.contextMenu,
    id: "table.column-reorder",
    steps: surfaceLifecycle([
      ...insertTable(),
      hover(tableCell(0)),
      expectSelector(TABLE_HOVER.dragColumn),
      drag(TABLE_HOVER.dragColumn, { target: tableCell(1) }),
    ]),
    title: "Table column reordering",
  }),
  scenario({
    activationExercise: "Freeze the first row and column from the table contextual menu.",
    group: GROUP.contextMenu,
    id: "table.freeze",
    steps: surfaceLifecycle([
      ...insertTable(),
      ...openCellMenu(),
      click(TABLE_ACTION.freezeRow),
      ...openCellMenu(),
      click(TABLE_ACTION.freezeColumn),
    ]),
    title: "Frozen row and column",
  }),
  scenario({
    activationExercise: "Toggle row and column header states through the table contextual menu.",
    group: GROUP.contextMenu,
    id: "table.headers",
    steps: surfaceLifecycle([
      ...insertTable(),
      ...openCellMenu(),
      click(TABLE_ACTION.rowHeader),
      ...openCellMenu(),
      click(TABLE_ACTION.columnHeader),
    ]),
    title: "Table header state",
  }),
  scenario({
    activationExercise: "Drag across adjacent cells, open the selected-cell action menu, then invoke Merge cells.",
    group: GROUP.contextMenu,
    id: "table.merge",
    steps: surfaceLifecycle(
      [
        ...insertTable(),
        drag(tableCell(0), { target: tableCell(1) }),
        expectSelector(TABLE_ACTION_BUTTON),
        click(TABLE_ACTION_BUTTON),
        click(TABLE_ACTION.merge),
      ],
      { query: { [SETTING_QUERY.tableCellMerge]: true } }
    ),
    title: "Table merge and unmerge",
  }),
  scenario({
    activationExercise: "Enable nested tables, insert a table, focus its first cell, then insert a child table.",
    group: GROUP.contextMenu,
    id: "table.nested",
    steps: surfaceLifecycle([...insertTable(), click(tableCell(0)), ...insertTable("2", "2", OUTPUT.nestedTable)], {
      query: { [SETTING_QUERY.nestedTables]: true },
    }),
    title: "Nested table editing",
  }),
  scenario({
    activationExercise: "Enable horizontal table scroll, insert a 5x5 table, resize a cell, then run the 480x900 pass.",
    group: GROUP.contextMenu,
    id: "table.resize-scroll",
    steps: surfaceLifecycle(
      [
        ...insertTable("5", "5"),
        hover(tableCell(0)),
        expectSelector(TABLE_RESIZER),
        drag(TABLE_RESIZER, { delta: { x: 60, y: 0 } }),
        expectSelector(OUTPUT.tableScrollable),
      ],
      { query: { [SETTING_QUERY.tableHorizontalScroll]: true } }
    ),
    title: "Table resize and scroll",
  }),
  scenario({
    activationExercise: "Invoke row striping through the table contextual menu.",
    group: GROUP.contextMenu,
    id: "table.row-striping",
    steps: surfaceLifecycle([
      ...insertTable("3", "3"),
      ...openCellMenu(),
      click(TABLE_ACTION.rowStriping),
      expectSelector(OUTPUT.tableStriped),
    ]),
    title: "Table row striping",
  }),
  scenario({
    activationExercise: "Insert a row and column, then delete a row and column through contextual controls.",
    group: GROUP.contextMenu,
    id: "table.rows-columns",
    steps: surfaceLifecycle([
      ...insertTable(),
      ...openCellMenu(),
      click(TABLE_ACTION.insertRowBelow),
      ...openCellMenu(),
      click(TABLE_ACTION.insertColumnAfter),
      ...openCellMenu(),
      click(TABLE_ACTION.deleteRow),
      ...openCellMenu(),
      click(TABLE_ACTION.deleteColumn),
    ]),
    title: "Table row and column actions",
  }),
  scenario({
    activationExercise: "Populate a table column, open its hover sort affordance, and choose Sort Ascending.",
    group: GROUP.contextMenu,
    id: "table.sort",
    steps: surfaceLifecycle([
      ...insertTable("3", "2"),
      click(tableCell(0)),
      type(EDITOR, "b"),
      click(tableCell(2)),
      type(EDITOR, "a"),
      hover(tableCell(0)),
      click(TABLE_HOVER.sort),
      click(TABLE_HOVER.sortAscending),
    ]),
    title: "Table sorting",
  }),
  scenario({
    activationExercise: "Open vertical alignment controls from the table cell menu and choose Middle Align.",
    group: GROUP.contextMenu,
    id: "table.vertical-align",
    steps: surfaceLifecycle([
      ...insertTable(),
      ...openCellMenu(),
      click(TABLE_ACTION.verticalAlign),
      click(TABLE_VERTICAL_ITEM.middle),
    ]),
    title: "Table vertical alignment",
  }),
] as const;
