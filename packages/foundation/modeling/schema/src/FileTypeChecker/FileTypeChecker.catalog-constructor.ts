/**
 * Private construction adapter for authored file-type catalog declarations.
 *
 * @since 0.0.0
 */

import { Order, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { FileSignature, FileTypeInfo } from "./FileTypeChecker.schema.ts";
import type { FileType } from "./FileTypeChecker.schema.ts";

type CatalogFileSignature = {
  readonly sequence: typeof FileSignature.fields.sequence.Type;
  readonly offset?: number;
  readonly skippedBytes?: ReadonlyArray<number>;
  readonly description?: string;
  readonly compatibleExtensions?: typeof FileSignature.fields.compatibleExtensions.Type;
};

type CatalogFileTypeInfo<Extension extends FileType = FileType> = {
  readonly extension: Extension;
  readonly mimeType: typeof FileTypeInfo.fields.mimeType.Type;
  readonly description: string;
  readonly signatures: A.NonEmptyReadonlyArray<CatalogFileSignature>;
};

/**
 * Converts concise authored catalog data into schema-validated file-type metadata.
 *
 * **Example** (Construct PNG metadata)
 *
 * ```ts
 * import { makeCatalogFileTypeInfo } from "@beep/schema/FileTypeChecker/FileTypeChecker.catalog-constructor"
 *
 * const info = makeCatalogFileTypeInfo({
 *   extension: "png",
 *   mimeType: "image/png",
 *   description: "Portable Network Graphics",
 *   signatures: [{ sequence: [0x89, 0x50, 0x4e, 0x47] }]
 * })
 * console.log(info.extension) // "png"
 * ```
 *
 * @internal
 * @category factories
 * @since 0.0.0
 */
export function makeCatalogFileTypeInfo<const Extension extends FileType>(
  input: CatalogFileTypeInfo<Extension>
): FileTypeInfo & { readonly extension: Extension };
export function makeCatalogFileTypeInfo(input: CatalogFileTypeInfo): FileTypeInfo {
  return FileTypeInfo.make({
    ...input,
    signatures: A.map(input.signatures, (signature) =>
      FileSignature.make({
        ...signature,
        skippedBytes: pipe(signature.skippedBytes, O.fromUndefinedOr, O.getOrElse(A.empty), A.sort(Order.Number)),
        description: O.fromUndefinedOr(signature.description),
        compatibleExtensions: pipe(
          signature.compatibleExtensions,
          O.fromUndefinedOr,
          O.getOrElse(A.empty),
          A.sort(Order.String)
        ),
      })
    ),
  });
}
