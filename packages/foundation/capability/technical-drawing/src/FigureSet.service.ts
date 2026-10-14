/**
 * Figure-set renderer and validator: spec → projections → sheets → PDF →
 * manifest, and PDF → validation report, over the two ports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { A, O } from "@beep/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { ShadingPlan } from "./Geometry.schemas.ts";
import { mirrorSegments, sameSegments } from "./Geometry.segments.ts";
import { outlineFontFile } from "./internal/LabelOutline.ts";
import { FigureRecord, LabelFontRecord, OmissionProof, RenderManifest, Sha256Hex } from "./Manifest.schemas.ts";
import { commonScale, composeSheet } from "./Sheet.compose.ts";
import { MIN_LETTER_HEIGHT_CM, PT_PER_CM, PT_PER_MM, SheetLabelFaces, SheetOptions } from "./Sheet.schemas.ts";
import { DrawingError } from "./TechnicalDrawing.errors.ts";
import { GeometryEngine, PdfBackend } from "./TechnicalDrawing.ports.ts";
import { marginFindings, purityFindings, structuralFindings } from "./Validation.rules.ts";
import { ValidationOptions, ValidationReport } from "./Validation.schemas.ts";
import { cameraForView, FigureSetSpec, PictorialProjection } from "./View.schemas.ts";
import type { EdgeSet, Segment2 } from "./Geometry.schemas.ts";
import type { LabelFace } from "./internal/LabelOutline.ts";
import type { LabelStyle } from "./Sheet.schemas.ts";
import type { FigureSpec, OmissionClaim, ViewName } from "./View.schemas.ts";

const $I = $TechnicalDrawingId.create("FigureSet.service");
const decodeSpec = S.decodeUnknownEffect(S.fromJsonString(FigureSetSpec));
const encodeManifest = S.encodeUnknownEffect(S.fromJsonString(RenderManifest));
const encoder = new TextEncoder();
const MARGIN_DPI = 300;
const PURITY_DPIS = [300, 600];

/**
 * Request to render a figure set.
 *
 * **Example** (Render to a directory)
 *
 * ```ts
 * import { RenderRequest } from "@beep/technical-drawing"
 *
 * console.log(RenderRequest.make({ specPath: "spec.json", outputDir: "out" }).validate)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RenderRequest extends S.Class<RenderRequest>($I`RenderRequest`)(
  {
    specPath: S.NonEmptyString.annotateKey({ description: "Path of the figure-set spec JSON." }),
    outputDir: S.NonEmptyString.annotateKey({ description: "Directory for sheet SVGs, the PDF, and the manifest." }),
    sheet: SheetOptions.pipe(
      S.withConstructorDefault(Effect.succeed(SheetOptions.make({}))),
      S.annotateKey({
        description:
          "Sheet options. Defaults to Letter, 0.35 mm, 0.45 cm lettering. A spec that carries its own `sheet` wins wholesale over these.",
      })
    ),
    validate: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.annotateKey({ description: "Whether to validate the PDF and record the report. Defaults to true." })
    ),
    shade: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.annotateKey({ description: "Whether to add procedural straight-line surface shading. Defaults to false." })
    ),
  },
  $I.annote("RenderRequest", {
    description: "Spec path, output directory, sheet options, and validation switch of a render.",
  })
) {}

/**
 * Runtime shape of the {@link FigureSet} service.
 *
 * **Example** (Stub service)
 *
 * ```ts
 * import type { FigureSetShape } from "@beep/technical-drawing"
 * import * as Effect from "effect/Effect";
 * const service: FigureSetShape = {
 *   render: () => Effect.die("not implemented"),
 *   validate: () => Effect.die("not implemented")
 * }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface FigureSetShape {
  readonly render: (request: RenderRequest) => Effect.Effect<RenderManifest, DrawingError>;
  readonly validate: (pdfPath: string, options: ValidationOptions) => Effect.Effect<ValidationReport, DrawingError>;
}

// shared digest idiom with @beep/occt; no in-family home, future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- shared digest idiom; no in-family home, future foundation capability candidate
const hexOf = (bytes: ArrayBuffer): string =>
  pipe(
    A.fromIterable(new Uint8Array(bytes)),
    A.map((b) => b.toString(16).padStart(2, "0")),
    A.join("")
  );

const sha256 = (bytes: Uint8Array): Effect.Effect<Sha256Hex> =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", bytes.slice().buffer)).pipe(
    Effect.map((digest) => Sha256Hex.make(hexOf(digest)))
  );

// Shading pitch is a paper quantity: convert the sheet's mm range to model
// units at the common scale (points per model unit), then project once more.
const shadingFor = (input: {
  readonly shade: boolean;
  readonly sheet: SheetOptions;
  readonly scale: number;
  readonly project: (plan: ShadingPlan) => Effect.Effect<ReadonlyArray<EdgeSet>, DrawingError>;
}): Effect.Effect<ReadonlyArray<EdgeSet>, DrawingError> => {
  const { sheet, scale } = input;
  if (!input.shade) {
    return Effect.succeed([]);
  }
  const toModel = (mm: number) => (mm * PT_PER_MM) / scale;
  return input.project(
    ShadingPlan.make({
      minPitch: toModel(sheet.shadingMinPitchMm),
      maxPitch: toModel(Math.max(sheet.shadingMaxPitchMm, sheet.shadingMinPitchMm)),
      litThreshold: sheet.shadingLitThreshold,
    })
  );
};

// An omitted pictorial is projected like the figure it is claimed from.
const projectionOf = (spec: FigureSetSpec, view: ViewName): PictorialProjection =>
  pipe(
    A.findFirst(spec.figures, (f) => f.view === view),
    O.map((f) => f.projection),
    O.getOrElse(() => PictorialProjection.Enum.perspective)
  );

const proveOmission = (claim: OmissionClaim, shown: EdgeSet, omitted: EdgeSet): OmissionProof =>
  OmissionProof.make({
    omitted: claim.omitted,
    shown: claim.shown,
    relation: claim.relation,
    proven: sameSegments({
      left: claim.relation === "identical" ? shown.visible : mirrorSegments(shown.visible),
      right: omitted.visible,
    }),
  });

const makeService = Effect.fn("FigureSet.makeService")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const engine = yield* GeometryEngine;
  const pdf = yield* PdfBackend;
  const io = (what: string) => (cause: unknown) => DrawingError.fromUnknown("io", what, cause);

  const validate = Effect.fn("FigureSet.validate")(function* (pdfPath: string, options: ValidationOptions) {
    const resolved = path.resolve(pdfPath);
    const bytes = yield* fs.readFile(resolved).pipe(Effect.mapError(io(`Could not read "${resolved}".`)));
    const pdfSha256 = yield* sha256(bytes);
    const facts = yield* pdf.inspect(resolved);
    // `A.range(1, 0)` is `[1]`, so an empty document needs its own branch.
    const pages = A.length(facts.pages) === 0 ? A.empty<number>() : A.range(1, A.length(facts.pages));
    const rasterFindings = yield* Effect.forEach(
      pages,
      Effect.fnUntraced(function* (page: number) {
        const margins = yield* pdf.measurePage({ pdfPath, page, dpi: MARGIN_DPI, antiAlias: true });
        const purity = yield* Effect.forEach(PURITY_DPIS, (dpi) =>
          pdf
            .measurePage({ pdfPath, page, dpi, antiAlias: false })
            .pipe(Effect.map((metrics) => purityFindings({ page, metrics, options })))
        );
        return [...marginFindings({ page, metrics: margins }), ...A.flatten(purity)];
      })
    );
    return ValidationReport.make({
      pdfSha256,
      pageCount: facts.pages.length,
      findings: [...structuralFindings({ facts, options }), ...A.flatten(rasterFindings)],
    });
  });

  // Outline an operator label font file and check its cap height; its sha256 goes in the manifest.
  const loadLabelFont = Effect.fnUntraced(function* (style: LabelStyle, fontFile: string) {
    const bytes = yield* fs
      .readFile(fontFile)
      .pipe(
        Effect.mapError((cause) => DrawingError.fromUnknown("font", `Could not read label font "${fontFile}".`, cause))
      );
    const face = yield* outlineFontFile(fontFile, bytes);
    const capCm = (style.sizePt * face.capHeight) / face.unitsPerEm / PT_PER_CM;
    if (capCm < MIN_LETTER_HEIGHT_CM) {
      return yield* DrawingError.make({
        reason: "font",
        message: `Label font "${fontFile}" at ${style.sizePt} pt has a cap height of ${capCm.toFixed(3)} cm, under 0.32 cm.`,
      });
    }
    return { record: LabelFontRecord.make({ fontFile, sha256: yield* sha256(bytes) }), face };
  });

  const labelFace = Effect.fnUntraced(function* (style: O.Option<LabelStyle>) {
    const file = pipe(
      style,
      O.flatMap((s) => O.map(s.fontFile, (fontFile) => ({ style: s, fontFile })))
    );
    return yield* O.match(file, {
      onNone: () => Effect.succeed(O.none<{ readonly record: LabelFontRecord; readonly face: LabelFace }>()),
      onSome: ({ style: s, fontFile }) => Effect.asSome(loadLabelFont(s, fontFile)),
    });
  });

  const render = Effect.fn("FigureSet.render")(function* (request: RenderRequest) {
    const specPath = path.resolve(request.specPath);
    const specBytes = yield* fs.readFile(specPath).pipe(Effect.mapError(io(`Could not read "${specPath}".`)));
    const specSha256 = yield* sha256(specBytes);
    const spec = yield* decodeSpec(new TextDecoder().decode(specBytes)).pipe(
      Effect.mapError((cause) => DrawingError.fromUnknown("spec", `Invalid figure-set spec "${specPath}".`, cause))
    );
    const info = yield* engine.info;
    const model = yield* engine.summarize(spec.model);
    // The spec's own sheet options win wholesale; the manifest records the ones used.
    const sheet = O.getOrElse(spec.sheet, () => request.sheet);
    // Font files are read before projecting, so a bad one fails fast.
    const sheetNumberFont = yield* labelFace(sheet.sheetNumberLabel);
    const figureFont = yield* labelFace(sheet.figureLabel);
    const faces = SheetLabelFaces.make({
      sheetNumber: O.map(sheetNumberFont, (f) => f.face),
      figure: O.map(figureFont, (f) => f.face),
    });
    const labelFonts = A.dedupeWith(
      [...O.toArray(O.map(sheetNumberFont, (f) => f.record)), ...O.toArray(O.map(figureFont, (f) => f.record))],
      (a, b) => a.fontFile === b.fontFile
    );
    const views = [
      ...A.map(spec.figures, (f) => ({ view: f.view, projection: f.projection })),
      ...A.map(spec.omissions, (o) => ({ view: o.omitted, projection: projectionOf(spec, o.shown) })),
    ];
    const cameras = A.map(views, ({ view, projection }) =>
      cameraForView({
        view,
        box: model.boundingBox,
        projection,
        azimuthDeg: spec.pictorialAzimuthDeg,
        planFacing: spec.planFacing,
      })
    );
    const projected = yield* engine.project(spec.model, cameras, O.none());
    const edgesOf = (index: number): Effect.Effect<EdgeSet, DrawingError> =>
      pipe(
        A.get(projected, index),
        O.match({
          onNone: () =>
            DrawingError.make({
              reason: "projection",
              message: `The engine returned no projection for view ${index}.`,
            }),
          onSome: Effect.succeed,
        })
      );
    const figureEdges = yield* Effect.forEach(spec.figures, (_, index) => edgesOf(index));
    const omissions = yield* Effect.forEach(
      spec.omissions,
      Effect.fnUntraced(function* (claim: OmissionClaim, index: number) {
        const omitted = yield* edgesOf(A.length(spec.figures) + index);
        const shownIndex = A.findFirstIndex(spec.figures, (f) => f.view === claim.shown);
        const shown = yield* pipe(
          shownIndex,
          O.match({
            onNone: () =>
              DrawingError.make({
                reason: "omission",
                message: `Omission of "${claim.omitted}" references "${claim.shown}", which the set does not show.`,
              }),
            onSome: edgesOf,
          })
        );
        const proof = proveOmission(claim, shown, omitted);
        return proof.proven
          ? proof
          : yield* DrawingError.make({
              reason: "omission",
              message: `"${claim.omitted}" is not ${claim.relation} to "${claim.shown}": the projections differ.`,
            });
      })
    );
    const scale = commonScale({ views: A.map(figureEdges, (e) => e.visible), options: sheet, faces });
    const shading = yield* shadingFor({
      shade: request.shade,
      sheet,
      scale,
      project: (plan) => engine.project(spec.model, A.take(cameras, A.length(spec.figures)), O.some(plan)),
    });
    const outputDir = path.resolve(request.outputDir);
    yield* fs
      .makeDirectory(outputDir, { recursive: true })
      .pipe(Effect.mapError(io(`Could not create "${outputDir}".`)));
    const sheets = A.length(spec.figures);
    const figures = yield* Effect.forEach(
      spec.figures,
      Effect.fnUntraced(function* (figure: FigureSpec, index: number) {
        const edges = yield* edgesOf(index);
        const shadingLines = pipe(
          A.get(shading, index),
          O.map((view) => view.shading),
          O.getOrElse(A.empty<Segment2>)
        );
        const svg = composeSheet({
          segments: edges.visible,
          shading: shadingLines,
          figure: index + 1,
          sheet: index + 1,
          sheets,
          scale,
          options: sheet,
          faces,
        });
        const svgFile = `fig-${index + 1}.svg`;
        const svgBytes = encoder.encode(svg);
        yield* fs
          .writeFile(path.join(outputDir, svgFile), svgBytes)
          .pipe(Effect.mapError(io(`Could not write "${svgFile}".`)));
        return FigureRecord.make({
          figure: index + 1,
          view: figure.view,
          description: figure.description,
          svgFile,
          svgSha256: yield* sha256(svgBytes),
          visibleSegments: A.length(edges.visible),
          shadingSegments: A.length(shadingLines),
          camera: A.get(cameras, index),
        });
      })
    );
    const pdfFile = "sheets.pdf";
    const pdfPath = path.join(outputDir, pdfFile);
    yield* pdf.svgToPdf(
      A.map(figures, (f) => path.join(outputDir, f.svgFile)),
      pdfPath
    );
    const pdfBytes = yield* fs.readFile(pdfPath).pipe(Effect.mapError(io(`Could not read "${pdfPath}".`)));
    const pdfSha256 = yield* sha256(pdfBytes);
    const validation = request.validate
      ? O.some(yield* validate(pdfPath, ValidationOptions.make({ expectedPages: O.some(sheets) })))
      : O.none<ValidationReport>();
    const manifest = RenderManifest.make({
      title: spec.title,
      specSha256,
      engine: info,
      model,
      scale,
      shaded: request.shade,
      figures,
      omissions,
      pdfFile,
      pdfSha256,
      validation,
      approver: spec.approver,
      sheet: O.some(sheet),
      labelFonts,
    });
    const json = yield* encodeManifest(manifest).pipe(
      Effect.mapError((cause) => DrawingError.fromUnknown("io", "Could not encode the manifest.", cause))
    );
    yield* fs
      .writeFileString(path.join(outputDir, "manifest.json"), `${json}\n`)
      .pipe(Effect.mapError(io("Could not write manifest.json.")));
    return manifest;
  });

  return { render, validate } satisfies FigureSetShape;
});

/**
 * Figure-set service: render a spec into sheets and validate sheet-set PDFs.
 *
 * **Example** (Reference the service)
 *
 * ```ts
 * import { FigureSet } from "@beep/technical-drawing"
 *
 * console.log(FigureSet)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FigureSet extends Context.Service<FigureSet, FigureSetShape>()($I`FigureSet`) {
  /**
   * Live layer over the {@link GeometryEngine} and {@link PdfBackend} ports.
   *
   * **Example** (Reference the layer)
   *
   * ```ts
   * import { FigureSet } from "@beep/technical-drawing"
   *
   * console.log(FigureSet.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<
    FigureSet,
    never,
    GeometryEngine | PdfBackend | FileSystem.FileSystem | Path.Path
  > = Layer.effect(FigureSet, Effect.map(makeService(), FigureSet.of));
}
