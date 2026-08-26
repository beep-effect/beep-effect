import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import { FILE_TYPES_REQUIRED_ADDITIONAL_CHECK, FileTypes } from "../core/index.ts";
import { getFileChunk } from "../utils/index.ts";
import type { FileInfo, FileSignature, ValidateFileTypeOptions } from "../core/index.ts";

export * from "./audio.ts";
export * from "./compressed.ts";
export * from "./image.ts";
export * from "./other.ts";
export * from "./video.ts";

/**
 * Validates the requested file signature against a list of accepted file types
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 * @param types A list of accepted file types
 * @param options parameters for additional actions
 *
 * @returns {boolean} True if found a type signature from the accepted file types, otherwise false
 */
export const validateFileType: {
  (
    file: ReadonlyArray<number> | ArrayBuffer | Uint8Array,
    types: ReadonlyArray<string>,
    options?: ValidateFileTypeOptions
  ): boolean;
  (
    types: ReadonlyArray<string>,
    options?: ValidateFileTypeOptions
  ): (file: ReadonlyArray<number> | ArrayBuffer | Uint8Array) => boolean;
} = dual(
  3,
  (
    file: ReadonlyArray<number> | ArrayBuffer | Uint8Array,
    types: ReadonlyArray<string>,
    options?: ValidateFileTypeOptions
  ): boolean => {
    let typeExtensions: Array<string> = [];
    const uniqueTypes = [
      ...new Set(
        types.map((type) => {
          const normalizedType = type.split(".").join("").toUpperCase();
          if (normalizedType === "7Z") return `_${normalizedType}`;
          return normalizedType;
        })
      ),
    ];
    for (const type of uniqueTypes) {
      if (!Object.prototype.hasOwnProperty.call(FileTypes, type))
        throw new TypeError(
          `Type \`${type.toLowerCase()}\` is not supported. Please make sure that the \`types\` list contains only supported files`
        );
      typeExtensions.push(type);
    }

    if (
      P.isNotUndefined(options) &&
      Object.prototype.hasOwnProperty.call(options, "chunkSize") &&
      (options?.chunkSize ?? 0) <= 0
    )
      throw new RangeError("chunkSize must be bigger than zero");

    if (P.isUndefined(options) || P.isUndefined(options?.excludeSimilarTypes)) {
      const similarTypes: ReadonlyArray<string> = addSimilarTypes(typeExtensions);
      if (similarTypes.length > 0) typeExtensions = typeExtensions.concat(similarTypes);
    }

    let acceptedSignatures: Array<FileSignature> = [];
    const filesRequiredAdditionalCheck: Array<FileInfo> = [];
    for (const type of typeExtensions) {
      const extensionSignatures: ReadonlyArray<FileSignature> = FileTypes.getSignaturesByName(type);
      acceptedSignatures = acceptedSignatures.concat(extensionSignatures);
      if (FILE_TYPES_REQUIRED_ADDITIONAL_CHECK.includes(type.toLowerCase())) {
        filesRequiredAdditionalCheck.push(FileTypes.getInfoByName(type));
      }
    }

    const fileChunk: ReadonlyArray<number> = getFileChunk(file, options?.chunkSize || 64);

    const detectedSignature = FileTypes.detectSignature(fileChunk, acceptedSignatures);

    if (P.isUndefined(detectedSignature)) return false;

    if (filesRequiredAdditionalCheck.length > 0) {
      const detectedFilesForAdditionalCheck: ReadonlyArray<FileInfo> = filesRequiredAdditionalCheck.filter((frac) =>
        frac.signatures.includes(detectedSignature)
      );
      if (detectedFilesForAdditionalCheck.length > 0) {
        // Some files share the same signature. Additional check required
        const detectedType = FileTypes.detectTypeByAdditionalCheck(fileChunk, detectedFilesForAdditionalCheck);
        if (P.isUndefined(detectedType)) return false;

        return typeExtensions.some((df) => df.toLowerCase() === detectedType);
      }
    }

    return true;
  }
);

function addSimilarTypes(requiredTypes: ReadonlyArray<string>): ReadonlyArray<string> {
  if (requiredTypes.some((type) => type === "MP4")) return ["M4V"];
  if (requiredTypes.some((type) => type === "AAC")) return ["M4A"];

  return [];
}
