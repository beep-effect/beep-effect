import { PdfTools, PdfToolsError, PngRequest, RasterRequest, SvgToPdfRequest } from "@beep/pdf-tools";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path, Sink, Stream } from "effect";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { PDFDocument, StandardFonts } from "pdf-lib";

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

// A minimal one-page PDF, the stand-in for rsvg-convert output.
const blankPage = Effect.promise(() => PDFDocument.create({ updateMetadata: false })).pipe(
  Effect.flatMap((doc) => {
    doc.addPage([612, 792]);
    return Effect.promise(() => doc.save({ useObjectStreams: false }));
  })
);

const makeHandle = (exitCode: number, stderr = ""): ChildProcessSpawner.ChildProcessHandle =>
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
    stdout: Stream.empty,
    unref: Effect.succeed(Effect.void),
  });

// Fake rsvg-convert writes a byte-sized "PDF"; fake pdftoppm writes the PPM
// fixture at the requested prefix.
const makeFakeSpawnerLayer = (commands: Array<ChildProcess.StandardCommand>, exitCode = 0) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return ChildProcessSpawner.ChildProcessSpawner.of(
        ChildProcessSpawner.make((command) =>
          Effect.gen(function* () {
            if (!ChildProcess.isStandardCommand(command)) {
              return makeHandle(1, "unsupported command");
            }
            commands[A.length(commands)] = command;
            if (exitCode !== 0) {
              return makeHandle(exitCode, "tool stderr");
            }
            if (command.command === "rsvg-convert") {
              const output = A.get(command.args, 3);
              if (O.isSome(output)) {
                yield* fs.writeFile(output.value, yield* blankPage);
              }
            }
            if (command.command === "pdftoppm" && !A.contains(command.args, "-png")) {
              const prefix = A.last(command.args);
              if (O.isSome(prefix)) {
                yield* fs.writeFile(`${prefix.value}.ppm`, ppmFixture);
              }
            }
            return makeHandle(0);
          })
        )
      );
    })
  );

const makeLayer = (commands: Array<ChildProcess.StandardCommand>, exitCode = 0) =>
  PdfTools.makeLayer().pipe(
    Layer.provide(makeFakeSpawnerLayer(commands, exitCode)),
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
          expect(structure.pages.map((p) => [p.widthPt, p.heightPt])).toEqual([
            [612, 792],
            [612, 792],
          ]);
          expect(structure.fonts.map((f) => [f.name, f.embedded])).toEqual([["Helvetica", false]]);
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
});
