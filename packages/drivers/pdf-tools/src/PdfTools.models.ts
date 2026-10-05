/**
 * Request and result models for the PDF tools driver: SVG → PDF conversion,
 * PDF structure inspection, and page raster metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PdfToolsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";

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

/**
 * Convert one or more SVG files into one PDF, one page per SVG, in order.
 *
 * **Details**
 *
 * `sourceDateEpoch` is exported as `SOURCE_DATE_EPOCH` so cairo writes a fixed
 * `CreationDate`; the driver always sets it (default 0) so output bytes do not
 * depend on the wall clock.
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
  },
  $I.annote("SvgToPdfRequest", {
    description: "SVG pages to convert into one PDF with a fixed version and creation date.",
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
) {}

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
