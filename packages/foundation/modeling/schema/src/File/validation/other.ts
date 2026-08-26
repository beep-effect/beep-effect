/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FileTypes } from "../core/index.ts";
import { getFileChunk } from "../utils/index.ts";

/**
 * Determine if file content contains a valid 'blend' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'blend' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isBLEND(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "blend");
}

/**
 * Determine if file content contains a valid 'elf' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'elf' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isELF(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "elf");
}

/**
 * Determine if file content contains a valid 'exe' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'exe' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isEXE(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "exe");
}

/**
 * Determine if file content contains a valid 'mach-o' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'mach-o' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isMACHO(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "macho");
}

/**
 * Determine if file content contains a valid 'indd' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'indd' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isINDD(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "indd");
}

/**
 * Determine if file content contains a valid 'orc' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'orc' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isORC(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "orc");
}

/**
 * Determine if file content contains a valid 'parquet' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'parquet' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isPARQUET(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "parquet");
}

/**
 * Determine if file content contains a valid 'pdf' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'pdf' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isPDF(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "pdf");
}

/**
 * Determine if file content contains a valid 'ps' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'ps' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isPS(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "ps");
}

/**
 * Determine if file content contains a valid 'rtf' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'rtf' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isRTF(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "rtf");
}

/**
 * Determine if file content contains a valid 'sqlite' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'sqlite' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isSQLITE(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "sqlite");
}

/**
 * Determine if file content contains a valid 'stl' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'stl' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isSTL(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "stl");
}

/**
 * Determine if file content contains a valid 'ttf' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'ttf' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isTTF(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "ttf");
}

/**
 * Determine if file content contains a valid 'doc' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'doc' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isDOC(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "doc");
}

/**
 * Determine if file content contains a valid 'pcap' file signature
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 *
 * @returns {boolean} True if found a signature of type 'pcap' in file content, otherwise false
 * @category validation
 * @since 0.0.0
 */
export function isPCAP(file: ReadonlyArray<number> | ArrayBuffer | Uint8Array): boolean {
  const fileChunk: ReadonlyArray<number> = getFileChunk(file);
  return FileTypes.checkByFileType(fileChunk, "pcap");
}
