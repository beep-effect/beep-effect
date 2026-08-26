/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { pipe } from "effect";
import * as S from "effect/Schema";
import { arr } from "./common.ts";
import { FileSignature } from "./file-signature.ts";

const $I = $SchemaId.create("File/core/types/file-info");

/**
 * Information about a file
 * @category models
 * @since 0.0.0
 */
export class FileInfo extends S.Class<FileInfo>($I`FileInfo`)(
  S.Struct({
    extension: S.String,
    mimeType: S.String,
    description: S.String,
    signatures: pipe(FileSignature, arr),
  }),
  $I.annote("FileInfo", {
    description: "",
  })
) {}

/**
 * Encoded representation of {@link FileInfo}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace FileInfo {
  /**
   * Serializable file information produced by schema encoding.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly description: string;
    readonly extension: string;
    readonly mimeType: string;
    readonly signatures: ReadonlyArray<FileSignature.Encoded>;
  }
}
