import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Effect from "effect/Effect";
import * as Zip from "effect/encoding/Zip";
import * as P from "effect/Predicate";
import * as Stream from "effect/Stream";

const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const strictMain = "http://purl.oclc.org/ooxml/spreadsheetml/main";
const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const pkg = "http://schemas.openxmlformats.org/package/2006/relationships";
const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** One part of an archive: its path and its text. */
export type Part = readonly [path: string, text: string | Uint8Array];

/** Parts as one zip archive, in the order given. */
export const archive = (parts: ReadonlyArray<Part>): Effect.Effect<Uint8Array> =>
  Stream.fromIterable(A.map(parts, ([path, text]) => Zip.file(path, text))).pipe(
    Stream.pipeThroughChannel(Zip.encode()),
    Stream.runCollect,
    Effect.map(Bytes.concat),
    Effect.orDie
  );

/** What a hand-built workbook is made of. Every field but the sheets has a plain starting value. */
export interface Recipe {
  readonly extra?: ReadonlyArray<Part>;
  readonly namespace?: string;
  readonly sharedStrings?: string;
  readonly sheets: ReadonlyArray<{
    readonly name: string;
    readonly xml: string;
    readonly state?: "hidden" | "veryHidden";
  }>;
  /** Where the shared text sits among the parts: before the sheets or after them. */
  readonly stringsFirst?: boolean;
  readonly styles?: string;
  readonly workbookPr?: string;
}

/** The parts of a hand-built workbook. */
export const partsOf = (recipe: Recipe): ReadonlyArray<Part> => {
  const ns = recipe.namespace ?? main;
  const sheets = A.map(recipe.sheets, (sheet, i): Part => [`xl/worksheets/sheet${i + 1}.xml`, sheet.xml]);
  const strings: ReadonlyArray<Part> =
    recipe.sharedStrings === undefined ? [] : [["xl/sharedStrings.xml", recipe.sharedStrings]];
  const styles: ReadonlyArray<Part> = recipe.styles === undefined ? [] : [["xl/styles.xml", recipe.styles]];
  const workbook =
    `${head}<workbook xmlns="${ns}" xmlns:r="${rel}">${recipe.workbookPr ?? ""}<sheets>` +
    A.join(
      A.map(
        recipe.sheets,
        (sheet, i) =>
          `<sheet name="${sheet.name}" sheetId="${i + 1}"${sheet.state === undefined ? "" : ` state="${sheet.state}"`} r:id="rId${i + 1}"/>`
      ),
      ""
    ) +
    "</sheets></workbook>";
  const links =
    `${head}<Relationships xmlns="${pkg}">` +
    A.join(
      A.map(
        recipe.sheets,
        (_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      ),
      ""
    ) +
    (recipe.sharedStrings === undefined
      ? ""
      : `<Relationship Id="rIdS" Type="${rel}/sharedStrings" Target="sharedStrings.xml"/>`) +
    (recipe.styles === undefined ? "" : `<Relationship Id="rIdT" Type="${rel}/styles" Target="styles.xml"/>`) +
    "</Relationships>";
  return [
    ["[Content_Types].xml", `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`],
    [
      "_rels/.rels",
      `${head}<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    ["xl/_rels/workbook.xml.rels", links],
    ...(recipe.stringsFirst === true ? [...strings, ...sheets] : [...sheets, ...strings]),
    ["xl/workbook.xml", workbook],
    ...styles,
    ...(recipe.extra ?? []),
  ];
};

/** A hand-built workbook as bytes. */
export const workbook = (recipe: Recipe): Effect.Effect<Uint8Array> => archive(partsOf(recipe));

/** A worksheet part around its rows. */
export const sheet = (rows: string): string => sheetWith({ rows });

/** A worksheet part around its rows, with what comes before or after the sheet data, or another namespace. */
export const sheetWith = (input: {
  readonly rows: string;
  readonly before?: string;
  readonly after?: string;
  readonly ns?: string;
}): string =>
  `${head}<worksheet xmlns="${input.ns ?? main}">${input.before ?? ""}<sheetData>${input.rows}</sheetData>${input.after ?? ""}</worksheet>`;

/** A shared text table from its entries, each already XML. */
export const strings = (entries: ReadonlyArray<string>): string =>
  `${head}<sst xmlns="${main}" count="${entries.length}">${A.join(
    A.map(entries, (entry) => `<si>${entry}</si>`),
    ""
  )}</sst>`;

/** A styles part whose style 0 is General and whose style n is the nth code given. */
export const styles = (codes: ReadonlyArray<string>): string =>
  `${head}<styleSheet xmlns="${main}"><numFmts count="${codes.length}">` +
  A.join(
    A.map(codes, (code, i) => `<numFmt numFmtId="${164 + i}" formatCode="${code}"/>`),
    ""
  ) +
  `</numFmts><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders>` +
  `<cellXfs count="${codes.length + 1}"><xf numFmtId="0"/>` +
  A.join(
    A.map(codes, (_, i) => `<xf numFmtId="${164 + i}"/>`),
    ""
  ) +
  "</cellXfs></styleSheet>";

/** The namespace a Strict workbook uses. */
export const strict = strictMain;

/**
 * Parts as one zip archive whose bodies are streamed, so each entry's sizes follow its data in a descriptor and are
 * given as 64-bit fields: the form a writer that does not know a part's size ahead takes.
 */
export const streamedArchive = (parts: ReadonlyArray<Part>): Effect.Effect<Uint8Array> =>
  Stream.fromIterable(
    A.map(parts, ([path, text]) =>
      Zip.fileStream(path, Stream.make(P.isString(text) ? new TextEncoder().encode(text) : text))
    )
  ).pipe(Stream.pipeThroughChannel(Zip.encode()), Stream.runCollect, Effect.map(Bytes.concat), Effect.orDie);

const lastEndRecordAt = (bytes: Uint8Array): number => {
  for (let at = bytes.length - 22; at >= 0; at -= 1) {
    if (bytes[at] === 0x50 && bytes[at + 1] === 0x4b && bytes[at + 2] === 5 && bytes[at + 3] === 6) return at;
  }
  return -1;
};

/**
 * One archive updated by appending another, as a zip tool updates a file in place: the second's entries and
 * directory follow the first's, its offsets moved past the first, so the last end record, which Excel opens the
 * file by, names the second's entries.
 */
export const appended = (input: { readonly first: Uint8Array; readonly second: Uint8Array }): Uint8Array => {
  const { first, second } = input;
  const moved = second.slice();
  const view = new DataView(moved.buffer);
  const end = lastEndRecordAt(moved);
  const start = view.getUint32(end + 16, true);
  let at = start;
  for (let n = 0; n < view.getUint16(end + 10, true); n += 1) {
    view.setUint32(at + 42, view.getUint32(at + 42, true) + first.length, true);
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  view.setUint32(end + 16, start + first.length, true);
  return Bytes.concat([first, moved]);
};

const directoryStartOf = (bytes: Uint8Array): number => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = lastEndRecordAt(bytes);
  const start = view.getUint32(end + 16, true);
  return start === 0xffffffff ? Number(view.getBigUint64(Number(view.getBigUint64(end - 12, true)) + 48, true)) : start;
};

/**
 * A streamed archive (its first entry's sizes in a descriptor) whose first local header holds an end-record
 * signature in its unused CRC field, cut ten bytes into its directory. The early signature counts 0xFFFF entries
 * (the high half of the local size field, which a streamed entry leaves at its maximum), so a reader taking it for
 * the end record looks for a 64-bit locator 20 bytes before byte 14. Its comment length is two letters of the first
 * part's name, so the archive must be longer than that for the record to fit: `filler` pads it.
 */
export const earlyEndRecord = (bytes: Uint8Array): Uint8Array => {
  const out = bytes.slice(0, directoryStartOf(bytes) + 10);
  new DataView(out.buffer).setUint32(14, 0x06054b50, true);
  return out;
};

/** Bytes no deflate can shrink much, the same on every run, so an archive holding them has a known size. */
export const filler = (size: number): Uint8Array => {
  const out = new Uint8Array(size);
  let xorshift32 = 0x9e3779b9;
  for (let i = 0; i < size; i += 1) {
    xorshift32 ^= xorshift32 << 13;
    xorshift32 ^= xorshift32 >>> 17;
    xorshift32 ^= xorshift32 << 5;
    out[i] = xorshift32 >>> 24;
  }
  return out;
};

/** An archive whose directory leaves out its last entry, which is still in the archive before the directory. */
export const withoutLastListed = (bytes: Uint8Array): Uint8Array => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = lastEndRecordAt(bytes);
  const count = view.getUint16(end + 10, true);
  const start = view.getUint32(end + 16, true);
  let at = start;
  for (let n = 0; n < count - 1; n += 1) {
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  const last = 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  const out = Bytes.concat([bytes.subarray(0, at), bytes.subarray(at + last)]);
  const record = new DataView(out.buffer);
  const moved = end - last;
  record.setUint16(moved + 8, count - 1, true);
  record.setUint16(moved + 10, count - 1, true);
  record.setUint32(moved + 12, view.getUint32(end + 12, true) - last, true);
  return out;
};

/** An archive whose first directory entry gives its comment the longest length, so the entry ends past the directory. */
export const longFirstListed = (bytes: Uint8Array): Uint8Array => {
  const out = bytes.slice();
  const view = new DataView(out.buffer);
  view.setUint16(view.getUint32(lastEndRecordAt(out) + 16, true) + 32, 0xffff, true);
  return out;
};

/** An archive whose end record counts one entry fewer than its directory holds, so the entries read stop short of it. */
export const countedShort = (bytes: Uint8Array): Uint8Array => {
  const out = bytes.slice();
  const view = new DataView(out.buffer);
  const end = lastEndRecordAt(out);
  const count = view.getUint16(end + 10, true) - 1;
  view.setUint16(end + 8, count, true);
  view.setUint16(end + 10, count, true);
  return out;
};
