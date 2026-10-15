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
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Live lane: exercises the real rsvg-convert, pdftoppm, and pdftotext binaries
// on PATH. A machine without librsvg or poppler skips explicitly; any other
// spawn failure stays a failure.
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

const missingPoppler = Effect.findFirst(
  A.filter(TOOLS, ([command]) => command !== "rsvg-convert"),
  ([command, flag]) => Effect.map(toolPresent(command, flag), (ok) => !ok)
);

const LiveLayer = PdfTools.makeLayer().pipe(Layer.provideMerge(NodeServices.layer));

// A text-free sheet (a box and a diagonal) and the same sheet with a typed note
// on top, the way a reviewer's flattened export comes back.
const drawSheet = (doc: PDFDocument) => {
  const page = doc.addPage([612, 792]);
  page.drawRectangle({ x: 150, y: 300, width: 300, height: 200, borderColor: rgb(0, 0, 0), borderWidth: 3 });
  page.drawLine({ start: { x: 150, y: 300 }, end: { x: 450, y: 500 }, thickness: 3, color: rgb(0, 0, 0) });
  return page;
};

const sheetPair = Effect.gen(function* () {
  const sheet = yield* Effect.promise(() => PDFDocument.create());
  drawSheet(sheet);
  const reviewed = yield* Effect.promise(() => PDFDocument.create());
  const font = yield* Effect.promise(() => reviewed.embedFont(StandardFonts.Helvetica));
  drawSheet(reviewed).drawText("Make the box taller", { x: 72, y: 700, font, size: 12 });
  return [yield* Effect.promise(() => sheet.save()), yield* Effect.promise(() => reviewed.save())] as const;
});

// A Letter sheet: a 100 pt black square 1 in from the top-left corner and a
// 50 % gray square 1 in from the bottom-right corner.
const sheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="612pt" height="792pt" viewBox="0 0 612 792">
<rect x="72" y="72" width="100" height="100" fill="#000"/>
<rect x="440" y="620" width="100" height="100" fill="#808080"/>
</svg>
`;

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
        yield* fs.writeFileString(svg, sheetSvg);
        const pdfA = path.join(dir, "a.pdf");
        const pdfB = path.join(dir, "b.pdf");
        yield* tools.svgToPdf(SvgToPdfRequest.make({ svgPaths: [svg, svg], outputPath: pdfA }));
        yield* tools.svgToPdf(SvgToPdfRequest.make({ svgPaths: [svg, svg], outputPath: pdfB }));
        const [bytesA, bytesB] = yield* Effect.all([fs.readFile(pdfA), fs.readFile(pdfB)]);
        expect(Buffer.from(bytesA).equals(Buffer.from(bytesB))).toBe(true);

        const structure = yield* tools.inspect(pdfA);
        expect(structure.headerVersion).toBe("1.6");
        expect(structure.pages.length).toBe(2);
        expect(structure.pages[0]?.widthPt).toBeCloseTo(612, 0);
        expect(structure.pages[0]?.heightPt).toBeCloseTo(792, 0);
        expect(structure.fonts).toEqual([]);
        expect(structure.annotationCount).toBe(0);
        expect(structure.encrypted).toBe(false);

        const metrics = yield* tools.measurePage(
          RasterRequest.make({ pdfPath: pdfA, page: 2, dpi: 72, antiAlias: false })
        );
        expect(metrics.width).toBe(612);
        expect(metrics.height).toBe(792);
        // ink box spans the black square (72..171) only; gray (#808080, luma 128) sits on the threshold
        assertSome(
          O.map(metrics.inkBox, (box) => [box.minX, box.minY]),
          [72, 72]
        );
        expect(metrics.largestBlackSquare).toBe(100);
        // the gray square is the only impurity; no anti-aliasing means no edge grays
        expect(metrics.impurePixels).toBe(100 * 100);
        expect(metrics.chromaPixels).toBe(0);

        // page text: only the requested page, raw (no layout padding)
        const textSvg = (line: string) =>
          `<svg xmlns="http://www.w3.org/2000/svg" width="612pt" height="792pt"><text x="300" y="100" font-size="12">${line}</text></svg>\n`;
        yield* fs.writeFileString(path.join(dir, "p1.svg"), textSvg("Request page"));
        yield* fs.writeFileString(path.join(dir, "p2.svg"), textSvg("Initialed page AB"));
        const textPdf = path.join(dir, "text.pdf");
        yield* tools.svgToPdf(
          SvgToPdfRequest.make({ svgPaths: [path.join(dir, "p1.svg"), path.join(dir, "p2.svg")], outputPath: textPdf })
        );
        const text = yield* tools.pageText(PageTextRequest.make({ pdfPath: textPdf, page: 2 }));
        expect(text).toContain("Initialed page AB");
        expect(text).not.toContain("Request page");
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
        const [sheetBytes, reviewedBytes] = yield* sheetPair;
        const sheet = path.join(dir, "sheet.pdf");
        const reviewed = path.join(dir, "reviewed.pdf");
        yield* fs.writeFile(sheet, sheetBytes);
        yield* fs.writeFile(reviewed, reviewedBytes);

        expect(yield* tools.pageWords(PageTextRequest.make({ pdfPath: sheet, page: 1 }))).toEqual([]);
        const blocks = yield* tools.pageWords(PageTextRequest.make({ pdfPath: reviewed, page: 1 }));
        expect(A.map(blocks, (b) => b.text)).toEqual(["Make the box taller"]);
        // top-left frame: the baseline sits 92 pt below the top edge
        expect(blocks[0]?.rect.xMin).toBeCloseTo(72, 0);
        expect(blocks[0]?.rect.yMax).toBeGreaterThan(80);
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
        // the reverse direction leaves the note's ink uncovered
        const reverse = yield* tools.inkCoverage(
          InkCoverageRequest.make({
            base: PdfPageRef.make({ pdfPath: reviewed, page: 1 }),
            marked: PdfPageRef.make({ pdfPath: sheet, page: 1 }),
            dpi: 36,
            dilatePx: 1,
          })
        );
        expect(reverse.coverage).toBeLessThan(1);
        expect(yield* tools.annotations(reviewed)).toEqual([]);
      })
    );
  });
});
