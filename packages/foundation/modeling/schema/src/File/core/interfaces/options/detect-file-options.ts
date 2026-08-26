/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("File/core/interfaces/options/detect-file-options");

/**
 * Configures how many leading bytes file detection inspects.
 *
 * **Example** (Inspect 128 bytes)
 *
 * ```ts
 * import { DetectFileOptions } from "@beep/schema/File"
 *
 * const options = DetectFileOptions.make({ chunkSize: 128 })
 * console.log(options.chunkSize)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class DetectFileOptions extends S.Class<DetectFileOptions>($I`DetectFileOptions`)(
  { chunkSize: S.optionalKey(S.Finite) },
  $I.annote("DetectFileOptions", {
    description: "Options that control how many leading bytes file detection inspects.",
  })
) {}
