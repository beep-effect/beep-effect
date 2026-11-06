import * as NodeURL from "node:url";
import { PdfTools, SvgToPdfRequest } from "@beep/pdf-tools";
import {
  CriticPackRequest,
  DrawingCritics,
  decodeCriticMeasurements,
  decodeCriticPackManifest,
  FigureSetLive,
} from "@beep/repo-cli/commands/Drawings";
import { FigureSet, RenderRequest, ValidationOptions } from "@beep/technical-drawing";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";

// Live lane: renders the synthetic fixture through the real kernel, rsvg-convert, and
// pdftoppm. Hosted runners do not install librsvg or poppler, so each test skips
// explicitly when a tool is missing; other spawn failures stay failures.
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

const missingTool = Effect.gen(function* () {
  if (!(yield* toolPresent("rsvg-convert", "--version"))) return O.some("rsvg-convert");
  return (yield* toolPresent("pdftoppm", "-v")) ? O.none<string>() : O.some("pdftoppm");
});

// The critic pack also reads the PDF with pdfinfo and pdffonts (poppler, beside pdftoppm).
const missingPackTool = Effect.gen(function* () {
  const render = yield* missingTool;
  if (O.isSome(render)) return render;
  if (!(yield* toolPresent("pdfinfo", "-v"))) return O.some("pdfinfo");
  return (yield* toolPresent("pdffonts", "-v")) ? O.none<string>() : O.some("pdffonts");
});

const skipWithoutTools = (context: { readonly skip: (note?: string) => void }, probe = missingTool) =>
  probe.pipe(
    Effect.map((missing) =>
      O.match(missing, {
        onNone: () => false,
        onSome: (tool) => {
          context.skip(`Missing native prerequisite: ${tool} on PATH`);
          return true;
        },
      })
    )
  );

const Golden = S.fromJsonString(
  S.Struct({
    spec: S.String,
    scale: S.Finite,
    model: S.Struct({
      boundingBox: S.Struct({
        min: S.Tuple([S.Finite, S.Finite, S.Finite]),
        max: S.Tuple([S.Finite, S.Finite, S.Finite]),
      }),
      volume: S.Finite,
      faceCount: S.Natural,
      edgeCount: S.Natural,
      // goldens recorded before the overlap count stay byte-identical
      partOverlaps: S.Natural.pipe(S.withDecodingDefaultTypeKey(Effect.succeed(0))),
    }),
    figures: S.Array(
      S.Struct({
        figure: S.Natural,
        view: S.String,
        svgSha256: S.String,
        visibleSegments: S.Natural,
        brokenSegments: S.Natural.pipe(S.withDecodingDefaultTypeKey(Effect.succeed(0))),
      })
    ),
    shadedSegments: S.Array(S.Natural).pipe(S.withDecodingDefaultTypeKey(Effect.succeed([]))),
  })
);
const decodeGolden = S.decodeUnknownEffect(Golden);
const repoRoot = NodeURL.fileURLToPath(new URL("../../../../../", import.meta.url));
const goldenPath = NodeURL.fileURLToPath(new URL("./fixtures/drawings/synthetic-bracket.golden.json", import.meta.url));
const crateGoldenPath = NodeURL.fileURLToPath(
  new URL("./fixtures/drawings/synthetic-crate.golden.json", import.meta.url)
);

// Render a golden's spec twice and check the first run against the golden,
// the second against the first, and the validator.
const renderAgainstGolden = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const figureSet = yield* FigureSet;
  const golden = yield* fs.readFileString(path).pipe(Effect.flatMap(decodeGolden));
  const specPath = paths.join(repoRoot, golden.spec);
  const dir = yield* fs.makeTempDirectoryScoped();
  const first = yield* figureSet.render(RenderRequest.make({ specPath, outputDir: paths.join(dir, "a") }));
  const second = yield* figureSet.render(RenderRequest.make({ specPath, outputDir: paths.join(dir, "b") }));
  expect(first.scale).toBe(golden.scale);
  expect(first.model).toEqual(golden.model);
  expect(
    A.map(first.figures, (f) => ({
      figure: f.figure,
      view: f.view,
      svgSha256: f.svgSha256,
      visibleSegments: f.visibleSegments,
      brokenSegments: f.brokenSegments,
    }))
  ).toEqual(golden.figures);
  expect(second.figures).toEqual(first.figures);
  expect(second.pdfSha256).toBe(first.pdfSha256);
  assertSome(
    O.map(first.validation, (v) => [v.pageCount, v.findings.length]),
    [8, 0]
  );
  return { first, outputDir: paths.join(dir, "a") };
});

const PdfToolsLive = PdfTools.makeLayer();
const LiveLayer = Layer.mergeAll(
  FigureSetLive,
  PdfToolsLive,
  DrawingCritics.layer.pipe(Layer.provide(PdfToolsLive))
).pipe(Layer.provideMerge(NodeServices.layer));

describe("beep drawings live", () => {
  it.layer(LiveLayer, { timeout: "180 seconds" })((it) => {
    it.effect(
      "renders the synthetic bracket to the committed goldens, byte-stable across two runs, validator clean",
      Effect.fnUntraced(function* (context) {
        if (yield* skipWithoutTools(context)) return;
        const { first } = yield* renderAgainstGolden(goldenPath);
        // the bracket has no broken-line parts and no overlapping parts
        expect(A.map(first.figures, (f) => f.brokenSegments)).toEqual(A.makeBy(8, () => 0));
        expect(first.model.partOverlaps).toBe(0);
      })
    );

    it.effect(
      "renders the synthetic crate with a dashed broken-line tab to the committed goldens, byte-stable, validator clean",
      Effect.fnUntraced(function* (context) {
        if (yield* skipWithoutTools(context)) return;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { first, outputDir } = yield* renderAgainstGolden(crateGoldenPath);
        // zero-clearance halving slots, lid and tab: parts touch, none overlap
        expect(first.model.partOverlaps).toBe(0);
        // the tab shows above the lid in every view but the two from below
        const shows = A.map(first.figures, (f) => [f.view, f.brokenSegments > 0] as const);
        expect(shows).toEqual([
          ["top-perspective", true],
          ["bottom-perspective", false],
          ["top-plan", true],
          ["bottom-plan", false],
          ["front", true],
          ["rear", true],
          ["left", true],
          ["right", true],
        ]);
        const topPlan = yield* fs.readFileString(path.join(outputDir, "fig-3.svg"));
        const bottomPlan = yield* fs.readFileString(path.join(outputDir, "fig-4.svg"));
        expect(topPlan).toContain('stroke-dasharray="8.504 4.252"');
        expect(bottomPlan).not.toContain('id="broken"');
      })
    );

    it.effect(
      "shades the synthetic bracket deterministically, perspectives only, validator clean",
      Effect.fnUntraced(function* (context) {
        if (yield* skipWithoutTools(context)) return;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const figureSet = yield* FigureSet;
        const golden = yield* fs.readFileString(goldenPath).pipe(Effect.flatMap(decodeGolden));
        const specPath = path.join(repoRoot, golden.spec);
        const dir = yield* fs.makeTempDirectoryScoped();
        const first = yield* figureSet.render(
          RenderRequest.make({ specPath, outputDir: path.join(dir, "a"), shade: true })
        );
        const second = yield* figureSet.render(
          RenderRequest.make({ specPath, outputDir: path.join(dir, "b"), shade: true })
        );
        expect(first.shaded).toBe(true);
        expect(A.map(first.figures, (f) => f.shadingSegments)).toEqual(golden.shadedSegments);
        // outlines are unchanged by shading
        expect(A.map(first.figures, (f) => f.visibleSegments)).toEqual(A.map(golden.figures, (f) => f.visibleSegments));
        expect(second.figures).toEqual(first.figures);
        expect(second.pdfSha256).toBe(first.pdfSha256);
        assertSome(
          O.map(first.validation, (v) => [v.pageCount, v.findings.length]),
          [8, 0]
        );
      })
    );

    it.effect(
      "packs the shaded synthetic bracket with the PDF facts and per-figure measurements a read-only critic reads",
      Effect.fnUntraced(function* (context) {
        if (yield* skipWithoutTools(context, missingPackTool)) return;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const figureSet = yield* FigureSet;
        const critics = yield* DrawingCritics;
        const golden = yield* fs.readFileString(goldenPath).pipe(Effect.flatMap(decodeGolden));
        const dir = yield* fs.makeTempDirectoryScoped();
        const manifest = yield* figureSet.render(
          RenderRequest.make({
            specPath: path.join(repoRoot, golden.spec),
            outputDir: path.join(dir, "render"),
            shade: true,
          })
        );
        yield* fs.writeFileString(path.join(dir, "BRIEF.md"), "# Synthetic bracket\n");
        const pack = yield* critics.buildPack(
          CriticPackRequest.make({
            manifestPath: path.join(dir, "render", "manifest.json"),
            outDir: path.join(dir, "pack"),
            briefPath: path.join(dir, "BRIEF.md"),
            imagesDirs: [],
            zooms: [],
          })
        );
        assertSome(pack.measurements, "render/MEASUREMENTS.md");
        const written = yield* fs
          .readFileString(path.join(dir, "pack", "pack.json"))
          .pipe(Effect.flatMap(decodeCriticPackManifest));
        assertSome(written.measurements, "render/MEASUREMENTS.md");
        const measurements = yield* fs
          .readFileString(path.join(dir, "pack", "render", "measurements.json"))
          .pipe(Effect.flatMap(decodeCriticMeasurements));
        const { pdf } = measurements;
        expect([pdf.pageCount, A.length(pdf.pages), pdf.streamCheck]).toStrictEqual([8, 8, "complete"]);
        expect(pdf.undecodableStreams).toStrictEqual([]);
        // every page box is the sheet the SVG states, the CropBox the MediaBox
        expect(
          A.map(pdf.pages, (page) => [page.page, page.mediaBox.widthMm, page.mediaBox.heightMm, page.cropBox.widthMm])
        ).toStrictEqual(
          A.map(measurements.figures, (figure) => [
            figure.figure,
            figure.sheetWidthMm,
            figure.sheetHeightMm,
            figure.sheetWidthMm,
          ])
        );
        // the validator passed the set, so every figure's ink clears every 1.84(g) margin
        const clear = A.map(measurements.figures, (figure) =>
          O.match(figure.ink, {
            onNone: () => [figure.figure, "no ink"],
            onSome: (box) => [figure.figure, box.top.meets && box.left.meets && box.right.meets && box.bottom.meets],
          })
        );
        expect(clear).toStrictEqual(A.map(measurements.figures, (figure) => [figure.figure, true]));
        // the shading statistics count the strokes the render drew
        expect(A.map(measurements.figures, (figure) => figure.shading.count)).toStrictEqual(
          A.map(manifest.figures, (figure) => figure.shadingSegments)
        );
        const markdown = yield* fs.readFileString(path.join(dir, "pack", "render", "MEASUREMENTS.md"));
        expect(markdown).toContain('# MEASUREMENTS.md — measured facts of "');
        expect(markdown).toContain("## FIG 8 (");
      })
    );

    it.effect(
      "flags a margin violation, a gray stroke, and a PDF 1.7 header",
      Effect.fnUntraced(function* (context) {
        if (yield* skipWithoutTools(context)) return;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const figureSet = yield* FigureSet;
        const tools = yield* PdfTools;
        const dir = yield* fs.makeTempDirectoryScoped();
        const golden = yield* fs.readFileString(goldenPath).pipe(Effect.flatMap(decodeGolden));
        yield* figureSet.render(
          RenderRequest.make({
            specPath: path.join(repoRoot, golden.spec),
            outputDir: path.join(dir, "ok"),
            validate: false,
          })
        );
        const sheet = yield* fs.readFileString(path.join(dir, "ok", "fig-5.svg"));
        const codesOf = (pdf: string) =>
          figureSet
            .validate(pdf, ValidationOptions.make({ expectedPages: O.some(1) }))
            .pipe(Effect.map((report) => A.map(report.findings, (f) => f.code)));

        // (a) shift the figure 3 cm left: ink crosses the 2.5 cm left margin
        const shifted = Str.replace(
          '<path id="figure" d="',
          '<path id="figure" transform="translate(-85 0)" d="'
        )(sheet);
        yield* fs.writeFileString(path.join(dir, "margin.svg"), shifted);
        yield* tools.svgToPdf(
          SvgToPdfRequest.make({ svgPaths: [path.join(dir, "margin.svg")], outputPath: path.join(dir, "margin.pdf") })
        );
        const codesOf1 = yield* codesOf(path.join(dir, "margin.pdf"));
        expect(codesOf1).toContain("margin-left");

        // (b) a 50 % gray stroke survives the non-anti-aliased render as gray
        const gray = Str.replaceAll('stroke="#000000"', 'stroke="#808080"')(sheet);
        yield* fs.writeFileString(path.join(dir, "gray.svg"), gray);
        yield* tools.svgToPdf(
          SvgToPdfRequest.make({ svgPaths: [path.join(dir, "gray.svg")], outputPath: path.join(dir, "gray.pdf") })
        );
        const codesOf2 = yield* codesOf(path.join(dir, "gray.pdf"));
        expect(codesOf2).toContain("impure-pixels");

        // (c) PDF 1.7 is outside the Patent Center range
        yield* fs.writeFileString(path.join(dir, "v17.svg"), sheet);
        yield* tools.svgToPdf(
          SvgToPdfRequest.make({
            svgPaths: [path.join(dir, "v17.svg")],
            outputPath: path.join(dir, "v17.pdf"),
            pdfVersion: "1.7",
          })
        );
        const codesOf3 = yield* codesOf(path.join(dir, "v17.pdf"));
        expect(codesOf3).toEqual(["pdf-version"]);
      })
    );
  });
});
