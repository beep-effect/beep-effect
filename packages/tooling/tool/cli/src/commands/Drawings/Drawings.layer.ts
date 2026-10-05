/**
 * Live adapters for the technical-drawing ports: `@beep/occt` as the geometry
 * engine and `@beep/pdf-tools` as the PDF backend.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Occt, ProjectionRequest, SolidSpec } from "@beep/occt";
import { PdfTools, RasterRequest, SvgToPdfRequest } from "@beep/pdf-tools";
import {
  BoundingBox,
  DrawingError,
  EdgeSet,
  EngineInfo,
  FigureSet,
  GeometryEngine,
  InkBounds,
  ModelSpec,
  ModelSummary,
  PageMetrics,
  PdfBackend,
  PdfFacts,
  PdfFontFact,
  PdfPageSize,
} from "@beep/technical-drawing";
import { A, O } from "@beep/utils";
import { Effect, Layer, pipe } from "effect";
import * as S from "effect/Schema";
import type { OcctError } from "@beep/occt";
import type { Camera } from "@beep/technical-drawing";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

// The capability's model vocabulary and the driver's solid vocabulary share a
// JSON shape; the adapter crosses the boundary by encoding one and decoding
// the other, so neither package depends on the other's classes.
const encodeModel = S.encodeEffect(ModelSpec);
const decodeSolid = S.decodeUnknownEffect(SolidSpec);

const toSolid = (model: ModelSpec): Effect.Effect<SolidSpec, DrawingError> =>
  encodeModel(model).pipe(
    Effect.flatMap(decodeSolid),
    Effect.mapError((cause) =>
      DrawingError.fromUnknown("geometry", "The model could not be handed to the kernel.", cause)
    )
  );

const engineFromOcct = Effect.fn("DrawingsLayer.engineFromOcct")(function* () {
  const occt = yield* Occt;
  const info = occt.kernel.pipe(
    Effect.map((kernel) =>
      EngineInfo.make({
        name: "replicad/opencascade.js",
        version: kernel.replicadVersion,
        binarySha256: kernel.wasmSha256,
      })
    ),
    Effect.mapError((cause) => DrawingError.fromUnknown("geometry", "The kernel could not report itself.", cause))
  );
  const summarize = Effect.fn("DrawingsLayer.summarize")(function* (model: ModelSpec) {
    const solid = yield* toSolid(model);
    const summary = yield* occt
      .summarize(solid)
      .pipe(
        Effect.mapError((cause) => DrawingError.fromUnknown("geometry", "The kernel could not build the model.", cause))
      );
    return ModelSummary.make({
      boundingBox: BoundingBox.make({ min: summary.boundingBox.min, max: summary.boundingBox.max }),
      volume: summary.volume,
      faceCount: summary.faceCount,
      edgeCount: summary.edgeCount,
    });
  });
  const project = Effect.fn("DrawingsLayer.project")(function* (model: ModelSpec, cameras: ReadonlyArray<Camera>) {
    const solid = yield* toSolid(model);
    const views = yield* occt
      .project(
        ProjectionRequest.make({
          solid,
          cameras: A.map(cameras, (camera) => ({
            eye: camera.eye,
            up: camera.up,
            target: camera.target,
            focus: camera.focus,
          })),
        })
      )
      .pipe(
        Effect.mapError((cause) => DrawingError.fromUnknown("projection", "Hidden-line projection failed.", cause))
      );
    return A.map(views, (view) => EdgeSet.make({ visible: view.visible, hidden: view.hidden }));
  });
  return GeometryEngine.of({ info, summarize, project });
});

const backendFromPdfTools = Effect.fn("DrawingsLayer.backendFromPdfTools")(function* () {
  const tools = yield* PdfTools;
  const pdf = (cause: unknown) => DrawingError.fromUnknown("pdf", "The PDF backend failed.", cause);
  const svgToPdf = Effect.fn("DrawingsLayer.svgToPdf")(function* (svgPaths: ReadonlyArray<string>, outputPath: string) {
    yield* tools.svgToPdf(SvgToPdfRequest.make({ svgPaths, outputPath })).pipe(Effect.mapError(pdf));
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
  return PdfBackend.of({ svgToPdf, inspect, measurePage });
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
 * PDF-backend port served by `@beep/pdf-tools`.
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
> = Layer.effect(PdfBackend, backendFromPdfTools()).pipe(Layer.provide(PdfTools.makeLayer()));

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
