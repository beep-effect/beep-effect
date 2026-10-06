/**
 * Ports the capability needs an adapter for: a geometry engine that builds and
 * projects the model, and a PDF backend that converts, inspects, and renders.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type * as O from "effect/Option";
import type { EmailConfirmation } from "./Approval.schemas.ts";
import type { Camera, EdgeSet, ModelSpec, ModelSummary, ShadingPlan } from "./Geometry.schemas.ts";
import type { EngineInfo } from "./Manifest.schemas.ts";
import type { DrawingError } from "./TechnicalDrawing.errors.ts";
import type { PageMetrics, PdfFacts } from "./Validation.schemas.ts";

const $I = $TechnicalDrawingId.create("TechnicalDrawing.ports");

/**
 * Shape of the {@link GeometryEngine} port.
 *
 * **Example** (Stub geometry engine)
 *
 * ```ts
 * import type { GeometryEngineShape } from "@beep/technical-drawing"
 * import { Effect } from "effect"
 *
 * const engine: GeometryEngineShape = {
 *   info: Effect.die("not implemented"),
 *   summarize: () => Effect.die("not implemented"),
 *   project: () => Effect.die("not implemented")
 * }
 * console.log(engine)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface GeometryEngineShape {
  readonly info: Effect.Effect<EngineInfo, DrawingError>;
  readonly project: (
    model: ModelSpec,
    cameras: ReadonlyArray<Camera>,
    shading: O.Option<ShadingPlan>
  ) => Effect.Effect<ReadonlyArray<EdgeSet>, DrawingError>;
  readonly summarize: (model: ModelSpec) => Effect.Effect<ModelSummary, DrawingError>;
}

/**
 * Geometry engine port: builds the model and projects it with hidden-line
 * removal under each camera, optionally with straight-line surface shading
 * hidden by the same pass.
 *
 * **Example** (Reference the port)
 *
 * ```ts
 * import { GeometryEngine } from "@beep/technical-drawing"
 *
 * console.log(GeometryEngine)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class GeometryEngine extends Context.Service<GeometryEngine, GeometryEngineShape>()($I`GeometryEngine`) {}

/**
 * Shape of the {@link PdfBackend} port.
 *
 * **Example** (Stub PDF backend)
 *
 * ```ts
 * import type { PdfBackendShape } from "@beep/technical-drawing"
 * import { Effect } from "effect"
 *
 * const backend: PdfBackendShape = {
 *   svgToPdf: () => Effect.die("not implemented"),
 *   inspect: () => Effect.die("not implemented"),
 *   measurePage: () => Effect.die("not implemented"),
 *   pageText: () => Effect.die("not implemented")
 * }
 * console.log(backend)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface PdfBackendShape {
  readonly inspect: (pdfPath: string) => Effect.Effect<PdfFacts, DrawingError>;
  readonly measurePage: (request: {
    readonly pdfPath: string;
    readonly page: number;
    readonly dpi: number;
    readonly antiAlias: boolean;
  }) => Effect.Effect<PageMetrics, DrawingError>;
  readonly pageText: (pdfPath: string, page: number) => Effect.Effect<string, DrawingError>;
  readonly svgToPdf: (svgPaths: ReadonlyArray<string>, outputPath: string) => Effect.Effect<void, DrawingError>;
}

/**
 * PDF backend port: converts sheet SVGs into one PDF (version ≤ 1.6, fixed
 * dates), reports a PDF's structure, measures rendered pages, and reads the
 * text of one page.
 *
 * **Example** (Reference the port)
 *
 * ```ts
 * import { PdfBackend } from "@beep/technical-drawing"
 *
 * console.log(PdfBackend)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class PdfBackend extends Context.Service<PdfBackend, PdfBackendShape>()($I`PdfBackend`) {}

/**
 * Shape of the {@link MailReader} port.
 *
 * **Example** (Stub mail reader)
 *
 * ```ts
 * import type { MailReaderShape } from "@beep/technical-drawing"
 * import { Effect } from "effect"
 *
 * const reader: MailReaderShape = { authoredText: () => Effect.die("not implemented") }
 * console.log(reader)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface MailReaderShape {
  readonly authoredText: (messageId: string) => Effect.Effect<EmailConfirmation, DrawingError>;
}

/**
 * Mail reader port: one message's sender addresses and the plain-text
 * portion its sender wrote (never the quoted thread, never HTML).
 *
 * **Example** (Reference the port)
 *
 * ```ts
 * import { MailReader } from "@beep/technical-drawing"
 *
 * console.log(MailReader)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class MailReader extends Context.Service<MailReader, MailReaderShape>()($I`MailReader`) {}
