/**
 * Internal asset entries for the file-type catalog.
 *
 * @internal
 * @since 0.0.0
 */

import { makeCatalogFileTypeInfo } from "./FileTypeChecker.catalog-constructor.ts";
import type { FileTypeInfo } from "./FileTypeChecker.schema.ts";

type AssetFileType = "blend" | "stl" | "ttf";
type AssetCatalog = { readonly [K in AssetFileType]: FileTypeInfo & { readonly extension: K } };

/**
 * Internal asset metadata keyed by canonical extension.
 *
 * **Example** (Read asset metadata)
 *
 * ```ts
 * import { assetCatalog } from "@beep/schema/FileTypeChecker/FileTypeChecker.asset-catalog"
 *
 * console.log(assetCatalog.blend.extension) // "blend"
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const assetCatalog: AssetCatalog = {
  blend: makeCatalogFileTypeInfo({
    extension: "blend",
    mimeType: "application/x-blender",
    description: "Blender File Format",
    signatures: [
      {
        sequence: [0x42, 0x4c, 0x45, 0x4e, 0x44, 0x45, 0x52],
      },
    ],
  }),
  stl: makeCatalogFileTypeInfo({
    extension: "stl",
    mimeType: "application/sla",
    description: "ASCII STL (STereoLithography) file for 3D printing",
    signatures: [
      {
        sequence: [0x73, 0x6f, 0x6c, 0x69, 0x64],
      },
    ],
  }),
  ttf: makeCatalogFileTypeInfo({
    extension: "ttf",
    mimeType: "application/x-font-ttf",
    description: "TrueType font file",
    signatures: [
      {
        sequence: [0x74, 0x72, 0x75, 0x65, 0x00],
      },
      {
        sequence: [0x00, 0x01, 0x00, 0x00, 0x00],
        compatibleExtensions: ["ttc", "dfont"],
      },
    ],
  }),
};
