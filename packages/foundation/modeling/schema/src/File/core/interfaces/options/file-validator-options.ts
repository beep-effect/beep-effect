/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("File/core/interfaces/options/file-validator-options");

/**
 * Controls whether validators accept closely related file formats.
 *
 * **Example** (Reject similar formats)
 *
 * ```ts
 * import { FileValidatorOptions } from "@beep/schema/File"
 *
 * const options = FileValidatorOptions.make({ excludeSimilarTypes: true })
 * console.log(options.excludeSimilarTypes)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class FileValidatorOptions extends S.Class<FileValidatorOptions>($I`FileValidatorOptions`)(
  { excludeSimilarTypes: S.optionalKey(S.Boolean) },
  $I.annote("FileValidatorOptions", {
    description: "Options that control whether validators accept closely related file formats.",
  })
) {}
