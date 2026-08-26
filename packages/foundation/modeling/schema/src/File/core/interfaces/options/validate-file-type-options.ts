/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { DetectFileOptions } from "./detect-file-options.ts";
import { FileValidatorOptions } from "./file-validator-options.ts";

const $I = $SchemaId.create("File/core/interfaces/options/validate-file-type-options");

/**
 * Combines byte-window and related-format controls for file validation.
 *
 * **Example** (Configure strict file validation)
 *
 * ```ts
 * import { ValidateFileTypeOptions } from "@beep/schema/File"
 *
 * const options = ValidateFileTypeOptions.make({
 *   chunkSize: 128,
 *   excludeSimilarTypes: true,
 * })
 *
 * console.log(options.chunkSize)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ValidateFileTypeOptions extends S.Class<ValidateFileTypeOptions>($I`ValidateFileTypeOptions`)(
  {
    ...DetectFileOptions.fields,
    ...FileValidatorOptions.fields,
  },
  $I.annote("ValidateFileTypeOptions", {
    description: "Options that control byte-window and related-format behavior during file validation.",
  })
) {}
