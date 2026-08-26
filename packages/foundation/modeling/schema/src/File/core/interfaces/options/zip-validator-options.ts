/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("File/core/interfaces/options/zip-validator-options");

/**
 * Configures how many leading bytes ZIP validation inspects.
 *
 * **Example** (Inspect a larger ZIP header)
 *
 * ```ts
 * import { ZipValidatorOptions } from "@beep/schema/File"
 *
 * const options = ZipValidatorOptions.make({ chunkSize: 128 })
 * console.log(options.chunkSize)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ZipValidatorOptions extends S.Class<ZipValidatorOptions>($I`ZipValidatorOptions`)(
  { chunkSize: S.optionalKey(S.Finite) },
  $I.annote("ZipValidatorOptions", {
    description: "Options that control how many leading bytes ZIP validation inspects.",
  })
) {}
