import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { columnFromLetters, columnLetters, MAX_COLUMN, MAX_ROW } from "../XlsxAddress.schema.ts";

const piece = new RegExp(
  A.join(
    [
      String.raw`(?<kept>"(?:[^"]|"")*"?|'(?:[^']|'')*'?|\[(?:[^[\]]|\[[^[\]]*\])*\]?)`,
      "(?<![._A-Za-z0-9])(?:" +
        String.raw`(?<fromColumnFixed>\$?)(?<fromColumn>[A-Z]{1,3}):(?<toColumnFixed>\$?)(?<toColumn>[A-Z]{1,3})` +
        String.raw`|(?<fromRowFixed>\$?)(?<fromRow>\d{1,7}):(?<toRowFixed>\$?)(?<toRow>\d{1,7})` +
        String.raw`|(?<columnFixed>\$?)(?<column>[A-Z]{1,3})(?<rowFixed>\$?)(?<row>\d{1,7})` +
        ")(?![_.(A-Za-z0-9!])",
    ],
    "|"
  ),
  "g"
);

/**
 * A formula's text with every relative reference moved by a number of columns and rows.
 *
 * **Details**
 * A shared formula is written once, on its first cell; the cells that share it say only which one. Each of them gets
 * the first cell's text with its relative references moved by the distance between the two cells, as Excel shows it.
 * A reference is a cell (`B2`), a whole-column range (`A:C`) or a whole-row range (`2:5`); each relative part moves
 * along its own axis and each `$` part stays. Text in double quotes is a string constant, text in single quotes a
 * sheet name, text in brackets a workbook index or a table's column, and the sheets a 3D reference spans (`JAN:DEC!`)
 * are sheet names: none of them holds a reference, so each is copied as it is written. A reference that would move
 * off the sheet is kept as written.
 *
 * The text is read piece by piece, the first that fits at each place: a quoted or bracketed piece, kept whole (a
 * doubled quote is a quote inside it, and a table's column may sit in a second pair of brackets), then a whole-column
 * range, a whole-row range or a cell. A reference stands apart from a name or a number on both sides, letters of
 * either case included, and is never followed by `!`: what is (`JAN:DEC!B2`, `A:C!B2`) names sheets.
 *
 * **Gotchas**
 * The text between matches is copied as each reference is moved: a replace callback cannot skip a match that would
 * move off the sheet without also losing its place.
 */
export const shifted = (input: {
  readonly formula: string;
  readonly columns: number;
  readonly rows: number;
}): string => {
  if (input.columns === 0 && input.rows === 0) return input.formula;
  let out = "";
  let at = 0;
  for (const found of Str.matchAll(piece)(input.formula)) {
    const moved = movedPiece(found.groups ?? {}, input.columns, input.rows);
    if (O.isNone(moved)) continue;
    const index = found.index ?? 0;
    out += `${Str.slice(at, index)(input.formula)}${moved.value}`;
    at = index + found[0].length;
  }
  return out + Str.slice(at)(input.formula);
};

type PieceGroups = { readonly [name: string]: string | undefined };

const movedPiece = (groups: PieceGroups, columns: number, rows: number): O.Option<string> => {
  if (groups.kept !== undefined) return O.none();
  if (groups.fromColumn !== undefined) return movedColumns(groups, columns);
  if (groups.fromRow !== undefined) return movedRows(groups, rows);
  return movedCell(groups, columns, rows);
};

const movedColumn = (fixed: string, letters: string, by: number): O.Option<string> =>
  O.flatMap(columnFromLetters(letters), (column) => {
    const moved = fixed === "$" ? column : column + by;
    return moved < 0 || moved > MAX_COLUMN ? O.none() : O.some(`${fixed}${columnLetters(moved)}`);
  });

const movedRow = (fixed: string, digits: string, by: number): O.Option<string> => {
  const moved = fixed === "$" ? Number(digits) : Number(digits) + by;
  return moved < 1 || moved > MAX_ROW ? O.none() : O.some(`${fixed}${moved}`);
};

const movedColumns = (groups: PieceGroups, columns: number): O.Option<string> =>
  O.zipWith(
    movedColumn(groups.fromColumnFixed ?? "", groups.fromColumn ?? "", columns),
    movedColumn(groups.toColumnFixed ?? "", groups.toColumn ?? "", columns),
    (from, to) => `${from}:${to}`
  );

const movedRows = (groups: PieceGroups, rows: number): O.Option<string> =>
  O.zipWith(
    movedRow(groups.fromRowFixed ?? "", groups.fromRow ?? "", rows),
    movedRow(groups.toRowFixed ?? "", groups.toRow ?? "", rows),
    (from, to) => `${from}:${to}`
  );

const movedCell = (groups: PieceGroups, columns: number, rows: number): O.Option<string> =>
  O.zipWith(
    movedColumn(groups.columnFixed ?? "", groups.column ?? "", columns),
    movedRow(groups.rowFixed ?? "", groups.row ?? "", rows),
    (column, row) => `${column}${row}`
  );
