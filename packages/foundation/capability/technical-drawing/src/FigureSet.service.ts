/**
 * Figure-set renderer and validator: spec → projections → sheets → PDF →
 * manifest, and PDF → validation report, over the two ports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { A, O, Str } from "@beep/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { Segment2, ShadingPlan } from "./Geometry.schemas.ts";
import { mirrorSegments, sameSegments } from "./Geometry.segments.ts";
import { fontNamesOf, outlineFontFile } from "./internal/LabelOutline.ts";
import { sha256Hex } from "./Manifest.digest.ts";
import { FigureRecord, FontPin, LabelFontRecord, OmissionProof, RenderManifest } from "./Manifest.schemas.ts";
import { commonScale, composeSheet } from "./Sheet.compose.ts";
import {
  LabelFontAlias,
  labelFontFamily,
  MIN_LETTER_HEIGHT_CM,
  PT_PER_CM,
  PT_PER_MM,
  SheetFonts,
  SheetLabelFaces,
  SheetOptions,
} from "./Sheet.schemas.ts";
import { DrawingError } from "./TechnicalDrawing.errors.ts";
import { GeometryEngine, PdfBackend } from "./TechnicalDrawing.ports.ts";
import {
  labelTextFindings,
  marginFindings,
  purityFindings,
  shadingCoverageFindings,
  shadingLoneLineFindings,
  shadingOutlineClearanceFindings,
  shadingSpacingFindings,
  structuralFindings,
} from "./Validation.rules.ts";
import { ValidationOptions, ValidationReport } from "./Validation.schemas.ts";
import { cameraForView, FigureSetSpec, PictorialProjection } from "./View.schemas.ts";
import type { EdgeSet } from "./Geometry.schemas.ts";
import type { LabelFace } from "./internal/LabelOutline.ts";
import type { LabelStyle } from "./Sheet.schemas.ts";
import type { SheetFinding, SheetLabel } from "./Validation.schemas.ts";
import type { FigureSpec, OmissionClaim, ViewName } from "./View.schemas.ts";

const $I = $TechnicalDrawingId.create("FigureSet.service");
const decodeSpec = S.decodeUnknownEffect(S.fromJsonString(FigureSetSpec));
const encodeManifest = S.encodeUnknownEffect(S.fromJsonString(RenderManifest));
const encoder = new TextEncoder();
const MARGIN_DPI = 300;
const PURITY_DPIS = [300, 600];
const FONT_FILE = /\.(?:ttf|otf)$/i;

// Family names compare without case: fontconfig matches them the same way.
const sameFamily = (a: string, b: string): boolean => Str.toLowerCase(a) === Str.toLowerCase(b);

// A label style rendered as embedded text, with the label it letters.
const textLabelsOf = (sheet: SheetOptions): ReadonlyArray<{ readonly label: SheetLabel; readonly style: LabelStyle }> =>
  pipe(
    [
      O.map(sheet.sheetNumberLabel, (style) => ({ label: "sheet-number" as const, style })),
      O.map(sheet.figureLabel, (style) => ({ label: "figure" as const, style })),
    ],
    A.getSomes,
    A.filter(({ style }) => style.render === "text")
  );

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
    allowPartOverlaps: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.annotateKey({
        description:
          "Whether to render a model whose parts interpenetrate. Defaults to false: overlapping solids double-count volume and confuse hidden-line removal, so the render is refused.",
      })
    ),
  },
  $I.annote("RenderRequest", {
    description:
      "Spec path, output directory, sheet options, validation and shading switches, and the part-overlap override of a render.",
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

// Shading pitch and sliver width are paper quantities: convert the sheet's mm
// to model units at the common scale (points per model unit), then project
// once more.
// The validator's default spacing floor (`ValidationOptions.minShadingSpacingMm`),
// read from the schema so the kernel's clearance and the check cannot drift apart.
const shadingClearanceFloorMm = ValidationOptions.make({ expectedPages: O.none() }).minShadingSpacingMm;

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
      style: sheet.shadingStyle,
      axis: sheet.shadingAxis,
      minFaceSpan: toModel(sheet.shadingMinFaceSpanMm),
      minStroke: toModel(sheet.shadingMinStrokeMm),
      // graded stroke ends stand half a pitch clear of the outlines, and never
      // less than the validator's spacing floor, so the render passes its own check
      clearance: O.some(toModel(Math.max(sheet.shadingMinPitchMm / 2, shadingClearanceFloorMm))),
    })
  );
};

// Everything a sheet draws for a view: solid outlines plus broken-line parts.
const drawnSegments = (edges: EdgeSet): ReadonlyArray<Segment2> => [...edges.visible, ...edges.broken];

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
    proven:
      A.length(shown.broken) === A.length(omitted.broken) &&
      sameSegments({
        left: claim.relation === "identical" ? drawnSegments(shown) : mirrorSegments(drawnSegments(shown)),
        right: drawnSegments(omitted),
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
    const pdfSha256 = yield* sha256Hex(bytes);
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
    // Text labels are checked in the extracted text, which a missing font leaves empty.
    const textFindings = A.isReadonlyArrayNonEmpty(options.textLabels)
      ? yield* Effect.forEach(pages, (page) =>
          pdf
            .pageText(resolved, page)
            .pipe(Effect.map((text) => labelTextFindings({ page, pages: A.length(pages), text, options })))
        )
      : [];
    return ValidationReport.make({
      pdfSha256,
      pageCount: facts.pages.length,
      findings: [...structuralFindings({ facts, options }), ...A.flatten(textFindings), ...A.flatten(rasterFindings)],
    });
  });

  const readFont = (fontFile: string) =>
    fs
      .readFile(fontFile)
      .pipe(
        Effect.mapError((cause) => DrawingError.fromUnknown("font", `Could not read label font "${fontFile}".`, cause))
      );

  // Outline a label font and check its cap height at the style's size.
  const faceOf = Effect.fnUntraced(function* (style: LabelStyle, fontFile: string, bytes: Uint8Array) {
    const face = yield* outlineFontFile(fontFile, bytes);
    const capCm = (style.sizePt * face.capHeight) / face.unitsPerEm / PT_PER_CM;
    if (capCm < MIN_LETTER_HEIGHT_CM) {
      return yield* DrawingError.make({
        reason: "font",
        message: `Label font "${fontFile}" at ${style.sizePt} pt has a cap height of ${capCm.toFixed(3)} cm, under 0.32 cm.`,
      });
    }
    return face;
  });

  // Outline an operator label font file; its sha256 goes in the manifest.
  const loadLabelFont = Effect.fnUntraced(function* (style: LabelStyle, fontFile: string) {
    const bytes = yield* readFont(fontFile);
    const face = yield* faceOf(style, fontFile, bytes);
    return { record: LabelFontRecord.make({ fontFile, sha256: yield* sha256Hex(bytes) }), face };
  });

  // Resolve every text label's family to the one Regular file of that family
  // in the font directory (searched recursively, as fontconfig does). The
  // files' own metrics place the labels; their hashes pin the PDF's fonts.
  const resolveTextFonts = Effect.fnUntraced(function* (sheet: SheetOptions) {
    const texts = textLabelsOf(sheet);
    if (!A.isReadonlyArrayNonEmpty(texts)) {
      return O.none<{
        readonly fonts: SheetFonts;
        readonly pins: ReadonlyArray<FontPin>;
        readonly faces: SheetLabelFaces;
        readonly labels: ReadonlyArray<SheetLabel>;
      }>();
    }
    const directory = yield* O.match(sheet.fontDirectory, {
      onNone: () =>
        DrawingError.make({
          reason: "font",
          message: "Text labels need a font directory: set `fontDirectory` in the sheet options.",
        }),
      onSome: Effect.succeed,
    });
    const entries = yield* fs
      .readDirectory(directory, { recursive: true })
      .pipe(
        Effect.mapError((cause) =>
          DrawingError.fromUnknown("font", `Could not read the font directory "${directory}".`, cause)
        )
      );
    const catalog = yield* Effect.forEach(
      pipe(
        entries,
        A.filter((entry) => FONT_FILE.test(entry)),
        A.sort(Order.String)
      ),
      Effect.fnUntraced(function* (entry: string) {
        const file = path.join(directory, entry);
        const bytes = yield* readFont(file);
        return { file, bytes, ...(yield* fontNamesOf(file, bytes)) };
      })
    );
    const resolve = Effect.fnUntraced(function* (requested: string) {
      const matches = A.filter(
        catalog,
        (font) => sameFamily(font.family, requested) && sameFamily(font.subfamily, "Regular")
      );
      if (A.length(matches) > 1) {
        return yield* DrawingError.make({
          reason: "font",
          message: `The font directory "${directory}" holds ${A.length(matches)} Regular files of "${requested}": ${A.join(
            A.map(matches, (m) => m.file),
            ", "
          )}.`,
        });
      }
      return yield* O.match(A.head(matches), {
        onNone: () =>
          DrawingError.make({
            reason: "font",
            message: `The font directory "${directory}" holds no Regular font of the family "${requested}".`,
          }),
        onSome: (font) => Effect.succeed({ requested, ...font }),
      });
    });
    const resolved = yield* Effect.forEach(A.dedupe(A.map(texts, ({ style }) => labelFontFamily(style))), resolve);
    const fontFor = (style: LabelStyle) =>
      A.findFirst(resolved, (font) => font.requested === labelFontFamily(style)).pipe(
        O.match({
          onNone: () => DrawingError.make({ reason: "font", message: "A text label lost its resolved font." }),
          onSome: (font) => faceOf(style, font.file, font.bytes),
        })
      );
    const faceFor = (label: SheetLabel) =>
      pipe(
        A.findFirst(texts, (text) => text.label === label),
        O.match({
          onNone: () => Effect.succeedNone,
          onSome: ({ style }) => Effect.asSome(fontFor(style)),
        })
      );
    return O.some({
      fonts: SheetFonts.make({
        directory,
        families: A.map(resolved, (font) => LabelFontAlias.make({ requested: font.requested, family: font.family })),
      }),
      pins: yield* Effect.forEach(resolved, (font) =>
        Effect.map(sha256Hex(font.bytes), (digest) =>
          FontPin.make({ family: font.requested, file: font.file, sha256: digest })
        )
      ),
      faces: SheetLabelFaces.make({
        sheetNumber: yield* faceFor("sheet-number"),
        figure: yield* faceFor("figure"),
      }),
      labels: A.map(texts, (text) => text.label),
    });
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
    const specSha256 = yield* sha256Hex(specBytes);
    const spec = yield* decodeSpec(new TextDecoder().decode(specBytes)).pipe(
      Effect.mapError((cause) => DrawingError.fromUnknown("spec", `Invalid figure-set spec "${specPath}".`, cause))
    );
    const info = yield* engine.info;
    const model = yield* engine.summarize(spec.model);
    if (model.partOverlaps > 0 && !request.allowPartOverlaps) {
      return yield* DrawingError.make({
        reason: "geometry",
        message: `${model.partOverlaps} pair(s) of parts overlap; fix the model so parts only touch, or set allowPartOverlaps to render anyway.`,
      });
    }
    // The spec's own sheet options win wholesale; the manifest records the ones used.
    const sheet = O.getOrElse(spec.sheet, () => request.sheet);
    // Font files are read before projecting, so a bad one fails fast.
    const sheetNumberFont = yield* labelFace(sheet.sheetNumberLabel);
    const figureFont = yield* labelFace(sheet.figureLabel);
    const textFonts = yield* resolveTextFonts(sheet);
    const textFaces = O.map(textFonts, (t) => t.faces);
    // A style is either outlined from a font file or set as text, never both.
    const faces = SheetLabelFaces.make({
      sheetNumber: O.orElse(
        O.map(sheetNumberFont, (f) => f.face),
        () => O.flatMap(textFaces, (f) => f.sheetNumber)
      ),
      figure: O.orElse(
        O.map(figureFont, (f) => f.face),
        () => O.flatMap(textFaces, (f) => f.figure)
      ),
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
    const scale = commonScale({ views: A.map(figureEdges, drawnSegments), options: sheet, faces });
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
        const shadedView = A.get(shading, index);
        const shadingLines = pipe(
          shadedView,
          O.map((view) => view.shading),
          O.getOrElse(A.empty<Segment2>)
        );
        const svg = composeSheet({
          segments: edges.visible,
          shading: shadingLines,
          broken: edges.broken,
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
          svgSha256: yield* sha256Hex(svgBytes),
          visibleSegments: A.length(edges.visible),
          shadingSegments: A.length(shadingLines),
          brokenSegments: A.length(edges.broken),
          camera: A.get(cameras, index),
          shadingCoverage: O.flatMap(shadedView, (view) => view.shadingCoverage),
        });
      })
    );
    const pdfFile = "sheets.pdf";
    const pdfPath = path.join(outputDir, pdfFile);
    yield* pdf.svgToPdf(
      A.map(figures, (f) => path.join(outputDir, f.svgFile)),
      pdfPath,
      O.map(textFonts, (t) => t.fonts)
    );
    const pdfBytes = yield* fs.readFile(pdfPath).pipe(Effect.mapError(io(`Could not read "${pdfPath}".`)));
    const pdfSha256 = yield* sha256Hex(pdfBytes);
    const validationOptions = ValidationOptions.make({
      expectedPages: O.some(sheets),
      textLabels: O.match(textFonts, { onNone: A.empty, onSome: (t) => t.labels }),
      expectedLabelFonts: O.match(textFonts, {
        onNone: A.empty,
        onSome: (t) => A.map(t.pins, (pin) => pin.family),
      }),
    });
    // Shading is checked on the render's own vectors, in mm on the sheet: line
    // spacing, stroke ends clear of outlines, no stroke alone beside an outline,
    // and no face that planned lines and drew none.
    const mm = scale / PT_PER_MM;
    const inMm = (segments: ReadonlyArray<Segment2>) =>
      A.map(segments, ([x1, y1, x2, y2]) => Segment2.make([x1 * mm, y1 * mm, x2 * mm, y2 * mm]));
    // The outline, lone-line and lost-face checks describe graded strokes (drawn back from
    // outlines and planned per visible stretch); uniform strokes end on the face outline by
    // design and have no probe pass, so those checks would fail every default render.
    const graded = sheet.shadingStyle === "graded";
    const shadingFindings = A.flatMap(shading, (view, index) => {
      const page = index + 1;
      const shadingMm = inMm(view.shading);
      const outlineMm = inMm([...view.visible, ...view.broken]);
      const gradedFindings = graded
        ? [
            ...shadingOutlineClearanceFindings({ page, shadingMm, outlineMm, options: validationOptions }),
            ...shadingLoneLineFindings({ page, shadingMm, outlineMm, options: validationOptions }),
            ...O.match(view.shadingCoverage, {
              onNone: () => A.empty<SheetFinding>(),
              onSome: (coverage) => shadingCoverageFindings({ page, coverage }),
            }),
          ]
        : A.empty<SheetFinding>();
      return [
        ...shadingSpacingFindings({ page, segmentsMm: shadingMm, options: validationOptions }),
        ...gradedFindings,
      ];
    });
    const validation = request.validate
      ? O.some(
          yield* validate(pdfPath, validationOptions).pipe(
            Effect.map((report) =>
              ValidationReport.make({ ...report, findings: [...report.findings, ...shadingFindings] })
            )
          )
        )
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
      fonts: O.match(textFonts, { onNone: A.empty, onSome: (t) => t.pins }),
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
