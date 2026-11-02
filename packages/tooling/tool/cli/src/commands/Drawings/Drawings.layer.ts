/**
 * Live adapters for the technical-drawing ports: `@beep/occt` as the geometry
 * engine and `@beep/pdf-tools` as the PDF backend.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { M365, M365GetMessageRequest } from "@beep/m365";
import { Occt, ProjectionRequest } from "@beep/occt";
import {
  FontFamilyAlias,
  PageTextRequest,
  PdfTools,
  PinnedFonts,
  RasterRequest,
  SvgToPdfRequest,
} from "@beep/pdf-tools";
import {
  DrawingError,
  EmailAddress,
  EmailConfirmation,
  EngineInfo,
  FigureSet,
  GeometryEngine,
  InkBounds,
  MailReader,
  PageMetrics,
  PdfBackend,
  PdfFacts,
  PdfFontFact,
  PdfPageSize,
  PdfStreamFact,
  SheetSetApproval,
} from "@beep/technical-drawing";
import { A, O } from "@beep/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import type { M365Error } from "@beep/m365";
import type { OcctError } from "@beep/occt";
import type { Camera, ModelSpec, ShadingPlan, SheetFonts } from "@beep/technical-drawing";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const engineFromOcct = Effect.fn("DrawingsLayer.engineFromOcct")(function* () {
  const occt = yield* Occt;
  const info = occt.kernel.pipe(
    Effect.mapBoth({
      onFailure: (cause) => DrawingError.fromUnknown("geometry", "The kernel could not report itself.", cause),
      onSuccess: (kernel) =>
        EngineInfo.make({
          name: "replicad/opencascade.js",
          version: kernel.replicadVersion,
          binarySha256: kernel.wasmSha256,
        }),
    })
  );
  const summarize = Effect.fn("DrawingsLayer.summarize")(function* (model: ModelSpec) {
    return yield* occt
      .summarize(model)
      .pipe(
        Effect.mapError((cause) => DrawingError.fromUnknown("geometry", "The kernel could not build the model.", cause))
      );
  });
  const project = Effect.fn("DrawingsLayer.project")(function* (
    model: ModelSpec,
    cameras: ReadonlyArray<Camera>,
    shading: O.Option<ShadingPlan>
  ) {
    return yield* occt
      .project(ProjectionRequest.make({ solid: model, cameras, shading }))
      .pipe(
        Effect.mapError((cause) => DrawingError.fromUnknown("projection", "Hidden-line projection failed.", cause))
      );
  });
  return GeometryEngine.of({ info, summarize, project });
});

const backendFromPdfTools = Effect.fn("DrawingsLayer.backendFromPdfTools")(function* () {
  const tools = yield* PdfTools;
  const pdf = (cause: unknown) => DrawingError.fromUnknown("pdf", "The PDF backend failed.", cause);
  const svgToPdf = Effect.fn("DrawingsLayer.svgToPdf")(function* (
    svgPaths: ReadonlyArray<string>,
    outputPath: string,
    fonts: O.Option<SheetFonts>
  ) {
    const pinned = O.map(fonts, (f) =>
      PinnedFonts.make({
        directory: f.directory,
        families: A.map(f.families, (a) => FontFamilyAlias.make({ requested: a.requested, family: a.family })),
      })
    );
    yield* tools.svgToPdf(SvgToPdfRequest.make({ svgPaths, outputPath, fonts: pinned })).pipe(Effect.mapError(pdf));
  });
  const inspect = Effect.fn("DrawingsLayer.inspect")(function* (pdfPath: string) {
    const structure = yield* tools.inspect(pdfPath).pipe(Effect.mapError(pdf));
    return PdfFacts.make({
      headerVersion: structure.headerVersion,
      pages: A.map(structure.pages, (p) => PdfPageSize.make({ widthPt: p.widthPt, heightPt: p.heightPt })),
      fonts: A.map(structure.fonts, (f) => PdfFontFact.make({ name: f.name, embedded: f.embedded })),
      annotationCount: structure.annotationCount,
      hasOptionalContent: structure.hasOptionalContent,
      encrypted: structure.encrypted,
      undecodableStreams: A.map(structure.undecodableStreams, (stream) =>
        PdfStreamFact.make({
          objectNumber: stream.objectNumber,
          generation: stream.generation,
          reason: stream.reason,
        })
      ),
      streamCheck: structure.streamCheck,
      containerDiscovery: structure.containerDiscovery,
    });
  });
  const measurePage = Effect.fn("DrawingsLayer.measurePage")(function* (request: {
    readonly pdfPath: string;
    readonly page: number;
    readonly dpi: number;
    readonly antiAlias: boolean;
  }) {
    const metrics = yield* tools
      .measurePage(
        RasterRequest.make({
          pdfPath: request.pdfPath,
          page: request.page,
          dpi: request.dpi,
          antiAlias: request.antiAlias,
        })
      )
      .pipe(Effect.mapError(pdf));
    return PageMetrics.make({
      width: metrics.width,
      height: metrics.height,
      dpi: metrics.dpi,
      antiAliased: request.antiAlias,
      inkBounds: pipe(
        metrics.inkBox,
        O.map((box) => InkBounds.make({ minX: box.minX, minY: box.minY, maxX: box.maxX, maxY: box.maxY }))
      ),
      inkPixels: metrics.inkPixels,
      impurePixels: metrics.impurePixels,
      largestBlackSquare: metrics.largestBlackSquare,
    });
  });
  const pageText = Effect.fn("DrawingsLayer.pageText")(function* (pdfPath: string, page: number) {
    return yield* tools.pageText(PageTextRequest.make({ pdfPath, page })).pipe(Effect.mapError(pdf));
  });
  return PdfBackend.of({ svgToPdf, inspect, measurePage, pageText });
});

/**
 * Geometry-engine port served by `@beep/occt`.
 *
 * **Example** (Reference the layer)
 *
 * ```ts
 * import { GeometryEngineOcctLive } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(GeometryEngineOcctLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GeometryEngineOcctLive: Layer.Layer<GeometryEngine, OcctError, FileSystem.FileSystem | Path.Path> =
  Layer.effect(GeometryEngine, engineFromOcct()).pipe(Layer.provide(Occt.layer));

/**
 * PDF-backend port over any `@beep/pdf-tools` service, so a caller picks the
 * driver's config (executables, timeouts, the stream-check inflate limit).
 *
 * **Example** (A backend with a smaller stream-check limit)
 *
 * ```ts
 * import { PdfBackendFromPdfTools } from "@beep/repo-cli/commands/Drawings"
 * import { PdfTools, PdfToolsConfig } from "@beep/pdf-tools"
 * import * as Layer from "effect/Layer"
 *
 * const backend = PdfBackendFromPdfTools.pipe(
 *   Layer.provide(PdfTools.makeLayer(PdfToolsConfig.make({ maxInflatedBytes: 64 * 1024 * 1024 })))
 * )
 * console.log(Layer.isLayer(backend)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PdfBackendFromPdfTools: Layer.Layer<PdfBackend, never, PdfTools> = Layer.effect(
  PdfBackend,
  backendFromPdfTools()
);

/**
 * PDF-backend port served by `@beep/pdf-tools` at its default config.
 *
 * **Example** (Reference the layer)
 *
 * ```ts
 * import { PdfBackendToolsLive } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(PdfBackendToolsLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PdfBackendToolsLive: Layer.Layer<
  PdfBackend,
  never,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> = PdfBackendFromPdfTools.pipe(Layer.provide(PdfTools.makeLayer()));

/**
 * The figure-set service over the live kernel and PDF tools.
 *
 * **Example** (Reference the layer)
 *
 * ```ts
 * import { FigureSetLive } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(FigureSetLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const FigureSetLive: Layer.Layer<
  FigureSet,
  OcctError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> = FigureSet.layer.pipe(Layer.provide(Layer.merge(GeometryEngineOcctLive, PdfBackendToolsLive)));

const mailFromM365 = Effect.fn("DrawingsLayer.mailFromM365")(function* () {
  const m365 = yield* M365;
  const authoredText = Effect.fn("DrawingsLayer.authoredText")(function* (messageId: string) {
    const message = yield* m365
      .getMessageAuthoredText(M365GetMessageRequest.make({ messageId }))
      .pipe(
        Effect.mapError((cause) =>
          DrawingError.fromUnknown(
            "approval",
            "Could not read a plain-text reply from the mail service; an HTML-only or unreadable reply is refused.",
            cause
          )
        )
      );
    const address = (value: string) =>
      S.decodeEffect(EmailAddress)(value).pipe(
        Effect.mapError((cause) => DrawingError.fromUnknown("approval", `"${value}" is not an email address.`, cause))
      );
    return EmailConfirmation.make({
      internetMessageId: message.internetMessageId,
      from: yield* address(message.from.emailAddress.address),
      sender: yield* address(message.sender.emailAddress.address),
      receivedAt: message.receivedDateTime,
      authoredText: message.uniqueBody.content,
    });
  });
  return MailReader.of({ authoredText });
});

/**
 * Mail-reader port over any `@beep/m365` service: maps the plain-text
 * authored portion of a reply into an `EmailConfirmation`.
 *
 * **Example** (Reference the layer)
 *
 * ```ts
 * import { MailReaderFromM365 } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(MailReaderFromM365)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MailReaderFromM365: Layer.Layer<MailReader, never, M365> = Layer.effect(MailReader, mailFromM365());

/**
 * Mail-reader port served by `@beep/m365` (`M365_TENANT_ID`, `M365_CLIENT_ID`).
 *
 * **Example** (Reference the layer)
 *
 * ```ts
 * import { MailReaderM365Live } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(MailReaderM365Live)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MailReaderM365Live: Layer.Layer<MailReader, M365Error> = MailReaderFromM365.pipe(
  Layer.provide(M365.layer)
);

/**
 * Mail-reader port that refuses every read, for the PDF sign route.
 *
 * **Example** (Reference the layer)
 *
 * ```ts
 * import { MailReaderUnavailable } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(MailReaderUnavailable)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MailReaderUnavailable: Layer.Layer<MailReader> = Layer.succeed(
  MailReader,
  MailReader.of({
    authoredText: Effect.fn("DrawingsLayer.mailUnavailable")(function* () {
      return yield* DrawingError.make({ reason: "approval", message: "Mail is not configured for this command." });
    }),
  })
);

/**
 * Sheet-set approval over the PDF tools and a mail-reader layer.
 *
 * **Example** (PDF route)
 *
 * ```ts
 * import { MailReaderUnavailable, sheetSetApprovalLive } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(sheetSetApprovalLive(MailReaderUnavailable))
 * ```
 *
 * @param mail - Mail-reader layer: `MailReaderM365Live` for the email route, `MailReaderUnavailable` otherwise.
 * @returns The approval service layer, needing only the process, file-system, and path services.
 * @category layers
 * @since 0.0.0
 */
export const sheetSetApprovalLive = <E>(
  mail: Layer.Layer<MailReader, E>
): Layer.Layer<SheetSetApproval, E, ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path> =>
  SheetSetApproval.layer.pipe(Layer.provide(Layer.merge(PdfBackendToolsLive, mail)));
