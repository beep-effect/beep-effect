/**
 * Schema-backed binary file extension literals and byte heuristics for
 * excluding non-text formats from textual processing.
 *
 * This module centralizes the binary file extensions used by text-oriented
 * tooling and provides lightweight helpers for checking file paths and byte
 * samples before attempting textual comparison.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema";
 * import { BinaryFileExtension, hasBinaryExtension, isBinaryContent } from "@beep/schema/BinaryFileExtension";
 *
 * const extension = S.decodeUnknownSync(BinaryFileExtension)(".png");
 *
 * console.log(extension); // ".png"
 * console.log(hasBinaryExtension("photo.png")); // true
 * console.log(isBinaryContent(new Uint8Array([0, 159, 146, 150]))); // true
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import { A, Str, thunkEmptyStr, thunkFalse, thunkTrue } from "@beep/utils";
import { HashSet, pipe } from "effect";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import { LiteralKit } from "./LiteralKit/index.ts";

const $I = $SchemaId.create("BinaryFileExtension");

const BINARY_FILE_EXTENSION_MEMBERS = [
  // profiling/lock data
  "lockb",
  "dat",
  "data",
  // Flash
  "swf",
  "fla",
  // Three Dimensions / Design
  "psd",
  "ai",
  "eps",
  "sketch",
  "fig",
  "xd",
  "blend",
  "3ds",
  "max",
  // DB files
  "sqlite",
  "sqlite3",
  "db",
  "mdb",
  "idx",
  // Bytecode / virtual machine artifacts
  "pyc",
  "pyo",
  "class",
  "jar",
  "war",
  "ear",
  "node",
  "wasm",
  "rlib",
  // Fonts
  "ttf",
  "otf",
  "woff",
  "woff2",
  "eot",
  // Document formats
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  // Executables / binaries
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "o",
  "a",
  "obj",
  "lib",
  "app",
  "msi",
  "deb",
  "rpm",
  // Archives
  "zip",
  "tar",
  "gz",
  "bz2",
  "7z",
  "rar",
  "xz",
  "z",
  "tgz",
  "iso",
  // Audio
  "mp3",
  "wav",
  "ogg",
  "flac",
  "aac",
  "m4a",
  "wma",
  "aiff",
  "opus",
  // Video
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
  "wmv",
  "flv",
  "m4v",
  "mpeg",
  "mpg",
  // Images
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "ico",
  "webp",
  "tiff",
  "tif",
] as const;

const binaryFileExtensionOptions = Str.mapPrefix(".", BINARY_FILE_EXTENSION_MEMBERS);

const BINARY_CONTENT_SAMPLE_SIZE = 8192;
const BINARY_CONTENT_NON_PRINTABLE_RATIO_THRESHOLD = 0.1;

const extractNormalizedExtension = (filePath: string): string =>
  pipe(
    Str.lastIndexOf(".")(filePath),
    O.map((index) => pipe(filePath, Str.substring(index), Str.toLowerCase)),
    O.getOrElse(thunkEmptyStr)
  );

const isNonPrintableByte = (byte: number): boolean => byte < 32 && byte !== 9 && byte !== 10 && byte !== 13;

/**
 * Schema for dotted binary file extensions that should be excluded from
 * text-based processing.
 *
 * The literal members include the leading `.` so they match normalized path
 * extensions directly.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema";
 * import { BinaryFileExtension } from "@beep/schema/BinaryFileExtension";
 *
 * const extension = S.decodeUnknownSync(BinaryFileExtension)(".pdf");
 * console.log(extension); // ".pdf"
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const BinaryFileExtension = LiteralKit(binaryFileExtensionOptions).pipe(
  $I.annoteSchema("BinaryFileExtension", {
    description: "A dotted file extension representing a binary format that should be excluded from text processing.",
  })
);

const binaryFileExtensionSet = HashSet.fromIterable(BinaryFileExtension.Options);

/**
 * Union of literals accepted by {@link BinaryFileExtension}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BinaryFileExtension } from "@beep/schema/BinaryFileExtension"
 *
 * const ext: BinaryFileExtension = S.decodeUnknownSync(BinaryFileExtension)(".png")
 * console.log(ext) // ".png"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type BinaryFileExtension = typeof BinaryFileExtension.Type;

/**
 * Schema-derived guard for individual binary file extensions.
 *
 * @example
 * ```typescript
 * import { isBinaryFileExtension } from "@beep/schema/BinaryFileExtension";
 *
 * console.log(isBinaryFileExtension(".png")); // true
 * console.log(isBinaryFileExtension("png")); // false
 * ```
 *
 * @param value - The value to test as a binary file extension.
 * @returns Whether the value is a supported dotted binary file extension.
 * @since 0.0.0
 * @category validation
 */
export const isBinaryFileExtension = BinaryFileExtension.is;

/**
 * Detects whether a file path ends in a known binary file extension.
 *
 * The extracted extension is normalized to lowercase before membership is
 * checked against {@link BinaryFileExtension}.
 *
 * @example
 * ```typescript
 * import { hasBinaryExtension } from "@beep/schema/BinaryFileExtension";
 *
 * console.log(hasBinaryExtension("photo.PNG")); // true
 * console.log(hasBinaryExtension("notes.md")); // false
 * ```
 *
 * @param filePath - The file path or file name whose extension should be checked.
 * @returns `true` when the normalized dotted extension is known to be binary.
 * @since 0.0.0
 * @category utilities
 */
export function hasBinaryExtension(filePath: string): boolean {
  return HashSet.has(binaryFileExtensionSet, extractNormalizedExtension(filePath));
}

/**
 * Detects whether a byte sample looks like binary content.
 *
 * The heuristic returns `true` when the inspected sample contains a null byte
 * or when more than 10% of sampled bytes are non-printable ASCII bytes other
 * than tab, line feed, and carriage return.
 *
 * @example
 * ```typescript
 * import { isBinaryContent } from "@beep/schema/BinaryFileExtension";
 *
 * const text = new TextEncoder().encode("hello world");
 * const binary = new Uint8Array([0, 159, 146, 150]);
 *
 * console.log(isBinaryContent(text)); // false
 * console.log(isBinaryContent(binary)); // true
 * ```
 *
 * @param bytes - The bytes to inspect for binary content markers.
 * @returns `true` when the inspected bytes look binary, otherwise `false`.
 * @since 0.0.0
 * @category utilities
 */
export function isBinaryContent(bytes: Uint8Array): boolean {
  const sample = pipe(bytes, A.fromIterable, A.take(BINARY_CONTENT_SAMPLE_SIZE));

  return A.match(sample, {
    onEmpty: thunkFalse,
    onNonEmpty: (sampleBytes) =>
      Bool.match(
        pipe(
          sampleBytes,
          A.some((byte) => byte === 0)
        ),
        {
          onTrue: thunkTrue,
          onFalse: () =>
            pipe(
              sampleBytes,
              A.reduce(0, (count, byte) => (isNonPrintableByte(byte) ? count + 1 : count)),
              (nonPrintableCount) =>
                nonPrintableCount / A.length(sampleBytes) > BINARY_CONTENT_NON_PRINTABLE_RATIO_THRESHOLD
            ),
        }
      ),
  });
}
