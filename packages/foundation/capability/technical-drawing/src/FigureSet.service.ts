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
import * as Equivalence from "effect/Equivalence";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { ModelSpec, Segment2, ShadingPlan } from "./Geometry.schemas.ts";
import { mirrorSegments, sameSegments } from "./Geometry.segments.ts";
import { fontNamesOf, outlineFontFile } from "./internal/LabelOutline.ts";
import { sha256Hex } from "./Manifest.digest.ts";
import {
  FigureRecord,
  FontPin,
  LabelFontRecord,
  OmissionProof,
  OutlineSeparation,
  RenderManifest,
} from "./Manifest.schemas.ts";
import { OUTLINE_COINCIDENCE_MM, separateCloseOutlines } from "./Outline.rules.ts";
import { reclippedCoverage, reclippedShading } from "./Shading.rules.ts";
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
  outlineSpacingFindings,
  purityFindings,
  shadingBandLadderFindings,
  shadingCoverageFindings,
  shadingLoneLineFindings,
  shadingOutlineClearanceFindings,
  shadingSpacingFindings,
  structuralFindings,
} from "./Validation.rules.ts";
import { ValidationOptions, ValidationReport } from "./Validation.schemas.ts";
import { cameraForView, FigureSetSpec, PictorialProjection } from "./View.schemas.ts";
import type { EdgeSet, ShadingBand, ShadingCoverage } from "./Geometry.schemas.ts";
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

const sameFamily = (a: string, b: string): boolean => Str.toLowerCase(a) === Str.toLowerCase(b);

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
 * import { RenderRequest } from "@beep/technical-drawing/FigureSet.service"
 *
 * console.log(RenderRequest.make({ specPath: "spec.json", outputDir: "out" }).validate)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RenderRequest extends S.Opaque<RenderRequest, { readonly brand: unique symbol }>()(
  S.Struct({
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
  }).pipe(
    $I.annoteSchema("RenderRequest", {
      description:
        "Spec path, output directory, sheet options, validation and shading switches, and the part-overlap override of a render.",
    })
  )
) {}

/**
 * Runtime shape of the {@link FigureSet} service.
 *
 * **Example** (Stub service)
 *
 * ```ts
 * import type { FigureSetShape } from "@beep/technical-drawing/FigureSet.service"
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

// decision: render-reads-validation-defaults
const validationDefaults = ValidationOptions.make({ expectedPages: O.none() });
const shadingClearanceFloorMm = validationDefaults.minShadingSpacingMm;
const shadingLadderReachMm = validationDefaults.ladderReachMm;
const outlineSpacingMm = validationDefaults.minOutlineSpacingMm;
const outlineOverlapMm = validationDefaults.minOutlineOverlapMm;

const toModelAt =
  (scale: number) =>
  (mm: number): number =>
    (mm * PT_PER_MM) / scale;

const shadingClearanceMm = (sheet: SheetOptions): number =>
  Math.max(sheet.shadingMinPitchMm / 2, shadingClearanceFloorMm);

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
  const toModel = toModelAt(scale);
  return input.project(
    ShadingPlan.make({
      minPitch: toModel(sheet.shadingMinPitchMm),
      maxPitch: toModel(Math.max(sheet.shadingMaxPitchMm, sheet.shadingMinPitchMm)),
      litThreshold: sheet.shadingLitThreshold,
      style: sheet.shadingStyle,
      axis: sheet.shadingAxis,
      minFaceSpan: toModel(sheet.shadingMinFaceSpanMm),
      minStroke: toModel(sheet.shadingMinStrokeMm),
      clearance: O.some(toModel(shadingClearanceMm(sheet))),
      ladderReach: O.some(toModel(shadingLadderReachMm)),
    })
  );
};

const drawnSegments = (edges: {
  readonly visible: ReadonlyArray<Segment2>;
  readonly broken: ReadonlyArray<Segment2>;
  readonly emphasis: ReadonlyArray<Segment2>;
}): ReadonlyArray<Segment2> => [...edges.visible, ...edges.broken, ...edges.emphasis];

const outlineSpacingMarginMm = 0.005;
const edgeCoordinateStep = 0.001;

const separatedOutline = (edges: EdgeSet, scale: number) => {
  const toModel = toModelAt(scale);
  const separated = separateCloseOutlines({
    segments: edges.visible,
    broken: edges.broken,
    emphasis: edges.emphasis,
    minSpacing: toModel(outlineSpacingMm + outlineSpacingMarginMm),
    minOverlap: toModel(outlineOverlapMm),
    coincidence: toModel(OUTLINE_COINCIDENCE_MM),
    quantum: edgeCoordinateStep,
  });
  return {
    visible: separated.segments,
    broken: separated.broken,
    emphasis: separated.emphasis,
    moves: separated.moves,
  };
};

const sameSegment = A.makeEquivalence(Equivalence.Number);

const movedLines = (edges: EdgeSet, outline: ReturnType<typeof separatedOutline>): ReadonlyArray<Segment2> =>
  A.flatMap(
    [
      A.zip(edges.visible, outline.visible),
      A.zip(edges.broken, outline.broken),
      A.zip(edges.emphasis, outline.emphasis),
    ],
    flow(
      A.filter(([before, after]) => !sameSegment(before, after)),
      A.map(([, after]) => after)
    )
  );

// decision: sheet-shading-rules-graded-only
const clippedShading = (input: {
  readonly shaded: O.Option<EdgeSet>;
  readonly moved: ReadonlyArray<Segment2>;
  readonly sheet: SheetOptions;
  readonly scale: number;
}): ReturnType<typeof reclippedShading> => {
  const toModel = toModelAt(input.scale);
  const strokes = O.match(input.shaded, { onNone: A.empty<Segment2>, onSome: (view) => view.shading });
  return input.sheet.shadingStyle === "graded"
    ? reclippedShading({
        segments: strokes,
        bands: O.match(input.shaded, { onNone: A.empty<ShadingBand>, onSome: (view) => view.shadingBands }),
        lines: input.moved,
        clearance: toModel(shadingClearanceMm(input.sheet)),
        minStroke: toModel(input.sheet.shadingMinStrokeMm),
      })
    : { segments: strokes, trimmed: 0, dropped: 0, droppedAt: [] };
};

const drawnCoverage = (shaded: O.Option<EdgeSet>, droppedAt: ReadonlyArray<number>): O.Option<ShadingCoverage> =>
  O.flatMap(shaded, (view) =>
    O.map(view.shadingCoverage, (coverage) =>
      reclippedCoverage({ coverage, bands: view.shadingBands, dropped: droppedAt })
    )
  );

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
      A.length(shown.emphasis) === A.length(omitted.emphasis) &&
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
        const purity = yield* Effect.forEach(
          PURITY_DPIS,
          (dpi) =>
            pdf
              .measurePage({ pdfPath, page, dpi, antiAlias: false })
              .pipe(Effect.map((metrics) => purityFindings({ page, metrics, options }))),
          { concurrency: 1 }
        );
        return [...marginFindings({ page, metrics: margins }), ...A.flatten(purity)];
      }),
      { concurrency: 1 }
    );
    const textFindings = A.isReadonlyArrayNonEmpty(options.textLabels)
      ? yield* Effect.forEach(
          pages,
          (page) =>
            pdf
              .pageText(resolved, page)
              .pipe(Effect.map((text) => labelTextFindings({ page, pages: A.length(pages), text, options }))),
          { concurrency: 1 }
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

  const loadLabelFont = Effect.fnUntraced(function* (style: LabelStyle, fontFile: string) {
    const bytes = yield* readFont(fontFile);
    const face = yield* faceOf(style, fontFile, bytes);
    return { record: LabelFontRecord.make({ fontFile, sha256: yield* sha256Hex(bytes) }), face };
  });

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
      }),
      { concurrency: 1 }
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
    const resolved = yield* Effect.forEach(A.dedupe(A.map(texts, ({ style }) => labelFontFamily(style))), resolve, {
      concurrency: 1,
    });
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
      pins: yield* Effect.forEach(
        resolved,
        (font) =>
          Effect.map(sha256Hex(font.bytes), (digest) =>
            FontPin.make({ family: font.requested, file: font.file, sha256: digest })
          ),
        { concurrency: 1 }
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
    const model = yield* engine.summarize(ModelSpec.make(spec.model));
    if (model.partOverlaps > 0 && !request.allowPartOverlaps) {
      return yield* DrawingError.make({
        reason: "geometry",
        message: `${model.partOverlaps} pair(s) of parts overlap; fix the model so parts only touch, or set allowPartOverlaps to render anyway.`,
      });
    }
    const sheet = O.getOrElse(spec.sheet, () => request.sheet);
    const sheetNumberFont = yield* labelFace(sheet.sheetNumberLabel);
    const figureFont = yield* labelFace(sheet.figureLabel);
    const textFonts = yield* resolveTextFonts(sheet);
    const textFaces = O.map(textFonts, (t) => t.faces);
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
        elevationDeg: spec.pictorialElevationDeg,
        focusDiagonals: spec.pictorialFocusDiagonals,
        planFacing: spec.planFacing,
      })
    );
    const projected = yield* engine.project(ModelSpec.make(spec.model), cameras, O.none());
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
    const figureEdges = yield* Effect.forEach(spec.figures, (_, index) => edgesOf(index), { concurrency: 1 });
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
      }),
      { concurrency: 1 }
    );
    const scale = commonScale({ views: A.map(figureEdges, drawnSegments), options: sheet, faces });
    const shading = yield* shadingFor({
      shade: request.shade,
      sheet,
      scale,
      project: (plan) =>
        engine.project(ModelSpec.make(spec.model), A.take(cameras, A.length(spec.figures)), O.some(plan)),
    });
    const outputDir = path.resolve(request.outputDir);
    yield* fs
      .makeDirectory(outputDir, { recursive: true })
      .pipe(Effect.mapError(io(`Could not create "${outputDir}".`)));
    const sheets = A.length(spec.figures);
    const mm = scale / PT_PER_MM;
    const drawn = A.map(figureEdges, (edges, index) => {
      const outline = separatedOutline(edges, scale);
      const shaded = A.get(shading, index);
      const strokes = clippedShading({
        shaded,
        moved: movedLines(edges, outline),
        sheet,
        scale,
      });
      return { edges, outline, strokes, coverage: drawnCoverage(shaded, strokes.droppedAt) };
    });
    const figures = yield* Effect.forEach(
      A.zip(spec.figures, drawn),
      Effect.fnUntraced(function* (
        [figure, { edges, outline, strokes, coverage }]: readonly [FigureSpec, (typeof drawn)[number]],
        index: number
      ) {
        const svg = composeSheet({
          segments: outline.visible,
          shading: strokes.segments,
          broken: outline.broken,
          emphasis: outline.emphasis,
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
          shadingSegments: A.length(strokes.segments),
          brokenSegments: A.length(edges.broken),
          // decision: additions-keep-earlier-output-byte-identical
          emphasisSegments: A.isReadonlyArrayNonEmpty(edges.emphasis) ? O.some(A.length(edges.emphasis)) : O.none(),
          camera: A.get(cameras, index),
          shadingCoverage: coverage,
          outlineSeparations: A.match(outline.moves, {
            onEmpty: O.none,
            onNonEmpty: (moves) =>
              OutlineSeparation.makeOption({
                lines: A.length(moves),
                largestMoveMm: A.max(moves, Order.Number) * mm,
                trimmedStrokes: strokes.trimmed,
                droppedStrokes: strokes.dropped,
              }),
          }),
        });
      }),
      { concurrency: 1 }
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
    const inMm = (segments: ReadonlyArray<Segment2>) =>
      A.map(segments, ([x1, y1, x2, y2]) => Segment2.make([x1 * mm, y1 * mm, x2 * mm, y2 * mm]));
    const outlineFindings = A.flatMap(drawn, ({ outline }, index) =>
      outlineSpacingFindings({
        page: index + 1,
        segmentsMm: inMm(drawnSegments(outline)),
        options: validationOptions,
      })
    );
    // decision: sheet-shading-rules-graded-only
    const graded = sheet.shadingStyle === "graded";
    const shadingFindings = A.flatMap(
      A.zip(shading, drawn),
      ([view, { strokes, coverage }]: readonly [EdgeSet, (typeof drawn)[number]], index: number) => {
        const page = index + 1;
        const shadingMm = inMm(strokes.segments);
        const outlineMm = inMm(drawnSegments(separatedOutline(view, scale)));
        const gradedFindings = graded
          ? [
              ...shadingOutlineClearanceFindings({ page, shadingMm, outlineMm, options: validationOptions }),
              ...shadingLoneLineFindings({ page, shadingMm, outlineMm, options: validationOptions }),
              ...shadingBandLadderFindings({ page, shadingMm, outlineMm, options: validationOptions }),
              ...O.match(coverage, {
                onNone: A.empty<SheetFinding>,
                onSome: (sheetCoverage) => shadingCoverageFindings({ page, coverage: sheetCoverage }),
              }),
            ]
          : A.empty<SheetFinding>();
        return [
          ...shadingSpacingFindings({ page, segmentsMm: shadingMm, options: validationOptions }),
          ...gradedFindings,
        ];
      }
    );
    const validation = request.validate
      ? yield* Effect.asSome(
          validate(pdfPath, validationOptions).pipe(
            Effect.map((report) =>
              ValidationReport.make({
                ...report,
                findings: [...report.findings, ...outlineFindings, ...shadingFindings],
              })
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
 * **Details**
 *
 * A text label's family resolves as fontconfig does: family names compare
 * without case, and the font directory is searched recursively for the one
 * Regular file of that family. Those files' own metrics place the labels, and
 * their sha256, like each outlined label font's, is pinned in the manifest.
 * Drawn outlines that run side by side closer than the least spacing would
 * print as one line of the emphasis weight, so after the common scale the
 * sheet opens them to it ({@link separateCloseOutlines}), keeping both lines
 * (review loop 4, O-01). Validation checks text labels in the PDF's extracted
 * text, which a missing font leaves empty, and checks shading on the render's
 * own vectors, in mm on the sheet: line spacing, stroke ends clear of
 * outlines, no stroke alone beside an outline, no band reading as one ladder
 * with the lines beyond its edge, and no face or stretch that planned lines
 * and drew none, the re-clip's losses included.
 *
 * **Gotchas**
 *
 * Label font files are read before the model is projected, so a bad font
 * fails the render fast.
 *
 * **Example** (Reference the service)
 *
 * ```ts
 * import { FigureSet } from "@beep/technical-drawing/FigureSet.service"
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
   * import { FigureSet } from "@beep/technical-drawing/FigureSet.service"
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
