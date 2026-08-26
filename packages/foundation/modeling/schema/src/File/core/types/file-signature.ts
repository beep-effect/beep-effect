/**
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as SchemaUtils from "../../../SchemaUtils/index.ts";
import { arr, NumOrStr, numArr, optStr, strArr } from "./common.ts";

const $I = $SchemaId.create("File/core/types/file-signature");
/**
 * Information about a unique file signature
 */
export class FileSignature extends S.Class<FileSignature>($I`FileSignature`)(
  {
    sequence: arr(NumOrStr),
    offset: S.Finite.pipe(SchemaUtils.withKeyDefaults(0)),
    skippedBytes: numArr,
    description: optStr,
    compatibleExtensions: strArr,
  },
  $I.annote("FileSignature", {
    description: "",
  })
) {}

export declare namespace FileSignature {
  export interface Encoded {
    readonly compatibleExtensions?: undefined | ReadonlyArray<string>;
    readonly description?: undefined | string;
    readonly offset?: undefined | number;
    readonly sequence: ReadonlyArray<number | string>;
    readonly skippedBytes?: undefined | ReadonlyArray<number>;
  }
}
