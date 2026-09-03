/**
 * Option and directory validation for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, P, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, FileSystem, flow, Path, pipe } from "effect";
import { validateDirectory as validateDirectoryShared } from "../../../internal/cli/FsGuards.ts";
import { FilesCommandError, formatPlatformError } from "../Files.errors.ts";
import { normalizeBareExtension } from "../Files.media.ts";
import {
  decodeArchivePoorCandidatesOptions,
  decodeCreateCaptionFilesOptions,
  decodeCropBordersOptions,
  decodeDetectBordersOptions,
  decodeDetectFacesOptions,
  decodeNormalizeMaxLongEdge,
  decodeSafeFilePrefix,
} from "../Files.schemas.ts";
import type {
  ArchivePoorCandidatesOptions,
  CreateCaptionFilesOptions,
  CropBordersOptions,
  DetectBordersOptions,
  DetectFacesOptions,
  PositiveMediaDimension,
  SafeFilePrefix,
} from "../Files.schemas.ts";

/**
 * Validate a generated filename prefix.
 *
 * @param prefix - User-supplied prefix.
 * @returns Safe prefix value.
 * @category validation
 * @since 0.0.0
 */
export const validatePrefix = (prefix: string): Effect.Effect<SafeFilePrefix, FilesCommandError> =>
  decodeSafeFilePrefix(prefix).pipe(
    Effect.mapError(() =>
      FilesCommandError.make({
        message: `Invalid prefix "${prefix}". Use a non-empty stem without dots, path separators, or embedded NUL bytes.`,
      })
    )
  );

/**
 * Resolve, stat, and canonicalise a Files source directory.
 *
 * @param dir - Source directory path.
 * @returns Resolved and canonical directory paths.
 * @category validation
 * @since 0.0.0
 */
export const validateDirectory = Effect.fn("Files.validateDirectory")(function* (
  dir: string
): Effect.fn.Return<
  { readonly canonicalDir: string; readonly directory: string },
  FilesCommandError,
  FileSystem.FileSystem | Path.Path
> {
  return yield* validateDirectoryShared(dir, {
    onNotDirectory: (directory) =>
      FilesCommandError.make({
        message: `Expected --dir to be a directory: "${directory}"`,
      }),
    onRealPathError: (cause, directory) => formatPlatformError("Failed to resolve directory", directory, { cause }),
    onStatError: (cause, directory) => formatPlatformError("Failed to stat directory", directory, { cause }),
  });
});

/**
 * Validate an optional normalize max-long-edge value.
 *
 * @param maxLongEdge - Optional raw numeric option.
 * @returns Optional positive media dimension.
 * @category validation
 * @since 0.0.0
 */
export const validateNormalizeMaxLongEdge: (
  maxLongEdge: O.Option<number>
) => Effect.Effect<O.Option<PositiveMediaDimension>, FilesCommandError> = flow(
  O.match({
    onNone: () => Effect.succeed(O.none<PositiveMediaDimension>()),
    onSome: (value) =>
      decodeNormalizeMaxLongEdge(value).pipe(
        Effect.asSome,
        Effect.mapError(() =>
          FilesCommandError.make({
            message: `Expected --max-long-edge to be a positive integer: ${value}`,
          })
        )
      ),
  })
);

/**
 * Decode and validate create-captions options.
 *
 * @param options - Raw options.
 * @returns Decoded options.
 * @category validation
 * @since 0.0.0
 */
export const validateCreateCaptionFilesOptions = (
  options: CreateCaptionFilesOptions
): Effect.Effect<CreateCaptionFilesOptions, FilesCommandError> =>
  decodeCreateCaptionFilesOptions(options).pipe(
    FilesCommandError.mapError(
      "Invalid create-captions options. Expected a directory, caption text, and boolean flags."
    )
  );

interface ScanWidthPercentages {
  readonly maxScanPct: number;
  readonly minWidthPct: number;
}

const scanWidthFitsWithinMaximum = (decoded: ScanWidthPercentages): boolean =>
  decoded.minWidthPct <= decoded.maxScanPct;

const invalidScanWidthError = (decoded: ScanWidthPercentages): FilesCommandError =>
  FilesCommandError.make({
    message: `Expected --min-width-pct (${decoded.minWidthPct}) to be less than or equal to --max-scan-pct (${decoded.maxScanPct}).`,
  });

/**
 * Decode and validate detect-borders options.
 *
 * @param options - Raw options.
 * @returns Decoded options.
 * @category validation
 * @since 0.0.0
 */
export const validateDetectBordersOptions = (
  options: DetectBordersOptions
): Effect.Effect<DetectBordersOptions, FilesCommandError> =>
  decodeDetectBordersOptions(options).pipe(
    FilesCommandError.mapError(
      "Invalid detect-borders options. Expected --tolerance between 0 and 255, --min-solid-pct and --min-width-pct between greater than 0 and 100, and --max-scan-pct between greater than 0 and 50."
    ),
    Effect.filterOrFail(scanWidthFitsWithinMaximum, invalidScanWidthError)
  );

/**
 * Decode and validate detect-faces options.
 *
 * @param options - Raw options.
 * @returns Decoded options.
 * @category validation
 * @since 0.0.0
 */
export const validateDetectFacesOptions = (
  options: DetectFacesOptions
): Effect.Effect<DetectFacesOptions, FilesCommandError> =>
  decodeDetectFacesOptions(options).pipe(
    FilesCommandError.mapError(
      "Invalid detect-faces options. Expected --model to point at a YuNet ONNX file, --min-confidence between 0 and 1, and face area/margin percentages between 0 and 100."
    )
  );

/**
 * Validate the optional no-face move directory.
 *
 * @param moveNoFaceTo - Optional target directory.
 * @param directory - Source directory.
 * @returns Optional resolved target directory.
 * @category validation
 * @since 0.0.0
 */
export const validateDetectFacesMoveNoFaceDirectory = Effect.fn("Files.validateDetectFacesMoveNoFaceDirectory")(
  function* (
    moveNoFaceTo: O.Option<string>,
    directory: string
  ): Effect.fn.Return<O.Option<string>, FilesCommandError, FileSystem.FileSystem | Path.Path> {
    if (O.isNone(moveNoFaceTo)) {
      return O.none<string>();
    }

    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const sourceDirectory = path.resolve(directory);
    const noFaceDirectory = path.resolve(moveNoFaceTo.value);

    if (Str.equivalence(sourceDirectory, noFaceDirectory)) {
      return yield* FilesCommandError.make({
        message: `Refusing to move no-face images into the source directory: "${noFaceDirectory}"`,
      });
    }

    const exists = yield* fs
      .exists(noFaceDirectory)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to inspect no-face image move directory", noFaceDirectory, { cause })
        )
      );

    if (!exists) {
      return O.some(noFaceDirectory);
    }

    const stat = yield* fs
      .stat(noFaceDirectory)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to stat no-face image move directory", noFaceDirectory, { cause })
        )
      );

    if (stat.type !== "Directory") {
      return yield* FilesCommandError.make({
        message: `Expected --move-no-face-to to be a directory or missing path: "${noFaceDirectory}"`,
      });
    }

    const canonicalSource = yield* fs
      .realPath(sourceDirectory)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to resolve source directory", sourceDirectory, { cause })
        )
      );
    const canonicalNoFace = yield* fs
      .realPath(noFaceDirectory)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to resolve no-face image move directory", noFaceDirectory, { cause })
        )
      );

    if (Str.equivalence(canonicalSource, canonicalNoFace)) {
      return yield* FilesCommandError.make({
        message: `Refusing to move no-face images into the source directory: "${noFaceDirectory}"`,
      });
    }

    return O.some(noFaceDirectory);
  }
);

/**
 * Decode and validate crop-borders options.
 *
 * @param options - Raw options.
 * @returns Decoded options.
 * @category validation
 * @since 0.0.0
 */
export const validateCropBordersOptions = (
  options: CropBordersOptions
): Effect.Effect<CropBordersOptions, FilesCommandError> =>
  decodeCropBordersOptions(options).pipe(
    FilesCommandError.mapError(
      "Invalid crop-borders options. Expected --tolerance between 0 and 255, --min-solid-pct and --min-width-pct between greater than 0 and 100, and --max-scan-pct between greater than 0 and 50."
    ),
    Effect.filterOrFail(scanWidthFitsWithinMaximum, invalidScanWidthError)
  );

/**
 * Parse comma-separated archive sidecar extensions.
 *
 * @param value - Raw sidecar extension option.
 * @returns Normalized bare extension list.
 * @category validation
 * @since 0.0.0
 */
export const parseSidecarExtensions = (value: string): Effect.Effect<ReadonlyArray<string>, FilesCommandError> => {
  const normalized = pipe(value, Str.trim, Str.toLowerCase);

  if (Str.equivalence(normalized, "none")) {
    return Effect.succeed(A.empty<string>());
  }

  const extensions = pipe(
    normalized,
    Str.split(","),
    A.map((entry) => normalizeBareExtension(Str.trim(entry))),
    A.filter(Str.isNonEmpty)
  );
  const invalid = pipe(extensions, A.findFirst(P.some([Str.includes("/"), Str.includes("\\"), Str.includes("\0")])));

  if (O.isSome(invalid) || !A.isReadonlyArrayNonEmpty(extensions)) {
    return Effect.fail(
      FilesCommandError.make({
        message: `Invalid --sidecars value "${value}". Use none or a comma-separated list of bare extensions such as txt,json.`,
      })
    );
  }

  return Effect.succeed(extensions);
};

/**
 * Decode and validate archive-poor-candidates options.
 *
 * @param options - Raw options.
 * @returns Decoded options.
 * @category validation
 * @since 0.0.0
 */
export const validateArchivePoorCandidatesOptions = (
  options: ArchivePoorCandidatesOptions
): Effect.Effect<ArchivePoorCandidatesOptions, FilesCommandError> =>
  decodeArchivePoorCandidatesOptions(options).pipe(
    FilesCommandError.mapError(
      "Invalid archive-poor-candidates options. Expected positive integer --target-resolution and --min-short-edge values plus --max-aspect and --max-upscale ratios greater than or equal to 1."
    )
  );

const validateNormalizeDuplicateDirectory = Effect.fn("Files.validateNormalizeDuplicateDirectory")(function* (
  moveDuplicatesTo: O.Option<string>,
  directory: string,
  canonicalDirectory: string,
  outputDirectory: string,
  canonicalOutputDirectory: O.Option<string>
): Effect.fn.Return<O.Option<string>, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  if (O.isNone(moveDuplicatesTo)) {
    return O.none<string>();
  }

  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const duplicateDirectory = path.resolve(moveDuplicatesTo.value);

  if (Str.equivalence(directory, duplicateDirectory)) {
    return yield* FilesCommandError.make({
      message: `Refusing to move duplicates into the source directory: "${duplicateDirectory}"`,
    });
  }

  if (Str.equivalence(outputDirectory, duplicateDirectory)) {
    return yield* FilesCommandError.make({
      message: `Refusing to move duplicates into the normalize output directory: "${duplicateDirectory}"`,
    });
  }

  const duplicateExists = yield* fs
    .exists(duplicateDirectory)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to inspect duplicate move directory", duplicateDirectory, { cause })
      )
    );

  if (!duplicateExists) {
    return O.some(duplicateDirectory);
  }

  const duplicateStat = yield* fs
    .stat(duplicateDirectory)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to stat duplicate move directory", duplicateDirectory, { cause })
      )
    );

  if (duplicateStat.type !== "Directory") {
    return yield* FilesCommandError.make({
      message: `Expected --move-duplicates-to to be a directory or missing path: "${duplicateDirectory}"`,
    });
  }

  const canonicalDuplicate = yield* fs
    .realPath(duplicateDirectory)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to resolve duplicate move directory", duplicateDirectory, { cause })
      )
    );

  if (Str.equivalence(canonicalDirectory, canonicalDuplicate)) {
    return yield* FilesCommandError.make({
      message: `Refusing to move duplicates into the source directory: "${duplicateDirectory}"`,
    });
  }

  if (O.isSome(canonicalOutputDirectory) && Str.equivalence(canonicalOutputDirectory.value, canonicalDuplicate)) {
    return yield* FilesCommandError.make({
      message: `Refusing to move duplicates into the normalize output directory: "${duplicateDirectory}"`,
    });
  }

  return O.some(duplicateDirectory);
});

/**
 * Validate normalize source, output, and duplicate directories.
 *
 * @param dir - Source directory.
 * @param outDir - Normalize output directory.
 * @param moveDuplicatesTo - Optional duplicate move directory.
 * @returns Resolved directory bundle.
 * @category validation
 * @since 0.0.0
 */
export const validateNormalizeDirectories = Effect.fn("Files.validateNormalizeDirectories")(function* (
  dir: string,
  outDir: string,
  moveDuplicatesTo: O.Option<string>
): Effect.fn.Return<
  {
    readonly canonicalDirectory: string;
    readonly directory: string;
    readonly duplicateDirectory: O.Option<string>;
    readonly outputDirectory: string;
  },
  FilesCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { canonicalDir, directory } = yield* validateDirectory(dir);
  const outputDirectory = path.resolve(outDir);
  let canonicalOutputDirectory = O.none<string>();
  const outputExists = yield* fs
    .exists(outputDirectory)
    .pipe(
      Effect.mapError((cause) => formatPlatformError("Failed to inspect output directory", outputDirectory, { cause }))
    );

  if (outputExists) {
    const outputStat = yield* fs
      .stat(outputDirectory)
      .pipe(
        Effect.mapError((cause) => formatPlatformError("Failed to stat output directory", outputDirectory, { cause }))
      );

    if (outputStat.type !== "Directory") {
      return yield* FilesCommandError.make({
        message: `Expected --out-dir to be a directory or missing path: "${outputDirectory}"`,
      });
    }

    const canonicalOutput = yield* fs
      .realPath(outputDirectory)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to resolve output directory", outputDirectory, { cause })
        )
      );
    canonicalOutputDirectory = O.some(canonicalOutput);

    if (Str.equivalence(canonicalDir, canonicalOutput)) {
      return yield* FilesCommandError.make({
        message: `Refusing to normalize into the source directory: "${outputDirectory}"`,
      });
    }
  }

  if (Str.equivalence(directory, outputDirectory)) {
    return yield* FilesCommandError.make({
      message: `Refusing to normalize into the source directory: "${outputDirectory}"`,
    });
  }

  const duplicateDirectory = yield* validateNormalizeDuplicateDirectory(
    moveDuplicatesTo,
    directory,
    canonicalDir,
    outputDirectory,
    canonicalOutputDirectory
  );

  return {
    canonicalDirectory: canonicalDir,
    directory,
    duplicateDirectory,
    outputDirectory,
  };
});

/**
 * Validate archive source and output directories.
 *
 * @param dir - Source directory.
 * @param archiveDir - Archive output directory.
 * @returns Resolved directory bundle.
 * @category validation
 * @since 0.0.0
 */
export const validateArchiveDirectories = Effect.fn("Files.validateArchiveDirectories")(function* (
  dir: string,
  archiveDir: string
): Effect.fn.Return<
  {
    readonly archiveDirectory: string;
    readonly canonicalDirectory: string;
    readonly directory: string;
  },
  FilesCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { canonicalDir, directory } = yield* validateDirectory(dir);
  const archiveDirectory = path.resolve(archiveDir);
  const archiveExists = yield* fs
    .exists(archiveDirectory)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to inspect archive directory", archiveDirectory, { cause })
      )
    );

  if (archiveExists) {
    const archiveStat = yield* fs
      .stat(archiveDirectory)
      .pipe(
        Effect.mapError((cause) => formatPlatformError("Failed to stat archive directory", archiveDirectory, { cause }))
      );

    if (archiveStat.type !== "Directory") {
      return yield* FilesCommandError.make({
        message: `Expected --archive-dir to be a directory or missing path: "${archiveDirectory}"`,
      });
    }

    const canonicalArchive = yield* fs
      .realPath(archiveDirectory)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to resolve archive directory", archiveDirectory, { cause })
        )
      );

    if (Str.equivalence(canonicalDir, canonicalArchive)) {
      return yield* FilesCommandError.make({
        message: `Refusing to archive into the source directory: "${archiveDirectory}"`,
      });
    }
  }

  if (Str.equivalence(directory, archiveDirectory)) {
    return yield* FilesCommandError.make({
      message: `Refusing to archive into the source directory: "${archiveDirectory}"`,
    });
  }

  return {
    archiveDirectory,
    canonicalDirectory: canonicalDir,
    directory,
  };
});
