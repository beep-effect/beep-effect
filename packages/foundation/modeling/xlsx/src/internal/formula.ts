// A shared formula is written once, on its first cell; the cells that share it say only which one. Each of them
// gets the first cell's text with its relative references moved by the distance between the two cells, as Excel
// shows it. A reference is moved wherever one stands in the text, as the reader this package replaced did.
import * as Str from "effect/String";
import { columnFromLetters, columnLetters, MAX_COLUMN, MAX_ROW } from "../XlsxAddress.schema.ts";

const reference = /(^|[^._A-Z0-9])(\$?)([A-Z]{1,3})(\$?)(\d{1,7})(?![_.(A-Za-z0-9])/g;

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
  for (const found of Str.matchAll(reference)(input.formula)) {
    const index = found.index ?? 0;
    const [whole, before = "", fixedColumn = "", letters = "", fixedRow = "", digits = ""] = found;
    const column = columnFromLetters(letters);
    if (column._tag === "None") continue;
    const movedColumn = fixedColumn === "$" ? column.value : column.value + input.columns;
    const movedRow = fixedRow === "$" ? Number(digits) : Number(digits) + input.rows;
    if (movedColumn < 0 || movedColumn > MAX_COLUMN || movedRow < 1 || movedRow > MAX_ROW) continue;
    out += `${Str.slice(at, index)(input.formula)}${before}${fixedColumn}${columnLetters(movedColumn)}${fixedRow}${movedRow}`;
    at = index + whole.length;
  }
  return out + Str.slice(at)(input.formula);
};
