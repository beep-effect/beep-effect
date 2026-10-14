/**
 * Request and result models for the PDF tools driver: SVG → PDF conversion,
 * PDF structure inspection, page raster metrics, and the markup-reading verbs
 * (text blocks, raster ink coverage, annotations).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PdfToolsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $PdfToolsId.create("PdfTools.models");

const PdfVersionBase = LiteralKit(["1.4", "1.5", "1.6", "1.7"]);

/**
 * PDF versions `rsvg-convert` can be asked to emit.
 *
 * **Example** (Read the versions)
 *
 * ```ts
 * import { PdfVersion } from "@beep/pdf-tools"
 *
 * console.log(PdfVersion.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PdfVersion = PdfVersionBase.pipe(
  $I.annoteSchema("PdfVersion", {
    description: "PDF version selectable on rsvg-convert output.",
  }),
  SchemaUtils.withLiteralKitStatics(PdfVersionBase)
);

/**
 * Type for {@link PdfVersion}.
 *
 * **Example** (Annotate a version)
 *
 * ```ts
 * import type { PdfVersion } from "@beep/pdf-tools"
 *
 * const v: PdfVersion = "1.6"
 * console.log(v)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PdfVersion = typeof PdfVersion.Type;

/**
 * One-based page number.
 *
 * **Example** (Make a page number)
 *
 * ```ts
 * import { PageNumber } from "@beep/pdf-tools"
 *
 * console.log(PageNumber.make(1))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PageNumber = S.Int.check(
  S.isGreaterThanOrEqualTo(1, {
    identifier: $I`PageNumberCheck`,
    title: "Page Number",
    description: "PDF pages are numbered from one.",
    message: "Expected a page number of at least 1",
  })
).pipe(
  $I.annoteSchema("PageNumber", {
    description: "One-based PDF page number.",
  })
);

/**
 * Type for {@link PageNumber}.
 *
 * **Example** (Annotate a page number)
 *
 * ```ts
 * import { PageNumber } from "@beep/pdf-tools"
 *
 * const page: PageNumber = PageNumber.make(3)
 * console.log(page)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PageNumber = typeof PageNumber.Type;

/**
 * Raster resolution in dots per inch.
 *
 * **Example** (Make a dpi)
 *
 * ```ts
 * import { Dpi } from "@beep/pdf-tools"
 *
 * console.log(Dpi.make(300))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Dpi = S.Int.check(
  S.isGreaterThanOrEqualTo(36, {
    identifier: $I`DpiCheck`,
    title: "Dpi",
    description: "Raster resolutions below 36 dpi are not useful for measurement.",
    message: "Expected a resolution of at least 36 dpi",
  })
).pipe(
  $I.annoteSchema("Dpi", {
    description: "Raster resolution in dots per inch.",
  })
);

/**
 * Type for {@link Dpi}.
 *
 * **Example** (Annotate a dpi)
 *
 * ```ts
 * import { Dpi } from "@beep/pdf-tools"
 *
 * const dpi: Dpi = Dpi.make(600)
 * console.log(dpi)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Dpi = typeof Dpi.Type;

const AbsoluteDirectory = S.NonEmptyString.check(
  S.makeFilter(Str.startsWith("/"), {
    identifier: $I`AbsoluteFontDirectoryCheck`,
    title: "Font Directory",
    description: "A pinned font directory is an absolute path.",
    message: "Expected an absolute font directory",
  })
);

/**
 * A font family the converter must bind: the family an SVG requests and the
 * family name of the font file it resolves to.
 *
 * **Example** (Bind Arial)
 *
 * ```ts
 * import { FontFamilyAlias } from "@beep/pdf-tools"
 *
 * console.log(FontFamilyAlias.make({ requested: "Arial", family: "Arial" }).family)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FontFamilyAlias extends S.Class<FontFamilyAlias>($I`FontFamilyAlias`)(
  {
    requested: S.NonEmptyString.annotateKey({ description: "Family name an SVG `font-family` requests." }),
    family: S.NonEmptyString.annotateKey({ description: "Family name of the font file in the pinned directory." }),
  },
  $I.annote("FontFamilyAlias", {
    description: "A requested font family and the pinned family it is bound to.",
  })
) {}

/**
 * Fonts `rsvg-convert` may use: one directory, nothing else, and the family
 * bindings inside it.
 *
 * **Details**
 *
 * The driver writes a fontconfig file whose only font directory is
 * `directory`, with a strong binding per alias, and runs `rsvg-convert` with
 * `FONTCONFIG_FILE` pointing at it. System fonts are never visible, so the
 * embedded fonts depend on the directory's files alone. A family the
 * directory lacks draws nothing (rsvg-convert still exits 0); the caller's
 * validator must check the page text.
 *
 * **Example** (Pin a directory)
 *
 * ```ts
 * import { FontFamilyAlias, PinnedFonts } from "@beep/pdf-tools"
 *
 * const fonts = PinnedFonts.make({
 *   directory: "/fonts",
 *   families: [FontFamilyAlias.make({ requested: "Arial", family: "Arial" })]
 * })
 * console.log(fonts.directory)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PinnedFonts extends S.Class<PinnedFonts>($I`PinnedFonts`)(
  {
    directory: AbsoluteDirectory.annotateKey({ description: "The only directory fonts are read from." }),
    families: S.Array(FontFamilyAlias).annotateKey({ description: "Requested families and their bindings." }),
  },
  $I.annote("PinnedFonts", {
    description: "Font directory and family bindings an SVG to PDF conversion is pinned to.",
  })
) {}

/**
 * What a pinned fontconfig file is written from: the pinned fonts and the
 * directory fontconfig may cache in for the run.
 *
 * **Example** (Request a config for one family)
 *
 * ```ts
 * import { FontFamilyAlias, PinnedFontconfigRequest, PinnedFonts } from "@beep/pdf-tools"
 *
 * const fonts = PinnedFonts.make({
 *   directory: "/fonts",
 *   families: [FontFamilyAlias.make({ requested: "Arial", family: "Arial" })]
 * })
 * console.log(PinnedFontconfigRequest.make({ fonts, cacheDirectory: "/tmp/fc-cache" }).cacheDirectory)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PinnedFontconfigRequest extends S.Class<PinnedFontconfigRequest>($I`PinnedFontconfigRequest`)(
  {
    fonts: PinnedFonts.annotateKey({ description: "The font directory and family bindings to pin." }),
    cacheDirectory: AbsoluteDirectory.annotateKey({ description: "Where fontconfig keeps its cache for this run." }),
  },
  $I.annote("PinnedFontconfigRequest", {
    description: "Pinned fonts and the cache directory a fontconfig file is written from.",
  })
) {}

/**
 * Convert one or more SVG files into one PDF, one page per SVG, in order.
 *
 * **Details**
 *
 * `sourceDateEpoch` is exported as `SOURCE_DATE_EPOCH` so cairo writes a fixed
 * `CreationDate`; the driver always sets it (default 0) so output bytes do not
 * depend on the wall clock. `fonts` pins the fonts `<text>` elements are set
 * in (see {@link PinnedFonts}); without it the host's fontconfig is used.
 *
 * **Example** (Two sheets into one PDF 1.6)
 *
 * ```ts
 * import { SvgToPdfRequest } from "@beep/pdf-tools"
 *
 * const request = SvgToPdfRequest.make({ svgPaths: ["s1.svg", "s2.svg"], outputPath: "out.pdf" })
 * console.log(request.pdfVersion, request.sourceDateEpoch)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SvgToPdfRequest extends S.Class<SvgToPdfRequest>($I`SvgToPdfRequest`)(
  {
    svgPaths: S.Array(S.NonEmptyString)
      .check(
        S.isMinLength(1, {
          identifier: $I`SvgToPdfRequestPagesCheck`,
          title: "SVG Pages",
          description: "A conversion needs at least one SVG page.",
          message: "Expected at least one SVG path",
        })
      )
      .annotateKey({ description: "SVG files, one page each, in page order." }),
    outputPath: S.NonEmptyString.annotateKey({ description: "Destination PDF path; overwritten." }),
    pdfVersion: PdfVersion.pipe(
      S.withConstructorDefault(Effect.succeed("1.6" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("1.6" as const)),
      S.annotateKey({ description: "PDF version to emit. Defaults to 1.6." })
    ),
    sourceDateEpoch: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({ description: "Unix seconds used for the PDF creation date. Defaults to 0." })
    ),
    fonts: S.OptionFromOptionalKey(PinnedFonts).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Font directory and bindings for `<text>`. Absent, the host fontconfig is used." })
    ),
  },
  $I.annote("SvgToPdfRequest", {
    description: "SVG pages to convert into one PDF with a fixed version, creation date, and optional pinned fonts.",
  })
) {}

/**
 * Result of an SVG → PDF conversion.
 *
 * **Example** (Make a result)
 *
 * ```ts
 * import { SvgToPdfResult } from "@beep/pdf-tools"
 *
 * console.log(SvgToPdfResult.make({ outputPath: "out.pdf", pageCount: 2, bytes: 1024 }).pageCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SvgToPdfResult extends S.Class<SvgToPdfResult>($I`SvgToPdfResult`)(
  {
    outputPath: S.NonEmptyString.annotateKey({ description: "Written PDF path." }),
    pageCount: S.Natural.annotateKey({ description: "Pages written." }),
    bytes: S.Natural.annotateKey({ description: "Size of the written PDF in bytes." }),
  },
  $I.annote("SvgToPdfResult", {
    description: "Written PDF path, page count, and size.",
  })
) {}

/**
 * Page size in PDF points.
 *
 * **Example** (US Letter)
 *
 * ```ts
 * import { PageSize } from "@beep/pdf-tools"
 *
 * console.log(PageSize.make({ widthPt: 612, heightPt: 792 }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PageSize extends S.Class<PageSize>($I`PageSize`)(
  {
    widthPt: S.Finite.annotateKey({ description: "MediaBox width in points." }),
    heightPt: S.Finite.annotateKey({ description: "MediaBox height in points." }),
  },
  $I.annote("PageSize", {
    description: "MediaBox size in points.",
  })
) {}

/**
 * A font referenced by a page and whether its program is embedded.
 *
 * **Example** (Make a font entry)
 *
 * ```ts
 * import { PdfFont } from "@beep/pdf-tools"
 *
 * console.log(PdfFont.make({ name: "Helvetica", embedded: false }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PdfFont extends S.Class<PdfFont>($I`PdfFont`)(
  {
    name: S.String.annotateKey({ description: "BaseFont name, possibly subset-prefixed." }),
    embedded: S.Boolean.annotateKey({ description: "Whether a font program is embedded." }),
  },
  $I.annote("PdfFont", {
    description: "Font name and embedding status.",
  })
) {
  /**
   * The BaseFont name without its six-letter subset tag (`ABCDEF+`).
   *
   * **Example** (A subset font)
   *
   * ```ts
   * import { PdfFont } from "@beep/pdf-tools"
   *
   * console.log(PdfFont.make({ name: "ABCDEF+ArialMT", embedded: true }).baseName) // "ArialMT"
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  get baseName(): string {
    return Str.replace(/^[A-Z]{6}\+/, "")(this.name);
  }
}

/**
 * Structural facts about a PDF file.
 *
 * **Example** (Make a structure)
 *
 * ```ts
 * import { PageSize, PdfStructure } from "@beep/pdf-tools"
 *
 * const structure = PdfStructure.make({
 *   headerVersion: "1.6",
 *   pages: [PageSize.make({ widthPt: 612, heightPt: 792 })],
 *   fonts: [],
 *   annotationCount: 0,
 *   hasOptionalContent: false,
 *   encrypted: false
 * })
 * console.log(structure.pages.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PdfStructure extends S.Class<PdfStructure>($I`PdfStructure`)(
  {
    headerVersion: S.String.annotateKey({ description: "Version from the `%PDF-` header line." }),
    pages: S.Array(PageSize).annotateKey({ description: "MediaBox of every page, in order." }),
    fonts: S.Array(PdfFont).annotateKey({ description: "Distinct fonts referenced by page resources." }),
    annotationCount: S.Natural.annotateKey({ description: "Total `/Annots` entries across pages." }),
    hasOptionalContent: S.Boolean.annotateKey({
      description: "Whether the catalog declares layers (`/OCProperties`).",
    }),
    encrypted: S.Boolean.annotateKey({ description: "Whether the file is encrypted." }),
  },
  $I.annote("PdfStructure", {
    description: "Header version, page sizes, fonts, annotations, layers, and encryption of a PDF.",
  })
) {}

/**
 * Request to rasterise one page and measure it.
 *
 * **Details**
 *
 * With `antiAlias` false, poppler renders vector edges without smoothing, so
 * pure-black strokes land as pure black pixels and any gray is real gray.
 *
 * **Example** (Page 1 at 300 dpi, no anti-aliasing)
 *
 * ```ts
 * import { RasterRequest } from "@beep/pdf-tools"
 *
 * const request = RasterRequest.make({ pdfPath: "sheets.pdf", page: 1, dpi: 300, antiAlias: false })
 * console.log(request.blackThreshold)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RasterRequest extends S.Class<RasterRequest>($I`RasterRequest`)(
  {
    pdfPath: S.NonEmptyString.annotateKey({ description: "PDF to rasterise." }),
    page: PageNumber.annotateKey({ description: "One-based page to rasterise." }),
    dpi: Dpi.annotateKey({ description: "Resolution." }),
    antiAlias: S.Boolean.annotateKey({ description: "Whether to anti-alias text and vectors." }),
    blackThreshold: S.Int.pipe(
      S.withConstructorDefault(Effect.succeed(128)),
      S.withDecodingDefaultTypeKey(Effect.succeed(128)),
      S.annotateKey({ description: "Luminance below which a pixel counts as ink (0–255). Defaults to 128." })
    ),
  },
  $I.annote("RasterRequest", {
    description: "One page, resolution, anti-aliasing switch, and ink threshold.",
  })
) {}

/**
 * Pixel bounds of the ink on a page, inclusive, in pixels from the top-left.
 *
 * **Example** (Make a box)
 *
 * ```ts
 * import { PixelBox } from "@beep/pdf-tools"
 *
 * console.log(PixelBox.make({ minX: 10, minY: 10, maxX: 90, maxY: 90 }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PixelBox extends S.Class<PixelBox>($I`PixelBox`)(
  {
    minX: S.Natural.annotateKey({ description: "Leftmost ink column." }),
    minY: S.Natural.annotateKey({ description: "Topmost ink row." }),
    maxX: S.Natural.annotateKey({ description: "Rightmost ink column." }),
    maxY: S.Natural.annotateKey({ description: "Bottommost ink row." }),
  },
  $I.annote("PixelBox", {
    description: "Inclusive pixel bounds of the ink on a page.",
  })
) {}

/**
 * Measurements of one rasterised page.
 *
 * **Details**
 *
 * `impurePixels` counts pixels that are neither pure black `(0,0,0)` nor pure
 * white `(255,255,255)`; `chromaPixels` is the subset whose channels differ.
 * `largestBlackSquare` is the side, in pixels, of the largest square made
 * entirely of ink pixels, a proxy for solid-black regions.
 *
 * **Example** (Make metrics for a blank page)
 *
 * ```ts
 * import { RasterMetrics } from "@beep/pdf-tools"
 * import * as O from "effect/Option"
 *
 * const metrics = RasterMetrics.make({
 *   width: 2550,
 *   height: 3300,
 *   dpi: 300,
 *   inkBox: O.none(),
 *   inkPixels: 0,
 *   impurePixels: 0,
 *   chromaPixels: 0,
 *   largestBlackSquare: 0
 * })
 * console.log(metrics.width)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RasterMetrics extends S.Class<RasterMetrics>($I`RasterMetrics`)(
  {
    width: S.Natural.annotateKey({ description: "Raster width in pixels." }),
    height: S.Natural.annotateKey({ description: "Raster height in pixels." }),
    dpi: Dpi.annotateKey({ description: "Resolution the page was rendered at." }),
    inkBox: S.Option(PixelBox).annotateKey({ description: "Bounds of the ink, or none for a blank page." }),
    inkPixels: S.Natural.annotateKey({ description: "Pixels at or below the ink threshold." }),
    impurePixels: S.Natural.annotateKey({ description: "Pixels that are neither pure black nor pure white." }),
    chromaPixels: S.Natural.annotateKey({ description: "Pixels whose RGB channels differ." }),
    largestBlackSquare: S.Natural.annotateKey({ description: "Side of the largest all-ink square, in pixels." }),
  },
  $I.annote("RasterMetrics", {
    description: "Size, ink bounds, purity counts, and largest solid-ink square of a rendered page.",
  })
) {}

/**
 * Request to render one page to a PNG file.
 *
 * **Example** (Preview page 2)
 *
 * ```ts
 * import { PngRequest } from "@beep/pdf-tools"
 *
 * console.log(PngRequest.make({ pdfPath: "sheets.pdf", page: 2, dpi: 72, outputPath: "page-2.png" }).dpi)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PngRequest extends S.Class<PngRequest>($I`PngRequest`)(
  {
    pdfPath: S.NonEmptyString.annotateKey({ description: "PDF to render." }),
    page: PageNumber.annotateKey({ description: "One-based page to render." }),
    dpi: Dpi.annotateKey({ description: "Resolution." }),
    outputPath: S.NonEmptyString.annotateKey({ description: "Destination PNG path; overwritten." }),
  },
  $I.annote("PngRequest", {
    description: "One page rendered to a PNG file at a resolution.",
  })
) {}

/**
 * Request for the text of one PDF page.
 *
 * **Example** (Page 2)
 *
 * ```ts
 * import { PageTextRequest } from "@beep/pdf-tools"
 *
 * console.log(PageTextRequest.make({ pdfPath: "approval.pdf", page: 2 }).page)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PageTextRequest extends S.Class<PageTextRequest>($I`PageTextRequest`)(
  {
    pdfPath: S.NonEmptyString.annotateKey({ description: "PDF to read." }),
    page: PageNumber.annotateKey({ description: "One-based page whose text is extracted." }),
  },
  $I.annote("PageTextRequest", {
    description: "One page of a PDF whose text is extracted.",
  })
) {}

/**
 * Rectangle on a PDF page in points, measured from the page's top-left corner
 * (the `pdftotext -bbox-layout` convention).
 *
 * **Details**
 *
 * PDF annotation rectangles are stored bottom-left up; the driver converts
 * them to this convention so text boxes and annotations share one frame.
 *
 * **Example** (A one-inch box one inch from the top-left corner)
 *
 * ```ts
 * import { PdfRect } from "@beep/pdf-tools"
 *
 * console.log(PdfRect.make({ xMin: 72, yMin: 72, xMax: 144, yMax: 144 }).xMax)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PdfRect extends S.Class<PdfRect>($I`PdfRect`)(
  {
    xMin: S.Finite.annotateKey({ description: "Left edge, points from the page's left edge." }),
    yMin: S.Finite.annotateKey({ description: "Top edge, points down from the page's top edge." }),
    xMax: S.Finite.annotateKey({ description: "Right edge, points from the page's left edge." }),
    yMax: S.Finite.annotateKey({ description: "Bottom edge, points down from the page's top edge." }),
  },
  $I.annote("PdfRect", {
    description: "Rectangle in points from the page's top-left corner, as pdftotext reports it.",
  })
) {}

/**
 * One block of text on a page with its bounding rectangle.
 *
 * **Details**
 *
 * `text` keeps the words as extracted: words of one line joined by a single
 * space, lines joined by a newline.
 *
 * **Example** (A two-line block)
 *
 * ```ts
 * import { PdfRect, TextBlock } from "@beep/pdf-tools"
 *
 * const block = TextBlock.make({
 *   text: "Rotate this view\nfront to the left",
 *   rect: PdfRect.make({ xMin: 72, yMin: 80, xMax: 200, yMax: 104 })
 * })
 * console.log(block.text.split("\n").length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextBlock extends S.Class<TextBlock>($I`TextBlock`)(
  {
    text: S.String.annotateKey({ description: "Words joined by spaces, lines joined by newlines." }),
    rect: PdfRect.annotateKey({ description: "Bounding rectangle of the block." }),
  },
  $I.annote("TextBlock", {
    description: "A text block from `pdftotext -bbox-layout` and its rectangle.",
  })
) {}

/**
 * One page of one PDF file.
 *
 * **Example** (Page 3 of a sheet set)
 *
 * ```ts
 * import { PdfPageRef } from "@beep/pdf-tools"
 *
 * console.log(PdfPageRef.make({ pdfPath: "sheets.pdf", page: 3 }).page)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PdfPageRef extends S.Class<PdfPageRef>($I`PdfPageRef`)(
  {
    pdfPath: S.NonEmptyString.annotateKey({ description: "PDF file." }),
    page: PageNumber.annotateKey({ description: "One-based page." }),
  },
  $I.annote("PdfPageRef", {
    description: "A PDF file and a one-based page in it.",
  })
) {}

/**
 * Request to measure how much of a base page's ink a marked-up page covers.
 *
 * **Details**
 *
 * Both pages are rasterised at `dpi` without anti-aliasing and compared with
 * zero offset from the top-left corner. The marked page's ink is grown by
 * `dilatePx` pixels in every direction first, so a re-export that moves a
 * stroke by a fraction of a pixel still covers it.
 *
 * **Example** (Compare a reviewer page with sheet 2 at 36 dpi)
 *
 * ```ts
 * import { InkCoverageRequest, PdfPageRef } from "@beep/pdf-tools"
 *
 * const request = InkCoverageRequest.make({
 *   base: PdfPageRef.make({ pdfPath: "sheets.pdf", page: 2 }),
 *   marked: PdfPageRef.make({ pdfPath: "reviewed.pdf", page: 1 }),
 *   dpi: 36,
 *   dilatePx: 2
 * })
 * console.log(request.dilatePx)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InkCoverageRequest extends S.Class<InkCoverageRequest>($I`InkCoverageRequest`)(
  {
    base: PdfPageRef.annotateKey({ description: "Page whose ink must be covered (the sheet that was sent)." }),
    marked: PdfPageRef.annotateKey({ description: "Page that may cover it (the page that came back)." }),
    dpi: Dpi.annotateKey({ description: "Resolution both pages are rasterised at." }),
    dilatePx: S.Natural.annotateKey({ description: "Pixels the marked ink is grown by before comparing." }),
  },
  $I.annote("InkCoverageRequest", {
    description: "Two pages, a resolution, and a tolerance for a raster ink-coverage comparison.",
  })
) {}

/**
 * How much of a base page's ink a marked page covers.
 *
 * **Details**
 *
 * `coverage` is `coveredPixels / baseInkPixels`, and 0 for a blank base page.
 * `markedInkPixels` counts the marked page's own ink before dilation, so a
 * caller can tell a page that merely contains a sparse sheet from the page
 * that sheet came back as.
 *
 * **Example** (Full coverage)
 *
 * ```ts
 * import { InkCoverage } from "@beep/pdf-tools"
 *
 * const result = InkCoverage.make({ baseInkPixels: 400, coveredPixels: 400, markedInkPixels: 520, coverage: 1 })
 * console.log(result.coverage)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InkCoverage extends S.Class<InkCoverage>($I`InkCoverage`)(
  {
    baseInkPixels: S.Natural.annotateKey({ description: "Ink pixels on the base page." }),
    coveredPixels: S.Natural.annotateKey({ description: "Base ink pixels the dilated marked ink covers." }),
    markedInkPixels: S.Natural.annotateKey({ description: "Ink pixels on the marked page, before dilation." }),
    coverage: S.Finite.annotateKey({ description: "coveredPixels / baseInkPixels; 0 for a blank base page." }),
  },
  $I.annote("InkCoverage", {
    description: "Base ink, covered ink, marked ink, and the covered fraction of a raster comparison.",
  })
) {}

/**
 * One PDF annotation object (an Acrobat-style comment, highlight, or note).
 *
 * **Example** (A sticky note)
 *
 * ```ts
 * import { PdfAnnotation, PdfRect } from "@beep/pdf-tools"
 * import * as O from "effect/Option"
 *
 * const note = PdfAnnotation.make({
 *   page: 1,
 *   subtype: "Text",
 *   rect: PdfRect.make({ xMin: 72, yMin: 72, xMax: 92, yMax: 92 }),
 *   contents: O.some("Rotate this view"),
 *   author: O.none()
 * })
 * console.log(note.subtype)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PdfAnnotation extends S.Class<PdfAnnotation>($I`PdfAnnotation`)(
  {
    page: PageNumber.annotateKey({ description: "One-based page the annotation sits on." }),
    subtype: S.String.annotateKey({ description: "`/Subtype` name, such as Text, FreeText, or Highlight." }),
    rect: PdfRect.annotateKey({ description: "`/Rect`, converted to points from the page's top-left corner." }),
    contents: S.Option(S.String).annotateKey({ description: "`/Contents` text, when present." }),
    author: S.Option(S.String).annotateKey({ description: "`/T` author, when present." }),
  },
  $I.annote("PdfAnnotation", {
    description: "Page, subtype, rectangle, contents, and author of one PDF annotation.",
  })
) {}
