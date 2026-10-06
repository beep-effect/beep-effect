import { PdfTools, SvgToPdfRequest } from "@beep/pdf-tools";
import { FigureSetLive } from "@beep/repo-cli/commands/Drawings";
import { FigureSet, RenderRequest, ValidationOptions } from "@beep/technical-drawing";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
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

const skipWithoutTools = (context: { readonly skip: (note?: string) => void }) =>
  missingTool.pipe(
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
    }),
    figures: S.Array(S.Struct({ figure: S.Natural, view: S.String, svgSha256: S.String, visibleSegments: S.Natural })),
    shadedSegments: S.Array(S.Natural),
  })
);
const decodeGolden = S.decodeUnknownEffect(Golden);
const repoRoot = new URL("../../../../../", import.meta.url).pathname;
const goldenPath = new URL("./fixtures/drawings/synthetic-bracket.golden.json", import.meta.url).pathname;

const LiveLayer = Layer.mergeAll(FigureSetLive, PdfTools.makeLayer()).pipe(Layer.provideMerge(NodeServices.layer));

describe("beep drawings live", () => {
  it.layer(LiveLayer, { timeout: "180 seconds" })((it) => {
    it.effect(
      "renders the synthetic bracket to the committed goldens, byte-stable across two runs, validator clean",
      (context) =>
        Effect.gen(function* () {
          if (yield* skipWithoutTools(context)) return;
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const figureSet = yield* FigureSet;
          const golden = yield* fs.readFileString(goldenPath).pipe(Effect.flatMap(decodeGolden));
          const specPath = path.join(repoRoot, golden.spec);
          const dir = yield* fs.makeTempDirectoryScoped();
          const first = yield* figureSet.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "a") }));
          const second = yield* figureSet.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "b") }));
          expect(first.scale).toBe(golden.scale);
          expect(first.model).toEqual(golden.model);
          expect(
            A.map(first.figures, (f) => ({
              figure: f.figure,
              view: f.view,
              svgSha256: f.svgSha256,
              visibleSegments: f.visibleSegments,
            }))
          ).toEqual(golden.figures);
          expect(second.figures).toEqual(first.figures);
          expect(second.pdfSha256).toBe(first.pdfSha256);
          assertSome(
            O.map(first.validation, (v) => [v.pageCount, v.findings.length]),
            [8, 0]
          );
        })
    );

    it.effect("shades the synthetic bracket deterministically, perspectives only, validator clean", (context) =>
      Effect.gen(function* () {
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

    it.effect("flags a margin violation, a gray stroke, and a PDF 1.7 header", (context) =>
      Effect.gen(function* () {
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
        expect(yield* codesOf(path.join(dir, "margin.pdf"))).toContain("margin-left");

        // (b) a 50 % gray stroke survives the non-anti-aliased render as gray
        const gray = Str.replaceAll('stroke="#000000"', 'stroke="#808080"')(sheet);
        yield* fs.writeFileString(path.join(dir, "gray.svg"), gray);
        yield* tools.svgToPdf(
          SvgToPdfRequest.make({ svgPaths: [path.join(dir, "gray.svg")], outputPath: path.join(dir, "gray.pdf") })
        );
        expect(yield* codesOf(path.join(dir, "gray.pdf"))).toContain("impure-pixels");

        // (c) PDF 1.7 is outside the Patent Center range
        yield* fs.writeFileString(path.join(dir, "v17.svg"), sheet);
        yield* tools.svgToPdf(
          SvgToPdfRequest.make({
            svgPaths: [path.join(dir, "v17.svg")],
            outputPath: path.join(dir, "v17.pdf"),
            pdfVersion: "1.7",
          })
        );
        expect(yield* codesOf(path.join(dir, "v17.pdf"))).toEqual(["pdf-version"]);
      })
    );
  });
});
