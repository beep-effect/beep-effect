/**
 * Schema-backed models for file signature detection.
 *
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Number as Num, Order } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ArrayBuf } from "../ArrayBuffer.ts";
import { FileExtension } from "../FileExtension.ts";
import { LiteralKit } from "../LiteralKit/index.ts";
import { MimeType } from "../MimeType.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("FileTypeChecker/FileTypeChecker.schema");

/**
 * Supported file extensions for signature detection and validation.
 *
 * **Example** (Validate a supported extension)
 *
 * ```ts import.meta.vitest name="Validate a supported extension"
 * import { FileType } from "@beep/schema/FileTypeChecker"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(FileType)("png")
 * O.getOrNull(decoded) // => "png"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileType = LiteralKit([
  "aac",
  "amr",
  "flac",
  "m4a",
  "mp3",
  "wav",
  "7z",
  "lzh",
  "rar",
  "zip",
  "avif",
  "bmp",
  "bpg",
  "cr2",
  "exr",
  "gif",
  "heic",
  "ico",
  "jpeg",
  "pbm",
  "pgm",
  "png",
  "ppm",
  "psd",
  "tiff",
  "webp",
  "blend",
  "doc",
  "elf",
  "exe",
  "indd",
  "macho",
  "orc",
  "parquet",
  "pcap",
  "pdf",
  "ps",
  "rtf",
  "sqlite",
  "stl",
  "ttf",
  "avi",
  "flv",
  "m4v",
  "mkv",
  "mov",
  "mp4",
  "ogg",
  "swf",
  "webm",
]).annotate(
  $I.annote("FileType", {
    description: "A file extension supported by the file type checker.",
  })
);

/**
 * Decoded supported extension produced by {@link FileType}.
 *
 * @see {@link FileType} for the runtime schema and literal helper surface.
 * @category models
 * @since 0.0.0
 */
export type FileType = typeof FileType.Type;

/**
 * Schema for one unsigned byte.
 *
 * **Example** (Decode a byte)
 *
 * ```ts import.meta.vitest name="Decode a byte"
 * import { Byte } from "@beep/schema/FileTypeChecker"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(Byte)(255)
 * O.getOrNull(decoded) // => 255
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Byte = S.Int.check(
  S.isBetween(
    { minimum: 0, maximum: 255 },
    {
      expected: "an integer between 0 and 255",
      identifier: $I`ByteCheck`,
      title: "Byte",
      description: "An integer in the inclusive unsigned-byte range from 0 through 255.",
      message: "Expected an integer between 0 and 255",
    }
  )
).pipe(
  $I.annoteSchema("Byte", {
    description: "An integer in the inclusive unsigned-byte range from 0 through 255.",
  })
);

/**
 * Decoded unsigned-byte value produced by {@link Byte}.
 *
 * @see {@link Byte} for the runtime schema and inclusive range constraint.
 * @category models
 * @since 0.0.0
 */
export type Byte = typeof Byte.Type;

const ChunkSize = S.Int.check(
  S.isGreaterThan(0, {
    expected: "a positive integer",
    identifier: $I`ChunkSizeCheck`,
    title: "File inspection chunk size",
    description: "A positive integer count of leading bytes inspected during file detection.",
    message: "Expected a positive file inspection chunk size",
  })
).pipe(
  $I.annoteSchema("ChunkSize", {
    description: "The positive number of leading file bytes to inspect.",
  })
);

/**
 * Binary input accepted by detection and validation operations.
 *
 * **Details**
 *
 * Number arrays are validated as integers in the inclusive range from 0 through
 * 255. Native `Uint8Array` values already carry that byte constraint.
 *
 * **Gotchas**
 *
 * Detached `ArrayBuffer` values and `SharedArrayBuffer` values are rejected by
 * the underlying `ArrayBuf` schema.
 *
 * **Example** (Validate byte content)
 *
 * ```ts import.meta.vitest name="Validate byte content"
 * import { FileContent } from "@beep/schema/FileTypeChecker"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(FileContent)(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
 * O.isSome(decoded) // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileContent = S.Union([S.Array(Byte), S.Uint8Array, ArrayBuf]).pipe(
  $I.annoteSchema("FileContent", {
    description: "File bytes represented as a readonly byte array, Uint8Array, or ArrayBuffer.",
  })
);

/**
 * Decoded binary input produced by {@link FileContent}.
 *
 * @see {@link FileContent} for the accepted byte-container representations.
 * @category models
 * @since 0.0.0
 */
export type FileContent = typeof FileContent.Type;

const CatalogOnlyFileMediaType = LiteralKit([
  "application/sla",
  "application/x-7z-compressed",
  "application/x-blender",
  "application/x-executable",
  "application/x-font-ttf",
  "application/x-indesign",
  "application/x-lzh-compressed",
  "application/x-mach-binary",
  "application/x-msdownload",
  "application/x-orc",
  "application/x-rar-compressed",
  "application/x-shockwave-flash",
  "application/x-sqlite3",
  "audio/wav",
  "audio/x-flac",
  "audio/x-m4a",
  "image/bpg",
  "image/x-canon-cr2",
  "image/x-exr",
  "image/x-icon",
  "image/x-portable-bitmap",
  "image/x-portable-graymap",
  "image/x-portable-pixmap",
  "video/webm",
  "video/x-flv",
  "video/x-m4v",
  "video/x-matroska",
  "video/x-msvideo",
]).annotate(
  $I.annote("CatalogOnlyFileMediaType", {
    description: "A legacy or experimental media type used by the file signature catalog.",
  })
);

const FileMediaType = S.Union([MimeType, CatalogOnlyFileMediaType]).pipe(
  $I.annoteSchema("FileMediaType", {
    description: "An official or explicitly catalog-owned legacy media type used by the file type checker.",
  })
);

const CatalogOnlyCompatibleExtension = LiteralKit([
  "aar",
  "acm",
  "ax",
  "dfont",
  "dib",
  "drv",
  "efi",
  "fon",
  "iec",
  "ime",
  "indt",
  "ipa",
  "maff",
  "msg",
  "msix",
  "mui",
  "ocx",
  "olb",
  "pif",
  "pk3",
  "pk4",
  "qts",
  "qtx",
  "scr",
  "sys",
  "tsp",
  "vbx",
  "vsdx",
  "vxd",
  "wiz",
]).annotate(
  $I.annote("CatalogOnlyCompatibleExtension", {
    description: "A compatible catalog extension absent from the shared FileExtension domain.",
  })
);

const CompatibleFileExtension = S.Union([FileExtension, CatalogOnlyCompatibleExtension]).pipe(
  $I.annoteSchema("CompatibleFileExtension", {
    description: "A known file extension that may share a catalog signature with another format.",
  })
);

type CompatibleFileExtension = typeof CompatibleFileExtension.Type;

const FileSignatureStruct = S.Struct({
  sequence: S.NonEmptyArray(Byte),
  offset: S.Natural.pipe(SchemaUtils.withKeyDefaults(0)),
  skippedBytes: S.Array(S.Natural).pipe(SchemaUtils.withEmptyArrayDefaults<number>()),
  description: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  compatibleExtensions: S.Array(CompatibleFileExtension).pipe(
    SchemaUtils.withEmptyArrayDefaults<CompatibleFileExtension>()
  ),
});

const skippedBytesArrayEquivalence = S.toEquivalence(FileSignatureStruct.fields.skippedBytes);
const compatibleExtensionsArrayEquivalence = S.toEquivalence(FileSignatureStruct.fields.compatibleExtensions);

const FileSignatureInvariantsCheck = S.makeFilter<typeof FileSignatureStruct.Type>(
  ({ sequence, skippedBytes, compatibleExtensions }) => {
    const spanLength = sequence.length + skippedBytes.length;
    return (
      Num.Equivalence(A.dedupe(skippedBytes).length, skippedBytes.length) &&
      A.every(skippedBytes, (position) => position < spanLength) &&
      skippedBytesArrayEquivalence(skippedBytes, A.sort(skippedBytes, Order.Number)) &&
      Num.Equivalence(A.dedupe(compatibleExtensions).length, compatibleExtensions.length) &&
      compatibleExtensionsArrayEquivalence(compatibleExtensions, A.sort(compatibleExtensions, Order.String))
    );
  },
  {
    expected: "valid canonically ordered signature metadata",
    identifier: $I`FileSignatureInvariantsCheck`,
    title: "File signature invariants",
    description: "Skipped positions and compatible extensions are unique and sorted in ascending order.",
    message: "Expected valid canonically ordered signature metadata",
  }
);

const FileSignatureModel = FileSignatureStruct.check(FileSignatureInvariantsCheck);

/**
 * A byte signature and its location within a file header.
 *
 * **Details**
 *
 * `offset` is the absolute byte position where matching starts. Each
 * `skippedBytes` entry is a zero-based position relative to that offset, not a
 * byte value. Descriptions decode to `Option`, and compatibility metadata lists
 * known extensions that may share the signature.
 *
 * **Gotchas**
 *
 * Skipped positions must be unique and fall inside the compared span. The span
 * contains the signature sequence plus one position for every skipped byte.
 * Compatible extensions must also be unique. Skipped positions and compatible
 * extensions use ascending encoded order so schema equivalence has one
 * canonical representation.
 *
 * **Example** (Describe a PNG signature)
 *
 * ```ts import.meta.vitest name="Describe a PNG signature"
 * import { FileSignature } from "@beep/schema/FileTypeChecker"
 *
 * const signature = FileSignature.make({ sequence: [0x89, 0x50, 0x4e, 0x47] })
 * signature.offset // => 0
 * ```
 *
 * @invariant Skipped positions are unique indices inside the compared signature span, and compatible extensions are unique.
 * @category models
 * @since 0.0.0
 */
export class FileSignature extends S.Class<FileSignature>($I`FileSignature`)(
  FileSignatureModel,
  $I.annote("FileSignature", {
    description:
      "A non-empty byte sequence, absolute file offset, valid skipped positions, and optional compatibility metadata.",
  })
) {}

/**
 * Type-level companions for {@link FileSignature}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FileSignature {
  /**
   * Encoded signature shape accepted before defaults and `Option` decoding.
   *
   * @see {@link FileSignature} for the decoded schema-backed model.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FileSignature.Encoded;
}

const FileTypeInfoStruct = S.Struct({
  extension: FileType,
  mimeType: FileMediaType,
  description: S.NonEmptyString,
  signatures: S.NonEmptyArray(FileSignature),
});

const fileSignatureEquivalence = S.toEquivalence(FileSignature);

const FileTypeInfoInvariantsCheck = S.makeFilter<typeof FileTypeInfoStruct.Type>(
  ({ extension, signatures }) =>
    Num.Equivalence(A.dedupeWith(fileSignatureEquivalence)(signatures).length, signatures.length) &&
    A.every(
      signatures,
      (signature) => !A.some(signature.compatibleExtensions, (compatible) => Str.Equivalence(compatible, extension))
    ),
  {
    expected: "unique signatures without self-compatible extensions",
    identifier: $I`FileTypeInfoInvariantsCheck`,
    title: "File type metadata invariants",
    description: "Signatures are unique and never list their owning extension as a compatible alternative.",
    message: "Expected unique signatures without the owning extension in compatibility metadata",
  }
);

const FileTypeInfoModel = FileTypeInfoStruct.check(FileTypeInfoInvariantsCheck);

/**
 * Canonical metadata and signatures for a supported file type.
 *
 * **Gotchas**
 *
 * Signatures must be unique and must not list their owning extension as a
 * compatible alternative.
 *
 * **Example** (Describe a PNG file type)
 *
 * ```ts import.meta.vitest name="Describe a PNG file type"
 * import { FileSignature, FileTypeInfo } from "@beep/schema/FileTypeChecker"
 *
 * const info = FileTypeInfo.make({
 *   extension: "png",
 *   mimeType: "image/png",
 *   description: "Portable Network Graphics image",
 *   signatures: [FileSignature.make({ sequence: [0x89, 0x50, 0x4e, 0x47] })],
 * })
 * info.extension // => "png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FileTypeInfo extends S.Class<FileTypeInfo>($I`FileTypeInfo`)(
  FileTypeInfoModel,
  $I.annote("FileTypeInfo", {
    description: "A supported file extension, MIME type, description, and one or more identifying signatures.",
  })
) {}

/**
 * Type-level companions for {@link FileTypeInfo}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FileTypeInfo {
  /**
   * Encoded catalog metadata accepted before nested signature decoding.
   *
   * @see {@link FileTypeInfo} for the decoded schema-backed model.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FileTypeInfo.Encoded;
}

const DetectedFileInfoStruct = S.Struct({
  info: FileTypeInfo,
  signature: FileSignature,
});

const DetectedFileInfoSignatureCheck = S.makeFilter<typeof DetectedFileInfoStruct.Type>(
  ({ info, signature }) => A.some(info.signatures, (candidate) => fileSignatureEquivalence(candidate, signature)),
  {
    expected: "a signature owned by the detected file type",
    identifier: $I`DetectedFileInfoSignatureCheck`,
    title: "Detected file signature ownership",
    description: "The matched signature belongs to the detected file type's canonical signature set.",
    message: "Expected the detected signature to belong to the detected file type",
  }
);

const DetectedFileInfoModel = DetectedFileInfoStruct.check(DetectedFileInfoSignatureCheck).annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(FileTypeInfo)(fc).chain((info) =>
      fc.constantFrom(...info.signatures).map((signature) => ({ info, signature }))
    ),
});

/**
 * Canonical file-type metadata paired with the signature that matched it.
 *
 * **Details**
 *
 * The schema stores one {@link FileTypeInfo} rather than copying its extension,
 * MIME type, and description. Convenience getters expose those values without
 * creating independently mutable or inconsistent fields.
 *
 * **Example** (Describe a detected PNG file)
 *
 * ```ts import.meta.vitest name="Describe a detected PNG file"
 * import { DetectedFileInfo, FileSignature, FileTypeInfo } from "@beep/schema/FileTypeChecker"
 *
 * const signature = FileSignature.make({ sequence: [0x89, 0x50, 0x4e, 0x47] })
 * const info = FileTypeInfo.make({
 *   extension: "png",
 *   mimeType: "image/png",
 *   description: "Portable Network Graphics image",
 *   signatures: [signature],
 * })
 * const detected = DetectedFileInfo.make({ info, signature })
 * detected.extension // => "png"
 * ```
 *
 * @invariant The matched signature belongs to `info.signatures`.
 * @category models
 * @since 0.0.0
 */
export class DetectedFileInfo extends S.Class<DetectedFileInfo>($I`DetectedFileInfo`)(
  DetectedFileInfoModel,
  $I.annote("DetectedFileInfo", {
    description: "Canonical file-type metadata paired with one of its signatures that matched content.",
  })
) {
  get extension(): FileType {
    return this.info.extension;
  }

  get mimeType(): string {
    return this.info.mimeType;
  }

  get description(): string {
    return this.info.description;
  }
}

/**
 * Type-level companions for {@link DetectedFileInfo}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DetectedFileInfo {
  /**
   * Encoded detection result containing encoded metadata and signature values.
   *
   * @see {@link DetectedFileInfo} for the decoded schema-backed model.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DetectedFileInfo.Encoded;
}

/**
 * Configuration for file detection.
 *
 * **Details**
 *
 * `chunkSize` counts leading bytes and defaults to 64 for both construction and
 * decoding when the key is omitted.
 *
 * **Example** (Inspect 128 leading bytes)
 *
 * ```ts import.meta.vitest name="Inspect 128 leading bytes"
 * import { DetectFileOptions } from "@beep/schema/FileTypeChecker"
 *
 * const options = DetectFileOptions.make({ chunkSize: 128 })
 * options.chunkSize // => 128
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class DetectFileOptions extends S.Class<DetectFileOptions>($I`DetectFileOptions`)(
  {
    chunkSize: ChunkSize.pipe(SchemaUtils.withKeyDefaults(64)),
  },
  $I.annote("DetectFileOptions", {
    description: "Options controlling how many leading bytes file detection inspects.",
  })
) {}

/**
 * Type-level companions for {@link DetectFileOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DetectFileOptions {
  /**
   * Encoded detection options, where an omitted chunk size decodes to 64.
   *
   * @see {@link DetectFileOptions} for the decoded schema-backed configuration.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DetectFileOptions.Encoded;
}

/**
 * Configuration for file type validation.
 *
 * **Details**
 *
 * `chunkSize` defaults to 64. `excludeSimilarTypes` defaults to false, allowing
 * compatible formats declared by matched signature metadata.
 *
 * **Example** (Require an exact format match)
 *
 * ```ts import.meta.vitest name="Require an exact format match"
 * import { ValidateFileTypeOptions } from "@beep/schema/FileTypeChecker"
 *
 * const options = ValidateFileTypeOptions.make({ excludeSimilarTypes: true })
 * options.excludeSimilarTypes // => true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ValidateFileTypeOptions extends S.Class<ValidateFileTypeOptions>($I`ValidateFileTypeOptions`)(
  {
    ...DetectFileOptions.fields,
    excludeSimilarTypes: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("ValidateFileTypeOptions", {
    description: "Options controlling byte-window size and acceptance of closely related formats.",
  })
) {}

/**
 * Type-level companions for {@link ValidateFileTypeOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValidateFileTypeOptions {
  /**
   * Encoded validation options, where omitted keys decode to their canonical defaults.
   *
   * @see {@link ValidateFileTypeOptions} for the decoded schema-backed configuration.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ValidateFileTypeOptions.Encoded;
}

/**
 * Schema-backed guard for {@link FileContent}.
 *
 * **Example** (Reject an out-of-range byte)
 *
 * ```ts import.meta.vitest name="Reject an out-of-range byte"
 * import { isFileContent } from "@beep/schema/FileTypeChecker"
 *
 * isFileContent([256]) // => false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isFileContent = S.is(FileContent);

/**
 * Schema-backed guard for {@link FileType}.
 *
 * **Example** (Check a supported extension)
 *
 * ```ts import.meta.vitest name="Check a supported extension"
 * import { isFileType } from "@beep/schema/FileTypeChecker"
 *
 * isFileType("png") // => true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isFileType = S.is(FileType);
