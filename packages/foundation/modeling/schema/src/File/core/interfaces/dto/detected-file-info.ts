/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { FileSignature } from "../../types/index.ts";

const $I = $SchemaId.create("File/core/interfaces/dto/detected-file-info");

/**
 * Describes a detected file and the signature that matched its content.
 *
 * **Example** (Describe a detected PNG file)
 *
 * ```ts
 * import { DetectedFileInfo, FileSignature } from "@beep/schema/File"
 *
 * const detected = DetectedFileInfo.make({
 *   description: "Portable Network Graphics image",
 *   extension: "png",
 *   mimeType: "image/png",
 *   signature: FileSignature.make({ sequence: [0x89, 0x50, 0x4e, 0x47] }),
 * })
 *
 * console.log(detected.extension)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class DetectedFileInfo extends S.Class<DetectedFileInfo>($I`DetectedFileInfo`)(
  {
    description: S.String,
    extension: S.String,
    mimeType: S.String,
    signature: FileSignature,
  },
  $I.annote("DetectedFileInfo", {
    description: "A detected file type paired with the signature that matched its content.",
  })
) {}
