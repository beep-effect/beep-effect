/**
 * Schema-backed binary file extension literals and byte heuristics for
 * excluding non-text formats from textual processing.
 *
 * **Details**
 *
 * This module centralizes the binary file extensions used by text-oriented
 * tooling and provides lightweight helpers for checking file paths and byte
 * samples before attempting textual comparison.
 *
 * **Example** (Decode extension and helpers)
 *
 * ```ts import.meta.vitest name="Decode extension and helpers"
 * import * as S from "effect/Schema";
 * import { BinaryFileExtension, hasBinaryExtension, isBinaryContent } from "@beep/schema/BinaryFileExtension";
 *
 * const extension = S.decodeUnknownSync(BinaryFileExtension)(".png");
 *
 * extension // => ".png"
 * hasBinaryExtension("photo.png") // => true
 * isBinaryContent(new Uint8Array([0, 159, 146, 150])) // => true
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
 * **Details**
 *
 * The literal members include the leading `.` so they match normalized path
 * extensions directly.
 *
 * **Example** (Decode PDF extension)
 *
 * ```ts import.meta.vitest name="Decode PDF extension"
 * import * as S from "effect/Schema";
 * import { BinaryFileExtension } from "@beep/schema/BinaryFileExtension";
 *
 * const extension = S.decodeUnknownSync(BinaryFileExtension)(".pdf");
 * extension // => ".pdf"
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * **Example** (Annotate extension union type)
 *
 * ```ts import.meta.vitest name="Annotate extension union type"
 * import * as S from "effect/Schema"
 * import { BinaryFileExtension } from "@beep/schema/BinaryFileExtension"
 *
 * const ext: BinaryFileExtension = S.decodeUnknownSync(BinaryFileExtension)(".png")
 * ext // => ".png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BinaryFileExtension = typeof BinaryFileExtension.Type;

/**
 * Schema-derived guard for individual binary file extensions.
 *
 * **Example** (Guard dotted extensions)
 *
 * ```ts import.meta.vitest name="Guard dotted extensions"
 * import { isBinaryFileExtension } from "@beep/schema/BinaryFileExtension";
 *
 * isBinaryFileExtension(".png") // => true
 * isBinaryFileExtension("png") // => false
 * ```
 *
 * @param value - The value to test as a binary file extension.
 * @returns Whether the value is a supported dotted binary file extension.
 * @category validation
 * @since 0.0.0
 */
export const isBinaryFileExtension = (value: string): value is BinaryFileExtension =>
  HashSet.has(binaryFileExtensionSet, value);

/**
 * Detects whether a file path ends in a known binary file extension.
 *
 * **Details**
 *
 * The extracted extension is normalized to lowercase before membership is
 * checked against {@link BinaryFileExtension}.
 *
 * **Example** (Detect path binary extension)
 *
 * ```ts import.meta.vitest name="Detect path binary extension"
 * import { hasBinaryExtension } from "@beep/schema/BinaryFileExtension";
 *
 * hasBinaryExtension("photo.PNG") // => true
 * hasBinaryExtension("notes.md") // => false
 * ```
 *
 * @param filePath - The file path or file name whose extension should be checked.
 * @returns `true` when the normalized dotted extension is known to be binary.
 * @category utilities
 * @since 0.0.0
 */
export function hasBinaryExtension(filePath: string): boolean {
  return HashSet.has(binaryFileExtensionSet, extractNormalizedExtension(filePath));
}

/**
 * Detects whether a byte sample looks like binary content.
 *
 * **Details**
 *
 * The heuristic returns `true` when the inspected sample contains a null byte
 * or when more than 10% of sampled bytes are non-printable ASCII bytes other
 * than tab, line feed, and carriage return.
 *
 * **Example** (Detect binary byte samples)
 *
 * ```ts import.meta.vitest name="Detect binary byte samples"
 * import { isBinaryContent } from "@beep/schema/BinaryFileExtension";
 *
 * const text = new TextEncoder().encode("hello world");
 * const binary = new Uint8Array([0, 159, 146, 150]);
 *
 * isBinaryContent(text) // => false
 * isBinaryContent(binary) // => true
 * ```
 *
 * @param bytes - The bytes to inspect for binary content markers.
 * @returns `true` when the inspected bytes look binary, otherwise `false`.
 * @category utilities
 * @since 0.0.0
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
