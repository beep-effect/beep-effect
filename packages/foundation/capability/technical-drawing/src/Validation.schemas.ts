/**
 * Validator inputs and outputs: the structural and raster facts a PDF backend
 * reports, and the findings the filing rules derive from them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $TechnicalDrawingId.create("Validation.schemas");

/**
 * Page size in points as reported by the PDF backend.
 *
 * **Example** (Letter)
 *
 * ```ts
 * import { PdfPageSize } from "@beep/technical-drawing/Validation.schemas"
 *
 * console.log(PdfPageSize.make({ widthPt: 612, heightPt: 792 }))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class PdfPageSize extends S.Opaque<PdfPageSize, { readonly brand: unique symbol }>()(
  S.Struct({
    widthPt: S.Finite.annotateKey({ description: "MediaBox width in points." }),
    heightPt: S.Finite.annotateKey({ description: "MediaBox height in points." }),
  }).pipe(
    $I.annoteSchema("PdfPageSize", {
      description: "MediaBox size in points.",
    })
  )
) {}

/**
 * A font a PDF references and whether its program is embedded.
 *
 * **Example** (An unembedded base font)
 *
 * ```ts
 * import { PdfFontFact } from "@beep/technical-drawing/Validation.schemas"
 *
 * console.log(PdfFontFact.make({ name: "Helvetica", embedded: false }))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class PdfFontFact extends S.Class<PdfFontFact, { readonly brand: unique symbol }>($I`PdfFontFact`)(
  {
    name: S.String.annotateKey({ description: "BaseFont name." }),
    embedded: S.Boolean.annotateKey({ description: "Whether a font program is embedded." }),
  },
  $I.annote("PdfFontFact", {
    description: "Font name and embedding status.",
  })
) {
  /**
   * The BaseFont name without its six-letter subset tag (`ABCDEF+`).
   *
   * **Example** (A subset font)
   *
   * ```ts
   * import { PdfFontFact } from "@beep/technical-drawing/Validation.schemas"
   *
   * console.log(PdfFontFact.make({ name: "ABCDEF+ArialMT", embedded: true }).baseName) // "ArialMT"
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  get baseName(): string {
    return Str.replace(/^[A-Z]{6}\+/, "")(this.name);
  }
}

/**
 * A FlateDecode stream a strict reader refuses: its bytes fail a strict
 * zlib inflate.
 *
 * **Details**
 *
 * A strict inflate needs the whole zlib stream, its trailing Adler-32
 * checksum included, so a stream cut short by a single byte is reported
 * although lenient viewers still show the page.
 *
 * **Example** (A truncated font program)
 *
 * ```ts
 * import { PdfStreamFact } from "@beep/technical-drawing/Validation.schemas"
 *
 * console.log(PdfStreamFact.make({ objectNumber: 52, generation: 0, reason: "unexpected end of file" }).reason)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class PdfStreamFact extends S.Opaque<PdfStreamFact, { readonly brand: unique symbol }>()(
  S.Struct({
    objectNumber: S.Natural.annotateKey({ description: "Object number of the stream." }),
    generation: S.Natural.annotateKey({ description: "Generation number of the stream." }),
    reason: S.NonEmptyString.annotateKey({ description: "Why the strict inflate failed." }),
  }).pipe(
    $I.annoteSchema("PdfStreamFact", {
      description: "Object reference and inflate error of a FlateDecode stream a strict reader refuses.",
    })
  )
) {}

const PdfStreamCheckBase = LiteralKit(["complete", "encrypted", "limit-reached"]);

/**
 * How far the backend's strict-inflate check of a file's FlateDecode streams
 * got.
 *
 * **Details**
 *
 * `complete`: every FlateDecode stream was inflated, so the undecodable
 * streams listed are all there are. `encrypted`: the streams are ciphertext
 * and were not checked; the `encrypted` finding already fails such a file.
 * `limit-reached`: the check stopped at the backend's inflate limit, so
 * streams later in the file were never checked, and the file fails
 * `pdf-stream-undecodable` as unverified.
 *
 * **Example** (Read the outcomes)
 *
 * ```ts
 * import { PdfStreamCheck } from "@beep/technical-drawing/Validation.schemas"
 *
 * console.log(PdfStreamCheck.literals) // ["complete", "encrypted", "limit-reached"]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PdfStreamCheck = PdfStreamCheckBase.pipe(
  $I.annoteSchema("PdfStreamCheck", {
    description:
      "Whether the strict-inflate check covered every FlateDecode stream, skipped them as ciphertext, or stopped at the inflate limit.",
  }),
  SchemaUtils.withLiteralKitStatics(PdfStreamCheckBase)
);

/**
 * Type for {@link PdfStreamCheck}.
 *
 * **Example** (Annotate an outcome)
 *
 * ```ts
 * import type { PdfStreamCheck } from "@beep/technical-drawing/Validation.schemas"
 *
 * const check: PdfStreamCheck = "limit-reached"
 * console.log(check)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type PdfStreamCheck = typeof PdfStreamCheck.Type;

/**
 * Structural facts about a PDF file, as reported by the backend.
 *
 * **Example** (A clean two-page file)
 *
 * ```ts
 * import { PdfFacts, PdfPageSize } from "@beep/technical-drawing/Validation.schemas"
 *
 * const facts = PdfFacts.make({
 *   headerVersion: "1.6",
 *   pages: [PdfPageSize.make({ widthPt: 612, heightPt: 792 }), PdfPageSize.make({ widthPt: 612, heightPt: 792 })],
 *   fonts: [],
 *   annotationCount: 0,
 *   hasOptionalContent: false,
 *   encrypted: false
 * })
 * console.log(facts.pages.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class PdfFacts extends S.Opaque<PdfFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    headerVersion: S.String.annotateKey({ description: "Version from the `%PDF-` header." }),
    pages: S.Array(PdfPageSize).annotateKey({ description: "Every page's MediaBox, in order." }),
    fonts: S.Array(PdfFontFact).annotateKey({ description: "Fonts referenced by any page." }),
    annotationCount: S.Natural.annotateKey({ description: "Total annotations across pages." }),
    hasOptionalContent: S.Boolean.annotateKey({ description: "Whether the file declares layers." }),
    encrypted: S.Boolean.annotateKey({ description: "Whether the file is encrypted." }),
    undecodableStreams: S.Array(PdfStreamFact).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.annotateKey({
        description:
          "FlateDecode streams a strict inflate rejects, in object order; empty when none (and for an encrypted file, whose streams are not checked). `streamCheck` and `containerDiscovery` describe separate inflate and discovery completeness.",
      })
    ),
    containerDiscovery: PdfStreamCheck.pipe(
      S.withConstructorDefault(Effect.succeed("complete" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("complete" as const)),
      S.annotateKey({
        description:
          "Whether raw PDF container discovery completed, reached its candidate limit, or was skipped for encryption; separate from inflate coverage.",
      })
    ),
    streamCheck: PdfStreamCheck.pipe(
      S.withConstructorDefault(Effect.succeed("complete" as const)),
      S.annotateKey({
        description:
          "Whether the strict-inflate check covered every FlateDecode stream (`complete`), none because the file is encrypted (`encrypted`), or stopped at the backend's inflate limit (`limit-reached`).",
      })
    ),
  }).pipe(
    $I.annoteSchema("PdfFacts", {
      description:
        "Header version, page sizes, fonts, annotations, layers, encryption, undecodable streams, and how far their check got, of a PDF.",
    })
  )
) {}

/**
 * Ink bounds of a rendered page in pixels, inclusive, from the top-left.
 *
 * **Example** (Make bounds)
 *
 * ```ts
 * import { InkBounds } from "@beep/technical-drawing/Validation.schemas"
 *
 * console.log(InkBounds.make({ minX: 10, minY: 10, maxX: 90, maxY: 90 }))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class InkBounds extends S.Opaque<InkBounds, { readonly brand: unique symbol }>()(
  S.Struct({
    minX: S.Natural.annotateKey({ description: "Leftmost ink column." }),
    minY: S.Natural.annotateKey({ description: "Topmost ink row." }),
    maxX: S.Natural.annotateKey({ description: "Rightmost ink column." }),
    maxY: S.Natural.annotateKey({ description: "Bottommost ink row." }),
  }).pipe(
    $I.annoteSchema("InkBounds", {
      description: "Inclusive pixel bounds of a page's ink.",
    })
  )
) {}

/**
 * Measurements of one rendered page, as reported by the backend.
 *
 * **Example** (A blank page)
 *
 * ```ts
 * import { PageMetrics } from "@beep/technical-drawing/Validation.schemas"
 * import * as O from "effect/Option"
 *
 * const metrics = PageMetrics.make({
 *   width: 2550, height: 3300, dpi: 300, antiAliased: true,
 *   inkBounds: O.none(), inkPixels: 0, impurePixels: 0, largestBlackSquare: 0
 * })
 * console.log(metrics.dpi)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class PageMetrics extends S.Opaque<PageMetrics, { readonly brand: unique symbol }>()(
  S.Struct({
    width: S.Natural.annotateKey({ description: "Raster width in pixels." }),
    height: S.Natural.annotateKey({ description: "Raster height in pixels." }),
    dpi: S.Natural.annotateKey({ description: "Resolution the page was rendered at." }),
    antiAliased: S.Boolean.annotateKey({ description: "Whether the render was anti-aliased." }),
    inkBounds: S.Option(InkBounds).annotateKey({ description: "Bounds of the ink, or none for a blank page." }),
    inkPixels: S.Natural.annotateKey({ description: "Pixels dark enough to count as ink." }),
    impurePixels: S.Natural.annotateKey({ description: "Pixels that are neither pure black nor pure white." }),
    largestBlackSquare: S.Natural.annotateKey({ description: "Side of the largest all-ink square, in pixels." }),
  }).pipe(
    $I.annoteSchema("PageMetrics", {
      description: "Size, ink bounds, purity count, and largest solid-ink square of a rendered page.",
    })
  )
) {}

const FindingCodeBase = LiteralKit([
  "pdf-version",
  "encrypted",
  "optional-content",
  "annotations",
  "font-not-embedded",
  "pdf-stream-undecodable",
  "page-size",
  "page-size-mixed",
  "page-count",
  "blank-page",
  "margin-top",
  "margin-left",
  "margin-right",
  "margin-bottom",
  "impure-pixels",
  "solid-black-area",
  "shading-spacing",
  "shading-lost-face",
  "shading-lost-stretch",
  "shading-skipped-stretch",
  "shading-outline-clearance",
  "shading-lone-line",
  "shading-band-ladder",
  "outline-spacing",
  "label-missing",
  "font-unexpected",
]);

/**
 * Validator finding codes.
 *
 * **Example** (Read the codes)
 *
 * ```ts
 * import { FindingCode } from "@beep/technical-drawing/Validation.schemas"
 *
 * console.log(FindingCode.literals.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const FindingCode = FindingCodeBase.pipe(
  $I.annoteSchema("FindingCode", {
    description: "Which filing rule a sheet set broke.",
  }),
  SchemaUtils.withLiteralKitStatics(FindingCodeBase)
);

/**
 * Type for {@link FindingCode}.
 *
 * **Example** (Annotate a code)
 *
 * ```ts
 * import type { FindingCode } from "@beep/technical-drawing/Validation.schemas"
 *
 * const code: FindingCode = "margin-top"
 * console.log(code)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type FindingCode = typeof FindingCode.Type;

/**
 * One validator finding.
 *
 * **Example** (A margin finding)
 *
 * ```ts
 * import { SheetFinding } from "@beep/technical-drawing/Validation.schemas"
 * import * as O from "effect/Option"
 *
 * const finding = SheetFinding.make({ code: "margin-top", page: O.some(3), message: "Top margin 2.1 cm is under 2.5 cm." })
 * console.log(finding.code)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class SheetFinding extends S.Opaque<SheetFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    code: FindingCode.annotateKey({ description: "Rule broken." }),
    page: S.OptionFromNullOr(S.Natural).annotateKey({
      description: "One-based page, or none for file-level findings (`null` in JSON).",
    }),
    message: S.NonEmptyString.annotateKey({ description: "What was measured and the limit it broke." }),
  }).pipe(
    $I.annoteSchema("SheetFinding", {
      description: "A rule a sheet set broke, with the page and the measurement.",
    })
  )
) {}

const SheetLabelBase = LiteralKit(["figure", "sheet-number"]);

/**
 * The two labels of a sheet: `FIG. n` and the `n/N` sheet number.
 *
 * **Example** (Read the labels)
 *
 * ```ts
 * import { SheetLabel } from "@beep/technical-drawing/Validation.schemas"
 *
 * console.log(SheetLabel.literals)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SheetLabel = SheetLabelBase.pipe(
  $I.annoteSchema("SheetLabel", {
    description: "`figure` (the `FIG. n` label) or `sheet-number` (the `n/N` label).",
  }),
  SchemaUtils.withLiteralKitStatics(SheetLabelBase)
);

/**
 * Type for {@link SheetLabel}.
 *
 * **Example** (Annotate a label)
 *
 * ```ts
 * import type { SheetLabel } from "@beep/technical-drawing/Validation.schemas"
 *
 * const label: SheetLabel = "figure"
 * console.log(label)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type SheetLabel = typeof SheetLabel.Type;

/**
 * Tolerances and expectations the validator checks against.
 *
 * **Example** (Defaults for an eight-sheet set)
 *
 * ```ts
 * import { ValidationOptions } from "@beep/technical-drawing/Validation.schemas"
 * import * as O from "effect/Option"
 *
 * console.log(ValidationOptions.make({ expectedPages: O.some(8) }).maxSolidBlackMm)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class ValidationOptions extends S.Opaque<ValidationOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    expectedPages: S.Option(S.Natural).annotateKey({ description: "Required page count, when known." }),
    maxSolidBlackMm: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(1.5)),
      S.annotateKey({ description: "Largest all-ink square allowed, in mm. Defaults to 1.5." })
    ),
    pageSizeTolerancePt: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(1)),
      S.annotateKey({ description: "Allowed MediaBox deviation from the format, in points. Defaults to 1." })
    ),
    minShadingSpacingMm: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0.5)),
      S.annotateKey({
        description:
          "Closest two side-by-side shading lines may sit on the sheet, in mm; closer lines read as a solid black area. Defaults to 0.5.",
      })
    ),
    loneLineOffsetMm: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(2.5)),
      S.annotateKey({
        description:
          "How close, in mm, a shading stroke may run beside a parallel outline before it must have a companion stroke; alone it reads as a doubled edge. Defaults to 2.5.",
      })
    ),
    loneLineCompanionMm: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(6)),
      S.annotateKey({
        description:
          "How far, in mm, a companion stroke may sit from a stroke that runs beside an outline. Defaults to 6.",
      })
    ),
    ladderReachMm: S.Finite.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(2.5)),
      S.annotateKey({
        description:
          "How far, in mm, beyond a shading band's edge a drawn line running alongside that edge makes the band and the lines read as one ladder. The renderer starts such a band behind a gutter. Defaults to 2.5.",
      })
    ),
    ladderGutterRatio: S.Finite.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(1.4)),
      S.annotateKey({
        description:
          "Least ratio of a band's gap to its edge (from its first stroke) to the larger of the band's first gap and the spacing of the lines beyond its edge; a smaller gutter lets band and lines read as one ladder. Defaults to 1.4, a margin under the renderer's 1.5 for perspective views.",
      })
    ),
    minOutlineSpacingMm: S.Finite.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0.7)),
      S.annotateKey({
        description:
          "Least centre spacing, in mm, of two drawn lines (outlines, broken and emphasis lines) running side by side; closer, the pair prints as one line of the emphasis weight. Twice the 0.35 mm line, the ISO 128 least spacing of parallel lines. Defaults to 0.7.",
      })
    ),
    minOutlineOverlapMm: S.Finite.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(1)),
      S.annotateKey({
        description:
          "How far, in mm, two drawn lines must run alongside each other before their spacing is held to `minOutlineSpacingMm`; shorter runs (a corner return) read as two lines. Defaults to 1.",
      })
    ),
    textLabels: S.Array(SheetLabel).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.annotateKey({
        description:
          "Labels set as embedded text, so each page's extracted text must carry them (`FIG. n` on page n, `n/N` of N pages). Defaults to none.",
      })
    ),
    expectedLabelFonts: S.Array(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.annotateKey({
        description:
          "Font families text labels were set in; every embedded font's base name must contain one of them (case and spaces ignored). Empty skips the check.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ValidationOptions", {
      description: "Expected page count, tolerances, text labels, and label font families of a validation run.",
    })
  )
) {}

/**
 * Result of validating one sheet-set PDF.
 *
 * **Example** (A clean report)
 *
 * ```ts
 * import { ValidationReport } from "@beep/technical-drawing/Validation.schemas"
 *
 * const report = ValidationReport.make({ pdfSha256: "00", pageCount: 8, findings: [] })
 * console.log(report.ok)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class ValidationReport extends S.Class<ValidationReport, { readonly brand: unique symbol }>(
  $I`ValidationReport`
)(
  {
    pdfSha256: S.NonEmptyString.annotateKey({ description: "SHA-256 of the validated PDF bytes." }),
    pageCount: S.Natural.annotateKey({ description: "Pages in the PDF." }),
    findings: S.Array(SheetFinding).annotateKey({ description: "Every rule broken, in page order." }),
  },
  $I.annote("ValidationReport", {
    description: "PDF hash, page count, and findings of one validation run.",
  })
) {
  /**
   * Whether the sheet set passed with zero findings.
   *
   * **Example** (Check a report)
   *
   * ```ts
   * import { ValidationReport } from "@beep/technical-drawing/Validation.schemas"
   *
   * console.log(ValidationReport.make({ pdfSha256: "00", pageCount: 1, findings: [] }).ok)
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  get ok(): boolean {
    return this.findings.length === 0;
  }
}
