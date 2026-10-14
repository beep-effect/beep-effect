import {
  FontFamilyAlias,
  InkCoverageRequest,
  PageTextRequest,
  PdfFont,
  PdfPageRef,
  PdfTools,
  PdfToolsConfig,
  PdfToolsError,
  PinnedFontconfigRequest,
  PinnedFonts,
  PngRequest,
  pinnedFontconfig,
  RasterRequest,
  SvgToPdfRequest,
} from "@beep/pdf-tools";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { TestClock } from "effect/testing";
import { PDFDocument, PDFHexString, PDFString, StandardFonts } from "pdf-lib";
import type * as PlatformError from "effect/PlatformError";

const encoder = new TextEncoder();

// A 6 × 4 P6 raster: a 3 × 3 black square at (1,1), one gray pixel at (5,0),
// one red pixel at (5,3), white elsewhere.
const ppmFixture = (() => {
  const width = 6;
  const height = 4;
  const header = encoder.encode(`P6\n# comment\n${width} ${height}\n255\n`);
  const pixels = new Uint8Array(width * height * 3).fill(255);
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const i = (y * width + x) * 3;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
  };
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      set(x, y, 0, 0, 0);
    }
  }
  set(5, 0, 128, 128, 128);
  set(5, 3, 255, 0, 0);
  const out = new Uint8Array(header.length + pixels.length);
  out.set(header, 0);
  out.set(pixels, header.length);
  return out;
})();

// P6 raster of `width` × `height` white pixels with black ink at `inked`.
const ppmOf = (width: number, height: number, inked: ReadonlyArray<readonly [number, number]>) => {
  const header = encoder.encode(`P6\n${width} ${height}\n255\n`);
  const pixels = new Uint8Array(width * height * 3).fill(255);
  for (const [x, y] of inked) {
    pixels.fill(0, (y * width + x) * 3, (y * width + x) * 3 + 3);
  }
  const out = new Uint8Array(header.length + pixels.length);
  out.set(header, 0);
  out.set(pixels, header.length);
  return out;
};

// Base sheet: a three-pixel stroke on row 1 and a dot at (6,2). The marked
// page carries the stroke one row lower (a re-export shift) and a dot at (7,0).
const basePpm = ppmOf(8, 4, [
  [1, 1],
  [2, 1],
  [3, 1],
  [6, 2],
]);
const markedPpm = ppmOf(8, 4, [
  [1, 2],
  [2, 2],
  [7, 0],
]);
const smallMarkedPpm = ppmOf(2, 2, [[1, 1]]);
const blankPpm = ppmOf(8, 4, []);

const bboxLayout = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><body><doc>
  <page width="612.000000" height="792.000000">
    <flow>
      <block xMin="72.000000" yMin="84.500000" xMax="238.250000" yMax="108.000000">
        <line xMin="72.000000" yMin="84.500000" xMax="238.250000" yMax="94.000000">
          <word xMin="72.000000" yMin="84.500000" xMax="101.000000" yMax="94.000000">Rotate</word>
          <word xMin="104.000000" yMin="84.500000" xMax="140.000000" yMax="94.000000">A&amp;B</word>
        </line>
        <line xMin="72.000000" yMin="98.000000" xMax="200.000000" yMax="108.000000">
          <word xMin="72.000000" yMin="98.000000" xMax="120.000000" yMax="108.000000">&lt;left&gt;</word>
          <word xMin="122.000000" yMin="98.000000" xMax="140.000000" yMax="108.000000">&#233;&#x2014;&quot;&apos;</word>
        </line>
      </block>
      <block xMin="10" yMin="10" xMax="20" yMax="20"><line xMin="10" yMin="10" xMax="20" yMax="20"></line></block>
    </flow>
    <flow>
      <block xMin="72" yMin="724.82" xMax="208.16" yMax="734.07">
        <line xMin="72" yMin="724.82" xMax="208.16" yMax="734.07"><word xMin="72" yMin="724.82" xMax="208.16" yMax="734.07">(all</word><word xMin="72" yMin="724.82" xMax="208.16" yMax="734.07">sheets)</word></line>
      </block>
    </flow>
  </page>
</doc></body></html>
`;

// A minimal one-page PDF, the stand-in for rsvg-convert output.
const blankPage = Effect.promise(() => PDFDocument.create({ updateMetadata: false })).pipe(
  Effect.flatMap((doc) => {
    doc.addPage([612, 792]);
    return Effect.promise(() => doc.save({ useObjectStreams: false }));
  })
);

const makeHandle = (exitCode: number, stderr = "", stdout = ""): ChildProcessSpawner.ChildProcessHandle =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: stderr.length === 0 ? Stream.empty : Stream.succeed(encoder.encode(stderr)),
    stdin: Sink.drain,
    stdout: stdout.length === 0 ? Stream.empty : Stream.succeed(encoder.encode(stdout)),
    unref: Effect.succeed(Effect.void),
  });

// Fake rsvg-convert writes a byte-sized "PDF"; fake pdftoppm writes the PPM
// fixture at the requested prefix.
// Fake rsvg-convert writes a one-page PDF at the `--output` path; fake pdftoppm (not `-png`)
// writes the PPM fixture at the requested prefix.
const fakeOutputs = (
  fs: FileSystem.FileSystem,
  command: ChildProcess.StandardCommand
): Effect.Effect<void, PlatformError.PlatformError> => {
  if (command.command === "rsvg-convert") {
    return pipe(
      A.get(command.args, 3),
      O.match({
        onNone: () => Effect.void,
        onSome: (output) => blankPage.pipe(Effect.flatMap((bytes) => fs.writeFile(output, bytes))),
      })
    );
  }
  if (command.command === "pdftoppm" && !A.contains(command.args, "-png")) {
    const source = A.get(command.args, A.length(command.args) - 2);
    const fixtureFor = (prefix: string) =>
      prefix.endsWith("/base")
        ? O.exists(source, Str.endsWith("blank.pdf"))
          ? blankPpm
          : basePpm
        : prefix.endsWith("/marked")
          ? O.exists(source, (pdf) => pdf.endsWith("small.pdf"))
            ? smallMarkedPpm
            : markedPpm
          : ppmFixture;
    return pipe(
      A.last(command.args),
      O.match({ onNone: () => Effect.void, onSome: (prefix) => fs.writeFile(`${prefix}.ppm`, fixtureFor(prefix)) })
    );
  }
  return Effect.void;
};

const makeFakeSpawnerLayer = (
  commands: Array<ChildProcess.StandardCommand>,
  exitCode = 0,
  fontconfigs: Array<string> = []
) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return ChildProcessSpawner.ChildProcessSpawner.of(
        ChildProcessSpawner.make(
          Effect.fnUntraced(function* (command) {
            if (!ChildProcess.isStandardCommand(command)) {
              return makeHandle(1, "unsupported command");
            }
            commands[A.length(commands)] = command;
            if (exitCode !== 0) {
              return makeHandle(exitCode, "tool stderr");
            }
            // The pinned fontconfig file lives in a scoped temp directory: read it while it exists.
            const fontconfig = command.options.env?.FONTCONFIG_FILE;
            if (fontconfig !== undefined) {
              fontconfigs[A.length(fontconfigs)] = yield* fs.readFileString(fontconfig);
            }
            yield* fakeOutputs(fs, command);
            if (command.command === "pdftotext" && A.contains(command.args, "-bbox-layout")) {
              const output = Match.value(O.getOrElse(A.get(command.args, A.length(command.args) - 2), () => "")).pipe(
                Match.when(Str.endsWith("broken.pdf"), () => "<html>no pages</html>"),
                Match.when(Str.endsWith("invalid-coordinate.pdf"), () =>
                  Str.replace('xMin="72.000000"', 'xMin="not-a-number"')(bboxLayout)
                ),
                Match.orElse(() => bboxLayout)
              );
              return makeHandle(0, "", output);
            }
            return makeHandle(0);
          })
        )
      );
    })
  );

// A tool that starts and never exits.
const HangingSpawner = Layer.succeed(
  ChildProcessSpawner.ChildProcessSpawner,
  ChildProcessSpawner.ChildProcessSpawner.of(
    ChildProcessSpawner.make(() =>
      Effect.succeed(
        ChildProcessSpawner.makeHandle({
          all: Stream.empty,
          exitCode: Effect.never,
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
          isRunning: Effect.succeed(true),
          kill: () => Effect.void,
          pid: ChildProcessSpawner.ProcessId(1),
          stderr: Stream.empty,
          stdin: Sink.drain,
          stdout: Stream.empty,
          unref: Effect.succeed(Effect.void),
        })
      )
    )
  )
);

const makeLayer = (commands: Array<ChildProcess.StandardCommand>, exitCode = 0, fontconfigs: Array<string> = []) =>
  PdfTools.makeLayer().pipe(
    Layer.provide(makeFakeSpawnerLayer(commands, exitCode, fontconfigs)),
    Layer.provideMerge(NodeServices.layer)
  );

describe("@beep/pdf-tools service", () => {
  describe("svgToPdf", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    it.layer(makeLayer(commands), { timeout: "30 seconds" })((it) => {
      it.effect(
        "converts SVG pages with a pinned version and SOURCE_DATE_EPOCH",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const out = path.join(dir, "sheets.pdf");
          const tools = yield* PdfTools;
          const result = yield* tools.svgToPdf(
            SvgToPdfRequest.make({ svgPaths: [path.join(dir, "a.svg"), path.join(dir, "b.svg")], outputPath: out })
          );
          expect(result.pageCount).toBe(2);
          const written = yield* fs.readFile(out);
          expect(written.byteLength).toBe(result.bytes);
          expect(new TextDecoder().decode(written.subarray(0, 8))).toBe("%PDF-1.6");
          expect(commands.length).toBe(2);
          const command = commands[0];
          expect(command?.command).toBe("rsvg-convert");
          expect(command?.args.slice(0, 2)).toEqual(["--format", "pdf1.6"]);
          expect(command?.args.length).toBe(5);
          expect(command?.options.env?.SOURCE_DATE_EPOCH).toBe("0");
          expect(command?.options.extendEnv).toBe(true);
        })
      );
    });
  });

  describe("svgToPdf with pinned fonts", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    const fontconfigs: Array<string> = [];
    it.layer(makeLayer(commands, 0, fontconfigs), { timeout: "30 seconds" })((it) => {
      it.effect(
        "runs rsvg-convert under a fontconfig file that sees only the pinned directory",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const fontDir = path.join(dir, "fonts & co");
          yield* fs.makeDirectory(fontDir);
          const tools = yield* PdfTools;
          yield* tools.svgToPdf(
            SvgToPdfRequest.make({
              svgPaths: [path.join(dir, "a.svg")],
              outputPath: path.join(dir, "out.pdf"),
              fonts: O.some(
                PinnedFonts.make({
                  directory: fontDir,
                  families: [FontFamilyAlias.make({ requested: "Arial", family: "Liberation Sans" })],
                })
              ),
            })
          );
          expect(commands[0]?.options.env?.FONTCONFIG_FILE).toMatch(/fonts\.conf$/);
          expect(commands[0]?.options.env?.SOURCE_DATE_EPOCH).toBe("0");
          const config = fontconfigs[0] ?? "";
          // the only <dir> is the pinned one, XML-escaped; no <include> pulls in the system config
          expect(config.match(/<dir>/g)?.length).toBe(1);
          expect(config).toContain(`<dir>${fontDir.replace("&", "&amp;")}</dir>`);
          expect(config).not.toContain("<include");
          expect(config).toContain(
            `<test name="family" qual="any"><string>Arial</string></test><edit name="family" mode="assign" binding="strong"><string>Liberation Sans</string></edit>`
          );
        })
      );

      it.effect(
        "refuses a pinned font directory that does not exist, before any tool runs",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const before = A.length(commands);
          const error = yield* Effect.flip(
            tools.svgToPdf(
              SvgToPdfRequest.make({
                svgPaths: ["a.svg"],
                outputPath: "out.pdf",
                fonts: O.some(PinnedFonts.make({ directory: "/nonexistent/beep-fonts", families: [] })),
              })
            )
          );
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("invalid-request");
          expect(A.length(commands)).toBe(before);
        })
      );
    });

    it.effect("writes the pinned fontconfig for every alias", () =>
      Effect.sync(() => {
        const config = pinnedFontconfig(
          PinnedFontconfigRequest.make({
            fonts: PinnedFonts.make({
              directory: "/fonts",
              families: [
                FontFamilyAlias.make({ requested: "Arial", family: "Arial" }),
                FontFamilyAlias.make({ requested: "Times New Roman", family: "Times New Roman" }),
              ],
            }),
            cacheDirectory: "/cache",
          })
        );
        expect(config).toContain("<cachedir>/cache</cachedir>");
        expect(config.match(/<match target="pattern">/g)?.length).toBe(2);
        expect(PdfFont.make({ name: "QWERTY+TimesNewRomanPSMT", embedded: true }).baseName).toBe("TimesNewRomanPSMT");
        expect(PdfFont.make({ name: "Helvetica", embedded: false }).baseName).toBe("Helvetica");
      })
    );
  });

  describe("measurePage", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    it.layer(makeLayer(commands), { timeout: "30 seconds" })((it) => {
      it.effect(
        "measures a rendered page: ink box, purity, and the largest black square",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const metrics = yield* tools.measurePage(
            RasterRequest.make({ pdfPath: "sheets.pdf", page: 2, dpi: 300, antiAlias: false })
          );
          expect(metrics.width).toBe(6);
          expect(metrics.height).toBe(4);
          assertSome(
            O.map(metrics.inkBox, (box) => [box.minX, box.minY, box.maxX, box.maxY]),
            [1, 0, 5, 3]
          );
          // 9 black + 1 gray (luma 128 counts as ink at the default threshold) + red (luma 76)
          expect(metrics.inkPixels).toBe(11);
          expect(metrics.impurePixels).toBe(2);
          expect(metrics.chromaPixels).toBe(1);
          expect(metrics.largestBlackSquare).toBe(3);
          const args = commands[0]?.args ?? [];
          expect(args).toContain("-aa");
          expect(args.slice(0, 6)).toEqual(["-r", "300", "-f", "2", "-l", "2"]);
        })
      );
    });
  });

  describe("renderPng", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    it.layer(makeLayer(commands), { timeout: "30 seconds" })((it) => {
      it.effect(
        "renders a PNG next to the requested path",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const out = yield* tools.renderPng(
            PngRequest.make({ pdfPath: "sheets.pdf", page: 1, dpi: 72, outputPath: "/tmp/x/page-1.png" })
          );
          expect(out).toBe("/tmp/x/page-1.png");
          expect(commands[0]?.args[0]).toBe("-png");
          assertSome(A.last(commands[0]?.args ?? []), "/tmp/x/page-1");
        })
      );
    });
  });

  describe("inspect", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    it.layer(makeLayer(commands), { timeout: "30 seconds" })((it) => {
      it.effect(
        "inspects a pdf-lib document: version, pages, fonts, annotations",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const file = path.join(dir, "doc.pdf");
          const doc = yield* Effect.promise(() => PDFDocument.create());
          const font = yield* Effect.promise(() => doc.embedFont(StandardFonts.Helvetica));
          doc.addPage([612, 792]).drawText("FIG. 1", { x: 50, y: 50, font, size: 14 });
          doc.addPage([612, 792]);
          const bytes = yield* Effect.promise(() => doc.save({ useObjectStreams: false }));
          yield* fs.writeFile(file, bytes);
          const tools = yield* PdfTools;
          const structure = yield* tools.inspect(file);
          expect(structure.headerVersion).toBe("1.7");
          expect(A.map(structure.pages, (p) => [p.widthPt, p.heightPt])).toEqual([
            [612, 792],
            [612, 792],
          ]);
          expect(A.map(structure.fonts, (f) => [f.name, f.embedded])).toEqual([["Helvetica", false]]);
          expect(structure.annotationCount).toBe(0);
          expect(structure.hasOptionalContent).toBe(false);
          expect(structure.encrypted).toBe(false);
          expect(commands.length).toBe(0);
        })
      );

      it.effect(
        "rejects an invalid raster request before spawning",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const error = yield* Effect.flip(
            tools.measurePage({
              pdfPath: "x.pdf",
              page: 0,
              dpi: 300,
              antiAlias: true,
              blackThreshold: 128,
            } as RasterRequest)
          );
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("invalid-request");
          expect(commands.length).toBe(0);
        })
      );
    });
  });

  describe("pageWords", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    it.layer(makeLayer(commands), { timeout: "30 seconds" })((it) => {
      it.effect(
        "parses -bbox-layout blocks: words by space, lines by newline, entities decoded, empty blocks dropped",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const blocks = yield* tools.pageWords(PageTextRequest.make({ pdfPath: "reviewed.pdf", page: 2 }));
          expect(blocks.map((b) => b.text)).toEqual(["Rotate A&B\n<left> é—\"'", "(all sheets)"]);
          expect(blocks.map((b) => [b.rect.xMin, b.rect.yMin, b.rect.xMax, b.rect.yMax])).toEqual([
            [72, 84.5, 238.25, 108],
            [72, 724.82, 208.16, 734.07],
          ]);
          expect(commands[0]?.args.slice(0, 5)).toEqual(["-bbox-layout", "-f", "2", "-l", "2"]);
        })
      );

      it.effect(
        "reports parse when the output has no page",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const error = yield* Effect.flip(tools.pageWords(PageTextRequest.make({ pdfPath: "broken.pdf", page: 1 })));
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("parse");
          expect(error.message).toBe("pdftotext -bbox-layout output has no page.");
        })
      );

      it.effect(
        "refuses a block with a nonnumeric coordinate instead of returning a malformed rectangle",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const error = yield* Effect.flip(
            tools.pageWords(PageTextRequest.make({ pdfPath: "invalid-coordinate.pdf", page: 1 }))
          );
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("parse");
          expect(error.message).toBe("A pdftotext block has no numeric xMin.");
        })
      );
    });
  });

  describe("inkCoverage", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    const request = (dilatePx: number, markedPdf = "reviewed.pdf") =>
      InkCoverageRequest.make({
        base: PdfPageRef.make({ pdfPath: "sheets.pdf", page: 3 }),
        marked: PdfPageRef.make({ pdfPath: markedPdf, page: 1 }),
        dpi: 36,
        dilatePx,
      });
    it.layer(makeLayer(commands), { timeout: "30 seconds" })((it) => {
      it.effect(
        "covers base ink with the dilated marked ink, rasterising both pages without anti-aliasing",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const coverage = yield* tools.inkCoverage(request(1));
          // the shifted stroke covers all three stroke pixels; the dot at (6,2) is two rows from (7,0)
          expect([coverage.baseInkPixels, coverage.coveredPixels, coverage.markedInkPixels]).toEqual([4, 3, 3]);
          expect(coverage.coverage).toBe(0.75);
          const exact = yield* tools.inkCoverage(request(0));
          expect([exact.coveredPixels, exact.coverage]).toEqual([0, 0]);
          const wide = yield* tools.inkCoverage(request(2));
          expect(wide.coverage).toBe(1);
          const rasterOf = (prefix: string) =>
            A.findFirst(commands, (command) => O.exists(A.last(command.args), (last) => last.endsWith(prefix)));
          assertSome(
            O.map(rasterOf("/base"), (command) => command.args.slice(0, 9)),
            ["-r", "36", "-f", "3", "-l", "3", "-singlefile", "-aa", "no"]
          );
          assertSome(
            O.map(rasterOf("/marked"), (command) => command.args.slice(2, 4)),
            ["-f", "1"]
          );
        })
      );

      it.effect(
        "counts base ink outside a smaller marked raster as uncovered",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const coverage = yield* tools.inkCoverage(request(1, "small.pdf"));
          // the marked dot at (1,1) dilates over (0..2, 0..2) but the raster stops at 2 × 2
          expect([coverage.baseInkPixels, coverage.coveredPixels, coverage.markedInkPixels]).toEqual([4, 1, 1]);
          expect(coverage.coverage).toBe(0.25);
        })
      );

      it.effect(
        "rejects a negative dilation before spawning",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const before = commands.length;
          const error = yield* Effect.flip(tools.inkCoverage({ ...request(0), dilatePx: -1 } as InkCoverageRequest));
          expect(error.reason).toBe("invalid-request");
          expect(commands.length).toBe(before);
        })
      );

      it.effect(
        "reports zero coverage for a blank base page without dividing by zero",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const coverage = yield* tools.inkCoverage(
            InkCoverageRequest.make({
              base: PdfPageRef.make({ pdfPath: "blank.pdf", page: 1 }),
              marked: PdfPageRef.make({ pdfPath: "reviewed.pdf", page: 1 }),
              dpi: 36,
              dilatePx: 0,
            })
          );
          expect([coverage.baseInkPixels, coverage.coveredPixels, coverage.markedInkPixels]).toEqual([0, 0, 3]);
          expect(coverage.coverage).toBe(0);
        })
      );
    });
  });

  describe("annotations", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    it.layer(makeLayer(commands), { timeout: "30 seconds" })((it) => {
      it.effect(
        "reads annotation objects with rectangles in the top-left frame",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const file = path.join(dir, "comments.pdf");
          const doc = yield* Effect.promise(() => PDFDocument.create());
          doc.addPage([612, 792]);
          const page = doc.addPage([612, 792]);
          const note = doc.context.obj({
            Type: "Annot",
            Subtype: "Text",
            Rect: [92, 720, 72, 700],
            Contents: PDFString.of("Rotate this view"),
            T: PDFHexString.fromText("Reviewer"),
          });
          const noRect = doc.context.obj({ Type: "Annot", Subtype: "Text", Contents: PDFString.of("lost") });
          const highlight = doc.context.obj({ Type: "Annot", Subtype: "Highlight", Rect: [10, 10, 20, 30] });
          page.node.addAnnot(doc.context.register(note));
          page.node.addAnnot(doc.context.register(noRect));
          page.node.addAnnot(doc.context.register(highlight));
          yield* fs.writeFile(file, yield* Effect.promise(() => doc.save({ useObjectStreams: false })));
          const tools = yield* PdfTools;
          const annotations = yield* tools.annotations(file);
          expect(annotations.map((a) => [a.page, a.subtype])).toEqual([
            [2, "Text"],
            [2, "Highlight"],
          ]);
          const first = annotations[0];
          expect(
            first === undefined ? [] : [first.rect.xMin, first.rect.yMin, first.rect.xMax, first.rect.yMax]
          ).toEqual([72, 72, 92, 92]);
          assertSome(first?.contents ?? O.none(), "Rotate this view");
          assertSome(first?.author ?? O.none(), "Reviewer");
          assertNone(annotations[1]?.contents ?? O.some("x"));
          expect(commands.length).toBe(0);
        })
      );

      it.effect(
        "reports parse for a file pdf-lib cannot read",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const file = path.join(dir, "not.pdf");
          yield* fs.writeFileString(file, "not a pdf");
          const tools = yield* PdfTools;
          const error = yield* Effect.flip(tools.annotations(file));
          expect(error.reason).toBe("parse");
        })
      );
    });
  });

  describe("when the tool exits non-zero", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    it.layer(makeLayer(commands, 3), { timeout: "30 seconds" })((it) => {
      it.effect(
        "reports tool-failed with stderr",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const error = yield* Effect.flip(
            tools.svgToPdf(SvgToPdfRequest.make({ svgPaths: ["a.svg"], outputPath: "out.pdf" }))
          );
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("tool-failed");
          assertSome(error.cause, "tool stderr");
          assertNone(O.filter(error.cause, (text) => text.length === 0));
        })
      );
    });
  });
  describe("when the tool never exits", () => {
    const HangingLayer = PdfTools.makeLayer(PdfToolsConfig.make({ timeoutMillis: 5_000 })).pipe(
      Layer.provide(HangingSpawner),
      Layer.provideMerge(NodeServices.layer)
    );
    it.layer(HangingLayer, { timeout: "30 seconds" })((it) => {
      it.effect(
        "stops the run at the configured timeout and reports tool-failed",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const fiber = yield* tools
            .pageText(PageTextRequest.make({ pdfPath: "sheets.pdf", page: 1 }))
            .pipe(Effect.flip, Effect.forkChild);
          yield* TestClock.adjust("4 seconds");
          expect(fiber.pollUnsafe()).toBeUndefined();
          yield* TestClock.adjust("2 seconds");
          const error = yield* Fiber.join(fiber);
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("tool-failed");
          expect(error.message).toBe("pdftotext timed out after 5000 ms while extracting the text of page 1.");
        })
      );
    });
  });
});
