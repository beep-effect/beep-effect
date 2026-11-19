// A shared formula is written once, on its first cell; the cells that share it say only which one. Each of them
// gets the first cell's text with its relative references moved by the distance between the two cells, as Excel
// shows it. A reference is a cell (`B2`), a whole-column range (`A:C`) or a whole-row range (`2:5`); each relative
// part moves along its own axis and each `$` part stays. Text in double quotes is a string constant, text in single
// quotes a sheet name, text in brackets a workbook index or a table's column, and the sheets a 3D reference spans
// (`JAN:DEC!`) are sheet names: none of them holds a reference, so each is copied as it is written.
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { columnFromLetters, columnLetters, MAX_COLUMN, MAX_ROW } from "../XlsxAddress.schema.ts";

// The pieces a formula's text is read as, the first that fits at each place: a quoted or bracketed piece, kept
// whole (a doubled quote is a quote inside it, and a table's column may sit in a second pair of brackets), then a
// whole-column range, a whole-row range or a cell. A reference stands apart from a name or a number on both sides,
// letters of either case included, and is never followed by `!`: what is (`JAN:DEC!B2`, `A:C!B2`) names sheets.
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

/** A formula's text with every relative reference moved by a number of columns and rows. */
export const shifted = (input: {
  readonly formula: string;
  readonly columns: number;
  readonly rows: number;
}): string => {
  if (input.columns === 0 && input.rows === 0) return input.formula;
  // crispen: the text between matches is copied as each reference is moved; a replace callback cannot skip a match
  // that would move off the sheet without also losing its place.
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

/** The groups a match of `piece` fills; a group the match did not use is undefined. */
type Groups = { readonly [name: string]: string | undefined };

/**
 * A matched piece as it reads in the shifted formula: none for a quoted or bracketed piece, which stays as it is,
 * and none for a reference that would move off the sheet, which the formula keeps as written.
 */
const movedPiece = (groups: Groups, columns: number, rows: number): O.Option<string> => {
  if (groups.kept !== undefined) return O.none();
  if (groups.fromColumn !== undefined) return movedColumns(groups, columns);
  if (groups.fromRow !== undefined) return movedRows(groups, rows);
  return movedCell(groups, columns, rows);
};

/** A column's letters moved by a number of columns, unless `$` fixes it; none when it would move off the sheet. */
const movedColumn = (fixed: string, letters: string, by: number): O.Option<string> =>
  O.flatMap(columnFromLetters(letters), (column) => {
    const moved = fixed === "$" ? column : column + by;
    return moved < 0 || moved > MAX_COLUMN ? O.none() : O.some(`${fixed}${columnLetters(moved)}`);
  });

/** A row's digits moved by a number of rows, unless `$` fixes it; none when it would move off the sheet. */
const movedRow = (fixed: string, digits: string, by: number): O.Option<string> => {
  const moved = fixed === "$" ? Number(digits) : Number(digits) + by;
  return moved < 1 || moved > MAX_ROW ? O.none() : O.some(`${fixed}${moved}`);
};

/** A whole-column range such as `A:C`, each end moved along the columns; the rows do not touch it. */
const movedColumns = (groups: Groups, columns: number): O.Option<string> =>
  O.zipWith(
    movedColumn(groups.fromColumnFixed ?? "", groups.fromColumn ?? "", columns),
    movedColumn(groups.toColumnFixed ?? "", groups.toColumn ?? "", columns),
    (from, to) => `${from}:${to}`
  );

/** A whole-row range such as `2:5`, each end moved along the rows; the columns do not touch it. */
const movedRows = (groups: Groups, rows: number): O.Option<string> =>
  O.zipWith(
    movedRow(groups.fromRowFixed ?? "", groups.fromRow ?? "", rows),
    movedRow(groups.toRowFixed ?? "", groups.toRow ?? "", rows),
    (from, to) => `${from}:${to}`
  );

/** A cell such as `B2`, moved along both axes. */
const movedCell = (groups: Groups, columns: number, rows: number): O.Option<string> =>
  O.zipWith(
    movedColumn(groups.columnFixed ?? "", groups.column ?? "", columns),
    movedRow(groups.rowFixed ?? "", groups.row ?? "", rows),
    (column, row) => `${column}${row}`
  );
