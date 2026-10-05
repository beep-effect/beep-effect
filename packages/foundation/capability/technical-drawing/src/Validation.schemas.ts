/**
 * Validator inputs and outputs: the structural and raster facts a PDF backend
 * reports, and the findings the filing rules derive from them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $TechnicalDrawingId.create("Validation.schemas");

/**
 * Page size in points as reported by the PDF backend.
 *
 * **Example** (Letter)
 *
 * ```ts
 * import { PdfPageSize } from "@beep/technical-drawing"
 *
 * console.log(PdfPageSize.make({ widthPt: 612, heightPt: 792 }))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class PdfPageSize extends S.Class<PdfPageSize>($I`PdfPageSize`)(
  {
    widthPt: S.Finite.annotateKey({ description: "MediaBox width in points." }),
    heightPt: S.Finite.annotateKey({ description: "MediaBox height in points." }),
  },
  $I.annote("PdfPageSize", {
    description: "MediaBox size in points.",
  })
) {}

/**
 * A font a PDF references and whether its program is embedded.
 *
 * **Example** (An unembedded base font)
 *
 * ```ts
 * import { PdfFontFact } from "@beep/technical-drawing"
 *
 * console.log(PdfFontFact.make({ name: "Helvetica", embedded: false }))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class PdfFontFact extends S.Class<PdfFontFact>($I`PdfFontFact`)(
  {
    name: S.String.annotateKey({ description: "BaseFont name." }),
    embedded: S.Boolean.annotateKey({ description: "Whether a font program is embedded." }),
  },
  $I.annote("PdfFontFact", {
    description: "Font name and embedding status.",
  })
) {}

/**
 * Structural facts about a PDF file, as reported by the backend.
 *
 * **Example** (A clean two-page file)
 *
 * ```ts
 * import { PdfFacts, PdfPageSize } from "@beep/technical-drawing"
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
export class PdfFacts extends S.Class<PdfFacts>($I`PdfFacts`)(
  {
    headerVersion: S.String.annotateKey({ description: "Version from the `%PDF-` header." }),
    pages: S.Array(PdfPageSize).annotateKey({ description: "Every page's MediaBox, in order." }),
    fonts: S.Array(PdfFontFact).annotateKey({ description: "Fonts referenced by any page." }),
    annotationCount: S.Natural.annotateKey({ description: "Total annotations across pages." }),
    hasOptionalContent: S.Boolean.annotateKey({ description: "Whether the file declares layers." }),
    encrypted: S.Boolean.annotateKey({ description: "Whether the file is encrypted." }),
  },
  $I.annote("PdfFacts", {
    description: "Header version, page sizes, fonts, annotations, layers, and encryption of a PDF.",
  })
) {}

/**
 * Ink bounds of a rendered page in pixels, inclusive, from the top-left.
 *
 * **Example** (Make bounds)
 *
 * ```ts
 * import { InkBounds } from "@beep/technical-drawing"
 *
 * console.log(InkBounds.make({ minX: 10, minY: 10, maxX: 90, maxY: 90 }))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class InkBounds extends S.Class<InkBounds>($I`InkBounds`)(
  {
    minX: S.Natural.annotateKey({ description: "Leftmost ink column." }),
    minY: S.Natural.annotateKey({ description: "Topmost ink row." }),
    maxX: S.Natural.annotateKey({ description: "Rightmost ink column." }),
    maxY: S.Natural.annotateKey({ description: "Bottommost ink row." }),
  },
  $I.annote("InkBounds", {
    description: "Inclusive pixel bounds of a page's ink.",
  })
) {}

/**
 * Measurements of one rendered page, as reported by the backend.
 *
 * **Example** (A blank page)
 *
 * ```ts
 * import { PageMetrics } from "@beep/technical-drawing"
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
export class PageMetrics extends S.Class<PageMetrics>($I`PageMetrics`)(
  {
    width: S.Natural.annotateKey({ description: "Raster width in pixels." }),
    height: S.Natural.annotateKey({ description: "Raster height in pixels." }),
    dpi: S.Natural.annotateKey({ description: "Resolution the page was rendered at." }),
    antiAliased: S.Boolean.annotateKey({ description: "Whether the render was anti-aliased." }),
    inkBounds: S.Option(InkBounds).annotateKey({ description: "Bounds of the ink, or none for a blank page." }),
    inkPixels: S.Natural.annotateKey({ description: "Pixels dark enough to count as ink." }),
    impurePixels: S.Natural.annotateKey({ description: "Pixels that are neither pure black nor pure white." }),
    largestBlackSquare: S.Natural.annotateKey({ description: "Side of the largest all-ink square, in pixels." }),
  },
  $I.annote("PageMetrics", {
    description: "Size, ink bounds, purity count, and largest solid-ink square of a rendered page.",
  })
) {}

const FindingCodeBase = LiteralKit([
  "pdf-version",
  "encrypted",
  "optional-content",
  "annotations",
  "font-not-embedded",
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
]);

/**
 * Validator finding codes.
 *
 * **Example** (Read the codes)
 *
 * ```ts
 * import { FindingCode } from "@beep/technical-drawing"
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
 * import type { FindingCode } from "@beep/technical-drawing"
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
 * import { SheetFinding } from "@beep/technical-drawing"
 * import * as O from "effect/Option"
 *
 * const finding = SheetFinding.make({ code: "margin-top", page: O.some(3), message: "Top margin 2.1 cm is under 2.5 cm." })
 * console.log(finding.code)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class SheetFinding extends S.Class<SheetFinding>($I`SheetFinding`)(
  {
    code: FindingCode.annotateKey({ description: "Rule broken." }),
    page: S.Option(S.Natural).annotateKey({ description: "One-based page, or none for file-level findings." }),
    message: S.NonEmptyString.annotateKey({ description: "What was measured and the limit it broke." }),
  },
  $I.annote("SheetFinding", {
    description: "A rule a sheet set broke, with the page and the measurement.",
  })
) {}

/**
 * Tolerances and expectations the validator checks against.
 *
 * **Example** (Defaults for an eight-sheet set)
 *
 * ```ts
 * import { ValidationOptions } from "@beep/technical-drawing"
 * import * as O from "effect/Option"
 *
 * console.log(ValidationOptions.make({ expectedPages: O.some(8) }).maxSolidBlackMm)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class ValidationOptions extends S.Class<ValidationOptions>($I`ValidationOptions`)(
  {
    expectedPages: S.Option(S.Natural).annotateKey({ description: "Required page count, when known." }),
    maxSolidBlackMm: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(1.5)),
      S.annotateKey({ description: "Largest all-ink square allowed, in mm. Defaults to 1.5." })
    ),
    pageSizeTolerancePt: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(1)),
      S.annotateKey({ description: "Allowed MediaBox deviation from the format, in points. Defaults to 1." })
    ),
  },
  $I.annote("ValidationOptions", {
    description: "Expected page count and tolerances of a validation run.",
  })
) {}

/**
 * Result of validating one sheet-set PDF.
 *
 * **Example** (A clean report)
 *
 * ```ts
 * import { ValidationReport } from "@beep/technical-drawing"
 *
 * const report = ValidationReport.make({ pdfSha256: "00", pageCount: 8, findings: [] })
 * console.log(report.ok)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class ValidationReport extends S.Class<ValidationReport>($I`ValidationReport`)(
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
   * import { ValidationReport } from "@beep/technical-drawing"
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
