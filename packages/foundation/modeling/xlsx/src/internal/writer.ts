import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Effect from "effect/Effect";
import * as Zip from "effect/encoding/Zip";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { columnLetters, XlsxAddress, XlsxRange } from "../XlsxAddress.schema.ts";
import { XlsxValue } from "../XlsxCell.schema.ts";
import { XlsxCompression } from "../XlsxOptions.schema.ts";
import { FIRST_CUSTOM_FORMAT } from "../XlsxWorkbook.schema.ts";
import type { XlsxCell } from "../XlsxCell.schema.ts";
import type { XlsxWorkbook, XlsxWorksheet } from "../XlsxWorkbook.schema.ts";

const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageRelationships = "http://schemas.openxmlformats.org/package/2006/relationships";
const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const hex = (unit: number): string => Str.padStart(4, "0")(Str.toUpperCase(unit.toString(16)));
const isHexDigit = (letter: string | undefined): boolean => letter !== undefined && /^[0-9A-Fa-f]$/.test(letter);

const escapeStartsAt = (text: string, at: number): boolean =>
  text[at + 1] === "x" &&
  isHexDigit(text[at + 2]) &&
  isHexDigit(text[at + 3]) &&
  isHexDigit(text[at + 4]) &&
  isHexDigit(text[at + 5]) &&
  text[at + 6] === "_";

// decision: hot-paths-are-mutable-loops
const escaped = (text: string, cell: boolean): string => {
  const escapeAt = cell ? cellEscape : plainEscape;
  let out = "";
  for (let i = 0; i < text.length; i += 1) out += entities[text[i] ?? ""] ?? escapeAt(text, i);
  return out;
};

const entities: { readonly [letter: string]: string } = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

const unitAt = (text: string, at: number): number => (at < 0 ? 0 : O.getOrElse(Str.charCodeAt(text, at), () => 0));

const isHighSurrogate = (unit: number): boolean => unit >= 0xd800 && unit <= 0xdbff;
const isLowSurrogate = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff;

const isLoneSurrogate = (text: string, at: number, unit: number): boolean =>
  (isHighSurrogate(unit) && !isLowSurrogate(unitAt(text, at + 1))) ||
  (isLowSurrogate(unit) && !isHighSurrogate(unitAt(text, at - 1)));

const isUnwritable = (unit: number): boolean =>
  (unit < 0x20 && unit !== 0x09 && unit !== 0x0a) || unit === 0xfffe || unit === 0xffff;

const cellEscape = (text: string, at: number): string => {
  const letter = text[at] ?? "";
  const unit = unitAt(text, at);
  if (isUnwritable(unit) || isLoneSurrogate(text, at, unit)) return `_x${hex(unit)}_`;
  return letter === "_" && escapeStartsAt(text, at) ? "_x005F_" : letter;
};

const plainEscape = (text: string, at: number): string => {
  const unit = unitAt(text, at);
  return unit === 0x09 || unit === 0x0a || unit === 0x0d ? `&#${unit};` : (text[at] ?? "");
};

const numberTextKeepingNegativeZero = (value: number): string => (value === 0 && 1 / value < 0 ? "-0" : `${value}`);

const cellXml = (cell: XlsxCell, row: number, styleOf: (id: number) => number): string => {
  const reference = `${columnLetters(cell.column)}${row}`;
  const style = styleOf(cell.format.id);
  const open = `<c r="${reference}"${style === 0 ? "" : ` s="${style}"`}`;
  const formula = O.match(O.filter(cell.formula, Str.isNonEmpty), {
    onNone: () => "",
    onSome: (text) => `<f>${escaped(text, false)}</f>`,
  });
  return XlsxValue.match(cell.value, {
    Blank: () => `${open}>${formula}</c>`,
    Text: (value) => textXml(open, formula, value.text),
    Number: (value) => `${open}>${formula}<v>${numberTextKeepingNegativeZero(value.value)}</v></c>`,
    Date: (value) => `${open}>${formula}<v>${numberTextKeepingNegativeZero(value.serial)}</v></c>`,
    Boolean: (value) => `${open} t="b">${formula}<v>${value.value ? "1" : "0"}</v></c>`,
    Error: (value) => `${open} t="e">${formula}<v>${escaped(value.code, false)}</v></c>`,
    Unreadable: (value) => textXml(open, formula, value.raw),
  });
};

const textXml = (open: string, formula: string, text: string): string =>
  formula === ""
    ? `${open} t="inlineStr"><is><t xml:space="preserve">${escaped(text, true)}</t></is></c>`
    : `${open} t="str">${formula}<v>${escaped(text, true)}</v></c>`;

// decision: hot-paths-are-mutable-loops
const sheetXml = (sheet: XlsxWorksheet, styleOf: (id: number) => number): string => {
  const pieces: Array<string> = [head, `<worksheet xmlns="${main}">`];
  if (O.isSome(sheet.info.declared)) pieces.push(`<dimension ref="${XlsxRange.format(sheet.info.declared.value)}"/>`);
  pushColumns(pieces, sheet.hiddenColumns);
  pushRows(pieces, sheet.rows, styleOf);
  pushMerges(pieces, sheet.merges);
  pieces.push("</worksheet>");
  return A.join(pieces, "");
};

const pushColumns = (pieces: Array<string>, hidden: XlsxWorksheet["hiddenColumns"]): void => {
  if (hidden.length === 0) return;
  pieces.push("<cols>");
  for (const column of hidden) pieces.push(`<col min="${column + 1}" max="${column + 1}" hidden="1"/>`);
  pieces.push("</cols>");
};

const pushRows = (pieces: Array<string>, rows: XlsxWorksheet["rows"], styleOf: (id: number) => number): void => {
  pieces.push("<sheetData>");
  for (const row of rows) {
    pieces.push(`<row r="${row.number}"${row.hidden ? ' hidden="1"' : ""}>`);
    for (const cell of row.cells) pieces.push(cellXml(cell, row.number, styleOf));
    pieces.push("</row>");
  }
  pieces.push("</sheetData>");
};

const pushMerges = (pieces: Array<string>, merges: XlsxWorksheet["merges"]): void => {
  if (merges.length === 0) return;
  pieces.push(`<mergeCells count="${merges.length}">`);
  for (const range of merges) {
    pieces.push(`<mergeCell ref="${XlsxAddress.format(range.first)}:${XlsxAddress.format(range.last)}"/>`);
  }
  pieces.push("</mergeCells>");
};

function* cellsOf(sheets: XlsxWorkbook["sheets"]): Generator<XlsxCell> {
  for (const sheet of sheets) for (const row of sheet.rows) yield* row.cells;
}

/**
 * The parts of a canonical workbook, each with its path in the archive.
 *
 * **Details**
 *
 * The parts are the content types, the relationships, the workbook part, the styles that carry the number formats,
 * and one part per sheet. Only values are written: text goes in its cell, inline or as a formula's saved result, so
 * there is no shared text table, and a cell's style says its number format and nothing else. A formula's text result
 * is a `str` cell, its text the saved `<v>` beside the `<f>`, since an inline text cell holds its `<is>` and nothing
 * else. An empty formula is no formula (`XlsxCell.canonical`), so no empty `<f>` is written for Excel to repair. A
 * format's style index is its position among the formats first met. A sheet's name is written as the schema holds
 * it, whether or not Excel would take it (`fitsExcel`).
 *
 * In cell text `&`, `<` and `>` become entities, a character XML cannot hold becomes Excel's `_xHHHH_`, as does a
 * carriage return, and an underscore that would read as such an escape is escaped itself. In a formula, a format code
 * or an attribute, a tab or a line break becomes a character reference instead.
 *
 * **Gotchas**
 *
 * The workbook must be in canonical form (`XlsxWorkbook.canonical`), which gives every format code one id and turns
 * what a file got wrong into the text it wrote.
 */
export const partsOf = (
  workbook: Pick<XlsxWorkbook, "dateSystem" | "sheets">
): ReadonlyArray<readonly [string, string]> => {
  // decision: hot-paths-are-mutable-loops
  const styleIndexById = MutableHashMap.empty<number, number>();
  const formats: Array<XlsxCell["format"]> = [];
  MutableHashMap.set(styleIndexById, 0, 0);
  for (const cell of cellsOf(workbook.sheets)) {
    if (MutableHashMap.has(styleIndexById, cell.format.id)) continue;
    formats.push(cell.format);
    MutableHashMap.set(styleIndexById, cell.format.id, formats.length);
  }
  const styleOf = (id: number): number => O.getOrElse(MutableHashMap.get(styleIndexById, id), () => 0);
  const custom = A.filter(formats, (format) => format.id >= FIRST_CUSTOM_FORMAT);
  const numFmts =
    custom.length === 0
      ? ""
      : `<numFmts count="${custom.length}">${A.join(
          A.map(custom, (format) => `<numFmt numFmtId="${format.id}" formatCode="${escaped(format.code, false)}"/>`),
          ""
        )}</numFmts>`;
  const xfs = A.join(
    A.map(
      formats,
      (format) => `<xf numFmtId="${format.id}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
    ),
    ""
  );
  const stylesXml =
    `${head}<styleSheet xmlns="${main}">${numFmts}` +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${formats.length + 1}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>${xfs}</cellXfs>` +
    "</styleSheet>";
  const sheetPath = (index: number): string => `xl/worksheets/sheet${index + 1}.xml`;
  const office = "application/vnd.openxmlformats-officedocument.spreadsheetml";
  const contentTypes =
    `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    `<Override PartName="/xl/workbook.xml" ContentType="${office}.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="${office}.styles+xml"/>` +
    A.join(
      A.map(workbook.sheets, (_, i) => `<Override PartName="/${sheetPath(i)}" ContentType="${office}.worksheet+xml"/>`),
      ""
    ) +
    "</Types>";
  const rootRelationships =
    `${head}<Relationships xmlns="${packageRelationships}">` +
    `<Relationship Id="rId1" Type="${relationships}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbookXml =
    `${head}<workbook xmlns="${main}" xmlns:r="${relationships}">` +
    (workbook.dateSystem === "1904" ? '<workbookPr date1904="1"/>' : "") +
    "<sheets>" +
    A.join(
      A.map(
        workbook.sheets,
        (sheet, i) =>
          `<sheet name="${escaped(sheet.info.name, false)}" sheetId="${i + 1}"${sheet.info.state === "visible" ? "" : ` state="${sheet.info.state}"`} r:id="rId${i + 1}"/>`
      ),
      ""
    ) +
    "</sheets></workbook>";
  const workbookRelationships =
    `${head}<Relationships xmlns="${packageRelationships}">` +
    A.join(
      A.map(
        workbook.sheets,
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="${relationships}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      ),
      ""
    ) +
    `<Relationship Id="rId${workbook.sheets.length + 1}" Type="${relationships}/styles" Target="styles.xml"/>` +
    "</Relationships>";
  return [
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", rootRelationships],
    ["xl/workbook.xml", workbookXml],
    ["xl/_rels/workbook.xml.rels", workbookRelationships],
    ["xl/styles.xml", stylesXml],
    ...A.map(workbook.sheets, (sheet, i) => [sheetPath(i), sheetXml(sheet, styleOf)] as const),
  ];
};

const methodOf = XlsxCompression.match({ deflate: () => "Deflate" as const, store: () => "Store" as const });

/** The parts as one archive. Deflating needs the runtime's `CompressionStream`, so this is an Effect. */
export const archiveOf: {
  (
    compression: XlsxCompression
  ): (parts: ReadonlyArray<readonly [string, string]>) => Effect.Effect<Uint8Array, Zip.ZipError>;
  (
    parts: ReadonlyArray<readonly [string, string]>,
    compression: XlsxCompression
  ): Effect.Effect<Uint8Array, Zip.ZipError>;
} = dual(
  2,
  (
    parts: ReadonlyArray<readonly [string, string]>,
    compression: XlsxCompression
  ): Effect.Effect<Uint8Array, Zip.ZipError> => {
    const method = methodOf(compression);
    return Stream.fromIterable(A.map(parts, ([path, text]) => Zip.file(path, text, { method }))).pipe(
      Stream.pipeThroughChannel(Zip.encode()),
      Stream.runCollect,
      Effect.map(Bytes.concat)
    );
  }
);
