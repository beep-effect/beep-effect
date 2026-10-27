import * as NodeZlib from "node:zlib";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  FontFamilyAlias,
  InkCoverageRequest,
  PageTextRequest,
  PdfFont,
  PdfPageRef,
  PdfStructure,
  PdfTools,
  PdfToolsConfig,
  PdfToolsError,
  PinnedFontconfigRequest,
  PinnedFonts,
  PngRequest,
  pinnedFontconfig,
  RasterRequest,
  SvgToPdfRequest,
  UndecodableStream,
} from "@beep/pdf-tools";
import { it } from "@beep/test-runner";
import { Str } from "@beep/utils";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { constant, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFRef, PDFString, StandardFonts } from "pdf-lib";
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

// The stand-in for rsvg-convert output: one Letter page per input SVG.
// pdf-lib writes a `%PDF-1.7` header, which is what rsvg-convert writes for
// the unversioned `pdf` format; a `pdf1.x` format gets its own header.
const fakeRsvgPdf = (pageCount: number, format: string) =>
  Effect.promise(() => PDFDocument.create({ updateMetadata: false })).pipe(
    Effect.flatMap((doc) => {
      for (let page = 0; page < pageCount; page += 1) {
        doc.addPage([612, 792]);
      }
      return Effect.promise(() => doc.save({ useObjectStreams: false }));
    }),
    Effect.map((bytes) => {
      if (Str.startsWith("pdf1.")(format)) {
        bytes.set(encoder.encode(`%PDF-${Str.slice("pdf".length)(format)}`), 0);
      }
      return bytes;
    })
  );

const concatBytes = (...parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const out = new Uint8Array(A.reduce(parts, 0, (total, part) => total + part.length));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const streamBody = (dict: string, data: Uint8Array): Uint8Array =>
  concatBytes(encoder.encode(`${dict}\nstream\n`), data, encoder.encode("\nendstream"));

// A hand-written PDF whose objects 1..n are `bodies`, with a correct xref
// table; objects 1-3 must be the catalog, page tree, and page.
const craftPdf = (bodies: ReadonlyArray<Uint8Array | string>): Uint8Array => {
  const header = encoder.encode("%PDF-1.6\n");
  const objects = A.map(bodies, (body, index) =>
    concatBytes(
      encoder.encode(`${index + 1} 0 obj\n`),
      typeof body === "string" ? encoder.encode(body) : body,
      encoder.encode("\nendobj\n")
    )
  );
  const offsets: Array<number> = [];
  let offset = header.length;
  for (const object of objects) {
    offsets.push(offset);
    offset += object.length;
  }
  const xref = A.join(
    [
      "xref",
      `0 ${objects.length + 1}`,
      "0000000000 65535 f ",
      ...A.map(offsets, (at) => `${Str.padStart(10, "0")(String(at))} 00000 n `),
      "trailer",
      `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
      "startxref",
      `${offset}`,
      "%%EOF",
      "",
    ],
    "\n"
  );
  return concatBytes(header, ...objects, encoder.encode(xref));
};

const pageObjects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
];

const latin1 = new TextDecoder("latin1");

// The bytes of `pdf` with an incremental update appended that redefines
// `objectNumber` as `body`, with its own xref section and trailer.
const appendRevision = (pdf: Uint8Array, objectNumber: number, body: Uint8Array): Uint8Array => {
  const text = latin1.decode(pdf);
  const previous =
    Str.split(/\s/)(
      Str.trim(Str.slice(O.getOrElse(constant(-1))(Str.lastIndexOf("startxref")(text)) + "startxref".length)(text))
    )[0] ?? "0";
  const size = /\/Size (\d+)/.exec(text)?.[1] ?? "0";
  const object = concatBytes(encoder.encode(`${objectNumber} 0 obj\n`), body, encoder.encode("\nendobj\n"));
  const xref = A.join(
    [
      "xref",
      `${objectNumber} 1`,
      `${Str.padStart(10, "0")(String(pdf.length))} 00000 n `,
      "trailer",
      `<< /Size ${size} /Root 1 0 R /Prev ${previous} >>`,
      "startxref",
      `${pdf.length + object.length}`,
      "%%EOF",
      "",
    ],
    "\n"
  );
  return concatBytes(pdf, object, encoder.encode(xref));
};

// A PDF 1.5 file the way cairo writes one: `topLevel` objects 1..n, then an
// object stream numbered n + 1 holding `packed` (numbered from n + 2), then a
// FlateDecode cross-reference stream. `shapeObjStm` and `shapeXref` may cut
// the zlib bytes of either stream; the object stream's /Length is indirect,
// written as the object after it.
const craftXrefStreamPdf = (options: {
  readonly topLevel: ReadonlyArray<Uint8Array | string>;
  readonly packed: ReadonlyArray<string>;
  readonly shapeObjStm?: (zlib: Uint8Array) => Uint8Array;
  readonly shapeXref?: (zlib: Uint8Array) => Uint8Array;
}): Uint8Array => {
  const shapeObjStm = options.shapeObjStm ?? ((zlib: Uint8Array) => zlib);
  const shapeXref = options.shapeXref ?? ((zlib: Uint8Array) => zlib);
  const objStmNumber = options.topLevel.length + 1;
  const lengthNumber = objStmNumber + 1 + options.packed.length;
  const xrefNumber = lengthNumber + 1;
  const firstPacked = objStmNumber + 1;
  const offsets: Array<string> = [];
  let at = 0;
  for (const [index, body] of options.packed.entries()) {
    offsets.push(`${firstPacked + index} ${at}`);
    at += body.length + 1;
  }
  const head = `${A.join(offsets, " ")} `;
  const objStmData = shapeObjStm(NodeZlib.deflateSync(encoder.encode(`${head}${A.join(options.packed, "\n")}\n`)));
  const bodies: ReadonlyArray<readonly [number, Uint8Array | string]> = [
    ...A.map(options.topLevel, (body, index) => [index + 1, body] as const),
    [
      objStmNumber,
      streamBody(
        `<< /Type /ObjStm /N ${options.packed.length} /First ${head.length} /Length ${lengthNumber} 0 R /Filter /FlateDecode >>`,
        objStmData
      ),
    ],
    [lengthNumber, `${objStmData.length}`],
  ];
  const header = encoder.encode("%PDF-1.5\n");
  const written: Array<Uint8Array> = [header];
  const objectOffsets = new Array<number>(xrefNumber + 1).fill(0);
  let offset = header.length;
  for (const [number, body] of bodies) {
    const object = concatBytes(
      encoder.encode(`${number} 0 obj\n`),
      typeof body === "string" ? encoder.encode(body) : body,
      encoder.encode("\nendobj\n")
    );
    objectOffsets[number] = offset;
    written.push(object);
    offset += object.length;
  }
  objectOffsets[xrefNumber] = offset;
  // /W [1 4 2]: type, offset or object-stream number, generation or index.
  const entry = (type: number, field2: number, field3: number) => [
    type,
    (field2 >>> 24) & 0xff,
    (field2 >>> 16) & 0xff,
    (field2 >>> 8) & 0xff,
    field2 & 0xff,
    (field3 >>> 8) & 0xff,
    field3 & 0xff,
  ];
  const entries = A.flatMap(A.range(0, xrefNumber), (number) =>
    number === 0
      ? entry(0, 0, 0xffff)
      : number >= firstPacked && number < lengthNumber
        ? entry(2, objStmNumber, number - firstPacked)
        : entry(1, objectOffsets[number] ?? 0, 0)
  );
  const xrefData = shapeXref(NodeZlib.deflateSync(Uint8Array.from(entries)));
  written.push(
    concatBytes(
      encoder.encode(`${xrefNumber} 0 obj\n`),
      streamBody(
        `<< /Type /XRef /Size ${xrefNumber + 1} /W [1 4 2] /Root 1 0 R /Length ${xrefData.length} /Filter /FlateDecode >>`,
        xrefData
      ),
      encoder.encode(`\nendobj\nstartxref\n${offset}\n%%EOF\n`)
    )
  );
  return concatBytes(...written);
};

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

// Fake rsvg-convert writes a PDF with one page per input SVG at the
// `--output` path; fake pdftoppm (not `-png`) writes the PPM fixture at the
// requested prefix.
const fakeOutputs = (
  fs: FileSystem.FileSystem,
  command: ChildProcess.StandardCommand
): Effect.Effect<void, PlatformError.PlatformError> => {
  if (command.command === "rsvg-convert") {
    const [, format = "", , output = ""] = command.args;
    const inputs = command.args.slice(4);
    return A.some(inputs, Str.endsWith("no-header.svg"))
      ? fs.writeFileString(output, "not a pdf")
      : fakeRsvgPdf(A.length(inputs), format).pipe(Effect.flatMap((bytes) => fs.writeFile(output, bytes)));
  }
  if (command.command === "pdftoppm" && !A.contains(command.args, "-png")) {
    const source = A.get(command.args, A.length(command.args) - 2);
    const fixtureFor = (prefix: string) =>
      Str.endsWith("/base")(prefix)
        ? O.exists(source, Str.endsWith("blank.pdf"))
          ? blankPpm
          : basePpm
        : Str.endsWith("/marked")(prefix)
          ? O.exists(source, (pdf) => Str.endsWith("small.pdf")(pdf))
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

// The fake tools write every file the subject reads, so each block runs on its own in-memory volume.
const PlatformLayer = Layer.mergeAll(MemoryFileSystem.layer, NodePath.layer);

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

const makeLayer = (
  commands: Array<ChildProcess.StandardCommand>,
  exitCode = 0,
  fontconfigs: Array<string> = [],
  config?: PdfToolsConfig
) =>
  PdfTools.makeLayer(config).pipe(
    Layer.provide(makeFakeSpawnerLayer(commands, exitCode, fontconfigs)),
    Layer.provideMerge(PlatformLayer)
  );

describe("@beep/pdf-tools service", () => {
  describe("svgToPdf", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    // Tests run concurrently: each one finds its own runs by its temp directory.
    const runsIn = (dir: string) => A.filter(commands, (command) => A.some(command.args, Str.startsWith(dir)));
    it.layer(makeLayer(commands), { timeout: "30 seconds" })((it) => {
      it.effect(
        "converts every SVG page in one rsvg-convert run, in page order, and stamps the requested version",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const out = path.join(dir, "sheets.pdf");
          const svgPaths = [path.join(dir, "c.svg"), path.join(dir, "a.svg"), path.join(dir, "b.svg")];
          const tools = yield* PdfTools;
          const result = yield* tools.svgToPdf(SvgToPdfRequest.make({ svgPaths, outputPath: out }));
          expect(result.pageCount).toBe(3);
          expect(result.outputPath).toBe(out);
          const written = yield* fs.readFile(out);
          expect(written.byteLength).toBe(result.bytes);
          // rsvg-convert wrote %PDF-1.7 for the unversioned format; the driver relabels it
          expect(new TextDecoder().decode(written.subarray(0, 9))).toBe("%PDF-1.6\n");
          const runs = runsIn(dir);
          expect(A.length(runs)).toBe(1);
          const command = runs[0];
          expect(command?.command).toBe("rsvg-convert");
          expect(command?.args.slice(0, 3)).toEqual(["--format", "pdf", "--output"]);
          expect(command?.args[3]).toMatch(/converted\.pdf$/);
          expect(command?.args.slice(4)).toEqual(svgPaths);
          expect(command?.options.env?.SOURCE_DATE_EPOCH).toBe("0");
          expect(command?.options.extendEnv).toBe(true);
          const structure = yield* tools.inspect(out);
          expect(structure.headerVersion).toBe("1.6");
          expect(A.length(structure.pages)).toBe(3);
          expect(structure.undecodableStreams).toEqual([]);
        })
      );

      it.effect(
        "converts a single SVG at its versioned format",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const out = path.join(dir, "one.pdf");
          const svg = path.join(dir, "a.svg");
          const result = yield* (yield* PdfTools).svgToPdf(
            SvgToPdfRequest.make({ svgPaths: [svg], outputPath: out, pdfVersion: "1.4", sourceDateEpoch: 86_400 })
          );
          expect(result.pageCount).toBe(1);
          expect(new TextDecoder().decode((yield* fs.readFile(out)).subarray(0, 8))).toBe("%PDF-1.4");
          const runs = runsIn(dir);
          expect(A.length(runs)).toBe(1);
          expect(runs[0]?.args.slice(0, 3)).toEqual(["--format", "pdf1.4", "--output"]);
          expect(runs[0]?.args.slice(4)).toEqual([svg]);
          expect(runs[0]?.options.env?.SOURCE_DATE_EPOCH).toBe("86400");
        })
      );

      it.effect(
        "refuses several SVGs at PDF 1.4 before any tool runs",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const svgPaths = [path.join(dir, "a.svg"), path.join(dir, "b.svg")];
          const outputPath = path.join(dir, "out.pdf");
          expect(() => SvgToPdfRequest.make({ svgPaths, outputPath, pdfVersion: "1.4" })).toThrow();
          const error = yield* Effect.flip(
            (yield* PdfTools).svgToPdf({
              ...SvgToPdfRequest.make({ svgPaths: A.take(svgPaths, 1), outputPath, pdfVersion: "1.4" }),
              svgPaths,
            } as SvgToPdfRequest)
          );
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("invalid-request");
          assertSome(error.cause, "Expected exactly one SVG path for PDF 1.4 output");
          expect(runsIn(dir)).toEqual([]);
        })
      );

      it.effect(
        "reports parse and writes nothing when rsvg-convert output has no PDF header",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const out = path.join(dir, "out.pdf");
          const error = yield* Effect.flip(
            (yield* PdfTools).svgToPdf(
              SvgToPdfRequest.make({
                svgPaths: [path.join(dir, "a.svg"), path.join(dir, "no-header.svg")],
                outputPath: out,
              })
            )
          );
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("parse");
          expect(error.message).toBe("rsvg-convert wrote no %PDF-1.x header.");
          expect(yield* fs.exists(out)).toBe(false);
        })
      );
    });
  });

  describe("svgToPdf with pinned fonts", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    const fontconfigs: Array<string> = [];
    // Tests run concurrently: each one finds its own runs by its temp directory, in the arguments or the
    // environment, and its fontconfig file by the pinned directory it names.
    const runsIn = (dir: string) =>
      A.filter(
        commands,
        (command) =>
          A.some(command.args, Str.includes(dir)) ||
          A.some(R.values(command.options.env ?? {}), (value) => value !== undefined && Str.includes(dir)(value))
      );
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
          const runs = runsIn(dir);
          expect(A.length(runs)).toBe(1);
          expect(runs[0]?.options.env?.FONTCONFIG_FILE).toMatch(/fonts\.conf$/);
          expect(runs[0]?.options.env?.SOURCE_DATE_EPOCH).toBe("0");
          const config = O.getOrElse(
            A.findFirst(fontconfigs, Str.includes(`<dir>${Str.replace("&", "&amp;")(fontDir)}</dir>`)),
            () => ""
          );
          // the only <dir> is the pinned one, XML-escaped; no <include> pulls in the system config
          expect(O.getOrUndefined(Str.match(/<dir>/g)(config))?.length).toBe(1);
          expect(config).toContain(`<dir>${Str.replace("&", "&amp;")(fontDir)}</dir>`);
          expect(config).not.toContain("<include");
          expect(config).toContain(
            `<test name="family" qual="any"><string>Arial</string></test><edit name="family" mode="assign" binding="strong"><string>Liberation Sans</string></edit>`
          );
        })
      );

      it.effect(
        "refuses a pinned font directory that does not exist, before any tool runs",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const missing = path.join(dir, "missing-fonts");
          const error = yield* Effect.flip(
            (yield* PdfTools).svgToPdf(
              SvgToPdfRequest.make({
                svgPaths: [path.join(dir, "a.svg")],
                outputPath: path.join(dir, "out.pdf"),
                fonts: O.some(PinnedFonts.make({ directory: missing, families: [] })),
              })
            )
          );
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("invalid-request");
          expect(runsIn(dir)).toEqual([]);
          expect(A.filter(fontconfigs, Str.includes(missing))).toEqual([]);
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
        expect(O.getOrUndefined(Str.match(/<match target="pattern">/g)(config))?.length).toBe(2);
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
          expect(structure.undecodableStreams).toEqual([]);
          expect(structure.streamCheck).toBe("complete");
          expect(commands.length).toBe(0);
        })
      );

      it.effect(
        "reports exactly the FlateDecode stream that a strict inflate rejects",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const file = path.join(dir, "streams.pdf");
          const valid = NodeZlib.deflateSync(encoder.encode("q 0 0 m 100 100 l S Q\n"));
          // every payload byte still inflates; only the checksum's last byte is gone
          const truncated = NodeZlib.deflateSync(
            encoder.encode(Str.repeat(8)("BT /F1 12 Tf (FIG. 1) Tj ET\n"))
          ).subarray(0, -1);
          yield* fs.writeFile(
            file,
            craftPdf([
              ...pageObjects,
              streamBody(`<< /Length ${valid.length} /Filter /FlateDecode >>`, valid),
              streamBody(`<< /Length ${truncated.length} /Filter [/FlateDecode] >>`, truncated),
              // the raw bytes are hex text, not zlib: not checked
              streamBody("<< /Length 5 /Filter [/ASCIIHexDecode /FlateDecode] >>", encoder.encode("4142>")),
            ])
          );
          const structure = yield* (yield* PdfTools).inspect(file);
          expect(structure.undecodableStreams).toEqual([
            UndecodableStream.make({ objectNumber: 5, generation: 0, reason: "unexpected end of file" }),
          ]);
        })
      );

      it.effect(
        "reads a stream with an indirect /Length at that length, keeping a final 0x0D data byte",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const file = path.join(dir, "indirect-length.pdf");
          // Adler-32 of "q  Q\n" ends in 0x0D, so the zlib stream does too
          const data = NodeZlib.deflateSync(encoder.encode("q  Q\n"));
          expect(data.at(-1)).toBe(0x0d);
          const bytes = craftPdf([
            ...pageObjects,
            streamBody("<< /Length 5 0 R /Filter /FlateDecode >>", data),
            `${data.length}`,
          ]);
          yield* fs.writeFile(file, bytes);
          // pdf-lib alone cuts the 0x0D as if it were the EOL before `endstream`
          const parsed = (yield* Effect.promise(() => PDFDocument.load(bytes))).context.lookup(PDFRef.of(4));
          expect(parsed instanceof PDFRawStream ? parsed.contents.length : -1).toBe(data.length - 1);
          const structure = yield* (yield* PdfTools).inspect(file);
          expect(structure.undecodableStreams).toEqual([]);
        })
      );

      it.effect(
        "judges a stream on pdf-lib's own bytes when no definition in the file fits its indirect /Length",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const file = path.join(dir, "wrong-length.pdf");
          const truncated = NodeZlib.deflateSync(
            encoder.encode(Str.repeat(8)("BT /F1 12 Tf (FIG. 1) Tj ET\n"))
          ).subarray(0, -1);
          const valid = NodeZlib.deflateSync(encoder.encode("q 0 0 m 100 100 l S Q\n"));
          yield* fs.writeFile(
            file,
            craftPdf([
              ...pageObjects,
              // 5 bytes too long: the bytes at that length run into `endstream`
              streamBody("<< /Length 5 0 R /Filter /FlateDecode >>", truncated),
              `${truncated.length + 5}`,
              // 3 bytes too short: `endstream` does not follow the bytes at that length
              streamBody("<< /Length 7 0 R /Filter /FlateDecode >>", valid),
              `${valid.length - 3}`,
            ])
          );
          const structure = yield* (yield* PdfTools).inspect(file);
          // Read at its declared length, object 4 would fail "incorrect data check" and object 6 would fail too.
          expect(structure.undecodableStreams).toEqual([
            UndecodableStream.make({ objectNumber: 4, generation: 0, reason: "unexpected end of file" }),
          ]);
          expect(structure.streamCheck).toBe("complete");
        })
      );

      it.effect(
        "re-reads an indirect-/Length stream only from the definition pdf-lib kept",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const tools = yield* PdfTools;
          // Adler-32 of "q  Q\n" ends in 0x0D, which pdf-lib drops, so the stream is re-read from the file
          const data = NodeZlib.deflateSync(encoder.encode("q  Q\n"));
          expect(data.at(-1)).toBe(0x0d);
          // the same bytes but the checksum's last: pdf-lib's prefix matches both definitions
          const stale = Uint8Array.from(data);
          stale[stale.length - 1] = 0x0e;
          const updated = path.join(dir, "updated.pdf");
          yield* fs.writeFile(
            updated,
            appendRevision(
              craftPdf([
                ...pageObjects,
                streamBody("<< /Length 5 0 R /Filter /FlateDecode >>", stale),
                `${data.length}`,
              ]),
              4,
              streamBody("<< /Length 5 0 R /Filter /FlateDecode >>", data)
            )
          );
          // the newest definition is the one read, not the stale one before it
          expect((yield* tools.inspect(updated)).undecodableStreams).toEqual([]);

          // an unfiltered stream that quotes another `4 0 obj` after the real one
          const quoted = concatBytes(
            encoder.encode("4 0 obj\n<< /Length 5 0 R /Filter /FlateDecode >>\nstream\n"),
            new Uint8Array(data.length).fill(0x41),
            encoder.encode("\nendstream\nendobj")
          );
          const quoting = path.join(dir, "quoting.pdf");
          yield* fs.writeFile(
            quoting,
            craftPdf([
              ...pageObjects,
              streamBody("<< /Length 5 0 R /Filter /FlateDecode >>", data),
              `${data.length}`,
              streamBody(`<< /Length ${quoted.length} >>`, quoted),
            ])
          );
          // the quoted bytes fit the length and end at `endstream`, but are not the bytes pdf-lib parsed
          expect((yield* tools.inspect(quoting)).undecodableStreams).toEqual([]);
        })
      );

      it.effect(
        "returns partial discovery for dense hostile container-marker text within its work budget",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const tools = yield* PdfTools;
          for (const marker of ["/ObjStm", "/XRef"]) {
            const file = path.join(dir, marker === "/XRef" ? "xref-markers.pdf" : "object-markers.pdf");
            const data = encoder.encode(A.join(A.replicate(`% 1 0 obj ${marker}`, 16_000), "\n"));
            yield* fs.writeFile(file, craftPdf([...pageObjects, streamBody(`<< /Length ${data.length} >>`, data)]));
            const structure = yield* tools.inspect(file);
            expect(structure.streamCheck).toBe("complete");
            expect(structure.containerDiscovery).toBe("limit-reached");
            expect(structure.undecodableStreams).toEqual([]);
            expect(A.length(structure.pages)).toBe(1);
          }
        })
      );

      it.effect(
        "accepts valid loaded PDFs containing more than 128 irrelevant mixed markers",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const tools = yield* PdfTools;
          const data = encoder.encode(A.join(A.replicate("/ObjStm /XRef /XRefStm", 129), "\n"));
          const bytes = craftPdf([...pageObjects, streamBody(`<< /Length ${data.length} >>`, data)]);
          expect((yield* Effect.promise(() => PDFDocument.load(bytes))).getPageCount()).toBe(1);
          const file = path.join(dir, "mixed-markers.pdf");
          yield* fs.writeFile(file, bytes);
          const structure = yield* tools.inspect(file);
          expect(structure.streamCheck).toBe("complete");
          expect(structure.containerDiscovery).toBe("limit-reached");
          expect(structure.undecodableStreams).toEqual([]);
          expect(A.length(structure.pages)).toBe(1);
        })
      );

      it.effect(
        "bounds failed header discovery across long digit and whitespace runs",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const tools = yield* PdfTools;
          const data = encoder.encode(
            A.join([Str.repeat("9", 200_000), Str.repeat(" ", 200_000), "0 nope /ObjStm /XRef"], "")
          );
          const file = path.join(dir, "failed-long-header.pdf");
          yield* fs.writeFile(file, craftPdf([...pageObjects, streamBody(`<< /Length ${data.length} >>`, data)]));
          const structure = yield* tools.inspect(file);
          expect(structure.streamCheck).toBe("complete");
          expect(structure.undecodableStreams).toEqual([]);
        })
      );

      it.effect(
        "defaults the additive discovery status for existing structure payloads",
        Effect.fnUntraced(function* () {
          const input = {
            headerVersion: "1.7",
            pages: [],
            fonts: [],
            annotationCount: 0,
            hasOptionalContent: false,
            encrypted: false,
            undecodableStreams: [],
            streamCheck: "complete",
          };
          const structure = yield* S.decodeUnknownEffect(PdfStructure)(input);
          expect(structure.containerDiscovery).toBe("complete");
          expect(PdfStructure.make({ ...input, streamCheck: "complete" }).containerDiscovery).toBe("complete");
        })
      );

      it.effect(
        "shares the raw discovery budget across families and reports the exact boundary",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const tools = yield* PdfTools;
          for (const count of [64, 65]) {
            const data = encoder.encode(
              A.join(A.appendAll(A.replicate("/ObjStm", count), A.replicate("/XRef", 64)), "\n")
            );
            const file = path.join(dir, `boundary-${count}.pdf`);
            yield* fs.writeFile(file, craftPdf([...pageObjects, streamBody(`<< /Length ${data.length} >>`, data)]));
            const structure = yield* tools.inspect(file);
            expect(structure.containerDiscovery).toBe(count === 64 ? "complete" : "limit-reached");
            expect(structure.streamCheck).toBe("complete");
            expect(A.length(structure.pages)).toBe(1);
          }
        })
      );

      it.effect(
        "checks object and cross-reference streams, which pdf-lib decodes without adding them to the document",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const tools = yield* PdfTools;
          const content = NodeZlib.deflateSync(encoder.encode("q 0 0 m 100 100 l S Q\n"));
          const topLevel = [
            ...pageObjects,
            streamBody(`<< /Length ${content.length} /Filter /FlateDecode >>`, content),
          ];
          const packed = ["<< /Producer (beep) >>"];
          const whole = path.join(dir, "whole.pdf");
          yield* fs.writeFile(whole, craftXrefStreamPdf({ topLevel, packed }));
          const intact = yield* tools.inspect(whole);
          expect(intact.undecodableStreams).toEqual([]);
          expect(intact.streamCheck).toBe("complete");
          expect(intact.containerDiscovery).toBe("complete");

          // object stream 5 (indirect /Length 7 0 R) and cross-reference stream 8 each lose their last checksum byte
          const cutBytes = craftXrefStreamPdf({
            topLevel,
            packed,
            shapeObjStm: (zlib) => zlib.subarray(0, -1),
            shapeXref: (zlib) => zlib.subarray(0, -1),
          });
          const cut = path.join(dir, "cut.pdf");
          yield* fs.writeFile(cut, cutBytes);
          // pdf-lib ignores the checksum: it reads the packed object and keeps neither stream as an object
          const loaded = yield* Effect.promise(() => PDFDocument.load(cutBytes, { updateMetadata: false }));
          assertTrue(loaded.context.lookup(PDFRef.of(6)) instanceof PDFDict);
          expect(loaded.context.lookup(PDFRef.of(5))).toBeUndefined();
          expect(loaded.context.lookup(PDFRef.of(8))).toBeUndefined();
          const structure = yield* tools.inspect(cut);
          expect(A.length(structure.pages)).toBe(1);
          expect(structure.undecodableStreams).toEqual([
            UndecodableStream.make({ objectNumber: 5, generation: 0, reason: "unexpected end of file" }),
            UndecodableStream.make({ objectNumber: 8, generation: 0, reason: "unexpected end of file" }),
          ]);
          expect(structure.streamCheck).toBe("complete");
        })
      );

      it.effect(
        "inspects shared descendant-font graphs without exponential revisits",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const file = path.join(dir, "shared-font.pdf");
          const doc = yield* Effect.promise(() => PDFDocument.create());
          const font = yield* Effect.promise(() => doc.embedFont(StandardFonts.Helvetica));
          doc.addPage([612, 792]).drawText("A", { font });
          yield* Effect.promise(() => doc.save({ useObjectStreams: false }));
          let child = doc.context.register(doc.context.obj({}));
          for (let depth = 0; depth < 22; depth += 1) {
            child = doc.context.register(doc.context.obj({ DescendantFonts: [child, child] }));
          }
          const root = doc.context.lookup(font.ref, PDFDict);
          root.set(PDFName.of("DescendantFonts"), doc.context.obj([child, child]));
          yield* fs.writeFile(file, yield* Effect.promise(() => doc.save({ useObjectStreams: false })));

          const started = performance.now();
          const structure = yield* (yield* PdfTools).inspect(file);
          expect(A.map(structure.fonts, (entry) => entry.embedded)).toEqual([false]);
          expect(performance.now() - started).toBeLessThan(2_000);
        })
      );

      it.effect(
        "rejects cyclic descendant-font graphs",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const file = path.join(dir, "cyclic-font.pdf");
          const doc = yield* Effect.promise(() => PDFDocument.create());
          const font = yield* Effect.promise(() => doc.embedFont(StandardFonts.Helvetica));
          doc.addPage([612, 792]).drawText("A", { font });
          yield* Effect.promise(() => doc.save({ useObjectStreams: false }));
          doc.context.lookup(font.ref, PDFDict).set(PDFName.of("DescendantFonts"), doc.context.obj([font.ref]));
          yield* fs.writeFile(file, yield* Effect.promise(() => doc.save({ useObjectStreams: false })));

          const exit = yield* Effect.exit((yield* PdfTools).inspect(file));
          const isFailure = exit.pipe(Exit.isFailure);
          assertTrue(isFailure);
          expect(String(exit)).toContain("Cyclic PDF descendant-font graph");
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

  describe("inspect under a small inflate limit", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    const limit = 1536 * 1024;
    const content = NodeZlib.deflateSync(encoder.encode("q 0 0 m 100 100 l S Q\n"));
    // 1 MiB of zeros deflates about 1009:1; cut by its last checksum byte
    const truncatedMiB = NodeZlib.deflateSync(new Uint8Array(1024 * 1024)).subarray(0, -1);
    it.layer(makeLayer(commands, 0, [], PdfToolsConfig.make({ maxInflatedBytes: limit })), { timeout: "30 seconds" })(
      (it) => {
        it.effect(
          "stops the stream check at the limit and still reports every other fact",
          Effect.fnUntraced(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const dir = yield* fs.makeTempDirectoryScoped();
            const file = path.join(dir, "large.pdf");
            const large = NodeZlib.deflateSync(new Uint8Array(2 * 1024 * 1024));
            yield* fs.writeFile(
              file,
              craftPdf([
                ...pageObjects,
                streamBody(`<< /Length ${content.length} /Filter /FlateDecode >>`, content),
                // a valid stream that alone inflates past the limit
                streamBody(`<< /Length ${large.length} /Filter /FlateDecode >>`, large),
                // never reached
                streamBody(`<< /Length ${truncatedMiB.length} /Filter /FlateDecode >>`, truncatedMiB),
              ])
            );
            const structure = yield* (yield* PdfTools).inspect(file);
            expect(structure.headerVersion).toBe("1.6");
            expect(A.map(structure.pages, (page) => [page.widthPt, page.heightPt])).toEqual([[612, 792]]);
            expect(structure.encrypted).toBe(false);
            expect(structure.undecodableStreams).toEqual([]);
            expect(structure.streamCheck).toBe("limit-reached");
          })
        );

        it.effect(
          "charges a failed inflate the most its input could have produced",
          Effect.fnUntraced(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const dir = yield* fs.makeTempDirectoryScoped();
            const file = path.join(dir, "bombs.pdf");
            // charged 1032 bytes per input byte, the first cut stream leaves less than the 1 MiB the second inflates to
            expect(truncatedMiB.length * 1032).toBeLessThan(limit);
            expect(limit - truncatedMiB.length * 1032).toBeLessThan(1024 * 1024);
            yield* fs.writeFile(
              file,
              craftPdf([
                ...pageObjects,
                streamBody(`<< /Length ${content.length} /Filter /FlateDecode >>`, content),
                streamBody(`<< /Length ${truncatedMiB.length} /Filter /FlateDecode >>`, truncatedMiB),
                streamBody(`<< /Length ${truncatedMiB.length} /Filter /FlateDecode >>`, truncatedMiB),
                streamBody(`<< /Length ${content.length} /Filter /FlateDecode >>`, content),
              ])
            );
            const structure = yield* (yield* PdfTools).inspect(file);
            expect(structure.undecodableStreams).toEqual([
              UndecodableStream.make({ objectNumber: 5, generation: 0, reason: "unexpected end of file" }),
            ]);
            expect(structure.streamCheck).toBe("limit-reached");
          })
        );
      }
    );
  });

  describe("inspect under an inflate limit above the runtime's buffer limit", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    // Bun refuses an inflate asked for more than 4 GiB of output; the limit is set past that.
    const limit = 2 ** 33;
    it.layer(makeLayer(commands, 0, [], PdfToolsConfig.make({ maxInflatedBytes: limit })), { timeout: "30 seconds" })(
      (it) => {
        it.effect(
          "checks every stream, flagging only the truncated one",
          Effect.fnUntraced(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const dir = yield* fs.makeTempDirectoryScoped();
            const file = path.join(dir, "large-limit.pdf");
            const valid = NodeZlib.deflateSync(encoder.encode("q 0 0 m 100 100 l S Q\n"));
            const truncated = NodeZlib.deflateSync(
              encoder.encode(Str.repeat(8)("BT /F1 12 Tf (FIG. 1) Tj ET\n"))
            ).subarray(0, -1);
            yield* fs.writeFile(
              file,
              craftPdf([
                ...pageObjects,
                streamBody(`<< /Length ${valid.length} /Filter /FlateDecode >>`, valid),
                streamBody(`<< /Length ${truncated.length} /Filter /FlateDecode >>`, truncated),
              ])
            );
            const structure = yield* (yield* PdfTools).inspect(file);
            expect(structure.undecodableStreams).toEqual([
              UndecodableStream.make({ objectNumber: 5, generation: 0, reason: "unexpected end of file" }),
            ]);
            expect(structure.streamCheck).toBe("complete");
          })
        );
      }
    );
  });

  describe("pageWords", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];
    it.layer(makeLayer(commands), { timeout: "30 seconds" })((it) => {
      it.effect(
        "parses -bbox-layout blocks: words by space, lines by newline, entities decoded, empty blocks dropped",
        Effect.fnUntraced(function* () {
          const tools = yield* PdfTools;
          const blocks = yield* tools.pageWords(PageTextRequest.make({ pdfPath: "reviewed.pdf", page: 2 }));
          expect(A.map(blocks, (b) => b.text)).toEqual(["Rotate A&B\n<left> é—\"'", "(all sheets)"]);
          expect(A.map(blocks, (b) => [b.rect.xMin, b.rect.yMin, b.rect.xMax, b.rect.yMax])).toEqual([
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
            A.findFirst(commands, (command) => O.exists(A.last(command.args), (last) => Str.endsWith(prefix)(last)));
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
          expect(A.map(annotations, (a) => [a.page, a.subtype])).toEqual([
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
      Layer.provideMerge(PlatformLayer)
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
