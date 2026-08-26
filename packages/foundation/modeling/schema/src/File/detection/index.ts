/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import { DetectedFileInfo, FILE_TYPES_REQUIRED_ADDITIONAL_CHECK, FileSignature, FileTypes } from "../core/index.ts";
import { getFileChunk } from "../utils/index.ts";
import type { DetectFileOptions, FileInfo } from "../core/index.ts";

type FileContent = ReadonlyArray<number> | ArrayBuffer | Uint8Array;

const assertValidChunkSize = (options: DetectFileOptions | undefined): void => {
  if (P.isNotUndefined(options?.chunkSize) && options.chunkSize <= 0) {
    throw new RangeError("chunkSize must be bigger than zero");
  }
};

const detectCandidate = (fileChunk: ReadonlyArray<number>, type: string): DetectedFileInfo | undefined => {
  const matchedSignature = FileTypes.detectSignature(fileChunk, FileTypes.getSignaturesByName(type));
  if (P.isUndefined(matchedSignature)) return undefined;
  const fileType: FileInfo = FileTypes.getInfoByName(type);
  const signature = FileSignature.make({
    ...matchedSignature,
    sequence: matchedSignature.sequence.map((value) => (P.isNumber(value) ? value.toString(16) : `${value}`)),
  });
  return DetectedFileInfo.make({
    extension: fileType.extension,
    mimeType: fileType.mimeType,
    description: fileType.description,
    signature,
  });
};

const selectDetectedFile = (
  fileChunk: ReadonlyArray<number>,
  detectedFiles: ReadonlyArray<DetectedFileInfo>
): DetectedFileInfo | undefined => {
  if (detectedFiles.length === 0) return undefined;
  const onlyMatch = detectedFiles.length === 1 ? detectedFiles[0] : undefined;
  if (P.isNotUndefined(onlyMatch) && !FILE_TYPES_REQUIRED_ADDITIONAL_CHECK.includes(onlyMatch.extension)) {
    return onlyMatch;
  }
  const detectedType = FileTypes.detectTypeByAdditionalCheck(fileChunk, detectedFiles);
  return P.isUndefined(detectedType) ? undefined : detectedFiles.find(({ extension }) => extension === detectedType);
};

/**
 * Detect a file by searching for a valid file signature inside the file content
 *
 * @param file File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 * @param options Optional parameters for additional actions
 *
 * @returns {DetectedFileInfo | undefined} DetectedFileInfo if detected a valid signature inside the file contentof, otherwise undefined
 * @category parsing
 * @since 0.0.0
 */
export const detectFile: {
  (file: FileContent, options?: DetectFileOptions): DetectedFileInfo | undefined;
  (options?: DetectFileOptions): (file: FileContent) => DetectedFileInfo | undefined;
} = dual(2, (file: FileContent, options?: DetectFileOptions): DetectedFileInfo | undefined => {
  assertValidChunkSize(options);
  const fileChunk = getFileChunk(file, options?.chunkSize ?? 64);
  const detectedFiles =
    fileChunk.length === 0
      ? []
      : Object.keys(FileTypes).flatMap((type) => {
          const detected = detectCandidate(fileChunk, type);
          return P.isUndefined(detected) ? [] : [detected];
        });
  return selectDetectedFile(fileChunk, detectedFiles);
});
