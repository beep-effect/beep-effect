/**
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("File/File.model");

export const NumOrStr = S.Union([
  S.Finite.pipe(
    S.decodeTo(S.TaggedStruct("Number", { value: S.Finite }), {
      decode: SchemaGetter.transform((num) => ({
        _tag: "Number" as const,
        value: num,
      })),
      encode: SchemaGetter.transform((num) => num.value),
    })
  ),
  S.String.pipe(
    S.decodeTo(S.TaggedStruct("String", { value: S.String }), {
      decode: SchemaGetter.transform((str) => ({
        _tag: "String" as const,
        value: str,
      })),
      encode: SchemaGetter.transform((str) => str.value),
    })
  ),
]).pipe(S.toTaggedUnion("_tag"));

export type NumOrStr = typeof NumOrStr.Type;

export declare namespace NumberOrString {
  export type Encoded = string | number;
}

const boolDefaultFalse = S.Boolean.pipe(SchemaUtils.withKeyDefaults(false));

const opt = <T extends S.Top>(schema: T) => schema.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);

const optNum = opt(S.Finite);
const optStr = opt(S.String);

const arr = <T extends S.Top>(schema: T) => schema.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults);

const strArr = arr(S.String);
const numArr = arr(S.Finite);

/**
 * Information about a unique file signature
 */
export class FileSignature extends S.Class<FileSignature>($I`FileSignature`)(
  {
    sequence: arr(NumOrStr),
    offset: optNum,
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

/**
 * Information about a file
 */
export class FileInfo extends S.Class<FileInfo>($I`FileInfo`)(
  S.Struct({
    extension: S.String,
    mimeType: S.String,
    description: S.String,
    signatures: arr(FileSignature),
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
/**
 * Options used to pass to detect file function.
 */
export class DetectFileOptions extends S.Class<DetectFileOptions>($I`DetectFileOptions`)(
  {
    chunkSize: optNum,
  },
  $I.annote("DetectFileOptions", {
    description: "",
  })
) {}

/**
 * Options used to pass to detect file function.
 */
export declare namespace DetectFileOptions {
  export interface Encoded {
    readonly chunkSize?: undefined | number;
  }
}

/**
 * Options used to pass to validators functions.
 */
export class FileValidatorOptions extends S.Class<FileValidatorOptions>($I`FileValidatorOptions`)(
  {
    excludeSimilarTypes: boolDefaultFalse,
  },
  $I.annote("FileValidatorOptions", {
    description: "",
  })
) {}

/**
 * Options used to pass to validate file type function.
 */
export class ValidateFileTypeOptions extends S.Class<ValidateFileTypeOptions>($I`ValidateFileTypeOptions`)(
  {
    ...FileValidatorOptions.fields,
    ...DetectFileOptions.fields,
  },
  $I.annote("ValidateFileTypeOptions", {
    description: "",
  })
) {}

export declare namespace ValidateFileTypeOptions {
  export interface Encoded {
    readonly chunkSize?: undefined | number;
    readonly excludeSimilarTypes?: undefined | boolean;
  }
}

/**
 * Options passed to the `isZIP` function.
 */
export class ZipValidatorOptions extends S.Class<ZipValidatorOptions>($I`ZipValidatorOptions`)(
  {
    chunkSize: optNum,
  },
  $I.annote("ZipValidatorOptions", {
    description: "",
  })
) {}

export declare namespace ZipValidatorOptions {
  export interface Encoded {
    readonly chunkSize?: undefined | number;
  }
}
