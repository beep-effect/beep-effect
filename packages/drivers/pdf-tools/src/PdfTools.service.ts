/**
 * PDF tools service: `rsvg-convert` SVG → PDF, pdf-lib structure inspection,
 * poppler `pdftoppm` page rasters measured without leaving the driver, and
 * the markup-reading verbs a review round needs (text blocks with their
 * rectangles, raster ink coverage between two pages, annotation objects).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Run } from "@beep/commands/Run";
import { $PdfToolsId } from "@beep/identity/packages";
import { A, Html, O, Str } from "@beep/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import { PDFDocument } from "pdf-lib";
import { inkCoverageOf } from "./internal/coverage.ts";
import { measureP6 } from "./internal/ppm.ts";
import { annotationsOf, structureOf } from "./internal/structure.ts";
import { parseBboxLayout } from "./internal/words.ts";
import { PdfToolsError } from "./PdfTools.errors.ts";
import {
  InkCoverageRequest,
  PageTextRequest,
  PinnedFontconfigRequest,
  PngRequest,
  RasterRequest,
  SvgToPdfRequest,
  SvgToPdfResult,
} from "./PdfTools.models.ts";
import type { CommandFailedError, CommandOutputError } from "@beep/commands/Run";
import type {
  InkCoverage,
  PdfAnnotation,
  PdfStructure,
  PdfVersion,
  RasterMetrics,
  TextBlock,
} from "./PdfTools.models.ts";

const $I = $PdfToolsId.create("PdfTools.service");
const validateSvgToPdfRequest = S.decodeUnknownEffect(S.toType(SvgToPdfRequest));
const validateRasterRequest = S.decodeUnknownEffect(S.toType(RasterRequest));
const validatePngRequest = S.decodeUnknownEffect(S.toType(PngRequest));
const validatePageTextRequest = S.decodeUnknownEffect(S.toType(PageTextRequest));
const validateInkCoverageRequest = S.decodeUnknownEffect(S.toType(InkCoverageRequest));
// Luminance at or below which a pixel counts as ink in a coverage comparison.
const COVERAGE_BLACK_THRESHOLD = 128;
const encoder = new TextEncoder();

// rsvg-convert writes one page per input, in order, but takes several inputs
// only with the unversioned `pdf` format, which cairo writes as PDF 1.7.
// cairo's 1.5, 1.6 and 1.7 output differ only in the header line (checked on
// rsvg-convert 2.63.2 with cairo 1.18.6), so a multi-page conversion runs at
// `pdf` and the requested version is written over the header, same length so
// every offset stays valid. A single SVG converts at its own `pdf1.x`; 1.4,
// whose output differs in structure, is single-SVG only (SvgToPdfRequest).
// Converting page by page and re-serialising with pdf-lib is not an option:
// pdf-lib cuts a stream whose /Length is indirect at the EOL before
// `endstream`, which drops a final 0x0D data byte and truncates the stream.
const pdfHeader = /^%PDF-1\.\d/;

const rsvgFormatOf = (request: SvgToPdfRequest): string =>
  A.length(request.svgPaths) === 1 ? `pdf${request.pdfVersion}` : "pdf";

const stampHeader = (bytes: Uint8Array, version: PdfVersion): O.Option<Uint8Array> => {
  if (!pdfHeader.test(new TextDecoder("latin1").decode(bytes.subarray(0, 8)))) {
    return O.none();
  }
  const stamped = bytes.slice();
  stamped.set(encoder.encode(`%PDF-${version}`), 0);
  return O.some(stamped);
};

/**
 * The fontconfig file a pinned conversion runs under.
 *
 * **Details**
 *
 * The file names `fonts.directory` as the only font directory (fontconfig
 * reads it recursively) and includes no system configuration, so no host font
 * is visible. Each alias rebinds its requested family to the resolved family
 * with a strong binding. `cacheDirectory` holds fontconfig's scan cache.
 *
 * **Example** (Pin one family)
 *
 * ```ts
 * import { FontFamilyAlias, PinnedFontconfigRequest, PinnedFonts, pinnedFontconfig } from "@beep/pdf-tools"
 *
 * const fonts = PinnedFonts.make({
 *   directory: "/fonts",
 *   families: [FontFamilyAlias.make({ requested: "Arial", family: "Arial" })]
 * })
 * console.log(pinnedFontconfig(PinnedFontconfigRequest.make({ fonts, cacheDirectory: "/tmp/fc-cache" })))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const pinnedFontconfig = ({ fonts, cacheDirectory }: PinnedFontconfigRequest): string =>
  A.join(
    [
      `<?xml version="1.0"?>`,
      `<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">`,
      `<fontconfig>`,
      `  <dir>${Html.escapeHtml(fonts.directory)}</dir>`,
      `  <cachedir>${Html.escapeHtml(cacheDirectory)}</cachedir>`,
      ...A.map(
        fonts.families,
        (alias) =>
          `  <match target="pattern"><test name="family" qual="any"><string>${Html.escapeHtml(alias.requested)}</string></test><edit name="family" mode="assign" binding="strong"><string>${Html.escapeHtml(alias.family)}</string></edit></match>`
      ),
      `</fontconfig>`,
      ``,
    ],
    "\n"
  );

/**
 * Technical knobs: executable names, the process kill grace period, and how
 * much `inspect` may inflate while checking a file's streams.
 *
 * **Example** (Defaults)
 *
 * ```ts
 * import { PdfToolsConfig } from "@beep/pdf-tools"
 *
 * console.log(PdfToolsConfig.make({}).rsvgConvertPath)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PdfToolsConfig extends S.Opaque<PdfToolsConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    rsvgConvertPath: S.NonEmptyString.pipe(
      S.withConstructorDefault(Effect.succeed("rsvg-convert")),
      S.annotateKey({ description: "rsvg-convert executable. Defaults to the PATH name." })
    ),
    pdftoppmPath: S.NonEmptyString.pipe(
      S.withConstructorDefault(Effect.succeed("pdftoppm")),
      S.annotateKey({ description: "pdftoppm executable. Defaults to the PATH name." })
    ),
    pdftotextPath: S.NonEmptyString.pipe(
      S.withConstructorDefault(Effect.succeed("pdftotext")),
      S.annotateKey({ description: "pdftotext executable. Defaults to the PATH name." })
    ),
    forceKillAfterMillis: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(120_000)),
      S.annotateKey({
        description:
          "Grace between SIGTERM and SIGKILL when a run is interrupted, including by the timeout. Defaults to two minutes.",
      })
    ),
    timeoutMillis: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(120_000)),
      S.annotateKey({
        description: "Longest a single tool run may take before it is stopped. Defaults to two minutes.",
      })
    ),
    maxInflatedBytes: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(512 * 1024 * 1024)),
      S.annotateKey({
        description:
          "Bytes `inspect` may inflate while checking one file's FlateDecode streams; past it the check stops and reports `limit-reached`. Defaults to 512 MiB.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PdfToolsConfig", {
      description:
        "Executable paths, per-run timeout, kill grace period, and stream-check inflate limit for the PDF tools driver.",
    })
  )
) {}

/**
 * Runtime shape exposed by the {@link PdfTools} service.
 *
 * **Example** (Stub PdfToolsShape service)
 *
 * ```ts
 * import type { PdfToolsShape } from "@beep/pdf-tools"
 * import * as Effect from "effect/Effect";
 * const service: PdfToolsShape = {
 *   svgToPdf: () => Effect.die("not implemented"),
 *   inspect: () => Effect.die("not implemented"),
 *   measurePage: () => Effect.die("not implemented"),
 *   renderPng: () => Effect.die("not implemented"),
 *   pageText: () => Effect.die("not implemented"),
 *   pageWords: () => Effect.die("not implemented"),
 *   inkCoverage: () => Effect.die("not implemented"),
 *   annotations: () => Effect.die("not implemented")
 * }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface PdfToolsShape {
  readonly annotations: (pdfPath: string) => Effect.Effect<ReadonlyArray<PdfAnnotation>, PdfToolsError>;
  readonly inkCoverage: (request: InkCoverageRequest) => Effect.Effect<InkCoverage, PdfToolsError>;
  readonly inspect: (pdfPath: string) => Effect.Effect<PdfStructure, PdfToolsError>;
  readonly measurePage: (request: RasterRequest) => Effect.Effect<RasterMetrics, PdfToolsError>;
  readonly pageText: (request: PageTextRequest) => Effect.Effect<string, PdfToolsError>;
  readonly pageWords: (request: PageTextRequest) => Effect.Effect<ReadonlyArray<TextBlock>, PdfToolsError>;
  readonly renderPng: (request: PngRequest) => Effect.Effect<string, PdfToolsError>;
  readonly svgToPdf: (request: SvgToPdfRequest) => Effect.Effect<SvgToPdfResult, PdfToolsError>;
}

// Maps the kit's run failures onto this driver's reasons. A spawn or stream
// failure keeps its platform failure as the cause, exactly as the hand-rolled
// fold reported it; a timeout keeps the `tool-failed` reason and message; an
// over-budget stream (the kit's capture bound) is a failing tool run.
const toolFailure = (
  error: CommandFailedError | CommandOutputError,
  executable: string,
  what: string,
  timeoutMillis: number
): PdfToolsError =>
  Match.value(error).pipe(
    Match.tag("CommandOutputError", (tooLarge) =>
      PdfToolsError.fromUnknown(
        "tool-failed",
        `${executable} produced more output than the capture limit while ${what}.`,
        tooLarge
      )
    ),
    Match.when({ kind: "timeout" }, () =>
      PdfToolsError.make({
        reason: "tool-failed",
        message: `${executable} timed out after ${timeoutMillis} ms while ${what}.`,
      })
    ),
    Match.orElse((failed) =>
      PdfToolsError.fromUnknown("tool-unavailable", `Failed to run ${executable}; is it installed?`, failed.cause)
    )
  );

const makeService = Effect.fn("PdfTools.makeService")(function* (config: PdfToolsConfig) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const run = (
    executable: string,
    args: ReadonlyArray<string>,
    env: Readonly<Record<string, string>>,
    what: string
  ): Effect.Effect<string, PdfToolsError> => {
    const command = Run.extendEnv(
      ChildProcess.make(executable, args, {
        forceKillAfter: `${config.forceKillAfterMillis} millis`,
        stdin: "ignore",
        stderr: "pipe",
        stdout: "pipe",
      }),
      { ...env }
    );
    // Leaving the run's scope on timeout interrupts the handle, which stops the tool.
    return Run.collect(command, { timeout: `${config.timeoutMillis} millis` }).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      Effect.mapError((error) => toolFailure(error, executable, what, config.timeoutMillis)),
      Effect.flatMap((output) =>
        output.exitCode === 0
          ? Effect.succeed(output.stdout)
          : Effect.fail(
              PdfToolsError.make({
                reason: "tool-failed",
                message: `${executable} exited ${output.exitCode} while ${what}.`,
                cause: O.some(Str.trim(output.stderr)),
              })
            )
      )
    );
  };

  const svgToPdf = Effect.fn("PdfTools.svgToPdf")(function* (rawRequest: SvgToPdfRequest) {
    const request = yield* validateSvgToPdfRequest(rawRequest).pipe(
      Effect.mapError((cause) => PdfToolsError.fromUnknown("invalid-request", "Invalid SVG to PDF request.", cause))
    );
    const outputPath = path.resolve(request.outputPath);
    const io = (what: string) => (cause: unknown) => PdfToolsError.fromUnknown("io", what, cause);
    const dir = yield* fs
      .makeTempDirectoryScoped({ prefix: "beep-pdf-tools-" })
      .pipe(Effect.mapError(io("Could not create a temp directory.")));
    // Pinned fonts: rsvg-convert sees only the given directory, through a
    // fontconfig file of its own.
    const fontconfig = yield* O.match(request.fonts, {
      onNone: () => Effect.succeed({}),
      onSome: Effect.fnUntraced(function* (fonts) {
        if (!(yield* fs.exists(fonts.directory).pipe(Effect.orElseSucceed(() => false)))) {
          return yield* PdfToolsError.make({
            reason: "invalid-request",
            message: `The pinned font directory "${fonts.directory}" does not exist.`,
          });
        }
        const file = path.join(dir, "fonts.conf");
        yield* fs
          .writeFileString(
            file,
            pinnedFontconfig(
              PinnedFontconfigRequest.make({ fonts, cacheDirectory: path.join(dir, "fontconfig-cache") })
            )
          )
          .pipe(Effect.mapError(io(`Could not write "${file}".`)));
        return { FONTCONFIG_FILE: file };
      }),
    });
    const env = { SOURCE_DATE_EPOCH: `${request.sourceDateEpoch}`, ...fontconfig };
    const pageCount = A.length(request.svgPaths);
    const converted = path.join(dir, "converted.pdf");
    yield* run(
      config.rsvgConvertPath,
      [
        "--format",
        rsvgFormatOf(request),
        "--output",
        converted,
        ...A.map(request.svgPaths, (svgPath) => path.resolve(svgPath)),
      ],
      env,
      `converting ${pageCount} SVG ${pageCount === 1 ? "page" : "pages"} to PDF`
    );
    const written = yield* fs.readFile(converted).pipe(Effect.mapError(io(`Could not read "${converted}".`)));
    const pdf = yield* stampHeader(written, request.pdfVersion).pipe(
      Effect.fromOption(() =>
        PdfToolsError.make({ reason: "parse", message: `${config.rsvgConvertPath} wrote no %PDF-1.x header.` })
      )
    );
    yield* fs.writeFile(outputPath, pdf).pipe(Effect.mapError(io(`Could not write "${outputPath}".`)));
    return SvgToPdfResult.make({ outputPath, pageCount, bytes: pdf.byteLength });
  }, Effect.scoped);

  const loadDocument = Effect.fn("PdfTools.loadDocument")(function* (pdfPath: string) {
    const bytes = yield* fs
      .readFile(pdfPath)
      .pipe(Effect.mapError((cause) => PdfToolsError.fromUnknown("io", `Could not read "${pdfPath}".`, cause)));
    const doc = yield* Effect.tryPromise({
      try: () => PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false }),
      catch: (cause) => PdfToolsError.fromUnknown("parse", `pdf-lib could not parse "${pdfPath}".`, cause),
    });
    return { bytes, doc };
  });

  const inspect = Effect.fn("PdfTools.inspect")(function* (pdfPath: string) {
    const loaded = yield* loadDocument(pdfPath);
    return yield* Effect.try({
      try: () => structureOf({ ...loaded, maxInflatedBytes: config.maxInflatedBytes }),
      catch: (cause) => PdfToolsError.fromUnknown("parse", `Could not walk the structure of "${pdfPath}".`, cause),
    });
  });

  const annotations = Effect.fn("PdfTools.annotations")(function* (pdfPath: string) {
    const { doc } = yield* loadDocument(pdfPath);
    return yield* Effect.try({
      try: () => annotationsOf(doc),
      catch: (cause) => PdfToolsError.fromUnknown("parse", `Could not read the annotations of "${pdfPath}".`, cause),
    });
  });

  const tempDir = fs
    .makeTempDirectoryScoped({ prefix: "beep-pdf-tools-" })
    .pipe(Effect.mapError((cause) => PdfToolsError.fromUnknown("io", "Could not create a temp directory.", cause)));

  // Rasterise one page to `<prefix>.ppm` and read it back.
  const rasterise = Effect.fn("PdfTools.rasterise")(function* (options: {
    readonly pdfPath: string;
    readonly page: number;
    readonly dpi: number;
    readonly antiAlias: boolean;
    readonly prefix: string;
  }) {
    const page = `${options.page}`;
    yield* run(
      config.pdftoppmPath,
      [
        "-r",
        `${options.dpi}`,
        "-f",
        page,
        "-l",
        page,
        "-singlefile",
        ...(options.antiAlias ? [] : ["-aa", "no", "-aaVector", "no"]),
        path.resolve(options.pdfPath),
        options.prefix,
      ],
      {},
      `rasterising page ${page} at ${options.dpi} dpi`
    );
    return yield* fs
      .readFile(`${options.prefix}.ppm`)
      .pipe(Effect.mapError((cause) => PdfToolsError.fromUnknown("io", "Could not read the rendered PPM.", cause)));
  });

  const measurePage = Effect.fn("PdfTools.measurePage")(function* (rawRequest: RasterRequest) {
    const request = yield* validateRasterRequest(rawRequest).pipe(
      Effect.mapError((cause) => PdfToolsError.fromUnknown("invalid-request", "Invalid raster request.", cause))
    );
    const dir = yield* tempDir;
    const ppm = yield* rasterise({
      pdfPath: request.pdfPath,
      page: request.page,
      dpi: request.dpi,
      antiAlias: request.antiAlias,
      prefix: path.join(dir, "page"),
    });
    return yield* Effect.try({
      try: () => measureP6({ bytes: ppm, dpi: request.dpi, blackThreshold: request.blackThreshold }),
      catch: (cause) => PdfToolsError.fromUnknown("parse", "Could not decode the rendered PPM.", cause),
    });
  }, Effect.scoped);

  // Both pages render without anti-aliasing so an edge is ink or paper, never
  // a gray that one export draws darker than the other.
  const inkCoverage = Effect.fn("PdfTools.inkCoverage")(function* (rawRequest: InkCoverageRequest) {
    const request = yield* validateInkCoverageRequest(rawRequest).pipe(
      Effect.mapError((cause) => PdfToolsError.fromUnknown("invalid-request", "Invalid ink-coverage request.", cause))
    );
    const dir = yield* tempDir;
    const base = yield* rasterise({
      pdfPath: request.base.pdfPath,
      page: request.base.page,
      dpi: request.dpi,
      antiAlias: false,
      prefix: path.join(dir, "base"),
    });
    const marked = yield* rasterise({
      pdfPath: request.marked.pdfPath,
      page: request.marked.page,
      dpi: request.dpi,
      antiAlias: false,
      prefix: path.join(dir, "marked"),
    });
    return yield* Effect.try({
      try: () => inkCoverageOf({ base, marked, dilatePx: request.dilatePx, blackThreshold: COVERAGE_BLACK_THRESHOLD }),
      catch: (cause) => PdfToolsError.fromUnknown("parse", "Could not decode the rendered PPMs.", cause),
    });
  }, Effect.scoped);

  const renderPng = Effect.fn("PdfTools.renderPng")(function* (rawRequest: PngRequest) {
    const request = yield* validatePngRequest(rawRequest).pipe(
      Effect.mapError((cause) => PdfToolsError.fromUnknown("invalid-request", "Invalid PNG request.", cause))
    );
    const outputPath = path.resolve(request.outputPath);
    const prefix = Str.endsWith(".png")(outputPath) ? Str.slice(0, -".png".length)(outputPath) : outputPath;
    const page = `${request.page}`;
    yield* run(
      config.pdftoppmPath,
      ["-png", "-r", `${request.dpi}`, "-f", page, "-l", page, "-singlefile", path.resolve(request.pdfPath), prefix],
      {},
      `rendering page ${page} to PNG`
    );
    return `${prefix}.png`;
  });

  // Raw (non-layout) text of exactly one page; layout mode pads lines with
  // leading spaces, which would defeat a whole-line match.
  const pageText = Effect.fn("PdfTools.pageText")(function* (rawRequest: PageTextRequest) {
    const request = yield* validatePageTextRequest(rawRequest).pipe(
      Effect.mapError((cause) => PdfToolsError.fromUnknown("invalid-request", "Invalid page-text request.", cause))
    );
    const page = `${request.page}`;
    return yield* run(
      config.pdftotextPath,
      ["-f", page, "-l", page, "-enc", "UTF-8", path.resolve(request.pdfPath), "-"],
      {},
      `extracting the text of page ${page}`
    );
  });

  // Text blocks of exactly one page with their rectangles; `-bbox-layout`
  // keeps side-by-side callouts apart, where `-layout` merges them into one line.
  const pageWords = Effect.fn("PdfTools.pageWords")(function* (rawRequest: PageTextRequest) {
    const request = yield* validatePageTextRequest(rawRequest).pipe(
      Effect.mapError((cause) => PdfToolsError.fromUnknown("invalid-request", "Invalid page-words request.", cause))
    );
    const page = `${request.page}`;
    const xhtml = yield* run(
      config.pdftotextPath,
      ["-bbox-layout", "-f", page, "-l", page, "-enc", "UTF-8", path.resolve(request.pdfPath), "-"],
      {},
      `extracting the text blocks of page ${page}`
    );
    return yield* Effect.try({
      try: () => parseBboxLayout(xhtml),
      catch: (cause) => PdfToolsError.fromUnknown("parse", "Could not parse the pdftotext -bbox-layout output.", cause),
    });
  });

  return {
    svgToPdf,
    inspect,
    measurePage,
    renderPng,
    pageText,
    pageWords,
    inkCoverage,
    annotations,
  } satisfies PdfToolsShape;
});

/**
 * Effect service for the PDF tools driver.
 *
 * **Example** (Reference the PdfTools service)
 *
 * ```ts
 * import { PdfTools } from "@beep/pdf-tools"
 *
 * console.log(PdfTools)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PdfTools extends Context.Service<PdfTools, PdfToolsShape>()($I`PdfTools`) {
  /**
   * Build the PDF tools service layer.
   *
   * **Details**
   *
   * The layer never probes the executables; a missing tool surfaces as a
   * `tool-unavailable` {@link PdfToolsError} on first use.
   *
   * **Example** (Create the service layer)
   *
   * ```ts
   * import { PdfTools } from "@beep/pdf-tools"
   *
   * const layer = PdfTools.makeLayer()
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config?: PdfToolsConfig | undefined
  ): Layer.Layer<PdfTools, never, ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path> =>
    Layer.effect(PdfTools, Effect.map(makeService(config ?? PdfToolsConfig.make({})), PdfTools.of));
}
