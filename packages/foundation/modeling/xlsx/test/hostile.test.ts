// Hostile files, made here and never committed. Each one stops the read with its finding and the part it happened
// in: never a defect, a stack overflow or a hang.

import { Xlsx } from "@beep/xlsx/Xlsx.codec";
import { XlsxLimits, XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { archive, partsOf, sheet, sheetWith, strings, workbook } from "./support/workbooks.ts";
import type { Recipe } from "./support/workbooks.ts";

const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const pkg = "http://schemas.openxmlformats.org/package/2006/relationships";

const big = { maxInputBytes: ByteSize.mebibytes(64) };
const findingOf = (bytes: Uint8Array, limits: Parameters<typeof XlsxLimits.make>[0] = big) =>
  Xlsx.parse(bytes, XlsxReadOptions.make({ limits: XlsxLimits.make(limits) })).pipe(
    Effect.flip,
    Effect.map((error) => error.fatal.finding)
  );
const builtFindingOf = (recipe: Recipe, limits?: Parameters<typeof XlsxLimits.make>[0]) =>
  Effect.flatMap(workbook(recipe), (bytes) => findingOf(bytes, limits ?? big));
const one = (xml: string): Recipe => ({ sheets: [{ name: "S", xml }] });
const cell = "<c><v>1</v></c>";

describe("hostile files", () => {
  it.effect("a part that inflates from a few kilobytes past the cap on inflated bytes", () =>
    Effect.gen(function* () {
      const bytes = yield* workbook(
        one(sheet(`<row r="1"><c r="A1" t="inlineStr"><is><t>${Str.repeat(8 * 1024 * 1024)(" ")}</t></is></c></row>`))
      );
      expect(bytes.length).toBeLessThan(64 * 1024);
      const finding = yield* findingOf(bytes, { maxInflatedBytes: ByteSize.mebibytes(1) });
      expect(finding).toMatchObject({
        kind: "LimitExceeded",
        limit: "inflatedBytes",
        path: "xl/worksheets/sheet1.xml",
      });
      const part = yield* findingOf(bytes, { maxPartBytes: ByteSize.mebibytes(1) });
      expect(part).toMatchObject({ kind: "LimitExceeded", limit: "partBytes", path: "xl/worksheets/sheet1.xml" });
    })
  );

  it.effect("a file larger than the cap on its own bytes, before anything is inflated", () =>
    Effect.gen(function* () {
      const bytes = yield* workbook(one(sheet("")));
      const finding = yield* findingOf(bytes, { maxInputBytes: ByteSize.bytes(100) });
      expect(finding).toMatchObject({ kind: "LimitExceeded", limit: "inputBytes" });
    })
  );

  it.effect("one cell of 20 MiB", () =>
    Effect.gen(function* () {
      const text = Str.repeat(20 * 1024 * 1024)("x");
      const finding = yield* builtFindingOf(
        one(sheet(`<row r="1"><c r="A1" t="inlineStr"><is><t>${text}</t></is></c></row>`))
      );
      expect(finding).toMatchObject({ kind: "LimitExceeded", path: "xl/worksheets/sheet1.xml" });
      expect(["cellChars", "xml"]).toContain(finding.kind === "LimitExceeded" ? finding.limit : "");
    })
  );

  it.effect("more rows than the cap, and a row numbered past the last a sheet has", () =>
    Effect.gen(function* () {
      const rows = Str.repeat(1001)("<row/>");
      const many = yield* builtFindingOf(one(sheet(rows)), { ...big, maxRows: 1000 });
      expect(many).toMatchObject({ kind: "LimitExceeded", limit: "rows" });
      const far = yield* builtFindingOf(one(sheet('<row r="1048577"><c><v>1</v></c></row>')));
      expect(far).toMatchObject({ kind: "LimitExceeded", limit: "rows" });
    })
  );

  it.effect("a row of 16,385 cells", () =>
    Effect.gen(function* () {
      const finding = yield* builtFindingOf(one(sheet(`<row r="1">${Str.repeat(16_385)(cell)}</row>`)));
      expect(finding).toMatchObject({ kind: "LimitExceeded", limit: "columns", path: "xl/worksheets/sheet1.xml" });
    })
  );

  // Each `<col>` is 37 bytes and names all 16,384 columns. Read as one column each, 50,000 of them would be 819
  // million entries from a file of a few kilobytes; a span is kept as its two ends and every column comes out once.
  it.effect("50,000 hidden column spans that each name every column", () =>
    Effect.gen(function* () {
      const cols = `<cols>${Str.repeat(50_000)('<col min="1" max="16384" hidden="1"/>')}</cols>`;
      const bytes = yield* workbook(one(sheetWith({ before: cols, rows: '<row r="1"><c r="A1"><v>1</v></c></row>' })));
      expect(bytes.length).toBeLessThan(64 * 1024);
      const read = yield* Xlsx.parse(bytes, XlsxReadOptions.make({ limits: XlsxLimits.make(big) }));
      const hidden = read.workbook.sheets[0].hiddenColumns;
      expect(hidden.length).toBe(16_384);
      expect(hidden[0]).toBe(0);
      expect(hidden[16_383]).toBe(16_383);
      const outline = yield* Xlsx.outline(bytes, XlsxReadOptions.make({ limits: XlsxLimits.make(big) }));
      expect(outline.sheets[0]?.hiddenColumns.length).toBe(16_384);
    })
  );

  it.effect("hidden column spans past the column cap, overlapping, reversed or not numbers", () =>
    Effect.gen(function* () {
      const cols =
        '<cols><col min="3" max="5" hidden="1"/><col min="1" max="4" hidden="1"/><col min="9" max="7" hidden="1"/>' +
        '<col min="x" max="2" hidden="1"/><col min="4" max="99999" hidden="1"/><col min="2" max="2"/></cols>';
      const bytes = yield* workbook(one(sheetWith({ before: cols, rows: "" })));
      const read = yield* Xlsx.parse(
        bytes,
        XlsxReadOptions.make({ limits: XlsxLimits.make({ ...big, maxColumns: 6 }) })
      );
      expect(read.workbook.sheets[0].hiddenColumns).toEqual([0, 1, 2, 3, 4, 5]);
    })
  );

  // Every sheet names its relationship by id; with the links indexed once, 8,000 sheets against 300,000 links is
  // one pass over each, where a scan per sheet was 2.4 billion comparisons and ran past the 30-second test timeout.
  it.effect("8,000 sheets naming the last of 300,000 relationships", () =>
    Effect.gen(function* () {
      const links =
        `<Relationships xmlns="${pkg}">` +
        A.join(
          A.map(A.range(1, 300_000), (i) => `<Relationship Id="r${i}" Type="${rel}/x" Target="x"/>`),
          ""
        ) +
        `<Relationship Id="last" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
      const sheets = A.join(
        A.map(A.range(1, 8000), (i) => `<sheet name="S${i}" sheetId="${i}" r:id="last"/>`),
        ""
      );
      const bytes = yield* archive([
        ["[Content_Types].xml", "<Types/>"],
        [
          "_rels/.rels",
          `<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
        ],
        ["xl/_rels/workbook.xml.rels", links],
        ["xl/worksheets/sheet1.xml", sheet('<row r="1"><c r="A1"><v>1</v></c></row>')],
        ["xl/workbook.xml", `<workbook xmlns:r="${rel}"><sheets>${sheets}</sheets></workbook>`],
      ]);
      const limits = XlsxLimits.make({ ...big, maxSheets: 8000 });
      const read = yield* Xlsx.parse(bytes, XlsxReadOptions.make({ limits }));
      expect(read.workbook.sheets.length).toBe(8000);
    })
  );

  it.effect("a shared text entry longer than the cap on one cell", () =>
    Effect.gen(function* () {
      const entry = Str.repeat(40)(`<r><t>${Str.repeat(1000)("x")}</t></r>`);
      const finding = yield* builtFindingOf({ ...one(sheet("")), sharedStrings: strings([entry]) });
      expect(finding).toMatchObject({ kind: "LimitExceeded", limit: "cellChars", path: "xl/sharedStrings.xml" });
    })
  );

  it.effect("more shared text entries than the cap", () =>
    Effect.gen(function* () {
      const table = `<sst xmlns="x">${Str.repeat(11)("<si><t>a</t></si>")}</sst>`;
      const finding = yield* builtFindingOf(
        { ...one(sheet("")), sharedStrings: table },
        { ...big, maxSharedStrings: 10 }
      );
      expect(finding).toMatchObject({ kind: "LimitExceeded", limit: "sharedStrings", path: "xl/sharedStrings.xml" });
    })
  );

  it.effect("XML nested deeper than any workbook is", () =>
    Effect.gen(function* () {
      const deep = `${Str.repeat(5000)("<a>")}${Str.repeat(5000)("</a>")}`;
      const finding = yield* builtFindingOf(one(`<worksheet>${deep}</worksheet>`));
      expect(finding).toMatchObject({ kind: "LimitExceeded", limit: "xml", path: "xl/worksheets/sheet1.xml" });
    })
  );

  it.effect("a DOCTYPE with entities, which are never expanded", () =>
    Effect.gen(function* () {
      const bomb =
        '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">' +
        '<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' +
        '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&lol2;&xxe;</t></is></c></row></sheetData></worksheet>';
      const finding = yield* builtFindingOf(one(bomb));
      expect(finding).toMatchObject({ kind: "DamagedXml", path: "xl/worksheets/sheet1.xml" });
    })
  );

  it.effect("XML that is not well-formed, with where", () =>
    Effect.gen(function* () {
      const finding = yield* builtFindingOf(
        one('<worksheet><sheetData>\n<row r="1"><c></row></sheetData></worksheet>')
      );
      expect(finding).toMatchObject({ kind: "DamagedXml", path: "xl/worksheets/sheet1.xml", line: 2 });
    })
  );

  it.effect("one path twice in the archive", () =>
    Effect.gen(function* () {
      const parts = partsOf(one(sheet('<row r="1"><c r="A1"><v>1</v></c></row>')));
      const bytes = yield* archive([
        ...parts,
        ["xl/worksheets/sheet1.xml", sheet('<row r="1"><c r="A1"><v>2</v></c></row>')],
      ]);
      const finding = yield* findingOf(bytes);
      expect(finding).toMatchObject({ kind: "DuplicatePart", path: "xl/worksheets/sheet1.xml" });
    })
  );

  // The reader goes through the entries in order and checks each against its checksum, so a cut inside an entry
  // is a typed failure. A cut after the last entry, inside the directory that follows them, loses nothing the
  // reader uses: such a file reads, to the very values of the whole file, and never to anything else.
  it.effect("a file cut short at every hundredth byte", () =>
    Effect.gen(function* () {
      const bytes = yield* workbook(one(sheet('<row r="1"><c r="A1"><v>1</v></c></row>')));
      const whole = yield* Xlsx.parse(bytes);
      const cuts = A.filter(A.range(1, Math.floor(bytes.length / 100)), (n) => n * 100 < bytes.length);
      const kinds = yield* Effect.forEach(
        cuts,
        (n) =>
          Effect.map(Effect.result(Xlsx.parse(bytes.subarray(0, n * 100))), (found) => {
            if (Result.isFailure(found)) return found.failure.fatal.finding.kind;
            expect(found.success.workbook).toEqual(whole.workbook);
            return "read";
          }),
        { concurrency: 1 }
      );
      expect(cuts.length).toBeGreaterThan(10);
      expect(A.filter(kinds, (kind) => kind !== "read").length).toBeGreaterThan(cuts.length / 2);
      expect(
        A.every(
          kinds,
          (kind) => kind === "read" || kind === "NotAWorkbook" || kind === "DamagedArchive" || kind === "MissingPart"
        )
      ).toBe(true);
    })
  );

  it.effect("an encrypted entry", () =>
    Effect.gen(function* () {
      const bytes = yield* workbook(one(sheet("")));
      // Bit 0 of the general purpose flags of the first local header says the entry is encrypted.
      const marked = new Uint8Array(bytes);
      marked[6] = (marked[6] ?? 0) | 1;
      const finding = yield* findingOf(marked);
      expect(finding).toMatchObject({ kind: "DamagedArchive", damage: "Unsupported" });
    })
  );

  it.effect("bytes that are no archive at all", () =>
    Effect.gen(function* () {
      const finding = yield* findingOf(new TextEncoder().encode("SKU,Name\nA-1,Bolt\n"));
      expect(finding).toMatchObject({ kind: "NotAWorkbook", container: "notAnArchive" });
      const garbage = yield* findingOf(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
      expect(garbage).toMatchObject({ kind: "NotAWorkbook", container: "otherZip" });
    })
  );
});
