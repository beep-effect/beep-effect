import { PdfTools, RasterRequest, SvgToPdfRequest } from "@beep/pdf-tools";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";

// Live lane: exercises the real rsvg-convert and pdftoppm binaries on PATH.
const LiveLayer = PdfTools.makeLayer().pipe(Layer.provideMerge(NodeServices.layer));

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
      Effect.fnUntraced(function* () {
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
      })
    );
  });
});
