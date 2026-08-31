import { LiteralKit } from "@beep/schema/LiteralKit";
import { A, O } from "@beep/utils";
import { Match } from "effect";
import * as S from "effect/Schema";
import type {
  LexicalNode,
  ListItemNode,
  ListNode,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "../../Lexical.model.ts";

const StrictRootChildType = LiteralKit([
  "paragraph",
  "heading",
  "quote",
  "list",
  "code",
  "table",
  "artifact-ref",
  "youtube",
]);
const StrictInlineChildType = LiteralKit(["text", "tab", "linebreak", "link"]);
const StrictLeafInlineChildType = LiteralKit(StrictInlineChildType.omitOptions(["link"]));
const StrictListItemChildType = LiteralKit(["text", "tab", "linebreak", "link", "list"]);

const isStrictRootChildType = S.is(StrictRootChildType);
const isStrictInlineChildType = S.is(StrictInlineChildType);
const isStrictLeafInlineChildType = S.is(StrictLeafInlineChildType);
const isStrictListItemChildType = S.is(StrictListItemChildType);

const optionValueOrOne = (value: O.Option<number>): number => O.getOrElse(value, () => 1);

const tableCells = (row: TableRowNode.Type): ReadonlyArray<TableCellNode.Type> =>
  A.filter(row.children, (child): child is TableCellNode.Type => child.type === "tablecell");

const tableRows = (table: TableNode.Type): ReadonlyArray<TableRowNode.Type> =>
  A.filter(table.children, (child): child is TableRowNode.Type => child.type === "tablerow");

const tableRowWidth = (row: TableRowNode.Type): number =>
  A.reduce(tableCells(row), 0, (width, cell) => width + optionValueOrOne(cell.colSpan));

const tableOptionWithin = (value: O.Option<number>, maximum: number): boolean =>
  !O.exists(value, (candidate) => candidate > maximum);

const placeTableCell = (occupancy: ReadonlyArray<number>, cell: TableCellNode.Type): O.Option<ReadonlyArray<number>> =>
  A.findFirstIndex(occupancy, (remainingRows) => remainingRows === 0).pipe(
    O.filter((startColumn) => {
      const endColumn = startColumn + optionValueOrOne(cell.colSpan);
      return (
        endColumn <= occupancy.length &&
        A.every(
          occupancy,
          (remainingRows, columnIndex) => columnIndex < startColumn || columnIndex >= endColumn || remainingRows === 0
        )
      );
    }),
    O.map((startColumn) => {
      const endColumn = startColumn + optionValueOrOne(cell.colSpan);
      const rowSpan = optionValueOrOne(cell.rowSpan);
      return A.map(occupancy, (remainingRows, columnIndex) =>
        columnIndex >= startColumn && columnIndex < endColumn ? rowSpan : remainingRows
      );
    })
  );

const fillTableRow = (occupancy: ReadonlyArray<number>, row: TableRowNode.Type): O.Option<ReadonlyArray<number>> =>
  A.reduce(tableCells(row), O.some(occupancy), (state, cell) =>
    O.flatMap(state, (current) => placeTableCell(current, cell))
  ).pipe(
    O.filter((filled) => A.every(filled, (remainingRows) => remainingRows > 0)),
    O.map(A.map((remainingRows) => remainingRows - 1))
  );

const hasValidTableGrid = (rows: ReadonlyArray<TableRowNode.Type>, columnCount: number): boolean =>
  A.reduce(rows, O.some<ReadonlyArray<number>>(A.makeBy(columnCount, () => 0)), (state, row) =>
    O.flatMap(state, (occupancy) => fillTableRow(occupancy, row))
  ).pipe(O.exists(A.every((remainingRows) => remainingRows === 0)));

const hasStrictTableChildren = (node: TableNode.Type): boolean => {
  const rows = tableRows(node);
  if (!A.isReadonlyArrayNonEmpty(rows) || rows.length !== node.children.length) return false;

  const columnCount = tableRowWidth(rows[0]);
  return (
    columnCount > 0 &&
    A.every(
      rows,
      (row) =>
        A.isReadonlyArrayNonEmpty(row.children) &&
        tableCells(row).length === row.children.length &&
        hasStrictNodeChildren(row)
    ) &&
    hasValidTableGrid(rows, columnCount) &&
    !O.exists(node.colWidths, (widths) => widths.length !== columnCount) &&
    tableOptionWithin(node.frozenColumnCount, columnCount) &&
    tableOptionWithin(node.frozenRowCount, rows.length)
  );
};

const listItemCheckStateMatches = (list: ListNode.Type, item: ListItemNode.Type): boolean =>
  list.listType === "check" || O.isNone(item.checked);

const hasStrictListChildren = (node: ListNode.Type): boolean =>
  A.isReadonlyArrayNonEmpty(node.children) &&
  A.every(
    node.children,
    (child) => child.type === "listitem" && listItemCheckStateMatches(node, child) && hasStrictNodeChildren(child)
  );

const strictNodeChildren: (node: LexicalNode.Type) => boolean = Match.type<LexicalNode.Type>().pipe(
  Match.discriminatorsExhaustive("type")({
    text: () => true,
    tab: () => true,
    linebreak: () => true,
    "artifact-ref": () => true,
    youtube: () => true,
    root: (node) =>
      A.isReadonlyArrayNonEmpty(node.children) &&
      A.every(node.children, (child) => isStrictRootChildType(child.type) && hasStrictNodeChildren(child)),
    paragraph: (node) =>
      A.every(node.children, (child) => isStrictInlineChildType(child.type) && hasStrictNodeChildren(child)),
    heading: (node) =>
      A.every(node.children, (child) => isStrictInlineChildType(child.type) && hasStrictNodeChildren(child)),
    quote: (node) =>
      A.every(node.children, (child) =>
        O.contains(node.shadowRoot, true)
          ? isStrictRootChildType(child.type) && hasStrictNodeChildren(child)
          : isStrictInlineChildType(child.type) && hasStrictNodeChildren(child)
      ),
    link: (node) =>
      A.isReadonlyArrayNonEmpty(node.children) &&
      A.every(node.children, (child) => isStrictLeafInlineChildType(child.type) && hasStrictNodeChildren(child)),
    code: (node) =>
      A.every(node.children, (child) => isStrictLeafInlineChildType(child.type) && hasStrictNodeChildren(child)),
    list: hasStrictListChildren,
    listitem: (node) =>
      A.every(node.children, (child) => isStrictListItemChildType(child.type) && hasStrictNodeChildren(child)),
    table: hasStrictTableChildren,
    tablerow: (node) =>
      A.isReadonlyArrayNonEmpty(node.children) &&
      A.every(node.children, (child) => child.type === "tablecell" && hasStrictNodeChildren(child)),
    tablecell: (node) =>
      A.isReadonlyArrayNonEmpty(node.children) &&
      A.every(node.children, (child) => isStrictRootChildType(child.type) && hasStrictNodeChildren(child)),
  })
);

export function hasStrictNodeChildren(node: LexicalNode.Type): boolean {
  return strictNodeChildren(node);
}

export const isStrictLexicalNode = hasStrictNodeChildren;
