/**
 * Service implementation for dataset file curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  FaceDetectionImageRequest,
  FaceDetectionModelConfig,
  FaceDetectionService,
  makeFaceDetectionService,
  withDetector,
} from "@beep/face-detection";
import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import {
  ChildArtifactRecord,
  encodeChildArtifactRecordJson,
  encodeFileProcessingCoverageSummaryJson,
  encodeFileProcessingFailureRecordJson,
  encodeProcessRunManifestJson,
  encodeSourceProcessingRecordJson,
  FailedFileProcessingFailureRecord,
  FailedSourceProcessingRecord,
  FileProcessingCoverageSummary,
  ProcessRunManifest,
  SkippedFileProcessingFailureRecord,
  SkippedSourceProcessingRecord,
  SucceededSourceProcessingRecord,
} from "@beep/file-processing/Extraction";
import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import { collectSourceOutcomeRecords } from "@beep/file-processing/Service";
import {
  classifyFormatFromExtension,
  DeferredSelectedStrategy,
  SupportedSelectedStrategy,
  UnsupportedSelectedStrategy,
} from "@beep/file-processing/Strategy";
import { TestFileProcessingEngine } from "@beep/file-processing/test";
import { $RepoCliId } from "@beep/identity/packages";
import { makeLibpffFileProcessingEngine } from "@beep/libpff";
import { profilePhase } from "@beep/observability";
import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { NativePathToPosixPath, normalizePath } from "@beep/schema/PosixPath";
import { makeTikaFileProcessingEngine } from "@beep/tika";
import { A, P, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import {
  Config,
  Console,
  Context,
  Effect,
  FileSystem,
  flow,
  HashMap,
  HashSet,
  Layer,
  Match,
  Order,
  Path,
  pipe,
  Result,
} from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/unstable/process";
import { imageSizeFromFile } from "image-size/fromFile";
import sharp from "sharp";
import { printLines } from "../../internal/cli/Printer.js";
import { FilesCommandError, failOnExtensionlessFile, formatPlatformError } from "./Files.errors.js";
import {
  analyzeSolidBorders,
  assessImageCandidate,
  byNameAscending,
  bySizeDescendingThenNameAscending,
  classifyBorderSides,
  collectText,
  cropBordersPlanEntryFromDetection,
  formatIndex,
  hasSkippedFiles,
  isExifOrientationRotated,
  isImageFileExtension,
  isQuarterTurnRotation,
  isSupportedMetadataImageFile,
  makeStripMetadataTempEntries,
  maybeSwapDimensions,
  mediaDimensionsChanged,
  mediaKindFromExtension,
  normalizeBareExtension,
  normalizeOutputDimensions,
  normalizeOutputExtension,
  renderArchivePoorCandidatesEntry,
  renderArchivePoorCandidatesSkippedEntry,
  renderCreateCaptionFilesPlanEntry,
  renderCreateCaptionFilesSkippedEntry,
  renderCropBordersPlanEntry,
  renderDetectBordersEntry,
  renderDetectFacesEntry,
  renderDetectFacesSkippedEntry,
  renderNormalizePlanEntry,
  renderNormalizeSkippedEntry,
  renderPlanEntry,
  renderStripMetadataPlanEntry,
  rotationFromStream,
  roundCandidateMetric,
  selectedCanonicalPathSet,
  sharpFormatForNormalize,
  targetNameForEntry,
} from "./Files.media.js";
import { FilesConcurrency, runFilesProgressForEach } from "./Files.progress.js";
import {
  ArchivedSidecarEntry,
  ArchivePoorCandidatesEntry,
  ArchivePoorCandidatesManifest,
  ArchivePoorCandidatesManifestOptions,
  ArchivePoorCandidatesManifestSummary,
  ArchivePoorCandidatesPlan,
  ArchivePoorCandidatesSkippedEntry,
  ArchivePoorCandidatesSummary,
  CreateCaptionFilesPlan,
  CreateCaptionFilesPlanEntry,
  CreateCaptionFilesSkippedEntry,
  CreateCaptionFilesSummary,
  CropBordersPlan,
  CropBordersSummary,
  DetectBordersEntry,
  DetectBordersOptions,
  DetectBordersReport,
  DetectBordersSkippedEntry,
  DetectBordersSummary,
  DetectFacesEntry,
  DetectFacesReport,
  DetectFacesReportOptions,
  DetectFacesSkippedEntry,
  DetectFacesSummary,
  decodeArchivePoorCandidatesOptions,
  decodeCreateCaptionFilesOptions,
  decodeCropBordersOptions,
  decodeDetectBordersOptions,
  decodeDetectFacesOptions,
  decodeFfprobeOutputJson,
  decodeImageSizeMetadata,
  decodeNormalizeMaxLongEdge,
  decodeSafeFilePrefix,
  encodeArchivePoorCandidatesManifest,
  encodeDetectBordersReport,
  encodeDetectFacesReport,
  encodeNormalizeManifest,
  MediaDimensions,
  NormalizeFilesOptions,
  NormalizeManifest,
  NormalizeManifestOptions,
  NormalizeManifestSummary,
  NormalizePlan,
  NormalizePlanEntry,
  NormalizeSkippedEntry,
  NormalizeSummary,
  ProcessFilesSummary,
  RenamePlan,
  RenamePlanEntry,
  SortAndRenameSummary,
  SortableFile,
  SortableFileCollection,
  StripMetadataPlan,
  StripMetadataPlanEntry,
  StripMetadataSummary,
} from "./Files.schemas.js";
import type { FaceDetection as DetectedFace, LoadedFaceDetector } from "@beep/face-detection";
import type {
  FileProcessingFailureRecord,
  SourceProcessingRecord,
  SourceProcessingStatus,
} from "@beep/file-processing/Extraction";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type { FileFormatFamily, FileProcessingSkipReason, SelectedStrategy } from "@beep/file-processing/Strategy";
import type { MimeType } from "@beep/schema/MimeType";
import type { PosixPath } from "@beep/schema/PosixPath";
import type { Terminal } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type {
  ArchivePoorCandidatesOptions,
  ArchivePoorCandidatesSkippedReason,
  CreateCaptionFilesOptions,
  CreateCaptionFilesSkippedReason,
  CropBordersOptions,
  CropBordersPlanEntry,
  DetectBordersSkippedReason,
  DetectFacesFlag,
  DetectFacesOptions,
  DetectFacesSkippedReason,
  FileSha256Hash,
  MediaKind,
  NormalizeImageFormat,
  NormalizeSkippedReason,
  PositiveMediaDimension,
  ProcessFilesOptions,
  SafeFilePrefix,
} from "./Files.schemas.js";

const $I = $RepoCliId.create("commands/Files/Files.service");

type FilesCommandServiceRequirements =
  | FileSystem.FileSystem
  | Path.Path
  | Terminal.Terminal
  | ChildProcessSpawner.ChildProcessSpawner
  | Crypto.Crypto;

interface ProcessCollectedFile {
  readonly canonicalPath: string;
  readonly extension: string;
  readonly name: string;
  readonly relativePath: string;
  readonly sizeBytes: NonNegativeInt;
  readonly sourcePath: string;
}

interface ProcessPreparedSource {
  readonly bytes: Uint8Array;
  readonly digest: ContentDigest;
  readonly format: FileFormatFamily;
  readonly operationId: OperationId;
  readonly source: SourceArtifact;
  readonly sourceFile: ProcessCollectedFile;
}

interface ProcessInputCollection {
  readonly canonicalSourceRoot: string;
  readonly files: ReadonlyArray<ProcessCollectedFile>;
  readonly sourceRoot: string;
}

interface ProcessDirectoryCollection {
  readonly files: ReadonlyArray<ProcessCollectedFile>;
  readonly visitedDirectories: HashSet.HashSet<string>;
}

interface ProcessSourceOutcome {
  readonly childRecords: ReadonlyArray<ChildArtifactRecord>;
  readonly failure: O.Option<FileProcessingFailureRecord>;
  readonly sourceRecord: SourceProcessingRecord;
  readonly strategy: SelectedStrategy;
  readonly text: O.Option<readonly [string, string]>;
}

interface NormalizeSeenOutput {
  readonly entry: NormalizePlanEntry;
  readonly outputHash: FileSha256Hash;
  readonly tempPath: string;
}

interface NormalizeDuplicateMove {
  readonly sourcePath: string;
  readonly targetPath: string;
}

interface NormalizeApplyResult {
  readonly completedEntries: ReadonlyArray<NormalizePlanEntry>;
  readonly duplicateMoves: ReadonlyArray<NormalizeDuplicateMove>;
  readonly duplicateSkippedEntries: ReadonlyArray<NormalizeSkippedEntry>;
}

interface DetectBordersCollectedEntries {
  readonly files: ReadonlyArray<SortableFile>;
  readonly skipped: ReadonlyArray<DetectBordersSkippedEntry>;
}

interface SortableCollectedEntry {
  readonly file: O.Option<SortableFile>;
  readonly skippedCount: number;
}

interface NormalizeCollectedEntries {
  readonly files: ReadonlyArray<SortableFile>;
  readonly skipped: ReadonlyArray<NormalizeSkippedEntry>;
}

interface ArchiveCandidateCollectedEntries {
  readonly files: ReadonlyArray<SortableFile>;
  readonly skipped: ReadonlyArray<ArchivePoorCandidatesSkippedEntry>;
}

const FfmpegLocalProtocolWhitelist = "file,pipe";
const TrustedMediaToolRoots = ["/usr/bin", "/usr/local/bin", "/opt/homebrew/bin"] as const;
const UnsafeMetadataVideoExtensions = ["asf", "asx", "m3u", "m3u8", "m4u", "mxu"] as const;

const isUnsafeMetadataVideoExtension = (extension: string): boolean =>
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
  const configuredPath = yield* Config.option(Config.string(envVarName)).pipe(
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
 * Service contract for dataset file curation operations.
 *
 * @example
 * ```ts
 * import type { FilesCommandServiceShape } from "@beep/repo-cli/commands/Files"
 * import { Effect } from "effect"
 *
 * const service: FilesCommandServiceShape = {
 *   archivePoorCandidates: () => Effect.never,
 *   createCaptionFiles: () => Effect.never,
 *   cropBordersFiles: () => Effect.never,
 *   detectBordersFiles: () => Effect.never,
 *   detectFacesFiles: () => Effect.never,
 *   normalizeFiles: () => Effect.never,
 *   processFiles: () => Effect.never,
 *   sortAndRenameFiles: () => Effect.never,
 *   stripMetadataFiles: () => Effect.never
 * }
 *
 * console.log(typeof service.processFiles)
 * ```
 * @category services
 * @since 0.0.0
 */
export interface FilesCommandServiceShape {
  /**
   * Archive obvious poor image candidates out of a dataset directory.
   *
   * @since 0.0.0
   */
  readonly archivePoorCandidates: (
    options: ArchivePoorCandidatesOptions
  ) => Effect.Effect<ArchivePoorCandidatesSummary, FilesCommandError>;

  /**
   * Create same-stem caption sidecar files for direct image files.
   *
   * @since 0.0.0
   */
  readonly createCaptionFiles: (
    options: CreateCaptionFilesOptions
  ) => Effect.Effect<CreateCaptionFilesSummary, FilesCommandError>;

  /**
   * Crop solid or near-solid borders from direct image files.
   *
   * @since 0.0.0
   */
  readonly cropBordersFiles: (options: CropBordersOptions) => Effect.Effect<CropBordersSummary, FilesCommandError>;

  /**
   * Detect solid or near-solid borders in direct image files.
   *
   * @since 0.0.0
   */
  readonly detectBordersFiles: (options: DetectBordersOptions) => Effect.Effect<DetectBordersReport, FilesCommandError>;

  /**
   * Detect human faces in direct image files.
   *
   * @since 0.0.0
   */
  readonly detectFacesFiles: (options: DetectFacesOptions) => Effect.Effect<DetectFacesReport, FilesCommandError>;

  /**
   * Normalize direct image files into a reversible output directory.
   *
   * @since 0.0.0
   */
  readonly normalizeFiles: (options: NormalizeFilesOptions) => Effect.Effect<NormalizeSummary, FilesCommandError>;

  /**
   * Process a file or directory into the V1 file-processing proof manifest tree.
   *
   * @since 0.0.0
   */
  readonly processFiles: (options: ProcessFilesOptions) => Effect.Effect<ProcessFilesSummary, FilesCommandError>;

  /**
   * Sort direct regular files in a directory by size and rename them.
   *
   * @since 0.0.0
   */
  readonly sortAndRenameFiles: (
    dir: string,
    prefix: string,
    dryRun: boolean,
    withDimensions?: boolean
  ) => Effect.Effect<SortAndRenameSummary, FilesCommandError>;

  /**
   * Strip user-authored metadata from direct image and video files in a directory.
   *
   * @since 0.0.0
   */
  readonly stripMetadataFiles: (dir: string, dryRun: boolean) => Effect.Effect<StripMetadataSummary, FilesCommandError>;
}

/**
 * Service tag for dataset file curation operations.
 *
 * @example
 * ```ts
 * import { FilesCommandService } from "@beep/repo-cli/commands/Files"
 * console.log(FilesCommandService)
 * ```
 * @category services
 * @since 0.0.0
 */
export class FilesCommandService extends Context.Service<FilesCommandService, FilesCommandServiceShape>()(
  $I`FilesCommandService`
) {}

const validatePrefix = (prefix: string): Effect.Effect<SafeFilePrefix, FilesCommandError> =>
  decodeSafeFilePrefix(prefix).pipe(
    Effect.mapError(() =>
      FilesCommandError.make({
        message: `Invalid prefix "${prefix}". Use a non-empty stem without dots, path separators, or embedded NUL bytes.`,
      })
    )
  );

const validateDirectory = Effect.fn("Files.validateDirectory")(function* (
  dir: string
): Effect.fn.Return<
  { readonly canonicalDir: string; readonly directory: string },
  FilesCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.resolve(dir);
  const stat = yield* fs
    .stat(directory)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat directory", directory, { cause })));

  if (stat.type !== "Directory") {
    return yield* FilesCommandError.make({
      message: `Expected --dir to be a directory: "${directory}"`,
    });
  }

  const canonicalDir = yield* fs
    .realPath(directory)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to resolve directory", directory, { cause })));

  return { canonicalDir, directory };
});

const validateNormalizeMaxLongEdge: (
  maxLongEdge: O.Option<number>
) => Effect.Effect<O.Option<PositiveMediaDimension>, FilesCommandError> = flow(
  O.match({
    onNone: () => Effect.succeed(O.none<PositiveMediaDimension>()),
    onSome: (value) =>
      decodeNormalizeMaxLongEdge(value).pipe(
        Effect.map(O.some),
        Effect.mapError(() =>
          FilesCommandError.make({
            message: `Expected --max-long-edge to be a positive integer: ${value}`,
          })
        )
      ),
  })
);

const validateCreateCaptionFilesOptions = (
  options: CreateCaptionFilesOptions
): Effect.Effect<CreateCaptionFilesOptions, FilesCommandError> =>
  decodeCreateCaptionFilesOptions(options).pipe(
    FilesCommandError.mapError(
      "Invalid create-captions options. Expected a directory, caption text, and boolean flags."
    )
  );

const validateDetectBordersOptions = (
  options: DetectBordersOptions
): Effect.Effect<DetectBordersOptions, FilesCommandError> =>
  decodeDetectBordersOptions(options).pipe(
    FilesCommandError.mapError(
      "Invalid detect-borders options. Expected --tolerance between 0 and 255, --min-solid-pct and --min-width-pct between greater than 0 and 100, and --max-scan-pct between greater than 0 and 50."
    ),
    Effect.flatMap((decoded) => {
      if (decoded.minWidthPct > decoded.maxScanPct) {
        return Effect.fail(
          FilesCommandError.make({
            message: `Expected --min-width-pct (${decoded.minWidthPct}) to be less than or equal to --max-scan-pct (${decoded.maxScanPct}).`,
          })
        );
      }

      return Effect.succeed(decoded);
    })
  );

const validateDetectFacesOptions = (
  options: DetectFacesOptions
): Effect.Effect<DetectFacesOptions, FilesCommandError> =>
  decodeDetectFacesOptions(options).pipe(
    FilesCommandError.mapError(
      "Invalid detect-faces options. Expected --model to point at a YuNet ONNX file, --min-confidence between 0 and 1, and face area/margin percentages between 0 and 100."
    )
  );

const validateDetectFacesMoveNoFaceDirectory = Effect.fn("Files.validateDetectFacesMoveNoFaceDirectory")(function* (
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
      Effect.mapError((cause) => formatPlatformError("Failed to resolve source directory", sourceDirectory, { cause }))
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
});

const validateCropBordersOptions = (
  options: CropBordersOptions
): Effect.Effect<CropBordersOptions, FilesCommandError> =>
  decodeCropBordersOptions(options).pipe(
    FilesCommandError.mapError(
      "Invalid crop-borders options. Expected --tolerance between 0 and 255, --min-solid-pct and --min-width-pct between greater than 0 and 100, and --max-scan-pct between greater than 0 and 50."
    ),
    Effect.flatMap((decoded) => {
      if (decoded.minWidthPct > decoded.maxScanPct) {
        return Effect.fail(
          FilesCommandError.make({
            message: `Expected --min-width-pct (${decoded.minWidthPct}) to be less than or equal to --max-scan-pct (${decoded.maxScanPct}).`,
          })
        );
      }

      return Effect.succeed(decoded);
    })
  );

const cropBordersDetectionOptions = (options: CropBordersOptions): DetectBordersOptions =>
  DetectBordersOptions.make({
    dir: options.dir,
    json: false,
    maxScanPct: options.maxScanPct,
    minSolidPct: options.minSolidPct,
    minWidthPct: options.minWidthPct,
    tolerance: options.tolerance,
  });

const makeNormalizeManifestOptions = (
  dedupe: boolean,
  format: NormalizeImageFormat,
  maxLongEdge: O.Option<PositiveMediaDimension>,
  moveDuplicatesTo: O.Option<string>,
  overwrite: boolean
): NormalizeManifestOptions =>
  NormalizeManifestOptions.make({
    dedupe,
    format,
    ...O.getSomesStruct({ maxLongEdge }),
    ...O.getSomesStruct({ moveDuplicatesTo }),
    overwrite,
  });

const makeNormalizeSkippedEntry = (
  sourceName: string,
  sourcePath: string,
  extension: O.Option<string>,
  reason: NormalizeSkippedReason,
  message: string
): NormalizeSkippedEntry =>
  O.isSome(extension)
    ? NormalizeSkippedEntry.make({
        extension: extension.value,
        message,
        reason,
        sourceName,
        sourcePath,
      })
    : NormalizeSkippedEntry.make({ message, reason, sourceName, sourcePath });

const makeNormalizeDuplicateSkippedEntry = (
  entry: NormalizePlanEntry,
  outputHash: FileSha256Hash,
  duplicateOf: NormalizePlanEntry,
  moveTarget: O.Option<{ readonly path: string; readonly relativePath: string }>
): NormalizeSkippedEntry =>
  NormalizeSkippedEntry.make({
    duplicateOfOutputRelativePath: duplicateOf.outputRelativePath,
    duplicateOfSourceRelativePath: duplicateOf.sourceRelativePath,
    ...(O.isSome(moveTarget)
      ? {
          duplicateMovedPath: moveTarget.value.path,
          duplicateMovedRelativePath: moveTarget.value.relativePath,
        }
      : {}),
    extension: entry.sourceExtension,
    message: `Normalized output exactly duplicates "${duplicateOf.outputRelativePath}".`,
    outputHash,
    reason: "duplicate",
    sourceName: entry.sourceName,
    sourcePath: entry.sourcePath,
  });

const makeCreateCaptionFilesSkippedEntry = (
  sourceName: string,
  sourcePath: string,
  extension: O.Option<string>,
  captionName: O.Option<string>,
  reason: CreateCaptionFilesSkippedReason,
  message: string
): CreateCaptionFilesSkippedEntry =>
  CreateCaptionFilesSkippedEntry.make({
    ...O.getSomesStruct({ captionName, extension }),
    message,
    reason,
    sourceName,
    sourcePath,
  });

const makeDetectBordersSkippedEntry = (
  sourceName: string,
  sourcePath: string,
  extension: O.Option<string>,
  reason: DetectBordersSkippedReason,
  message: string
): DetectBordersSkippedEntry =>
  O.isSome(extension)
    ? DetectBordersSkippedEntry.make({
        extension: extension.value,
        message,
        reason,
        sourceName,
        sourcePath,
      })
    : DetectBordersSkippedEntry.make({ message, reason, sourceName, sourcePath });

const makeDetectFacesSkippedEntry = (
  sourceName: string,
  sourcePath: string,
  extension: O.Option<string>,
  reason: DetectFacesSkippedReason,
  message: string
): DetectFacesSkippedEntry =>
  O.isSome(extension)
    ? DetectFacesSkippedEntry.make({
        extension: extension.value,
        message,
        reason,
        sourceName,
        sourcePath,
      })
    : DetectFacesSkippedEntry.make({ message, reason, sourceName, sourcePath });

const makeArchivePoorCandidatesSkippedEntry = (
  sourceName: string,
  sourcePath: string,
  extension: O.Option<string>,
  reason: ArchivePoorCandidatesSkippedReason,
  message: string
): ArchivePoorCandidatesSkippedEntry =>
  O.isSome(extension)
    ? ArchivePoorCandidatesSkippedEntry.make({
        extension: extension.value,
        message,
        reason,
        sourceName,
        sourcePath,
      })
    : ArchivePoorCandidatesSkippedEntry.make({
        message,
        reason,
        sourceName,
        sourcePath,
      });

const parseSidecarExtensions = (value: string): Effect.Effect<ReadonlyArray<string>, FilesCommandError> => {
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

const validateArchivePoorCandidatesOptions = (
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

const validateNormalizeDirectories = Effect.fn("Files.validateNormalizeDirectories")(function* (
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

const validateArchiveDirectories = Effect.fn("Files.validateArchiveDirectories")(function* (
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

const collectSortableFile = Effect.fn("Files.collectSortableFile")(function* (
  directory: string,
  canonicalDir: string,
  mediaOnly: boolean,
  entry: string
): Effect.fn.Return<SortableCollectedEntry, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourcePath = path.join(directory, entry);
  const canonicalPath = yield* fs.realPath(sourcePath).pipe(Effect.option);

  if (O.isNone(canonicalPath)) {
    return { file: O.none<SortableFile>(), skippedCount: 0 };
  }

  if (!Str.equivalence(canonicalPath.value, path.join(canonicalDir, entry))) {
    return { file: O.none<SortableFile>(), skippedCount: 0 };
  }

  const stat = yield* fs
    .stat(sourcePath)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat file", sourcePath, { cause })));

  if (stat.type !== "File") {
    return { file: O.none<SortableFile>(), skippedCount: 0 };
  }

  const extension = path.extname(entry);
  if (Str.equivalence(extension, "") || Str.equivalence(extension, ".")) {
    if (mediaOnly) {
      return { file: O.none<SortableFile>(), skippedCount: 1 };
    }

    return yield* failOnExtensionlessFile(sourcePath);
  }

  const mediaKind = mediaKindFromExtension(extension);
  if (mediaOnly && O.isNone(mediaKind)) {
    return { file: O.none<SortableFile>(), skippedCount: 1 };
  }

  return {
    file: O.some(
      SortableFile.make({
        canonicalPath: canonicalPath.value,
        extension,
        mediaKind,
        name: entry,
        size: stat.size,
        sourcePath,
      })
    ),
    skippedCount: 0,
  };
});

const collectSortableFiles = Effect.fn("Files.collectSortableFiles")(function* (
  dir: string,
  mediaOnly: boolean,
  progressLabel: string
): Effect.fn.Return<SortableFileCollection, FilesCommandError, FileSystem.FileSystem | Path.Path | Terminal.Terminal> {
  const fs = yield* FileSystem.FileSystem;
  const { canonicalDir, directory } = yield* validateDirectory(dir);
  const entries = yield* fs
    .readDirectory(directory)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to read directory", directory, { cause })));
  const collectedEntries = yield* runFilesProgressForEach(
    entries,
    (entry) => collectSortableFile(directory, canonicalDir, mediaOnly, entry),
    {
      concurrency: FilesConcurrency.scan,
      label: progressLabel,
    }
  );
  const files = A.flatMap(collectedEntries, (collected) => O.toArray(collected.file));
  const skippedCount = A.reduce(collectedEntries, 0, (count, collected) => count + collected.skippedCount);

  return SortableFileCollection.make({
    files: A.sort(files, bySizeDescendingThenNameAscending),
    skippedCount,
  });
});

const normalizeCollectedFile = (file: SortableFile): NormalizeCollectedEntries => ({
  files: A.of(file),
  skipped: A.empty(),
});

const normalizeCollectedSkipped = (skipped: NormalizeSkippedEntry): NormalizeCollectedEntries => ({
  files: A.empty(),
  skipped: A.of(skipped),
});

const collectNormalizeFile = Effect.fn("Files.collectNormalizeFile")(function* (
  directory: string,
  canonicalDirectory: string,
  entry: string
): Effect.fn.Return<NormalizeCollectedEntries, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourcePath = path.join(directory, entry);
  const canonicalPath = yield* fs.realPath(sourcePath).pipe(Effect.option);

  if (O.isNone(canonicalPath)) {
    return normalizeCollectedSkipped(
      makeNormalizeSkippedEntry(entry, sourcePath, O.none<string>(), "symlink", "Could not resolve source entry.")
    );
  }

  if (!Str.equivalence(canonicalPath.value, path.join(canonicalDirectory, entry))) {
    return normalizeCollectedSkipped(
      makeNormalizeSkippedEntry(entry, sourcePath, O.none<string>(), "symlink", "Symlink entries are not normalized.")
    );
  }

  const stat = yield* fs
    .stat(sourcePath)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat source entry", sourcePath, { cause })));

  if (stat.type === "Directory") {
    return normalizeCollectedSkipped(
      makeNormalizeSkippedEntry(entry, sourcePath, O.none<string>(), "directory", "Directories are not normalized.")
    );
  }

  if (stat.type !== "File") {
    return normalizeCollectedSkipped(
      makeNormalizeSkippedEntry(
        entry,
        sourcePath,
        O.none<string>(),
        "non-media",
        "Only regular image files are normalized."
      )
    );
  }

  const extension = path.extname(entry);
  if (Str.equivalence(extension, "") || Str.equivalence(extension, ".")) {
    return normalizeCollectedSkipped(
      makeNormalizeSkippedEntry(
        entry,
        sourcePath,
        O.none<string>(),
        "extensionless",
        "Extensionless files are not normalized."
      )
    );
  }

  const bareExtension = normalizeBareExtension(extension);
  const mediaKind = mediaKindFromExtension(extension);

  if (O.isNone(mediaKind)) {
    return normalizeCollectedSkipped(
      makeNormalizeSkippedEntry(
        entry,
        sourcePath,
        O.some(extension),
        "non-media",
        "Only recognized image files are normalized."
      )
    );
  }

  if (mediaKind.value === "video") {
    return normalizeCollectedSkipped(
      makeNormalizeSkippedEntry(
        entry,
        sourcePath,
        O.some(extension),
        "video",
        "Video normalization is out of scope for this operation."
      )
    );
  }

  const file = SortableFile.make({
    canonicalPath: canonicalPath.value,
    extension,
    mediaKind,
    name: entry,
    size: stat.size,
    sourcePath,
  });

  if (!isImageFileExtension(bareExtension) || !isSupportedMetadataImageFile(file)) {
    return normalizeCollectedSkipped(
      makeNormalizeSkippedEntry(
        entry,
        sourcePath,
        O.some(extension),
        "unsupported-image",
        "Image extension is not supported by sharp normalization."
      )
    );
  }

  return normalizeCollectedFile(file);
});

const collectNormalizeFiles = Effect.fn("Files.collectNormalizeFiles")(function* (
  directory: string,
  canonicalDirectory: string
): Effect.fn.Return<
  {
    readonly files: ReadonlyArray<SortableFile>;
    readonly skipped: ReadonlyArray<NormalizeSkippedEntry>;
  },
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal
> {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs
    .readDirectory(directory)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to read directory", directory, { cause })));
  const collectedEntries = yield* runFilesProgressForEach(
    entries,
    (entry) => collectNormalizeFile(directory, canonicalDirectory, entry),
    {
      concurrency: FilesConcurrency.scan,
      label: "normalize scan",
    }
  );
  const files = A.flatMap(collectedEntries, (collected) => collected.files);
  const skipped = A.flatMap(collectedEntries, (collected) => collected.skipped);

  return {
    files: A.sort(files, byNameAscending),
    skipped: A.sort(
      skipped,
      Order.mapInput(Order.String, (entry: NormalizeSkippedEntry) => entry.sourceName)
    ),
  };
});

const buildCreateCaptionFilesPlan = Effect.fn("Files.buildCreateCaptionFilesPlan")(function* (
  options: CreateCaptionFilesOptions
): Effect.fn.Return<CreateCaptionFilesPlan, FilesCommandError, FileSystem.FileSystem | Path.Path | Terminal.Terminal> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { canonicalDir, directory } = yield* validateDirectory(options.dir);
  const sourceNames = yield* fs.readDirectory(directory).pipe(
    Effect.map(A.sort(Order.String)),
    Effect.mapError((cause) => formatPlatformError("Failed to read directory", directory, { cause }))
  );

  let entries = A.empty<CreateCaptionFilesPlanEntry>();
  let plannedCaptionNames = HashSet.empty<string>();
  let skipped = A.empty<CreateCaptionFilesSkippedEntry>();

  yield* runFilesProgressForEach(
    sourceNames,
    Effect.fnUntraced(function* (sourceName) {
      const sourcePath = path.join(directory, sourceName);
      const canonicalPath = yield* fs.realPath(sourcePath).pipe(Effect.option);

      if (O.isNone(canonicalPath)) {
        skipped = A.append(
          skipped,
          makeCreateCaptionFilesSkippedEntry(
            sourceName,
            sourcePath,
            O.none<string>(),
            O.none<string>(),
            "symlink",
            "Could not resolve source entry."
          )
        );
        return;
      }

      if (!Str.equivalence(canonicalPath.value, path.join(canonicalDir, sourceName))) {
        skipped = A.append(
          skipped,
          makeCreateCaptionFilesSkippedEntry(
            sourceName,
            sourcePath,
            O.none<string>(),
            O.none<string>(),
            "symlink",
            "Symlink entries are not captioned."
          )
        );
        return;
      }

      const stat = yield* fs
        .stat(sourcePath)
        .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat source entry", sourcePath, { cause })));

      if (stat.type === "Directory") {
        skipped = A.append(
          skipped,
          makeCreateCaptionFilesSkippedEntry(
            sourceName,
            sourcePath,
            O.none<string>(),
            O.none<string>(),
            "directory",
            "Directories are not captioned."
          )
        );
        return;
      }

      if (stat.type !== "File") {
        skipped = A.append(
          skipped,
          makeCreateCaptionFilesSkippedEntry(
            sourceName,
            sourcePath,
            O.none<string>(),
            O.none<string>(),
            "non-media",
            "Only regular image files receive caption sidecars."
          )
        );
        return;
      }

      const extension = path.extname(sourceName);
      if (Str.equivalence(extension, "") || Str.equivalence(extension, ".")) {
        skipped = A.append(
          skipped,
          makeCreateCaptionFilesSkippedEntry(
            sourceName,
            sourcePath,
            O.none<string>(),
            O.none<string>(),
            "extensionless",
            "Extensionless files are not captioned."
          )
        );
        return;
      }

      const mediaKind = mediaKindFromExtension(extension);
      if (O.isNone(mediaKind)) {
        skipped = A.append(
          skipped,
          makeCreateCaptionFilesSkippedEntry(
            sourceName,
            sourcePath,
            O.some(extension),
            O.none<string>(),
            "non-media",
            "Only recognized image files receive caption sidecars."
          )
        );
        return;
      }

      if (mediaKind.value === "video") {
        skipped = A.append(
          skipped,
          makeCreateCaptionFilesSkippedEntry(
            sourceName,
            sourcePath,
            O.some(extension),
            O.none<string>(),
            "video",
            "Video caption sidecars are out of scope for this operation."
          )
        );
        return;
      }

      const captionName = `${path.basename(sourceName, extension)}.txt`;
      const captionPath = path.join(directory, captionName);

      if (HashSet.has(plannedCaptionNames, captionName)) {
        skipped = A.append(
          skipped,
          makeCreateCaptionFilesSkippedEntry(
            sourceName,
            sourcePath,
            O.some(extension),
            O.some(captionName),
            "caption-target-collision",
            `Another image in this run already targets "${captionName}".`
          )
        );
        return;
      }

      const captionExists = yield* fs
        .exists(captionPath)
        .pipe(
          Effect.mapError((cause) => formatPlatformError("Failed to inspect caption target", captionPath, { cause }))
        );
      let overwritesExisting = false;

      if (captionExists) {
        const captionCanonicalPath = yield* fs.realPath(captionPath).pipe(Effect.option);
        if (
          O.isNone(captionCanonicalPath) ||
          !Str.equivalence(captionCanonicalPath.value, path.join(canonicalDir, captionName))
        ) {
          skipped = A.append(
            skipped,
            makeCreateCaptionFilesSkippedEntry(
              sourceName,
              sourcePath,
              O.some(extension),
              O.some(captionName),
              "caption-target-not-file",
              `Caption target "${captionName}" is a symlink or cannot be resolved inside the source directory.`
            )
          );
          return;
        }

        const captionStat = yield* fs
          .stat(captionPath)
          .pipe(
            Effect.mapError((cause) => formatPlatformError("Failed to stat caption target", captionPath, { cause }))
          );

        if (captionStat.type !== "File") {
          skipped = A.append(
            skipped,
            makeCreateCaptionFilesSkippedEntry(
              sourceName,
              sourcePath,
              O.some(extension),
              O.some(captionName),
              "caption-target-not-file",
              `Caption target "${captionName}" already exists and is not a file.`
            )
          );
          return;
        }

        if (!options.overwrite) {
          skipped = A.append(
            skipped,
            makeCreateCaptionFilesSkippedEntry(
              sourceName,
              sourcePath,
              O.some(extension),
              O.some(captionName),
              "caption-exists",
              `Caption target "${captionName}" already exists.`
            )
          );
          return;
        }

        overwritesExisting = true;
      }

      plannedCaptionNames = HashSet.add(plannedCaptionNames, captionName);
      entries = A.append(
        entries,
        CreateCaptionFilesPlanEntry.make({
          captionName,
          captionPath,
          captionRelativePath: path.relative(directory, captionPath),
          extension,
          overwritesExisting,
          sourceName,
          sourcePath,
          sourceRelativePath: path.relative(directory, sourcePath),
        })
      );
    }),
    {
      concurrency: 1,
      label: "captions plan",
    }
  );

  return CreateCaptionFilesPlan.make({
    caption: options.caption,
    directory,
    entries: A.sort(
      entries,
      Order.mapInput(Order.String, (entry: CreateCaptionFilesPlanEntry) => entry.sourceName)
    ),
    overwrite: options.overwrite,
    skipped: A.sort(
      skipped,
      Order.mapInput(Order.String, (entry: CreateCaptionFilesSkippedEntry) => entry.sourceName)
    ),
  });
});

const applyCreateCaptionFilesPlan = Effect.fn("Files.applyCreateCaptionFilesPlan")(function* (
  plan: CreateCaptionFilesPlan
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem | Path.Path | Terminal.Terminal> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* Effect.acquireUseRelease(
    fs
      .makeTempDirectory({
        directory: plan.directory,
        prefix: ".beep-files-create-captions-",
      })
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to create temporary caption directory", plan.directory, { cause })
        )
      ),
    Effect.fnUntraced(function* (tempDir) {
      yield* runFilesProgressForEach(
        plan.entries,
        Effect.fnUntraced(function* (entry, index) {
          const tempPath = path.join(
            tempDir,
            `${formatIndex(index, `${A.length(plan.entries)}`.length + 1)}-${entry.captionName}`
          );
          yield* fs
            .writeFileString(tempPath, plan.caption)
            .pipe(
              Effect.mapError((cause) =>
                formatPlatformError("Failed to write temporary caption sidecar", tempPath, { cause })
              )
            );
          yield* fs
            .rename(tempPath, entry.captionPath)
            .pipe(
              Effect.mapError((cause) =>
                formatPlatformError("Failed to move caption sidecar into place", entry.captionPath, { cause })
              )
            );
        }),
        {
          concurrency: FilesConcurrency.scan,
          label: "captions write",
        }
      );
    }),
    (tempDir) =>
      fs
        .remove(tempDir, {
          recursive: true,
          force: true,
        })
        .pipe(Effect.ignore)
  );
});

const detectBordersCollectedFile = (file: SortableFile): DetectBordersCollectedEntries => ({
  files: A.of(file),
  skipped: A.empty(),
});

const detectBordersCollectedSkipped = (skipped: DetectBordersSkippedEntry): DetectBordersCollectedEntries => ({
  files: A.empty(),
  skipped: A.of(skipped),
});

const collectDetectBordersFile = Effect.fn("Files.collectDetectBordersFile")(function* (
  directory: string,
  canonicalDirectory: string,
  entry: string
): Effect.fn.Return<DetectBordersCollectedEntries, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourcePath = path.join(directory, entry);
  const canonicalPath = yield* fs.realPath(sourcePath).pipe(Effect.option);

  if (O.isNone(canonicalPath)) {
    return detectBordersCollectedSkipped(
      makeDetectBordersSkippedEntry(entry, sourcePath, O.none<string>(), "symlink", "Could not resolve source entry.")
    );
  }

  if (!Str.equivalence(canonicalPath.value, path.join(canonicalDirectory, entry))) {
    return detectBordersCollectedSkipped(
      makeDetectBordersSkippedEntry(entry, sourcePath, O.none<string>(), "symlink", "Symlink entries are not analyzed.")
    );
  }

  const stat = yield* fs
    .stat(sourcePath)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat source entry", sourcePath, { cause })));

  if (stat.type === "Directory") {
    return detectBordersCollectedSkipped(
      makeDetectBordersSkippedEntry(entry, sourcePath, O.none<string>(), "directory", "Directories are not analyzed.")
    );
  }

  if (stat.type !== "File") {
    return detectBordersCollectedSkipped(
      makeDetectBordersSkippedEntry(
        entry,
        sourcePath,
        O.none<string>(),
        "non-media",
        "Only regular image files are analyzed."
      )
    );
  }

  const extension = path.extname(entry);
  if (Str.equivalence(extension, "") || Str.equivalence(extension, ".")) {
    return detectBordersCollectedSkipped(
      makeDetectBordersSkippedEntry(
        entry,
        sourcePath,
        O.none<string>(),
        "extensionless",
        "Extensionless files are not analyzed."
      )
    );
  }

  const mediaKind = mediaKindFromExtension(extension);
  if (O.isNone(mediaKind)) {
    return detectBordersCollectedSkipped(
      makeDetectBordersSkippedEntry(
        entry,
        sourcePath,
        O.some(extension),
        "non-media",
        "Only recognized image files are analyzed."
      )
    );
  }

  if (mediaKind.value === "video") {
    return detectBordersCollectedSkipped(
      makeDetectBordersSkippedEntry(
        entry,
        sourcePath,
        O.some(extension),
        "video",
        "Video border detection is out of scope for this operation."
      )
    );
  }

  const file = SortableFile.make({
    canonicalPath: canonicalPath.value,
    extension,
    mediaKind,
    name: entry,
    size: stat.size,
    sourcePath,
  });

  if (!isSupportedMetadataImageFile(file)) {
    return detectBordersCollectedSkipped(
      makeDetectBordersSkippedEntry(
        entry,
        sourcePath,
        O.some(extension),
        "unsupported-image",
        "Image extension is not supported by sharp border detection."
      )
    );
  }

  return detectBordersCollectedFile(file);
});

const collectDetectBordersFiles = Effect.fn("Files.collectDetectBordersFiles")(function* (
  dir: string,
  progressEnabled = true,
  label = "borders scan"
): Effect.fn.Return<
  {
    readonly directory: string;
    readonly files: ReadonlyArray<SortableFile>;
    readonly skipped: ReadonlyArray<DetectBordersSkippedEntry>;
  },
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal
> {
  const fs = yield* FileSystem.FileSystem;
  const { canonicalDir, directory } = yield* validateDirectory(dir);
  const entries = yield* fs
    .readDirectory(directory)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to read directory", directory, { cause })));

  const collectedEntries = yield* runFilesProgressForEach(
    entries,
    (entry) => collectDetectBordersFile(directory, canonicalDir, entry),
    {
      concurrency: FilesConcurrency.scan,
      enabled: progressEnabled,
      label,
    }
  );
  const files = A.flatMap(collectedEntries, (collected) => collected.files);
  const skipped = A.flatMap(collectedEntries, (collected) => collected.skipped);

  return {
    directory,
    files: A.sort(files, byNameAscending),
    skipped: A.sort(
      skipped,
      Order.mapInput(Order.String, (entry: DetectBordersSkippedEntry) => entry.sourceName)
    ),
  };
});

const detectFacesSkippedFromBorders = (entry: DetectBordersSkippedEntry): DetectFacesSkippedEntry =>
  makeDetectFacesSkippedEntry(
    entry.sourceName,
    entry.sourcePath,
    O.fromUndefinedOr(entry.extension),
    entry.reason,
    entry.message
  );

const collectDetectFacesFiles = Effect.fn("Files.collectDetectFacesFiles")(function* (
  dir: string,
  progressEnabled = true
): Effect.fn.Return<
  {
    readonly directory: string;
    readonly files: ReadonlyArray<SortableFile>;
    readonly skipped: ReadonlyArray<DetectFacesSkippedEntry>;
  },
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal
> {
  const collection = yield* collectDetectBordersFiles(dir, progressEnabled, "faces scan");

  return {
    directory: collection.directory,
    files: collection.files,
    skipped: pipe(
      collection.skipped,
      A.map(detectFacesSkippedFromBorders),
      A.sort(Order.mapInput(Order.String, (entry: DetectFacesSkippedEntry) => entry.sourceName))
    ),
  };
});

const makeDetectFacesReportOptions = (
  options: DetectFacesOptions,
  moveNoFaceDirectory: O.Option<string>
): DetectFacesReportOptions =>
  DetectFacesReportOptions.make({
    edgeMarginPct: options.edgeMarginPct,
    json: options.json,
    ...O.getSomesStruct({ manifest: options.manifest }),
    minConfidence: options.minConfidence,
    minFaceAreaPct: options.minFaceAreaPct,
    modelPath: options.modelPath,
    ...O.getSomesStruct({ moveNoFaceTo: moveNoFaceDirectory }),
  });

const archiveCandidateCollectedFile = (file: SortableFile): ArchiveCandidateCollectedEntries => ({
  files: A.of(file),
  skipped: A.empty(),
});

const archiveCandidateCollectedSkipped = (
  skipped: ArchivePoorCandidatesSkippedEntry
): ArchiveCandidateCollectedEntries => ({
  files: A.empty(),
  skipped: A.of(skipped),
});

const collectArchiveCandidateFile = Effect.fn("Files.collectArchiveCandidateFile")(function* (
  directory: string,
  canonicalDirectory: string,
  entry: string
): Effect.fn.Return<ArchiveCandidateCollectedEntries, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourcePath = path.join(directory, entry);
  const canonicalPath = yield* fs.realPath(sourcePath).pipe(Effect.option);

  if (O.isNone(canonicalPath)) {
    return archiveCandidateCollectedSkipped(
      makeArchivePoorCandidatesSkippedEntry(
        entry,
        sourcePath,
        O.none<string>(),
        "symlink",
        "Could not resolve source entry."
      )
    );
  }

  if (!Str.equivalence(canonicalPath.value, path.join(canonicalDirectory, entry))) {
    return archiveCandidateCollectedSkipped(
      makeArchivePoorCandidatesSkippedEntry(
        entry,
        sourcePath,
        O.none<string>(),
        "symlink",
        "Symlink entries are not assessed."
      )
    );
  }

  const stat = yield* fs
    .stat(sourcePath)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat source entry", sourcePath, { cause })));

  if (stat.type === "Directory") {
    return archiveCandidateCollectedSkipped(
      makeArchivePoorCandidatesSkippedEntry(
        entry,
        sourcePath,
        O.none<string>(),
        "directory",
        "Directories are not assessed."
      )
    );
  }

  if (stat.type !== "File") {
    return archiveCandidateCollectedSkipped(
      makeArchivePoorCandidatesSkippedEntry(
        entry,
        sourcePath,
        O.none<string>(),
        "non-media",
        "Only regular image files are assessed."
      )
    );
  }

  const extension = path.extname(entry);
  if (Str.equivalence(extension, "") || Str.equivalence(extension, ".")) {
    return archiveCandidateCollectedSkipped(
      makeArchivePoorCandidatesSkippedEntry(
        entry,
        sourcePath,
        O.none<string>(),
        "extensionless",
        "Extensionless files are not assessed."
      )
    );
  }

  const mediaKind = mediaKindFromExtension(extension);
  if (O.isNone(mediaKind)) {
    return archiveCandidateCollectedSkipped(
      makeArchivePoorCandidatesSkippedEntry(
        entry,
        sourcePath,
        O.some(extension),
        "non-media",
        "Only recognized image files are assessed."
      )
    );
  }

  if (mediaKind.value === "video") {
    return archiveCandidateCollectedSkipped(
      makeArchivePoorCandidatesSkippedEntry(
        entry,
        sourcePath,
        O.some(extension),
        "video",
        "Video quality archival is out of scope for this operation."
      )
    );
  }

  const file = SortableFile.make({
    canonicalPath: canonicalPath.value,
    extension,
    mediaKind,
    name: entry,
    size: stat.size,
    sourcePath,
  });

  if (!isSupportedMetadataImageFile(file)) {
    return archiveCandidateCollectedSkipped(
      makeArchivePoorCandidatesSkippedEntry(
        entry,
        sourcePath,
        O.some(extension),
        "unsupported-image",
        "Image extension is not supported by sharp candidate assessment."
      )
    );
  }

  return archiveCandidateCollectedFile(file);
});

const collectArchiveCandidateFiles = Effect.fn("Files.collectArchiveCandidateFiles")(function* (
  directory: string,
  canonicalDirectory: string
): Effect.fn.Return<
  {
    readonly files: ReadonlyArray<SortableFile>;
    readonly skipped: ReadonlyArray<ArchivePoorCandidatesSkippedEntry>;
  },
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal
> {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs
    .readDirectory(directory)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to read directory", directory, { cause })));
  const collectedEntries = yield* runFilesProgressForEach(
    entries,
    (entry) => collectArchiveCandidateFile(directory, canonicalDirectory, entry),
    {
      concurrency: FilesConcurrency.scan,
      label: "archive scan",
    }
  );
  const files = A.flatMap(collectedEntries, (collected) => collected.files);
  const skipped = A.flatMap(collectedEntries, (collected) => collected.skipped);

  return {
    files: A.sort(files, byNameAscending),
    skipped: A.sort(
      skipped,
      Order.mapInput(Order.String, (entry: ArchivePoorCandidatesSkippedEntry) => entry.sourceName)
    ),
  };
});

const probeImageDimensions = Effect.fn("Files.probeImageDimensions")(function* (
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
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const ffprobePath = yield* resolveTrustedMediaToolPath("ffprobe", "BEEP_FFPROBE_PATH");
  const command = ChildProcess.make(
    ffprobePath,
    [
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
    {
      cwd: path.dirname(file.sourcePath),
      stderr: "pipe",
      stdout: "pipe",
    }
  );
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* command;
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [collectText(handle.stdout), collectText(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" }
      );
      return { exitCode, stderr, stdout };
    })
  ).pipe(
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
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
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
    O.match({
      onNone: () =>
        Effect.fail(
          FilesCommandError.make({
            message: `ffprobe did not return a video stream for "${file.sourcePath}"`,
          })
        ),
      onSome: Effect.succeed,
    })
  );
  const dimensions = MediaDimensions.make({
    height: stream.height,
    width: stream.width,
  });
  const shouldSwap = pipe(rotationFromStream(stream), O.exists(isQuarterTurnRotation));

  return maybeSwapDimensions(dimensions, shouldSwap);
});

const probeMediaDimensions = Effect.fn("Files.probeMediaDimensions")(function* (
  file: SortableFile
): Effect.fn.Return<
  MediaDimensions,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const mediaKind = yield* pipe(
    file.mediaKind,
    O.match({
      onNone: () =>
        Effect.fail(
          FilesCommandError.make({
            message: `Cannot probe dimensions for non-media file: "${file.sourcePath}"`,
          })
        ),
      onSome: Effect.succeed,
    })
  );

  if (mediaKind === "image") {
    return yield* probeImageDimensions(file);
  }

  return yield* probeVideoDimensions(file);
});

const readImagePixelsForBorderDetection = Effect.fn("Files.readImagePixelsForBorderDetection")(function* (
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

const analyzeDetectBordersFile = Effect.fn("Files.analyzeDetectBordersFile")(function* (
  file: SortableFile,
  options: DetectBordersOptions
): Effect.fn.Return<DetectBordersEntry, FilesCommandError> {
  const pixels = yield* readImagePixelsForBorderDetection(file);
  const sides = analyzeSolidBorders(pixels, options);
  const classification = classifyBorderSides(sides);
  const borderCount = A.length(A.filter(sides, (side) => side.matched));

  return DetectBordersEntry.make({
    borderCount,
    classification,
    extension: file.extension,
    hasBorder: borderCount > 0,
    height: pixels.height,
    sides,
    sourceName: file.name,
    sourcePath: file.sourcePath,
    width: pixels.width,
  });
});

const faceAreaPct = (face: DetectedFace, width: number, height: number): number =>
  roundCandidateMetric((face.box.width * face.box.height * 100) / (width * height));

const faceAtEdge = (face: DetectedFace, width: number, height: number, edgeMarginPct: number): boolean => {
  const xMargin = (width * edgeMarginPct) / 100;
  const yMargin = (height * edgeMarginPct) / 100;
  return (
    face.box.x <= xMargin ||
    face.box.y <= yMargin ||
    face.box.x + face.box.width >= width - xMargin ||
    face.box.y + face.box.height >= height - yMargin
  );
};

const detectFacesFlags = (
  faces: ReadonlyArray<DetectedFace>,
  width: number,
  height: number,
  options: DetectFacesOptions
): ReadonlyArray<DetectFacesFlag> => {
  const primary = A.head(faces);

  if (O.isNone(primary)) {
    return A.of("no-face");
  }

  let flags: ReadonlyArray<DetectFacesFlag> = A.of("has-face");
  const primaryFaceAreaPct = faceAreaPct(primary.value, width, height);

  if (A.length(faces) > 1) {
    flags = A.append(flags, "multiple-faces");
  }

  if (primaryFaceAreaPct < options.minFaceAreaPct) {
    flags = A.append(flags, "face-too-small");
  }

  if (faceAtEdge(primary.value, width, height, options.edgeMarginPct)) {
    flags = A.append(flags, "face-at-edge");
  }

  return flags;
};

const analyzeDetectFacesFile = Effect.fn("Files.analyzeDetectFacesFile")(function* (
  detector: LoadedFaceDetector,
  file: SortableFile,
  options: DetectFacesOptions
): Effect.fn.Return<DetectFacesEntry, FilesCommandError> {
  const result = yield* detector
    .detect(
      FaceDetectionImageRequest.make({
        imagePath: file.sourcePath,
        minConfidence: options.minConfidence,
      })
    )
    .pipe(
      Effect.mapError((cause) =>
        FilesCommandError.make({
          message: cause.message,
          cause,
        })
      )
    );
  const primaryFace = A.head(result.faces);
  const primaryFaceAreaPct = O.map(primaryFace, (face) => faceAreaPct(face, result.width, result.height));
  const primaryFaceFields = pipe(
    primaryFace,
    O.map((value) => ({ primaryFace: value })),
    O.getOrElse(() => ({}))
  );
  const primaryFaceAreaFields = pipe(
    primaryFaceAreaPct,
    O.map((value) => ({ primaryFaceAreaPct: value })),
    O.getOrElse(() => ({}))
  );
  const flags = detectFacesFlags(result.faces, result.width, result.height, options);

  return DetectFacesEntry.make({
    extension: file.extension,
    faceCount: A.length(result.faces),
    faces: result.faces,
    flags,
    hasFace: O.isSome(primaryFace),
    height: result.height,
    ...primaryFaceFields,
    ...primaryFaceAreaFields,
    sourceName: file.name,
    sourcePath: file.sourcePath,
    width: result.width,
  });
});

const buildCropBordersPlan = Effect.fn("Files.buildCropBordersPlan")(function* (
  options: CropBordersOptions
): Effect.fn.Return<CropBordersPlan, FilesCommandError, FileSystem.FileSystem | Path.Path | Terminal.Terminal> {
  const validatedOptions = yield* validateCropBordersOptions(options);
  const detectionOptions = cropBordersDetectionOptions(validatedOptions);
  const collection = yield* collectDetectBordersFiles(validatedOptions.dir);
  const detectionResults = yield* runFilesProgressForEach(
    collection.files,
    (file) => analyzeDetectBordersFile(file, detectionOptions).pipe(Effect.result),
    {
      concurrency: FilesConcurrency.image,
      label: "crop analyze",
    }
  );
  let analyzedCount = 0;
  let borderedCount = 0;
  let skippedCount = A.length(collection.skipped);
  let entries = A.empty<CropBordersPlanEntry>();

  for (const result of detectionResults) {
    if (Result.isFailure(result)) {
      skippedCount += 1;
      continue;
    }

    analyzedCount += 1;

    if (!result.success.hasBorder) {
      continue;
    }

    borderedCount += 1;
    const cropEntry = cropBordersPlanEntryFromDetection(result.success);

    if (O.isNone(cropEntry)) {
      skippedCount += 1;
      continue;
    }

    entries = A.append(entries, cropEntry.value);
  }

  return CropBordersPlan.make({
    analyzedCount,
    borderedCount,
    directory: collection.directory,
    entries,
    skippedCount,
  });
});

const uniqueNormalizeTargetName = (
  stem: string,
  format: NormalizeImageFormat,
  usedTargetNames: HashSet.HashSet<string>
): {
  readonly targetName: string;
  readonly usedTargetNames: HashSet.HashSet<string>;
} => {
  const extension = normalizeOutputExtension(format);
  let suffix = 0;
  let targetName = `${stem}${extension}`;

  while (HashSet.has(usedTargetNames, targetName)) {
    suffix += 1;
    targetName = `${stem}_${formatIndex(suffix, 2)}${extension}`;
  }

  return {
    targetName,
    usedTargetNames: HashSet.add(usedTargetNames, targetName),
  };
};

const uniqueArchiveTargetName = (
  stem: string,
  extension: string,
  usedTargetNames: HashSet.HashSet<string>
): {
  readonly targetName: string;
  readonly usedTargetNames: HashSet.HashSet<string>;
} => {
  let suffix = 0;
  let targetName = `${stem}${extension}`;

  while (HashSet.has(usedTargetNames, targetName)) {
    suffix += 1;
    targetName = `${stem}_${formatIndex(suffix, 2)}${extension}`;
  }

  return {
    targetName,
    usedTargetNames: HashSet.add(usedTargetNames, targetName),
  };
};

const buildNormalizePlan = Effect.fn("Files.buildNormalizePlan")(function* (
  options: NormalizeFilesOptions
): Effect.fn.Return<NormalizePlan, FilesCommandError, FileSystem.FileSystem | Path.Path | Terminal.Terminal> {
  const path = yield* Path.Path;
  const { canonicalDirectory, directory, duplicateDirectory, outputDirectory } = yield* validateNormalizeDirectories(
    options.dir,
    options.outDir,
    options.moveDuplicatesTo
  );
  const manifestPath = path.resolve(
    O.getOrElse(options.manifest, () => path.join(outputDirectory, "normalize-manifest.json"))
  );
  const collection = yield* collectNormalizeFiles(directory, canonicalDirectory);
  const manifestOptions = makeNormalizeManifestOptions(
    options.dedupe,
    options.format,
    options.maxLongEdge,
    duplicateDirectory,
    options.overwrite
  );
  let planInputs = A.empty<{
    readonly file: SortableFile;
    readonly outputPath: string;
    readonly targetName: string;
  }>();
  let usedTargetNames = HashSet.empty<string>();

  for (const file of collection.files) {
    const sourceStem = path.basename(file.name, file.extension);
    const uniqueTarget = uniqueNormalizeTargetName(sourceStem, options.format, usedTargetNames);
    usedTargetNames = uniqueTarget.usedTargetNames;
    const outputPath = path.join(outputDirectory, uniqueTarget.targetName);

    planInputs = A.append(planInputs, {
      file,
      outputPath,
      targetName: uniqueTarget.targetName,
    });
  }
  const entries = yield* runFilesProgressForEach(
    planInputs,
    ({ file, outputPath, targetName }) =>
      probeImageDimensions(file).pipe(
        Effect.map((inputDimensions) => {
          const outputDimensions = normalizeOutputDimensions(inputDimensions, options.maxLongEdge);

          return NormalizePlanEntry.make({
            format: options.format,
            inputDimensions,
            outputDimensions,
            outputName: targetName,
            outputPath,
            outputRelativePath: path.relative(outputDirectory, outputPath),
            resized: mediaDimensionsChanged(inputDimensions, outputDimensions),
            sourceExtension: file.extension,
            sourceName: file.name,
            sourcePath: file.sourcePath,
            sourceRelativePath: path.relative(directory, file.sourcePath),
            sourceSizeBytes: `${file.size}`,
          });
        })
      ),
    {
      concurrency: FilesConcurrency.metadata,
      label: "normalize probe",
    }
  );

  return NormalizePlan.make({
    duplicateDirectory,
    entries,
    manifestPath,
    options: manifestOptions,
    outputDirectory,
    skipped: collection.skipped,
    sourceDirectory: directory,
  });
});

const collectArchiveSidecars = Effect.fn("Files.collectArchiveSidecars")(function* (
  sourceStem: string,
  targetStem: string,
  directory: string,
  archiveDirectory: string,
  sidecarExtensions: ReadonlyArray<string>,
  plannedSidecarSources: HashSet.HashSet<string>
): Effect.fn.Return<
  {
    readonly plannedSidecarSources: HashSet.HashSet<string>;
    readonly sidecars: ReadonlyArray<ArchivedSidecarEntry>;
  },
  FilesCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let sidecars = A.empty<ArchivedSidecarEntry>();
  let usedSources = plannedSidecarSources;

  for (const extension of sidecarExtensions) {
    const sourcePath = path.join(directory, `${sourceStem}.${extension}`);

    if (HashSet.has(usedSources, sourcePath)) {
      continue;
    }

    const exists = yield* fs
      .exists(sourcePath)
      .pipe(Effect.mapError((cause) => formatPlatformError("Failed to inspect sidecar file", sourcePath, { cause })));

    if (!exists) {
      continue;
    }

    const stat = yield* fs
      .stat(sourcePath)
      .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat sidecar file", sourcePath, { cause })));

    if (stat.type !== "File") {
      continue;
    }

    const archivePath = path.join(archiveDirectory, `${targetStem}.${extension}`);
    usedSources = HashSet.add(usedSources, sourcePath);
    sidecars = A.append(
      sidecars,
      ArchivedSidecarEntry.make({
        archivePath,
        archiveRelativePath: path.relative(archiveDirectory, archivePath),
        extension: `.${extension}`,
        sourcePath,
        sourceRelativePath: path.relative(directory, sourcePath),
      })
    );
  }

  return {
    plannedSidecarSources: usedSources,
    sidecars,
  };
});

const buildArchivePoorCandidatesPlan = Effect.fn("Files.buildArchivePoorCandidatesPlan")(function* (
  options: ArchivePoorCandidatesOptions,
  sidecarExtensions: ReadonlyArray<string>
): Effect.fn.Return<
  ArchivePoorCandidatesPlan,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal
> {
  const path = yield* Path.Path;
  const { archiveDirectory, canonicalDirectory, directory } = yield* validateArchiveDirectories(
    options.dir,
    options.archiveDir
  );
  const manifestPath = path.resolve(
    O.getOrElse(options.manifest, () => path.join(archiveDirectory, "archive-poor-candidates-manifest.json"))
  );
  const collection = yield* collectArchiveCandidateFiles(directory, canonicalDirectory);
  const manifestOptions = ArchivePoorCandidatesManifestOptions.make({
    maxAspect: options.maxAspect,
    maxUpscale: options.maxUpscale,
    minShortEdge: options.minShortEdge,
    overwrite: options.overwrite,
    profile: options.profile,
    sidecars: sidecarExtensions,
    targetResolution: options.targetResolution,
  });
  let entries = A.empty<ArchivePoorCandidatesEntry>();
  let skipped = collection.skipped;
  let usedTargetNames = HashSet.empty<string>();
  let plannedSidecarSources = HashSet.empty<string>();
  const dimensionResults = yield* runFilesProgressForEach(
    collection.files,
    (file) => probeImageDimensions(file).pipe(Effect.result),
    {
      concurrency: FilesConcurrency.metadata,
      label: "archive probe",
    }
  );

  for (const [file, dimensionsResult] of A.zip(collection.files, dimensionResults)) {
    if (Result.isFailure(dimensionsResult)) {
      skipped = A.append(
        skipped,
        makeArchivePoorCandidatesSkippedEntry(
          file.name,
          file.sourcePath,
          O.some(file.extension),
          "unreadable-image",
          dimensionsResult.failure.message
        )
      );
      continue;
    }

    const sourceStem = path.basename(file.name, file.extension);
    const assessment = assessImageCandidate(dimensionsResult.success, {
      maxAspect: options.maxAspect,
      maxUpscale: options.maxUpscale,
      minShortEdge: options.minShortEdge,
      targetResolution: options.targetResolution,
    });

    if (assessment.decision === "keep") {
      entries = A.append(
        entries,
        ArchivePoorCandidatesEntry.make({
          decision: "keep",
          dimensions: dimensionsResult.success,
          extension: file.extension,
          metrics: assessment.metrics,
          reasons: assessment.reasons,
          sidecars: A.empty<ArchivedSidecarEntry>(),
          sourceName: file.name,
          sourcePath: file.sourcePath,
          sourceRelativePath: path.relative(directory, file.sourcePath),
          sourceSizeBytes: `${file.size}`,
        })
      );
      continue;
    }

    const uniqueTarget = uniqueArchiveTargetName(sourceStem, file.extension, usedTargetNames);
    usedTargetNames = uniqueTarget.usedTargetNames;
    const archivePath = path.join(archiveDirectory, uniqueTarget.targetName);
    const targetStem = path.basename(uniqueTarget.targetName, file.extension);
    const sidecarPlan = yield* collectArchiveSidecars(
      sourceStem,
      targetStem,
      directory,
      archiveDirectory,
      sidecarExtensions,
      plannedSidecarSources
    );
    plannedSidecarSources = sidecarPlan.plannedSidecarSources;

    entries = A.append(
      entries,
      ArchivePoorCandidatesEntry.make({
        archiveName: uniqueTarget.targetName,
        archivePath,
        archiveRelativePath: path.relative(archiveDirectory, archivePath),
        decision: "archive",
        dimensions: dimensionsResult.success,
        extension: file.extension,
        metrics: assessment.metrics,
        reasons: assessment.reasons,
        sidecars: sidecarPlan.sidecars,
        sourceName: file.name,
        sourcePath: file.sourcePath,
        sourceRelativePath: path.relative(directory, file.sourcePath),
        sourceSizeBytes: `${file.size}`,
      })
    );
  }

  const skippedWithoutMovedSidecars = A.filter(
    skipped,
    (entry) => !HashSet.has(plannedSidecarSources, entry.sourcePath)
  );

  return ArchivePoorCandidatesPlan.make({
    archiveDirectory,
    entries,
    manifestPath,
    options: manifestOptions,
    skipped: A.sort(
      skippedWithoutMovedSidecars,
      Order.mapInput(Order.String, (entry: ArchivePoorCandidatesSkippedEntry) => entry.sourceName)
    ),
    sourceDirectory: directory,
  });
});

const preflightOverwritableFile = Effect.fn("Files.preflightOverwritableFile")(function* (
  filePath: string,
  overwrite: boolean,
  description: string
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(filePath)
    .pipe(Effect.mapError((cause) => formatPlatformError(`Failed to inspect ${description}`, filePath, { cause })));

  if (!exists) {
    return;
  }

  if (!overwrite) {
    return yield* FilesCommandError.make({
      message: `Refusing to overwrite existing ${description}: "${filePath}"`,
    });
  }

  const stat = yield* fs
    .stat(filePath)
    .pipe(Effect.mapError((cause) => formatPlatformError(`Failed to stat ${description}`, filePath, { cause })));

  if (stat.type !== "File") {
    return yield* FilesCommandError.make({
      message: `Refusing to overwrite non-file ${description}: "${filePath}"`,
    });
  }
});

const preflightNormalizeOutputs = Effect.fn("Files.preflightNormalizeOutputs")(function* (
  plan: NormalizePlan,
  overwrite: boolean
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  let targetPaths = HashSet.empty<string>();

  for (const entry of plan.entries) {
    if (HashSet.has(targetPaths, entry.outputPath)) {
      return yield* FilesCommandError.make({
        message: `Refusing duplicate normalize output target: "${entry.outputPath}"`,
      });
    }
    targetPaths = HashSet.add(targetPaths, entry.outputPath);
    yield* preflightOverwritableFile(entry.outputPath, overwrite, "normalize output file");
  }

  if (HashSet.has(targetPaths, plan.manifestPath)) {
    return yield* FilesCommandError.make({
      message: `Refusing to write normalize manifest over an output image: "${plan.manifestPath}"`,
    });
  }

  yield* preflightOverwritableFile(plan.manifestPath, overwrite, "normalize manifest");
});

const preflightArchivePoorCandidatesOutputs = Effect.fn("Files.preflightArchivePoorCandidatesOutputs")(function* (
  plan: ArchivePoorCandidatesPlan,
  overwrite: boolean
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  let targetPaths = HashSet.empty<string>();

  for (const entry of plan.entries) {
    const archivePath = O.fromUndefinedOr(entry.archivePath);

    if (O.isSome(archivePath)) {
      if (HashSet.has(targetPaths, archivePath.value)) {
        return yield* FilesCommandError.make({
          message: `Refusing duplicate archive target: "${archivePath.value}"`,
        });
      }
      targetPaths = HashSet.add(targetPaths, archivePath.value);
      yield* preflightOverwritableFile(archivePath.value, overwrite, "archive output file");
    }

    for (const sidecar of entry.sidecars) {
      if (HashSet.has(targetPaths, sidecar.archivePath)) {
        return yield* FilesCommandError.make({
          message: `Refusing duplicate archive sidecar target: "${sidecar.archivePath}"`,
        });
      }
      targetPaths = HashSet.add(targetPaths, sidecar.archivePath);
      yield* preflightOverwritableFile(sidecar.archivePath, overwrite, "archive sidecar file");
    }
  }

  if (HashSet.has(targetPaths, plan.manifestPath)) {
    return yield* FilesCommandError.make({
      message: `Refusing to write archive manifest over an archived file: "${plan.manifestPath}"`,
    });
  }

  yield* preflightOverwritableFile(plan.manifestPath, overwrite, "archive manifest");
});

const normalizeImageToTemp = Effect.fn("Files.normalizeImageToTemp")(function* (
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

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
};

const hashFileSha256 = Effect.fn("Files.hashFileSha256")(function* (
  filePath: string
): Effect.fn.Return<FileSha256Hash, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const data = yield* fs
    .readFile(filePath)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to read file for hashing", filePath, { cause })));

  return yield* Effect.tryPromise({
    try: (): Promise<FileSha256Hash> =>
      crypto.subtle.digest("SHA-256", new Uint8Array(data)).then((digest) => {
        const hex = pipe(
          A.fromIterable(new Uint8Array(digest)),
          A.map((value) => Str.padStart(2, "0")(value.toString(16))),
          A.join("")
        );

        return `sha256:${hex}`;
      }),
    catch: FilesCommandError.new(`Failed to hash normalized file "${filePath}"`),
  });
});

const fileBytesEqual = Effect.fn("Files.fileBytesEqual")(function* (
  leftPath: string,
  rightPath: string
): Effect.fn.Return<boolean, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const left = yield* fs
    .readFile(leftPath)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to read file for duplicate comparison", leftPath, { cause })
      )
    );
  const right = yield* fs
    .readFile(rightPath)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to read file for duplicate comparison", rightPath, { cause })
      )
    );

  return bytesEqual(left, right);
});

const findDuplicateOutput = Effect.fn("Files.findDuplicateOutput")(function* (
  candidates: ReadonlyArray<NormalizeSeenOutput>,
  tempPath: string
): Effect.fn.Return<O.Option<NormalizeSeenOutput>, FilesCommandError, FileSystem.FileSystem> {
  for (const candidate of candidates) {
    const exactMatch = yield* fileBytesEqual(candidate.tempPath, tempPath);

    if (exactMatch) {
      return O.some(candidate);
    }
  }

  return O.none<NormalizeSeenOutput>();
});

const withOutputMetadata = (
  entry: NormalizePlanEntry,
  outputSizeBytes: string,
  outputHash: O.Option<FileSha256Hash>
): NormalizePlanEntry => {
  const base = {
    format: entry.format,
    inputDimensions: entry.inputDimensions,
    outputDimensions: entry.outputDimensions,
    outputName: entry.outputName,
    outputPath: entry.outputPath,
    outputRelativePath: entry.outputRelativePath,
    outputSizeBytes,
    resized: entry.resized,
    sourceExtension: entry.sourceExtension,
    sourceName: entry.sourceName,
    sourcePath: entry.sourcePath,
    sourceRelativePath: entry.sourceRelativePath,
    sourceSizeBytes: entry.sourceSizeBytes,
  };

  return O.isSome(outputHash)
    ? NormalizePlanEntry.make({ ...base, outputHash: outputHash.value })
    : NormalizePlanEntry.make(base);
};

const makeNormalizeManifest = (
  plan: NormalizePlan,
  completedEntries: ReadonlyArray<NormalizePlanEntry>,
  duplicateSkippedEntries: ReadonlyArray<NormalizeSkippedEntry>
) => {
  const skipped = A.appendAll(plan.skipped, duplicateSkippedEntries);
  const movedDuplicateCount = pipe(
    duplicateSkippedEntries,
    A.filter((entry) => O.isSome(O.fromUndefinedOr(entry.duplicateMovedPath))),
    A.length
  );

  return NormalizeManifest.make({
    entries: completedEntries,
    manifestPath: plan.manifestPath,
    options: plan.options,
    outputDirectory: plan.outputDirectory,
    schemaVersion: "beep.files.normalize.v1",
    skipped,
    sourceDirectory: plan.sourceDirectory,
    summary: NormalizeManifestSummary.make({
      duplicateCount: A.length(duplicateSkippedEntries),
      movedDuplicateCount,
      normalizedCount: A.length(completedEntries),
      plannedCount: A.length(plan.entries),
      resizedCount: A.length(A.filter(completedEntries, (entry) => entry.resized)),
      skippedCount: A.length(skipped),
    }),
  });
};

const renderNormalizeManifest = Effect.fn("Files.renderNormalizeManifest")(function* (
  manifestPath: string,
  manifest: NormalizeManifest
): Effect.fn.Return<string, FilesCommandError, Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const encoded = yield* encodeNormalizeManifest(manifest).pipe(
    FilesCommandError.mapError(`Failed to encode normalize manifest for "${manifestPath}"`)
  );

  return yield* renderBiomeJson(manifestPath, encoded).pipe(
    FilesCommandError.mapError(`Failed to render normalize manifest for "${manifestPath}"`)
  );
});

const archivedEntries = (
  entries: ReadonlyArray<ArchivePoorCandidatesEntry>
): ReadonlyArray<ArchivePoorCandidatesEntry> => A.filter(entries, (entry) => entry.decision === "archive");

const countMovedSidecars = (entries: ReadonlyArray<ArchivePoorCandidatesEntry>): number =>
  A.reduce(entries, 0, (count, entry) => count + A.length(entry.sidecars));

const makeArchivePoorCandidatesManifest = (plan: ArchivePoorCandidatesPlan): ArchivePoorCandidatesManifest =>
  ArchivePoorCandidatesManifest.make({
    archiveDirectory: plan.archiveDirectory,
    entries: plan.entries,
    manifestPath: plan.manifestPath,
    options: plan.options,
    schemaVersion: "beep.files.archive-poor-candidates.v1",
    skipped: plan.skipped,
    sourceDirectory: plan.sourceDirectory,
    summary: ArchivePoorCandidatesManifestSummary.make({
      archivedCount: A.length(archivedEntries(plan.entries)),
      assessedCount: A.length(plan.entries),
      keptCount: A.length(A.filter(plan.entries, (entry) => entry.decision === "keep")),
      movedSidecarCount: countMovedSidecars(plan.entries),
      skippedCount: A.length(plan.skipped),
    }),
  });

const renderArchivePoorCandidatesManifest = Effect.fn("Files.renderArchivePoorCandidatesManifest")(function* (
  manifestPath: string,
  manifest: ArchivePoorCandidatesManifest
): Effect.fn.Return<string, FilesCommandError, Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const encoded = yield* encodeArchivePoorCandidatesManifest(manifest).pipe(
    FilesCommandError.mapError(`Failed to encode archive manifest for "${manifestPath}"`)
  );

  return yield* renderBiomeJson(manifestPath, encoded).pipe(
    FilesCommandError.mapError(`Failed to render archive manifest for "${manifestPath}"`)
  );
});

const renderDetectBordersReportJson = Effect.fn("Files.renderDetectBordersReportJson")(function* (
  report: DetectBordersReport
): Effect.fn.Return<string, FilesCommandError, Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const encoded = yield* encodeDetectBordersReport(report).pipe(
    FilesCommandError.mapError("Failed to encode detect-borders report")
  );

  return yield* renderBiomeJson("detect-borders-report.json", encoded).pipe(
    FilesCommandError.mapError("Failed to render detect-borders report")
  );
});

const renderDetectFacesReportJson = Effect.fn("Files.renderDetectFacesReportJson")(function* (
  report: DetectFacesReport,
  outputPath: string
): Effect.fn.Return<string, FilesCommandError, Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const encoded = yield* encodeDetectFacesReport(report).pipe(
    FilesCommandError.mapError(`Failed to encode detect-faces report for "${outputPath}"`)
  );

  return yield* renderBiomeJson(outputPath, encoded).pipe(
    FilesCommandError.mapError(`Failed to render detect-faces report for "${outputPath}"`)
  );
});

const writeDetectFacesManifest = Effect.fn("Files.writeDetectFacesManifest")(function* (
  report: DetectFacesReport
): Effect.fn.Return<
  void,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const content = yield* renderDetectFacesReportJson(report, report.manifestPath);

  yield* fs
    .makeDirectory(path.dirname(report.manifestPath), { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create detect-faces manifest directory", report.manifestPath, { cause })
      )
    );
  yield* fs
    .writeFileString(report.manifestPath, content)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to write detect-faces manifest", report.manifestPath, { cause })
      )
    );
});

const applyNormalizePlan = Effect.fn("Files.applyNormalizePlan")(function* (
  plan: NormalizePlan,
  maxLongEdge: O.Option<PositiveMediaDimension>,
  dedupe: boolean,
  overwrite: boolean
): Effect.fn.Return<
  NormalizeApplyResult,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs
    .makeDirectory(plan.outputDirectory, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create normalize output directory", plan.outputDirectory, { cause })
      )
    );
  yield* fs
    .makeDirectory(path.dirname(plan.manifestPath), { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create normalize manifest directory", plan.manifestPath, { cause })
      )
    );
  if (O.isSome(plan.duplicateDirectory)) {
    const duplicateDirectory = plan.duplicateDirectory.value;

    yield* fs.makeDirectory(duplicateDirectory, { recursive: true }).pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create normalize duplicate move directory", duplicateDirectory, {
          cause,
        })
      )
    );
  }

  return yield* Effect.acquireUseRelease(
    fs
      .makeTempDirectory({
        directory: plan.outputDirectory,
        prefix: ".beep-files-normalize-",
      })
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to create temporary normalize directory", plan.outputDirectory, { cause })
        )
      ),
    Effect.fnUntraced(function* (tempDir) {
      const tempEntries = A.map(plan.entries, (entry, index) => ({
        entry,
        tempPath: path.join(
          tempDir,
          `${formatIndex(index, `${A.length(plan.entries)}`.length + 1)}-${entry.outputName}`
        ),
      }));
      let completedEntries = A.empty<NormalizePlanEntry>();
      let duplicateMoves = A.empty<NormalizeDuplicateMove>();
      let duplicateSkippedEntries = A.empty<NormalizeSkippedEntry>();
      let duplicateMoveTargets = HashSet.empty<string>();
      let readyTempEntries = A.empty<{
        readonly entry: NormalizePlanEntry;
        readonly tempPath: string;
      }>();
      let seenOutputs = HashMap.empty<FileSha256Hash, ReadonlyArray<NormalizeSeenOutput>>();

      yield* runFilesProgressForEach(
        tempEntries,
        Effect.fnUntraced(function* ({ entry, tempPath }) {
          yield* normalizeImageToTemp(entry, tempPath, maxLongEdge);
          const outputStat = yield* fs
            .stat(tempPath)
            .pipe(
              Effect.mapError((cause) => formatPlatformError("Failed to stat normalized image", tempPath, { cause }))
            );
          const outputHash = dedupe ? O.some(yield* hashFileSha256(tempPath)) : O.none<FileSha256Hash>();
          const candidates = O.isSome(outputHash)
            ? pipe(HashMap.get(seenOutputs, outputHash.value), O.getOrElse(A.empty<NormalizeSeenOutput>))
            : A.empty<NormalizeSeenOutput>();
          const duplicate = O.isSome(outputHash)
            ? yield* findDuplicateOutput(candidates, tempPath)
            : O.none<NormalizeSeenOutput>();

          if (O.isSome(duplicate) && O.isSome(outputHash)) {
            const moveTarget = O.map(plan.duplicateDirectory, (duplicateDirectory) => {
              const targetPath = path.join(duplicateDirectory, entry.sourceName);

              return {
                path: targetPath,
                relativePath: path.relative(duplicateDirectory, targetPath),
              };
            });
            const skippedEntry = makeNormalizeDuplicateSkippedEntry(
              entry,
              outputHash.value,
              duplicate.value.entry,
              moveTarget
            );

            if (O.isSome(moveTarget)) {
              if (HashSet.has(duplicateMoveTargets, moveTarget.value.path)) {
                return yield* FilesCommandError.make({
                  message: `Refusing duplicate normalize duplicate move target: "${moveTarget.value.path}"`,
                });
              }

              duplicateMoveTargets = HashSet.add(duplicateMoveTargets, moveTarget.value.path);
              yield* preflightOverwritableFile(moveTarget.value.path, overwrite, "duplicate source file");
              duplicateMoves = A.append(duplicateMoves, {
                sourcePath: entry.sourcePath,
                targetPath: moveTarget.value.path,
              });
            }

            duplicateSkippedEntries = A.append(duplicateSkippedEntries, skippedEntry);
            return;
          }

          const completedEntry = withOutputMetadata(entry, `${outputStat.size}`, outputHash);
          completedEntries = A.append(completedEntries, completedEntry);
          readyTempEntries = A.append(readyTempEntries, {
            entry: completedEntry,
            tempPath,
          });

          if (O.isSome(outputHash)) {
            seenOutputs = HashMap.set(
              seenOutputs,
              outputHash.value,
              A.append(candidates, {
                entry: completedEntry,
                outputHash: outputHash.value,
                tempPath,
              })
            );
          }
        }),
        {
          concurrency: 1,
          label: "normalize write",
        }
      );

      const manifest = makeNormalizeManifest(plan, completedEntries, duplicateSkippedEntries);
      const manifestContent = yield* renderNormalizeManifest(plan.manifestPath, manifest);
      const tempManifestPath = path.join(tempDir, "normalize-manifest.json");
      yield* fs
        .writeFileString(tempManifestPath, manifestContent)
        .pipe(
          Effect.mapError((cause) =>
            formatPlatformError("Failed to write temporary normalize manifest", tempManifestPath, { cause })
          )
        );

      yield* runFilesProgressForEach(
        readyTempEntries,
        Effect.fnUntraced(function* ({ entry, tempPath }) {
          if (overwrite) {
            yield* fs.remove(entry.outputPath, { force: true }).pipe(Effect.ignore);
          }
          yield* renameOrFail(tempPath, entry.outputPath, tempDir);
        }),
        {
          concurrency: FilesConcurrency.scan,
          label: "normalize move",
        }
      );

      yield* runFilesProgressForEach(
        duplicateMoves,
        Effect.fnUntraced(function* (duplicateMove) {
          if (overwrite) {
            yield* fs.remove(duplicateMove.targetPath, { force: true }).pipe(Effect.ignore);
          }
          yield* renameOrFail(duplicateMove.sourcePath, duplicateMove.targetPath, tempDir);
        }),
        {
          concurrency: FilesConcurrency.scan,
          label: "duplicates move",
        }
      );

      if (overwrite) {
        yield* fs.remove(plan.manifestPath, { force: true }).pipe(Effect.ignore);
      }
      yield* renameOrFail(tempManifestPath, plan.manifestPath, tempDir);

      return { completedEntries, duplicateMoves, duplicateSkippedEntries };
    }),
    (tempDir) =>
      fs
        .remove(tempDir, {
          recursive: true,
          force: true,
        })
        .pipe(Effect.ignore)
  );
});

const applyArchivePoorCandidatesPlan = Effect.fn("Files.applyArchivePoorCandidatesPlan")(function* (
  plan: ArchivePoorCandidatesPlan,
  overwrite: boolean
): Effect.fn.Return<
  void,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs
    .makeDirectory(plan.archiveDirectory, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create archive directory", plan.archiveDirectory, { cause })
      )
    );
  yield* fs
    .makeDirectory(path.dirname(plan.manifestPath), { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create archive manifest directory", plan.manifestPath, { cause })
      )
    );

  return yield* Effect.acquireUseRelease(
    fs
      .makeTempDirectory({
        directory: plan.archiveDirectory,
        prefix: ".beep-files-archive-poor-candidates-",
      })
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to create temporary archive directory", plan.archiveDirectory, { cause })
        )
      ),
    Effect.fnUntraced(function* (tempDir) {
      const manifest = makeArchivePoorCandidatesManifest(plan);
      const manifestContent = yield* renderArchivePoorCandidatesManifest(plan.manifestPath, manifest);
      const tempManifestPath = path.join(tempDir, "archive-poor-candidates-manifest.json");

      yield* fs
        .writeFileString(tempManifestPath, manifestContent)
        .pipe(
          Effect.mapError((cause) =>
            formatPlatformError("Failed to write temporary archive manifest", tempManifestPath, { cause })
          )
        );

      yield* runFilesProgressForEach(
        archivedEntries(plan.entries),
        Effect.fnUntraced(function* (entry) {
          const archivePath = O.fromUndefinedOr(entry.archivePath);

          if (O.isNone(archivePath)) {
            return yield* FilesCommandError.make({
              message: `Missing archive target for selected source: "${entry.sourcePath}"`,
            });
          }

          if (overwrite) {
            yield* fs.remove(archivePath.value, { force: true }).pipe(Effect.ignore);
          }
          yield* renameOrFail(entry.sourcePath, archivePath.value, tempDir);

          for (const sidecar of entry.sidecars) {
            if (overwrite) {
              yield* fs.remove(sidecar.archivePath, { force: true }).pipe(Effect.ignore);
            }
            yield* renameOrFail(sidecar.sourcePath, sidecar.archivePath, tempDir);
          }
        }),
        {
          concurrency: FilesConcurrency.scan,
          label: "archive move",
        }
      );

      if (overwrite) {
        yield* fs.remove(plan.manifestPath, { force: true }).pipe(Effect.ignore);
      }
      yield* renameOrFail(tempManifestPath, plan.manifestPath, tempDir);
    }),
    (tempDir) =>
      fs
        .remove(tempDir, {
          recursive: true,
          force: true,
        })
        .pipe(Effect.ignore)
  );
});

const buildRenamePlan = Effect.fn("Files.buildRenamePlan")(function* (
  dir: string,
  prefix: SafeFilePrefix,
  withDimensions: boolean
): Effect.fn.Return<
  RenamePlan,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const collection = yield* collectSortableFiles(dir, withDimensions, "sort scan");
  const width = `${A.length(collection.files)}`.length + 1;
  const dimensionsByFile: ReadonlyArray<O.Option<MediaDimensions>> = withDimensions
    ? yield* runFilesProgressForEach(collection.files, (file) => probeMediaDimensions(file).pipe(Effect.map(O.some)), {
        concurrency: FilesConcurrency.metadata,
        label: "sort probe",
      })
    : A.map(collection.files, O.none<MediaDimensions>);
  let index = 0;
  let plan = A.empty<RenamePlanEntry>();

  for (const [file, dimensions] of A.zip(collection.files, dimensionsByFile)) {
    const targetName = targetNameForEntry(prefix, {
      dimensions,
      file,
      index,
      width,
    });
    plan = A.append(
      plan,
      RenamePlanEntry.make({
        canonicalSourcePath: file.canonicalPath,
        dimensions,
        extension: file.extension,
        index,
        size: file.size,
        sourceName: file.name,
        sourcePath: file.sourcePath,
        targetName,
        targetPath: path.join(path.dirname(file.sourcePath), targetName),
      })
    );
    index += 1;
  }

  return RenamePlan.make({
    entries: plan,
    skippedCount: collection.skippedCount,
  });
});

const preflightTargetCollisions = Effect.fn("Files.preflightTargetCollisions")(function* (
  plan: ReadonlyArray<RenamePlanEntry>
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const selected = selectedCanonicalPathSet(plan);

  for (const entry of plan) {
    const exists = yield* fs
      .exists(entry.targetPath)
      .pipe(
        Effect.mapError((cause) => formatPlatformError("Failed to inspect target path", entry.targetPath, { cause }))
      );

    if (!exists) {
      continue;
    }

    const canonicalTarget = yield* fs
      .realPath(entry.targetPath)
      .pipe(
        Effect.mapError((cause) => formatPlatformError("Failed to resolve target path", entry.targetPath, { cause }))
      );

    if (!HashSet.has(selected, canonicalTarget)) {
      return yield* FilesCommandError.make({
        message: `Refusing to overwrite existing target outside the rename set: "${entry.targetPath}"`,
      });
    }
  }
});

const logRenamePlan = Effect.fn("Files.logRenamePlan")(function* (plan: ReadonlyArray<RenamePlanEntry>) {
  yield* Effect.forEach(plan, (entry) => Console.log(renderPlanEntry(entry)), {
    discard: true,
  });
});

const renameOrFail: (
  sourcePath: string,
  targetPath: string,
  tempDir: string
) => Effect.Effect<void, FilesCommandError, FileSystem.FileSystem> = Effect.fn("Files.renameOrFail")(
  function* (sourcePath, targetPath, tempDir) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs
      .rename(sourcePath, targetPath)
      .pipe(
        FilesCommandError.mapError(
          `Failed to rename "${sourcePath}" to "${targetPath}". Recovery temp directory: "${tempDir}"`
        )
      );
  }
);

const withDetectFacesMovedNoFaceTarget = (
  entry: DetectFacesEntry,
  targetName: string,
  targetPath: string,
  targetRelativePath: string
): DetectFacesEntry => {
  const primaryFace = O.fromUndefinedOr(entry.primaryFace);
  const primaryFaceAreaPct = O.fromUndefinedOr(entry.primaryFaceAreaPct);

  return DetectFacesEntry.make({
    extension: entry.extension,
    faceCount: entry.faceCount,
    faces: entry.faces,
    flags: entry.flags,
    hasFace: entry.hasFace,
    height: entry.height,
    movedNoFaceName: targetName,
    movedNoFacePath: targetPath,
    movedNoFaceRelativePath: targetRelativePath,
    ...O.getSomesStruct({ primaryFace }),
    ...O.getSomesStruct({ primaryFaceAreaPct }),
    sourceName: entry.sourceName,
    sourcePath: entry.sourcePath,
    width: entry.width,
  });
};

const moveDetectFacesNoFaceEntries = Effect.fn("Files.moveDetectFacesNoFaceEntries")(function* (
  entries: ReadonlyArray<DetectFacesEntry>,
  moveNoFaceDirectory: O.Option<string>,
  progressEnabled: boolean
): Effect.fn.Return<
  ReadonlyArray<DetectFacesEntry>,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal
> {
  if (O.isNone(moveNoFaceDirectory)) {
    return entries;
  }

  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const targetDirectory = moveNoFaceDirectory.value;

  yield* fs
    .makeDirectory(targetDirectory, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create no-face image move directory", targetDirectory, { cause })
      )
    );

  let usedTargetNames = HashSet.empty<string>();
  let movePlans = A.empty<{
    readonly entry: DetectFacesEntry;
    readonly targetPath: string;
  }>();
  let nextEntries = A.empty<DetectFacesEntry>();

  for (const entry of entries) {
    if (entry.hasFace) {
      nextEntries = A.append(nextEntries, entry);
      continue;
    }

    const sourceStem = path.basename(entry.sourceName, entry.extension);
    const uniqueTarget = uniqueArchiveTargetName(sourceStem, entry.extension, usedTargetNames);
    usedTargetNames = uniqueTarget.usedTargetNames;

    const targetPath = path.join(targetDirectory, uniqueTarget.targetName);
    const targetRelativePath = path.relative(targetDirectory, targetPath);
    nextEntries = A.append(
      nextEntries,
      withDetectFacesMovedNoFaceTarget(entry, uniqueTarget.targetName, targetPath, targetRelativePath)
    );
    movePlans = A.append(movePlans, { entry, targetPath });
  }

  for (const plan of movePlans) {
    yield* preflightOverwritableFile(plan.targetPath, false, "no-face image target");
  }

  yield* runFilesProgressForEach(
    movePlans,
    ({ entry, targetPath }) => renameOrFail(entry.sourcePath, targetPath, targetDirectory),
    {
      concurrency: FilesConcurrency.scan,
      enabled: progressEnabled,
      label: "faces move",
    }
  );

  return nextEntries;
});

const applyRenamePlan = Effect.fn("Files.applyRenamePlan")(function* (
  directory: string,
  plan: ReadonlyArray<RenamePlanEntry>
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem | Path.Path | Terminal.Terminal> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tempDir = yield* fs
    .makeTempDirectory({ directory, prefix: ".beep-files-sort-and-rename-" })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create temporary rename directory", directory, { cause })
      )
    );

  const tempEntries = A.map(plan, (entry) => ({
    entry,
    tempPath: path.join(tempDir, `${formatIndex(entry.index, `${A.length(plan)}`.length + 1)}-${entry.sourceName}`),
  }));

  yield* runFilesProgressForEach(
    tempEntries,
    ({ entry, tempPath }) => renameOrFail(entry.sourcePath, tempPath, tempDir),
    {
      concurrency: FilesConcurrency.scan,
      label: "sort stage",
    }
  );

  yield* runFilesProgressForEach(
    tempEntries,
    ({ entry, tempPath }) => renameOrFail(tempPath, entry.targetPath, tempDir),
    {
      concurrency: FilesConcurrency.scan,
      label: "sort rename",
    }
  );

  yield* fs
    .remove(tempDir, { recursive: true, force: true })
    .pipe(
      Effect.mapError((cause) => formatPlatformError("Failed to remove temporary rename directory", tempDir, { cause }))
    );
});

const buildStripMetadataPlan = Effect.fn("Files.buildStripMetadataPlan")(function* (
  dir: string
): Effect.fn.Return<StripMetadataPlan, FilesCommandError, FileSystem.FileSystem | Path.Path | Terminal.Terminal> {
  const collection = yield* collectSortableFiles(dir, true, "strip scan");
  let entries = A.empty<StripMetadataPlanEntry>();
  let imageCount = 0;
  let skippedCount = collection.skippedCount;
  let videoCount = 0;

  for (const file of collection.files) {
    if (O.isNone(file.mediaKind)) {
      skippedCount += 1;
      continue;
    }

    const mediaKind: MediaKind = file.mediaKind.value;
    if (mediaKind === "image" && !isSupportedMetadataImageFile(file)) {
      skippedCount += 1;
      continue;
    }

    if (mediaKind === "video" && isUnsafeMetadataVideoExtension(file.extension)) {
      skippedCount += 1;
      continue;
    }

    entries = A.append(
      entries,
      StripMetadataPlanEntry.make({
        extension: file.extension,
        mediaKind,
        size: file.size,
        sourceName: file.name,
        sourcePath: file.sourcePath,
      })
    );

    if (mediaKind === "image") {
      imageCount += 1;
    } else {
      videoCount += 1;
    }
  }

  return StripMetadataPlan.make({
    entries,
    imageCount,
    skippedCount,
    videoCount,
  });
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

const cropImageBordersToTemp = Effect.fn("Files.cropImageBordersToTemp")(function* (
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
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const ffmpegPath = yield* resolveTrustedMediaToolPath("ffmpeg", "BEEP_FFMPEG_PATH");
  const command = ChildProcess.make(
    ffmpegPath,
    [
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
    {
      cwd: path.dirname(entry.sourcePath),
      stderr: "pipe",
      stdout: "pipe",
    }
  );
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* command;
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [collectText(handle.stdout), collectText(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" }
      );
      return { exitCode, stderr, stdout };
    })
  ).pipe(
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
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  yield* runFfmpegStripMetadata(entry, tempPath);
});

const stripMetadataToTemp = Effect.fn("Files.stripMetadataToTemp")(function* (
  entry: StripMetadataPlanEntry,
  tempPath: string
): Effect.fn.Return<
  void,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (entry.mediaKind === "image") {
    yield* stripImageMetadataToTemp(entry, tempPath);
    return;
  }

  yield* stripVideoMetadataToTemp(entry, tempPath);
});

const applyStripMetadataPlan = Effect.fn("Files.applyStripMetadataPlan")(function* (
  directory: string,
  plan: ReadonlyArray<StripMetadataPlanEntry>
): Effect.fn.Return<
  void,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* Effect.acquireUseRelease(
    fs
      .makeTempDirectory({ directory, prefix: ".beep-files-strip-metadata-" })
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to create temporary strip directory", directory, { cause })
        )
      ),
    Effect.fnUntraced(function* (tempDir) {
      const tempEntries = makeStripMetadataTempEntries(tempDir, plan, path);
      const rewriteConcurrency = A.some(plan, (entry) => entry.mediaKind === "video")
        ? FilesConcurrency.ffmpeg
        : FilesConcurrency.image;

      yield* runFilesProgressForEach(tempEntries, ({ entry, tempPath }) => stripMetadataToTemp(entry, tempPath), {
        concurrency: rewriteConcurrency,
        label: "strip rewrite",
      });

      yield* runFilesProgressForEach(
        tempEntries,
        ({ entry, tempPath }) => renameOrFail(tempPath, entry.sourcePath, tempDir),
        {
          concurrency: FilesConcurrency.scan,
          label: "strip replace",
        }
      );
    }),
    (tempDir) =>
      fs
        .remove(tempDir, {
          recursive: true,
          force: true,
        })
        .pipe(Effect.ignore)
  );
});

const applyCropBordersPlan = Effect.fn("Files.applyCropBordersPlan")(function* (
  directory: string,
  plan: ReadonlyArray<CropBordersPlanEntry>
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem | Path.Path | Terminal.Terminal> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* Effect.acquireUseRelease(
    fs
      .makeTempDirectory({ directory, prefix: ".beep-files-crop-borders-" })
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to create temporary crop-borders directory", directory, { cause })
        )
      ),
    Effect.fnUntraced(function* (tempDir) {
      const tempEntries = A.map(plan, (entry, index) => ({
        entry,
        tempPath: path.join(tempDir, `${formatIndex(index, `${A.length(plan)}`.length + 1)}-${entry.sourceName}`),
      }));

      yield* runFilesProgressForEach(tempEntries, ({ entry, tempPath }) => cropImageBordersToTemp(entry, tempPath), {
        concurrency: FilesConcurrency.image,
        label: "crop rewrite",
      });

      yield* runFilesProgressForEach(
        tempEntries,
        ({ entry, tempPath }) => renameOrFail(tempPath, entry.sourcePath, tempDir),
        {
          concurrency: FilesConcurrency.scan,
          label: "crop replace",
        }
      );
    }),
    (tempDir) =>
      fs
        .remove(tempDir, {
          recursive: true,
          force: true,
        })
        .pipe(Effect.ignore)
  );
});

const logStripMetadataPlan = Effect.fn("Files.logStripMetadataPlan")(function* (
  plan: ReadonlyArray<StripMetadataPlanEntry>
) {
  yield* Effect.forEach(plan, (entry) => Console.log(renderStripMetadataPlanEntry(entry)), {
    discard: true,
  });
});

const logNormalizePlan = Effect.fn("Files.logNormalizePlan")(function* (plan: NormalizePlan) {
  yield* Effect.forEach(plan.entries, (entry) => Console.log(renderNormalizePlanEntry(entry)), {
    discard: true,
  });
  yield* Effect.forEach(plan.skipped, (entry) => Console.log(renderNormalizeSkippedEntry(entry)), {
    discard: true,
  });
});

const logCreateCaptionFilesPlan = Effect.fn("Files.logCreateCaptionFilesPlan")(function* (
  plan: CreateCaptionFilesPlan
) {
  yield* Effect.forEach(plan.entries, (entry) => Console.log(renderCreateCaptionFilesPlanEntry(entry)), {
    discard: true,
  });
  yield* Effect.forEach(plan.skipped, (entry) => Console.log(renderCreateCaptionFilesSkippedEntry(entry)), {
    discard: true,
  });
});

const logArchivePoorCandidatesPlan = Effect.fn("Files.logArchivePoorCandidatesPlan")(function* (
  plan: ArchivePoorCandidatesPlan
) {
  yield* Effect.forEach(plan.entries, (entry) => Console.log(renderArchivePoorCandidatesEntry(entry)), {
    discard: true,
  });
  yield* Effect.forEach(plan.skipped, (entry) => Console.log(renderArchivePoorCandidatesSkippedEntry(entry)), {
    discard: true,
  });
});

const logDetectBordersEntries = Effect.fn("Files.logDetectBordersEntries")(function* (
  entries: ReadonlyArray<DetectBordersEntry>
) {
  const borderedEntries = A.filter(entries, (entry) => entry.hasBorder);
  yield* Effect.forEach(borderedEntries, (entry) => Console.log(renderDetectBordersEntry(entry)), {
    discard: true,
  });
});

const logDetectFacesEntries = Effect.fn("Files.logDetectFacesEntries")(function* (
  entries: ReadonlyArray<DetectFacesEntry>,
  skipped: ReadonlyArray<DetectFacesSkippedEntry>
) {
  yield* Effect.forEach(entries, (entry) => Console.log(renderDetectFacesEntry(entry)), {
    discard: true,
  });
  yield* Effect.forEach(skipped, (entry) => Console.log(renderDetectFacesSkippedEntry(entry)), {
    discard: true,
  });
});

const logCropBordersPlan = Effect.fn("Files.logCropBordersPlan")(function* (plan: ReadonlyArray<CropBordersPlanEntry>) {
  yield* Effect.forEach(plan, (entry) => Console.log(renderCropBordersPlanEntry(entry)), {
    discard: true,
  });
});

const processPathSeparators = Str.replace(/\\/gu, "/");
const processExtensionWithoutDot = flow(Str.replace(/^\./u, ""), Str.toLowerCase);
const processUtf8Encoder = new TextEncoder();
const processUtf8Decoder = new TextDecoder();
const processTextLikeFormats: ReadonlyArray<FileFormatFamily> = ["html", "markdown", "plain-text", "xhtml"];
const processCoverageFormats: ReadonlyArray<FileFormatFamily> = [
  "doc",
  "docm",
  "docx",
  "html",
  "image-metadata",
  "markdown",
  "pdf-text-layer",
  "plain-text",
  "pst",
  "rtf",
  "unknown",
  "xhtml",
  "xls",
  "xlsx",
];
const isProcessSelfOrNestedRelativePath = (relativePath: string): boolean =>
  Str.isEmpty(relativePath) ||
  (!Str.equivalence(relativePath, "..") && !Str.startsWith("../")(relativePath) && !Str.startsWith("/")(relativePath));

const decodeContentDigest = S.decodeUnknownEffect(ContentDigest);
const decodeArtifactId = S.decodeUnknownEffect(ArtifactId);
const decodeOperationId = S.decodeUnknownEffect(OperationId);
const decodeProcessPosixPath = S.decodeUnknownEffect(NativePathToPosixPath);
const processCount = (count: number): NonNegativeInt => NonNegativeInt.make(count);

const classifyProcessExtension = classifyFormatFromExtension;

const mediaTypeForProcessFormat = Match.type<FileFormatFamily>().pipe(
  Match.when("html", (): O.Option<MimeType> => O.some("text/html")),
  Match.when("xhtml", (): O.Option<MimeType> => O.some("application/xhtml+xml")),
  Match.when("markdown", (): O.Option<MimeType> => O.some("text/markdown")),
  Match.when("plain-text", (): O.Option<MimeType> => O.some("text/plain")),
  Match.when("rtf", (): O.Option<MimeType> => O.some("application/rtf")),
  Match.when("pdf-text-layer", (): O.Option<MimeType> => O.some("application/pdf")),
  Match.orElse(O.none<MimeType>)
);

const processOperationErrorStatus = (error: FileProcessingOperationError): SourceProcessingRecord["status"] =>
  error.reason === "engine-unavailable" ||
  error.reason === "unsupported-file-format" ||
  error.reason === "output-limit-exceeded"
    ? "skipped"
    : "failed";

const processOperationErrorSkipReason = (error: FileProcessingOperationError): O.Option<FileProcessingSkipReason> =>
  Match.value(error.reason).pipe(
    Match.when("engine-unavailable", () => O.some("engine-unavailable" as const)),
    Match.when("unsupported-file-format", () => O.some("unsupported-format" as const)),
    Match.when("output-limit-exceeded", () => O.some("output-budget-exceeded" as const)),
    Match.orElse(O.none<FileProcessingSkipReason>)
  );

const processEngineFor = (
  engine: ProcessFilesOptions["engine"],
  format: FileFormatFamily
): FileProcessingEngineShape => {
  if (engine === "test") {
    return TestFileProcessingEngine;
  }
  if (engine === "libpff") {
    return makeLibpffFileProcessingEngine();
  }
  if (engine === "tika") {
    return makeTikaFileProcessingEngine();
  }

  return format === "pst" ? makeLibpffFileProcessingEngine() : makeTikaFileProcessingEngine();
};

const syntheticLibpffEngine = (): FileProcessingEngineShape =>
  makeLibpffFileProcessingEngine({ syntheticExport: true });

const processEngineSupportsChildExport = (engine: FileProcessingEngineShape, format: FileFormatFamily): boolean =>
  A.contains(engine.descriptor.capabilities, "export-children") &&
  A.contains(engine.descriptor.supportedFormats, format);

const processHashBytes = Effect.fn("Files.processHashBytes")(function* (
  bytes: Uint8Array,
  label: string
): Effect.fn.Return<string, FilesCommandError, Crypto.Crypto> {
  return yield* S.decodeUnknownEffect(Sha256HexFromBytes)(bytes).pipe(
    FilesCommandError.mapError(`Failed to compute SHA-256 for ${label}`)
  );
});

const makeContentDigest = Effect.fn("Files.makeContentDigest")(function* (
  bytes: Uint8Array,
  label: string
): Effect.fn.Return<ContentDigest, FilesCommandError, Crypto.Crypto> {
  const hex = yield* processHashBytes(bytes, label);
  return yield* decodeContentDigest(`sha256:${hex}`).pipe(
    FilesCommandError.mapError(`Failed to decode content digest for ${label}`)
  );
});

const makeArtifactId = Effect.fn("Files.makeArtifactId")(function* (
  digest: ContentDigest,
  label: string
): Effect.fn.Return<ArtifactId, FilesCommandError> {
  const hex = Str.slice("sha256:".length)(digest);
  return yield* decodeArtifactId(`artifact:${hex}`).pipe(
    FilesCommandError.mapError(`Failed to decode artifact id for ${label}`)
  );
});

const makeOperationIdFromText = Effect.fn("Files.makeOperationIdFromText")(function* (
  text: string,
  label: string
): Effect.fn.Return<OperationId, FilesCommandError, Crypto.Crypto> {
  const hex = yield* processHashBytes(processUtf8Encoder.encode(text), label);
  return yield* decodeOperationId(`operation:${hex}`).pipe(
    FilesCommandError.mapError(`Failed to decode operation id for ${label}`)
  );
});

const collectProcessDirectoryFiles = Effect.fn("Files.collectProcessDirectoryFiles")(function* (
  sourceRoot: string,
  canonicalSourceRoot: string,
  currentDirectory: string,
  visitedDirectories: HashSet.HashSet<string>
): Effect.fn.Return<ProcessDirectoryCollection, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs
    .readDirectory(currentDirectory)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to read process input directory", currentDirectory, { cause })
      )
    );
  let files: ReadonlyArray<ProcessCollectedFile> = A.empty();
  let visited = visitedDirectories;

  for (const entry of A.sort(entries, Order.String)) {
    const sourcePath = path.join(currentDirectory, entry);
    const canonicalPath = yield* fs.realPath(sourcePath).pipe(Effect.option);

    if (O.isNone(canonicalPath)) {
      continue;
    }

    const canonicalRelativePath = pipe(path.relative(canonicalSourceRoot, canonicalPath.value), processPathSeparators);
    if (Str.startsWith("../")(canonicalRelativePath) || Str.startsWith("/")(canonicalRelativePath)) {
      continue;
    }

    const stat = yield* fs
      .stat(canonicalPath.value)
      .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat process input", sourcePath, { cause })));

    if (stat.type === "Directory") {
      if (HashSet.has(visited, canonicalPath.value)) {
        continue;
      }

      visited = HashSet.add(visited, canonicalPath.value);
      const childCollection = yield* collectProcessDirectoryFiles(sourceRoot, canonicalSourceRoot, sourcePath, visited);
      files = A.appendAll(files, childCollection.files);
      visited = childCollection.visitedDirectories;
      continue;
    }

    if (stat.type !== "File") {
      continue;
    }

    const relativePath = pipe(path.relative(sourceRoot, sourcePath), processPathSeparators);
    const extension = pipe(path.extname(entry), processExtensionWithoutDot);
    files = A.append(files, {
      canonicalPath: canonicalPath.value,
      extension,
      name: entry,
      relativePath,
      sizeBytes: processCount(Number(stat.size)),
      sourcePath,
    });
  }

  return {
    files: A.sort(
      files,
      Order.mapInput(Order.String, (file: ProcessCollectedFile) => file.relativePath)
    ),
    visitedDirectories: visited,
  };
});

const collectProcessInputFiles = Effect.fn("Files.collectProcessInputFiles")(function* (
  input: string
): Effect.fn.Return<ProcessInputCollection, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourcePath = path.resolve(input);
  const stat = yield* fs
    .stat(sourcePath)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat process input", sourcePath, { cause })));

  if (stat.type === "File") {
    const sourceRoot = path.dirname(sourcePath);
    const canonicalPath = yield* fs
      .realPath(sourcePath)
      .pipe(Effect.mapError((cause) => formatPlatformError("Failed to resolve process input", sourcePath, { cause })));
    const canonicalSourceRoot = path.dirname(canonicalPath);
    const name = path.basename(sourcePath);

    return {
      canonicalSourceRoot,
      files: [
        {
          canonicalPath,
          extension: pipe(path.extname(name), processExtensionWithoutDot),
          name,
          relativePath: name,
          sizeBytes: processCount(Number(stat.size)),
          sourcePath,
        },
      ],
      sourceRoot,
    };
  }

  if (stat.type !== "Directory") {
    return yield* FilesCommandError.make({
      message: `Expected --input to be a file or directory: "${sourcePath}"`,
    });
  }

  const canonicalSourceRoot = yield* fs
    .realPath(sourcePath)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to resolve process input directory", sourcePath, { cause })
      )
    );
  const collection = yield* collectProcessDirectoryFiles(
    sourcePath,
    canonicalSourceRoot,
    sourcePath,
    HashSet.add(HashSet.empty<string>(), canonicalSourceRoot)
  );

  return {
    canonicalSourceRoot,
    files: collection.files,
    sourceRoot: sourcePath,
  };
});

const canonicalizeProcessTargetPath = Effect.fn("Files.canonicalizeProcessTargetPath")(function* (
  targetPath: string
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(targetPath);
  const canonicalPath = yield* fs.realPath(absolutePath).pipe(Effect.option);

  if (O.isSome(canonicalPath)) {
    return canonicalPath.value;
  }

  const parentPath = path.dirname(absolutePath);
  if (Str.equivalence(parentPath, absolutePath)) {
    return yield* fs
      .realPath(absolutePath)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to resolve process output path", absolutePath, { cause })
        )
      );
  }

  const canonicalParentPath = yield* canonicalizeProcessTargetPath(parentPath);
  return path.join(canonicalParentPath, path.basename(absolutePath));
});

const prepareProcessOutDir = Effect.fn("Files.prepareProcessOutDir")(function* (
  outDir: string,
  canonicalSourceRoot: string,
  overwrite: boolean
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const outputDirectory = path.resolve(outDir);
  const canonicalOutputDirectory = yield* canonicalizeProcessTargetPath(outputDirectory);
  const outputRelativeToSource = pipe(
    path.relative(canonicalSourceRoot, canonicalOutputDirectory),
    processPathSeparators
  );
  const sourceRelativeToOutput = pipe(
    path.relative(canonicalOutputDirectory, canonicalSourceRoot),
    processPathSeparators
  );

  if (
    isProcessSelfOrNestedRelativePath(outputRelativeToSource) ||
    isProcessSelfOrNestedRelativePath(sourceRelativeToOutput)
  ) {
    return yield* FilesCommandError.make({
      message: `Refusing to write files process output in an overlapping source/output tree: "${outputDirectory}"`,
    });
  }

  const outputStat = yield* fs.stat(outputDirectory).pipe(Effect.option);
  const outputExists = O.isSome(outputStat);
  if (outputExists && outputStat.value.type !== "Directory") {
    return yield* FilesCommandError.make({
      message: `Refusing to write files process output to a non-directory path: "${outputDirectory}"`,
    });
  }
  if (outputExists && overwrite) {
    yield* fs
      .remove(outputDirectory, { force: true, recursive: true })
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to remove existing process output", outputDirectory, { cause })
        )
      );
  }
  if (outputExists && !overwrite) {
    const entries = yield* fs
      .readDirectory(outputDirectory)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to inspect existing process output", outputDirectory, { cause })
        )
      );
    if (A.length(entries) > 0) {
      return yield* FilesCommandError.make({
        message: `Refusing to write files process output to non-empty directory without --overwrite: "${outputDirectory}"`,
      });
    }
  }

  yield* fs
    .makeDirectory(path.join(outputDirectory, "text"), { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create process text directory", outputDirectory, { cause })
      )
    );
  yield* fs
    .makeDirectory(path.join(outputDirectory, "children"), { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create process children directory", outputDirectory, { cause })
      )
    );

  return outputDirectory;
});

const prepareProcessSource = Effect.fn("Files.prepareProcessSource")(function* (
  sourceFile: ProcessCollectedFile,
  engine: ProcessFilesOptions["engine"]
): Effect.fn.Return<ProcessPreparedSource, FilesCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs
    .readFile(sourceFile.sourcePath)
    .pipe(
      Effect.mapError((cause) => formatPlatformError("Failed to read process source", sourceFile.sourcePath, { cause }))
    );
  const digest = yield* makeContentDigest(bytes, sourceFile.relativePath);
  const artifactId = yield* makeArtifactId(digest, sourceFile.relativePath);
  const operationId = yield* makeOperationIdFromText(
    `${sourceFile.relativePath}:${digest}:${engine}`,
    `operation ${sourceFile.relativePath}`
  );
  const locatorPath = yield* decodeProcessPosixPath(sourceFile.sourcePath).pipe(
    FilesCommandError.mapError(`Failed to normalize process source locator path for ${sourceFile.relativePath}`)
  );
  const relativePath = yield* decodeProcessPosixPath(sourceFile.relativePath).pipe(
    FilesCommandError.mapError(`Failed to normalize process source relative path for ${sourceFile.relativePath}`)
  );
  const format = classifyProcessExtension(sourceFile.extension);
  const mediaType = mediaTypeForProcessFormat(format);
  const sourceText = A.contains(processTextLikeFormats, format)
    ? O.some(processUtf8Decoder.decode(bytes))
    : O.none<string>();

  return {
    bytes,
    digest,
    format,
    operationId,
    source: SourceArtifact.make({
      bytes,
      digest,
      extension: sourceFile.extension,
      id: artifactId,
      locator: ArtifactLocator.make({ kind: "file", value: locatorPath }),
      name: sourceFile.name,
      relativePath,
      sizeBytes: sourceFile.sizeBytes,
      ...O.getSomesStruct({ mediaType, text: sourceText }),
    }),
    sourceFile,
  };
});

const makeProcessSourceRecord = (
  prepared: ProcessPreparedSource,
  status: SourceProcessingRecord["status"],
  options: {
    readonly engine?: string;
    readonly skipReason?: FileProcessingSkipReason;
    readonly textPath?: PosixPath;
  } = {}
): SourceProcessingRecord => {
  const base = {
    artifactId: prepared.source.id,
    digest: prepared.digest,
    format: prepared.format,
    operationId: prepared.operationId,
    relativePath: prepared.source.relativePath,
    sizeBytes: prepared.sourceFile.sizeBytes,
    ...O.getSomesStruct({
      engine: O.fromUndefinedOr(options.engine),
    }),
  };

  if (status === "succeeded") {
    return SucceededSourceProcessingRecord.make({
      ...base,
      status,
      ...O.getSomesStruct({
        textPath: O.fromUndefinedOr(options.textPath),
      }),
    });
  }

  if (status === "skipped") {
    return SkippedSourceProcessingRecord.make({
      ...base,
      skipReason: options.skipReason ?? "unsupported-format",
      status,
    });
  }

  return FailedSourceProcessingRecord.make({
    ...base,
    status,
  });
};

const makeProcessSkippedFailureRecord = (
  prepared: ProcessPreparedSource,
  message: string,
  reason: FileProcessingSkipReason,
  options: {
    readonly engine?: string;
    readonly format?: FileFormatFamily;
  } = {}
): FileProcessingFailureRecord =>
  SkippedFileProcessingFailureRecord.make({
    artifactId: prepared.source.id,
    message,
    operationId: prepared.operationId,
    reason,
    relativePath: prepared.source.relativePath,
    status: "skipped",
    ...O.getSomesStruct({
      engine: O.fromUndefinedOr(options.engine),
      format: O.fromUndefinedOr(options.format),
    }),
  });

const makeProcessFailedFailureRecord = (
  prepared: ProcessPreparedSource,
  message: string,
  reason: FileProcessingOperationError["reason"],
  options: {
    readonly engine?: string;
    readonly format?: FileFormatFamily;
  } = {}
): FileProcessingFailureRecord =>
  FailedFileProcessingFailureRecord.make({
    artifactId: prepared.source.id,
    message,
    operationId: prepared.operationId,
    reason,
    relativePath: prepared.source.relativePath,
    status: "failed",
    ...O.getSomesStruct({
      engine: O.fromUndefinedOr(options.engine),
      format: O.fromUndefinedOr(options.format),
    }),
  });

const makeProcessStrategy = (
  engine: FileProcessingEngineShape,
  prepared: ProcessPreparedSource,
  disposition: SelectedStrategy["disposition"],
  skipReason: O.Option<FileProcessingSkipReason>
): SelectedStrategy =>
  disposition === "supported"
    ? SupportedSelectedStrategy.make({
        disposition,
        engine: engine.descriptor.engine,
        format: prepared.format,
        operationKind: prepared.format === "pst" ? "export-archive" : "extract",
      })
    : disposition === "deferred"
      ? DeferredSelectedStrategy.make({
          disposition,
          engine: engine.descriptor.engine,
          format: prepared.format,
          operationKind: prepared.format === "pst" ? "export-archive" : "extract",
          skipReason: O.getOrElse(skipReason, () => "engine-unavailable"),
        })
      : UnsupportedSelectedStrategy.make({
          disposition,
          engine: engine.descriptor.engine,
          format: prepared.format,
          operationKind: prepared.format === "pst" ? "export-archive" : "extract",
          skipReason: O.getOrElse(skipReason, () => "unsupported-format"),
        });

const processFailureOutcome = (
  engine: FileProcessingEngineShape,
  prepared: ProcessPreparedSource,
  error: FileProcessingOperationError
): ProcessSourceOutcome => {
  const status = processOperationErrorStatus(error);
  const skipReason = processOperationErrorSkipReason(error);

  return {
    childRecords: A.empty(),
    failure: O.some(
      status === "skipped" && O.isSome(skipReason)
        ? makeProcessSkippedFailureRecord(prepared, error.message, skipReason.value, {
            engine: error.engine ?? engine.descriptor.name,
            format: error.format ?? prepared.format,
          })
        : makeProcessFailedFailureRecord(prepared, error.message, error.reason, {
            engine: error.engine ?? engine.descriptor.name,
            format: error.format ?? prepared.format,
          })
    ),
    sourceRecord: makeProcessSourceRecord(prepared, status, {
      engine: error.engine ?? engine.descriptor.name,
      ...O.getSomesStruct({ skipReason }),
    }),
    strategy: makeProcessStrategy(engine, prepared, O.isNone(skipReason) ? "supported" : "deferred", skipReason),
    text: O.none<readonly [string, string]>(),
  };
};

const processSkippedOutcome = (
  engine: FileProcessingEngineShape,
  prepared: ProcessPreparedSource,
  message: string,
  reason: FileProcessingSkipReason
): ProcessSourceOutcome => ({
  childRecords: A.empty(),
  failure: O.some(
    makeProcessSkippedFailureRecord(prepared, message, reason, {
      engine: engine.descriptor.name,
      format: prepared.format,
    })
  ),
  sourceRecord: makeProcessSourceRecord(prepared, "skipped", {
    engine: engine.descriptor.name,
    skipReason: reason,
  }),
  strategy: makeProcessStrategy(engine, prepared, "deferred", O.some(reason)),
  text: O.none<readonly [string, string]>(),
});

const processExtractionSuccessOutcome = (
  engine: FileProcessingEngineShape,
  prepared: ProcessPreparedSource,
  text: O.Option<string>
): ProcessSourceOutcome => {
  const textRelativePath = O.map(text, () => normalizePath(`text/${prepared.operationId}.txt`));

  return {
    childRecords: A.empty(),
    failure: O.none<FileProcessingFailureRecord>(),
    sourceRecord: makeProcessSourceRecord(prepared, "succeeded", {
      engine: engine.descriptor.name,
      ...O.getSomesStruct({ textPath: textRelativePath }),
    }),
    strategy: makeProcessStrategy(engine, prepared, "supported", O.none<FileProcessingSkipReason>()),
    text:
      O.isNone(text) || O.isNone(textRelativePath) ? O.none() : O.some([textRelativePath.value, text.value] as const),
  };
};

const processArchiveSuccessOutcome = (
  engine: FileProcessingEngineShape,
  prepared: ProcessPreparedSource,
  children: ReadonlyArray<ChildArtifactRecord>
): ProcessSourceOutcome => ({
  childRecords: children,
  failure: O.none<FileProcessingFailureRecord>(),
  sourceRecord: makeProcessSourceRecord(prepared, "succeeded", {
    engine: engine.descriptor.name,
  }),
  strategy: makeProcessStrategy(engine, prepared, "supported", O.none<FileProcessingSkipReason>()),
  text: O.none<readonly [string, string]>(),
});

const makeZeroProcessStatusCounts = (): Record<SourceProcessingStatus, number> => ({
  failed: 0,
  skipped: 0,
  succeeded: 0,
});

const makeZeroProcessCoverageByFormat = (): Record<FileFormatFamily, Record<SourceProcessingStatus, number>> =>
  R.fromEntries(A.map(processCoverageFormats, (format) => [format, makeZeroProcessStatusCounts()] as const));

const makeProcessCoverageByFormat = (
  byFormat: Record<FileFormatFamily, Record<SourceProcessingStatus, number>>
): FileProcessingCoverageSummary["byFormat"] =>
  R.fromEntries(
    A.map(processCoverageFormats, (format) => {
      const counts = byFormat[format];
      return [
        format,
        {
          failed: processCount(counts.failed),
          skipped: processCount(counts.skipped),
          succeeded: processCount(counts.succeeded),
        },
      ] as const;
    })
  ) as FileProcessingCoverageSummary["byFormat"];

const sourceRecordHasTextPath = (record: SourceProcessingRecord): boolean =>
  record.status === "succeeded" && record.textPath !== undefined;

const processPreparedSource = Effect.fn("Files.processPreparedSource")(function* (
  prepared: ProcessPreparedSource,
  options: ProcessFilesOptions
): Effect.fn.Return<ProcessSourceOutcome, never, Crypto.Crypto> {
  const engine =
    options.engine === "test" && prepared.format === "pst"
      ? syntheticLibpffEngine()
      : processEngineFor(options.engine, prepared.format);

  if (prepared.format === "docm" || prepared.format === "xls" || prepared.format === "xlsx") {
    return processSkippedOutcome(
      engine,
      prepared,
      `${prepared.format} was classified deterministically; deep extraction is out of scope for V1.`,
      "format-out-of-scope"
    );
  }

  if (prepared.format === "unknown") {
    return processSkippedOutcome(
      engine,
      prepared,
      "Source format is not supported by the V1 proof.",
      "unsupported-format"
    );
  }

  if (prepared.format === "pst") {
    if (!options.exportChildren) {
      return processSkippedOutcome(engine, prepared, "PST child export was not requested.", "operation-not-required");
    }

    if (!processEngineSupportsChildExport(engine, prepared.format)) {
      return processSkippedOutcome(
        engine,
        prepared,
        `${engine.descriptor.name} does not support PST child export in the P1 proof.`,
        "engine-unavailable"
      );
    }

    return yield* engine
      .exportArchive({
        format: prepared.format,
        operationId: prepared.operationId,
        operationKind: "export-archive",
        preference: { engine: options.engine },
        source: prepared.source,
        ...O.getSomesStruct({
          maxMaterializedBytes: O.fromUndefinedOr(options.maxMaterializedBytes),
        }),
      })
      .pipe(
        Effect.matchEffect({
          onFailure: (error) => Effect.succeed(processFailureOutcome(engine, prepared, error)),
          onSuccess: (result) =>
            Effect.succeed(
              processArchiveSuccessOutcome(
                engine,
                prepared,
                A.map(result.children, (child) =>
                  ChildArtifactRecord.make({
                    child,
                    sourceArtifactId: prepared.source.id,
                  })
                )
              )
            ),
        })
      );
  }

  return yield* engine
    .extract({
      format: prepared.format,
      operationId: prepared.operationId,
      operationKind: "extract",
      preference: { engine: options.engine },
      source: prepared.source,
      ...O.getSomesStruct({
        maxMaterializedBytes: O.fromUndefinedOr(options.maxMaterializedBytes),
      }),
    })
    .pipe(
      Effect.matchEffect({
        onFailure: (error) => Effect.succeed(processFailureOutcome(engine, prepared, error)),
        onSuccess: (result) => {
          if (
            options.maxMaterializedBytes !== undefined &&
            result.text !== undefined &&
            processUtf8Encoder.encode(result.text).length > options.maxMaterializedBytes
          ) {
            return Effect.succeed(
              processFailureOutcome(
                engine,
                prepared,
                FileProcessingOperationError.fromReason("output-limit-exceeded", {
                  artifactId: prepared.source.id,
                  engine: engine.descriptor.name,
                  format: prepared.format,
                  message: "Extracted text exceeded --max-materialized-bytes.",
                  operationId: prepared.operationId,
                })
              )
            );
          }

          return Effect.succeed(processExtractionSuccessOutcome(engine, prepared, O.fromUndefinedOr(result.text)));
        },
      })
    );
});

const makeProcessCoverage = (records: ReadonlyArray<SourceProcessingRecord>): FileProcessingCoverageSummary => {
  const byFormat = makeZeroProcessCoverageByFormat();

  for (const record of records) {
    const formatCounts = byFormat[record.format];
    formatCounts[record.status] = (formatCounts[record.status] ?? 0) + 1;
    byFormat[record.format] = formatCounts;
  }

  return FileProcessingCoverageSummary.make({
    byFormat: makeProcessCoverageByFormat(byFormat),
    failedCount: processCount(A.length(A.filter(records, (record) => record.status === "failed"))),
    skippedCount: processCount(A.length(A.filter(records, (record) => record.status === "skipped"))),
    sourceCount: processCount(A.length(records)),
    succeededCount: processCount(A.length(A.filter(records, (record) => record.status === "succeeded"))),
    textArtifactCount: processCount(A.length(A.filter(records, sourceRecordHasTextPath))),
  });
};

const encodeProcessJsonLine = <AValue>(
  value: AValue,
  encode: (value: AValue) => Effect.Effect<string, S.SchemaError>,
  label: string
): Effect.Effect<string, FilesCommandError> =>
  encode(value).pipe(
    FilesCommandError.mapError(`Failed to encode ${label}`),
    Effect.map((line) => `${line}\n`)
  );

const writeProcessStringFile = Effect.fn("Files.writeProcessStringFile")(function* (
  outputPath: string,
  content: string
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs
    .makeDirectory(path.dirname(outputPath), { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create process output directory", outputPath, { cause })
      )
    );
  yield* fs
    .writeFileString(outputPath, content)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to write process output", outputPath, { cause })));
});

const writeProcessManifestTree = Effect.fn("Files.writeProcessManifestTree")(function* (
  outputDirectory: string,
  options: ProcessFilesOptions,
  outcomes: ReadonlyArray<ProcessSourceOutcome>,
  coverage: FileProcessingCoverageSummary
): Effect.fn.Return<
  void,
  FilesCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const { failureRecords, sourceRecords } = collectSourceOutcomeRecords(outcomes);
  const runId = yield* makeOperationIdFromText(
    `${options.engine}:${A.join("|")(A.map(sourceRecords, (record) => `${record.relativePath}:${record.operationId}`))}`,
    "process run"
  );
  const runManifest = ProcessRunManifest.make({
    coverage,
    engine: options.engine,
    manifestVersion: "beep.file-processing.run.v1",
    outputRoot: ".",
    runId,
    sourceRootLabel: "input",
    strategies: A.map(outcomes, (outcome) => outcome.strategy),
  });
  const sourceLines = yield* Effect.forEach(sourceRecords, (record) =>
    encodeProcessJsonLine(record, encodeSourceProcessingRecordJson, "process source record")
  );
  const failureLines = yield* Effect.forEach(failureRecords, (record) =>
    encodeProcessJsonLine(record, encodeFileProcessingFailureRecordJson, "process failure record")
  );
  const coverageJson = yield* encodeFileProcessingCoverageSummaryJson(coverage).pipe(
    FilesCommandError.mapError("Failed to encode process coverage")
  );
  const runJson = yield* encodeProcessRunManifestJson(runManifest).pipe(
    FilesCommandError.mapError("Failed to encode process run manifest")
  );

  yield* writeProcessStringFile(path.join(outputDirectory, "run.json"), `${runJson}\n`);
  yield* writeProcessStringFile(path.join(outputDirectory, "coverage.json"), `${coverageJson}\n`);
  yield* writeProcessStringFile(path.join(outputDirectory, "sources.jsonl"), A.join("")(sourceLines));
  yield* writeProcessStringFile(path.join(outputDirectory, "failures.jsonl"), A.join("")(failureLines));

  for (const outcome of outcomes) {
    if (O.isSome(outcome.text)) {
      yield* writeProcessStringFile(path.join(outputDirectory, outcome.text.value[0]), outcome.text.value[1]);
    }

    if (A.length(outcome.childRecords) > 0) {
      const childLines = yield* Effect.forEach(outcome.childRecords, (record) =>
        encodeProcessJsonLine(record, encodeChildArtifactRecordJson, "process child artifact record")
      );
      yield* writeProcessStringFile(
        path.join(outputDirectory, "children", `${outcome.sourceRecord.artifactId}`, "artifacts.jsonl"),
        A.join("")(childLines)
      );
    }
  }
});

const processFilesImpl = Effect.fn("FilesCommandService.processFiles")(function* (
  options: ProcessFilesOptions
): Effect.fn.Return<ProcessFilesSummary, FilesCommandError, FilesCommandServiceRequirements> {
  const collection = yield* collectProcessInputFiles(options.input);
  const outputDirectory = yield* prepareProcessOutDir(
    options.outDir,
    collection.canonicalSourceRoot,
    options.overwrite
  );
  const outcomes = yield* Effect.forEach(
    collection.files,
    (sourceFile) =>
      prepareProcessSource(sourceFile, options.engine).pipe(
        Effect.flatMap((prepared) => processPreparedSource(prepared, options))
      ),
    {
      concurrency: FilesConcurrency.scan,
    }
  );
  const { sourceRecords } = collectSourceOutcomeRecords(outcomes);
  const coverage = makeProcessCoverage(sourceRecords);
  const summary = ProcessFilesSummary.make({
    failedCount: coverage.failedCount,
    skippedCount: coverage.skippedCount,
    sourceCount: coverage.sourceCount,
    succeededCount: coverage.succeededCount,
    textArtifactCount: coverage.textArtifactCount,
  });

  yield* writeProcessManifestTree(outputDirectory, options, outcomes, coverage);
  yield* Console.log(
    `files process: ${summary.succeededCount} succeeded, ${summary.skippedCount} skipped, ${summary.failedCount} failed; wrote "${outputDirectory}".`
  );

  if (options.failurePolicy === "fail-on-error" && summary.failedCount > 0) {
    return yield* FilesCommandError.make({
      message: `files process: ${summary.failedCount} source file(s) failed. See "${outputDirectory}" for manifest details.`,
    });
  }

  return summary;
});

/**
 * Print the files command index.
 *
 * @example
 * ```ts
 * import { printFilesIndex } from "@beep/repo-cli/commands/Files"
 * console.log(printFilesIndex)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const printFilesIndex = printLines([
  "Files commands:",
  "- bun run files sort-and-rename --prefix image --dir ./tmp",
  "- bun run files sort-and-rename --prefix image --dir ./tmp --with-dimensions",
  "- bun run files strip-metadata --dir ./tmp",
  "- bun run files normalize --dir ./raw --out-dir ./dataset/images --format png",
  "- bun run files normalize --dir ./raw --out-dir ./dataset/images --format png --dedupe",
  "- bun run files process --input ./sources --out-dir ./file-processing-proof",
  "- bun run files create-captions --dir ./dataset/images",
  "- bun run files archive-poor-candidates --dir ./dataset/images --archive-dir ./dataset/rejected",
  "- bun run files detect-borders --dir ./tmp",
  "- bun run files detect-faces --dir ./dataset/images --model ./face_detection_yunet.onnx",
  "- bun run files crop-borders --dir ./tmp --dry-run",
]);

const createCaptionFilesImpl = Effect.fn("FilesCommandService.createCaptionFiles")(function* (
  options: CreateCaptionFilesOptions
): Effect.fn.Return<CreateCaptionFilesSummary, FilesCommandError, FilesCommandServiceRequirements> {
  const program = Effect.gen(function* () {
    const validatedOptions = yield* validateCreateCaptionFilesOptions(options);
    const plan = yield* buildCreateCaptionFilesPlan(validatedOptions);
    const plannedCount = A.length(plan.entries);
    const skippedCount = A.length(plan.skipped);
    const plannedOverwriteCount = A.length(A.filter(plan.entries, (entry) => entry.overwritesExisting));
    const plannedCreateCount = plannedCount - plannedOverwriteCount;

    yield* Console.log(
      `files create-captions: ${plannedCount} caption sidecar file(s) planned in "${plan.directory}".`
    );
    if (hasSkippedFiles(skippedCount)) {
      yield* Console.log(`files create-captions: skipped ${skippedCount} source entry(s).`);
    }
    yield* logCreateCaptionFilesPlan(plan);
    yield* Effect.logInfo({
      message: "files create-captions planned",
      plannedCount,
      plannedCreateCount,
      plannedOverwriteCount,
      skippedCount,
      directory: plan.directory,
    });

    if (validatedOptions.dryRun) {
      yield* Console.log("files create-captions: dry run; no caption files written.");
      return CreateCaptionFilesSummary.make({
        createdCount: 0,
        directory: plan.directory,
        dryRun: true,
        overwrittenCount: 0,
        plannedCount,
        skippedCount,
      });
    }

    yield* applyCreateCaptionFilesPlan(plan);
    yield* Console.log(
      `files create-captions: created ${plannedCreateCount} caption sidecar file(s); overwritten ${plannedOverwriteCount} existing caption file(s).`
    );
    yield* Effect.logInfo({
      message: "files create-captions completed",
      createdCount: plannedCreateCount,
      overwrittenCount: plannedOverwriteCount,
      skippedCount,
      directory: plan.directory,
    });

    return CreateCaptionFilesSummary.make({
      createdCount: plannedCreateCount,
      directory: plan.directory,
      dryRun: false,
      overwrittenCount: plannedOverwriteCount,
      plannedCount,
      skippedCount,
    });
  });

  return yield* profilePhase(program, {
    phase: "files.create-captions",
    attributes: {
      dryRun: `${options.dryRun}`,
      overwrite: `${options.overwrite}`,
    },
  });
});

const archivePoorCandidatesImpl = Effect.fn("FilesCommandService.archivePoorCandidates")(function* (
  options: ArchivePoorCandidatesOptions
): Effect.fn.Return<ArchivePoorCandidatesSummary, FilesCommandError, FilesCommandServiceRequirements> {
  const program = Effect.gen(function* () {
    const validatedOptions = yield* validateArchivePoorCandidatesOptions(options);
    const sidecarExtensions = yield* parseSidecarExtensions(validatedOptions.sidecars);
    const plan = yield* buildArchivePoorCandidatesPlan(validatedOptions, sidecarExtensions);
    const archiveEntries = archivedEntries(plan.entries);
    const archivedCount = A.length(archiveEntries);
    const assessedCount = A.length(plan.entries);
    const keptCount = A.length(A.filter(plan.entries, (entry) => entry.decision === "keep"));
    const movedSidecarCount = countMovedSidecars(plan.entries);
    const skippedCount = A.length(plan.skipped);

    yield* Console.log(
      `files archive-poor-candidates: ${assessedCount} image candidate(s) assessed in "${plan.sourceDirectory}"; ${archivedCount} poor candidate(s) planned for "${plan.archiveDirectory}".`
    );
    if (hasSkippedFiles(skippedCount)) {
      yield* Console.log(
        `files archive-poor-candidates: skipped ${skippedCount} unsupported or non-image source entry(s).`
      );
    }
    yield* logArchivePoorCandidatesPlan(plan);
    yield* Effect.logInfo({
      message: "files archive-poor-candidates planned",
      archivedCount,
      assessedCount,
      keptCount,
      movedSidecarCount,
      skippedCount,
      archiveDirectory: plan.archiveDirectory,
      manifestPath: plan.manifestPath,
    });

    if (validatedOptions.dryRun) {
      yield* Console.log("files archive-poor-candidates: dry run; no files moved.");
      return ArchivePoorCandidatesSummary.make({
        archivedCount,
        archiveDirectory: plan.archiveDirectory,
        assessedCount,
        directory: plan.sourceDirectory,
        dryRun: true,
        keptCount,
        manifestPath: plan.manifestPath,
        manifestWritten: false,
        movedSidecarCount,
        skippedCount,
      });
    }

    yield* preflightArchivePoorCandidatesOutputs(plan, validatedOptions.overwrite);
    yield* applyArchivePoorCandidatesPlan(plan, validatedOptions.overwrite);
    yield* Console.log(
      `files archive-poor-candidates: archived ${archivedCount} image candidate(s) with ${movedSidecarCount} sidecar file(s); manifest written to "${plan.manifestPath}".`
    );
    yield* Effect.logInfo({
      message: "files archive-poor-candidates completed",
      archivedCount,
      assessedCount,
      keptCount,
      movedSidecarCount,
      skippedCount,
      archiveDirectory: plan.archiveDirectory,
      manifestPath: plan.manifestPath,
    });

    return ArchivePoorCandidatesSummary.make({
      archivedCount,
      archiveDirectory: plan.archiveDirectory,
      assessedCount,
      directory: plan.sourceDirectory,
      dryRun: false,
      keptCount,
      manifestPath: plan.manifestPath,
      manifestWritten: true,
      movedSidecarCount,
      skippedCount,
    });
  });

  return yield* profilePhase(program, {
    phase: "files.archive-poor-candidates",
    attributes: {
      dryRun: `${options.dryRun}`,
      maxAspect: `${options.maxAspect}`,
      maxUpscale: `${options.maxUpscale}`,
      minShortEdge: `${options.minShortEdge}`,
      profile: options.profile,
      targetResolution: `${options.targetResolution}`,
    },
  });
});

const cropBordersFilesImpl = Effect.fn("FilesCommandService.cropBordersFiles")(function* (
  options: CropBordersOptions
): Effect.fn.Return<CropBordersSummary, FilesCommandError, FilesCommandServiceRequirements> {
  const program = Effect.gen(function* () {
    const plan = yield* buildCropBordersPlan(options);
    const plannedCount = A.length(plan.entries);

    if (!A.isReadonlyArrayNonEmpty(plan.entries)) {
      yield* Console.log(
        `files crop-borders: 0 bordered image(s) planned in "${plan.directory}" (${plan.analyzedCount} analyzed, ${plan.skippedCount} skipped).`
      );
      return CropBordersSummary.make({
        analyzedCount: plan.analyzedCount,
        borderedCount: plan.borderedCount,
        croppedCount: 0,
        directory: plan.directory,
        dryRun: options.dryRun,
        plannedCount: 0,
        skippedCount: plan.skippedCount,
      });
    }

    yield* Console.log(
      `files crop-borders: ${plannedCount} bordered image(s) planned in "${plan.directory}" (${plan.analyzedCount} analyzed, ${plan.skippedCount} skipped).`
    );
    yield* logCropBordersPlan(plan.entries);
    yield* Effect.logInfo({
      message: "files crop-borders planned",
      plannedCount,
      analyzedCount: plan.analyzedCount,
      borderedCount: plan.borderedCount,
      skippedCount: plan.skippedCount,
      directory: plan.directory,
    });

    if (options.dryRun) {
      yield* Console.log("files crop-borders: dry run; no files rewritten.");
      return CropBordersSummary.make({
        analyzedCount: plan.analyzedCount,
        borderedCount: plan.borderedCount,
        croppedCount: 0,
        directory: plan.directory,
        dryRun: true,
        plannedCount,
        skippedCount: plan.skippedCount,
      });
    }

    yield* applyCropBordersPlan(plan.directory, plan.entries);
    yield* Console.log(`files crop-borders: cropped ${plannedCount} image file(s).`);
    yield* Effect.logInfo({
      message: "files crop-borders completed",
      croppedCount: plannedCount,
      skippedCount: plan.skippedCount,
      directory: plan.directory,
    });

    return CropBordersSummary.make({
      analyzedCount: plan.analyzedCount,
      borderedCount: plan.borderedCount,
      croppedCount: plannedCount,
      directory: plan.directory,
      dryRun: false,
      plannedCount,
      skippedCount: plan.skippedCount,
    });
  });

  return yield* profilePhase(program, {
    phase: "files.crop-borders",
    attributes: {
      dryRun: `${options.dryRun}`,
      tolerance: `${options.tolerance}`,
      minSolidPct: `${options.minSolidPct}`,
      minWidthPct: `${options.minWidthPct}`,
      maxScanPct: `${options.maxScanPct}`,
    },
  });
});

const detectBordersFilesImpl = Effect.fn("FilesCommandService.detectBordersFiles")(function* (
  options: DetectBordersOptions
): Effect.fn.Return<DetectBordersReport, FilesCommandError, FilesCommandServiceRequirements> {
  const program = Effect.gen(function* () {
    const validatedOptions = yield* validateDetectBordersOptions(options);
    const progressEnabled = !validatedOptions.json;
    const collection = yield* collectDetectBordersFiles(validatedOptions.dir, progressEnabled);
    const analysisResults = yield* runFilesProgressForEach(
      collection.files,
      (file) => analyzeDetectBordersFile(file, validatedOptions).pipe(Effect.result),
      {
        concurrency: FilesConcurrency.image,
        enabled: progressEnabled,
        label: "detect analyze",
      }
    );
    let entries = A.empty<DetectBordersEntry>();
    let skipped = collection.skipped;

    for (const [file, result] of A.zip(collection.files, analysisResults)) {
      if (Result.isFailure(result)) {
        skipped = A.append(
          skipped,
          makeDetectBordersSkippedEntry(
            file.name,
            file.sourcePath,
            O.some(file.extension),
            "unreadable-image",
            result.failure.message
          )
        );
        continue;
      }

      entries = A.append(entries, result.success);
    }

    const borderedCount = A.length(A.filter(entries, (entry) => entry.hasBorder));
    const skippedCount = A.length(skipped);
    const summary = DetectBordersSummary.make({
      analyzedCount: A.length(entries),
      borderedCount,
      directory: collection.directory,
      skippedCount,
      totalCount: A.length(entries) + skippedCount,
    });
    const report = DetectBordersReport.make({
      directory: collection.directory,
      entries,
      options: validatedOptions,
      schemaVersion: "beep.files.detect-borders.v1",
      skipped: A.sort(
        skipped,
        Order.mapInput(Order.String, (entry: DetectBordersSkippedEntry) => entry.sourceName)
      ),
      summary,
    });

    if (validatedOptions.json) {
      const rendered = yield* renderDetectBordersReportJson(report);
      yield* Console.log(Str.trimEnd(rendered));
      return report;
    }

    yield* Effect.logInfo({
      message: "files detect-borders completed",
      analyzedCount: summary.analyzedCount,
      borderedCount: summary.borderedCount,
      skippedCount: summary.skippedCount,
      directory: collection.directory,
    });

    yield* Console.log(
      `files detect-borders: ${summary.borderedCount} bordered image(s) found in "${collection.directory}" (${summary.analyzedCount} analyzed, ${summary.skippedCount} skipped).`
    );
    yield* logDetectBordersEntries(entries);

    return report;
  });

  if (options.json) {
    return yield* program;
  }

  return yield* profilePhase(program, {
    phase: "files.detect-borders",
    attributes: {
      json: `${options.json}`,
      tolerance: `${options.tolerance}`,
      minSolidPct: `${options.minSolidPct}`,
      minWidthPct: `${options.minWidthPct}`,
      maxScanPct: `${options.maxScanPct}`,
    },
  });
});

const detectFacesFilesImpl = Effect.fn("FilesCommandService.detectFacesFiles")(function* (
  options: DetectFacesOptions
): Effect.fn.Return<
  DetectFacesReport,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal | ChildProcessSpawner.ChildProcessSpawner
> {
  const program = Effect.gen(function* () {
    const path = yield* Path.Path;
    const validatedOptions = yield* validateDetectFacesOptions(options);
    const progressEnabled = !validatedOptions.json;
    const collection = yield* collectDetectFacesFiles(validatedOptions.dir, progressEnabled);
    const moveNoFaceDirectory = yield* validateDetectFacesMoveNoFaceDirectory(
      validatedOptions.moveNoFaceTo,
      collection.directory
    );
    const manifestPath = path.resolve(
      O.getOrElse(validatedOptions.manifest, () => path.join(collection.directory, "detect-faces-manifest.json"))
    );
    let entries: ReadonlyArray<DetectFacesEntry> = A.empty();
    let skipped = collection.skipped;

    if (A.isReadonlyArrayNonEmpty(collection.files)) {
      yield* withDetector(
        FaceDetectionModelConfig.make({ modelPath: validatedOptions.modelPath }),
        Effect.fnUntraced(function* (detector) {
          const analysisResults = yield* runFilesProgressForEach(
            collection.files,
            (file) => analyzeDetectFacesFile(detector, file, validatedOptions).pipe(Effect.result),
            {
              concurrency: FilesConcurrency.image,
              enabled: progressEnabled,
              label: "faces analyze",
            }
          );

          for (const [file, result] of A.zip(collection.files, analysisResults)) {
            if (Result.isFailure(result)) {
              skipped = A.append(
                skipped,
                makeDetectFacesSkippedEntry(
                  file.name,
                  file.sourcePath,
                  O.some(file.extension),
                  "detection-failed",
                  result.failure.message
                )
              );
              continue;
            }

            entries = A.append(entries, result.success);
          }
        })
      ).pipe(
        Effect.provideService(FaceDetectionService, makeFaceDetectionService()),
        Effect.mapError((cause) =>
          FilesCommandError.make({
            message: cause.message,
            cause,
          })
        )
      );
    }

    entries = yield* moveDetectFacesNoFaceEntries(entries, moveNoFaceDirectory, progressEnabled);

    const faceImageCount = A.length(A.filter(entries, (entry) => entry.hasFace));
    const noFaceImageCount = A.length(A.filter(entries, (entry) => !entry.hasFace));
    const movedNoFaceCount = A.length(A.filter(entries, (entry) => O.isSome(O.fromUndefinedOr(entry.movedNoFacePath))));
    const reviewImageCount = A.length(A.filter(entries, (entry) => A.some(entry.flags, (flag) => flag !== "has-face")));
    const skippedCount = A.length(skipped);
    const summary = DetectFacesSummary.make({
      analyzedCount: A.length(entries),
      directory: collection.directory,
      faceImageCount,
      movedNoFaceCount,
      noFaceImageCount,
      reviewImageCount,
      skippedCount,
      totalCount: A.length(entries) + skippedCount,
    });
    const sortedSkipped = A.sort(
      skipped,
      Order.mapInput(Order.String, (entry: DetectFacesSkippedEntry) => entry.sourceName)
    );
    const report = DetectFacesReport.make({
      directory: collection.directory,
      entries,
      manifestPath,
      manifestWritten: true,
      options: makeDetectFacesReportOptions(validatedOptions, moveNoFaceDirectory),
      schemaVersion: "beep.files.detect-faces.v1",
      skipped: sortedSkipped,
      summary,
    });
    yield* writeDetectFacesManifest(report);

    if (validatedOptions.json) {
      const rendered = yield* renderDetectFacesReportJson(report, "detect-faces-report.json");
      yield* Console.log(Str.trimEnd(rendered));
      return report;
    }

    yield* Effect.logInfo({
      message: "files detect-faces completed",
      analyzedCount: summary.analyzedCount,
      faceImageCount: summary.faceImageCount,
      movedNoFaceCount: summary.movedNoFaceCount,
      skippedCount: summary.skippedCount,
      directory: collection.directory,
    });

    const movedText = summary.movedNoFaceCount > 0 ? `, moved ${summary.movedNoFaceCount} no-face image(s)` : "";

    yield* Console.log(
      `files detect-faces: ${summary.faceImageCount} image(s) with face(s), ${summary.noFaceImageCount} image(s) without face(s), ${summary.reviewImageCount} image(s) flagged for review${movedText} in "${collection.directory}" (${summary.analyzedCount} analyzed, ${summary.skippedCount} skipped). manifest written to "${report.manifestPath}".`
    );
    yield* logDetectFacesEntries(entries, sortedSkipped);

    return report;
  });

  if (options.json) {
    return yield* program;
  }

  return yield* profilePhase(program, {
    phase: "files.detect-faces",
    attributes: {
      edgeMarginPct: `${options.edgeMarginPct}`,
      json: `${options.json}`,
      minConfidence: `${options.minConfidence}`,
      minFaceAreaPct: `${options.minFaceAreaPct}`,
    },
  });
});

const normalizeFilesImpl = Effect.fn("FilesCommandService.normalizeFiles")(function* (
  options: NormalizeFilesOptions
): Effect.fn.Return<NormalizeSummary, FilesCommandError, FilesCommandServiceRequirements> {
  const program = Effect.gen(function* () {
    const maxLongEdge = yield* validateNormalizeMaxLongEdge(options.maxLongEdge);
    const dedupe = options.dedupe || O.isSome(options.moveDuplicatesTo);
    const validatedOptions = NormalizeFilesOptions.make({
      dedupe,
      dir: options.dir,
      dryRun: options.dryRun,
      format: options.format,
      manifest: options.manifest,
      maxLongEdge,
      moveDuplicatesTo: options.moveDuplicatesTo,
      outDir: options.outDir,
      overwrite: options.overwrite,
    });
    const plan = yield* buildNormalizePlan(validatedOptions);
    const plannedCount = A.length(plan.entries);
    const skippedCount = A.length(plan.skipped);
    const resizedCount = A.length(A.filter(plan.entries, (entry) => entry.resized));

    yield* Console.log(
      `files normalize: ${plannedCount} image file(s) planned from "${plan.sourceDirectory}" to "${plan.outputDirectory}".`
    );
    if (hasSkippedFiles(skippedCount)) {
      yield* Console.log(`files normalize: skipped ${skippedCount} unsupported or non-image source entry(s).`);
    }
    yield* logNormalizePlan(plan);
    yield* Effect.logInfo({
      message: "files normalize planned",
      plannedCount,
      skippedCount,
      resizedCount,
      duplicateDirectory: pipe(
        plan.duplicateDirectory,
        O.getOrElse(() => "none")
      ),
      outputDirectory: plan.outputDirectory,
      manifestPath: plan.manifestPath,
    });

    if (options.dryRun) {
      yield* Console.log("files normalize: dry run; no files written.");
      return NormalizeSummary.make({
        directory: plan.sourceDirectory,
        duplicateCount: 0,
        dryRun: true,
        format: options.format,
        manifestPath: plan.manifestPath,
        manifestWritten: false,
        maxLongEdge,
        movedDuplicateCount: 0,
        normalizedCount: 0,
        outputDirectory: plan.outputDirectory,
        plannedCount,
        resizedCount,
        skippedCount,
      });
    }

    yield* preflightNormalizeOutputs(plan, options.overwrite);
    const applyResult = yield* applyNormalizePlan(plan, maxLongEdge, validatedOptions.dedupe, options.overwrite);
    const completedEntries = applyResult.completedEntries;
    const duplicateCount = A.length(applyResult.duplicateSkippedEntries);
    const movedDuplicateCount = A.length(applyResult.duplicateMoves);
    const completedResizedCount = A.length(A.filter(completedEntries, (entry) => entry.resized));
    yield* Console.log(
      `files normalize: normalized ${A.length(completedEntries)} image file(s); skipped ${duplicateCount} duplicate image(s); moved ${movedDuplicateCount} duplicate source file(s); manifest written to "${plan.manifestPath}".`
    );
    yield* Effect.logInfo({
      message: "files normalize completed",
      duplicateCount,
      movedDuplicateCount,
      normalizedCount: A.length(completedEntries),
      skippedCount: skippedCount + duplicateCount,
      resizedCount: completedResizedCount,
      outputDirectory: plan.outputDirectory,
      manifestPath: plan.manifestPath,
    });

    return NormalizeSummary.make({
      directory: plan.sourceDirectory,
      duplicateCount,
      dryRun: false,
      format: options.format,
      manifestPath: plan.manifestPath,
      manifestWritten: true,
      maxLongEdge,
      movedDuplicateCount,
      normalizedCount: A.length(completedEntries),
      outputDirectory: plan.outputDirectory,
      plannedCount,
      resizedCount: completedResizedCount,
      skippedCount: skippedCount + duplicateCount,
    });
  });

  return yield* profilePhase(program, {
    phase: "files.normalize",
    attributes: {
      format: options.format,
      dryRun: `${options.dryRun}`,
      dedupe: `${options.dedupe || O.isSome(options.moveDuplicatesTo)}`,
      moveDuplicatesTo: pipe(
        options.moveDuplicatesTo,
        O.getOrElse(() => "none")
      ),
      overwrite: `${options.overwrite}`,
    },
  });
});

const sortAndRenameFilesImpl = Effect.fn("FilesCommandService.sortAndRenameFiles")(function* (
  dir: string,
  prefix: string,
  dryRun: boolean,
  withDimensions = false
): Effect.fn.Return<SortAndRenameSummary, FilesCommandError, FilesCommandServiceRequirements> {
  const safePrefix = yield* validatePrefix(prefix);
  const { directory } = yield* validateDirectory(dir);
  const plan = yield* buildRenamePlan(directory, safePrefix, withDimensions);
  const entries = plan.entries;

  if (!A.isReadonlyArrayNonEmpty(entries)) {
    yield* Console.log(`files sort-and-rename: 0 file(s) in "${directory}"; nothing to rename.`);
    if (withDimensions === true && hasSkippedFiles(plan.skippedCount)) {
      yield* Console.log(`files sort-and-rename: skipped ${plan.skippedCount} non-media file(s).`);
    }
    return SortAndRenameSummary.make({
      directory,
      dryRun,
      plannedCount: 0,
      renamedCount: 0,
      skippedCount: plan.skippedCount,
      withDimensions,
    });
  }

  yield* preflightTargetCollisions(entries);
  yield* Console.log(`files sort-and-rename: ${A.length(entries)} file(s) planned in "${directory}".`);
  if (withDimensions === true && hasSkippedFiles(plan.skippedCount)) {
    yield* Console.log(`files sort-and-rename: skipped ${plan.skippedCount} non-media file(s).`);
  }
  yield* logRenamePlan(entries);

  if (dryRun) {
    yield* Console.log("files sort-and-rename: dry run; no files renamed.");
    return SortAndRenameSummary.make({
      directory,
      dryRun,
      plannedCount: A.length(entries),
      renamedCount: 0,
      skippedCount: plan.skippedCount,
      withDimensions,
    });
  }

  yield* applyRenamePlan(directory, entries);
  yield* Console.log(`files sort-and-rename: renamed ${A.length(entries)} file(s).`);

  return SortAndRenameSummary.make({
    directory,
    dryRun,
    plannedCount: A.length(entries),
    renamedCount: A.length(entries),
    skippedCount: plan.skippedCount,
    withDimensions,
  });
});

const stripMetadataFilesImpl = Effect.fn("FilesCommandService.stripMetadataFiles")(function* (
  dir: string,
  dryRun: boolean
): Effect.fn.Return<StripMetadataSummary, FilesCommandError, FilesCommandServiceRequirements> {
  const { directory } = yield* validateDirectory(dir);
  const plan = yield* buildStripMetadataPlan(directory);
  const entries = plan.entries;

  if (!A.isReadonlyArrayNonEmpty(entries)) {
    yield* Console.log(`files strip-metadata: 0 media file(s) in "${directory}"; nothing to strip.`);
    if (hasSkippedFiles(plan.skippedCount)) {
      yield* Console.log(`files strip-metadata: skipped ${plan.skippedCount} unsupported or non-media file(s).`);
    }
    return StripMetadataSummary.make({
      directory,
      dryRun,
      imageCount: plan.imageCount,
      plannedCount: 0,
      skippedCount: plan.skippedCount,
      strippedCount: 0,
      videoCount: plan.videoCount,
    });
  }

  yield* Console.log(`files strip-metadata: ${A.length(entries)} media file(s) planned in "${directory}".`);
  if (hasSkippedFiles(plan.skippedCount)) {
    yield* Console.log(`files strip-metadata: skipped ${plan.skippedCount} unsupported or non-media file(s).`);
  }
  yield* logStripMetadataPlan(entries);

  if (dryRun) {
    yield* Console.log("files strip-metadata: dry run; no files rewritten.");
    return StripMetadataSummary.make({
      directory,
      dryRun,
      imageCount: plan.imageCount,
      plannedCount: A.length(entries),
      skippedCount: plan.skippedCount,
      strippedCount: 0,
      videoCount: plan.videoCount,
    });
  }

  yield* applyStripMetadataPlan(directory, entries);
  yield* Console.log(
    `files strip-metadata: stripped ${A.length(entries)} media file(s) (${plan.imageCount} image, ${plan.videoCount} video).`
  );

  return StripMetadataSummary.make({
    directory,
    dryRun,
    imageCount: plan.imageCount,
    plannedCount: A.length(entries),
    skippedCount: plan.skippedCount,
    strippedCount: A.length(entries),
    videoCount: plan.videoCount,
  });
});

const makeFilesCommandService = Effect.fn("FilesCommandService.make")(function* () {
  const runtimeContext = yield* Effect.context<FilesCommandServiceRequirements>();

  return FilesCommandService.of({
    archivePoorCandidates: Effect.fn("FilesCommandService.archivePoorCandidates")((options) =>
      archivePoorCandidatesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    createCaptionFiles: Effect.fn("FilesCommandService.createCaptionFiles")((options) =>
      createCaptionFilesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    cropBordersFiles: Effect.fn("FilesCommandService.cropBordersFiles")((options) =>
      cropBordersFilesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    detectBordersFiles: Effect.fn("FilesCommandService.detectBordersFiles")((options) =>
      detectBordersFilesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    detectFacesFiles: Effect.fn("FilesCommandService.detectFacesFiles")((options) =>
      detectFacesFilesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    normalizeFiles: Effect.fn("FilesCommandService.normalizeFiles")((options) =>
      normalizeFilesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    processFiles: Effect.fn("FilesCommandService.processFiles")((options) =>
      processFilesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    sortAndRenameFiles: Effect.fn("FilesCommandService.sortAndRenameFiles")(
      (dir, prefix, dryRun, withDimensions = false) =>
        sortAndRenameFilesImpl(dir, prefix, dryRun, withDimensions).pipe(Effect.provide(runtimeContext))
    ),
    stripMetadataFiles: Effect.fn("FilesCommandService.stripMetadataFiles")((dir, dryRun) =>
      stripMetadataFilesImpl(dir, dryRun).pipe(Effect.provide(runtimeContext))
    ),
  });
});

/**
 * Live service layer for dataset file curation operations.
 *
 * @example
 * ```ts
 * import { FilesCommandServiceLive } from "@beep/repo-cli/commands/Files"
 * console.log(FilesCommandServiceLive)
 * ```
 * @category layers
 * @since 0.0.0
 */
export const FilesCommandServiceLive: Layer.Layer<FilesCommandService, never, FilesCommandServiceRequirements> =
  Layer.effect(FilesCommandService, makeFilesCommandService());

/**
 * Archive obvious poor image candidates out of a dataset directory.
 *
 * @param options - Candidate archival options.
 * @returns Summary counts for the operation.
 * @example
 * ```ts
 * import { archivePoorCandidates } from "@beep/repo-cli/commands/Files"
 * console.log(archivePoorCandidates)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const archivePoorCandidates = Effect.fn("Files.archivePoorCandidates")(function* (
  options: ArchivePoorCandidatesOptions
): Effect.fn.Return<ArchivePoorCandidatesSummary, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.archivePoorCandidates(options);
});

/**
 * Create same-stem caption sidecar files for direct image files.
 *
 * @param options - Caption sidecar creation options.
 * @returns Summary counts for the operation.
 * @example
 * ```ts
 * import { createCaptionFiles } from "@beep/repo-cli/commands/Files"
 * console.log(createCaptionFiles)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const createCaptionFiles = Effect.fn("Files.createCaptionFiles")(function* (
  options: CreateCaptionFilesOptions
): Effect.fn.Return<CreateCaptionFilesSummary, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.createCaptionFiles(options);
});

/**
 * Crop solid or near-solid borders from direct image files.
 *
 * @param options - Border crop options.
 * @returns Summary counts for the operation.
 * @example
 * ```ts
 * import { cropBordersFiles } from "@beep/repo-cli/commands/Files"
 * console.log(cropBordersFiles)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const cropBordersFiles = Effect.fn("Files.cropBordersFiles")(function* (
  options: CropBordersOptions
): Effect.fn.Return<CropBordersSummary, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.cropBordersFiles(options);
});

/**
 * Detect solid or near-solid borders in direct image files.
 *
 * @param options - Border detection options.
 * @returns JSON-safe detection report.
 * @example
 * ```ts
 * import { detectBordersFiles } from "@beep/repo-cli/commands/Files"
 * console.log(detectBordersFiles)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const detectBordersFiles = Effect.fn("Files.detectBordersFiles")(function* (
  options: DetectBordersOptions
): Effect.fn.Return<DetectBordersReport, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.detectBordersFiles(options);
});

/**
 * Detect human faces in direct image files.
 *
 * @param options - Face detection options.
 * @returns JSON-safe face detection report.
 * @example
 * ```ts
 * import { detectFacesFiles } from "@beep/repo-cli/commands/Files"
 * console.log(detectFacesFiles)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const detectFacesFiles = Effect.fn("Files.detectFacesFiles")(function* (
  options: DetectFacesOptions
): Effect.fn.Return<DetectFacesReport, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.detectFacesFiles(options);
});

/**
 * Normalize direct image files into an output directory and write a transform manifest.
 *
 * @param options - Normalization options.
 * @returns Summary counts for the operation.
 * @example
 * ```ts
 * import { normalizeFiles } from "@beep/repo-cli/commands/Files"
 * console.log(normalizeFiles)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const normalizeFiles = Effect.fn("Files.normalizeFiles")(function* (
  options: NormalizeFilesOptions
): Effect.fn.Return<NormalizeSummary, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.normalizeFiles(options);
});

/**
 * Process a file or directory into the V1 file-processing proof manifest tree.
 *
 * @param options - File-processing proof options.
 * @returns Summary counts for the operation.
 * @effects Requires {@link FilesCommandService}; reads source files, writes the proof manifest tree, and reports failures through {@link FilesCommandError}.
 * @example
 * ```ts
 * import { processFiles } from "@beep/repo-cli/commands/Files"
 * console.log(processFiles)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const processFiles = Effect.fn("Files.processFiles")(function* (
  options: ProcessFilesOptions
): Effect.fn.Return<ProcessFilesSummary, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.processFiles(options);
});

/**
 * Sort direct regular files in a directory by size and rename them with a generated prefix.
 *
 * @param dir - Directory whose direct regular files should be sorted and renamed.
 * @param prefix - Safe generated filename prefix.
 * @param dryRun - Whether to print the plan without applying it.
 * @param withDimensions - Whether to include probed media dimensions in generated names.
 * @returns Summary counts for the operation.
 * @example
 * ```ts
 * import { sortAndRenameFiles } from "@beep/repo-cli/commands/Files"
 * console.log(sortAndRenameFiles)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const sortAndRenameFiles = Effect.fn("Files.sortAndRenameFiles")(function* (
  dir: string,
  prefix: string,
  dryRun: boolean,
  withDimensions = false
): Effect.fn.Return<SortAndRenameSummary, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.sortAndRenameFiles(dir, prefix, dryRun, withDimensions);
});

/**
 * Strip user-authored metadata from direct image and video files in a directory.
 * Unless `dryRun` is true, selected files are rewritten in place.
 *
 * @param dir - Directory whose direct media files should be stripped.
 * @param dryRun - Whether to print the plan without applying it.
 * @returns Summary counts for the operation.
 * @example
 * ```ts
 * import { stripMetadataFiles } from "@beep/repo-cli/commands/Files/index"
 *
 * const program = stripMetadataFiles("./tmp", true)
 * console.log(program)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const stripMetadataFiles = Effect.fn("Files.stripMetadataFiles")(function* (
  dir: string,
  dryRun: boolean
): Effect.fn.Return<StripMetadataSummary, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.stripMetadataFiles(dir, dryRun);
});
