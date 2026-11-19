// Workbooks built from hand-written parts, each named for what it holds. A test asks for one by name and gets its
// bytes; nothing binary is committed, so what a fixture holds can be read here.
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Zip from "effect/encoding/Zip";
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
    Effect.map((chunks) => {
      const out = new Uint8Array(A.reduce(chunks, 0, (n, chunk) => n + chunk.length));
      let at = 0;
      for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
      }
      return out;
    }),
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
