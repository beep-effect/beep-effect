/**
 * PDF tools service: `rsvg-convert` SVG → PDF, pdf-lib structure inspection,
 * and poppler `pdftoppm` page rasters measured without leaving the driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PdfToolsId } from "@beep/identity/packages";
import { O, Str, thunkEmptyStr } from "@beep/utils";
import { Context, Effect, FileSystem, Layer, Path, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import { PDFDocument } from "pdf-lib";
import { measureP6 } from "./internal/ppm.ts";
import { structureOf } from "./internal/structure.ts";
import { PdfToolsError } from "./PdfTools.errors.ts";
import { PageTextRequest, PngRequest, RasterRequest, SvgToPdfRequest, SvgToPdfResult } from "./PdfTools.models.ts";
import type { PdfStructure, PdfVersion, RasterMetrics } from "./PdfTools.models.ts";

const $I = $PdfToolsId.create("PdfTools.service");
const validateSvgToPdfRequest = S.decodeUnknownEffect(S.toType(SvgToPdfRequest));
const validateRasterRequest = S.decodeUnknownEffect(S.toType(RasterRequest));
const validatePngRequest = S.decodeUnknownEffect(S.toType(PngRequest));
const validatePageTextRequest = S.decodeUnknownEffect(S.toType(PageTextRequest));
const encoder = new TextEncoder();

// pdf-lib always writes a `%PDF-1.7` header; the merged pages only use the
// constructs cairo emitted for the requested version, so the header is
// rewritten in place (same byte length, so offsets stay valid).
const mergePages = Effect.fn("PdfTools.mergePages")(function* (pages: ReadonlyArray<Uint8Array>, version: PdfVersion) {
  const out = yield* Effect.promise(() => PDFDocument.create({ updateMetadata: false }));
  yield* Effect.forEach(pages, (bytes) =>
    Effect.promise(() => PDFDocument.load(bytes, { updateMetadata: false })).pipe(
      Effect.flatMap((source) => Effect.promise(() => out.copyPages(source, source.getPageIndices()))),
      Effect.map((copied) => {
        for (const page of copied) {
          out.addPage(page);
        }
      })
    )
  );
  const saved = yield* Effect.promise(() => out.save({ useObjectStreams: false, updateFieldAppearances: false }));
  saved.set(encoder.encode(`%PDF-${version}`), 0);
  return saved;
});

/**
 * Technical knobs: executable names and the process kill grace period.
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
export class PdfToolsConfig extends S.Class<PdfToolsConfig>($I`PdfToolsConfig`)(
  {
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
      S.annotateKey({ description: "Grace period before a stuck tool is killed. Defaults to two minutes." })
    ),
  },
  $I.annote("PdfToolsConfig", {
    description: "Executable paths and kill grace period for the PDF tools driver.",
  })
) {}

/**
 * Runtime shape exposed by the {@link PdfTools} service.
 *
 * **Example** (Stub PdfToolsShape service)
 *
 * ```ts
 * import type { PdfToolsShape } from "@beep/pdf-tools"
 * import { Effect } from "effect"
 *
 * const service: PdfToolsShape = {
 *   svgToPdf: () => Effect.die("not implemented"),
 *   inspect: () => Effect.die("not implemented"),
 *   measurePage: () => Effect.die("not implemented"),
 *   renderPng: () => Effect.die("not implemented"),
 *   pageText: () => Effect.die("not implemented")
 * }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface PdfToolsShape {
  readonly inspect: (pdfPath: string) => Effect.Effect<PdfStructure, PdfToolsError>;
  readonly measurePage: (request: RasterRequest) => Effect.Effect<RasterMetrics, PdfToolsError>;
  readonly pageText: (request: PageTextRequest) => Effect.Effect<string, PdfToolsError>;
  readonly renderPng: (request: PngRequest) => Effect.Effect<string, PdfToolsError>;
  readonly svgToPdf: (request: SvgToPdfRequest) => Effect.Effect<SvgToPdfResult, PdfToolsError>;
}

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- shared driver boundary idiom; no in-family home, future foundation capability candidate
const collectText = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(thunkEmptyStr, (acc, chunk) => `${acc}${chunk}`)
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
  ): Effect.Effect<string, PdfToolsError> =>
    Effect.scoped(
      Effect.gen(function* () {
        const unavailable = (cause: unknown) =>
          PdfToolsError.fromUnknown("tool-unavailable", `Failed to run ${executable}; is it installed?`, cause);
        const handle = yield* spawner
          .spawn(
            ChildProcess.make(executable, args, {
              env,
              extendEnv: true,
              forceKillAfter: `${config.forceKillAfterMillis} millis`,
              stdin: "ignore",
              stderr: "pipe",
              stdout: "pipe",
            })
          )
          .pipe(Effect.mapError(unavailable));
        const [stdout, stderr, exitCode] = yield* Effect.all(
          [collectText(handle.stdout), collectText(handle.stderr), handle.exitCode],
          { concurrency: "unbounded" }
        ).pipe(Effect.mapError(unavailable));
        if (exitCode !== 0) {
          return yield* PdfToolsError.make({
            reason: "tool-failed",
            message: `${executable} exited ${exitCode} while ${what}.`,
            cause: O.some(Str.trim(stderr)),
          });
        }
        return stdout;
      })
    );

  // rsvg-convert 2.62 refuses several inputs when the format is a versioned
  // `pdf1.x`, and pdfunite stamps a random /ID into every merge, so pages are
  // converted one at a time and merged in-process with pdf-lib.
  const svgToPdf = Effect.fn("PdfTools.svgToPdf")(function* (rawRequest: SvgToPdfRequest) {
    const request = yield* validateSvgToPdfRequest(rawRequest).pipe(
      Effect.mapError((cause) => PdfToolsError.fromUnknown("invalid-request", "Invalid SVG to PDF request.", cause))
    );
    const outputPath = path.resolve(request.outputPath);
    const io = (what: string) => (cause: unknown) => PdfToolsError.fromUnknown("io", what, cause);
    const dir = yield* fs
      .makeTempDirectoryScoped({ prefix: "beep-pdf-tools-" })
      .pipe(Effect.mapError(io("Could not create a temp directory.")));
    const env = { SOURCE_DATE_EPOCH: `${request.sourceDateEpoch}` };
    const pagePaths = yield* Effect.forEach(request.svgPaths, (svgPath, index) => {
      const pagePath = path.join(dir, `page-${index + 1}.pdf`);
      return run(
        config.rsvgConvertPath,
        ["--format", `pdf${request.pdfVersion}`, "--output", pagePath, path.resolve(svgPath)],
        env,
        `converting page ${index + 1} to PDF`
      ).pipe(Effect.as(pagePath));
    });
    const pages = yield* Effect.forEach(pagePaths, (pagePath) =>
      fs.readFile(pagePath).pipe(Effect.mapError(io(`Could not read "${pagePath}".`)))
    );
    const merged = yield* mergePages(pages, request.pdfVersion).pipe(
      Effect.catchDefect((cause) =>
        PdfToolsError.fromUnknown("parse", "pdf-lib could not merge the converted pages.", cause)
      )
    );
    yield* fs.writeFile(outputPath, merged).pipe(Effect.mapError(io(`Could not write "${outputPath}".`)));
    return SvgToPdfResult.make({
      outputPath,
      pageCount: request.svgPaths.length,
      bytes: merged.byteLength,
    });
  }, Effect.scoped);

  const inspect = Effect.fn("PdfTools.inspect")(function* (pdfPath: string) {
    const bytes = yield* fs
      .readFile(pdfPath)
      .pipe(Effect.mapError((cause) => PdfToolsError.fromUnknown("io", `Could not read "${pdfPath}".`, cause)));
    const doc = yield* Effect.tryPromise({
      try: () => PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false }),
      catch: (cause) => PdfToolsError.fromUnknown("parse", `pdf-lib could not parse "${pdfPath}".`, cause),
    });
    return yield* Effect.try({
      try: () => structureOf({ bytes, doc }),
      catch: (cause) => PdfToolsError.fromUnknown("parse", `Could not walk the structure of "${pdfPath}".`, cause),
    });
  });

  const measurePage = Effect.fn("PdfTools.measurePage")(function* (rawRequest: RasterRequest) {
    const request = yield* validateRasterRequest(rawRequest).pipe(
      Effect.mapError((cause) => PdfToolsError.fromUnknown("invalid-request", "Invalid raster request.", cause))
    );
    const dir = yield* fs
      .makeTempDirectoryScoped({ prefix: "beep-pdf-tools-" })
      .pipe(Effect.mapError((cause) => PdfToolsError.fromUnknown("io", "Could not create a temp directory.", cause)));
    const prefix = path.join(dir, "page");
    const page = `${request.page}`;
    yield* run(
      config.pdftoppmPath,
      [
        "-r",
        `${request.dpi}`,
        "-f",
        page,
        "-l",
        page,
        "-singlefile",
        ...(request.antiAlias ? [] : ["-aa", "no", "-aaVector", "no"]),
        path.resolve(request.pdfPath),
        prefix,
      ],
      {},
      `rasterising page ${page} at ${request.dpi} dpi`
    );
    const ppm = yield* fs
      .readFile(`${prefix}.ppm`)
      .pipe(Effect.mapError((cause) => PdfToolsError.fromUnknown("io", "Could not read the rendered PPM.", cause)));
    return yield* Effect.try({
      try: () => measureP6({ bytes: ppm, dpi: request.dpi, blackThreshold: request.blackThreshold }),
      catch: (cause) => PdfToolsError.fromUnknown("parse", "Could not decode the rendered PPM.", cause),
    });
  }, Effect.scoped);

  const renderPng = Effect.fn("PdfTools.renderPng")(function* (rawRequest: PngRequest) {
    const request = yield* validatePngRequest(rawRequest).pipe(
      Effect.mapError((cause) => PdfToolsError.fromUnknown("invalid-request", "Invalid PNG request.", cause))
    );
    const outputPath = path.resolve(request.outputPath);
    const prefix = outputPath.endsWith(".png") ? outputPath.slice(0, -".png".length) : outputPath;
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

  return { svgToPdf, inspect, measurePage, renderPng, pageText } satisfies PdfToolsShape;
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
