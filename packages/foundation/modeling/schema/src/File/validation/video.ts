import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import { FileTypes } from "../core/index.ts";
import {
  findMatroskaDocTypeElements,
  getFileChunk,
  isFlvStringIncluded,
  isftypStringIncluded,
} from "../utils/index.ts";
import type { FileValidatorOptions } from "../core/index.ts";

/**
 * Determine if file content contains a valid 'avi' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'avi' in file content, otherwise false
 */
export function isAVI(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "avi");
}

/**
 * Determine if file content contains a valid 'flv' file signature.
 * Since 'flv' and 'm4v' share the same signature - additional check required - check if file content contains a "flv" string in the first few bytes of the file
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'flv' & "flv" string in file content, otherwise false
 */
export function isFLV(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  const isFlvSignature = FileTypes.checkByFileType(fileChunk, "flv");
  if (!isFlvSignature) return false;

  // Check if file content contains a "flv" string
  return isFlvStringIncluded(fileChunk);
}

/**
 * Determine if file content contains a valid 'm4v' file signature.
 * Since 'flv' and 'm4v' share the same signature - additional check required - check if file content contains a "ftyp" string in the first few bytes of the file
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'm4v' & "ftyp" string in file content, otherwise false
 */
export function isM4V(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  const isM4vSignature = FileTypes.checkByFileType(fileChunk, "m4v");
  if (!isM4vSignature) return false;

  // Check if file content contains a "ftyp" string
  return isftypStringIncluded(fileChunk);
}

/**
 * Determine if file content contains a valid 'mkv' file signature.
 * Since 'mkv' and 'webm' share the same signature - additional check required - search for the presence of the "Segment" element in the mkv header
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'mkv' & "ftyp" string in file content, otherwise false
 */
export function isMKV(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file, 64); // Check the first 64 bytes of the file
  const isMkvSignature = FileTypes.checkByFileType(fileChunk, "mkv");
  if (!isMkvSignature) return false;

  // Search for the presence of the "Segment" element in the mkv header
  return findMatroskaDocTypeElements(fileChunk) === "mkv";
}

/**
 * Determine if file content contains a valid 'mov' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'mov' in file content, otherwise false
 */
export function isMOV(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "mov");
}

/**
 * Determine if file content contains a valid 'mp4' file signature.
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 * @param options parameters for additional actions
 *
 * @returns {boolean} True if found a signature of type 'mp4' in file content, otherwise false
 */
export const isMP4: {
  (file: ReadonlyArray<number> | ArrayBuffer | Uint8Array, options?: FileValidatorOptions): boolean;
  (options?: FileValidatorOptions): (file: ReadonlyArray<number> | ArrayBuffer | Uint8Array) => boolean;
} = dual(2, (file: ReadonlyArray<number> | ArrayBuffer | Uint8Array, options?: FileValidatorOptions): boolean => {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  const isMp4 = FileTypes.checkByFileType(fileChunk, "mp4");

  if (!isMp4) {
    if (P.isNotUndefined(options) && P.isNotUndefined(options.excludeSimilarTypes) && options.excludeSimilarTypes)
      return false;
    return isM4V(fileChunk); // since 'm4v' is very similar to 'mp4'
  }

  return true;
});

/**
 * Determine if file content contains a valid 'ogg' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'ogg' in file content, otherwise false
 */
export function isOGG(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "ogg");
}

/**
 * Determine if file content contains a valid 'swf' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'swf' in file content, otherwise false
 */
export function isSWF(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "swf");
}

/**
 * Determine if file content contains a valid 'webm' file signature.
 * Since 'mkv' and 'webm' share the same signature - additional check required - search for the presence of the "DocType" element in the webm header
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'webm' & "ftyp" string in file content, otherwise false
 */
export function isWEBM(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file, 64); // Check the first 64 bytes of the file
  const isWebmSignature = FileTypes.checkByFileType(fileChunk, "webm");
  if (!isWebmSignature) return false;

  // Search for the presence of the "DocType" element in the webm header
  return findMatroskaDocTypeElements(fileChunk) === "webm";
}
