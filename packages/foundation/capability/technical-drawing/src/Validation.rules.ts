/**
 * Pure filing rules: derive findings from PDF facts and page metrics.
 *
 * **Details**
 *
 * Structural tier (37 CFR 1.84(f), Patent Center PDF rules): header version
 * 1.1–1.6, no encryption, no layers, no annotations, every font embedded,
 * every page the same permitted size, and, for text labels, every embedded
 * font one of the expected label families. Text tier: a page whose labels are
 * embedded text carries `FIG. n` and `n/N` in its extracted text (a missing
 * font makes the converter drop the text silently). Raster tier (1.84(g), (l), (m)): ink
 * inside the margins measured on the anti-aliased render; only pure black or
 * white pixels and no solid-black area measured on the non-anti-aliased
 * renders.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, Str } from "@beep/utils";
import { pipe } from "effect/Function";
import * as Regex from "effect/RegExp";
import { MARGINS_CM, pageSizePt } from "./Sheet.schemas.ts";
import { SheetFinding, SheetLabel } from "./Validation.schemas.ts";
import type { SheetFormat } from "./Sheet.schemas.ts";
import type { PageMetrics, PdfFacts, ValidationOptions } from "./Validation.schemas.ts";

const PERMITTED_VERSIONS = ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"];

const fileFinding = (code: SheetFinding["code"], message: string): SheetFinding =>
  SheetFinding.make({ code, page: O.none(), message });

const pageFinding = (code: SheetFinding["code"], page: number, message: string): SheetFinding =>
  SheetFinding.make({ code, page: O.some(page), message });

// Font names compared without case, spaces, or punctuation: `Times New Roman`
// matches `TimesNewRomanPSMT`.
const fontKey = (name: string): string => Str.replace(/[^a-z0-9]/g, "")(Str.toLowerCase(name));

const within = (value: number, target: number, tolerance: number): boolean => Math.abs(value - target) <= tolerance;

const formatOf = (
  size: { readonly widthPt: number; readonly heightPt: number },
  tolerance: number
): O.Option<SheetFormat> =>
  pipe(
    ["letter", "a4"] as const,
    A.findFirst((format) => {
      const expected = pageSizePt(format);
      return within(size.widthPt, expected.width, tolerance) && within(size.heightPt, expected.height, tolerance);
    })
  );

/**
 * Findings from the structural facts of a PDF.
 *
 * **Example** (An encrypted file)
 *
 * ```ts
 * import { PdfFacts, ValidationOptions, structuralFindings } from "@beep/technical-drawing"
 * import * as O from "effect/Option"
 *
 * const facts = PdfFacts.make({ headerVersion: "1.6", pages: [], fonts: [], annotationCount: 0, hasOptionalContent: false, encrypted: true })
 * console.log(structuralFindings({ facts, options: ValidationOptions.make({ expectedPages: O.none() }) }).map((f) => f.code))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const structuralFindings = (input: {
  readonly facts: PdfFacts;
  readonly options: ValidationOptions;
}): ReadonlyArray<SheetFinding> => {
  const { facts, options } = input;
  const version = A.contains(PERMITTED_VERSIONS, facts.headerVersion)
    ? []
    : [fileFinding("pdf-version", `PDF header version "${facts.headerVersion}" is outside 1.1–1.6.`)];
  const encrypted = facts.encrypted ? [fileFinding("encrypted", "The PDF is encrypted.")] : [];
  const layers = facts.hasOptionalContent ? [fileFinding("optional-content", "The PDF declares layers.")] : [];
  const annotations =
    facts.annotationCount > 0
      ? [fileFinding("annotations", `The PDF carries ${facts.annotationCount} annotation(s).`)]
      : [];
  const fonts = pipe(
    facts.fonts,
    A.filter((font) => !font.embedded),
    A.map((font) => fileFinding("font-not-embedded", `Font "${font.name}" is not embedded.`))
  );
  const expectedFamilies = A.map(options.expectedLabelFonts, fontKey);
  const unexpected = A.isReadonlyArrayNonEmpty(expectedFamilies)
    ? pipe(
        facts.fonts,
        A.filter((font) => !A.some(expectedFamilies, (family) => Str.includes(family)(fontKey(font.baseName)))),
        A.map((font) =>
          fileFinding(
            "font-unexpected",
            `Font "${font.name}" is none of the label families ${A.join(options.expectedLabelFonts, ", ")}.`
          )
        )
      )
    : [];
  const pageCount = pipe(
    options.expectedPages,
    O.filter((expected) => expected !== facts.pages.length),
    O.map((expected) => fileFinding("page-count", `Expected ${expected} page(s), found ${facts.pages.length}.`)),
    O.toArray
  );
  // A document without pages is never a sheet set, whatever count was expected.
  const noPages =
    A.length(facts.pages) === 0 && A.length(pageCount) === 0
      ? [fileFinding("page-count", "The PDF has no pages.")]
      : [];
  const formats = pipe(
    facts.pages,
    A.map((size) => formatOf(size, options.pageSizeTolerancePt))
  );
  const sizes = pipe(
    formats,
    A.map((format, index) =>
      O.isNone(format)
        ? O.some(
            pageFinding(
              "page-size",
              index + 1,
              `Page is ${facts.pages[index]?.widthPt.toFixed(1)} × ${facts.pages[index]?.heightPt.toFixed(1)} pt, neither Letter nor A4.`
            )
          )
        : O.none()
    ),
    A.getSomes
  );
  const distinct = pipe(formats, A.getSomes, A.dedupe);
  const mixed =
    A.length(distinct) > 1 ? [fileFinding("page-size-mixed", `Sheets mix formats: ${A.join(distinct, ", ")}.`)] : [];
  return [
    ...version,
    ...encrypted,
    ...layers,
    ...annotations,
    ...fonts,
    ...unexpected,
    ...pageCount,
    ...noPages,
    ...sizes,
    ...mixed,
  ];
};

// Text of one label standing alone: a whole whitespace-separated run, so
// `FIG. 1` does not match inside `FIG. 10`.
const carries = (text: string, label: string): boolean =>
  new RegExp(`(?:^|\\s)${Regex.escape(label)}(?:\\s|$)`).test(text);

/**
 * Findings from the extracted text of one page whose labels are embedded
 * text: each expected label must be present.
 *
 * **Details**
 *
 * Page `n` of `N` must carry `FIG. n` when the figure label is text and
 * `n/N` when the sheet number is. A converter that cannot find the label font
 * draws nothing and still succeeds, so this is the rule that catches it.
 *
 * **Example** (A page without its sheet number)
 *
 * ```ts
 * import { ValidationOptions, labelTextFindings } from "@beep/technical-drawing"
 * import * as O from "effect/Option"
 *
 * const options = ValidationOptions.make({ expectedPages: O.none(), textLabels: ["figure", "sheet-number"] })
 * console.log(labelTextFindings({ page: 1, pages: 8, text: "FIG. 1\n", options }).map((f) => f.code))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const labelTextFindings = (input: {
  readonly page: number;
  readonly pages: number;
  readonly text: string;
  readonly options: ValidationOptions;
}): ReadonlyArray<SheetFinding> => {
  const { page, pages, text, options } = input;
  const expected = A.map(options.textLabels, (label) =>
    SheetLabel.$match(label, {
      figure: () => `FIG. ${page}`,
      "sheet-number": () => `${page}/${pages}`,
    })
  );
  return pipe(
    expected,
    A.filter((label) => !carries(text, label)),
    A.map((label) => pageFinding("label-missing", page, `The page text does not carry the label "${label}".`))
  );
};

const cm = (pixels: number, dpi: number): number => (pixels / dpi) * 2.54;

/**
 * Findings from the anti-aliased render of one page: margins and blankness.
 *
 * **Example** (A blank page)
 *
 * ```ts
 * import { PageMetrics, marginFindings } from "@beep/technical-drawing"
 * import * as O from "effect/Option"
 *
 * const metrics = PageMetrics.make({ width: 2550, height: 3300, dpi: 300, antiAliased: true, inkBounds: O.none(), inkPixels: 0, impurePixels: 0, largestBlackSquare: 0 })
 * console.log(marginFindings({ page: 1, metrics }).map((f) => f.code))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const marginFindings = (input: {
  readonly page: number;
  readonly metrics: PageMetrics;
}): ReadonlyArray<SheetFinding> => {
  const { page, metrics } = input;
  return pipe(
    metrics.inkBounds,
    O.match({
      onNone: () => [pageFinding("blank-page", page, "No ink on the page.")],
      onSome: (ink) => {
        const measured = {
          top: cm(ink.minY, metrics.dpi),
          left: cm(ink.minX, metrics.dpi),
          right: cm(metrics.width - 1 - ink.maxX, metrics.dpi),
          bottom: cm(metrics.height - 1 - ink.maxY, metrics.dpi),
        };
        const check = (side: keyof typeof MARGINS_CM, code: SheetFinding["code"]) =>
          measured[side] + 1e-9 < MARGINS_CM[side]
            ? O.some(
                pageFinding(
                  code,
                  page,
                  `${side} margin ${measured[side].toFixed(2)} cm is under ${MARGINS_CM[side].toFixed(1)} cm.`
                )
              )
            : O.none();
        return A.getSomes([
          check("top", "margin-top"),
          check("left", "margin-left"),
          check("right", "margin-right"),
          check("bottom", "margin-bottom"),
        ]);
      },
    })
  );
};

/**
 * Findings from a non-anti-aliased render of one page: colour purity and
 * solid-black areas.
 *
 * **Example** (A page with gray)
 *
 * ```ts
 * import { PageMetrics, ValidationOptions, purityFindings } from "@beep/technical-drawing"
 * import * as O from "effect/Option"
 *
 * const metrics = PageMetrics.make({ width: 2550, height: 3300, dpi: 300, antiAliased: false, inkBounds: O.none(), inkPixels: 0, impurePixels: 12, largestBlackSquare: 0 })
 * console.log(purityFindings({ page: 1, metrics, options: ValidationOptions.make({ expectedPages: O.none() }) }).map((f) => f.code))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const purityFindings = (input: {
  readonly page: number;
  readonly metrics: PageMetrics;
  readonly options: ValidationOptions;
}): ReadonlyArray<SheetFinding> => {
  const { page, metrics, options } = input;
  const impure =
    metrics.impurePixels > 0
      ? [
          pageFinding(
            "impure-pixels",
            page,
            `${metrics.impurePixels} pixel(s) at ${metrics.dpi} dpi are neither pure black nor pure white.`
          ),
        ]
      : [];
  const squareMm = (metrics.largestBlackSquare / metrics.dpi) * 25.4;
  const solid =
    squareMm > options.maxSolidBlackMm
      ? [
          pageFinding(
            "solid-black-area",
            page,
            `A solid-black square of ${squareMm.toFixed(2)} mm at ${metrics.dpi} dpi exceeds ${options.maxSolidBlackMm} mm.`
          ),
        ]
      : [];
  return [...impure, ...solid];
};
