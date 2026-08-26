/**
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

export declare namespace FileInfo {
  export interface Encoded {
    readonly description: string;
    readonly extension: string;
    readonly mimeType: string;
    readonly signatures: ReadonlyArray<FileSignature.Encoded>;
  }
}
