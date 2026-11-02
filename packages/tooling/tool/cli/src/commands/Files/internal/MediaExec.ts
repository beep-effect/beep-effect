/**
 * External media tool execution and sharp-backed rewrite helpers for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Exiftool, ReadTagsRequest } from "@beep/exiftool";
import { A, Str } from "@beep/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Stream from "effect/Stream";
import { imageSizeFromFile } from "image-size/fromFile";
import sharp from "sharp";
import { runCapturedStreams } from "../../../internal/process/StepExec.ts";
import { FilesCommandError } from "../Files.errors.ts";
import {
  isExifOrientationRotated,
  isQuarterTurnRotation,
  maybeSwapDimensions,
  normalizeBareExtension,
  rotationFromStream,
  sharpFormatForNormalize,
} from "../Files.media.ts";
import { decodeFfprobeOutputJson, decodeImageSizeMetadata, MediaDimensions } from "../Files.schemas.ts";
import type { ExifMetadata, ExiftoolError } from "@beep/exiftool";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type {
  CropBordersPlanEntry,
  NormalizePlanEntry,
  PositiveMediaDimension,
  SortableFile,
  StripMetadataPlanEntry,
} from "../Files.schemas.ts";

const FfmpegLocalProtocolWhitelist = "file,pipe";
const TrustedMediaToolRoots = ["/usr/bin", "/usr/local/bin", "/opt/homebrew/bin"] as const;
const UnsafeMetadataVideoExtensions = ["asf", "asx", "m3u", "m3u8", "m4u", "mxu"] as const;

/**
 * Check whether a video extension is unsafe for metadata-only ffmpeg rewrites.
 *
 * **Example** (Check m3u8 extension)
 *
 * ```ts
 * isUnsafeMetadataVideoExtension(".m3u8")
 * ```
 *
 * @param extension - File extension with or without a leading dot.
 * @returns Whether the extension points at playlist or redirect-style media.
 * @category utilities
 * @since 0.0.0
 */
export const isUnsafeMetadataVideoExtension = (extension: string): boolean =>
  A.contains(
    UnsafeMetadataVideoExtensions,
    normalizeBareExtension(extension) as (typeof UnsafeMetadataVideoExtensions)[number]
  );

const resolveTrustedMediaToolPath = Effect.fn("Files.resolveTrustedMediaToolPath")(function* (
  toolName: "ffmpeg" | "ffprobe",
  envVarName: "BEEP_FFMPEG_PATH" | "BEEP_FFPROBE_PATH"
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configuredPath = yield* Config.option(Config.String(envVarName)).pipe(
    Effect.orElseSucceed(O.none<string>),
    Effect.map(flow(O.map(Str.trim), O.filter(Str.isNonEmpty)))
  );

  if (O.isSome(configuredPath) && !path.isAbsolute(configuredPath.value)) {
    return yield* FilesCommandError.make({
      message: `${envVarName} must be an absolute path to a trusted ${toolName} binary.`,
    });
  }

  const candidates = O.isSome(configuredPath)
    ? [configuredPath.value]
    : A.map(TrustedMediaToolRoots, (root) => path.join(root, toolName));

  for (const candidate of candidates) {
    const exists = yield* fs.exists(candidate).pipe(Effect.orElseSucceed(() => false));
    if (exists) {
      return candidate;
    }
  }

  return yield* FilesCommandError.make({
    message: `Could not find a trusted ${toolName} binary. Install ${toolName} in a system tool directory or set ${envVarName} to an absolute path.`,
  });
});

/**
 * Probe EXIF-aware image dimensions for a selected image file.
 *
 * @param file - Selected image file.
 * @returns Width and height after orientation handling.
 * @category media
 * @since 0.0.0
 */
export const probeImageDimensions = Effect.fn("Files.probeImageDimensions")(function* (
  file: SortableFile
): Effect.fn.Return<MediaDimensions, FilesCommandError> {
  const rawMetadata = yield* Effect.tryPromise({
    try: () => imageSizeFromFile(file.sourcePath),
    catch: FilesCommandError.new(`Failed to probe image dimensions for "${file.sourcePath}"`),
  });
  const metadata = yield* decodeImageSizeMetadata(rawMetadata).pipe(
    Effect.mapError(() =>
      FilesCommandError.make({
        message: `Image probe did not return usable dimensions for "${file.sourcePath}"`,
      })
    )
  );
  const dimensions = MediaDimensions.make({
    height: metadata.height,
    width: metadata.width,
  });
  const shouldSwap = pipe(O.fromUndefinedOr(metadata.orientation), O.exists(isExifOrientationRotated));

  return maybeSwapDimensions(dimensions, shouldSwap);
});

const runFfprobe = Effect.fn("Files.runFfprobe")(function* (
  file: SortableFile
): Effect.fn.Return<
  string,
  FilesCommandError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const ffprobePath = yield* resolveTrustedMediaToolPath("ffprobe", "BEEP_FFPROBE_PATH");
  const result = yield* runCapturedStreams({
    command: ffprobePath,
    args: [
      "-v",
      "error",
      "-protocol_whitelist",
      FfmpegLocalProtocolWhitelist,
      "-select_streams",
      "v:0",
      "-show_streams",
      "-of",
      "json",
      file.sourcePath,
    ],
    cwd: path.dirname(file.sourcePath),
  }).pipe(
    FilesCommandError.mapError(
      `Failed to run ffprobe for "${file.sourcePath}". Install ffprobe or run without --with-dimensions.`
    )
  );

  if (result.exitCode !== 0) {
    return yield* FilesCommandError.make({
      message: `ffprobe could not read video dimensions for "${file.sourcePath}": ${result.stderr}`,
    });
  }

  return result.stdout;
});

const probeVideoDimensions = Effect.fn("Files.probeVideoDimensions")(function* (
  file: SortableFile
): Effect.fn.Return<
  MediaDimensions,
  FilesCommandError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const outputText = yield* runFfprobe(file);
  const output = yield* decodeFfprobeOutputJson(outputText).pipe(
    Effect.mapError(() =>
      FilesCommandError.make({
        message: `ffprobe returned invalid JSON while probing "${file.sourcePath}"`,
      })
    )
  );
  const stream = yield* pipe(
    A.get(output.streams, 0),
    Effect.fromOption(() =>
      FilesCommandError.make({
        message: `ffprobe did not return a video stream for "${file.sourcePath}"`,
      })
    )
  );
  const dimensions = MediaDimensions.make({
    height: stream.height,
    width: stream.width,
  });
  const shouldSwap = pipe(rotationFromStream(stream), O.exists(isQuarterTurnRotation));

  return maybeSwapDimensions(dimensions, shouldSwap);
});

/**
 * Probe image or video dimensions for a selected media file.
 *
 * @param file - Selected media file.
 * @returns Orientation-aware width and height.
 * @category media
 * @since 0.0.0
 */
export const probeMediaDimensions = Effect.fn("Files.probeMediaDimensions")(function* (
  file: SortableFile
): Effect.fn.Return<
  MediaDimensions,
  FilesCommandError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const mediaKind = yield* pipe(
    file.mediaKind,
    Effect.fromOption(() =>
      FilesCommandError.make({
        message: `Cannot probe dimensions for non-media file: "${file.sourcePath}"`,
      })
    )
  );

  if (mediaKind === "image") {
    return yield* probeImageDimensions(file);
  }

  return yield* probeVideoDimensions(file);
});

const zonedMediaDate = (value: unknown): O.Option<DateTime.Utc> => {
  if (!P.isString(value)) return O.none();
  const match = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (match === null) return O.none();
  return DateTime.make(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${match[7]}`);
};

const rawTagValue = (raw: Readonly<Record<string, unknown>>, name: string): O.Option<unknown> =>
  pipe(
    R.toEntries(raw),
    A.findFirst(([key]) => key === name || Str.endsWith(`:${name}`)(key)),
    O.map(([, value]) => value)
  );

type CreationDateMetadata = Pick<ExifMetadata, "raw" | "dateTimeOriginal" | "createDate">;

const originalDateWithOffset = (metadata: CreationDateMetadata): O.Option<DateTime.Utc> => {
  const original = metadata.dateTimeOriginal;
  const offset = rawTagValue(metadata.raw, "OffsetTimeOriginal");
  return O.isSome(original) && O.isSome(offset) && P.isString(offset.value)
    ? zonedMediaDate(`${original.value}${offset.value}`)
    : O.none();
};

const firstZonedDate = (values: ReadonlyArray<unknown>): O.Option<DateTime.Utc> => {
  for (const value of values) {
    const date = zonedMediaDate(value);
    if (O.isSome(date)) return date;
  }
  return O.none();
};

const creationDateFromMetadata = (metadata: CreationDateMetadata): O.Option<DateTime.Utc> => {
  const withOffset = originalDateWithOffset(metadata);
  if (O.isSome(withOffset)) return withOffset;
  const raw = metadata.raw;
  return firstZonedDate([
    ...O.toArray(metadata.dateTimeOriginal),
    ...O.toArray(metadata.createDate),
    ...A.flatMap(["CreationDate", "DateCreated", "MediaCreateDate", "TrackCreateDate"], (tag) =>
      O.toArray(rawTagValue(raw, tag))
    ),
  ]);
};

/**
 * Read a creation timestamp only when its UTC offset is explicit.
 *
 * @param file - Selected media file.
 * @returns UTC-safe creation timestamp, if embedded metadata supplies one.
 * @throws ExiftoolError when the metadata reader cannot inspect the file.
 * @category media
 * @since 0.0.0
 */
export const probeMediaCreationDate = Effect.fn("Files.probeMediaCreationDate")(function* (
  file: SortableFile
): Effect.fn.Return<O.Option<DateTime.Utc>, ExiftoolError, Exiftool> {
  const exiftool = yield* Exiftool;
  const result = yield* exiftool.readTags(ReadTagsRequest.make({ filePath: file.sourcePath }));
  return creationDateFromMetadata(result.metadata);
});

/**
 * Hash the original media bytes in bounded chunks before any rename.
 *
 * @param file - Selected media file.
 * @returns Full lowercase SHA-256 digest.
 * @category media
 * @since 0.0.0
 */
export const hashMediaFile = Effect.fn("Files.hashMediaFile")(function* (
  file: SortableFile
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const hasher = sha256.create();
  yield* Stream.runForEach(fs.stream(file.sourcePath, { chunkSize: 1024 * 1024 }), (chunk) =>
    Effect.sync(() => {
      hasher.update(chunk);
    })
  ).pipe(FilesCommandError.mapError(`Failed to hash media file "${file.sourcePath}"`));
  return Hex.encode(hasher.digest());
});

/**
 * Decode an image into raw RGB pixels for border detection.
 *
 * @param file - Selected image file.
 * @returns Raw pixel data and image geometry.
 * @category media
 * @since 0.0.0
 */
export const readImagePixelsForBorderDetection = Effect.fn("Files.readImagePixelsForBorderDetection")(function* (
  file: SortableFile
): Effect.fn.Return<
  {
    readonly channels: number;
    readonly data: Uint8Array;
    readonly height: number;
    readonly width: number;
  },
  FilesCommandError
> {
  const result = yield* Effect.tryPromise({
    try: () =>
      sharp(file.sourcePath)
        .rotate()
        .flatten({ background: { b: 255, g: 255, r: 255 } })
        .toColorspace("srgb")
        .raw()
        .toBuffer({ resolveWithObject: true }),
    catch: FilesCommandError.new(`Failed to decode image pixels for "${file.sourcePath}"`),
  });

  if (result.info.width < 1 || result.info.height < 1 || result.info.channels < 3) {
    return yield* FilesCommandError.make({
      message: `Image decode did not return usable RGB pixels for "${file.sourcePath}"`,
    });
  }

  return {
    channels: result.info.channels,
    data: result.data,
    height: result.info.height,
    width: result.info.width,
  };
});

/**
 * Normalize an image into a temporary output path.
 *
 * @param entry - Normalize plan entry.
 * @param tempPath - Temporary output path.
 * @param maxLongEdge - Optional maximum long edge.
 * @category media
 * @since 0.0.0
 */
export const normalizeImageToTemp = Effect.fn("Files.normalizeImageToTemp")(function* (
  entry: NormalizePlanEntry,
  tempPath: string,
  maxLongEdge: O.Option<PositiveMediaDimension>
): Effect.fn.Return<void, FilesCommandError> {
  yield* Effect.tryPromise({
    try: () => {
      const source = sharp(entry.sourcePath).rotate();
      const resized = O.isSome(maxLongEdge)
        ? source.resize({
            fit: "inside",
            height: maxLongEdge.value,
            width: maxLongEdge.value,
            withoutEnlargement: true,
          })
        : source;
      return resized.toFormat(sharpFormatForNormalize(entry.format)).toFile(tempPath);
    },
    catch: FilesCommandError.new(`Failed to normalize image "${entry.sourcePath}"`),
  }).pipe(Effect.asVoid);
});

const stripImageMetadataToTemp = Effect.fn("Files.stripImageMetadataToTemp")(function* (
  entry: StripMetadataPlanEntry,
  tempPath: string
): Effect.fn.Return<void, FilesCommandError> {
  yield* Effect.tryPromise({
    try: () => sharp(entry.sourcePath).rotate().toFile(tempPath),
    catch: FilesCommandError.new(`Failed to normalize image metadata for "${entry.sourcePath}"`),
  }).pipe(Effect.asVoid);
});

/**
 * Crop a planned border region into a temporary output path.
 *
 * @param entry - Border crop plan entry.
 * @param tempPath - Temporary output path.
 * @category media
 * @since 0.0.0
 */
export const cropImageBordersToTemp = Effect.fn("Files.cropImageBordersToTemp")(function* (
  entry: CropBordersPlanEntry,
  tempPath: string
): Effect.fn.Return<void, FilesCommandError> {
  yield* Effect.tryPromise({
    try: () =>
      sharp(entry.sourcePath)
        .rotate()
        .extract({
          height: entry.cropHeight,
          left: entry.cropLeft,
          top: entry.cropTop,
          width: entry.cropWidth,
        })
        .toFile(tempPath),
    catch: FilesCommandError.new(`Failed to crop detected borders for "${entry.sourcePath}"`),
  }).pipe(Effect.asVoid);
});

const runFfmpegStripMetadata = Effect.fn("Files.runFfmpegStripMetadata")(function* (
  entry: StripMetadataPlanEntry,
  tempPath: string
): Effect.fn.Return<
  string,
  FilesCommandError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const ffmpegPath = yield* resolveTrustedMediaToolPath("ffmpeg", "BEEP_FFMPEG_PATH");
  const result = yield* runCapturedStreams({
    command: ffmpegPath,
    args: [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-protocol_whitelist",
      FfmpegLocalProtocolWhitelist,
      "-i",
      entry.sourcePath,
      "-map",
      "0",
      "-c",
      "copy",
      "-map_metadata",
      "-1",
      "-map_metadata:s",
      "-1",
      "-map_metadata:c",
      "-1",
      "-map_chapters",
      "-1",
      tempPath,
    ],
    cwd: path.dirname(entry.sourcePath),
  }).pipe(
    FilesCommandError.mapError(
      `Failed to run ffmpeg for "${entry.sourcePath}". Install ffmpeg or remove videos from the selection.`
    )
  );

  if (result.exitCode !== 0) {
    const detail = Str.equivalence(result.stderr, "") ? result.stdout : result.stderr;
    return yield* FilesCommandError.make({
      message: `ffmpeg could not strip video metadata for "${entry.sourcePath}": ${detail}`,
    });
  }

  return result.stdout;
});

const stripVideoMetadataToTemp = Effect.fn("Files.stripVideoMetadataToTemp")(function* (
  entry: StripMetadataPlanEntry,
  tempPath: string
): Effect.fn.Return<
  void,
  FilesCommandError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  yield* runFfmpegStripMetadata(entry, tempPath);
});

/**
 * Strip image or video metadata into a temporary output path.
 *
 * @param entry - Metadata-strip plan entry.
 * @param tempPath - Temporary output path.
 * @category media
 * @since 0.0.0
 */
export const stripMetadataToTemp = Effect.fn("Files.stripMetadataToTemp")(function* (
  entry: StripMetadataPlanEntry,
  tempPath: string
): Effect.fn.Return<
  void,
  FilesCommandError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (entry.mediaKind === "image") {
    yield* stripImageMetadataToTemp(entry, tempPath);
    return;
  }

  yield* stripVideoMetadataToTemp(entry, tempPath);
});
