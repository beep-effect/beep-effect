/**
 * Staged filesystem mutations for Files command plans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Effect, FileSystem, HashMap, HashSet, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  bytesEqual,
  hashFileSha256 as hashFileSha256Hex,
  preflightOverwritableFile as preflightOverwritableFileShared,
  renameOrFail as renameOrFailShared,
} from "../../../internal/cli/FsGuards.ts";
import { FilesCommandError, formatPlatformError } from "../Files.errors.ts";
import { formatIndex, makeStripMetadataTempEntries, selectedCanonicalPathSet } from "../Files.media.ts";
import { uniqueArchiveTargetName } from "../Files.plan.ts";
import { FilesConcurrency, runFilesProgressForEach } from "../Files.progress.ts";
import {
  archivedEntries,
  makeArchivePoorCandidatesManifest,
  renderArchivePoorCandidatesManifest,
  renderNormalizeManifest,
} from "../Files.render.ts";
import {
  DetectFacesEntry,
  FileSha256Hash,
  NormalizeManifest,
  NormalizeManifestSummary,
  NormalizePlanEntry,
  NormalizeSkippedEntry,
} from "../Files.schemas.ts";
import { cropImageBordersToTemp, normalizeImageToTemp, stripMetadataToTemp } from "./MediaExec.ts";
import type { Terminal } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type {
  ArchivePoorCandidatesPlan,
  CreateCaptionFilesPlan,
  CropBordersPlanEntry,
  NormalizePlan,
  PositiveMediaDimension,
  RenamePlanEntry,
  StripMetadataPlanEntry,
} from "../Files.schemas.ts";

const decodeFileSha256Hash = S.decodeUnknownEffect(FileSha256Hash);

interface NormalizeSeenOutput {
  readonly entry: NormalizePlanEntry;
  readonly outputHash: FileSha256Hash;
  readonly tempPath: string;
}

/**
 * Planned duplicate source move produced while applying a normalize plan.
 *
 * @category models
 * @since 0.0.0
 */
interface NormalizeDuplicateMove {
  readonly sourcePath: string;
  readonly targetPath: string;
}

/**
 * Result of applying a normalize plan.
 *
 * @category models
 * @since 0.0.0
 */
interface NormalizeApplyResult {
  readonly completedEntries: ReadonlyArray<NormalizePlanEntry>;
  readonly duplicateMoves: ReadonlyArray<NormalizeDuplicateMove>;
  readonly duplicateSkippedEntries: ReadonlyArray<NormalizeSkippedEntry>;
}

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

/**
 * Refuse unsafe overwrites with the Files command's exact error text.
 *
 * @param filePath - Candidate output path.
 * @param overwrite - Whether regular-file overwrite is allowed.
 * @param description - Human-readable output description.
 * @category validation
 * @since 0.0.0
 */
export const preflightOverwritableFile = Effect.fn("Files.preflightOverwritableFile")(function* (
  filePath: string,
  overwrite: boolean,
  description: string
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  yield* preflightOverwritableFileShared(filePath, {
    description,
    onInspectError: (cause, failedPath, failedDescription) =>
      formatPlatformError(`Failed to inspect ${failedDescription}`, failedPath, { cause }),
    onRefuseNonFile: (failedPath, failedDescription) =>
      FilesCommandError.make({
        message: `Refusing to overwrite non-file ${failedDescription}: "${failedPath}"`,
      }),
    onRefuseOverwrite: (failedPath, failedDescription) =>
      FilesCommandError.make({
        message: `Refusing to overwrite existing ${failedDescription}: "${failedPath}"`,
      }),
    onStatError: (cause, failedPath, failedDescription) =>
      formatPlatformError(`Failed to stat ${failedDescription}`, failedPath, { cause }),
    overwrite,
  });
});

/**
 * Preflight normalize image and manifest output paths.
 *
 * @param plan - Normalize plan to inspect.
 * @param overwrite - Whether regular-file overwrite is allowed.
 * @category validation
 * @since 0.0.0
 */
export const preflightNormalizeOutputs = Effect.fn("Files.preflightNormalizeOutputs")(function* (
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

/**
 * Preflight archive outputs, sidecars, and manifest paths.
 *
 * @param plan - Archive plan to inspect.
 * @param overwrite - Whether regular-file overwrite is allowed.
 * @category validation
 * @since 0.0.0
 */
export const preflightArchivePoorCandidatesOutputs = Effect.fn("Files.preflightArchivePoorCandidatesOutputs")(
  function* (
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
  }
);

/**
 * Refuse rename targets that would overwrite paths outside the selected rename set.
 *
 * @param plan - Rename plan entries.
 * @category validation
 * @since 0.0.0
 */
export const preflightTargetCollisions = Effect.fn("Files.preflightTargetCollisions")(function* (
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

/**
 * Apply a caption creation plan through temporary sidecar writes.
 *
 * @param plan - Caption creation plan.
 * @category mutations
 * @since 0.0.0
 */
export const applyCreateCaptionFilesPlan = Effect.fn("Files.applyCreateCaptionFilesPlan")(function* (
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

const hashFileSha256 = Effect.fn("Files.hashFileSha256")(function* (
  filePath: string
): Effect.fn.Return<FileSha256Hash, FilesCommandError, FileSystem.FileSystem | Crypto.Crypto> {
  const hex = yield* hashFileSha256Hex(filePath, (cause, failedPath) =>
    formatPlatformError("Failed to read file for hashing", failedPath, { cause })
  );
  return yield* decodeFileSha256Hash(`sha256:${hex}`).pipe(
    FilesCommandError.mapError(`Failed to hash normalized file "${filePath}"`)
  );
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

const renameOrFail: (
  sourcePath: string,
  targetPath: string,
  tempDir: string
) => Effect.Effect<void, FilesCommandError, FileSystem.FileSystem> = Effect.fn("Files.renameOrFail")(
  function* (sourcePath, targetPath, tempDir) {
    yield* renameOrFailShared(sourcePath, targetPath, {
      onError: (cause, failedSourcePath, failedTargetPath) =>
        FilesCommandError.new(
          cause,
          `Failed to rename "${failedSourcePath}" to "${failedTargetPath}". Recovery temp directory: "${tempDir}"`
        ),
    });
  }
);

/**
 * Apply a normalize plan through staged image writes, dedupe, and manifest commit.
 *
 * @param plan - Resolved normalize entries to stage, dedupe, and commit.
 * @param maxLongEdge - Optional maximum long edge.
 * @param dedupe - Whether exact normalized duplicates should be skipped.
 * @param overwrite - Whether regular-file overwrite is allowed.
 * @returns Applied entries plus duplicate move details.
 * @category mutations
 * @since 0.0.0
 */
export const applyNormalizePlan = Effect.fn("Files.applyNormalizePlan")(function* (
  plan: NormalizePlan,
  maxLongEdge: O.Option<PositiveMediaDimension>,
  dedupe: boolean,
  overwrite: boolean
): Effect.fn.Return<
  NormalizeApplyResult,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal | ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto
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

/**
 * Apply an archive-poor-candidates plan and write its manifest.
 *
 * @param plan - Move set describing which flagged files land in the archive tree.
 * @param overwrite - Whether regular-file overwrite is allowed.
 * @category mutations
 * @since 0.0.0
 */
export const applyArchivePoorCandidatesPlan = Effect.fn("Files.applyArchivePoorCandidatesPlan")(function* (
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
    ...(O.isSome(primaryFace) ? { primaryFace: primaryFace.value } : {}),
    ...(O.isSome(primaryFaceAreaPct) ? { primaryFaceAreaPct: primaryFaceAreaPct.value } : {}),
    sourceName: entry.sourceName,
    sourcePath: entry.sourcePath,
    width: entry.width,
  });
};

/**
 * Move no-face detection entries when requested and annotate report rows.
 *
 * @param entries - Face detection entries.
 * @param moveNoFaceDirectory - Optional target directory.
 * @param progressEnabled - Whether progress output is enabled.
 * @returns Entries with moved target fields when applicable.
 * @category mutations
 * @since 0.0.0
 */
export const moveDetectFacesNoFaceEntries = Effect.fn("Files.moveDetectFacesNoFaceEntries")(function* (
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
    const archiveTargetName = uniqueArchiveTargetName(sourceStem, entry.extension, usedTargetNames);
    usedTargetNames = HashSet.add(usedTargetNames, archiveTargetName);

    const targetPath = path.join(targetDirectory, archiveTargetName);
    const targetRelativePath = path.relative(targetDirectory, targetPath);
    nextEntries = A.append(
      nextEntries,
      withDetectFacesMovedNoFaceTarget(entry, archiveTargetName, targetPath, targetRelativePath)
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

/**
 * Apply a sort-and-rename plan through a staging directory.
 *
 * @param directory - Source directory.
 * @param plan - Rename plan entries.
 * @category mutations
 * @since 0.0.0
 */
export const applyRenamePlan = Effect.fn("Files.applyRenamePlan")(function* (
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

/**
 * Apply a metadata-strip plan through staged rewrites.
 *
 * @param directory - Source directory.
 * @param plan - Metadata strip entries.
 * @category mutations
 * @since 0.0.0
 */
export const applyStripMetadataPlan = Effect.fn("Files.applyStripMetadataPlan")(function* (
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

/**
 * Apply a crop-borders plan through staged rewrites.
 *
 * @param directory - Source directory.
 * @param plan - Border crop entries.
 * @category mutations
 * @since 0.0.0
 */
export const applyCropBordersPlan = Effect.fn("Files.applyCropBordersPlan")(function* (
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
