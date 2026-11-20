// Example workbooks that reach every way a workbook part is opened: where the parts sit, what a sheet entry
// names, and what a styles part writes. The property tests reach these only by chance, so each has an example.

import { Xlsx } from "@beep/xlsx/Xlsx.codec";
import { XlsxLimits, XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { archive, sheet } from "./support/workbooks.ts";
import type { Part } from "./support/workbooks.ts";

const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const pkg = "http://schemas.openxmlformats.org/package/2006/relationships";
const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

const rels = (entries: ReadonlyArray<readonly [id: string, kind: string, target: string]>): string =>
  `<Relationships xmlns="${pkg}">${A.join(
    A.map(entries, ([id, kind, target]) => `<Relationship Id="${id}" Type="${rel}/${kind}" Target="${target}"/>`),
    ""
  )}</Relationships>`;

const rootRels = (target: string): Part => ["_rels/.rels", rels([["rId1", "officeDocument", target]])];
const book = (sheets: string): string =>
  `<workbook xmlns="${main}" xmlns:r="${rel}"><sheets>${sheets}</sheets></workbook>`;
const cells = sheet('<row r="1"><c r="A1"><v>1</v></c></row>');

/** A workbook in the usual place, with the links and sheet entries given. */
const usual = (input: {
  readonly links: ReadonlyArray<readonly [id: string, kind: string, target: string]>;
  readonly sheets: string;
  readonly more?: ReadonlyArray<Part>;
}) =>
  archive([
    ["[Content_Types].xml", "<Types/>"],
    rootRels("xl/workbook.xml"),
    ["xl/_rels/workbook.xml.rels", rels(input.links)],
    ["xl/workbook.xml", book(input.sheets)],
    ["xl/worksheets/sheet1.xml", cells],
    ...(input.more ?? []),
  ]);

const read = (bytes: Uint8Array, limits: Parameters<typeof XlsxLimits.make>[0] = {}) =>
  Xlsx.parse(bytes, XlsxReadOptions.make({ limits: XlsxLimits.make(limits) }));
const findingOf = (bytes: Uint8Array, limits: Parameters<typeof XlsxLimits.make>[0] = {}) =>
  read(bytes, limits).pipe(
    Effect.flip,
    Effect.map((error) => error.fatal.finding)
  );
const sheetLink = ["s1", "worksheet", "worksheets/sheet1.xml"] as const;

describe("opening a workbook part", () => {
  it.effect("styles and shared text the first pass does not hold are read in a second pass", () =>
    Effect.gen(function* () {
      // The first pass holds small XML parts but never one under a worksheets folder or without an XML name.
      const bytes = yield* archive([
        ["[Content_Types].xml", "<Types/>"],
        rootRels("xl/workbook.xml"),
        [
          "xl/_rels/workbook.xml.rels",
          rels([sheetLink, ["st", "styles", "worksheets/look.xml"], ["ss", "sharedStrings", "text.bin"]]),
        ],
        ["xl/workbook.xml", book('<sheet name="First" sheetId="1" r:id="s1"/>')],
        ["xl/worksheets/sheet1.xml", sheet('<row r="1"><c r="A1" t="s"><v>0</v></c></row>')],
        [
          "xl/worksheets/look.xml",
          `<styleSheet xmlns="${main}"><cellXfs count="1"><xf numFmtId="0"/></cellXfs></styleSheet>`,
        ],
        ["xl/text.bin", `<sst xmlns="${main}" count="1"><si><t>moved</t></si></sst>`],
      ]);
      const result = yield* read(bytes);
      expect(A.map(result.workbook.sheets, (entry) => entry.info.name)).toEqual(["First"]);
      expect(result.workbook.sheets[0]?.rows[0]?.cells[0]?.value).toMatchObject({ kind: "Text", text: "moved" });
    })
  );

  it.effect("the first of two links with one id is the one a sheet names", () =>
    Effect.gen(function* () {
      const bytes = yield* usual({
        links: [sheetLink, ["s1", "worksheet", "worksheets/absent.xml"]],
        sheets: '<sheet name="Kept" sheetId="1" r:id="s1"/>',
      });
      const result = yield* read(bytes);
      expect(A.map(result.workbook.sheets, (entry) => entry.info.name)).toEqual(["Kept"]);
    })
  );

  it.effect("a sheet with no name takes its position, and a state it does not know is visible", () =>
    Effect.gen(function* () {
      const bytes = yield* usual({
        links: [sheetLink],
        sheets: '<sheet sheetId="1" state="sideways" r:id="s1"/>',
      });
      const result = yield* read(bytes);
      expect(A.map(result.workbook.sheets, (entry) => [entry.info.name, entry.info.state])).toEqual([
        ["Sheet1", "visible"],
      ]);
    })
  );

  it.effect("an entry whose link is no worksheet is passed over", () =>
    Effect.gen(function* () {
      const bytes = yield* usual({
        links: [sheetLink, ["c1", "chartsheet", "chartsheets/sheet1.xml"]],
        sheets: '<sheet name="Chart" sheetId="1" r:id="c1"/><sheet name="Data" sheetId="2" r:id="s1"/>',
      });
      const result = yield* read(bytes);
      expect(A.map(result.workbook.sheets, (entry) => entry.info.name)).toEqual(["Data"]);
    })
  );

  it.effect("a workbook whose only entries are no worksheets has no sheets", () =>
    Effect.gen(function* () {
      const bytes = yield* usual({
        links: [["c1", "chartsheet", "chartsheets/sheet1.xml"]],
        sheets: '<sheet name="Chart" sheetId="1" r:id="c1"/>',
      });
      const finding = yield* findingOf(bytes);
      expect(finding.kind).toBe("NoSheets");
    })
  );

  it.effect("a sheet that names a link the workbook lacks, or a name that cannot be read, stops the open", () =>
    Effect.gen(function* () {
      const lacking = yield* usual({ links: [sheetLink], sheets: '<sheet name="Lost" sheetId="1" r:id="nope"/>' });
      const unnamed = yield* usual({
        links: [sheetLink],
        sheets: `<sheet name="${Str.repeat(256)("n")}" sheetId="1" r:id="s1"/>`,
      });
      const findings = [yield* findingOf(lacking), yield* findingOf(unnamed)];
      expect(A.map(findings, (finding) => finding.kind)).toEqual(["DamagedXml", "DamagedXml"]);
    })
  );

  it.effect("a sheet whose part is not in the file, and a workbook part that is not, are missing parts", () =>
    Effect.gen(function* () {
      const noSheet = yield* usual({
        links: [["s9", "worksheet", "worksheets/absent.xml"]],
        sheets: '<sheet name="Gone" sheetId="1" r:id="s9"/>',
      });
      // The root link names a workbook part the file does not hold; another part's name still marks it a workbook.
      const noBook = yield* archive([
        ["[Content_Types].xml", "<Types/>"],
        rootRels("xl/absent.xml"),
        ["old/xl/workbook.xml", book("")],
      ]);
      const findings = [yield* findingOf(noSheet), yield* findingOf(noBook)];
      expect(A.map(findings, (finding) => finding.kind)).toEqual(["MissingPart", "MissingPart"]);
    })
  );

  it.effect("more sheets than the cap stops the open", () =>
    Effect.gen(function* () {
      const bytes = yield* usual({
        links: [sheetLink],
        sheets: '<sheet name="One" sheetId="1" r:id="s1"/><sheet name="Two" sheetId="2" r:id="s1"/>',
      });
      const finding = yield* findingOf(bytes, { maxSheets: 1 });
      expect(finding.kind).toBe("LimitExceeded");
    })
  );

  it.effect("a format with no code, an id no table knows, and a styles part that styles more than formats", () =>
    Effect.gen(function* () {
      const stylesPart =
        `<styleSheet xmlns="${main}"><numFmts count="1"><numFmt numFmtId="170"/></numFmts>` +
        `<fonts count="2"><font/><font/></fonts>` +
        `<cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="170"/><xf numFmtId="250"/></cellXfs></styleSheet>`;
      const bytes = yield* archive([
        ["[Content_Types].xml", "<Types/>"],
        rootRels("xl/workbook.xml"),
        ["xl/_rels/workbook.xml.rels", rels([sheetLink, ["st", "styles", "styles.xml"]])],
        ["xl/workbook.xml", book('<sheet name="Styled" sheetId="1" r:id="s1"/>')],
        [
          "xl/worksheets/sheet1.xml",
          sheet(
            '<row r="1"><c r="A1" s="1"><v>1</v></c><c r="B1" s="2"><v>2</v></c><c r="C1" s="0"><v>3</v></c></row>'
          ),
        ],
        ["xl/styles.xml", stylesPart],
      ]);
      const result = yield* read(bytes);
      expect(A.map(result.workbook.dropped, (part) => [part.path, part.kind])).toContainEqual([
        "xl/styles.xml",
        "styles",
      ]);
    })
  );
});
