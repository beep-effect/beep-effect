/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { FILE_TYPES_REQUIRED_ADDITIONAL_CHECK, FileTypes } from "../core/index.ts";
import { getFileChunk } from "../utils/index.ts";
import type { FileInfo, FileSignature, ValidateFileTypeOptions } from "../core/index.ts";

/**
 * Re-exports declarations from the File module.
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./audio.ts";
/**
 * Re-exports declarations from the File module.
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./compressed.ts";
/**
 * Re-exports declarations from the File module.
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./image.ts";
/**
 * Re-exports declarations from the File module.
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./other.ts";
/**
 * Re-exports declarations from the File module.
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./video.ts";

type FileContent = ReadonlyArray<number> | ArrayBuffer | Uint8Array;

const normalizeType = (type: string): string => {
  const normalized = Str.toUpperCase(Str.replaceAll(".", "")(type));
  return normalized === "7Z" ? "_7Z" : normalized;
};

const resolveTypeExtensions = (types: ReadonlyArray<string>, excludeSimilarTypes: boolean): ReadonlyArray<string> => {
  const uniqueTypes = Array.from(new Set(types.map(normalizeType)));
  for (const type of uniqueTypes) {
    if (!Object.prototype.hasOwnProperty.call(FileTypes, type)) {
      throw new TypeError(
        `Type \`${Str.toLowerCase(type)}\` is not supported. Please make sure that the \`types\` list contains only supported files`
      );
    }
  }
  return excludeSimilarTypes
    ? uniqueTypes
    : Array.from(new Set(uniqueTypes.concat(uniqueTypes.flatMap((type) => addSimilarTypes([type])))));
};

const collectValidationCandidates = (
  typeExtensions: ReadonlyArray<string>
): {
  readonly acceptedSignatures: ReadonlyArray<FileSignature>;
  readonly filesRequiredAdditionalCheck: ReadonlyArray<FileInfo>;
} => ({
  acceptedSignatures: typeExtensions.flatMap((type) => FileTypes.getSignaturesByName(type)),
  filesRequiredAdditionalCheck: typeExtensions
    .filter((type) => FILE_TYPES_REQUIRED_ADDITIONAL_CHECK.includes(Str.toLowerCase(type)))
    .map((type) => FileTypes.getInfoByName(type)),
});

const passesAdditionalCheck = (
  fileChunk: ReadonlyArray<number>,
  detectedSignature: FileSignature,
  typeExtensions: ReadonlyArray<string>,
  filesRequiredAdditionalCheck: ReadonlyArray<FileInfo>
): boolean => {
  const candidates = filesRequiredAdditionalCheck.filter(({ signatures }) => signatures.includes(detectedSignature));
  if (candidates.length === 0) return true;
  const detectedType = FileTypes.detectTypeByAdditionalCheck(fileChunk, candidates);
  return P.isNotUndefined(detectedType) && typeExtensions.some((type) => Str.toLowerCase(type) === detectedType);
};

/**
 * Validates the requested file signature against a list of accepted file types
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 * @param types A list of accepted file types
 * @param options parameters for additional actions
 *
 * @returns {boolean} True if found a type signature from the accepted file types, otherwise false
 * @category validation
 * @since 0.0.0
 */
export const validateFileType: {
  (file: FileContent, types: ReadonlyArray<string>, options?: ValidateFileTypeOptions): boolean;
  (types: ReadonlyArray<string>, options?: ValidateFileTypeOptions): (file: FileContent) => boolean;
} = dual(3, (file: FileContent, types: ReadonlyArray<string>, options?: ValidateFileTypeOptions): boolean => {
  if (P.isNotUndefined(options?.chunkSize) && options.chunkSize <= 0) {
    throw new RangeError("chunkSize must be bigger than zero");
  }
  const typeExtensions = resolveTypeExtensions(types, options?.excludeSimilarTypes ?? false);
  const { acceptedSignatures, filesRequiredAdditionalCheck } = collectValidationCandidates(typeExtensions);
  const fileChunk = getFileChunk(file, options?.chunkSize ?? 64);
  const detectedSignature = FileTypes.detectSignature(fileChunk, acceptedSignatures);
  if (P.isUndefined(detectedSignature)) return false;
  return passesAdditionalCheck(fileChunk, detectedSignature, typeExtensions, filesRequiredAdditionalCheck);
});

function addSimilarTypes(requiredTypes: ReadonlyArray<string>): ReadonlyArray<string> {
  if (requiredTypes.some((type) => type === "MP4")) return ["M4V"];
  if (requiredTypes.some((type) => type === "AAC")) return ["M4A"];

  return [];
}
