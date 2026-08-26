import { dual } from "effect/Function";
import * as P from "effect/Predicate";
/**
 * Takes a file content in different types, convert it into array of numbers and returns a chunk of the required size
 *
 * @param file - File content represents in ReadonlyArray<number> / ArrayBuffer / Uint8Array
 * @param fileChunkLength - Required file chunk length
 *
 * @returns {ReadonlyArray<number>} File chunk of the required size represents in ReadonlyArray<number>
 */
export const getFileChunk: {
  (
    file: ReadonlyArray<number> | ArrayBuffer | Uint8Array,
    fileChunkLength?: number // default length - 32 bytes
  ): ReadonlyArray<number>;
  (
    fileChunkLength?: number // default length - 32 bytes
  ): (file: ReadonlyArray<number> | ArrayBuffer | Uint8Array) => ReadonlyArray<number>;
} = dual(
  2,
  (
    file: ReadonlyArray<number> | ArrayBuffer | Uint8Array,
    fileChunkLength = 32 // default length - 32 bytes
  ): ReadonlyArray<number> => {
    const fileToCheck: ReadonlyArray<number> | Uint8Array = file instanceof ArrayBuffer ? new Uint8Array(file) : file;
    let chunk: ReadonlyArray<number> = [];
    if ((Array.isArray(file) && isArrayOfNumbers(file)) || file instanceof ArrayBuffer || file instanceof Uint8Array) {
      chunk = Array.from(fileToCheck.slice(0, fileChunkLength));
    } else {
      throw new TypeError(
        `Expected the \`file\` argument to be of type \`ReadonlyArray<number>\`, \`Uint8Array\`, or \`ArrayBuffer\`, got \`${typeof file}\``
      );
    }

    if (!isLegalChunk(chunk)) throw new TypeError(`File content contains illegal values`);

    return chunk;
  }
);

/**
 * Determine if array of numbers is a legal file chunk
 *
 * @param fileChunk File content represents in ReadonlyArray<number>
 *
 * @returns {boolean} True if the file content is verified, otherwise false
 */

function isLegalChunk(fileChunk: ReadonlyArray<number>): boolean {
  return fileChunk.every((num) => P.isNumber(num) && !Number.isNaN(num));
}

/**
 * Fetch a property of a object by its name
 *
 * @param obj The required object
 * @param prop The property name
 *
 * @returns The property value, or `undefined` when the path does not exist
 */
export const fetchFromObject: {
  (obj: unknown, prop: string): unknown;
  (prop: string): (obj: unknown) => unknown;
} = dual(2, (obj: unknown, prop: string): unknown => {
  const _index = prop.indexOf(".");
  const key = _index > -1 ? prop.slice(0, _index) : prop;
  if (!P.hasProperty(obj, key)) {
    return undefined;
  }
  return _index > -1 ? fetchFromObject(obj[key], prop.slice(_index + 1)) : obj[key];
});

/**
 * Identify whether a valid 'mkv'/'web' file is 'mkv' or 'webm'.
 * By checking for the presence of the "DocType" element in the 'webm' header.
 * Or by checking the presence of the "Segment" element in the 'mkv' header.
 *
 * @param fileChunk - A chunk from the beginning of a file content, represents in array of numbers
 *
 * @returns {string | undefined} 'webm' if found webm string A property of the required object
 */
export function findMatroskaDocTypeElements(fileChunk: ReadonlyArray<number>): string | undefined {
  const webmString = "webm";
  const mkvString = "matroska";

  const byteString = fileChunk.map((num) => String.fromCharCode(num)).join("");

  if (byteString.includes(webmString)) {
    return "webm";
  }

  if (byteString.includes(mkvString)) {
    return "mkv";
  }

  return undefined; // File type not identified
}

/**
 * Determine if array of numbers contains the "fytp" string.
 * M4V files typically have a "ftyp" box in the first few bytes, which can be checked by searching for the string "ftyp" in the buffer.
 *
 * @param fileChunk A chunk from the beginning of a file content, represents in array of numbers
 *
 * @returns {boolean} True if found the "ftyp" string in the fileChunk, otherwise false
 */
export function isftypStringIncluded(fileChunk: ReadonlyArray<number>): boolean {
  const ftypSignature = [0x66, 0x74, 0x79, 0x70]; // "ftyp" signature

  // Check the first few bytes for the "ftyp" signature
  for (let i = 0; i < fileChunk.length - ftypSignature.length; i++) {
    let found = true;
    for (let j = 0; j < ftypSignature.length; j++) {
      if (fileChunk[i + j] !== ftypSignature[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      return true;
    }
  }
  return false;
}

/**
 * Determine if array of numbers contains the "FLV" string.
 * FLV files typically have a "FLV" string in the first few bytes of the file, which can be checked using TextDecoder or similar.
 *
 * @param fileChunk A chunk from the beginning of a file content, represents in array of numbers
 *
 * @returns {boolean} True if found the "FLV" string in the fileChunk, otherwise false
 */
export function isFlvStringIncluded(fileChunk: ReadonlyArray<number>): boolean {
  const signature = fileChunk.slice(0, 3);
  const signatureString = new TextDecoder().decode(new Uint8Array(signature));
  return signatureString.includes("FLV");
}

export function containsJfifOrExifHeader(file: number[]): boolean {
  // Check if the fourth byte is one of the known JFIF or EXIF header markers
  const headerMarker = file[3];
  if (
    headerMarker === 0xe0 || // JFIF
    headerMarker === 0xe1 // EXIF
  ) {
    return true; // It's a JPEG file
  }
  return false;
}

/**
 * Determine if array of numbers contains the "ftypavif" string.
 * AVIF files typically have a "ftypavif" string at bytes 5-12 of the file, which can be checked using TextDecoder or similar.
 *
 * @param fileChunk A chunk from the beginning of a file content, represents in array of numbers
 *
 * @returns {boolean} True if found the "AVIF" string in the fileChunk, otherwise false
 */
export function isAvifStringIncluded(fileChunk: ReadonlyArray<number>): boolean {
  // Convert the relevant slice of the file chunk from hexadecimal to characters
  const signature = fileChunk
    .slice(4, 12)
    .map((hex) => String.fromCharCode(hex))
    .join("");
  return signature === "ftypavif";
}

function isArrayOfNumbers(arr: ReadonlyArray<unknown>): arr is ReadonlyArray<number> {
  return arr.every(P.isNumber);
}

/**
 * Determine if a file chunk contains a HEIC file box.
 * HEIC files typically have an 'ftyp' box with specific major brand signatures
 * such as 'heic', 'hevc', 'mif1', and 'msf1' which can be checked by searching
 * for these strings in the file chunk.
 *
 * @param fileChunk A chunk from the beginning of a file content, represented as an array of numbers.
 * @returns {boolean} True if found a HEIC signature in the fileChunk, otherwise false.
 */
export function isHeicSignatureIncluded(fileChunk: ReadonlyArray<number>): boolean {
  // Convert the first part of the file chunk to a string to check for signatures
  const byteString = fileChunk.map((num) => String.fromCharCode(num)).join("");

  // List of possible HEIC 'ftyp' signatures
  const heicSignatures = ["ftypheic", "ftyphevc", "ftypmif1", "ftypmsf1"];

  // Check if any of the HEIC signatures are included in the byte string
  return heicSignatures.some((signature) => byteString.includes(signature));
}
