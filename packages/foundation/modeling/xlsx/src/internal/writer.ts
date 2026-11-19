// A workbook written as the parts of an .xlsx archive: content types, relationships, the workbook part, the styles
// that carry the number formats, and one part per sheet. Only values are written (decision X2): text goes inline in
// its cell, so there is no shared text table, and a cell's style says its number format and nothing else. The
// workbook must be in canonical form (`XlsxWorkbook.canonical`), which gives every format code one id.
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Zip from "effect/encoding/Zip";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { columnLetters, XlsxAddress, XlsxRange } from "../XlsxAddress.schema.ts";
import { XlsxValue } from "../XlsxCell.schema.ts";
import { FIRST_CUSTOM_FORMAT } from "../XlsxWorkbook.schema.ts";
import type { XlsxWorkbook } from "../XlsxWorkbook.schema.ts";

type Sheet = XlsxWorkbook["sheets"][number];
type Cell = Sheet["rows"][number]["cells"][number];

const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageRelationships = "http://schemas.openxmlformats.org/package/2006/relationships";
const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const hex = (unit: number): string => Str.padStart(4, "0")(Str.toUpperCase(unit.toString(16)));
const isHexDigit = (letter: string | undefined): boolean => letter !== undefined && /^[0-9A-Fa-f]$/.test(letter);

/** Whether an Excel escape `_xHHHH_` starts at a place in a text, so its underscore must itself be escaped. */
const escapeStartsAt = (text: string, at: number): boolean =>
  text[at + 1] === "x" &&
  isHexDigit(text[at + 2]) &&
  isHexDigit(text[at + 3]) &&
  isHexDigit(text[at + 4]) &&
  isHexDigit(text[at + 5]) &&
  text[at + 6] === "_";

/**
 * Text for an element. `&`, `<` and `>` become entities. With `cell`, a character XML cannot hold becomes Excel's
 * `_xHHHH_`, as does a carriage return, and an underscore that would read as such an escape is escaped itself;
 * without it, a tab or a line break becomes a character reference, which is what a formula or an attribute needs.
 */
const escaped = (text: string, cell: boolean): string => {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const letter = text[i] ?? "";
    const unit = O.getOrElse(Str.charCodeAt(text, i), () => 0);
    if (letter === "&") out += "&amp;";
    else if (letter === "<") out += "&lt;";
    else if (letter === ">") out += "&gt;";
    else if (letter === '"') out += "&quot;";
    else if (cell) {
      const next = O.getOrElse(Str.charCodeAt(text, i + 1), () => 0);
      const previous = i === 0 ? 0 : O.getOrElse(Str.charCodeAt(text, i - 1), () => 0);
      const high = unit >= 0xd800 && unit <= 0xdbff;
      const low = unit >= 0xdc00 && unit <= 0xdfff;
      const lone =
        (high && !(next >= 0xdc00 && next <= 0xdfff)) || (low && !(previous >= 0xd800 && previous <= 0xdbff));
      if ((unit < 0x20 && unit !== 0x09 && unit !== 0x0a) || unit === 0xfffe || unit === 0xffff || lone) {
        out += `_x${hex(unit)}_`;
      } else if (letter === "_" && escapeStartsAt(text, i)) out += "_x005F_";
      else out += letter;
    } else if (unit === 0x09 || unit === 0x0a || unit === 0x0d) out += `&#${unit};`;
    else out += letter;
  }
  return out;
};

const numberText = (value: number): string => (Object.is(value, -0) ? "-0" : String(value));

const cellXml = (cell: Cell, row: number, styleOf: (id: number) => number): string => {
  const reference = `${columnLetters(cell.column)}${row}`;
  const style = styleOf(cell.format.id);
  const open = `<c r="${reference}"${style === 0 ? "" : ` s="${style}"`}`;
  const formula = O.match(cell.formula, { onNone: () => "", onSome: (text) => `<f>${escaped(text, false)}</f>` });
  return XlsxValue.match(cell.value, {
    Blank: () => `${open}>${formula}</c>`,
    Text: (value) =>
      `${open} t="inlineStr">${formula}<is><t xml:space="preserve">${escaped(value.text, true)}</t></is></c>`,
    Number: (value) => `${open}>${formula}<v>${numberText(value.value)}</v></c>`,
    Date: (value) => `${open}>${formula}<v>${numberText(value.serial)}</v></c>`,
    Boolean: (value) => `${open} t="b">${formula}<v>${value.value ? "1" : "0"}</v></c>`,
    Error: (value) => `${open} t="e">${formula}<v>${escaped(value.code, false)}</v></c>`,
    Unreadable: (value) => `${open} t="e">${formula}<v xml:space="preserve">${escaped(value.raw, true)}</v></c>`,
  });
};

const sheetXml = (sheet: Sheet, styleOf: (id: number) => number): string => {
  const pieces: Array<string> = [head, `<worksheet xmlns="${main}">`];
  if (O.isSome(sheet.info.declared)) pieces.push(`<dimension ref="${XlsxRange.format(sheet.info.declared.value)}"/>`);
  if (sheet.hiddenColumns.length > 0) {
    pieces.push("<cols>");
    for (const column of sheet.hiddenColumns) pieces.push(`<col min="${column + 1}" max="${column + 1}" hidden="1"/>`);
    pieces.push("</cols>");
  }
  pieces.push("<sheetData>");
  for (const row of sheet.rows) {
    pieces.push(`<row r="${row.number}"${row.hidden ? ' hidden="1"' : ""}>`);
    for (const cell of row.cells) pieces.push(cellXml(cell, row.number, styleOf));
    pieces.push("</row>");
  }
  pieces.push("</sheetData>");
  if (sheet.merges.length > 0) {
    pieces.push(`<mergeCells count="${sheet.merges.length}">`);
    for (const range of sheet.merges) {
      pieces.push(`<mergeCell ref="${XlsxAddress.format(range.first)}:${XlsxAddress.format(range.last)}"/>`);
    }
    pieces.push("</mergeCells>");
  }
  pieces.push("</worksheet>");
  return A.join(pieces, "");
};

/** The parts of a canonical workbook, each with its path in the archive. */
export const partsOf = (
  workbook: Pick<XlsxWorkbook, "dateSystem" | "sheets">
): ReadonlyArray<readonly [string, string]> => {
  const styles = MutableHashMap.empty<number, number>();
  const formats: Array<{ readonly id: number; readonly code: string }> = [];
  MutableHashMap.set(styles, 0, 0);
  for (const sheet of workbook.sheets) {
    for (const row of sheet.rows) {
      for (const cell of row.cells) {
        if (MutableHashMap.has(styles, cell.format.id)) continue;
        formats.push(cell.format);
        MutableHashMap.set(styles, cell.format.id, formats.length);
      }
    }
  }
  const styleOf = (id: number): number => O.getOrElse(MutableHashMap.get(styles, id), () => 0);
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

/** The parts as one archive. Deflating needs the runtime's `CompressionStream`, so this is an Effect. */
export const archiveOf = (input: {
  readonly parts: ReadonlyArray<readonly [string, string]>;
  readonly method: "Deflate" | "Store";
}): Effect.Effect<Uint8Array, Zip.ZipError> =>
  Stream.fromIterable(A.map(input.parts, ([path, text]) => Zip.file(path, text, { method: input.method }))).pipe(
    Stream.pipeThroughChannel(Zip.encode()),
    Stream.runCollect,
    Effect.map((chunks) => {
      const out = new Uint8Array(A.reduce(chunks, 0, (n, chunk) => n + chunk.length));
      let at = 0;
      for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
      }
      return out;
    })
  );
