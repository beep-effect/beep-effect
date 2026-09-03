/**
 * Service implementation for dataset file curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  FaceDetectionModelConfig,
  FaceDetectionService,
  makeFaceDetectionService,
  withDetector,
} from "@beep/face-detection";
import { $RepoCliId } from "@beep/identity/packages";
import { profilePhase } from "@beep/observability";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, Context, Effect, FileSystem, HashSet, Layer, Order, Path, pipe, Result } from "effect";
import { printLines } from "../../internal/cli/Printer.ts";
import { FilesCommandError, failOnExtensionlessFile, formatPlatformError } from "./Files.errors.ts";
import {
  assessImageCandidate,
  byNameAscending,
  bySizeDescendingThenNameAscending,
  cropBordersPlanEntryFromDetection,
  hasSkippedFiles,
  isImageFileExtension,
  isSupportedMetadataImageFile,
  mediaDimensionsChanged,
  mediaKindFromExtension,
  normalizeBareExtension,
  normalizeOutputDimensions,
  targetNameForEntry,
} from "./Files.media.ts";
import { uniqueArchiveTargetName, uniqueNormalizeTargetName } from "./Files.plan.ts";
import { FilesConcurrency, runFilesProgressForEach } from "./Files.progress.ts";
import {
  archivedEntries,
  countMovedSidecars,
  logArchivePoorCandidatesPlan,
  logCreateCaptionFilesPlan,
  logCropBordersPlan,
  logDetectBordersEntries,
  logDetectFacesEntries,
  logNormalizePlan,
  logRenamePlan,
  logStripMetadataPlan,
  renderDetectBordersReportJson,
  renderDetectFacesReportJson,
  writeDetectFacesManifest,
} from "./Files.render.ts";
import {
  ArchivedSidecarEntry,
  ArchivePoorCandidatesEntry,
  ArchivePoorCandidatesManifestOptions,
  ArchivePoorCandidatesPlan,
  ArchivePoorCandidatesSkippedEntry,
  ArchivePoorCandidatesSummary,
  CreateCaptionFilesPlan,
  CreateCaptionFilesPlanEntry,
  CreateCaptionFilesSkippedEntry,
  CreateCaptionFilesSummary,
  CropBordersPlan,
  CropBordersSummary,
  DetectBordersOptions,
  DetectBordersReport,
  DetectBordersSkippedEntry,
  DetectBordersSummary,
  DetectFacesReport,
  DetectFacesReportOptions,
  DetectFacesSkippedEntry,
  DetectFacesSummary,
  NormalizeFilesOptions,
  NormalizeManifestOptions,
  NormalizePlan,
  NormalizePlanEntry,
  NormalizeSkippedEntry,
  NormalizeSummary,
  RenamePlan,
  RenamePlanEntry,
  SortAndRenameSummary,
  SortableFile,
  SortableFileCollection,
  StripMetadataPlan,
  StripMetadataPlanEntry,
  StripMetadataSummary,
} from "./Files.schemas.ts";
import { analyzeDetectBordersFile, analyzeDetectFacesFile } from "./internal/Analysis.ts";
import {
  applyArchivePoorCandidatesPlan,
  applyCreateCaptionFilesPlan,
  applyCropBordersPlan,
  applyNormalizePlan,
  applyRenamePlan,
  applyStripMetadataPlan,
  moveDetectFacesNoFaceEntries,
  preflightArchivePoorCandidatesOutputs,
  preflightNormalizeOutputs,
  preflightTargetCollisions,
} from "./internal/Apply.ts";
import { runFlattenMediaFiles } from "./internal/FlattenMedia.ts";
import { auditImagesImpl, curateImagesImpl } from "./internal/ImageCuration.ts";
import { runMatchPerson } from "./internal/MatchPerson.ts";
import { PersonMatchWorkerServiceLive } from "./internal/MatchPerson.worker-service.ts";
import { isUnsafeMetadataVideoExtension, probeImageDimensions, probeMediaDimensions } from "./internal/MediaExec.ts";
import { processFilesImpl } from "./internal/Process.ts";
import {
  parseSidecarExtensions,
  validateArchiveDirectories,
  validateArchivePoorCandidatesOptions,
  validateCreateCaptionFilesOptions,
  validateCropBordersOptions,
  validateDetectBordersOptions,
  validateDetectFacesMoveNoFaceDirectory,
  validateDetectFacesOptions,
  validateDirectory,
  validateNormalizeDirectories,
  validateNormalizeMaxLongEdge,
  validatePrefix,
} from "./internal/Validation.ts";
import type { Terminal } from "effect";
import type * as Crypto from "effect/Crypto";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type {
  ArchivePoorCandidatesOptions,
  ArchivePoorCandidatesSkippedReason,
  CreateCaptionFilesOptions,
  CreateCaptionFilesSkippedReason,
  CropBordersOptions,
  CropBordersPlanEntry,
  DetectBordersEntry,
  DetectBordersSkippedReason,
  DetectFacesEntry,
  DetectFacesOptions,
  DetectFacesSkippedReason,
  FlattenMediaOptions,
  FlattenMediaSummary,
  ImageAuditManifest,
  ImageAuditOptions,
  ImageCurationOptions,
  ImageCurationSummary,
  MatchPersonOptions,
  MediaDimensions,
  MediaKind,
  NormalizeImageFormat,
  NormalizeSkippedReason,
  PersonMatchReport,
  PositiveMediaDimension,
  ProcessFilesOptions,
  ProcessFilesSummary,
  SafeFilePrefix,
} from "./Files.schemas.ts";
import type { PersonMatchWorkerService } from "./internal/MatchPerson.worker-service.ts";

const $I = $RepoCliId.create("commands/Files/Files.service");

type FilesCommandPlatformRequirements =
  | FileSystem.FileSystem
  | Path.Path
  | Terminal.Terminal
  | ChildProcessSpawner.ChildProcessSpawner
  | Crypto.Crypto
  | HttpClient.HttpClient;

type FilesCommandServiceRequirements = FilesCommandPlatformRequirements | PersonMatchWorkerService;

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

/**
 * Service contract for dataset file curation operations.
 *
 * **Example** (Service method key type)
 *
 * ```ts
 * import type { FilesCommandServiceShape } from "@beep/repo-cli/commands/Files"
 *
 * type ServiceMethod = keyof FilesCommandServiceShape
 * const method: ServiceMethod = "normalizeFiles"
 * ```
 *
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
   * Audit direct images without mutating source bytes.
   *
   * @since 0.0.0
   */
  readonly auditImages: (options: ImageAuditOptions) => Effect.Effect<ImageAuditManifest, FilesCommandError>;

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
   * Validate a complete decision ledger and materialize canonical PNG derivatives.
   *
   * @since 0.0.0
   */
  readonly curateImages: (options: ImageCurationOptions) => Effect.Effect<ImageCurationSummary, FilesCommandError>;

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
   * Recursively move image and video files into one flat destination directory.
   *
   * @since 0.0.0
   */
  readonly flattenMediaFiles: (options: FlattenMediaOptions) => Effect.Effect<FlattenMediaSummary, FilesCommandError>;

  /**
   * Match a trusted target person across a local photo collection.
   *
   * @since 0.0.0
   */
  readonly matchPerson: (options: MatchPersonOptions) => Effect.Effect<PersonMatchReport, FilesCommandError>;

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
 * **Example** (Service tag identity)
 *
 * ```ts
 * import { FilesCommandService } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof FilesCommandService = FilesCommandService
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FilesCommandService extends Context.Service<FilesCommandService, FilesCommandServiceShape>()(
  $I`FilesCommandService`
) {}

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
    const targetName = uniqueNormalizeTargetName(sourceStem, options.format, usedTargetNames);
    usedTargetNames = HashSet.add(usedTargetNames, targetName);
    const outputPath = path.join(outputDirectory, targetName);

    planInputs = A.append(planInputs, {
      file,
      outputPath,
      targetName,
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

    const archiveTargetName = uniqueArchiveTargetName(sourceStem, file.extension, usedTargetNames);
    usedTargetNames = HashSet.add(usedTargetNames, archiveTargetName);
    const archivePath = path.join(archiveDirectory, archiveTargetName);
    const targetStem = path.basename(archiveTargetName, file.extension);
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
        archiveName: archiveTargetName,
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
    ? yield* runFilesProgressForEach(collection.files, (file) => probeMediaDimensions(file).pipe(Effect.asSome), {
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

/**
 * Print the files command index.
 *
 * **Example** (Print files index)
 *
 * ```ts
 * import { printFilesIndex } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof printFilesIndex = printFilesIndex
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const printFilesIndex = printLines([
  "Files commands:",
  "- bun run files audit-images --dir ./raw --model ./face_detection_yunet.onnx --manifest ./audit.json",
  "- bun run files curate-images --dir ./raw --decisions ./decisions.json --out-dir ./prepared",
  "- bun run files sort-and-rename --prefix image --dir ./tmp",
  "- bun run files sort-and-rename --prefix image --dir ./tmp --with-dimensions",
  "- bun run files flatten-media --dir ./raw --out-dir ./flat --dry-run",
  "- bun run files strip-metadata --dir ./tmp",
  "- bun run files normalize --dir ./raw --out-dir ./dataset/images --format png",
  "- bun run files normalize --dir ./raw --out-dir ./dataset/images --format png --dedupe",
  "- bun run files process --input ./sources --out-dir ./file-processing-proof",
  "- bun run files create-captions --dir ./dataset/images",
  "- bun run files archive-poor-candidates --dir ./dataset/images --archive-dir ./dataset/rejected",
  "- bun run files detect-borders --dir ./tmp",
  "- bun run files detect-faces --dir ./dataset/images --model ./face_detection_yunet.onnx",
  "- bun run files match-person --references ./known-person --dir ./mixed --manifest ./person-match.json --accept-model-license",
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

const flattenMediaFilesImpl = Effect.fn("FilesCommandService.flattenMediaFiles")(function* (
  options: FlattenMediaOptions
): Effect.fn.Return<FlattenMediaSummary, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  return yield* profilePhase(runFlattenMediaFiles(options), {
    phase: "files.flatten-media",
    attributes: {
      dryRun: `${options.dryRun}`,
    },
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
    auditImages: Effect.fn("FilesCommandService.auditImages")((options) =>
      auditImagesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    archivePoorCandidates: Effect.fn("FilesCommandService.archivePoorCandidates")((options) =>
      archivePoorCandidatesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    createCaptionFiles: Effect.fn("FilesCommandService.createCaptionFiles")((options) =>
      createCaptionFilesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    cropBordersFiles: Effect.fn("FilesCommandService.cropBordersFiles")((options) =>
      cropBordersFilesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    curateImages: Effect.fn("FilesCommandService.curateImages")((options) =>
      curateImagesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    detectBordersFiles: Effect.fn("FilesCommandService.detectBordersFiles")((options) =>
      detectBordersFilesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    detectFacesFiles: Effect.fn("FilesCommandService.detectFacesFiles")((options) =>
      detectFacesFilesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    flattenMediaFiles: Effect.fn("FilesCommandService.flattenMediaFiles")((options) =>
      flattenMediaFilesImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    matchPerson: Effect.fn("FilesCommandService.matchPerson")((options) =>
      runMatchPerson(options).pipe(Effect.provide(runtimeContext))
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
 * **Example** (Live layer identity)
 *
 * ```ts
 * import { FilesCommandServiceLive } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof FilesCommandServiceLive = FilesCommandServiceLive
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const FilesCommandServiceLive: Layer.Layer<FilesCommandService, never, FilesCommandPlatformRequirements> =
  Layer.effect(FilesCommandService, makeFilesCommandService()).pipe(Layer.provide(PersonMatchWorkerServiceLive));

/**
 * Audit direct images and write deterministic review evidence without changing source files.
 *
 * **Example** (Audit images function)
 *
 * ```ts
 * import { auditImages } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof auditImages = auditImages
 * ```
 *
 * @param options - Image audit directory, model, manifest, and overwrite options.
 * @returns The completed image audit manifest.
 * @category use-cases
 * @since 0.0.0
 */
export const auditImages = Effect.fn("Files.auditImages")(function* (
  options: ImageAuditOptions
): Effect.fn.Return<ImageAuditManifest, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.auditImages(options);
});

/**
 * Archive obvious poor image candidates out of a dataset directory.
 *
 * **Example** (Archive poor candidates)
 *
 * ```ts
 * import { archivePoorCandidates } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof archivePoorCandidates = archivePoorCandidates
 * ```
 *
 * @param options - Candidate archival options.
 * @returns Summary counts for the operation.
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
 * **Example** (Create caption sidecars)
 *
 * ```ts
 * import { createCaptionFiles } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof createCaptionFiles = createCaptionFiles
 * ```
 *
 * @param options - Caption sidecar creation options.
 * @returns Summary counts for the operation.
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
 * **Example** (Crop image borders)
 *
 * ```ts
 * import { cropBordersFiles } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof cropBordersFiles = cropBordersFiles
 * ```
 *
 * @param options - Border crop options.
 * @returns Summary counts for the operation.
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
 * Validate a complete decision ledger and materialize canonical PNG derivatives.
 *
 * **Example** (Curate image derivatives)
 *
 * ```ts
 * import { curateImages } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof curateImages = curateImages
 * ```
 *
 * @param options - Source, ledger, output, dry-run, and overwrite options.
 * @returns Summary counts for the curation run.
 * @category use-cases
 * @since 0.0.0
 */
export const curateImages = Effect.fn("Files.curateImages")(function* (
  options: ImageCurationOptions
): Effect.fn.Return<ImageCurationSummary, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.curateImages(options);
});

/**
 * Detect solid or near-solid borders in direct image files.
 *
 * **Example** (Detect image borders)
 *
 * ```ts
 * import { detectBordersFiles } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof detectBordersFiles = detectBordersFiles
 * ```
 *
 * @param options - Border detection options.
 * @returns JSON-safe detection report.
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
 * **Example** (Detect faces in images)
 *
 * ```ts
 * import { detectFacesFiles } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof detectFacesFiles = detectFacesFiles
 * ```
 *
 * @param options - Face detection options.
 * @returns JSON-safe face detection report.
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
 * Recursively move image and video files into one flat destination directory.
 *
 * **Example** (Flatten media dry-run)
 *
 * ```ts
 * import { FlattenMediaOptions, flattenMediaFiles } from "@beep/repo-cli/commands/Files"
 * import { Effect } from "effect"
 *
 * const program = flattenMediaFiles(FlattenMediaOptions.make({
 *   dir: "./raw",
 *   dryRun: true,
 *   outDir: "./flat"
 * }))
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @effects Recursively reads source directories and moves selected files unless dry-run is enabled.
 * @category use-cases
 * @since 0.0.0
 */
export const flattenMediaFiles = Effect.fn("Files.flattenMediaFiles")(function* (
  options: FlattenMediaOptions
): Effect.fn.Return<FlattenMediaSummary, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.flattenMediaFiles(options);
});

/**
 * Match a trusted target person across a local photo collection.
 *
 * **Details**
 *
 * The operation runs the pinned InsightFace worker locally, writes a
 * schema-versioned manifest without embeddings, and optionally copies
 * accepted or review candidates without mutating source photos.
 *
 * **Example** (Match one person)
 *
 * ```ts
 * import { matchPerson } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof matchPerson = matchPerson
 * ```
 *
 * @param options - Reference, candidate, threshold, cache, and output options.
 * @returns The completed person-match report.
 * @category use-cases
 * @since 0.0.0
 */
export const matchPerson = Effect.fn("Files.matchPerson")(function* (
  options: MatchPersonOptions
): Effect.fn.Return<PersonMatchReport, FilesCommandError, FilesCommandService> {
  const files = yield* FilesCommandService;
  return yield* files.matchPerson(options);
});

/**
 * Normalize direct image files into an output directory and write a transform manifest.
 *
 * **Example** (Normalize files function)
 *
 * ```ts
 * import { normalizeFiles } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof normalizeFiles = normalizeFiles
 * ```
 *
 * @param options - Normalization options.
 * @returns Summary counts for the operation.
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
 * **Example** (Process files function)
 *
 * ```ts
 * import { processFiles } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof processFiles = processFiles
 * ```
 *
 * @param options - File-processing proof options.
 * @returns Summary counts for the operation.
 * @effects Requires {@link FilesCommandService}; reads source files, writes the proof manifest tree, and reports failures through {@link FilesCommandError}.
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
 * **Example** (Sort and rename files)
 *
 * ```ts
 * import { sortAndRenameFiles } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof sortAndRenameFiles = sortAndRenameFiles
 * ```
 *
 * @param dir - Directory whose direct regular files should be sorted and renamed.
 * @param prefix - Safe generated filename prefix.
 * @param dryRun - Whether to print the plan without applying it.
 * @param withDimensions - Whether to include probed media dimensions in generated names.
 * @returns Summary counts for the operation.
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
 * **Example** (Strip metadata dry-run)
 *
 * ```ts
 * import { stripMetadataFiles } from "@beep/repo-cli/commands/Files/index"
 *
 * const program = stripMetadataFiles("./tmp", true)
 * console.log(program) // example value
 * ```
 *
 * @param dir - Directory whose direct media files should be stripped.
 * @param dryRun - Whether to print the plan without applying it.
 * @returns Summary counts for the operation.
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
