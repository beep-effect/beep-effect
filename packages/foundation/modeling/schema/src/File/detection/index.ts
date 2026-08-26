import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import { FILE_TYPES_REQUIRED_ADDITIONAL_CHECK, FileTypes } from "../core/index.ts";
import { getFileChunk } from "../utils/index.ts";
import type { DetectedFileInfo, DetectFileOptions, FileInfo, FileSignature } from "../core/index.ts";

/**
 * Detect a file by searching for a valid file signature inside the file content
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 * @param options Optional parameters for additional actions
 *
 * @returns {DetectedFileInfo | undefined} DetectedFileInfo if detected a valid signature inside the file contentof, otherwise undefined
 */
export const detectFile: {
  (file: ReadonlyArray<number> | ArrayBuffer | Uint8Array, options?: DetectFileOptions): DetectedFileInfo | undefined;
  (
    options?: DetectFileOptions
  ): (file: ReadonlyArray<number> | ArrayBuffer | Uint8Array) => DetectedFileInfo | undefined;
} = dual(
  2,
  (
    file: ReadonlyArray<number> | ArrayBuffer | Uint8Array,
    options?: DetectFileOptions
  ): DetectedFileInfo | undefined => {
    if (
      P.isNotUndefined(options) &&
      Object.prototype.hasOwnProperty.call(options, "chunkSize") &&
      (options?.chunkSize ?? 0) <= 0
    )
      throw new RangeError("chunkSize must be bigger than zero");

    const fileChunk: ReadonlyArray<number> = getFileChunk(file, options?.chunkSize || 64); // Take chunk from the beginning of the file
    if (fileChunk.length === 0) return undefined;

    const detectedFiles: DetectedFileInfo[] = [];
    const filesRequiredAdditionalCheck: string[] = [];

    for (const type in FileTypes) {
      if (Object.prototype.hasOwnProperty.call(FileTypes, type)) {
        const signatures: ReadonlyArray<FileSignature> = FileTypes.getSignaturesByName(type);
        const matchedSignature = FileTypes.detectbBySignatures(fileChunk, signatures);
        if (P.isNotUndefined(matchedSignature)) {
          const fileType: FileInfo = FileTypes.getInfoByName(type);
          if (FILE_TYPES_REQUIRED_ADDITIONAL_CHECK.includes(fileType.extension)) {
            filesRequiredAdditionalCheck.push(fileType.extension);
          }
          const fileInfo: DetectedFileInfo = {
            extension: fileType.extension,
            mimeType: fileType.mimeType,
            description: fileType.description,
            signature: {
              ...matchedSignature,
              sequence: matchedSignature.sequence.map((num) => (P.isNumber(num) ? num.toString(16) : `${num}`)),
            },
          };
          detectedFiles.push(fileInfo);
        }
      }
    }

    if (detectedFiles.length === 0) return undefined;
    if (detectedFiles.length === 1 && filesRequiredAdditionalCheck.length === 0) return detectedFiles[0];

    // Some files share the same signature. Additional check required
    const detectedType = FileTypes.detectTypeByAdditionalCheck(fileChunk, detectedFiles);
    if (P.isUndefined(detectedType)) return undefined;

    return detectedFiles.find((df) => df.extension === detectedType);
  }
);
