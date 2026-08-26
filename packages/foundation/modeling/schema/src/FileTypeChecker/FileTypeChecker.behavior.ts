/**
 * File signature detection and validation behavior.
 *
 * @since 0.0.0
 */

import { Match, Order, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { isArrayBuf } from "../ArrayBuffer.ts";
import { FileTypeCatalog } from "./FileTypeChecker.catalog.ts";
import {
  Byte,
  DetectedFileInfo,
  DetectFileOptions,
  FileType,
  isFileType,
  ValidateFileTypeOptions,
} from "./FileTypeChecker.schema.ts";
import type { FileContent, FileSignature, FileTypeInfo } from "./FileTypeChecker.schema.ts";

type CompiledSignature = {
  readonly absolutePositions: ReadonlyArray<number>;
  readonly signature: FileSignature;
};

type CompiledFileType = {
  readonly info: FileTypeInfo;
  readonly signatures: ReadonlyArray<CompiledSignature>;
};

type FileChunker = (chunkSize: number) => O.Option<ReadonlyArray<number>>;

const defaultDetectOptions = DetectFileOptions.make({});
const defaultValidateOptions = ValidateFileTypeOptions.make({});
const decodeBoundedBytes = S.decodeUnknownOption(S.Array(Byte));
const isArrayBufferRepresentation = S.is(S.instanceOf(globalThis.ArrayBuffer));
const fileTypeEquivalence = S.toEquivalence(FileType);
const containsFileType = A.containsWith(fileTypeEquivalence);

const copyBoundedUint8Array = O.liftThrowable(
  (file: Uint8Array<ArrayBufferLike>, chunkSize: number): ReadonlyArray<number> =>
    A.fromIterable(file.subarray(0, chunkSize))
);

const copyBoundedArrayBuffer = O.liftThrowable(
  (file: ArrayBuffer, chunkSize: number): ReadonlyArray<number> =>
    A.fromIterable(new Uint8Array(file, 0, Num.min(file.byteLength, chunkSize)))
);

const compileSignature = (signature: FileSignature): CompiledSignature => {
  const spanLength = signature.sequence.length + signature.skippedBytes.length;
  return {
    absolutePositions: pipe(
      A.range(0, spanLength - 1),
      A.filter((position) => !A.contains(signature.skippedBytes, position)),
      A.map((position) => signature.offset + position)
    ),
    signature,
  };
};

const compiledCatalog: ReadonlyArray<CompiledFileType> = A.map(FileType.Options, (type) => {
  const info = FileTypeCatalog[type];
  return {
    info,
    signatures: pipe(
      info.signatures,
      A.map(compileSignature),
      A.sortWith((compiled) => -compiled.signature.sequence.length, Order.Number)
    ),
  };
});

const matchesAt = (fileChunk: ReadonlyArray<number>, sequence: ReadonlyArray<number>, offset: number): boolean =>
  fileChunk.length >= offset + sequence.length &&
  A.every(sequence, (byte, sequenceIndex) => fileChunk[offset + sequenceIndex] === byte);

const includesByteSequenceAfter = (
  fileChunk: ReadonlyArray<number>,
  sequence: ReadonlyArray<number>,
  minimumOffset: number
): boolean => {
  if (fileChunk.length < minimumOffset + sequence.length) return false;
  return A.some(A.range(minimumOffset, fileChunk.length - sequence.length), (offset) =>
    matchesAt(fileChunk, sequence, offset)
  );
};

const matchesSignature = (fileChunk: ReadonlyArray<number>, compiled: CompiledSignature): boolean =>
  compiled.absolutePositions.length === compiled.signature.sequence.length &&
  A.every(
    compiled.signature.sequence,
    (byte, sequenceIndex) => fileChunk[compiled.absolutePositions[sequenceIndex]] === byte
  );

const detectCandidate = (fileChunk: ReadonlyArray<number>, compiled: CompiledFileType): O.Option<DetectedFileInfo> =>
  pipe(
    A.findFirst(compiled.signatures, (signature) => matchesSignature(fileChunk, signature)),
    O.map(({ signature }) => DetectedFileInfo.make({ info: compiled.info, signature }))
  );

const hasExtension = (candidates: ReadonlyArray<DetectedFileInfo>, extension: FileType): boolean =>
  A.some(candidates, (candidate) => fileTypeEquivalence(candidate.extension, extension));

const isCollisionType = Match.type<FileType>().pipe(
  Match.when("avif", () => true),
  Match.when("heic", () => true),
  Match.when("flv", () => true),
  Match.when("m4v", () => true),
  Match.when("mp4", () => true),
  Match.when("mkv", () => true),
  Match.when("webm", () => true),
  Match.orElse(() => false)
);

const isoBrandOffset = 4;
const isoBrandEvidence: ReadonlyArray<readonly [FileType, ReadonlyArray<number>]> = [
  ["avif", [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]],
  ["heic", [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]],
  ["heic", [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x76, 0x63]],
  ["heic", [0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31]],
  ["heic", [0x66, 0x74, 0x79, 0x70, 0x6d, 0x73, 0x66, 0x31]],
  ["m4v", [0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]],
  ["m4v", [0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x56, 0x20]],
  ["mp4", [0x66, 0x74, 0x79, 0x70, 0x4d, 0x53, 0x4e, 0x56]],
  ["mp4", [0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]],
];

const flvHeader: ReadonlyArray<number> = [0x46, 0x4c, 0x56];
const ebmlDocTypeOffset = 4;
const webmDocType: ReadonlyArray<number> = [0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d];
const matroskaDocType: ReadonlyArray<number> = [0x42, 0x82, 0x88, 0x6d, 0x61, 0x74, 0x72, 0x6f, 0x73, 0x6b, 0x61];

const collectIsoEvidence = (
  fileChunk: ReadonlyArray<number>,
  candidates: ReadonlyArray<DetectedFileInfo>
): ReadonlyArray<FileType> =>
  pipe(
    isoBrandEvidence,
    A.map(([extension, brand]) =>
      hasExtension(candidates, extension) && matchesAt(fileChunk, brand, isoBrandOffset) ? O.some(extension) : O.none()
    ),
    A.getSomes
  );

const collectFlvEvidence = (
  fileChunk: ReadonlyArray<number>,
  candidates: ReadonlyArray<DetectedFileInfo>
): ReadonlyArray<FileType> =>
  hasExtension(candidates, "flv") && matchesAt(fileChunk, flvHeader, 0) ? A.of("flv") : A.empty();

const collectEbmlEvidence = (
  fileChunk: ReadonlyArray<number>,
  candidates: ReadonlyArray<DetectedFileInfo>
): ReadonlyArray<FileType> => {
  const webm = hasExtension(candidates, "webm") && includesByteSequenceAfter(fileChunk, webmDocType, ebmlDocTypeOffset);
  const matroska =
    hasExtension(candidates, "mkv") && includesByteSequenceAfter(fileChunk, matroskaDocType, ebmlDocTypeOffset);
  return A.getSomes([webm ? O.some<FileType>("webm") : O.none(), matroska ? O.some<FileType>("mkv") : O.none()]);
};

const selectMostSpecific = (candidates: ReadonlyArray<DetectedFileInfo>): O.Option<DetectedFileInfo> =>
  pipe(
    A.head(candidates),
    O.flatMap((initial) => {
      const selected = A.reduce(candidates, initial, (current, candidate) =>
        candidate.signature.sequence.length > current.signature.sequence.length ? candidate : current
      );
      const equallySpecific = A.filter(
        candidates,
        (candidate) => candidate.signature.sequence.length === selected.signature.sequence.length
      );
      return equallySpecific.length === 1 ? O.some(selected) : O.none();
    })
  );

const selectDetectedFile = (
  fileChunk: ReadonlyArray<number>,
  candidates: ReadonlyArray<DetectedFileInfo>
): O.Option<DetectedFileInfo> => {
  const evidence = pipe(
    [
      collectIsoEvidence(fileChunk, candidates),
      collectFlvEvidence(fileChunk, candidates),
      collectEbmlEvidence(fileChunk, candidates),
    ],
    A.flatten,
    A.dedupeWith(fileTypeEquivalence)
  );
  if (evidence.length > 1) return O.none();
  if (evidence.length === 1) {
    return pipe(
      A.head(evidence),
      O.flatMap((extension) =>
        A.findFirst(candidates, (candidate) => fileTypeEquivalence(candidate.extension, extension))
      )
    );
  }
  return pipe(
    candidates,
    A.filter((candidate) => !isCollisionType(candidate.extension)),
    selectMostSpecific
  );
};

const selectFileChunker = Match.type<FileContent>().pipe(
  Match.when(
    A.isArray,
    (values): FileChunker =>
      (chunkSize) =>
        pipe(A.take(values, chunkSize), decodeBoundedBytes)
  ),
  Match.when(
    P.isUint8Array,
    (bytes): FileChunker =>
      (chunkSize) =>
        pipe(copyBoundedUint8Array(bytes, chunkSize), O.flatMap(decodeBoundedBytes))
  ),
  Match.when(
    isArrayBufferRepresentation,
    (buffer): FileChunker =>
      (chunkSize) =>
        isArrayBuf(buffer) ? pipe(copyBoundedArrayBuffer(buffer, chunkSize), O.flatMap(decodeBoundedBytes)) : O.none()
  ),
  Match.orElse((): FileChunker => () => O.none())
);

const toFileChunk = (file: FileContent, chunkSize: number): O.Option<ReadonlyArray<number>> =>
  selectFileChunker(file)(chunkSize);

const detectFileWithChunkSize = (file: FileContent, chunkSize: number): O.Option<DetectedFileInfo> =>
  pipe(
    toFileChunk(file, chunkSize),
    O.filter(A.isReadonlyArrayNonEmpty),
    O.flatMap((fileChunk) =>
      pipe(
        compiledCatalog,
        A.map((compiled) => detectCandidate(fileChunk, compiled)),
        A.getSomes,
        (candidates) => selectDetectedFile(fileChunk, candidates)
      )
    )
  );

const detectChunkSize = (options: DetectFileOptions | undefined): number =>
  pipe(
    O.fromUndefinedOr(options),
    O.map((value) => value.chunkSize),
    O.getOrElse(() => defaultDetectOptions.chunkSize)
  );

const isFileRepresentation = (value: unknown): boolean =>
  A.isArray(value) || P.isUint8Array(value) || isArrayBufferRepresentation(value);

const isValidateDataFirst = (args: IArguments): boolean =>
  args.length >= 2 && isFileRepresentation(args[0]) && A.isArray(args[1]);

const matchesAcceptedType = (
  detected: DetectedFileInfo,
  acceptedTypes: ReadonlyArray<FileType>,
  excludeSimilarTypes: boolean
): boolean =>
  containsFileType(acceptedTypes, detected.extension) ||
  (!excludeSimilarTypes &&
    pipe(
      detected.signature.compatibleExtensions,
      A.filter(isFileType),
      A.some((extension) => containsFileType(acceptedTypes, extension))
    ));

/**
 * Detects a supported file type from its leading bytes.
 *
 * **Details**
 *
 * Signature collisions such as MP4/M4V, AVIF/HEIC, and MKV/WebM are resolved
 * from their format-specific header markers. Inconclusive and invalid input is
 * represented by `Option.none()`.
 *
 * **Example** (Detect a PNG header)
 *
 * ```ts import.meta.vitest name="Detect a PNG header"
 * import { detectFile } from "@beep/schema/FileTypeChecker"
 * import * as O from "effect/Option"
 *
 * const result = detectFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
 * O.match(result, { onNone: () => "unknown", onSome: (file) => file.extension }) // => "png"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const detectFile: {
  (file: FileContent, options?: DetectFileOptions): O.Option<DetectedFileInfo>;
  (options?: DetectFileOptions): (file: FileContent) => O.Option<DetectedFileInfo>;
} = dual(
  (args) => args.length > 0 && isFileRepresentation(args[0]),
  (file: FileContent, options?: DetectFileOptions): O.Option<DetectedFileInfo> =>
    detectFileWithChunkSize(file, detectChunkSize(options))
);

/**
 * Validates file content against one or more supported file types.
 *
 * **Details**
 *
 * Compatible extensions declared by the detected signature are accepted unless
 * `excludeSimilarTypes` is true. Detection remains format-aware when file
 * signatures overlap. An empty accepted-type list always returns `false`.
 *
 * **Example** (Validate PNG content)
 *
 * ```ts import.meta.vitest name="Validate PNG content"
 * import { validateFileType } from "@beep/schema/FileTypeChecker"
 *
 * const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
 * validateFileType(png, ["png"]) // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateFileType: {
  (file: FileContent, types: ReadonlyArray<FileType>, options?: ValidateFileTypeOptions): boolean;
  (types: ReadonlyArray<FileType>, options?: ValidateFileTypeOptions): (file: FileContent) => boolean;
} = dual(
  isValidateDataFirst,
  (file: FileContent, types: ReadonlyArray<FileType>, options?: ValidateFileTypeOptions): boolean => {
    const resolvedOptions = pipe(
      O.fromUndefinedOr(options),
      O.getOrElse(() => defaultValidateOptions)
    );
    return pipe(
      detectFileWithChunkSize(file, resolvedOptions.chunkSize),
      O.exists((detected) => matchesAcceptedType(detected, types, resolvedOptions.excludeSimilarTypes))
    );
  }
);
