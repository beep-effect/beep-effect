// Hostile files, made here and never committed. Each one stops the read with its finding and the part it happened
// in: never a defect, a stack overflow or a hang.

import { Xlsx } from "@beep/xlsx/Xlsx.codec";
import { columnLetters } from "@beep/xlsx/XlsxAddress.schema";
import { XlsxParseError } from "@beep/xlsx/XlsxError.errors";
import { XlsxLimits, XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema";
import { XlsxRead } from "@beep/xlsx/XlsxRead.schema";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  appended,
  archive,
  earlyEndRecord,
  filler,
  partsOf,
  sheet,
  sheetWith,
  streamedArchive,
  strings,
  styles,
  withoutLastListed,
  workbook,
} from "./support/workbooks.ts";
import type { XlsxWarning } from "@beep/xlsx/XlsxDiagnostic.schema";
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
const limited = (limits: Parameters<typeof XlsxLimits.make>[0]) =>
  XlsxReadOptions.make({ limits: XlsxLimits.make({ ...big, ...limits }) });
const kinds = (warnings: ReadonlyArray<XlsxWarning>) => A.map(warnings, (warning) => warning.finding.kind);
const lastOf = (warnings: ReadonlyArray<XlsxWarning>) => warnings[warnings.length - 1]?.finding;
/** A workbook whose sheets name parts by index, so several sheets can name one part. */
const sharing = (input: {
  readonly sheets: ReadonlyArray<readonly [name: string, part: number]>;
  readonly parts: ReadonlyArray<string>;
}) =>
  archive([
    ["[Content_Types].xml", "<Types/>"],
    [
      "_rels/.rels",
      `<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<Relationships xmlns="${pkg}">${A.join(
        A.map(
          input.parts,
          (_, i) => `<Relationship Id="p${i}" Type="${rel}/worksheet" Target="worksheets/sheet${i}.xml"/>`
        ),
        ""
      )}</Relationships>`,
    ],
    ...A.map(input.parts, (xml, i): readonly [string, string] => [`xl/worksheets/sheet${i}.xml`, xml]),
    [
      "xl/workbook.xml",
      `<workbook xmlns:r="${rel}"><sheets>${A.join(
        A.map(input.sheets, ([name, part], i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="p${part}"/>`),
        ""
      )}</sheets></workbook>`,
    ],
  ]);
const late = (rows: number) => sheet(Str.repeat(rows)('<row r="1"/>'));
const escaped = (text: string): string =>
  Str.replace(/"/g, "&quot;")(Str.replace(/</g, "&lt;")(Str.replace(/&/g, "&amp;")(text)));

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

  // One part named by two sheets is read once, and its warnings with a second part's meet one cap for the read: the
  // read keeps 100 of the 450 rows written late and says how many it dropped. Read per sheet, the two sheets naming
  // one part each carried its 300 warnings.
  it.effect("warnings past the read's cap, from a part two sheets name and from another part", () =>
    Effect.gen(function* () {
      const bytes = yield* sharing({
        sheets: [
          ["A", 0],
          ["B", 0],
          ["C", 1],
        ],
        parts: [late(301), late(151)],
      });
      const read = yield* Xlsx.parse(bytes, limited({ maxWarnings: 100 }));
      expect(read.warnings.length).toBe(101);
      expect(A.dedupe(kinds(A.take(read.warnings, 100)))).toEqual(["RowOutOfOrder"]);
      expect(lastOf(read.warnings)).toMatchObject({ kind: "ListTruncated", list: "warnings", dropped: 350 });
      const sheets = A.dedupe(
        A.map(A.take(read.warnings, 100), (warning) =>
          warning.finding.kind === "RowOutOfOrder" ? warning.finding.sheet : ""
        )
      );
      expect(sheets).toEqual(["A"]);
      expect(S.is(XlsxRead)(read)).toBe(true);
    })
  );

  it.effect("a style index that is no whole number, or past any table, is reported as written", () =>
    Effect.gen(function* () {
      const written = ["1e300", "9007199254740993", "-1", "1.5", "NaN", "", "99"];
      const found = yield* Effect.forEach(
        written,
        (style) =>
          Effect.flatMap(
            workbook({
              ...one(sheet(`<row r="1"><c r="A1" s="${style}"><v>1</v></c></row>`)),
              styles: styles(["0.00"]),
            }),
            (bytes) => Xlsx.parse(bytes)
          ),
        { concurrency: 1 }
      );
      expect(A.map(found, (read) => A.map(read.warnings, (warning) => warning.finding))).toEqual(
        A.map(written, (style) => [expect.objectContaining({ kind: "UnknownStyle", style })])
      );
    })
  );

  // Every attribute or value the reader turns into a number, holding any text at all: the read succeeds with a
  // workbook its schema accepts, or fails with a finding, and never dies.
  const numeric: ReadonlyArray<(text: string) => Recipe> = [
    (x) => one(sheet(`<row r="${x}"><c><v>1</v></c></row>`)),
    (x) => one(sheet(`<row r="1"><c r="${x}"><v>1</v></c></row>`)),
    (x) => ({ ...one(sheet(`<row r="1"><c r="A1" s="${x}"><v>1</v></c></row>`)), styles: styles(["0.00"]) }),
    (x) => one(sheetWith({ before: `<cols><col min="${x}" max="3" hidden="1"/></cols>`, rows: "" })),
    (x) => one(sheetWith({ before: `<cols><col min="1" max="${x}" hidden="1"/></cols>`, rows: "" })),
    (x) => one(sheetWith({ before: `<dimension ref="${x}"/>`, rows: '<row r="1"><c><v>1</v></c></row>' })),
    (x) => one(sheetWith({ rows: "", after: `<mergeCells><mergeCell ref="${x}"/></mergeCells>` })),
    (x) =>
      one(
        sheet(
          `<row r="1"><c r="A1"><f t="shared" si="${x}">A1</f><v>1</v></c><c r="B1"><f t="shared" si="${x}"/><v>1</v></c></row>`
        )
      ),
    (x) => ({
      ...one(sheet('<row r="1"><c r="A1" s="1"><v>1</v></c></row>')),
      styles: `<styleSheet><numFmts><numFmt numFmtId="${x}" formatCode="0.0"/></numFmts><cellXfs><xf/><xf numFmtId="${x}"/></cellXfs></styleSheet>`,
    }),
    ...A.map(["s", "n", "b", "e", "d"], (type) => (x: string) => ({
      ...one(sheet(`<row r="1"><c r="A1" t="${type}"><v>${x}</v></c></row>`)),
      sharedStrings: strings(["<t>a</t>"]),
    })),
  ];
  it.effect.prop(
    "no numeric attribute or value, whatever it holds, makes the read die",
    [Arbitrary.schema(S.String), Arbitrary.schema(S.Finite)],
    ([text, number]) =>
      Effect.gen(function* () {
        for (const written of [text, `${number}`]) {
          for (const recipe of numeric) {
            const exit = yield* Effect.exit(
              Effect.flatMap(workbook(recipe(escaped(written))), (bytes) => Xlsx.parse(bytes))
            );
            assertFalse(Exit.isFailure(exit) && Cause.hasDies(exit.cause));
            if (Exit.isSuccess(exit)) expect(S.is(XlsxRead)(exit.value)).toBe(true);
          }
        }
      }),
    { arbitrary: { runs: 15 } }
  );

  // A row written from its last column to its first, with one column twice: the repeat is found by a stamp per
  // column, whatever the order, and the row keeps every column once in rising order.
  it.effect("a full row written right to left, with one column written twice", () =>
    Effect.gen(function* () {
      const columns = A.map(A.range(0, 16_383), columnLetters);
      const cells = A.join(
        A.map(A.reverse(columns), (letters) => `<c r="${letters}1"><v>1</v></c>`),
        ""
      );
      const bytes = yield* workbook(one(sheet(`<row r="1">${cells}<c r="B1"><v>2</v></c></row>`)));
      const read = yield* Xlsx.parse(bytes, limited({}));
      const row = read.workbook.sheets[0].rows[0];
      expect(row?.cells.length).toBe(16_384);
      expect(row?.cells[1]).toMatchObject({ column: 1, value: { kind: "Number", value: 1 } });
      expect(A.map(read.warnings, (warning) => warning.finding)).toEqual([
        expect.objectContaining({ kind: "BadAddress", row: 1, raw: "B1" }),
      ]);
    })
  );

  it.effect("merged ranges written many times, and more than the read's cap over two sheets", () =>
    Effect.gen(function* () {
      const twice = yield* workbook(
        one(
          sheetWith({
            rows: "",
            after: `<mergeCells>${Str.repeat(1000)('<mergeCell ref="B2:A1"/><mergeCell ref="A1:B2"/>')}</mergeCells>`,
          })
        )
      );
      const once = yield* Xlsx.parse(twice);
      expect(once.workbook.sheets[0].merges.length).toBe(1);
      expect(once.warnings).toEqual([]);
      const ranges = (row: number) =>
        sheetWith({
          rows: "",
          after: `<mergeCells>${A.join(
            A.map(A.range(1, 4), (n) => `<mergeCell ref="A${row + n}:B${row + n}"/>`),
            ""
          )}</mergeCells>`,
        });
      const two = yield* workbook({
        sheets: [
          { name: "A", xml: ranges(0) },
          { name: "B", xml: ranges(10) },
        ],
      });
      const capped = yield* Xlsx.parse(two, limited({ maxMerges: 6 }));
      expect(A.map(capped.workbook.sheets, (found) => found.merges.length)).toEqual([4, 2]);
      expect(kinds(capped.warnings)).toEqual(["ListTruncated"]);
      expect(lastOf(capped.warnings)).toMatchObject({ list: "merges", dropped: 2 });
    })
  );

  it.effect("hidden column spans and the columns they expand to, past the read's caps", () =>
    Effect.gen(function* () {
      const cols = (n: number) =>
        sheetWith({ before: `<cols>${Str.repeat(n)('<col min="1" max="10" hidden="1"/>')}</cols>`, rows: "" });
      const bytes = yield* workbook({
        sheets: [
          { name: "A", xml: cols(3) },
          { name: "B", xml: cols(3) },
        ],
      });
      const spans = yield* Xlsx.parse(bytes, limited({ maxHiddenSpans: 4 }));
      expect(lastOf(spans.warnings)).toMatchObject({ kind: "ListTruncated", list: "hiddenSpans", dropped: 2 });
      const columns = yield* Xlsx.parse(bytes, limited({ maxHiddenColumns: 15 }));
      expect(A.map(columns.workbook.sheets, (found) => found.hiddenColumns.length)).toEqual([10, 5]);
      expect(lastOf(columns.warnings)).toMatchObject({ kind: "ListTruncated", list: "hiddenColumns", dropped: 5 });
    })
  );

  // A shared formula is written once and handed, whole, to every cell that names it: a cell of a few bytes costs the
  // formula's length. The text handed out is counted for the whole read, and the groups kept are capped.
  it.effect("a long shared formula handed to many cells, and more shared formulas than the read's cap", () =>
    Effect.gen(function* () {
      const master = `${Str.repeat(1000)("A1+")}A1`;
      const rows =
        `<row r="1"><c r="A1"><f t="shared" si="0">${master}</f><v>1</v></c></row>` +
        A.join(
          A.map(A.range(2, 40), (r) => `<row r="${r}"><c r="A${r}"><f t="shared" si="0"/><v>1</v></c></row>`),
          ""
        );
      const finding = yield* builtFindingOf(one(sheet(rows)), { ...big, maxSharedFormulaChars: 30_000 });
      expect(finding).toMatchObject({
        kind: "LimitExceeded",
        limit: "sharedFormulaChars",
        path: "xl/worksheets/sheet1.xml",
      });
      const groups = A.join(
        A.map(A.range(0, 4), (si) => `<c r="${columnLetters(si)}1"><f t="shared" si="${si}">1+1</f><v>2</v></c>`),
        ""
      );
      const many = yield* workbook(
        one(sheet(`<row r="1">${groups}</row><row r="2"><c r="E2"><f t="shared" si="4"/><v>2</v></c></row>`))
      );
      const read = yield* Xlsx.parse(many, limited({ maxSharedFormulas: 4 }));
      expect(lastOf(read.warnings)).toMatchObject({ kind: "ListTruncated", list: "sharedFormulas", dropped: 1 });
    })
  );

  it.effect("two paths that differ only in case, which OPC takes for one part", () =>
    Effect.gen(function* () {
      const parts = partsOf(one(sheet('<row r="1"><c r="A1"><v>1</v></c></row>')));
      const bytes = yield* archive([
        ...parts,
        ["XL/WORKSHEETS/SHEET1.XML", sheet('<row r="1"><c r="A1"><v>2</v></c></row>')],
      ]);
      const finding = yield* findingOf(bytes);
      expect(finding).toMatchObject({ kind: "DuplicatePart", path: "XL/WORKSHEETS/SHEET1.XML" });
    })
  );

  // Excel opens a file by the directory its last end record names; the reader here walks the entries from the first
  // byte. An archive updated by appending shows the two different workbooks, so it is refused, as is an entry the
  // directory leaves out. A file whose entries are streamed, with descriptors and 64-bit sizes, agrees and reads.
  it.effect("an archive updated by appending, and an entry its directory leaves out", () =>
    Effect.gen(function* () {
      const build = (value: number) => workbook(one(sheet(`<row r="1"><c r="A1"><v>${value}</v></c></row>`)));
      const first = yield* build(1);
      const second = yield* build(2);
      const updated = yield* findingOf(appended({ first, second }));
      expect(updated).toMatchObject({ kind: "DirectoryMismatch" });
      const extra = yield* workbook({ ...one(sheet("")), extra: [["xl/extra.xml", "<x/>"]] });
      const unlisted = yield* findingOf(withoutLastListed(extra));
      expect(unlisted).toMatchObject({ kind: "DirectoryMismatch" });
      const streamed = yield* streamedArchive(partsOf(one(sheet('<row r="1"><c r="A1"><v>3</v></c></row>'))));
      const read = yield* Xlsx.parse(streamed);
      expect(read.workbook.sheets[0].rows[0]?.cells[0]?.value).toMatchObject({ kind: "Number", value: 3 });
    })
  );
  // The directory is found from the back, so an end-record signature can sit anywhere: here at byte 14, the CRC field
  // of a streamed entry's local header, counting 0xFFFF entries, so the reader looks for a 64-bit locator 20 bytes
  // before it. That read lies before the file's first byte, and it is refused, not thrown.
  it.effect("an end record inside the first local header, naming a 64-bit locator before byte 0", () =>
    Effect.gen(function* () {
      const streamed = yield* streamedArchive([
        ...partsOf(one(sheet('<row r="1"><c r="A1"><v>1</v></c></row>'))),
        ["xl/media/filler.bin", filler(30_000)],
      ]);
      const finding = yield* findingOf(earlyEndRecord(streamed));
      expect(finding).toMatchObject({
        kind: "DirectoryMismatch",
        reason: "the end record names a 64-bit record that is not there",
      });
    })
  );

  // Any damage to a workbook's bytes is a typed failure of every read or a read, never a defect. The places a byte
  // matters most are near a record, so each mutation lands within a few bytes of the file's first byte, a local
  // header, a directory entry or the end record: a run of bytes overwritten or inserted, the file cut there, or an
  // end-record signature written there (with the bytes after it read as that record's fields). The streamed form
  // leaves fields a reader skips at their maximum, which an early end record reads as its 64-bit markers, and the
  // first part's name is short, so the bytes such a record reads as its comment length are small.
  const Anchor = S.Literals(["start", "local", "central", "end"]);
  const Mutation = S.Struct({
    kind: S.Literals(["overwrite", "insert", "truncate", "signature"]),
    anchor: Anchor,
    which: S.Int.check(S.isBetween({ minimum: 0, maximum: 7 })),
    delta: S.Int.check(S.isBetween({ minimum: -4, maximum: 20 })),
    bytes: S.Array(S.Int.check(S.isBetween({ minimum: 0, maximum: 255 }))).check(S.isMinLength(1), S.isMaxLength(8)),
  });
  const signatures = { local: [0x50, 0x4b, 3, 4], central: [0x50, 0x4b, 1, 2], end: [0x50, 0x4b, 5, 6] } as const;
  const anchorsOf = (bytes: Uint8Array, anchor: typeof Anchor.Type): ReadonlyArray<number> =>
    anchor === "start"
      ? [0]
      : A.filter(A.range(0, bytes.length - 4), (at) =>
          A.every(signatures[anchor], (byte, i) => bytes[at + i] === byte)
        );
  const mutate = (bytes: Uint8Array, mutation: typeof Mutation.Type): Uint8Array => {
    const anchors = anchorsOf(bytes, mutation.anchor);
    const base = anchors[mutation.which % Math.max(1, anchors.length)] ?? 0;
    const at = Math.min(bytes.length, Math.max(0, base + mutation.delta));
    const written = Uint8Array.from(mutation.kind === "signature" ? signatures.end : mutation.bytes);
    if (mutation.kind === "truncate") return bytes.slice(0, at);
    if (mutation.kind === "insert") {
      const out = new Uint8Array(bytes.length + written.length);
      out.set(bytes.subarray(0, at));
      out.set(written, at);
      out.set(bytes.subarray(at), at + written.length);
      return out;
    }
    const out = bytes.slice();
    out.set(written.subarray(0, Math.max(0, bytes.length - at)), at);
    return out;
  };
  const whole = streamedArchive([["a.xml", "<a/>"], ...partsOf(one(sheet('<row r="1"><c r="A1"><v>1</v></c></row>')))]);
  // Each case damages the workbook and the same workbook cut inside its directory, after its last entry: that one
  // still reads, and has no end record left to be found before one a mutation writes. Both are built once.
  const targets = Effect.runSync(
    whole.pipe(
      Effect.map((bytes) => [bytes, bytes.subarray(0, bytes.length - 30)]),
      Effect.cached
    )
  );
  /** A read's exit is a success or a typed failure (`XlsxParseError`, or the codec's `SchemaError`), never a defect. */
  const typed = <A, E>(exit: Exit.Exit<A, E>): boolean =>
    Exit.isSuccess(exit) ||
    (!Cause.hasDies(exit.cause) &&
      O.exists(Cause.findErrorOption(exit.cause), (error) => S.is(XlsxParseError)(error) || S.isSchemaError(error)));
  /** Every public read but `parse`, which each case runs; each case runs one of these beside it. */
  const Other = S.Literals(["outline", "sheets", "sheetLayout", "rows", "fromBytes", "recordsFromBytes"]);
  const others: {
    readonly [K in typeof Other.Type]: (bytes: Uint8Array) => Effect.Effect<Exit.Exit<unknown, unknown>>;
  } = {
    outline: (bytes: Uint8Array) => Effect.exit(Xlsx.outline(bytes)),
    sheets: (bytes: Uint8Array) => Effect.exit(Xlsx.sheets(bytes)),
    sheetLayout: (bytes: Uint8Array) => Effect.exit(Xlsx.sheetLayout(bytes, "S")),
    rows: (bytes: Uint8Array) => Effect.exit(Xlsx.rows(bytes, "S").pipe(Stream.runDrain)),
    fromBytes: (bytes: Uint8Array) => Effect.exit(S.decodeEffect(Xlsx.XlsxFromBytes)(bytes)),
    recordsFromBytes: (bytes: Uint8Array) =>
      Effect.exit(S.decodeEffect(Xlsx.recordsFromBytes({ sheet: "S", header: "first" }))(bytes)),
  };
  it.effect.prop(
    "no damage to a workbook's bytes makes a read die",
    [S.Array(Mutation).check(S.isMinLength(1), S.isMaxLength(2)), Other],
    ([mutations, other]) =>
      Effect.gen(function* () {
        for (const target of yield* targets) {
          const bytes = A.reduce(mutations, target, mutate);
          const parsed = yield* Effect.exit(Xlsx.parse(bytes));
          const read = yield* others[other](bytes);
          expect(typed(parsed)).toBe(true);
          expect(typed(read)).toBe(true);
        }
      }),
    { arbitrary: { runs: 1200 } }
  );
});
