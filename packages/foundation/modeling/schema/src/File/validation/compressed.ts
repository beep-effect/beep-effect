/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import { FileTypes } from "../core/index.ts";
import { getFileChunk } from "../utils/index.ts";
import type { ZipValidatorOptions } from "../core/index.ts";
/**
 * Determine if file content contains a valid '7z' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type '7z' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function is7Z(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "_7z");
}

/**
 * Determine if file content contains a valid 'lzh' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'lzh' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isLZH(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "lzh");
}

/**
 * Determine if file content contains a valid 'rar' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'rar' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isRAR(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "rar");
}

/**
 * Determine if file content contains a valid 'zip' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 * @param options parameters for additional actions
 *
 * @returns {boolean} True if found a signature of type 'zip' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export const isZIP: {
  (file: ReadonlyArray<number> | ArrayBuffer | Uint8Array, options?: ZipValidatorOptions): boolean;
  (options?: ZipValidatorOptions): (file: ReadonlyArray<number> | ArrayBuffer | Uint8Array) => boolean;
} = dual(2, (file: ReadonlyArray<number> | ArrayBuffer | Uint8Array, options?: ZipValidatorOptions): boolean => {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file, options?.chunkSize || 64);
  return FileTypes.checkByFileType(fileChunk, "zip");
});
