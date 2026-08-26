/**
 * Canonical catalog of supported file types and signatures.
 *
 * @since 0.0.0
 */

import { assetCatalog } from "./FileTypeChecker.asset-catalog.ts";
import { audioCatalog } from "./FileTypeChecker.audio-catalog.ts";
import { compressedCatalog } from "./FileTypeChecker.compressed-catalog.ts";
import { documentCatalog } from "./FileTypeChecker.document-catalog.ts";
import { executableCatalog } from "./FileTypeChecker.executable-catalog.ts";
import { imageCatalog } from "./FileTypeChecker.image-catalog.ts";
import { structuredDataCatalog } from "./FileTypeChecker.structured-data-catalog.ts";
import { videoCatalog } from "./FileTypeChecker.video-catalog.ts";
import type { FileType, FileTypeInfo } from "./FileTypeChecker.schema.ts";

type CorrelatedFileTypeCatalog = {
  readonly [K in FileType]: FileTypeInfo & { readonly extension: K };
};

/**
 * File metadata indexed by its canonical lowercase extension.
 *
 * **Details**
 *
 * Every value is constructed by the {@link FileTypeInfo} schema. The mapped
 * type keeps each key correlated with its value's extension, so adding a
 * supported {@link FileType} requires matching metadata in the same change.
 *
 * **Example** (Read the PNG signatures)
 *
 * ```ts import.meta.vitest name="Read the PNG signatures"
 * import { FileTypeCatalog } from "@beep/schema/FileTypeChecker"
 *
 * FileTypeCatalog.png.mimeType // => "image/png"
 * FileTypeCatalog.png.signatures.length > 0 // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FileTypeCatalog = {
  ...audioCatalog,
  ...compressedCatalog,
  ...imageCatalog,
  ...assetCatalog,
  ...documentCatalog,
  ...executableCatalog,
  ...structuredDataCatalog,
  ...videoCatalog,
} satisfies CorrelatedFileTypeCatalog;
