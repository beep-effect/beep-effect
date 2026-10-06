/**
 * Private pdf-lib walk that extracts the structural facts a filing validator
 * needs: header version, page sizes, fonts and their embedding, annotations,
 * optional content, encryption.
 *
 * @internal
 */

import { A, O } from "@beep/utils";
import { MutableHashMap, Order, pipe } from "effect";
import { PDFArray, PDFDict, PDFName, PDFRef } from "pdf-lib";
import { PageSize, PdfFont, PdfStructure } from "../PdfTools.models.ts";
import type { PDFDocument } from "pdf-lib";

const headerPattern = /^%PDF-(\d\.\d)/;

const headerVersion = (bytes: Uint8Array): string =>
  pipe(
    O.fromNullishOr(headerPattern.exec(new TextDecoder("latin1").decode(bytes.subarray(0, 16)))),
    O.flatMap((match) => O.fromUndefinedOr(match[1])),
    O.getOrElse(() => "")
  );

const fontProgramKeys = ["FontFile", "FontFile2", "FontFile3"].map((k) => PDFName.of(k));

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
  const pages = doc.getPages().map((page) => {
    const annots = page.node.Annots();
    annotationCount += annots === undefined ? 0 : annots.size();
    pipe(
      O.fromUndefinedOr(page.node.Resources()),
      O.flatMap((resources) => resolveDict(doc, resources.get(PDFName.of("Font")))),
      O.map((fontDict) => {
        fontDict.entries().forEach(([, value]) => {
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
