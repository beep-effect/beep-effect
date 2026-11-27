import { Xlsx } from "@beep/xlsx/Xlsx.codec";
import { XlsxLimits, XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
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

const usualPlaceWorkbook = (input: {
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

describe("opening a workbook part, by an example for each way that the property tests reach only by chance", () => {
  it.effect("styles under a worksheets folder and shared text without an XML name are read in a second pass", () =>
    Effect.gen(function* () {
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
      const bytes = yield* usualPlaceWorkbook({
        links: [sheetLink, ["s1", "worksheet", "worksheets/absent.xml"]],
        sheets: '<sheet name="Kept" sheetId="1" r:id="s1"/>',
      });
      const result = yield* read(bytes);
      expect(A.map(result.workbook.sheets, (entry) => entry.info.name)).toEqual(["Kept"]);
    })
  );

  it.effect("a sheet with no name takes its position, and a state it does not know is visible", () =>
    Effect.gen(function* () {
      const bytes = yield* usualPlaceWorkbook({
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
      const bytes = yield* usualPlaceWorkbook({
        links: [sheetLink, ["c1", "chartsheet", "chartsheets/sheet1.xml"]],
        sheets: '<sheet name="Chart" sheetId="1" r:id="c1"/><sheet name="Data" sheetId="2" r:id="s1"/>',
      });
      const result = yield* read(bytes);
      expect(A.map(result.workbook.sheets, (entry) => entry.info.name)).toEqual(["Data"]);
    })
  );

  it.effect("a workbook whose only entries are no worksheets has no sheets", () =>
    Effect.gen(function* () {
      const bytes = yield* usualPlaceWorkbook({
        links: [["c1", "chartsheet", "chartsheets/sheet1.xml"]],
        sheets: '<sheet name="Chart" sheetId="1" r:id="c1"/>',
      });
      const finding = yield* findingOf(bytes);
      expect(finding.kind).toBe("NoSheets");
    })
  );

  it.effect("a sheet that names a link the workbook lacks, or a name that cannot be read, stops the open", () =>
    Effect.gen(function* () {
      const lacking = yield* usualPlaceWorkbook({
        links: [sheetLink],
        sheets: '<sheet name="Lost" sheetId="1" r:id="nope"/>',
      });
      const unnamed = yield* usualPlaceWorkbook({
        links: [sheetLink],
        sheets: `<sheet name="${Str.repeat(256)("n")}" sheetId="1" r:id="s1"/>`,
      });
      const findings = [yield* findingOf(lacking), yield* findingOf(unnamed)];
      expect(A.map(findings, (finding) => finding.kind)).toEqual(["DamagedXml", "DamagedXml"]);
    })
  );

  it.effect("a sheet whose part is not in the file, and a workbook part that is not, are missing parts", () =>
    Effect.gen(function* () {
      const noSheet = yield* usualPlaceWorkbook({
        links: [["s9", "worksheet", "worksheets/absent.xml"]],
        sheets: '<sheet name="Gone" sheetId="1" r:id="s9"/>',
      });
      const rootLinkToAbsentBook = yield* archive([
        ["[Content_Types].xml", "<Types/>"],
        rootRels("xl/absent.xml"),
        ["old/xl/workbook.xml", book("")],
      ]);
      const findings = [yield* findingOf(noSheet), yield* findingOf(rootLinkToAbsentBook)];
      expect(
        A.map(findings, (finding) => finding.kind),
        "old/xl/workbook.xml still marks the file a workbook, so the absent root target is a missing part"
      ).toEqual(["MissingPart", "MissingPart"]);
    })
  );

  it.effect("more sheets than the cap stops the open", () =>
    Effect.gen(function* () {
      const bytes = yield* usualPlaceWorkbook({
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
        `<styleSheet xmlns="${main}"><numFmts count="2"><numFmt numFmtId="170"/><numFmt numFmtId="x" formatCode="0"/></numFmts>` +
        `<fonts count="2"><font/><font/></fonts>` +
        `<cellXfs count="6"><xf numFmtId="0"/><xf numFmtId="170"/><xf numFmtId="250"/><xf numFmtId="250"/><xf/><xf numFmtId="x"/></cellXfs></styleSheet>`;
      const bytes = yield* archive([
        ["[Content_Types].xml", "<Types/>"],
        rootRels("xl/workbook.xml"),
        ["xl/_rels/workbook.xml.rels", rels([sheetLink, ["st", "styles", "styles.xml"]])],
        ["xl/workbook.xml", book('<sheet name="Styled" sheetId="1" r:id="s1"/>')],
        [
          "xl/worksheets/sheet1.xml",
          sheet(
            '<row r="1"><c r="A1" s="0"><v>1</v></c><c r="B1" s="1"><v>2</v></c><c r="C1" s="2"><v>3</v></c>' +
              '<c r="D1" s="3"><v>4</v></c><c r="E1" s="4"><v>5</v></c><c r="F1" s="5"><v>6</v></c></row>'
          ),
        ],
        ["xl/styles.xml", stylesPart],
        ["docProps/app.xml", "<Properties/>"],
        ["xl/media/note.txt", "drawing"],
        ["custom/thing.dat", "other"],
      ]);
      const result = yield* read(bytes);
      const formats = A.map(result.workbook.sheets[0]?.rows[0]?.cells ?? [], (cell) => [
        cell.format.id,
        cell.format.code,
      ]);
      expect(
        formats,
        "in style order: General; the custom id with its empty code; an unknown id, twice, as General under that id; General for no id or a non-number"
      ).toEqual([
        [0, "General"],
        [170, ""],
        [250, "General"],
        [250, "General"],
        [0, "General"],
        [0, "General"],
      ]);
      expect(A.map(result.workbook.dropped, (part) => [part.path, part.kind])).toEqual(
        expect.arrayContaining([
          ["xl/styles.xml", "styles"],
          ["docProps/app.xml", "properties"],
          ["xl/media/note.txt", "drawing"],
          ["custom/thing.dat", "other"],
        ])
      );
    })
  );

  it.effect("a file with no root links is read from the usual workbook path", () =>
    Effect.gen(function* () {
      const bytes = yield* archive([
        ["[Content_Types].xml", "<Types/>"],
        ["xl/_rels/workbook.xml.rels", rels([sheetLink])],
        ["xl/workbook.xml", book('<sheet name="Plain" sheetId="1" r:id="s1"/>')],
        ["xl/worksheets/sheet1.xml", cells],
      ]);
      const result = yield* read(bytes);
      expect(A.map(result.workbook.sheets, (entry) => entry.info.name)).toEqual(["Plain"]);
    })
  );

  it.effect("a file past the cap on its bytes, and shared text past the cap on its entries, stop the open", () =>
    Effect.gen(function* () {
      const plain = yield* usualPlaceWorkbook({
        links: [sheetLink],
        sheets: '<sheet name="One" sheetId="1" r:id="s1"/>',
      });
      const texts = yield* usualPlaceWorkbook({
        links: [sheetLink, ["ss", "sharedStrings", "sharedStrings.xml"]],
        sheets: '<sheet name="One" sheetId="1" r:id="s1"/>',
        more: [["xl/sharedStrings.xml", `<sst xmlns="${main}"><si><t>a</t></si><si><t>b</t></si></sst>`]],
      });
      const findings = [
        yield* findingOf(plain, { maxInputBytes: ByteSize.bytes(16) }),
        yield* findingOf(texts, { maxSharedStrings: 1 }),
      ];
      expect(A.map(findings, (finding) => finding.kind)).toEqual(["LimitExceeded", "LimitExceeded"]);
    })
  );
});
