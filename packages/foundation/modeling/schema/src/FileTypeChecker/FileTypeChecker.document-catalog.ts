/**
 * Internal document entries for the file-type catalog.
 *
 * @internal
 * @since 0.0.0
 */

import { makeCatalogFileTypeInfo } from "./FileTypeChecker.catalog-constructor.ts";
import type { FileTypeInfo } from "./FileTypeChecker.schema.ts";

type DocumentFileType = "doc" | "indd" | "pdf" | "ps" | "rtf";
type DocumentCatalog = { readonly [K in DocumentFileType]: FileTypeInfo & { readonly extension: K } };

/**
 * Internal document metadata keyed by canonical extension.
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const documentCatalog: DocumentCatalog = {
  doc: makeCatalogFileTypeInfo({
    extension: "doc",
    mimeType: "application/msword",
    description: "Old Microsoft Word documents",
    signatures: [
      {
        sequence: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // Word 97-2003 for OLECF
        compatibleExtensions: ["xls", "ppt", "msi", "msg", "dot", "pps", "xla", "wiz"],
        description:
          "An Object Linking and Embedding (OLE) Compound File (CF) (i.e., OLECF) file format, known as Compound Binary File format by Microsoft, used by Microsoft Office 97-2003 applications",
      },
      {
        sequence: [0xdb, 0xa5, 0x2d, 0x00],
        description: "Microsoft Word 2.0 file format",
      },
    ],
  }),
  indd: makeCatalogFileTypeInfo({
    extension: "indd",
    mimeType: "application/x-indesign",
    description: "Adobe InDesign document",
    signatures: [
      {
        sequence: [0x06, 0x06, 0xed, 0xf5, 0xd8, 0x1d, 0x46, 0xe5, 0xbd, 0x31, 0xef, 0xe7, 0xfe, 0x74, 0xb7, 0x1d],
        compatibleExtensions: ["indt"],
      },
    ],
  }),
  pdf: makeCatalogFileTypeInfo({
    extension: "pdf",
    mimeType: "application/pdf",
    description: "Portable Document Format",
    signatures: [
      {
        sequence: [0x25, 0x50, 0x44, 0x46, 0x2d],
      },
    ],
  }),
  ps: makeCatalogFileTypeInfo({
    extension: "ps",
    mimeType: "application/postscript",
    description: "PostScript document",
    signatures: [
      {
        sequence: [0x25, 0x21, 0x50, 0x53],
      },
    ],
  }),
  rtf: makeCatalogFileTypeInfo({
    extension: "rtf",
    mimeType: "application/rtf",
    description: "Rich Text Format word processing file",
    signatures: [
      {
        sequence: [0x7b, 0x5c, 0x72, 0x74, 0x66, 0x31],
      },
    ],
  }),
};
