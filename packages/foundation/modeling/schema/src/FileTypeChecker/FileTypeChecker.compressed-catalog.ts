/**
 * Internal archive entries for the file-type catalog.
 *
 * @internal
 * @since 0.0.0
 */

import { makeCatalogFileTypeInfo } from "./FileTypeChecker.catalog-constructor.ts";
import type { FileTypeInfo } from "./FileTypeChecker.schema.ts";

type CompressedFileType = "7z" | "lzh" | "rar" | "zip";
type CompressedCatalog = { readonly [K in CompressedFileType]: FileTypeInfo & { readonly extension: K } };

/**
 * Internal archive metadata keyed by canonical extension.
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const compressedCatalog: CompressedCatalog = {
  "7z": makeCatalogFileTypeInfo({
    extension: "7z",
    mimeType: "application/x-7z-compressed",
    description: "7-Zip compressed file",
    signatures: [
      {
        sequence: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
      },
    ],
  }),

  lzh: makeCatalogFileTypeInfo({
    extension: "lzh",
    mimeType: "application/x-lzh-compressed",
    description: "Compressed file using Lempel-Ziv and Haruyasu (LZH) compression algorithm",
    signatures: [
      {
        sequence: [0x2d, 0x68, 0x6c, 0x30, 0x2d],
        description: "Lempel Ziv Huffman archive file Method 0 (No compression)",
        compatibleExtensions: ["lha"],
      },
      {
        sequence: [0x2d, 0x68, 0x6c, 0x35, 0x2d],
        description: "Lempel Ziv Huffman archive file Method 5 (8KiB sliding window)",
        compatibleExtensions: ["lha"],
      },
    ],
  }),

  rar: makeCatalogFileTypeInfo({
    extension: "rar",
    mimeType: "application/x-rar-compressed",
    description: "Roshal ARchive compressed archive file",
    signatures: [
      {
        sequence: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00],
        description: "Compressed archive v5.00 onwards",
      },
      {
        sequence: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00],
        description: "Compressed archive v1.50 onwards",
      },
    ],
  }),

  zip: makeCatalogFileTypeInfo({
    extension: "zip",
    mimeType: "application/zip",
    description: "Compressed archive file",
    signatures: [
      {
        sequence: [0x57, 0x69, 0x6e, 0x5a, 0x69, 0x70],
        offset: 29152,
        description: "WinZip compressed archive",
      },
      {
        sequence: [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x01, 0x00, 0x63, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: "ZLock Pro encrypted ZIP",
      },
      {
        sequence: [0x50, 0x4b, 0x4c, 0x49, 0x54, 0x45],
        offset: 30,
        description: "PKLITE compressed ZIP archive (see also PKZIP)",
      },
      {
        sequence: [0x50, 0x4b, 0x53, 0x70, 0x58],
        offset: 526,
        description: "PKSFX self-extracting executable compressed file (see also PKZIP)",
      },
      {
        sequence: [0x50, 0x4b, 0x03, 0x04],
        description: "PKZIP archive file - zip file format and multiple formats based on it",
        compatibleExtensions: [
          "aar",
          "apk",
          "docx",
          "epub",
          "ipa",
          "jar",
          "kmz",
          "maff",
          "msix",
          "odp",
          "ods",
          "odt",
          "pk3",
          "pk4",
          "pptx",
          "usdz",
          "vsdx",
          "xlsx",
          "xpi",
        ],
      },
      {
        sequence: [0x50, 0x4b, 0x05, 0x06],
        description: "PKZIP empty archive file - zip file format and multiple formats based on it",
        compatibleExtensions: [
          "aar",
          "apk",
          "docx",
          "epub",
          "ipa",
          "jar",
          "kmz",
          "maff",
          "msix",
          "odp",
          "ods",
          "odt",
          "pk3",
          "pk4",
          "pptx",
          "usdz",
          "vsdx",
          "xlsx",
          "xpi",
        ],
      },
      {
        sequence: [0x50, 0x4b, 0x07, 0x08],
        description: "PKZIP multivolume archive file - zip file format and multiple formats based on it",
        compatibleExtensions: [
          "aar",
          "apk",
          "docx",
          "epub",
          "ipa",
          "jar",
          "kmz",
          "maff",
          "msix",
          "odp",
          "ods",
          "odt",
          "pk3",
          "pk4",
          "pptx",
          "usdz",
          "vsdx",
          "xlsx",
          "xpi",
        ],
      },
    ],
  }),
};
