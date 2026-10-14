/**
 * Private pdf-lib walk that extracts the structural facts a filing validator
 * needs: header version, page sizes, fonts and their embedding, annotations,
 * optional content, encryption; and the annotation objects a reviewer left.
 *
 * @internal
 */

import { A, O } from "@beep/utils";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import { PDFArray, PDFDict, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString } from "pdf-lib";
import { PageSize, PdfAnnotation, PdfFont, PdfRect, PdfStructure } from "../PdfTools.models.ts";
import type { PDFDocument } from "pdf-lib";

const headerPattern = /^%PDF-(\d\.\d)/;

const headerVersion = (bytes: Uint8Array): string =>
  pipe(
    O.fromNullishOr(headerPattern.exec(new TextDecoder("latin1").decode(bytes.subarray(0, 16)))),
    O.flatMap((match) => O.fromUndefinedOr(match[1])),
    O.getOrElse(() => "")
  );

const fontProgramKeys = A.map(["FontFile", "FontFile2", "FontFile3"], (k) => PDFName.of(k));

const resolveDict = (doc: PDFDocument, value: unknown): O.Option<PDFDict> => {
  const resolved = value instanceof PDFRef ? doc.context.lookup(value) : value;
  return resolved instanceof PDFDict ? O.some(resolved) : O.none();
};

const isEmbedded = (doc: PDFDocument, font: PDFDict): boolean => {
  const descendants = font.get(PDFName.of("DescendantFonts"));
  const resolvedDescendants = descendants instanceof PDFRef ? doc.context.lookup(descendants) : descendants;
  if (resolvedDescendants instanceof PDFArray) {
    return pipe(
      resolvedDescendants.asArray(),
      A.some((entry) =>
        pipe(
          resolveDict(doc, entry),
          O.map((d) => isEmbedded(doc, d)),
          O.getOrElse(() => false)
        )
      )
    );
  }
  return pipe(
    resolveDict(doc, font.get(PDFName.of("FontDescriptor"))),
    O.map((descriptor) => A.some(fontProgramKeys, (key) => descriptor.has(key))),
    O.getOrElse(() => false)
  );
};

const fontName = (font: PDFDict): string => {
  const base = font.get(PDFName.of("BaseFont"));
  return base instanceof PDFName ? base.decodeText() : "";
};

const fontOrder = Order.mapInput(Order.String, (font: PdfFont) => font.name);

/**
 * Extract the structure of a loaded document.
 *
 * @internal
 */
export const structureOf = (options: { readonly bytes: Uint8Array; readonly doc: PDFDocument }): PdfStructure => {
  const { bytes, doc } = options;
  const fonts = MutableHashMap.empty<string, PdfFont>();
  let annotationCount = 0;
  const pages = A.map(doc.getPages(), (page) => {
    const annots = page.node.Annots();
    annotationCount += annots === undefined ? 0 : annots.size();
    pipe(
      O.fromUndefinedOr(page.node.Resources()),
      O.flatMap((resources) => resolveDict(doc, resources.get(PDFName.of("Font")))),
      O.map((fontDict) => {
        A.forEach(fontDict.entries(), ([, value]) => {
          pipe(
            resolveDict(doc, value),
            O.map((font) => {
              const name = fontName(font);
              const key = value instanceof PDFRef ? value.toString() : name;
              MutableHashMap.set(fonts, key, PdfFont.make({ name, embedded: isEmbedded(doc, font) }));
            })
          );
        });
      })
    );
    const { width, height } = page.getSize();
    return PageSize.make({ widthPt: width, heightPt: height });
  });
  return PdfStructure.make({
    headerVersion: headerVersion(bytes),
    pages,
    fonts: pipe(A.fromIterable(MutableHashMap.values(fonts)), A.sort(fontOrder)),
    annotationCount,
    hasOptionalContent: doc.catalog.has(PDFName.of("OCProperties")),
    encrypted: doc.isEncrypted,
  });
};

const textOf = (doc: PDFDocument, value: unknown): O.Option<string> => {
  const resolved = value instanceof PDFRef ? doc.context.lookup(value) : value;
  return resolved instanceof PDFString || resolved instanceof PDFHexString ? O.some(resolved.decodeText()) : O.none();
};

const numbersOf = (doc: PDFDocument, value: unknown): ReadonlyArray<number> => {
  const resolved = value instanceof PDFRef ? doc.context.lookup(value) : value;
  return resolved instanceof PDFArray
    ? A.map(resolved.asArray(), (entry) => (entry instanceof PDFNumber ? entry.asNumber() : Number.NaN))
    : [];
};

// `/Rect` is [llx lly urx ury] in default user space, bottom-left up; convert
// to points from the crop box's top-left corner, the pdftotext frame.
const rectOf = (
  numbers: ReadonlyArray<number>,
  box: { readonly x: number; readonly y: number; readonly height: number }
): O.Option<PdfRect> => {
  const [x1 = Number.NaN, y1 = Number.NaN, x2 = Number.NaN, y2 = Number.NaN] = numbers;
  if (A.length(numbers) !== 4 || !A.every([x1, y1, x2, y2], Number.isFinite)) {
    return O.none();
  }
  const top = box.y + box.height;
  return O.some(
    PdfRect.make({
      xMin: Math.min(x1, x2) - box.x,
      yMin: top - Math.max(y1, y2),
      xMax: Math.max(x1, x2) - box.x,
      yMax: top - Math.min(y1, y2),
    })
  );
};

/**
 * Every annotation object on every page, in page order; entries without a
 * readable `/Rect` are skipped.
 *
 * @internal
 */
export const annotationsOf = (doc: PDFDocument): ReadonlyArray<PdfAnnotation> =>
  A.flatMap(doc.getPages(), (page, index) => {
    const annots = page.node.Annots();
    const box = page.getCropBox();
    return pipe(
      annots === undefined ? [] : annots.asArray(),
      A.map((entry) =>
        pipe(
          resolveDict(doc, entry),
          O.flatMap((dict) =>
            O.map(rectOf(numbersOf(doc, dict.get(PDFName.of("Rect"))), box), (rect) => {
              const subtype = dict.get(PDFName.of("Subtype"));
              return PdfAnnotation.make({
                page: index + 1,
                subtype: subtype instanceof PDFName ? subtype.decodeText() : "",
                rect,
                contents: textOf(doc, dict.get(PDFName.of("Contents"))),
                author: textOf(doc, dict.get(PDFName.of("T"))),
              });
            })
          )
        )
      ),
      A.getSomes
    );
  });
