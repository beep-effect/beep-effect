/**
 * Schemas of the measurements the critic pack carries for read-only
 * reviewers: the PDF facts of the sheet set and, per figure SVG, the ink box
 * against the 37 CFR 1.84(g) margins, the path layers, the shading strokes,
 * and the text labels.
 *
 * **Details**
 *
 * A reviewer whose only tool is a file reader cannot run `pdfinfo`,
 * `pdffonts`, or a ruler. `beep drawings critics pack` measures these facts
 * once and writes them beside the drawings as `render/measurements.json`
 * ({@link CriticMeasurements}) and `render/MEASUREMENTS.md`. Lengths are in
 * millimetres (72 pt = 25.4 mm) and sheet positions are measured from the
 * page's top-left corner.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { StreamCheck, UndecodableStream } from "@beep/pdf-tools";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FigureNumber } from "./Drawings.review.schemas.ts";

const $I = $RepoCliId.create("commands/Drawings/Drawings.measurements.schemas");

const Mm = (description: string) => S.Finite.annotateKey({ description });
const OptionalMm = (description: string) => S.OptionFromNullOr(S.Finite).annotateKey({ description });

/**
 * One page box of the sheet-set PDF (MediaBox or CropBox): its corners in
 * points as the PDF states them, and its size in points and millimetres.
 *
 * **Example** (A US Letter MediaBox)
 *
 * ```ts
 * import { CriticPdfBox } from "@beep/repo-cli/commands/Drawings"
 *
 * const box = CriticPdfBox.make({ leftPt: 0, bottomPt: 0, rightPt: 612, topPt: 792, widthPt: 612, heightPt: 792, widthMm: 215.9, heightMm: 279.4 })
 * console.log(box.widthMm) // 215.9
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticPdfBox extends S.Opaque<CriticPdfBox, { readonly brand: unique symbol }>()(
  S.Struct({
    leftPt: S.Finite.annotateKey({ description: "Lower-left x, in points." }),
    bottomPt: S.Finite.annotateKey({ description: "Lower-left y, in points." }),
    rightPt: S.Finite.annotateKey({ description: "Upper-right x, in points." }),
    topPt: S.Finite.annotateKey({ description: "Upper-right y, in points." }),
    widthPt: S.Finite.annotateKey({ description: "Width, in points." }),
    heightPt: S.Finite.annotateKey({ description: "Height, in points." }),
    widthMm: Mm("Width, in millimetres."),
    heightMm: Mm("Height, in millimetres."),
  }).pipe($I.annoteSchema("CriticPdfBox", { description: "Corners and size of one PDF page box." }))
) {}

/**
 * The MediaBox and CropBox of one page of the sheet-set PDF.
 *
 * **Example** (A page whose CropBox is its MediaBox)
 *
 * ```ts
 * import { CriticPdfBox, CriticPdfPage } from "@beep/repo-cli/commands/Drawings"
 *
 * const letter = CriticPdfBox.make({ leftPt: 0, bottomPt: 0, rightPt: 612, topPt: 792, widthPt: 612, heightPt: 792, widthMm: 215.9, heightMm: 279.4 })
 * console.log(CriticPdfPage.make({ page: 1, mediaBox: letter, cropBox: letter }).page) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticPdfPage extends S.Opaque<CriticPdfPage, { readonly brand: unique symbol }>()(
  S.Struct({
    page: S.Int.check(S.isGreaterThanOrEqualTo(1)).annotateKey({ description: "One-based page number." }),
    mediaBox: CriticPdfBox.annotateKey({ description: "The page's MediaBox." }),
    cropBox: CriticPdfBox.annotateKey({ description: "The page's CropBox; the MediaBox when the page sets none." }),
  }).pipe($I.annoteSchema("CriticPdfPage", { description: "Page number, MediaBox, and CropBox of one PDF page." }))
) {}

/**
 * One font the sheet-set PDF references, as `pdffonts` lists it.
 *
 * **Example** (An embedded subset TrueType font)
 *
 * ```ts
 * import { CriticPdfFont } from "@beep/repo-cli/commands/Drawings"
 *
 * const font = CriticPdfFont.make({ name: "ABCDEF+DejaVuSans", type: "TrueType", embedded: true, subset: true })
 * console.log(font.subset) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticPdfFont extends S.Opaque<CriticPdfFont, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString.annotateKey({ description: "BaseFont name, subset tag included." }),
    type: S.String.annotateKey({ description: "Font type (TrueType, Type 1C, CID TrueType, …)." }),
    embedded: S.Boolean.annotateKey({ description: "Whether the font program is embedded." }),
    subset: S.Boolean.annotateKey({ description: "Whether the embedded program is a subset." }),
  }).pipe(
    $I.annoteSchema("CriticPdfFont", { description: "Name, type, and embedding of one font of the sheet-set PDF." })
  )
) {}

/**
 * What the harness measured of the sheet-set PDF: version, page count, the
 * page boxes, the fonts, and the FlateDecode streams a strict inflate
 * refuses.
 *
 * **Details**
 *
 * The version, page count, and undecodable streams come from
 * `@beep/pdf-tools` `inspect`; the page boxes from `pdfinfo -box`; the fonts
 * from `pdffonts`. The undecodable-stream list is globally complete only when
 * both `streamCheck` and `containerDiscovery` are `complete`.
 *
 * **Example** (A clean one-page PDF)
 *
 * ```ts
 * import { CriticPdfBox, CriticPdfMeasurements, CriticPdfPage } from "@beep/repo-cli/commands/Drawings"
 *
 * const letter = CriticPdfBox.make({ leftPt: 0, bottomPt: 0, rightPt: 612, topPt: 792, widthPt: 612, heightPt: 792, widthMm: 215.9, heightMm: 279.4 })
 * const pdf = CriticPdfMeasurements.make({
 *   file: "render/sheets.pdf",
 *   version: "1.6",
 *   pageCount: 1,
 *   pages: [CriticPdfPage.make({ page: 1, mediaBox: letter, cropBox: letter })],
 *   fonts: [],
 *   undecodableStreams: [],
 *   streamCheck: "complete",
 * })
 * console.log(pdf.version) // "1.6"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticPdfMeasurements extends S.Opaque<CriticPdfMeasurements, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.NonEmptyString.annotateKey({ description: "Pack-relative PDF the facts were read from." }),
    version: S.String.annotateKey({ description: "Version from the `%PDF-` header line." }),
    pageCount: S.Natural.annotateKey({ description: "Number of pages." }),
    pages: S.Array(CriticPdfPage).annotateKey({ description: "MediaBox and CropBox of every page, in order." }),
    fonts: S.Array(CriticPdfFont).annotateKey({ description: "Every font the pages reference." }),
    undecodableStreams: S.Array(UndecodableStream).annotateKey({
      description: "FlateDecode streams a strict inflate refuses, in object order.",
    }),
    containerDiscovery: StreamCheck.pipe(
      S.withConstructorDefault(Effect.succeed("complete" as const)),
      S.annotateKey({
        description: "Raw object/cross-reference container discovery completeness, separate from the inflate check.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed("complete" as const))
    ),
    streamCheck: StreamCheck.annotateKey({
      description:
        "Whether every discovered FlateDecode stream was checked, none (encrypted), or only those before the inflate limit.",
    }),
  }).pipe(
    $I.annoteSchema("CriticPdfMeasurements", {
      description: "Version, page count, page boxes, fonts, and undecodable streams of the sheet-set PDF.",
    })
  )
) {}

/**
 * The distance from the ink to one sheet edge against the 37 CFR 1.84(g)
 * minimum margin of that edge.
 *
 * **Example** (A left margin that holds)
 *
 * ```ts
 * import { CriticEdgeClearance } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticEdgeClearance.make({ distanceMm: 31.2, minimumMm: 25, meets: true }).meets) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticEdgeClearance extends S.Opaque<CriticEdgeClearance, { readonly brand: unique symbol }>()(
  S.Struct({
    distanceMm: Mm("Distance from the ink to the sheet edge, in mm."),
    minimumMm: Mm("The 37 CFR 1.84(g) minimum margin of that edge, in mm."),
    meets: S.Boolean.annotateKey({ description: "Whether the distance is at least the minimum." }),
  }).pipe(
    $I.annoteSchema("CriticEdgeClearance", {
      description: "Distance from the ink to one sheet edge, the 1.84(g) minimum, and whether it holds.",
    })
  )
) {}

/**
 * The bounding box of a figure's ink in sheet millimetres, and its distance
 * to each sheet edge against the 37 CFR 1.84(g) margins (top 2.5 cm, left
 * 2.5 cm, right 1.5 cm, bottom 1.0 cm).
 *
 * **Details**
 *
 * Stroked paths are widened by half their stroke width, so the box is the
 * edge of the ink, not of the centrelines. `<text>` elements are not in the
 * box: their glyph extents depend on the font.
 *
 * **Example** (A box clear of every margin)
 *
 * ```ts
 * import { CriticEdgeClearance, CriticInkBox } from "@beep/repo-cli/commands/Drawings"
 *
 * const clear = (distanceMm: number, minimumMm: number) => CriticEdgeClearance.make({ distanceMm, minimumMm, meets: distanceMm >= minimumMm })
 * const box = CriticInkBox.make({
 *   minXMm: 40, minYMm: 40, maxXMm: 180, maxYMm: 250, widthMm: 140, heightMm: 210,
 *   top: clear(40, 25), left: clear(40, 25), right: clear(35.9, 15), bottom: clear(29.4, 10),
 * })
 * console.log(box.right.meets) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticInkBox extends S.Opaque<CriticInkBox, { readonly brand: unique symbol }>()(
  S.Struct({
    minXMm: Mm("Left edge of the ink, mm from the page's left edge."),
    minYMm: Mm("Top edge of the ink, mm from the page's top edge."),
    maxXMm: Mm("Right edge of the ink, mm from the page's left edge."),
    maxYMm: Mm("Bottom edge of the ink, mm from the page's top edge."),
    widthMm: Mm("Width of the ink, in mm."),
    heightMm: Mm("Height of the ink, in mm."),
    top: CriticEdgeClearance.annotateKey({ description: "Clearance to the top edge (minimum 2.5 cm)." }),
    left: CriticEdgeClearance.annotateKey({ description: "Clearance to the left edge (minimum 2.5 cm)." }),
    right: CriticEdgeClearance.annotateKey({ description: "Clearance to the right edge (minimum 1.5 cm)." }),
    bottom: CriticEdgeClearance.annotateKey({ description: "Clearance to the bottom edge (minimum 1.0 cm)." }),
  }).pipe(
    $I.annoteSchema("CriticInkBox", {
      description: "Ink bounding box in sheet mm and its clearance to each edge against the 1.84(g) margins.",
    })
  )
) {}

/**
 * **Details**
 *
 * Each line, curve, or closing command that draws counts as one segment;
 * curves are measured along a flattened polyline. A filled layer (the
 * outlined labels) has no stroke width.
 *
 * **Example** (The visible outlines)
 *
 * ```ts
 * import { CriticPathLayer } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const layer = CriticPathLayer.make({ id: "figure", strokeWidthMm: O.some(0.35), dashArrayMm: [], segments: 226, lengthMm: 1204.5 })
 * console.log(layer.id) // "figure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticPathLayer extends S.Opaque<CriticPathLayer, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString.annotateKey({ description: "The path's id, or path-<n> when it has none." }),
    strokeWidthMm: OptionalMm("Stroke width in mm; null for an unstroked (filled) path."),
    dashArrayMm: S.Array(S.Finite).annotateKey({ description: "Dash pattern in mm; empty for a solid line." }),
    segments: S.Natural.annotateKey({ description: "Drawn segments (lines, curves, closings)." }),
    lengthMm: Mm("Total drawn length, in mm."),
  }).pipe(
    $I.annoteSchema("CriticPathLayer", {
      description: "Id, stroke width, dash pattern, segment count, and drawn length of one SVG path layer.",
    })
  )
) {}

/**
 * Statistics of a figure's shading strokes: how many, their lengths, and the
 * smallest gap between parallel neighbours.
 *
 * **Details**
 *
 * Two strokes are parallel neighbours when their directions differ by at
 * most 2.5° and their extents along their bisector overlap, so the hatch
 * strokes of a converging pictorial's face, which turn a little from one to
 * the next, still pair. The gap is measured at the middle of that overlap,
 * from each stroke to the other's line, and averaged. Pieces of one broken
 * line do not overlap and are not neighbours. Every length is `null` when
 * the figure has no shading.
 *
 * **Example** (A figure without shading)
 *
 * ```ts
 * import { CriticShadingStats } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const none = CriticShadingStats.make({ count: 0, minLengthMm: O.none(), medianLengthMm: O.none(), maxLengthMm: O.none(), minParallelGapMm: O.none() })
 * console.log(none.count) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticShadingStats extends S.Opaque<CriticShadingStats, { readonly brand: unique symbol }>()(
  S.Struct({
    count: S.Natural.annotateKey({ description: "Number of shading strokes." }),
    minLengthMm: OptionalMm("Shortest stroke, in mm; null without shading."),
    medianLengthMm: OptionalMm("Median stroke length, in mm; null without shading."),
    maxLengthMm: OptionalMm("Longest stroke, in mm; null without shading."),
    minParallelGapMm: OptionalMm(
      "Smallest perpendicular gap between facing strokes whose directions differ by at most 2.5°, in mm; null when none."
    ),
  }).pipe(
    $I.annoteSchema("CriticShadingStats", {
      description: "Count, length extremes and median, and the smallest parallel gap of a figure's shading strokes.",
    })
  )
) {}

/**
 * One `<text>` label of a figure SVG: what it says, its font, size, and
 * anchor position on the sheet.
 *
 * **Example** (A FIG. label)
 *
 * ```ts
 * import { CriticTextLabel } from "@beep/repo-cli/commands/Drawings"
 *
 * const label = CriticTextLabel.make({ text: "FIG. 1", fontFamily: "DejaVu Sans", sizePt: 12, xMm: 107.95, yMm: 262.1, anchor: "middle" })
 * console.log(label.text) // "FIG. 1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticTextLabel extends S.Opaque<CriticTextLabel, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.annotateKey({ description: "The label's text." }),
    fontFamily: S.String.annotateKey({ description: "The `font-family` the element requests." }),
    sizePt: S.Finite.annotateKey({ description: "Font size, in points." }),
    xMm: Mm("Anchor x, mm from the page's left edge."),
    yMm: Mm("Baseline y, mm from the page's top edge."),
    anchor: S.String.annotateKey({ description: "The `text-anchor` (start, middle, end)." }),
  }).pipe(
    $I.annoteSchema("CriticTextLabel", {
      description: "Text, font family, size, anchor position, and anchor of one SVG text label.",
    })
  )
) {}

/**
 * What the harness measured of one figure SVG: the sheet size, the ink box
 * of the view (`drawing`, label layers excluded) and of every path (`ink`)
 * against the margins, the path layers, the shading strokes, and the text
 * labels.
 *
 * **Example** (A figure with nothing drawn)
 *
 * ```ts
 * import { CriticFigureMeasurements, CriticShadingStats } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const empty = CriticFigureMeasurements.make({
 *   figure: 1, view: "front", svg: "render/fig-1.svg", sheetWidthMm: 215.9, sheetHeightMm: 279.4,
 *   drawing: O.none(), ink: O.none(), layers: [], labels: [],
 *   shading: CriticShadingStats.make({ count: 0, minLengthMm: O.none(), medianLengthMm: O.none(), maxLengthMm: O.none(), minParallelGapMm: O.none() }),
 * })
 * console.log(O.isNone(empty.ink)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticFigureMeasurements extends S.Opaque<CriticFigureMeasurements, { readonly brand: unique symbol }>()(
  S.Struct({
    figure: FigureNumber.annotateKey({ description: "FIG. number (the PDF page it sits on)." }),
    view: S.NonEmptyString.annotateKey({ description: "View name from the render manifest." }),
    svg: S.NonEmptyString.annotateKey({ description: "Pack-relative SVG the figure was measured from." }),
    sheetWidthMm: Mm("Sheet width, in mm."),
    sheetHeightMm: Mm("Sheet height, in mm."),
    drawing: S.OptionFromNullOr(CriticInkBox).annotateKey({
      description: "Ink box of the view's own layers (every path but labels and label-outlines); null when empty.",
    }),
    ink: S.OptionFromNullOr(CriticInkBox).annotateKey({
      description: "Ink box of every path layer, labels included; null when the sheet draws nothing.",
    }),
    layers: S.Array(CriticPathLayer).annotateKey({ description: "Every path layer, in drawing order." }),
    shading: CriticShadingStats.annotateKey({ description: "Statistics of the shading strokes." }),
    labels: S.Array(CriticTextLabel).annotateKey({ description: "Every text label, in document order." }),
  }).pipe(
    $I.annoteSchema("CriticFigureMeasurements", {
      description: "Sheet size, ink boxes against the margins, path layers, shading stats, and labels of one figure.",
    })
  )
) {}

/**
 * The measurements a critic pack carries for read-only reviewers, written as
 * `render/measurements.json` (and rendered as `render/MEASUREMENTS.md`).
 *
 * **Details**
 *
 * Computed by `beep drawings critics pack` from the sheet-set PDF and the
 * figure SVGs it copies into the pack, so a reviewer limited to reading files
 * cites measured numbers instead of guessing them.
 *
 * **Example** (A set with no figures)
 *
 * ```ts
 * import { CriticMeasurements, CriticPdfMeasurements } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const measurements = CriticMeasurements.make({
 *   schemaVersion: "drawing-critic-measurements/v1",
 *   title: "Bracket",
 *   sheetSetSha256: Sha256Hex.make("a".repeat(64)),
 *   specSha256: Sha256Hex.make("b".repeat(64)),
 *   pdf: CriticPdfMeasurements.make({ file: "render/sheets.pdf", version: "1.6", pageCount: 0, pages: [], fonts: [], undecodableStreams: [], streamCheck: "complete" }),
 *   figures: [],
 * })
 * console.log(measurements.pdf.version) // "1.6"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticMeasurements extends S.Opaque<CriticMeasurements, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("drawing-critic-measurements/v1").annotateKey({ description: "Schema version." }),
    title: S.NonEmptyString.annotateKey({ description: "Title from the render manifest." }),
    sheetSetSha256: Sha256Hex.annotateKey({ description: "Hash of the sheet-set PDF measured." }),
    specSha256: Sha256Hex.annotateKey({ description: "Hash of the spec the set was rendered from." }),
    pdf: CriticPdfMeasurements.annotateKey({ description: "Facts of the sheet-set PDF." }),
    figures: S.Array(CriticFigureMeasurements).annotateKey({ description: "Every figure, in FIG. order." }),
  }).pipe(
    $I.annoteSchema("CriticMeasurements", {
      description: "PDF facts and per-figure margins, layers, shading stats, and labels of a critic pack's render.",
    })
  )
) {}

const measurementsCodec = S.fromJsonString(CriticMeasurements);
const decodeCriticMeasurementsJson = S.decodeEffect(measurementsCodec);
const encodeCriticMeasurementsJson = S.encodeEffect(measurementsCodec);

/**
 * Decode `render/measurements.json` text.
 *
 * **Example** (A set with no figures)
 *
 * ```ts
 * import { decodeCriticMeasurements } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * const text = JSON.stringify({
 *   schemaVersion: "drawing-critic-measurements/v1", title: "Bracket", sheetSetSha256: "a".repeat(64), specSha256: "b".repeat(64),
 *   pdf: { file: "render/sheets.pdf", version: "1.6", pageCount: 0, pages: [], fonts: [], undecodableStreams: [], streamCheck: "complete" },
 *   figures: [],
 * })
 * Effect.runPromise(decodeCriticMeasurements(text)).then((m) => console.log(m.title)) // "Bracket"
 * ```
 *
 * @param text - The text of a `measurements.json` file.
 * @returns An effect that decodes the measurements; it fails when the text does not match `drawing-critic-measurements/v1`.
 * @category decoding
 * @since 0.0.0
 */
export const decodeCriticMeasurements = (text: string) => decodeCriticMeasurementsJson(text);

/**
 * Encode measurements as `render/measurements.json` text.
 *
 * **Example** (Round-trip through JSON)
 *
 * ```ts
 * import { decodeCriticMeasurements, encodeCriticMeasurements } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * const text = JSON.stringify({
 *   schemaVersion: "drawing-critic-measurements/v1", title: "Bracket", sheetSetSha256: "a".repeat(64), specSha256: "b".repeat(64),
 *   pdf: { file: "render/sheets.pdf", version: "1.6", pageCount: 0, pages: [], fonts: [], undecodableStreams: [], streamCheck: "complete" },
 *   figures: [],
 * })
 * Effect.runPromise(Effect.flatMap(decodeCriticMeasurements(text), encodeCriticMeasurements)).then(console.log)
 * ```
 *
 * @param measurements - The measurements to write.
 * @returns An effect that encodes the measurements as `measurements.json` text.
 * @category encoding
 * @since 0.0.0
 */
export const encodeCriticMeasurements = (measurements: CriticMeasurements) =>
  encodeCriticMeasurementsJson(measurements);
