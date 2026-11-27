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
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $PdfToolsId.create("PdfTools.models");

const PdfVersionBase = LiteralKit(["1.4", "1.5", "1.6", "1.7"]);

/**
 * PDF versions `rsvg-convert` can be asked to emit.
 *
 * **Details**
 *
 * cairo writes the same bytes for 1.5, 1.6 and 1.7 apart from the header
 * line. PDF 1.4 output has no object or cross-reference streams, and
 * `rsvg-convert` writes it one SVG at a time, so a 1.4 conversion takes a
 * single SVG.
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
  S.isGreaterThanOrEqualTo(
    1,
    $I.annote("PageNumberCheck", {
      title: "Page Number",
      description: "PDF pages are numbered from one.",
      message: "Expected a page number of at least 1",
    })
  )
).pipe(
  $I.annoteSchema("PageNumber", {
    description: "One-based PDF page number.",
  })
);

/**
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
  S.isGreaterThanOrEqualTo(
    36,
    $I.annote("DpiCheck", {
      title: "Dpi",
      description: "Raster resolutions below 36 dpi are not useful for measurement.",
      message: "Expected a resolution of at least 36 dpi",
    })
  )
).pipe(
  $I.annoteSchema("Dpi", {
    description: "Raster resolution in dots per inch.",
  })
);

/**
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
  S.makeFilter(
    Str.startsWith("/"),
    $I.annote("AbsoluteFontDirectoryCheck", {
      title: "Font Directory",
      description: "A pinned font directory is an absolute path.",
      message: "Expected an absolute font directory",
    })
  )
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
export class FontFamilyAlias extends S.Opaque<FontFamilyAlias, { readonly brand: unique symbol }>()(
  S.Struct({
    requested: S.NonEmptyString.annotateKey({ description: "Family name an SVG `font-family` requests." }),
    family: S.NonEmptyString.annotateKey({ description: "Family name of the font file in the pinned directory." }),
  }).pipe(
    $I.annoteSchema("FontFamilyAlias", {
      description: "A requested font family and the pinned family it is bound to.",
    })
  )
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
export class PinnedFonts extends S.Opaque<PinnedFonts, { readonly brand: unique symbol }>()(
  S.Struct({
    directory: AbsoluteDirectory.annotateKey({ description: "The only directory fonts are read from." }),
    families: S.Array(FontFamilyAlias).annotateKey({ description: "Requested families and their bindings." }),
  }).pipe(
    $I.annoteSchema("PinnedFonts", {
      description: "Font directory and family bindings an SVG to PDF conversion is pinned to.",
    })
  )
) {}

/**
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
export class PinnedFontconfigRequest extends S.Opaque<PinnedFontconfigRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    fonts: PinnedFonts.annotateKey({ description: "The font directory and family bindings to pin." }),
    cacheDirectory: AbsoluteDirectory.annotateKey({ description: "Where fontconfig keeps its cache for this run." }),
  }).pipe(
    $I.annoteSchema("PinnedFontconfigRequest", {
      description: "Pinned fonts and the cache directory a fontconfig file is written from.",
    })
  )
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
 * **Gotchas**
 *
 * A PDF 1.4 request takes exactly one SVG: `rsvg-convert` refuses several
 * inputs for a versioned format, and only its 1.5-and-later output can be
 * relabelled (see {@link PdfVersion}).
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
export class SvgToPdfRequest extends S.Opaque<SvgToPdfRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    svgPaths: S.Array(S.NonEmptyString)
      .check(
        S.isMinLength(
          1,
          $I.annote("SvgToPdfRequestPagesCheck", {
            title: "SVG Pages",
            description: "A conversion needs at least one SVG page.",
            message: "Expected at least one SVG path",
          })
        )
      )
      .annotateKey({ description: "SVG files, one page each, in page order." }),
    outputPath: S.NonEmptyString.annotateKey({ description: "Destination PDF path; overwritten." }),
    pdfVersion: PdfVersion.pipe(
      S.withConstructorDefault(Effect.succeed("1.6" as const)),
      S.annotateKey({ description: "PDF version to emit. Defaults to 1.6." }),
      S.withDecodingDefaultTypeKey(Effect.succeed("1.6" as const))
    ),
    sourceDateEpoch: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.annotateKey({ description: "Unix seconds used for the PDF creation date. Defaults to 0." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(0))
    ),
    fonts: S.OptionFromOptionalKey(PinnedFonts).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Font directory and bindings for `<text>`. Absent, the host fontconfig is used." })
    ),
  })
    .check(
      S.makeFilter(
        (request) => request.pdfVersion !== "1.4" || A.length(request.svgPaths) === 1,
        $I.annote("SvgToPdfRequestPdf14PagesCheck", {
          title: "PDF 1.4 Pages",
          description:
            "rsvg-convert writes several pages only at PDF 1.5 or later, so a PDF 1.4 conversion takes one SVG.",
          message: "Expected exactly one SVG path for PDF 1.4 output",
        })
      )
    )
    .pipe(
      $I.annoteSchema("SvgToPdfRequest", {
        description:
          "SVG pages to convert into one PDF with a fixed version, creation date, and optional pinned fonts.",
      })
    )
) {}

/**
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
export class SvgToPdfResult extends S.Opaque<SvgToPdfResult, { readonly brand: unique symbol }>()(
  S.Struct({
    outputPath: S.NonEmptyString.annotateKey({ description: "Written PDF path." }),
    pageCount: S.Natural.annotateKey({ description: "Pages written." }),
    bytes: S.Natural.annotateKey({ description: "Size of the written PDF in bytes." }),
  }).pipe(
    $I.annoteSchema("SvgToPdfResult", {
      description: "Written PDF path, page count, and size.",
    })
  )
) {}

/**
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
export class PageSize extends S.Opaque<PageSize, { readonly brand: unique symbol }>()(
  S.Struct({
    widthPt: S.Finite.annotateKey({ description: "MediaBox width in points." }),
    heightPt: S.Finite.annotateKey({ description: "MediaBox height in points." }),
  }).pipe(
    $I.annoteSchema("PageSize", {
      description: "MediaBox size in points.",
    })
  )
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
export class PdfFont extends S.Class<PdfFont, { readonly brand: unique symbol }>($I`PdfFont`)(
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
 * A FlateDecode stream whose bytes a strict zlib inflate rejects.
 *
 * **Details**
 *
 * A strict inflate needs the whole zlib stream, including the trailing
 * Adler-32 checksum, so a stream that lost even its last byte is reported
 * here although every byte of its payload may still inflate. Lenient
 * readers show such a file; strict ones refuse the stream. Object streams
 * and cross-reference streams are checked like any other stream.
 *
 * **Example** (A truncated font program)
 *
 * ```ts
 * import { UndecodableStream } from "@beep/pdf-tools"
 *
 * const stream = UndecodableStream.make({ objectNumber: 52, generation: 0, reason: "unexpected end of file" })
 * console.log(`${stream.objectNumber} ${stream.generation} R: ${stream.reason}`)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UndecodableStream extends S.Opaque<UndecodableStream, { readonly brand: unique symbol }>()(
  S.Struct({
    objectNumber: S.Natural.annotateKey({ description: "Object number of the stream." }),
    generation: S.Natural.annotateKey({ description: "Generation number of the stream." }),
    reason: S.NonEmptyString.annotateKey({ description: "Why the inflate failed, as zlib reports it." }),
  }).pipe(
    $I.annoteSchema("UndecodableStream", {
      description: "Object number, generation, and zlib error of a FlateDecode stream that fails a strict inflate.",
    })
  )
) {}

const StreamCheckBase = LiteralKit(["complete", "encrypted", "limit-reached"]);

/**
 * How far the strict-inflate check of a file's FlateDecode streams got.
 *
 * **Details**
 *
 * `complete`: every FlateDecode stream was inflated, so the undecodable
 * streams listed are all there are. `encrypted`: the check did not run,
 * because the streams are ciphertext. `limit-reached`: the check stopped once
 * the bytes it inflated reached the inspection limit (`maxInflatedBytes` on
 * the driver config), so streams later in object order were not checked.
 *
 * **Example** (Read the outcomes)
 *
 * ```ts
 * import { StreamCheck } from "@beep/pdf-tools"
 *
 * console.log(StreamCheck.literals) // ["complete", "encrypted", "limit-reached"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StreamCheck = StreamCheckBase.pipe(
  $I.annoteSchema("StreamCheck", {
    description: "Whether the strict-inflate check covered every FlateDecode stream, skipped them, or stopped early.",
  }),
  SchemaUtils.withLiteralKitStatics(StreamCheckBase)
);

/**
 * **Example** (Annotate an outcome)
 *
 * ```ts
 * import type { StreamCheck } from "@beep/pdf-tools"
 *
 * const check: StreamCheck = "limit-reached"
 * console.log(check)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type StreamCheck = typeof StreamCheck.Type;

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
export class PdfStructure extends S.Opaque<PdfStructure, { readonly brand: unique symbol }>()(
  S.Struct({
    headerVersion: S.String.annotateKey({ description: "Version from the `%PDF-` header line." }),
    pages: S.Array(PageSize).annotateKey({ description: "MediaBox of every page, in order." }),
    fonts: S.Array(PdfFont).annotateKey({ description: "Distinct fonts referenced by page resources." }),
    annotationCount: S.Natural.annotateKey({ description: "Total `/Annots` entries across pages." }),
    hasOptionalContent: S.Boolean.annotateKey({
      description: "Whether the catalog declares layers (`/OCProperties`).",
    }),
    encrypted: S.Boolean.annotateKey({ description: "Whether the file is encrypted." }),
    undecodableStreams: S.Array(UndecodableStream).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.annotateKey({
        description:
          "FlateDecode streams, object and cross-reference streams included, that fail a strict inflate, in object order. `streamCheck` and `containerDiscovery` describe separate inflate and discovery completeness.",
      })
    ),
    containerDiscovery: S.Literals(["complete", "limit-reached", "encrypted"]).pipe(
      S.withConstructorDefault(Effect.succeed("complete" as const)),
      S.annotateKey({
        description:
          "Whether raw object/cross-reference container discovery completed, stopped at its candidate budget, or was skipped for encryption. Global stream inspection is complete only when this and streamCheck are complete.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed("complete" as const))
    ),
    streamCheck: StreamCheck.pipe(
      S.withConstructorDefault(Effect.succeed("complete" as const)),
      S.annotateKey({
        description:
          "Whether every discovered FlateDecode stream was checked (`complete`), none were because the file is encrypted (`encrypted`), or the check stopped at the inflate limit (`limit-reached`).",
      })
    ),
  }).pipe(
    $I.annoteSchema("PdfStructure", {
      description:
        "Header version, page sizes, fonts, annotations, layers, encryption, undecodable streams, and separate discovery/inflate completeness, of a PDF.",
    })
  )
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
export class RasterRequest extends S.Opaque<RasterRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    pdfPath: S.NonEmptyString.annotateKey({ description: "PDF to rasterise." }),
    page: PageNumber.annotateKey({ description: "One-based page to rasterise." }),
    dpi: Dpi.annotateKey({ description: "Resolution." }),
    antiAlias: S.Boolean.annotateKey({ description: "Whether to anti-alias text and vectors." }),
    blackThreshold: S.Int.pipe(
      S.withConstructorDefault(Effect.succeed(128)),
      S.annotateKey({ description: "Luminance below which a pixel counts as ink (0–255). Defaults to 128." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(128))
    ),
  }).pipe(
    $I.annoteSchema("RasterRequest", {
      description: "One page, resolution, anti-aliasing switch, and ink threshold.",
    })
  )
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
export class PixelBox extends S.Opaque<PixelBox, { readonly brand: unique symbol }>()(
  S.Struct({
    minX: S.Natural.annotateKey({ description: "Leftmost ink column." }),
    minY: S.Natural.annotateKey({ description: "Topmost ink row." }),
    maxX: S.Natural.annotateKey({ description: "Rightmost ink column." }),
    maxY: S.Natural.annotateKey({ description: "Bottommost ink row." }),
  }).pipe(
    $I.annoteSchema("PixelBox", {
      description: "Inclusive pixel bounds of the ink on a page.",
    })
  )
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
export class RasterMetrics extends S.Opaque<RasterMetrics, { readonly brand: unique symbol }>()(
  S.Struct({
    width: S.Natural.annotateKey({ description: "Raster width in pixels." }),
    height: S.Natural.annotateKey({ description: "Raster height in pixels." }),
    dpi: Dpi.annotateKey({ description: "Resolution the page was rendered at." }),
    inkBox: S.Option(PixelBox).annotateKey({ description: "Bounds of the ink, or none for a blank page." }),
    inkPixels: S.Natural.annotateKey({ description: "Pixels at or below the ink threshold." }),
    impurePixels: S.Natural.annotateKey({ description: "Pixels that are neither pure black nor pure white." }),
    chromaPixels: S.Natural.annotateKey({ description: "Pixels whose RGB channels differ." }),
    largestBlackSquare: S.Natural.annotateKey({ description: "Side of the largest all-ink square, in pixels." }),
  }).pipe(
    $I.annoteSchema("RasterMetrics", {
      description: "Size, ink bounds, purity counts, and largest solid-ink square of a rendered page.",
    })
  )
) {}

/**
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
export class PngRequest extends S.Opaque<PngRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    pdfPath: S.NonEmptyString.annotateKey({ description: "PDF to render." }),
    page: PageNumber.annotateKey({ description: "One-based page to render." }),
    dpi: Dpi.annotateKey({ description: "Resolution." }),
    outputPath: S.NonEmptyString.annotateKey({ description: "Destination PNG path; overwritten." }),
  }).pipe(
    $I.annoteSchema("PngRequest", {
      description: "One page rendered to a PNG file at a resolution.",
    })
  )
) {}

/**
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
export class PageTextRequest extends S.Opaque<PageTextRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    pdfPath: S.NonEmptyString.annotateKey({ description: "PDF to read." }),
    page: PageNumber.annotateKey({ description: "One-based page whose text is extracted." }),
  }).pipe(
    $I.annoteSchema("PageTextRequest", {
      description: "One page of a PDF whose text is extracted.",
    })
  )
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
export class PdfRect extends S.Opaque<PdfRect, { readonly brand: unique symbol }>()(
  S.Struct({
    xMin: S.Finite.annotateKey({ description: "Left edge, points from the page's left edge." }),
    yMin: S.Finite.annotateKey({ description: "Top edge, points down from the page's top edge." }),
    xMax: S.Finite.annotateKey({ description: "Right edge, points from the page's left edge." }),
    yMax: S.Finite.annotateKey({ description: "Bottom edge, points down from the page's top edge." }),
  }).pipe(
    $I.annoteSchema("PdfRect", {
      description: "Rectangle in points from the page's top-left corner, as pdftotext reports it.",
    })
  )
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
export class TextBlock extends S.Opaque<TextBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.annotateKey({ description: "Words joined by spaces, lines joined by newlines." }),
    rect: PdfRect.annotateKey({ description: "Bounding rectangle of the block." }),
  }).pipe(
    $I.annoteSchema("TextBlock", {
      description: "A text block from `pdftotext -bbox-layout` and its rectangle.",
    })
  )
) {}

/**
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
export class PdfPageRef extends S.Opaque<PdfPageRef, { readonly brand: unique symbol }>()(
  S.Struct({
    pdfPath: S.NonEmptyString.annotateKey({ description: "PDF file." }),
    page: PageNumber.annotateKey({ description: "One-based page." }),
  }).pipe(
    $I.annoteSchema("PdfPageRef", {
      description: "A PDF file and a one-based page in it.",
    })
  )
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
export class InkCoverageRequest extends S.Opaque<InkCoverageRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    base: PdfPageRef.annotateKey({ description: "Page whose ink must be covered (the sheet that was sent)." }),
    marked: PdfPageRef.annotateKey({ description: "Page that may cover it (the page that came back)." }),
    dpi: Dpi.annotateKey({ description: "Resolution both pages are rasterised at." }),
    dilatePx: S.Natural.annotateKey({ description: "Pixels the marked ink is grown by before comparing." }),
  }).pipe(
    $I.annoteSchema("InkCoverageRequest", {
      description: "Two pages, a resolution, and a tolerance for a raster ink-coverage comparison.",
    })
  )
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
export class InkCoverage extends S.Opaque<InkCoverage, { readonly brand: unique symbol }>()(
  S.Struct({
    baseInkPixels: S.Natural.annotateKey({ description: "Ink pixels on the base page." }),
    coveredPixels: S.Natural.annotateKey({ description: "Base ink pixels the dilated marked ink covers." }),
    markedInkPixels: S.Natural.annotateKey({ description: "Ink pixels on the marked page, before dilation." }),
    coverage: S.Finite.annotateKey({ description: "coveredPixels / baseInkPixels; 0 for a blank base page." }),
  }).pipe(
    $I.annoteSchema("InkCoverage", {
      description: "Base ink, covered ink, marked ink, and the covered fraction of a raster comparison.",
    })
  )
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
export class PdfAnnotation extends S.Opaque<PdfAnnotation, { readonly brand: unique symbol }>()(
  S.Struct({
    page: PageNumber.annotateKey({ description: "One-based page the annotation sits on." }),
    subtype: S.String.annotateKey({ description: "`/Subtype` name, such as Text, FreeText, or Highlight." }),
    rect: PdfRect.annotateKey({ description: "`/Rect`, converted to points from the page's top-left corner." }),
    contents: S.Option(S.String).annotateKey({ description: "`/Contents` text, when present." }),
    author: S.Option(S.String).annotateKey({ description: "`/T` author, when present." }),
  }).pipe(
    $I.annoteSchema("PdfAnnotation", {
      description: "Page, subtype, rectangle, contents, and author of one PDF annotation.",
    })
  )
) {}
