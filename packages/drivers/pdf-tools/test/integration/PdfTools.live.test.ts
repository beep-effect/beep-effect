import {
  InkCoverageRequest,
  PageTextRequest,
  PdfPageRef,
  PdfTools,
  RasterRequest,
  SvgToPdfRequest,
} from "@beep/pdf-tools";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { PDFArray, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, rgb, StandardFonts } from "pdf-lib";

const toolPresent = (command: string, versionFlag: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const handle = yield* spawner.spawn(
        ChildProcess.make(command, [versionFlag], { stdin: "ignore", stderr: "ignore", stdout: "ignore" })
      );
      return (yield* handle.exitCode) === 0;
    })
  ).pipe(
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound" ? Effect.succeed(false) : Effect.fail(error)
    )
  );

const TOOLS = [
  ["rsvg-convert", "--version"],
  ["pdftoppm", "-v"],
  ["pdftotext", "-v"],
] as const;

const missingTool = Effect.findFirst(TOOLS, ([command, flag]) => Effect.map(toolPresent(command, flag), (ok) => !ok));

const missingRsvg = Effect.map(toolPresent("rsvg-convert", "--version"), (ok) => !ok);

const missingPoppler = Effect.findFirst(
  A.filter(TOOLS, ([command]) => command !== "rsvg-convert"),
  ([command, flag]) => Effect.map(toolPresent(command, flag), (ok) => !ok)
);

const LiveLayer = PdfTools.makeLayer().pipe(Layer.provideMerge(NodeServices.layer));

const drawSheet = (doc: PDFDocument) => {
  const page = doc.addPage([612, 792]);
  page.drawRectangle({ x: 150, y: 300, width: 300, height: 200, borderColor: rgb(0, 0, 0), borderWidth: 3 });
  page.drawLine({ start: { x: 150, y: 300 }, end: { x: 450, y: 500 }, thickness: 3, color: rgb(0, 0, 0) });
  return page;
};

const sheetAndFlattenedReviewedExport = Effect.gen(function* () {
  const sheet = yield* Effect.promise(() => PDFDocument.create());
  drawSheet(sheet);
  const reviewed = yield* Effect.promise(() => PDFDocument.create());
  const font = yield* Effect.promise(() => reviewed.embedFont(StandardFonts.Helvetica));
  drawSheet(reviewed).drawText("Make the box taller", { x: 72, y: 700, font, size: 12 });
  return [yield* Effect.promise(() => sheet.save()), yield* Effect.promise(() => reviewed.save())] as const;
});

const blackAndGraySquaresSheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="612pt" height="792pt" viewBox="0 0 612 792">
<rect x="72" y="72" width="100" height="100" fill="#000"/>
<rect x="440" y="620" width="100" height="100" fill="#808080"/>
</svg>
`;

const sheetSvgWhoseStreamMayEndIn0x0D = `<svg xmlns="http://www.w3.org/2000/svg" width="612pt" height="792pt" viewBox="0 0 612 792"><path d="M72 72H540V720H119Z" fill="none" stroke="#000"/><text x="300" y="400" font-size="14">FIG. 1</text></svg>\n`;

const writeTwoSheets = Effect.fnUntraced(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const first = path.join(dir, "first.svg");
  const second = path.join(dir, "second.svg");
  yield* fs.writeFileString(first, sheetSvgWhoseStreamMayEndIn0x0D);
  yield* fs.writeFileString(
    second,
    `<svg xmlns="http://www.w3.org/2000/svg" width="300pt" height="400pt" viewBox="0 0 300 400"><circle cx="150" cy="200" r="80" fill="none" stroke="#000"/><text x="120" y="380" font-size="14">FIG. 2</text></svg>\n`
  );
  return [first, second] as const;
});

const pdfLibShortenedIndirectFlateStreams = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const doc = yield* Effect.promise(() => PDFDocument.load(bytes, { updateMetadata: false }));
  const lookup = (value: unknown) => (value instanceof PDFRef ? doc.context.lookup(value) : value);
  return A.length(
    A.filter(doc.context.enumerateIndirectObjects(), ([, object]) => {
      if (!(object instanceof PDFRawStream)) return false;
      const length = object.dict.get(PDFName.of("Length"));
      const declared = lookup(length);
      const filter = lookup(object.dict.get(PDFName.of("Filter")));
      const first = filter instanceof PDFArray ? lookup(filter.get(0)) : filter;
      return (
        length instanceof PDFRef &&
        declared instanceof PDFNumber &&
        first === PDFName.of("FlateDecode") &&
        declared.asNumber() !== object.contents.length
      );
    })
  );
});

describe("@beep/pdf-tools live tools", () => {
  it.layer(LiveLayer, { timeout: "120 seconds" })((it) => {
    it.effect(
      "writes a byte-stable PDF 1.6 and measures its pages",
      Effect.fnUntraced(function* (context) {
        const missing = yield* missingTool;
        if (O.isSome(missing)) {
          context.skip(`Missing native prerequisite: ${missing.value[0]} on PATH`);
          return;
        }
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tools = yield* PdfTools;
        const dir = yield* fs.makeTempDirectoryScoped();
        const svg = path.join(dir, "sheet.svg");
        yield* fs.writeFileString(svg, blackAndGraySquaresSheetSvg);
        const pdfA = path.join(dir, "a.pdf");
        const pdfB = path.join(dir, "b.pdf");
        yield* tools.svgToPdf(SvgToPdfRequest.make({ svgPaths: [svg, svg], outputPath: pdfA }));
        yield* tools.svgToPdf(SvgToPdfRequest.make({ svgPaths: [svg, svg], outputPath: pdfB }));
        const [bytesA, bytesB] = yield* Effect.all([fs.readFile(pdfA), fs.readFile(pdfB)], { concurrency: 1 });
        expect(Buffer.from(bytesA).equals(Buffer.from(bytesB))).toBe(true);

        const structure = yield* tools.inspect(pdfA);
        expect(structure.headerVersion).toBe("1.6");
        expect(structure.pages.length).toBe(2);
        expect(structure.pages[0]?.widthPt).toBeCloseTo(612, 0);
        expect(structure.pages[0]?.heightPt).toBeCloseTo(792, 0);
        expect(structure.fonts).toEqual([]);
        expect(structure.annotationCount).toBe(0);
        expect(structure.encrypted).toBe(false);
        expect(structure.undecodableStreams).toEqual([]);

        const metrics = yield* tools.measurePage(
          RasterRequest.make({ pdfPath: pdfA, page: 2, dpi: 72, antiAlias: false })
        );
        expect(metrics.width).toBe(612);
        expect(metrics.height).toBe(792);
        const inkBoxTopLeftAtBlackSquare = O.map(metrics.inkBox, (box) => [box.minX, box.minY]);
        assertSome(inkBoxTopLeftAtBlackSquare, [72, 72]);
        expect(metrics.largestBlackSquare).toBe(100);
        expect(metrics.impurePixels, "the gray square is the only impurity; no anti-aliasing means no edge grays").toBe(
          100 * 100
        );
        expect(metrics.chromaPixels).toBe(0);

        const textSvg = (line: string) =>
          `<svg xmlns="http://www.w3.org/2000/svg" width="612pt" height="792pt"><text x="300" y="100" font-size="12">${line}</text></svg>\n`;
        yield* fs.writeFileString(path.join(dir, "p1.svg"), textSvg("Request page"));
        yield* fs.writeFileString(path.join(dir, "p2.svg"), textSvg("Initialed page AB"));
        const textPdf = path.join(dir, "text.pdf");
        yield* tools.svgToPdf(
          SvgToPdfRequest.make({ svgPaths: [path.join(dir, "p1.svg"), path.join(dir, "p2.svg")], outputPath: textPdf })
        );
        const rawRequestedPageText = yield* tools.pageText(PageTextRequest.make({ pdfPath: textPdf, page: 2 }));
        expect(rawRequestedPageText).toContain("Initialed page AB");
        expect(rawRequestedPageText).not.toContain("Request page");
      })
    );

    it.effect(
      "converts two SVGs in one run: pages in input order, the requested header, every stream decodable",
      Effect.fnUntraced(function* (context) {
        if (yield* missingRsvg) {
          context.skip("Missing native prerequisite: rsvg-convert on PATH");
          return;
        }
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tools = yield* PdfTools;
        const dir = yield* fs.makeTempDirectoryScoped();
        const svgPaths = yield* writeTwoSheets(dir);
        const out = path.join(dir, "sheets.pdf");
        const result = yield* tools.svgToPdf(SvgToPdfRequest.make({ svgPaths, outputPath: out }));
        expect(result.pageCount).toBe(2);
        const readFile1 = yield* fs.readFile(out);
        expect(Buffer.from(readFile1).subarray(0, 8).toString("latin1")).toBe("%PDF-1.6");

        const structure = yield* tools.inspect(out);
        expect(structure.headerVersion).toBe("1.6");
        expect(
          A.map(structure.pages, (page) => [Math.round(page.widthPt), Math.round(page.heightPt)]),
          "pages in input order, each at its own SVG's size"
        ).toEqual([
          [612, 792],
          [300, 400],
        ]);
        expect(
          structure.undecodableStreams,
          "every stream inflates, cairo's object and cross-reference streams included"
        ).toEqual([]);
        expect(structure.streamCheck).toBe("complete");
      })
    );

    it.effect(
      "flags the streams the per-page pdf-lib merge the one-run conversion replaced truncates",
      Effect.fnUntraced(function* (context) {
        if (yield* missingRsvg) {
          context.skip("Missing native prerequisite: rsvg-convert on PATH");
          return;
        }
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tools = yield* PdfTools;
        const dir = yield* fs.makeTempDirectoryScoped();
        const svgPaths = yield* writeTwoSheets(dir);
        const pages = yield* Effect.forEach(
          svgPaths,
          (svg, index) => {
            const pagePath = path.join(dir, `page-${index + 1}.pdf`);
            return tools
              .svgToPdf(SvgToPdfRequest.make({ svgPaths: [svg], outputPath: pagePath }))
              .pipe(Effect.andThen(fs.readFile(pagePath)));
          },
          { concurrency: 1 }
        );
        const shortenedPerPage = yield* Effect.forEach(pages, pdfLibShortenedIndirectFlateStreams, { concurrency: 1 });
        const shortened = A.reduce(shortenedPerPage, 0, (total, count) => total + count);
        if (shortened === 0) {
          context.skip(
            "This rsvg-convert/cairo build ends no per-page FlateDecode stream under an indirect /Length in 0x0D, so the merge truncates nothing here (it depends on the cairo build and the host's fonts); the unit test of an indirect /Length covers the read"
          );
          return;
        }
        const mergedDoc = yield* Effect.promise(() => PDFDocument.create({ updateMetadata: false }));
        yield* Effect.forEach(
          pages,
          (bytes) =>
            Effect.promise(() => PDFDocument.load(bytes, { updateMetadata: false })).pipe(
              Effect.flatMap((source) => Effect.promise(() => mergedDoc.copyPages(source, source.getPageIndices()))),
              Effect.map(A.forEach((page) => mergedDoc.addPage(page)))
            ),
          { concurrency: 1 }
        );
        const merged = yield* Effect.promise(() =>
          mergedDoc.save({ useObjectStreams: false, updateFieldAppearances: false })
        );
        const mergedPath = path.join(dir, "merged.pdf");
        yield* fs.writeFile(mergedPath, merged);
        const broken = yield* tools.inspect(mergedPath);
        expect(A.map(broken.undecodableStreams, (stream) => stream.reason)).toEqual(
          A.makeBy(shortened, () => "unexpected end of file")
        );
      })
    );

    it.effect(
      "reads a typed note's block and matches a reviewed page to its sheet by ink coverage",
      Effect.fnUntraced(function* (context) {
        const missing = yield* missingPoppler;
        if (O.isSome(missing)) {
          context.skip(`Missing native prerequisite: ${missing.value[0]} on PATH`);
          return;
        }
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tools = yield* PdfTools;
        const dir = yield* fs.makeTempDirectoryScoped();
        const [sheetBytes, reviewedBytes] = yield* sheetAndFlattenedReviewedExport;
        const sheet = path.join(dir, "sheet.pdf");
        const reviewed = path.join(dir, "reviewed.pdf");
        yield* fs.writeFile(sheet, sheetBytes);
        yield* fs.writeFile(reviewed, reviewedBytes);

        const pageWords3 = yield* tools.pageWords(PageTextRequest.make({ pdfPath: sheet, page: 1 }));
        expect(pageWords3).toEqual([]);
        const blocks = yield* tools.pageWords(PageTextRequest.make({ pdfPath: reviewed, page: 1 }));
        expect(A.map(blocks, (b) => b.text)).toEqual(["Make the box taller"]);
        expect(blocks[0]?.rect.xMin).toBeCloseTo(72, 0);
        expect(blocks[0]?.rect.yMax, "top-left frame: the baseline sits 92 pt below the top edge").toBeGreaterThan(80);
        expect(blocks[0]?.rect.yMax).toBeLessThan(100);

        const forward = yield* tools.inkCoverage(
          InkCoverageRequest.make({
            base: PdfPageRef.make({ pdfPath: sheet, page: 1 }),
            marked: PdfPageRef.make({ pdfPath: reviewed, page: 1 }),
            dpi: 36,
            dilatePx: 1,
          })
        );
        expect(forward.coverage).toBe(1);
        expect(forward.markedInkPixels).toBeGreaterThan(forward.baseInkPixels);
        const reverse = yield* tools.inkCoverage(
          InkCoverageRequest.make({
            base: PdfPageRef.make({ pdfPath: reviewed, page: 1 }),
            marked: PdfPageRef.make({ pdfPath: sheet, page: 1 }),
            dpi: 36,
            dilatePx: 1,
          })
        );
        expect(reverse.coverage, "the reverse direction leaves the note's ink uncovered").toBeLessThan(1);
        const annotations4 = yield* tools.annotations(reviewed);
        expect(annotations4).toEqual([]);
      })
    );
  });
});
