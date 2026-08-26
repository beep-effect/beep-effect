/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  fetchFromObject,
  findMatroskaDocTypeElements,
  isAvifStringIncluded,
  isFlvStringIncluded,
  isftypStringIncluded,
  isHeicSignatureIncluded,
} from "../../utils/index.ts";
import { FileInfo, FileSignature } from "../types/index.ts";
import { AudioTypes } from "./audio.ts";
import { CompressedTypes } from "./compressed.ts";
import { ImageTypes } from "./image.ts";
import { OtherTypes } from "./other.ts";
import { VideoTypes } from "./video.ts";
import type { DetectedFileInfo } from "../interfaces/dto/index.ts";

const hasAnyExtension = (extensions: ReadonlyArray<string>, candidates: ReadonlyArray<string>): boolean =>
  candidates.some((candidate) => extensions.includes(candidate));

const matchesSignature = (fileChunk: ReadonlyArray<number>, signature: FileSignature): boolean => {
  const skippedBytes = signature.skippedBytes ?? [];
  const spanLength = signature.sequence.length + skippedBytes.length;
  let sequenceIndex = 0;
  for (let fileIndex = 0; fileIndex < spanLength; fileIndex++) {
    if (skippedBytes.includes(fileIndex)) continue;
    if (fileChunk[(signature.offset ?? 0) + fileIndex] !== signature.sequence[sequenceIndex]) return false;
    sequenceIndex++;
  }
  return sequenceIndex === signature.sequence.length;
};

const detectIsoBaseMediaType = (
  fileChunk: ReadonlyArray<number>,
  detectedExtensions: ReadonlyArray<string>
): string | undefined => {
  if (!hasAnyExtension(detectedExtensions, ["m4v", "flv", "mp4", "heic"])) return undefined;
  const isHeic = isHeicSignatureIncluded(fileChunk);
  const candidates: ReadonlyArray<readonly [string, () => boolean]> = [
    ["heic", () => detectedExtensions.includes("heic") && isHeic],
    ["flv", () => isFlvStringIncluded(fileChunk)],
    ["m4v", () => isftypStringIncluded(fileChunk) && !isHeic],
    ["mp4", () => true],
  ];
  return candidates.find(([, matches]) => matches())?.[0];
};

const detectMatroskaType = (
  fileChunk: ReadonlyArray<number>,
  detectedExtensions: ReadonlyArray<string>
): string | undefined =>
  O.getOrUndefined(
    O.filter(findMatroskaDocTypeElements(fileChunk), (documentType) => detectedExtensions.includes(documentType))
  );

/**
 * File extensions that require format-specific validation after signature matching.
 *
 * @category constants
 * @since 0.0.0
 */
export const FILE_TYPES_REQUIRED_ADDITIONAL_CHECK: ReadonlyArray<string> = [
  "m4v",
  "flv",
  "mp4",
  "mkv",
  "webm",
  "avif",
  "heic",
];

/**
 * Holds all supported file types and their unique signatures.
 * @category models
 * @since 0.0.0
 */
export class FileTypes {
  // audio
  static AAC: FileInfo = AudioTypes.AAC;
  static AMR: FileInfo = AudioTypes.AMR;
  static FLAC: FileInfo = AudioTypes.FLAC;
  static M4A: FileInfo = AudioTypes.M4A;
  static MP3: FileInfo = AudioTypes.MP3;
  static WAV: FileInfo = AudioTypes.WAV;

  // image
  static AVIF: FileInfo = ImageTypes.AVIF;
  static BMP: FileInfo = ImageTypes.BMP;
  static BPG: FileInfo = ImageTypes.BPG;
  static CR2: FileInfo = ImageTypes.CR2;
  static EXR: FileInfo = ImageTypes.EXR;
  static GIF: FileInfo = ImageTypes.GIF;
  static HEIC: FileInfo = ImageTypes.HEIC;
  static ICO: FileInfo = ImageTypes.ICO;
  static JPEG: FileInfo = ImageTypes.JPEG;
  static PBM: FileInfo = ImageTypes.PBM;
  static PGM: FileInfo = ImageTypes.PGM;
  static PNG: FileInfo = ImageTypes.PNG;
  static PPM: FileInfo = ImageTypes.PPM;
  static PSD: FileInfo = ImageTypes.PSD;
  static TIFF: FileInfo = ImageTypes.TIFF;
  static WEBP: FileInfo = ImageTypes.WEBP;

  // video
  static AVI: FileInfo = VideoTypes.AVI;
  static FLV: FileInfo = VideoTypes.FLV;
  static M4V: FileInfo = VideoTypes.M4V;
  static MKV: FileInfo = VideoTypes.MKV;
  static MOV: FileInfo = VideoTypes.MOV;
  static MP4: FileInfo = VideoTypes.MP4;
  static OGG: FileInfo = VideoTypes.OGG;
  static SWF: FileInfo = VideoTypes.SWF;
  static WEBM: FileInfo = VideoTypes.WEBM;

  // compressed
  static _7Z: FileInfo = CompressedTypes._7Z;
  static LZH: FileInfo = CompressedTypes.LZH;
  static RAR: FileInfo = CompressedTypes.RAR;
  static ZIP: FileInfo = CompressedTypes.ZIP;

  // other
  static BLEND: FileInfo = OtherTypes.BLEND;
  static DOC: FileInfo = OtherTypes.DOC;
  static ELF: FileInfo = OtherTypes.ELF;
  static EXE: FileInfo = OtherTypes.EXE;
  static INDD: FileInfo = OtherTypes.INDD;
  static MACHO: FileInfo = OtherTypes.MACHO;
  static ORC: FileInfo = OtherTypes.ORC;
  static PARQUET: FileInfo = OtherTypes.PARQUET;
  static PCAP: FileInfo = OtherTypes.PCAP;
  static PDF: FileInfo = OtherTypes.PDF;
  static PS: FileInfo = OtherTypes.PS;
  static RTF: FileInfo = OtherTypes.RTF;
  static SQLITE: FileInfo = OtherTypes.SQLITE;
  static STL: FileInfo = OtherTypes.STL;
  static TTF: FileInfo = OtherTypes.TTF;

  /**
   * Receive information on a file type by its property name from FileTypes class
   *
   * @param propertyName Property name from FileTypes class
   *
   * @returns {FileInfo} File type information
   */
  public static getInfoByName(propertyName: string): FileInfo {
    const file = fetchFromObject(FileTypes, Str.toUpperCase(propertyName));
    S.asserts(FileInfo, file);
    return file;
  }

  /**
   * Receive an array of file type signatures by its property name from FileTypes class
   *
   * @param propertyName Property name from FileTypes class
   *
   * @returns {Array<FileSignature>} All unique signatures with their information
   */
  public static getSignaturesByName(propertyName: string): ReadonlyArray<FileSignature> {
    const signatures = FileTypes.getInfoByName(propertyName).signatures;
    S.asserts(S.Array(FileSignature), signatures);
    return signatures;
  }

  /**
   * Determine if a valid signature exist in a file chunk
   *
   * @param fileChunk A chunk from the beginning of a file content, represents in array of numbers
   * @param acceptedSignatures Valid signatures to search for in fileChunk
   *
   * @returns {boolean} True if found a valid signature inside the chunk, otherwise false
   */
  public static detectSignature(
    fileChunk: ReadonlyArray<number>,
    acceptedSignatures: ReadonlyArray<FileSignature>
  ): FileSignature | undefined {
    return acceptedSignatures.find((signature) => matchesSignature(fileChunk, signature));
  }

  /**
   * Performs an additional check for detected file types by their unique structure
   *
   * @param fileChunk A chunk from the beginning of a file content, represents in array of numbers
   * @param detectedFiles A list of detected files
   * @returns {string | undefined} File type extension if found, otherwise undefined
   */
  public static detectTypeByAdditionalCheck(
    fileChunk: ReadonlyArray<number>,
    detectedFiles: ReadonlyArray<DetectedFileInfo | FileInfo>
  ): string | undefined {
    const detectedExtensions = detectedFiles.map((df) => df.extension);
    return (
      detectIsoBaseMediaType(fileChunk, detectedExtensions) ??
      (hasAnyExtension(detectedExtensions, ["mkv", "webm"])
        ? detectMatroskaType(fileChunk, detectedExtensions)
        : undefined) ??
      (detectedExtensions.includes("avif") && isAvifStringIncluded(fileChunk) ? "avif" : undefined)
    );
  }

  /**
   * Determine if a file chunk contains a valid signature and return the file signature if exist
   *
   * @param fileChunk A chunk from the beginning of a file content, represents in array of numbers
   * @param acceptedSignatures Valid signatures to search for in fileChunk
   *
   * @returns {FileSignature | undefined } FileSignature if found a valid signature, otherwise undefined
   */
  public static detectbBySignatures(
    fileChunk: ReadonlyArray<number>,
    acceptedSignatures: ReadonlyArray<FileSignature>
  ): FileSignature | undefined {
    return FileTypes.detectSignature(fileChunk, acceptedSignatures);
  }

  /**
   * Determine if file content contains a valid signature of a required type
   *
   * @param fileChunk A chunk from the beginning of a file content, represents in array of numbers
   * @param type The file type to match against
   *
   * @returns {boolean} True if found a signature of the type in file content, otherwise false
   */
  public static checkByFileType(fileChunk: ReadonlyArray<number>, type: string): boolean {
    const normalizedType = Str.toUpperCase(type);
    if (Object.prototype.hasOwnProperty.call(FileTypes, normalizedType)) {
      const acceptedSignatures: ReadonlyArray<FileSignature> = FileTypes.getSignaturesByName(normalizedType);

      const detectedSignature = FileTypes.detectSignature(fileChunk, acceptedSignatures);
      if (P.isNotUndefined(detectedSignature)) return true;
    }
    return false;
  }
}
